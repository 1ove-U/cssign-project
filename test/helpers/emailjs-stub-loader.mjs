// test/helpers/emailjs-stub-loader.mjs
//
// จุดประสงค์: js/email-notify.js import @emailjs/browser ตรงจาก CDN (cdn.jsdelivr.net) —
// Node ไม่รองรับ import URL แบบ https:// ตรงๆ (ERR_UNSUPPORTED_ESM_URL_SCHEME) ทำให้ไฟล์นี้
// (และไฟล์ที่ import ต่อ เช่น js/lead-quote-modal.js) "resolve ไม่ได้" มาตั้งแต่รอบที่ 44-51 —
// scripts/check-imports.mjs ต้อง fallback ไปพาร์ส export แบบ static regex แทน ground truth
//
// Loader นี้ดัก URL ของ @emailjs/browser โดยเฉพาะ (แพทเทิร์นเดียวกับ firebase-stub-loader.mjs
// เป๊ะ — ดักที่ตัว URL เอง ไม่ใช่ที่ว่าไฟล์ไหนเป็นคน import) แล้วสวมด้วย stub module ที่มีแค่
// default export object ที่มี 2 method ที่ js/email-notify.js เรียกใช้จริง (init/send) เป็น
// no-op ที่ไม่ throw — ไม่ได้แก้โค้ดปลายทางเลยแม้แต่บรรทัดเดียว เป็นการ mock ที่ boundary
// ภายนอกเท่านั้น (เหมือน firebase-stub-loader.mjs ทุกประการ)
//
// หมายเหตุ: js/lead-quote-modal.js (ที่ import js/email-notify.js ต่อ) ยังคง fallback อยู่ดี
// แม้จะมี stub นี้แล้ว เพราะตัวมันเองมี top-level DOM query ที่คืน null บน generic blank DOM
// (ต้องมี markup จริงของฟอร์ม quote ในหน้า index.html/products.html ฯลฯ ถึงจะไม่ throw —
// นอกขอบเขตของรอบนี้ ดู note ท้ายรอบ 52 เรื่อง admin-*.js/orders-tab-*.js ที่เจอปัญหาแบบเดียวกัน)

const STUB_PREFIX = "emailjs-stub:";
const EMAILJS_URL_RE = /^https:\/\/cdn\.jsdelivr\.net\/npm\/@emailjs\/browser@4\/\+esm$/;

// ครอบคลุมแค่ 2 method ที่ js/email-notify.js เรียกใช้จริง (emailjs.init() / emailjs.send())
//
// P0.3 (รอบที่ต่อยอด sendOrderStatusEmail()): เพิ่มการเก็บ arg ที่ .send() ถูกเรียกไว้ใน
// globalThis.__EMAILJS_SEND_CALLS__ (แพทเทิร์นเดียวกับ __ADD_DOC_CALLS__/__UPDATE_DOC_CALLS__ ใน
// firebase-stub-loader.mjs) เพื่อให้ test ตรวจ serviceId/templateId/params ที่ส่งจริงได้ — ไม่กระทบ
// test เดิมที่ไม่เคยอ่านตัวแปรนี้ (สร้าง array ใหม่ถ้ายังไม่มี ไม่ throw ถ้าไม่มีใครอ่าน) ยังคง
// resolve เสมอเหมือนเดิมทุกกรณี (ไม่ throw) — ตรวจแล้วว่า test เดิมทั้งหมด (lead-quote-modal,
// contact-inline-form) ไม่ได้อ่าน/ตั้งค่าตัวแปรนี้เลย จึงไม่ชนกัน
const STUB_SOURCE = `
const emailjs = {
  init() {},
  send(serviceId, templateId, params) {
    if (!globalThis.__EMAILJS_SEND_CALLS__) globalThis.__EMAILJS_SEND_CALLS__ = [];
    globalThis.__EMAILJS_SEND_CALLS__.push({ serviceId, templateId, params });
    return Promise.resolve({ status: 200, text: "OK (stub)" });
  },
};
export default emailjs;
`;

export async function resolve(specifier, context, nextResolve) {
  if (EMAILJS_URL_RE.test(specifier)) {
    return { url: STUB_PREFIX + encodeURIComponent(specifier), shortCircuit: true };
  }
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url.startsWith(STUB_PREFIX)) {
    return { format: "module", source: STUB_SOURCE, shortCircuit: true };
  }
  return nextLoad(url, context);
}
