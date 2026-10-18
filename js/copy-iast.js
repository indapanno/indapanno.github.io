// Клик (или Enter/пробел, раз это h2, а не нативная кнопка) по транслитерации
// IAST под заголовком — копирует её в буфер обмена. Обратная связь — временная
// смена текста самого элемента (не добавляет новых узлов на странице).

function copyIastText(btn) {
  if (!btn || !navigator.clipboard) return;
  var text = btn.dataset.copyText || btn.textContent;
  navigator.clipboard.writeText(text).then(function () {
    var original = btn.textContent;
    btn.textContent = 'Скопировано ✓';
    btn.classList.add('copied');
    setTimeout(function () {
      btn.textContent = original;
      btn.classList.remove('copied');
    }, 1200);
  }).catch(function () {});
}

document.addEventListener('click', function (e) {
  var btn = e.target.closest('#term-iast-btn');
  if (btn) copyIastText(btn);
});

document.addEventListener('keydown', function (e) {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  var btn = e.target.closest && e.target.closest('#term-iast-btn');
  if (!btn) return;
  e.preventDefault();
  copyIastText(btn);
});
