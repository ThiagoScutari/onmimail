# Sprint 4 — Claude: Auth Flow Frontend + API Layer

## Contexto
Sprint 4 do Omnimail (Scutari & Co). API backend completa (Sprints 1-3). Agora vamos construir o painel web. Sua parte: todo o fluxo de autenticação no frontend e a camada de comunicação com a API.

## Pré-requisito
- API rodando: POST /auth/login, POST /auth/refresh, rotas protegidas
- Gemini vai inicializar o React project em `frontend/`

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
        // Refresh falhou — limpa tokens e redireciona
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

Adicione ao `frontend/.env.example`:
```env
VITE_API_URL=http://localhost:3000
```

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
- `login()`: chama POST /auth/login, armazena tokens no localStorage, decodifica JWT para obter email
- `logout()`: limpa tokens, redireciona para /login
- `isAuthenticated`: true se accessToken existe e não expirou
- `isLoading`: true durante verificação inicial (page load)
- No mount, verifica se o token armazenado ainda é válido

### 3. PrivateRoute
Arquivo: `frontend/src/components/PrivateRoute.tsx`

```typescript
// Se isLoading → exibe spinner
// Se !isAuthenticated → Navigate to="/login"
// Se isAuthenticated → renderiza children (Outlet)
```

### 4. LoginPage
Arquivo: `frontend/src/pages/LoginPage.tsx`

- Formulário centrado na tela: email + password + botão "Entrar"
- Validação client-side: email obrigatório, password obrigatório
- Em caso de erro 401: exibe mensagem "Credenciais inválidas"
- Se já autenticado, redireciona para /dashboard
- Design limpo com TailwindCSS

### 5. Router Setup
Arquivo: `frontend/src/App.tsx`

```typescript
<BrowserRouter>
  <AuthProvider>
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<PrivateRoute />}>
        <Route path="/" element={<Navigate to="/dashboard" />} />
        <Route path="/dashboard" element={<DashboardPage />} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  </AuthProvider>
</BrowserRouter>
```

### 6. API Functions
Arquivo: `frontend/src/services/emailApi.ts`

```typescript
export const emailApi = {
  getEmails: (params: { page?: number; limit?: number; status?: string }) =>
    api.get('/emails', { params }),

  getEmailById: (id: string) =>
    api.get(`/emails/${id}`),

  updateStatus: (id: string, status: string) =>
    api.patch(`/emails/${id}/status`, { status }),

  syncEmails: () =>
    api.post('/emails/sync'),
};
```

### 7. Testes
Arquivo: `frontend/src/__tests__/auth.test.tsx`

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
- [ ] Testes passam

## Ordem de Execução
1. Crie `api.ts` com interceptors
2. Crie `AuthContext` com login/logout
3. Crie `PrivateRoute`
4. Crie `LoginPage`
5. Configure router em `App.tsx`
6. Crie `emailApi.ts`
7. Escreva testes
8. Integre com os componentes do Gemini

## Interface com Gemini
Gemini cria os componentes visuais (EmailList, EmailPreview, etc.) e os hooks (useEmails, useEmailDetail). Ele vai importar:
- `useAuth()` do seu AuthContext
- `api` do seu `api.ts`
- `emailApi` das funções da API

**Entregue AuthContext e api.ts primeiro** para que Gemini possa integrá-los.

## Branch
Trabalhe na branch: `claude/sprint-04`
