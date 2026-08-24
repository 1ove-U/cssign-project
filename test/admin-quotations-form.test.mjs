// test/admin-quotations-form.test.mjs — P3.0 Phase 3 รอบย่อย 4 + 5
//
// ขอบเขต: js/admin-quotations-form.js — ฟอร์มสร้าง/แก้ไขใบเสนอราคา (modal, ไม่มี pagination) —
// เปิดฟอร์มเปล่า (openNewQuotationForm), เปิดฟอร์มแก้ไข prefill จากเอกสารเดิม
// (openEditQuotationForm), เปิดฟอร์ม "สร้างจากคำขอ" prefill จาก quote_request
// (openQuotationFormFromRequest, รอบย่อย 5), เพิ่ม/ลบแถวสินค้า, คำนวณ subtotal/VAT/grandTotal
// สดทั้ง 3 vatMode, submit เรียก addQuotation()/updateQuotation() ให้ถูกโหมด, validation
// พื้นฐาน (ต้องมีชื่อลูกค้า + อย่างน้อย 1 รายการที่มีชื่อสินค้า)
//
// db-quotations.js เรียก addDoc()/updateDoc() ผ่าน stub ธรรมดา (test/helpers/
// firebase-stub-loader.mjs) — capture ผ่าน globalThis.__ADD_DOC_CALLS__/__UPDATE_DOC_CALLS__
// เหมือน test อื่นๆ ทั้งโปรเจกต์ — addQuotation() เรียก generateQuoteNo() ก่อนเสมอ (runTransaction
// stub คืนค่า sequence ให้เรื่อยๆ ดู test/helpers/firebase-stub-loader.mjs) — ไม่ได้ mock
// generateQuoteNo() แยก เพราะ stub เดิมรองรับ runTransaction() อยู่แล้วตั้งแต่ db-quotations
// data layer รอบแรก
//
// P3.0 Phase 6 รอบ 10 (badge ใกล้หมดอายุ): เพิ่มช่องกรอกวันหมดอายุ (id="ad-q-valid-until",
// input type="date") ที่ไม่เคยมีในฟอร์มแอดมินมาก่อนเลย (ตรวจแล้วจริงด้วย grep — ฟิลด์ validUntil
// มีอยู่แล้วใน schema/js/db-quotations.js ตั้งแต่ก่อนหน้านี้ แต่ไม่มี UI ให้กรอก) — เทสรอบนี้เพิ่ม
// assertion การ prefill/submit ของฟิลด์นี้เข้าไปในเทสเดิมที่เกี่ยวข้อง (openNewQuotationForm/
// openEditQuotationForm/submit ทั้ง 2 โหมด) ไม่ได้แยก describe ใหม่ เพราะเป็นแค่ฟิลด์เดียวเพิ่มเข้า
// ฟอร์มเดิมที่มีเทสอยู่แล้ว

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
let mod; // admin-quotations-form.js exports

function resetFirebaseCalls() {
  globalThis.__ADD_DOC_CALLS__ = [];
  globalThis.__UPDATE_DOC_CALLS__ = [];
}

function overlay() { return document.getElementById("ad-q-overlay"); }
function field(id) { return document.getElementById(id); }
function itemRows() { return Array.from(document.getElementById("ad-q-items-body").querySelectorAll("tr[data-idx]")); }

function makeQuotation(overrides) {
  return {
    id: "q-1", quoteNo: "QT2026-0001",
    billingName: "บริษัท ทดสอบ จำกัด", contactPerson: "คุณสมชาย",
    phone: "0812345678", billingAddress: "123 ถนนทดสอบ",
    vatMode: "excluded", notes: "หมายเหตุเดิม", status: "sent",
    validUntil: "2026-09-30",
    items: [
      { name: "ป้ายไฟ LED", variantLabel: "สีแดง", qty: 2, unit: "ชิ้น", unitPrice: 1000, discount: 100 }
    ],
    ...overrides
  };
}

before(async () => {
  const dom = new JSDOM(`<!doctype html><html><body>${ADMIN_BODY_NO_SCRIPTS}</body></html>`, {
    url: "https://example.test/"
  });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
  globalThis.Event = dom.window.Event;
  document = dom.window.document;

  mod = await import("../js/admin-quotations-form.js");
});

