// test/admin-categories.test.mjs — รอบที่ 109
//
// ขอบเขต: js/admin-categories.js (~203 บรรทัด) — แท็บ CATEGORIES ย่อย "หมวดหมู่ย่อย" (CATEGORIES) —
// ชั้นล่างสุดของ taxonomy: หมวดหมู่ใหญ่ > หมวดหมู่ย่อย > รายการสินค้า — getFilteredCategories()
// (กรอง pending-delete, ค้นหาจากชื่อหมวดหมู่ย่อย/ชื่อหมวดหมู่ใหญ่), renderCategoriesPagination()
// (ซ่อน/แสดงกล่อง pagination, ข้อความช่วง, clamp หน้าปัจจุบันเมื่อรายการลดลง, ปุ่ม prev/next/เลข
// หน้า), renderCategories() (empty-state 2 แบบต่างข้อความ — allCategories ว่างเปล่า vs filter ไม่
// เจอ, ไอคอนดีฟอลต์ 🏷️, ชื่อหมวดหมู่ใหญ่ผ่าน groupName() หรือ fallback ถ้าไม่มี, escape HTML),
// cSearch input (รีเซ็ตหน้า 1 ก่อน render), event delegation ปุ่มแก้ไข/ลบในตาราง (confirmDialog
// ข้อความต่างกันตามว่ามีสินค้าผูกอยู่ไหม → deleteWithUndo → deleteCategory()), cAddBtn (เตือนถ้ายัง
// ไม่มีหมวดหมู่ใหญ่เลย), openCategoryModal()/closeCategoryModal(), submit handler (saveCategory() →
// reloadAll()), และ flow ข้ามไฟล์ cGroupNewBtn → setGroupReturnToCategoryDraft()+openGroupModal()
// (จาก admin-groups.js ที่ทำเสร็จแล้วรอบ 108 — import จริง ไม่ stub เพราะไม่ได้พึ่ง admin-page.js)
//
// ไฟล์นี้ import { reloadAll } from "./admin-page.js" ตรงๆ ที่ระดับบนสุด — เหมือน
// admin-portfolio-form.js/admin-products-form.js/admin-groups.js รอบก่อนหน้า จึงใช้
// test/helpers/admin-page-stub-loader.mjs ซ้ำได้ (ขยาย ALLOWED_PARENT_RE รอบนี้ให้ครอบคลุม
// "categories" ด้วยแล้ว — ดูรายละเอียดในไฟล์นั้น)
//
// ไฟล์นี้ยัง import { fillGroupSelect, openGroupModal, setGroupReturnToCategoryDraft } จาก
// "./admin-groups.js" ตรงๆ — โหลดเป็นโมดูลจริง (ไม่ stub) เพราะ admin-groups.js เองไม่มีปัญหา
// bootstrap ทั้งแอปเหมือน admin-page.js (import แค่ db-taxonomy.js/ui-helpers.js/admin-utils.js/
// admin-state.js/admin-page.js — ตัวหลังถูก stub ทะลุไปอีกที ผ่าน parentURL ของ admin-groups.js
// เองซึ่งอยู่ใน ALLOWED_PARENT_RE อยู่แล้วตั้งแต่รอบ 108)
//
// ลบใช้ confirmDialog() จริง + showUndoToast() จริง (pattern เดียวกับ test/admin-groups.test.mjs
// รอบ 108 / test/admin-settings-staff.test.mjs รอบ 103)
//
// ตรวจโค้ดจริงทั้งไฟล์ js/admin-categories.js ก่อนเขียนเทสนี้ (อ่านครบ) — ไม่พบบั๊ก จึงเป็นไฟล์เทส
// ล้วนๆ ไม่มีการแก้โค้ดผลิตภัณฑ์เลยแม้แต่บรรทัดเดียว (นอกจาก test/helpers/admin-page-stub-loader.mjs
// ที่เป็นโครงสร้างพื้นฐานของเทส ไม่ใช่โค้ดผลิตภัณฑ์)
//
// **ไม่มีเทส "saveCategory() reject"** ด้วยเหตุผลเดียวกับที่บันทึกไว้ใน test/admin-groups.test.mjs
// รอบ 108: firebase-stub-loader.mjs ที่ใช้ร่วมกับทุกไฟล์เทสไม่มีช่องทางสั่งให้ addDoc()/updateDoc()
// throw ได้เลย (resolve สำเร็จเสมอตามดีไซน์ปัจจุบัน)
//
// **CATEGORIES_PAGE_SIZE = 10** (private const ในไฟล์) — เทส pagination ใช้ 12 รายการตัวอย่างเพื่อ
// ให้ได้ 2 หน้าพอดี (หน้า 1: 10 แถว, หน้า 2: 2 แถว)

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
let mod;              // admin-categories.js exports
let groupsMod;        // admin-groups.js exports (สำหรับเช็ค flow ข้ามไฟล์)
let setAllCategories;
let setAllGroups;
let setAllProducts;
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
  { id: "g-1", name: "หมวดหมู่ใหญ่ A" },
  { id: "g-2", name: "หมวดหมู่ใหญ่ B" },
];

