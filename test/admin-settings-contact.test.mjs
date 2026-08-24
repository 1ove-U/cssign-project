// test/admin-settings-contact.test.mjs — รอบที่ 116
//
// ขอบเขต: js/admin-settings-contact.js (49 บรรทัด) — แท็บ SETTINGS ย่อย "ข้อมูลติดต่อทั้งเว็บไซต์"
// (เอกสาร settings/main เอกสารเดียว) — renderContactSettings(settings) เติมค่าลงฟอร์ม (7 ช่อง:
// phone/phone2/fax/email/lineUrl/facebookUrl/address — ทุกช่อง fallback "" ถ้า settings เป็น
// null/undefined หรือฟิลด์นั้นไม่มี) + form submit handler (trim ทุกช่อง → saveSettings() →
// success message ใน #ad-s-status / ล้มเหลว → showToast() error) — ไฟล์นี้ import
// js/db-settings.js ตรงๆ (saveSettings) ซึ่ง import js/db.js ต่อ (Firebase SDK URL) จึงต้องพึ่ง
// test/helpers/firebase-stub-loader.mjs (ลงทะเบียนแล้วผ่าน --import ./test/helpers/register-loader.mjs
// ใน npm script "test") — saveSettings() เรียก setDoc() ของ stub ตรงๆ (บันทึกไว้ที่
// globalThis.__SET_DOC_CALLS__ พร้อม path/payload/options)
//
// สถาปัตยกรรมเทส: import ทั้งไฟล์ครั้งเดียวใน before() ผ่าน jsdom + admin.html body จริง (ตัด
// <script> ออก) ตามแพทเทิร์นเดียวกับ test/admin-settings-staff.test.mjs (รอบ 103) — ไฟล์นี้ไม่มี
// confirmDialog/deleteWithUndo เลย (ไม่มีปุ่มลบ เอกสารตั้งค่าเดียวแก้ไขได้อย่างเดียว) จึงเทสง่าย
// กว่ารอบก่อนๆ มาก — ไม่ต้อง mock timer ใดๆ
//
// ตรวจโค้ดจริงทั้งไฟล์ js/admin-settings-contact.js ก่อนเขียนเทสนี้ (49 บรรทัด อ่านครบ) — ไม่พบบั๊ก
// จึงเป็นไฟล์เทสล้วนๆ ไม่มีการแก้โค้ดผลิตภัณฑ์เลยแม้แต่บรรทัดเดียว

import { test, describe, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const ADMIN_HTML = readFileSync(new URL("../admin.html", import.meta.url), "utf-8");
const BODY_START = ADMIN_HTML.indexOf(">", ADMIN_HTML.indexOf("<body")) + 1;
const BODY_END = ADMIN_HTML.indexOf("</body>");
const ADMIN_BODY_NO_SCRIPTS = ADMIN_HTML
  .slice(BODY_START, BODY_END)
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, "");

let document;
let mod; // admin-settings-contact.js exports

const FIELD_IDS = {
  phone: "ad-s-phone",
  phone2: "ad-s-phone2",
  fax: "ad-s-fax",
  email: "ad-s-email",
  lineUrl: "ad-s-line-url",
  facebookUrl: "ad-s-facebook-url",
  address: "ad-s-address",
};

function fieldValues() {
  const out = {};
  for (const [key, id] of Object.entries(FIELD_IDS)) {
    out[key] = document.getElementById(id).value;
  }
  return out;
}

function setFieldValues(values) {
  for (const [key, id] of Object.entries(FIELD_IDS)) {
    document.getElementById(id).value = Object.prototype.hasOwnProperty.call(values, key) ? values[key] : "";
  }
}

const SAMPLE_SETTINGS = {
  phone: "062-883-3880",
  phone2: "02-123-4567",
  fax: "02-999-8888",
  email: "cssigngroup@gmail.com",
  lineUrl: "https://line.me/ti/p/@cssigngroup",
  facebookUrl: "https://facebook.com/cssign",
  address: "123 ถนนสุขุมวิท กรุงเทพฯ",
};

before(async () => {
  const dom = new JSDOM(`<!doctype html><html><body>${ADMIN_BODY_NO_SCRIPTS}</body></html>`);
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
  globalThis.Event = dom.window.Event;
  document = dom.window.document;

  mod = await import("../js/admin-settings-contact.js");
});

beforeEach(() => {
  globalThis.__SET_DOC_CALLS__ = [];
  document.querySelectorAll(".cp-toast-wrap .cp-toast").forEach((el) => el.remove());
  setFieldValues({});
  document.getElementById("ad-s-status").textContent = "";
});

