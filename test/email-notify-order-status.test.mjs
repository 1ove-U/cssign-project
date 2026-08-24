// test/email-notify-order-status.test.mjs — P0.3
//
// ทดสอบตรง sendOrderStatusEmail() (js/email-notify.js) — ฟังก์ชันใหม่ที่แจ้งเตือนลูกค้าอัตโนมัติ
// ทางอีเมลเมื่อ status คำสั่งผลิตเปลี่ยน (เรียกจาก updateOrder() ใน js/db-orders.js — ดู
// test/db-orders-crud-flow.test.mjs describe "updateOrder() → sendOrderStatusEmail() wiring"
// สำหรับเทสฝั่งจุดเรียกใช้)
//
// **ขอบเขตที่ทดสอบได้จริงในรอบนี้**: EMAILJS_TEMPLATE_NOTIFY ในไฟล์จริงยังเป็น placeholder
// ("YOUR_NOTIFY_TEMPLATE_ID" — ธุรกิจยังไม่ได้สร้างเทมเพลตนี้ใน EmailJS dashboard จริง — เทมเพลต
// นี้ใช้ร่วมกับ sendReviewRequestEmail() ด้วยโดยตั้งใจ เพื่อประหยัดโควตาเทมเพลตของแพ็กเกจฟรี)
// isOrderStatusEmailConfigured() (private function ในไฟล์นั้น) จึงคืน false เสมอในสภาพแวดล้อมนี้
// — ทำให้ "เส้นทางส่งอีเมลสำเร็จจริง" (params ที่ .send() ได้รับ) ยังทดสอบไม่ได้จนกว่าจะตั้งค่า
// เทมเพลตจริง (ดูหมายเหตุเดียวกันใน js/email-notify.js) — รอบนี้ทดสอบเฉพาะเงื่อนไข "ข้าม" ทั้งหมด
// ที่ตรวจได้จริงกับโค้ดปัจจุบัน + ยืนยันว่าไม่ throw ไม่ว่า input จะแปลกแค่ไหน (ตามกฎกันโค้ดพัง —
// error ของ integration ใหม่ต้องไม่หลุดออกไปทำให้ flow เปลี่ยนสถานะเดิมพัง)
//
// ใช้ globalThis.__EMAILJS_SEND_CALLS__ (เพิ่มใน test/helpers/emailjs-stub-loader.mjs รอบนี้)
// ตรวจว่า emailjs.send() ถูกเรียกจริงหรือไม่ — ทุกเคสในไฟล์นี้คาดหวัง "ไม่ถูกเรียก" (length 0)
// เพราะยังไม่ตั้งค่าเทมเพลต ไม่ใช่เพราะฟังก์ชัน skip ผิดเงื่อนไข — แยกยืนยันแต่ละเงื่อนไข skip
// ด้วยเทสคนละตัวเพื่อให้ชัดว่า "ข้ามเพราะอะไร" ถ้ามีคนแก้โค้ดในอนาคตแล้ว test ไหนพังจะรู้ทันทีว่า
// เงื่อนไข skip ข้อไหนเปลี่ยนพฤติกรรมไป

import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { sendOrderStatusEmail } from "../js/email-notify.js";

beforeEach(() => {
  globalThis.__EMAILJS_SEND_CALLS__ = [];
});

describe("sendOrderStatusEmail()", () => {
  test("previousStatus === newStatus (ไม่ได้เปลี่ยนสถานะจริง) → ข้าม ไม่เรียก emailjs.send()", async () => {
    await sendOrderStatusEmail(
      { code: "PO-001", email: "a@example.com" },
      "production",
      "production"
    );
    assert.equal(globalThis.__EMAILJS_SEND_CALLS__.length, 0);
  });

  test("newStatus ว่างเปล่า/undefined → ข้าม ไม่ throw", async () => {
    await assert.doesNotReject(() =>
      sendOrderStatusEmail({ code: "PO-002", email: "a@example.com" }, "design", undefined)
    );
    assert.equal(globalThis.__EMAILJS_SEND_CALLS__.length, 0);
  });

  test("order.email ว่างเปล่า → ข้าม (ลูกค้าไม่ได้ให้อีเมลไว้ — phone ยังใช้เช็คสถานะแบบ pull ได้ตามปกติ)", async () => {
    await sendOrderStatusEmail({ code: "PO-003", email: "" }, "design", "production");
    assert.equal(globalThis.__EMAILJS_SEND_CALLS__.length, 0);
  });

  test("order เป็น null → ข้าม ไม่ throw", async () => {
    await assert.doesNotReject(() => sendOrderStatusEmail(null, "design", "production"));
    assert.equal(globalThis.__EMAILJS_SEND_CALLS__.length, 0);
  });

  test("order.email มีค่าจริง + status เปลี่ยนจริง แต่ยังไม่ได้ตั้งค่า EMAILJS_TEMPLATE_NOTIFY → ข้าม (ไม่ throw, ไม่เรียก .send())", async () => {
    await assert.doesNotReject(() =>
      sendOrderStatusEmail(
        { code: "PO-004", customer: "บริษัท ทดสอบ", email: "customer@example.com" },
        "design",
        "production"
      )
    );
    assert.equal(globalThis.__EMAILJS_SEND_CALLS__.length, 0);
  });

  test("previousStatus เป็น undefined (order ใหม่ที่ไม่เคยมี status เดิม) + newStatus มีค่า → ยังไม่ throw (ผ่านเงื่อนไข previousStatus!==newStatus ปกติ ไปข้ามที่ configured check แทน)", async () => {
    await assert.doesNotReject(() =>
      sendOrderStatusEmail({ code: "PO-005", email: "customer2@example.com" }, undefined, "received")
    );
    assert.equal(globalThis.__EMAILJS_SEND_CALLS__.length, 0);
  });
});
