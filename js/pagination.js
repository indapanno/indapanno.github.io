// Пагинация — общая для всего сайта: сборщики списков (Node) и страница «Мой прогресс» (браузер).
// Одна строка при любом числе страниц: первая, последняя, текущая и соседние, пропуски — «…».
// В HTML лежат сразу два набора номеров: широкий (7 мест) и узкий (5 мест, экраны до 479 px);
// какой показать, решают классы page-wide / page-narrow в css/style.css. Стрелки «Назад» / «Далее»
// стоят всегда, на первой и последней странице — неактивные (ряд не сдвигается).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.TermsPagination = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Номера страниц для окна из `slots` мест (≥ 5, нечётное): числа и 'gap' на месте пропуска.
  // Пропуск всегда скрывает не меньше двух страниц: «…» вместо одного номера не бывает.
  function windowPages(page, total, slots) {
    var out = [], p;
    if (total <= slots) {
      for (p = 1; p <= total; p++) out.push(p);
      return out;
    }
    var inner = slots - 4;               // мест в середине между «1 …» и «… N»: 7 → 3, 5 → 1
    var edge = slots - 2;                // мест у края без пропуска: 7 → 5, 5 → 3
    if (page <= edge - Math.floor(inner / 2)) {
      for (p = 1; p <= edge; p++) out.push(p);
      out.push('gap', total);
    } else if (page >= total - edge + 1 + Math.floor(inner / 2)) {
      out.push(1, 'gap');
      for (p = total - edge + 1; p <= total; p++) out.push(p);
    } else {
      var from = page - Math.floor(inner / 2);
      out.push(1, 'gap');
      for (p = from; p < from + inner; p++) out.push(p);
      out.push('gap', total);
    }
    return out;
  }

  // Ключ позиции: номер p → p, пропуск после номера a → a + 0.5. Одинаковые ключи двух окон — общий элемент.
  function keyed(list) {
    var res = [], prev = 0;
    list.forEach(function (x) {
      if (x === 'gap') res.push({ key: prev + 0.5, gap: true });
      else { res.push({ key: x, p: x }); prev = x; }
    });
    return res;
  }

  // Элементы ряда: { p | gap, wide, narrow } в порядке показа.
  function items(page, total) {
    var map = {};
    keyed(windowPages(page, total, 7)).forEach(function (it) { it.wide = true; map[it.key] = it; });
    keyed(windowPages(page, total, 5)).forEach(function (it) {
      if (map[it.key]) map[it.key].narrow = true;
      else { it.narrow = true; map[it.key] = it; }
    });
    return Object.keys(map).map(Number).sort(function (a, b) { return a - b; }).map(function (k) { return map[k]; });
  }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // opts: page, total, href(p) → адрес, digits(n) → строка номера, labels { pages, page, prev, next },
  // dataPage — ставить data-page (листание без перезагрузки, «Мой прогресс»), id — id элемента nav.
  // inner: true — вернуть только содержимое nav (для готового элемента на странице).
  function render(opts) {
    var page = opts.page, total = opts.total;
    if (!(total > 1)) return '';
    var L = opts.labels;
    var digits = opts.digits || String;
    function attrs(p) {
      return ' href="' + esc(opts.href(p)) + '"' + (opts.dataPage ? ' data-page="' + p + '"' : '');
    }
    function vis(it) {
      return it.wide && it.narrow ? '' : (it.wide ? ' page-wide' : ' page-narrow');
    }
    function step(dir) {
      var target = dir === 'prev' ? page - 1 : page + 1;
      var active = target >= 1 && target <= total;
      var text = dir === 'prev' ? L.prev : L.next;
      var arrow = '<span class="page-arrow" aria-hidden="true">' + (dir === 'prev' ? '←' : '→') + '</span>';
      var label = '<span class="page-step-text">' + esc(text) + '</span>';
      var body = dir === 'prev' ? arrow + label : label + arrow;
      return active
        ? '<a class="page-link page-step page-' + dir + '"' + attrs(target) + ' aria-label="' + esc(text) + '">' + body + '</a>'
        : '<span class="page-link page-step page-' + dir + ' is-disabled" aria-hidden="true">' + body + '</span>';
    }
    var parts = [step('prev')];
    items(page, total).forEach(function (it) {
      if (it.gap) parts.push('<span class="page-gap' + vis(it) + '" aria-hidden="true">…</span>');
      else if (it.p === page) parts.push('<span class="page-current' + vis(it) + '" aria-current="page">' + esc(digits(it.p)) + '</span>');
      else parts.push('<a class="page-link' + vis(it) + '"' + attrs(it.p) + ' aria-label="' + esc(L.page + ' ' + digits(it.p)) + '">' + esc(digits(it.p)) + '</a>');
    });
    parts.push(step('next'));
    if (opts.inner) return parts.join('');
    return '<nav class="pagination"' + (opts.id ? ' id="' + esc(opts.id) + '"' : '') + ' aria-label="' + esc(L.pages) + '">' + parts.join('') + '</nav>';
  }

  // Подписи на языках сайта
  var LABELS = {
    ru: { pages: 'Страницы', page: 'Страница', prev: 'Назад', next: 'Далее' },
    thai: { pages: 'หน้า', page: 'หน้า', prev: 'ย้อนกลับ', next: 'ถัดไป' }
  };

  return { windowPages: windowPages, items: items, render: render, LABELS: LABELS };
});
