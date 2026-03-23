# Sprint 4 — Gemini: React SPA — Componentes de UI

## Contexto
Sprint 4 do Omnimail (Scutari & Co). API backend completa e segura (Sprints 1-3). Agora vamos construir o painel web. Sua parte: inicializar o projeto React e criar os componentes visuais.

## Pré-requisito
- API funcionando: GET /emails, GET /emails/:id, PATCH /emails/:id/status, POST /auth/login
- Claude vai entregar AuthContext e PrivateRoute — você consome

## Sua Entrega

### 1. React Project Init
Inicialize em `frontend/`:
```bash
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
npm install axios react-router-dom @tanstack/react-query
npm install -D tailwindcss @tailwindcss/vite
```

Configure TailwindCSS com o plugin Vite.

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
│   └── api.ts              # Claude configura com interceptor JWT
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
```

Arquivo: `frontend/src/hooks/useEmailDetail.ts`
```typescript
// useEmailDetail(id) → EmailDetail
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

#### Pagination
- Navegação: Anterior | Página X de Y | Próxima
- Seletor de itens por página (10, 20, 50)

#### Header
- Logo/título "Omnimail"
- Última sincronização (horário)
- Botão "Sincronizar agora" (chama POST /emails/sync)
- Botão de logout

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

## Interface com Claude
Claude entrega:
- `AuthContext` com `login()`, `logout()`, `isAuthenticated`, `token`
- `PrivateRoute` que redireciona para /login se não autenticado
- `api.ts` com axios configurado (baseURL, interceptor JWT, refresh automático)

Você consome esses módulos. Use `useAuth()` do AuthContext para verificar autenticação e obter o token.

## Branch
Trabalhe na branch: `gemini/sprint-04`
