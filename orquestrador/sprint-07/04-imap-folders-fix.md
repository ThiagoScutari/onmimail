# Sprint 7 — Fix: IMAP Multi-Folder + Filtro SINCE
## Release Notes — TechLead

**Projeto:** Omnimail — Monitor de E-mails Contabeis
**Responsavel:** TechLead (Claude Opus)
**Data:** 2026-03-24
**Branch:** `main`
**Status:** Concluida

---

## 1. Resumo

Correcao de dois problemas que impediam a sincronizacao de e-mails da contabilidade:

1. **Filtro UNSEEN**: O IMAP buscava apenas e-mails nao lidos, ignorando e-mails ja lidos em outros clientes
2. **Nome de pasta**: O Outlook usa prefixo `Inbox/` nas subpastas (ex: `Inbox/Contabilidade`, nao `Contabilidade`)

---

## 2. Problema

### 2.1 Filtro UNSEEN
O `fetchFromBox()` usava `imap.search(['UNSEEN', ['SINCE', since]])`. E-mails da pasta "Contabilidade" ja tinham sido lidos no Outlook Web, portanto nao apareciam na busca.

### 2.2 Nome da Pasta
O usuario configurou `Contabilidade` como pasta, mas o nome IMAP real e `Inbox/Contabilidade`. O endpoint `GET /emails/folders` (que lista pastas) ja existia mas nao era utilizado pela UI.

---

## 3. Correcoes

### 3.1 Remocao do filtro UNSEEN
**Arquivo:** `backend/src/imap/imap.service.ts`

```typescript
// Antes
imap.search(['UNSEEN', ['SINCE', since]], ...)

// Depois
imap.search([['SINCE', since]], ...)
```

A deduplicacao por `messageId` (no `EmailProcessorService`) garante que e-mails ja sincronizados nao sejam duplicados.

### 3.2 Configuracao de Pastas
A setting `imap_folders` aceita lista separada por virgula. Default: `INBOX`.

Exemplo configurado:
```
INBOX, Inbox/Contabilidade
```

### 3.3 Endpoint de Listagem de Pastas
Ja existia em `GET /emails/folders` — retorna todas as pastas IMAP disponiveis na conta. Util para o usuario descobrir o nome exato das pastas.

---

## 4. Resultado

Apos a correcao, a sincronizacao encontrou **2 e-mails da contabilidade**:

| Remetente | Assunto | Data |
|-----------|---------|------|
| Etica Contabilidade <contabiletica@hotmail.com> | Guia Simples Nacional 02/2026 | 16/03/2026 |
| Etica Contabilidade <contabiletica@hotmail.com> | Folha 02/2026 | 04/03/2026 |

---

## 5. Configuracao pela UI

Na tela de Settings > Monitoramento:
- **Remetentes monitorados:** `contabiletica@hotmail.com`
- **Pastas IMAP:** `INBOX, Inbox/Contabilidade`

O campo "Pastas IMAP" aceita nomes separados por virgula. Use `GET /emails/folders` para descobrir os nomes exatos.

---

*Documentacao gerada em 2026-03-24 — Sprint 7 IMAP Folders Fix*
