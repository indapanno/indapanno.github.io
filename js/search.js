// Поиск-подсказка (type-ahead) по названиям терминов.
// Общий компонент для навигационной страницы и карточки термина.
// Ограничивает число подсказок и показывает число "развитий" термина
// (later_count) рядом с названием, если оно больше нуля.

var SEARCH_MAX_SUGGESTIONS = 8;

var SEARCH_UI_STRINGS = {
  ru: function (shown, total) { return 'Показаны первые ' + shown + ' из ' + total + ' — уточните запрос'; },
  thai: function (shown, total) {
    var toThai = window.toThaiNumerals || function (n) { return n; };
    return 'แสดง ' + toThai(shown) + ' จากทั้งหมด ' + toThai(total) + ' รายการ — โปรดระบุคำค้นหาให้ชัดเจนขึ้น';
  }
};

function getCurrentLang() {
  return window.TermsLang.get();
}

function escapeSearchHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

document.addEventListener('DOMContentLoaded', function () {
  var input = document.getElementById('search-input');
  var suggestions = document.getElementById('search-suggestions');
  if (!input || !suggestions) return;

  var lang = getCurrentLang();
  var terms = [];

  fetch(window.TermsLang.url('json/index_' + lang + '.json'))
    .then(function (res) { return res.json(); })
    .then(function (data) { terms = data.terms || []; })
    .catch(function () { terms = []; });

  function nameOf(term) {
    return lang === 'thai' ? term.term_thai : term.term_ru;
  }

  function render(matches) {
    suggestions.innerHTML = '';
    if (matches.length === 0) {
      suggestions.hidden = true;
      return;
    }
    var shown = matches.slice(0, SEARCH_MAX_SUGGESTIONS);
    suggestions.innerHTML = shown.map(function (term) {
      var name = escapeSearchHtml(nameOf(term));
      var badge = (term.later_count && term.later_count > 0)
        ? ' <span class="count-badge">+' + term.later_count + '</span>'
        : '';
      // Изученные термины (отметка из learned.js) показываем блёклыми
      var learnedClass = (window.Learned && window.Learned.isLearned(term.id)) ? ' class="is-learned"' : '';
      return '<a href="' + window.TermsLang.url('terms/' + term.id + '_' + lang + '.html') + '"' + learnedClass + '>' + name + badge + '</a>';
    }).join('');
    if (matches.length > SEARCH_MAX_SUGGESTIONS) {
      var note = document.createElement('div');
      note.className = 'search-empty';
      var noteFn = SEARCH_UI_STRINGS[lang] || SEARCH_UI_STRINGS.ru;
      note.textContent = noteFn(SEARCH_MAX_SUGGESTIONS, matches.length);
      suggestions.appendChild(note);
    }
    suggestions.hidden = false;
  }

  input.addEventListener('input', function () {
    var query = input.value.trim().toLowerCase();
    if (query === '') {
      suggestions.hidden = true;
      suggestions.innerHTML = '';
      return;
    }
    var matches = terms.filter(function (term) {
      var name = (nameOf(term) || '').toLowerCase();
      return name.indexOf(query) !== -1;
    });
    render(matches);
  });

  document.addEventListener('click', function (e) {
    if (!suggestions.contains(e.target) && e.target !== input) {
      suggestions.hidden = true;
    }
  });
});
