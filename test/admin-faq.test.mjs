// test/admin-faq.test.mjs — รอบที่ 110
//
// ขอบเขต: js/admin-faq.js (139 บรรทัด) — แท็บ FAQ (คำถามที่พบบ่อย) — ไฟล์ที่ง่ายที่สุดในกลุ่ม
// admin-* ที่เหลือ (ไม่มี icon/description/group เหมือน categories, ไม่มีช่องค้นหา, ไม่มี upload
// รูป, ไม่มี clone modal) — renderFaqs() (empty-state 2 แบบ — allFaqs ว่างเปล่าทั้งหมด vs
// filteredRows ว่างเปล่าทั้งที่ allFaqs มีของอยู่ ซึ่งเกิดได้ทางเดียวคือทุกแถวอยู่ใน
// pendingDeleteFaqIds หมด เพราะไฟล์นี้ไม่มีช่องค้นหาเลย), renderFaqPagination(), event
// delegation ปุ่มแก้ไข/ลบในตาราง (confirmDialog → deleteWithUndo → deleteFaq()),
// openFaqModal()/closeFaqModal() (ใช้ openOverlay()/closeOverlay() จาก admin-utils.js ต่างจาก
// admin-categories.js/admin-groups.js ที่ set el.style.display ตรงๆ), submit handler
// (saveFaq() → reloadAll())
//
// ไฟล์นี้ import { reloadAll } from "./admin-page.js" ตรงๆ ที่ระดับบนสุด — เหมือนไฟล์ก่อนหน้า
// จึงใช้ test/helpers/admin-page-stub-loader.mjs ซ้ำได้ (ขยาย ALLOWED_PARENT_RE รอบนี้ให้
// ครอบคลุม "faq" ด้วยแล้ว)
//
// **fCurrentPage เป็น private `let` ไม่มี export/setter เลย** (ต่างจาก cCurrentPage ใน
// admin-categories.js ที่มี setCCurrentPage() export ไว้) — ไม่มีทางรีเซ็ตค่าตรงๆ จากเทสได้
// แต่ไม่ใช่ปัญหา เพราะ renderFaqPagination(totalRows) clamp ค่ากลับเป็น 1 อัตโนมัติทุกครั้งที่
// totalPages คำนวณได้ 1 หน้า (`if (fCurrentPage > totalPages) fCurrentPage = totalPages;`) —
// beforeEach() เลยเรียก renderFaqs() ด้วย allFaqs ว่างเปล่าก่อน (บังคับ totalPages=1 → clamp
// fCurrentPage กลับมา 1) ก่อนตั้งค่าข้อมูลตัวอย่างจริงทุกครั้ง กันไม่ให้หน้าเพจที่ค้างจากเทส
// pagination รอบก่อนรั่วข้ามเทส — วิธีนี้ใช้ผ่าน public API (renderFaqs()) ล้วนๆ ไม่ต้องแก้โค้ด
// ผลิตภัณฑ์เพิ่ม setter ให้
//
// ตรวจโค้ดจริงทั้งไฟล์ js/admin-faq.js + saveFaq()/deleteFaq() ใน js/db-content.js ก่อนเขียนเทสนี้
// (อ่านครบ) — ไม่พบบั๊ก จึงเป็นไฟล์เทสล้วนๆ ไม่มีการแก้โค้ดผลิตภัณฑ์เลยแม้แต่บรรทัดเดียว (นอกจาก
// test/helpers/admin-page-stub-loader.mjs ที่เป็นโครงสร้างพื้นฐานของเทส ไม่ใช่โค้ดผลิตภัณฑ์)
//
// **ไม่มีเทส "saveFaq() reject"** ด้วยเหตุผลเดียวกับที่บันทึกไว้ในไฟล์เทสรอบก่อนๆ:
// firebase-stub-loader.mjs ที่ใช้ร่วมกับทุกไฟล์เทสไม่มีช่องทางสั่งให้ addDoc()/updateDoc() throw
// ได้เลย (resolve สำเร็จเสมอตามดีไซน์ปัจจุบัน)

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
let mod;
let setAllFaqs;
let pendingDeleteFaqIds;

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

