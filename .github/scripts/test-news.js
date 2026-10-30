'use strict';
// Автотесты build-news.js (раздел «Что нового»): `node .github/scripts/test-news.js`.
// Каждый тест строит свежую временную папку с поддельным сайтом; реальные файлы репозитория не меняются.
// Интерфейс сборщика: build({ root, lang, date }) → { errors: [{code, msg}], digest: объект|null, firstRun: bool }.
// Сборщик создаёт сводку только для lang, но страницы /new/ и sitemap_news.xml пересобирает для обоих языков.
const fs = require('fs');
const os = require('os');
const path = require('path');

const REPO = path.resolve(__dirname, '../..');
const REAL_TPL = path.join(REPO, '_src/news/template');
const SITE = 'https://indapanno.github.io';

let mod = null, loadError = '';
try { mod = require('./build-news.js'); } catch (e) { loadError = e.message; }
const noop = () => { throw new Error('build-news.js не найден: ' + loadError); };
const build = mod && mod.build ? mod.build : noop;
const plural = mod && mod.plural ? mod.plural : noop;
const summaryLine = mod && mod.summaryLine ? mod.summaryLine : noop;
const formatDate = mod && mod.formatDate ? mod.formatDate : noop;

let passed = 0, failed = 0;
function check(name, cond, extra) {
  if (cond) passed++; else { failed++; console.error('ПРОВАЛ: ' + name + (extra ? ' — ' + extra : '')); }
}
const tryv = f => { try { return f(); } catch (e) { return 'ОШИБКА: ' + e.message; } };
const count = (s, sub) => s.split(sub).length - 1;

const TERM = {
  t1: { ru: 'Дуккха', thai: 'ทุกข์', iast: 'dukkha' },
  t2: { ru: 'Самудая', thai: 'สมุทัย', iast: 'samudaya' },
  t3: { ru: 'Ниродха', thai: 'นิโรธ', iast: 'nirodha' },
  t4: { ru: 'Магга', thai: 'มรรค', iast: 'magga' },
  t9: { ru: 'Удалённый', thai: 'ลบแล้ว', iast: 'deleted' }
};
const INTERP = {
  ru: 'Неудовлетворённость, присущая всему обусловленному. Второе предложение толкования, которое в сниппет не попадает целиком, потому что оно длинное и подробное.',
  thai: 'ความไม่น่าพอใจที่มีอยู่ในทุกสิ่งที่ปรุงแต่ง'
};