const SAMPLE_CATEGORIES = [
  { id: "c-1", name: "ป้ายเตือน", group_id: "g-1", icon: "⚠️", description: "คำอธิบาย 1" },
  { id: "c-2", name: "ป้ายบังคับ", group_id: "g-2" }, // ไม่มี icon/description → ดีฟอลต์
];

function overlay() { return document.getElementById("ad-c-overlay"); }
function gOverlay() { return document.getElementById("ad-g-overlay"); }
function field(id) { return document.getElementById(id); }
function rows() { return Array.from(document.getElementById("ad-c-table-body").querySelectorAll("tr[data-id]")); }
function pagBox() { return document.getElementById("ad-c-pagination"); }
function pagInfo() { return document.getElementById("ad-c-pagination-info"); }
function pagBtns() { return document.getElementById("ad-c-pagination-btns"); }

before(async () => {
  const dom = new JSDOM(`<!doctype html><html><body>${ADMIN_BODY_NO_SCRIPTS}</body></html>`);
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
  globalThis.Event = dom.window.Event;
  globalThis.MouseEvent = dom.window.MouseEvent;
  document = dom.window.document;

  mod = await import("../js/admin-categories.js");
  groupsMod = await import("../js/admin-groups.js");
  ({ setAllCategories, setAllGroups, setAllProducts, pendingDeleteCategoryIds } =
    await import("../js/admin-state.js"));
});

beforeEach(() => {
  resetFirebaseCalls();
  resetSpies();
  setAllGroups(SAMPLE_GROUPS.map(g => ({ ...g })));
  setAllCategories(SAMPLE_CATEGORIES.map(c => ({ ...c })));
  setAllProducts([]);
  pendingDeleteCategoryIds.clear();
  mod.setCCurrentPage(1);
  field("ad-c-search").value = "";
  // confirmDialog() cache overlay element ไว้ที่ module-level singleton (ui-helpers.js) — ห้ามลบ
  // element นี้ทิ้งจาก DOM แค่ปิดมันถ้าค้างเปิดอยู่จากเทสก่อนหน้า (แพทเทิร์นเดียวกับหลายไฟล์เทสก่อน)
  const confirmOverlay = document.querySelector(".cp-confirm-overlay");
  if (confirmOverlay && confirmOverlay.style.display === "flex") {
    confirmOverlay.querySelector("#cp-confirm-cancel").click();
  }
  if (overlay().style.display === "flex") overlay().style.display = "none";
  if (gOverlay().style.display === "flex") gOverlay().style.display = "none";
  document.querySelectorAll(".cp-toast-wrap .cp-toast").forEach(el => el.remove());
  groupsMod.setGroupReturnToCategoryDraft(null);
});

describe("renderCategories() — empty states", () => {
  test("allCategories ว่างเปล่าทั้งหมด → ข้อความ 'ยังไม่มีหมวดหมู่', ไม่มีแถว, ไม่มี pagination", () => {
    setAllCategories([]);
    mod.renderCategories();
    assert.match(document.getElementById("ad-c-table-body").innerHTML, /ยังไม่มีหมวดหมู่/);
    assert.equal(rows().length, 0);
    assert.equal(pagBox().style.display, "none");
  });

  test("มีหมวดหมู่อยู่แต่ค้นหาไม่เจอ → ข้อความ 'ไม่พบหมวดหมู่' (คนละข้อความกับตอนว่างเปล่าทั้งหมด)", () => {
    field("ad-c-search").value = "ไม่มีทางเจอคำนี้แน่นอน";
    mod.renderCategories();
    assert.match(document.getElementById("ad-c-table-body").innerHTML, /ไม่พบหมวดหมู่/);
    assert.doesNotMatch(document.getElementById("ad-c-table-body").innerHTML, /ยังไม่มีหมวดหมู่/);
    assert.equal(rows().length, 0);
    assert.equal(pagBox().style.display, "none");
  });
});

