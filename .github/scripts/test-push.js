'use strict';
// Автотесты рассылки пушей (ТЗ push_TZ.md, разделы 5, 8, 9): `node .github/scripts/test-push.js`.
// Сеть подменена: OneSignal не вызывается. Каждый тест работает во временной папке.
//
// Модули:
//   push/text.js      — message(digest, lang, cats) → { title, body, url } | null
//   push/send.js      — planSends(digest, lang, { test }) → [{ categories, title, body, url, tag, test, filters, idempotencyKey }]
//                       run({ root, lang, date, mode: 'test'|'all', resend, provider }) → { ok, skipped, sent, errors }
//                       providerName(root) — поставщик из js/push-config.js
//   push/onesignal.js — buildRequest(msg, { appId, apiKey }) → { url, method, headers, body }
//                       send(msg, { appId, apiKey, fetch }) → Promise<{ id, recipients }>
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const DIR = path.join(__dirname, 'push');
const SITE = 'https://indapanno.github.io';
const load = name => { try { return require(path.join(DIR, name)); } catch (e) { return { __error: e.message }; } };
const textMod = load('text.js'), sendMod = load('send.js'), osMod = load('onesignal.js');

let passed = 0, failed = 0;
function check(name, cond, extra) {
  if (cond) passed++; else { failed++; console.error('ПРОВАЛ: ' + name + (extra ? ' — ' + extra : '')); }
}
const tryv = f => { try { return f(); } catch (e) { return { __error: e.message }; } };
const show = v => JSON.stringify(v);
const ALL = { terms: true, bundles: true, publications: true };
const ONLY = k => ({ terms: k === 'terms', bundles: k === 'bundles', publications: k === 'publications' });

check('модули загружаются: push/text.js, push/send.js, push/onesignal.js',
  typeof textMod.message === 'function' && typeof sendMod.planSends === 'function' && typeof sendMod.run === 'function'
  && typeof osMod.buildRequest === 'function' && typeof osMod.send === 'function',
  [textMod.__error, sendMod.__error, osMod.__error].filter(Boolean).join(' | '));
const message = (d, l, c) => { const r = tryv(() => textMod.message(d, l, c)); return r && r.__error ? undefined : r; }; // нет модуля → undefined: проверки краснеют, а не падают

// --- Данные сводок ---
const pub = (n, h, lead) => ({ n, headline: h, lead: lead || 'Лид статьи ' + n, cover: '/publications/covers/c.png', url: '/publications/p' + n + '.html' });
const bun = (n, name, count) => ({ n, name, description: 'Описание связки ' + name, count: count || 3, url: '/bundle/bundle_' + n + '_ru.html' });
const RU_TERMS = ['Дуккха', 'Самудая', 'Ниродха', 'Магга', 'Сила', 'Самадхи', 'Панья', 'Дана', 'Сангха', 'Камма', 'Бхава', 'Джати'];
const term = (i, lang) => ({ id: 't' + i, name: lang === 'thai' ? ['ทุกข์', 'สมุทัย', 'นิโรธ', 'มรรค'][i % 4] : RU_TERMS[i], iast: 'x', snippet: lang === 'thai' ? 'ความไม่น่าพอใจ' : 'Неудовлетворённость, присущая всему обусловленному.', url: '/terms/t' + i + '_' + (lang || 'ru') + '.html' });
const terms = (n, lang) => Array.from({ length: n }, (_, i) => term(i, lang));
const digest = (o, lang) => Object.assign({ date: '2026-10-30', lang: lang || 'ru', sent: false, publications: [], bundles: [], terms: [] }, o);
const DIGEST_URL = SITE + '/new/2026-10-30_ru.html';

