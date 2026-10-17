'use strict';
// Автотесты build-bundles.js: запуск `node .github/scripts/test-bundles.js`.
// Каждый тест строит свежую временную папку с поддельными терминами и файлами связок;
// реальные файлы репозитория не меняются.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { build } = require('./build-bundles.js');

const REPO = path.resolve(__dirname, '../..');
const REAL_TPL = path.join(REPO, '_src/bundle/template');
let passed = 0, failed = 0;

function check(name, cond, extra) {
  if (cond) passed++; else { failed++; console.error('ПРОВАЛ: ' + name + (extra ? ' — ' + extra : '')); }
}

// Термины: t1..t30 на обоих языках, onlyru — только русский, onlythai — только тайский
function makeEnv(files, htmlFiles) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bundles-'));
  const termsDir = path.join(root, 'site'), bundleDir = path.join(termsDir, 'bundle');
  const srcDir = path.join(termsDir, '_src/bundle');
  ['json', '_src/bundle/json', '_src/bundle/template', 'bundle'].forEach(d => fs.mkdirSync(path.join(termsDir, d), { recursive: true }));
  const put = (lang, id, n) => fs.writeFileSync(path.join(termsDir, 'json', id + '_' + lang + '.json'),
    JSON.stringify({ term_ru: 'термин ' + n, term_thai: 'คำ ' + n, interpretation: 'толкование ' + n, later_mentions: n % 2 ? [1] : [] }));
  for (let i = 1; i <= 30; i++) { put('ru', 't' + i, i); put('thai', 't' + i, i); }
  put('ru', 'onlyru', 'x'); put('thai', 'onlythai', 'y');
  ['ru', 'thai'].forEach(l => fs.copyFileSync(path.join(REAL_TPL, '_layout_' + l + '.html'), path.join(srcDir, 'template', '_layout_' + l + '.html')));
  Object.keys(files).forEach(f => fs.writeFileSync(path.join(srcDir, 'json', f), typeof files[f] === 'string' ? files[f] : JSON.stringify(files[f])));
  Object.keys(htmlFiles || {}).forEach(f => fs.writeFileSync(path.join(bundleDir, f), htmlFiles[f]));
  const res = build({ termsDir, bundleDir });
  res.has = f => fs.existsSync(path.join(bundleDir, f));
  res.read = f => fs.readFileSync(path.join(bundleDir, f), 'utf8');
  res.codes = res.errors.map(e => e.code).sort((a, b) => a - b);
  res.termsDir = termsDir;
  return res;
}

const ids = n => Array.from({ length: n }, (_, i) => 't' + (i + 1));
const ru = (terms, o) => Object.assign({ name: 'Тема', description: 'Описание темы', terms: terms || ['t1', 't2', 't3'] }, o);
const th = (terms, o) => Object.assign({ name: 'หัวข้อ', description: 'คำอธิบาย', terms: terms || ['t1', 't2', 't3'] }, o);
const count = (s, sub) => s.split(sub).length - 1;

// 1. Валидная пара
{
  const r = makeEnv({ 'bundle_1_ru.json': ru(), 'bundle_1_thai.json': th() });
  check('валидная пара: без ошибок', r.errors.length === 0);
  check('валидная пара: страницы связки и списки', ['bundle_1_ru.html', 'bundle_1_thai.html', 'index.html', 'bundles_thai.html'].every(r.has));
  check('заглушка bundles_ru.html ведёт на /bundle/', r.has('bundles_ru.html') && r.read('bundles_ru.html').includes('<link rel="canonical" href="https://indapanno.github.io/bundle/">') && r.read('bundles_ru.html').includes('http-equiv="refresh"') && !r.read('bundles_ru.html').includes('noindex') && !r.pages.includes('bundles_ru.html'));
  check('валидная пара: плитка в списке ru', r.read('index.html').includes('href="/bundle/bundle_1_ru.html"') && r.read('index.html').includes('3 термина'));
  check('валидная пара: тайские цифры', r.read('bundles_thai.html').includes('จำนวน ๓ คำ'));
  const p = r.read('bundle_1_ru.html');
  check('страница связки: пути к общим файлам', p.includes('href="/css/style.css"') && p.includes('src="/js/lang.js"') && p.includes('href="/terms/t1_ru.html"') && !p.includes('../'));
  check('страница связки: порядок терминов', p.indexOf('t1_ru') < p.indexOf('t2_ru') && p.indexOf('t2_ru') < p.indexOf('t3_ru'));
  check('крошки на странице связки (ru)', p.includes('<a href="/">Навигатор по терминам</a><span class="sep">/</span><a href="/bundle/">Связанные термины</a><span class="sep">/</span><span class="current">Тема</span>') && !p.includes('bundle-back'));
  check('крошки на странице связки (thai)', r.read('bundle_1_thai.html').includes('<a href="/nav_thai.html">นำทางคำศัพท์</a><span class="sep">/</span><a href="/bundle/bundles_thai.html">ชุดศัพท์ที่เกี่ยวข้อง</a><span class="sep">/</span><span class="current">หัวข้อ</span>'));
  check('крошки на списке: последний элемент без ссылки', r.read('index.html').includes('<a href="/">Навигатор по терминам</a><span class="sep">/</span><span class="current">Связанные термины</span>') && r.read('bundles_thai.html').includes('<span class="current">ชุดศัพท์ที่เกี่ยวข้อง</span>'));
  check('страница связки: кнопки «Изучен»', count(p, 'data-learned-id="t') === 3 && p.includes('id="learned-nav-note"'));
  check('все страницы: noindex, без canonical/hreflang', r.pages.every(f => { const h = r.read(f); return h.includes('<meta name="robots" content="noindex">') && !h.includes('canonical') && !h.includes('hreflang'); }));
  check('нет незаполненных меток', r.pages.every(f => !/\{\{[A-Z]+\}\}/.test(r.read(f))));
  check('sitemap не создаётся', !fs.existsSync(path.join(r.termsDir, 'sitemap.xml')));
}

