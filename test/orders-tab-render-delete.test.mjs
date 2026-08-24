// test/orders-tab-render-delete.test.mjs — รอบที่ 95 (Phase 3 sub-round 3c, ส่วนที่ 2/2 —
// ส่วนสุดท้ายของ 3c และของ Phase 3 ทั้งหมด — ต่อจาก test/orders-tab-bulk-select.test.mjs รอบ 94)
//
// ขอบเขตของไฟล์นี้ จาก js/orders-tab.js:
//   - render()/renderTable(): pagination slice (ORDERS_PAGE_SIZE=10), kanban dispatch (activeView
//     === "kanban" → เรียก renderKanban() + ซ่อน pagination), error-state fallback ตอน
//     filterOrders() throw (try/catch รอบนอกของ render() ที่ครอบ filterOrders+dispatch),
//     renderTable() เอง: แถวว่าง → ข้อความ "ไม่พบคำสั่งผลิต" + ยังเรียก updateOrdersBulkBar()
//   - ปุ่ม "ลบที่เลือก" (cp-bulk-delete): ต้องผ่าน confirmDialog() จริงก่อนถึงเรียก deleteOrder()
//     ทีละรายการ (ไม่ใช่ Promise.all แบบ apply-status — ดูโค้ดจริง: Promise.all(ids.map(deleteOrder)))
//   - confirmDeleteOrder(): ต้องผ่านทั้ง confirmDialog()+showUndoToast() จริง — 2 เส้นทาง: กด
//     "เลิกทำ" ทันเวลา = ไม่ลบจริง VS ปล่อยผ่านจนหมดเวลา (default 5000ms) = ลบจริง
//
// สถาปัตยกรรมเทส: เหมือน test/orders-tab-bulk-select.test.mjs (รอบ 94) ทุกประการ — jsdom + import
// โมดูลครั้งเดียวต่อไฟล์ใน before(), triggerOrdersSnapshot()/renderedRowIds()/rowCheckbox() คัดลอกมา
// ตรงๆ — ใช้ pattern confirmDialog() จาก test/ui-form-validation.test.mjs (รอบ 90, บรรทัด ~334-351)
// สำหรับทั้ง cp-bulk-delete และ confirmDeleteOrder() — showUndoToast() ไม่เคยมี pattern มาก่อน ใช้
// node:test built-in mock.timers (enable "setTimeout" เฉพาะเทสที่ต้องรอหมดเวลาจริง แล้ว reset()
// ทันทีท้ายเทสนั้นเพื่อไม่กระทบไฟล์เทสอื่นที่รันร่วมกระบวนการเดียวกัน) — เทส path "undone=true" ใช้
// การคลิกปุ่มตรงๆ ไม่ต้องพึ่ง mock.timers เลย (เสี่ยงน้อยกว่า) ตามที่บันทึกไว้ท้ายรอบ 94
//
// ระวัง state รั่วข้ามเทส: selectedOrderIds/pendingDeleteOrderIds ไม่มี setter export (ยกเว้น
// pendingDeleteOrderIds เป็น exported const Set เขียนตรงได้แต่ไม่ควรแก้จากเทสตรงๆ) — reset ผ่าน
// action DOM จริงใน beforeEach() เหมือนรอบ 94 (คลิก cp-bulk-clear, cancel confirmDialog ค้างถ้ามี)
//
// ตรวจโค้ดจริงบรรทัด 340-525 ของ js/orders-tab.js ละเอียดก่อนเขียนไฟล์นี้ (ตามที่สั่งไว้ท้ายรอบ 94)
// ไม่พบบั๊ก จึงเป็นไฟล์เทสล้วนๆ ไม่มีการแก้โค้ดผลิตภัณฑ์เลยแม้แต่บรรทัดเดียว

import { test, describe, before, beforeEach, mock } from "node:test";
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

function triggerOrdersSnapshot(orders) {
  const cb = globalThis.__SNAPSHOT_LISTENERS__ && globalThis.__SNAPSHOT_LISTENERS__["orders"];
  if (typeof cb !== "function") throw new Error("orders snapshot listener ยังไม่ได้ลงทะเบียน (เรียก initOrdersTab() ก่อนหรือยัง?)");
  cb({ docs: orders.map(o => ({ id: o.id, data: () => { const { id, ...rest } = o; return rest; } })) });
}

function renderedRowIds() {
  return Array.from(document.querySelectorAll("#cp-table-body tr[data-id]")).map(tr => tr.dataset.id);
}

