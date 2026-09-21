const { mensagemErroHttp } = require('./erro-http');

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MAX_TOOL_ITERATIONS = 6;

function toOpenAiTools(tools) {
  return tools.map((t) => ({
    type: 'function',
    function: { name: t.name, description: t.description, parameters: t.input_schema },
  }));
}

async function openrouterRunTurn({ apiKey, model, systemPrompt, history, userText, tools, executeTool }) {
  const messages = [{ role: 'system', content: systemPrompt }];
  for (const turn of history || []) {
    if (turn.role === 'user' || turn.role === 'assistant') {
      messages.push({ role: turn.role, content: turn.text });
    }
  }
  messages.push({ role: 'user', content: userText });

  const openAiTools = toOpenAiTools(tools);

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
    const res = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://dominio-agent.local',
        'X-Title': 'Domínio Agent',
      },
      body: JSON.stringify({ model, messages, tools: openAiTools }),
    });

    if (!res.ok) {
      throw new Error(mensagemErroHttp('OpenRouter', res.status, await res.text()));
    }

    const data = await res.json();
    const choice = (data.choices || [])[0];
    const message = choice && choice.message;

    if (message && Array.isArray(message.tool_calls) && message.tool_calls.length > 0) {
      messages.push(message);
      for (const call of message.tool_calls) {
        let input = {};
        try {
          input = JSON.parse(call.function.arguments || '{}');
        } catch (_) {
          // argumentos malformados vindos do modelo: segue com objeto vazio
        }
        const result = await executeTool(call.function.name, input);
        messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) });
      }
      continue;
    }

    const text = (message && message.content ? message.content : '').trim();
    return text || '(sem resposta de texto)';
  }

  return 'O agente atingiu o limite de etapas de ferramentas sem concluir a resposta.';
}

module.exports = { openrouterRunTurn };
