'use strict';
// Сборка страниц «Связанные термины» (ТЗ: bundles_TZ.md).
// Независим от build-terms.js: только ЧИТАЕТ термины из json/,
// пишет только в bundle/ и sitemap_bundles.xml (корень сайта). Исходники связок: _src/bundle/json, шаблоны: _src/bundle/template.
// Ошибочная связка не публикуется;
// остальные собираются, в конце процесс завершается с кодом 1.
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '../..');
const cfg = require('./site-config.js');
const { escapeHtml, capitalize } = require(path.join(REPO_ROOT, 'js/render-term.js'));
const { toThaiNumerals } = require(path.join(REPO_ROOT, 'js/thai-numerals.js'));

const LANGS = ['ru', 'thai'];
const PAGE_SIZE = 10; // как PAGE_SIZE в build-terms.js (размер страницы навигатора)
const GH_JSON = 'https://github.com/indapanno/indapanno.github.io/%s/main/_src/bundle/json/';
const NAME_KEY = { ru: 'term_ru', thai: 'term_thai' };
const ALPHABET = { ru: /[А-Яа-яЁё]/, thai: /[\u0E00-\u0E7F]/ };
const BUNDLE_KEYS = ['name', 'description', 'terms'];
// SEO: как у навигатора и публикаций
const SITE_NAME = { ru: 'Навигатор по палийским терминам', thai: 'นำทางคำศัพท์บาลี' };
const OG_LOCALE = { ru: 'ru_RU', thai: 'th_TH' };
const HREFLANG = { ru: 'ru', thai: 'th' }; // код тайского в hreflang — «th»
const META_DESC_MAX = { ru: 155, thai: 120 };

function ruPlural(n, f) {
  const a = n % 10, b = n % 100;
  if (a === 1 && b !== 11) return f[0];
  if (a >= 2 && a <= 4 && (b < 10 || b >= 20)) return f[1];
  return f[2];
}

const S = {
  ru: {
    title: 'Связанные термины',
    intro: 'Связанные термины — это темы, в которых несколько терминов лучше изучать вместе. Выберите тему, чтобы пройти термины по порядку.',
    empty: 'Связанные термины пока не добавлены.',
    nav: 'Навигатор по терминам', stubTitle: 'Перевод отсутствует',
    back1: '← Назад', next1: 'Далее →', pages: 'Страницы', pageWord: 'страница',
    notLearned: 'Не изучен',
    count: n => n + ' ' + ruPlural(n, ['термин', 'термина', 'терминов']),
    more: n => 'и ещё ' + n + ' ' + ruPlural(n, ['термин', 'термина', 'терминов'])
  },
  thai: {
    title: 'ชุดศัพท์ที่เกี่ยวข้อง',
    intro: 'ชุดศัพท์ที่เกี่ยวข้องคือหัวข้อที่รวมคำศัพท์หลายคำซึ่งควรเรียนไปพร้อมกัน เลือกหัวข้อเพื่อเรียนคำศัพท์ตามลำดับ',
    empty: 'ยังไม่มีชุดศัพท์ที่เกี่ยวข้อง',
    nav: 'นำทางคำศัพท์', stubTitle: 'ยังไม่มีคำแปล',
    back1: '← ย้อนกลับ', next1: 'ถัดไป →', pages: 'หน้า', pageWord: 'หน้า',
    notLearned: 'ยังไม่ได้เรียน',
    count: n => 'จำนวน ' + toThaiNumerals(n) + ' คำ',
    more: n => 'และอีก ' + toThaiNumerals(n) + ' คำ'
  }
};

