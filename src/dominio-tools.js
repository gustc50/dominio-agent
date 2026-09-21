// Ferramentas (function calling) que o agente de IA pode chamar para operar o Domínio.
//
// A documentação oficial da API do Domínio (Thomson Reuters) ainda não foi integrada.
// Cada função abaixo está marcada com um TODO indicando onde entrará a chamada HTTP real
// assim que a documentação estiver disponível. Por enquanto elas retornam dados de exemplo,
// para que o restante do fluxo (chat -> chamada de ferramenta -> resposta) já funcione fim a fim.

const AVISO_MOCK =
  'Dados de exemplo — integração real com a API do Domínio ainda pendente (documentação não disponível).';

const TOOLS = [
  {
    name: 'consultar_clientes',
    description:
      'Consulta empresas/clientes cadastrados no sistema Domínio, por nome, CNPJ ou código.',
    input_schema: {
      type: 'object',
      properties: {
        termo: { type: 'string', description: 'Nome, CNPJ ou código do cliente/empresa a buscar.' },
        limite: { type: 'integer', description: 'Número máximo de resultados a retornar.' },
      },
      required: ['termo'],
    },
  },
  {
    name: 'consultar_lancamentos_contabeis',
    description: 'Consulta lançamentos contábeis de uma empresa em um período.',
    input_schema: {
      type: 'object',
      properties: {
        empresa: { type: 'string', description: 'Nome ou código da empresa.' },
        dataInicio: { type: 'string', description: 'Data inicial no formato AAAA-MM-DD.' },
        dataFim: { type: 'string', description: 'Data final no formato AAAA-MM-DD.' },
      },
      required: ['empresa'],
    },
  },
  {
    name: 'consultar_obrigacoes_fiscais',
    description: 'Consulta obrigações fiscais, guias e prazos pendentes de uma empresa.',
    input_schema: {
      type: 'object',
      properties: {
        empresa: { type: 'string', description: 'Nome ou código da empresa.' },
        competencia: { type: 'string', description: 'Competência no formato AAAA-MM (opcional).' },
      },
      required: ['empresa'],
    },
  },
];

async function consultarClientes({ termo, limite }) {
  // TODO: substituir por chamada real (ex.: GET {baseUrl}/clientes?termo=...) quando a
  // documentação da API do Domínio estiver disponível.
  const termoBusca = String(termo || '').toLowerCase();
  const exemplos = [
    { codigo: '0001', razaoSocial: 'Comércio Exemplo LTDA', cnpj: '12.345.678/0001-90' },
    { codigo: '0002', razaoSocial: 'Serviços Modelo ME', cnpj: '98.765.432/0001-10' },
  ].filter((c) => c.razaoSocial.toLowerCase().includes(termoBusca) || c.cnpj.includes(termoBusca));

  return { aviso: AVISO_MOCK, termo, resultados: exemplos.slice(0, limite || 5) };
}

async function consultarLancamentosContabeis({ empresa, dataInicio, dataFim }) {
  // TODO: substituir por chamada real à API do Domínio quando disponível.
  return {
    aviso: AVISO_MOCK,
    empresa,
    periodo: { dataInicio: dataInicio || null, dataFim: dataFim || null },
    lancamentos: [
      { data: '2026-09-05', historico: 'Pagamento de fornecedor', debito: '1.1.01', credito: '1.1.02', valor: 1500.0 },
      { data: '2026-09-10', historico: 'Recebimento de cliente', debito: '1.1.02', credito: '3.1.01', valor: 4200.0 },
    ],
  };
}

async function consultarObrigacoesFiscais({ empresa, competencia }) {
  // TODO: substituir por chamada real à API do Domínio quando disponível.
  return {
    aviso: AVISO_MOCK,
    empresa,
    competencia: competencia || null,
    obrigacoes: [
      { nome: 'DAS - Simples Nacional', vencimento: '2026-10-20', status: 'pendente' },
      { nome: 'DCTFWeb', vencimento: '2026-10-15', status: 'pendente' },
    ],
  };
}

const IMPLEMENTATIONS = {
  consultar_clientes: consultarClientes,
  consultar_lancamentos_contabeis: consultarLancamentosContabeis,
  consultar_obrigacoes_fiscais: consultarObrigacoesFiscais,
};

async function executeTool(name, input) {
  const fn = IMPLEMENTATIONS[name];
  if (!fn) return { erro: `Ferramenta desconhecida: ${name}` };
  try {
    return await fn(input || {});
  } catch (err) {
    return { erro: err.message || String(err) };
  }
}

// Teste de conexão genérico: faz um GET na URL base configurada usando o header de
// autenticação informado. Útil para validar que a chave/URL do Domínio estão certas,
// mesmo sem ainda conhecer o formato exato das respostas da API.
async function testarConexao({ baseUrl, apiKey, authHeader }) {
  if (!baseUrl) {
    return { ok: false, mensagem: 'Informe a URL base da API do Domínio para testar a conexão.' };
  }

  const headerName = authHeader || 'Authorization';
  const headers = {
    [headerName]: headerName.toLowerCase() === 'authorization' ? `Bearer ${apiKey || ''}` : apiKey || '',
  };

  try {
    const response = await fetch(baseUrl, { method: 'GET', headers });
    const text = await response.text();
    return {
      ok: response.ok,
      mensagem: `Resposta HTTP ${response.status} de ${baseUrl}`,
      status: response.status,
      corpo: text.slice(0, 500),
    };
  } catch (err) {
    return { ok: false, mensagem: `Falha ao conectar: ${err.message || err}` };
  }
}

module.exports = { TOOLS, executeTool, testarConexao };
