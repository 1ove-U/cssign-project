// test/track-modal-design-approval.test.mjs — P0.2b (หน้าอนุมัติแบบ ฝั่งลูกค้า)
//
// jsdom test สำหรับส่วนอนุมัติ/ขอแก้ไขแบบ ที่เพิ่มเข้าไปใน js/track-modal.js (renderResult()
// ถูกขยายให้เรียก renderDesignApprovalSection() + ปุ่มใหม่ 3 ปุ่ม delegate ผ่าน #tm-result เดิม)
//
// pattern เดียวกับ test/track-modal-form-flow.test.mjs ทุกประการ (โหลด markup จาก
// js/track-modal-template.js, stub trackOrderStatus()/submitDesignApproval() ผ่าน
// test/helpers/db-orders-stub-loader.mjs) — ไม่ทดสอบซ้ำ flow submit ฟอร์ม/validation/rate-limit/
// ปุ่มคัดลอกที่มี test อยู่แล้วในไฟล์นั้น ขอบเขตไฟล์นี้เฉพาะส่วนอนุมัติแบบเท่านั้น
//
// ไม่ได้แก้ไฟล์ .js/.html/.css ที่เป็นโค้ดจริงเลยแม้แต่บรรทัดเดียวในไฟล์นี้ — งานทดสอบล้วนๆ

