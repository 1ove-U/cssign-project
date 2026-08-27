// test/admin-quotations.test.mjs — P3.0 Phase 3 รอบย่อย 3 + 4 + 5
//
// ขอบเขต: js/admin-quotations.js — แท็บ "ใบเสนอราคา" (list view + realtime listener + ปุ่มลบ +
// ปุ่ม "สร้างใหม่" เปิดฟอร์มจริง + ปุ่ม "สร้างจากคำขอ" เปิดโมดัลเลือก quote_request จริง รอบย่อย
// 5) — pattern เดียวกับ test/admin-leads.test.mjs (realtime listener ผ่าน onSnapshot stub)
// ผสมกับ test/admin-portfolio.test.mjs (deleteWithUndo flow)
//
// **collection "quotations"/"quote_requests" ของ onSnapshot() stub**: listenQuotations()
// (js/db-quotations.js) และ listenAllQuoteRequests() (js/db-quote-requests.js) เรียก
// onSnapshot(query(collection(db,"..."), ...), ...) — stub ให้ ref.path ตรงตามชื่อ collection
// (ดู collection() ใน test/helpers/firebase-stub-loader.mjs) — helper
// triggerQuotationsSnapshot()/triggerQuoteRequestsSnapshot() ท้ายไฟล์นี้ยิง fake snapshot ผ่าน
// globalThis.__SNAPSHOT_LISTENERS__["quotations"]/["quote_requests"]
//
// startQuotationsListener() มี quotationsStarted (module-private, ไม่มี stop/reset export) —
// เรียกได้จริงแค่ครั้งเดียวตลอดทั้งไฟล์เทสนี้เหมือน startLeadsListener() ในรอบก่อน — ผูก listener
// ไว้ใน before() ครั้งเดียว แล้วเรียกซ้ำได้ปลอดภัย (idempotent) ในแต่ละเทสด้านล่าง —
// startQuoteRequestsListener() ผูกไปพร้อมกัน (เรียกจากภายใน startQuotationsListener() เอง)
//
// ตรวจโค้ดจริงทั้งไฟล์ js/admin-quotations.js ก่อนเขียนเทสนี้ (อ่านครบ) — ไม่พบบั๊ก ไม่มีการแก้โค้ด
// ผลิตภัณฑ์ไฟล์นี้เลยแม้แต่บรรทัดเดียว (แก้แค่ admin.html เพิ่ม markup + js/admin-page.js ผูกสาย
// เรียก startQuotationsListener()/switchTab() ตามพรอมต์)
//
// P3.0 Phase 6 รอบ 10 (badge ใกล้หมดอายุ/หมดอายุแล้ว): แก้โค้ดผลิตภัณฑ์ไฟล์นี้จริงรอบนี้ — เพิ่ม
// quotationExpiryBadge() (pure function, export ใหม่) + ใช้ต่อท้าย badge สถานะใน renderQuotations()
// + เจอบั๊กเดิม colspan="5" ผิด (ตารางจริงมี 6 คอลัมน์) ระหว่างแก้ไฟล์นี้พอดี เลยแก้ไปด้วย (ดู
// REFACTOR-PROGRESS.md หัวข้อ "P3.0 Phase 6 รอบ 10")

import { test, describe, before, beforeEach, afterEach } from "node:test";
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
let mod; // admin-quotations.js exports

// ── สอดแนม Blob / URL.createObjectURL / URL.revokeObjectURL สำหรับเทสปุ่ม "ส่งออก CSV" (P3.0
// Phase 6 รอบ 12) — ของจริงจาก Node global เหมือน test/orders-tab-export.test.mjs ทุกประการ
let lastBlobParts, lastBlobOptions, lastBlobRef;
let createObjectURLCalls, revokeObjectURLCalls;
const OriginalBlob = globalThis.Blob;
const originalCreateObjectURL = globalThis.URL.createObjectURL.bind(globalThis.URL);
const originalRevokeObjectURL = globalThis.URL.revokeObjectURL.bind(globalThis.URL);

function triggerQuotationsSnapshot(quotations) {
  const cb = globalThis.__SNAPSHOT_LISTENERS__ && globalThis.__SNAPSHOT_LISTENERS__["quotations"];
  if (typeof cb !== "function") throw new Error("quotations snapshot listener ยังไม่ได้ลงทะเบียน (เรียก startQuotationsListener() ก่อนหรือยัง?)");
  cb({ docs: quotations.map(q => ({ id: q.id, data: () => { const { id, ...rest } = q; return rest; } })) });
}

// quote_requests: listenAllQuoteRequests() (js/db-quote-requests.js) เรียก onSnapshot ผ่าน
// collection(db, "quote_requests") — stub ให้ ref.path === "quote_requests" (ดู collection()
// ใน firebase-stub-loader.mjs) — เริ่มผูกไปพร้อมกันตอน startQuotationsListener() (เรียก
// startQuoteRequestsListener() ภายในตัวเอง)
function triggerQuoteRequestsSnapshot(requests) {
  const cb = globalThis.__SNAPSHOT_LISTENERS__ && globalThis.__SNAPSHOT_LISTENERS__["quote_requests"];
  if (typeof cb !== "function") throw new Error("quote_requests snapshot listener ยังไม่ได้ลงทะเบียน");
  cb({ docs: requests.map(r => ({ id: r.id, data: () => { const { id, ...rest } = r; return rest; } })) });
}

function makeQuoteRequest(overrides) {
  return {
    id: "qr-1", billingName: "บริษัท ลูกค้า จำกัด", contactPerson: "คุณลูกค้า",
    items: [{ name: "ป้ายไฟ LED", qty: 2 }],
    createdAt: { toMillis: () => Date.now() },
    ...overrides
  };
}

function qrRows() { return Array.from(document.getElementById("ad-qr-list-body").querySelectorAll("[data-id]")); }

function field(id) { return document.getElementById(id); }
function rows() { return Array.from(document.getElementById("ad-q-table-body").querySelectorAll("tr[data-id]")); }

function makeQuotation(overrides) {
  return {
    id: "q-1", quoteNo: "QT2026-0001", billingName: "บริษัท ทดสอบ จำกัด",
    contactPerson: "คุณสมชาย", grandTotal: 10700, status: "draft",
    createdAt: { toMillis: () => Date.now() },
    ...overrides
  };
}

function resetFirebaseCalls() {
  globalThis.__DELETE_DOC_CALLS__ = [];
}

function flushMicrotasks() {
  return new Promise((r) => setTimeout(r, 0));
}

