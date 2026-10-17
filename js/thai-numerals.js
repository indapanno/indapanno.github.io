// Конвертация арабских цифр в тайские (๐๑๒๓๔๕๖๗๘๙).
// Используется и в браузере (footer-counter.js, term-count.js на тайских
// страницах), и в сборочном скрипте (число терминов, версия, пагинация).

var THAI_DIGITS = ['๐', '๑', '๒', '๓', '๔', '๕', '๖', '๗', '๘', '๙'];

function toThaiNumerals(value) {
  return String(value).replace(/[0-9]/g, function (d) { return THAI_DIGITS[+d]; });
}

if (typeof module !== 'undefined') {
  module.exports = { toThaiNumerals };
}
