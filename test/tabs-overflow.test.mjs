// test/tabs-overflow.test.mjs
//
// jsdom test สำหรับ js/tabs-overflow.js — IIFE ที่ผูก `document.addEventListener(
// 'DOMContentLoaded', ...)` ตอนโหลด (auto-init ทุก .product-tabs ที่มีอยู่แล้ว) —
// ตามแพทเทิร์นที่บันทึกไว้รอบ 99 (เห็นได้ใน site-search.test.mjs): ต้อง**รอ
// document.readyState === "complete" ก่อนแล้วค่อย appendChild script** (poll ทุก 5ms)
// เพื่อให้ jsdom ยิง DOMContentLoaded ให้เอง ก่อนสคริปต์เริ่มผูก listener
//
// ข้อจำกัดสำคัญ: jsdom ไม่มี layout engine จริง — Element.getBoundingClientRect()/
// clientWidth คืนค่า 0 เสมอโดยดีฟอลต์ ทำให้ recalc() คิดว่าทุกแท็บพอดีบรรทัดเดียวเสมอ
// (total <= available เป็นจริงเสมอที่ 0 <= 0) จึงต้อง mock ค่าความกว้างเอง:
// - patch `Element.prototype.getBoundingClientRect` ต่อ dom instance ให้อ่านจาก
//   attribute `data-test-width` ของแต่ละ element (ปุ่ม "เพิ่มเติม" เองใช้ 90px คงที่
//   เพราะสร้างขึ้นเองใน build() ไม่มี attribute นี้)
// - override `clientWidth` ของ wrap ด้วย Object.defineProperty ต่ออินสแตนซ์
//
// ไม่ได้แก้ไฟล์ .js/.html/.css ที่เป็นโค้ดจริงเลยแม้แต่บรรทัดเดียวในไฟล์นี้ — งานทดสอบล้วนๆ

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const SOURCE = readFileSync(new URL("../js/tabs-overflow.js", import.meta.url), "utf-8");

const MORE_BTN_WIDTH = 90;

function tabsMarkup(labels) {
  return `<div class="product-tabs" id="pf-tabs">${labels
    .map((l, i) => `<button type="button" class="product-tab${i === 0 ? " active" : ""}" data-cat="${l}">${l}</button>`)
    .join("")}</div>`;
}

// สร้าง dom ตอน readyState ยังเป็น "loading" (ทันทีหลังสร้าง JSDOM instance — ยืนยันด้วย
// สคริปต์ debug แยกว่า readyState เริ่มที่ "loading" เสมอ) แล้ว patch getBoundingClientRect
// ให้พร้อมก่อน จากนั้นค่อย loadScript() **ก่อน** readyState จะกลายเป็น "complete" — สำคัญมาก:
// สคริปต์นี้ผูก `document.addEventListener('DOMContentLoaded', ...)` แบบไม่มีเงื่อนไข (ต่างจาก
// site-search.js ที่เช็ค readyState เองก่อน) ถ้ารอ readyState==="complete" ก่อนค่อย appendChild
// สคริปต์ DOMContentLoaded จะยิงไปแล้วก่อนที่ listener จะถูกผูก ทำให้ auto-init ไม่ทำงานเลย
function makeDom(markup) {
  const dom = new JSDOM(`<!doctype html><html><body>${markup}</body></html>`, {
    url: "https://example.test/portfolio.html",
    runScripts: "dangerously",
    pretendToBeVisual: true,
  });
  dom.window.Element.prototype.getBoundingClientRect = function () {
    const w = this.classList && this.classList.contains("product-tab-more")
      ? MORE_BTN_WIDTH
      : parseFloat(this.getAttribute("data-test-width") || "0");
    return { width: w, height: 30, top: 0, left: 0, right: w, bottom: 30, x: 0, y: 0, toJSON() {} };
  };
  return dom;
}

