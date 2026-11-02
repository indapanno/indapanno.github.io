'use strict';
// Автоотправка новых и изменённых адресов в IndexNow (Bing, Яндекс и другие поисковики протокола).
// Вызывается в workflow после коммита бота: node .github/scripts/indexnow.js HEAD~1 HEAD
// Берёт из коммита изменённые и удалённые страницы, оставляет только те, что есть (были) в картах сайта,
// плюс адреса, вошедшие в карты или выпавшие из них; ждёт, пока GitHub Pages опубликует изменения;
// отправляет. Любая ошибка — только предупреждение (код выхода 0): сборки она не валит.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const cfg = require('./site-config.js');

const REPO_ROOT = path.resolve(__dirname, '../..');
const ENDPOINT = 'https://api.indexnow.org/indexnow';
const HOST = new URL(cfg.SITE_URL).host;
const BATCH = 10000; // ограничение протокола на один запрос
const SITEMAPS = ['sitemap.xml', 'sitemap_publications.xml', 'sitemap_bundles.xml', 'sitemap_news.xml'];

// Адрес страницы по файлу сайта; не страница (или исходник в _src/.github) → null
function fileToUrl(file) {
  const f = String(file).replace(/^\.?\//, '');
  if (!f.endsWith('.html') || /^(_src|\.github|docs|help)\//.test(f)) return null;
  if (f === 'index.html') return cfg.SITE_URL + '/';
  if (f.endsWith('/index.html')) return cfg.SITE_URL + '/' + f.slice(0, -'index.html'.length);
  return cfg.SITE_URL + '/' + f;
}

const sitemapLocs = xml => [...String(xml || '').matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1].trim());

function pickUrls({ changed = [], deleted = [], sitemapsAfter = [], sitemapsBefore = [] }) {
  const after = new Set(sitemapsAfter.flatMap(sitemapLocs));
  const before = new Set(sitemapsBefore.flatMap(sitemapLocs));
  const out = new Set();
  changed.map(fileToUrl).filter(u => u && after.has(u)).forEach(u => out.add(u));
  deleted.map(fileToUrl).filter(u => u && before.has(u)).forEach(u => out.add(u));
  after.forEach(u => { if (!before.has(u)) out.add(u); });
  before.forEach(u => { if (!after.has(u)) out.add(u); });
  return Array.from(out).sort();
}

// Ключ: файл <32 hex>.txt в корне сайта, содержимое которого совпадает с именем
function findKey(root) {
  const dir = root || REPO_ROOT;
  const hit = fs.readdirSync(dir).find(f => {
    const m = f.match(/^([0-9a-f]{32})\.txt$/);
    return m && fs.readFileSync(path.join(dir, f), 'utf8').trim() === m[1];
  });
  return hit ? hit.slice(0, -4) : null;
}

function buildRequest(urls, key) {
  return {
    url: ENDPOINT, method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: { host: HOST, key, keyLocation: cfg.SITE_URL + '/' + key + '.txt', urlList: urls }
  };
}

async function send(urls, opts) {
  const doFetch = (opts && opts.fetch) || globalThis.fetch;
  const results = [];
  for (let i = 0; i < urls.length; i += BATCH) {
    const req = buildRequest(urls.slice(i, i + BATCH), opts.key);
    const res = await doFetch(req.url, { method: req.method, headers: req.headers, body: JSON.stringify(req.body) });
    if (res.status !== 200 && res.status !== 202) throw new Error('IndexNow HTTP ' + res.status);
    results.push(res.status);
  }
  return results;
}

// Ждём, пока GitHub Pages опубликует новую версию: страница на сайте должна совпасть с файлом коммита
// целиком (заголовок и прочие части при правке часто не меняются). По умолчанию до 10 минут.
async function waitLive(url, expected, opts) {
  const o = opts || {};
  const doFetch = o.fetch || globalThis.fetch;
  const attempts = o.attempts || 40, interval = o.interval === undefined ? 15000 : o.interval;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await doFetch(url + (url.includes('?') ? '&' : '?') + 'v=' + Date.now(), { cache: 'no-store' });
      if (res.ok && (await res.text()) === expected) return true;
    } catch (e) { /* ещё не доступна */ }
    if (i < attempts - 1) await new Promise(r => setTimeout(r, interval));
  }
  return false;
}

module.exports = { fileToUrl, sitemapLocs, pickUrls, findKey, buildRequest, send, waitLive };

// --- Запуск из workflow ---
const git = args => execFileSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const gitShow = (rev, file) => { try { return git(['show', rev + ':' + file]); } catch (e) { return ''; } };
const warn = msg => { console.log('ПРЕДУПРЕЖДЕНИЕ IndexNow: ' + msg); if (process.env.GITHUB_ACTIONS) console.log('::warning title=IndexNow::' + msg); };

async function main(from, to) {
  const key = findKey(REPO_ROOT);
  if (!key) { warn('нет файла ключа <32 hex>.txt в корне сайта — адреса не отправлены'); return; }
  const changed = [], deleted = [];
  git(['diff', '--name-status', '--no-renames', from, to]).split('\n').filter(Boolean).forEach(line => {
    const [st, file] = line.split('\t');
    (st === 'D' ? deleted : changed).push(file);
  });
  const urls = pickUrls({
    changed, deleted,
    sitemapsAfter: SITEMAPS.map(f => gitShow(to, f)),
    sitemapsBefore: SITEMAPS.map(f => gitShow(from, f))
  });
  if (!urls.length) { console.log('IndexNow: новых или изменённых страниц из карт сайта нет'); return; }
  // Первая изменённая страница, которая есть сейчас: ждём её новую версию на сайте
  const liveFile = changed.find(f => fileToUrl(f) && urls.includes(fileToUrl(f)));
  if (liveFile) {
    const text = fs.readFileSync(path.join(REPO_ROOT, liveFile), 'utf8');
    if (!(await waitLive(fileToUrl(liveFile), text))) warn('страница ' + fileToUrl(liveFile) + ' не обновилась на сайте за 10 минут; адреса всё равно отправлены');
  }
  await send(urls, { key });
  console.log('IndexNow: отправлено адресов — ' + urls.length);
  urls.slice(0, 50).forEach(u => console.log('  ' + u));
  if (urls.length > 50) console.log('  … и ещё ' + (urls.length - 50));
}

if (require.main === module) {
  const [from, to] = process.argv.slice(2);
  if (!from || !to) { warn('нужно два аргумента: коммит до и после'); process.exit(0); }
  main(from, to).catch(e => warn(e.message)).then(() => { process.exitCode = 0; });
}
