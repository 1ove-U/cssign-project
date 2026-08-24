// test/admin-groups.test.mjs — รอบที่ 108
//
// ขอบเขต: js/admin-groups.js (~140 บรรทัด) — แท็บ CATEGORIES ย่อย "หมวดหมู่ใหญ่" (GROUPS) — ชั้น
// บนสุดของ taxonomy: หมวดหมู่ใหญ่ > หมวดหมู่ย่อย > รายการสินค้า — renderGroups() (empty-state,
// subCount นับหมวดหมู่ย่อยที่ไม่ถูกลบค้าง, filter หมวดหมู่ใหญ่ที่ pending-delete), fillGroupSelect()
// (เติม <select id="ad-c-group"> ให้ฟอร์มหมวดหมู่ย่อย, คงค่าเดิมถ้ายังอยู่ในลิสต์), event
// delegation ปุ่มแก้ไข/ลบในตาราง (confirmDialog ข้อความต่างกันตามว่ามีหมวดหมู่ย่อยผูกอยู่ไหม →
// deleteWithUndo → deleteGroup()), openGroupModal()/closeGroupModal(), submit handler
// (saveGroup() → getGroups()+reloadAll() พร้อมกัน), และ flow ข้ามไฟล์ setGroupReturnToCategoryDraft()
// /reopenCategoryDraft() (ปุ่ม "+ เพิ่มหมวดหมู่ใหญ่ใหม่" ในโมดัลหมวดหมู่ย่อยของ
// admin-categories.js — ยังไม่ถูกสร้าง — จำค่าฟอร์มหมวดหมู่ย่อยไว้ก่อนเปิดโมดัลหมวดหมู่ใหญ่ แล้ว
// เปิดกลับพร้อมเลือกหมวดหมู่ใหญ่ที่เพิ่งสร้างให้อัตโนมัติ)
//
// ไฟล์นี้ import { reloadAll } from "./admin-page.js" ตรงๆ ที่ระดับบนสุด — admin-page.js ตัวจริง
// เป็นไฟล์ bootstrap ทั้งแอป โหลดไม่ได้ในสภาพแวดล้อมเทส จึงต้องพึ่ง
// test/helpers/admin-page-stub-loader.mjs (ขยาย ALLOWED_PARENT_RE รอบนี้ให้ครอบคลุมไฟล์นี้ด้วย —
// ดูรายละเอียดในไฟล์นั้น) ที่คืนโมดูลปลอมมีแค่ reloadAll() → เรียก
// globalThis.__AD_PAGE_STUB_RELOAD_ALL__ ถ้าเทสตั้งไว้ก่อน (ดู resetSpies())
//
// ไฟล์นี้ยัง import { getGroups, saveGroup, deleteGroup } จาก db-taxonomy.js (addDoc/updateDoc/
// deleteDoc/getDocs ผ่าน firebase-stub-loader.mjs เดิม — เก็บ call ไว้ที่
// globalThis.__ADD_DOC_CALLS__/__UPDATE_DOC_CALLS__/__DELETE_DOC_CALLS__, getGroups() อ่านผ่าน
// globalThis.__GET_DOCS_STUB__(ref) โดย ref.path === "groups" เสมอ — ต้องตั้งค่านี้เองในเทสที่
// ต้องพึ่งผลลัพธ์ของ getGroups() หลัง submit สำเร็จ เช่น flow reopenCategoryDraft ที่ต้องหา
// หมวดหมู่ใหญ่ที่เพิ่งสร้างจากลิสต์ที่โหลดใหม่)
//
// ลบใช้ confirmDialog() จริง + showUndoToast() จริง (pattern จาก test/admin-settings-staff.test.mjs
// รอบ 103: คลิก #cp-confirm-ok/#cp-confirm-cancel บน .cp-confirm-overlay, ปุ่ม .cp-toast-undo-btn —
// คลิกทันที = undone=true ไม่ลบจริง, ปล่อยผ่าน mock.timers 5000ms = ลบจริง)
//
// ตรวจโค้ดจริงทั้งไฟล์ js/admin-groups.js ก่อนเขียนเทสนี้ (อ่านครบ) — ไม่พบบั๊ก จึงเป็นไฟล์เทสล้วนๆ
// ไม่มีการแก้โค้ดผลิตภัณฑ์เลยแม้แต่บรรทัดเดียว (นอกจาก test/helpers/admin-page-stub-loader.mjs ที่
// เป็นโครงสร้างพื้นฐานของเทส ไม่ใช่โค้ดผลิตภัณฑ์)
//
// **ไม่มีเทส "saveGroup() reject"** ด้วยเหตุผลเดียวกับที่บันทึกไว้ใน
// test/admin-portfolio-form.test.mjs/test/admin-products-form.test.mjs รอบ 106-107:
// firebase-stub-loader.mjs ที่ใช้ร่วมกับทุกไฟล์เทสไม่มีช่องทางสั่งให้ addDoc()/updateDoc() throw
// ได้เลย (resolve สำเร็จเสมอตามดีไซน์ปัจจุบัน) — เพิ่มความสามารถนี้ต้องแก้ shared stub เกินขอบเขต
// งานรอบนี้ที่โฟกัสไฟล์เดียว

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
let mod;              // admin-groups.js exports
let setAllGroups;
let setAllCategories;
let pendingDeleteGroupIds;
let pendingDeleteCategoryIds;

