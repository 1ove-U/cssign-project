// test/track-modal-form-flow.test.mjs
//
// jsdom test อย่างเป็นทางการสำหรับ flow การ "submit ฟอร์ม" ของป๊อปอัพเช็คสถานะคำสั่งผลิต
// (js/track-modal.js) — บันทึกไว้เป็นรายการ "รู้แล้วแต่ตั้งใจไม่แก้" ข้อ 3 ของรอบ 62/65 ("ยังไม่มี
// test เป็นทางการ") หยิบมาทำในรอบที่ 66 นี้ (แยกจาก js/lead-quote-modal.js ตามที่บันทึกไว้ว่างาน
// ใหญ่กว่า แนะนำแยกรอบ — ดู NEXT-ROUND-PROMPT.txt)
//
// ขอบเขตรอบนี้: ทดสอบเฉพาะ js/track-modal.js เท่านั้น (validation ฝั่ง client, rate limit,
// trackOrderStatus() ทั้ง 3 เคส คือ พบ/ไม่พบ/error, renderResult() ทั้งเคสปกติและ cancelled,
// ปุ่มคัดลอกเลข PO) — ไม่แตะ js/lead-quote-modal.js (ดู
// test/lead-quote-modal-focus-trap.test.mjs ที่ก็ตั้งใจจำกัดขอบเขตไว้แค่ focus-trap เหมือนกัน)
// ไม่ทดสอบซ้ำกลไกเปิด/ปิด/focus-trap/Escape/return-focus/backdrop-click ที่มี test อยู่แล้วใน
// test/track-modal-focus-trap.test.mjs
//
// วิธีทดสอบ trackOrderStatus() ทั้ง 3 เคส: firebase-stub-loader.mjs เดิม (getDoc คืน
// `exists: () => false` เสมอ) ทำได้แค่เคส "ไม่พบ" เคสเดียวเท่านั้น — เพิ่ม
// test/helpers/db-orders-stub-loader.mjs (ดักเฉพาะ import ./db-orders.js จาก js/track-modal.js
// เอง เปิดใช้งานเฉพาะไฟล์นี้ผ่าน globalThis flag) ให้ควบคุมค่าที่ trackOrderStatus() คืนได้ตรงๆ ใน
// แต่ละ test case โดยที่ ORDER_STATUS/ORDER_STATUS_FLOW ยังมาจากไฟล์จริง 100% (ดูรายละเอียดใน
// ไฟล์นั้น) — ลงทะเบียนไว้ใน test/helpers/register-loader.mjs แล้ว ไม่ต้องเพิ่ม flag ใน
// package.json test script
//
// HTML markup: อ่านจาก js/track-modal-template.js ด้วย regex เหมือนกับ
// test/track-modal-focus-trap.test.mjs (แพทเทิร์นเดียวกัน ให้ตรงกับของจริง 100%)
//
// ไม่ได้แก้ไฟล์ .js/.html/.css ที่เป็นโค้ดจริงเลยแม้แต่บรรทัดเดียวในไฟล์นี้ — งานทดสอบล้วนๆ

import { test, describe, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const TM_TEMPLATE_SRC = readFileSync(new URL("../js/track-modal-template.js", import.meta.url), "utf-8");
const TM_HTML_MATCH = TM_TEMPLATE_SRC.match(/var HTML = `([\s\S]*?)`;/);
if (!TM_HTML_MATCH) throw new Error("track-modal-form-flow.test.mjs: ดึง template literal จาก js/track-modal-template.js ไม่สำเร็จ (โครงสร้างไฟล์อาจเปลี่ยนไป)");
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
  // checkRateLimit() ใน js/track-modal.js เรียก sessionStorage แบบ bare identifier (module-scope,
  // ไม่ใช่ window.sessionStorage) — ต้อง expose ไว้บน globalThis ก่อน import เสมอ (เพิ่งพบในรอบนี้
  // ตอนเขียน test flow submit จริง — test/track-modal-focus-trap.test.mjs เดิมไม่เคย trigger
  // checkRateLimit() เลยไม่เคยเจอปัญหานี้มาก่อน)
  globalThis.sessionStorage = dom.window.sessionStorage;
  await import(`../js/track-modal.js?t=${Date.now()}-${Math.random()}`);
}

