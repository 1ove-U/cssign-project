/* Chat widget markup — injected once per page, shared across all pages (single source of truth) */
(function () {
  var HTML = `<button class="chat-fab" id="chat-fab" aria-label="เปิดแชทกับ AI ผู้ช่วย CS.SIGN">
  <span class="chat-fab-icon chat-fab-icon--chat">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>
      <circle cx="8.5" cy="12" r="1" fill="currentColor" stroke="none"/>
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/>
      <circle cx="15.5" cy="12" r="1" fill="currentColor" stroke="none"/>
    </svg>
  </span>
  <span class="chat-fab-icon chat-fab-icon--close">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  </span>
  <span class="chat-fab-badge" id="chat-badge">1</span>
</button>

<!-- Chat popup window -->
<div class="chat-popup" id="chat-popup" role="dialog" aria-modal="true" aria-label="AI ผู้ช่วย CS.SIGN">

  <!-- Header -->
  <div class="chat-header">
    <div class="chat-header-left">
      <div class="chat-avatar">
        <span class="chat-avatar-img chat-avatar-text">
          <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 15v-3a8 8 0 0 1 16 0v3"/>
            <path d="M20 15.5a2 2 0 0 1-2 2h-1a1.5 1.5 0 0 1-1.5-1.5v-3A1.5 1.5 0 0 1 17 11.5h3zM4 15.5a2 2 0 0 0 2 2h1a1.5 1.5 0 0 0 1.5-1.5v-3A1.5 1.5 0 0 0 7 11.5H4z"/>
          </svg>
        </span>
        <span class="chat-online-dot"></span>
      </div>
      <div class="chat-header-info">
        <div class="chat-header-name">ผู้ช่วย AI ฝ่ายขาย CS.SIGN</div>
        <div class="chat-header-status">
          <span class="chat-status-dot"></span>ตอบโดยระบบ AI · พร้อมช่วยเหลือ
        </div>
      </div>
    </div>
    <button class="chat-close-btn" id="chat-close-btn" aria-label="ปิด">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" width="16" height="16">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </button>
  </div>

  <!-- Messages area -->
  <div class="chat-messages" id="chat-messages">
    <!-- Greeting injected by JS -->
  </div>

  <!-- Quick reply chips -->
  <div class="chat-chips" id="chat-chips">
    <button class="chat-chip" data-msg="ต้องการใบเสนอราคา">ขอใบเสนอราคา</button>
    <button class="chat-chip" data-msg="ป้ายมีมาตรฐานอะไรบ้าง">มาตรฐานที่รองรับ</button>
    <button class="chat-chip" data-msg="ระยะเวลาผลิตและจัดส่งกี่วัน">ระยะเวลาจัดส่ง</button>
    <button class="chat-chip" data-msg="ราคาป้ายความปลอดภัยเริ่มต้นเท่าไร">สอบถามราคา</button>
    <button class="chat-chip" data-msg="ขอดูผลงานหรือตัวอย่างป้ายที่เคยทำ">ผลงานตัวอย่าง</button>
    <button class="chat-chip" data-msg="ขอคุยกับพนักงานขายโดยตรง">คุยกับพนักงานขาย</button>
  </div>

  <!-- Contact channels -->
  <div class="chat-contacts" id="chat-contacts-anchor">
    <div class="chat-contacts-label"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>ติดต่อทีมขายโดยตรง</div>
    <div class="chat-contacts-row">
      <a href="tel:0628833880" class="chat-contact-btn chat-contact-btn--phone" aria-label="โทรศัพท์">
        <span class="chat-contact-ico">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.362 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
        </span>
        <span class="chat-contact-text">
          <span class="chat-contact-title">โทรด่วน</span>
          <span class="chat-contact-sub">062-883-3880</span>
        </span>
      </a>
      <a href="https://line.me/ti/p/@cssigngroup" target="_blank" rel="noopener" class="chat-contact-btn chat-contact-btn--line" aria-label="LINE">
        <span class="chat-contact-ico">
          <svg width="16" height="16" viewBox="0 0 30 30" fill="none"><path fill-rule="evenodd" clip-rule="evenodd" d="M15 3C8.373 3 3 7.71 3 13.5c0 3.486 1.98 6.57 5.04 8.574-.198.738-.756 2.682-.864 3.096-.132.504.186.498.39.363.162-.108 2.562-1.734 3.6-2.436.564.09 1.146.138 1.734.138 6.627 0 12-4.71 12-10.5S21.627 3 15 3z" fill="white"/><path d="M12.6 11.4H11.4c-.33 0-.6.27-.6.6v4.2c0 .33.27.6.6.6h1.2c.33 0 .6-.27.6-.6V12c0-.33-.27-.6-.6-.6z" fill="#06C755"/><path d="M19.2 11.4H18c-.33 0-.6.27-.6.6v2.496l-1.926-2.736a.6.6 0 00-.474-.36H13.8c-.33 0-.6.27-.6.6v4.2c0 .33.27.6.6.6H15c.33 0 .6-.27.6-.6v-2.496l1.932 2.742a.6.6 0 00.468.354H19.2c.33 0 .6-.27.6-.6V12c0-.33-.27-.6-.6-.6z" fill="#06C755"/></svg>
        </span>
        <span class="chat-contact-text">
          <span class="chat-contact-title">LINE</span>
          <span class="chat-contact-sub">@cssigngroup</span>
        </span>
      </a>
      <a href="mailto:cssigngroup@gmail.com" class="chat-contact-btn chat-contact-btn--email" aria-label="อีเมล">
        <span class="chat-contact-ico">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" width="16" height="16"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>
        </span>
        <span class="chat-contact-text">
          <span class="chat-contact-title">อีเมล</span>
          <span class="chat-contact-sub">cssigngroup@gmail.com</span>
        </span>
      </a>
      <a href="https://www.facebook.com/cssignonline/" target="_blank" rel="noopener" class="chat-contact-btn chat-contact-btn--fb" aria-label="Facebook">
        <span class="chat-contact-ico">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" width="16" height="16"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
        </span>
        <span class="chat-contact-text">
          <span class="chat-contact-title">Facebook</span>
          <span class="chat-contact-sub">CS.SIGN Online</span>
        </span>
      </a>
    </div>
  </div>

  <!-- Input bar -->
  <div class="chat-input-bar">
    <textarea
      class="chat-input"
      id="chat-input"
      placeholder="พิมพ์ข้อความ..."
      rows="1"
      maxlength="500"
      aria-label="พิมพ์ข้อความ"
    ></textarea>
    <button class="chat-send-btn" id="chat-send-btn" aria-label="ส่ง" disabled>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" width="18" height="18">
        <line x1="22" y1="2" x2="11" y2="13"/>
        <polygon points="22 2 15 22 11 13 2 9 22 2"/>
      </svg>
    </button>
  </div>
  <div class="chat-footer-note">ผู้ช่วย AI · ข้อมูลอ้างอิงจาก cssign.com</div>
</div>`;
  document.currentScript.insertAdjacentHTML('beforebegin', HTML);
})();
