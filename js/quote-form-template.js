/* Quote-request form markup (P3.0 Phase 2 รอบย่อย 2) — injected once per page, ฟอร์มคนละอันกับ
   qmodal เดิม (js/qmodal-template.js) — ไม่ลบ ไม่แก้ไฟล์นั้น เก็บไว้ใช้กับ inquiry ทั่วไปที่ไม่ผ่าน
   ตะกร้าเหมือนเดิม ฟอร์มนี้ผูกกับ "ขอใบเสนอราคา" จาก modal ตะกร้าเท่านั้น (ต้องมีสินค้าในตะกร้า
   ก่อนเปิดได้ — ดู js/quote-form.js)

   ใช้ id prefix "qr-" (quote-request) ทั้งหมด ไม่ชนกับ "qm-"/"qmodal-" ของฟอร์มเดิม — สองฟอร์มอยู่
   ในหน้าเดียวกันได้พร้อมกัน — ใช้ class เดิมของ css/shared-widgets.css (.qmodal-overlay/.qmodal/
   .qm-body/.qm-form-row/.qmodal-input ฯลฯ) ซ้ำได้เลยเพราะ selector ในไฟล์นั้นอิงจาก class ทั้งหมด
   ไม่มี #qmodal-overlay/id selector ใดๆ (ตรวจแล้วก่อนเขียนไฟล์นี้) จึงไม่ต้องเพิ่ม CSS ใหม่รอบนี้
   — รายการสินค้า read-only ใช้ class .cm-item/.cm-item-name/.cm-item-meta ของ css/cart-modal.css
   ซ้ำเช่นกัน (class-based เหมือนกัน) แค่ไม่ใส่ .cm-item-side (ปุ่มแก้ไข/ลบ) เพราะฟอร์มนี้ไม่ให้แก้
   รายการโดยตรง */
