// Число терминов в навигаторе — для футера. Определяет язык страницы
// по её имени файла и подгружает соответствующий манифест поиска
// (json/index_<lang>.json), где уже ведётся полный список терминов.

document.addEventListener('DOMContentLoaded', function () {
  var el = document.getElementById('term-count');
  if (!el) return;

  var lang = window.TermsLang.get();

  fetch(window.TermsLang.url('json/index_' + lang + '.json'))
    .then(function (res) { return res.json(); })
    .then(function (data) {
      var terms = data.terms || [];
      el.textContent = lang === 'thai' && window.toThaiNumerals ? window.toThaiNumerals(terms.length) : terms.length;
    })
    .catch(function () {
      el.textContent = '';
    });
});
