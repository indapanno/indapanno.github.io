'use strict';
// Рассылка пушей по сводке за день (ТЗ push_TZ.md, разделы 5, 8, 9).
// Подписчики делятся на 7 групп по точному совпадению тегов c_terms / c_bundles / c_publications
// (комбинации трёх галочек) — каждый получает ровно одно уведомление со своим текстом.
// Защита от повторов: отметка sent в данных сводки + ключ идемпотентности OneSignal
// (одинаковый при повторе: OneSignal не отправит ту же группу дважды; «повторить» дошлёт недошедшие).
// В тестовом режиме ключ уникален для каждого запуска (nonce): тест можно повторять сколько угодно.
// Режимы: all — всем подписчикам языка; test — только с тегом tester (отметку sent не ставит); none — ничего.
//
// Запуск: NEWS_LANG=ru|thai [NEWS_DATE=ГГГГ-ММ-ДД] PUSH_MODE=all|test|none [PUSH_RESEND=true] node .github/scripts/push/send.js
// Ключ: ONESIGNAL_REST_API_KEY (секрет GitHub). Без NEWS_DATE — сегодня в поясе языка.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { message } = require('./text.js');

const REPO_ROOT = path.resolve(__dirname, '../../..');
const LANGS = ['ru', 'thai'];
const CATS = ['terms', 'bundles', 'publications'];

function readConfig(root) {
  const t = fs.readFileSync(path.join(root, 'js/push-config.js'), 'utf8');
  const get = k => { const m = t.match(new RegExp(k + "\\s*:\\s*'([^']*)'")); return m ? m[1] : null; };
  return { provider: get('provider'), appId: get('appId') };
}
const providerName = root => readConfig(root).provider;

// Детерминированный UUID (формат v5) из строки
function uuidFrom(s) {
  const h = crypto.createHash('sha1').update(s).digest('hex');
  const v = ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16);
  return h.slice(0, 8) + '-' + h.slice(8, 12) + '-5' + h.slice(13, 16) + '-' + v + h.slice(17, 20) + '-' + h.slice(20, 32);
}

function planSends(digest, lang, opts) {
  const test = !!(opts && opts.test);
  const nonce = test ? String((opts && opts.nonce) || crypto.randomUUID()) : '';
  const plan = [];
  for (let mask = 1; mask < 8; mask++) {
    const categories = {};
    CATS.forEach((k, i) => { categories[k] = !!(mask & (1 << i)); });
    const m = message(digest, lang, categories);
    if (!m) continue;
    const filters = [{ field: 'tag', key: 'lang', relation: '=', value: lang }]
      .concat(CATS.map(k => ({ field: 'tag', key: 'c_' + k, relation: '=', value: categories[k] ? '1' : '0' })));
    if (test) filters.push({ field: 'tag', key: 'tester', relation: '=', value: '1' });
    const combo = CATS.map(k => (categories[k] ? 1 : 0)).join('');
    plan.push({
      lang, categories, title: m.title, body: m.body, url: m.url, tag: 'news-' + lang, test, filters,
      idempotencyKey: uuidFrom(['news', digest.date, lang, combo, test ? 'test:' + nonce : 'all'].join('|'))
    });
  }
  return plan;
}

function defaultProvider(root) {
  const conf = readConfig(root);
  const mod = require('./' + conf.provider + '.js');
  return {
    send: msg => {
      const apiKey = process.env.ONESIGNAL_REST_API_KEY;
      if (!apiKey) return Promise.reject(new Error('нет ключа ONESIGNAL_REST_API_KEY (секрет GitHub)'));
      return mod.send(msg, { appId: conf.appId, apiKey });
    }
  };
}

