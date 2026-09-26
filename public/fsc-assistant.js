(function () {
  'use strict';

  const ENDPOINT = '/.netlify/functions/ask-ai';

  const STRINGS = {
    es: {
      greeting: 'Hola, soy tu asistente FSC. Pregúntame sobre el Factor de Sobrecosto, el PTV o recomendaciones para tu proyecto.',
      title: 'Asistente FSC',
      open: 'Abrir asistente FSC',
      clear: 'Limpiar',
      clearTitle: 'Limpiar conversación',
      close: 'Cerrar',
      placeholder: 'Pregunta sobre FSC, PTV, costos...',
      thinking: 'Pensando...',
      error: 'Lo siento, hubo un error al consultar el asistente. ',
      empty: 'No se obtuvo respuesta.',
      network: 'Error de conexión con el asistente. Inténtalo de nuevo.',
    },
    en: {
      greeting: "Hi, I'm your FSC assistant. Ask me about the Overhead Factor, the PTV or recommendations for your project.",
      title: 'FSC Assistant',
      open: 'Open FSC assistant',
      clear: 'Clear',
      clearTitle: 'Clear conversation',
      close: 'Close',
      placeholder: 'Ask about FSC, PTV, costs...',
      thinking: 'Thinking...',
      error: 'Sorry, something went wrong asking the assistant. ',
      empty: 'No answer was returned.',
      network: 'Could not reach the assistant. Please try again.',
    },
  };

  function getLang() {
    try {
      return localStorage.getItem('fsc-lang') === 'en' ? 'en' : 'es';
    } catch (e) {
      return 'es';
    }
  }
  function tr(key) {
    return STRINGS[getLang()][key];
  }
  function isGreeting(msg) {
    return msg.role === 'assistant' && (msg.content === STRINGS.es.greeting || msg.content === STRINGS.en.greeting);
  }

  function getProjectName() {
    try {
      return localStorage.getItem('fsc-project-name') || 'default';
    } catch (e) {
      return 'default';
    }
  }

  function getStorageKey() {
    const name = getProjectName().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_\-]/g, '');
    return `fsc-assistant-state-${name || 'default'}`;
  }

  let state = loadState();
  let isDragging = false;
  let dragOffset = { x: 0, y: 0 };
  let chatPanel = null;
  let messagesEl = null;
  let inputEl = null;

  function loadState() {
    try {
      const raw = localStorage.getItem(getStorageKey());
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return {
      open: false,
      messages: [{ role: 'assistant', content: tr('greeting') }],
      pos: null,
    };
  }

  function saveState() {
    try {
      localStorage.setItem(getStorageKey(), JSON.stringify(state));
    } catch (e) {}
  }

  function getCalculatorContext() {
    try {
      const paramsRaw = localStorage.getItem('fsc-current-params');
      const avanceRaw = localStorage.getItem('fsc-current-avance');
      const cobrosRaw = localStorage.getItem('fsc-current-cobros');
      const projectName = localStorage.getItem('fsc-project-name') || '';
      if (!paramsRaw) return null;
      const params = JSON.parse(paramsRaw);
      const avance = avanceRaw ? JSON.parse(avanceRaw) : [];
      const cobros = cobrosRaw ? JSON.parse(cobrosRaw) : [];
      const finalRaw = sessionStorage.getItem('fsc-final-result');
      const final = finalRaw ? JSON.parse(finalRaw) : null;
      const iterationsRaw = sessionStorage.getItem('fsc-iterations');
      const iterations = iterationsRaw ? JSON.parse(iterationsRaw) : [];

      // Determine CODIA applied
      let codiaAplicado = params.CODIA_MANUAL || 0;
      if (params.TIPO_OBRA_CODIA === 'Pública') codiaAplicado = params.CODIA_PUBLICA;
      if (params.TIPO_OBRA_CODIA === 'Privada') codiaAplicado = params.CODIA_PRIVADA;

      return {
        projectName,
        CD: params.CD,
        PTV: final ? final.PTV : null,
        FSC: final ? final.FSC : null,
        CO: params.CO,
        CC: params.CC,
        CI: params.CI,
        F: final ? final.F : null,
        CODIA_APLICADO: codiaAplicado,
        FON: params.FON,
        TPA: params.TPA,
        REA: params.REA,
        TEA: params.TEA,
        TASA_ACTIVA: params.TASA_ACTIVA,
        TASA_PASIVA: params.TASA_PASIVA,
        ANTICIPO: params.ANTICIPO,
        DESCUENTO: params.DESCUENTO,
        DURACION: params.DURACION,
        ISR: params.ISR,
        SGND: params.SGND,
        IMO: final ? final.IMO : null,
        PIT: final ? final.PIT : null,
        UC: final ? final.UC : null,
        RC: final ? final.RC : null,
        PCM: params.PCM,
        TIPO_OBRA_CODIA: params.TIPO_OBRA_CODIA,
        TASA_CAMBIO: params.TASA_CAMBIO,
        lang: getLang(),
        currency: localStorage.getItem('fsc-currency') === 'USD' ? 'USD' : 'DOP',
        avance,
        cobros,
        iterations,
        cashFlow: final ? final.cashFlow : null,
      };
    } catch (e) {
      return null;
    }
  }

  function createStyles() {
    if (document.getElementById('fsc-assistant-styles')) return;
    const style = document.createElement('style');
    style.id = 'fsc-assistant-styles';
    style.textContent = `
      #fsc-assistant-btn {
        position: fixed;
        bottom: 24px;
        right: 24px;
        width: 56px;
        height: 56px;
        border-radius: 50%;
        background: #2BA8C4;
        color: white;
        border: none;
        box-shadow: 0 4px 14px rgba(0,0,0,0.25);
        cursor: pointer;
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 22px;
        transition: transform 0.2s, background 0.2s;
      }
      #fsc-assistant-btn:hover { transform: scale(1.05); background: #248fa8; }
      #fsc-assistant-panel {
        position: fixed;
        bottom: 92px;
        right: 24px;
        width: 360px;
        height: 480px;
        background: #fbf7ee;
        border: 1px solid rgba(26,22,18,0.12);
        border-radius: 14px;
        box-shadow: 0 12px 40px rgba(0,0,0,0.18);
        z-index: 9999;
        display: none;
        flex-direction: column;
        overflow: hidden;
        font-family: 'IBM Plex Sans', system-ui, sans-serif;
        color: #1a1612;
      }
      #fsc-assistant-panel.open { display: flex; }
      #fsc-assistant-header {
        padding: 12px 14px;
        background: #2BA8C4;
        color: white;
        cursor: move;
        display: flex;
        align-items: center;
        justify-content: space-between;
        user-select: none;
      }
      #fsc-assistant-header strong { font-size: 14px; font-weight: 500; }
      #fsc-assistant-header button {
        background: transparent;
        border: none;
        color: white;
        cursor: pointer;
        font-size: 16px;
        padding: 2px 6px;
      }
      #fsc-assistant-clear {
        background: transparent;
        border: 1px solid rgba(255,255,255,0.4);
        color: white;
        cursor: pointer;
        font-size: 11px;
        padding: 3px 8px;
        border-radius: 6px;
        margin-right: 6px;
      }
      #fsc-assistant-clear:hover { background: rgba(255,255,255,0.15); }
      .fsc-msg strong { font-weight: 600; }
      #fsc-assistant-messages {
        flex: 1;
        overflow-y: auto;
        padding: 14px;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .fsc-msg {
        max-width: 86%;
        padding: 10px 12px;
        border-radius: 12px;
        font-size: 13px;
        line-height: 1.5;
        white-space: pre-wrap;
      }
      .fsc-msg.user {
        align-self: flex-end;
        background: #2BA8C4;
        color: white;
        border-bottom-right-radius: 4px;
      }
      .fsc-msg.assistant {
        align-self: flex-start;
        background: #fff;
        border: 1px solid rgba(26,22,18,0.10);
        border-bottom-left-radius: 4px;
      }
      #fsc-assistant-input-area {
        padding: 10px 12px;
        border-top: 1px solid rgba(26,22,18,0.10);
        background: #fff;
        display: flex;
        gap: 8px;
      }
      #fsc-assistant-input {
        flex: 1;
        border: 1px solid rgba(26,22,18,0.18);
        border-radius: 8px;
        padding: 8px 10px;
        font-size: 13px;
        font-family: inherit;
        resize: none;
        outline: none;
      }
      #fsc-assistant-input:focus { border-color: #2BA8C4; }
      #fsc-assistant-send {
        background: #2BA8C4;
        color: white;
        border: none;
        border-radius: 8px;
        padding: 0 14px;
        cursor: pointer;
        font-size: 14px;
      }
      #fsc-assistant-send:disabled { opacity: 0.6; cursor: not-allowed; }
      .fsc-typing {
        align-self: flex-start;
        font-size: 12px;
        color: #8a8276;
        padding: 4px 8px;
      }
    `;
    document.head.appendChild(style);
  }

  function createWidget() {
    if (document.getElementById('fsc-assistant-btn')) return;

    const btn = document.createElement('button');
    btn.id = 'fsc-assistant-btn';
    btn.innerHTML = '<i class="fa-solid fa-robot"></i>';
    btn.title = tr('title');
    btn.setAttribute('aria-label', tr('open'));
    btn.addEventListener('click', togglePanel);
    document.body.appendChild(btn);

    chatPanel = document.createElement('div');
    chatPanel.id = 'fsc-assistant-panel';
    if (state.open) chatPanel.classList.add('open');

    chatPanel.innerHTML = `
      <div id="fsc-assistant-header">
        <strong><i class="fa-solid fa-robot" style="margin-right:8px"></i><span id="fsc-assistant-title"></span></strong>
        <div>
          <button id="fsc-assistant-clear"></button>
          <button id="fsc-assistant-close">×</button>
        </div>
      </div>
      <div id="fsc-assistant-messages"></div>
      <div id="fsc-assistant-input-area">
        <textarea id="fsc-assistant-input" rows="1"></textarea>
        <button id="fsc-assistant-send"><i class="fa-solid fa-paper-plane"></i></button>
      </div>
    `;
    document.body.appendChild(chatPanel);

    messagesEl = chatPanel.querySelector('#fsc-assistant-messages');
    inputEl = chatPanel.querySelector('#fsc-assistant-input');

    chatPanel.querySelector('#fsc-assistant-close').addEventListener('click', togglePanel);
    chatPanel.querySelector('#fsc-assistant-clear').addEventListener('click', clearChat);
    chatPanel.querySelector('#fsc-assistant-send').addEventListener('click', sendMessage);
    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    // Auto-resize textarea
    inputEl.addEventListener('input', () => {
      inputEl.style.height = 'auto';
      inputEl.style.height = Math.min(inputEl.scrollHeight, 80) + 'px';
    });

    // Dragging
    const header = chatPanel.querySelector('#fsc-assistant-header');
    header.addEventListener('mousedown', startDrag);
    document.addEventListener('mousemove', onDrag);
    document.addEventListener('mouseup', stopDrag);

    applyLabels();
    renderMessages();
  }

  function applyLabels() {
    const btn = document.getElementById('fsc-assistant-btn');
    if (btn) {
      btn.title = tr('title');
      btn.setAttribute('aria-label', tr('open'));
    }
    chatPanel.querySelector('#fsc-assistant-title').textContent = tr('title');
    const clear = chatPanel.querySelector('#fsc-assistant-clear');
    clear.textContent = tr('clear');
    clear.title = tr('clearTitle');
    chatPanel.querySelector('#fsc-assistant-close').title = tr('close');
    inputEl.placeholder = tr('placeholder');
  }

  function togglePanel() {
    state.open = !state.open;
    chatPanel.classList.toggle('open', state.open);
    saveState();
    if (state.open) {
      setTimeout(() => inputEl && inputEl.focus(), 100);
    }
  }

  function startDrag(e) {
    isDragging = true;
    const rect = chatPanel.getBoundingClientRect();
    dragOffset.x = e.clientX - rect.left;
    dragOffset.y = e.clientY - rect.top;
    chatPanel.style.transition = 'none';
  }

  function onDrag(e) {
    if (!isDragging) return;
    e.preventDefault();
    let x = e.clientX - dragOffset.x;
    let y = e.clientY - dragOffset.y;
    const maxX = window.innerWidth - chatPanel.offsetWidth;
    const maxY = window.innerHeight - chatPanel.offsetHeight;
    x = Math.max(0, Math.min(x, maxX));
    y = Math.max(0, Math.min(y, maxY));
    chatPanel.style.left = x + 'px';
    chatPanel.style.top = y + 'px';
    chatPanel.style.right = 'auto';
    chatPanel.style.bottom = 'auto';
  }

  function stopDrag() {
    if (!isDragging) return;
    isDragging = false;
    chatPanel.style.transition = '';
    const rect = chatPanel.getBoundingClientRect();
    state.pos = { left: rect.left, top: rect.top };
    saveState();
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function renderMarkdown(text) {
    // Basic markdown: **bold**, *italic*, `code` — escaped first so model or
    // user text can never inject HTML
    let html = escapeHtml(text)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code>$1</code>');
    return html;
  }

  function renderMessages() {
    messagesEl.innerHTML = '';
    state.messages.forEach((msg) => {
      const div = document.createElement('div');
      div.className = 'fsc-msg ' + msg.role;
      div.innerHTML = renderMarkdown(isGreeting(msg) ? tr('greeting') : msg.content);
      messagesEl.appendChild(div);
    });
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function addMessage(role, content) {
    state.messages.push({ role, content });
    if (state.messages.length > 50) state.messages = state.messages.slice(-50);
    saveState();
    renderMessages();
  }

  function clearChat() {
    state.messages = [{ role: 'assistant', content: tr('greeting') }];
    saveState();
    renderMessages();
  }

  // Load each project's chat history separately
  let lastStorageKey = getStorageKey();
  let lastLang = getLang();
  setInterval(() => {
    if (!chatPanel) return;
    const currentKey = getStorageKey();
    if (currentKey !== lastStorageKey) {
      lastStorageKey = currentKey;
      state = loadState();
      renderMessages();
    }
    const lang = getLang();
    if (lang !== lastLang) {
      lastLang = lang;
      applyLabels();
      renderMessages();
    }
  }, 1000);

  async function sendMessage() {
    const text = inputEl.value.trim();
    if (!text) return;

    inputEl.value = '';
    inputEl.style.height = 'auto';
    addMessage('user', text);

    const sendBtn = chatPanel.querySelector('#fsc-assistant-send');
    sendBtn.disabled = true;

    const typing = document.createElement('div');
    typing.className = 'fsc-typing';
    typing.textContent = tr('thinking');
    messagesEl.appendChild(typing);
    messagesEl.scrollTop = messagesEl.scrollHeight;

    const context = getCalculatorContext();
    const history = state.messages.slice(0, -1).filter((m) => !isGreeting(m)).map((m) => ({ role: m.role, content: m.content }));

    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: text, context, history }),
      });
      typing.remove();
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        addMessage('assistant', tr('error') + (err.error || ''));
        return;
      }
      const data = await res.json();
      addMessage('assistant', data.answer || tr('empty'));
    } catch (err) {
      typing.remove();
      addMessage('assistant', tr('network'));
    } finally {
      sendBtn.disabled = false;
    }
  }

  // Restore position
  function restorePosition() {
    if (state.pos && chatPanel) {
      chatPanel.style.left = state.pos.left + 'px';
      chatPanel.style.top = state.pos.top + 'px';
      chatPanel.style.right = 'auto';
      chatPanel.style.bottom = 'auto';
    }
  }

  function init() {
    createStyles();
    createWidget();
    restorePosition();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
