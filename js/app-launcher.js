// Обогатитель «Приложение»: запуск интерактивного приложения прямо на странице публикации.
// Сборка выводит карточку <section class="app-card" data-app="<имя>"> и данные приложения
// в <script type="application/json" data-app-data="<имя>">; файлы приложения подключаются
// следом за этим скриптом и регистрируются через window.PubApps.register(имя, { mount, … }).
// Этот скрипт ничего не знает о содержимом приложений (как gallery.js не знает, что на фото):
// открывает окно <dialog> на весь экран, монтирует приложение, закрывает (✕ приложения, Esc,
// «Назад» браузера), хранит данные приложения в localStorage с приставкой terms-app:<имя>:,
// отправляет события в GoatCounter и показывает экран ошибки своими силами, если приложение
// не загрузилось или упало. Статья при этом остаётся целой.
(function () {
  'use strict';

  var MAX_URL = 'https://max.ru/channel_buddhism';
  var LINE_URL = 'https://line.me/ti/g2/5EcrnoUBzLvBmQCkTxRr6CzpG7kvv_qutGtjHA';

  var STR = {
    ru: {
      launch: 'Запустить', resume: 'Продолжить', dialog: 'Приложение',
      noStorage: 'Прогресс не сохранится: браузер запрещает хранить данные. Поможет обычное, не частное окно браузера.',
      errTitle: 'Не удалось открыть тренажёр',
      errText: 'Это техническая ошибка на стороне сайта. Публикация работает как обычно, сохранённый прогресс не пропал.',
      errWhat: 'Что сделать',
      errSteps: ['Обновить страницу.', 'Открыть публикацию в другом браузере.'],
      errContactPre: 'Если ошибка повторяется — написать комментарий к последней публикации в канале ',
      errContactLink: '«Разобраться в буддизме»', errContactUrl: MAX_URL, errContactPost: ' в Максе.',
      reload: 'Обновить страницу', back: 'Вернуться к публикации'
    },
    thai: {
      launch: 'เริ่ม', resume: 'ทำต่อ', dialog: 'แอป',
      noStorage: 'ความคืบหน้าจะไม่ถูกบันทึก เพราะเบราว์เซอร์ไม่อนุญาตให้เก็บข้อมูล ลองเปิดในหน้าต่างปกติที่ไม่ใช่โหมดส่วนตัว',
      errTitle: 'เปิดแบบฝึกไม่สำเร็จ',
      errText: 'เป็นข้อผิดพลาดทางเทคนิคของเว็บไซต์ บทความยังอ่านได้ตามปกติ และความคืบหน้าที่บันทึกไว้ไม่หายไป',
      errWhat: 'สิ่งที่ทำได้',
      errSteps: ['โหลดหน้านี้ใหม่', 'เปิดบทความในเบราว์เซอร์อื่น'],
      errContactPre: 'ถ้ายังเกิดข้อผิดพลาดซ้ำ แจ้งเราได้ที่ OpenChat ',
      errContactLink: '«มรรคสู่พระอรหันต»', errContactUrl: LINE_URL, errContactPost: ' ใน LINE',
      reload: 'โหลดหน้าใหม่', back: 'กลับไปที่บทความ'
    }
  };

  // --- Реестр приложений: app.js вызывает register сразу при загрузке ---
  var registry = {};
  window.PubApps = {
    register: function (name, def) {
      if (typeof name === 'string' && def && typeof def.mount === 'function') registry[name] = def;
    }
  };

  function langOf(card) {
    var l = card && card.getAttribute('data-app-lang');
    if (l === 'ru' || l === 'thai') return l;
    return window.TermsLang && window.TermsLang.get ? window.TermsLang.get() : 'ru';
  }

  function num(n, lang) {
    return lang === 'thai' && typeof window.toThaiNumerals === 'function' ? window.toThaiNumerals(n) : String(n);
  }

  // --- Хранилище: localStorage с приставкой terms-app:<имя>:, все вызовы в try/catch ---
  var storageOk = (function () {
    try {
      var k = 'terms-app:__test__';
      window.localStorage.setItem(k, '1');
      window.localStorage.removeItem(k);
      return true;
    } catch (e) { return false; }
  })();

  function makeStorage(name) {
    var prefix = 'terms-app:' + name + ':';
    return {
      available: storageOk,
      get: function (key) {
        if (!storageOk) return null;
        try {
          var raw = window.localStorage.getItem(prefix + key);
          return raw === null ? null : JSON.parse(raw);
        } catch (e) { return null; }
      },
      set: function (key, value) {
        if (!storageOk) return false;
        try { window.localStorage.setItem(prefix + key, JSON.stringify(value)); return true; } catch (e) { return false; }
      },
      remove: function (key) {
        if (!storageOk) return;
        try { window.localStorage.removeItem(prefix + key); } catch (e) { /* ничего */ }
      }
    };
  }

  // --- Счётчик: события GoatCounter app/<имя>/<событие>; сбой ни на что не влияет ---
  function track(name, event) {
    try {
      var gc = window.goatcounter;
      if (gc && typeof gc.count === 'function') {
        gc.count({ path: 'app/' + name + '/' + event, title: 'app ' + name + ' ' + event, event: true });
      }
    } catch (e) { /* ничего */ }
  }

  // --- Данные приложения из страницы (читаются один раз) ---
  var dataCache = {};
  function dataOf(name) {
    if (Object.prototype.hasOwnProperty.call(dataCache, name)) return dataCache[name];
    var el = document.querySelector('script[type="application/json"][data-app-data="' + name + '"]');
    var d = null;
    try { d = el ? JSON.parse(el.textContent) : null; } catch (e) { d = null; }
    dataCache[name] = d;
    return d;
  }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  // Общий контекст приложения (без окна): для карточки и для запуска
  function baseCtx(card) {
    var name = card.getAttribute('data-app');
    var lang = langOf(card);
    return {
      name: name,
      lang: lang,
      data: dataOf(name),
      version: card.getAttribute('data-app-version') || '',
      storage: makeStorage(name),
      num: function (n) { return num(n, lang); },
      reducedMotion: !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    };
  }

  // --- Карточка в статье: прогресс и надпись на кнопке (если приложение умеет status) ---
  function updateCard(card) {
    var btn = card.querySelector('.app-card-btn');
    var prog = card.querySelector('.app-card-progress');
    var icon = card.querySelector('.app-card-icon');
    var ctx = baseCtx(card);
    var s = STR[ctx.lang] || STR.ru;
    var def = registry[ctx.name];
    var st = null;
    if (def && typeof def.status === 'function' && ctx.data) {
      try { st = def.status(ctx); } catch (e) { st = null; }
    }
    if (prog) {
      prog.textContent = st && st.text ? st.text : '';
      prog.hidden = !(st && st.text);
    }
    if (btn) {
      btn.textContent = st && st.started ? s.resume : s.launch;
      btn.hidden = false;
    }
    if (icon && def && typeof def.cardIcon === 'function' && ctx.data) {
      try {
        var node = def.cardIcon(ctx);
        if (node && node.nodeType === 1) { while (icon.firstChild) icon.removeChild(icon.firstChild); icon.appendChild(node); }
      } catch (e) { /* без значка */ }
    }
    card.classList.toggle('app-card--has-icon', !!(icon && icon.firstChild));
  }

  // --- Окно приложения ---
  var current = null; // { dlg, root, card, instance, name, pushed, after }

  function lockPage(on) {
    document.documentElement.classList.toggle('app-open', on);
  }

  function showError(err) {
    if (!current) return;
    try { if (window.console) console.error('[app ' + current.name + ']', err); } catch (e) { /* ничего */ }
    var c = current;
    if (c.failed) return;
    c.failed = true;
    if (c.instance && typeof c.instance.unmount === 'function') {
      try { c.instance.unmount(); } catch (e) { /* ничего */ }
    }
    c.instance = null;
    var s = STR[c.lang] || STR.ru;
    while (c.root.firstChild) c.root.removeChild(c.root.firstChild);
    c.root.className = 'app-launcher-error';
    var box = el('div', 'app-launcher-error-box');
    box.setAttribute('role', 'alert');
    box.appendChild(el('h2', 'app-launcher-error-title', s.errTitle));
    box.appendChild(el('p', 'app-launcher-error-text', s.errText));
    box.appendChild(el('p', 'app-launcher-error-what', s.errWhat));
    var ol = el('ol', 'app-launcher-error-steps');
    s.errSteps.forEach(function (t) { ol.appendChild(el('li', '', t)); });
    var li = el('li', '');
    li.appendChild(document.createTextNode(s.errContactPre));
    var a = el('a', '', s.errContactLink);
    a.href = s.errContactUrl;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    li.appendChild(a);
    li.appendChild(document.createTextNode(s.errContactPost));
    ol.appendChild(li);
    box.appendChild(ol);
    var row = el('div', 'app-launcher-error-actions');
    var reload = el('button', 'app-launcher-btn app-launcher-btn--main', s.reload);
    reload.type = 'button';
    reload.addEventListener('click', function () { window.location.reload(); });
    var back = el('button', 'app-launcher-btn', s.back);
    back.type = 'button';
    back.addEventListener('click', function () { close(); });
    row.appendChild(reload);
    row.appendChild(back);
    box.appendChild(row);
    c.root.appendChild(box);
    try { back.focus({ preventScroll: true }); } catch (e) { /* ничего */ }
  }

  function onWindowError(e) {
    if (!current || !e || !e.filename) return;
    if (e.filename.indexOf('/publications/apps/' + current.name + '/') !== -1) showError(e.error || new Error(e.message));
  }

  function close(after) {
    if (!current) return;
    if (typeof after === 'function') current.after = after;
    if (current.dlg.open) current.dlg.close();
    else finish();
  }

  function finish() {
    var c = current;
    if (!c) return;
    current = null;
    window.removeEventListener('error', onWindowError);
    if (c.instance && typeof c.instance.unmount === 'function') {
      try { c.instance.unmount(); } catch (e) { /* ничего */ }
    }
    lockPage(false);
    if (c.dlg.parentNode) c.dlg.parentNode.removeChild(c.dlg);
    updateCard(c.card);
    var btn = c.card.querySelector('.app-card-btn');
    var done = function () {
      if (btn) { try { btn.focus({ preventScroll: true }); } catch (e) { /* ничего */ } }
      if (c.after) { try { c.after(); } catch (e) { /* ничего */ } }
    };
    // Своя запись в истории: убрать её («Назад» уже не нужен), действие — после возврата
    if (c.pushed) {
      c.pushed = false;
      var ran = false;
      var once = function () { if (ran) return; ran = true; window.removeEventListener('popstate', once); done(); };
      window.addEventListener('popstate', once);
      setTimeout(once, 400);
      history.back();
    } else done();
  }

  window.addEventListener('popstate', function () {
    if (current && current.pushed) { current.pushed = false; close(); }
  });

  function open(card) {
    if (current) return;
    var ctx0 = baseCtx(card);
    var name = ctx0.name;
    var s = STR[ctx0.lang] || STR.ru;

    var dlg = el('dialog', 'app-dialog');
    dlg.setAttribute('aria-label', (card.querySelector('.app-card-title') || {}).textContent || s.dialog);
    dlg.lang = ctx0.lang === 'thai' ? 'th' : 'ru';
    dlg.tabIndex = -1;
    if (!storageOk) dlg.appendChild(el('p', 'app-launcher-strip', s.noStorage));
    var root = el('div', 'app-root app-' + name);
    // Тема сайта для стилей приложения: правило вида .app-<имя>[data-app-theme="light"] (все правила приложения — с .app-<имя>)
    root.setAttribute('data-app-theme', document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark');
    dlg.appendChild(root);
    document.body.appendChild(dlg);

    current = { dlg: dlg, root: root, card: card, instance: null, name: name, lang: ctx0.lang, pushed: false, after: null, failed: false };
    dlg.addEventListener('close', finish);
    window.addEventListener('error', onWindowError);

    lockPage(true);
    try { dlg.showModal(); } catch (e) { dlg.setAttribute('open', ''); }
    if (document.activeElement !== dlg) { try { dlg.focus({ preventScroll: true }); } catch (e) { /* ничего */ } }
    try { history.pushState({ pubApp: name }, ''); current.pushed = true; } catch (e) { current.pushed = false; }

    track(name, 'launch');

    var def = registry[name];
    if (!def) { showError(new Error('приложение «' + name + '» не загрузилось')); return; }
    if (!ctx0.data) { showError(new Error('нет данных приложения «' + name + '»')); return; }
    var ctx = ctx0;
    ctx.close = function () { close(); };
    ctx.track = function (event) { track(name, event); };
    ctx.reportError = function (err) { showError(err); };
    ctx.rereadArticle = function () {
      // К началу страницы (заголовок статьи); после возврата по истории браузер ещё
      // восстанавливает прокрутку, поэтому прокручиваем на следующем кадре
      close(function () {
        requestAnimationFrame(function () { requestAnimationFrame(function () { window.scrollTo(0, 0); }); });
      });
    };
    try {
      current.instance = def.mount(root, ctx) || null;
    } catch (err) {
      showError(err);
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    var cards = Array.prototype.slice.call(document.querySelectorAll('.app-card[data-app]'));
    cards.forEach(function (card) {
      var nojs = card.querySelector('.app-card-nojs');
      if (nojs) nojs.hidden = true;
      if (typeof HTMLDialogElement !== 'function') {
        // Очень старый браузер: приложение не откроется — оставляем пояснение, кнопку не показываем
        if (nojs) nojs.hidden = false;
        return;
      }
      updateCard(card);
      var btn = card.querySelector('.app-card-btn');
      if (btn) btn.addEventListener('click', function () { open(card); });
    });
  });
})();
