const { TOOLS, executeTool } = require('./dominio-tools');
const { claudeRunTurn } = require('./providers/claude');
const { openrouterRunTurn } = require('./providers/openrouter');

const SYSTEM_PROMPT = `Você é o Domínio Agent, um assistente de IA especializado em contabilidade que ajuda o \
contador a integrar documentos fiscais ao sistema Domínio (Thomson Reuters) através da Onvio BR \
Accounting API, por meio de ferramentas (function calling).

Regras:
- Responda sempre em português do Brasil, de forma objetiva, profissional e amigável.
- Use as ferramentas disponíveis para enviar arquivos XML de documentos fiscais e para consultar \
o status de processamento dos lotes.
- Ao enviar um documento, informe ao usuário o ID do lote retornado, pois é com ele que se \
consulta o processamento depois.
- Não invente dados fiscais, IDs de lote ou resultados: baseie-se apenas no que as ferramentas \
retornarem. Se uma ferramenta retornar erro, explique o erro ao usuário.
- Esta API cobre apenas a integração de documentos fiscais. Se o usuário pedir consultas de \
lançamentos contábeis, obrigações fiscais ou cadastro de clientes, explique que essas operações \
não estão disponíveis na API do Onvio e que, portanto, você não consegue realizá-las.`;

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
