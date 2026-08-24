// test/track-modal-liff-link.test.mjs — P1.5 (LIFF auto-link)
//
// jsdom test สำหรับปุ่ม "เชื่อมบัญชี LINE" ที่เพิ่มเข้าไปใน js/track-modal.js (renderResult()
// เรียก renderLineLinkSection() เพิ่ม + ปุ่มใหม่ #tm-line-link-btn delegate ผ่าน #tm-result เดิม
// เหมือนปุ่มอื่นทุกตัวในไฟล์นี้)
//
// pattern เดียวกับ test/track-modal-design-approval.test.mjs ทุกประการ (โหลด markup จาก
// js/track-modal-template.js, stub trackOrderStatus()/linkLineAccount() ผ่าน
// test/helpers/db-orders-stub-loader.mjs) — mock window.liff เอง (ไม่โหลด LIFF SDK จริง
// ผ่าน <script> tag — loadLiffSdk() ใน track-modal.js เช็ค window.liff อยู่แล้วก่อนอื่นใด
// ถ้ามีอยู่แล้วจะ resolve() ทันทีไม่ inject script เลย ดู track-modal.js) — ไม่ทดสอบซ้ำ flow
// submit ฟอร์ม/validation/rate-limit/ปุ่มอื่นๆ ที่มี test อยู่แล้วในไฟล์อื่น ขอบเขตไฟล์นี้เฉพาะ
// ส่วนเชื่อมบัญชี LINE เท่านั้น
//
// ไม่ได้แก้ไฟล์ .js/.html/.css ที่เป็นโค้ดจริงเลยแม้แต่บรรทัดเดียวในไฟล์นี้ — งานทดสอบล้วนๆ