async function run(opts) {
  const root = opts.root || REPO_ROOT;
  const mode = opts.mode || 'none';
  if (!LANGS.includes(opts.lang)) return { ok: false, sent: 0, errors: ['неизвестный язык «' + opts.lang + '»'] };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(opts.date || '')) return { ok: false, sent: 0, errors: ['неверная дата «' + opts.date + '»'] };
  if (!['all', 'test', 'none'].includes(mode)) return { ok: false, sent: 0, errors: ['неизвестный режим «' + mode + '»'] };
  if (mode === 'none') return { ok: true, skipped: 'mode-none', sent: 0, errors: [] };

  const file = path.join(root, '_src/news/digests', opts.date + '_' + opts.lang + '.json');
  if (!fs.existsSync(file)) return { ok: true, skipped: 'no-digest', sent: 0, errors: [] };
  let digest;
  try { digest = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return { ok: false, sent: 0, errors: ['данные сводки повреждены: ' + e.message] }; }
  if (!digest || digest.date !== opts.date || digest.lang !== opts.lang) return { ok: false, sent: 0, errors: ['данные сводки не соответствуют дате и языку'] };
  if (mode === 'all' && digest.sent && !opts.resend) return { ok: true, skipped: 'already-sent', sent: 0, errors: [] };

  const provider = opts.provider || defaultProvider(root);
  const plan = planSends(digest, opts.lang, { test: mode === 'test', nonce: opts.nonce });
  const errors = [], results = [];
  for (const msg of plan) {
    try { results.push(Object.assign({ combo: msg.categories }, await provider.send(msg))); }
    catch (e) { errors.push(CATS.filter(k => msg.categories[k]).join('+') + ': ' + e.message); }
  }
  if (mode === 'all' && !errors.length) {
    digest.sent = true;
    fs.writeFileSync(file, JSON.stringify(digest, null, 2) + '\n', 'utf8');
  }
  return { ok: !errors.length, sent: results.length, results, errors, plan };
}

// Дата последней сводки языка (для теста без даты) или null, если сводок нет
function latestDigestDate(root, lang) {
  const dir = path.join(root || REPO_ROOT, '_src/news/digests');
  if (!fs.existsSync(dir)) return null;
  const dates = fs.readdirSync(dir).map(f => f.match(/^(\d{4}-\d{2}-\d{2})_(ru|thai)\.json$/)).filter(m => m && m[2] === lang).map(m => m[1]).sort();
  return dates.length ? dates[dates.length - 1] : null;
}

module.exports = { planSends, run, providerName, uuidFrom, latestDigestDate };

if (require.main === module) {
  const { todayIn } = require('../build-news.js');
  const lang = process.env.NEWS_LANG;
  const date = process.env.NEWS_DATE || (LANGS.includes(lang) ? todayIn(lang) : '');
  const mode = process.env.PUSH_MODE || 'none';
  run({ root: process.env.PUSH_ROOT || REPO_ROOT, lang, date, mode, resend: process.env.PUSH_RESEND === 'true' }).then(r => {
    if (r.skipped === 'no-digest') console.log('Сводки ' + date + '_' + lang + ' нет — отправлять нечего.');
    else if (r.skipped === 'already-sent') console.log('Сводка ' + date + '_' + lang + ' уже отправлена. Для повтора — ручной запуск с флажком «повторить».');
    else if (r.skipped === 'mode-none') console.log('Режим none: ничего не отправляется.');
    (r.plan || []).forEach(p => console.log('[' + (p.test ? 'тест' : 'всем') + '] ' + CATS.filter(k => p.categories[k]).join('+') + ': «' + p.title + '» — ' + p.body + ' → ' + p.url));
    if (r.results) console.log('Отправлено групп: ' + r.sent + (r.results.length ? ' (получателей: ' + r.results.map(x => x.recipients === null ? '?' : x.recipients).join(', ') + ')' : ''));
    r.errors.forEach(e => {
      console.error('ОШИБКА: ' + e);
      if (process.env.GITHUB_ACTIONS) console.log('::error title=Рассылка пушей::' + e);
    });
    process.exitCode = r.ok ? 0 : 1;
  }, e => { console.error('ОШИБКА: ' + e.message); process.exitCode = 1; });
}
