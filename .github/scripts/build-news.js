'use strict';
// Сборка раздела «Что нового» (ТЗ: push_TZ.md, раздел 3–4).
// 1) Сравнивает текущий состав сайта (термины, связки, публикации на языке lang) со «снимком
//    уже объявленного» _src/news/state_<lang>.json. Новое → данные сводки _src/news/digests/<дата>_<lang>.json.
//    Первый запуск (снимка нет) — только снимок, без сводки. Снимок только растёт.
// 2) Пересобирает все страницы new/*.html (оба языка) и sitemap_news.xml из данных сводок.
// Пишет только в new/, _src/news/ и sitemap_news.xml; остальные сборки и страницы не трогает.
// Ошибки (продолжают нумерацию публикаций): 21 — снимок повреждён; 22 — данные сводки повреждены;
// 23 — неверные параметры запуска (дата или язык).
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '../..');
const cfg = require('./site-config.js');
const { escapeHtml, capitalize } = require(path.join(REPO_ROOT, 'js/render-term.js'));
const { toThaiNumerals } = require(path.join(REPO_ROOT, 'js/thai-numerals.js'));

const LANGS = ['ru', 'thai'];
const PAGE_SIZE = 10; // как в навигаторе, у связок и публикаций
const SNIPPET_MAX = 130; // как в навигаторе
const DESC_CLIP = 220; // как у связок (3 строки обеспечивает line-clamp)
const TIMEZONE = { ru: 'Europe/Moscow', thai: 'Asia/Bangkok' };
const NAME_KEY = { ru: 'term_ru', thai: 'term_thai' };
const OG_LOCALE = { ru: 'ru_RU', thai: 'th_TH' };
const SITE_NAME = { ru: 'Навигатор по палийским терминам', thai: 'นำทางคำศัพท์บาลี' };
const DIGEST_FILE = /^(\d{4}-\d{2}-\d{2})_(ru|thai)\.json$/;

const MONTHS = {
  ru: ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'],
  thai: ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']
};

const S = {
  ru: {
    title: 'Что нового', nav: 'Навигатор по терминам',
    empty: 'Пока ничего нового.',
    desc: 'Что нового в «Навигаторе по палийским терминам»: новые публикации, связанные термины и термины по дням.',
    digestDesc: (date, sum) => 'Что нового ' + date + ': ' + sum + '.',
    blocks: { publications: 'Публикации', bundles: 'Связанные термины', terms: 'Термины' },
    more: 'Читать далее', back1: '← Назад', next1: 'Далее →', pages: 'Страницы', pageWord: 'страница', pageCap: 'Страница'
  },
  thai: {
    title: 'มีอะไรใหม่', nav: 'นำทางคำศัพท์',
    empty: 'ยังไม่มีอะไรใหม่',
    desc: 'มีอะไรใหม่ในนำทางคำศัพท์บาลี: บทความ ชุดศัพท์ที่เกี่ยวข้อง และคำศัพท์ใหม่ในแต่ละวัน',
    digestDesc: (date, sum) => 'มีอะไรใหม่ ' + date + ': ' + sum,
    blocks: { publications: 'บทความ', bundles: 'ชุดศัพท์ที่เกี่ยวข้อง', terms: 'คำศัพท์' },
    more: 'อ่านต่อ', back1: '← ย้อนกลับ', next1: 'ถัดไป →', pages: 'หน้า', pageWord: 'หน้า', pageCap: 'หน้า'
  }
};

// --- Текстовые помощники (экспортируются для тестов и будущей рассылки) ---
function plural(n, f) {
  const a = n % 10, b = n % 100;
  if (a === 1 && b !== 11) return f[0];
  if (a >= 2 && a <= 4 && (b < 10 || b >= 20)) return f[1];
  return f[2];
}
const digits = (lang, n) => (lang === 'thai' ? toThaiNumerals(n) : String(n));
const len = a => (Array.isArray(a) ? a.length : 0);

