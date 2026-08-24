// test/admin-settings-staff.test.mjs — รอบที่ 103
//
// ขอบเขต: js/admin-settings-staff.js (88 บรรทัด) — แท็บ SETTINGS ย่อย "บัญชีผู้ใช้ทีมงาน"
// (staff/{uid}.role) — renderStaffList() (list+filter pendingDeleteStaffUids+error-state),
// ฟอร์มเพิ่ม/แก้ไข role (submit → upsertStaffRole()+logAudit()+reset ฟอร์ม+re-render+toast),
// ปุ่มลบ (event delegation .ad-staff-remove → confirmDialog() → deleteWithUndo()
// → removeStaffRole()) — ไฟล์นี้ import js/db.js ตรงๆ (listStaff/upsertStaffRole/
// removeStaffRole/logAudit) จึงต้องพึ่ง test/helpers/firebase-stub-loader.mjs
// (ลงทะเบียนแล้วผ่าน --import ./test/helpers/register-loader.mjs ใน npm script "test") —
// listStaff()/removeStaffRole() อ่าน/เขียนผ่าน getDocs()/deleteDoc() ของ stub นั้น ต้องตั้ง
// globalThis.__GET_DOCS_STUB__ ก่อนเรียก renderStaffList() ทุกเทส (default คืน docs: [] เปล่า)
//
// สถาปัตยกรรมเทส: import ทั้งไฟล์ครั้งเดียวใน before() ผ่าน jsdom + admin.html body จริง (ตัด
// <script> ออก) ตามแพทเทิร์นเดียวกับ test/orders-tab-render-delete.test.mjs (รอบ 95) — ปุ่มลบ
// ใช้ confirmDialog() จริง (pattern จาก test/ui-form-validation.test.mjs รอบ 90: คลิก
// #cp-confirm-ok/#cp-confirm-cancel บน .cp-confirm-overlay) ต่อด้วย showUndoToast() จริง (ปุ่ม
// .cp-toast-undo-btn — คลิกทันที = undone=true ไม่ลบจริง, ปล่อยผ่าน mock.timers 5000ms = ลบจริง —
// เหมือน confirmDeleteOrder() ที่ test/orders-tab-render-delete.test.mjs ทดสอบไว้แล้ว)
//
// ตรวจโค้ดจริงทั้งไฟล์ js/admin-settings-staff.js ก่อนเขียนเทสนี้ (88 บรรทัด อ่านครบ) — ไม่พบบั๊ก
// จึงเป็นไฟล์เทสล้วนๆ ไม่มีการแก้โค้ดผลิตภัณฑ์เลยแม้แต่บรรทัดเดียว

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
let mod; // admin-settings-staff.js exports

function resetFirebaseCalls() {
  globalThis.__ADD_DOC_CALLS__ = [];
  globalThis.__UPDATE_DOC_CALLS__ = [];
  globalThis.__DELETE_DOC_CALLS__ = [];
  globalThis.__SET_DOC_CALLS__ = [];
  globalThis.__GET_DOC_STUB__ = undefined;
  globalThis.__GET_DOCS_STUB__ = undefined;
}

const SAMPLE_STAFF = [
  { id: "uid-A", data: { name: "สมชาย ใจดี", email: "somchai@x.com", role: "admin" } },
  { id: "uid-B", data: { name: "สมหญิง มีสุข", email: "somying@x.com", role: "staff" } },
];

function staffRows() {
  return Array.from(document.querySelectorAll(".ad-staff-row"));
}

before(async () => {
  const dom = new JSDOM(`<!doctype html><html><body>${ADMIN_BODY_NO_SCRIPTS}</body></html>`);
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
  globalThis.Event = dom.window.Event;
  document = dom.window.document;

  mod = await import("../js/admin-settings-staff.js");
});

beforeEach(() => {
  resetFirebaseCalls();
  // confirmDialog() cache overlay element ไว้ที่ module-level singleton (ui-helpers.js) — ห้ามลบ
  // element นี้ทิ้งจาก DOM (จะทำให้ confirmDialog() รอบถัดไปทำงานกับ element ที่หลุดจาก document
  // แล้ว) แค่ปิดมันถ้าค้างเปิดอยู่จากเทสก่อนหน้า (ตามแพทเทิร์น test/orders-tab-render-delete.test.mjs)
  const overlay = document.querySelector(".cp-confirm-overlay");
  if (overlay && overlay.style.display === "flex") overlay.querySelector("#cp-confirm-cancel").click();
  document.querySelectorAll(".cp-toast-wrap .cp-toast").forEach(el => el.remove());
  document.getElementById("ad-staff-uid").value = "";
  document.getElementById("ad-staff-name").value = "";
  document.getElementById("ad-staff-email").value = "";
  document.getElementById("ad-staff-role").value = "staff";
});

