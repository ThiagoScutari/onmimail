# Sprint 6 — Gemini: Testes E2E, Segurança & Frontend

## Contexto
Sprint 6 (final) do Omnimail (Scutari & Co). Todo o sistema está funcional. Sua parte: garantir cobertura de testes E2E, expandir testes de segurança e completar testes do frontend.

## Pré-requisito
- Sprints 1-5 completas e integradas na branch main

## Estado Atual do Código (IMPORTANTE — leia antes de começar)
- **E2E existentes:** `backend/test/app.e2e-spec.ts`, `backend/test/emails.e2e-spec.ts`, `backend/test/security.e2e-spec.ts`, `backend/test/notification.e2e-spec.ts` — NÃO sobrescreva, expanda.
- **Frontend Vitest:** Já configurado em `frontend/vitest.config.ts` e `frontend/vitest.setup.ts`. JÁ existem testes em `frontend/src/__tests__/auth.test.tsx` e `frontend/src/pages/SettingsPage.spec.tsx`. NÃO recrie a config.
- **Frontend NÃO tem script `test`:** Adicione `"test": "vitest run"` no `frontend/package.json` scripts.
- **Backend test scripts:** `test`, `test:e2e`, `test:cov` já existem no `package.json`.

## Sua Entrega

### 1. Testes E2E — Fluxo Completo
Arquivo: `backend/test/flow.e2e-spec.ts` (NOVO arquivo — não modifique os existentes)

Use `@nestjs/testing` + `supertest`. Os testes E2E existentes já usam mocks do PrismaService — siga o mesmo padrão.

**Fluxo completo (cenário feliz):**
1. POST /auth/login → obter accessToken
2. POST /emails/sync → processar emails (com ImapService mockado)
3. GET /emails → listar emails descriptografados
4. GET /emails/:id → detalhe com corpo
5. PATCH /emails/:id/status → mudar para READ
6. GET /emails?status=READ → filtrar por status
7. GET /settings → ver configurações (tokens mascarados)
8. PUT /settings/monitored_senders → atualizar remetente
9. POST /settings/telegram/test → testar notificação (TelegramService mockado)

**Fluxo de erro:**
1. POST /auth/login com senha errada → 401
2. GET /emails sem token → 401
3. GET /emails com token expirado → 401
4. GET /emails/:uuid-invalido → 404
5. PATCH /emails/:id/status com status inválido → 400
6. POST /emails/sync duplicado → 0 novos emails (dedup por messageId)

### 2. Expandir Testes de Segurança
Arquivo: `backend/test/security.e2e-spec.ts` — **EXPANDA** o arquivo existente adicionando os testes abaixo que ainda não existem. Verifique os testes atuais antes de duplicar.

#### SQL Injection (adicionar se não existir)
- [ ] GET /emails?status=' OR 1=1-- → não retorna dados extras
- [ ] GET /emails/:id com payload SQL → 404 ou 400, nunca erro de BD
- [ ] PUT /settings/:key com valor SQL injection → armazena como texto, não executa

#### XSS (adicionar se não existir)
- [ ] Salvar email com `<script>alert('xss')</script>` no subject → retorna sem executar
- [ ] PUT /settings com valor `<img onerror=alert(1)>` → armazena sem executar

#### JWT Tampering (adicionar se não existir)
- [ ] Token com payload modificado → 401
- [ ] Token assinado com chave diferente → 401

#### Criptografia (adicionar se não existir)
- [ ] APP_SECRET errado → falha de decrypt com exceção clara
- [ ] Dois encrypts do mesmo texto produzem resultados diferentes (IV aleatório)

### 3. Testes do Frontend
Diretório: `frontend/src/__tests__/` (adicione arquivos NOVOS aqui)

**NÃO recrie vitest.config.ts nem vitest.setup.ts — já existem.**
**NÃO modifique auth.test.tsx nem SettingsPage.spec.tsx — já existem.**

Testes a criar:
- [ ] `frontend/src/__tests__/EmailList.test.tsx` — renderiza lista de emails mockados
- [ ] `frontend/src/__tests__/StatusBadge.test.tsx` — exibe cor correta por status (UNREAD=vermelho, READ=cinza, RESPONDED=verde)
- [ ] `frontend/src/__tests__/EmailPreview.test.tsx` — abre drawer com dados do email, chama updateStatus ao abrir
- [ ] `frontend/src/__tests__/Pagination.test.tsx` — navega entre páginas, desabilita botão quando na última
- [ ] `frontend/src/__tests__/Header.test.tsx` — botão sync chama POST /emails/sync, link settings navega para /settings
- [ ] `frontend/src/__tests__/LoginPage.test.tsx` — submit chama api.post, erro 401 exibe mensagem

