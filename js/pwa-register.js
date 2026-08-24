/* ============================================================
   CS.SIGN — pwa-register.js (P1.7b)

   ลงทะเบียน service worker (sw.js) จาก entry page ของลูกค้า
   (index.html / en/index.html — หน้าที่ track-modal ฝังอยู่) scope ของ
   sw.js เป็น "/" (อยู่ที่ root ของเว็บ) เพราะฉะนั้นลงทะเบียนจากหน้าไหนก็
   คุม fetch ของทั้งโดเมนได้เหมือนกัน — ไม่ต้องใส่สคริปต์นี้ในทุกหน้า

   จงใจเป็น classic script (ไม่ใช้ import/export) และลงทะเบียนแบบ classic
   (ไม่ส่ง { type: "module" }) เพื่อให้ใช้งานได้ในเบราว์เซอร์ที่ยังไม่รองรับ
   module service worker เต็มที่

   Defensive ตามกฎกันโค้ดพัง (แยก failure ของ integration ใหม่ออกจาก
   flow เดิม): guard ด้วย feature detection, รอ 'load' ก่อนเสมอ (ไม่แย่ง
   เวลากับ first paint/critical script อื่น), และ catch ทุกจุดที่อาจ throw
   — ถ้า registration ล้มเหลวด้วยเหตุผลอะไรก็ตาม หน้าเว็บต้องใช้งานได้
   ตามปกติเหมือนไม่มี service worker เลย
   ============================================================ */
(function () {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", function () {
    try {
      navigator.serviceWorker.register("/sw.js").catch(function (err) {
        console.warn("[pwa] service worker registration failed:", err);
      });
    } catch (err) {
      console.warn("[pwa] service worker registration threw:", err);
    }
  });
})();
