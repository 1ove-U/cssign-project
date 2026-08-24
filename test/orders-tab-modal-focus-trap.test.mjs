// test/orders-tab-modal-focus-trap.test.mjs
//
// jsdom test อย่างเป็นทางการสำหรับกลไก focus-trap/Escape/return-focus + confirmDialog guard
// ของ js/orders-tab-modal.js (ป๊อปอัพ "เพิ่ม/แก้ไขคำสั่งผลิต" — #cp-order-overlay) ที่ก็อปตรรกะ
// เดียวกับ js/admin-utils.js มาตั้งแต่รอบที่ 58 แต่ยังไม่มี test อย่างเป็นทางการ (บันทึกไว้เป็น
// รายการ "รู้แล้วแต่ตั้งใจไม่แก้" ข้อ 1 ของรอบ 59/60 — หยิบมาทำในรอบที่ 61 นี้)
//
// วิธีทดสอบ — ต่างจาก test/admin-utils-focus-trap.test.mjs/test/chat-widget-focus-trap.test.mjs
// ตรงที่ js/orders-tab-modal.js ทำ document.getElementById() แบบ eager ที่ module scope
// (ไม่ใช่ lazy ใน function) กับ element ~20 ตัวของป๊อปอัพเอง และยัง import วนกลับไป
// js/orders-tab.js (circular import ที่ตั้งใจ — ดูหมายเหตุหัวไฟล์ orders-tab-modal.js) ซึ่งไฟล์นั้น
// เอง import ต่อไปอีก 6 ไฟล์ (orders-tab-filters/row/pagination/kanban/stats/export.js) ที่รวมกัน
// ทำ document.getElementById() แบบ eager กับ element อีกกว่า 20 ตัว (บางตัว เช่น cp-chart-range/
// cp-chart-metric/cp-chart-bars ปัจจุบันอยู่ใน DOM ของแท็บ "ภาพรวม" ไม่ใช่แท็บ "คำสั่งผลิต" แล้ว —
// ย้ายไปตอนรีแฟกเตอร์ก่อนหน้านี้ แต่ orders-tab.js ยังอ้าง id เดิมข้ามแท็บได้ปกติเพราะ admin.html
// เป็น SPA หน้าเดียวที่ elements ทุกแท็บอยู่ใน DOM เดียวกันตลอด แค่ไม่ได้แสดงผล) —
// การประกอบ fixture มือแบบ synthetic เสี่ยงพลาด element ไปทีละตัวมาก จึงใช้ <body> จริงทั้งหมด
// จาก admin.html เป็น fixture แทน (ตัด <script> ออกเพราะไม่ต้องรัน แค่ต้องมี element ให้ import
// chain เจอครบ) — ตรงกับหมายเหตุที่สะสมมาว่า "ต้องตรวจสอบเทียบกับ entry point จริงที่ HTML โหลด
// จริงเสมอก่อนสรุปว่าเป็นบั๊กจริงหรือแค่อาการของการทดสอบผิดลำดับ" (พบรอบ 54)
//
// หมายเหตุ jsdom เพิ่มเติมที่พบใหม่ในไฟล์นี้ (ไม่เคยเจอมาก่อนในรอบ 58-60 เพราะ 2 ไฟล์ก่อนหน้าไม่ได้
// เรียกฟังก์ชันที่แตะ scrollIntoView() เลย): js/orders-tab-modal.js เรียก
// element.scrollIntoView() ใน switchOdTab() (เลื่อนแถบแท็บย่อยในป๊อปอัพให้เห็นปุ่มที่ active) ทุกครั้ง
// ที่ openOrderModal()/openOrderModalClone() ถูกเรียก — jsdom ไม่ implement scrollIntoView() (ตาม
// หมายเหตุสะสมเดิม) ต้อง stub `HTMLElement.prototype.scrollIntoView = () => {}` ก่อน import เสมอ
// ไม่งั้น openOrderModal() จะ throw ทันที (TypeError: ...scrollIntoView is not a function)
//
// ไม่ได้แก้ไฟล์ .js/.html/.css ที่เป็นโค้ดจริงเลยแม้แต่บรรทัดเดียวในไฟล์นี้ — งานทดสอบล้วนๆ

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

// อ่าน admin.html ครั้งเดียว (module scope) แล้วตัด <script>...</script> ทิ้งทั้งหมด — ไม่ต้องรัน
// สคริปต์จริงใน jsdom (เราจะ import โมดูลที่ต้องการตรงๆ แยกจาก DOM แทน) เอาแค่ <body> มาใช้เป็น
// fixture เพื่อให้ element ทุกตัวที่ import chain ต้องการมีครบตามของจริง 100%
const ADMIN_HTML = readFileSync(new URL("../admin.html", import.meta.url), "utf-8");
const BODY_START = ADMIN_HTML.indexOf(">", ADMIN_HTML.indexOf("<body")) + 1;
const BODY_END = ADMIN_HTML.indexOf("</body>");
const ADMIN_BODY_NO_SCRIPTS = ADMIN_HTML
  .slice(BODY_START, BODY_END)
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, "");

