// test/admin-products.test.mjs — รอบที่ 133
//
// ขอบเขต: js/admin-products.js (290 บรรทัด) — แท็บ "สินค้า": กริด/ค้นหา/กรอง/pagination,
// bulk actions (เปลี่ยนสถานะ/ลบ), popup แกลเลอรีสินค้าแนะนำ (เรียก openProductGalleryPopup()
// จาก admin-products-gallery.js จริง — ไม่ mock) — คู่กับ js/admin-products-form.js (เทสแยกไว้
// แล้วรอบ 107) ที่ไฟล์นี้ import openProductModal()/openProductModalClone() กลับมาใช้ตรงๆ (ไม่ mock
// เช่นกัน เพราะเป็นไฟล์จริงไม่แตะ Firestore ตอน import และมีเทสของตัวเองอยู่แล้ว)
//
// ไฟล์นี้ import { reloadAll } from "./admin-page.js" ตรงๆ ที่ระดับบนสุด — "products" อยู่ใน
// ALLOWED_PARENT_RE ของ test/helpers/admin-page-stub-loader.mjs อยู่แล้วตั้งแต่ก่อนรอบนี้ (ไฟล์อื่น
// เช่น admin-products-form.js/admin-products-csv.js ที่เคยเทสมาก่อนใช้ "products-form"/
// "products-csv" ต่างหาก ไม่ชนกับ "products" เปล่าๆ ของไฟล์นี้) — ไม่ต้องแก้ infra เทสไฟล์ไหนเลย
// ยืนยันด้วยการลอง import ตรงในสภาพแวดล้อมเทสก่อนเขียนเทสตามที่ตกลงไว้ทุกรอบ: ผ่านทันที
//
// admin-products-gallery.js (คนละไฟล์ ไม่อยู่ใน ALLOWED_PARENT_RE) ไม่ import "./admin-page.js"
// เลย (ตรวจ import ครบแล้ว) จึงไม่ต้องแก้ regex เพิ่มจุดนี้
//
// แพทเทิร์น bulk apply-status/bulk delete อ้างอิงจาก test/admin-blog.test.mjs (รอบ 114) — เหมือน
// กันทุกจุด (bulk apply-status set disabled=true แบบ synchronous ทันทีตอนคลิกเทสได้, bulk delete
// ไม่มีจุด synchronous ให้เทส disabled เหมือนกันด้วยเหตุผลเดียวกับรอบ 114/115 คือ deleteDoc()
// stub resolve เร็วมากจน Promise.all() มักจะ resolve ก่อนมี tick ให้เช็คทัน)
//
// จุดต่างจาก admin-blog.js/admin-portfolio.js: ปุ่ม "star" (ติดดาวสินค้าแนะนำ) เป็นแพทเทิร์นใหม่
// ที่ยังไม่เคยมีไฟล์เทสไหนคลุมมาก่อน — เรียก saveProduct() (updateDoc) ตรงๆ ไม่ผ่าน deleteWithUndo,
// disable ปุ่มระหว่างทำงาน (synchronous ทันที เทสได้แน่นอนเหมือน bulk apply-status), มี error path
// ทดสอบได้จริงผ่าน globalThis.__UPDATE_DOC_STUB__ (เพิ่มมาตั้งแต่รอบ 121 สำหรับ admin-products-csv.js
// — ใช้ซ้ำได้ที่นี่): return { throw: err } จำลอง updateDoc() reject
//
// คลิกที่รูปสินค้า "แนะนำ" (featured, data-action="gallery") → เปิด popup จริงจาก
// admin-products-gallery.js (ไม่ mock) — เทสแค่ยืนยันว่า overlay เปิดพร้อมข้อมูลถูกต้อง ไม่ทดสอบ
// ตรรกะภายในไฟล์นั้นซ้ำ (มีเทสของตัวเองอยู่แล้วที่ test/admin-products-gallery.test.mjs)
//
// คลิกที่ตัวการ์ดเอง (นอกเหนือปุ่ม/checkbox/gallery) → เปิดฟอร์มแก้ไขทันที (ต่างจาก
// admin-portfolio.js ที่คลิกการ์ดเปิด popup ดูรายละเอียดแทน — พฤติกรรมคนละแบบกันจริง ตรวจโค้ด
// ยืนยันแล้ว)
//
// ตรวจโค้ดจริงทั้งไฟล์ js/admin-products.js + saveProduct()/deleteProduct() ใน js/db-products.js
// ก่อนเขียนเทสนี้ (อ่านครบ) — ไม่พบบั๊ก จึงเป็นไฟล์เทสล้วนๆ ไม่มีการแก้โค้ดผลิตภัณฑ์เลยแม้แต่บรรทัด
// เดียว
//
// **ไม่มีเทส "ลบไม่สำเร็จ" สำหรับ deleteWithUndo/bulk delete** ด้วยเหตุผลเดียวกับทุกไฟล์ก่อนหน้า:
// deleteDoc() ใน firebase-stub-loader.mjs ไม่มีช่องทาง __DELETE_DOC_STUB__ ให้สั่ง reject ได้เลย
// (resolve() เฉยๆ เสมอตามดีไซน์ปัจจุบัน)

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
let mod;                 // admin-products.js exports
let setAllProducts, setAllCategories, pendingDeleteProductIds;
let fillCategorySelects;

