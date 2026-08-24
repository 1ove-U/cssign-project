// test/exit-intent-cta.test.mjs — รอบที่ 155
//
// js/exit-intent-cta.js (160 บรรทัด) เป็น classic script (IIFE, 0 exports) ที่รันทันทีตอนโหลด —
// สร้างป๊อปอัพเสนอขอใบเสนอราคาเมื่อผู้ใช้ scroll ผ่าน 70% ของหน้า (ทุกอุปกรณ์ trigger เดียวกันหมด
// ไม่มีการแยก desktop mouseleave อีกต่อไป) พร้อม guard สองชั้น: MIN_DWELL_MS (4000ms หลังโหลดหน้า
// ถึงจะเริ่มดักฟัง scroll) และ shownThisLoad (แสดงได้แค่ครั้งเดียวต่อการโหลดหน้า) — auto-dismiss ตัวเอง
// หลัง AUTO_HIDE_MS (5000ms) ผ่าน window.setTimeout(hidePopup, AUTO_HIDE_MS)
//
// วิธีทดสอบ: โหลดเป็น classic <script> จริงเข้า JSDOM (runScripts: "dangerously") ตามแพทเทิร์นเดียวกับ
// test/hero-parallax.test.mjs — จุดที่ต้องควบคุมเอง (ตรวจสอบด้วยสคริปต์ทดลองแยกก่อนเขียนไฟล์นี้แล้ว):
//   - `armedAt = Date.now() + MIN_DWELL_MS` คำนวณครั้งเดียวตอน script eval (synchronous) — ต้อง mock
//     `dom.window.Date.now` **ก่อน** appendChild script tag เพื่อคุมค่าเริ่มต้น แล้วเปลี่ยนค่าที่คืนได้
//     อีกทีหลังจากนั้นเพื่อจำลองเวลาผ่านไป (เทียบกับ armedAt ที่คำนวณไว้แล้วครั้งเดียว)
//   - `window.setTimeout(hidePopup, AUTO_HIDE_MS)`/`window.clearTimeout(autoHideTimer)` เรียกผ่าน
//     `window.` ตรงๆ ทั้งคู่ (ไม่ใช่ unqualified) — override `dom.window.setTimeout`/`clearTimeout` เป็น
//     spy ที่แค่บันทึกไว้ (ไม่รันจริง) แล้วเรียก callback ที่จับไว้เองตอนต้องการจำลองว่าเวลาผ่านไปแล้ว
//     แทนที่จะรอ 5 วินาทีจริงในเทส — override ได้ทั้งก่อน/หลัง runScript() เพราะเป็น property lookup ทุก
//     ครั้งที่เรียก ไม่ใช่ผูกค่าไว้ตอน define ฟังก์ชัน
//   - depth คำนวณจาก `(window.scrollY || doc.scrollTop) / (doc.scrollHeight - doc.clientHeight)` —
//     jsdom ไม่ layout จริง ต้อง Object.defineProperty ทับค่า scrollHeight/clientHeight บน
//     documentElement โดยตรง (readonly getter ปกติ แต่ override ด้วย defineProperty ใหม่ได้เพราะเป็น
//     instance property ไม่ใช่ Window.prototype ที่ non-configurable แบบ location)
//   - requestAnimationFrame mock แบบ synchronous (เหมือน hero-parallax.test.mjs) ให้ double-rAF ใน
//     showPopup() (สำหรับใส่ class "show") รันจบทันทีในเทส ไม่ต้องรอ event loop เพิ่ม
//
// หมายเหตุ jsdom: ปุ่ม CTA ตอนไม่มี window.openModal จะพยายามตั้ง `window.location.href` (นำทางไป
// contact.html) — jsdom ไม่ implement การนำทางจริงและ property `location`/`href` เป็น
// non-configurable แก้ทับไม่ได้ (ยืนยันแบบเดียวกับที่ test/site-search.test.mjs เจอมาก่อน) เทสจึง
// ตรวจแค่ว่าไม่ throw เท่านั้นสำหรับ path นี้ (log "Not implemented: navigation..." ออกมาปกติ ไม่ใช่
// error จริง)
//
// อ่านโค้ดจริงทั้งไฟล์ js/exit-intent-cta.js ละเอียดก่อนเขียนไฟล์นี้ทั้งหมด — ไม่พบบั๊ก จึงเป็นไฟล์
// เทสล้วนๆ ไม่มีการแก้โค้ดผลิตภัณฑ์เลยแม้แต่บรรทัดเดียว

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const SOURCE = readFileSync(new URL("../js/exit-intent-cta.js", import.meta.url), "utf-8");

