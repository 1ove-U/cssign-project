// test/about-portfolio-extracted-inline-scripts.test.mjs
//
// jsdom test สำหรับ js/about-tilt-effects.js / js/about-flip-cards.js /
// js/portfolio-tab-filter.js — ไฟล์ใหม่ 3 ไฟล์จากรอบที่ 81 ที่ย้ายออกมาจาก inline
// <script> เดิมใน about.html/en/about.html/portfolio.html/en/portfolio.html แบบไม่มี
// การเปลี่ยน logic เลย (เตรียมเอา 'unsafe-inline' ออกจาก Content-Security-Policy ในอนาคต
// — ดู REFACTOR-PROGRESS.md หัวข้อ "รอบที่ 81")
//
// วิธีทดสอบ: เหมือน test/main-js-dom.test.mjs — โหลดเป็น classic <script> จริงเข้า JSDOM
// window (runScripts: "dangerously") พร้อม HTML ที่มี element ครบตามที่แต่ละไฟล์ต้องการ
// แล้วยิง event จริงตรวจพฤติกรรม — ไฟล์เหล่านี้เป็น UI-layer ล้วนๆ ไม่ import อะไรจาก db.js
// จึงไม่ต้อง stub Firebase

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const tiltSource = readFileSync(new URL("../js/about-tilt-effects.js", import.meta.url), "utf-8");
const flipSource = readFileSync(new URL("../js/about-flip-cards.js", import.meta.url), "utf-8");
const filterSource = readFileSync(new URL("../js/portfolio-tab-filter.js", import.meta.url), "utf-8");

function runScript(dom, source) {
  const scriptEl = dom.window.document.createElement("script");
  scriptEl.textContent = source;
  dom.window.document.body.appendChild(scriptEl);
}

describe("js/about-tilt-effects.js — signature/value-card tilt (รอบที่ 81, ย้ายจาก about.html inline)", () => {
  test("finePointer=false (เช่นมือถือ) — ไม่ throw และไม่ผูก listener ใดๆ", () => {
    const dom = new JSDOM(
      `<!doctype html><html><body>
        <div data-tilt></div>
        <div data-tilt-card></div>
      </body></html>`,
      {
        url: "https://example.test/",
        runScripts: "dangerously",
        pretendToBeVisual: true,
      }
    );
    // jsdom ไม่ implement matchMedia จริง — window.matchMedia เป็น undefined ปกติ
    // (เท่ากับ finePointer=false ตาม `window.matchMedia && ...`) ทำให้ script return early
    assert.equal(dom.window.matchMedia, undefined);
    assert.doesNotThrow(() => runScript(dom, tiltSource));
  });

  test("finePointer=true, reduceMotion=false — mousemove/mouseleave บน [data-tilt] ไม่ throw และตั้ง transform", () => {
    const dom = new JSDOM(
      `<!doctype html><html><body>
        <div data-tilt style="width:200px;height:100px;"></div>
      </body></html>`,
      {
        url: "https://example.test/",
        runScripts: "dangerously",
        pretendToBeVisual: true,
      }
    );
    dom.window.matchMedia = (query) => ({
      matches: query.indexOf("pointer: fine") !== -1,
    });
    // jsdom ไม่ layout จริง — getBoundingClientRect คืน 0 ทุกด้าน แต่ยังต้องไม่ throw
    dom.window.requestAnimationFrame = (cb) => { cb(); return 1; };

    runScript(dom, tiltSource);

    const sig = dom.window.document.querySelector("[data-tilt]");
    assert.doesNotThrow(() => {
      sig.dispatchEvent(new dom.window.MouseEvent("mousemove", { clientX: 50, clientY: 50 }));
    });
    assert.doesNotThrow(() => {
      sig.dispatchEvent(new dom.window.MouseEvent("mouseleave"));
    });
    assert.equal(sig.style.transform, "rotateX(0deg) rotateY(0deg)");
  });

  test("ไม่มี [data-tilt]/[data-tilt-card] เลยในหน้า — ไม่ throw (guard ป้องกัน element ไม่มีจริง)", () => {
    const dom = new JSDOM(`<!doctype html><html><body></body></html>`, {
      url: "https://example.test/",
      runScripts: "dangerously",
      pretendToBeVisual: true,
    });
    dom.window.matchMedia = () => ({ matches: true });
    assert.doesNotThrow(() => runScript(dom, tiltSource));
  });
});

