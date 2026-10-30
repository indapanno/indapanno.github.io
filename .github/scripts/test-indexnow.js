'use strict';
// Автотесты автоотправки адресов в IndexNow: `node .github/scripts/test-indexnow.js`.
// Модуль .github/scripts/indexnow.js:
//   fileToUrl(file) — адрес страницы по файлу сайта (index.html → «/», a/index.html → «/a/»)
//   sitemapLocs(xml) — адреса <loc> из карты сайта
//   pickUrls({ changed, deleted, sitemapsAfter, sitemapsBefore }) — что отправить:
//      изменённые/новые страницы из карт сайта; удалённые, которые были в картах; адреса, вошедшие в карты или выпавшие из них
//   findKey(root) — ключ IndexNow (файл <32 hex>.txt в корне с тем же содержимым)
//   buildRequest(urls, key) → { url, method, headers, body }
//   send(urls, { key, fetch }) — отправка (пачками до 10 000); пустой список — без запроса
// Запуск в workflow: node .github/scripts/indexnow.js <коммит-до> <коммит-после> — ошибки только предупреждают (код 0).
const fs = require('fs');
const os = require('os');
const path = require('path');

const SITE = 'https://indapanno.github.io';
const REPO = path.resolve(__dirname, '../..');
let passed = 0, failed = 0;
function check(name, cond, extra) {
  if (cond) passed++; else { failed++; console.error('ПРОВАЛ: ' + name + (extra ? ' — ' + extra : '')); }
}
let m = null, loadErr = '';
try { m = require('./indexnow.js'); } catch (e) { loadErr = e.message; }
const tryv = f => { try { return f(); } catch (e) { return { __error: e.message }; } };
const show = v => JSON.stringify(v);

check('indexnow.js загружается и экспортирует функции', !!(m && ['fileToUrl', 'sitemapLocs', 'pickUrls', 'findKey', 'buildRequest', 'send'].every(k => typeof m[k] === 'function')), loadErr);
const f = (name, ...a) => tryv(() => m[name](...a));

// fileToUrl
check('fileToUrl: index.html → «/»', f('fileToUrl', 'index.html') === SITE + '/');
check('fileToUrl: bundle/index.html → «/bundle/»', f('fileToUrl', 'bundle/index.html') === SITE + '/bundle/');
check('fileToUrl: terms/dukkha_ru.html', f('fileToUrl', 'terms/dukkha_ru.html') === SITE + '/terms/dukkha_ru.html');
check('fileToUrl: не страница → null', f('fileToUrl', 'json/index_ru.json') === null && f('fileToUrl', 'sitemap.xml') === null && f('fileToUrl', '_src/templates/_template_ru.html') === null);

// sitemapLocs
const SM = urls => '<?xml version="1.0"?>\n<urlset>\n' + urls.map(u => '  <url>\n    <loc>' + u + '</loc>\n    <xhtml:link rel="alternate" hreflang="th" href="' + u + 'x"/>\n  </url>\n').join('') + '</urlset>\n';
check('sitemapLocs: только <loc>, без hreflang-ссылок', show(f('sitemapLocs', SM([SITE + '/a.html', SITE + '/b.html']))) === show([SITE + '/a.html', SITE + '/b.html']));

// pickUrls
{
  const before = [SM([SITE + '/', SITE + '/terms/a_ru.html', SITE + '/terms/old_ru.html', SITE + '/bundle/bundle_1_ru.html'])];
  const after = [SM([SITE + '/', SITE + '/terms/a_ru.html', SITE + '/terms/new_ru.html', SITE + '/bundle/bundle_1_ru.html', SITE + '/bundle/bundle_2_ru.html'])];
  const r = f('pickUrls', {
    changed: ['index.html', 'terms/a_ru.html', 'terms/new_ru.html', 'terms/stub_thai.html', 'json/index_ru.json', 'sitemap.xml'],
    deleted: ['terms/old_ru.html'], sitemapsAfter: after, sitemapsBefore: before
  });
  const want = [SITE + '/', SITE + '/bundle/bundle_2_ru.html', SITE + '/terms/a_ru.html', SITE + '/terms/new_ru.html', SITE + '/terms/old_ru.html'].sort();
  check('pickUrls: изменённые и новые из карт, удалённые, вошедшие в карту; без заглушек и не-страниц', show(r) === show(want), show(r));
  check('pickUrls: ничего не изменилось → пусто', show(f('pickUrls', { changed: [], deleted: [], sitemapsAfter: after, sitemapsBefore: after })) === '[]');
  check('pickUrls: без повторов', (() => { const x = f('pickUrls', { changed: ['index.html', 'index.html'], deleted: [], sitemapsAfter: after, sitemapsBefore: after }); return Array.isArray(x) && x.length === 1; })());
}

