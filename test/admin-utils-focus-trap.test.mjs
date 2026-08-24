// test/admin-utils-focus-trap.test.mjs
//
// jsdom test อย่างเป็นทางการสำหรับกลไก focus-trap/Escape/return-focus + confirmDialog guard
// ที่เพิ่มเข้า js/admin-utils.js (openOverlay()/closeOverlay()) ในรอบที่ 58 — ทำให้เป็นทางการ
// ตามที่บันทึกไว้ใน REFACTOR-PROGRESS.md ว่ายังไม่ได้เข้า test/ suite จริง (สมอกเทสต์รอบ 58
// เขียนยืนยันผ่านแล้วแต่ลบทิ้ง เพราะตอนนั้นยังไม่ได้ทำให้เข้ากับ stub loader ของ suite จริง)
//
// วิธีทดสอบ: ตั้ง globalThis.document/window/navigator ผ่าน jsdom ก่อน import "../js/admin-utils.js"
// แบบ dynamic import() เสมอ (ไฟล์นี้เป็น top-level module ที่ import db.js/db-media.js/
// ui-helpers.js/admin-state.js ซึ่งพึ่ง Firebase SDK จริง — ต้องพึ่ง test/helpers/
// firebase-stub-loader.mjs ที่ลงทะเบียนไว้แล้วผ่าน --import ./test/helpers/register-loader.mjs
// ใน npm script "test") — ยิง keydown/click จริงผ่าน dispatchEvent ไม่ mock ฟังก์ชันเอง
//
// หมายเหตุ jsdom ที่สะสมมา (ยืนยันซ้ำในไฟล์นี้):
// - ต้องตั้ง globalThis.document ผ่าน jsdom ไว้ก่อน import เสมอ ไม่งั้น import จะ throw ตั้งแต่
//   ยังไม่ทันเรียกฟังก์ชัน (พบตั้งแต่รอบ 35)
// - globalThis.navigator เป็น getter-only ใน Node เวอร์ชันนี้ ต้องใช้ Object.defineProperty แทนการ
//   assign ตรงๆ (พบตั้งแต่รอบ 44, ยืนยันซ้ำรอบ 58/59)

import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

function makeDom() {
  const dom = new JSDOM(
    `<!doctype html><html><body>
      <button id="opener">opener</button>

      <div class="cp-overlay" id="ov1" style="display:none;">
        <div class="cp-modal">
          <button id="ov1-first">first</button>
          <input id="ov1-mid" />
          <button id="ov1-last">last</button>
        </div>
      </div>

      <div class="cp-confirm-overlay" style="display:none;">
        <button id="confirm-cancel">cancel</button>
        <button id="confirm-ok">ok</button>
      </div>
    </body></html>`,
    { url: "https://example.test/" }
  );
  return dom;
}

// admin-utils.js ผูก backdrop-click listener ให้ overlay เองไม่ได้ (นั่นเป็นหน้าที่ของแต่ละ
// caller เหมือนกับของจริงในโปรเจกต์ — ดู track-modal.js/products.html ที่ผูก
// `overlay.addEventListener("click", e => { if (e.target === overlay) closeXxx(); })` เอง) —
// จำลองพฤติกรรมเดียวกันในเทสต์นี้เพื่อยืนยันว่า Escape (synthetic click) ไปโดน listener นี้จริง
function wireBackdropClose(overlay, closeOverlay) {
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeOverlay(overlay);
  });
}

async function loadAdminUtils(dom) {
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
  globalThis.MouseEvent = dom.window.MouseEvent;
  globalThis.KeyboardEvent = dom.window.KeyboardEvent;
  globalThis.HTMLElement = dom.window.HTMLElement;
  // admin-utils.js อ่าน window.innerWidth/document.documentElement.clientWidth ตอน openOverlay()
  // แรกสุด (คำนวณ scrollbar width) — jsdom ให้ค่า 0 ทั้งคู่โดย default ซึ่งใช้งานได้ปกติ ไม่ throw
  return import(`../js/admin-utils.js?t=${Date.now()}-${Math.random()}`);
}

