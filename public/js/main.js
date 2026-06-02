// ===================================
// main.js - ページ全体の共通機能
// ===================================

// ヘッダーのスクロール検知
(function initHeader() {
  const header = document.getElementById('header');
  window.addEventListener('scroll', () => {
    header.classList.toggle('scrolled', window.scrollY > 10);
  }, { passive: true });
})();

// ===================================
// ハンバーガーメニュー（スマホ）
// ===================================
(function initMobileMenu() {
  const hamburger = document.getElementById('hamburger');
  const nav = document.getElementById('nav');

  hamburger.addEventListener('click', () => {
    const isOpen = hamburger.classList.toggle('active');
    nav.classList.toggle('open', isOpen);
    hamburger.setAttribute('aria-expanded', String(isOpen));
  });

  nav.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      hamburger.classList.remove('active');
      nav.classList.remove('open');
      hamburger.setAttribute('aria-expanded', 'false');
    });
  });
})();

// ===================================
// スクロールアニメーション（fade-in）
// ===================================
(function initScrollAnimations() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        // グリッドアイテムは少しずつ時間をずらして表示
        setTimeout(() => entry.target.classList.add('visible'), i * 90);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -32px 0px' });

  document.querySelectorAll('.fade-in').forEach(el => observer.observe(el));
})();

// ===================================
// カウントアップアニメーション
// ===================================
(function initCountUp() {
  const counterObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;

      const el = entry.target;
      const target = parseInt(el.dataset.count, 10);
      const duration = 1600;
      const start = performance.now();

      function update(now) {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        // easeOutCubic で自然な減速感
        const ease = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.round(target * ease);
        if (progress < 1) requestAnimationFrame(update);
        else el.textContent = target;
      }

      requestAnimationFrame(update);
      counterObserver.unobserve(el);
    });
  }, { threshold: 0.5 });

  document.querySelectorAll('[data-count]').forEach(el => counterObserver.observe(el));
})();

// ===================================
// FAQアコーディオン
// ===================================
(function initFaq() {
  const items = document.querySelectorAll('.faq-item');

  items.forEach(item => {
    item.querySelector('.faq-item__q').addEventListener('click', () => {
      const isOpen = item.classList.contains('open');

      // 他のアイテムを閉じる
      items.forEach(other => {
        other.classList.remove('open');
        other.querySelector('.faq-item__q').setAttribute('aria-expanded', 'false');
      });

      if (!isOpen) {
        item.classList.add('open');
        item.querySelector('.faq-item__q').setAttribute('aria-expanded', 'true');
      }
    });
  });
})();

// ===================================
// お問い合わせフォーム送信
// ===================================
(function initContactForm() {
  const form = document.getElementById('contactForm');
  const submitBtn = document.getElementById('submitBtn');
  const resultEl = document.getElementById('formResult');

  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const data = Object.fromEntries(new FormData(form).entries());

    submitBtn.disabled = true;
    submitBtn.textContent = '送信中...';
    resultEl.textContent = '';
    resultEl.className = 'form-result';

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await res.json();

      resultEl.textContent = result.message;
      resultEl.className = `form-result ${result.success ? 'success' : 'error'}`;

      if (result.success) form.reset();

    } catch {
      resultEl.textContent = 'ネットワークエラーが発生しました。お電話でお問い合わせください。';
      resultEl.className = 'form-result error';
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = '送信する';
    }
  });
})();
