// test/admin-leads-actions.test.mjs — รอบที่ 124
//
// ขอบเขต: js/admin-leads-actions.js (228 บรรทัด) — แยกออกมาจาก js/admin-leads.js เดิม (รอบ 5):
// bulk actions (เลือกหลายแถวผ่าน checkbox/เลือกทั้งหมด, ล้างการเลือก, เปลี่ยนสถานะทีเดียว, ลบทีเดียว),
// การแก้ไขแถวเดียว (เปลี่ยนสถานะ/มอบหมายผู้รับผิดชอบ/ลบทีละแถวผ่าน deleteWithUndo), โน้ตของทีมขาย
// (เปิด/ปิด modal + submit), และ mark-as-read อัตโนมัติตอนคลิกแถว
//
// ลอง import ไฟล์นี้ตรงๆ ในสภาพแวดล้อมเทสก่อนเขียนเทสตามที่ตกลงไว้ทุกรอบ — import ผ่านสำเร็จทันที
// ไม่ติด circular/ต้อง stub อะไรเลย (ไม่เหมือน js/admin-leads.js รอบ 123 ที่ต้องขยาย
// admin-overview-dashboard-stub-loader.mjs) เพราะไฟล์นี้ import เฉพาะ db-orders.js/ui-helpers.js/
// admin-utils.js/admin-state.js (ทั้งหมด "สะอาด" อยู่แล้ว) และ admin-leads.js — ตัว admin-leads.js
// เองก็ import ได้แล้วตั้งแต่รอบ 123 (ผ่าน stub ที่ขยายไว้ครอบคลุม parentURL ของมันเองอยู่แล้ว จึง
// ทำงานต่อเนื่องกันมาได้ไม่ต้องแก้ infra อะไรเพิ่มในรอบนี้เลย) — ตรวจแล้วว่า updateDoc()/deleteDoc()
// ใน firebase-stub-loader.mjs เดิม (ไม่ gate ด้วย parentURL — ครอบคลุมทุกไฟล์ที่เรียก) รองรับ
// updateLeadStatus()/updateLeadNotes()/updateLeadAssignee()/deleteLead() (js/db-orders.js) ได้ครบ
// พอแล้ว (capture path+payload ผ่าน __UPDATE_DOC_CALLS__/__DELETE_DOC_CALLS__)
//
// **bulk apply-status/bulk delete ของลีด "ไม่เรียก reloadAll()"** ต่างจาก admin-blog.js (รอบ 114) —
// ตรวจโค้ดจริงแล้วยืนยัน: ทั้งสองปุ่มแค่ Promise.all() แล้วเคลียร์ selection/toast เฉยๆ ไม่มี
// onCommitted ใดๆ เพราะแท็บลีดใช้ realtime listener (onSnapshot ใน startLeadsListener(),
// js/admin-leads.js) อัปเดต allLeads + render ใหม่เองอยู่แล้วเมื่อ Firestore เปลี่ยน — ไม่ต้องพึ่ง
// reloadAll() แบบไฟล์อื่นในกลุ่ม admin-* ที่ยังไม่มี realtime listener — สอดคล้องกับ comment ในโค้ด
// จริงที่ปุ่มลบทีละแถว ("ไม่ต้องส่ง onCommitted — listenLeads() (realtime) จะอัปเดต allLeads และ
// render ใหม่เองอยู่แล้ว")
//
// selectedLeadIds เป็น module-level Set มี export ตรง (ไม่มี setter แยก) — reset ด้วย .clear()
// ตรงๆ ได้เลยใน beforeEach() (ต่างจาก selectedBlogIds ในรอบ 114 ที่ไม่ export เลย ต้องกดปุ่ม
// "ล้างการเลือก" แทน)
//
// ลบทีละแถวผ่าน deleteWithUndo() (เหมือน admin-categories.js/admin-groups.js/admin-faq.js รอบก่อนๆ)
// — pendingSet คือ pendingDeleteLeadIds (js/admin-state.js), targetType: "lead", ไม่ส่ง onCommitted
// (เหตุผลเดียวกับ bulk ข้างบน — realtime listener จัดการ render ใหม่เอง)
//
// โน้ตของทีมขาย: เปิด/ปิดผ่าน openOverlay()/closeOverlay() (แบบเดียวกับ admin-faq.js รอบ 110 —
// ตรวจผลลัพธ์ปลายทางผ่าน style.display "flex"/"none") — lNotesText.focus() หลัง openOverlay()
// (jsdom focus() ทำงานได้จริงกับ textarea) — submit เรียก updateLeadNotes() จริง (ค่า trim() แล้ว)
//
// mark-as-read: คลิกแถว (ไม่ใช่ select/button/input ในแถว) ที่ status เป็น "new"/ไม่มี status →
// updateLeadStatus(id, "read") ถูกเรียก — คลิกที่ select/button/input ในแถว → ไม่ทำอะไร (ไม่ trigger
// mark-as-read ซ้อนกับ handler อื่นของ element นั้นๆ) — status อื่นที่ไม่ใช่ "new" → ไม่เรียก
//
// ตรวจโค้ดจริงทั้งไฟล์ js/admin-leads-actions.js ก่อนเขียนเทสนี้ (อ่านครบ) — ไม่พบบั๊ก ไม่มีการแก้
// โค้ดผลิตภัณฑ์เลยแม้แต่บรรทัดเดียว ไม่ต้องแก้ infra เทสไฟล์ไหนเลยในรอบนี้ (เทสไฟล์ใหม่ล้วนๆ)

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
let mod;        // admin-leads-actions.js exports (selectedLeadIds, updateLeadsBulkBar)
let leadsMod;   // admin-leads.js exports (allLeads state, renderLeads, startLeadsListener)
let teamMod;    // admin-settings-team.js exports (ตั้งค่า currentTeamMembers ให้ dropdown ผู้รับผิดชอบ)
let stateMod;   // admin-state.js exports (pendingDeleteLeadIds, setActiveTab)