beforeEach(() => {
  resetFirebaseCalls();
  if (overlay().style.display === "flex") overlay().style.display = "none";
  document.querySelectorAll(".cp-toast-wrap .cp-toast").forEach(el => el.remove());
});

describe("openNewQuotationForm()", () => {
  test("เปิดโมดัลเปล่า — ฟิลด์ลูกค้าว่าง, สถานะเริ่มต้น draft, มี 1 แถวสินค้าว่างเปล่า", () => {
    mod.openNewQuotationForm();
    assert.equal(overlay().style.display, "flex");
    assert.equal(field("ad-q-billing-name").value, "");
    assert.equal(field("ad-q-status").value, "draft");
    assert.equal(field("ad-q-vat-mode").value, "excluded");
    // วันหมดอายุ (P3.0 Phase 6) — เปิดฟอร์มเปล่าต้องว่าง ไม่ auto-fill ค่าเริ่มต้นใดๆ
    assert.equal(field("ad-q-valid-until").value, "");
    assert.equal(itemRows().length, 1);
    assert.equal(itemRows()[0].querySelector(".ad-q-item-name").value, "");
  });

  test("ยอดรวมท้ายฟอร์มเป็นศูนย์ทั้งหมดตอนเปิดฟอร์มเปล่า", () => {
    mod.openNewQuotationForm();
    assert.match(field("ad-q-subtotal").textContent, /0/);
    assert.match(field("ad-q-grandtotal").textContent, /0/);
  });
});

describe("openEditQuotationForm()", () => {
  test("prefill ฟิลด์ลูกค้า/สถานะ/vatMode/รายการสินค้าจากเอกสารเดิมครบทุกจุด", () => {
    mod.openEditQuotationForm(makeQuotation());
    assert.equal(field("ad-q-billing-name").value, "บริษัท ทดสอบ จำกัด");
    assert.equal(field("ad-q-contact-person").value, "คุณสมชาย");
    assert.equal(field("ad-q-phone").value, "0812345678");
    assert.equal(field("ad-q-billing-address").value, "123 ถนนทดสอบ");
    assert.equal(field("ad-q-status").value, "sent");
    assert.equal(field("ad-q-vat-mode").value, "excluded");
    // วันหมดอายุ (P3.0 Phase 6)
    assert.equal(field("ad-q-valid-until").value, "2026-09-30");
    assert.equal(field("ad-q-notes").value, "หมายเหตุเดิม");
    const rows = itemRows();
    assert.equal(rows.length, 1);
    assert.equal(rows[0].querySelector(".ad-q-item-name").value, "ป้ายไฟ LED");
    assert.equal(rows[0].querySelector(".ad-q-item-variant").value, "สีแดง");
    assert.equal(rows[0].querySelector(".ad-q-item-qty").value, "2");
    assert.equal(rows[0].querySelector(".ad-q-item-price").value, "1000");
    assert.equal(rows[0].querySelector(".ad-q-item-discount").value, "100");
  });

  test("หัวข้อโมดัลแสดงเลขที่เอกสารเดิม", () => {
    mod.openEditQuotationForm(makeQuotation());
    assert.match(field("ad-q-modal-title").textContent, /QT2026-0001/);
  });

  test("เอกสารไม่มี items เลย → ยังคง render แถวว่างเปล่า 1 แถวให้กรอก ไม่พัง", () => {
    assert.doesNotThrow(() => mod.openEditQuotationForm(makeQuotation({ items: [] })));
    assert.equal(itemRows().length, 1);
    assert.equal(itemRows()[0].querySelector(".ad-q-item-name").value, "");
  });
});

