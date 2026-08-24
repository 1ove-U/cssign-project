// test/orders-tab-lifecycle-reminders.test.mjs — รอบที่ 92 (Phase 3 sub-round 3a จากแผน 6 phase
// ที่วางไว้ในรอบที่ 88 — Phase 3 ถูกแบ่งย่อยเป็นหลายรอบตามที่เจ้าของเว็บสั่งในรอบนี้ เพราะไฟล์
// js/orders-tab.js ใหญ่ 547 บรรทัด กลัวชนลิมิตถ้าทำเทสทั้งไฟล์รอบเดียว — แบ่งเป็น 3 sub-round:
// 3a (รอบนี้) = lifecycle/listener/reminders/jump-to-order, 3b = ตัวกรอง/toggle/view-switch,
// 3c = render()/ตาราง/bulk actions)
//
// ขอบเขต sub-round 3a: ฟังก์ชันกลุ่ม "public API เรียกจาก admin-page.js" +
// "ใช้จาก Global Search" ของ js/orders-tab.js:
//   - initOrdersTab()/stopOrdersTab() lifecycle (idempotent start, unsubscribe ตอน stop, restart
//     ใหม่ได้หลัง stop)
//   - startOrdersListener() (private, ทดสอบผ่าน initOrdersTab() อ้อม) ผูก listenOrders() ถูก
//     collection, error path เขียน errorStateHTML ลงตาราง
//   - onOrdersChanged(cb)/onRequestOrdersTab(cb)/onRequestOverviewTab(cb) callback registration
//     (onOrdersChangedCb ถูกเรียกทุกครั้งที่ listener ยิงข้อมูลใหม่, ปุ่ม cp-view-summary-btn
//     เรียก onRequestOverviewTabCb)
//   - getOrderReminders() แยก overdue/due-soon ถูกต้องตาม orderUrgency() จริง (ไม่ mock)
//   - jumpToOrderReminder(kind) เคลียร์ filter อื่น + ตั้ง jumpFilter
//   - getAllOrders() คืนค่า allOrders ปัจจุบัน
//   - jumpToOrder(order) เคลียร์ filter + ใส่คำค้น + scrollIntoView + ไฮไลต์ชั่วคราว (รวมกรณี
//     order null และกรณีหา element ไม่เจอ)
//
// สถาปัตยกรรมเทส: jsdom + import โมดูลครั้งเดียวต่อไฟล์ใน before() (ตามที่สั่งไว้ท้ายรอบ 91/90 —
// ดู test/orders-tab-modal-submit-flow.test.mjs เป็นตัวอย่างหลัก) — js/orders-tab.js import
// js/orders-tab-modal.js/orders-tab-kanban.js/orders-tab-stats.js/orders-tab-export.js ตรงๆ
// (ไม่ใช่แค่ circular import อ้อมเหมือนรอบ 91) แต่ sub-round นี้ไม่ได้ทดสอบฟังก์ชันของไฟล์ลูกพวกนั้น
// เลย จึงไม่ต้องกังวลปัญหา module-level state ค้างข้าม document แบบที่ orders-tab-modal-submit-flow
// เจอ (เทสกลุ่มนี้ไม่แตะ DOM ของป๊อปอัพ/kanban/stats เลย)
//
// สิ่งที่ต้องแก้เพิ่มเติมนอกเหนือไฟล์เทส: **globalThis.onSnapshot() stub เดิมทิ้ง callback ทิ้งไป
// เฉยๆ ไม่เคยเรียกจริง** (ดู test/helpers/firebase-stub-loader.mjs) ทำให้ startOrdersListener()
// ไม่มีทางถูกทดสอบเลยสักเคส เพราะ allOrders (module-level state ใน js/orders-tab.js) ไม่มีทาง
// ถูกเติมข้อมูลได้จากภายนอกไฟล์เทส (ไม่มี setter export) — แก้โดยเพิ่ม globalThis.
// __SNAPSHOT_LISTENERS__[path] เก็บ callback ล่าสุดที่ onSnapshot() ถูกเรียกด้วย ให้เทสยิง fake
// snapshot เองได้ผ่าน triggerOrdersSnapshot() (helper ท้ายไฟล์นี้) — ดูคอมเมนต์เต็มที่จุดแก้ใน
// firebase-stub-loader.mjs — ไม่กระทบ test เดิมไฟล์ไหนเลย (ไม่มีไฟล์ไหนเรียก onSnapshot() มาก่อน)
//
// ไม่พบบั๊กระหว่างอ่านโค้ดจริงทั้งไฟล์ js/orders-tab.js ในส่วนที่ทดสอบรอบนี้ — ไม่มีการแก้ไฟล์โค้ด
// ผลิตภัณฑ์เลยแม้แต่บรรทัดเดียว (มีแก้แค่ test/helpers/firebase-stub-loader.mjs ซึ่งเป็นโครงสร้าง
// พื้นฐานของเทส ไม่ใช่โค้ดผลิตภัณฑ์จริง)

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
let mod; // orders-tab.js exports ทั้งหมด

