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

### 4. TelegramModule
```
backend/src/telegram/
├── telegram.module.ts
├── telegram.service.ts
├── telegram.templates.ts    # funções de formatação
└── telegram.service.spec.ts
```

Importa: `PrismaModule` (para stats do /status)

### 5. Testes Unitários
Arquivo: `backend/src/telegram/telegram.service.spec.ts`

Mocke o `node-telegram-bot-api`:
- [ ] `sendEmailAlert` envia mensagem formatada com parse_mode Markdown
- [ ] `sendEmailAlert` inclui remetente, assunto e data
- [ ] `sendEmailAlert` NÃO inclui corpo do email
- [ ] `sendStatusMessage` envia mensagem de texto
- [ ] `isConfigured()` retorna false quando token não está no env
- [ ] Sem token configurado, `sendEmailAlert` logga warning e não lança exceção
- [ ] Comando /status retorna estatísticas formatadas

## Critérios de Aceite
- [ ] Bot envia alerta formatado quando chamado
- [ ] Mensagem contém apenas dados mínimos (sem corpo do email)
- [ ] Comando /status funciona no Telegram
- [ ] `isConfigured()` permite verificar se o Telegram está ativo
- [ ] Serviço não quebra se token não estiver configurado
- [ ] Todos os testes passam

## Interface com Claude
Claude vai:
- Chamar `telegramService.sendEmailAlert()` dentro do `EmailProcessorService` quando novos e-mails são detectados
- Criar endpoint POST /settings/telegram para configurar token/chatId dinamicamente
- Armazenar token/chatId criptografados na tabela Setting

**Não modifique a interface `TelegramNotification` sem alinhar com o TechLead.**

## Branch
Trabalhe na branch: `gemini/sprint-05`
