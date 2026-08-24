// test/helpers/admin-overview-dashboard-stub-loader.mjs
//
// รอบที่ 121: js/admin-products-csv.js import { ovFormatBaht } from "./admin-overview-dashboard.js"
// ตรงๆ ที่ระดับบนสุด — ตัว admin-overview-dashboard.js เองไม่ได้ "สะอาด" อย่างที่คิดตอนแรก (ต่างจาก
// ไฟล์กลุ่ม portfolio-form/products-form/groups/... รอบก่อนๆ ที่ import แค่ reloadAll จาก
// admin-page.js เฉยๆ) — มันดึงทั้งแอปตามมาด้วย: allLeads จาก admin-leads.js, switchTab จาก
// admin-page.js, openProductModal จาก admin-products.js, 4 ฟังก์ชันจาก
// admin-overview-detail-cards.js, แล้วยัง import "./admin-overview-export.js" แบบ side-effect
// อีกที (ไฟล์นั้นก็ import allLeads จาก admin-leads.js ตรงๆ เหมือนกัน) — สุดท้ายวนกลับเข้า
// admin-page.js ที่ import "./admin-products-csv.js" แบบ side-effect ที่บรรทัดต้นๆ (circular
// import วนครบวง) แล้วลากไปถึง admin-sidebar.js ที่พึ่ง localStorage (jsdom ไม่มีให้) ทำให้ import
// ทั้งชุดพังจริง — ยืนยันด้วยการลอง import js/admin-products-csv.js ตรงๆ ในสภาพแวดล้อมเทสก่อนเขียน
// stub นี้ (เจอ "ReferenceError: localStorage is not defined" จาก admin-sidebar.js:150)
//
// admin-products-csv.js ใช้แค่ ovFormatBaht(n) ตัวเดียวจากไฟล์นี้ (ฟังก์ชัน pure ล้วนๆ ไม่มี
// dependency กับ binding อื่นในไฟล์เลย — ประกาศอยู่บรรทัดแรกสุดหลัง import block พอดี) จึง stub
// ทั้งโมดูลด้วยฟังก์ชันเดียวกันตรงๆ (ไม่ nextResolve ไปโหลดของจริง เพราะของจริงโหลดไม่ได้อยู่แล้ว
// ตามที่ยืนยันข้างบน) แทนที่จะพยายาม stub ทีละไฟล์ในเชนทั้งหมด (admin-leads.js/admin-page.js/
// admin-products.js/admin-overview-detail-cards.js/admin-overview-export.js) ซึ่งจะกลายเป็นการ
// จำลองครึ่งหนึ่งของแอปทั้งระบบโดยไม่จำเป็น — ดักเฉพาะ parentURL ที่ตรงกับไฟล์ใน
// ALLOWED_PARENT_RE ด้านล่างเท่านั้น กัน false-positive กับไฟล์อื่นที่ import
// "./admin-overview-dashboard.js" ชื่อเดียวกันแต่ต้องการฟังก์ชันอื่นด้วย (เช่น admin-page.js เองที่
// import renderOverview/renderNotifBell — ไฟล์นั้นโหลดไม่ได้ในเทสอยู่แล้วไม่เกี่ยว)
//
// **ความเสี่ยงที่ต้องระวังทุกรอบถัดไป**: ovFormatBaht() ในสตับนี้ hardcode สูตรซ้ำจากของจริง
// (js/admin-overview-dashboard.js) ตรงๆ — ถ้าของจริงถูกแก้สูตรในอนาคต ต้องแก้ที่นี่ตามด้วยเสมอ
// (เทียบกับ reloadAll ใน admin-page-stub-loader.mjs ที่ปลอดภัยกว่าเพราะเป็นแค่ no-op นับจำนวนครั้ง
// เรียก ไม่ต้อง sync สูตรจริง) — เทสไฟล์ที่ต้องพึ่งความถูกต้องของ ovFormatBaht() ควร import ตัวจริง
// จาก js/admin-overview-dashboard.js เองแยกต่างหาก (เหมือนแพทเทิร์น auditLogToCSV() ใน
// test/admin-settings-audit.test.mjs รอบ 120) ไม่ใช่พึ่งพาค่าจากสตับนี้เป็นแหล่งความจริง

// รอบที่ 123: js/admin-leads.js import { renderOverview, renderNotifBell } จาก
// "./admin-overview-dashboard.js" ตรงๆ ที่ระดับบนสุดเช่นกัน (ลอง import ตรงก่อนเขียนเทสตามที่
// ตกลงไว้ทุกรอบ — เจอ "Cannot access 'onNewLeadsArrivedCb' before initialization" จริง เพราะ
// admin-overview-dashboard.js ดึง admin-page.js ตามมา (ผ่าน switchTab) ซึ่ง import
// admin-leads-automation.js แบบ side-effect วนกลับมา import admin-leads.js เอง (circular)
// ตอนที่ admin-leads.js เอง evaluate ยังไม่เสร็จ) — ขยาย ALLOWED_PARENT_RE ให้ครอบคลุม
// admin-leads.js ด้วย และเพิ่ม export renderOverview()/renderNotifBell() แบบ no-op นับจำนวนครั้ง
// เรียก (แพทเทิร์นเดียวกับ reloadAll ใน admin-page-stub-loader.mjs — ไม่ต้อง sync สูตรจริงเหมือน
// ovFormatBaht เพราะ admin-leads.js ไม่สนใจผลลัพธ์ภายในของฟังก์ชันพวกนี้ แค่ต้องเรียกได้ไม่พัง)
// ควบคุมผ่าน globalThis.__AD_OVERVIEW_STUB_RENDER_OVERVIEW_CALLS__/
// __AD_OVERVIEW_STUB_RENDER_NOTIF_BELL_CALLS__ — ไม่กระทบ js/admin-products-csv.js เดิมเลย
// เพราะ regex เดิมยังตรงเหมือนเดิม แค่เพิ่ม branch ใหม่
const STUB_URL = "admin-overview-dashboard-stub:ov-format-baht";
const ALLOWED_PARENT_RE = /\/js\/(admin-products-csv|admin-leads|admin-overview-export)\.js(\?.*)?$/;

export async function resolve(specifier, context, nextResolve) {
  if (
    specifier === "./admin-overview-dashboard.js" &&
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
export function ovFormatBaht(n) {
  return "\u0e3f" + Math.round(n || 0).toLocaleString("th-TH");
}
export function renderOverview() {
  if (!Array.isArray(globalThis.__AD_OVERVIEW_STUB_RENDER_OVERVIEW_CALLS__)) globalThis.__AD_OVERVIEW_STUB_RENDER_OVERVIEW_CALLS__ = [];
  globalThis.__AD_OVERVIEW_STUB_RENDER_OVERVIEW_CALLS__.push(true);
}
export function renderNotifBell() {
  if (!Array.isArray(globalThis.__AD_OVERVIEW_STUB_RENDER_NOTIF_BELL_CALLS__)) globalThis.__AD_OVERVIEW_STUB_RENDER_NOTIF_BELL_CALLS__ = [];
  globalThis.__AD_OVERVIEW_STUB_RENDER_NOTIF_BELL_CALLS__.push(true);
}
`;
    return { format: "module", source, shortCircuit: true };
  }
  return nextLoad(url, context);
}
