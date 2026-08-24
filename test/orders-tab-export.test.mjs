// test/orders-tab-export.test.mjs — รอบที่ 97 (Phase 5/6: export/print, js/orders-tab-export.js)
//
// ขอบเขตของไฟล์นี้ จาก js/orders-tab-export.js (102 บรรทัด — ยังไม่เคยมีเทสไฟล์ไหนครอบคลุมเลยทั้งไฟล์
// ก่อนรอบนี้ — ยืนยันด้วย grep ทั้งโปรเจกต์แล้วว่าไม่มีไฟล์เทสไหนอ้างถึงชื่อไฟล์นี้เลยนอกจากคอมเมนต์):
//   - ปุ่ม "ส่งออก CSV" (#cp-export-csv-btn): getCurrentFilteredRows() ว่างเปล่า -> showToast error
//     "ไม่มีข้อมูลให้ส่งออก" ไม่สร้าง Blob เลย — มีข้อมูล -> สร้าง Blob (BOM "\uFEFF" + header row
//     (ไม่ผ่าน csvCell) + data rows (ทุก field string ผ่าน csvCell ยกเว้น qty/progress/orderBalance
//     เป็นตัวเลขดิบ) คั่นด้วย "\r\n") -> URL.createObjectURL() -> สร้าง <a download> ชั่วคราว ->
//     click() -> remove() -> URL.revokeObjectURL() -> showToast success "ส่งออก CSV แล้ว"
//   - ปุ่ม "พิมพ์รายงาน" (#cp-print-btn): สร้าง HTML รายงานใส่ #cp-print-report (h1 + สรุปตัวเลข
//     สถิติจาก computeOrderStats(getAllOrders()) [ทั้งหมด, ไม่ใช่ filtered] + ตารางจาก
//     getCurrentFilteredRows() [filtered] — ทุก field ผ่าน escapeHtml() — ไม่มีการเช็ค rows ว่างเปล่า
//     เลย (ต่างจากปุ่ม CSV) แล้วเรียก window.print() เสมอไม่ว่า filtered rows จะว่างหรือไม่
//   - getCurrentFilteredRows() (ฟังก์ชัน internal ใช้ร่วมกันทั้ง 2 ปุ่ม): กรอง getAllOrders() ด้วย
//     pendingDeleteOrderIds (ตัดออก) -> search term (code/customer/item, case-insensitive) ->
//     statusFilterValue -> jumpFilter ("duesoon"/"overdue" ผ่าน orderUrgency()) -> mineOnly
//     (assignee === auth.currentUser.uid — auth.currentUser เป็น null เสมอตาม stub default จึงกรอง
//     ทุกแถวออกหมดเสมอเมื่อ mineOnly=true ตามที่บันทึกไว้ใน test/orders-tab-filters-toggles.test.mjs)
//
// สถาปัตยกรรมเทส: เหมือน test/orders-tab-kanban.test.mjs (รอบ 96) ทุกประการ — jsdom + import
// js/orders-tab.js ครั้งเดียวต่อไฟล์ใน before() (import ไฟล์นี้แทนที่จะ import
// js/orders-tab-export.js ตรงๆ เพราะ js/orders-tab-export.js เป็น side-effect module ที่ถูก import
// เข้าไปแล้วที่บรรทัด 82 ของ js/orders-tab.js — ทั้งสองไฟล์อยู่ใน module cache เดียวกันไม่ว่าจะ
// import จากไฟล์ไหนก็ตาม — ปุ่ม export/print ผูก listener ไว้ระดับบนสุดของไฟล์ (module load time)
// ไม่ได้อยู่ใน initOrdersTab() จึงพร้อมใช้ได้ทันทีหลัง import แต่ต้องเรียก initOrdersTab() +
// triggerOrdersSnapshot() ก่อนเพื่อให้ getAllOrders() มีข้อมูลให้อ่าน)
//
// ตรวจโค้ดจริงก่อนเขียนไฟล์นี้แล้ว (js/orders-tab-export.js ทั้งไฟล์ + ส่วนที่เกี่ยวข้องของ
// js/orders-tab.js: mineOnly/statusFilterValue/jumpFilter/pendingDeleteOrderIds — ทุกตัวเป็น
// module-level `let`/`const` export หน้าตัวแปรตรงๆ อ่านอย่างเดียวจากไฟล์นี้ ไม่มี setter, การ
// รีเซ็ตระหว่างเทสต้องทำผ่านคลิกปุ่ม/DOM จริงเท่านั้น ยกเว้น pendingDeleteOrderIds ที่เป็น Set
// (const) เรียก .add()/.clear() ตรงๆ ได้เพราะเป็นการ mutate object เดิมไม่ใช่ reassign) +
// js/db-orders-stats.js (computeOrderStats()/orderUrgency()/orderBalance()) + js/db.js (auth) —
// ไม่พบบั๊ก จึงเป็นไฟล์เทสล้วนๆ ไม่มีการแก้โค้ดผลิตภัณฑ์เลยแม้แต่บรรทัดเดียว
//
// สภาพแวดล้อม jsdom ที่ต้องจัดการเป็นพิเศษ (ตรวจแล้วก่อนเขียนตามที่ NEXT-ROUND-PROMPT.txt ท้ายรอบ
// 96 สั่งเตือนไว้เรื่อง Blob/URL.createObjectURL/window.print()):
//   - Blob/URL.createObjectURL()/URL.revokeObjectURL() ที่ js/orders-tab-export.js เรียกแบบ
//     unqualified (ไม่ import) resolve ไปที่ global ของ Node โดยตรง (ไม่ใช่ของ jsdom เลย เพราะ
//     ไฟล์เทสไม่เคยตั้ง globalThis.Blob/globalThis.URL ให้ชี้ไป dom.window) — และ Node (v22 ในนี้)
//     มี Blob/URL.createObjectURL/revokeObjectURL ใน global ให้ใช้ได้จริงอยู่แล้ว (ต่างจาก jsdom เอง
//     ที่ไม่ implement URL.createObjectURL/revokeObjectURL เลย — ยืนยันด้วยการรันสคริปต์ทดสอบแยก
//     ก่อนเขียนไฟล์นี้) จึงไม่ต้อง stub อะไรเพิ่มสำหรับให้โค้ดรันได้ — แค่ monkey-patch
//     globalThis.Blob (extend เก็บ parts/opts ที่ constructor เห็น) + URL.createObjectURL/
//     revokeObjectURL (wrap เก็บ call log) เพื่อ "สอดแนม" สำหรับเทสเฉยๆ ไม่ใช่เพื่อให้โค้ดรันได้
//   - ข้อสังเกตสำคัญ: Blob.prototype.text() ของ Node จะ "ตัด BOM (\uFEFF) ทิ้งอัตโนมัติ" ตอน decode
//     กลับเป็น string (TextDecoder default ignoreBOM=false = ตัด BOM ทิ้งเสมอถ้าเจอ ตาม WHATWG
//     Encoding spec) แม้ว่า Blob ตอนสร้างจะได้รับ string ที่มี "\uFEFF" นำหน้าจริงก็ตาม — ยืนยันด้วย
//     สคริปต์ทดสอบแยก (new Blob(["\uFEFFhello"]).text() ได้ "hello" ไม่มี BOM, length ต่างกัน 1 ตัว)
//     ดังนั้นเทสที่ต้องยืนยันว่ามี BOM นำหน้าจริง ต้องเช็คจาก "parts ดิบที่ constructor เห็น" (สอดแนม
//     ไว้) ไม่ใช่เช็คจากผลลัพธ์ของ .text() เพราะจะไม่เจอ BOM แม้โค้ดถูกต้องก็ตาม
//   - <a>.click() ของ jsdom: ปกติจะพยายาม navigate จริงและ log
//     "Not implemented: navigation to another Document" ออก stderr (ไม่ throw แต่รก log) แม้จะตั้ง
//     .download ไว้ก็ตาม (jsdom ไม่รู้จัก download attribute พิเศษ) — แก้โดย stub
//     HTMLAnchorElement.prototype.click ให้เป็น no-op (แค่บันทึกว่าถูกเรียก) แบบเดียวกับที่ stub
//     scrollIntoView ในรอบก่อนๆ — ปลอดภัยเพราะ side-effect จริงที่ต้องเทส (Blob/download filename)
//     เกิดขึ้น "ก่อน" a.click() ถูกเรียกอยู่แล้วในโค้ดจริง ไม่ได้พึ่งผลของ click() เอง
//   - window.print(): jsdom ไม่ implement จริง (log "Not implemented: Window's print() method" ออก
//     stderr เฉยๆ ไม่ throw) — stub ให้เป็น no-op ที่นับจำนวนครั้งที่ถูกเรียกแทน กันรก log และให้เทส
//     ยืนยันได้ว่าถูกเรียกจริง

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
let mod; // orders-tab.js exports ทั้งหมด (orders-tab-export.js ถูก import แบบ side-effect อยู่แล้ว)

