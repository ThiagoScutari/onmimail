# Sprint 2 — Gemini: Conexão IMAP & Parsing de E-mails

## Contexto
Sprint 2 do Omnimail (Scutari & Co). O backend NestJS, Prisma, CryptoService e JWT já estão funcionais (Sprint 1). Agora vamos construir o worker que lê e-mails via IMAP. Sua parte é a conexão IMAP e o parsing dos e-mails.

## Pré-requisito
- Sprint 1 completa (NestJS rodando, PostgreSQL ativo)
- Variáveis IMAP no `.env`: `IMAP_HOST`, `IMAP_PORT`, `IMAP_USER`, `IMAP_PASSWORD`

## Sua Entrega

### 1. ImapService
Arquivo: `backend/src/imap/imap.service.ts`

Dependência: `npm install imap mailparser` + `npm install -D @types/imap`

**Interface pública (Claude vai consumir):**
```typescript
export interface ParsedEmail {
  messageId: string;
  from: string;
  to: string;
  subject: string;
  body: string;       // texto puro (sem HTML) ou resumo
  date: Date;
  hasAttachments: boolean;
}

export interface ImapServiceInterface {
  /**
   * Conecta ao servidor IMAP e retorna e-mails não processados.
   * @param since - Data mínima para buscar (ex: 30 dias atrás)
   * @param senders - Lista de remetentes para filtrar
   * @returns Lista de e-mails parseados
   */
  fetchEmails(since: Date, senders: string[]): Promise<ParsedEmail[]>;

  /**
   * Marca um e-mail como lido no servidor IMAP.
   */
  markAsRead(messageId: string): Promise<void>;
}
```

**Comportamento:**
1. Conecta ao servidor IMAP usando credenciais do `.env`
2. Abre a caixa INBOX em modo read-only (para fetch) ou read-write (para markAsRead)
3. Busca e-mails desde a data `since`
4. Filtra por remetente (campo FROM contém algum dos `senders`)
5. Parseia headers e corpo usando `mailparser`
6. Para o corpo: extrai texto puro. Se só tiver HTML, faz strip de tags e pega os primeiros 500 caracteres
7. Retorna array de `ParsedEmail`
8. Fecha a conexão IMAP ao terminar

**Tratamento de erros:**
- Timeout de conexão: 30 segundos
- Retry: até 3 tentativas com backoff exponencial (1s, 2s, 4s)
- Log claro em caso de falha de autenticação IMAP

### 2. ImapModule
Arquivo: `backend/src/imap/imap.module.ts`

- Exporta `ImapService`
- Injeta `ConfigService` para ler variáveis IMAP

### 3. Filtro por Remetente
O filtro deve ser case-insensitive e suportar:
- Match exato: `contabiletica@hotmail.com`
- Match por domínio: `*@contabilidade.com.br` (se configurado)

Os remetentes monitorados virão de:
1. Variável de ambiente (remetente principal): `MONITORED_SENDERS=contabiletica@hotmail.com`
2. Futuramente, da tabela `Setting` no BD (Sprint 3 adicionará endpoint de config)

### 4. Testes Unitários
Arquivo: `backend/src/imap/imap.service.spec.ts`

Mocke a conexão IMAP (não dependa de servidor real nos testes):
- [ ] `fetchEmails` retorna array de `ParsedEmail` com campos corretos
- [ ] Filtro por remetente funciona (case-insensitive)
- [ ] E-mail sem corpo retorna string vazia
- [ ] E-mail com HTML no corpo extrai texto puro
- [ ] Timeout gera exceção com mensagem clara
- [ ] Retry funciona após falha temporária

## Critérios de Aceite
- [ ] `ImapService.fetchEmails()` retorna e-mails parseados do servidor IMAP
- [ ] Filtro por remetente funciona corretamente
- [ ] Corpo HTML é convertido para texto puro
- [ ] Erros de conexão geram logs claros e retry automático
- [ ] Todos os testes unitários passam
- [ ] Interface `ParsedEmail` é exatamente a definida acima (Claude depende dela)

## Ordem de Execução
1. Instale `imap` e `mailparser`
2. Crie a interface `ParsedEmail` e `ImapServiceInterface`
3. Implemente `ImapService` com conexão e fetch
4. Adicione filtro por remetente
5. Adicione parsing de corpo (texto/HTML)
6. Implemente retry com backoff
7. Escreva testes unitários
8. Teste manualmente com a caixa `thiago.scutari@outlook.com` (com `.env` real)

## Interface com Claude
Claude vai criar `EmailProcessorService` que chama `imapService.fetchEmails()`, criptografa cada campo com `CryptoService`, e salva no banco via Prisma. **Não altere a interface `ParsedEmail` sem alinhar com o TechLead.**

Adicione ao `.env.example`:
```env
MONITORED_SENDERS=contabiletica@hotmail.com
```

## Branch
Trabalhe na branch: `gemini/sprint-02`