// findKey
{
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'inow-'));
  fs.writeFileSync(path.join(root, '0123456789abcdef0123456789abcdef.txt'), '0123456789abcdef0123456789abcdef\n');
  fs.writeFileSync(path.join(root, 'ffffffffffffffffffffffffffffffff.txt'), 'другое содержимое');
  check('findKey: файл-ключ в корне (имя = содержимое)', f('findKey', root) === '0123456789abcdef0123456789abcdef');
  check('findKey: нет ключа → null', f('findKey', fs.mkdtempSync(path.join(os.tmpdir(), 'inow-'))) === null);
  check('findKey: ключ этого сайта найден в репозитории', typeof f('findKey', REPO) === 'string' && /^[0-9a-f]{32}$/.test(f('findKey', REPO)));
}

// buildRequest
{
  const r = f('buildRequest', [SITE + '/a.html'], 'k'.repeat(32));
  check('buildRequest: общий адрес IndexNow, POST, JSON', r && r.url === 'https://api.indexnow.org/indexnow' && r.method === 'POST' && /json/.test((r.headers || {})['Content-Type'] || ''), show(r));
  check('buildRequest: host, key, keyLocation, urlList', r && r.body && r.body.host === 'indapanno.github.io' && r.body.key === 'k'.repeat(32)
    && r.body.keyLocation === SITE + '/' + 'k'.repeat(32) + '.txt' && show(r.body.urlList) === show([SITE + '/a.html']), show(r && r.body));
}

// send
const fakeFetch = (status, calls) => (url, opt) => { calls.push({ url, body: JSON.parse(opt.body) }); return Promise.resolve({ ok: status < 300, status }); };
const sendP = (urls, status) => { const calls = []; return Promise.resolve().then(() => m.send(urls, { key: 'k'.repeat(32), fetch: fakeFetch(status, calls) })).then(r => ({ ok: true, r, calls }), e => ({ ok: false, e: e.message, calls })); };
Promise.all([
  sendP([SITE + '/a.html'], 200), sendP([SITE + '/a.html'], 202), sendP([], 200), sendP([SITE + '/a.html'], 403),
  sendP(Array.from({ length: 10001 }, (_, i) => SITE + '/p' + i + '.html'), 200)
]).then(([ok200, ok202, empty, bad, big]) => {
  check('send: 200 и 202 — успех', ok200.ok && ok202.ok && ok200.calls.length === 1, show([ok200, ok202]));
  check('send: пустой список — без запроса', empty.ok && empty.calls.length === 0);
  check('send: 403 и прочие ошибки — исключение с кодом', !bad.ok && /403/.test(bad.e || ''), show(bad));
  check('send: больше 10 000 адресов — пачками', big.ok && big.calls.length === 2 && big.calls[0].body.urlList.length === 10000 && big.calls[1].body.urlList.length === 1);
}).catch(e => check('send: тесты не упали', false, e.message)).then(() => {
  // Workflow: после коммита бота — отправка в IndexNow (только если бот что-то закоммитил)
  ['build-terms.yml', 'build-bundles.yml', 'build-publications.yml', 'news.yml'].forEach(w => {
    const t = fs.readFileSync(path.join(REPO, '.github/workflows', w), 'utf8');
    check(w + ': шаг IndexNow после коммита бота', /node \.github\/scripts\/indexnow\.js HEAD~1 HEAD/.test(t) && /committed/.test(t));
  });
  console.log(failed ? 'ПРОВАЛЕНО: ' + failed + ', пройдено: ' + passed : 'ВСЕ ТЕСТЫ ПРОЙДЕНЫ: ' + passed);
  process.exitCode = failed ? 1 : 0;
});
