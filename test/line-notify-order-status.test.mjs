// test/line-notify-order-status.test.mjs — P1.4b
//
// ทดสอบตรง sendOrderStatusLine() (js/line-notify.js) — ฟังก์ชันใหม่ที่แจ้งเตือนลูกค้าอัตโนมัติ
// ผ่าน LINE Messaging API เมื่อ status คำสั่งผลิตเปลี่ยน (เรียกจาก updateOrder() ใน
// js/db-orders.js คู่กับ sendOrderStatusEmail() — ดู
// test/db-orders-crud-flow.test.mjs describe "updateOrder() → sendOrderStatusLine() wiring"
// สำหรับเทสฝั่งจุดเรียกใช้)
//
// **ขอบเขตที่ทดสอบได้จริงในรอบนี้**: getAuth() ใน firebase-stub-loader.mjs คืน
// { currentUser: null } เสมอ (ไม่มี hook ให้ override เป็น "login อยู่" ในสภาพแวดล้อมเทสปัจจุบัน
// — ต่างจาก __GET_DOC_STUB__/__ADD_DOC_STUB__ ที่มี hook ให้) ทำให้เงื่อนไข
// "!auth.currentUser → return" ใน sendOrderStatusLine() เป็นจริงเสมอในเทสนี้ — จึงทดสอบได้แค่
// เงื่อนไข "ข้าม" ทั้งหมด (ไม่ throw ไม่ว่า input จะแปลกแค่ไหน ตามกฎกันโค้ดพัง — error ของ
// integration ใหม่ต้องไม่หลุดออกไปทำให้ flow เปลี่ยนสถานะเดิมพัง) เหมือนกับขอบเขตของ
// test/email-notify-order-status.test.mjs — "เส้นทางส่ง push message สำเร็จจริง" (body ที่
// fetch() ได้รับ) ยังทดสอบไม่ได้จนกว่าจะเพิ่ม hook จำลอง auth.currentUser ที่ login อยู่ได้จริง

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { sendOrderStatusLine } from "../js/line-notify.js";

describe("sendOrderStatusLine()", () => {
  test("previousStatus === newStatus (ไม่ได้เปลี่ยนสถานะจริง) → ข้าม ไม่ throw", async () => {
    await assert.doesNotReject(() =>
      sendOrderStatusLine({ code: "PO-001", lineUserId: "Uaaa" }, "production", "production")
    );
  });

  test("newStatus ว่างเปล่า/undefined → ข้าม ไม่ throw", async () => {
    await assert.doesNotReject(() =>
      sendOrderStatusLine({ code: "PO-002", lineUserId: "Ubbb" }, "design", undefined)
    );
  });

  test("order.lineUserId ว่างเปล่า → ข้าม (ลูกค้าไม่ได้ให้ LINE user ID ไว้ — อีเมล/pull ยังใช้ได้ปกติ)", async () => {
    await assert.doesNotReject(() =>
      sendOrderStatusLine({ code: "PO-003", lineUserId: "" }, "design", "production")
    );
  });

  test("order เป็น null → ข้าม ไม่ throw", async () => {
    await assert.doesNotReject(() => sendOrderStatusLine(null, "design", "production"));
  });

  test("order.lineUserId มีค่าจริง + status เปลี่ยนจริง แต่ไม่มี auth.currentUser (ยังไม่ login ในสภาพแวดล้อมเทส) → ข้าม ไม่ throw", async () => {
    await assert.doesNotReject(() =>
      sendOrderStatusLine(
        { code: "PO-004", customer: "บริษัท ทดสอบ", item: "ป้ายไฟ LED", lineUserId: "Uccc123" },
        "design",
        "production"
      )
    );
  });

  test("previousStatus เป็น undefined (order ใหม่ที่ไม่เคยมี status เดิม) + newStatus มีค่า → ยังไม่ throw", async () => {
    await assert.doesNotReject(() =>
      sendOrderStatusLine({ code: "PO-005", lineUserId: "Uddd456" }, undefined, "received")
    );
  });
});
