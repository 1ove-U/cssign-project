// ===========================
// js/products-filters.js — หมวดหมู่/แท็บ (dropdown หมวดใหญ่ + แถบหมวดย่อย) + deep-link filter
// แยกออกมาจาก js/products.js (354 บรรทัดเดิม)
//
// 2026 refactor phase 22: แยกส่วน "การกรองด้วยหมวดหมู่" (currentGroupFilter, applyCardFilter,
// filterCategoryTabsByGroup, bindGroupDropdown, bindTabFilter, applyDeepLinkFilter) ออกมาทั้งหมด
// แบบ diff เป๊ะ ไม่เปลี่ยน logic — เป็นจุดตัดที่สะอาดเพราะ applyCardFilter/filterCategoryTabsByGroup/
// bindGroupDropdown ถูกเรียกใช้แค่จากกันเองภายในกลุ่มนี้เท่านั้น (ไม่มีที่อื่นใน products.js
// เรียกตรงๆ) จึงไม่ต้อง export ออกไปเลย — เหลือ export แค่ bindTabFilter()/applyDeepLinkFilter()
// (เรียกจาก render()/Promise.all ใน products.js) และ setGroupFilter() (setter สำหรับ
// currentGroupFilter ที่ products.js ต้อง reset เป็น 'all' ทุกครั้งก่อนสร้าง tabsHTML/
// groupDropdownHTML ใหม่ใน render() — reassign import binding ตรงๆ ไม่ได้ จึงต้องมี setter
// แบบเดียวกับ setBCurrentPage ที่ใช้แยก admin-blog.js phase 21)
//
// ไฟล์นี้ query DOM element ของตัวเอง (product-grid/product-tabs-dynamic/
// product-group-tabs-dynamic) เหมือนกับที่ admin-blog-form.js ทำกับ ad-b-* — เรียก
// document.getElementById ซ้ำจาก products.js ก็ได้ผลลัพธ์เป็น DOM node เดียวกันเสมอ
// ไม่มีผลข้างเคียง — products.js ยังคง guard `if (!tabsWrap || !grid) return;` ของตัวเองไว้
// เหมือนเดิม (ไฟล์นี้แค่ไม่ได้ผูกกับ guard นั้นโดยตรง เพราะฟังก์ชันที่ export ออกไปจะถูกเรียก
// จาก products.js เองเท่านั้น ซึ่งจะไม่เรียกเลยถ้า guard ทำงาน)
// ===========================

var groupTabsWrap = document.getElementById('product-group-tabs-dynamic');
var tabsWrap = document.getElementById('product-tabs-dynamic');
var grid = document.getElementById('product-grid');

/* หมวดหมู่ใหญ่ที่กำลังเลือกอยู่ ('all' = ทุกหมวดหมู่ใหญ่) — คุมว่าแถบหมวดหมู่ย่อย
   แถวที่สองจะกรองให้เหลือแค่หมวดหมู่ย่อยของหมวดใหญ่นี้เท่านั้น */
var currentGroupFilter = 'all';

// setter สำหรับ products.js (reassign import binding ตรงๆ ไม่ได้) — เรียกใน render()
// ก่อนสร้าง tabsHTML/groupDropdownHTML ใหม่ทุกครั้งที่โหลดข้อมูลสินค้า
export function setGroupFilter(v) { currentGroupFilter = v; }

/* กรองการ์ดตามหมวดหมู่ใหญ่ที่เลือก (currentGroupFilter) และหมวดหมู่ย่อยที่เลือกในแถวที่สอง
   ('all' ทั้งคู่ = แสดงทุกใบ) เรียกทุกครั้งที่มีการคลิก tab แถวไหนก็ตาม */
function applyCardFilter(catFilter) {
  var cards = grid.querySelectorAll('.product-card');
  cards.forEach(function (card) {
    var groupMatch = (currentGroupFilter === 'all') || (card.getAttribute('data-group') === currentGroupFilter);
    var catMatch = (catFilter === 'all') || (card.getAttribute('data-cat') === catFilter);
    card.style.display = (groupMatch && catMatch) ? '' : 'none';
  });
}

/* แถบหมวดหมู่ย่อยแสดงเฉพาะรายการที่อยู่ใต้หมวดหมู่ใหญ่ที่กำลังเลือก และ "ซ่อนทั้งแถว"
   ไปเลยตอนยังไม่ได้เลือกหมวดหมู่ใหญ่ใดๆ (currentGroupFilter === 'all') — ผู้ใช้ต้องคลิก
   หมวดหมู่ใหญ่ก่อน แถวหมวดหมู่ย่อยถึงค่อยโผล่มาให้เลือกต่อ ไม่ใช่โชว์ทั้ง 2 แถวพร้อมกัน
   ตั้งแต่แรก — สลับ tab ที่ active กลับไปที่ "ทั้งหมด" ของแถวย่อยทุกครั้งที่หมวดหมู่ใหญ่
   เปลี่ยน เพื่อไม่ให้ค้างหมวดหมู่ย่อยของหมวดใหญ่ก่อนหน้า */
