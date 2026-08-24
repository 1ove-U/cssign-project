// test/admin-overview-export.test.mjs — รอบที่ 131
//
// บริบท: ไฟล์ถัดไปตามคำแนะนำท้ายรอบ 130 — js/admin-overview-export.js (209 บรรทัด) ปุ่ม
// "Export CSV" / "Export PDF" ในหัวข้อ "ภาพรวม" ของแท็บ overview ไม่ export อะไรให้ไฟล์อื่นเรียก
// ใช้เลย ผูก event listener เองที่ระดับบนสุดของไฟล์ตอนโหลด (module load time) — เป็น side-effect
// module ที่ต้อง import "./admin-overview-export.js" ตรงๆ ในเทส (ไม่มี export ให้ import อย่างอื่น)
//
// **ตรวจ import ก่อนเริ่มตามธรรมเนียมทุกรอบ**: ไฟล์นี้ import ovFormatBaht จาก
// "./admin-overview-dashboard.js" ตรงๆ ที่ระดับบนสุด (เหมือน admin-products-csv.js/admin-leads.js
// ที่ทำให้ต้องมี test/helpers/admin-overview-dashboard-stub-loader.mjs อยู่แล้ว) — ลอง import ตรง
// ก่อนเขียนเทส พบว่าพังจริงเพราะ ALLOWED_PARENT_RE เดิมไม่ครอบคลุม parentURL ของไฟล์นี้ — **ต้องแก้
// infra เทส 1 บรรทัด**: เพิ่ม "admin-overview-export" เข้า ALLOWED_PARENT_RE ในสตับไฟล์นั้น (แค่ขยาย
// regex เดิม ไม่เปลี่ยนพฤติกรรม stub อื่นเลย — admin-products-csv.js/admin-leads.js ยังผ่านเหมือนเดิม)
// หลังแก้แล้ว import ผ่านสำเร็จ ไม่ต้องแก้ infra อื่นเพิ่ม — ไฟล์นี้ยัง import getAllOrders จาก
// "./orders-tab.js" ตรงๆ (import ได้เองอยู่แล้ว ใช้แพทเทิร์นเดียวกับ test/orders-tab-export.test.mjs
// รอบ 97: build DOM จาก admin.html ทั้งไฟล์แล้วตัด <script> ออก เพราะ orders-tab.js ลากไฟล์ย่อยอื่น
// ที่ query DOM element จริงตามมาด้วย) และ allLeads จาก "./admin-leads.js" ตรงๆ (import ได้เองแล้ว
// ตั้งแต่รอบ 123 เหมือนไฟล์อื่นๆ ในกลุ่มนี้)
//
// **ขอบเขตที่เทสได้จริงกับที่เทสไม่ได้**:
//   - ปุ่ม "Export CSV": buildOverviewReportRows()/reportRowToCsvRow() ไม่ export แต่ทดสอบทางอ้อมได้
//     ครบผ่านผลลัพธ์ Blob ที่ downloadCsv() สร้าง (เหมือนแพทเทิร์น test/orders-tab-export.test.mjs
//     รอบ 97 ทุกประการ — สอดแนม Blob/URL.createObjectURL/revokeObjectURL/<a>.click())
//   - ปุ่ม "Export PDF": **ทดสอบ flow ความสำเร็จเต็มรูปแบบไม่ได้เลยในสภาพแวดล้อมเทสนี้** เพราะ
//     loadPdfLibs() ใช้ dynamic import โหลดจาก CDN ตรงๆ (`import("https://esm.sh/jspdf@2.5.2")`) —
//     ยืนยันด้วยสคริปต์ทดสอบแยกก่อนเขียนไฟล์นี้ว่า Node's default ESM loader **reject การ import
//     https:// URL ทันทีแบบ deterministic โดยไม่ต้องมีการเชื่อมต่อเน็ตเวิร์กจริงเลย**
//     (ERR_UNSUPPORTED_ESM_URL_SCHEME: "Only URLs with a scheme in: file and data are supported by
//     the default ESM loader") — ต่างจากปัญหาการอัปโหลดไฟล์จริงไปที่ api.cloudinary.com ในไฟล์อื่นๆ
//     (รอบ 106/111/112/113/119/130 ฯลฯ) ที่ไม่มี network access เลยในสภาพแวดล้อม CI แต่ยัง "อาจ" ผ่าน
//     ถ้ามี network — อันนี้ **รับประกันว่า reject เสมอไม่ว่าอยู่สภาพแวดล้อมไหน** เพราะ Node ปฏิเสธ
//     https import ทันทีโดยไม่สนใจ network เลย จึง **เทส error-handling path (catch/finally) ได้เต็มที่
//     และ deterministic 100%** — แต่ buildOverviewReportEl()/summaryItems/canvas/jsPDF ทั้งหมด (โค้ด
//     หลัง await loadPdfLibs() สำเร็จ) **เทสไม่ได้เลยสักจุด** เพราะ loadPdfLibs() reject ก่อนถึงจุดนั้น
//     เสมอ — บันทึกไว้ชัดเจนเป็นข้อจำกัดถาวรของไฟล์เทสนี้ ไม่ใช่บั๊ก
//
// สถาปัตยกรรมเทส: ผสมแพทเทิร์น test/orders-tab-export.test.mjs (รอบ 97 — Blob/URL spy สำหรับปุ่ม CSV)
// กับ test/admin-settings-team.test.mjs (รอบ 125 — startLeadsListener()+triggerLeadsSnapshot()
// สำหรับ allLeads) รวมกับ import js/admin-state.js ตรงๆ เพื่อตั้งค่า allProducts/allCategories/
// allPortfolios/allBlogs ผ่าน setAllProducts()/ฯลฯ (setter ที่ export ไว้อยู่แล้ว) — (เดิมยังมี
// allTestimonials ด้วย แต่คอลัมน์ "รีวิวสะสม"/testimonialsCum ถูกลบออกจาก js/admin-overview-export.js
// ไปแล้วในรอบลบฟีเจอร์ "โลโก้ลูกค้า/รีวิวลูกค้า")
//
// **กลยุทธ์คำนวณค่าที่คาดหวัง (expected values)**: buildOverviewReportRows() เป็นแค่การ "ประกอบ"
// ผลลัพธ์จาก computeOrderStats()/computeLeadStats()/cumulativeCountHistory() (ทุกฟังก์ชันมีเทสของ
// ตัวเองอยู่แล้วแยกต่างหาก — js/db-orders-stats.js/js/stats-trends.js) เข้าด้วยกันตาม index เดียวกัน
// ไม่มีสูตรคำนวณใหม่ของตัวเองเลย — เทสไฟล์นี้จึง "เรียกฟังก์ชันจริงชุดเดียวกันตรงๆ" ในเทสเพื่อคำนวณ
// ค่าที่คาดหวัง แล้วเทียบกับผลลัพธ์ใน CSV แทนการคำนวณสูตรเองซ้ำ (กันพิมพ์สูตรผิดในเทส) — สิ่งที่เทส
// ไฟล์นี้ปกป้องจริงๆ คือ "ประกอบถูกไฟล์/ถูก field/ถูก index" (เช่น สลับ allBlogs กับ allCategories
// โดยไม่ตั้งใจ) ไม่ใช่ความถูกต้องของสูตรคำนวณเอง — ใช้ข้อมูลตัวอย่างที่ createdAt = "เวลาปัจจุบันจริง"
// เท่านั้น (ไม่ mock เวลา) แล้วเช็คเฉพาะแถวสุดท้าย (index 5 = เดือนปัจจุบัน) เพื่อเลี่ยงปัญหา flaky
// จากวันที่รันเทสจริงขยับ bucket boundary (เดือนเก่ากว่าจะเป็น 0 เสมอเพราะ createdAt เป็น "ตอนนี้"
// ไม่เข้าเงื่อนไข millis < bucket.end ของเดือนที่ผ่านมาแล้ว — ตรวจสอบพฤติกรรมนี้ไว้เป็นเทสแยกด้วย)
//
// ตรวจโค้ดจริงทั้งไฟล์ js/admin-overview-export.js ก่อนเขียนเทสนี้ (209 บรรทัด อ่านครบ) — ไม่พบบั๊ก
// ในส่วนที่เทสได้ — ไม่แตะไฟล์โค้ดผลิตภัณฑ์เลยแม้แต่บรรทัดเดียว