before(async () => {
  const dom = new JSDOM(`<!doctype html><html><body>${ADMIN_BODY_NO_SCRIPTS}</body></html>`, {
    url: "https://example.test/"
  });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
  globalThis.Event = dom.window.Event;
  document = dom.window.document;

  // stub <a>.click() กัน jsdom navigation-not-implemented log — ปุ่ม "ส่งออก CSV" (P3.0 Phase 6
  // รอบ 12) ใช้ pattern เดียวกับ js/orders-tab-export.js (ดู test/orders-tab-export.test.mjs
  // หมายเหตุหัวไฟล์เรื่อง Blob/URL.createObjectURL/window jsdom ไม่ implement)
  let anchorClickCount = 0;
  dom.window.HTMLAnchorElement.prototype.click = function () { anchorClickCount++; this.__clicked = anchorClickCount; };
  globalThis.__lastAnchor = null;
  const originalCreateElement = dom.window.document.createElement.bind(dom.window.document);
  dom.window.document.createElement = function (tag) {
    const el = originalCreateElement(tag);
    if (String(tag).toLowerCase() === "a") globalThis.__lastAnchor = el;
    return el;
  };

  mod = await import("../js/admin-quotations.js");

  // startQuotationsListener() ผูก listener ครั้งเดียวตลอดไฟล์เทสนี้ (module-private state ไม่มี
  // reset ให้ — เหมือน startLeadsListener() ในรอบก่อน)
  globalThis.__SNAPSHOT_LISTENERS__ = {};
  mod.startQuotationsListener();
});

