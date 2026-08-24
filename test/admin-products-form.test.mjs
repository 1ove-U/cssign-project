// test/admin-products-form.test.mjs — รอบที่ 107
//
// ขอบเขต: js/admin-products-form.js (~150 บรรทัด) — ฟอร์มเพิ่ม/แก้ไขสินค้า (โมดัล) แยกออกมาจาก
// js/admin-products.js — openProductModal()/openProductModalClone()/closeProductModal(),
// รูปภาพสินค้าที่กำลังแก้ไข (currentImages + ปุ่มลบรูป/แก้ป้ายกำกับ), ตัวนับตัวอักษร meta
// title/desc, submit handler → validateFormInline() + getCleanVariantsPayload() (จาก
// admin-products-variants.js) + กันสินค้า slug ซ้ำ + saveProduct()
//
// เหมือน test/admin-portfolio-form.test.mjs (รอบ 106): import { reloadAll } from
// "./admin-page.js" ตรงๆ ที่ระดับบนสุด ต้องพึ่ง test/helpers/admin-page-stub-loader.mjs
// (ขยาย regex เพิ่มไฟล์นี้แล้วในรอบนี้ — ดูคอมเมนต์ในไฟล์นั้น)
//
// import js/admin-products-variants.js ตรงๆ (ไม่ mock) เพราะเป็นไฟล์จริงที่ไม่แตะ Firestore
// top-level เลย (มีเทสคลุมแยกอยู่แล้วที่ test/admin-products-variants.test.mjs รอบ 104) — เรียก
// mod อื่น (clearVariants()) ก่อนทุกเทสเพื่อรีเซ็ต currentAxes/currentVariants module-level state
// ให้ว่างเสมอ (เทสไฟล์นี้ไม่ได้ตั้งใจคลุม logic ของตัวเลือกสินค้าเอง แค่ยืนยันว่า
// getCleanVariantsPayload() ถูกเรียกและผลลัพธ์ถูกเอาไปประกอบ payload ถูกจุด)
//
// จุดที่ต้อง stub เพิ่มจากไฟล์เทสก่อนหน้า:
// - `HTMLElement.prototype.scrollIntoView` — jsdom ไม่ implement เอง (ตามหมายเหตุสะสมหลายไฟล์
//   เช่น test/orders-tab-modal-focus-trap.test.mjs) validateFormInline() เรียก field ที่ invalid
//   .scrollIntoView() ตอน submit ไม่ครบ ถ้าไม่ stub จะ throw ทันที
// - ต้องเรียก fillCategorySelects() เอง (import จาก admin-utils.js) ก่อนเทสที่เปิดฟอร์มจริง
//   เพราะ <select id="ad-p-cat"> ว่างเปล่าใน admin.html ดิบ (ปกติ admin-products.js เรียกฟังก์ชัน
//   นี้ตอนโหลดข้อมูล — ไฟล์เป้าหมายเทสนี้เองไม่ได้เรียก จึงต้องทำเองในเทสให้ตรงสภาพแวดล้อมจริง)
//
// ตรวจโค้ดจริงทั้งไฟล์ js/admin-products-form.js ก่อนเขียนเทสนี้ (อ่านครบ) — ไม่พบบั๊ก จึงเป็น
// ไฟล์เทสล้วนๆ ไม่มีการแก้โค้ดผลิตภัณฑ์เลยแม้แต่บรรทัดเดียว (นอกจาก test/helpers/*-loader.mjs
// ที่เป็นโครงสร้างพื้นฐานของเทส ไม่ใช่โค้ดผลิตภัณฑ์)

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
let mod;                 // admin-products-form.js exports
let variantsMod;         // admin-products-variants.js exports (แค่ใช้ clearVariants() รีเซ็ต)
let setAllProducts, setAllCategories, fillCategorySelects;

const SAMPLE_CATEGORIES = [
  { id: "cat-a", name: "ป้ายความปลอดภัย" },
  { id: "cat-b", name: "ป้ายจราจร" },
];