function resetFirebaseCalls() {
  globalThis.__ADD_DOC_CALLS__ = [];
  globalThis.__UPDATE_DOC_CALLS__ = [];
  globalThis.__DELETE_DOC_CALLS__ = [];
  globalThis.__SET_DOC_CALLS__ = [];
  globalThis.__GET_DOC_STUB__ = undefined;
  globalThis.__GET_DOCS_STUB__ = undefined;
  globalThis.__SNAPSHOT_LISTENERS__ = {};
}

// ยิง fake realtime snapshot ไปที่ listener ล่าสุดที่ผูกกับ collection "orders" (listenOrders()
// เรียก onSnapshot(query(collection(db,"orders"), ...), ...) — stub ให้ ref.path === "orders")
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
  // js/orders-tab-modal.js (import ตรงจากไฟล์นี้) เรียก scrollIntoView() ตอน switchOdTab() —
  // ต้อง stub ก่อน import เสมอ (เหมือน test/orders-tab-modal-submit-flow.test.mjs) — jumpToOrder()
  // ในไฟล์นี้เองก็เรียก scrollIntoView() ตรงๆ ด้วย ต้อง stub อยู่แล้วเช่นกัน
  dom.window.HTMLElement.prototype.scrollIntoView = function () {};
  // jumpToOrder() เรียก requestAnimationFrame() แบบ global ตรงๆ (ไม่ผ่าน window.) — ตรวจแล้วว่า
  // jsdom เวอร์ชันนี้ไม่มี window.requestAnimationFrame ให้เลย (undefined จริง ไม่ใช่แค่ไม่ได้
  // เปิดเผยเป็น global) ต้อง polyfill เองด้วย setTimeout (พฤติกรรมเพียงพอสำหรับเทส — ไม่ต้อง sync
  // กับ frame จริงเหมือน browser)
  globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);

  mod = await import("../js/orders-tab.js");
  document = dom.window.document;
});

beforeEach(() => {
  resetFirebaseCalls();
  mod.stopOrdersTab(); // เคลียร์ allOrders/unsubscribe/started ก่อนทุกเทส กันเทสก่อนหน้าค้าง state
});

