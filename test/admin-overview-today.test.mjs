// test/admin-overview-today.test.mjs
//
// jsdom test สำหรับ js/admin-overview-today.js — classic script (ไม่มี IIFE) ที่รัน
// render() ทันทีตอนโหลด แล้วผูก MutationObserver เฝ้าดู 3 element ตัวเลข
// (#cp-stat-overdue/#cp-stat-duesoon/#ov-stat-leads-new) เพื่อ re-render อัตโนมัติ
// เมื่อไฟล์อื่น (orders-tab.js/admin-page.js) อัปเดตตัวเลขเหล่านั้น
//
// แพทเทิร์น: appendChild script (runScripts:"dangerously") หลังมี DOM/markup จริงจาก
// admin.html ครบ แล้วตรวจ render() ครั้งแรกทันที — ส่วน MutationObserver callback รัน
// ผ่าน requestAnimationFrame (async คิวไมโครทาสก์ + macrotask ของ jsdom) จึงต้อง await
// ด้วย setTimeout(0) หลัง mutate DOM ก่อนตรวจผล (เหมือน pattern รอ MutationObserver
// ทั่วไปใน jsdom ไม่ต้อง poll readyState เพราะไม่เกี่ยวกับการโหลดสคริปต์)
//
// ไม่ได้แก้ไฟล์ .js/.html/.css ที่เป็นโค้ดจริงเลยแม้แต่บรรทัดเดียวในไฟล์นี้ — งานทดสอบล้วนๆ

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const SOURCE = readFileSync(new URL("../js/admin-overview-today.js", import.meta.url), "utf-8");

function baseMarkup({ overdue = 0, dueSoon = 0, newLeads = 0 } = {}) {
  return `
    <section class="cp-ov-today" id="ov-today-banner" style="display:none;">
      <div class="cp-ov-today-list" id="cp-ov-today-list"></div>
    </section>

    <button class="cp-tab" data-tab="leads" id="ad-tabbtn-leads">ลีด</button>
    <span class="cp-stat-num" id="ov-stat-leads-new">${newLeads}</span>

    <div class="cp-stat-card warn" id="cp-stat-card-duesoon">
      <span class="cp-stat-num" id="cp-stat-duesoon">${dueSoon}</span>
    </div>
    <div class="cp-stat-card danger" id="cp-stat-card-overdue">
      <span class="cp-stat-num" id="cp-stat-overdue">${overdue}</span>
    </div>

    <section class="cp-status-pills" id="ad-l-filter-status-pills">
      <button type="button" data-status="new">ใหม่</button>
    </section>
  `;
}

function loadDom(markup) {
  const dom = new JSDOM(`<!doctype html><html><body>${markup}</body></html>`, {
    url: "https://example.test/admin.html",
    runScripts: "dangerously",
  });
  // jsdom ไม่มี requestAnimationFrame ให้ในตัว (เหมือนที่พบใน
  // test/contact-inline-form-flow.test.mjs) — shim ด้วย setTimeout ก่อนโหลดสคริปต์
  dom.window.requestAnimationFrame = (cb) => setTimeout(cb, 0);
  const script = dom.window.document.createElement("script");
  script.textContent = SOURCE;
  dom.window.document.body.appendChild(script);
  return dom;
}

function nextTick() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe("admin-overview-today.js (รอบที่ 102)", () => {
  test("shape: โหลดสคริปต์ได้โดยไม่ throw และไม่มีงานด่วนตอนเริ่ม (ทุกตัวเลขเป็น 0)", () => {
    assert.doesNotThrow(() => loadDom(baseMarkup()));
  });

  test("ไม่มีงานเกินกำหนด/ใกล้กำหนด/ลีดใหม่เลย: แสดง banner + ข้อความ 'วันนี้ไม่มีงานด่วน'", () => {
    const dom = loadDom(baseMarkup());
    const { document } = dom.window;
    assert.equal(document.getElementById("ov-today-banner").style.display, "");
    const list = document.getElementById("cp-ov-today-list");
    assert.match(list.textContent, /วันนี้ไม่มีงานด่วน/);
    assert.equal(list.querySelectorAll("[data-today-idx]").length, 0);
  });

  test("มีงานเกินกำหนด 3 รายการ: แสดงรายการแบบ danger พร้อมจำนวนถูกต้อง", () => {
    const dom = loadDom(baseMarkup({ overdue: 3 }));
    const { document } = dom.window;
    const item = document.querySelector(".cp-ov-today-item.danger");
    assert.ok(item, "ต้องมีรายการ danger");
    assert.match(item.textContent, /3/);
  });

  test("มีทั้ง 3 สถานการณ์พร้อมกัน: แสดงครบ 3 รายการตามลำดับ overdue → dueSoon → newLeads", () => {
    const dom = loadDom(baseMarkup({ overdue: 1, dueSoon: 2, newLeads: 5 }));
    const { document } = dom.window;
    const items = document.querySelectorAll(".cp-ov-today-item");
    assert.equal(items.length, 3);
    assert.ok(items[0].classList.contains("danger"));
    assert.ok(items[1].classList.contains("warn"));
    assert.ok(items[2].classList.contains("info"));
  });

  test("คลิกรายการ overdue: จำลองคลิกไปที่ cp-stat-card-overdue จริง (goOverdue)", () => {
    const dom = loadDom(baseMarkup({ overdue: 2 }));
    const { document } = dom.window;
    const card = document.getElementById("cp-stat-card-overdue");
    let clicked = false;
    card.addEventListener("click", () => { clicked = true; });
    document.querySelector('[data-today-idx="0"]').dispatchEvent(
      new dom.window.Event("click", { bubbles: true })
    );
    assert.equal(clicked, true);
  });

  test("คลิกรายการ newLeads: คลิกแท็บลีดทันที (synchronous)", () => {
    const dom = loadDom(baseMarkup({ newLeads: 4 }));
    const { document } = dom.window;
    const tabBtn = document.getElementById("ad-tabbtn-leads");
    let tabClicked = false;
    tabBtn.addEventListener("click", () => { tabClicked = true; });
    document.querySelector('[data-today-idx="0"]').dispatchEvent(
      new dom.window.Event("click", { bubbles: true })
    );
    assert.equal(tabClicked, true);
  });

  test("MutationObserver: แก้ textContent ของ #cp-stat-overdue หลังโหลดแล้ว re-render อัตโนมัติผ่าน rAF (พร้อมยืนยัน readCount() ตัด non-digit ออก เช่น '7 รายการ' → 7)", async () => {
    const dom = loadDom(baseMarkup());
    const { document } = dom.window;
    const overdueEl = document.getElementById("cp-stat-overdue");
    overdueEl.textContent = "7 รายการ";
    await nextTick();
    await nextTick();
    const item = document.querySelector(".cp-ov-today-item.danger");
    assert.ok(item, "หลัง mutation ตัวเลข overdue ควร re-render เป็นรายการ danger");
    assert.match(item.textContent, /7/);
  });

  test("ถ้าไม่มี #ov-today-banner หรือ #cp-ov-today-list เลย: render() ออกเงียบๆ ไม่ throw", () => {
    assert.doesNotThrow(() => loadDom("<div>ไม่มี banner/list</div>"));
  });

  test("ถ้าไม่มี element ตัวเลขที่ต้อง watch เลย (SOURCE_IDS ไม่มีใน DOM): ไม่ throw ตอนโหลด", () => {
    assert.doesNotThrow(() =>
      loadDom(`
        <section class="cp-ov-today" id="ov-today-banner" style="display:none;">
          <div class="cp-ov-today-list" id="cp-ov-today-list"></div>
        </section>`)
    );
  });
});
