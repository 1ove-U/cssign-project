// test/cart-modal-focus-trap.test.mjs — P3.0 Phase 1 รอบย่อย 4 ต่อ
//
// jsdom test สำหรับกลไกป๊อปอัพ "ตะกร้าของฉัน" (#cm-overlay) ของ js/cart-modal.js — เปิด/ปิด,
// Tab-trap วน 2 ทิศทาง, Escape, return-focus, ปิดผ่านปุ่ม/backdrop-click — คัดลอกโครงสร้างเทส
// มาจาก test/track-modal-focus-trap.test.mjs ทุกประการ (แค่เปลี่ยน prefix tm- เป็น cm-)
//
// ขอบเขตรอบนี้ (ตั้งใจ): ทดสอบเฉพาะ "กลไกป๊อปอัพ" เท่านั้น — ไม่ทดสอบ renderCart()/ปุ่ม +/-/ลบ/
// EN mirror (ดู test/cart-modal-render.test.mjs แยกต่างหาก ตามธรรมเนียมเดียวกับที่
// test/track-modal-focus-trap.test.mjs แยกจาก test/track-modal-form-flow.test.mjs)
//
// วิธีทดสอบ: js/cart-modal.js เป็น classic script (ไม่มี import เลย — อ่านข้อมูลผ่าน
// window.CSSignCart bridge เท่านั้น) จึงโหลดด้วย runScripts:"dangerously" (แพทเทิร์นเดียวกับ
// test/main-cart-nav-icon.test.mjs) ไม่ใช่ dynamic import() แบบ track-modal.js (ES module) —
// ใช้ HTML markup จริงจาก js/cart-modal-template.js (อ่านด้วย readFileSync แล้วดึง template
// literal ด้วย regex) เป็น fixture ให้ตรงกับของจริง 100%
//
// ไม่ได้แก้ไฟล์ .js/.html/.css ที่เป็นโค้ดจริงเลยแม้แต่บรรทัดเดียวในไฟล์นี้ — งานทดสอบล้วนๆ

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const CM_TEMPLATE_SRC = readFileSync(new URL("../js/cart-modal-template.js", import.meta.url), "utf-8");
const CM_HTML_MATCH = CM_TEMPLATE_SRC.match(/var HTML = `([\s\S]*?)`;/);
if (!CM_HTML_MATCH) throw new Error("cart-modal-focus-trap.test.mjs: ดึง template literal จาก js/cart-modal-template.js ไม่สำเร็จ (โครงสร้างไฟล์อาจเปลี่ยนไป)");
const CM_HTML = CM_HTML_MATCH[1];

const CM_JS_SRC = readFileSync(new URL("../js/cart-modal.js", import.meta.url), "utf-8");

function makeDom(url) {
  const dom = new JSDOM(
    `<!doctype html><html><body>
      <button id="outside-btn">outside</button>
      <button id="cm-trigger">เปิดตะกร้า</button>
      ${CM_HTML}
    </body></html>`,
    { url: url || "https://example.test/", runScripts: "dangerously", pretendToBeVisual: true }
  );
  // openModal() เรียก requestAnimationFrame() เพื่อโฟกัส #cm-close หลังเปิด — jsdom ไม่ยิงจริง
  // ใน Node test runner context นี้ (ต่างจาก browser) จึง stub ด้วย setTimeout(cb, 0) เหมือน
  // แพทเทิร์นเดียวกับ test/track-modal-focus-trap.test.mjs
  dom.window.requestAnimationFrame = (cb) => setTimeout(cb, 0);
  dom.window.CSSignCart = { getCartItems: () => [] };
  return dom;
}

function runCartModalJs(dom) {
  const scriptEl = dom.window.document.createElement("script");
  scriptEl.textContent = CM_JS_SRC;
  dom.window.document.body.appendChild(scriptEl);
}