describe("renderCategories() — render ปกติ", () => {
  test("แสดงครบทุกแถว, ไอคอนดีฟอลต์ 🏷️ ถ้าไม่มี, คำอธิบายดีฟอลต์ — ถ้าไม่มี", () => {
    mod.renderCategories();
    const rs = rows();
    assert.equal(rs.length, 2);
    assert.match(rs[0].innerHTML, /ป้ายเตือน/);
    assert.match(rs[0].innerHTML, /⚠️/);
    assert.match(rs[0].innerHTML, /คำอธิบาย 1/);
    assert.match(rs[1].innerHTML, /🏷️/); // c-2 ไม่มี icon
    assert.match(rs[1].innerHTML, />—</); // c-2 ไม่มี description → "—"
  });

  test("แสดงชื่อหมวดหมู่ใหญ่ผ่าน groupName(group_id)", () => {
    mod.renderCategories();
    const rs = rows();
    assert.match(rs[0].innerHTML, /หมวดหมู่ใหญ่ A/);
    assert.match(rs[1].innerHTML, /หมวดหมู่ใหญ่ B/);
  });

  test("group_id ไม่ตรงกับหมวดหมู่ใหญ่ไหนเลย (หรือว่าง) → ข้อความ fallback '— ไม่มีหมวดหมู่ใหญ่ —'", () => {
    setAllCategories([{ id: "c-3", name: "ไม่มีหมวดหมู่ใหญ่", group_id: "" }]);
    mod.renderCategories();
    assert.match(rows()[0].innerHTML, /— ไม่มีหมวดหมู่ใหญ่ —/);
  });

  test("กรองหมวดหมู่ที่อยู่ใน pendingDeleteCategoryIds ออกจากตาราง", () => {
    pendingDeleteCategoryIds.add("c-1");
    mod.renderCategories();
    const rs = rows();
    assert.equal(rs.length, 1);
    assert.equal(rs[0].dataset.id, "c-2");
  });

  test("escape ชื่อ/ไอคอน/คำอธิบายที่มีอักขระ HTML พิเศษ กัน XSS", () => {
    setAllCategories([{ id: "c-x", name: "<script>alert(1)</script>", group_id: "" }]);
    mod.renderCategories();
    assert.doesNotMatch(document.getElementById("ad-c-table-body").innerHTML, /<script>alert/);
    assert.match(document.getElementById("ad-c-table-body").innerHTML, /&lt;script&gt;/);
  });
});

describe("getFilteredCategories() — ค้นหา (ผ่าน cSearch + renderCategories())", () => {
  test("ค้นหาด้วยชื่อหมวดหมู่ย่อย (ไม่สนตัวพิมพ์เล็ก/ใหญ่)", () => {
    field("ad-c-search").value = "ป้ายเตือน";
    mod.renderCategories();
    const rs = rows();
    assert.equal(rs.length, 1);
    assert.equal(rs[0].dataset.id, "c-1");
  });

  test("ค้นหาด้วยชื่อหมวดหมู่ใหญ่ (groupName) ก็เจอด้วย", () => {
    field("ad-c-search").value = "หมวดหมู่ใหญ่ B";
    mod.renderCategories();
    const rs = rows();
    assert.equal(rs.length, 1);
    assert.equal(rs[0].dataset.id, "c-2");
  });

  test("ช่องค้นหาว่าง/มีแต่ช่องว่าง (trim) → แสดงทุกแถว", () => {
    field("ad-c-search").value = "   ";
    mod.renderCategories();
    assert.equal(rows().length, 2);
  });

  test("input event บนช่องค้นหา → รีเซ็ตหน้าเป็น 1 แล้ว render ใหม่", () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ id: `c-${i}`, name: `หมวดหมู่ ${i}`, group_id: "g-1" }));
    setAllCategories(many);
    mod.renderCategories();
    // ไปหน้า 2 ก่อน
    pagBtns().querySelector('[data-page="2"]').click();
    assert.equal(pagInfo().textContent, "แสดง 11–12 จาก 12 รายการ");
    // พิมพ์ค้นหา (แม้จะว่างเปล่า) → ต้องรีเซ็ตกลับหน้า 1
    field("ad-c-search").dispatchEvent(new Event("input", { bubbles: true }));
    assert.equal(pagInfo().textContent, "แสดง 1–10 จาก 12 รายการ");
  });
});