function resetFirebaseCalls() {
  globalThis.__ADD_DOC_CALLS__ = [];
  globalThis.__UPDATE_DOC_CALLS__ = [];
  globalThis.__DELETE_DOC_CALLS__ = [];
  globalThis.__GET_DOCS_STUB__ = undefined;
}

function resetSpies() {
  globalThis.__AD_PAGE_STUB_RELOAD_ALL_CALLS__ = [];
  globalThis.__AD_PAGE_STUB_RELOAD_ALL__ = (...args) => {
    globalThis.__AD_PAGE_STUB_RELOAD_ALL_CALLS__.push(args);
  };
}

const SAMPLE_GROUPS = [
  { id: "g-1", name: "หมวดหมู่ใหญ่ A", icon: "🏷️" },
  { id: "g-2", name: "หมวดหมู่ใหญ่ B" }, // ไม่มี icon → ใช้ดีฟอลต์ 🗂️ ตอน render
];

function overlay() { return document.getElementById("ad-g-overlay"); }
function cOverlay() { return document.getElementById("ad-c-overlay"); }
function field(id) { return document.getElementById(id); }
function rows() { return Array.from(document.getElementById("ad-g-table-body").querySelectorAll("tr[data-id]")); }

before(async () => {
  const dom = new JSDOM(`<!doctype html><html><body>${ADMIN_BODY_NO_SCRIPTS}</body></html>`);
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
  globalThis.Event = dom.window.Event;
  globalThis.MouseEvent = dom.window.MouseEvent;
  document = dom.window.document;

  mod = await import("../js/admin-groups.js");
  ({ setAllGroups, setAllCategories, pendingDeleteGroupIds, pendingDeleteCategoryIds } =
    await import("../js/admin-state.js"));
});

beforeEach(() => {
  resetFirebaseCalls();
  resetSpies();
  setAllGroups(SAMPLE_GROUPS.map(g => ({ ...g })));
  setAllCategories([]);
  pendingDeleteGroupIds.clear();
  pendingDeleteCategoryIds.clear();
  // confirmDialog() cache overlay element ไว้ที่ module-level singleton (ui-helpers.js) — ห้ามลบ
  // element นี้ทิ้งจาก DOM แค่ปิดมันถ้าค้างเปิดอยู่จากเทสก่อนหน้า (แพทเทิร์นเดียวกับหลายไฟล์เทสก่อน)
  const confirmOverlay = document.querySelector(".cp-confirm-overlay");
  if (confirmOverlay && confirmOverlay.style.display === "flex") {
    confirmOverlay.querySelector("#cp-confirm-cancel").click();
  }
  if (overlay().style.display === "flex") overlay().style.display = "none";
  if (cOverlay().style.display === "flex") cOverlay().style.display = "none";
  document.querySelectorAll(".cp-toast-wrap .cp-toast").forEach(el => el.remove());
  mod.setGroupReturnToCategoryDraft(null);
});

