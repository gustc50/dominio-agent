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
3. Informe a chave de API do Domínio e a URL base da API (se já tiver essas informações). Use
   "Testar conexão" para verificar se a URL/chave respondem.
4. Clique em **Salvar configurações**.
5. Volte para a aba **Comando** e converse com o assistente.

## Estrutura do projeto

```
main.js               Processo principal do Electron: cria a janela e os handlers de IPC.
preload.js             Ponte segura (contextBridge) entre a janela e o processo principal.
src/index.html          Interface: aba "Comando" (chat) e aba "Configurações".
src/styles.css          Estilo visual do app.
src/renderer.js         Lógica da interface (troca de abas, formulários, chat).
src/store.js            Leitura/gravação das configurações em disco.
src/agent.js            Loop do agente: escolhe o provedor de IA e executa as ferramentas.
src/dominio-tools.js    Definição das ferramentas (function calling) e chamadas ao Domínio.
src/providers/claude.js       Cliente da API de Mensagens da Anthropic, com suporte a tool use.
src/providers/openrouter.js   Cliente da API (compatível OpenAI) do OpenRouter, com tool calls.
```

## O que já funciona nesta v1

- App desktop com janela própria (Electron), sem depender de abrir o navegador do usuário.
- Aba de Configurações separada da aba de Comando.
- Configuração e alternância entre Claude e OpenRouter como "cérebro" do agente.
- Loop de agente com *function calling* já funcionando de ponta a ponta nos dois provedores.
- Três ferramentas prontas para o agente usar em linguagem natural:
  - Consultar clientes/empresas cadastradas
  - Consultar lançamentos contábeis
  - Consultar obrigações fiscais e prazos

## O que ainda é simulado (pendente da documentação do Domínio)

A Thomson Reuters ainda não teve sua documentação de API integrada neste projeto. As três
ferramentas acima **retornam dados de exemplo** (claramente sinalizados nas respostas do
assistente como "dados de exemplo"), para que todo o fluxo de chat + decisão de ferramenta +
resposta já funcione de ponta a ponta.

Assim que você tiver a documentação oficial da API do Domínio (endpoints, formato de
autenticação, payloads de request/response), me envie que eu:

1. Substituo o conteúdo de cada função em `src/dominio-tools.js` (já há um comentário `TODO`
   marcando exatamente onde) por chamadas HTTP reais.
2. Ajusto os campos da aba Configurações caso o formato de autenticação real seja diferente do
   genérico (`URL base` + `header` + `chave`) já preparado.
3. Adiciono novas ferramentas, se a documentação permitir outras ações úteis (ex.: lançar um
   registro, emitir uma guia etc.).

## Segurança das chaves de API

As chaves de API (Domínio, Claude, OpenRouter) ficam salvas **apenas localmente**, em texto
simples, no arquivo `settings.json` dentro da pasta de dados do usuário do Electron
(`%APPDATA%\dominio-agent\settings.json` no Windows). Esse arquivo nunca é enviado a lugar
nenhum além das próprias APIs configuradas (Anthropic, OpenRouter ou Domínio) — mas não
compartilhe esse arquivo nem faça commit dele em nenhum repositório.
