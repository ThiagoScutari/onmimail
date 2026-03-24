# Sprint 7 — Hotfix: Estabilização do CI Pipeline
## Release Notes — TechLead

**Projeto:** Omnimail — Monitor de E-mails Contábeis
**Responsável:** TechLead (Claude Opus)
**Data:** 2026-03-24
**Branch:** `main` (commits diretos — hotfix crítico)
**Status:** Concluída

---

## 1. Resumo Executivo

O pipeline de CI no GitHub Actions falhava sistematicamente no job `test-backend` após o merge da Sprint 6. A causa raiz era uma incompatibilidade entre a gestão de segredos do GitHub Actions, a validação Joi do NestJS e a ordem de inicialização do container de injeção de dependências. Foram necessárias 3 iterações de correção até atingir CI 100% verde.

---

## 2. Diagnóstico

### 2.1 Sintoma
O job `test-backend` falhava com `Cannot read 'close' of undefined` — a aplicação NestJS não conseguia inicializar durante os testes E2E.

### 2.2 Causa Raiz (3 problemas encadeados)

| # | Problema | Impacto |
|---|---------|---------|
| 1 | `APP_SECRET: ${{ secrets.APP_SECRET_TEST }}` no `ci.yml` | Secret não existia no repositório → GitHub injetava string vazia `''` |
| 2 | Joi `.optional().default(X)` não trata `''` | O Joi aceita `''` como valor válido e não aplica o default → `CryptoService` recebe chave vazia → crash no constructor |
| 3 | `TEST_JWT_SECRET = randomBytes(32)` nos E2E specs | Token assinado com secret aleatório, mas `JwtStrategy` validava com `process.env.JWT_SECRET` (valor do CI YAML) → mismatch → 401 em todas as rotas |

### 2.3 Problema Complementar
- O teste de rate limiting usava `Promise.all` com 31 requests paralelas — comportamento não-determinístico no CI (Ubuntu) vs local (Windows)

---

## 3. Correções Aplicadas

### 3.1 Variáveis de Ambiente no CI (commit `642e77a`)
**Arquivo:** `.github/workflows/ci.yml`

Substituído `${{ secrets.APP_SECRET_TEST }}` por valores de teste hardcoded diretamente no YAML:

```yaml
env:
  DATABASE_URL: postgresql://omnimail:test_password@localhost:5432/omnimail_test
  JWT_SECRET: ci-test-jwt-secret-not-for-production-use-1234567890
  APP_SECRET: aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899
  MONITORED_SENDERS: test@example.com
  TELEGRAM_BOT_TOKEN: ""
  TELEGRAM_CHAT_ID: ""
  FRONTEND_URL: http://localhost:5173
```

**Justificativa:** Valores de teste não são segredos — são placeholders que satisfazem as validações de tipo/comprimento do Joi. Seguros para versionamento.

### 3.2 JWT Secret via ConfigService (commit `77065b8`)
**Arquivos:** `test/emails.e2e-spec.ts`, `test/notification.e2e-spec.ts`, `test/security.e2e-spec.ts`

Substituído `const TEST_JWT_SECRET = randomBytes(32).toString('hex')` por:
```typescript
const configService = moduleFixture.get(ConfigService);
jwtSecret = configService.get<string>('JWT_SECRET');
```

O token é agora assinado com o mesmo secret que o `JwtStrategy` usa para validação — funciona tanto local (Joi default) quanto CI (env var do YAML).

### 3.3 Rate Limiting Determinístico (commit `cd8f1ec`)
**Arquivo:** `test/security.e2e-spec.ts`

Substituído `Promise.all` (31 requests paralelas) por loop sequencial com early break:
```typescript
for (let i = 0; i < 50; i++) {
  const res = await request(app.getHttpServer()).get('/emails')...;
  if (res.status === 429) { got429 = true; break; }
}
```

### 3.4 Gitleaks Allowlist (commit anterior)
**Arquivo:** `.gitleaks.toml`

Adicionados paths do CI workflow e test specs ao allowlist para evitar falsos positivos com placeholders de teste.

---

## 4. Resultado

| Job | Antes | Depois |
|-----|-------|--------|
| lint-backend | ✅ | ✅ |
| lint-frontend | ✅ | ✅ |
| security-scan | ✅ | ✅ |
| test-frontend | ✅ | ✅ |
| test-backend | ❌ | ✅ |
| build-images | ⊘ Skipped | ✅ |

**CI Run:** https://github.com/ThiagoScutari/onmimail/actions (Run #23484514198)

---

## 5. Lições Aprendidas

1. **Nunca referenciar secrets inexistentes** no CI — GitHub Actions injeta `''` silenciosamente
2. **Joi `.default()` não trata `''`** — usar `.empty('').default()` ou injetar valores diretamente
3. **Tokens JWT em testes** devem usar o mesmo secret que a Strategy — nunca gerar aleatórios
4. **Testes de rate limiting** devem ser sequenciais para determinismo em CI

---

*Documentação gerada em 2026-03-24 — Sprint 7 Hotfix CI Pipeline*
