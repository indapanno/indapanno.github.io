// Страница «Мой прогресс»: счётчик изученных терминов, скачивание отметок
// в файл и загрузка из файла (с объединением, ничего не стирается).
// Отметки хранит learned.js (window.Learned); здесь только интерфейс страницы.
// Сообщения показываются рядом с элементом, с которым работает пользователь:
// в строке списка (вместо нажатой строки) или в строке статуса своего раздела.

(function () {
  var FORMAT = 'pali-terms-progress';
  var MAX_FILE_BYTES = 1024 * 1024; // файл со списком id столько не весит; всё больше — не наш файл
  var MAX_IDS = 5000;
  var ID_RE = /^[A-Za-z0-9_-]{1,100}$/;

  var STR = {
    ru: {
      count: function (x, y) { return 'Изучено ' + x + ' из ' + y; },
      exportEmpty: 'Пока нет изученных терминов — сохранять нечего.',
      exportDone: function (n) { return 'Файл сохранён (терминов: ' + n + '). Он лежит в папке загрузок браузера.'; },
      importBad: 'Не удалось прочитать файл. Нужен файл, скачанный на этой странице.',
      importBig: 'Файл слишком большой для файла прогресса.',
      importDone: function (added, total) { return 'Загружено. Новых отметок: ' + added + '. Всего изучено: ' + total + '.'; },
      importNone: function (total) { return 'Новых отметок нет: всё из файла уже отмечено. Всего изучено: ' + total + '.'; },
      confirmReset: function (n) { return 'Снять отметки со всех терминов (' + n + ')? Вернуть их можно только из ранее скачанного файла.'; },
      resetDone: 'Все отметки сняты. Вернуть их можно из ранее скачанного файла.',
      rowBtn: '✓ Изучен',
      rowTitle: 'Снять отметку «Изучен»',
      rowBtnTodo: 'Не изучен',
      rowTitleTodo: 'Отметить «Изучен»',
      marked: function (name) { return 'Отмечено «Изучен»: «' + name + '».'; },
      prev: '← Назад',
      next: 'Далее →',
      removed: function (name) { return 'Отметка снята с «' + name + '».'; },
      undo: 'Вернуть',
      noStorage: 'Не удалось запустить страницу. Обновите её или откройте в другом браузере.'
    },
    thai: {
      count: function (x, y) { return 'เรียนแล้ว ' + x + ' จาก ' + y + ' คำ'; },
      exportEmpty: 'ยังไม่มีคำศัพท์ที่เรียนแล้ว — ไม่มีอะไรให้บันทึก',
      exportDone: function (n) { return 'บันทึกไฟล์แล้ว (จำนวนคำศัพท์: ' + n + ') ไฟล์อยู่ในโฟลเดอร์ดาวน์โหลดของเบราว์เซอร์'; },
      importBad: 'อ่านไฟล์ไม่ได้ ต้องใช้ไฟล์ที่ดาวน์โหลดจากหน้านี้',
      importBig: 'ไฟล์ใหญ่เกินไปสำหรับไฟล์ความคืบหน้า',
      importDone: function (added, total) { return 'โหลดแล้ว เครื่องหมายใหม่: ' + added + ' เรียนแล้วทั้งหมด: ' + total; },
      importNone: function (total) { return 'ไม่มีเครื่องหมายใหม่ — ทุกอย่างในไฟล์ถูกทำเครื่องหมายไว้แล้ว เรียนแล้วทั้งหมด: ' + total; },
      confirmReset: function (n) { return 'ล้างเครื่องหมายของทุกคำศัพท์ (' + n + ') หรือไม่ คืนได้จากไฟล์ที่เคยดาวน์โหลดเท่านั้น'; },
      resetDone: 'ล้างเครื่องหมายทั้งหมดแล้ว กู้คืนได้จากไฟล์ที่เคยดาวน์โหลด',
      rowBtn: '✓ เรียนแล้ว',
      rowTitle: 'ยกเลิกเครื่องหมาย “เรียนแล้ว”',
      rowBtnTodo: 'ยังไม่ได้เรียน',
      rowTitleTodo: 'ทำเครื่องหมายว่าเรียนแล้ว',
      marked: function (name) { return 'ทำเครื่องหมาย “เรียนแล้ว” ให้ “' + name + '” แล้ว'; },
      prev: '← ก่อนหน้า',
      next: 'ถัดไป →',
      removed: function (name) { return 'ยกเลิกเครื่องหมายของ “' + name + '” แล้ว'; },
      undo: 'ย้อนกลับ',
      noStorage: 'เริ่มหน้านี้ไม่ได้ ลองรีเฟรชหรือเปิดในเบราว์เซอร์อื่น'
    }
  };

  function pageLang() {
    return window.TermsLang.get();
  }

  // Разбор файла прогресса. Возвращает {ok: true, ids: [...]} или {ok: false}.
  function parseProgressFile(text) {
    var data;
    try { data = JSON.parse(text); } catch (e) { return { ok: false }; }
    if (!data || typeof data !== 'object' || data.format !== FORMAT || !Array.isArray(data.learned)) {
      return { ok: false };
    }
    var ids = [];
    data.learned.slice(0, MAX_IDS).forEach(function (id) {
      if (typeof id === 'string' && ID_RE.test(id) && ids.indexOf(id) === -1) ids.push(id);
    });
    return { ok: true, ids: ids };
  }

  function todayStamp() {
    var d = new Date();
    function p(n) { return (n < 10 ? '0' : '') + n; }
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  document.addEventListener('DOMContentLoaded', function () {
    var countEl = document.getElementById('progress-count');
    var fillEl = document.getElementById('progress-bar-fill');
    var exportBtn = document.getElementById('progress-export-btn');
    var importBtn = document.getElementById('progress-import-btn');
    var importInput = document.getElementById('progress-import-input');
    var statusEls = {
      top: document.getElementById('progress-status-top'),
      exp: document.getElementById('progress-status-export'),
      imp: document.getElementById('progress-status-import'),
      reset: document.getElementById('progress-status-reset')
    };
    var listEl = document.getElementById('progress-list');
    var pagEl = document.getElementById('progress-pagination');
    var emptyEl = document.getElementById('progress-list-empty');
    var todoListEl = document.getElementById('progress-unlearned-list');
    var todoPagEl = document.getElementById('progress-unlearned-pagination');
    var todoEmptyEl = document.getElementById('progress-unlearned-empty');
    var resetBtn = document.getElementById('progress-reset-btn');
    var confirmBox = document.getElementById('progress-confirm');
    var confirmText = document.getElementById('progress-confirm-text');
    var confirmYes = document.getElementById('progress-confirm-yes');
    var confirmNo = document.getElementById('progress-confirm-no');
    if (!countEl || !exportBtn || !importBtn || !importInput || !statusEls.top || !statusEls.exp || !statusEls.imp) return;

    var lang = pageLang();
    var s = STR[lang] || STR.ru;
    var num = function (n) { return lang === 'thai' && window.toThaiNumerals ? window.toThaiNumerals(n) : n; };
    var termIds = null; // id терминов текущего языка (для счётчика)
    var termNames = {}; // id -> название на текущем языке
    var PAGE_SIZE = 10;

    var lists = []; // два списка: изученные и не изученные (у каждого своя страница и строка-сообщение)

    function clearStatuses() {
      Object.keys(statusEls).forEach(function (k) {
        var el = statusEls[k];
        if (el) { el.textContent = ''; el.classList.remove('is-error'); }
      });
    }

    // Показать сообщение в строке статуса своего раздела (остальные очищаются)
    function say(el, text, isError) {
      clearStatuses();
      if (!el) return;
      el.textContent = text;
      el.classList.toggle('is-error', !!isError);
    }

    // Новое действие: убрать прежние сообщения, в том числе строку-сообщение в списке
    function clearNotices() {
      lists.forEach(function (l) { l.notice = null; });
    }

    function resetFeedback() {
      var had = lists.some(function (l) { return !!l.notice; });
      clearNotices();
      clearStatuses();
      if (had) renderLists();
    }

    if (!window.Learned) { say(statusEls.top, s.noStorage, true); return; }

    function renderCount() {
      var learned = window.Learned.all();
      var x = learned.length;
      var y = null;
      if (termIds) {
        // считаем только те отметки, для которых термин есть в текущем списке
        x = learned.filter(function (id) { return termIds.indexOf(id) !== -1; }).length;
        y = termIds.length;
      }
      countEl.textContent = y === null ? String(num(x)) : s.count(num(x), num(y));
      if (fillEl) fillEl.style.width = (y ? Math.round(x / y * 100) : 0) + '%';
      if (resetBtn) resetBtn.disabled = learned.length === 0; // сбрасывать нечего
      return x;
    }

    // --- Список изученных терминов (пагинация без перезагрузки страницы) ---
    function escapeHtml(str) {
      return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function termLabel(id) {
      var n = termNames[id] || id;
      return n.charAt(0).toUpperCase() + n.slice(1);
    }

    function sortByName(ids) {
      return ids.sort(function (a, b) {
        return termLabel(a).localeCompare(termLabel(b), lang === 'thai' ? 'th' : 'ru');
      });
    }

    // Изученные термины текущего языка, по алфавиту
    function learnedSorted() {
      return sortByName(window.Learned.all().filter(function (id) { return termIds.indexOf(id) !== -1; }));
    }

    // Не изученные термины текущего языка, по алфавиту
    function todoSorted() {
      var learned = window.Learned.all();
      return sortByName(termIds.filter(function (id) { return learned.indexOf(id) === -1; }));
    }

    // Список с пагинацией без перезагрузки страницы. cfg: элементы, ids(), кнопка строки,
    // apply(id) — действие кнопки, revert(id) — отмена, noticeText(name) — текст сообщения.
    function makeList(cfg) {
      var L = { page: 1, notice: null };

      L.render = function () {
        if (!cfg.listEl || !termIds) return; // список терминов ещё не загружен
        var ids = cfg.ids();
        var pages = Math.max(1, Math.ceil(ids.length / PAGE_SIZE));
        if (L.page > pages) L.page = pages;
        if (L.page < 1) L.page = 1;

        if (cfg.emptyEl) cfg.emptyEl.hidden = ids.length > 0 || !!L.notice;
        cfg.listEl.hidden = ids.length === 0 && !L.notice;

        var slice = ids.slice((L.page - 1) * PAGE_SIZE, L.page * PAGE_SIZE);
        var rows = slice.map(function (id) {
          return '<li class="progress-row"><a href="' + escapeHtml(window.TermsLang.url('terms/' + id + '_' + lang + '.html')) + '">' + escapeHtml(termLabel(id)) + '</a>'
            + '<button type="button" class="learned-btn' + cfg.btnClass + '" data-row-id="' + escapeHtml(id) + '" title="' + escapeHtml(cfg.btnTitle) + '">' + cfg.btnText + '</button></li>';
        });
        if (L.notice) {
          // на месте нажатой строки — сообщение со ссылкой «Вернуть»
          rows.splice(Math.max(0, Math.min(L.notice.pos - (L.page - 1) * PAGE_SIZE, rows.length)), 0,
            '<li class="progress-row progress-row--notice"><span class="progress-notice-text">' + escapeHtml(cfg.noticeText(termLabel(L.notice.id))) + '</span>'
            + '<a href="#" data-undo-id="' + escapeHtml(L.notice.id) + '">' + escapeHtml(s.undo) + '</a></li>');
        }
        cfg.listEl.innerHTML = rows.join('');

        if (cfg.pagEl) {
          if (pages <= 1) {
            cfg.pagEl.hidden = true;
            cfg.pagEl.innerHTML = '';
          } else {
            var parts = [];
            if (L.page > 1) parts.push('<a href="#" class="page-link" data-page="' + (L.page - 1) + '">' + s.prev + '</a>');
            for (var p = 1; p <= pages; p++) {
              parts.push(p === L.page
                ? '<span class="page-current">' + num(p) + '</span>'
                : '<a href="#" class="page-link" data-page="' + p + '">' + num(p) + '</a>');
            }
            if (L.page < pages) parts.push('<a href="#" class="page-link" data-page="' + (L.page + 1) + '">' + s.next + '</a>');
            cfg.pagEl.innerHTML = parts.join('');
            cfg.pagEl.hidden = false;
          }
        }
      };

      // Нажатая строка могла сдвинуться из-за соседнего списка: вернуть её на то же место экрана
      function keepOnScreen(el, topBefore) {
        if (!el || !el.getBoundingClientRect || typeof window.scrollBy !== 'function') return;
        var delta = el.getBoundingClientRect().top - topBefore;
        if (delta) window.scrollBy(0, delta);
      }

      function focusEl(el) {
        if (!el) return;
        try { el.focus({ preventScroll: true }); } catch (err) { el.focus(); }
      }

      if (cfg.listEl) {
        cfg.listEl.addEventListener('click', function (e) {
          // «Вернуть» в строке-сообщении
          var undo = e.target.closest ? e.target.closest('a[data-undo-id]') : null;
          if (undo) {
            e.preventDefault();
            var uid = undo.getAttribute('data-undo-id');
            var topU = undo.getBoundingClientRect ? undo.getBoundingClientRect().top : 0;
            clearNotices();
            clearStatuses();
            cfg.revert(uid);
            renderCount();
            // вернувшийся термин должен быть виден: перейти на его страницу списка
            var pos = termIds ? cfg.ids().indexOf(uid) : -1;
            if (pos !== -1) L.page = Math.floor(pos / PAGE_SIZE) + 1;
            renderLists();
            var back = cfg.listEl.querySelector('button[data-row-id="' + uid + '"]');
            focusEl(back);
            keepOnScreen(back, topU);
            return;
          }
          // Кнопка в строке: действие, на месте строки — сообщение
          var btn = e.target.closest ? e.target.closest('button[data-row-id]') : null;
          if (!btn) return;
          var id = btn.getAttribute('data-row-id');
          var idx = Array.prototype.indexOf.call(cfg.listEl.querySelectorAll('button[data-row-id]'), btn);
          var topB = btn.getBoundingClientRect ? btn.getBoundingClientRect().top : 0;
          clearNotices();
          clearStatuses();
          cfg.apply(id);
          L.notice = { id: id, pos: (L.page - 1) * PAGE_SIZE + idx };
          renderCount();
          renderLists();
          var link = cfg.listEl.querySelector('a[data-undo-id]');
          focusEl(link);
          keepOnScreen(link, topB);
        });
      }

      if (cfg.pagEl) {
        cfg.pagEl.addEventListener('click', function (e) {
          var a = e.target.closest ? e.target.closest('a[data-page]') : null;
          if (!a) return;
          e.preventDefault();
          clearNotices();
          clearStatuses();
          L.page = parseInt(a.getAttribute('data-page'), 10) || 1;
          renderLists();
        });
      }

      return L;
    }

    var learnedList = makeList({
      listEl: listEl, pagEl: pagEl, emptyEl: emptyEl,
      ids: learnedSorted,
      btnClass: ' is-learned', btnText: s.rowBtn, btnTitle: s.rowTitle,
      apply: function (id) { window.Learned.set(id, false); },
      revert: function (id) { window.Learned.set(id, true); },
      noticeText: s.removed
    });
    var todoList = makeList({
      listEl: todoListEl, pagEl: todoPagEl, emptyEl: todoEmptyEl,
      ids: todoSorted,
      btnClass: '', btnText: s.rowBtnTodo, btnTitle: s.rowTitleTodo,
      apply: function (id) { window.Learned.set(id, true); },
      revert: function (id) { window.Learned.set(id, false); },
      noticeText: s.marked
    });
    lists = [learnedList, todoList];

    function renderLists() {
      lists.forEach(function (l) { l.render(); });
    }

    renderCount();
    fetch(window.TermsLang.url('json/index_' + lang + '.json'))
      .then(function (res) { return res.json(); })
      .then(function (data) {
        termIds = (data.terms || []).map(function (t) { return t.id; });
        (data.terms || []).forEach(function (t) {
          termNames[t.id] = (lang === 'thai' ? t.term_thai : t.term_ru) || t.id;
        });
        renderCount();
        renderLists();
      })
      .catch(function () { /* счётчик останется без «из Y» */ });

    // --- Скачать ---
    exportBtn.addEventListener('click', function () {
      resetFeedback();
      var ids = window.Learned.all().sort();
      if (ids.length === 0) { say(statusEls.exp, s.exportEmpty, true); return; }
      var payload = { format: FORMAT, version: 1, exported: new Date().toISOString(), learned: ids };
      var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'pali-terms-progress-' + todayStamp() + '.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      say(statusEls.exp, s.exportDone(num(ids.length)), false);
    });

    // --- Загрузить ---
    importBtn.addEventListener('click', function () { importInput.click(); });

    importInput.addEventListener('change', function () {
      var file = importInput.files && importInput.files[0];
      if (!file) return;
      resetFeedback();
      if (file.size > MAX_FILE_BYTES) { say(statusEls.imp, s.importBig, true); importInput.value = ''; return; }
      var reader = new FileReader();
      reader.onload = function () {
        var parsed = parseProgressFile(String(reader.result));
        if (!parsed.ok) { say(statusEls.imp, s.importBad, true); }
        else {
          var added = window.Learned.merge(parsed.ids);
          var total = renderCount(); // то же число, что и в счётчике
          renderLists();
          say(statusEls.imp, added > 0 ? s.importDone(num(added), num(total)) : s.importNone(num(total)), false);
        }
        importInput.value = ''; // чтобы тот же файл можно было выбрать снова
      };
      reader.onerror = function () { say(statusEls.imp, s.importBad, true); importInput.value = ''; };
      reader.readAsText(file);
    });

    // --- Сбросить все отметки (с подтверждением на месте кнопки) ---
    if (resetBtn && confirmBox && confirmText && confirmYes && confirmNo) {
      var closeConfirm = function () {
        confirmBox.hidden = true;
        resetBtn.hidden = false;
      };

      resetBtn.addEventListener('click', function () {
        if (resetBtn.disabled) return;
        resetFeedback();
        confirmText.textContent = s.confirmReset(num(renderCount()));
        resetBtn.hidden = true;
        confirmBox.hidden = false;
        confirmNo.focus(); // безопасный вариант по умолчанию
      });

      confirmNo.addEventListener('click', function () {
        closeConfirm();
        resetBtn.focus();
      });

      confirmYes.addEventListener('click', function () {
        resetFeedback();
        window.Learned.clear();
        renderCount();
        renderLists();
        closeConfirm();
        say(statusEls.reset, s.resetDone, false);
        resetBtn.focus();
      });

      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && !confirmBox.hidden) { closeConfirm(); resetBtn.focus(); }
      });
    }

    window.addEventListener('storage', function () {
      clearNotices();
      clearStatuses();
      renderCount();
      renderLists();
    });
  });
})();
