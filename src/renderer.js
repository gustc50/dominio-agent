const state = {
  settings: null,
  history: [],
};

const el = (id) => document.getElementById(id);

function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  document.querySelectorAll('.view').forEach((view) => {
    view.classList.toggle('active', view.id === `view-${tab}`);
  });
}

function updateProviderFieldsVisibility() {
  const provider = document.querySelector('input[name="provider"]:checked');
  el('claudeFields').style.display = provider && provider.value === 'claude' ? 'flex' : 'none';
  el('openrouterFields').style.display = provider && provider.value === 'openrouter' ? 'flex' : 'none';
}

function updateStatusIndicators(settings) {
  const provider = settings.llm.provider;
  const llmDot = el('statusLlmDot');
  const llmText = el('statusLlmText');
  if (provider && settings.llm[provider] && settings.llm[provider].apiKey) {
    llmDot.classList.add('ok');
    llmText.textContent = provider === 'claude' ? 'Claude configurado' : 'OpenRouter configurado';
  } else {
    llmDot.classList.remove('ok');
    llmText.textContent = 'IA não configurada';
  }

  const dominioDot = el('statusDominioDot');
  const dominioText = el('statusDominioText');
  if (settings.dominio.apiKey && settings.dominio.baseUrl) {
    dominioDot.classList.add('ok');
    dominioText.textContent = 'Domínio configurado';
  } else {
    dominioDot.classList.remove('ok');
    dominioText.textContent = 'Domínio não configurado';
  }
}

function fillFormFromSettings(settings) {
  const provider = settings.llm.provider;
  if (provider === 'claude') el('providerClaude').checked = true;
  if (provider === 'openrouter') el('providerOpenrouter').checked = true;

  el('claudeApiKey').value = settings.llm.claude.apiKey || '';
  el('claudeModel').value = settings.llm.claude.model || 'claude-sonnet-5';

  el('openrouterApiKey').value = settings.llm.openrouter.apiKey || '';
  el('openrouterModel').value = settings.llm.openrouter.model || '';

  el('dominioApiKey').value = settings.dominio.apiKey || '';
  el('dominioBaseUrl').value = settings.dominio.baseUrl || '';
  el('dominioAuthHeader').value = settings.dominio.authHeader || 'Authorization';

  updateProviderFieldsVisibility();
  updateStatusIndicators(settings);
}

function gatherSettingsFromForm() {
  const providerInput = document.querySelector('input[name="provider"]:checked');
  return {
    llm: {
      provider: providerInput ? providerInput.value : null,
      claude: {
        apiKey: el('claudeApiKey').value.trim(),
        model: el('claudeModel').value,
      },
      openrouter: {
        apiKey: el('openrouterApiKey').value.trim(),
        model: el('openrouterModel').value.trim(),
      },
    },
    dominio: {
      apiKey: el('dominioApiKey').value.trim(),
      baseUrl: el('dominioBaseUrl').value.trim(),
      authHeader: el('dominioAuthHeader').value.trim() || 'Authorization',
    },
  };
}

function appendMessage(role, text) {
  const log = el('chatLog');
  const wrapper = document.createElement('div');
  wrapper.className = `msg msg-${role}`;
  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble';
  bubble.textContent = text;
  wrapper.appendChild(bubble);
  log.appendChild(wrapper);
  log.scrollTop = log.scrollHeight;
}

async function handleChatSubmit(event) {
  event.preventDefault();
  const input = el('chatInput');
  const text = input.value.trim();
  if (!text) return;

  appendMessage('user', text);
  state.history.push({ role: 'user', text });
  input.value = '';
  el('sendBtn').disabled = true;

  try {
    const response = await window.api.sendMessage({ userText: text, history: state.history });
    appendMessage('assistant', response.text);
    state.history.push({ role: 'assistant', text: response.text });
  } catch (err) {
    appendMessage('assistant', `⚠️ ${err.message || err}`);
  } finally {
    el('sendBtn').disabled = false;
    input.focus();
  }
}

async function handleTestDominio() {
  const resultEl = el('dominioTestResult');
  resultEl.textContent = 'Testando...';
  resultEl.className = 'hint';
  const config = {
    baseUrl: el('dominioBaseUrl').value.trim(),
    apiKey: el('dominioApiKey').value.trim(),
    authHeader: el('dominioAuthHeader').value.trim() || 'Authorization',
  };
  try {
    const result = await window.api.testDominioConnection(config);
    resultEl.textContent = result.mensagem;
    resultEl.className = result.ok ? 'hint ok' : 'hint error';
  } catch (err) {
    resultEl.textContent = `Erro: ${err.message || err}`;
    resultEl.className = 'hint error';
  }
}

async function handleSaveSettings() {
  const settings = gatherSettingsFromForm();
  const saved = await window.api.saveSettings(settings);
  state.settings = saved;
  updateStatusIndicators(saved);
  const status = el('saveStatus');
  status.textContent = 'Configurações salvas com sucesso.';
  setTimeout(() => {
    status.textContent = '';
  }, 3000);
}

async function init() {
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  document.querySelectorAll('input[name="provider"]').forEach((input) => {
    input.addEventListener('change', updateProviderFieldsVisibility);
  });

  el('chatForm').addEventListener('submit', handleChatSubmit);
  el('chatInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      el('chatForm').requestSubmit();
    }
  });

  el('testDominioBtn').addEventListener('click', handleTestDominio);
  el('saveSettingsBtn').addEventListener('click', handleSaveSettings);

  state.settings = await window.api.getSettings();
  fillFormFromSettings(state.settings);
}

init();
