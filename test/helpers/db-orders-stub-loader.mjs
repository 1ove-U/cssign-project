// test/helpers/db-orders-stub-loader.mjs
//
// ใช้เฉพาะกับ test/track-modal-form-flow.test.mjs (รอบที่ 66) — จุดประสงค์: ทดสอบ flow การ
// submit ฟอร์มของ js/track-modal.js ให้ครอบคลุมทั้งเคส "พบคำสั่งผลิต" (renderResult จริง) และเคส
// error (trackOrderStatus() reject) ซึ่ง firebase-stub-loader.mjs เดิม (getDoc คืน
// `exists: () => false` เสมอ) ทำได้แค่เคส "ไม่พบ" เคสเดียว — ตามที่บันทึกไว้ใน
// REFACTOR-PROGRESS.md รอบที่ 65/66 ว่า "อาจต้องเขียน stub เพิ่มหรือ mock ที่ระดับอื่น"
//
// วิธีทำงาน: ดัก specifier "./db-orders.js" เฉพาะตอนที่ผู้เรียก (context.parentURL) คือ
// js/track-modal.js เท่านั้น (เช็คด้วย regex ท้าย path กัน false-positive กับไฟล์อื่นที่ import
// db-orders.js ชื่อเดียวกัน) — ไม่มีเงื่อนไขอื่นแล้ว (ดูหมายเหตุสำคัญด้านล่างว่าทำไม)
//
// **หมายเหตุสำคัญที่พบระหว่างเขียน (แก้จากดีไซน์แรกที่พังจริง)**: ตอนแรกตั้งใจจะ gate การดักไว้ด้วย
// globalThis flag (`__TM_STUB_TRACK_ORDER_STATUS_ACTIVE__`) ที่ test ตั้งค่าก่อน import — แต่พบว่า
// module customization hooks ที่ลงทะเบียนผ่าน `module.register()` (Node 20.6+) รันอยู่คนละ thread
// กับโค้ดหลัก (main thread ที่ test ไฟล์รันอยู่) จึง**ไม่แชร์ globalThis กัน** ทำให้เช็ค flag ใน
// resolve() ที่นี่เป็น false เสมอ (ยืนยันจริงจากการรัน — stub ไม่เคยถูกเรียกใช้เลยสักครั้งตอน gate
// ด้วย flag) จึงเปลี่ยนมาดักแบบไม่มีเงื่อนไข (unconditional) เฉพาะ specifier+parent นี้แทน — ปลอดภัย
// เพราะ re-export ORDER_STATUS/ORDER_STATUS_FLOW จากไฟล์จริงเหมือนเดิม และ trackOrderStatus() ที่
// ไม่ได้ตั้ง globalThis.__TM_STUB_TRACK_ORDER_STATUS__ ไว้ (เช่น test/track-modal-focus-trap.test.mjs
// เดิมที่ไม่เคย submit ฟอร์มเลย) จะคืนค่า null เฉยๆ เหมือนพฤติกรรม "ไม่พบ" ปกติ ไม่กระทบ test เดิม
// เพราะไม่มี test ไหนเรียก trackOrderStatus() จริงนอกจากไฟล์นี้ (ยืนยันด้วย npm test ครบทุกไฟล์)
//
// ORDER_STATUS/ORDER_STATUS_FLOW ของ stub module ยัง re-export มาจากไฟล์จริง (js/db-orders.js —
// ผ่าน firebase-stub-loader.mjs เดิมสำหรับส่วนที่พึ่ง Firebase SDK) เพื่อให้ label/ลำดับ stage ที่
// renderResult()/renderStages() ใช้จริงตรงกับของจริง 100% — stub เฉพาะฟังก์ชัน trackOrderStatus()
// เท่านั้น (จุดเดียวที่ js/track-modal.js เรียกใช้จริงในฟอร์ม submit flow) โดยอ่านค่าที่ควรคืนจาก
// globalThis.__TM_STUB_TRACK_ORDER_STATUS__ (function ที่ test ตั้งไว้ก่อน import — คืนค่า order
// object/null ตรงๆ หรือ throw/return rejected promise ก็ได้ ครอบด้วย async function ในสตับนี้ให้
// กลายเป็น rejected promise เสมอไม่ throw แบบ sync ออกไป ตรงกับพฤติกรรมจริงของ
// trackOrderStatus() ที่เป็น async function เดิม) — การอ่าน globalThis ตรงนี้ทำงานถูกต้อง (ต่างจาก
// flag ด้านบน) เพราะโค้ด source ที่ generate ในนี้ถูกโหลดไปรันจริงที่ module evaluation ใน main
// thread (ตอนถูกเรียกใช้งานจริงตอน runtime) ไม่ใช่ตอน resolve/load hook เอง
//
// P0.2 (Design Proof Approval, รอบที่ 2 ของแผน roadmap) — js/track-modal.js เพิ่ม import
// submitDesignApproval จาก ./db-orders.js ด้วย ต้อง stub เพิ่มที่นี่เช่นกัน (เหตุผลเดียวกับ
// trackOrderStatus() ด้านบนทุกประการ) อ่านค่าจาก globalThis.__TM_STUB_SUBMIT_DESIGN_APPROVAL__ —
// ต่างจาก trackOrderStatus() ตรงที่ default (ไม่ได้ตั้ง flag ไว้) คืนค่า resolved promise เฉยๆ
// (ไม่ใช่ null) เพราะ test เดิมที่ไม่เกี่ยวกับ approval เลย (เช่น focus-trap, เคส validation ต่างๆ)
// ไม่ควรพังแม้บังเอิญ trigger ปุ่มอนุมัติ (ซึ่งในทางปฏิบัติไม่เกิดขึ้น เพราะปุ่มโผล่เฉพาะตอนมี
// designFiles เท่านั้น — กันไว้เฉยๆ ให้ปลอดภัยกว่า)
//
// P1.5 (LIFF auto-link) — js/track-modal.js เพิ่ม import linkLineAccount จาก ./db-orders.js
// ด้วยเช่นกัน (เหตุผลเดียวกับสองฟังก์ชันบน — เรียก fetch() จริงไป Cloudflare Worker +
// signInWithCustomToken()/updateDoc() ของ Firebase ซึ่งไม่มีทางรันได้จริงในสภาพแวดล้อมเทส)
// อ่านค่าที่ควรคืน/throw จาก globalThis.__TM_STUB_LINK_LINE_ACCOUNT__ — ต่างจากอีกสองฟังก์ชัน
// ตรงที่ default (ไม่ได้ตั้ง flag ไว้) คือ throw (ไม่ใช่ resolve เฉยๆ) เพราะไม่มีค่า "ปกติ" ที่
// สมเหตุสมผลจะคืนถ้าไม่ได้ตั้ง stub ไว้ (ต่างจาก trackOrderStatus() ที่ null = "ไม่พบ" เป็นสถานะ
// ปกติจริงๆ ของฟังก์ชันนั้น) — ไม่กระทบ test เดิมไฟล์ไหนเลยเพราะไม่มี test ไหนกดปุ่ม
// #tm-line-link-btn มาก่อนรอบนี้