function resetFirebaseCalls() {
  globalThis.__ADD_DOC_CALLS__ = [];
  globalThis.__UPDATE_DOC_CALLS__ = [];
  globalThis.__DELETE_DOC_CALLS__ = [];
  globalThis.__UPDATE_DOC_STUB__ = undefined;
}

function resetSpies() {
  globalThis.__AD_PAGE_STUB_RELOAD_ALL_CALLS__ = [];
  globalThis.__AD_PAGE_STUB_RELOAD_ALL__ = (...args) => {
    globalThis.__AD_PAGE_STUB_RELOAD_ALL_CALLS__.push(args);
  };
}

const SAMPLE_CATEGORIES = [
  { id: "cat-a", name: "ป้ายความปลอดภัย" },
  { id: "cat-b", name: "ป้ายจราจร" },
];

const SAMPLE_PRODUCTS = [
  {
    id: "prod-1", name: "ป้ายทางหนีไฟ", code: "SG-001", cat_id: "cat-a",
    status: "active", price: 250, unit: "แผ่น", featured: true,
    images: ["https://res.cloudinary.com/x/a.jpg"],
  },
  {
    id: "prod-2", name: "ป้ายจอดรถ", code: "", cat_id: "cat-b",
    status: "hidden", price: 0, unit: "", featured: false, images: [],
  },
];

function overlay() { return document.getElementById("ad-p-overlay"); }
function galleryOverlay() { return document.getElementById("ad-p-view-overlay"); }
function field(id) { return document.getElementById(id); }
function grid() { return document.getElementById("ad-p-grid"); }
function cards() { return Array.from(grid().querySelectorAll(".ad-card[data-id]")); }
function card(id) { return document.querySelector(`.ad-card[data-id="${id}"]`); }
function cardCheckbox(id) { return document.querySelector(`.ad-card-check[data-id="${id}"]`); }
function pagBox() { return document.getElementById("ad-p-pagination"); }
function pagInfo() { return document.getElementById("ad-p-pagination-info"); }
function pagBtns() { return document.getElementById("ad-p-pagination-btns"); }
function bulkBar() { return document.getElementById("ad-p-bulk-bar"); }
function bulkCount() { return document.getElementById("ad-p-bulk-count"); }

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

  mod = await import("../js/admin-products.js");
  ({ setAllProducts, setAllCategories, pendingDeleteProductIds } = await import("../js/admin-state.js"));
  ({ fillCategorySelects } = await import("../js/admin-utils.js"));
});

beforeEach(() => {
  resetFirebaseCalls();
  resetSpies();
  pendingDeleteProductIds.clear();
  field("ad-p-search").value = "";
  field("ad-p-filter-cat").value = "";
  document.getElementById("ad-p-bulk-clear").click(); // เคลียร์ selectedProductIds ที่ไม่มี setter export
  setAllCategories(SAMPLE_CATEGORIES.map(c => ({ ...c })));
  fillCategorySelects();
  setAllProducts(SAMPLE_PRODUCTS.map(p => ({ ...p, images: [...p.images] })));
  const confirmOverlay = document.querySelector(".cp-confirm-overlay");
  if (confirmOverlay && confirmOverlay.style.display === "flex") {
    confirmOverlay.querySelector("#cp-confirm-cancel").click();
  }
  if (overlay().style.display === "flex") overlay().style.display = "none";
  if (galleryOverlay().style.display === "flex") galleryOverlay().style.display = "none";
  document.querySelectorAll(".cp-toast-wrap .cp-toast").forEach(el => el.remove());
});

describe("renderProducts() — empty states", () => {
  test("allProducts ว่างเปล่าทั้งหมด → empty-state ไม่มีตัวกรอง (มีปุ่ม CTA เพิ่มรายการแรก)", () => {
    setAllProducts([]);
    mod.renderProducts();
    assert.match(grid().innerHTML, /ยังไม่มีสินค้าในแคตตาล็อก/);
    assert.equal(cards().length, 0);
    assert.equal(pagBox().style.display, "none");
    assert.ok(field("ad-p-empty-add"));
  });

  test("มีตัวกรอง (ค้นหา) แล้วไม่เจอผลลัพธ์ → ข้อความคนละแบบ ไม่มีปุ่ม CTA", () => {
    field("ad-p-search").value = "ไม่มีทางเจอ";
    mod.renderProducts();
    assert.match(grid().innerHTML, /ไม่พบสินค้าที่ตรงกับตัวกรอง/);
    assert.doesNotMatch(grid().innerHTML, /ยังไม่มีสินค้าในแคตตาล็อก/);
    assert.equal(field("ad-p-empty-add"), null);
  });

  test("มีตัวกรอง (หมวดหมู่) แล้วไม่เจอผลลัพธ์ → ข้อความแบบมีตัวกรองเช่นกัน", () => {
    setAllProducts([{ id: "x", name: "x", cat_id: "cat-a" }]);
    field("ad-p-filter-cat").value = "cat-b";
    mod.renderProducts();
    assert.match(grid().innerHTML, /ไม่พบสินค้าที่ตรงกับตัวกรอง/);
  });

  test("empty-state ปุ่ม 'เพิ่มรายการแรก' → คลิกแล้วเปิดโมดัลโหมดเพิ่ม", () => {
    setAllProducts([]);
    mod.renderProducts();
    field("ad-p-empty-add").click();
    assert.equal(overlay().style.display, "flex");
    assert.equal(field("ad-p-id").value, "");
  });

  test("ทุกสินค้าถูก mark pending-delete หมด → empty-state แบบมีตัวกรอง (filteredRows ว่างทั้งที่ allProducts มีของ)", () => {
    pendingDeleteProductIds.add("prod-1");
    pendingDeleteProductIds.add("prod-2");
    mod.renderProducts();
    assert.equal(cards().length, 0);
    assert.equal(pagBox().style.display, "none");
  });
});

