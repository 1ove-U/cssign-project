// test/cookie-consent.test.mjs
//
// jsdom test สำหรับ js/cookie-consent.js — banner ขอความยินยอมคุกกี้ (PDPA) ที่แสดงตอน
// เข้าเว็บครั้งแรก, เก็บค่าไว้ที่ localStorage key "CSSIGN_CONSENT", เซ็ต
// window.CSSIGN_CONSENT ให้ใช้ได้ทันที และยิง custom event "cssign:consent" ให้สคริปต์อื่น
// (เช่น js/analytics.js ที่เทสไว้แล้วรอบ 151) ฟังต่อได้ — ไฟล์นี้ไม่ import/export อะไรเลย
// (IIFE ธรรมดา โหลดผ่าน <script src="js/cookie-consent.js"> ตรงๆ ไม่ใช่ ES module) จึงทดสอบ
// ด้วยแพทเทิร์นเดียวกับ test/analytics.test.mjs — inject เป็น classic <script> จริงเข้า
// JSDOM (runScripts: "dangerously")
//
// สองจุดที่ต้องระวังเป็นพิเศษ (ต่างจาก analytics.js ที่เพิ่งเทสไปรอบก่อน):
// 1) ไฟล์นี้ผูก `document.addEventListener('DOMContentLoaded', ...)` แบบไม่มีเงื่อนไข
//    (เหมือน js/tabs-overflow.js ที่บันทึกแพทเทิร์นไว้รอบ 102) ต้อง **inject script ตอน
//    document.readyState ยังเป็น "loading" อยู่** (ทันทีหลังสร้าง JSDOM instance ก่อน await
//    ใดๆ) แล้วค่อย await จน readyState กลายเป็น "complete" เพื่อให้ event ยิงจริงหลังผูก
//    listener แล้ว — ถ้ารอ readyState ก่อนค่อย appendChild listener จะไม่ถูกเรียกเลย
// 2) แสดง banner ด้วย double-nested requestAnimationFrame (jsdom ไม่มี rAF ในตัว —
//    ต้อง polyfill ด้วย setTimeout(cb,0) แบบเดียวกับที่ทำใน blog-render.test.mjs/
//    admin-overview-*.test.mjs หลายไฟล์) ต้อง polyfill ก่อน inject script เพราะสคริปต์อ้างอิง
//    `requestAnimationFrame` เป็นตัวแปร global ของ window ตรงๆ

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const SOURCE = readFileSync(new URL("../js/cookie-consent.js", import.meta.url), "utf-8");

// สร้าง dom ตอน readyState ยังเป็น "loading" แล้ว polyfill requestAnimationFrame ให้พร้อม
// ก่อนที่ผู้เรียกจะ appendChild script (ตามแพทเทิร์น tabs-overflow.test.mjs)
function makeDom() {
  const dom = new JSDOM(`<!doctype html><html><head></head><body></body></html>`, {
    url: "https://example.test/",
    runScripts: "dangerously",
    pretendToBeVisual: true,
  });
  dom.window.requestAnimationFrame = (cb) => setTimeout(cb, 0);
  return dom;
}

function loadScript(dom) {
  const scriptEl = dom.window.document.createElement("script");
  scriptEl.textContent = SOURCE;
  dom.window.document.body.appendChild(scriptEl);
}

async function waitReady(dom) {
  while (dom.window.document.readyState !== "complete") {
    await new Promise((r) => setTimeout(r, 5));
  }
}

// ระบายทั้ง 2 ชั้นของ requestAnimationFrame ที่ต่อกันเป็นทอด (polyfill = setTimeout(cb,0))
// รวมถึง setTimeout(...,350) ของ dismiss() ถ้าต้องการรอจน banner ถูกลบออกจริง
async function tick(ms = 20) {
  await new Promise((r) => setTimeout(r, ms));
}

function banner(dom) {
  return dom.window.document.querySelector(".cookie-banner");
}

