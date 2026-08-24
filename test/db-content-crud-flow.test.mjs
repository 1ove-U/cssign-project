// test/db-content-crud-flow.test.mjs — รอบที่ 73 (แก้ไขรอบที่ 3 ของงานลบ clients/testimonials)
//
// ทดสอบ savePortfolio()/deletePortfolio(), saveFaq()/deleteFaq() (js/db-content.js) แบบเรียก
// ฟังก์ชันจริงตรงๆ (ไม่ผ่าน UI form ใดๆ — แนวทาง data-layer เดียวกับรอบ 70/71/72) ยืนยันว่า
// payload ที่ถูกส่งเข้า addDoc()/updateDoc()/deleteDoc() จริง (ผ่าน firebase-stub-loader.mjs —
// ไม่ต้องแก้ stub เพิ่มเลยในรอบนี้เช่นเดียวกับรอบ 71/72 เพราะทั้ง 2 entity ในไฟล์นี้ไม่มีการเรียก
// getDoc()/setDoc() เลยสักบรรทัด) ถูกต้องตรงตาม business logic จริงของแต่ละฟังก์ชัน — ไฟล์นี้
// (js/db-content.js) รวม entity เนื้อหาเว็บไซต์ที่มีรูปแบบ CRUD คล้ายกัน (ก็อป field ล้วนๆ ไม่มี
// query ซับซ้อน) แต่แต่ละอันมี default value ต่างกันเล็กน้อย — อ่าน js/db-content.js จริงทั้งไฟล์
// ก่อนเขียน (ไม่ได้สมมติว่าเหมือน db-products.js/db-blog.js เป๊ะ):
//
// (เดิมไฟล์นี้เทส savePartner()/deletePartner()/saveTestimonial()/deleteTestimonial() ด้วย —
// ถูกลบออกจากไฟล์นี้แล้วในรอบลบฟีเจอร์ "โลโก้ลูกค้า/รีวิวลูกค้า" เพราะทั้ง 4 ฟังก์ชันถูกลบออกจาก
// js/db-content.js ไปแล้วตั้งแต่รอบ 1 ของงานนั้น — เหลือแค่ portfolio/faq ในไฟล์นี้)
//
// - savePortfolio(): tags/images fallback [], pinned บังคับเป็น boolean ด้วย !!, order fallback 0
//   ด้วย Number.isFinite() check (ไม่ใช่ตรวจแค่ truthy — ต้องเป็นตัวเลขจริงเท่านั้น NaN/string/
//   undefined ทั้งหมด fallback เป็น 0)
// - saveFaq(): มีแค่ 2 field (question, answer) ไม่มี fallback ใดๆ เลย — ส่งตรงๆ ทั้งคู่
// - ทุก entity: สร้างใหม่ (ไม่มี id) → addDoc() ที่ collection ของตัวเอง พร้อม createdAt,
//   แก้ไข (มี id) → updateDoc() ที่ "<collection>/<id>" (ไม่มี createdAt ในกรณีนี้), ลบ →
//   deleteDoc() ที่ "<collection>/<id>" ตรงๆ ไม่มี sync ไฟล์อื่นใดๆ ทั้งหมด
//
// รันด้วย: node --import ./test/helpers/register-loader.mjs --test
// test/db-content-crud-flow.test.mjs

import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  savePortfolio, deletePortfolio,
  saveFaq, deleteFaq
} from "../js/db-content.js";

// ── helper: ล้าง capture array ก่อนแต่ละเทสต์ (pattern เดียวกับรอบ 70/71/72) ──
function resetCalls() {
  globalThis.__ADD_DOC_CALLS__ = [];
  globalThis.__UPDATE_DOC_CALLS__ = [];
  globalThis.__DELETE_DOC_CALLS__ = [];
  globalThis.__SET_DOC_CALLS__ = [];
}

beforeEach(() => {
  resetCalls();
});

