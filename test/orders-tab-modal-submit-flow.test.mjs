// test/orders-tab-modal-submit-flow.test.mjs — รอบที่ 89 (Phase 1 ของแผน 6 phase ที่วางไว้ในรอบที่ 88)
//
// jsdom test อย่างเป็นทางการสำหรับ "submit flow เต็มรูปแบบ" ของ js/orders-tab-modal.js
// (ป๊อปอัพ "เพิ่ม/แก้ไขคำสั่งผลิต" — #cp-order-overlay) ที่ยังไม่เคยมี test มาก่อน (มีแค่
// focus-trap ใน test/orders-tab-modal-focus-trap.test.mjs) — ครอบคลุมตามแผนรอบที่ 88 หัวข้อ
// "Phase 1":
//   - openOrderModal(order) เปิดเพิ่มใหม่ (ฟอร์มว่าง/ค่า default) vs เปิดแก้ไข (ค่าเดิมกรอกครบ
//     ทุกช่อง รวม specs/qcChecklist/chips การเงิน+จัดส่ง/แนบไฟล์)
//   - openOrderModalClone(order) (ล้างเลขที่/กำหนดส่ง/สถานะ/progress/tracking แต่ค่าที่เหลือคงเดิม)
//   - submit เพิ่มใหม่เรียก addOrder() vs submit แก้ไขเรียก updateOrder()+logAudit()
//   - payload ที่ประกอบถูกต้องครบทุก field โดยเฉพาะ qcChecklist ที่ต้อง trim+filter label ว่างออก
//   - validateFormInline() gate ไม่ให้ submit ถ้าฟอร์มไม่ผ่าน (required: code/customer/item/qty)
//   - ปุ่ม submit disable ระหว่างบันทึก + toast success/error
//
// สำคัญ — ต่างจาก test/orders-tab-modal-focus-trap.test.mjs ตรงจุดสถาปัตยกรรมเทส: ไฟล์นั้นสร้าง
// jsdom instance ใหม่ + import js/orders-tab-modal.js ใหม่ (ผ่าน query string กันแคช) แยกทุกเทส
// ได้ปลอดภัย เพราะทุก element ที่ไฟล์นั้นตรวจสอบ (orderOverlay/orderForm/focusable elements)
// ถูกประกาศตรงที่ module-scope ของ js/orders-tab-modal.js เอง ซึ่ง "สด" ใหม่ทุกครั้งที่ import
// ด้วย query string ใหม่จริง — แต่ Phase 1 นี้ต้องตรวจสอบ state/DOM-ref ที่ประกาศอยู่ใน
// "โมดูลลูก" ด้วย (js/orders-tab-modal-qc.js → qcListBox/currentQcChecklist, js/orders-tab.js →
// toastWrap ของ showToast()) ซึ่งไฟล์เหล่านั้นถูก import แบบ static path ปกติ (ไม่มี query กันแคช)
// จาก js/orders-tab-modal.js — Node cache โมดูลด้วย resolved URL เท่านั้น ไม่สนใจว่าใครเป็นคน
// import ซ้ำ ดังนั้นต่อให้ import js/orders-tab-modal.js ใหม่กี่ครั้งในไฟล์เทสเดียวกัน (process
// เดียวกัน — node:test รันแยก process ต่อไฟล์ ไม่ใช่ต่อเทส) โมดูลลูกเหล่านี้จะ "ค้าง" อยู่กับ
// document ตัวแรกที่เคย import มันเท่านั้นตลอดทั้งไฟล์ ทำให้ document.getElementById() ของมันชี้
// ไปยัง DOM ของเทสแรกสุด ไม่ใช่ DOM ของเทสปัจจุบัน — ถ้าสร้าง jsdom ใหม่ทุกเทสแบบไฟล์ focus-trap
// จะเจอปัญหา "เขียนถูก state แต่ render ไปคนละ document" (ตรวจแล้วจริงระหว่างพัฒนาไฟล์นี้ — ลอง
// แบบสร้าง dom ใหม่ทุกเทสก่อน แล้วเจอ qcRows.length ผิดคาดเพราะ render ไปที่ document เก่า) —
// แก้โดยใช้ **jsdom + import โมดูลครั้งเดียวสำหรับทั้งไฟล์** (module scope, ไม่ใช่ต่อเทส) แทน แล้ว
// รีเซ็ตสถานะที่จำเป็นเองในแต่ละเทสผ่าน openOrderModal()/openOrderModalClone() ที่เขียนทับค่าทุก
// ช่องอยู่แล้ว (รวม qcChecklist/attachments/chips) — ปลอดภัยเพราะฟังก์ชันเหล่านี้ idempotent
// (เรียกกี่ครั้งก็เขียนทับค่าตามอาร์กิวเมนต์ล่าสุดเสมอ ไม่มี state ค้างข้ามเทสที่กระทบผลลัพธ์ที่ตรวจ)
//
// เพิ่มเติม: toastWrap (js/orders-tab.js showToast()) ก็เป็น module-level state ที่ค้างข้ามเทส
// เหมือนกัน (สร้างครั้งเดียวตอน showToast() ถูกเรียกครั้งแรกในไฟล์นี้ แล้วใช้ซ้ำตลอด) — toast เก่า
// จากเทสก่อนหน้ายังค้างอยู่ใน DOM จริง (setTimeout ลบออกที่ 3200ms แต่เทสรันเร็วกว่านั้นมาก) จึง
// ต้องตรวจสอบ toast "ตัวล่าสุด" (querySelectorAll แล้วเอาตัวท้ายสุด) ไม่ใช่ querySelector ตัวแรก
// เพื่อไม่ให้ชนกับ toast ค้างจากเทสก่อนหน้า
//
// เพิ่มเติมจาก focus-trap test: ต้อง stub globalThis.__ADD_DOC_CALLS__/__UPDATE_DOC_CALLS__ (ผ่าน
// firebase-stub-loader.mjs เดิมตั้งแต่รอบ 68/70) เพื่อตรวจ payload ที่ addOrder()/updateOrder()
// (js/db-orders.js) ส่งเข้า addDoc()/updateDoc() จริง — logAudit() (js/db.js) เช็ค
// auth.currentUser ก่อนเสมอ ซึ่ง stub getAuth() คืน { currentUser: null } เป็น default จึง
// ไม่มีการเรียก addDoc("auditLog") เกิดขึ้นจริงในเทสนี้เลย (ยืนยันแล้วว่าไม่ throw แค่ return เงียบๆ
// — ดูโค้ดจริง js/db.js logAudit()) จึงเช็คแค่ว่า updateDoc ถูกเรียกถูกต้อง ไม่ต้องเช็ค audit log
//
// ยังเพิ่ม globalThis.__GET_DOCS_STUB__ ใหม่ (เพิ่มเข้า test/helpers/firebase-stub-loader.mjs ใน
// รอบนี้ — ดูคอมเมนต์ที่ไฟล์นั้นสำหรับเหตุผล/ผลกระทบ) เพื่อจำลอง listStaff() (js/db.js) คืนรายชื่อ
// พนักงานจริง ให้ทดสอบ assigneeName resolution ตอน submit ได้ (เดิม getDocs() ไม่รับ ref เลย แยก
// collection ไม่ออก) — ไม่ได้ทดสอบ loadProductPicker()/loadStaffPicker() ตัวมันเองอย่างละเอียดใน
// ไฟล์นี้ (ไม่ใช่ scope ของ submit flow โดยตรง แค่ใช้พอให้ allStaff มีข้อมูลสำหรับเทส assigneeName)
//
// ไม่ได้แก้ไฟล์ .js/.html/.css ที่เป็นโค้ดจริงเลยแม้แต่บรรทัดเดียวในไฟล์นี้ — งานทดสอบล้วนๆ
// (มีแก้ test/helpers/firebase-stub-loader.mjs เพิ่ม hook __GET_DOCS_STUB__ เท่านั้น — เป็นไฟล์
// โครงสร้างพื้นฐานของเทส ไม่ใช่โค้ดผลิตภัณฑ์จริง)

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