function makeDom({ now } = {}) {
  const dom = new JSDOM(`<!doctype html><html><body></body></html>`, {
    url: "https://example.test/",
    runScripts: "dangerously",
    pretendToBeVisual: true,
  });
  dom.window.requestAnimationFrame = (cb) => { cb(); return 1; };
  if (typeof now === "number") dom.window.Date.now = () => now;
  return dom;
}

function runScript(dom) {
  const script = dom.window.document.createElement("script");
  script.textContent = SOURCE;
  dom.window.document.body.appendChild(script);
}

// override window.scrollHeight/clientHeight (documentElement)/scrollY เพื่อคุม depth คำนวณ
function setLayout(dom, { scrollHeight, clientHeight, scrollY = 0 }) {
  const doc = dom.window.document.documentElement;
  Object.defineProperty(doc, "scrollHeight", { value: scrollHeight, configurable: true });
  Object.defineProperty(doc, "clientHeight", { value: clientHeight, configurable: true });
  Object.defineProperty(dom.window, "scrollY", { value: scrollY, configurable: true });
}

function dispatchScroll(dom) {
  dom.window.dispatchEvent(new dom.window.Event("scroll"));
}

// spy บน window.setTimeout/clearTimeout — คืน { calls, clearedIds } ให้เทสเรียก callback เองตอน
// ต้องการจำลองเวลาผ่านไป แทนที่จะรอ real timer จริง
function stubTimers(dom) {
  const calls = [];
  const clearedIds = [];
  let idCounter = 0;
  dom.window.setTimeout = function (cb, ms) {
    idCounter += 1;
    calls.push({ id: idCounter, cb, ms });
    return idCounter;
  };
  dom.window.clearTimeout = function (id) {
    clearedIds.push(id);
  };
  return { calls, clearedIds };
}

function popupEl(dom) {
  return dom.window.document.querySelector(".eic-popup");
}

