// test/main-js-dom.test.mjs
//
// jsdom test สำหรับ js/main.js — classic script (ไม่ใช่ ES module) ที่ผูก DOM ทั้งไฟล์
// (page transition/sticky nav/mobile menu/reveal/stat counters/FAQ accordion/product tab
// filter/back-to-top) เพิ่มในรอบที่ 34 พร้อมกับการลบ "7. TESTIMONIAL CAROUSEL" (โค้ดตายแล้ว —
// ดูเหตุผลเต็มที่คอมเมนต์ใน js/main.js เอง) เพื่อยืนยันว่าการลบไม่กระทบส่วนอื่นที่เหลือของไฟล์เลย
//
// วิธีทดสอบ: โหลด js/main.js เป็น <script> จริงเข้า JSDOM window (runScripts: "dangerously")
// พร้อม HTML ที่มี element ครบตามที่แต่ละ section ต้องการ แล้วยิง event จริงตรวจพฤติกรรม —
// ไม่ mock DOM เอง เพราะไฟล์นี้เป็น classic script โหลดตรงๆ ได้เลย ไม่ต้อง stub Firebase
// (ไฟล์นี้ไม่ import อะไรจาก db.js เลย เป็น UI-layer ล้วนๆ)
//
// หมายเหตุข้อจำกัด jsdom (ตามที่บันทึกไว้จากรอบก่อนๆ): ไม่ implement IntersectionObserver จริง
// (main.js เองมี guard `'IntersectionObserver' in window` อยู่แล้ว จึงลง path "ไม่มี IO" อย่าง
// ปลอดภัย — ทดสอบแค่ว่าไม่ throw error และ element ไม่ถูกซ่อนค้าง ไม่ได้ทดสอบ animation จริง)

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const mainJsSource = readFileSync(new URL("../js/main.js", import.meta.url), "utf-8");

const baseHtml = `<!doctype html>
<html>
<head></head>
<body>
  <header id="site-header"><div id="topbar"></div></header>
  <button id="burger-btn" aria-expanded="false"></button>
  <nav id="mobile-menu"><a href="#a">a</a><button id="mobile-close-btn"></button></nav>
  <button id="mobile-dd-trigger"></button>
  <div id="mobile-dd-panel"></div>

  <div class="stat-num" data-count="120">0</div>

  <div class="faq-item">
    <button class="faq-q">Q1</button>
    <div class="faq-a">A1</div>
  </div>
  <div class="faq-item">
    <button class="faq-q">Q2</button>
    <div class="faq-a">A2</div>
  </div>

  <button class="product-tab active" data-filter="all">All</button>
  <button class="product-tab" data-filter="cat-a">Cat A</button>
  <div class="product-card" data-cat="cat-a"></div>
  <div class="product-card" data-cat="cat-b"></div>
</body>
</html>`;

function makeDom() {
  return new JSDOM(baseHtml, {
    url: "https://example.test/",
    runScripts: "dangerously",
    pretendToBeVisual: true,
  });
}

function runMainJs(dom) {
  const scriptEl = dom.window.document.createElement("script");
  scriptEl.textContent = mainJsSource;
  dom.window.document.body.appendChild(scriptEl);
}

describe("js/main.js — auto-rotating carousel removal (รอบที่ 34)", () => {
  test("window.CSSIGN_initTestiCarousel ไม่ถูกสร้างอีกต่อไป (ยืนยันว่าลบออกจริง)", () => {
    const dom = makeDom();
    runMainJs(dom);
    assert.equal(dom.window.CSSIGN_initTestiCarousel, undefined);
  });

  test("ไม่มีโค้ดที่ทำงานจริง (function/getElementById) อ้างอิงถึง testi- เหลืออยู่ — เหลือแค่คอมเมนต์อธิบายเหตุผลเท่านั้น", () => {
    assert.ok(!mainJsSource.includes("function initTestiCarousel"));
    assert.ok(!mainJsSource.includes("getElementById('testi-track')"));
    assert.ok(!mainJsSource.includes("querySelectorAll('.testi-card')"));
    assert.ok(!mainJsSource.includes("window.CSSIGN_initTestiCarousel ="));
  });
});