// 2. Ошибки одиночных файлов (ожидаемый код → файл)
const single = [
  [1, { 'bundle_01_ru.json': ru() }], [1, { 'bundle_x_ru.json': ru() }], [1, { 'readme.txt': 'x' }],
  [2, { 'bundle_1_ru.json': '{oops' }], [2, { 'bundle_1_ru.json': '[1,2]' }],
  [3, { 'bundle_1_ru.json': { name: 'Тема', terms: ['t1', 't2'] } }],
  [4, { 'bundle_1_ru.json': ru(null, { extra: 1 }) }],
  [5, { 'bundle_1_ru.json': ru(null, { name: '  ' }) }], [5, { 'bundle_1_ru.json': ru(null, { description: 5 }) }],
  [6, { 'bundle_1_ru.json': ru(null, { terms: 'a,b' }) }], [6, { 'bundle_1_ru.json': ru(['t1', 7]) }],
  [7, { 'bundle_1_ru.json': ru(['t1']) }], [7, { 'bundle_1_ru.json': ru([]) }],
  [8, { 'bundle_1_ru.json': ru(['t1', 't2', 't1']) }],
  [9, { 'bundle_1_ru.json': ru(['t1', 'нет-такого']) }],
  [10, { 'bundle_1_ru.json': ru(['t1', 'onlythai']) }], [10, { 'bundle_1_thai.json': th(['t1', 'onlyru']) }],
  [12, { 'bundle_1_ru.json': ru(null, { name: 'Theme' }) }], [12, { 'bundle_1_thai.json': th(null, { description: 'Описание' }) }]
];
single.forEach(([code, files]) => {
  const r = makeEnv(files), nm = Object.keys(files)[0];
  check('ошибка №' + code + ' (' + nm + ')', r.codes.includes(code), 'получено: ' + r.codes);
  check('ошибка №' + code + ': связка не опубликована, заглушки нет', r.published.ru.length + r.published.thai.length === 0 && r.stubs.length === 0 && !r.pages.some(f => /^bundle_\d+_/.test(f)));
});
check('.gitkeep игнорируется', makeEnv({ '.gitkeep': '' }).errors.length === 0);

// 3. Пары
{
  const r = makeEnv({ 'bundle_1_ru.json': ru() });
  check('только ru: заглушка thai', r.has('bundle_1_thai.html') && r.stubs.length === 1 && r.errors.length === 0);
  check('заглушка: вёрстка term-card и крошки', r.read('bundle_1_thai.html').includes('class="term-card bundle-stub"') && r.read('bundle_1_thai.html').includes('<span class="current">ยังไม่มีคำแปล</span>') && !r.read('bundle_1_thai.html').includes('missing-translation'));
  check('только ru: заглушка не в списке thai, связка в списке ru', !r.read('bundles_thai.html').includes('bundle_1_thai') && r.read('index.html').includes('bundle_1_ru.html'));
  const s = r.read('bundle_1_thai.html');
  check('заглушка thai: ссылка на ru JSON и команда', s.includes('bundle_1_ru.json') && s.includes('bundle_1_thai.json') && s.includes('terms'));
}
{
  const r = makeEnv({ 'bundle_1_thai.json': th() });
  const s = r.read('bundle_1_ru.html');
  check('только thai: заглушка ru с инструкцией', r.stubs.length === 1 && s.includes('bundle_1_thai.json') && s.includes('Pull request') && s.includes('значения ключей name и description'));
}
{
  const r = makeEnv({ 'bundle_1_ru.json': ru(), 'bundle_1_thai.json': th(['t3', 't2', 't1']) });
  check('расхождение состава: ошибка 11, страниц нет', r.codes.join() === '11' && !r.pages.some(f => /^bundle_1_/.test(f)) && r.stubs.length === 0);
}
{
  const r = makeEnv({ 'bundle_1_ru.json': ru(), 'bundle_1_thai.json': th(null, { name: 'Theme' }) });
  check('ru валидна, thai с ошибкой: ru опубликована, thai без страницы и заглушки', r.codes.join() === '12' && r.has('bundle_1_ru.html') && !r.has('bundle_1_thai.html'));
}
{
  const r = makeEnv({ 'bundle_1_ru.json': ru(['t1']), 'bundle_2_ru.json': ru(null, { name: 'Вторая' }) });
  check('ошибка в одной связке не мешает другой', r.codes.join() === '7' && r.has('bundle_2_ru.html') && !r.has('bundle_1_ru.html'));
  check('нумерация с пропусками работает', r.read('index.html').includes('bundle_2_ru.html'));
}

