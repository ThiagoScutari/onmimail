# Sprint 6 — Claude: Dockerfiles & CI/CD Pipeline

## Contexto
Sprint 6 (final) do Omnimail (Scutari & Co). Todo o sistema está funcional. Sua parte: preparar o deploy com Dockerfiles de produção, Docker Compose e pipeline CI.

## Pré-requisito
- Sprints 1-5 completas e integradas na branch main

## Sua Entrega

### 1. Dockerfile Backend (Multi-stage)
Arquivo: `backend/Dockerfile`

```dockerfile
# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma/
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
COPY --from=builder /app/package.json ./

USER appuser
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
```

### 2. Health Endpoint
Arquivo: `backend/src/health/health.controller.ts`

```typescript
@Controller('health')
export class HealthController {
  @Get()
  check() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
```

Sem autenticação (público). Necessário para o HEALTHCHECK do Docker.

### 3. Dockerfile Frontend
Arquivo: `frontend/Dockerfile`

```dockerfile
# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# Stage 2: Serve with nginx
FROM nginx:alpine AS production
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

### 4. Nginx Config
Arquivo: `frontend/nginx.conf`

```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    # SPA routing — todas as rotas vão para index.html
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

```yaml
version: '3.8'

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
      TELEGRAM_BOT_TOKEN: ${TELEGRAM_BOT_TOKEN}
      TELEGRAM_CHAT_ID: ${TELEGRAM_CHAT_ID}
      IMAP_HOST: ${IMAP_HOST}
      IMAP_PORT: ${IMAP_PORT}
      IMAP_USER: ${IMAP_USER}
      IMAP_PASSWORD: ${IMAP_PASSWORD}
      MONITORED_SENDERS: ${MONITORED_SENDERS}
      FRONTEND_URL: ${FRONTEND_URL}
    ports:
      - "3000:3000"

  frontend:
    build:
      context: ../frontend
      dockerfile: Dockerfile
      args:
        VITE_API_URL: ${FRONTEND_URL:-http://localhost}/api
    restart: unless-stopped
    depends_on:
      - backend
    ports:
      - "80:80"

volumes:
  pgdata:
```

### 6. GitHub Actions CI Pipeline
Arquivo: `.github/workflows/ci.yml`

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  lint:
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

  security-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

  test-backend:
    runs-on: ubuntu-latest
    needs: [lint, security-scan]
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
      APP_SECRET: 0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: backend/package-lock.json
      - run: cd backend && npm ci
      - run: cd backend && npx prisma migrate deploy
      - run: cd backend && npm test
      - run: cd backend && npm run test:e2e
      - run: cd backend && npm run test:cov

  test-frontend:
    runs-on: ubuntu-latest
    needs: [lint]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: frontend/package-lock.json
      - run: cd frontend && npm ci
      - run: cd frontend && npm test
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

### 7. Documentação de Deploy
Arquivo: `docs/deploy.md`

Conteúdo:
- Pré-requisitos (Docker, Docker Compose)
- Como configurar `.env` de produção
- Como subir com `docker compose -f docker/docker-compose.prod.yml up -d`
- Como rodar migrations
- Como verificar health (`curl http://localhost:3000/health`)
- Como ver logs (`docker compose logs -f backend`)
- Como fazer backup do PostgreSQL

### 8. Release Notes Sprint 6
Arquivo: `sprints/Sprint_06_Deploy/ReleaseNotes.md`

Documente o que foi entregue no formato:
```markdown
# Sprint 6 — Testes Regressivos e Deploy

## Entregáveis
- Dockerfiles multi-stage (backend + frontend)
- Docker Compose de produção
- CI pipeline (GitHub Actions)
- Health endpoint
- Documentação de deploy

## Como usar
...
```

## Critérios de Aceite
- [ ] `docker compose -f docker/docker-compose.prod.yml up --build` sobe todo o sistema
- [ ] Frontend acessível em http://localhost
- [ ] Backend acessível em http://localhost:3000
- [ ] Health check funciona: `curl http://localhost:3000/health`
- [ ] Proxy /api/ no nginx encaminha para o backend
- [ ] GitHub Actions pipeline passa (lint → security → test → build)
- [ ] Documentação de deploy completa

## Ordem de Execução
1. Crie Health endpoint
2. Crie Dockerfile do backend + teste local
3. Crie Dockerfile do frontend + nginx.conf + teste local
4. Crie Docker Compose de produção
5. Teste `docker compose up --build` completo
6. Crie GitHub Actions pipeline
7. Escreva documentação de deploy
8. Crie Release Notes

## Branch
Trabalhe na branch: `claude/sprint-06`