function summaryLine(d, lang) {
  const n = { p: len(d.publications), b: len(d.bundles), t: len(d.terms) };
  const parts = lang === 'thai'
    ? [n.p && 'บทความ ' + digits(lang, n.p) + ' เรื่อง', n.b && 'ชุดศัพท์ ' + digits(lang, n.b) + ' ชุด', n.t && 'คำศัพท์ ' + digits(lang, n.t) + ' คำ']
    : [n.p && n.p + ' ' + plural(n.p, ['публикация', 'публикации', 'публикаций']),
      n.b && n.b + ' ' + plural(n.b, ['связка', 'связки', 'связок']),
      n.t && n.t + ' ' + plural(n.t, ['термин', 'термина', 'терминов'])];
  return parts.filter(Boolean).join(', ');
}

function validDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function formatDate(s, lang) {
  const [y, m, d] = s.split('-').map(Number);
  if (lang === 'thai') return toThaiNumerals(d) + ' ' + MONTHS.thai[m - 1] + ' ' + toThaiNumerals(y + 543);
  return d + ' ' + MONTHS.ru[m - 1] + ' ' + y;
}

// Дата «сегодня» в поясе языка (ru — Москва, thai — Бангкок)
function todayIn(lang) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE[lang], year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

function clip(text, max, lang) {
  const t = String(text).replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  let cut;
  if (lang === 'thai' && typeof Intl !== 'undefined' && Intl.Segmenter) {
    cut = '';
    for (const seg of new Intl.Segmenter('th', { granularity: 'word' }).segment(t)) {
      if ((cut + seg.segment).length > max) break;
      cut += seg.segment;
    }
  } else cut = t.slice(0, max).replace(/\s+\S*$/, '');
  return cut.replace(/[\s,;:—-]+$/, '') + '…';
}

const readJson = f => JSON.parse(fs.readFileSync(f, 'utf8').replace(/^﻿/, ''));
const tryJson = f => { try { return readJson(f); } catch (e) { return null; } };

// --- Текущий состав сайта на языке lang (только опубликованное) ---
function loadSite(root, lang) {
  const terms = [];
  const index = tryJson(path.join(root, 'json', 'index_' + lang + '.json'));
  (index && Array.isArray(index.terms) ? index.terms : []).forEach(t => {
    if (!t || typeof t.id !== 'string') return;
    const d = tryJson(path.join(root, 'json', t.id + '_' + lang + '.json')) || {};
    const raw = d[NAME_KEY[lang]] || t[NAME_KEY[lang]] || t.id;
    const name = lang === 'ru' ? capitalize(String(raw).trim()) : String(raw).trim();
    const text = [d.interpretation, d.reason_introduced].filter(x => typeof x === 'string' && x.trim()).join(' ');
    terms.push({ id: t.id, name, iast: typeof d.term_iast === 'string' ? d.term_iast : '', snippet: text ? clip(lang === 'ru' ? capitalize(text) : text, SNIPPET_MAX, lang) : '', url: cfg.cardPath(t.id, lang) });
  });

  const bundles = [];
  const bDir = path.join(root, '_src/bundle/json');
  if (fs.existsSync(bDir)) {
    fs.readdirSync(bDir).forEach(f => {
      const m = f.match(/^bundle_([1-9]\d*)_(ru|thai)\.json$/);
      if (!m || m[2] !== lang) return;
      const n = Number(m[1]);
      const page = path.join(root, 'bundle', 'bundle_' + n + '_' + lang + '.html');
      if (!fs.existsSync(page) || /<meta\s+name="robots"\s+content="[^"]*noindex/.test(fs.readFileSync(page, 'utf8'))) return; // ошибка сборки или заглушка
      const d = tryJson(path.join(bDir, f));
      if (!d || typeof d.name !== 'string' || !Array.isArray(d.terms)) return;
      bundles.push({ n, name: d.name.trim(), description: typeof d.description === 'string' ? d.description.trim() : '', count: d.terms.length, url: cfg.bundlePath(n, lang) });
    });
  }
  bundles.sort((a, b) => a.n - b.n);

  const publications = [];
  const pDir = path.join(root, '_src/publications/json');
  if (fs.existsSync(pDir)) {
    fs.readdirSync(pDir).forEach(f => {
      const m = f.match(/^publication_([1-9]\d*)_(ru|thai)\.json$/);
      if (!m || m[2] !== lang) return;
      const d = tryJson(path.join(pDir, f));
      if (!d || typeof d.html !== 'string' || typeof d.headline !== 'string') return;
      if (!fs.existsSync(path.join(root, 'publications', d.html))) return; // статья не создана
      publications.push({ n: Number(m[1]), headline: d.headline.trim(), lead: typeof d.lead === 'string' ? d.lead.trim() : '', cover: cfg.coverPath(String(d.cover || '')), url: cfg.articlePath(d.html) });
    });
  }
  publications.sort((a, b) => a.n - b.n);
  return { terms, bundles, publications };
}

