// test/admin-products-variant-table.test.mjs
//
// ขอบเขต: js/admin-products-variant-table.js (172 บรรทัด) — คู่กับ
// js/admin-products-variants.js (เทสไว้แล้วรอบก่อนใน test/admin-products-variants.test.mjs) —
// ไฟล์นี้เป็นส่วน "ตัวสร้างชุดค่าผสม" (renderVariantBuilder/addManualVariantRow/
// fillAllCombinations — ปุ่มเลือกค่าจากแต่ละหมวดแล้วกด "เพิ่มชุดค่าผสม"/"สร้างครบทุกชุด") +
// "ตารางราคา" (renderVariantTable — คัดลอกราคาจากแถวบน/ลบแถว/แก้ราคา)
//
// state (currentAxes/currentVariants) อยู่ที่ js/admin-products-variants.js — ไฟล์นี้ import
// แบบ live binding แล้ว mutate ผ่าน .push()/.splice() เท่านั้น (ดู comment หัวไฟล์จริง) — เทสนี้
// จึงตั้งค่าฉากผ่าน mod ของทั้ง 2 ไฟล์ร่วมกัน (import ทั้งคู่ผ่าน jsdom จริง ไม่ mock เพราะ import
// graph เดิมไม่แตะ Firestore ที่ module-evaluate time — เหมือนเหตุผลในเทสไฟล์คู่กัน)
//
// ตรวจโค้ดจริงทั้งไฟล์ก่อนเขียนเทสนี้ (172 บรรทัด อ่านครบ) — ไม่พบบั๊ก เป็นไฟล์เทสล้วนๆ
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
let modVariants; // js/admin-products-variants.js exports (state + clearVariants)
let modTable;    // js/admin-products-variant-table.js exports (renderVariantBuilder/renderVariantTable)

before(async () => {
  const dom = new JSDOM(`<!doctype html><html><body>${ADMIN_BODY_NO_SCRIPTS}</body></html>`);
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
  globalThis.Event = dom.window.Event;
  document = dom.window.document;

  modVariants = await import("../js/admin-products-variants.js");
  modTable = await import("../js/admin-products-variant-table.js");
});

function builderBox() { return document.getElementById("ad-p-variant-builder"); }
function tableBox() { return document.getElementById("ad-p-variant-table"); }
function variantLabel() { return document.getElementById("ad-p-variant-label"); }
function lastToastMsg() {
  const toasts = document.querySelectorAll(".cp-toast-wrap .cp-toast");
  return toasts.length ? toasts[toasts.length - 1].textContent : null;
}

// ตั้งฉาก: หมวด "ขนาด" (เล็ก/ใหญ่) — ใช้ซ้ำหลายเทส
function setupOneAxisTwoOptions() {
  modVariants.clearVariants();
  modVariants.currentAxes.push({
    id: "ax-size", label: "ขนาด",
    options: [{ id: "opt-s", code: "S", label: "เล็ก" }, { id: "opt-l", code: "L", label: "ใหญ่" }],
  });
}

// ตั้งฉาก 2 หมวด (ขนาด × เกรด) สำหรับเทส fillAllCombinations — cartesian 2×2 = 4 ชุด
function setupTwoAxes() {
  modVariants.clearVariants();
  modVariants.currentAxes.push({
    id: "ax-size", label: "ขนาด",
    options: [{ id: "opt-s", code: "S", label: "เล็ก" }, { id: "opt-l", code: "L", label: "ใหญ่" }],
  });
  modVariants.currentAxes.push({
    id: "ax-grade", label: "เกรด",
    options: [{ id: "opt-c", code: "C", label: "Commercial" }, { id: "opt-e", code: "E", label: "Engineer" }],
  });
}

beforeEach(() => {
  modVariants.clearVariants();
  document.querySelectorAll(".cp-toast-wrap .cp-toast").forEach(el => el.remove());
});

describe("renderVariantBuilder()", () => {
  test("ไม่มีหมวดที่มีค่าเลย → กล่องตัวสร้างชุดค่าผสมว่างเปล่า", () => {
    modVariants.clearVariants(); // เรียก renderAxes() → renderVariantBuilder() อยู่แล้วในตัว
    assert.equal(builderBox().innerHTML, "");
  });

  test("มีหมวด 1 หมวด → มี select ตัวเดียว + ปุ่มเพิ่มชุดค่าผสม + ปุ่มสร้างครบทุกชุด (แสดงจำนวนถูกต้อง)", () => {
    setupOneAxisTwoOptions();
    modTable.renderVariantBuilder();
    assert.equal(builderBox().querySelectorAll(".ad-vb-select").length, 1);
    assert.ok(builderBox().querySelector("#ad-p-vb-add"));
    const fillallBtn = builderBox().querySelector("#ad-p-vb-fillall");
    assert.match(fillallBtn.textContent, /2 ชุดรวม/); // มี 2 ตัวเลือก (เล็ก/ใหญ่) ในหมวดเดียว
  });

  test("2 หมวด × 2 ค่า → ปุ่ม fillall แสดง cartesian count = 4 ชุดรวม", () => {
    setupTwoAxes();
    modTable.renderVariantBuilder();
    const fillallBtn = builderBox().querySelector("#ad-p-vb-fillall");
    assert.match(fillallBtn.textContent, /4 ชุดรวม/);
  });
});

