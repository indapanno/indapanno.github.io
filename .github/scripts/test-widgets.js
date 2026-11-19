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

// 2а. Доп. инфо: тот же поповер без ссылки «Подробнее»
check('доп. инфо: скрипт обрабатывает .pub-info с data-interp', /\.pub-info\[data-interp\]/.test(s));
check('доп. инфо: слово доступно с клавиатуры (role="button", tabIndex, Enter/пробел)', /role['"],\s*['"]button/.test(s) && /tabIndex|tabindex/.test(s) && /Enter/.test(s) && /[' ]['"]\s*\|\||e\.key === ' '/.test(s));
check('доп. инфо: системная подсказка title убирается скриптом', /removeAttribute\(['"]title['"]\)/.test(s));
check('доп. инфо: «Подробнее» только у ссылки на термин (есть href)', /getAttribute\(['"]href['"]\)/.test(s) && /if\s*\(\s*href\s*\)|href\s*\?/.test(s));

// 3. Чек-лист: хранение отметок
check('чек-лист: ключ хранения terms-pub-check:', s.includes('terms-pub-check:'));
check('чек-лист: отпечаток FNV-1a (смещение и простое число)', s.includes('2166136261') && s.includes('16777619'));
check('чек-лист: ошибки localStorage перехватываются (try/catch)', /try\s*\{[\s\S]*localStorage[\s\S]*\}\s*catch/.test(s));
check('чек-лист: работает с data-check и разметкой сборки', s.includes('data-check') && s.includes('pub-check'));
check('чек-лист: скрипт не знает о разделах «Не выполнено/Выполнено»', !/pub-check-done|pub-check-title|pub-check-todo/.test(s));

// 4. Стили для того, что создаёт скрипт
const css = read('css/publications.css') || '';
['.pub-popover-title', '.pub-popover-text', '.pub-popover-more', '.pub-popover-close', '.pub-check-list', '.pub-faq-item', '.pub-info'].forEach(sel =>
  check('стили: в css/publications.css есть ' + sel, css.includes(sel)));

check('стили: отметка зачёркивает текст (input:checked + span)', /\.pub-check-list\s+input\[type="checkbox"\]:checked\s*\+\s*span\s*\{[^}]*line-through/.test(css));
check('стили: нет заголовков разделов и списка «Выполнено»', !/pub-check-title|pub-check-done|pub-check-todo/.test(css));
check('стили: в тёмной теме рамка поповера цветом ссылок', /html:not\(\[data-theme="light"\]\)\s+\.pub-popover\s*\{[^}]*border-color:\s*var\(--link-color\)/.test(css));
check('стили: в тёмной теме «×» цветом ссылок и без рамки', /html:not\(\[data-theme="light"\]\)\s+\.pub-popover-close\s*\{[^}]*color:\s*var\(--link-color\)/.test(css) && !/html:not\(\[data-theme="light"\]\)\s+\.pub-popover-close\s*\{[^}]*border/.test(css));

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

// 7. Обогатитель «Приложение»: общий запуск js/app-launcher.js и css/app-launcher.css
const LJS = 'js/app-launcher.js';
const ljs = read(LJS);
check('запуск приложений: js/app-launcher.js существует', ljs !== null);
if (ljs !== null) {
  const syn = spawnSync(process.execPath, ['--check', path.join(ROOT, LJS)], { encoding: 'utf8' });
  check('app-launcher.js: синтаксис корректен (node --check)', syn.status === 0, (syn.stderr || '').split('\n')[0]);
  check('app-launcher.js: без сети и исполнения строк', !/\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|\beval\s*\(|new Function|document\.write|\bimport\s*\(/.test(ljs));
  check('app-launcher.js: разметку строит через createElement (нет innerHTML)', !/innerHTML|insertAdjacentHTML|outerHTML/.test(ljs));
}
const l = ljs || '';
check('app-launcher.js: реестр window.PubApps.register', /window\.PubApps\s*=/.test(l) && /register\s*:/.test(l));
check('app-launcher.js: тема сайта для стилей приложения (data-app-theme)', l.includes('data-app-theme'));
check('app-launcher.js: окно — <dialog> через showModal, вставляется в body', /createElement|el\(\s*'dialog'/.test(l) && l.includes("'dialog'") && l.includes('showModal') && l.includes('document.body.appendChild'));
check('app-launcher.js: «Назад» закрывает окно (pushState и popstate)', l.includes('pushState') && l.includes('popstate'));
check('app-launcher.js: хранилище с приставкой terms-app: и try/catch', l.includes("'terms-app:'") && /try\s*\{[\s\S]*localStorage[\s\S]*\}\s*catch/.test(l));
check('app-launcher.js: контекст приложения (lang, data, storage, close, track, reportError, reducedMotion, rereadArticle)',
  ['lang:', 'data:', 'storage:', 'ctx.close', 'ctx.track', 'ctx.reportError', 'reducedMotion:', 'ctx.rereadArticle'].every(k => l.includes(k)));
check('app-launcher.js: события GoatCounter app/<имя>/<событие>, запуск — launch', l.includes("'app/' + name + '/' + event") && l.includes("track(name, 'launch')"));
check('app-launcher.js: монтирование в try/catch, экран ошибки своими силами', /try\s*\{\s*current\.instance\s*=\s*def\.mount/.test(l) && l.includes('showError'));
check('app-launcher.js: тексты ошибки и частного режима на двух языках', l.includes('Не удалось открыть тренажёр') && l.includes('เปิดแบบฝึกไม่สำเร็จ') && l.includes('Прогресс не сохранится') && l.includes('max.ru/channel_buddhism') && l.includes('line.me/ti/g2/'));
check('app-launcher.js: подписи кнопки «Запустить» / «Продолжить» на двух языках', l.includes('Запустить') && l.includes('Продолжить') && l.includes('เริ่ม') && l.includes('ทำต่อ'));
const lcss = read('css/app-launcher.css') || '';
check('app-launcher.css: окно на весь экран без vh (position: fixed; inset: 0)', /\.app-dialog\s*\{[^}]*position:\s*fixed[^}]*inset:\s*0/.test(lcss) && !/\.app-dialog\s*\{[^}]*\bvh\b/.test(lcss));
check('app-launcher.css: блокировка прокрутки статьи (html.app-open)', /html\.app-open/.test(lcss));
check('app-launcher.css: safe-area учтена', lcss.includes('env(safe-area-inset'));
['.app-card', '.app-card-btn', '.app-card-nojs', '.app-launcher-error', '.app-launcher-strip'].forEach(sel => check('app-launcher.css: есть ' + sel, lcss.includes(sel)));
check('app-launcher.css: касания не меньше 44 px', /min-height:\s*44px/.test(lcss));
check('workflow: пути запуска включают приложения и их запуск', ['publications/apps/**', 'js/app-launcher.js', 'css/app-launcher.css'].every(p => wf.includes("'" + p + "'")));

// 8. Правила для каждого приложения в publications/apps/<имя>/ (TZ_app_paticcasamuppada.md, 3.5)
const APPS_DIR = path.join(ROOT, 'publications/apps');
const appsList = fs.existsSync(APPS_DIR) ? fs.readdirSync(APPS_DIR, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name) : [];

// Селекторы CSS верхнего уровня (и внутри @media / @supports); @keyframes — имя анимации
function cssSelectors(text) {
  const src = text.replace(/\/\*[\s\S]*?\*\//g, '');
  const out = [], stack = [];
  let buf = '';
  for (const ch of src) {
    if (ch === '{') {
      const head = buf.trim(); buf = '';
      const parent = stack[stack.length - 1];
      if (parent === 'keyframes') { stack.push('frame'); continue; }
      if (head.startsWith('@')) {
        if (/^@(-webkit-)?keyframes\s/.test(head)) { out.push({ kind: 'keyframes', text: head.replace(/^@(-webkit-)?keyframes\s+/, '') }); stack.push('keyframes'); }
        else if (/^@(media|supports|container|layer)\b/.test(head)) stack.push('group');
        else { out.push({ kind: 'at', text: head }); stack.push('other'); }
      } else { out.push({ kind: 'rule', text: head }); stack.push('rule'); }
    } else if (ch === '}') { stack.pop(); buf = ''; }
    else if (ch === ';' && (!stack.length || stack[stack.length - 1] === 'group')) buf = '';
    else buf += ch;
  }
  return out;
}

function appRuleProblems(name, js, css) {
  const p = [];
  const pre = '.app-' + name;
  js = js.split('http://www.w3.org/2000/svg').join(''); // пространство имён SVG — не сетевой адрес
  cssSelectors(css).forEach(r => {
    if (r.kind === 'rule') r.text.split(',').map(x => x.trim()).forEach(sel => {
      if (!(sel === pre || sel.startsWith(pre + ' ') || sel.startsWith(pre + '.') || sel.startsWith(pre + ':') || sel.startsWith(pre + '>') || sel.startsWith(pre + '[') || sel.startsWith(pre + '::') || sel.startsWith(pre + ' >'))) p.push('правило CSS без приставки ' + pre + ': «' + sel + '»');
    });
    else if (r.kind === 'keyframes' && !r.text.startsWith('app-' + name)) p.push('@keyframes без приставки app-' + name + ': «' + r.text + '»');
    else if (r.kind === 'at') p.push('в app.css не разрешено «' + r.text.split(/\s/)[0] + '»');
  });
  const banned = [[/\bfetch\s*\(/, 'fetch'], [/XMLHttpRequest/, 'XMLHttpRequest'], [/WebSocket/, 'WebSocket'], [/\bimport\s*\(/, 'import()'], [/\bimport\s+[\w{*]/, 'import'],
    [/https?:\/\//, 'внешний адрес'], [/\beval\s*\(/, 'eval'], [/new\s+Function/, 'new Function'], [/innerHTML|outerHTML|insertAdjacentHTML/, 'innerHTML'],
    [/document\.write/, 'document.write'], [/localStorage|sessionStorage|indexedDB|document\.cookie/, 'хранение не через ctx.storage'], [/sendBeacon/, 'sendBeacon']];
  banned.forEach(([re, what]) => { if (re.test(js)) p.push('в app.js запрещено: ' + what); });
  if (!new RegExp("PubApps\\.register\\(\\s*['\"]" + name + "['\"]").test(js)) p.push("app.js не регистрирует приложение: window.PubApps.register('" + name + "', …)");
  return p;
}

// Проверка самой проверки на заведомо плохом и хорошем приложении
{
  const good = appRuleProblems('demo', "window.PubApps.register('demo', { mount: function (root, ctx) { var b = document.createElement('button'); b.textContent = ctx.data.x; root.appendChild(b); ctx.storage.set('p', 1); return { unmount: function () {} }; } });",
    '.app-demo { color: red; } .app-demo .card, .app-demo:focus { margin: 0; } @media (max-width: 400px) { .app-demo .card { margin: 1px; } } @keyframes app-demo-spin { from { opacity: 0; } to { opacity: 1; } }');
  check('правила приложений: хорошее приложение проходит', good.length === 0, good.join('; '));
  const badCss = appRuleProblems('demo', "window.PubApps.register('demo', {});", '.app-demo { color: red; } body { margin: 0; } @media (max-width: 1px) { .card { x: 1; } } @keyframes spin { from { opacity: 0; } } .app-demox { color: red; }');
  check('правила приложений: правило без приставки ловится (в т.ч. в @media, @keyframes, похожее имя)', badCss.filter(x => /приставки/.test(x)).length === 4, badCss.join('; '));
  ['fetch("/a")', 'new XMLHttpRequest()', 'new WebSocket("x")', 'import("x")', '"https://example.com"', 'eval("1")', 'el.innerHTML = d', 'localStorage.getItem("a")'].forEach(code => {
    const b = appRuleProblems('demo', "window.PubApps.register('demo', {}); " + code, '.app-demo {}');
    check('правила приложений: запрещено ' + code, b.some(x => /запрещено/.test(x)), b.join('; '));
  });
}

appsList.forEach(name => {
  const dir = 'publications/apps/' + name + '/';
  check('приложение ' + name + ': имя — строчные латинские буквы, цифры, дефис', /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name));
  const files = fs.readdirSync(path.join(APPS_DIR, name));
  check('приложение ' + name + ': нет .md (GitHub Pages сделал бы их страницами)', !files.some(f => /\.md$/i.test(f)));
  const ajs = read(dir + 'app.js'), acss = read(dir + 'app.css');
  check('приложение ' + name + ': есть app.json, app.js, app.css', read(dir + 'app.json') !== null && ajs !== null && acss !== null);
  if (ajs !== null) {
    const syn = spawnSync(process.execPath, ['--check', path.join(APPS_DIR, name, 'app.js')], { encoding: 'utf8' });
    check('приложение ' + name + ': синтаксис app.js (node --check)', syn.status === 0, (syn.stderr || '').split('\n')[0]);
  }
  const probs = appRuleProblems(name, ajs || '', acss || '');
  check('приложение ' + name + ': правила 3.5 (CSS с приставкой, без сети, хранение через ctx.storage)', probs.length === 0, probs.join('; '));
});

console.log(failed ? 'ПРОВАЛЕНО: ' + failed + ', пройдено: ' + passed : 'ВСЕ ТЕСТЫ ПРОЙДЕНЫ: ' + passed);
process.exitCode = failed ? 1 : 0;
