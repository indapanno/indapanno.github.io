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

// Поддельное превью: пишет в dst метку «thumb:<имя исходника>:<ширина>», считает вызовы
let thumbCalls = 0;
const readSafe = f => fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
const copySafe = (a, b) => { if (fs.existsSync(a)) fs.copyFileSync(a, b); };
function fakeThumb(src, dst, w) { thumbCalls++; fs.writeFileSync(dst, 'thumb:' + path.basename(src) + ':' + w); return true; }

// files = { json: {имя: объект|строка}, html: {имя: строка}, covers: {имя: Buffer}, gallery: {имя: Buffer}, thumbnailer }
function makeEnv(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pubs-'));
  const termsDir = path.join(root, 'site'), pubDir = path.join(termsDir, 'publications');
  const srcDir = path.join(termsDir, '_src/publications');
  ['json', '_src/publications/json', '_src/publications/html', 'publications/covers', 'publications/gallery', '_src/publications/template']
    .forEach(d => fs.mkdirSync(path.join(termsDir, d), { recursive: true }));
  for (let i = 1; i <= 3; i++) ['ru', 'thai'].forEach(l => fs.writeFileSync(path.join(termsDir, 'json', 't' + i + '_' + l + '.json'), '{}'));
  fs.writeFileSync(path.join(termsDir, 'json', 'onlyru_ru.json'), '{}');
  Object.keys(files.terms || {}).forEach(f => fs.writeFileSync(path.join(termsDir, 'json', f), JSON.stringify(files.terms[f])));
  ['ru', 'thai'].forEach(l => fs.copyFileSync(path.join(REAL_TPL, '_layout_' + l + '.html'), path.join(srcDir, 'template', '_layout_' + l + '.html')));
  const wr = (dir, set) => Object.keys(set || {}).forEach(f => fs.writeFileSync(path.join(dir === 'covers' ? pubDir : srcDir, dir, f),
    typeof set[f] === 'string' || Buffer.isBuffer(set[f]) ? set[f] : JSON.stringify(set[f])));
  wr('json', files.json); wr('html', files.html); wr('covers', files.covers);
  Object.keys(files.gallery || {}).forEach(f => fs.writeFileSync(path.join(pubDir, 'gallery', f), files.gallery[f]));
  if (files.stalePage) fs.writeFileSync(path.join(pubDir, 'stale.html'), 'old');
  if (files.before) files.before(pubDir);
  // thumbnailer: функция (src, dst, w) => делает превью; false — инструмента нет; по умолчанию — поддельный, пишет метку
  const thumbnailer = files.thumbnailer === undefined ? fakeThumb : files.thumbnailer;
  const res = build({ termsDir, pubDir, thumbnailer });
  res.pubDir = pubDir;
  res.has = f => fs.existsSync(path.join(pubDir, f));
  res.read = f => fs.existsSync(path.join(pubDir, f)) ? fs.readFileSync(path.join(pubDir, f), 'utf8') : ''; // нет файла → пустая строка: тест краснеет, а не падает
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
  check('data-term → адрес карточки, новая вкладка', a.includes('<a href="/terms/t1_ru.html" target="_blank" rel="noopener noreferrer">термин</a>'));
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

// ===== Обогатители публикаций (widgets_TZ.md): поповер, чек-лист, вопросы и ответы, плитка =====
// Коды: 16 — неизвестный/неверно стоящий data-widget; 17 — чек-лист; 18 — вопросы и ответы; 19 — плитка (строгие);
// 20 — плитка на несуществующую публикацию (мягкая).
const W = {
  check: '<div data-widget="checklist"><ul><li>Действие 1</li><li>Действие <strong>2</strong></li></ul></div>',
  faq: '<div data-widget="faq">\n  <details><summary>Вопрос <em>один</em>?</summary><p>Ответ.</p></details>\n  <details><summary>Два?</summary><ul><li>а</li></ul><p>Ещё</p></details>\n</div>',
  tile: '<div data-widget="publication" data-publication="a-two.html"></div>'
};
// Две публикации ru: a-one (хозяин, html = host) и a-two (для плитки)
const pair = (host, extra) => makeEnv(Object.assign({
  json: { 'publication_1_ru.json': tile(), 'publication_2_ru.json': tile({ headline: 'Вторая статья', lead: 'Лид второй статьи.', html: 'a-two.html' }) },
  html: { 'a-one.html': host, 'a-two.html': BODY }, covers: cov()
}, extra || {}));
const noWidgetLeft = a => !a.includes('data-widget');

// 10. Чек-лист
{
  const r = one(BODY + W.check + '<h2>Раздел</h2>' + BODY + W.check);
  const a = r.read('a-one.html');
  check('чек-лист: без ошибок', r.errors.length === 0, JSON.stringify(r.errors));
  check('чек-лист: обёртка заменена, нет data-widget', a.includes('<div class="pub-check" data-check="1">') && noWidgetLeft(a));
  check('чек-лист: нумерация 1 и 2', a.includes('data-check="1"') && a.includes('data-check="2"') && count(a, 'class="pub-check"') === 2);
  const chk = (a.match(/<div class="pub-check"[\s\S]*?<\/ul><\/div>/) || [''])[0];
  check('чек-лист: без заголовков разделов и «Выполнено» (простой список)', chk.length > 50 && !chk.includes('pub-check-title') && !chk.includes('pub-check-done') && !chk.includes('hidden') && !chk.includes('Не выполнено') && !chk.includes('Выполнено'));
  check('чек-лист: пункты label+checkbox (работает без JS)', a.includes('<li><label><input type="checkbox"><span>Действие 1</span></label></li>') && a.includes('<span>Действие <strong>2</strong></span>'));
  check('чек-лист: разметка — один <ul class="pub-check-list"> в обёртке', a.includes('<div class="pub-check" data-check="1"><ul class="pub-check-list"><li>') && count(a, '<ul class="pub-check-list">') === 2);
  const th = makeEnv({ json: { 'publication_1_thai.json': tileTh() }, html: { 'b-one.html': BODY_TH + W.check }, covers: cov() });
  const b = th.read('b-one.html');
  check('чек-лист thai: без подписей разделов', th.errors.length === 0 && !b.includes('ยังไม่ได้ทำ') && !b.includes('ทำแล้ว') && b.includes('<ul class="pub-check-list">'), JSON.stringify(th.errors));
  const h = one('<h2>Один</h2>' + BODY + W.check + '<h2>Два</h2>' + BODY + '<h2>Три</h2>' + BODY);
  check('чек-лист между разделами: якоря s1..s3 и оглавление целы', h.errors.length === 0 && h.read('a-one.html').includes('<h2 id="s3">Три</h2>') && h.read('a-one.html').includes('class="pub-toc"'), JSON.stringify(h.errors));
}

// 11. Вопросы и ответы
{
  const r = one(BODY + W.faq);
  const a = r.read('a-one.html');
  check('faq: без ошибок', r.errors.length === 0, JSON.stringify(r.errors));
  check('faq: обёртка заменена', a.includes('<div class="pub-faq">') && noWidgetLeft(a) && count(a, 'class="pub-faq-item"') === 2);
  check('faq: вопрос и ответ в разметке', a.includes('<summary>Вопрос <em>один</em>?</summary><div class="pub-faq-answer"><p>Ответ.</p></div>'));
  check('faq: ответ со списком и абзацем', a.includes('<div class="pub-faq-answer"><ul><li>а</li></ul><p>Ещё</p></div>'));
  check('faq: details без open (свёрнуты)', !/<details[^>]*open/.test(a));
  const single = one(BODY + '<details><summary>Подробнее</summary><p>Скрытый текст.</p></details>');
  check('одиночный details вне faq работает как раньше', single.errors.length === 0 && single.read('a-one.html').includes('<details>') && !single.read('a-one.html').includes('pub-faq'), JSON.stringify(single.errors));
  const lk = makeEnv({ json: { 'publication_1_ru.json': tile() }, html: { 'a-one.html': BODY + '<div data-widget="faq"><details><summary>В?</summary><p>См. <a data-term="t1">термин</a> и <a href="https://example.com/">сайт</a>.</p></details></div>' }, covers: cov(), terms: { 't1_ru.json': { interpretation: 'Толкование.' } } });
  check('faq: ссылки в ответе (термин с поповером, https)', lk.errors.length === 0 && lk.read('a-one.html').includes('class="pub-term" data-interp="Толкование."') && lk.read('a-one.html').includes('href="https://example.com/" target="_blank"'), JSON.stringify(lk.errors));
}

// 12. Плитка публикации
{
  const r = pair(BODY + W.tile + '<p>между</p>' + W.tile);
  const a = r.read('a-one.html'), l = r.read('index.html');
  const listTile = (l.match(/<a class="pub-tile" href="\/publications\/a-two\.html">[\s\S]*?<\/a>/) || [''])[0];
  check('плитка: без ошибок', r.errors.length === 0, JSON.stringify(r.errors));
  check('плитка: обёртка и нет data-widget', a.includes('<div class="pub-tile-embed">') && noWidgetLeft(a));
  check('плитка: ровно как в списке публикаций', listTile.length > 50 && a.includes('<div class="pub-tile-embed">' + listTile + '</div>'));
  check('плитка: данные из JSON (обложка, заголовок, лид, призыв)', a.includes('src="/publications/covers/c1.png"') && a.includes('>Вторая статья<') && a.includes('Лид второй статьи.') && a.includes('>Читать далее<'));
  check('плитка: настоящая ссылка без target', a.includes('<a class="pub-tile" href="/publications/a-two.html">') && !/<a class="pub-tile"[^>]*target/.test(a));
  check('плитка: одну можно вставить несколько раз', count(a, 'class="pub-tile-embed"') === 2);
  check('плитка: статья-цель не изменилась', r.has('a-two.html') && !r.read('a-two.html').includes('pub-tile-embed'));
  const th = makeEnv({
    json: { 'publication_1_thai.json': tileTh(), 'publication_2_thai.json': tileTh({ headline: 'บทความที่สอง', lead: 'คำโปรยที่สอง', html: 'b-two.html' }) },
    html: { 'b-one.html': BODY_TH + '<div data-widget="publication" data-publication="b-two.html"></div>', 'b-two.html': BODY_TH }, covers: cov()
  });
  check('плитка thai: данные и «อ่านต่อ»', th.errors.length === 0 && th.read('b-one.html').includes('<div class="pub-tile-embed"><a class="pub-tile" href="/publications/b-two.html">') && th.read('b-one.html').includes('>บทความที่สอง<') && th.read('b-one.html').includes('>อ่านต่อ<'), JSON.stringify(th.errors));
  const plain = pair(BODY), withW = pair(BODY + W.tile + W.faq + W.check);
  check('sitemap не меняется от обогатителей', plain.sitemap === withW.sitemap);
  check('без обогатителей разметка виджетов не появляется', !plain.read('a-one.html').includes('pub-check') && !plain.read('a-one.html').includes('pub-faq') && !plain.read('a-one.html').includes('pub-tile-embed'));
}

// 13. Строгие ошибки 16–19: статья не создаётся, остальные публикуются
{
  const bad = (name, widget, code) => {
    const r = pair(BODY + widget);
    check(name + ': код ' + code + ' (не 11)', r.codes.includes(code) && !r.codes.includes(11) && r.errors.every(e => !e.soft || e.code !== code), JSON.stringify(r.codes));
    check(name + ': статья не создана, остальные созданы', !r.has('a-one.html') && r.has('a-two.html') && r.published.ru.length === 1);
  };
  bad('16 неизвестный data-widget', '<div data-widget="banner"><p>х</p></div>', 16);
  bad('16 пустой data-widget', '<div data-widget=""></div>', 16);
  bad('16 лишний атрибут class', '<div data-widget="checklist" class="x"><ul><li>а</li></ul></div>', 16);
  bad('16 лишний атрибут id', '<div data-widget="faq" id="q"><details><summary>В?</summary><p>О</p></details></div>', 16);
  bad('16 внутри aside', '<aside class="callout callout--key">' + W.check + '</aside>', 16);
  bad('16 внутри details', '<details><summary>Подробнее</summary>' + W.check + '</details>', 16);
  bad('16 внутри другой обёртки', '<div data-widget="faq"><details><summary>В?</summary>' + W.check + '</details></div>', 16);
  bad('17 чек-лист без ul', '<div data-widget="checklist"><p>текст</p></div>', 17);
  bad('17 чек-лист пустой', '<div data-widget="checklist"></div>', 17);
  bad('17 чек-лист: ul без li', '<div data-widget="checklist"><ul></ul></div>', 17);
  bad('17 чек-лист: два ul', '<div data-widget="checklist"><ul><li>а</li></ul><ul><li>б</li></ul></div>', 17);
  bad('17 чек-лист: ol вместо ul', '<div data-widget="checklist"><ol><li>а</li></ol></div>', 17);
  bad('17 чек-лист: абзац в li', '<div data-widget="checklist"><ul><li><p>а</p></li></ul></div>', 17);
  bad('17 чек-лист: вложенный список', '<div data-widget="checklist"><ul><li>а<ul><li>б</li></ul></li></ul></div>', 17);
  bad('17 чек-лист: пустой li', '<div data-widget="checklist"><ul><li> </li></ul></div>', 17);
  bad('18 faq: пусто', '<div data-widget="faq"></div>', 18);
  bad('18 faq: абзац вместо details', '<div data-widget="faq"><p>текст</p></div>', 18);
  bad('18 faq: пустой summary', '<div data-widget="faq"><details><summary> </summary><p>О</p></details></div>', 18);
  bad('18 faq: пустой ответ', '<div data-widget="faq"><details><summary>В?</summary></details></div>', 18);
  bad('18 faq: ссылка в summary', '<div data-widget="faq"><details><summary><a href="https://example.com/">В?</a></summary><p>О</p></details></div>', 18);
  bad('18 faq: заголовок в ответе', '<div data-widget="faq"><details><summary>В?</summary><h2>Х</h2></details></div>', 18);
  bad('18 faq: таблица в ответе', '<div data-widget="faq"><details><summary>В?</summary><table><tr><td>1</td></tr></table></details></div>', 18);
  bad('18 faq: рисунок в ответе', '<div data-widget="faq"><details><summary>В?</summary><figure><img src="c1.png" alt="а"></figure></details></div>', 18);
  bad('18 faq: обёртка внутри ответа', '<div data-widget="faq"><details><summary>В?</summary>' + W.tile + '</details></div>', 16);
  bad('19 плитка без data-publication', '<div data-widget="publication"></div>', 19);
  bad('19 плитка: неверный формат имени', '<div data-widget="publication" data-publication="Bad Name.html"></div>', 19);
  bad('19 плитка: путь в имени', '<div data-widget="publication" data-publication="../a-two.html"></div>', 19);
  bad('19 плитка: непустое содержимое', '<div data-widget="publication" data-publication="a-two.html"><p>х</p></div>', 19);
  bad('19 плитка: лишний атрибут', '<div data-widget="publication" data-publication="a-two.html" class="x"></div>', 16);
  const plainDiv = pair(BODY + '<div><p>х</p></div>');
  check('обычный div по-прежнему запрещён (код 11)', plainDiv.codes.includes(11) && !plainDiv.has('a-one.html'));
  // плитка на публикацию другого языка → 19
  const cross = makeEnv({
    json: { 'publication_1_ru.json': tile(), 'publication_1_thai.json': tileTh() },
    html: { 'a-one.html': BODY + '<div data-widget="publication" data-publication="b-one.html"></div>', 'b-one.html': BODY_TH }, covers: cov()
  });
  check('19 плитка ru → публикация thai: код 19, статья ru не создана, thai создана', cross.codes.includes(19) && !cross.has('a-one.html') && cross.has('b-one.html'), JSON.stringify(cross.codes));
  const cross2 = makeEnv({
    json: { 'publication_1_ru.json': tile(), 'publication_1_thai.json': tileTh() },
    html: { 'a-one.html': BODY, 'b-one.html': BODY_TH + '<div data-widget="publication" data-publication="a-one.html"></div>' }, covers: cov()
  });
  check('19 плитка thai → публикация ru: код 19', cross2.codes.includes(19) && !cross2.has('b-one.html') && cross2.has('a-one.html'), JSON.stringify(cross2.codes));
}

// 14. Мягкая ошибка 20: плитки нет, статья публикуется
{
  const r = pair(BODY + '<div data-widget="publication" data-publication="nope.html"></div>' + W.tile);
  const a = r.read('a-one.html');
  check('20: статья опубликована, плитка существующей на месте', r.has('a-one.html') && r.published.ru.length === 2 && count(a, 'class="pub-tile-embed"') === 1);
  check('20: код 20, мягкая, других ошибок нет', r.codes.join() === '20' && r.errors.every(e => e.soft), JSON.stringify(r.errors));
  check('20: несуществующая плитка не выводится, обёртки нет', !a.includes('nope.html') && noWidgetLeft(a));
  const broken = makeEnv({
    json: { 'publication_1_ru.json': tile(), 'publication_2_ru.json': tile({ cover: 'nope.png', html: 'a-two.html' }) },
    html: { 'a-one.html': BODY + W.tile, 'a-two.html': BODY }, covers: cov()
  });
  check('20: цель не создана из-за ошибки → мягкая 20, статья есть', broken.has('a-one.html') && !broken.has('a-two.html') && broken.codes.includes(20) && broken.errors.filter(e => e.code === 20).every(e => e.soft), JSON.stringify(broken.codes));
}

// 15. Поповер: ссылки на термины
{
  const terms = { 't1_ru.json': { interpretation: 'Толкование "один" & <b>.' }, 't2_ru.json': { interpretation: '   ' }, 't3_ru.json': { id: 't3' } };
  const r = makeEnv({ json: { 'publication_1_ru.json': tile() }, covers: cov(), terms,
    html: { 'a-one.html': BODY + '<p><a data-term="t1">один</a> <a data-term="t2">два</a> <a data-term="t3">три</a> <a data-term="net-takogo">битая</a></p>' } });
  const a = r.read('a-one.html');
  check('поповер: ссылка настоящая, новая вкладка, rel, class, data-interp экранирован',
    a.includes('<a href="/terms/t1_ru.html" target="_blank" rel="noopener noreferrer" class="pub-term" data-interp="Толкование &quot;один&quot; &amp; &lt;b&gt;.">один</a>'), a.match(/<a href="\/terms\/t1[^>]*>/));
  check('поповер: пустой interpretation → без data-interp, ссылка новая вкладка',
    a.includes('<a href="/terms/t2_ru.html" target="_blank" rel="noopener noreferrer">два</a>'));
  check('поповер: нет ключа interpretation → без data-interp',
    a.includes('<a href="/terms/t3_ru.html" target="_blank" rel="noopener noreferrer">три</a>') && count(a, 'data-interp=') === 1);
  check('поповер: нет nofollow', !a.includes('nofollow'));
  check('поповер: битая ссылка → код 13, текст', r.codes.join() === '13' && a.includes('битая') && !a.includes('net-takogo'), JSON.stringify(r.codes));
  const th = makeEnv({ json: { 'publication_1_thai.json': tileTh() }, covers: cov(), terms: { 't2_ru.json': { interpretation: 'русское толкование' }, 't2_thai.json': { interpretation: 'คำอธิบายภาษาไทย' } },
    html: { 'b-one.html': BODY_TH + '<p><a data-term="t2">คำ</a></p>' } });
  const b = th.read('b-one.html');
  check('поповер thai: толкование из тайской карточки', th.errors.length === 0 && b.includes('href="/terms/t2_thai.html" target="_blank" rel="noopener noreferrer" class="pub-term" data-interp="คำอธิบายภาษาไทย"') && !b.includes('русское'), JSON.stringify(th.errors));
  const fl = makeEnv({ json: { 'publication_1_ru.json': tile() }, covers: cov(), terms: { 't1_ru.json': { interpretation: 'Строка\nвторая   строка' } },
    html: { 'a-one.html': BODY + '<p><a data-term="t1">один</a></p>' } });
  check('поповер: перевод строки не ломает атрибут', fl.errors.length === 0 && !/data-interp="[^"]*\n/.test(fl.read('a-one.html')), JSON.stringify(fl.errors));
}

// 16. Поповер: название термина (data-title из term_ru / term_thai карточки)
{
  const terms = {
    't1_ru.json': { term_ru: 'путхуджана', interpretation: 'Толк.' },
    't2_ru.json': { term_ru: 'a"b & <c>   d', interpretation: 'Толк2.' },
    't3_ru.json': { term_ru: 'танха' },
    't4_ru.json': { interpretation: 'Без названия.' },
    't5_ru.json': { term_ru: '   ', interpretation: 'Пробелы.' },
    't6_ru.json': { term_ru: 'четыре истины', term_thai: 'ไม่ใช่', interpretation: 'Составное.' }
  };
  const r = makeEnv({ json: { 'publication_1_ru.json': tile() }, covers: cov(), terms,
    html: { 'a-one.html': BODY + '<p><a data-term="t1">1</a> <a data-term="t2">2</a> <a data-term="t3">3</a> <a data-term="t4">4</a> <a data-term="t5">5</a> <a data-term="t6">6</a></p>' } });
  const a = r.read('a-one.html');
  const L = 'target="_blank" rel="noopener noreferrer"';
  check('название: ru с заглавной, перед толкованием', a.includes('<a href="/terms/t1_ru.html" ' + L + ' class="pub-term" data-title="Путхуджана" data-interp="Толк.">1</a>'), (a.match(/<a href="\/terms\/t1[^>]*>/) || [])[0]);
  check('название: экранирование и пробелы', a.includes('data-title="A&quot;b &amp; &lt;c&gt; d" data-interp="Толк2."'), (a.match(/<a href="\/terms\/t2[^>]*>/) || [])[0]);
  check('название без толкования: обычная ссылка, без data-title', a.includes('<a href="/terms/t3_ru.html" ' + L + '>3</a>'));
  check('толкование без названия: поповер без data-title', a.includes('<a href="/terms/t4_ru.html" ' + L + ' class="pub-term" data-interp="Без названия.">4</a>'));
  check('пустое название (пробелы): без data-title', a.includes('<a href="/terms/t5_ru.html" ' + L + ' class="pub-term" data-interp="Пробелы.">5</a>'));
  check('название: заглавная только первая буква, term_thai не берётся', a.includes('data-title="Четыре истины" data-interp="Составное."') && !a.includes('ไม่ใช่'));
  const th = makeEnv({ json: { 'publication_1_thai.json': tileTh() }, covers: cov(),
    terms: { 't2_ru.json': { term_ru: 'русское', interpretation: 'рус' }, 't2_thai.json': { term_thai: 'ตัณหา', interpretation: 'คำอธิบาย' } },
    html: { 'b-one.html': BODY_TH + '<p><a data-term="t2">คำ</a></p>' } });
  const b = th.read('b-one.html');
  check('название thai: из term_thai, без смены регистра', th.errors.length === 0 && b.includes('class="pub-term" data-title="ตัณหา" data-interp="คำอธิบาย"') && !b.includes('Русское'), JSON.stringify(th.errors));
}


// ===== Новые обогатители: доп. инфо (21), галерея (22, мягкая 23), разделитель =====

// 14. Доп. инфо
{
  const r = one(BODY + '<p>Слово <span data-info="Устойчивая форма организации общества.">институция</span> и <span data-info="Толк &quot;2&quot;." data-title="Институция">институции</span>.</p>');
  const a = r.read('a-one.html');
  check('инфо: без ошибок', r.errors.length === 0, JSON.stringify(r.errors));
  check('инфо: разметка с заглавным словом из текста', a.includes('<span class="pub-info" data-title="Институция" data-interp="Устойчивая форма организации общества." title="Устойчивая форма организации общества.">институция</span>'), (a.match(/<span class="pub-info"[^>]*>[^<]*<\/span>/g) || []).join(' | '));
  check('инфо: начальная форма из data-title, экранирование', a.includes('<span class="pub-info" data-title="Институция" data-interp="Толк &quot;2&quot;." title="Толк &quot;2&quot;.">институции</span>'));
  check('инфо: data-info не остаётся в странице', !a.includes('data-info='));
  const th = makeEnv({ json: { 'publication_1_thai.json': tileTh() }, covers: cov(), html: { 'b-one.html': BODY_TH + '<p><span data-info="คำอธิบาย">สถาบัน</span></p>' } });
  check('инфо thai: слово как есть', th.errors.length === 0 && th.read('b-one.html').includes('<span class="pub-info" data-title="สถาบัน" data-interp="คำอธิบาย" title="คำอธิบาย">สถาบัน</span>'), JSON.stringify(th.errors));
  const w = one(BODY + '<div data-widget="checklist"><ul><li>Понять <span data-info="Толк.">институцию</span></li></ul></div><div data-widget="faq"><details><summary>В?</summary><p>Это <span data-info="Толк.">институция</span>.</p></details></div>');
  check('инфо: допускается в чек-листе и ответе faq', w.errors.length === 0 && count(w.read('a-one.html'), 'class="pub-info"') === 2, JSON.stringify(w.errors));
  const bad21 = (name, html) => {
    const x = one(BODY + html);
    check('21 ' + name, x.codes.includes(21) && !x.codes.includes(11) && !x.has('a-one.html'), JSON.stringify(x.codes));
  };
  bad21('пустое толкование', '<p><span data-info="  ">слово</span></p>');
  bad21('нет data-info', '<p><span>слово</span></p>');
  bad21('пустое слово', '<p><span data-info="Толк."> </span></p>');
  bad21('пустой data-title', '<p><span data-info="Толк." data-title=" ">слово</span></p>');
  bad21('лишний атрибут', '<p><span data-info="Толк." class="x">слово</span></p>');
  bad21('тег внутри', '<p><span data-info="Толк."><strong>слово</strong></span></p>');
  bad21('внутри ссылки на термин', '<p><a data-term="t1"><span data-info="Толк.">слово</span></a></p>');
  bad21('внутри внешней ссылки', '<p><a href="https://example.com/"><span data-info="Толк.">слово</span></a></p>');
}

// 15. Галерея
const GPH = () => ({ 'p1.jpg': jpg(1200, 800), 'p2.jpg': jpg(1600, 1200), 'small.png': png(400, 300) });
const G2 = '<div data-widget="gallery">'
  + '<figure><img src="p1.jpg" data-place="Таиланд, Пхукет" data-date="2023"><figcaption>Уборка пляжа.</figcaption></figure>'
  + '<figure><img src="p2.jpg"></figure>'
  + '</div>';
const gal = (html, extra) => makeEnv(Object.assign({ json: { 'publication_1_ru.json': tile() }, html: { 'a-one.html': BODY + html }, covers: cov(), gallery: GPH() }, extra || {}));
{
  const r = gal(G2);
  const a = r.read('a-one.html');
  check('галерея: без ошибок', r.errors.length === 0, JSON.stringify(r.errors));
  check('галерея: обёртка заменена разметкой как на «О монахе»', a.includes('<section class="gallery" aria-label="Фото"><ul class="gallery-grid">') && noWidgetLeft(a) && count(a, '<li><figure class="gallery-item">') === 2);
  check('галерея: фото с описанием, местом и датой', a.includes('<li><figure class="gallery-item"><a class="gallery-link" href="/publications/gallery/p1.jpg" data-meta="Таиланд, Пхукет, 2023"><img src="/publications/gallery/thumbs/p1.jpg" alt="Уборка пляжа." width="600" height="400" loading="lazy" decoding="async"></a><figcaption>Уборка пляжа.</figcaption></figure></li>'), (a.match(/<li><figure class="gallery-item">[\s\S]*?<\/li>/) || [''])[0]);
  check('галерея: фото без описания, места и даты', a.includes('<li><figure class="gallery-item"><a class="gallery-link" href="/publications/gallery/p2.jpg"><img src="/publications/gallery/thumbs/p2.jpg" alt="" width="600" height="450" loading="lazy" decoding="async"></a></figure></li>'));
  check('галерея: превью созданы', readSafe(path.join(r.pubDir, 'gallery/thumbs/p1.jpg')) === 'thumb:p1.jpg:600' && fs.existsSync(path.join(r.pubDir, 'gallery/thumbs/p2.jpg')));
  check('галерея: подключены скрипт и стили галереи', a.includes('src="/js/gallery.js"') && a.includes('<link rel="stylesheet" href="/css/gallery.css">'));
  const th = makeEnv({ json: { 'publication_1_thai.json': tileTh() }, covers: cov(), gallery: GPH(), html: { 'b-one.html': BODY_TH + '<div data-widget="gallery"><figure><img src="p1.jpg" data-place="ภูเก็ต" data-date="๒๕๖๖"><figcaption>ภาพ</figcaption></figure></div>' } });
  check('галерея thai: aria-label «ภาพ»', th.errors.length === 0 && th.read('b-one.html').includes('<section class="gallery" aria-label="ภาพ">') && th.read('b-one.html').includes('data-meta="ภูเก็ต, ๒๕๖๖"'), JSON.stringify(th.errors));
  const one1 = gal('<div data-widget="gallery"><figure><img src="p1.jpg" data-date="июль 2025"></figure></div>');
  check('галерея: одно фото, только дата', one1.errors.length === 0 && one1.read('a-one.html').includes('data-meta="июль 2025"'), JSON.stringify(one1.errors));
  const sm = gal('<div data-widget="gallery"><figure><img src="small.png"></figure></div>');
  check('галерея: узкое фото — превью в исходном размере', sm.errors.length === 0 && sm.read('a-one.html').includes('<img src="/publications/gallery/thumbs/small.png" alt="" width="400" height="300"'), JSON.stringify(sm.errors));
  const ex = gal(BODY + '<p>Картинки: <img src="c1.png" alt="рисунок"></p>');
  check('без галереи скрипт и стили галереи не подключаются', ex.errors.length === 0 && !ex.read('a-one.html').includes('/js/gallery.js') && !ex.read('a-one.html').includes('gallery.css'));
  check('галерея не меняет sitemap', gal(G2).sitemap === gal('').sitemap);
}
{
  // Превью: повторная сборка не пересоздаёт, изменённое фото — пересоздаёт, лишние превью удаляются
  const root = gal(G2);
  const before = thumbCalls;
  const again = gal(G2, { before: pub => {
    fs.mkdirSync(path.join(pub, 'gallery/thumbs'), { recursive: true });
    ['p1.jpg', 'p2.jpg', 'old.jpg'].forEach(f => copySafe(path.join(root.pubDir, 'gallery/thumbs', f === 'old.jpg' ? 'p1.jpg' : f), path.join(pub, 'gallery/thumbs', f)));
    copySafe(path.join(root.pubDir, 'gallery/thumbs/.sources.json'), path.join(pub, 'gallery/thumbs/.sources.json'));
  } });
  check('превью: при неизменных фото не пересоздаются', again.errors.length === 0 && thumbCalls === before, 'вызовов: ' + (thumbCalls - before));
  check('превью: лишнее превью удалено', !fs.existsSync(path.join(again.pubDir, 'gallery/thumbs/old.jpg')));
  const b2 = thumbCalls;
  const changed = gal(G2, { gallery: Object.assign(GPH(), { 'p1.jpg': jpg(1000, 500) }), before: pub => {
    fs.mkdirSync(path.join(pub, 'gallery/thumbs'), { recursive: true });
    ['p1.jpg', 'p2.jpg', '.sources.json'].forEach(f => copySafe(path.join(root.pubDir, 'gallery/thumbs', f), path.join(pub, 'gallery/thumbs', f)));
  } });
  check('превью: изменённое фото пересоздаётся (только оно)', thumbCalls - b2 === 1 && changed.read('a-one.html').includes('<img src="/publications/gallery/thumbs/p1.jpg" alt="Уборка пляжа." width="600" height="300"'), 'вызовов: ' + (thumbCalls - b2));
  const none = gal(G2, { thumbnailer: false });
  check('нет инструмента превью: показывается большое фото, без ошибки', none.errors.length === 0 && none.read('a-one.html').includes('<img src="/publications/gallery/p1.jpg" alt="Уборка пляжа." width="1200" height="800"'), JSON.stringify(none.errors));
}
{
  const bad22 = (name, html) => {
    const x = gal(html);
    check('22 ' + name, x.codes.includes(22) && !x.codes.includes(11) && !x.has('a-one.html'), JSON.stringify(x.codes));
  };
  bad22('пустая галерея', '<div data-widget="gallery"></div>');
  bad22('текст в обёртке', '<div data-widget="gallery">текст<figure><img src="p1.jpg"></figure></div>');
  bad22('абзац в обёртке', '<div data-widget="gallery"><p>а</p></div>');
  bad22('figure без img', '<div data-widget="gallery"><figure><figcaption>а</figcaption></figure></div>');
  bad22('два img в figure', '<div data-widget="gallery"><figure><img src="p1.jpg"><img src="p2.jpg"></figure></div>');
  bad22('путь в src', '<div data-widget="gallery"><figure><img src="../covers/c1.png"></figure></div>');
  bad22('ссылка в src', '<div data-widget="gallery"><figure><img src="https://example.com/a.jpg"></figure></div>');
  bad22('лишний атрибут img', '<div data-widget="gallery"><figure><img src="p1.jpg" class="x"></figure></div>');
  bad22('тег в figcaption', '<div data-widget="gallery"><figure><img src="p1.jpg"><figcaption><strong>а</strong></figcaption></figure></div>');
  bad22('пустая figcaption', '<div data-widget="gallery"><figure><img src="p1.jpg"><figcaption> </figcaption></figure></div>');
  const nested = gal('<div data-widget="faq"><details><summary>В?</summary>' + G2 + '</details></div>');
  check('галерея внутри другой обёртки: 16', nested.codes.includes(16) && !nested.has('a-one.html'), JSON.stringify(nested.codes));
  const fig = gal('<figure><img src="p1.jpg" alt="а" data-place="x"></figure>');
  check('data-place вне галереи не разрешён (11)', fig.codes.includes(11), JSON.stringify(fig.codes));
}
{
  const soft = gal('<div data-widget="gallery"><figure><img src="p1.jpg"></figure><figure><img src="nope.jpg"></figure></div>');
  check('23 нет файла: фото пропущено, статья опубликована', soft.codes.join() === '23' && soft.errors[0].soft && soft.has('a-one.html') && count(soft.read('a-one.html'), 'class="gallery-item"') === 1, JSON.stringify(soft.errors));
  const big = Buffer.concat([jpg(1200, 800), Buffer.alloc(1024 * 1024 + 10)]);
  const b = gal('<div data-widget="gallery"><figure><img src="big.jpg"></figure></div>', { gallery: Object.assign(GPH(), { 'big.jpg': big }) });
  check('23 больше 1 МБ: фото пропущено, пустая галерея не выводится', b.codes.join() === '23' && b.has('a-one.html') && !b.read('a-one.html').includes('class="gallery"'), JSON.stringify(b.codes));
  const txt = gal('<div data-widget="gallery"><figure><img src="t.jpg"></figure></div>', { gallery: Object.assign(GPH(), { 't.jpg': 'не картинка' }) });
  check('23 не картинка', txt.codes.join() === '23' && txt.has('a-one.html'), JSON.stringify(txt.codes));
  const cv = gal('<div data-widget="gallery"><figure><img src="c1.png"></figure></div>');
  check('23 фото из covers/ галерея не берёт', cv.codes.join() === '23', JSON.stringify(cv.codes));
}

// 16. Разделитель
{
  const r = one(BODY + '<hr>' + BODY);
  check('разделитель <hr> проходит как есть', r.errors.length === 0 && r.read('a-one.html').includes(BODY + '<hr>' + BODY), JSON.stringify(r.errors));
}

console.log('Пройдено: ' + passed + ', провалено: ' + failed);
if (failed) process.exit(1);
