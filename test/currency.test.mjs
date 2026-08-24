// test/currency.test.mjs
//
// Unit test สำหรับ js/currency.js (P2.10-currency-a — ยังเป็นแค่ data layer ล้วนๆ ยังไม่ได้
// wire เข้า UI จุดไหน ดูหมายเหตุหัวไฟล์ js/currency.js สำหรับบริบท) — ไฟล์นี้ไม่ import Firebase
// SDK เลย ไม่จำเป็นต้องพึ่ง stub loader ใดๆ แต่ยังรันผ่าน register-loader.mjs เหมือนไฟล์เทสอื่น
// เพราะ npm test เรียก `--import ./test/helpers/register-loader.mjs` รวมทุกไฟล์อยู่แล้ว
// (ดู package.json "test" script) ไม่กระทบอะไรเพราะ loader ดักเฉพาะ URL ของ Firebase SDK เท่านั้น

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  EXCHANGE_RATES_THB,
  CURRENCY_SYMBOLS,
  getSupportedCurrencies,
  isSupportedCurrency,
  convertFromTHB,
  formatCurrencyAmount,
} from "../js/currency.js";

describe("getSupportedCurrencies / isSupportedCurrency", () => {
  test("getSupportedCurrencies() คืน list ที่ตรงกับ key ของ EXCHANGE_RATES_THB ทุกตัว", () => {
    assert.deepEqual(getSupportedCurrencies(), Object.keys(EXCHANGE_RATES_THB));
  });

  test("isSupportedCurrency() true สำหรับ THB/USD/EUR/CNY, false สำหรับสกุลเงินที่ไม่รองรับ/ค่าว่าง/ไม่ใช่ string", () => {
    assert.equal(isSupportedCurrency("THB"), true);
    assert.equal(isSupportedCurrency("USD"), true);
    assert.equal(isSupportedCurrency("EUR"), true);
    assert.equal(isSupportedCurrency("CNY"), true);
    assert.equal(isSupportedCurrency("JPY"), false);
    assert.equal(isSupportedCurrency(""), false);
    assert.equal(isSupportedCurrency(null), false);
    assert.equal(isSupportedCurrency(undefined), false);
    assert.equal(isSupportedCurrency(36), false);
  });
});

describe("convertFromTHB()", () => {
  test("THB → THB คืนค่าเดิมเป๊ะ (rate 1)", () => {
    assert.equal(convertFromTHB(1250, "THB"), 1250);
  });

  test("THB → USD หารด้วย rate แล้วปัดเศษเป็นจำนวนเต็ม", () => {
    // rate USD = 36 ตามที่กำหนดในไฟล์ปัจจุบัน — เทสนี้ยึด rate ปัจจุบันเป็นค่าคงที่ตรงๆ
    // (ถ้ารอบถัดไปปรับ EXCHANGE_RATES_THB.USD ต้องแก้ตัวเลขคาดหวังในเทสนี้คู่กันด้วย)
    assert.equal(convertFromTHB(3600, "USD"), 100);
    assert.equal(convertFromTHB(1000, "USD"), Math.round(1000 / EXCHANGE_RATES_THB.USD));
  });

  test("ปัดเศษเป็นจำนวนเต็มเสมอ ไม่มีทศนิยมหลุดออกมา", () => {
    var result = convertFromTHB(1250, "USD");
    assert.equal(Number.isInteger(result), true);
  });

  test("จำนวนเงินไม่ถูกต้อง (0, ลบ, NaN, null, undefined, string ไม่ใช่ตัวเลข) → null เสมอ", () => {
    assert.equal(convertFromTHB(0, "USD"), null);
    assert.equal(convertFromTHB(-500, "USD"), null);
    assert.equal(convertFromTHB(NaN, "USD"), null);
    assert.equal(convertFromTHB(null, "USD"), null);
    assert.equal(convertFromTHB(undefined, "USD"), null);
    assert.equal(convertFromTHB("abc", "USD"), null);
  });

  test("currency ไม่รองรับ (JPY, ว่างเปล่า, พิมพ์เล็ก 'usd') → null แม้จำนวนเงินถูกต้อง", () => {
    assert.equal(convertFromTHB(1000, "JPY"), null);
    assert.equal(convertFromTHB(1000, ""), null);
    assert.equal(convertFromTHB(1000, "usd"), null);
    assert.equal(convertFromTHB(1000, undefined), null);
  });

  test("string ตัวเลขที่แปลงได้ (เช่น จาก HTML input value) ยังทำงานถูกต้อง (Number() coerce)", () => {
    assert.equal(convertFromTHB("3600", "USD"), 100);
  });
});

describe("formatCurrencyAmount()", () => {
  test("THB ใช้สัญลักษณ์ ฿ + คั่นหลักพันแบบ th-TH", () => {
    assert.equal(formatCurrencyAmount(1250, "THB"), "฿" + (1250).toLocaleString("th-TH"));
  });

  test("USD ใช้สัญลักษณ์ $ + คั่นหลักพันแบบ en-US", () => {
    assert.equal(formatCurrencyAmount(3600, "USD"), "$100");
    assert.equal(formatCurrencyAmount(360000, "USD"), "$" + (10000).toLocaleString("en-US"));
  });

  test("EUR/CNY ใช้สัญลักษณ์ €/¥ ตามลำดับ", () => {
    assert.equal(formatCurrencyAmount(1000, "EUR")[0], CURRENCY_SYMBOLS.EUR);
    assert.equal(formatCurrencyAmount(1000, "CNY")[0], CURRENCY_SYMBOLS.CNY);
  });

  test("คืน null เมื่อ convertFromTHB() จะคืน null (ราคาไม่ถูกต้อง หรือ currency ไม่รองรับ) — ไม่มี fallback ข้อความผูกมากับไฟล์นี้", () => {
    assert.equal(formatCurrencyAmount(0, "USD"), null);
    assert.equal(formatCurrencyAmount(1000, "JPY"), null);
    assert.equal(formatCurrencyAmount(-1, "THB"), null);
  });
});
