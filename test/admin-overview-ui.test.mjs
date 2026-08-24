// test/admin-overview-ui.test.mjs
//
// jsdom test สำหรับ js/admin-overview-ui.js — classic script (ไม่มี IIFE, ไม่มี
// event listener ผูกกับ document/window ตอนโหลด) ที่ query DOM แล้วผูก event
// โดยตรงกับปุ่ม 2 ปุ่มที่มีอยู่แล้วใน DOM (collapsible toggle x2 + chart tab switcher)
// แพทเทิร์นเดียวกับ qmodal.test.mjs (รอบ 101): appendChild script เข้า jsdom
// (runScripts:"dangerously") แล้วตรวจผลลัพธ์ทันที ไม่ต้อง poll readyState เพราะโค้ด
// รันแบบ synchronous ทั้งหมดตอนถูกโหลด (querySelectorAll + addEventListener เท่านั้น
// ไม่มี async/setTimeout ใดๆ ในการผูก listener เอง)
//
// markup อ้างอิงจาก admin.html จริง (บรรทัดที่มี id="ov-content-toggle" ฯลฯ) — คัด
// เฉพาะโครงที่ไฟล์นี้ใช้จริง (ปุ่ม toggle 2 คู่ + chart tabs 2 แท็บ + panel 2 อัน)
//
// ไม่ได้แก้ไฟล์ .js/.html/.css ที่เป็นโค้ดจริงเลยแม้แต่บรรทัดเดียวในไฟล์นี้ — งานทดสอบล้วนๆ

