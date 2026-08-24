// test/admin-portfolio.test.mjs — รอบที่ 115
//
// ขอบเขต: js/admin-portfolio.js (300 บรรทัด) — ไฟล์กริดหลักของแท็บผลงาน คู่กับ
// js/admin-portfolio-form.js (เทสแยกไว้แล้วรอบ 106) — renderPortfolios() (private, ทดสอบผ่าน
// public API เท่านั้น), renderPortfolioPagination(), pfSearch/pfFilterCat event listeners,
// pfGrid event delegation (ปุ่มแก้ไข/ทำซ้ำ/ลบ + deleteWithUndo, คลิกการ์ดเปิด popup ดูรายละเอียด),
// **movePinnedItem() (ปุ่มเลื่อนขึ้น/ลงของผลงานที่ปักหมุด) ที่ยังไม่เคยมีแพทเทิร์นเทสไฟล์ไหนใน
// กลุ่ม admin-* คลุมมาก่อนเลย**, bulk actions (เลือกหลายการ์ด + ลบทีเดียว — ไม่มี bulk
// apply-status เหมือน admin-blog.js รอบ 114 เพราะผลงานไม่มีสถานะ), popup ดูรายละเอียดผลงาน
// (ad-pf-view-overlay — รูปทั้งหมด + thumbnails + ปุ่มแก้ไข), pfAddBtn
//
// ไฟล์นี้ import { reloadAll } from "./admin-page.js" ตรงๆ ที่ระดับบนสุด — ใช้
// test/helpers/admin-page-stub-loader.mjs ซ้ำได้ แค่ขยาย ALLOWED_PARENT_RE เพิ่ม "portfolio"
// (คนละตัวกับ "portfolio-form" ที่มีอยู่แล้วตั้งแต่รอบ 106 — คนละไฟล์กัน ไม่ชนกัน)
//
// แพทเทิร์น bulk delete อ้างอิงจาก test/admin-blog.test.mjs (รอบ 114) — เหมือนกันทุกจุด (ไม่มี
// undo toast, confirmDialog ก่อนแล้วค่อย Promise.all(deleteFn)) ต่างแค่ไม่มีปุ่ม bulk
// apply-status เลย (ตรวจโค้ดจริงยืนยันแล้วว่า admin-portfolio.js มีแค่ปุ่ม "ลบที่เลือก" ปุ่มเดียว
// ในกลุ่ม bulk actions)
//
// **movePinnedItem() เป็นแพทเทิร์นใหม่ทั้งหมด**: กรองเฉพาะผลงานที่ pinned=true มาเรียงตาม
// order/createdAt ก่อน หาตำแหน่งของ item ที่กด แล้วสลับค่า order กับตัวข้างเคียง (ใช้ index
// ปัจจุบันเป็นค่า order ใหม่ของทั้งคู่ที่สลับกัน) → savePortfolio() (updateDoc) ทั้งสองตัวพร้อมกัน
// ผ่าน Promise.all() แล้วเรียก reloadAll() — ปุ่มเลื่อนขึ้น/ลงแสดงเฉพาะการ์ดที่ pinned=true
// เท่านั้น (เช็คจาก DOM ว่าการ์ดที่ไม่ pinned ไม่มีปุ่มนี้เลย)
//
// ตรวจโค้ดจริงทั้งไฟล์ js/admin-portfolio.js + savePortfolio()/deletePortfolio() ใน
// js/db-content.js ก่อนเขียนเทสนี้ (อ่านครบ) — ไม่พบบั๊ก จึงเป็นไฟล์เทสล้วนๆ ไม่มีการแก้โค้ด
// ผลิตภัณฑ์เลยแม้แต่บรรทัดเดียว (นอกจาก test/helpers/admin-page-stub-loader.mjs ที่เป็น
// โครงสร้างพื้นฐานของเทส ไม่ใช่โค้ดผลิตภัณฑ์ — ขยาย regex บรรทัดเดียว + คอมเมนต์)
//
// **ไม่มีเทส "savePortfolio()/deletePortfolio() reject"** ด้วยเหตุผลเดียวกับที่บันทึกไว้ในไฟล์
// เทสรอบก่อนๆ: firebase-stub-loader.mjs ที่ใช้ร่วมกับทุกไฟล์เทสไม่มีช่องทางสั่งให้ addDoc()/
// updateDoc()/deleteDoc() throw ได้เลย (resolve สำเร็จเสมอตามดีไซน์ปัจจุบัน) — จึงไม่มีเทส
// "จัดลำดับไม่สำเร็จ"/"ลบไม่สำเร็จ" ที่ผ่าน catch block ได้จริง
//
// **ไม่มีเทส "ปุ่มลบที่เลือก disable ระหว่างทำงาน"**: ต่างจาก admin-blog.js (bulk apply-status
// ที่ set disabled=true แบบซิงโครนัสทันทีตอนคลิกปุ่มเอง) ปุ่มลบที่เลือกของไฟล์นี้ set
// disabled=true "หลัง" confirmDialog() resolve (ซึ่งเป็น async เอง ผูกกับคลิกปุ่ม "ยืนยัน" บน
// confirm-overlay อีกที) ไม่มีจุดใดที่เรียก synchronous ทันทีหลังคลิกยืนยันที่จับ disabled=true
// ได้แน่นอน (deleteDoc() stub resolve เร็วมากจน Promise.all() มักจะ resolve ก่อนมี tick ให้เช็ค
// ทัน) — admin-blog.test.mjs รอบ 114 ก็ไม่มีเทสนี้สำหรับ bulk delete เหมือนกันด้วยเหตุผลเดียวกัน
// (มีแค่ฝั่ง bulk apply-status เท่านั้นที่เทสได้จริง)
//
// **ไม่คลุม openPortfolioModal()/openPortfolioModalClone()/ฟอร์มแบบละเอียด** (ทดสอบครบแล้วใน
// test/admin-portfolio-form.test.mjs รอบ 106) — ไฟล์นี้ทดสอบแค่ว่าปุ่มแก้ไข/ทำซ้ำ/เพิ่มผลงาน/
// ปุ่ม "แก้ไขผลงานนี้" ในป็อปอัพ เรียกฟังก์ชันเหล่านั้นถูกต้อง (เปิด overlay จริงเพราะ import
// เป็นโมดูลจริง ไม่ได้ stub)

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
let mod;             // admin-portfolio.js exports
let setAllPortfolios; // จาก admin-state.js
let pendingDeletePortfolioIds;

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

