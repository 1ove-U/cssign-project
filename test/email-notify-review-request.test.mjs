// test/email-notify-review-request.test.mjs — P2.9
//
// ทดสอบตรง sendReviewRequestEmail() (js/email-notify.js) — ฟังก์ชันใหม่ที่ขอรีวิวลูกค้า
// อัตโนมัติทางอีเมลหลังคำสั่งผลิตเสร็จสมบูรณ์ (status เปลี่ยนเข้าสู่ "completed" — เรียกจาก
// updateOrder() ใน js/db-orders.js — ดู test/db-orders-crud-flow.test.mjs describe
// "updateOrder() → sendReviewRequestEmail() wiring" สำหรับเทสฝั่งจุดเรียกใช้)
//
// **ขอบเขตที่ทดสอบได้จริงในรอบนี้**: EMAILJS_TEMPLATE_NOTIFY ในไฟล์จริงยังเป็น
// placeholder ("YOUR_NOTIFY_TEMPLATE_ID" — ธุรกิจยังไม่ได้สร้างเทมเพลตนี้ใน EmailJS
// dashboard จริง — เทมเพลตเดียวกับ sendOrderStatusEmail() ของ P0.3 โดยตั้งใจ เพื่อประหยัด
// โควตาเทมเพลตของแพ็กเกจฟรี) เหมือน P0.3 — isReviewRequestEmailConfigured() (private function ในไฟล์นั้น)
// จึงคืน false เสมอในสภาพแวดล้อมนี้ — ทำให้ "เส้นทางส่งอีเมลสำเร็จจริง" ยังทดสอบไม่ได้จนกว่าจะ
// ตั้งค่าเทมเพลตจริง — รอบนี้ทดสอบเฉพาะเงื่อนไข "ข้าม" ทั้งหมดที่ตรวจได้จริงกับโค้ดปัจจุบัน +
// ยืนยันว่าไม่ throw ไม่ว่า input จะแปลกแค่ไหน (ตามกฎกันโค้ดพัง)
//
// ใช้ globalThis.__EMAILJS_SEND_CALLS__ (เหมือน test/email-notify-order-status.test.mjs) ตรวจ
// ว่า emailjs.send() ถูกเรียกจริงหรือไม่ — ทุกเคสในไฟล์นี้คาดหวัง "ไม่ถูกเรียก" (length 0)

import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { sendReviewRequestEmail } from "../js/email-notify.js";

beforeEach(() => {
  globalThis.__EMAILJS_SEND_CALLS__ = [];
});

