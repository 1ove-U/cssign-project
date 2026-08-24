/* Cart ("ตะกร้าของฉัน") modal markup — injected once per page, shared across all pages (single
   source of truth). Mirrors the pattern used by js/track-modal-template.js and
   js/qmodal-template.js: this file only injects static HTML; all interactivity (open/close,
   render items from js/cart.js, +/-/remove, empty state, EN mirror) lives in js/cart-modal.js
   (P3.0 Phase 1 รอบย่อย 4 — ยังไม่ได้เขียนในรอบนี้ ดู continue-prompt-p3.0-phase1-round4-cont.md)

   หมายเหตุเรื่อง EN mirror: ต่างจาก track-modal/qmodal ที่ไม่มี EN เลย modal นี้ต้องรองรับ /en/
   ด้วย (ตามที่ cartNavIcon() ใน js/main.js ทำไว้แล้วสำหรับไอคอน/badge) — markup นี้จึงใส่ id ไว้บน
   ทุก text node ที่ต้องแปล (cm-eyebrow-text, cm-title, cm-empty-title, cm-empty-text,
   cm-price-note-text, cm-quote-btn-label) ให้ js/cart-modal.js เซ็ต textContent เป็น EN เอาตอน
   runtime ถ้า /\/en\//.test(location.pathname) — ไม่ทำ 2 ชุด markup แยกกัน (ธรรมเนียมเดียวกับ
   cartNavIcon() ที่ตั้ง label ผ่าน JS ไม่ใช่ duplicate ไฟล์ template ภาษาอังกฤษ) */
(function () {
  var HTML = `<div class="cm-overlay" id="cm-overlay" role="dialog" aria-modal="true" aria-labelledby="cm-title" style="display:none;">
  <div class="cm-modal">
    <button class="cm-close" id="cm-close" aria-label="ปิด">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="16" height="16"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>

    <div class="cm-head">
      <span class="cm-eyebrow">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
        <span id="cm-eyebrow-text">ตะกร้าสินค้า</span>
      </span>
      <h2 id="cm-title">ตะกร้าของฉัน</h2>
    </div>

    <div class="cm-body" id="cm-body">
      <div class="cm-list" id="cm-list"></div>

      <div class="cm-empty" id="cm-empty">
        <div class="cm-empty-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
        </div>
        <div class="cm-empty-title" id="cm-empty-title">ยังไม่มีสินค้าในตะกร้า</div>
        <div class="cm-empty-text" id="cm-empty-text">เลือกดูสินค้าแล้วกด "เพิ่มลงตะกร้า" เพื่อรวบรวมรายการที่สนใจไว้ขอใบเสนอราคาทีเดียว</div>
      </div>

      <div class="cm-price-note" id="cm-price-note">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <span id="cm-price-note-text">ราคาที่แสดงเป็นราคาโดยประมาณ ณ ตอนหยิบใส่ตะกร้าเท่านั้น ไม่ใช่ราคาทางการ ราคาจริงจะยืนยันในใบเสนอราคาจากทีมงาน</span>
      </div>

      <div class="cm-footer" id="cm-footer">
        <button type="button" class="cm-quote-btn" id="cm-quote-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
          <span id="cm-quote-btn-label">ขอใบเสนอราคา</span>
        </button>
      </div>
    </div>
  </div>
</div>`;
  document.currentScript.insertAdjacentHTML('beforebegin', HTML);
})();
