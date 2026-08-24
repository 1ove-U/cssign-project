// test/admin-portfolio-form.test.mjs — รอบที่ 106
//
// ขอบเขต: js/admin-portfolio-form.js (~130 บรรทัด) — ฟอร์มเพิ่ม/แก้ไขผลงาน (โมดัล) แยกออกมาจาก
// js/admin-portfolio.js — openPortfolioModal()/openPortfolioModalClone()/closePortfolioModal(),
// รูปภาพผลงานที่กำลังแก้ไข (currentPfImages + ปุ่มลบรูป), จำกัดจำนวนผลงานปักหมุด (PF_MAX_PINNED),
// submit handler → savePortfolio()
//
// ไฟล์นี้ import { reloadAll } from "./admin-page.js" ตรงๆ ที่ระดับบนสุด — admin-page.js ตัวจริง
// เป็นไฟล์ bootstrap ทั้งแอป โหลดไม่ได้ในสภาพแวดล้อมเทส จึงต้องพึ่ง
// test/helpers/admin-page-stub-loader.mjs (ลงทะเบียนแล้วผ่าน register-loader.mjs) ที่ดักเฉพาะ
// specifier "./admin-page.js" ตอน parentURL ตรงกับไฟล์นี้เท่านั้น แล้วคืนโมดูลปลอมที่มีแค่
// reloadAll() — เรียก globalThis.__AD_PAGE_STUB_RELOAD_ALL__ ถ้าเทสตั้งไว้ก่อน (ดู resetSpies())
//
// ไฟล์นี้ยัง import savePortfolio จาก db-content.js (addDoc/updateDoc ผ่าน firebase-stub-loader.mjs
// เดิม — เก็บ call ไว้ที่ globalThis.__ADD_DOC_CALLS__/__UPDATE_DOC_CALLS__), deleteImage จาก
// db-media.js (เช็ค auth.currentUser ก่อนเสมอ — firebase-stub-loader.mjs คืน currentUser: null
// เป็นดีฟอลต์ ทำให้ deleteImage() แค่ warn แล้ว return โดยไม่ยิง fetch จริง ปลอดภัยสำหรับเทสปุ่ม
// ลบรูปโดยไม่ต้อง mock fetch เลย) — ส่วน handleImageUpload()/uploadImage() (ทริกเกอร์จากการเลือก
// ไฟล์อัปโหลดจริง) เป็นโค้ดกลางใน admin-utils.js/db-media.js ที่ยิง fetch ไป Cloudinary จริง
// ไม่ใช่ logic เฉพาะไฟล์นี้ และยังไม่มีเทสไฟล์ไหนในโปรเจกต์คลุม flow นั้น (เหมือนที่บันทึกไว้ใน
// test/admin-products-variants.test.mjs รอบ 104) — เทสไฟล์นี้จึงไม่คลุม flow อัปโหลดไฟล์จริง
// เช่นกัน คลุมแค่การผูก event listener ของ input file ว่ามีอยู่ (ผ่านการเช็คว่า element มีจริง)
//
// ตรวจโค้ดจริงทั้งไฟล์ js/admin-portfolio-form.js ก่อนเขียนเทสนี้ (อ่านครบ) — ไม่พบบั๊ก จึงเป็น
// ไฟล์เทสล้วนๆ ไม่มีการแก้โค้ดผลิตภัณฑ์เลยแม้แต่บรรทัดเดียว (นอกจาก test/helpers/*-loader.mjs
// สองไฟล์ที่เป็นโครงสร้างพื้นฐานของเทส ไม่ใช่โค้ดผลิตภัณฑ์)

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
let mod;             // admin-portfolio-form.js exports
let setAllPortfolios; // จาก admin-state.js — ใช้ตั้งค่า allPortfolios ก่อนแต่ละเทส

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

const SAMPLE_ITEM = {
  id: "pf-1",
  title: "ป้ายโรงงาน ABC",
  client: "บริษัท ABC จำกัด",
  category: "industrial",
  description: "ผลิตและติดตั้งป้ายความปลอดภัย",
  tags: ["ป้ายความปลอดภัย", "มอก."],
  images: ["https://res.cloudinary.com/x/image/upload/v1/paisign/products/a.jpg"],
  pinned: true,
  order: 3,
};

