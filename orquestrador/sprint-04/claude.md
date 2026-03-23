# Sprint 4 — Claude: Auth Flow Frontend + API Layer

## Contexto
Sprint 4 do Omnimail (Scutari & Co). API backend completa (Sprints 1-3). Agora vamos construir o painel web. Sua parte: todo o fluxo de autenticação no frontend e a camada de comunicação com a API.

## Pré-requisito
- API rodando: POST /auth/login, POST /auth/refresh, rotas protegidas com JWT
- Gemini vai inicializar o React project em `frontend/` com Vite + React-TS + TailwindCSS

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
Gitleaks roda no pre-commit. Não coloque tokens, chaves ou URLs fixas no código — use `import.meta.env.VITE_API_URL`.

Para testes que precisam de tokens JWT, gere mocks — não use tokens reais.

## Estado Atual do Backend (referência)

### Endpoints de Auth:
```
POST /auth/login
  Body: { email: string, password: string }  (password min 6 chars)
  Response 200: { accessToken: string, refreshToken: string }
  Response 401: { statusCode: 401, message: "Token inválido ou expirado" }

POST /auth/refresh
  Body: { refreshToken: string }
  Response 200: { accessToken: string, refreshToken: string }
  Response 401: (se refresh token inválido)
```

### JWT Payload (decodificado):
```typescript
{
  sub: string;     // user ID (uuid)
  email: string;   // user email
  iat: number;     // issued at
  exp: number;     // expiration (15min para accessToken, 7d para refreshToken)
}
```

### Endpoints protegidos (requerem Bearer token):
| Método | Rota | Response |
|--------|------|----------|
| GET | /emails | `{ data: Email[], meta: { total, page, limit, totalPages } }` |
| GET | /emails/:id | `EmailDetail` |
| PATCH | /emails/:id/status | `{ id, status, updatedAt }` |
| POST | /emails/sync | `{ processed, message }` |

### CORS:
O backend aceita requests de `http://localhost:5173` (porta padrão do Vite).

## Sua Entrega

### 1. API Service Layer
Arquivo: `frontend/src/services/api.ts`

Configure axios com:
```typescript
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor: adiciona Bearer token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor: refresh automático em 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const refreshToken = localStorage.getItem('refreshToken');
        const { data } = await axios.post(
          `${api.defaults.baseURL}/auth/refresh`,
          { refreshToken }
        );
        localStorage.setItem('accessToken', data.accessToken);
        originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(originalRequest);
      } catch {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
```

Crie `frontend/.env.example`:
```env
VITE_API_URL=http://localhost:3000
```

E `frontend/.gitignore` deve incluir `.env` (Vite templates geralmente já incluem).

### 2. AuthContext
Arquivo: `frontend/src/contexts/AuthContext.tsx`

```typescript
interface AuthContextType {
  user: { email: string } | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}
```

Comportamento:
- `login()`: chama POST /auth/login, armazena `accessToken` e `refreshToken` no localStorage, decodifica JWT para obter email (use `atob()` ou lib como `jwt-decode` — escolha livre)
- `logout()`: limpa tokens, redireciona para /login
- `isAuthenticated`: true se accessToken existe e não expirou
- `isLoading`: true durante verificação inicial (page load)
- No mount, verifica se o token armazenado ainda é válido (checa expiração)

**Hook exportado:** `useAuth()` — Gemini vai importar isso

### 3. PrivateRoute
Arquivo: `frontend/src/components/PrivateRoute.tsx`

```typescript
// Se isLoading → exibe spinner/loading
// Se !isAuthenticated → Navigate to="/login"
// Se isAuthenticated → renderiza Outlet (react-router-dom)
```

### 4. LoginPage
Arquivo: `frontend/src/pages/LoginPage.tsx`

- Formulário centrado na tela: email + password + botão "Entrar"
- Validação client-side: email obrigatório (formato válido), password obrigatório (min 6 chars)
- Em caso de erro 401: exibe mensagem "Credenciais inválidas"
- Se já autenticado (`isAuthenticated === true`), redireciona para /dashboard
- Design limpo com TailwindCSS
- Loading state no botão durante requisição

