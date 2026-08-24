/* ============================================================
   SCROLL-DEPTH QUOTE CTA
   - Sitewide (linked on every page except admin.html/console.html).
   - Fires the same way on every device — desktop, tablet, phone —
     once scroll depth passes 70% of the page. No more desktop-only
     mouseleave/exit-intent branch; scroll depth is the single trigger.
   - Auto-dismisses itself AUTO_HIDE_MS after it appears (see the
     `.eic-progress` bar in css/exit-intent-cta.css, which is a 1:1
     visual countdown of this same duration — keep the two in sync
     if this value ever changes). Closing manually (✕ or the CTA
     button) cancels the auto-hide timer immediately.
   - v2 visual: calmer glass panel (single ambient float + icon glow +
     glowing progress tip) instead of the old spinning-ring/scan-line/
     double-pulse stack, plus a subtle cursor-tilt on hover for a bit
     of "advanced" flair without adding visual noise. See the CSS file
     header for the full rundown.
   - Shows a small dismissible card that links to the *existing* quote
     modal (js/lead-quote-modal.js) via window.openModal() — no new
     lead-saving logic, reuses saveLead()/schema as-is (see the
     opts.source/opts.message support added there).
   - No cross-page/day cooldown: it's a fresh trigger on every single
     page load — navigate to another page, scroll past 70% again, it
     shows again. Only guard is "once per page load" (shownThisLoad)
     so it can't re-fire repeatedly while scrolling back and forth on
     the same page.
   ============================================================ */