// 1. Тексты по таблице ТЗ (ru)
{
  let m = message(digest({ publications: [pub(1, 'Четыре благородные истины')], terms: terms(12) }), 'ru', ALL);
  check('1 публикация + 12 терминов: заголовок', m && m.title === 'Новая публикация: «Четыре благородные истины»', show(m));
  check('1 публикация + 12 терминов: текст «И ещё 12 терминов», ссылка на сводку', m && m.body === 'И ещё 12 терминов' && m.url === DIGEST_URL, show(m));
  m = message(digest({ publications: [pub(1, 'Название 1'), pub(2, 'Название 2')] }), 'ru', ALL);
  check('2 публикации', m && m.title === '2 новые публикации' && m.body === '«Название 1», «Название 2»' && m.url === DIGEST_URL, show(m));
  m = message(digest({ bundles: [bun(2, 'Пять преград')], terms: terms(3) }), 'ru', ALL);
  check('1 связка + 3 термина', m && m.title === 'Новые связанные термины: «Пять преград»' && m.body === 'И ещё 3 термина', show(m));
  m = message(digest({ terms: terms(12) }), 'ru', ALL);
  check('12 терминов', m && m.title === '12 новых терминов' && m.body === 'Дуккха, самудая, ниродха и ещё 9', show(m));
  m = message(digest({ terms: terms(1) }), 'ru', ALL);
  check('1 термин: заголовок, текст — толкование, ссылка на термин', m && m.title === 'Новый термин: Дуккха' && m.body === 'Неудовлетворённость, присущая всему обусловленному.' && m.url === SITE + '/terms/t0_ru.html', show(m));
  m = message(digest({ publications: [pub(1, 'Статья')], bundles: [bun(1, 'Связка')], terms: terms(12) }), 'ru', ALL);
  check('публикация + связка + термины: «И ещё 1 связка и 12 терминов»', m && m.title === 'Новая публикация: «Статья»' && m.body === 'И ещё 1 связка и 12 терминов', show(m));
  m = message(digest({ publications: [pub(1, 'Статья', 'Короткий лид статьи.')] }), 'ru', ALL);
  check('одна публикация: текст — лид, ссылка на статью', m && m.body === 'Короткий лид статьи.' && m.url === SITE + '/publications/p1.html', show(m));
  m = message(digest({ bundles: [bun(1, 'А'), bun(2, 'Б')] }), 'ru', ALL);
  check('2 связки', m && m.title === '2 новые связки' && m.body === '«А», «Б»', show(m));
  check('склонения: 2 / 5 / 21 термин', [2, 5, 21].map(n => (message(digest({ terms: terms(Math.min(n, 12)).concat(Array.from({ length: Math.max(0, n - 12) }, (_, i) => term(i % 12))) }), 'ru', ALL) || {}).title).join('|')
    === '2 новых термина|5 новых терминов|21 новый термин');
  check('склонения: 5 публикаций, 21 публикация', [5, 21].map(n => (message(digest({ publications: Array.from({ length: n }, (_, i) => pub(i + 1, 'С' + i)) }), 'ru', ALL) || {}).title).join('|')
    === '5 новых публикаций|21 новая публикация');
}

// 2. Только свои категории
{
  const d = digest({ publications: [pub(1, 'Статья')], terms: terms(12) });
  let m = message(d, 'ru', ONLY('terms'));
  check('подписан только на термины: про публикацию ни слова', m && m.title === '12 новых терминов' && !/Статья|публикац/.test(m.title + m.body), show(m));
  m = message(d, 'ru', ONLY('publications'));
  check('подписан только на публикации: одна статья → лид и ссылка на статью', m && m.title === 'Новая публикация: «Статья»' && m.body === 'Лид статьи 1' && m.url === SITE + '/publications/p1.html', show(m));
  m = message(d, 'ru', ONLY('bundles'));
  check('в сводке нет его категорий → пуша нет', m === null, show(m));
  m = message(digest({ terms: terms(12) }), 'ru', { terms: false, bundles: true, publications: true });
  check('терминов не хочет, а в сводке только термины → пуша нет', m === null, show(m));
}