describe("renderProducts() — render ปกติ", () => {
  test("แสดงครบทุกการ์ด ชื่อ/รหัส/หมวดหมู่/ราคาถูกต้อง", () => {
    mod.renderProducts();
    const cs = cards();
    assert.equal(cs.length, 2);
    const c1 = card("prod-1");
    assert.match(c1.querySelector(".ad-card-name").textContent, /ป้ายทางหนีไฟ/);
    assert.match(c1.querySelector(".ad-card-code").textContent, /SG-001/);
    assert.match(c1.querySelector(".ad-card-cat").textContent, /ป้ายความปลอดภัย/);
    assert.match(c1.querySelector(".ad-card-price").textContent, /250/);
  });

  test("ไม่มีรหัสสินค้า → ไม่มี .ad-card-code เลย", () => {
    mod.renderProducts();
    assert.equal(card("prod-2").querySelector(".ad-card-code"), null);
  });

  test("price = 0/falsy → แสดง 'สอบถามราคา' แทน", () => {
    mod.renderProducts();
    assert.match(card("prod-2").querySelector(".ad-card-price").textContent, /สอบถามราคา/);
  });

  test("มี price + unit → แสดงราคาปัดรูปแบบไทยพร้อมหน่วย", () => {
    setAllProducts([{ id: "p-u", name: "มีหน่วย", price: 1500, unit: "ชิ้น" }]);
    mod.renderProducts();
    assert.match(card("p-u").querySelector(".ad-card-price").textContent, /1,500 \/ ชิ้น/);
  });

  test("status='hidden' → มี class ad-card--hidden + badge 'ซ่อนอยู่' บนรูป", () => {
    mod.renderProducts();
    const hidden = card("prod-2");
    assert.equal(hidden.classList.contains("ad-card--hidden"), true);
    assert.ok(hidden.querySelector(".ad-card-status"));
    assert.match(hidden.querySelector(".ad-card-status").textContent, /ซ่อนอยู่/);
    const active = card("prod-1");
    assert.equal(active.classList.contains("ad-card--hidden"), false);
    assert.equal(active.querySelector(".ad-card-status"), null);
  });

  test("มีรูป → ใช้ <img class=port-photo> ไม่มีคลาส no-photo, ไม่มีรูป → svg placeholder + class no-photo", () => {
    mod.renderProducts();
    const withImg = card("prod-1");
    const noImg = card("prod-2");
    assert.ok(withImg.querySelector(".port-visual img.port-photo"));
    assert.equal(withImg.querySelector(".port-visual").classList.contains("no-photo"), false);
    assert.ok(noImg.querySelector(".port-visual svg"));
    assert.equal(noImg.querySelector(".port-visual").classList.contains("no-photo"), true);
  });

  test("featured=true → ธง 'แนะนำ' บนรูป + ปุ่มดาวติด is-starred, featured=false → ไม่มีทั้งคู่", () => {
    mod.renderProducts();
    const featured = card("prod-1");
    const notFeatured = card("prod-2");
    assert.ok(featured.querySelector(".ad-card-feat-flag"));
    assert.equal(featured.querySelector('[data-action="star"]').classList.contains("is-starred"), true);
    assert.equal(notFeatured.querySelector(".ad-card-feat-flag"), null);
    assert.equal(notFeatured.querySelector('[data-action="star"]').classList.contains("is-starred"), false);
  });

  test("รูปมากกว่า 1 รูป → badge จำนวนรูปที่เหลือ (+N รูป), รูปเดียว → ไม่มี badge", () => {
    setAllProducts([
      { id: "p-multi", name: "หลายรูป", images: ["a.jpg", "b.jpg", "c.jpg"] },
      { id: "p-1img", name: "รูปเดียว", images: ["a.jpg"] },
    ]);
    mod.renderProducts();
    assert.match(card("p-multi").querySelector(".ad-card-imgcount").textContent, /\+2 รูป/);
    assert.equal(card("p-1img").querySelector(".ad-card-imgcount"), null);
  });

  test("ชื่อว่าง/undefined → ใช้ค่าดีฟอลต์ 'ไม่มีชื่อ' ไม่พัง", () => {
    setAllProducts([{ id: "p-noname" }]);
    mod.renderProducts();
    assert.match(card("p-noname").querySelector(".ad-card-name").textContent, /ไม่มีชื่อ/);
  });

  test("escape HTML กัน XSS ในชื่อ/รหัส", () => {
    setAllProducts([{ id: "p-xss", name: '<img src=x onerror=alert(1)>', code: '<b>x</b>' }]);
    mod.renderProducts();
    const c = card("p-xss");
    assert.doesNotMatch(c.innerHTML, /<img src=x onerror/);
    assert.match(c.querySelector(".ad-card-name").innerHTML, /&lt;img/);
    assert.match(c.querySelector(".ad-card-code").innerHTML, /&lt;b&gt;/);
  });

  test("ตัวกรองค้นหา: ชื่อหรือรหัสสินค้า (case-insensitive, trim)", () => {
    field("ad-p-search").value = "  sg-001  ";
    mod.renderProducts();
    assert.equal(cards().length, 1);
    assert.ok(card("prod-1"));
  });

  test("ตัวกรองหมวดหมู่", () => {
    field("ad-p-filter-cat").value = "cat-b";
    mod.renderProducts();
    assert.equal(cards().length, 1);
    assert.ok(card("prod-2"));
  });

  test("กรอง pending-delete ออกจากรายการที่แสดง", () => {
    pendingDeleteProductIds.add("prod-1");
    mod.renderProducts();
    assert.equal(cards().length, 1);
    assert.equal(card("prod-1"), null);
  });

  test("checkbox ที่เลือกไว้คงอยู่ข้าม re-render", () => {
    mod.renderProducts();
    selectCards(["prod-1"]);
    mod.renderProducts();
    assert.equal(cardCheckbox("prod-1").checked, true);
  });
});