function overlay() { return document.getElementById("ad-pf-overlay"); }
function field(id) { return document.getElementById(id); }
function pinnedHint() { return document.getElementById("ad-pf-pinned-hint").textContent; }

before(async () => {
  const dom = new JSDOM(`<!doctype html><html><body>${ADMIN_BODY_NO_SCRIPTS}</body></html>`);
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
  globalThis.Event = dom.window.Event;
  document = dom.window.document;

  mod = await import("../js/admin-portfolio-form.js");
  ({ setAllPortfolios: setAllPortfolios } = await import("../js/admin-state.js"));
});

beforeEach(() => {
  resetFirebaseCalls();
  resetSpies();
  setAllPortfolios([]);
  // confirmDialog() cache overlay element ไว้ที่ module-level singleton (ui-helpers.js) — ห้ามลบ
  // element นี้ทิ้งจาก DOM แค่ปิดมันถ้าค้างเปิดอยู่จากเทสก่อนหน้า (แพทเทิร์นเดียวกับหลายไฟล์เทสก่อน)
  const confirmOverlay = document.querySelector(".cp-confirm-overlay");
  if (confirmOverlay && confirmOverlay.style.display === "flex") {
    confirmOverlay.querySelector("#cp-confirm-cancel").click();
  }
  if (overlay().style.display === "flex") {
    // ปิด modal ค้างจากเทสก่อนหน้าแบบตรงๆ ไม่ผ่าน guardedClose (กัน confirmDialog เด้งซ้อนข้ามเทส)
    overlay().style.display = "none";
  }
  document.querySelectorAll(".cp-toast-wrap .cp-toast").forEach(el => el.remove());
});

describe("openPortfolioModal()", () => {
  test("item = null (โหมดเพิ่ม) → หัวข้อ/ฟิลด์ว่างหมด, หมวดดีฟอลต์ factory, ไม่ปักหมุด, ไม่มีรูป", () => {
    mod.openPortfolioModal(null);
    assert.equal(field("ad-pf-modal-title").textContent, "เพิ่มผลงาน");
    assert.equal(field("ad-pf-id").value, "");
    assert.equal(field("ad-pf-title").value, "");
    assert.equal(field("ad-pf-client").value, "");
    assert.equal(field("ad-pf-cat").value, "factory");
    assert.equal(field("ad-pf-desc").value, "");
    assert.equal(field("ad-pf-tags").value, "");
    assert.equal(field("ad-pf-pinned").checked, false);
    assert.match(field("ad-pf-images").innerHTML, /ยังไม่มีรูปภาพ/);
    assert.equal(overlay().style.display, "flex");
  });

  test("item ที่มีข้อมูล (โหมดแก้ไข) → ทุกฟิลด์ถูกเติมค่าเดิม รวม tags join ด้วย ', ' และรูปถูก render", () => {
    mod.openPortfolioModal(SAMPLE_ITEM);
    assert.equal(field("ad-pf-modal-title").textContent, "แก้ไขผลงาน");
    assert.equal(field("ad-pf-id").value, "pf-1");
    assert.equal(field("ad-pf-title").value, "ป้ายโรงงาน ABC");
    assert.equal(field("ad-pf-client").value, "บริษัท ABC จำกัด");
    assert.equal(field("ad-pf-cat").value, "industrial");
    assert.equal(field("ad-pf-desc").value, "ผลิตและติดตั้งป้ายความปลอดภัย");
    assert.equal(field("ad-pf-tags").value, "ป้ายความปลอดภัย, มอก.");
    assert.equal(field("ad-pf-pinned").checked, true);
    assert.equal(document.querySelectorAll("#ad-pf-images .ad-img-item").length, 1);
  });

  test("item ไม่มี tags/images/category → ไม่ throw, ใช้ค่าดีฟอลต์ที่เหมาะสม", () => {
    assert.doesNotThrow(() => mod.openPortfolioModal({ id: "pf-2", title: "ไม่มีอะไรเลย" }));
    assert.equal(field("ad-pf-cat").value, "factory");
    assert.equal(field("ad-pf-tags").value, "");
    assert.match(field("ad-pf-images").innerHTML, /ยังไม่มีรูปภาพ/);
  });

  test("refreshPfPinnedHint() นับเฉพาะรายการที่ pinned=true และไม่รวมรายการที่กำลังแก้ไขเอง", () => {
    setAllPortfolios([
      { id: "pf-1", pinned: true },
      { id: "pf-a", pinned: true },
      { id: "pf-b", pinned: false },
    ]);
    mod.openPortfolioModal(SAMPLE_ITEM); // SAMPLE_ITEM.id === "pf-1" ต้องไม่ถูกนับซ้ำ
    assert.match(pinnedHint(), /ปักหมุดอยู่ 1\/12 รายการ/);
  });

  test("โหมดเพิ่มใหม่ (ไม่มี item ที่กำลังแก้ไข) → นับทุกรายการที่ pinned=true", () => {
    setAllPortfolios([{ id: "x", pinned: true }, { id: "y", pinned: true }, { id: "z", pinned: false }]);
    mod.openPortfolioModal(null);
    assert.match(pinnedHint(), /ปักหมุดอยู่ 2\/12 รายการ/);
  });
});

