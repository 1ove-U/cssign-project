/**
 * CS.SIGN — leads.js
 * บันทึก Contact Form + Quotation Form ลง Firebase Firestore
 * ใช้ร่วมกับ db.js (firebaseConfig เดิม)
 *
 * หมายเหตุ: ใช้ Firestore instance เดียวกับ db.js (import { db })
 * แทนการเรียก getFirestore(app) เอง — เพราะ db.js เรียก
 * initializeFirestore() พร้อม persistent cache ไว้แล้ว และ
 * Firestore อนุญาตให้ initialize ได้แค่ครั้งเดียวต่อ app instance
 * ถ้าไฟล์นี้เรียก getFirestore(app) ซ้ำ (ไม่ว่าก่อนหรือหลัง db.js
 * บนหน้าไหนก็ตาม) จะขึ้น error "Firestore has already been started"
 * หรือ cache settings ไม่ตรงกันได้
 *
 * Turnstile server-side verification:
 * js/turnstile.js ฝั่ง client เช็คแค่ "มี token หรือยัง" ก่อน submit ซึ่งกันได้แค่
 * บอทที่ไม่รัน JS/ไม่ผ่าน widget เลย แต่กันไม่ได้ถ้ามีคนปลอม token เอง ก่อนบันทึก
 * lead ทุกครั้ง saveLead() จะเรียก endpoint ยืนยัน token กับ Cloudflare จริงๆ ฝั่ง server ก่อน
 *
 * Endpoint นี้รันบน Cloudflare Worker ตัวเดียวกับที่ลบรูป Cloudinary (cssign-cloudinary-delete
 * ดู cloudflare-worker/src/index.js เส้น /verify-turnstile) แทนที่จะเป็น Firebase Cloud
 * Function — เพื่อให้กันบอทฝั่ง server ทำงานได้โดยไม่ต้องอัพเกรด Firebase เป็น Blaze plan เลย
 * และไม่ต้องเปิด Worker ใหม่แยกต่างหาก (ใช้ service เดิมที่ deploy อยู่แล้ว)
 * วิธี deploy/ตั้งค่า secret: ดู cloudflare-worker/README.md หัวข้อ "Turnstile verify"
 */

import { collection, addDoc, serverTimestamp,
         query, where, orderBy, onSnapshot }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { db, auth } from "./db.js";

/* ต้องตรงกับ CLOUDINARY_DELETE_WORKER_URL ใน js/db-media.js (Worker เดียวกัน คนละ path)
   ถ้าย้าย Worker ไปโดเมน/subdomain อื่นในอนาคต ต้องแก้ทั้ง 2 ที่ให้ตรงกัน */
const VERIFY_TURNSTILE_URL = 'https://cssign-cloudinary-delete.zillergotspw.workers.dev/verify-turnstile';

/**
 * ยืนยัน Turnstile token กับ Worker endpoint /verify-turnstile
 * fail-open โดยตั้งใจ: ถ้าเรียก endpoint ไม่ได้เลย (ยังไม่ deploy worker/
 * ยังไม่ได้แก้ URL ด้านบน/เน็ตหลุดชั่วคราว) จะไม่บล็อกลูกค้าจริงทั้งหมด
 * แต่ถ้า Cloudflare ตอบกลับมาตรงๆ ว่า token ไม่ผ่าน จะ block ทันที
 */
async function verifyTurnstileToken(token) {
  if (!token) return false; // ไม่มี token เลย = ไม่ผ่านชัวร์ (ไม่ต้องเรียก endpoint)
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
    return true; // fail-open: ไม่ให้ปัญหา infra ชั่วคราวบล็อกลูกค้าจริง
  }
}