const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), textarea:not([disabled]), ' +
  'input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function makeDom() {
  return new JSDOM(`<!doctype html><html><body>${ADMIN_BODY_NO_SCRIPTS}</body></html>`, {
    url: "https://example.test/"
  });
}

// จำลอง .cp-confirm-overlay ของจริง (ปกติสร้างแบบ lazy โดย ensureConfirmOverlay() ใน
// js/ui-helpers.js ตอนเรียก confirmDialog() ครั้งแรก) — ไม่เรียก confirmDialog() จริงในเทสต์นี้
// เพราะเป็น Promise ที่ค้างรอ user interaction จึงสร้าง element ปลอมแค่พอให้ isConfirmDialogOpen()
// (เช็คแค่ .cp-confirm-overlay + style.display) ตรวจเจอ เหมือนกับแพทเทิร์นเดียวกับ
// test/admin-utils-focus-trap.test.mjs
function addFakeConfirmOverlay(document) {
  const confirmOverlay = document.createElement("div");
  confirmOverlay.className = "cp-confirm-overlay";
  confirmOverlay.style.display = "none";
  confirmOverlay.innerHTML = `<button id="fake-confirm-ok">ok</button>`;
  document.body.appendChild(confirmOverlay);
  return { confirmOverlay, confirmOk: confirmOverlay.querySelector("#fake-confirm-ok") };
}

async function loadOrdersTabModal(dom) {
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
  globalThis.MouseEvent = dom.window.MouseEvent;
  globalThis.KeyboardEvent = dom.window.KeyboardEvent;
  globalThis.HTMLElement = dom.window.HTMLElement;
  // ดูหมายเหตุหัวไฟล์: switchOdTab() เรียก scrollIntoView() ทุกครั้งที่เปิดป๊อปอัพ ต้อง stub ก่อน
  // import เสมอ ไม่งั้น openOrderModal()/openOrderModalClone() จะ throw ทันที
  dom.window.HTMLElement.prototype.scrollIntoView = function () {};
  return import(`../js/orders-tab-modal.js?t=${Date.now()}-${Math.random()}`);
}

