# Sprint 3 — Gemini: Controller de E-mails, DTOs & Swagger

## Contexto
Sprint 3 do Omnimail (Scutari & Co). Backend funcional com IMAP worker salvando e-mails criptografados no BD (Sprints 1-2). Agora vamos expor a API REST. Sua parte: rotas, DTOs e documentação Swagger.

## Pré-requisito
- Sprints 1-2 completas (emails no BD, CryptoService, JWT Auth)

## ⚠️ REGRAS DE QUALIDADE OBRIGATÓRIAS

Estas regras são baseadas em problemas reais encontrados nas Sprints anteriores. **Siga rigorosamente.**

### ESLint Strict Mode
O projeto usa ESLint com regras TypeScript strict (`@typescript-eslint/strict`). Seu código DEVE passar no ESLint sem erros antes da entrega.

**Regras mais comuns que quebraram na Sprint 2:**
- `@typescript-eslint/no-unsafe-assignment` — Não use `any` implícito
- `@typescript-eslint/no-unsafe-member-access` — Não acesse propriedades de `any`
- `@typescript-eslint/no-unsafe-call` — Não chame funções `any`
- `@typescript-eslint/no-require-imports` — Use `import`, não `require()`
- `@typescript-eslint/no-misused-promises` — Não passe async callbacks onde void é esperado

**Como validar antes de entregar:**
```bash
cd backend
npx eslint src/emails/ --ext .ts
```

Se PRECISAR desabilitar uma regra em arquivos de teste (`.spec.ts`), use um eslint-disable no topo do arquivo com as regras específicas. **Nunca desabilite regras em código de produção sem justificativa.**

### Gitleaks
O pre-commit hook roda Gitleaks. **Não coloque chaves, tokens ou segredos** no código, nem mesmo de teste. Use variáveis de ambiente ou mocks.

### Prettier
O lint-staged roda Prettier automaticamente. Não se preocupe com formatação, mas se quiser validar: `npx prettier --check "src/emails/**/*.ts"`

## Estado Atual do Código (referência)

### Módulos existentes que você pode importar:
- `PrismaModule` / `PrismaService` — `../prisma/prisma.module` / `../prisma/prisma.service`
- `CryptoModule` / `CryptoService` — `../crypto/crypto.module` / `../crypto/crypto.service`
- `JwtAuthGuard` — `../auth/jwt-auth.guard` (já existe da Sprint 1)
- `DecryptInterceptor` — `../crypto/decrypt.interceptor` (Claude vai criar nesta Sprint)

### Schema Prisma atual (campos do model Email):
```prisma
model Email {
  id             String      @id @default(uuid())
  messageId      String      @unique
  from_enc       Bytes
  from_iv        String
  from_tag       String
  to_enc         Bytes
  to_iv          String
  to_tag         String
  subject_enc    Bytes
  subject_iv     String
  subject_tag    String
  body_enc       Bytes
  body_iv        String
  body_tag       String
  date           DateTime
  status         EmailStatus @default(UNREAD)
  hasAttachments Boolean     @default(false)
  createdAt      DateTime    @default(now())
  updatedAt      DateTime    @updatedAt
}

enum EmailStatus {
  UNREAD
  READ
  RESPONDED
}
```

**IMPORTANTE:** Os campos `*_enc` são do tipo `Bytes` (Buffer). O `EmailsService` retorna esses dados brutos. O `DecryptInterceptor` do Claude transforma `from_enc`+`from_iv`+`from_tag` em `from: string` antes do response. **Não faça decrypt no service.**

## Sua Entrega

### 1. EmailsController
Arquivo: `backend/src/emails/emails.controller.ts`

**Rotas:**

#### GET /emails
Lista e-mails com paginação e filtros.
```
Query params:
  - page: number (default: 1)
  - limit: number (default: 20, max: 100)
  - status: EmailStatus (opcional — UNREAD, READ, RESPONDED)
  - dateFrom: ISO string (opcional)
  - dateTo: ISO string (opcional)

Response 200:
{
  data: EmailResponseDto[],
  meta: {
    total: number,
    page: number,
    limit: number,
    totalPages: number
  }
}
```

#### GET /emails/:id
Retorna um e-mail específico com corpo completo.
```
Response 200: EmailDetailDto
Response 404: { message: "Email not found" }
```

#### PATCH /emails/:id/status
Atualiza o status de um e-mail.
```
Body: { status: "READ" | "RESPONDED" }
Response 200: { id: string, status: string, updatedAt: string }
Response 404: { message: "Email not found" }
```