describe("renderGroups()", () => {
  test("allGroups ว่าง → ข้อความ empty-state, ไม่มีแถว", () => {
    setAllGroups([]);
    mod.renderGroups();
    assert.match(document.getElementById("ad-g-table-body").innerHTML, /ยังไม่มีหมวดหมู่ใหญ่/);
    assert.equal(rows().length, 0);
  });

  test("render ปกติ: ไอคอนดีฟอลต์ 🗂️ ถ้าไม่มี, subCount นับเฉพาะหมวดหมู่ย่อยที่ไม่ pending-delete", () => {
    setAllCategories([
      { id: "c-1", group_id: "g-1" },
      { id: "c-2", group_id: "g-1" },
      { id: "c-3", group_id: "g-2" },
    ]);
    pendingDeleteCategoryIds.add("c-2");
    mod.renderGroups();
    const rs = rows();
    assert.equal(rs.length, 2);
    assert.match(rs[0].innerHTML, /หมวดหมู่ใหญ่ A/);
    assert.match(rs[0].innerHTML, /1 หมวดหมู่ย่อย/); // c-2 ถูกตัดออกเพราะ pending-delete
    assert.match(rs[1].innerHTML, /🗂️/); // g-2 ไม่มี icon
    assert.match(rs[1].innerHTML, /1 หมวดหมู่ย่อย/);
  });

  test("กรองหมวดหมู่ใหญ่ที่อยู่ใน pendingDeleteGroupIds ออกจากตาราง", () => {
    pendingDeleteGroupIds.add("g-2");
    mod.renderGroups();
    const rs = rows();
    assert.equal(rs.length, 1);
    assert.equal(rs[0].dataset.id, "g-1");
  });

  test("escape ชื่อ/ไอคอนที่มีอักขระ HTML พิเศษ กัน XSS", () => {
    setAllGroups([{ id: "g-x", name: "<script>alert(1)</script>" }]);
    mod.renderGroups();
    assert.doesNotMatch(document.getElementById("ad-g-table-body").innerHTML, /<script>alert/);
    assert.match(document.getElementById("ad-g-table-body").innerHTML, /&lt;script&gt;/);
  });
});

describe("fillGroupSelect()", () => {
  test("เติม option ครบตาม allGroups, escape ชื่อ", () => {
    setAllGroups([{ id: "g-x", name: "<b>ป้าย</b>" }]);
    mod.fillGroupSelect();
    const sel = field("ad-c-group");
    assert.equal(sel.options.length, 1);
    assert.equal(sel.options[0].value, "g-x");
    assert.doesNotMatch(sel.innerHTML, /<b>ป้าย/);
  });

  test("allGroups ว่าง → option เดียวบอกว่ายังไม่มีหมวดหมู่ใหญ่", () => {
    setAllGroups([]);
    mod.fillGroupSelect();
    const sel = field("ad-c-group");
    assert.equal(sel.options.length, 1);
    assert.equal(sel.options[0].value, "");
    assert.match(sel.options[0].textContent, /ยังไม่มีหมวดหมู่ใหญ่/);
  });

  test("คงค่าที่เลือกไว้เดิม ถ้ายังอยู่ในลิสต์ใหม่", () => {
    mod.fillGroupSelect();
    field("ad-c-group").value = "g-2";
    mod.fillGroupSelect(); // เรียกซ้ำ (เช่น re-render หลัง reload) — g-2 ยังอยู่
    assert.equal(field("ad-c-group").value, "g-2");
  });

  test("ค่าที่เลือกไว้เดิมหายไปจากลิสต์ใหม่ → ไม่พังค้าง (ตกไปที่ตัวเลือกแรกตามดีฟอลต์ของ <select>)", () => {
    mod.fillGroupSelect();
    field("ad-c-group").value = "g-2";
    setAllGroups([{ id: "g-1", name: "หมวดหมู่ใหญ่ A" }]); // g-2 หายไป
    mod.fillGroupSelect();
    assert.equal(field("ad-c-group").value, "g-1");
  });

  test("sel เป็น null (element หาย) → return เฉยๆ ไม่ throw", () => {
    const sel = field("ad-c-group");
    const parent = sel.parentNode;
    const next = sel.nextSibling;
    parent.removeChild(sel);
    try {
      assert.doesNotThrow(() => mod.fillGroupSelect());
    } finally {
      parent.insertBefore(sel, next); // คืน element กลับที่เดิมให้เทสอื่นใช้ต่อได้
    }
  });
});

