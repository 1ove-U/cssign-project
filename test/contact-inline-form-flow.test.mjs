// test/contact-inline-form-flow.test.mjs
//
// jsdom test สำหรับ `window.handleInlineContactForm` ของฟอร์ม contact-inline-form ใน
// contact.html/en/contact.html — ฟังก์ชันนี้ยังไม่ได้แยกเป็นไฟล์ .js ต่างหาก ยังฝังอยู่ใน inline
// `<script type="module">` ของ HTML เอง (ต่างจาก js/lead-quote-modal.js/js/track-modal.js ที่แยก
// ไฟล์แล้ว) งานนี้ทำต่อจากรอบที่ 82 ที่ลบ `onsubmit="handleInlineContactForm(event)"` ออกแล้วผูก
// addEventListener('submit', ...) แทน แต่ยังไม่มีเทสยืนยัน — ทำในรอบที่ 83 นี้
//
// วิธีทดสอบ inline module script ที่ยังไม่ได้แยกไฟล์ (ไม่เหมือน pattern อื่นในโปรเจกต์นี้เลย เพราะ
// ไฟล์อื่นๆ ทั้งหมดแยกเป็น .js ต่างหากแล้ว): extract เนื้อ `<script type="module">...</script>`
// block ที่มี `window.handleInlineContactForm` ออกมาจาก contact.html/en/contact.html ด้วย regex
// ตอน test รัน แล้วเขียนลงไฟล์ temp จริงบนดิสก์ (ไม่ใช่ virtual module) เพื่อให้ dynamic import()
// ทำงานได้ปกติ:
// - ไฟล์ temp ของ TH ต้องอยู่ที่ project root (เพราะ import เป็น `./js/leads.js` แบบ relative)
// - ไฟล์ temp ของ EN ต้องอยู่ในโฟลเดอร์ `en/` (เพราะ import เป็น `../js/leads.js`)
// ลบไฟล์ temp ทิ้งเสมอใน after() กันขยะค้าง แม้ test จะ fail กลางคัน
//
// ทำไมไม่ต้อง query-string กัน module cache แบบไฟล์อื่น: ไฟล์ temp ทั้ง 2 ไฟล์เขียนครั้งเดียวใน
// before() (เนื้อหาคงที่ตลอดการรันไฟล์นี้) แต่ตัว dynamic import() เองยังต้องต่อ query string สุ่ม
// ทุกครั้งที่ import ในแต่ละ test case อยู่ดี — เพราะ IIFE ต้นไฟล์ (initAntiSpam/wireLiveValidation/
// mountTurnstile) ต้องรันใหม่ทุกครั้งผูกกับ document ของ dom ใหม่ในแต่ละ test (เหมือน pattern เดียวกับ
// test/lead-quote-modal-form-flow.test.mjs — import ซ้ำด้วย specifier เดิมจะได้ module จาก cache เก่า
// ไม่รัน top-level code ใหม่)
//
// mock dependency: ใช้แพทเทิร์นเดียวกับ test/lead-quote-modal-form-flow.test.mjs เป๊ะๆ
// - fetch() ของ js/leads.js (verifyTurnstileToken) → monkey-patch globalThis.fetch ตรงๆ
// - window.turnstile/container.dataset.tsWidgetId → ตั้งตรงๆ แทนเปิด popup จริง (mountTurnstile()
//   ที่ IIFE เรียกตอน import จะค้าง pending เฉยๆ เหมือนเดิมใน jsdom — ไม่กระทบ เพราะเราตั้ง
//   dataset.tsWidgetId ทับหลัง import อยู่ดี)
// - addDoc() ของ js/leads.js → capture ผ่าน globalThis.__ADD_DOC_CALLS__ (firebase-stub-loader.mjs
//   เดิม ไม่ต้องแก้/เพิ่ม stub loader ใหม่)
// - sendLeadEmails() (js/email-notify.js) ไม่ต้อง mock เพิ่ม — emailjs-stub-loader.mjs เดิมทำให้
//   emailjs.send() resolve เสมอ (ไม่ throw) อยู่แล้ว ไม่กระทบผลของ test นี้
//
// anti-spam time-trap: initAntiSpam(inlineForm) ถูกเรียกที่ IIFE ตอน import เหมือนกับ
// js/lead-quote-modal.js — ต้อง bypassAntiSpamTimeTrap() ก่อน submit ทุก test ที่ไม่ได้ตั้งใจทดสอบ
// anti-spam เอง (เลื่อน antiSpamLoadedAt ย้อนไปในอดีตให้พ้น MIN_FILL_MS)
//
// HTML markup: extract <form id="contact-inline-form">...</form> จาก contact.html/en/contact.html
// ด้วย regex เหมือนกับที่ทำกับ QM_HTML ใน test/lead-quote-modal-form-flow.test.mjs ให้ตรงกับของจริง
// 100% (ไม่พิมพ์ markup มือเอง กันหลุด sync กับไฟล์จริงในอนาคต)
//
// ขอบเขตรอบนี้ (ตั้งใจ): ทดสอบเฉพาะ flow การ submit ของฟอร์มนี้ (honeypot/time-trap spam,
// validation ฝั่ง client ไม่ผ่าน, ไม่ยอมรับนโยบาย, ไม่ยืนยัน Turnstile, saveLead() สำเร็จ,
// saveLead() throw — นี่คือบั๊กที่เคยแก้ไว้แล้วตามคอมเมนต์ในโค้ดของ contact.html เอง ต้องมีเทส
// ยืนยันไม่ให้กลับไปเป็นแบบเดิมที่โชว์ "ส่งสำเร็จ" ปลอมๆ ทั้งที่ Firestore บันทึกไม่สำเร็จ) — ทำทั้ง
// TH (contact.html) และ EN (en/contact.html) เพราะ path relative ต่างกัน แม้ logic จะเหมือนกัน
// (ตรวจ diff แล้วว่าต่างกันแค่ข้อความ/lang field ไม่ใช่ logic) — ไม่ทดสอบซ้ำ mountTurnstile()/
// focus-trap เพราะฟอร์มนี้ไม่ใช่ modal ไม่มี focus-trap อยู่แล้ว
//
// ไม่ได้แก้ไฟล์ .js/.html/.css ที่เป็นโค้ดจริงเลยแม้แต่บรรทัดเดียวในไฟล์นี้ — งานทดสอบล้วนๆ