let document;      // ใช้ dom เดียวตลอดทั้งไฟล์ (ดูหมายเหตุหัวไฟล์ว่าทำไม)
let openOrderModal;
let openOrderModalClone;
let loadStaffPicker;
let attachMod;      // P0.2c: ต้องเข้าถึง setCurrentAttachments() ตรงๆ เพื่อตั้งค่า showToCustomer ก่อน submit

function resetFirebaseCalls() {
  globalThis.__ADD_DOC_CALLS__ = [];
  globalThis.__UPDATE_DOC_CALLS__ = [];
  globalThis.__DELETE_DOC_CALLS__ = [];
  globalThis.__SET_DOC_CALLS__ = [];
  globalThis.__GET_DOC_STUB__ = undefined;
  globalThis.__GET_DOCS_STUB__ = undefined;
}

// รายชื่อพนักงานปลอมสำหรับทดสอบ assigneeName resolution — ให้ getDocs(collection(db,"staff"))
// คืนรายการนี้เฉพาะตอน ref.path === "staff" (collection อื่นยังได้ [] เหมือน default เดิม)
function stubStaffList(staffList) {
  globalThis.__GET_DOCS_STUB__ = (ref) => {
    if (ref && ref.path === "staff") return staffList;
    return [];
  };
}

before(async () => {
  const dom = new JSDOM(`<!doctype html><html><body>${ADMIN_BODY_NO_SCRIPTS}</body></html>`, {
    url: "https://example.test/"
  });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
  globalThis.MouseEvent = dom.window.MouseEvent;
  globalThis.KeyboardEvent = dom.window.KeyboardEvent;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Event = dom.window.Event;
  // ดูหมายเหตุหัวไฟล์ (เหมือน focus-trap test): switchOdTab() เรียก scrollIntoView() ทุกครั้งที่
  // เปิดป๊อปอัพ ต้อง stub ก่อน import เสมอ ไม่งั้น openOrderModal()/openOrderModalClone() จะ throw
  dom.window.HTMLElement.prototype.scrollIntoView = function () {};

  const mod = await import("../js/orders-tab-modal.js");
  openOrderModal = mod.openOrderModal;
  openOrderModalClone = mod.openOrderModalClone;
  loadStaffPicker = mod.loadStaffPicker;
  attachMod = await import("../js/orders-tab-modal-attach.js");
  document = dom.window.document;
});

