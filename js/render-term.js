var TERM_UI_STRINGS = {
  ru: {
    origin: 'Происхождение', originType: 'Тип', sourceTradition: 'Исходная традиция',
    attestationBefore: 'Фиксация до возникновения термина', etymologyVersions: 'Этимологические версии',
    dating: 'Датировки', attribution: 'Атрибуция', traditional: 'Традиционная', academic: 'Академическая',
    consensus: 'Консенсус', recordedBy: 'Кем письменно зафиксировано', schoolTradition: 'Школа/традиция',
    attributionHint: 'Показывает, насколько точно известно, кто и когда впервые ввёл термин в оборот: совпадает ли легенда традиции с выводами современной науки, или здесь есть научный спор.',
    reasonIntroduced: 'Причина введения', interpretation: 'Толкование', language: 'Язык', sources: 'Источники',
    composition: 'Из каких слов состоит', compositionNote: 'Как части складываются в смысл',
    introEntry: 'Введение термина', laterSection: 'Развитие термина',
    dateUpdated: 'Дата обновления', updatedBy: 'Кто обновил', reasonForUpdate: 'Причина обновления', whatIsNew: 'Что нового',
    missingTranslation: function (b, l) {
      return 'В настоящий момент отсутствует перевод термина ' + b + ' на ' + l + ' язык. ' +
        'Вы можете сделать качественный перевод термина ' + b + ' на ' + l + ' язык за 5 минут ' +
        'без специальных знаний с помощью бесплатного ИИ. О том, как это сделать, написано в простой ';
    },
    missingTranslationLinkText: 'пошаговой инструкции', langNameOfSelf: 'русский',
    titlePrefix: 'История и значение термина',
    headerIntro: function (b) { return 'История палийского слова ' + b + ': кто, когда и зачем его впервые ввёл в обращение, что оно значило тогда и как менялось со временем.'; }
  },
  thai: {
    origin: 'ที่มา', originType: 'ประเภท', sourceTradition: 'ประเพณีต้นทาง',
    attestationBefore: 'หลักฐานก่อนเกิดคำศัพท์', etymologyVersions: 'ทฤษฎีรากศัพท์',
    dating: 'การกำหนดอายุ', attribution: 'การระบุที่มา', traditional: 'ตามประเพณี', academic: 'ทางวิชาการ',
    consensus: 'ความเห็นพ้อง', recordedBy: 'ผู้บันทึกเป็นลายลักษณ์อักษร', schoolTradition: 'นิกาย/ประเพณี',
    attributionHint: 'แสดงว่าทราบแน่ชัดเพียงใดว่าใครและเมื่อใดเป็นผู้ริเริ่มใช้คำนี้ ตำนานตามประเพณีสอดคล้องกับข้อสรุปทางวิชาการหรือไม่ หรือยังเป็นประเด็นที่ถกเถียงกันอยู่',
    reasonIntroduced: 'เหตุผลในการบัญญัติคำ', interpretation: 'ความหมาย', language: 'ภาษา', sources: 'แหล่งที่มา',
    composition: 'คำนี้ประกอบด้วยคำใดบ้าง', compositionNote: 'ความหมายเมื่อรวมกัน',
    introEntry: 'การบัญญัติคำศัพท์', laterSection: 'พัฒนาการของคำศัพท์',
    dateUpdated: 'วันที่ปรับปรุง', updatedBy: 'ผู้ปรับปรุง', reasonForUpdate: 'เหตุผลในการปรับปรุง', whatIsNew: 'สิ่งที่เพิ่มขึ้นใหม่',
    missingTranslation: function (b, l) {
      return 'ขณะนี้ยังไม่มีคำแปลของคำศัพท์ ' + b + ' เป็นภาษา' + l + ' คุณสามารถแปลคำศัพท์ ' + b + ' เป็นภาษา' + l + 'ได้อย่างมีคุณภาพภายใน 5 นาที โดยไม่ต้องมีความรู้พิเศษ ด้วยความช่วยเหลือของ AI ฟรี วิธีทำสามารถดูได้จาก ';
    },
    missingTranslationLinkText: 'คำแนะนำทีละขั้นตอน', langNameOfSelf: 'ไทย',
    titlePrefix: 'ประวัติและความหมายของคำศัพท์',
    headerIntro: function (b) { return 'ประวัติของคำภาษาบาลี ' + b + ': ใครเป็นผู้ใช้คำนี้เป็นครั้งแรก เมื่อใด และเพื่ออะไร คำนี้เคยหมายถึงอะไร และมีความหมายเปลี่ยนแปลงไปอย่างไรตามกาลเวลา'; }
  }
};

