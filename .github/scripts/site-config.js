// Единый модуль адресов сайта. Три сборщика и тесты берут адреса только отсюда.
// (Изменение этого файла запускает все три сборки.)
// Сайт живёт в корне https://indapanno.github.io/ (репозиторий indapanno.github.io).
//
// «path» — путь от корня сайта (начинается с «/»), его пишут в ссылки на страницах.
// «url» — полный канонический адрес (canonical, hreflang, Open Graph, sitemap).
// «file» — файл, который пишет сборщик (от корня сайта). «name» — имя страницы:
// у первой страницы русского списка file = index.html, а name = nav_ru.html
// (по прежнему имени сборщик кладёт заглушку, ведущую на новый адрес).

const SITE_URL = 'https://indapanno.github.io';

// Имена, которые нельзя использовать для файлов терминов и статей (раздел 6 ТЗ).
const RESERVED_ROOT = ['nav_', 'progress_', 'how-to-', 'how', 'nav', 'terms', 'bundle', 'publications', 'css', 'js', 'json',
  'schema', 'docs', 'sitemap', 'robots', 'favicon', '404', 'index', 'img'];

const absUrl = p => SITE_URL + p;
const pageSuffix = page => (page > 1 ? '_' + page : '');

// Страницы-списки: nav (корень), bundle/bundles_*, publications/publications_*.
// Первая страница русского списка — index.html (адрес «/», «/bundle/», «/publications/»).
function makeList(dir, prefix) {
  const base = dir ? '/' + dir + '/' : '/';
  const name = (lang, page) => prefix + '_' + lang + pageSuffix(page) + '.html';
  const isIndex = (lang, page) => lang === 'ru' && page === 1;
  return {
    dir: dir,
    name: name,
    isIndex: isIndex,
    file: (lang, page) => (isIndex(lang, page) ? 'index.html' : name(lang, page)),
    path: (lang, page) => (isIndex(lang, page) ? base : base + name(lang, page)),
    url: (lang, page) => absUrl(isIndex(lang, page) ? base : base + name(lang, page)),
    basePath: base
  };
}

// Список терминов: первая страница русского списка — «/» (index.html в корне), все остальные
// страницы — в папке nav/ (nav/nav_ru_2.html, nav/nav_thai.html …), чтобы корень не рос.
// Прежние адреса в корне (nav_ru.html, nav_ru_2.html … nav_thai_5.html) остаются заглушками:
// legacy = имя файла заглушки в корне, их пишут только для страниц 1…LEGACY_NAV_MAX.
const LEGACY_NAV_MAX = 5;
const nav = (function () {
  const name = (lang, page) => 'nav_' + lang + pageSuffix(page) + '.html';
  const isIndex = (lang, page) => lang === 'ru' && page === 1;
  const path = (lang, page) => (isIndex(lang, page) ? '/' : '/nav/' + name(lang, page));
  return {
    dir: 'nav',
    name: name,
    isIndex: isIndex,
    file: (lang, page) => (isIndex(lang, page) ? 'index.html' : 'nav/' + name(lang, page)),
    path: path,
    url: (lang, page) => absUrl(path(lang, page)),
    basePath: '/nav/',
    legacyFile: name,                         // имя файла заглушки в корне
    legacyPath: (lang, page) => '/' + name(lang, page)
  };
})();
const bundles = makeList('bundle', 'bundles');
const publications = makeList('publications', 'publications');

const cardPath = (id, lang) => '/terms/' + id + '_' + lang + '.html';
const cardUrl = (id, lang) => absUrl(cardPath(id, lang));
const bundlePath = (n, lang, page) => '/bundle/bundle_' + n + '_' + lang + pageSuffix(page || 1) + '.html';
const bundleUrl = (n, lang, page) => absUrl(bundlePath(n, lang, page));
const articlePath = name => '/publications/' + name;
const articleUrl = name => absUrl(articlePath(name));
const coverPath = file => '/publications/covers/' + file;
const coverUrl = file => absUrl(coverPath(file));

// Инструкции (ручные страницы) лежат в how/: /how/how-to-add-term_ru.html. Прежние адреса в корне —
// заглушки (пишет build-terms.js).
const HOW_PAGES = ['how-to-add-term', 'how-to-check-json', 'how-to-translate-term'];
const howName = (page, lang) => page + '_' + lang + '.html';
const howPath = (page, lang) => '/how/' + howName(page, lang);
const howUrl = (page, lang) => absUrl(howPath(page, lang));
const howLegacyFile = (page, lang) => howName(page, lang);

// Ссылка «к списку терминов» из хлебных крошек
const navHomePath = lang => nav.path(lang, 1);

function escAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Заглушка на старом/прежнем адресе: мгновенный meta refresh, canonical на новый адрес,
// запасной JS-переход (сохраняет ?параметры и #якорь), ссылка в тексте. Без noindex.
function stubHtml(targetUrl, lang) {
  const thai = lang === 'thai';
  const u = escAttr(targetUrl);
  const js = JSON.stringify(targetUrl).replace(/</g, '\\u003c');
  return '<!doctype html>\n'
    + '<html lang="' + (thai ? 'th' : 'ru') + '">\n'
    + '<head>\n'
    + '<meta charset="UTF-8">\n'
    + '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
    + '<title>' + (thai ? 'หน้านี้ย้ายแล้ว' : 'Страница переехала') + '</title>\n'
    + '<link rel="canonical" href="' + u + '">\n'
    + '<meta http-equiv="refresh" content="0; url=' + u + '">\n'
    + '<script>location.replace(' + js + ' + location.search + location.hash);</script>\n'
    + '</head>\n'
    + '<body>\n'
    + '<p>' + (thai ? 'หน้านี้ย้ายไปที่' : 'Страница переехала') + ': <a href="' + u + '">' + escAttr(targetUrl) + '</a></p>\n'
    + '</body>\n'
    + '</html>\n';
}

module.exports = {
  SITE_URL, RESERVED_ROOT, absUrl, nav, bundles, publications,
  cardPath, cardUrl, bundlePath, bundleUrl, articlePath, articleUrl, coverPath, coverUrl,
  navHomePath, stubHtml, escAttr, LEGACY_NAV_MAX, HOW_PAGES, howName, howPath, howUrl, howLegacyFile
};