import { test, describe, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, unlinkSync, existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { JSDOM } from "jsdom";

const PROJECT_ROOT = fileURLToPath(new URL("../", import.meta.url));

const ORIGINAL_FETCH = globalThis.fetch;

// ── ดึงเนื้อ <script type="module">...</script> ที่มี handleInlineContactForm ออกจาก HTML จริง ──
function extractInlineModuleScript(htmlPath) {
  const src = readFileSync(htmlPath, "utf-8");
  const m = src.match(/<script type="module">\nimport \{ saveLead \}[\s\S]*?\n<\/script>/);
  if (!m) {
    throw new Error(
      `contact-inline-form-flow.test.mjs: ดึง <script type="module"> ที่มี handleInlineContactForm จาก ${htmlPath} ไม่สำเร็จ (โครงสร้างไฟล์อาจเปลี่ยนไป)`
    );
  }
  // ตัดแท็ก <script type="module"> เปิด/ปิดออก เหลือแต่เนื้อ JS ล้วนๆ สำหรับเขียนเป็นไฟล์ .mjs
  return m[0].replace(/^<script type="module">\n/, "").replace(/\n<\/script>$/, "");
}

// ── ดึง <form id="contact-inline-form">...</form> ออกจาก HTML จริง (ให้ markup ตรงกับของจริง 100%) ──
function extractFormMarkup(htmlPath) {
  const src = readFileSync(htmlPath, "utf-8");
  const m = src.match(/<form id="contact-inline-form"[\s\S]*?<\/form>/);
  if (!m) {
    throw new Error(
      `contact-inline-form-flow.test.mjs: ดึง <form id="contact-inline-form"> จาก ${htmlPath} ไม่สำเร็จ (โครงสร้างไฟล์อาจเปลี่ยนไป)`
    );
  }
  return m[0];
}

const TH_HTML_PATH = path.join(PROJECT_ROOT, "contact.html");
const EN_HTML_PATH = path.join(PROJECT_ROOT, "en", "contact.html");

const TH_FORM_HTML = extractFormMarkup(TH_HTML_PATH);
const EN_FORM_HTML = extractFormMarkup(EN_HTML_PATH);

const TH_TMP_PATH = path.join(PROJECT_ROOT, "_tmp-contact-inline-form-th.mjs");
const EN_TMP_PATH = path.join(PROJECT_ROOT, "en", "_tmp-contact-inline-form-en.mjs");

before(() => {
  writeFileSync(TH_TMP_PATH, extractInlineModuleScript(TH_HTML_PATH), "utf-8");
  writeFileSync(EN_TMP_PATH, extractInlineModuleScript(EN_HTML_PATH), "utf-8");
});

after(() => {
  if (existsSync(TH_TMP_PATH)) unlinkSync(TH_TMP_PATH);
  if (existsSync(EN_TMP_PATH)) unlinkSync(EN_TMP_PATH);
});

function makeDom(formHtml) {
  return new JSDOM(`<!doctype html><html><body>${formHtml}</body></html>`, {
    url: "https://example.test/",
  });
}

async function loadInlineContactForm(dom, tmpModulePath) {
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
  globalThis.HTMLElement = dom.window.HTMLElement;
  // form-toast.js เรียก requestAnimationFrame() แบบ bare identifier ตอนแสดง toast (showToast())
  globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);
  const specifier = `${pathToFileURL(tmpModulePath).href}?t=${Date.now()}-${Math.random()}`;
  await import(specifier);
}

