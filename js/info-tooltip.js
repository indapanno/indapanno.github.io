// Заголовок с подсказкой: клик по всему заголовку (не только по значку "i")
// раскрывает/скрывает подсказку. Делегированный обработчик на document —
// работает и для контента, добавленного в DOM позже.

document.addEventListener('click', function (e) {
  var heading = e.target.closest('.info-heading');
  if (!heading) return;
  var tooltip = heading.nextElementSibling;
  if (tooltip && tooltip.classList.contains('info-tooltip')) {
    tooltip.hidden = !tooltip.hidden;
  }
});
