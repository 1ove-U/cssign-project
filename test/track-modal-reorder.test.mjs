// test/track-modal-reorder.test.mjs
//
// jsdom test สำหรับปุ่ม "สั่งซ้ำ" ที่ wire เข้า js/track-modal.js จริงในรอบที่ 32 (P2.8b — ต่อจาก
// P2.8a ที่เพิ่ม js/reorder-helper.js เป็น pure data-layer เท่านั้นในรอบก่อนหน้า)
//
// ขอบเขต: ทดสอบเฉพาะพฤติกรรมใหม่ที่เพิ่มในรอบนี้ — ปุ่ม .tm-reorder-btn แสดง/ไม่แสดงตาม
// shouldOfferReorder(order), กดแล้วเรียก window.openModal('form', {source, message}) ด้วยค่าที่
// ถูกต้องตรงกับ buildReorderMessage(), ปิด track-modal ก่อนเปิด quote modal, และไม่ throw ถ้า
// window.openModal ไม่มีอยู่ (หน้าที่ไม่ได้โหลด js/lead-quote-modal.js คู่กัน) — ไม่ทดสอบซ้ำ flow
// submit ฟอร์ม/validation/rate-limit/renderResult ทั่วไปที่มี test อยู่แล้วใน
// test/track-modal-form-flow.test.mjs (ใช้แพทเทิร์น makeDom()/loadTrackModal()/stubTrackOrderStatus()
// เดียวกันทุกประการ เพื่อให้ HTML markup ตรงกับ js/track-modal-template.js จริง 100%)
//
// ไม่ได้แก้ไฟล์ .js/.html/.css ที่เป็นโค้ดจริงเลยแม้แต่บรรทัดเดียวในไฟล์นี้ — งานทดสอบล้วนๆ

import { test, describe, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const TM_TEMPLATE_SRC = readFileSync(new URL("../js/track-modal-template.js", import.meta.url), "utf-8");
const TM_HTML_MATCH = TM_TEMPLATE_SRC.match(/var HTML = `([\s\S]*?)`;/);
if (!TM_HTML_MATCH) throw new Error("track-modal-reorder.test.mjs: ดึง template literal จาก js/track-modal-template.js ไม่สำเร็จ (โครงสร้างไฟล์อาจเปลี่ยนไป)");
const TM_HTML = TM_HTML_MATCH[1];

function makeDom() {
  return new JSDOM(
    `<!doctype html><html><body>${TM_HTML}</body></html>`,
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
  globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);
  globalThis.sessionStorage = dom.window.sessionStorage;
  dom.window.HTMLElement.prototype.scrollIntoView = () => {};
  await import(`../js/track-modal.js?t=${Date.now()}-${Math.random()}`);
}

function stubTrackOrderStatus(impl) {
  globalThis.__TM_STUB_TRACK_ORDER_STATUS__ = impl;
}

function submitForm(dom) {
  const { document } = dom.window;
  document.getElementById("tm-form").dispatchEvent(
    new dom.window.Event("submit", { bubbles: true, cancelable: true })
  );
}

function fillForm(dom, code, phone) {
  const { document } = dom.window;
  document.getElementById("tm-code").value = code;
  document.getElementById("tm-phone").value = phone;
}

function nextTick() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function clickReorderBtn(dom) {
  const btn = dom.window.document.querySelector(".tm-reorder-btn");
  btn.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, cancelable: true }));
  return btn;
}

const COMPLETED_ORDER = {
  id: "PO-2026-0120_1234",
  code: "PO-2026-0120",
  item: "ป้ายไฟ LED หน้าร้าน",
  qty: 2,
  category: "ป้ายไฟ",
  status: "completed",
  progress: 100,
  dueDate: "2026-07-01",
  shippingTrackingId: ""
};

const PRODUCTION_ORDER = {
  ...COMPLETED_ORDER,
  status: "production",
  progress: 55
};

