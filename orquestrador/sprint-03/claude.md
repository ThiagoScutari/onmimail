# Sprint 3 — Claude: JWT Guard, DecryptInterceptor & Testes de Segurança

## Contexto
Sprint 3 do Omnimail (Scutari & Co). Backend funcional com e-mails criptografados no BD. Agora vamos expor a API REST de forma segura. Sua parte: proteção das rotas e descriptografia transparente dos dados.

## Pré-requisito
- Sprints 1-2 completas (JWT Auth, CryptoService, emails no BD)
- Gemini está criando o `EmailsController` com rotas GET/PATCH

## ⚠️ REGRAS DE QUALIDADE OBRIGATÓRIAS

Estas regras são baseadas em problemas reais encontrados nas Sprints anteriores. **Siga rigorosamente.**

### ESLint Strict Mode
O projeto usa ESLint com regras TypeScript strict. Seu código DEVE passar no ESLint sem erros antes da entrega.

**Como validar antes de entregar:**
```bash
cd backend
npx eslint src/crypto/decrypt.interceptor.ts --ext .ts
npx eslint test/security.e2e-spec.ts test/emails.e2e-spec.ts --ext .ts
```

Se PRECISAR desabilitar uma regra em arquivos de teste (`.spec.ts` / `.e2e-spec.ts`), use um eslint-disable no topo do arquivo com as regras específicas:
```typescript
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
```
**Nunca desabilite regras em código de produção sem justificativa.**

### Gitleaks
O pre-commit hook roda Gitleaks. **Não coloque chaves, tokens ou segredos no código.** Para testes que precisam de APP_SECRET, use uma variável gerada no setup do teste (ex: `crypto.randomBytes(32).toString('hex')`), NÃO uma string hardcoded.

### Prettier
O lint-staged roda Prettier automaticamente no commit.

## Estado Atual do Código (referência)

### Módulos existentes:
- `CryptoService` — `src/crypto/crypto.service.ts`
  - `encrypt(plaintext: string): { encrypted: Buffer, iv: string, tag: string }`
  - `decrypt(encrypted: Buffer, iv: string, tag: string): string`
- `JwtAuthGuard` — `src/auth/jwt-auth.guard.ts` (extends AuthGuard('jwt'))
- `JwtStrategy` — `src/auth/jwt.strategy.ts` (extrai Bearer token de Authorization header)
- `AuthService` — `src/auth/auth.service.ts` (login, refresh)
- `PrismaService` — `src/prisma/prisma.service.ts`

### Schema Prisma atual (campos criptografados do Email):
```
from_enc (Bytes) + from_iv (String) + from_tag (String)
to_enc (Bytes) + to_iv (String) + to_tag (String)
subject_enc (Bytes) + subject_iv (String) + subject_tag (String)
body_enc (Bytes) + body_iv (String) + body_tag (String)
```

## Sua Entrega

### 1. Garantir que JwtAuthGuard está funcional
O `JwtAuthGuard` já foi criado na Sprint 1 em `src/auth/jwt-auth.guard.ts`. Verifique que:
- Extrai o Bearer Token do header `Authorization`
- Valida assinatura e expiração
- Injeta o payload do JWT no `request.user`
- Retorna 401 com mensagem clara se token ausente, inválido ou expirado

Se necessário, ajuste para garantir mensagens de erro consistentes:
```typescript
// 401 sem token: { statusCode: 401, message: "Token não fornecido" }
// 401 token inválido: { statusCode: 401, message: "Token inválido ou expirado" }
```

### 2. DecryptInterceptor
Arquivo: `backend/src/crypto/decrypt.interceptor.ts`

Este interceptor age **após** o controller retornar os dados, descriptografando campos criptografados antes de enviar ao client.

**Comportamento:**
```typescript
@Injectable()
export class DecryptInterceptor implements NestInterceptor {
  constructor(private cryptoService: CryptoService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map(data => this.decryptResponse(data))
    );
  }

  private decryptResponse(data: any): any {
    // Se for array (listagem), decripta cada item
    if (data?.data && Array.isArray(data.data)) {
      return {
        ...data,
        data: data.data.map(item => this.decryptEmail(item))
      };
    }
    // Se for objeto único (detalhe)
    if (data?.from_enc) {
      return this.decryptEmail(data);
    }
    return data;
  }

  private decryptEmail(email: any): any {
    const fields = ['from', 'to', 'subject', 'body'];
    const result: any = { ...email };

    for (const field of fields) {
      const encKey = `${field}_enc`;
      const ivKey = `${field}_iv`;
      const tagKey = `${field}_tag`;

      if (result[encKey]) {
        try {
          result[field] = this.cryptoService.decrypt(
            result[encKey],
            result[ivKey],
            result[tagKey]
          );
        } catch {
          result[field] = '[ERRO DE DESCRIPTOGRAFIA]';
        }
        // Remove campos criptografados do response
        delete result[encKey];
        delete result[ivKey];
        delete result[tagKey];
      }
    }
    return result;
  }
}
```