function validState(s) {
  return s && typeof s === 'object' && !Array.isArray(s) && ['terms', 'bundles', 'publications'].every(k => Array.isArray(s[k]));
}
const stateText = s => JSON.stringify({
  terms: Array.from(new Set(s.terms)).sort(),
  bundles: Array.from(new Set(s.bundles)).sort((a, b) => a - b),
  publications: Array.from(new Set(s.publications)).sort((a, b) => a - b)
}, null, 2) + '\n';

// --- Страницы ---
function fill(layout, v) {
  return layout.replace('{{TITLE}}', () => v.title).replace('{{HEAD}}', () => v.head).replace('{{H1}}', () => v.h1).replace('{{MAIN}}', () => v.main);
}

function crumbs(lang, items) {
  const all = [{ text: S[lang].nav, href: cfg.navHomePath(lang) }].concat(items);
  return '<nav class="breadcrumb">' + all.map((c, i) => (i ? '<span class="sep">/</span>' : '')
    + (c.href ? '<a href="' + c.href + '">' + escapeHtml(c.text) + '</a>' : '<span class="current">' + escapeHtml(c.text) + '</span>')).join('') + '</nav>\n  ';
}

function metaTags(lang, o) {
  const t = [];
  if (o.robots) t.push('<meta name="robots" content="' + o.robots + '">');
  t.push('<link rel="canonical" href="' + o.url + '">');
  (o.extra || []).forEach(x => t.push(x));
  t.push('<meta name="description" content="' + escapeHtml(o.desc) + '">');
  t.push('<meta property="og:type" content="website">');
  t.push('<meta property="og:site_name" content="' + escapeHtml(SITE_NAME[lang]) + '">');
  t.push('<meta property="og:title" content="' + escapeHtml(o.title) + '">');
  t.push('<meta property="og:description" content="' + escapeHtml(o.desc) + '">');
  t.push('<meta property="og:url" content="' + o.url + '">');
  t.push('<meta property="og:locale" content="' + OG_LOCALE[lang] + '">');
  return t.join('\n');
}

function pagination(lang, page, total) {
  if (total <= 1) return '';
  const st = S[lang];
  const parts = [];
  if (page > 1) parts.push('<a href="' + cfg.news.path(lang, page - 1) + '" class="page-link">' + st.back1 + '</a>');
  for (let p = 1; p <= total; p++) {
    parts.push(p === page ? '<span class="page-current">' + digits(lang, p) + '</span>'
      : '<a href="' + cfg.news.path(lang, p) + '" class="page-link">' + digits(lang, p) + '</a>');
  }
  if (page < total) parts.push('<a href="' + cfg.news.path(lang, page + 1) + '" class="page-link">' + st.next1 + '</a>');
  return '<nav class="pagination" aria-label="' + st.pages + '">' + parts.join('') + '</nav>';
}

function digestTitles(d) {
  const all = d.publications.map(x => x.headline).concat(d.bundles.map(x => x.name), d.terms.map(x => x.name));
  return escapeHtml(all.slice(0, 3).join(', ')) + (all.length > 3 ? '…' : '');
}

