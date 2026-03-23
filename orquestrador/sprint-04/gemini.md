# Sprint 4 — Gemini: React SPA — Componentes de UI

## Contexto
Sprint 4 do Omnimail (Scutari & Co). API backend completa e segura (Sprints 1-3). Agora vamos construir o painel web. Sua parte: inicializar o projeto React e criar os componentes visuais.

## Pré-requisito
- API funcionando: GET /emails, GET /emails/:id, PATCH /emails/:id/status, POST /auth/login
- Claude vai entregar AuthContext e PrivateRoute — você consome

## ⚠️ REGRAS DE QUALIDADE OBRIGATÓRIAS

### ESLint/TypeScript
O projeto raiz já tem `lint-staged` configurado com pattern `frontend/**/*.{ts,tsx}`. Seu código será validado no commit.

**Antes de declarar concluído, rode:**
```bash
cd frontend
npx eslint src/ --ext .ts,.tsx
npx tsc --noEmit
```

### Sem segredos hardcoded
Gitleaks roda no pre-commit. Não coloque URLs de API ou tokens no código — use variáveis de ambiente (`VITE_API_URL`).

## Estado Atual do Backend (referência)

### Endpoints disponíveis:
| Método | Rota | Auth | Response |
|--------|------|------|----------|
| POST | /auth/login | Não | `{ accessToken: string, refreshToken: string }` |
| POST | /auth/refresh | Não | `{ accessToken: string, refreshToken: string }` |
| GET | /emails | JWT | `{ data: Email[], meta: { total, page, limit, totalPages } }` |
| GET | /emails/:id | JWT | `EmailDetail` (com body descriptografado) |
| PATCH | /emails/:id/status | JWT | `{ id, status, updatedAt }` |
| POST | /emails/sync | JWT | `{ processed: number, message: string }` |

### Campos do Email (já descriptografados pelo backend):
```typescript
// Na listagem (GET /emails)
{ id, from, subject, date, status, hasAttachments, createdAt }

// No detalhe (GET /emails/:id)
{ id, from, to, subject, body, date, status, hasAttachments, createdAt }
```

### Swagger:
Documentação completa em `http://localhost:3000/api/docs`

## Sua Entrega

### 1. React Project Init
Inicialize em `frontend/`:
```bash
cd frontend
npm create vite@latest . -- --template react-ts
npm install
npm install axios react-router-dom @tanstack/react-query
npm install -D tailwindcss @tailwindcss/vite
```

**NOTA:** Use `.` (ponto) para criar no diretório atual, não crie uma subpasta.

Configure TailwindCSS com o plugin Vite no `vite.config.ts`:
```typescript
import tailwindcss from '@tailwindcss/vite';
// adicione tailwindcss() no array plugins
```

No `src/index.css`:
```css
@import "tailwindcss";
```

### 2. Estrutura de Pastas
```
frontend/src/
├── components/
│   ├── EmailList.tsx
│   ├── EmailRow.tsx
│   ├── EmailPreview.tsx
│   ├── StatusBadge.tsx
│   ├── Pagination.tsx
│   ├── Header.tsx
│   └── Layout.tsx
├── pages/
│   ├── DashboardPage.tsx
│   ├── LoginPage.tsx        # Claude entrega
│   └── NotFoundPage.tsx
├── hooks/
│   ├── useEmails.ts
│   └── useEmailDetail.ts
├── services/
│   ├── api.ts              # Claude entrega — configura com interceptor JWT
│   └── emailApi.ts         # Claude entrega — funções de chamada à API
├── contexts/
│   └── AuthContext.tsx      # Claude entrega
├── types/
│   └── email.ts
├── App.tsx
└── main.tsx
```

### 3. Types
Arquivo: `frontend/src/types/email.ts`
```typescript
export type EmailStatus = 'UNREAD' | 'READ' | 'RESPONDED';

export interface Email {
  id: string;
  from: string;
  subject: string;
  date: string;
  status: EmailStatus;
  hasAttachments: boolean;
  createdAt: string;
}

export interface EmailDetail extends Email {
  to: string;
  body: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
```

