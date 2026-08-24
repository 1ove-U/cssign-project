/**
 * CS.SIGN — db-quote-requests.js
 * P3.0 Phase 2 — บันทึกคำขอใบเสนอราคาแบบใหม่ (prefill รายการจากตะกร้า js/cart-global.js)
 * ลง Firestore collection ใหม่ "quote_requests" — แยกจาก "leads" เดิมโดยตั้งใจ
 * (schema ต่างกันมาก มี items[] เป็นโครงสร้าง — ดูเหตุผลเต็มใน p3.0-quotation-cart-plan.md
 * หัวข้อ "จุดที่ยังต้องตัดสินใจเพิ่ม" ข้อ 1 — ยืนยันแล้วว่าแยกคอลเลกชันใหม่)
 *
 * ใช้ Firestore instance เดียวกับ db.js (import { db, auth }) แบบเดียวกับ js/leads.js
 * ทุกประการ — ห้ามเรียก getFirestore(app) ซ้ำ (ดูคำอธิบายเหตุผลเต็มในคอมเมนต์หัวไฟล์
 * js/leads.js)
 *
 * Turnstile server-side verification: ใช้ endpoint /verify-turnstile เดียวกับ js/leads.js
 * เป๊ะ (Worker เดิม ไม่ต้อง deploy Worker ใหม่) — คัดลอก verifyTurnstileToken() มาทั้งฟังก์ชัน
 * แทนการ import ข้ามจาก js/leads.js ตรงๆ เพราะไฟล์นั้นไม่ export ฟังก์ชันนี้ออกมา (private
 * ตั้งใจ) และการ import ฟังก์ชัน private ข้ามไฟล์จะทำให้ทั้งสองไฟล์ผูกกันแน่นเกินจำเป็น —
 * ถ้าวันหลังต้องแก้ endpoint/logic verify ต้องแก้ทั้ง 2 ไฟล์คู่กัน (เหมือนที่ CLOUDINARY_DELETE
 * ต้องตรงกัน 2 จุดใน js/db-media.js/js/leads.js อยู่แล้ว)
 */

import { collection, addDoc, serverTimestamp,
         query, where, orderBy, onSnapshot }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { db, auth } from "./db.js";

/* ต้องตรงกับ VERIFY_TURNSTILE_URL ใน js/leads.js เป๊ะ (Worker เดียวกัน endpoint เดียวกัน) —
   ถ้าย้าย Worker ไปโดเมน/subdomain อื่นในอนาคต ต้องแก้ทั้ง 2 ที่ให้ตรงกัน */
const VERIFY_TURNSTILE_URL = 'https://cssign-cloudinary-delete.zillergotspw.workers.dev/verify-turnstile';

/**
 * ยืนยัน Turnstile token กับ Worker endpoint /verify-turnstile — คัดลอกจาก js/leads.js
 * ทุกประการ (fail-open ถ้าเรียก endpoint ไม่ได้เลย ดูเหตุผลเต็มในคอมเมนต์ต้นฉบับที่นั่น)
 */
async function verifyTurnstileToken(token) {
  if (!token) return false;
  try {
    const res = await fetch(VERIFY_TURNSTILE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    });
    if (!res.ok) {
      console.warn('CS.SIGN: verifyTurnstile endpoint ตอบกลับผิดพลาด (status ' + res.status + ') — ข้ามการเช็คฝั่ง server ชั่วคราว');
      return true; // fail-open
    }
    const data = await res.json();
    return !!(data && data.success);
  } catch (err) {
    console.warn('CS.SIGN: เรียก verifyTurnstile ไม่สำเร็จ (ยังไม่ได้ deploy functions หรือเน็ตหลุด) — ข้ามการเช็คฝั่ง server ชั่วคราว', err);
    return true; // fail-open
  }
}

/**
 * ตัดฟิลด์ item ให้เหลือเฉพาะ key ที่ quote_requests รองรับ (ตาม data model ใน
 * p3.0-quotation-cart-plan.md) — กัน field แปลกปลอมจาก getCartItems() หลุดเข้าไปใน payload
 * ที่ส่งจริง (เช่น image/unitPriceHint ที่ใช้แค่แสดงผลใน modal ตะกร้า ไม่ใช่ส่วนหนึ่งของ
 * ข้อมูลที่ต้องเก็บถาวรใน quote_requests) — ค่าที่ไม่ใช่ string/number ถูกแปลงเป็นค่าว่างแทน
 * throw เพื่อไม่ให้ item เดียวที่ผิดรูปทำให้ทั้งคำขอส่งไม่ได้
 */
function sanitizeItem(item) {
  if (!item || typeof item !== "object") return null;
  return {
    productId: typeof item.productId === "string" ? item.productId : "",
    name: typeof item.name === "string" ? item.name : "",
    variantLabel: typeof item.variantLabel === "string" ? item.variantLabel : "",
    size: typeof item.size === "string" ? item.size : "",
    material: typeof item.material === "string" ? item.material : "",
    qty: typeof item.qty === "number" && item.qty > 0 ? item.qty : 1,
    unit: typeof item.unit === "string" ? item.unit : "",
    note: typeof item.note === "string" ? item.note : ""
  };
}

