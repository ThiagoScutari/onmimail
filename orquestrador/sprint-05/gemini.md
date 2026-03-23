# Sprint 5 — Gemini: Telegram Bot Service

## Contexto
Sprint 5 do Omnimail (Scutari & Co). Backend e frontend funcionais (Sprints 1-4). Agora vamos adicionar alertas via Telegram. Sua parte: criar o serviço de Telegram e os templates de mensagem.

## Pré-requisito
- Sprints 1-4 completas
- Token do bot Telegram criado via @BotFather
- Chat ID do destinatário

## Sua Entrega

### 1. TelegramService
Arquivo: `backend/src/telegram/telegram.service.ts`

Dependência: `npm install node-telegram-bot-api` + `npm install -D @types/node-telegram-bot-api`

**Interface pública (Claude vai consumir):**
```typescript
export interface TelegramNotification {
  from: string;
  subject: string;
  date: string;
  emailId: string;
}

export interface TelegramServiceInterface {
  sendEmailAlert(notification: TelegramNotification): Promise<void>;
  sendStatusMessage(message: string): Promise<void>;
  isConfigured(): boolean;
}
```

**Comportamento:**
- Inicializa o bot com token do `.env` (`TELEGRAM_BOT_TOKEN`)
- Envia mensagens para o chat ID do `.env` (`TELEGRAM_CHAT_ID`)
- Se token ou chatId não configurados, `isConfigured()` retorna false e os métodos logam warning sem lançar exceção
- Mensagens formatadas em Markdown (Telegram parse_mode)

### 2. Templates de Mensagem

#### Alerta de Novo E-mail
```
🔴 *URGENTE — Novo E-mail Contábil*

*De:* contabiletica@hotmail.com
*Assunto:* DARF vencimento 28/03
*Recebido:* 23/03/2026 14:32

▶ [Abrir no Painel](http://localhost:5173/dashboard)
```

#### Mensagem de Status
```
ℹ️ *Omnimail — Status*

{message}

⏰ Última verificação: 23/03/2026 14:32
```

**IMPORTANTE:** Nunca inclua o corpo do e-mail na mensagem Telegram. Apenas remetente + assunto + data + link para o painel. Isso segue o princípio de dados mínimos em trânsito.

### 3. Comando /status no Bot
Registre um listener para o comando `/status`:
```typescript
this.bot.onText(/\/status/, async (msg) => {
  const chatId = msg.chat.id;
  // Busca contagem de emails por status no BD
  const stats = await this.getEmailStats();
  await this.bot.sendMessage(chatId, formatStatusMessage(stats), {
    parse_mode: 'Markdown'
  });
});
```

Resposta do /status:
```
📊 *Omnimail — Resumo*

📨 Total: 42 e-mails
🔴 Não lidos: 5
📖 Lidos: 30
✅ Respondidos: 7

⏰ Última sincronização: 23/03/2026 14:32
```

### 4. Registrar variáveis Telegram no Joi (AppModule)
Arquivo: `backend/src/app.module.ts`

Adicione as variáveis do Telegram como **opcionais** no validationSchema do ConfigModule:
```typescript
TELEGRAM_BOT_TOKEN: Joi.string().optional().default(''),
TELEGRAM_CHAT_ID: Joi.string().optional().default(''),
```

**IMPORTANTE:** Devem ser opcionais porque o sistema funciona sem Telegram configurado.

### 5. TelegramModule
```
backend/src/telegram/
├── telegram.module.ts
├── telegram.service.ts
├── telegram.templates.ts    # funções de formatação
└── telegram.service.spec.ts
```

Importa: `PrismaModule` (para stats do /status)

Registre o `TelegramModule` no `AppModule` (imports).

### 6. Testes Unitários
Arquivo: `backend/src/telegram/telegram.service.spec.ts`

Mocke o `node-telegram-bot-api`:
- [ ] `sendEmailAlert` envia mensagem formatada com parse_mode Markdown
- [ ] `sendEmailAlert` inclui remetente, assunto e data
- [ ] `sendEmailAlert` NÃO inclui corpo do email
- [ ] `sendStatusMessage` envia mensagem de texto
- [ ] `isConfigured()` retorna false quando token não está no env
- [ ] Sem token configurado, `sendEmailAlert` logga warning e não lança exceção
- [ ] Comando /status retorna estatísticas formatadas

