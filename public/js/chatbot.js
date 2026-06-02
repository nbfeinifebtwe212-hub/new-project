// ===================================
// chatbot.js - チャットボット機能
// ===================================

(function initChatbot() {
  const widget   = document.getElementById('chatWidget');
  const toggle   = document.getElementById('chatToggle');
  const closeBtn = document.getElementById('chatClose');
  const chatWin  = document.getElementById('chatWindow');
  const messages = document.getElementById('chatMessages');
  const input    = document.getElementById('chatInput');
  const sendBtn  = document.getElementById('chatSend');

  // Claude API形式の会話履歴
  let history = [];
  let isStreaming = false;

  // ===================================
  // チャットウィンドウの開閉
  // ===================================
  function openChat() {
    widget.classList.add('open');
    chatWin.setAttribute('aria-hidden', 'false');
    input.focus();
    scrollToBottom();
  }

  function closeChat() {
    widget.classList.remove('open');
    chatWin.setAttribute('aria-hidden', 'true');
  }

  toggle.addEventListener('click', () => {
    widget.classList.contains('open') ? closeChat() : openChat();
  });

  closeBtn.addEventListener('click', closeChat);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && widget.classList.contains('open')) closeChat();
  });

  // ===================================
  // 入力欄の制御
  // ===================================
  input.addEventListener('input', updateSendBtn);

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !isStreaming) {
      e.preventDefault();
      handleSend();
    }
  });

  sendBtn.addEventListener('click', handleSend);

  function updateSendBtn() {
    const hasText = input.value.trim().length > 0;
    if (hasText && !isStreaming) {
      sendBtn.removeAttribute('disabled');
    } else {
      sendBtn.setAttribute('disabled', '');
    }
  }

  // ===================================
  // メッセージ送信
  // ===================================
  async function handleSend() {
    const text = input.value.trim();
    if (!text || isStreaming) return;

    input.value = '';
    updateSendBtn();

    // ユーザーメッセージを画面に表示
    appendMessage('user', text);

    // 会話履歴に追記
    history.push({ role: 'user', content: text });

    // タイピングアニメーション表示
    const typingEl = showTyping();
    isStreaming = true;

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      // タイピング表示を消してボット吹き出しを準備
      typingEl.remove();
      const bubble = createBotBubble();

      let fullText = '';

      // SSEストリームを逐次読み込み
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // バッファに追記して行単位で処理（チャンク境界対策）
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');

        // 最後の行は不完全な可能性があるためバッファに残す
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;

          const payload = trimmed.slice(5).trim();
          if (payload === '[DONE]') continue;

          try {
            const parsed = JSON.parse(payload);

            if (parsed.error) {
              bubble.textContent = parsed.error;
              fullText = parsed.error;
              break;
            }

            if (parsed.text) {
              fullText += parsed.text;
              // リアルタイムでテキストを更新
              bubble.innerHTML = escapeHtml(fullText).replace(/\n/g, '<br>');
              scrollToBottom();
            }
          } catch {
            // JSONパースに失敗した行は無視
          }
        }
      }

      // 完成したテキストを履歴に保存
      if (fullText) {
        history.push({ role: 'assistant', content: fullText });
      }

    } catch (err) {
      typingEl.remove();
      const errMsg = 'エラーが発生しました。しばらくしてから再度お試しください。';
      appendMessage('bot', errMsg);
      console.error('[chatbot] エラー:', err);
    } finally {
      isStreaming = false;
      updateSendBtn();
      input.focus();
    }
  }

  // ===================================
  // UI ヘルパー
  // ===================================

  // ユーザー or ボットメッセージを追加
  function appendMessage(role, text) {
    const wrap = document.createElement('div');
    wrap.className = `chat-msg chat-msg--${role === 'user' ? 'user' : 'bot'}`;

    if (role === 'bot') {
      wrap.appendChild(makeBotAvatar());
    }

    const bubble = document.createElement('div');
    bubble.className = 'chat-msg__bubble';
    bubble.innerHTML = escapeHtml(text).replace(/\n/g, '<br>');
    wrap.appendChild(bubble);

    messages.appendChild(wrap);
    scrollToBottom();
    return bubble;
  }

  // ストリーミング用にボット吹き出しだけ作成して返す
  function createBotBubble() {
    const wrap = document.createElement('div');
    wrap.className = 'chat-msg chat-msg--bot';
    wrap.appendChild(makeBotAvatar());

    const bubble = document.createElement('div');
    bubble.className = 'chat-msg__bubble';
    wrap.appendChild(bubble);

    messages.appendChild(wrap);
    scrollToBottom();
    return bubble;
  }

  // タイピングインジケーター
  function showTyping() {
    const wrap = document.createElement('div');
    wrap.className = 'chat-msg chat-msg--bot chat-msg--typing';
    wrap.appendChild(makeBotAvatar());

    const bubble = document.createElement('div');
    bubble.className = 'chat-msg__bubble';
    bubble.innerHTML = '<div class="typing-dots"><span></span><span></span><span></span></div>';
    wrap.appendChild(bubble);

    messages.appendChild(wrap);
    scrollToBottom();
    return wrap;
  }

  // ボットアバターSVGを生成
  function makeBotAvatar() {
    const el = document.createElement('div');
    el.className = 'chat-msg__avatar';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
           stroke="#2A9D8F" stroke-width="2.5" stroke-linecap="round">
        <path d="M12 2v20M2 12h20"/>
      </svg>`;
    return el;
  }

  // XSS対策: HTMLエスケープ
  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // メッセージエリアを一番下にスクロール
  function scrollToBottom() {
    requestAnimationFrame(() => {
      messages.scrollTop = messages.scrollHeight;
    });
  }

})();