function rowCheckbox(id) {
  return document.querySelector(`#cp-table-body .cp-o-row-check[data-id="${id}"]`);
}

function selectRows(ids) {
  ids.forEach(id => {
    rowCheckbox(id).checked = true;
    rowCheckbox(id).dispatchEvent(new Event("change", { bubbles: true }));
  });
}

// สร้างคำสั่งผลิต 12 รายการ (มากกว่า ORDERS_PAGE_SIZE=10) สำหรับเทส pagination
function manyOrders(n) {
  return Array.from({ length: n }, (_, i) => ({
    id: `m${i + 1}`,
    code: `PO-M${String(i + 1).padStart(3, "0")}`,
    customer: `ลูกค้า ${i + 1}`,
    status: "received",
  }));
}

const SAMPLE_ORDERS = [
  { id: "o1", code: "PO-0001", customer: "ลูกค้า เอ", status: "received",   assignee: "uid-A" },
  { id: "o2", code: "PO-0002", customer: "ลูกค้า บี", status: "production", assignee: "uid-B" },
  { id: "o3", code: "PO-0003", customer: "ลูกค้า ซี", status: "completed",  assignee: "uid-A" },
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
  // ปิด confirmDialog overlay ที่อาจค้างจากเทสก่อนหน้า (ถ้ามี) — คลิกยกเลิกแบบไม่มีเงื่อนไข
  const overlay = document.querySelector(".cp-confirm-overlay");
  if (overlay && overlay.style.display === "flex") overlay.querySelector("#cp-confirm-cancel").click();
  // เคลียร์ selectedOrderIds ที่อาจค้างจากเทสก่อนหน้า (ไม่มี setter export — ต้องคลิกปุ่มจริง)
  document.getElementById("cp-bulk-clear").click();
  // ลบ toast ที่อาจค้างจากเทสก่อนหน้า (showUndoToast()/showToast() ลบตัวเองแบบหน่วงเวลา
  // 200ms/3200ms — เทสก่อนหน้าอาจไม่ได้รอนานขนาดนั้น ทำให้ querySelector(".cp-toast.undo...")
  // ในเทสถัดไปอาจไปเจอ element เก่าที่ยังค้างอยู่แทนตัวใหม่ — ลบทิ้งให้สะอาดก่อนทุกเทส)
  document.querySelectorAll(".cp-toast-wrap .cp-toast").forEach(el => el.remove());
  // กลับมามุมมองตาราง (บางเทสสลับไป kanban) — คลิกปุ่ม view "table" แบบไม่มีเงื่อนไข
  const tableViewBtn = document.querySelector('.cp-view-btn[data-view="table"]');
  if (tableViewBtn) tableViewBtn.click();
  mod.render();
});

describe("js/orders-tab.js — render()/renderTable(): pagination slice (รอบที่ 95)", () => {
  test("หน้า 1 แสดงแค่ ORDERS_PAGE_SIZE (10) แถวแรก แม้มีคำสั่งผลิตทั้งหมด 12 รายการ", () => {
    triggerOrdersSnapshot(manyOrders(12));
    mod.setCurrentPage(1);
    mod.render();

    assert.equal(renderedRowIds().length, mod.ORDERS_PAGE_SIZE);
    assert.deepEqual(renderedRowIds(), manyOrders(12).slice(0, 10).map(o => o.id));
  });

  test("หน้า 2 แสดงส่วนที่เหลือ (2 รายการสุดท้ายจากทั้งหมด 12)", () => {
    triggerOrdersSnapshot(manyOrders(12));
    mod.setCurrentPage(2);
    mod.render();

    assert.deepEqual(renderedRowIds(), ["m11", "m12"]);
  });

  test("pagination box แสดงอยู่ (ไม่ซ่อน) ตอนอยู่มุมมองตาราง", () => {
    triggerOrdersSnapshot(manyOrders(12));
    mod.render();
    assert.notEqual(document.getElementById("cp-pagination").style.display, "none");
  });
});

