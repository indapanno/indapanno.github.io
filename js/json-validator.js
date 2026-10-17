// Валидатор JSON термина по схемам term.schema.ru.json / term.schema.thai.json.
// Без зависимостей: реализует только те ключевые слова JSON Schema (draft-07),
// которые реально используются в наших схемах. Работает в браузере и в Node.
// Публичный API: TermValidator.check(rawText, schemas, uiLang)
//   schemas = { ru: <объект схемы>, thai: <объект схемы> }, uiLang = 'ru' | 'thai'
// Возвращает { ok, lang, id, errors: [{ path, message }] }.

(function (root) {
  'use strict';

  var TYPE_NAMES = {
    ru: { string: 'текст', number: 'число', boolean: 'true/false', array: 'список [ ]', object: 'объект { }', 'null': 'пусто (null)' },
    thai: { string: 'ข้อความ', number: 'ตัวเลข', boolean: 'true/false', array: 'รายการ [ ]', object: 'อ็อบเจกต์ { }', 'null': 'ค่าว่าง (null)' }
  };

  var STR = {
    ru: {
      required: 'Не хватает обязательного поля «{0}».',
      extra: 'Лишнее поле «{0}» — такого поля нет в схеме.',
      extraHint: ' Возможно, опечатка: должно быть «{0}».',
      type: 'Ожидается {0}, а здесь {1}.',
      empty: 'Поле не должно быть пустым.',
      minItems: 'В списке должно быть не меньше {0} эл.',
      maxItems: 'В списке должно быть не больше {0} эл.',
      compoundMin: 'is_compound: true, но список components пуст. Перечислите части слова или поставьте is_compound: false.',
      compoundMax: 'is_compound: false, но список components не пуст. Сделайте его пустым [ ] или поставьте is_compound: true.',
      pattern: 'Недопустимое значение «{0}».',
      allowed: ' Допустимо: {0}.',
      paren: ' После значения можно добавить уточнение в скобках.',
      other: 'Недопустимое значение.',
      rootPath: '(весь JSON)',
      parseAt: 'Синтаксическая ошибка JSON рядом со строкой {0}, символ {1}: «{2}».',
      parseGeneric: 'Синтаксическая ошибка JSON: {0}',
      parseEmpty: 'Поле пустое — вставьте JSON целиком.',
      fences: 'Вокруг JSON есть лишний текст или знаки ``` — в файл нужно вставлять только сам JSON, от первой { до последней }.',
      noTerm: 'Не найдено ни поля term_ru, ни term_thai — проверьте, что вставлен весь JSON.',
      curly: 'В тексте есть «умные» кавычки “ ” ‘ ’ — замените их на обычные прямые " и \'.'
    },
    thai: {
      required: 'ขาดฟิลด์ที่จำเป็น «{0}»',
      extra: 'มีฟิลด์เกิน «{0}» ซึ่งไม่มีในโครงสร้าง',
      extraHint: ' อาจพิมพ์ผิด ควรเป็น «{0}»',
      type: 'ควรเป็น {0} แต่พบ {1}',
      empty: 'ฟิลด์นี้ต้องไม่ว่างเปล่า',
      minItems: 'รายการต้องมีอย่างน้อย {0} รายการ',
      maxItems: 'รายการต้องมีไม่เกิน {0} รายการ',
      compoundMin: 'is_compound เป็น true แต่ components ว่างเปล่า — ระบุส่วนประกอบของคำ หรือเปลี่ยน is_compound เป็น false',
      compoundMax: 'is_compound เป็น false แต่ components ไม่ว่าง — ทำให้เป็น [ ] หรือเปลี่ยน is_compound เป็น true',
      pattern: 'ค่า «{0}» ไม่ถูกต้อง',
      allowed: ' ที่ยอมรับ: {0}',
      paren: ' (เพิ่มคำอธิบายในวงเล็บต่อท้ายได้)',
      other: 'ค่าไม่ถูกต้อง',
      rootPath: '(JSON ทั้งหมด)',
      parseAt: 'JSON มีข้อผิดพลาดทางไวยากรณ์ ใกล้บรรทัด {0} ตัวอักษรที่ {1}: «{2}»',
      parseGeneric: 'JSON มีข้อผิดพลาดทางไวยากรณ์: {0}',
      parseEmpty: 'ช่องว่างเปล่า — วาง JSON ทั้งหมด',
      fences: 'มีข้อความหรือเครื่องหมาย ``` ล้อมรอบ JSON — วางเฉพาะ JSON ตั้งแต่ { ตัวแรกถึง } ตัวสุดท้าย',
      noTerm: 'ไม่พบฟิลด์ term_ru หรือ term_thai — ตรวจสอบว่าวาง JSON ครบทั้งหมด',
      curly: 'มีเครื่องหมายคำพูดแบบโค้ง “ ” ‘ ’ — แทนด้วย " และ \' ธรรมดา'
    }
  };

  // Допустимые значения — это содержимое, поэтому зависят от языка САМОГО JSON,
  // а не от языка интерфейса.
  var VALUES = {
    ru: {
      'origin.type': '«введён впервые» или «заимствован и переосмыслен»',
      'origin.etymology_versions[].type': '«традиционная / народная» или «академическая (филологическая)»',
      'dating[].type': '«традиционная», «академическая» или «добуддийское бытование»',
      'sources[].status': '«основной» или «свидетель N», где N — номер (например, «свидетель 1»)'
    },
    thai: {
      'origin.type': '«บัญญัติขึ้นใหม่» หรือ «ยืมมาและให้ความหมายใหม่»',
      'origin.etymology_versions[].type': '«ตามประเพณี/พื้นบ้าน» หรือ «ทางวิชาการ (ภาษาศาสตร์)»',
      'dating[].type': '«ตามประเพณี», «ทางวิชาการ» หรือ «การมีอยู่ก่อนพุทธกาล»',
      'sources[].status': '«หลัก» หรือ «พยาน 1», «พยาน 2» ฯลฯ'
    }
  };
  var PAREN_OK = { 'dating[].type': 1, 'sources[].status': 1, 'origin.type': 1 };
  var ID_HINT = {
    ru: ' Допустимо: только строчные латинские буквы и цифры, начиная с буквы, без пробелов и диакритики (например, karuna).',
    thai: ' ที่ยอมรับ: ตัวอักษรละตินพิมพ์เล็กและตัวเลขเท่านั้น ขึ้นต้นด้วยตัวอักษร ไม่มีเว้นวรรคและเครื่องหมายกำกับเสียง (เช่น karuna)'
  };

  function fmt(s, args) {
    return s.replace(/\{(\d+)\}/g, function (_, i) { return args[+i]; });
  }

  function typeOf(v) {
    if (v === null) return 'null';
    if (Array.isArray(v)) return 'array';
    return typeof v;
  }

  function levenshtein(a, b) {
    var prev = [], i, j;
    for (j = 0; j <= b.length; j++) prev[j] = j;
    for (i = 1; i <= a.length; i++) {
      var cur = [i];
      for (j = 1; j <= b.length; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      prev = cur;
    }
    return prev[b.length];
  }

  function closestKey(key, known) {
    var best = null, bestD = 4;
    for (var i = 0; i < known.length; i++) {
      var d = levenshtein(key, known[i]);
      if (d < bestD) { bestD = d; best = known[i]; }
    }
    return best;
  }

  // Путь вида ['sources', 0, 'status'] -> «sources[1].status» (нумерация с 1 — для людей).
  function fmtPath(parts, rootLabel) {
    if (!parts.length) return rootLabel;
    var out = '';
    parts.forEach(function (p, i) {
      if (typeof p === 'number') out += '[' + (p + 1) + ']';
      else out += (i ? '.' : '') + p;
    });
    return out;
  }
  function hintKey(parts) {
    return parts.map(function (p, i) {
      return typeof p === 'number' ? '[]' : (i ? '.' : '') + p;
    }).join('').replace(/\.\[\]/g, '[]');
  }

  function shorten(v) {
    var s = String(v);
    return s.length > 60 ? s.slice(0, 57) + '…' : s;
  }

  // ---- Мини-валидатор JSON Schema draft-07 (только используемое подмножество) ----
  function validateData(schema, data, uiLang, jsonLang) {
    var S = STR[uiLang], errors = [];

    function resolve(s) {
      while (s && s.$ref) {
        var t = schema, parts = s.$ref.replace(/^#\//, '').split('/');
        for (var i = 0; i < parts.length; i++) t = t[parts[i]];
        s = t;
      }
      return s;
    }

    function push(errs, path, message) {
      errs.push({ path: fmtPath(path, S.rootPath), message: message });
    }

    function walk(s, v, path, errs) {
      s = resolve(s);
      if (!s) return;
      var actual = typeOf(v);

      if (s.type && actual !== s.type) {
        push(errs, path, fmt(S.type, [TYPE_NAMES[uiLang][s.type] || s.type, TYPE_NAMES[uiLang][actual] || actual]));
        return;
      }
      if (s.const !== undefined && v !== s.const) push(errs, path, S.other);
      if (s.enum && s.enum.indexOf(v) === -1) push(errs, path, S.other);

      if (actual === 'string') {
        if (s.minLength !== undefined && v.length < s.minLength) {
          push(errs, path, s.minLength === 1 ? S.empty : S.other);
        }
        if (s.maxLength !== undefined && v.length > s.maxLength) push(errs, path, S.other);
        if (s.pattern) {
          var ok = true;
          try { ok = new RegExp(s.pattern).test(v); } catch (e) { ok = true; }
          if (!ok) {
            var key = hintKey(path), msg = fmt(S.pattern, [shorten(v)]);
            if (key === 'id') msg += ID_HINT[uiLang];
            else if (VALUES[jsonLang][key]) {
              msg += fmt(S.allowed, [VALUES[jsonLang][key]]) + (PAREN_OK[key] ? S.paren : '');
            }
            push(errs, path, msg);
          }
        }
      }

      if (actual === 'object') {
        var props = s.properties || {}, k;
        (s.required || []).forEach(function (r) {
          if (!Object.prototype.hasOwnProperty.call(v, r)) push(errs, path.concat(r), fmt(S.required, [r]));
        });
        for (k in props) {
          if (Object.prototype.hasOwnProperty.call(v, k)) walk(props[k], v[k], path.concat(k), errs);
        }
        if (s.additionalProperties === false) {
          var known = Object.keys(props);
          Object.keys(v).forEach(function (key) {
            if (!Object.prototype.hasOwnProperty.call(props, key)) {
              var near = closestKey(key, known), m = fmt(S.extra, [key]);
              if (near) m += fmt(S.extraHint, [near]);
              push(errs, path.concat(key), m);
            }
          });
        }
      }

      if (actual === 'array') {
        var isComponents = path[path.length - 1] === 'components';
        if (s.minItems !== undefined && v.length < s.minItems) {
          push(errs, path, isComponents ? S.compoundMin : fmt(S.minItems, [s.minItems]));
        }
        if (s.maxItems !== undefined && v.length > s.maxItems) {
          push(errs, path, isComponents ? S.compoundMax : fmt(S.maxItems, [s.maxItems]));
        }
        if (s.items) v.forEach(function (item, i) { walk(s.items, item, path.concat(i), errs); });
      }

      if (s.allOf) s.allOf.forEach(function (sub) { walk(sub, v, path, errs); });

      if (s.if) {
        var scratch = [];
        walk(s.if, v, path, scratch);
        if (scratch.length === 0) { if (s.then) walk(s.then, v, path, errs); }
        else if (s.else) walk(s.else, v, path, errs);
      }
    }

    walk(schema, data, [], errors);
    return errors;
  }

  // ---- Разбор текста, вставленного читателем ----
  function parseInput(raw, uiLang) {
    var S = STR[uiLang], text = String(raw || '').trim(), errors = [];
    if (!text) return { errors: [{ path: S.rootPath, message: S.parseEmpty }] };

    var first = text.indexOf('{'), last = text.lastIndexOf('}');
    var core = text;
    if (first > 0 || (last !== -1 && last < text.length - 1)) {
      if (first !== -1 && last > first) {
        core = text.slice(first, last + 1);
        errors.push({ path: S.rootPath, message: S.fences });
      }
    }

    try {
      return { data: JSON.parse(core), errors: errors };
    } catch (e) {
      var msg = String(e && e.message || e), m = msg.match(/position (\d+)/), out;
      if (/[“”‘’]/.test(core)) errors.push({ path: S.rootPath, message: S.curly });
      if (m) {
        var pos = +m[1], before = core.slice(0, pos), line = before.split('\n').length;
        var col = pos - before.lastIndexOf('\n');
        var snippet = core.slice(Math.max(0, pos - 25), pos + 25).replace(/\s+/g, ' ');
        out = fmt(S.parseAt, [line, col, snippet]);
      } else {
        out = fmt(S.parseGeneric, [msg]);
      }
      errors.push({ path: S.rootPath, message: out });
      return { errors: errors, fatal: true };
    }
  }

  function check(rawText, schemas, uiLang) {
    uiLang = STR[uiLang] ? uiLang : 'ru';
    var parsed = parseInput(rawText, uiLang);
    if (parsed.fatal || parsed.data === undefined) return { ok: false, lang: null, id: null, errors: parsed.errors };

    var data = parsed.data, S = STR[uiLang], errors = parsed.errors.slice();
    var hasRu = data && typeof data === 'object' && !Array.isArray(data) && 'term_ru' in data;
    var hasTh = data && typeof data === 'object' && !Array.isArray(data) && 'term_thai' in data;
    if (!hasRu && !hasTh) {
      errors.push({ path: S.rootPath, message: S.noTerm });
      return { ok: false, lang: null, id: null, errors: errors };
    }
    var lang = hasTh && !hasRu ? 'thai' : 'ru';
    errors = errors.concat(validateData(schemas[lang], data, uiLang, lang));
    return {
      ok: errors.length === 0,
      lang: lang,
      id: typeof data.id === 'string' ? data.id : null,
      errors: errors
    };
  }

  var api = { check: check };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TermValidator = api;
})(typeof window !== 'undefined' ? window : this);