// ── สอดแนม Blob / URL.createObjectURL / URL.revokeObjectURL (ของจริงจาก Node global) ──
let lastBlobParts, lastBlobOptions, lastBlobRef;
let createObjectURLCalls, revokeObjectURLCalls;
const OriginalBlob = globalThis.Blob;
const originalCreateObjectURL = globalThis.URL.createObjectURL.bind(globalThis.URL);
const originalRevokeObjectURL = globalThis.URL.revokeObjectURL.bind(globalThis.URL);

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

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
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
  dom.window.HTMLElement.prototype.scrollIntoView = function () {};
  globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);

  // stub <a>.click() กัน jsdom navigation-not-implemented log (ดูหมายเหตุหัวไฟล์)
  let anchorClickCount = 0;
  dom.window.HTMLAnchorElement.prototype.click = function () { anchorClickCount++; this.__clicked = anchorClickCount; };
  globalThis.__lastAnchorClickCount = () => anchorClickCount;

  // สอดแนมการสร้าง <a> เพื่ออ่าน href/download หลังจากถูกลบออกจาก DOM ไปแล้ว (ตัวแปร reference ยัง
  // ใช้ได้ปกติแม้ .remove() ไปแล้ว เพราะแค่ตัดออกจาก DOM tree ไม่ได้ทำลาย object)
  const originalCreateElement = dom.window.document.createElement.bind(dom.window.document);
  globalThis.__lastAnchor = null;
  dom.window.document.createElement = function (tag) {
    const el = originalCreateElement(tag);
    if (String(tag).toLowerCase() === "a") globalThis.__lastAnchor = el;
    return el;
  };

  // stub window.print() กัน jsdom not-implemented log + นับจำนวนครั้งที่ถูกเรียก
  let printCount = 0;
  dom.window.print = function () { printCount++; };
  globalThis.__printCallCount = () => printCount;
  globalThis.__resetPrintCallCount = () => { printCount = 0; };

  mod = await import("../js/orders-tab.js");
  document = dom.window.document;
});

