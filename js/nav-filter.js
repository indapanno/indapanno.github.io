// Фильтр навигатора: «Все · Не изученные · Изученные» над списком терминов.
//
// «Все» — это статичные страницы списка (/, /nav/nav_<язык>_N.html) как есть: их видят поисковики,
// скрипт их не трогает. Два других режима строит скрипт из index_<язык>.json (те же плитки,
// пагинация по 10 без перезагрузки, js/pagination.js). Своих адресов у них нет — для поисковиков
// ничего не меняется. Выбор хранится в sessionStorage: живёт, пока открыта вкладка (термин → «Назад»
// возвращает тот же список), новый визит открывает «Все». Без JavaScript переключателя нет.
// Отметки «Изучен» читает и ставит только js/learned.js (window.Learned); этот файл лишь показывает.

(function () {
  var KEY = 'terms-nav-filter';
  var PAGE_SIZE = 10;
  var STR = {
    ru: {
      show: 'Показать', all: 'Все', todo: 'Не изученные', done: 'Изученные',
      emptyTodo: 'Все термины изучены.',
      emptyDone: 'Изученных терминов пока нет. Когда разберётесь в термине, нажмите «Не изучен» рядом с ним.',
      marked: function (n) { return 'Отмечено «Изучен»: «' + n + '».'; },
      unmarked: function (n) { return 'Отметка снята с «' + n + '».'; },
      undo: 'Вернуть', learnedLabel: 'Не изучен'
    },
    thai: {
      show: 'แสดง', all: 'ทั้งหมด', todo: 'ยังไม่ได้เรียน', done: 'เรียนแล้ว',
      emptyTodo: 'เรียนครบทุกคำแล้ว',
      emptyDone: 'ยังไม่มีคำศัพท์ที่เรียนแล้ว เมื่อเข้าใจคำศัพท์แล้ว ให้กด “ยังไม่ได้เรียน” ข้างคำนั้น',
      marked: function (n) { return 'ทำเครื่องหมาย “เรียนแล้ว” ให้ “' + n + '” แล้ว'; },
      unmarked: function (n) { return 'ยกเลิกเครื่องหมายของ “' + n + '” แล้ว'; },
      undo: 'ย้อนกลับ', learnedLabel: 'ยังไม่ได้เรียน'
    }
  };

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function loadState() {
    try {
      var v = JSON.parse(window.sessionStorage.getItem(KEY) || 'null');
      if (v && (v.mode === 'todo' || v.mode === 'done')) return { mode: v.mode, page: v.page > 0 ? v.page : 1 };
    } catch (e) { /* хранилище недоступно */ }
    return { mode: 'all', page: 1 };
  }

  function saveState(st) {
    try {
      if (st.mode === 'all') window.sessionStorage.removeItem(KEY);
      else window.sessionStorage.setItem(KEY, JSON.stringify({ mode: st.mode, page: st.page }));
    } catch (e) { /* хранилище недоступно: фильтр работает до перезагрузки */ }
  }

  document.addEventListener('DOMContentLoaded', function () {
    var bar = document.getElementById('nav-filter');
    var list = document.getElementById('term-list');
    if (!bar || !list || !window.Learned || !window.TermsPagination) return;

    var lang = window.TermsLang.get();
    var s = STR[lang] || STR.ru;
    var nameKey = lang === 'thai' ? 'term_thai' : 'term_ru';
    var num = function (n) { return lang === 'thai' && typeof window.toThaiNumerals === 'function' ? window.toThaiNumerals(n) : String(n); };

    // Статичный список и пагинация страницы — для режима «Все»
    var staticPag = list.nextElementSibling && list.nextElementSibling.classList.contains('pagination') ? list.nextElementSibling : null;
    var staticHtml = list.innerHTML;
    var pag = document.createElement('nav');
    pag.className = 'pagination';
    pag.setAttribute('aria-label', window.TermsPagination.LABELS[lang].pages);
    pag.hidden = true;
    list.parentNode.insertBefore(pag, staticPag ? staticPag.nextSibling : list.nextSibling);

    var terms = null;      // все термины языка, в порядке навигатора
    var state = loadState();
    var notices = {};      // id → текст сообщения на месте строки, до следующей перерисовки

    function tileHtml(t) {
      var badge = t.later_count > 0 ? ' <span class="count-badge">+' + num(t.later_count) + '</span>' : '';
      var snip = t.snippet ? '<div class="nav-snippet">' + esc(t.snippet) + '</div>' : '';
      return '<li class="term-item"><a href="' + esc(window.TermsLang.url('terms/' + t.id + '_' + lang + '.html')) + '">' + esc(t[nameKey]) + badge + snip + '</a>'
        + '<button type="button" class="learned-btn" data-learned-id="' + esc(t.id) + '">' + s.learnedLabel + '</button></li>';
    }

    function noticeHtml(t) {
      return '<li class="nav-filter-notice" data-notice-id="' + esc(t.id) + '"><span class="nav-filter-notice-text">' + esc(notices[t.id]) + '</span>'
        + '<a href="#" data-undo-id="' + esc(t.id) + '">' + s.undo + '</a></li>';
    }

    // Термины режима; строки с сообщением остаются на своих местах до перерисовки
    function current() {
      var wantLearned = state.mode === 'done';
      return terms.filter(function (t) { return notices[t.id] || window.Learned.isLearned(t.id) === wantLearned; });
    }

    function renderBar() {
      var done = terms.filter(function (t) { return window.Learned.isLearned(t.id); }).length;
      var btn = function (mode, label, n) {
        return '<button type="button" data-filter="' + mode + '" aria-pressed="' + (state.mode === mode) + '">' + label
          + ' <span class="nav-filter-count">' + num(n) + '</span></button>';
      };
      bar.innerHTML = '<span class="nav-filter-label" id="nav-filter-label">' + s.show + '</span>'
        + '<div class="segmented" role="group" aria-labelledby="nav-filter-label">'
        + btn('all', s.all, terms.length) + btn('todo', s.todo, terms.length - done) + btn('done', s.done, done) + '</div>';
      bar.hidden = false;
    }

    function renderList() {
      if (state.mode === 'all') {
        if (list.getAttribute('data-filtered')) { list.innerHTML = staticHtml; list.removeAttribute('data-filtered'); }
        if (staticPag) staticPag.hidden = false;
        pag.hidden = true;
        window.Learned.refresh(list);
        return;
      }
      var set = current();
      var total = Math.max(1, Math.ceil(set.length / PAGE_SIZE));
      if (state.page > total) state.page = total;
      list.setAttribute('data-filtered', state.mode);
      if (staticPag) staticPag.hidden = true;
      if (!set.length) {
        list.innerHTML = '<li class="nav-filter-empty">' + (state.mode === 'todo' ? s.emptyTodo : s.emptyDone) + '</li>';
        pag.hidden = true;
        return;
      }
      list.innerHTML = set.slice((state.page - 1) * PAGE_SIZE, state.page * PAGE_SIZE)
        .map(function (t) { return notices[t.id] ? noticeHtml(t) : tileHtml(t); }).join('');
      window.Learned.refresh(list);
      pag.innerHTML = window.TermsPagination.render({
        page: state.page, total: total, labels: window.TermsPagination.LABELS[lang],
        href: function () { return '#'; }, digits: num, dataPage: true, inner: true
      });
      pag.hidden = total <= 1;
    }

    function render(clearNotices) {
      if (clearNotices) notices = {};
      renderBar();
      renderList();
    }

    bar.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('button[data-filter]') : null;
      if (!b) return;
      var mode = b.getAttribute('data-filter');
      if (mode === state.mode) return;
      state = { mode: mode, page: 1 };
      saveState(state);
      render(true);
    });

    pag.addEventListener('click', function (e) {
      var a = e.target.closest ? e.target.closest('a[data-page]') : null;
      if (!a) return;
      e.preventDefault();
      state.page = parseInt(a.getAttribute('data-page'), 10) || 1;
      saveState(state);
      render(true);
      if (bar.scrollIntoView) bar.scrollIntoView({ block: 'start' });
    });

    // Кнопку «Изучен» уже обработал learned.js: его обработчик на document зарегистрирован раньше этого,
    // поэтому к нашему вызову отметка уже переключена. Здесь только пересчёт и сообщение.
    document.addEventListener('click', function (e) {
      if (!list.contains(e.target)) return;
      var undo = e.target.closest ? e.target.closest('a[data-undo-id]') : null;
      if (undo) {
        e.preventDefault();
        var uid = undo.getAttribute('data-undo-id');
        window.Learned.toggle(uid);
        delete notices[uid];
        render(false);
        var back = list.querySelector('.learned-btn[data-learned-id="' + uid + '"]');
        if (back) back.focus();
        return;
      }
      var btn = e.target.closest ? e.target.closest('.learned-btn[data-learned-id]') : null;
      if (!btn || !terms) return;
      var id = btn.getAttribute('data-learned-id');
      if (state.mode !== 'all') {
        var t = terms.filter(function (x) { return x.id === id; })[0];
        if (t) notices[id] = window.Learned.isLearned(id) ? s.marked(t[nameKey]) : s.unmarked(t[nameKey]);
      }
      render(false);
      var link = list.querySelector('a[data-undo-id="' + id + '"]');
      if (link) link.focus();
    });

    // Отметки изменились в другой вкладке или страница вернулась из кеша кнопкой «Назад»
    window.addEventListener('storage', function (e) { if (terms && e.key === 'pali-terms-learned') render(true); });
    window.addEventListener('pageshow', function (e) { if (terms && e.persisted) render(true); });

    fetch(window.TermsLang.url('json/index_' + lang + '.json'))
      .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
      .then(function (data) {
        terms = (data.terms || []).slice().sort(function (a, b) {
          return String(a[nameKey] || '').localeCompare(String(b[nameKey] || ''), lang === 'thai' ? 'th' : 'ru');
        });
        render(true);
      })
      .catch(function () { /* нет манифеста — остаётся обычный список без фильтра */ });
  });
})();