beforeEach(() => {
  resetFirebaseCalls();
});

// helper: เติม <option> ให้ select ก่อนตั้งค่า .value (จำลองผู้ใช้เลือกจาก dropdown จริง — select
// ของ jsdom เหมือน browser จริง คือ .value = "x" จะไม่ติดถ้าไม่มี <option value="x"> อยู่ก่อน)
function addOption(select, value) {
  const opt = document.createElement("option");
  opt.value = value;
  select.appendChild(opt);
  return opt;
}

// helper: กรอกฟอร์มขั้นต่ำให้ผ่าน validateFormInline() (required: code/customer/item/qty)
function fillRequiredFields(overrides = {}) {
  document.getElementById("cp-o-code").value     = overrides.code ?? "PO-2026-0900";
  document.getElementById("cp-o-customer").value = overrides.customer ?? "การไฟฟ้าฝ่ายผลิต";
  document.getElementById("cp-o-item").value     = overrides.item ?? "ป้ายเตือนไฟฟ้าแรงสูง";
  document.getElementById("cp-o-qty").value      = overrides.qty ?? "5";
}

function dispatchSubmit() {
  const form = document.getElementById("cp-order-form");
  const evt = new document.defaultView.Event("submit", { bubbles: true, cancelable: true });
  form.dispatchEvent(evt);
}

// รอ microtask/timer หลายรอบให้ submit handler (async) ทำงานจนจบ (addDoc/updateDoc stub resolve
// เร็วมากแต่ยังเป็น Promise เสมอ ต้องรอผ่าน event loop อย่างน้อย 1 tick)
function flushAsync() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

// toastWrap ค้างข้ามเทส (ดูหมายเหตุหัวไฟล์) — เอา toast "ตัวล่าสุด" เสมอ กันชนกับของเก่า
function lastToast() {
  const all = document.querySelectorAll(".cp-toast-wrap .cp-toast");
  return all.length ? all[all.length - 1] : null;
}

