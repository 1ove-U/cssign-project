// ===========================================================
// js/admin-role-ui.js — จำกัด "มุมมอง" แท็บฝั่งแอดมินตาม role ของบัญชีที่ login อยู่
// (P1.6a — ก้าวแรกของ "Simplify Admin UI สำหรับพนักงานที่ไม่เก่ง IT")
// ===========================================================
// role "production" (พนักงานหน้างานผลิต) หลัง login แล้วเห็นแค่แท็บ "คำสั่งผลิต"
// (data-tab="orders") เท่านั้น — ไม่เห็นแท็บภาพรวม/สินค้า/หมวดหมู่/ผลงาน/บทความ/
// คำถามที่พบบ่อย/ลีด/โลโก้ลูกค้า/รีวิวลูกค้า/ตั้งค่าเว็บไซต์ เพื่อลดความรกของหน้าจอ
// สำหรับพนักงานที่ไม่เก่ง IT (ตามที่ P1.6 หัวข้อในแผนระบุไว้)
//
// role "admin"/"staff" (ค่าเริ่มต้นเดิม) และ role ที่ไม่รู้จัก (null/undefined/ค่าอื่น)
// ไม่ถูกจำกัดอะไรเลย เห็นทุกแท็บเหมือนเดิมทุกประการ — ฟังก์ชันนี้ additive ล้วนๆ
//
// สำคัญ: นี่คือการจำกัด "มุมมอง" ฝั่ง client เท่านั้น ไม่ใช่ security boundary จริง —
// สิทธิ์เขียน/ลบจริงบังคับที่ firestore.rules ผ่าน isAdminRole()/staffRole() เหมือนเดิม
// ทุกจุด (role "production" ปัจจุบันนับเป็น "ไม่ใช่ admin" ฝั่ง rules เหมือน "staff" —
// ดูหมายเหตุใน js/db.js upsertStaffRole()) คนที่รู้ URL/เปิด devtools ยังพิมพ์ URL#tab
// หรือแก้ DOM เองได้ ถ้าจะบังคับสิทธิ์อ่าน/เขียนจริงต้องแก้ firestore.rules เพิ่มเติม
// ไม่ใช่แค่ไฟล์นี้

// รายชื่อ data-tab ที่ role "production" เห็นได้ — ตอนนี้มีแค่ "orders" ตามที่ P1.6a
// ระบุไว้ ("เห็นแค่แท็บออเดอร์") — จะเพิ่ม tab อื่นให้ role นี้ในอนาคต แก้ที่รายการนี้ที่เดียว
export const TABS_ALLOWED_FOR_PRODUCTION = ["orders"];

/**
 * ซ่อน/แสดงปุ่มแท็บใน sidebar ตาม role — เรียกครั้งเดียวหลัง login สำเร็จ
 * (ดู js/admin-page.js onAuthChange) เรียกหลังสุดในฟังก์ชันนั้นเสมอ เพื่อให้ role นี้
 * ชนะทั้งแท็บเริ่มต้น (overview) และ deep-link #hash ที่อาจพาไปแท็บที่ไม่ได้รับอนุญาต
 *
 * @param {string|null|undefined} role - role ของบัญชีที่ login อยู่ (จาก getMyStaffRole())
 * @param {object} opts
 * @param {Element} [opts.tabsBox] - container ของปุ่มแท็บ (default: document.getElementById("ad-tabs")
 *   ถ้ามี global document — ไม่มี global document เลยและไม่ได้ส่ง tabsBox มา = คืนออกเงียบๆ ไม่ throw)
 * @param {(tab: string) => void} [opts.switchTab] - ฟังก์ชันสลับแท็บของ admin-page.js
 * @param {() => string} [opts.getActiveTab] - คืนค่า data-tab ของแท็บที่กำลังเปิดอยู่ตอนนี้
 */
export function applyRoleUI(role, opts = {}) {
  const tabsBox = opts.tabsBox || (typeof document !== "undefined" ? document.getElementById("ad-tabs") : null);
  if (!tabsBox) return;

  const isProduction = role === "production";
  tabsBox.querySelectorAll(".cp-tab[data-tab]").forEach(btn => {
    const allowed = !isProduction || TABS_ALLOWED_FOR_PRODUCTION.includes(btn.dataset.tab);
    btn.style.display = allowed ? "" : "none";
  });

  if (!isProduction) return;
  if (typeof opts.switchTab !== "function") return;
  const activeTab = typeof opts.getActiveTab === "function" ? opts.getActiveTab() : null;
  if (!TABS_ALLOWED_FOR_PRODUCTION.includes(activeTab)) {
    opts.switchTab(TABS_ALLOWED_FOR_PRODUCTION[0]);
  }
}