// ยิง fake realtime snapshot ไปที่ collection "leads" (แพทเทิร์นเดียวกับ test/admin-leads.test.mjs
// รอบ 123 — startLeadsListener() ต้องถูกเรียกก่อนครั้งเดียว ผูก listener ไว้ทั้งไฟล์เทส)
function triggerLeadsSnapshot(leads) {
  const cb = globalThis.__SNAPSHOT_LISTENERS__ && globalThis.__SNAPSHOT_LISTENERS__["leads"];
  if (typeof cb !== "function") throw new Error("leads snapshot listener ยังไม่ได้ลงทะเบียน");
  cb({ docs: leads.map(l => ({ id: l.id, data: () => { const { id, ...rest } = l; return rest; } })) });
}

function field(id) { return document.getElementById(id); }
function rows() { return Array.from(document.getElementById("ad-l-table-body").querySelectorAll("tr[data-id]")); }
function row(id) { return document.querySelector(`tr[data-id="${id}"]`); }
function bulkBar() { return document.getElementById("ad-l-bulk-bar"); }
function bulkCount() { return document.getElementById("ad-l-bulk-count"); }
function headCheck() { return document.getElementById("ad-l-head-check"); }
function rowCheck(id) { return document.querySelector(`.ad-l-row-check[data-id="${id}"]`); }
function notesOverlay() { return document.getElementById("ad-l-notes-overlay"); }

function resetFirebaseCalls() {
  globalThis.__UPDATE_DOC_CALLS__ = [];
  globalThis.__DELETE_DOC_CALLS__ = [];
}

function makeLead(overrides) {
  return {
    id: "l-1", name: "สมชาย ใจดี", email: "somchai@example.com", tel: "0812345678",
    company: "บริษัท ทดสอบ", service: "ป้ายไฟ LED", message: "สนใจขอใบเสนอราคาด่วน",
    source: "inline_contact", status: "new", assignee: "", notes: "",
    createdAt: { toMillis: () => Date.now() },
    ...overrides
  };
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

  leadsMod = await import("../js/admin-leads.js");
  mod = await import("../js/admin-leads-actions.js");
  teamMod = await import("../js/admin-settings-team.js");
  stateMod = await import("../js/admin-state.js");

  // startLeadsListener() ผูก listener collection "leads" ไว้ครั้งเดียวทั้งไฟล์เทส (module-private
  // state ไม่มี stop/reset export — แพทเทิร์นเดียวกับรอบ 123)
  globalThis.__SNAPSHOT_LISTENERS__ = {};
  leadsMod.startLeadsListener();
});

beforeEach(() => {
  resetFirebaseCalls();
  leadsMod.setLCurrentPage(1);
  leadsMod.setLeadStatusFilter("");
  field("ad-l-search").value = "";
  field("ad-l-filter-source").value = "";
  if (field("ad-l-filter-assignee")) field("ad-l-filter-assignee").value = "";
  stateMod.pendingDeleteLeadIds.clear();
  stateMod.setActiveTab("leads");
  mod.selectedLeadIds.clear();
  teamMod.renderTeamSettings({ teamMembers: ["พนักงาน เอ", "พนักงาน บี"], leadReminderDays: 3 });
  const confirmOverlay = document.querySelector(".cp-confirm-overlay");
  if (confirmOverlay && confirmOverlay.style.display === "flex") {
    confirmOverlay.querySelector("#cp-confirm-cancel").click();
  }
  notesOverlay().style.display = "none";
  triggerLeadsSnapshot([makeLead({ id: "l-1" }), makeLead({ id: "l-2", status: "read" })]);
});

// ── selectedLeadIds / checkbox แต่ละแถว ──────────────────────────────
describe("checkbox แถว (ad-l-row-check) → selectedLeadIds + updateLeadsBulkBar()", () => {
  test("ติ๊กแถวเดียว: เพิ่มเข้า selectedLeadIds, bulk bar ได้ class active, count เป็น 1", () => {
    rowCheck("l-1").checked = true;
    rowCheck("l-1").dispatchEvent(new Event("change", { bubbles: true }));
    assert.equal(mod.selectedLeadIds.has("l-1"), true);
    assert.equal(bulkBar().classList.contains("active"), true);
    assert.equal(bulkCount().textContent, "1");
  });

  test("ติ๊กแล้วเอาติ๊กออก: เอาออกจาก selectedLeadIds, count กลับเป็น 0, bulk bar หมด active", () => {
    rowCheck("l-1").checked = true;
    rowCheck("l-1").dispatchEvent(new Event("change", { bubbles: true }));
    rowCheck("l-1").checked = false;
    rowCheck("l-1").dispatchEvent(new Event("change", { bubbles: true }));
    assert.equal(mod.selectedLeadIds.has("l-1"), false);
    assert.equal(bulkCount().textContent, "0");
    assert.equal(bulkBar().classList.contains("active"), false);
  });

  test("เปลี่ยน field อื่นที่ไม่ใช่ ad-l-row-check ในแถว (เช่น dropdown สถานะ) → ไม่กระทบ selectedLeadIds", () => {
    const before = mod.selectedLeadIds.size;
    row("l-1").querySelector(".ad-l-status").dispatchEvent(new Event("change", { bubbles: true }));
    assert.equal(mod.selectedLeadIds.size, before);
  });

  test("ติ๊กหลายแถว: count นับตามจริง", () => {
    rowCheck("l-1").checked = true;
    rowCheck("l-1").dispatchEvent(new Event("change", { bubbles: true }));
    rowCheck("l-2").checked = true;
    rowCheck("l-2").dispatchEvent(new Event("change", { bubbles: true }));
    assert.equal(bulkCount().textContent, "2");
  });
});

