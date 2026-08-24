// test/quote-form-flow.test.mjs
//
// jsdom test อย่างเป็นทางการสำหรับ flow การ "submit ฟอร์ม" ของฟอร์มขอใบเสนอราคาจากตะกร้า
// (js/quote-form.js + js/quote-form-template.js) — P3.0 Phase 2 รอบย่อย 3 (ดู
// continue-prompt-p3.0-phase2-round3.md) เขียนตามต้นแบบ test/lead-quote-modal-form-flow.test.mjs
// (โครงสร้างเดียวกัน: อ่าน template literal ด้วย regex, mock window.turnstile/fetch/
// bypassAntiSpamTimeTrap, ใช้ globalThis.__ADD_DOC_CALLS__ จาก firebase-stub-loader.mjs)
//
// ต่างจาก js/lead-quote-modal.js ตรงที่:
// 1) window.CSSignCart ไม่มีอยู่จริงใน jsdom test — ต้อง stub getCartItems()/clearCart() เอง
// 2) ต้องเรียก dom.window.openQuoteRequestForm() ก่อน submit เสมอ (currentCartItems snapshot
//    ถูกตั้งค่าตอนเปิดฟอร์มเท่านั้น ไม่อ่านตะกร้าซ้ำตอน submit — ดูคอมเมนต์ใน js/quote-form.js)
// 3) js/quote-form.js เป็น `type="module"` (import ตรงจาก ./db-quote-requests.js/./anti-spam.js/
//    ./turnstile.js/./form-toast.js/./form-validate.js) — window.openQuoteRequestForm ถูก assign
//    เข้า window ตรงๆ (ไม่ได้เรียกตัวเองแบบ bare identifier ที่อื่นในไฟล์เดียวกัน — ต่างจาก
//    js/lead-quote-modal.js) จึงเรียก dom.window.openQuoteRequestForm() ตรงๆ ได้เลย ไม่ต้อง
//    mirror มาที่ globalThis
//
// วิธี mock Turnstile: mountTurnstile(tsEl) ถูกเรียกทุกครั้งที่เปิดฟอร์ม (ไม่ await) — ถ้าไม่ได้
// ตั้ง window.turnstile ไว้ก่อนเปิดฟอร์ม มันจะสร้าง <script> รอ callback ที่ไม่มีวันมาถึงใน jsdom
// (เหมือน test/lead-quote-modal-focus-trap.test.mjs หมายเหตุ) ค้าง pending เฉยๆ ไม่ throw — เรียก
// openQuoteRequestForm() ก่อนแล้วค่อยตั้ง window.turnstile + dataset.tsWidgetId บน #qr-turnstile
// เองตรงๆ ทีหลัง (แพทเทิร์นเดียวกับ setTurnstileToken() ใน lead-quote-modal-form-flow.test.mjs)
// เพื่อเลี่ยง race กับ ensureCard()/renderWidget() ที่ทำงานจริงแบบ async
//
// วิธี mock verifyTurnstileToken(): js/db-quote-requests.js เรียก `fetch()` แบบ bare global
// identifier ตรงๆ (คัดลอกมาจาก js/leads.js) — monkey-patch globalThis.fetch ตรงๆ ได้เลย ต้อง
// restore กลับใน afterEach เสมอ
//
// isValidThaiTaxId()/saveQuoteRequest() import จริงจาก js/db-quote-requests.js (ไม่ใช่ stub) —
// เฉพาะ Firebase SDK ที่ไฟล์นั้น import ต่อ (ผ่าน js/db.js) ถูก stub ด้วย firebase-stub-loader.mjs
// ตามปกติ (ลงทะเบียนไว้แล้วใน test/helpers/register-loader.mjs)
//
// sendLeadEmails() reuse จาก js/email-notify.js (dynamic import()) — ผ่าน emailjs-stub-loader.mjs
// เดิม เก็บ arg ไว้ใน globalThis.__EMAILJS_SEND_CALLS__ ตรวจ mapped fields ได้
//
// ไม่ได้แก้ไฟล์ .js/.html/.css ที่เป็นโค้ดจริงเลยแม้แต่บรรทัดเดียวในไฟล์นี้ — งานทดสอบล้วนๆ

