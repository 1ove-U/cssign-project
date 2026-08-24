// test/orders-tab-kanban.test.mjs — รอบที่ 96 (Phase 4/6: kanban drag-drop, js/orders-tab-kanban.js)
//
// ขอบเขตของไฟล์นี้ จาก js/orders-tab-kanban.js (99 บรรทัด — ยังไม่เคยมีเทสไฟล์ไหนครอบคลุมเลยทั้งไฟล์
// ก่อนรอบนี้ — ยืนยันด้วย grep ทั้งโปรเจกต์แล้วว่ามีแค่ 3 ไฟล์ที่กล่าวถึงชื่อไฟล์นี้ในคอมเมนต์เฉยๆ
// ไม่ได้เทสจริง):
//   - renderKanban(rows): สร้างคอลัมน์ตาม KANBAN_COLUMNS (= ORDER_STATUS_FLOW 8 สถานะ + "cancelled")
//     พร้อมหัวคอลัมน์ (label + count) และการ์ดต่อรายการ (kanbanCardHtml — escapeHtml ทุก field +
//     urgency class ตาม orderUrgency())
//   - dragstart/dragend บนการ์ด: ตั้ง/ล้าง module-private dragOrderId + class "dragging"
//   - dragover/dragleave บนคอลัมน์: class "drag-over" (ใส่ที่ .cp-kanban-col ไม่ใช่ .cp-kanban-col-body)
//   - drop บนคอลัมน์ (async): เรียก updateOrder(order.id, {status: newStatus}) จริงถ้า order ที่ลาก
//     มีอยู่จริงและ status ใหม่ต่างจากเดิม — สำเร็จ → showToast success, ล้มเหลว (updateOrder()
//     reject) → catch → showToast error พร้อม err.message — ไม่มี order ที่ลาก (dragOrderId null)
//     หรือ order หาไม่เจอแล้ว (ถูกลบไปก่อน) หรือ status เดิม = ใหม่ → early return เงียบๆ ไม่เรียก
//     updateOrder() เลย
//   - ปุ่มบนการ์ด (data-action="edit"/"clone"/"delete"): หา order จาก getAllOrders() ด้วย
//     card.dataset.id แล้วเรียก openOrderModal()/openOrderModalClone()/confirmDeleteOrder() ตามลำดับ
//     — ถ้าหา order ไม่เจอ (!order) → early return ไม่เรียกอะไรเลย
//
// สถาปัตยกรรมเทส: เหมือน test/orders-tab-render-delete.test.mjs (รอบ 95) ทุกประการ — jsdom + import
// js/orders-tab.js ครั้งเดียวต่อไฟล์ใน before() (import ไฟล์นี้แทนที่จะ import
// js/orders-tab-kanban.js ตรงๆ เพราะ renderKanban() ถูกเรียกผ่าน render()/activeView==="kanban" ของ
// orders-tab.js เท่านั้น ไม่มีจุดเรียกอื่น — ทั้งสองไฟล์เป็น ES module ตัวเดียวกันใน module cache อยู่
// แล้วไม่ว่าจะ import จากไฟล์ไหนก็ตาม) — triggerOrdersSnapshot()/dateOffset() คัดลอกจาก
// test/orders-tab-lifecycle-reminders.test.mjs (รอบ 92)
//
// วิธีจำลอง drag-and-drop ใน jsdom (ตรวจโค้ดจริงก่อนแล้วพบว่า): listener ทั้งหมดในไฟล์นี้ไม่ได้อ่าน
// e.dataTransfer เลยสักจุดเดียว (ต่างจาก HTML5 drag-drop API มาตรฐานทั่วไปที่มักอ่าน
// e.dataTransfer.getData()) — ใช้แค่ e.preventDefault() (มีใน Event ธรรมดา) + module-private
// dragOrderId ที่ตั้งไว้ตอน dragstart แทนการส่งผ่าน dataTransfer จึงจำลองด้วย
// `new Event("dragstart"/"dragend"/"dragover"/"dragleave"/"drop", {bubbles:true, cancelable:true})`
// ธรรมดาได้เลย ไม่ต้องพึ่ง jsdom DragEvent/dataTransfer ที่ไม่สมบูรณ์ตามที่กังวลไว้ใน
// NEXT-ROUND-PROMPT.txt ท้ายรอบ 95
//
// วิธีจำลอง updateOrder() reject โดยไม่แก้ shared stub: updateOrder() (js/db-orders.js) เรียก
// `await getDoc(ref)` เป็นบรรทัดแรก — ตั้ง globalThis.__GET_DOC_STUB__ ให้ throw ตรงๆ (ไม่ return
// object ปกติ) จะทำให้ getDoc() throw synchronous ตอนเรียก stub(ref) ภายในฟังก์ชัน getDoc() ของ
// firebase-stub-loader.mjs (ก่อนถึง .then() ด้วยซ้ำ) — เพราะ updateOrder() เป็น async function การ
// throw synchronous ภายในจะถูกแปลงเป็น rejected promise โดยอัตโนมัติตาม spec ของ async function —
// วิธีนี้ใช้ hook ที่มีอยู่แล้วตรงๆ ไม่ต้องแก้ stub loader เพิ่มเลย (ยืนยันด้วยการอ่านโค้ดจริงทั้งสอง
// ไฟล์ก่อนใช้ pattern นี้)
//
// ตรวจโค้ดจริงทั้งไฟล์ js/orders-tab-kanban.js + ส่วนที่เกี่ยวข้องของ js/orders-tab.js (render()
// dispatch, view-toggle button, getAllOrders()) + js/db-orders.js (updateOrder()) + js/db-orders-stats.js
// (orderUrgency()/daysUntilDue()) + ส่วนต้นของ js/orders-tab-modal.js (openOrderModal()/
// openOrderModalClone() — ตรวจ DOM side-effect ที่สังเกตได้: cp-order-modal-title/cp-o-head-code)
// ละเอียดก่อนเขียนไฟล์นี้ทั้งหมดตามที่สั่งไว้ท้ายรอบ 95 — ไม่พบบั๊ก จึงเป็นไฟล์เทสล้วนๆ ไม่มีการแก้
// โค้ดผลิตภัณฑ์เลยแม้แต่บรรทัดเดียว