function listPages(lang, digests, layout) {
  const st = S[lang];
  const total = Math.max(1, Math.ceil(digests.length / PAGE_SIZE));
  const pages = [];
  for (let page = 1; page <= total; page++) {
    const slice = digests.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    let main;
    if (!digests.length) main = '<p class="news-empty">' + st.empty + '</p>';
    else {
      main = '<ul class="news-list">' + slice.map(d => '<li><a class="news-tile" href="' + cfg.newsDigestPath(d.date, lang) + '">'
        + '<span class="news-tile-date">' + formatDate(d.date, lang) + '</span>'
        + '<span class="news-tile-summary">' + escapeHtml(summaryLine(d, lang)) + '</span>'
        + '<span class="news-tile-titles">' + digestTitles(d) + '</span>'
        + '<span class="news-tile-more">' + st.more + '</span></a></li>').join('') + '</ul>' + pagination(lang, page, total);
    }
    main = crumbs(lang, [{ text: st.title }]) + main;
    const url = cfg.news.url(lang, page);
    const title = st.title + (page > 1 ? ' — ' + st.pageWord + ' ' + digits(lang, page) : '');
    let head;
    if (!digests.length) head = '<meta name="robots" content="noindex">';
    else {
      const extra = [];
      if (page > 1) extra.push('<link rel="prev" href="' + cfg.news.url(lang, page - 1) + '">');
      if (page < total) extra.push('<link rel="next" href="' + cfg.news.url(lang, page + 1) + '">');
      head = metaTags(lang, { url, extra, title, desc: st.desc + (page > 1 ? ' ' + st.pageCap + ' ' + digits(lang, page) + '.' : '') });
    }
    const html = cfg.withLangSwitch(fill(layout, { title: escapeHtml(title), head, h1: st.title, main }), cfg.news.path(lang, page), lang);
    pages.push({ file: cfg.news.file(lang, page), html, indexable: digests.length > 0, url });
  }
  return pages;
}

function digestPage(lang, d, layout) {
  const st = S[lang];
  const date = formatDate(d.date, lang);
  const h1 = st.title + ' — ' + date;
  const blocks = [];
  if (d.publications.length) {
    blocks.push('<section class="news-block"><h2>' + st.blocks.publications + '</h2><ul class="pub-list">'
      + d.publications.map(p => '<li><a class="pub-tile" href="' + escapeHtml(p.url) + '">'
        + '<span class="pub-tile-cover"><img src="' + escapeHtml(p.cover) + '" alt="" loading="lazy" width="1200" height="630"></span>'
        + '<span class="pub-tile-body"><span class="pub-tile-title">' + escapeHtml(p.headline) + '</span>'
        + '<span class="pub-tile-lead">' + escapeHtml(p.lead) + '</span>'
        + '<span class="pub-tile-more">' + st.more + '</span></span></a></li>').join('') + '</ul></section>');
  }
  if (d.bundles.length) {
    blocks.push('<section class="news-block"><h2>' + st.blocks.bundles + '</h2><ul class="term-list bundle-list">'
      + d.bundles.map(b => '<li><a href="' + escapeHtml(b.url) + '"><span class="bundle-name">' + escapeHtml(b.name) + '</span>'
        + (b.description ? '<span class="bundle-desc">' + escapeHtml(clip(b.description, DESC_CLIP, lang)) + '</span>' : '')
        + '<span class="bundle-meta">' + (lang === 'thai' ? 'จำนวน ' + toThaiNumerals(b.count) + ' คำ' : b.count + ' ' + plural(b.count, ['термин', 'термина', 'терминов'])) + '</span></a></li>').join('')
      + '</ul></section>');
  }
  if (d.terms.length) {
    blocks.push('<section class="news-block"><h2>' + st.blocks.terms + '</h2><ul class="term-list">'
      + d.terms.map(t => '<li class="term-item"><a href="' + escapeHtml(t.url) + '">' + escapeHtml(t.name)
        + (t.iast ? ' <span class="news-iast">' + escapeHtml(t.iast) + '</span>' : '')
        + (t.snippet ? '<div class="nav-snippet">' + escapeHtml(t.snippet) + '</div>' : '') + '</a></li>').join('') + '</ul></section>');
  }
  const main = crumbs(lang, [{ text: st.title, href: cfg.news.path(lang, 1) }, { text: date }]) + blocks.join('\n  ');
  const url = cfg.newsDigestUrl(d.date, lang);
  const head = metaTags(lang, { robots: 'noindex, follow', url, title: h1, desc: st.digestDesc(date, summaryLine(d, lang)) });
  return { file: cfg.newsDigestName(d.date, lang), html: cfg.withLangSwitch(fill(layout, { title: escapeHtml(h1), head, h1: escapeHtml(h1), main }), cfg.newsDigestPath(d.date, lang), lang) };
}

