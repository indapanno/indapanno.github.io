'use strict';
// Проверка данных тренажёра paṭiccasamuppāda (вызывает сборка публикаций, TZ_app_paticcasamuppada.md, 5.3).
// Возвращает список проблем; пустой список — данные в порядке.
const LIFES = ['past', 'present', 'future'];
const UI_STR = ['title', 'remaining', 'hint', 'show_answer', 'show_all', 'hide_all', 'not_yet', 'remembered', 'returns_later', 'link_of',
  'milestone_over', 'milestone_count', 'example_label', 'continue', 'credit', 'credit_name', 'credit_url', 'card_progress', 'view_back', 'repeat', 'back_in_deck'];

const str = v => typeof v === 'string' && v.trim() !== '';

module.exports = function check(data, opts) {
  const p = [];
  const ui = data.ui || {};
  UI_STR.forEach(k => { if (!str(ui[k])) p.push('ui.' + k + ' пусто или нет'); });
  ['past', 'present', 'future'].forEach(k => { if (!ui.life || !str(ui.life[k])) p.push('ui.life.' + k + ' пусто или нет'); });
  ['close', 'reset', 'open_map', 'close_map', 'show', 'link', 'prev', 'next', 'open_progress'].forEach(k => { if (!ui.aria || !str(ui.aria[k])) p.push('ui.aria.' + k + ' пусто или нет'); });
  ['title', 'quote', 'source', 'text', 'reread', 'again'].forEach(k => { if (!ui.finale || !str(ui.finale[k])) p.push('ui.finale.' + k + ' пусто или нет'); });
  ['title', 'text', 'confirm', 'cancel'].forEach(k => { if (!ui.reset || !str(ui.reset[k])) p.push('ui.reset.' + k + ' пусто или нет'); });
  if (!ui.reset || !Array.isArray(ui.reset.links) || ui.reset.links.length !== 3 || !ui.reset.links.every(str)) p.push('ui.reset.links: нужно 3 формы слова');
  const m = ui.map || {};
  ['title', 'break_range', 'break', 'transitions', 'hint', 'status_done', 'status_todo', 'state_done', 'state_todo'].forEach(k => { if (!str(m[k])) p.push('ui.map.' + k + ' пусто или нет'); });
  if (!Array.isArray(m.center) || !m.center.length || !m.center.every(str)) p.push('ui.map.center: нужен список строк');
  if (!Array.isArray(m.legend) || m.legend.length < 1 || !m.legend.every(x => x && str(x.range) && str(x.text) && LIFES.includes(x.life))) p.push('ui.map.legend: нужны строки { range, life, text }');
  const cd = ui.card || {};
  ['done', 'today', 'yesterday', 'days', 'open'].forEach(k => { if (!str(cd[k])) p.push('ui.card.' + k + ' пусто или нет'); });
  if (!Array.isArray(cd.day_forms) || cd.day_forms.length !== 3 || !cd.day_forms.every(str)) p.push('ui.card.day_forms: нужно 3 формы слова');
  if (str(cd.days) && !(cd.days.includes('{n}') && cd.days.includes('{d}'))) p.push('ui.card.days: нужны {n} и {d}');
  if (str(ui.card_progress) && !ui.card_progress.includes('{n}')) p.push('ui.card_progress: нет {n}');
  if (!Array.isArray(ui.phrases) || ui.phrases.length !== 8 || !ui.phrases.every(str)) p.push('ui.phrases: нужно ровно 8 непустых фраз');
  if (str(ui.remaining) && !ui.remaining.includes('{n}')) p.push('ui.remaining: нет {n}');
  if (str(ui.returns_later) && !ui.returns_later.includes('{name}')) p.push('ui.returns_later: нет {name}');
  if (str(ui.back_in_deck) && !ui.back_in_deck.includes('{name}')) p.push('ui.back_in_deck: нет {name}');
  ['status_done', 'status_todo'].forEach(k => { if (str(m[k]) && !m[k].includes('{n}')) p.push('ui.map.' + k + ': нет {n}'); });

  const links = data.links;
  if (!Array.isArray(links) || links.length !== 12) { p.push('links: нужно ровно 12 звеньев'); return p; }
  const ids = new Set();
  links.forEach((l, i) => {
    const at = 'звено ' + (i + 1);
    if (!l || l.n !== i + 1) p.push(at + ': n должно быть ' + (i + 1));
    if (!l) return;
    ['id', 'pali', 'name', 'meaning', 'link', 'example'].forEach(k => { if (!str(l[k])) p.push(at + ': «' + k + '» пусто или нет'); });
    if (!LIFES.includes(l.life)) p.push(at + ': life — past, present или future');
    if (!Array.isArray(l.cloud) || l.cloud.length < 1 || l.cloud.length > 6 || !l.cloud.every(str)) p.push(at + ': облако — от 1 до 6 непустых строк');
    if ('break' in l && l.break !== true) p.push(at + ': break — только true');
    if (str(l.id)) { if (ids.has(l.id)) p.push(at + ': повтор id «' + l.id + '»'); ids.add(l.id); }
  });
  const all = (opts && opts.all) || {};
  Object.keys(all).forEach(lang => {
    const o = all[lang];
    if (lang === (opts && opts.lang) || !o) return;
    const other = Array.isArray(o.links) ? o.links.map(l => l && l.id).join() : '';
    if (other !== links.map(l => l.id).join()) p.push('id звеньев не совпадают с data_' + lang + '.json');
  });
  return p;
};
