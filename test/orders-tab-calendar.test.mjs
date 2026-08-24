// test/orders-tab-calendar.test.mjs — P1.5b: มุมมองปฏิทินของแท็บคำสั่งผลิต (js/orders-tab-calendar.js)
//
// สถาปัตยกรรมเทส: เหมือน test/orders-tab-kanban.test.mjs (รอบ 96) ทุกประการ — jsdom + import
// js/orders-tab.js ครั้งเดียวต่อไฟล์ใน before() (renderCalendar() ถูกเรียกผ่าน render()/
// activeView==="calendar" ของ orders-tab.js เท่านั้น ไม่มีจุดเรียกอื่น) triggerOrdersSnapshot()/
// dateOffset() คัดลอกจาก test/orders-tab-kanban.test.mjs
//
// ขอบเขตของไฟล์นี้ จาก js/orders-tab-calendar.js (P1.5b):
//   - renderCalendar(rows): สร้าง grid เดือนปัจจุบัน (viewMonth เริ่มที่เดือนจริงตอนโหลดโมดูล —
//     module-private ไม่มี setter export) หัว label แสดง "เดือนไทย ปี พ.ศ." เซลล์ว่างนำหน้าตาม
//     getDay() ของวันที่ 1 ของเดือน + เซลล์วันจริงตามจำนวนวันในเดือน + เซลล์ว่างท้ายให้ครบแถว 7
//   - แต่ละเซลล์วันแสดง count "N รายการ" เมื่อมีออเดอร์ dueDate ตรงวันนั้น (ผ่าน ordersByDueDate())
//     ไม่แสดง badge เลยถ้าไม่มีออเดอร์วันนั้น
//   - urgency class ต่อเซลล์ (is-overdue/is-duesoon) มาจาก urgency "หนักสุด" ของออเดอร์ในวันนั้น
//     (overdue ชนะ due-soon เสมอ แม้มีแค่ 1 ใน N รายการที่ overdue)
//   - ปุ่ม #cp-cal-prev/#cp-cal-next: เปลี่ยน viewMonth ไปเดือนก่อนหน้า/ถัดไป แล้ว re-render ด้วย
//     rows ชุดเดิม (closure ของ renderCalendar call ล่าสุด ไม่ fetch ใหม่)
//
// หมายเหตุเรื่อง "เดือนปัจจุบัน" ในเทส: เพื่อไม่ให้เทสเปราะบางข้ามเดือน (viewMonth เริ่มที่เดือน
// จริงของเครื่องที่รันเทส) เทสกลุ่ม urgency ใช้ dateOffset(0) (=วันนี้ อยู่ในเดือนปัจจุบันเสมอ) เป็น
// due-soon และ clamp วันของเซลล์ "overdue" ให้ไม่หลุดออกนอกเดือนปัจจุบัน (ดู pastDateInCurrentMonth())
// — ถ้ารันเทสวันที่ 1 ของเดือนพอดี เซลล์ overdue จะ clamp เป็นวันเดียวกับวันนี้แทน (กลายเป็น
// due-soon ไม่ overdue) ซึ่งเป็น edge case ที่ยอมรับได้ (ไม่มีวันให้ "เลยกำหนด" ในเดือนเดียวกันจริงๆ
// ถ้าวันนี้คือวันที่ 1) เทสกลุ่มนำทางเดือน (prev/next) ออกแบบให้ self-contained เสมอ (จบเทสที่
// เดือนเดิมที่เริ่มต้น ด้วยการคลิกกลับเท่าจำนวนครั้งที่คลิกไป) กันรั่วข้ามเทสอื่นในไฟล์เดียวกัน

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
let mod; // orders-tab.js exports ทั้งหมด (renderCalendar() ถูกเรียกผ่าน render() เมื่อ activeView==="calendar")

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