// spec = {
//   terms: { ru: [id…], thai: [id…] }            — термины с переводом (попадают в index_<язык>.json)
//   bundles: [{ n, lang, page: 'ok'|'stub'|null, terms: [id…] }]
//   pubs: [{ n, lang, html, page: true|false }]
//   state: { ru: объект|строка, thai: … }        — снимок (нет ключа — файла нет)
//   digests: { '2026-10-29_ru': объект|строка }
// }
function makeSite(spec) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'news-'));
  const mk = d => fs.mkdirSync(path.join(root, d), { recursive: true });
  const wr = (f, v) => { mk(path.dirname(f)); fs.writeFileSync(path.join(root, f), typeof v === 'string' ? v : JSON.stringify(v, null, 2)); };
  ['json', 'terms', 'bundle', 'publications/covers', '_src/bundle/json', '_src/publications/json', '_src/news/template'].forEach(mk);
  const terms = spec.terms || { ru: [], thai: [] };
  ['ru', 'thai'].forEach(l => {
    const ids = terms[l] || [];
    wr('json/index_' + l + '.json', { terms: ids.map(id => ({ id, ['term_' + l]: TERM[id][l], later_count: 0 })) });
    ids.forEach(id => {
      wr('json/' + id + '_' + l + '.json', { id, ['term_' + l]: TERM[id][l], term_iast: TERM[id].iast, interpretation: INTERP[l], reason_introduced: '' });
      wr('terms/' + id + '_' + l + '.html', '<html lang="' + (l === 'thai' ? 'th' : 'ru') + '"></html>');
    });
  });
  (spec.bundles || []).forEach(b => {
    wr('_src/bundle/json/bundle_' + b.n + '_' + b.lang + '.json',
      { name: (b.lang === 'thai' ? 'ชุดที่ ' : 'Связка ') + b.n, description: b.lang === 'thai' ? 'คำอธิบายชุดศัพท์' : 'Описание связки ' + b.n, terms: b.terms || ['t1', 't2', 't3'] });
    if (b.page === 'ok') wr('bundle/bundle_' + b.n + '_' + b.lang + '.html', '<html><head></head></html>');
    if (b.page === 'stub') wr('bundle/bundle_' + b.n + '_' + b.lang + '.html', '<html><head><meta name="robots" content="noindex"></head></html>');
  });
  (spec.pubs || []).forEach(p => {
    wr('_src/publications/json/publication_' + p.n + '_' + p.lang + '.json',
      { cover: 'c' + p.n + '.png', headline: (p.lang === 'thai' ? 'บทความ ' : 'Статья ') + p.n, lead: p.lang === 'thai' ? 'คำโปรย' : 'Лид статьи ' + p.n, html: p.html || 'a-' + p.n + '.html' });
    if (p.page !== false) wr('publications/' + (p.html || 'a-' + p.n + '.html'), '<html></html>');
  });
  Object.keys(spec.state || {}).forEach(l => wr('_src/news/state_' + l + '.json', spec.state[l]));
  Object.keys(spec.digests || {}).forEach(k => wr('_src/news/digests/' + k + '.json', spec.digests[k]));
  ['ru', 'thai'].forEach(l => {
    const src = path.join(REAL_TPL, '_layout_' + l + '.html');
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(root, '_src/news/template/_layout_' + l + '.html'));
  });
  return root;
}

function api(root) {
  const p = f => path.join(root, f);
  return {
    root,
    has: f => fs.existsSync(p(f)),
    read: f => (fs.existsSync(p(f)) ? fs.readFileSync(p(f), 'utf8') : ''), // нет файла → пустая строка: тест краснеет, а не падает
    json: f => { try { return JSON.parse(fs.readFileSync(p(f), 'utf8')); } catch (e) { return null; } },
    list: d => (fs.existsSync(p(d)) ? fs.readdirSync(p(d)).sort() : [])
  };
}

function run(root, lang, date) {
  let r;
  try { r = build({ root, lang, date }) || {}; } catch (e) { r = { errors: [{ code: -1, msg: e.message }], digest: null, crashed: e.message }; }
  r.errors = r.errors || [];
  r.codes = r.errors.map(e => e.code);
  return Object.assign(api(root), r);
}
const site = (spec, lang, date) => run(makeSite(spec), lang || 'ru', date || '2026-10-30');

const snap = (terms, bundles, pubs) => ({ terms: terms || [], bundles: bundles || [], publications: pubs || [] });
const has = (arr, x) => Array.isArray(arr) && arr.indexOf(x) >= 0;
const ids = (d, k, f) => (d && Array.isArray(d[k]) ? d[k].map(x => x[f]) : []);

// Снимок всех файлов сайта вне зоны сборщика (для проверки изоляции)
function filesOutside(root) {
  const out = {};
  (function walk(dir, rel) {
    fs.readdirSync(dir, { withFileTypes: true }).forEach(e => {
      const r = rel ? rel + '/' + e.name : e.name;
      if (e.isDirectory()) { if (r !== 'new' && r !== '_src/news') walk(path.join(dir, e.name), r); }
      else if (r !== 'sitemap_news.xml') out[r] = fs.readFileSync(path.join(dir, e.name), 'utf8');
    });
  })(root, '');
  return out;
}

check('build-news.js загружается и экспортирует build, plural, summaryLine, formatDate',
  !!(mod && mod.build && mod.plural && mod.summaryLine && mod.formatDate), loadError);
check('шаблоны раздела есть: _src/news/template/_layout_ru.html и _layout_thai.html',
  fs.existsSync(path.join(REAL_TPL, '_layout_ru.html')) && fs.existsSync(path.join(REAL_TPL, '_layout_thai.html')));