const SAMPLE_PORTFOLIOS = [
  { id: "p-1", title: "โรงงาน A", client: "บริษัท เอ จำกัด", category: "factory", images: ["https://res.cloudinary.com/x/a.jpg"], tags: ["ป้ายความปลอดภัย"], pinned: false, order: 0 },
  { id: "p-2", title: "นิคมอุตสาหกรรม B", client: "", category: "industrial", images: [], tags: [], pinned: false, order: 0 },
];

function overlay() { return document.getElementById("ad-pf-overlay"); }
function viewOverlay() { return document.getElementById("ad-pf-view-overlay"); }
function field(id) { return document.getElementById(id); }
function cards() { return Array.from(document.getElementById("ad-pf-grid").querySelectorAll(".ad-pf-card[data-id]")); }
function card(id) { return document.querySelector(`.ad-pf-card[data-id="${id}"]`); }
function cardCheckbox(id) { return document.querySelector(`.ad-pf-card-check[data-id="${id}"]`); }
function pagBox() { return document.getElementById("ad-pf-pagination"); }
function pagInfo() { return document.getElementById("ad-pf-pagination-info"); }
function pagBtns() { return document.getElementById("ad-pf-pagination-btns"); }
function bulkBar() { return document.getElementById("ad-pf-bulk-bar"); }
function bulkCount() { return document.getElementById("ad-pf-bulk-count"); }

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

  mod = await import("../js/admin-portfolio.js");
  ({ setAllPortfolios, pendingDeletePortfolioIds } = await import("../js/admin-state.js"));
});

beforeEach(() => {
  resetFirebaseCalls();
  resetSpies();
  pendingDeletePortfolioIds.clear();
  field("ad-pf-search").value = "";
  field("ad-pf-filter-cat").value = "";
  document.getElementById("ad-pf-bulk-clear").click(); // เคลียร์ selectedPortfolioIds ที่ไม่มี setter export
  setAllPortfolios(SAMPLE_PORTFOLIOS.map(p => ({ ...p })));
  const confirmOverlay = document.querySelector(".cp-confirm-overlay");
  if (confirmOverlay && confirmOverlay.style.display === "flex") {
    confirmOverlay.querySelector("#cp-confirm-cancel").click();
  }
  if (overlay().style.display === "flex") overlay().style.display = "none";
  if (viewOverlay().style.display === "flex") viewOverlay().style.display = "none";
  document.querySelectorAll(".cp-toast-wrap .cp-toast").forEach(el => el.remove());
});

describe("renderPortfolios() — empty states", () => {
  test("allPortfolios ว่างเปล่าทั้งหมด → empty-state ไม่มีตัวกรอง (มีปุ่ม CTA เพิ่มรายการแรก)", () => {
    setAllPortfolios([]);
    mod.renderPortfolios();
    assert.match(document.getElementById("ad-pf-grid").innerHTML, /ยังไม่มีผลงานในระบบ/);
    assert.equal(cards().length, 0);
    assert.equal(pagBox().style.display, "none");
    assert.ok(field("ad-pf-empty-add"));
  });

  test("มีตัวกรอง (ค้นหา) แล้วไม่เจอผลลัพธ์ → ข้อความคนละแบบ ไม่มีปุ่ม CTA", () => {
    field("ad-pf-search").value = "ไม่มีทางเจอ";
    mod.renderPortfolios();
    assert.match(document.getElementById("ad-pf-grid").innerHTML, /ไม่พบผลงานที่ตรงกับตัวกรอง/);
    assert.doesNotMatch(document.getElementById("ad-pf-grid").innerHTML, /ยังไม่มีผลงานในระบบ/);
    assert.equal(field("ad-pf-empty-add"), null);
  });

  test("มีตัวกรอง (ประเภทโครงการ) แล้วไม่เจอผลลัพธ์ → ข้อความแบบมีตัวกรองเช่นกัน", () => {
    field("ad-pf-filter-cat").value = "government";
    mod.renderPortfolios();
    assert.match(document.getElementById("ad-pf-grid").innerHTML, /ไม่พบผลงานที่ตรงกับตัวกรอง/);
  });

  test("empty-state ปุ่ม 'เพิ่มรายการแรก' → คลิกแล้วเปิดโมดัลโหมดเพิ่ม", () => {
    setAllPortfolios([]);
    mod.renderPortfolios();
    field("ad-pf-empty-add").click();
    assert.equal(overlay().style.display, "flex");
    assert.equal(field("ad-pf-id").value, "");
  });

  test("ทุกผลงานถูก mark pending-delete หมด → empty-state แบบมีตัวกรอง (filteredRows ว่างทั้งที่ allPortfolios มีของ)", () => {
    pendingDeletePortfolioIds.add("p-1");
    pendingDeletePortfolioIds.add("p-2");
    mod.renderPortfolios();
    assert.equal(cards().length, 0);
    assert.equal(pagBox().style.display, "none");
  });
});