const STUB_PREFIX = "db-orders-track-stub:";
const TRACK_MODAL_PARENT_RE = /\/js\/track-modal\.js(\?.*)?$/;

export async function resolve(specifier, context, nextResolve) {
  if (
    specifier === "./db-orders.js" &&
    context.parentURL &&
    TRACK_MODAL_PARENT_RE.test(context.parentURL)
  ) {
    const real = await nextResolve(specifier, context);
    return { url: STUB_PREFIX + real.url, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url.startsWith(STUB_PREFIX)) {
    const realUrl = url.slice(STUB_PREFIX.length);
    const source = `
import { ORDER_STATUS, ORDER_STATUS_FLOW } from ${JSON.stringify(realUrl)};
export { ORDER_STATUS, ORDER_STATUS_FLOW };
export async function trackOrderStatus(code, phone) {
  const impl = globalThis.__TM_STUB_TRACK_ORDER_STATUS__;
  if (typeof impl !== "function") return null;
  return impl(code, phone);
}
export async function submitDesignApproval(trackingId, action, comment) {
  const impl = globalThis.__TM_STUB_SUBMIT_DESIGN_APPROVAL__;
  if (typeof impl !== "function") return "stub-design-approval-id";
  return impl(trackingId, action, comment);
}
export async function linkLineAccount(liffIdToken, code, phone) {
  const impl = globalThis.__TM_STUB_LINK_LINE_ACCOUNT__;
  if (typeof impl !== "function") {
    throw Object.assign(new Error("link-line not stubbed"), { code: "not_stubbed" });
  }
  return impl(liffIdToken, code, phone);
}
`;
    return { format: "module", source, shortCircuit: true };
  }
  return nextLoad(url, context);
}