describe("js/track-modal.js — ปุ่ม \"สั่งซ้ำ\" (P2.8b, รอบที่ 32)", () => {
  afterEach(() => {
    delete globalThis.__TM_STUB_TRACK_ORDER_STATUS__;
    delete globalThis.window.openModal;
  });

  test("ออเดอร์ status 'completed': แสดงปุ่ม .tm-reorder-btn", async () => {
    const dom = makeDom();
    stubTrackOrderStatus(() => Promise.resolve(COMPLETED_ORDER));
    await loadTrackModal(dom);

    fillForm(dom, "PO-2026-0120", "0891234567");
    submitForm(dom);
    await nextTick();

    const btn = dom.window.document.querySelector(".tm-reorder-btn");
    assert.ok(btn, "ต้องมีปุ่มสั่งซ้ำแสดงเมื่อ status เป็น completed");
    assert.match(btn.textContent, /สั่งซ้ำ/);
  });

  test("ออเดอร์ status ที่ไม่ใช่ 'completed' (เช่น production): ไม่แสดงปุ่ม .tm-reorder-btn", async () => {
    const dom = makeDom();
    stubTrackOrderStatus(() => Promise.resolve(PRODUCTION_ORDER));
    await loadTrackModal(dom);

    fillForm(dom, "PO-2026-0120", "0891234567");
    submitForm(dom);
    await nextTick();

    assert.equal(dom.window.document.querySelector(".tm-reorder-btn"), null, "ไม่ควรมีปุ่มสั่งซ้ำเมื่อ status ไม่ใช่ completed");
  });

  test("ออเดอร์ status 'cancelled': ไม่แสดงปุ่ม .tm-reorder-btn", async () => {
    const dom = makeDom();
    stubTrackOrderStatus(() => Promise.resolve({ ...COMPLETED_ORDER, status: "cancelled" }));
    await loadTrackModal(dom);

    fillForm(dom, "PO-2026-0120", "0891234567");
    submitForm(dom);
    await nextTick();

    assert.equal(dom.window.document.querySelector(".tm-reorder-btn"), null);
  });

  test("กดปุ่มสั่งซ้ำ: เรียก window.openModal('form', {source, message}) ด้วยค่าที่ถูกต้อง ตรงกับ buildReorderMessage()", async () => {
    const dom = makeDom();
    stubTrackOrderStatus(() => Promise.resolve(COMPLETED_ORDER));
    await loadTrackModal(dom);

    fillForm(dom, "PO-2026-0120", "0891234567");
    submitForm(dom);
    await nextTick();

    let calledWith = null;
    dom.window.openModal = function (startTab, opts) { calledWith = [startTab, opts]; };

    clickReorderBtn(dom);

    assert.ok(calledWith, "ต้องเรียก window.openModal()");
    assert.equal(calledWith[0], "form");
    assert.equal(calledWith[1].source, "reorder_track_modal");
    assert.equal(
      calledWith[1].message,
      "ต้องการสั่งซ้ำ: ป้ายไฟ LED หน้าร้าน จำนวน 2 (อ้างอิงคำสั่งผลิตเดิม PO-2026-0120)"
    );
  });

  test("กดปุ่มสั่งซ้ำ: ปิด track-modal ก่อนเปิด quote modal (overlay.style.display กลับเป็น 'none')", async () => {
    const dom = makeDom();
    stubTrackOrderStatus(() => Promise.resolve(COMPLETED_ORDER));
    await loadTrackModal(dom);
    const { document } = dom.window;

    document.getElementById("tm-overlay").style.display = "flex";

    fillForm(dom, "PO-2026-0120", "0891234567");
    submitForm(dom);
    await nextTick();

    dom.window.openModal = function () {};
    clickReorderBtn(dom);

    assert.equal(document.getElementById("tm-overlay").style.display, "none", "track-modal ต้องปิดตัวเองก่อนเปิด quote modal");
  });

  test("window.openModal ไม่มีอยู่ (หน้าที่ไม่ได้โหลด js/lead-quote-modal.js): กดปุ่มสั่งซ้ำไม่ throw และไม่ปิด track-modal", async () => {
    const dom = makeDom();
    stubTrackOrderStatus(() => Promise.resolve(COMPLETED_ORDER));
    await loadTrackModal(dom);
    const { document } = dom.window;

    document.getElementById("tm-overlay").style.display = "flex";
    delete dom.window.openModal;

    fillForm(dom, "PO-2026-0120", "0891234567");
    submitForm(dom);
    await nextTick();

    assert.doesNotThrow(() => clickReorderBtn(dom));
    assert.equal(document.getElementById("tm-overlay").style.display, "flex", "ไม่ควรปิด track-modal ถ้าไม่มี window.openModal ให้เปิดต่อ");
  });
});
