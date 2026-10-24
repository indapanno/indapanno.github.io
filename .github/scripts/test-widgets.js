'use strict';
// Клиентская часть «обогатителей публикаций»: `node .github/scripts/test-widgets.js`.
// Лёгкая проверка без браузера и зависимостей: файл скрипта, подключение в шаблонах,
// стили для классов, которые создаёт скрипт, запуск в CI. Поведение (поповер, чек-лист)
// проверяется отдельно в Chromium перед выкаткой (widgets_TZ.md, шаг 4).
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = process.env.SITE_ROOT || path.resolve(__dirname, '../..');
const read = f => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch (e) { return null; } };

let passed = 0, failed = 0;
function check(name, cond, extra) {
  if (cond) passed++; else { failed++; console.error('ПРОВАЛ: ' + name + (extra ? ' — ' + extra : '')); }
}

const JS = 'js/publication-widgets.js';
const js = read(JS);

// 1. Файл скрипта
check('скрипт js/publication-widgets.js существует', js !== null);
if (js !== null) {
  const syn = spawnSync(process.execPath, ['--check', path.join(ROOT, JS)], { encoding: 'utf8' });
  check('синтаксис скрипта корректен (node --check)', syn.status === 0, (syn.stderr || '').split('\n')[0]);
  check('скрипт не обращается к сети и не исполняет строки', !/\bfetch\s*\(|XMLHttpRequest|sendBeacon|\beval\s*\(|new Function|document\.write|importScripts/.test(js));
  check('скрипт не вставляет разметку из данных (нет innerHTML/insertAdjacentHTML)', !/innerHTML|insertAdjacentHTML|outerHTML/.test(js));
  check('скрипт без внешних адресов', !/https?:\/\//.test(js));
}
const s = js || '';

// 2. Поповер: классы, подписи, доступность
['pub-popover', 'pub-popover-title', 'pub-popover-text', 'pub-popover-more', 'pub-popover-close'].forEach(c =>
  check('поповер: скрипт использует класс ' + c, s.includes(c)));
check('поповер: источник текста — data-interp, заголовок — data-title', s.includes('data-interp') && s.includes('data-title'));
check('поповер: позиция по точке клика (clientX/clientY и строки ссылки)', /clientX/.test(s) && /clientY/.test(s) && /getClientRects/.test(s));
check('поповер: role="dialog" и aria-expanded', s.includes('dialog') && s.includes('aria-expanded'));
check('поповер: подписи «Закрыть» и «ปิด» для двух языков', s.includes('Закрыть') && s.includes('ปิด') && /documentElement\.lang|\.lang\b/.test(s));
check('поповер: «Подробнее» открывается в новой вкладке (target и rel)', s.includes('_blank') && s.includes('noopener noreferrer'));
check('поповер: подписи «Подробнее» и «รายละเอียด» для двух языков', s.includes('Подробнее') && s.includes('รายละเอียด'));
check('поповер: закрытие по Esc', /Escape|['"]Esc['"]/.test(s));
check('поповер: ссылка со стандартным модификатором не перехватывается', /ctrlKey/.test(s) && /metaKey/.test(s) && /shiftKey/.test(s) && /altKey/.test(s) && /button/.test(s));
check('поповер: уход фокуса закрывает (focusin/focusout или keydown Tab)', /focusin|focusout|['"]Tab['"]/.test(s));

// 3. Чек-лист: хранение отметок
check('чек-лист: ключ хранения terms-pub-check:', s.includes('terms-pub-check:'));
check('чек-лист: отпечаток FNV-1a (смещение и простое число)', s.includes('2166136261') && s.includes('16777619'));
check('чек-лист: ошибки localStorage перехватываются (try/catch)', /try\s*\{[\s\S]*localStorage[\s\S]*\}\s*catch/.test(s));
check('чек-лист: работает с data-check и разметкой сборки', s.includes('data-check') && s.includes('pub-check'));
check('чек-лист: скрипт не знает о разделах «Не выполнено/Выполнено»', !/pub-check-done|pub-check-title|pub-check-todo/.test(s));

// 4. Стили для того, что создаёт скрипт
const css = read('css/publications.css') || '';
['.pub-popover-title', '.pub-popover-text', '.pub-popover-more', '.pub-popover-close', '.pub-check-list', '.pub-faq-item'].forEach(sel =>
  check('стили: в css/publications.css есть ' + sel, css.includes(sel)));

check('стили: отметка зачёркивает текст (input:checked + span)', /\.pub-check-list\s+input\[type="checkbox"\]:checked\s*\+\s*span\s*\{[^}]*line-through/.test(css));
check('стили: нет заголовков разделов и списка «Выполнено»', !/pub-check-title|pub-check-done|pub-check-todo/.test(css));
check('стили: в тёмной теме рамка поповера цветом ссылок', /html:not\(\[data-theme="light"\]\)\s+\.pub-popover\s*\{[^}]*border-color:\s*var\(--link-color\)/.test(css));
check('стили: в тёмной теме рамка кнопки закрытия цветом ссылок', /html:not\(\[data-theme="light"\]\)\s+\.pub-popover-close\s*\{[^}]*border-color:\s*var\(--link-color\)/.test(css));

// 5. Подключение в шаблонах обеих языков (ровно один раз)
['ru', 'thai'].forEach(l => {
  const lay = read('_src/publications/template/_layout_' + l + '.html') || '';
  const n = (lay.match(/<script src="\/js\/publication-widgets\.js"[^>]*><\/script>/g) || []).length;
  check('шаблон _layout_' + l + '.html: скрипт подключён один раз', n === 1, 'найдено: ' + n);
  check('шаблон _layout_' + l + '.html: подключение с defer', /<script src="\/js\/publication-widgets\.js" defer><\/script>/.test(lay));
});

// 6. Запуск в CI
const wf = read('.github/workflows/build-publications.yml') || '';
check('workflow: шаг запускает test-widgets.js', /run:\s*node \.github\/scripts\/test-widgets\.js/.test(wf));
check('workflow: пути запуска включают js/publication-widgets.js и test-widgets.js', wf.includes("'js/publication-widgets.js'") && wf.includes("'.github/scripts/test-widgets.js'"));

console.log(failed ? 'ПРОВАЛЕНО: ' + failed + ', пройдено: ' + passed : 'ВСЕ ТЕСТЫ ПРОЙДЕНЫ: ' + passed);
process.exitCode = failed ? 1 : 0;
