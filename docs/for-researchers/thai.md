# ตัวนำทางประวัติคำศัพท์บาลี — สำหรับนักวิจัยและนักพัฒนา

เอกสารทางเทคนิค อธิบายสถาปัตยกรรม โครงสร้างข้อมูล และวิธีการติดตั้งเว็บไซต์แบบ static
สำหรับคำแนะนำการเพิ่มคำศัพท์ผ่านหน้าเว็บ โปรดดู
[how-to-add-term_thai.html](https://indapanno.github.io/how-to-add-term_thai.html)

## เทคโนโลยีที่ใช้

- Frontend: HTML/CSS/vanilla JS ล้วน ไม่ใช้ framework หรือ bundler (ไม่มี webpack/vite)
- การ build: สคริปต์ Node.js ทำงานบน GitHub Actions (ไม่ต้องมี Node ในเครื่อง หากไม่แก้โค้ด build)
- Hosting: GitHub Pages, `Deploy from a branch` สาขา `main` โฟลเดอร์ `/ (root)` เว็บไซต์อยู่ที่ root ของโดเมน `https://indapanno.github.io/` (repository `indapanno.github.io`)
- ข้อมูล: ไฟล์ JSON เก็บใน git ไม่มีฐานข้อมูลหรือ backend
- การตรวจสอบข้อมูล: JSON Schema (draft-07) + ตัวตรวจสอบฝั่งไคลเอนต์ที่ไม่ต้องพึ่ง library ภายนอก
- สถิติผู้เข้าชม: GoatCounter (ตัวนับภายนอก ไม่ใช้ cookies)
- ข้อมูลส่วนตัวของผู้อ่าน: เครื่องหมาย «เรียนแล้ว / ยังไม่ได้เรียน» เก็บใน `localStorage` ของเบราว์เซอร์เท่านั้น ไม่ส่งไปยังเซิร์ฟเวอร์ (ดูหัวข้อ «การทำเครื่องหมาย «เรียนแล้ว» และหน้า «ความคืบหน้าของฉัน»»)

## โครงสร้าง repository

```
indapanno.github.io/                  # root ของ repository = root ของเว็บไซต์
├── json/
│   ├── <id>_ru.json          # แหล่งข้อมูลจริง หนึ่งไฟล์ต่อหนึ่งภาษาต่อหนึ่งคำศัพท์
│   ├── <id>_thai.json
│   ├── index_ru.json         # รายการสำหรับค้นหา — สร้างอัตโนมัติ ห้ามแก้ด้วยมือ
│   └── index_thai.json
├── schema/
│   ├── term.schema.ru.json    # JSON Schema (draft-07) ของ <id>_ru.json — แก้ด้วยมือ
│   └── term.schema.thai.json  # เช่นเดียวกันสำหรับ <id>_thai.json
├── js/
│   ├── render-term.js        # ตัวเรนเดอร์การ์ดกลาง (Node + เบราว์เซอร์)
│   ├── term-prompt-ru.js     # ข้อความ prompt สำหรับให้ AI สร้างคำศัพท์ (RU)
│   ├── term-prompt-thai.js   # เช่นเดียวกัน TH
│   ├── term-prompt-widget.js # ตรรกะของปุ่ม «คัดลอก prompt»
│   ├── json-validator.js     # แกนของตัวตรวจ JSON ออนไลน์ (ไม่มี dependency ใช้ได้ทั้งเบราว์เซอร์และ Node)
│   ├── validator-page.js     # ตรรกะของหน้า «ตรวจ JSON» (how-to-check-json_*.html)
│   ├── learned.js            # เครื่องหมาย «เรียนแล้ว» (localStorage)
│   ├── progress.js           # หน้า «ความคืบหน้าของฉัน»
│   ├── lang.js               # ภาษาของหน้า (`<html lang>` → `TermsLang.get()`) ลิงก์สลับภาษา `#lang-switch` และคีย์ `terms-lang`
│   ├── theme.js              # ตัวสลับธีม: ปุ่ม `#theme-switch` คีย์ `terms-theme` ใน localStorage
│   ├── search.js, burger-menu.js,
│   │   footer-counter.js, term-count.js, thai-numerals.js
├── css/
│   ├── style.css
│   ├── learned.css            # สไตล์เครื่องหมาย «เรียนแล้ว» และหน้า «ความคืบหน้าของฉัน»
│   ├── validator.css          # สไตล์หน้า «ตรวจ JSON»
│   ├── bundle.css             # สไตล์ชุดศัพท์ที่เกี่ยวข้อง
│   └── publications.css       # สไตล์บทความ
├── favicon.ico
├── index.html                  # สร้างอัตโนมัติ: หน้าแรกของรายการคำศัพท์ภาษารัสเซีย ที่อยู่ «/»
├── nav_ru.html                 # สร้างอัตโนมัติ: หน้าแจ้งย้าย → «/» (ที่อยู่เดิม)
├── nav_ru_2.html, …            # สร้างอัตโนมัติ แบ่งหน้าละ 10 คำศัพท์
├── nav_thai.html, nav_thai_2.html, …   # สร้างอัตโนมัติ
├── how-to-add-term_ru.html     # ไฟล์คงที่ แก้ด้วยมือ
├── how-to-add-term_thai.html
├── how-to-translate-term_ru.html
├── how-to-translate-term_thai.html
├── how-to-check-json_ru.html   # ไฟล์คงที่ แก้ด้วยมือ — หน้า «ตรวจ JSON»
├── how-to-check-json_thai.html
├── progress_ru.html            # ไฟล์คงที่ แก้ด้วยมือ — หน้า «ความคืบหน้าของฉัน» (noindex ไม่อยู่ใน sitemap)
├── progress_thai.html
├── terms/                      # สร้างอัตโนมัติ ห้ามแก้ด้วยมือ
│   ├── <id>_ru.html            # การ์ดที่สร้างจากแม่แบบ + JSON
│   ├── <id>_thai.html
│   └── index.html              # หน้าแจ้งย้าย → «/»
├── bundle/                     # «ชุดศัพท์ที่เกี่ยวข้อง» — สร้างอัตโนมัติ ห้ามแก้ด้วยมือ (ดูหัวข้อด้านล่าง)
│   ├── index.html              # หน้าแรกของรายการชุดภาษารัสเซีย ที่อยู่ «/bundle/»
│   ├── bundles_ru.html         # หน้าแจ้งย้าย → «/bundle/»
│   ├── bundles_ru_2.html, bundles_thai.html, …
│   └── bundle_<N>_<ru|thai>[_P].html
├── publications/               # «บทความ» (ดูหัวข้อด้านล่าง)
│   ├── covers/                 # ภาพปกและรูปประกอบบทความ (jpg, jpeg, png) แก้ด้วยมือ บอทไม่แตะต้อง
│   ├── index.html              # สร้างอัตโนมัติ: หน้าแรกของรายการภาษารัสเซีย ที่อยู่ «/publications/»
│   ├── publications_ru.html    # สร้างอัตโนมัติ: หน้าแจ้งย้าย → «/publications/»
│   ├── publications_ru_2.html, publications_thai.html, …   # สร้างอัตโนมัติ
│   └── <ชื่อ>.html              # สร้างอัตโนมัติ: หน้าบทความ
├── sitemap.xml                 # สร้างอัตโนมัติ ห้ามแก้ด้วยมือ
├── sitemap_publications.xml    # สร้างอัตโนมัติ ห้ามแก้ด้วยมือ
├── robots.txt, 404.html, _config.yml, .gitignore   # แก้ด้วยมือ
├── yandex_<code>.html          # ไฟล์ยืนยันความเป็นเจ้าของ (Yandex) อย่าแตะต้อง
├── _src/                       # ไฟล์ต้นทางของการ build; Pages ไม่เผยแพร่ (โฟลเดอร์ขึ้นต้นด้วย «_»)
│   ├── templates/              # แม่แบบการ์ดและหน้ารายการคำศัพท์ — แก้ด้วยมือ
│   │   ├── _template_ru.html, _template_thai.html
│   │   └── _template_nav_ru.html, _template_nav_thai.html
│   ├── bundle/
│   │   ├── json/bundle_<N>_<ru|thai>.json   # แหล่งข้อมูลจริง แก้ด้วยมือ
│   │   └── template/_layout_ru.html, _layout_thai.html   # โครงหน้า แก้ด้วยมือ
│   └── publications/
│       ├── json/publication_<N>_<ru|thai>.json   # ข้อมูลการ์ด แก้ด้วยมือ
│       ├── html/<ชื่อ>.html     # เนื้อหาบทความ (HTML fragment) แก้ด้วยมือ
│       └── template/_layout_ru.html, _layout_thai.html   # โครงหน้า แก้ด้วยมือ
└── docs/for-researchers/ru.md, thai.md   # เอกสารฉบับนี้ (Pages ไม่เผยแพร่ อ่านบน GitHub)

.github/
├── scripts/site-config.js     # โมดูลที่อยู่ของเว็บไซต์ และแม่แบบหน้าแจ้งย้าย
├── scripts/build-terms.js     # สคริปต์ Node สำหรับ build คำศัพท์
├── scripts/build-bundles.js   # สคริปต์ Node สำหรับ build ชุดศัพท์ที่เกี่ยวข้อง
├── scripts/test-bundles.js    # ชุดทดสอบของ build-bundles.js (รันใน workflow ก่อน build)
├── scripts/build-publications.js  # สคริปต์ Node สำหรับ build บทความ
├── scripts/test-publications.js   # ชุดทดสอบของ build-publications.js (รันใน workflow ก่อน build)
├── scripts/test-links.js      # ตรวจลิงก์ของเว็บไซต์ที่ build แล้ว (รันด้วยมือ)
├── scripts/test-seo.js        # ตรวจ canonical, hreflang, sitemap, robots.txt (รันด้วยมือ)
└── workflows/
    ├── build-terms.yml        # trigger: push เข้า json/**, _src/templates/**, render-term.js, thai-numerals.js, build-terms.js, site-config.js หรือสั่งด้วยมือ (Actions → Build terms → Run workflow)
    ├── build-bundles.yml      # trigger: push เข้า _src/bundle/**, build-bundles.js, site-config.js และหลัง build คำศัพท์
    └── build-publications.yml # trigger: push เข้า _src/publications/**, publications/covers/**, css/publications.css, build-publications.js, site-config.js หลัง build คำศัพท์ หรือสั่งด้วยมือ
```

ที่อยู่เดิมของโปรเจกต์คือ `https://indapanno.github.io/buddhism/share/terms/…` (repository `buddhism`)
ปัจจุบันใน `buddhism` ที่อยู่เดิมเหลือเพียงหน้าแจ้งย้าย (`meta refresh` ทันทีและ `canonical`
ไปยังที่อยู่ใหม่) ส่วนเดโม `share/branching/` ยังอยู่ที่นั่นโดยไม่เปลี่ยนแปลง

**กฎสำคัญ:** `terms/`, `bundle/`, `index.html`, `nav_*.html`, `publications/*.html`,
`sitemap.xml` และ `sitemap_publications.xml` เป็นผลลัพธ์จากการ build การแก้ด้วยมือจะอยู่ได้
จนกว่าจะมีการ build ครั้งถัดไป แล้วจะถูกเขียนทับ ไฟล์ที่แก้ไขด้วยมือได้มีเพียง `_src/**`,
`json/<id>_*.json`, `js/*.js`, `css/*.css`, `schema/*.json`, `how-to-*.html`, `progress_*.html`,
`404.html`, `robots.txt`, `docs/**` และ `publications/covers/**` โดย `terms/`, `index.html`,
`nav_*.html` และ `sitemap.xml` เป็นผลลัพธ์ของการ build คำศัพท์ `bundle/` ของการ build ชุดศัพท์ที่เกี่ยวข้อง
`publications/*.html` และ `sitemap_publications.xml` ของการ build บทความ การ build ทุกแบบทำงานฝั่ง GitHub (Actions)
เท่านั้น ไม่ต้อง build และ commit ไฟล์ที่สร้างอัตโนมัติด้วยตนเองในเครื่อง

## สถาปัตยกรรมการ build

1. Push ที่มีการเปลี่ยนแปลงใน `json/**`, `_src/templates/**`, `js/render-term.js`, `js/thai-numerals.js`, `.github/scripts/build-terms.js` หรือ `.github/scripts/site-config.js` จะ trigger `build-terms.yml` สาขา `main` (ระหว่างการย้ายมีสาขา `migration` ด้วย) สั่งด้วยมือได้ที่ Actions → Build terms → Run workflow (บอทจะ commit ผลลัพธ์ให้) ไม่ต้อง commit หน้าที่สร้างในเครื่อง
2. `build-terms.js` อ่านไฟล์ `<id>_ru.json` / `<id>_thai.json` ทั้งหมด รวม id จากทั้งสองภาษาเข้าด้วยกัน
3. สร้างการ์ดคำศัพท์สำหรับแต่ละ id ในแต่ละภาษา (`<id>_ru.html`, `<id>_thai.html`) — หากยังไม่มีคำแปล จะแสดงข้อความ «ยังไม่มีคำแปล» พร้อมลิงก์ไปยัง `how-to-translate-term_*.html` และ `<meta name="robots" content="noindex">` การ์ดที่มีคำแปลจะได้ `canonical`, `hreflang` (ru/th/x-default หากมีคำแปลทั้งสองภาษา), `meta description` (จาก `interpretation` หรือ `reason_introduced`) และ Open Graph
4. สร้างไฟล์ `index_ru.json` / `index_thai.json` ใหม่ (รายการสำหรับการค้นหาฝั่งไคลเอนต์: `id`, `term_ru`/`term_thai`, `later_count`)
5. สร้างหน้านำทางแบบแบ่งหน้าใหม่ (หน้าละ 10 คำศัพท์ เป็นไฟล์ static จริงที่ root: `index.html` คือหน้าแรกของรายการภาษารัสเซีย (ที่อยู่ `/`) จากนั้น `nav_ru_2.html` ภาษาไทยคือ `nav_thai.html`, `nav_thai_2.html` ไม่ใช่ `?page=N` — สำคัญต่อการทำ indexing และให้ใช้งานได้แม้ไม่มี JS) พร้อม `canonical`/`prev`/`next` (ในหน้า 2 ของรายการภาษารัสเซีย `prev` ชี้ไปที่ `/`) และในหน้าแรกของแต่ละภาษา — `hreflang` กับ `meta description`/Open Graph ภาษาที่ยังไม่มีคำศัพท์เลยจะได้ `noindex` แทน แต่ละแถบคือ `<li class="term-item">` ที่มีลิงก์ไปยังคำศัพท์และปุ่ม `<button class="learned-btn" data-learned-id="<id>">` (ใน HTML ใส่ข้อความชั่วคราวตามภาษา — «Не изучен» / «ยังไม่ได้เรียน» ส่วนสถานะจริง `learned.js` เป็นผู้ใส่)
6. เขียนหน้าแจ้งย้ายที่ที่อยู่เดิม: `nav_ru.html` → `/` และ `terms/index.html` → `/` (แม่แบบอยู่ใน `site-config.js`) ลบการ์ดที่ไม่มี id ใน `json/` แล้ว (orphaned ใน `terms/`) และหน้าแบ่งหน้าที่เกินความจำเป็น (ที่ root เฉพาะ `nav_(ru|thai)(_N).html`) ไฟล์อื่น (`how-to-*`, `progress_*`, `404.html`, `index.html` และไฟล์ที่แก้ด้วยมือ) ขั้นตอนนี้ไม่แตะต้อง id คำศัพท์ `index` และชื่อที่สงวนไว้ (`nav_…`, `progress_…`, `terms`, `bundle`, `css`, `js` ฯลฯ ดู `RESERVED_ROOT` ใน `site-config.js`) จะทำให้ build ล้มเหลว
7. สร้าง `sitemap.xml` — เฉพาะการ์ดที่มีคำแปลจริง (ไม่รวมการ์ด «ยังไม่มีคำแปล») และหน้านำทาง (หน้าแรกของรายการภาษารัสเซียใช้ที่อยู่ `https://indapanno.github.io/`) พร้อม `hreflang` ระหว่างเวอร์ชันภาษาของแต่ละคำศัพท์ หน้าแจ้งย้ายไม่รวมอยู่ใน sitemap ไม่มี `lastmod` (วันที่จาก git ใน GitHub Actions ไม่น่าเชื่อถือ)
8. commit ผลลัพธ์ด้วยแท็ก `[skip ci]` (เพื่อป้องกัน trigger วนลูปไม่สิ้นสุด)

`render-term.js` เป็นโมดูลที่ใช้ร่วมกันระหว่าง Node (เรียกผ่าน `require()` ใน
`build-terms.js`) และเบราว์เซอร์ (ปัจจุบันไม่ได้ใช้งานในหน้าที่ build แล้ว เพราะเนื้อหาถูก
ฝังลงใน HTML ตั้งแต่ขั้นตอน build; โมดูลนี้เก็บไว้สำหรับกรณีในอนาคตที่ต้องการเรนเดอร์
ฝั่งไคลเอนต์ เช่น live-preview ในตัวตรวจสอบ JSON)

## ภาษาของหน้า

- **แหล่งข้อมูลเดียว.** ภาษาของหน้ากำหนดจากแอตทริบิวต์ `<html lang>` ซึ่ง build เป็นผู้ใส่ (`ru` / `th`) `lang.js` เปิดให้ใช้เป็น `TermsLang.get()` → `'ru'` หรือ `'thai'` สคริปต์อื่น (`learned`, `search`, `burger-menu`, `term-count`, `footer-counter`, `progress`, `validator-page`) อ่านภาษาจากที่นี่ ไม่อ่านจากชื่อไฟล์ ดังนั้นชื่อหน้าอย่าง `nav_thai_2.html` จึงไม่ทำให้ภาษาผิด
- **ตัวสลับภาษา** (`lang.js`): จากการ์ดคำศัพท์ไปที่ `<id>_<ภาษาอื่น>.html` จากหน้านำทางทุกหน้า (`/`, `nav_<ภาษา>[_N].html`) ไปที่หน้าแรกของอีกภาษา (`/` หรือ `/nav_thai.html`) เพราะหน้า 2 ขึ้นไปของสองภาษาไม่ตรงกัน จากหน้าของชุดศัพท์ (`/bundle/…`) ไปที่ชุดเดียวกันหรือรายการชุดของอีกภาษา จากหน้าบทความ (`/publications/`, `publications_<ภาษา>[_N].html` และตัวบทความ) ไปที่หน้าแรกของรายการบทความอีกภาษา เพราะบทความไม่มีการแปล ตารางที่อยู่อยู่ใน `buildTargetUrl` (`js/lang.js`)
- **ภาษาใหม่.** เพิ่มรหัสภาษาใน `LANG_BY_HTML_LANG` ใน `lang.js` (นอกเหนือจากขั้นตอนในหัวข้อ «การทำเครื่องหมาย «เรียนแล้ว»…»)
- **มาร์กอัปของส่วนหัว** บล็อก `header-controls` มีกลุ่ม `#lang-switch` (ลิงก์ RU / ไทย) และ `#theme-switch` (ปุ่ม 3 ปุ่ม) อยู่ใน `_template_*.html`, `_layout_*.html` และหน้าที่แก้ด้วยมือ (`how-to-*`, `progress_*`) สไตล์ `.segmented` อยู่ใน `style.css` ส่วน `href` และสถานะที่เลือกอยู่ถูกกำหนดโดยสคริปต์
- **การจำภาษา** เมื่อผู้อ่านคลิกเลือกภาษา `lang.js` จะบันทึกคีย์ `terms-lang` (`ru` / `thai`) ซึ่งอ่านโดย `404.html` เท่านั้น ลำดับการกำหนดภาษาในหน้านั้น: URL → หน้าต้นทางของเว็บไซต์เดียวกัน → `terms-lang` → แสดงทั้งสองภาษา
- **การแก้ส่วนหัว** แก้บล็อกในแม่แบบทุกไฟล์ (รวมถึง `_src/bundle/template/_layout_*.html` และ `_src/publications/template/_layout_*.html`) จากนั้นสั่ง «Build terms» ด้วยมือ (Actions → Build terms → Run workflow) และแก้หน้าที่แก้ด้วยมือ โครงหน้าของชุดศัพท์และบทความจะถูก build ใหม่โดย workflow ของตัวเองเมื่อ push เข้า `_src/bundle/**` และ `_src/publications/**`

## การจัดหน้าบนหน้าจอแคบ

- **กฎ (≤479 px).** คอลัมน์ `1fr` จะถูกคำยาวดันให้กว้างเกินจอ (เช่น «сформировавшимся») ทำให้การ์ดเสียรูป ในกริดใหม่ใน `style.css` ให้ใช้ `minmax(0, 1fr)`
- **ที่ใช้แล้ว.** `.meta-grid` ใช้ `minmax(0, 1fr)` บล็อก «Атрибуция» แสดงเป็นคอลัมน์เดียว และ `.field-text` กับลิงก์ใน `main` มี `overflow-wrap` กันไว้ บนหน้าจอกว้างหน้าตาไม่เปลี่ยน
- **สิ่งที่ไม่ควรทำ.** ไม่ใช้ `hyphens: auto` เพราะจะเกิดเครื่องหมายขีดกลางที่ต้นบรรทัด

## โครงสร้าง JSON ของคำศัพท์

หนึ่งไฟล์ต่อหนึ่งภาษา key ที่ต่างกันระหว่างสองภาษามีเพียง `term_ru` ↔ `term_thai`

| Key | ชนิดข้อมูล | คำอธิบาย |
|---|---|---|
| `id` | string | อักษรโรมันตัวพิมพ์เล็ก ไม่มีเครื่องหมายกำกับเสียง — ตรงกับชื่อไฟล์ |
| `term_ru` / `term_thai` | string | คำศัพท์ในภาษาของการ์ด — ตัวอักษรแรกจะถูกทำให้เป็นตัวพิมพ์ใหญ่อัตโนมัติเมื่อ build (เฉพาะภาษารัสเซีย ภาษาไทยไม่มีตัวพิมพ์ใหญ่-เล็ก) |
| `term_iast` | string | อักษรโรมัน IAST ไม่ถูกแปลงตัวพิมพ์ |
| `term_composition` | object | `{is_compound, components: [{part_iast, part_meaning}], note}` — ดูรายละเอียดด้านล่าง |
| `origin` | object | `{type, source_tradition, attestation_before_term, etymology_versions[]}` |
| `dating` | array | `[{type, value, comment}]` |
| `attribution` | object | `{traditional, academic, consensus}` |
| `recorded_by` | string | ผู้บันทึกเป็นลายลักษณ์อักษร |
| `school_tradition` | string | นิกาย/ชั้นของประเพณี |
| `reason_introduced` | string | เหตุผลที่ต้องมีคำนี้ — ใช้ภาษาง่าย |
| `interpretation` | string | ความหมาย — ใช้ภาษาง่าย |
| `language` | string | โดยทั่วไปคือ `"บาลี"` พร้อมคำอธิบายเพิ่มเติมหากซับซ้อน |
| `sources` | array | `[{status, title, location, transmission_tradition, language, source_type, discrepancies}]` |
| `later_mentions` | array | `[{id, parent, author_id, date_updated, updated_by, reason_for_update, what_is_new, school_tradition, source_type, language, source: {title}}]` — key เหมือนกันทั้งสองภาษา ต่างกันเฉพาะค่า |

**`term_composition`** — ใช้สำหรับคำศัพท์ที่ประกอบด้วยคำบาลีที่เป็นคำอิสระตั้งแต่สองคำ
ขึ้นไป (เช่น `paṭicca`+`samuppāda`, `sati`+`upaṭṭhāna`) การแยกคำเป็นอุปสรรค+รากศัพท์
ภายในคำเดียว (เช่น `du-`+`kha` ใน `dukkha`) ไม่นับรวมในที่นี้ — นั่นคือนิรุกติศาสตร์
พื้นบ้าน ใช้ `origin.etymology_versions` แทน `render-term.js` จะเรนเดอร์บล็อก
«คำนี้ประกอบด้วยคำใดบ้าง» เฉพาะเมื่อ `is_compound: true` เท่านั้น

ตัวอย่างไฟล์อ้างอิงฉบับสมบูรณ์ — ดูไฟล์ที่มีอยู่แล้ว เช่น `json/dukkha_ru.json`

### JSON Schema อย่างเป็นทางการ

`schema/term.schema.ru.json` และ `schema/term.schema.thai.json` (draft-07) แปลงตาราง
ด้านบนให้เป็นกฎที่ตรวจสอบได้จริง และผ่านการทดสอบกับทุกคำศัพท์ใน repository แล้ว
ฟิลด์ที่มีชุดค่าปิด — `origin.type`, `origin.etymology_versions[].type`,
`dating[].type`, `sources[].status` — ตรวจด้วย pattern แบบ «รากคำ + ส่วนขยายในวงเล็บ
(ไม่บังคับ)» ไม่ใช่รายการปิดตายตัว: ค่ารากเหล่านี้ถูกกำหนดไว้แน่นอน (ตรงกับตัวเลือกใน
`term-prompt-*.js`) แต่ผู้เขียนยังเพิ่มคำอธิบายในวงเล็บได้ ส่วน `sources[].source_type`
และ `later_mentions[].source_type` จงใจปล่อยเป็นข้อความอิสระ — เพราะเป็นคำศัพท์ที่
เพิ่มขึ้นเรื่อย ๆ ไม่ใช่รายการไม่กี่แบบ ทั้งสอง schema ถูกใช้โดยตัวตรวจสอบออนไลน์
(ดูหัวข้อถัดไป) และนำไปใช้เติมคำอัตโนมัติใน editor ได้เช่นกัน

## ตัวตรวจสอบ JSON แบบออนไลน์

หน้า `how-to-check-json_ru.html` / `_thai.html`: วาง JSON ที่ได้จาก AI แล้วได้รายการ
ข้อผิดพลาดเทียบกับ schema เป็นภาษาที่เข้าใจง่าย ก่อนสร้าง pull request ทำงานในเบราว์เซอร์
ทั้งหมด ไม่ต้องมี backend: `json-validator.js` เป็นการ implement ชุดคำสั่งย่อยของ JSON
Schema draft-07 ที่จำเป็นด้วยตัวเอง (ไม่พึ่ง library ภายนอก ใช้ได้ทั้งในเบราว์เซอร์และ
Node) ผ่านการเทียบผลกับ library อ้างอิง `jsonschema` (Python) แล้วไม่มีความต่างแม้แต่
กรณีเดียวจากตัวอย่างคำศัพท์จริงและ JSON ที่จงใจทำให้ผิด ภาษาของการ์ด (`ru`/`thai`) จะถูก
ตรวจจับอัตโนมัติจากการมี `term_ru` หรือ `term_thai` แล้วโหลด schema ที่ตรงกันจากเว็บไซต์
ผ่าน `fetch('/schema/term.schema.*.json')`

หน้านี้เป็นหน้าทางเทคนิค เหมาะสำหรับผู้ที่ได้ JSON จาก AI มาแล้ว จึงไม่ได้ใส่ไว้ในเมนูหลัก
ของเว็บไซต์ — ลิงก์ไปหน้านี้มีอยู่เฉพาะใน `how-to-add-term_*.html` เป็นขั้นตอนแยกระหว่าง
«ได้ JSON แล้ว» กับ «สร้างไฟล์»

## การทำเครื่องหมาย «เรียนแล้ว» และหน้า «ความคืบหน้าของฉัน»

ผู้อ่านสามารถทำเครื่องหมายคำศัพท์ที่เรียนแล้วได้ ทำงานฝั่งไคลเอนต์ทั้งหมด ไม่มี backend และไม่มีบัญชีผู้ใช้

- **ที่เก็บข้อมูล.** key `pali-terms-learned` ใน `localStorage` ค่าเป็น JSON array ของ id คำศัพท์ (เช่น `["dukkha","sacca"]`) หนึ่ง id มีสถานะเดียวสำหรับทั้งสองภาษา: เครื่องหมายที่ทำบนการ์ดภาษารัสเซียจะแสดงบนการ์ดภาษาไทยด้วย หาก `localStorage` ใช้ไม่ได้ เครื่องหมายจะอยู่ในหน่วยความจำจนกว่าจะปิดแท็บ
- **`js/learned.js`** — โมดูลกลาง อ็อบเจกต์ global `window.Learned`: `isLearned(id)`, `set(id, on)`, `toggle(id)`, `all()`, `merge(ids)` (คืนจำนวนที่เพิ่มใหม่), `clear()`, `refresh(root)` การคลิกที่ `.learned-btn[data-learned-id]` ใด ๆ ถูกจัดการด้วย event handler แบบ delegated ตัวเดียว ปุ่มจึงทำงานได้แม้ใน HTML ที่สร้างภายหลัง การเปลี่ยนแปลงจากแท็บอื่นถูกรับผ่านอีเวนต์ `storage`
- **ปุ่มอยู่ที่ไหน.** บนแถบคำศัพท์ในหน้านำทาง `build-terms.js` เป็นผู้เขียน (ขั้นตอนที่ 5 ของการ build) บนการ์ดคำศัพท์ใช้บล็อก `<div id="learned-bar">` ใน `_template_*.html` ซึ่ง `learned.js` เติมปุ่มและคำอธิบายให้ (id คำศัพท์ได้จากชื่อไฟล์) ในการ์ด «ยังไม่มีคำแปล» การ build จะลบบล็อกนี้ออก (ไม่มีอะไรให้เรียน) และการ์ดเหล่านี้ไม่อยู่ใน `index_<lang>.json` และหน้านำทาง ข้อความอธิบายรวมเหนือรายการในหน้านำทางคือ `<p id="learned-nav-note">` ใน `_template_nav_*.html` เติมโดยสคริปต์เดียวกัน
- **ความจาง.** แถบของคำศัพท์ที่เรียนแล้วมี class `is-learned` (`.term-item.is-learned > a { opacity: .5 }`) ในคำแนะนำของช่องค้นหา `search.js` ใส่ class เดียวกันให้ลิงก์ สไตล์อยู่ใน `css/learned.css` สี «เรียนแล้ว» และ «ข้อผิดพลาด» กำหนดเป็นตัวแปรสำหรับธีมมืดและธีมสว่าง
- **หน้า «ความคืบหน้าของฉัน»** (`/progress_ru.html`, `/progress_thai.html` ไฟล์คงที่ `noindex` ตรรกะอยู่ใน `js/progress.js`):
  - ตัวนับ «เรียนแล้ว X จาก Y» และแถบความคืบหน้า: Y คือจำนวนคำศัพท์ใน `index_<lang>.json`, X คือเครื่องหมายที่มีคำศัพท์อยู่ในรายการนี้
  - **ดาวน์โหลด** — ไฟล์ `pali-terms-progress-ปปปป-ดด-วว.json` รูปแบบ `{"format": "pali-terms-progress", "version": 1, "exported": "<วันที่ ISO>", "learned": ["<id>", …]}` ถ้ารายการว่างจะไม่ส่งออก
  - **โหลดจากไฟล์** — ตรวจไฟล์ (`format` ตรงกัน, `learned` เป็น array, ขนาดไม่เกิน 1 MB, ไม่เกิน 5000 id, แต่ละ id ตรงตามรูปแบบ `[A-Za-z0-9_-]{1,100}`) จากนั้น **รวม** เครื่องหมายเข้ากับของเดิม ไม่มีอะไรถูกลบ ไฟล์แปลกปลอมหรือไฟล์เสียจะถูกปฏิเสธโดยไม่เปลี่ยนแปลงอะไร
  - **ล้างเครื่องหมาย** — `Learned.clear()` หลังยืนยันตรงตำแหน่งปุ่ม (ถ้าไม่มีเครื่องหมาย ปุ่มจะใช้งานไม่ได้ กด Esc เพื่อยกเลิก) หากเปลี่ยนรูปแบบไฟล์ ให้เพิ่ม `version` และปรับ `parseProgressFile` ใน `progress.js`
  - **รายการคำศัพท์ที่เรียนแล้ว** — เรียงตามตัวอักษร (ชื่อจาก `index_<lang>.json` เรียงตามกฎของภาษาของหน้า) หน้าละ 10 คำ เปลี่ยนหน้าได้โดยไม่โหลดซ้ำ ปุ่ม «เรียนแล้ว» ที่แถวนั้นจะยกเลิกเครื่องหมาย ตรงตำแหน่งแถวจะมีข้อความพร้อมลิงก์ «ย้อนกลับ» และคำศัพท์จะย้ายไปอยู่ในรายการที่ยังไม่ได้เรียน
  - **รายการคำศัพท์ที่ยังไม่ได้เรียน** — คำศัพท์ที่เหลือของภาษาของหน้า (ผลต่างระหว่าง `index_<lang>.json` กับเครื่องหมายที่มี) เรียงและแบ่งหน้าแบบเดียวกัน มีหน้าของตัวเอง ปุ่ม «ยังไม่ได้เรียน» จะทำเครื่องหมาย: ตรงตำแหน่งแถวจะมีข้อความพร้อมลิงก์ «ย้อนกลับ» และคำศัพท์จะย้ายไปอยู่ในรายการที่เรียนแล้ว เมื่อไม่มีคำศัพท์ที่ยังไม่ได้เรียนจะแสดง «เรียนทุกคำศัพท์แล้ว»
  - **ข้อความอยู่ใกล้องค์ประกอบ** ข้อความแสดงตรงที่ผู้ใช้ทำงาน ไม่ใช่บรรทัดรวมด้านล่าง: ในรายการเป็นแถวข้อความแทนแถวที่กด (มีได้หนึ่งข้อความทั้งหน้า และหายไปเมื่อทำอย่างอื่นต่อ) ส่วนดาวน์โหลด โหลดจากไฟล์ และล้างเครื่องหมายมีบรรทัดสถานะใต้ปุ่ม (`#progress-status-export`, `-import`, `-reset`) ข้อผิดพลาดตอนเริ่มหน้าอยู่ใต้ตัวนับ (`#progress-status-top`) หลังกด «ย้อนกลับ» รายการจะไปยังหน้าที่คำศัพท์กลับมาและโฟกัสที่ปุ่มของมัน กฎนี้ใช้กับทุกส่วนติดต่อใหม่ของโปรเจกต์
- **เมนูและลิงก์.** รายการ «ความคืบหน้าของฉัน» อยู่ใน `burger-menu.js` ลิงก์ไปหน้านี้อยู่ในคำอธิบายบนหน้านำทางและบนการ์ดคำศัพท์
- **ภาษาใหม่.** ข้อความ UI อยู่ในอ็อบเจกต์ `STR` ภายใน `learned.js`, `progress.js` และ `burger-menu.js` ถ้าเพิ่มภาษาใหม่ ให้เพิ่มข้อความในทั้งสามไฟล์ เพิ่มรหัสภาษาใน `LANG_BY_HTML_LANG` ใน `lang.js` และสร้าง `progress_<lang>.html`

## ชุดศัพท์ที่เกี่ยวข้อง

กลุ่มคำศัพท์ที่เพิ่มไว้แล้วซึ่งควรเรียนไปพร้อมกัน (เช่น คุณสมบัติสี่ประการของพระธรรม)
เป็น «ลูก» ของคำศัพท์ทั่วไป: ไม่มีคำศัพท์ก็ไม่มีชุด แต่การ build ชุดไม่เคยขัดขวางการ build
และเผยแพร่คำศัพท์ ในหน้าเว็บไม่ใช้คำว่า «bundle» ใช้เฉพาะ «ชุดศัพท์ที่เกี่ยวข้อง»
(ภาษารัสเซีย: «Связанные термины»)

**วิธีเพิ่มชุด** วางไฟล์ `_src/bundle/json/bundle_<N>_<ru|thai>.json` แล้วส่งขึ้น GitHub
(ผ่าน Pull request เหมือนคำศัพท์ทั่วไป) `N` คือจำนวนเต็มใดก็ได้ที่ไม่ขึ้นต้นด้วย 0: ไม่ซ้ำ
ข้ามเลขได้ เปลี่ยนไม่ได้และใช้ซ้ำไม่ได้หลังเผยแพร่ (เพราะอยู่ใน URL) รูปแบบมี 3 คีย์เท่านั้น:

```json
{
  "name": "คุณสมบัติสี่ประการของพระธรรม",
  "description": "เหตุผลที่ควรเรียนคำศัพท์เหล่านี้ไปพร้อมกัน",
  "terms": ["sanditthiko", "akalika", "opanayiko", "ehipassiko"]
}
```

`terms` คือ id ของคำศัพท์ที่มีอยู่แล้ว ลำดับในอาร์เรย์คือลำดับบนหน้า ภาษาและหมายเลขอ่านจากชื่อไฟล์เท่านั้น
`terms` ในไฟล์ `_ru` และ `_thai` ของชุดเดียวกันต้องตรงกันทั้งองค์ประกอบและลำดับ
คำศัพท์หนึ่งคำอยู่ได้หลายชุด

**หน้าเว็บ** (อยู่ใน `bundle/` ทั้งหมด `noindex` และมี breadcrumb):
- `bundle/index.html` (ที่อยู่ `/bundle/` หน้าแรกภาษารัสเซีย), `bundles_ru_2.html`…, `bundles_thai.html`, `bundles_thai_2.html`… — รายการชุด (`bundle/bundles_ru.html` เป็นหน้าแจ้งย้าย → `/bundle/`): การ์ดแสดงชื่อ คำอธิบาย
  จำนวนคำศัพท์ และรายการคำ (สูงสุด 5 คำ ที่เหลือแสดงเป็น «และอีก N») แบ่งหน้าละ 10
  เรียงจากใหม่ไปเก่า คือตามหมายเลขในชื่อไฟล์จากมากไปน้อย (หมายเลขมากอยู่บนสุด) ระยะห่างระหว่างการ์ดเท่ากับหน้านำทางคำศัพท์
  ถ้ายังไม่มีชุดจะแสดงข้อความว่ายังไม่มี เมนูหลักลิงก์มาที่หน้านี้
- `bundle_<N>_<ภาษา>.html`, `…_2.html` — หน้าของชุด หน้าตาเหมือนหน้านำทางคำศัพท์
  (การ์ด ปุ่ม «เรียนแล้ว» ค้นหาจากคำศัพท์ทั้งหมดของเว็บไซต์)
- ถ้ามีไฟล์ชุดเพียงภาษาเดียว ภาษาที่เหลือจะได้หน้าแจ้งว่ายังไม่มีคำแปลพร้อมวิธีแปล
  (ไม่แสดงในรายการ)

**ข้อผิดพลาด** ชุดที่มีข้อผิดพลาดจะไม่ถูกเผยแพร่ในภาษาที่ผิด ชุดอื่นยัง build ตามปกติ
และ workflow จะแสดงสีแดงตอนท้าย พร้อมบอกไฟล์ หมายเลข และสาเหตุในล็อก (และเป็น annotation)

| № | ข้อผิดพลาด |
|---|--------|
| 1 | ชื่อไฟล์ไม่ตรงรูปแบบ `bundle_<ตัวเลข>_<ru\|thai>.json` |
| 2 | JSON ไม่ถูกต้อง หรือรากไม่ใช่ออบเจกต์ |
| 3 | ขาดคีย์ `name`, `description` หรือ `terms` |
| 4 | มีคีย์เกิน |
| 5 | `name`/`description` ไม่ใช่สตริงหรือว่างเปล่า |
| 6 | `terms` ไม่ใช่อาร์เรย์ของสตริงที่ไม่ว่าง |
| 7 | `terms` มีคำศัพท์น้อยกว่า 2 คำ |
| 8 | id ซ้ำในชุดเดียวกัน |
| 9 | id ไม่มีอยู่ในระบบ |
| 10 | คำศัพท์ยังไม่มีคำแปลในภาษาของชุด |
| 11 | องค์ประกอบหรือลำดับของ `terms` ใน `_ru` และ `_thai` ไม่ตรงกัน — ไม่เผยแพร่ทั้งสองฉบับ |
| 12 | ข้อความไม่ใช่ภาษาของไฟล์ (`_ru` ไม่มีอักษรซีริลลิก `_thai` ไม่มีอักษรไทย) |

ถ้าข้อผิดพลาดอยู่ในภาษาเดียว (ยกเว้นข้อ 11) อีกภาษาหนึ่งยังเผยแพร่ตามปกติ
ส่วนภาษาที่ผิดจะไม่มีทั้งหน้าและหน้าแจ้งว่ายังไม่มีคำแปล

**การ build** `build-bundles.yml` ทำงานเมื่อ push เข้า `_src/bundle/**`,
`build-bundles.js` และ `site-config.js` เมื่อ build คำศัพท์สำเร็จทุกครั้ง (`workflow_run` เพื่อตรวจชุดใหม่ถ้าคำศัพท์
ถูกลบหรือไม่มีคำแปลแล้ว) และสั่งด้วยมือได้ เริ่มจากรัน `test-bundles.js` แล้ว `build-bundles.js`
สร้าง `bundle/` ใหม่ทั้งหมด (หน้าที่ล้าสมัยจะหายไปเอง) และบอทจะ commit ผลลัพธ์ด้วย `[skip ci]`
สคริปต์อ่านคำศัพท์อย่างเดียวและเขียนเฉพาะ `bundle/` สคริปต์ที่ใช้ร่วมกัน
(`search.js`, `learned.js`, `burger-menu.js`, `term-count.js`) สร้างเส้นทางด้วย `TermsLang.url('…')`
จาก `lang.js` โดยนับจากรากของเว็บไซต์ จึงใช้ได้กับหน้าทุกระดับความลึก

**ข้อจำกัด** ขนาดหน้า (10) ถูกกำหนดซ้ำเป็นค่าคงที่ใน `build-bundles.js` และ `build-terms.js`
`build-bundles.js` ใช้ `render-term.js` และ `thai-numerals.js`

## บทความ

บทความสำหรับผู้อ่าน: การ์ดบทความในหน้ารายการ และหน้าบทความแต่ละหน้า เป็นฟีเจอร์แยกต่างหาก
ที่ไม่ขึ้นกับคำศัพท์และชุดศัพท์ที่เกี่ยวข้อง: การ build บทความไม่ขัดขวางการ build ของสองส่วนนั้น
และไม่ถูกขัดขวางโดยทั้งสองส่วน บทความเขียนด้วยภาษาเดียวและไม่แปลข้ามภาษา (บทความภาษารัสเซียสำหรับ
ผู้อ่านชาวรัสเซีย บทความภาษาไทยสำหรับผู้อ่านชาวไทย) จึงไม่สร้างหน้าแจ้งว่ายังไม่มีคำแปล
เมนู «บทความ» (ภาษารัสเซีย: «Публикации») อยู่ใต้ «ความคืบหน้าของฉัน»

**วิธีเพิ่มบทความ** ใช้สามไฟล์แล้ว push เข้า `main`:
1. เนื้อหาบทความ: `_src/publications/html/<ชื่อ>.html` — HTML fragment (ดูด้านล่าง)
2. ภาพปก: `publications/covers/<ไฟล์>` (jpg, jpeg หรือ png)
3. ข้อมูลการ์ด: `_src/publications/json/publication_<N>_<ru|thai>.json`

`N` เป็นจำนวนเต็มใดก็ได้ที่ไม่ขึ้นต้นด้วยศูนย์: ไม่ซ้ำภายในภาษาเดียวกัน เว้นช่วงได้
ไม่เปลี่ยนหลังเผยแพร่ และไม่นำกลับมาใช้ซ้ำ ภาษากำหนดจากชื่อไฟล์เท่านั้น ยิ่ง `N` มาก
ยิ่งใหม่: การ์ดที่มีเลขมากที่สุดอยู่บนสุด ไม่มีวันที่ใน JSON รูปแบบมี 4 คีย์พอดี:

```json
{
  "cover": "publications_1.jpeg",
  "headline": "ชื่อบทความ",
  "lead": "คำโปรยสองถึงสามประโยค",
  "html": "example-article.html"
}
```

`cover` คือชื่อไฟล์ใน `publications/covers/` และ `html` คือชื่อไฟล์ใน `_src/publications/html/` (ชื่อเท่านั้น ไม่มีโฟลเดอร์)
ชื่อบทความใช้ได้เฉพาะตัวอักษรละตินพิมพ์เล็ก ตัวเลข และขีดกลาง ลงท้ายด้วย `.html`
และต้องไม่ซ้ำกันข้ามทุกภาษา ชื่อ `publications_ru…` และ `publications_thai…` (หน้ารายการ)
ถูกจองไว้โดยอัตโนมัติ เพราะชื่อบทความห้ามมีขีดล่าง

**หน้าเว็บ** (อยู่ใน `publications/` ทั้งหมด สร้างโดย build เท่านั้น):
- `publications/index.html` (ที่อยู่ `/publications/` หน้าแรกภาษารัสเซีย), `publications_ru_2.html`…, `publications_thai.html`… — หน้ารายการ (`publications/publications_ru.html` เป็นหน้าแจ้งย้าย → `/publications/`): การ์ดที่มีภาพปก
  หัวข้อ คำโปรย (สูงสุด 4 บรรทัด) และข้อความเชิญชวน «อ่านต่อ» (ภาษารัสเซีย: «Читать далее») หน้าละ 10 การ์ด มี pagination เรียงจากใหม่ไปเก่า
  ถ้าภาษานั้นยังไม่มีบทความ หน้ายังคงอยู่ แสดงข้อความ «ยังไม่มีบทความ» และเป็น `noindex`
- `<ชื่อ>.html` — หน้าบทความ: breadcrumb ภาพปก `<h1>` ตัวเดียว (จาก `headline`) คำโปรย
  สารบัญ (เมื่อมี `<h2>` ตั้งแต่ 3 หัวขึ้นไป) anchor `s1`, `s2`… ที่หัวข้อ แล้วจึงเป็นเนื้อหา
- ส่วนหัว เมนู ตัวสลับภาษาและธีม ช่องค้นหาคำศัพท์ และส่วนท้าย เหมือนหน้าอื่น โครงหน้า:
  `_src/publications/template/_layout_ru.html`, `_layout_thai.html` ตัวสลับภาษาในทุกหน้าของบทความ
  พาไปที่หน้าแรกของรายการอีกภาษา (`/publications/` หรือ `/publications/publications_thai.html`)

**บทความ: HTML fragment** ไฟล์ใน `_src/publications/html/` คือเนื้อหาบทความเท่านั้น ไม่มี `<html>`, `<head>`,
`<body>` และ `<h1>` ตัว build จะนำไปใส่ในโครงหน้าแล้วเขียนหน้าที่สมบูรณ์ลงใน `publications/`
อนุญาตเฉพาะองค์ประกอบต่อไปนี้:
- `h2`, `h3`, `p`, `ul`, `ol`, `li`, `strong`, `em`, `br`, `sup`, `sub`, `code`, `small`, `hr`
- `a`: `href` (relative หรือ `https://` ลิงก์ภายนอกเปิดในแท็บใหม่พร้อม
  `rel="noopener noreferrer"`) หรือ `data-term="<id>"` — ลิงก์ไปคำศัพท์ ตัว build ใส่ที่อยู่ของ
  การ์ดตามภาษาของบทความให้เอง
- `blockquote` (พร้อม `cite`), `figure` (พร้อม `figcaption`) และ `img` (`src` เป็นชื่อไฟล์ใน
  `covers/` เท่านั้น และต้องมี `alt`), `details` พร้อม `summary`, `table` (`thead`, `tbody`, `tr`,
  `th`, `td` และ `colspan`/`rowspan` ที่เซลล์) — ตัว build ครอบตารางด้วยคอนเทนเนอร์ที่เลื่อนแนวนอนได้
- `aside` เฉพาะ class `callout`, `callout--key`, `callout--practice`, `callout--important` —
  ตัว build ใส่หัวข้อของกล่องเน้นให้เอง («ประเด็นสำคัญ», «ลงมือปฏิบัติ», «โปรดทราบ»)

ห้ามใช้: `script`, `style`, `iframe`, `h1`, `html`, `head`, `body`, แอตทริบิวต์ `style`, `id`,
ตัวจัดการเหตุการณ์ `on*`, `class` อื่นใด, รูปจากภายนอก และลิงก์ที่ไม่ใช่ `https://` ทุกแท็กต้องปิดให้ชัดเจน
นอกจากนี้ build จะปฏิเสธร่องรอยของผู้ช่วย AI ในข้อความ (`[cite: …]`, `oaicite`, `contentReference`, `【…】`)

**ภาพปกและรูปภาพ** ภาพปกใช้เป็นทั้งการ์ด ส่วนหัวของบทความ และ `og:image` (พรีวิวลิงก์ในแอปแชท)
แนะนำขนาด 1200×630 แสดงแบบตัดขอบ รูปภาพภายในบทความอยู่ในโฟลเดอร์ `covers/` เดียวกัน

**ข้อผิดพลาด** บทความที่มีข้อผิดพลาดจะไม่ถูกสร้าง (ทั้งการ์ดและหน้า) ส่วนบทความอื่น build ตามปกติ
workflow จะแสดงสถานะสีแดงในตอนท้ายและเขียนไฟล์กับสาเหตุลงใน log

| № | ข้อผิดพลาด |
|---|-----------|
| 1 | ชื่อ JSON ไม่ตรงกับ `publication_<ตัวเลข>_<ru\|thai>.json` |
| 2 | JSON ไม่ถูกต้อง หรือ root ไม่ใช่ object |
| 3 | ขาดคีย์หรือมีคีย์เกิน (ต้องมี `cover`, `headline`, `lead`, `html` พอดี) |
| 4 | ค่าไม่ใช่ string หรือว่างเปล่า |
| 5 | `cover`/`html` มี path ของโฟลเดอร์ หรือชื่อไม่ถูกต้อง |
| 6 | ไม่มีไฟล์ภาพปกใน `publications/covers/` |
| 7 | ไม่มีไฟล์บทความใน `_src/publications/html/` |
| 8 | ภาพปก: ไม่ใช่ jpg/jpeg/png ไม่ใช่ไฟล์ภาพ (ตรวจจาก signature) หรือใหญ่เกิน 1 MB |
| 9 | `headline`/`lead` ไม่ใช่ภาษาของไฟล์ (ไม่มีอักษรซีริลลิกใน `_ru` ไม่มีอักษรไทยใน `_thai`) |
| 10 | บทความเดียวถูกระบุในหลาย JSON |
| 11 | ในบทความมีแท็กหรือแอตทริบิวต์ที่ไม่อนุญาต แท็กไม่ปิด `<img>` ไม่มี `alt` หรือมีร่องรอยของ AI |
| 12 | บทความว่างเปล่า |
| 15 | ชื่อบทความถูกสงวนไว้: `index.html` หรือขึ้นต้นด้วย `publications_` |

สองกรณีที่ไม่ถอดบทความออกจากเว็บไซต์ แต่ทำให้ workflow เป็นสีแดง: ลิงก์ `data-term` ไปยังคำศัพท์
ที่ไม่มีอยู่หรือยังไม่มีคำแปลในภาษาของบทความ (รหัส 13: ลิงก์กลายเป็นข้อความธรรมดา) และรูปภาพที่ไม่มีไฟล์
หรือไม่ใช่ภาพ (รหัส 14: ข้ามรูปนั้น) ดังนั้นการลบคำศัพท์จะไม่ทำให้บทความที่เผยแพร่แล้วหายไป

คำเตือนใน log (บทความยังถูกสร้าง): `headline` ยาวกว่า 120 หรือ `lead` ยาวกว่า 400 ตัวอักษร
ข้อความบทความสั้นกว่า 300 ตัวอักษร ภาพปกกว้างน้อยกว่า 1200 px หรืออัตราส่วนห่างจาก 1.91:1
มาก และไฟล์ใน `_src/publications/html/` ที่ไม่มี JSON (ไม่ถูกเผยแพร่)

**การ build** `build-publications.yml` ทำงานเมื่อ push เข้า `_src/publications/**`, `publications/covers/**`, `css/publications.css`
และสคริปต์ `build-publications.js`, `test-publications.js`, `site-config.js` หลัง build คำศัพท์สำเร็จทุกครั้ง
(`workflow_run` เพื่อตรวจลิงก์คำศัพท์ซ้ำ) และสั่งด้วยมือได้ เริ่มจากรันชุดทดสอบ แล้ว
`build-publications.js` สร้าง `publications/*.html` ใหม่ทั้งหมด (หน้าที่ล้าสมัยจะหายไปเอง `covers/` ไม่ถูกแตะต้อง)
และบอทจะ commit ไฟล์เหล่านั้นกับ `sitemap_publications.xml` ด้วย `[skip ci]` สคริปต์อ่านคำศัพท์
อย่างเดียวและเขียนเฉพาะสองที่นี้ HTML fragment ถูกตรวจด้วยตัวสแกนแท็กขนาดเล็กที่ไม่มี dependency

**SEO** บทความมี `canonical`, `meta description` จาก `lead`, Open Graph พร้อมภาพปก และไม่มี
`hreflang` (ไม่มีคำแปล) หน้ารายการมี `canonical`, `prev`/`next` และคำอธิบาย หน้ารายการที่ไม่มี
บทความเป็น `noindex` URL ของรายการและบทความรวมอยู่ในไฟล์แยก
`sitemap_publications.xml` (ที่ root ของเว็บไซต์) ซึ่งสร้างโดย `build-publications.js` เท่านั้น จึงไม่กระทบ
`sitemap.xml` และการ build คำศัพท์ ไฟล์นี้ส่งให้ search engine แยกต่างหากผ่านแผงควบคุมของแต่ละเจ้า

**คอมโพเนนต์ใหม่ในบทความ** มี 3 ขั้นตอน: สไตล์ใน `publications.css` แถวใน whitelist (`ALLOWED`)
ใน `build-publications.js` และคำอธิบายใน prompt สำหรับ AI บทความที่เผยแพร่แล้วไม่เปลี่ยน

**ข้อจำกัด** ขนาดหน้า (10) ถูกกำหนดซ้ำเป็นค่าคงที่ใน `build-publications.js`, `build-bundles.js`
และ `build-terms.js` `build-publications.js` ใช้ `render-term.js` และ `thai-numerals.js`
ตัวสแกนแท็กไม่ใช่ HTML parser เต็มรูปแบบ จึงต้องมีแท็กปิดที่ชัดเจนเสมอ ไม่มีวันที่เผยแพร่
ลำดับกำหนดจากเลขในชื่อ JSON เท่านั้น

## SEO และการ index

- การ์ดคำศัพท์และหน้านำทางทุกหน้ามี `canonical`, `hreflang` (เมื่อมีทั้งสองภาษา) และ
  Open Graph — ดู «สถาปัตยกรรมการ build» ด้านบน
- `sitemap.xml` สร้างขึ้นอัตโนมัติ (ขั้นตอนที่ 7 ของการ build) และส่งเข้า Google Search
  Console, Bing Webmaster Tools และ Yandex Webmaster แล้ว
- หน้า `progress_*.html` เป็นหน้าส่วนตัว: `noindex` และไม่อยู่ใน `sitemap.xml`
- หน้าชุดศัพท์ที่เกี่ยวข้อง (`bundle/*` ยกเว้นหน้าแจ้งย้าย `bundles_ru.html` รวมถึงหน้าแจ้งว่ายังไม่มีคำแปล) เป็น `noindex`
  ไม่มี `canonical` และ `hreflang` และไม่อยู่ใน `sitemap.xml` (สร้างโดย `build-terms.js` เท่านั้น)
- หน้าบทความ (`publications/*.html`) ถูก index (หน้ารายการที่ไม่มีบทความเป็น `noindex`) URL ของหน้าเหล่านี้อยู่ในไฟล์แยก
  `sitemap_publications.xml` ที่ `build-publications.js` สร้างเท่านั้น — ดูหัวข้อ «บทความ»
- การ์ดคำศัพท์และหน้านำทางยังไม่มีรูปสำหรับพรีวิวลิงก์ (`og:image`) — วาง Open Graph ไว้แล้ว แต่พรีวิวในแอปแชท
  ยังเป็นแบบข้อความล้วน ส่วนบทความใช้ภาพปกเป็น `og:image`
- `robots.txt` อยู่ที่ root ของเว็บไซต์: `Allow: /` และสองบรรทัด `Sitemap:` (`sitemap.xml`, `sitemap_publications.xml`)
- ทุกหน้าที่ถูก index มี `canonical` หนึ่งตัวที่ตรงกับที่อยู่ของหน้านั้น หน้าแจ้งย้ายที่ที่อยู่เดิมมี `canonical` ไปยังที่อยู่ใหม่และ `meta refresh` ทันที ไม่มี `noindex` ตรวจโดย `test-seo.js` และ `test-links.js`

## การติดตั้งด้วยตนเอง (fork)

1. Fork repository `indapanno/indapanno.github.io` หากต้องการที่อยู่แบบ `https://<username>.github.io/` ให้ตั้งชื่อสำเนาว่า `<username>.github.io`
2. Settings → Pages → Source: `Deploy from a branch`, Branch: `main`, `/ (root)`
3. Settings → Actions → General → Workflow permissions: `Read and write permissions` (จำเป็นสำหรับ `build-terms.yml` ในการ commit อัตโนมัติ)
4. เปลี่ยนค่าคงที่ `SITE_URL` ใน `.github/scripts/site-config.js` ให้เป็นที่อยู่ของคุณเอง — `canonical`, `hreflang`, Open Graph และ `sitemap.xml` ทั้งหมดอ้างอิงจากค่านี้
5. เว็บไซต์จะพร้อมใช้งานที่ `https://<username>.github.io/`
6. พัฒนาในเครื่อง: รัน `node .github/scripts/build-terms.js` จาก root ของ repository — จะ build HTML และ `sitemap.xml` ใหม่โดยไม่ต้อง push เพื่อตรวจสอบก่อน commit

## ข้อจำกัดที่ทราบอยู่แล้ว

- พรอมต์สำหรับให้ AI สร้างคำศัพท์ (`term-prompt-ru.js`/`-thai.js`) และ JSON Schema
  ช่วยลดแต่ไม่ได้ขจัดข้อผิดพลาดทั้งหมด — schema ตรวจแค่โครงสร้างและชนิดข้อมูล ไม่ตรวจ
  ข้อเท็จจริง AI แต่ละตัวตีความคำสั่งต่างกัน อาจมีข้อมูลผิดพลาดหรืออ้างอิงแหล่งที่มาไม่
  ถูกต้อง จำเป็นต้องมีการตรวจสอบโดยมนุษย์ก่อน merge เสมอ
- ด่านเดียวที่กัน JSON ที่ผิดพลาดตอนนี้คือตัวตรวจสอบ ซึ่งผู้ส่งอาจข้ามไปก็ได้ (ลิงก์ไม่ได้
  บังคับให้กด) ยังไม่มีการตรวจสอบอัตโนมัติฝั่ง PR (ดู «แนวทางการพัฒนาต่อไป»)
- เครื่องหมาย «เรียนแล้ว» อยู่ในเบราว์เซอร์ของผู้อ่านเท่านั้น ไม่มีการซิงก์ระหว่างอุปกรณ์อัตโนมัติ: ย้ายด้วยมือผ่านไฟล์ในหน้า «ความคืบหน้าของฉัน» หากล้างเบราว์เซอร์โดยยังไม่ได้ดาวน์โหลดไฟล์ เครื่องหมายจะหายไป

## แนวทางการพัฒนาต่อไป

1. **ลิงก์เชื่อมโยงระหว่างคำศัพท์ (cross-references).** ให้ขั้นตอน build แปลงการกล่าวถึง id ของคำศัพท์ที่มีอยู่แล้ว (ใน `later_mentions[].source.title`, `term_composition`, หรือข้อความในฟิลด์ต่าง ๆ) ให้เป็น `<a href="<id>_thai.html">` โดยอัตโนมัติ — เมื่อคลังคำศัพท์เติบโตขึ้น จะกลายเป็นเครือข่ายความเชื่อมโยงระหว่างแนวคิดโดยไม่ต้องกำกับลิงก์ด้วยมือ
2. **GitHub Action บน pull_request** — ตรวจสอบตาม JSON Schema แบบเดียวกับที่ `json-validator.js` ทำในเบราว์เซอร์ แต่ทำอัตโนมัติฝั่ง PR แสดงข้อผิดพลาดเป็นคอมเมนต์ให้ผู้ส่งเห็นเอง และอาจตั้งค่าให้ merge อัตโนมัติหากไม่พบข้อผิดพลาด schema และตัวตรวจสอบพร้อมใช้แล้ว เหลือแค่ทำตัว Action เอง
3. **การตรวจสอบความสมเหตุสมผลของแหล่งอ้างอิง** — ตรวจรูปแบบของ `sources[].location` เชิง heuristic (เช่น ช่วงเลขที่ของนิกาย) เพื่อจับความผิดปกติที่ชัดเจน โดยไม่ได้อ้างว่าเป็นการตรวจสอบข้อเท็จจริงแบบสมบูรณ์
4. **ชุดทดสอบสำหรับ `build-terms.js`** — smoke test ด้วย `node:test` ในตัว (Node 18+ ไม่ต้องติดตั้งเพิ่ม): การสร้างการ์ดไม่ error เมื่อ JSON ถูกต้อง, การทำตัวพิมพ์ใหญ่ทำงานถูกต้อง, `renderComposition` คืนค่าว่างเมื่อ `is_compound: false`
5. **`og:image`** — รูป 1200×630 สำหรับพรีวิวลิงก์ในแอปแชทและโซเชียล โครงสร้าง Open Graph รองรับไว้แล้ว ขาดแต่ตัวรูป สำหรับบทความทำแล้ว: พรีวิวใช้ภาพปก

Repository: https://github.com/indapanno/indapanno.github.io