import { test, describe, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const SOURCE = readFileSync(new URL("../js/admin-overview-ui.js", import.meta.url), "utf-8");

const MARKUP = `
<button type="button" class="cp-ov-toggle-btn" id="ov-content-toggle" aria-expanded="false" aria-controls="ov-content-stats-wrap">
  <span>แสดงสถิติ</span>
</button>
<div class="cp-ov-collapsible" id="ov-content-stats-wrap"></div>

<button type="button" class="cp-ov-toggle-btn" id="ov-more-toggle" aria-expanded="false" aria-controls="ov-more-wrap">
  <span>แสดง</span>
</button>
<div class="cp-ov-collapsible" id="ov-more-wrap"></div>

<div class="cchart-tabs" id="ov-chart-tabs" role="tablist">
  <button type="button" class="cchart-tab active" data-chart-panel="daily" role="tab" aria-selected="true">รายวัน</button>
  <button type="button" class="cchart-tab" data-chart-panel="monthly" role="tab" aria-selected="false">รายเดือน</button>
</div>
<div class="ov-chart-panel" id="ov-chart-panel-daily"></div>
<div class="ov-chart-panel" id="ov-chart-panel-monthly" style="display:none;"></div>
`;

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

describe("admin-overview-ui.js — wireCollapsible() (รอบที่ 102)", () => {
  test("shape: โหลดสคริปต์ได้โดยไม่ throw เมื่อ DOM มีองค์ประกอบครบ", () => {
    assert.doesNotThrow(() => loadDom(MARKUP));
  });

  test("คลิกปุ่ม ov-content-toggle ครั้งแรก: เพิ่ม class is-open, aria-expanded=true, เปลี่ยนข้อความปุ่มเป็น labelOff", () => {
    const dom = loadDom(MARKUP);
    const { document } = dom.window;
    const btn = document.getElementById("ov-content-toggle");
    const wrap = document.getElementById("ov-content-stats-wrap");
    btn.dispatchEvent(new dom.window.Event("click", { bubbles: true }));
    assert.equal(wrap.classList.contains("is-open"), true);
    assert.equal(btn.getAttribute("aria-expanded"), "true");
    assert.equal(btn.querySelector("span").textContent, "ซ่อนสถิติ");
  });

  test("คลิกปุ่ม ov-content-toggle ครั้งที่สอง: toggle กลับ (ปิด, aria-expanded=false, labelOn)", () => {
    const dom = loadDom(MARKUP);
    const { document } = dom.window;
    const btn = document.getElementById("ov-content-toggle");
    const wrap = document.getElementById("ov-content-stats-wrap");
    btn.dispatchEvent(new dom.window.Event("click", { bubbles: true }));
    btn.dispatchEvent(new dom.window.Event("click", { bubbles: true }));
    assert.equal(wrap.classList.contains("is-open"), false);
    assert.equal(btn.getAttribute("aria-expanded"), "false");
    assert.equal(btn.querySelector("span").textContent, "แสดงสถิติ");
  });

  test("ปุ่ม ov-more-toggle ทำงานเป็นอิสระจาก ov-content-toggle (คลิกอันหนึ่งไม่กระทบอีกอัน)", () => {
    const dom = loadDom(MARKUP);
    const { document } = dom.window;
    const contentBtn = document.getElementById("ov-content-toggle");
    const moreBtn = document.getElementById("ov-more-toggle");
    const moreWrap = document.getElementById("ov-more-wrap");
    moreBtn.dispatchEvent(new dom.window.Event("click", { bubbles: true }));
    assert.equal(moreWrap.classList.contains("is-open"), true);
    assert.equal(moreBtn.querySelector("span").textContent, "ซ่อน");
    assert.equal(contentBtn.getAttribute("aria-expanded"), "false");
  });

  test("ถ้า DOM ไม่มีปุ่ม toggle เลย (หน้าไม่มี element เหล่านี้) โหลดสคริปต์แล้วไม่ throw", () => {
    assert.doesNotThrow(() => loadDom("<div>empty page</div>"));
  });

  test("คลิกแท็บ monthly ใน chart tabs: active class ย้าย, aria-selected สลับ, panel แสดง/ซ่อนสลับกัน", () => {
    const dom = loadDom(MARKUP);
    const { document } = dom.window;
    const monthlyTab = document.querySelector('[data-chart-panel="monthly"]');
    const dailyTab = document.querySelector('[data-chart-panel="daily"]');
    monthlyTab.dispatchEvent(new dom.window.Event("click", { bubbles: true }));
    assert.equal(monthlyTab.classList.contains("active"), true);
    assert.equal(monthlyTab.getAttribute("aria-selected"), "true");
    assert.equal(dailyTab.classList.contains("active"), false);
    assert.equal(dailyTab.getAttribute("aria-selected"), "false");
    assert.equal(document.getElementById("ov-chart-panel-daily").style.display, "none");
    assert.equal(document.getElementById("ov-chart-panel-monthly").style.display, "");
  });

  test("คลิกที่พื้นที่ว่างของแถบแท็บ (ไม่ใช่ปุ่ม .cchart-tab เอง) ไม่ทำอะไรเลย (closest() คืน null)", () => {
    const dom = loadDom(MARKUP);
    const { document } = dom.window;
    const tabs = document.getElementById("ov-chart-tabs");
    const dailyTab = document.querySelector('[data-chart-panel="daily"]');
    assert.doesNotThrow(() =>
      tabs.dispatchEvent(new dom.window.Event("click", { bubbles: true }))
    );
    // สถานะเดิมไม่เปลี่ยน (daily ยัง active)
    assert.equal(dailyTab.classList.contains("active"), true);
  });

  test("ถ้ามีแค่ ov-chart-tabs แต่ไม่มี panel daily/monthly เลย: คลิกแท็บไม่ throw (guard el ใน forEach)", () => {
    const dom = loadDom(`
      <div class="cchart-tabs" id="ov-chart-tabs">
        <button type="button" class="cchart-tab active" data-chart-panel="daily">รายวัน</button>
        <button type="button" class="cchart-tab" data-chart-panel="monthly">รายเดือน</button>
      </div>`);
    const { document } = dom.window;
    const monthlyTab = document.querySelector('[data-chart-panel="monthly"]');
    assert.doesNotThrow(() =>
      monthlyTab.dispatchEvent(new dom.window.Event("click", { bubbles: true }))
    );
  });
});