import { test, describe, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const ADMIN_HTML = readFileSync(new URL("../admin.html", import.meta.url), "utf-8");
const BODY_START = ADMIN_HTML.indexOf(">", ADMIN_HTML.indexOf("<body")) + 1;
const BODY_END = ADMIN_HTML.indexOf("</body>");
const ADMIN_BODY_NO_SCRIPTS = ADMIN_HTML
  .slice(BODY_START, BODY_END)
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, "");

let document;
let mod; // orders-tab.js exports ทั้งหมด (renderKanban() ถูกเรียกผ่าน render() เมื่อ activeView==="kanban")

function resetFirebaseCalls() {
  globalThis.__ADD_DOC_CALLS__ = [];
  globalThis.__UPDATE_DOC_CALLS__ = [];
  globalThis.__DELETE_DOC_CALLS__ = [];
  globalThis.__SET_DOC_CALLS__ = [];
  globalThis.__GET_DOC_STUB__ = undefined;
  globalThis.__GET_DOCS_STUB__ = undefined;
  globalThis.__SNAPSHOT_LISTENERS__ = {};
}

function triggerOrdersSnapshot(orders) {
  const cb = globalThis.__SNAPSHOT_LISTENERS__ && globalThis.__SNAPSHOT_LISTENERS__["orders"];
  if (typeof cb !== "function") throw new Error("orders snapshot listener ยังไม่ได้ลงทะเบียน (เรียก initOrdersTab() ก่อนหรือยัง?)");
  cb({ docs: orders.map(o => ({ id: o.id, data: () => { const { id, ...rest } = o; return rest; } })) });
}

