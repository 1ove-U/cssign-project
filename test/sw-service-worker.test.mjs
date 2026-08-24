// test/sw-service-worker.test.mjs
//
// sw.js (P1.7b) รันใน ServiceWorkerGlobalScope จริง (self/caches/fetch/clients) ซึ่ง jsdom
// ไม่มีให้ (jsdom จำลองแค่ window/document) — ไฟล์นี้เลยรัน source ของ sw.js ผ่าน node:vm
// ในแซนด์บ็อกซ์ที่ mock self/caches/fetch/console แบบขั้นต่ำ (event target เก็บ handler ไว้
// เรียกเองในเทส) เพื่อตรวจ "การตัดสินใจ" ของ fetch handler (bypass เส้นทางแอดมิน/cross-origin/
// non-GET, navigate → network-first, static asset → cache-first) โดยไม่ต้องพึ่งเบราว์เซอร์จริง
// (Playwright ยังติด sandbox บล็อก cdn.playwright.dev อยู่ — ดู cssign-roadmap-prompt.md P0.1a)
//
// ขอบเขตของเทสชุดนี้: ตรวจ "เรียก respondWith หรือไม่" (=สคริปต์เข้ามาแทรกหรือปล่อยผ่านให้
// browser จัดการเอง) เป็นหลัก ไม่ได้ตรวจ byte ของ response ที่ตอบกลับละเอียดทุกกรณี (นั่นควรเป็น
// หน้าที่ของ E2E browser test ในอนาคตเมื่อ sandbox เปิด cdn.playwright.dev ให้แล้ว)

import { test, describe, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../sw.js", import.meta.url), "utf-8");

function makeCacheStub(matchResult) {
  const putCalls = [];
  return {
    putCalls,
    async match() {
      return matchResult ?? undefined;
    },
    async put(request, response) {
      putCalls.push({ request, response });
    },
    async addAll() {
      return undefined;
    },
  };
}

function makeSandbox({ cacheMatch } = {}) {
  const listeners = {};
  const cacheStub = makeCacheStub(cacheMatch);
  const fetchCalls = [];

  const sandbox = {
    self: {
      addEventListener(type, handler) {
        listeners[type] = handler;
      },
      skipWaiting() {},
      clients: { claim() {} },
      location: { origin: "https://cssign.co.th" },
    },
    caches: {
      async open() {
        return cacheStub;
      },
      async keys() {
        return ["cssign-shell-v1"];
      },
      async delete() {
        return true;
      },
    },
    fetch: async (request) => {
      fetchCalls.push(request);
      return { clone() { return this; }, __network: true };
    },
    console: { warn() {} },
    URL,
  };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return { sandbox, listeners, cacheStub, fetchCalls };
}

function makeRequest(url, opts = {}) {
  return { url, method: opts.method || "GET", mode: opts.mode || "same-origin" };
}

describe("sw.js — fetch handler bypass/strategy decisions (P1.7b)", () => {
  let ctx;
  before(() => {
    ctx = makeSandbox({ cacheMatch: { __cached: true } });
  });

  function fireFetch(request) {
    let responded = false;
    let respondedWith;
    const event = {
      request,
      respondWith(promiseOrValue) {
        responded = true;
        respondedWith = promiseOrValue;
      },
    };
    ctx.listeners.fetch(event);
    return { responded, respondedWith };
  }

  test("ลงทะเบียน install/activate/fetch listener ครบ", () => {
    assert.equal(typeof ctx.listeners.install, "function");
    assert.equal(typeof ctx.listeners.activate, "function");
    assert.equal(typeof ctx.listeners.fetch, "function");
  });

  test("POST same-origin → bypass ไม่เรียก respondWith เลย (ปล่อยให้ browser ส่งตรง)", () => {
    const { responded } = fireFetch(
      makeRequest("https://cssign.co.th/js/db-orders.js", { method: "POST" })
    );
    assert.equal(responded, false);
  });

  test("GET cross-origin (Firestore) → bypass ไม่เรียก respondWith เลย", () => {
    const { responded } = fireFetch(
      makeRequest("https://firestore.googleapis.com/v1/projects/x")
    );
    assert.equal(responded, false);
  });

  test("GET /admin.html → bypass (ไม่ cache หน้าแอดมิน)", () => {
    const { responded } = fireFetch(makeRequest("https://cssign.co.th/admin.html"));
    assert.equal(responded, false);
  });

  test("GET /js/db-orders.js → bypass (path ขึ้นต้น /js/db ถูก exclude)", () => {
    const { responded } = fireFetch(
      makeRequest("https://cssign.co.th/js/db-orders.js")
    );
    assert.equal(responded, false);
  });

  test("navigation request (mode: 'navigate') ไปหน้าแรก → เรียก respondWith (network-first + cache fallback)", async () => {
    const { responded, respondedWith } = fireFetch(
      makeRequest("https://cssign.co.th/", { mode: "navigate" })
    );
    assert.equal(responded, true);
    const result = await respondedWith;
    assert.ok(result, "ต้องได้ response กลับมา (จาก network stub หรือ cache stub)");
  });

  test("GET static asset same-origin (css/js/รูป) → เรียก respondWith (cache-first)", async () => {
    const { responded, respondedWith } = fireFetch(
      makeRequest("https://cssign.co.th/css/style.css")
    );
    assert.equal(responded, true);
    const result = await respondedWith;
    assert.deepEqual(result, { __cached: true }, "cache hit ต้องตอบจาก cache ทันที ไม่รอ network");
  });
});

describe("sw.js — syntax + PRECACHE_URLS sanity", () => {
  test("ไฟล์ parse ได้โดยไม่ throw (new vm.Script ยืนยัน syntax ถูกต้อง)", () => {
    assert.doesNotThrow(() => new vm.Script(source));
  });

  test("PRECACHE_URLS มี entry สำคัญของ app shell (หน้าแรกไทย/อังกฤษ + track-modal assets)", () => {
    assert.match(source, /["']\/["']/);
    assert.match(source, /["']\/index\.html["']/);
    assert.match(source, /["']\/en\/index\.html["']/);
    assert.match(source, /["']\/js\/track-modal\.js["']/);
    assert.match(source, /["']\/css\/track-modal\.css["']/);
  });
});