// --- Данные обычных терминов (только чтение) ---
function loadTerms(termsDir) {
  const out = { ru: new Map(), thai: new Map() };
  const dir = path.join(termsDir, 'json');
  LANGS.forEach(lang => {
    const suffix = '_' + lang + '.json';
    fs.readdirSync(dir).filter(f => f.endsWith(suffix) && !f.startsWith('index')).forEach(f => {
      out[lang].set(f.slice(0, -suffix.length), JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
    });
  });
  return out;
}

// --- Проверка одного файла связки (ошибки №2–10, 12) ---
function validateFile(file, lang, text, terms, allIds) {
  const errors = [];
  const err = (code, msg) => errors.push({ code, file, msg });
  let data;
  try { data = JSON.parse(text.replace(/^\uFEFF/, '')); } catch (e) { err(2, 'невалидный JSON: ' + e.message); return { errors, data: null }; }
  if (!data || typeof data !== 'object' || Array.isArray(data)) { err(2, 'корень JSON должен быть объектом'); return { errors, data: null }; }
  BUNDLE_KEYS.forEach(k => { if (!(k in data)) err(3, 'отсутствует ключ «' + k + '»'); });
  Object.keys(data).forEach(k => { if (!BUNDLE_KEYS.includes(k)) err(4, 'лишний ключ «' + k + '»'); });
  ['name', 'description'].forEach(k => {
    if (!(k in data)) return;
    if (typeof data[k] !== 'string' || !data[k].trim()) err(5, '«' + k + '» должно быть непустой строкой');
    else if (!ALPHABET[lang].test(data[k])) err(12, 'текст «' + k + '» не на языке файла (' + lang + ')');
  });
  if ('terms' in data) {
    const t = data.terms;
    if (!Array.isArray(t) || t.some(x => typeof x !== 'string' || !x.trim())) err(6, '«terms» должно быть массивом непустых строк');
    else {
      if (t.length < 2) err(7, 'в «terms» меньше 2 терминов (найдено: ' + t.length + ')');
      const seen = new Set();
      t.forEach(id => {
        if (seen.has(id)) err(8, 'повтор ID «' + id + '»');
        seen.add(id);
        if (!allIds.has(id)) err(9, 'ID «' + id + '» не существует в системе');
        else if (!terms[lang].has(id)) err(10, 'термин «' + id + '» не переведён на язык связки (' + lang + ')');
      });
    }
  }
  return { errors, data: errors.length ? null : data };
}

// --- HTML ---
const NOINDEX = '<meta name="robots" content="noindex">';

function fill(layout, v) {
  const rep = { '{{TITLE}}': v.title, '{{HEAD}}': v.head || NOINDEX, '{{H1}}': v.h1, '{{INTRO}}': v.intro, '{{MAIN}}': v.main };
  let s = layout;
  Object.keys(rep).forEach(k => { s = s.split(k).join(rep[k]); });
  return s;
}

// Обрезка description по границе слова (тайский — по словам через Intl.Segmenter)
function clipMeta(text, max, lang) {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  if (lang === 'thai' && typeof Intl !== 'undefined' && Intl.Segmenter) {
    let acc = '';
    for (const seg of new Intl.Segmenter('th', { granularity: 'word' }).segment(t)) {
      if ((acc + seg.segment).length > max) break;
      acc += seg.segment;
    }
    return acc.trim() + '…';
  }
  return t.slice(0, max).replace(/\s+\S*$/, '') + '…';
}

// SEO-теги страницы: canonical, prev/next, hreflang (alt: [{lang, url}] — только при двух языках), description, Open Graph
function seoHead(lang, o) {
  const t = ['<link rel="canonical" href="' + o.url + '">'];
  if (o.prev) t.push('<link rel="prev" href="' + o.prev + '">');
  if (o.next) t.push('<link rel="next" href="' + o.next + '">');
  if (o.alt && o.alt.length > 1) {
    o.alt.forEach(a => t.push('<link rel="alternate" hreflang="' + HREFLANG[a.lang] + '" href="' + a.url + '">'));
    t.push('<link rel="alternate" hreflang="x-default" href="' + o.alt[0].url + '">');
  }
  t.push('<meta name="description" content="' + escapeHtml(o.desc) + '">');
  t.push('<meta property="og:type" content="website">');
  t.push('<meta property="og:site_name" content="' + escapeHtml(SITE_NAME[lang]) + '">');
  t.push('<meta property="og:title" content="' + escapeHtml(o.title) + '">');
  t.push('<meta property="og:description" content="' + escapeHtml(o.desc) + '">');
  t.push('<meta property="og:url" content="' + o.url + '">');
  t.push('<meta property="og:locale" content="' + OG_LOCALE[lang] + '">');
  return t.join('\n');
}

// Хлебные крошки как на других страницах: ссылки + последний элемент без ссылки
function crumbs(lang, items) {
  const all = [{ text: S[lang].nav, href: cfg.navHomePath(lang) }].concat(items);
  return '<nav class="breadcrumb">' + all.map((c, i) => (i ? '<span class="sep">/</span>' : '')
    + (c.href ? '<a href="' + c.href + '">' + escapeHtml(c.text) + '</a>' : '<span class="current">' + escapeHtml(c.text) + '</span>')).join('') + '</nav>\n  ';
}


// pathOf(p) — путь от корня сайта для страницы номер p
function pagination(lang, pathOf, page, total) {
  if (total <= 1) return '';
  const st = S[lang];
  const digits = n => (lang === 'thai' ? toThaiNumerals(n) : String(n));
  const parts = [];
  if (page > 1) parts.push('<a href="' + pathOf(page - 1) + '" class="page-link">' + st.back1 + '</a>');
  for (let p = 1; p <= total; p++) {
    parts.push(p === page ? '<span class="page-current">' + digits(p) + '</span>'
      : '<a href="' + pathOf(p) + '" class="page-link">' + digits(p) + '</a>');
  }
  if (page < total) parts.push('<a href="' + pathOf(page + 1) + '" class="page-link">' + st.next1 + '</a>');
  return '<nav class="pagination" aria-label="' + st.pages + '">' + parts.join('') + '</nav>';
}

// Обрезка до N символов по границе слова, в конце «…» (принцип buildSnippet в build-terms.js)
function clip(text, max) {
  return text.length > max ? text.slice(0, max).replace(/\s+\S*$/, '') + '…' : text;
}

// Сниппет термина в списке: 130 символов, как в навигаторе
function snippet(data) {
  const text = [data.interpretation, data.reason_introduced].filter(Boolean).join(' ');
  return text ? clip(capitalize(text), 130) : '';
}

// Описание в плитке связки: щедрый предел (вмещается в 3 строки на широком экране);
// точные 3 строки на любой ширине гарантирует line-clamp в bundle.css
const DESC_CLIP = 220;

function termName(terms, lang, id) { return capitalize(terms[lang].get(id)[NAME_KEY[lang]] || id); }

function pageSuffix(lang, page) {
  return page > 1 ? ' — ' + S[lang].pageWord + ' ' + (lang === 'thai' ? toThaiNumerals(page) : page) : '';
}

// listLangs — языки, на которых список связок не пуст (для hreflang)
function listPages(lang, items, terms, layout, listLangs) {
  const st = S[lang];
  const total = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const pages = [];
  for (let page = 1; page <= total; page++) {
    const slice = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    let main;
    if (!items.length) main = '<p class="bundle-empty">' + st.empty + '</p>';
    else {
      const li = slice.map(b => {
        const names = b.data.terms.map(id => escapeHtml(termName(terms, lang, id)));
        const shown = names.slice(0, 5).join(', ') + (names.length > 5 ? ' ' + st.more(names.length - 5) : '');
        return '<li><a href="' + cfg.bundlePath(b.n, lang, 1) + '"><span class="bundle-name">' + escapeHtml(b.data.name) + '</span>'
          + '<span class="bundle-desc">' + escapeHtml(clip(b.data.description, DESC_CLIP)) + '</span>'
          + '<span class="bundle-meta">' + st.count(names.length) + '</span>'
          + '<span class="bundle-terms">' + shown + '</span></a></li>';
      }).join('');
      main = '<ul class="term-list bundle-list">' + li + '</ul>' + pagination(lang, p => cfg.bundles.path(lang, p), page, total);
    }
    main = crumbs(lang, [{ text: st.title }]) + main;
    const title = st.title + pageSuffix(lang, page);
    const url = cfg.bundles.url(lang, page);
    const head = !items.length ? NOINDEX : seoHead(lang, {
      url, title, desc: clipMeta(st.intro + pageSuffix(lang, page), META_DESC_MAX[lang], lang),
      prev: page > 1 ? cfg.bundles.url(lang, page - 1) : null, next: page < total ? cfg.bundles.url(lang, page + 1) : null,
      alt: page === 1 ? listLangs.map(l => ({ lang: l, url: cfg.bundles.url(l, 1) })) : null
    });
    pages.push({ file: cfg.bundles.file(lang, page), path: cfg.bundles.path(lang, page), url, indexable: items.length > 0, lang,
      alts: page === 1 && items.length ? listLangs.map(l => ({ lang: l, url: cfg.bundles.url(l, 1) })) : [],
      html: fill(layout, { title: escapeHtml(title), head, h1: st.title, intro: st.intro, main }) });
  }
  return pages;
}

// langs — языки, на которых опубликована эта связка (для hreflang)
function bundlePages(lang, b, terms, layout, langs) {
  const st = S[lang];
  const ids = b.data.terms;
  const total = Math.max(1, Math.ceil(ids.length / PAGE_SIZE));
    const pages = [];
  for (let page = 1; page <= total; page++) {
    const li = ids.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map(id => {
      const d = terms[lang].get(id);
      const later = (d.later_mentions || []).length;
      const badge = later > 0 ? ' <span class="count-badge">+' + (lang === 'thai' ? toThaiNumerals(later) : later) + '</span>' : '';
      const sn = snippet(d);
      return '<li class="term-item"><a href="' + cfg.cardPath(id, lang) + '">' + escapeHtml(termName(terms, lang, id)) + badge
        + (sn ? '<div class="nav-snippet">' + escapeHtml(sn) + '</div>' : '') + '</a>'
        + '<button type="button" class="learned-btn" data-learned-id="' + escapeHtml(id) + '">' + st.notLearned + '</button></li>';
    }).join('');
    const main = crumbs(lang, [{ text: st.title, href: cfg.bundles.path(lang, 1) }, { text: b.data.name }])
      + '<p class="nav-intro" id="learned-nav-note"></p>\n  '
      + '<ul id="term-list" class="term-list">' + li + '</ul>' + pagination(lang, p => cfg.bundlePath(b.n, lang, p), page, total);
    const title = b.data.name + pageSuffix(lang, page);
    const url = cfg.bundleUrl(b.n, lang, page);
    const alts = page === 1 && langs.length > 1 ? langs.map(l => ({ lang: l, url: cfg.bundleUrl(b.n, l, 1) })) : [];
    const head = seoHead(lang, {
      url, title, desc: clipMeta(b.data.description, META_DESC_MAX[lang], lang),
      prev: page > 1 ? cfg.bundleUrl(b.n, lang, page - 1) : null, next: page < total ? cfg.bundleUrl(b.n, lang, page + 1) : null, alt: alts
    });
    pages.push({ file: cfg.bundlePath(b.n, lang, page).split('/').pop(), path: cfg.bundlePath(b.n, lang, page), url, indexable: true, lang, alts,
      html: fill(layout, { title: escapeHtml(title), head, h1: escapeHtml(b.data.name), intro: escapeHtml(b.data.description), main }) });
  }
  return pages;
}

// Заглушка: страницы нет на языке target, есть на другом языке
function stubPage(target, n, layout) {
  const src = target === 'ru' ? 'thai' : 'ru';
  const srcFile = 'bundle_' + n + '_' + src + '.json', dstFile = 'bundle_' + n + '_' + target + '.json';
  const dirHref = GH_JSON.replace('%s', 'tree');
  const fileUrl = '<a href="' + GH_JSON.replace('%s', 'blob') + srcFile + '">' + srcFile + '</a>';
  const dirUrl = '<a href="' + dirHref + '">' + dirHref + '</a>';
  let lead, steps;
  if (target === 'ru') {
    const cmd = 'Переведи на русский язык значения ключей name и description этого JSON-файла. Значения массива terms не переводи и не меняй. '
      + 'Результат отдай в блоке для кода. Нужен такой же JSON-файл, только на русском языке. Ничего не добавляй и не убирай.';
    lead = 'В настоящий момент отсутствует перевод страницы связанных терминов на русский язык. Вы можете перевести её без специальных знаний за 5 минут с помощью бесплатного ИИ. Следуйте инструкции ниже.';
    steps = ['Откройте JSON-файл этой страницы: ' + fileUrl + '.',
      'Отправьте его в любой бесплатный ИИ с текстом:<span class="bundle-code">' + escapeHtml(cmd) + '</span>',
      'Скопируйте результат.', 'Откройте папку ' + dirUrl + '.', 'Нажмите «Add file» → «Create new file».', 'Вставьте перевод.',
      'Назовите файл <code>' + dstFile + '</code>.', 'Отправьте Pull request.',
      'Дождитесь проверки администратором. После одобрения связанные термины появятся на сайте.'];
  } else {
    const cmd = 'แปลค่าของคีย์ name และ description ในไฟล์ JSON นี้เป็นภาษาไทย ห้ามแปลหรือเปลี่ยนค่าในอาร์เรย์ terms '
      + 'ส่งผลลัพธ์เป็นบล็อกโค้ด ต้องการไฟล์ JSON เหมือนเดิมแต่เป็นภาษาไทย ห้ามเพิ่มหรือลบสิ่งใด';
    lead = 'ขณะนี้ยังไม่มีหน้าชุดศัพท์ที่เกี่ยวข้องฉบับภาษาไทย คุณสามารถแปลเองได้ภายใน 5 นาทีด้วย AI ฟรี โดยไม่ต้องมีความรู้พิเศษ ทำตามขั้นตอนด้านล่าง';
    steps = ['เปิดไฟล์ JSON ของหน้านี้: ' + fileUrl,
      'ส่งไปยัง AI ฟรีตัวใดก็ได้ พร้อมข้อความ:<span class="bundle-code">' + escapeHtml(cmd) + '</span>',
      'คัดลอกผลลัพธ์', 'เปิดโฟลเดอร์ ' + dirUrl, 'กดปุ่ม “Add file” → “Create new file”', 'วางคำแปล',
      'ตั้งชื่อไฟล์ว่า <code>' + dstFile + '</code>', 'ส่ง Pull request',
      'รอผู้ดูแลตรวจสอบ เมื่อได้รับอนุมัติ ชุดศัพท์ที่เกี่ยวข้องจะปรากฏบนเว็บไซต์'];
  }
  // Вёрстка как на how-to-add-term: карточка term-card с h2, абзацем и нумерованным списком
  const st = S[target];
  const main = crumbs(target, [{ text: st.title, href: cfg.bundles.path(target, 1) }, { text: st.stubTitle }])
    + '<div class="term-card bundle-stub"><h2>' + st.stubTitle + '</h2><p class="field-text">' + lead + '</p><ol>'
    + steps.map(x => '<li>' + x + '</li>').join('') + '</ol></div>';
  return { file: cfg.bundlePath(n, target, 1).split('/').pop(), path: cfg.bundlePath(n, target, 1), lang: target, indexable: false,
    html: fill(layout, { title: escapeHtml(S[target].title), head: NOINDEX, h1: S[target].title, intro: '', main }) };
}

// --- Основная сборка ---
function build(opts) {
  // termsDir — корень сайта (в нём json/ с терминами); bundleDir — куда писать страницы (bundle/);
  // srcDir — исходники связок (_src/bundle: json/ и template/).
  const termsDir = opts.termsDir, bundleDir = opts.bundleDir;
  const srcDir = opts.srcDir || path.join(termsDir, '_src/bundle');
  const jsonDir = path.join(srcDir, 'json'), htmlDir = bundleDir, tplDir = path.join(srcDir, 'template');
  const errors = [];
  const terms = loadTerms(termsDir);
  const allIds = new Set([...terms.ru.keys(), ...terms.thai.keys()]);
  const layouts = {};
  LANGS.forEach(l => { layouts[l] = fs.readFileSync(path.join(tplDir, '_layout_' + l + '.html'), 'utf8'); });

  const bundles = {};
  if (fs.existsSync(jsonDir)) {
    fs.readdirSync(jsonDir).filter(f => !f.startsWith('.')).sort().forEach(f => {
      const m = f.match(/^bundle_([1-9]\d*)_(ru|thai)\.json$/);
      if (!m) { errors.push({ code: 1, file: f, msg: 'имя файла не соответствует bundle_<число>_<ru|thai>.json' }); return; }
      const res = validateFile(f, m[2], fs.readFileSync(path.join(jsonDir, f), 'utf8'), terms, allIds);
      errors.push(...res.errors);
      (bundles[m[1]] = bundles[m[1]] || {})[m[2]] = res;
    });
  }

  const published = { ru: [], thai: [] }, stubs = [];
  Object.keys(bundles).sort((a, b) => a - b).forEach(n => {
    const b = bundles[n], ru = b.ru, th = b.thai;
    const pub = (lang, r) => published[lang].push({ n: Number(n), data: r.data });
    if (ru && th) {
      if (ru.data && th.data) {
        if (JSON.stringify(ru.data.terms) !== JSON.stringify(th.data.terms)) {
          errors.push({ code: 11, file: 'bundle_' + n + '_ru.json / bundle_' + n + '_thai.json', msg: 'состав или порядок «terms» различаются' });
          return;
        }
        pub('ru', ru); pub('thai', th);
      } else { if (ru.data) pub('ru', ru); if (th.data) pub('thai', th); }
    } else {
      const only = ru ? 'ru' : 'thai', o = b[only];
      if (o.data) { pub(only, o); stubs.push({ n: Number(n), target: only === 'ru' ? 'thai' : 'ru' }); }
    }
  });

  // Пересборка bundle/ целиком: устаревшие страницы исчезают
  fs.mkdirSync(htmlDir, { recursive: true });
  fs.readdirSync(htmlDir).filter(f => /^(?:index|bundles?_.*)\.html$/.test(f)).forEach(f => fs.unlinkSync(path.join(htmlDir, f)));
  const pages = [];
  const listLangs = LANGS.filter(l => published[l].length > 0);
  const langsOf = n => LANGS.filter(l => published[l].some(b => b.n === n));
  LANGS.forEach(lang => {
    pages.push(...listPages(lang, published[lang].slice().sort((x, y) => y.n - x.n), terms, layouts[lang], listLangs)); // список: новые (больший номер) сверху
    published[lang].forEach(b => pages.push(...bundlePages(lang, b, terms, layouts[lang], langsOf(b.n))));
  });
  stubs.forEach(s => pages.push(stubPage(s.target, s.n, layouts[s.target])));
  // Переключатель языка: готовые адреса в HTML (видны поисковикам без JavaScript)
  pages.forEach(p => { p.html = cfg.withLangSwitch(p.html, p.path, p.lang); });
  // Заглушка на прежнем адресе первой страницы списка ru (bundles_ru.html -> /bundle/)
  const redirects = [{ file: cfg.bundles.name('ru', 1), html: cfg.stubHtml(cfg.bundles.url('ru', 1), 'ru') }];
  pages.concat(redirects).forEach(p => fs.writeFileSync(path.join(htmlDir, p.file), p.html, 'utf8'));

  // sitemap_bundles.xml: опубликованные страницы связок и непустые списки (заглушки — нет); lastmod не пишем
  const xmlEscape = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const entries = pages.filter(p => p.indexable).sort((a, b) => (a.url < b.url ? -1 : a.url > b.url ? 1 : 0));
  const xml = ['<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">'];
  entries.forEach(e => {
    xml.push('  <url>', '    <loc>' + xmlEscape(e.url) + '</loc>');
    if (e.alts.length > 1) {
      e.alts.forEach(a => xml.push('    <xhtml:link rel="alternate" hreflang="' + HREFLANG[a.lang] + '" href="' + xmlEscape(a.url) + '"/>'));
      xml.push('    <xhtml:link rel="alternate" hreflang="x-default" href="' + xmlEscape(e.alts[0].url) + '"/>');
    }
    xml.push('  </url>');
  });
  xml.push('</urlset>', '');
  fs.writeFileSync(opts.sitemapPath || path.join(termsDir, 'sitemap_bundles.xml'), xml.join('\n'), 'utf8');

  return { errors, published, stubs, pages: pages.map(p => p.file), redirects: redirects.map(p => p.file) };
}

module.exports = { build };

if (require.main === module) {
  const termsDir = process.env.BUNDLE_TERMS_DIR || REPO_ROOT;
  const bundleDir = process.env.BUNDLE_DIR || path.join(termsDir, 'bundle');
  const r = build({ termsDir, bundleDir, srcDir: process.env.BUNDLE_SRC_DIR });
  console.log('Связок опубликовано: ru=' + r.published.ru.length + ', thai=' + r.published.thai.length + '; заглушек: ' + r.stubs.length + '; страниц: ' + r.pages.length);
  r.errors.forEach(e => {
    console.error('ОШИБКА [' + e.code + '] ' + e.file + ': ' + e.msg);
    if (process.env.GITHUB_ACTIONS) console.log('::error file=_src/bundle/json/' + e.file.split(' ')[0] + '::[' + e.code + '] ' + e.msg);
  });
  if (r.errors.length) { console.error('Ошибок: ' + r.errors.length + '. Связки с ошибками не опубликованы.'); process.exitCode = 1; }
}
