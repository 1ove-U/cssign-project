// test/orders-tab-filters-toggles.test.mjs — รอบที่ 93 (Phase 3 sub-round 3b จากแผน 3 sub-round
// ที่วางไว้ในรอบที่ 92 — Phase 3 เดิมแบ่งเป็น 3a (lifecycle/listener/reminders/jump-to-order,
// เสร็จแล้ว รอบ 92) / 3b (รอบนี้ — ตัวกรอง/toggle/view-switch) / 3c (render()/ตาราง/bulk actions,
// รอบถัดไป))
//
// ขอบเขต sub-round 3b (ตามที่ตกลงไว้ท้ายรอบ 92) ของ js/orders-tab.js:
//   - searchInput "input" listener: currentPage รีเซ็ตเป็น 1, jumpFilter ถูกล้าง, render() ถูกเรียก
//     (ตรวจผ่านผลกรองจริงในตาราง)
//   - mineOnly toggle (cp-mine-toggle): สลับ mineOnly, toggle class "active", currentPage รีเซ็ต,
//     render() ถูกเรียก — auth.currentUser เป็น null เสมอตาม stub default (getAuth() คืน
//     {currentUser:null} คงที่ — ดู test/orders-tab-modal-submit-flow.test.mjs บรรทัด 43 อธิบาย
//     เดียวกัน) ทำให้ currentUserUid ที่ส่งเข้า filterOrders() เป็น null เสมอ ⇒ mineOnly=true กรอง
//     ทุกแถวออกหมดเสมอไม่ว่า assignee จะตรงหรือไม่ (ตรรกะกรอง mineOnly เองมีเทสละเอียดแยกต่างหากอยู่
//     แล้วที่ test/orders-tab-filters.test.mjs ซึ่งเป็น pure function ไม่ต้องพึ่ง DOM/auth จริง —
//     ที่นี่เทสแค่ว่า orders-tab.js resolve auth.currentUser ถูกจุด/toggle ปุ่มถูกต้อง ไม่ทดสอบซ้ำ
//     ตรรกะกรองเอง)
//   - setStatusFilter()/status pills (cp-filter-status-pills > .cp-status-pill): statusFilterValue
//     ถูกตั้ง, pill ที่ตรงกันได้ class "active"+aria-selected="true" pill อื่นถูกถอด, jumpFilter ถูก
//     ล้าง, currentPage รีเซ็ต, render() ถูกเรียก
//   - view toggle table/kanban (cp-view-toggle > .cp-view-btn): สลับปุ่ม active, สลับ
//     tableView/kanbanView.style.display, currentPage รีเซ็ต, render() ถูกเรียก (ตรวจทางอ้อมผ่าน
//     renderKanban()/renderTable() — เทสนี้ตรวจแค่ display/active class ไม่ตรวจเนื้อหา kanban เพราะ
//     เป็นขอบเขตของ orders-tab-kanban.js ไม่ใช่ไฟล์นี้)
//   - chart metric toggle (cp-chart-metric > .cchart-range-btn[data-metric]): chartMetric ถูกตั้ง,
//     active class สลับ
//   - chart range toggle (cp-chart-range > .cchart-range-btn[data-range]): chartRange ถูกตั้งเป็น
//     Number (ไม่ใช่ string), active class สลับ
//   - jumpToNewOrders() + stat-card quick-jump listeners (cp-stat-card-production/-completed/
//     -duesoon/-overdue): เรียก onRequestOrdersTabCb, ล้างช่องค้นหา, ตั้ง statusFilterValue หรือ
//     jumpFilter ตามการ์ด, currentPage รีเซ็ต — cp-stat-card-new (jumpToNewOrders เอง) มีเทสการ
//     เรียก onRequestOrdersTabCb ผ่านไปแล้วในรอบ 92 (describe callback registration) — รอบนี้เน้น
//     ตรวจผลลัพธ์ filter ที่ตั้งค่าจริงของทั้ง 5 การ์ด ไม่ใช่แค่ callback ถูกเรียก
//
// ไม่อยู่ในขอบเขต 3b (รอไป 3c): render()/renderTable()/updateOrdersBulkBar()/bulk actions ทั้งหมด/
// confirmDeleteOrder()/showToast()/escapeHtml()/formatBaht() — ไฟล์นี้ใช้ render() แค่เป็นผลข้าง
// เคียงเพื่อตรวจว่าตัวกรอง/toggle ทำงานถูกจุด ไม่ได้ทดสอบ render()/renderTable() เองโดยตรง (เช่น
// ไม่ตรวจ pagination/bulk bar เลย)
//
// สถาปัตยกรรมเทส: เหมือน test/orders-tab-lifecycle-reminders.test.mjs (รอบ 92) ทุกประการ — jsdom +
// import โมดูลครั้งเดียวต่อไฟล์ใน before(), ใช้ triggerOrdersSnapshot() helper แบบเดียวกันเพื่อเติม
// allOrders ก่อนตรวจผลกรองในตาราง, scrollIntoView()/requestAnimationFrame() polyfill เหมือนเดิม
// (จำเป็นเพราะ js/orders-tab.js import orders-tab-modal.js ที่เรียก scrollIntoView() ตอน module
// evaluate เช่นเดียวกับรอบ 92)
//
// ไม่พบบั๊กระหว่างตรวจโค้ดจริงในส่วนที่ทดสอบรอบนี้ (บรรทัด 226-329 ของ js/orders-tab.js) — ไม่มีการ
// แก้ไฟล์โค้ดผลิตภัณฑ์เลยแม้แต่บรรทัดเดียว ไฟล์นี้เป็นไฟล์เทสใหม่ไฟล์เดียวที่เพิ่มในรอบนี้ (ไม่ต้อง
// แก้ firebase-stub-loader.mjs เพิ่มเพราะ __SNAPSHOT_LISTENERS__ ที่เพิ่มไว้แล้วในรอบ 92 พอใช้งานได้
// เลยสำหรับรอบนี้ด้วย)

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

