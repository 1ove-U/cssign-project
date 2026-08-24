/**
 * CS.SIGN — analytics.js (Google Analytics 4, ฟรี)
 * ──────────────────────────────────────────────────────────────
 * โหลด GA4 เฉพาะเมื่อผู้ใช้กด "ยอมรับ" คุกกี้หมวด analytics ใน
 * js/cookie-consent.js เท่านั้น (สอดคล้อง PDPA) — ไม่โหลดสคริปต์ GA
 * ล่วงหน้า ไม่ตั้งคุกกี้ใดๆ ก่อนได้รับความยินยอมจากผู้ใช้จริง
 *
 * ═══════════════════ วิธี Setup (ครั้งเดียว, ฟรี) ═══════════════════
 * 1. ล็อกอิน https://analytics.google.com ด้วยอีเมลบริษัท (ฟรี ไม่ต้องผูกบัตร)
 * 2. สร้าง Property ใหม่ชื่อ "CS.SIGN" → เลือก "Web" → ใส่ URL
 *    https://cssign.co.th
 * 3. ไปที่ Admin (ไอคอนเฟือง) → Data Streams → เลือก stream เว็บที่สร้าง
 *    → คัดลอกค่า "Measurement ID" (รูปแบบ G-XXXXXXXXXX)
 * 4. แทนที่ค่า GA_MEASUREMENT_ID ด้านล่างด้วย ID จริงที่คัดลอกมา
 * 5. เทสต์: เปิดเว็บ (โหมด incognito) → กด "ยอมรับ" ในแบนเนอร์คุกกี้ →
 *    เปิด GA4 → Reports → Realtime ควรเห็นผู้ใช้ 1 คนขึ้นภายในไม่กี่วิ
 * ═══════════════════════════════════════════════════════════════════
 */
(function () {
  "use strict";

  var GA_MEASUREMENT_ID = "G-YPEKGLQ20Z";

  // ยังไม่ได้ตั้งค่า ID จริง — ไม่โหลดอะไรเลย กัน error โผล่ใน console ของทุกหน้า
  if (!GA_MEASUREMENT_ID || GA_MEASUREMENT_ID.indexOf("XXXXXXXXXX") !== -1) return;

  var loaded = false;

  function loadGA() {
    if (loaded) return;
    loaded = true;

    window.dataLayer = window.dataLayer || [];
    function gtag() { window.dataLayer.push(arguments); }
    window.gtag = gtag;

    gtag("js", new Date());
    gtag("config", GA_MEASUREMENT_ID, { anonymize_ip: true });

    var s = document.createElement("script");
    s.async = true;
    s.src = "https://www.googletagmanager.com/gtag/js?id=" + GA_MEASUREMENT_ID;
    document.head.appendChild(s);
  }

  // ผู้ใช้เคยกด "ยอมรับ" ไว้แล้วในเซสชันก่อนหน้า (ค่าอ่านจาก localStorage
  // ผ่าน js/cookie-consent.js ซึ่งโหลดก่อนไฟล์นี้เสมอ) → โหลด GA ทันที
  if (window.CSSIGN_CONSENT && window.CSSIGN_CONSENT.analytics) {
    loadGA();
  }

  // ฟังทุกครั้งที่ผู้ใช้กดยอมรับ/ปฏิเสธในแบนเนอร์คุกกี้ (รวมถึงตอนตัดสินใจครั้งแรก)
  document.addEventListener("cssign:consent", function (e) {
    if (e.detail && e.detail.analytics) loadGA();
  });
})();
