// Ferramentas (function calling) que o agente de IA pode chamar.
//
// Estas ferramentas usam a Onvio BR Accounting API real (Domínio / Thomson Reuters),
// cujo escopo é a integração de documentos fiscais eletrônicos (NF-e, NFC-e, CT-e,
// CF-e) com o Domínio Contábil: envio de XMLs em lote e consulta do processamento.

const onvio = require('./onvio-client');

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
];

const IMPLEMENTATIONS = {
  enviar_documento_fiscal: onvio.enviarDocumentoFiscal,
  consultar_status_lote: onvio.consultarStatusLote,
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