// ยิง fake realtime snapshot ไปที่ listener ล่าสุดที่ผูกกับ collection "orders" (เหมือนรอบ 92 ทุก
// ประการ — ดู test/orders-tab-lifecycle-reminders.test.mjs สำหรับคำอธิบายละเอียด)
function triggerOrdersSnapshot(orders) {
  const cb = globalThis.__SNAPSHOT_LISTENERS__ && globalThis.__SNAPSHOT_LISTENERS__["orders"];
  if (typeof cb !== "function") throw new Error("orders snapshot listener ยังไม่ได้ลงทะเบียน (เรียก initOrdersTab() ก่อนหรือยัง?)");
  cb({ docs: orders.map(o => ({ id: o.id, data: () => { const { id, ...rest } = o; return rest; } })) });
}

// คืนรายการ id ของแถวที่ render จริงในตาราง (tr[data-id] เท่านั้น — แถว "ไม่พบคำสั่งผลิต" ไม่มี
// data-id จึงไม่ถูกนับ)
function renderedRowIds() {
  return Array.from(document.querySelectorAll("#cp-table-body tr[data-id]")).map(tr => tr.dataset.id);
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
  // js/orders-tab-modal.js (import ตรงจากไฟล์นี้ผ่าน orders-tab.js) เรียก scrollIntoView() ตอน
  // switchOdTab() — ต้อง stub ก่อน import เสมอ (เหมือนรอบ 92/91)
  dom.window.HTMLElement.prototype.scrollIntoView = function () {};
  // jumpToOrder() ในไฟล์นี้เรียก requestAnimationFrame() แบบ global ตรงๆ — jsdom เวอร์ชันนี้ไม่มีให้
  // (ดูคำอธิบายเต็มในรอบ 92) — sub-round นี้ไม่ได้ทดสอบ jumpToOrder() เองแต่ import ทั้งไฟล์ต้องผ่าน
  globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);

  mod = await import("../js/orders-tab.js");
  document = dom.window.document;
});

beforeEach(() => {
  resetFirebaseCalls();
  mod.stopOrdersTab(); // เคลียร์ allOrders/unsubscribe/started ก่อนทุกเทส กันเทสก่อนหน้าค้าง state
  mod.initOrdersTab();
  triggerOrdersSnapshot(SAMPLE_ORDERS);
  // รีเซ็ต DOM/สถานะกรองที่ toggle ค้างข้ามเทสได้ (module-level state ไม่มี setter export ยกเว้น
  // currentPage — รีเซ็ตผ่าน DOM event แทนสำหรับตัวอื่น เพื่อไม่ต้องแตะโค้ดผลิตภัณฑ์)
  document.getElementById("cp-search").value = "";
  mod.setCurrentPage(1);
  // สถานะเริ่มต้นของ status pill "ทั้งหมด" ต้องกลับมา active เสมอก่อนแต่ละเทส — คลิกไม่มีเงื่อนไข
  // (ไม่ใช่แค่กรณี pill ยังไม่ active) เพราะ handler ของปุ่มนี้เคลียร์ jumpFilter=null ด้วยเสมอทุก
  // ครั้งที่กด (ดูโค้ดจริงบรรทัด ~247 ของ js/orders-tab.js) — ถ้าเช็คแค่ statusFilterValue==="" ก่อน
  // กด จะพลาดเคสที่ statusFilterValue ว่างอยู่แล้ว (เช่น หลังกดการ์ด duesoon/overdue ที่เรียก
  // setStatusFilter("") เองแล้ว) แต่ jumpFilter ยังค้างอยู่ ทำให้เทสถัดไปเจอ jumpFilter รั่วข้ามเทส
  const allPill = document.querySelector('#cp-filter-status-pills .cp-status-pill[data-status=""]');
  if (allPill) allPill.click();
  // รีเซ็ต mineOnly กลับ false ถ้าเทสก่อนหน้าเปิดค้างไว้
  const mineBtn = document.getElementById("cp-mine-toggle");
  if (mineBtn.classList.contains("active")) mineBtn.click();
  // รีเซ็ต view กลับ table ถ้าเทสก่อนหน้าสลับไป kanban ค้างไว้
  const tableViewBtn = document.querySelector('#cp-view-toggle .cp-view-btn[data-view="table"]');
  if (tableViewBtn && !tableViewBtn.classList.contains("active")) tableViewBtn.click();
});