function filterCategoryTabsByGroup() {
  var catTabs = tabsWrap.querySelectorAll('.product-tab');
  catTabs.forEach(function (tab) {
    var tabGroup = tab.getAttribute('data-group-id');
    var visible = (tab.getAttribute('data-filter') === 'all') || (tabGroup === currentGroupFilter);
    tab.style.display = visible ? '' : 'none';
  });
  catTabs.forEach(function (t) { t.classList.remove('active'); });
  var allCatTab = tabsWrap.querySelector('.product-tab[data-filter="all"]');
  if (allCatTab) allCatTab.classList.add('active');
  tabsWrap.classList.toggle('is-collapsed', currentGroupFilter === 'all');
  if (window.CSIGN && window.CSIGN.initTabsOverflow) window.CSIGN.initTabsOverflow(tabsWrap);
}

/* ดรอปดาวน์หมวดหมู่ใหญ่ (แทนที่แถบปุ่มพิลแถวบนแบบเดิม) — เปิด/ปิดเมนู, อัปเดต
   ข้อความหมวดที่เลือกอยู่บนปุ่ม, แล้วส่งต่อไปยัง pipeline การกรองเดิมทุกจุด
   (filterCategoryTabsByGroup + applyCardFilter) เหมือนตอนยังเป็นปุ่มพิลอยู่ ไม่มี
   อะไรเปลี่ยนในฝั่งตรรกะการกรอง เปลี่ยนแค่ UI ที่ใช้เลือก */
function bindGroupDropdown() {
  if (!groupTabsWrap) return;
  var btn = groupTabsWrap.querySelector('.pr-group-select-btn');
  var menu = groupTabsWrap.querySelector('.pr-group-select-menu');
  var valueEl = groupTabsWrap.querySelector('.pr-group-select-value');
  var options = groupTabsWrap.querySelectorAll('.pr-group-select-option');
  if (!btn || !menu) return;

  function closeDropdown() {
    groupTabsWrap.classList.remove('open');
    btn.setAttribute('aria-expanded', 'false');
  }
  function openDropdown() {
    groupTabsWrap.classList.add('open');
    btn.setAttribute('aria-expanded', 'true');
  }

  btn.addEventListener('click', function (e) {
    e.stopPropagation();
    if (groupTabsWrap.classList.contains('open')) closeDropdown(); else openDropdown();
  });
  document.addEventListener('click', function (e) {
    if (!groupTabsWrap.contains(e.target)) closeDropdown();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeDropdown();
  });

  options.forEach(function (opt) {
    opt.addEventListener('click', function () {
      options.forEach(function (o) {
        o.classList.remove('active');
        o.setAttribute('aria-selected', 'false');
      });
      opt.classList.add('active');
      opt.setAttribute('aria-selected', 'true');
      if (valueEl) valueEl.textContent = opt.textContent;
      currentGroupFilter = opt.getAttribute('data-filter');
      filterCategoryTabsByGroup();
      applyCardFilter('all');
      closeDropdown();
      btn.focus();
    });
  });
}

export function bindTabFilter() {
  var tabs = tabsWrap.querySelectorAll('.product-tab');
  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      tabs.forEach(function (t) { t.classList.remove('active'); });
      tab.classList.add('active');
      applyCardFilter(tab.getAttribute('data-filter'));
    });
  });
  bindGroupDropdown();
}

/* -----------------------------------------------------------
   Deep-link category filter (?cat=xxx from header/menu links).
   The header links do a full page reload to products.html?cat=...
   and an inline script in products.html clicks the matching tab
   ~200ms after load. But once real Firestore data arrives, render()
   rebuilds the tab buttons from scratch (always defaulting back to
   "all"), silently wiping out that selection. Re-apply it here for
   any category value, right after the real tabs are in the DOM.
   ----------------------------------------------------------- */
export function applyDeepLinkFilter() {
  var params = new URLSearchParams(window.location.search);
  var group = params.get('group');
  var cat = params.get('cat');

  // ลิงก์จากเมนู header (nav-menu.js) ส่งมาแค่ ?cat=... ไม่มี ?group= —
  // หาหมวดใหญ่ของหมวดย่อยนั้นเอง แล้วจำลองคลิกหมวดใหญ่ก่อน แถวหมวดย่อยถึงจะโผล่ขึ้นมา
  if (!group && cat && cat !== 'all') {
    var catTabPeek = tabsWrap.querySelector('.product-tab[data-filter="' + cat + '"]');
    var peekedGroup = catTabPeek ? catTabPeek.getAttribute('data-group-id') : '';
    if (peekedGroup) group = peekedGroup;
  }

  if (group && group !== 'all' && groupTabsWrap) {
    var gOpt = groupTabsWrap.querySelector('.pr-group-select-option[data-filter="' + group + '"]');
    if (gOpt) gOpt.click();
  }
  if (!cat || cat === 'all') return;
  var tab = tabsWrap.querySelector('.product-tab[data-filter="' + cat + '"]');
  if (tab) tab.click();
}
