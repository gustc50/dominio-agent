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

  const onvioDot = el('statusOnvioDot');
  const onvioText = el('statusOnvioText');
  const conectado = Boolean(settings.onvio.refreshToken);
  onvioDot.classList.toggle('ok', conectado);
  onvioText.textContent = conectado ? 'Onvio conectado' : 'Onvio desconectado';
}

function fillFormFromSettings(settings) {
  const provider = settings.llm.provider;
  if (provider === 'claude') el('providerClaude').checked = true;
  if (provider === 'openrouter') el('providerOpenrouter').checked = true;

  el('claudeApiKey').value = settings.llm.claude.apiKey || '';
  el('claudeModel').value = settings.llm.claude.model || 'claude-sonnet-5';

  el('openrouterApiKey').value = settings.llm.openrouter.apiKey || '';
  el('openrouterModel').value = settings.llm.openrouter.model || '';

  el('onvioClientId').value = settings.onvio.clientId || '';
  el('onvioClientSecret').value = settings.onvio.clientSecret || '';
  el('onvioCallbackUrl').value = settings.onvio.callbackUrl || '';

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
    onvio: {
      clientId: el('onvioClientId').value.trim(),
      clientSecret: el('onvioClientSecret').value.trim(),
      callbackUrl: el('onvioCallbackUrl').value.trim(),
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
  input.value = '';
  el('sendBtn').disabled = true;

  try {
    // O histórico enviado é o das mensagens anteriores: os provedores acrescentam
    // `userText` ao final por conta própria.
    const response = await window.api.sendMessage({ userText: text, history: state.history });
    appendMessage('assistant', response.text);
    state.history.push({ role: 'user', text });
    state.history.push({ role: 'assistant', text: response.text });
  } catch (err) {
    appendMessage('assistant', `⚠️ ${err.message || err}`);
  } finally {
    el('sendBtn').disabled = false;
    input.focus();
  }
}

async function handleOnvioLogin() {
  const resultEl = el('onvioLoginResult');
  resultEl.textContent = 'Abrindo a tela de login do Onvio...';
  resultEl.className = 'hint';

  try {
    // O processo principal lê as credenciais do arquivo de configurações,
    // então o que está no formulário precisa estar salvo antes do login.
    state.settings = await window.api.saveSettings(gatherSettingsFromForm());

    const result = await window.api.onvioLogin();
    resultEl.textContent = result.mensagem;
    resultEl.className = 'hint ok';

    state.settings = await window.api.getSettings();
    updateStatusIndicators(state.settings);
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

  el('onvioLoginBtn').addEventListener('click', handleOnvioLogin);
  el('saveSettingsBtn').addEventListener('click', handleSaveSettings);

  state.settings = await window.api.getSettings();
  fillFormFromSettings(state.settings);
}

init();