const SAMPLE_PRODUCT = {
  id: "prod-1",
  name: "ป้ายทางหนีไฟ",
  code: "SG-001",
  slug: "pai-thang-ni-fai",
  cat_id: "cat-b",
  status: "active",
  price: 250,
  unit: "แผ่น",
  material: "อลูมิเนียม",
  size: "30x40 ซม.",
  description: "ป้ายบอกทางหนีไฟมาตรฐาน",
  metaTitle: "ป้ายทางหนีไฟ SG-001",
  metaDescription: "ป้ายทางหนีไฟคุณภาพสูง",
  featured: true,
  images: ["https://res.cloudinary.com/x/image/upload/v1/paisign/products/a.jpg"],
  optionAxes: [],
  variants: [],
};

function field(id) { return document.getElementById(id); }
function overlay() { return document.getElementById("ad-p-overlay"); }

function resetFirebaseCalls() {
  globalThis.__ADD_DOC_CALLS__ = [];
  globalThis.__UPDATE_DOC_CALLS__ = [];
  globalThis.__DELETE_DOC_CALLS__ = [];
}

function resetSpies() {
  globalThis.__AD_PAGE_STUB_RELOAD_ALL_CALLS__ = [];
  globalThis.__AD_PAGE_STUB_RELOAD_ALL__ = (...args) => {
    globalThis.__AD_PAGE_STUB_RELOAD_ALL_CALLS__.push(args);
  };
}

before(async () => {
  const dom = new JSDOM(`<!doctype html><html><body>${ADMIN_BODY_NO_SCRIPTS}</body></html>`);
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
  globalThis.Event = dom.window.Event;
  dom.window.HTMLElement.prototype.scrollIntoView = function () {}; // jsdom ไม่ implement เอง
  document = dom.window.document;

  ({ setAllProducts, setAllCategories } = await import("../js/admin-state.js"));
  ({ fillCategorySelects } = await import("../js/admin-utils.js"));
  variantsMod = await import("../js/admin-products-variants.js");
  mod = await import("../js/admin-products-form.js");
});

beforeEach(() => {
  resetFirebaseCalls();
  resetSpies();
  setAllProducts([]);
  setAllCategories(SAMPLE_CATEGORIES);
  fillCategorySelects();
  variantsMod.clearVariants();
  const confirmOverlay = document.querySelector(".cp-confirm-overlay");
  if (confirmOverlay && confirmOverlay.style.display === "flex") {
    confirmOverlay.querySelector("#cp-confirm-cancel").click();
  }
  if (overlay().style.display === "flex") overlay().style.display = "none";
  document.querySelectorAll(".cp-toast-wrap .cp-toast").forEach(el => el.remove());
});