describe("js/orders-tab.js — search input (รอบที่ 93, Phase 3 sub-round 3b)", () => {
  test("พิมพ์คำค้นกรองตารางเหลือเฉพาะรายการที่ตรง code", () => {
    const searchInput = document.getElementById("cp-search");
    searchInput.value = "PO-0002";
    searchInput.dispatchEvent(new Event("input"));
    assert.deepEqual(renderedRowIds(), ["o2"]);
  });

  test("พิมพ์คำค้นแล้ว currentPage ถูกรีเซ็ตเป็น 1 และ jumpFilter ถูกล้าง", () => {
    mod.jumpToOrderReminder("overdue"); // ตั้ง jumpFilter + currentPage ผ่านช่องทางอื่นไว้ก่อน
    mod.setCurrentPage(3);
    const searchInput = document.getElementById("cp-search");
    searchInput.value = "ลูกค้า";
    searchInput.dispatchEvent(new Event("input"));
    assert.equal(mod.currentPage, 1);
    assert.equal(mod.jumpFilter, null);
  });

  test("ล้างคำค้น (ค่าว่าง) แสดงทุกแถวกลับมาเหมือนเดิม", () => {
    const searchInput = document.getElementById("cp-search");
    searchInput.value = "PO-0002";
    searchInput.dispatchEvent(new Event("input"));
    assert.deepEqual(renderedRowIds(), ["o2"]);
    searchInput.value = "";
    searchInput.dispatchEvent(new Event("input"));
    assert.deepEqual(renderedRowIds().sort(), ["o1", "o2", "o3"]);
  });
});

describe("js/orders-tab.js — mineOnly toggle: cp-mine-toggle (รอบที่ 93)", () => {
  test("กดครั้งแรก: mineOnly เป็น true, ปุ่มได้ class active, currentPage รีเซ็ตเป็น 1", () => {
    mod.setCurrentPage(3);
    const mineBtn = document.getElementById("cp-mine-toggle");
    mineBtn.click();
    assert.equal(mod.mineOnly, true);
    assert.equal(mineBtn.classList.contains("active"), true);
    assert.equal(mod.currentPage, 1);
  });

  test("mineOnly=true กรองทุกแถวออกหมด เพราะ auth.currentUser เป็น null เสมอตาม stub (currentUserUid เป็น null ⇒ ไม่มี assignee ไหนตรง)", () => {
    document.getElementById("cp-mine-toggle").click();
    assert.deepEqual(renderedRowIds(), []);
  });

  test("กดซ้ำครั้งที่สอง: mineOnly กลับเป็น false, class active ถูกถอด, แถวกลับมาแสดงครบ", () => {
    const mineBtn = document.getElementById("cp-mine-toggle");
    mineBtn.click();
    mineBtn.click();
    assert.equal(mod.mineOnly, false);
    assert.equal(mineBtn.classList.contains("active"), false);
    assert.deepEqual(renderedRowIds().sort(), ["o1", "o2", "o3"]);
  });
});

