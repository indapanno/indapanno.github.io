'use strict';
// Модуль рассылки OneSignal (ТЗ push_TZ.md, раздел 8): send(msg, { appId, apiKey, fetch }).
// msg = { title, body, url, tag, filters, idempotencyKey, ... } — из send.js (planSends).
// Ключ REST API — только из секрета GitHub ONESIGNAL_REST_API_KEY.
const cfg = require('../site-config.js');

const ENDPOINT = 'https://api.onesignal.com/notifications';
const ICON = cfg.absUrl('/img/icon-192.png');
const BADGE = cfg.absUrl('/img/badge-72.png');
// Ответ OneSignal, когда в группе нет ни одного подписчика: это не ошибка
const NO_RECIPIENTS = /not subscribed|no recipients|no subscribers/i;

function buildRequest(msg, opts) {
  return {
    url: ENDPOINT,
    method: 'POST',
    headers: { Authorization: 'Key ' + opts.apiKey, 'Content-Type': 'application/json; charset=utf-8', Accept: 'application/json' },
    body: {
      app_id: opts.appId,
      target_channel: 'push',
      filters: msg.filters,
      headings: { en: msg.title },
      contents: { en: msg.body },
      url: msg.url,
      web_push_topic: msg.tag,
      chrome_web_icon: ICON,
      chrome_web_badge: BADGE,
      firefox_icon: ICON,
      idempotency_key: msg.idempotencyKey
    }
  };
}

async function send(msg, opts) {
  const req = buildRequest(msg, opts);
  const doFetch = opts.fetch || globalThis.fetch;
  const res = await doFetch(req.url, { method: req.method, headers: req.headers, body: JSON.stringify(req.body) });
  let data = null;
  try { data = await res.json(); } catch (e) { /* пустой ответ */ }
  const errors = data && data.errors ? [].concat(Array.isArray(data.errors) ? data.errors : Object.values(data.errors)).map(String) : [];
  if (!res.ok) throw new Error('OneSignal HTTP ' + res.status + (errors.length ? ': ' + errors.join('; ') : ''));
  if (errors.length) {
    if (errors.every(e => NO_RECIPIENTS.test(e))) return { id: (data && data.id) || '', recipients: 0 };
    throw new Error('OneSignal: ' + errors.join('; '));
  }
  return { id: (data && data.id) || '', recipients: data && typeof data.recipients === 'number' ? data.recipients : null };
}

module.exports = { buildRequest, send, ENDPOINT };
