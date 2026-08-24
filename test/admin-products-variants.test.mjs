// test/admin-products-variants.test.mjs
//
// ขอบเขต: js/admin-products-variants.js (275 บรรทัด) — "ตัวเลือกสินค้า" (option axes) +
// ตารางราคาชุดค่าผสม (variants) ที่แอดมินกำหนดเองต่อสินค้า (เช่น ขนาด × เกรด × วัสดุรองหลัง)
// เลือกไฟล์นี้เป็นไฟล์แรกในกลุ่ม admin-* business logic เพราะมี import graph แคบสุด (แค่
// admin-utils.js + admin-products-variant-table.js — ไม่ผ่าน admin-page.js เลย ต่างจาก
// admin-products.js/admin-leads.js/admin-overview-dashboard.js ที่พันกับ router กลาง) —
// import ทั้งไฟล์จริงผ่าน jsdom (ไม่ mock เพราะ chain ทั้งหมดไม่แตะ Firestore ที่ import
// boundary ระดับ top-level เลย — admin-utils.js import js/db.js ก็จริง แต่ logAudit()/
// uploadImage() ถูกเรียกใน handler อื่นที่เทสนี้ไม่ได้ทดสอบ ไม่ใช่ตอน module evaluate)
//
// ตรวจโค้ดจริงทั้งไฟล์ก่อนเขียนเทสนี้ (275 บรรทัด อ่านครบ) — ไม่พบบั๊ก เป็นไฟล์เทสล้วนๆ
// ไม่มีการแก้โค้ดผลิตภัณฑ์เลยแม้แต่บรรทัดเดียว

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
let mod; // admin-products-variants.js exports

before(async () => {
  const dom = new JSDOM(`<!doctype html><html><body>${ADMIN_BODY_NO_SCRIPTS}</body></html>`);
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
  globalThis.Event = dom.window.Event;
  document = dom.window.document;

  mod = await import("../js/admin-products-variants.js");
});

function axesBox() { return document.getElementById("ad-p-axes"); }
function addAxisBtn() { return document.getElementById("ad-p-axis-add"); }

beforeEach(() => {
  mod.clearVariants(); // รีเซ็ต currentAxes/currentVariants กลับว่างก่อนทุกเทส (เรียกผ่าน export จริง)
});

describe("ensureOptionCodes() — เติมรหัสอัตโนมัติ A, B, C, ... ให้ค่าที่ยังไม่มีรหัส", () => {
  test("ค่าที่ไม่มี code เลย → เติม A, B, C ตามลำดับ", () => {
    const axis = { options: [{ label: "เล็ก" }, { label: "กลาง" }, { label: "ใหญ่" }] };
    mod.ensureOptionCodes(axis);
    assert.deepEqual(axis.options.map(o => o.code), ["A", "B", "C"]);
  });

  test("ค่าที่มี code อยู่แล้ว → ไม่ถูกเปลี่ยน และรหัสอัตโนมัติต้องข้ามรหัสที่ถูกใช้ไปแล้ว", () => {
    const axis = { options: [{ label: "เล็ก", code: "B" }, { label: "กลาง" }, { label: "ใหญ่" }] };
    mod.ensureOptionCodes(axis);
    assert.equal(axis.options[0].code, "B"); // ไม่เปลี่ยนของเดิม
    assert.deepEqual(axis.options.slice(1).map(o => o.code), ["A", "C"]); // ข้าม B ที่ถูกจองแล้ว
  });

  test("ค่าที่ label ว่างเปล่า (trim แล้วว่าง) ถูกข้าม ไม่นับเป็นตัวใช้รหัส", () => {
    const axis = { options: [{ label: "   " }, { label: "จริง" }] };
    mod.ensureOptionCodes(axis);
    assert.equal(axis.options[0].code, undefined); // ไม่ถูกแตะเลย เพราะถูกกรองออกจาก opts ก่อน
    assert.equal(axis.options[1].code, "A");
  });

  test("code ที่พิมพ์เองเทียบแบบ case-insensitive (ตัวพิมพ์เล็ก 'a' กันไม่ให้ autofill ซ้ำ 'A')", () => {
    const axis = { options: [{ label: "เล็ก", code: "a" }, { label: "กลาง" }] };
    mod.ensureOptionCodes(axis);
    assert.equal(axis.options[1].code, "B"); // ไม่ใช่ A เพราะ "a" ถูกนับเป็น A แล้ว (used.add ด้วย toUpperCase)
  });
});

describe("axesWithOptionsList() — กรองเฉพาะหมวดที่มีค่าอย่างน้อย 1 ค่าที่ไม่ว่าง", () => {
  test("หมวดที่ทุกค่าว่างเปล่า (label เว้นวรรค) ถูกกรองออก", () => {
    mod.clearVariants();
    mod.currentAxes.push({ id: "ax1", label: "ว่าง", options: [{ id: "o1", label: "   " }] });
    mod.currentAxes.push({ id: "ax2", label: "มีค่า", options: [{ id: "o2", label: "จริง" }] });
    const result = mod.axesWithOptionsList();
    assert.equal(result.length, 1);
    assert.equal(result[0].id, "ax2");
  });
});