// dueDate สัมพัทธ์กับ "วันนี้" ตอนรันเทส (orderUrgency() คำนวณจากเวลาปัจจุบันจริง ไม่ใช่ mock)
function dateOffset(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function switchToKanban() {
  document.querySelector('.cp-view-btn[data-view="kanban"]').click();
}

function kanbanCard(id) {
  return document.querySelector(`#cp-kanban-view .cp-kanban-card[data-id="${id}"]`);
}

function kanbanColBody(status) {
  return document.querySelector(`#cp-kanban-view .cp-kanban-col-body[data-status="${status}"]`);
}

function kanbanCol(status) {
  return document.querySelector(`#cp-kanban-view .cp-kanban-col[data-status="${status}"]`);
}

function fire(el, type) {
  el.dispatchEvent(new Event(type, { bubbles: true, cancelable: true }));
}

const SAMPLE_ORDERS = [
  { id: "o1", code: "PO-0001", customer: "ลูกค้า เอ", item: "ป้ายไฟ LED", qty: 2, status: "received", dueDate: dateOffset(10) },
  { id: "o2", code: "PO-0002", customer: "ลูกค้า บี", item: "ป้ายอะคริลิก", qty: 1, status: "production", dueDate: dateOffset(-3) }, // overdue
  { id: "o3", code: "PO-0003", customer: "ลูกค้า ซี", item: "ป้ายสแตนเลส", qty: 5, status: "production", dueDate: dateOffset(1) },  // due-soon
  { id: "o4", code: "PO-0004", customer: "ลูกค้า ดี", item: "ป้ายกล่องไฟ", qty: 3, status: "completed", dueDate: dateOffset(-10) }, // completed → ไม่ urgent แม้เลยกำหนด
];

before(async () => {
  const dom = new JSDOM(`<!doctype html><html><body>${ADMIN_BODY_NO_SCRIPTS}</body></html>`, {
    url: "https://example.test/"
  });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
  globalThis.MouseEvent = dom.window.MouseEvent;
  globalThis.KeyboardEvent = dom.window.KeyboardEvent;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Event = dom.window.Event;
  dom.window.HTMLElement.prototype.scrollIntoView = function () {};
  globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);

  mod = await import("../js/orders-tab.js");
  document = dom.window.document;
});

beforeEach(() => {
  resetFirebaseCalls();
  mod.stopOrdersTab();
  mod.initOrdersTab();
  triggerOrdersSnapshot(SAMPLE_ORDERS);
  mod.setCurrentPage(1);
  document.getElementById("cp-search").value = "";
  // ปิด confirmDialog overlay ที่อาจค้างจากเทสก่อนหน้า (ถ้ามี)
  const overlay = document.querySelector(".cp-confirm-overlay");
  if (overlay && overlay.style.display === "flex") overlay.querySelector("#cp-confirm-cancel").click();
  // ปิด order modal overlay ที่อาจค้างจากเทสก่อนหน้า (ปุ่ม edit/clone เปิดไว้) — ปุ่มยกเลิกจริงคือ
  // #cp-order-cancel ซึ่งเรียก orderFormGuard.guardedClose() (ปิดตรงๆ ถ้าฟอร์มไม่ dirty — ในเทสไฟล์
  // นี้ไม่มีการพิมพ์แก้ฟอร์มเลยหลัง openOrderModal() จึงไม่ dirty ปิดได้ตรงๆ ไม่ผ่าน confirmDialog)
  const orderOverlay = document.getElementById("cp-order-overlay");
  if (orderOverlay && orderOverlay.style.display === "flex") {
    document.getElementById("cp-order-cancel").click();
  }
  document.getElementById("cp-bulk-clear").click();
  document.querySelectorAll(".cp-toast-wrap .cp-toast").forEach(el => el.remove());
  switchToKanban();
});