describe("js/about-flip-cards.js — expertise flip card toggle (รอบที่ 81, ย้ายจาก about.html inline)", () => {
  function makeFlipDom() {
    const dom = new JSDOM(
      `<!doctype html><html><body>
        <div class="ab-flip" tabindex="0"></div>
      </body></html>`,
      {
        url: "https://example.test/",
        runScripts: "dangerously",
        pretendToBeVisual: true,
      }
    );
    runScript(dom, flipSource);
    return dom;
  }

  test("คลิกครั้งแรก: toggle is-flipped เป็น true + aria-pressed=true", () => {
    const dom = makeFlipDom();
    const card = dom.window.document.querySelector(".ab-flip");
    card.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    assert.equal(card.classList.contains("is-flipped"), true);
    assert.equal(card.getAttribute("aria-pressed"), "true");
  });

  test("คลิกครั้งที่สอง: toggle กลับเป็น false + aria-pressed=false", () => {
    const dom = makeFlipDom();
    const card = dom.window.document.querySelector(".ab-flip");
    card.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    card.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    assert.equal(card.classList.contains("is-flipped"), false);
    assert.equal(card.getAttribute("aria-pressed"), "false");
  });

  test("กด Enter: toggle เหมือนคลิก (keyboard activation)", () => {
    const dom = makeFlipDom();
    const card = dom.window.document.querySelector(".ab-flip");
    const ev = new dom.window.KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
    card.dispatchEvent(ev);
    assert.equal(card.classList.contains("is-flipped"), true);
  });

  test("กด space bar: toggle เหมือนคลิก + preventDefault (กันหน้า scroll)", () => {
    const dom = makeFlipDom();
    const card = dom.window.document.querySelector(".ab-flip");
    const ev = new dom.window.KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true });
    const notPrevented = card.dispatchEvent(ev);
    assert.equal(card.classList.contains("is-flipped"), true);
    assert.equal(notPrevented, false); // dispatchEvent คืน false เมื่อ preventDefault ถูกเรียก
  });

  test("กดปุ่มอื่น (ไม่ใช่ Enter/space): ไม่ toggle", () => {
    const dom = makeFlipDom();
    const card = dom.window.document.querySelector(".ab-flip");
    const ev = new dom.window.KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
    card.dispatchEvent(ev);
    assert.equal(card.classList.contains("is-flipped"), false);
  });
});

describe("js/portfolio-tab-filter.js — portfolio tab filter (รอบที่ 81, ย้ายจาก portfolio.html inline)", () => {
  function makeFilterDom() {
    const dom = new JSDOM(
      `<!doctype html><html><body>
        <div id="pf-tabs">
          <button class="product-tab active" data-filter="all">All</button>
          <button class="product-tab" data-filter="cat-a">Cat A</button>
        </div>
        <div id="pf-grid">
          <div class="port-card" data-cat="cat-a"></div>
          <div class="port-card" data-cat="cat-b"></div>
        </div>
        <span id="pf-count"></span>
        <div id="pf-empty"></div>
      </body></html>`,
      {
        url: "https://example.test/",
        runScripts: "dangerously",
        pretendToBeVisual: true,
      }
    );
    runScript(dom, filterSource);
    return dom;
  }

  test("คลิก tab cat-a: ซ่อนการ์ดที่ไม่ตรง data-cat, active class ย้ายไปปุ่มที่คลิก, count/empty อัปเดต", () => {
    const dom = makeFilterDom();
    const doc = dom.window.document;
    const tabA = doc.querySelector('[data-filter="cat-a"]');
    tabA.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));

    assert.equal(tabA.classList.contains("active"), true);
    assert.equal(doc.querySelector('[data-filter="all"]').classList.contains("active"), false);

    const cardA = doc.querySelector('[data-cat="cat-a"]');
    const cardB = doc.querySelector('[data-cat="cat-b"]');
    assert.equal(cardA.classList.contains("pf-hidden"), false);
    assert.equal(cardB.classList.contains("pf-hidden"), true);
    assert.equal(doc.getElementById("pf-count").textContent, "1");
    assert.equal(doc.getElementById("pf-empty").classList.contains("show"), false);
  });

  test("คลิก tab ที่ไม่มีการ์ดตรงเลย: pf-empty ได้ class show + count เป็น 0", () => {
    const dom = makeFilterDom();
    const doc = dom.window.document;
    // เพิ่มปุ่ม tab ใหม่ที่ไม่มีการ์ดตรง แล้วจำลอง flow เดียวกับที่ portfolio-tab-filter.js
    // querySelectorAll ไปแล้วตอนโหลด — ทดสอบผ่านการยิง event บนปุ่มที่ query ไว้แล้วแทน
    // ปรับการ์ดทั้งหมดให้ data-cat ไม่ตรงกับ "cat-a" เพื่อจำลอง "ไม่มีการ์ดตรงเลย"
    doc.querySelectorAll(".port-card").forEach((c) => c.setAttribute("data-cat", "cat-z"));
    const tabA = doc.querySelector('[data-filter="cat-a"]');
    tabA.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));

    assert.equal(doc.getElementById("pf-count").textContent, "0");
    assert.equal(doc.getElementById("pf-empty").classList.contains("show"), true);
  });

  test("คลิก tab \"all\" หลังกรองแล้ว: การ์ดทั้งหมดกลับมาแสดงหมด", () => {
    const dom = makeFilterDom();
    const doc = dom.window.document;
    doc.querySelector('[data-filter="cat-a"]').dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    doc.querySelector('[data-filter="all"]').dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));

    const cards = doc.querySelectorAll(".port-card");
    cards.forEach((c) => assert.equal(c.classList.contains("pf-hidden"), false));
    assert.equal(doc.getElementById("pf-count").textContent, "2");
  });
});