describe("js/orders-tab-modal.js — openOrderModal(order): เปิดเพิ่มใหม่ vs เปิดแก้ไข (รอบที่ 89, Phase 1)", () => {
  test("openOrderModal(null): ฟอร์มว่าง/ค่า default ถูก (status=received, progress=0, qty=1, chips=unpaid/pickup)", () => {
    openOrderModal(null);

    assert.equal(document.getElementById("cp-order-modal-title").textContent, "เพิ่มคำสั่งผลิต");
    assert.equal(document.getElementById("cp-o-head-code").textContent, "");
    assert.equal(document.getElementById("cp-o-id").value, "");
    assert.equal(document.getElementById("cp-o-code").value, "");
    assert.equal(document.getElementById("cp-o-email").value, ""); // P0.3: ค่าเริ่มต้นว่างเหมือน phone
    assert.equal(document.getElementById("cp-o-line-user-id").value, ""); // P1.4: ค่าเริ่มต้นว่างเหมือน email
    assert.equal(document.getElementById("cp-o-qty").value, "1");
    assert.equal(document.getElementById("cp-o-status").value, "received");
    assert.equal(document.getElementById("cp-o-progress").value, "0");
    assert.equal(document.getElementById("cp-o-unit-price-row").style.display, "none");
    assert.ok(document.querySelector('#cp-o-payment-chips .cp-chip-btn[data-value="unpaid"]').classList.contains("active"));
    assert.ok(document.querySelector('#cp-o-shipping-chips .cp-chip-btn[data-value="pickup"]').classList.contains("active"));
    assert.equal(document.getElementById("cp-o-qc-list").textContent.includes("ยังไม่มีรายการตรวจสอบคุณภาพ"), true);
  });

  test("openOrderModal(order) แก้ไข: กรอกค่าเดิมครบทุกช่องรวม specs/การเงิน/การจัดส่ง", () => {
    const order = {
      id: "order-1", code: "PO-2026-0100", customer: "บริษัท เอบีซี จำกัด", phone: "0891234567",
      email: "customer@abc.example.com",
      lineUserId: "Uabc1234567890",
      item: "ป้ายทางออกฉุกเฉิน", category: "ป้ายนิรภัย", product_id: "", unit_price: 0,
      qty: 20, dueDate: "2026-08-15", status: "production", progress: 40, assignee: "",
      specs: { size: "60x40 ซม.", material: "อะลูมิเนียมคอมโพสิต", color: "เหลือง-ดำ", finish: "เคลือบเงา" },
      qcChecklist: [{ label: "ตรวจสีตรงสเปก", checked: true }, { label: "ตรวจขนาด", checked: false }],
      notes: "ลูกค้าขอด่วน", deposit: 5000, discount: 200, vatIncluded: true,
      paymentStatus: "deposit_paid", invoiceAddress: "123 ถ.สุขุมวิท", recipient: "คุณสมชาย",
      shippingCost: 300, shippingAddress: "456 ถ.พระราม 9", shippingMethod: "courier",
      shippingTrackingId: "TH1234567890", attachments: []
    };

    openOrderModal(order);

    assert.equal(document.getElementById("cp-order-modal-title").textContent, "แก้ไขคำสั่งผลิต");
    assert.equal(document.getElementById("cp-o-head-code").textContent, "PO-2026-0100");
    assert.equal(document.getElementById("cp-o-id").value, "order-1");
    assert.equal(document.getElementById("cp-o-customer").value, "บริษัท เอบีซี จำกัด");
    assert.equal(document.getElementById("cp-o-email").value, "customer@abc.example.com");
    assert.equal(document.getElementById("cp-o-line-user-id").value, "Uabc1234567890");
    assert.equal(document.getElementById("cp-o-qty").value, "20");
    assert.equal(document.getElementById("cp-o-status").value, "production");
    assert.equal(document.getElementById("cp-o-progress").value, "40");
    assert.equal(document.getElementById("cp-o-spec-size").value, "60x40 ซม.");
    assert.equal(document.getElementById("cp-o-spec-material").value, "อะลูมิเนียมคอมโพสิต");
    assert.equal(document.getElementById("cp-o-spec-color").value, "เหลือง-ดำ");
    assert.equal(document.getElementById("cp-o-spec-finish").value, "เคลือบเงา");
    assert.equal(document.getElementById("cp-o-notes").value, "ลูกค้าขอด่วน");
    assert.equal(document.getElementById("cp-o-deposit").value, "5000");
    assert.equal(document.getElementById("cp-o-discount").value, "200");
    assert.equal(document.getElementById("cp-o-vat-included").checked, true);
    assert.ok(document.querySelector('#cp-o-payment-chips .cp-chip-btn[data-value="deposit_paid"]').classList.contains("active"));
    assert.equal(document.getElementById("cp-o-invoice-address").value, "123 ถ.สุขุมวิท");
    assert.equal(document.getElementById("cp-o-recipient").value, "คุณสมชาย");
    assert.equal(document.getElementById("cp-o-shipping-cost").value, "300");
    assert.equal(document.getElementById("cp-o-shipping-address").value, "456 ถ.พระราม 9");
    assert.ok(document.querySelector('#cp-o-shipping-chips .cp-chip-btn[data-value="courier"]').classList.contains("active"));
    assert.equal(document.getElementById("cp-o-shipping-tracking").value, "TH1234567890");
    // QC checklist ถูกเรนเดอร์ตาม order.qcChecklist จริง
    const qcRows = document.querySelectorAll("#cp-o-qc-list .cp-qc-row");
    assert.equal(qcRows.length, 2);
    assert.equal(qcRows[0].querySelector("[data-qc-label]").value, "ตรวจสีตรงสเปก");
    assert.equal(qcRows[0].querySelector("[data-qc-check]").checked, true);
  });

  test("openOrderModal(order) แก้ไข: มี product_id+unit_price → แสดงแถวราคาต่อหน่วย", () => {
    const productSelect = document.getElementById("cp-o-product");
    addOption(productSelect, "prod-1");

    openOrderModal({ id: "o2", code: "PO-2", item: "ป้าย", qty: 1, product_id: "prod-1", unit_price: 250 });

    assert.equal(document.getElementById("cp-o-unit-price-row").style.display, "");
    assert.equal(document.getElementById("cp-o-unit-price").value, "250");
    assert.ok(document.getElementById("cp-o-unit-price-display").value.includes("250"));
  });

  test("openOrderModal(order) ที่ไม่มี specs/qcChecklist/attachments เลย ไม่ throw (fallback ค่าว่างปลอดภัย)", () => {
    assert.doesNotThrow(() => openOrderModal({ id: "o3", code: "PO-3", item: "ป้าย", qty: 1 }));
  });
});

