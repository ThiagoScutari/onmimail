|  |
| --- |
| **Monitor de E-mails Contábeis**  Sistema de Alertas e Painel de Controle  *Documento de Análise da Solução Proposta*  DRX Têxtil • Março 2026 |

# **1. Problema Identificado**

Prazos de pagamento enviados pela contabilidade estão sendo perdidos porque os e-mails chegam à caixa de entrada sem nenhuma diferenciação visual ou alerta proativo. O resultado direto é o pagamento de juros e multas evitáveis.

|  |
| --- |
| **Impacto financeiro atual**  Pagamento de juros e multas por atraso em obrigações fiscais/tributárias que chegaram por e-mail sem ação oportuna. |

# **2. Escopo da Solução**

## **2.1 O que será monitorado**

|  |  |
| --- | --- |
| **Parâmetro** | **Valor configurado** |
| **Caixa monitorada** | thiago.scutari@outlook.com (Outlook/Hotmail) |
| **Remetente fixo** | contabiletica@hotmail.com |
| **Domínio adicional** | Configurável no painel (campo livre) |
| **Frequência** | A cada 4 horas (verificação automática) |
| **Período retroativo** | Últimos 30 dias (1ª execução) |

## **2.2 O que será entregue**

* Painel web com lista de e-mails urgentes, leitura e status
* Integração com Gmail/Outlook via MCP para busca automática
* Bot no Telegram com alertas em tempo real
* WhatsApp via serviço intermediário (detalhado na Seção 4)
* Label 'Urgente' aplicado automaticamente nos e-mails identificados

# **3. Arquitetura da Solução**

A solução é composta por três camadas independentes que se complementam:

|  |  |  |
| --- | --- | --- |
| **#** | **Camada** | **Função** |
| **1** | **Coleta (Gmail MCP)** | Acessa a caixa de entrada via API do Gmail, filtra por remetente e aplica label 'Urgente' |
| **2** | **Painel Web (React/HTML)** | Lista de e-mails urgentes com remetente, assunto, data e status de leitura. Acessado pelo navegador |
| **3** | **Alertas (Telegram / WhatsApp)** | Dispara mensagem no Telegram/WhatsApp toda vez que um novo e-mail da contabilidade é detectado |

# **4. Detalhamento dos Componentes**

## **4.1 Gmail / Outlook — Coleta de E-mails**

O acesso à caixa de entrada é feito via MCP (Model Context Protocol), que já está conectado ao Gmail do Claude. Para contas Outlook/Hotmail como a sua, a integração requer uma etapa adicional:

* Gmail (@gmail.com): pronto para uso, sem configuração extra
* Outlook/Hotmail: requer conexão via Microsoft Graph API ou IMAP
* Alternativa imediata: encaminhar automaticamente os e-mails da contabilidade para um Gmail

|  |
| --- |
| **⚡ Recomendação rápida** |
| Configure uma regra no Outlook para encaminhar os e-mails de contabiletica@hotmail.com |
| automaticamente para thiago.scutari@gmail.com (se você tiver uma conta Gmail). |
| Isso resolve a integração em 2 minutos sem nenhum código adicional. |

## **4.2 Painel Web**

Um painel HTML/React será entregue como um arquivo que pode ser aberto diretamente no navegador. Ele exibirá:

* Lista de e-mails urgentes ordenada por data (mais recentes primeiro)
* Remetente, assunto e preview do corpo do e-mail
* Indicador visual: Não lido / Lido / Respondido
* Botão de acesso direto ao e-mail no Gmail/Outlook
* Campo de configuração para adicionar/remover remetentes monitorados
* Horário da última verificação e próxima verificação agendada

## **4.3 Telegram — Alertas Instantâneos**

O Telegram é a opção mais simples e gratuita para notificações. O fluxo é:

1. Criar um bot no Telegram via @BotFather (leva 2 minutos)
2. Obter o Token do bot e seu Chat ID pessoal
3. Configurar no painel — o sistema envia uma mensagem a cada novo e-mail detectado

|  |
| --- |
| **📱 Mensagem de exemplo no Telegram** |
| 🔴 URGENTE — Novo e-mail da Contabilidade |
| De: contabiletica@hotmail.com |
| Assunto: DARF vencimento 28/03 — pagamento pendente |
| Recebido: 23/03/2026 14:32 |
| ▶ Clique para abrir: [link direto] |

## **4.4 WhatsApp — Opções Disponíveis**

WhatsApp não possui API oficial gratuita para uso pessoal. Abaixo as três alternativas viáveis:

|  |  |  |  |
| --- | --- | --- | --- |
| **Serviço** | **Custo** | **Dificuldade** | **Indicado para** |
| **Z-API** | ~R$89/mês | Fácil | Uso pessoal/empresarial simples |
| **Twilio (WhatsApp)** | USD 0,005/msg | Médio | Quem já usa ecossistema Twilio |
| **Evolution API** | Gratuito\* | Avançado (Docker) | Quem já roda Docker (você tem!) |

*\* Evolution API é open source. Você precisaria hospedar em um servidor ou subir localmente via Docker Compose — o que é perfeitamente viável dado que você já usa Docker no projeto SGP Costura.*

# **5. Viabilidade por Componente**

|  |  |  |
| --- | --- | --- |
| **Componente** | **Status** | **Observação** |
| **Painel Web (HTML/React)** | **✅ Pronto** | Pode ser entregue imediatamente como artifact |
| **Telegram Bot** | **✅ Pronto** | Requer apenas Token + Chat ID (5 min de setup) |
| **Busca Gmail** | **✅ Disponível** | MCP Gmail conectado nesta conversa |
| **Busca Outlook** | **⚠️ Requer config** | Outlook/Hotmail não tem MCP nativo — ver Seção 4.1 |
| **WhatsApp (Z-API)** | **⚠️ Requer conta** | Signup em z-api.io — configuração simples |
| **WhatsApp (Evolution)** | **⚠️ Requer Docker** | Viável com sua infra existente do SGP Costura |

# **6. Próximos Passos Sugeridos**

Ordem recomendada para implementação, do mais simples ao mais avançado:

1. **Confirmar e-mail monitorado e aprovar esta análise**

*→ Você já informou: contabiletica@hotmail.com como remetente da contabilidade*

1. **Criar o bot no Telegram**

*→ Abrir o Telegram > buscar @BotFather > /newbot > copiar Token gerado*

1. **Resolver o acesso ao Outlook**

*→ Criar regra de encaminhamento para Gmail OU configurar IMAP*

1. **Construir o painel + integração Telegram**

*→ Claude gera o artifact completo nesta mesma conversa*

1. **Decidir sobre WhatsApp e integrar**

*→ Z-API (mais rápido) ou Evolution API via Docker (gratuito, mais trabalho)*

# **7. Questões em Aberto**

As decisões abaixo precisam ser tomadas antes de continuar:

* Você tem uma conta Gmail para usar como conta intermediária (encaminhamento do Outlook)?
* Prefere criar o bot do Telegram agora (durante esta conversa) ou já tem um?
* Para o WhatsApp: Z-API (pago, simples) ou Evolution API via Docker Compose?
* O painel deve funcionar apenas localmente (arquivo HTML) ou precisa de acesso remoto/web?

*Documento gerado por Claude (Anthropic) • DRX Têxtil • Março 2026*