describe("renderStaffList()", () => {
  test("ไม่มีใครถูกกำหนดสิทธิ์ → ข้อความว่าง", async () => {
    globalThis.__GET_DOCS_STUB__ = () => [];
    await mod.renderStaffList();
    const box = document.getElementById("ad-staff-list");
    assert.match(box.innerHTML, /ยังไม่มีใครถูกกำหนดสิทธิ์ไว้/);
    assert.equal(staffRows().length, 0);
  });

  test("แสดงรายชื่อ staff จริง พร้อม role badge (admin ไม่มี class role-staff, staff มี)", async () => {
    globalThis.__GET_DOCS_STUB__ = () => SAMPLE_STAFF;
    await mod.renderStaffList();
    const rows = staffRows();
    assert.equal(rows.length, 2);
    assert.match(rows[0].querySelector(".ad-staff-name").textContent, /สมชาย ใจดี/);
    assert.match(rows[0].querySelector(".ad-staff-email").textContent, /somchai@x\.com/);
    assert.equal(rows[0].querySelector(".ad-staff-role-badge").classList.contains("role-staff"), false);
    assert.equal(rows[1].querySelector(".ad-staff-role-badge").classList.contains("role-staff"), true);
  });

  test("role \"production\" (พนักงานหน้างานผลิต) → badge label เป็น production", async () => {
    globalThis.__GET_DOCS_STUB__ = () => [{ id: "uid-P", data: { name: "พนักงานผลิต", role: "production" } }];
    await mod.renderStaffList();
    const badge = staffRows()[0].querySelector(".ad-staff-role-badge");
    assert.match(badge.textContent, /production/);
  });

  test("ชื่อ/อีเมลว่าง → แสดง (ไม่ระบุชื่อ) แทน", async () => {
    globalThis.__GET_DOCS_STUB__ = () => [{ id: "uid-C", data: { role: "staff" } }];
    await mod.renderStaffList();
    assert.match(staffRows()[0].querySelector(".ad-staff-name").textContent, /\(ไม่ระบุชื่อ\)/);
  });

  test("escape ชื่อที่มีอักขระ HTML พิเศษ กัน XSS", async () => {
    globalThis.__GET_DOCS_STUB__ = () => [{ id: "uid-x", data: { name: '<script>alert(1)</script>', role: "staff" } }];
    await mod.renderStaffList();
    assert.doesNotMatch(document.getElementById("ad-staff-list").innerHTML, /<script>alert/);
    assert.match(document.getElementById("ad-staff-list").innerHTML, /&lt;script&gt;/);
  });

  test("โหลดล้มเหลว → error-state พร้อมปุ่มลองใหม่ ไม่ throw", async () => {
    globalThis.__GET_DOCS_STUB__ = () => { throw new Error("network down"); };
    await mod.renderStaffList();
    assert.match(document.getElementById("ad-staff-list").innerHTML, /โหลดรายชื่อไม่สำเร็จ/);
    assert.match(document.getElementById("ad-staff-list").innerHTML, /network down/);
  });
});

describe("ฟอร์มเพิ่ม/แก้ไข role — submit", () => {
  test("กรอกครบ → upsertStaffRole() ถูกเรียกด้วยค่าที่กรอก, ฟอร์ม reset, list re-render, toast success", async () => {
    globalThis.__GET_DOCS_STUB__ = () => [];
    document.getElementById("ad-staff-uid").value = "  uid-new  ";
    document.getElementById("ad-staff-name").value = "  พนักงานใหม่  ";
    document.getElementById("ad-staff-email").value = "new@x.com";
    document.getElementById("ad-staff-role").value = "admin";

    document.getElementById("ad-staff-form").dispatchEvent(new Event("submit"));
    await flushMicrotasks();

    assert.equal(globalThis.__SET_DOC_CALLS__.length, 1);
    assert.equal(globalThis.__SET_DOC_CALLS__[0].path, "staff/uid-new");
    assert.deepEqual(globalThis.__SET_DOC_CALLS__[0].payload, { name: "พนักงานใหม่", email: "new@x.com", role: "admin", updatedAt: null });
    assert.equal(document.getElementById("ad-staff-uid").value, "");
    assert.equal(document.getElementById("ad-staff-name").value, "");
    assert.equal(document.getElementById("ad-staff-role").value, "staff");
    assert.match(document.querySelector(".cp-toast.success")?.textContent || "", /บันทึกสิทธิ์แล้ว/);
  });

  test("เลือกบทบาท production (พนักงานหน้างานผลิต) → upsertStaffRole() บันทึก role: \"production\" ตรงตัว", async () => {
    globalThis.__GET_DOCS_STUB__ = () => [];
    document.getElementById("ad-staff-uid").value = "uid-prod";
    document.getElementById("ad-staff-name").value = "พนักงานผลิต";
    document.getElementById("ad-staff-email").value = "prod@x.com";
    document.getElementById("ad-staff-role").value = "production";

    document.getElementById("ad-staff-form").dispatchEvent(new Event("submit"));
    await flushMicrotasks();

    assert.equal(globalThis.__SET_DOC_CALLS__.length, 1);
    assert.equal(globalThis.__SET_DOC_CALLS__[0].path, "staff/uid-prod");
    assert.equal(globalThis.__SET_DOC_CALLS__[0].payload.role, "production");
  });

  test("uid ว่าง (หลัง trim) → ไม่เรียก upsertStaffRole() เลย", async () => {
    document.getElementById("ad-staff-uid").value = "   ";
    document.getElementById("ad-staff-form").dispatchEvent(new Event("submit"));
    await flushMicrotasks();
    assert.equal((globalThis.__SET_DOC_CALLS__ || []).length, 0);
  });
});

