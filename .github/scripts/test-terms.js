'use strict';
// Автотесты сборки терминов: `node .github/scripts/test-terms.js`.
// 1) Smoke: build-terms.js запускается как есть во временной папке на настоящих JSON-терминах
//    (копия нужных файлов репозитория); проверяются карточки, заглушки, индексы, навигатор, sitemap.
// 2) JSON-LD и og:image на карточках и первой странице навигатора.
// 3) check-sources.js — проверка формата sources[].location (только предупреждения).
// Реальные файлы репозитория не меняются.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const REPO = path.resolve(__dirname, '../..');
const SITE = 'https://indapanno.github.io';
let passed = 0, failed = 0;
function check(name, cond, extra) {
  if (cond) passed++; else { failed++; console.error('ПРОВАЛ: ' + name + (extra ? ' — ' + extra : '')); }
}

const copy = (rel, root) => { const to = path.join(root, rel); fs.mkdirSync(path.dirname(to), { recursive: true }); fs.copyFileSync(path.join(REPO, rel), to); };

// Временный сайт: скрипты, общие JS, шаблоны и выбранные термины.
// terms = { ru: [id…], thai: [id…] } — берутся настоящие json/<id>_<lang>.json
function makeSite(terms, extra) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'terms-'));
  ['.github/scripts/build-terms.js', '.github/scripts/site-config.js', 'js/render-term.js', 'js/thai-numerals.js']
    .forEach(f => copy(f, root));
  if (fs.existsSync(path.join(REPO, '.github/scripts/check-sources.js'))) copy('.github/scripts/check-sources.js', root);
  fs.readdirSync(path.join(REPO, '_src/templates')).forEach(f => copy('_src/templates/' + f, root));
  ['json', 'terms'].forEach(d => fs.mkdirSync(path.join(root, d), { recursive: true }));
  Object.keys(terms).forEach(l => terms[l].forEach(id => copy('json/' + id + '_' + l + '.json', root)));
  if (extra) extra(root);
  return root;
}
function build(root) {
  const r = spawnSync(process.execPath, [path.join(root, '.github/scripts/build-terms.js')], { cwd: root, encoding: 'utf8' });
  return { status: r.status, out: r.stdout + r.stderr };
}
const rd = (root, f) => (fs.existsSync(path.join(root, f)) ? fs.readFileSync(path.join(root, f), 'utf8') : '');
const ex = (root, f) => fs.existsSync(path.join(root, f));
function ld(html) {
  const out = [];
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try { out.push(JSON.parse(m[1])); } catch (e) { out.push({ __bad: e.message }); }
  }
  return out;
}
const flat = blocks => blocks.flatMap(b => (b && b['@graph'] ? b['@graph'] : [b]));
const byType = (html, t) => flat(ld(html)).find(x => x && x['@type'] === t);
const meta = (html, prop) => { const m = html.match(new RegExp('<meta (?:property|name)="' + prop.replace(/[:]/g, '\\:') + '" content="([^"]*)">')); return m ? m[1] : null; };

// Настоящие термины: 12 русских (две страницы навигатора), часть с тайским переводом
const RU = ['ariya', 'cattariariyasaccani', 'dukkha', 'dukkhaariyasacca', 'sacca', 'samudaya', 'nirodha', 'magga', 'kamma', 'dana', 'sila', 'panna'];
const TH = ['ariya', 'dukkha', 'sacca'];
const ONLY_RU = 'samudaya'; // нет тайского в этом наборе → тайская заглушка

