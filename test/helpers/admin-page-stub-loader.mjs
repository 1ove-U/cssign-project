// test/helpers/admin-page-stub-loader.mjs
//
// ใช้กับไฟล์เทสของฟอร์มโมดัลในแท็บแอดมินที่ import { reloadAll } from "./admin-page.js" ตรงๆ
// ที่ระดับบนสุดของไฟล์ (top-level import) — admin-page.js ตัวจริงเป็นไฟล์ bootstrap ทั้งหน้าแอดมิน
// (import js/db.js + orders-tab.js + เกือบทุกไฟล์ admin-*.js อีก ~30 ไฟล์ พร้อม side-effect ผูก
// event ของ auth/sidebar/global-search ทันทีตอน evaluate) — ถ้าปล่อยให้โหลดจริงในเทสจะดึงทั้งแอป
// มาด้วย ไม่ใช่แค่ reloadAll() ที่ต้องการ จึง stub เฉพาะจุดนี้แทน (เหมือนแพทเทิร์น
// test/helpers/db-orders-stub-loader.mjs รอบ 66 — ดัก specifier เฉพาะตอนที่ parentURL ตรงกับ
// ไฟล์เป้าหมายที่อยู่ใน "รายชื่อที่อนุญาต" ด้านล่างเท่านั้น กัน false-positive กับไฟล์อื่นที่
// import "./admin-page.js" ชื่อเดียวกัน เช่น admin-sidebar.js/admin-global-search.js ที่ import
// switchTab แทน)
//
// ไม่ nextResolve ไปโหลดไฟล์จริงเลย (ต่างจาก db-orders-stub-loader ที่ยัง re-export ค่าคงที่จาก
// ไฟล์จริง) เพราะ admin-page.js ตัวจริงโหลดไม่ได้ในสภาพแวดล้อมเทสอยู่แล้วตั้งแต่ต้น (ไม่ใช่แค่ไม่
// อยากโหลด) — สร้างโมดูลปลอมทั้งฟังก์ชันแทน อ่านค่าที่จะคืน/นับจำนวนครั้งที่ถูกเรียกผ่าน
// globalThis.__AD_PAGE_STUB_RELOAD_ALL__ (function ที่เทสตั้งไว้ก่อน import — ถ้าไม่ได้ตั้งไว้
// จะ resolve เฉยๆ ไม่ throw)
//
// รอบที่ 106: สร้างไฟล์นี้ครั้งแรก ใช้กับ js/admin-portfolio-form.js เท่านั้น
// รอบที่ 107: เพิ่ม js/admin-products-form.js เข้ารายชื่อที่อนุญาต (ไฟล์ถัดไปในกลุ่ม admin-*
// ที่ import reloadAll แบบเดียวกัน — ตามที่บันทึกไว้ท้ายรอบ 106 ว่า stub นี้ใช้ซ้ำได้)
// รอบที่ 108: เพิ่ม js/admin-groups.js เข้ารายชื่อที่อนุญาต (import reloadAll จาก
// admin-page.js ตรงๆ แบบเดียวกัน — เรียกใน gForm submit handler หลัง saveGroup() สำเร็จ)
// รอบที่ 109: เพิ่ม js/admin-categories.js เข้ารายชื่อที่อนุญาต (import reloadAll จาก
// admin-page.js ตรงๆ แบบเดียวกัน — เรียกใน cForm submit handler หลัง saveCategory() สำเร็จ,
// และใน cTableBody delete handler ผ่าน deleteWithUndo({ onCommitted: reloadAll }))
// รอบที่ 110: เพิ่ม js/admin-faq.js เข้ารายชื่อที่อนุญาต (import reloadAll จาก admin-page.js
// ตรงๆ แบบเดียวกัน — เรียกใน fForm submit handler หลัง saveFaq() สำเร็จ, และใน fTableBody
// delete handler ผ่าน deleteWithUndo({ onCommitted: reloadAll }))
// รอบที่ 113: เพิ่ม js/admin-blog-form.js เข้ารายชื่อที่อนุญาต (import reloadAll จาก
// admin-page.js ตรงๆ แบบเดียวกัน — เรียกใน bForm submit handler หลัง saveBlog() สำเร็จ)
// รอบที่ 114: เพิ่ม js/admin-blog.js เข้ารายชื่อที่อนุญาต (import reloadAll จาก admin-page.js
// ตรงๆ แบบเดียวกัน — เรียกใน bGrid delete handler ผ่าน deleteWithUndo({ onCommitted: reloadAll })
// และในปุ่ม bulk apply-status/bulk delete หลัง saveBlog()/deleteBlog() สำเร็จทั้งชุด)
// รอบที่ 115: เพิ่ม js/admin-portfolio.js เข้ารายชื่อที่อนุญาต (import reloadAll จาก
// admin-page.js ตรงๆ แบบเดียวกัน — เรียกใน pfGrid delete handler ผ่าน
// deleteWithUndo({ onCommitted: reloadAll }), ในปุ่ม bulk delete, และใน movePinnedItem()
// หลัง savePortfolio() สำเร็จทั้งคู่ — คนละตัวกับ "portfolio-form" ที่มีอยู่แล้วตั้งแต่รอบ 106)
//
// รอบที่ 121: เพิ่ม js/admin-products-csv.js เข้ารายชื่อที่อนุญาต (import reloadAll จาก
// admin-page.js ตรงๆ แบบเดียวกัน — เรียกท้าย listener ของปุ่ม "ยืนยันนำเข้า" หลังนำเข้า CSV
// สำเร็จทั้งชุด) — ไฟล์นี้ยังมี import พันกันอีกจุด (ovFormatBaht จาก admin-overview-dashboard.js
// ที่ลากทั้งแอปตามมาด้วย circular import กลับเข้า admin-page.js เอง) ต้องใช้คู่กับ
// admin-overview-dashboard-stub-loader.mjs ใหม่ (ดูไฟล์นั้น) ไม่ใช่ stub นี้อย่างเดียว
//
// รอบที่ 122: เพิ่ม js/admin-sidebar.js เข้ารายชื่อที่อนุญาต — ไฟล์นี้ import { switchTab }
// (ไม่ใช่ reloadAll เหมือนไฟล์กลุ่มก่อนหน้า) จาก admin-page.js ตรงๆ ที่ระดับบนสุด (circular
// import ที่ตั้งใจ — ดูคอมเมนต์หัวไฟล์ admin-sidebar.js) จึงต้องเพิ่ม export switchTab ปลอมเข้าไป
// ในโมดูลสตับด้วย ควบคุมผ่าน globalThis.__AD_PAGE_STUB_SWITCH_TAB__ (แพทเทิร์นเดียวกับ
// __AD_PAGE_STUB_RELOAD_ALL__ เดิม — ไม่ตั้งไว้ = no-op เฉยๆ ไม่ throw)
//
// รอบที่ 129: เพิ่ม js/admin-overview-detail-cards.js เข้ารายชื่อที่อนุญาต — ไฟล์นี้ import
// { switchTab } จาก admin-page.js ตรงๆ ที่ระดับบนสุดเช่นเดียวกับ admin-sidebar.js (เรียกใน
// renderSlaWarning() ตอนคลิกแถวเตือน/ปุ่ม "ดูทั้งหมด") — ใช้สตับ switchTab ปลอมตัวเดียวกันได้เลย
// ไม่ต้องเพิ่มอะไรใหม่

const STUB_URL = "admin-page-stub:reload-all";
const ALLOWED_PARENT_RE = /\/js\/admin-(portfolio-form|portfolio|products-form|products-csv|products|groups|categories|faq|blog-form|blog|sidebar|global-search-jump|global-search|overview-detail-cards|overview-dashboard)\.js(\?.*)?$/;

export async function resolve(specifier, context, nextResolve) {
  if (
    specifier === "./admin-page.js" &&
    context.parentURL &&
    ALLOWED_PARENT_RE.test(context.parentURL)
  ) {
    return { url: STUB_URL, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url === STUB_URL) {
    const source = `
export async function reloadAll() {
  const impl = globalThis.__AD_PAGE_STUB_RELOAD_ALL__;
  if (typeof impl === "function") return impl();
}
export function switchTab(tab, opts) {
  const impl = globalThis.__AD_PAGE_STUB_SWITCH_TAB__;
  if (typeof impl === "function") return impl(tab, opts);
}
`;
    return { format: "module", source, shortCircuit: true };
  }
  return nextLoad(url, context);
}