describe("renderProductsPagination()", () => {
  test("totalRows === 0 → ซ่อนกล่อง pagination", () => {
    setAllProducts([]);
    mod.renderProducts();
    assert.equal(pagBox().style.display, "none");
  });

  test("totalRows > 0 (แม้แค่หน้าเดียว) → แสดงกล่อง pagination ทันที", () => {
    mod.renderProducts();
    assert.equal(pagBox().style.display, "flex");
  });

  test("14 รายการ (page size 12) → ได้ 2 หน้าพอดี, ข้อความ/ปุ่มถูกต้อง", () => {
    const many = Array.from({ length: 14 }, (_, i) => ({ id: `m-${i}`, name: `สินค้า ${i}` }));
    setAllProducts(many);
    mod.renderProducts();
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
    const many = Array.from({ length: 14 }, (_, i) => ({ id: `m-${i}`, name: `สินค้า ${i}` }));
    setAllProducts(many);
    mod.renderProducts();
    const page2Btn = Array.from(pagBtns().querySelectorAll(".cp-page-btn")).find(b => b.textContent === "2");
    page2Btn.click();
    assert.match(pagInfo().textContent, /แสดง 13–14 จาก 14 รายการ/);
  });
});

describe("pSearch/pFilterCat — รีเซ็ตหน้าเป็น 1 ก่อน render ใหม่เสมอ", () => {
  test("พิมพ์ค้นหาหลังไปหน้า 2 แล้ว → กลับมาหน้า 1", () => {
    const many = Array.from({ length: 14 }, (_, i) => ({ id: `m-${i}`, name: `สินค้า ${i}` }));
    setAllProducts(many);
    mod.renderProducts();
    Array.from(pagBtns().querySelectorAll(".cp-page-btn")).find(b => b.textContent === "2").click();
    assert.match(pagInfo().textContent, /แสดง 13–14/);

    field("ad-p-search").value = "สินค้า";
    field("ad-p-search").dispatchEvent(new Event("input", { bubbles: true }));
    assert.match(pagInfo().textContent, /แสดง 1–12/);
  });

  test("เปลี่ยนตัวกรองหมวดหมู่หลังไปหน้า 2 แล้ว → กลับมาหน้า 1", () => {
    const many = Array.from({ length: 14 }, (_, i) => ({ id: `m-${i}`, name: `สินค้า ${i}`, cat_id: "cat-a" }));
    setAllProducts(many);
    mod.renderProducts();
    Array.from(pagBtns().querySelectorAll(".cp-page-btn")).find(b => b.textContent === "2").click();
    assert.match(pagInfo().textContent, /แสดง 13–14/);

    field("ad-p-filter-cat").value = "cat-a";
    field("ad-p-filter-cat").dispatchEvent(new Event("change", { bubbles: true }));
    assert.match(pagInfo().textContent, /แสดง 1–12/);
  });
});

