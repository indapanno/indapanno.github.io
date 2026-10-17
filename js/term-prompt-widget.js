document.addEventListener('DOMContentLoaded', function () {
  var input = document.getElementById('term-prompt-input');
  var button = document.getElementById('term-prompt-copy-btn');
  var status = document.getElementById('term-prompt-status');
  if (!input || !button || !status || typeof TERM_PROMPT_TEMPLATE === 'undefined') return;

  var defaultLabel = button.textContent;
  var copiedLabel = button.getAttribute('data-copied-text') || defaultLabel;
  var copiedTimer = null;

  function updateButtonState() {
    var hasValue = input.value.trim().length > 0;
    button.disabled = !hasValue;
    button.setAttribute('aria-disabled', String(!hasValue));
  }

  function buildPrompt() {
    return TERM_PROMPT_TEMPLATE.replace('{{TERM}}', input.value.trim());
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-1000px';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    try { document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(ta);
  }

  function showCopiedState() {
    button.textContent = copiedLabel;
    status.textContent = copiedLabel;
    if (copiedTimer) clearTimeout(copiedTimer);
    copiedTimer = setTimeout(function () {
      button.textContent = defaultLabel;
      status.textContent = '';
    }, 2500);
  }

  function copyPrompt() {
    if (input.value.trim().length === 0) return;
    var text = buildPrompt();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(showCopiedState, function () {
        fallbackCopy(text);
        showCopiedState();
      });
    } else {
      fallbackCopy(text);
      showCopiedState();
    }
  }

  input.addEventListener('input', updateButtonState);
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      copyPrompt();
    }
  });
  button.addEventListener('click', copyPrompt);

  updateButtonState();
});
