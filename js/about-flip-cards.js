/* ===========================================================
   CS.SIGN — about-flip-cards.js

   2026 refactor (รอบที่ 81): ย้ายออกมาจาก inline <script> ใน about.html/
   en/about.html เดิม (ไม่มีการเปลี่ยน logic ใดๆ เป็นแค่ย้ายโค้ดเชิงโครงสร้าง)
   เพื่อเตรียมเอา 'unsafe-inline' ออกจาก Content-Security-Policy ในอนาคต — ดู
   REFACTOR-PROGRESS.md หัวข้อ "รอบที่ 81"

   EXPERTISE FLIP CARDS — click / tap / keyboard toggle (hover already flips
   them on fine-pointer devices via CSS; this covers touch and keyboard
   activation).
   =========================================================== */
(function () {
  var flips = document.querySelectorAll('.ab-flip');
  flips.forEach(function (card) {
    var toggle = function () {
      var flipped = card.classList.toggle('is-flipped');
      card.setAttribute('aria-pressed', flipped ? 'true' : 'false');
    };
    card.addEventListener('click', toggle);
    card.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggle();
      }
    });
  });
})();