describe("js/orders-tab.js — status pills: cp-filter-status-pills (รอบที่ 93)", () => {
  test("กด pill 'กำลังผลิต' (data-status=production): กรองเหลือแถว status ตรงกัน, pill ได้ active+aria-selected=true, pill อื่นถูกถอด", () => {
    const pills = Array.from(document.querySelectorAll("#cp-filter-status-pills .cp-status-pill"));
    const productionPill = pills.find(p => p.dataset.status === "production");
    productionPill.click();

    assert.equal(mod.statusFilterValue, "production");
    assert.equal(productionPill.classList.contains("active"), true);
    assert.equal(productionPill.getAttribute("aria-selected"), "true");
    pills.filter(p => p !== productionPill).forEach(p => {
      assert.equal(p.classList.contains("active"), false);
      assert.equal(p.getAttribute("aria-selected"), "false");
    });
    assert.deepEqual(renderedRowIds(), ["o2"]);
  });

  test("กด pill แล้ว jumpFilter ถูกล้างและ currentPage รีเซ็ตเป็น 1", () => {
    mod.jumpToOrderReminder("duesoon");
    mod.setCurrentPage(2);
    const receivedPill = document.querySelector('#cp-filter-status-pills .cp-status-pill[data-status="received"]');
    receivedPill.click();
    assert.equal(mod.jumpFilter, null);
    assert.equal(mod.currentPage, 1);
  });

  test("กด pill 'ทั้งหมด' (data-status=\"\") กลับมาแสดงทุกแถว", () => {
    const productionPill = document.querySelector('#cp-filter-status-pills .cp-status-pill[data-status="production"]');
    productionPill.click();
    assert.deepEqual(renderedRowIds(), ["o2"]);
    const allPill = document.querySelector('#cp-filter-status-pills .cp-status-pill[data-status=""]');
    allPill.click();
    assert.equal(mod.statusFilterValue, "");
    assert.deepEqual(renderedRowIds().sort(), ["o1", "o2", "o3"]);
  });
});

describe("js/orders-tab.js — view toggle table/kanban: cp-view-toggle (รอบที่ 93)", () => {
  test("กดปุ่ม 'kanban': ปุ่มได้ active, tableView ถูกซ่อน, kanbanView ถูกแสดง, currentPage รีเซ็ต", () => {
    mod.setCurrentPage(2);
    const kanbanBtn = document.querySelector('#cp-view-toggle .cp-view-btn[data-view="kanban"]');
    const tableBtn = document.querySelector('#cp-view-toggle .cp-view-btn[data-view="table"]');
    kanbanBtn.click();

    assert.equal(kanbanBtn.classList.contains("active"), true);
    assert.equal(tableBtn.classList.contains("active"), false);
    assert.equal(document.getElementById("cp-table-view").style.display, "none");
    assert.equal(document.getElementById("cp-kanban-view").style.display, "");
    assert.equal(mod.currentPage, 1);
  });

  test("กดปุ่ม 'table' หลังสลับไป kanban แล้ว: สลับกลับมาแสดงตาราง ซ่อน kanban", () => {
    const kanbanBtn = document.querySelector('#cp-view-toggle .cp-view-btn[data-view="kanban"]');
    const tableBtn = document.querySelector('#cp-view-toggle .cp-view-btn[data-view="table"]');
    kanbanBtn.click();
    tableBtn.click();

    assert.equal(tableBtn.classList.contains("active"), true);
    assert.equal(kanbanBtn.classList.contains("active"), false);
    assert.equal(document.getElementById("cp-table-view").style.display, "");
    assert.equal(document.getElementById("cp-kanban-view").style.display, "none");
  });

  test("มุมมอง kanban: pagination box ถูกซ่อน (paginationBox.style.display = 'none')", () => {
    document.querySelector('#cp-view-toggle .cp-view-btn[data-view="kanban"]').click();
    assert.equal(document.getElementById("cp-pagination").style.display, "none");
  });
});

describe("js/orders-tab.js — chart metric toggle: cp-chart-metric (รอบที่ 93)", () => {
  test("ค่าเริ่มต้น chartMetric = 'count' ตาม HTML (ปุ่ม data-metric=count มี class active อยู่แล้ว)", () => {
    const countBtn = document.querySelector('#cp-chart-metric .cchart-range-btn[data-metric="count"]');
    assert.equal(countBtn.classList.contains("active"), true);
    assert.equal(mod.chartMetric, "count");
  });

  test("กดปุ่ม 'รายได้' (data-metric=revenue): chartMetric เปลี่ยนเป็น 'revenue', active class สลับ", () => {
    const revenueBtn = document.querySelector('#cp-chart-metric .cchart-range-btn[data-metric="revenue"]');
    const countBtn = document.querySelector('#cp-chart-metric .cchart-range-btn[data-metric="count"]');
    revenueBtn.click();
    assert.equal(mod.chartMetric, "revenue");
    assert.equal(revenueBtn.classList.contains("active"), true);
    assert.equal(countBtn.classList.contains("active"), false);
    revenueBtn.click(); // กดซ้ำ (ปุ่มเดิม) — ยังคง revenue, active class ไม่เปลี่ยน
    assert.equal(mod.chartMetric, "revenue");
    assert.equal(revenueBtn.classList.contains("active"), true);
    countBtn.click(); // กลับมา count เพื่อไม่ให้ค้างข้ามเทสอื่น (chartMetric ไม่มี setter/reset ผ่าน DOM อื่น)
    assert.equal(mod.chartMetric, "count");
  });
});