describe("renderPortfolios() — render ปกติ", () => {
  test("แสดงครบทุกการ์ด ชื่อ/ลูกค้า/badge ประเภทถูกต้อง", () => {
    mod.renderPortfolios();
    const cs = cards();
    assert.equal(cs.length, 2);
    const c1 = card("p-1");
    assert.match(c1.querySelector(".port-info h3").textContent, /โรงงาน A/);
    assert.match(c1.querySelector(".port-client").textContent, /บริษัท เอ จำกัด/);
    assert.match(c1.querySelector(".port-badge").textContent, /โรงงานอุตสาหกรรม/);
  });

  test("ไม่มีลูกค้า → ไม่มี .port-client เลย", () => {
    mod.renderPortfolios();
    assert.equal(card("p-2").querySelector(".port-client"), null);
  });

  test("category ไม่ตรงกับ PF_CAT_LABEL ใดเลย → badge ใช้ค่า category ดิบ, ว่างเปล่า/undefined → 'ไม่ระบุประเภท'", () => {
    setAllPortfolios([
      { id: "p-3", title: "งานพิเศษ", category: "unknown-cat" },
      { id: "p-4", title: "งานไม่ระบุ" },
    ]);
    mod.renderPortfolios();
    assert.match(card("p-3").querySelector(".port-badge").textContent, /unknown-cat/);
    assert.match(card("p-4").querySelector(".port-badge").textContent, /ไม่ระบุประเภท/);
  });

  test("มีรูป → ใช้ <img> ไม่มีคลาส no-photo, ไม่มีรูป → ใช้ svg placeholder + class no-photo", () => {
    mod.renderPortfolios();
    const withImg = card("p-1");
    const noImg = card("p-2");
    assert.ok(withImg.querySelector(".port-visual img"));
    assert.equal(withImg.querySelector(".port-visual").classList.contains("no-photo"), false);
    assert.ok(noImg.querySelector(".port-visual svg"));
    assert.equal(noImg.querySelector(".port-visual").classList.contains("no-photo"), true);
  });

  test("มีมากกว่า 1 รูป → แสดง badge จำนวนรูปที่เหลือ (+N รูป)", () => {
    setAllPortfolios([{ id: "p-5", title: "หลายรูป", images: ["a.jpg", "b.jpg", "c.jpg"] }]);
    mod.renderPortfolios();
    assert.match(card("p-5").querySelector(".ad-pf-card-imgcount").textContent, /\+2 รูป/);
  });

  test("มีรูปเดียว → ไม่มี badge จำนวนรูป", () => {
    mod.renderPortfolios();
    assert.equal(card("p-1").querySelector(".ad-pf-card-imgcount"), null);
  });

  test("pinned=true → มีธง pin + ปุ่มเลื่อนขึ้น/ลง, pinned=false → ไม่มีทั้งคู่", () => {
    setAllPortfolios([
      { id: "p-6", title: "ปักหมุด", pinned: true },
      { id: "p-7", title: "ไม่ปักหมุด", pinned: false },
    ]);
    mod.renderPortfolios();
    assert.ok(card("p-6").querySelector(".port-pin-flag"));
    assert.ok(card("p-6").querySelector('[data-action="move-up"]'));
    assert.ok(card("p-6").querySelector('[data-action="move-down"]'));
    assert.equal(card("p-7").querySelector(".port-pin-flag"), null);
    assert.equal(card("p-7").querySelector('[data-action="move-up"]'), null);
    assert.equal(card("p-7").querySelector('[data-action="move-down"]'), null);
  });

  test("มี tags → แสดงสูงสุด 3 อัน, escape HTML กัน XSS ในชื่อ/tags", () => {
    setAllPortfolios([{ id: "p-8", title: '<img src=x onerror=alert(1)>', tags: ["a", "b", "c", "d"] }]);
    mod.renderPortfolios();
    const c = card("p-8");
    assert.equal(c.querySelectorAll(".port-tags span").length, 3);
    assert.doesNotMatch(c.innerHTML, /<img src=x onerror/);
    assert.match(c.querySelector("h3").innerHTML, /&lt;img/);
  });

  test("title ว่าง/undefined → ใช้ค่าดีฟอลต์ 'ไม่มีชื่อ' ไม่พัง", () => {
    setAllPortfolios([{ id: "p-9" }]);
    mod.renderPortfolios();
    assert.match(card("p-9").querySelector("h3").textContent, /ไม่มีชื่อ/);
  });

  test("ตัวกรองค้นหา: ชื่อหรือชื่อลูกค้า (case-insensitive, trim)", () => {
    field("ad-pf-search").value = "  เอ จำกัด  ";
    mod.renderPortfolios();
    assert.equal(cards().length, 1);
    assert.equal(card("p-1") !== null, true);
  });

  test("ตัวกรองประเภทโครงการ", () => {
    field("ad-pf-filter-cat").value = "industrial";
    mod.renderPortfolios();
    assert.equal(cards().length, 1);
    assert.equal(card("p-2") !== null, true);
  });

  test("กรอง pending-delete ออกจากรายการที่แสดง", () => {
    pendingDeletePortfolioIds.add("p-1");
    mod.renderPortfolios();
    assert.equal(cards().length, 1);
    assert.equal(card("p-1"), null);
  });

  test("checkbox ที่เลือกไว้คงอยู่ข้าม re-render", () => {
    mod.renderPortfolios();
    selectCards(["p-1"]);
    mod.renderPortfolios();
    assert.equal(cardCheckbox("p-1").checked, true);
  });
});

