# Sprint 1 — Gemini: Infraestrutura & Configuração

## Contexto
Você é o programador Gemini no projeto Omnimail (Scutari & Co). Este projeto monitora e-mails contábeis para evitar perda de prazos fiscais. Sua responsabilidade na Sprint 1 é montar toda a infraestrutura base do repositório.

**Stack:** NestJS + Prisma + PostgreSQL + React (Vite) + TailwindCSS

## Sua Entrega

### 1. Estrutura do Monorepo
Crie a estrutura raiz do projeto:
```
omnimail/
├── backend/          # NestJS (Claude vai inicializar)
├── frontend/         # React (Sprint 4)
├── docker/           # Docker Compose e configs
├── docs/             # Já existe
├── sprints/          # Já existe
├── .gitignore
├── .env.example
└── README.md
```

### 2. Docker Compose (Desenvolvimento)
Arquivo: `docker/docker-compose.dev.yml`

Serviços necessários:
- **postgres**: PostgreSQL 16, porta 5432
  - Database: `omnimail_dev`
  - User: `omnimail`
  - Password: via variável de ambiente `${DB_PASSWORD}`
  - Volume persistente para dados
- **pgadmin** (opcional): pgAdmin 4, porta 5050

```yaml
# Variáveis de ambiente esperadas (não hardcode):
# DB_PASSWORD, PGADMIN_EMAIL, PGADMIN_PASSWORD
```

### 3. Arquivo `.env.example`
Crie na raiz com TODAS as variáveis que o projeto usará (valores vazios ou placeholder):
```env
# Database
DATABASE_URL=postgresql://omnimail:CHANGE_ME@localhost:5432/omnimail_dev
DB_PASSWORD=CHANGE_ME

# JWT Auth
JWT_SECRET=CHANGE_ME
JWT_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d

# Criptografia
APP_SECRET=CHANGE_ME_32_BYTES_HEX

# IMAP (Sprint 2)
IMAP_HOST=outlook.office365.com
IMAP_PORT=993
IMAP_USER=CHANGE_ME
IMAP_PASSWORD=CHANGE_ME

# Telegram (Sprint 5)
TELEGRAM_BOT_TOKEN=CHANGE_ME
TELEGRAM_CHAT_ID=CHANGE_ME

# pgAdmin (opcional)
PGADMIN_EMAIL=admin@scutari.co
PGADMIN_PASSWORD=CHANGE_ME
```

### 4. `.gitignore`
Inclua no mínimo:
```
node_modules/
dist/
.env
*.log
.DS_Store
coverage/
.prisma/
```

### 5. Pre-commit Hooks (Husky + Gitleaks)
Instalar na raiz do monorepo:
```bash
npx husky init
```

Criar hook `.husky/pre-commit`:
```bash
#!/bin/sh
# Lint staged files
npx lint-staged

# Scan for secrets
npx gitleaks detect --source . --verbose
```

Configurar `lint-staged` no `package.json` raiz:
```json
{
  "lint-staged": {
    "backend/**/*.ts": ["eslint --fix", "prettier --write"],
    "frontend/**/*.{ts,tsx}": ["eslint --fix", "prettier --write"]
  }
}
```

### 6. ESLint + Prettier
Configuração na raiz do monorepo:
- `.prettierrc`: singleQuote: true, trailingComma: 'all', semi: true, printWidth: 100
- ESLint config compatível com NestJS (TypeScript)

### 7. README.md da raiz
Breve descrição do projeto, como rodar o Docker Compose, e como configurar o `.env`.

## Critérios de Aceite
- [ ] `docker compose -f docker/docker-compose.dev.yml up -d` sobe PostgreSQL funcional
- [ ] `.env.example` contém todas as variáveis sem nenhum segredo real
- [ ] `git commit` com segredo hardcoded é **bloqueado** pelo Gitleaks
- [ ] ESLint e Prettier estão configurados e funcionando
- [ ] `.gitignore` impede commit de `node_modules/`, `.env`, `dist/`

## Ordem de Execução
1. Crie a estrutura de pastas
2. Configure Docker Compose e teste o PostgreSQL
3. Inicialize o package.json raiz com Husky + lint-staged
4. Configure ESLint e Prettier
5. Teste o pre-commit hook com um segredo fake (deve ser bloqueado)

## Interface com Claude
Claude vai criar o projeto NestJS dentro de `backend/`. Ele precisa que o Docker Compose esteja funcional para rodar as migrations do Prisma. **Entregue o Docker Compose primeiro.**

## Branch
Trabalhe na branch: `gemini/sprint-01`
