// Cliente da Onvio BR Accounting API (Domínio / Thomson Reuters).
//
// Autenticação: OAuth 2.0 authorization code + refresh token.
// As credenciais (client_id / client_secret) e a callback URL são liberadas pela
// equipe da API Onvio BR mediante solicitação por e-mail.

const { BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const store = require('./store');

const AUTHORIZE_URL = 'https://auth.thomsonreuters.com/authorize';
const TOKEN_URL = 'https://auth.thomsonreuters.com/oauth/token';
const BATCHES_URL = 'https://api.onvio.com.br/dominio/invoice/v2/batches';
const AUDIENCE = '409f91f6-dc17-44c8-a5d8-e0a1bafd8b67';
const SCOPE = 'openid profile email offline_access';

function buildAuthorizeUrl({ clientId, callbackUrl }) {
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    audience: AUDIENCE,
    redirect_uri: callbackUrl,
    scope: SCOPE,
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

function extrairCode(url) {
  try {
    return new URL(url).searchParams.get('code');
  } catch (err) {
    return null;
  }
}

// Abre a tela de login da Thomson Reuters e intercepta o redirecionamento para a
// callback URL, de onde extraímos o authorization code.
function abrirJanelaLogin(authorizeUrl, parentWindow) {
  return new Promise((resolve, reject) => {
    const authWindow = new BrowserWindow({
      width: 620,
      height: 820,
      parent: parentWindow || undefined,
      modal: Boolean(parentWindow),
      autoHideMenuBar: true,
      title: 'Login Onvio / Domínio',
      webPreferences: { nodeIntegration: false, contextIsolation: true },
    });

    let finalizado = false;

    const concluir = (acao, valor) => {
      if (finalizado) return;
      finalizado = true;
      acao(valor);
      if (!authWindow.isDestroyed()) authWindow.destroy();
    };

    const verificarUrl = (url) => {
      const code = extrairCode(url);
      if (code) concluir(resolve, code);
    };

    authWindow.webContents.on('will-redirect', (_event, url) => verificarUrl(url));
    authWindow.webContents.on('will-navigate', (_event, url) => verificarUrl(url));
    authWindow.webContents.on('did-navigate', (_event, url) => verificarUrl(url));

    authWindow.on('closed', () => {
      if (!finalizado) {
        finalizado = true;
        reject(new Error('Login cancelado: a janela foi fechada antes da autorização.'));
      }
    });

    authWindow.loadURL(authorizeUrl);
  });
}

async function requisitarToken({ clientId, clientSecret, body }) {
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      authorization: `Basic ${basic}`,
    },
    body: new URLSearchParams(body).toString(),
  });

  const texto = await res.text();
  if (!res.ok) {
    throw new Error(`Falha na autenticação Onvio (HTTP ${res.status}): ${texto.slice(0, 300)}`);
  }

  try {
    return JSON.parse(texto);
  } catch (err) {
    throw new Error(`Resposta inesperada do servidor de autenticação: ${texto.slice(0, 300)}`);
  }
}

function salvarTokens(tokens) {
  const settings = store.getSettings();
  settings.onvio.accessToken = tokens.access_token || '';
  if (tokens.refresh_token) settings.onvio.refreshToken = tokens.refresh_token;
  store.saveSettings(settings);
}

async function login(parentWindow) {
  const { onvio } = store.getSettings();
  if (!onvio.clientId || !onvio.clientSecret || !onvio.callbackUrl) {
    throw new Error('Preencha Client ID, Client Secret e Callback URL antes de conectar.');
  }

  const code = await abrirJanelaLogin(buildAuthorizeUrl(onvio), parentWindow);

  const tokens = await requisitarToken({
    clientId: onvio.clientId,
    clientSecret: onvio.clientSecret,
    body: { grant_type: 'authorization_code', redirect_uri: onvio.callbackUrl, code },
  });

  salvarTokens(tokens);
  return { ok: true, mensagem: 'Conectado ao Onvio/Domínio com sucesso.' };
}

async function renovarToken() {
  const { onvio } = store.getSettings();
  if (!onvio.refreshToken) {
    throw new Error('Não há sessão ativa com o Onvio. Conecte-se na aba Configurações.');
  }

  const tokens = await requisitarToken({
    clientId: onvio.clientId,
    clientSecret: onvio.clientSecret,
    body: { grant_type: 'refresh_token', refresh_token: onvio.refreshToken },
  });

  salvarTokens(tokens);
  return tokens.access_token;
}

// `construirOptions` é uma função para que o corpo da requisição seja recriado a
// cada tentativa (um FormData já consumido não pode ser reenviado).
async function requisicaoAutenticada(url, construirOptions, jaRenovou = false) {
  const { onvio } = store.getSettings();
  let token = onvio.accessToken;
  if (!token) token = await renovarToken();

  const base = construirOptions();
  const res = await fetch(url, {
    ...base,
    headers: { accept: 'application/json', ...(base.headers || {}), authorization: `Bearer ${token}` },
  });

  if (res.status === 401 && !jaRenovou) {
    await renovarToken();
    return requisicaoAutenticada(url, construirOptions, true);
  }

  return res;
}

async function enviarDocumentoFiscal({ caminhoArquivo }) {
  if (!caminhoArquivo) return { erro: 'Informe o caminho do arquivo XML a ser enviado.' };
  if (!fs.existsSync(caminhoArquivo)) return { erro: `Arquivo não encontrado: ${caminhoArquivo}` };

  const conteudo = fs.readFileSync(caminhoArquivo);
  const nomeArquivo = path.basename(caminhoArquivo);

  const res = await requisicaoAutenticada(BATCHES_URL, () => {
    const form = new FormData();
    form.append('query', new Blob([JSON.stringify({ 'boxe/File': true })], { type: 'application/json' }));
    form.append('file[]', new Blob([conteudo], { type: 'application/xml' }), nomeArquivo);
    return { method: 'POST', body: form };
  });

  const texto = await res.text();

  if (res.status === 201) {
    try {
      const dados = JSON.parse(texto);
      return {
        loteId: dados.id,
        status: dados.status,
        arquivo: nomeArquivo,
        mensagem: 'Documento enviado para processamento no Domínio.',
      };
    } catch (err) {
      return { erro: `Resposta inesperada do Onvio: ${texto.slice(0, 300)}` };
    }
  }

  const motivos = {
    400: 'Dados inválidos na requisição',
    401: 'Token de acesso inválido',
    404: 'Recurso não encontrado',
    500: 'Erro inesperado no servidor do Onvio',
  };
  const motivo = motivos[res.status] || 'Falha no envio';
  return { erro: `${motivo} (HTTP ${res.status}): ${texto.slice(0, 300)}` };
}

async function consultarStatusLote({ loteId }) {
  if (!loteId) return { erro: 'Informe o ID do lote retornado no envio.' };

  const res = await requisicaoAutenticada(
    `${BATCHES_URL}/${encodeURIComponent(loteId)}`,
    () => ({ method: 'GET' })
  );

  const texto = await res.text();
  if (!res.ok) {
    return { erro: `Falha ao consultar status (HTTP ${res.status}): ${texto.slice(0, 300)}` };
  }

  try {
    return JSON.parse(texto);
  } catch (err) {
    return { resposta: texto.slice(0, 500) };
  }
}

module.exports = { login, enviarDocumentoFiscal, consultarStatusLote };
