// test/db-settings-crud-flow.test.mjs — รอบที่ 75
//
// ทดสอบ getSettings()/saveSettings() (js/db-settings.js) แบบเรียกฟังก์ชันจริงตรงๆ (ไม่ผ่าน UI
// form ใดๆ — แนวทาง data-layer เดียวกับ db-orders/db-products/db-blog/db-content/
// db-taxonomy-crud-flow.test.mjs รอบ 70-74) — ไฟล์นี้เป็นไฟล์สุดท้ายของลิสต์ data-layer หลักที่
// สำรวจไว้ตั้งแต่รอบ 70 (db-orders/db-products/db-blog/db-content/db-taxonomy/db-settings) —
// เล็กที่สุดในบรรดาทั้งหมดที่เจอมา (แค่ 2 ฟังก์ชัน, เอกสารเดียว "settings/main" ตัวเดียว ไม่มี
// collection ของหลายเอกสาร) และเป็นไฟล์แรกในกลุ่มนี้ที่ **ไม่มี addDoc()/updateDoc()/deleteDoc()
// เลยสักบรรทัด** — ใช้แค่ getDoc()/setDoc() เท่านั้น (อ่าน js/db-settings.js จริงก่อนเขียน ไม่ได้
// สมมติว่าเหมือนไฟล์ data-layer อื่น):
//
// - getSettings(): getDoc() ที่ "settings/main" — ถ้าเอกสารมีอยู่จริง (exists) คืนค่า snap.data()
//   ตรงๆ, ถ้าไม่มีคืนค่า null ตรงๆ (ไม่ใช่ {} ว่างเปล่าเหมือนไฟล์อื่นที่เคยเจอ) — ควบคุมผลด้วย
//   globalThis.__GET_DOC_STUB__ (pattern เดียวกับ db-orders-crud-flow.test.mjs รอบ 70)
// - saveSettings(settings): setDoc() ที่ "settings/main" พร้อม **{ merge: true }** เสมอ — ส่ง
//   settings object เข้าไปตรงๆ ทั้งก้อน ไม่มีการแปลง/fallback ฟิลด์ใดๆ เลยแม้แต่ฟิลด์เดียว (ต่างจาก
//   ทุกไฟล์ data-layer อื่นที่เจอมาตั้งแต่รอบ 70 ที่ล้วนมี fallback บางฟิลด์อย่างน้อย 1 แบบ — ไฟล์นี้
//   ไม่มีเลยเพราะ settings มีโครงสร้างยืดหยุ่นตามหน้าแอดมินที่เรียกใช้ ไม่ใช่ fixed schema) — ไม่มี
//   createdAt/updatedAt ใดๆ ถูกเติมอัตโนมัติเหมือนไฟล์ CRUD อื่น (ต่างจาก addDoc ที่เคยเจอมาตลอด)
//
// รันด้วย: node --import ./test/helpers/register-loader.mjs --test
// test/db-settings-crud-flow.test.mjs

import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { getSettings, saveSettings } from "../js/db-settings.js";

// ── helper: ล้าง capture array + getDoc stub ก่อนแต่ละเทสต์ (pattern เดียวกับรอบ 70-74) ──
function resetCalls() {
  globalThis.__ADD_DOC_CALLS__ = [];
  globalThis.__UPDATE_DOC_CALLS__ = [];
  globalThis.__DELETE_DOC_CALLS__ = [];
  globalThis.__SET_DOC_CALLS__ = [];
  globalThis.__GET_DOC_STUB__ = undefined;
}

beforeEach(() => {
  resetCalls();
});

describe("getSettings()", () => {
  test("เอกสาร \"settings/main\" มีอยู่จริง → คืนค่า snap.data() ตรงๆ", async () => {
    globalThis.__GET_DOC_STUB__ = (ref) => {
      assert.equal(ref.path, "settings/main");
      return { exists: true, data: { siteName: "CS.SIGN", phone: "02-000-0000" } };
    };
    const result = await getSettings();
    assert.deepEqual(result, { siteName: "CS.SIGN", phone: "02-000-0000" });
  });

  test("เอกสาร \"settings/main\" ไม่มีอยู่จริง → คืนค่า null (ไม่ใช่ {} ว่างเปล่าเหมือนไฟล์อื่น)", async () => {
    globalThis.__GET_DOC_STUB__ = () => ({ exists: false, data: {} });
    const result = await getSettings();
    assert.equal(result, null);
  });

  test("ไม่ตั้ง __GET_DOC_STUB__ เลย → ใช้ default ของ stub loader (exists: false) → คืนค่า null เช่นกัน", async () => {
    const result = await getSettings();
    assert.equal(result, null);
  });
});

describe("saveSettings()", () => {
  test("setDoc ถูกเรียกที่ \"settings/main\" พร้อม options merge:true, payload ส่งตรงๆ ไม่มีการแปลงฟิลด์ใดๆ", async () => {
    const settings = { siteName: "CS.SIGN", email: "info@cssign.co.th", showChat: true };
    await saveSettings(settings);
    const calls = globalThis.__SET_DOC_CALLS__;
    assert.equal(calls.length, 1);
    assert.equal(calls[0].path, "settings/main");
    assert.deepEqual(calls[0].payload, settings);
    assert.deepEqual(calls[0].options, { merge: true });
    // ไม่มี addDoc/updateDoc/deleteDoc ถูกเรียกเลยสักบรรทัด
    assert.equal(globalThis.__ADD_DOC_CALLS__.length, 0);
    assert.equal(globalThis.__UPDATE_DOC_CALLS__.length, 0);
    assert.equal(globalThis.__DELETE_DOC_CALLS__.length, 0);
  });

  test("ไม่มีการเติม createdAt/updatedAt อัตโนมัติใดๆ เข้า payload (ต่างจากไฟล์ addDoc อื่นที่เจอมาตลอด)", async () => {
    const settings = { siteName: "CS.SIGN" };
    await saveSettings(settings);
    const payload = globalThis.__SET_DOC_CALLS__[0].payload;
    assert.equal("createdAt" in payload, false);
    assert.equal("updatedAt" in payload, false);
    assert.deepEqual(payload, settings);
  });

  test("payload ที่ส่งบางส่วน (partial update) ก็ถูกส่งตรงๆ ไม่ถูกเติม/ตัดฟิลด์ใดๆ — merge:true จัดการรวมที่ฝั่ง Firestore", async () => {
    const partial = { showChat: false };
    await saveSettings(partial);
    const call = globalThis.__SET_DOC_CALLS__[0];
    assert.deepEqual(call.payload, { showChat: false });
    assert.equal(Object.keys(call.payload).length, 1);
    assert.deepEqual(call.options, { merge: true });
  });

  test("เรียกซ้ำสองครั้งติดกัน → setDoc ถูกเรียก 2 ครั้ง แยก payload ตามลำดับที่เรียกจริง", async () => {
    await saveSettings({ siteName: "รอบแรก" });
    await saveSettings({ siteName: "รอบสอง" });
    const calls = globalThis.__SET_DOC_CALLS__;
    assert.equal(calls.length, 2);
    assert.equal(calls[0].payload.siteName, "รอบแรก");
    assert.equal(calls[1].payload.siteName, "รอบสอง");
  });
});