describe("js/orders-tab.js — initOrdersTab()/stopOrdersTab() lifecycle (รอบที่ 92, Phase 3 sub-round 3a)", () => {
  test("initOrdersTab() ผูก listener ของ collection 'orders' ให้พร้อมรับ realtime snapshot", () => {
    mod.initOrdersTab();
    assert.equal(typeof globalThis.__SNAPSHOT_LISTENERS__["orders"], "function");
  });

  test("initOrdersTab() เรียกซ้ำ (idempotent): ไม่ผูก listener ใหม่ซ้ำถ้ายังไม่ stop", () => {
    mod.initOrdersTab();
    const firstCb = globalThis.__SNAPSHOT_LISTENERS__["orders"];
    triggerOrdersSnapshot([{ id: "o1", code: "PO-1", status: "received" }]);
    mod.initOrdersTab(); // เรียกซ้ำ — started=true อยู่แล้ว ต้อง return ทันทีไม่ทำอะไรซ้ำ
    assert.equal(mod.getAllOrders().length, 1, "ข้อมูลเดิมจาก listener ตัวแรกต้องยังอยู่ ไม่ถูกล้าง");
  });

  test("stopOrdersTab() ล้าง allOrders กลับเป็น [] และยกเลิก listener", () => {
    mod.initOrdersTab();
    triggerOrdersSnapshot([{ id: "o1", code: "PO-1", status: "received" }]);
    assert.equal(mod.getAllOrders().length, 1);
    mod.stopOrdersTab();
    assert.deepEqual(mod.getAllOrders(), []);
  });

  test("stop แล้ว init ใหม่: เริ่มทำงานได้อีกครั้งปกติ (ไม่ค้างสถานะ started=true จากรอบก่อน)", () => {
    mod.initOrdersTab();
    mod.stopOrdersTab();
    mod.initOrdersTab();
    assert.equal(typeof globalThis.__SNAPSHOT_LISTENERS__["orders"], "function");
    triggerOrdersSnapshot([{ id: "o2", code: "PO-2", status: "received" }]);
    assert.equal(mod.getAllOrders().length, 1);
  });
});
// หมายเหตุ: error-path ของ startOrdersListener() (onSnapshot(..., errCb) ยิง error →
// errorStateHTML ลงตาราง) ไม่ได้ทดสอบใน sub-round นี้ — stub onSnapshot() ที่เพิ่มในรอบนี้
// (firebase-stub-loader.mjs) เก็บเฉพาะ onNext (2nd arg) ไว้ใน __SNAPSHOT_LISTENERS__ ยังไม่ได้
// เก็บ onError (3rd arg) เพราะไม่ใช่ขอบเขตหลักของ 3a (เน้น lifecycle/reminders/jump-to-order) —
// ทิ้งไว้เป็นตัวเลือกสำหรับ sub-round ถัดไปถ้าต้องการเจาะลึก error-path เพิ่ม

describe("js/orders-tab.js — callback registration: onOrdersChanged/onRequestOrdersTab/onRequestOverviewTab (รอบที่ 92)", () => {
  test("onOrdersChanged(cb): cb ถูกเรียกทุกครั้งที่ listener ยิงข้อมูลใหม่ (ไม่เรียกตอน initOrdersTab() เฉยๆ ที่ยังไม่มีข้อมูล)", () => {
    let callCount = 0;
    mod.onOrdersChanged(() => { callCount++; });
    mod.initOrdersTab();
    assert.equal(callCount, 0, "ยังไม่มี snapshot ยิงเข้ามา ไม่ควรถูกเรียก");
    triggerOrdersSnapshot([{ id: "o1", code: "PO-1", status: "received" }]);
    assert.equal(callCount, 1);
    triggerOrdersSnapshot([{ id: "o1", code: "PO-1", status: "received" }, { id: "o2", code: "PO-2", status: "received" }]);
    assert.equal(callCount, 2);
  });

  test("onRequestOverviewTab(cb): กดปุ่ม 'ดูสรุปภาพรวมการผลิต' (cp-view-summary-btn) เรียก cb", () => {
    let called = false;
    mod.onRequestOverviewTab(() => { called = true; });
    document.getElementById("cp-view-summary-btn").click();
    assert.equal(called, true);
  });

  test("onRequestOrdersTab(cb): ถูกเรียกตอนกดการ์ดสถิติ 'งานใหม่' (cp-stat-card-new) ผ่าน jumpToNewOrders()", () => {
    let called = false;
    mod.onRequestOrdersTab(() => { called = true; });
    document.getElementById("cp-stat-card-new").click();
    assert.equal(called, true);
  });
});

describe("js/orders-tab.js — getOrderReminders(): แยก overdue/due-soon (รอบที่ 92)", () => {
  test("แยกงานเกินกำหนด (overdue) และใกล้ครบกำหนด (due-soon, <=2 วัน) ถูกต้อง ไม่รวมงาน completed/cancelled", () => {
    mod.initOrdersTab();
    triggerOrdersSnapshot([
      { id: "o1", code: "PO-OVERDUE", status: "production", dueDate: dateOffset(-3) },
      { id: "o2", code: "PO-DUESOON", status: "design",      dueDate: dateOffset(1)  },
      { id: "o3", code: "PO-FAR",     status: "received",    dueDate: dateOffset(10) },
      { id: "o4", code: "PO-DONE-OVERDUE", status: "completed", dueDate: dateOffset(-5) }, // ไม่นับ แม้เกินกำหนดจริง
      { id: "o5", code: "PO-CANCELLED-DUESOON", status: "cancelled", dueDate: dateOffset(1) }, // ไม่นับ
    ]);
    const { overdue, dueSoon } = mod.getOrderReminders();
    assert.deepEqual(overdue.map(o => o.code), ["PO-OVERDUE"]);
    assert.deepEqual(dueSoon.map(o => o.code), ["PO-DUESOON"]);
  });

  test("ไม่มีคำสั่งผลิตเลย: คืนทั้งสองกลุ่มเป็น array ว่าง", () => {
    mod.initOrdersTab();
    triggerOrdersSnapshot([]);
    assert.deepEqual(mod.getOrderReminders(), { overdue: [], dueSoon: [] });
  });
});