describe("openProductModal()", () => {
  test("allCategories ว่างเปล่า → เตือน toast และไม่เปิด modal เลย", () => {
    setAllCategories([]);
    mod.openProductModal(null);
    assert.equal(overlay().style.display, "none");
    assert.match(document.querySelector(".cp-toast.error")?.textContent || "", /เพิ่มหมวดหมู่สินค้าอย่างน้อย 1 หมวด/);
  });

  test("product = null (โหมดเพิ่ม) → ฟิลด์ว่างหมด, หมวดดีฟอลต์เป็นหมวดแรก, สถานะดีฟอลต์ active, ไม่มีรูป", () => {
    mod.openProductModal(null);
    assert.equal(field("ad-p-modal-title").textContent, "เพิ่มสินค้า");
    assert.equal(field("ad-p-id").value, "");
    assert.equal(field("ad-p-name").value, "");
    assert.equal(field("ad-p-cat").value, "cat-a"); // allCategories[0].id
    assert.equal(field("ad-p-status").value, "active");
    assert.equal(field("ad-p-featured").checked, false);
    assert.match(field("ad-p-images").innerHTML, /ยังไม่มีรูปภาพ/);
    assert.equal(overlay().style.display, "flex");
  });

  test("product ที่มีข้อมูลครบ (โหมดแก้ไข) → ทุกฟิลด์เติมค่าเดิม รวม normalizeImage() ให้รูป", () => {
    mod.openProductModal(SAMPLE_PRODUCT);
    assert.equal(field("ad-p-modal-title").textContent, "แก้ไขสินค้า");
    assert.equal(field("ad-p-id").value, "prod-1");
    assert.equal(field("ad-p-name").value, "ป้ายทางหนีไฟ");
    assert.equal(field("ad-p-code").value, "SG-001");
    assert.equal(field("ad-p-slug").value, "pai-thang-ni-fai");
    assert.equal(field("ad-p-cat").value, "cat-b");
    assert.equal(field("ad-p-price").value, "250");
    assert.equal(field("ad-p-unit").value, "แผ่น");
    assert.equal(field("ad-p-material").value, "อลูมิเนียม");
    assert.equal(field("ad-p-size").value, "30x40 ซม.");
    assert.equal(field("ad-p-desc").value, "ป้ายบอกทางหนีไฟมาตรฐาน");
    assert.equal(field("ad-p-meta-title").value, "ป้ายทางหนีไฟ SG-001");
    assert.equal(field("ad-p-meta-desc").value, "ป้ายทางหนีไฟคุณภาพสูง");
    assert.equal(field("ad-p-featured").checked, true);
    assert.equal(document.querySelectorAll("#ad-p-images .ad-img-item").length, 1);
  });

  test("มี slug/metaTitle เดิมอยู่แล้ว → เปิดฟอร์มมาที่แท็บ 'SEO ขั้นสูง' ให้เห็นทันที", () => {
    mod.openProductModal(SAMPLE_PRODUCT);
    const seoTabBtn = document.querySelector('#ad-p-form .cp-od-tab[data-od-tab="seo"]');
    const seoPanel = document.querySelector('#ad-p-form .cp-od-panel[data-od-panel="seo"]');
    assert.equal(seoTabBtn.classList.contains("active"), true);
    assert.equal(seoPanel.classList.contains("active"), true);
  });

  test("สินค้าใหม่ไม่มี slug/meta ใดๆ เลย → เปิดฟอร์มมาที่แท็บ 'ข้อมูลพื้นฐาน' ตามปกติ", () => {
    mod.openProductModal(null);
    const basicTabBtn = document.querySelector('#ad-p-form .cp-od-tab[data-od-tab="basic"]');
    const basicPanel = document.querySelector('#ad-p-form .cp-od-panel[data-od-panel="basic"]');
    assert.equal(basicTabBtn.classList.contains("active"), true);
    assert.equal(basicPanel.classList.contains("active"), true);
  });

  test("ตัวนับตัวอักษร meta title/desc อัปเดตทันทีตอนเปิดฟอร์ม (ผ่าน dispatch 'input' เอง)", () => {
    mod.openProductModal(SAMPLE_PRODUCT);
    assert.equal(field("ad-p-meta-title-count").textContent, "19 / 70"); // ความยาวข้อความจริง
    assert.equal(field("ad-p-meta-desc-count").textContent, "21 / 160");
  });
});

describe("openProductModalClone()", () => {
  test("เปิดฟอร์มแบบ 'เพิ่ม' พร้อมข้อมูลเดิม แต่ id/code/slug ถูกล้าง", () => {
    mod.openProductModalClone(SAMPLE_PRODUCT);
    assert.equal(field("ad-p-id").value, "");
    assert.equal(field("ad-p-code").value, "");
    assert.equal(field("ad-p-slug").value, "");
    assert.equal(field("ad-p-name").value, "ป้ายทางหนีไฟ"); // ข้อมูลอื่นยังกรอกไว้ให้
    assert.equal(field("ad-p-modal-title").textContent, 'ทำซ้ำสินค้าจาก "ป้ายทางหนีไฟ"');
    assert.equal(overlay().style.display, "flex");
  });
});