describe("checkbox 'เลือกทั้งหมด' (ad-l-head-check)", () => {
  test("ติ๊ก head check → ทุกแถวถูกติ๊กและเพิ่มเข้า selectedLeadIds ครบ", () => {
    headCheck().checked = true;
    headCheck().dispatchEvent(new Event("change", { bubbles: true }));
    assert.equal(rowCheck("l-1").checked, true);
    assert.equal(rowCheck("l-2").checked, true);
    assert.equal(mod.selectedLeadIds.size, 2);
    assert.equal(bulkCount().textContent, "2");
  });

  test("เอาติ๊กออกจาก head check → ทุกแถวเอาติ๊กออกและเอาออกจาก selectedLeadIds ครบ", () => {
    headCheck().checked = true;
    headCheck().dispatchEvent(new Event("change", { bubbles: true }));
    headCheck().checked = false;
    headCheck().dispatchEvent(new Event("change", { bubbles: true }));
    assert.equal(rowCheck("l-1").checked, false);
    assert.equal(rowCheck("l-2").checked, false);
    assert.equal(mod.selectedLeadIds.size, 0);
  });

  test("updateLeadsBulkBar(): head check ติ๊กเองอัตโนมัติเมื่อทุกแถวถูกติ๊กครบด้วยมือ", () => {
    rowCheck("l-1").checked = true;
    rowCheck("l-1").dispatchEvent(new Event("change", { bubbles: true }));
    rowCheck("l-2").checked = true;
    rowCheck("l-2").dispatchEvent(new Event("change", { bubbles: true }));
    assert.equal(headCheck().checked, true);
  });

  test("updateLeadsBulkBar(): head check เอาติ๊กออกเองถ้ามีแถวใดแถวหนึ่งไม่ถูกติ๊ก", () => {
    rowCheck("l-1").checked = true;
    rowCheck("l-1").dispatchEvent(new Event("change", { bubbles: true }));
    rowCheck("l-2").checked = true;
    rowCheck("l-2").dispatchEvent(new Event("change", { bubbles: true }));
    rowCheck("l-1").checked = false;
    rowCheck("l-1").dispatchEvent(new Event("change", { bubbles: true }));
    assert.equal(headCheck().checked, false);
  });
});

describe("ปุ่ม 'ล้างการเลือก' (ad-l-bulk-clear)", () => {
  test("เลือกไว้แล้วกดล้าง: selectedLeadIds ว่างทั้งหมด, checkbox ทุกแถวเอาติ๊กออก, bulk bar หมด active", () => {
    headCheck().checked = true;
    headCheck().dispatchEvent(new Event("change", { bubbles: true }));
    assert.equal(bulkCount().textContent, "2");
    field("ad-l-bulk-clear").click();
    assert.equal(mod.selectedLeadIds.size, 0);
    assert.equal(rowCheck("l-1").checked, false);
    assert.equal(rowCheck("l-2").checked, false);
    assert.equal(bulkBar().classList.contains("active"), false);
  });
});

