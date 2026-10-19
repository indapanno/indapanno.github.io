const fs = require('fs');
const path = require('path');

const SCRIPT_DIR = __dirname;
const REPO_ROOT = path.resolve(SCRIPT_DIR, '../..');
const cfg = require('./site-config.js');
const HTML_DIR = path.join(REPO_ROOT, 'terms');                 // карточки терминов
const TEMPLATE_DIR = path.join(REPO_ROOT, '_src/templates');    // шаблоны (не публикуются)
const JSON_DIR = path.join(REPO_ROOT, 'json');
const JS_DIR = path.join(REPO_ROOT, 'js');
if (!fs.existsSync(HTML_DIR)) fs.mkdirSync(HTML_DIR, { recursive: true });
const PAGE_SIZE = 10;
const LANGS = ['ru', 'thai'];

const {
  renderTimeline, renderMissingTranslation, boldTerm, escapeHtml, capitalize, TERM_UI_STRINGS
} = require(path.join(JS_DIR, 'render-term.js'));
const { toThaiNumerals } = require(path.join(JS_DIR, 'thai-numerals.js'));

function readTemplate(name) {
  return fs.readFileSync(path.join(TEMPLATE_DIR, name), 'utf8');
}

const TEMPLATES = { ru: readTemplate('_template_ru.html'), thai: readTemplate('_template_thai.html') };
const NAV_TEMPLATES = { ru: readTemplate('_template_nav_ru.html'), thai: readTemplate('_template_nav_thai.html') };
const LOADING_TEXT = { ru: 'Загрузка…', thai: 'กำลังโหลด…' };
const TITLE_PLACEHOLDER = {
  ru: '<title>История и значение термина</title>',
  thai: '<title>ประวัติและความหมายของคำศัพท์</title>'
};
const NAV_TITLE_TEXT = { ru: 'Навигатор по палийским терминам', thai: 'นำทางคำศัพท์บาลี' };
const IAST_PLACEHOLDER = {
  ru: '<h2 id="term-iast-btn" class="term-iast-btn" hidden role="button" tabindex="0" aria-label="Скопировать транслитерацию IAST"></h2>',
  thai: '<h2 id="term-iast-btn" class="term-iast-btn" hidden role="button" tabindex="0" aria-label="คัดลอกอักษรโรมัน IAST"></h2>'
};

function replaceOnce(html, oldStr, newStr, id, label) {
  const count = html.split(oldStr).length - 1;
  if (count !== 1) {
    throw new Error('Не найден или не уникален якорь "' + label + '" для ' + id + ' (совпадений: ' + count + ')');
  }
  return html.split(oldStr).join(newStr);
}

// 1. Читаем JSON по каждому языку
function loadTerms(lang) {
  const suffix = '_' + lang + '.json';
  const files = fs.readdirSync(JSON_DIR).filter(f => f.endsWith(suffix) && !f.startsWith('index'));
  const map = {};
  files.forEach(filename => {
    const id = filename.slice(0, -suffix.length);
    map[id] = JSON.parse(fs.readFileSync(path.join(JSON_DIR, filename), 'utf8'));
  });
  return map;
}

const dataByLang = { ru: loadTerms('ru'), thai: loadTerms('thai') };
const allIds = Array.from(new Set([...Object.keys(dataByLang.ru), ...Object.keys(dataByLang.thai)])).sort();

// Запретные идентификаторы (раздел 6 ТЗ): зарезервированные имена сайта.
const isReservedId = id => cfg.RESERVED_ROOT.some(r => (/[_-]$/.test(r) ? id.startsWith(r) : id === r));
const badIds = allIds.filter(isReservedId);
if (badIds.length) {
  badIds.forEach(id => console.error('::error file=json/' + id + '_ru.json::Идентификатор «' + id + '» зарезервирован сайтом, выберите другой'));
  process.exit(1);
}
console.log('Всего терминов (любой язык):', allIds.length);