describe("pGrid event delegation — ปุ่มแก้ไข/ทำซ้ำ/คลิกการ์ด", () => {
  beforeEach(() => { mod.renderProducts(); });

  test("คลิกที่ grid เปล่าๆ (ไม่ตรง .ad-card เลย) → ไม่พัง", () => {
    assert.doesNotThrow(() => {
      grid().dispatchEvent(new Event("click", { bubbles: true }));
    });
  });

  test("ปุ่มแก้ไข → เปิดโมดัลแก้ไขพร้อมข้อมูลเดิม", () => {
    card("prod-1").querySelector('[data-action="edit"]').dispatchEvent(new Event("click", { bubbles: true }));
    assert.equal(overlay().style.display, "flex");
    assert.equal(field("ad-p-id").value, "prod-1");
    assert.equal(field("ad-p-name").value, "ป้ายทางหนีไฟ");
  });

  test("ปุ่มทำซ้ำ → เปิดโมดัลโหมดเพิ่มพร้อมข้อมูลเดิม (ไม่มี id)", () => {
    card("prod-1").querySelector('[data-action="clone"]').dispatchEvent(new Event("click", { bubbles: true }));
    assert.equal(overlay().style.display, "flex");
    assert.equal(field("ad-p-id").value, "");
    assert.equal(field("ad-p-name").value, "ป้ายทางหนีไฟ");
  });

  test("คลิก checkbox ไม่เปิดโมดัลใดๆ", () => {
    cardCheckbox("prod-1").dispatchEvent(new Event("click", { bubbles: true }));
    assert.equal(overlay().style.display, "none");
  });

  test("คลิกที่ตัวการ์ดเอง (ไม่ใช่ปุ่ม/checkbox/gallery) → เปิดฟอร์มแก้ไขทันที", () => {
    // prod-2 ไม่มีรูปเลย จึงไม่มี data-action="gallery" ผูกกับพื้นที่รูป — คลิกที่การ์ดต้องเปิดแก้ไขเสมอ
    card("prod-2").dispatchEvent(new Event("click", { bubbles: true }));
    assert.equal(overlay().style.display, "flex");
    assert.equal(field("ad-p-id").value, "prod-2");
  });

  test("คลิกที่ id ไม่พบใน allProducts (การ์ดเก่าค้างใน DOM) → ไม่พัง ไม่เปิดอะไร", () => {
    // จำลองโดยลบสินค้าออกจาก allProducts แต่ยังไม่ re-render กริด
    setAllProducts([]);
    assert.doesNotThrow(() => {
      card("prod-1").dispatchEvent(new Event("click", { bubbles: true }));
    });
    assert.equal(overlay().style.display, "none");
  });
});

describe("pGrid event delegation — popup แกลเลอรีสินค้าแนะนำ (data-action=gallery)", () => {
  beforeEach(() => { mod.renderProducts(); });

  test("คลิกที่รูปสินค้า featured (มีรูป) → เปิด popup แกลเลอรีจริง พร้อมข้อมูลถูกต้อง", () => {
    card("prod-1").querySelector('.port-visual[data-action="gallery"]')
      .dispatchEvent(new Event("click", { bubbles: true }));
    assert.equal(galleryOverlay().style.display, "flex");
    assert.equal(field("ad-p-view-title").textContent, "ป้ายทางหนีไฟ");
    assert.equal(overlay().style.display, "none", "ไม่ใช่ฟอร์มแก้ไข — ต้องเป็น popup แกลเลอรีเท่านั้น");
  });

  test("สินค้าไม่มีรูปเลย → data-action ของ .port-visual เป็นค่าว่าง ไม่เปิด popup แกลเลอรี", () => {
    const visual = card("prod-2").querySelector(".port-visual");
    assert.equal(visual.getAttribute("data-action"), "");
    visual.dispatchEvent(new Event("click", { bubbles: true }));
    assert.equal(galleryOverlay().style.display, "none");
    // คลิกที่รูป (ไม่ใช่ปุ่ม/checkbox) ที่ไม่มี data-action="gallery" ยังคง bubble ไปเปิดฟอร์มแก้ไขตามปกติ
    assert.equal(overlay().style.display, "flex");
  });
});