beforeEach(() => {
  resetFirebaseCalls();
  mod.stopOrdersTab();
  mod.initOrdersTab();
  triggerOrdersSnapshot(SAMPLE_ORDERS);
  mod.setCurrentPage(1);

  // รีเซ็ตตัวกรอง (module-level state ไม่มี setter export — ต้องรีเซ็ตผ่านคลิก DOM จริงเท่านั้น
  // ตามที่บันทึกไว้ในรอบก่อนๆ ว่า state พวกนี้รั่วข้ามเทสได้ถ้าไม่ระวัง)
  document.getElementById("cp-search").value = "";
  document.querySelector('.cp-status-pill[data-status=""]').click(); // รีเซ็ต statusFilterValue="" + jumpFilter=null (ตามโค้ดจริง)
  const mineBtn = document.getElementById("cp-mine-toggle");
  if (mineBtn.classList.contains("active")) mineBtn.click(); // รีเซ็ต mineOnly=false
  mod.pendingDeleteOrderIds.clear();

  // ปิด toast/overlay ที่อาจค้างจากเทสก่อนหน้า
  document.querySelectorAll(".cp-toast-wrap .cp-toast").forEach(el => el.remove());
  const overlay = document.querySelector(".cp-confirm-overlay");
  if (overlay && overlay.style.display === "flex") overlay.querySelector("#cp-confirm-cancel").click();
  const orderOverlay = document.getElementById("cp-order-overlay");
  if (orderOverlay && orderOverlay.style.display === "flex") document.getElementById("cp-order-cancel").click();

  // เคลียร์รายงานพิมพ์ที่ค้างจากเทสก่อนหน้า + รีเซ็ตตัวนับ
  document.getElementById("cp-print-report").innerHTML = "";
  globalThis.__resetPrintCallCount();

  // ติดตั้งสอดแนม Blob/URL ใหม่ทุกเทส (เก็บค่าล่าสุดเท่านั้น)
  lastBlobParts = lastBlobOptions = lastBlobRef = null;
  createObjectURLCalls = [];
  revokeObjectURLCalls = [];
  class SpyBlob extends OriginalBlob {
    constructor(parts, opts) {
      super(parts, opts);
      lastBlobParts = parts;
      lastBlobOptions = opts;
      lastBlobRef = this;
    }
  }
  globalThis.Blob = SpyBlob;
  globalThis.URL.createObjectURL = (blob) => { createObjectURLCalls.push(blob); return originalCreateObjectURL(blob); };
  globalThis.URL.revokeObjectURL = (url) => { revokeObjectURLCalls.push(url); return originalRevokeObjectURL(url); };
  globalThis.__lastAnchor = null;
});