// 2. index_<lang>.json — только реально переведённые на этот язык термины
LANGS.forEach(lang => {
  const nameKey = lang === 'thai' ? 'term_thai' : 'term_ru';
  const ids = Object.keys(dataByLang[lang]).sort();
  const indexTerms = ids.map(id => ({
    id: id,
    [nameKey]: capitalize(dataByLang[lang][id][nameKey]),
    later_count: (dataByLang[lang][id].later_mentions || []).length
  }));
  fs.writeFileSync(path.join(JSON_DIR, 'index_' + lang + '.json'), JSON.stringify({ terms: indexTerms }, null, 2) + '\n', 'utf8');
  console.log('index_' + lang + '.json обновлён:', indexTerms.length, 'терминов');
});

// 3. Сниппет для навигации
function buildSnippet(data) {
  const parts = [data.interpretation, data.reason_introduced].filter(Boolean);
  let text = parts.join(' ');
  if (!text) return '';
  text = capitalize(text);
  const MAX = 130;
  if (text.length > MAX) text = text.slice(0, MAX).replace(/\s+\S*$/, '') + '…';
  return text;
}

// SEO-теги в <head> карточки: canonical, hreflang, meta description, Open Graph.
// Заглушки «перевод отсутствует» получают только noindex (в sitemap они тоже не входят).
const HREFLANG_CODE = { ru: 'ru', thai: 'th' }; // код тайского в hreflang — «th», не «thai»
const OG_LOCALE = { ru: 'ru_RU', thai: 'th_TH' };
const META_DESC_MAX = { ru: 155, thai: 120 };

function truncateForMeta(text, max, lang) {
  if (text.length <= max) return text;
  // Если в пределах лимита есть законченное предложение (не слишком короткое) — режем по нему, без «…».
  const head = text.slice(0, max);
  const stops = ['. ', '! ', '? ', '.» ', '.)'].map(m => head.lastIndexOf(m) + 1).filter(i => i > 0);
  const sentenceEnd = stops.length ? Math.max(...stops) : 0;
  if (sentenceEnd >= max * 0.6) return head.slice(0, sentenceEnd).trim();
  let cut;
  if (lang === 'thai' && typeof Intl !== 'undefined' && Intl.Segmenter) {
    // В тайском нет пробелов между словами — режем по границе слова через ICU.
    let end = 0;
    for (const seg of new Intl.Segmenter('th', { granularity: 'word' }).segment(text)) {
      if (seg.index + seg.segment.length > max) break;
      end = seg.index + seg.segment.length;
    }
    cut = text.slice(0, end || max);
  } else {
    cut = text.slice(0, max).replace(/\s+\S*$/, '');
  }
  return cut.replace(/[\s,;:—-]+$/, '') + '…';
}

function buildMetaDescription(lang, data) {
  const source = [data.interpretation, data.reason_introduced].find(t => t && String(t).trim());
  if (!source) return '';
  return truncateForMeta(capitalize(String(source).trim().replace(/\s+/g, ' ')), META_DESC_MAX[lang], lang);
}

function buildSeoTags(lang, id, data, titleText) {
  if (!data) return '<meta name="robots" content="noindex">';
  const urlOf = l => cfg.cardUrl(id, l);
  const present = LANGS.filter(l => dataByLang[l][id]);
  const tags = ['<link rel="canonical" href="' + urlOf(lang) + '">'];
  if (present.length > 1) {
    present.forEach(l => tags.push('<link rel="alternate" hreflang="' + HREFLANG_CODE[l] + '" href="' + urlOf(l) + '">'));
    tags.push('<link rel="alternate" hreflang="x-default" href="' + urlOf(present[0]) + '">');
  }
  const desc = buildMetaDescription(lang, data);
  if (desc) tags.push('<meta name="description" content="' + escapeHtml(desc) + '">');
  tags.push('<meta property="og:type" content="article">');
  tags.push('<meta property="og:site_name" content="' + escapeHtml(NAV_TITLE_TEXT[lang]) + '">');
  tags.push('<meta property="og:title" content="' + escapeHtml(titleText) + '">');
  if (desc) tags.push('<meta property="og:description" content="' + escapeHtml(desc) + '">');
  tags.push('<meta property="og:url" content="' + urlOf(lang) + '">');
  tags.push('<meta property="og:locale" content="' + OG_LOCALE[lang] + '">');
  present.filter(l => l !== lang).forEach(l => tags.push('<meta property="og:locale:alternate" content="' + OG_LOCALE[l] + '">'));
  return tags.join('\n');
}