describe("pGrid event delegation — ปุ่มดาว (ติดดาวสินค้าแนะนำ, แพทเทิร์นใหม่)", () => {
  beforeEach(() => { mod.renderProducts(); });

  test("คลิกดาวสินค้าที่ยังไม่ featured → saveProduct({featured:true}) (updateDoc) + toast สำเร็จ + reloadAll()", async () => {
    const btn = card("prod-2").querySelector('[data-action="star"]');
    btn.click();
    assert.equal(btn.disabled, true, "ปุ่มต้อง disable ทันทีแบบ synchronous");
    await flushMicrotasks();
    await flushMicrotasks();

    assert.equal(globalThis.__UPDATE_DOC_CALLS__.length, 1);
    assert.equal(globalThis.__UPDATE_DOC_CALLS__[0].path, "products/prod-2");
    assert.equal(globalThis.__UPDATE_DOC_CALLS__[0].payload.featured, true);
    const toastEls = document.querySelectorAll(".cp-toast-wrap .cp-toast.success");
    assert.match(toastEls[toastEls.length - 1].textContent, /ติดดาว "ป้ายจอดรถ" เป็นสินค้าแนะนำแล้ว/);
    assert.equal(globalThis.__AD_PAGE_STUB_RELOAD_ALL_CALLS__.length, 1);
  });

  test("คลิกดาวสินค้าที่ featured อยู่แล้ว → saveProduct({featured:false}) + ข้อความ toast คนละแบบ", async () => {
    const btn = card("prod-1").querySelector('[data-action="star"]');
    btn.click();
    await flushMicrotasks();
    await flushMicrotasks();

    assert.equal(globalThis.__UPDATE_DOC_CALLS__[0].payload.featured, false);
    const toastEls = document.querySelectorAll(".cp-toast-wrap .cp-toast.success");
    assert.match(toastEls[toastEls.length - 1].textContent, /เอา "ป้ายทางหนีไฟ" ออกจากสินค้าแนะนำแล้ว/);
  });

  test("payload ยังมีฟิลด์อื่นของสินค้าเดิมติดไปด้วย (name/code ไม่หาย)", async () => {
    card("prod-1").querySelector('[data-action="star"]').dispatchEvent(new Event("click", { bubbles: true }));
    await flushMicrotasks();
    await flushMicrotasks();
    assert.equal(globalThis.__UPDATE_DOC_CALLS__[0].payload.name, "ป้ายทางหนีไฟ");
    assert.equal(globalThis.__UPDATE_DOC_CALLS__[0].payload.code, "SG-001");
  });

  test("saveProduct() reject (updateDoc throw) → toast error พร้อมข้อความ err.message + ปุ่มกลับมา enabled, ไม่เรียก reloadAll()", async () => {
    globalThis.__UPDATE_DOC_STUB__ = () => ({ throw: new Error("เครือข่ายขัดข้อง") });
    const btn = card("prod-1").querySelector('[data-action="star"]');
    btn.click();
    await flushMicrotasks();
    await flushMicrotasks();

    assert.equal(btn.disabled, false);
    const errToast = document.querySelector(".cp-toast-wrap .cp-toast.error");
    assert.ok(errToast);
    assert.match(errToast.textContent, /อัปเดตไม่สำเร็จ: เครือข่ายขัดข้อง/);
    assert.equal(globalThis.__AD_PAGE_STUB_RELOAD_ALL_CALLS__.length, 0);
  });
});

describe("pGrid event delegation — ปุ่มลบ (deleteWithUndo)", () => {
  beforeEach(() => { mod.renderProducts(); });

  test("คลิกลบ → confirmDialog เปิดขึ้น ข้อความมีชื่อสินค้า", async () => {
    card("prod-1").querySelector('[data-action="delete"]').dispatchEvent(new Event("click", { bubbles: true }));
    await flushMicrotasks();
    const co = document.querySelector(".cp-confirm-overlay");
    assert.equal(co.style.display, "flex");
    assert.match(co.querySelector("#cp-confirm-msg").textContent, /ลบสินค้า "ป้ายทางหนีไฟ"/);
  });

  test("กด 'ยกเลิก' บน confirm → ไม่ลบ", async () => {
    card("prod-1").querySelector('[data-action="delete"]').dispatchEvent(new Event("click", { bubbles: true }));
    await flushMicrotasks();
    document.querySelector(".cp-confirm-overlay #cp-confirm-cancel").click();
    await flushMicrotasks();
    assert.deepEqual(globalThis.__DELETE_DOC_CALLS__, []);
    assert.equal(cards().length, 2);
  });

  test("ยืนยันแล้วกด 'เลิกทำ' บน undo toast → ไม่ลบจริง การ์ดกลับมาครบ", async () => {
    card("prod-1").querySelector('[data-action="delete"]').dispatchEvent(new Event("click", { bubbles: true }));
    await flushMicrotasks();
    document.querySelector("#cp-confirm-ok").click();
    await flushMicrotasks();
    assert.equal(cards().length, 1); // prod-1 หายไปชั่วคราว
    const undoBtn = document.querySelector(".cp-toast-undo-btn");
    assert.ok(undoBtn, "ต้องมี toast เลิกทำโผล่ขึ้นมา");
    undoBtn.click();
    await flushMicrotasks();
    assert.equal((globalThis.__DELETE_DOC_CALLS__ || []).length, 0);
    assert.equal(cards().length, 2, "กด 'เลิกทำ' แล้วการ์ดต้องกลับมาครบ");
  });

  test("ยืนยันลบ แล้วปล่อยผ่านจนหมดเวลา (5000ms) → deleteProduct() ถูกเรียกจริง + onCommitted = reloadAll()", async (t) => {
    const flushReal = () => new Promise((r) => setImmediate(r));
    t.mock.timers.enable({ apis: ["setTimeout"] });
    card("prod-1").querySelector('[data-action="delete"]').dispatchEvent(new Event("click", { bubbles: true }));
    await flushReal();
    document.querySelector("#cp-confirm-ok").click();
    await flushReal();
    t.mock.timers.tick(5000);
    await flushReal();
    await flushReal();
    assert.equal(globalThis.__DELETE_DOC_CALLS__.length, 1);
    assert.equal(globalThis.__DELETE_DOC_CALLS__[0].path, "products/prod-1");
    assert.equal(globalThis.__AD_PAGE_STUB_RELOAD_ALL_CALLS__.length, 1);
    t.mock.timers.reset();
  });
});