describe("openGroupModal() / closeGroupModal()", () => {
  test("group = null (โหมดเพิ่ม) → หัวข้อ/ฟิลด์ว่างหมด", () => {
    mod.openGroupModal(null);
    assert.equal(field("ad-g-modal-title").textContent, "เพิ่มหมวดหมู่ใหญ่");
    assert.equal(field("ad-g-id").value, "");
    assert.equal(field("ad-g-name").value, "");
    assert.equal(field("ad-g-icon").value, "");
    assert.equal(overlay().style.display, "flex");
  });

  test("group ที่มีข้อมูล (โหมดแก้ไข) → เติมค่าเดิมครบ", () => {
    mod.openGroupModal({ id: "g-1", name: "หมวดหมู่ใหญ่ A", icon: "🏷️" });
    assert.equal(field("ad-g-modal-title").textContent, "แก้ไขหมวดหมู่ใหญ่");
    assert.equal(field("ad-g-id").value, "g-1");
    assert.equal(field("ad-g-name").value, "หมวดหมู่ใหญ่ A");
    assert.equal(field("ad-g-icon").value, "🏷️");
  });

  test("ปุ่ม 'ยกเลิก' → ปิดโมดัล + reset ฟอร์ม", () => {
    mod.openGroupModal({ id: "g-1", name: "หมวดหมู่ใหญ่ A", icon: "🏷️" });
    field("ad-g-cancel").click();
    assert.equal(overlay().style.display, "none");
    assert.equal(field("ad-g-name").value, "");
  });

  test("คลิก backdrop (target === overlay เอง) → ปิดโมดัล", () => {
    mod.openGroupModal(null);
    overlay().dispatchEvent(new Event("click", { bubbles: true, cancelable: true }));
    assert.equal(overlay().style.display, "none");
  });

  test("คลิกข้างในกล่องโมดัล (target ไม่ใช่ overlay เอง) → ไม่ปิด", () => {
    mod.openGroupModal(null);
    field("ad-g-name").dispatchEvent(new Event("click", { bubbles: true, cancelable: true }));
    assert.equal(overlay().style.display, "flex");
  });

  test("ปุ่ม '+ เพิ่มหมวดหมู่ใหญ่' (ad-g-add-btn) → เปิดโมดัลโหมดเพิ่ม", () => {
    field("ad-g-add-btn").click();
    assert.equal(overlay().style.display, "flex");
    assert.equal(field("ad-g-modal-title").textContent, "เพิ่มหมวดหมู่ใหญ่");
  });
});