// 4. Карточки терминов — для КАЖДОГО известного id на КАЖДОМ языке
// (если данных для языка нет — страница "перевод отсутствует")
function buildCardHtml(lang, id, data) {
  const strings = TERM_UI_STRINGS[lang];
  const loading = LOADING_TEXT[lang];
  let html = TEMPLATES[lang];

  const termName = data ? capitalize(data.term_ru || data.term_thai || id) : id;
  const iast = data ? (data.term_iast || '') : '';

  const titleText = strings.titlePrefix + ' ' + termName + (iast ? ' (' + iast + ')' : '');
  html = replaceOnce(html, TITLE_PLACEHOLDER[lang],
    '<title>' + escapeHtml(titleText) + '</title>',
    lang + '/' + id, 'title');

  html = replaceOnce(html, '<h1 id="page-title">' + loading + '</h1>',
    '<h1 id="page-title">' + boldTerm(termName) + '</h1>', lang + '/' + id, 'h1');

  const iastOld = IAST_PLACEHOLDER[lang];
  const iastNew = iast
    ? iastOld.replace(' hidden', '').replace('></h2>', ' data-copy-text="' + escapeHtml(iast) + '">' + escapeHtml(iast) + '</h2>')
    : iastOld;
  html = replaceOnce(html, iastOld, iastNew, lang + '/' + id, 'iast');

  html = replaceOnce(html, '<p class="header-intro" id="header-intro">' + loading + '</p>',
    '<p class="header-intro" id="header-intro">' + strings.headerIntro(boldTerm(termName)) + '</p>', lang + '/' + id, 'header-intro');

  html = replaceOnce(html, '<span class="current" id="breadcrumb-current"></span>',
    '<span class="current" id="breadcrumb-current">' + boldTerm(termName) + '</span>', lang + '/' + id, 'breadcrumb');

  const contentHtml = data
    ? renderTimeline(strings, data)
    : renderMissingTranslation(strings, id, strings.langNameOfSelf, cfg.howPath('how-to-translate-term', lang));

  html = replaceOnce(html, '<div id="term-content">\n    <p id="loading">' + loading + '</p>\n  </div>',
    '<div id="term-content">' + contentHtml + '</div>', lang + '/' + id, 'term-content');

  // Заглушка «перевод отсутствует»: изучать нечего, блок отметки «Изучен» не нужен
  if (!data) {
    html = replaceOnce(html, '  <div id="learned-bar" class="learned-bar"></div>\n', '', lang + '/' + id, 'learned-bar');
  }

  html = replaceOnce(html, '<link rel="stylesheet" href="/css/style.css">',
    '<link rel="stylesheet" href="/css/style.css">\n' + buildSeoTags(lang, id, data, titleText),
    lang + '/' + id, 'seo-head');

  return html;
}

const cardCounts = { ru: 0, thai: 0 };
allIds.forEach(id => {
  LANGS.forEach(lang => {
    const data = dataByLang[lang][id];
    const html = buildCardHtml(lang, id, data);
    fs.writeFileSync(path.join(HTML_DIR, id + '_' + lang + '.html'), html, 'utf8');
    cardCounts[lang]++;
  });
});
console.log('Карточек собрано: ru=' + cardCounts.ru + ', thai=' + cardCounts.thai);

// 5. Навигационные страницы — по каждому языку, только реально переведённые термины
// Имена и адреса страниц списка — в site-config.js (cfg.nav): ru стр. 1 = index.html («/»).