const SAMPLE_FAQS = [
  { id: "f-1", question: "ป้ายไฟทำจากวัสดุอะไร", answer: "อะคริลิคหรือสแตนเลสตามแบบที่เลือก" },
  { id: "f-2", question: "ใช้เวลาผลิตกี่วัน", answer: "ประมาณ 7–14 วันทำการ" },
];

function overlay() { return document.getElementById("ad-f-overlay"); }
function field(id) { return document.getElementById(id); }
function rows() { return Array.from(document.getElementById("ad-f-table-body").querySelectorAll("tr[data-id]")); }
function pagBox() { return document.getElementById("ad-f-pagination"); }
function pagInfo() { return document.getElementById("ad-f-pagination-info"); }
function pagBtns() { return document.getElementById("ad-f-pagination-btns"); }

before(async () => {
  const dom = new JSDOM(`<!doctype html><html><body>${ADMIN_BODY_NO_SCRIPTS}</body></html>`);
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
  globalThis.Event = dom.window.Event;
  document = dom.window.document;

  mod = await import("../js/admin-faq.js");
  ({ setAllFaqs, pendingDeleteFaqIds } = await import("../js/admin-state.js"));
});

beforeEach(() => {
  resetFirebaseCalls();
  resetSpies();
  pendingDeleteFaqIds.clear();
  // บังคับ clamp fCurrentPage กลับเป็น 1 ก่อน (ดูคอมเมนต์หัวไฟล์ — ไม่มี setter ตรงๆ)
  setAllFaqs([]);
  mod.renderFaqs();
  setAllFaqs(SAMPLE_FAQS.map(f => ({ ...f })));
  const confirmOverlay = document.querySelector(".cp-confirm-overlay");
  if (confirmOverlay && confirmOverlay.style.display === "flex") {
    confirmOverlay.querySelector("#cp-confirm-cancel").click();
  }
  if (overlay().style.display === "flex") overlay().style.display = "none";
  document.querySelectorAll(".cp-toast-wrap .cp-toast").forEach(el => el.remove());
});

describe("renderFaqs() — empty states", () => {
  test("allFaqs ว่างเปล่าทั้งหมด → ข้อความ 'ยังไม่มีคำถามที่พบบ่อย', ไม่มีแถว, ไม่มี pagination", () => {
    setAllFaqs([]);
    mod.renderFaqs();
    assert.match(document.getElementById("ad-f-table-body").innerHTML, /ยังไม่มีคำถามที่พบบ่อย/);
    assert.equal(rows().length, 0);
    assert.equal(pagBox().style.display, "none");
  });

  test("มี FAQ อยู่แต่ทุกแถวถูก mark pending-delete หมด → ข้อความ 'ไม่พบคำถามที่พบบ่อย' (คนละข้อความกับตอนว่างเปล่าทั้งหมด)", () => {
    pendingDeleteFaqIds.add("f-1");
    pendingDeleteFaqIds.add("f-2");
    mod.renderFaqs();
    assert.match(document.getElementById("ad-f-table-body").innerHTML, /ไม่พบคำถามที่พบบ่อย/);
    assert.doesNotMatch(document.getElementById("ad-f-table-body").innerHTML, /ยังไม่มีคำถามที่พบบ่อย/);
    assert.equal(rows().length, 0);
    assert.equal(pagBox().style.display, "none");
  });
});