describe("bulk actions — checkbox เลือกการ์ด (ad-card-check)", () => {
  beforeEach(() => { mod.renderProducts(); });

  test("ติ๊กเลือกการ์ดเดียว: bulk bar ได้ class active, count เป็น 1", () => {
    selectCards(["prod-1"]);
    assert.equal(bulkBar().classList.contains("active"), true);
    assert.equal(bulkCount().textContent, "1");
  });

  test("ติ๊กแล้วเอาติ๊กออก: count กลับเป็น 0, bulk bar หมด active", () => {
    const cb = cardCheckbox("prod-2");
    cb.checked = true;
    cb.dispatchEvent(new Event("change", { bubbles: true }));
    assert.equal(bulkCount().textContent, "1");
    cb.checked = false;
    cb.dispatchEvent(new Event("change", { bubbles: true }));
    assert.equal(bulkCount().textContent, "0");
    assert.equal(bulkBar().classList.contains("active"), false);
  });

  test("ติ๊กหลายการ์ด: count นับรวมถูกต้อง", () => {
    selectCards(["prod-1", "prod-2"]);
    assert.equal(bulkCount().textContent, "2");
  });

  test("ติ๊กที่ไม่ใช่ .ad-card-check (change event อื่นใน grid) → ไม่พัง ไม่นับ", () => {
    assert.doesNotThrow(() => {
      grid().dispatchEvent(new Event("change", { bubbles: true }));
    });
    assert.equal(bulkCount().textContent, "0");
  });
});

describe("bulk actions — ปุ่ม 'ล้างการเลือก' (ad-p-bulk-clear)", () => {
  test("เลือกไว้แล้วกดล้าง: selection ว่างทั้งหมด, checkbox ทุกการ์ดเอาติ๊กออก, bulk bar หมด active", () => {
    mod.renderProducts();
    selectCards(["prod-1", "prod-2"]);
    assert.equal(bulkCount().textContent, "2");

    document.getElementById("ad-p-bulk-clear").click();

    assert.equal(bulkCount().textContent, "0");
    assert.equal(bulkBar().classList.contains("active"), false);
    assert.equal(cardCheckbox("prod-1").checked, false);
    assert.equal(cardCheckbox("prod-2").checked, false);
  });
});

describe("bulk actions — ปุ่ม 'เปลี่ยนสถานะ' (ad-p-bulk-apply-status)", () => {
  beforeEach(() => { mod.renderProducts(); });

  test("ไม่ได้เลือกสถานะเลย (select ว่าง) → ไม่ทำอะไร (early return)", async () => {
    selectCards(["prod-1"]);
    field("ad-p-bulk-status-select").value = "";
    document.getElementById("ad-p-bulk-apply-status").click();
    await flushMicrotasks();
    assert.equal((globalThis.__UPDATE_DOC_CALLS__ || []).length, 0);
  });

  test("ไม่มีการ์ดถูกเลือกเลย → ไม่ทำอะไร แม้เลือกสถานะไว้แล้ว (early return)", async () => {
    field("ad-p-bulk-status-select").value = "hidden";
    document.getElementById("ad-p-bulk-apply-status").click();
    await flushMicrotasks();
    assert.equal((globalThis.__UPDATE_DOC_CALLS__ || []).length, 0);
  });

  test("เลือก 2 การ์ดแล้วเปลี่ยนสถานะ → saveProduct() (updateDoc) ถูกเรียกครบทุกรายการด้วย status ใหม่, เคลียร์ selection, reset select, toast สำเร็จ, reloadAll()", async () => {
    selectCards(["prod-1", "prod-2"]);
    field("ad-p-bulk-status-select").value = "hidden";
    const btn = document.getElementById("ad-p-bulk-apply-status");
    btn.click();
    await flushMicrotasks();
    await flushMicrotasks();

    assert.equal(globalThis.__UPDATE_DOC_CALLS__.length, 2);
    const paths = globalThis.__UPDATE_DOC_CALLS__.map(c => c.path).sort();
    assert.deepEqual(paths, ["products/prod-1", "products/prod-2"]);
    globalThis.__UPDATE_DOC_CALLS__.forEach(c => assert.equal(c.payload.status, "hidden"));
    const p1Call = globalThis.__UPDATE_DOC_CALLS__.find(c => c.path === "products/prod-1");
    assert.equal(p1Call.payload.name, "ป้ายทางหนีไฟ"); // ฟิลด์อื่นของสินค้าเดิมยังติดไปด้วย

    assert.equal(bulkCount().textContent, "0");
    assert.equal(field("ad-p-bulk-status-select").value, "");
    assert.equal(btn.disabled, false);
    const toastEls = document.querySelectorAll(".cp-toast-wrap .cp-toast.success");
    assert.equal(toastEls.length >= 1, true);
    assert.equal(toastEls[toastEls.length - 1].textContent, "เปลี่ยนสถานะแล้ว 2 รายการ");
    assert.equal(globalThis.__AD_PAGE_STUB_RELOAD_ALL_CALLS__.length, 1);
  });

  test("ปุ่มถูก disable ระหว่างทำงาน", async () => {
    selectCards(["prod-1"]);
    field("ad-p-bulk-status-select").value = "hidden";
    const btn = document.getElementById("ad-p-bulk-apply-status");
    btn.click();
    assert.equal(btn.disabled, true);
    await flushMicrotasks();
    await flushMicrotasks();
    assert.equal(btn.disabled, false);
  });

  test("การ์ดที่เลือกไว้ไม่พบใน allProducts อีกแล้ว (ถูกลบไปก่อนหน้า) → ข้ามเงียบๆ ไม่ throw ไม่เรียก saveProduct สำหรับ id นั้น", async () => {
    selectCards(["prod-1", "prod-2"]);
    setAllProducts([SAMPLE_PRODUCTS[0]]); // prod-2 หายไปจาก allProducts แต่ selection ยังค้าง
    field("ad-p-bulk-status-select").value = "hidden";
    document.getElementById("ad-p-bulk-apply-status").click();
    await flushMicrotasks();
    await flushMicrotasks();
    assert.equal(globalThis.__UPDATE_DOC_CALLS__.length, 1);
    assert.equal(globalThis.__UPDATE_DOC_CALLS__[0].path, "products/prod-1");
  });

  test("saveProduct() reject บางรายการ (updateDoc throw) → toast error พร้อม err.message, ปุ่มกลับมา enabled", async () => {
    globalThis.__UPDATE_DOC_STUB__ = () => ({ throw: new Error("บันทึกล้มเหลว") });
    selectCards(["prod-1"]);
    field("ad-p-bulk-status-select").value = "hidden";
    const btn = document.getElementById("ad-p-bulk-apply-status");
    btn.click();
    await flushMicrotasks();
    await flushMicrotasks();

    assert.equal(btn.disabled, false);
    const errToast = document.querySelector(".cp-toast-wrap .cp-toast.error");
    assert.ok(errToast);
    assert.match(errToast.textContent, /อัปเดตสถานะไม่สำเร็จ: บันทึกล้มเหลว/);
    assert.equal(globalThis.__AD_PAGE_STUB_RELOAD_ALL_CALLS__.length, 0);
  });
});

