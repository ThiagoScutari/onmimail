# Sprint 5 — Hotfix: Tela de Configurações (SettingsPage)

## Contexto
A Sprint 5 foi entregue com sucesso, porém a **SettingsPage.tsx** não foi implementada. O backend já possui os endpoints prontos (GET /settings, PUT /settings/:key, POST /settings/telegram/test). Falta apenas o frontend.

## Branch
Trabalhe na branch: `gemini/sprint-05-settings`

## Sua Entrega

### 1. SettingsPage.tsx
Arquivo: `frontend/src/pages/SettingsPage.tsx`

Crie uma página `/settings` acessível pelo Header (ícone de engrenagem ou link "Configurações"). Protegida por `PrivateRoute` (mesma lógica do `/dashboard`).

#### Layout da Página
Seções com cards/formulários:

**Seção 1 — Telegram**
- Campo `Bot Token` (type=password, nunca exibir o valor completo, mostrar `***CONFIGURED***` se já configurado)
- Campo `Chat ID` (type=text)
- Botão **"Enviar Teste"** → chama `POST /settings/telegram/test`
  - Sucesso: toast/badge verde "Mensagem de teste enviada!"
  - Falha: toast/badge vermelho com mensagem de erro
- Botão **"Salvar"** → chama `PUT /settings/telegram_bot_token` e `PUT /settings/telegram_chat_id`

**Seção 2 — Monitoramento**
- Campo `Remetentes monitorados` (textarea, um por linha)
- Campo `Intervalo de sincronização` (select: 1h, 2h, 4h, 8h, 12h)
- Botão **"Salvar"**

**Seção 3 — Conexão IMAP**
- Campo `Host` (type=text)
- Campo `Porta` (type=number, default 993)
- Campo `Usuário/Email` (type=email)
- Campo `Senha` (type=password, mostrar `***CONFIGURED***` se já configurado)
- Checkbox `TLS` (default: checked)
- Botão **"Salvar"**

#### Regras de segurança na UI
- **NUNCA** exibir tokens/senhas completos. Campos de segredo mostram `***CONFIGURED***` quando já possuem valor
- Ao salvar um campo de segredo, só enviar se o usuário digitou algo novo (não reenviar `***CONFIGURED***`)
- Campos de segredo usam `type="password"` com toggle de visibilidade (ícone olho)
- Feedback visual para cada ação (loading spinner no botão, toast de sucesso/erro)

### 2. Service
Arquivo: `frontend/src/services/settingsApi.ts`
```typescript
export const settingsApi = {
  getAll: () => api.get('/settings').then(r => r.data),
  update: (key: string, value: string) => api.put(`/settings/${key}`, { value }).then(r => r.data),
  testTelegram: () => api.post('/settings/telegram/test').then(r => r.data),
};
```

### 3. Rota
Registre no `App.tsx` dentro do `PrivateRoute`:
```tsx
<Route path="/settings" element={<SettingsPage />} />
```

Adicione link no `Header.tsx` (ícone Settings do lucide-react).

### 4. Testes
- [ ] Página renderiza com seções Telegram, Monitoramento, IMAP
- [ ] Campo de token exibe `***CONFIGURED***` quando há valor
- [ ] Botão "Enviar Teste" chama endpoint correto
- [ ] Salvar envia PUT para cada campo alterado
- [ ] Campos vazios não são enviados ao salvar

## Critérios de Aceite
- [ ] Tela de configurações funciona e salva dados via API
- [ ] Campos sensíveis nunca exibem valor completo na UI
- [ ] Botão "Enviar Teste" do Telegram funciona
- [ ] Rota `/settings` protegida por PrivateRoute
- [ ] Link no Header funciona
- [ ] ESLint + TSC: 0 erros
- [ ] Todos os testes passam

## Endpoints disponíveis (backend já pronto)
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | /settings | Retorna todas as configs (tokens mascarados) |
| PUT | /settings/:key | Atualiza uma config (valor criptografado no BD) |
| POST | /settings/telegram/test | Envia mensagem de teste no Telegram |

## Chaves de configuração aceitas
- `telegram_bot_token`, `telegram_chat_id`
- `monitored_senders`, `sync_interval_hours`
- `imap_host`, `imap_port`, `imap_user`, `imap_password`, `imap_tls`
