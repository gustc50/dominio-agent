// Transforma a resposta de erro de um provedor de IA numa mensagem que faça
// sentido para o usuário final, em vez de despejar o JSON cru da API na tela.
function mensagemErroHttp(provedor, status, corpo) {
  let detalhe = String(corpo || '').trim();

  try {
    const json = JSON.parse(detalhe);
    detalhe = (json.error && (json.error.message || json.error.type)) || json.message || detalhe;
  } catch (err) {
    // corpo não era JSON: segue com o texto bruto
  }

  detalhe = detalhe.slice(0, 200);

  if (status === 401 || status === 403) {
    return `Chave de API do ${provedor} inválida ou sem permissão. Confira na aba Configurações. (${detalhe})`;
  }
  if (status === 404) {
    return `Modelo não encontrado no ${provedor}. Confira o nome do modelo na aba Configurações. (${detalhe})`;
  }
  if (status === 429) {
    return `Limite de uso do ${provedor} atingido. Aguarde alguns instantes e tente de novo. (${detalhe})`;
  }
  if (status >= 500) {
    return `O ${provedor} está indisponível no momento (HTTP ${status}). Tente novamente em instantes.`;
  }

  return `Erro do ${provedor} (HTTP ${status}): ${detalhe}`;
}

module.exports = { mensagemErroHttp };