describe("renderPortfolioPagination()", () => {
  test("totalRows === 0 → ซ่อนกล่อง pagination", () => {
    setAllPortfolios([]);
    mod.renderPortfolios();
    assert.equal(pagBox().style.display, "none");
  });

  test("totalRows > 0 (แม้แค่หน้าเดียว) → แสดงกล่อง pagination ทันที", () => {
    mod.renderPortfolios();
    assert.equal(pagBox().style.display, "flex");
  });

  test("14 รายการ (page size 12) → ได้ 2 หน้าพอดี, ข้อความ/ปุ่มถูกต้อง", () => {
    const many = Array.from({ length: 14 }, (_, i) => ({ id: `m-${i}`, title: `งาน ${i}` }));
    setAllPortfolios(many);
    mod.renderPortfolios();
    assert.match(pagInfo().textContent, /แสดง 1–12 จาก 14 รายการ/);
    const pageBtns = Array.from(pagBtns().querySelectorAll(".cp-page-btn"));
    const prevBtn = pageBtns.find(b => b.dataset.page === "prev");
    const nextBtn = pageBtns.find(b => b.dataset.page === "next");
    assert.equal(prevBtn.disabled, true);
    assert.equal(nextBtn.disabled, false);

    nextBtn.click();
    assert.match(pagInfo().textContent, /แสดง 13–14 จาก 14 รายการ/);
    assert.equal(cards().length, 2);

    const prevBtn2 = Array.from(pagBtns().querySelectorAll(".cp-page-btn")).find(b => b.dataset.page === "prev");
    prevBtn2.click();
    assert.match(pagInfo().textContent, /แสดง 1–12 จาก 14 รายการ/);
  });

  test("คลิกเลขหน้าตรงๆ เปลี่ยนหน้าได้", () => {
    const many = Array.from({ length: 14 }, (_, i) => ({ id: `m-${i}`, title: `งาน ${i}` }));
    setAllPortfolios(many);
    mod.renderPortfolios();
    const page2Btn = Array.from(pagBtns().querySelectorAll(".cp-page-btn")).find(b => b.textContent === "2");
    page2Btn.click();
    assert.match(pagInfo().textContent, /แสดง 13–14 จาก 14 รายการ/);
  });
});

describe("pfSearch/pfFilterCat — รีเซ็ตหน้าเป็น 1 ก่อน render ใหม่เสมอ", () => {
  test("พิมพ์ค้นหาหลังไปหน้า 2 แล้ว → กลับมาหน้า 1", () => {
    const many = Array.from({ length: 14 }, (_, i) => ({ id: `m-${i}`, title: `งาน ${i}` }));
    setAllPortfolios(many);
    mod.renderPortfolios();
    Array.from(pagBtns().querySelectorAll(".cp-page-btn")).find(b => b.textContent === "2").click();
    assert.match(pagInfo().textContent, /แสดง 13–14/);

    field("ad-pf-search").value = "งาน";
    field("ad-pf-search").dispatchEvent(new Event("input", { bubbles: true }));
    assert.match(pagInfo().textContent, /แสดง 1–12/);
  });

  test("เปลี่ยนตัวกรองประเภทหลังไปหน้า 2 แล้ว → กลับมาหน้า 1", () => {
    const many = Array.from({ length: 14 }, (_, i) => ({ id: `m-${i}`, title: `งาน ${i}`, category: "factory" }));
    setAllPortfolios(many);
    mod.renderPortfolios();
    Array.from(pagBtns().querySelectorAll(".cp-page-btn")).find(b => b.textContent === "2").click();
    assert.match(pagInfo().textContent, /แสดง 13–14/);

    field("ad-pf-filter-cat").value = "factory";
    field("ad-pf-filter-cat").dispatchEvent(new Event("change", { bubbles: true }));
    assert.match(pagInfo().textContent, /แสดง 1–12/);
  });
});

