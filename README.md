# Omnimail — Monitor de E-mails Contábeis

Sistema de automação para leitura, alerta e controle de status de e-mails contábeis da empresa DRX Têxtil (Scutari & Co). Garante que prazos de pagamento de guias e obrigações fiscais/tributárias não sejam perdidos, evitando juros e multas.

## Stack

| Camada | Tecnologia |
|--------|------------|
| Backend | NestJS (Node.js + TypeScript strict) |
| Frontend | React + Vite + TailwindCSS v4 |
| Banco de Dados | PostgreSQL 16 |
| ORM | Prisma v7 |
| Autenticação | JWT (access + refresh tokens) |
| Criptografia | AES-256-GCM (dados em repouso) |
| Mensageria | Telegram Bot API |
| Infra | Docker (multi-stage builds) + nginx |
| CI/CD | GitHub Actions |

## Funcionalidades

- **Worker IMAP** — Cronjob que acessa a caixa de entrada a cada 4h, filtra remetentes configurados e salva e-mails criptografados
- **Painel Web** — SPA React com lista de e-mails urgentes, preview em drawer lateral, controle de status (Não Lido / Lido / Respondido)
- **Alertas Telegram** — Notificação automática de novos e-mails com dados mínimos (sem corpo), link para o painel
- **Segurança Zero Trust** — Campos sensíveis criptografados com AES-256-GCM no banco, descriptografados apenas em memória
- **Tela de Configurações** — Gerenciar credenciais IMAP, Telegram e remetentes monitorados via interface web

## Estrutura do Projeto

```
omnimail/
├── backend/                    # NestJS API
│   ├── src/
│   │   ├── auth/               # JWT login, refresh, guard, strategy
│   │   ├── crypto/             # AES-256-GCM encrypt/decrypt + DecryptInterceptor
│   │   ├── email-processor/    # IMAP -> Crypto -> BD + Cronjob 4h
│   │   ├── emails/             # CRUD API (GET, PATCH status) + Swagger
│   │   ├── health/             # GET /health
│   │   ├── imap/               # ImapService (fetch, parse, retry, markAsRead)
│   │   ├── prisma/             # PrismaService (global lifecycle)
│   │   ├── settings/           # GET/PUT settings + POST telegram/test
│   │   └── telegram/           # TelegramService + /status command
│   ├── prisma/
│   │   ├── schema.prisma       # Email, User, Setting (campos criptografados)
│   │   └── seed.ts             # Seed de configurações iniciais
│   ├── test/                   # E2E tests (flow, security, emails, notification)
│   └── Dockerfile              # Multi-stage build
├── frontend/                   # React SPA
│   ├── src/
│   │   ├── components/         # EmailList, EmailRow, EmailPreview, Header, Layout, etc
│   │   ├── contexts/           # AuthContext (JWT decode, auto-refresh)
│   │   ├── hooks/              # useEmails, useEmailDetail (React Query)
│   │   ├── pages/              # DashboardPage, LoginPage, SettingsPage, NotFoundPage
│   │   ├── services/           # api.ts (interceptors), emailApi.ts, settingsApi.ts
│   │   └── __tests__/          # Component tests (Vitest + Testing Library)
│   ├── nginx.conf              # SPA routing + API proxy
│   └── Dockerfile              # Multi-stage build
├── docker/
│   ├── docker-compose.dev.yml  # PostgreSQL 16 + pgAdmin (desenvolvimento)
│   ├── docker-compose.prod.yml # Stack completa (backend + frontend + postgres)
│   └── docker-compose.test.yml # PostgreSQL para E2E tests (porta 5433)
├── .github/workflows/ci.yml   # CI: lint -> security -> test -> build
├── scripts/                    # run-tests.sh / run-tests.ps1
├── docs/                       # Documentação do projeto
└── orquestrador/               # Instruções por sprint (Gemini + Claude)
```

## Setup Rápido (Desenvolvimento)

### Pré-requisitos
- Node.js 20+
- Docker e Docker Compose
- Git

### 1. Clone e instale dependências