describe("initVariantsForProduct() / clearVariants() — โหลด/เคลียร์ข้อมูลกลับเข้าฟอร์ม", () => {
  test("product เป็น null → currentAxes/currentVariants ว่างเปล่าทั้งคู่", () => {
    mod.initVariantsForProduct(null);
    assert.deepEqual(mod.currentAxes, []);
    assert.deepEqual(mod.currentVariants, []);
  });

  test("product ไม่มี optionAxes/variants เลย → ว่างเปล่าเหมือนกัน (สินค้าเก่าที่ไม่เคยมีตัวเลือก)", () => {
    mod.initVariantsForProduct({ name: "ป้ายอะคริลิค" });
    assert.deepEqual(mod.currentAxes, []);
    assert.deepEqual(mod.currentVariants, []);
  });

  test("product มี optionAxes + variants ที่ codes จับคู่ได้ครบ → โหลดเข้า currentAxes/currentVariants ถูกต้อง", () => {
    mod.initVariantsForProduct({
      optionAxes: [
        { label: "ขนาด", options: [{ code: "S", label: "เล็ก" }, { code: "L", label: "ใหญ่" }] },
      ],
      variants: [
        { codes: ["S"], price: 100 },
        { codes: ["L"], price: 200 },
      ],
    });
    assert.equal(mod.currentAxes.length, 1);
    assert.equal(mod.currentAxes[0].label, "ขนาด");
    assert.equal(mod.currentVariants.length, 2);
    assert.equal(mod.currentVariants[0].price, 100);
    assert.equal(mod.currentVariants[1].parts[0].label, "ใหญ่");
  });

  test("variant ที่ code จับคู่กับ option ไม่ได้ (โครงสร้างหมวดเปลี่ยนไปจากตอนบันทึก) → ข้ามแถวนั้นไปเงียบๆ ไม่ throw", () => {
    mod.initVariantsForProduct({
      optionAxes: [{ label: "ขนาด", options: [{ code: "S", label: "เล็ก" }] }],
      variants: [{ codes: ["ZZZ-NOT-FOUND"], price: 999 }],
    });
    assert.equal(mod.currentVariants.length, 0); // แถวที่จับคู่ไม่ได้ถูกข้ามทั้งแถว
  });

  test("clearVariants() ล้าง currentAxes/currentVariants กลับเป็นค่าว่างเสมอ", () => {
    mod.initVariantsForProduct({
      optionAxes: [{ label: "ขนาด", options: [{ code: "S", label: "เล็ก" }] }],
      variants: [{ codes: ["S"], price: 100 }],
    });
    assert.ok(mod.currentAxes.length > 0);
    mod.clearVariants();
    assert.deepEqual(mod.currentAxes, []);
    assert.deepEqual(mod.currentVariants, []);
  });
});

describe("getCleanVariantsPayload() — คำนวณ payload พร้อมบันทึก Firestore ตอน submit ฟอร์ม", () => {
  test("ไม่มีตัวเลือกเลย → optionAxes/variants ว่างเปล่า, autoPrice เป็น null", () => {
    mod.clearVariants();
    const payload = mod.getCleanVariantsPayload();
    assert.deepEqual(payload.optionAxes, []);
    assert.deepEqual(payload.variants, []);
    assert.equal(payload.autoPrice, null);
  });

  test("หมวดที่ไม่มีชื่อ (label ว่าง) ถูกตัดออกจาก payload ทั้งหมวด", () => {
    mod.clearVariants();
    mod.currentAxes.push({ id: "ax1", label: "  ", options: [{ id: "o1", label: "ค่า A" }] });
    const payload = mod.getCleanVariantsPayload();
    assert.deepEqual(payload.optionAxes, []);
  });

  test("หมวดที่ไม่มีค่าที่กรอกจริงเลย (ทุก option label ว่าง) ถูกตัดออก แม้จะมีชื่อหมวด", () => {
    mod.clearVariants();
    mod.currentAxes.push({ id: "ax1", label: "ขนาด", options: [{ id: "o1", label: "   " }] });
    const payload = mod.getCleanVariantsPayload();
    assert.deepEqual(payload.optionAxes, []);
  });

  test("หมวด+ค่าครบถูกต้อง → payload มี optionAxes/variants/autoPrice ถูกต้อง (autoPrice = ราคาต่ำสุด)", () => {
    mod.clearVariants();
    mod.currentAxes.push({
      id: "ax1", label: "ขนาด",
      options: [{ id: "o1", label: "เล็ก" }, { id: "o2", label: "ใหญ่" }],
    });
    mod.currentVariants.push({ parts: [{ axisId: "ax1", optId: "o1", code: "A" }], price: 300 });
    mod.currentVariants.push({ parts: [{ axisId: "ax1", optId: "o2", code: "B" }], price: 150 });

    const payload = mod.getCleanVariantsPayload();
    assert.equal(payload.optionAxes.length, 1);
    assert.equal(payload.optionAxes[0].options.length, 2);
    assert.equal(payload.variants.length, 2);
    assert.equal(payload.autoPrice, 150); // ต่ำสุดของ [300, 150]
  });

  test("variant ที่จำนวน parts ไม่ตรงกับจำนวนหมวดที่เหลือ (เช่น หมวดถูกลบไปแล้วบางส่วน) ถูกตัดออกจาก payload", () => {
    mod.clearVariants();
    mod.currentAxes.push({ id: "ax1", label: "ขนาด", options: [{ id: "o1", label: "เล็ก" }] });
    // แถวนี้มี 2 parts แต่ cleanAxes มีแค่ 1 หมวด (mismatch) → ต้องถูกกรองออก
    mod.currentVariants.push({
      parts: [
        { axisId: "ax1", optId: "o1", code: "A" },
        { axisId: "ax-deleted", optId: "o-deleted", code: "X" },
      ],
      price: 500,
    });
    const payload = mod.getCleanVariantsPayload();
    assert.equal(payload.variants.length, 0);
  });

  test("ราคาที่ไม่ใช่ตัวเลข (พิมพ์ผิด/ว่าง) ถูกแปลงเป็น 0 ด้วย Number(...) || 0 ไม่ throw", () => {
    mod.clearVariants();
    mod.currentAxes.push({ id: "ax1", label: "ขนาด", options: [{ id: "o1", label: "เล็ก" }] });
    mod.currentVariants.push({ parts: [{ axisId: "ax1", optId: "o1", code: "A" }], price: "ไม่ใช่ตัวเลข" });
    const payload = mod.getCleanVariantsPayload();
    assert.equal(payload.variants[0].price, 0);
  });
});