describe("pfGrid event delegation — ปุ่มแก้ไข/ทำซ้ำ", () => {
  beforeEach(() => { mod.renderPortfolios(); });

  test("คลิกที่การ์ดไม่ใช่ปุ่ม/checkbox ก็ไม่ใช่พื้นที่เปิด popup โดยตรง (มีคลาสอื่นแทรก) → ไม่พัง", () => {
    // คลิกที่ card เอง (ไม่ตรงปุ่ม/checkbox) เปิด popup — ทดสอบแยกในกลุ่ม popup ด้านล่าง
    // เคสนี้แค่ยืนยันว่าคลิกนอก .ad-pf-card เลย (เช่นที่ grid เปล่าๆ) ไม่ทำอะไร ไม่ throw
    assert.doesNotThrow(() => {
      document.getElementById("ad-pf-grid").dispatchEvent(new Event("click", { bubbles: true }));
    });
  });

  test("ปุ่มแก้ไข → เปิดโมดัลแก้ไขพร้อมข้อมูลเดิม", () => {
    card("p-1").querySelector('[data-action="edit"]').dispatchEvent(new Event("click", { bubbles: true }));
    assert.equal(overlay().style.display, "flex");
    assert.equal(field("ad-pf-id").value, "p-1");
    assert.equal(field("ad-pf-title").value, "โรงงาน A");
  });

  test("ปุ่มทำซ้ำ → เปิดโมดัลโหมดเพิ่มพร้อมข้อมูลเดิม (ไม่มี id)", () => {
    card("p-1").querySelector('[data-action="clone"]').dispatchEvent(new Event("click", { bubbles: true }));
    assert.equal(overlay().style.display, "flex");
    assert.equal(field("ad-pf-id").value, "");
    assert.equal(field("ad-pf-title").value, "โรงงาน A");
  });

  test("คลิก checkbox ไม่เปิด popup/โมดัลใดๆ", () => {
    cardCheckbox("p-1").dispatchEvent(new Event("click", { bubbles: true }));
    assert.equal(overlay().style.display, "none");
    assert.equal(viewOverlay().style.display, "none");
  });
});

describe("pfGrid event delegation — ปุ่มลบ (deleteWithUndo)", () => {
  beforeEach(() => { mod.renderPortfolios(); });

  test("คลิกลบ → confirmDialog เปิดขึ้น ข้อความมีชื่อผลงาน", async () => {
    card("p-1").querySelector('[data-action="delete"]').dispatchEvent(new Event("click", { bubbles: true }));
    await flushMicrotasks();
    const co = document.querySelector(".cp-confirm-overlay");
    assert.equal(co.style.display, "flex");
    assert.match(co.querySelector("#cp-confirm-msg").textContent, /ลบผลงาน "โรงงาน A"/);
  });

  test("กด 'ยกเลิก' บน confirm → ไม่ลบ", async () => {
    card("p-1").querySelector('[data-action="delete"]').dispatchEvent(new Event("click", { bubbles: true }));
    await flushMicrotasks();
    document.querySelector(".cp-confirm-overlay #cp-confirm-cancel").click();
    await flushMicrotasks();
    assert.deepEqual(globalThis.__DELETE_DOC_CALLS__, []);
    assert.equal(cards().length, 2);
  });

  test("ยืนยันแล้วกด 'เลิกทำ' บน undo toast → ไม่ลบจริง การ์ดกลับมาครบ", async () => {
    card("p-1").querySelector('[data-action="delete"]').dispatchEvent(new Event("click", { bubbles: true }));
    await flushMicrotasks();
    document.querySelector("#cp-confirm-ok").click();
    await flushMicrotasks();
    assert.equal(cards().length, 1); // p-1 หายไปชั่วคราว
    const undoBtn = document.querySelector(".cp-toast-undo-btn");
    assert.ok(undoBtn, "ต้องมี toast เลิกทำโผล่ขึ้นมา");
    undoBtn.click();
    await flushMicrotasks();
    assert.equal((globalThis.__DELETE_DOC_CALLS__ || []).length, 0);
    assert.equal(cards().length, 2, "กด 'เลิกทำ' แล้วการ์ดต้องกลับมาครบ");
  });

  test("ยืนยันลบ แล้วปล่อยผ่านจนหมดเวลา (5000ms) → deletePortfolio() ถูกเรียกจริง + onCommitted = reloadAll()", async (t) => {
    const flushReal = () => new Promise((r) => setImmediate(r));
    t.mock.timers.enable({ apis: ["setTimeout"] });
    card("p-1").querySelector('[data-action="delete"]').dispatchEvent(new Event("click", { bubbles: true }));
    await flushReal();
    document.querySelector("#cp-confirm-ok").click();
    await flushReal();
    t.mock.timers.tick(5000);
    await flushReal();
    await flushReal();
    assert.equal(globalThis.__DELETE_DOC_CALLS__.length, 1);
    assert.equal(globalThis.__DELETE_DOC_CALLS__[0].path, "portfolios/p-1");
    assert.equal(globalThis.__AD_PAGE_STUB_RELOAD_ALL_CALLS__.length, 1);
    t.mock.timers.reset();
  });
});

