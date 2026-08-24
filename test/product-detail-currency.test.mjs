// test/product-detail-currency.test.mjs — P2.10-currency-c
//
// เทส js/product-detail-currency.js — currency switcher helpers ของ en/product-detail.html
// (ดูคอมเมนต์หัวไฟล์ js/product-detail-currency.js สำหรับเหตุผลที่แยกออกมาเป็นไฟล์ต่างหาก)
// ฟังก์ชันทั้งหมดในไฟล์นี้ import จาก currency.js ตรงๆ (ไม่ผ่าน window.CSSignCurrency bridge)
// และ getStoredCurrency/setStoredCurrency รับ storage เป็นพารามิเตอร์ optional จึงเทสได้ด้วย
// storage stub ธรรมดา ไม่ต้องพึ่ง jsdom เลย

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  PDP_CURRENCY_STORAGE_KEY,
  getStoredCurrency,
  setStoredCurrency,
  formatPdpAmount,
} from "../js/product-detail-currency.js";

// storage stub ง่ายๆ (Map ธรรมดา) ตาม interface getItem/setItem ของ Storage จริง —
// แพทเทิร์นเดียวกับ test/admin-onboarding.test.mjs
function makeStorageStub() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
  };
}

function makeThrowingStorage() {
  return {
    getItem() { throw new Error("SecurityError: localStorage unavailable (private mode)"); },
    setItem() { throw new Error("SecurityError: localStorage unavailable (private mode)"); },
  };
}

describe("js/product-detail-currency.js — getStoredCurrency()/setStoredCurrency() (P2.10-currency-c)", () => {
  test("ไม่มีค่าเก็บไว้เลย → คืน 'THB' เป็นค่าเริ่มต้น", () => {
    assert.equal(getStoredCurrency(makeStorageStub()), "THB");
  });

  test("setStoredCurrency() แล้ว getStoredCurrency() อ่านค่าเดิมกลับมาได้ถูกต้อง", () => {
    const storage = makeStorageStub();
    setStoredCurrency("EUR", storage);
    assert.equal(getStoredCurrency(storage), "EUR");
    assert.equal(storage.getItem(PDP_CURRENCY_STORAGE_KEY), "EUR");
  });

  test("ค่าที่เก็บไว้ไม่ใช่ currency ที่รองรับ (เช่นถูกแก้ด้วยมือ) → fallback เป็น THB แทนการพัง", () => {
    const storage = makeStorageStub();
    storage.setItem(PDP_CURRENCY_STORAGE_KEY, "JPY");
    assert.equal(getStoredCurrency(storage), "THB");
  });

  test("storage throw (จำลอง private mode) → getStoredCurrency()/setStoredCurrency() ไม่ throw, คืน THB", () => {
    const storage = makeThrowingStorage();
    assert.doesNotThrow(() => setStoredCurrency("USD", storage));
    let result;
    assert.doesNotThrow(() => { result = getStoredCurrency(storage); });
    assert.equal(result, "THB");
  });

  test("ไม่ส่ง storage เข้ามาเลย (undefined) ในสภาพแวดล้อม Node ธรรมดาที่ไม่มี window → ไม่ throw, คืน THB", () => {
    assert.doesNotThrow(() => getStoredCurrency());
    assert.equal(getStoredCurrency(), "THB");
    assert.doesNotThrow(() => setStoredCurrency("USD"));
  });
});

describe("js/product-detail-currency.js — formatPdpAmount() (P2.10-currency-c)", () => {
  test("currency 'THB' หรือไม่ระบุ → รูปแบบเดิมทุกประการ ('฿' + toLocaleString en-US)", () => {
    assert.equal(formatPdpAmount(1234, "THB"), "฿1,234");
    assert.equal(formatPdpAmount(1234), "฿1,234");
  });

  test("currency ที่รองรับ (USD/EUR/CNY) → แปลง+จัดรูปแบบผ่าน currency.js จริง", () => {
    assert.equal(formatPdpAmount(3600, "USD"), "$100");
    assert.equal(formatPdpAmount(500, "EUR"), "€13");
  });

  test("currency ที่ไม่รองรับ (เช่น 'JPY') → fallback เป็นรูปแบบ THB เดิม ไม่ throw", () => {
    assert.equal(formatPdpAmount(1000, "JPY"), "฿1,000");
  });
});