// วันที่ "เลยกำหนด" (อดีต) ที่ยังอยู่ในเดือนปัจจุบันเสมอ — clamp ไม่ให้ข้ามไปเดือนก่อนหน้า
// (ดูหมายเหตุหัวไฟล์เรื่อง edge case วันที่ 1 ของเดือน)
function pastDateInCurrentMonth() {
  const now = new Date();
  const day = Math.max(1, now.getDate() - 3);
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function switchToCalendar() {
  document.querySelector('.cp-view-btn[data-view="calendar"]').click();
}

function calCell(dateKey) {
  return document.querySelector(`#cp-calendar-view .cp-cal-cell[data-date="${dateKey}"]`);
}

function calHeadLabel() {
  return document.querySelector("#cp-calendar-view .cp-cal-head-label").textContent;
}

const SAMPLE_ORDERS = [
  { id: "o1", code: "PO-0001", customer: "ลูกค้า เอ", item: "ป้ายไฟ LED", qty: 2, status: "received", dueDate: dateOffset(0) },   // วันนี้ → due-soon
  { id: "o2", code: "PO-0002", customer: "ลูกค้า บี", item: "ป้ายอะคริลิก", qty: 1, status: "production", dueDate: dateOffset(0) }, // วันเดียวกับ o1
  { id: "o3", code: "PO-0003", customer: "ลูกค้า ซี", item: "ป้ายสแตนเลส", qty: 5, status: "production", dueDate: pastDateInCurrentMonth() }, // อาจ overdue หรือ due-soon (edge case วันที่ 1)
  { id: "o4", code: "PO-0004", customer: "ลูกค้า ดี", item: "ป้ายกล่องไฟ", qty: 3, status: "completed", dueDate: pastDateInCurrentMonth() }, // completed → ไม่นับใน ordersByDueDate() เลย
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
  document.getElementById("cp-bulk-clear").click();
  switchToCalendar();
});

describe("js/orders-tab-calendar.js — renderCalendar(): โครงสร้าง grid เดือนปัจจุบัน", () => {
  test("แสดง label หัวปฏิทินเป็นเดือนไทย + ปี พ.ศ. ของเดือนปัจจุบัน", () => {
    const now = new Date();
    const MONTH_LABELS = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน",
      "กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
    assert.equal(calHeadLabel(), `${MONTH_LABELS[now.getMonth()]} ${now.getFullYear() + 543}`);
  });

  test("จำนวนป้ายชื่อวันในสัปดาห์ = 7 (อา จ อ พ พฤ ศ ส)", () => {
    const labels = Array.from(document.querySelectorAll("#cp-calendar-view .cp-cal-daylabel")).map(el => el.textContent);
    assert.deepEqual(labels, ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"]);
  });

  test("จำนวนเซลล์ทั้งหมด (นับว่างนำหน้า+ท้าย) หารด้วย 7 ลงตัวเสมอ + จำนวนเซลล์วันจริง = จำนวนวันในเดือน", () => {
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const allCells = document.querySelectorAll("#cp-calendar-view .cp-cal-grid:not(.cp-cal-grid-labels) .cp-cal-cell");
    const dayCells = document.querySelectorAll("#cp-calendar-view .cp-cal-grid:not(.cp-cal-grid-labels) .cp-cal-cell:not(.cp-cal-cell-empty)");
    assert.equal(allCells.length % 7, 0);
    assert.equal(dayCells.length, daysInMonth);
  });

  test("วันที่มีออเดอร์ตรง dueDate: แสดง badge จำนวนรายการถูกต้อง (นับเฉพาะที่ยังไม่ completed/cancelled)", () => {
    const todayKey = dateOffset(0);
    const cell = calCell(todayKey);
    assert.ok(cell, "ต้องมีเซลล์ของวันนี้");
    assert.equal(cell.querySelector(".cp-cal-cell-count").textContent, "2 รายการ");
  });

  test("วันที่ไม่มีออเดอร์เลย: ไม่มี .cp-cal-cell-count", () => {
    const emptyDayKey = dateOffset(15); // ห่างจากวันนี้พอสมควร ไม่ชนกับ SAMPLE_ORDERS วันไหนแน่นอน แต่ต้องเช็คว่ายังอยู่ในเดือนเดียวกัน
    const now = new Date();
    const stillSameMonth = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 15).getMonth() === now.getMonth();
    if (!stillSameMonth) return; // ข้ามถ้าข้ามเดือนไปแล้ว (edge case ปลายเดือน) กันเทสเปราะบาง
    const cell = calCell(emptyDayKey);
    if (!cell) return; // อาจไม่มีเซลล์ถ้า viewMonth ไม่ตรง (ป้องกันเผื่อ)
    assert.equal(cell.querySelector(".cp-cal-cell-count"), null);
  });

  test("งานที่ status เป็น 'completed' แม้ dueDate ตรงกับวันของ o3 (pastDateInCurrentMonth) ก็ไม่ถูกนับรวมในเซลล์เดียวกัน (ordersByDueDate ตัด completed ออกตั้งแต่ data layer)", () => {
    const cell = calCell(pastDateInCurrentMonth());
    assert.ok(cell, "ต้องมีเซลล์ของวันที่ o3 (o3 ยัง active)");
    // มีแค่ o3 เท่านั้นในเซลล์นี้ (o4 completed ถูกตัดออก) → badge ต้องเป็น "1 รายการ" ไม่ใช่ "2 รายการ"
    assert.equal(cell.querySelector(".cp-cal-cell-count").textContent, "1 รายการ");
  });

  test("urgency class: วันนี้ (d=0) → is-duesoon เสมอ ไม่มี is-overdue", () => {
    const cell = calCell(dateOffset(0));
    assert.equal(cell.classList.contains("is-duesoon"), true);
    assert.equal(cell.classList.contains("is-overdue"), false);
  });
});

