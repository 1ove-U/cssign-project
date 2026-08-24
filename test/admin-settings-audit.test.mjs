// test/admin-settings-audit.test.mjs — รอบที่ 120
//
// ขอบเขต: js/admin-settings-audit.js (149 บรรทัด) — แท็บ SETTINGS ย่อย "ประวัติการทำงาน"
// (Audit Log) — อ่านอย่างเดียว โหลด 200 รายการล่าสุดจาก listAuditLog() แล้วกรอง/แสดงฝั่ง client
// ล้วนๆ (การกระทำ/คน/ช่วงวันที่ ไม่ยิง query ใหม่ทุกครั้งที่เปลี่ยนตัวกรอง) + ปุ่มส่งออก CSV
// (auditLogToCSV()) — ไม่ import admin-page.js/admin-state.js/admin-leads.js เลย จึงไม่ต้องใช้
// admin-page-stub-loader.mjs
//
// ไฟล์นี้ import listAuditLog/auditLogToCSV จาก js/db.js ตรงๆ ซึ่ง import Firebase SDK URL ต่อ
// จึงต้องพึ่ง test/helpers/firebase-stub-loader.mjs — listAuditLog() เรียก getDocs(query(...))
// ของ stub (ควบคุมผลลัพธ์ผ่าน globalThis.__GET_DOCS_STUB__ รับ ref ที่มี .path === "auditLog")
// — ให้ stub throw ได้ตรงๆ เพื่อจำลอง path error (บัญชี role staff ถูก Firestore rules ปฏิเสธ
// การอ่าน) เพราะ getDocs() ของ stub เรียก stub(ref) แบบ synchronous ก่อน wrap เป็น promise เอง
// (ดู getDocs() ใน firebase-stub-loader.mjs) — exception ที่ throw จากใน stub จะกลายเป็น rejected
// promise โดยอัตโนมัติเพราะ listAuditLog() เป็น async function ครอบอยู่
//
// ปุ่มส่งออก CSV ใช้ Blob/URL.createObjectURL/URL.revokeObjectURL/<a download>.click() แบบเดียวกับ
// js/orders-tab-export.js — ใช้แพทเทิร์นเดียวกับ test/orders-tab-export.test.mjs รอบ 97 ทุกประการ:
// Blob/URL.createObjectURL/revokeObjectURL เป็นของจริงจาก Node global (ไฟล์นี้ไม่เคยตั้ง
// globalThis.Blob/URL ให้ชี้ jsdom เอง) จึง monkey-patch แค่ "สอดแนม" เพิ่ม ไม่ต้อง stub ให้รันได้
// — stub HTMLAnchorElement.prototype.click ให้เป็น no-op กัน jsdom navigation-not-implemented log
//
// ตรวจโค้ดจริงทั้งไฟล์ js/admin-settings-audit.js + listAuditLog()/auditLogToCSV() ใน js/db.js
// ก่อนเขียนเทสนี้ (อ่านครบ) — ไม่พบบั๊ก จึงเป็นไฟล์เทสล้วนๆ ไม่มีการแก้โค้ดผลิตภัณฑ์เลยแม้แต่บรรทัด
// เดียว

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
let mod; // admin-settings-audit.js exports
let auditLogToCSV; // js/db.js — ใช้เทียบผลลัพธ์ CSV จริงในเทสส่งออก

// ── สอดแนม Blob / URL.createObjectURL / URL.revokeObjectURL (ของจริงจาก Node global) ──
let lastBlobParts, lastBlobOptions;
let createObjectURLCalls, revokeObjectURLCalls;
const OriginalBlob = globalThis.Blob;
const originalCreateObjectURL = globalThis.URL.createObjectURL.bind(globalThis.URL);
const originalRevokeObjectURL = globalThis.URL.revokeObjectURL.bind(globalThis.URL);

function makeRow(over = {}) {
  return {
    id: "log1", action: "update", targetType: "order", targetId: "o1",
    meta: "", email: "a@x.com", uid: "uid-a", createdAt: Date.now(),
    ...over,
  };
}