const SAMPLE_ORDERS = [
  { id: "o1", code: "PO-1001", customer: "ลูกค้า A", item: "ป้ายไฟ LED", category: "ป้ายไฟ", qty: 2,
    status: "received", progress: 10, dueDate: dateOffset(10),
    unit_price: 1000, discount: 0, vatIncluded: true, shippingCost: 0, deposit: 0, paymentStatus: "unpaid",
    assignee: "uid-someone-else" },
  { id: "o2", code: "PO-1002", customer: "ลูกค้า B", item: "ป้ายอะคริลิก", category: "ป้ายอะคริลิก", qty: 1,
    status: "production", progress: 50, dueDate: dateOffset(-3), // overdue (active)
    unit_price: 500, discount: 0, vatIncluded: true, shippingCost: 0, deposit: 200, paymentStatus: "deposit_paid" },
  { id: "o3", code: "PO-1003", customer: "ลูกค้า C", item: "ป้ายสแตนเลส", category: "ป้ายสแตนเลส", qty: 5,
    status: "qc", progress: 80, dueDate: dateOffset(1), // due-soon (active)
    unit_price: 200, discount: 0, vatIncluded: true, shippingCost: 0, deposit: 0, paymentStatus: "paid_full" },
  { id: "o4", code: "PO-1004", customer: "ลูกค้า D", item: "ป้ายกล่องไฟ", qty: 3, // category ไม่มี (ทดสอบ fallback ว่าง)
    status: "completed", progress: 100, dueDate: dateOffset(-10), // completed -> ไม่ urgent แม้เลยกำหนด
    unit_price: 300, discount: 0, vatIncluded: true, shippingCost: 0, deposit: 0, paymentStatus: "unpaid" },
];

// ยอดคงเหลือที่คาดไว้ (คำนวณมือจาก orderBalance()/orderGrandTotal() ตามสูตรจริงใน db-orders-stats.js
// — vatIncluded:true ทุกตัว จึงไม่มีการคูณ 1.07): o1=2000(unpaid) o2=300(500-200 deposit) o3=0(paid_full) o4=900(unpaid)
const CSV_HEADER = "เลขที่คำสั่ง,ลูกค้า,รายการ,หมวดป้าย,จำนวน,สถานะ,ความคืบหน้า(%),กำหนดส่ง,สถานะการชำระเงิน,ยอดค้างชำระ (บาท)";
function csvRow(o, statusLabel, balance, paymentLabel) {
  const q = (s) => `"${String(s ?? "").replace(/"/g, '""')}"`;
  return [q(o.code), q(o.customer), q(o.item), q(o.category), o.qty ?? "", q(statusLabel),
          o.progress ?? 0, q(o.dueDate), q(paymentLabel), balance].join(",");
}

function exportCsv() { document.getElementById("cp-export-csv-btn").click(); }
function printReport() { document.getElementById("cp-print-btn").click(); }
function lastToast(kind) {
  const els = document.querySelectorAll(`.cp-toast-wrap .cp-toast.${kind}`);
  return els.length ? els[els.length - 1] : null;
}
function clickStatusPill(status) { document.querySelector(`.cp-status-pill[data-status="${status}"]`).click(); }

