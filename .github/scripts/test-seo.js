'use strict';
// SEO-проверки собранного сайта: `node .github/scripts/test-seo.js`.
// A5 (canonical), A6 (hreflang), A7 (sitemap), A8 (robots.txt). Корень — репозиторий или SITE_ROOT.
const fs = require('fs');
const path = require('path');

const ROOT = process.env.SITE_ROOT || path.resolve(__dirname, '../..');
const SITE = 'https://indapanno.github.io';
const SKIP_TOP = new Set(['_src', '.github', 'docs', 'help', '.git', 'node_modules']);
// Служебные файлы подтверждения прав в вебмастерах (Яндекс, Google) — не страницы сайта
const VERIFY_FILE = /^(yandex_[0-9a-f]+|google[0-9a-f]+)\.html$/;

let passed = 0, failed = 0;
function check(name, cond, extra) {
  if (cond) passed++; else { failed++; console.error('ПРОВАЛ: ' + name + (extra ? ' — ' + extra : '')); }
}

function walk(dir, rel, out) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach(e => {
    const r = rel ? rel + '/' + e.name : e.name;
    if (e.isDirectory()) { if (!(rel === '' && SKIP_TOP.has(e.name))) walk(path.join(dir, e.name), r, out); }
    else if (r.endsWith('.html') && !VERIFY_FILE.test(r)) out.push(r);
  });
  return out;
}

const files = walk(ROOT, '', []);
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

// Собственный канонический адрес страницы по её файлу
function ownUrl(file) {
  if (file === 'index.html') return SITE + '/';
  if (file.endsWith('/index.html')) return SITE + '/' + file.slice(0, -'index.html'.length);
  return SITE + '/' + file;
}
function fileOfUrl(url) {
  if (!url.startsWith(SITE + '/')) return null;
  const p = url.slice(SITE.length + 1).split('#')[0].split('?')[0];
  return p === '' || p.endsWith('/') ? p + 'index.html' : p;
}

const info = {};
files.forEach(f => {
  const h = read(f);
  const canon = [...h.matchAll(/<link\s+rel="canonical"\s+href="([^"]*)"\s*>/g)].map(m => m[1]);
  const alts = [...h.matchAll(/<link\s+rel="alternate"\s+hreflang="([^"]*)"\s+href="([^"]*)"\s*>/g)].map(m => ({ lang: m[1], href: m[2] }));
  info[f] = { canon, alts, noindex: /<meta\s+name="robots"\s+content="[^"]*noindex/.test(h), redirect: /http-equiv="refresh"/.test(h) };
});