describe("js/orders-tab-modal.js — openOrderModalClone(order) (รอบที่ 89, Phase 1)", () => {
  test("ล้างเลขที่/กำหนดส่ง/สถานะ/progress/tracking แต่ค่าที่เหลือ (ลูกค้า/รายการ/specs) คงเดิม", () => {
    const order = {
      id: "order-9", code: "PO-2026-0099", customer: "หจก. ตัวอย่าง", item: "ป้ายบังคับ",
      qty: 10, dueDate: "2026-09-01", status: "qc", progress: 80,
      shippingTrackingId: "TRACK999",
      specs: { size: "30x30", material: "PVC", color: "แดง", finish: "ด้าน" }
    };

    openOrderModalClone(order);

    // ล้างแล้ว
    assert.equal(document.getElementById("cp-o-id").value, "");
    assert.equal(document.getElementById("cp-o-code").value, "");
    assert.equal(document.getElementById("cp-o-due").value, "");
    assert.equal(document.getElementById("cp-o-status").value, "received");
    assert.equal(document.getElementById("cp-o-progress").value, "0");
    assert.equal(document.getElementById("cp-o-shipping-tracking").value, "");
    assert.equal(document.getElementById("cp-o-head-code").textContent, "");
    // คงเดิม
    assert.equal(document.getElementById("cp-o-customer").value, "หจก. ตัวอย่าง");
    assert.equal(document.getElementById("cp-o-item").value, "ป้ายบังคับ");
    assert.equal(document.getElementById("cp-o-qty").value, "10");
    assert.equal(document.getElementById("cp-o-spec-material").value, "PVC");
    // หัวข้อป๊อปอัพบอกว่าเป็นการทำซ้ำจากคำสั่งไหน
    assert.ok(document.getElementById("cp-order-modal-title").textContent.includes("PO-2026-0099"));
  });
});