function buildPaginationHtml(lang, page, totalPages) {
  if (totalPages <= 1) return '';
  const backText = lang === 'thai' ? '← ย้อนกลับ' : '← Назад';
  const nextText = lang === 'thai' ? 'ถัดไป →' : 'Далее →';
  const pagesLabel = lang === 'thai' ? 'หน้า' : 'Страницы';
  const digits = n => (lang === 'thai' ? toThaiNumerals(n) : String(n));
  const parts = [];
  if (page > 1) parts.push('<a href="' + cfg.nav.path(lang, page - 1) + '" class="page-link">' + backText + '</a>');
  for (let p = 1; p <= totalPages; p++) {
    parts.push(p === page
      ? '<span class="page-current">' + digits(p) + '</span>'
      : '<a href="' + cfg.nav.path(lang, p) + '" class="page-link">' + digits(p) + '</a>');
  }
  if (page < totalPages) parts.push('<a href="' + cfg.nav.path(lang, page + 1) + '" class="page-link">' + nextText + '</a>');
  return '<nav class="pagination" aria-label="' + pagesLabel + '">' + parts.join('') + '</nav>';
}

const totalPagesByLang = {};

// SEO страниц навигатора: описание сайта (общее для всех страниц; у страниц 2+ добавляется номер).
const NAV_DESCRIPTION = {
  ru: 'Навигатор по истории палийских терминов: как появлялись и менялись ключевые слова буддийского учения — кто ввёл термин, когда и с какими смыслами он дошёл до нас.',
  thai: 'ตัวนำทางประวัติศัพท์บาลี: ดูว่าคำสำคัญในคำสอนของพระพุทธศาสนาเกิดขึ้นและเปลี่ยนความหมายมาอย่างไร ใครเป็นผู้บัญญัติ เมื่อใด และมีความหมายอย่างไรในแต่ละยุค'
};
const NAV_HREFLANG_CODE = { ru: 'ru', thai: 'th' };
const NAV_OG_LOCALE = { ru: 'ru_RU', thai: 'th_TH' };

