// Счётчик просмотров страницы через GoatCounter.
// Подставляет число в элемент #view-count, если счётчик > 0.
// На тайских страницах число выводится тайскими цифрами.

(function () {
  document.addEventListener('DOMContentLoaded', function () {
    const el = document.getElementById('view-count');
    if (!el) return;

    const path = window.location.pathname;
    const isThai = window.TermsLang.get() === 'thai';

    fetch('https://indapanno.goatcounter.com/counter/' + encodeURIComponent(path) + '.json')
      .then(function (res) { return res.json(); })
      .then(function (data) {
        const count = parseInt(data.count, 10);
        if (count > 0) {
          el.textContent = isThai && window.toThaiNumerals ? window.toThaiNumerals(count) : count;
          el.closest('.view-count-wrap').hidden = false;
        }
      })
      .catch(function () {
        // Тихо игнорируем ошибки счётчика — футер не должен ломаться из-за него.
      });
  });
})();
