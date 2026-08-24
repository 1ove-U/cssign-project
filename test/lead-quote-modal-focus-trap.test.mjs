// test/lead-quote-modal-focus-trap.test.mjs
//
// jsdom test อย่างเป็นทางการสำหรับกลไกป๊อปอัพ "ขอใบเสนอราคา" (#qmodal-overlay) ของ
// js/lead-quote-modal.js — เปิด/ปิด, Tab-trap วน 2 ทิศทาง, Escape, return-focus, ปิดผ่านปุ่ม/
// backdrop-click, สลับแท็บ form/contact — บันทึกไว้เป็นรายการ "รู้แล้วแต่ตั้งใจไม่แก้" ข้อ 1 ของ
// รอบ 55/58/59 (Tab-trap + return-focus เพิ่มมาตั้งแต่รอบ 58 — ยังไม่มี test เป็นทางการ) หยิบมา
// ทำในรอบที่ 62 นี้ (คู่กับ track-modal.js — ดู test/track-modal-focus-trap.test.mjs)
//
// ขอบเขตรอบนี้ (ตั้งใจ): ทดสอบเฉพาะ "กลไกป๊อปอัพ" (เปิด/ปิด/focus-trap/Escape/return-focus/
// backdrop-click/สลับแท็บ) เท่านั้น — ไม่ทดสอบ flow การ submit ฟอร์มจริง (saveLead/
// sendLeadEmails/Turnstile/anti-spam/validateFormFields) เพราะนอกขอบเขตของรายการนี้และมี
// side-effect หลายชั้น (fetch จริงไปยัง Cloudflare Worker/Firestore/EmailJS) ที่ต้อง mock เพิ่ม
// อีกมาก — เหมาะเป็นรายการแยกต่างหากในรอบถัดๆ ไปถ้าต้องการ ไม่ใช่ของรอบนี้
//
// วิธีทดสอบ: js/lead-quote-modal.js ทำ document.getElementById() แบบ eager ที่ module scope กับ
// element ของป๊อปอัพเอง (import chain: ./leads.js → Firebase SDK ผ่าน firebase-stub-loader.mjs,
// ./email-notify.js → @emailjs/browser ผ่าน emailjs-stub-loader.mjs — ทั้งคู่ลงทะเบียนไว้แล้วใน
// test/helpers/register-loader.mjs ตามปกติ, ./anti-spam.js/./turnstile.js/./form-toast.js/
// ./form-validate.js ไม่ import อะไรเพิ่ม ไม่ต้อง stub อะไรเป็นพิเศษ) — ใช้ HTML markup จริงจาก
// js/qmodal-template.js (อ่านด้วย readFileSync แล้วดึง template literal ด้วย regex) เป็น fixture
// แทนการพิมพ์ markup สั้นๆ เอง เพื่อให้ตรงกับของจริง 100% (แพทเทิร์นเดียวกับ
// test/track-modal-focus-trap.test.mjs/test/orders-tab-modal-focus-trap.test.mjs)
//
// หมายเหตุ: openModal() เรียก mountTurnstile(tsEl) แบบไม่ await — ฟังก์ชันนั้นจะสร้าง
// <script src="https://challenges.cloudflare.com/..."> แล้วรอ callback ที่ไม่มีวันมาถึงใน jsdom
// (jsdom ไม่ fetch external resource จริงถ้าไม่ได้ตั้ง `resources: "usable"` ตอนสร้าง JSDOM — เรา
// ไม่ได้ตั้ง จึงไม่มีการยิง network จริง) ทำให้ apiPromise ค้าง pending เฉยๆ ตลอดไป ไม่ throw/
// ไม่ค้าง event loop (ไม่ใช่ timer/socket) จึงไม่กระทบผลการทดสอบใดๆ ที่ไม่ได้ await มันตรงๆ —
// ไม่ต้อง stub เพิ่มสำหรับ test ในไฟล์นี้
//
// หมายเหตุ jsdom ใหม่ที่พบในไฟล์นี้ (ไม่เคยเจอมาก่อนในรอบ 58-61): `window.openModal = function
// openModal(...) {...}` เป็นการ "assign เข้า window" ไม่ใช่ `function openModal(...) {}` แบบ
// declaration ตรงๆ — ปุ่ม "ขอใบเสนอราคา" ทั่วไซต์ (`button[data-open-quote]`) เรียก `openModal
// ('form')` แบบ bare identifier (ไม่ใช่ `window.openModal(...)`) ในโค้ดจริง ซึ่งทำงานได้ปกติใน
// เบราว์เซอร์จริงเพราะ `window` เป็นตัวเดียวกับ global scope (การ assign เข้า window.foo ทำให้
// `foo` เป็นตัวแปร global ไปในตัว) แต่ใน Node test runner ที่เราตั้ง `globalThis.window = dom.
// window` (คนละ object กับ globalThis เอง) การ assign เข้า `window.openModal` ไม่ทำให้ระบุตัวแปร
// bare `openModal` เจอในสโคป module ได้ (ReferenceError: openModal is not defined) — แก้โดย
// mirror `globalThis.openModal = dom.window.openModal` เพิ่มอีกบรรทัดหลัง import เสร็จ (ดู
// loadLeadQuoteModal() ด้านล่าง) ไม่กระทบโค้ดจริงเลย เป็นแค่การเชื่อม global scope ของ test
// harness ให้ตรงกับพฤติกรรมจริงของเบราว์เซอร์ — จำไว้สำหรับไฟล์อื่นในอนาคตที่มีแพทเทิร์น
// `window.someFn = function someFn() {...}` แล้วเรียกตัวเองแบบ bare identifier ที่อื่นในไฟล์
// เดียวกัน
//
// ไม่ได้แก้ไฟล์ .js/.html/.css ที่เป็นโค้ดจริงเลยแม้แต่บรรทัดเดียวในไฟล์นี้ — งานทดสอบล้วนๆ

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const QM_TEMPLATE_SRC = readFileSync(new URL("../js/qmodal-template.js", import.meta.url), "utf-8");
const QM_HTML_MATCH = QM_TEMPLATE_SRC.match(/var FORM_DEFAULT = `([\s\S]*?)`;/);
if (!QM_HTML_MATCH) throw new Error("lead-quote-modal-focus-trap.test.mjs: ดึง template literal จาก js/qmodal-template.js ไม่สำเร็จ (โครงสร้างไฟล์อาจเปลี่ยนไป)");
const QM_HTML = QM_HTML_MATCH[1];

