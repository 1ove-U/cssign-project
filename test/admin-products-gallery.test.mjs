// test/admin-products-gallery.test.mjs — รอบที่ 118
//
// ขอบเขต: js/admin-products-gallery.js (66 บรรทัด) — popup แกลเลอรีสินค้าแนะนำ (featured) เปิดจาก
// การคลิกรูปสินค้าที่ติดดาว "แนะนำ" ในกริดของแท็บสินค้า — openProductGalleryPopup(item) (จุดเรียก
// เข้าเดียวที่ export ออกไป — เติม badge/หมวดหมู่/ชื่อ/รายละเอียด/ราคา-วัสดุ-ขนาด/thumbnail ทั้งหมด,
// เปิด overlay), setPViewImage(idx) (private — สลับรูปหลักเมื่อคลิก thumbnail), ปุ่มปิด/backdrop,
// ปุ่มแก้ไข → closeProductGalleryPopup() แล้ว openProductModal(pViewItem) (import จริงจาก
// admin-products-form.js — ไม่ stub เพราะไฟล์นั้นมีเทสของตัวเองแล้วตั้งแต่ก่อนหน้า)
//
// ไฟล์นี้ไม่ import "./admin-page.js" หรือ "./admin-state.js" ตรงๆ เลย แต่ import
// openProductModal จาก "./admin-products-form.js" ซึ่งไฟล์นั้น import { reloadAll } จาก
// "./admin-page.js" ที่ระดับบนสุดของมันเอง — "admin-products-form" อยู่ใน ALLOWED_PARENT_RE ของ
// test/helpers/admin-page-stub-loader.mjs อยู่แล้ว (ลงทะเบียนอัตโนมัติผ่าน register-loader.mjs
// ทุกไฟล์เทส) จึงไม่ต้องแก้/เพิ่มอะไรในนั้นเลยรอบนี้ — stub ทำงานเพราะ parentURL ตรงกับ
// admin-products-form.js ไม่ใช่ไฟล์นี้เอง (ไฟล์นี้เองไม่เคย import "./admin-page.js" ตรงๆ)
//
// openProductModal() ของ admin-products-form.js ต้องมี allCategories.length > 0 ถึงจะเปิดโมดัลได้
// จริง (ไม่งั้น showToast() เตือนแล้ว return) — import setAllCategories จาก admin-state.js มาตั้ง
// ค่าตัวอย่างไว้ก่อนกลุ่มเทสที่ต้องเปิดฟอร์มแก้ไขจริง (imgUrl/imgLabel/catName ใน
// admin-utils.js ก็อ่าน allCategories จากโมดูลเดียวกันนี้ — ใช้ตัวจริงร่วมกันทั้งหมด)
//
// ตรวจโค้ดจริงทั้งไฟล์ js/admin-products-gallery.js ก่อนเขียนเทสนี้ (อ่านครบ) — ไม่พบบั๊ก จึงเป็น
// ไฟล์เทสล้วนๆ ไม่มีการแก้โค้ดผลิตภัณฑ์เลยแม้แต่บรรทัดเดียว

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
let mod;              // admin-products-gallery.js exports
let setAllCategories;

const SAMPLE_CATS = [{ id: "c-1", name: "ป้ายไฟ LED" }];

const ITEM_MULTI_IMG = {
  id: "p-1",
  name: "ป้ายไฟ LED รุ่นพรีเมียม",
  cat_id: "c-1",
  description: "ป้ายไฟคุณภาพสูง ทนแดดทนฝน",
  price: 1500,
  unit: "ชิ้น",
  material: "อะคริลิค",
  size: "60x30 ซม.",
  images: [
    { url: "https://img.example.com/1.jpg", label: "มุมหน้า" },
    { url: "https://img.example.com/2.jpg", label: "มุมข้าง" },
    { url: "https://img.example.com/3.jpg", label: "" },
  ],
};

function overlay() { return document.getElementById("ad-p-view-overlay"); }
function field(id) { return document.getElementById(id); }
function thumbs() { return Array.from(document.getElementById("ad-p-view-thumbs").querySelectorAll(".ad-pf-view-thumb")); }

before(async () => {
  const dom = new JSDOM(`<!doctype html><html><body>${ADMIN_BODY_NO_SCRIPTS}</body></html>`);
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
  globalThis.Event = dom.window.Event;
  document = dom.window.document;

  mod = await import("../js/admin-products-gallery.js");
  ({ setAllCategories } = await import("../js/admin-state.js"));
});

beforeEach(() => {
  setAllCategories(SAMPLE_CATS.map((c) => ({ ...c })));
  if (overlay().style.display === "flex") overlay().style.display = "none";
  document.body.classList.remove("cp-scroll-locked");
  document.querySelectorAll(".cp-toast-wrap .cp-toast").forEach((el) => el.remove());
});