import { test, describe, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { computeOrderStats, computeLeadStats } from "../js/db-orders-stats.js";
import { cumulativeCountHistory } from "../js/stats-trends.js";

const ADMIN_HTML = readFileSync(new URL("../admin.html", import.meta.url), "utf-8");
const BODY_START = ADMIN_HTML.indexOf(">", ADMIN_HTML.indexOf("<body")) + 1;
const BODY_END = ADMIN_HTML.indexOf("</body>");
const ADMIN_BODY_NO_SCRIPTS = ADMIN_HTML
  .slice(BODY_START, BODY_END)
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, "");

let document;
let ordersMod; // orders-tab.js exports (getAllOrders, initOrdersTab, stopOrdersTab)
let leadsMod;  // admin-leads.js exports (allLeads state, startLeadsListener)
let stateMod;  // admin-state.js exports (setAllProducts ฯลฯ)

// ── สอดแนม Blob / URL.createObjectURL / URL.revokeObjectURL (ของจริงจาก Node global) ──
// แพทเทิร์นเดียวกับ test/orders-tab-export.test.mjs รอบ 97 ทุกประการ
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
}

function triggerSnapshot(name, items) {
  const cb = globalThis.__SNAPSHOT_LISTENERS__ && globalThis.__SNAPSHOT_LISTENERS__[name];
  if (typeof cb !== "function") throw new Error(`${name} snapshot listener ยังไม่ได้ลงทะเบียน`);
  cb({ docs: items.map(x => ({ id: x.id, data: () => { const { id, ...rest } = x; return rest; } })) });
}