// 1. Первый запуск: снимок из текущего состава, без сводки
{
  const r = site({ terms: { ru: ['t1', 't2'], thai: ['t1'] }, bundles: [{ n: 1, lang: 'ru', page: 'ok' }], pubs: [{ n: 1, lang: 'ru' }] });
  const st = r.json('_src/news/state_ru.json');
  check('первый запуск: без ошибок', r.errors.length === 0, JSON.stringify(r.errors));
  check('первый запуск: firstRun = true, сводки нет', r.firstRun === true && !r.digest);
  check('первый запуск: снимок содержит всё текущее', !!st && has(st.terms, 't1') && has(st.terms, 't2') && has(st.bundles, 1) && has(st.publications, 1), JSON.stringify(st));
  check('первый запуск: файлов сводок нет', r.list('_src/news/digests').length === 0, r.list('_src/news/digests').join(','));
  check('первый запуск: снимок другого языка не создан', !r.has('_src/news/state_thai.json'));
  check('первый запуск: страницы списков созданы', r.has('new/index.html') && r.has('new/news_thai.html'));
}

// 2. Новый термин → сводка, снимок обновлён
{
  const r = site({ terms: { ru: ['t1', 't2'], thai: [] }, state: { ru: snap(['t1']) } });
  const d = r.json('_src/news/digests/2026-10-30_ru.json');
  const st = r.json('_src/news/state_ru.json');
  check('новый термин: без ошибок, не первый запуск', r.errors.length === 0 && r.firstRun === false, JSON.stringify(r.errors));
  check('новый термин: файл сводки создан', !!d);
  check('новый термин: в сводке только t2', ids(d, 'terms', 'id').join() === 't2', JSON.stringify(d && d.terms));
  check('новый термин: данные термина (название, IAST, ссылка)', !!d && d.terms[0].name === 'Самудая' && d.terms[0].iast === 'samudaya' && d.terms[0].url === '/terms/t2_ru.html', JSON.stringify(d && d.terms));
  check('новый термин: сниппет — начало толкования, одна строка, до 140 знаков',
    !!d && /^Неудовлетворённость/.test(d.terms[0].snippet) && d.terms[0].snippet.length <= 140 && !/[\n<]/.test(d.terms[0].snippet), d && d.terms[0].snippet);
  check('новый термин: дата, язык, отметка «не отправлено»', !!d && d.date === '2026-10-30' && d.lang === 'ru' && d.sent === false);
  check('новый термин: пустые блоки — пустые массивы', !!d && Array.isArray(d.publications) && d.publications.length === 0 && Array.isArray(d.bundles) && d.bundles.length === 0);
  check('новый термин: снимок дополнен', !!st && has(st.terms, 't1') && has(st.terms, 't2'));
  check('новый термин: build вернул ту же сводку', !!r.digest && ids(r.digest, 'terms', 'id').join() === 't2');
  check('новый термин: страница сводки создана', r.has('new/2026-10-30_ru.html'));
}

// 3. Нового нет → ни сводки, ни изменения снимка
{
  const root = makeSite({ terms: { ru: ['t1'], thai: [] }, state: { ru: snap(['t1']) } });
  const before = fs.readFileSync(path.join(root, '_src/news/state_ru.json'), 'utf8');
  const r = run(root, 'ru', '2026-10-30');
  check('нового нет: без ошибок, сводки нет', r.errors.length === 0 && !r.digest, JSON.stringify(r.errors));
  check('нового нет: файл сводки не создан', r.list('_src/news/digests').length === 0);
  check('нового нет: снимок не перезаписан (байт в байт)', r.read('_src/news/state_ru.json') === before);
}

// 4. Заглушки и тайский перевод старого термина
{
  const r = site({ terms: { ru: ['t1', 't3'], thai: ['t1'] }, state: { thai: snap([]) } }, 'thai');
  const d = r.json('_src/news/digests/2026-10-30_thai.json');
  check('тайский: перевод старого термина — новое для тайской сводки', ids(d, 'terms', 'id').join() === 't1', JSON.stringify(d && d.terms));
  check('тайский: термин без тайского перевода (заглушка) не попал', !has(ids(d, 'terms', 'id'), 't3'));
  check('тайский: название термина по-тайски', !!d && d.terms[0].name === 'ทุกข์');
  check('тайский: русская сводка не создана', !r.has('_src/news/digests/2026-10-30_ru.json'));
}
{
  const r = site({ terms: { ru: ['t1'], thai: ['t1'] }, state: { ru: snap(['t1']) } }, 'ru');
  check('русский: тайский перевод не делает термин новым для русской сводки', !r.digest && r.list('_src/news/digests').length === 0);
}