describe("savePortfolio() / deletePortfolio()", () => {
  test("สร้างใหม่: field string ที่ไม่ส่งมา (category/client/description) fallback \"\", tags/images fallback []", async () => {
    await savePortfolio({ title: "ป้ายหน้าโรงงาน" });
    const payload = globalThis.__ADD_DOC_CALLS__[0].payload;
    assert.equal(globalThis.__ADD_DOC_CALLS__[0].path, "portfolios");
    assert.equal(payload.title, "ป้ายหน้าโรงงาน");
    assert.equal(payload.category, "");
    assert.equal(payload.client, "");
    assert.equal(payload.description, "");
    assert.deepEqual(payload.tags, []);
    assert.deepEqual(payload.images, []);
    assert.equal(typeof payload.createdAt, "number");
  });

  test("pinned ถูกบังคับเป็น boolean จริงด้วย !! (truthy → true, ไม่ส่งมา → false)", async () => {
    await savePortfolio({ title: "งาน A", pinned: "yes" });
    assert.equal(globalThis.__ADD_DOC_CALLS__[0].payload.pinned, true);

    resetCalls();
    await savePortfolio({ title: "งาน B" });
    assert.equal(globalThis.__ADD_DOC_CALLS__[0].payload.pinned, false);
  });

  test("order ใช้ Number.isFinite() เช็ค — เลขจริงส่งผ่านตรงๆ, ค่าที่ไม่ใช่เลขจำกัดความ (NaN/string/undefined) fallback เป็น 0 ทั้งหมด", async () => {
    await savePortfolio({ title: "งาน C", order: 3 });
    assert.equal(globalThis.__ADD_DOC_CALLS__[0].payload.order, 3);

    resetCalls();
    await savePortfolio({ title: "งาน D", order: "5" }); // string ไม่ผ่าน Number.isFinite
    assert.equal(globalThis.__ADD_DOC_CALLS__[0].payload.order, 0);

    resetCalls();
    await savePortfolio({ title: "งาน E", order: NaN });
    assert.equal(globalThis.__ADD_DOC_CALLS__[0].payload.order, 0);

    resetCalls();
    await savePortfolio({ title: "งาน F" }); // ไม่ส่งมาเลย
    assert.equal(globalThis.__ADD_DOC_CALLS__[0].payload.order, 0);
  });

  test("แก้ไข (มี id): updateDoc ที่ \"portfolios/<id>\" แทน addDoc", async () => {
    await savePortfolio({ id: "pf-1", title: "งานแก้ไขแล้ว", pinned: true, order: 2 });
    assert.equal(globalThis.__ADD_DOC_CALLS__.length, 0);
    const calls = globalThis.__UPDATE_DOC_CALLS__;
    assert.equal(calls.length, 1);
    assert.equal(calls[0].path, "portfolios/pf-1");
    assert.equal(calls[0].payload.pinned, true);
    assert.equal(calls[0].payload.order, 2);
  });

  test("deletePortfolio: deleteDoc ที่ \"portfolios/<id>\" ตรงๆ ครั้งเดียว", async () => {
    await deletePortfolio("pf-2");
    const calls = globalThis.__DELETE_DOC_CALLS__;
    assert.equal(calls.length, 1);
    assert.equal(calls[0].path, "portfolios/pf-2");
  });
});

describe("saveFaq() / deleteFaq()", () => {
  test("สร้างใหม่: addDoc ที่ \"faqs\" พร้อม question/answer ตรงๆ ไม่มี fallback ใดๆ เลย + createdAt", async () => {
    await saveFaq({ question: "ป้ายทำจากวัสดุอะไรได้บ้าง", answer: "อะคริลิก/สแตนเลส/PVC ฯลฯ" });
    const calls = globalThis.__ADD_DOC_CALLS__;
    assert.equal(calls.length, 1);
    assert.equal(calls[0].path, "faqs");
    assert.equal(calls[0].payload.question, "ป้ายทำจากวัสดุอะไรได้บ้าง");
    assert.equal(calls[0].payload.answer, "อะคริลิก/สแตนเลส/PVC ฯลฯ");
    assert.equal(typeof calls[0].payload.createdAt, "number");
  });

  test("แก้ไข (มี id): updateDoc ที่ \"faqs/<id>\" แทน addDoc, payload ไม่มี createdAt", async () => {
    await saveFaq({ id: "faq-1", question: "คำถามแก้ไขแล้ว", answer: "คำตอบแก้ไขแล้ว" });
    assert.equal(globalThis.__ADD_DOC_CALLS__.length, 0);
    const calls = globalThis.__UPDATE_DOC_CALLS__;
    assert.equal(calls.length, 1);
    assert.equal(calls[0].path, "faqs/faq-1");
    assert.equal("createdAt" in calls[0].payload, false);
  });

  test("deleteFaq: deleteDoc ที่ \"faqs/<id>\" ตรงๆ ครั้งเดียว, ไม่มีการเรียก getDoc/setDoc ใดๆ ตลอดทั้งไฟล์นี้", async () => {
    await deleteFaq("faq-2");
    const calls = globalThis.__DELETE_DOC_CALLS__;
    assert.equal(calls.length, 1);
    assert.equal(calls[0].path, "faqs/faq-2");
    assert.equal(globalThis.__SET_DOC_CALLS__.length, 0);
  });
});
