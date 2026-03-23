# Projeto: Monitor de E-mails Contábeis (Omnimail) - Versão 2

## 1. Visão Geral
Sistema focado na automação de leitura, alerta e status de e-mails contábeis, garantindo que os prazos de pagamentos de guias e obrigações não sejam perdidos. O sistema se conectará ativamente em caixas de entrada e disparará alertas seguros sobre novas pendências.

**Foco da V2:** Introdução de Governança Estrita, Organização Isolada e Governança de Credenciais.

## 2. Padrões de Organização e Governança [NOVO]

### 2.1 Ciclo de Vida da Sprint (Isolamento)
Para garantir clareza histórica e auditoria, cada Sprint operará sob um regime restrito de entrega:
- **Pastas Modulares:** O repositório conterá uma estrutura organizacional (ex: `docs/Sprints/Sprint_1_SecurityBase`, `docs/Sprints/Sprint_2_Worker`).
- **Artefatos Isolados:** Dentro de cada pasta de Sprint, residirão todas as evidências correspondentes à etapa aprovada: Documentação de Pull Requests (PRs), Notas de Lançamento (Release Notes) e diagramas seccionados desta Sprint.
- **Releases Versionadas:** As entregas marcam uma "Release" parcial funcional garantindo que, por exemplo, o "Worker Criptografado" não espere pelo Painel Web para ter seu PR documentado e fundido na branch principal.

## 3. Segurança (Zero Trust & Blindagem) [NOVO]

Dada a criticidade dos dados contábeis interceptados:

### 3.1 Autenticação e Autorização (JWT / OAuth2)
- Toda e qualquer requisição entre o Frontend View e o Backend REST exigirá verificação forte contendo cabeçalho `Bearer` Token assinado.
- Os protocolos aceitos serão o **OAuth2** (integração recomendada para fluxo de logons SSO limitados) ou tokens **JWT** gerados pela própria fundação do APP com tempo útil rotativo (Refresh Tokens curtos).

### 3.2 Criptografia em Repouso Integral no BD
É proibida a leitura direta via SGBD de informações sensíveis ou a identificação do tráfego.
- **Campos Ofuscados:** Os dados cruciais (`remetente`, `destinatario`, `assunto`, `corpo_resumo`, `anexos`) serão rigorosamente salvos com criptografia simétrica (Ex: **AES-256-GCM**).
- **Abstração:** Uma tabela interceptada conterá lixo hash ininteligível a um invasor acessando o arquivo de BD. A decriptação ocorrerá estritamente na memória volátil (`RAM`) do Backend na instância do Controller RESTFul autenticado antes do consumo pelo Frontend. 
- Gerenciamento Chave-Mestra (`APP_SECRET`) injetado restritamente por variáveis de ambiente operacionais.

### 3.3 Zero Hardcoded e CI/CD Analyzer Autônomo
- É terminantemente **zero hardcoded**: não existirão senhas, URIs completas, chaves JWT, tokens de Telegram ou quaisquer segredos fixados em commits.
- **Camada Autônoma Security:** Será implementado um pipeline CI pre-commit ou de PR Analyzer (utilizando scanners como `Trufflehog`, `SonarQube` ou `Gitleaks`). Este atuará autonomamente invalidando as contribuições e bloqueando Deploy caso senhas sejam detectadas em texto claro no código fonte.

## 4. Metodologia: Princípios SOLID
- **Single Responsibility (SRP):** Classe do Monitorador IMAP não decripta email. Classe CryptoService faz somente a encriptação/decriptação, etc.
- **Open/Closed (OCP):** Facilidade em introduzir um novo provider de mensageria SMS sem alterar o core.
- **Liskov Substitution (LSP), Interface Segregation (ISP), Dependency Inversion (DIP):** Todo componente de segurança, mensageria e armazenamento implementa Interfaces limpas recebidas e resolvidas por injeção na arquitetura NestJS/Python.

## 5. Arquitetura Técnica Base

- **Banco de Dados:** PostgreSQL com suporte às colunas criptografadas mapeadas no ORM (Prisma/TypeORM/SQLAlchemy).
- **Backend:** Node.js (NestJS) ou Python (FastAPI). Necessário pelo controle avançado de Middleware Auth Guard, Scopes locais e Middlewares de Interceptação AES.
- **Frontend:** React SPA. Autenticador Global interceptando a falta do Cookie JWT para bloqueio sumário da tela.
- **Testes (Unitários/Regressão):** Testes unitários para comprovar criptografia. Se o token mudar no teste, a falha ao retornar os dados deve ser captada.

## 6. Plano de Execução Revisionado em Sprints Organizacionais

*(Nota: Seguindo o item 2.1, toda sprint finda possui pasta e PR gerado)*

### Sprint 1: Fundação & Security Zero Trust
* **Ações:** Setup Repositório, Linter/Pre-commit Auth, Integração autônoma (Gitleaks/TruffleHog) impedindo Push falho.
* **Componente:** Criação do Database ORM e Serviço de Criptografia Base em Memória da camada de Infra e Gateway Auth JWT.
* **Saída Esperada:** `docs/Sprints/Sprint_01_Foundation/ReleaseNotes.md`

### Sprint 2: Motor IMAP Criptografado (Worker)
* **Ações:** Roteiro passivo (cronjob) acessando a caixa alvo. Em seguida, os objetos são despachados ao `CryptoService` antes do repositor de banco engatilhar o `save()`.
* **Saída Esperada:** `docs/Sprints/Sprint_02_CryptoWorker/ReleaseNotes.md`

### Sprint 3: API Endpoint Seguro
* **Ações:** Exposição das rotas GET/POST mediante apresentação do Bearer Token. Ao passar no JWT Guard, o motor busca o dado embaralhado no banco e retorna um Object Response decriptado validamente.
* **Saída Esperada:** `docs/Sprints/Sprint_03_AuthAPI/ReleaseNotes.md`

### Sprint 4: Painel Web (Autenticado)
* **Ações:** Fluxo client-side. Exibição limpa na tela. Caso a tela exija acesso aos boletos cruciais sem Auth válida, sofre redirect para `/login`.
* **Saída Esperada:** `docs/Sprints/Sprint_04_SecuredWebPanel/ReleaseNotes.md`

### Sprint 5: Alertas (Mensageria Reduzida)
* **Ações:** Integração Telegram/Whatsapp. O dado transitante pela Internet será mínimo. Exemplo de notificação: *"Novo alerta de e-mail fiscal urgente do remetente bloqueado. Acesso via login."*
* **Saída Esperada:** `docs/Sprints/Sprint_05_Messaging/ReleaseNotes.md`

### Sprint 6: Testes Regressivos e Deploy
* **Ações:** Refinamento E2E cego validando a esteira autônoma e checagem contra SQL INJECTION pela camada de dados.
* **Saída Esperada:** `docs/Sprints/Sprint_06_Deploy/ReleaseNotes.md`