// ── Bulk: เปลี่ยนสถานะทีเดียว ──────────────────────────────
describe("bulk actions — ปุ่ม 'เปลี่ยนสถานะ' (ad-l-bulk-apply-status)", () => {
  test("ไม่ได้เลือกสถานะเลย (select ว่าง) → ไม่ทำอะไร (early return)", async () => {
    rowCheck("l-1").checked = true;
    rowCheck("l-1").dispatchEvent(new Event("change", { bubbles: true }));
    field("ad-l-bulk-status-select").value = "";
    field("ad-l-bulk-apply-status").click();
    await flushMicrotasks();
    assert.equal(globalThis.__UPDATE_DOC_CALLS__.length, 0);
  });

  test("ไม่มีแถวไหนถูกเลือกเลย → ไม่ทำอะไร แม้เลือกสถานะไว้แล้ว (early return)", async () => {
    field("ad-l-bulk-status-select").value = "won";
    field("ad-l-bulk-apply-status").click();
    await flushMicrotasks();
    assert.equal(globalThis.__UPDATE_DOC_CALLS__.length, 0);
  });

  test("เลือก 2 แถวแล้วเปลี่ยนสถานะ → updateLeadStatus() (updateDoc) ถูกเรียกครบทุกรายการด้วยสถานะใหม่, เคลียร์ selection, reset select, toast สำเร็จ, ไม่มี reloadAll (ไม่มี stub ให้เรียกในไฟล์นี้)", async () => {
    headCheck().checked = true;
    headCheck().dispatchEvent(new Event("change", { bubbles: true }));
    field("ad-l-bulk-status-select").value = "won";
    const btn = field("ad-l-bulk-apply-status");
    btn.click();
    await flushMicrotasks();
    await flushMicrotasks();

    assert.equal(globalThis.__UPDATE_DOC_CALLS__.length, 2);
    const paths = globalThis.__UPDATE_DOC_CALLS__.map(c => c.path).sort();
    assert.deepEqual(paths, ["leads/l-1", "leads/l-2"]);
    globalThis.__UPDATE_DOC_CALLS__.forEach(c => assert.equal(c.payload.status, "won"));
    // updateLeadStatus("won") เพิ่ม wonAt ด้วย (db-orders.js)
    globalThis.__UPDATE_DOC_CALLS__.forEach(c => assert.ok("wonAt" in c.payload));

    assert.equal(mod.selectedLeadIds.size, 0);
    assert.equal(bulkCount().textContent, "0");
    assert.equal(field("ad-l-bulk-status-select").value, "");
    assert.equal(btn.disabled, false);
    const toastEls = document.querySelectorAll(".cp-toast-wrap .cp-toast.success");
    assert.equal(toastEls.length >= 1, true);
    assert.equal(toastEls[toastEls.length - 1].textContent, "เปลี่ยนสถานะแล้ว 2 รายการ");
  });

  test("ปุ่มถูก disable ระหว่างทำงาน แล้วกลับมา enabled หลังเสร็จ", async () => {
    rowCheck("l-1").checked = true;
    rowCheck("l-1").dispatchEvent(new Event("change", { bubbles: true }));
    field("ad-l-bulk-status-select").value = "lost";
    const btn = field("ad-l-bulk-apply-status");
    btn.click();
    assert.equal(btn.disabled, true);
    await flushMicrotasks();
    await flushMicrotasks();
    assert.equal(btn.disabled, false);
  });

  test("ล้มเหลว (updateDoc reject) → toast แจ้ง error, selection ยังถูกเคลียร์เพราะโค้ดเรียก clear() ใน try ก่อน error path ไม่ครอบ — ตรวจตาม logic จริง", async () => {
    globalThis.__UPDATE_DOC_STUB__ = () => ({ throw: new Error("network down") });
    rowCheck("l-1").checked = true;
    rowCheck("l-1").dispatchEvent(new Event("change", { bubbles: true }));
    field("ad-l-bulk-status-select").value = "won";
    const btn = field("ad-l-bulk-apply-status");
    btn.click();
    await flushMicrotasks();
    await flushMicrotasks();

    const toastEls = document.querySelectorAll(".cp-toast-wrap .cp-toast:not(.success)");
    assert.equal(toastEls.length >= 1, true);
    assert.match(toastEls[toastEls.length - 1].textContent, /อัปเดตสถานะไม่สำเร็จ/);
    assert.equal(btn.disabled, false);
    globalThis.__UPDATE_DOC_STUB__ = undefined;
  });
});

// ── Bulk: ลบทีเดียว ──────────────────────────────
describe("bulk actions — ปุ่ม 'ลบที่เลือก' (ad-l-bulk-delete)", () => {
  test("ไม่มีแถวไหนถูกเลือกเลย: กดแล้วไม่เปิด confirmDialog เลย (early return)", async () => {
    field("ad-l-bulk-delete").click();
    await flushMicrotasks();
    const co = document.querySelector(".cp-confirm-overlay");
    if (co) assert.notEqual(co.style.display, "flex");
    assert.deepEqual(globalThis.__DELETE_DOC_CALLS__, []);
  });

  test("เลือก 2 แถวแล้วกดลบ → confirm message มีจำนวนรายการอยู่ในนั้น, กด 'ยกเลิก' → ไม่เรียก deleteLead() เลย, selection คงอยู่", async () => {
    headCheck().checked = true;
    headCheck().dispatchEvent(new Event("change", { bubbles: true }));
    field("ad-l-bulk-delete").click();
    await flushMicrotasks();
    const co = document.querySelector(".cp-confirm-overlay");
    assert.equal(co.style.display, "flex");
    assert.match(co.querySelector("#cp-confirm-msg").textContent, /ลบลีดที่เลือก 2 รายการ/);
    co.querySelector("#cp-confirm-cancel").click();
    await flushMicrotasks();

    assert.deepEqual(globalThis.__DELETE_DOC_CALLS__, []);
    assert.equal(mod.selectedLeadIds.size, 2);
  });

  test("เลือก 2 แถวแล้วกดลบ, กด 'ยืนยัน': deleteLead() ถูกเรียกครบทั้ง 2 รายการทันที (ไม่มี undo สำหรับ bulk), เคลียร์ selection, ปุ่มกลับมา enabled, toast สำเร็จ", async () => {
    headCheck().checked = true;
    headCheck().dispatchEvent(new Event("change", { bubbles: true }));
    const btn = field("ad-l-bulk-delete");
    btn.click();
    await flushMicrotasks();
    document.querySelector(".cp-confirm-overlay #cp-confirm-ok").click();
    await flushMicrotasks();
    await flushMicrotasks();

    assert.equal(globalThis.__DELETE_DOC_CALLS__.length, 2);
    const paths = globalThis.__DELETE_DOC_CALLS__.map(c => c.path).sort();
    assert.deepEqual(paths, ["leads/l-1", "leads/l-2"]);
    assert.equal(mod.selectedLeadIds.size, 0);
    assert.equal(btn.disabled, false);
    // ไม่มี undo toast สำหรับ bulk delete (ต่างจากลบรายแถวเดียวที่ผ่าน deleteWithUndo)
    assert.equal(document.querySelector(".cp-toast-undo-btn"), null);
    const toastEls = document.querySelectorAll(".cp-toast-wrap .cp-toast.success");
    assert.equal(toastEls.length >= 1, true);
    assert.equal(toastEls[toastEls.length - 1].textContent, "ลบแล้ว 2 รายการ");
  });
});