describe("addManualVariantRow() — ปุ่ม \"+ เพิ่มชุดค่าผสม\"", () => {
  test("ยังเลือกค่าไม่ครบทุกหมวด → แจ้งเตือน ไม่เพิ่มแถว", () => {
    setupOneAxisTwoOptions();
    modTable.renderVariantBuilder();
    builderBox().querySelector("#ad-p-vb-add").dispatchEvent(new window.Event("click", { bubbles: true, cancelable: true }));
    assert.equal(modVariants.currentVariants.length, 0);
    assert.match(lastToastMsg() || "", /กรุณาเลือกค่าให้ครบ/);
  });

  test("เลือกค่าครบแล้วกดเพิ่ม → currentVariants มี 1 แถวใหม่ พร้อม parts ถูกต้อง", () => {
    setupOneAxisTwoOptions();
    modTable.renderVariantBuilder();
    const select = builderBox().querySelector(".ad-vb-select");
    select.value = "opt-s";
    builderBox().querySelector("#ad-p-vb-add").dispatchEvent(new window.Event("click", { bubbles: true, cancelable: true }));
    assert.equal(modVariants.currentVariants.length, 1);
    assert.equal(modVariants.currentVariants[0].parts[0].code, "S");
    assert.equal(modVariants.currentVariants[0].price, "");
  });

  test("เพิ่มชุดค่าผสมที่มีอยู่แล้วซ้ำ → แจ้งเตือน ไม่เพิ่มแถวซ้ำ (currentVariants ยังมีแค่ 1 แถวเท่าเดิม)", () => {
    setupOneAxisTwoOptions();
    modVariants.currentVariants.push({ key: "opt-s", parts: [{ axisId: "ax-size", optId: "opt-s", code: "S", label: "เล็ก" }], price: 100 });
    modTable.renderVariantBuilder();
    const select = builderBox().querySelector(".ad-vb-select");
    select.value = "opt-s";
    builderBox().querySelector("#ad-p-vb-add").dispatchEvent(new window.Event("click", { bubbles: true, cancelable: true }));
    assert.equal(modVariants.currentVariants.length, 1); // ไม่เพิ่มซ้ำ
    assert.match(lastToastMsg() || "", /มีอยู่ในตารางราคาแล้ว/);
  });
});

describe("fillAllCombinations() — ปุ่ม \"สร้างครบทุกชุดที่ยังไม่มี\"", () => {
  test("2 หมวด × 2 ค่า ไม่มีแถวเลย → เพิ่มครบ 4 ชุด พร้อมข้อความแจ้งจำนวนที่เพิ่ม", () => {
    setupTwoAxes();
    modTable.renderVariantBuilder();
    builderBox().querySelector("#ad-p-vb-fillall").dispatchEvent(new window.Event("click", { bubbles: true, cancelable: true }));
    assert.equal(modVariants.currentVariants.length, 4);
    assert.match(lastToastMsg() || "", /เพิ่ม 4 ชุดค่าผสม/);
  });

  test("กดซ้ำรอบสอง (ครบอยู่แล้ว) → ไม่เพิ่มแถวเพิ่ม และแจ้งว่าครบแล้ว", () => {
    setupTwoAxes();
    modTable.renderVariantBuilder();
    builderBox().querySelector("#ad-p-vb-fillall").dispatchEvent(new window.Event("click", { bubbles: true, cancelable: true }));
    builderBox().querySelector("#ad-p-vb-fillall").dispatchEvent(new window.Event("click", { bubbles: true, cancelable: true }));
    assert.equal(modVariants.currentVariants.length, 4); // ไม่เพิ่มซ้ำ
    assert.match(lastToastMsg() || "", /มีครบทุกชุดค่าผสมในตารางแล้ว/);
  });

  test("มีแถวอยู่แล้วบางส่วน (1 จาก 4) → เพิ่มเฉพาะที่ยังไม่มี (3 ชุดที่เหลือ) ไม่แตะแถวเดิม", () => {
    setupTwoAxes();
    modVariants.currentVariants.push({
      key: "opt-s|opt-c",
      parts: [
        { axisId: "ax-size", optId: "opt-s", code: "S", label: "เล็ก" },
        { axisId: "ax-grade", optId: "opt-c", code: "C", label: "Commercial" },
      ],
      price: 999, // ราคาที่ตั้งใจกรอกไว้แล้ว — ต้องไม่ถูกแตะ
    });
    modTable.renderVariantBuilder();
    builderBox().querySelector("#ad-p-vb-fillall").dispatchEvent(new window.Event("click", { bubbles: true, cancelable: true }));
    assert.equal(modVariants.currentVariants.length, 4);
    const existing = modVariants.currentVariants.find(v => v.key === "opt-s|opt-c");
    assert.equal(existing.price, 999); // แถวเดิมไม่ถูกแตะ
    assert.match(lastToastMsg() || "", /เพิ่ม 3 ชุดค่าผสม/);
  });
});

