// Обогатитель «Рисунок»: увеличение рисунка в окне просмотра (макет согласован 20.11.2026).
// Сборка ставит рисунку data-zoom — адрес крупной версии «имя-2x.png» (или самого рисунка).
// Без JavaScript рисунок остаётся обычной картинкой. Со скриптом: кнопка-лупа на рисунке, окно во весь экран
// в теме сайта (как у галереи). Компьютер: − / процент / +, двойной щелчок, колесо с Ctrl, перетаскивание,
// мини-карта. Подсказка внизу окна видна всегда. Телефон: щипок, двойное касание, «Вписать», свайп вниз закрывает. Esc, ✕ и «Назад» закрывают.
// Тёмная версия рисунка (пара pub-img-light / pub-img-dark): в окне — та, что видна в текущей теме.
(function () {
  'use strict';

  var STR = {
    ru: { open: 'Увеличить', openAria: 'Увеличить рисунок', dialog: 'Просмотр рисунка', close: 'Закрыть',
      zin: 'Увеличить', zout: 'Уменьшить', fit: 'Вписать', fitted: 'Вписано',
      // Подсказки-«клавиши» в верхней панели (зона управления, а не текст рисунка)
      tipsFit: [{ i: 'mouse', k: ['2× щелчок'], t: 'увеличить' }, { k: ['Ctrl', 'колесо'], t: 'плавно', opt: 1 }, { k: ['Esc'], t: 'закрыть' }],
      tipsZoomed: [{ i: 'hand', k: ['перетащить'], t: 'сдвинуть' }, { i: 'mouse', k: ['2× щелчок'], t: 'вписать' }, { k: ['Esc'], t: 'закрыть' }],
      tipTouch: 'Два пальца или двойное касание — увеличить' },
    thai: { open: 'ขยาย', openAria: 'ขยายรูป', dialog: 'ดูรูป', close: 'ปิด',
      zin: 'ขยาย', zout: 'ย่อ', fit: 'พอดีจอ', fitted: 'พอดีจอ',
      tipsFit: [{ i: 'mouse', k: ['ดับเบิลคลิก'], t: 'ขยาย' }, { k: ['Ctrl', 'ล้อเมาส์'], t: 'ขยายทีละน้อย', opt: 1 }, { k: ['Esc'], t: 'ปิด' }],
      tipsZoomed: [{ i: 'hand', k: ['ลาก'], t: 'เลื่อนดู' }, { i: 'mouse', k: ['ดับเบิลคลิก'], t: 'พอดีจอ' }, { k: ['Esc'], t: 'ปิด' }],
      tipTouch: 'ถ่างสองนิ้วหรือแตะสองครั้งเพื่อขยาย' }
  };
  var MAX = 4;                           // наибольшее увеличение относительно «вписано»
  var STEPS = [1, 1.5, 2, 3, 4];         // шаги кнопок − / + и клавиш

  function langOf() { return window.TermsLang && window.TermsLang.get ? window.TermsLang.get() : 'ru'; }
  function num(n, lang) { return lang === 'thai' && typeof toThaiNumerals === 'function' ? toThaiNumerals(n) : String(n); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function svgIcon(d, extra) {
    return '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + (extra || '') + '<path d="' + d + '"/></svg>';
  }
  var ICON_ZOOM = svgIcon('M15.5 15.5L21 21M10.5 7.5v6M7.5 10.5h6', '<circle cx="10.5" cy="10.5" r="6.5"/>');
  var ICON_FIT = svgIcon('M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5');
  var TIP_ICON = {
    mouse: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true" focusable="false"><rect x="6" y="3" width="12" height="18" rx="6"/><path d="M12 7v3"/></svg>',
    hand: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M8 11V6.5a1.5 1.5 0 0 1 3 0V11V5a1.5 1.5 0 0 1 3 0v6V6.5a1.5 1.5 0 0 1 3 0V14c0 3.5-2.4 6-5.8 6-2.4 0-3.9-1.1-5.3-3.2L4 13.4a1.5 1.5 0 0 1 2.4-1.8L8 13.5z"/></svg>',
    pinch: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M14 4h6v6M10 20H4v-6M20 4l-6.5 6.5M4 20l6.5-6.5"/></svg>'
  };

  document.addEventListener('DOMContentLoaded', function () {
    var figures = [];
    Array.prototype.forEach.call(document.querySelectorAll('.pub-body figure'), function (f) {
      if (f.querySelector('img[data-zoom]') && !f.closest('.gallery')) figures.push(f);
    });
    if (!figures.length || typeof HTMLDialogElement !== 'function') return;
    var lang = langOf(), s = STR[lang] || STR.ru;
    var RM = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Клавиатура или касание/мышь: рамку фокуса показываем только работающим с клавиатуры
    var viaKeyboard = false;
    document.addEventListener('keydown', function (e) { if (e.key === 'Tab' || e.key === 'Enter' || e.key === ' ') viaKeyboard = true; }, true);
    document.addEventListener('pointerdown', function () { viaKeyboard = false; }, true);

    // --- Рисунки в статье: обёртка и кнопка-лупа ---
    figures.forEach(function (f) {
      var imgs = Array.prototype.slice.call(f.querySelectorAll('img[data-zoom]'));
      var wrap = document.createElement('span');
      wrap.className = 'figzoom-wrap';
      f.insertBefore(wrap, imgs[0]);
      imgs.forEach(function (im) { wrap.appendChild(im); });
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'figzoom-btn';
      b.setAttribute('aria-label', s.openAria);
      b.innerHTML = ICON_ZOOM + '<span class="figzoom-btn-text"></span>';
      b.querySelector('.figzoom-btn-text').textContent = s.open;
      wrap.appendChild(b);
      f.classList.add('figzoom');
      wrap.addEventListener('click', function (e) { e.preventDefault(); open(f, b); });
    });

    // --- Окно просмотра ---
    var dlg = document.createElement('dialog');
    dlg.className = 'figzoom-dlg';
    dlg.setAttribute('autofocus', '');
    dlg.setAttribute('tabindex', '-1');
    dlg.setAttribute('aria-label', s.dialog);
    dlg.innerHTML =
      '<div class="fz-top"><div class="fz-left">' +
      '<div class="fz-zoom"><button type="button" class="fz-btn fz-out">−</button>' +
      '<button type="button" class="fz-pct"></button>' +
      '<button type="button" class="fz-btn fz-in">+</button></div>' +
      '<button type="button" class="fz-pct fz-fit">' + ICON_FIT + '<span></span></button>' +
      '<p class="fz-tiptouch">' + TIP_ICON.pinch + '<span></span></p></div>' +
      '<div class="fz-tips" aria-hidden="true"></div>' +
      '<button type="button" class="fz-btn fz-close">✕</button></div>' +
      '<div class="fz-stage"><img class="fz-img" alt="" draggable="false">' +
      '<div class="fz-mini" aria-hidden="true"><span><img alt="" draggable="false"><i></i></span></div>' +
      '<div class="fz-pctflash" aria-hidden="true"></div></div>' +
      '<p class="fz-cap"></p>';
    document.body.appendChild(dlg);
    var stage = dlg.querySelector('.fz-stage'), img = dlg.querySelector('.fz-img');
    var mini = dlg.querySelector('.fz-mini'), miniImg = mini.querySelector('img'), miniView = mini.querySelector('i');
    var cap = dlg.querySelector('.fz-cap'), tipsBox = dlg.querySelector('.fz-tips'), flash = dlg.querySelector('.fz-pctflash');
    var bOut = dlg.querySelector('.fz-out'), bIn = dlg.querySelector('.fz-in'), bPct = dlg.querySelector('.fz-zoom .fz-pct');
    var bFit = dlg.querySelector('.fz-fit'), bClose = dlg.querySelector('.fz-close');
    bOut.setAttribute('aria-label', s.zout); bIn.setAttribute('aria-label', s.zin);
    bPct.setAttribute('aria-label', s.fit); bClose.setAttribute('aria-label', s.close);
    bFit.querySelector('span').textContent = s.fit;
    dlg.querySelector('.fz-tiptouch span').textContent = s.tipTouch;
    // Подсказки для мыши: значок, «клавиши», действие; второстепенные прячутся на узком экране
    function buildTips(list) {
      var box = document.createElement('div');
      list.forEach(function (tip, n) {
        var el = document.createElement('span');
        el.className = 'fz-tip' + (tip.opt ? ' fz-tip-opt' : '');
        if (tip.i) el.insertAdjacentHTML('beforeend', TIP_ICON[tip.i]);
        tip.k.forEach(function (k, j) {
          if (j) el.appendChild(document.createTextNode('+'));
          var kb = document.createElement('kbd'); kb.textContent = k; el.appendChild(kb);
        });
        var t = document.createElement('span'); t.className = 'fz-tip-t'; t.textContent = tip.t; el.appendChild(t);
        box.appendChild(el);
      });
      return box;
    }
    var tipsFit = buildTips(s.tipsFit), tipsZoomed = buildTips(s.tipsZoomed);
    tipsFit.className = 'fz-tips-fit'; tipsZoomed.className = 'fz-tips-zoomed';
    tipsBox.appendChild(tipsFit); tipsBox.appendChild(tipsZoomed);

    var cur = null, opener = null, pushed = false, flashTimer = null;
    var W = 0, H = 0, fitW = 0, fitH = 0, ratio = 1;   // размеры сцены и вписанного рисунка
    var sc = 1, tx = 0, ty = 0;                        // увеличение и сдвиг (от центра сцены)

    function isTouch() { return window.matchMedia && window.matchMedia('(pointer: coarse)').matches; }

    function visibleImg(f) {
      var all = f.querySelectorAll('img[data-zoom]');
      for (var i = 0; i < all.length; i++) if (all[i].offsetWidth > 0) return all[i];
      return all[0];
    }

    // Рисунок для окна: сначала тот же файл, что в статье (виден сразу), затем крупная версия
    function loadImage(f) {
      var src = visibleImg(f);
      var w = +src.getAttribute('width') || src.naturalWidth || 4, hh = +src.getAttribute('height') || src.naturalHeight || 3;
      ratio = w / hh;
      img.src = src.currentSrc || src.src;
      miniImg.src = img.src;
      var big = src.getAttribute('data-zoom');
      if (big && big !== src.getAttribute('src')) {
        var pre = new Image();
        pre.onload = function () { if (cur === f && visibleImg(f) === src) img.src = big; };
        pre.src = big;
      }
    }

    function layout() {
      W = stage.clientWidth; H = stage.clientHeight;
      var pad = isTouch() ? 8 : 32;
      fitW = Math.max(40, Math.min(W - pad * 2, (H - pad * 2) * ratio));
      fitH = fitW / ratio;
      img.style.width = fitW + 'px'; img.style.height = fitH + 'px';
      img.style.left = (W - fitW) / 2 + 'px'; img.style.top = (H - fitH) / 2 + 'px';
      clampPan(); render(false);
    }
    function clampPan() {
      var lx = Math.max(0, (fitW * sc - W) / 2), ly = Math.max(0, (fitH * sc - H) / 2);
      tx = clamp(tx, -lx, lx); ty = clamp(ty, -ly, ly);
    }
    function pctText() { return num(Math.round(sc * 100), lang) + '%'; }
    function render(anim) {
      img.style.transition = anim && !RM ? 'transform 0.22s ease' : 'none';
      img.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + sc + ')';
      var zoomed = sc > 1.01;
      dlg.classList.toggle('fz-zoomed', zoomed);
      bPct.textContent = '';
      if (zoomed) { bPct.innerHTML = ICON_FIT; bPct.appendChild(document.createTextNode(pctText())); }
      else bPct.textContent = s.fitted;
      bPct.disabled = !zoomed; bOut.disabled = !zoomed; bIn.disabled = sc >= MAX - 0.01;
      // Мини-карта: какая часть рисунка сейчас видна
      if (zoomed) {
        var dw = fitW * sc, dh = fitH * sc, left = W / 2 + tx - dw / 2, top = H / 2 + ty - dh / 2;
        var x0 = clamp(-left / dw, 0, 1), x1 = clamp((W - left) / dw, 0, 1), y0 = clamp(-top / dh, 0, 1), y1 = clamp((H - top) / dh, 0, 1);
        miniView.style.left = x0 * 100 + '%'; miniView.style.top = y0 * 100 + '%';
        miniView.style.width = (x1 - x0) * 100 + '%'; miniView.style.height = (y1 - y0) * 100 + '%';
      }
    }
    // Увеличить до s2 так, чтобы точка (cx, cy) от центра сцены осталась на месте
    function zoomTo(s2, cx, cy, anim) {
      s2 = clamp(s2, 1, MAX);
      var k = s2 / sc;
      tx = cx - (cx - tx) * k; ty = cy - (cy - ty) * k; sc = s2;
      if (sc <= 1.001) { sc = 1; tx = 0; ty = 0; }
      clampPan(); render(anim);
    }
    function fit() { zoomTo(1, 0, 0, true); }
    function step(dir) {
      var next = dir > 0 ? STEPS.filter(function (v) { return v > sc + 0.01; })[0] : STEPS.filter(function (v) { return v < sc - 0.01; }).pop();
      zoomTo(next === undefined ? (dir > 0 ? MAX : 1) : next, 0, 0, true);
    }
    function showFlash() {
      if (!isTouch() || sc <= 1.01) return;
      flash.textContent = pctText(); flash.classList.add('on');
      clearTimeout(flashTimer); flashTimer = setTimeout(function () { flash.classList.remove('on'); }, 1000);
    }
    function rel(e) { var r = stage.getBoundingClientRect(); return { x: e.clientX - r.left - W / 2, y: e.clientY - r.top - H / 2 }; }

    function open(f, btn) {
      cur = f; opener = btn;
      sc = 1; tx = 0; ty = 0;
      dlg.classList.toggle('fz-touch', isTouch());
      var fc = f.querySelector('figcaption');
      cap.textContent = fc ? fc.textContent : '';
      cap.hidden = !fc;
      loadImage(f);
      dlg.showModal();
      // Фокус — на само окно, а не на кнопку ✕ (иначе вокруг ✕ сразу видна рамка); Tab ведёт к кнопкам
      try { dlg.focus({ preventScroll: true }); } catch (e) { /* ничего */ }
      document.documentElement.classList.add('figzoom-open');
      try { history.pushState({ figzoom: true }, ''); pushed = true; } catch (e) { pushed = false; }
      layout();
    }
    function close(fromHistory) {
      if (!dlg.open) return;
      dlg.close();
      document.documentElement.classList.remove('figzoom-open');
      dlg.style.opacity = '';
      if (pushed && !fromHistory) { pushed = false; try { history.back(); } catch (e) { /* ничего */ } }
      pushed = false;
      if (opener && viaKeyboard) { try { opener.focus({ preventScroll: true }); } catch (e) { /* ничего */ } }
      cur = null;
    }

    bClose.addEventListener('click', function () { close(false); });
    bOut.addEventListener('click', function () { step(-1); });
    bIn.addEventListener('click', function () { step(1); });
    bPct.addEventListener('click', fit);
    bFit.addEventListener('click', fit);
    dlg.addEventListener('cancel', function (e) { e.preventDefault(); close(false); });
    window.addEventListener('popstate', function () { if (dlg.open) { pushed = false; close(true); } });
    window.addEventListener('resize', function () { if (dlg.open) { dlg.classList.toggle('fz-touch', isTouch()); layout(); } });
    // Тема сменилась при открытом окне — показываем версию рисунка для новой темы
    if (window.MutationObserver) {
      new MutationObserver(function () { if (dlg.open && cur) setTimeout(function () { loadImage(cur); layout(); }, 0); })
        .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    }

    dlg.addEventListener('keydown', function (e) {
      if (e.target.closest && e.target.closest('button') && (e.key === 'Enter' || e.key === ' ')) return;
      var k = e.key, p = 80;
      if (k === '+' || k === '=') { e.preventDefault(); step(1); }
      else if (k === '-' || k === '_') { e.preventDefault(); step(-1); }
      else if (k === '0') { e.preventDefault(); fit(); }
      else if (sc > 1.01 && (k === 'ArrowLeft' || k === 'ArrowRight' || k === 'ArrowUp' || k === 'ArrowDown')) {
        e.preventDefault();
        if (k === 'ArrowLeft') tx += p; else if (k === 'ArrowRight') tx -= p; else if (k === 'ArrowUp') ty += p; else ty -= p;
        clampPan(); render(true);
      }
    });

    // Колесо: с Ctrl (и щипок тачпада на Mac) — масштаб в точке курсора; без Ctrl при увеличении — сдвиг
    stage.addEventListener('wheel', function (e) {
      e.preventDefault();
      var mult = e.deltaMode === 1 ? 16 : 1;
      if (e.ctrlKey || e.metaKey) { var r = rel(e); zoomTo(sc * Math.exp(-e.deltaY * mult * 0.01), r.x, r.y, false); }
      else if (sc > 1.01) { tx -= e.deltaX * mult; ty -= e.deltaY * mult; clampPan(); render(false); }
    }, { passive: false });

    function insideImg(e) {
      var ir = img.getBoundingClientRect();
      return e.clientX >= ir.left && e.clientX <= ir.right && e.clientY >= ir.top && e.clientY <= ir.bottom;
    }
    // Мышь: двойной щелчок по рисунку — 200 % в этой точке; при увеличении двойной щелчок — вписать
    // (одиночный щелчок ничего не меняет: меньше случайных срабатываний)
    // Двойной щелчок не должен выделять мини-карту и текст (браузер закрашивает выделенное синим)
    stage.addEventListener('mousedown', function (e) { if (e.detail > 1) e.preventDefault(); });
    stage.addEventListener('dblclick', function (e) {
      try { var sel = window.getSelection(); if (sel && sel.removeAllRanges) sel.removeAllRanges(); } catch (er) { /* ничего */ }
      if (isTouch()) return;
      if (sc > 1.01) { fit(); return; }
      if (insideImg(e)) { var r = rel(e); zoomTo(2, r.x, r.y, true); }
    });

    // Касания и мышь: перетаскивание, щипок, двойное касание, свайп вниз
    var pts = {}, drag = null, pinch = null, lastTap = null, moved = false;
    function count() { return Object.keys(pts).length; }
    function startDrag(e) { drag = { x: e.clientX, y: e.clientY, tx: tx, ty: ty, type: e.pointerType, swipe: false }; moved = false; }
    stage.addEventListener('pointerdown', function (e) {
      if (e.button > 0) return;
      // Первое касание новой серии: забываем «зависшие» касания (если система не прислала их окончание)
      if (e.isPrimary) { pts = {}; pinch = null; drag = null; }
      pts[e.pointerId] = { x: e.clientX, y: e.clientY };
      try { stage.setPointerCapture(e.pointerId); } catch (er) { /* ничего */ }
      if (count() === 1) startDrag(e);
      else if (count() === 2) {
        var a = pts[Object.keys(pts)[0]], b = pts[Object.keys(pts)[1]];
        var r = stage.getBoundingClientRect();
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, s: sc, tx: tx, ty: ty,
          mx: (a.x + b.x) / 2 - r.left - W / 2, my: (a.y + b.y) / 2 - r.top - H / 2 };
        drag = null; moved = true; dlg.style.opacity = '';
      }
      if (sc > 1.01) stage.classList.add('fz-grabbing');
    });
    stage.addEventListener('pointermove', function (e) {
      if (!pts[e.pointerId]) return;
      pts[e.pointerId] = { x: e.clientX, y: e.clientY };
      if (pinch && count() >= 2) {
        var ids = Object.keys(pts), a = pts[ids[0]], b = pts[ids[1]], r = stage.getBoundingClientRect();
        var s2 = clamp(pinch.s * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d, 1, MAX);
        var mx = (a.x + b.x) / 2 - r.left - W / 2, my = (a.y + b.y) / 2 - r.top - H / 2;
        sc = s2;
        tx = mx - (pinch.mx - pinch.tx) * (s2 / pinch.s); ty = my - (pinch.my - pinch.ty) * (s2 / pinch.s);
        clampPan(); render(false); showFlash();
        return;
      }
      if (!drag) return;
      var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!moved && Math.hypot(dx, dy) < 6) return;
      moved = true;
      if (sc > 1.01) { tx = drag.tx + dx; ty = drag.ty + dy; clampPan(); render(false); }
      else if (drag.type !== 'mouse' && (drag.swipe || (dy > 0 && Math.abs(dy) > Math.abs(dx)))) {
        drag.swipe = true;
        img.style.transition = 'none';
        img.style.transform = 'translate(0,' + Math.max(0, dy) + 'px)';
        dlg.style.opacity = String(clamp(1 - Math.max(0, dy) / 400, 0.35, 1));
      }
    });
    function endPointer(e) {
      if (!pts[e.pointerId]) return;
      delete pts[e.pointerId];
      stage.classList.remove('fz-grabbing');
      if (pinch) {
        if (count() < 2) { pinch = null; if (sc < 1.03) fit(); if (count() === 1) { var id = Object.keys(pts)[0]; drag = { x: pts[id].x, y: pts[id].y, tx: tx, ty: ty, type: 'touch', swipe: false }; } }
        return;
      }
      var d = drag; drag = null;
      if (!d) return;
      if (d.swipe) {
        var dy = e.clientY - d.y;
        dlg.style.opacity = '';
        if (dy > 90) { close(false); return; }
        render(true); return;
      }
      if (moved) return;
      // Касание без движения: двойное — увеличить в точке или вписать
      if (d.type !== 'mouse') {
        var now = Date.now();
        if (lastTap && now - lastTap.t < 320 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 30) {
          lastTap = null;
          var r = rel(e);
          if (sc > 1.01) fit(); else { zoomTo(2.5, r.x, r.y, true); showFlash(); }
        } else lastTap = { t: now, x: e.clientX, y: e.clientY };
        return;
      }
      // Мышь: одиночный щелчок мимо рисунка без увеличения — закрыть (увеличение — двойным щелчком, ниже)
      if (sc <= 1.01 && !insideImg(e)) close(false);
    }
    stage.addEventListener('pointerup', endPointer);
    stage.addEventListener('pointercancel', function (e) { if (drag && drag.swipe) { dlg.style.opacity = ''; render(true); } drag = null; endPointer(e); });
  });
})();