describe("js/orders-tab-calendar.js — ปุ่มนำทางเดือน #cp-cal-prev/#cp-cal-next", () => {
  test("คลิกถัดไป: label เปลี่ยนไปเดือนถัดไป (ไม่ใช่เดือนเดิม) — คลิกก่อนหน้า 1 ครั้งกลับมา label เดิมพอดี (self-contained, ไม่รั่วข้ามเทส)", () => {
    const before = calHeadLabel();
    document.getElementById("cp-cal-next").click();
    const afterNext = calHeadLabel();
    assert.notEqual(afterNext, before);

    document.getElementById("cp-cal-prev").click();
    const afterPrev = calHeadLabel();
    assert.equal(afterPrev, before);
  });

  test("คลิกก่อนหน้าแล้วคลิกถัดไป: กลับมา label เดิมพอดีเช่นกัน (สมมาตรทั้งสองทิศทาง)", () => {
    const before = calHeadLabel();
    document.getElementById("cp-cal-prev").click();
    assert.notEqual(calHeadLabel(), before);

    document.getElementById("cp-cal-next").click();
    assert.equal(calHeadLabel(), before);
  });

  test("นำทางไปเดือนถัดไปแล้วกลับมา: grid ยัง render เซลล์ของเดือนปัจจุบันถูกต้องเหมือนก่อนนำทาง (rows เดิมจาก closure ยังใช้ได้)", () => {
    const todayKey = dateOffset(0);
    assert.ok(calCell(todayKey), "ก่อนนำทาง ต้องมีเซลล์วันนี้");

    document.getElementById("cp-cal-next").click();
    document.getElementById("cp-cal-prev").click();

    const cellAfter = calCell(todayKey);
    assert.ok(cellAfter, "หลังนำทางไปกลับ ต้องมีเซลล์วันนี้เหมือนเดิม");
    assert.equal(cellAfter.querySelector(".cp-cal-cell-count").textContent, "2 รายการ");
  });
});

describe("js/orders-tab-calendar.js — สลับ view ไป/กลับปฏิทิน", () => {
  test("สลับไปตาราง แล้วสลับกลับมาปฏิทิน: cp-calendar-view แสดงอีกครั้ง ไม่มี error", () => {
    document.querySelector('.cp-view-btn[data-view="table"]').click();
    assert.equal(document.getElementById("cp-calendar-view").style.display, "none");

    switchToCalendar();
    assert.equal(document.getElementById("cp-calendar-view").style.display, "");
    assert.ok(document.querySelector("#cp-calendar-view .cp-cal-grid"));
  });
});