LANGS.forEach(lang => {
  const nameKey = lang === 'thai' ? 'term_thai' : 'term_ru';
  const items = Object.keys(dataByLang[lang]).map(id => ({ id, data: dataByLang[lang][id] }));
  const sorted = items.slice().sort((a, b) => (a.data[nameKey] || '').localeCompare(b.data[nameKey] || '', lang === 'thai' ? 'th' : 'ru'));
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  totalPagesByLang[lang] = totalPages;

  for (let page = 1; page <= totalPages; page++) {
    const start = (page - 1) * PAGE_SIZE;
    const pageTerms = sorted.slice(start, start + PAGE_SIZE);

    const liHtml = pageTerms.map(({ id, data }) => {
      const name = escapeHtml(capitalize(data[nameKey] || id));
      const laterCount = (data.later_mentions || []).length;
      const badgeNum = lang === 'thai' ? toThaiNumerals(laterCount) : laterCount;
      const badge = laterCount > 0 ? ' <span class="count-badge">+' + badgeNum + '</span>' : '';
      const snippet = buildSnippet(data);
      const snippetHtml = snippet ? '<div class="nav-snippet">' + escapeHtml(snippet) + '</div>' : '';
      const learnedLabel = lang === 'thai' ? 'ยังไม่ได้เรียน' : 'Не изучен';
      return '<li class="term-item"><a href="' + cfg.cardPath(id, lang) + '">' + name + badge + snippetHtml + '</a>'
        + '<button type="button" class="learned-btn" data-learned-id="' + escapeHtml(id) + '">' + learnedLabel + '</button></li>';
    }).join('');

    let html = NAV_TEMPLATES[lang];
    const loadingLi = '<li>' + LOADING_TEXT[lang] + '</li>';
    html = replaceOnce(html,
      '<ul id="term-list" class="term-list">\n    ' + loadingLi + '\n  </ul>',
      '<ul id="term-list" class="term-list">' + liHtml + '</ul>' + buildPaginationHtml(lang, page, totalPages),
      lang + ' nav p' + page, 'term-list');

    const canonicalUrl = cfg.nav.url(lang, page);
    const pageSuffix = page > 1
      ? (lang === 'thai' ? (' — หน้า ' + toThaiNumerals(page)) : (' — страница ' + page))
      : '';
    let linkTags;
    if (sorted.length === 0) {
      // Язык без единого перевода: пустой навигатор в поиск не нужен (в sitemap его тоже нет).
      linkTags = '<meta name="robots" content="noindex">';
    } else {
      linkTags = '<link rel="canonical" href="' + canonicalUrl + '">';
      if (page > 1) linkTags += '\n<link rel="prev" href="' + cfg.nav.url(lang, page - 1) + '">';
      if (page < totalPages) linkTags += '\n<link rel="next" href="' + cfg.nav.url(lang, page + 1) + '">';
      // hreflang — только для первой страницы списка и только если навигатор есть на обоих языках
      // (пагинация у языков разная, соответствия страниц 2+ между языками нет).
      const navLangsWithTerms = LANGS.filter(l => Object.keys(dataByLang[l]).length > 0);
      if (page === 1 && navLangsWithTerms.length > 1) {
        navLangsWithTerms.forEach(l => {
          linkTags += '\n<link rel="alternate" hreflang="' + NAV_HREFLANG_CODE[l] + '" href="' + cfg.nav.url(l, 1) + '">';
        });
        linkTags += '\n<link rel="alternate" hreflang="x-default" href="' + cfg.nav.url(navLangsWithTerms[0], 1) + '">';
      }
      const navDesc = NAV_DESCRIPTION[lang] + (page > 1 ? (lang === 'thai' ? ' หน้า ' + toThaiNumerals(page) + '.' : ' Страница ' + page + '.') : '');
      const navTitle = NAV_TITLE_TEXT[lang] + pageSuffix;
      linkTags += '\n<meta name="description" content="' + escapeHtml(navDesc) + '">';
      linkTags += '\n<meta property="og:type" content="website">';
      linkTags += '\n<meta property="og:site_name" content="' + escapeHtml(NAV_TITLE_TEXT[lang]) + '">';
      linkTags += '\n<meta property="og:title" content="' + escapeHtml(navTitle) + '">';
      linkTags += '\n<meta property="og:description" content="' + escapeHtml(navDesc) + '">';
      linkTags += '\n<meta property="og:url" content="' + canonicalUrl + '">';
      linkTags += '\n<meta property="og:locale" content="' + NAV_OG_LOCALE[lang] + '">';
    }
    html = replaceOnce(html, '<link rel="stylesheet" href="/css/style.css">',
      '<link rel="stylesheet" href="/css/style.css">\n' + linkTags, lang + ' nav p' + page, 'canonical');

    if (page > 1) {
      html = replaceOnce(html, '<title>' + NAV_TITLE_TEXT[lang] + '</title>',
        '<title>' + NAV_TITLE_TEXT[lang] + pageSuffix + '</title>', lang + ' nav p' + page, 'title');
    }

    const navTarget = path.join(REPO_ROOT, cfg.nav.file(lang, page));
    fs.mkdirSync(path.dirname(navTarget), { recursive: true });
    fs.writeFileSync(navTarget, html, 'utf8');
  }
  console.log('Навигационных страниц (' + lang + ') собрано:', totalPages);
});

// 5а. Заглушки на адреса каталогов: terms/, nav/, how/ ведут на «/».
fs.writeFileSync(path.join(HTML_DIR, 'index.html'), cfg.stubHtml(cfg.nav.url('ru', 1), 'ru'), 'utf8');
['nav', 'how'].forEach(d => {
  fs.mkdirSync(path.join(REPO_ROOT, d), { recursive: true });
  fs.writeFileSync(path.join(REPO_ROOT, d, 'index.html'), cfg.stubHtml(cfg.nav.url('ru', 1), 'ru'), 'utf8');
});