describe("openProductGalleryPopup() — เติมข้อมูลครบ + เปิด overlay", () => {
  test("สินค้าหลายรูป → badge/หมวดหมู่/ชื่อ/รายละเอียดถูกต้อง, overlay เปิด", () => {
    mod.openProductGalleryPopup(ITEM_MULTI_IMG);
    assert.equal(overlay().style.display, "flex");
    assert.equal(field("ad-p-view-badge").textContent, "ป้ายไฟ LED");
    assert.equal(field("ad-p-view-cat").textContent, "ป้ายไฟ LED");
    assert.equal(field("ad-p-view-title").textContent, "ป้ายไฟ LED รุ่นพรีเมียม");
    assert.equal(field("ad-p-view-desc").textContent, "ป้ายไฟคุณภาพสูง ทนแดดทนฝน");
    assert.equal(field("ad-p-view-desc").style.display, "");
  });

  test("ราคามีค่า + มี unit → meta แสดงราคาฟอร์แมตแบบไทยพร้อมหน่วย, material, size", () => {
    mod.openProductGalleryPopup(ITEM_MULTI_IMG);
    const meta = field("ad-p-view-meta").innerHTML;
    assert.match(meta, /฿1,500 \/ ชิ้น/);
    assert.match(meta, /<span>อะคริลิค<\/span>/);
    assert.match(meta, /<span>60x30 ซม\.<\/span>/);
  });

  test("ไม่มีราคา (price falsy) → meta ใช้ข้อความ 'สอบถามราคา' แทน", () => {
    mod.openProductGalleryPopup({ ...ITEM_MULTI_IMG, price: 0 });
    assert.match(field("ad-p-view-meta").innerHTML, /สอบถามราคา/);
  });

  test("ไม่มี description → ซ่อนกล่องรายละเอียด (style.display = 'none')", () => {
    mod.openProductGalleryPopup({ ...ITEM_MULTI_IMG, description: "" });
    assert.equal(field("ad-p-view-desc").style.display, "none");
  });

  test("ไม่มีชื่อสินค้า → title fallback เป็น 'ไม่มีชื่อ'", () => {
    mod.openProductGalleryPopup({ ...ITEM_MULTI_IMG, name: "" });
    assert.equal(field("ad-p-view-title").textContent, "ไม่มีชื่อ");
  });

  test("cat_id ไม่ตรงกับหมวดหมู่ไหนเลย → badge/cat fallback เป็น 'ไม่มีหมวดหมู่' (จาก catName())", () => {
    mod.openProductGalleryPopup({ ...ITEM_MULTI_IMG, cat_id: "ไม่มีจริง" });
    assert.equal(field("ad-p-view-badge").textContent, "ไม่มีหมวดหมู่");
  });

  test("escape HTML ใน material/size กัน XSS (ผ่าน escapeHtml ใน meta)", () => {
    mod.openProductGalleryPopup({ ...ITEM_MULTI_IMG, material: "<b>x</b>" });
    const meta = field("ad-p-view-meta").innerHTML;
    assert.doesNotMatch(meta, /<b>x<\/b>/);
    assert.match(meta, /&lt;b&gt;x&lt;\/b&gt;/);
  });
});

