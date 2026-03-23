# Sprint 1 — Fundação & Security Zero Trust
## Release Notes — Claude (Core Backend)

**Projeto:** Omnimail — Monitor de E-mails Contábeis
**Responsável:** Claude
**Data:** 2026-03-23
**Branch:** `claude/sprint-01`
**Status:** Concluída

---

## 1. Resumo Executivo

Entrega completa do core backend NestJS com fundação de segurança Zero Trust. O sistema está preparado com criptografia AES-256-GCM para dados sensíveis em repouso, autenticação JWT com refresh tokens e schema de banco de dados pronto para migration.

---

## 2. Entregas Realizadas

### 2.1 Projeto NestJS Inicializado
- Projeto criado com `--strict` (TypeScript strict mode habilitado)
- Package manager: npm
- NestJS v11 + TypeScript

### 2.2 ConfigModule com Validação Joi
- Variáveis de ambiente validadas na inicialização:
  - `DATABASE_URL` — conexão PostgreSQL (obrigatória)
  - `JWT_SECRET` — chave de assinatura JWT (obrigatória)
  - `APP_SECRET` — chave mestra AES-256, 64 caracteres hex / 32 bytes (obrigatória)
- Aplicação falha imediatamente se alguma variável estiver ausente ou inválida

### 2.3 CryptoService (AES-256-GCM)
- **Encrypt:** gera IV aleatório de 12 bytes, retorna `{ encrypted: Buffer, iv: string, tag: string }`
- **Decrypt:** recebe dados criptografados + IV + Auth Tag, retorna plaintext
- Chave mestra carregada exclusivamente de `process.env.APP_SECRET`
- Módulo global (`@Global()`) — disponível em toda a aplicação sem re-import
- Zero hardcoded — nenhum segredo em código-fonte

### 2.4 Prisma Schema (PostgreSQL)
| Model | Campos Principais | Observação |
|-------|-------------------|------------|
| **Email** | `messageId` (unique), `from_enc`, `to_enc`, `subject_enc`, `body_enc` (Bytes), `date`, `status`, `iv`, `tag` | Campos sensíveis armazenados como Bytes criptografados |
| **User** | `email` (unique), `passwordHash` | Hash bcrypt, nunca plaintext |
| **Setting** | `key` (unique), `value_enc` (Bytes), `iv`, `tag` | Configurações criptografadas |
| **EmailStatus** | `UNREAD`, `READ`, `RESPONDED` | Enum para controle de status |

- Prisma v7 configurado com `prisma.config.ts` para URL do datasource
- Prisma Client gerado com sucesso

### 2.5 PrismaService (NestJS Wrapper)
- Extends `PrismaClient` com lifecycle hooks (`onModuleInit`, `onModuleDestroy`)
- Módulo global para injeção em qualquer service

