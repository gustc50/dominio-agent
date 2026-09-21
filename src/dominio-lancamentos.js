// Leiaute Domínio — Lançamentos Contábeis em Lote (arquivo posicional).
//
// Mesmo formato usado pelo Domínio Contábil na importação
// (Utilitários -> Importação -> Lançamentos Contábeis em Lote) e na exportação
// (Utilitários -> Exportação -> Lançamentos), o que permite tanto gerar um
// arquivo para importar quanto ler um arquivo exportado.
//
// Características: posicional (largura fixa), encoding Latin-1 sem BOM, quebra
// de linha CRLF inclusive na última linha, valores em centavos e datas dd/mm/aaaa.
//
// Só é gerada partida simples (um débito e um crédito por lançamento): o
// comportamento do Domínio com partida múltipla neste leiaute não é conhecido.

const fs = require('fs');

const TAM = {
  cabecalho: 55,
  lancamento: 165,
  partida: 664,
  rodape: 100,
};

function numero(valor, tamanho) {
  const digitos = String(valor == null ? '' : valor).replace(/\D/g, '');
  if (digitos.length > tamanho) {
    throw new Error(`Valor numérico "${valor}" excede ${tamanho} dígitos.`);
  }
  return digitos.padStart(tamanho, '0');
}

// O arquivo é Latin-1: caracteres fora dessa tabela e de controle corromperiam
// o alinhamento posicional.
function texto(valor, tamanho) {
  const limpo = String(valor == null ? '' : valor)
    .replace(/[\r\n\t]/g, ' ')
    .split('')
    .filter((c) => c.charCodeAt(0) <= 255 && c.charCodeAt(0) >= 32)
    .join('');
  return limpo.slice(0, tamanho).padEnd(tamanho, ' ');
}

function normalizarData(entrada) {
  const bruto = String(entrada || '').trim();

  let ano;
  let mes;
  let dia;

  const iso = bruto.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const br = bruto.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);

  if (iso) {
    [, ano, mes, dia] = iso;
  } else if (br) {
    [, dia, mes, ano] = br;
  } else {
    throw new Error(`Data inválida: "${entrada}". Use AAAA-MM-DD ou DD/MM/AAAA.`);
  }

  const data = new Date(Number(ano), Number(mes) - 1, Number(dia));
  if (
    data.getFullYear() !== Number(ano) ||
    data.getMonth() !== Number(mes) - 1 ||
    data.getDate() !== Number(dia)
  ) {
    throw new Error(`Data inexistente no calendário: "${entrada}".`);
  }

  return { formatada: `${dia}/${mes}/${ano}`, data };
}

function paraCentavos(valor) {
  if (typeof valor === 'number') {
    if (!Number.isFinite(valor)) throw new Error(`Valor inválido: ${valor}`);
    return Math.round(valor * 100);
  }

  const bruto = String(valor == null ? '' : valor).trim().replace(/[R$\s]/g, '');
  // "1.234,56" (pt-BR) vira "1234.56"; "1234.56" é mantido.
  const normalizado = bruto.includes(',')
    ? bruto.replace(/\./g, '').replace(',', '.')
    : bruto;

  const numeroValor = Number(normalizado);
  if (!Number.isFinite(numeroValor)) throw new Error(`Valor inválido: "${valor}"`);
  return Math.round(numeroValor * 100);
}

function montarCabecalho({ codigoEmpresa, cnpj, dataInicial, dataFinal, numeroLote }) {
  return (
    '01' +
    numero(codigoEmpresa, 7) +
    numero(cnpj, 14) +
    texto(dataInicial, 10) +
    texto(dataFinal, 10) +
    'N' +
    '05' +
    numero(numeroLote, 8) +
    '1'
  );
}

function montarLancamento({ sequencial, data }) {
  return (
    '02' +
    numero(sequencial, 7) +
    'X' +
    texto(data, 10) +
    texto('', 45) +
    'N' +
    texto('', 99)
  );
}

function montarPartida({ sequencial, contaDebito, contaCredito, centavos, codigoHistorico, complemento, codigoEmpresa }) {
  return (
    '03' +
    numero(sequencial, 7) +
    numero(contaDebito, 7) +
    numero(contaCredito, 7) +
    numero(centavos, 15) +
    numero(codigoHistorico || 0, 7) +
    texto(String(complemento || '').toUpperCase(), 512) +
    numero(codigoEmpresa, 7) +
    texto('', 100)
  );
}

