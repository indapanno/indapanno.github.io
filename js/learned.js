// Отметки «Изучен / Не изучен». Хранятся в localStorage браузера одним списком
// id терминов; один статус на термин для обоих языков.
//
// Общий модуль: страницы термина (блок #learned-bar), навигатор (кнопки на
// плитках, строка #learned-nav-note) и поиск (window.Learned.isLearned).
// Кнопки — любые .learned-btn[data-learned-id]; клик обрабатывается одним
// делегированным обработчиком, поэтому работает и для кнопок, добавленных позже.

(function () {
  var KEY = 'pali-terms-learned';
  var memory = null; // запасной вариант, если localStorage недоступен

  var STR = {
    ru: {
      todo: 'Не изучен',
      done: 'Изучен',
      titleTodo: 'Отметить термин как изученный',
      titleDone: 'Снять отметку «Изучен»',
      noteCard: 'Личная отметка для себя. Нажмите, когда разберётесь в термине: в навигаторе он станет блёклым. Хранится только в этом браузере.',
      noteNav: 'Кнопка рядом с термином — ваша личная отметка. «Изучен» делает термин блёклым в списке и поиске. Хранится только в этом браузере.',
      linkCard: 'Мой прогресс →'
    },
    thai: {
      todo: 'ยังไม่ได้เรียน',
      done: 'เรียนแล้ว',
      titleTodo: 'ทำเครื่องหมายว่าเรียนแล้ว',
      titleDone: 'ยกเลิกเครื่องหมาย “เรียนแล้ว”',
      noteCard: 'เครื่องหมายส่วนตัวของคุณ กดเมื่อเข้าใจคำศัพท์นี้แล้ว — ในหน้าหลักคำนี้จะจางลง บันทึกไว้ในเบราว์เซอร์นี้เท่านั้น',
      noteNav: 'ปุ่มข้างคำศัพท์คือเครื่องหมายส่วนตัวของคุณ “เรียนแล้ว” จะทำให้คำนั้นจางลงในรายการและการค้นหา บันทึกไว้ในเบราว์เซอร์นี้เท่านั้น',
      linkCard: 'ความคืบหน้าของฉัน →'
    }
  };

  function pageInfo() {
    var path = window.location.pathname;
    var filename = path.substring(path.lastIndexOf('/') + 1);
    return {
      lang: window.TermsLang.get(),
      id: filename.replace(/_(ru|thai)\.html$/, '')
    };
  }

  function strings() { return STR[pageInfo().lang] || STR.ru; }

  // --- Хранилище ---
  function read() {
    try {
      var raw = window.localStorage.getItem(KEY);
      if (!raw) return memory ? memory.slice() : [];
      var arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return [];
      return arr.filter(function (s) { return typeof s === 'string' && s; });
    } catch (e) {
      return memory ? memory.slice() : [];
    }
  }

  function write(list) {
    memory = list.slice();
    try { window.localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) { /* хранилище недоступно */ }
  }

  function isLearned(id) { return read().indexOf(id) !== -1; }

  function setLearned(id, on) {
    var list = read();
    var i = list.indexOf(id);
    if (on && i === -1) list.push(id);
    if (!on && i !== -1) list.splice(i, 1);
    write(list);
    return on;
  }

  function toggle(id) { return setLearned(id, !isLearned(id)); }

  function all() { return read(); }

  // Сбросить все отметки (кнопка на странице «Мой прогресс»)
  function clearAll() {
    memory = [];
    try { window.localStorage.removeItem(KEY); } catch (e) { /* хранилище недоступно */ }
  }

  // Объединение с внешним списком (для импорта). Возвращает число добавленных id.
  function merge(ids) {
    var list = read();
    var added = 0;
    (ids || []).forEach(function (id) {
      if (typeof id === 'string' && id && list.indexOf(id) === -1) { list.push(id); added++; }
    });
    if (added) write(list);
    return added;
  }

  // --- Кнопки ---
  function updateButton(btn) {
    var s = strings();
    var on = isLearned(btn.getAttribute('data-learned-id'));
    btn.classList.toggle('is-learned', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    btn.textContent = on ? '✓ ' + s.done : s.todo;
    btn.title = on ? s.titleDone : s.titleTodo;
    var item = btn.closest('.term-item');
    if (item) item.classList.toggle('is-learned', on);
  }

  function refresh(root) {
    var buttons = (root || document).querySelectorAll('.learned-btn[data-learned-id]');
    Array.prototype.forEach.call(buttons, updateButton);
  }

  document.addEventListener('click', function (e) {
    var btn = e.target.closest ? e.target.closest('.learned-btn[data-learned-id]') : null;
    if (!btn) return;
    e.preventDefault();
    toggle(btn.getAttribute('data-learned-id'));
    refresh(document);
  });

  // Синхронизация между вкладками
  window.addEventListener('storage', function (e) {
    if (e.key === KEY) refresh(document);
  });

  document.addEventListener('DOMContentLoaded', function () {
    var info = pageInfo();
    var s = strings();

    // Карточка термина: кнопка + пояснение
    var bar = document.getElementById('learned-bar');
    if (bar) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'learned-btn';
      btn.setAttribute('data-learned-id', info.id);
      var note = document.createElement('p');
      note.className = 'learned-note';
      note.textContent = s.noteCard;
      var cardLink = document.createElement('a');
      cardLink.href = window.TermsLang.url('progress_' + info.lang + '.html');
      cardLink.textContent = s.linkCard;
      note.appendChild(document.createTextNode(' '));
      note.appendChild(cardLink);
      bar.appendChild(btn);
      bar.appendChild(note);
    }

    // Навигатор: общая строка над списком
    var navNote = document.getElementById('learned-nav-note');
    if (navNote) {
      navNote.textContent = s.noteNav;
      var link = document.createElement('a');
      link.href = window.TermsLang.url('progress_' + info.lang + '.html');
      link.textContent = s.linkCard;
      navNote.appendChild(document.createTextNode(' '));
      navNote.appendChild(link);
    }

    refresh(document);
  });

  window.Learned = {
    isLearned: isLearned,
    set: setLearned,
    toggle: toggle,
    all: all,
    clear: clearAll,
    merge: merge,
    refresh: refresh
  };
})();