// 4. Пагинация, числительные, экранирование
{
  const files = {};
  for (let n = 1; n <= 11; n++) files['bundle_' + n + '_ru.json'] = ru(null, { name: 'Тема ' + n });
  const r = makeEnv(files);
  check('список: 10 плиток на 1-й странице', count(r.read('index.html'), 'class="bundle-name"') === 10);
  check('список: 11-я на странице 2', r.has('bundles_ru_2.html') && count(r.read('bundles_ru_2.html'), 'class="bundle-name"') === 1 && r.read('index.html').includes('/bundle/bundles_ru_2.html'));
  check('список: новые сверху (по убыванию номера)', r.read('index.html').indexOf('bundle_10_ru') < r.read('index.html').indexOf('bundle_2_ru'));
  check('список: 1-я страница начинается с №11, 2-я содержит №1', r.read('index.html').indexOf('bundle_11_ru') < r.read('index.html').indexOf('bundle_10_ru') && r.read('bundles_ru_2.html').includes('bundle_1_ru.html'));
  check('список: класс bundle-list', r.read('index.html').includes('class="term-list bundle-list"'));
}
{
  const r = makeEnv({ 'bundle_1_ru.json': ru(ids(25)) });
  check('связка из 25 терминов: 3 страницы', r.has('bundle_1_ru_3.html') && !r.has('bundle_1_ru_4.html') && count(r.read('bundle_1_ru_3.html'), 'data-learned-id') === 5);
  check('связка: пагинация со ссылками', r.read('bundle_1_ru.html').includes('href="/bundle/bundle_1_ru_2.html"'));
  check('плитка: до 5 терминов + «и ещё»', r.read('index.html').includes('и ещё 20 терминов') && count(r.read('index.html'), 'Термин ') === 5);
}
{
  const t = n => makeEnv({ 'bundle_1_ru.json': ru(ids(n)) }).read('index.html');
  check('склонение: 2 термина, 5 терминов, 21 термин', t(2).includes('2 термина') && t(5).includes('5 терминов') && t(21).includes('21 термин<'));
  check('«и ещё 2 термина»', t(7).includes('и ещё 2 термина'));
  check('граница 5/6 терминов', t(6).includes('и ещё 1 термин<') && !t(5).includes('и ещё'));
}
{
  const r = makeEnv({ 'bundle_1_ru.json': ru(null, { name: 'Тема <b>x</b>' }) });
  check('экранирование HTML в названии', r.read('index.html').includes('Тема &lt;b&gt;x&lt;/b&gt;') && !r.read('index.html').includes('<b>x</b>'));
}

// 4б. Длинное описание: в плитке обрезается, на странице связки полное
{
  const long = 'слово '.repeat(60).trim();
  const r = makeEnv({ 'bundle_1_ru.json': ru(null, { description: long }), 'bundle_2_ru.json': ru(null, { description: 'Короткое описание' }) });
  const m = r.read('index.html').match(/<span class="bundle-desc">(.*?)<\/span>/g);
  const text = x => x.replace(/<[^>]+>/g, '');
  // порядок в списке: новые сверху, поэтому №2 (короткое) идёт первым, №1 (длинное) вторым
  check('плитка: длинное описание обрезано с «…»', text(m[1]).length <= 221 && text(m[1]).endsWith('…') && text(m[1]).length > 200, text(m[1]).length);
  check('плитка: короткое описание целиком, без «…»', text(m[0]) === 'Короткое описание');
  check('страница связки: описание полное', r.read('bundle_1_ru.html').includes(long));
}

// 5. Пустое состояние и уборка
{
  const r = makeEnv({}, { 'bundle_9_ru.html': 'old', 'bundles_ru_7.html': 'old', 'keep.txt': 'x' });
  check('пустой список: текст и без ошибок', r.errors.length === 0 && r.read('index.html').includes('Связанные термины пока не добавлены.') && r.read('bundles_thai.html').includes('ยังไม่มีชุดศัพท์ที่เกี่ยวข้อง'));
  check('уборка: старые страницы связок удалены, чужие файлы целы', !r.has('bundle_9_ru.html') && !r.has('bundles_ru_7.html') && r.has('keep.txt'));
}
{
  const r = makeEnv({ 'bundle_1_ru.json': ru() });
  const snap = d => fs.readdirSync(d, { withFileTypes: true }).filter(e => e.name !== 'bundle' && e.name !== '_src').map(e => e.name).sort().join();
  check('родительские файлы не тронуты (нет sitemap/html/nav)', snap(r.termsDir) === 'json');
}

console.log(failed ? 'ПРОВАЛЕНО: ' + failed + ', пройдено: ' + passed : 'ВСЕ ТЕСТЫ ПРОЙДЕНЫ: ' + passed);
process.exitCode = failed ? 1 : 0;