(function () {
  var FORM_DEFAULT = `<div class="qmodal-overlay" id="qr-overlay" role="dialog" aria-modal="true" aria-label="ขอใบเสนอราคา" style="display:none;">
  <div class="qmodal">

    <button class="qmodal-close" id="qr-close" aria-label="ปิด">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="16" height="16"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>

    <div class="qm-body" id="qr-panel-form">
      <div class="qm-form-wrap">
        <div class="qm-form-header">
          <span class="qm-eyebrow" id="qr-eyebrow">REQUEST QUOTATION</span>
          <h2 class="qm-title" id="qr-title">ขอใบเสนอราคา</h2>
        </div>

        <!-- รายการสินค้า (read-only, prefill จากตะกร้า) — render จาก js/quote-form.js ทุกครั้งที่
             เปิดฟอร์ม แก้จำนวน/ลบต้องกลับไปทำในตะกร้าเดิมก่อน (ปิดฟอร์มนี้ → เปิด modal ตะกร้า) -->
        <div class="qr-items-block">
          <div class="qr-items-label" id="qr-items-label">รายการที่ขอใบเสนอราคา</div>
          <div class="cm-list" id="qr-items-list"></div>
        </div>

        <form id="qr-form" novalidate>
          <div class="qm-form-row">
            <div class="qm-form-field">
              <label class="qm-form-label" id="qr-label-name">ชื่อ-นามสกุล / ชื่อนิติบุคคล <span class="qm-req">*</span></label>
              <input class="qmodal-input" type="text" id="qr-name" placeholder="กรอกชื่อหรือชื่อบริษัท" required />
            </div>
            <div class="qm-form-field">
              <label class="qm-form-label" id="qr-label-taxid">เลขผู้เสียภาษี 13 หลัก (ถ้ามี)</label>
              <input class="qmodal-input" type="text" id="qr-taxid" placeholder="x-xxxx-xxxxx-xx-x" inputmode="numeric" />
            </div>
          </div>

          <div class="qm-form-field">
            <label class="qm-form-label" id="qr-label-billing-address">ที่อยู่ออกใบกำกับภาษี</label>
            <textarea class="qmodal-input qmodal-textarea" id="qr-billing-address" rows="2" placeholder="ที่อยู่สำหรับออกเอกสาร"></textarea>
          </div>

          <div class="qm-form-row">
            <div class="qm-form-field">
              <label class="qm-form-label" id="qr-label-contact-person">ชื่อผู้ติดต่อ</label>
              <input class="qmodal-input" type="text" id="qr-contact-person" placeholder="ชื่อผู้ประสานงาน" />
            </div>
            <div class="qm-form-field">
              <label class="qm-form-label" id="qr-label-phone">เบอร์โทรศัพท์ <span class="qm-req">*</span></label>
              <input class="qmodal-input" type="tel" id="qr-phone" placeholder="08x-xxx-xxxx" required autocomplete="tel" inputmode="tel" pattern="0[0-9]([\\s-]?[0-9]){7,8}" />
            </div>
          </div>

          <div class="qm-form-field">
            <label class="qm-form-label" id="qr-label-email">อีเมล</label>
            <input class="qmodal-input" type="email" id="qr-email" placeholder="อีเมลของคุณ" />
          </div>

          <div class="qm-form-field">
            <label class="qmodal-check" id="qr-shipping-same-wrap">
              <input type="checkbox" id="qr-shipping-same" />
              <span id="qr-shipping-same-label">ที่อยู่จัดส่งเหมือนที่อยู่ออกใบกำกับ</span>
            </label>
          </div>
          <div class="qm-form-field">
            <label class="qm-form-label" id="qr-label-shipping-address">ที่อยู่จัดส่ง</label>
            <textarea class="qmodal-input qmodal-textarea" id="qr-shipping-address" rows="2" placeholder="ที่อยู่สำหรับจัดส่งสินค้า"></textarea>
          </div>

          <div class="qm-form-row">
            <div class="qm-form-field">
              <label class="qm-form-label" id="qr-label-wanted-date">วันที่ต้องการใช้งาน</label>
              <input class="qmodal-input" type="date" id="qr-wanted-date" />
            </div>
            <div class="qm-form-field">
              <label class="qm-form-label" id="qr-label-payment-terms">เงื่อนไขการชำระเงินที่ต้องการ</label>
              <div class="qmodal-select-wrap">
                <select class="qmodal-input qmodal-select" id="qr-payment-terms">
                  <option value="" selected>ไม่ระบุ</option>
                  <option value="cash_on_delivery">ชำระเงินสดเมื่อรับสินค้า</option>
                  <option value="full_prepay">โอนเงินก่อนผลิต 100%</option>
                  <option value="deposit_50">มัดจำ 50% ก่อนผลิต ส่วนที่เหลือชำระก่อนส่งมอบ</option>
                  <option value="credit_30">เครดิต 30 วัน (ลูกค้าองค์กร)</option>
                  <option value="other">อื่นๆ / แจ้งทีมงาน</option>
                </select>
                <svg class="qmodal-select-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M6 9l6 6 6-6"/></svg>
              </div>
            </div>
          </div>

          <div class="qm-form-field">
            <label class="qm-form-label" id="qr-label-notes">หมายเหตุเพิ่มเติม</label>
            <textarea class="qmodal-input qmodal-textarea" id="qr-notes" rows="3" placeholder="รายละเอียดเพิ่มเติม (ถ้ามี)"></textarea>
          </div>

          <div class="cs-turnstile-wrap" id="qr-turnstile"></div>
          <div class="qm-form-footer">
            <label class="qmodal-check">
              <input type="checkbox" id="qr-agree" required />
              <span id="qr-agree-label">ยอมรับ<a href="privacy-policy.html" target="_blank" rel="noopener" style="color:var(--primary);"> นโยบายความเป็นส่วนตัว</a></span>
            </label>
            <button type="submit" class="qm-submit-btn" id="qr-submit-btn">
              <span class="qm-submit-spinner" aria-hidden="true"></span>
              <span class="qm-submit-label" id="qr-submit-label">ส่งคำขอใบเสนอราคา</span>
              <svg class="qm-submit-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="16" height="16"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
            </button>
          </div>
        </form>
        <div class="qmodal-success" id="qr-success" style="display:none;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="28" height="28"><circle cx="12" cy="12" r="10" stroke="#10B981"/><path d="M8 12l3 3 5-5" stroke="#10B981"/></svg>
          <p id="qr-success-text">ขอบคุณครับ! ทีมงานจะจัดทำใบเสนอราคาและติดต่อกลับภายใน 24 ชั่วโมง</p>
        </div>
      </div><!-- /qm-form-wrap -->
    </div><!-- /qr-panel-form -->

  </div><!-- /qmodal -->
</div><!-- /qr-overlay -->`;
  document.currentScript.insertAdjacentHTML('beforebegin', FORM_DEFAULT);
})();
