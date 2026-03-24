# Sprint 6 — Claude: Dockerfiles, CI/CD Pipeline & Deploy

## Contexto
Sprint 6 (final) do Omnimail (Scutari & Co). Todo o sistema está funcional. Sua parte: preparar o deploy com Dockerfiles de produção, Docker Compose e pipeline CI.

## Pré-requisito
- Sprints 1-5 completas e integradas na branch main

## Estado Atual do Código (IMPORTANTE — leia antes de começar)
- **Backend usa Prisma v7** com `prisma.config.ts` na raiz do backend — o Dockerfile DEVE copiar este arquivo.
- **Backend ESLint:** Usa flat config (`eslint.config.mjs`), NÃO `.eslintrc`. O script `lint` no package.json funciona.
- **Frontend NÃO tem script `test` ainda** — o Gemini vai adicionar na Sprint 6 dele. Se precisar referenciar, o comando é `vitest run`.
- **Frontend usa Vitest** (não Jest). Config em `frontend/vitest.config.ts`.
- **Prisma seed:** Existe `backend/prisma/seed.ts` (entregue na Sprint 5).
- **Docker Compose dev:** Existe `docker/docker-compose.dev.yml` com PostgreSQL na porta 5432 + pgAdmin na porta 8080.
- **.gitleaksignore:** Existe na raiz com fingerprints de APP_SECRET de teste. Se o CI pipeline tiver APP_SECRET em YAML, use GitHub Secrets (`${{ secrets.APP_SECRET }}`) ou adicione fingerprint ao `.gitleaksignore`.

## Sua Entrega

### 1. Health Endpoint
Arquivo: `backend/src/health/health.controller.ts`

```typescript
import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }
}
```

Crie `HealthModule` e registre no `AppModule`. Sem autenticação (público). Necessário para o HEALTHCHECK do Docker.

### 2. Dockerfile Backend (Multi-stage)
Arquivo: `backend/Dockerfile`

```dockerfile
# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma/
COPY prisma.config.ts ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

# Stage 2: Production
FROM node:20-alpine AS production
WORKDIR /app
RUN addgroup -g 1001 -S appgroup && adduser -S appuser -u 1001 -G appgroup

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./
COPY --from=builder /app/package.json ./

USER appuser
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
```

**Notas:**
- `prisma.config.ts` DEVE ser copiado — Prisma v7 precisa dele.
- Teste localmente: `docker build -t omnimail-backend .` dentro de `backend/`.

### 3. Dockerfile Frontend
Arquivo: `frontend/Dockerfile`