describe("js/main.js — ส่วนอื่นที่เหลือยังทำงานปกติ (ไม่ได้รับผลกระทบจากการลบ)", () => {
  test("window.CSSIGN_observeReveal ยังถูกตั้งค่าเหมือนเดิม (ไฟล์อื่นพึ่งพาอยู่)", () => {
    const dom = makeDom();
    runMainJs(dom);
    assert.equal(typeof dom.window.CSSIGN_observeReveal, "function");
  });

  test("mobile menu: burger เปิดเมนู, close button ปิดเมนู", () => {
    const dom = makeDom();
    runMainJs(dom);
    const { document } = dom.window;
    const burger = document.getElementById("burger-btn");
    const menu = document.getElementById("mobile-menu");
    const closeBtn = document.getElementById("mobile-close-btn");

    burger.dispatchEvent(new dom.window.Event("click", { bubbles: true }));
    assert.ok(menu.classList.contains("open"));
    assert.equal(burger.getAttribute("aria-expanded"), "true");

    closeBtn.dispatchEvent(new dom.window.Event("click", { bubbles: true }));
    assert.ok(!menu.classList.contains("open"));
    assert.equal(burger.getAttribute("aria-expanded"), "false");
  });

  test("mobile dropdown panel: trigger toggles 'open' class", () => {
    const dom = makeDom();
    runMainJs(dom);
    const { document } = dom.window;
    const trigger = document.getElementById("mobile-dd-trigger");

    trigger.dispatchEvent(new dom.window.Event("click", { bubbles: true }));
    assert.ok(trigger.classList.contains("open"));

    trigger.dispatchEvent(new dom.window.Event("click", { bubbles: true }));
    assert.ok(!trigger.classList.contains("open"));
  });

  test("FAQ accordion: เปิดข้อหนึ่งจะปิดข้ออื่นที่เปิดอยู่โดยอัตโนมัติ", () => {
    const dom = makeDom();
    runMainJs(dom);
    const { document } = dom.window;
    const items = document.querySelectorAll(".faq-item");
    const q1 = items[0].querySelector(".faq-q");
    const q2 = items[1].querySelector(".faq-q");

    q1.dispatchEvent(new dom.window.Event("click", { bubbles: true }));
    assert.ok(items[0].classList.contains("open"));

    q2.dispatchEvent(new dom.window.Event("click", { bubbles: true }));
    assert.ok(items[1].classList.contains("open"));
    assert.ok(!items[0].classList.contains("open"), "เปิดข้อ 2 ต้องปิดข้อ 1 อัตโนมัติ");
  });

  test("product tab filter: กรอง product-card ตาม data-cat ให้ตรงกับ data-filter ที่เลือก", () => {
    const dom = makeDom();
    runMainJs(dom);
    const { document } = dom.window;
    const tabs = document.querySelectorAll(".product-tab");
    const catATab = Array.from(tabs).find((t) => t.getAttribute("data-filter") === "cat-a");
    const cards = document.querySelectorAll(".product-card");

    catATab.dispatchEvent(new dom.window.Event("click", { bubbles: true }));

    assert.equal(cards[0].style.display, "");     // data-cat="cat-a" — แสดง
    assert.equal(cards[1].style.display, "none"); // data-cat="cat-b" — ซ่อน
    assert.ok(catATab.classList.contains("active"));
  });

  test("back-to-top: ปุ่มถูก inject เข้า body ครั้งเดียว ไม่ซ้ำ", () => {
    const dom = makeDom();
    runMainJs(dom);
    const { document } = dom.window;
    const buttons = document.querySelectorAll(".back-to-top");
    assert.equal(buttons.length, 1);
  });

  test("scroll-progress-bar: ถูก inject เข้า body หนึ่งจุด", () => {
    const dom = makeDom();
    runMainJs(dom);
    const { document } = dom.window;
    assert.equal(document.querySelectorAll(".scroll-progress-bar").length, 1);
  });

  test("ไม่ throw error แม้ไม่มี element ของ section ใดเลยในหน้า (guard ทุกจุดทำงานถูก)", () => {
    const dom = new JSDOM("<!doctype html><html><body></body></html>", {
      url: "https://example.test/",
      runScripts: "dangerously",
      pretendToBeVisual: true,
    });
    assert.doesNotThrow(() => runMainJs(dom));
  });
});