// A5: канонические адреса
const badCanon = [], badStub = [];
files.forEach(f => {
  const i = info[f];
  if (i.redirect) {
    const t = i.canon[0] ? fileOfUrl(i.canon[0]) : null;
    if (i.canon.length !== 1 || !t || !fs.existsSync(path.join(ROOT, t)) || (info[t] && info[t].redirect)) badStub.push(f + ' → ' + i.canon.join(','));
    if (i.noindex) badStub.push(f + ': у заглушки есть noindex');
  } else if (!i.noindex) {
    if (i.canon.length !== 1 || i.canon[0] !== ownUrl(f)) badCanon.push(f + ': ' + (i.canon.join(',') || 'нет canonical') + ' (ожидается ' + ownUrl(f) + ')');
  } else if (i.canon.length > 1 || (i.canon.length === 1 && i.canon[0] !== ownUrl(f))) {
    badCanon.push(f + ' (noindex): ' + i.canon.join(','));
  }
});
check('найдены страницы', files.length > 20, String(files.length));
check('A5: у каждой индексируемой страницы один canonical, равный её адресу', badCanon.length === 0, badCanon.slice(0, 6).join(' | '));
check('A5: заглушки: canonical указывает на существующую не-заглушку, без noindex', badStub.length === 0, badStub.slice(0, 6).join(' | '));
check('канонические адреса только с нового домена', files.every(f => info[f].canon.every(c => c.startsWith(SITE + '/') && !c.includes('/buddhism/'))));
check('заглушки есть (terms/index.html, nav/index.html)', info['terms/index.html'] && info['terms/index.html'].redirect && info['nav/index.html'] && info['nav/index.html'].redirect);
// Ручные страницы и списки лежат в папках; в корне прежних nav_*, how-to-*, progress_* быть не должно
{
  const badHow = [];
  ['how-to-add-term', 'how-to-check-json', 'how-to-translate-term'].forEach(p => ['ru', 'thai'].forEach(l => {
    const f = 'how/' + p + '_' + l + '.html';
    if (!info[f] || info[f].redirect || info[f].canon[0] !== SITE + '/' + f) badHow.push(f);
  }));
  check('инструкции: 6 страниц в how/ (canonical = свой адрес)', badHow.length === 0, badHow.join(','));
  const badMy = ['my/progress_ru.html', 'my/progress_thai.html'].filter(f => !info[f] || info[f].redirect || !info[f].noindex);
  check('«Мой прогресс»: my/progress_ru|thai.html есть, noindex', badMy.length === 0, badMy.join(','));
  ['how', 'nav'].forEach(d => check(d + '/index.html — заглушка на «/»', info[d + '/index.html'] && info[d + '/index.html'].redirect && info[d + '/index.html'].canon[0] === SITE + '/'));
  const rootOld = files.filter(f => /^(nav_|how-to-|progress_)/.test(f));
  check('в корне нет nav_*, how-to-*, progress_* (старые адреса — только заглушки в buddhism)', rootOld.length === 0, rootOld.join(','));
}

// A6: hreflang
const badHref = [];
files.forEach(f => {
  const a = info[f].alts;
  if (!a.length) return;
  const set = a.map(x => x.lang + '=' + x.href).sort().join('|');
  const urls = a.filter(x => x.lang !== 'x-default').map(x => x.href);
  if (!urls.includes(ownUrl(f))) badHref.push(f + ': нет ссылки на себя');
  const xd = a.filter(x => x.lang === 'x-default');
  const ru = a.find(x => x.lang === 'ru');
  if (xd.length !== 1 || (ru && xd[0].href !== ru.href)) badHref.push(f + ': x-default должен быть один и вести на ru');
  a.forEach(x => {
    const t = fileOfUrl(x.href);
    if (!t || !fs.existsSync(path.join(ROOT, t))) { badHref.push(f + ': нет страницы ' + x.href); return; }
    if (x.lang === 'x-default') return;
    const back = info[t] ? info[t].alts.map(y => y.lang + '=' + y.href).sort().join('|') : '';
    if (back !== set) badHref.push(f + ' ↔ ' + t + ': пара не взаимна');
  });
});
check('A6: hreflang взаимны, есть ссылка на себя, x-default на ru', badHref.length === 0, badHref.slice(0, 6).join(' | '));
check('есть страницы с hreflang', files.some(f => info[f].alts.length > 0));