describe("bulk actions — ปุ่ม 'ลบที่เลือก' (ad-p-bulk-delete)", () => {
  beforeEach(() => { mod.renderProducts(); });

  test("ไม่มีการ์ดไหนถูกเลือกเลย: กดแล้วไม่เปิด confirmDialog เลย (early return)", () => {
    document.getElementById("ad-p-bulk-delete").click();
    const co = document.querySelector(".cp-confirm-overlay");
    if (co) assert.notEqual(co.style.display, "flex");
    assert.deepEqual(globalThis.__DELETE_DOC_CALLS__, []);
  });

  test("เลือก 2 การ์ดแล้วกดลบ, กด 'ยกเลิก' บน confirm → ไม่เรียก deleteProduct() เลย, selection คงอยู่", async () => {
    selectCards(["prod-1", "prod-2"]);
    document.getElementById("ad-p-bulk-delete").click();
    await flushMicrotasks();
    const co = document.querySelector(".cp-confirm-overlay");
    assert.equal(co.style.display, "flex");
    assert.match(co.querySelector("#cp-confirm-msg").textContent, /ลบสินค้าที่เลือก 2 รายการ/);
    co.querySelector("#cp-confirm-cancel").click();
    await flushMicrotasks();

    assert.deepEqual(globalThis.__DELETE_DOC_CALLS__, []);
    assert.equal(bulkCount().textContent, "2");
  });

  test("เลือก 2 การ์ดแล้วกดลบ, กด 'ยืนยัน': เรียก deleteProduct() ครบทั้ง 2 รายการทันที (ไม่มี undo), เคลียร์ selection, ปุ่มกลับมา enabled, toast สำเร็จ, reloadAll()", async () => {
    selectCards(["prod-1", "prod-2"]);
    const btn = document.getElementById("ad-p-bulk-delete");
    btn.click();
    await flushMicrotasks();
    document.querySelector(".cp-confirm-overlay #cp-confirm-ok").click();
    await flushMicrotasks();
    await flushMicrotasks();

    assert.equal(globalThis.__DELETE_DOC_CALLS__.length, 2);
    const paths = globalThis.__DELETE_DOC_CALLS__.map(c => c.path).sort();
    assert.deepEqual(paths, ["products/prod-1", "products/prod-2"]);
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

describe("pAddBtn", () => {
  test("คลิกเพิ่มสินค้า → เปิดโมดัลโหมดเพิ่ม (openProductModal(null))", () => {
    field("ad-p-add-btn").click();
    assert.equal(overlay().style.display, "flex");
    assert.equal(field("ad-p-id").value, "");
    assert.equal(field("ad-p-name").value, "");
  });
});