describe("renderFaqs() — render ปกติ", () => {
  test("แสดงครบทุกแถว คำถาม/คำตอบถูกต้อง", () => {
    mod.renderFaqs();
    const rs = rows();
    assert.equal(rs.length, 2);
    assert.match(rs[0].innerHTML, /ป้ายไฟทำจากวัสดุอะไร/);
    assert.match(rs[0].innerHTML, /อะคริลิคหรือสแตนเลสตามแบบที่เลือก/);
    assert.match(rs[1].innerHTML, /ใช้เวลาผลิตกี่วัน/);
  });

  test("กรองหมวดที่อยู่ใน pendingDeleteFaqIds ออกจากตาราง (เหลือแถวเดียว)", () => {
    pendingDeleteFaqIds.add("f-1");
    mod.renderFaqs();
    const rs = rows();
    assert.equal(rs.length, 1);
    assert.equal(rs[0].dataset.id, "f-2");
  });

  test("escape คำถาม/คำตอบที่มีอักขระ HTML พิเศษ กัน XSS", () => {
    setAllFaqs([{ id: "f-x", question: "<img src=x onerror=alert(1)>", answer: "<b>bold</b>" }]);
    mod.renderFaqs();
    const html = document.getElementById("ad-f-table-body").innerHTML;
    assert.doesNotMatch(html, /<img src=x onerror/);
    assert.doesNotMatch(html, /<b>bold<\/b>/);
    assert.match(html, /&lt;img/);
    assert.match(html, /&lt;b&gt;/);
  });

  test("question/answer เป็นค่าว่าง/undefined → ไม่พัง render เป็นสตริงว่าง", () => {
    setAllFaqs([{ id: "f-y" }]);
    assert.doesNotThrow(() => mod.renderFaqs());
    assert.equal(rows().length, 1);
  });
});

describe("renderFaqPagination()", () => {
  test("มีอย่างน้อย 1 รายการ (แม้ ≤ 10 = 1 หน้าพอดี) → กล่อง pagination ยังแสดงอยู่ (totalRows=0 เท่านั้นที่ซ่อน)", () => {
    mod.renderFaqs(); // มีแค่ 2 รายการ
    assert.equal(pagBox().style.display, "flex");
    assert.equal(pagInfo().textContent, "แสดง 1–2 จาก 2 รายการ");
  });

  test("รายการ 12 ชิ้น (page size 10) → ข้อความช่วงถูกต้อง, ปุ่มหน้าครบ 2 หน้า, ปุ่ม disabled ตรงขอบเขต", () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ id: `f-${i}`, question: `คำถาม ${i}`, answer: `คำตอบ ${i}` }));
    setAllFaqs(many);
    mod.renderFaqs();
    assert.equal(pagBox().style.display, "flex");
    assert.equal(pagInfo().textContent, "แสดง 1–10 จาก 12 รายการ");
    assert.equal(rows().length, 10);
    const pageBtns = Array.from(pagBtns().querySelectorAll(".cp-page-btn"));
    assert.equal(pageBtns.length, 4); // prev, 1, 2, next
    assert.equal(pageBtns[0].disabled, true);
    assert.equal(pageBtns[3].disabled, false);
  });

  test("คลิกเลขหน้า/next/prev → เปลี่ยนหน้าจริง, render แถวของหน้านั้น, ปุ่ม disabled สลับถูกต้อง", () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ id: `f-${i}`, question: `คำถาม ${i}`, answer: `คำตอบ ${i}` }));
    setAllFaqs(many);
    mod.renderFaqs();
    pagBtns().querySelector('[data-page="2"]').click();
    assert.equal(pagInfo().textContent, "แสดง 11–12 จาก 12 รายการ");
    assert.equal(rows().length, 2);
    assert.equal(rows()[0].dataset.id, "f-10");
    const btnsPage2 = Array.from(pagBtns().querySelectorAll(".cp-page-btn"));
    assert.equal(btnsPage2[3].disabled, true, "ปุ่มถัดไปต้อง disabled ที่หน้าสุดท้าย");

    pagBtns().querySelector('[data-page="prev"]').click();
    assert.equal(pagInfo().textContent, "แสดง 1–10 จาก 12 รายการ");
  });

  test("ปุ่มที่ disabled ไม่ทำอะไรถ้าคลิก (prev ตอนอยู่หน้าแรก)", () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ id: `f-${i}`, question: `คำถาม ${i}`, answer: `คำตอบ ${i}` }));
    setAllFaqs(many);
    mod.renderFaqs();
    pagBtns().querySelector('[data-page="prev"]').click();
    assert.equal(pagInfo().textContent, "แสดง 1–10 จาก 12 รายการ");
  });
});

