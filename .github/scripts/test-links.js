'use strict';
// Проверка ссылок собранного сайта: `node .github/scripts/test-links.js`.
// Корень сайта — корень репозитория или SITE_ROOT. Проверяются все .html вне _src, .github, docs.
const fs = require('fs');
const path = require('path');

const ROOT = process.env.SITE_ROOT || path.resolve(__dirname, '../..');
const SITE = 'https://indapanno.github.io';
const SKIP_DIRS = new Set(['_src', '.github', 'docs', 'help', '.git', 'node_modules']);
// Единственная разрешённая ссылка на прежний репозиторий: демо «ветвление буддизма» остаётся в buddhism
// Тесты ссылок/SEO/заглушек сами содержат искомые строки в коде
const SELF_TESTS = /^\.github\/scripts\/test-(links|seo|stubs)\.js$/;
const ALLOWED_OLD = ['https://indapanno.github.io/buddhism/share/branching/'];

let passed = 0, failed = 0;
function check(name, cond, extra) {
  if (cond) passed++; else { failed++; console.error('ПРОВАЛ: ' + name + (extra ? ' — ' + extra : '')); }
}

function walk(dir, rel, out, filter) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach(e => {
    const r = rel ? rel + '/' + e.name : e.name;
    if (e.isDirectory()) { if (!(rel === '' && SKIP_DIRS.has(e.name)) && e.name !== '.git') walk(path.join(dir, e.name), r, out, filter); }
    else if (filter(r)) out.push(r);
  });
  return out;
}

const pages = walk(ROOT, '', [], f => f.endsWith('.html') && f !== 'yandex_9adf84726f5490a0.html');
const exists = p => fs.existsSync(path.join(ROOT, p));

// Адрес вида /a/b/ -> a/b/index.html; /a/b.html -> a/b.html; null, если пусто
function fileOfPath(p) {
  const clean = p.replace(/^\/+/, '');
  if (clean === '' || clean.endsWith('/')) return clean + 'index.html';
  return clean;
}

const attrRe = /\b(?:href|src)\s*=\s*"([^"]*)"/g;
const bad = { dotdot: [], buddhism: [], indexLink: [], missing: [], relative: [] };
let linkCount = 0;

pages.forEach(file => {
  const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const isArticle = /^publications\/[^/]+\.html$/.test(file) && file !== 'publications/index.html' && !/^publications\/publications_/.test(file);
  let m;
  attrRe.lastIndex = 0;
  while ((m = attrRe.exec(html))) {
    let v = m[1].trim();
    if (!v || v[0] === '#' || /^(mailto:|tel:|javascript:|data:)/i.test(v) || v.startsWith('//')) continue;
    if (v.includes('../')) bad.dotdot.push(file + ': ' + v);
    let p;
    if (/^https:\/\//i.test(v)) {
      if (!v.startsWith(SITE + '/') && v !== SITE) continue; // внешняя ссылка
      if (ALLOWED_OLD.some(a => v.startsWith(a))) continue;
      p = v.slice(SITE.length) || '/';
    } else if (/^https?:\/\//i.test(v)) { continue; }
    else if (v[0] === '/') p = v;
    else {
      // относительные ссылки допустимы только между статьями публикаций
      if (isArticle) p = '/publications/' + v; else { bad.relative.push(file + ': ' + v); continue; }
    }
    linkCount++;
    p = p.split('#')[0].split('?')[0];
    if (p.startsWith('/buddhism/')) { bad.buddhism.push(file + ': ' + v); continue; }
    if (/(^|\/)index\.html$/.test(p)) bad.indexLink.push(file + ': ' + v);
    if (!exists(fileOfPath(p))) bad.missing.push(file + ': ' + v);
  }
});

check('найдены страницы сайта', pages.length > 20, 'страниц: ' + pages.length);
check('нет ссылок с «../»', bad.dotdot.length === 0, bad.dotdot.slice(0, 5).join(' | '));
check('нет ссылок на /buddhism/ (кроме демо branching)', bad.buddhism.length === 0, bad.buddhism.slice(0, 5).join(' | '));
check('нет ссылок на index.html (вместо них /, /bundle/, /publications/)', bad.indexLink.length === 0, bad.indexLink.slice(0, 5).join(' | '));
check('нет относительных ссылок вне статей публикаций', bad.relative.length === 0, bad.relative.slice(0, 5).join(' | '));
check('каждая внутренняя ссылка указывает на существующий файл или каталог с index.html', bad.missing.length === 0, bad.missing.slice(0, 8).join(' | '));

// A3: старые адреса и пути не встречаются в страницах, шаблонах, скриптах и JS
const textFiles = walk(ROOT, '', [], f => /\.(html|js|css|yml|json)$/.test(f) && !/^json\/|^schema\/|^_src\/(bundle|publications)\/json\//.test(f)
  && !SELF_TESTS.test(f) && f !== 'yandex_9adf84726f5490a0.html');
// _src с шаблонами и статьями проверяем отдельно (в SKIP_DIRS он пропущен для страниц)
const srcFiles = walk(path.join(ROOT, '_src'), '_src', [], f => /\.(html|js|css)$/.test(f));
const ghFiles = walk(path.join(ROOT, '.github'), '.github', [], f => /\.(js|yml)$/.test(f) && !SELF_TESTS.test(f));
const scanFiles = Array.from(new Set(textFiles.concat(srcFiles, ghFiles)));
const hits = [];
scanFiles.forEach(f => {
  let t = fs.readFileSync(path.join(ROOT, f), 'utf8');
  ALLOWED_OLD.forEach(a => { t = t.split(a).join(''); });
  [['indapanno/buddhism'], ['share/terms'], ['/buddhism/']].forEach(([needle]) => { if (t.includes(needle)) hits.push(f + ' → ' + needle); });
  if (!f.startsWith('.github/') && !f.startsWith('_src/publications/html/') && /(["'(])\.\.\//.test(t)) hits.push(f + ' → ../');
});
check('A3: нет «indapanno/buddhism», «share/terms», «/buddhism/», «../» в страницах, шаблонах, скриптах и JS', hits.length === 0, hits.slice(0, 8).join(' | '));

console.log('Ссылок проверено: ' + linkCount + ', страниц: ' + pages.length);
console.log(failed ? 'ПРОВАЛЕНО: ' + failed + ', пройдено: ' + passed : 'ВСЕ ТЕСТЫ ПРОЙДЕНЫ: ' + passed);
process.exitCode = failed ? 1 : 0;
