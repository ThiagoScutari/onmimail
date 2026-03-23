# Orquestrador — Omnimail (Scutari & Co)

## Projeto
Sistema de monitoramento de e-mails contábeis para evitar perda de prazos fiscais.

## Stack
- **Backend:** NestJS + TypeScript + Prisma + PostgreSQL
- **Frontend:** React SPA (Vite + TailwindCSS)
- **Auth:** JWT (access + refresh token)
- **Criptografia:** AES-256-GCM (campos sensíveis no BD)
- **Mensageria:** Telegram Bot
- **CI/CD:** Husky + Gitleaks + GitHub Actions

## Programadores
| Papel | Foco Principal |
|-------|---------------|
| **Gemini** | Infraestrutura, conexões externas (IMAP, Telegram), UI components, testes E2E |
| **Claude** | Core backend (NestJS), segurança (Crypto, JWT, Guards), auth flow, deploy |

## Regras
1. Branch própria por sprint: `gemini/sprint-XX` e `claude/sprint-XX`
2. Interfaces compartilhadas definidas no início de cada sprint
3. Merge na `main` só após TechLead validar ambas entregas
4. Zero segredos em código — tudo via `.env`
5. Cada sprint gera Release Notes em `sprints/Sprint_0X_*/`

## Sprints
| # | Nome | Gemini | Claude |
|---|------|--------|--------|
| 1 | Fundação & Security | Infra, Docker, linters, pre-commit | NestJS, Prisma, CryptoService, JWT |
| 2 | Motor IMAP | ImapService, parsing, filtros | EmailProcessor, crypto+save, cronjob |
| 3 | API Segura | Controller, DTOs, Swagger | JWT Guard, DecryptInterceptor, testes |
| 4 | Painel Web | React init, EmailList, EmailPreview | Login, AuthContext, PrivateRoute, API layer |
| 5 | Alertas | TelegramService, templates, /status | Trigger, config endpoint, testes |
| 6 | Testes & Deploy | E2E, segurança, cobertura | Dockerfiles, Compose prod, CI pipeline |