describe("js/orders-tab-kanban.js — renderKanban(): โครงสร้างคอลัมน์/การ์ด (รอบที่ 96)", () => {
  test("สร้างคอลัมน์ครบตาม KANBAN_COLUMNS (8 สถานะจาก ORDER_STATUS_FLOW + \"cancelled\" ท้ายสุด)", () => {
    const cols = Array.from(document.querySelectorAll("#cp-kanban-view .cp-kanban-col")).map(c => c.dataset.status);
    assert.deepEqual(cols, ["received", "design", "approval", "production", "qc", "packing", "shipping", "completed", "cancelled"]);
  });

  test("แต่ละคอลัมน์มีการ์ดตรงตาม status ของข้อมูล + หัวคอลัมน์แสดง count ถูกต้อง", () => {
    assert.deepEqual(Array.from(kanbanColBody("received").querySelectorAll(".cp-kanban-card")).map(c => c.dataset.id), ["o1"]);
    assert.deepEqual(Array.from(kanbanColBody("production").querySelectorAll(".cp-kanban-card")).map(c => c.dataset.id).sort(), ["o2", "o3"]);
    assert.deepEqual(Array.from(kanbanColBody("completed").querySelectorAll(".cp-kanban-card")).map(c => c.dataset.id), ["o4"]);

    assert.equal(kanbanCol("production").querySelector(".cp-kanban-col-count").textContent, "2");
    assert.equal(kanbanCol("received").querySelector(".cp-kanban-col-count").textContent, "1");
  });

  test("คอลัมน์ที่ไม่มีคำสั่งผลิตเลย: col-body ว่าง (ไม่มี .cp-kanban-card) แต่ count เป็น 0", () => {
    const body = kanbanColBody("design");
    assert.equal(body.querySelectorAll(".cp-kanban-card").length, 0);
    assert.equal(kanbanCol("design").querySelector(".cp-kanban-col-count").textContent, "0");
  });

  test("การ์ดแสดง code/item/customer/qty/dueDate ผ่าน escapeHtml (อักขระอันตรายถูก escape จริง)", () => {
    triggerOrdersSnapshot([{ id: "xss1", code: '<img src=x onerror=alert(1)>', customer: "ลูกค้า", item: "งาน", qty: 1, status: "received" }]);
    mod.render();

    const card = kanbanCard("xss1");
    assert.ok(card, "ต้องมีการ์ด xss1");
    assert.equal(card.querySelector(".cp-kanban-card-code").innerHTML.includes("<img"), false, "ต้อง escape ไม่ให้ tag แทรกจริง");
    assert.ok(card.querySelector(".cp-kanban-card-code").textContent.includes("<img src=x"));
  });

  test("การ์ดไม่มี dueDate → แสดง 'ไม่ระบุกำหนดส่ง' แทน", () => {
    triggerOrdersSnapshot([{ id: "nodate1", code: "PO-N1", customer: "ลูกค้า", item: "งาน", qty: 1, status: "received" }]);
    mod.render();
    assert.equal(kanbanCard("nodate1").querySelector(".cp-kanban-card-due").textContent, "ไม่ระบุกำหนดส่ง");
  });

  test("urgency class: เลยกำหนด → is-overdue, ใกล้กำหนด (<=2 วัน) → is-duesoon, ปกติ → ไม่มี class ทั้งสอง", () => {
    const overdueCard = kanbanCard("o2"); // dueDate -3 วัน, status production (ยังไม่จบงาน)
    assert.equal(overdueCard.classList.contains("is-overdue"), true);
    assert.equal(overdueCard.classList.contains("is-duesoon"), false);

    const dueSoonCard = kanbanCard("o3"); // dueDate +1 วัน
    assert.equal(dueSoonCard.classList.contains("is-duesoon"), true);
    assert.equal(dueSoonCard.classList.contains("is-overdue"), false);

    const normalCard = kanbanCard("o1"); // dueDate +10 วัน
    assert.equal(normalCard.classList.contains("is-overdue"), false);
    assert.equal(normalCard.classList.contains("is-duesoon"), false);
  });

  test("การ์ดที่ status เป็น 'completed' แม้ dueDate เลยกำหนดไปนานแล้ว ก็ไม่ติด class เร่งด่วน (orderUrgency คืน null เสมอสำหรับงานที่จบแล้ว)", () => {
    const completedCard = kanbanCard("o4"); // dueDate -10 วัน แต่ status completed
    assert.equal(completedCard.classList.contains("is-overdue"), false);
    assert.equal(completedCard.classList.contains("is-duesoon"), false);
  });

  // ของเสริมไม่บังคับ (รอบที่ 15): badge "ขอรีวิวแล้ว" อ่านจาก field reviewRequestedAt (P2.9a2)
  test("การ์ดที่มี reviewRequestedAt: แสดง badge 'ขอรีวิวแล้ว'", () => {
    triggerOrdersSnapshot([{ id: "rev1", code: "PO-REV1", customer: "ลูกค้า", item: "งาน", qty: 1, status: "completed", reviewRequestedAt: "2026-01-01T00:00:00Z" }]);
    mod.render();
    const badge = kanbanCard("rev1").querySelector(".cp-kanban-card-review-badge");
    assert.ok(badge, "ต้องมี badge แสดง");
    assert.equal(badge.textContent, "ขอรีวิวแล้ว");
  });

  test("การ์ดที่ไม่มี reviewRequestedAt (undefined หรือไม่มี field เลย): ไม่มี badge", () => {
    // o1 ในชุดตัวอย่างมาตรฐานไม่มี field นี้เลย
    assert.equal(kanbanCard("o1").querySelector(".cp-kanban-card-review-badge"), null);
  });
});

