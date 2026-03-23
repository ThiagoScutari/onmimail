# Sprint 1 — Claude: Core Backend (NestJS + Prisma + Crypto + JWT)

## Contexto
Você é o programador Claude no projeto Omnimail (Scutari & Co). Este projeto monitora e-mails contábeis para evitar perda de prazos fiscais. Sua responsabilidade na Sprint 1 é criar o core do backend: NestJS, Prisma schema, CryptoService e módulo de autenticação JWT.

**Stack:** NestJS + TypeScript + Prisma + PostgreSQL + AES-256-GCM + JWT

## Pré-requisito
O Gemini vai entregar o Docker Compose com PostgreSQL. Você pode iniciar o NestJS em paralelo, mas para rodar migrations precisa do banco ativo.

## Sua Entrega

### 1. Projeto NestJS
Inicialize dentro de `backend/`:
```bash
nest new backend --package-manager npm --strict
```

Instale as dependências:
```bash
npm install @nestjs/config @nestjs/jwt @nestjs/passport passport passport-jwt
npm install @prisma/client class-validator class-transformer
npm install -D prisma @types/passport-jwt
```

### 2. Prisma Schema
Arquivo: `backend/prisma/schema.prisma`

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Email {
  id            String   @id @default(uuid())
  messageId     String   @unique // ID único do IMAP
  from_enc      Bytes    // remetente criptografado
  to_enc        Bytes    // destinatário criptografado
  subject_enc   Bytes    // assunto criptografado
  body_enc      Bytes    // corpo/resumo criptografado
  date          DateTime // data do email (não sensível)
  status        EmailStatus @default(UNREAD)
  iv            String   // Initialization Vector para AES-GCM
  tag           String   // Authentication Tag do AES-GCM
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

enum EmailStatus {
  UNREAD
  READ
  RESPONDED
}

model User {
  id           String   @id @default(uuid())
  email        String   @unique
  passwordHash String
  createdAt    DateTime @default(now())
}

model Setting {
  id    String @id @default(uuid())
  key   String @unique
  value_enc Bytes  // valor criptografado
  iv    String
  tag   String
}
```

### 3. CryptoService
Arquivo: `backend/src/crypto/crypto.service.ts`

Responsabilidades:
- **encrypt(plaintext: string): { encrypted: Buffer, iv: string, tag: string }**
  - Gera IV aleatório de 12 bytes
  - Usa `crypto.createCipheriv('aes-256-gcm', key, iv)`
  - Retorna dados criptografados + IV + Auth Tag
- **decrypt(encrypted: Buffer, iv: string, tag: string): string**
  - Usa `crypto.createDecipheriv('aes-256-gcm', key, iv)`
  - Define o Auth Tag
  - Retorna plaintext
- A chave mestra vem de `process.env.APP_SECRET` (32 bytes hex → Buffer)
- **NÃO** armazene a chave em nenhum lugar além da variável de ambiente

Crie o módulo: `CryptoModule` (global, exporta `CryptoService`).

### 4. Módulo de Autenticação JWT
Estrutura:
```
backend/src/auth/
├── auth.module.ts
├── auth.controller.ts    # POST /auth/login, POST /auth/refresh
├── auth.service.ts       # validateUser, login, refreshToken
├── jwt.strategy.ts       # PassportStrategy(Strategy)
├── jwt-auth.guard.ts     # AuthGuard('jwt')
└── dto/
    ├── login.dto.ts      # email, password (class-validator)
    └── token-response.dto.ts
```

Comportamento:
- **POST /auth/login**: recebe email + password, valida contra User no BD (bcrypt), retorna `{ accessToken, refreshToken }`
- **POST /auth/refresh**: recebe refreshToken, valida, retorna novo accessToken
- **JwtStrategy**: extrai Bearer token do header, valida assinatura e expiração
- **JwtAuthGuard**: decorator `@UseGuards(JwtAuthGuard)` protege rotas

Configuração JWT via `@nestjs/config`:
- `JWT_SECRET` do `.env`
- Access Token: 15 minutos
- Refresh Token: 7 dias

### 5. Testes Unitários
Arquivo: `backend/src/crypto/crypto.service.spec.ts`

Testes obrigatórios:
- [ ] Encrypt retorna Buffer não-vazio + IV + Tag
- [ ] Decrypt com os mesmos IV/Tag retorna o plaintext original
- [ ] Decrypt com IV errado lança exceção
- [ ] Decrypt com Tag errado lança exceção
- [ ] Encrypt de strings vazias funciona corretamente
- [ ] Dois encrypts do mesmo texto geram resultados diferentes (IV aleatório)

Arquivo: `backend/src/auth/auth.service.spec.ts`
- [ ] Login com credenciais válidas retorna tokens
- [ ] Login com senha errada lança UnauthorizedException
- [ ] Login com email inexistente lança UnauthorizedException

### 6. ConfigModule
Configure `@nestjs/config` no `AppModule` com validação de variáveis obrigatórias:
```typescript
ConfigModule.forRoot({
  isGlobal: true,
  validationSchema: Joi.object({
    DATABASE_URL: Joi.string().required(),
    JWT_SECRET: Joi.string().required(),
    APP_SECRET: Joi.string().hex().length(64).required(), // 32 bytes em hex
  }),
})
```

Instale `joi` para validação.

## Critérios de Aceite
- [ ] `npx prisma migrate dev` roda sem erros (com PostgreSQL do Docker Compose)
- [ ] CryptoService encrypt→decrypt é idempotente
- [ ] CryptoService com chave/IV/tag errada falha com exceção clara
- [ ] POST /auth/login retorna accessToken + refreshToken
- [ ] Rota protegida com @UseGuards(JwtAuthGuard) retorna 401 sem token
- [ ] Todos os testes unitários passam

## Ordem de Execução
1. `nest new backend`
2. Instale dependências
3. Configure `ConfigModule` com Joi
4. Implemente `CryptoService` + testes
5. Configure Prisma schema + primeira migration
6. Implemente módulo Auth (service → strategy → guard → controller)
7. Testes do Auth
8. Valide tudo rodando

## Interface com Gemini
Gemini entrega Docker Compose com PostgreSQL. Sua `DATABASE_URL` apontará para `postgresql://omnimail:${DB_PASSWORD}@localhost:5432/omnimail_dev`.

## Branch
Trabalhe na branch: `claude/sprint-01`
