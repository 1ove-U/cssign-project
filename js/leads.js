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
 * Endpoint นี้รันบน Cloudflare Worker ตัวเดียวกับ chat proxy (เส้น /verify-turnstile)
 * แทนที่จะเป็น Firebase Cloud Function — เพื่อให้กันบอทฝั่ง server ทำงานได้โดยไม่ต้อง
 * อัพเกรด Firebase เป็น Blaze plan เลย (ดู cloudflare-worker/worker.js และ
 * cloudflare-worker/README.md หัวข้อ "ขั้นที่ 5 — Turnstile verify")
 */

import { collection, addDoc, serverTimestamp }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { db } from './db.js';

/* Worker ตัวเดียวกับ CHAT_PROXY_URL ใน js/chat-widget.js ต่อท้ายด้วย /verify-turnstile
   ถ้าย้าย Worker ไปโดเมน/subdomain อื่นในอนาคต ต้องแก้ทั้ง 2 ที่ให้ตรงกัน */
const VERIFY_TURNSTILE_URL = 'https://red-sun-9f54.zillergotspw.workers.dev/verify-turnstile';

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
  const ref = await addDoc(collection(db, "leads"), payload);
  return ref.id;
}