describe("js/orders-tab-modal.js — submit เพิ่มคำสั่งผลิตใหม่ → addOrder() (รอบที่ 89, Phase 1)", () => {
  test("payload ครบทุก field รวม specs/การเงิน/การจัดส่ง ส่งเข้า addOrder() ถูกต้อง", async () => {
    openOrderModal(null);
    fillRequiredFields({ code: "PO-2026-0500", customer: "บริษัท ทดสอบ", item: "ป้ายไฟ LED", qty: "3" });
    document.getElementById("cp-o-spec-size").value = "100x50";
    document.getElementById("cp-o-deposit").value = "1000";
    document.getElementById("cp-o-shipping-address").value = "ที่อยู่จัดส่งทดสอบ";
    document.getElementById("cp-o-email").value = "  test-buyer@example.com  "; // P0.3: ต้อง trim()
    document.getElementById("cp-o-line-user-id").value = "  Utest9876543210  "; // P1.4: ต้อง trim()

    dispatchSubmit();
    await flushAsync();

    assert.equal(globalThis.__ADD_DOC_CALLS__.length, 1, "addOrder() ต้องเรียก addDoc() 1 ครั้งพอดี");
    const payload = globalThis.__ADD_DOC_CALLS__[0].payload;
    assert.equal(globalThis.__ADD_DOC_CALLS__[0].path, "orders");
    assert.equal(payload.code, "PO-2026-0500");
    assert.equal(payload.customer, "บริษัท ทดสอบ");
    assert.equal(payload.email, "test-buyer@example.com"); // P0.3
    assert.equal(payload.lineUserId, "Utest9876543210"); // P1.4
    assert.equal(payload.item, "ป้ายไฟ LED");
    assert.equal(Number(payload.qty), 3);
    assert.equal(payload.specs.size, "100x50");
    assert.equal(Number(payload.deposit), 1000);
    assert.equal(payload.shippingAddress, "ที่อยู่จัดส่งทดสอบ");
    assert.equal(payload.paymentStatus, "unpaid");
    assert.equal(payload.shippingMethod, "pickup");
    // updateOrder/logAudit ต้องไม่ถูกเรียกเลยตอนเพิ่มใหม่
    assert.equal(globalThis.__UPDATE_DOC_CALLS__.length, 0);
  });

  // P0.2c: designFiles ถูกคัดจาก currentAttachments เฉพาะที่ติ๊ก "ลูกค้าเห็น" (showToCustomer)
  test("designFiles ในปayload คัดเฉพาะไฟล์แนบที่ a.showToCustomer=true (map เหลือแค่ url/label/uploadedAt)", async () => {
    openOrderModal(null);
    fillRequiredFields({ code: "PO-2026-0600", customer: "บริษัท ทดสอบ 2", item: "ป้ายอะคริลิก", qty: "1" });
    attachMod.setCurrentAttachments([
      { url: "https://x/a.png", type: "image", label: "a.png", uploadedAt: "2026-01-01", uploadedBy: "u@x.com", showToCustomer: true },
      { url: "https://x/b.pdf", type: "application/pdf", label: "b.pdf", uploadedAt: "2026-01-02", uploadedBy: "u@x.com", showToCustomer: false },
      { url: "https://x/c.png", type: "image", label: "c.png", showToCustomer: true }
    ]);

    dispatchSubmit();
    await flushAsync();

    const payload = globalThis.__ADD_DOC_CALLS__[0].payload;
    assert.equal(payload.designFiles.length, 2, "ต้องคัดเฉพาะ 2 ไฟล์ที่ showToCustomer=true");
    assert.deepEqual(payload.designFiles[0], { url: "https://x/a.png", label: "a.png", uploadedAt: "2026-01-01" });
    assert.deepEqual(payload.designFiles[1], { url: "https://x/c.png", label: "c.png", uploadedAt: "" });
    assert.equal(payload.attachments.length, 3, "attachments ทั้งก้อนต้องยังคงครบ ไม่ถูกกรอง");
  });

  test("ไม่มีไฟล์แนบไหนติ๊ก 'ลูกค้าเห็น' เลย → designFiles เป็น array ว่าง", async () => {
    openOrderModal(null);
    fillRequiredFields({ code: "PO-2026-0601", customer: "บริษัท ทดสอบ 3", item: "ป้ายสติกเกอร์", qty: "1" });
    attachMod.setCurrentAttachments([{ url: "https://x/d.png", type: "image", label: "d.png" }]);

    dispatchSubmit();
    await flushAsync();

    assert.deepEqual(globalThis.__ADD_DOC_CALLS__[0].payload.designFiles, []);
  });

  test("qcChecklist ถูก trim() แต่ละ label + filter รายการที่ label ว่าง(หลัง trim)ออกก่อนส่ง", async () => {
    // เปิดฟอร์มด้วย order ที่มี qcChecklist ปนช่องว่าง/มีเว้นวรรคหัวท้าย เพื่อให้ค่าไปโหลดเข้า
    // currentQcChecklist state ผ่าน openOrderModal() เอง (ตรงกับพฤติกรรมจริงตอนแก้ไขคำสั่งผลิต) —
    // ใส่ customer มาด้วยเพื่อให้ผ่าน validateFormInline() (required field) ก่อนถึงจะ submit ได้จริง
    openOrderModal({
      id: "order-qc", code: "PO-QC", customer: "ลูกค้าทดสอบ QC", item: "ป้าย QC", qty: 1,
      qcChecklist: [
        { label: "  ตรวจสี  ", checked: true },
        { label: "   ", checked: false },   // ควรถูกกรองออก (ว่างหลัง trim)
        { label: "ตรวจขนาด", checked: false }
      ]
    });
    // แก้ไข id ให้เป็นค่าว่างเพื่อบังคับ path "เพิ่มใหม่" (แยก concern จาก id/updateOrder — เทสนี้
    // สนใจแค่ qcChecklist filter logic ล้วนๆ)
    document.getElementById("cp-o-id").value = "";

    dispatchSubmit();
    await flushAsync();

    assert.equal(globalThis.__ADD_DOC_CALLS__.length, 1);
    const qc = globalThis.__ADD_DOC_CALLS__[0].payload.qcChecklist;
    assert.deepEqual(qc, [
      { label: "ตรวจสี", checked: true },
      { label: "ตรวจขนาด", checked: false }
    ]);
  });

  test("assigneeName ถูก resolve จาก allStaff (โหลดผ่าน loadStaffPicker()) ตาม assigneeUid ที่เลือก", async () => {
    stubStaffList([
      { id: "uid-1", data: { name: "สมชาย ใจดี", email: "somchai@example.com" } },
      { id: "uid-2", data: { name: "สมหญิง รักงาน", email: "somying@example.com" } }
    ]);
    await loadStaffPicker();
    openOrderModal(null);
    fillRequiredFields();
    document.getElementById("cp-o-assignee").value = "uid-2";

    dispatchSubmit();
    await flushAsync();

    const payload = globalThis.__ADD_DOC_CALLS__[0].payload;
    assert.equal(payload.assignee, "uid-2");
    assert.equal(payload.assigneeName, "สมหญิง รักงาน");
  });

  test("ไม่มี assignee เลือก (ค่า default ว่าง) → assignee/assigneeName เป็นค่าว่าง ไม่ throw", async () => {
    openOrderModal(null);
    fillRequiredFields();

    dispatchSubmit();
    await flushAsync();

    const payload = globalThis.__ADD_DOC_CALLS__[0].payload;
    assert.equal(payload.assignee, "");
    assert.equal(payload.assigneeName, "");
  });

  test("submit สำเร็จ: แสดง toast success \"เพิ่มคำสั่งผลิตแล้ว\" และปิดป๊อปอัพ", async () => {
    const overlay = document.getElementById("cp-order-overlay");

    openOrderModal(null);
    fillRequiredFields();
    assert.equal(overlay.style.display, "flex");

    dispatchSubmit();
    await flushAsync();

    assert.equal(overlay.style.display, "none", "submit สำเร็จต้องปิดป๊อปอัพ (closeOrderModal())");
    const toast = lastToast();
    assert.ok(toast, "ต้องมี toast ปรากฏ");
    assert.ok(toast.classList.contains("success"));
    assert.equal(toast.textContent, "เพิ่มคำสั่งผลิตแล้ว");
  });
});