```bash
git clone https://github.com/ThiagoScutari/onmimail.git
cd onmimail

# Backend
cd backend
cp .env.example .env
npm install

# Frontend
cd ../frontend
npm install
```

### 2. Configure o `.env` do backend

Edite `backend/.env` e preencha:

```bash
# Gerar JWT_SECRET e APP_SECRET:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Exemplo:
DATABASE_URL=postgresql://omnimail:minha_senha@localhost:5432/omnimail_dev
JWT_SECRET=<cole_a_chave_gerada>
APP_SECRET=<cole_outra_chave_gerada_64_hex>
MONITORED_SENDERS=contabiletica@hotmail.com
FRONTEND_URL=http://localhost:5173
```

### 3. Suba o PostgreSQL

```bash
# Na raiz do projeto, crie .env com DB_PASSWORD
echo "DB_PASSWORD=minha_senha" > .env
echo "PGADMIN_EMAIL=admin@scutari.co" >> .env
echo "PGADMIN_PASSWORD=admin123" >> .env

docker compose -f docker/docker-compose.dev.yml up -d
```

### 4. Rode as migrations e inicie

```bash
# Backend
cd backend
npx prisma migrate dev --name init
npm run start:dev          # http://localhost:3000

# Frontend (outro terminal)
cd frontend
npm run dev                # http://localhost:5173
```

### 5. Crie um usuário inicial

```bash
cd backend
node -e "
const bcrypt = require('bcrypt');
bcrypt.hash('senha123', 10).then(h => console.log(h));
"
# Copie o hash e insira no banco:
# INSERT INTO "User" (id, email, "passwordHash")
# VALUES (gen_random_uuid(), 'admin@omnimail.com', '<hash>');
```

## URLs

| Serviço | URL |
|---------|-----|
| Frontend (dev) | http://localhost:5173 |
| Backend API (dev) | http://localhost:3000 |
| Swagger/OpenAPI | http://localhost:3000/api/docs |
| pgAdmin | http://localhost:5050 |

## Testes

```bash
# Backend (unit + E2E)
cd backend && npm test

# Frontend (Vitest)
cd frontend && npx vitest run

# Todos os testes com cobertura
cd backend && npm run test:cov
```

**Resultados:** 85 testes backend + 24 testes frontend = **109 testes passando**

## Produção (Docker Compose)

```bash
cd docker
cp .env.example .env   # preencher valores reais
docker compose -f docker-compose.prod.yml up --build -d
```

Acesse: http://localhost (frontend com nginx proxy para API)

## Segurança

- **Zero Hardcoded** — Nenhum segredo em código. Tudo via `.env`
- **AES-256-GCM** — Campos sensíveis (remetente, assunto, corpo) criptografados no banco
- **Descriptografia em memória** — Dados nunca expostos em repouso
- **Pre-commit hooks** — Gitleaks bloqueia push com segredos
- **JWT + Refresh Tokens** — Access token 15min, refresh 7d
- **Rate Limiting** — 30 requests/minuto via ThrottlerGuard
- **Helmet + CORS** — Headers de segurança configurados
- **Validação** — DTOs com class-validator, ValidationPipe global

## Telegram

1. Crie um bot via [@BotFather](https://t.me/BotFather) no Telegram
2. Envie uma mensagem ao bot e descubra seu Chat ID via `https://api.telegram.org/bot<TOKEN>/getUpdates`
3. Configure na tela de Configurações do painel (`/settings`) ou no `.env`:
   ```
   TELEGRAM_BOT_TOKEN=seu_token
   TELEGRAM_CHAT_ID=seu_chat_id
   ```
4. Teste via botão "Enviar Teste" na tela de configurações

## Sprints

| Sprint | Foco | PRs |
|--------|------|-----|
| 1 | Fundação & Security Zero Trust | #1, #2 |
| 2 | Motor IMAP Criptografado | #3, #4 |
| 3 | API Endpoint Seguro | #5, #6 |
| 4 | Painel Web Autenticado | #7, #8 |
| 5 | Alertas (Telegram + Settings) | #9, #10, #11 |
| 6 | Testes Regressivos e Deploy | #12, #13 |
