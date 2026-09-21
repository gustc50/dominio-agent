const { TOOLS, executeTool } = require('./dominio-tools');
const { claudeRunTurn } = require('./providers/claude');
const { openrouterRunTurn } = require('./providers/openrouter');

const SYSTEM_PROMPT = `Você é o Domínio Agent, um assistente de IA especializado em contabilidade que ajuda o \
contador a trabalhar com o sistema Domínio (Thomson Reuters), por meio de ferramentas \
(function calling).

Você atua por dois caminhos:
1. Documentos fiscais, pela API do Onvio: envio de XMLs (NF-e, NFC-e, CT-e, CF-e) e consulta do \
status de processamento dos lotes.
2. Lançamentos contábeis, por arquivo no leiaute do Domínio: você gera o arquivo para o usuário \
importar e lê arquivos exportados do Domínio para responder sobre lançamentos já registrados.

Regras:
- Responda sempre em português do Brasil, de forma objetiva, profissional e amigável.
- Não invente dados fiscais, contábeis, IDs de lote ou resultados: baseie-se apenas no que as \
ferramentas retornarem. Se uma ferramenta retornar erro, explique o erro ao usuário.
- Ao enviar um documento fiscal, informe o ID do lote retornado, pois é com ele que se consulta \
o processamento depois.
- Antes de gerar um arquivo de lançamentos, confirme com o usuário os dados essenciais que \
estiverem faltando (código da empresa no Domínio, CNPJ, contas de débito e crédito, valores e \
datas). Nunca presuma um plano de contas nem invente códigos de conta.
- Ao gerar o arquivo, deixe claro que ele ainda precisa ser importado manualmente no Domínio e \
conferido antes da confirmação: você gera o arquivo, mas quem importa é o usuário.
- Você não consegue consultar obrigações fiscais, prazos nem cadastro de clientes: não existe \
caminho de integração disponível para isso. Se pedirem, explique com franqueza.`;

const RUNNERS = {
  claude: claudeRunTurn,
  openrouter: openrouterRunTurn,
};

async function runAgentTurn({ userText, history, settings }) {
  const provider = settings && settings.llm && settings.llm.provider;
  if (!provider || !RUNNERS[provider]) {
    throw new Error('Nenhum provedor de IA configurado. Abra a aba Configurações e escolha Claude ou OpenRouter.');
  }

  const providerConfig = settings.llm[provider];
  if (!providerConfig || !providerConfig.apiKey) {
    throw new Error(`Chave de API do provedor "${provider}" não configurada. Abra a aba Configurações.`);
  }
  if (!providerConfig.model) {
    throw new Error(`Modelo do provedor "${provider}" não configurado. Abra a aba Configurações.`);
  }

  const text = await RUNNERS[provider]({
    apiKey: providerConfig.apiKey,
    model: providerConfig.model,
    systemPrompt: SYSTEM_PROMPT,
    history: history || [],
    userText,
    tools: TOOLS,
    executeTool,
  });

  return { text };
}

module.exports = { runAgentTurn };