describe("js/orders-tab.js — render(): kanban dispatch (รอบที่ 95)", () => {
  test("สลับไปมุมมอง kanban: ซ่อน pagination box + renderKanban() ทำงานจริง (มีการ์ดตาม status ครบ)", () => {
    document.querySelector('.cp-view-btn[data-view="kanban"]').click();

    assert.equal(document.getElementById("cp-pagination").style.display, "none");
    const kanbanView = document.getElementById("cp-kanban-view");
    const cardIds = Array.from(kanbanView.querySelectorAll(".cp-kanban-card")).map(c => c.dataset.id).sort();
    assert.deepEqual(cardIds, ["o1", "o2", "o3"]);
  });

  test("มุมมอง kanban ไม่ตัด pagination ทิ้งจาก DOM แค่ซ่อนด้วย style เฉยๆ — สลับกลับตารางได้ปกติ", () => {
    document.querySelector('.cp-view-btn[data-view="kanban"]').click();
    document.querySelector('.cp-view-btn[data-view="table"]').click();

    assert.notEqual(document.getElementById("cp-pagination").style.display, "none");
    assert.deepEqual(renderedRowIds().sort(), ["o1", "o2", "o3"]);
  });
});

describe("js/orders-tab.js — render(): error-state fallback ตอน filterOrders() throw (รอบที่ 95)", () => {
  test("filterOrders() throw (เช่น order.code เป็น number ปนกับการค้นหาที่มีคำค้น) → tableBody แสดง error state พร้อมปุ่มลองใหม่ ไม่ throw ออกมาจาก render()", () => {
    triggerOrdersSnapshot([
      { id: "bad1", code: 12345, customer: "ลูกค้า พัง", status: "received" }, // code เป็น number ผิดปกติ
    ]);
    document.getElementById("cp-search").value = "PO"; // ต้องมีคำค้นไม่ว่างเพื่อให้ path .toLowerCase() ถูกเรียกกับ o.code
    assert.doesNotThrow(() => mod.render());

    const errBox = document.querySelector("#cp-table-body .cp-load-error");
    assert.ok(errBox, "ต้องมี .cp-load-error โผล่ใน tableBody");
    assert.ok(errBox.querySelector(".cp-retry-btn"), "ต้องมีปุ่มลองใหม่");
    assert.equal(document.getElementById("cp-pagination").style.display, "none");
  });

  test("กดปุ่มลองใหม่หลัง error แล้วแก้ไขสาเหตุ (ล้างคำค้น): กลับมาแสดงตารางปกติได้", async () => {
    triggerOrdersSnapshot([
      { id: "bad1", code: 12345, customer: "ลูกค้า พัง", status: "received" },
    ]);
    document.getElementById("cp-search").value = "PO";
    mod.render();
    const retryBtn = document.querySelector("#cp-table-body .cp-retry-btn");
    assert.ok(retryBtn, "ต้องมีปุ่มลองใหม่ก่อนเริ่มเทส");

    // แก้สาเหตุก่อนกด retry (retry เรียก render() ซ้ำ ถ้ายังไม่แก้จะ error ซ้ำเหมือนเดิม)
    document.getElementById("cp-search").value = "";
    retryBtn.click();
    await new Promise(r => setTimeout(r, 0));

    assert.equal(document.querySelector("#cp-table-body .cp-load-error"), null);
    assert.deepEqual(renderedRowIds(), ["bad1"]);
  });
});

describe("js/orders-tab.js — renderTable(): แถวว่าง (รอบที่ 95)", () => {
  test("กรองแล้วไม่เหลือแถวเลย → tableBody แสดง 'ไม่พบคำสั่งผลิต' และยังเรียก updateOrdersBulkBar() (bulk bar ไม่ active)", () => {
    document.getElementById("cp-search").value = "ไม่มีอยู่จริงแน่นอน-xyz";
    mod.render();

    const emptyCell = document.querySelector("#cp-table-body .cp-empty");
    assert.ok(emptyCell, "ต้องมี .cp-empty");
    assert.equal(emptyCell.textContent, "ไม่พบคำสั่งผลิต");
    assert.equal(document.getElementById("cp-bulk-bar").classList.contains("active"), false);
    assert.equal(document.getElementById("cp-bulk-count").textContent, "0");
  });
});