describe("renderVariantTable()", () => {
  test("ไม่มีหมวดที่มีค่าเลย → ซ่อน label และล้างตารางว่าง", () => {
    modVariants.clearVariants();
    assert.equal(variantLabel().style.display, "none");
    assert.equal(tableBox().innerHTML, "");
  });

  test("มีหมวดแล้วแต่ยังไม่มีแถวราคา → แสดง label + ข้อความ empty-state", () => {
    setupOneAxisTwoOptions();
    modTable.renderVariantTable();
    assert.equal(variantLabel().style.display, "");
    assert.match(tableBox().innerHTML, /ยังไม่มีแถวราคา/);
  });

  test("มีแถวราคาแล้ว → render ตาราง พร้อมจำนวนชุดค่าผสมใน label และ SKU/ค่าตัวเลือกถูกต้อง", () => {
    setupOneAxisTwoOptions();
    modVariants.currentVariants.push({ key: "opt-s", parts: [{ axisId: "ax-size", optId: "opt-s", code: "S", label: "เล็ก" }], price: 150 });
    modTable.renderVariantTable();
    assert.match(variantLabel().textContent, /1 ชุดค่าผสม/);
    assert.match(tableBox().innerHTML, /ad-variant-sku">S</);
    assert.match(tableBox().innerHTML, />เล็ก</);
    const priceInput = tableBox().querySelector(".ad-variant-price-input");
    assert.equal(priceInput.value, "150");
  });

  test("แถวแรก (index 0) ไม่มีปุ่มคัดลอกราคา แต่แถวถัดไปมี", () => {
    setupOneAxisTwoOptions();
    modVariants.currentVariants.push({ key: "opt-s", parts: [{ axisId: "ax-size", optId: "opt-s", code: "S", label: "เล็ก" }], price: 100 });
    modVariants.currentVariants.push({ key: "opt-l", parts: [{ axisId: "ax-size", optId: "opt-l", code: "L", label: "ใหญ่" }], price: 200 });
    modTable.renderVariantTable();
    const copyBtns = tableBox().querySelectorAll(".ad-variant-copy-btn");
    assert.equal(copyBtns.length, 1); // มีแค่แถวที่ 2 (idx 1)
    assert.equal(copyBtns[0].dataset.variantIdx, "1");
  });
});

describe("แถวราคา: คัดลอก/ลบ/แก้ไข", () => {
  beforeEach(() => {
    setupOneAxisTwoOptions();
    modVariants.currentVariants.push({ key: "opt-s", parts: [{ axisId: "ax-size", optId: "opt-s", code: "S", label: "เล็ก" }], price: 100 });
    modVariants.currentVariants.push({ key: "opt-l", parts: [{ axisId: "ax-size", optId: "opt-l", code: "L", label: "ใหญ่" }], price: "" });
    modTable.renderVariantTable();
  });

  test("คลิกปุ่มคัดลอกราคา (↓) → ราคาของแถวปัจจุบันเปลี่ยนเป็นราคาของแถวบน", () => {
    const copyBtn = tableBox().querySelector(".ad-variant-copy-btn");
    copyBtn.dispatchEvent(new window.Event("click", { bubbles: true, cancelable: true }));
    assert.equal(modVariants.currentVariants[1].price, 100);
  });

  test("คลิกปุ่มลบแถว (×) → แถวนั้นถูกลบออกจาก currentVariants และ DOM re-render", () => {
    const delBtns = tableBox().querySelectorAll(".ad-variant-del-btn");
    delBtns[0].dispatchEvent(new window.Event("click", { bubbles: true, cancelable: true })); // ลบแถวแรก (เล็ก)
    assert.equal(modVariants.currentVariants.length, 1);
    assert.equal(modVariants.currentVariants[0].parts[0].code, "L");
  });

  test("พิมพ์ราคาใหม่ในช่อง input → currentVariants[idx].price อัปเดตเป็นตัวเลข", () => {
    const priceInput = tableBox().querySelectorAll(".ad-variant-price-input")[1];
    priceInput.value = "250";
    priceInput.dispatchEvent(new window.Event("input", { bubbles: true, cancelable: true }));
    assert.equal(modVariants.currentVariants[1].price, 250);
  });

  test("ลบราคาออกจนช่องว่าง → price กลายเป็น string ว่างเปล่า (ไม่ใช่ NaN/0)", () => {
    const priceInput = tableBox().querySelectorAll(".ad-variant-price-input")[0];
    priceInput.value = "";
    priceInput.dispatchEvent(new window.Event("input", { bubbles: true, cancelable: true }));
    assert.equal(modVariants.currentVariants[0].price, "");
  });
});