describe("js/orders-tab-export.js — ปุ่ม 'ส่งออก CSV' (รอบที่ 97)", () => {
  test("ไม่มีข้อมูลให้ส่งออก (ผลค้นหาว่างเปล่า): แสดง toast error, ไม่สร้าง Blob เลย", () => {
    document.getElementById("cp-search").value = "ไม่มีทางเจอข้อความนี้แน่ๆ";
    exportCsv();

    assert.equal(lastBlobRef, null, "ต้องไม่มีการสร้าง Blob เลยเมื่อไม่มีแถวให้ส่งออก");
    assert.deepEqual(createObjectURLCalls, []);
    const t = lastToast("error");
    assert.ok(t, "ต้องมี toast error");
    assert.equal(t.textContent, "ไม่มีข้อมูลให้ส่งออก");
  });

  test("mineOnly=true กรองทุกแถวออกหมด (auth.currentUser เป็น null ตาม stub เสมอ) -> ก็ถือว่าไม่มีข้อมูลให้ส่งออกเหมือนกัน", () => {
    document.getElementById("cp-mine-toggle").click(); // mineOnly = true
    exportCsv();

    assert.equal(lastBlobRef, null);
    assert.equal(lastToast("error").textContent, "ไม่มีข้อมูลให้ส่งออก");
  });

  test("ส่งออกทั้งหมดไม่มีตัวกรอง: Blob มี BOM นำหน้า + header row ไม่ผ่าน csvCell + data row ตรงตามสูตรทุก field, เรียง 4 แถวตามลำดับ getAllOrders()", () => {
    exportCsv();

    assert.equal(lastBlobParts.length, 1, "โค้ดจริงส่ง array พาร์ทเดียวเข้า Blob constructor");
    const raw = lastBlobParts[0];
    assert.equal(raw.charCodeAt(0), 0xFEFF, "ตัวอักษรแรกต้องเป็น BOM (\\uFEFF) ตามโค้ดจริง — เช็คจาก parts ดิบ ไม่ใช่จาก .text() เพราะ Node ตัด BOM ทิ้งตอน decode");
    const body = raw.slice(1); // ตัด BOM ออกเพื่อเทียบเนื้อหาที่เหลือ
    const lines = body.split("\r\n");
    assert.equal(lines[0], CSV_HEADER);
    assert.equal(lines.length, 5); // header + 4 orders
    assert.equal(lines[1], csvRow(SAMPLE_ORDERS[0], "รับงาน", 2000, "ยังไม่ชำระ"));
    assert.equal(lines[2], csvRow(SAMPLE_ORDERS[1], "กำลังผลิต", 300, "มัดจำแล้ว"));
    assert.equal(lines[3], csvRow(SAMPLE_ORDERS[2], "ตรวจสอบคุณภาพ (QC)", 0, "ชำระครบแล้ว"));
    assert.equal(lines[4], csvRow(SAMPLE_ORDERS[3], "เสร็จสิ้น", 900, "ยังไม่ชำระ"), "o4 ไม่มี category -> csvCell(undefined) ต้องได้ค่าว่างในเครื่องหมายคำพูด");

    assert.equal(lastBlobOptions.type, "text/csv;charset=utf-8;");
  });

  test("Blob ที่สร้างถูกส่งเข้า URL.createObjectURL() ตัวเดียวกันจริง + สร้าง <a download> ชั่วคราวถูกต้อง + click() + ลบออกจาก DOM + revokeObjectURL() + toast success", () => {
    exportCsv();

    assert.equal(createObjectURLCalls.length, 1);
    assert.equal(createObjectURLCalls[0], lastBlobRef, "URL.createObjectURL() ต้องถูกเรียกด้วย Blob ตัวเดียวกับที่สร้างไว้");

    const a = globalThis.__lastAnchor;
    assert.ok(a, "ต้องมีการสร้าง <a> element");
    assert.equal(a.download, `production-orders-${todayIsoDate()}.csv`);
    assert.equal(a.tagName, "A");
    assert.ok(a.__clicked, "ต้องเรียก a.click()");
    assert.equal(document.body.contains(a), false, "a ต้องถูก remove() ออกจาก DOM แล้วหลังคลิก");

    assert.equal(revokeObjectURLCalls.length, 1, "ต้องเรียก URL.revokeObjectURL() เคลียร์ทิ้ง 1 ครั้งหลังใช้เสร็จ");
    assert.equal(revokeObjectURLCalls[0], a.href, "revokeObjectURL() ต้องถูกเรียกด้วย url เดียวกับที่ตั้งเป็น a.href");

    const t = lastToast("success");
    assert.ok(t);
    assert.equal(t.textContent, "ส่งออก CSV แล้ว");
  });

  test("กรองด้วยคำค้นหา (case-insensitive, ตรงกับ code/customer/item อย่างใดอย่างหนึ่ง): ส่งออกเฉพาะแถวที่ตรง", () => {
    document.getElementById("cp-search").value = "po-1002"; // ตรงกับ code o2 (ตัวเล็ก)
    exportCsv();

    const lines = lastBlobParts[0].slice(1).split("\r\n");
    assert.equal(lines.length, 2); // header + 1 แถว
    assert.equal(lines[1], csvRow(SAMPLE_ORDERS[1], "กำลังผลิต", 300, "มัดจำแล้ว"));
  });

  test("กรองด้วยสถานะ (statusFilterValue ผ่านการคลิก status pill): ส่งออกเฉพาะสถานะที่เลือก", () => {
    clickStatusPill("qc");
    exportCsv();

    const lines = lastBlobParts[0].slice(1).split("\r\n");
    assert.equal(lines.length, 2);
    assert.equal(lines[1], csvRow(SAMPLE_ORDERS[2], "ตรวจสอบคุณภาพ (QC)", 0, "ชำระครบแล้ว"));
  });

  test("กรองด้วย jumpFilter='overdue' (กดการ์ด 'เกินกำหนด'): ส่งออกเฉพาะงานที่ยังไม่จบ+เลยกำหนดจริง (ไม่รวม o4 แม้ dueDate เลยมานานเพราะ completed แล้ว)", () => {
    document.getElementById("cp-stat-card-overdue").click();
    exportCsv();

    const lines = lastBlobParts[0].slice(1).split("\r\n");
    assert.equal(lines.length, 2);
    assert.equal(lines[1], csvRow(SAMPLE_ORDERS[1], "กำลังผลิต", 300, "มัดจำแล้ว"));
  });

  test("กรองด้วย jumpFilter='duesoon' (กดการ์ด 'ใกล้ครบกำหนด'): ส่งออกเฉพาะงานที่ยังไม่จบ+ใกล้ครบกำหนดจริง", () => {
    document.getElementById("cp-stat-card-duesoon").click();
    exportCsv();

    const lines = lastBlobParts[0].slice(1).split("\r\n");
    assert.equal(lines.length, 2);
    assert.equal(lines[1], csvRow(SAMPLE_ORDERS[2], "ตรวจสอบคุณภาพ (QC)", 0, "ชำระครบแล้ว"));
  });

  test("pendingDeleteOrderIds ตัดรายการที่กำลังรอ 'เลิกทำ' ออกจากผลส่งออกด้วย (แม้ยังไม่ถูกลบจริงจาก getAllOrders())", () => {
    mod.pendingDeleteOrderIds.add("o2");
    exportCsv();

    const lines = lastBlobParts[0].slice(1).split("\r\n");
    assert.equal(lines.length, 4); // header + 3 (ไม่มี o2)
    assert.equal(lines.some(l => l.includes("PO-1002")), false);
  });
});

