'use strict';
// Сборка страниц «Публикации» (ТЗ: publications_TZ.md).
// Независим от build-terms.js и build-bundles.js: только ЧИТАЕТ термины из json/,
// пишет только в publications/*.html и sitemap_publications.xml (корень сайта).
// Исходники: _src/publications (json/, html/, template/); обложки: publications/covers.
// Ошибочная публикация не создаётся; остальные собираются, в конце процесс завершается с кодом 1.
// Без внешних зависимостей.
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '../..');
const cfg = require('./site-config.js');
const { escapeHtml } = require(path.join(REPO_ROOT, 'js/render-term.js'));
const { toThaiNumerals } = require(path.join(REPO_ROOT, 'js/thai-numerals.js'));

const LANGS = ['ru', 'thai'];
const PAGE_SIZE = 10; // как в навигаторе и у связок
const KEYS = ['cover', 'headline', 'lead', 'html'];
const ALPHABET = { ru: /[А-Яа-яЁё]/, thai: /[\u0E00-\u0E7F]/ };
const OG_LOCALE = { ru: 'ru_RU', thai: 'th_TH' };
const NAV_TITLE_TEXT = { ru: 'Навигатор по палийским терминам', thai: 'นำทางคำศัพท์บาลี' };
const IMG_MAX_BYTES = 1024 * 1024;
const COVER_MIN_WIDTH = 1200;
const COVER_RATIO = 1200 / 630;
const HEADLINE_WARN = 120, LEAD_WARN = 400, TEXT_WARN = 300, META_DESC_MAX = 300;

const S = {
  ru: {
    title: 'Публикации', nav: 'Навигатор по терминам',
    empty: 'Публикации пока не добавлены.',
    desc: 'Публикации о буддизме: статьи, которые помогают разобраться в ключевых понятиях учения и в том, как применять их на практике.',
    back1: '← Назад', next1: 'Далее →', pages: 'Страницы', pageWord: 'страница',
    toc: 'Содержание',
    more: 'Читать далее',
    cta: { q: 'Хотите узнавать о новых публикациях?', note: 'Не чаще раза в день.', btn: 'Подписаться' },
    callout: { key: 'Ключевая мысль', practice: 'Практика', important: 'Важно' }
  },
  thai: {
    title: 'บทความ', nav: 'นำทางคำศัพท์',
    empty: 'ยังไม่มีบทความ',
    desc: 'บทความเกี่ยวกับพระพุทธศาสนา ช่วยให้เข้าใจแนวคิดสำคัญของคำสอนและการนำไปใช้ในชีวิตจริง',
    back1: '← ย้อนกลับ', next1: 'ถัดไป →', pages: 'หน้า', pageWord: 'หน้า',
    toc: 'สารบัญ',
    more: 'อ่านต่อ',
    cta: { q: 'อยากรู้เมื่อมีบทความใหม่ไหม?', note: 'แจ้งเตือนไม่เกินวันละครั้ง', btn: 'ติดตาม' },
    callout: { key: 'ประเด็นสำคัญ', practice: 'ลงมือปฏิบัติ', important: 'โปรดทราบ' }
  }
};

// --- Данные обычных терминов (только чтение) ---
function loadTerms(termsDir) {
  const out = { ru: new Map(), thai: new Map() }; // id -> { interp, name } (толкование и название для поповера)
  const dir = path.join(termsDir, 'json');
  if (!fs.existsSync(dir)) return out;
  LANGS.forEach(lang => {
    const suffix = '_' + lang + '.json';
    fs.readdirSync(dir).filter(f => f.endsWith(suffix) && !f.startsWith('index'))
      .forEach(f => {
        let interp = '', name = '';
        try {
          const d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8').replace(/^\uFEFF/, ''));
          if (d && typeof d.interpretation === 'string') interp = d.interpretation;
          const nm = d && d[lang === 'thai' ? 'term_thai' : 'term_ru'];
          if (typeof nm === 'string') name = nm.replace(/\s+/g, ' ').trim();
        } catch (e) { /* карточку проверяет сборка терминов */ }
        // Русское название — с заглавной буквы; тайское как есть
        if (name && lang === 'ru') name = name.charAt(0).toUpperCase() + name.slice(1);
        out[lang].set(f.slice(0, -suffix.length), { interp, name });
      });
  });
  return out;
}

// --- Картинки: сигнатура и размеры без внешних библиотек ---
function imageInfo(buf) {
  if (buf.length >= 24 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) {
    return { type: 'png', w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  }
  if (buf.length >= 4 && buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xFF) { i++; continue; }
      const m = buf[i + 1];
      if (m === 0xFF) { i++; continue; }
      if (m === 0xD8 || m === 0x01 || (m >= 0xD0 && m <= 0xD7)) { i += 2; continue; }
      const len = buf.readUInt16BE(i + 2);
      if (m >= 0xC0 && m <= 0xCF && m !== 0xC4 && m !== 0xC8 && m !== 0xCC) {
        return { type: 'jpg', h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
      }
      i += 2 + len;
    }
    return { type: 'jpg', w: 0, h: 0 };
  }
  return null;
}