### 5. Router Setup
Arquivo: `frontend/src/App.tsx`

```typescript
<BrowserRouter>
  <AuthProvider>
    <QueryClientProvider client={queryClient}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<PrivateRoute />}>
          <Route path="/" element={<Navigate to="/dashboard" />} />
          <Route path="/dashboard" element={<DashboardPage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </QueryClientProvider>
  </AuthProvider>
</BrowserRouter>
```

**NOTA:** Inclua o `QueryClientProvider` do `@tanstack/react-query` aqui — Gemini vai usar nos hooks dele.

### 6. API Functions
Arquivo: `frontend/src/services/emailApi.ts`

```typescript
import api from './api';
import { PaginatedResponse, Email, EmailDetail } from '../types/email';

export const emailApi = {
  getEmails: (params: { page?: number; limit?: number; status?: string }) =>
    api.get<PaginatedResponse<Email>>('/emails', { params }),

  getEmailById: (id: string) =>
    api.get<EmailDetail>(`/emails/${id}`),

  updateStatus: (id: string, status: string) =>
    api.patch<{ id: string; status: string; updatedAt: string }>(`/emails/${id}/status`, { status }),

  syncEmails: () =>
    api.post<{ processed: number; message: string }>('/emails/sync'),
};
```

**NOTA:** Use genéricos do axios (`api.get<T>`) para tipagem forte. O Gemini vai importar `emailApi` nos hooks dele.

### 7. Testes
Arquivo: `frontend/src/__tests__/auth.test.tsx`

Use `vitest` + `@testing-library/react` (Vite já configura vitest):
```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

Configure `vitest` no `vite.config.ts`:
```typescript
/// <reference types="vitest" />
test: {
  globals: true,
  environment: 'jsdom',
}
```

Testes:
- [ ] Login com credenciais válidas armazena tokens e redireciona
- [ ] Login com credenciais inválidas exibe mensagem de erro
- [ ] Logout limpa tokens e redireciona para /login
- [ ] PrivateRoute redireciona para /login se não autenticado
- [ ] PrivateRoute renderiza conteúdo se autenticado
- [ ] Token refresh funciona quando access token expira
- [ ] API interceptor adiciona Bearer token em requests

## Critérios de Aceite
- [ ] Login funcional (email + password → tokens → dashboard)
- [ ] Logout limpa estado e redireciona
- [ ] Rotas protegidas redirecionam para /login
- [ ] Token refresh automático em 401
- [ ] API service funciona com todas as rotas do backend
- [ ] **ESLint + TypeScript passam sem erros**
- [ ] Testes passam

## Ordem de Execução
1. Espere o Gemini inicializar o projeto React (ou crie os arquivos na estrutura já existente)
2. Crie `api.ts` com interceptors
3. Crie `AuthContext` com login/logout
4. Crie `PrivateRoute`
5. Crie `LoginPage`
6. Configure router em `App.tsx`
7. Crie `emailApi.ts`
8. Escreva testes
9. Valide com `npx eslint` e `npx tsc --noEmit`

## Interface com Gemini
Gemini cria os componentes visuais (EmailList, EmailPreview, etc.) e os hooks (useEmails, useEmailDetail). Ele vai importar:
- `useAuth()` do seu AuthContext
- `emailApi` do seu `emailApi.ts`

**Não altere arquivos do Gemini:** `src/components/` (exceto PrivateRoute), `src/pages/DashboardPage.tsx`, `src/pages/NotFoundPage.tsx`, `src/hooks/` são dele.

Você trabalha em: `src/services/`, `src/contexts/`, `src/components/PrivateRoute.tsx`, `src/pages/LoginPage.tsx`, `src/App.tsx`, `src/__tests__/`.

## Branch
Trabalhe na branch: `claude/sprint-04`