describe("movePinnedItem() — ปุ่มเลื่อนขึ้น/ลงของผลงานปักหมุด (แพทเทิร์นใหม่)", () => {
  const PINNED_SET = [
    { id: "pin-a", title: "A", pinned: true, order: 0, createdAt: 1000 },
    { id: "pin-b", title: "B", pinned: true, order: 1, createdAt: 2000 },
    { id: "pin-c", title: "C", pinned: true, order: 2, createdAt: 3000 },
  ];

  beforeEach(() => {
    setAllPortfolios(PINNED_SET.map(p => ({ ...p })));
    mod.renderPortfolios();
  });

  test("เลื่อนขึ้นตัวกลาง (B, idx=1) → สลับ order กับตัวบน (A, idx=0): B ได้ order=0, A ได้ order=1", async () => {
    card("pin-b").querySelector('[data-action="move-up"]').dispatchEvent(new Event("click", { bubbles: true }));
    await flushMicrotasks();
    await flushMicrotasks();

    assert.equal(globalThis.__UPDATE_DOC_CALLS__.length, 2);
    const byPath = Object.fromEntries(globalThis.__UPDATE_DOC_CALLS__.map(c => [c.path, c.payload]));
    assert.equal(byPath["portfolios/pin-b"].order, 0);
    assert.equal(byPath["portfolios/pin-a"].order, 1);
    assert.equal(globalThis.__AD_PAGE_STUB_RELOAD_ALL_CALLS__.length, 1);
  });

  test("เลื่อนลงตัวกลาง (B, idx=1) → สลับ order กับตัวล่าง (C, idx=2): B ได้ order=2, C ได้ order=1", async () => {
    card("pin-b").querySelector('[data-action="move-down"]').dispatchEvent(new Event("click", { bubbles: true }));
    await flushMicrotasks();
    await flushMicrotasks();

    assert.equal(globalThis.__UPDATE_DOC_CALLS__.length, 2);
    const byPath = Object.fromEntries(globalThis.__UPDATE_DOC_CALLS__.map(c => [c.path, c.payload]));
    assert.equal(byPath["portfolios/pin-b"].order, 2);
    assert.equal(byPath["portfolios/pin-c"].order, 1);
    assert.equal(globalThis.__AD_PAGE_STUB_RELOAD_ALL_CALLS__.length, 1);
  });

  test("ตัวบนสุด (A, idx=0) กดเลื่อนขึ้นอีก → ไม่ทำอะไร (swapIdx < 0)", async () => {
    card("pin-a").querySelector('[data-action="move-up"]').dispatchEvent(new Event("click", { bubbles: true }));
    await flushMicrotasks();
    assert.deepEqual(globalThis.__UPDATE_DOC_CALLS__, []);
    assert.equal(globalThis.__AD_PAGE_STUB_RELOAD_ALL_CALLS__.length, 0);
  });

  test("ตัวล่างสุด (C, idx=2) กดเลื่อนลงอีก → ไม่ทำอะไร (swapIdx >= length)", async () => {
    card("pin-c").querySelector('[data-action="move-down"]').dispatchEvent(new Event("click", { bubbles: true }));
    await flushMicrotasks();
    assert.deepEqual(globalThis.__UPDATE_DOC_CALLS__, []);
    assert.equal(globalThis.__AD_PAGE_STUB_RELOAD_ALL_CALLS__.length, 0);
  });

  test("payload ของ savePortfolio ยังมีฟิลด์อื่นของเดิมติดไปด้วย (title ไม่หาย)", async () => {
    card("pin-b").querySelector('[data-action="move-up"]').dispatchEvent(new Event("click", { bubbles: true }));
    await flushMicrotasks();
    await flushMicrotasks();
    const bCall = globalThis.__UPDATE_DOC_CALLS__.find(c => c.path === "portfolios/pin-b");
    assert.equal(bCall.payload.title, "B");
    assert.equal(bCall.payload.pinned, true);
  });
});

describe("bulk actions — checkbox เลือกการ์ด (ad-pf-card-check)", () => {
  beforeEach(() => { mod.renderPortfolios(); });

  test("ติ๊กเลือกการ์ดเดียว: bulk bar ได้ class active, count เป็น 1", () => {
    selectCards(["p-1"]);
    assert.equal(bulkBar().classList.contains("active"), true);
    assert.equal(bulkCount().textContent, "1");
  });

  test("ติ๊กแล้วเอาติ๊กออก: count กลับเป็น 0, bulk bar หมด active", () => {
    const cb = cardCheckbox("p-2");
    cb.checked = true;
    cb.dispatchEvent(new Event("change", { bubbles: true }));
    assert.equal(bulkCount().textContent, "1");
    cb.checked = false;
    cb.dispatchEvent(new Event("change", { bubbles: true }));
    assert.equal(bulkCount().textContent, "0");
    assert.equal(bulkBar().classList.contains("active"), false);
  });

  test("ติ๊กหลายการ์ด: count นับรวมถูกต้อง", () => {
    selectCards(["p-1", "p-2"]);
    assert.equal(bulkCount().textContent, "2");
  });
});