function clearAllData() {
  triggerSnapshot("orders", []);
  triggerSnapshot("leads", []);
  stateMod.setAllProducts([]);
  stateMod.setAllCategories([]);
  stateMod.setAllPortfolios([]);
  stateMod.setAllBlogs([]);
}

function nowTs() { return { toMillis: () => Date.now() }; }

function clickCsvBtn() { document.getElementById("ov-export-csv-btn").click(); }
function pdfBtn() { return document.getElementById("ov-export-pdf-btn"); }

function flushMicrotasks(ms = 20) {
  return new Promise((r) => setTimeout(r, ms));
}

// รอจนกว่าปุ่ม PDF จะกลับสถานะ disabled=false (finally block ทำงานเสร็จ) แทนการ setTimeout ตายตัว
// เพราะ duration ของ dynamic import reject ไม่คงที่ (ขึ้นกับโหลดของเครื่อง โดยเฉพาะตอนรัน npm test
// เต็ม suite พร้อมกันหลาย worker) — ยืนยันด้วยเทสจริงว่า flushMicrotasks(20) ตายตัวเคย flaky มาแล้ว
async function waitForPdfBtnSettled(btn, timeoutMs = 2000) {
  const start = Date.now();
  while (btn.disabled && Date.now() - start < timeoutMs) {
    await new Promise((r) => setTimeout(r, 10));
  }
}

before(async () => {
  const dom = new JSDOM(`<!doctype html><html><body>${ADMIN_BODY_NO_SCRIPTS}</body></html>`, {
    url: "https://example.test/"
  });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
  globalThis.MouseEvent = dom.window.MouseEvent;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Event = dom.window.Event;
  dom.window.HTMLElement.prototype.scrollIntoView = function () {};
  globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);
  document = dom.window.document;

  // stub <a>.click() กัน jsdom navigation-not-implemented log (ดูหมายเหตุใน orders-tab-export.test.mjs รอบ 97)
  dom.window.HTMLAnchorElement.prototype.click = function () { this.__clicked = true; };
  const originalCreateElement = dom.window.document.createElement.bind(dom.window.document);
  globalThis.__lastAnchor = null;
  dom.window.document.createElement = function (tag) {
    const el = originalCreateElement(tag);
    if (String(tag).toLowerCase() === "a") globalThis.__lastAnchor = el;
    return el;
  };

  ordersMod = await import("../js/orders-tab.js");
  leadsMod = await import("../js/admin-leads.js");
  stateMod = await import("../js/admin-state.js");
  await import("../js/admin-overview-export.js"); // side-effect module — ไม่มี export ให้ใช้

  globalThis.__SNAPSHOT_LISTENERS__ = {};
  leadsMod.startLeadsListener();
  ordersMod.initOrdersTab();
});