describe("renderCategoriesPagination()", () => {
  test("มีอย่างน้อย 1 รายการ (แม้ ≤ 10 = 1 หน้าพอดี) → กล่อง pagination ยังแสดงอยู่ (แค่ totalRows=0 เท่านั้นที่ซ่อน)", () => {
    mod.renderCategories(); // มีแค่ 2 รายการ (1 หน้า)
    assert.equal(pagBox().style.display, "flex");
    assert.equal(pagInfo().textContent, "แสดง 1–2 จาก 2 รายการ");
  });

  test("ไม่มีรายการเลย (totalRows=0) → ซ่อนกล่อง pagination", () => {
    setAllCategories([]);
    mod.renderCategories();
    assert.equal(pagBox().style.display, "none");
  });

  test("รายการ 12 ชิ้น (page size 10) → แสดงกล่อง, ข้อความช่วงถูกต้อง, ปุ่มหน้าครบ 2 หน้า", () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ id: `c-${i}`, name: `หมวดหมู่ ${i}`, group_id: "" }));
    setAllCategories(many);
    mod.renderCategories();
    assert.equal(pagBox().style.display, "flex");
    assert.equal(pagInfo().textContent, "แสดง 1–10 จาก 12 รายการ");
    assert.equal(rows().length, 10);
    const pageBtns = Array.from(pagBtns().querySelectorAll(".cp-page-btn"));
    // prev, 1, 2, next
    assert.equal(pageBtns.length, 4);
    assert.equal(pageBtns[0].disabled, true, "ปุ่มก่อนหน้าต้อง disabled ตอนอยู่หน้า 1");
    assert.equal(pageBtns[3].disabled, false, "ปุ่มถัดไปต้องกดได้ตอนยังไม่ถึงหน้าสุดท้าย");
  });

  test("คลิกปุ่มเลขหน้า → เปลี่ยนหน้า, render แถวของหน้านั้น, เลื่อนไปที่ตาราง", () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ id: `c-${i}`, name: `หมวดหมู่ ${i}`, group_id: "" }));
    setAllCategories(many);
    mod.renderCategories();
    pagBtns().querySelector('[data-page="2"]').click();
    assert.equal(pagInfo().textContent, "แสดง 11–12 จาก 12 รายการ");
    assert.equal(rows().length, 2);
    assert.equal(rows()[0].dataset.id, "c-10");
  });

  test("คลิกปุ่ม 'next'/'prev' → เปลี่ยนหน้าไปทิศทางที่ถูกต้อง", () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ id: `c-${i}`, name: `หมวดหมู่ ${i}`, group_id: "" }));
    setAllCategories(many);
    mod.renderCategories();
    pagBtns().querySelector('[data-page="next"]').click();
    assert.equal(pagInfo().textContent, "แสดง 11–12 จาก 12 รายการ");
    pagBtns().querySelector('[data-page="prev"]').click();
    assert.equal(pagInfo().textContent, "แสดง 1–10 จาก 12 รายการ");
  });

  test("ปุ่มที่ disabled ไม่ทำอะไรถ้าคลิก (prev ตอนอยู่หน้าแรก)", () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ id: `c-${i}`, name: `หมวดหมู่ ${i}`, group_id: "" }));
    setAllCategories(many);
    mod.renderCategories();
    pagBtns().querySelector('[data-page="prev"]').click();
    assert.equal(pagInfo().textContent, "แสดง 1–10 จาก 12 รายการ", "ยังอยู่หน้า 1 เหมือนเดิม");
  });

  test("อยู่หน้า 2 แล้วค้นหาจนเหลือ 1 รายการ → หน้าปัจจุบัน clamp กลับมาที่หน้า 1 อัตโนมัติ", () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ id: `c-${i}`, name: `หมวดหมู่ ${i}`, group_id: "" }));
    setAllCategories(many);
    mod.renderCategories();
    pagBtns().querySelector('[data-page="2"]').click();
    field("ad-c-search").value = "หมวดหมู่ 0"; // เหลือรายการเดียว (c-0)
    mod.renderCategories();
    assert.equal(rows().length, 1);
    assert.equal(pagInfo().textContent, "แสดง 1–1 จาก 1 รายการ", "หน้าปัจจุบันต้อง clamp กลับมาที่ 1");
  });
});

