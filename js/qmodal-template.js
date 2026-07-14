/* Quote-request modal markup — injected once per page, shared across all pages (single source of truth). */
(function () {
  var FORM_DEFAULT = `<div class="qmodal-overlay" id="qmodal-overlay" role="dialog" aria-modal="true" aria-label="ขอใบเสนอราคา" style="display:none;">
  <div class="qmodal">

    <!-- CLOSE BUTTON (top-right corner, always visible) -->
    <button class="qmodal-close" id="qmodal-close" aria-label="ปิด">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="16" height="16"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>

    <!-- TABS -->
    <div class="qmodal-tabs">
      <button type="button" class="qmodal-tab active" id="qm-tab-form" onclick="qmodalSwitchTab('form')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" width="14" height="14"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>
        ขอใบเสนอราคา
      </button>
      <button type="button" class="qmodal-tab" id="qm-tab-contact" onclick="qmodalSwitchTab('contact')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" width="14" height="14"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.13 12 19.79 19.79 0 0 1 1.06 3.4 2 2 0 0 1 3.05 1.22h3a2 2 0 0 1 2 1.72c.127.96.362 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 9.1a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0 1 21 16.92z"/></svg>
        ติดต่อเรา
      </button>
    </div>

    <!-- ═══════════════════════════════════════════
         PANEL 1: QUOTATION FORM
         ═══════════════════════════════════════════ -->
    <div class="qm-body" id="qm-panel-form">
      <div class="qm-form-wrap">
        <div class="qm-form-header">
          <span class="qm-eyebrow">REQUEST QUOTATION FORM</span>
          <h2 class="qm-title">ขอใบเสนอราคา</h2>
        </div>
        <form id="qmodal-form" novalidate>
          <div class="qm-form-row">
            <div class="qm-form-field">
              <label class="qm-form-label">ชื่อ-นามสกุล / บริษัท <span class="qm-req">*</span></label>
              <input class="qmodal-input" type="text" id="qm-name" placeholder="กรอกชื่อหรือชื่อบริษัท" required />
            </div>
            <div class="qm-form-field">
              <label class="qm-form-label">อีเมล</label>
              <input class="qmodal-input" type="email" id="qm-email" placeholder="อีเมลของคุณ" />
            </div>
          </div>
          <div class="qm-form-row">
            <div class="qm-form-field">
              <label class="qm-form-label">เบอร์โทรศัพท์ <span class="qm-req">*</span></label>
              <input class="qmodal-input" type="tel" id="qm-tel" placeholder="08x-xxx-xxxx" required autocomplete="tel" inputmode="tel" pattern="0[0-9]([\\s-]?[0-9]){7,8}" />
            </div>
            <div class="qm-form-field">
              <label class="qm-form-label">บริการที่สนใจ</label>
              <div class="qmodal-select-wrap">
                <select class="qmodal-input qmodal-select" id="qm-service">
                  <option value="" disabled selected>เลือกบริการ</option>
                  <option>ป้ายจราจรภายในโรงงาน</option>
                  <option>ป้ายความปลอดภัย</option>
                  <option>ป้ายอพยพฉุกเฉิน</option>
                  <option>ป้ายโรงพยาบาล / อาคารสาธารณะ</option>
                  <option>ออกแบบป้ายเฉพาะโครงการ</option>
                  <option>อื่นๆ / ขอคำปรึกษา</option>
                </select>
                <svg class="qmodal-select-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M6 9l6 6 6-6"/></svg>
              </div>
            </div>
          </div>
          <div class="qm-form-field">
            <label class="qm-form-label">รายละเอียด</label>
            <textarea class="qmodal-input qmodal-textarea" id="qm-msg" rows="4" placeholder="จำนวน ขนาด วัสดุ หรือรายละเอียดโครงการ..."></textarea>
          </div>
          <div class="cs-turnstile-wrap" id="qm-turnstile"></div>
          <div class="qm-form-footer">
            <label class="qmodal-check">
              <input type="checkbox" id="qm-agree" required />
              <span>ยอมรับ<a href="privacy-policy.html" target="_blank" rel="noopener" style="color:var(--primary);"> นโยบายความเป็นส่วนตัว</a></span>
            </label>
            <button type="submit" class="qm-submit-btn" id="qm-submit-btn">
              <span class="qm-submit-spinner" aria-hidden="true"></span>
              <span class="qm-submit-label">ส่งข้อความ</span>
              <svg class="qm-submit-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="16" height="16"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
            </button>
          </div>
        </form>
        <div class="qmodal-success" id="qmodal-success" style="display:none;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="28" height="28"><circle cx="12" cy="12" r="10" stroke="#10B981"/><path d="M8 12l3 3 5-5" stroke="#10B981"/></svg>
          <p>ขอบคุณครับ! ทีมงานจะติดต่อกลับภายใน 24 ชั่วโมง</p>
        </div>
      </div><!-- /qm-form-wrap -->
    </div><!-- /qm-panel-form -->

    <!-- PANEL 2: CONTACT US -->
    <div class="qm-body" id="qm-panel-contact" style="display:none;">
      <div class="qm-contact-wrap">
        <div class="qm-form-header">
          <span class="qm-eyebrow">CONTACT US</span>
          <h2 class="qm-title">ติดต่อเรา</h2>
        </div>
        <div class="qm-contact-cards">
          <a href="https://maps.google.com/?q=17+%E0%B8%8B%E0%B8%AD%E0%B8%A2%E0%B8%9A%E0%B8%B2%E0%B8%87%E0%B8%81%E0%B8%A3%E0%B8%B0%E0%B8%94%E0%B8%B5%E0%B9%88+1+%E0%B9%81%E0%B8%82%E0%B8%A7%E0%B8%87%E0%B9%81%E0%B8%AA%E0%B8%A1%E0%B8%94%E0%B8%B3+%E0%B9%80%E0%B8%82%E0%B8%95%E0%B8%9A%E0%B8%B2%E0%B8%87%E0%B8%82%E0%B8%B8%E0%B8%99%E0%B9%80%E0%B8%97%E0%B8%B5%E0%B8%A2%E0%B8%99" target="_blank" rel="noopener" class="qm-contact-card">
            <div class="qm-contact-icon qm-contact-icon--blue"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg></div>
            <div class="qm-contact-info"><span class="qm-contact-label">ที่อยู่</span><span class="qm-contact-val">17 ซอยบางกระดี่ 1 แขวงแสมดำ<br>เขตบางขุนเทียน กรุงเทพมหานคร 10150</span></div>
            <svg class="qm-contact-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M9 18l6-6-6-6"/></svg>
          </a>
          <a href="mailto:cssigngroup@gmail.com" class="qm-contact-card">
            <div class="qm-contact-icon qm-contact-icon--blue"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg></div>
            <div class="qm-contact-info"><span class="qm-contact-label">อีเมล</span><span class="qm-contact-val">cssigngroup@gmail.com</span></div>
            <svg class="qm-contact-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M9 18l6-6-6-6"/></svg>
          </a>
          <a href="tel:0628833880" class="qm-contact-card qm-contact-card--phone">
            <div class="qm-contact-icon qm-contact-icon--white"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="22" height="22"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.13 12 19.79 19.79 0 0 1 1.06 3.4 2 2 0 0 1 3.05 1.22h3a2 2 0 0 1 2 1.72c.127.96.362 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 9.1a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0 1 21 16.92z"/></svg></div>
            <div class="qm-contact-info"><span class="qm-contact-label" style="color:rgba(255,255,255,.75);">โทรศัพท์ / Hotline</span><span class="qm-contact-phone-num">062-883-3880</span></div>
          </a>
          <a href="https://line.me/ti/p/@cssigngroup" target="_blank" rel="noopener" class="qm-contact-card qm-contact-card--line">
            <div class="qm-line-qr-block"><img src="https://api.qrserver.com/v1/create-qr-code/?size=72x72&data=https%3A%2F%2Fline.me%2Fti%2Fp%2F%40cssigngroup&color=000000&bgcolor=ffffff" alt="QR LINE @cssigngroup" width="72" height="72" style="border-radius:8px;" loading="lazy" decoding="async"></div>
            <div class="qm-contact-info"><span class="qm-contact-label">LINE Official</span><span class="qm-contact-val" style="font-weight:600;">สแกน QR เพิ่มเพื่อน LINE</span><span class="qm-contact-val" style="color:#06C755;font-size:.8rem;">@cssigngroup</span></div>
            <svg class="qm-contact-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M9 18l6-6-6-6"/></svg>
          </a>
        </div>
      </div>
    </div><!-- /qm-panel-contact -->

  </div><!-- /qmodal -->
</div><!-- /qmodal-overlay -->`;
  document.currentScript.insertAdjacentHTML('beforebegin', FORM_DEFAULT);
})();