beforeEach(() => {
  resetFirebaseCalls();
  clearAllData();
  document.querySelectorAll(".cp-toast-wrap .cp-toast").forEach(el => el.remove());
  globalThis.__lastAnchor = null;

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

  // รีเซ็ตปุ่ม PDF กลับสถานะเริ่มต้นถ้าเทสก่อนหน้าค้าง (กันสถานะ disabled รั่วข้ามเทส)
  const btn = pdfBtn();
  if (btn.disabled) btn.disabled = false;
});

function lastToast(kind) {
  const els = document.querySelectorAll(`.cp-toast-wrap .cp-toast.${kind}`);
  return els.length ? els[els.length - 1] : null;
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function csvLines() {
  assert.equal(lastBlobParts.length, 1, "โค้ดจริงส่ง array พาร์ทเดียวเข้า Blob constructor");
  const raw = lastBlobParts[0];
  assert.equal(raw.charCodeAt(0), 0xFEFF, "ตัวอักษรแรกต้องเป็น BOM (\\uFEFF) — เช็คจาก parts ดิบ ไม่ใช่ .text() (Node ตัด BOM ทิ้งตอน decode)");
  return raw.slice(1).split("\r\n");
}

const CSV_HEADER = "เดือน,สินค้าสะสม,หมวดหมู่สะสม,ผลงานสะสม,บทความสะสม,ลีดใหม่,อัตราปิดการขายลีด (%),งานผลิตใหม่,งานผลิตเสร็จ,รายได้ (บาท)";

describe("js/admin-overview-export.js — ปุ่ม 'Export CSV' โครงสร้างพื้นฐาน (รอบที่ 131)", () => {
  test("ไม่มีข้อมูลเลย (ทุกชุดว่างเปล่า): ยังคง Export ได้ปกติ ไม่มี guard เช็คข้อมูลว่างเหมือนปุ่ม CSV ของ orders-tab-export.js", () => {
    clickCsvBtn();
    assert.notEqual(lastBlobRef, null, "ต้องสร้าง Blob แม้ไม่มีข้อมูลเลย (ต่างจาก orders-tab-export.js ที่มี guard)");
    assert.equal(lastToast("error"), null, "ต้องไม่มี toast error");
  });

  test("header row ตรงกับ OV_REPORT_CSV_HEADERS ทุกคอลัมน์ตามลำดับ", () => {
    clickCsvBtn();
    const lines = csvLines();
    assert.equal(lines[0], CSV_HEADER);
  });

  test("จำนวนแถวข้อมูล = 6 เดือนเสมอ (monthBuckets(6) ของ orderStats.monthly.labels)", () => {
    clickCsvBtn();
    const lines = csvLines();
    assert.equal(lines.length, 7); // header + 6 เดือน
  });

  test("ทุกชุดว่างเปล่า: ทุกคอลัมน์ตัวเลขเป็น 0 ทุกแถว, conversionRate เป็นค่าว่าง (null -> \"\") ทุกแถว", () => {
    clickCsvBtn();
    const lines = csvLines();
    for (let i = 1; i <= 6; i++) {
      const cells = lines[i].split(",");
      // cells[0] คือเดือน (label) — ไม่เช็คค่า เช็คแค่ 10 คอลัมน์ตัวเลข/ว่างที่เหลือ
      assert.equal(cells[1], '"0"', `แถว ${i} productsCum`);
      assert.equal(cells[2], '"0"', `แถว ${i} categoriesCum`);
      assert.equal(cells[3], '"0"', `แถว ${i} portfolioCum`);
      assert.equal(cells[4], '"0"', `แถว ${i} blogCum`);
      assert.equal(cells[5], '"0"', `แถว ${i} newLeads`);
      assert.equal(cells[6], '""', `แถว ${i} conversionRate ต้องว่างเพราะไม่มีลีดปิดจบเลย`);
      assert.equal(cells[7], '"0"', `แถว ${i} ordersCreated`);
      assert.equal(cells[8], '"0"', `แถว ${i} ordersCompleted`);
      assert.equal(cells[9], '"0"', `แถว ${i} revenue`);
    }
  });

  test("Blob type = text/csv;charset=utf-8; ตรงกับ downloadCsv() ของ admin-utils.js", () => {
    clickCsvBtn();
    assert.equal(lastBlobOptions.type, "text/csv;charset=utf-8;");
  });

  test("ชื่อไฟล์ (a.download) ตรงรูปแบบ overview-report-YYYY-MM-DD.csv ของวันนี้", () => {
    clickCsvBtn();
    const a = globalThis.__lastAnchor;
    assert.ok(a, "ต้องมีการสร้าง <a> element");
    assert.equal(a.download, `overview-report-${todayIsoDate()}.csv`);
    assert.equal(a.tagName, "A");
  });

  test("<a> ถูก append เข้า DOM, click(), แล้ว remove() ออกจาก DOM จริง + URL.revokeObjectURL() เรียกด้วย url เดียวกับ href", () => {
    clickCsvBtn();
    const a = globalThis.__lastAnchor;
    assert.ok(a.__clicked, "ต้องเรียก a.click()");
    assert.equal(document.body.contains(a), false, "a ต้องถูก remove() ออกจาก DOM แล้วหลังคลิก");
    assert.equal(createObjectURLCalls.length, 1);
    assert.equal(createObjectURLCalls[0], lastBlobRef, "URL.createObjectURL() ต้องถูกเรียกด้วย Blob ตัวเดียวกับที่สร้างไว้");
    assert.equal(revokeObjectURLCalls.length, 1);
    assert.equal(revokeObjectURLCalls[0], a.href, "revokeObjectURL() ต้องถูกเรียกด้วย url เดียวกับที่ตั้งเป็น a.href");
  });

  test("แต่ละ field ผ่าน csvCell() (ครอบด้วยเครื่องหมายคำพูดเสมอ ต่างจาก orders-tab-export.js บางคอลัมน์ที่เป็นตัวเลขดิบ)", () => {
    clickCsvBtn();
    const lines = csvLines();
    const cells = lines[1].split(",");
    // ทุกคอลัมน์ (รวมตัวเลข) ต้องขึ้นต้น/ลงท้ายด้วย " เพราะ reportRowToCsvRow ส่งเข้า downloadCsv()
    // ที่ map ทุก cell ผ่าน csvCell() เหมือนกันหมด ไม่มีข้อยกเว้นแบบ orders-tab-export.js
    cells.forEach((c, idx) => {
      assert.ok(c.startsWith('"') && c.endsWith('"'), `cell index ${idx} ต้องอยู่ในเครื่องหมายคำพูด: ${c}`);
    });
  });
});

describe("js/admin-overview-export.js — ปุ่ม 'Export CSV' ประกอบข้อมูลถูกต้อง (รอบที่ 131)", () => {
  test("รายการที่ createdAt เป็น 'ตอนนี้จริง' นับใน cumulative เฉพาะแถวเดือนปัจจุบัน (index สุดท้าย) เท่านั้น ไม่รั่วไปเดือนก่อนหน้า", () => {
    stateMod.setAllProducts([{ id: "p1", createdAt: nowTs() }, { id: "p2", createdAt: nowTs() }, { id: "p3", createdAt: nowTs() }]);
    clickCsvBtn();
    const lines = csvLines();
    const expected = cumulativeCountHistory(
      [{ createdAt: nowTs() }, { createdAt: nowTs() }, { createdAt: nowTs() }],
      p => p.createdAt
    );
    for (let i = 0; i < 6; i++) {
      const cells = lines[i + 1].split(",");
      assert.equal(cells[1], `"${expected[i]}"`, `เดือน index ${i} productsCum`);
    }
    // เดือนปัจจุบัน (index 5, แถวสุดท้าย) ต้องเป็น 3 พอดี
    assert.equal(lines[6].split(",")[1], '"3"');
  });

  test("allCategories/allPortfolios/allBlogs ไม่ถูกสลับกัน (แต่ละคอลัมน์นับจากไฟล์ที่ถูกต้องของตัวเอง)", () => {
    stateMod.setAllCategories([{ id: "c1", createdAt: nowTs() }]);
    stateMod.setAllPortfolios([{ id: "f1", createdAt: nowTs() }, { id: "f2", createdAt: nowTs() }]);
    stateMod.setAllBlogs([{ id: "b1", createdAt: nowTs() }, { id: "b2", createdAt: nowTs() }, { id: "b3", createdAt: nowTs() }]);
    clickCsvBtn();
    const lastRow = csvLines()[6].split(",");
    assert.equal(lastRow[1], '"0"', "productsCum ต้องยังเป็น 0 (ไม่ได้ตั้งค่า)");
    assert.equal(lastRow[2], '"1"', "categoriesCum");
    assert.equal(lastRow[3], '"2"', "portfolioCum");
    assert.equal(lastRow[4], '"3"', "blogCum");
  });

  test("newLeads/conversionRate ประกอบจาก computeLeadStats(allLeads) ตรงกับเรียกฟังก์ชันจริงตรงๆ", () => {
    const leads = [
      { id: "l1", createdAt: nowTs(), status: "won" },
      { id: "l2", createdAt: nowTs(), status: "lost" },
      { id: "l3", createdAt: nowTs(), status: "new" }
    ];
    triggerSnapshot("leads", leads);
    clickCsvBtn();
    const lastRow = csvLines()[6].split(",");

    const expectedLeadStats = computeLeadStats(leads.map(({ id, ...rest }) => rest));
    const lastIdx = expectedLeadStats.monthly.newLeads.length - 1;
    assert.equal(lastRow[5], `"${expectedLeadStats.monthly.newLeads[lastIdx]}"`, "newLeads");
    assert.equal(lastRow[5], '"3"');
    const expectedConv = expectedLeadStats.monthly.conversionRate[lastIdx];
    assert.equal(lastRow[6], expectedConv == null ? '""' : `"${expectedConv}"`, "conversionRate");
    assert.equal(lastRow[6], '"50"', "1 won / (1 won + 1 lost) = 50%");
  });

  test("ordersCreated/ordersCompleted/revenue ประกอบจาก computeOrderStats(getAllOrders()) ตรงกับเรียกฟังก์ชันจริงตรงๆ (revenue เป็นตัวเลขดิบ ไม่ผ่าน ovFormatBaht)", () => {
    const orders = [
      { id: "o1", createdAt: nowTs(), status: "received", unit_price: 1000, qty: 2, vatIncluded: true, discount: 0, shippingCost: 0, deposit: 0, paymentStatus: "unpaid" },
      { id: "o2", createdAt: nowTs(), completedAt: nowTs(), status: "completed", unit_price: 500, qty: 1, vatIncluded: true, discount: 0, shippingCost: 0, deposit: 0, paymentStatus: "unpaid" }
    ];
    triggerSnapshot("orders", orders);
    clickCsvBtn();
    const lastRow = csvLines()[6].split(",");

    const expectedOrderStats = computeOrderStats(orders.map(({ id, ...rest }) => rest));
    const lastIdx = expectedOrderStats.monthly.labels.length - 1;
    assert.equal(lastRow[7], `"${expectedOrderStats.monthly.created[lastIdx]}"`);
    assert.equal(lastRow[8], `"${expectedOrderStats.monthly.completed[lastIdx]}"`);
    assert.equal(lastRow[9], `"${expectedOrderStats.monthly.revenue[lastIdx]}"`);
    // เช็คตัวเลขจริงตรงๆ ด้วย: created=2 (ทั้งคู่ไม่ cancelled), completed=1 (แค่ o2), revenue=2000+500=2500
    assert.equal(lastRow[7], '"2"');
    assert.equal(lastRow[8], '"1"');
    assert.equal(lastRow[9], '"2500"');
  });

  test("orders ที่อยู่ใน pendingDeleteOrderIds (รอ 'เลิกทำ' ค้างอยู่) ยังถูกนับรวมใน export นี้ (ต่างจาก orders-tab-export.js ที่ตัดออก — ไฟล์นี้ไม่กรอง pendingDeleteOrderIds เลย)", () => {
    const orders = [
      { id: "o1", createdAt: nowTs(), status: "received", unit_price: 100, qty: 1, vatIncluded: true, discount: 0, shippingCost: 0, deposit: 0, paymentStatus: "unpaid" }
    ];
    triggerSnapshot("orders", orders);
    ordersMod.pendingDeleteOrderIds.add("o1");
    clickCsvBtn();
    const lastRow = csvLines()[6].split(",");
    assert.equal(lastRow[7], '"1"', "ordersCreated ต้องยังนับ o1 แม้กำลังรอเลิกทำอยู่");
    ordersMod.pendingDeleteOrderIds.clear();
  });

  test("labels ของทุกคอลัมน์ cumulative/leads/orders ใช้ monthBuckets(6) ชุดเดียวกัน (label คอลัมน์แรกตรงกับ orderStats.monthly.labels)", () => {
    const orders = [{ id: "o1", createdAt: nowTs(), status: "received", unit_price: 0, qty: 0, vatIncluded: true, discount: 0, shippingCost: 0, deposit: 0, paymentStatus: "unpaid" }];
    triggerSnapshot("orders", orders);
    clickCsvBtn();
    const lines = csvLines();
    const expectedOrderStats = computeOrderStats(orders.map(({ id, ...rest }) => rest));
    for (let i = 0; i < 6; i++) {
      const label = lines[i + 1].split(",")[0];
      assert.equal(label, `"${expectedOrderStats.monthly.labels[i]}"`);
    }
  });
});

describe("js/admin-overview-export.js — ปุ่ม 'Export PDF' (รอบที่ 131 — เฉพาะ error-handling path เท่านั้น ดูหมายเหตุหัวไฟล์)", () => {
  test("คลิกแล้ว disabled=true + innerHTML เปลี่ยนเป็น 'กำลังสร้าง PDF...' ทันที (ก่อน await loadPdfLibs() reject)", () => {
    const btn = pdfBtn();
    btn.click();
    assert.equal(btn.disabled, true);
    assert.equal(btn.innerHTML, "กำลังสร้าง PDF...");
  });

  test("loadPdfLibs() reject แน่นอน (Node ปฏิเสธ https:// dynamic import ทันที) -> เข้า catch -> showToast error พร้อมข้อความมี err.message ต่อท้าย", async () => {
    const btn = pdfBtn();
    btn.click();
    await waitForPdfBtnSettled(btn);
    const t = lastToast("error");
    assert.ok(t, "ต้องมี toast error หลัง loadPdfLibs() reject");
    assert.match(t.textContent, /^สร้าง PDF ไม่สำเร็จ: /);
    assert.match(t.textContent, /esm loader/i);
  });

  test("finally: ปุ่มกลับมา disabled=false + innerHTML คืนค่าเดิม (originalHtml) หลัง reject", async () => {
    const btn = pdfBtn();
    const originalHtml = btn.innerHTML;
    btn.click();
    await waitForPdfBtnSettled(btn);
    assert.equal(btn.disabled, false);
    assert.equal(btn.innerHTML, originalHtml);
  });

  test("reportEl ไม่เคยถูกสร้าง/append เข้า DOM เลย เพราะ loadPdfLibs() reject ก่อนถึงจุด buildOverviewReportEl() เสมอ (ไม่มี div รายงานค้างใน body)", async () => {
    const beforeCount = document.body.children.length;
    const btn = pdfBtn();
    btn.click();
    await waitForPdfBtnSettled(btn);
    assert.equal(document.body.children.length, beforeCount, "จำนวน child element ของ body ต้องไม่เปลี่ยน (ไม่มี reportEl ค้าง)");
  });

  test("คลิกซ้ำหลายครั้งทำงานได้อิสระต่อกันทุกครั้ง (idempotent) — ไม่มี state ค้างจากครั้งก่อนทำให้ครั้งถัดไปพัง", async () => {
    const btn = pdfBtn();
    btn.click();
    await waitForPdfBtnSettled(btn);
    assert.equal(btn.disabled, false);

    document.querySelectorAll(".cp-toast-wrap .cp-toast").forEach(el => el.remove());
    btn.click();
    await waitForPdfBtnSettled(btn);
    assert.equal(btn.disabled, false);
    const t = lastToast("error");
    assert.ok(t, "ต้องมี toast error ในการคลิกครั้งที่ 2 เช่นกัน");
  });

  test("ไม่มีข้อมูลใดๆ เลย (ทุกชุดว่างเปล่า) ก็ยัง reject ที่ loadPdfLibs() เหมือนกัน — error ไม่ขึ้นกับข้อมูล", async () => {
    clearAllData();
    const btn = pdfBtn();
    btn.click();
    await waitForPdfBtnSettled(btn);
    assert.ok(lastToast("error"));
    assert.equal(btn.disabled, false);
  });
});