function validDigest(d, date, lang) {
  return d && typeof d === 'object' && d.date === date && d.lang === lang
    && ['publications', 'bundles', 'terms'].every(k => Array.isArray(d[k]) && d[k].every(x => x && typeof x === 'object' && typeof x.url === 'string'));
}

function buildPages(root, errors) {
  const digestDir = path.join(root, '_src/news/digests');
  const tplDir = path.join(root, '_src/news/template');
  const byLang = { ru: [], thai: [] };
  if (fs.existsSync(digestDir)) {
    fs.readdirSync(digestDir).sort().forEach(f => {
      const m = f.match(DIGEST_FILE);
      if (!m) return;
      const d = tryJson(path.join(digestDir, f));
      if (!validDigest(d, m[1], m[2]) || !validDate(m[1])) { errors.push({ code: 22, file: f, msg: 'данные сводки повреждены; сводка пропущена' }); return; }
      byLang[m[2]].push(d);
    });
  }
  LANGS.forEach(l => byLang[l].sort((a, b) => (a.date < b.date ? 1 : -1)));

  const outDir = path.join(root, cfg.news.dir);
  fs.mkdirSync(outDir, { recursive: true });
  fs.readdirSync(outDir, { withFileTypes: true }).filter(e => e.isFile() && e.name.endsWith('.html')).forEach(e => fs.unlinkSync(path.join(outDir, e.name)));
  const pages = [], sitemapUrls = [];
  LANGS.forEach(lang => {
    const layout = fs.readFileSync(path.join(tplDir, '_layout_' + lang + '.html'), 'utf8');
    listPages(lang, byLang[lang], layout).forEach(p => { pages.push(p); if (p.indexable) sitemapUrls.push(p.url); });
    byLang[lang].forEach(d => pages.push(digestPage(lang, d, layout)));
  });
  pages.forEach(p => fs.writeFileSync(path.join(outDir, p.file), p.html, 'utf8'));
  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    + sitemapUrls.map(u => '  <url>\n    <loc>' + u + '</loc>\n  </url>\n').join('') + '</urlset>\n';
  fs.writeFileSync(path.join(root, 'sitemap_news.xml'), xml, 'utf8');
  return { pages: pages.map(p => cfg.news.dir + '/' + p.file), digests: byLang, sitemapUrls };
}

