// Бургер-меню: кнопка + выезжающая панель с пунктами (пункты — готовые ссылки в HTML)
// ("Навигатор", "Связанные термины", "Мой прогресс", "Публикации", "Что нового", "Добавить термин"). Определяет язык
// по имени файла текущей страницы, строит ссылки на соответствующие
// языковые версии страниц.

var BURGER_UI_STRINGS = {
  ru: {
    menuTitle: 'Меню',
    navHome: 'Навигатор',
    bundles: 'Связанные термины',
    progress: 'Мой прогресс',
    publications: 'Публикации',
    news: 'Что нового',
    addTerm: 'Добавить термин'
  },
  thai: {
    menuTitle: 'เมนู',
    navHome: 'หน้าหลัก',
    bundles: 'ชุดศัพท์ที่เกี่ยวข้อง',
    progress: 'ความคืบหน้าของฉัน',
    publications: 'บทความ',
    news: 'มีอะไรใหม่',
    addTerm: 'เพิ่มคำศัพท์'
  }
};

function getPageLang() {
  return window.TermsLang.get();
}

document.addEventListener('DOMContentLoaded', function () {
  var toggle = document.getElementById('menu-toggle');
  var backdrop = document.getElementById('nav-backdrop');
  var drawer = document.getElementById('nav-drawer');
  var closeBtn = document.getElementById('nav-drawer-close');
  var list = document.getElementById('nav-menu-list');
  if (!toggle || !backdrop || !drawer || !list) return;

  var lang = getPageLang();
  var strings = BURGER_UI_STRINGS[lang] || BURGER_UI_STRINGS.ru;

  var items = [
    { href: window.TermsLang.url(lang === 'ru' ? '' : 'nav/nav_thai.html'), text: strings.navHome },
    { href: window.TermsLang.url(lang === 'ru' ? 'bundle/' : 'bundle/bundles_thai.html'), text: strings.bundles },
    { href: window.TermsLang.url('my/progress_' + lang + '.html'), text: strings.progress },
    { href: window.TermsLang.url(lang === 'ru' ? 'publications/' : 'publications/publications_thai.html'), text: strings.publications },
    { href: window.TermsLang.url(lang === 'ru' ? 'new/' : 'new/news_thai.html'), text: strings.news },
    { href: window.TermsLang.url('how/how-to-add-term_' + lang + '.html'), text: strings.addTerm }
  ];

  // Сборщики вписывают пункты меню прямо в HTML (их видят поисковики без JavaScript).
  // Список строится здесь только на старых страницах, где он пустой.
  if (!list.querySelector('li')) {
    list.innerHTML = items.map(function (item) {
      return '<li><a href="' + item.href + '">' + item.text + '</a></li>';
    }).join('');
  }

  function openMenu() {
    backdrop.hidden = false;
    drawer.hidden = false;
  }

  function closeMenu() {
    backdrop.hidden = true;
    drawer.hidden = true;
  }

  toggle.addEventListener('click', openMenu);
  closeBtn.addEventListener('click', closeMenu);
  backdrop.addEventListener('click', closeMenu);
});
