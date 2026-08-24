// test/pwa-register.test.mjs
//
// jsdom test สำหรับ js/pwa-register.js (P1.7b) — สคริปต์ classic ล้วนๆ ที่ลงทะเบียน
// sw.js หลัง 'load' โดยมี feature detection + try/catch คลุมทุกจุด (ต้องไม่ทำให้
// หน้าเว็บพังไม่ว่ากรณีไหน) วิธีทดสอบเหมือน test/img-error-fallback.test.mjs — inject
// เป็น classic <script> จริงเข้า JSDOM (runScripts: "dangerously") แล้ว mock
// navigator.serviceWorker/window.load ตรวจพฤติกรรม ไม่ import จาก db.js จึงไม่ต้อง
// stub Firebase

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const source = readFileSync(new URL("../js/pwa-register.js", import.meta.url), "utf-8");

function makeDom() {
  return new JSDOM(`<!doctype html><html><body></body></html>`, {
    url: "https://example.test/",
    runScripts: "dangerously",
    pretendToBeVisual: true,
  });
}

function runScript(dom) {
  const scriptEl = dom.window.document.createElement("script");
  scriptEl.textContent = source;
  dom.window.document.body.appendChild(scriptEl);
}

function fireLoad(dom) {
  dom.window.dispatchEvent(new dom.window.Event("load"));
}

describe("js/pwa-register.js — ลงทะเบียน service worker แบบ defensive (P1.7b)", () => {
  test("เบราว์เซอร์รองรับ serviceWorker + 'load' ยิงแล้ว → เรียก navigator.serviceWorker.register('/sw.js') หนึ่งครั้ง", () => {
    const dom = makeDom();
    const calls = [];
    dom.window.navigator.serviceWorker = {
      register(path) {
        calls.push(path);
        return Promise.resolve({});
      },
    };
    runScript(dom);
    fireLoad(dom);
    assert.deepEqual(calls, ["/sw.js"]);
  });

  test("ยังไม่ยิง 'load' → ยังไม่เรียก register() เลย (รอ load ก่อนเสมอ ไม่แย่งช่วง first paint)", () => {
    const dom = makeDom();
    const calls = [];
    dom.window.navigator.serviceWorker = {
      register(path) {
        calls.push(path);
        return Promise.resolve({});
      },
    };
    runScript(dom);
    assert.deepEqual(calls, [], "ห้ามเรียก register ก่อนมี 'load' event");
  });

  test("เบราว์เซอร์ไม่รองรับ 'serviceWorker' ใน navigator เลย → ไม่ throw และไม่พยายามเรียกอะไร", () => {
    const dom = makeDom();
    // navigator.serviceWorker ไม่ได้ตั้งค่าเลย (undefined) — jsdom ปกติไม่มี property นี้อยู่แล้ว
    assert.doesNotThrow(() => runScript(dom));
    assert.doesNotThrow(() => fireLoad(dom));
  });

  test("register() reject (network/permission error) → .catch() ดักไว้ ไม่ throw ออกมาเป็น unhandled rejection", async () => {
    const dom = makeDom();
    dom.window.navigator.serviceWorker = {
      register() {
        return Promise.reject(new Error("boom"));
      },
    };
    runScript(dom);
    assert.doesNotThrow(() => fireLoad(dom));
    // ให้ microtask ของ .catch() ทำงานจบก่อนตรวจว่าไม่มี unhandled rejection เล็ดลอด
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  test("register() throw ทันที (synchronous) แทนที่จะคืน rejected promise → try/catch ดักไว้ ไม่ throw ออกมา", () => {
    const dom = makeDom();
    dom.window.navigator.serviceWorker = {
      register() {
        throw new Error("synchronous boom");
      },
    };
    runScript(dom);
    assert.doesNotThrow(() => fireLoad(dom));
  });
});