describe("js/orders-tab-modal.js — submit แก้ไขคำสั่งผลิตเดิม → updateOrder()+logAudit() (รอบที่ 89, Phase 1)", () => {
  test("มี #cp-o-id → เรียก updateOrder(id, payload) ไม่ใช่ addOrder() + toast success ข้อความแก้ไข", async () => {
    openOrderModal({ id: "order-77", code: "PO-77", customer: "เดิม", item: "ป้ายเดิม", qty: 2 });
    document.getElementById("cp-o-customer").value = "ลูกค้าใหม่หลังแก้ไข";

    dispatchSubmit();
    await flushAsync();

    assert.equal(globalThis.__ADD_DOC_CALLS__.length, 0, "แก้ไขต้องไม่เรียก addOrder()/addDoc() เลย");
    assert.equal(globalThis.__UPDATE_DOC_CALLS__.length, 1);
    assert.equal(globalThis.__UPDATE_DOC_CALLS__[0].path, "orders/order-77");
    assert.equal(globalThis.__UPDATE_DOC_CALLS__[0].payload.customer, "ลูกค้าใหม่หลังแก้ไข");

    const toast = lastToast();
    assert.ok(toast.classList.contains("success"));
    assert.equal(toast.textContent, "บันทึกการแก้ไขแล้ว");
  });

  test("logAudit() ถูกเรียกจากภายใน submit handler แต่ auth.currentUser เป็น null (default ของ stub) จึง exit เงียบๆ ไม่ throw และไม่มี addDoc(\"auditLog\") เกิดขึ้น", async () => {
    openOrderModal({ id: "order-88", code: "PO-88", customer: "ลูกค้า", item: "ป้าย", qty: 1 });

    await assert.doesNotReject(async () => {
      dispatchSubmit();
      await flushAsync();
    });
    assert.equal(globalThis.__ADD_DOC_CALLS__.length, 0, "logAudit() ไม่ควรเรียก addDoc() เลยเพราะไม่มี currentUser");
  });
});

