/* Order-status tracking modal markup — injected once per page, shared across all pages
   (single source of truth). Mirrors the pattern used by js/qmodal-template.js and
   js/chat-widget-template.js. Replaces the old standalone track.html page: instead of
   navigating away, every "เช็คสถานะคำสั่งผลิต" trigger in the header / mobile menu /
   footer now opens this popup in place. Logic lives in js/track-modal.js. */
(function () {
  var HTML = `<div class="tm-overlay" id="tm-overlay" role="dialog" aria-modal="true" aria-labelledby="tm-title" style="display:none;">
  <div class="tm-modal">
    <button class="tm-close" id="tm-close" aria-label="ปิด">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="16" height="16"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>

    <div class="tm-head">
      <div class="tm-head-deco" aria-hidden="true">
        <svg viewBox="0 0 200 200" fill="none"><circle cx="100" cy="100" r="86" stroke="rgba(255,255,255,0.14)" stroke-width="1.5" stroke-dasharray="3 7"/><circle cx="100" cy="100" r="60" stroke="rgba(255,255,255,0.1)" stroke-width="1.5"/></svg>
      </div>
      <span class="tm-eyebrow">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
        เช็คสถานะคำสั่งผลิต
      </span>
      <h2 id="tm-title">งานของคุณถึงไหนแล้ว?</h2>
      <p>กรอกเลขที่คำสั่งผลิต (PO) และเบอร์โทรศัพท์ที่ให้ไว้กับทีมงาน เพื่อดูสถานะล่าสุดได้ทันที ไม่ต้องสมัครสมาชิก</p>
    </div>

    <div class="tm-body" id="tm-body">
      <div class="tm-error" id="tm-error">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <span id="tm-error-text"></span>
      </div>

      <form id="tm-form" autocomplete="off">
        <div class="tm-field">
          <label for="tm-code">เลขที่คำสั่งผลิต (PO)</label>
          <div class="tm-input-wrap">
            <svg class="tm-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2Z"/><path d="M9 13h6M9 17h6"/></svg>
            <input id="tm-code" type="text" placeholder="เช่น PO-2026-0120" required>
          </div>
        </div>
        <div class="tm-field">
          <label for="tm-phone">เบอร์โทรศัพท์</label>
          <div class="tm-input-wrap">
            <svg class="tm-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.362 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
            <input id="tm-phone" type="tel" inputmode="numeric" placeholder="เช่น 0891234567" required>
          </div>
          <div class="tm-field-hint">ใช้แค่เบอร์ 4 ตัวท้ายในการยืนยันตัวตน</div>
        </div>
        <button type="submit" class="tm-submit" id="tm-submit">
          <span class="tm-submit-spinner" aria-hidden="true"></span>
          <span class="tm-submit-label">เช็คสถานะ</span>
          <svg class="tm-submit-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
        </button>
      </form>

      <div class="tm-result" id="tm-result"></div>

      <p class="tm-help">
        หาเลขที่คำสั่งผลิตไม่เจอ? โทร <a href="tel:0628833880">062-883-3880</a> ทีมงานยินดีให้ความช่วยเหลือ
      </p>
    </div>
  </div>
</div>`;
  document.currentScript.insertAdjacentHTML('beforebegin', HTML);
})();