// initAntiSpam(form) ตั้ง antiSpamLoadedAt = Date.now() ตอน import — เลื่อนย้อนไปในอดีตให้พ้น
// MIN_FILL_MS (1500ms) ของ time-trap เพื่อไม่ให้ test ที่ไม่เกี่ยวกับ anti-spam โดนจับเป็นบอทไปด้วย
function bypassAntiSpamTimeTrap(dom) {
  dom.window.document.getElementById("contact-inline-form").dataset.antiSpamLoadedAt = String(Date.now() - 5000);
}

// ตั้งค่า window.turnstile + dataset.tsWidgetId ตรงๆ แทนรอ mountTurnstile() โหลด widget จริง
// (ดูหมายเหตุหัวไฟล์ — เหมือน setTurnstileToken() ใน test/lead-quote-modal-form-flow.test.mjs)
function setTurnstileToken(dom, token) {
  const state = { resetCallCount: 0, resetWidgetIds: [] };
  dom.window.turnstile = {
    getResponse: () => token,
    reset: (id) => {
      state.resetCallCount += 1;
      state.resetWidgetIds.push(id);
    },
  };
  dom.window.document.getElementById("cif-turnstile").dataset.tsWidgetId = "test-widget-1";
  return state;
}

// mode: "success" | "invalid" (server ปฏิเสธ token) — ครอบคลุมเท่าที่จำเป็นสำหรับขอบเขตรอบนี้
// (fail-open ของ network-error/bad-status ถูกทดสอบครบแล้วใน test/lead-quote-modal-form-flow.test.mjs
// กับ js/leads.js ตัวเดียวกัน ไม่ต้องทำซ้ำที่นี่ — ขอบเขตไฟล์นี้คือ flow ของ handleInlineContactForm)
function mockVerifyFetch(mode) {
  const calls = [];
  globalThis.fetch = async (url, opts) => {
    calls.push({ url, body: opts && opts.body ? JSON.parse(opts.body) : null });
    if (mode === "invalid") return { ok: true, json: async () => ({ success: false }) };
    return { ok: true, json: async () => ({ success: true }) };
  };
  return calls;
}

function resetAddDocCalls() {
  globalThis.__ADD_DOC_CALLS__ = [];
}
function lastAddDocCall() {
  const calls = globalThis.__ADD_DOC_CALLS__ || [];
  return calls.length ? calls[calls.length - 1] : null;
}

function fillForm(
  dom,
  {
    fname = "ทดสอบ",
    lname = "ระบบ",
    company = "",
    email = "test@example.com",
    tel = "0891234567",
    service = "ป้ายความปลอดภัย",
    qty = "1–10 ป้าย",
    message = "ทดสอบข้อความรายละเอียดโปรเจกต์",
    agree = true,
  } = {}
) {
  const { document } = dom.window;
  document.getElementById("cif-fname").value = fname;
  document.getElementById("cif-lname").value = lname;
  document.getElementById("cif-company").value = company;
  document.getElementById("cif-email").value = email;
  document.getElementById("cif-tel").value = tel;
  if (service) document.getElementById("cif-service").value = service;
  if (qty) document.getElementById("cif-qty").value = qty;
  document.getElementById("cif-msg").value = message;
  document.getElementById("cif-agree").checked = agree;
}