describe("js/orders-tab-calendar.js — P1.5c: คลิกวันที่เปิด popover รายการออเดอร์", () => {
  test("เซลล์ที่มีออเดอร์ (มี .cp-cal-cell-count): มีคลาส cp-cal-cell-clickable", () => {
    const cell = calCell(dateOffset(0));
    assert.ok(cell.classList.contains("cp-cal-cell-clickable"));
  });

  test("เซลล์ที่ไม่มีออเดอร์: ไม่มีคลาส cp-cal-cell-clickable และคลิกแล้วไม่มี popover เปิดขึ้นมา", () => {
    const emptyDayKey = dateOffset(15);
    const now = new Date();
    const stillSameMonth = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 15).getMonth() === now.getMonth();
    if (!stillSameMonth) return;
    const cell = calCell(emptyDayKey);
    if (!cell) return;
    assert.equal(cell.classList.contains("cp-cal-cell-clickable"), false);
    cell.click();
    const overlay = document.querySelector(".cp-cal-day-overlay");
    assert.ok(!overlay || overlay.style.display === "none");
  });

  test("คลิกเซลล์ที่มีออเดอร์: เปิด popover แสดงหัวข้อวันที่ + จำนวนรายการ + รายชื่อออเดอร์ตรง code", () => {
    calCell(dateOffset(0)).click();
    const overlay = document.querySelector(".cp-cal-day-overlay");
    assert.ok(overlay, "ต้องมี overlay ถูกสร้างขึ้นหลังคลิก");
    assert.equal(overlay.style.display, "flex");
    assert.match(overlay.querySelector("#cp-cal-day-title").textContent, /2 รายการ/);

    const items = overlay.querySelectorAll(".cp-cal-day-item");
    assert.equal(items.length, 2);
    const codes = Array.from(items).map(el => el.querySelector(".cp-cal-day-item-code").textContent);
    assert.deepEqual(codes.sort(), ["PO-0001", "PO-0002"]);
  });

  test("คลิกปุ่มปิด (#cp-cal-day-close): ซ่อน popover", () => {
    calCell(dateOffset(0)).click();
    const overlay = document.querySelector(".cp-cal-day-overlay");
    overlay.querySelector("#cp-cal-day-close").click();
    assert.equal(overlay.style.display, "none");
  });

  test("คลิก backdrop (target === overlay เอง): ปิด popover เหมือนปุ่มปิด", () => {
    calCell(dateOffset(0)).click();
    const overlay = document.querySelector(".cp-cal-day-overlay");
    overlay.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    assert.equal(overlay.style.display, "none");
  });

  test("กด Escape ตอน popover เปิดอยู่: ปิด popover", () => {
    calCell(dateOffset(0)).click();
    const overlay = document.querySelector(".cp-cal-day-overlay");
    assert.equal(overlay.style.display, "flex");
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    assert.equal(overlay.style.display, "none");
  });

  test("คลิกรายการออเดอร์ใน popover: ปิด popover + เปิด order modal เดิมด้วยข้อมูลของออเดอร์นั้น", () => {
    calCell(dateOffset(0)).click();
    const overlay = document.querySelector(".cp-cal-day-overlay");
    const item = Array.from(overlay.querySelectorAll(".cp-cal-day-item"))
      .find(el => el.querySelector(".cp-cal-day-item-code").textContent === "PO-0001");
    item.click();

    assert.equal(overlay.style.display, "none");
    assert.equal(document.getElementById("cp-order-overlay").style.display, "flex");
    assert.equal(document.getElementById("cp-o-id").value, "o1");
    assert.equal(document.getElementById("cp-o-customer").value, "ลูกค้า เอ");
  });

  test("เปลี่ยนเดือน (คลิกถัดไปแล้วย้อนกลับ) แล้วคลิกวันเดิม: popover ยังทำงานปกติ (listener ถูกผูกใหม่ทุกครั้งที่ renderCalendar ทำงาน)", () => {
    document.getElementById("cp-cal-next").click();
    document.getElementById("cp-cal-prev").click();

    calCell(dateOffset(0)).click();
    const overlay = document.querySelector(".cp-cal-day-overlay");
    assert.equal(overlay.style.display, "flex");
    assert.equal(overlay.querySelectorAll(".cp-cal-day-item").length, 2);
  });
});
