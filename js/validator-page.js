// Страница «Проверка JSON»: связывает форму с TermValidator (json-validator.js).
// Схемы загружаются с сайта при первой проверке. Пользовательский текст
// выводится только через textContent (никакого innerHTML с чужими данными).

(function () {
  var UI = {
    ru: {
      ok: 'JSON корректен ✓',
      langName: { ru: 'русский', thai: 'тайский' },
      lang: 'Язык карточки: {0}.',
      file: 'Имя файла для GitHub: {0}',
      next: 'Вернуться к инструкции',
      errors: 'Найдено ошибок: {0}. Исправьте их и проверьте снова — или отправьте этот список ИИ с просьбой исправить JSON.',
      copy: 'Скопировать список ошибок',
      copied: 'Скопировано! ✓',
      copyHead: 'Исправь JSON по этим замечаниям и верни его целиком в блоке ```json:',
      loadFail: 'Не удалось загрузить схему проверки. Обновите страницу и попробуйте ещё раз.',
      checking: 'Проверяю…'
    },
    thai: {
      ok: 'JSON ถูกต้อง ✓',
      langName: { ru: 'รัสเซีย', thai: 'ไทย' },
      lang: 'ภาษาของการ์ด: {0}',
      file: 'ชื่อไฟล์สำหรับ GitHub: {0}',
      next: 'กลับไปที่ขั้นตอนการเพิ่มคำศัพท์',
      errors: 'พบข้อผิดพลาด {0} รายการ — แก้ไขแล้วตรวจสอบอีกครั้ง หรือส่งรายการนี้ให้ AI แก้ JSON',
      copy: 'คัดลอกรายการข้อผิดพลาด',
      copied: 'คัดลอกแล้ว! ✓',
      copyHead: 'แก้ JSON ตามข้อสังเกตเหล่านี้ แล้วส่งกลับทั้งหมดในบล็อก ```json:',
      loadFail: 'โหลดโครงสร้างสำหรับตรวจสอบไม่สำเร็จ รีเฟรชหน้าแล้วลองอีกครั้ง',
      checking: 'กำลังตรวจสอบ…'
    }
  };

  function pageLang() {
    return window.TermsLang.get();
  }
  function fmt(s, a) { return s.replace(/\{(\d+)\}/g, function (_, i) { return a[+i]; }); }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  var schemasPromise = null;
  function loadSchemas() {
    if (!schemasPromise) {
      schemasPromise = Promise.all([
        fetch('/schema/term.schema.ru.json').then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }),
        fetch('/schema/term.schema.thai.json').then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      ]).then(function (a) { return { ru: a[0], thai: a[1] }; });
      schemasPromise.catch(function () { schemasPromise = null; });
    }
    return schemasPromise;
  }

  document.addEventListener('DOMContentLoaded', function () {
    var input = document.getElementById('validator-input');
    var checkBtn = document.getElementById('validator-check-btn');
    var clearBtn = document.getElementById('validator-clear-btn');
    var out = document.getElementById('validator-result');
    if (!input || !checkBtn || !out) return;

    var lang = pageLang(), T = UI[lang], howTo = '/how-to-add-term_' + lang + '.html';

    function show(node, kind) {
      out.className = 'validator-result ' + kind;
      out.textContent = '';
      out.appendChild(node);
    }

    function render(res) {
      var box = document.createElement('div');
      if (res.ok) {
        box.appendChild(el('p', 'validator-title', T.ok));
        box.appendChild(el('p', 'validator-line', fmt(T.lang, [T.langName[res.lang]])));
        box.appendChild(el('p', 'validator-line', fmt(T.file, [res.id + '_' + res.lang + '.json'])));
        var a = el('a', 'validator-link', T.next);
        a.href = howTo;
        box.appendChild(a);
        show(box, 'ok');
        return;
      }
      box.appendChild(el('p', 'validator-title', fmt(T.errors, [res.errors.length])));
      var ul = el('ul', 'validator-list');
      var lines = [];
      res.errors.forEach(function (e) {
        var li = el('li');
        li.appendChild(el('code', null, e.path));
        li.appendChild(document.createTextNode(' — ' + e.message));
        ul.appendChild(li);
        lines.push('- ' + e.path + ' — ' + e.message);
      });
      box.appendChild(ul);
      var copyBtn = el('button', 'validator-btn-secondary', T.copy);
      copyBtn.type = 'button';
      copyBtn.addEventListener('click', function () {
        var text = T.copyHead + '\n' + lines.join('\n');
        var done = function () {
          copyBtn.textContent = T.copied;
          setTimeout(function () { copyBtn.textContent = T.copy; }, 2000);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done);
      });
      box.appendChild(copyBtn);
      show(box, 'error');
    }

    checkBtn.addEventListener('click', function () {
      show(el('p', 'validator-line', T.checking), 'pending');
      loadSchemas().then(function (schemas) {
        render(window.TermValidator.check(input.value, schemas, lang));
      }).catch(function () {
        show(el('p', 'validator-line', T.loadFail), 'error');
      });
    });

    if (clearBtn) clearBtn.addEventListener('click', function () {
      input.value = '';
      out.className = 'validator-result';
      out.textContent = '';
      input.focus();
    });
  });
})();