// ค่า default ของ fillForm() เป็นภาษาไทย ใช้ได้กับทั้ง TH/EN เพราะ <select> ไม่มี value attribute
// ชัดเจน (value = textContent ของ option) — EN ต้องส่ง service/qty เป็นข้อความอังกฤษแทน
function fillFormEn(dom, overrides = {}) {
  fillForm(dom, {
    service: "Safety Signs",
    qty: "1–10 signs",
    ...overrides,
  });
}

function submitForm(dom) {
  dom.window.document
    .getElementById("contact-inline-form")
    .dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
}

function nextTick() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function toastMsg(dom, type) {
  const el = dom.window.document.querySelector(`.cs-toast-host .cs-toast--${type} .cs-toast-msg`);
  return el ? el.textContent : null;
}

describe("contact.html (TH) — inline <script type=\"module\"> handleInlineContactForm — flow การ submit ฟอร์ม (รอบที่ 83)", () => {
  afterEach(() => {
    globalThis.fetch = ORIGINAL_FETCH;
  });

  test("ไม่กรอกช่องบังคับ (เช่นชื่อ): validateFormFields() ไม่ผ่าน — ไม่เรียก fetch()/saveLead(), ไม่โชว์ success", async () => {
    const dom = makeDom(TH_FORM_HTML);
    await loadInlineContactForm(dom, TH_TMP_PATH);
    bypassAntiSpamTimeTrap(dom);
    setTurnstileToken(dom, "tok-1");
    const calls = mockVerifyFetch("success");
    const { document } = dom.window;

    fillForm(dom, { fname: "" });
    submitForm(dom);
    await nextTick();

    const fnameInput = document.getElementById("cif-fname");
    assert.equal(fnameInput.classList.contains("has-error"), true);
    assert.equal(fnameInput.nextElementSibling.textContent, "กรุณากรอกข้อมูลในช่องนี้");
    assert.equal(calls.length, 0, "ไม่ควรเรียก fetch() เมื่อ validation ฝั่ง client ไม่ผ่าน");
    assert.equal(document.getElementById("cif-success").style.display, "none");
  });

  test("ติ๊กยอมรับนโยบายไว้แต่ยังไม่ได้ยืนยัน Turnstile (token ว่าง): แสดง toast เตือน ไม่เรียก fetch()", async () => {
    const dom = makeDom(TH_FORM_HTML);
    await loadInlineContactForm(dom, TH_TMP_PATH);
    bypassAntiSpamTimeTrap(dom);
    // ไม่เรียก setTurnstileToken() เลย — window.turnstile ยังเป็น undefined เหมือนสภาพจริงตอน
    // mountTurnstile() ยังโหลดไม่เสร็จ
    const calls = mockVerifyFetch("success");

    fillForm(dom, { agree: true });
    submitForm(dom);
    await nextTick();

    assert.equal(toastMsg(dom, "warn"), "กรุณายืนยันตัวตน (แคปช่า) ก่อนส่งฟอร์ม");
    assert.equal(calls.length, 0);
  });

  test("ฟอร์มถูกต้องแต่ยังไม่ติ๊กยอมรับนโยบายความเป็นส่วนตัว: แสดง toast เตือน ไม่เรียก fetch()", async () => {
    const dom = makeDom(TH_FORM_HTML);
    await loadInlineContactForm(dom, TH_TMP_PATH);
    bypassAntiSpamTimeTrap(dom);
    setTurnstileToken(dom, "tok-1");
    const calls = mockVerifyFetch("success");

    fillForm(dom, { agree: false });
    submitForm(dom);
    await nextTick();

    assert.equal(toastMsg(dom, "warn"), "กรุณายอมรับนโยบายความเป็นส่วนตัวก่อนส่งฟอร์ม");
    assert.equal(calls.length, 0);
  });

  test("บอทกรอก honeypot (name=\"website\"): submit เงียบ โชว์ success ปลอมแต่ไม่เรียก fetch()/บันทึกจริง", async () => {
    const dom = makeDom(TH_FORM_HTML);
    await loadInlineContactForm(dom, TH_TMP_PATH);
    bypassAntiSpamTimeTrap(dom); // แยกเหตุผลให้ชัดว่าโดนจับเพราะ honeypot ไม่ใช่ time-trap
    setTurnstileToken(dom, "tok-1");
    const calls = mockVerifyFetch("success");
    const { document } = dom.window;

    fillForm(dom, { agree: true });
    document.querySelector('input[name="website"]').value = "http://spam.example.com";
    submitForm(dom);
    await nextTick();

    assert.equal(calls.length, 0, "ไม่ควรเรียก fetch()/saveLead() เมื่อเข้าข่ายบอท");
    const success = document.getElementById("cif-success");
    assert.equal(success.style.display, "flex");
    assert.equal(document.getElementById("cif-fname").closest(".cif-field").style.display, "none");
  });

  test("บอท submit เร็วเกินไป (time-trap, ไม่ bypass): submit เงียบ โชว์ success ปลอมแต่ไม่เรียก fetch()", async () => {
    const dom = makeDom(TH_FORM_HTML);
    await loadInlineContactForm(dom, TH_TMP_PATH); // ไม่เรียก bypassAntiSpamTimeTrap()
    setTurnstileToken(dom, "tok-1");
    const calls = mockVerifyFetch("success");
    const { document } = dom.window;

    fillForm(dom, { agree: true });
    submitForm(dom);
    await nextTick();

    assert.equal(calls.length, 0);
    assert.equal(document.getElementById("cif-success").style.display, "flex");
  });

  test("submit สำเร็จ: เรียก saveLead() ผ่าน addDoc() ด้วย payload ถูกต้อง (source='contact_page_form'), resetTurnstile(), โชว์ success", async () => {
    const dom = makeDom(TH_FORM_HTML);
    await loadInlineContactForm(dom, TH_TMP_PATH);
    bypassAntiSpamTimeTrap(dom);
    const tsState = setTurnstileToken(dom, "real-turnstile-token-xyz");
    const calls = mockVerifyFetch("success");
    resetAddDocCalls();
    const { document } = dom.window;

    fillForm(dom, {
      fname: "สมชาย",
      lname: "ใจดี",
      company: "บริษัท ทดสอบ จำกัด",
      email: "somchai@example.com",
      tel: "0891234567",
      service: "ป้ายจราจรมาตรฐาน",
      qty: "11–50 ป้าย",
      message: "ต้องการป้ายจราจรติดตั้งหน้าโรงงาน",
      agree: true,
    });
    submitForm(dom);
    await nextTick();
    await nextTick();
    await nextTick();

    assert.equal(calls.length, 1, "ควรเรียก fetch() ยืนยัน Turnstile ก่อนบันทึก");
    assert.equal(calls[0].body.token, "real-turnstile-token-xyz");

    const call = lastAddDocCall();
    assert.ok(call, "ควรมีการเรียก addDoc() หลัง submit สำเร็จ");
    assert.equal(call.path, "leads");
    assert.equal(call.payload.name, "สมชาย ใจดี");
    assert.equal(call.payload.company, "บริษัท ทดสอบ จำกัด");
    assert.equal(call.payload.email, "somchai@example.com");
    assert.equal(call.payload.phone, "0891234567");
    assert.equal(call.payload.service, "ป้ายจราจรมาตรฐาน");
    assert.equal(call.payload.quantity, "11–50 ป้าย");
    assert.equal(call.payload.message, "ต้องการป้ายจราจรติดตั้งหน้าโรงงาน");
    assert.equal(call.payload.source, "contact_page_form");

    assert.equal(tsState.resetCallCount, 1, "ต้องเรียก resetTurnstile() หลัง submit สำเร็จ (token ใช้ได้ครั้งเดียว)");
    const success = document.getElementById("cif-success");
    assert.equal(success.style.display, "flex");
  });

  test("submit ล้มเหลว (saveLead() throw เพราะ server ปฏิเสธ Turnstile token): แสดง toast error แทน success ปลอมๆ, resetTurnstile(), ปุ่มคืนสภาพ — บั๊กที่เคยแก้แล้ว ต้องไม่กลับไปเป็นแบบเดิม", async () => {
    const dom = makeDom(TH_FORM_HTML);
    await loadInlineContactForm(dom, TH_TMP_PATH);
    bypassAntiSpamTimeTrap(dom);
    const tsState = setTurnstileToken(dom, "rejected-token");
    mockVerifyFetch("invalid");
    resetAddDocCalls();
    const { document } = dom.window;
    const submitBtn = document.querySelector(".cif-submit");
    const originalBtnHTML = submitBtn.innerHTML;

    fillForm(dom, { agree: true });
    submitForm(dom);
    await nextTick();
    await nextTick();
    await nextTick();

    assert.equal(
      toastMsg(dom, "error"),
      "ขออภัย ระบบไม่สามารถบันทึกข้อมูลได้ในขณะนี้ กรุณาลองส่งอีกครั้ง หรือโทรติดต่อทีมงานที่ 062-883-3880"
    );
    assert.equal(lastAddDocCall(), null, "ไม่ควรมีการบันทึก lead จริงเมื่อ saveLead() throw");
    assert.equal(tsState.resetCallCount, 1, "ต้อง resetTurnstile() หลัง saveLead() ล้มเหลวด้วย ไม่ใช่แค่ตอนสำเร็จ");
    assert.equal(submitBtn.disabled, false, "ปุ่มต้องคืนสภาพ (ไม่ถูกค้าง disabled) หลังล้มเหลว");
    assert.equal(submitBtn.innerHTML, originalBtnHTML, "ต้องคืน HTML เดิมของปุ่ม (มีไอคอนลูกศร) กลับมา");
    assert.equal(document.getElementById("cif-success").style.display, "none", "ห้ามโชว์ success ปลอมๆ เมื่อบันทึกจริงไม่สำเร็จ");
  });

  test("submit ซ้ำอีกครั้งหลัง error ครั้งแรก (retry): ถ้าครั้งที่สอง verify ผ่าน จะสำเร็จตามปกติ", async () => {
    const dom = makeDom(TH_FORM_HTML);
    await loadInlineContactForm(dom, TH_TMP_PATH);
    bypassAntiSpamTimeTrap(dom);
    setTurnstileToken(dom, "tok-retry");
    resetAddDocCalls();
    const { document } = dom.window;

    mockVerifyFetch("invalid");
    fillForm(dom, { agree: true });
    submitForm(dom);
    await nextTick();
    await nextTick();
    await nextTick();
    assert.equal(document.getElementById("cif-success").style.display, "none");
    assert.equal(lastAddDocCall(), null);

    mockVerifyFetch("success");
    fillForm(dom, { agree: true });
    submitForm(dom);
    await nextTick();
    await nextTick();
    await nextTick();

    assert.equal(document.getElementById("cif-success").style.display, "flex");
    assert.ok(lastAddDocCall());
  });
});