describe("js/orders-tab-modal.js — validateFormInline() gate + ปุ่ม submit disable ระหว่างบันทึก (รอบที่ 89, Phase 1)", () => {
  test("ฟอร์มไม่ผ่าน validation (ขาดช่อง required เช่น customer ว่าง) → ไม่เรียก addOrder()/updateOrder() เลย และป๊อปอัพยังเปิดอยู่", async () => {
    const overlay = document.getElementById("cp-order-overlay");

    openOrderModal(null);
    document.getElementById("cp-o-code").value = "PO-1";
    document.getElementById("cp-o-customer").value = ""; // required แต่เว้นว่างไว้ตั้งใจ
    document.getElementById("cp-o-item").value = "ป้าย";
    document.getElementById("cp-o-qty").value = "1";

    dispatchSubmit();
    await flushAsync();

    assert.equal(globalThis.__ADD_DOC_CALLS__.length, 0);
    assert.equal(globalThis.__UPDATE_DOC_CALLS__.length, 0);
    assert.equal(overlay.style.display, "flex", "ป๊อปอัพต้องยังเปิดอยู่เมื่อ validation ไม่ผ่าน");
  });

  test("ปุ่ม submit ถูก disable + เปลี่ยนข้อความเป็น 'กำลังบันทึก...' ระหว่างรอ addOrder() แล้วกลับเป็นปกติหลังเสร็จ", async () => {
    const form = document.getElementById("cp-order-form");
    const btn = form.querySelector('button[type=submit]');
    const originalText = btn.textContent;

    openOrderModal(null);
    fillRequiredFields();

    dispatchSubmit();
    // ทันทีหลัง dispatch (แต่ก่อน await tick) — submit handler เป็น async function ที่รัน
    // synchronous ไปจนถึง await addOrder(...) ตัวแรก ดังนั้น btn.disabled ต้องเป็น true แล้ว ณ จุดนี้
    assert.equal(btn.disabled, true);
    assert.equal(btn.textContent, "กำลังบันทึก...");

    await flushAsync();

    assert.equal(btn.disabled, false, "ต้องกลับมา enable หลังบันทึกเสร็จ (finally block)");
    assert.equal(btn.textContent, originalText);
  });
});