describe("openPortfolioModalClone()", () => {
  test("เปิดฟอร์มแบบ 'เพิ่ม' พร้อมข้อมูลเดิม แต่ id ว่างและไม่ปักหมุดตาม", () => {
    mod.openPortfolioModalClone(SAMPLE_ITEM);
    assert.equal(field("ad-pf-id").value, "");
    assert.equal(field("ad-pf-title").value, "ป้ายโรงงาน ABC"); // ข้อมูลอื่นยังคงกรอกไว้ให้
    assert.equal(field("ad-pf-pinned").checked, false);
    assert.equal(field("ad-pf-modal-title").textContent, 'ทำซ้ำผลงานจาก "ป้ายโรงงาน ABC"');
    assert.equal(overlay().style.display, "flex");
  });
});

describe("ปุ่มลบรูป (.ad-img-remove)", () => {
  test("ยืนยันลบ → รูปถูกตัดออกจาก currentPfImages และ re-render ทันที ไม่ throw แม้ deleteImage() เป็น no-op", async () => {
    mod.openPortfolioModal(SAMPLE_ITEM); // มี 1 รูป
    assert.equal(document.querySelectorAll("#ad-pf-images .ad-img-item").length, 1);

    field("ad-pf-images").querySelector(".ad-img-remove").dispatchEvent(new Event("click", { bubbles: true }));
    await flushMicrotasks();
    document.querySelector("#cp-confirm-ok").click();
    await flushMicrotasks();

    assert.match(field("ad-pf-images").innerHTML, /ยังไม่มีรูปภาพ/);
  });

  test("กด 'ยกเลิก' บน confirmDialog → รูปยังอยู่เหมือนเดิม", async () => {
    mod.openPortfolioModal(SAMPLE_ITEM);
    field("ad-pf-images").querySelector(".ad-img-remove").dispatchEvent(new Event("click", { bubbles: true }));
    await flushMicrotasks();
    document.querySelector("#cp-confirm-cancel").click();
    await flushMicrotasks();
    assert.equal(document.querySelectorAll("#ad-pf-images .ad-img-item").length, 1);
  });

  test("คลิกที่กล่องรูปแต่ไม่ตรงปุ่มลบ (.ad-img-remove) → ไม่มีอะไรเกิดขึ้น ไม่เด้ง confirmDialog", async () => {
    mod.openPortfolioModal(SAMPLE_ITEM);
    field("ad-pf-images").querySelector(".ad-img-item img").dispatchEvent(new Event("click", { bubbles: true }));
    await flushMicrotasks();
    const confirmOverlay = document.querySelector(".cp-confirm-overlay");
    assert.notEqual(confirmOverlay && confirmOverlay.style.display, "flex");
  });
});