/**
 * บันทึก lead ลง Firestore collection "leads"
 * @param {Object} data  — ข้อมูลจากฟอร์ม
 * @param {string} source — ชื่อฟอร์ม เช่น "inline_contact", "quotation_modal", "contact_page"
 * @param {string} [turnstileToken] — token จาก getTurnstileToken(tsEl) ของฟอร์มนั้น
 *
 * P2.9-D1: ถ้าผู้ส่งฟอร์ม login ด้วย LINE อยู่แล้ว (auth.currentUser.uid ขึ้นต้นด้วย "line_" —
 * pattern เดียวกับ hasExistingLineSession() ใน js/my-account-page.js) แนบ lineUserId เข้า
 * payload ด้วย เพื่อให้ listenMyLeads() ด้านล่างดึงประวัติของลูกค้าคนนี้กลับมาแสดงได้ —
 * ไม่บังคับ login ก่อนขอใบเสนอราคา guest ที่ไม่ได้ login ยังส่งฟอร์มได้ปกติทุกจุด (แค่ไม่มี
 * field นี้แนบไปเฉยๆ) ตรงกับ field เดิม uid ที่ Cloudflare Worker เซ็นให้ตอน /line-login
 * (ดู loginWithLine() ใน js/db-orders.js — uid = `line_${lineUserId}`) จึงตัด prefix
 * "line_" ออกก่อนเก็บ ให้ค่า lineUserId ในฟอร์มนี้ตรงรูปแบบเดียวกับที่ listenMyOrders() ใช้
 */
export async function saveLead(data, source = "unknown", turnstileToken = "") {
  const verified = await verifyTurnstileToken(turnstileToken);
  if (!verified) {
    throw new Error('Turnstile verification failed');
  }

  const payload = {
    ...data,
    source,
    status: "new",           /* new | read | replied */
    createdAt: serverTimestamp(),
    pageUrl: window.location.href,
    referrer: document.referrer || ""
  };

  const currentUid = auth.currentUser && auth.currentUser.uid;
  if (currentUid && currentUid.startsWith("line_")) {
    payload.lineUserId = currentUid.slice("line_".length);
  }

  const ref = await addDoc(collection(db, "leads"), payload);
  return ref.id;
}

/**
 * มุมมองลูกค้า — realtime listener กรองคำขอใบเสนอราคาที่ตัวเองเคยส่ง (ตอน login ด้วย LINE
 * อยู่) ด้วย lineUserId ตรงๆ ผ่าน Firestore query — pattern เดียวกับ listenMyOrders() ใน
 * js/db-orders.js เป๊ะ (ต้องมี composite index lineUserId ASC + createdAt DESC สำหรับ
 * collection "leads" ตาม firestore.indexes.json ที่เพิ่มไว้คู่กันในรอบนี้ — ยังไม่ deploy)
 * — ไม่ตรวจ auth.currentUser เองในฟังก์ชันนี้ ปล่อยให้ firestore.rules เป็นคนบังคับสิทธิ์อ่าน
 * เหมือนจุดอื่นๆ ในระบบนี้ (ดู match /leads/{leadId} ใน firestore.rules)
 *
 * @param {string} lineUserId — ค่าที่ loginWithLine() คืนมา (verify แล้วจาก Worker เท่านั้น —
 *   ห้ามรับค่าที่พิมพ์เองจากที่อื่น เพราะจะเปิดช่องให้ดูใบเสนอราคาของคนอื่นได้ถ้า rules มีช่องโหว่)
 * @returns {function} unsubscribe — เรียกตอนปิดหน้า/component unmount เหมือน listenMyOrders()
 */
export function listenMyLeads(lineUserId, callback, onError) {
  if (!lineUserId) {
    const err = new Error("listenMyLeads: missing lineUserId");
    if (onError) onError(err); else console.error("listenMyLeads error:", err);
    return () => {};
  }
  const q = query(
    collection(db, "leads"),
    where("lineUserId", "==", lineUserId),
    orderBy("createdAt", "desc")
  );
  return onSnapshot(
    q,
    snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    err => { if (onError) onError(err); else console.error("listenMyLeads error:", err); }
  );
}