// Проверка файла в covers/. Возвращает { error: {code,msg} | null, info }
function checkImageFile(coversDir, name) {
  const file = path.join(coversDir, name);
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return { error: { kind: 'missing', msg: 'нет файла «' + name + '» в publications/covers' } };
  if (!/\.(jpe?g|png)$/i.test(name)) return { error: { kind: 'bad', msg: 'файл «' + name + '»: допустимы только jpg, jpeg, png' } };
  const buf = fs.readFileSync(file);
  if (buf.length > IMG_MAX_BYTES) return { error: { kind: 'bad', msg: 'файл «' + name + '» больше 1 МБ (' + Math.round(buf.length / 1024) + ' КБ)' } };
  const info = imageInfo(buf);
  if (!info) return { error: { kind: 'bad', msg: 'файл «' + name + '» не является картинкой jpg/png' } };
  return { error: null, info };
}

// --- Проверка одного JSON плитки (ошибки №1–10, предупреждения) ---
function validateJson(file, lang, text, ctx) {
  const errors = [], warnings = [];
  const err = (code, msg) => errors.push({ code, file, msg });
  let data;
  try { data = JSON.parse(text.replace(/^\uFEFF/, '')); } catch (e) { err(2, 'невалидный JSON: ' + e.message); return { errors, warnings, data: null }; }
  if (!data || typeof data !== 'object' || Array.isArray(data)) { err(2, 'корень JSON должен быть объектом'); return { errors, warnings, data: null }; }

  KEYS.forEach(k => { if (!(k in data)) err(3, 'отсутствует ключ «' + k + '»'); });
  Object.keys(data).forEach(k => { if (!KEYS.includes(k)) err(3, 'лишний ключ «' + k + '»'); });
  KEYS.forEach(k => {
    if (!(k in data)) return;
    if (typeof data[k] !== 'string' || !data[k].trim()) err(4, '«' + k + '» должно быть непустой строкой');
  });
  ['headline', 'lead'].forEach(k => {
    if (typeof data[k] === 'string' && data[k].trim() && !ALPHABET[lang].test(data[k])) err(9, 'текст «' + k + '» не на языке файла (' + lang + ')');
  });

  const okStr = k => typeof data[k] === 'string' && data[k].trim();
  let coverOk = false, htmlOk = false;
  if (okStr('cover')) {
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(data.cover)) err(5, '«cover» должно быть именем файла без папок и пробелов');
    else coverOk = true;
  }
  if (okStr('html')) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*\.html$/.test(data.html)) err(5, '«html»: имя статьи — строчные латинские буквы, цифры и дефис, оканчивается на .html');
    else if (data.html === 'index.html' || data.html.startsWith('publications_')) err(15, '«html»: имя «' + data.html + '» зарезервировано (нельзя «index» и имена, начинающиеся с «publications_»)');
    else htmlOk = true;
  }
  if (coverOk) {
    const r = checkImageFile(ctx.coversDir, data.cover);
    if (r.error) err(r.error.kind === 'missing' ? 6 : 8, 'обложка: ' + r.error.msg);
    else if (r.info.w && r.info.h) {
      if (r.info.w < COVER_MIN_WIDTH) warnings.push({ file, msg: 'обложка уже ' + COVER_MIN_WIDTH + ' px (' + r.info.w + '×' + r.info.h + ')' });
      else if (Math.abs(r.info.w / r.info.h / COVER_RATIO - 1) > 0.05) warnings.push({ file, msg: 'пропорция обложки ' + r.info.w + '×' + r.info.h + ' заметно отличается от 1200×630' });
    }
  }
  if (htmlOk && !fs.existsSync(path.join(ctx.htmlDir, data.html))) err(7, 'нет файла статьи «' + data.html + '» в _src/publications/html');
  if (okStr('headline') && data.headline.length > HEADLINE_WARN) warnings.push({ file, msg: '«headline» длиннее ' + HEADLINE_WARN + ' символов (' + data.headline.length + ')' });
  if (okStr('lead') && data.lead.length > LEAD_WARN) warnings.push({ file, msg: '«lead» длиннее ' + LEAD_WARN + ' символов (' + data.lead.length + ')' });
  return { errors, warnings, data: errors.length ? null : data };
}