describe("DOM: ปุ่ม \"เพิ่มหมวดตัวเลือก\" + renderAxes()", () => {
  test("คลิก #ad-p-axis-add → เพิ่มหมวดใหม่เข้า currentAxes และ render การ์ดหมวดใหม่ใน DOM", () => {
    mod.clearVariants();
    assert.equal(mod.currentAxes.length, 0);
    addAxisBtn().dispatchEvent(new window.Event("click", { bubbles: true, cancelable: true }));
    assert.equal(mod.currentAxes.length, 1);
    assert.equal(axesBox().querySelectorAll(".ad-axis-card").length, 1);
  });

  test("ไม่มีหมวดเลย → แสดงข้อความ empty-state แทนการ์ด", () => {
    mod.clearVariants();
    assert.match(axesBox().innerHTML, /ยังไม่มีตัวเลือกสินค้า/);
  });

  test("คลิกปุ่มลบหมวด (.ad-axis-remove) → หมวดถูกเอาออกจาก currentAxes และการ์ดหายจาก DOM", () => {
    mod.clearVariants();
    addAxisBtn().dispatchEvent(new window.Event("click", { bubbles: true, cancelable: true }));
    assert.equal(mod.currentAxes.length, 1);
    const removeBtn = axesBox().querySelector(".ad-axis-remove");
    removeBtn.dispatchEvent(new window.Event("click", { bubbles: true, cancelable: true }));
    assert.equal(mod.currentAxes.length, 0);
    assert.equal(axesBox().querySelectorAll(".ad-axis-card").length, 0);
  });

  test("มีหมวดที่มีค่าจริงแล้ว → ซ่อนช่องวัสดุ/ราคาแบบเดิม (legacy row) และ disable ช่องราคา", () => {
    mod.clearVariants();
    addAxisBtn().dispatchEvent(new window.Event("click", { bubbles: true, cancelable: true }));
    const labelInput = axesBox().querySelector(".ad-axis-label-input");
    labelInput.value = "ขนาด";
    labelInput.dispatchEvent(new window.Event("input", { bubbles: true, cancelable: true }));
    const optLabelInput = axesBox().querySelector(".ad-opt-label");
    optLabelInput.value = "เล็ก";
    optLabelInput.dispatchEvent(new window.Event("input", { bubbles: true, cancelable: true }));
    // การพิมพ์ (input event) ไม่เรียก renderAxes()/syncLegacyFieldsVisibility() ตั้งใจ (กัน
    // re-render ทั้งกล่องจนช่องพิมพ์เสีย focus) — ต้องมี event ที่เรียก renderAxes() จริง
    // (เช่นปุ่ม "+ เพิ่มค่า") ก่อนถึงจะเห็นผลอัปเดตที่ legacy row/ช่องราคา
    axesBox().querySelector(".ad-axis-option-add").dispatchEvent(new window.Event("click", { bubbles: true, cancelable: true }));

    assert.equal(document.getElementById("ad-p-legacy-row").style.display, "none");
    assert.equal(document.getElementById("ad-p-price").disabled, true);
  });
});
