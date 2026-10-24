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

  function closePopover(returnFocus) {
    if (!pop) return;
    var link = current;
    if (pop.parentNode) pop.parentNode.removeChild(pop);
    pop = null;
    current = null;
    if (link) {
      link.setAttribute('aria-expanded', 'false');
      if (returnFocus) link.focus();
    }
  }

  function position() {
    if (!pop || !current) return;
    var rects = current.getClientRects();
    if (!rects.length) return;
    var first = rects[0], last = rects[rects.length - 1];
    var vw = doc.documentElement.clientWidth, vh = window.innerHeight;
    var w = pop.offsetWidth, h = pop.offsetHeight;
    var left = Math.max(MARGIN, Math.min(first.left, vw - w - MARGIN));
    var below = vh - last.bottom - 8, above = first.top - 8;
    var top = (h > below && above > below) ? first.top - h - 8 : last.bottom + 8;
    pop.style.left = Math.round(left + window.pageXOffset) + 'px';
    pop.style.top = Math.round(top + window.pageYOffset) + 'px';
  }

  function openPopover(link) {
    closePopover(false);
    var p = doc.createElement('div');
    p.className = 'pub-popover';
    p.setAttribute('role', 'dialog');
    p.setAttribute('aria-label', link.textContent.trim());
    p.tabIndex = -1;
    p.style.outline = 'none';

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

    p.appendChild(text);
    p.appendChild(more);
    p.appendChild(close);
    doc.body.appendChild(p);

    pop = p;
    current = link;
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
      if (current === link) closePopover(false); else openPopover(link);
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
    var lists = box.querySelectorAll('.pub-check-list');
    var todo = null, done = box.querySelector('.pub-check-done-list');
    for (var k = 0; k < lists.length; k++) if (lists[k] !== done) { todo = lists[k]; break; }
    var todoTitle = box.querySelector('.pub-check-title.pub-check-todo');
    var doneTitle = box.querySelector('.pub-check-title.pub-check-done');
    if (!todo || !done) return;

    var key = KEY + pageName() + ':' + (box.getAttribute('data-check') || '1');
    var items = [];
    var lis = todo.children;
    for (var i = 0; i < lis.length; i++) {
      var span = lis[i].querySelector('span');
      items.push({ li: lis[i], input: lis[i].querySelector('input[type="checkbox"]'), order: i, fp: fingerprint(span ? span.textContent : '') });
    }

    function refresh() {
      if (todoTitle) todoTitle.hidden = todo.children.length === 0;
      if (doneTitle) doneTitle.hidden = done.children.length === 0;
      done.hidden = done.children.length === 0;
      todo.hidden = todo.children.length === 0;
    }

    function persist() {
      var marks = [];
      for (var j = 0; j < done.children.length; j++) {
        for (var m = 0; m < items.length; m++) if (items[m].li === done.children[j]) marks.push(items[m].fp);
      }
      saveMarks(key, marks);
    }

    function place(item, isDone) {
      var hadFocus = doc.activeElement === item.input;
      if (isDone) {
        done.appendChild(item.li);
      } else {
        var before = null;
        for (var n = 0; n < todo.children.length; n++) {
          var other = null;
          for (var q = 0; q < items.length; q++) if (items[q].li === todo.children[n]) other = items[q];
          if (other && other.order > item.order) { before = other.li; break; }
        }
        todo.insertBefore(item.li, before);
      }
      item.input.checked = isDone;
      if (hadFocus) item.input.focus({ preventScroll: true });
    }

    var saved = loadMarks(key);
    items.forEach(function (item) {
      if (!item.input) return;
      if (saved.indexOf(item.fp) !== -1) place(item, true);
      item.input.addEventListener('change', function () {
        place(item, item.input.checked);
        refresh();
        persist();
      });
    });
    refresh();
  }

  function init() {
    initLinks();
    var boxes = doc.querySelectorAll('.pub-check');
    for (var i = 0; i < boxes.length; i++) initChecklist(boxes[i]);
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init);
  else init();
})();