// --- Статья: проверка и преобразование HTML-фрагмента ---
const VOID = new Set(['br', 'hr', 'img']);
const ALLOWED = {
  h2: [], h3: [], p: [], ul: [], ol: [], li: [], strong: [], em: [], br: [], sup: [], sub: [], code: [], small: [], hr: [],
  a: ['href', 'data-term'], blockquote: [], cite: [], aside: ['class'], figure: [], figcaption: [], img: ['src', 'alt'],
  details: [], summary: [], table: [], thead: [], tbody: [], tr: [], th: ['colspan', 'rowspan'], td: ['colspan', 'rowspan']
};
const CALLOUT_CLASSES = ['callout', 'callout--key', 'callout--practice', 'callout--important'];
const TAG_RE = /<!--[\s\S]*?-->|<(\/?)([A-Za-z][A-Za-z0-9]*)((?:\s+[^\s"'<>\/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*(\/?)>/g;
const ATTR_RE = /([^\s"'<>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

// Следы ИИ-ассистентов, которые не должны попасть в статью: «[cite: 2]», «oaicite», «【…】» и т.п.
const AI_JUNK = /\[(?:cite|cite_start|source)[^\]]*\]|oaicite|contentReference|turn\d+(?:search|view|news|image|file)\d+|【[^】]*】/i;

const escAttr = v => String(v).replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const plain = s => s.replace(/&[A-Za-z#0-9]+;/g, ' ').replace(/\s+/g, ' ').trim();

// --- Обогатители публикаций: <div data-widget="…"> (widgets_TZ.md) ---
// Обёртка только на верхнем уровне статьи; внутри — проверка структуры своими правилами, затем
// тот же разбор процессором статьи (ссылки, термины, экранирование), чтобы правила были едиными.
const WIDGET_KINDS = ['checklist', 'faq', 'publication'];
const PUB_NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*\.html$/;
const INLINE_TAGS = new Set(['strong', 'em', 'a', 'sup', 'sub', 'code', 'small', 'br']);
const FAQ_SUMMARY_TAGS = new Set(['strong', 'em']);
const FAQ_ANSWER_TAGS = new Set(['p', 'ul', 'ol', 'li', 'blockquote', 'cite', 'strong', 'em', 'a', 'sup', 'sub', 'code', 'small', 'br']);
const escData = v => String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Плитка публикации: одна функция для списка и для вставки в статью
function tileAnchor(lang, d) {
  return '<a class="pub-tile" href="' + cfg.articlePath(d.html) + '">'
    + '<span class="pub-tile-cover"><img src="' + escapeHtml(cfg.coverPath(d.cover)) + '" alt="" loading="lazy" width="1200" height="630"></span>'
    + '<span class="pub-tile-body"><span class="pub-tile-title">' + escapeHtml(d.headline) + '</span>'
    + '<span class="pub-tile-lead">' + escapeHtml(d.lead) + '</span>'
    + '<span class="pub-tile-more">' + S[lang].more + '</span></span></a>';
}

// Теги и текст фрагмента по порядку (свой экземпляр регулярки: общий TAG_RE не трогаем)
function scanTokens(inner) {
  const re = new RegExp(TAG_RE.source, 'g');
  const out = [];
  let last = 0, m;
  while ((m = re.exec(inner)) !== null) {
    if (m.index > last) out.push({ text: inner.slice(last, m.index) });
    last = re.lastIndex;
    if (m[0].startsWith('<!--')) continue;
    out.push({ closing: m[1] === '/', tag: m[2].toLowerCase(), start: m.index, end: re.lastIndex, attrs: (m[3] || '').trim() });
  }
  if (last < inner.length) out.push({ text: inner.slice(last) });
  return out;
}
const isWs = t => t.text !== undefined && !t.text.trim();
const isTag = (t, name, closing) => !!t && t.text === undefined && t.tag === name && t.closing === closing;
const emptyText = raw => !plain(raw.replace(/<[^>]*>/g, ' '));

function parseChecklist(inner) {
  const bad = msg => ({ error: { code: 17, msg: 'чек-лист: ' + msg } });
  const T = scanTokens(inner);
  const items = [];
  let i = 0, seenUl = false;
  while (i < T.length) {
    if (isWs(T[i])) { i++; continue; }
    if (!isTag(T[i], 'ul', false) || seenUl) return bad('внутри обёртки нужен ровно один список <ul> без другого содержимого');
    if (T[i].attrs) return bad('<ul> без атрибутов');
    seenUl = true; i++;
    let closed = false;
    while (i < T.length) {
      const u = T[i];
      if (isWs(u)) { i++; continue; }
      if (isTag(u, 'ul', true)) { closed = true; i++; break; }
      if (!isTag(u, 'li', false)) return bad('внутри <ul> разрешены только пункты <li>');
      if (u.attrs) return bad('<li> без атрибутов');
      const from = u.end;
      i++;
      let ok = false;
      while (i < T.length) {
        const v = T[i];
        if (v.text !== undefined) { i++; continue; }
        if (isTag(v, 'li', true)) { ok = true; break; }
        if (!INLINE_TAGS.has(v.tag)) return bad('в пункте разрешены только строчные теги, найден <' + v.tag + '>');
        i++;
      }
      if (!ok) return bad('не закрыт <li>');
      const raw = inner.slice(from, T[i].start);
      if (emptyText(raw)) return bad('пустой пункт');
      items.push(raw.trim());
      i++;
    }
    if (!closed) return bad('не закрыт <ul>');
  }
  if (!seenUl) return bad('нет списка <ul>');
  if (!items.length) return bad('в списке нет пунктов');
  return { items };
}

function parseFaq(inner) {
  const bad = msg => ({ error: { code: 18, msg: 'вопросы и ответы: ' + msg } });
  const T = scanTokens(inner);
  const items = [];
  let i = 0;
  while (i < T.length) {
    if (isWs(T[i])) { i++; continue; }
    if (!isTag(T[i], 'details', false)) return bad('внутри обёртки разрешены только <details>');
    if (T[i].attrs) return bad('<details> без атрибутов');
    i++;
    while (i < T.length && isWs(T[i])) i++;
    if (!isTag(T[i], 'summary', false)) return bad('<details> должен начинаться с <summary>');
    const sFrom = T[i].end;
    i++;
    while (i < T.length && !isTag(T[i], 'summary', true)) {
      if (T[i].text === undefined && !FAQ_SUMMARY_TAGS.has(T[i].tag)) return bad('в <summary> разрешены только <strong> и <em>, найден <' + T[i].tag + '>');
      i++;
    }
    if (i >= T.length) return bad('не закрыт <summary>');
    const sRaw = inner.slice(sFrom, T[i].start), aFrom = T[i].end;
    i++;
    while (i < T.length && !isTag(T[i], 'details', true)) {
      if (T[i].text === undefined && !FAQ_ANSWER_TAGS.has(T[i].tag)) return bad('в ответе недопустим <' + T[i].tag + '>');
      i++;
    }
    if (i >= T.length) return bad('не закрыт <details>');
    const aRaw = inner.slice(aFrom, T[i].start);
    i++;
    if (emptyText(sRaw)) return bad('пустой вопрос (<summary>)');
    if (emptyText(aRaw)) return bad('пустой ответ');
    items.push({ q: sRaw.trim(), a: aRaw.trim() });
  }
  if (!items.length) return bad('нет ни одного <details>');
  return { items };
}

// Возвращает { html, text, soft } или { error: {code, msg} }
function renderWidget(kind, attrs, inner, lang, ctx, wstate) {
  const soft = [];
  let text = '';
  const sub = raw => {
    const r = processArticle(raw, lang, ctx, { inner: true });
    r.soft.forEach(x => soft.push(x));
    text += ' ' + r.text;
    return r;
  };
  const subFail = (r, where) => ({ error: { code: 11, msg: where + ': ' + r.errors[0].msg } });

  if (kind === 'checklist') {
    const p = parseChecklist(inner);
    if (p.error) return p;
    const lis = [];
    for (const raw of p.items) {
      const r = sub(raw);
      if (r.errors.length) return subFail(r, 'чек-лист');
      lis.push('<li><label><input type="checkbox"><span>' + r.html + '</span></label></li>');
    }
    wstate.check++;
    return { soft, text, html: '<div class="pub-check" data-check="' + wstate.check + '">'
      + '<ul class="pub-check-list">' + lis.join('') + '</ul></div>' };
  }

  if (kind === 'faq') {
    const p = parseFaq(inner);
    if (p.error) return p;
    const parts = [];
    for (const it of p.items) {
      const q = sub(it.q);
      if (q.errors.length) return subFail(q, 'вопросы и ответы');
      const a = sub(it.a);
      if (a.errors.length) return subFail(a, 'вопросы и ответы');
      parts.push('<details class="pub-faq-item"><summary>' + q.html + '</summary><div class="pub-faq-answer">' + a.html + '</div></details>');
    }
    return { soft, text, html: '<div class="pub-faq">' + parts.join('') + '</div>' };
  }

  // publication
  const bad = msg => ({ error: { code: 19, msg: 'плитка: ' + msg } });
  if (!('data-publication' in attrs)) return bad('нет атрибута data-publication');
  const name = attrs['data-publication'].trim();
  if (!PUB_NAME_RE.test(name)) return bad('data-publication «' + name.slice(0, 40) + '»: нужно имя статьи (строчные латинские буквы, цифры, дефис, .html)');
  if (inner.trim()) return bad('обёртка должна быть пустой');
  const map = ctx.pubMap && ctx.pubMap[lang];
  const d = map && map.get(name);
  if (d) return { soft, text, html: '<div class="pub-tile-embed">' + tileAnchor(lang, d) + '</div>' };
  const other = lang === 'ru' ? 'thai' : 'ru';
  if (ctx.pubAny && ctx.pubAny[other].has(name) && !ctx.pubAny[lang].has(name)) return bad('публикация «' + name + '» на другом языке; плитка только того же языка');
  soft.push({ code: 20, msg: 'плитка: публикации «' + name + '» нет или она не создана из-за ошибки; плитка не выведена' });
  return { soft, text, html: '' };
}

function processArticle(src, lang, ctx, opts) {
  const errors = [], soft = [];
  const wstate = { check: 0 };
  const fail = msg => errors.push({ code: 11, msg });
  const out = [];
  const stack = [];
  const h2s = [];
  let secN = 0, text = '', h2Open = null;

  const addText = raw => {
    out.push(raw);
    text += ' ' + plain(raw);
    if (h2Open) h2Open.raw += raw;
  };

  TAG_RE.lastIndex = 0;
  let last = 0, m;
  const rest = src.replace(/^\uFEFF/, '');
  while ((m = TAG_RE.exec(rest)) !== null) {
    const between = rest.slice(last, m.index);
    if (between.includes('<')) { fail('лишний символ «<» в тексте (используйте &lt;): «' + between.slice(between.indexOf('<'), between.indexOf('<') + 30).replace(/\s+/g, ' ') + '»'); break; }
    const junk1 = between.match(AI_JUNK);
    if (junk1) { fail('служебный мусор ИИ в тексте: «' + junk1[0].slice(0, 40) + '»'); break; }
    if (between) addText(between);
    last = TAG_RE.lastIndex;
    if (m[0].startsWith('<!--')) continue;

    const closing = m[1] === '/', tag = m[2].toLowerCase(), attrSrc = m[3] || '', selfClose = m[4] === '/';
    if (tag === 'div') {
      if (closing) { fail('закрывающий </div> без открывающего <div data-widget="…">'); break; }
      const wa = {};
      let wm;
      ATTR_RE.lastIndex = 0;
      while ((wm = ATTR_RE.exec(attrSrc)) !== null) wa[wm[1].toLowerCase()] = wm[2] !== undefined ? wm[2] : wm[3] !== undefined ? wm[3] : wm[4] !== undefined ? wm[4] : '';
      if (!('data-widget' in wa)) { fail('тег <div> не разрешён (допустим только <div data-widget="checklist|faq|publication">)'); break; }
      const w16 = msg => errors.push({ code: 16, msg });
      const kind = wa['data-widget'].trim();
      if (!WIDGET_KINDS.includes(kind)) { w16('неизвестное значение data-widget «' + kind + '» (допустимо: ' + WIDGET_KINDS.join(', ') + ')'); break; }
      const extra = Object.keys(wa).filter(k => k !== 'data-widget' && !(kind === 'publication' && k === 'data-publication'));
      if (extra.length) { w16('у обёртки «' + kind + '» лишние атрибуты: ' + extra.join(', ')); break; }
      if (stack.length) { w16('обёртка data-widget допустима только на верхнем уровне статьи (найдена внутри <' + stack[stack.length - 1].tag + '>)'); break; }
      const from = TAG_RE.lastIndex;
      const closeRe = /<\/div\s*>/gi;
      closeRe.lastIndex = from;
      const cm = closeRe.exec(rest);
      if (!cm) { w16('не закрыта обёртка <div data-widget="' + kind + '">'); break; }
      const inner = rest.slice(from, cm.index);
      if (/<div[\s>\/]/i.test(inner)) { w16('внутри обёртки «' + kind + '» не может быть другой <div>'); break; }
      const w = renderWidget(kind, wa, inner, lang, ctx, wstate);
      if (w.error) { errors.push(w.error); break; }
      out.push(w.html);
      text += ' ' + w.text;
      w.soft.forEach(x => soft.push(x));
      last = cm.index + cm[0].length;
      TAG_RE.lastIndex = last; // рекурсивный разбор внутри обёртки сбрасывает общий счётчик
      continue;
    }
    if (!(tag in ALLOWED)) { fail('тег <' + tag + '> не разрешён'); break; }

    if (closing) {
      if (VOID.has(tag)) { fail('закрывающий тег </' + tag + '> не нужен'); break; }
      const top = stack.pop();
      if (!top || top.tag !== tag) { fail('закрывающий </' + tag + '> не соответствует открытому' + (top ? ' <' + top.tag + '>' : '')); break; }
      if (top.drop) continue;
      if (tag === 'table') out.push('</table></div>');
      else if (tag === 'h2') { out.push('</h2>'); h2s.push({ id: h2Open.id, raw: h2Open.raw }); h2Open = null; }
      else out.push('</' + tag + '>');
      continue;
    }

    // Открывающий тег: разбор атрибутов
    const attrs = {};
    let bad = false;
    let am;
    ATTR_RE.lastIndex = 0;
    while ((am = ATTR_RE.exec(attrSrc)) !== null) {
      const name = am[1].toLowerCase();
      const val = am[2] !== undefined ? am[2] : am[3] !== undefined ? am[3] : am[4] !== undefined ? am[4] : '';
      if (!ALLOWED[tag].includes(name)) { fail('атрибут «' + name + '» не разрешён в <' + tag + '>'); bad = true; break; }
      attrs[name] = val;
    }
    if (bad) break;
    if (selfClose && !VOID.has(tag)) { fail('тег <' + tag + '> нельзя закрывать как <' + tag + '/>'); break; }

    let drop = false;
    let open;
    if (tag === 'a') {
      if ('href' in attrs && 'data-term' in attrs) { fail('<a> не может иметь одновременно href и data-term'); break; }
      if ('data-term' in attrs) {
        const id = attrs['data-term'].trim();
        if (!ctx.terms[lang].has(id)) { soft.push({ code: 13, msg: 'ссылка на термин «' + id + '»: термина нет или он не переведён на язык статьи; ссылка заменена текстом' }); drop = true; }
        else {
          const info = ctx.terms[lang].get(id) || {};
          const interp = (info.interp || '').replace(/\s+/g, ' ').trim();
          open = '<a href="' + escAttr(cfg.cardPath(id, lang)) + '" target="_blank" rel="noopener noreferrer"'
            + (interp ? ' class="pub-term"' + (info.name ? ' data-title="' + escData(info.name) + '"' : '') + ' data-interp="' + escData(interp) + '"' : '') + '>';
        }
      } else if ('href' in attrs) {
        const href = attrs.href.trim();
        if (!href) { fail('<a> с пустым href'); break; }
        if (/^https:\/\//i.test(href)) open = '<a href="' + escAttr(href) + '" target="_blank" rel="noopener noreferrer">';
        else if (/^[a-z][a-z0-9+.-]*:/i.test(href)) { fail('ссылка «' + href.slice(0, 40) + '»: разрешены только https:// и относительные адреса'); break; }
        else open = '<a href="' + escAttr(href) + '">';
      } else { fail('<a> без href и без data-term'); break; }
    } else if (tag === 'img') {
      const srcName = (attrs.src || '').trim();
      if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(srcName)) { fail('<img>: src должен быть именем файла из publications/covers (без папок и ссылок)'); break; }
      if (!(attrs.alt || '').trim()) { fail('<img src="' + srcName + '">: alt обязателен'); break; }
      const r = checkImageFile(ctx.coversDir, srcName);
      if (r.error) { soft.push({ code: 14, msg: 'рисунок: ' + r.error.msg + '; рисунок пропущен' }); drop = true; }
      else {
        const size = r.info.w && r.info.h ? ' width="' + r.info.w + '" height="' + r.info.h + '"' : '';
        open = '<img src="' + escAttr(cfg.coverPath(srcName)) + '" alt="' + escAttr(attrs.alt.trim()) + '"' + size + ' loading="lazy">';
      }
    } else if (tag === 'aside') {
      const classes = (attrs.class || '').split(/\s+/).filter(Boolean);
      if (!classes.length || classes.some(c => !CALLOUT_CLASSES.includes(c))) { fail('<aside>: class только из ' + CALLOUT_CLASSES.join(', ')); break; }
      const variant = classes.filter(c => c !== 'callout');
      if (variant.length > 1) { fail('<aside>: допустим один вариант выноски'); break; }
      const key = variant.length ? variant[0].slice('callout--'.length) : '';
      open = '<aside class="callout' + (variant.length ? ' ' + variant[0] : '') + '">' + (key ? '<div class="callout-title">' + S[lang].callout[key] + '</div>' : '');
    } else if (tag === 'th' || tag === 'td') {
      const parts = Object.keys(attrs).map(k => {
        if (!/^\d{1,2}$/.test(attrs[k])) { fail('<' + tag + '>: ' + k + ' должен быть числом'); bad = true; }
        return ' ' + k + '="' + attrs[k] + '"';
      });
      if (bad) break;
      open = '<' + tag + parts.join('') + '>';
    } else if (tag === 'h2' || tag === 'h3') {
      secN++;
      open = '<' + tag + ' id="s' + secN + '">';
      if (tag === 'h2') h2Open = { id: 's' + secN, raw: '' };
    } else if (tag === 'table') {
      open = '<div class="table-scroll"><table>';
    } else {
      open = '<' + tag + '>';
    }

    if (!VOID.has(tag)) stack.push({ tag, drop });
    if (!drop) out.push(open);
  }
  const tail = rest.slice(last);
  if (!errors.length) {
    const junk2 = tail.match(AI_JUNK);
    if (tail.includes('<')) fail('лишний символ «<» в тексте (используйте &lt;)');
    else if (junk2) fail('служебный мусор ИИ в тексте: «' + junk2[0].slice(0, 40) + '»');
    else if (tail) addText(tail);
  }
  if (!errors.length && stack.length) fail('не закрыт тег <' + stack[stack.length - 1].tag + '>');

  const clean = text.replace(/\s+/g, ' ').trim();
  if (!errors.length && !clean && !(opts && opts.inner)) errors.push({ code: 12, msg: 'статья пустая' });
  return { errors, soft, html: out.join(''), text: clean, h2s };
}

// --- HTML страниц ---
function fill(layout, v) {
  const rep = { '{{TITLE}}': v.title, '{{HEAD}}': v.head, '{{H1}}': v.h1, '{{MAIN}}': v.main };
  let s = layout;
  Object.keys(rep).forEach(k => { s = s.split(k).join(rep[k]); });
  return s;
}

function crumbs(lang, items) {
  const all = [{ text: S[lang].nav, href: cfg.navHomePath(lang) }].concat(items);
  return '<nav class="breadcrumb">' + all.map((c, i) => (i ? '<span class="sep">/</span>' : '')
    + (c.href ? '<a href="' + c.href + '">' + escapeHtml(c.text) + '</a>' : '<span class="current">' + escapeHtml(c.text) + '</span>')).join('') + '</nav>\n  ';
}

const digits = (lang, n) => (lang === 'thai' ? toThaiNumerals(n) : String(n));

function pagination(lang, page, total) {
  if (total <= 1) return '';
  const st = S[lang];
  const parts = [];
  if (page > 1) parts.push('<a href="' + cfg.publications.path(lang, page - 1) + '" class="page-link">' + st.back1 + '</a>');
  for (let p = 1; p <= total; p++) {
    parts.push(p === page ? '<span class="page-current">' + digits(lang, p) + '</span>'
      : '<a href="' + cfg.publications.path(lang, p) + '" class="page-link">' + digits(lang, p) + '</a>');
  }
  if (page < total) parts.push('<a href="' + cfg.publications.path(lang, page + 1) + '" class="page-link">' + st.next1 + '</a>');
  return '<nav class="pagination" aria-label="' + st.pages + '">' + parts.join('') + '</nav>';
}

function clipMeta(text, max, lang) {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  if (lang === 'thai' && typeof Intl !== 'undefined' && Intl.Segmenter) {
    let acc = '';
    for (const seg of new Intl.Segmenter('th', { granularity: 'word' }).segment(t)) {
      if ((acc + seg.segment).length > max) break;
      acc += seg.segment;
    }
    return acc.trim() + '…';
  }
  return t.slice(0, max).replace(/\s+\S*$/, '') + '…';
}

function metaTags(lang, o) {
  const t = [];
  t.push('<link rel="canonical" href="' + o.url + '">');
  (o.extra || []).forEach(x => t.push(x));
  if (o.desc) t.push('<meta name="description" content="' + escapeHtml(o.desc) + '">');
  t.push('<meta property="og:type" content="' + o.type + '">');
  t.push('<meta property="og:site_name" content="' + escapeHtml(NAV_TITLE_TEXT[lang]) + '">');
  t.push('<meta property="og:title" content="' + escapeHtml(o.title) + '">');
  if (o.desc) t.push('<meta property="og:description" content="' + escapeHtml(o.desc) + '">');
  t.push('<meta property="og:url" content="' + o.url + '">');
  if (o.image) t.push('<meta property="og:image" content="' + o.image + '">');
  t.push('<meta property="og:locale" content="' + OG_LOCALE[lang] + '">');
  return t.join('\n');
}

const pageSuffix = (lang, page) => (page > 1 ? ' — ' + S[lang].pageWord + ' ' + digits(lang, page) : '');

function listPages(lang, items, layout) {
  const st = S[lang];
  const total = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const pages = [];
  for (let page = 1; page <= total; page++) {
    const slice = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    let main;
    if (!items.length) main = '<p class="pub-empty">' + st.empty + '</p>';
    else {
      const li = slice.map(p => '<li>' + tileAnchor(lang, p.data) + '</li>').join('');
      main = '<ul class="pub-list">' + li + '</ul>' + pagination(lang, page, total);
    }
    main = crumbs(lang, [{ text: st.title }]) + main;
    const url = cfg.publications.url(lang, page);
    const title = st.title + pageSuffix(lang, page);
    let head;
    if (!items.length) head = '<meta name="robots" content="noindex">';
    else {
      const extra = [];
      if (page > 1) extra.push('<link rel="prev" href="' + cfg.publications.url(lang, page - 1) + '">');
      if (page < total) extra.push('<link rel="next" href="' + cfg.publications.url(lang, page + 1) + '">');
      const desc = st.desc + (page > 1 ? ' ' + (lang === 'thai' ? 'หน้า ' : 'Страница ') + digits(lang, page) + '.' : '');
      head = metaTags(lang, { url, extra, desc, type: 'website', title });
    }
    const html = cfg.withLangSwitch(fill(layout, { title: escapeHtml(title), head, h1: st.title, main }), cfg.publications.path(lang, page), lang);
    pages.push({ file: cfg.publications.file(lang, page), html, indexable: items.length > 0, url });
  }
  return pages;
}

function articlePage(lang, pub, art, layout) {
  const st = S[lang];
  const d = pub.data;
  let toc = '';
  if (art.h2s.length >= 3) {
    toc = '<nav class="pub-toc" aria-label="' + st.toc + '"><p class="pub-toc-title">' + st.toc + '</p><ol>'
      + art.h2s.map(h => '<li><a href="#' + h.id + '">' + plainHtml(h.raw) + '</a></li>').join('') + '</ol></nav>';
  }
  const main = crumbs(lang, [{ text: st.title, href: cfg.publications.path(lang, 1) }, { text: d.headline }])
    + '<article class="pub-article">'
    + '<figure class="pub-cover"><img src="' + escapeHtml(cfg.coverPath(d.cover)) + '" alt="' + escAttr(d.headline) + '" width="1200" height="630"></figure>'
    + '<p class="pub-lead">' + escapeHtml(d.lead) + '</p>'
    + toc
    + '<div class="pub-body">' + art.html + '</div></article>'
    // Подписка на уведомления: карточку показывает js/push.js (если браузер умеет веб-пуш и читатель не подписан)
    + '<aside class="push-cta" data-push-cta hidden><p>' + st.cta.q + '<small>' + st.cta.note + '</small></p>'
    + '<button type="button" class="push-btn" data-push-open>' + st.cta.btn + '</button></aside>';
  const url = cfg.articleUrl(d.html);
  const head = metaTags(lang, {
    url, desc: clipMeta(d.lead, META_DESC_MAX, lang), type: 'article', title: d.headline, image: cfg.coverUrl(d.cover)
  });
  return { file: d.html, html: cfg.withLangSwitch(fill(layout, { title: escapeHtml(d.headline), head, h1: escapeHtml(d.headline), main }), cfg.articlePath(d.html), lang), url };
}

// Текст заголовка для оглавления: теги внутри h2 убираем, текст оставляем как есть
const plainHtml = raw => raw.replace(/\s+/g, ' ').trim();

// --- Основная сборка ---
function build(opts) {
  // termsDir — корень сайта (json/ с терминами, сюда же пишется sitemap_publications.xml);
  // pubDir — папка publications/ (страницы и covers/); srcDir — исходники (_src/publications).
  const termsDir = opts.termsDir, pubDir = opts.pubDir;
  const srcDir = opts.srcDir || path.join(termsDir, '_src/publications');
  const ctx = {
    jsonDir: path.join(srcDir, 'json'), htmlDir: path.join(srcDir, 'html'), coversDir: path.join(pubDir, 'covers'),
    pagesDir: pubDir, tplDir: path.join(srcDir, 'template'), terms: loadTerms(termsDir)
  };
  const errors = [], warnings = [];
  const layouts = {};
  LANGS.forEach(l => { layouts[l] = fs.readFileSync(path.join(ctx.tplDir, '_layout_' + l + '.html'), 'utf8'); });

  // 1. JSON плиток
  const entries = [];
  if (fs.existsSync(ctx.jsonDir)) {
    fs.readdirSync(ctx.jsonDir).filter(f => !f.startsWith('.')).sort().forEach(f => {
      const m = f.match(/^publication_([1-9]\d*)_(ru|thai)\.json$/);
      if (!m) { errors.push({ code: 1, file: f, msg: 'имя файла не соответствует publication_<число>_<ru|thai>.json' }); return; }
      const res = validateJson(f, m[2], fs.readFileSync(path.join(ctx.jsonDir, f), 'utf8'), ctx);
      errors.push(...res.errors); warnings.push(...res.warnings);
      entries.push({ file: f, n: Number(m[1]), lang: m[2], data: res.data });
    });
  }

  // 2. Одна статья — один JSON
  const byHtml = {};
  entries.filter(e => e.data).forEach(e => { (byHtml[e.data.html] = byHtml[e.data.html] || []).push(e); });
  Object.keys(byHtml).forEach(h => {
    if (byHtml[h].length > 1) {
      errors.push({ code: 10, file: byHtml[h].map(e => e.file).join(' / '), msg: 'статья «' + h + '» указана в нескольких JSON' });
      byHtml[h].forEach(e => { e.data = null; });
    }
  });

  // 3. Статьи. Два прохода: плитка на публикацию, статья которой не создана из-за ошибки, — мягкая ошибка 20
  const live = entries.filter(e => e.data);
  ctx.pubAny = { ru: new Set(), thai: new Set() };
  live.forEach(e => ctx.pubAny[e.lang].add(e.data.html));
  let valid = new Set(live.map(e => e.lang + ':' + e.data.html));
  let results = [];
  for (let pass = 0; pass < 3; pass++) {
    ctx.pubMap = { ru: new Map(), thai: new Map() };
    live.forEach(e => { if (valid.has(e.lang + ':' + e.data.html)) ctx.pubMap[e.lang].set(e.data.html, e.data); });
    results = live.map(e => ({ e, art: processArticle(fs.readFileSync(path.join(ctx.htmlDir, e.data.html), 'utf8'), e.lang, ctx) }));
    const next = new Set(results.filter(r => !r.art.errors.length).map(r => r.e.lang + ':' + r.e.data.html));
    if (next.size === valid.size) break;
    valid = next;
  }
  const articles = new Map();
  results.forEach(({ e, art }) => {
    art.errors.forEach(x => errors.push({ code: x.code, file: e.data.html, msg: x.msg }));
    art.soft.forEach(x => errors.push({ code: x.code, file: e.data.html, msg: x.msg, soft: true }));
    if (art.errors.length) { e.data = null; return; }
    if (art.text.length < TEXT_WARN) warnings.push({ file: e.data.html, msg: 'текст статьи короче ' + TEXT_WARN + ' символов (' + art.text.length + ')' });
    articles.set(e.file, art);
  });

  // 4. Статьи без JSON
  const referenced = new Set();
  entries.forEach(e => {
    try { const d = JSON.parse(fs.readFileSync(path.join(ctx.jsonDir, e.file), 'utf8').replace(/^\uFEFF/, '')); if (d && typeof d.html === 'string') referenced.add(d.html); } catch (x) { /* уже в ошибках */ }
  });
  if (fs.existsSync(ctx.htmlDir)) {
    fs.readdirSync(ctx.htmlDir).filter(f => f.endsWith('.html') && !referenced.has(f)).sort()
      .forEach(f => warnings.push({ file: f, msg: 'статья без JSON плитки: не публикуется' }));
  }

  // 5. Опубликованные (новые сверху)
  const published = { ru: [], thai: [] };
  entries.filter(e => e.data).forEach(e => published[e.lang].push(e));
  LANGS.forEach(l => published[l].sort((a, b) => b.n - a.n));

  // 6. Страницы: publications/*.html пересобираются целиком (только файлы; covers/ не трогаем)
  fs.mkdirSync(ctx.pagesDir, { recursive: true });
  fs.readdirSync(ctx.pagesDir, { withFileTypes: true }).filter(d => d.isFile() && d.name.endsWith('.html')).forEach(d => fs.unlinkSync(path.join(ctx.pagesDir, d.name)));
  const pages = [], sitemapUrls = [];
  LANGS.forEach(lang => {
    listPages(lang, published[lang], layouts[lang]).forEach(p => { pages.push(p); if (p.indexable) sitemapUrls.push(p.url); });
  });
  LANGS.forEach(lang => {
    published[lang].forEach(e => {
      const p = articlePage(lang, e, articles.get(e.file), layouts[lang]);
      pages.push(p); sitemapUrls.push(p.url);
    });
  });
  // Заглушка на прежнем адресе первой страницы списка ru (publications_ru.html -> /publications/)
  const redirects = [{ file: cfg.publications.name('ru', 1), html: cfg.stubHtml(cfg.publications.url('ru', 1), 'ru') }];
  pages.concat(redirects).forEach(p => fs.writeFileSync(path.join(ctx.pagesDir, p.file), p.html, 'utf8'));

  // 7. sitemap_publications.xml
  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    + sitemapUrls.map(u => '  <url>\n    <loc>' + u + '</loc>\n  </url>\n').join('') + '</urlset>\n';
  fs.writeFileSync(path.join(termsDir, 'sitemap_publications.xml'), xml, 'utf8');

  return { errors, warnings, published, pages: pages.map(p => p.file), redirects: redirects.map(p => p.file), sitemapUrls };
}

module.exports = { build, processArticle, imageInfo };

if (require.main === module) {
  const termsDir = process.env.PUB_TERMS_DIR || REPO_ROOT;
  const pubDir = process.env.PUB_DIR || path.join(termsDir, 'publications');
  const r = build({ termsDir, pubDir, srcDir: process.env.PUB_SRC_DIR });
  console.log('Публикаций: ru=' + r.published.ru.length + ', thai=' + r.published.thai.length + '; страниц: ' + r.pages.length + '; адресов в sitemap: ' + r.sitemapUrls.length);
  r.warnings.forEach(w => {
    console.warn('ПРЕДУПРЕЖДЕНИЕ ' + w.file + ': ' + w.msg);
    if (process.env.GITHUB_ACTIONS) console.log('::warning file=_src/publications/' + w.file + '::' + w.msg);
  });
  r.errors.forEach(e => {
    console.error('ОШИБКА [' + e.code + '] ' + e.file + ': ' + e.msg + (e.soft ? ' (статья опубликована)' : ''));
    if (process.env.GITHUB_ACTIONS) console.log('::error title=Публикации [' + e.code + ']::' + e.file + ': ' + e.msg);
  });
  if (r.errors.length) { console.error('Ошибок: ' + r.errors.length + '. Публикации с ошибками (кроме отмеченных «статья опубликована») не созданы.'); process.exitCode = 1; }
}