// 3. Длина: заголовок до 60, текст до 120, обрезка по слову с «…»
{
  const long = 'Очень длинный заголовок публикации, который никак не помещается в уведомление целиком';
  const m = message(digest({ publications: [pub(1, long, 'Слово '.repeat(60).trim())] }), 'ru', ALL);
  check('заголовок ≤ 60, обрезано название по слову, «…», кавычка закрыта', m && m.title.length <= 60 && m.title.endsWith('…»') && !/\s…$/.test(m.title) && long.startsWith(m.title.slice('Новая публикация: «'.length, -1).replace(/[…»]+$/, '').trim()), m && m.title);
  check('текст ≤ 120, обрезан по слову, «…»', m && m.body.length <= 120 && m.body.endsWith('…') && /Слово…$/.test(m.body), m && m.body);
  const many = message(digest({ publications: Array.from({ length: 9 }, (_, i) => pub(i + 1, 'Довольно длинное название статьи номер ' + (i + 1))) }), 'ru', ALL);
  check('много названий: текст ≤ 120', many && many.body.length <= 120, many && many.body);
}

// 4. Тайский
{
  let m = message(digest({ terms: terms(12, 'thai') }, 'thai'), 'thai', ALL);
  check('thai: 12 терминов — тайские цифры', m && m.title === 'คำศัพท์ใหม่ ๑๒ คำ' && m.body === 'ทุกข์, สมุทัย, นิโรธ และอีก ๙ คำ' && m.url === SITE + '/new/2026-10-30_thai.html', show(m));
  m = message(digest({ terms: terms(1, 'thai') }, 'thai'), 'thai', ALL);
  check('thai: 1 термин', m && m.title === 'คำศัพท์ใหม่: ทุกข์' && m.body === 'ความไม่น่าพอใจ', show(m));
  m = message(digest({ publications: [pub(7, 'จากปุถุชนสู่โสดาบัน')], terms: terms(12, 'thai') }, 'thai'), 'thai', ALL);
  check('thai: публикация + термины', m && m.title === 'บทความใหม่: “จากปุถุชนสู่โสดาบัน”' && m.body === 'และอีก คำศัพท์ ๑๒ คำ', show(m));
  m = message(digest({ publications: [pub(1, 'ก'), pub(2, 'ข')] }, 'thai'), 'thai', ALL);
  check('thai: 2 публикации', m && m.title === 'บทความใหม่ ๒ เรื่อง' && m.body === '“ก”, “ข”', show(m));
  m = message(digest({ bundles: [bun(1, 'อริยสัจ ๔')] }, 'thai'), 'thai', ALL);
  check('thai: 1 связка', m && m.title === 'ชุดศัพท์ใหม่: “อริยสัจ ๔”', show(m));
}

// 5. План рассылки: 7 групп по точному совпадению тегов
const tagOf = (filters, key) => { const f = (filters || []).find(x => x.field === 'tag' && x.key === key); return f ? f.relation + f.value : null; };
{
  const d = digest({ publications: [pub(1, 'Статья')], terms: terms(12) });
  const plan = tryv(() => sendMod.planSends(d, 'ru', { test: false }));
  check('план: группы без своих пунктов пропущены (6 из 7)', Array.isArray(plan) && plan.length === 6, show(plan && plan.length));
  if (Array.isArray(plan)) {
    const combos = plan.map(p => ['terms', 'bundles', 'publications'].map(k => (p.categories[k] ? 1 : 0)).join(''));
    check('план: комбинации категорий не повторяются', new Set(combos).size === plan.length, combos.join(','));
    check('план: фильтр по языку и точным тегам c_* у каждой группы', plan.every(p => tagOf(p.filters, 'lang') === '=ru'
      && ['terms', 'bundles', 'publications'].every(k => tagOf(p.filters, 'c_' + k) === '=' + (p.categories[k] ? '1' : '0'))), show(plan.map(p => p.filters)));
    check('план: без фильтра tester в обычном режиме', plan.every(p => tagOf(p.filters, 'tester') === null && p.test === false));
    check('план: метка news-ru', plan.every(p => p.tag === 'news-ru'));
    check('план: тексты групп из message()', plan.every(p => { const m = textMod.message(d, 'ru', p.categories); return m && m.title === p.title && m.body === p.body && m.url === p.url; }));
    const keys = plan.map(p => p.idempotencyKey);
    check('план: ключи идемпотентности — UUID, разные у групп', keys.every(k => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(k)) && new Set(keys).size === keys.length, keys.join(','));
    const again = sendMod.planSends(d, 'ru', { test: false }).map(p => p.idempotencyKey);
    check('план: ключи одинаковы при повторе (OneSignal не отправит дважды)', again.join() === keys.join());
    const testPlan = sendMod.planSends(d, 'ru', { test: true });
    check('тестовый режим: фильтр tester=1, свои ключи', testPlan.every(p => tagOf(p.filters, 'tester') === '=1' && p.test === true) && testPlan.every(p => keys.indexOf(p.idempotencyKey) < 0));
    const t2 = sendMod.planSends(d, 'ru', { test: true }).map(p => p.idempotencyKey);
    check('тестовый режим: каждый запуск — новые ключи (иначе OneSignal молча отбросит повторный тест)', t2.every(k => testPlan.map(p => p.idempotencyKey).indexOf(k) < 0));
    const fixed = n => sendMod.planSends(d, 'ru', { test: true, nonce: n }).map(p => p.idempotencyKey).join();
    check('тестовый режим: один и тот же запуск (nonce) — одни и те же ключи', fixed('run-1') === fixed('run-1') && fixed('run-1') !== fixed('run-2'));
  }
  const thaiPlan = tryv(() => sendMod.planSends(digest({ terms: terms(2, 'thai') }, 'thai'), 'thai', { test: false }));
  check('план thai: 4 группы с терминами, метка news-thai, lang=thai', Array.isArray(thaiPlan) && thaiPlan.length === 4 && thaiPlan.every(p => p.tag === 'news-thai' && tagOf(p.filters, 'lang') === '=thai'), show(thaiPlan && thaiPlan.length));
}