describe("gTableBody — event delegation ปุ่มแก้ไข/ลบ", () => {
  beforeEach(() => { mod.renderGroups(); });

  test("คลิกที่ไม่ใช่ปุ่ม data-action → ไม่ทำอะไร", () => {
    rows()[0].click();
    assert.equal(overlay().style.display, "none");
  });

  test("คลิกปุ่มแก้ไข → เปิดโมดัลพร้อมข้อมูลหมวดหมู่ใหญ่แถวนั้น", () => {
    rows()[0].querySelector('[data-action="edit"]').dispatchEvent(new Event("click", { bubbles: true }));
    assert.equal(overlay().style.display, "flex");
    assert.equal(field("ad-g-id").value, "g-1");
    assert.equal(field("ad-g-name").value, "หมวดหมู่ใหญ่ A");
  });

  test("คลิกลบ (ไม่มีหมวดหมู่ย่อยผูกอยู่) → ข้อความ confirm แบบธรรมดา", async () => {
    rows()[0].querySelector('[data-action="delete"]').dispatchEvent(new Event("click", { bubbles: true }));
    await flushMicrotasks();
    const co = document.querySelector(".cp-confirm-overlay");
    assert.equal(co.style.display, "flex");
    assert.match(co.querySelector("#cp-confirm-msg").textContent, /ลบหมวดหมู่ใหญ่ "หมวดหมู่ใหญ่ A" ใช่หรือไม่/);
  });

  test("คลิกลบ (มีหมวดหมู่ย่อยผูกอยู่) → ข้อความ confirm เตือนเรื่องหมวดหมู่ย่อยกำพร้า", async () => {
    setAllCategories([{ id: "c-1", group_id: "g-1" }]);
    rows()[0].querySelector('[data-action="delete"]').dispatchEvent(new Event("click", { bubbles: true }));
    await flushMicrotasks();
    const co = document.querySelector(".cp-confirm-overlay");
    assert.match(co.querySelector("#cp-confirm-msg").textContent, /มีหมวดหมู่ย่อยอยู่ภายใน/);
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
    assert.equal(rows().length, 1); // g-1 หายไปชั่วคราว (pendingDeleteGroupIds)
    const undoBtn = document.querySelector(".cp-toast-undo-btn");
    assert.ok(undoBtn, "ต้องมี toast เลิกทำโผล่ขึ้นมา");
    undoBtn.click();
    await flushMicrotasks();
    assert.equal((globalThis.__DELETE_DOC_CALLS__ || []).length, 0);
    assert.equal(rows().length, 2, "กด 'เลิกทำ' แล้วรายการต้องกลับมาครบ");
  });

  test("ยืนยันลบ แล้วปล่อยผ่านจนหมดเวลา (5000ms) → deleteGroup() ถูกเรียกจริง + onCommitted = reloadAll()", async (t) => {
    // ใช้ setImmediate (macrotask จริง ไม่ถูก mock) แทน flushMicrotasks() ที่พึ่ง setTimeout —
    // เพราะรอบนี้ mock เฉพาะ setTimeout ไว้ (แพทเทิร์นเดียวกับ test/admin-settings-staff.test.mjs รอบ 103)
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
    assert.equal(globalThis.__DELETE_DOC_CALLS__[0].path, "groups/g-1");
    // onCommitted: reloadAll — แทนที่จะ renderFn() ธรรมดา
    assert.equal(globalThis.__AD_PAGE_STUB_RELOAD_ALL_CALLS__.length, 1);
    t.mock.timers.reset();
  });
});