/**
 * บันทึกคำขอใบเสนอราคาลง Firestore collection "quote_requests"
 * @param {Object} data — ฟิลด์ตามหัวข้อ data model (billingName/taxId/billingAddress/
 *   contactPerson/phone/email/shippingAddress/wantedDate/paymentTermsRequested/notes)
 * @param {Array}  items — รายการจากตะกร้า (window.CSSignCart.getCartItems()) ต้องมีอย่างน้อย
 *   1 ชิ้นเสมอ (ยืนยันแล้ว — ฟอร์มนี้บังคับต้องมีสินค้าในตะกร้าก่อนเปิดได้ ดู
 *   p3.0-quotation-cart-plan.md "จุดที่ยังต้องตัดสินใจเพิ่ม" ข้อ 2 — ตรวจซ้ำที่นี่อีกชั้น
 *   ไม่ไว้ใจแค่ฝั่ง UI เพราะเรียกฟังก์ชันนี้ตรงๆ จาก console ก็ยังต้องกันได้)
 * @param {string} source — ชื่อฟอร์ม เช่น "quote_request_cart"
 * @param {string} [turnstileToken]
 * @returns {Promise<string>} id ของ document ที่สร้าง
 */
export async function saveQuoteRequest(data, items, source = "quote_request_cart", turnstileToken = "") {
  const verified = await verifyTurnstileToken(turnstileToken);
  if (!verified) {
    throw new Error('Turnstile verification failed');
  }

  const sanitizedItems = Array.isArray(items) ? items.map(sanitizeItem).filter(Boolean) : [];
  if (sanitizedItems.length === 0) {
    throw new Error('saveQuoteRequest: ต้องมีรายการสินค้าอย่างน้อย 1 ชิ้น');
  }

  const payload = {
    ...data,
    items: sanitizedItems,
    source,
    status: "new",           /* new | quoted | closed */
    createdAt: serverTimestamp(),
    pageUrl: window.location.href,
    referrer: document.referrer || ""
  };

  // P2.9-D1 pattern เดียวกับ js/leads.js — แนบ lineUserId ถ้า login LINE อยู่ (ไม่บังคับ)
  const currentUid = auth.currentUser && auth.currentUser.uid;
  if (currentUid && currentUid.startsWith("line_")) {
    payload.lineUserId = currentUid.slice("line_".length);
  }

  const ref = await addDoc(collection(db, "quote_requests"), payload);
  return ref.id;
}

/**
 * มุมมองลูกค้า — realtime listener กรองคำขอใบเสนอราคาที่ตัวเองเคยส่ง (ตอน login ด้วย LINE
 * อยู่) — pattern เดียวกับ listenMyLeads() ใน js/leads.js เป๊ะ (ต้องมี composite index
 * lineUserId ASC + createdAt DESC สำหรับ collection "quote_requests" ตาม
 * firestore.indexes.json ที่เพิ่มไว้คู่กันในรอบนี้ — ยังไม่ deploy)
 *
 * @param {string} lineUserId — ค่าที่ loginWithLine() คืนมา (verify แล้วจาก Worker เท่านั้น)
 * @returns {function} unsubscribe
 */
export function listenMyQuoteRequests(lineUserId, callback, onError) {
  if (!lineUserId) {
    const err = new Error("listenMyQuoteRequests: missing lineUserId");
    if (onError) onError(err); else console.error("listenMyQuoteRequests error:", err);
    return () => {};
  }
  const q = query(
    collection(db, "quote_requests"),
    where("lineUserId", "==", lineUserId),
    orderBy("createdAt", "desc")
  );
  return onSnapshot(
    q,
    snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    err => { if (onError) onError(err); else console.error("listenMyQuoteRequests error:", err); }
  );
}

/**
 * มุมมองแอดมิน — realtime listener ดึง "quote_requests" ทั้งหมด (ไม่กรอง lineUserId) เรียง
 * createdAt ล่าสุดก่อน — ใช้สำหรับปุ่ม "สร้างจากคำขอ" ในแท็บใบเสนอราคาของแอดมิน
 * (js/admin-quotations.js, P3.0 Phase 3 รอบย่อย 5) — pattern เดียวกับ listenQuotations()
 * (js/db-quotations.js)/listenLeads() (js/db-orders.js) เป๊ะ — ต่างจาก listenMyQuoteRequests()
 * ด้านบนตรงที่ไม่มี where("lineUserId", ...) เพราะแอดมินต้องเห็นคำขอของทุกคน ไม่ใช่แค่ของ
 * uid ตัวเอง
 * @returns {function} unsubscribe
 */
export function listenAllQuoteRequests(callback, onError) {
  const q = query(collection(db, "quote_requests"), orderBy("createdAt", "desc"));
  return onSnapshot(
    q,
    snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    err => { if (onError) onError(err); else console.error("listenAllQuoteRequests error:", err); }
  );
}

/**
 * validate เลขผู้เสียภาษี 13 หลัก (ฝั่ง client ฟรี — ไม่เรียก API ภายนอกใดๆ)
 * ใช้อัลกอริทึม checksum เลขผู้เสียภาษี/บัตรประชาชนไทย (mod 11 ตัวสุดท้าย) — ตัวเลข 13 หลัก
 * เท่านั้น (ตัดช่องว่าง/ขีดออกก่อนตรวจ เพื่อรองรับผู้ใช้พิมพ์แบบมีตัวคั่น เช่น "1-2345-67890-12-3")
 * optional field — ฟอร์มไม่บังคับกรอก (บุคคลธรรมดาอาจไม่มี) แต่ถ้ากรอกมาต้องผ่าน checksum นี้
 * @param {string} taxId
 * @returns {boolean} true ถ้าว่างเปล่า (ไม่บังคับ) หรือผ่าน checksum, false ถ้ากรอกมาแต่ผิดรูป
 */
export function isValidThaiTaxId(taxId) {
  if (!taxId) return true; // optional — ไม่กรอกถือว่าผ่าน
  const digits = String(taxId).replace(/[\s-]/g, "");
  if (!/^\d{13}$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += Number(digits[i]) * (13 - i);
  }
  const checkDigit = (11 - (sum % 11)) % 10;
  return checkDigit === Number(digits[12]);
}
