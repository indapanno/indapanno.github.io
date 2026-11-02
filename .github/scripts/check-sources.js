'use strict';
// Проверка формата ссылок на источники (sources[].location) в json/<id>_<ru|thai>.json.
// Только предупреждения: сборку и публикацию не останавливает. Факты не проверяет — ловит
// явные опечатки и выдумки: пустую ссылку, ссылку без названия, номер вне границ собрания канона.
// Запуск: node .github/scripts/check-sources.js (в GitHub Actions — жёлтые пометки ::warning).
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '../..');

// Собрания канона: варианты написания (латиница с диакритикой и без, кириллица) и допустимые номера.
// first — номер (для N.N — номер раздела/книги); single — у собрания номера без раздела.
const COLLECTIONS = [
  { code: 'DN', names: ['dīgha nikāya', 'digha nikaya', 'дигха-никая', 'дигха никая'], max: 34 },
  { code: 'MN', names: ['majjhima nikāya', 'majjhima nikaya', 'маджхима-никая', 'маджджхима-никая', 'маджхима никая'], max: 152 },
  { code: 'SN', names: ['saṃyutta nikāya', 'saṁyutta nikāya', 'samyutta nikāya', 'samyutta nikaya', 'саньютта-никая', 'самьютта-никая', 'саньютта никая'], max: 56 },
  { code: 'AN', names: ['aṅguttara nikāya', 'anguttara nikāya', 'anguttara nikaya', 'ангуттара-никая', 'ангуттара никая'], max: 11 },
  { code: 'Dhp', names: ['dhammapada', 'дхаммапада'], max: 423 },
  { code: 'Sn', names: ['sutta nipāta', 'sutta nipata', 'сутта-нипата', 'сутта нипата'], max: 5 },
  { code: 'Khp', names: ['khuddakapāṭha', 'khuddakapatha', 'кхуддакапатха'], max: 9 },
  { code: 'Iti', names: ['itivuttaka', 'итивуттака'], max: 112 },
  { code: 'Ud', names: ['udāna', 'udana', 'удана'], max: 8 }
];
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const PATTERNS = COLLECTIONS.map(c => ({ c, re: new RegExp('(?:^|[^\\p{L}])(?:' + c.names.map(esc).join('|') + ')\\s+(\\d+)', 'giu') }));

// Возвращает null, если ссылка выглядит правдоподобно, иначе — строку с причиной.
// title — название источника (поле sources[].title): если в location только номера,
// название берётся из title («Bṛhadāraṇyaka Upaniṣad» + «4.4.14» — нормально).
function checkLocation(location, title) {
  const loc = typeof location === 'string' ? location.trim() : '';
  const ttl = typeof title === 'string' ? title.trim() : '';
  if (!loc) return 'пусто: не указано, где в источнике это место';
  const numbersOnly = !/\p{L}/u.test(loc.replace(/^[IVXLC]+\b/, ''));
  if (numbersOnly && !/\p{L}/u.test(ttl)) return 'нет названия источника: «' + loc + '» — непонятно, на что ссылка';
  const full = numbersOnly ? ttl + ' ' + loc : loc;
  const problems = [];
  PATTERNS.forEach(({ c, re }) => {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(full))) {
      const n = Number(m[1]);
      if (n < 1 || n > c.max) problems.push('номер ' + n + ' вне границ собрания (' + c.code + ' 1–' + c.max + '): «' + full + '»');
    }
  });
  return problems.length ? problems.join('; ') : null;
}

// terms = { '<id>_<lang>': данные термина } → [{ file, index, location, warning }]
function checkTerms(terms) {
  const out = [];
  Object.keys(terms).sort().forEach(key => {
    const sources = terms[key] && Array.isArray(terms[key].sources) ? terms[key].sources : [];
    sources.forEach((s, i) => {
      const w = checkLocation(s && s.location, s && s.title);
      if (w) out.push({ file: key + '.json', index: i + 1, location: s && s.location, warning: w });
    });
  });
  return out;
}

function loadTerms(root) {
  const dir = path.join(root, 'json');
  const terms = {};
  fs.readdirSync(dir).filter(f => /^[a-z0-9]+_(ru|thai)\.json$/.test(f) && !f.startsWith('index_')).forEach(f => {
    try { terms[f.slice(0, -5)] = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8').replace(/^﻿/, '')); }
    catch (e) { /* невалидный JSON ловит сборка терминов */ }
  });
  return terms;
}

module.exports = { checkLocation, checkTerms, COLLECTIONS };

if (require.main === module) {
  const terms = loadTerms(process.env.SOURCES_ROOT || REPO_ROOT);
  const total = Object.values(terms).reduce((n, t) => n + (Array.isArray(t.sources) ? t.sources.length : 0), 0);
  const warnings = checkTerms(terms);
  warnings.forEach(w => {
    console.log('ПРЕДУПРЕЖДЕНИЕ json/' + w.file + ', источник ' + w.index + ': ' + w.warning);
    if (process.env.GITHUB_ACTIONS) console.log('::warning file=json/' + w.file + '::Источник ' + w.index + ': ' + w.warning);
  });
  console.log('Ссылок проверено: ' + total + ', предупреждений: ' + warnings.length);
}
