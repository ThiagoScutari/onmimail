# Sprint 6 — Testes Regressivos e Deploy
## Release Notes — Claude (Dockerfiles, CI/CD & Deploy)

**Projeto:** Omnimail — Monitor de E-mails Contabeis
**Responsavel:** Claude
**Data:** 2026-03-23
**Branch:** `claude/sprint-06`
**Status:** Concluida

---

## 1. Resumo Executivo

Entrega final: sistema pronto para deploy em producao com Dockerfiles multi-stage, Docker Compose de producao, pipeline CI no GitHub Actions, health endpoint e documentacao completa.

---

## 2. Entregas Realizadas

### 2.1 Health Endpoint
- **GET /health** — endpoint publico (sem autenticacao)
- Retorna `{ status: "ok", timestamp, uptime }`
- Usado pelo HEALTHCHECK do Docker para monitorar o container

### 2.2 Dockerfile Backend (Multi-stage)
- **Stage 1 (builder):** npm ci, prisma generate, npm run build
- **Stage 2 (production):** Copia dist + node_modules + prisma, roda como usuario nao-root (`appuser`)
- Inclui `prisma.config.ts` (requerido pelo Prisma v7)
- HEALTHCHECK integrado via wget no /health
- CMD executa `prisma migrate deploy` antes de iniciar o app

### 2.3 Dockerfile Frontend (Multi-stage)
- **Stage 1 (builder):** npm ci, build com VITE_API_URL=/api
- **Stage 2 (production):** Nginx Alpine servindo arquivos estaticos
- Build arg `VITE_API_URL` configuravel

### 2.4 Nginx Config
- SPA routing (fallback para index.html)
- Proxy reverso `/api/` para `backend:3000`
- Proxy `/health` para backend
- Cache de assets estaticos (30 dias)
- Headers de seguranca (X-Frame-Options, X-Content-Type-Options, Referrer-Policy)

### 2.5 Docker Compose Producao
- **postgres:** PostgreSQL 16 Alpine com healthcheck
- **backend:** Build do Dockerfile, depends_on postgres (service_healthy)
- **frontend:** Build do Dockerfile, porta 80
- Volume persistente `pgdata` para dados do PostgreSQL
- Variaveis de ambiente com defaults para Telegram (opcional)

### 2.6 GitHub Actions CI Pipeline
| Job | Depende de | Descricao |
|-----|------------|-----------|
| lint-backend | — | ESLint no backend |
| lint-frontend | — | ESLint no frontend |
| security-scan | — | Gitleaks para deteccao de segredos |
| test-backend | lint-backend, security-scan | Testes unitarios + E2E com PostgreSQL real |
| test-frontend | lint-frontend | Vitest + build |
| build-images | test-backend, test-frontend | Docker build (apenas na main) |

- APP_SECRET via GitHub Secrets (`APP_SECRET_TEST`)
- PostgreSQL como service do GitHub Actions

### 2.7 Documentacao de Deploy
- Pre-requisitos, geracao de segredos, configuracao
- Comandos de deploy, seed, health check
- Logs, backup, restauracao, atualizacao

---

## 3. Arquivos Criados

```
backend/
├── Dockerfile                 # Multi-stage build
├── .dockerignore
└── src/health/
    ├── health.controller.ts   # GET /health
    └── health.module.ts

frontend/
├── Dockerfile                 # Multi-stage build + nginx
├── .dockerignore
└── nginx.conf                 # SPA routing + proxy reverso

docker/
├── docker-compose.prod.yml   # PostgreSQL + Backend + Frontend
└── .env.example              # Template de variaveis de producao

.github/workflows/
└── ci.yml                    # GitHub Actions CI pipeline

docs/
└── deploy.md                 # Documentacao completa de deploy

sprints/Sprint_06_Deploy/
└── ReleaseNotes.md           # Este arquivo
```

---

## 4. Como Fazer Deploy

```bash
# 1. Configurar ambiente
cd docker && cp .env.example .env
# Editar .env com valores reais

# 2. Subir
docker compose -f docker/docker-compose.prod.yml up -d --build

# 3. Seed (primeira vez)
docker compose -f docker/docker-compose.prod.yml exec backend npx prisma db seed

# 4. Verificar
curl http://localhost:3000/health
```

---

## 5. Resumo do Projeto Completo (Sprints 1-6)

| Sprint | Entrega Claude | Testes |
|--------|---------------|--------|
| 1 | NestJS, Prisma, CryptoService, JWT Auth | 10 |
| 2 | EmailProcessor, Crypto por campo, Cronjob | 7 |
| 3 | DecryptInterceptor, Throttler, Helmet, CORS | 13 + 8 E2E |
| 4 | AuthContext, LoginPage, API layer, PrivateRoute | 7 |
| 5 | TelegramService, SettingsModule, Notificacoes | 5 + 5 E2E |
| 6 | Dockerfiles, CI/CD, Health, Deploy docs | — |
| **Total** | | **55+ testes** |

---

*Sprint 6 finalizada em 2026-03-23 — Omnimail pronto para producao*
