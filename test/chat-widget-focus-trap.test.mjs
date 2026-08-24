// test/chat-widget-focus-trap.test.mjs
//
// jsdom test อย่างเป็นทางการสำหรับกลไก Escape/Tab-trap/return-focus ที่เพิ่มเข้า
// js/chat-widget.js (#chat-popup) ในรอบที่ 59 — ทำให้เป็นทางการตามที่บันทึกไว้ใน
// REFACTOR-PROGRESS.md (สมอกเทสต์ตอนแก้จริงเขียนยืนยันผ่านแล้วแต่ลบทิ้ง)
//
// วิธีทดสอบ: เหมือน test/admin-utils-focus-trap.test.mjs — ตั้ง globalThis.document/window/
// navigator ผ่าน jsdom ก่อน dynamic import("../js/chat-widget.js") เสมอ (ไฟล์นี้ import
// chat-widget-knowledge.js ที่พึ่ง Firebase SDK ผ่าน db-products.js/db-taxonomy.js/
// db-content.js/db-settings.js — ต้องพึ่ง firebase-stub-loader.mjs เหมือนกัน)
//
// หมายเหตุ: chat-widget.js เป็น IIFE (function(){...})() ที่ผูก event listener ตอน import
// ครั้งเดียว ไม่ export อะไรออกมาเลย (ต่างจาก admin-utils.js ที่ export openOverlay/
// closeOverlay ให้เรียกตรงๆ) — ทดสอบผ่านการจำลอง user interaction จริง (คลิกปุ่ม fab/
// closeBtn, ยิง keydown) แล้วตรวจ DOM state (classList/activeElement) เท่านั้น

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

function makeDom() {
  return new JSDOM(
    `<!doctype html><html><body>
      <button id="outside-btn">outside</button>

      <button class="chat-fab" id="chat-fab" aria-label="fab">
        <span class="chat-fab-badge" id="chat-badge">1</span>
      </button>
      <div class="chat-popup" id="chat-popup" role="dialog" aria-modal="true">
        <button class="chat-close-btn" id="chat-close-btn">x</button>
        <div class="chat-messages" id="chat-messages"></div>
        <div class="chat-chips" id="chat-chips">
          <button class="chat-chip" data-msg="hi">hi</button>
        </div>
        <textarea class="chat-input" id="chat-input"></textarea>
        <button class="chat-send-btn" id="chat-send-btn" disabled></button>
      </div>
    </body></html>`,
    { url: "https://example.test/" }
  );
}

async function loadChatWidget(dom) {
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
  globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.MouseEvent = dom.window.MouseEvent;
  globalThis.KeyboardEvent = dom.window.KeyboardEvent;
  await import(`../js/chat-widget.js?t=${Date.now()}-${Math.random()}`);
}

function click(dom, el) {
  el.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
}
function keydown(dom, key, opts = {}) {
  dom.window.document.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...opts }));
}

describe("js/chat-widget.js — #chat-popup Escape/Tab-trap/return-focus (รอบที่ 59)", () => {
  test("เปิด popup ผ่านปุ่ม fab: เพิ่ม class 'open' + focus เข้า #chat-input อัตโนมัติ (พฤติกรรมเดิม)", async () => {
    const dom = makeDom();
    await loadChatWidget(dom);
    const { document } = dom.window;
    const fab = document.getElementById("chat-fab");
    const popup = document.getElementById("chat-popup");
    const input = document.getElementById("chat-input");

    click(dom, fab);

    assert.ok(popup.classList.contains("open"));
    assert.equal(document.activeElement, input);
  });

  test("Tab จาก focusable ตัวสุดท้าย (chat-input — chat-send-btn ปิดใช้งานจึงไม่นับ) วนกลับไปตัวแรก (chat-close-btn)", async () => {
    const dom = makeDom();
    await loadChatWidget(dom);
    const { document } = dom.window;
    const fab = document.getElementById("chat-fab");
    const input = document.getElementById("chat-input");
    const closeBtn = document.getElementById("chat-close-btn");

    click(dom, fab);
    input.focus();
    keydown(dom, "Tab");

    assert.equal(document.activeElement, closeBtn);
  });

  test("Shift+Tab จาก focusable ตัวแรก (chat-close-btn) วนไปตัวสุดท้าย (chat-input)", async () => {
    const dom = makeDom();
    await loadChatWidget(dom);
    const { document } = dom.window;
    const fab = document.getElementById("chat-fab");
    const input = document.getElementById("chat-input");
    const closeBtn = document.getElementById("chat-close-btn");

    click(dom, fab);
    closeBtn.focus();
    keydown(dom, "Tab", { shiftKey: true });

    assert.equal(document.activeElement, input);
  });

  test("Escape ปิด popup และคืนโฟกัสกลับไปที่ element ที่โฟกัสอยู่ก่อนเปิด", async () => {
    const dom = makeDom();
    await loadChatWidget(dom);
    const { document } = dom.window;
    const outsideBtn = document.getElementById("outside-btn");
    const fab = document.getElementById("chat-fab");
    const popup = document.getElementById("chat-popup");

    outsideBtn.focus();
    click(dom, fab);
    keydown(dom, "Escape");

    assert.ok(!popup.classList.contains("open"));
    assert.equal(document.activeElement, outsideBtn);
  });

  test("Escape ตอน popup ปิดอยู่แล้วไม่ throw และไม่ทำอะไร (guard isOpen ทำงานถูก)", async () => {
    const dom = makeDom();
    await loadChatWidget(dom);
    const { document } = dom.window;
    const popup = document.getElementById("chat-popup");

    assert.doesNotThrow(() => keydown(dom, "Escape"));
    assert.ok(!popup.classList.contains("open"));
  });

  test("ปุ่ม chat-close-btn ปิด popup + คืนโฟกัสได้เหมือนกับ Escape", async () => {
    const dom = makeDom();
    await loadChatWidget(dom);
    const { document } = dom.window;
    const outsideBtn = document.getElementById("outside-btn");
    const fab = document.getElementById("chat-fab");
    const popup = document.getElementById("chat-popup");
    const closeBtn = document.getElementById("chat-close-btn");

    outsideBtn.focus();
    click(dom, fab);
    click(dom, closeBtn);

    assert.ok(!popup.classList.contains("open"));
    assert.equal(document.activeElement, outsideBtn);
  });

  test("คลิกนอก popup ยังปิด popup ได้ปกติ (outside-click listener เดิมไม่ถูกกระทบจากกลไกใหม่)", async () => {
    const dom = makeDom();
    await loadChatWidget(dom);
    const { document } = dom.window;
    const outsideBtn = document.getElementById("outside-btn");
    const fab = document.getElementById("chat-fab");
    const popup = document.getElementById("chat-popup");

    click(dom, fab);
    click(dom, outsideBtn);

    assert.ok(!popup.classList.contains("open"));
  });
});
