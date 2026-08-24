// test/admin-blog.test.mjs — รอบที่ 114
//
// ขอบเขต: js/admin-blog.js (234 บรรทัด) — ไฟล์กริดหลักของแท็บบทความ คู่กับ
// js/admin-blog-form.js (เทสแยกไว้แล้วรอบ 113) — getFilteredBlogs()/renderBlogs() (private,
// ทดสอบผ่าน public API เท่านั้น), renderBlogsPagination(), bSearch/bFilterStatus event listeners,
// bGrid event delegation (ปุ่มแก้ไข/ทำซ้ำ/ลบ + deleteWithUndo), **bulk actions ที่ยังไม่เคยมี
// แพทเทิร์นเทสไฟล์ไหนในกลุ่ม admin-* คลุมมาก่อน** (checkbox เลือกหลายการ์ด, ปุ่มล้างการเลือก,
// เปลี่ยนสถานะทีเดียว, ลบทีเดียว), bAddBtn
//
// ไฟล์นี้ import { reloadAll } from "./admin-page.js" ตรงๆ ที่ระดับบนสุด — ใช้
// test/helpers/admin-page-stub-loader.mjs ซ้ำได้ แค่ขยาย ALLOWED_PARENT_RE เพิ่ม "blog" (แยกจาก
// "blog-form" ที่มีอยู่แล้วตั้งแต่รอบ 113 — คนละไฟล์กัน)
//
// แพทเทิร์น bulk actions อ้างอิงจาก test/orders-tab-bulk-select.test.mjs (รอบ 94, checkbox
// select/clear/apply-status ผ่าน Promise.all) และ test/orders-tab-render-delete.test.mjs (รอบ 95,
// ปุ่ม "ลบที่เลือก" ผ่าน confirmDialog ก่อนแล้วค่อย Promise.all(deleteFn) — **ไม่มี undo
// toast/timer สำหรับ bulk delete ของบทความ** ต่างจาก orders ที่มี showUndoToast() เพิ่มอีกชั้น —
// ตรวจโค้ดจริงยืนยันแล้วว่า admin-blog.js bulk delete ยิง deleteBlog() ทันทีหลัง confirmDialog
// ไม่มี undo)
//
// selectedBlogIds เป็น module-level Set ไม่มี export/setter เลย (ต่างจาก bCurrentPage ที่มี
// setBCurrentPage() export ไว้ให้ admin-global-search-jump.js ใช้) — reset ผ่านปุ่ม
// "ล้างการเลือก" (ad-b-bulk-clear) จริงใน beforeEach() แบบเดียวกับ orders-tab
//
// ตรวจโค้ดจริงทั้งไฟล์ js/admin-blog.js + saveBlog()/deleteBlog() ใน js/db-blog.js ก่อนเขียนเทสนี้
// (อ่านครบ) — ไม่พบบั๊ก จึงเป็นไฟล์เทสล้วนๆ ไม่มีการแก้โค้ดผลิตภัณฑ์เลยแม้แต่บรรทัดเดียว (นอกจาก
// test/helpers/admin-page-stub-loader.mjs ที่เป็นโครงสร้างพื้นฐานของเทส ไม่ใช่โค้ดผลิตภัณฑ์ —
// ขยาย regex บรรทัดเดียว + คอมเมนต์)
//
// **ไม่มีเทส "saveBlog()/deleteBlog() reject"** ด้วยเหตุผลเดียวกับที่บันทึกไว้ในไฟล์เทสรอบก่อนๆ:
// firebase-stub-loader.mjs ที่ใช้ร่วมกับทุกไฟล์เทสไม่มีช่องทางสั่งให้ addDoc()/updateDoc()/
// deleteDoc() throw ได้เลย (resolve สำเร็จเสมอตามดีไซน์ปัจจุบัน)
//
// **ไม่คลุม openBlogModal()/openBlogModalClone() แบบละเอียด** (ทดสอบครบแล้วใน
// test/admin-blog-form.test.mjs รอบ 113) — ไฟล์นี้ทดสอบแค่ว่าปุ่มแก้ไข/ทำซ้ำ/เพิ่มบทความเรียก
// ฟังก์ชันเหล่านั้นถูกต้อง (เปิด overlay จริงเพราะ import เป็นโมดูลจริง ไม่ได้ stub)

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
let mod;         // admin-blog.js exports
let setAllBlogs; // จาก admin-state.js
let pendingDeleteBlogIds;

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