// 6. Запрос к OneSignal
{
  const msg = { lang: 'ru', categories: ALL, title: 'Заголовок', body: 'Текст', url: DIGEST_URL, tag: 'news-ru', test: false,
    filters: [{ field: 'tag', key: 'lang', relation: '=', value: 'ru' }], idempotencyKey: '0b5c3a4e-1f2d-5a6b-8c7d-9e0f1a2b3c4d' };
  const r = tryv(() => osMod.buildRequest(msg, { appId: 'APP', apiKey: 'KEY' }));
  const b = r && r.body;
  check('OneSignal: адрес, метод, ключ в заголовке', r && r.url === 'https://api.onesignal.com/notifications' && r.method === 'POST' && r.headers && r.headers.Authorization === 'Key KEY', show(r && { url: r.url, h: r.headers }));
  check('OneSignal: app_id, только push, фильтры, без сегментов', b && b.app_id === 'APP' && b.target_channel === 'push' && b.filters === msg.filters && !b.included_segments);
  check('OneSignal: заголовок, текст, ссылка', b && b.headings && b.headings.en === 'Заголовок' && b.contents && b.contents.en === 'Текст' && b.url === DIGEST_URL);
  check('OneSignal: метка замены, иконки, ключ идемпотентности', b && b.web_push_topic === 'news-ru' && b.chrome_web_icon === SITE + '/img/icon-192.png'
    && b.chrome_web_badge === SITE + '/img/badge-72.png' && b.firefox_icon === SITE + '/img/icon-192.png' && b.idempotency_key === msg.idempotencyKey, show(b));
  const fake = (ok, status, json) => () => Promise.resolve({ ok, status, json: () => Promise.resolve(json), text: () => Promise.resolve(JSON.stringify(json)) });
  const results = [];
  const p1 = Promise.resolve().then(() => osMod.send(msg, { appId: 'A', apiKey: 'K', fetch: fake(true, 200, { id: 'n1' }) })).then(x => results.push(['ok', x]), e => results.push(['err', e.message]));
  const p2 = Promise.resolve().then(() => osMod.send(msg, { appId: 'A', apiKey: 'K', fetch: fake(false, 400, { errors: ['bad'] }) })).then(x => results.push(['ok400', x]), e => results.push(['err400', e.message]));
  const p3 = Promise.resolve().then(() => osMod.send(msg, { appId: 'A', apiKey: 'K', fetch: fake(true, 200, { id: '', errors: ['All included players are not subscribed'] }) })).then(x => results.push(['none', x]), e => results.push(['errnone', e.message]));
  const p4 = Promise.resolve().then(() => osMod.send(msg, { appId: 'A', apiKey: 'K', fetch: fake(true, 200, { id: '', errors: ['Something else'] }) })).then(x => results.push(['ok200err', x]), e => results.push(['err200', e.message]));
  module.exports.pending = Promise.all([p1, p2, p3, p4]).then(() => {
    const has = k => results.some(x => x[0] === k);
    check('OneSignal: успех → id', results.some(x => x[0] === 'ok' && x[1] && x[1].id === 'n1'), show(results));
    check('OneSignal: HTTP-ошибка → исключение', has('err400'), show(results));
    check('OneSignal: «нет подписчиков в группе» — не ошибка, 0 получателей', results.some(x => x[0] === 'none' && x[1] && x[1].recipients === 0), show(results));
    check('OneSignal: прочие ошибки в ответе → исключение', has('err200'), show(results));
  });
}

