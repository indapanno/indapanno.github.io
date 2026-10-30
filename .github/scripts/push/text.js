'use strict';
// Тексты пушей (ТЗ push_TZ.md, 5.2–5.3). message(digest, lang, cats) → { title, body, url } | null.
// Заголовок — самое ценное в сводке (публикации → связки → термины), текст — остальное.
// Только категории читателя (cats); в сводке нет его категорий → null (пуш не уходит).
// Клик: один пункт для читателя — сразу на него, иначе — страница сводки.
const path = require('path');
const cfg = require('../site-config.js');
const { toThaiNumerals } = require(path.resolve(__dirname, '../../../js/thai-numerals.js'));

const TITLE_MAX = 60, BODY_MAX = 120;

function plural(n, f) {
  const a = n % 10, b = n % 100;
  if (a === 1 && b !== 11) return f[0];
  if (a >= 2 && a <= 4 && (b < 10 || b >= 20)) return f[1];
  return f[2];
}
const num = (lang, n) => (lang === 'thai' ? toThaiNumerals(n) : String(n));
const q = (lang, s) => (lang === 'thai' ? '“' + s + '”' : '«' + s + '»');
const lowerFirst = s => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s);

// Обрезка по слову с «…» (тайский — по словам через Intl.Segmenter)
function clip(text, max, lang) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  let cut;
  if (lang === 'thai' && typeof Intl !== 'undefined' && Intl.Segmenter) {
    cut = '';
    for (const seg of new Intl.Segmenter('th', { granularity: 'word' }).segment(t)) {
      if ((cut + seg.segment).length > max - 1) break;
      cut += seg.segment;
    }
  } else {
    cut = t.slice(0, max - 1);
    if (/\S/.test(t.charAt(max - 1))) cut = cut.replace(/\s+\S*$/, '');
  }
  return cut.replace(/[\s,;:—«“-]+$/, '') + '…';
}

// Заголовок «Новая публикация: «…»» с обрезкой только названия (кавычки сохраняются)
function titleWithName(lang, prefix, name) {
  const room = TITLE_MAX - prefix.length - 2;
  const n = String(name).replace(/\s+/g, ' ').trim();
  return prefix + q(lang, n.length <= room ? n : clip(n, room, lang));
}

const KIND = {
  publications: {
    one: { ru: 'Новая публикация: ', thai: 'บทความใหม่: ' },
    many: { ru: n => n + ' ' + plural(n, ['новая публикация', 'новые публикации', 'новых публикаций']), thai: n => 'บทความใหม่ ' + toThaiNumerals(n) + ' เรื่อง' },
    count: { ru: n => n + ' ' + plural(n, ['публикация', 'публикации', 'публикаций']), thai: n => 'บทความ ' + toThaiNumerals(n) + ' เรื่อง' },
    name: x => x.headline, text: x => x.lead
  },
  bundles: {
    one: { ru: 'Новые связанные термины: ', thai: 'ชุดศัพท์ใหม่: ' },
    many: { ru: n => n + ' ' + plural(n, ['новая связка', 'новые связки', 'новых связок']), thai: n => 'ชุดศัพท์ใหม่ ' + toThaiNumerals(n) + ' ชุด' },
    count: { ru: n => n + ' ' + plural(n, ['связка', 'связки', 'связок']), thai: n => 'ชุดศัพท์ ' + toThaiNumerals(n) + ' ชุด' },
    name: x => x.name, text: x => x.description
  },
  terms: {
    one: { ru: 'Новый термин: ', thai: 'คำศัพท์ใหม่: ' },
    many: { ru: n => n + ' ' + plural(n, ['новый термин', 'новых термина', 'новых терминов']), thai: n => 'คำศัพท์ใหม่ ' + toThaiNumerals(n) + ' คำ' },
    count: { ru: n => n + ' ' + plural(n, ['термин', 'термина', 'терминов']), thai: n => 'คำศัพท์ ' + toThaiNumerals(n) + ' คำ' },
    name: x => x.name, text: x => x.snippet
  }
};
const ORDER = ['publications', 'bundles', 'terms'];

function message(digest, lang, cats) {
  const items = {};
  ORDER.forEach(k => { items[k] = cats && cats[k] && Array.isArray(digest[k]) ? digest[k] : []; });
  const present = ORDER.filter(k => items[k].length);
  if (!present.length) return null;
  const main = present[0], list = items[main], K = KIND[main];
  const rest = present.slice(1);
  const total = present.reduce((s, k) => s + items[k].length, 0);

  let title, body;
  if (list.length === 1) {
    title = main === 'terms' ? K.one[lang] + String(K.name(list[0])).trim() : titleWithName(lang, K.one[lang], K.name(list[0]));
    title = clip(title, TITLE_MAX, lang);
    body = rest.length ? null : (K.text(list[0]) || '');
  } else {
    title = K.many[lang](list.length);
    if (rest.length) body = null;
    else if (main === 'terms') {
      const shown = list.slice(0, 3).map((x, i) => (lang === 'ru' && i ? lowerFirst(x.name) : x.name));
      const more = list.length - shown.length;
      body = shown.join(', ') + (more > 0 ? (lang === 'thai' ? ' และอีก ' + num(lang, more) + ' คำ' : ' и ещё ' + more) : '');
    } else {
      // названия по очереди, пока помещаются
      const names = list.map(x => q(lang, String(K.name(x)).trim()));
      body = names.join(', ');
      if (body.length > BODY_MAX) {
        let acc = '';
        for (let i = 0; i < names.length; i++) {
          const left = names.length - i - 1;
          const tail = left ? (lang === 'thai' ? ' และอีก ' + num(lang, left) : ' и ещё ' + left) : '';
          const next = (acc ? acc + ', ' : '') + names[i];
          if ((next + tail).length > BODY_MAX) break;
          acc = next;
        }
        const left = names.length - (acc ? acc.split(', ').length : 0);
        body = acc ? acc + (lang === 'thai' ? ' และอีก ' + num(lang, left) : ' и ещё ' + left) : clip(names.join(', '), BODY_MAX, lang);
      }
    }
  }
  if (body === null) {
    const parts = rest.map(k => KIND[k].count[lang](items[k].length));
    body = lang === 'thai' ? 'และอีก ' + parts.join(', ') : 'И ещё ' + parts.join(' и ');
  }
  body = clip(body, BODY_MAX, lang);

  const url = total === 1 ? cfg.absUrl(list[0].url) : cfg.newsDigestUrl(digest.date, lang);
  return { title, body, url };
}

module.exports = { message, clip, TITLE_MAX, BODY_MAX };