let getDocsCallCount = 0;
function setAuditStub(rows) {
  globalThis.__GET_DOCS_STUB__ = (ref) => {
    if (ref && ref.path === "auditLog") {
      getDocsCallCount++;
      if (typeof rows === "function") return rows();
      return rows.map(r => ({ id: r.id, data: r }));
    }
    return [];
  };
}

before(async () => {
  const dom = new JSDOM(`<!doctype html><html><body>${ADMIN_BODY_NO_SCRIPTS}</body></html>`, {
    url: "https://example.test/",
  });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
  globalThis.Event = dom.window.Event;
  globalThis.HTMLElement = dom.window.HTMLElement;

  // stub <a>.click() กัน jsdom navigation-not-implemented log (ดูหมายเหตุหัวไฟล์)
  dom.window.HTMLAnchorElement.prototype.click = function () { this.__clicked = true; };
  const originalCreateElement = dom.window.document.createElement.bind(dom.window.document);
  globalThis.__lastAnchor = null;
  dom.window.document.createElement = function (tag) {
    const el = originalCreateElement(tag);
    if (String(tag).toLowerCase() === "a") globalThis.__lastAnchor = el;
    return el;
  };

  document = dom.window.document;
  mod = await import("../js/admin-settings-audit.js");
  ({ auditLogToCSV } = await import("../js/db.js"));
});

beforeEach(() => {
  globalThis.__ADD_DOC_CALLS__ = [];
  globalThis.__GET_DOCS_STUB__ = undefined;
  getDocsCallCount = 0;
  document.getElementById("ad-audit-list").innerHTML = "";
  document.getElementById("ad-audit-list-count").textContent = "";
  document.getElementById("ad-audit-filter-action").value = "";
  document.getElementById("ad-audit-filter-user").innerHTML = `<option value="">ทุกคน</option>`;
  document.getElementById("ad-audit-filter-from").value = "";
  document.getElementById("ad-audit-filter-to").value = "";
  document.querySelectorAll(".cp-toast-wrap .cp-toast").forEach(el => el.remove());
  document.getElementById("ad-audit-export").disabled = false;

  lastBlobParts = lastBlobOptions = null;
  createObjectURLCalls = [];
  revokeObjectURLCalls = [];
  class SpyBlob extends OriginalBlob {
    constructor(parts, opts) {
      super(parts, opts);
      lastBlobParts = parts;
      lastBlobOptions = opts;
    }
  }
  globalThis.Blob = SpyBlob;
  globalThis.URL.createObjectURL = (blob) => { createObjectURLCalls.push(blob); return originalCreateObjectURL(blob); };
  globalThis.URL.revokeObjectURL = (url) => { revokeObjectURLCalls.push(url); return originalRevokeObjectURL(url); };
  globalThis.__lastAnchor = null;
});

function flushMicrotasks() {
  return new Promise((r) => setTimeout(r, 0));
}

function lastToast(kind) {
  const els = document.querySelectorAll(`.cp-toast-wrap .cp-toast.${kind}`);
  return els.length ? els[els.length - 1] : null;
}

describe("fmtAuditTime(ts)", () => {
  test("falsy (null/undefined/0/'') → คืนค่าว่างเปล่าเสมอ", () => {
    assert.equal(mod.fmtAuditTime(null), "");
    assert.equal(mod.fmtAuditTime(undefined), "");
    assert.equal(mod.fmtAuditTime(0), "");
    assert.equal(mod.fmtAuditTime(""), "");
  });

  test("ts เป็น Firestore Timestamp-like (มี .toMillis()) → format ตรงกับ toLocaleString('th-TH', {dateStyle:'short',timeStyle:'short'})", () => {
    const ms = Date.now();
    const ts = { toMillis: () => ms };
    const expected = new Date(ms).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" });
    assert.equal(mod.fmtAuditTime(ts), expected);
  });

  test("ts เป็นตัวเลข millis ดิบ (ไม่มี .toMillis) → ใช้ตรงๆ ผ่าน new Date(ts)", () => {
    const ms = Date.now();
    const expected = new Date(ms).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" });
    assert.equal(mod.fmtAuditTime(ms), expected);
  });

  test("ts ที่ parse เป็นวันที่ไม่ได้ (invalid) → คืนค่าว่างเปล่า", () => {
    assert.equal(mod.fmtAuditTime("ไม่ใช่วันที่"), "");
  });
});

