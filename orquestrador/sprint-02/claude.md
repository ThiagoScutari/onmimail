# Sprint 2 — Claude: EmailProcessor + Criptografia + Cronjob

## Contexto
Sprint 2 do Omnimail (Scutari & Co). O backend NestJS, Prisma, CryptoService e JWT estão funcionais (Sprint 1). Agora vamos construir o worker que processa e-mails. Sua parte é orquestrar o fluxo: IMAP → Crypto → BD, e agendar o cronjob.

## Pré-requisito
- Sprint 1 completa
- Gemini vai entregar `ImapService` com a interface `ParsedEmail` (veja abaixo)

## Interface do ImapService (Gemini entrega)
```typescript
export interface ParsedEmail {
  messageId: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  date: Date;
  hasAttachments: boolean;
}

// Método disponível:
// imapService.fetchEmails(since: Date, senders: string[]): Promise<ParsedEmail[]>
// imapService.markAsRead(messageId: string): Promise<void>
```

## Sua Entrega

### 1. EmailProcessorService
Arquivo: `backend/src/email-processor/email-processor.service.ts`

Dependência: `npm install @nestjs/schedule` + `npm install -D @types/cron`

**Fluxo principal — `processNewEmails()`:**
1. Busca e-mails via `imapService.fetchEmails(since, senders)`
2. Para cada email retornado:
   a. Verifica se `messageId` já existe no BD (evita duplicatas)
   b. Criptografa campos sensíveis com `cryptoService.encrypt()`:
      - `from` → `from_enc` + `iv` + `tag`
      - `to` → `to_enc` (usa mesmo IV/tag? **NÃO** — cada campo deve ter IV/tag próprio)
   c. Salva no BD via `prisma.email.create()`
3. Retorna contagem de novos e-mails processados

**IMPORTANTE — Criptografia por campo:**
O schema Prisma atual tem um único `iv` e `tag` por Email. Isso é um problema porque cada campo precisa de IV único para segurança. Ajuste o schema:

```prisma
model Email {
  id            String      @id @default(uuid())
  messageId     String      @unique
  from_enc      Bytes
  from_iv       String
  from_tag      String
  to_enc        Bytes
  to_iv         String
  to_tag        String
  subject_enc   Bytes
  subject_iv    String
  subject_tag   String
  body_enc      Bytes
  body_iv       String
  body_tag      String
  date          DateTime
  status        EmailStatus @default(UNREAD)
  hasAttachments Boolean    @default(false)
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt
}
```

Gere uma nova migration: `npx prisma migrate dev --name add_per_field_crypto`

### 2. Cronjob
Arquivo: `backend/src/email-processor/email-processor.service.ts`

Use `@nestjs/schedule`:
```typescript
@Cron(CronExpression.EVERY_4_HOURS)
async handleCron() {
  const since = new Date();
  since.setDate(since.getDate() - 30); // últimos 30 dias na 1ª execução

  const senders = this.configService.get<string>('MONITORED_SENDERS').split(',');
  const count = await this.processNewEmails(since, senders);
  this.logger.log(`Processados ${count} novos e-mails`);
}
```

Registre `ScheduleModule.forRoot()` no `AppModule`.

### 3. Endpoint Manual de Trigger
Crie um endpoint para forçar a execução do worker (útil para debug):
```
POST /emails/sync
Headers: Authorization: Bearer <token>
Response: { processed: number, message: string }
```

Proteja com `@UseGuards(JwtAuthGuard)`.

### 4. EmailProcessorModule
```
backend/src/email-processor/
├── email-processor.module.ts
├── email-processor.service.ts
├── email-processor.controller.ts  # POST /emails/sync
└── email-processor.service.spec.ts
```

Importa: `ImapModule`, `CryptoModule`, `PrismaModule`

### 5. PrismaService (se não existir)
Crie um `PrismaService` que extends `PrismaClient` e implementa `OnModuleInit`:
```typescript
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();
  }
}
```

### 6. Testes de Integração
Arquivo: `backend/src/email-processor/email-processor.service.spec.ts`

Mocke `ImapService` e use banco real (ou in-memory):
- [ ] `processNewEmails` com 3 e-mails → cria 3 registros no BD
- [ ] E-mail duplicado (mesmo messageId) → não cria novo registro
- [ ] Campos salvos no BD estão criptografados (não legíveis como texto)
- [ ] Decrypt dos campos salvos retorna os valores originais
- [ ] Cronjob registrado e executável manualmente
- [ ] POST /emails/sync sem token → 401
- [ ] POST /emails/sync com token → executa e retorna contagem

## Critérios de Aceite
- [ ] `processNewEmails()` busca, criptografa e salva corretamente
- [ ] Duplicatas são ignoradas (baseado em messageId)
- [ ] Cada campo sensível tem IV/Tag próprio
- [ ] Cronjob roda a cada 4 horas
- [ ] POST /emails/sync funciona com autenticação
- [ ] Dados no BD são ilegíveis sem a chave APP_SECRET
- [ ] Todos os testes passam

## Ordem de Execução
1. Crie `PrismaService` + `PrismaModule`
2. Atualize o schema Prisma (IV/Tag por campo) + migration
3. Implemente `EmailProcessorService` com mock do ImapService
4. Adicione cronjob com `@nestjs/schedule`
5. Crie controller com POST /emails/sync
6. Escreva testes
7. Quando Gemini entregar o ImapService, integre e teste end-to-end

## Interface com Gemini
Você consome `ImapService.fetchEmails()`. Não modifique a interface `ParsedEmail`. Se precisar de campos adicionais, alinhe com o TechLead.

## Branch
Trabalhe na branch: `claude/sprint-02`