### 7. Tela de Configurações no Frontend
Arquivo: `frontend/src/pages/SettingsPage.tsx`

Crie uma página `/settings` acessível pelo Header (ícone de engrenagem ou link "Configurações"). Protegida por `PrivateRoute` (mesma lógica do `/dashboard`).

#### Layout da Página
Seções com cards/formulários:

**Seção 1 — Telegram**
- Campo `Bot Token` (type=password, nunca exibir o valor completo, mostrar `***CONFIGURED***` se já configurado)
- Campo `Chat ID` (type=text)
- Botão **"Enviar Teste"** → chama `POST /settings/telegram/test`
  - Sucesso: toast/badge verde "Mensagem de teste enviada!"
  - Falha: toast/badge vermelho com mensagem de erro
- Botão **"Salvar"** → chama `PUT /settings/telegram_bot_token` e `PUT /settings/telegram_chat_id`

**Seção 2 — Monitoramento**
- Campo `Remetentes monitorados` (textarea, um por linha)
- Campo `Intervalo de sincronização` (select: 1h, 2h, 4h, 8h, 12h)
- Botão **"Salvar"**

**Seção 3 — Conexão IMAP**
- Campo `Host` (type=text)
- Campo `Porta` (type=number, default 993)
- Campo `Usuário/Email` (type=email)
- Campo `Senha` (type=password, mostrar `***CONFIGURED***` se já configurado)
- Checkbox `TLS` (default: checked)
- Botão **"Salvar"**

#### Regras de segurança na UI
- **NUNCA** exibir tokens/senhas completos. Campos de segredo mostram `***CONFIGURED***` quando já possuem valor
- Ao salvar um campo de segredo, só enviar se o usuário digitou algo novo (não reenviar `***CONFIGURED***`)
- Campos de segredo usam `type="password"` com toggle de visibilidade (ícone olho)
- Feedback visual para cada ação (loading spinner no botão, toast de sucesso/erro)

#### Service
Arquivo: `frontend/src/services/settingsApi.ts`
```typescript
export const settingsApi = {
  getAll: () => api.get('/settings').then(r => r.data),
  update: (key: string, value: string) => api.put(`/settings/${key}`, { value }).then(r => r.data),
  testTelegram: () => api.post('/settings/telegram/test').then(r => r.data),
};
```

#### Rota
Registre no `App.tsx` dentro do `PrivateRoute`:
```tsx
<Route path="/settings" element={<SettingsPage />} />
```

Adicione link no `Header.tsx` (ícone Settings do lucide-react).

#### Testes
- [ ] Página renderiza com seções Telegram, Monitoramento, IMAP
- [ ] Campo de token exibe `***CONFIGURED***` quando há valor
- [ ] Botão "Enviar Teste" chama endpoint correto
- [ ] Salvar envia PUT para cada campo alterado
- [ ] Campos vazios não são enviados ao salvar

## Critérios de Aceite
- [ ] Bot envia alerta formatado quando chamado
- [ ] Mensagem contém apenas dados mínimos (sem corpo do email)
- [ ] Comando /status funciona no Telegram
- [ ] `isConfigured()` permite verificar se o Telegram está ativo
- [ ] Serviço não quebra se token não estiver configurado
- [ ] Tela de configurações funciona e salva dados criptografados
- [ ] Campos sensíveis nunca exibem valor completo na UI
- [ ] Botão "Enviar Teste" do Telegram funciona
- [ ] Todos os testes passam

## Interface com Claude
Claude vai:
- Chamar `telegramService.sendEmailAlert()` dentro do `EmailProcessorService` quando novos e-mails são detectados
- Criar endpoint POST /settings/telegram para configurar token/chatId dinamicamente
- Armazenar token/chatId criptografados na tabela Setting

**Não modifique a interface `TelegramNotification` sem alinhar com o TechLead.**

## Branch
Trabalhe na branch: `gemini/sprint-05`
