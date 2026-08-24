/**
 * CS.SIGN — line-notify.js (P1.4b)
 * ──────────────────────────────────────────────────────────────
 * แจ้งเตือนลูกค้าอัตโนมัติผ่าน LINE Messaging API เมื่อสถานะคำสั่งผลิตเปลี่ยน
 * (ควบคู่กับอีเมลใน js/email-notify.js — คนละช่องทาง แต่จุดเรียกใช้เดียวกันคือ
 * updateOrder() ใน js/db-orders.js)
 *
 * ต่างจาก EmailJS (ยิงตรงจาก browser ได้เพราะใช้ public key) — LINE Messaging API
 * ต้องใช้ Channel Access Token ซึ่งเป็นความลับ ห้ามฝังฝั่ง client จึงต้องยิงผ่าน
 * Cloudflare Worker เดียวกับที่ใช้ลบรูป Cloudinary/verify Turnstile อยู่แล้ว
 * (ดู cloudflare-worker/src/index.js เส้น /notify-line, README หัวข้อ
 * "ตั้งค่า LINE Messaging API จริง")
 *
 * รูปแบบ auth เหมือน deleteImage() ใน js/db-media.js: ต้อง login อยู่ (มี
 * auth.currentUser) แล้วแนบ Firebase ID token ไปกับ request ให้ Worker ตรวจ
 */

import { auth } from "./db.js";
import { ORDER_STATUS_LABEL } from "./email-notify.js";

/* ต้องตรงกับ CLOUDINARY_DELETE_WORKER_URL ใน js/db-media.js / VERIFY_TURNSTILE_URL ใน
   js/leads.js (Worker เดียวกัน คนละ path) ถ้าย้าย Worker ไปโดเมน/subdomain อื่นในอนาคต
   ต้องแก้ทั้ง 3 ที่ให้ตรงกัน */
const NOTIFY_LINE_URL = "https://cssign-cloudinary-delete.zillergotspw.workers.dev/notify-line";

function buildStatusMessage(order, previousStatus, newStatus) {
  const label = ORDER_STATUS_LABEL[newStatus] || newStatus;
  const labelOld = ORDER_STATUS_LABEL[previousStatus] || previousStatus || "-";
  return (
    `CS.SIGN แจ้งอัปเดตสถานะคำสั่งผลิต\n` +
    `เลขที่: ${order.code || "-"}\n` +
    `รายการ: ${order.item || "-"}\n` +
    `สถานะ: ${labelOld} → ${label}`
  );
}

/**
 * ส่ง LINE push message แจ้งลูกค้าอัตโนมัติเมื่อสถานะคำสั่งผลิตเปลี่ยน (P1.4)
 * ออกแบบให้เรียกจากจุดเปลี่ยนสถานะจริง (updateOrder() ใน js/db-orders.js) คู่กับ
 * sendOrderStatusEmail() — **ฟังก์ชันนี้เองไม่ throw ออกไปเลยไม่ว่ากรณีใด** (กฎกันโค้ดพัง
 * ของโปรเจกต์: error ของ integration ใหม่ต้องไม่ทำให้ flow เปลี่ยนสถานะเดิมล้มเหลวตามไปด้วย)
 * — catch ทุกอย่างแล้ว console.error ไว้แทน
 *
 * เงื่อนไขที่ "ข้าม" (ไม่ throw, ไม่ log เป็น error เพราะเป็นสถานการณ์ปกติ):
 * - previousStatus === newStatus (ไม่ได้เปลี่ยนสถานะจริง)
 * - order.lineUserId ว่างเปล่า (ลูกค้าไม่ได้ให้ LINE user ID ไว้ — อีเมล/pull ยังใช้ได้ปกติ)
 * - ไม่มี auth.currentUser (ไม่ได้ login อยู่ — ไม่ควรเกิดขึ้นจริงเพราะฟังก์ชันนี้ถูกเรียกจาก
 *   updateOrder() ซึ่งต้อง login อยู่แล้วถึงจะแก้ order ได้ แต่กันไว้เผื่อ token หมดอายุพอดี)
 *
 * @param {Object} order          — order object เต็ม (ต้องมี code/item/lineUserId อย่างน้อย)
 * @param {string} previousStatus — สถานะเดิมก่อนแก้ (มาจาก existing doc ก่อน merge)
 * @param {string} newStatus      — สถานะใหม่หลังแก้
 */
export async function sendOrderStatusLine(order, previousStatus, newStatus) {
  try {
    if (!newStatus || previousStatus === newStatus) return;
    if (!order || !order.lineUserId) return;
    if (!auth.currentUser) return;

    const idToken = await auth.currentUser.getIdToken();
    const message = buildStatusMessage(order, previousStatus, newStatus);
    const res = await fetch(NOTIFY_LINE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ to: order.lineUserId, message }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      console.error("[line-notify] order status push error:", data.error || res.status);
    }
  } catch (err) {
    console.error("[line-notify] order status push error:", err);
  }
}