describe("js/admin-utils.js — openOverlay/closeOverlay focus-trap/Escape/return-focus (รอบที่ 58, formalized รอบที่ 59)", () => {
  test("เปิด modal ผ่าน openOverlay() เก็บ lastFocused และแสดง overlay (display:flex)", async () => {
    const dom = makeDom();
    const { openOverlay } = await loadAdminUtils(dom);
    const { document } = dom.window;
    const opener = document.getElementById("opener");
    const overlay = document.getElementById("ov1");

    opener.focus();
    openOverlay(overlay);

    assert.equal(overlay.style.display, "flex");
  });

  test("Tab จาก focusable ตัวสุดท้ายวนกลับไปตัวแรกของ overlay ที่เปิดอยู่", async () => {
    const dom = makeDom();
    const { openOverlay } = await loadAdminUtils(dom);
    const { document } = dom.window;
    const overlay = document.getElementById("ov1");
    const first = document.getElementById("ov1-first");
    const last = document.getElementById("ov1-last");

    openOverlay(overlay);
    last.focus();
    document.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true }));

    assert.equal(document.activeElement, first);
  });

  test("Shift+Tab จาก focusable ตัวแรกวนไปตัวสุดท้าย", async () => {
    const dom = makeDom();
    const { openOverlay } = await loadAdminUtils(dom);
    const { document } = dom.window;
    const overlay = document.getElementById("ov1");
    const first = document.getElementById("ov1-first");
    const last = document.getElementById("ov1-last");

    openOverlay(overlay);
    first.focus();
    document.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true, cancelable: true }));

    assert.equal(document.activeElement, last);
  });

  test("Escape ยิง synthetic click ใส่ overlay บนสุด ให้ชนกับ backdrop-click listener เดิม (ปิด modal ผ่าน path เดียวกับคลิกฉากหลัง)", async () => {
    const dom = makeDom();
    const { openOverlay, closeOverlay } = await loadAdminUtils(dom);
    const { document } = dom.window;
    const overlay = document.getElementById("ov1");
    wireBackdropClose(overlay, closeOverlay);

    openOverlay(overlay);
    assert.equal(overlay.style.display, "flex");

    document.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));

    assert.equal(overlay.style.display, "none", "Escape ต้องปิด overlay ผ่าน backdrop-click listener เดิม");
  });

  test("closeOverlay() คืน focus กลับไปที่ element ที่โฟกัสอยู่ก่อนเปิด modal", async () => {
    const dom = makeDom();
    const { openOverlay, closeOverlay } = await loadAdminUtils(dom);
    const { document } = dom.window;
    const opener = document.getElementById("opener");
    const overlay = document.getElementById("ov1");

    opener.focus();
    openOverlay(overlay);
    closeOverlay(overlay);

    assert.equal(document.activeElement, opener);
  });

  test("confirmDialog guard: ตอน .cp-confirm-overlay เปิดอยู่ (display:flex) Tab-trap ต้องไม่แย่งโฟกัสจากปุ่มใน confirm dialog", async () => {
    const dom = makeDom();
    const { openOverlay } = await loadAdminUtils(dom);
    const { document } = dom.window;
    const overlay = document.getElementById("ov1");
    const confirmOverlay = document.querySelector(".cp-confirm-overlay");
    const confirmOk = document.getElementById("confirm-ok");

    openOverlay(overlay);
    confirmOverlay.style.display = "flex";
    confirmOk.focus();

    document.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true }));

    assert.equal(document.activeElement, confirmOk, "Tab-trap ของ overlay ข้างล่างต้อง 'หยุดทำงาน' ตอน confirmDialog เปิดอยู่");
  });

  test("confirmDialog guard: ตอน .cp-confirm-overlay เปิดอยู่ Escape ต้องไม่ยิง synthetic click ไปโดน backdrop ของ modal ข้างล่าง (ไม่ double-fire)", async () => {
    const dom = makeDom();
    const { openOverlay, closeOverlay } = await loadAdminUtils(dom);
    const { document } = dom.window;
    const overlay = document.getElementById("ov1");
    const confirmOverlay = document.querySelector(".cp-confirm-overlay");
    wireBackdropClose(overlay, closeOverlay);

    openOverlay(overlay);
    confirmOverlay.style.display = "flex";

    document.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));

    assert.equal(overlay.style.display, "flex", "modal ข้างล่างต้องยังเปิดอยู่ — ปล่อยให้ confirmDialog จัดการ Escape ของตัวเองแทน");
  });

  test("confirmDialog guard: พอปิด confirm dialog แล้ว Escape กลับมาทำงานปกติทันที", async () => {
    const dom = makeDom();
    const { openOverlay, closeOverlay } = await loadAdminUtils(dom);
    const { document } = dom.window;
    const overlay = document.getElementById("ov1");
    const confirmOverlay = document.querySelector(".cp-confirm-overlay");
    wireBackdropClose(overlay, closeOverlay);

    openOverlay(overlay);
    confirmOverlay.style.display = "flex";
    confirmOverlay.style.display = "none"; // ปิด confirm dialog แล้ว

    document.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));

    assert.equal(overlay.style.display, "none", "Escape ต้องปิด modal ข้างล่างได้ปกติทันทีที่ confirmDialog ปิดไปแล้ว");
  });

  test("Escape เมื่อไม่มี overlay เปิดอยู่เลย ไม่ throw (guard top-of-stack ทำงานถูก)", async () => {
    const dom = makeDom();
    await loadAdminUtils(dom);
    const { document } = dom.window;

    assert.doesNotThrow(() => {
      document.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    });
  });
});
