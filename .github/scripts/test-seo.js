'use strict';
// SEO-проверки собранного сайта: `node .github/scripts/test-seo.js`.
// A5 (canonical), A6 (hreflang), A7 (sitemap), A8 (robots.txt). Корень — репозиторий или SITE_ROOT.
const fs = require('fs');
const path = require('path');

const ROOT = process.env.SITE_ROOT || path.resolve(__dirname, '../..');
const SITE = 'https://indapanno.github.io';
const SKIP_TOP = new Set(['_src', '.github', 'docs', 'help', '.git', 'node_modules']);

let passed = 0, failed = 0;
function check(name, cond, extra) {
  if (cond) passed++; else { failed++; console.error('ПРОВАЛ: ' + name + (extra ? ' — ' + extra : '')); }
}

function walk(dir, rel, out) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach(e => {
    const r = rel ? rel + '/' + e.name : e.name;
    if (e.isDirectory()) { if (!(rel === '' && SKIP_TOP.has(e.name))) walk(path.join(dir, e.name), r, out); }
    else if (r.endsWith('.html') && r !== 'yandex_9adf84726f5490a0.html') out.push(r);
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
// Прежние страницы списка в корне: заглушки на новые адреса в nav/ (ru стр. 1 — на «/»)
{
  const legacy = [];
  ['ru', 'thai'].forEach(l => { for (let p = 1; p <= 5; p++) legacy.push(['nav_' + l + (p > 1 ? '_' + p : '') + '.html', l, p]); });
  const badLegacy = legacy.filter(([f, l, p]) => {
    const i = info[f];
    const want = l === 'ru' && p === 1 ? SITE + '/' : SITE + '/nav/nav_' + l + (p > 1 ? '_' + p : '') + '.html';
    return !i || !i.redirect || i.canon[0] !== want;
  });
  check('заглушки прежних страниц списка в корне (10 шт.) ведут на новые адреса', badLegacy.length === 0, badLegacy.map(x => x[0]).join(','));
  const badHow = [];
  ['how-to-add-term', 'how-to-check-json', 'how-to-translate-term'].forEach(p => ['ru', 'thai'].forEach(l => {
    const root = p + '_' + l + '.html', want = SITE + '/how/' + root;
    if (!info[root] || !info[root].redirect || info[root].canon[0] !== want) badHow.push(root);
    if (!info['how/' + root] || info['how/' + root].redirect || info['how/' + root].canon[0] !== want) badHow.push('how/' + root);
  }));
  check('инструкции: 6 страниц в how/ (canonical = свой адрес) и 6 заглушек в корне на них', badHow.length === 0, badHow.join(','));
  check('how/index.html — заглушка на «/»', info['how/index.html'] && info['how/index.html'].redirect && info['how/index.html'].canon[0] === SITE + '/');
  check('в корне нет других nav_*.html, кроме заглушек', files.filter(f => /^nav_/.test(f)).every(f => info[f].redirect));
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
['sitemap.xml', 'sitemap_publications.xml'].forEach(sm => {
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
    if (/\/index\.html$/.test(u) || /^https:\/\/indapanno\.github\.io\/(how\/|how-to-|progress_)/.test(u)) problems.push('лишний адрес ' + u);
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
  check('A8: robots.txt: Allow: / и обе строки Sitemap', ok && /^Allow: \/\s*$/m.test(t) && t.includes('Sitemap: ' + SITE + '/sitemap.xml') && t.includes('Sitemap: ' + SITE + '/sitemap_publications.xml'));
}

console.log(failed ? 'ПРОВАЛЕНО: ' + failed + ', пройдено: ' + passed : 'ВСЕ ТЕСТЫ ПРОЙДЕНЫ: ' + passed);
process.exitCode = failed ? 1 : 0;
