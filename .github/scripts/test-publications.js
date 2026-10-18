'use strict';
// Автотесты build-publications.js: запуск `node .github/scripts/test-publications.js`.
// Каждый тест строит свежую временную папку с поддельными терминами, обложками и файлами публикаций;
// реальные файлы репозитория не меняются.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { build } = require('./build-publications.js');

const REPO = path.resolve(__dirname, '../..');
const REAL_TPL = path.join(REPO, '_src/publications/template');
let passed = 0, failed = 0;

function check(name, cond, extra) {
  if (cond) passed++; else { failed++; console.error('ПРОВАЛ: ' + name + (extra ? ' — ' + extra : '')); }
}

// Минимальные «картинки»: достаточно сигнатуры и размеров
function png(w, h, pad) {
  const b = Buffer.alloc(24 + (pad || 0));
  Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]).copy(b, 0);
  b.writeUInt32BE(13, 8); b.write('IHDR', 12); b.writeUInt32BE(w, 16); b.writeUInt32BE(h, 20);
  return b;
}
function jpg(w, h) {
  const b = Buffer.alloc(40);
  Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x04, 0x00, 0x00, 0xFF, 0xC0, 0x00, 0x11, 0x08]).copy(b, 0);
  b.writeUInt16BE(h, 13); b.writeUInt16BE(w, 15);
  return b;
}

// files = { json: {имя: объект|строка}, html: {имя: строка}, covers: {имя: Buffer} }
function makeEnv(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pubs-'));
  const termsDir = path.join(root, 'site'), pubDir = path.join(termsDir, 'publications');
  const srcDir = path.join(termsDir, '_src/publications');
  ['json', '_src/publications/json', '_src/publications/html', 'publications/covers', '_src/publications/template']
    .forEach(d => fs.mkdirSync(path.join(termsDir, d), { recursive: true }));
  for (let i = 1; i <= 3; i++) ['ru', 'thai'].forEach(l => fs.writeFileSync(path.join(termsDir, 'json', 't' + i + '_' + l + '.json'), '{}'));
  fs.writeFileSync(path.join(termsDir, 'json', 'onlyru_ru.json'), '{}');
  ['ru', 'thai'].forEach(l => fs.copyFileSync(path.join(REAL_TPL, '_layout_' + l + '.html'), path.join(srcDir, 'template', '_layout_' + l + '.html')));
  const wr = (dir, set) => Object.keys(set || {}).forEach(f => fs.writeFileSync(path.join(dir === 'covers' ? pubDir : srcDir, dir, f),
    typeof set[f] === 'string' || Buffer.isBuffer(set[f]) ? set[f] : JSON.stringify(set[f])));
  wr('json', files.json); wr('html', files.html); wr('covers', files.covers);
  if (files.stalePage) fs.writeFileSync(path.join(pubDir, 'stale.html'), 'old');
  const res = build({ termsDir, pubDir });
  res.pubDir = pubDir;
  res.has = f => fs.existsSync(path.join(pubDir, f));
  res.read = f => fs.readFileSync(path.join(pubDir, f), 'utf8');
  res.sitemap = fs.readFileSync(path.join(termsDir, 'sitemap_publications.xml'), 'utf8');
  res.codes = res.errors.map(e => e.code).sort((a, b) => a - b);
  return res;
}

const BODY = '<p>' + 'Достаточно длинный абзац текста для статьи. '.repeat(10) + '</p>';
const BODY_TH = '<p>' + 'ข้อความทดสอบสำหรับบทความที่ยาวพอสมควร '.repeat(12) + '</p>';
const tile = (o) => Object.assign({ cover: 'c1.png', headline: 'Заголовок статьи', lead: 'Короткий лид статьи.', html: 'a-one.html' }, o);
const tileTh = (o) => Object.assign({ cover: 'c1.png', headline: 'หัวข้อบทความ', lead: 'คำโปรยสั้น ๆ ของบทความ', html: 'b-one.html' }, o);
const cov = () => ({ 'c1.png': png(1200, 630) });
const one = (html, extra) => makeEnv(Object.assign({ json: { 'publication_1_ru.json': tile() }, html: { 'a-one.html': html }, covers: cov() }, extra || {}));
const count = (s, sub) => s.split(sub).length - 1;