describe("submit ฟอร์ม", () => {
  test("โหมดเพิ่มใหม่ → saveGroup() (addDoc) ถูกเรียกด้วย payload ถูกต้อง (trim แล้ว), ปิด modal, reloadAll()", async () => {
    globalThis.__GET_DOCS_STUB__ = () => [];
    mod.openGroupModal(null);
    field("ad-g-name").value = "  หมวดหมู่ใหญ่ใหม่  ";
    field("ad-g-icon").value = "  ✨  ";

    field("ad-g-form").dispatchEvent(new Event("submit", { cancelable: true }));
    await flushMicrotasks();
    await flushMicrotasks();

    assert.equal(globalThis.__ADD_DOC_CALLS__.length, 1);
    const { path, payload } = globalThis.__ADD_DOC_CALLS__[0];
    assert.equal(path, "groups");
    assert.equal(payload.name, "หมวดหมู่ใหญ่ใหม่");
    assert.equal(payload.icon, "✨");
    assert.equal(payload.id, undefined);

    assert.equal(overlay().style.display, "none");
    assert.equal(field("ad-g-name").value, "");
    assert.equal(globalThis.__AD_PAGE_STUB_RELOAD_ALL_CALLS__.length, 1);
  });

  test("โหมดแก้ไข (มี id) → updateDoc ถูกเรียกที่ groups/<id>, ไม่มี field id ปนใน payload", async () => {
    globalThis.__GET_DOCS_STUB__ = () => [];
    mod.openGroupModal({ id: "g-1", name: "หมวดหมู่ใหญ่ A", icon: "🏷️" });
    field("ad-g-name").value = "หมวดหมู่ใหญ่ A (แก้ไข)";

    field("ad-g-form").dispatchEvent(new Event("submit", { cancelable: true }));
    await flushMicrotasks();
    await flushMicrotasks();

    assert.equal(globalThis.__UPDATE_DOC_CALLS__.length, 1);
    const { path, payload } = globalThis.__UPDATE_DOC_CALLS__[0];
    assert.equal(path, "groups/g-1");
    assert.equal(payload.name, "หมวดหมู่ใหญ่ A (แก้ไข)");
    // saveGroup() (db-taxonomy.js) สร้าง payload สะอาดของตัวเอง {name,icon,order} จาก group.id
    // แค่เอาไปประกอบ doc() ref เฉยๆ (doc(db,"groups",group.id)) ไม่เคยเอา id ใส่กลับเข้า payload
    // เอง — ต่างจาก admin-groups.js ที่ตั้ง payload.id=id ไว้ใน object ของตัวเอง (ใช้เช็ค
    // if(id) เฉยๆ ตอนสร้าง payload ต้นทาง ไม่ได้ถูกส่งต่อเข้า updateDoc() จริง)
    assert.equal(payload.id, undefined);
    assert.equal(typeof payload.order, "number");
  });

  test("ปุ่ม submit disable + เปลี่ยนข้อความระหว่างบันทึก แล้วกลับปกติ", async () => {
    globalThis.__GET_DOCS_STUB__ = () => [];
    mod.openGroupModal(null);
    field("ad-g-name").value = "หมวดหมู่ใหญ่ใหม่";
    const btn = field("ad-g-form").querySelector('button[type=submit]');
    assert.equal(btn.disabled, false);
    field("ad-g-form").dispatchEvent(new Event("submit", { cancelable: true }));
    // ก่อน microtask ระบาย ปุ่มต้อง disable ทันที
    assert.equal(btn.disabled, true);
    assert.equal(btn.textContent, "กำลังบันทึก...");
    await flushMicrotasks();
    await flushMicrotasks();
    assert.equal(btn.disabled, false);
    assert.equal(btn.textContent, "บันทึก");
  });
});

