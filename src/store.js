const { app } = require('electron');
const fs = require('fs');
const path = require('path');

const DEFAULT_SETTINGS = {
  llm: {
    provider: null, // 'claude' | 'openrouter'
    claude: { apiKey: '', model: 'claude-sonnet-5' },
    openrouter: { apiKey: '', model: '' },
  },
  dominio: {
    apiKey: '',
    baseUrl: '',
    authHeader: 'Authorization',
  },
};

function getSettingsPath() {
  return path.join(app.getPath('userData'), 'settings.json');
}

function mergeDefaults(parsed) {
  parsed = parsed || {};
  const llm = parsed.llm || {};
  const dominio = parsed.dominio || {};
  return {
    llm: {
      ...DEFAULT_SETTINGS.llm,
      ...llm,
      claude: { ...DEFAULT_SETTINGS.llm.claude, ...llm.claude },
      openrouter: { ...DEFAULT_SETTINGS.llm.openrouter, ...llm.openrouter },
    },
    dominio: { ...DEFAULT_SETTINGS.dominio, ...dominio },
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

function saveSettings(settings) {
  const merged = mergeDefaults(settings);
  const settingsPath = getSettingsPath();
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(settingsPath, JSON.stringify(merged, null, 2), 'utf-8');
  return merged;
}

module.exports = { getSettings, saveSettings, DEFAULT_SETTINGS };