// 1. Валидная публикация ru
{
  const r = one(BODY);
  check('валидная: без ошибок и предупреждений', r.errors.length === 0 && r.warnings.length === 0, JSON.stringify(r.errors.concat(r.warnings)));
  check('валидная: страницы', r.has('index.html') && r.has('publications_thai.html') && r.has('a-one.html'));
  check('заглушка publications_ru.html ведёт на /publications/', r.has('publications_ru.html') && r.read('publications_ru.html').includes('<link rel="canonical" href="https://indapanno.github.io/publications/">') && r.read('publications_ru.html').includes('http-equiv="refresh"') && !r.read('publications_ru.html').includes('noindex') && !r.pages.includes('publications_ru.html') && !r.sitemap.includes('publications_ru'));
  const a = r.read('a-one.html');
  check('статья: единственный h1 из headline', count(a, '<h1') === 1 && a.includes('<h1 id="page-title">Заголовок статьи</h1>'));
  check('статья: canonical, og:image, description', a.includes('<link rel="canonical" href="https://indapanno.github.io/publications/a-one.html">')
    && a.includes('<meta property="og:image" content="https://indapanno.github.io/publications/covers/c1.png">')
    && a.includes('<meta name="description" content="Короткий лид статьи.">') && a.includes('<meta property="og:type" content="article">'));
  check('статья: без hreflang и noindex', !a.includes('hreflang') && !a.includes('noindex'));
  check('статья: пути к общим файлам', a.includes('href="/css/style.css"') && a.includes('href="/css/publications.css"') && a.includes('src="/js/lang.js"') && !a.includes('../'));
  check('статья: крошки', a.includes('<a href="/">Навигатор по терминам</a><span class="sep">/</span><a href="/publications/">Публикации</a><span class="sep">/</span><span class="current">Заголовок статьи</span>'));
  check('статья: нет ссылки «назад» внизу', !a.includes('К публикациям'));
  check('статья: без времени чтения', !a.includes('Время чтения') && !a.includes('pub-meta'));
  const l = r.read('index.html');
  check('список ru: плитка со ссылкой, обложкой и лидом', l.includes('href="/publications/a-one.html"') && l.includes('src="/publications/covers/c1.png"') && l.includes('Короткий лид статьи.'));
  check('список ru: призыв «Читать далее» в плитке', count(l, '<span class="pub-tile-more">Читать далее</span>') === 1);
  check('список ru: canonical и description, без noindex', l.includes('rel="canonical"') && l.includes('name="description"') && !l.includes('noindex'));
  check('список: нет блока вводного текста', !l.includes('header-intro'));
  const t = r.read('publications_thai.html');
  check('пустой язык: сообщение, noindex, без canonical', t.includes('ยังไม่มีบทความ') && t.includes('noindex') && !t.includes('canonical'));
  check('sitemap: статья и список ru, без пустого thai', r.sitemap.includes('/publications/a-one.html') && r.sitemap.includes('<loc>https://indapanno.github.io/publications/</loc>') && !r.sitemap.includes('publications_ru') && !r.sitemap.includes('publications_thai'));
  check('нет незаполненных меток', r.pages.every(f => !/\{\{[A-Z0-9]+\}\}/.test(r.read(f))));
}

// 2. Порядок и пагинация: 11 публикаций, новая первая
{
  const json = {}, html = {};
  for (let i = 1; i <= 11; i++) { json['publication_' + i + '_ru.json'] = tile({ headline: 'Статья номер ' + i, html: 'art-' + i + '.html' }); html['art-' + i + '.html'] = BODY; }
  const r = makeEnv({ json, html, covers: cov() });
  const p1 = r.read('index.html'), p2 = r.read('publications_ru_2.html');
  check('11 публикаций: две страницы списка', r.has('publications_ru_2.html') && !r.has('publications_ru_3.html'));
  check('10 плиток на первой, 1 на второй', count(p1, 'class="pub-tile"') === 10 && count(p2, 'class="pub-tile"') === 1);
  check('новая сверху', p1.indexOf('Статья номер 11') < p1.indexOf('Статья номер 10') && p1.indexOf('Статья номер 10') < p1.indexOf('Статья номер 2'));
  check('на второй странице самая старая', p2.includes('Статья номер 1<'));
  check('пагинация и prev/next', p1.includes('class="pagination"') && p1.includes('rel="next"') && !p1.includes('rel="prev"') && p2.includes('rel="prev"') && !p2.includes('rel="next"'));
  check('вторая страница: canonical на себя', p2.includes('/publications/publications_ru_2.html">') && p2.includes('— страница 2'));
  check('sitemap: обе страницы списка и 11 статей', r.sitemap.includes('publications_ru_2.html') && count(r.sitemap, '<loc>') === 13);
}

