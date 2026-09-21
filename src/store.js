const { app } = require('electron');
const fs = require('fs');
const path = require('path');

const DEFAULT_SETTINGS = {
  llm: {
    provider: null, // 'claude' | 'openrouter'
    claude: { apiKey: '', model: 'claude-sonnet-5' },
    openrouter: { apiKey: '', model: '' },
  },
  onvio: {
    clientId: '',
    clientSecret: '',
    callbackUrl: '',
    accessToken: '',
    refreshToken: '',
  },
};

function getSettingsPath() {
  return path.join(app.getPath('userData'), 'settings.json');
}

function mergeDefaults(parsed) {
  parsed = parsed || {};
  const llm = parsed.llm || {};
  return {
    llm: {
      ...DEFAULT_SETTINGS.llm,
      ...llm,
      claude: { ...DEFAULT_SETTINGS.llm.claude, ...llm.claude },
      openrouter: { ...DEFAULT_SETTINGS.llm.openrouter, ...llm.openrouter },
    },
    onvio: { ...DEFAULT_SETTINGS.onvio, ...parsed.onvio },
  };
}

function getSettings() {
  try {
    const raw = fs.readFileSync(getSettingsPath(), 'utf-8');
    return mergeDefaults(JSON.parse(raw));
  } catch (err) {
    return mergeDefaults({});
  }
}

// Mescla sobre o que já está salvo: o formulário da interface não envia os tokens
// OAuth, então salvar as configurações não pode derrubar a sessão ativa do Onvio.
function saveSettings(settings) {
  const atual = getSettings();
  const entrada = settings || {};
  const llm = entrada.llm || {};

  const merged = {
    llm: {
      ...atual.llm,
      ...llm,
      claude: { ...atual.llm.claude, ...llm.claude },
      openrouter: { ...atual.llm.openrouter, ...llm.openrouter },
    },
    onvio: { ...atual.onvio, ...entrada.onvio },
  };

  const settingsPath = getSettingsPath();
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(settingsPath, JSON.stringify(merged, null, 2), 'utf-8');
  return merged;
}

module.exports = { getSettings, saveSettings, DEFAULT_SETTINGS };