describe("js/orders-tab-kanban.js — dragstart/dragend (รอบที่ 96)", () => {
  // หมายเหตุสำคัญ: dragOrderId เป็น module-private state ไม่มี setter export — dragstart ตั้งค่าไว้
  // แต่ dragend "ไม่ได้" ล้างค่านี้เลย (ล้างเฉพาะตอน drop เท่านั้น ดูโค้ดจริงบรรทัด 64-70) ถ้าเทสไหน
  // เรียก dragstart ค้างไว้โดยไม่จบด้วย drop จริง จะรั่วไปกระทบเทส "drop" describe ถัดไปได้ (ตรวจพบ
  // จริงตอนรันครั้งแรก — ไม่ใช่บั๊กของโค้ดจริง เพราะ browser จริงไม่มีทางยิง drop โดยไม่มี dragstart
  // มาก่อน แต่เทสยิง event นอกลำดับธรรมชาติได้ จึงต้องเคลียร์เองท้ายทุกเทสที่เรียก dragstart) —
  // เคลียร์ด้วยการยิง drop กลับเข้าคอลัมน์ status เดิมของการ์ด (early-return path ไม่เรียก
  // updateOrder() แน่นอน เพราะ order.status === newStatus)
  test("dragstart บนการ์ด: เพิ่ม class 'dragging'", async () => {
    const card = kanbanCard("o1");
    assert.equal(card.classList.contains("dragging"), false);
    fire(card, "dragstart");
    assert.equal(card.classList.contains("dragging"), true);

    fire(kanbanColBody("received"), "drop"); // เคลียร์ dragOrderId ค้าง (o1 status=received)
    await new Promise(r => setTimeout(r, 0));
  });

  test("dragend บนการ์ด: ลบ class 'dragging' ออก", async () => {
    const card = kanbanCard("o1");
    fire(card, "dragstart");
    assert.equal(card.classList.contains("dragging"), true);
    fire(card, "dragend");
    assert.equal(card.classList.contains("dragging"), false);

    fire(kanbanColBody("received"), "drop"); // เคลียร์ dragOrderId ค้าง (dragend ไม่ได้ล้างให้)
    await new Promise(r => setTimeout(r, 0));
  });
});

describe("js/orders-tab-kanban.js — dragover/dragleave บนคอลัมน์ (รอบที่ 96)", () => {
  test("dragover บน col-body: เพิ่ม class 'drag-over' ที่ .cp-kanban-col ที่ครอบอยู่ (ไม่ใช่ col-body เอง)", () => {
    const body = kanbanColBody("design");
    const col = kanbanCol("design");
    assert.equal(col.classList.contains("drag-over"), false);
    fire(body, "dragover");
    assert.equal(col.classList.contains("drag-over"), true);
    assert.equal(body.classList.contains("drag-over"), false, "class ต้องอยู่ที่ .cp-kanban-col ไม่ใช่ .cp-kanban-col-body");
  });

  test("dragleave บน col-body: ลบ class 'drag-over' ออกจาก .cp-kanban-col", () => {
    const body = kanbanColBody("design");
    const col = kanbanCol("design");
    fire(body, "dragover");
    assert.equal(col.classList.contains("drag-over"), true);
    fire(body, "dragleave");
    assert.equal(col.classList.contains("drag-over"), false);
  });
});