describe("ปุ่มลบรูป/แก้ป้ายกำกับ (#ad-p-images)", () => {
  test("ยืนยันลบรูป → ตัดออกจาก currentImages + re-render, deleteImage() no-op ไม่ throw", async () => {
    mod.openProductModal(SAMPLE_PRODUCT);
    assert.equal(document.querySelectorAll("#ad-p-images .ad-img-item").length, 1);
    field("ad-p-images").querySelector(".ad-img-remove").dispatchEvent(new Event("click", { bubbles: true }));
    await flushMicrotasks();
    document.querySelector("#cp-confirm-ok").click();
    await flushMicrotasks();
    assert.match(field("ad-p-images").innerHTML, /ยังไม่มีรูปภาพ/);
  });

  test("พิมพ์ป้ายกำกับรูป (.ad-img-tag-input) → currentImages[idx] ถูกอัปเดตเป็น {url,label} ใหม่ (สะท้อนผ่าน submit payload)", async () => {
    setAllProducts([]);
    mod.openProductModal(SAMPLE_PRODUCT);
    const tagInput = field("ad-p-images").querySelector(".ad-img-tag-input");
    tagInput.value = "รูปหน้าตึก";
    tagInput.dispatchEvent(new Event("input", { bubbles: true }));

    field("ad-p-form").dispatchEvent(new Event("submit", { cancelable: true }));
    await flushMicrotasks();
    await flushMicrotasks();

    assert.equal(globalThis.__UPDATE_DOC_CALLS__.length, 1);
    assert.deepEqual(globalThis.__UPDATE_DOC_CALLS__[0].payload.images, [
      { url: "https://res.cloudinary.com/x/image/upload/v1/paisign/products/a.jpg", label: "รูปหน้าตึก" },
    ]);
  });
});

describe("attachUnsavedGuard (ปุ่มยกเลิก/คลิกนอก modal)", () => {
  test("ยังไม่แก้ไขอะไร → ปุ่มยกเลิกปิดทันที ไม่ถาม confirmDialog", async () => {
    mod.openProductModal(SAMPLE_PRODUCT);
    field("ad-p-cancel").dispatchEvent(new Event("click", { bubbles: true }));
    await flushMicrotasks();
    assert.equal(overlay().style.display, "none");
    const confirmOverlay = document.querySelector(".cp-confirm-overlay");
    assert.notEqual(confirmOverlay && confirmOverlay.style.display, "flex");
  });

  test("แก้ไขฟิลด์แล้วกดยกเลิก แล้วยืนยัน 'ปิดโดยไม่บันทึก' → modal ปิดจริง + ฟอร์ม reset + variants ถูกเคลียร์", async () => {
    mod.openProductModal(SAMPLE_PRODUCT);
    field("ad-p-name").value = "ชื่อใหม่";
    field("ad-p-name").dispatchEvent(new Event("input", { bubbles: true }));

    field("ad-p-cancel").dispatchEvent(new Event("click", { bubbles: true }));
    await flushMicrotasks();
    document.querySelector("#cp-confirm-ok").click();
    await flushMicrotasks();

    assert.equal(overlay().style.display, "none");
    assert.equal(field("ad-p-name").value, "");
    assert.deepEqual(variantsMod.currentAxes, []);
  });
});