### 4. Hooks (React Query)
Arquivo: `frontend/src/hooks/useEmails.ts`
```typescript
// useEmails(page, limit, status?) → PaginatedResponse<Email>
// Usa @tanstack/react-query para cache e refetch automático
// Refetch a cada 5 minutos
// Importa emailApi de '../services/emailApi'
```

Arquivo: `frontend/src/hooks/useEmailDetail.ts`
```typescript
// useEmailDetail(id) → EmailDetail
// Importa emailApi de '../services/emailApi'
```

### 5. Componentes

#### EmailList
- Tabela com colunas: Status | Remetente | Assunto | Data | Ações
- Ordenação por data (mais recentes primeiro)
- Linhas não lidas com fundo destacado (ex: bg-blue-50)
- Clique na linha abre EmailPreview

#### EmailRow
- Uma linha da tabela
- Exibe `StatusBadge`, remetente, assunto truncado (max 60 chars), data formatada
- Ícone de anexo se `hasAttachments`

#### StatusBadge
- UNREAD: badge vermelho "Não lido"
- READ: badge cinza "Lido"
- RESPONDED: badge verde "Respondido"

#### EmailPreview
- Modal ou drawer lateral
- Exibe: remetente, destinatário, assunto, data, corpo completo
- Botões: "Marcar como Lido", "Marcar como Respondido"
- Ao abrir, automaticamente muda status para READ via PATCH
- Usa `emailApi.updateStatus()` do Claude

#### Pagination
- Navegação: Anterior | Página X de Y | Próxima
- Seletor de itens por página (10, 20, 50)

#### Header
- Logo/título "Omnimail"
- Última sincronização (horário)
- Botão "Sincronizar agora" (chama `emailApi.syncEmails()`)
- Botão de logout (chama `useAuth().logout()`)

#### Layout
- Header fixo no topo
- Content area com padding

### 6. DashboardPage
Composição:
```tsx
<Layout>
  <Header />
  <FilterBar /> {/* status filter + date range */}
  <EmailList />
  <Pagination />
  <EmailPreview /> {/* modal, aberto condicionalmente */}
</Layout>
```

### 7. Responsividade
- Desktop: tabela completa
- Mobile (< 768px): cards empilhados em vez de tabela
- EmailPreview: drawer full-screen no mobile, modal no desktop

### 8. NotFoundPage
Página 404 simples com link para dashboard.

## Critérios de Aceite
- [ ] `npm run dev` sobe o frontend sem erros
- [ ] Dashboard exibe lista de e-mails da API
- [ ] StatusBadge exibe cores corretas por status
- [ ] EmailPreview abre com detalhes completos
- [ ] Botões de status funcionam (PATCH na API)
- [ ] Paginação funciona
- [ ] Responsivo em mobile e desktop
- [ ] Botão "Sincronizar agora" funciona
- [ ] **ESLint + TypeScript passam sem erros**

## Interface com Claude
Claude entrega:
- `AuthContext` com `useAuth()` → `{ user, isAuthenticated, isLoading, login, logout }`
- `PrivateRoute` que redireciona para /login se não autenticado
- `api.ts` com axios configurado (baseURL, interceptor JWT, refresh automático)
- `emailApi.ts` com funções: `getEmails()`, `getEmailById()`, `updateStatus()`, `syncEmails()`
- `LoginPage.tsx`

Você consome esses módulos. **Não crie arquivos que são responsabilidade do Claude** (api.ts, AuthContext, LoginPage, PrivateRoute, emailApi.ts).

Se precisar deles antes do Claude entregar, crie stubs temporários:
```typescript
// stub temporário para api.ts
import axios from 'axios';
const api = axios.create({ baseURL: 'http://localhost:3000' });
export default api;
```

## Branch
Trabalhe na branch: `gemini/sprint-04`