describe("AUDIT_ACTION_LABEL", () => {
  test("มีแค่ 3 คีย์ delete/update/create ตรงตามที่ประกาศไว้", () => {
    assert.deepEqual(mod.AUDIT_ACTION_LABEL, { delete: "ลบ", update: "แก้ไข", create: "เพิ่ม" });
  });
});

describe("renderAuditLog() — โหลดสำเร็จ", () => {
  test("มีข้อมูล → เติมกล่องรายการ + ตัวนับ 'แสดง N จาก M รายการที่โหลดไว้'", async () => {
    setAuditStub([
      makeRow({ id: "l1", action: "create", email: "b@x.com" }),
      makeRow({ id: "l2", action: "delete", email: "a@x.com" }),
    ]);
    await mod.renderAuditLog();
    assert.equal(document.getElementById("ad-audit-list-count").textContent, "แสดง 2 จาก 2 รายการที่โหลดไว้");
    assert.equal(document.querySelectorAll("#ad-audit-list .ad-audit-row").length, 2);
  });

  test("ไม่มีข้อมูลเลย (auditRawRows ว่างเปล่า) → ตัวนับว่างเปล่า + ข้อความ 'ยังไม่มีประวัติ'", async () => {
    setAuditStub([]);
    await mod.renderAuditLog();
    assert.equal(document.getElementById("ad-audit-list-count").textContent, "");
    assert.match(document.getElementById("ad-audit-list").innerHTML, /ยังไม่มีประวัติ/);
  });

  test("ระหว่างโหลด กล่องแสดง 'กำลังโหลด…' ทันที (เช็คก่อน await resolve)", () => {
    setAuditStub([makeRow()]);
    const p = mod.renderAuditLog();
    assert.match(document.getElementById("ad-audit-list").innerHTML, /กำลังโหลด/);
    return p;
  });

  test("การกระทำที่รู้จัก (create/update/delete) → label ผ่าน AUDIT_ACTION_LABEL, การกระทำแปลกที่ไม่รู้จัก → แสดงค่าดิบตรงๆ", async () => {
    setAuditStub([makeRow({ id: "l1", action: "weird-action" })]);
    await mod.renderAuditLog();
    assert.match(document.querySelector(".ad-audit-action").textContent, /weird-action/);
  });

  test("targetType + meta: มี meta → ต่อด้วย ' — meta', ไม่มี meta → ไม่มีขีดต่อท้าย", async () => {
    setAuditStub([
      makeRow({ id: "l1", targetType: "order", meta: "แก้ไขสถานะ" }),
      makeRow({ id: "l2", targetType: "product", meta: "" }),
    ]);
    await mod.renderAuditLog();
    const rows = document.querySelectorAll("#ad-audit-list .ad-audit-row");
    assert.match(rows[0].innerHTML, /order — แก้ไขสถานะ/);
    assert.doesNotMatch(rows[1].innerHTML, / — /);
  });

  test("email ว่างเปล่า → fallback ใช้ uid แทนในบรรทัด meta ของแถว", async () => {
    setAuditStub([makeRow({ email: "", uid: "uid-only" })]);
    await mod.renderAuditLog();
    assert.match(document.querySelector(".ad-audit-meta").textContent, /uid-only/);
  });

  test("escapeHtml กัน XSS ใน targetType/meta/email (ไม่มี <script> แตกออกมาใน DOM จริง)", async () => {
    setAuditStub([makeRow({ targetType: "<img src=x>", meta: "<b>bold</b>", email: "<script>x</script>" })]);
    await mod.renderAuditLog();
    assert.equal(document.querySelectorAll("#ad-audit-list script, #ad-audit-list img, #ad-audit-list b").length, 0);
  });

  test("dropdown 'คน' เติมจากอีเมล/uid ที่พบจริง เรียงตัวอักษร + มี option 'ทุกคน' ว่างอยู่หัวสุด", async () => {
    setAuditStub([
      makeRow({ id: "l1", email: "z@x.com" }),
      makeRow({ id: "l2", email: "a@x.com" }),
      makeRow({ id: "l3", email: "a@x.com" }), // ซ้ำ ต้องไม่ขึ้นซ้ำใน dropdown
    ]);
    await mod.renderAuditLog();
    const opts = Array.from(document.querySelectorAll("#ad-audit-filter-user option")).map(o => o.value);
    assert.deepEqual(opts, ["", "a@x.com", "z@x.com"]);
  });

  test("โหลดซ้ำครั้งที่สองด้วยข้อมูลที่ไม่มีอีเมลที่เลือกไว้เดิม → ตัวเลือกที่เลือกไว้หายไป กลับเป็น 'ทุกคน' (ค่าว่าง)", async () => {
    setAuditStub([makeRow({ id: "l1", email: "old@x.com" })]);
    await mod.renderAuditLog();
    document.getElementById("ad-audit-filter-user").value = "old@x.com";
    assert.equal(document.getElementById("ad-audit-filter-user").value, "old@x.com");

    setAuditStub([makeRow({ id: "l2", email: "new@x.com" })]);
    await mod.renderAuditLog();
    assert.equal(document.getElementById("ad-audit-filter-user").value, "");
  });

  test("โหลดซ้ำด้วยอีเมลเดิมที่ยังมีอยู่ → ค่าที่เลือกไว้ยังคงอยู่ (ไม่ถูกรีเซ็ต)", async () => {
    setAuditStub([makeRow({ id: "l1", email: "keep@x.com" }), makeRow({ id: "l2", email: "other@x.com" })]);
    await mod.renderAuditLog();
    document.getElementById("ad-audit-filter-user").value = "keep@x.com";

    setAuditStub([makeRow({ id: "l3", email: "keep@x.com" }), makeRow({ id: "l4", email: "other@x.com" })]);
    await mod.renderAuditLog();
    assert.equal(document.getElementById("ad-audit-filter-user").value, "keep@x.com");
  });
});