describe("submit ฟอร์ม", () => {
  test("ฟิลด์ required ว่าง (ชื่อสินค้า) → validateFormInline() บล็อก, ไม่เรียก saveProduct() เลย", async () => {
    mod.openProductModal(null);
    field("ad-p-name").value = ""; // ว่างไว้ตั้งใจ (required)
    field("ad-p-form").dispatchEvent(new Event("submit", { cancelable: true }));
    await flushMicrotasks();
    assert.equal((globalThis.__ADD_DOC_CALLS__ || []).length, 0);
    assert.equal(field("ad-p-name").classList.contains("cl-invalid"), true);
  });

  test("กรอกครบ โหมดเพิ่มใหม่ (ไม่มี slug กรอกเอง) → addDoc payload ถูกต้อง, slug auto-generate จากชื่อ, ปิด modal + reloadAll()", async () => {
    setAllProducts([]);
    mod.openProductModal(null);
    field("ad-p-name").value = "ป้ายเตือนอันตราย";
    field("ad-p-code").value = "SG-099";
    field("ad-p-cat").value = "cat-b";
    field("ad-p-price").value = "199";
    field("ad-p-unit").value = "แผ่น";

    field("ad-p-form").dispatchEvent(new Event("submit", { cancelable: true }));
    await flushMicrotasks();
    await flushMicrotasks();

    assert.equal(globalThis.__ADD_DOC_CALLS__.length, 1);
    const { path, payload } = globalThis.__ADD_DOC_CALLS__[0];
    assert.equal(path, "products");
    assert.equal(payload.name, "ป้ายเตือนอันตราย");
    assert.equal(payload.cat_id, "cat-b");
    assert.equal(payload.price, 199);
    assert.match(payload.slug, /ป้ายเตือนอันตราย|pai/); // slugify() รองรับตัวอักษรไทยตรงๆ (ดู admin-utils.js)
    assert.equal(payload.id, undefined);
    assert.equal(overlay().style.display, "none");
    assert.equal(globalThis.__AD_PAGE_STUB_RELOAD_ALL_CALLS__.length, 1);
  });

  test("โหมดแก้ไข (มี id) → updateDoc ที่ products/<id>, ไม่มี field id ปนใน payload", async () => {
    setAllProducts([SAMPLE_PRODUCT]);
    mod.openProductModal(SAMPLE_PRODUCT);
    field("ad-p-name").value = "ป้ายทางหนีไฟ (แก้ไข)";

    field("ad-p-form").dispatchEvent(new Event("submit", { cancelable: true }));
    await flushMicrotasks();
    await flushMicrotasks();

    assert.equal(globalThis.__UPDATE_DOC_CALLS__.length, 1);
    const { path, payload } = globalThis.__UPDATE_DOC_CALLS__[0];
    assert.equal(path, "products/prod-1");
    assert.equal(payload.name, "ป้ายทางหนีไฟ (แก้ไข)");
    assert.equal(payload.id, undefined);
  });

  test("slug ซ้ำกับสินค้าอื่นที่ id ไม่ตรงกัน → ไม่เรียก saveProduct() เลย + toast เตือน", async () => {
    setAllProducts([{ id: "other-id", slug: "pai-thang-ni-fai" }]);
    mod.openProductModal(null);
    field("ad-p-name").value = "สินค้าใหม่";
    field("ad-p-slug").value = "pai-thang-ni-fai"; // ชนกับ other-id ตรงๆ

    field("ad-p-form").dispatchEvent(new Event("submit", { cancelable: true }));
    await flushMicrotasks();

    assert.equal((globalThis.__ADD_DOC_CALLS__ || []).length, 0);
    assert.match(document.querySelector(".cp-toast.error")?.textContent || "", /slug นี้ถูกใช้กับสินค้าอื่นแล้ว/);
    assert.equal(overlay().style.display, "flex");
  });

  test("slug ซ้ำกับ 'ตัวเอง' (แก้ไขรายการเดิม ไม่เปลี่ยน slug) → ผ่านได้ปกติ ไม่ถือว่าซ้ำ", async () => {
    setAllProducts([SAMPLE_PRODUCT]); // slug เดียวกับตัวเอง id เดียวกัน
    mod.openProductModal(SAMPLE_PRODUCT);
    field("ad-p-form").dispatchEvent(new Event("submit", { cancelable: true }));
    await flushMicrotasks();
    await flushMicrotasks();
    assert.equal(globalThis.__UPDATE_DOC_CALLS__.length, 1);
  });

  test("ไม่กรอกราคาเอง + ไม่มีตัวเลือกสินค้า (autoPrice=null) → price ตกไปที่ 0 ถ้าช่องราคาว่างด้วย", async () => {
    setAllProducts([]);
    mod.openProductModal(null);
    field("ad-p-name").value = "สินค้าไม่มีราคา";
    field("ad-p-price").value = "";
    field("ad-p-form").dispatchEvent(new Event("submit", { cancelable: true }));
    await flushMicrotasks();
    await flushMicrotasks();
    assert.equal(globalThis.__ADD_DOC_CALLS__[0].payload.price, 0);
  });

  test("ปุ่ม submit ถูก disable + เปลี่ยนข้อความระหว่างบันทึก แล้วกลับมาปกติหลังเสร็จ", async () => {
    setAllProducts([]);
    mod.openProductModal(null);
    field("ad-p-name").value = "ทดสอบปุ่ม";
    const btn = field("ad-p-form").querySelector('button[type=submit]');
    assert.equal(btn.disabled, false);

    field("ad-p-form").dispatchEvent(new Event("submit", { cancelable: true }));
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