describe("cAddBtn", () => {
  test("allGroups ว่างเปล่า → แจ้งเตือนด้วย toast, ไม่เปิดโมดัล", () => {
    setAllGroups([]);
    field("ad-c-add-btn").click();
    assert.equal(overlay().style.display, "none");
    const toast = document.querySelector(".cp-toast-wrap .cp-toast");
    assert.ok(toast, "ต้องมี toast โผล่ขึ้นมา");
    assert.match(toast.textContent, /กรุณาเพิ่มหมวดหมู่ใหญ่อย่างน้อย 1 รายการก่อน/);
  });

  test("มีหมวดหมู่ใหญ่อยู่แล้ว → เปิดโมดัลโหมดเพิ่ม (ฟิลด์ว่างหมด)", () => {
    field("ad-c-add-btn").click();
    assert.equal(overlay().style.display, "flex");
    assert.equal(field("ad-c-modal-title").textContent, "เพิ่มหมวดหมู่ย่อย");
    assert.equal(field("ad-c-id").value, "");
    assert.equal(field("ad-c-name").value, "");
    assert.equal(field("ad-c-group").value, "");
  });
});

describe("openCategoryModal() / closeCategoryModal()", () => {
  test("เปิดโมดัลเพิ่ม → fillGroupSelect() เติม <select> หมวดหมู่ใหญ่ให้ครบ", () => {
    field("ad-c-add-btn").click();
    const sel = field("ad-c-group");
    assert.equal(sel.options.length, 2);
    assert.equal(sel.options[0].value, "g-1");
  });

  test("เปิดโมดัลแก้ไข (จากปุ่มแก้ไขในตาราง) → เติมค่าเดิมครบทุกฟิลด์", () => {
    mod.renderCategories();
    rows()[0].querySelector('[data-action="edit"]').dispatchEvent(new Event("click", { bubbles: true }));
    assert.equal(overlay().style.display, "flex");
    assert.equal(field("ad-c-modal-title").textContent, "แก้ไขหมวดหมู่ย่อย");
    assert.equal(field("ad-c-id").value, "c-1");
    assert.equal(field("ad-c-name").value, "ป้ายเตือน");
    assert.equal(field("ad-c-group").value, "g-1");
    assert.equal(field("ad-c-icon").value, "⚠️");
    assert.equal(field("ad-c-desc").value, "คำอธิบาย 1");
  });

  test("ปุ่ม 'ยกเลิก' → ปิดโมดัล + reset ฟอร์ม", () => {
    field("ad-c-add-btn").click();
    field("ad-c-name").value = "ทดลองพิมพ์";
    field("ad-c-cancel").click();
    assert.equal(overlay().style.display, "none");
    assert.equal(field("ad-c-name").value, "");
  });

  test("คลิก backdrop (target === overlay เอง) → ปิดโมดัล", () => {
    field("ad-c-add-btn").click();
    overlay().dispatchEvent(new Event("click", { bubbles: true, cancelable: true }));
    assert.equal(overlay().style.display, "none");
  });

  test("คลิกข้างในกล่องโมดัล (target ไม่ใช่ overlay เอง) → ไม่ปิด", () => {
    field("ad-c-add-btn").click();
    field("ad-c-name").dispatchEvent(new Event("click", { bubbles: true, cancelable: true }));
    assert.equal(overlay().style.display, "flex");
  });
});