**Decorators obrigatórios em TODAS as rotas:**
- `@UseGuards(JwtAuthGuard)` — importar de `../auth/jwt-auth.guard`
- `@UseInterceptors(DecryptInterceptor)` — importar de `../crypto/decrypt.interceptor` (nas rotas GET que retornam dados de e-mail)

### 2. DTOs
Arquivo: `backend/src/emails/dto/`

#### EmailResponseDto (para listagem)
```typescript
export class EmailResponseDto {
  id: string;
  from: string;         // descriptografado pelo interceptor
  subject: string;      // descriptografado pelo interceptor
  date: string;         // ISO format
  status: EmailStatus;
  hasAttachments: boolean;
  createdAt: string;
}
```

#### EmailDetailDto (para detalhe)
```typescript
export class EmailDetailDto extends EmailResponseDto {
  to: string;           // descriptografado
  body: string;         // descriptografado
}
```

#### UpdateStatusDto
```typescript
export class UpdateStatusDto {
  @IsEnum(EmailStatus)
  @IsNotEmpty()
  status: EmailStatus;
}
```

#### PaginationQueryDto
```typescript
export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsEnum(EmailStatus)
  status?: EmailStatus;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;
}
```

### 3. EmailsService
Arquivo: `backend/src/emails/emails.service.ts`

Métodos:
- `findAll(query: PaginationQueryDto)` — busca paginada com filtros via Prisma
- `findOne(id: string)` — busca por ID
- `updateStatus(id: string, status: EmailStatus)` — atualiza status

**NOTA:** Os dados retornados do Prisma estarão criptografados (Bytes). O `DecryptInterceptor` do Claude vai descriptografar antes de enviar ao client. O service retorna os dados brutos do Prisma.

### 4. Swagger/OpenAPI
Instale: `npm install @nestjs/swagger`

Configure no `main.ts`:
```typescript
const config = new DocumentBuilder()
  .setTitle('Omnimail API')
  .setDescription('API do Monitor de E-mails Contábeis — Scutari & Co')
  .setVersion('1.0')
  .addBearerAuth()
  .build();

const document = SwaggerModule.createDocument(app, config);
SwaggerModule.setup('api/docs', app, document);
```

Adicione decorators em todos os DTOs e controllers:
- `@ApiTags('emails')`
- `@ApiBearerAuth()`
- `@ApiOperation()`, `@ApiResponse()`, `@ApiQuery()`

### 5. EmailsModule
```
backend/src/emails/
├── emails.module.ts
├── emails.controller.ts
├── emails.service.ts
├── emails.controller.spec.ts
└── dto/
    ├── email-response.dto.ts
    ├── email-detail.dto.ts
    ├── update-status.dto.ts
    └── pagination-query.dto.ts
```

Importa: `PrismaModule`
Registre o `EmailsModule` no `AppModule` (imports array).

### 6. Testes
Arquivo: `backend/src/emails/emails.controller.spec.ts`

- [ ] GET /emails retorna lista paginada
- [ ] GET /emails?status=UNREAD filtra corretamente
- [ ] GET /emails/:id com ID válido retorna email
- [ ] GET /emails/:id com ID inválido retorna 404
- [ ] PATCH /emails/:id/status atualiza status
- [ ] PATCH com status inválido retorna 400 (class-validator)

## Critérios de Aceite
- [ ] GET /emails retorna lista paginada com meta
- [ ] GET /emails/:id retorna email completo
- [ ] PATCH /emails/:id/status atualiza status
- [ ] Swagger acessível em /api/docs
- [ ] Todos os DTOs têm validação com class-validator
- [ ] **ESLint passa sem erros** em `src/emails/`
- [ ] Testes passam

## Interface com Claude
Claude implementa nesta Sprint:
- `DecryptInterceptor` em `../crypto/decrypt.interceptor.ts` — transforma `*_enc` fields em strings legíveis
- Rate Limiting (`@nestjs/throttler`)
- Helmet + CORS

Você aplica nos seus controllers:
- `@UseGuards(JwtAuthGuard)` — import de `../auth/jwt-auth.guard`
- `@UseInterceptors(DecryptInterceptor)` — import de `../crypto/decrypt.interceptor` (nas rotas GET)

**Não altere arquivos fora da pasta `src/emails/` e `main.ts` (Swagger).**

## Branch
Trabalhe na branch: `gemini/sprint-03`
