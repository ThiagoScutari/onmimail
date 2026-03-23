# Sprint 3 — Gemini: Controller de E-mails, DTOs & Swagger

## Contexto
Sprint 3 do Omnimail (Scutari & Co). Backend funcional com IMAP worker salvando e-mails criptografados no BD (Sprints 1-2). Agora vamos expor a API REST. Sua parte: rotas, DTOs e documentação Swagger.

## Pré-requisito
- Sprints 1-2 completas (emails no BD, CryptoService, JWT Auth)

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

**IMPORTANTE:** Todas as rotas devem ter `@UseGuards(JwtAuthGuard)` — Claude vai implementar o guard. Você aplica o decorator.

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

**NOTA:** Os dados retornados do Prisma estarão criptografados (Bytes). O `DecryptInterceptor` do Claude vai descriptografar antes de enviar ao client. O service retorna os dados brutos.

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
└── dto/
    ├── email-response.dto.ts
    ├── email-detail.dto.ts
    ├── update-status.dto.ts
    └── pagination-query.dto.ts
```

Importa: `PrismaModule`

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
- [ ] Testes passam

## Interface com Claude
Claude implementa:
- `JwtAuthGuard` que você aplica com `@UseGuards(JwtAuthGuard)`
- `DecryptInterceptor` que descriptografa os campos `*_enc` antes do response

Os dados do Prisma vêm com campos `from_enc` (Bytes), `from_iv`, `from_tag`, etc. O interceptor transforma em `from` (string). **Não faça decrypt no service — deixe para o interceptor.**

## Branch
Trabalhe na branch: `gemini/sprint-03`