describe("js/orders-tab.js — getAllOrders() (รอบที่ 92)", () => {
  test("คืนค่า allOrders ปัจจุบันตาม snapshot ล่าสุด (ไม่ใช่ค้างจากครั้งก่อน)", () => {
    mod.initOrdersTab();
    triggerOrdersSnapshot([{ id: "o1", code: "PO-1", status: "received" }]);
    assert.equal(mod.getAllOrders().length, 1);
    triggerOrdersSnapshot([{ id: "o1", code: "PO-1", status: "received" }, { id: "o2", code: "PO-2", status: "received" }]);
    assert.equal(mod.getAllOrders().length, 2);
  });
});

describe("js/orders-tab.js — jumpToOrder(order): กระโดดไปหารายการจากผลค้นหา Global Search (รอบที่ 92)", () => {
  test("order เป็น null: ไม่ทำอะไรเลย (ไม่ throw, ไม่แตะช่องค้นหา)", () => {
    mod.initOrdersTab();
    document.getElementById("cp-search").value = "คงเดิม";
    mod.jumpToOrder(null);
    assert.equal(document.getElementById("cp-search").value, "คงเดิม");
  });

  test("ใส่คำค้นเป็นเลขที่คำสั่ง (code) ล้างตัวกรองสถานะ/jumpFilter/กลับหน้า 1", () => {
    mod.initOrdersTab();
    triggerOrdersSnapshot([{ id: "o1", code: "PO-2026-0500", customer: "ลูกค้า A", status: "received" }]);
    mod.jumpToOrderReminder("overdue"); // ตั้ง jumpFilter ไว้ก่อน เพื่อยืนยันว่า jumpToOrder() ล้างทิ้ง
    mod.setCurrentPage(3);

    mod.jumpToOrder({ id: "o1", code: "PO-2026-0500", customer: "ลูกค้า A" });

    assert.equal(document.getElementById("cp-search").value, "PO-2026-0500");
    assert.equal(mod.jumpFilter, null);
    assert.equal(mod.currentPage, 1);
  });

  test("order ไม่มี code ใช้ customer แทนเป็นคำค้น", () => {
    mod.initOrdersTab();
    mod.jumpToOrder({ id: "o2", code: "", customer: "บริษัท ทดสอบ จำกัด" });
    assert.equal(document.getElementById("cp-search").value, "บริษัท ทดสอบ จำกัด");
  });

  test("หา element ของแถวใน tableBody/kanbanView ไม่เจอ: ไม่ throw (element เป็น null ตอน jsdom ยังไม่ render จริง)", async () => {
    mod.initOrdersTab();
    assert.doesNotThrow(() => {
      mod.jumpToOrder({ id: "not-in-dom", code: "PO-X" });
    });
    // jumpToOrder() ค้นหา element ผ่าน requestAnimationFrame — รอ 1 tick ให้ callback ทำงานจบ
    // ก่อนจบเทส กัน error หลุดไปกระทบเทสถัดไป (jsdom ไม่มี requestAnimationFrame โดย default แต่
    // js/orders-tab.js ใช้ global requestAnimationFrame ตรงๆ ซึ่ง Node ผ่าน jsdom เวอร์ชันนี้มี
    // polyfill ให้ผ่าน window อยู่แล้ว — ยืนยันแล้วว่าไม่ throw ตอน element ไม่พบเพราะโค้ดจริงมี
    // `if (!el) return;` gate ไว้ก่อนเรียก .scrollIntoView()/.classList อยู่แล้ว)
    await new Promise(resolve => setTimeout(resolve, 20));
  });
});