// 3. Ошибки JSON и файлов: плитка не создаётся
{
  const bad = (name, files, code, noPage) => {
    const r = makeEnv(files);
    check(name + ': код ' + code, r.codes.includes(code), JSON.stringify(r.codes));
    check(name + ': страница не создана', !r.has(noPage || 'a-one.html'));
    return r;
  };
  const base = (j, extra) => Object.assign({ json: { 'publication_1_ru.json': j }, html: { 'a-one.html': BODY }, covers: cov() }, extra || {});
  bad('1 имя JSON', { json: { 'pub_1.json': tile() }, html: { 'a-one.html': BODY }, covers: cov() }, 1);
  bad('2 невалидный JSON', base('{"cover": '), 2);
  bad('3 нет ключа', base({ cover: 'c1.png', headline: 'Заголовок', lead: 'Лид' }), 3);
  bad('3 лишний ключ', base(tile({ date: '2026' })), 3);
  bad('4 пустое значение', base(tile({ lead: '  ' })), 4);
  bad('5 путь в cover', base(tile({ cover: 'sub/c1.png' })), 5);
  bad('5 имя статьи с подчёркиванием', base(tile({ html: 'publications_ru.html' })), 5);
  bad('5 имя статьи с заглавными', base(tile({ html: 'Art.html' })), 5);
  bad('15 имя статьи index', { json: { 'publication_1_ru.json': tile({ html: 'index.html' }) }, html: { 'index.html': BODY }, covers: cov() }, 15, 'x-never.html');
  bad('6 нет обложки', base(tile({ cover: 'nope.png' })), 6);
  bad('7 нет статьи', base(tile({ html: 'missing.html' })), 7);
  bad('8 обложка не картинка', base(tile(), { covers: { 'c1.png': Buffer.from('это не картинка, просто текст в файле') } }), 8);
  bad('8 обложка gif', base(tile({ cover: 'c1.gif' }), { covers: { 'c1.gif': Buffer.from('GIF89a') } }), 8);
  bad('8 обложка больше 1 МБ', base(tile(), { covers: { 'c1.png': png(1200, 630, 1024 * 1024) } }), 8);
  bad('9 язык headline', base(tile({ headline: 'English headline' })), 9);
  bad('9 тайский файл с кириллицей', { json: { 'publication_1_thai.json': tile({ html: 'b-one.html' }) }, html: { 'b-one.html': BODY_TH }, covers: cov() }, 9, 'b-one.html');
  const dup = makeEnv({
    json: { 'publication_1_ru.json': tile(), 'publication_2_ru.json': tile({ headline: 'Другой заголовок' }) },
    html: { 'a-one.html': BODY }, covers: cov()
  });
  check('10 одна статья в двух JSON: код 10 и страницы нет', dup.codes.includes(10) && !dup.has('a-one.html'));
  bad('12 пустая статья', { json: { 'publication_1_ru.json': tile() }, html: { 'a-one.html': '   ' }, covers: cov() }, 12);
  // ошибка одной публикации не блокирует другие
  const mix = makeEnv({
    json: { 'publication_1_ru.json': tile(), 'publication_2_ru.json': tile({ cover: 'nope.png', html: 'a-two.html' }) },
    html: { 'a-one.html': BODY, 'a-two.html': BODY }, covers: cov()
  });
  check('ошибка одной не блокирует другие', mix.has('a-one.html') && !mix.has('a-two.html') && mix.published.ru.length === 1);
}