describe("sendReviewRequestEmail()", () => {
  test("newStatus ไม่ใช่ \"completed\" → ข้าม ไม่เรียก emailjs.send()", async () => {
    await sendReviewRequestEmail(
      { code: "PO-101", email: "a@example.com" },
      "production",
      "qc"
    );
    assert.equal(globalThis.__EMAILJS_SEND_CALLS__.length, 0);
  });

  test("previousStatus เป็น \"completed\" อยู่แล้ว (ไม่ใช่การเปลี่ยนเข้าสู่ completed ใหม่) → ข้าม", async () => {
    await sendReviewRequestEmail(
      { code: "PO-102", email: "a@example.com" },
      "completed",
      "completed"
    );
    assert.equal(globalThis.__EMAILJS_SEND_CALLS__.length, 0);
  });

  test("newStatus ว่างเปล่า/undefined → ข้าม ไม่ throw", async () => {
    await assert.doesNotReject(() =>
      sendReviewRequestEmail({ code: "PO-103", email: "a@example.com" }, "shipping", undefined)
    );
    assert.equal(globalThis.__EMAILJS_SEND_CALLS__.length, 0);
  });

  test("order.email ว่างเปล่า → ข้าม (ลูกค้าไม่ได้ให้อีเมลไว้)", async () => {
    await sendReviewRequestEmail({ code: "PO-104", email: "" }, "shipping", "completed");
    assert.equal(globalThis.__EMAILJS_SEND_CALLS__.length, 0);
  });

  test("order เป็น null → ข้าม ไม่ throw", async () => {
    await assert.doesNotReject(() => sendReviewRequestEmail(null, "shipping", "completed"));
    assert.equal(globalThis.__EMAILJS_SEND_CALLS__.length, 0);
  });

  test("order.email มีค่าจริง + เปลี่ยนเข้าสู่ completed จริง แต่ยังไม่ได้ตั้งค่า EMAILJS_TEMPLATE_NOTIFY → ข้าม (ไม่ throw, ไม่เรียก .send())", async () => {
    await assert.doesNotReject(() =>
      sendReviewRequestEmail(
        { code: "PO-105", customer: "บริษัท ทดสอบ", email: "customer@example.com" },
        "shipping",
        "completed"
      )
    );
    assert.equal(globalThis.__EMAILJS_SEND_CALLS__.length, 0);
  });

  test("previousStatus เป็น undefined (order ใหม่ที่ไม่เคยมี status เดิม) + newStatus เป็น completed → ยังไม่ throw", async () => {
    await assert.doesNotReject(() =>
      sendReviewRequestEmail({ code: "PO-106", email: "customer2@example.com" }, undefined, "completed")
    );
    assert.equal(globalThis.__EMAILJS_SEND_CALLS__.length, 0);
  });

  // P2.9a2: field กันส่งซ้ำถาวรใน Firestore (reviewRequestedAt) — คนละชั้นกับ transition-based
  // guard (previousStatus === "completed") ด้านบน ครอบคลุมเคสที่ transition guard เดิมป้องกัน
  // ไม่ได้ (สถานะออกจาก completed แล้ววนกลับเข้ามาใหม่ — previousStatus ตอนนั้นไม่ใช่ "completed"
  // แล้ว แต่ order.reviewRequestedAt ยังมีค่าค้างจากรอบก่อนอยู่)
  test("order.reviewRequestedAt มีค่าอยู่แล้ว (เคยส่งไปแล้วก่อนหน้า) → ข้าม ไม่เรียก emailjs.send() ซ้ำ", async () => {
    await sendReviewRequestEmail(
      {
        code: "PO-107",
        email: "customer3@example.com",
        reviewRequestedAt: { seconds: 1700000000, nanoseconds: 0 } // จำลอง Firestore Timestamp
      },
      "shipping",
      "completed"
    );
    assert.equal(globalThis.__EMAILJS_SEND_CALLS__.length, 0);
  });

  // ยืนยันค่า return ของฟังก์ชัน (ผู้เรียกใน js/db-orders.js ใช้ตัดสินใจว่าจะบันทึก
  // reviewRequestedAt หรือไม่ — ดู P2.9a2) — ทุก early-return ต้องคืน false อย่างชัดเจน ไม่ใช่
  // undefined เฉยๆ (แม้ falsy เหมือนกัน แต่ยืนยัน contract ให้ชัดกันงงทีหลัง)
  describe("ค่า return (ใช้ตัดสินใจบันทึก reviewRequestedAt)", () => {
    test("newStatus ไม่ใช่ completed → return false", async () => {
      const result = await sendReviewRequestEmail({ code: "PO-108", email: "a@example.com" }, "production", "qc");
      assert.equal(result, false);
    });

    test("ยังไม่ได้ตั้งค่าเทมเพลต → return false", async () => {
      const result = await sendReviewRequestEmail(
        { code: "PO-109", email: "customer@example.com" },
        "shipping",
        "completed"
      );
      assert.equal(result, false);
    });

    test("order.reviewRequestedAt มีค่าอยู่แล้ว → return false", async () => {
      const result = await sendReviewRequestEmail(
        { code: "PO-110", email: "a@example.com", reviewRequestedAt: {} },
        "shipping",
        "completed"
      );
      assert.equal(result, false);
    });

    test("order เป็น null → return false", async () => {
      const result = await sendReviewRequestEmail(null, "shipping", "completed");
      assert.equal(result, false);
    });
  });
});