describe("แท็บในป๊อปอัพ (ข้อมูลลูกค้า/รายการสินค้า/สรุปยอด & หมายเหตุ)", () => {
  test("เปิดฟอร์มมาที่แท็บ 'ข้อมูลลูกค้า' เสมอ", () => {
    mod.openNewQuotationForm();
    const customerTabBtn = document.querySelector('#ad-q-form .cp-od-tab[data-od-tab="customer"]');
    const customerPanel = document.querySelector('#ad-q-form .cp-od-panel[data-od-panel="customer"]');
    assert.equal(customerTabBtn.classList.contains("active"), true);
    assert.equal(customerPanel.classList.contains("active"), true);
  });

  test("คลิกแท็บ 'รายการสินค้า' → สลับ panel/aria-selected ถูกต้อง", () => {
    mod.openNewQuotationForm();
    const itemsTabBtn = document.querySelector('#ad-q-form .cp-od-tab[data-od-tab="items"]');
    const itemsPanel = document.querySelector('#ad-q-form .cp-od-panel[data-od-panel="items"]');
    const customerTabBtn = document.querySelector('#ad-q-form .cp-od-tab[data-od-tab="customer"]');

    itemsTabBtn.dispatchEvent(new document.defaultView.Event("click", { bubbles: true }));

    assert.equal(itemsTabBtn.classList.contains("active"), true);
    assert.equal(itemsTabBtn.getAttribute("aria-selected"), "true");
    assert.equal(itemsPanel.classList.contains("active"), true);
    assert.equal(customerTabBtn.classList.contains("active"), false);
    assert.equal(customerTabBtn.getAttribute("aria-selected"), "false");
  });

  test("เปิดฟอร์มใหม่อีกครั้งหลังเคยอยู่แท็บอื่น → รีเซ็ตกลับไปแท็บ 'ข้อมูลลูกค้า' เสมอ", () => {
    mod.openNewQuotationForm();
    document.querySelector('#ad-q-form .cp-od-tab[data-od-tab="summary"]').dispatchEvent(new document.defaultView.Event("click", { bubbles: true }));
    assert.equal(document.querySelector('#ad-q-form .cp-od-panel[data-od-panel="summary"]').classList.contains("active"), true);

    mod.openEditQuotationForm(makeQuotation()); // เปิดใหม่ (ป๊อปอัพไม่ได้ถูกสร้างใหม่ แค่ toggle display)

    assert.equal(document.querySelector('#ad-q-form .cp-od-panel[data-od-panel="customer"]').classList.contains("active"), true);
    assert.equal(document.querySelector('#ad-q-form .cp-od-panel[data-od-panel="summary"]').classList.contains("active"), false);
  });
});

describe("เพิ่ม/ลบแถวรายการสินค้า", () => {
  test("กด 'เพิ่มรายการสินค้า' → เพิ่มแถวใหม่ว่างเปล่าต่อท้าย", () => {
    mod.openNewQuotationForm();
    document.getElementById("ad-q-add-item").click();
    assert.equal(itemRows().length, 2);
  });

  test("กดปุ่มลบแถว (เหลือมากกว่า 1 แถว) → ลบแถวนั้นออกจริง", () => {
    mod.openNewQuotationForm();
    document.getElementById("ad-q-add-item").click();
    assert.equal(itemRows().length, 2);
    itemRows()[0].querySelector(".ad-q-item-remove").click();
    assert.equal(itemRows().length, 1);
  });

  test("เหลือแถวเดียว → ปุ่มลบของแถวนั้นถูก disabled กันลบจนไม่เหลือแถวเลย", () => {
    mod.openNewQuotationForm();
    assert.equal(itemRows().length, 1);
    assert.equal(itemRows()[0].querySelector(".ad-q-item-remove").disabled, true);
  });
});

