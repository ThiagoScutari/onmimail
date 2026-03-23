# Projeto: Monitor de E-mails Contábeis (Omnimail)

## 1. Visão Geral
Sistema focado na automação de leitura, alerta e status de e-mails contábeis, garantindo que os prazos de pagamentos de guias (DARF, DAS, etc.) não sejam perdidos, evitando juros e multas operacionais. O sistema se conectará ativamente em caixas de entrada (Gmail/Outlook), identificará as mensagens e disparará um alerta no Telegram/WhatsApp.

## 2. Metodologia: Princípios SOLID
Toda a arquitetura e desenvolvimento deste projeto deverá seguir rigorosamente os princípios **SOLID**:
- **S - Single Responsibility Principle (SRP):** Classes e módulos devem ter apenas um motivo para mudar. O módulo de leitura de e-mails não será o mesmo responsável pelo envio de mensagens no Telegram.
- **O - Open/Closed Principle (OCP):** O sistema deve ser aberto para extensão e fechado para modificação. Isso permitirá que novos canais de notificação (ex: webhook para Slack) ou novos provedores (ex: IMAP Genérico) sejam adicionados apenas estendendo o código core, sem alterá-lo.
- **L - Liskov Substitution Principle (LSP):** Integrações derivadas (ex: provedor de disparo Telegram vs WhatsApp) devem ser substituíveis através de interfaces genéricas (`INotificationService`) sem quebrar a rotina de envio do aplicativo.
- **I - Interface Segregation Principle (ISP):** Criar interfaces pequenas e específicas. A interface do repositório de e-mails deve ter apenas os métodos estritamente necessários, preferindo múltiplas interfaces de propósito único a uma interface generalista.
- **D - Dependency Inversion Principle (DIP):** Os módulos de alto nível (Casos de Uso) não devem depender dos de baixo nível (Banco de Dados, APIs REST de Terceiros). A comunicação ocorrerá por meio de abstrações (Inversão de Controle/Injeção de Dependências).

## 3. Especificações Técnicas

### 3.1 Arquitetura
A arquitetura base será a **Clean Architecture (Arquitetura Limpa)** baseada em camadas modulares para facilitar os testes e a manutenção:
- **Camada Apresentação e Integração (UI/API):** Onde residem o Painel Web (Frontend SPA) e os Controllers RESTful do Backend, além de Listeners do cronjob.
- **Camada de Aplicação (Casos de Uso):** Contém a lógica de negócio orquestrada (Ex: `FetchNewEmailsUseCase`, `NotifyUrgentEmailsUseCase`).
- **Camada de Domínio (Core):** Entidades puras, como o modelo `Email` e regras fundamentadas. Livre de dependências externas.
- **Camada de Infraestrutura:** Implementação de integrações com Banco de Dados (ORM), Provedores de Email (IMAP/Graph) e Mensageria Externa (Telegram API).

### 3.2 Banco de Dados
- **Tipo:** Relacional (`PostgreSQL` ou `SQLite` em estágio inicial). Adequado devido ao modelo bem delimitado e cruzamento de status vs chaves de configuração.
- **Entidades Principais:**
  - `Email`: (`id`, `remetente`, `assunto`, `corpo_resumo`, `data_recebimento`, `origin_platform`, `status` [nao_lido, lido, processado], `notification_status`).
  - `Configuracao`: (`id`, `key`, `value` [ex: remetente e domínios alvo da contabilidade]).
  - `AlertaLog`: (`id`, `email_id`, `canal_envio`, `data`, `status_envio`).

### 3.3 Backend
- **Linguagem/Framework:** `Node.js` usando **NestJS** (Fortemente recomendado pelo suporte nativo à Injeção de Dependência, TypeScript e Design Orientado a SOLID) ou `Python` via **FastAPI** (Excelente para automações rápidas). O padrão assumido pelo detalhamento de injeção é **Node + NestJS**.
- **Ferramentas e Bibliotecas:**
  - ORM: `Prisma` ou `TypeORM`.
  - Filas e Jobs: `BullMQ` + `Redis` ou `@nestjs/schedule` (node cron) para rodar o crawler a cada 4 horas.
  - SMTP/IMAP: `node-imap` ou Integração com API do Microsoft Graph / Gmail.

### 3.4 Frontend
- **Linguagem/Framework:** `React` via `Vite`, tipado com `TypeScript`.
- **Organização de Estado:** `Zustand` ou `React Query` p/ gerenciar dados estáticos do painel, garantindo fluidez e minimizando re-renders.
- **Estilização:** `Tailwind CSS`.
- **Páginas Principais:**
  - **Dashboard:** Visão principal de e-mails em formato de feed. Status coloridos (Vermelho = Urgente/Não lido, Verde = Tratado).
  - **Configurações:** Input das chaves de api (Telegram Token, WhatsApp) e edição de e-mails que a ferramenta deve monitorar.

