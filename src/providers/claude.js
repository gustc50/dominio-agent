const { mensagemErroHttp } = require('./erro-http');

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const CLAUDE_VERSION = '2023-06-01';
const MAX_TOOL_ITERATIONS = 6;

function toClaudeTools(tools) {
  return tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.input_schema }));
}

async function claudeRunTurn({ apiKey, model, systemPrompt, history, userText, tools, executeTool }) {
  const messages = (history || [])
    .filter((turn) => turn.role === 'user' || turn.role === 'assistant')
    .map((turn) => ({ role: turn.role, content: turn.text }));
  messages.push({ role: 'user', content: userText });

  const claudeTools = toClaudeTools(tools);

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
    const res = await fetch(CLAUDE_API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': CLAUDE_VERSION,
      },
      body: JSON.stringify({
        model,
        max_tokens: 2048,
        system: systemPrompt,
        messages,
        tools: claudeTools,
      }),
    });

    if (!res.ok) {
      throw new Error(mensagemErroHttp('Claude (Anthropic)', res.status, await res.text()));
    }

    const data = await res.json();
    const content = data.content || [];
    const toolUses = content.filter((b) => b.type === 'tool_use');

    if (data.stop_reason === 'tool_use' && toolUses.length > 0) {
      messages.push({ role: 'assistant', content });
      const toolResults = [];
      for (const tu of toolUses) {
        const result = await executeTool(tu.name, tu.input);
        toolResults.push({ type: 'tool_result', tool_use_id: tu.id, content: JSON.stringify(result) });
      }
      messages.push({ role: 'user', content: toolResults });
      continue;
    }

    const text = content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();
    return text || '(sem resposta de texto)';
  }

  return 'O agente atingiu o limite de etapas de ferramentas sem concluir a resposta.';
}

module.exports = { claudeRunTurn };