describe("renderAuditLog() — โหลดล้มเหลว (จำลอง Firestore rules ปฏิเสธ, role ไม่ใช่ admin)", () => {
  test("แสดงข้อความสิทธิ์ + err.message escape แล้ว, ตัวนับว่างเปล่า, auditRawRows ถูกเคลียร์เป็น []", async () => {
    globalThis.__GET_DOCS_STUB__ = (ref) => {
      if (ref && ref.path === "auditLog") throw new Error("Missing or insufficient permissions.");
      return [];
    };
    await mod.renderAuditLog();
    assert.equal(document.getElementById("ad-audit-list-count").textContent, "");
    assert.match(document.getElementById("ad-audit-list").innerHTML, /เฉพาะบัญชีที่มีบทบาท admin/);
    assert.match(document.getElementById("ad-audit-list").innerHTML, /Missing or insufficient permissions/);
  });

  test("โหลดล้มเหลวหลังเคยโหลดสำเร็จมาก่อน (มีรายการอยู่แล้ว) → รายการเก่าถูกล้างออก ไม่ค้าง", async () => {
    setAuditStub([makeRow({ id: "l1" })]);
    await mod.renderAuditLog();
    assert.equal(document.querySelectorAll("#ad-audit-list .ad-audit-row").length, 1);

    globalThis.__GET_DOCS_STUB__ = (ref) => { if (ref && ref.path === "auditLog") throw new Error("no perm"); return []; };
    await mod.renderAuditLog();
    assert.equal(document.querySelectorAll("#ad-audit-list .ad-audit-row").length, 0);
  });
});

describe("ปุ่ม 'โหลดล่าสุด' (#ad-audit-refresh)", () => {
  test("คลิกแล้วเรียก renderAuditLog() จริง (getDocs ถูกเรียกเพิ่ม)", async () => {
    setAuditStub([makeRow()]);
    document.getElementById("ad-audit-refresh").click();
    await flushMicrotasks();
    assert.equal(getDocsCallCount, 1);
    assert.equal(document.querySelectorAll("#ad-audit-list .ad-audit-row").length, 1);
  });
});