describe("js/orders-tab-kanban.js — drop: เปลี่ยนสถานะจริง (รอบที่ 96)", () => {
  test("drop โดยไม่มีการ dragstart มาก่อนเลย (dragOrderId ยังเป็น null): ไม่เรียก updateOrder() เลย", async () => {
    fire(kanbanColBody("design"), "drop");
    await new Promise(r => setTimeout(r, 0));
    assert.deepEqual(globalThis.__UPDATE_DOC_CALLS__, []);
  });

  test("ลากการ์ดแล้วปล่อยลงคอลัมน์สถานะใหม่: เรียก updateOrder(id, {status}) จริง + แสดง toast success + ลบ class drag-over", async () => {
    fire(kanbanCard("o1"), "dragstart"); // o1: status=received
    const targetBody = kanbanColBody("design");
    fire(targetBody, "dragover");
    assert.equal(kanbanCol("design").classList.contains("drag-over"), true);

    fire(targetBody, "drop");
    await new Promise(r => setTimeout(r, 0));

    assert.equal(globalThis.__UPDATE_DOC_CALLS__.length, 1);
    assert.equal(globalThis.__UPDATE_DOC_CALLS__[0].path, "orders/o1");
    assert.equal(globalThis.__UPDATE_DOC_CALLS__[0].payload.status, "design");
    assert.equal(kanbanCol("design").classList.contains("drag-over"), false);

    const toastEls = document.querySelectorAll(".cp-toast-wrap .cp-toast.success");
    assert.equal(toastEls.length >= 1, true);
    assert.equal(toastEls[toastEls.length - 1].textContent, 'ย้าย "PO-0001" ไปยัง ออกแบบ');
  });

  test("ปล่อยลงคอลัมน์สถานะเดิม (ลากในคอลัมน์ตัวเอง): ไม่เรียก updateOrder() เลย (order.status === newStatus)", async () => {
    fire(kanbanCard("o1"), "dragstart"); // o1: status=received
    fire(kanbanColBody("received"), "drop"); // ปล่อยลงคอลัมน์เดิม
    await new Promise(r => setTimeout(r, 0));

    assert.deepEqual(globalThis.__UPDATE_DOC_CALLS__, []);
  });

  test("dragOrderId ถูกล้างหลัง drop เสมอ (แม้ early-return เพราะ status เดิม): ปล่อยซ้ำอีกครั้งที่คอลัมน์อื่นโดยไม่ dragstart ใหม่ ต้องไม่เรียก updateOrder()", async () => {
    fire(kanbanCard("o1"), "dragstart");
    fire(kanbanColBody("received"), "drop"); // status เดิม → early return แต่ dragOrderId ต้องถูกล้างไปแล้ว
    await new Promise(r => setTimeout(r, 0));

    fire(kanbanColBody("design"), "drop"); // ไม่มี dragstart ใหม่ก่อนหน้า
    await new Promise(r => setTimeout(r, 0));

    assert.deepEqual(globalThis.__UPDATE_DOC_CALLS__, []);
  });

  test("order ที่กำลังลากถูกลบไปแล้วก่อนปล่อย (หาไม่เจอใน getAllOrders()): ไม่เรียก updateOrder(), ไม่ throw", async () => {
    fire(kanbanCard("o1"), "dragstart");
    triggerOrdersSnapshot(SAMPLE_ORDERS.filter(o => o.id !== "o1")); // o1 หายไปจาก snapshot (ไม่ re-render kanban เอง)

    fire(kanbanColBody("design"), "drop");
    await new Promise(r => setTimeout(r, 0));

    assert.deepEqual(globalThis.__UPDATE_DOC_CALLS__, []);
  });

  test("updateOrder() ล้มเหลว (reject จริง): แสดง toast error พร้อมข้อความ err.message, ไม่ throw ค้าง", async () => {
    globalThis.__GET_DOC_STUB__ = () => { throw new Error("เครือข่ายขัดข้อง"); };
    fire(kanbanCard("o2"), "dragstart"); // o2: status=production
    fire(kanbanColBody("qc"), "drop");
    // updateOrder() มี await getDoc() เป็นบรรทัดแรก — flush microtask ให้ครบ ตามที่บันทึกไว้ในรอบ 95
    for (let i = 0; i < 10; i++) await Promise.resolve();

    assert.deepEqual(globalThis.__UPDATE_DOC_CALLS__, []);
    const toastEls = document.querySelectorAll(".cp-toast-wrap .cp-toast.error");
    assert.equal(toastEls.length >= 1, true, "ต้องมี toast error อย่างน้อย 1 อัน");
    assert.equal(toastEls[toastEls.length - 1].textContent, "อัปเดตสถานะไม่สำเร็จ: เครือข่ายขัดข้อง");
  });
});