import { test, describe, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const QR_TEMPLATE_SRC = readFileSync(new URL("../js/quote-form-template.js", import.meta.url), "utf-8");
const QR_HTML_MATCH = QR_TEMPLATE_SRC.match(/var FORM_DEFAULT = `([\s\S]*?)`;/);
if (!QR_HTML_MATCH) throw new Error("quote-form-flow.test.mjs: ดึง template literal จาก js/quote-form-template.js ไม่สำเร็จ (โครงสร้างไฟล์อาจเปลี่ยนไป)");
const QR_HTML = QR_HTML_MATCH[1];

const ORIGINAL_FETCH = globalThis.fetch;

function makeDom(extraBodyHtml, url) {
  return new JSDOM(
    `<!doctype html><html><body>${extraBodyHtml || ""}${QR_HTML}</body></html>`,
    { url: url || "https://example.test/products.html" }
  );
}

const SAMPLE_ITEMS = [
  { productId: "p1", name: "ป้ายไฟ LED หน้าร้าน", size: "100x50 ซม.", material: "อะคริลิค", variantLabel: "", qty: 2, unit: "ชิ้น", note: "" },
  { productId: "p2", name: "ป้ายความปลอดภัย", size: "", material: "", variantLabel: "แบบสติ๊กเกอร์", qty: 5, unit: "แผ่น", note: "" }
];

// stub window.CSSignCart.getCartItems()/clearCart() — ไม่มีอยู่จริงใน jsdom test (js/cart-global.js
// ไม่ได้ถูก import ในไฟล์นี้เลย) ตามที่บันทึกไว้ใน continue-prompt รอบนี้
function stubCart(dom, items) {
  const calls = { clearCartCallCount: 0 };
  dom.window.CSSignCart = {
    getCartItems: () => items,
    clearCart: () => { calls.clearCartCallCount += 1; }
  };
  return calls;
}

async function loadQuoteForm(dom) {
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.MouseEvent = dom.window.MouseEvent;
  globalThis.KeyboardEvent = dom.window.KeyboardEvent;
  // form-toast.js เรียก requestAnimationFrame() แบบ bare identifier ตอนแสดง toast (showToast())
  globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);
  await import(`../js/quote-form.js?t=${Date.now()}-${Math.random()}`);
}

function bypassAntiSpamTimeTrap(dom) {
  dom.window.document.getElementById("qr-form").dataset.antiSpamLoadedAt = String(Date.now() - 5000);
}

// ตั้ง window.turnstile + dataset.tsWidgetId ตรงๆ หลังเปิดฟอร์มแล้ว (ดูหมายเหตุหัวไฟล์)
function setTurnstileToken(dom, token) {
  const state = { resetCallCount: 0 };
  dom.window.turnstile = {
    getResponse: () => token,
    reset: () => { state.resetCallCount += 1; }
  };
  dom.window.document.getElementById("qr-turnstile").dataset.tsWidgetId = "test-widget-1";
  return state;
}

function mockVerifyFetch(mode) {
  const calls = [];
  globalThis.fetch = async (url, opts) => {
    calls.push({ url, body: opts && opts.body ? JSON.parse(opts.body) : null });
    if (mode === "network-error") throw new Error("simulated network failure");
    if (mode === "invalid") return { ok: true, json: async () => ({ success: false }) };
    return { ok: true, json: async () => ({ success: true }) };
  };
  return calls;
}

function fillForm(dom, { name = "บริษัท ทดสอบ จำกัด", taxId = "", contactPerson = "คุณทดสอบ", phone = "0891234567", email = "", agree = true } = {}) {
  const { document } = dom.window;
  document.getElementById("qr-name").value = name;
  if (taxId) document.getElementById("qr-taxid").value = taxId;
  document.getElementById("qr-contact-person").value = contactPerson;
  document.getElementById("qr-phone").value = phone;
  document.getElementById("qr-email").value = email;
  document.getElementById("qr-agree").checked = agree;
}

function submitForm(dom) {
  dom.window.document.getElementById("qr-form").dispatchEvent(
    new dom.window.Event("submit", { bubbles: true, cancelable: true })
  );
}

function click(dom, el) {
  el.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
}

function nextTick() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toastMsg(dom, type) {
  const el = dom.window.document.querySelector(`.cs-toast-host .cs-toast--${type} .cs-toast-msg`);
  return el ? el.textContent : null;
}

function resetAddDocCalls() {
  globalThis.__ADD_DOC_CALLS__ = [];
}
function lastAddDocCall() {
  const calls = globalThis.__ADD_DOC_CALLS__ || [];
  return calls.length ? calls[calls.length - 1] : null;
}
function resetEmailSendCalls() {
  globalThis.__EMAILJS_SEND_CALLS__ = [];
}