// object ที่ script สร้างขึ้นถูกสร้างใน realm ของ jsdom (ผ่าน vm context) คนละ
// Object.prototype กับ object literal ฝั่งเทส — assert.deepEqual/deepStrictEqual ของ
// node:assert เช็ค prototype ด้วย ทำให้ fail แม้โครงสร้าง/ค่าตรงกันทุกประการ (เห็นชัดจาก error
// message เอง: "same structure but are not reference-equal") จึงเทียบด้วย JSON.stringify แทน
// ตามแพทเทิร์นเดียวกับ test/analytics.test.mjs
function assertSameConsent(actual, expected) {
  assert.equal(JSON.stringify(actual), JSON.stringify(expected));
}

describe("js/cookie-consent.js — cookie consent banner (PDPA)", () => {
  describe("window.CSSIGN_CONSENT — ตั้งค่าทันทีตอนสคริปต์โหลด (ก่อน DOMContentLoaded)", () => {
    test("ไม่มีอะไรใน localStorage เลย — ค่าเริ่มต้น necessary:true, analytics:false, marketing:false", () => {
      const dom = makeDom();
      loadScript(dom);
      assertSameConsent(dom.window.CSSIGN_CONSENT, {
        necessary: true,
        analytics: false,
        marketing: false,
      });
    });

    test("localStorage มี consent ที่ตั้งค่าไว้แล้วถูกต้อง (v ตรงกัน) — ใช้ค่านั้นทันที", () => {
      const dom = makeDom();
      const stored = {
        v: 1,
        necessary: true,
        analytics: true,
        marketing: false,
        ts: "2024-01-01T00:00:00.000Z",
      };
      dom.window.localStorage.setItem("CSSIGN_CONSENT", JSON.stringify(stored));
      loadScript(dom);
      assertSameConsent(dom.window.CSSIGN_CONSENT, stored);
    });

    test("localStorage มี consent แต่ v ไม่ตรงกับเวอร์ชันปัจจุบัน (นโยบายเปลี่ยน) — ถือว่ายังไม่เคยตัดสินใจ ใช้ค่าเริ่มต้น", () => {
      const dom = makeDom();
      dom.window.localStorage.setItem(
        "CSSIGN_CONSENT",
        JSON.stringify({ v: 2, necessary: true, analytics: true, marketing: true, ts: "x" })
      );
      loadScript(dom);
      assertSameConsent(dom.window.CSSIGN_CONSENT, {
        necessary: true,
        analytics: false,
        marketing: false,
      });
    });

    test("localStorage มีค่าที่ parse JSON ไม่ได้ (ข้อมูลเสีย) — ไม่ throw ใช้ค่าเริ่มต้น", () => {
      const dom = makeDom();
      dom.window.localStorage.setItem("CSSIGN_CONSENT", "{not valid json");
      assert.doesNotThrow(() => loadScript(dom));
      assertSameConsent(dom.window.CSSIGN_CONSENT, {
        necessary: true,
        analytics: false,
        marketing: false,
      });
    });

    test("localStorage.getItem() throw เอง (เช่น private mode บางเบราว์เซอร์) — ไม่ throw ใช้ค่าเริ่มต้น", () => {
      const dom = makeDom();
      Object.defineProperty(dom.window, "localStorage", {
        value: {
          getItem() {
            throw new Error("SecurityError: storage disabled");
          },
          setItem() {},
        },
        configurable: true,
      });
      assert.doesNotThrow(() => loadScript(dom));
      assertSameConsent(dom.window.CSSIGN_CONSENT, {
        necessary: true,
        analytics: false,
        marketing: false,
      });
    });
  });

  describe("แสดง/ไม่แสดง banner ตอน DOMContentLoaded", () => {
    test("ยังไม่เคยตัดสินใจ (ไม่มี consent ใน localStorage) — banner ถูกสร้างขึ้นครบองค์ประกอบ", async () => {
      const dom = makeDom();
      loadScript(dom);
      await waitReady(dom);

      const b = banner(dom);
      assert.ok(b, "ต้องมี .cookie-banner หลัง DOMContentLoaded");
      assert.equal(b.getAttribute("role"), "dialog");
      assert.equal(b.getAttribute("aria-live"), "polite");
      assert.equal(b.getAttribute("aria-label"), "การตั้งค่าคุกกี้");
      assert.ok(b.querySelector("#cookie-btn-accept"));
      assert.ok(b.querySelector("#cookie-btn-reject"));
      assert.ok(b.querySelector("#cookie-btn-settings"));
      assert.ok(b.querySelector("#cookie-btn-save"));
      assert.equal(b.querySelector("#cookie-btn-save").style.display, "none", "ปุ่มบันทึกต้องซ่อนไว้ก่อนเปิดตั้งค่า");
      assert.ok(b.querySelector("#cookie-toggle-analytics"));
      assert.ok(b.querySelector("#cookie-toggle-marketing"));
      assert.equal(b.querySelector("#cookie-toggle-analytics").checked, false);
      assert.equal(b.querySelector("#cookie-toggle-marketing").checked, false);
      assert.ok(
        dom.window.document.documentElement.classList.contains("has-cookie-banner"),
        "html ต้องมี class has-cookie-banner ตอน banner แสดงอยู่"
      );
    });

    test("หลัง 2 ชั้น requestAnimationFrame — banner ได้ class 'show' (ทริกเกอร์ animation เข้า)", async () => {
      const dom = makeDom();
      loadScript(dom);
      await waitReady(dom);
      const b = banner(dom);
      assert.ok(!b.classList.contains("show"), "ตอนเพิ่งสร้างต้องยังไม่มี class show");
      await tick();
      assert.ok(b.classList.contains("show"), "หลังระบาย rAF 2 ชั้นแล้วต้องมี class show");
    });

    test("เคยตัดสินใจไปแล้ว (มี consent ที่ v ตรงกันใน localStorage) — ไม่แสดง banner เลย ไม่รบกวนซ้ำ", async () => {
      const dom = makeDom();
      dom.window.localStorage.setItem(
        "CSSIGN_CONSENT",
        JSON.stringify({ v: 1, necessary: true, analytics: false, marketing: false, ts: "x" })
      );
      loadScript(dom);
      await waitReady(dom);
      await tick();
      assert.equal(banner(dom), null);
      assert.ok(!dom.window.document.documentElement.classList.contains("has-cookie-banner"));
    });
  });

  describe("ปุ่ม 'ยอมรับทั้งหมด' / 'ปฏิเสธทั้งหมด'", () => {
    test("กด 'ยอมรับทั้งหมด' — เขียน consent {analytics:true, marketing:true} ลง localStorage + window.CSSIGN_CONSENT + ยิง event", async () => {
      const dom = makeDom();
      loadScript(dom);
      await waitReady(dom);

      let eventDetail = null;
      dom.window.document.addEventListener("cssign:consent", (e) => {
        eventDetail = e.detail;
      });

      banner(dom).querySelector("#cookie-btn-accept").dispatchEvent(new dom.window.Event("click", { bubbles: true }));

      assert.equal(dom.window.CSSIGN_CONSENT.necessary, true);
      assert.equal(dom.window.CSSIGN_CONSENT.analytics, true);
      assert.equal(dom.window.CSSIGN_CONSENT.marketing, true);
      assert.equal(typeof dom.window.CSSIGN_CONSENT.ts, "string");
      assert.ok(!Number.isNaN(Date.parse(dom.window.CSSIGN_CONSENT.ts)), "ts ต้องเป็น ISO date string ที่ parse ได้");

      const stored = JSON.parse(dom.window.localStorage.getItem("CSSIGN_CONSENT"));
      assert.equal(stored.v, 1);
      assert.equal(stored.necessary, dom.window.CSSIGN_CONSENT.necessary);
      assert.equal(stored.analytics, dom.window.CSSIGN_CONSENT.analytics);
      assert.equal(stored.marketing, dom.window.CSSIGN_CONSENT.marketing);
      assert.equal(stored.ts, dom.window.CSSIGN_CONSENT.ts);

      assert.ok(eventDetail, "ต้องยิง cssign:consent event");
      assert.equal(eventDetail.analytics, true);
      assert.equal(eventDetail.marketing, true);
    });

    test("กด 'ปฏิเสธทั้งหมด' — เขียน consent {analytics:false, marketing:false}", async () => {
      const dom = makeDom();
      loadScript(dom);
      await waitReady(dom);

      banner(dom).querySelector("#cookie-btn-reject").dispatchEvent(new dom.window.Event("click", { bubbles: true }));

      assert.equal(dom.window.CSSIGN_CONSENT.necessary, true);
      assert.equal(dom.window.CSSIGN_CONSENT.analytics, false);
      assert.equal(dom.window.CSSIGN_CONSENT.marketing, false);
    });

    test("กดปุ่มใดก็ตาม (accept/reject) — banner เริ่ม dismiss ทันที (เอา class show ออก + html เอา has-cookie-banner ออก) แล้วลบตัวเองออกจาก DOM จริงหลัง ~350ms", async () => {
      const dom = makeDom();
      loadScript(dom);
      await waitReady(dom);
      await tick(); // ให้ banner ได้ class 'show' ก่อน เพื่อยืนยันว่ามันถูกเอาออกจริง

      const b = banner(dom);
      assert.ok(b.classList.contains("show"));

      b.querySelector("#cookie-btn-accept").dispatchEvent(new dom.window.Event("click", { bubbles: true }));

      assert.ok(!b.classList.contains("show"), "ต้องเอา class show ออกทันทีตอนกด");
      assert.ok(
        !dom.window.document.documentElement.classList.contains("has-cookie-banner"),
        "html ต้องเอา has-cookie-banner ออกทันทีตอนกด (ไม่ต้องรอ 350ms)"
      );
      assert.ok(dom.window.document.body.contains(b), "banner ต้องยังอยู่ใน DOM ทันทีหลังกด (ยังไม่ถูกลบ)");

      await tick(400);
      assert.ok(!dom.window.document.body.contains(b), "หลัง 350ms banner ต้องถูกลบออกจาก DOM จริง");
    });
  });

  describe("แผงตั้งค่าแบบละเอียด (ตั้งค่า → เลือกหมวด → บันทึก)", () => {
    test("กด 'ตั้งค่า' — เปิดแผง (class open), โชว์ปุ่มบันทึก, ซ่อนปุ่มตั้งค่า — กดซ้ำอีกครั้งเพื่อปิด", async () => {
      const dom = makeDom();
      loadScript(dom);
      await waitReady(dom);
      const b = banner(dom);
      const panel = b.querySelector("#cookie-settings-panel");
      const settingsBtn = b.querySelector("#cookie-btn-settings");
      const saveBtn = b.querySelector("#cookie-btn-save");

      settingsBtn.dispatchEvent(new dom.window.Event("click", { bubbles: true }));
      assert.ok(panel.classList.contains("open"));
      assert.equal(saveBtn.style.display, "");
      assert.equal(settingsBtn.style.display, "none");

      // ปุ่มยังอยู่ใน DOM แม้ถูกซ่อนด้วย style.display — dispatchEvent โดยตรงยังทำงานได้ปกติ
      settingsBtn.dispatchEvent(new dom.window.Event("click", { bubbles: true }));
      assert.ok(!panel.classList.contains("open"), "กดซ้ำต้องปิดแผงกลับ (toggle)");
      assert.equal(saveBtn.style.display, "none");
      assert.equal(settingsBtn.style.display, "");
    });

    test("เลือกวิเคราะห์การใช้งานอย่างเดียว (ไม่เลือกการตลาด) แล้วกดบันทึก — เขียน consent ตามที่เลือกจริง", async () => {
      const dom = makeDom();
      loadScript(dom);
      await waitReady(dom);
      const b = banner(dom);

      b.querySelector("#cookie-btn-settings").dispatchEvent(new dom.window.Event("click", { bubbles: true }));
      b.querySelector("#cookie-toggle-analytics").checked = true;
      b.querySelector("#cookie-toggle-marketing").checked = false;
      b.querySelector("#cookie-btn-save").dispatchEvent(new dom.window.Event("click", { bubbles: true }));

      assert.equal(dom.window.CSSIGN_CONSENT.analytics, true);
      assert.equal(dom.window.CSSIGN_CONSENT.marketing, false);
      assert.equal(dom.window.CSSIGN_CONSENT.necessary, true);
    });

    test("เลือกทั้งสองหมวดแล้วกดบันทึก — เขียน consent {analytics:true, marketing:true}", async () => {
      const dom = makeDom();
      loadScript(dom);
      await waitReady(dom);
      const b = banner(dom);

      b.querySelector("#cookie-btn-settings").dispatchEvent(new dom.window.Event("click", { bubbles: true }));
      b.querySelector("#cookie-toggle-analytics").checked = true;
      b.querySelector("#cookie-toggle-marketing").checked = true;
      b.querySelector("#cookie-btn-save").dispatchEvent(new dom.window.Event("click", { bubbles: true }));

      assert.equal(dom.window.CSSIGN_CONSENT.analytics, true);
      assert.equal(dom.window.CSSIGN_CONSENT.marketing, true);
    });

    test("ไม่เลือกหมวดไหนเลยแล้วกดบันทึก (checkbox ทั้งคู่ว่างตามค่าเริ่มต้น) — เหมือนปฏิเสธทั้งหมด", async () => {
      const dom = makeDom();
      loadScript(dom);
      await waitReady(dom);
      const b = banner(dom);

      b.querySelector("#cookie-btn-settings").dispatchEvent(new dom.window.Event("click", { bubbles: true }));
      b.querySelector("#cookie-btn-save").dispatchEvent(new dom.window.Event("click", { bubbles: true }));

      assert.equal(dom.window.CSSIGN_CONSENT.analytics, false);
      assert.equal(dom.window.CSSIGN_CONSENT.marketing, false);
    });
  });

  describe("ความทนทานของ writeConsent() ต่อ localStorage ที่ใช้งานไม่ได้", () => {
    test("localStorage.setItem() throw (เช่น quota เต็ม/private mode) — ไม่ throw ทั้งกระบวนการ, window.CSSIGN_CONSENT ยังอัปเดต, event ยังยิง, banner ยัง dismiss ปกติ", async () => {
      const dom = makeDom();
      loadScript(dom);
      await waitReady(dom);

      Object.defineProperty(dom.window, "localStorage", {
        value: {
          getItem: () => null,
          setItem() {
            throw new Error("QuotaExceededError");
          },
        },
        configurable: true,
      });

      let eventFired = false;
      dom.window.document.addEventListener("cssign:consent", () => {
        eventFired = true;
      });

      const b = banner(dom);
      assert.doesNotThrow(() => {
        b.querySelector("#cookie-btn-accept").dispatchEvent(new dom.window.Event("click", { bubbles: true }));
      });

      assert.equal(dom.window.CSSIGN_CONSENT.analytics, true);
      assert.equal(dom.window.CSSIGN_CONSENT.marketing, true);
      assert.ok(eventFired, "event ต้องยิงแม้ localStorage เขียนไม่ได้");
      assert.ok(!b.classList.contains("show"), "banner ยัง dismiss ปกติแม้ localStorage เขียนไม่ได้");
    });
  });
});