describe("js/orders-tab-kanban.js — ปุ่มบนการ์ด: edit/clone/delete (รอบที่ 96)", () => {
  function cardBtn(id, action) {
    return kanbanCard(id).querySelector(`button[data-action="${action}"]`);
  }

  test("กดปุ่ม 'แก้ไข': เปิด order modal จริงด้วยข้อมูลของการ์ดนั้น (openOrderModal)", () => {
    cardBtn("o1", "edit").click();

    assert.equal(document.getElementById("cp-order-overlay").style.display, "flex");
    assert.equal(document.getElementById("cp-order-modal-title").textContent, "แก้ไขคำสั่งผลิต");
    assert.equal(document.getElementById("cp-o-head-code").textContent, "PO-0001");
    assert.equal(document.getElementById("cp-o-id").value, "o1");
    assert.equal(document.getElementById("cp-o-customer").value, "ลูกค้า เอ");
  });

  test("กดปุ่ม 'ทำซ้ำ': เปิด order modal ในโหมด clone (openOrderModalClone) — id/code/due/status ถูกล้าง, หัวข้อระบุว่าทำซ้ำจากรายการไหน", () => {
    cardBtn("o2", "clone").click();

    assert.equal(document.getElementById("cp-order-overlay").style.display, "flex");
    assert.equal(document.getElementById("cp-order-modal-title").textContent, 'ทำซ้ำคำสั่งผลิตจาก "PO-0002"');
    assert.equal(document.getElementById("cp-o-head-code").textContent, "");
    assert.equal(document.getElementById("cp-o-id").value, "");
    assert.equal(document.getElementById("cp-o-code").value, "");
    assert.equal(document.getElementById("cp-o-status").value, "received");
    // field อื่นที่ไม่ถูกล้าง (ทำซ้ำต้องคงข้อมูลเดิมไว้)
    assert.equal(document.getElementById("cp-o-customer").value, "ลูกค้า บี");
  });

  test("กดปุ่ม 'ลบ': เรียก confirmDeleteOrder() จริง เปิด confirmDialog (ไม่ลบทันที)", async () => {
    cardBtn("o3", "delete").click();
    await new Promise(r => setTimeout(r, 0));

    const overlay = document.querySelector(".cp-confirm-overlay");
    assert.equal(overlay.style.display, "flex");
    assert.deepEqual(globalThis.__DELETE_DOC_CALLS__, []);

    // เก็บกวาด: ยกเลิกก่อนจบเทส กัน state ค้างข้ามเทส
    overlay.querySelector("#cp-confirm-cancel").click();
    await new Promise(r => setTimeout(r, 0));
  });

  test("กดปุ่มบนการ์ดที่ order หาไม่เจอแล้วใน getAllOrders() (ถูกลบไปแล้วแต่การ์ดยังค้างอยู่ใน DOM เพราะยังไม่ re-render): ไม่เปิดอะไรเลย ไม่ throw", () => {
    const editBtn = cardBtn("o1", "edit");
    triggerOrdersSnapshot(SAMPLE_ORDERS.filter(o => o.id !== "o1")); // o1 หายจาก allOrders แต่การ์ดเดิมยังอยู่ใน DOM

    editBtn.click(); // ต้องไม่ throw

    const orderOverlay = document.getElementById("cp-order-overlay");
    assert.notEqual(orderOverlay.style.display, "flex", "ต้องไม่เปิด modal เมื่อหา order ไม่เจอ");
  });
});

