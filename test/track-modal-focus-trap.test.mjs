// test/track-modal-focus-trap.test.mjs
//
// jsdom test อย่างเป็นทางการสำหรับกลไกป๊อปอัพ "เช็คสถานะคำสั่งผลิต" (#tm-overlay) ของ
// js/track-modal.js — เปิด/ปิด, Tab-trap วน 2 ทิศทาง, Escape, return-focus, ปิดผ่านปุ่ม/
// backdrop-click — บันทึกไว้เป็นรายการ "รู้แล้วแต่ตั้งใจไม่แก้" ข้อ 1 ของรอบ 55/58/59 (Escape/
// return-focus มีอยู่แล้วเดิมตั้งแต่รอบ 58 — ยังไม่มี test เป็นทางการ) หยิบมาทำในรอบที่ 62 นี้
//
// ขอบเขตรอบนี้ (ตั้งใจ): ทดสอบเฉพาะ "กลไกป๊อปอัพ" (เปิด/ปิด/focus-trap/Escape/return-focus/
// backdrop-click) เท่านั้น — ไม่ทดสอบ flow การกรอกฟอร์ม/trackOrderStatus()/renderResult() เพราะ
// นอกขอบเขตของรายการนี้ (ดู REFACTOR-PROGRESS.md รอบที่ 62) เหมือนกับที่
// test/chat-widget-focus-trap.test.mjs ไม่ทดสอบ flow การส่งข้อความแชทจริงเช่นกัน — ถ้าจะเพิ่ม
// test สำหรับ renderResult()/scrollIntoView() ในอนาคต ต้อง stub
// HTMLElement.prototype.scrollIntoView ก่อน import เสมอ (ดูหมายเหตุสะสมจากรอบ 61)
//
// วิธีทดสอบ: js/track-modal.js ทำ document.getElementById() แบบ eager ที่ module scope กับ
// element ของป๊อปอัพเอง (ไม่มี import chain ลึกแบบ orders-tab-modal.js — import แค่
// ./db-orders.js ซึ่งพึ่ง Firebase SDK ผ่าน firebase-stub-loader.mjs ที่ลงทะเบียนไว้แล้วใน
// test/helpers/register-loader.mjs ตามปกติ) — ใช้ HTML markup จริงจาก js/track-modal-template.js
// (อ่านด้วย readFileSync แล้วดึง template literal ด้วย regex) เป็น fixture แทนการพิมพ์ markup
// สั้นๆ เอง เพื่อให้ตรงกับของจริง 100% (แพทเทิร์นเดียวกับที่ใช้ใน
// test/orders-tab-modal-focus-trap.test.mjs รอบที่ 61) — เพิ่มปุ่ม trigger
// ([data-track-modal-open]) และปุ่มนอกป๊อปอัพเองสำหรับทดสอบ return-focus
//
// ไม่ได้แก้ไฟล์ .js/.html/.css ที่เป็นโค้ดจริงเลยแม้แต่บรรทัดเดียวในไฟล์นี้ — งานทดสอบล้วนๆ

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const TM_TEMPLATE_SRC = readFileSync(new URL("../js/track-modal-template.js", import.meta.url), "utf-8");
const TM_HTML_MATCH = TM_TEMPLATE_SRC.match(/var HTML = `([\s\S]*?)`;/);
if (!TM_HTML_MATCH) throw new Error("track-modal-focus-trap.test.mjs: ดึง template literal จาก js/track-modal-template.js ไม่สำเร็จ (โครงสร้างไฟล์อาจเปลี่ยนไป)");
const TM_HTML = TM_HTML_MATCH[1];

const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), textarea:not([disabled]), ' +
  'input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function makeDom() {
  return new JSDOM(
    `<!doctype html><html><body>
      <button id="outside-btn">outside</button>
      <button id="tm-trigger" data-track-modal-open>เช็คสถานะคำสั่งผลิต</button>
      ${TM_HTML}
    </body></html>`,
    { url: "https://example.test/" }
  );
}

async function loadTrackModal(dom) {
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.MouseEvent = dom.window.MouseEvent;
  globalThis.KeyboardEvent = dom.window.KeyboardEvent;
  // openModal() เรียก requestAnimationFrame() เพื่อโฟกัส #tm-code หลังเปิด — jsdom ไม่มี
  // requestAnimationFrame ที่ยิงจริงใน Node test runner context นี้ (ต่างจาก browser) จึง stub
  // ด้วย setTimeout(cb, 0) เหมือนแพทเทิร์นเดียวกับ test/chat-widget-focus-trap.test.mjs
  globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);
  await import(`../js/track-modal.js?t=${Date.now()}-${Math.random()}`);
}