// ── การแก้ไขแถวเดียว: เปลี่ยนสถานะ ──────────────────────────────
describe("dropdown สถานะรายแถว (ad-l-status)", () => {
  test("เปลี่ยนสถานะ → updateLeadStatus() ถูกเรียกด้วย id/status ที่ถูกต้อง + dataset.status อัปเดตตาม", async () => {
    const select = row("l-1").querySelector(".ad-l-status");
    select.value = "replied";
    select.dispatchEvent(new Event("change", { bubbles: true }));
    await flushMicrotasks();
    assert.equal(globalThis.__UPDATE_DOC_CALLS__.length, 1);
    assert.equal(globalThis.__UPDATE_DOC_CALLS__[0].path, "leads/l-1");
    assert.equal(globalThis.__UPDATE_DOC_CALLS__[0].payload.status, "replied");
    assert.equal(select.dataset.status, "replied");
  });

  test("ล้มเหลว (updateDoc reject) → toast แจ้ง error", async () => {
    globalThis.__UPDATE_DOC_STUB__ = () => ({ throw: new Error("boom") });
    const select = row("l-1").querySelector(".ad-l-status");
    select.value = "lost";
    select.dispatchEvent(new Event("change", { bubbles: true }));
    await flushMicrotasks();
    const toastEls = document.querySelectorAll(".cp-toast-wrap .cp-toast:not(.success)");
    assert.match(toastEls[toastEls.length - 1].textContent, /อัปเดตสถานะไม่สำเร็จ/);
    globalThis.__UPDATE_DOC_STUB__ = undefined;
  });

  test("เปลี่ยน field อื่นในแถว (checkbox) → ไม่ trigger handler นี้ (ไม่เรียก updateLeadStatus)", async () => {
    rowCheck("l-1").checked = true;
    rowCheck("l-1").dispatchEvent(new Event("change", { bubbles: true }));
    await flushMicrotasks();
    assert.equal(globalThis.__UPDATE_DOC_CALLS__.length, 0);
  });
});

// ── การแก้ไขแถวเดียว: มอบหมายผู้รับผิดชอบ ──────────────────────────────
describe("dropdown ผู้รับผิดชอบรายแถว (ad-l-assignee)", () => {
  test("มอบหมายให้ชื่อหนึ่ง → updateLeadAssignee() ถูกเรียก, toast บอกชื่อที่มอบหมาย, select กลับมา enabled", async () => {
    const select = row("l-1").querySelector(".ad-l-assignee");
    select.value = "พนักงาน เอ";
    select.dispatchEvent(new Event("change", { bubbles: true }));
    assert.equal(select.disabled, true);
    await flushMicrotasks();
    assert.equal(globalThis.__UPDATE_DOC_CALLS__.length, 1);
    assert.equal(globalThis.__UPDATE_DOC_CALLS__[0].path, "leads/l-1");
    assert.equal(globalThis.__UPDATE_DOC_CALLS__[0].payload.assignee, "พนักงาน เอ");
    assert.equal(select.disabled, false);
    const toastEls = document.querySelectorAll(".cp-toast-wrap .cp-toast.success");
    assert.equal(toastEls[toastEls.length - 1].textContent, 'มอบหมายให้ "พนักงาน เอ" แล้ว');
  });

  test("เลือกค่าว่าง (เอาผู้รับผิดชอบออก) → updateLeadAssignee(id, '') + toast ข้อความ 'เอาผู้รับผิดชอบออกแล้ว'", async () => {
    const select = row("l-1").querySelector(".ad-l-assignee");
    select.value = "";
    select.dispatchEvent(new Event("change", { bubbles: true }));
    await flushMicrotasks();
    assert.equal(globalThis.__UPDATE_DOC_CALLS__[0].payload.assignee, "");
    const toastEls = document.querySelectorAll(".cp-toast-wrap .cp-toast.success");
    assert.equal(toastEls[toastEls.length - 1].textContent, "เอาผู้รับผิดชอบออกแล้ว");
  });

  test("ล้มเหลว (updateDoc reject) → toast แจ้ง error, select กลับมา enabled ผ่าน finally", async () => {
    globalThis.__UPDATE_DOC_STUB__ = () => ({ throw: new Error("boom") });
    const select = row("l-1").querySelector(".ad-l-assignee");
    select.value = "พนักงาน บี";
    select.dispatchEvent(new Event("change", { bubbles: true }));
    await flushMicrotasks();
    const toastEls = document.querySelectorAll(".cp-toast-wrap .cp-toast:not(.success)");
    assert.match(toastEls[toastEls.length - 1].textContent, /มอบหมายไม่สำเร็จ/);
    assert.equal(select.disabled, false);
    globalThis.__UPDATE_DOC_STUB__ = undefined;
  });
});