describe("js/quote-form.js — flow ฟอร์มขอใบเสนอราคาจากตะกร้า (P3.0 Phase 2 รอบย่อย 3)", () => {
  afterEach(() => {
    globalThis.fetch = ORIGINAL_FETCH;
  });

  test("ตะกร้าว่างตอนเปิด: ไม่เปิดฟอร์ม (overlay ยังคง display:none) + toast เตือน + นำทางไป products.html หลัง 1.5 วิ", async () => {
    const dom = makeDom();
    await loadQuoteForm(dom);
    stubCart(dom, []);

    dom.window.openQuoteRequestForm();
    await nextTick();

    const { document } = dom.window;
    assert.equal(document.getElementById("qr-overlay").style.display, "none");
    assert.equal(toastMsg(dom, "warn"), "กรุณาเลือกสินค้าอย่างน้อย 1 ชิ้นก่อนขอใบเสนอราคา");

    await wait(1600);
    assert.equal(dom.window.location.href, "https://example.test/products.html");
  });

  test("ตะกร้ามีสินค้า: เปิดฟอร์มได้ปกติ + render รายการสินค้า read-only ใน #qr-items-list", async () => {
    const dom = makeDom();
    await loadQuoteForm(dom);
    stubCart(dom, SAMPLE_ITEMS);

    dom.window.openQuoteRequestForm();

    const { document } = dom.window;
    assert.equal(document.getElementById("qr-overlay").style.display, "flex");
    const itemsList = document.getElementById("qr-items-list");
    assert.equal(itemsList.querySelectorAll(".cm-item").length, 2);
    assert.match(itemsList.textContent, /ป้ายไฟ LED หน้าร้าน/);
    assert.match(itemsList.textContent, /100x50 ซม\./);
    assert.match(itemsList.textContent, /อะคริลิค/);
    assert.match(itemsList.textContent, /จำนวน 2 ชิ้น/);
    assert.match(itemsList.textContent, /ป้ายความปลอดภัย/);
    assert.match(itemsList.textContent, /แบบสติ๊กเกอร์/);
    assert.match(itemsList.textContent, /จำนวน 5 แผ่น/);
    // read-only — ไม่มีปุ่มแก้ไข/ลบ (.cm-item-side ของ cart-modal.js เดิม)
    assert.equal(itemsList.querySelectorAll(".cm-item-side").length, 0);
  });

  test("isValidThaiTaxId() ตอน blur: กรอกเลขผิด checksum → error ใต้ช่อง, ไม่กรอกเลย → ผ่าน (optional)", async () => {
    const dom = makeDom();
    await loadQuoteForm(dom);
    stubCart(dom, SAMPLE_ITEMS);
    dom.window.openQuoteRequestForm();
    const { document } = dom.window;

    const taxIdInput = document.getElementById("qr-taxid");
    taxIdInput.value = "1234567890123"; // checksum ผิด (สุ่มเลข 13 หลักเฉยๆ)
    taxIdInput.dispatchEvent(new dom.window.Event("blur", { bubbles: true }));
    assert.equal(taxIdInput.classList.contains("has-error"), true);
    assert.equal(taxIdInput.nextElementSibling.textContent, "เลขผู้เสียภาษีไม่ถูกต้อง กรุณาตรวจสอบตัวเลข 13 หลักที่กรอก");

    taxIdInput.value = "";
    taxIdInput.dispatchEvent(new dom.window.Event("blur", { bubbles: true }));
    assert.equal(taxIdInput.classList.contains("has-error"), false);
  });

  test("submit พร้อมเลขผู้เสียภาษีผิด checksum: ไม่เรียก saveQuoteRequest (ไม่มี addDoc call ใหม่)", async () => {
    const dom = makeDom();
    await loadQuoteForm(dom);
    stubCart(dom, SAMPLE_ITEMS);
    dom.window.openQuoteRequestForm();
    bypassAntiSpamTimeTrap(dom);
    setTurnstileToken(dom, "tok-1");
    mockVerifyFetch("success");
    resetAddDocCalls();

    fillForm(dom, { taxId: "1234567890123" });
    submitForm(dom);
    await nextTick();

    assert.equal(lastAddDocCall(), null);
  });

  test('checkbox "ที่อยู่จัดส่งเหมือนที่อยู่ออกใบกำกับ": ติ๊กแล้ว copy ค่า + disable, ยกเลิกติ๊กแล้ว enable กลับ (ไม่ล้างค่า)', async () => {
    const dom = makeDom();
    await loadQuoteForm(dom);
    stubCart(dom, SAMPLE_ITEMS);
    dom.window.openQuoteRequestForm();
    const { document } = dom.window;

    const billingInput = document.getElementById("qr-billing-address");
    const shippingInput = document.getElementById("qr-shipping-address");
    const sameCheckbox = document.getElementById("qr-shipping-same");

    billingInput.value = "123 ถนนทดสอบ กรุงเทพฯ 10110";
    sameCheckbox.checked = true;
    sameCheckbox.dispatchEvent(new dom.window.Event("change", { bubbles: true }));

    assert.equal(shippingInput.value, "123 ถนนทดสอบ กรุงเทพฯ 10110");
    assert.equal(shippingInput.disabled, true);

    sameCheckbox.checked = false;
    sameCheckbox.dispatchEvent(new dom.window.Event("change", { bubbles: true }));

    assert.equal(shippingInput.disabled, false);
    // ไม่ล้างค่าที่เคย copy ไว้ (ตามคอมเมนต์ในโค้ดจริง)
    assert.equal(shippingInput.value, "123 ถนนทดสอบ กรุงเทพฯ 10110");
  });

  test("submit สำเร็จ: saveQuoteRequest() บันทึกครบ (payload.items ตรงกับ snapshot ตอนเปิดฟอร์ม), sendLeadEmails() reuse ด้วย mapped fields ถูกต้อง, clearCart()/closeCartModal() ถูกเรียก", async () => {
    const dom = makeDom();
    await loadQuoteForm(dom);
    const cartCalls = stubCart(dom, SAMPLE_ITEMS);
    let closeCartModalCallCount = 0;
    dom.window.closeCartModal = () => { closeCartModalCallCount += 1; };

    dom.window.openQuoteRequestForm();
    bypassAntiSpamTimeTrap(dom);
    setTurnstileToken(dom, "tok-1");
    mockVerifyFetch("success");
    resetAddDocCalls();
    resetEmailSendCalls();

    fillForm(dom, { name: "บริษัท ทดสอบ จำกัด", contactPerson: "คุณทดสอบ", phone: "0891234567", email: "test@example.com" });
    dom.window.document.getElementById("qr-notes").value = "ต้องการด่วน";
    submitForm(dom);
    await nextTick();
    await nextTick();
    await nextTick();

    const call = lastAddDocCall();
    assert.ok(call, "ควรมีการเรียก addDoc() หลัง submit สำเร็จ");
    assert.equal(call.path, "quote_requests");
    assert.equal(call.payload.billingName, "บริษัท ทดสอบ จำกัด");
    assert.equal(call.payload.contactPerson, "คุณทดสอบ");
    assert.equal(call.payload.phone, "0891234567");
    assert.equal(call.payload.email, "test@example.com");
    assert.equal(call.payload.notes, "ต้องการด่วน");
    assert.equal(call.payload.source, "quote_request_cart");
    assert.equal(call.payload.status, "new");
    assert.equal(call.payload.items.length, 2);
    assert.equal(call.payload.items[0].name, "ป้ายไฟ LED หน้าร้าน");
    assert.equal(call.payload.items[0].qty, 2);
    assert.equal(call.payload.items[1].name, "ป้ายความปลอดภัย");

    const emailCalls = globalThis.__EMAILJS_SEND_CALLS__ || [];
    assert.equal(emailCalls.length, 2, "ควรส่ง 2 อีเมล (auto-reply ลูกค้า + แจ้งทีมงานภายใน)");
    const internalCall = emailCalls.find((c) => c.params.lead_name !== undefined);
    assert.ok(internalCall, "ควรมี call ที่ map name→lead_name (แจ้งทีมงานภายใน)");
    assert.equal(internalCall.params.lead_name, "บริษัท ทดสอบ จำกัด");
    assert.equal(internalCall.params.lead_email, "test@example.com");
    assert.equal(internalCall.params.lead_phone, "0891234567");
    assert.match(internalCall.params.lead_message, /ป้ายไฟ LED หน้าร้าน x2/);
    assert.match(internalCall.params.lead_message, /ป้ายความปลอดภัย x5/);
    assert.match(internalCall.params.lead_message, /ต้องการด่วน/);

    assert.equal(cartCalls.clearCartCallCount, 1, "ควรเรียก clearCart() หลัง submit สำเร็จ");
    assert.equal(closeCartModalCallCount, 1, "ควรเรียก closeCartModal() หลัง submit สำเร็จ");

    const { document } = dom.window;
    assert.equal(document.getElementById("qr-success").style.display, "flex");
  });

  test("ยังไม่ติ๊กยอมรับนโยบายความเป็นส่วนตัว: แสดง toast เตือน ไม่เรียก saveQuoteRequest", async () => {
    const dom = makeDom();
    await loadQuoteForm(dom);
    stubCart(dom, SAMPLE_ITEMS);
    dom.window.openQuoteRequestForm();
    bypassAntiSpamTimeTrap(dom);
    setTurnstileToken(dom, "tok-1");
    mockVerifyFetch("success");
    resetAddDocCalls();

    fillForm(dom, { agree: false });
    submitForm(dom);
    await nextTick();

    assert.equal(toastMsg(dom, "warn"), "กรุณายอมรับนโยบายความเป็นส่วนตัวก่อนส่งฟอร์ม");
    assert.equal(lastAddDocCall(), null);
  });

  test("ยังไม่ยืนยันตัวตน Turnstile (token ว่าง): แสดง toast เตือน ไม่เรียก saveQuoteRequest", async () => {
    const dom = makeDom();
    await loadQuoteForm(dom);
    stubCart(dom, SAMPLE_ITEMS);
    dom.window.openQuoteRequestForm();
    bypassAntiSpamTimeTrap(dom);
    // ไม่เรียก setTurnstileToken() เลย — window.turnstile ยังไม่พร้อม (เหมือนสภาพจริงตอน
    // mountTurnstile() ยังโหลดไม่เสร็จ)
    mockVerifyFetch("success");
    resetAddDocCalls();

    fillForm(dom);
    submitForm(dom);
    await nextTick();

    assert.equal(toastMsg(dom, "warn"), "กรุณายืนยันตัวตน (แคปช่า) ก่อนส่งฟอร์ม");
    assert.equal(lastAddDocCall(), null);
  });

  test("honeypot โดนกรอก (บอท): โชว์ success ปลอมๆ แต่ไม่บันทึกจริง (ไม่เรียก addDoc)", async () => {
    const dom = makeDom();
    await loadQuoteForm(dom);
    stubCart(dom, SAMPLE_ITEMS);
    dom.window.openQuoteRequestForm();
    bypassAntiSpamTimeTrap(dom);
    setTurnstileToken(dom, "tok-1");
    mockVerifyFetch("success");
    resetAddDocCalls();

    const { document } = dom.window;
    fillForm(dom);
    document.querySelector('#qr-form [name="website"]').value = "http://spam.example";
    submitForm(dom);
    await nextTick();

    assert.equal(document.getElementById("qr-success").style.display, "flex");
    assert.equal(lastAddDocCall(), null);
  });

  test("ไม่กรอกชื่อ (required): แสดง error ใต้ช่องชื่อ ไม่เรียก saveQuoteRequest", async () => {
    const dom = makeDom();
    await loadQuoteForm(dom);
    stubCart(dom, SAMPLE_ITEMS);
    dom.window.openQuoteRequestForm();
    bypassAntiSpamTimeTrap(dom);
    setTurnstileToken(dom, "tok-1");
    mockVerifyFetch("success");
    resetAddDocCalls();

    fillForm(dom, { name: "" });
    submitForm(dom);
    await nextTick();

    const { document } = dom.window;
    const nameInput = document.getElementById("qr-name");
    assert.equal(nameInput.classList.contains("has-error"), true);
    assert.equal(lastAddDocCall(), null);
  });

  test("มิเรอร์ EN: หน้า en/products.html แสดงข้อความอังกฤษครบ (title/label ตัวอย่าง + payment terms options)", async () => {
    const dom = makeDom(undefined, "https://example.test/en/products.html");
    await loadQuoteForm(dom);
    const { document } = dom.window;

    assert.equal(document.getElementById("qr-title").textContent, "Request a Quotation");
    assert.equal(document.getElementById("qr-label-phone").textContent, "Phone number *");
    assert.equal(document.getElementById("qr-submit-label").textContent, "Send Quote Request");
    const ptSel = document.getElementById("qr-payment-terms");
    assert.equal(ptSel.querySelector('option[value="cash_on_delivery"]').textContent, "Cash on delivery");
  });

  test("ตะกร้าว่างตอนเปิดหน้า EN: toast เป็นข้อความอังกฤษ + นำทางไป products.html (relative path ชี้ถูกที่ en/products.html)", async () => {
    const dom = makeDom(undefined, "https://example.test/en/products.html");
    await loadQuoteForm(dom);
    stubCart(dom, []);

    dom.window.openQuoteRequestForm();
    await nextTick();

    assert.equal(toastMsg(dom, "warn"), "Please add at least one product before requesting a quote.");

    await wait(1600);
    assert.equal(dom.window.location.href, "https://example.test/en/products.html");
  });
});
