// test/admin-tap-tooltip.test.mjs
//
// jsdom test สำหรับ js/admin-tap-tooltip.js — classic script (ไม่มี IIFE) ที่รัน
// top-level code ทันทีตอนโหลด: หาการ์ดที่มี [title] ทุกใบใน DOM ตอนนั้น, ย้าย title
// ไปเป็นปุ่ม "ⓘ" + bubble popover, และผูก document click listener (ปิด bubble ทั้งหมด
// เมื่อคลิกที่อื่น) — แพทเทิร์นเดียวกับ qmodal.test.mjs: appendChild script เข้า jsdom
// (runScripts:"dangerously") หลังจากมี DOM การ์ดพร้อมแล้ว แล้วตรวจผลลัพธ์ทันที
//
// markup อ้างอิงคลาส .cp-stat-card ที่ admin.html ใช้จริง (ดู admin-overview-ui.test.mjs)
//
// ไม่ได้แก้ไฟล์ .js/.html/.css ที่เป็นโค้ดจริงเลยแม้แต่บรรทัดเดียวในไฟล์นี้ — งานทดสอบล้วนๆ

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const SOURCE = readFileSync(new URL("../js/admin-tap-tooltip.js", import.meta.url), "utf-8");

function loadDom(markup) {
  const dom = new JSDOM(`<!doctype html><html><body>${markup}</body></html>`, {
    url: "https://example.test/admin.html",
    runScripts: "dangerously",
  });
  const script = dom.window.document.createElement("script");
  script.textContent = SOURCE;
  dom.window.document.body.appendChild(script);
  return dom;
}

const ONE_CARD = `<div class="cp-stat-card" title="คำนวณจากยอดขาย/จำนวนลีดทั้งหมด">
  <span class="cp-stat-num">42%</span>
</div>`;

const TWO_CARDS = `
<div class="cp-stat-card" title="คำอธิบายการ์ด 1">การ์ด 1</div>
<div class="cp-stat-card" title="คำอธิบายการ์ด 2">การ์ด 2</div>`;

describe("admin-tap-tooltip.js (รอบที่ 102)", () => {
  test("shape: โหลดสคริปต์ได้โดยไม่ throw เมื่อมีการ์ดที่มี title", () => {
    assert.doesNotThrow(() => loadDom(ONE_CARD));
  });

  test("ลบ title attribute ออกจากการ์ด และสร้างปุ่ม ⓘ + bubble ที่ซ่อนอยู่", () => {
    const dom = loadDom(ONE_CARD);
    const { document } = dom.window;
    const card = document.querySelector(".cp-stat-card");
    assert.equal(card.hasAttribute("title"), false);
    const btn = card.querySelector(".cp-tap-info-btn");
    const bubble = card.querySelector(".cp-tap-info-bubble");
    assert.ok(btn, "ต้องมีปุ่ม info");
    assert.ok(bubble, "ต้องมี bubble");
    assert.equal(bubble.style.display, "none");
    assert.equal(bubble.textContent, "คำนวณจากยอดขาย/จำนวนลีดทั้งหมด");
  });

  test("คลิกปุ่ม ⓘ ครั้งแรก: bubble แสดง (display: block)", () => {
    const dom = loadDom(ONE_CARD);
    const { document } = dom.window;
    const btn = document.querySelector(".cp-tap-info-btn");
    const bubble = document.querySelector(".cp-tap-info-bubble");
    btn.dispatchEvent(new dom.window.Event("click", { bubbles: true, cancelable: true }));
    assert.equal(bubble.style.display, "block");
  });

  test("คลิกปุ่ม ⓘ ซ้ำอีกครั้ง: bubble ปิดกลับ (toggle)", () => {
    const dom = loadDom(ONE_CARD);
    const { document } = dom.window;
    const btn = document.querySelector(".cp-tap-info-btn");
    const bubble = document.querySelector(".cp-tap-info-bubble");
    btn.dispatchEvent(new dom.window.Event("click", { bubbles: true, cancelable: true }));
    btn.dispatchEvent(new dom.window.Event("click", { bubbles: true, cancelable: true }));
    assert.equal(bubble.style.display, "none");
  });

  test("เปิด bubble ของการ์ดที่ 1 แล้วคลิกปุ่มการ์ดที่ 2: bubble การ์ด 1 ปิด, การ์ด 2 เปิด (closeAllBubbles ก่อนเปิดใหม่เสมอ)", () => {
    const dom = loadDom(TWO_CARDS);
    const { document } = dom.window;
    const btns = document.querySelectorAll(".cp-tap-info-btn");
    const bubbles = document.querySelectorAll(".cp-tap-info-bubble");
    btns[0].dispatchEvent(new dom.window.Event("click", { bubbles: true, cancelable: true }));
    assert.equal(bubbles[0].style.display, "block");
    btns[1].dispatchEvent(new dom.window.Event("click", { bubbles: true, cancelable: true }));
    assert.equal(bubbles[0].style.display, "none");
    assert.equal(bubbles[1].style.display, "block");
  });

  test("คลิกที่ document (นอกปุ่ม/บับเบิล) ปิด bubble ที่เปิดอยู่ทั้งหมด", () => {
    const dom = loadDom(ONE_CARD);
    const { document } = dom.window;
    const btn = document.querySelector(".cp-tap-info-btn");
    const bubble = document.querySelector(".cp-tap-info-bubble");
    btn.dispatchEvent(new dom.window.Event("click", { bubbles: true, cancelable: true }));
    assert.equal(bubble.style.display, "block");
    document.body.dispatchEvent(new dom.window.Event("click", { bubbles: true, cancelable: true }));
    assert.equal(bubble.style.display, "none");
  });

  test("การ์ดที่ไม่มี title attribute เลย: ไม่ถูกแปลงเป็นปุ่ม (ไม่มี .cp-tap-info-btn)", () => {
    const dom = loadDom(`<div class="cp-stat-card">ไม่มี title</div>`);
    const { document } = dom.window;
    assert.equal(document.querySelector(".cp-tap-info-btn"), null);
  });

  test("DOM ไม่มีการ์ดเลย: โหลดสคริปต์ไม่ throw", () => {
    assert.doesNotThrow(() => loadDom("<div>empty page</div>"));
  });

  test("card.style.position ถูกตั้งเป็น relative ถ้ายังไม่มี position เดิม", () => {
    const dom = loadDom(ONE_CARD);
    const { document } = dom.window;
    const card = document.querySelector(".cp-stat-card");
    assert.equal(card.style.position, "relative");
  });
});
