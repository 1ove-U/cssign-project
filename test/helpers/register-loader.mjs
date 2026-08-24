// test/helpers/register-loader.mjs
// จุดเข้าเดียวสำหรับลงทะเบียน stub loader ทั้งหมดผ่าน Node's module.register API
// (Node 20.6+/22 — โปรเจกต์นี้รันด้วย Node 22) ใช้กับ `node --import` ตอนรัน test/check-imports
import { register } from "node:module";

register("./firebase-stub-loader.mjs", import.meta.url);
// รอบที่ 52: เพิ่ม stub สำหรับ @emailjs/browser CDN URL ที่ js/email-notify.js import ตรงๆ
// (แพทเทิร์นเดียวกับ firebase-stub-loader.mjs — ดู emailjs-stub-loader.mjs สำหรับรายละเอียด)
// ไม่กระทบ test เดิมเลย เพราะยังไม่มี .test.mjs ไฟล์ไหน import js/email-notify.js
register("./emailjs-stub-loader.mjs", import.meta.url);
// รอบที่ 66: เพิ่ม stub สำหรับ trackOrderStatus() ที่ js/track-modal.js import จาก ./db-orders.js
// เฉพาะเวลาที่ test/track-modal-form-flow.test.mjs เปิดใช้งานเองผ่าน globalThis flag เท่านั้น
// (ดู db-orders-stub-loader.mjs สำหรับรายละเอียด — ไม่กระทบ test เดิมไฟล์ไหนเลย)
register("./db-orders-stub-loader.mjs", import.meta.url);
// รอบที่ 106: เพิ่ม stub สำหรับ reloadAll() ที่ js/admin-portfolio-form.js import จาก
// ./admin-page.js ตรงๆ ที่ระดับบนสุด (admin-page.js ตัวจริงคือไฟล์ bootstrap ทั้งแอป โหลด
// ไม่ได้ในสภาพแวดล้อมเทส) — ดักเฉพาะ parentURL ที่ตรงกับไฟล์นี้เท่านั้น ไม่กระทบไฟล์อื่นที่ import
// "./admin-page.js" เหมือนกัน (ดู admin-page-stub-loader.mjs สำหรับรายละเอียด)
register("./admin-page-stub-loader.mjs", import.meta.url);
// รอบที่ 121: เพิ่ม stub สำหรับ ovFormatBaht() ที่ js/admin-products-csv.js import จาก
// ./admin-overview-dashboard.js ตรงๆ ที่ระดับบนสุด (ไฟล์นั้นลากทั้งแอปตามมาแบบ circular import
// วนกลับเข้า admin-page.js เอง โหลดไม่ได้ในสภาพแวดล้อมเทส — ดู
// admin-overview-dashboard-stub-loader.mjs สำหรับรายละเอียด) ดักเฉพาะ parentURL ที่ตรงกับ
// js/admin-products-csv.js เท่านั้น ไม่กระทบไฟล์อื่น
register("./admin-overview-dashboard-stub-loader.mjs", import.meta.url);
// รอบที่ 134: เพิ่ม stub สำหรับ import ~20 ไฟล์แท็บย่อย/orders-tab.js/leads/sidebar/
// global-search/keyboard-shortcuts ที่ js/admin-page.js ตัวจริง import ตอน module evaluate —
// ทิศทางตรงข้ามกับ admin-page-stub-loader.mjs ด้านบน (ไฟล์นี้ปล่อยให้ admin-page.js ตัวจริง
// ถูก import ตรงๆ ในฐานะเป้าหมายที่กำลังเทส แต่ดัก "สิ่งที่มันเอง import" แทน — ดู
// admin-page-deps-stub-loader.mjs สำหรับรายละเอียด)
register("./admin-page-deps-stub-loader.mjs", import.meta.url);
