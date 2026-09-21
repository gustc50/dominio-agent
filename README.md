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

- Na primeira vez, ele baixa as dependências. O Electron tem cerca de 300 MB, então pode levar
  alguns minutos.
- Nas vezes seguintes, ele apenas abre o aplicativo.

### Se aparecer "Electron failed to install correctly"

A partir do Electron 44, o `npm install` **não baixa mais o binário do aplicativo sozinho** — o
pacote deixou de ter script de pós-instalação. Por isso este projeto declara o passo
explicitamente em `package.json`:

```json
"postinstall": "node node_modules/electron/install.js"
```

O `start.bat` também confere se `node_modules\electron\dist\electron.exe` existe antes de abrir
e, se não existir, baixa e reinstala sozinho. Se ainda assim falhar, ele mostra um diagnóstico
apontando as duas causas prováveis: `npm config get ignore-scripts` ligado (o npm bloqueia o
script que baixa o binário) ou a rede bloqueando `github.com/electron/electron/releases`.

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
- Integração **real** com a Onvio BR Accounting API: login OAuth 2.0 e renovação automática do
  token quando expira.
- Quatro ferramentas disponíveis para o agente:
  - Enviar XML de documento fiscal (NF-e, NFC-e, CT-e, CF-e) para o Domínio
  - Consultar o status de processamento de um lote enviado
  - Gerar arquivo de lançamentos contábeis no leiaute posicional do Domínio
  - Ler um arquivo de lançamentos exportado do Domínio (com filtro por data e soma dos valores)

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

## Lançamentos contábeis: integração por arquivo

A API do Onvio não cobre lançamentos contábeis. O caminho suportado para isso no Domínio é o
arquivo posicional, que funciona nos dois sentidos:

- **Gerar para importar**: o agente grava um `.txt` que você importa em
  `Utilitários → Importação → Lançamentos Contábeis em Lote (Leiaute Domínio Sistemas)`.
- **Ler o que foi exportado**: você exporta em `Utilitários → Exportação → Lançamentos` e o
  agente lê esse arquivo para responder sobre os lançamentos (o total e a soma são calculados
  em código, não estimados pela IA).

Formato (implementado em `src/dominio-lancamentos.js`): posicional de largura fixa, encoding
Latin-1 sem BOM, quebra de linha CRLF inclusive na última linha, valores em centavos e datas
`dd/mm/aaaa`. Registros: `01` cabeçalho (55), `02` lançamento (165), `03` partida (664),
`99` rodapé (`9`×100). O sequencial é global: lançamento *i* (0-based) gera `02` = `2i+1` e
`03` = `2i+2`.

### Ressalvas honestas

- **A importação não é automática.** O app gera o arquivo; quem importa e confere no Domínio é
  você. Confira o lote antes de confirmar.
- Só é gerada **partida simples** (um débito e um crédito por lançamento). O comportamento do
  Domínio com partida múltipla neste leiaute não é conhecido, então não foi implementado.
- O leiaute foi decodificado a partir de um export real do Domínio por um projeto de terceiros
  ([Facility_Contabil](https://github.com/mastrocontabil-web/Facility_Contabil)), que relata
  importar sem erro. Ainda assim, **valide o primeiro arquivo gerado** num ambiente de teste:
  o número do lote, o `1` final do cabeçalho e o comportamento com código de histórico não
  cadastrado são os pontos mais sensíveis.

## Limitação importante de escopo

A Onvio BR Accounting API é uma API de **integração de documentos fiscais**, não de consulta
contábil. Os recursos que ela expõe giram em torno do envio de XMLs (NF-e, NFC-e, CT-e, CF-e)
para o Domínio Contábil e do acompanhamento desse processamento. Lançamentos contábeis são
atendidos pelo arquivo posicional descrito acima.

Já para **obrigações fiscais e prazos** não foi encontrado nenhum caminho de integração: nem
endpoint na API, nem leiaute público de importação/exportação. As alternativas seriam acesso
direto ao banco (o Domínio usa Sybase, acessível via ODBC) ou exportar relatórios à mão —
nenhuma das duas é suportada pela Thomson Reuters nem sólida o bastante para o app depender
dela. Por isso essa ação não existe aqui: seria pior entregar um botão que devolve dado
inventado. O agente é instruído a dizer que não consegue realizá-la caso seja pedida.

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
