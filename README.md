# Domínio Agent

Assistente de IA para contadores, com controle por **Claude (Anthropic)** ou **OpenRouter**, que
opera o sistema **Domínio** (Thomson Reuters) através da API de acesso disponibilizada pelo
sistema. Roda como um aplicativo desktop próprio (Electron), com uma janela dedicada — não é uma
página aberta no seu navegador do dia a dia.

## Requisitos

- Windows, com [Node.js](https://nodejs.org/) 18 ou superior instalado.
- Conexão com a internet (para instalar as dependências na primeira execução e para chamar as
  APIs de IA e do Domínio).
- Não é necessário ter o Chrome ou qualquer navegador instalado: o Electron já traz seu próprio
  motor de renderização embutido, então o app abre em sua própria janela nativa.

## Como iniciar

Dê duplo clique em `start.bat`.

- Na primeira vez, ele vai rodar `npm install` automaticamente (pode levar alguns minutos).
- Nas vezes seguintes, ele apenas abre o aplicativo.

## Primeiros passos dentro do app

1. Vá até a aba **Configurações**.
2. Escolha o provedor de IA (Claude ou OpenRouter) e informe a respectiva chave de API e modelo.
3. Preencha o **Client ID**, **Client Secret** e a **Callback URL** do Onvio e clique em
   **Conectar ao Onvio (login)**. Abre-se a tela de login da Thomson Reuters; após autorizar, o
   app guarda o token de acesso e o refresh token.
4. Clique em **Salvar configurações**.
5. Volte para a aba **Comando** e converse com o assistente.

### Como obter as credenciais do Onvio

As credenciais não são uma simples "chave de API": a Onvio BR Accounting API usa OAuth 2.0. É
preciso solicitar o acesso à equipe da API Onvio BR informando nome da empresa, contato
responsável, telefone, e-mail e a **callback URL** que a sua aplicação vai usar. Eles devolvem o
`client_id` e o `client_secret` vinculados a essa callback URL.

## Estrutura do projeto

```
main.js               Processo principal do Electron: cria a janela e os handlers de IPC.
preload.js             Ponte segura (contextBridge) entre a janela e o processo principal.
src/index.html          Interface: aba "Comando" (chat) e aba "Configurações".
src/styles.css          Estilo visual do app.
src/renderer.js         Lógica da interface (troca de abas, formulários, chat).
src/store.js            Leitura/gravação das configurações em disco.
src/agent.js            Loop do agente: escolhe o provedor de IA e executa as ferramentas.
src/dominio-tools.js    Definição das ferramentas (function calling) expostas à IA.
src/onvio-client.js     Cliente da Onvio BR Accounting API: OAuth 2.0 e chamadas REST.
src/providers/claude.js       Cliente da API de Mensagens da Anthropic, com suporte a tool use.
src/providers/openrouter.js   Cliente da API (compatível OpenAI) do OpenRouter, com tool calls.
```

## O que já funciona

- App desktop com janela própria (Electron), sem depender de abrir o navegador do usuário.
- Aba de Configurações separada da aba de Comando.
- Configuração e alternância entre Claude e OpenRouter como "cérebro" do agente.
- Loop de agente com *function calling* funcionando de ponta a ponta nos dois provedores.
- Integração **real** com a Onvio BR Accounting API: login OAuth 2.0, renovação automática do
  token quando expira e duas ferramentas disponíveis para o agente:
  - Enviar XML de documento fiscal (NF-e, NFC-e, CT-e, CF-e) para o Domínio
  - Consultar o status de processamento de um lote enviado

## Detalhes técnicos da API

Autenticação (OAuth 2.0, authorization code + refresh token):

```
GET  https://auth.thomsonreuters.com/authorize
       ?client_id={client_id}
       &response_type=code
       &audience=409f91f6-dc17-44c8-a5d8-e0a1bafd8b67
       &redirect_uri={callback_url}
       &scope=openid+profile+email+offline_access

POST https://auth.thomsonreuters.com/oauth/token
       Content-Type: application/x-www-form-urlencoded
       Authorization: Basic base64(client_id:client_secret)
       grant_type=authorization_code&redirect_uri={callback}&code={code}
       (ou grant_type=refresh_token&refresh_token={refresh_token})
```

Recursos utilizados:

```
POST https://api.onvio.com.br/dominio/invoice/v2/batches
       Authorization: Bearer {access_token}
       multipart/form-data:
         query  = {"boxe/File":true}   (application/json)
         file[] = arquivo XML          (application/xml)
       201 -> { "id": "...", "status": { "message": "..." } }

GET  https://api.onvio.com.br/dominio/invoice/v2/batches/{id}
       Authorization: Bearer {access_token}
       -> { "status": { "message": "Processado" } }
```

## Limitação importante de escopo

A Onvio BR Accounting API é uma API de **integração de documentos fiscais**, não de consulta
contábil. Os recursos que ela expõe giram em torno do envio de XMLs (NF-e, NFC-e, CT-e, CF-e)
para o Domínio Contábil e do acompanhamento desse processamento.

Não há endpoint público documentado para consultar **lançamentos contábeis** nem **obrigações
fiscais e prazos**. Por isso essas ações não existem no app: seria pior entregar um botão que
devolve dado inventado. O agente é instruído a dizer que não consegue realizá-las caso sejam
pedidas.

O portal do desenvolvedor também cita os recursos `ClientInfoResource` (lista de clientes que o
usuário pode integrar) e `IntegrationResource`. Os caminhos exatos desses endpoints não estão
públicos, então eles ainda não foram implementados — com a documentação em mãos, são fáceis de
adicionar em `src/onvio-client.js`.

## Segurança das chaves de API

As credenciais (client secret do Onvio, tokens OAuth, chaves da Anthropic e do OpenRouter) ficam
salvas **apenas localmente**, em texto simples, no arquivo `settings.json` dentro da pasta de
dados do usuário do Electron (`%APPDATA%\dominio-agent\settings.json` no Windows). Esse arquivo
nunca é enviado a lugar nenhum além das próprias APIs configuradas (Anthropic, OpenRouter,
Thomson Reuters/Onvio) — mas não compartilhe esse arquivo nem faça commit dele em nenhum
repositório.