function setWrapWidth(dom, wrap, width) {
  Object.defineProperty(wrap, "clientWidth", { value: width, configurable: true });
}

function loadScript(dom) {
  const script = dom.window.document.createElement("script");
  script.textContent = SOURCE;
  dom.window.document.body.appendChild(script);
}

async function waitReady(dom) {
  while (dom.window.document.readyState !== "complete") {
    await new Promise((r) => setTimeout(r, 5));
  }
}

describe("tabs-overflow.js (รอบที่ 102)", () => {
  test("shape: โหลดสคริปต์ได้โดยไม่ throw และตั้ง window.CSIGN.initTabsOverflow ให้", async () => {
    const dom = makeDom(tabsMarkup(["A", "B"]));
    assert.doesNotThrow(() => loadScript(dom));
    assert.equal(typeof dom.window.CSIGN.initTabsOverflow, "function");
  });

  test("auto-init ผ่าน DOMContentLoaded: .product-tabs ที่มีอยู่แล้วถูก build() (มีปุ่ม 'เพิ่มเติม' เพิ่มเข้ามา)", async () => {
    const dom = makeDom(tabsMarkup(["A", "B", "C"]));
    const wrap = dom.window.document.getElementById("pf-tabs");
    setWrapWidth(dom, wrap, 1000); // กว้างพอ ไม่ต้อง overflow
    wrap.querySelectorAll(".product-tab").forEach((t) => t.setAttribute("data-test-width", "50"));
    loadScript(dom);
    await waitReady(dom);
    const moreBtn = wrap.querySelector(".product-tab-more");
    assert.ok(moreBtn, "ควรมีปุ่มเพิ่มเติมถูกสร้างขึ้นจาก auto-init");
  });

  test("ทุกแท็บพอดีในบรรทัดเดียว (ความกว้างรวม <= available): ปุ่ม 'เพิ่มเติม' ถูกซ่อน ไม่มีแท็บถูกย้ายเข้าเมนู", async () => {
    const dom = makeDom(tabsMarkup(["A", "B", "C"]));
    const wrap = dom.window.document.getElementById("pf-tabs");
    setWrapWidth(dom, wrap, 1000);
    wrap.querySelectorAll(".product-tab").forEach((t) => t.setAttribute("data-test-width", "50"));
    loadScript(dom);
    await waitReady(dom);
    const moreBtn = wrap.querySelector(".product-tab-more");
    assert.equal(moreBtn.style.display, "none");
    assert.equal(wrap.querySelectorAll(".product-tab:not(.product-tab-more)").length, 3);
  });

  test("แท็บล้นบรรทัด (ความกว้างรวมเกิน available): ปุ่ม 'เพิ่มเติม' แสดง และแท็บส่วนเกินถูกย้ายเข้าเมนู", async () => {
    const dom = makeDom(tabsMarkup(["A", "B", "C", "D"]));
    const wrap = dom.window.document.getElementById("pf-tabs");
    setWrapWidth(dom, wrap, 200); // แคบ บังคับให้ล้น
    wrap.querySelectorAll(".product-tab").forEach((t) => t.setAttribute("data-test-width", "80"));
    loadScript(dom);
    await waitReady(dom);
    const moreBtn = wrap.querySelector(".product-tab-more");
    const menu = moreBtn.querySelector(".product-tab-more-menu");
    assert.equal(moreBtn.style.display, "inline-flex");
    assert.ok(menu.children.length > 0, "ต้องมีแท็บอย่างน้อย 1 ตัวถูกย้ายเข้าเมนู");
    // แท็บตัวแรก (index 0) ต้องคงอยู่ในแถวหลักเสมอ (always keep at least the first tab visible)
    assert.ok(wrap.querySelector('[data-cat="A"]'));
    assert.equal(wrap.querySelector('[data-cat="A"]').parentElement, wrap);
  });

  test("แท็บที่ active อยู่ถูกซ่อนเข้าเมนู: ปุ่มเพิ่มเติมได้ class 'has-active'", async () => {
    const dom = makeDom(`<div class="product-tabs" id="pf-tabs">
      <button type="button" class="product-tab" data-cat="A">A</button>
      <button type="button" class="product-tab active" data-cat="B">B</button>
    </div>`);
    const wrap = dom.window.document.getElementById("pf-tabs");
    setWrapWidth(dom, wrap, 120); // แคบมาก บังคับให้เหลือแค่แท็บแรกในแถว
    wrap.querySelectorAll(".product-tab").forEach((t) => t.setAttribute("data-test-width", "100"));
    loadScript(dom);
    await waitReady(dom);
    const moreBtn = wrap.querySelector(".product-tab-more");
    assert.equal(moreBtn.classList.contains("has-active"), true);
  });

  test("คลิกปุ่ม 'เพิ่มเติม': เมนูเปิด (class open, aria-expanded=true) — คลิกซ้ำอีกครั้งปิดกลับ", async () => {
    const dom = makeDom(tabsMarkup(["A", "B", "C", "D"]));
    const wrap = dom.window.document.getElementById("pf-tabs");
    setWrapWidth(dom, wrap, 200);
    wrap.querySelectorAll(".product-tab").forEach((t) => t.setAttribute("data-test-width", "80"));
    loadScript(dom);
    await waitReady(dom);
    const moreBtn = wrap.querySelector(".product-tab-more");
    const menu = moreBtn.querySelector(".product-tab-more-menu");
    moreBtn.dispatchEvent(new dom.window.Event("click", { bubbles: true }));
    assert.equal(menu.classList.contains("open"), true);
    assert.equal(moreBtn.getAttribute("aria-expanded"), "true");
    moreBtn.dispatchEvent(new dom.window.Event("click", { bubbles: true }));
    assert.equal(menu.classList.contains("open"), false);
    assert.equal(moreBtn.getAttribute("aria-expanded"), "false");
  });

  test("คลิกที่นอกกล่องแท็บ (document click): ปิดเมนูที่เปิดค้างอยู่", async () => {
    const dom = makeDom(tabsMarkup(["A", "B", "C", "D"]));
    const wrap = dom.window.document.getElementById("pf-tabs");
    setWrapWidth(dom, wrap, 200);
    wrap.querySelectorAll(".product-tab").forEach((t) => t.setAttribute("data-test-width", "80"));
    loadScript(dom);
    await waitReady(dom);
    const moreBtn = wrap.querySelector(".product-tab-more");
    const menu = moreBtn.querySelector(".product-tab-more-menu");
    moreBtn.dispatchEvent(new dom.window.Event("click", { bubbles: true }));
    assert.equal(menu.classList.contains("open"), true);
    dom.window.document.body.dispatchEvent(new dom.window.Event("click", { bubbles: true }));
    assert.equal(menu.classList.contains("open"), false);
  });

  test("กด Escape: ปิดเมนูที่เปิดค้างอยู่", async () => {
    const dom = makeDom(tabsMarkup(["A", "B", "C", "D"]));
    const wrap = dom.window.document.getElementById("pf-tabs");
    setWrapWidth(dom, wrap, 200);
    wrap.querySelectorAll(".product-tab").forEach((t) => t.setAttribute("data-test-width", "80"));
    loadScript(dom);
    await waitReady(dom);
    const moreBtn = wrap.querySelector(".product-tab-more");
    const menu = moreBtn.querySelector(".product-tab-more-menu");
    moreBtn.dispatchEvent(new dom.window.Event("click", { bubbles: true }));
    assert.equal(menu.classList.contains("open"), true);
    dom.window.document.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    assert.equal(menu.classList.contains("open"), false);
  });

  test("คลิกแท็บที่อยู่ในเมนู: ปิดเมนูหลัง 80ms (setTimeout) โดยไม่รบกวน click listener เดิมของแท็บ", async () => {
    const dom = makeDom(tabsMarkup(["A", "B", "C", "D"]));
    const wrap = dom.window.document.getElementById("pf-tabs");
    setWrapWidth(dom, wrap, 200);
    wrap.querySelectorAll(".product-tab").forEach((t) => t.setAttribute("data-test-width", "80"));
    loadScript(dom);
    await waitReady(dom);
    const moreBtn = wrap.querySelector(".product-tab-more");
    const menu = moreBtn.querySelector(".product-tab-more-menu");
    moreBtn.dispatchEvent(new dom.window.Event("click", { bubbles: true }));
    const tabInMenu = menu.querySelector(".product-tab");
    assert.ok(tabInMenu, "ต้องมีแท็บอยู่ในเมนูให้คลิกทดสอบ");
    let originalClicked = false;
    tabInMenu.addEventListener("click", () => { originalClicked = true; });
    tabInMenu.dispatchEvent(new dom.window.Event("click", { bubbles: true }));
    assert.equal(originalClicked, true, "click listener เดิมของแท็บต้องยังทำงาน (ย้าย ไม่ clone)");
    // หมายเหตุ: menu เป็นลูกของ moreBtn เอง (moreBtn.appendChild(menu)) การคลิกแท็บในเมนูจึง
    // bubble ขึ้นไปโดน click listener ของ moreBtn เองด้วย (ไม่ใช่แค่ของ menu) — listener นั้น
    // toggle เมนูทันที (ปิด เพราะตอนนี้เปิดอยู่) จึงปิดทันทีแบบ synchronous ไม่ต้องรอ 80ms
    // (setTimeout ใน listener ของ menu เป็นแค่การปิดซ้ำ/กันเหนียว ไม่ใช่ตัวปิดหลักในเคสนี้)
    assert.equal(menu.classList.contains("open"), false, "ปิดทันทีแบบ synchronous เพราะ event bubble ไปโดน click listener ของ moreBtn เองด้วย");
    await new Promise((r) => setTimeout(r, 120));
    assert.equal(menu.classList.contains("open"), false, "ยังปิดอยู่หลังผ่าน 80ms (setTimeout ของ menu listener ปิดซ้ำ ไม่ throw)");
  });

  test("เรียก window.CSIGN.initTabsOverflow(wrap) ซ้ำ (เช่น หลัง products.js rebuild แท็บใหม่): ไม่สร้างปุ่ม 'เพิ่มเติม' ซ้ำสอง", async () => {
    const dom = makeDom(tabsMarkup(["A", "B", "C"]));
    const wrap = dom.window.document.getElementById("pf-tabs");
    setWrapWidth(dom, wrap, 1000);
    wrap.querySelectorAll(".product-tab").forEach((t) => t.setAttribute("data-test-width", "50"));
    loadScript(dom);
    await waitReady(dom);
    dom.window.CSIGN.initTabsOverflow(wrap);
    dom.window.CSIGN.initTabsOverflow(wrap);
    assert.equal(wrap.querySelectorAll(".product-tab-more").length, 1);
  });

  test("wrap ที่ไม่มีแท็บใดเลย: init() ไม่ throw และไม่สร้างปุ่มเพิ่มเติม (allTabs ว่างเปล่า → recalc return early)", async () => {
    const dom = makeDom(`<div class="product-tabs" id="pf-tabs"></div>`);
    const wrap = dom.window.document.getElementById("pf-tabs");
    setWrapWidth(dom, wrap, 500);
    assert.doesNotThrow(() => loadScript(dom));
  });

  test("window.CSIGN.initTabsOverflow(null): ไม่ throw (guard if (!wrap) return)", async () => {
    const dom = makeDom(tabsMarkup(["A"]));
    loadScript(dom);
    await waitReady(dom);
    assert.doesNotThrow(() => dom.window.CSIGN.initTabsOverflow(null));
  });
});
