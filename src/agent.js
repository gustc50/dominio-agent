const { TOOLS, executeTool } = require('./dominio-tools');
const { claudeRunTurn } = require('./providers/claude');
const { openrouterRunTurn } = require('./providers/openrouter');

const SYSTEM_PROMPT = `Você é o Domínio Agent, um assistente de IA especializado em contabilidade que ajuda o \
contador a operar o sistema Domínio (Thomson Reuters) por meio de ferramentas (function calling).

Regras:
- Responda sempre em português do Brasil, de forma objetiva, profissional e amigável.
- Use as ferramentas disponíveis sempre que a pergunta envolver dados de clientes, lançamentos \
contábeis ou obrigações fiscais.
- Sempre que uma ferramenta retornar um aviso de que os dados são de exemplo/simulados, informe \
isso claramente ao usuário na resposta.
- Não invente dados contábeis, fiscais ou cadastrais: baseie-se apenas no que as ferramentas \
retornarem.`;

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
