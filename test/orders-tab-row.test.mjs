// test/orders-tab-row.test.mjs
//
// Unit test สำหรับ renderOrderRow() ที่ js/orders-tab-row.js — แยกออกมาจาก js/orders-tab.js
// ตั้งแต่รอบที่ 35 (ดูคอมเมนต์หัวไฟล์ทั้งสอง) เป็น pure function ล้วนๆ (คืน HTML string จาก
// order object + Set ของแถวที่เลือกไว้ ไม่แตะ DOM/Firestore เลย) จึงทดสอบด้วย node --test
// ตรงๆ ได้เลยโดยไม่ต้องพึ่ง jsdom เหมือน test/orders-tab-filters.test.mjs
//
// รันด้วย: npm test (รวมอยู่ใน test/**/*.test.mjs ตาม package.json อยู่แล้ว)
//
// หมายเหตุ: js/orders-tab-row.js import escapeHtml/avatarHtml จาก js/admin-utils.js ซึ่งไฟล์
// นั้น import js/ui-helpers.js ต่อ (สำหรับ showUndoToast) และ ui-helpers.js มี
// `document.addEventListener(...)` ระดับบนสุดของไฟล์ (event delegation ของปุ่ม "ลองใหม่") —
// ต้องตั้ง globalThis.document (ผ่าน jsdom) ไว้ก่อน import renderOrderRow ไม่งั้นจะ throw
// ReferenceError: document is not defined ตอน import แม้ renderOrderRow เองจะเป็น pure
// function ที่ไม่แตะ DOM เลยก็ตาม (เป็นผลข้างเคียงจาก import chain ไม่ใช่จาก renderOrderRow เอง)

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>");
globalThis.window = dom.window;
globalThis.document = dom.window.document;

const { renderOrderRow } = await import("../js/orders-tab-row.js");

// helper: วันที่ในรูปแบบ "YYYY-MM-DD" ห่างจากวันนี้ N วัน (ใช้ทดสอบสถานะความเร่งด่วน)
function dateOffset(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

describe("renderOrderRow", () => {
  test("เรนเดอร์แถวพื้นฐาน มี id/code/customer/phone/status ครบ", () => {
    const order = { id: "o1", code: "CS-001", customer: "สมชาย ใจดี", phone: "0812345678", status: "production" };
    const html = renderOrderRow(order, new Set());
    assert.match(html, /data-id="o1"/);
    assert.match(html, /CS-001/);
    assert.match(html, /สมชาย ใจดี/);
    assert.match(html, /0812345678/);
    assert.match(html, /data-status="production"/);
    assert.match(html, /กำลังผลิต/); // ORDER_STATUS.production.label
  });

  test("ช่องที่ไม่มีข้อมูล (code/customer/phone) แสดง em dash (—) แทน", () => {
    const order = { id: "o2", status: "received" };
    const html = renderOrderRow(order, new Set());
    assert.match(html, />—</); // อย่างน้อยหนึ่งช่องต้องเป็น —
  });

  test("checkbox ถูก check เมื่อ id อยู่ใน selectedOrderIds เท่านั้น", () => {
    const order = { id: "o3", status: "received" };
    const htmlSelected = renderOrderRow(order, new Set(["o3"]));
    const htmlUnselected = renderOrderRow(order, new Set(["other-id"]));
    assert.match(htmlSelected, /data-id="o3" checked/);
    assert.doesNotMatch(htmlUnselected, /data-id="o3" checked/);
  });

  test("assigneeName ที่มีค่า แสดง assignee chip, ไม่มีค่าไม่แสดง", () => {
    const withAssignee = { id: "o4", status: "design", assigneeName: "พนักงาน A" };
    const withoutAssignee = { id: "o5", status: "design" };
    assert.match(renderOrderRow(withAssignee, new Set()), /cp-assignee-chip/);
    assert.match(renderOrderRow(withAssignee, new Set()), /พนักงาน A/);
    assert.doesNotMatch(renderOrderRow(withoutAssignee, new Set()), /cp-assignee-chip/);
  });

  test("dueDate ที่เกินกำหนด (overdue) ใส่ class is-overdue", () => {
    const order = { id: "o6", status: "production", dueDate: dateOffset(-3) };
    const html = renderOrderRow(order, new Set());
    assert.match(html, /class="is-overdue"/);
  });

  test("dueDate ที่ใกล้ครบกำหนด (due-soon, ≤2 วัน) ใส่ class is-duesoon", () => {
    const order = { id: "o7", status: "production", dueDate: dateOffset(1) };
    const html = renderOrderRow(order, new Set());
    assert.match(html, /class="is-duesoon"/);
  });

  test("คำสั่งผลิตที่ completed ไม่ถือว่าเร่งด่วน แม้ dueDate จะผ่านมาแล้ว (ไม่มี is-overdue)", () => {
    const order = { id: "o8", status: "completed", dueDate: dateOffset(-5) };
    const html = renderOrderRow(order, new Set());
    assert.doesNotMatch(html, /is-overdue/);
    assert.doesNotMatch(html, /is-duesoon/);
  });

  test("ไม่มี dueDate เลย แสดง — แทน", () => {
    const order = { id: "o9", status: "received" };
    const html = renderOrderRow(order, new Set());
    // แถวของ due date column ต้องเป็น — เพราะไม่มี dueDate
    assert.match(html, /<td>—<\/td>/);
  });

  test("escape ค่าที่มีอักขระ HTML พิเศษ (code/customer) กัน XSS", () => {
    const order = { id: "o10", status: "received", code: '<script>alert(1)</script>', customer: "A & B \"C\"" };
    const html = renderOrderRow(order, new Set());
    assert.doesNotMatch(html, /<script>alert/);
    assert.match(html, /&lt;script&gt;/);
    assert.match(html, /A &amp; B &quot;C&quot;/);
  });

  test("status ที่ไม่รู้จักใน ORDER_STATUS ยัง render ได้ ไม่ throw (fallback เป็น status ดิบ)", () => {
    const order = { id: "o11", status: "unknown-status" };
    assert.doesNotThrow(() => renderOrderRow(order, new Set()));
    const html = renderOrderRow(order, new Set());
    assert.match(html, /unknown-status/);
  });
});