### 3.5 Testes
- **Testes Individuais (Unitários - Backend):**
  - **Ferramenta:** `Jest`.
  - **Escopo:** Cobrir todos os *Use Cases*. Mocks garantirão que o sistema não dispare para o Telegram quando for rodar os testes, testando apenas se a condição chamaria a interface de envio sob a condição de e-mail novo.
- **Testes Individuais (Unitários - Frontend):**
  - **Ferramenta:** `Vitest` + `React Testing Library`.
  - **Escopo:** Testar renderização de chips de status sem necessidade da API real estar no ar.
- **Testes de Regressão e E2E:**
  - **Ferramenta:** `Cypress` ou `Playwright`.
  - **Escopo:** Realizar o fluxo de ponta a ponta simulando a vida real (Subir painel, clicar na lista, mudar um status de "Não Lido" para "Lido" e visualizar alteração).

## 4. Plano de Execução em Sprints

### Sprint 1: Fundação do Projeto
* **Duração Recomendada:** 1 semana
* **Objetivos:** Setup de ambiente e banco de dados.
* **Tarefas Focais (Backend/Db):**
  - Criação do Repositório. Mapear schema Prisma/ORM das tabelas `Email` e `Configuracoes`.
  - Setup do projeto base (NestJS ou FastAPI) incluindo linters/formatters.
  - Criar Interfaces Base com diretrizes SOLID (Interfaces de EmailProvider e MessageProvider).

### Sprint 2: Motor de Coleta (Worker)
* **Duração Recomendada:** 1 a 2 semanas
* **Objetivos:** Job crontab que puxa e-mails de canais reais sem duplicar e arquiva.
* **Tarefas Focais:**
  - Implementar conexão e Parseamento de e-mails IMAP/Microsoft Graph focando especificamente em varrer a Inbox nos últimos 30 dias.
  - Aplicação de regras de filtragem baseadas no modelo (ex: vindo de `contabiletica@hotmail.com`).
  - Função no backend que armazena os metadados dessa leitura no banco garantindo que ele não insira duas vezes o mesmo Id-Message.
  - Testes unitários para simular uma resposta estática IMAP e validar a inserção do DB.

### Sprint 3: API REST do Backend
* **Duração Recomendada:** 1 semana
* **Objetivos:** Expor os dados capturados para consumo Web.
* **Tarefas Focais:**
  - Controller com rota `GET /emails` estruturada com paginação.
  - Rota `PATCH /emails/:id/status` para atualizar no banco se foi tratado.
  - Rota CRUD para as configurações da plataforma (`GET /config` e `POST /config`).

### Sprint 4: Painel Web (Frontend HUD)
* **Duração Recomendada:** 1 a 2 semanas
* **Objetivos:** Desenvolvimento Single Page Application consumindo dados visuais.
* **Tarefas Focais:**
  - Setup React, Tailwind.
  - Implementação da tela principal do feed de E-mails com botões de ação ("Marcar como resolvido", "Ir para Inbox do provedor").
  - Painel secundário para as Configurações Técnicas.
  - Teste de interface do usuário (`RTL`).

### Sprint 5: Engine de Alertas e Notificação
* **Duração Recomendada:** 1 a 2 semanas
* **Objetivos:** Disparo ativo e automação com o Bot Telegram e WhatsApp.
* **Tarefas Focais:**
  - Adicionar o passo ao final do script do Worker (Sprint 2): se novos e-mails foram criados na base -> Acionar Gateway de Mensageria.
  - Implementar classe integrada com `@BotFather` no Telegram e enviar formatação legível para o usuário final.
  - Caso implementado via Evolution API/Z-API, instanciar a classe da interface de WhatsAPP.
  - Testes unitários da formatação de disparo das mensagens.

### Sprint 6: Testes de Regressão e Homologação
* **Duração Recomendada:** 1 semana
* **Objetivos:** Refinamento E2E e garantia de qualidade para produção (Deploy).
* **Tarefas Focais:**
  - Escrever fluxos no Playwright percorrendo a criação até a interface do usuário.
  - Submeter os serviços ao fluxo completo usando dados reais de testes para verificar se os cronjobs operam bem sem sobrecarga de memória.
  - Refinar eventuais erros de Cors/Integração.
  - Entrega da v1.0 e Documentação técnica final.
