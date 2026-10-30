// Подписка на уведомления (ТЗ push_TZ.md, раздел 6): колокольчик в шапке, карточка подписки,
// карточка «Хотите узнавать о новых публикациях?» в конце статьи.
// Поставщик подключается модулем js/push-<provider>.js (window.PushProvider, интерфейс — в push-onesignal.js);
// модуль и SDK поставщика грузятся только по клику или если в этом браузере отмечено «подписан».
// В браузере хранится только: подписан ли и три галочки (localStorage «push-state»).
// Тестер: открыть любую страницу с ?push-tester=1 (до подписки) — подписка получит тег tester.
(function () {
  'use strict';
  var CFG = window.PUSH_CONFIG;
  if (!CFG) return;

  var LANG = document.documentElement.getAttribute('lang') === 'th' ? 'thai' : 'ru';
  var T = {
    ru: {
      bellOff: 'Уведомления: выключены', bellOn: 'Уведомления: включены', close: 'Закрыть',
      titleOff: 'Уведомления о новом', titleOn: 'Уведомления включены',
      note: 'Одно уведомление в день, только если на сайте появилось новое.',
      legend: 'Сообщать о новых:',
      cats: { publications: 'публикациях', bundles: 'связанных терминах', terms: 'терминах' },
      enable: 'Включить уведомления', disable: 'Отключить уведомления',
      ask: 'Браузер спросит разрешение — нажмите «Разрешить».',
      busy: 'Подключаем…', saved: 'Сохранено', enabled: 'Готово: уведомления включены.', disabled: 'Уведомления отключены.',
      error: 'Не удалось включить, попробуйте позже.', errorSave: 'Не удалось сохранить, попробуйте позже.',
      oneAtLeast: 'Оставьте хотя бы один пункт.',
      denied: 'Уведомления запрещены в настройках браузера. Чтобы разрешить: значок слева от адреса сайта → Уведомления → Разрешить, затем обновите страницу.',
      ios: 'На iPhone и iPad уведомления работают только с экрана «Домой»: <b>Поделиться → На экран «Домой»</b>, затем откройте сайт с иконки.',
      news: 'Что нового →', newsHref: '/new/'
    },
    thai: {
      bellOff: 'การแจ้งเตือน: ปิดอยู่', bellOn: 'การแจ้งเตือน: เปิดอยู่', close: 'ปิด',
      titleOff: 'แจ้งเตือนเมื่อมีของใหม่', titleOn: 'เปิดการแจ้งเตือนแล้ว',
      note: 'แจ้งเตือนไม่เกินวันละครั้ง และเฉพาะเมื่อมีของใหม่บนเว็บไซต์',
      legend: 'แจ้งเตือนเมื่อมี:',
      cats: { publications: 'บทความใหม่', bundles: 'ชุดศัพท์ที่เกี่ยวข้องใหม่', terms: 'คำศัพท์ใหม่' },
      enable: 'เปิดการแจ้งเตือน', disable: 'ปิดการแจ้งเตือน',
      ask: 'เบราว์เซอร์จะขออนุญาต — กด «อนุญาต»',
      busy: 'กำลังเชื่อมต่อ…', saved: 'บันทึกแล้ว', enabled: 'เรียบร้อย: เปิดการแจ้งเตือนแล้ว', disabled: 'ปิดการแจ้งเตือนแล้ว',
      error: 'เปิดไม่สำเร็จ โปรดลองอีกครั้งภายหลัง', errorSave: 'บันทึกไม่สำเร็จ โปรดลองอีกครั้งภายหลัง',
      oneAtLeast: 'โปรดเลือกอย่างน้อยหนึ่งหัวข้อ',
      denied: 'การแจ้งเตือนถูกปิดในการตั้งค่าเบราว์เซอร์ หากต้องการเปิด: กดไอคอนทางซ้ายของที่อยู่เว็บ → การแจ้งเตือน → อนุญาต แล้วโหลดหน้าใหม่',
      ios: 'บน iPhone และ iPad การแจ้งเตือนใช้ได้เมื่อเปิดจากหน้าจอโฮมเท่านั้น: <b>แชร์ → เพิ่มไปยังหน้าจอโฮม</b> แล้วเปิดเว็บไซต์จากไอคอน',
      news: 'มีอะไรใหม่ →', newsHref: '/new/news_thai.html'
    }
  }[LANG];
  var CAT_ORDER = ['publications', 'bundles', 'terms'];
  var BELL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">'
    + '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>';

  // --- Среда ---
  var ua = navigator.userAgent || '';
  var isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var standalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  var supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  var iosHint = isIOS && !standalone && !supported;
  if (!supported && !iosHint) return; // браузер не умеет веб-пуш: колокольчика нет

  // --- Состояние в браузере ---
  function readState() {
    try {
      var s = JSON.parse(localStorage.getItem('push-state') || 'null');
      if (s && s.cats) return { subscribed: !!s.subscribed, cats: { terms: s.cats.terms !== false, bundles: s.cats.bundles !== false, publications: s.cats.publications !== false } };
    } catch (e) { /* нет хранилища или повреждено — по умолчанию */ }
    return { subscribed: false, cats: { terms: true, bundles: true, publications: true } };
  }
  function saveState() {
    try { localStorage.setItem('push-state', JSON.stringify(state)); } catch (e) { /* без хранилища работает до перезагрузки */ }
  }
  var state = readState();
  try { if (/[?&]push-tester=1\b/.test(location.search)) localStorage.setItem('push-tester', '1'); } catch (e) { /* нет */ }
  var denied = function () { return supported && Notification.permission === 'denied'; };

  // --- Поставщик (ленивая загрузка модуля) ---
  var providerReady = null;
  function provider() {
    if (window.PushProvider) return Promise.resolve(window.PushProvider);
    if (providerReady) return providerReady;
    providerReady = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = '/js/push-' + CFG.provider + '.js';
      s.onload = function () { window.PushProvider ? resolve(window.PushProvider) : reject(new Error('provider')); };
      s.onerror = function () { providerReady = null; reject(new Error('provider')); };
      document.head.appendChild(s);
    });
    return providerReady;
  }

  // --- Колокольчик ---
  var header = document.querySelector('.site-header');
  if (!header) return;
  var bell = document.createElement('button');
  bell.type = 'button';
  bell.className = 'push-bell';
  bell.setAttribute('aria-haspopup', 'dialog');
  bell.setAttribute('aria-expanded', 'false');
  bell.setAttribute('aria-controls', 'push-card');
  bell.innerHTML = BELL;
  header.appendChild(bell);
  function paintBell() {
    bell.classList.toggle('is-on', state.subscribed);
    bell.setAttribute('aria-label', state.subscribed ? T.bellOn : T.bellOff);
    bell.title = state.subscribed ? T.bellOn : T.bellOff;
    var cta = document.querySelector('[data-push-cta]');
    if (cta) cta.hidden = state.subscribed;
  }

  // --- Карточка ---
  var card = document.createElement('div');
  card.id = 'push-card';
  card.className = 'push-card';
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-labelledby', 'push-card-title');
  card.hidden = true;
  var opener = null;

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  function render(status, statusOk) {
    var on = state.subscribed;
    var h = '<button type="button" class="push-card-close" aria-label="' + esc(T.close) + '">✕</button>'
      + '<h2 id="push-card-title">' + esc(on ? T.titleOn : T.titleOff) + '</h2>'
      + '<p class="push-card-note">' + esc(T.note) + '</p>';
    if (iosHint) {
      h += '<p class="push-hint">' + T.ios + '</p>';
    } else if (denied()) {
      h += '<p class="push-hint" role="status">' + esc(T.denied) + '</p>';
    } else {
      h += '<fieldset><legend>' + esc(T.legend) + '</legend>'
        + CAT_ORDER.map(function (k) {
          return '<label><input type="checkbox" data-cat="' + k + '"' + (state.cats[k] ? ' checked' : '') + '> ' + esc(T.cats[k]) + '</label>';
        }).join('') + '</fieldset>'
        + '<button type="button" class="push-btn' + (on ? ' secondary' : '') + '" data-push-action="' + (on ? 'off' : 'on') + '">' + esc(on ? T.disable : T.enable) + '</button>'
        + '<p class="push-status' + (statusOk ? ' ok' : '') + '" role="status" aria-live="polite">' + esc(status || (on ? '' : T.ask)) + '</p>'
        + (on ? '<a class="push-card-link" href="' + T.newsHref + '">' + esc(T.news) + '</a>' : '');
    }
    card.innerHTML = h;
  }
  function setStatus(text, ok) {
    var p = card.querySelector('.push-status');
    if (p) { p.textContent = text; p.classList.toggle('ok', !!ok); }
  }

  function open(from, floating) {
    opener = from || bell;
    card.classList.toggle('push-card--floating', !!floating);
    (floating ? document.body : header).appendChild(card);
    render();
    card.hidden = false;
    bell.setAttribute('aria-expanded', 'true');
    var first = card.querySelector('input, .push-btn') || card.querySelector('.push-card-close');
    first.focus();
  }
  function close() {
    if (card.hidden) return;
    card.hidden = true;
    bell.setAttribute('aria-expanded', 'false');
    if (opener && document.contains(opener)) opener.focus();
  }

  bell.addEventListener('click', function (e) {
    e.stopPropagation();
    if (card.hidden) open(bell, false); else close();
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
  document.addEventListener('click', function (e) {
    if (!card.hidden && !card.contains(e.target) && e.target !== bell && !bell.contains(e.target)) close();
  });

  card.addEventListener('click', function (e) {
    e.stopPropagation();
    if (e.target.closest('.push-card-close')) { close(); return; }
    var btn = e.target.closest('[data-push-action]');
    if (!btn || btn.disabled) return;
    btn.disabled = true;
    setStatus(T.busy);
    if (btn.getAttribute('data-push-action') === 'on') {
      provider().then(function (p) { return p.subscribe(LANG, state.cats); }).then(function () {
        state.subscribed = true; saveState(); paintBell(); render(T.enabled, true);
        var b = card.querySelector('.push-btn'); if (b) b.focus();
      }, function () {
        render(denied() ? '' : T.error);
      });
    } else {
      provider().then(function (p) { return p.unsubscribe(); }).then(function () {
        state.subscribed = false; saveState(); paintBell(); render(T.disabled, true);
        var b = card.querySelector('.push-btn'); if (b) b.focus();
      }, function () {
        btn.disabled = false; setStatus(T.errorSave);
      });
    }
  });

  card.addEventListener('change', function (e) {
    var box = e.target;
    if (!box.matches || !box.matches('input[data-cat]')) return;
    var k = box.getAttribute('data-cat');
    var next = { terms: state.cats.terms, bundles: state.cats.bundles, publications: state.cats.publications };
    next[k] = box.checked;
    if (!next.terms && !next.bundles && !next.publications) { box.checked = true; setStatus(T.oneAtLeast); return; }
    state.cats = next; saveState();
    if (!state.subscribed) { setStatus(T.ask); return; }
    provider().then(function (p) { return p.setCategories(LANG, state.cats); }).then(function () { setStatus(T.saved, true); }, function () { setStatus(T.errorSave); });
  });

  // --- Карточка в конце публикации ---
  var cta = document.querySelector('[data-push-cta]');
  if (cta) {
    var ctaBtn = cta.querySelector('[data-push-open]');
    if (ctaBtn) ctaBtn.addEventListener('click', function (e) { e.stopPropagation(); open(ctaBtn, true); });
  }

  paintBell();

  // --- Сверка с поставщиком у тех, кто отмечен «подписан» ---
  if (state.subscribed) {
    if (denied()) { state.subscribed = false; saveState(); paintBell(); }
    else if (supported) {
      provider().then(function (p) { return p.status(); }).then(function (s) {
        if (!s.subscribed) { state.subscribed = false; saveState(); paintBell(); if (!card.hidden) render(); }
      }, function () { /* поставщик недоступен — оставляем как есть */ });
    }
  }
})();