describe("js/orders-tab.js — chart range toggle: cp-chart-range (รอบที่ 93)", () => {
  test("ค่าเริ่มต้น chartRange = 7 ตาม HTML (ปุ่ม data-range=7 มี class active อยู่แล้ว)", () => {
    const btn7 = document.querySelector('#cp-chart-range .cchart-range-btn[data-range="7"]');
    assert.equal(btn7.classList.contains("active"), true);
    assert.equal(mod.chartRange, 7);
  });

  test("กดปุ่ม '30 วัน': chartRange เปลี่ยนเป็น Number 30 (ไม่ใช่ string \"30\"), active class สลับ", () => {
    const btn30 = document.querySelector('#cp-chart-range .cchart-range-btn[data-range="30"]');
    const btn7 = document.querySelector('#cp-chart-range .cchart-range-btn[data-range="7"]');
    btn30.click();
    assert.equal(mod.chartRange, 30);
    assert.equal(typeof mod.chartRange, "number");
    assert.equal(btn30.classList.contains("active"), true);
    assert.equal(btn7.classList.contains("active"), false);
    btn7.click(); // กลับมา 7 เพื่อไม่ให้ค้างข้ามเทสอื่น (chartRange ไม่มี setter/reset ผ่าน DOM อื่น)
    assert.equal(mod.chartRange, 7);
  });
});

describe("js/orders-tab.js — stat-card quick-jump listeners (รอบที่ 93)", () => {
  test("cp-stat-card-production: setStatusFilter('production'), ล้างค้นหา/jumpFilter, currentPage รีเซ็ต, เรียก onRequestOrdersTabCb", () => {
    let called = false;
    mod.onRequestOrdersTab(() => { called = true; });
    document.getElementById("cp-search").value = "ค้างจากก่อนหน้า";
    mod.jumpToOrderReminder("overdue");
    mod.setCurrentPage(2);

    document.getElementById("cp-stat-card-production").click();

    assert.equal(called, true);
    assert.equal(document.getElementById("cp-search").value, "");
    assert.equal(mod.jumpFilter, null);
    assert.equal(mod.statusFilterValue, "production");
    assert.equal(mod.currentPage, 1);
    assert.deepEqual(renderedRowIds(), ["o2"]);
  });

  test("cp-stat-card-completed: setStatusFilter('completed')", () => {
    document.getElementById("cp-stat-card-completed").click();
    assert.equal(mod.statusFilterValue, "completed");
    assert.deepEqual(renderedRowIds(), ["o3"]);
  });

  test("cp-stat-card-duesoon: jumpFilter='duesoon', statusFilterValue ถูกล้างเป็น ''", () => {
    // ตั้ง statusFilterValue ไว้ก่อนเพื่อยืนยันว่าถูกล้างจริง
    document.querySelector('#cp-filter-status-pills .cp-status-pill[data-status="received"]').click();
    assert.equal(mod.statusFilterValue, "received");

    document.getElementById("cp-stat-card-duesoon").click();

    assert.equal(mod.jumpFilter, "duesoon");
    assert.equal(mod.statusFilterValue, "");
  });

  test("cp-stat-card-overdue: jumpFilter='overdue', statusFilterValue ถูกล้างเป็น ''", () => {
    document.querySelector('#cp-filter-status-pills .cp-status-pill[data-status="production"]').click();
    assert.equal(mod.statusFilterValue, "production");

    document.getElementById("cp-stat-card-overdue").click();

    assert.equal(mod.jumpFilter, "overdue");
    assert.equal(mod.statusFilterValue, "");
  });

  test("cp-stat-card-duesoon/-overdue ก็เรียก onRequestOrdersTabCb และล้างช่องค้นหาเหมือนกัน", () => {
    let calls = 0;
    mod.onRequestOrdersTab(() => { calls++; });
    document.getElementById("cp-search").value = "xyz";
    document.getElementById("cp-stat-card-duesoon").click();
    assert.equal(calls, 1);
    assert.equal(document.getElementById("cp-search").value, "");

    document.getElementById("cp-search").value = "xyz";
    document.getElementById("cp-stat-card-overdue").click();
    assert.equal(calls, 2);
    assert.equal(document.getElementById("cp-search").value, "");
  });
});