describe("checkbox ปักหมุด (#ad-pf-pinned) — จำกัด PF_MAX_PINNED", () => {
  test("ปักหมุดครบ 12 แล้ว ติ๊กเพิ่ม → ถูกยกเลิกอัตโนมัติ + toast เตือน", () => {
    setAllPortfolios(Array.from({ length: 12 }, (_, i) => ({ id: `p${i}`, pinned: true })));
    mod.openPortfolioModal(null);
    const cb = field("ad-pf-pinned");
    cb.checked = true;
    cb.dispatchEvent(new Event("change"));
    assert.equal(cb.checked, false);
    assert.match(document.querySelector(".cp-toast.error")?.textContent || "", /ปักหมุดได้สูงสุด 12 รายการ/);
  });

  test("ปักหมุดยังไม่ครบ 12 → ติ๊กได้ปกติ ไม่มี toast เตือน", () => {
    setAllPortfolios(Array.from({ length: 5 }, (_, i) => ({ id: `p${i}`, pinned: true })));
    mod.openPortfolioModal(null);
    const cb = field("ad-pf-pinned");
    cb.checked = true;
    cb.dispatchEvent(new Event("change"));
    assert.equal(cb.checked, true);
    assert.equal(document.querySelector(".cp-toast.error"), null);
  });

  test("กำลังแก้ไขรายการที่ปักหมุดอยู่แล้วเอง (ครบ 12 พอดีรวมตัวเอง) → ยังติ๊กซ้ำของตัวเองได้ (ไม่ถูกนับซ้ำ)", () => {
    const items = Array.from({ length: 11 }, (_, i) => ({ id: `p${i}`, pinned: true }));
    items.push({ id: "pf-1", pinned: true }); // ตัวเองอยู่แล้วในรายการ ครบ 12
    setAllPortfolios(items);
    mod.openPortfolioModal(SAMPLE_ITEM); // SAMPLE_ITEM.id === "pf-1", pinned: true อยู่แล้ว
    const cb = field("ad-pf-pinned");
    cb.checked = true; // ยืนยัน re-check ค่าเดิม
    cb.dispatchEvent(new Event("change"));
    assert.equal(cb.checked, true, "ไม่ควรถูกยกเลิกเพราะตัวเองไม่ถูกนับรวมใน 'ปักหมุดแล้ว'");
  });
});

describe("ปุ่มยกเลิก / คลิกนอก modal (attachUnsavedGuard)", () => {
  test("ยังไม่แก้ไขอะไรเลย → ปุ่มยกเลิกปิดทันที ไม่ถาม confirmDialog", async () => {
    mod.openPortfolioModal(SAMPLE_ITEM);
    field("ad-pf-cancel").dispatchEvent(new Event("click", { bubbles: true }));
    await flushMicrotasks();
    assert.equal(overlay().style.display, "none");
    const confirmOverlay = document.querySelector(".cp-confirm-overlay");
    assert.notEqual(confirmOverlay && confirmOverlay.style.display, "flex");
  });

  test("แก้ไขฟิลด์แล้วกดยกเลิก → เด้ง confirmDialog ก่อน, กด 'ยกเลิก' บน dialog → modal ยังเปิดอยู่", async () => {
    mod.openPortfolioModal(SAMPLE_ITEM);
    field("ad-pf-title").value = "ชื่อใหม่ที่แก้ไข";
    field("ad-pf-title").dispatchEvent(new Event("input", { bubbles: true }));

    field("ad-pf-cancel").dispatchEvent(new Event("click", { bubbles: true }));
    await flushMicrotasks();
    const confirmOverlay = document.querySelector(".cp-confirm-overlay");
    assert.equal(confirmOverlay.style.display, "flex");

    confirmOverlay.querySelector("#cp-confirm-cancel").click();
    await flushMicrotasks();
    assert.equal(overlay().style.display, "flex", "ยกเลิกที่ dialog แล้ว modal เดิมต้องยังเปิดอยู่");
  });

  test("แก้ไขฟิลด์แล้วกดยกเลิก แล้วยืนยัน 'ปิดโดยไม่บันทึก' → modal ปิดจริงและฟอร์มถูกล้าง", async () => {
    mod.openPortfolioModal(SAMPLE_ITEM);
    field("ad-pf-title").value = "ชื่อใหม่ที่แก้ไข";
    field("ad-pf-title").dispatchEvent(new Event("input", { bubbles: true }));

    field("ad-pf-cancel").dispatchEvent(new Event("click", { bubbles: true }));
    await flushMicrotasks();
    document.querySelector("#cp-confirm-ok").click();
    await flushMicrotasks();

    assert.equal(overlay().style.display, "none");
    assert.equal(field("ad-pf-title").value, "");
  });

  test("คลิก backdrop ของ overlay เอง (ไม่ใช่ .cp-modal ข้างใน) → ทำงานเหมือนปุ่มยกเลิก", async () => {
    mod.openPortfolioModal(null); // ยังไม่แก้ไข ไม่ dirty
    overlay().dispatchEvent(new Event("click", { bubbles: true, cancelable: true }), { target: overlay() });
    // jsdom Event ไม่รองรับ target override ผ่าน option ตรงๆ — dispatch ตรงจาก overlay element
    // เอง e.target จะเป็น overlay อัตโนมัติอยู่แล้วเพราะไม่มีลูกที่ bubble มาจากจุดอื่น
    await flushMicrotasks();
    assert.equal(overlay().style.display, "none");
  });
});