// 5. Связки и публикации: опубликованное — новое, неопубликованное — нет
{
  const r = site({
    terms: { ru: ['t1', 't2', 't3'], thai: [] },
    bundles: [{ n: 1, lang: 'ru', page: 'ok' }, { n: 2, lang: 'ru', page: 'ok' }, { n: 3, lang: 'ru', page: null }, { n: 4, lang: 'ru', page: 'stub' }, { n: 5, lang: 'thai', page: 'ok' }],
    pubs: [{ n: 1, lang: 'ru', html: 'renamed.html' }, { n: 2, lang: 'ru' }, { n: 3, lang: 'ru', page: false }, { n: 4, lang: 'thai' }],
    state: { ru: snap(['t1', 't2', 't3'], [1], [1]) }
  });
  const d = r.json('_src/news/digests/2026-10-30_ru.json');
  const st = r.json('_src/news/state_ru.json');
  check('связки: новая опубликованная связка попала', ids(d, 'bundles', 'n').join() === '2', JSON.stringify(d && d.bundles));
  check('связки: данные связки (название, описание, число терминов, ссылка)', !!d && d.bundles[0] && d.bundles[0].name === 'Связка 2'
    && d.bundles[0].description === 'Описание связки 2' && d.bundles[0].count === 3 && d.bundles[0].url === '/bundle/bundle_2_ru.html', JSON.stringify(d && d.bundles));
  check('связки: связка с ошибкой (страницы нет) и заглушка (noindex) не попали', !has(ids(d, 'bundles', 'n'), 3) && !has(ids(d, 'bundles', 'n'), 4));
  check('публикации: новая опубликованная статья попала', ids(d, 'publications', 'n').join() === '2', JSON.stringify(d && d.publications));
  check('публикации: данные статьи (заголовок, лид, обложка, ссылка)', !!d && d.publications[0] && d.publications[0].headline === 'Статья 2'
    && d.publications[0].lead === 'Лид статьи 2' && d.publications[0].cover === '/publications/covers/c2.png' && d.publications[0].url === '/publications/a-2.html', JSON.stringify(d && d.publications));
  check('публикации: статья без страницы не попала; переименованный файл статьи — не новое', !has(ids(d, 'publications', 'n'), 3) && !has(ids(d, 'publications', 'n'), 1));
  check('связки/публикации другого языка не попали', !has(ids(d, 'bundles', 'n'), 5) && !has(ids(d, 'publications', 'n'), 4));
  check('снимок: неопубликованное не записано (объявится, когда появится)', !!st && has(st.bundles, 2) && !has(st.bundles, 3) && !has(st.bundles, 4) && has(st.publications, 2) && !has(st.publications, 3));
}

// 6. Повторный запуск в тот же день: вторая сводка не создаётся, новое ждёт завтрашней
{
  const root = makeSite({ terms: { ru: ['t1', 't2'], thai: [] }, state: { ru: snap(['t1']) } });
  run(root, 'ru', '2026-10-30');
  const first = api(root).read('_src/news/digests/2026-10-30_ru.json');
  const tr = { id: 't3', term_ru: TERM.t3.ru, term_iast: TERM.t3.iast, interpretation: INTERP.ru };
  fs.writeFileSync(path.join(root, 'json/t3_ru.json'), JSON.stringify(tr));
  fs.writeFileSync(path.join(root, 'json/index_ru.json'), JSON.stringify({ terms: ['t1', 't2', 't3'].map(id => ({ id, term_ru: TERM[id].ru, later_count: 0 })) }));
  const r2 = run(root, 'ru', '2026-10-30');
  check('тот же день: без ошибок, новой сводки нет', r2.errors.length === 0 && !r2.digest, JSON.stringify(r2.errors));
  check('тот же день: файл сводки не изменён', first.length > 0 && r2.read('_src/news/digests/2026-10-30_ru.json') === first);
  check('тот же день: t3 не записан в снимок', !has((r2.json('_src/news/state_ru.json') || {}).terms, 't3'));
  const r3 = run(root, 'ru', '2026-10-31');
  check('следующий день: t3 объявлен', ids(r3.json('_src/news/digests/2026-10-31_ru.json'), 'terms', 'id').join() === 't3');
}

