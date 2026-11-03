// Галерея фото на странице «О монахе»: превью — обычные ссылки на полное фото
// (без JavaScript фото просто открывается), со скриптом — окно просмотра.
// Листание внутри своей галереи: стрелки ← →, свайп на телефоне, горизонтальный жест тачпада на Mac; Esc и ✕ закрывают.
// В галерее больше 6 фото сначала видны 6, остальные — по кнопке «Показать все (N)».
// Окно — нативный <dialog>: фокус остаётся внутри; после закрытия возвращается на превью только
// при работе с клавиатуры (на телефоне и мышью рамка фокуса вокруг превью не нужна).
// Кнопка «Назад» браузера закрывает окно (а не уводит со страницы); пока фото грузится — индикатор.
(function () {
  'use strict';

  var VISIBLE = 6; // сколько фото видно до нажатия «Показать все»

  var STR = {
    ru: { close: 'Закрыть', prev: 'Предыдущее фото', next: 'Следующее фото', dialog: 'Просмотр фото', more: 'Показать все фото' },
    thai: { close: 'ปิด', prev: 'ภาพก่อนหน้า', next: 'ภาพถัดไป', dialog: 'ดูภาพ', more: 'ดูภาพทั้งหมด' }
  };

  function langOf() {
    return window.TermsLang && window.TermsLang.get ? window.TermsLang.get() : 'ru';
  }

  function num(n, lang) {
    return lang === 'thai' && typeof toThaiNumerals === 'function' ? toThaiNumerals(n) : String(n);
  }

  document.addEventListener('DOMContentLoaded', function () {
    var galleries = Array.prototype.slice.call(document.querySelectorAll('.gallery'));
    if (!galleries.length) return;
    var lang = langOf();
    var s = STR[lang] || STR.ru;

    // Чем пользуется человек: клавиатурой или касанием/мышью
    var viaKeyboard = false;
    document.addEventListener('keydown', function (e) { if (e.key === 'Tab' || e.key === 'Enter' || e.key === ' ') viaKeyboard = true; }, true);
    document.addEventListener('pointerdown', function () { viaKeyboard = false; }, true);

    // Свернуть длинные галереи: первые VISIBLE фото + кнопка
    galleries.forEach(function (g) {
      var all = g.querySelectorAll('.gallery-grid > li');
      if (all.length <= VISIBLE) return;
      g.classList.add('is-collapsed');
      var more = document.createElement('button');
      more.type = 'button';
      more.className = 'gallery-more';
      more.textContent = s.more + ' (' + num(all.length, lang) + ')';
      more.addEventListener('click', function () {
        g.classList.remove('is-collapsed');
        more.remove();
        var next = all[VISIBLE].querySelector('.gallery-link');
        if (next && viaKeyboard) next.focus({ preventScroll: true });
      });
      g.appendChild(more);
    });

    if (typeof HTMLDialogElement !== 'function') return; // очень старый браузер: ссылки просто открывают фото

    var dlg = document.createElement('dialog');
    dlg.className = 'lightbox';
    // Фокус при открытии — на само окно, а не на кнопку ✕ (иначе на iPhone вокруг ✕ сразу видна рамка)
    dlg.setAttribute('autofocus', '');
    dlg.tabIndex = -1;
    dlg.setAttribute('aria-label', s.dialog);
    dlg.innerHTML =
      '<div class="lightbox-top"><span class="lightbox-counter" aria-live="polite"></span>' +
      '<button type="button" class="lightbox-btn lightbox-close" aria-label="' + s.close + '">✕</button></div>' +
      '<div class="lightbox-stage">' +
      '<button type="button" class="lightbox-btn lightbox-prev" aria-label="' + s.prev + '">‹</button>' +
      '<figure class="lightbox-figure"><span class="lightbox-imgwrap"><img class="lightbox-img" alt=""></span>' +
      '<figcaption class="lightbox-caption"><p class="lightbox-text"></p><p class="lightbox-meta"></p></figcaption></figure>' +
      '<button type="button" class="lightbox-btn lightbox-next" aria-label="' + s.next + '">›</button></div>';
    document.body.appendChild(dlg);

    var img = dlg.querySelector('.lightbox-img');
    var figure = dlg.querySelector('.lightbox-figure');
    var counter = dlg.querySelector('.lightbox-counter');
    var text = dlg.querySelector('.lightbox-text');
    var meta = dlg.querySelector('.lightbox-meta');
    var btnPrev = dlg.querySelector('.lightbox-prev');
    var btnNext = dlg.querySelector('.lightbox-next');
    var btnClose = dlg.querySelector('.lightbox-close');

    var items = [];   // ссылки текущей галереи
    var index = 0;
    var opener = null;
    var openedByKeyboard = false;

    function preload(i) {
      if (i < 0 || i >= items.length) return;
      var p = new Image();
      p.src = items[i].href;
    }

    function show(i) {
      if (i < 0 || i >= items.length) return;
      index = i;
      var a = items[i];
      var thumb = a.querySelector('img');
      // Сразу показываем уже загруженное превью (окно не пустое), полное фото подменяет его после загрузки
      var full = new Image();
      full.src = a.href;
      if (full.complete && full.naturalWidth) {
        figure.classList.remove('is-loading');
        img.src = a.href;
      } else {
        figure.classList.add('is-loading');
        img.src = thumb ? (thumb.currentSrc || thumb.src) : a.href;
        full.onload = full.onerror = function () {
          if (items[index] !== a) return; // уже пролистали дальше
          img.src = a.href;
          figure.classList.remove('is-loading');
        };
      }
      img.alt = thumb ? thumb.alt : '';
      text.textContent = thumb ? thumb.alt : '';
      meta.textContent = a.getAttribute('data-meta') || '';
      meta.hidden = !meta.textContent;
      counter.textContent = num(i + 1, lang) + ' / ' + num(items.length, lang);
      btnPrev.hidden = i === 0;
      btnNext.hidden = i === items.length - 1;
      preload(i + 1);
      preload(i - 1);
    }

    function open(gallery, link) {
      items = Array.prototype.slice.call(gallery.querySelectorAll('.gallery-link'));
      opener = link;
      openedByKeyboard = viaKeyboard;
      show(items.indexOf(link));
      document.documentElement.classList.add('lightbox-open');
      dlg.showModal();
      if (document.activeElement !== dlg) dlg.focus();
      // Запись в истории: «Назад» закроет окно
      try { history.pushState({ lightbox: true }, ''); pushed = true; } catch (e) { pushed = false; }
    }

    var pushed = false;

    function close() {
      if (dlg.open) dlg.close();
    }


    window.addEventListener('popstate', function () {
      if (dlg.open) { pushed = false; dlg.close(); }
    });

    dlg.addEventListener('close', function () {
      document.documentElement.classList.remove('lightbox-open');
      img.removeAttribute('src');
      figure.classList.remove('is-loading');
      // Закрыли кнопкой ✕, Esc или кликом по фону — убрать свою запись из истории
      if (pushed) { pushed = false; history.back(); }
      if (opener && openedByKeyboard) opener.focus({ preventScroll: true });
      else if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    });

    galleries.forEach(function (g) {
      g.addEventListener('click', function (e) {
        var link = e.target.closest('.gallery-link');
        if (!link || e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        open(g, link);
      });
    });

    btnPrev.addEventListener('click', function () { show(index - 1); });
    btnNext.addEventListener('click', function () { show(index + 1); });
    btnClose.addEventListener('click', close);

    // Клик по тёмному фону вокруг фото закрывает окно
    dlg.addEventListener('click', function (e) {
      if (e.target === dlg || e.target.classList.contains('lightbox-stage')) close();
    });

    dlg.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { e.preventDefault(); show(index - 1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); show(index + 1); }
    });

    // Тачпад Mac: горизонтальный жест двумя пальцами (события wheel с deltaX).
    // Один жест = одно фото. После жеста macOS ещё ~1 с шлёт «инерцию» — затухающие deltaX;
    // её пропускаем. Новый жест узнаём по паузе в событиях или по росту deltaX
    // (инерция только затухает), поэтому второй жест срабатывает, даже если инерция ещё идёт.
    var wSum = 0, wLocked = false, wLockedAt = 0, wLastAbs = 0, wLastTime = 0;
    dlg.addEventListener('wheel', function (e) {
      var dx = e.deltaX * (e.deltaMode === 1 ? 16 : 1);
      var dy = e.deltaY * (e.deltaMode === 1 ? 16 : 1);
      if (Math.abs(dx) <= Math.abs(dy)) return;
      e.preventDefault();
      var now = e.timeStamp || Date.now();
      var abs = Math.abs(dx);
      var gap = now - wLastTime > 150;
      if (wLocked) {
        var fresh = gap || (now - wLockedAt > 200 && abs > wLastAbs * 1.3 + 2);
        wLastAbs = abs; wLastTime = now;
        if (!fresh) return;
        wLocked = false;
        wSum = 0;
      } else if (gap) {
        wSum = 0;
      }
      wLastAbs = abs; wLastTime = now;
      wSum += dx;
      if (Math.abs(wSum) > 50) {
        show(wSum > 0 ? index + 1 : index - 1);
        wLocked = true;
        wLockedAt = now;
        wSum = 0;
      }
    }, { passive: false });

    // Свайп влево/вправо (один палец, горизонтальное движение больше вертикального)
    var startX = null, startY = 0;
    var stage = dlg.querySelector('.lightbox-stage');
    stage.addEventListener('touchstart', function (e) {
      if (e.touches.length !== 1) { startX = null; return; }
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    }, { passive: true });
    stage.addEventListener('touchend', function (e) {
      if (startX === null) return;
      var t = e.changedTouches[0];
      var dx = t.clientX - startX, dy = t.clientY - startY;
      startX = null;
      if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return;
      show(dx < 0 ? index + 1 : index - 1);
    }, { passive: true });
  });
})();