### 2.6 Módulo de Autenticação JWT
| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/auth/login` | POST | Recebe `{ email, password }`, valida contra BD (bcrypt), retorna `{ accessToken, refreshToken }` |
| `/auth/refresh` | POST | Recebe `{ refreshToken }`, valida assinatura, retorna novos tokens |

- **Access Token:** expira em 15 minutos
- **Refresh Token:** expira em 7 dias
- **JwtStrategy:** extrai Bearer token do header Authorization
- **JwtAuthGuard:** decorator `@UseGuards(JwtAuthGuard)` para proteger qualquer rota
- **DTOs** com `class-validator`: validação de email e senha mínima de 6 caracteres

---

## 3. Testes Unitários

### CryptoService — 6 testes
| # | Teste | Status |
|---|-------|--------|
| 1 | Encrypt retorna Buffer não-vazio + IV + Tag | PASS |
| 2 | Decrypt com mesmos IV/Tag retorna plaintext original | PASS |
| 3 | Decrypt com IV errado lança exceção | PASS |
| 4 | Decrypt com Tag errado lança exceção | PASS |
| 5 | Encrypt de strings vazias funciona corretamente | PASS |
| 6 | Dois encrypts do mesmo texto geram resultados diferentes (IV aleatório) | PASS |

### AuthService — 3 testes
| # | Teste | Status |
|---|-------|--------|
| 1 | Login com credenciais válidas retorna tokens JWT | PASS |
| 2 | Login com senha errada lança UnauthorizedException | PASS |
| 3 | Login com email inexistente lança UnauthorizedException | PASS |

### AppController — 1 teste (default NestJS)
| # | Teste | Status |
|---|-------|--------|
| 1 | Root endpoint retorna "Hello World!" | PASS |

**Total: 10/10 testes passando**
**Compilação TypeScript: 0 erros**

---

## 4. Estrutura de Arquivos

```
backend/
├── .env.example                    # Template de variáveis de ambiente
├── .gitignore                      # .env + node_modules + generated
├── prisma.config.ts                # Configuração Prisma v7
├── prisma/
│   └── schema.prisma               # Email, User, Setting, EmailStatus
├── src/
│   ├── app.module.ts               # Root module (Config + Joi + imports)
│   ├── app.controller.ts           # Health check endpoint
│   ├── app.service.ts
│   ├── main.ts                     # Bootstrap
│   ├── crypto/
│   │   ├── crypto.module.ts        # @Global module
│   │   ├── crypto.service.ts       # AES-256-GCM encrypt/decrypt
│   │   └── crypto.service.spec.ts  # 6 testes
│   ├── prisma/
│   │   ├── prisma.module.ts        # @Global module
│   │   └── prisma.service.ts       # PrismaClient lifecycle
│   └── auth/
│       ├── auth.module.ts          # Passport + JWT register
│       ├── auth.controller.ts      # /auth/login, /auth/refresh
│       ├── auth.service.ts         # Validação, geração de tokens
│       ├── auth.service.spec.ts    # 3 testes
│       ├── jwt.strategy.ts         # Bearer token extraction
│       ├── jwt-auth.guard.ts       # Route protection guard
│       └── dto/
│           ├── login.dto.ts        # @IsEmail, @MinLength(6)
│           ├── refresh.dto.ts      # @IsString refreshToken
│           └── token-response.dto.ts
└── test/
    └── app.e2e-spec.ts             # E2E scaffold
```

---

## 5. Dependências Instaladas

### Produção
| Pacote | Versão | Finalidade |
|--------|--------|------------|
| `@nestjs/config` | ^4.0.3 | Variáveis de ambiente + validação |
| `@nestjs/jwt` | ^11.0.2 | Geração e verificação de tokens JWT |
| `@nestjs/passport` | ^11.0.5 | Integração Passport com NestJS |
| `passport-jwt` | ^4.0.1 | Strategy JWT para Passport |
| `@prisma/client` | ^7.5.0 | ORM PostgreSQL |
| `bcrypt` | ^6.0.0 | Hash seguro de senhas |
| `class-validator` | ^0.15.1 | Validação de DTOs |
| `class-transformer` | ^0.5.1 | Transformação de objetos |
| `joi` | ^18.1.1 | Validação de variáveis de ambiente |
| `dotenv` | — | Carregamento de .env |

### Desenvolvimento
| Pacote | Versão | Finalidade |
|--------|--------|------------|
| `prisma` | ^7.5.0 | CLI do Prisma (migrations, generate) |
| `@types/passport-jwt` | ^4.0.1 | Tipagens TypeScript |
| `@types/bcrypt` | ^6.0.0 | Tipagens TypeScript |

---

## 6. Critérios de Aceite

| Critério | Status |
|----------|--------|
| CryptoService encrypt→decrypt é idempotente | PASS |
| CryptoService com chave/IV/tag errada falha com exceção clara | PASS |
| POST /auth/login retorna accessToken + refreshToken | PASS |
| Rota protegida com @UseGuards(JwtAuthGuard) retorna 401 sem token | PRONTO (guard implementado) |
| Todos os testes unitários passam (10/10) | PASS |
| Compilação TypeScript sem erros | PASS |
| `npx prisma migrate dev` roda sem erros | PENDENTE — aguarda PostgreSQL do Gemini |

---

## 7. Dependência Externa

| Item | Responsável | Status |
|------|-------------|--------|
| Docker Compose com PostgreSQL | Gemini | Aguardando |
| `DATABASE_URL` = `postgresql://omnimail:${DB_PASSWORD}@localhost:5432/omnimail_dev` | Gemini | Aguardando |

Assim que o Docker Compose estiver disponível, executar:
```bash
cd backend
cp .env.example .env  # preencher valores reais
npx prisma migrate dev --name init
```

---

*Relatório gerado em 2026-03-23 — Sprint 1 Foundation & Security Zero Trust*