// ── การแก้ไขแถวเดียว: ลบ (ผ่าน deleteWithUndo) ──────────────────────────────
describe("ปุ่มลบรายแถว (ad-l-delete) — deleteWithUndo()", () => {
  test("คลิกที่ไม่ใช่ปุ่มลบ (เช่นตัวแถวเปล่าๆ) → ไม่เปิด confirm", async () => {
    row("l-2").dispatchEvent(new Event("click", { bubbles: true })); // status "read" ไม่ trigger mark-as-read update ด้วย เพราะไม่ใช่ "new"
    await flushMicrotasks();
    const co = document.querySelector(".cp-confirm-overlay");
    if (co) assert.notEqual(co.style.display, "flex");
  });

  test("คลิกปุ่มลบ → เปิด confirmDialog ข้อความมีคำถามเรื่องลบลีดรายการนี้", async () => {
    row("l-1").querySelector(".ad-l-delete").dispatchEvent(new Event("click", { bubbles: true }));
    await flushMicrotasks();
    const co = document.querySelector(".cp-confirm-overlay");
    assert.equal(co.style.display, "flex");
    assert.match(co.querySelector("#cp-confirm-msg").textContent, /ลบลีดรายการนี้/);
  });

  test("กด 'ยกเลิก' บน confirm → ไม่ลบ, แถวยังอยู่ครบ", async () => {
    row("l-1").querySelector(".ad-l-delete").dispatchEvent(new Event("click", { bubbles: true }));
    await flushMicrotasks();
    document.querySelector("#cp-confirm-cancel").click();
    await flushMicrotasks();
    assert.deepEqual(globalThis.__DELETE_DOC_CALLS__, []);
    assert.equal(rows().length, 2);
  });

  test("ยืนยันลบ แล้วกด 'เลิกทำ' ทันที → ไม่ลบจริง, แถวหายไปชั่วคราวระหว่างรอแล้วกลับมาเหมือนเดิม", async () => {
    row("l-1").querySelector(".ad-l-delete").dispatchEvent(new Event("click", { bubbles: true }));
    await flushMicrotasks();
    document.querySelector("#cp-confirm-ok").click();
    await flushMicrotasks();
    assert.equal(rows().length, 1); // l-1 หายไปชั่วคราว (pendingDeleteLeadIds)
    const undoBtn = document.querySelector(".cp-toast-undo-btn");
    assert.ok(undoBtn, "ต้องมี toast เลิกทำโผล่ขึ้นมา");
    undoBtn.click();
    await flushMicrotasks();
    assert.deepEqual(globalThis.__DELETE_DOC_CALLS__, []);
    assert.equal(rows().length, 2, "กด 'เลิกทำ' แล้วรายการต้องกลับมาครบ");
  });

  test("ยืนยันลบ แล้วปล่อยผ่านจนหมดเวลา (5000ms) → deleteLead() ถูกเรียกจริง (ไม่มี onCommitted/reloadAll เพราะ realtime listener จัดการ render ใหม่เอง)", async (t) => {
    const flushReal = () => new Promise((r) => setImmediate(r));
    t.mock.timers.enable({ apis: ["setTimeout"] });
    row("l-1").querySelector(".ad-l-delete").dispatchEvent(new Event("click", { bubbles: true }));
    await flushReal();
    document.querySelector("#cp-confirm-ok").click();
    await flushReal();
    t.mock.timers.tick(5000);
    await flushReal();
    await flushReal();
    assert.equal(globalThis.__DELETE_DOC_CALLS__.length, 1);
    assert.equal(globalThis.__DELETE_DOC_CALLS__[0].path, "leads/l-1");
    t.mock.timers.reset();
  });
});