import { test, describe, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const TM_TEMPLATE_SRC = readFileSync(new URL("../js/track-modal-template.js", import.meta.url), "utf-8");
const TM_HTML_MATCH = TM_TEMPLATE_SRC.match(/var HTML = `([\s\S]*?)`;/);
if (!TM_HTML_MATCH) throw new Error("track-modal-design-approval.test.mjs: ดึง template literal จาก js/track-modal-template.js ไม่สำเร็จ");
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
function stubSubmitDesignApproval(impl) {
  globalThis.__TM_STUB_SUBMIT_DESIGN_APPROVAL__ = impl;
}

function submitForm(dom) {
  dom.window.document.getElementById("tm-form").dispatchEvent(
    new dom.window.Event("submit", { bubbles: true, cancelable: true })
  );
}
function fillForm(dom, code, phone) {
  dom.window.document.getElementById("tm-code").value = code;
  dom.window.document.getElementById("tm-phone").value = phone;
}
function click(dom, el) {
  el.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
}
function nextTick() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

const BASE_ORDER = {
  id: "PO-2026-0120_1234",
  code: "PO-2026-0120",
  item: "ป้ายไฟ LED หน้าร้าน",
  qty: 2,
  category: "ป้ายไฟ",
  status: "design",
  progress: 20,
  dueDate: "2026-08-15",
  shippingTrackingId: "",
  designFiles: [
    { url: "https://example.com/design-a.jpg", label: "แบบร่างหน้าแรก", uploadedAt: "2026-08-01" }
  ]
};

async function searchAndGet(dom, order) {
  stubTrackOrderStatus(() => Promise.resolve(order));
  await loadTrackModal(dom);
  fillForm(dom, "PO-2026-0120", "0891234567");
  submitForm(dom);
  await nextTick();
  return dom.window.document;
}

describe("js/track-modal.js — ส่วนอนุมัติแบบ (P0.2b, design proof approval)", () => {
  afterEach(() => {
    delete globalThis.__TM_STUB_TRACK_ORDER_STATUS__;
    delete globalThis.__TM_STUB_SUBMIT_DESIGN_APPROVAL__;
  });

  test("status='design' + มี designFiles → แสดง section อนุมัติแบบ พร้อมไฟล์ดีไซน์และปุ่มทั้ง 2", async () => {
    const dom = makeDom();
    const document = await searchAndGet(dom, BASE_ORDER);

    const section = document.getElementById("tm-approval-section");
    assert.ok(section, "ต้องมี section อนุมัติแบบเมื่อ status='design' และมี designFiles");
    assert.match(section.textContent, /แบบร่างหน้าแรก/);
    const fileLink = section.querySelector(".tm-design-file");
    assert.ok(fileLink, "ต้องมีลิงก์ไฟล์ดีไซน์");
    assert.equal(fileLink.getAttribute("href"), "https://example.com/design-a.jpg");
    assert.equal(fileLink.getAttribute("target"), "_blank");
    assert.ok(document.getElementById("tm-approve-btn"));
    assert.ok(document.getElementById("tm-request-changes-btn"));
  });

  test("status='approval' + มี designFiles → ก็แสดง section เหมือนกัน (design และ approval แสดงทั้งคู่)", async () => {
    const dom = makeDom();
    const document = await searchAndGet(dom, { ...BASE_ORDER, status: "approval" });
    assert.ok(document.getElementById("tm-approval-section"));
  });

  test("status อื่นที่ไม่ใช่ design/approval (เช่น production) → ไม่แสดง section แม้จะมี designFiles อยู่ก็ตาม", async () => {
    const dom = makeDom();
    const document = await searchAndGet(dom, { ...BASE_ORDER, status: "production" });
    assert.equal(document.getElementById("tm-approval-section"), null);
  });

  test("status='design' แต่ designFiles ว่างเปล่า → ไม่แสดง section เลย", async () => {
    const dom = makeDom();
    const document = await searchAndGet(dom, { ...BASE_ORDER, designFiles: [] });
    assert.equal(document.getElementById("tm-approval-section"), null);
  });

  test("status='design' แต่ order ไม่มี field designFiles เลย (undefined) → ไม่ throw, ไม่แสดง section", async () => {
    const dom = makeDom();
    const orderNoField = { ...BASE_ORDER };
    delete orderNoField.designFiles;
    const document = await searchAndGet(dom, orderNoField);
    assert.equal(document.getElementById("tm-approval-section"), null);
  });

  test("กดปุ่ม 'อนุมัติแบบนี้' → เรียก submitDesignApproval(trackingId, 'approved', '') แล้วแทนที่ section ด้วยข้อความขอบคุณ", async () => {
    const dom = makeDom();
    let callArgs = null;
    stubSubmitDesignApproval((trackingId, action, comment) => {
      callArgs = [trackingId, action, comment];
      return Promise.resolve("new-id");
    });
    const document = await searchAndGet(dom, BASE_ORDER);

    click(dom, document.getElementById("tm-approve-btn"));
    await nextTick();

    assert.deepEqual(callArgs, ["PO-2026-0120_1234", "approved", ""]);
    const section = document.getElementById("tm-approval-section");
    assert.match(section.textContent, /ขอบคุณ/);
    assert.match(section.textContent, /อนุมัติแบบของคุณแล้ว/);
    assert.equal(document.getElementById("tm-approve-btn"), null, "ปุ่มเดิมต้องหายไปหลังส่งสำเร็จ (ถูกแทนที่ด้วยข้อความขอบคุณ)");
  });

  test("กดปุ่ม 'ขอแก้ไข' → สลับไปแสดงช่องคอมเมนต์ (ซ่อนปุ่มอนุมัติ/ขอแก้ไขเดิม)", async () => {
    const dom = makeDom();
    const document = await searchAndGet(dom, BASE_ORDER);

    const commentWrap = document.getElementById("tm-approval-comment-wrap");
    const actions = document.getElementById("tm-approval-actions");
    assert.equal(commentWrap.style.display, "none");

    click(dom, document.getElementById("tm-request-changes-btn"));
    await nextTick();

    assert.equal(commentWrap.style.display, "block");
    assert.equal(actions.style.display, "none");
  });

  test("กด 'ส่งข้อเสนอแนะ' โดยไม่กรอกคอมเมนต์ → แสดง error ไม่เรียก submitDesignApproval()", async () => {
    const dom = makeDom();
    let called = false;
    stubSubmitDesignApproval(() => { called = true; return Promise.resolve("id"); });
    const document = await searchAndGet(dom, BASE_ORDER);

    click(dom, document.getElementById("tm-request-changes-btn"));
    await nextTick();
    click(dom, document.getElementById("tm-submit-changes-btn"));
    await nextTick();

    assert.equal(called, false);
    assert.match(document.getElementById("tm-approval-msg").textContent, /กรุณาระบุ/);
  });

  test("กรอกคอมเมนต์แล้วกดส่ง → เรียก submitDesignApproval(trackingId, 'changes_requested', comment) แล้วแสดงขอบคุณ", async () => {
    const dom = makeDom();
    let callArgs = null;
    stubSubmitDesignApproval((trackingId, action, comment) => {
      callArgs = [trackingId, action, comment];
      return Promise.resolve("id");
    });
    const document = await searchAndGet(dom, BASE_ORDER);

    click(dom, document.getElementById("tm-request-changes-btn"));
    await nextTick();
    document.getElementById("tm-approval-comment").value = "  ขอเปลี่ยนสีพื้นหลังเป็นสีฟ้า  ";
    click(dom, document.getElementById("tm-submit-changes-btn"));
    await nextTick();

    assert.deepEqual(callArgs, ["PO-2026-0120_1234", "changes_requested", "ขอเปลี่ยนสีพื้นหลังเป็นสีฟ้า"]);
    assert.match(document.getElementById("tm-approval-section").textContent, /ปรับแก้แบบ/);
  });

  test("submitDesignApproval() reject (network error) → แสดง error, ปุ่มกลับมากดได้อีกครั้ง (ไม่ค้าง disabled)", async () => {
    const dom = makeDom();
    stubSubmitDesignApproval(() => Promise.reject(new Error("network fail")));
    const document = await searchAndGet(dom, BASE_ORDER);

    const approveBtn = document.getElementById("tm-approve-btn");
    click(dom, approveBtn);
    await nextTick();

    assert.match(document.getElementById("tm-approval-msg").textContent, /เกิดข้อผิดพลาด/);
    assert.equal(approveBtn.disabled, false, "ปุ่มต้อง enable กลับมาหลัง error ไม่ค้าง disabled ตลอดไป");
  });

  test("ปุ่มถูก disable ทั้งหมดทันทีตอนกดอนุมัติ ระหว่างรอผลลัพธ์ (กันกดซ้ำ)", async () => {
    const dom = makeDom();
    let resolveFn;
    stubSubmitDesignApproval(() => new Promise((resolve) => { resolveFn = resolve; }));
    const document = await searchAndGet(dom, BASE_ORDER);

    const approveBtn = document.getElementById("tm-approve-btn");
    const requestBtn = document.getElementById("tm-request-changes-btn");
    click(dom, approveBtn);
    await nextTick();

    assert.equal(approveBtn.disabled, true);
    assert.equal(requestBtn.disabled, true);

    resolveFn("id");
    await nextTick();
  });

  test("ค้นหาออเดอร์ใหม่อีกครั้งหลังเห็น section อนุมัติแบบแล้ว: renderResult() ทำงานปกติไม่ throw (section เดิมถูกแทนที่ทั้งก้อน)", async () => {
    const dom = makeDom();
    let callNo = 0;
    stubTrackOrderStatus(() => {
      callNo += 1;
      return Promise.resolve(callNo === 1 ? BASE_ORDER : { ...BASE_ORDER, status: "production" });
    });
    await loadTrackModal(dom);
    const { document } = dom.window;

    fillForm(dom, "PO-2026-0120", "0891234567");
    submitForm(dom);
    await nextTick();
    assert.ok(document.getElementById("tm-approval-section"));

    fillForm(dom, "PO-2026-0120", "0891234567");
    submitForm(dom);
    await nextTick();
    assert.equal(document.getElementById("tm-approval-section"), null, "รอบสองสถานะเป็น production แล้ว ไม่ควรมี section อนุมัติแบบเหลืออยู่");
  });
});