// ---------- 1. Smoke ----------
const root = makeSite({ ru: RU, thai: TH }, r => {
  fs.writeFileSync(path.join(r, 'terms/oldterm_ru.html'), 'старая карточка');   // осиротевшая
  fs.writeFileSync(path.join(r, 'nav_ru_9.html'), 'старая страница');             // прежний адрес пагинации
});
const b1 = build(root);
check('smoke: сборка завершается без ошибки', b1.status === 0, b1.out.slice(-400));
check('smoke: карточки ru для всех терминов', RU.every(id => rd(root, 'terms/' + id + '_ru.html').includes('<html lang="ru"')));
check('smoke: карточки thai для переведённых', TH.every(id => rd(root, 'terms/' + id + '_thai.html').includes('<html lang="th"')));
{
  const stub = rd(root, 'terms/' + ONLY_RU + '_thai.html');
  check('smoke: заглушка «перевод отсутствует» — noindex и ссылка на инструкцию перевода',
    stub.includes('<meta name="robots" content="noindex">') && stub.includes('/how/how-to-translate-term_thai.html'));
  const card = rd(root, 'terms/dukkha_ru.html');
  check('smoke: карточка — canonical, hreflang ru/th/x-default, description, Open Graph',
    card.includes('<link rel="canonical" href="' + SITE + '/terms/dukkha_ru.html">') && card.includes('hreflang="th"') && card.includes('hreflang="x-default"')
    && /<meta name="description" content="[^"]+">/.test(card) && card.includes('<meta property="og:type" content="article">'));
  check('smoke: карточка — меню 6 пунктов и переключатель языка с адресами', (card.match(/<ul id="nav-menu-list"[^>]*>([\s\S]*?)<\/ul>/) || ['', ''])[1].split('<li>').length - 1 === 6
    && card.includes('<a data-lang-value="thai" lang="th" href="/terms/dukkha_thai.html">'));
}
{
  const ir = JSON.parse(rd(root, 'json/index_ru.json') || '{"terms":[]}'), it = JSON.parse(rd(root, 'json/index_thai.json') || '{"terms":[]}');
  check('smoke: index_ru.json — все русские термины', ir.terms.length === RU.length && ir.terms.every(t => t.term_ru && typeof t.later_count === 'number'));
  check('smoke: index_thai.json — только переведённые (без заглушек)', it.terms.length === TH.length && !it.terms.some(t => t.id === ONLY_RU));
}
check('smoke: навигатор — «/» и nav/nav_ru_2.html (12 терминов → 2 страницы), nav/nav_thai.html', ex(root, 'index.html') && ex(root, 'nav/nav_ru_2.html') && !ex(root, 'nav/nav_ru_3.html') && ex(root, 'nav/nav_thai.html'));
check('smoke: навигатор — 10 плиток на первой странице, 2 на второй', (rd(root, 'index.html').match(/class="term-item"/g) || []).length === 10 && (rd(root, 'nav/nav_ru_2.html').match(/class="term-item"/g) || []).length === 2);
check('smoke: заглушки каталогов terms/, nav/, how/ → «/»', ['terms/index.html', 'nav/index.html', 'how/index.html'].every(f => rd(root, f).includes('<link rel="canonical" href="' + SITE + '/">')));
check('smoke: уборка — осиротевшая карточка и старая страница пагинации удалены', !ex(root, 'terms/oldterm_ru.html') && !ex(root, 'nav_ru_9.html'));
{
  const sm = rd(root, 'sitemap.xml');
  check('smoke: sitemap — карточки, навигатор, без заглушек', sm.includes('<loc>' + SITE + '/terms/dukkha_ru.html</loc>') && sm.includes('<loc>' + SITE + '/</loc>')
    && sm.includes('<loc>' + SITE + '/nav/nav_ru_2.html</loc>') && !sm.includes(ONLY_RU + '_thai.html'));
}
{
  const snap = () => ['index.html', 'nav/nav_ru_2.html', 'terms/dukkha_ru.html', 'terms/dukkha_thai.html', 'sitemap.xml', 'json/index_ru.json'].map(f => rd(root, f)).join('\u0000');
  const before = snap(); const b2 = build(root);
  check('smoke: повторная сборка — тот же результат (байт в байт)', b2.status === 0 && snap() === before);
}
{
  const bad = makeSite({ ru: ['dukkha'] }, r => fs.copyFileSync(path.join(REPO, 'json/dukkha_ru.json'), path.join(r, 'json/terms_ru.json')));
  const b = build(bad);
  check('smoke: зарезервированный id → ошибка сборки (код 1)', b.status === 1 && /зарезервирован/.test(b.out), b.status + ' ' + b.out.slice(-200));
}

