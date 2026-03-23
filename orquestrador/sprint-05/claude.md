# Sprint 5 — Claude: Trigger de Notificação + Configuração

## Contexto
Sprint 5 do Omnimail (Scutari & Co). Backend e frontend funcionais. Agora vamos integrar alertas Telegram. Sua parte: acionar o TelegramService quando novos e-mails chegam e criar endpoints de configuração.

## Pré-requisito
- Sprints 1-4 completas
- Gemini vai entregar `TelegramService` com interface `TelegramServiceInterface`

## Interface do TelegramService (Gemini entrega)
```typescript
export interface TelegramNotification {
  from: string;
  subject: string;
  date: string;
  emailId: string;
}

// Métodos disponíveis:
// telegramService.sendEmailAlert(notification: TelegramNotification): Promise<void>
// telegramService.sendStatusMessage(message: string): Promise<void>
// telegramService.isConfigured(): boolean
```

## Sua Entrega

### 1. Integrar TelegramModule no EmailProcessorModule
Arquivo: `backend/src/email-processor/email-processor.module.ts`

O module atual só importa `ImapModule`. Adicione `TelegramModule` nos imports:
```typescript
imports: [ImapModule, TelegramModule],
```

Arquivo: `backend/src/email-processor/email-processor.service.ts`

Injete `TelegramService` no construtor:
```typescript
constructor(
  private readonly imapService: ImapService,
  private readonly cryptoService: CryptoService,
  private readonly prisma: PrismaService,
  private readonly configService: ConfigService,
  private readonly telegramService: TelegramService,  // NOVO
) {}
```

### 2. Integrar Notificação no EmailProcessor
Arquivo: `backend/src/email-processor/email-processor.service.ts`

Modifique `processNewEmails()` para notificar após salvar:
```typescript
async processNewEmails(since: Date, senders: string[]): Promise<number> {
  const emails = await this.imapService.fetchEmails(since, senders);
  let count = 0;

  for (const email of emails) {
    const exists = await this.prisma.email.findUnique({
      where: { messageId: email.messageId }
    });
    if (exists) continue;

    // ... criptografa e salva (já existente) ...
    const saved = await this.prisma.email.create({ data: encryptedData });
    count++;

    // NOVO: Dispara notificação Telegram
    if (this.telegramService.isConfigured()) {
      await this.telegramService.sendEmailAlert({
        from: email.from,
        subject: email.subject,
        date: email.date.toISOString(),
        emailId: saved.id,
      });
    }
  }

  return count;
}
```

**IMPORTANTE:** A notificação usa os dados em texto puro (antes da criptografia), pois já estão em memória. Nunca descriptografe do BD só para notificar.

### 3. SettingsController
Arquivo: `backend/src/settings/settings.controller.ts`

Rotas protegidas com JWT:

#### GET /settings
Retorna configurações descriptografadas:
```json
{
  "telegram_bot_token": "***CONFIGURED***",
  "telegram_chat_id": "123456789",
  "monitored_senders": "contabiletica@hotmail.com",
  "sync_interval_hours": "4",
  "imap_host": "outlook.office365.com",
  "imap_port": "993",
  "imap_user": "***CONFIGURED***",
  "imap_password": "***CONFIGURED***",
  "imap_tls": "true"
}
```
**Nota:** Tokens/segredos retornam mascarados (`***CONFIGURED***` ou últimos 4 chars).

**Chaves sensíveis que devem ser mascaradas:**
- `telegram_bot_token`
- `imap_user`
- `imap_password`

As demais retornam o valor real descriptografado.

#### PUT /settings/:key
Atualiza uma configuração:
```json
// Body:
{ "value": "novo_valor" }

// Response:
{ "key": "telegram_chat_id", "updated": true }
```

O valor é criptografado antes de salvar na tabela `Setting` via CryptoService.

#### POST /settings/telegram/test
Envia uma mensagem de teste para validar a configuração:
```json
// Response 200:
{ "success": true, "message": "Mensagem de teste enviada com sucesso" }

// Response 400:
{ "success": false, "message": "Telegram não configurado" }
```

### 4. SettingsService
Arquivo: `backend/src/settings/settings.service.ts`

Métodos:
- `getAll()`: busca todas as settings, descriptografa, mascara tokens
- `get(key: string)`: busca uma setting, descriptografa
- `set(key: string, value: string)`: criptografa e salva (upsert)
- `testTelegram()`: chama `telegramService.sendStatusMessage("Teste de configuração")"`

### 5. SettingsModule
```
backend/src/settings/
├── settings.module.ts
├── settings.controller.ts
├── settings.service.ts
└── dto/
    └── update-setting.dto.ts
```

Importa: `CryptoModule`, `TelegramModule`, `PrismaModule`

### 6. Seed de Configurações Iniciais
Arquivo: `backend/prisma/seed.ts`

Crie um seed que popula as settings iniciais a partir do `.env`:
```typescript
// Lê TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, MONITORED_SENDERS do .env
// Criptografa e salva na tabela Setting
// Útil para primeira execução
```

Configure no `package.json`:
```json
"prisma": {
  "seed": "ts-node prisma/seed.ts"
}
```

### 7. Registrar SettingsModule no AppModule
Arquivo: `backend/src/app.module.ts`

Adicione `SettingsModule` nos imports do AppModule.

### 8. Testes
Arquivo: `backend/src/settings/settings.service.spec.ts`
- [ ] `set()` criptografa o valor antes de salvar
- [ ] `get()` descriptografa o valor ao retornar
- [ ] `getAll()` mascara tokens (não retorna valor completo)
- [ ] `testTelegram()` chama TelegramService corretamente

Arquivo: `backend/test/notification.e2e-spec.ts`
- [ ] Novo email processado → telegramService.sendEmailAlert chamado
- [ ] Telegram não configurado → nenhuma exceção, apenas log
- [ ] POST /settings/telegram/test → envia mensagem de teste
- [ ] PUT /settings/:key sem token → 401
- [ ] PUT /settings/:key com token → atualiza configuração

## Critérios de Aceite
- [ ] Novos e-mails disparam notificação Telegram automaticamente
- [ ] Telegram desconfigurado não quebra o fluxo
- [ ] GET /settings retorna configs com tokens mascarados
- [ ] PUT /settings/:key salva valor criptografado
- [ ] POST /settings/telegram/test funciona
- [ ] Seed popula configurações iniciais
- [ ] Todos os testes passam

## Ordem de Execução
1. Crie SettingsModule (service + controller)
2. Integre notificação no EmailProcessorService
3. Crie seed de configurações
4. Escreva testes unitários
5. Escreva testes E2E
6. Quando Gemini entregar TelegramService, integre e teste end-to-end

## Branch
Trabalhe na branch: `claude/sprint-05`