```dockerfile
# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# Stage 2: Serve with nginx
FROM nginx:alpine AS production
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

**Nota:** `VITE_API_URL=/api` como default — o nginx faz proxy para o backend.

### 4. Nginx Config
Arquivo: `frontend/nginx.conf`

```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    # SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy API requests para o backend
    location /api/ {
        proxy_pass http://backend:3000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Proxy Health check
    location /health {
        proxy_pass http://backend:3000/health;
    }

    # Cache de assets estáticos
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # Headers de segurança
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
}
```

### 5. Docker Compose de Produção
Arquivo: `docker/docker-compose.prod.yml`

**Nota:** Sem `version:` — obsoleto no Docker Compose v2+.

```yaml
services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    volumes:
      - pgdata:/var/lib/postgresql/data
    environment:
      POSTGRES_DB: omnimail
      POSTGRES_USER: omnimail
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U omnimail"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    build:
      context: ../backend
      dockerfile: Dockerfile
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      DATABASE_URL: postgresql://omnimail:${DB_PASSWORD}@postgres:5432/omnimail
      JWT_SECRET: ${JWT_SECRET}
      APP_SECRET: ${APP_SECRET}
      TELEGRAM_BOT_TOKEN: ${TELEGRAM_BOT_TOKEN:-}
      TELEGRAM_CHAT_ID: ${TELEGRAM_CHAT_ID:-}
      IMAP_HOST: ${IMAP_HOST}
      IMAP_PORT: ${IMAP_PORT:-993}
      IMAP_USER: ${IMAP_USER}
      IMAP_PASSWORD: ${IMAP_PASSWORD}
      MONITORED_SENDERS: ${MONITORED_SENDERS}
      FRONTEND_URL: ${FRONTEND_URL:-http://localhost}
    ports:
      - "3000:3000"

  frontend:
    build:
      context: ../frontend
      dockerfile: Dockerfile
      args:
        VITE_API_URL: /api
    restart: unless-stopped
    depends_on:
      - backend
    ports:
      - "80:80"

volumes:
  pgdata:
```

**Notas:**
- `TELEGRAM_BOT_TOKEN` e `TELEGRAM_CHAT_ID` com default vazio — sistema funciona sem Telegram.
- `IMAP_PORT` default 993.
- `VITE_API_URL=/api` — o nginx resolve o proxy.

### 6. .env de Produção (template)
Arquivo: `docker/.env.example`

```bash
# === PostgreSQL ===
DB_PASSWORD=CHANGE_ME_STRONG_PASSWORD

# === Backend Security ===
JWT_SECRET=CHANGE_ME_RANDOM_64_CHARS
APP_SECRET=CHANGE_ME_64_HEX_CHARS_32_BYTES

# === IMAP ===
IMAP_HOST=outlook.office365.com
IMAP_PORT=993
IMAP_USER=seu-email@outlook.com
IMAP_PASSWORD=CHANGE_ME

# === Monitoramento ===
MONITORED_SENDERS=contabiletica@hotmail.com

# === Telegram (opcional) ===
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=

# === Frontend ===
FRONTEND_URL=http://localhost
```

### 7. GitHub Actions CI Pipeline
Arquivo: `.github/workflows/ci.yml`

**IMPORTANTE sobre segredos no CI:**
- NÃO coloque APP_SECRET diretamente no YAML — será flaggado pelo Gitleaks.
- Use variáveis de ambiente do GitHub Actions com valores inline curtos ou use `${{ secrets.* }}` para valores sensíveis.
- O JWT_SECRET de teste pode ser inline (não é real). O APP_SECRET de teste DEVE ser definido como secret no repo ou usar um hash genérico que não acione o Gitleaks.

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  lint-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: backend/package-lock.json
      - run: cd backend && npm ci
      - run: cd backend && npm run lint

  lint-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: frontend/package-lock.json
      - run: cd frontend && npm ci
      - run: cd frontend && npm run lint

  security-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

  test-backend:
    runs-on: ubuntu-latest
    needs: [lint-backend, security-scan]
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_DB: omnimail_test
          POSTGRES_USER: omnimail
          POSTGRES_PASSWORD: test_password
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    env:
      DATABASE_URL: postgresql://omnimail:test_password@localhost:5432/omnimail_test
      JWT_SECRET: test-jwt-secret-ci-only
      APP_SECRET: ${{ secrets.APP_SECRET_TEST }}
      TELEGRAM_BOT_TOKEN: ""
      TELEGRAM_CHAT_ID: ""
      FRONTEND_URL: http://localhost
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: backend/package-lock.json
      - run: cd backend && npm ci
      - run: cd backend && npx prisma generate
      - run: cd backend && npx prisma migrate deploy
      - run: cd backend && npm test
      - run: cd backend && npm run test:e2e
      - run: cd backend && npm run test:cov

  test-frontend:
    runs-on: ubuntu-latest
    needs: [lint-frontend]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: frontend/package-lock.json
      - run: cd frontend && npm ci
      - run: cd frontend && npx vitest run
      - run: cd frontend && npm run build

  build-images:
    runs-on: ubuntu-latest
    needs: [test-backend, test-frontend]
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - run: docker build -t omnimail-backend ./backend
      - run: docker build -t omnimail-frontend ./frontend
```

**Após criar o arquivo, configure no GitHub:**
1. Vá em Settings → Secrets and Variables → Actions
2. Crie secret `APP_SECRET_TEST` com valor: um hex de 64 chars para testes (ex: `a1b2c3...`)

### 8. Documentação de Deploy
Arquivo: `docs/deploy.md`

Conteúdo obrigatório:
- Pré-requisitos (Docker 24+, Docker Compose v2+)
- Como gerar segredos seguros (`openssl rand -hex 32` para APP_SECRET)
- Como configurar `.env` de produção (copiar de `docker/.env.example`)
- Como subir: `docker compose -f docker/docker-compose.prod.yml up -d --build`
- Como rodar seed: `docker compose exec backend npx prisma db seed`
- Como verificar health: `curl http://localhost:3000/health`
- Como ver logs: `docker compose -f docker/docker-compose.prod.yml logs -f backend`
- Como fazer backup do PostgreSQL: `docker compose exec postgres pg_dump -U omnimail omnimail > backup.sql`
- Como restaurar: `cat backup.sql | docker compose exec -T postgres psql -U omnimail omnimail`

### 9. Release Notes Sprint 6
Arquivo: `sprints/Sprint_06_Deploy/ReleaseNotes.md`

Documente o que foi entregue incluindo:
- Dockerfiles multi-stage (backend + frontend)
- Nginx config com SPA routing + proxy reverso
- Docker Compose de produção (PostgreSQL + Backend + Frontend)
- CI pipeline (GitHub Actions: lint → security → test → build)
- Health endpoint público
- Documentação de deploy

## Critérios de Aceite
- [ ] `docker build -t omnimail-backend ./backend` — build sem erros
- [ ] `docker build -t omnimail-frontend ./frontend` — build sem erros
- [ ] `docker compose -f docker/docker-compose.prod.yml up --build` — sobe todo o sistema
- [ ] Frontend acessível em http://localhost
- [ ] Backend acessível em http://localhost:3000
- [ ] Health check funciona: `curl http://localhost:3000/health` retorna `{ status: "ok" }`
- [ ] Proxy /api/ no nginx encaminha para o backend
- [ ] GitHub Actions CI pipeline passa (lint → security → test → build)
- [ ] Documentação de deploy completa e clara
- [ ] Release Notes da Sprint 6

## Ordem de Execução
1. Crie Health endpoint + HealthModule + registre no AppModule
2. Crie Dockerfile do backend — teste com `docker build`
3. Crie Dockerfile do frontend + nginx.conf — teste com `docker build`
4. Crie Docker Compose de produção + .env.example
5. Teste `docker compose -f docker/docker-compose.prod.yml up --build` completo
6. Crie GitHub Actions CI pipeline
7. Escreva documentação de deploy
8. Crie Release Notes

## Branch
Trabalhe na branch: `claude/sprint-06`