describe("fAddBtn / openFaqModal() / closeFaqModal()", () => {
  test("คลิกเพิ่ม → เปิดโมดัลโหมดเพิ่ม (หัวข้อ+ฟิลด์ว่างหมด)", () => {
    field("ad-f-add-btn").click();
    assert.equal(overlay().style.display, "flex");
    assert.equal(field("ad-f-modal-title").textContent, "เพิ่มคำถาม");
    assert.equal(field("ad-f-id").value, "");
    assert.equal(field("ad-f-question").value, "");
    assert.equal(field("ad-f-answer").value, "");
  });

  test("คลิกแก้ไขจากตาราง → เติมค่าเดิมครบทุกฟิลด์", () => {
    mod.renderFaqs();
    rows()[0].querySelector('[data-action="edit"]').dispatchEvent(new Event("click", { bubbles: true }));
    assert.equal(overlay().style.display, "flex");
    assert.equal(field("ad-f-modal-title").textContent, "แก้ไขคำถาม");
    assert.equal(field("ad-f-id").value, "f-1");
    assert.equal(field("ad-f-question").value, "ป้ายไฟทำจากวัสดุอะไร");
    assert.equal(field("ad-f-answer").value, "อะคริลิคหรือสแตนเลสตามแบบที่เลือก");
  });

  test("ปุ่ม 'ยกเลิก' → ปิดโมดัล + reset ฟอร์ม", () => {
    field("ad-f-add-btn").click();
    field("ad-f-question").value = "ทดลองพิมพ์";
    field("ad-f-cancel").click();
    assert.equal(overlay().style.display, "none");
    assert.equal(field("ad-f-question").value, "");
  });

  test("คลิก backdrop (target === overlay เอง) → ปิดโมดัล", () => {
    field("ad-f-add-btn").click();
    overlay().dispatchEvent(new Event("click", { bubbles: true, cancelable: true }));
    assert.equal(overlay().style.display, "none");
  });

  test("คลิกข้างในกล่องโมดัล (target ไม่ใช่ overlay เอง) → ไม่ปิด", () => {
    field("ad-f-add-btn").click();
    field("ad-f-question").dispatchEvent(new Event("click", { bubbles: true, cancelable: true }));
    assert.equal(overlay().style.display, "flex");
  });
});

describe("fTableBody — event delegation ปุ่มแก้ไข/ลบ", () => {
  beforeEach(() => { mod.renderFaqs(); });

  test("คลิกที่ไม่ใช่ปุ่ม data-action → ไม่ทำอะไร", () => {
    rows()[0].click();
    assert.equal(overlay().style.display, "none");
  });

  test("คลิกลบ → เปิด confirmDialog ข้อความมีชื่อคำถามอยู่ในนั้น", async () => {
    rows()[0].querySelector('[data-action="delete"]').dispatchEvent(new Event("click", { bubbles: true }));
    await flushMicrotasks();
    const co = document.querySelector(".cp-confirm-overlay");
    assert.equal(co.style.display, "flex");
    assert.match(co.querySelector("#cp-confirm-msg").textContent, /ลบคำถาม "ป้ายไฟทำจากวัสดุอะไร" ใช่หรือไม่/);
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
    assert.equal(rows().length, 1); // f-1 หายไปชั่วคราว
    const undoBtn = document.querySelector(".cp-toast-undo-btn");
    assert.ok(undoBtn, "ต้องมี toast เลิกทำโผล่ขึ้นมา");
    undoBtn.click();
    await flushMicrotasks();
    assert.equal((globalThis.__DELETE_DOC_CALLS__ || []).length, 0);
    assert.equal(rows().length, 2, "กด 'เลิกทำ' แล้วรายการต้องกลับมาครบ");
  });

  test("ยืนยันลบ แล้วปล่อยผ่านจนหมดเวลา (5000ms) → deleteFaq() ถูกเรียกจริง + onCommitted = reloadAll()", async (t) => {
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
    assert.equal(globalThis.__DELETE_DOC_CALLS__[0].path, "faqs/f-1");
    assert.equal(globalThis.__AD_PAGE_STUB_RELOAD_ALL_CALLS__.length, 1);
    t.mock.timers.reset();
  });
});