describe("js/orders-tab.js — ปุ่ม 'ลบที่เลือก': cp-bulk-delete (รอบที่ 95)", () => {
  test("ไม่มีแถวไหนถูกเลือกเลย: กดแล้วไม่เปิด confirmDialog เลย (early return)", () => {
    document.getElementById("cp-bulk-delete").click();
    const overlay = document.querySelector(".cp-confirm-overlay");
    if (overlay) assert.notEqual(overlay.style.display, "flex");
    assert.deepEqual(globalThis.__DELETE_DOC_CALLS__, []);
  });

  test("เลือก 2 แถวแล้วกดลบ: เปิด confirmDialog ก่อน, กด 'ยกเลิก' → ไม่เรียก deleteOrder() เลย, selection คงอยู่", async () => {
    selectRows(["o1", "o2"]);
    document.getElementById("cp-bulk-delete").click();
    await new Promise(r => setTimeout(r, 0));
    const overlay = document.querySelector(".cp-confirm-overlay");
    assert.equal(overlay.style.display, "flex");
    overlay.querySelector("#cp-confirm-cancel").click();
    await new Promise(r => setTimeout(r, 0));

    assert.deepEqual(globalThis.__DELETE_DOC_CALLS__, []);
    assert.equal(document.getElementById("cp-bulk-count").textContent, "2");
  });

  test("เลือก 2 แถวแล้วกดลบ, กด 'ยืนยัน': เรียก deleteOrder() ครบทั้ง 2 รายการ, selection ถูกเคลียร์, ปุ่มกลับมา enabled, แสดง toast สำเร็จ", async () => {
    selectRows(["o1", "o3"]);
    const btn = document.getElementById("cp-bulk-delete");
    btn.click();
    await new Promise(r => setTimeout(r, 0));
    const overlay = document.querySelector(".cp-confirm-overlay");
    overlay.querySelector("#cp-confirm-ok").click();
    await new Promise(r => setTimeout(r, 0));

    assert.equal(globalThis.__DELETE_DOC_CALLS__.length, 2);
    const paths = globalThis.__DELETE_DOC_CALLS__.map(c => c.path).sort();
    assert.deepEqual(paths, ["orders/o1", "orders/o3"]);
    assert.equal(document.getElementById("cp-bulk-count").textContent, "0");
    assert.equal(btn.disabled, false);
    const toastEls = document.querySelectorAll(".cp-toast-wrap .cp-toast.success");
    assert.equal(toastEls.length >= 1, true, "ต้องมี toast success อย่างน้อย 1 อัน");
    assert.equal(toastEls[toastEls.length - 1].textContent, "ลบแล้ว 2 รายการ");
    // logAudit() ถูกเรียกภายในแต่ auth.currentUser เป็น null ตาม stub default → exit เงียบๆ ไม่มี addDoc("auditLog")
    assert.deepEqual(globalThis.__ADD_DOC_CALLS__, []);
  });
});

