/* ============================================================
   COOKIE CONSENT (PDPA)
   - Shows a banner on first visit.
   - Stores the choice in localStorage as CSSIGN_CONSENT.
   - Exposes window.CSSIGN_CONSENT (object) + a "cssign:consent"
     event so any analytics/marketing script added later can wait
     for consent before loading, e.g.:

       document.addEventListener('cssign:consent', function (e) {
         if (e.detail.analytics) { / * load GA / Meta Pixel here * / }
       });

   Only "necessary" cookies are required for the site to function
   (session, cart/quote form state, security). Analytics and
   marketing are OFF by default until the user opts in.
   ============================================================ */
(function () {
  var STORAGE_KEY = 'CSSIGN_CONSENT';
  var VERSION = 1; // bump if the cookie policy/categories change materially

  function readConsent() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || parsed.v !== VERSION) return null;
      return parsed;
    } catch (e) {
      return null;
    }
  }

  function writeConsent(analytics, marketing) {
    var consent = {
      v: VERSION,
      necessary: true,
      analytics: !!analytics,
      marketing: !!marketing,
      ts: new Date().toISOString()
    };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(consent)); } catch (e) {}
    window.CSSIGN_CONSENT = consent;
    document.dispatchEvent(new CustomEvent('cssign:consent', { detail: consent }));
    return consent;
  }

  // Make current consent (if any) available immediately.
  window.CSSIGN_CONSENT = readConsent() || { necessary: true, analytics: false, marketing: false };

  document.addEventListener('DOMContentLoaded', function () {
    var existing = readConsent();
    if (existing) return; // already decided — don't nag the user again

    var banner = document.createElement('div');
    banner.className = 'cookie-banner';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-live', 'polite');
    banner.setAttribute('aria-label', 'การตั้งค่าคุกกี้');
    banner.innerHTML =
      '<div class="cookie-banner-top">' +
        '<div class="cookie-banner-icon">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 8v.01M8.5 11a1 1 0 100-2 1 1 0 000 2zM9 15a1 1 0 100-2 1 1 0 000 2zM14 15.5a1 1 0 100-2 1 1 0 000 2z"/></svg>' +
        '</div>' +
        '<div class="cookie-banner-text">' +
          '<h3>เว็บไซต์นี้ใช้คุกกี้</h3>' +
          '<p>เราใช้คุกกี้ที่จำเป็นเพื่อให้เว็บไซต์ทำงานได้อย่างถูกต้อง และคุกกี้เพื่อการวิเคราะห์การใช้งาน (เมื่อได้รับความยินยอม) เพื่อพัฒนาประสบการณ์ของท่าน อ่านรายละเอียดเพิ่มเติมได้ที่<a href="privacy-policy.html">นโยบายความเป็นส่วนตัว</a></p>' +
        '</div>' +
      '</div>' +
      '<div class="cookie-banner-settings" id="cookie-settings-panel">' +
        '<div class="cookie-toggle-row">' +
          '<span><strong>จำเป็น</strong><small>ใช้สำหรับการทำงานพื้นฐานของเว็บไซต์ ปิดใช้งานไม่ได้</small></span>' +
          '<span class="cookie-toggle"><input type="checkbox" checked disabled><span class="track"><span class="knob"></span></span></span>' +
        '</div>' +
        '<div class="cookie-toggle-row">' +
          '<span><strong>วิเคราะห์การใช้งาน</strong><small>ช่วยให้เราเข้าใจการใช้งานเว็บไซต์เพื่อปรับปรุงบริการ</small></span>' +
          '<span class="cookie-toggle"><input type="checkbox" id="cookie-toggle-analytics"><span class="track"><span class="knob"></span></span></span>' +
        '</div>' +
        '<div class="cookie-toggle-row">' +
          '<span><strong>การตลาด</strong><small>ใช้สำหรับวัดผลแคมเปญและนำเสนอเนื้อหาที่เกี่ยวข้อง</small></span>' +
          '<span class="cookie-toggle"><input type="checkbox" id="cookie-toggle-marketing"><span class="track"><span class="knob"></span></span></span>' +
        '</div>' +
      '</div>' +
      '<div class="cookie-banner-actions">' +
        '<button type="button" class="btn btn-secondary btn-sm" id="cookie-btn-settings">ตั้งค่า</button>' +
        '<button type="button" class="btn btn-secondary btn-sm" id="cookie-btn-reject">ปฏิเสธทั้งหมด</button>' +
        '<button type="button" class="btn btn-secondary btn-sm" id="cookie-btn-save" style="display:none;">บันทึกการตั้งค่า</button>' +
        '<button type="button" class="btn btn-primary btn-sm" id="cookie-btn-accept">ยอมรับทั้งหมด</button>' +
      '</div>';

    document.body.appendChild(banner);
    document.documentElement.classList.add('has-cookie-banner');
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { banner.classList.add('show'); });
    });

    function dismiss() {
      banner.classList.remove('show');
      document.documentElement.classList.remove('has-cookie-banner');
      setTimeout(function () { banner.remove(); }, 350);
    }

    banner.querySelector('#cookie-btn-accept').addEventListener('click', function () {
      writeConsent(true, true);
      dismiss();
    });

    banner.querySelector('#cookie-btn-reject').addEventListener('click', function () {
      writeConsent(false, false);
      dismiss();
    });

    var settingsPanel = banner.querySelector('#cookie-settings-panel');
    var saveBtn = banner.querySelector('#cookie-btn-save');
    var settingsBtn = banner.querySelector('#cookie-btn-settings');
    settingsBtn.addEventListener('click', function () {
      var open = settingsPanel.classList.toggle('open');
      saveBtn.style.display = open ? '' : 'none';
      settingsBtn.style.display = open ? 'none' : '';
    });

    saveBtn.addEventListener('click', function () {
      var analytics = banner.querySelector('#cookie-toggle-analytics').checked;
      var marketing = banner.querySelector('#cookie-toggle-marketing').checked;
      writeConsent(analytics, marketing);
      dismiss();
    });
  });
})();