describe("js/orders-tab-export.js — ปุ่ม 'พิมพ์รายงาน' (รอบที่ 97)", () => {
  test("ไม่มีการเช็คแถวว่างเลย (ต่างจากปุ่ม CSV): พิมพ์ได้แม้ filter จนไม่เหลือแถวเดียว", () => {
    document.getElementById("cp-search").value = "ไม่มีทางเจอข้อความนี้แน่ๆ";
    printReport();

    assert.equal(globalThis.__printCallCount(), 1, "window.print() ต้องถูกเรียกแม้ filtered rows ว่างเปล่า");
    const box = document.getElementById("cp-print-report");
    const rowsInTable = box.querySelectorAll("tbody tr");
    assert.equal(rowsInTable.length, 0);
    assert.ok(box.querySelector("table"), "โครง table ยังต้องถูกสร้างแม้ไม่มีแถวข้อมูล");
  });

  test("พิมพ์ทั้งหมดไม่มีตัวกรอง: h1/header ตาราง/จำนวนแถว ถูกต้อง, สรุปตัวเลขสถิติมาจาก allOrders ทั้งหมด (ไม่ใช่ filtered)", () => {
    printReport();

    const box = document.getElementById("cp-print-report");
    assert.equal(box.querySelector("h1").textContent, "รายงานคำสั่งผลิต — CS.SIGN");

    const ths = [...box.querySelectorAll("thead th")].map(th => th.textContent);
    assert.deepEqual(ths, ["เลขที่คำสั่ง","ลูกค้า","รายการ","จำนวน","สถานะ","ความคืบหน้า","กำหนดส่ง","สถานะการชำระเงิน","ยอดค้างชำระ"]);

    const rows = box.querySelectorAll("tbody tr");
    assert.equal(rows.length, 4);

    // สถิติสรุป: activeCount=3 (o1,o2,o3 ไม่รวม o4 completed), overdueCount=1 (เฉพาะ o2), dueSoonCount=1 (เฉพาะ o3)
    const sub = box.querySelector(".cp-print-sub").textContent;
    assert.match(sub, /ทั้งหมด 4 รายการ \(จากทั้งหมด 4 รายการ\)/);
    assert.match(sub, /กำลังดำเนินการ 3/);
    assert.match(sub, /เกินกำหนด 1/);
    assert.match(sub, /ใกล้ครบกำหนด 1/);

    assert.equal(globalThis.__printCallCount(), 1);
  });

  test("ตัวกรองมีผลแค่กับจำนวนแถวในตาราง ('ทั้งหมด X รายการ') ไม่กระทบตัวเลขสถิติรวม (ยังคำนวณจาก getAllOrders() ทั้งหมดเสมอ)", () => {
    clickStatusPill("production"); // เหลือแค่ o2
    printReport();

    const box = document.getElementById("cp-print-report");
    assert.equal(box.querySelectorAll("tbody tr").length, 1);
    const sub = box.querySelector(".cp-print-sub").textContent;
    assert.match(sub, /ทั้งหมด 1 รายการ \(จากทั้งหมด 4 รายการ\)/);
    assert.match(sub, /กำลังดำเนินการ 3/, "สถิติรวมต้องไม่ถูกกรองตาม statusFilterValue");
    assert.match(sub, /เกินกำหนด 1/);
    assert.match(sub, /ใกล้ครบกำหนด 1/);
  });

  test("escapeHtml() ทุก field ในตารางรายงาน (customer/item/dueDate/สถานะการชำระเงิน/สถานะ) กัน HTML injection", () => {
    triggerOrdersSnapshot([
      { id: "x1", code: "PO-<b>X</b>", customer: '<img src=x onerror=alert(1)>', item: "รายการ & ทดสอบ",
        qty: 1, status: "received", progress: 0, dueDate: "2026-01-01",
        unit_price: 100, deposit: 0, vatIncluded: true, paymentStatus: "unpaid" }
    ]);
    printReport();

    const box = document.getElementById("cp-print-report");
    const html = box.innerHTML;
    assert.equal(html.includes("<img src=x"), false, "ต้องไม่มี raw HTML ของ customer หลุดเข้าไปโดยไม่ escape");
    assert.ok(html.includes("&lt;img src=x onerror=alert(1)&gt;"));
    assert.ok(html.includes("PO-&lt;b&gt;X&lt;/b&gt;"));
    assert.ok(html.includes("รายการ &amp; ทดสอบ"));
  });

  test("field ที่ไม่มีค่า (code/customer/item/dueDate เป็น falsy) แสดงเป็น '—' ตามโค้ดจริง (fallback o.code||\"—\" ฯลฯ)", () => {
    triggerOrdersSnapshot([
      { id: "x2", code: "", customer: "", item: "", qty: null, status: "received", progress: 0, dueDate: "",
        unit_price: 0, deposit: 0, vatIncluded: true, paymentStatus: "unpaid" }
    ]);
    printReport();

    const box = document.getElementById("cp-print-report");
    const cells = [...box.querySelectorAll("tbody tr")[0].children].map(td => td.textContent);
    assert.equal(cells[0], "—"); // code
    assert.equal(cells[1], "—"); // customer
    assert.equal(cells[2], "—"); // item
    assert.equal(cells[3], "—"); // qty (o.qty ?? "—")
    assert.equal(cells[6], "—"); // dueDate
  });

  test("ยอดค้างชำระในรายงานผ่าน formatBaht() (มีสัญลักษณ์ ฿ และ comma คั่นหลักพัน)", () => {
    printReport();
    const box = document.getElementById("cp-print-report");
    const rows = box.querySelectorAll("tbody tr");
    // o1: balance 2000 -> "฿2,000"
    const o1Balance = rows[0].children[8].textContent;
    assert.equal(o1Balance, "฿2,000");
  });
});