describe("renderContactSettings(settings)", () => {
  test("เติมค่าจาก settings ครบทั้ง 7 ช่อง", () => {
    mod.renderContactSettings(SAMPLE_SETTINGS);
    assert.deepEqual(fieldValues(), SAMPLE_SETTINGS);
  });

  test("settings เป็น null → ทุกช่องว่างหมด ไม่ throw", () => {
    assert.doesNotThrow(() => mod.renderContactSettings(null));
    assert.deepEqual(fieldValues(), {
      phone: "", phone2: "", fax: "", email: "", lineUrl: "", facebookUrl: "", address: "",
    });
  });

  test("settings เป็น undefined → ทุกช่องว่างหมด ไม่ throw", () => {
    assert.doesNotThrow(() => mod.renderContactSettings(undefined));
    assert.deepEqual(fieldValues(), {
      phone: "", phone2: "", fax: "", email: "", lineUrl: "", facebookUrl: "", address: "",
    });
  });

  test("settings มีบางฟิลด์ขาด → เฉพาะฟิลด์ที่ขาด fallback เป็น \"\" ฟิลด์อื่นเติมค่าปกติ", () => {
    mod.renderContactSettings({ phone: "062-883-3880", email: "x@x.com" });
    assert.deepEqual(fieldValues(), {
      phone: "062-883-3880", phone2: "", fax: "", email: "x@x.com", lineUrl: "", facebookUrl: "", address: "",
    });
  });

  test("เรียกซ้ำสองครั้งด้วยค่าต่างกัน → ค่าล่าสุดทับค่าเก่าหมด (ไม่ค้าง)", () => {
    mod.renderContactSettings(SAMPLE_SETTINGS);
    mod.renderContactSettings({ phone: "099-999-9999" });
    assert.deepEqual(fieldValues(), {
      phone: "099-999-9999", phone2: "", fax: "", email: "", lineUrl: "", facebookUrl: "", address: "",
    });
  });
});

describe("ฟอร์ม #ad-s-form — submit", () => {
  test("กรอกครบ (มีช่องว่างหัวท้าย) → saveSettings() ถูกเรียกด้วยค่าที่ trim แล้วครบทุกช่อง", async () => {
    setFieldValues({
      phone: "  062-883-3880  ",
      phone2: "  02-123-4567  ",
      fax: "  02-999-8888  ",
      email: "  cssigngroup@gmail.com  ",
      lineUrl: "  https://line.me/ti/p/@cssigngroup  ",
      facebookUrl: "  https://facebook.com/cssign  ",
      address: "  123 ถนนสุขุมวิท กรุงเทพฯ  ",
    });

    document.getElementById("ad-s-form").dispatchEvent(new Event("submit"));
    await flushMicrotasks();

    assert.equal(globalThis.__SET_DOC_CALLS__.length, 1);
    assert.equal(globalThis.__SET_DOC_CALLS__[0].path, "settings/main");
    assert.deepEqual(globalThis.__SET_DOC_CALLS__[0].payload, SAMPLE_SETTINGS);
    assert.deepEqual(globalThis.__SET_DOC_CALLS__[0].options, { merge: true });
  });

  test("ทุกช่องว่าง → saveSettings() ยังถูกเรียก (ไม่มี validation บังคับกรอก) ด้วย payload ทุกช่องเป็น \"\"", async () => {
    document.getElementById("ad-s-form").dispatchEvent(new Event("submit"));
    await flushMicrotasks();

    assert.equal(globalThis.__SET_DOC_CALLS__.length, 1);
    assert.deepEqual(globalThis.__SET_DOC_CALLS__[0].payload, {
      phone: "", phone2: "", fax: "", email: "", lineUrl: "", facebookUrl: "", address: "",
    });
  });

  test("สำเร็จ → ข้อความบันทึกสำเร็จแสดงใน #ad-s-status, ปุ่ม submit กลับมา disabled=false + ข้อความเดิม", async () => {
    setFieldValues(SAMPLE_SETTINGS);
    const btn = document.querySelector("#ad-s-form button[type=submit]");
    const originalText = btn.textContent;

    document.getElementById("ad-s-form").dispatchEvent(new Event("submit"));
    await flushMicrotasks();

    assert.match(document.getElementById("ad-s-status").textContent, /บันทึกสำเร็จ/);
    assert.equal(btn.disabled, false);
    assert.equal(btn.textContent, originalText);
  });

  test("ระหว่างบันทึก ปุ่ม submit ถูก disable + เปลี่ยนข้อความเป็น 'กำลังบันทึก...'", async () => {
    setFieldValues(SAMPLE_SETTINGS);
    const btn = document.querySelector("#ad-s-form button[type=submit]");

    document.getElementById("ad-s-form").dispatchEvent(new Event("submit"));
    // ตรวจสถานะทันทีหลัง dispatch ก่อน microtask (setDoc) จะ resolve — synchronous ก่อน await ใดๆ
    assert.equal(btn.disabled, true);
    assert.equal(btn.textContent, "กำลังบันทึก...");
    await flushMicrotasks();
  });

});

// หมายเหตุ: ไม่มีเทส "saveSettings() ล้มเหลว" แบบยิง error จริง เพราะ test/helpers/firebase-stub-loader.mjs
// ไม่มี hook ให้ setDoc() throw ได้ (ต่างจาก getDocs()/getDoc() ที่มี __GET_DOCS_STUB__/__GET_DOC_STUB__
// ให้ override) — ยืนยันด้วย grep stub ทั้งไฟล์แล้วว่า setDoc() คืน noopAsync() เสมอไม่มีทาง throw
// จาก stub เอง ส่วน error path อื่นที่เป็นไปได้ (เช่น getElementById คืน null) ไม่เกิดขึ้นจริงเพราะ
// admin.html body มี element ครบทุกตัวเสมอ — เทสส่วนนี้จึงตัดออก (เหมือนแพทเทิร์นการตัดเทสที่จับ
// จังหวะไม่ได้ในรอบก่อนๆ เช่นรอบ 115 bulk delete disable state)

// helper: รอ microtask queue ระบาย (สำหรับ async event handler ที่ไม่มี promise ให้ await ตรงๆ)
function flushMicrotasks() {
  return new Promise((r) => setTimeout(r, 0));
}