### 4. Adicionar script `test` no frontend
Arquivo: `frontend/package.json`

Adicione no `scripts`:
```json
"test": "vitest run"
```

### 5. Relatório de Cobertura
Verifique que o script `test:cov` no `backend/package.json` já existe (`"test:cov": "jest --coverage"`). Se não tiver reporters configurados, adicione:
```json
"test:cov": "jest --coverage --coverageReporters=text --coverageReporters=lcov"
```

Meta de cobertura mínima:
- **Statements:** 80%
- **Branches:** 70%
- **Functions:** 80%
- **Lines:** 80%

### 6. Docker Compose de Teste
Arquivo: `docker/docker-compose.test.yml`

PostgreSQL dedicado para testes (porta 5433 para não conflitar com dev):
```yaml
services:
  postgres-test:
    image: postgres:16
    ports:
      - "5433:5432"
    environment:
      POSTGRES_DB: omnimail_test
      POSTGRES_USER: omnimail
      POSTGRES_PASSWORD: test_password
    tmpfs:
      - /var/lib/postgresql/data
```

**Nota:** Sem `version:` — obsoleto no Docker Compose v2+.

### 7. Script de CI Local
Crie DOIS arquivos (o ambiente do projeto é Windows):

Arquivo: `scripts/run-tests.sh` (para Git Bash / Linux / CI)
```bash
#!/bin/bash
set -e

echo "=== Subindo banco de teste ==="
docker compose -f docker/docker-compose.test.yml up -d
sleep 3

echo "=== Rodando migrations ==="
cd backend
DATABASE_URL=postgresql://omnimail:test_password@localhost:5433/omnimail_test npx prisma migrate deploy

echo "=== Testes unitários backend ==="
npm test

echo "=== Testes E2E backend ==="
npm run test:e2e

echo "=== Cobertura backend ==="
npm run test:cov

echo "=== Testes frontend ==="
cd ../frontend
npm test

echo "=== Derrubando banco de teste ==="
cd ..
docker compose -f docker/docker-compose.test.yml down

echo "✅ Todos os testes passaram!"
```

Arquivo: `scripts/run-tests.ps1` (para PowerShell / Windows)
```powershell
$ErrorActionPreference = "Stop"

Write-Host "=== Subindo banco de teste ===" -ForegroundColor Cyan
docker compose -f docker/docker-compose.test.yml up -d
Start-Sleep -Seconds 3

Write-Host "=== Rodando migrations ===" -ForegroundColor Cyan
Set-Location backend
$env:DATABASE_URL = "postgresql://omnimail:test_password@localhost:5433/omnimail_test"
npx prisma migrate deploy

Write-Host "=== Testes unitários backend ===" -ForegroundColor Cyan
npm test

Write-Host "=== Testes E2E backend ===" -ForegroundColor Cyan
npm run test:e2e

Write-Host "=== Cobertura backend ===" -ForegroundColor Cyan
npm run test:cov

Write-Host "=== Testes frontend ===" -ForegroundColor Cyan
Set-Location ../frontend
npm test

Write-Host "=== Derrubando banco de teste ===" -ForegroundColor Cyan
Set-Location ..
docker compose -f docker/docker-compose.test.yml down

Write-Host "✅ Todos os testes passaram!" -ForegroundColor Green
```

## Critérios de Aceite
- [ ] Fluxo E2E completo (flow.e2e-spec.ts) passa sem erros
- [ ] Testes de segurança expandidos passam
- [ ] Nenhum teste de SQL Injection retorna dados inesperados
- [ ] JWT tampering resulta em 401
- [ ] Testes frontend passam (6+ novos testes)
- [ ] Script `npm test` funciona no frontend
- [ ] Cobertura backend >= 80% statements
- [ ] Docker Compose de teste sobe PostgreSQL na porta 5433
- [ ] Scripts run-tests.sh e run-tests.ps1 executam toda a suíte
- [ ] ESLint + TSC: 0 erros em todos os arquivos novos

## Branch
Trabalhe na branch: `gemini/sprint-06`