// A7: sitemap
function sitemapLocs(file) {
  const t = fs.readFileSync(path.join(ROOT, file), 'utf8');
  return { locs: [...t.matchAll(/<loc>([^<]*)<\/loc>/g)].map(m => m[1]), alts: [...t.matchAll(/<xhtml:link[^>]*href="([^"]*)"/g)].map(m => m[1]) };
}
['sitemap.xml', 'sitemap_publications.xml', 'sitemap_bundles.xml'].forEach(sm => {
  const ok = fs.existsSync(path.join(ROOT, sm));
  check('A7: ' + sm + ' существует', ok);
  if (!ok) return;
  const { locs, alts } = sitemapLocs(sm);
  const problems = [];
  const seen = new Set();
  locs.forEach(u => {
    if (seen.has(u)) problems.push('дубль ' + u); seen.add(u);
    const f = fileOfUrl(u);
    if (!f || u.includes('/buddhism/')) { problems.push('чужой адрес ' + u); return; }
    if (!fs.existsSync(path.join(ROOT, f))) { problems.push('нет файла ' + u); return; }
    const i = info[f];
    if (!i) { problems.push('не страница ' + u); return; }
    if (i.redirect) problems.push('заглушка в sitemap ' + u);
    if (i.noindex) problems.push('noindex в sitemap ' + u);
    if (i.canon[0] !== u) problems.push('canonical ≠ loc ' + u);
    if (/\/index\.html$/.test(u) || /^https:\/\/indapanno\.github\.io\/(how\/|my\/|nav\/index|how-to-|progress_)/.test(u)) problems.push('лишний адрес ' + u);
  });
  alts.forEach(u => { const f = fileOfUrl(u); if (!f || !fs.existsSync(path.join(ROOT, f))) problems.push('hreflang в sitemap: нет файла ' + u); });
  check('A7: ' + sm + ': ' + locs.length + ' адресов, все существуют и канонические, без заглушек и noindex', locs.length > 0 && problems.length === 0, problems.slice(0, 6).join(' | '));
});
{
  const { locs } = sitemapLocs('sitemap.xml');
  check('sitemap.xml: есть «/», /nav/nav_ru_2.html, /nav/nav_thai.html; нет заглушек (корневых nav_*, terms/, nav/)', locs.includes(SITE + '/') && locs.includes(SITE + '/nav/nav_ru_2.html') && locs.includes(SITE + '/nav/nav_thai.html')
    && !locs.some(u => /^https:\/\/indapanno\.github\.io\/nav_|\/terms\/index\.html$|\/terms\/$|\/nav\/$|\/nav\/index\.html$/.test(u)));
}

// A8: robots.txt
{
  const ok = fs.existsSync(path.join(ROOT, 'robots.txt'));
  const t = ok ? fs.readFileSync(path.join(ROOT, 'robots.txt'), 'utf8') : '';
  check('A8: robots.txt: Allow: / и три строки Sitemap', ok && /^Allow: \/\s*$/m.test(t) && ['sitemap.xml', 'sitemap_publications.xml', 'sitemap_bundles.xml'].every(x => t.includes('Sitemap: ' + SITE + '/' + x)));
}

// A9: связки открыты для поиска (заглушки перевода — нет)
{
  const pagesB = files.filter(f => /^bundle\/(index|bundles_thai|bundle_\d+_(ru|thai)(_\d+)?)\.html$/.test(f) && !info[f].redirect);
  const stubs = pagesB.filter(f => read(f).includes('class="term-card bundle-stub"'));
  const real = pagesB.filter(f => !stubs.includes(f));
  check('A9: связки: найдены опубликованные страницы', real.length >= 3, String(real.length));
  check('A9: опубликованные связки и списки без noindex', real.every(f => !info[f].noindex), real.filter(f => info[f].noindex).join(','));
  check('A9: заглушки перевода связок — noindex', stubs.every(f => info[f].noindex), stubs.filter(f => !info[f].noindex).join(','));
  if (fs.existsSync(path.join(ROOT, 'sitemap_bundles.xml'))) {
    const { locs } = sitemapLocs('sitemap_bundles.xml');
    const miss = real.filter(f => !locs.includes(ownUrl(f)));
    check('A9: все опубликованные страницы связок есть в sitemap_bundles.xml', miss.length === 0, miss.join(','));
  }
}

// A10: меню — готовые ссылки в HTML на всех страницах с меню (поисковики без JavaScript их видят)
const MENU = {
  ru: ['/', '/bundle/', '/my/progress_ru.html', '/publications/', '/new/', '/how/how-to-add-term_ru.html'],
  thai: ['/nav/nav_thai.html', '/bundle/bundles_thai.html', '/my/progress_thai.html', '/publications/publications_thai.html', '/new/news_thai.html', '/how/how-to-add-term_thai.html']
};
const pageLang = h => (/<html lang="th"/.test(h) ? 'thai' : 'ru');
{
  const withMenu = files.filter(f => read(f).includes('id="nav-menu-list"'));
  const bad = withMenu.filter(f => {
    const h = read(f);
    const m = h.match(/<ul id="nav-menu-list" class="nav-menu-list">([\s\S]*?)<\/ul>/);
    const hrefs = m ? [...m[1].matchAll(/<a href="([^"]*)">/g)].map(x => x[1]) : [];
    return hrefs.join() !== MENU[pageLang(h)].join();
  });
  check('A10: найдены страницы с меню', withMenu.length > 100, String(withMenu.length));
  check('A10: в меню 6 готовых ссылок своего языка («Что нового» после «Публикаций»)', bad.length === 0, bad.length + ': ' + bad.slice(0, 6).join(' | '));
}

// A11: переключатель языка — готовые адреса в HTML (те же, что ставит js/lang.js)
function ownPath(file) {
  if (file === 'index.html') return '/';
  if (file.endsWith('/index.html')) return '/' + file.slice(0, -'index.html'.length);
  return '/' + file;
}
function langTarget(p, target) { // повторяет buildTargetUrl из js/lang.js
  const thai = target === 'thai';
  const dir = p.substring(0, p.lastIndexOf('/') + 1), name = p.substring(p.lastIndexOf('/') + 1);
  if (p === '/' || /^\/nav\/nav_(?:ru|thai)(?:_\d+)?\.html$/.test(p)) return thai ? '/nav/nav_thai.html' : '/';
  if (p === '/bundle/' || /^\/bundle\/bundles_(?:ru|thai)(?:_\d+)?\.html$/.test(p)) return thai ? '/bundle/bundles_thai.html' : '/bundle/';
  const b = p.match(/^\/bundle\/bundle_(\d+)_(?:ru|thai)(?:_\d+)?\.html$/);
  if (b) return '/bundle/bundle_' + b[1] + '_' + target + '.html';
  if (p === '/publications/' || /^\/publications\/[^/]+\.html$/.test(p)) return thai ? '/publications/publications_thai.html' : '/publications/';
  // «Что нового»: список и сводки → список другого языка
  if (p === '/new/' || /^\/new\/[^/]+\.html$/.test(p)) return thai ? '/new/news_thai.html' : '/new/';
  const c = name.match(/^(.+)_(ru|thai)\.html$/);
  return c ? dir + c[1] + '_' + target + '.html' : null;
}
{
  const withSwitch = files.filter(f => read(f).includes('id="lang-switch"'));
  const bad = [];
  withSwitch.forEach(f => {
    const h = read(f), cur = pageLang(h), own = ownPath(f);
    const sw = {};
    [...h.matchAll(/<a data-lang-value="(ru|thai)" lang="(?:ru|th)"(?: href="([^"]*)")?>/g)].forEach(m => { sw[m[1]] = m[2] || null; });
    ['ru', 'thai'].forEach(l => {
      const want = l === cur ? own : langTarget(own, l);
      if (sw[l] !== want) bad.push(f + ': ' + l + '=' + sw[l] + ' (ожидается ' + want + ')');
    });
  });
  check('A11: найдены страницы с переключателем языка', withSwitch.length > 100, String(withSwitch.length));
  check('A11: у обеих ссылок переключателя готовый адрес (свой язык — своя страница)', bad.length === 0, bad.length + ': ' + bad.slice(0, 6).join(' | '));
  const sw = f => { const o = {}; [...read(f).matchAll(/<a data-lang-value="(ru|thai)" lang="(?:ru|th)"(?: href="([^"]*)")?>/g)].forEach(m => { o[m[1]] = m[2] || null; }); return o; };
  check('A11: примеры: карточка, навигатор, публикация, инструкция, «Мой прогресс»',
    sw('terms/dukkha_ru.html').thai === '/terms/dukkha_thai.html' && sw('index.html').thai === '/nav/nav_thai.html' && sw('nav/nav_ru_2.html').thai === '/nav/nav_thai.html'
    && sw('publications/chetyre-blagorodnye-istiny.html').thai === '/publications/publications_thai.html' && sw('how/how-to-add-term_ru.html').thai === '/how/how-to-add-term_thai.html'
    && sw('my/progress_thai.html').ru === '/my/progress_ru.html');
}

// A12: раздел «Что нового»: список индексируется, сводки — noindex, follow; sitemap_news.xml и robots.txt
{
  const pagesN = files.filter(f => f.startsWith('new/'));
  const digests = pagesN.filter(f => /^new\/\d{4}-\d{2}-\d{2}_(ru|thai)\.html$/.test(f));
  const lists = pagesN.filter(f => !digests.includes(f));
  check('A12: страницы списка /new/ и /new/news_thai.html есть', pagesN.includes('new/index.html') && pagesN.includes('new/news_thai.html'), pagesN.join(','));
  check('A12: в /new/ нет посторонних файлов', lists.every(f => /^new\/(index|news_(ru|thai)(_\d+)?)\.html$/.test(f)), lists.join(','));
  check('A12: сводки — noindex, follow', digests.every(f => read(f).includes('<meta name="robots" content="noindex, follow">')), digests.filter(f => !read(f).includes('noindex, follow')).join(','));
  const empty = lists.filter(f => !/\/new\/\d{4}-\d{2}-\d{2}_/.test(read(f)));
  check('A12: список без сводок — noindex; со сводками — индексируется', lists.every(f => empty.includes(f) === info[f].noindex), lists.map(f => f + ':' + info[f].noindex).join(','));
  check('A12: sitemap_news.xml есть', fs.existsSync(path.join(ROOT, 'sitemap_news.xml')));
  if (fs.existsSync(path.join(ROOT, 'sitemap_news.xml'))) {
    const { locs } = sitemapLocs('sitemap_news.xml');
    const want = lists.filter(f => !info[f].noindex).map(ownUrl);
    check('A12: в sitemap_news.xml ровно индексируемые страницы списка', locs.slice().sort().join() === want.sort().join(), locs.join(',') + ' / ' + want.join(','));
  }
  check('A12: robots.txt ссылается на sitemap_news.xml', /^Sitemap: https:\/\/indapanno\.github\.io\/sitemap_news\.xml$/m.test(fs.existsSync(path.join(ROOT, 'robots.txt')) ? read('robots.txt') : ''));
}

// A13: подписка на уведомления — на всех страницах с меню подключены push.js, стили, манифест своего языка и иконка
{
  const withMenu = files.filter(f => read(f).includes('id="nav-menu-list"'));
  const need = l => ['<script src="/js/push-config.js"></script>', '<script src="/js/push.js"></script>', '<link rel="stylesheet" href="/css/push.css">',
    '<link rel="manifest" href="/manifest_' + l + '.webmanifest">', '<link rel="apple-touch-icon" href="/img/apple-touch-icon.png">'];
  const bad = withMenu.filter(f => { const h = read(f); return need(pageLang(h)).some(x => !h.includes(x)); });
  check('A13: подписка, манифест и иконка подключены на всех страницах с меню', bad.length === 0, bad.length + ': ' + bad.slice(0, 6).join(' | '));
  const okManifest = ['ru', 'thai'].every(l => { try { const m = JSON.parse(read('manifest_' + l + '.webmanifest')); return m.icons.every(i => fs.existsSync(path.join(ROOT, i.src.slice(1)))) && fs.existsSync(path.join(ROOT, m.start_url === '/' ? 'index.html' : m.start_url.slice(1))); } catch (e) { return false; } });
  check('A13: манифесты ru/thai корректны, иконки и стартовые страницы существуют', okManifest);
  check('A13: service worker OneSignal в корне', fs.existsSync(path.join(ROOT, 'OneSignalSDKWorker.js')));
  const arts = files.filter(f => /^publications\/[^/]+\.html$/.test(f) && !/^publications\/(index|publications_)/.test(f) && !info[f].redirect);
  const noCta = arts.filter(f => !read(f).includes('data-push-cta'));
  check('A13: карточка подписки в конце каждой статьи', arts.length > 0 && noCta.length === 0, noCta.join(','));
}

console.log(failed ? 'ПРОВАЛЕНО: ' + failed + ', пройдено: ' + passed : 'ВСЕ ТЕСТЫ ПРОЙДЕНЫ: ' + passed);
process.exitCode = failed ? 1 : 0;