describe("thumbnail — render + สลับรูปหลัก", () => {
  test("สินค้ามีมากกว่า 1 รูป → render thumbnail ครบ, รูปแรก active, รูปหลักตรงกับรูปแรก", () => {
    mod.openProductGalleryPopup(ITEM_MULTI_IMG);
    const ts = thumbs();
    assert.equal(ts.length, 3);
    assert.ok(ts[0].classList.contains("active"));
    assert.ok(!ts[1].classList.contains("active"));
    assert.equal(field("ad-p-view-img").src, "https://img.example.com/1.jpg");
  });

  test("รูปแรกไม่มี label → alt fallback เป็นชื่อสินค้าเฉยๆ", () => {
    mod.openProductGalleryPopup({
      ...ITEM_MULTI_IMG,
      images: [{ url: "https://img.example.com/nolabel.jpg", label: "" }, ...ITEM_MULTI_IMG.images],
    });
    assert.equal(field("ad-p-view-img").alt, "ป้ายไฟ LED รุ่นพรีเมียม");
  });

  test("รูปที่มี label → alt ใช้ label ตรงๆ (ไม่ผูกชื่อสินค้าด้วย — เป็น fallback แบบ || ไม่ใช่ concat)", () => {
    mod.openProductGalleryPopup(ITEM_MULTI_IMG);
    assert.equal(field("ad-p-view-img").alt, "มุมหน้า");
  });

  test("คลิก thumbnail รูปที่ 2 → รูปหลักเปลี่ยน, active สลับไปรูปที่ 2", () => {
    mod.openProductGalleryPopup(ITEM_MULTI_IMG);
    thumbs()[1].dispatchEvent(new Event("click", { bubbles: true }));
    assert.equal(field("ad-p-view-img").src, "https://img.example.com/2.jpg");
    assert.equal(field("ad-p-view-img").alt, "มุมข้าง");
    const ts = thumbs();
    assert.ok(!ts[0].classList.contains("active"));
    assert.ok(ts[1].classList.contains("active"));
  });

  test("สินค้ามีรูปเดียว → ไม่ render thumbnail แถบเลย (thumbs ว่าง) แต่รูปหลักยังแสดง", () => {
    mod.openProductGalleryPopup({ ...ITEM_MULTI_IMG, images: [{ url: "https://img.example.com/only.jpg", label: "" }] });
    assert.equal(thumbs().length, 0);
    assert.equal(field("ad-p-view-img").src, "https://img.example.com/only.jpg");
  });

  test("images ว่างเปล่า/undefined → ไม่ throw, รูปหลัก src/alt ว่างเปล่า, ไม่มี thumbnail", () => {
    assert.doesNotThrow(() => mod.openProductGalleryPopup({ ...ITEM_MULTI_IMG, images: undefined }));
    assert.equal(field("ad-p-view-img").src, "");
    assert.equal(field("ad-p-view-img").alt, "");
    assert.equal(thumbs().length, 0);
  });

  test("รูปที่ไม่มี url (imgUrl คืนค่าว่าง) ถูกกรองออกจาก pViewImages ตั้งแต่ต้น", () => {
    mod.openProductGalleryPopup({
      ...ITEM_MULTI_IMG,
      images: [{ url: "", label: "ไม่มีรูปจริง" }, { url: "https://img.example.com/real.jpg", label: "" }],
    });
    // เหลือรูปเดียวหลังกรอง → ไม่มี thumbnail แถบ (เงื่อนไข length > 1)
    assert.equal(thumbs().length, 0);
    assert.equal(field("ad-p-view-img").src, "https://img.example.com/real.jpg");
  });
});

describe("ปิด popup — ปุ่มปิด / คลิก backdrop", () => {
  beforeEach(() => { mod.openProductGalleryPopup(ITEM_MULTI_IMG); });

  test("ปุ่มปิด (ad-p-view-close) → ปิด overlay", () => {
    field("ad-p-view-close").click();
    assert.equal(overlay().style.display, "none");
  });

  test("คลิก backdrop (target === overlay เอง) → ปิด overlay", () => {
    overlay().dispatchEvent(new Event("click", { bubbles: true, cancelable: true }));
    assert.equal(overlay().style.display, "none");
  });

  test("คลิกข้างในกล่อง popup (target ไม่ใช่ overlay เอง) → ไม่ปิด", () => {
    field("ad-p-view-title").dispatchEvent(new Event("click", { bubbles: true, cancelable: true }));
    assert.equal(overlay().style.display, "flex");
  });
});

describe("ปุ่มแก้ไข (ad-p-view-edit) — ปิด popup แล้วเปิดฟอร์มแก้ไขสินค้าจริง", () => {
  test("มีหมวดหมู่อยู่แล้ว → ปิด gallery popup, เปิดฟอร์มสินค้า (ad-p-overlay) พร้อมข้อมูลเดิม", () => {
    mod.openProductGalleryPopup(ITEM_MULTI_IMG);
    field("ad-p-view-edit").click();
    assert.equal(overlay().style.display, "none", "gallery popup ต้องปิด");
    assert.equal(field("ad-p-overlay").style.display, "flex", "ฟอร์มแก้ไขสินค้าต้องเปิด");
    assert.equal(field("ad-p-id").value, "p-1");
    assert.equal(field("ad-p-name").value, "ป้ายไฟ LED รุ่นพรีเมียม");
    field("ad-p-overlay").style.display = "none"; // เก็บกวาดไม่ให้ค้างข้ามเทส
  });

  test("ไม่มีหมวดหมู่เลยในระบบ → openProductModal() เตือนด้วย showToast แล้วไม่เปิดฟอร์ม", () => {
    setAllCategories([]);
    mod.openProductGalleryPopup(ITEM_MULTI_IMG);
    field("ad-p-view-edit").click();
    assert.equal(overlay().style.display, "none", "gallery popup ยังปิดตามปกติ (closeProductGalleryPopup ทำงานก่อนเสมอ)");
    assert.equal(field("ad-p-overlay").style.display, "none", "ฟอร์มสินค้าต้องไม่เปิดเพราะไม่มีหมวดหมู่");
    const toast = document.querySelector(".cp-toast-wrap .cp-toast");
    assert.ok(toast, "ต้องมี toast เตือน");
    assert.match(toast.textContent, /กรุณาเพิ่มหมวดหมู่สินค้า/);
  });
});
