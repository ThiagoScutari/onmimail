# Sprint 7 — OAuth2 XOAUTH2 para IMAP (Microsoft Outlook)
## Release Notes — TechLead

**Projeto:** Omnimail — Monitor de E-mails Contabeis
**Responsavel:** TechLead (Claude Opus)
**Data:** 2026-03-24
**Branch:** `main`
**Status:** Concluida

---

## 1. Resumo Executivo

Implementacao completa do fluxo OAuth2 com Microsoft Entra ID (Azure AD) para autenticacao IMAP via XOAUTH2. Substitui o login por senha por um fluxo Authorization Code com `ConfidentialClientApplication` (MSAL Node), permitindo acesso seguro a caixas de e-mail do Outlook sem armazenar senhas.

---

## 2. Motivacao

O Outlook/Microsoft 365 descontinuou autenticacao basica (login/senha) para IMAP. O acesso agora exige OAuth2 com tokens de acesso. Alem disso, armazenar senhas de e-mail (mesmo criptografadas) e menos seguro do que tokens com escopo limitado e renovacao automatica.

---

## 3. Configuracao no Azure AD

### 3.1 Registro do Aplicativo
- **Nome:** Omnimail Monitor
- **Client ID:** `da350d77-15d8-451d-b743-12c71dd03375`
- **Tenant ID:** `3146be8e-e4da-4ee6-8a9d-6e3185251290`
- **Tipo de conta:** Qualquer Locatario + Contas Pessoais
- **Plataforma:** Web (nao SPA)
- **Redirect URI:** `http://localhost:5173/settings/oauth/callback`

### 3.2 Permissoes (Microsoft Graph - Delegadas)
- `IMAP.AccessAsUser.All` — Leitura/escrita de caixas de email via IMAP
- `User.Read` — Leitura do perfil do usuario
- `offline_access` — Refresh token para renovacao automatica

### 3.3 Decisao: Web vs SPA
Tentativa inicial com plataforma SPA exigia PKCE e nao suportava `clientSecret` no backend (`ConfidentialClientApplication`). A mudanca para plataforma **Web** permite o fluxo Authorization Code com `clientSecret` no servidor, que e o padrao para aplicacoes backend.

---

## 4. Arquitetura do Fluxo

```
1. Usuario clica "Conectar Outlook" na SettingsPage
2. Frontend chama GET /oauth/authorize
3. Backend (MSAL) gera URL de autorizacao da Microsoft
4. Frontend redireciona (window.location.href) para login.microsoftonline.com
5. Usuario autoriza no portal da Microsoft
6. Microsoft redireciona para /settings/oauth/callback?code=XXX
7. OAuthCallbackPage extrai o code da URL
8. Frontend chama POST /oauth/callback { code }
9. Backend troca code por tokens via MSAL acquireTokenByCode
10. Token cache serializado e criptografado na tabela Setting
11. Proxima sincronizacao IMAP usa XOAUTH2 com access_token
```

---

## 5. Arquivos Criados/Modificados

### Backend
| Arquivo | Descricao |
|---------|-----------|
| `src/oauth/oauth.service.ts` | MSAL ConfidentialClientApplication, getAuthorizationUrl, exchangeCodeForTokens, getAccessToken, buildXOAuth2Token, isConnected, disconnect |
| `src/oauth/oauth.controller.ts` | GET /oauth/authorize, POST /oauth/callback, GET /oauth/status, POST /oauth/disconnect |
| `src/oauth/oauth.module.ts` | Importa CryptoModule, PrismaModule |
| `src/oauth/dto/oauth-callback.dto.ts` | Validacao do code e provider |
| `src/imap/imap.service.ts` | getConfig() verifica oauthService.isConnected() e usa XOAUTH2 se disponivel |

### Frontend
| Arquivo | Descricao |
|---------|-----------|
| `src/pages/OAuthCallbackPage.tsx` | Extrai code da URL (query string + hash fragment), chama POST /oauth/callback |
| `src/pages/SettingsPage.tsx` | Secao OAuth2 com campos Client ID, Tenant ID, Client Secret, botao "Conectar Outlook" |
| `src/services/settingsApi.ts` | oauthAuthorize(), oauthCallback(), oauthStatus(), oauthDisconnect() |
| `src/App.tsx` | Rota /settings/oauth/callback (fora do PrivateRoute) |

---

## 6. Tokens e Seguranca

| Item | Detalhe |
|------|---------|
| Client Secret | Criptografado AES-256-GCM na tabela Setting |
| Token Cache | Serializado pelo MSAL, criptografado e salvo como `oauth_refresh_token` |
| Access Token | Obtido via `acquireTokenSilent` (renovacao automatica) |
| XOAUTH2 | `base64(user=EMAIL\x01auth=Bearer TOKEN\x01\x01)` |
| Mascaramento | Client Secret e token cache mascarados no GET /settings |

---

## 7. Problemas Encontrados e Solucoes

| Problema | Causa | Solucao |
|----------|-------|---------|
| "Codigo de autorizacao nao encontrado na URL" | Frontend abria popup que era bloqueado pelo navegador | Mudou para `window.location.href` (redirect) |
| "Invalid client secret" (AADSTS7000215) | Usuario copiou o ID do segredo em vez do Valor | Documentacao clara + novo segredo criado |
| Plataforma SPA nao aceita clientSecret | MSAL ConfidentialClientApplication requer plataforma Web | Deletou SPA no Azure, adicionou Web |
| Token refresh falha apos reconexao | Cache antigo persistia com tokens invalidos | Disconnect limpa oauth_refresh_token do banco |

---

## 8. Como Configurar (Guia Rapido)

1. Criar app no Azure Portal > Entra ID > Registros de aplicativo
2. Plataforma: **Web**, Redirect URI: `http://localhost:5173/settings/oauth/callback`
3. Permissoes: `IMAP.AccessAsUser.All`, `User.Read` (Microsoft Graph, Delegadas)
4. Criar Client Secret (copiar o **Valor**, nao o ID)
5. No Omnimail: Settings > OAuth2 > Preencher Client ID, Tenant ID, Client Secret
6. Clicar "Conectar Outlook" > Autorizar na Microsoft
7. Status muda para "Conectado" > Sincronizar funciona via XOAUTH2

---

*Documentacao gerada em 2026-03-24 — Sprint 7 OAuth2 Microsoft*