describe("คำนวณยอดรวมสด — ทั้ง 3 vatMode", () => {
  function fillFirstRow(qty, unitPrice, discount) {
    const row = itemRows()[0];
    row.querySelector(".ad-q-item-name").value = "สินค้าทดสอบ";
    row.querySelector(".ad-q-item-name").dispatchEvent(new document.defaultView.Event("input", { bubbles: true }));
    row.querySelector(".ad-q-item-qty").value = String(qty);
    row.querySelector(".ad-q-item-qty").dispatchEvent(new document.defaultView.Event("input", { bubbles: true }));
    row.querySelector(".ad-q-item-price").value = String(unitPrice);
    row.querySelector(".ad-q-item-price").dispatchEvent(new document.defaultView.Event("input", { bubbles: true }));
    row.querySelector(".ad-q-item-discount").value = String(discount);
    row.querySelector(".ad-q-item-discount").dispatchEvent(new document.defaultView.Event("input", { bubbles: true }));
  }

  test("vatMode=excluded (ไม่รวม VAT) — บวก VAT 7% เพิ่มเข้าไปเป็นยอดสุทธิ", () => {
    mod.openNewQuotationForm();
    field("ad-q-vat-mode").value = "excluded";
    fillFirstRow(2, 1000, 0); // subtotal = 2000
    assert.match(field("ad-q-subtotal").textContent, /2,000|2000/);
    assert.match(field("ad-q-vat").textContent, /140/); // 2000*0.07
    assert.match(field("ad-q-grandtotal").textContent, /2,140|2140/);
  });

  test("vatMode=included (รวม VAT แล้ว) — grandTotal เท่ากับ subtotal เดิม, แยก VAT ออกมาโชว์เฉยๆ", () => {
    mod.openNewQuotationForm();
    field("ad-q-vat-mode").value = "included";
    fillFirstRow(1, 1070, 0); // subtotal = 1070 (รวม VAT แล้ว)
    assert.match(field("ad-q-grandtotal").textContent, /1,070|1070/);
    assert.match(field("ad-q-vat").textContent, /70/);
  });

  test("vatMode=none (ไม่มี VAT) — vatAmount เป็น 0 เสมอ, grandTotal เท่ากับ subtotal", () => {
    mod.openNewQuotationForm();
    field("ad-q-vat-mode").value = "none";
    fillFirstRow(3, 500, 0); // subtotal = 1500
    assert.match(field("ad-q-vat").textContent, /^฿?0/);
    assert.match(field("ad-q-grandtotal").textContent, /1,500|1500/);
  });

  test("line total ต่อแถวอัปเดตสดตามช่อง qty/unitPrice/discount ที่พิมพ์", () => {
    mod.openNewQuotationForm();
    fillFirstRow(2, 100, 50); // lineTotal = 2*100-50 = 150
    assert.match(itemRows()[0].querySelector(".ad-q-item-linetotal").textContent, /150/);
  });

  test("เปลี่ยน vatMode ตอนมีแถวข้อมูลอยู่แล้ว → ยอดรวมท้ายฟอร์มอัปเดตทันทีโดยไม่ต้องพิมพ์แถวใหม่", () => {
    mod.openNewQuotationForm();
    fillFirstRow(1, 1000, 0);
    field("ad-q-vat-mode").value = "none";
    field("ad-q-vat-mode").dispatchEvent(new document.defaultView.Event("change", { bubbles: true }));
    assert.match(field("ad-q-vat").textContent, /^฿?0/);
  });
});