function gerarArquivoLancamentos({
  caminhoSaida,
  codigoEmpresa,
  cnpj,
  numeroLote,
  lancamentos,
}) {
  if (!caminhoSaida) return { erro: 'Informe o caminho onde o arquivo deve ser gravado.' };
  if (!codigoEmpresa) return { erro: 'Informe o código da empresa no Domínio.' };
  if (!cnpj) return { erro: 'Informe o CNPJ/CPF da empresa.' };
  if (!Array.isArray(lancamentos) || lancamentos.length === 0) {
    return { erro: 'Informe ao menos um lançamento.' };
  }

  const preparados = [];

  for (let i = 0; i < lancamentos.length; i++) {
    const l = lancamentos[i] || {};
    const posicao = i + 1;

    if (!l.contaDebito) return { erro: `Lançamento ${posicao}: conta de débito não informada.` };
    if (!l.contaCredito) return { erro: `Lançamento ${posicao}: conta de crédito não informada.` };

    let data;
    let centavos;
    try {
      data = normalizarData(l.data);
      centavos = paraCentavos(l.valor);
    } catch (err) {
      return { erro: `Lançamento ${posicao}: ${err.message}` };
    }

    if (centavos <= 0) return { erro: `Lançamento ${posicao}: o valor deve ser maior que zero.` };

    preparados.push({
      data,
      contaDebito: l.contaDebito,
      contaCredito: l.contaCredito,
      centavos,
      codigoHistorico: l.codigoHistorico,
      complemento: l.complemento,
    });
  }

  preparados.sort((a, b) => a.data.data - b.data.data);

  const linhas = [];

  try {
    linhas.push(
      montarCabecalho({
        codigoEmpresa,
        cnpj,
        dataInicial: preparados[0].data.formatada,
        dataFinal: preparados[preparados.length - 1].data.formatada,
        numeroLote: numeroLote || 1,
      })
    );

    preparados.forEach((l, indice) => {
      linhas.push(montarLancamento({ sequencial: 2 * indice + 1, data: l.data.formatada }));
      linhas.push(
        montarPartida({
          sequencial: 2 * indice + 2,
          contaDebito: l.contaDebito,
          contaCredito: l.contaCredito,
          centavos: l.centavos,
          codigoHistorico: l.codigoHistorico,
          complemento: l.complemento,
          codigoEmpresa,
        })
      );
    });
  } catch (err) {
    return { erro: err.message };
  }

  linhas.push('9'.repeat(TAM.rodape));

  const conteudo = linhas.map((linha) => `${linha}\r\n`).join('');

  try {
    fs.writeFileSync(caminhoSaida, Buffer.from(conteudo, 'latin1'));
  } catch (err) {
    return { erro: `Não foi possível gravar o arquivo: ${err.message}` };
  }

  const totalCentavos = preparados.reduce((soma, l) => soma + l.centavos, 0);

  return {
    arquivo: caminhoSaida,
    quantidadeLancamentos: preparados.length,
    valorTotal: totalCentavos / 100,
    periodo: {
      dataInicial: preparados[0].data.formatada,
      dataFinal: preparados[preparados.length - 1].data.formatada,
    },
    comoImportar:
      'No Domínio: Utilitários -> Importação -> Lançamentos Contábeis em Lote (Leiaute Domínio Sistemas).',
    atencao:
      'Confira o lote no Domínio antes de confirmar a importação. O arquivo contém apenas ' +
      'partidas simples (um débito e um crédito por lançamento). Se o código de histórico ' +
      'informado não estiver cadastrado na empresa, o Domínio pode recusar: nesse caso gere ' +
      'novamente sem código de histórico.',
  };
}

function lerArquivoLancamentos({ caminhoArquivo, dataInicio, dataFim, limite }) {
  if (!caminhoArquivo) return { erro: 'Informe o caminho do arquivo exportado do Domínio.' };
  if (!fs.existsSync(caminhoArquivo)) return { erro: `Arquivo não encontrado: ${caminhoArquivo}` };

  let conteudo;
  try {
    conteudo = fs.readFileSync(caminhoArquivo).toString('latin1');
  } catch (err) {
    return { erro: `Não foi possível ler o arquivo: ${err.message}` };
  }

  const linhas = conteudo.split(/\r?\n/).filter((linha) => linha.trim().length > 0);
  if (linhas.length === 0) return { erro: 'O arquivo está vazio.' };

  let filtroInicio = null;
  let filtroFim = null;
  try {
    if (dataInicio) filtroInicio = normalizarData(dataInicio).data;
    if (dataFim) filtroFim = normalizarData(dataFim).data;
  } catch (err) {
    return { erro: err.message };
  }

  let empresa = null;
  const lancamentos = [];
  let dataAtual = null;

  for (const linha of linhas) {
    const tipo = linha.slice(0, 2);

    if (tipo === '01') {
      empresa = {
        codigoEmpresa: linha.slice(2, 9).replace(/^0+/, '') || '0',
        cnpj: linha.slice(9, 23),
        dataInicial: linha.slice(23, 33).trim(),
        dataFinal: linha.slice(33, 43).trim(),
      };
      continue;
    }

    if (tipo === '02') {
      dataAtual = linha.slice(10, 20).trim();
      continue;
    }

    if (tipo === '03') {
      const complemento = linha.slice(45, 557).trim();
      const codigoHistorico = linha.slice(38, 45).replace(/^0+/, '');
      const centavos = Number(linha.slice(23, 38).replace(/\D/g, '') || '0');

      lancamentos.push({
        data: dataAtual,
        contaDebito: linha.slice(9, 16).replace(/^0+/, '') || '0',
        contaCredito: linha.slice(16, 23).replace(/^0+/, '') || '0',
        valor: centavos / 100,
        codigoHistorico: codigoHistorico || null,
        complemento,
      });
    }
  }

  let filtrados = lancamentos;
  if (filtroInicio || filtroFim) {
    filtrados = lancamentos.filter((l) => {
      if (!l.data) return false;
      let data;
      try {
        data = normalizarData(l.data).data;
      } catch (err) {
        return false;
      }
      if (filtroInicio && data < filtroInicio) return false;
      if (filtroFim && data > filtroFim) return false;
      return true;
    });
  }

  const valorTotal = filtrados.reduce((soma, l) => soma + l.valor, 0);
  const maximo = limite && limite > 0 ? limite : 50;

  return {
    empresa,
    totalEncontrado: filtrados.length,
    valorTotal: Math.round(valorTotal * 100) / 100,
    lancamentosRetornados: filtrados.length > maximo ? maximo : filtrados.length,
    lancamentos: filtrados.slice(0, maximo),
    observacao:
      filtrados.length > maximo
        ? `Exibindo ${maximo} de ${filtrados.length} lançamentos. O total e a soma acima consideram todos.`
        : undefined,
  };
}

module.exports = { gerarArquivoLancamentos, lerArquivoLancamentos };
