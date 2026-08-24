/* ============================================================
   CS.SIGN — sw.js (P1.7b, service worker)

   จุดประสงค์: ให้หน้าแรก (index.html) + flow "เช็คสถานะคำสั่งผลิต"
   (track-modal ที่ฝังอยู่ในหน้าแรกทุกภาษา) เปิดได้แม้เน็ตช้า/หลุด —
   ไม่ใช่ full offline app, แค่ทำให้ "app shell" (HTML/CSS/JS ที่ใช้
   render UI) มาจาก cache ได้ทันทีถ้าเน็ตมีปัญหา ส่วนข้อมูลจริง
   (Firestore) ยังต้องใช้เน็ตตามปกติ — โค้ด error handling เดิมใน
   db-orders.js/track-modal.js จัดการกรณี fetch ข้อมูลไม่สำเร็จอยู่แล้ว
   ไม่ได้แก้ไฟล์เหล่านั้นในรอบนี้

   เจตนา (ตามกฎกันโค้ดพัง — additive/แยก failure จาก flow เดิม):
   - เป็น classic script (ไม่ใช้ `import`) เพื่อรองรับเบราว์เซอร์ที่ยัง
     ไม่รองรับ module service worker (Firefox ยังไม่รองรับเต็มที่ ณ
     ตอนเขียนโค้ดนี้) — ดู js/pwa-register.js ที่ลงทะเบียนไฟล์นี้แบบ
     classic (ไม่ส่ง { type: "module" })
   - **จงใจไม่ precache/cache หน้าแอดมิน** (admin.html, console.html,
     js/admin-*.js, js/db*.js ทุกไฟล์) เพราะเป็นหน้าที่ต้องข้อมูลสดใหม่
     เสมอ + มีข้อมูลลูกค้า/ออเดอร์ ไม่ควรอยู่ใน Cache Storage ของเบราว์เซอร์
     พนักงานโดยไม่จำเป็น
   - bypass request ข้าม origin ทั้งหมด (Firestore, EmailJS, Cloudinary,
     Cloudflare Worker ฯลฯ) ให้ผ่านไปที่เน็ตตามปกติเสมอ ไม่แตะ/ไม่ cache
   - ถ้า cache API ใช้งานไม่ได้ (browser เก่า/private mode บาง browser)
     ทุกจุด wrap ด้วย try/catch แล้ว fall back เป็น fetch(request) ตรงๆ
     ไม่ทำให้หน้าเว็บพังจากตัว service worker เอง
   ============================================================ */

const SW_VERSION = "v1";
const CACHE_NAME = "cssign-shell-" + SW_VERSION;

// App shell ขั้นต่ำที่พอให้หน้าแรก (ทั้งไทย/อังกฤษ) + track-modal render ได้
// จากแคช — เพิ่มไฟล์ในนี้ได้ในอนาคตถ้าพบว่าจำเป็น แต่ให้คงขนาดเล็กไว้ (แค่
// asset ที่ใช้ตอน "เปิดหน้าแรกได้" ไม่ใช่ทุกหน้าในเว็บ)
const PRECACHE_URLS = [
  "/",
  "/index.html",
  "/en/index.html",
  "/css/style.css",
  "/css/track-modal.css",
  "/js/track-modal-template.js",
  "/js/track-modal.js",
  "/js/nav-menu.js",
  "/js/img-error-fallback.js",
  "/assets/site.webmanifest",
  "/assets/logo.png",
  "/assets/favicon-32x32.png"
];

// เส้นทาง same-origin ที่ "ห้าม" cache แม้จะเป็น GET เพราะเป็นหน้า/สคริปต์
// ฝั่งแอดมินหรือมีข้อมูลอ่อนไหว/ต้องสดใหม่เสมอ
function isExcludedPath(pathname) {
  return (
    pathname.startsWith("/admin") ||
    pathname.startsWith("/console") ||
    pathname.startsWith("/js/admin-") ||
    pathname.startsWith("/js/db") ||
    pathname.startsWith("/js/orders-tab")
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(CACHE_NAME);
        await cache.addAll(PRECACHE_URLS);
      } catch (err) {
        // ไม่ throw ต่อ — ถ้า precache บางไฟล์พลาด (เช่น 404 ระหว่าง dev)
        // ต้องไม่ทำให้ install ทั้งก้อนล้มเหลวจนติดตั้ง SW ไม่ได้เลย
        console.warn("[sw] precache failed:", err);
      }
    })()
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        );
      } catch (err) {
        console.warn("[sw] cache cleanup failed:", err);
      }
    })()
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  // เฉพาะ GET เท่านั้น — ปล่อย POST/PUT/DELETE ฯลฯ (form submit, Firestore
  // write) ผ่านไปตรงๆ เสมอ ไม่แตะ
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // ข้าม origin อื่นทั้งหมด (Firestore/EmailJS/Cloudinary/Cloudflare Worker
  // /Google Fonts ฯลฯ) — ให้ browser จัดการตามปกติ ไม่ cache ไม่ intercept
  if (url.origin !== self.location.origin) return;

  if (isExcludedPath(url.pathname)) return;

  // Navigation (เปิดหน้า HTML ตรงๆ/พิมพ์ URL/คลิกลิงก์): network-first
  // เพื่อให้ได้เนื้อหาล่าสุดเสมอเมื่อมีเน็ต, fallback เป็น cache แล้ว
  // fallback สุดท้ายเป็นหน้าแรกที่ precache ไว้ (กันเปิดไม่ได้เลยตอนออฟไลน์)
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const network = await fetch(request);
          try {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, network.clone());
          } catch {
            /* cache put ล้มเหลวไม่กระทบ response ที่ตอบไปแล้ว */
          }
          return network;
        } catch {
          try {
            const cache = await caches.open(CACHE_NAME);
            const cached =
              (await cache.match(request)) ||
              (await cache.match("/index.html"));
            if (cached) return cached;
          } catch {
            /* ตกไปที่ fetch(request) ตรงๆ ด้านล่าง */
          }
          return fetch(request);
        }
      })()
    );
    return;
  }

  // static asset same-origin อื่นๆ (css/js/รูปภาพ): cache-first แล้วอัปเดต
  // cache เบื้องหลังเมื่อโหลดจากเน็ตสำเร็จ (เร็ว + ยังอัปเดตของใหม่ไว้รอบหน้า)
  event.respondWith(
    (async () => {
      try {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(request);
        if (cached) {
          fetch(request)
            .then((network) => cache.put(request, network.clone()))
            .catch(() => {
              /* อัปเดตพื้นหลังล้มเหลวได้ ไม่กระทบ response ที่ตอบจาก cache ไปแล้ว */
            });
          return cached;
        }
        const network = await fetch(request);
        try {
          cache.put(request, network.clone());
        } catch {
          /* ไม่ใช่ error ที่ต้องบล็อก response */
        }
        return network;
      } catch {
        return fetch(request);
      }
    })()
  );
});
