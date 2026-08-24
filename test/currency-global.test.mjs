// test/currency-global.test.mjs
//
// Unit test สำหรับ js/currency-global.js (P2.10-currency-b) — สะพานเชื่อม js/currency.js
// (ES module) เข้ากับ window.CSSignCurrency เพื่อให้ classic script (js/products-detail-popup-en.js)
// เรียกใช้ได้ — ดูคอมเมนต์หัวไฟล์ js/currency-global.js สำหรับเหตุผลที่ต้องมีสะพานนี้
//
// วิธีทดสอบ: ตั้ง global.window เป็น jsdom window object ก่อน import ไฟล์นี้แบบ dynamic import
// (import statement ระดับบนสุดของไฟล์นี้อ้างอิง `window` ตรงๆ โดยไม่มี typeof guard — เพราะ
// ไฟล์นี้ถูกออกแบบมาให้รันเฉพาะในเบราว์เซอร์จริง/jsdom เท่านั้น ไม่ใช่ Node environment เปล่าๆ)
// import แบบ dynamic (ไม่ใช่ static ที่หัวไฟล์) เพราะต้องตั้ง global.window ให้เสร็จก่อน evaluate

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

describe("js/currency-global.js — window.CSSignCurrency bridge (P2.10-currency-b)", () => {
  // เทสเดียวรวมทุก assertion — dynamic import() ของ specifier เดิมครั้งที่สองจะได้ module ที่
  // cache ไว้แล้ว (ไม่รัน side-effect ซ้ำ) ดังนั้นถ้าแยกเป็นหลาย test แล้วสร้าง jsdom window ใหม่
  // ทุกครั้ง import ครั้งที่ 2 เป็นต้นไปจะไม่ตั้ง CSSignCurrency ให้ window ก้อนใหม่นั้นเลย
  test("import แล้วตั้ง window.CSSignCurrency ครบทุกฟังก์ชัน/ค่าคงที่ และทำงานตรงกับ js/currency.js ต้นทางจริง", async () => {
    const dom = new JSDOM("", { url: "https://example.test/" });
    global.window = dom.window;
    try {
      await import("../js/currency-global.js");
      assert.ok(global.window.CSSignCurrency, "window.CSSignCurrency ต้องถูกตั้งค่า");
      assert.equal(typeof global.window.CSSignCurrency.getSupportedCurrencies, "function");
      assert.equal(typeof global.window.CSSignCurrency.isSupportedCurrency, "function");
      assert.equal(typeof global.window.CSSignCurrency.convertFromTHB, "function");
      assert.equal(typeof global.window.CSSignCurrency.formatCurrencyAmount, "function");
      assert.deepEqual(global.window.CSSignCurrency.getSupportedCurrencies(), ["THB", "USD", "EUR", "CNY"]);
      assert.equal(global.window.CSSignCurrency.convertFromTHB(3600, "USD"), 100);
      assert.equal(global.window.CSSignCurrency.formatCurrencyAmount(3600, "USD"), "$100");
      assert.equal(global.window.CSSignCurrency.isSupportedCurrency("JPY"), false);
    } finally {
      delete global.window;
    }
  });
});