const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), textarea:not([disabled]), ' +
  'input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function makeDom() {
  return new JSDOM(
    `<!doctype html><html><body>
      <button id="outside-btn">outside</button>
      <button id="qm-trigger" data-open-quote>ขอใบเสนอราคา</button>
      ${QM_HTML}
    </body></html>`,
    { url: "https://example.test/" }
  );
}

async function loadLeadQuoteModal(dom) {
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.MouseEvent = dom.window.MouseEvent;
  globalThis.KeyboardEvent = dom.window.KeyboardEvent;
  await import(`../js/lead-quote-modal.js?t=${Date.now()}-${Math.random()}`);
  // ดูหมายเหตุหัวไฟล์: window.openModal = function openModal(...) {...} ต้อง mirror มาที่
  // globalThis ด้วย เพราะโค้ดจริงในไฟล์นี้เรียกตัวเองแบบ bare identifier `openModal(...)` ที่อื่น
  // ในไฟล์เดียวกัน (ปุ่ม data-open-quote/estimator-quote-btn) ซึ่งพึ่ง global scope จริง ไม่ใช่
  // property ของ dom.window object ที่แยกจาก globalThis ใน test harness นี้
  globalThis.openModal = dom.window.openModal;
}

function click(dom, el) {
  el.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
}
function keydown(dom, key, opts = {}) {
  dom.window.document.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...opts }));
}