// เปิดการดัก trackOrderStatus() ผ่าน db-orders-stub-loader.mjs — impl(code, phone) จะถูกเรียกแทน
// trackOrderStatus() จริง ต้อง reset ทั้งสองตัวแปรใน afterEach เสมอ กัน leak ข้าม test case
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

// รอ microtask queue ให้ .then()/.catch()/.finally() ของ trackOrderStatus() (async function ใน
// stub) ทำงานจบก่อนเช็คผล — ใช้ setTimeout(0) เหมือนแพทเทิร์น nextTick ใน
// test/track-modal-focus-trap.test.mjs
function nextTick() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

const SAMPLE_ORDER = {
  id: "PO-2026-0120_1234",
  code: "PO-2026-0120",
  item: "ป้ายไฟ LED หน้าร้าน",
  qty: 2,
  category: "ป้ายไฟ",
  status: "production",
  progress: 55,
  dueDate: "2026-08-15",
  shippingTrackingId: ""
};

describe("js/track-modal.js — flow การ submit ฟอร์ม (validation/rate-limit/trackOrderStatus 3 เคส/renderResult/ปุ่มคัดลอก) — รอบที่ 66", () => {
  afterEach(() => {
    delete globalThis.__TM_STUB_TRACK_ORDER_STATUS__;
  });

  test("ไม่กรอกเลข PO เลย: แสดง error 'กรุณากรอกเลขที่คำสั่งผลิต (PO)' และไม่เรียก trackOrderStatus()", async () => {
    const dom = makeDom();
    let called = false;
    stubTrackOrderStatus(() => { called = true; return Promise.resolve(null); });
    await loadTrackModal(dom);
    const { document } = dom.window;

    fillForm(dom, "", "0891234567");
    submitForm(dom);
    await nextTick();

    assert.equal(document.getElementById("tm-error").classList.contains("show"), true);
    assert.equal(document.getElementById("tm-error-text").textContent, "กรุณากรอกเลขที่คำสั่งผลิต (PO)");
    assert.equal(called, false, "ไม่ควรเรียก trackOrderStatus() เมื่อ validation ฝั่ง client ไม่ผ่าน");
  });

  test("กรอกเบอร์โทรน้อยกว่า 4 หลัก: แสดง error เบอร์โทรและไม่เรียก trackOrderStatus()", async () => {
    const dom = makeDom();
    let called = false;
    stubTrackOrderStatus(() => { called = true; return Promise.resolve(null); });
    await loadTrackModal(dom);
    const { document } = dom.window;

    fillForm(dom, "PO-2026-0120", "089");
    submitForm(dom);
    await nextTick();

    assert.equal(document.getElementById("tm-error").classList.contains("show"), true);
    assert.equal(document.getElementById("tm-error-text").textContent, "กรุณากรอกเบอร์โทรอย่างน้อย 4 หลักสุดท้าย");
    assert.equal(called, false);
  });

  test("เบอร์โทรที่มีขีด/วงเล็บปนแต่ตัวเลขจริงครบ 4 หลักขึ้นไป ผ่าน validation (นับเฉพาะตัวเลข)", async () => {
    const dom = makeDom();
    let receivedPhone = null;
    stubTrackOrderStatus((code, phone) => { receivedPhone = phone; return Promise.resolve(null); });
    await loadTrackModal(dom);

    fillForm(dom, "PO-2026-0120", "089-123");
    submitForm(dom);
    await nextTick();

    assert.equal(receivedPhone, "089-123", "trackOrderStatus() ควรได้รับค่าดิบที่ trim แล้ว ไม่ใช่ค่าที่ strip อักขระ (strip แค่ตอนนับความยาวใน validation)");
  });

  test("ยิง submit เกิน RATE_LIMIT (10 ครั้ง) ภายใน 10 นาที: แสดง error ค้นหาบ่อยเกินไป และไม่เรียก trackOrderStatus() ในครั้งที่เกิน", async () => {
    const dom = makeDom();
    let callCount = 0;
    stubTrackOrderStatus(() => { callCount += 1; return Promise.resolve(null); });
    await loadTrackModal(dom);
    const { document } = dom.window;

    for (let i = 0; i < 10; i++) {
      fillForm(dom, "PO-2026-0120", "0891234567");
      submitForm(dom);
      await nextTick();
    }
    assert.equal(callCount, 10, "10 ครั้งแรกควรผ่าน rate limit ปกติ");

    fillForm(dom, "PO-2026-0120", "0891234567");
    submitForm(dom);
    await nextTick();

    assert.equal(callCount, 10, "ครั้งที่ 11 ไม่ควรเรียก trackOrderStatus() อีก เพราะติด rate limit");
    assert.equal(document.getElementById("tm-error").classList.contains("show"), true);
    assert.match(document.getElementById("tm-error-text").textContent, /ค้นหาบ่อยเกินไป/);
  });

  test("trackOrderStatus() คืนค่า null (ไม่พบคำสั่งผลิต): แสดง error 'ไม่พบคำสั่งผลิตนี้' และไม่แสดงผลลัพธ์", async () => {
    const dom = makeDom();
    stubTrackOrderStatus(() => Promise.resolve(null));
    await loadTrackModal(dom);
    const { document } = dom.window;

    fillForm(dom, "PO-NOTFOUND", "0891234567");
    submitForm(dom);
    await nextTick();

    assert.equal(document.getElementById("tm-error").classList.contains("show"), true);
    assert.match(document.getElementById("tm-error-text").textContent, /ไม่พบคำสั่งผลิตนี้/);
    assert.equal(document.getElementById("tm-result").classList.contains("show"), false);
  });

  test("trackOrderStatus() reject (error จริง เช่น network ล่ม): แสดง error 'เกิดข้อผิดพลาดในการค้นหา'", async () => {
    const dom = makeDom();
    stubTrackOrderStatus(() => { throw new Error("network down"); });
    await loadTrackModal(dom);
    const { document } = dom.window;

    fillForm(dom, "PO-2026-0120", "0891234567");
    submitForm(dom);
    await nextTick();

    assert.equal(document.getElementById("tm-error").classList.contains("show"), true);
    assert.match(document.getElementById("tm-error-text").textContent, /เกิดข้อผิดพลาดในการค้นหา/);
  });

  test("ปุ่ม submit ถูก disable + ใส่คลาส is-loading ระหว่างรอผล แล้วคืนสภาพหลังผลลัพธ์กลับมา (สำเร็จ)", async () => {
    const dom = makeDom();
    let resolveFn;
    stubTrackOrderStatus(() => new Promise((resolve) => { resolveFn = resolve; }));
    await loadTrackModal(dom);
    const { document } = dom.window;
    const submitBtn = document.getElementById("tm-submit");

    fillForm(dom, "PO-2026-0120", "0891234567");
    submitForm(dom);
    await nextTick();

    assert.equal(submitBtn.disabled, true);
    assert.equal(submitBtn.classList.contains("is-loading"), true);

    resolveFn(SAMPLE_ORDER);
    await nextTick();

    assert.equal(submitBtn.disabled, false);
    assert.equal(submitBtn.classList.contains("is-loading"), false);
  });

  test("ปุ่ม submit คืนสภาพหลัง error เช่นกัน (finally() ทำงานทั้งเคส resolve และ reject)", async () => {
    const dom = makeDom();
    stubTrackOrderStatus(() => Promise.reject(new Error("boom")));
    await loadTrackModal(dom);
    const { document } = dom.window;
    const submitBtn = document.getElementById("tm-submit");

    fillForm(dom, "PO-2026-0120", "0891234567");
    submitForm(dom);
    await nextTick();

    assert.equal(submitBtn.disabled, false);
    assert.equal(submitBtn.classList.contains("is-loading"), false);
  });

  test("trackOrderStatus() คืน order จริง (สถานะ 'production'): renderResult() แสดงเลข PO/รายการ/badge สถานะ/% ความคืบหน้า/stage ถูกต้อง", async () => {
    const dom = makeDom();
    stubTrackOrderStatus(() => Promise.resolve(SAMPLE_ORDER));
    // scrollIntoView ไม่มีใน jsdom (ดูหมายเหตุสะสมรอบ 61) — renderResult() เรียกท้ายฟังก์ชัน ต้อง
    // stub ก่อน import เสมอ
    dom.window.HTMLElement.prototype.scrollIntoView = () => {};
    await loadTrackModal(dom);
    const { document } = dom.window;

    fillForm(dom, "PO-2026-0120", "0891234567");
    submitForm(dom);
    await nextTick();

    const resultBox = document.getElementById("tm-result");
    assert.equal(resultBox.classList.contains("show"), true);
    assert.equal(document.getElementById("tm-error").classList.contains("show"), false);

    assert.match(resultBox.innerHTML, /PO-2026-0120/);
    assert.match(resultBox.textContent, /ป้ายไฟ LED หน้าร้าน/);
    assert.match(resultBox.textContent, /จำนวน 2/);
    assert.match(resultBox.textContent, /กำลังผลิต/, "badge label ของสถานะ production ต้องมาจาก ORDER_STATUS จริง");
    assert.match(resultBox.textContent, /55%/);
    assert.match(resultBox.textContent, /ป้ายไฟ/, "หมวดป้าย (category) ต้องแสดง");

    const stages = resultBox.querySelectorAll(".tm-stage");
    assert.equal(stages.length, 8, "ORDER_STATUS_FLOW จริงมี 8 stage (ไม่รวม cancelled)");
    const currentStage = resultBox.querySelector(".tm-stage.current");
    assert.ok(currentStage, "ต้องมี stage ที่ current อยู่ 1 อัน");
    assert.match(currentStage.textContent, /กำลังผลิต/);
    const doneStages = resultBox.querySelectorAll(".tm-stage.done");
    assert.equal(doneStages.length, 3, "ก่อนหน้า production มี received/design/approval รวม 3 stage ที่ done แล้ว");
  });

  test("คำสั่งผลิตสถานะ 'cancelled': ไม่แสดง progress bar/stage list แต่แสดงข้อความแจ้งว่าถูกยกเลิก", async () => {
    const dom = makeDom();
    const cancelledOrder = { ...SAMPLE_ORDER, status: "cancelled" };
    stubTrackOrderStatus(() => Promise.resolve(cancelledOrder));
    dom.window.HTMLElement.prototype.scrollIntoView = () => {};
    await loadTrackModal(dom);
    const { document } = dom.window;

    fillForm(dom, "PO-2026-0120", "0891234567");
    submitForm(dom);
    await nextTick();

    const resultBox = document.getElementById("tm-result");
    assert.equal(resultBox.querySelectorAll(".tm-stage").length, 0, "สถานะ cancelled ไม่ควรมี stage list");
    assert.equal(resultBox.querySelector(".tm-progress-bar"), null, "สถานะ cancelled ไม่ควรมี progress bar");
    assert.match(resultBox.textContent, /ยกเลิกแล้ว/);
    assert.match(resultBox.textContent, /ยกเลิก/, "badge ต้องขึ้น label 'ยกเลิก' จาก ORDER_STATUS จริง");
  });

  test("มี shippingTrackingId: แสดงเลขพัสดุ, ไม่มี: ไม่แสดงบล็อกเลขพัสดุ", async () => {
    const domWith = makeDom();
    stubTrackOrderStatus(() => Promise.resolve({ ...SAMPLE_ORDER, shippingTrackingId: "TH1234567890" }));
    domWith.window.HTMLElement.prototype.scrollIntoView = () => {};
    await loadTrackModal(domWith);
    fillForm(domWith, "PO-2026-0120", "0891234567");
    submitForm(domWith);
    await nextTick();
    assert.match(domWith.window.document.getElementById("tm-result").textContent, /TH1234567890/);

    delete globalThis.__TM_STUB_TRACK_ORDER_STATUS__;

    const domWithout = makeDom();
    stubTrackOrderStatus(() => Promise.resolve(SAMPLE_ORDER));
    domWithout.window.HTMLElement.prototype.scrollIntoView = () => {};
    await loadTrackModal(domWithout);
    fillForm(domWithout, "PO-2026-0120", "0891234567");
    submitForm(domWithout);
    await nextTick();
    assert.equal(domWithout.window.document.getElementById("tm-result").querySelector(".tm-compliant"), null);
  });

  test("ปุ่มคัดลอกเลข PO: เรียก navigator.clipboard.writeText() ด้วยเลข PO และใส่คลาส 'copied' ชั่วคราว", async () => {
    const dom = makeDom();
    stubTrackOrderStatus(() => Promise.resolve(SAMPLE_ORDER));
    dom.window.HTMLElement.prototype.scrollIntoView = () => {};
    await loadTrackModal(dom);
    const { document } = dom.window;

    let writtenText = null;
    dom.window.navigator.clipboard = { writeText: (text) => { writtenText = text; return Promise.resolve(); } };

    fillForm(dom, "PO-2026-0120", "0891234567");
    submitForm(dom);
    await nextTick();

    const copyBtn = document.querySelector(".tm-copy-btn");
    assert.ok(copyBtn, "ต้องมีปุ่มคัดลอกเมื่อ order.code มีค่า");
    copyBtn.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    await nextTick();

    assert.equal(writtenText, "PO-2026-0120");
    assert.equal(copyBtn.classList.contains("copied"), true);
  });

  test("ยังไม่พังถ้า navigator.clipboard ไม่มีจริง (เช่นเบราว์เซอร์เก่า/บริบทไม่ปลอดภัย) — คลิกปุ่มคัดลอกไม่ throw", async () => {
    const dom = makeDom();
    stubTrackOrderStatus(() => Promise.resolve(SAMPLE_ORDER));
    dom.window.HTMLElement.prototype.scrollIntoView = () => {};
    await loadTrackModal(dom);
    const { document } = dom.window;
    // jsdom ไม่ implement Clipboard API เองอยู่แล้ว (navigator.clipboard เป็น undefined ตามปกติ)
    assert.equal(dom.window.navigator.clipboard, undefined);

    fillForm(dom, "PO-2026-0120", "0891234567");
    submitForm(dom);
    await nextTick();

    const copyBtn = document.querySelector(".tm-copy-btn");
    assert.doesNotThrow(() => {
      copyBtn.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    });
  });

  test("submit ซ้ำครั้งที่สองหลังพบผลลัพธ์แล้ว: ล้าง error/result เดิมก่อนแสดงผลลัพธ์ใหม่ (ไม่ค้างของเก่าปน)", async () => {
    const dom = makeDom();
    let callNo = 0;
    stubTrackOrderStatus(() => {
      callNo += 1;
      return callNo === 1 ? Promise.resolve(null) : Promise.resolve(SAMPLE_ORDER);
    });
    dom.window.HTMLElement.prototype.scrollIntoView = () => {};
    await loadTrackModal(dom);
    const { document } = dom.window;

    fillForm(dom, "PO-WRONG", "0891234567");
    submitForm(dom);
    await nextTick();
    assert.equal(document.getElementById("tm-error").classList.contains("show"), true);

    fillForm(dom, "PO-2026-0120", "0891234567");
    submitForm(dom);
    await nextTick();

    assert.equal(document.getElementById("tm-error").classList.contains("show"), false, "error เดิมต้องถูกซ่อนก่อนแสดงผลลัพธ์ใหม่ (hideError() ต้นฟังก์ชัน submit handler)");
    assert.equal(document.getElementById("tm-result").classList.contains("show"), true);
  });
});
