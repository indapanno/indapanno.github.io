// Переключатель темы: системная (по умолчанию) / светлая / тёмная.
// Переключатель — группа кнопок #theme-switch.
// Выбор запоминается в localStorage. "Системная" реально проверяет
// настройку ОС через matchMedia (в CSS переменные по умолчанию — тёмные,
// поэтому светлая тема применяется только когда ОС явно предпочитает светлую).

(function () {
  const STORAGE_KEY = 'terms-theme';

  function systemPrefersLight() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
  }

  function applyTheme(theme) {
    const resolved = (theme === 'system') ? (systemPrefersLight() ? 'light' : 'dark') : theme;
    if (resolved === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }

  // Хранилище может быть недоступно (инкогнито, запрет) — страница не должна ломаться.
  function getSavedTheme() {
    var saved = null;
    try { saved = localStorage.getItem(STORAGE_KEY); } catch (e) {}
    return (saved === 'light' || saved === 'dark') ? saved : 'system';
  }

  function setTheme(theme) {
    try {
      if (theme === 'system') {
        localStorage.removeItem(STORAGE_KEY);
      } else {
        localStorage.setItem(STORAGE_KEY, theme);
      }
    } catch (e) {}
    applyTheme(theme);
  }

  function markButtons(group, theme) {
    var buttons = group.querySelectorAll('[data-theme-value]');
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].setAttribute('aria-pressed',
        buttons[i].getAttribute('data-theme-value') === theme ? 'true' : 'false');
    }
  }

  applyTheme(getSavedTheme());

  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', function () {
      if (getSavedTheme() === 'system') applyTheme('system');
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    // Новая разметка: группа кнопок #theme-switch с data-theme-value.
    var group = document.getElementById('theme-switch');
    if (group) {
      markButtons(group, getSavedTheme());
      group.addEventListener('click', function (e) {
        var btn = e.target.closest ? e.target.closest('[data-theme-value]') : null;
        if (!btn || !group.contains(btn)) return;
        var theme = btn.getAttribute('data-theme-value');
        setTheme(theme);
        markButtons(group, theme);
      });
    }
  });
})();