// ---------- 2. JSON-LD и og:image ----------
{
  const card = rd(root, 'terms/dukkha_ru.html'), cardTh = rd(root, 'terms/dukkha_thai.html');
  const all = flat(ld(card));
  check('JSON-LD: на карточке есть и разбирается', all.length > 0 && all.every(x => x && !x.__bad), JSON.stringify(all).slice(0, 200));
  const crumbs = byType(card, 'BreadcrumbList');
  check('JSON-LD: хлебные крошки Навигатор → термин', !!crumbs && Array.isArray(crumbs.itemListElement) && crumbs.itemListElement.length === 2
    && crumbs.itemListElement[0].position === 1 && crumbs.itemListElement[0].item === SITE + '/'
    && crumbs.itemListElement[1].position === 2 && crumbs.itemListElement[1].item === SITE + '/terms/dukkha_ru.html'
    && crumbs.itemListElement[1].name === 'Дуккха', JSON.stringify(crumbs));
  const term = byType(card, 'DefinedTerm');
  const desc = (card.match(/<meta name="description" content="([^"]*)">/) || [])[1];
  check('JSON-LD: термин — название, IAST, толкование, адрес, язык, набор терминов', !!term && term.name === 'Дуккха' && term.alternateName === 'dukkha'
    && term.url === SITE + '/terms/dukkha_ru.html' && term.inLanguage === 'ru' && typeof term.description === 'string' && term.description.length > 20
    && term.inDefinedTermSet && term.inDefinedTermSet.url === SITE + '/', JSON.stringify(term));
  check('JSON-LD: description термина совпадает с meta description (без HTML-сущностей)', !!term && !!desc && term.description === desc.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'));
  const termTh = byType(cardTh, 'DefinedTerm'), crumbsTh = byType(cardTh, 'BreadcrumbList');
  check('JSON-LD thai: язык th, крошки ведут на тайский навигатор', !!termTh && termTh.inLanguage === 'th' && !!crumbsTh && crumbsTh.itemListElement[0].item === SITE + '/nav/nav_thai.html');
  check('JSON-LD: нет на заглушке «перевод отсутствует»', ld(rd(root, 'terms/' + ONLY_RU + '_thai.html')).length === 0);
  check('JSON-LD: «</script>» в тексте экранирован (разметка не ломается)', !/<\/script>[^<]*<\/script>/.test(card.split('application/ld+json')[1] || '') && ld(card).every(x => !x.__bad));
  const site = byType(rd(root, 'index.html'), 'WebSite');
  check('JSON-LD: первая страница навигатора — WebSite (имя, адрес, язык)', !!site && site.url === SITE + '/' && site.name === 'Навигатор по палийским терминам' && site.inLanguage === 'ru', JSON.stringify(site));
  const siteTh = byType(rd(root, 'nav/nav_thai.html'), 'WebSite');
  check('JSON-LD: тайский навигатор — WebSite на своём адресе', !!siteTh && siteTh.url === SITE + '/nav/nav_thai.html' && siteTh.inLanguage === 'th');
  check('JSON-LD: на страницах навигатора 2+ разметки WebSite нет', !byType(rd(root, 'nav/nav_ru_2.html'), 'WebSite'));

  const ogOk = (h, l) => meta(h, 'og:image') === SITE + '/img/og-' + l + '.png' && meta(h, 'og:image:width') === '1200' && meta(h, 'og:image:height') === '630'
    && !!meta(h, 'og:image:alt') && meta(h, 'twitter:card') === 'summary_large_image';
  check('og:image: карточка ru — og-ru.png 1200×630, alt, twitter:card', ogOk(card, 'ru'), [meta(card, 'og:image'), meta(card, 'twitter:card')].join(' '));
  check('og:image: карточка thai — og-thai.png', ogOk(cardTh, 'thai'));
  check('og:image: навигатор ru (все страницы) и thai', ogOk(rd(root, 'index.html'), 'ru') && ogOk(rd(root, 'nav/nav_ru_2.html'), 'ru') && ogOk(rd(root, 'nav/nav_thai.html'), 'thai'));
  check('og:image: на заглушке нет', meta(rd(root, 'terms/' + ONLY_RU + '_thai.html'), 'og:image') === null);
}
check('og:image: картинки img/og-ru.png и img/og-thai.png в репозитории, 1200×630', ['ru', 'thai'].every(l => {
  const f = path.join(REPO, 'img/og-' + l + '.png');
  if (!fs.existsSync(f)) return false;
  const b = fs.readFileSync(f);
  return b.readUInt32BE(16) === 1200 && b.readUInt32BE(20) === 630 && b.length < 300 * 1024;
}));

// ---------- 3. check-sources.js ----------
let cs = null, csErr = '';
try { cs = require('./check-sources.js'); } catch (e) { csErr = e.message; }
check('check-sources.js загружается и экспортирует checkLocation, checkTerms', !!(cs && cs.checkLocation && cs.checkTerms), csErr);
const warnOf = loc => { try { return cs.checkLocation(loc); } catch (e) { return 'ОШИБКА ' + e.message; } };
const OK = ['Majjhima Nikāya 118', 'Dīgha Nikāya 34', 'Saṃyutta Nikāya 56.11', 'Samyutta Nikāya 12.1', 'Saṁyutta Nikāya 22.59', 'Aṅguttara Nikāya 10.60',
  'Aṅguttara Nikāya 4.1–4.5', 'Sutta Nipāta 1.8; Khuddakapāṭha 9', 'Dhammapada 1–20', 'Itivuttaka 112', 'Udāna 8.1–8.4', 'Маджхима-никая 118', 'Ангуттара-никая 4.1',
  'статья «Magga»', 'Visuddhimagga XVI', 'Vinaya Mahāvagga I.6 (Vin I 10)', 'Majjhima Nikāya 141 (MN 141)', 'Khuddaka Nikāya, Petavatthu'];
const BAD = [['', 'пусто'], ['   ', 'пусто'], ['VII.3–5', 'нет названия'], ['1.2.3', 'нет названия'], ['Majjhima Nikāya 153', 'MN 1–152'], ['Majjhima Nikāya 0', 'MN 1–152'],
  ['Dīgha Nikāya 35', 'DN 1–34'], ['Saṃyutta Nikāya 57.1', 'SN 1–56'], ['Aṅguttara Nikāya 12.1', 'AN 1–11'], ['Маджхима-никая 200', 'MN 1–152'],
  ['Dhammapada 424', 'Dhp 1–423'], ['Khuddakapāṭha 10', 'Khp 1–9'], ['Sutta Nipāta 6.1', 'Sn 1–5'], ['Itivuttaka 113', 'Iti 1–112'], ['Udāna 9.1', 'Ud 1–8'],
  ['Majjhima Nikāya 10; Dīgha Nikāya 40', 'DN 1–34']];
check('check-sources: правильные ссылки без предупреждений', cs && OK.every(l => warnOf(l) === null), cs && OK.filter(l => warnOf(l) !== null).map(l => l + ' → ' + warnOf(l)).join(' | '));
check('check-sources: подозрительные ссылки — предупреждение с причиной', cs && BAD.every(([l, why]) => typeof warnOf(l) === 'string' && warnOf(l).includes(why)),
  cs && BAD.filter(([l, why]) => !(typeof warnOf(l) === 'string' && warnOf(l).includes(why))).map(([l]) => JSON.stringify(l) + ' → ' + warnOf(l)).join(' | '));
if (cs && cs.checkTerms) {
  const w = cs.checkTerms({ dukkha_ru: { sources: [{ location: 'Majjhima Nikāya 200' }, { location: 'Majjhima Nikāya 1' }] }, sila_thai: { sources: [{ location: '' }] }, x_ru: {} });
  check('check-sources: checkTerms — файл, номер источника и причина', Array.isArray(w) && w.length === 2 && w[0].file === 'dukkha_ru.json' && w[0].index === 1 && w[1].file === 'sila_thai.json',
    JSON.stringify(w));
}
{
  const cli = path.join(__dirname, 'check-sources.js');
  const r = fs.existsSync(cli) ? spawnSync(process.execPath, [cli], { cwd: REPO, encoding: 'utf8' }) : { status: -1, stdout: '' };
  check('check-sources: запуск на репозитории не падает (код 0, только предупреждения)', r.status === 0 && /Ссылок проверено: \d+/.test(r.stdout), r.status + ' ' + (r.stdout || '').slice(-200));
}
{
  const wf = fs.readFileSync(path.join(REPO, '.github/workflows/build-terms.yml'), 'utf8');
  check('build-terms.yml: тесты и проверка ссылок на источники перед сборкой', /node \.github\/scripts\/test-terms\.js/.test(wf) && /node \.github\/scripts\/check-sources\.js/.test(wf));
}

console.log(failed ? 'ПРОВАЛЕНО: ' + failed + ', пройдено: ' + passed : 'ВСЕ ТЕСТЫ ПРОЙДЕНЫ: ' + passed);
process.exitCode = failed ? 1 : 0;