describe("js/orders-tab-kanban.js — ปุ่ม 'เปลี่ยนสถานะ' กดครั้งเดียว (P1.6d, รอบที่ 10)", () => {
  function nextBtn(id) {
    return kanbanCard(id).querySelector(".cp-kanban-next-btn");
  }

  test("การ์ดที่ status อยู่กลาง flow (ไม่ใช่ขั้นสุดท้าย): มีปุ่ม 'เปลี่ยนสถานะ' แสดงชื่อสถานะถัดไปจริง + data-next-status ถูกต้อง", () => {
    const btn = nextBtn("o1"); // o1: received → ถัดไปคือ design
    assert.ok(btn, "ต้องมีปุ่มเปลี่ยนสถานะบนการ์ด o1");
    assert.equal(btn.dataset.nextStatus, "design");
    assert.equal(btn.textContent, 'เปลี่ยนเป็น "ออกแบบ" →');
  });

  test("การ์ดที่ status เป็น 'completed' (ขั้นสุดท้ายของ flow): ไม่มีปุ่มเปลี่ยนสถานะ", () => {
    assert.equal(nextBtn("o4"), null); // o4: status=completed
  });

  test("การ์ดที่ status เป็น 'cancelled': ไม่มีปุ่มเปลี่ยนสถานะ (ไม่อยู่ใน ORDER_STATUS_FLOW เลย)", () => {
    triggerOrdersSnapshot([{ id: "c1", code: "PO-C1", customer: "ลูกค้า", item: "งาน", qty: 1, status: "cancelled" }]);
    mod.render();
    assert.equal(nextBtn("c1"), null);
  });

  test("กดปุ่ม 'เปลี่ยนสถานะ': เรียก updateOrder(id, {status: สถานะถัดไป}) จริง + แสดง toast success ข้อความเดียวกับ drop", async () => {
    nextBtn("o1").click(); // o1: received → design
    await new Promise(r => setTimeout(r, 0));

    assert.equal(globalThis.__UPDATE_DOC_CALLS__.length, 1);
    assert.equal(globalThis.__UPDATE_DOC_CALLS__[0].path, "orders/o1");
    assert.equal(globalThis.__UPDATE_DOC_CALLS__[0].payload.status, "design");

    const toastEls = document.querySelectorAll(".cp-toast-wrap .cp-toast.success");
    assert.equal(toastEls.length >= 1, true);
    assert.equal(toastEls[toastEls.length - 1].textContent, 'ย้าย "PO-0001" ไปยัง ออกแบบ');
  });

  test("กดปุ่ม 'เปลี่ยนสถานะ' แล้ว updateOrder() ล้มเหลว (reject จริง): แสดง toast error พร้อมข้อความ err.message, ไม่ throw ค้าง", async () => {
    globalThis.__GET_DOC_STUB__ = () => { throw new Error("เครือข่ายขัดข้อง"); };
    nextBtn("o2").click(); // o2: production → ถัดไปคือ qc
    for (let i = 0; i < 10; i++) await Promise.resolve();

    assert.deepEqual(globalThis.__UPDATE_DOC_CALLS__, []);
    const toastEls = document.querySelectorAll(".cp-toast-wrap .cp-toast.error");
    assert.equal(toastEls.length >= 1, true, "ต้องมี toast error อย่างน้อย 1 อัน");
    assert.equal(toastEls[toastEls.length - 1].textContent, "อัปเดตสถานะไม่สำเร็จ: เครือข่ายขัดข้อง");
  });

  test("กดปุ่มเปลี่ยนสถานะบนการ์ดที่ order หาไม่เจอแล้วใน getAllOrders(): ไม่เรียก updateOrder(), ไม่ throw", async () => {
    const btn = nextBtn("o3"); // o3: production → ถัดไปคือ qc
    triggerOrdersSnapshot(SAMPLE_ORDERS.filter(o => o.id !== "o3")); // o3 หายไปจาก allOrders แต่ปุ่มเดิมยังอยู่ใน DOM

    btn.click();
    await new Promise(r => setTimeout(r, 0));

    assert.deepEqual(globalThis.__UPDATE_DOC_CALLS__, []);
  });
});
