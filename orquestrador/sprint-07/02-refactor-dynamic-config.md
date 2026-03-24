# Sprint 7 — Refatoração: Configuração Dinâmica via Banco de Dados
## Release Notes — TechLead

**Projeto:** Omnimail — Monitor de E-mails Contábeis
**Responsável:** TechLead (Claude Opus)
**Data:** 2026-03-24
**Branch:** `main` (commit `e86fadf`)
**Status:** Concluída

---

## 1. Resumo Executivo

Refatoração arquitetural que move todas as configurações de runtime (Telegram, IMAP, remetentes monitorados) do arquivo `.env` para a tabela `Setting` do PostgreSQL, criptografadas com AES-256-GCM. Isso permite configuração pela interface web sem reiniciar o servidor.

---

## 2. Motivação

### Problema Anterior
- Credenciais do Telegram, IMAP e remetentes monitorados ficavam no `.env`
- Alterar qualquer configuração exigia editar o arquivo no servidor e reiniciar o NestJS
- A tela de Settings no frontend salvava no banco mas os services liam do `.env` — desconexão total
- O botão "Enviar Teste" do Telegram falhava porque o service ignorava o valor salvo no banco

### Princípio Violado
O design anterior violava o princípio de **Zero Hardcoded** do projeto: embora os valores não estivessem no código-fonte, estavam fixos em um arquivo no disco, exigindo acesso ao servidor para alterar.

---

## 3. Arquitetura Nova

### 3.1 Antes (estático)
```
.env → ConfigService → TelegramService/ImapService
                       (leitura única no constructor/onModuleInit)
```

### 3.2 Depois (dinâmico)
```
SettingsPage (UI) → PUT /settings/:key → CryptoService.encrypt() → Setting table (BD)
                                                                          ↓
TelegramService/ImapService → PrismaService.findUnique() → CryptoService.decrypt() → uso
                              (leitura por request)
```

### 3.3 Fluxo de Dados

1. **Usuário** acessa `/settings` no frontend
2. **Insere** Bot Token, Chat ID, dados IMAP
3. **Frontend** chama `PUT /settings/:key` com o valor
4. **SettingsService** criptografa com AES-256-GCM e salva na tabela `Setting`
5. **TelegramService** (ao enviar mensagem) lê do banco, descriptografa, cria instância do bot e envia
6. **ImapService** (ao fazer fetch) lê do banco, descriptografa, cria conexão IMAP e busca e-mails

---

## 4. Arquivos Modificados

### 4.1 Services Refatorados

| Arquivo | Mudança |
|---------|---------|
| `src/telegram/telegram.service.ts` | Removido `onModuleInit`. Removido `ConfigService`. Adicionado `CryptoService`. Cada método (`sendEmailAlert`, `sendStatusMessage`, `isConfigured`) lê token/chatId do banco via `getSettingValue()`. Bot criado por request (`polling: false`). |
| `src/telegram/telegram.module.ts` | Importa `CryptoModule` em vez de `ConfigModule` |
| `src/telegram/telegram.interface.ts` | `isConfigured()` agora retorna `Promise<boolean>` |
| `src/imap/imap.service.ts` | Removido `ConfigService`. Adicionado `PrismaService` + `CryptoService`. `getConfig()` agora é `async` e lê host/porta/user/password/tls do banco. |
| `src/imap/imap.module.ts` | Importa `PrismaModule` + `CryptoModule` em vez de `ConfigModule` |
| `src/email-processor/email-processor.service.ts` | Removido `ConfigService`. Novo método `getMonitoredSenders()` que lê do banco. `handleCron()` usa `getMonitoredSenders()`. `isConfigured()` agora com `await`. |
| `src/email-processor/email-processor.controller.ts` | Removido `ConfigService`. Usa `emailProcessorService.getMonitoredSenders()`. |
| `src/settings/settings.service.ts` | `testTelegram()` usa `await this.telegramService.isConfigured()` |

### 4.2 Configuração Simplificada

| Arquivo | Mudança |
|---------|---------|
| `src/app.module.ts` | Removidos `MONITORED_SENDERS`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` do Joi schema |
| `backend/.env` | Reduzido para 4 variáveis: `DATABASE_URL`, `JWT_SECRET`, `APP_SECRET`, `FRONTEND_URL` |

### 4.3 Testes Atualizados

| Arquivo | Mudança |
|---------|---------|
| `src/telegram/telegram.service.spec.ts` | Reescrito: mock de `PrismaService` + `CryptoService` em vez de `ConfigService`. Testes de `isConfigured()` agora async. |
| `src/imap/imap.service.spec.ts` | Mock de `PrismaService` + `CryptoService` com `setting.findUnique` retornando configs IMAP |
| `src/email-processor/email-processor.service.spec.ts` | Mock de `setting.findUnique` para `monitored_senders`. `isConfigured` mockado com `mockResolvedValue`. |
| `src/settings/settings.service.spec.ts` | `isConfigured` mockado com `mockResolvedValue` (async) |
| `test/emails.e2e-spec.ts` | Mock de `setting.findUnique` com valor criptografado real para `monitored_senders` |

---

## 5. Chaves de Configuração

Todas as configurações são armazenadas na tabela `Setting` com a seguinte estrutura:

| Chave | Tipo | Sensível | Descrição |
|-------|------|----------|-----------|
| `telegram_bot_token` | string | ✅ Mascarado | Token do bot (@BotFather) |
| `telegram_chat_id` | string | ❌ | ID do chat de destino |
| `monitored_senders` | string | ❌ | E-mails separados por vírgula |
| `sync_interval_hours` | string | ❌ | Intervalo do cronjob (futuro) |
| `imap_host` | string | ❌ | Servidor IMAP (ex: outlook.office365.com) |
| `imap_port` | string | ❌ | Porta IMAP (default: 993) |
| `imap_user` | string | ✅ Mascarado | Usuário/email IMAP |
| `imap_password` | string | ✅ Mascarado | Senha IMAP |
| `imap_tls` | string | ❌ | "true" ou "false" |

**Mascarado** = `GET /settings` retorna `***CONFIGURED***` ou últimos 4 caracteres.

---

## 6. Variáveis de Ambiente Remanescentes

O `.env` do backend agora contém apenas infraestrutura:

```env
DATABASE_URL=postgresql://...    # Conexão PostgreSQL
JWT_SECRET=...                   # Chave de assinatura JWT
APP_SECRET=...                   # Chave mestra AES-256-GCM (64 hex chars)
FRONTEND_URL=http://localhost:5173  # URL do frontend (CORS)
```

Nenhuma credencial de serviço externo fica no `.env`.

---

## 7. Testes

| Suite | Total | Status |
|-------|-------|--------|
| Backend unitários | 55 | ✅ Passando |
| Backend E2E | 29 | ✅ Passando |
| Frontend | 24 | ✅ Passando |
| **Total** | **108** | ✅ Tudo verde |

---

## 8. Impacto na Operação

### Para o usuário final
- Acessa `/settings` no navegador
- Configura Telegram, IMAP e remetentes sem tocar em arquivos
- Testa a conexão Telegram pelo botão "Enviar Teste"
- Alterações são imediatas — sem reiniciar servidor

### Para deploy
- `.env` tem apenas 4 variáveis de infraestrutura
- Primeira configuração feita pela UI após login
- Seed opcional (`npx prisma db seed`) para popular settings iniciais

---

*Documentação gerada em 2026-03-24 — Sprint 7 Refatoração Configuração Dinâmica*
