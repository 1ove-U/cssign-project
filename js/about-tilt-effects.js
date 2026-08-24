/* ===========================================================
   CS.SIGN — about-tilt-effects.js

   2026 refactor (รอบที่ 81): ย้ายออกมาจาก inline <script> ใน about.html/
   en/about.html เดิม (ไม่มีการเปลี่ยน logic ใดๆ เป็นแค่ย้ายโค้ดเชิงโครงสร้าง)
   เพื่อเตรียมเอา 'unsafe-inline' ออกจาก Content-Security-Policy ในอนาคต — ดู
   REFACTOR-PROGRESS.md หัวข้อ "รอบที่ 81"

   Signature hero panel + value card: gentle 3D tilt toward the cursor on
   fine-pointer devices that don't prefer reduced motion. Purely decorative
   (transform only) so a failed/slow script never breaks layout or hides
   content.
   =========================================================== */
(function () {
  var finePointer = window.matchMedia && window.matchMedia('(pointer: fine)').matches;
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!finePointer || reduceMotion) return;

  // Signature hero panel: gentle 3D tilt toward the cursor
  var sig = document.querySelector('[data-tilt]');
  if (sig) {
    var raf1 = null, sx = 0, sy = 0;
    var applySig = function () {
      raf1 = null;
      sig.style.transform = 'rotateX(' + (sy * -6) + 'deg) rotateY(' + (sx * 6) + 'deg)';
    };
    sig.addEventListener('mousemove', function (e) {
      var r = sig.getBoundingClientRect();
      sx = ((e.clientX - r.left) / r.width - 0.5) * 2;
      sy = ((e.clientY - r.top) / r.height - 0.5) * 2;
      if (!raf1) raf1 = requestAnimationFrame(applySig);
    });
    sig.addEventListener('mouseleave', function () {
      sig.style.transform = 'rotateX(0deg) rotateY(0deg)';
    });
  }

  // Value cards: subtle per-card tilt
  var cards = document.querySelectorAll('[data-tilt-card]');
  cards.forEach(function (card) {
    var raf2 = null, cx = 0, cy = 0;
    var applyCard = function () {
      raf2 = null;
      card.style.transform = 'rotateX(' + (cy * -5) + 'deg) rotateY(' + (cx * 5) + 'deg) translateY(-3px)';
    };
    card.addEventListener('mousemove', function (e) {
      var r = card.getBoundingClientRect();
      cx = ((e.clientX - r.left) / r.width - 0.5) * 2;
      cy = ((e.clientY - r.top) / r.height - 0.5) * 2;
      if (!raf2) raf2 = requestAnimationFrame(applyCard);
    });
    card.addEventListener('mouseleave', function () {
      card.style.transform = '';
    });
  });
})();