// 4. Проверка HTML-фрагмента
{
  const bad = (name, html) => {
    const r = one(html);
    check('статья: ' + name + ' → код 11, страницы нет', r.codes.includes(11) && !r.has('a-one.html'), JSON.stringify(r.errors));
  };
  bad('script', BODY + '<script>alert(1)</script>');
  bad('style', BODY + '<style>p{color:red}</style>');
  bad('iframe', BODY + '<iframe src="https://x"></iframe>');
  bad('h1', '<h1>Заголовок</h1>' + BODY);
  bad('html/body', '<html><body>' + BODY + '</body></html>');
  bad('style=""', '<p style="color:red">текст</p>' + BODY);
  bad('onclick', '<p onclick="x()">текст</p>' + BODY);
  bad('class на p', '<p class="big">текст</p>' + BODY);
  bad('id', '<h2 id="x">Заголовок</h2>' + BODY);
  bad('незакрытый тег', '<p>текст' + BODY);
  bad('неверная вложенность', '<p><strong>текст</p></strong>' + BODY);
  bad('лишний <', '<p>если a < b то</p>' + BODY);
  bad('a без href', '<p><a>текст</a></p>' + BODY);
  bad('javascript: в href', '<p><a href="javascript:alert(1)">текст</a></p>' + BODY);
  bad('http: в href', '<p><a href="http://example.com">текст</a></p>' + BODY);
  bad('href и data-term вместе', '<p><a href="https://x.y" data-term="t1">текст</a></p>' + BODY);
  bad('img без alt', '<figure><img src="c1.png"></figure>' + BODY);
  bad('img с внешним src', '<figure><img src="https://x.y/a.png" alt="а"></figure>' + BODY);
  bad('aside с чужим class', '<aside class="warning"><p>х</p></aside>' + BODY);
  bad('b вместо strong', '<p><b>текст</b></p>' + BODY);
  bad('служебный мусор [cite: 2]', '<p>Текст статьи[cite: 2].</p>' + BODY);
  bad('служебный мусор в конце файла', BODY + 'хвост【4:0†source】');
  bad('служебный мусор oaicite', '<p>Текст :oaicite{index=1}</p>' + BODY);
  const sq = one('<p>Обычные [квадратные скобки] и [1] в тексте.</p>' + BODY);
  check('обычные квадратные скобки проходят', sq.errors.length === 0);
  const ok = one('<p>строка<br>вторая, x<sup>2</sup>, H<sub>2</sub>O, <small>мелко</small>, <code>код</code></p>' + BODY + '<!-- комментарий -->');
  check('разрешённые br/sup/sub/small/code и комментарий проходят', ok.errors.length === 0 && ok.read('a-one.html').includes('<br>') && !ok.read('a-one.html').includes('комментарий'));
}

// 5. Компоненты: преобразования
{
  const html = '<h2>Один</h2>' + BODY + '<h3>Под</h3><h2>Два</h2><h2>Три</h2>'
    + '<aside class="callout callout--key"><p>к</p></aside><aside class="callout callout--practice"><p>п</p></aside><aside class="callout callout--important"><p>в</p></aside><aside class="callout"><p>о</p></aside>'
    + '<table><tr><td>1</td></tr></table>'
    + '<p><a data-term="t1">термин</a> <a href="https://example.com/x?a=1&b=2">внешняя</a> <a href="#s1">якорь</a></p>'
    + '<figure><img src="c1.png" alt="Рисунок &quot;один&quot;"><figcaption>Подпись</figcaption></figure>';
  const r = one(html);
  const a = r.read('a-one.html');
  check('компоненты: без ошибок', r.errors.length === 0, JSON.stringify(r.errors));
  check('заголовки: якоря s1..s4 по порядку', a.includes('<h2 id="s1">Один</h2>') && a.includes('<h3 id="s2">Под</h3>') && a.includes('<h2 id="s3">Два</h2>') && a.includes('<h2 id="s4">Три</h2>'));
  check('оглавление при 3 h2', a.includes('class="pub-toc"') && a.includes('<a href="#s1">Один</a>') && a.includes('<a href="#s4">Три</a>') && !a.includes('href="#s2">Под'));
  check('выноски: заголовки ru', a.includes('callout-title">Ключевая мысль<') && a.includes('callout-title">Практика<') && a.includes('callout-title">Важно<'));
  check('обычная выноска без заголовка', a.includes('<aside class="callout"><p>о</p>'));
  check('таблица в контейнере прокрутки', a.includes('<div class="table-scroll"><table>') && a.includes('</table></div>'));
  check('data-term → адрес карточки', a.includes('<a href="/terms/t1_ru.html">термин</a>'));
  check('внешняя ссылка: новая вкладка и rel', a.includes('href="https://example.com/x?a=1&b=2" target="_blank" rel="noopener noreferrer"'));
  check('якорная ссылка без target', a.includes('<a href="#s1">якорь</a>'));
  check('картинка: путь, размеры, lazy', a.includes('<img src="/publications/covers/c1.png" alt="Рисунок &quot;один&quot;" width="1200" height="630" loading="lazy">'));
  const two = one('<h2>Один</h2>' + BODY + '<h2>Два</h2>');
  check('оглавления нет при двух h2', !two.read('a-one.html').includes('pub-toc'));
}

