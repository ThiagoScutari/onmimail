# Omnimail - Monitor de E-mails Contábeis

## Sobre o Projeto

Sistema de automação para leitura, alerta e controle de status de e-mails contábeis da empresa DRX Têxtil. O objetivo principal é garantir que prazos de pagamento de guias e obrigações fiscais/tributárias não sejam perdidos, evitando juros e multas.

## Stack Tecnológica

- **Backend:** Node.js (NestJS) ou Python (FastAPI)
- **Frontend:** React SPA
- **Banco de Dados:** PostgreSQL com colunas criptografadas (AES-256-GCM) via ORM (Prisma/TypeORM/SQLAlchemy)
- **Mensageria:** Telegram Bot + WhatsApp (Evolution API via Docker ou Z-API)
- **Autenticação:** JWT com Bearer Token / OAuth2
- **CI/CD:** Pipeline com Gitleaks/TruffleHog para detecção de segredos

## Arquitetura

O sistema possui três camadas:

1. **Coleta (Worker IMAP):** Cronjob que acessa a caixa de entrada via IMAP, filtra por remetentes configurados e aplica labels
2. **API REST (Backend):** Endpoints autenticados (JWT Guard) que descriptografam dados em memória antes de retornar ao frontend
3. **Painel Web (React SPA):** Lista de e-mails urgentes com status, preview e acesso direto ao e-mail original
4. **Alertas (Telegram/WhatsApp):** Notificações com dados mínimos, direcionando ao painel para detalhes

## Segurança (Zero Trust)

- **Zero Hardcoded:** Nenhum segredo em código-fonte. Tudo via variáveis de ambiente
- **Criptografia em repouso:** Campos sensíveis (remetente, destinatário, assunto, corpo, anexos) criptografados com AES-256-GCM no banco
- **Descriptografia em memória:** Dados são descriptografados apenas na RAM do backend, nunca expostos no BD
- **Chave-mestra:** `APP_SECRET` injetado exclusivamente via variável de ambiente
- **Pre-commit hooks:** Scanners automáticos (Gitleaks/TruffleHog) bloqueiam push com segredos

## Princípios de Design (SOLID)

- **SRP:** Cada classe tem responsabilidade única (ex: MonitorIMAP não decripta, CryptoService não persiste)
- **OCP:** Novos providers de mensageria (SMS, etc.) sem alterar o core
- **DIP:** Componentes de segurança, mensageria e armazenamento implementam interfaces, resolvidas por injeção de dependência

## Estrutura do Repositório

```
omnimail/
├── CLAUDE.md
├── docs/                          # Documentação do projeto
│   ├── monitor_contabilidade.md   # Análise inicial da solução
│   └── projeto_detalhado_v2.md    # Especificação técnica v2
├── backup/                        # Versões anteriores de documentos
├── sprints/                       # Artefatos por sprint (PRs, release notes, diagramas)
│   ├── Sprint_01_Foundation/
│   ├── Sprint_02_CryptoWorker/
│   ├── Sprint_03_AuthAPI/
│   ├── Sprint_04_SecuredWebPanel/
│   ├── Sprint_05_Messaging/
│   └── Sprint_06_Deploy/
```

## Plano de Sprints

| Sprint | Foco | Entrega |
|--------|------|---------|
| 1 | Fundação & Security Zero Trust | Setup repo, linter, pre-commit, ORM, CryptoService, JWT Auth |
| 2 | Motor IMAP Criptografado (Worker) | Cronjob IMAP + criptografia antes do save |
| 3 | API Endpoint Seguro | Rotas GET/POST com JWT Guard + descriptografia |
| 4 | Painel Web Autenticado | React SPA com redirect `/login` para rotas protegidas |
| 5 | Alertas (Mensageria) | Telegram/WhatsApp com dados mínimos |
| 6 | Testes Regressivos e Deploy | E2E, validação anti-SQL injection, deploy |

## Configurações Monitoradas

- **Caixa monitorada:** thiago.scutari@outlook.com
- **Remetente principal:** contabiletica@hotmail.com
- **Frequência de verificação:** A cada 4 horas
- **Período retroativo inicial:** 30 dias

## Comandos Úteis

```bash
# (a ser preenchido conforme o código for desenvolvido)
```

## Convenções

- Cada sprint finalizada gera pasta própria em `sprints/` com Release Notes e PR documentado
- Releases parciais funcionais: cada sprint entrega valor independente
- Commits devem passar por scanner de segredos antes do push
- Variáveis sensíveis nunca em código, sempre em `.env` (que deve estar no `.gitignore`)