// Определение нового и запись сводки/снимка для одного языка
function detect(root, lang, date, errors) {
  const newsDir = path.join(root, '_src/news');
  const stateFile = path.join(newsDir, 'state_' + lang + '.json');
  const digestFile = path.join(newsDir, 'digests', date + '_' + lang + '.json');
  const site = loadSite(root, lang);
  const current = { terms: site.terms.map(t => t.id), bundles: site.bundles.map(b => b.n), publications: site.publications.map(p => p.n) };

  if (!fs.existsSync(stateFile)) {
    fs.mkdirSync(newsDir, { recursive: true });
    fs.writeFileSync(stateFile, stateText(current), 'utf8');
    return { firstRun: true, digest: null };
  }
  let state;
  try { state = readJson(stateFile); } catch (e) { state = null; }
  if (!validState(state)) { errors.push({ code: 21, file: 'state_' + lang + '.json', msg: 'снимок повреждён; сводка не построена, снимок не изменён' }); return { firstRun: false, digest: null }; }
  if (date === null || fs.existsSync(digestFile)) return { firstRun: false, digest: null }; // сводка за этот день уже есть

  const known = { terms: new Set(state.terms), bundles: new Set(state.bundles), publications: new Set(state.publications) };
  const digest = {
    date, lang, sent: false,
    publications: site.publications.filter(p => !known.publications.has(p.n)),
    bundles: site.bundles.filter(b => !known.bundles.has(b.n)),
    terms: site.terms.filter(t => !known.terms.has(t.id))
  };
  if (!digest.publications.length && !digest.bundles.length && !digest.terms.length) return { firstRun: false, digest: null };

  fs.mkdirSync(path.dirname(digestFile), { recursive: true });
  fs.writeFileSync(digestFile, JSON.stringify(digest, null, 2) + '\n', 'utf8');
  fs.writeFileSync(stateFile, stateText({
    terms: state.terms.concat(digest.terms.map(t => t.id)),
    bundles: state.bundles.concat(digest.bundles.map(b => b.n)),
    publications: state.publications.concat(digest.publications.map(p => p.n))
  }), 'utf8');
  return { firstRun: false, digest };
}

// opts: { root, lang, date } — сводка за день для языка + страницы;
//       { root, pagesOnly: true } — только страницы (и снимки, если их ещё нет — первый запуск).
function build(opts) {
  const root = opts.root || REPO_ROOT;
  const errors = [];
  let firstRun = false, digest = null;
  if (opts.pagesOnly) {
    LANGS.forEach(l => { if (!fs.existsSync(path.join(root, '_src/news/state_' + l + '.json'))) detect(root, l, null, errors); });
  } else {
    if (!LANGS.includes(opts.lang)) { errors.push({ code: 23, msg: 'неизвестный язык «' + opts.lang + '» (ожидается ru или thai)' }); return { errors, firstRun, digest }; }
    if (!validDate(opts.date)) { errors.push({ code: 23, msg: 'неверная дата «' + opts.date + '» (ожидается ГГГГ-ММ-ДД)' }); return { errors, firstRun, digest }; }
    const r = detect(root, opts.lang, opts.date, errors);
    firstRun = r.firstRun; digest = r.digest;
  }
  const p = buildPages(root, errors);
  return { errors, firstRun, digest, pages: p.pages, sitemapUrls: p.sitemapUrls, counts: { ru: p.digests.ru.length, thai: p.digests.thai.length } };
}

module.exports = { build, plural, summaryLine, formatDate, validDate, todayIn };

// Запуск: NEWS_LANG=ru|thai|pages [NEWS_DATE=ГГГГ-ММ-ДД] node .github/scripts/build-news.js
// Без NEWS_DATE дата — сегодня в поясе языка (ru — Москва, thai — Бангкок).
if (require.main === module) {
  const lang = process.env.NEWS_LANG || 'pages';
  const r = lang === 'pages' ? build({ pagesOnly: true }) : build({ lang, date: process.env.NEWS_DATE || (LANGS.includes(lang) ? todayIn(lang) : '') });
  if (r.firstRun) console.log('Первый запуск: снимок создан, сводки нет.');
  if (r.digest) console.log('Сводка ' + r.digest.date + '_' + r.digest.lang + ': ' + summaryLine(r.digest, 'ru'));
  else if (lang !== 'pages' && !r.firstRun && !r.errors.length) console.log('Нового нет (или сводка за этот день уже есть).');
  if (r.counts) console.log('Сводок: ru=' + r.counts.ru + ', thai=' + r.counts.thai + '; страниц: ' + r.pages.length + '; адресов в sitemap: ' + r.sitemapUrls.length);
  r.errors.forEach(e => {
    console.error('ОШИБКА [' + e.code + ']' + (e.file ? ' ' + e.file : '') + ': ' + e.msg);
    if (process.env.GITHUB_ACTIONS) console.log('::error title=Что нового [' + e.code + ']::' + (e.file ? e.file + ': ' : '') + e.msg);
  });
  if (r.errors.length) process.exitCode = 1;
}
