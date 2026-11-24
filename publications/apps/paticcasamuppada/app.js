// Тренажёр 12 звеньев paṭiccasamuppāda (TZ_app_paticcasamuppada.md, разделы 4–5).
// Приложение обогатителя «Приложение»: окно, хранилище, счётчик и экран ошибки даёт js/app-launcher.js.
// Все тексты — из данных (ctx.data), разметка — через createElement / textContent.
(function () {
  'use strict';

  var SVGNS = 'http://www.w3.org/2000/svg';
  var LIFE_CLS = { past: 'past', present: 'pres', future: 'fut' };
  var THAI_DIGITS = '๐๑๒๓๔๕๖๗๘๙';

  // --- Помощники ---
  function h(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined && text !== null) e.textContent = text;
    return e;
  }
  function btn(cls, text, label) {
    var b = h('button', cls, text);
    b.type = 'button';
    if (label) b.setAttribute('aria-label', label);
    return b;
  }
  function svg(tag, attrs) {
    var e = document.createElementNS(SVGNS, tag);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    return e;
  }
  function fill(t, o) {
    return String(t).replace(/\{(\w+)\}/g, function (m, k) { return Object.prototype.hasOwnProperty.call(o, k) ? o[k] : m; });
  }
  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function pt(cx, cy, r, k) {
    var a = (-90 + (k - 1) * 30) * Math.PI / 180;
    return { x: +(cx + r * Math.cos(a)).toFixed(1), y: +(cy + r * Math.sin(a)).toFixed(1) };
  }
  function digitsFor(lang) {
    return function (s) { return lang === 'thai' ? String(s).replace(/[0-9]/g, function (c) { return THAI_DIGITS[+c]; }) : String(s); };
  }

  // --- Прогресс: { v: версия данных при записи, remembered: [id…], updated: мс } ---
  // Прогресс переживает обновления тренажёра: версия в записи только для справки и не проверяется.
  // Берём запомненные звенья, которые есть в текущих данных; неизвестные id тихо пропускаем, остальное сохраняем.
  // Стираем запись, только если она испорчена (не объект или без списка remembered).
  function progressKey(ctx) { return 'progress:' + ctx.lang; }
  var HINT_KEY = 'hint-seen', HINT_MAX = 30;
  function loadRemembered(ctx) {
    var d = ctx.data, rec = ctx.storage.get(progressKey(ctx));
    if (!rec) return [];
    if (typeof rec !== 'object' || !Array.isArray(rec.remembered)) { ctx.storage.remove(progressKey(ctx)); return []; }
    var ids = d.links.map(function (l) { return l.id; });
    var out = [];
    for (var i = 0; i < rec.remembered.length; i++) {
      var id = rec.remembered[i];
      if (typeof id === 'string' && ids.indexOf(id) !== -1 && out.indexOf(id) === -1) out.push(id);
    }
    // Запись из старой версии или с лишними id — переписываем очищенной, с текущей версией
    if (rec.v !== d.version || out.length !== rec.remembered.length) saveRemembered(ctx, out);
    return out;
  }
  function saveRemembered(ctx, list) {
    ctx.storage.set(progressKey(ctx), { v: ctx.data.version, remembered: list.slice(), updated: Date.now() });
  }

  // --- Колесо Дхаммы (по img/icon.svg сайта): 8 спиц, обод, 8 лепестков, ступица ---
  function dharmaWheel() {
    var g = svg('g');
    for (var i = 0; i < 8; i++) {
      var a = i * Math.PI / 4, c = Math.cos(a), s = Math.sin(a);
      var x1 = (256 + 140 * s).toFixed(1), y1 = (256 - 140 * c).toFixed(1), x2 = (256 + 168 * s).toFixed(1), y2 = (256 - 168 * c).toFixed(1);
      g.appendChild(svg('line', { x1: x1, y1: y1, x2: x2, y2: y2, 'stroke-width': 30, 'class': 'pt-wl-s' }));
      g.appendChild(svg('line', { x1: x1, y1: y1, x2: x2, y2: y2, 'stroke-width': 12, 'class': 'pt-wf-s' }));
      g.appendChild(svg('circle', { cx: (256 + 176 * s).toFixed(1), cy: (256 - 176 * c).toFixed(1), r: 19, 'stroke-width': 9, 'class': 'pt-wf-f pt-wl-s' }));
    }
    g.appendChild(svg('circle', { cx: 256, cy: 256, r: 126, 'stroke-width': 44, fill: 'none', 'class': 'pt-wl-s' }));
    g.appendChild(svg('circle', { cx: 256, cy: 256, r: 126, 'stroke-width': 26, fill: 'none', 'class': 'pt-wf-s' }));
    for (var k = 0; k < 8; k++) {
      g.appendChild(svg('path', { d: 'M256 220 C239 196 239 176 256 150 C273 176 273 196 256 220 Z', transform: 'rotate(' + (k * 45) + ' 256 256)',
        'stroke-width': 7, 'stroke-linejoin': 'round', 'class': 'pt-wf-f pt-wl-s' }));
    }
    g.appendChild(svg('circle', { cx: 256, cy: 256, r: 40, 'stroke-width': 9, 'class': 'pt-wf-f pt-wl-s' }));
    g.appendChild(svg('circle', { cx: 256, cy: 256, r: 15, 'stroke-width': 7, 'class': 'pt-el-f pt-wl-s' }));
    return g;
  }

  // Мини-колесо: 12 точек; current — текущее звено, lit — запомненные (для значка карточки)
  function miniWheel(size, current, opts) {
    opts = opts || {};
    var s = svg('svg', { viewBox: '0 0 60 60', width: size, height: size, 'aria-hidden': 'true', focusable: 'false' });
    for (var k = 1; k <= 12; k++) {
      var p = pt(30, 30, 24, k);
      if (k === current) {
        s.appendChild(svg('circle', { cx: p.x, cy: p.y, r: 9, 'class': 'pt-halo' }));
        s.appendChild(svg('circle', { cx: p.x, cy: p.y, r: 6, 'class': 'pt-cur' }));
      } else if (opts.lit) {
        s.appendChild(svg('circle', { cx: p.x, cy: p.y, r: opts.lit[k] ? 4.5 : 3.5, 'class': opts.lit[k] ? 'pt-lit' : 'pt-unlit' }));
      } else {
        s.appendChild(svg('circle', { cx: p.x, cy: p.y, r: 3, 'class': 'pt-life-' + opts.life(k) }));
      }
    }
    return s;
  }

  // --- Приложение ---
  function Trainer(root, ctx) {
    var D = ctx.data, U = D.ui, T = digitsFor(ctx.lang), RM = ctx.reducedMotion;
    var N = D.links.length;
    var timers = [];
    var later = function (fn, ms) { if (RM) ms = 0; var t = setTimeout(fn, ms); timers.push(t); return t; };
    var clearTimers = function () { timers.forEach(clearTimeout); timers = []; };
    var L = function (n) { return D.links[((n - 1) % N + N) % N]; };
    var lifeOf = function (n) { return LIFE_CLS[L(n).life]; };
    var byId = {};
    D.links.forEach(function (l) { byId[l.id] = l.n; });

    var remembered = loadRemembered(ctx);   // id запомненных звеньев (сохраняются)
    var queue = [];                         // номера звеньев колоды (только в этом запуске)
    var phraseQueue = [], lastPhrase = null;
    var screen = null;                      // основной экран: { type: 'front'|'back'|'milestone'|'finale', n }
    var overlays = [];                      // поверх основного: карта и просмотр звена
    var busy = false;
    var opened = null;                      // открытые заглушки текущей карточки — до «Помню» / «Не помню»

    function rebuildQueue() {
      queue = shuffle(D.links.filter(function (l) { return remembered.indexOf(l.id) === -1; }).map(function (l) { return l.n; }));
    }
    function nextPhrase() {
      if (!phraseQueue.length) {
        phraseQueue = shuffle(U.phrases.slice());
        if (phraseQueue.length > 1 && phraseQueue[0] === lastPhrase) phraseQueue.push(phraseQueue.shift());
      }
      lastPhrase = phraseQueue.shift();
      return lastPhrase;
    }

    // Каркас: шапка, сцена, кнопки, подвал
    root.textContent = '';
    var wrap = h('div', 'pt');
    wrap.setAttribute('tabindex', '-1');
    if (ctx.lang === 'thai') wrap.classList.add('pt-thai');
    var top = h('div', 'pt-top');
    var bClose = btn('pt-round', null, U.aria.close);
    bClose.appendChild(iconX());
    var prog = h('div', 'pt-prog');
    var pLabel = h('span', 'pt-prog-label');
    var bar = h('div', 'pt-bar'), barFill = h('i');
    bar.appendChild(barFill);
    prog.appendChild(pLabel); prog.appendChild(bar);
    var bReset = btn('pt-round', null, U.aria.reset);
    bReset.appendChild(iconReset());
    top.appendChild(bClose); top.appendChild(prog); top.appendChild(bReset);
    var stage = h('div', 'pt-stage');
    var bottom = h('div', 'pt-bottom');
    var foot = h('div', 'pt-foot');
    var parts = String(U.credit).split('{link}');
    foot.appendChild(document.createTextNode(parts[0] || ''));
    var a = h('a', '', U.credit_name);
    a.href = U.credit_url; a.target = '_blank'; a.rel = 'noopener noreferrer';
    foot.appendChild(a);
    foot.appendChild(document.createTextNode((parts[1] || '') + ' · '));
    foot.appendChild(h('span', 'pt-ver', 'v' + ctx.version));
    wrap.appendChild(top); wrap.appendChild(stage); wrap.appendChild(bottom); wrap.appendChild(foot);
    root.appendChild(wrap);

    bClose.addEventListener('click', function () { ctx.close(); });
    bReset.addEventListener('click', function () { askReset(); });

    function iconX() {
      var s = svg('svg', { viewBox: '0 0 24 24', width: 18, height: 18, fill: 'none', stroke: 'currentColor', 'stroke-width': 2.2, 'stroke-linecap': 'round', 'aria-hidden': 'true', focusable: 'false' });
      s.appendChild(svg('path', { d: 'M6 6l12 12M18 6L6 18' }));
      return s;
    }
    function iconReset() {
      var s = svg('svg', { viewBox: '0 0 24 24', width: 18, height: 18, fill: 'none', stroke: 'currentColor', 'stroke-width': 2.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', focusable: 'false' });
      s.appendChild(svg('path', { d: 'M3 12a9 9 0 1 0 3-6.7' }));
      s.appendChild(svg('path', { d: 'M3 4v5h5' }));
      return s;
    }
    function iconEye() {
      var s = svg('svg', { viewBox: '0 0 24 24', width: 14, height: 14, fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'aria-hidden': 'true', focusable: 'false' });
      s.appendChild(svg('path', { d: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z' }));
      s.appendChild(svg('circle', { cx: 12, cy: 12, r: 3 }));
      return s;
    }
    function iconExpand() {
      var s = svg('svg', { viewBox: '0 0 24 24', width: 12, height: 12, fill: 'none', stroke: 'currentColor', 'stroke-width': 3, 'stroke-linecap': 'round', 'aria-hidden': 'true', focusable: 'false' });
      s.appendChild(svg('path', { d: 'M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7' }));
      return s;
    }

    function setProgress(bump) {
      var left = N - remembered.length;
      pLabel.textContent = T(fill(U.remaining, { n: left }));
      barFill.style.width = ((N - left) / N * 100) + '%';
      bar.classList.toggle('pt-bar-done', left === 0);
      if (bump && !RM) { pLabel.classList.remove('pt-bump'); void pLabel.offsetWidth; pLabel.classList.add('pt-bump'); }
      bReset.disabled = remembered.length === 0;
    }
    // Плашка внизу карточки: «… вернётся позже» (около 2,5 с, не перекрывает шапку и кнопки)
    function toast(text) {
      var card = stage.querySelector('.pt-card');
      if (!card) return;
      var t = h('div', 'pt-toast' + (RM ? '' : ' pt-toast-anim'));
      // Название звена — жирным: шаблон «{name} …» собираем узлами, без разметки в строке
      var parts = String(text.tpl).split('{name}');
      parts.forEach(function (p, i) {
        if (i) t.appendChild(h('strong', 'pt-toast-name', text.name));
        if (p) t.appendChild(document.createTextNode(p));
      });
      t.setAttribute('role', 'status');
      card.appendChild(t);
      timers.push(setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 2600)); // и без анимаций — чтобы успеть прочитать
    }
    function clearBottom() { bottom.textContent = ''; bottom.className = 'pt-bottom'; }
    function setStage(el) { stage.textContent = ''; stage.appendChild(el); }
    // Фокус на кнопку переводим только тем, кто работает с клавиатуры: при касании и мыши кнопка
    // не должна выглядеть выбранной. Иначе фокус — на само приложение (без рамки), чтобы не уйти из окна.
    var keyboard = false;
    function onKey(e) { if (e.key === 'Tab' || e.key === 'Enter' || e.key === ' ' || e.key.indexOf('Arrow') === 0) keyboard = true; }
    function onPointer() { keyboard = false; }
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('pointerdown', onPointer, true);
    function focusTo(el) { if (el) { try { el.focus({ preventScroll: true }); } catch (e) { /* ничего */ } } }
    function focusQuiet(el, quietEl) { focusTo(keyboard ? el : (quietEl || wrap)); }

    // Название звена в одну строку: уменьшаем шрифт, пока не влезет
    function fitText(el, max, min) {
      var size = max;
      el.style.fontSize = size + 'px';
      var guard = 30;
      while (el.scrollWidth > el.clientWidth + 1 && size > min && guard--) {
        size -= 2;
        el.style.fontSize = size + 'px';
      }
    }

    // --- Карточка сразу открывается оборотом (лицевой стороны нет с 2.0) ---
    function showFront(n, anim) { showBack(n, anim); }

    // --- Оборот: всё, кроме названия, под заглушками; открытие ничего не сдвигает ---
    function backCard(n, view) {
      var d = L(n);
      var card = h('div', 'pt-card pt-back');
      var head = h('div', 'pt-head');
      var wheel = btn('pt-wheel', null, U.aria.open_map);
      wheel.appendChild(miniWheel(64, n, { life: lifeOf }));
      var exp = h('span', 'pt-wheel-open');
      exp.appendChild(iconExpand());
      wheel.appendChild(exp);
      wheel.addEventListener('click', function () { if (!busy && !wheel.classList.contains('pt-covered')) openMap(n); });
      head.appendChild(wheel);
      var meta = h('div', 'pt-meta');
      var lo = String(U.link_of).split('{n}');
      var loB = h('b', '');
      loB.appendChild(document.createTextNode(lo[0]));
      var numEl = h('span', 'pt-num', T(n));
      loB.appendChild(numEl);
      loB.appendChild(document.createTextNode(lo[1] || ''));
      meta.appendChild(loB);
      var lifeLine = h('span', 'pt-life');
      var dot = h('i', 'pt-dot pt-bg-' + lifeOf(n));
      lifeLine.appendChild(dot);
      lifeLine.appendChild(document.createTextNode(U.life[d.life]));
      meta.appendChild(lifeLine);
      head.appendChild(meta);
      card.appendChild(head);

      var term = h('div', 'pt-term pt-term-back', d.name);
      term.setAttribute('role', 'heading');
      term.setAttribute('aria-level', '2');
      card.appendChild(term);
      if (!view && opened && opened.n === n && opened.hint) card.appendChild(h('div', 'pt-hint pt-hint-back', U.hint));

      var chain = h('div', 'pt-chain');
      var prev = btn('pt-nb', L(n - 1).name, fill(U.aria.prev, {}) + ': ' + L(n - 1).name);
      var next = btn('pt-nb', L(n + 1).name, fill(U.aria.next, {}) + ': ' + L(n + 1).name);
      prev.addEventListener('click', function () { if (!busy && !prev.classList.contains('pt-covered')) openView(L(n - 1).n); });
      next.addEventListener('click', function () { if (!busy && !next.classList.contains('pt-covered')) openView(L(n + 1).n); });
      chain.appendChild(prev); chain.appendChild(h('span', 'pt-me')); chain.appendChild(next);
      card.appendChild(chain);

      var meanBox = h('div', 'pt-meanbox');
      var mean = h('span', 'pt-mean', d.meaning);
      meanBox.appendChild(mean);
      card.appendChild(meanBox);
      card.appendChild(h('div', 'pt-rule'));
      var cloud = h('div', 'pt-cloud');
      var bubbles = d.cloud.map(function (w) { var b = h('span', 'pt-bub', w); cloud.appendChild(b); return b; });
      card.appendChild(cloud);

      // Заглушки: элемент остаётся на месте, закрыт «шторкой» с глазом; нажатие открывает этот элемент
      var covered = [];
      function cover(el, label) {
        if (view) return;
        el.classList.add('pt-covered');
        el.setAttribute('tabindex', '0');
        el.setAttribute('role', 'button');
        el.setAttribute('aria-label', U.aria.show + (label ? ' ' + label : ''));
        var shade = h('span', 'pt-shade');
        shade.setAttribute('aria-hidden', 'true');
        shade.appendChild(iconEye());
        if (label) shade.appendChild(document.createTextNode(label));
        el.appendChild(shade);
        var open = function () { uncover(el); sync(); };
        el.addEventListener('click', open);
        el.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
        covered.push(el);
      }
      function uncover(el, quiet) {
        if (!el.classList.contains('pt-covered')) return;
        el.classList.remove('pt-covered');
        if (!view && opened && opened.n === n) opened.idx[covered.indexOf(el)] = true;
        if (!RM && !quiet) { el.classList.remove('pt-reveal'); void el.offsetWidth; el.classList.add('pt-reveal'); }
        el.removeAttribute('tabindex'); el.removeAttribute('role'); el.removeAttribute('aria-label');
        var sh = el.querySelector('.pt-shade');
        if (sh) sh.parentNode.removeChild(sh);
      }
      function recover(el) {
        if (el.classList.contains('pt-covered')) return;
        if (!view && opened && opened.n === n) delete opened.idx[covered.indexOf(el)];
        var label = el.getAttribute('data-pt-label') || '';
        el.classList.add('pt-covered');
        el.setAttribute('tabindex', '0'); el.setAttribute('role', 'button');
        el.setAttribute('aria-label', U.aria.show + (label ? ' ' + label : ''));
        var shade = h('span', 'pt-shade');
        shade.setAttribute('aria-hidden', 'true');
        shade.appendChild(iconEye());
        if (label) shade.appendChild(document.createTextNode(label));
        el.appendChild(shade);
      }
      wheel.setAttribute('data-pt-label', '');
      cover(wheel, '');
      numEl.setAttribute('data-pt-label', '');
      cover(numEl, '');
      prev.setAttribute('data-pt-label', '\u2190');
      next.setAttribute('data-pt-label', '\u2192');
      cover(prev, '\u2190');
      cover(next, '\u2192');
      lifeLine.setAttribute('data-pt-label', '');
      mean.setAttribute('data-pt-label', '');
      cover(lifeLine, '');
      cover(mean, '');
      bubbles.forEach(function (b, i) { b.setAttribute('data-pt-label', T(i + 1)); cover(b, T(i + 1)); });
      // Что уже открыто на этой карточке (после карты или просмотра соседа) — снова открыто
      if (!view && opened && opened.n === n) Object.keys(opened.idx).forEach(function (i) { if (covered[i]) uncover(covered[i], true); });

      var toggle = null;
      function sync() {
        if (!toggle) return;
        var any = covered.some(function (el) { return el.classList.contains('pt-covered'); });
        toggle.textContent = '';
        toggle.appendChild(iconEye());
        toggle.appendChild(document.createTextNode(any ? U.show_all : U.hide_all));
      }
      if (!view) {
        toggle = btn('pt-showall', '');
        toggle.addEventListener('click', function () {
          var any = covered.some(function (el) { return el.classList.contains('pt-covered'); });
          covered.forEach(any ? uncover : recover);
          sync();
        });
        card.appendChild(toggle);
        sync();
      }
      return { card: card, wheel: wheel };
    }

    function showBack(n, anim) {
      screen = { type: 'back', n: n };
      if (!opened || opened.n !== n) {
        // Подсказка «как работать с карточкой» — только на первых HINT_MAX новых карточках.
        // Счётчик общий для обоих языков и не сбрасывается ни обновлением, ни «Начать заново».
        var seen = ctx.storage.get(HINT_KEY);
        seen = typeof seen === 'number' && seen >= 0 ? seen : 0;
        opened = { n: n, idx: {}, hint: seen < HINT_MAX };
        if (opened.hint) ctx.storage.set(HINT_KEY, seen + 1);
      }
      var b = backCard(n, false);
      if (!RM && anim) b.card.classList.add('pt-' + anim);
      setStage(b.card);
      fitText(b.card.querySelector('.pt-term'), ctx.lang === 'thai' ? 46 : 38, 20);
      clearBottom();
      var row = h('div', 'pt-btns');
      var no = btn('pt-btn pt-btn-no', U.not_yet);
      var ok = btn('pt-btn pt-btn-ok', U.remembered);
      no.addEventListener('click', function () { if (!busy) notYet(n, b.card); });
      ok.addEventListener('click', function () { if (!busy) remember(n, b); });
      row.appendChild(no); row.appendChild(ok);
      bottom.appendChild(row);
      focusQuiet(b.card.querySelector('.pt-showall'));
    }

    function remember(n, b) {
      busy = true;
      opened = null;
      var d = L(n);
      if (remembered.indexOf(d.id) === -1) remembered.push(d.id);
      saveRemembered(ctx, remembered);
      queue = queue.filter(function (k) { return k !== n; });
      var last = remembered.length >= N;
      if (last) ctx.track('done');
      if (!RM) b.wheel.classList.add('pt-lit-anim');
      later(function () { setProgress(true); }, 250);
      later(function () {
        if (!RM) b.card.classList.add('pt-leave');
        later(function () { busy = false; if (last) showFinale(true); else showMilestone(n); }, 360);
      }, 550);
    }

    function notYet(n, card) {
      busy = true;
      opened = null;
      if (!RM) card.classList.add('pt-leave');
      later(function () {
        busy = false;
        queue = queue.filter(function (k) { return k !== n; });
        queue.push(n);
        showFront(queue[0], 'enter');
        toast({ tpl: U.returns_later, name: L(n).name });
      }, 360);
    }

    // --- Звено запомнено ---
    function showMilestone(n) {
      screen = { type: 'milestone', n: n };
      var d = L(n);
      var box = h('div', 'pt-card pt-ms' + (RM ? '' : ' pt-ms-in'));
      box.setAttribute('role', 'status');
      var wheelBox = h('div', 'pt-mswheel');
      var s = svg('svg', { viewBox: '0 0 200 200', 'aria-hidden': 'true', focusable: 'false' });
      for (var j = 1; j <= 12; j++) {
        var nx = j % 12 + 1, a1 = (-90 + (j - 1) * 30 + 11) * Math.PI / 180, a2 = a1 + 8 * Math.PI / 180;
        var same = lifeOf(j) === lifeOf(nx);
        s.appendChild(svg('path', {
          d: 'M' + (100 + 86 * Math.cos(a1)).toFixed(2) + ' ' + (100 + 86 * Math.sin(a1)).toFixed(2) +
             ' A86 86 0 0 1 ' + (100 + 86 * Math.cos(a2)).toFixed(2) + ' ' + (100 + 86 * Math.sin(a2)).toFixed(2),
          fill: 'none', 'stroke-width': 2.5, 'stroke-linecap': 'round',
          'class': 'pt-msarc ' + (same ? 'pt-life-s-' + lifeOf(j) : 'pt-bd-s')
        }));
      }
      for (var k = 1; k <= 12; k++) {
        var p = pt(100, 100, 86, k);
        if (k === n) {
          s.appendChild(svg('circle', { cx: p.x, cy: p.y, r: 16, 'class': 'pt-halo pt-mshalo' }));
          s.appendChild(svg('circle', { cx: p.x, cy: p.y, r: 10, fill: 'none', 'stroke-width': 2, 'class': 'pt-ac-s pt-msring' }));
          s.appendChild(svg('circle', { cx: p.x, cy: p.y, r: 9, 'class': 'pt-ac-f pt-msnow' }));
        } else if (remembered.indexOf(L(k).id) !== -1) {
          s.appendChild(svg('circle', { cx: p.x, cy: p.y, r: 7, 'class': 'pt-life-' + lifeOf(k) }));
        } else {
          s.appendChild(svg('circle', { cx: p.x, cy: p.y, r: 5.5, 'stroke-width': 2, 'class': 'pt-el-f pt-life-s-' + lifeOf(k) }));
        }
      }
      wheelBox.appendChild(s);
      var cnt = h('div', 'pt-mscount');
      cnt.appendChild(h('b', '', T(remembered.length)));
      cnt.appendChild(h('span', '', U.milestone_count));
      wheelBox.appendChild(cnt);
      box.appendChild(wheelBox);
      var delay = 0.5;
      function stag(el) { if (!RM) { el.classList.add('pt-stag'); el.style.animationDelay = delay.toFixed(2) + 's'; } delay += 0.12; box.appendChild(el); return el; }
      stag(h('div', 'pt-msover', U.milestone_over));
      stag(h('div', 'pt-msname', d.name));
      stag(h('div', 'pt-msmean', d.meaning));
      var chips = h('div', 'pt-chips');
      chips.appendChild(h('span', 'pt-chip', L(n - 1).name));
      chips.appendChild(arrow(1.0));
      chips.appendChild(h('span', 'pt-chip pt-chip-me', d.name));
      chips.appendChild(arrow(1.25));
      chips.appendChild(h('span', 'pt-chip', L(n + 1).name));
      delay = 0.85; stag(chips);
      delay = 1.1; stag(h('div', 'pt-msformula', d.link));
      var ex = h('div', 'pt-msex');
      ex.appendChild(h('span', '', U.example_label));
      ex.appendChild(document.createTextNode(d.example));
      delay = 1.3; stag(ex);
      delay = 1.5; stag(h('div', 'pt-msphrase', nextPhrase()));
      setStage(box);
      fitChips(chips);
      clearBottom();
      var b = btn('pt-btn pt-btn-pri pt-wide', U.continue);
      b.disabled = true;
      b.addEventListener('click', function () {
        if (b.disabled) return;
        if (!queue.length) rebuildQueue();
        showFront(queue[0], 'enter');
      });
      bottom.appendChild(b);
      later(function () { b.disabled = false; focusQuiet(b); }, 700);

      function arrow(dl) {
        var a2 = svg('svg', { width: 20, height: 12, viewBox: '0 0 22 12', 'aria-hidden': 'true', focusable: 'false' });
        var path = svg('path', { d: 'M1 6h18M14 1l5 5-5 5', fill: 'none', 'stroke-width': 1.8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'class': 'pt-arr' });
        if (!RM) { path.classList.add('pt-arr-draw'); path.style.animationDelay = dl + 's'; }
        a2.appendChild(path);
        return a2;
      }
    }

    // Цепочка «пред → звено → след» в одну строку: уменьшаем шрифт, отступы и промежутки, пока не влезет
    function fitChips(chips) {
      var steps = [[13, 10, 6, 20], [12, 8, 5, 18], [11, 7, 4, 16], [10, 6, 3, 14], [9, 5, 2, 12]];
      var items = chips.querySelectorAll('.pt-chip'), arrows = chips.querySelectorAll('svg');
      for (var i = 0; i < steps.length; i++) {
        var st = steps[i];
        chips.style.gap = st[2] + 'px';
        for (var j = 0; j < items.length; j++) { items[j].style.fontSize = st[0] + 'px'; items[j].style.paddingLeft = items[j].style.paddingRight = st[1] + 'px'; }
        for (var k = 0; k < arrows.length; k++) arrows[k].setAttribute('width', st[3]);
        if (chips.scrollWidth <= chips.clientWidth + 1) return;
      }
    }

    // Колесо финала: до 240 px, но так, чтобы колесо и текст помещались в карточку (не меньше 150 px)
    function fitFinale(box, fw, text) {
      var cs = getComputedStyle(box);
      var avail = box.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - parseFloat(cs.rowGap || cs.gap || 0) - text.offsetHeight;
      var size = Math.max(150, Math.min(240, Math.floor(avail), box.clientWidth - 44));
      fw.style.width = fw.style.height = size + 'px';
    }

    // --- Финал: 12 точек по порядку → кольцо → Колесо Дхаммы → текст → кнопки ---
    function showFinale(animate) {
      screen = { type: 'finale' };
      var F = U.finale;
      var anim = animate && !RM;
      var box = h('div', 'pt-card pt-finale' + (anim ? ' pt-flip' : ''));
      var fw = h('div', 'pt-fwheel');
      var glow = h('div', 'pt-fglow');
      fw.appendChild(glow);
      var s = svg('svg', { viewBox: '0 0 240 240', 'aria-hidden': 'true', focusable: 'false' });
      var ring = svg('circle', { cx: 120, cy: 120, r: 49.2, fill: 'none', 'stroke-width': 10, transform: 'rotate(-90 120 120)', 'class': 'pt-ring' });
      s.appendChild(ring);
      var outer = svg('g', { transform: 'translate(20 20) scale(0.390625)' });
      var dharma = svg('g', { 'class': 'pt-dharma' });
      var spin = svg('g', { 'class': 'pt-spin' });
      spin.appendChild(dharmaWheel());
      dharma.appendChild(spin); outer.appendChild(dharma); s.appendChild(outer);
      var dots = [];
      for (var k = 1; k <= 12; k++) {
        var p = pt(120, 120, 92, k);
        var c = svg('circle', { cx: p.x, cy: p.y, r: 7, 'class': 'pt-fdot pt-life-' + lifeOf(k) });
        s.appendChild(c); dots.push(c);
      }
      fw.appendChild(s);
      box.appendChild(fw);
      var text = h('div', 'pt-ftext');
      var title = h('div', 'pt-ftitle', F.title);
      title.setAttribute('role', 'heading'); title.setAttribute('aria-level', '2');
      text.appendChild(title);
      text.appendChild(h('div', 'pt-fquote', F.quote));
      text.appendChild(h('div', 'pt-fsrc', F.source));
      text.appendChild(h('div', 'pt-fsub', F.text));
      box.appendChild(text);
      setStage(box);
      setProgress(false);
      clearBottom();
      var row = h('div', 'pt-btns pt-btns-col pt-fbtns');
      var reread = btn('pt-btn pt-btn-pri', F.reread);
      var again = btn('pt-btn pt-btn-sec', F.again);
      reread.addEventListener('click', function () { ctx.rereadArticle(); });
      again.addEventListener('click', function () { askReset(); });
      row.appendChild(reread); row.appendChild(again);
      bottom.appendChild(row);
      // Размер колеса — когда кнопки внизу уже на месте: от них зависит высота карточки
      fitFinale(box, fw, text);
      refit = function () { if (screen && screen.type === 'finale' && box.parentNode) fitFinale(box, fw, text); };

      function finalState() {
        dots.forEach(function (c) { c.classList.add('pt-on', 'pt-gone'); });
        ring.classList.add('pt-on'); glow.classList.add('pt-on'); dharma.classList.add('pt-on');
        text.classList.add('pt-on'); row.classList.add('pt-on');
      }
      if (!anim) { box.classList.add('pt-static'); finalState(); focusQuiet(reread); return; }
      // Пока текста не видно, колесо — по центру карточки; с появлением текста поднимается на своё место
      var shift = Math.max(0, Math.round(box.clientHeight / 2 - (fw.offsetTop + fw.offsetHeight / 2)));
      if (shift) {
        fw.style.transition = 'none';
        fw.style.transform = 'translateY(' + shift + 'px)';
        void fw.offsetWidth;
        fw.style.transition = '';
      }
      dots.forEach(function (c, i) { later(function () { c.classList.add('pt-on'); }, 300 + i * 120); });
      var t1 = 300 + 12 * 120 + 150;
      later(function () { ring.classList.add('pt-on'); glow.classList.add('pt-on'); }, t1);
      later(function () { dots.forEach(function (c) { c.classList.add('pt-gone'); }); dharma.classList.add('pt-on'); }, t1 + 950);
      later(function () { fw.style.transform = ''; text.classList.add('pt-on'); }, t1 + 1800);
      later(function () { row.classList.add('pt-on'); focusQuiet(reread); }, t1 + 2500);
    }

    // --- Просмотр звена (с карты или по соседу): всё открыто, внизу «Вернуться к карточке» ---
    function openView(n) { overlays.push({ type: 'view', n: n }); renderOverlay(); }
    function openMap(n) { overlays.push({ type: 'map', n: n }); renderOverlay(); }
    function closeOverlay() { overlays.pop(); if (overlays.length) renderOverlay(); else restoreScreen(); }

    function renderOverlay() {
      var o = overlays[overlays.length - 1];
      if (o.type === 'map') return renderMap(o.n);
      var b = backCard(o.n, true);
      if (!RM) b.card.classList.add('pt-flip');
      setStage(b.card);
      fitText(b.card.querySelector('.pt-term'), ctx.lang === 'thai' ? 46 : 38, 20);
      clearBottom();
      var back = btn('pt-btn pt-btn-sec pt-wide', U.view_back);
      back.addEventListener('click', function () { overlays = []; restoreScreen(); });
      bottom.appendChild(back);
      focusQuiet(back);
    }

    function restoreScreen() {
      var sc = screen;
      if (!sc) return start();
      if (sc.type === 'front') showFront(sc.n);
      else if (sc.type === 'back') showBack(sc.n);
      else if (sc.type === 'milestone') {
        if (!queue.length) rebuildQueue();
        showFront(queue[0]);
      } else showFinale(false);
    }

    // --- Карта круга ---
    function renderMap(current) {
      var M = U.map;
      var box = h('div', 'pt-card pt-map' + (RM ? '' : ' pt-flip'));
      var head = h('div', 'pt-maphead');
      var title = h('div', 'pt-maptitle', M.title);
      title.setAttribute('role', 'heading'); title.setAttribute('aria-level', '2');
      head.appendChild(title);
      var x = btn('pt-round pt-round-sm', null, U.aria.close_map);
      x.appendChild(iconX());
      x.addEventListener('click', closeOverlay);
      head.appendChild(x);
      box.appendChild(head);

      var area = h('div', 'pt-maparea');
      var s = svg('svg', { viewBox: '0 0 330 330', 'aria-hidden': 'true', focusable: 'false' });
      // Радиус круга звеньев в единицах viewBox; подписи ставятся от края кружка в пикселях
      var RN = 78, LGAP = 20;   // LGAP, px: половина кружка (16) + зазор 4
      function arc(fromDeg, toDeg, cls) {
        var r = RN, a1 = fromDeg * Math.PI / 180, a2 = toDeg * Math.PI / 180;
        var large = (toDeg - fromDeg) > 180 ? 1 : 0;
        var d = 'M' + (165 + r * Math.cos(a1)).toFixed(1) + ' ' + (165 + r * Math.sin(a1)).toFixed(1)
          + ' A' + r + ' ' + r + ' 0 ' + large + ' 1 ' + (165 + r * Math.cos(a2)).toFixed(1) + ' ' + (165 + r * Math.sin(a2)).toFixed(1);
        s.appendChild(svg('path', { d: d, fill: 'none', 'stroke-width': 10, 'stroke-linecap': 'round', opacity: 0.25, 'class': 'pt-life-s-' + cls }));
      }
      var deg = function (k) { return -90 + (k - 1) * 30; };
      // Дуги трёх жизней по данным звеньев
      var runs = [];
      D.links.forEach(function (l) {
        var last = runs[runs.length - 1];
        if (last && last.life === l.life) last.to = l.n; else runs.push({ life: l.life, from: l.n, to: l.n });
      });
      runs.forEach(function (r) { arc(deg(r.from) - 13, deg(r.to) + 13, LIFE_CLS[r.life]); });
      // Переходы между жизнями — пунктир; место разрыва цепи (звено с break и следующее) — акцентом
      function mark(k, cls, width, dash) {
        var aDeg = deg(k) + 15, aa = aDeg * Math.PI / 180;
        var attrs = { x1: (165 + (RN - 16) * Math.cos(aa)).toFixed(1), y1: (165 + (RN - 16) * Math.sin(aa)).toFixed(1), x2: (165 + (RN + 16) * Math.cos(aa)).toFixed(1), y2: (165 + (RN + 16) * Math.sin(aa)).toFixed(1),
          'stroke-width': width, 'stroke-linecap': 'round', 'class': cls };
        if (dash) attrs['stroke-dasharray'] = '3 3';
        s.appendChild(svg('line', attrs));
      }
      runs.forEach(function (r, i) { if (i > 0) mark(r.from - 1, 'pt-tx2-s', 1.5, true); });
      D.links.forEach(function (l) { if (l.break) mark(l.n, 'pt-ac-s', 3, false); });
      M.center.forEach(function (line, i) {
        var t = svg('text', { x: 165, y: 165 + (i - (M.center.length - 1) / 2) * 16 + 4, 'text-anchor': 'middle', 'font-size': 13, 'class': 'pt-tx2-f' });
        t.textContent = line;
        s.appendChild(t);
      });
      area.appendChild(s);
      for (var k = 1; k <= 12; k++) (function (k) {
        var p = pt(165, 165, RN, k);
        var nb = btn('pt-mn pt-bd-' + lifeOf(k) + (k === current ? ' pt-mn-cur' : ''), T(k), fill(U.aria.link, { n: T(k), name: L(k).name }));
        nb.style.left = (p.x / 330 * 100) + '%';
        nb.style.top = (p.y / 330 * 100) + '%';
        nb.addEventListener('click', function () { overlays.push({ type: 'view', n: k }); renderOverlay(); });
        area.appendChild(nb);
        var lab = h('span', 'pt-ml' + (k === current ? ' pt-ml-cur' : ''), L(k).name);
        lab.setAttribute('aria-hidden', 'true');
        // Подпись — в 4 px за краем кружка (кружок 32 px при любой ширине карты), снаружи круга:
        // справа — от точки вправо, слева — влево, сверху — вверх, снизу — вниз
        var la = (-90 + (k - 1) * 30) * Math.PI / 180, ca = Math.cos(la), sa = Math.sin(la);
        lab.style.left = 'calc(' + (50 + RN / 330 * 100 * ca).toFixed(2) + '% + ' + (LGAP * ca).toFixed(1) + 'px)';
        lab.style.top = 'calc(' + (50 + RN / 330 * 100 * sa).toFixed(2) + '% + ' + (LGAP * sa).toFixed(1) + 'px)';
        var cl = function (v) { return Math.max(-1, Math.min(1, v * 2)); };   // на диагоналях — целиком в сторону от кружка
        lab.style.transform = 'translate(' + (-50 * (1 - cl(ca))).toFixed(1) + '%, ' + (-50 * (1 - cl(sa))).toFixed(1) + '%)';
        lab.addEventListener('click', function () { nb.click(); });
        area.appendChild(lab);
      })(k);
      box.appendChild(area);

      var legend = h('div', 'pt-legend');
      M.legend.forEach(function (row) {
        var r = h('div', 'pt-lrow');
        r.appendChild(h('span', 'pt-lsw pt-bg-' + LIFE_CLS[row.life]));
        r.appendChild(h('b', 'pt-lrange', row.range));
        r.appendChild(h('span', '', row.text));
        legend.appendChild(r);
      });
      var br = h('div', 'pt-lrow pt-lrow-break');
      br.appendChild(h('span', 'pt-lsw pt-lsw-break'));
      var brt = h('span', '');
      brt.appendChild(h('b', '', M.break_range));
      brt.appendChild(document.createTextNode(' ' + M.break));
      br.appendChild(brt);
      legend.appendChild(br);
      var tr = h('div', 'pt-lrow');
      tr.appendChild(h('span', 'pt-lsw pt-lsw-dash'));
      tr.appendChild(h('span', '', M.transitions));
      legend.appendChild(tr);
      legend.appendChild(h('div', 'pt-lhint', M.hint));
      box.appendChild(legend);
      setStage(box);
      fitLabels(box, area);
      clearBottom();
      focusQuiet(x);
    }

    // Подписи карты не выходят за карточку: уменьшаем шрифт всех подписей, пока не влезут (не меньше 9 px)
    function fitLabels(box, area) {
      var labs = area.querySelectorAll('.pt-ml');
      if (!labs.length) return;
      var size = parseFloat(getComputedStyle(labs[0]).fontSize) || 12;
      var guard = 6;
      function over() {
        var b = box.getBoundingClientRect();
        for (var i = 0; i < labs.length; i++) {
          var r = labs[i].getBoundingClientRect();
          if (r.left < b.left + 2 || r.right > b.right - 2) return true;
        }
        return false;
      }
      while (over() && size > 9 && guard--) {
        size -= 1;
        for (var i = 0; i < labs.length; i++) labs[i].style.fontSize = size + 'px';
      }
    }

    // --- Сброс: подтверждение снизу ---
    var sheet = null;
    function askReset() {
      if (sheet || busy || !remembered.length) return;
      var R = U.reset, n = remembered.length;
      var formIdx = ctx.lang === 'ru' ? ((n % 10 === 1 && n % 100 !== 11) ? 0 : (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) ? 1 : 2) : 0;
      var back = h('div', 'pt-sheet-back');
      sheet = h('div', 'pt-sheet' + (RM ? '' : ' pt-sheet-in'));
      sheet.setAttribute('role', 'alertdialog');
      sheet.setAttribute('aria-modal', 'true');
      var t = h('div', 'pt-sheet-title', R.title);
      t.id = 'pt-reset-title';
      var p = h('p', 'pt-sheet-text', T(fill(R.text, { n: n, links: R.links[formIdx] })));
      p.id = 'pt-reset-text';
      sheet.setAttribute('aria-labelledby', t.id);
      sheet.setAttribute('aria-describedby', p.id);
      sheet.appendChild(t); sheet.appendChild(p);
      var row = h('div', 'pt-btns pt-btns-col');
      var cancel = btn('pt-btn pt-btn-pri', R.cancel);
      var ok = btn('pt-btn pt-btn-danger', R.confirm);
      row.appendChild(ok); row.appendChild(cancel);
      sheet.appendChild(row);
      var opener = document.activeElement;
      function closeSheet() {
        if (!sheet) return;
        back.parentNode && back.parentNode.removeChild(back);
        sheet.parentNode && sheet.parentNode.removeChild(sheet);
        sheet = null;
        wrap.removeAttribute('inert');
        wrap.removeAttribute('aria-hidden');
        focusQuiet(opener && document.contains(opener) ? opener : null);
      }
      cancel.addEventListener('click', closeSheet);
      back.addEventListener('click', closeSheet);
      sheet.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeSheet(); }
        if (e.key === 'Tab') { // фокус по кругу внутри подтверждения
          var f = [ok, cancel], i = f.indexOf(document.activeElement);
          e.preventDefault();
          f[(i + (e.shiftKey ? f.length - 1 : 1)) % f.length].focus();
        }
      });
      ok.addEventListener('click', function () {
        closeSheet();
        remembered = [];
        ctx.storage.remove(progressKey(ctx));
        overlays = [];
        clearTimers();
        busy = false;
        start();
      });
      wrap.setAttribute('inert', '');
      wrap.setAttribute('aria-hidden', 'true');
      root.appendChild(back);
      root.appendChild(sheet);
      sheet.setAttribute('tabindex', '-1');
      focusQuiet(cancel, sheet);
    }
    // Esc в окне: сначала закрывает подтверждение и карту, а не всё приложение
    function onCancel(e) {
      if (sheet) { e.preventDefault(); return; }
      if (overlays.length) { e.preventDefault(); closeOverlay(); }
    }
    var dlg = root.closest ? root.closest('dialog') : null;
    if (dlg) dlg.addEventListener('cancel', onCancel);
    // Поворот экрана, панели Safari: колесо финала подстраивается под новую высоту
    var refit = null;
    function onResize() { if (refit) refit(); }
    window.addEventListener('resize', onResize);

    function start() {
      rebuildQueue();
      setProgress(false);
      if (remembered.length >= N) showFinale(false);
      else showFront(queue[0], 'flip');
    }
    start();

    return {
      unmount: function () {
        clearTimers();
        if (dlg) dlg.removeEventListener('cancel', onCancel);
        document.removeEventListener('keydown', onKey, true);
        document.removeEventListener('pointerdown', onPointer, true);
        window.removeEventListener('resize', onResize);
        root.textContent = '';
      }
    };
  }

  window.PubApps.register('paticcasamuppada', {
    mount: function (root, ctx) { return Trainer(root, ctx); },
    status: function (ctx) {
      var n = loadRemembered(ctx).length;
      return { text: digitsFor(ctx.lang)(fill(ctx.data.ui.card_progress, { n: n })), started: n > 0 };
    },
    cardIcon: function (ctx) {
      var ids = loadRemembered(ctx), lit = {};
      ctx.data.links.forEach(function (l) { if (ids.indexOf(l.id) !== -1) lit[l.n] = true; });
      var s = miniWheel(64, 0, { lit: lit });
      s.setAttribute('class', 'app-paticcasamuppada pt-icon');
      return s;
    }
  });
})();