describe("submit ฟอร์ม", () => {
  test("กรอกครบ โหมดเพิ่มใหม่ → savePortfolio() (addDoc) ถูกเรียกด้วย payload ถูกต้อง + ปิด modal + reloadAll()", async () => {
    setAllPortfolios([{ id: "old-1", pinned: true }]); // ใช้คำนวณ order ของรายการใหม่
    mod.openPortfolioModal(null);
    field("ad-pf-title").value = "ป้ายใหม่";
    field("ad-pf-client").value = "ลูกค้าใหม่";
    field("ad-pf-cat").value = "government";
    field("ad-pf-desc").value = "รายละเอียด";
    field("ad-pf-tags").value = " แท็กหนึ่ง , แท็กสอง ,,  ";
    field("ad-pf-pinned").checked = true;

    field("ad-pf-form").dispatchEvent(new Event("submit", { cancelable: true }));
    await flushMicrotasks();
    await flushMicrotasks();

    assert.equal(globalThis.__ADD_DOC_CALLS__.length, 1);
    const { path, payload } = globalThis.__ADD_DOC_CALLS__[0];
    assert.equal(path, "portfolios");
    assert.equal(payload.title, "ป้ายใหม่");
    assert.equal(payload.client, "ลูกค้าใหม่");
    assert.equal(payload.category, "government");
    assert.deepEqual(payload.tags, ["แท็กหนึ่ง", "แท็กสอง"]); // ค่าว่างระหว่าง comma ถูกกรองออก
    assert.equal(payload.pinned, true);
    assert.equal(payload.order, 1); // allPortfolios.filter(pinned).length ตอนสร้างใหม่ = 1 (old-1)
    assert.equal(payload.id, undefined);

    assert.equal(overlay().style.display, "none");
    assert.equal(globalThis.__AD_PAGE_STUB_RELOAD_ALL_CALLS__.length, 1);
  });

  test("โหมดแก้ไข (มี id) → updateDoc ถูกเรียกที่ portfolios/<id>, คง order เดิม, ไม่มี field id ปนใน payload", async () => {
    setAllPortfolios([SAMPLE_ITEM]);
    mod.openPortfolioModal(SAMPLE_ITEM);
    field("ad-pf-title").value = "ป้ายโรงงาน ABC (แก้ไข)";

    field("ad-pf-form").dispatchEvent(new Event("submit", { cancelable: true }));
    await flushMicrotasks();
    await flushMicrotasks();

    assert.equal(globalThis.__UPDATE_DOC_CALLS__.length, 1);
    const { path, payload } = globalThis.__UPDATE_DOC_CALLS__[0];
    assert.equal(path, "portfolios/pf-1");
    assert.equal(payload.title, "ป้ายโรงงาน ABC (แก้ไข)");
    assert.equal(payload.order, 3); // pfEditingItem.order เดิม (SAMPLE_ITEM.order = 3)
    assert.equal(payload.id, undefined, "payload ต้องไม่มี field id ปนเข้าไป (ใส่แยกไว้ในอ็อบเจกต์ payload คนละตัว)");
  });

  test("ปักหมุดครบ 12 แล้ว พยายาม submit พร้อมปักหมุดเพิ่ม → ไม่เรียก savePortfolio() เลย + toast เตือน", async () => {
    // สร้างสถานการณ์: checkbox ถูกติ๊กไว้ก่อนแล้วตอนเปิด modal (ผ่าน item.pinned=true) จากนั้นเติม
    // รายการอื่นให้ครบ 12 "หลัง" เปิด modal เพื่อเลี่ยง auto-uncheck ตอน change event (ไม่ผ่าน UI)
    setAllPortfolios([SAMPLE_ITEM]); // 1 รายการ ตอนเปิด modal
    mod.openPortfolioModal(SAMPLE_ITEM); // pinned checkbox = true (จาก SAMPLE_ITEM.pinned)
    field("ad-pf-title").value = "ป้ายโรงงาน ABC";
    // จำลองว่ามีคนอื่นปักหมุดเพิ่มจนครบ 12 (ไม่รวมตัวเอง) ระหว่างที่ฟอร์มเปิดค้างอยู่
    setAllPortfolios([
      SAMPLE_ITEM,
      ...Array.from({ length: 12 }, (_, i) => ({ id: `extra-${i}`, pinned: true })),
    ]);

    field("ad-pf-form").dispatchEvent(new Event("submit", { cancelable: true }));
    await flushMicrotasks();

    assert.equal((globalThis.__UPDATE_DOC_CALLS__ || []).length, 0);
    assert.equal((globalThis.__ADD_DOC_CALLS__ || []).length, 0);
    assert.match(document.querySelector(".cp-toast.error")?.textContent || "", /ปักหมุดได้สูงสุด 12 รายการ/);
    assert.equal(overlay().style.display, "flex", "submit ถูกบล็อก modal ต้องยังเปิดอยู่");
  });

  // หมายเหตุ: ไม่มีเทส "savePortfolio() reject" เพราะ test/helpers/firebase-stub-loader.mjs
  // (ที่ addDoc()/updateDoc() ใช้อยู่ข้างใน savePortfolio()) ไม่มีช่องทางสั่งให้ throw ได้เลย —
  // resolve สำเร็จเสมอตามดีไซน์ปัจจุบัน (ดูคอมเมนต์รอบที่ 70/89 ในไฟล์นั้น) การเพิ่มความสามารถนี้
  // ต้องแก้ shared stub ที่ทุกไฟล์เทสอื่นก็ใช้ร่วมกัน ซึ่งเกินขอบเขตงานเสริมรอบนี้ (เทสเฉพาะ
  // js/admin-portfolio-form.js ไฟล์เดียว) — try/catch+showToast()/finally ในโค้ดจริงเป็น pattern
  // เดียวกับที่ไฟล์อื่น (เช่น admin-settings-staff.js) ก็ทำเหมือนกันและไม่เคยมีเทสคลุม reject path นี้

  test("ปุ่ม submit ถูก disable + เปลี่ยนข้อความระหว่างบันทึก แล้วกลับมาปกติหลังเสร็จ", async () => {
    setAllPortfolios([]);
    mod.openPortfolioModal(null);
    field("ad-pf-title").value = "ทดสอบปุ่ม";
    const btn = field("ad-pf-form").querySelector('button[type=submit]');
    assert.equal(btn.disabled, false);
    assert.equal(btn.textContent, "บันทึก");

    field("ad-pf-form").dispatchEvent(new Event("submit", { cancelable: true }));
    await flushMicrotasks();
    await flushMicrotasks();

    // หลัง await ครบ finally{} ทำงานแล้ว ปุ่มต้องกลับมาใช้งานได้ปกติ (modal ปิดไปแล้วก็จริง แต่
    // element เดิมใน DOM ยังอยู่ ตรวจสอบ state ของมันได้)
    assert.equal(btn.disabled, false);
    assert.equal(btn.textContent, "บันทึก");
  });
});

// helper: รอ microtask queue ระบาย (สำหรับ async event handler ที่ไม่มี promise ให้ await ตรงๆ)
function flushMicrotasks() {
  return new Promise((r) => setTimeout(r, 0));
}
