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
const RESERVED_ROOT = ['nav_', 'progress_', 'how-to-', 'how', 'my', 'nav', 'terms', 'bundle', 'publications', 'css', 'js', 'json',
  'schema', 'docs', 'sitemap', 'robots', 'favicon', '404', 'index', 'img', 'new'];

const absUrl = p => SITE_URL + p;
const pageSuffix = page => (page > 1 ? '_' + page : '');

// Страницы-списки: nav (корень), bundle/bundles_*, publications/publications_*, new/news_*.
// Первая страница русского списка — index.html (адрес «/», «/bundle/», «/publications/», «/new/»).
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
    basePath: '/nav/'
  };
})();
const bundles = makeList('bundle', 'bundles');
const publications = makeList('publications', 'publications');
// «Что нового»: список /new/ (ru, стр. 1), /new/news_<язык>[_N].html; сводка за день — /new/<ГГГГ-ММ-ДД>_<язык>.html
const news = makeList('new', 'news');
const newsDigestName = (date, lang) => date + '_' + lang + '.html';
const newsDigestPath = (date, lang) => '/new/' + newsDigestName(date, lang);
const newsDigestUrl = (date, lang) => absUrl(newsDigestPath(date, lang));

const cardPath = (id, lang) => '/terms/' + id + '_' + lang + '.html';
const cardUrl = (id, lang) => absUrl(cardPath(id, lang));
const bundlePath = (n, lang, page) => '/bundle/bundle_' + n + '_' + lang + pageSuffix(page || 1) + '.html';
const bundleUrl = (n, lang, page) => absUrl(bundlePath(n, lang, page));
const articlePath = name => '/publications/' + name;
const articleUrl = name => absUrl(articlePath(name));
const coverPath = file => '/publications/covers/' + file;
const coverUrl = file => absUrl(coverPath(file));

// Инструкции (ручные страницы) лежат в how/: /how/how-to-add-term_ru.html.
const HOW_PAGES = ['how-to-add-term', 'how-to-check-json', 'how-to-translate-term'];
const howName = (page, lang) => page + '_' + lang + '.html';
const howPath = (page, lang) => '/how/' + howName(page, lang);
const howUrl = (page, lang) => absUrl(howPath(page, lang));

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

// Переключатель языка: адрес той же страницы на другом языке (pagePath — путь от корня).
// Повторяет buildTargetUrl из js/lang.js; сборщики вписывают адрес прямо в HTML,
// чтобы поисковики видели ссылку без JavaScript.
function langTargetPath(pagePath, target) {
  const thai = target === 'thai';
  const dir = pagePath.substring(0, pagePath.lastIndexOf('/') + 1);
  const name = pagePath.substring(pagePath.lastIndexOf('/') + 1);
  if (pagePath === '/' || /^\/nav\/nav_(?:ru|thai)(?:_\d+)?\.html$/.test(pagePath)) return thai ? '/nav/nav_thai.html' : '/';
  if (pagePath === '/bundle/' || /^\/bundle\/bundles_(?:ru|thai)(?:_\d+)?\.html$/.test(pagePath)) return thai ? '/bundle/bundles_thai.html' : '/bundle/';
  const b = pagePath.match(/^\/bundle\/bundle_(\d+)_(?:ru|thai)(?:_\d+)?\.html$/);
  if (b) return '/bundle/bundle_' + b[1] + '_' + target + '.html';
  if (pagePath === '/publications/' || /^\/publications\/[^/]+\.html$/.test(pagePath)) return thai ? '/publications/publications_thai.html' : '/publications/';
  if (pagePath === '/new/' || /^\/new\/[^/]+\.html$/.test(pagePath)) return thai ? '/new/news_thai.html' : '/new/';
  const c = name.match(/^(.+)_(ru|thai)\.html$/);
  return c ? dir + c[1] + '_' + target + '.html' : null;
}

// Вписывает href в ссылки #lang-switch: свой язык — адрес самой страницы, другой — langTargetPath.
function withLangSwitch(html, pagePath, lang) {
  return html.replace(/<a data-lang-value="(ru|thai)" lang="(ru|th)">/g, (m, l, code) => {
    const href = l === lang ? pagePath : langTargetPath(pagePath, l);
    return href ? '<a data-lang-value="' + l + '" lang="' + code + '" href="' + escAttr(href) + '">' : m;
  });
}

module.exports = {
  SITE_URL, RESERVED_ROOT, absUrl, nav, bundles, publications, news, newsDigestName, newsDigestPath, newsDigestUrl,
  cardPath, cardUrl, bundlePath, bundleUrl, articlePath, articleUrl, coverPath, coverUrl,
  navHomePath, stubHtml, escAttr, HOW_PAGES, howName, howPath, howUrl, langTargetPath, withLangSwitch
};