describe("cTableBody — event delegation ปุ่มแก้ไข/ลบ", () => {
  beforeEach(() => { mod.renderCategories(); });

  test("คลิกที่ไม่ใช่ปุ่ม data-action → ไม่ทำอะไร", () => {
    rows()[0].click();
    assert.equal(overlay().style.display, "none");
  });

  test("คลิกลบ (ไม่มีสินค้าผูกอยู่) → ข้อความ confirm แบบธรรมดา", async () => {
    rows()[0].querySelector('[data-action="delete"]').dispatchEvent(new Event("click", { bubbles: true }));
    await flushMicrotasks();
    const co = document.querySelector(".cp-confirm-overlay");
    assert.equal(co.style.display, "flex");
    assert.match(co.querySelector("#cp-confirm-msg").textContent, /ลบหมวดหมู่ "ป้ายเตือน" ใช่หรือไม่/);
  });

  test("คลิกลบ (มีสินค้าผูกอยู่ผ่าน cat_id) → ข้อความ confirm เตือนเรื่องสินค้าไม่มีหมวดหมู่", async () => {
    setAllProducts([{ id: "p-1", cat_id: "c-1" }]);
    rows()[0].querySelector('[data-action="delete"]').dispatchEvent(new Event("click", { bubbles: true }));
    await flushMicrotasks();
    const co = document.querySelector(".cp-confirm-overlay");
    assert.match(co.querySelector("#cp-confirm-msg").textContent, /สินค้าเหล่านั้นไม่มีหมวดหมู่/);
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
    assert.equal(rows().length, 1); // c-1 หายไปชั่วคราว (pendingDeleteCategoryIds)
    const undoBtn = document.querySelector(".cp-toast-undo-btn");
    assert.ok(undoBtn, "ต้องมี toast เลิกทำโผล่ขึ้นมา");
    undoBtn.click();
    await flushMicrotasks();
    assert.equal((globalThis.__DELETE_DOC_CALLS__ || []).length, 0);
    assert.equal(rows().length, 2, "กด 'เลิกทำ' แล้วรายการต้องกลับมาครบ");
  });

  test("ยืนยันลบ แล้วปล่อยผ่านจนหมดเวลา (5000ms) → deleteCategory() ถูกเรียกจริง + onCommitted = reloadAll()", async (t) => {
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
    assert.equal(globalThis.__DELETE_DOC_CALLS__[0].path, "categories/c-1");
    assert.equal(globalThis.__AD_PAGE_STUB_RELOAD_ALL_CALLS__.length, 1);
    t.mock.timers.reset();
  });
});

describe("cGroupNewBtn — flow ข้ามไฟล์ไปเปิดโมดัลหมวดหมู่ใหญ่", () => {
  test("คลิก → จำค่าฟอร์มหมวดหมู่ย่อยปัจจุบันไว้, ปิดโมดัลนี้, เปิดโมดัลหมวดหมู่ใหญ่โหมดเพิ่มแทน", () => {
    field("ad-c-add-btn").click();
    field("ad-c-name").value = "หมวดหมู่ย่อยร่าง";
    field("ad-c-icon").value = "🔧";
    field("ad-c-desc").value = "รายละเอียดร่าง";

    field("ad-c-group-new-btn").click();

    assert.equal(overlay().style.display, "none");
    assert.equal(gOverlay().style.display, "flex");
    assert.equal(field("ad-g-modal-title").textContent, "เพิ่มหมวดหมู่ใหญ่");
  });

  test("กด 'ยกเลิก' ในโมดัลหมวดหมู่ใหญ่หลังจากนั้น → เปิดโมดัลหมวดหมู่ย่อยกลับมาพร้อมค่าที่เคยกรอกไว้ (ยืนยันว่า draft ถูกส่งข้ามไฟล์ถูกต้อง)", () => {
    field("ad-c-add-btn").click();
    field("ad-c-name").value = "หมวดหมู่ย่อยร่าง";
    field("ad-c-icon").value = "🔧";
    field("ad-c-desc").value = "รายละเอียดร่าง";
    field("ad-c-group-new-btn").click();

    field("ad-g-cancel").click();

    assert.equal(gOverlay().style.display, "none");
    assert.equal(overlay().style.display, "flex");
    assert.equal(field("ad-c-name").value, "หมวดหมู่ย่อยร่าง");
    assert.equal(field("ad-c-icon").value, "🔧");
    assert.equal(field("ad-c-desc").value, "รายละเอียดร่าง");
  });

  test("โหมดแก้ไข (มี ad-c-id) → draft พก id เดิมไปด้วย, กลับมาแล้วหัวข้อโมดัลยังเป็น 'แก้ไข'", () => {
    mod.renderCategories();
    rows()[0].querySelector('[data-action="edit"]').dispatchEvent(new Event("click", { bubbles: true }));
    field("ad-c-group-new-btn").click();
    field("ad-g-cancel").click();
    assert.equal(field("ad-c-id").value, "c-1");
    assert.equal(field("ad-c-modal-title").textContent, "แก้ไขหมวดหมู่ย่อย");
  });
});

