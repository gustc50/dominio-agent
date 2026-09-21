// Ferramentas (function calling) que o agente de IA pode chamar.
//
// São duas frentes:
//
// 1. Onvio BR Accounting API (online): integração de documentos fiscais eletrônicos
//    (NF-e, NFC-e, CT-e, CF-e) — envio de XMLs em lote e consulta do processamento.
// 2. Arquivo posicional do Domínio (offline): geração de arquivo de lançamentos
//    contábeis para importar e leitura de arquivo exportado. A API do Onvio não
//    cobre lançamentos contábeis, e esse leiaute é o caminho suportado para isso.

const onvio = require('./onvio-client');
const lancamentos = require('./dominio-lancamentos');

const TOOLS = [
  {
    name: 'enviar_documento_fiscal',
    description:
      'Envia um arquivo XML de documento fiscal eletrônico (NF-e, NFC-e, CT-e, CF-e) para ' +
      'processamento no Domínio via Onvio. Retorna o ID do lote criado.',
    input_schema: {
      type: 'object',
      properties: {
        caminhoArquivo: {
          type: 'string',
          description: 'Caminho completo do arquivo XML no computador. Ex.: C:\\notas\\nfe123.xml',
        },
      },
      required: ['caminhoArquivo'],
    },
  },
  {
    name: 'consultar_status_lote',
    description:
      'Consulta a situação de processamento de um lote enviado anteriormente ao Domínio, ' +
      'usando o ID retornado no envio.',
    input_schema: {
      type: 'object',
      properties: {
        loteId: { type: 'string', description: 'ID do lote retornado no envio do documento.' },
      },
      required: ['loteId'],
    },
  },
  {
    name: 'gerar_arquivo_lancamentos',
    description:
      'Gera um arquivo .txt no leiaute posicional do Domínio com lançamentos contábeis, ' +
      'pronto para o usuário importar em Utilitários -> Importação -> Lançamentos Contábeis ' +
      'em Lote. Aceita apenas partidas simples: um débito e um crédito por lançamento.',
    input_schema: {
      type: 'object',
      properties: {
        caminhoSaida: {
          type: 'string',
          description: 'Caminho completo onde gravar o arquivo. Ex.: C:\\dominio\\lote.txt',
        },
        codigoEmpresa: { type: 'string', description: 'Código da empresa no Domínio.' },
        cnpj: { type: 'string', description: 'CNPJ ou CPF da empresa (apenas dígitos ou formatado).' },
        numeroLote: { type: 'integer', description: 'Número do lote. Padrão: 1.' },
        lancamentos: {
          type: 'array',
          description: 'Lista de lançamentos a gravar.',
          items: {
            type: 'object',
            properties: {
              data: { type: 'string', description: 'Data do lançamento (AAAA-MM-DD ou DD/MM/AAAA).' },
              contaDebito: { type: 'string', description: 'Código reduzido da conta de débito.' },
              contaCredito: { type: 'string', description: 'Código reduzido da conta de crédito.' },
              valor: { type: 'number', description: 'Valor em reais. Ex.: 102.58' },
              codigoHistorico: { type: 'string', description: 'Código do histórico padrão (opcional).' },
              complemento: { type: 'string', description: 'Complemento do histórico (texto livre).' },
            },
            required: ['data', 'contaDebito', 'contaCredito', 'valor'],
          },
        },
      },
      required: ['caminhoSaida', 'codigoEmpresa', 'cnpj', 'lancamentos'],
    },
  },
  {
    name: 'ler_arquivo_lancamentos',
    description:
      'Lê um arquivo de lançamentos contábeis exportado do Domínio (Utilitários -> Exportação ' +
      '-> Lançamentos) e retorna os lançamentos, o total encontrado e a soma dos valores. ' +
      'Use para responder perguntas sobre lançamentos já registrados.',
    input_schema: {
      type: 'object',
      properties: {
        caminhoArquivo: { type: 'string', description: 'Caminho completo do arquivo exportado.' },
        dataInicio: { type: 'string', description: 'Filtrar a partir desta data (opcional).' },
        dataFim: { type: 'string', description: 'Filtrar até esta data (opcional).' },
        limite: { type: 'integer', description: 'Máximo de lançamentos a listar. Padrão: 50.' },
      },
      required: ['caminhoArquivo'],
    },
  },
];

const IMPLEMENTATIONS = {
  enviar_documento_fiscal: onvio.enviarDocumentoFiscal,
  consultar_status_lote: onvio.consultarStatusLote,
  gerar_arquivo_lancamentos: lancamentos.gerarArquivoLancamentos,
  ler_arquivo_lancamentos: lancamentos.lerArquivoLancamentos,
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

module.exports = { TOOLS, executeTool };