describe("ตัวกรอง (การกระทำ/คน/ช่วงวันที่) — กรองฝั่ง client ไม่ยิง query ใหม่", () => {
  const rows = [
    makeRow({ id: "l1", action: "create", email: "a@x.com", targetType: "order", createdAt: Date.parse("2026-01-10T10:00:00") }),
    makeRow({ id: "l2", action: "update", email: "b@x.com", targetType: "product", createdAt: Date.parse("2026-02-15T10:00:00") }),
    makeRow({ id: "l3", action: "delete", email: "a@x.com", targetType: "blog", createdAt: Date.parse("2026-03-20T10:00:00") }),
  ];

  beforeEach(async () => {
    setAuditStub(rows);
    await mod.renderAuditLog();
    getDocsCallCount = 0; // รีเซ็ตหลังโหลดตั้งต้น ให้เทสด้านล่างเช็คว่าไม่มีการยิงซ้ำตอนกรอง
  });

  test("กรองด้วยการกระทำ (action=create) → เหลือแถวเดียว ไม่ยิง getDocs ซ้ำ", () => {
    document.getElementById("ad-audit-filter-action").value = "create";
    document.getElementById("ad-audit-filter-action").dispatchEvent(new Event("change", { bubbles: true }));
    assert.equal(document.querySelectorAll("#ad-audit-list .ad-audit-row").length, 1);
    assert.equal(document.getElementById("ad-audit-list-count").textContent, "แสดง 1 จาก 3 รายการที่โหลดไว้");
    assert.equal(getDocsCallCount, 0);
  });

  test("กรองด้วยคน (email=a@x.com) → เหลือ 2 แถว (l1, l3)", () => {
    document.getElementById("ad-audit-filter-user").innerHTML = `<option value="">ทุกคน</option><option value="a@x.com">a@x.com</option>`;
    document.getElementById("ad-audit-filter-user").value = "a@x.com";
    document.getElementById("ad-audit-filter-user").dispatchEvent(new Event("change", { bubbles: true }));
    assert.equal(document.querySelectorAll("#ad-audit-list .ad-audit-row").length, 2);
  });

  test("กรองช่วงวันที่ (from=2026-02-01 ถึง to=2026-02-28) → เหลือเฉพาะ l2", () => {
    document.getElementById("ad-audit-filter-from").value = "2026-02-01";
    document.getElementById("ad-audit-filter-from").dispatchEvent(new Event("change", { bubbles: true }));
    document.getElementById("ad-audit-filter-to").value = "2026-02-28";
    document.getElementById("ad-audit-filter-to").dispatchEvent(new Event("change", { bubbles: true }));
    assert.equal(document.querySelectorAll("#ad-audit-list .ad-audit-row").length, 1);
    assert.match(document.querySelector("#ad-audit-list .ad-audit-row").innerHTML, /product/);
  });

  test("ไม่พบแถวที่ตรงกับตัวกรอง (แต่มีข้อมูลโหลดไว้แล้ว) → ข้อความ 'ไม่พบประวัติที่ตรงกับตัวกรอง'", () => {
    document.getElementById("ad-audit-filter-action").value = "create";
    document.getElementById("ad-audit-filter-user").innerHTML = `<option value="">ทุกคน</option><option value="b@x.com">b@x.com</option>`;
    document.getElementById("ad-audit-filter-user").value = "b@x.com"; // create ของ b@x.com ไม่มีจริง (l1 เป็น create ของ a@x.com)
    document.getElementById("ad-audit-filter-action").dispatchEvent(new Event("change", { bubbles: true }));
    assert.match(document.getElementById("ad-audit-list").innerHTML, /ไม่พบประวัติที่ตรงกับตัวกรอง/);
  });

  test("ปุ่ม 'ล้างตัวกรอง' → รีเซ็ตทั้ง 4 ช่อง + กลับมาแสดงครบทั้ง 3 แถว", () => {
    document.getElementById("ad-audit-filter-action").value = "create";
    document.getElementById("ad-audit-filter-action").dispatchEvent(new Event("change", { bubbles: true }));
    assert.equal(document.querySelectorAll("#ad-audit-list .ad-audit-row").length, 1);

    document.getElementById("ad-audit-filter-clear").click();
    assert.equal(document.getElementById("ad-audit-filter-action").value, "");
    assert.equal(document.getElementById("ad-audit-filter-from").value, "");
    assert.equal(document.getElementById("ad-audit-filter-to").value, "");
    assert.equal(document.querySelectorAll("#ad-audit-list .ad-audit-row").length, 3);
  });
});