(function () {
  var MIN_DWELL_MS = 4000;      // don't arm the trigger until the visitor's been on the page a bit
  var SCROLL_THRESHOLD = 0.70;  // 70% scroll depth, every device
  var AUTO_HIDE_MS = 5000;      // popup auto-dismisses itself this long after showing

  var shownThisLoad = false;
  var popup = null;

  function buildPopup() {
    var el = document.createElement('div');
    el.className = 'eic-popup';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-live', 'polite');
    el.setAttribute('aria-label', 'ข้อเสนอใบเสนอราคาฟรี');
    el.innerHTML =
      '<button type="button" class="eic-close" id="eic-close" aria-label="ปิด">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
      '</button>' +
      '<div class="eic-eyebrow"><i></i>ทีมขาย · ตอบกลับไว</div>' +
      '<div class="eic-row">' +
        '<div class="eic-icon">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12.6 2.6 21 11l-9 9-8.4-8.4A2 2 0 0 1 3 10.2V4a1.4 1.4 0 0 1 1.4-1.4h6.2c.5 0 1 .2 1 1Z"/><circle cx="7.4" cy="7.4" r="1.2"/></svg>' +
        '</div>' +
        '<div class="eic-body">' +
          '<p class="eic-title">ให้เราเสนอราคาให้ไหม</p>' +
          '<p class="eic-sub">แจ้งป้ายที่สนใจ ทีมงานติดต่อกลับพร้อมราคา ฟรี ไม่มีค่าใช้จ่าย</p>' +
          '<button type="button" class="eic-cta" id="eic-cta">' +
            'ขอใบเสนอราคา' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M5 12h14M13 5l7 7-7 7"/></svg>' +
          '</button>' +
        '</div>' +
      '</div>' +
      '<div class="eic-progress" aria-hidden="true"><i></i></div>';
    document.body.appendChild(el);
    return el;
  }

  var autoHideTimer = null;

  function hidePopup() {
    if (!popup) return;
    window.clearTimeout(autoHideTimer);
    var el = popup;
    popup = null;
    document.documentElement.classList.remove('has-eic-popup');
    el.classList.remove('show');
    el.classList.add('hide');
    setTimeout(function () { el.remove(); }, 400);
  }

  function showPopup() {
    if (shownThisLoad) return;

    /* อย่าโชว์ทับตอนที่ฟอร์มขอใบเสนอราคาเดิม (หรืออย่างอื่นที่คล้ายกัน) เปิดอยู่แล้ว */
    var qmodal = document.getElementById('qmodal-overlay');
    if (qmodal && qmodal.style.display === 'flex') return;

    shownThisLoad = true;

    /* บัค UI ที่แก้: ป๊อปอัพนี้ (bottom-left, กว้างเกือบเต็มจอมือถือ) กับปุ่ม
       back-to-top (bottom-left เหมือนกัน) และปุ่มแชท (bottom-right แต่จอแคบๆ
       ก็ชนได้) ไม่เคยมีใครหลบใคร — ป๊อปอัพจะลอยทับปุ่มเหล่านั้นตรงๆ เพราะ
       ป๊อปอัพนี้โผล่ตอน scroll 70% ซึ่ง back-to-top (โผล่แค่ ~90% ของความสูงจอ)
       โชว์อยู่ก่อนแล้วแทบทุกครั้ง ใช้คลาสนี้ให้ CSS ซ่อน/หลบให้แทน */
    document.documentElement.classList.add('has-eic-popup');

    popup = buildPopup();
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { if (popup) popup.classList.add('show'); });
    });

    /* auto-dismiss — the .eic-progress bar's CSS animation is the visual
       countdown for this same window, so the popup disappearing lines up
       with the bar finishing its drain */
    autoHideTimer = window.setTimeout(hidePopup, AUTO_HIDE_MS);

    /* subtle cursor-reactive tilt while hovering — a small "advanced" touch
       that only shows up on interaction rather than animating at rest.
       Skipped on touch devices via the (hover: none) CSS fallback, but we
       also just no-op harmlessly there since mousemove won't fire. */
    var MAX_TILT = 5; // degrees
    popup.addEventListener('mousemove', function (e) {
      var rect = popup.getBoundingClientRect();
      var px = (e.clientX - rect.left) / rect.width;  // 0..1
      var py = (e.clientY - rect.top) / rect.height;  // 0..1
      var ry = (px - 0.5) * 2 * MAX_TILT;   // left/right -> rotateY
      var rx = (0.5 - py) * 2 * MAX_TILT;   // up/down    -> rotateX
      popup.style.setProperty('--eic-ry', ry.toFixed(2) + 'deg');
      popup.style.setProperty('--eic-rx', rx.toFixed(2) + 'deg');
    });
    popup.addEventListener('mouseleave', function () {
      popup.style.setProperty('--eic-ry', '0deg');
      popup.style.setProperty('--eic-rx', '0deg');
    });

    popup.querySelector('#eic-close').addEventListener('click', hidePopup);
    popup.querySelector('#eic-cta').addEventListener('click', function () {
      hidePopup();
      if (typeof window.openModal === 'function') {
        window.openModal('form', { source: 'exit_intent_cta' });
      } else {
        /* หน้าที่ไม่มีฟอร์มโมดัลติดตั้งอยู่ (เช่น หน้าบล็อก/หน้านโยบาย/404/en) —
           พาไปหน้าติดต่อซึ่งมีฟอร์มขอใบเสนอราคาอยู่แล้วแทนที่จะกดแล้วไม่มีอะไรเกิดขึ้น
           — /en/ ลึกไปหนึ่งชั้น เลยต้องขึ้นก่อนหนึ่งระดับ */
        var inEnFolder = /\/en\//.test(window.location.pathname);
        window.location.href = (inEnFolder ? '../' : '') + 'contact.html';
      }
    });
  }

  var armedAt = Date.now() + MIN_DWELL_MS;

  /* ── debug hook: shows immediately, no need to scroll/wait —
     window.CSSIGN_EXIT_CTA.show() in the console */
  window.CSSIGN_EXIT_CTA = {
    show: function () { shownThisLoad = false; showPopup(); }
  };

  /* single trigger for every device: desktop, tablet, phone all fire the
     same way once scroll depth passes SCROLL_THRESHOLD (70%) */
  var ticking = false;
  window.addEventListener('scroll', function () {
    if (shownThisLoad || Date.now() < armedAt || ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      ticking = false;
      var doc = document.documentElement;
      var scrollable = doc.scrollHeight - doc.clientHeight;
      if (scrollable <= 0) return;
      var depth = (window.scrollY || doc.scrollTop) / scrollable;
      if (depth >= SCROLL_THRESHOLD) showPopup();
    });
  }, { passive: true });
})();