function click(dom, el) {
  el.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
}
function keydown(dom, key, opts = {}) {
  dom.window.document.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...opts }));
}
function nextTick() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe("js/cart-modal.js — #cm-overlay เปิด/ปิด/Tab-trap/Escape/return-focus", () => {
  test("window.openCartModal() เปิดป๊อปอัพ (display:flex) และโฟกัสเข้า #cm-close อัตโนมัติ (ผ่าน requestAnimationFrame)", async () => {
    const dom = makeDom();
    runCartModalJs(dom);
    const { document } = dom.window;
    const outsideBtn = document.getElementById("outside-btn");
    outsideBtn.focus();

    assert.equal(typeof dom.window.openCartModal, "function", "ต้อง expose window.openCartModal");
    dom.window.openCartModal();
    await nextTick();

    const overlay = document.getElementById("cm-overlay");
    assert.equal(overlay.style.display, "flex");
    assert.equal(document.body.style.overflow, "hidden");
    assert.equal(document.activeElement, document.getElementById("cm-close"));
  });

  test("ปุ่ม #cm-close ปิดป๊อปอัพ และคืนโฟกัสกลับไปที่ element เดิมก่อนเปิด", async () => {
    const dom = makeDom();
    runCartModalJs(dom);
    const { document } = dom.window;
    const trigger = document.getElementById("cm-trigger");
    trigger.focus();

    dom.window.openCartModal();
    await nextTick();
    click(dom, document.getElementById("cm-close"));

    const overlay = document.getElementById("cm-overlay");
    assert.equal(overlay.style.display, "none");
    assert.equal(document.body.style.overflow, "");
    assert.equal(document.activeElement, trigger, "ต้อง return-focus กลับไปที่ปุ่มที่เปิด modal");
  });

  test("คลิก backdrop (#cm-overlay เอง ไม่ใช่ .cm-modal ข้างใน) ปิดป๊อปอัพ", async () => {
    const dom = makeDom();
    runCartModalJs(dom);
    const { document } = dom.window;
    dom.window.openCartModal();
    await nextTick();

    const overlay = document.getElementById("cm-overlay");
    click(dom, overlay);
    assert.equal(overlay.style.display, "none");
  });

  test("คลิกข้างใน .cm-modal ไม่ปิดป๊อปอัพ (event.target ไม่ใช่ #cm-overlay เอง)", async () => {
    const dom = makeDom();
    runCartModalJs(dom);
    const { document } = dom.window;
    dom.window.openCartModal();
    await nextTick();

    const overlay = document.getElementById("cm-overlay");
    const modalBody = document.querySelector(".cm-modal");
    click(dom, modalBody);
    assert.equal(overlay.style.display, "flex");
  });

  test("กด Escape ปิดป๊อปอัพเมื่อเปิดอยู่", async () => {
    const dom = makeDom();
    runCartModalJs(dom);
    const { document } = dom.window;
    dom.window.openCartModal();
    await nextTick();
    keydown(dom, "Escape");
    assert.equal(document.getElementById("cm-overlay").style.display, "none");
  });

  test("กด Escape ตอนป๊อปอัพปิดอยู่แล้ว ไม่ throw / ไม่มีผลอะไร", async () => {
    const dom = makeDom();
    runCartModalJs(dom);
    assert.doesNotThrow(() => keydown(dom, "Escape"));
    assert.equal(dom.window.document.getElementById("cm-overlay").style.display, "none");
  });

  test("Tab ที่ปุ่มสุดท้ายในป๊อปอัพ วนกลับไปโฟกัส element แรกสุด (#cm-close)", async () => {
    const dom = makeDom();
    runCartModalJs(dom);
    const { document } = dom.window;
    dom.window.openCartModal();
    await nextTick();

    const overlay = document.getElementById("cm-overlay");
    const focusables = Array.from(overlay.querySelectorAll(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    ));
    const last = focusables[focusables.length - 1];
    last.focus();
    keydown(dom, "Tab");
    assert.equal(document.activeElement, focusables[0]);
  });

  test("Shift+Tab ที่ element แรกสุด วนไปโฟกัส element สุดท้ายในป๊อปอัพ", async () => {
    const dom = makeDom();
    runCartModalJs(dom);
    const { document } = dom.window;
    dom.window.openCartModal();
    await nextTick();

    const overlay = document.getElementById("cm-overlay");
    const focusables = Array.from(overlay.querySelectorAll(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    ));
    focusables[0].focus();
    keydown(dom, "Tab", { shiftKey: true });
    assert.equal(document.activeElement, focusables[focusables.length - 1]);
  });

  test("Tab ตอนป๊อปอัพปิดอยู่ ไม่ trap โฟกัส (ปล่อยให้ browser จัดการปกติ)", async () => {
    const dom = makeDom();
    runCartModalJs(dom);
    const { document } = dom.window;
    const outsideBtn = document.getElementById("outside-btn");
    outsideBtn.focus();
    assert.doesNotThrow(() => keydown(dom, "Tab"));
    assert.equal(document.activeElement, outsideBtn, "ไม่ควรมีการ preventDefault/ย้ายโฟกัสตอนป๊อปอัพปิดอยู่");
  });

  test("ไฟล์นี้ไม่ throw ถ้าไม่มี #cm-overlay/#cm-list ในหน้า (จำลองหน้าที่ลืมใส่ cart-modal-template.js)", () => {
    const dom = new JSDOM(`<!doctype html><html><body><div id="app"></div></body></html>`, {
      url: "https://example.test/", runScripts: "dangerously", pretendToBeVisual: true,
    });
    dom.window.CSSignCart = { getCartItems: () => [] };
    assert.doesNotThrow(() => runCartModalJs(dom));
    assert.equal(typeof dom.window.openCartModal, "undefined");
  });
});