describe("js/lead-quote-modal.js — #qmodal-overlay เปิด/ปิด/Tab-trap/Escape/return-focus (เพิ่มมาตั้งแต่รอบ 58, formalize เป็น test รอบที่ 62)", () => {
  test("คลิกปุ่ม [data-open-quote] เปิดป๊อปอัพผ่าน window.openModal('form') (display:flex)", async () => {
    const dom = makeDom();
    await loadLeadQuoteModal(dom);
    const { document } = dom.window;
    const trigger = document.getElementById("qm-trigger");
    const overlay = document.getElementById("qmodal-overlay");

    assert.equal(typeof dom.window.openModal, "function", "window.openModal ต้องถูก expose ไว้ (เรียกจาก chat-widget.js/estimator ด้วย)");
    click(dom, trigger);

    assert.equal(overlay.style.display, "flex");
  });

  test("window.openModal(startTab, opts) เก็บ lastFocused ทุกครั้งที่เรียก และเปิดได้แม้เรียกตรงๆ โดยไม่ผ่านปุ่ม (เช่น จาก chat-widget.js/estimator)", async () => {
    const dom = makeDom();
    await loadLeadQuoteModal(dom);
    const { document } = dom.window;
    const outsideBtn = document.getElementById("outside-btn");
    const overlay = document.getElementById("qmodal-overlay");

    outsideBtn.focus();
    assert.doesNotThrow(() => dom.window.openModal("form", { source: "chat_widget" }));
    assert.equal(overlay.style.display, "flex");
  });

  test("Tab จาก focusable ตัวสุดท้ายในป๊อปอัพ (ลิงก์ LINE ท้ายแท็บ 'ติดต่อเรา') วนกลับไปตัวแรก (#qmodal-close)", async () => {
    const dom = makeDom();
    await loadLeadQuoteModal(dom);
    const { document } = dom.window;
    const trigger = document.getElementById("qm-trigger");
    const overlay = document.getElementById("qmodal-overlay");

    click(dom, trigger);
    const focusables = Array.from(overlay.querySelectorAll(FOCUSABLE_SELECTOR));
    assert.ok(focusables.length > 1, "ป๊อปอัพนี้ควรมี focusable element หลายตัว (ฟอร์มยาว + แท็บ 'ติดต่อเรา')");
    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    last.focus();
    keydown(dom, "Tab");

    assert.equal(document.activeElement, first);
  });

  test("Shift+Tab จาก focusable ตัวแรก (#qmodal-close) วนไปตัวสุดท้ายในป๊อปอัพ", async () => {
    const dom = makeDom();
    await loadLeadQuoteModal(dom);
    const { document } = dom.window;
    const trigger = document.getElementById("qm-trigger");
    const overlay = document.getElementById("qmodal-overlay");

    click(dom, trigger);
    const focusables = Array.from(overlay.querySelectorAll(FOCUSABLE_SELECTOR));
    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    first.focus();
    keydown(dom, "Tab", { shiftKey: true });

    assert.equal(document.activeElement, last);
  });

  test("Escape ปิดป๊อปอัพและคืนโฟกัสกลับไปที่ element ที่โฟกัสอยู่ก่อนเปิด", async () => {
    const dom = makeDom();
    await loadLeadQuoteModal(dom);
    const { document } = dom.window;
    const outsideBtn = document.getElementById("outside-btn");
    const trigger = document.getElementById("qm-trigger");
    const overlay = document.getElementById("qmodal-overlay");

    outsideBtn.focus();
    click(dom, trigger);
    keydown(dom, "Escape");

    assert.equal(overlay.style.display, "none");
    assert.equal(document.activeElement, outsideBtn);
  });

  test("Escape ตอนป๊อปอัพปิดอยู่ (ไม่เคยเปิด) ไม่ throw (closeModal() เดิมไม่มี guard เช็ค display ก่อน แต่ก็ไม่ throw เพราะแค่ set style/เช็ค qmLastFocused ที่เป็น null)", async () => {
    const dom = makeDom();
    await loadLeadQuoteModal(dom);

    assert.doesNotThrow(() => keydown(dom, "Escape"));
  });

  test("ปุ่ม #qmodal-close ปิดป๊อปอัพและคืนโฟกัสได้เหมือนกับ Escape", async () => {
    const dom = makeDom();
    await loadLeadQuoteModal(dom);
    const { document } = dom.window;
    const outsideBtn = document.getElementById("outside-btn");
    const trigger = document.getElementById("qm-trigger");
    const overlay = document.getElementById("qmodal-overlay");
    const closeBtn = document.getElementById("qmodal-close");

    outsideBtn.focus();
    click(dom, trigger);
    click(dom, closeBtn);

    assert.equal(overlay.style.display, "none");
    assert.equal(document.activeElement, outsideBtn);
  });

  test("คลิก backdrop (#qmodal-overlay เอง ไม่ใช่ลูกข้างใน) ปิดป๊อปอัพได้ปกติ (listener เดิมไม่ถูกกระทบจากกลไก Tab-trap ใหม่)", async () => {
    const dom = makeDom();
    await loadLeadQuoteModal(dom);
    const { document } = dom.window;
    const trigger = document.getElementById("qm-trigger");
    const overlay = document.getElementById("qmodal-overlay");

    click(dom, trigger);
    assert.equal(overlay.style.display, "flex");
    click(dom, overlay);

    assert.equal(overlay.style.display, "none");
  });

  test("คลิกข้างในป๊อปอัพ (เช่น .qmodal) ไม่ปิดป๊อปอัพ (e.target !== overlay จึงไม่เข้าเงื่อนไข backdrop-click)", async () => {
    const dom = makeDom();
    await loadLeadQuoteModal(dom);
    const { document } = dom.window;
    const trigger = document.getElementById("qm-trigger");
    const overlay = document.getElementById("qmodal-overlay");
    const modalBox = overlay.querySelector(".qmodal");

    click(dom, trigger);
    click(dom, modalBox);

    assert.equal(overlay.style.display, "flex");
  });

  test("openModal() ที่สองครั้งติดกันอัปเดต lastFocused ใหม่ทุกครั้ง (ไม่ใช่แค่ครั้งแรก) — ปิดแล้วคืนโฟกัสไปยัง element ล่าสุดที่โฟกัสก่อนเปิดครั้งหลังสุด", async () => {
    const dom = makeDom();
    await loadLeadQuoteModal(dom);
    const { document } = dom.window;
    const outsideBtn = document.getElementById("outside-btn");
    const trigger = document.getElementById("qm-trigger");
    const overlay = document.getElementById("qmodal-overlay");
    const closeBtn = document.getElementById("qmodal-close");

    // เปิด-ปิดรอบแรกโดยโฟกัสอยู่ที่ trigger
    trigger.focus();
    click(dom, trigger);
    click(dom, closeBtn);
    assert.equal(document.activeElement, trigger);

    // เปิดรอบสองโดยโฟกัสอยู่ที่ outsideBtn แทน — ปิดแล้วต้องคืนโฟกัสไปที่ outsideBtn ไม่ใช่ trigger เดิม
    outsideBtn.focus();
    dom.window.openModal("form");
    click(dom, closeBtn);
    assert.equal(document.activeElement, outsideBtn);
    assert.equal(overlay.style.display, "none");
  });
});