describe("flow ข้ามไฟล์: setGroupReturnToCategoryDraft() / reopenCategoryDraft()", () => {
  const DRAFT = {
    id: "",
    name: "หมวดหมู่ย่อยร่าง",
    icon: "🔧",
    description: "รายละเอียดร่าง",
    groupId: "",
    priorGroupIds: new Set(["g-1", "g-2"]),
  };

  test("กด 'ยกเลิก' ตอนมี draft ค้างอยู่ → เปิดโมดัลหมวดหมู่ย่อยกลับพร้อมค่าที่เคยกรอกไว้", () => {
    mod.setGroupReturnToCategoryDraft({ ...DRAFT });
    mod.openGroupModal(null);
    field("ad-g-cancel").click();

    assert.equal(overlay().style.display, "none");
    assert.equal(cOverlay().style.display, "flex");
    assert.equal(field("ad-c-name").value, "หมวดหมู่ย่อยร่าง");
    assert.equal(field("ad-c-icon").value, "🔧");
    assert.equal(field("ad-c-desc").value, "รายละเอียดร่าง");
    assert.equal(field("ad-c-modal-title").textContent, "เพิ่มหมวดหมู่ย่อย");
  });

  test("กด 'ยกเลิก' ตอนมี draft ที่มี id (โหมดแก้ไขหมวดหมู่ย่อย) → หัวข้อโมดัลที่เปิดกลับเป็น 'แก้ไข'", () => {
    mod.setGroupReturnToCategoryDraft({ ...DRAFT, id: "c-9" });
    mod.openGroupModal(null);
    field("ad-g-cancel").click();
    assert.equal(field("ad-c-id").value, "c-9");
    assert.equal(field("ad-c-modal-title").textContent, "แก้ไขหมวดหมู่ย่อย");
  });

  test("บันทึกสำเร็จตอนมี draft ค้างอยู่ → หาหมวดหมู่ใหญ่ที่เพิ่งสร้างจาก getGroups() แล้วเลือกให้อัตโนมัติ", async () => {
    const REFRESHED_GROUPS = [
      { id: "g-1", name: "หมวดหมู่ใหญ่ A" },
      { id: "g-2", name: "หมวดหมู่ใหญ่ B" },
      { id: "g-new", name: "หมวดหมู่ใหญ่ใหม่" }, // รายการที่เพิ่งสร้าง (ไม่อยู่ใน priorGroupIds)
    ];
    globalThis.__GET_DOCS_STUB__ = (ref) =>
      ref.path === "groups" ? REFRESHED_GROUPS.map(g => ({ id: g.id, data: { name: g.name } })) : [];
    // fillGroupSelect() ที่เรียกใน reopenCategoryDraft() อ่านจากตัวแปร allGroups ของ
    // admin-state.js โดยตรง (ไม่ใช่ผลลัพธ์ getGroups() ที่ submit handler ได้มา) — reloadAll()
    // ตัวจริงใน admin-page.js เป็นคนอัปเดต allGroups ผ่าน setAllGroups() หลังโหลดข้อมูลใหม่
    // เทสนี้จึงต้องจำลองผลข้างเคียงนั้นเองผ่าน stub เพื่อให้ตัวเลือก "g-new" ปรากฏใน <select> จริง
    globalThis.__AD_PAGE_STUB_RELOAD_ALL__ = (...args) => {
      globalThis.__AD_PAGE_STUB_RELOAD_ALL_CALLS__.push(args);
      setAllGroups(REFRESHED_GROUPS.map(g => ({ ...g })));
    };
    mod.setGroupReturnToCategoryDraft({ ...DRAFT });
    mod.openGroupModal(null);
    field("ad-g-name").value = "หมวดหมู่ใหญ่ใหม่";

    field("ad-g-form").dispatchEvent(new Event("submit", { cancelable: true }));
    await flushMicrotasks();
    await flushMicrotasks();
    await flushMicrotasks();

    assert.equal(cOverlay().style.display, "flex");
    assert.equal(field("ad-c-group").value, "g-new", "ต้องเลือกหมวดหมู่ใหญ่ที่เพิ่งสร้างให้อัตโนมัติ");
    assert.equal(field("ad-c-name").value, "หมวดหมู่ย่อยร่าง");
    // gReturnToCategoryDraft ต้องถูกเคลียร์แล้ว (ปิด modal หมวดหมู่ใหญ่ตามปกติไม่เปิด ad-c-overlay ซ้ำ)
    assert.equal(overlay().style.display, "none");
  });

  test("บันทึกสำเร็จตอนมี draft แต่หา 'รายการที่เพิ่งสร้าง' ไม่เจอ (groups ทั้งหมดอยู่ใน priorGroupIds) → ใช้ d.groupId แทน", async () => {
    globalThis.__GET_DOCS_STUB__ = (ref) =>
      ref.path === "groups"
        ? [{ id: "g-1", data: { name: "หมวดหมู่ใหญ่ A" } }, { id: "g-2", data: { name: "หมวดหมู่ใหญ่ B" } }]
        : [];
    mod.setGroupReturnToCategoryDraft({ ...DRAFT, groupId: "g-2" });
    mod.openGroupModal(null);
    field("ad-g-name").value = "หมวดหมู่ใหญ่ใหม่"; // ค่าไม่ได้สำคัญ เพราะ __GET_DOCS_STUB__ ควบคุมผลลัพธ์เอง

    field("ad-g-form").dispatchEvent(new Event("submit", { cancelable: true }));
    await flushMicrotasks();
    await flushMicrotasks();
    await flushMicrotasks();

    assert.equal(field("ad-c-group").value, "g-2", "created ไม่เจอ (selectGroupId=\"\") → ตกไปใช้ d.groupId แทน");
  });
});

// helper: รอ microtask queue ระบาย (สำหรับ async event handler ที่ไม่มี promise ให้ await ตรงๆ)
function flushMicrotasks() {
  return new Promise((r) => setTimeout(r, 0));
}
