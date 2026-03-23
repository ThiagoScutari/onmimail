# Sprint 6 — Gemini: Testes E2E & Segurança

## Contexto
Sprint 6 (final) do Omnimail (Scutari & Co). Todo o sistema está funcional. Sua parte: garantir cobertura de testes E2E, testes de segurança e relatório de cobertura.

## Pré-requisito
- Sprints 1-5 completas e integradas na branch main

## Sua Entrega

### 1. Testes E2E — Fluxo Completo
Arquivo: `backend/test/app.e2e-spec.ts`

Use `@nestjs/testing` + `supertest`. Banco de teste separado (`omnimail_test`).

**Fluxo completo (cenário feliz):**
1. POST /auth/login → obter accessToken
2. POST /emails/sync → processar emails (com ImapService mockado)
3. GET /emails → listar emails descriptografados
4. GET /emails/:id → detalhe com corpo
5. PATCH /emails/:id/status → mudar para READ
6. GET /emails?status=READ → filtrar por status
7. GET /settings → ver configurações
8. PUT /settings/monitored_senders → atualizar remetente
9. POST /settings/telegram/test → testar notificação

**Fluxo de erro:**
1. POST /auth/login com senha errada → 401
2. GET /emails sem token → 401
3. GET /emails com token expirado → 401
4. GET /emails/:uuid-invalido → 404
5. PATCH /emails/:id/status com status inválido → 400
6. POST /emails/sync duplicado → 0 novos emails

### 2. Testes de Segurança
Arquivo: `backend/test/security.e2e-spec.ts`

#### SQL Injection
- [ ] GET /emails?status=' OR 1=1-- → não retorna dados extras
- [ ] GET /emails/:id com payload SQL → 404 ou 400, nunca erro de BD
- [ ] PUT /settings/:key com valor SQL injection → armazena como texto, não executa

#### XSS
- [ ] Salvar email com `<script>alert('xss')</script>` no subject → retorna HTML-escaped ou raw (frontend escapa)
- [ ] PUT /settings com valor `<img onerror=alert(1)>` → armazena sem executar

#### Header Injection
- [ ] Request com headers maliciosos → ignorados pelo Helmet

#### JWT Tampering
- [ ] Token com payload modificado → 401
- [ ] Token assinado com chave diferente → 401
- [ ] Token sem campo `exp` → 401

#### Criptografia
- [ ] Dados no BD são ilegíveis (query direta ao PostgreSQL)
- [ ] APP_SECRET errado → falha de decrypt com exceção clara
- [ ] IV reutilizado → dois encrypts do mesmo texto produzem resultados diferentes

### 3. Testes do Frontend
Arquivo: `frontend/src/__tests__/`

Instale: `npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom`

Configure `vitest.config.ts`:
```typescript
export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
  },
});
```

Testes:
- [ ] LoginPage: submit com email/password chama api.post
- [ ] LoginPage: erro 401 exibe mensagem
- [ ] EmailList: renderiza lista de emails
- [ ] StatusBadge: exibe cor correta por status
- [ ] EmailPreview: abre com dados do email
- [ ] Pagination: navega entre páginas
- [ ] Header: botão sync chama POST /emails/sync

### 4. Relatório de Cobertura
Configure no `backend/package.json`:
```json
"scripts": {
  "test:cov": "jest --coverage --coverageReporters=text --coverageReporters=lcov",
  "test:e2e": "jest --config ./test/jest-e2e.json"
}
```

Meta de cobertura mínima:
- **Statements:** 80%
- **Branches:** 70%
- **Functions:** 80%
- **Lines:** 80%

### 5. Docker Compose de Teste
Arquivo: `docker/docker-compose.test.yml`

PostgreSQL dedicado para testes:
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
      - /var/lib/postgresql/data  # RAM para velocidade
```

### 6. Script de CI Local
Arquivo: `scripts/run-tests.sh`

```bash
#!/bin/bash
set -e

echo "=== Subindo banco de teste ==="
docker compose -f docker/docker-compose.test.yml up -d

echo "=== Rodando migrations ==="
DATABASE_URL=postgresql://omnimail:test_password@localhost:5433/omnimail_test npx prisma migrate deploy

echo "=== Testes unitários ==="
npm run test --prefix backend

echo "=== Testes E2E ==="
npm run test:e2e --prefix backend

echo "=== Cobertura ==="
npm run test:cov --prefix backend

echo "=== Testes frontend ==="
npm run test --prefix frontend

echo "=== Derrubando banco de teste ==="
docker compose -f docker/docker-compose.test.yml down

echo "✅ Todos os testes passaram!"
```

## Critérios de Aceite
- [ ] Fluxo E2E completo passa sem erros
- [ ] Nenhum teste de SQL Injection retorna dados inesperados
- [ ] JWT tampering resulta em 401
- [ ] Dados no BD são ilegíveis via query direta
- [ ] Cobertura >= 80% statements
- [ ] Testes frontend passam
- [ ] Script `run-tests.sh` executa toda a suíte

## Branch
Trabalhe na branch: `gemini/sprint-06`