// 6. Мягкие ошибки: статья публикуется
{
  const r = one('<p>Битая <a data-term="net-takogo">ссылка</a> и <a data-term="onlythai">без перевода</a> и ещё <em>текст</em>.</p>' + BODY
    + '<figure><img src="gone.png" alt="нет файла"><figcaption>Подпись</figcaption></figure>');
  const a = r.read('a-one.html');
  check('мягкие ошибки: статья опубликована', r.has('a-one.html') && r.published.ru.length === 1);
  check('мягкие ошибки: коды 13 (×2) и 14, все soft', r.codes.join() === '13,13,14' && r.errors.every(e => e.soft));
  check('битая ссылка → обычный текст', a.includes('Битая ссылка и без перевода и ещё') && !a.includes('data-term') && !a.includes('net-takogo'));
  check('рисунок пропущен, подпись осталась', !a.includes('gone.png') && a.includes('<figcaption>Подпись</figcaption>'));
  check('мягкие ошибки: плитка в списке и sitemap', r.read('index.html').includes('a-one.html') && r.sitemap.includes('a-one.html'));
}

// 7. Предупреждения
{
  const r = makeEnv({
    json: { 'publication_1_ru.json': tile({ headline: 'Д'.repeat(130), lead: 'Л'.repeat(410) }) },
    html: { 'a-one.html': '<p>Коротко.</p>', 'orphan.html': BODY },
    covers: { 'c1.png': jpg(800, 800) }
  });
  const w = r.warnings.map(x => x.msg).join('|');
  check('предупреждения: длинный headline и lead', w.includes('«headline» длиннее') && w.includes('«lead» длиннее'));
  check('предупреждения: короткая статья, узкая обложка, статья без JSON', w.includes('короче 300') && w.includes('обложка уже 1200') && w.includes('статья без JSON'));
  check('предупреждения не блокируют публикацию', r.errors.length === 0 && r.has('a-one.html') && !r.has('orphan.html'));
  const ratio = makeEnv({ json: { 'publication_1_ru.json': tile() }, html: { 'a-one.html': BODY }, covers: { 'c1.png': png(1600, 1600) } });
  check('предупреждение: пропорция обложки', ratio.warnings.some(x => x.msg.includes('пропорция')) && ratio.errors.length === 0);
  const jp = makeEnv({ json: { 'publication_1_ru.json': tile({ cover: 'c1.jpg' }) }, html: { 'a-one.html': BODY }, covers: { 'c1.jpg': jpg(1200, 630) } });
  check('jpg 1200×630 принимается без предупреждений', jp.errors.length === 0 && jp.warnings.length === 0, JSON.stringify(jp.warnings));
}

// 8. Тайский язык
{
  const r = makeEnv({ json: { 'publication_1_thai.json': tileTh() }, html: { 'b-one.html': BODY_TH + '<aside class="callout callout--key"><p>ก</p></aside><p><a data-term="t2">คำ</a></p>' }, covers: cov() });
  const a = r.read('b-one.html');
  check('thai: без ошибок', r.errors.length === 0, JSON.stringify(r.errors));
  check('thai: без времени чтения', !a.includes('เวลาอ่าน') && !a.includes('pub-meta'));
  check('thai: призыв «อ่านต่อ» в плитке', r.read('publications_thai.html').includes('<span class="pub-tile-more">อ่านต่อ</span>'));
  check('thai: выноска и ссылка на термин', a.includes('callout-title">ประเด็นสำคัญ<') && a.includes('href="/terms/t2_thai.html"'));
  check('thai: крошки', a.includes('<a href="/nav/nav_thai.html">นำทางคำศัพท์</a><span class="sep">/</span><a href="/publications/publications_thai.html">บทความ</a>'));
  check('thai: русский список пуст и закрыт', r.read('index.html').includes('noindex') && r.sitemap.includes('/publications/publications_thai.html') && !r.sitemap.includes('<loc>https://indapanno.github.io/publications/</loc>'));
  check('thai: og:locale', a.includes('content="th_TH"'));
}

// 9. Служебное поведение
{
  const r = one(BODY, { stalePage: true });
  check('publications/*.html пересобирается: устаревшая страница удалена', !r.has('stale.html'));
  check('covers/ не тронута при пересборке', fs.existsSync(path.join(r.pubDir, 'covers', 'c1.png')));
  const e = makeEnv({ json: {}, html: {}, covers: {} });
  check('пустой репозиторий публикаций: без ошибок, списки закрыты, sitemap без адресов',
    e.errors.length === 0 && e.read('index.html').includes('noindex') && !e.sitemap.includes('<loc>'));
}

console.log('Пройдено: ' + passed + ', провалено: ' + failed);
if (failed) process.exit(1);