describe("ปุ่ม 'ส่งออก CSV' (#ad-audit-export)", () => {
  test("ไม่มีตัวกรองเลย → ดึงข้อมูลใหม่ 1000 รายการ (getDocs ถูกเรียกเพิ่ม) แล้วสร้าง Blob จาก auditLogToCSV() ของชุดข้อมูลที่ดึงมาใหม่", async () => {
    const freshRows = [makeRow({ id: "l1", action: "create" })];
    setAuditStub([makeRow({ id: "old", action: "delete" })]); // ข้อมูลที่โหลดตอนแรก (ต้องไม่ถูกใช้ตอน export)
    await mod.renderAuditLog();
    setAuditStub(freshRows); // เปลี่ยนชุดข้อมูลก่อน export เพื่อพิสูจน์ว่า export ดึงใหม่จริง ไม่ใช้ auditRawRows เก่า
    getDocsCallCount = 0;

    document.getElementById("ad-audit-export").click();
    await flushMicrotasks();

    assert.equal(getDocsCallCount, 1, "ต้องยิง listAuditLog(1000) ใหม่เพราะไม่มีตัวกรองเลย");
    const expectedCsv = auditLogToCSV(freshRows.map(r => ({ ...r })));
    assert.equal(lastBlobParts[0], "\uFEFF" + expectedCsv);
    assert.equal(lastBlobOptions.type, "text/csv;charset=utf-8;");
    assert.equal(createObjectURLCalls.length, 1);
    assert.equal(revokeObjectURLCalls.length, 1);
  });

  test("มีตัวกรองอยู่ (เช่น action) → ใช้ applyAuditFilters(auditRawRows) ที่โหลดไว้แล้ว ไม่ยิง getDocs ซ้ำ", async () => {
    setAuditStub([makeRow({ id: "l1", action: "create" }), makeRow({ id: "l2", action: "delete" })]);
    await mod.renderAuditLog();
    document.getElementById("ad-audit-filter-action").value = "create";
    document.getElementById("ad-audit-filter-action").dispatchEvent(new Event("change", { bubbles: true }));
    getDocsCallCount = 0;

    document.getElementById("ad-audit-export").click();
    await flushMicrotasks();

    assert.equal(getDocsCallCount, 0, "มีตัวกรองแล้ว ไม่ควรยิง listAuditLog(1000) ซ้ำ");
    assert.equal(createObjectURLCalls.length, 1);
  });

  test("ชื่อไฟล์ดาวน์โหลดตรงรูปแบบ audit-log-YYYY-MM-DD.csv ของวันนี้", async () => {
    setAuditStub([makeRow()]);
    await mod.renderAuditLog();
    document.getElementById("ad-audit-export").click();
    await flushMicrotasks();

    const today = new Date().toISOString().slice(0, 10);
    assert.equal(globalThis.__lastAnchor.download, `audit-log-${today}.csv`);
    assert.equal(globalThis.__lastAnchor.isConnected, false, "ต้องถูก .remove() ออกจาก DOM หลังคลิกแล้ว");
  });

  test("ระหว่างส่งออก ปุ่มถูก disable แล้วกลับมา enable หลังเสร็จ", async () => {
    setAuditStub([makeRow()]);
    await mod.renderAuditLog();
    const btn = document.getElementById("ad-audit-export");
    btn.click();
    assert.equal(btn.disabled, true);
    await flushMicrotasks();
    assert.equal(btn.disabled, false);
  });

  test("listAuditLog(1000) ล้มเหลว (ไม่มีตัวกรอง) → showToast error, ปุ่มกลับมา enable (finally), ไม่มี Blob ถูกสร้าง", async () => {
    globalThis.__GET_DOCS_STUB__ = (ref) => { if (ref && ref.path === "auditLog") throw new Error("no perm"); return []; };
    const btn = document.getElementById("ad-audit-export");
    btn.click();
    await flushMicrotasks();

    assert.equal(btn.disabled, false);
    assert.ok(lastToast("error"));
    assert.match(lastToast("error").textContent, /ส่งออกไม่สำเร็จ/);
    assert.equal(createObjectURLCalls.length, 0);
  });
});