describe("openQuotationFormFromRequest() — prefill จาก quote_request (P3.0 Phase 3 รอบย่อย 5)", () => {
  function makeQuoteRequest(overrides) {
    return {
      id: "qr-1", billingName: "บริษัท คำขอ จำกัด", contactPerson: "คุณขอ",
      phone: "0899999999", billingAddress: "456 ถนนคำขอ",
      items: [{ name: "ป้ายอะคริลิค", variantLabel: "ใส", qty: 3, unit: "ชิ้น" }],
      notes: "หมายเหตุจากคำขอ",
      ...overrides
    };
  }

  test("prefill ข้อมูลลูกค้า/รายการสินค้าถูกต้อง — unitPrice/discount เริ่มที่ 0 เสมอ, สถานะเป็น draft, vatMode เป็น excluded", () => {
    mod.openQuotationFormFromRequest(makeQuoteRequest());
    assert.equal(overlay().style.display, "flex");
    assert.equal(field("ad-q-billing-name").value, "บริษัท คำขอ จำกัด");
    assert.equal(field("ad-q-contact-person").value, "คุณขอ");
    assert.equal(field("ad-q-phone").value, "0899999999");
    assert.equal(field("ad-q-status").value, "draft");
    assert.equal(field("ad-q-vat-mode").value, "excluded");
    const row = itemRows()[0];
    assert.equal(row.querySelector(".ad-q-item-name").value, "ป้ายอะคริลิค");
    assert.equal(row.querySelector(".ad-q-item-qty").value, "3");
    assert.equal(row.querySelector(".ad-q-item-price").value, "0");
    assert.equal(row.querySelector(".ad-q-item-discount").value, "0");
  });

  test("quote_request ไม่มี items เลย (array ว่าง) → ยังแสดงแถวว่าง 1 แถว ไม่พัง", () => {
    mod.openQuotationFormFromRequest(makeQuoteRequest({ items: [] }));
    assert.equal(itemRows().length, 1);
    assert.equal(itemRows()[0].querySelector(".ad-q-item-name").value, "");
  });

  test("submit หลังเปิดจากคำขอ → เรียก addQuotation() ไม่ใช่ updateQuotation() (editingId ต้องเป็น null เสมอ)", async () => {
    mod.openQuotationFormFromRequest(makeQuoteRequest());
    document.getElementById("ad-q-form").dispatchEvent(new document.defaultView.Event("submit", { bubbles: true, cancelable: true }));
    await new Promise(r => setTimeout(r, 0));
    // P3.0 Phase 5 รอบ 7: addQuotation() ตอนมี requestId จะเรียก linkQuotationToRequest() ต่อเอง
    // ซึ่งเรียก updateDoc() ไปที่ quote_requests/{requestId} (ไม่ใช่ quotations/{id} — เอกสารที่
    // "แก้ไข" ไม่มีเลย ยังคงเป็น addQuotation() (สร้างใหม่) ไม่ใช่ updateQuotation() (แก้ของเดิม)
    // ตามชื่อเทสนี้เป๊ะ — ดูคอมเมนต์หัวไฟล์ js/db-quotations.js หัวข้อ "P3.0 Phase 5 (รอบ 7 ...)")
    assert.equal(globalThis.__UPDATE_DOC_CALLS__.length, 1);
    assert.equal(globalThis.__UPDATE_DOC_CALLS__[0].path, "quote_requests/qr-1");
    assert.equal(globalThis.__ADD_DOC_CALLS__.length, 1);
    assert.equal(globalThis.__ADD_DOC_CALLS__[0].payload.requestId, "qr-1");
    assert.equal(globalThis.__ADD_DOC_CALLS__[0].payload.billingName, "บริษัท คำขอ จำกัด");
  });

  test("เปิดฟอร์มเปล่าธรรมดา (openNewQuotationForm) หลังเคยเปิดจากคำขอมาก่อน → requestId ต้องถูกล้าง ไม่ติดไปกับ payload", async () => {
    mod.openQuotationFormFromRequest(makeQuoteRequest());
    mod.openNewQuotationForm();
    field("ad-q-billing-name").value = "บริษัท ใหม่จริงๆ";
    const row = itemRows()[0];
    row.querySelector(".ad-q-item-name").value = "สินค้าใหม่";
    row.querySelector(".ad-q-item-name").dispatchEvent(new document.defaultView.Event("input", { bubbles: true }));
    document.getElementById("ad-q-form").dispatchEvent(new document.defaultView.Event("submit", { bubbles: true, cancelable: true }));
    await new Promise(r => setTimeout(r, 0));
    assert.equal(globalThis.__ADD_DOC_CALLS__[0].payload.requestId, null);
  });
});