function escapeHtml(s){ if(s===undefined||s===null) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function capitalize(s){ if(!s) return s; return s.charAt(0).toUpperCase()+s.slice(1); }
function boldTerm(n){ return '<b>'+escapeHtml(n)+'</b>'; }

function getPageInfo() {
  var path = window.location.pathname;
  var filename = path.substring(path.lastIndexOf('/') + 1);
  var match = filename.match(/^(.+)_(ru|thai)\.html$/);
  if (!match) return null;
  return { id: match[1], lang: match[2] };
}

function fieldBlock(label, text) {
  if (!text) return '';
  return '<div class="field-block"><div class="field-label">'+escapeHtml(label)+'</div><div class="field-text">'+escapeHtml(capitalize(text))+'</div></div>';
}
function listBlock(label, items) {
  if (!items || !items.length) return '';
  var lis = items.map(function(i){ return '<li>'+escapeHtml(capitalize(i))+'</li>'; }).join('');
  return '<div class="field-block"><div class="field-label">'+escapeHtml(label)+'</div><ul class="field-list">'+lis+'</ul></div>';
}
function renderOrigin(strings, origin) {
  if (!origin) return '';
  var parts = [fieldBlock(strings.originType, origin.type), fieldBlock(strings.sourceTradition, origin.source_tradition),
    fieldBlock(strings.attestationBefore, origin.attestation_before_term)];
  if (origin.etymology_versions && origin.etymology_versions.length) {
    var items = origin.etymology_versions.map(function(v){ return capitalize(v.version)+' — '+v.type+', '+v.status+(v.version_source?' ('+v.version_source+')':''); });
    parts.push(listBlock(strings.etymologyVersions, items));
  }
  var body = parts.join(''); if (!body) return '';
  return '<div class="group-block group-origin"><h3>'+escapeHtml(strings.origin)+'</h3>'+body+'</div>';
}
function renderDating(strings, dating) {
  if (!dating || !dating.length) return '';
  var items = dating.map(function(d){ return capitalize(d.type)+': '+d.value+(d.comment?' ('+d.comment+')':''); });
  return '<div class="group-block group-dating">'+listBlock(strings.dating, items)+'</div>';
}
function renderAttribution(strings, a) {
  if (!a) return '';
  var cells = [{l:strings.traditional,v:a.traditional},{l:strings.academic,v:a.academic},{l:strings.consensus,v:a.consensus}].filter(function(c){return c.v;});
  if (!cells.length) return '';
  var html = cells.map(function(c){ return '<div class="meta-item"><div class="field-label">'+escapeHtml(c.l)+'</div><div class="field-text">'+escapeHtml(capitalize(c.v))+'</div></div>'; }).join('');
  return '<div class="group-block group-attribution"><h3 class="info-heading">'+escapeHtml(strings.attribution)+
    ' <span class="info-btn" aria-hidden="true">i</span></h3>'+
    '<div class="info-tooltip" hidden>'+escapeHtml(strings.attributionHint)+'</div>'+
    '<div class="meta-grid">'+html+'</div></div>';
}
function renderSources(strings, sources) {
  if (!sources || !sources.length) return '';
  var items = sources.map(function(s){
    var p=[s.title]; if(s.location)p.push(s.location); if(s.transmission_tradition)p.push(s.transmission_tradition);
    if(s.language)p.push(s.language); if(s.source_type)p.push(s.source_type);
    var line=p.filter(Boolean).join(' — '); if(s.discrepancies) line+='. '+capitalize(s.discrepancies); return line;
  });
  return '<div class="sources-block">'+listBlock(strings.sources, items)+'</div>';
}

function renderComposition(strings, tc) {
  if (!tc || !tc.is_compound || !tc.components || !tc.components.length) return '';
  var items = tc.components.map(function(c){ return c.part_iast + ' — ' + c.part_meaning; });
  var html = listBlock(strings.composition, items);
  if (tc.note) html += fieldBlock(strings.compositionNote, tc.note);
  return '<div class="group-block group-composition">' + html + '</div>';
}

// "Введение термина" / "Развитие термина" — заголовки СНАРУЖИ карточек.
function renderTimeline(strings, data) {
  var later = data.later_mentions || [];
  var html = '<div class="timeline">';

  html += '<div class="timeline-section-heading timeline-intro-heading">' + escapeHtml(strings.introEntry) + '</div>';
  html += '<div class="timeline-entry"><div class="term-card">';
  if (data.interpretation) html += '<div class="highlight-block"><div class="highlight-label">'+escapeHtml(strings.interpretation)+'</div><div class="highlight-text">'+escapeHtml(capitalize(data.interpretation))+'</div></div>';
  html += renderComposition(strings, data.term_composition);
  html += renderAttribution(strings, data.attribution);
  if (data.reason_introduced) html += '<div class="highlight-block reason"><div class="highlight-label">'+escapeHtml(strings.reasonIntroduced)+'</div><div class="highlight-text">'+escapeHtml(capitalize(data.reason_introduced))+'</div></div>';
  html += renderOrigin(strings, data.origin);
  html += renderDating(strings, data.dating);
  html += fieldBlock(strings.recordedBy, data.recorded_by);
  html += fieldBlock(strings.schoolTradition, data.school_tradition);
  html += fieldBlock(strings.language, data.language);
  html += renderSources(strings, data.sources);
  html += '</div></div>';

  if (later.length > 0) {
    html += '<div class="timeline-section-heading">' + escapeHtml(strings.laterSection) + '</div>';
    later.forEach(function (m, idx) {
      html += '<div class="timeline-entry timeline-entry-later">';
      html += '<div class="timeline-item">';
      html += fieldBlock(strings.dateUpdated, m.date_updated);
      html += fieldBlock(strings.updatedBy, m.updated_by);
      if (m.what_is_new) html += '<div class="highlight-block"><div class="highlight-label">'+escapeHtml(strings.whatIsNew)+'</div><div class="highlight-text">'+escapeHtml(capitalize(m.what_is_new))+'</div></div>';
      if (m.reason_for_update) html += '<div class="highlight-block reason"><div class="highlight-label">'+escapeHtml(strings.reasonForUpdate)+'</div><div class="highlight-text">'+escapeHtml(capitalize(m.reason_for_update))+'</div></div>';
      html += fieldBlock(strings.schoolTradition, m.school_tradition);
      if (m.source && m.source.title) html += fieldBlock(strings.sources, m.source.title);
      html += '</div></div>';
    });
  }
  html += '</div>';
  return html;
}
function renderMissingTranslation(strings, termId, targetLangName, docsHref) {
  var bt = boldTerm('«' + termId + '»');
  return '<div class="missing-translation">' + strings.missingTranslation(bt, targetLangName) + '<a href="' + docsHref + '">' + strings.missingTranslationLinkText + '</a>.</div>';
}

if (typeof module !== 'undefined') {
  module.exports = { escapeHtml, capitalize, boldTerm, renderTimeline, renderMissingTranslation, TERM_UI_STRINGS };
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', function () {
    var container = document.getElementById('term-content');
    var titleEl = document.querySelector('title');
    var h1El = document.querySelector('h1');
    var breadcrumbCurrent = document.getElementById('breadcrumb-current');
    var headerIntro = document.getElementById('header-intro');
    if (!container) return;

    var info = getPageInfo();
    if (!info) return;

    var strings = TERM_UI_STRINGS[info.lang] || TERM_UI_STRINGS.ru;

    fetch('/json/' + info.id + '_' + info.lang + '.json')
      .then(function (res) { if (!res.ok) throw new Error('not found'); return res.json(); })
      .then(function (data) {
        var termName = data.term_ru || data.term_thai || data.id;
        if (h1El) h1El.innerHTML = boldTerm(termName);
        if (titleEl) titleEl.textContent = strings.titlePrefix + ' ' + termName + (data.term_iast ? ' (' + data.term_iast + ')' : '');
        if (breadcrumbCurrent) breadcrumbCurrent.innerHTML = boldTerm(termName);
        if (headerIntro) headerIntro.innerHTML = strings.headerIntro(boldTerm(termName));
        var iastBtn = document.getElementById('term-iast-btn');
        if (iastBtn) {
          if (data.term_iast) {
            iastBtn.textContent = data.term_iast;
            iastBtn.dataset.copyText = data.term_iast;
            iastBtn.hidden = false;
          } else {
            iastBtn.hidden = true;
          }
        }
        container.innerHTML = renderTimeline(strings, data);
      })
      .catch(function () {
        var targetLangName = strings.langNameOfSelf;
        if (h1El) h1El.innerHTML = boldTerm(info.id);
        if (titleEl) titleEl.textContent = strings.titlePrefix + ' ' + info.id;
        if (breadcrumbCurrent) breadcrumbCurrent.innerHTML = boldTerm(info.id);
        if (headerIntro) headerIntro.innerHTML = strings.headerIntro(boldTerm(info.id));
        var iastBtnMissing = document.getElementById('term-iast-btn');
        if (iastBtnMissing) iastBtnMissing.hidden = true;
        container.innerHTML = renderMissingTranslation(strings, info.id, targetLangName, '/how/how-to-translate-term_' + info.lang + '.html');
      });
  });
}