describe("en/contact.html (EN) — inline <script type=\"module\"> handleInlineContactForm — flow การ submit ฟอร์ม (รอบที่ 83)", () => {
  afterEach(() => {
    globalThis.fetch = ORIGINAL_FETCH;
  });

  test("ไม่กรอกช่องบังคับ: แสดง error ข้อความอังกฤษ (EN_MESSAGES) — ไม่เรียก fetch()", async () => {
    const dom = makeDom(EN_FORM_HTML);
    await loadInlineContactForm(dom, EN_TMP_PATH);
    bypassAntiSpamTimeTrap(dom);
    setTurnstileToken(dom, "tok-1");
    const calls = mockVerifyFetch("success");
    const { document } = dom.window;

    fillFormEn(dom, { fname: "" });
    submitForm(dom);
    await nextTick();

    const fnameInput = document.getElementById("cif-fname");
    assert.equal(fnameInput.classList.contains("has-error"), true);
    assert.equal(fnameInput.nextElementSibling.textContent, "Please fill in this field.");
    assert.equal(calls.length, 0);
  });

  test("ยังไม่ได้ยืนยัน Turnstile: แสดง toast เตือนภาษาอังกฤษ ไม่เรียก fetch()", async () => {
    const dom = makeDom(EN_FORM_HTML);
    await loadInlineContactForm(dom, EN_TMP_PATH);
    bypassAntiSpamTimeTrap(dom);
    const calls = mockVerifyFetch("success");

    fillFormEn(dom, { agree: true });
    submitForm(dom);
    await nextTick();

    assert.equal(toastMsg(dom, "warn"), "Please complete the verification (Turnstile) before submitting the form.");
    assert.equal(calls.length, 0);
  });

  test("ยังไม่ติ๊กยอมรับนโยบาย: แสดง toast เตือนภาษาอังกฤษ ไม่เรียก fetch()", async () => {
    const dom = makeDom(EN_FORM_HTML);
    await loadInlineContactForm(dom, EN_TMP_PATH);
    bypassAntiSpamTimeTrap(dom);
    setTurnstileToken(dom, "tok-1");
    const calls = mockVerifyFetch("success");

    fillFormEn(dom, { agree: false });
    submitForm(dom);
    await nextTick();

    assert.equal(toastMsg(dom, "warn"), "Please agree to the Privacy Policy before submitting the form.");
    assert.equal(calls.length, 0);
  });

  test("บอทกรอก honeypot: submit เงียบ โชว์ success ปลอมแต่ไม่เรียก fetch()", async () => {
    const dom = makeDom(EN_FORM_HTML);
    await loadInlineContactForm(dom, EN_TMP_PATH);
    bypassAntiSpamTimeTrap(dom);
    setTurnstileToken(dom, "tok-1");
    const calls = mockVerifyFetch("success");
    const { document } = dom.window;

    fillFormEn(dom, { agree: true });
    document.querySelector('input[name="website"]').value = "http://spam.example.com";
    submitForm(dom);
    await nextTick();

    assert.equal(calls.length, 0);
    assert.equal(document.getElementById("cif-success").style.display, "flex");
  });

  test("submit สำเร็จ: เรียก saveLead() ผ่าน addDoc() ด้วย payload ถูกต้อง (source='contact_page_form_en', lang='en')", async () => {
    const dom = makeDom(EN_FORM_HTML);
    await loadInlineContactForm(dom, EN_TMP_PATH);
    bypassAntiSpamTimeTrap(dom);
    const tsState = setTurnstileToken(dom, "real-turnstile-token-en");
    const calls = mockVerifyFetch("success");
    resetAddDocCalls();
    const { document } = dom.window;

    fillFormEn(dom, {
      fname: "John",
      lname: "Smith",
      company: "Test Co., Ltd.",
      email: "john@example.com",
      tel: "0891234567",
      service: "Custom Production",
      qty: "51–200 signs",
      message: "Need custom signage for our new office.",
      agree: true,
    });
    submitForm(dom);
    await nextTick();
    await nextTick();
    await nextTick();

    assert.equal(calls.length, 1);
    assert.equal(calls[0].body.token, "real-turnstile-token-en");

    const call = lastAddDocCall();
    assert.ok(call, "ควรมีการเรียก addDoc() หลัง submit สำเร็จ");
    assert.equal(call.path, "leads");
    assert.equal(call.payload.name, "John Smith");
    assert.equal(call.payload.service, "Custom Production");
    assert.equal(call.payload.quantity, "51–200 signs");
    assert.equal(call.payload.source, "contact_page_form_en");
    assert.equal(call.payload.lang, "en", "EN form ต้องส่ง lang:'en' เพิ่มเข้าไปใน payload (จุดต่างจาก TH)");

    assert.equal(tsState.resetCallCount, 1);
    assert.equal(document.getElementById("cif-success").style.display, "flex");
  });

  test("submit ล้มเหลว (saveLead() throw): แสดง toast error ภาษาอังกฤษแทน success ปลอมๆ — บั๊กที่เคยแก้แล้ว ต้องไม่กลับไปเป็นแบบเดิม", async () => {
    const dom = makeDom(EN_FORM_HTML);
    await loadInlineContactForm(dom, EN_TMP_PATH);
    bypassAntiSpamTimeTrap(dom);
    const tsState = setTurnstileToken(dom, "rejected-token-en");
    mockVerifyFetch("invalid");
    resetAddDocCalls();
    const { document } = dom.window;
    const submitBtn = document.querySelector(".cif-submit");
    const originalBtnHTML = submitBtn.innerHTML;

    fillFormEn(dom, { agree: true });
    submitForm(dom);
    await nextTick();
    await nextTick();
    await nextTick();

    assert.equal(
      toastMsg(dom, "error"),
      "Sorry, we could not save your information right now. Please try again, or call our team directly at +66 62-883-3880."
    );
    assert.equal(lastAddDocCall(), null);
    assert.equal(tsState.resetCallCount, 1);
    assert.equal(submitBtn.disabled, false);
    assert.equal(submitBtn.innerHTML, originalBtnHTML);
    assert.equal(document.getElementById("cif-success").style.display, "none");
  });
});