function click(dom, el) {
  el.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
}
function keydown(dom, key, opts = {}) {
  dom.window.document.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...opts }));
}
// รอ 1 tick ให้ requestAnimationFrame (stub เป็น setTimeout 0) ทำงานจบก่อน — ใช้ตอนเช็คโฟกัส
// เข้า #tm-code หลังเปิดป๊อปอัพ
function nextTick() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe("js/track-modal.js — #tm-overlay เปิด/ปิด/Tab-trap/Escape/return-focus (Escape/return-focus เดิมมีอยู่แล้วตั้งแต่รอบ 58, formalize เป็น test รอบที่ 62)", () => {
  test("คลิกปุ่ม [data-track-modal-open] เปิดป๊อปอัพ (display:flex) และโฟกัสเข้า #tm-code อัตโนมัติ (ผ่าน requestAnimationFrame)", async () => {
    const dom = makeDom();
    await loadTrackModal(dom);
    const { document } = dom.window;
    const trigger = document.getElementById("tm-trigger");
    const overlay = document.getElementById("tm-overlay");
    const codeInput = document.getElementById("tm-code");

    click(dom, trigger);
    assert.equal(overlay.style.display, "flex");

    await nextTick();
    assert.equal(document.activeElement, codeInput);
  });

  test("window.openTrackModal()/window.closeTrackModal() ถูก expose ไว้ และเรียกเปิด/ปิดได้ตรงกับปุ่มจริง", async () => {
    const dom = makeDom();
    await loadTrackModal(dom);
    const { document } = dom.window;
    const overlay = document.getElementById("tm-overlay");

    assert.equal(typeof dom.window.openTrackModal, "function");
    assert.equal(typeof dom.window.closeTrackModal, "function");

    dom.window.openTrackModal();
    assert.equal(overlay.style.display, "flex");
    dom.window.closeTrackModal();
    assert.equal(overlay.style.display, "none");
  });

  test("Tab จาก focusable ตัวสุดท้ายในป๊อปอัพ (ลิงก์โทร 062-883-3880 ท้าย .tm-help) วนกลับไปตัวแรก (#tm-close)", async () => {
    const dom = makeDom();
    await loadTrackModal(dom);
    const { document } = dom.window;
    const overlay = document.getElementById("tm-overlay");
    const trigger = document.getElementById("tm-trigger");

    click(dom, trigger);
    const focusables = Array.from(overlay.querySelectorAll(FOCUSABLE_SELECTOR));
    assert.ok(focusables.length > 1, "ป๊อปอัพนี้ควรมี focusable element หลายตัว");
    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    last.focus();
    keydown(dom, "Tab");

    assert.equal(document.activeElement, first);
  });

  test("Shift+Tab จาก focusable ตัวแรก (#tm-close) วนไปตัวสุดท้ายในป๊อปอัพ", async () => {
    const dom = makeDom();
    await loadTrackModal(dom);
    const { document } = dom.window;
    const overlay = document.getElementById("tm-overlay");
    const trigger = document.getElementById("tm-trigger");

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
    await loadTrackModal(dom);
    const { document } = dom.window;
    const outsideBtn = document.getElementById("outside-btn");
    const trigger = document.getElementById("tm-trigger");
    const overlay = document.getElementById("tm-overlay");

    outsideBtn.focus();
    click(dom, trigger);
    keydown(dom, "Escape");

    assert.equal(overlay.style.display, "none");
    assert.equal(document.activeElement, outsideBtn);
  });

  test("Escape ตอนป๊อปอัพปิดอยู่แล้วไม่ throw และไม่ทำอะไร (guard เช็ค overlay.style.display เดิมทำงานถูก)", async () => {
    const dom = makeDom();
    await loadTrackModal(dom);
    const { document } = dom.window;
    const overlay = document.getElementById("tm-overlay");

    assert.doesNotThrow(() => keydown(dom, "Escape"));
    assert.equal(overlay.style.display, "none");
  });

  test("ปุ่ม #tm-close ปิดป๊อปอัพและคืนโฟกัสได้เหมือนกับ Escape", async () => {
    const dom = makeDom();
    await loadTrackModal(dom);
    const { document } = dom.window;
    const outsideBtn = document.getElementById("outside-btn");
    const trigger = document.getElementById("tm-trigger");
    const overlay = document.getElementById("tm-overlay");
    const closeBtn = document.getElementById("tm-close");

    outsideBtn.focus();
    click(dom, trigger);
    click(dom, closeBtn);

    assert.equal(overlay.style.display, "none");
    assert.equal(document.activeElement, outsideBtn);
  });

  test("คลิก backdrop (#tm-overlay เอง ไม่ใช่ลูกข้างใน) ปิดป๊อปอัพได้ปกติ (listener เดิมไม่ถูกกระทบจากกลไก Tab-trap ใหม่)", async () => {
    const dom = makeDom();
    await loadTrackModal(dom);
    const { document } = dom.window;
    const trigger = document.getElementById("tm-trigger");
    const overlay = document.getElementById("tm-overlay");

    click(dom, trigger);
    assert.equal(overlay.style.display, "flex");
    click(dom, overlay);

    assert.equal(overlay.style.display, "none");
  });

  test("คลิกข้างในป๊อปอัพ (เช่น .tm-modal) ไม่ปิดป๊อปอัพ (e.target !== overlay จึงไม่เข้าเงื่อนไข backdrop-click)", async () => {
    const dom = makeDom();
    await loadTrackModal(dom);
    const { document } = dom.window;
    const trigger = document.getElementById("tm-trigger");
    const overlay = document.getElementById("tm-overlay");
    const modalBox = overlay.querySelector(".tm-modal");

    click(dom, trigger);
    click(dom, modalBox);

    assert.equal(overlay.style.display, "flex");
  });
});