// ── โน้ตของทีมขาย ──────────────────────────────
describe("โน้ตของทีมขาย (ad-l-notes-btn → modal → submit)", () => {
  test("คลิกปุ่มโน้ต → เปิด modal, กรอกชื่อ/สรุปข้อมูลติดต่อ/โน้ตเดิมถูกต้อง", () => {
    row("l-1").querySelector(".ad-l-notes-btn").dispatchEvent(new Event("click", { bubbles: true }));
    assert.equal(notesOverlay().style.display, "flex");
    assert.equal(field("ad-l-notes-id").value, "l-1");
    assert.equal(field("ad-l-notes-name").textContent, "สมชาย ใจดี");
    assert.match(field("ad-l-notes-summary").textContent, /0812345678/);
    assert.match(field("ad-l-notes-summary").textContent, /somchai@example\.com/);
    assert.equal(field("ad-l-notes-text").value, "");
  });

  test("ลีดมีโน้ตเดิมอยู่แล้ว → ช่องโน้ตแสดงค่าเดิม", () => {
    triggerLeadsSnapshot([makeLead({ id: "l-1", notes: "โทรคุยแล้ว นัดโทรกลับพรุ่งนี้" }), makeLead({ id: "l-2" })]);
    row("l-1").querySelector(".ad-l-notes-btn").dispatchEvent(new Event("click", { bubbles: true }));
    assert.equal(field("ad-l-notes-text").value, "โทรคุยแล้ว นัดโทรกลับพรุ่งนี้");
  });

  test("ลีดไม่มีชื่อ → fallback เป็นชื่อบริษัท, ไม่มีทั้งคู่ → 'ไม่ระบุชื่อ'", () => {
    triggerLeadsSnapshot([makeLead({ id: "l-1", name: "", company: "หจก. ทดสอบ" }), makeLead({ id: "l-2" })]);
    row("l-1").querySelector(".ad-l-notes-btn").dispatchEvent(new Event("click", { bubbles: true }));
    assert.equal(field("ad-l-notes-name").textContent, "หจก. ทดสอบ");

    triggerLeadsSnapshot([makeLead({ id: "l-1", name: "", company: "" }), makeLead({ id: "l-2" })]);
    row("l-1").querySelector(".ad-l-notes-btn").dispatchEvent(new Event("click", { bubbles: true }));
    assert.equal(field("ad-l-notes-name").textContent, "ไม่ระบุชื่อ");
  });

  test("id ไม่พบใน allLeads → ไม่ทำอะไร (guard ป้องกัน race กับ realtime update)", () => {
    const btn = document.createElement("button");
    btn.className = "ad-l-notes-btn";
    btn.dataset.id = "l-not-exist";
    document.getElementById("ad-l-table-body").appendChild(btn);
    btn.dispatchEvent(new Event("click", { bubbles: true }));
    assert.notEqual(notesOverlay().style.display, "flex");
    btn.remove();
  });

  test("ปุ่มยกเลิก → ปิด modal + reset ฟอร์ม", () => {
    row("l-1").querySelector(".ad-l-notes-btn").dispatchEvent(new Event("click", { bubbles: true }));
    field("ad-l-notes-text").value = "พิมพ์ค้างไว้";
    field("ad-l-notes-cancel").click();
    assert.equal(notesOverlay().style.display, "none");
    assert.equal(field("ad-l-notes-text").value, "");
  });

  test("คลิก backdrop (นอกกล่อง form) → ปิด modal + reset ฟอร์ม", () => {
    row("l-1").querySelector(".ad-l-notes-btn").dispatchEvent(new Event("click", { bubbles: true }));
    notesOverlay().dispatchEvent(new Event("click", { bubbles: true }));
    assert.equal(notesOverlay().style.display, "none");
  });

  test("คลิกภายในกล่อง form เอง (ไม่ใช่ backdrop) → ไม่ปิด modal", () => {
    row("l-1").querySelector(".ad-l-notes-btn").dispatchEvent(new Event("click", { bubbles: true }));
    field("ad-l-notes-text").dispatchEvent(new Event("click", { bubbles: true }));
    assert.equal(notesOverlay().style.display, "flex");
  });

  test("submit → updateLeadNotes() ถูกเรียกด้วยค่า trim() แล้ว, ปิด modal + reset ฟอร์มหลังสำเร็จ", async () => {
    row("l-1").querySelector(".ad-l-notes-btn").dispatchEvent(new Event("click", { bubbles: true }));
    field("ad-l-notes-text").value = "  โน้ตใหม่มีช่องว่างล้อมรอบ  ";
    const form = document.getElementById("ad-l-notes-form");
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await flushMicrotasks();
    assert.equal(globalThis.__UPDATE_DOC_CALLS__.length, 1);
    assert.equal(globalThis.__UPDATE_DOC_CALLS__[0].path, "leads/l-1");
    assert.equal(globalThis.__UPDATE_DOC_CALLS__[0].payload.notes, "โน้ตใหม่มีช่องว่างล้อมรอบ");
    assert.equal(notesOverlay().style.display, "none");
  });

  test("ปุ่ม submit disable + เปลี่ยนข้อความระหว่างบันทึกแล้วกลับปกติ", async () => {
    row("l-1").querySelector(".ad-l-notes-btn").dispatchEvent(new Event("click", { bubbles: true }));
    const form = document.getElementById("ad-l-notes-form");
    const btn = form.querySelector('button[type=submit]');
    const originalText = btn.textContent;
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    assert.equal(btn.disabled, true);
    assert.equal(btn.textContent, "กำลังบันทึก...");
    await flushMicrotasks();
    assert.equal(btn.disabled, false);
    assert.equal(btn.textContent, originalText);
  });

  test("ล้มเหลว (updateDoc reject) → toast แจ้ง error, ปุ่มกลับมา enabled, modal ไม่ปิด", async () => {
    globalThis.__UPDATE_DOC_STUB__ = () => ({ throw: new Error("save failed") });
    row("l-1").querySelector(".ad-l-notes-btn").dispatchEvent(new Event("click", { bubbles: true }));
    const form = document.getElementById("ad-l-notes-form");
    const btn = form.querySelector('button[type=submit]');
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await flushMicrotasks();
    const toastEls = document.querySelectorAll(".cp-toast-wrap .cp-toast:not(.success)");
    assert.match(toastEls[toastEls.length - 1].textContent, /บันทึกโน้ตไม่สำเร็จ/);
    assert.equal(btn.disabled, false);
    assert.equal(notesOverlay().style.display, "flex");
    globalThis.__UPDATE_DOC_STUB__ = undefined;
  });
});