import { test, describe, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const TM_TEMPLATE_SRC = readFileSync(new URL("../js/track-modal-template.js", import.meta.url), "utf-8");
const TM_HTML_MATCH = TM_TEMPLATE_SRC.match(/var HTML = `([\s\S]*?)`;/);
if (!TM_HTML_MATCH) throw new Error("track-modal-liff-link.test.mjs: ดึง template literal จาก js/track-modal-template.js ไม่สำเร็จ");
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
function stubLinkLineAccount(impl) {
  globalThis.__TM_STUB_LINK_LINE_ACCOUNT__ = impl;
}

// mock ขั้นต่ำสุดของ window.liff — loadLiffSdk() ใน track-modal.js เช็ค `if (window.liff)`
// ก่อนอื่นใดแล้ว resolve() ทันทีถ้ามีอยู่แล้ว ไม่ inject <script> tag เลย (ดูคอมเมนต์ใน
// track-modal.js) จึงไม่ต้อง mock การโหลด SDK จริงผ่าน network
function mockLiff(dom, { loggedIn, idToken }) {
  dom.window.liff = {
    init: () => Promise.resolve(),
    isLoggedIn: () => !!loggedIn,
    login: function () { this.__loginCalled = true; },
    getIDToken: () => idToken || null,
  };
  return dom.window.liff;
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
function nextTick(times = 1) {
  return times <= 1
    ? new Promise((resolve) => setTimeout(resolve, 0))
    : nextTick(1).then(() => nextTick(times - 1));
}

const UNLINKED_ORDER = {
  id: "PO-2026-0120_1234",
  code: "PO-2026-0120",
  item: "ป้ายไฟ LED หน้าร้าน",
  qty: 2,
  category: "ป้ายไฟ",
  status: "production",
  progress: 55,
  dueDate: "2026-07-01",
  shippingTrackingId: "",
  lineUserId: "",
};

const LINKED_ORDER = { ...UNLINKED_ORDER, lineUserId: "Uabc123realuser" };

async function searchAndGet(dom, order, code = "PO-2026-0120", phone = "0891234567") {
  // clone ทุกครั้ง — handleLineLinkClick() ใน track-modal.js เขียนทับ currentOrder.lineUserId
  // ตรงๆ (ดู track-modal.js) ถ้าไม่ clone จะ mutate fixture object เดิม (UNLINKED_ORDER/
  // LINKED_ORDER) ที่ประกาศไว้ระดับ module รั่วข้าม test อื่นในไฟล์นี้ไปด้วย
  stubTrackOrderStatus(() => Promise.resolve({ ...order }));
  await loadTrackModal(dom);
  fillForm(dom, code, phone);
  submitForm(dom);
  await nextTick();
}

describe('js/track-modal.js — ปุ่ม "เชื่อมบัญชี LINE" (P1.5, LIFF auto-link)', () => {
  afterEach(() => {
    delete globalThis.__TM_STUB_TRACK_ORDER_STATUS__;
    delete globalThis.__TM_STUB_LINK_LINE_ACCOUNT__;
  });

  test("ออเดอร์ที่ยังไม่เชื่อม (lineUserId ว่าง): แสดงปุ่ม #tm-line-link-btn", async () => {
    const dom = makeDom();
    await searchAndGet(dom, UNLINKED_ORDER);

    const btn = dom.window.document.getElementById("tm-line-link-btn");
    assert.ok(btn, "ต้องมีปุ่มเชื่อมบัญชี LINE แสดงเมื่อ lineUserId ว่าง");
    assert.match(btn.textContent, /เชื่อมบัญชี LINE/);
  });

  test("ออเดอร์ที่เชื่อมแล้ว (lineUserId มีค่า): ไม่แสดงปุ่ม แสดงข้อความยืนยันแทน", async () => {
    const dom = makeDom();
    await searchAndGet(dom, LINKED_ORDER);

    assert.equal(dom.window.document.getElementById("tm-line-link-btn"), null, "ไม่ควรมีปุ่มเชื่อมบัญชีอีกถ้าเชื่อมแล้ว");
    const section = dom.window.document.getElementById("tm-line-link-section");
    assert.ok(section, "ต้องมี section แสดงสถานะเชื่อมบัญชีอยู่เสมอ");
    assert.match(section.textContent, /เชื่อมบัญชี LINE แล้ว/);
  });

  test("กดปุ่มตอนยังไม่ login LINE: เรียก liff.login() และไม่เรียก linkLineAccount()", async () => {
    const dom = makeDom();
    await searchAndGet(dom, UNLINKED_ORDER);
    const liff = mockLiff(dom, { loggedIn: false });

    let linkCalled = false;
    stubLinkLineAccount(() => { linkCalled = true; return Promise.resolve({ lineUserId: "U123" }); });

    click(dom, dom.window.document.getElementById("tm-line-link-btn"));
    await nextTick(3);

    assert.equal(liff.__loginCalled, true, "ต้องเรียก liff.login() ถ้ายังไม่ login");
    assert.equal(linkCalled, false, "ไม่ควรเรียก linkLineAccount() ถ้ายังไม่ login (login จะ redirect ออกไปก่อน)");
  });

  test("กดปุ่มตอน login LINE แล้ว: เรียก linkLineAccount(idToken, code, phone) ด้วยค่าที่ถูกต้อง", async () => {
    const dom = makeDom();
    await searchAndGet(dom, UNLINKED_ORDER, "PO-2026-0120", "0891234567");
    mockLiff(dom, { loggedIn: true, idToken: "fake-liff-id-token" });

    let calledWith = null;
    stubLinkLineAccount((idToken, code, phone) => {
      calledWith = [idToken, code, phone];
      return Promise.resolve({ lineUserId: "Uabc123realuser" });
    });

    click(dom, dom.window.document.getElementById("tm-line-link-btn"));
    await nextTick(3);

    assert.ok(calledWith, "ต้องเรียก linkLineAccount()");
    assert.deepEqual(calledWith, ["fake-liff-id-token", "PO-2026-0120", "0891234567"]);
  });

  test("เชื่อมสำเร็จ: เปลี่ยนจากปุ่มเป็นข้อความยืนยัน โดยไม่ต้องค้นหาใหม่", async () => {
    const dom = makeDom();
    await searchAndGet(dom, UNLINKED_ORDER);
    mockLiff(dom, { loggedIn: true, idToken: "fake-liff-id-token" });
    stubLinkLineAccount(() => Promise.resolve({ lineUserId: "Uabc123realuser" }));

    click(dom, dom.window.document.getElementById("tm-line-link-btn"));
    await nextTick(3);

    assert.equal(dom.window.document.getElementById("tm-line-link-btn"), null, "ปุ่มต้องหายไปหลังเชื่อมสำเร็จ");
    const section = dom.window.document.getElementById("tm-line-link-section");
    assert.match(section.textContent, /เชื่อมบัญชี LINE แล้ว/);
  });

  test("linkLineAccount() reject ด้วย code 'invalid_line_token': แสดงข้อความ error และเปิดปุ่มกลับให้กดใหม่ได้", async () => {
    const dom = makeDom();
    await searchAndGet(dom, UNLINKED_ORDER);
    mockLiff(dom, { loggedIn: true, idToken: "fake-liff-id-token" });
    stubLinkLineAccount(() => Promise.reject(Object.assign(new Error("bad token"), { code: "invalid_line_token" })));

    const btn = dom.window.document.getElementById("tm-line-link-btn");
    click(dom, btn);
    await nextTick(3);

    assert.equal(btn.disabled, false, "ปุ่มต้องกลับมากดได้อีกหลัง error");
    const msg = dom.window.document.getElementById("tm-line-link-msg");
    assert.match(msg.textContent, /ยืนยันตัวตนผ่าน LINE ไม่สำเร็จ/);
  });

  test("linkLineAccount() reject ด้วย code 'order_not_found': แสดงข้อความ error ที่ตรงกับสาเหตุ", async () => {
    const dom = makeDom();
    await searchAndGet(dom, UNLINKED_ORDER);
    mockLiff(dom, { loggedIn: true, idToken: "fake-liff-id-token" });
    stubLinkLineAccount(() => Promise.reject(Object.assign(new Error("not found"), { code: "order_not_found" })));

    click(dom, dom.window.document.getElementById("tm-line-link-btn"));
    await nextTick(3);

    const msg = dom.window.document.getElementById("tm-line-link-msg");
    assert.match(msg.textContent, /เลขที่ PO หรือเบอร์โทรไม่ตรง/);
  });

  test("กดปุ่มซ้ำระหว่างกำลังโหลด (btn.disabled=true อยู่แล้ว): ไม่เรียก linkLineAccount() ซ้ำ", async () => {
    const dom = makeDom();
    await searchAndGet(dom, UNLINKED_ORDER);
    mockLiff(dom, { loggedIn: true, idToken: "fake-liff-id-token" });

    let callCount = 0;
    let resolveFirst;
    stubLinkLineAccount(() => {
      callCount += 1;
      return new Promise((resolve) => { resolveFirst = resolve; });
    });

    const btn = dom.window.document.getElementById("tm-line-link-btn");
    click(dom, btn);
    await nextTick(2);
    assert.equal(btn.disabled, true, "ปุ่มต้องถูกปิดทันทีตอนกำลังเชื่อมบัญชี");

    click(dom, btn); // กดซ้ำตอนปุ่ม disabled อยู่ — handler เช็ค btn.disabled เองด้วย นอกเหนือจาก DOM disabled attr
    await nextTick(2);

    assert.equal(callCount, 1, "ไม่ควรเรียก linkLineAccount() ซ้ำสองครั้งจากการกดซ้ำระหว่างรอผลลัพธ์แรก");
    resolveFirst({ lineUserId: "Uabc123realuser" });
  });
});