const SAMPLE_BLOGS = [
  { id: "b-1", title: "มาตรฐานป้ายความปลอดภัย มอก.", category: "ความรู้ทั่วไป", status: "published", image: "https://res.cloudinary.com/x/a.jpg" },
  { id: "b-2", title: "วิธีเลือกวัสดุทำป้าย", category: "เทคนิค", status: "draft", image: "" },
];

function overlay() { return document.getElementById("ad-b-overlay"); }
function field(id) { return document.getElementById(id); }
function cards() { return Array.from(document.getElementById("ad-b-grid").querySelectorAll(".ad-card[data-id]")); }
function cardCheckbox(id) { return document.querySelector(`.ad-card-check[data-id="${id}"]`); }
function pagBox() { return document.getElementById("ad-b-pagination"); }
function pagInfo() { return document.getElementById("ad-b-pagination-info"); }
function pagBtns() { return document.getElementById("ad-b-pagination-btns"); }
function bulkBar() { return document.getElementById("ad-b-bulk-bar"); }
function bulkCount() { return document.getElementById("ad-b-bulk-count"); }

function selectCards(ids) {
  ids.forEach(id => {
    const cb = cardCheckbox(id);
    cb.checked = true;
    cb.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

function flushMicrotasks() {
  return new Promise((r) => setTimeout(r, 0));
}

before(async () => {
  const dom = new JSDOM(`<!doctype html><html><body>${ADMIN_BODY_NO_SCRIPTS}</body></html>`);
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
  globalThis.Event = dom.window.Event;
  document = dom.window.document;

  mod = await import("../js/admin-blog.js");
  ({ setAllBlogs, pendingDeleteBlogIds } = await import("../js/admin-state.js"));
});

beforeEach(() => {
  resetFirebaseCalls();
  resetSpies();
  pendingDeleteBlogIds.clear();
  field("ad-b-search").value = "";
  field("ad-b-filter-status").value = "";
  mod.setBCurrentPage(1);
  document.getElementById("ad-b-bulk-clear").click(); // เคลียร์ selectedBlogIds ที่ไม่มี setter export
  setAllBlogs(SAMPLE_BLOGS.map(b => ({ ...b })));
  const confirmOverlay = document.querySelector(".cp-confirm-overlay");
  if (confirmOverlay && confirmOverlay.style.display === "flex") {
    confirmOverlay.querySelector("#cp-confirm-cancel").click();
  }
  if (overlay().style.display === "flex") overlay().style.display = "none";
  document.querySelectorAll(".cp-toast-wrap .cp-toast").forEach(el => el.remove());
});

describe("renderBlogs() — empty states", () => {
  test("allBlogs ว่างเปล่าทั้งหมด → empty-state ไม่มีตัวกรอง (มีปุ่ม CTA เพิ่มรายการแรก)", () => {
    setAllBlogs([]);
    mod.renderBlogs();
    assert.match(document.getElementById("ad-b-grid").innerHTML, /ยังไม่มีบทความในระบบ/);
    assert.equal(cards().length, 0);
    assert.equal(pagBox().style.display, "none");
    assert.ok(field("ad-b-empty-add"));
  });

  test("มีตัวกรอง (ค้นหา) แล้วไม่เจอผลลัพธ์ → ข้อความคนละแบบ ไม่มีปุ่ม CTA", () => {
    field("ad-b-search").value = "ไม่มีทางเจอ";
    mod.renderBlogs();
    assert.match(document.getElementById("ad-b-grid").innerHTML, /ไม่พบบทความที่ตรงกับตัวกรอง/);
    assert.doesNotMatch(document.getElementById("ad-b-grid").innerHTML, /ยังไม่มีบทความในระบบ/);
    assert.equal(field("ad-b-empty-add"), null);
  });

  test("empty-state ปุ่ม 'เพิ่มรายการแรก' → คลิกแล้วเปิดโมดัลโหมดเพิ่ม", () => {
    setAllBlogs([]);
    mod.renderBlogs();
    field("ad-b-empty-add").click();
    assert.equal(overlay().style.display, "flex");
    assert.equal(field("ad-b-id").value, "");
  });

  test("ทุกบทความถูก mark pending-delete หมด → empty-state แบบมีตัวกรอง (filteredRows ว่างทั้งที่ allBlogs มีของ)", () => {
    pendingDeleteBlogIds.add("b-1");
    pendingDeleteBlogIds.add("b-2");
    mod.renderBlogs();
    assert.equal(cards().length, 0);
    assert.equal(pagBox().style.display, "none");
  });
});

describe("renderBlogs() — render ปกติ", () => {
  test("แสดงครบทุกการ์ด ชื่อ/หมวดหมู่ถูกต้อง", () => {
    mod.renderBlogs();
    const cs = cards();
    assert.equal(cs.length, 2);
    assert.match(cs[0].querySelector(".ad-card-name").textContent, /มาตรฐานป้ายความปลอดภัย มอก\./);
    assert.match(cs[0].querySelector(".ad-card-cat").textContent, /ความรู้ทั่วไป/);
  });

  test("มีรูป → ใช้ <img>, ไม่มีรูป → ใช้ svg placeholder + class no-photo", () => {
    mod.renderBlogs();
    const cs = cards();
    const withImg = cs.find(c => c.dataset.id === "b-1");
    const noImg = cs.find(c => c.dataset.id === "b-2");
    assert.ok(withImg.querySelector(".port-visual img"));
    assert.equal(withImg.querySelector(".port-visual").classList.contains("no-photo"), false);
    assert.ok(noImg.querySelector(".port-visual svg"));
    assert.equal(noImg.querySelector(".port-visual").classList.contains("no-photo"), true);
  });

  test("สถานะ draft → มีป้าย 'ฉบับร่าง', published → ไม่มี", () => {
    mod.renderBlogs();
    const cs = cards();
    const draft = cs.find(c => c.dataset.id === "b-2");
    const published = cs.find(c => c.dataset.id === "b-1");
    assert.ok(draft.querySelector(".ad-b-status-draft"));
    assert.equal(published.querySelector(".ad-b-status-draft"), null);
  });

  test("status เป็นค่าว่าง/undefined → ถือเป็น published (ไม่มีป้ายฉบับร่าง)", () => {
    setAllBlogs([{ id: "b-x", title: "ไม่มีสถานะ" }]);
    mod.renderBlogs();
    assert.equal(cards()[0].querySelector(".ad-b-status-draft"), null);
  });

  test("กรองที่อยู่ใน pendingDeleteBlogIds ออกจากกริด (เหลือแถวเดียว)", () => {
    pendingDeleteBlogIds.add("b-1");
    mod.renderBlogs();
    const cs = cards();
    assert.equal(cs.length, 1);
    assert.equal(cs[0].dataset.id, "b-2");
  });

  test("escape ชื่อ/หมวดหมู่ที่มีอักขระ HTML พิเศษ กัน XSS", () => {
    setAllBlogs([{ id: "b-x", title: "<img src=x onerror=alert(1)>", category: "<b>bold</b>" }]);
    mod.renderBlogs();
    const html = document.getElementById("ad-b-grid").innerHTML;
    assert.doesNotMatch(html, /<img src=x onerror/);
    assert.doesNotMatch(html, /<b>bold<\/b>/);
    assert.match(html, /&lt;img/);
    assert.match(html, /&lt;b&gt;/);
  });

  test("title/category เป็นค่าว่าง/undefined → ใช้ค่าดีฟอลต์ ไม่พัง", () => {
    setAllBlogs([{ id: "b-y" }]);
    assert.doesNotThrow(() => mod.renderBlogs());
    const c = cards()[0];
    assert.match(c.querySelector(".ad-card-name").textContent, /ไม่มีชื่อ/);
    assert.match(c.querySelector(".ad-card-cat").textContent, /บทความ/);
  });

  test("checkbox เลือกของการ์ด: checked ตรงกับ selectedBlogIds ที่ยังค้างอยู่ข้าม re-render", () => {
    mod.renderBlogs();
    selectCards(["b-1"]);
    mod.renderBlogs(); // re-render (เช่น จาก filter/pagination)
    assert.equal(cardCheckbox("b-1").checked, true);
    assert.equal(cardCheckbox("b-2").checked, false);
  });
});

describe("bSearch / bFilterStatus", () => {
  test("ค้นหาชื่อ (case-insensitive, trim) → กรองได้ถูกต้อง", () => {
    field("ad-b-search").value = "  วัสดุ  ";
    field("ad-b-search").dispatchEvent(new Event("input", { bubbles: true }));
    const cs = cards();
    assert.equal(cs.length, 1);
    assert.equal(cs[0].dataset.id, "b-2");
  });

  test("กรองสถานะ → เหลือเฉพาะที่ตรง", () => {
    field("ad-b-filter-status").value = "draft";
    field("ad-b-filter-status").dispatchEvent(new Event("change", { bubbles: true }));
    const cs = cards();
    assert.equal(cs.length, 1);
    assert.equal(cs[0].dataset.id, "b-2");
  });

  test("ค้นหา/กรองสถานะ → รีเซ็ตหน้าเป็น 1 ก่อน render ใหม่เสมอ", () => {
    const many = Array.from({ length: 14 }, (_, i) => ({ id: `m-${i}`, title: `บทความ ${i}`, status: "published" }));
    setAllBlogs(many);
    mod.renderBlogs();
    pagBtns().querySelector('[data-page="2"]').click();
    assert.match(pagInfo().textContent, /13–14/);

    field("ad-b-search").value = "บทความ";
    field("ad-b-search").dispatchEvent(new Event("input", { bubbles: true }));
    assert.match(pagInfo().textContent, /1–12/);
  });
});

describe("renderBlogsPagination()", () => {
  test("มีรายการ (แม้ ≤ 12 = 1 หน้าพอดี) → กล่อง pagination ยังแสดงอยู่", () => {
    mod.renderBlogs(); // 2 รายการ
    assert.equal(pagBox().style.display, "flex");
    assert.equal(pagInfo().textContent, "แสดง 1–2 จาก 2 รายการ");
  });

  test("14 รายการ (page size 12) → ข้อความช่วงถูกต้อง, ปุ่มหน้าครบ 2 หน้า, ปุ่ม disabled ตรงขอบเขต", () => {
    const many = Array.from({ length: 14 }, (_, i) => ({ id: `m-${i}`, title: `บทความ ${i}`, status: "published" }));
    setAllBlogs(many);
    mod.renderBlogs();
    assert.equal(pagBox().style.display, "flex");
    assert.equal(pagInfo().textContent, "แสดง 1–12 จาก 14 รายการ");
    assert.equal(cards().length, 12);
    const btns = Array.from(pagBtns().querySelectorAll(".cp-page-btn"));
    assert.equal(btns.length, 4); // prev, 1, 2, next
    assert.equal(btns[0].disabled, true);
    assert.equal(btns[3].disabled, false);
  });

  test("คลิกเลขหน้า/next/prev → เปลี่ยนหน้าจริง, ปุ่ม disabled สลับถูกต้อง", () => {
    const many = Array.from({ length: 14 }, (_, i) => ({ id: `m-${i}`, title: `บทความ ${i}`, status: "published" }));
    setAllBlogs(many);
    mod.renderBlogs();
    pagBtns().querySelector('[data-page="2"]').click();
    assert.equal(pagInfo().textContent, "แสดง 13–14 จาก 14 รายการ");
    assert.equal(cards().length, 2);
    const btnsPage2 = Array.from(pagBtns().querySelectorAll(".cp-page-btn"));
    assert.equal(btnsPage2[3].disabled, true);

    pagBtns().querySelector('[data-page="prev"]').click();
    assert.equal(pagInfo().textContent, "แสดง 1–12 จาก 14 รายการ");
  });

  test("ปุ่มที่ disabled ไม่ทำอะไรถ้าคลิก (prev ตอนอยู่หน้าแรก)", () => {
    const many = Array.from({ length: 14 }, (_, i) => ({ id: `m-${i}`, title: `บทความ ${i}`, status: "published" }));
    setAllBlogs(many);
    mod.renderBlogs();
    pagBtns().querySelector('[data-page="prev"]').click();
    assert.equal(pagInfo().textContent, "แสดง 1–12 จาก 14 รายการ");
  });
});

describe("bGrid — event delegation ปุ่มแก้ไข/ทำซ้ำ/ลบ", () => {
  beforeEach(() => { mod.renderBlogs(); });

  test("คลิกที่การ์ดแต่ไม่ใช่ปุ่ม data-action → ไม่ทำอะไร", () => {
    cards()[0].click();
    assert.equal(overlay().style.display, "none");
  });

  test("คลิกปุ่มแก้ไข → เปิดโมดัลโหมดแก้ไขพร้อมข้อมูลเดิม (openBlogModal จริงจาก admin-blog-form.js)", () => {
    cards()[0].querySelector('[data-action="edit"]').dispatchEvent(new Event("click", { bubbles: true }));
    assert.equal(overlay().style.display, "flex");
    assert.equal(field("ad-b-id").value, "b-1");
    assert.equal(field("ad-b-title").value, "มาตรฐานป้ายความปลอดภัย มอก.");
  });

  test("คลิกปุ่มทำซ้ำ → เปิดโมดัลโหมดเพิ่มพร้อมข้อมูลเดิม แต่ id ว่าง", () => {
    cards()[0].querySelector('[data-action="clone"]').dispatchEvent(new Event("click", { bubbles: true }));
    assert.equal(overlay().style.display, "flex");
    assert.equal(field("ad-b-id").value, "");
    assert.equal(field("ad-b-title").value, "มาตรฐานป้ายความปลอดภัย มอก.");
  });

  test("คลิกลบ → เปิด confirmDialog ข้อความมีชื่อบทความอยู่ในนั้น", async () => {
    cards()[0].querySelector('[data-action="delete"]').dispatchEvent(new Event("click", { bubbles: true }));
    await flushMicrotasks();
    const co = document.querySelector(".cp-confirm-overlay");
    assert.equal(co.style.display, "flex");
    assert.match(co.querySelector("#cp-confirm-msg").textContent, /ลบบทความ "มาตรฐานป้ายความปลอดภัย มอก\." ใช่หรือไม่/);
  });

  test("กด 'ยกเลิก' บน confirm → ไม่ลบ, การ์ดยังอยู่ครบ", async () => {
    cards()[0].querySelector('[data-action="delete"]').dispatchEvent(new Event("click", { bubbles: true }));
    await flushMicrotasks();
    document.querySelector("#cp-confirm-cancel").click();
    await flushMicrotasks();
    assert.equal((globalThis.__DELETE_DOC_CALLS__ || []).length, 0);
    assert.equal(cards().length, 2);
  });

  test("ยืนยันลบ แล้วกด 'เลิกทำ' ทันที → ไม่ลบจริง, การ์ดกลับมาแสดงเหมือนเดิม", async () => {
    cards()[0].querySelector('[data-action="delete"]').dispatchEvent(new Event("click", { bubbles: true }));
    await flushMicrotasks();
    document.querySelector("#cp-confirm-ok").click();
    await flushMicrotasks();
    assert.equal(cards().length, 1); // b-1 หายไปชั่วคราว
    const undoBtn = document.querySelector(".cp-toast-undo-btn");
    assert.ok(undoBtn, "ต้องมี toast เลิกทำโผล่ขึ้นมา");
    undoBtn.click();
    await flushMicrotasks();
    assert.equal((globalThis.__DELETE_DOC_CALLS__ || []).length, 0);
    assert.equal(cards().length, 2, "กด 'เลิกทำ' แล้วการ์ดต้องกลับมาครบ");
  });

  test("ยืนยันลบ แล้วปล่อยผ่านจนหมดเวลา (5000ms) → deleteBlog() ถูกเรียกจริง + onCommitted = reloadAll()", async (t) => {
    const flushReal = () => new Promise((r) => setImmediate(r));
    t.mock.timers.enable({ apis: ["setTimeout"] });
    cards()[0].querySelector('[data-action="delete"]').dispatchEvent(new Event("click", { bubbles: true }));
    await flushReal();
    document.querySelector("#cp-confirm-ok").click();
    await flushReal();
    t.mock.timers.tick(5000);
    await flushReal();
    await flushReal();
    assert.equal(globalThis.__DELETE_DOC_CALLS__.length, 1);
    assert.equal(globalThis.__DELETE_DOC_CALLS__[0].path, "blogs/b-1");
    assert.equal(globalThis.__AD_PAGE_STUB_RELOAD_ALL_CALLS__.length, 1);
    t.mock.timers.reset();
  });
});

describe("bulk actions — checkbox เลือกการ์ด (ad-card-check)", () => {
  beforeEach(() => { mod.renderBlogs(); });

  test("ติ๊กเลือกการ์ดเดียว: bulk bar ได้ class active, count เป็น 1", () => {
    selectCards(["b-1"]);
    assert.equal(bulkBar().classList.contains("active"), true);
    assert.equal(bulkCount().textContent, "1");
  });

  test("ติ๊กแล้วเอาติ๊กออก: count กลับเป็น 0, bulk bar หมด active", () => {
    const cb = cardCheckbox("b-2");
    cb.checked = true;
    cb.dispatchEvent(new Event("change", { bubbles: true }));
    assert.equal(bulkCount().textContent, "1");
    cb.checked = false;
    cb.dispatchEvent(new Event("change", { bubbles: true }));
    assert.equal(bulkCount().textContent, "0");
    assert.equal(bulkBar().classList.contains("active"), false);
  });

  test("ติ๊กหลายการ์ด: count นับรวมถูกต้อง", () => {
    selectCards(["b-1", "b-2"]);
    assert.equal(bulkCount().textContent, "2");
  });
});

describe("bulk actions — ปุ่ม 'ล้างการเลือก' (ad-b-bulk-clear)", () => {
  test("เลือกไว้แล้วกดล้าง: selection ว่างทั้งหมด, checkbox ทุกการ์ดเอาติ๊กออก, bulk bar หมด active", () => {
    mod.renderBlogs();
    selectCards(["b-1", "b-2"]);
    assert.equal(bulkCount().textContent, "2");

    document.getElementById("ad-b-bulk-clear").click();

    assert.equal(bulkCount().textContent, "0");
    assert.equal(bulkBar().classList.contains("active"), false);
    assert.equal(cardCheckbox("b-1").checked, false);
    assert.equal(cardCheckbox("b-2").checked, false);
  });
});

describe("bulk actions — ปุ่ม 'เปลี่ยนสถานะ' (ad-b-bulk-apply-status)", () => {
  beforeEach(() => { mod.renderBlogs(); });

  test("ไม่ได้เลือกสถานะเลย (select ว่าง) → ไม่ทำอะไร (early return)", async () => {
    selectCards(["b-1"]);
    field("ad-b-bulk-status-select").value = "";
    document.getElementById("ad-b-bulk-apply-status").click();
    await flushMicrotasks();
    assert.equal((globalThis.__UPDATE_DOC_CALLS__ || []).length, 0);
  });

  test("ไม่มีการ์ดถูกเลือกเลย → ไม่ทำอะไร แม้เลือกสถานะไว้แล้ว (early return)", async () => {
    field("ad-b-bulk-status-select").value = "draft";
    document.getElementById("ad-b-bulk-apply-status").click();
    await flushMicrotasks();
    assert.equal((globalThis.__UPDATE_DOC_CALLS__ || []).length, 0);
  });

  test("เลือก 2 การ์ดแล้วเปลี่ยนสถานะ → saveBlog() (updateDoc) ถูกเรียกครบทุกรายการด้วย status ใหม่, เคลียร์ selection, reset select, toast สำเร็จ, reloadAll()", async () => {
    selectCards(["b-1", "b-2"]);
    field("ad-b-bulk-status-select").value = "draft";
    const btn = document.getElementById("ad-b-bulk-apply-status");
    btn.click();
    await flushMicrotasks();
    await flushMicrotasks();

    assert.equal(globalThis.__UPDATE_DOC_CALLS__.length, 2);
    const paths = globalThis.__UPDATE_DOC_CALLS__.map(c => c.path).sort();
    assert.deepEqual(paths, ["blogs/b-1", "blogs/b-2"]);
    globalThis.__UPDATE_DOC_CALLS__.forEach(c => assert.equal(c.payload.status, "draft"));
    // ฟิลด์อื่นของบทความเดิมต้องยังติดไปด้วย (saveBlog ทำ { ...post, id, status })
    const b1Call = globalThis.__UPDATE_DOC_CALLS__.find(c => c.path === "blogs/b-1");
    assert.equal(b1Call.payload.title, "มาตรฐานป้ายความปลอดภัย มอก.");

    assert.equal(bulkCount().textContent, "0");
    assert.equal(field("ad-b-bulk-status-select").value, "");
    assert.equal(btn.disabled, false);
    const toastEls = document.querySelectorAll(".cp-toast-wrap .cp-toast.success");
    assert.equal(toastEls.length >= 1, true);
    assert.equal(toastEls[toastEls.length - 1].textContent, "เปลี่ยนสถานะแล้ว 2 รายการ");
    assert.equal(globalThis.__AD_PAGE_STUB_RELOAD_ALL_CALLS__.length, 1);
  });

  test("ปุ่มถูก disable ระหว่างทำงาน", async () => {
    selectCards(["b-1"]);
    field("ad-b-bulk-status-select").value = "draft";
    const btn = document.getElementById("ad-b-bulk-apply-status");
    btn.click();
    assert.equal(btn.disabled, true);
    await flushMicrotasks();
    await flushMicrotasks();
    assert.equal(btn.disabled, false);
  });
});

describe("bulk actions — ปุ่ม 'ลบที่เลือก' (ad-b-bulk-delete)", () => {
  beforeEach(() => { mod.renderBlogs(); });

  test("ไม่มีการ์ดไหนถูกเลือกเลย: กดแล้วไม่เปิด confirmDialog เลย (early return)", () => {
    document.getElementById("ad-b-bulk-delete").click();
    const co = document.querySelector(".cp-confirm-overlay");
    if (co) assert.notEqual(co.style.display, "flex");
    assert.deepEqual(globalThis.__DELETE_DOC_CALLS__, []);
  });

  test("เลือก 2 การ์ดแล้วกดลบ, กด 'ยกเลิก' บน confirm → ไม่เรียก deleteBlog() เลย, selection คงอยู่", async () => {
    selectCards(["b-1", "b-2"]);
    document.getElementById("ad-b-bulk-delete").click();
    await flushMicrotasks();
    const co = document.querySelector(".cp-confirm-overlay");
    assert.equal(co.style.display, "flex");
    assert.match(co.querySelector("#cp-confirm-msg").textContent, /ลบบทความที่เลือก 2 รายการ/);
    co.querySelector("#cp-confirm-cancel").click();
    await flushMicrotasks();

    assert.deepEqual(globalThis.__DELETE_DOC_CALLS__, []);
    assert.equal(bulkCount().textContent, "2");
  });

  test("เลือก 2 การ์ดแล้วกดลบ, กด 'ยืนยัน': เรียก deleteBlog() ครบทั้ง 2 รายการทันที (ไม่มี undo), เคลียร์ selection, ปุ่มกลับมา enabled, toast สำเร็จ, reloadAll()", async () => {
    selectCards(["b-1", "b-2"]);
    const btn = document.getElementById("ad-b-bulk-delete");
    btn.click();
    await flushMicrotasks();
    document.querySelector(".cp-confirm-overlay #cp-confirm-ok").click();
    await flushMicrotasks();
    await flushMicrotasks();

    assert.equal(globalThis.__DELETE_DOC_CALLS__.length, 2);
    const paths = globalThis.__DELETE_DOC_CALLS__.map(c => c.path).sort();
    assert.deepEqual(paths, ["blogs/b-1", "blogs/b-2"]);
    assert.equal(bulkCount().textContent, "0");
    assert.equal(btn.disabled, false);
    // ไม่มี undo toast สำหรับ bulk delete (ต่างจากลบรายแถวเดียวที่ผ่าน deleteWithUndo)
    assert.equal(document.querySelector(".cp-toast-undo-btn"), null);
    const toastEls = document.querySelectorAll(".cp-toast-wrap .cp-toast.success");
    assert.equal(toastEls.length >= 1, true);
    assert.equal(toastEls[toastEls.length - 1].textContent, "ลบแล้ว 2 รายการ");
    assert.equal(globalThis.__AD_PAGE_STUB_RELOAD_ALL_CALLS__.length, 1);
  });
});

describe("bAddBtn", () => {
  test("คลิกเพิ่มบทความ → เปิดโมดัลโหมดเพิ่ม (openBlogModal(null))", () => {
    field("ad-b-add-btn").click();
    assert.equal(overlay().style.display, "flex");
    assert.equal(field("ad-b-id").value, "");
    assert.equal(field("ad-b-title").value, "");
  });
});