describe("submit ฟอร์ม", () => {
  test("โหมดเพิ่มใหม่ → saveFaq() (addDoc) ถูกเรียกด้วย payload trim แล้ว, ไม่มี id, ปิด modal, reloadAll()", async () => {
    field("ad-f-add-btn").click();
    field("ad-f-question").value = "  คำถามใหม่  ";
    field("ad-f-answer").value = "  คำตอบใหม่  ";

    field("ad-f-form").dispatchEvent(new Event("submit", { cancelable: true }));
    await flushMicrotasks();
    await flushMicrotasks();

    assert.equal(globalThis.__ADD_DOC_CALLS__.length, 1);
    const { path, payload } = globalThis.__ADD_DOC_CALLS__[0];
    assert.equal(path, "faqs");
    assert.equal(payload.question, "คำถามใหม่");
    assert.equal(payload.answer, "คำตอบใหม่");
    assert.equal(payload.id, undefined);
    assert.ok(typeof payload.createdAt === "number", "ต้องมี createdAt ตอนเพิ่มใหม่");

    assert.equal(overlay().style.display, "none");
    assert.equal(globalThis.__AD_PAGE_STUB_RELOAD_ALL_CALLS__.length, 1);
  });

  test("โหมดแก้ไข (มี id) → updateDoc ถูกเรียกที่ faqs/<id>, ไม่มี field id ปนใน payload จริง", async () => {
    mod.renderFaqs();
    rows()[0].querySelector('[data-action="edit"]').dispatchEvent(new Event("click", { bubbles: true }));
    field("ad-f-question").value = "ป้ายไฟทำจากวัสดุอะไร (แก้ไข)";

    field("ad-f-form").dispatchEvent(new Event("submit", { cancelable: true }));
    await flushMicrotasks();
    await flushMicrotasks();

    assert.equal(globalThis.__UPDATE_DOC_CALLS__.length, 1);
    const { path, payload } = globalThis.__UPDATE_DOC_CALLS__[0];
    assert.equal(path, "faqs/f-1");
    assert.equal(payload.question, "ป้ายไฟทำจากวัสดุอะไร (แก้ไข)");
    assert.equal(payload.answer, "อะคริลิคหรือสแตนเลสตามแบบที่เลือก");
    assert.equal(payload.id, undefined);
  });

  test("ปุ่ม submit disable + เปลี่ยนข้อความระหว่างบันทึก แล้วกลับปกติ", async () => {
    field("ad-f-add-btn").click();
    field("ad-f-question").value = "คำถามใหม่";
    field("ad-f-answer").value = "คำตอบใหม่";
    const btn = field("ad-f-form").querySelector('button[type=submit]');
    assert.equal(btn.disabled, false);
    field("ad-f-form").dispatchEvent(new Event("submit", { cancelable: true }));
    assert.equal(btn.disabled, true);
    assert.equal(btn.textContent, "กำลังบันทึก...");
    await flushMicrotasks();
    await flushMicrotasks();
    assert.equal(btn.disabled, false);
    assert.equal(btn.textContent, "บันทึก");
  });
});

function flushMicrotasks() {
  return new Promise((r) => setTimeout(r, 0));
}
