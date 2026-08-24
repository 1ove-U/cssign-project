// test/reorder-helper.test.mjs
//
// เทส pure function ล้วนๆ ใน js/reorder-helper.js (P2.8a — ซับข้อแรกของ Portal ลูกค้าประจำ)
// ไม่ต้องพึ่ง jsdom เลย เพราะไฟล์นี้ไม่มีการเรียก DOM/Firestore ใดๆ

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { buildReorderMessage, shouldOfferReorder } from "../js/reorder-helper.js";

describe("js/reorder-helper.js — buildReorderMessage()", () => {
  test("order ปกติ มี item+qty+code → ข้อความครบทุกส่วน", () => {
    const msg = buildReorderMessage({ item: "ป้ายไฟ LED หน้าร้าน", qty: 2, code: "PO-2026-0120", status: "completed" });
    assert.equal(msg, "ต้องการสั่งซ้ำ: ป้ายไฟ LED หน้าร้าน จำนวน 2 (อ้างอิงคำสั่งผลิตเดิม PO-2026-0120)");
  });

  test("ไม่มี qty (0/NaN/undefined) → ข้ามส่วน 'จำนวน' แต่ยังมี item + code", () => {
    const msg = buildReorderMessage({ item: "สติกเกอร์ไดคัท", qty: 0, code: "PO-2026-0099" });
    assert.equal(msg, "ต้องการสั่งซ้ำ: สติกเกอร์ไดคัท (อ้างอิงคำสั่งผลิตเดิม PO-2026-0099)");
  });

  test("ไม่มี code → ข้ามส่วนอ้างอิง แต่ยังมี item + qty", () => {
    const msg = buildReorderMessage({ item: "ป้ายอะคริลิค", qty: 5 });
    assert.equal(msg, "ต้องการสั่งซ้ำ: ป้ายอะคริลิค จำนวน 5");
  });

  test("มีแค่ item อย่างเดียว → ข้อความสั้นสุด", () => {
    const msg = buildReorderMessage({ item: "แบนเนอร์ไวนิล" });
    assert.equal(msg, "ต้องการสั่งซ้ำ: แบนเนอร์ไวนิล");
  });

  test("item เป็นช่องว่างล้วนๆ (trim แล้วว่าง) → คืน \"\"", () => {
    assert.equal(buildReorderMessage({ item: "   " }), "");
  });

  test("ไม่มี item เลย → คืน \"\"", () => {
    assert.equal(buildReorderMessage({ qty: 3, code: "PO-1" }), "");
  });

  test("qty เป็นค่าติดลบ → ถือว่าไม่มี qty (ข้ามส่วนจำนวน)", () => {
    const msg = buildReorderMessage({ item: "ป้ายไฟ", qty: -5 });
    assert.equal(msg, "ต้องการสั่งซ้ำ: ป้ายไฟ");
  });

  test("order เป็น null/undefined/ไม่ใช่ object → คืน \"\" เสมอ ไม่ throw", () => {
    assert.equal(buildReorderMessage(null), "");
    assert.equal(buildReorderMessage(undefined), "");
    assert.equal(buildReorderMessage("string"), "");
    assert.equal(buildReorderMessage(42), "");
  });
});

describe("js/reorder-helper.js — shouldOfferReorder()", () => {
  test("status เป็น completed + มี item → true", () => {
    assert.equal(shouldOfferReorder({ item: "ป้ายไฟ LED", status: "completed" }), true);
  });

  test("status เป็น production (ยังไม่เสร็จ) → false แม้มี item ครบ", () => {
    assert.equal(shouldOfferReorder({ item: "ป้ายไฟ LED", status: "production" }), false);
  });

  test("status เป็น cancelled → false", () => {
    assert.equal(shouldOfferReorder({ item: "ป้ายไฟ LED", status: "cancelled" }), false);
  });

  test("status เป็น completed แต่ไม่มี item เลย → false (ข้อความจะว่างเปล่า)", () => {
    assert.equal(shouldOfferReorder({ status: "completed" }), false);
  });

  test("order เป็น null/undefined → false ไม่ throw", () => {
    assert.equal(shouldOfferReorder(null), false);
    assert.equal(shouldOfferReorder(undefined), false);
  });
});