describe("bulk actions — ปุ่ม 'ล้างการเลือก' (ad-pf-bulk-clear)", () => {
  test("เลือกไว้แล้วกดล้าง: selection ว่างทั้งหมด, checkbox ทุกการ์ดเอาติ๊กออก, bulk bar หมด active", () => {
    mod.renderPortfolios();
    selectCards(["p-1", "p-2"]);
    assert.equal(bulkCount().textContent, "2");

    document.getElementById("ad-pf-bulk-clear").click();

    assert.equal(bulkCount().textContent, "0");
    assert.equal(bulkBar().classList.contains("active"), false);
    assert.equal(cardCheckbox("p-1").checked, false);
    assert.equal(cardCheckbox("p-2").checked, false);
  });
});

describe("bulk actions — ปุ่ม 'ลบที่เลือก' (ad-pf-bulk-delete)", () => {
  beforeEach(() => { mod.renderPortfolios(); });

  test("ไม่มีการ์ดไหนถูกเลือกเลย: กดแล้วไม่เปิด confirmDialog เลย (early return)", () => {
    document.getElementById("ad-pf-bulk-delete").click();
    const co = document.querySelector(".cp-confirm-overlay");
    if (co) assert.notEqual(co.style.display, "flex");
    assert.deepEqual(globalThis.__DELETE_DOC_CALLS__, []);
  });

  test("เลือก 2 การ์ดแล้วกดลบ, กด 'ยกเลิก' บน confirm → ไม่เรียก deletePortfolio() เลย, selection คงอยู่", async () => {
    selectCards(["p-1", "p-2"]);
    document.getElementById("ad-pf-bulk-delete").click();
    await flushMicrotasks();
    const co = document.querySelector(".cp-confirm-overlay");
    assert.equal(co.style.display, "flex");
    assert.match(co.querySelector("#cp-confirm-msg").textContent, /ลบผลงานที่เลือก 2 รายการ/);
    co.querySelector("#cp-confirm-cancel").click();
    await flushMicrotasks();

    assert.deepEqual(globalThis.__DELETE_DOC_CALLS__, []);
    assert.equal(bulkCount().textContent, "2");
  });

  test("เลือก 2 การ์ดแล้วกดลบ, กด 'ยืนยัน': เรียก deletePortfolio() ครบทั้ง 2 รายการทันที (ไม่มี undo), เคลียร์ selection, ปุ่มกลับมา enabled, toast สำเร็จ, reloadAll()", async () => {
    selectCards(["p-1", "p-2"]);
    const btn = document.getElementById("ad-pf-bulk-delete");
    btn.click();
    await flushMicrotasks();
    document.querySelector(".cp-confirm-overlay #cp-confirm-ok").click();
    await flushMicrotasks();
    await flushMicrotasks();

    assert.equal(globalThis.__DELETE_DOC_CALLS__.length, 2);
    const paths = globalThis.__DELETE_DOC_CALLS__.map(c => c.path).sort();
    assert.deepEqual(paths, ["portfolios/p-1", "portfolios/p-2"]);
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

describe("popup ดูรายละเอียดผลงาน (ad-pf-view-overlay)", () => {
  beforeEach(() => { mod.renderPortfolios(); });

  test("คลิกที่การ์ด (ไม่ใช่ปุ่ม/checkbox) → เปิด popup พร้อมข้อมูลครบ", () => {
    card("p-1").dispatchEvent(new Event("click", { bubbles: true }));
    assert.equal(viewOverlay().style.display, "flex");
    assert.equal(field("ad-pf-view-title").textContent, "โรงงาน A");
    assert.equal(field("ad-pf-view-client").textContent, "บริษัท เอ จำกัด");
    assert.equal(field("ad-pf-view-client").style.display, "");
    assert.match(field("ad-pf-view-badge").textContent, /โรงงานอุตสาหกรรม/);
    assert.equal(field("ad-pf-view-img").getAttribute("src"), "https://res.cloudinary.com/x/a.jpg");
  });

  test("ไม่มีลูกค้า → ซ่อน .ad-pf-view-client, ไม่มีคำอธิบาย → ซ่อน desc, ไม่มี tags → ซ่อน tags box", () => {
    card("p-2").dispatchEvent(new Event("click", { bubbles: true }));
    assert.equal(field("ad-pf-view-client").style.display, "none");
    assert.equal(field("ad-pf-view-desc").style.display, "none");
    assert.equal(field("ad-pf-view-tags").style.display, "none");
  });

  test("pinned=true → แสดงธง pin ใน popup, pinned=false → ซ่อน", () => {
    setAllPortfolios([
      { id: "p-pin", title: "ปักหมุด", pinned: true },
      { id: "p-nopin", title: "ไม่ปักหมุด", pinned: false },
    ]);
    mod.renderPortfolios();
    card("p-pin").dispatchEvent(new Event("click", { bubbles: true }));
    assert.equal(field("ad-pf-view-pin").style.display, "flex");
    card("p-nopin").dispatchEvent(new Event("click", { bubbles: true }));
    assert.equal(field("ad-pf-view-pin").style.display, "none");
  });

  test("มีรูปมากกว่า 1 → แสดง thumbnails ทั้งหมด, รูปแรก active", () => {
    setAllPortfolios([{ id: "p-multi", title: "หลายรูป", images: ["a.jpg", "b.jpg", "c.jpg"] }]);
    mod.renderPortfolios();
    card("p-multi").dispatchEvent(new Event("click", { bubbles: true }));
    const thumbs = document.querySelectorAll("#ad-pf-view-thumbs .ad-pf-view-thumb");
    assert.equal(thumbs.length, 3);
    assert.equal(thumbs[0].classList.contains("active"), true);
    assert.equal(field("ad-pf-view-img").getAttribute("src"), "a.jpg");
  });

  test("มีรูปเดียวหรือไม่มีเลย → ไม่มี thumbnails", () => {
    card("p-1").dispatchEvent(new Event("click", { bubbles: true })); // 1 รูป
    assert.equal(document.querySelectorAll("#ad-pf-view-thumbs .ad-pf-view-thumb").length, 0);
    card("p-2").dispatchEvent(new Event("click", { bubbles: true })); // 0 รูป
    assert.equal(document.querySelectorAll("#ad-pf-view-thumbs .ad-pf-view-thumb").length, 0);
    assert.equal(field("ad-pf-view-img").getAttribute("src"), "");
  });

  test("คลิก thumbnail รูปที่ 2 → เปลี่ยนรูปหลัก + active ย้ายตาม", () => {
    setAllPortfolios([{ id: "p-multi", title: "หลายรูป", images: ["a.jpg", "b.jpg"] }]);
    mod.renderPortfolios();
    card("p-multi").dispatchEvent(new Event("click", { bubbles: true }));
    const thumbs = document.querySelectorAll("#ad-pf-view-thumbs .ad-pf-view-thumb");
    thumbs[1].dispatchEvent(new Event("click", { bubbles: true }));
    assert.equal(field("ad-pf-view-img").getAttribute("src"), "b.jpg");
    assert.equal(thumbs[0].classList.contains("active"), false);
    assert.equal(thumbs[1].classList.contains("active"), true);
  });

  test("ปุ่มปิด (ad-pf-view-close) → ปิด popup", () => {
    card("p-1").dispatchEvent(new Event("click", { bubbles: true }));
    assert.equal(viewOverlay().style.display, "flex");
    field("ad-pf-view-close").click();
    assert.equal(viewOverlay().style.display, "none");
  });

  test("คลิก backdrop (ตัว overlay เอง) → ปิด, คลิกข้างในโมดัลไม่ปิด", () => {
    card("p-1").dispatchEvent(new Event("click", { bubbles: true }));
    field("ad-pf-view-title").dispatchEvent(new Event("click", { bubbles: true }));
    assert.equal(viewOverlay().style.display, "flex", "คลิกข้างในไม่ควรปิด");
    viewOverlay().dispatchEvent(new Event("click", { bubbles: true }));
    assert.equal(viewOverlay().style.display, "none");
  });

  test("ปุ่ม 'แก้ไขผลงานนี้' → ปิด popup แล้วเปิดโมดัลแก้ไขพร้อมข้อมูลเดิม", () => {
    card("p-1").dispatchEvent(new Event("click", { bubbles: true }));
    field("ad-pf-view-edit").click();
    assert.equal(viewOverlay().style.display, "none");
    assert.equal(overlay().style.display, "flex");
    assert.equal(field("ad-pf-id").value, "p-1");
    assert.equal(field("ad-pf-title").value, "โรงงาน A");
  });

  test("escape HTML กัน XSS ในชื่อ/tags ของ popup", () => {
    setAllPortfolios([{ id: "p-xss", title: '<img src=x onerror=alert(1)>', tags: ["<b>bold</b>"] }]);
    mod.renderPortfolios();
    card("p-xss").dispatchEvent(new Event("click", { bubbles: true }));
    assert.doesNotMatch(field("ad-pf-view-tags").innerHTML, /<b>bold<\/b>/);
    assert.match(field("ad-pf-view-tags").innerHTML, /&lt;b&gt;/);
    // pfViewTitle ใช้ textContent ไม่ใช่ innerHTML จึงปลอดภัยอยู่แล้วโดยธรรมชาติ
    assert.equal(field("ad-pf-view-title").textContent, '<img src=x onerror=alert(1)>');
  });
});

describe("pfAddBtn", () => {
  test("คลิกเพิ่มผลงาน → เปิดโมดัลโหมดเพิ่ม (openPortfolioModal(null))", () => {
    field("ad-pf-add-btn").click();
    assert.equal(overlay().style.display, "flex");
    assert.equal(field("ad-pf-id").value, "");
    assert.equal(field("ad-pf-title").value, "");
  });
});