// 7. Снимок только растёт: удалённое из него не убирается
{
  const r = site({ terms: { ru: ['t1', 't2'], thai: [] }, state: { ru: snap(['t1', 't9']) } });
  const st = r.json('_src/news/state_ru.json');
  check('снимок: удалённый с сайта t9 остаётся в снимке', !!st && has(st.terms, 't9') && has(st.terms, 't2'));
  check('снимок: удалённое в сводку не попадает', !has(ids(r.json('_src/news/digests/2026-10-30_ru.json'), 'terms', 'id'), 't9'));
}

// 8. Страница сводки (ru)
const FULL_RU = {
  date: '2026-10-30', lang: 'ru', sent: false,
  publications: [{ n: 2, headline: 'Четыре благородные истины', lead: 'Лид статьи', cover: '/publications/covers/c2.png', url: '/publications/a-2.html' }],
  bundles: [{ n: 2, name: 'Пять преград', description: 'Описание связки', count: 5, url: '/bundle/bundle_2_ru.html' }],
  terms: [{ id: 't2', name: 'Самудая', iast: 'samudaya', snippet: 'Возникновение страдания.', url: '/terms/t2_ru.html' }]
};
const MENU_RU = ['/', '/bundle/', '/my/progress_ru.html', '/publications/', '/new/', '/how/how-to-add-term_ru.html'];
const MENU_TH = ['/nav/nav_thai.html', '/bundle/bundles_thai.html', '/my/progress_thai.html', '/publications/publications_thai.html', '/new/news_thai.html', '/how/how-to-add-term_thai.html'];
const menuOf = h => { const m = h.match(/<ul id="nav-menu-list" class="nav-menu-list">([\s\S]*?)<\/ul>/); return m ? [...m[1].matchAll(/<a href="([^"]*)">/g)].map(x => x[1]) : []; };
const switchOf = h => { const o = {}; [...h.matchAll(/<a data-lang-value="(ru|thai)" lang="(?:ru|th)"(?: href="([^"]*)")?>/g)].forEach(m => { o[m[1]] = m[2] || null; }); return o; };
{
  const r = site({ terms: { ru: ['t1'], thai: [] }, state: { ru: snap(['t1']) }, digests: { '2026-10-30_ru': FULL_RU } });
  const h = r.read('new/2026-10-30_ru.html');
  check('сводка: страница собрана из файла данных', h.length > 0);
  check('сводка: lang="ru", единственный h1 с датой', h.includes('<html lang="ru"') && count(h, '<h1') === 1 && h.includes('Что нового — 30 октября 2026'));
  check('сводка: title с датой', /<title>[^<]*Что нового — 30 октября 2026[^<]*<\/title>/.test(h));
  check('сводка: noindex, follow', h.includes('<meta name="robots" content="noindex, follow">'));
  check('сводка: canonical, description, Open Graph', h.includes('<link rel="canonical" href="' + SITE + '/new/2026-10-30_ru.html">')
    && /<meta name="description" content="[^"]+">/.test(h) && h.includes('<meta property="og:url" content="' + SITE + '/new/2026-10-30_ru.html">') && /<meta property="og:title" content="[^"]+">/.test(h));
  const iP = h.indexOf('<h2>Публикации</h2>'), iB = h.indexOf('<h2>Связанные термины</h2>'), iT = h.indexOf('<h2>Термины</h2>');
  check('сводка: блоки по порядку — публикации, связки, термины', iP > 0 && iB > iP && iT > iB, [iP, iB, iT].join());
  check('сводка: ссылки на статью, связку, термин — обычные <a href>', h.includes('href="/publications/a-2.html"') && h.includes('href="/bundle/bundle_2_ru.html"') && h.includes('href="/terms/t2_ru.html"'));
  check('сводка: плитка публикации (обложка, заголовок, лид)', h.includes('src="/publications/covers/c2.png"') && h.includes('Четыре благородные истины') && h.includes('Лид статьи'));
  check('сводка: связка (название, описание, «5 терминов»)', h.includes('Пять преград') && h.includes('Описание связки') && h.includes('5 терминов'));
  check('сводка: термин (название, IAST, сниппет)', h.includes('Самудая') && h.includes('samudaya') && h.includes('Возникновение страдания.'));
  check('сводка: меню из 6 пунктов, «Что нового» после «Публикаций»', menuOf(h).join() === MENU_RU.join(), menuOf(h).join());
  check('сводка: переключатель языка → список другого языка', switchOf(h).thai === '/new/news_thai.html' && switchOf(h).ru === '/new/2026-10-30_ru.html', JSON.stringify(switchOf(h)));
  check('сводка: крошки ведут в /new/', h.includes('<a href="/new/">Что нового</a>'));
  check('сводка: общие файлы по абсолютным путям', h.includes('href="/css/style.css"') && !h.includes('../'));
}
{
  const only = Object.assign({}, FULL_RU, { publications: [], bundles: [] });
  const r = site({ terms: { ru: ['t1'], thai: [] }, state: { ru: snap(['t1']) }, digests: { '2026-10-30_ru': only } });
  const h = r.read('new/2026-10-30_ru.html');
  check('сводка: пустые блоки не выводятся', h.includes('<h2>Термины</h2>') && !h.includes('<h2>Публикации</h2>') && !h.includes('<h2>Связанные термины</h2>'));
}

// 9. Страница сводки (thai)
{
  const dTh = { date: '2026-10-30', lang: 'thai', sent: false, publications: [], bundles: [],
    terms: [{ id: 't1', name: 'ทุกข์', iast: 'dukkha', snippet: 'ความไม่น่าพอใจ', url: '/terms/t1_thai.html' }] };
  const r = site({ terms: { ru: [], thai: ['t1'] }, state: { thai: snap(['t1']) }, digests: { '2026-10-30_thai': dTh } }, 'thai');
  const h = r.read('new/2026-10-30_thai.html');
  check('thai: lang="th", заголовок «มีอะไรใหม่» с тайской датой', h.includes('<html lang="th"') && h.includes('มีอะไรใหม่ — ๓๐ ตุลาคม ๒๕๖๙'));
  check('thai: noindex, follow; canonical', h.includes('<meta name="robots" content="noindex, follow">') && h.includes('<link rel="canonical" href="' + SITE + '/new/2026-10-30_thai.html">'));
  check('thai: меню из 6 пунктов', menuOf(h).join() === MENU_TH.join(), menuOf(h).join());
  check('thai: переключатель → /new/', switchOf(h).ru === '/new/' && switchOf(h).thai === '/new/2026-10-30_thai.html', JSON.stringify(switchOf(h)));
}

// 10. Список /new/: новые сверху, 10 на страницу, плитки
const digestOn = (date, n) => ({
  date, lang: 'ru', sent: true,
  publications: n === 1 ? [{ n: 1, headline: 'Статья А', lead: 'Л', cover: '/publications/covers/c1.png', url: '/publications/a-1.html' }] : [],
  bundles: n === 1 ? [{ n: 1, name: 'Связка Б', description: 'О', count: 3, url: '/bundle/bundle_1_ru.html' }] : [],
  terms: Array.from({ length: n === 1 ? 12 : 1 }, (_, i) => ({ id: 'x' + i, name: 'Термин ' + i, iast: 'x', snippet: 'с', url: '/terms/t1_ru.html' }))
});
{
  const digests = {};
  for (let i = 1; i <= 12; i++) { const d = '2026-10-' + String(i).padStart(2, '0'); digests[d + '_ru'] = digestOn(d, i); }
  const r = site({ terms: { ru: ['t1'], thai: [] }, state: { ru: snap(['t1']) }, digests });
  const p1 = r.read('new/index.html'), p2 = r.read('new/news_ru_2.html');
  check('список: страницы 1 и 2', p1.length > 0 && p2.length > 0 && !r.has('new/news_ru_3.html'));
  check('список: 10 плиток на первой, 2 на второй', count(p1, 'Читать далее') === 10 && count(p2, 'Читать далее') === 2, count(p1, 'Читать далее') + '/' + count(p2, 'Читать далее'));
  check('список: новые сверху', p1.indexOf('/new/2026-10-12_ru.html') > 0 && p1.indexOf('/new/2026-10-12_ru.html') < p1.indexOf('/new/2026-10-11_ru.html') && p2.includes('/new/2026-10-01_ru.html'));
  check('список: плитка — дата', p2.includes('1 октября 2026'));
  check('список: плитка — итог одной строкой', p2.includes('1 публикация, 1 связка, 12 терминов'));
  check('список: плитка — до 3 названий', p2.includes('Статья А') && p2.includes('Связка Б') && p2.includes('Термин 0') && !p2.includes('Термин 1<'));
  check('список: индексируется (без noindex), canonical', !p1.includes('noindex') && p1.includes('<link rel="canonical" href="' + SITE + '/new/">') && p2.includes('<link rel="canonical" href="' + SITE + '/new/news_ru_2.html">'));
  check('список: пагинация ссылкой', p1.includes('href="/new/news_ru_2.html"'));
  check('список: меню из 6 пунктов, переключатель → тайский список', menuOf(p1).join() === MENU_RU.join() && switchOf(p1).thai === '/new/news_thai.html' && switchOf(p2).thai === '/new/news_thai.html');
  check('список: h1 «Что нового»', /<h1[^>]*>Что нового<\/h1>/.test(p1));
  check('список: без ссылок на index.html', !/href="[^"]*index\.html"/.test(p1));
  const sm = r.read('sitemap_news.xml');
  check('sitemap_news.xml: страницы списка есть', sm.includes('<loc>' + SITE + '/new/</loc>') && sm.includes('<loc>' + SITE + '/new/news_ru_2.html</loc>'));
  check('sitemap_news.xml: сводок нет', !/\/new\/\d{4}-\d{2}-\d{2}_/.test(sm));
  check('sitemap_news.xml: пустой тайский список не включён', !sm.includes('news_thai.html'));
}

// 11. Пустой список
{
  const r = site({ terms: { ru: ['t1'], thai: [] }, state: { ru: snap(['t1']) } });
  const ru = r.read('new/index.html'), th = r.read('new/news_thai.html');
  check('пустой список: «Пока ничего нового» и noindex (ru)', ru.includes('Пока ничего нового') && ru.includes('noindex'));
  check('пустой список: тайский текст и noindex', th.includes('<html lang="th"') && th.includes('noindex') && !th.includes('Пока ничего нового'));
  check('пустой список: sitemap_news.xml есть, но без адресов', r.has('sitemap_news.xml') && !r.read('sitemap_news.xml').includes('<loc>'));
}

// 12. Сборка одного языка пересобирает страницы обоих
{
  const r = site({ terms: { ru: ['t1'], thai: ['t1'] }, state: { ru: snap(['t1']), thai: snap(['t1']) }, digests: { '2026-10-29_ru': digestOn('2026-10-29', 2) } }, 'thai');
  check('сборка thai: русский список и сводка собраны', r.read('new/index.html').includes('/new/2026-10-29_ru.html') && r.has('new/2026-10-29_ru.html'));
}

// 13. Склонения, итог, даты (функции)
check('plural: 1 термин / 2 термина / 5 терминов', tryv(() => [1, 2, 5].map(n => plural(n, ['термин', 'термина', 'терминов'])).join()) === 'термин,термина,терминов');
check('plural: 11, 12, 14 → «терминов»; 21 → «термин»; 22 → «термина»; 111 → «терминов»',
  tryv(() => [11, 12, 14, 21, 22, 111].map(n => plural(n, ['термин', 'термина', 'терминов'])).join()) === 'терминов,терминов,терминов,термин,термина,терминов');
check('summaryLine ru: порядок и склонения', tryv(() => summaryLine({ publications: [1, 2], bundles: [1, 2, 3, 4, 5], terms: [1] }, 'ru')) === '2 публикации, 5 связок, 1 термин');
check('summaryLine ru: пустые части пропускаются', tryv(() => summaryLine({ publications: [], bundles: [], terms: [1, 2, 3] }, 'ru')) === '3 термина');
check('summaryLine thai: тайские цифры', tryv(() => summaryLine({ publications: [1], bundles: [1, 2], terms: Array(12).fill(1) }, 'thai')) === 'บทความ ๑ เรื่อง, ชุดศัพท์ ๒ ชุด, คำศัพท์ ๑๒ คำ');
check('formatDate ru', tryv(() => formatDate('2026-03-01', 'ru')) === '1 марта 2026');
check('formatDate thai: тайские цифры, буддийская эра', tryv(() => formatDate('2026-10-30', 'thai')) === '๓๐ ตุลาคม ๒๕๖๙');

// 14. Ошибки
{
  const root = makeSite({ terms: { ru: ['t1', 't2'], thai: [] }, state: { ru: '{ сломано' } });
  const r = run(root, 'ru', '2026-10-30');
  check('ошибка 21: повреждённый снимок', r.codes.indexOf(21) >= 0, r.codes.join());
  check('ошибка 21: снимок не тронут, сводки нет', r.read('_src/news/state_ru.json') === '{ сломано' && r.list('_src/news/digests').length === 0 && !r.digest);
}
{
  const r = site({ terms: { ru: ['t1'], thai: [] }, state: { ru: snap(['t1']) }, digests: { '2026-10-28_ru': '{ сломано', '2026-10-29_ru': digestOn('2026-10-29', 2) } });
  check('ошибка 22: повреждённые данные сводки', r.codes.indexOf(22) >= 0, r.codes.join());
  check('ошибка 22: эта сводка пропущена, остальные страницы собраны', !r.has('new/2026-10-28_ru.html') && r.has('new/2026-10-29_ru.html') && r.read('new/index.html').includes('/new/2026-10-29_ru.html'));
}
{
  const root = makeSite({ terms: { ru: ['t1', 't2'], thai: [] }, state: { ru: snap(['t1']) } });
  const r = run(root, 'ru', '2026-13-40');
  check('ошибка 23: неверная дата', r.codes.indexOf(23) >= 0, r.codes.join());
  check('ошибка 23: ничего не записано', !r.has('new') && r.list('_src/news/digests').length === 0 && has(r.json('_src/news/state_ru.json').terms, 't1') && !has(r.json('_src/news/state_ru.json').terms, 't2'));
}
{
  const r = site({ terms: { ru: ['t1'], thai: [] }, state: { ru: snap(['t1']) } }, 'en');
  check('неизвестный язык — ошибка, без падения', r.errors.length > 0 && !r.crashed);
}

// 15. Изоляция: сборщик пишет только в new/, _src/news/ и sitemap_news.xml
{
  const root = makeSite({ terms: { ru: ['t1', 't2'], thai: ['t1'] }, bundles: [{ n: 1, lang: 'ru', page: 'ok' }], pubs: [{ n: 1, lang: 'ru' }], state: { ru: snap(['t1']) } });
  const before = filesOutside(root);
  const r = run(root, 'ru', '2026-10-30');
  const after = filesOutside(root);
  const diff = Object.keys(Object.assign({}, before, after)).filter(f => before[f] !== after[f]);
  check('изоляция: сборка прошла', !r.crashed && !!r.digest, r.crashed);
  check('изоляция: остальные файлы сайта не изменены', diff.length === 0, diff.join(','));
}

console.log(failed ? 'ПРОВАЛЕНО: ' + failed + ', пройдено: ' + passed : 'ВСЕ ТЕСТЫ ПРОЙДЕНЫ: ' + passed);
process.exitCode = failed ? 1 : 0;
