/* ===========================================================
   CS.SIGN — portfolio-tab-filter.js

   2026 refactor (รอบที่ 81): ย้ายออกมาจาก inline <script> ใน portfolio.html/
   en/portfolio.html เดิม (ไม่มีการเปลี่ยน logic ใดๆ เป็นแค่ย้ายโค้ดเชิงโครงสร้าง)
   เพื่อเตรียมเอา 'unsafe-inline' ออกจาก Content-Security-Policy ในอนาคต — ดู
   REFACTOR-PROGRESS.md หัวข้อ "รอบที่ 81"

   Portfolio tab filter: filters .port-card elements in #pf-grid by
   data-cat, driven by the .product-tab buttons in #pf-tabs.
   =========================================================== */
(function () {
  var tabs = document.querySelectorAll('#pf-tabs .product-tab');
  var cards = document.querySelectorAll('#pf-grid .port-card');
  var countEl = document.getElementById('pf-count');
  var emptyEl = document.getElementById('pf-empty');

  function applyFilter(filter) {
    var visible = 0;
    cards.forEach(function (card) {
      var match = filter === 'all' || card.getAttribute('data-cat') === filter;
      card.classList.toggle('pf-hidden', !match);
      if (match) visible++;
    });
    countEl.textContent = visible;
    emptyEl.classList.toggle('show', visible === 0);
  }

  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      tabs.forEach(function (t) { t.classList.remove('active'); });
      tab.classList.add('active');
      applyFilter(tab.getAttribute('data-filter'));
    });
  });
})();