describe("submit ฟอร์ม", () => {
  test("โหมดเพิ่มใหม่ → saveCategory() (addDoc) ถูกเรียกด้วย payload ถูกต้อง (trim แล้ว), group ก็อปชื่อหมวดหมู่ใหญ่มาด้วย, ไม่มี id, ปิด modal, reloadAll()", async () => {
    globalThis.__GET_DOCS_STUB__ = () => [];
    field("ad-c-add-btn").click();
    field("ad-c-name").value = "  หมวดหมู่ใหม่  ";
    field("ad-c-group").value = "g-2";
    field("ad-c-icon").value = "  ✨  ";
    field("ad-c-desc").value = "  รายละเอียด  ";

    field("ad-c-form").dispatchEvent(new Event("submit", { cancelable: true }));
    await flushMicrotasks();
    await flushMicrotasks();

    assert.equal(globalThis.__ADD_DOC_CALLS__.length, 1);
    const { path, payload } = globalThis.__ADD_DOC_CALLS__[0];
    assert.equal(path, "categories");
    assert.equal(payload.name, "หมวดหมู่ใหม่");
    assert.equal(payload.group_id, "g-2");
    assert.equal(payload.group, "หมวดหมู่ใหญ่ B");
    assert.equal(payload.icon, "✨");
    assert.equal(payload.description, "รายละเอียด");
    assert.equal(payload.id, undefined);

    assert.equal(overlay().style.display, "none");
    assert.equal(globalThis.__AD_PAGE_STUB_RELOAD_ALL_CALLS__.length, 1);
  });

  test("โหมดแก้ไข (มี id) → updateDoc ถูกเรียกที่ categories/<id>, ไม่มี field id ปนใน payload จริง", async () => {
    globalThis.__GET_DOCS_STUB__ = () => [];
    mod.renderCategories();
    rows()[0].querySelector('[data-action="edit"]').dispatchEvent(new Event("click", { bubbles: true }));
    field("ad-c-name").value = "ป้ายเตือน (แก้ไข)";

    field("ad-c-form").dispatchEvent(new Event("submit", { cancelable: true }));
    await flushMicrotasks();
    await flushMicrotasks();

    assert.equal(globalThis.__UPDATE_DOC_CALLS__.length, 1);
    const { path, payload } = globalThis.__UPDATE_DOC_CALLS__[0];
    assert.equal(path, "categories/c-1");
    assert.equal(payload.name, "ป้ายเตือน (แก้ไข)");
    // saveCategory() (db-taxonomy.js) สร้าง payload สะอาดของตัวเอง {name,icon,description,
    // group_id,group} จาก cat.id แค่เอาไปประกอบ doc() ref เฉยๆ ไม่เคยเอา id ใส่กลับเข้า payload
    // จริง — เหมือนกับที่พบใน saveGroup() รอบ 108
    assert.equal(payload.id, undefined);
  });

  test("ปุ่ม submit disable + เปลี่ยนข้อความระหว่างบันทึก แล้วกลับปกติ", async () => {
    globalThis.__GET_DOCS_STUB__ = () => [];
    field("ad-c-add-btn").click();
    field("ad-c-name").value = "หมวดหมู่ใหม่";
    const btn = field("ad-c-form").querySelector('button[type=submit]');
    assert.equal(btn.disabled, false);
    field("ad-c-form").dispatchEvent(new Event("submit", { cancelable: true }));
    // ก่อน microtask ระบาย ปุ่มต้อง disable ทันที
    assert.equal(btn.disabled, true);
    assert.equal(btn.textContent, "กำลังบันทึก...");
    await flushMicrotasks();
    await flushMicrotasks();
    assert.equal(btn.disabled, false);
    assert.equal(btn.textContent, "บันทึก");
  });
});

// helper: รอ microtask queue ระบาย (สำหรับ async event handler ที่ไม่มี promise ให้ await ตรงๆ)
function flushMicrotasks() {
  return new Promise((r) => setTimeout(r, 0));
}