describe("js/orders-tab.js — confirmDeleteOrder() ผ่านปุ่มลบรายแถว (data-action='delete') (รอบที่ 95)", () => {
  function clickDeleteBtn(id) {
    const tr = document.querySelector(`#cp-table-body tr[data-id="${id}"]`);
    tr.querySelector('button[data-action="delete"]').click();
  }

  test("กดลบแถวเดียว → เปิด confirmDialog, กด 'ยกเลิก' → ไม่เพิ่ม id เข้า pendingDeleteOrderIds, ไม่เรียก deleteOrder(), แถวยังอยู่ครบ", async () => {
    clickDeleteBtn("o2");
    await new Promise(r => setTimeout(r, 0));
    const overlay = document.querySelector(".cp-confirm-overlay");
    assert.equal(overlay.style.display, "flex");
    overlay.querySelector("#cp-confirm-cancel").click();
    await new Promise(r => setTimeout(r, 0));

    assert.equal(mod.pendingDeleteOrderIds.has("o2"), false);
    assert.deepEqual(globalThis.__DELETE_DOC_CALLS__, []);
    assert.deepEqual(renderedRowIds().sort(), ["o1", "o2", "o3"]);
  });

  test("กดลบแถวเดียว → กด 'ยืนยัน' → id เข้า pendingDeleteOrderIds ทันที + render() ตัดแถวนี้ออกจากตาราง (excludeIds) + เปิด undo toast", async () => {
    clickDeleteBtn("o1");
    await new Promise(r => setTimeout(r, 0));
    document.querySelector(".cp-confirm-overlay #cp-confirm-ok").click();
    await new Promise(r => setTimeout(r, 0));

    assert.equal(mod.pendingDeleteOrderIds.has("o1"), true);
    assert.equal(renderedRowIds().includes("o1"), false, "แถวที่รอ 'เลิกทำ' ต้องถูกตัดออกจากตารางทันที");
    const undoToast = document.querySelector(".cp-toast-wrap .cp-toast.undo");
    assert.ok(undoToast, "ต้องมี undo toast โผล่ขึ้นมา");
    assert.ok(undoToast.querySelector(".cp-toast-undo-btn"));
    // ยังไม่เรียก deleteOrder() จนกว่าจะหมดเวลา/กด 'เลิกทำ'
    assert.deepEqual(globalThis.__DELETE_DOC_CALLS__, []);

    // เก็บกวาด: กดเลิกทำเพื่อไม่ให้ timer ค้างข้ามเทส
    undoToast.querySelector(".cp-toast-undo-btn").click();
    await new Promise(r => setTimeout(r, 0));
  });

  test("เส้นทาง 'เลิกทำ' ทันเวลา: กดปุ่มเลิกทำในโปรเจกต์ toast → ไม่ลบจริง, id ออกจาก pendingDeleteOrderIds, แถวกลับมาแสดงในตารางอีกครั้ง", async () => {
    clickDeleteBtn("o2");
    await new Promise(r => setTimeout(r, 0));
    document.querySelector(".cp-confirm-overlay #cp-confirm-ok").click();
    await new Promise(r => setTimeout(r, 0));
    assert.equal(renderedRowIds().includes("o2"), false);

    const undoBtn = document.querySelector(".cp-toast-wrap .cp-toast.undo .cp-toast-undo-btn");
    undoBtn.click();
    await new Promise(r => setTimeout(r, 0));

    assert.equal(mod.pendingDeleteOrderIds.has("o2"), false);
    assert.deepEqual(globalThis.__DELETE_DOC_CALLS__, [], "กด 'เลิกทำ' ต้องไม่เรียก deleteOrder() เลย");
    assert.equal(renderedRowIds().includes("o2"), true, "แถวต้องกลับมาแสดงอีกครั้งหลังเลิกทำ");
  });

  test("เส้นทาง ปล่อยผ่านจนหมดเวลา (5000ms default): เรียก deleteOrder() จริง, id ออกจาก pendingDeleteOrderIds, แสดง toast สำเร็จ", async () => {
    mock.timers.enable({ apis: ["setTimeout"] });
    try {
      // หมายเหตุ: ห้าม await new Promise(r => setTimeout(r, 0)) ตรงนี้ (setTimeout ถูก mock แล้ว
      // ตั้งแต่บรรทัดบน — ถ้ารอ real timer จะค้างตลอดไปเพราะไม่มีอะไรไป tick ให้) — ไม่จำเป็นด้วย
      // เพราะ confirmDialog() เปิด overlay แบบ synchronous ทันทีตอนถูกเรียก (ก่อนถึง await แรก)
      // จึงเรียก clickDeleteBtn() แล้ว overlay ต้องพร้อมใช้ได้ทันทีโดยไม่ต้องรอ tick ใดๆ ก่อน
      clickDeleteBtn("o3");
      document.querySelector(".cp-confirm-overlay #cp-confirm-ok").click();
      // flush microtask ให้ confirmDialog Promise resolve และ showUndoToast() เริ่ม timer จริง —
      // ใช้ mock.timers.tick(0) แทน setTimeout จริงเพราะ setTimeout ถูก mock ไว้แล้วในเทสนี้
      mock.timers.tick(0);
      await Promise.resolve();
      await Promise.resolve();

      assert.ok(document.querySelector(".cp-toast-wrap .cp-toast.undo"), "ต้องมี undo toast ก่อนหมดเวลา");
      assert.deepEqual(globalThis.__DELETE_DOC_CALLS__, [], "ยังไม่ครบเวลา ต้องยังไม่เรียก deleteOrder()");

      mock.timers.tick(5000);
      // deleteOrder() (js/db-orders.js) ทำ await getDoc()/await deleteDoc() ต่อกันหลายชั้น (แต่ละ
      // ชั้นเป็น noopAsync().then(...) จาก stub) ต้อง flush microtask หลายรอบกว่าจะ resolve ครบจริง
      // ก่อนถึงจะ assert ผลลัพธ์ท้ายสุดได้แม่นยำ (ต่างจากจุดอื่นในไฟล์นี้ที่พอ 1-2 รอบ)
      for (let i = 0; i < 10; i++) await Promise.resolve();

      assert.equal(globalThis.__DELETE_DOC_CALLS__.length, 1);
      assert.equal(globalThis.__DELETE_DOC_CALLS__[0].path, "orders/o3");
      assert.equal(mod.pendingDeleteOrderIds.has("o3"), false);
      const toastEls = document.querySelectorAll(".cp-toast-wrap .cp-toast.success");
      assert.equal(toastEls.length >= 1, true);
      assert.equal(toastEls[toastEls.length - 1].textContent, "ลบคำสั่งผลิตแล้ว");
    } finally {
      mock.timers.reset();
    }
  });
});
