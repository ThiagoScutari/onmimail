# Sprint 3 — Claude: JWT Guard, DecryptInterceptor & Testes de Segurança

## Contexto
Sprint 3 do Omnimail (Scutari & Co). Backend funcional com e-mails criptografados no BD. Agora vamos expor a API REST de forma segura. Sua parte: proteção das rotas e descriptografia transparente dos dados.

## Pré-requisito
- Sprints 1-2 completas (JWT Auth, CryptoService, emails no BD)
- Gemini está criando o `EmailsController` com rotas GET/PATCH

## Sua Entrega

### 1. Garantir que JwtAuthGuard está funcional
O `JwtAuthGuard` já foi criado na Sprint 1. Verifique que:
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

Aplique globalmente nas rotas de emails ou via `@UseInterceptors(DecryptInterceptor)` no controller.

### 3. Rate Limiting
Instale: `npm install @nestjs/throttler`

Configure rate limiting para proteger a API:
```typescript
ThrottlerModule.forRoot([{
  ttl: 60000,    // 1 minuto
  limit: 30,     // 30 requests por minuto
}])
```

Aplique `@UseGuards(ThrottlerGuard)` no controller de emails.

### 4. Helmet & CORS
Instale: `npm install helmet`

No `main.ts`:
```typescript
app.use(helmet());
app.enableCors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
});
```

Adicione ao `.env.example`:
```env
FRONTEND_URL=http://localhost:5173
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

## Critérios de Aceite
- [ ] Todas as rotas protegidas com JWT retornam 401 sem token
- [ ] DecryptInterceptor descriptografa transparentemente
- [ ] Campos `*_enc`, `*_iv`, `*_tag` nunca aparecem no response
- [ ] Rate limiting funciona (429 após exceder limite)
- [ ] CORS configurado para o frontend
- [ ] Helmet ativo (headers de segurança)
- [ ] Todos os testes E2E e de segurança passam

## Ordem de Execução
1. Verifique e ajuste JwtAuthGuard
2. Implemente DecryptInterceptor
3. Configure Throttler + Helmet + CORS
4. Escreva testes de segurança
5. Escreva testes E2E
6. Valide com curl/Postman que tudo funciona

## Interface com Gemini
Gemini cria o `EmailsController` e `EmailsService`. O service retorna dados criptografados do Prisma. Seu `DecryptInterceptor` transforma esses dados antes do response. Gemini aplica `@UseGuards(JwtAuthGuard)` e `@UseInterceptors(DecryptInterceptor)` nas rotas.

## Branch
Trabalhe na branch: `claude/sprint-03`