// 6. Уборка: осиротевшие карточки (в terms/) и лишние страницы пагинации (в корне).
// Ручные файлы (my/*, how/*, 404.html, index.html и т. д.) не удаляются никогда.
LANGS.forEach(lang => {
  const suffix = '_' + lang + '.html';
  const existingHtmlFiles = fs.readdirSync(HTML_DIR).filter(f =>
    f.endsWith(suffix) && f !== 'index.html'
  );
  let removedCards = 0;
  existingHtmlFiles.forEach(file => {
    const id = file.slice(0, -suffix.length);
    if (!allIds.includes(id)) {
      fs.unlinkSync(path.join(HTML_DIR, file));
      removedCards++;
      console.log('Удалён осиротевший файл:', file);
    }
  });
  if (removedCards) console.log('Удалено осиротевших карточек (' + lang + '):', removedCards);

  // Страницы списка в nav/ (> числа страниц); nav_*.html в корне на новом сайте не нужны и удаляются
  const navRe = new RegExp('^nav_' + lang + '(?:_(\\d+))?\\.html$');
  let removedNavPages = 0;
  [['nav', totalPagesByLang[lang] || 0], ['', 0]].forEach(([sub, keepUpTo]) => {
    const dir = path.join(REPO_ROOT, sub);
    if (!fs.existsSync(dir)) return;
    fs.readdirSync(dir).forEach(file => {
      const m = file.match(navRe);
      if (!m) return;
      const pageNum = m[1] ? parseInt(m[1], 10) : 1;
      if (pageNum > keepUpTo) {
        fs.unlinkSync(path.join(dir, file));
        removedNavPages++;
        console.log('Удалена устаревшая страница пагинации:', (sub ? sub + '/' : '') + file);
      }
    });
  });
  if (removedNavPages) console.log('Удалено устаревших страниц пагинации (' + lang + '):', removedNavPages);
});

// 7. sitemap.xml — только реально существующие переводы
// (заглушки «перевод отсутствует» в карту не попадают: это тонкие страницы).
// lastmod намеренно не указываем: в GitHub Actions git-даты файлов недостоверны.
(function buildSitemap() {
  const HREFLANG = { ru: 'ru', thai: 'th' }; // код тайского языка в hreflang — «th», не «thai»
  const SITEMAP_PATH = path.join(REPO_ROOT, 'sitemap.xml');
  const xmlEscape = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  
  const entries = [];

  // Карточки: по каждому языку, где перевод действительно есть.
  allIds.forEach(id => {
    const present = LANGS.filter(lang => dataByLang[lang][id]);
    present.forEach(lang => {
      const alternates = present.length > 1
        ? present.map(l => ({ hreflang: HREFLANG[l], url: cfg.cardUrl(id, l), file: path.join('terms', id + '_' + l + '.html') }))
        : [];
      entries.push({ url: cfg.cardUrl(id, lang), file: path.join('terms', id + '_' + lang + '.html'), alternates });
    });
  });

  // Навигатор: только языки, где есть хотя бы один термин.
  const navLangs = LANGS.filter(lang => Object.keys(dataByLang[lang]).length > 0);
  navLangs.forEach(lang => {
    for (let page = 1; page <= totalPagesByLang[lang]; page++) {
      const alternates = (page === 1 && navLangs.length > 1)
        ? navLangs.map(l => ({ hreflang: HREFLANG[l], url: cfg.nav.url(l, 1), file: cfg.nav.file(l, 1) }))
        : [];
      entries.push({ url: cfg.nav.url(lang, page), file: cfg.nav.file(lang, page), alternates });
    }
  });

  entries.sort((a, b) => (a.url < b.url ? -1 : a.url > b.url ? 1 : 0));

  entries.forEach(e => {
    if (!fs.existsSync(path.join(REPO_ROOT, e.file))) {
      console.warn('sitemap: файл не найден на диске, но попал в карту:', e.url);
    }
  });
  if (entries.length > 50000) console.warn('sitemap: больше 50 000 адресов — нужен индекс карт сайта');

  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">'
  ];
  entries.forEach(e => {
    lines.push('  <url>');
    lines.push('    <loc>' + xmlEscape(e.url) + '</loc>');
    e.alternates.forEach(a => {
      lines.push('    <xhtml:link rel="alternate" hreflang="' + a.hreflang + '" href="' + xmlEscape(a.url) + '"/>');
    });
    lines.push('  </url>');
  });
  lines.push('</urlset>', '');

  fs.writeFileSync(SITEMAP_PATH, lines.join('\n'), 'utf8');
  console.log('sitemap.xml: адресов записано:', entries.length);
})();