**NOTA:** O `DecryptInterceptor` usa `any` por necessidade (dados dinâmicos do Prisma). Use `eslint-disable` cirúrgico APENAS para este arquivo se necessário, com comentário explicando:
```typescript
// eslint-disable-next-line @typescript-eslint/no-unsafe-... — Prisma retorna dados dinâmicos
```

Exporte o `DecryptInterceptor` do `CryptoModule` para que o Gemini possa usá-lo no controller.

### 3. Rate Limiting
Instale: `npm install @nestjs/throttler`

Configure rate limiting para proteger a API:
```typescript
ThrottlerModule.forRoot([{
  ttl: 60000,    // 1 minuto
  limit: 30,     // 30 requests por minuto
}])
```

Registre no `AppModule` (imports).
Aplique `@UseGuards(ThrottlerGuard)` no controller de emails (ou instrua o Gemini a fazer).

### 4. Helmet & CORS
Instale: `npm install helmet`

No `main.ts` (adicione ANTES da configuração Swagger que o Gemini vai adicionar):
```typescript
import helmet from 'helmet';

app.use(helmet());
app.enableCors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
});
```

Adicione ao `backend/.env.example`:
```env
FRONTEND_URL=http://localhost:5173
```

E ao Joi validation no `AppModule`:
```typescript
FRONTEND_URL: Joi.string().default('http://localhost:5173'),
```

### 5. Testes de Segurança
Arquivo: `backend/test/security.e2e-spec.ts`

Use `@nestjs/testing` + `supertest`:

**Testes de autenticação:**
- [ ] GET /emails sem Authorization header → 401
- [ ] GET /emails com token malformado → 401
- [ ] GET /emails com token expirado → 401
- [ ] GET /emails com token válido → 200
- [ ] PATCH /emails/:id/status sem token → 401
- [ ] POST /emails/sync sem token → 401

**Testes de descriptografia:**
- [ ] GET /emails com token válido retorna campos `from`, `subject` como strings legíveis
- [ ] GET /emails com token válido NÃO retorna campos `*_enc`, `*_iv`, `*_tag`
- [ ] GET /emails/:id retorna campo `body` descriptografado

**Testes de rate limiting:**
- [ ] 31 requests em menos de 1 minuto → 429 Too Many Requests

**Testes de validação:**
- [ ] PATCH /emails/:id/status com body vazio → 400
- [ ] PATCH /emails/:id/status com status inválido → 400
- [ ] GET /emails?limit=999 → respeita max 100

### 6. Testes E2E das Rotas
Arquivo: `backend/test/emails.e2e-spec.ts`

Fluxo completo:
1. Login → obter token
2. GET /emails → lista vazia (ou com seeds)
3. POST /emails/sync → processa emails
4. GET /emails → lista com emails descriptografados
5. GET /emails/:id → detalhe com corpo
6. PATCH /emails/:id/status → atualiza para READ
7. GET /emails?status=READ → filtra corretamente

**ATENÇÃO:** Os testes E2E podem depender do banco real (PostgreSQL). Se o banco não estiver disponível, use mocks consistentes. Para APP_SECRET nos testes, gere dinamicamente:
```typescript
const TEST_APP_SECRET = require('crypto').randomBytes(32).toString('hex');
```

## Critérios de Aceite
- [ ] Todas as rotas protegidas com JWT retornam 401 sem token
- [ ] DecryptInterceptor descriptografa transparentemente
- [ ] Campos `*_enc`, `*_iv`, `*_tag` nunca aparecem no response
- [ ] Rate limiting funciona (429 após exceder limite)
- [ ] CORS configurado para o frontend
- [ ] Helmet ativo (headers de segurança)
- [ ] **ESLint passa sem erros** nos arquivos criados
- [ ] Todos os testes E2E e de segurança passam

## Ordem de Execução
1. Verifique e ajuste JwtAuthGuard
2. Implemente DecryptInterceptor + exporte do CryptoModule
3. Configure Throttler + Helmet + CORS
4. Escreva testes de segurança
5. Escreva testes E2E
6. Rode `npx eslint` nos seus arquivos antes de declarar concluído

## Interface com Gemini
Gemini cria o `EmailsController` e `EmailsService`. O service retorna dados criptografados do Prisma. Seu `DecryptInterceptor` transforma esses dados antes do response. Gemini aplica `@UseGuards(JwtAuthGuard)` e `@UseInterceptors(DecryptInterceptor)` nas rotas.

**Não altere arquivos do Gemini:** `src/emails/` é dele. Você trabalha em `src/crypto/decrypt.interceptor.ts`, `src/auth/`, `test/`, e `main.ts`.

## Branch
Trabalhe na branch: `claude/sprint-03`