describe("ปุ่มลบ (.ad-staff-remove) — confirmDialog → deleteWithUndo → removeStaffRole", () => {
  beforeEach(async () => {
    globalThis.__GET_DOCS_STUB__ = () => SAMPLE_STAFF;
    await mod.renderStaffList();
  });

  test("กด 'ยกเลิก' บน confirmDialog → ไม่ลบ, แถวยังอยู่ครบ", async () => {
    staffRows()[0].querySelector(".ad-staff-remove").dispatchEvent(new Event("click", { bubbles: true }));
    await flushMicrotasks();
    const overlay = document.querySelector(".cp-confirm-overlay");
    assert.equal(overlay.style.display, "flex");
    overlay.querySelector("#cp-confirm-cancel").click();
    await flushMicrotasks();
    assert.equal((globalThis.__DELETE_DOC_CALLS__ || []).length, 0);
  });

  test("ยืนยันลบ แล้วกด 'เลิกทำ' ทันที → ไม่ลบจริง, รายการกลับมาแสดงเหมือนเดิม", async () => {
    staffRows()[0].querySelector(".ad-staff-remove").dispatchEvent(new Event("click", { bubbles: true }));
    await flushMicrotasks();
    document.querySelector("#cp-confirm-ok").click();
    await flushMicrotasks();
    // pendingSet เพิ่ม uid-A แล้ว render ใหม่ทันที → แถวหายไปชั่วคราว
    assert.equal(staffRows().length, 1);
    const undoBtn = document.querySelector(".cp-toast-undo-btn");
    assert.ok(undoBtn, "ต้องมี toast เลิกทำโผล่ขึ้นมา");
    undoBtn.click();
    await flushMicrotasks();
    assert.equal((globalThis.__DELETE_DOC_CALLS__ || []).length, 0);
    assert.equal(staffRows().length, 2, "กด 'เลิกทำ' แล้วรายการต้องกลับมาครบ");
  });

  test("ยืนยันลบ แล้วปล่อยผ่านจนหมดเวลา (5000ms) → removeStaffRole() ถูกเรียกจริง", async (t) => {
    // ใช้ setImmediate (macrotask จริง ไม่ถูก mock) แทน flushMicrotasks() ที่พึ่ง setTimeout —
    // เพราะรอบนี้ mock เฉพาะ setTimeout ไว้ ถ้าใช้ setTimeout(...,0) แทน จะถูก mock ไปด้วยและค้าง
    const flushReal = () => new Promise((r) => setImmediate(r));
    t.mock.timers.enable({ apis: ["setTimeout"] });
    staffRows()[0].querySelector(".ad-staff-remove").dispatchEvent(new Event("click", { bubbles: true }));
    await flushReal();
    document.querySelector("#cp-confirm-ok").click();
    await flushReal();
    t.mock.timers.tick(5000);
    await flushReal();
    await flushReal();
    assert.equal(globalThis.__DELETE_DOC_CALLS__.length, 1);
    assert.equal(globalThis.__DELETE_DOC_CALLS__[0].path, "staff/uid-A");
    t.mock.timers.reset();
  });
});

// helper: รอ microtask queue ระบาย (สำหรับ async event handler ที่ไม่มี promise ให้ await ตรงๆ)
function flushMicrotasks() {
  return new Promise((r) => setTimeout(r, 0));
}