// 7. run(): отметка «отправлено», повтор, тест, ошибки
function makeRoot(d) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'push-'));
  fs.mkdirSync(path.join(root, '_src/news/digests'), { recursive: true });
  fs.mkdirSync(path.join(root, 'js'), { recursive: true });
  fs.writeFileSync(path.join(root, 'js/push-config.js'), "window.PUSH_CONFIG = {\n  provider: 'onesignal',\n  appId: 'APP'\n};\n");
  if (d) fs.writeFileSync(path.join(root, '_src/news/digests/2026-10-30_ru.json'), JSON.stringify(d, null, 2));
  return root;
}
const readDigest = root => JSON.parse(fs.readFileSync(path.join(root, '_src/news/digests/2026-10-30_ru.json'), 'utf8'));
function fakeProvider(failOn) {
  const calls = [];
  return { calls, send: msg => { calls.push(msg); return failOn && failOn(msg, calls.length) ? Promise.reject(new Error('сбой')) : Promise.resolve({ id: 'n' + calls.length, recipients: 1 }); } };
}
const runP = o => Promise.resolve().then(() => sendMod.run(o)).catch(e => ({ ok: false, crashed: e.message }));
const D = () => digest({ publications: [pub(1, 'Статья')], terms: terms(12) });

const runs = (async () => {
  check('providerName: из js/push-config.js', tryv(() => sendMod.providerName(makeRoot(null))) === 'onesignal');
  let root = makeRoot(null), pr = fakeProvider();
  let r = await runP({ root, lang: 'ru', date: '2026-10-30', mode: 'all', provider: pr });
  check('нет сводки за день → пропуск без ошибки, ничего не отправлено', r.ok === true && r.skipped === 'no-digest' && pr.calls.length === 0, show(r));

  root = makeRoot(D()); pr = fakeProvider();
  r = await runP({ root, lang: 'ru', date: '2026-10-30', mode: 'all', provider: pr });
  check('рассылка: 6 отправок, ok', r.ok === true && r.sent === 6 && pr.calls.length === 6, show(r));
  check('рассылка: в сводке отметка sent: true', readDigest(root).sent === true);
  check('рассылка: остальные данные сводки не тронуты', readDigest(root).terms.length === 12 && readDigest(root).publications[0].headline === 'Статья');
  pr = fakeProvider();
  r = await runP({ root, lang: 'ru', date: '2026-10-30', mode: 'all', provider: pr });
  check('повторный запуск без «повторить» → ничего не шлёт', r.ok === true && r.skipped === 'already-sent' && pr.calls.length === 0, show(r));
  pr = fakeProvider();
  r = await runP({ root, lang: 'ru', date: '2026-10-30', mode: 'all', resend: true, provider: pr });
  check('«повторить» → шлёт снова (с теми же ключами идемпотентности)', r.ok === true && pr.calls.length === 6 && pr.calls.every(c => c.test === false), show(r));

  root = makeRoot(D()); pr = fakeProvider();
  r = await runP({ root, lang: 'ru', date: '2026-10-30', mode: 'test', provider: pr });
  check('тест: только тестерам, отметку sent не ставит', r.ok === true && pr.calls.length === 6 && pr.calls.every(c => c.test === true && tagOf(c.filters, 'tester') === '=1') && readDigest(root).sent === false, show(r));
  const sentD = Object.assign(D(), { sent: true });
  root = makeRoot(sentD); pr = fakeProvider();
  r = await runP({ root, lang: 'ru', date: '2026-10-30', mode: 'test', provider: pr });
  check('тест разрешён и после реальной отправки', r.ok === true && pr.calls.length === 6);
  const firstKeys = pr.calls.map(c => c.idempotencyKey).join(); pr = fakeProvider();
  r = await runP({ root, lang: 'ru', date: '2026-10-30', mode: 'test', provider: pr });
  check('повторный тест той же сводки уходит с новыми ключами', r.ok === true && pr.calls.length === 6 && pr.calls.map(c => c.idempotencyKey).join() !== firstKeys);

  root = makeRoot(D()); pr = fakeProvider((m, n) => n === 3);
  r = await runP({ root, lang: 'ru', date: '2026-10-30', mode: 'all', provider: pr });
  check('сбой одной отправки → ok: false, причина в errors, остальные группы отправлены', r.ok === false && Array.isArray(r.errors) && r.errors.length === 1 && pr.calls.length === 6, show(r));
  check('сбой → отметка sent не ставится (повтор дошлёт, ключи не дадут дублей)', readDigest(root).sent === false);

  root = makeRoot('{ сломано'); pr = fakeProvider();
  fs.writeFileSync(path.join(root, '_src/news/digests/2026-10-30_ru.json'), '{ сломано');
  r = await runP({ root, lang: 'ru', date: '2026-10-30', mode: 'all', provider: pr });
  check('повреждённая сводка → ошибка, без отправок', r.ok === false && pr.calls.length === 0, show(r));
  r = await runP({ root: makeRoot(D()), lang: 'en', date: '2026-10-30', mode: 'all', provider: fakeProvider() });
  check('неверный язык → ошибка', r.ok === false, show(r));

  // CLI: без ключа реальная отправка падает; режим none ничего не делает
  const cli = path.join(DIR, 'send.js');
  if (fs.existsSync(cli)) {
    const env = Object.assign({}, process.env, { PUSH_ROOT: makeRoot(D()), NEWS_LANG: 'ru', NEWS_DATE: '2026-10-30' });
    delete env.ONESIGNAL_REST_API_KEY;
    const a = spawnSync(process.execPath, [cli], { env: Object.assign({}, env, { PUSH_MODE: 'all' }), encoding: 'utf8' });
    check('CLI: нет ключа → код ошибки и понятное сообщение', a.status === 1 && /ONESIGNAL_REST_API_KEY/.test(a.stderr + a.stdout), a.status + ' ' + a.stderr);
    const n = spawnSync(process.execPath, [cli], { env: Object.assign({}, env, { PUSH_MODE: 'none' }), encoding: 'utf8' });
    check('CLI: режим none → ничего не шлёт, код 0', n.status === 0, n.status + ' ' + n.stderr);
  } else check('CLI: push/send.js существует', false);

  // Workflow: расписание и секрет
  const wf = fs.readFileSync(path.resolve(__dirname, '../workflows/news.yml'), 'utf8');
  check('news.yml: расписание ru 16:00 UTC и thai 12:00 UTC', /cron:\s*'0 16 \* \* \*'/.test(wf) && /cron:\s*'0 12 \* \* \*'/.test(wf));
  check('news.yml: ключ из секрета ONESIGNAL_REST_API_KEY, ручной режим отправки и «повторить»', /secrets\.ONESIGNAL_REST_API_KEY/.test(wf) && /send:/.test(wf) && /resend:/.test(wf));
  check('news.yml: перед отправкой ждём, пока страница сводки откроется на сайте', /curl[^\n]*new\//.test(wf));
})();

Promise.all([runs, module.exports.pending]).catch(e => { failed++; console.error('ПРОВАЛ: тесты упали — ' + e.message); }).then(() => {
  console.log(failed ? 'ПРОВАЛЕНО: ' + failed + ', пройдено: ' + passed : 'ВСЕ ТЕСТЫ ПРОЙДЕНЫ: ' + passed);
  process.exitCode = failed ? 1 : 0;
});