// ── mark-as-read อัตโนมัติตอนคลิกแถว ──────────────────────────────
describe("mark-as-read อัตโนมัติ (คลิกแถว ad-l-row)", () => {
  test("คลิกที่แถว (นอก select/button/input) ของลีดสถานะ 'new' → updateLeadStatus(id, 'read') ถูกเรียก", async () => {
    // l-1 คือ status 'new' — คลิกที่ cell ชื่อ (ไม่ใช่ select/button/input)
    const nameCell = row("l-1").querySelector("td");
    nameCell.dispatchEvent(new Event("click", { bubbles: true }));
    await flushMicrotasks();
    assert.equal(globalThis.__UPDATE_DOC_CALLS__.length, 1);
    assert.equal(globalThis.__UPDATE_DOC_CALLS__[0].path, "leads/l-1");
    assert.equal(globalThis.__UPDATE_DOC_CALLS__[0].payload.status, "read");
  });

  test("ลีดไม่มีฟิลด์ status เลย (undefined) → ถือเป็น 'new' ตาม default → ยัง mark-as-read", async () => {
    triggerLeadsSnapshot([makeLead({ id: "l-1", status: undefined }), makeLead({ id: "l-2" })]);
    row("l-1").querySelector("td").dispatchEvent(new Event("click", { bubbles: true }));
    await flushMicrotasks();
    assert.equal(globalThis.__UPDATE_DOC_CALLS__.length, 1);
    assert.equal(globalThis.__UPDATE_DOC_CALLS__[0].payload.status, "read");
  });

  test("คลิกแถวที่สถานะไม่ใช่ 'new' (เช่น 'read') → ไม่เรียก updateLeadStatus ซ้ำ", async () => {
    const nameCell = row("l-2").querySelector("td"); // l-2 status "read" จาก beforeEach
    nameCell.dispatchEvent(new Event("click", { bubbles: true }));
    await flushMicrotasks();
    assert.equal(globalThis.__UPDATE_DOC_CALLS__.length, 0);
  });

  test("คลิกที่ select ในแถว (เช่น dropdown สถานะ) → ไม่ trigger mark-as-read (ไม่ชนกับ handler เปลี่ยนสถานะของ select เอง)", async () => {
    row("l-1").querySelector(".ad-l-status").dispatchEvent(new Event("click", { bubbles: true }));
    await flushMicrotasks();
    assert.equal(globalThis.__UPDATE_DOC_CALLS__.length, 0);
  });

  test("คลิกที่ button ในแถว (เช่นปุ่มลบ/โน้ต) → ไม่ trigger mark-as-read", async () => {
    row("l-1").querySelector(".ad-l-delete").dispatchEvent(new Event("click", { bubbles: true }));
    await flushMicrotasks();
    // เฉพาะ delete confirm ถูกเปิด ไม่มีการเรียก updateLeadStatus จาก mark-as-read handler
    assert.equal(globalThis.__UPDATE_DOC_CALLS__.length, 0);
    document.querySelector("#cp-confirm-cancel").click(); // ปิด confirm ทิ้งไว้ไม่ให้ค้างข้ามเทส
  });

  test("คลิกที่ input ในแถว (checkbox) → ไม่ trigger mark-as-read", async () => {
    rowCheck("l-1").dispatchEvent(new Event("click", { bubbles: true }));
    await flushMicrotasks();
    assert.equal(globalThis.__UPDATE_DOC_CALLS__.length, 0);
  });

  test("id ไม่พบใน allLeads (แถวถูกลบไปแล้วระหว่าง event queue) → ไม่ throw ไม่เรียก updateLeadStatus", async () => {
    const fakeRow = document.createElement("tr");
    fakeRow.className = "ad-l-row";
    fakeRow.dataset.id = "l-ghost";
    const td = document.createElement("td");
    fakeRow.appendChild(td);
    document.getElementById("ad-l-table-body").appendChild(fakeRow);
    td.dispatchEvent(new Event("click", { bubbles: true }));
    await flushMicrotasks();
    assert.equal(globalThis.__UPDATE_DOC_CALLS__.length, 0);
    fakeRow.remove();
  });

  test("ล้มเหลว (updateDoc reject) → catch ไว้เงียบๆ ไม่ throw, ไม่มี toast ใหม่ขึ้น (โค้ดจริงแค่ console.error), แต่ยังเห็นว่าเรียก updateLeadStatus จริง", async () => {
    globalThis.__UPDATE_DOC_STUB__ = () => ({ throw: new Error("boom") });
    const toastCountBefore = document.querySelectorAll(".cp-toast-wrap .cp-toast").length;
    const origConsoleError = console.error;
    let consoleErrorCalled = false;
    console.error = () => { consoleErrorCalled = true; };
    try {
      const nameCell = row("l-1").querySelector("td");
      nameCell.dispatchEvent(new Event("click", { bubbles: true }));
      await flushMicrotasks();
    } finally {
      console.error = origConsoleError;
    }
    // ไม่ throw ออกมาจน test พังคือหลักฐานหลักว่า catch ทำงาน — ยืนยันเพิ่มว่า attempt เกิดขึ้นจริง
    assert.equal(globalThis.__UPDATE_DOC_CALLS__.length, 1);
    assert.equal(globalThis.__UPDATE_DOC_CALLS__[0].payload.status, "read");
    assert.equal(consoleErrorCalled, true);
    // ไม่มี toast ใหม่จาก mark-as-read (handler นี้ไม่เรียก showToast เลย ตรวจโค้ดจริงแล้ว)
    assert.equal(document.querySelectorAll(".cp-toast-wrap .cp-toast").length, toastCountBefore);
    globalThis.__UPDATE_DOC_STUB__ = undefined;
  });
});
