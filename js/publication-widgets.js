// Обогатители публикаций: поповер у ссылки на термин и чек-лист с памятью отметок.
// Разметку делает сборка публикаций (build-publications.js). Без этого скрипта ссылка
// остаётся обычной (новая вкладка), чек-лист и «вопросы и ответы» работают как простая разметка.
// Язык — по <html lang>. Весь текст вставляется через textContent, разметка из данных не создаётся.
(function () {
  'use strict';

  var doc = document;
  var thai = (doc.documentElement.lang || 'ru').toLowerCase().indexOf('th') === 0;
  var LABEL = thai ? { close: 'ปิด', more: 'รายละเอียด' } : { close: 'Закрыть', more: 'Подробнее' };
  var MARGIN = 16;

  // ---------- Поповер ----------
  var pop = null;      // открытый поповер
  var current = null;  // ссылка, к которой он открыт
  var point = null;    // место клика в координатах страницы (null — открыто с клавиатуры)

  function closePopover(returnFocus) {
    if (!pop) return;
    var link = current;
    if (pop.parentNode) pop.parentNode.removeChild(pop);
    pop = null;
    current = null;
    point = null;
    if (link) {
      link.setAttribute('aria-expanded', 'false');
      if (returnFocus) link.focus();
    }
  }

  // Строка ссылки, по которой кликнули: ссылка из нескольких слов может переноситься на несколько строк
  function pickRect(link) {
    var rects = link.getClientRects();
    if (!rects.length) return null;
    if (!point) return rects[0];
    var x = point.x - window.pageXOffset, y = point.y - window.pageYOffset;
    var best = rects[0], bestD = Infinity;
    for (var i = 0; i < rects.length; i++) {
      var r = rects[i];
      var dx = x < r.left ? r.left - x : (x > r.right ? x - r.right : 0);
      var dy = y < r.top ? r.top - y : (y > r.bottom ? y - r.bottom : 0);
      var d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; best = r; }
    }
    return best;
  }

  function position() {
    if (!pop || !current) return;
    var rect = pickRect(current);
    if (!rect) return;
    var vw = doc.documentElement.clientWidth, vh = window.innerHeight;
    var w = pop.offsetWidth, h = pop.offsetHeight;
    var anchorX = point ? point.x - window.pageXOffset - MARGIN : rect.left;
    var left = Math.max(MARGIN, Math.min(anchorX, vw - w - MARGIN));
    var below = vh - rect.bottom - 8, above = rect.top - 8;
    var top = (h > below && above > below) ? rect.top - h - 8 : rect.bottom + 8;
    pop.style.left = Math.round(left + window.pageXOffset) + 'px';
    pop.style.top = Math.round(top + window.pageYOffset) + 'px';
  }

  function openPopover(link, pointer) {
    closePopover(false);
    var p = doc.createElement('div');
    p.className = 'pub-popover';
    p.setAttribute('role', 'dialog');
    p.setAttribute('aria-label', (link.getAttribute('data-title') || link.textContent).trim());
    p.tabIndex = -1;
    p.style.outline = 'none';

    var title = link.getAttribute('data-title');
    var head = null;
    if (title) {
      head = doc.createElement('p');
      head.className = 'pub-popover-title';
      head.textContent = title;
    }

    var text = doc.createElement('p');
    text.className = 'pub-popover-text';
    text.textContent = link.getAttribute('data-interp') || '';

    var more = doc.createElement('a');
    more.className = 'pub-popover-more';
    more.setAttribute('href', link.getAttribute('href') || '#');
    more.setAttribute('target', '_blank');
    more.setAttribute('rel', 'noopener noreferrer');
    more.textContent = LABEL.more;

    var close = doc.createElement('button');
    close.className = 'pub-popover-close';
    close.setAttribute('type', 'button');
    close.setAttribute('aria-label', LABEL.close);
    close.textContent = '\u00d7';
    close.addEventListener('click', function () { closePopover(true); });

    if (head) p.appendChild(head);
    p.appendChild(text);
    p.appendChild(more);
    p.appendChild(close);
    doc.body.appendChild(p);

    pop = p;
    current = link;
    point = pointer || null;
    link.setAttribute('aria-expanded', 'true');
    position();
    p.focus({ preventScroll: true });
  }

  doc.addEventListener('click', function (e) {
    var t = e.target;
    var link = t && t.closest ? t.closest('a.pub-term[data-interp]') : null;
    if (link) {
      if (e.defaultPrevented || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      if (current === link) closePopover(false);
      else openPopover(link, (e.clientX || e.clientY) ? { x: e.clientX + window.pageXOffset, y: e.clientY + window.pageYOffset } : null);
      return;
    }
    if (pop && !pop.contains(t)) closePopover(false);
  });

  doc.addEventListener('keydown', function (e) {
    if (!pop) return;
    if (e.key === 'Escape' || e.key === 'Esc') {
      closePopover(true);
      return;
    }
    if (e.key === 'Tab') {
      var a = doc.activeElement;
      var more = pop.querySelector('.pub-popover-more');
      var close = pop.querySelector('.pub-popover-close');
      var leaving = e.shiftKey ? (a === pop || a === more) : (a === close);
      if (leaving) {
        // Фокус возвращается на ссылку, дальше Tab идёт по порядку страницы
        var link = current;
        closePopover(false);
        if (link) link.focus();
      }
    }
  });

  doc.addEventListener('focusin', function (e) {
    if (pop && !pop.contains(e.target) && e.target !== current) closePopover(false);
  });

  window.addEventListener('resize', position);

  function initLinks() {
    var links = doc.querySelectorAll('a.pub-term[data-interp]');
    for (var i = 0; i < links.length; i++) {
      links[i].setAttribute('aria-haspopup', 'dialog');
      links[i].setAttribute('aria-expanded', 'false');
    }
  }

  // ---------- Чек-лист ----------
  var KEY = 'terms-pub-check:';

  // FNV-1a от текста пункта с нормализованными пробелами: правка текста сбрасывает отметку пункта
  function fingerprint(t) {
    t = String(t).replace(/\s+/g, ' ').trim();
    var h = 2166136261;
    for (var i = 0; i < t.length; i++) {
      h ^= t.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(16);
  }

  function pageName() {
    var parts = window.location.pathname.split('/');
    return parts[parts.length - 1] || 'index';
  }

  function loadMarks(key) {
    try {
      var raw = window.localStorage.getItem(key);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (err) {
      return [];
    }
  }

  function saveMarks(key, arr) {
    try {
      window.localStorage.setItem(key, JSON.stringify(arr));
    } catch (err) { /* запрет или переполнение: работаем в пределах страницы */ }
  }

  function initChecklist(box) {
    var list = box.querySelector('.pub-check-list');
    if (!list) return;
    var key = KEY + pageName() + ':' + (box.getAttribute('data-check') || '1');
    var items = [];
    var lis = list.children;
    for (var i = 0; i < lis.length; i++) {
      var span = lis[i].querySelector('span');
      items.push({ input: lis[i].querySelector('input[type="checkbox"]'), fp: fingerprint(span ? span.textContent : '') });
    }

    // Отмеченные пункты (отпечатки текстов) → в память браузера; пункты остаются на своих местах
    function persist() {
      var marks = [];
      items.forEach(function (item) { if (item.input && item.input.checked) marks.push(item.fp); });
      saveMarks(key, marks);
    }

    var saved = loadMarks(key);
    items.forEach(function (item) {
      if (!item.input) return;
      if (saved.indexOf(item.fp) !== -1) item.input.checked = true;
      item.input.addEventListener('change', persist);
    });
  }

  function init() {
    initLinks();
    var boxes = doc.querySelectorAll('.pub-check');
    for (var i = 0; i < boxes.length; i++) initChecklist(boxes[i]);
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init);
  else init();
})();
