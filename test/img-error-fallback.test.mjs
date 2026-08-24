// test/img-error-fallback.test.mjs
//
// jsdom test สำหรับ js/img-error-fallback.js — ไฟล์ใหม่จากรอบที่ 82 ที่ย้ายมาจาก inline
// `onerror="this.remove()"` เดิมบน <img class="real-photo"> ใน about.html/en/about.html/
// index.html/en/index.html (10 จุดรวมกัน) แบบไม่มีการเปลี่ยน logic เลย (this.remove() ตัวเดียวกัน
// แค่ย้ายมาผูกผ่าน event delegation แบบ capture ที่ document แทน) — เตรียมเอา 'unsafe-inline'
// ออกจาก Content-Security-Policy script-src ในอนาคต (ดู REFACTOR-PROGRESS.md หัวข้อ "รอบที่ 82")
//
// วิธีทดสอบ: เหมือน test/about-portfolio-extracted-inline-scripts.test.mjs — inject เป็น
// classic <script> จริงเข้า JSDOM (runScripts: "dangerously") แล้วยิง 'error' event จริงบน
// <img> ตรวจว่า element ถูกลบหรือไม่ — ไฟล์นี้เป็น UI-layer ล้วนๆ ไม่ import จาก db.js จึงไม่
// ต้อง stub Firebase
//
// หมายเหตุ jsdom: 'error' event ของ <img> ไม่ bubble ตามสเปกจริง แต่ capture-phase listener
// ที่ document ยังคงถูกเรียกอยู่เสมอ เพราะ capture phase เดินทางผ่าน ancestor chain ของ target
// ไม่ขึ้นกับ flag bubbles เลย (bubbles มีผลแค่ตอนเดินทางกลับขึ้นหลังถึง target) — ยืนยันแล้วว่า
// jsdom ทำตามสเปกนี้ถูกต้อง (ดู test ด้านล่าง)

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const source = readFileSync(new URL("../js/img-error-fallback.js", import.meta.url), "utf-8");

function runScript(dom) {
  const scriptEl = dom.window.document.createElement("script");
  scriptEl.textContent = source;
  dom.window.document.body.appendChild(scriptEl);
}

function makeDom(bodyHtml) {
  return new JSDOM(`<!doctype html><html><body>${bodyHtml}</body></html>`, {
    url: "https://example.test/",
    runScripts: "dangerously",
    pretendToBeVisual: true,
  });
}

function fireError(dom, el, bubbles) {
  el.dispatchEvent(new dom.window.Event("error", { bubbles: !!bubbles, cancelable: false }));
}

describe("js/img-error-fallback.js — ลบ <img class=\"real-photo\"> ที่โหลดไม่สำเร็จ (รอบที่ 82, ย้ายจาก inline onerror)", () => {
  test("img.real-photo ยิง error (ไม่ bubble ตามสเปกจริง) — ถูกลบออกจาก DOM", () => {
    const dom = makeDom(`
      <div class="img-ph">
        <picture><img class="real-photo" src="broken.jpg"></picture>
      </div>
    `);
    runScript(dom);
    const img = dom.window.document.querySelector("img.real-photo");
    assert.ok(img, "ต้องมี img อยู่ก่อนยิง error");
    assert.doesNotThrow(() => fireError(dom, img, false));
    assert.equal(dom.window.document.querySelector("img.real-photo"), null, "img ต้องถูกลบออกหลัง error");
  });

  test("มีหลายรูปในหน้าเดียวกัน — error ของรูปหนึ่งไม่กระทบรูปอื่นที่โหลดสำเร็จ", () => {
    const dom = makeDom(`
      <img id="a" class="real-photo" src="broken-a.jpg">
      <img id="b" class="real-photo" src="ok-b.jpg">
    `);
    runScript(dom);
    const { document } = dom.window;
    fireError(dom, document.getElementById("a"), false);
    assert.equal(document.getElementById("a"), null);
    assert.ok(document.getElementById("b"), "รูปที่ไม่ error ต้องยังอยู่");
  });

  test("error ของ <img> ที่ไม่มี class real-photo — ไม่ถูกลบ (เช่นโลโก้/ไอคอนอื่นในหน้า)", () => {
    const dom = makeDom(`<img id="logo" src="logo.png">`);
    runScript(dom);
    const { document } = dom.window;
    fireError(dom, document.getElementById("logo"), false);
    assert.ok(document.getElementById("logo"), "img ที่ไม่ใช่ real-photo ต้องไม่ถูกแตะต้อง");
  });

  test("error event จาก element อื่นที่ไม่ใช่ IMG เลย (เช่น <link>) — ไม่ throw และไม่กระทบ DOM", () => {
    const dom = makeDom(`<div id="other"></div>`);
    runScript(dom);
    const { document } = dom.window;
    const other = document.getElementById("other");
    assert.doesNotThrow(() => fireError(dom, other, false));
    assert.ok(document.getElementById("other"));
  });

  test("ไม่มี .real-photo เลยในหน้า — โหลดสคริปต์ได้ปกติไม่ throw (guard พื้นฐาน)", () => {
    const dom = makeDom(`<p>no images here</p>`);
    assert.doesNotThrow(() => runScript(dom));
  });
});