describe("openQuotationFormFromClone() — คัดลอกเป็นฉบับร่างใหม่ (P3.0 Phase 6 รอบ 11)", () => {
  test("prefill ข้อมูลลูกค้า/รายการสินค้า (คงราคาเดิม) — status เป็น draft, validUntil ว่างเสมอ, editingId เป็น null", async () => {
    mod.openQuotationFormFromClone(makeQuotation({ id: "q-src", quoteNo: "QT2026-0099", status: "sent", validUntil: "2026-01-01" }));
    assert.equal(overlay().style.display, "flex");
    assert.match(field("ad-q-modal-title").textContent, /คัดลอกเป็นฉบับร่างใหม่/);
    assert.equal(field("ad-q-billing-name").value, "บริษัท ทดสอบ จำกัด");
    assert.equal(field("ad-q-contact-person").value, "คุณสมชาย");
    assert.equal(field("ad-q-status").value, "draft");
    // วันหมดอายุต้องถูกเคลียร์เป็นค่าว่างเสมอ (ไม่ copy จากต้นฉบับ — ดูเหตุผลใน
    // buildQuotationClone() js/db-quotations.js)
    assert.equal(field("ad-q-valid-until").value, "");
    const row = itemRows()[0];
    assert.equal(row.querySelector(".ad-q-item-name").value, "ป้ายไฟ LED");
    // ต่างจาก openQuotationFormFromRequest() — clone คงราคาเดิมไว้ ไม่ตั้ง 0
    assert.equal(row.querySelector(".ad-q-item-price").value, "1000");
    assert.equal(row.querySelector(".ad-q-item-discount").value, "100");
  });

  test("submit หลัง clone → เรียก addQuotation() ไม่ใช่ updateQuotation() + ไม่มี requestId ติดไปด้วย", async () => {
    mod.openQuotationFormFromClone(makeQuotation({ id: "q-src", quoteNo: "QT2026-0099" }));
    document.getElementById("ad-q-form").dispatchEvent(new document.defaultView.Event("submit", { bubbles: true, cancelable: true }));
    await new Promise(r => setTimeout(r, 0));
    assert.equal(globalThis.__UPDATE_DOC_CALLS__.length, 0);
    assert.equal(globalThis.__ADD_DOC_CALLS__.length, 1);
    assert.equal(globalThis.__ADD_DOC_CALLS__[0].payload.requestId, null);
    assert.equal(globalThis.__ADD_DOC_CALLS__[0].payload.billingName, "บริษัท ทดสอบ จำกัด");
    assert.equal(globalThis.__ADD_DOC_CALLS__[0].payload.status, "draft");
  });

  test("quotation ต้นฉบับไม่มี items เลย (array ว่าง) → ยังแสดงแถวว่าง 1 แถว ไม่พัง", () => {
    mod.openQuotationFormFromClone(makeQuotation({ items: [] }));
    assert.equal(itemRows().length, 1);
    assert.equal(itemRows()[0].querySelector(".ad-q-item-name").value, "");
  });
});

describe("submit — โหมดสร้างใหม่", () => {
  test("submit ฟอร์มเปล่าที่กรอกครบ → เรียก addQuotation() ไม่ใช่ updateQuotation()", async () => {
    mod.openNewQuotationForm();
    field("ad-q-billing-name").value = "บริษัท ใหม่ จำกัด";
    const row = itemRows()[0];
    row.querySelector(".ad-q-item-name").value = "ป้ายอะคริลิค";
    row.querySelector(".ad-q-item-name").dispatchEvent(new document.defaultView.Event("input", { bubbles: true }));
    row.querySelector(".ad-q-item-qty").value = "1";
    row.querySelector(".ad-q-item-qty").dispatchEvent(new document.defaultView.Event("input", { bubbles: true }));
    row.querySelector(".ad-q-item-price").value = "500";
    row.querySelector(".ad-q-item-price").dispatchEvent(new document.defaultView.Event("input", { bubbles: true }));
    field("ad-q-valid-until").value = "2026-10-15";
    document.getElementById("ad-q-form").dispatchEvent(new document.defaultView.Event("submit", { bubbles: true, cancelable: true }));
    await new Promise(r => setTimeout(r, 0));
    assert.equal(globalThis.__UPDATE_DOC_CALLS__.length, 0);
    assert.equal(globalThis.__ADD_DOC_CALLS__.length, 1);
    assert.equal(globalThis.__ADD_DOC_CALLS__[0].path, "quotations");
    assert.equal(globalThis.__ADD_DOC_CALLS__[0].payload.billingName, "บริษัท ใหม่ จำกัด");
    assert.equal(globalThis.__ADD_DOC_CALLS__[0].payload.items[0].name, "ป้ายอะคริลิค");
    // วันหมดอายุ (P3.0 Phase 6) — ต้องติดไปกับ payload จริง
    assert.equal(globalThis.__ADD_DOC_CALLS__[0].payload.validUntil, "2026-10-15");
  });

  test("submit โดยไม่กรอกวันหมดอายุเลย → payload.validUntil เป็นสตริงว่าง (ไม่บังคับ)", async () => {
    mod.openNewQuotationForm();
    field("ad-q-billing-name").value = "บริษัท ใหม่ จำกัด";
    const row = itemRows()[0];
    row.querySelector(".ad-q-item-name").value = "สินค้า B";
    row.querySelector(".ad-q-item-name").dispatchEvent(new document.defaultView.Event("input", { bubbles: true }));
    document.getElementById("ad-q-form").dispatchEvent(new document.defaultView.Event("submit", { bubbles: true, cancelable: true }));
    await new Promise(r => setTimeout(r, 0));
    assert.equal(globalThis.__ADD_DOC_CALLS__[0].payload.validUntil, "");
  });

  test("submit สำเร็จ → ปิดโมดัลเอง", async () => {
    mod.openNewQuotationForm();
    field("ad-q-billing-name").value = "บริษัท ใหม่ จำกัด";
    const row = itemRows()[0];
    row.querySelector(".ad-q-item-name").value = "สินค้า A";
    row.querySelector(".ad-q-item-name").dispatchEvent(new document.defaultView.Event("input", { bubbles: true }));
    document.getElementById("ad-q-form").dispatchEvent(new document.defaultView.Event("submit", { bubbles: true, cancelable: true }));
    await new Promise(r => setTimeout(r, 0));
    assert.equal(overlay().style.display, "none");
  });
});