describe("js/orders-tab-modal.js — #cp-order-overlay focus-trap/Escape/return-focus (รอบที่ 58, formalized รอบที่ 61)", () => {
  test("openOrderModal(null) เปิดป๊อปอัพ (display:flex) และไม่ throw แม้ import chain ลึก (orders-tab.js + 6 ไฟล์ย่อย)", async () => {
    const dom = makeDom();
    const { openOrderModal } = await loadOrdersTabModal(dom);
    const { document } = dom.window;
    const overlay = document.getElementById("cp-order-overlay");

    assert.doesNotThrow(() => openOrderModal(null));
    assert.equal(overlay.style.display, "flex");
  });

  test("Tab จาก focusable ตัวสุดท้ายในป๊อปอัพวนกลับไปตัวแรก", async () => {
    const dom = makeDom();
    const { openOrderModal } = await loadOrdersTabModal(dom);
    const { document } = dom.window;
    const overlay = document.getElementById("cp-order-overlay");

    openOrderModal(null);
    const focusables = Array.from(overlay.querySelectorAll(FOCUSABLE_SELECTOR));
    assert.ok(focusables.length > 1, "ป๊อปอัพนี้ควรมี focusable element หลายตัว (ฟอร์มยาว)");
    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    last.focus();
    document.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true }));

    assert.equal(document.activeElement, first);
  });

  test("Shift+Tab จาก focusable ตัวแรกวนไปตัวสุดท้าย", async () => {
    const dom = makeDom();
    const { openOrderModal } = await loadOrdersTabModal(dom);
    const { document } = dom.window;
    const overlay = document.getElementById("cp-order-overlay");

    openOrderModal(null);
    const focusables = Array.from(overlay.querySelectorAll(FOCUSABLE_SELECTOR));
    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    first.focus();
    document.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true, cancelable: true }));

    assert.equal(document.activeElement, last);
  });

  test("Escape ยิง synthetic click ใส่ #cp-order-overlay ชนกับ backdrop-click listener เดิมของไฟล์นี้ (ปิดป๊อปอัพผ่าน orderFormGuard.guardedClose())", async () => {
    const dom = makeDom();
    const { openOrderModal } = await loadOrdersTabModal(dom);
    const { document } = dom.window;
    const overlay = document.getElementById("cp-order-overlay");

    openOrderModal(null);
    assert.equal(overlay.style.display, "flex");

    // ฟอร์มยังไม่ถูกแก้ไขอะไรเลยตั้งแต่เปิด (capture() ถูกเรียกท้าย openOrderModal() แล้ว) —
    // orderFormGuard.guardedClose() จึงปิดทันทีโดยไม่เปิด confirmDialog ถามก่อน
    document.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));

    assert.equal(overlay.style.display, "none", "Escape ต้องปิดป๊อปอัพผ่าน backdrop-click listener เดิม เมื่อฟอร์มยังไม่ถูกแก้ไข");
  });

  test("ปุ่ม 'ยกเลิก' (#cp-order-cancel) ปิดป๊อปอัพและคืนโฟกัสกลับไปที่ element ที่โฟกัสอยู่ก่อนเปิด", async () => {
    const dom = makeDom();
    const { openOrderModal } = await loadOrdersTabModal(dom);
    const { document } = dom.window;
    const overlay = document.getElementById("cp-order-overlay");
    const addBtn = document.getElementById("cp-add-btn");
    const cancelBtn = document.getElementById("cp-order-cancel");

    addBtn.focus();
    openOrderModal(null);
    cancelBtn.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));

    assert.equal(overlay.style.display, "none");
    assert.equal(document.activeElement, addBtn);
  });

  test("confirmDialog guard: ตอน .cp-confirm-overlay เปิดอยู่ Tab-trap ของป๊อปอัพคำสั่งผลิตต้องไม่แย่งโฟกัสจากปุ่มใน confirm dialog", async () => {
    const dom = makeDom();
    const { openOrderModal } = await loadOrdersTabModal(dom);
    const { document } = dom.window;

    openOrderModal(null);
    const { confirmOverlay, confirmOk } = addFakeConfirmOverlay(document);
    confirmOverlay.style.display = "flex";
    confirmOk.focus();

    document.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true }));

    assert.equal(document.activeElement, confirmOk, "Tab-trap ของป๊อปอัพคำสั่งผลิตต้อง 'หยุดทำงาน' ตอน confirmDialog เปิดอยู่");
  });

  test("confirmDialog guard: ตอน .cp-confirm-overlay เปิดอยู่ Escape ต้องไม่ยิง synthetic click ไปโดน backdrop ของป๊อปอัพคำสั่งผลิต (ไม่ double-fire)", async () => {
    const dom = makeDom();
    const { openOrderModal } = await loadOrdersTabModal(dom);
    const { document } = dom.window;
    const overlay = document.getElementById("cp-order-overlay");

    openOrderModal(null);
    const { confirmOverlay } = addFakeConfirmOverlay(document);
    confirmOverlay.style.display = "flex";

    document.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));

    assert.equal(overlay.style.display, "flex", "ป๊อปอัพคำสั่งผลิตต้องยังเปิดอยู่ — ปล่อยให้ confirmDialog จัดการ Escape ของตัวเองแทน");
  });

  test("confirmDialog guard: พอปิด confirm dialog แล้ว Escape กลับมาปิดป๊อปอัพคำสั่งผลิตได้ปกติทันที", async () => {
    const dom = makeDom();
    const { openOrderModal } = await loadOrdersTabModal(dom);
    const { document } = dom.window;
    const overlay = document.getElementById("cp-order-overlay");

    openOrderModal(null);
    const { confirmOverlay } = addFakeConfirmOverlay(document);
    confirmOverlay.style.display = "flex";
    confirmOverlay.style.display = "none"; // ปิด confirm dialog แล้ว

    document.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));

    assert.equal(overlay.style.display, "none", "Escape ต้องปิดป๊อปอัพคำสั่งผลิตได้ปกติทันทีที่ confirmDialog ปิดไปแล้ว");
  });

  test("Escape เมื่อไม่มีป๊อปอัพคำสั่งผลิตเปิดอยู่เลย ไม่ throw (guard top-of-stack ทำงานถูก)", async () => {
    const dom = makeDom();
    await loadOrdersTabModal(dom);
    const { document } = dom.window;

    assert.doesNotThrow(() => {
      document.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    });
  });

  test("openOrderModalClone(order) ก็เปิดป๊อปอัพเดียวกันได้ปกติ (ใช้ path openOverlay() เดียวกับ openOrderModal) ไม่ throw", async () => {
    const dom = makeDom();
    const { openOrderModalClone } = await loadOrdersTabModal(dom);
    const { document } = dom.window;
    const overlay = document.getElementById("cp-order-overlay");

    assert.doesNotThrow(() => openOrderModalClone({ id: "o1", code: "PO-001", item: "ป้ายไฟ" }));
    assert.equal(overlay.style.display, "flex");
  });
});