describe("js/exit-intent-cta.js — scroll-depth quote CTA popup", () => {
  test("debug hook window.CSSIGN_EXIT_CTA.show() แสดงป๊อปอัพทันที ไม่ต้องรอ scroll/dwell — markup ครบถ้วน", () => {
    const dom = makeDom();
    runScript(dom);
    dom.window.CSSIGN_EXIT_CTA.show();

    const el = popupEl(dom);
    assert.ok(el, "ต้องมี .eic-popup ถูกสร้างขึ้น");
    assert.equal(el.parentElement, dom.window.document.body, "ต้อง append เข้า document.body");
    assert.equal(el.getAttribute("role"), "dialog");
    assert.equal(el.getAttribute("aria-live"), "polite");
    assert.ok(el.getAttribute("aria-label"), "ต้องมี aria-label");
    assert.ok(el.querySelector("#eic-close"), "ต้องมีปุ่มปิด");
    assert.ok(el.querySelector("#eic-cta"), "ต้องมีปุ่ม CTA");
    assert.match(el.querySelector("#eic-cta").textContent, /ขอใบเสนอราคา/);
    assert.ok(el.querySelector(".eic-progress"), "ต้องมี progress bar countdown");
    assert.ok(
      dom.window.document.documentElement.classList.contains("has-eic-popup"),
      "ต้องเพิ่ม class has-eic-popup ที่ <html> เพื่อให้ CSS หลบปุ่ม back-to-top/แชท"
    );
  });

  test("debug hook show() ไม่แสดงป๊อปอัพถ้า #qmodal-overlay เปิดอยู่ (display:flex) — กันโชว์ทับฟอร์มขอใบเสนอราคาเดิม", () => {
    const dom = makeDom();
    const qmodal = dom.window.document.createElement("div");
    qmodal.id = "qmodal-overlay";
    qmodal.style.display = "flex";
    dom.window.document.body.appendChild(qmodal);

    runScript(dom);
    dom.window.CSSIGN_EXIT_CTA.show();

    assert.equal(popupEl(dom), null, "ต้องไม่มี .eic-popup ถูกสร้างขึ้นเลย");
  });

  test("ยังไม่ครบ MIN_DWELL_MS (4000ms) หลังโหลดหน้า — scroll event ที่ depth เกิน threshold ก็ยังไม่แสดงป๊อปอัพ", () => {
    const dom = makeDom({ now: 1_000_000 }); // armedAt = 1_004_000
    runScript(dom);
    setLayout(dom, { scrollHeight: 2000, clientHeight: 1000, scrollY: 900 }); // depth = 0.9

    dispatchScroll(dom);

    assert.equal(popupEl(dom), null, "ยังไม่ถึงเวลาที่ arm ไว้ (Date.now() ยังเท่าเดิม) — ต้องไม่แสดง");
  });

  test("ครบ MIN_DWELL_MS แล้ว แต่ scroll depth ยังไม่ถึง 70% — ไม่แสดงป๊อปอัพ", () => {
    const dom = makeDom({ now: 1_000_000 });
    runScript(dom);
    dom.window.Date.now = () => 1_004_001; // ผ่าน armedAt แล้ว
    setLayout(dom, { scrollHeight: 2000, clientHeight: 1000, scrollY: 500 }); // depth = 0.5 < 0.70

    dispatchScroll(dom);

    assert.equal(popupEl(dom), null);
  });

  test("หน้าไม่ scrollable เลย (scrollHeight === clientHeight) — ไม่แสดงป๊อปอัพแม้ dwell ครบแล้ว", () => {
    const dom = makeDom({ now: 1_000_000 });
    runScript(dom);
    dom.window.Date.now = () => 1_004_001;
    setLayout(dom, { scrollHeight: 800, clientHeight: 800, scrollY: 0 }); // scrollable = 0

    dispatchScroll(dom);

    assert.equal(popupEl(dom), null, "scrollable <= 0 ต้อง return ก่อนคำนวณ depth (กัน division by zero)");
  });

  test("ครบ MIN_DWELL_MS + scroll depth >= 70% — แสดงป๊อปอัพจริงผ่าน scroll event ปกติ (ไม่ใช้ debug hook)", () => {
    const dom = makeDom({ now: 1_000_000 });
    runScript(dom);
    dom.window.Date.now = () => 1_004_001;
    setLayout(dom, { scrollHeight: 2000, clientHeight: 1000, scrollY: 700 }); // depth = 0.70 พอดี

    dispatchScroll(dom);

    assert.ok(popupEl(dom), "depth ถึง threshold พอดี (>=) ต้องแสดงป๊อปอัพ");
  });

  test("shownThisLoad guard: หลังแสดงป๊อปอัพจาก scroll ไปแล้วครั้งหนึ่ง scroll event ที่ผ่านเงื่อนไขซ้ำอีกครั้งไม่ทำให้แสดงซ้ำ", () => {
    const dom = makeDom({ now: 1_000_000 });
    runScript(dom);
    dom.window.Date.now = () => 1_004_001;
    setLayout(dom, { scrollHeight: 2000, clientHeight: 1000, scrollY: 900 });

    dispatchScroll(dom);
    const firstEl = popupEl(dom);
    assert.ok(firstEl, "ครั้งแรกต้องแสดง");

    // scroll ต่อ (depth ยังเกิน threshold เหมือนเดิม) — ต้องไม่สร้างป๊อปอัพใหม่/ไม่มีผลอะไรเพิ่ม
    dispatchScroll(dom);
    assert.equal(popupEl(dom), firstEl, "ป๊อปอัพเดิมต้องยังอยู่ตัวเดิม ไม่ถูกสร้างซ้ำหรือแทนที่");
  });

  test("ปุ่มปิด (#eic-close) → hidePopup(): ลบ class has-eic-popup, ป๊อปอัพเปลี่ยนเป็น class hide (ไม่ใช่ show), ยกเลิก auto-hide timer", () => {
    const dom = makeDom();
    runScript(dom);
    const { clearedIds } = stubTimers(dom);

    dom.window.CSSIGN_EXIT_CTA.show();
    const el = popupEl(dom);
    assert.ok(el.classList.contains("show"), "ต้องมี class show ก่อนปิด");

    el.querySelector("#eic-close").click();

    assert.equal(
      dom.window.document.documentElement.classList.contains("has-eic-popup"),
      false,
      "ต้องลบ class has-eic-popup ออกจาก <html> ทันทีตอนปิด"
    );
    assert.equal(el.classList.contains("show"), false);
    assert.ok(el.classList.contains("hide"), "ต้องเพิ่ม class hide สำหรับ animation ตอนปิด");
    assert.equal(clearedIds.length, 1, "ต้องยกเลิก auto-hide timer ทันทีที่ปิดด้วยตนเอง");
  });

  test("ปุ่ม CTA (#eic-cta) เมื่อมี window.openModal — ปิดป๊อปอัพก่อนแล้วเรียก window.openModal('form', {source:'exit_intent_cta'})", () => {
    const dom = makeDom();
    runScript(dom);
    const openModalCalls = [];
    dom.window.openModal = function (tab, opts) { openModalCalls.push({ tab, opts }); };

    dom.window.CSSIGN_EXIT_CTA.show();
    const el = popupEl(dom);
    el.querySelector("#eic-cta").click();

    // เทียบทีละ field แทน deepEqual ตรงๆ — opts มาจาก object realm ของ jsdom window (คนละ
    // Object.prototype กับฝั่ง Node) ทำให้ assert.deepEqual (strict mode) ล้มเพราะ prototype
    // ไม่ตรงกัน แม้โครงสร้าง/ค่าจะเหมือนกันทุกประการก็ตาม
    assert.equal(openModalCalls.length, 1);
    assert.equal(openModalCalls[0].tab, "form");
    assert.equal(openModalCalls[0].opts.source, "exit_intent_cta");
    assert.ok(el.classList.contains("hide"), "กด CTA ต้องปิดป๊อปอัพเดิมไปด้วย ไม่ใช่ปล่อยค้างซ้อนฟอร์มใหม่");
  });

  test("ปุ่ม CTA เมื่อไม่มี window.openModal (หน้าไม่มีฟอร์มโมดัลติดตั้ง) และไม่ได้อยู่ /en/ — ไม่ throw (พยายามนำทางไป contact.html)", () => {
    const dom = makeDom();
    runScript(dom);
    assert.equal(typeof dom.window.openModal, "undefined");

    dom.window.CSSIGN_EXIT_CTA.show();
    const el = popupEl(dom);
    assert.doesNotThrow(() => el.querySelector("#eic-cta").click());
  });

  test("ปุ่ม CTA เมื่อไม่มี window.openModal และอยู่ในโฟลเดอร์ /en/ — ไม่ throw (พยายามนำทางไป ../contact.html แทน)", () => {
    const dom = new JSDOM(`<!doctype html><html><body></body></html>`, {
      url: "https://example.test/en/index.html",
      runScripts: "dangerously",
      pretendToBeVisual: true,
    });
    dom.window.requestAnimationFrame = (cb) => { cb(); return 1; };
    runScript(dom);
    assert.equal(typeof dom.window.openModal, "undefined");
    assert.match(dom.window.location.pathname, /\/en\//);

    dom.window.CSSIGN_EXIT_CTA.show();
    const el = popupEl(dom);
    assert.doesNotThrow(() => el.querySelector("#eic-cta").click());
  });

  test("auto-hide timer: showPopup() ตั้ง window.setTimeout(hidePopup, 5000) — เรียก callback ที่จับไว้ตรงๆ ทำให้ป๊อปอัพถูกซ่อนอัตโนมัติเหมือนกดปิดเอง", () => {
    const dom = makeDom();
    runScript(dom);
    const { calls } = stubTimers(dom);

    dom.window.CSSIGN_EXIT_CTA.show();
    const el = popupEl(dom);

    const autoHideCall = calls.find((c) => c.ms === 5000);
    assert.ok(autoHideCall, "ต้องตั้ง timer 5000ms (AUTO_HIDE_MS) ไว้ตอนแสดงป๊อปอัพ");

    autoHideCall.cb(); // จำลองเวลาผ่านไปครบ AUTO_HIDE_MS

    assert.equal(el.classList.contains("show"), false);
    assert.ok(el.classList.contains("hide"), "ต้องซ่อนป๊อปอัพอัตโนมัติเหมือนกดปิดเอง");
    assert.equal(
      dom.window.document.documentElement.classList.contains("has-eic-popup"),
      false
    );
  });

  test("mousemove บนป๊อปอัพตั้งค่า CSS custom property --eic-ry/--eic-rx ตามตำแหน่งเมาส์ (cursor tilt), mouseleave รีเซ็ตกลับ 0deg", () => {
    const dom = makeDom();
    runScript(dom);
    dom.window.CSSIGN_EXIT_CTA.show();
    const el = popupEl(dom);

    // mock getBoundingClientRect ให้มีขนาด/ตำแหน่งแน่นอน แล้วจำลองเมาส์อยู่มุมขวาล่าง (px=1, py=1)
    el.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 100 });
    el.dispatchEvent(new dom.window.MouseEvent("mousemove", { clientX: 200, clientY: 100 }));

    // px=1 -> ry = (1-0.5)*2*5 = 5deg ; py=1 -> rx = (0.5-1)*2*5 = -5deg
    assert.equal(el.style.getPropertyValue("--eic-ry"), "5.00deg");
    assert.equal(el.style.getPropertyValue("--eic-rx"), "-5.00deg");

    el.dispatchEvent(new dom.window.MouseEvent("mouseleave"));
    assert.equal(el.style.getPropertyValue("--eic-ry"), "0deg");
    assert.equal(el.style.getPropertyValue("--eic-rx"), "0deg");
  });
});