describe("submit — โหมดแก้ไข", () => {
  test("submit ฟอร์มที่เปิดจาก openEditQuotationForm() → เรียก updateQuotation() ด้วย id เดิม ไม่เรียก addQuotation()", async () => {
    mod.openEditQuotationForm(makeQuotation());
    field("ad-q-status").value = "accepted";
    document.getElementById("ad-q-form").dispatchEvent(new document.defaultView.Event("submit", { bubbles: true, cancelable: true }));
    await new Promise(r => setTimeout(r, 0));
    assert.equal(globalThis.__ADD_DOC_CALLS__.length, 0);
    assert.equal(globalThis.__UPDATE_DOC_CALLS__.length, 1);
    assert.match(globalThis.__UPDATE_DOC_CALLS__[0].path, /quotations\/q-1/);
    assert.equal(globalThis.__UPDATE_DOC_CALLS__[0].payload.status, "accepted");
  });

  test("แก้ไขวันหมดอายุจากของเดิม → payload.validUntil เป็นค่าใหม่ (P3.0 Phase 6)", async () => {
    mod.openEditQuotationForm(makeQuotation({ validUntil: "2026-09-30" }));
    assert.equal(field("ad-q-valid-until").value, "2026-09-30"); // prefill ค่าเดิมก่อน
    field("ad-q-valid-until").value = "2026-12-01";
    document.getElementById("ad-q-form").dispatchEvent(new document.defaultView.Event("submit", { bubbles: true, cancelable: true }));
    await new Promise(r => setTimeout(r, 0));
    assert.equal(globalThis.__UPDATE_DOC_CALLS__[0].payload.validUntil, "2026-12-01");
  });
});

describe("validation", () => {
  test("ไม่กรอกชื่อลูกค้าเลย → ไม่ submit จริง (ไม่เรียก addQuotation())", async () => {
    mod.openNewQuotationForm();
    itemRows()[0].querySelector(".ad-q-item-name").value = "สินค้า A";
    document.getElementById("ad-q-form").dispatchEvent(new document.defaultView.Event("submit", { bubbles: true, cancelable: true }));
    await new Promise(r => setTimeout(r, 0));
    assert.equal(globalThis.__ADD_DOC_CALLS__.length, 0);
    assert.equal(overlay().style.display, "flex"); // ฟอร์มยังเปิดอยู่ ไม่ปิดเอง
  });

  test("ไม่มีรายการสินค้าที่มีชื่อเลยสักแถว → ไม่ submit จริง", async () => {
    mod.openNewQuotationForm();
    field("ad-q-billing-name").value = "บริษัท ทดสอบ";
    document.getElementById("ad-q-form").dispatchEvent(new document.defaultView.Event("submit", { bubbles: true, cancelable: true }));
    await new Promise(r => setTimeout(r, 0));
    assert.equal(globalThis.__ADD_DOC_CALLS__.length, 0);
  });
});