beforeEach(() => {
  resetFirebaseCalls();
  mod.pendingDeleteQuotationIds.clear();
  const confirmOverlay = document.querySelector(".cp-confirm-overlay");
  if (confirmOverlay && confirmOverlay.style.display === "flex") {
    confirmOverlay.querySelector("#cp-confirm-cancel").click();
  }
  document.querySelectorAll(".cp-toast-wrap .cp-toast").forEach(el => el.remove());

  // ติดตั้งสอดแนม Blob/URL ใหม่ทุกเทส (เก็บค่าล่าสุดเท่านั้น) — ใช้กับเทสปุ่ม "ส่งออก CSV" ด้านล่าง
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

describe("startQuotationsListener() — realtime listener", () => {
  test("ผูก listener ของ collection 'quotations' ให้พร้อมรับ realtime snapshot (ผูกไว้แล้วตั้งแต่ before())", () => {
    assert.equal(typeof globalThis.__SNAPSHOT_LISTENERS__["quotations"], "function");
  });

  test("เรียกซ้ำ (idempotent): ไม่ผูก listener ใหม่ซ้ำถ้าเริ่มไปแล้ว — ข้อมูลเดิมยังอยู่", () => {
    triggerQuotationsSnapshot([makeQuotation({ id: "q-1" })]);
    mod.startQuotationsListener(); // เรียกซ้ำ — quotationsStarted=true อยู่แล้ว ต้อง return ทันที
    assert.equal(mod.allQuotations.length, 1);
  });

  test("snapshot ยิงข้อมูลใหม่ → allQuotations อัปเดต + renderQuotations() ถูกเรียกจริง", () => {
    triggerQuotationsSnapshot([makeQuotation({ id: "q-1" }), makeQuotation({ id: "q-2" })]);
    assert.equal(mod.allQuotations.length, 2);
    assert.equal(rows().length, 2);
  });
});

describe("renderQuotations() — empty states", () => {
  test("allQuotations ว่างเปล่าทั้งหมด → ข้อความ 'ยังไม่มีใบเสนอราคา', ไม่มีแถว", () => {
    triggerQuotationsSnapshot([]);
    assert.match(field("ad-q-table-body").innerHTML, /ยังไม่มีใบเสนอราคา/);
    assert.equal(rows().length, 0);
  });

  test("มีใบเสนอราคาอยู่แต่ทุกแถวถูก mark pending-delete หมด → ข้อความ 'ไม่พบใบเสนอราคา' (คนละข้อความ)", () => {
    triggerQuotationsSnapshot([makeQuotation({ id: "q-1" })]);
    mod.pendingDeleteQuotationIds.add("q-1");
    mod.renderQuotations();
    assert.match(field("ad-q-table-body").innerHTML, /ไม่พบใบเสนอราคา/);
    assert.equal(rows().length, 0);
  });
});

describe("renderQuotations() — เนื้อหาแถวปกติ", () => {
  test("วันที่/เลขที่เอกสาร/ลูกค้า (billingName)/ยอดสุทธิ/badge สถานะ ถูกต้อง", () => {
    triggerQuotationsSnapshot([makeQuotation({ id: "q-1", billingName: "บริษัท เอ จำกัด", quoteNo: "QT2026-0007", grandTotal: 21400, status: "sent" })]);
    const row = rows()[0];
    assert.match(row.innerHTML, /QT2026-0007/);
    assert.match(row.innerHTML, /บริษัท เอ จำกัด/);
    assert.match(row.innerHTML, /฿21,400/);
    const badge = row.querySelector(".cp-status-badge");
    assert.equal(badge.dataset.status, "sent");
    assert.equal(badge.textContent, "ส่งลูกค้าแล้ว");
  });

  test("ไม่มี billingName → fallback เป็น contactPerson", () => {
    triggerQuotationsSnapshot([makeQuotation({ id: "q-1", billingName: "", contactPerson: "คุณสมหญิง" })]);
    assert.match(rows()[0].innerHTML, /คุณสมหญิง/);
  });

  test("ไม่มี billingName และ contactPerson เลย → แสดง —", () => {
    triggerQuotationsSnapshot([makeQuotation({ id: "q-1", billingName: "", contactPerson: "" })]);
    // คอลัมน์ลูกค้า (คอลัมน์ที่ 3) ต้องมี "—"
    const cells = rows()[0].querySelectorAll("td");
    assert.equal(cells[2].textContent.trim(), "—");
  });

  test("ไม่มี quoteNo → คอลัมน์เลขที่เอกสารแสดง —", () => {
    triggerQuotationsSnapshot([makeQuotation({ id: "q-1", quoteNo: "" })]);
    const cells = rows()[0].querySelectorAll("td");
    assert.equal(cells[1].textContent.trim(), "—");
  });

  test("สถานะที่ไม่รู้จัก (ไม่อยู่ใน QUOTATION_STATUS_LABEL) → ใช้ค่า status ดิบเป็น label", () => {
    triggerQuotationsSnapshot([makeQuotation({ id: "q-1", status: "weird_status" })]);
    const badge = rows()[0].querySelector(".cp-status-badge");
    assert.equal(badge.textContent, "weird_status");
  });

  test("ไม่มี status เลย → default เป็น 'draft' (ร่าง)", () => {
    triggerQuotationsSnapshot([makeQuotation({ id: "q-1", status: undefined })]);
    const badge = rows()[0].querySelector(".cp-status-badge");
    assert.equal(badge.dataset.status, "draft");
    assert.equal(badge.textContent, "ร่าง");
  });

  test("escape HTML กัน XSS ในชื่อลูกค้า/เลขที่เอกสาร", () => {
    triggerQuotationsSnapshot([makeQuotation({ id: "q-1", billingName: '<img src=x onerror=alert(1)>', quoteNo: "<b>QT</b>" })]);
    const html = rows()[0].innerHTML;
    assert.ok(!html.includes("<img"), "ต้องไม่มี <img> ดิบๆ หลุดเข้าไปใน DOM");
    assert.ok(!html.includes("<b>QT</b>"), "ต้องไม่มี <b> ดิบๆ หลุดเข้าไปใน DOM");
    assert.match(html, /&lt;img/);
  });
});

describe("QUOTATION_STATUS_LABEL — ป้ายภาษาไทยครบทุกสถานะที่ db-quotations.js รองรับ", () => {
  test("มีครบ 6 สถานะ: draft/sent/accepted/rejected/expired/changes_requested (เพิ่ม changes_requested ใน P3.0 Phase 4 รอบ 4)", () => {
    assert.deepEqual(Object.keys(mod.QUOTATION_STATUS_LABEL).sort(), ["accepted", "changes_requested", "draft", "expired", "rejected", "sent"]);
  });
});

// quotationExpiryBadge() — pure function, P3.0 Phase 6 (badge ใกล้หมดอายุ/หมดอายุแล้ว) — inject
// `now` ทุกเทสกันเทสพังตอนวันเปลี่ยน (pattern เดียวกับ monthBuckets() ใน test/stats-trends.test.mjs)
describe("quotationExpiryBadge() — badge ใกล้หมดอายุ/หมดอายุแล้ว (P3.0 Phase 6)", () => {
  const TODAY = new Date(2026, 7, 21); // 21 ส.ค. 2026 (เดือนใน Date คือ 0-based)

  test("ไม่มี validUntil เลย (สตริงว่าง) → null ไม่มี badge", () => {
    assert.equal(mod.quotationExpiryBadge("", "sent", TODAY), null);
  });

  test("validUntil parse ไม่ได้ (สตริงมั่วๆ) → null ไม่ throw", () => {
    assert.equal(mod.quotationExpiryBadge("ไม่ใช่วันที่", "sent", TODAY), null);
  });

  test("validUntil ยังเหลืออีกเยอะ (เกิน 7 วัน) → null ไม่มี badge", () => {
    assert.equal(mod.quotationExpiryBadge("2026-09-15", "sent", TODAY), null);
  });

  test("validUntil เหลืออีก 7 วันพอดี (ขอบเขตบน inclusive) → badge 'ใกล้หมดอายุ' สี approval", () => {
    assert.deepEqual(mod.quotationExpiryBadge("2026-08-28", "sent", TODAY), { label: "ใกล้หมดอายุ", css: "approval" });
  });

  test("validUntil เหลืออีก 1 วัน → badge 'ใกล้หมดอายุ'", () => {
    assert.deepEqual(mod.quotationExpiryBadge("2026-08-22", "draft", TODAY), { label: "ใกล้หมดอายุ", css: "approval" });
  });

  test("validUntil ตรงกับวันนี้พอดี (0 วัน) → ยังนับเป็น 'ใกล้หมดอายุ' ไม่ใช่ 'หมดอายุแล้ว'", () => {
    assert.deepEqual(mod.quotationExpiryBadge("2026-08-21", "sent", TODAY), { label: "ใกล้หมดอายุ", css: "approval" });
  });

  test("validUntil ผ่านมาแล้ว 1 วัน → badge 'หมดอายุแล้ว' สี rejected", () => {
    assert.deepEqual(mod.quotationExpiryBadge("2026-08-20", "sent", TODAY), { label: "หมดอายุแล้ว", css: "rejected" });
  });

  test("validUntil ผ่านมาแล้วนาน (หลายเดือน) → ยังคง badge 'หมดอายุแล้ว' เหมือนกัน", () => {
    assert.deepEqual(mod.quotationExpiryBadge("2026-01-01", "changes_requested", TODAY), { label: "หมดอายุแล้ว", css: "rejected" });
  });

  test("status ปิดผลไปแล้ว (accepted) แม้ validUntil ผ่านมาแล้ว → null ไม่ต้องเตือนซ้ำ", () => {
    assert.equal(mod.quotationExpiryBadge("2026-01-01", "accepted", TODAY), null);
  });

  test("status ปิดผลไปแล้ว (rejected) → null", () => {
    assert.equal(mod.quotationExpiryBadge("2026-01-01", "rejected", TODAY), null);
  });

  test("status ปิดผลไปแล้ว (expired) → null (ไม่ต้องซ้อน badge บนสถานะที่บอกอยู่แล้วว่าหมดอายุ)", () => {
    assert.equal(mod.quotationExpiryBadge("2026-01-01", "expired", TODAY), null);
  });

  test("ไม่มี status เลย (undefined) → null (undefined ไม่อยู่ใน EXPIRY_ACTIVE_STATUSES)", () => {
    assert.equal(mod.quotationExpiryBadge("2026-01-01", undefined, TODAY), null);
  });

  test("ไม่ส่ง now มาเลย (ใช้ default = new Date() จริง) → ไม่ throw อย่างน้อย", () => {
    assert.doesNotThrow(() => mod.quotationExpiryBadge("2099-01-01", "draft"));
  });
});

describe("renderQuotations() — badge ใกล้หมดอายุ/หมดอายุแล้ว ต่อท้าย badge สถานะ (P3.0 Phase 6)", () => {
  test("มี validUntil ใกล้หมดอายุ (พรุ่งนี้) + status='sent' → มี badge ที่สองต่อท้าย badge สถานะ", () => {
    const soon = new Date(); soon.setDate(soon.getDate() + 1);
    const soonStr = soon.toISOString().slice(0, 10);
    triggerQuotationsSnapshot([makeQuotation({ id: "q-1", status: "sent", validUntil: soonStr })]);
    const badges = rows()[0].querySelectorAll(".cp-status-badge");
    assert.equal(badges.length, 2, "ต้องมี badge สถานะหลัก + badge เตือนหมดอายุ รวม 2 อัน");
    assert.equal(badges[1].dataset.status, "approval");
    assert.equal(badges[1].textContent, "ใกล้หมดอายุ");
  });

  test("มี validUntil หมดอายุไปแล้ว (เมื่อวาน) + status='draft' → badge ที่สองเป็น 'หมดอายุแล้ว' สี rejected", () => {
    const past = new Date(); past.setDate(past.getDate() - 1);
    const pastStr = past.toISOString().slice(0, 10);
    triggerQuotationsSnapshot([makeQuotation({ id: "q-1", status: "draft", validUntil: pastStr })]);
    const badges = rows()[0].querySelectorAll(".cp-status-badge");
    assert.equal(badges.length, 2);
    assert.equal(badges[1].dataset.status, "rejected");
    assert.equal(badges[1].textContent, "หมดอายุแล้ว");
  });

  test("ไม่มี validUntil เลย → มีแค่ badge สถานะหลักอันเดียว ไม่มี badge ที่สอง", () => {
    triggerQuotationsSnapshot([makeQuotation({ id: "q-1", status: "sent", validUntil: "" })]);
    const badges = rows()[0].querySelectorAll(".cp-status-badge");
    assert.equal(badges.length, 1);
  });

  test("validUntil หมดอายุไปแล้วแต่ status='accepted' (ปิดผลแล้ว) → ไม่มี badge ที่สอง", () => {
    triggerQuotationsSnapshot([makeQuotation({ id: "q-1", status: "accepted", validUntil: "2020-01-01" })]);
    const badges = rows()[0].querySelectorAll(".cp-status-badge");
    assert.equal(badges.length, 1);
  });
});

describe("ad-q-table-body — event delegation ปุ่มลบ", () => {
  beforeEach(() => {
    triggerQuotationsSnapshot([makeQuotation({ id: "q-1", quoteNo: "QT2026-0001" }), makeQuotation({ id: "q-2", quoteNo: "QT2026-0002" })]);
  });

  test("คลิกที่ไม่ใช่ปุ่ม data-action → ไม่ทำอะไร", () => {
    rows()[0].click();
    const co = document.querySelector(".cp-confirm-overlay");
    assert.ok(!co || co.style.display !== "flex");
  });

  test("คลิกลบ → เปิด confirmDialog ข้อความมีเลขที่เอกสารอยู่ในนั้น", async () => {
    rows()[0].querySelector('[data-action="delete"]').dispatchEvent(new Event("click", { bubbles: true }));
    await flushMicrotasks();
    const co = document.querySelector(".cp-confirm-overlay");
    assert.equal(co.style.display, "flex");
    assert.match(co.querySelector("#cp-confirm-msg").textContent, /ลบใบเสนอราคา "QT2026-0001" ใช่หรือไม่/);
  });

  test("กด 'ยกเลิก' บน confirm → ไม่ลบ, แถวยังอยู่ครบ", async () => {
    rows()[0].querySelector('[data-action="delete"]').dispatchEvent(new Event("click", { bubbles: true }));
    await flushMicrotasks();
    document.querySelector("#cp-confirm-cancel").click();
    await flushMicrotasks();
    assert.equal((globalThis.__DELETE_DOC_CALLS__ || []).length, 0);
    assert.equal(rows().length, 2);
  });

  test("ยืนยันลบ แล้วกด 'เลิกทำ' ทันที → ไม่ลบจริง, รายการกลับมาแสดงเหมือนเดิม", async () => {
    rows()[0].querySelector('[data-action="delete"]').dispatchEvent(new Event("click", { bubbles: true }));
    await flushMicrotasks();
    document.querySelector("#cp-confirm-ok").click();
    await flushMicrotasks();
    assert.equal(rows().length, 1); // q-1 หายไปชั่วคราว
    const undoBtn = document.querySelector(".cp-toast-undo-btn");
    assert.ok(undoBtn, "ต้องมี toast เลิกทำโผล่ขึ้นมา");
    undoBtn.click();
    await flushMicrotasks();
    assert.equal((globalThis.__DELETE_DOC_CALLS__ || []).length, 0);
    assert.equal(rows().length, 2, "กด 'เลิกทำ' แล้วรายการต้องกลับมาครบ");
  });

  test("ยืนยันลบ แล้วปล่อยผ่านจนหมดเวลา (5000ms) → deleteQuotation() ถูกเรียกจริง", async (t) => {
    const flushReal = () => new Promise((r) => setImmediate(r));
    t.mock.timers.enable({ apis: ["setTimeout"] });
    rows()[0].querySelector('[data-action="delete"]').dispatchEvent(new Event("click", { bubbles: true }));
    await flushReal();
    document.querySelector("#cp-confirm-ok").click();
    await flushReal();
    t.mock.timers.tick(5000);
    await flushReal();
    await flushReal();
    assert.equal(globalThis.__DELETE_DOC_CALLS__.length, 1);
    assert.equal(globalThis.__DELETE_DOC_CALLS__[0].path, "quotations/q-1");
    t.mock.timers.reset();
  });
});

describe("ปุ่ม 'สร้างใหม่' เปิดฟอร์มจริง (รอบย่อย 4) / 'สร้างจากคำขอ' เปิดโมดัลเลือกคำขอจริง (รอบย่อย 5)", () => {
  test("คลิก 'สร้างใบเสนอราคาใหม่' → เปิดโมดัลฟอร์มจริง (ad-q-overlay) ไม่ใช่แค่ toast แล้ว", () => {
    field("ad-q-add-btn").click();
    assert.equal(document.getElementById("ad-q-overlay").style.display, "flex");
    document.getElementById("ad-q-overlay").style.display = "none"; // เก็บกวาดกันชนกับเทสถัดไป
  });

  test("คลิก 'สร้างจากคำขอ' → เปิดโมดัลเลือกคำขอจริง (ad-qr-overlay) ไม่ใช่ toast placeholder แล้ว", () => {
    triggerQuotationsSnapshot([]);
    triggerQuoteRequestsSnapshot([makeQuoteRequest({ id: "qr-1" })]);
    field("ad-q-add-from-request-btn").click();
    assert.equal(document.getElementById("ad-qr-overlay").style.display, "flex");
    const toast = document.querySelector(".cp-toast-wrap .cp-toast");
    assert.ok(!toast, "ต้องไม่มี toast placeholder โผล่ขึ้นมาอีกแล้ว");
    document.getElementById("ad-qr-overlay").style.display = "none";
  });
});

describe("โมดัลเลือกคำขอใบเสนอราคา (ad-qr-overlay, รอบย่อย 5)", () => {
  beforeEach(() => {
    document.getElementById("ad-qr-overlay").style.display = "none";
    document.getElementById("ad-q-overlay").style.display = "none";
  });

  test("startQuoteRequestsListener() ผูกไปพร้อมกับ startQuotationsListener() — listener ของ 'quote_requests' พร้อมใช้แล้ว", () => {
    assert.equal(typeof globalThis.__SNAPSHOT_LISTENERS__["quote_requests"], "function");
  });

  test("ไม่มีคำขอเลย → ข้อความว่างเปล่าในโมดัล", () => {
    triggerQuotationsSnapshot([]);
    triggerQuoteRequestsSnapshot([]);
    field("ad-q-add-from-request-btn").click();
    assert.match(field("ad-qr-list-body").innerHTML, /ไม่มีคำขอใบเสนอราคาที่ยังไม่ถูกแปลง/);
    assert.equal(qrRows().length, 0);
  });

  test("มีคำขอที่ยังไม่ถูกแปลง → แสดงในรายการ พร้อมชื่อลูกค้า/จำนวนรายการ", () => {
    triggerQuotationsSnapshot([]);
    triggerQuoteRequestsSnapshot([makeQuoteRequest({ id: "qr-1", billingName: "บริษัท เอ จำกัด", items: [{ name: "ป้าย A" }, { name: "ป้าย B" }] })]);
    field("ad-q-add-from-request-btn").click();
    assert.equal(qrRows().length, 1);
    assert.match(qrRows()[0].innerHTML, /บริษัท เอ จำกัด/);
    assert.match(qrRows()[0].innerHTML, /2 รายการ/);
  });

  test("คำขอที่แปลงเป็นใบเสนอราคาไปแล้ว (มี quotation ที่ requestId ตรงกัน) → ถูกกรองออกจากรายการ", () => {
    triggerQuotationsSnapshot([makeQuotation({ id: "q-1", requestId: "qr-1" })]);
    triggerQuoteRequestsSnapshot([
      makeQuoteRequest({ id: "qr-1" }),
      makeQuoteRequest({ id: "qr-2", billingName: "บริษัท บี จำกัด" })
    ]);
    field("ad-q-add-from-request-btn").click();
    assert.equal(qrRows().length, 1);
    assert.match(qrRows()[0].innerHTML, /บริษัท บี จำกัด/);
  });

  test("คลิก 'ใช้คำขอนี้' → ปิดโมดัลเลือกคำขอ, เปิดฟอร์มใบเสนอราคาแบบ prefill", () => {
    triggerQuotationsSnapshot([]);
    triggerQuoteRequestsSnapshot([makeQuoteRequest({ id: "qr-1", billingName: "บริษัท ซี จำกัด" })]);
    field("ad-q-add-from-request-btn").click();
    qrRows()[0].querySelector('[data-action="use"]').dispatchEvent(new Event("click", { bubbles: true }));
    assert.equal(document.getElementById("ad-qr-overlay").style.display, "none");
    assert.equal(document.getElementById("ad-q-overlay").style.display, "flex");
    assert.equal(field("ad-q-billing-name").value, "บริษัท ซี จำกัด");
    document.getElementById("ad-q-overlay").style.display = "none";
  });

  test("กด 'ปิด' ในโมดัลเลือกคำขอ → ปิดโมดัลโดยไม่เปิดฟอร์มใดๆ", () => {
    triggerQuotationsSnapshot([]);
    triggerQuoteRequestsSnapshot([makeQuoteRequest({ id: "qr-1" })]);
    field("ad-q-add-from-request-btn").click();
    document.getElementById("ad-qr-cancel").click();
    assert.equal(document.getElementById("ad-qr-overlay").style.display, "none");
    assert.equal(document.getElementById("ad-q-overlay").style.display, "none");
  });
});

describe("โมดัลเลือกคำขอใบเสนอราคา — ปุ่มลบคำขอ (data-action=\"delete\")", () => {
  beforeEach(() => {
    document.getElementById("ad-qr-overlay").style.display = "none";
    document.getElementById("ad-q-overlay").style.display = "none";
    triggerQuotationsSnapshot([]);
    triggerQuoteRequestsSnapshot([makeQuoteRequest({ id: "qr-1", billingName: "บริษัท ดี จำกัด" })]);
    field("ad-q-add-from-request-btn").click();
  });

  test("แต่ละแถวมีปุ่มลบ นอกเหนือจากปุ่ม 'ใช้คำขอนี้'", () => {
    assert.ok(qrRows()[0].querySelector('[data-action="use"]'));
    assert.ok(qrRows()[0].querySelector('[data-action="delete"]'));
  });

  test("คลิกลบ → เปิด confirmDialog ข้อความมีชื่อลูกค้าอยู่ในนั้น", async () => {
    qrRows()[0].querySelector('[data-action="delete"]').dispatchEvent(new Event("click", { bubbles: true }));
    await flushMicrotasks();
    const co = document.querySelector(".cp-confirm-overlay");
    assert.equal(co.style.display, "flex");
    assert.match(co.querySelector("#cp-confirm-msg").textContent, /บริษัท ดี จำกัด/);
  });

  test("กด 'ยกเลิก' บน confirm → ไม่ลบ, ไม่เรียก deleteDoc, แถวยังอยู่", async () => {
    qrRows()[0].querySelector('[data-action="delete"]').dispatchEvent(new Event("click", { bubbles: true }));
    await flushMicrotasks();
    document.querySelector("#cp-confirm-cancel").click();
    await flushMicrotasks();
    assert.equal((globalThis.__DELETE_DOC_CALLS__ || []).length, 0);
    assert.equal(qrRows().length, 1);
  });

  test("ยืนยันลบ แล้วกด 'เลิกทำ' ทันที → ไม่ลบจริง, แถวกลับมาแสดงเหมือนเดิม", async () => {
    qrRows()[0].querySelector('[data-action="delete"]').dispatchEvent(new Event("click", { bubbles: true }));
    await flushMicrotasks();
    document.querySelector("#cp-confirm-ok").click();
    await flushMicrotasks();
    assert.equal(qrRows().length, 0); // qr-1 หายไปชั่วคราว
    const undoBtn = document.querySelector(".cp-toast-undo-btn");
    assert.ok(undoBtn, "ต้องมี toast เลิกทำโผล่ขึ้นมา");
    undoBtn.click();
    await flushMicrotasks();
    assert.equal((globalThis.__DELETE_DOC_CALLS__ || []).length, 0);
    assert.equal(qrRows().length, 1, "กด 'เลิกทำ' แล้วแถวต้องกลับมา");
  });

  test("ยืนยันลบ แล้วปล่อยผ่านจนหมดเวลา (5000ms) → deleteQuoteRequest() ถูกเรียกจริงกับ collection quote_requests", async (t) => {
    const flushReal = () => new Promise((r) => setImmediate(r));
    t.mock.timers.enable({ apis: ["setTimeout"] });
    qrRows()[0].querySelector('[data-action="delete"]').dispatchEvent(new Event("click", { bubbles: true }));
    await flushReal();
    document.querySelector("#cp-confirm-ok").click();
    await flushReal();
    t.mock.timers.tick(5000);
    await flushReal();
    await flushReal();
    assert.equal(globalThis.__DELETE_DOC_CALLS__.length, 1);
    assert.equal(globalThis.__DELETE_DOC_CALLS__[0].path, "quote_requests/qr-1");
    t.mock.timers.reset();
  });
});

describe("ปุ่ม 'แก้ไข' ต่อแถว (รอบย่อย 4)", () => {
  test("คลิกปุ่มแก้ไขในแถว → เปิดโมดัลฟอร์มแก้ไข prefill quoteNo ของแถวนั้น", () => {
    triggerQuotationsSnapshot([makeQuotation({ id: "q-1", quoteNo: "QT2026-0001" })]);
    rows()[0].querySelector('[data-action="edit"]').dispatchEvent(new Event("click", { bubbles: true }));
    assert.equal(document.getElementById("ad-q-overlay").style.display, "flex");
    assert.match(document.getElementById("ad-q-modal-title").textContent, /QT2026-0001/);
    document.getElementById("ad-q-overlay").style.display = "none";
  });
});

// ── คลิกทั้งแถว (ไม่ใช่ปุ่ม) → เปิดข้อมูลให้ดูทันที ไม่ต้องกด "แก้ไข" ก่อน ──────────────────
// UX ตรงกับแท็บ "คำสั่งผลิต" (js/orders-tab.js): ทั้งแถวคลิกได้ (มี class cp-row-clickable),
// เปิดฟอร์มเดิม (มีข้อมูลครบทุกช่องอยู่แล้ว ใช้เป็นทั้งหน้าดู/แก้ไขในตัว) โดยไม่ต้องเล็งคลิก
// ปุ่มไอคอนเล็กๆ ก่อน — เหมาะกับผู้ใช้ที่ไม่ถนัด IT
describe("คลิกทั้งแถว (ไม่ใช่ปุ่ม) → เปิดข้อมูลใบเสนอราคาให้ดูทันที", () => {
  test("แถวมี class cp-row-clickable", () => {
    triggerQuotationsSnapshot([makeQuotation({ id: "q-1", quoteNo: "QT2026-0001" })]);
    assert.ok(rows()[0].classList.contains("cp-row-clickable"));
  });

  test("คลิกที่เซลล์ข้อมูล (เช่นชื่อลูกค้า) → เปิดโมดัลฟอร์มเดิม prefill quoteNo ของแถวนั้น", () => {
    triggerQuotationsSnapshot([makeQuotation({ id: "q-1", quoteNo: "QT2026-0001" })]);
    rows()[0].querySelector("td").dispatchEvent(new Event("click", { bubbles: true }));
    assert.equal(document.getElementById("ad-q-overlay").style.display, "flex");
    assert.match(document.getElementById("ad-q-modal-title").textContent, /QT2026-0001/);
    document.getElementById("ad-q-overlay").style.display = "none";
  });
});

// ── ปุ่ม "ดูใบเสนอราคา" ต่อแถว — เปิดหน้า public ในแท็บใหม่ทันที ไม่ต้องคัดลอกลิงก์ไปวางเอง ──
describe("ปุ่ม 'ดูใบเสนอราคา' ต่อแถว", () => {
  let openCalls;
  let originalOpen;

  beforeEach(() => {
    openCalls = [];
    originalOpen = globalThis.window.open;
    globalThis.window.open = (...args) => { openCalls.push(args); return null; };
  });

  afterEach(() => {
    globalThis.window.open = originalOpen;
  });

  test("มี publicToken → ปุ่มไม่ disabled, title บอกว่าดูใบเสนอราคา", () => {
    triggerQuotationsSnapshot([makeQuotation({ id: "q-1", publicToken: "tok-abc-123" })]);
    const btn = rows()[0].querySelector('[data-action="view"]');
    assert.equal(btn.hasAttribute("disabled"), false);
    assert.match(btn.title, /ดูใบเสนอราคา/);
  });

  test("คลิกปุ่ม → เปิดแท็บใหม่ไปยัง URL public ที่ถูกต้อง (origin + /quotation-view.html?token=...)", () => {
    triggerQuotationsSnapshot([makeQuotation({ id: "q-1", publicToken: "tok-abc-123" })]);
    rows()[0].querySelector('[data-action="view"]').dispatchEvent(new Event("click", { bubbles: true }));
    assert.equal(openCalls.length, 1);
    assert.equal(openCalls[0][0], `${window.location.origin}/quotation-view.html?token=tok-abc-123`);
    assert.equal(openCalls[0][1], "_blank");
  });

  test("ไม่มี publicToken → ปุ่ม disabled + title อธิบายเหตุผล", () => {
    triggerQuotationsSnapshot([makeQuotation({ id: "q-1", publicToken: undefined })]);
    const btn = rows()[0].querySelector('[data-action="view"]');
    assert.equal(btn.hasAttribute("disabled"), true);
    assert.match(btn.title, /ยังไม่มีลิงก์สาธารณะ/);
  });

  test("ไม่มี publicToken แล้วยังสั่งคลิกได้ (เช่นผ่าน script) → ไม่เปิดแท็บใหม่, แจ้ง toast แทน", () => {
    triggerQuotationsSnapshot([makeQuotation({ id: "q-1", publicToken: undefined })]);
    rows()[0].querySelector('[data-action="view"]').dispatchEvent(new Event("click", { bubbles: true }));
    assert.equal(openCalls.length, 0, "ไม่ควรมีการเรียก window.open() เลย");
    const toast = document.querySelector(".cp-toast-wrap .cp-toast");
    assert.ok(toast, "ต้องมี toast แจ้งเหตุผล");
    assert.match(toast.textContent, /ยังไม่มีลิงก์สาธารณะ/);
  });
});

// ── ปุ่ม "คัดลอกเป็นฉบับร่างใหม่" ต่อแถว (P3.0 Phase 6 รอบ 11) ─────────────────────────────
// เรียก openQuotationFormFromClone() (js/admin-quotations-form.js) — เปิดฟอร์มให้แอดมินตรวจ/แก้
// ก่อนบันทึกจริง ไม่บันทึกอัตโนมัติทันทีที่กด (ดูเหตุผลในคอมเมนต์หัวฟังก์ชันนั้น) — เทสนี้เช็คแค่ว่า
// โมดัลเปิดจริง + หัวข้อโมดัลถูกต้อง + prefill ข้อมูลลูกค้ามาจากแถวที่คลิกถูกต้อง (ไม่เช็ค submit
// ซ้ำที่นี่ เพราะ submit handler เดิมของฟอร์มใช้ path เดียวกับโหมดอื่นอยู่แล้ว ทดสอบละเอียดกว่าไว้ที่
// test/admin-quotations-form.test.mjs แทน)
describe("ปุ่ม 'คัดลอกเป็นฉบับร่างใหม่' ต่อแถว (P3.0 Phase 6 รอบ 11)", () => {
  test("คลิกปุ่ม clone ในแถว → เปิดโมดัลฟอร์ม หัวข้อ 'คัดลอกเป็นฉบับร่างใหม่' + prefill ชื่อลูกค้าเดิม", () => {
    triggerQuotationsSnapshot([makeQuotation({ id: "q-1", quoteNo: "QT2026-0001", billingName: "บริษัท โคลน จำกัด" })]);
    rows()[0].querySelector('[data-action="clone"]').dispatchEvent(new Event("click", { bubbles: true }));
    assert.equal(document.getElementById("ad-q-overlay").style.display, "flex");
    assert.match(document.getElementById("ad-q-modal-title").textContent, /คัดลอกเป็นฉบับร่างใหม่/);
    assert.equal(document.getElementById("ad-q-billing-name").value, "บริษัท โคลน จำกัด");
    assert.equal(document.getElementById("ad-q-status").value, "draft");
    document.getElementById("ad-q-overlay").style.display = "none";
  });

  test("ปุ่ม clone มี title อธิบายชัดเจน", () => {
    triggerQuotationsSnapshot([makeQuotation({ id: "q-1" })]);
    const btn = rows()[0].querySelector('[data-action="clone"]');
    assert.ok(btn, "ต้องมีปุ่ม clone ในแถว");
    assert.match(btn.title, /คัดลอกเป็นฉบับร่างใหม่/);
  });
});

// ── ปุ่ม "คัดลอกลิงก์" ต่อแถว (P3.0 Phase 4 รอบ 3) ────────────────────────────────────────
// JSDOM ไม่มี navigator.clipboard ให้โดย default — mock ด้วย stub เก็บค่าที่ถูกเรียก แล้วลบทิ้ง
// ใน afterEach ถัดไปด้วย beforeEach (ประกาศ describe-local แทนแก้ before()/beforeEach() หลักของ
// ไฟล์ เพื่อไม่กระทบเทสชุดอื่นที่ไม่เกี่ยวกับ clipboard เลย)
describe("ปุ่ม 'คัดลอกลิงก์' ต่อแถว (Phase 4 รอบ 3)", () => {
  let writeTextCalls;

  beforeEach(() => {
    writeTextCalls = [];
    Object.defineProperty(globalThis.navigator, "clipboard", {
      value: { writeText: (text) => { writeTextCalls.push(text); return Promise.resolve(); } },
      configurable: true
    });
  });

  test("มี publicToken → ปุ่มไม่ disabled, title บอกให้คัดลอกลิงก์ลูกค้า", () => {
    triggerQuotationsSnapshot([makeQuotation({ id: "q-1", publicToken: "tok-abc-123" })]);
    const btn = rows()[0].querySelector('[data-action="copy-link"]');
    assert.equal(btn.hasAttribute("disabled"), false);
    assert.match(btn.title, /คัดลอกลิงก์ให้ลูกค้า/);
  });

  test("คลิกปุ่ม → คัดลอก URL ถูกต้องเข้า clipboard (origin + /quotation-view.html?token=...)", async () => {
    triggerQuotationsSnapshot([makeQuotation({ id: "q-1", publicToken: "tok-abc-123" })]);
    rows()[0].querySelector('[data-action="copy-link"]').dispatchEvent(new Event("click", { bubbles: true }));
    await flushMicrotasks();
    assert.equal(writeTextCalls.length, 1);
    assert.equal(writeTextCalls[0], `${window.location.origin}/quotation-view.html?token=tok-abc-123`);
  });

  test("คัดลอกสำเร็จ → แสดง toast แจ้งผล", async () => {
    triggerQuotationsSnapshot([makeQuotation({ id: "q-1", publicToken: "tok-abc-123" })]);
    rows()[0].querySelector('[data-action="copy-link"]').dispatchEvent(new Event("click", { bubbles: true }));
    await flushMicrotasks();
    const toast = document.querySelector(".cp-toast-wrap .cp-toast");
    assert.ok(toast, "ต้องมี toast แสดงขึ้น");
    assert.match(toast.textContent, /คัดลอกลิงก์ใบเสนอราคาแล้ว/);
  });

  test("token มีอักขระพิเศษ → encodeURIComponent ก่อนต่อ URL", async () => {
    triggerQuotationsSnapshot([makeQuotation({ id: "q-1", publicToken: "tok/with+special=chars" })]);
    rows()[0].querySelector('[data-action="copy-link"]').dispatchEvent(new Event("click", { bubbles: true }));
    await flushMicrotasks();
    assert.equal(writeTextCalls[0], `${window.location.origin}/quotation-view.html?token=${encodeURIComponent("tok/with+special=chars")}`);
  });

  test("ไม่มี publicToken (เอกสารเก่าก่อน Phase 4) → ปุ่ม disabled + title อธิบายเหตุผล", () => {
    triggerQuotationsSnapshot([makeQuotation({ id: "q-1", publicToken: undefined })]);
    const btn = rows()[0].querySelector('[data-action="copy-link"]');
    assert.equal(btn.hasAttribute("disabled"), true);
    assert.match(btn.title, /ยังไม่มีลิงก์สาธารณะ/);
  });

  test("ไม่มี publicToken แล้วยังสั่งคลิกได้ (เช่นผ่าน script) → ไม่คัดลอกอะไร, แจ้ง toast แทน", async () => {
    triggerQuotationsSnapshot([makeQuotation({ id: "q-1", publicToken: undefined })]);
    rows()[0].querySelector('[data-action="copy-link"]').dispatchEvent(new Event("click", { bubbles: true }));
    await flushMicrotasks();
    assert.equal(writeTextCalls.length, 0, "ไม่ควรมีการเรียก clipboard.writeText() เลย");
    const toast = document.querySelector(".cp-toast-wrap .cp-toast");
    assert.ok(toast, "ต้องมี toast แจ้งเหตุผล");
    assert.match(toast.textContent, /ยังไม่มีลิงก์สาธารณะ/);
  });

  test("clipboard.writeText() reject → แจ้ง toast ว่าคัดลอกไม่สำเร็จ", async () => {
    Object.defineProperty(globalThis.navigator, "clipboard", {
      value: { writeText: () => Promise.reject(new Error("denied")) },
      configurable: true
    });
    triggerQuotationsSnapshot([makeQuotation({ id: "q-1", publicToken: "tok-abc-123" })]);
    rows()[0].querySelector('[data-action="copy-link"]').dispatchEvent(new Event("click", { bubbles: true }));
    await flushMicrotasks();
    const toast = document.querySelector(".cp-toast-wrap .cp-toast");
    assert.ok(toast, "ต้องมี toast แจ้งเหตุผล");
    assert.match(toast.textContent, /คัดลอกลิงก์ไม่สำเร็จ/);
  });
});

// ── ปุ่ม "ส่งออก CSV" (P3.0 Phase 6 รอบ 12, ad-q-export-csv-btn) ────────────────────────────
function exportCsv() { document.getElementById("ad-q-export-csv-btn").click(); }
function csvQ(s) { return `"${String(s ?? "").replace(/"/g, '""')}"`; }
const Q_CSV_HEADER = "เลขที่เอกสาร,วันที่สร้าง,ลูกค้า,ยอดสุทธิ (บาท),สถานะ,วันหมดอายุ";

describe("ปุ่ม 'ส่งออก CSV' (ad-q-export-csv-btn) — P3.0 Phase 6 รอบ 12", () => {
  test("allQuotations ว่างเปล่า → toast error 'ไม่มีข้อมูลให้ส่งออก', ไม่สร้าง Blob เลย", () => {
    triggerQuotationsSnapshot([]);
    exportCsv();

    assert.equal(lastBlobRef, null, "ต้องไม่มีการสร้าง Blob เลยเมื่อไม่มีข้อมูล");
    assert.deepEqual(createObjectURLCalls, []);
    const toast = document.querySelector(".cp-toast-wrap .cp-toast.error");
    assert.ok(toast);
    assert.equal(toast.textContent, "ไม่มีข้อมูลให้ส่งออก");
  });

  test("มีข้อมูล → Blob มี BOM นำหน้า + header row + data row ตรงตามสูตรทุก field, ไม่กรองอะไรเลย (แท็บนี้ไม่มี filter)", () => {
    const createdAt = { toMillis: () => Date.parse("2026-03-15T10:30:00Z") };
    triggerQuotationsSnapshot([
      makeQuotation({ id: "q-1", quoteNo: "QT2026-0001", billingName: "บริษัท ทดสอบ จำกัด",
        contactPerson: "คุณสมชาย", grandTotal: 10700, status: "sent", validUntil: "2026-04-01", createdAt }),
      makeQuotation({ id: "q-2", quoteNo: "QT2026-0002", billingName: "", contactPerson: "คุณสมหญิง",
        grandTotal: 5000, status: "draft", validUntil: "", createdAt })
    ]);
    exportCsv();

    assert.equal(lastBlobParts.length, 1);
    const raw = lastBlobParts[0];
    assert.equal(raw.charCodeAt(0), 0xFEFF, "ตัวอักษรแรกต้องเป็น BOM — เช็คจาก parts ดิบ ไม่ใช่ .text() เพราะ Node ตัด BOM ทิ้งตอน decode");
    const lines = raw.slice(1).split("\r\n");
    assert.equal(lines[0], Q_CSV_HEADER);
    assert.equal(lines.length, 3); // header + 2 quotations
    assert.equal(lines[1], [csvQ("QT2026-0001"), csvQ("2026-03-15"), csvQ("บริษัท ทดสอบ จำกัด"), 10700, csvQ("ส่งลูกค้าแล้ว"), csvQ("2026-04-01")].join(","));
    // q-2: billingName ว่าง -> fallback contactPerson ("คุณสมหญิง"), validUntil ว่าง -> csvCell("") = ""(quoted empty)
    assert.equal(lines[2], [csvQ("QT2026-0002"), csvQ("2026-03-15"), csvQ("คุณสมหญิง"), 5000, csvQ("ร่าง"), csvQ("")].join(","));

    assert.equal(lastBlobOptions.type, "text/csv;charset=utf-8;");
  });

  test("createdAt ไม่มีค่า (falsy) → คอลัมน์วันที่สร้างเป็นค่าว่าง (ไม่ throw)", () => {
    triggerQuotationsSnapshot([makeQuotation({ id: "q-1", quoteNo: "QT2026-0003", createdAt: undefined })]);
    exportCsv();

    const lines = lastBlobParts[0].slice(1).split("\r\n");
    assert.equal(lines[1], [csvQ("QT2026-0003"), csvQ(""), csvQ("บริษัท ทดสอบ จำกัด"), 10700, csvQ("ร่าง"), csvQ("")].join(","));
  });

  test("status ไม่อยู่ใน QUOTATION_STATUS_LABEL (ข้อมูลแปลกปลอม) → แสดง status ดิบแทน label", () => {
    triggerQuotationsSnapshot([makeQuotation({ id: "q-1", quoteNo: "QT2026-0004", status: "unknown_status" })]);
    exportCsv();

    const lines = lastBlobParts[0].slice(1).split("\r\n");
    assert.ok(lines[1].includes(csvQ("unknown_status")));
  });

  test("grandTotal เป็น undefined → fallback เป็น 0 ในคอลัมน์ยอดสุทธิ (ไม่ใช่ค่าว่าง/NaN)", () => {
    triggerQuotationsSnapshot([makeQuotation({ id: "q-1", quoteNo: "QT2026-0005", grandTotal: undefined })]);
    exportCsv();

    const lines = lastBlobParts[0].slice(1).split("\r\n");
    const cells = lines[1].split(",");
    assert.equal(cells[3], "0");
  });

  test("Blob ถูกส่งเข้า URL.createObjectURL() ตัวเดียวกันจริง + สร้าง <a download> ถูกต้อง + click() + remove() + revokeObjectURL() + toast success", () => {
    triggerQuotationsSnapshot([makeQuotation({ id: "q-1" })]);
    exportCsv();

    assert.equal(createObjectURLCalls.length, 1);
    assert.equal(createObjectURLCalls[0], lastBlobRef);

    const a = globalThis.__lastAnchor;
    assert.ok(a, "ต้องมีการสร้าง <a> element");
    assert.equal(a.download, `quotations-${new Date().toISOString().slice(0,10)}.csv`);
    assert.ok(a.__clicked, "ต้องเรียก a.click()");
    assert.equal(document.body.contains(a), false, "a ต้องถูก remove() ออกจาก DOM แล้วหลังคลิก");

    assert.equal(revokeObjectURLCalls.length, 1);
    assert.equal(revokeObjectURLCalls[0], a.href);

    const toast = document.querySelector(".cp-toast-wrap .cp-toast.success");
    assert.ok(toast);
    assert.equal(toast.textContent, "ส่งออก CSV แล้ว");
  });
});