// audit log ใบเสนอราคา (P3.0 Phase 6, ดู continue-prompt-p3.0-phase6-round12-cont.md) —
// pattern การเทสเดียวกับ "logAudit() ถูกเรียกจากภายใน submit handler แต่ auth.currentUser เป็น
// null (default ของ stub) จึง exit เงียบๆ" ใน test/orders-tab-modal-submit-flow.test.mjs เป๊ะ —
// getAuth() ใน test/helpers/firebase-stub-loader.mjs คืน { currentUser: null } เสมอ ทำให้
// logAudit() (js/db.js) exit ตั้งแต่บรรทัดแรกไม่เรียก addDoc("auditLog") จริง — เทสนี้จึงเช็คแค่ว่า
// (1) submit ไม่ throw แม้เรียก logAudit() แทรกอยู่ (2) ไม่มี addDoc("auditLog") เกิดขึ้นจริง
// (เหลือแค่ addDoc("quotations")/updateDoc("quotations/...") ตามปกติของโหมดนั้นๆ)
describe("audit log ใบเสนอราคา (P3.0 Phase 6 — logAudit ใน submit handler)", () => {
  test("โหมดสร้างใหม่: submit สำเร็จ ไม่ throw แม้เรียก logAudit(\"create\",\"quotation\",...) แทรกอยู่ + ไม่มี addDoc(\"auditLog\") เกิดขึ้นจริง (currentUser เป็น null)", async () => {
    mod.openNewQuotationForm();
    field("ad-q-billing-name").value = "บริษัท ออดิท จำกัด";
    const row = itemRows()[0];
    row.querySelector(".ad-q-item-name").value = "ป้ายทดสอบออดิท";
    row.querySelector(".ad-q-item-name").dispatchEvent(new document.defaultView.Event("input", { bubbles: true }));

    await assert.doesNotReject(async () => {
      document.getElementById("ad-q-form").dispatchEvent(new document.defaultView.Event("submit", { bubbles: true, cancelable: true }));
      await new Promise(r => setTimeout(r, 0));
    });
    // เหลือแค่ addDoc("quotations") ปกติของ addQuotation() 1 ครั้งพอดี — ไม่มี addDoc("auditLog")
    // เพิ่มขึ้นมาเลย (currentUser เป็น null ใน stub)
    assert.equal(globalThis.__ADD_DOC_CALLS__.length, 1);
    assert.equal(globalThis.__ADD_DOC_CALLS__[0].path, "quotations");
  });

  test("โหมดแก้ไข: submit สำเร็จ ไม่ throw แม้เรียก logAudit(\"update\",\"quotation\",...) แทรกอยู่ + ไม่มี addDoc(\"auditLog\") เกิดขึ้นจริง (currentUser เป็น null)", async () => {
    mod.openEditQuotationForm(makeQuotation());

    await assert.doesNotReject(async () => {
      document.getElementById("ad-q-form").dispatchEvent(new document.defaultView.Event("submit", { bubbles: true, cancelable: true }));
      await new Promise(r => setTimeout(r, 0));
    });
    // ไม่มี addDoc เกิดขึ้นเลยตอนแก้ไข (updateQuotation() เรียก updateDoc() เท่านั้น) — ยืนยันว่า
    // logAudit() ที่แทรกอยู่ไม่ได้ไปเรียก addDoc("auditLog") ด้วย
    assert.equal(globalThis.__ADD_DOC_CALLS__.length, 0);
    assert.equal(globalThis.__UPDATE_DOC_CALLS__.length, 1);
    assert.match(globalThis.__UPDATE_DOC_CALLS__[0].path, /quotations\/q-1/);
  });
});
