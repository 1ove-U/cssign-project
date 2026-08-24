// test/db-blog-crud-flow.test.mjs — รอบที่ 72
//
// ทดสอบ saveBlog()/deleteBlog() (js/db-blog.js) แบบเรียกฟังก์ชันจริงตรงๆ (ไม่ผ่าน UI form ใดๆ
// — แนวทาง data-layer เดียวกับ db-orders-crud-flow.test.mjs (รอบ 70) และ
// db-products-crud-flow.test.mjs (รอบ 71)) ยืนยันว่า payload ที่ถูกส่งเข้า addDoc()/updateDoc()/
// deleteDoc() จริง (ผ่าน firebase-stub-loader.mjs — ไม่ต้องแก้ stub เพิ่มเลยในรอบนี้เช่นเดียวกับรอบ
// 71 เพราะ saveBlog()/deleteBlog() ไม่มีการเรียก getDoc()/setDoc() เลยสักบรรทัด) ถูกต้องตรงตาม
// business logic ของแต่ละฟังก์ชันจริง — โครงสร้างคล้าย saveProduct()/deleteProduct() มาก แต่มี
// จุดต่างสำคัญที่ตรวจไว้ในไฟล์นี้ (อ่าน js/db-blog.js จริงก่อนเขียน ไม่ได้สมมติว่าเหมือน
// db-products.js เป๊ะตามที่เตือนไว้ใน NEXT-ROUND-PROMPT.txt ของรอบ 71):
//
// - saveBlog() ไม่มี item.id (บทความใหม่): addDoc() ที่ collection "blogs" พร้อม createdAt
//   **และ** updatedAt ทั้งคู่ (ต่างจาก saveProduct() ที่มีแค่ createdAt เพียงตัวเดียว)
// - saveBlog() มี item.id (แก้ไขบทความเดิม): updateDoc() ที่ "blogs/<id>" พร้อม updatedAt
//   เพิ่มเข้ามาใน payload ด้วย (ต่างจาก saveProduct() ที่ payload ตอนแก้ไขไม่มี timestamp field
//   ใดๆ เลย) แต่ไม่มี createdAt
// - author default เป็น "ทีมงาน CS.SIGN" เมื่อไม่ส่งมา (ไม่ใช่ "" เหมือน field string อื่นๆ)
// - status default เป็น "published" เมื่อไม่ส่งมา (ไม่ใช่ "active" แบบ products)
// - featured ถูกบังคับเป็น boolean จริงด้วย !!item.featured (ต่างจาก products ที่ส่ง
//   product.featured ตรงๆ ไม่แปลงชนิด)
// - metaTitle/metaDescription (มีแค่ 2 ฟิลด์ ไม่ใช่ 3 เหมือน products เพราะ slug ของ blog ไม่มี
//   fallback "" — ส่ง item.slug ตรงๆ) ตามคอมเมนต์ในโค้ดว่าเคยหายเงียบๆ มาก่อนเหมือนกับบั๊กใน
//   saveProduct()
// - deleteBlog(): deleteDoc() ที่ "blogs/<id>" ตรงๆ ไม่มี sync ไฟล์อื่นใดๆ
//
// รันด้วย: node --import ./test/helpers/register-loader.mjs --test
// test/db-blog-crud-flow.test.mjs

import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { saveBlog, deleteBlog } from "../js/db-blog.js";

// ── helper: ล้าง capture array ก่อนแต่ละเทสต์ (pattern เดียวกับรอบ 70/71) ──
function resetCalls() {
  globalThis.__ADD_DOC_CALLS__ = [];
  globalThis.__UPDATE_DOC_CALLS__ = [];
  globalThis.__DELETE_DOC_CALLS__ = [];
  globalThis.__SET_DOC_CALLS__ = [];
}

beforeEach(() => {
  resetCalls();
});

describe("saveBlog() — บทความใหม่ (ไม่มี id)", () => {
  test("addDoc ถูกเรียกที่ collection \"blogs\" พร้อม field ที่จำเป็นครบ + createdAt/updatedAt ทั้งคู่", async () => {
    await saveBlog({ title: "มาตรฐานป้ายเซฟตี้", slug: "safety-sign-standards" });
    const calls = globalThis.__ADD_DOC_CALLS__;
    assert.equal(calls.length, 1);
    assert.equal(calls[0].path, "blogs");
    assert.equal(calls[0].payload.title, "มาตรฐานป้ายเซฟตี้");
    assert.equal(calls[0].payload.slug, "safety-sign-standards");
    assert.equal(typeof calls[0].payload.createdAt, "number");
    assert.equal(typeof calls[0].payload.updatedAt, "number");
    assert.equal(globalThis.__UPDATE_DOC_CALLS__.length, 0);
  });

  test("field string ที่ไม่ส่งมา (excerpt/content/image/category) fallback เป็น \"\" ทั้งหมด", async () => {
    await saveBlog({ title: "บทความ A", slug: "post-a" });
    const payload = globalThis.__ADD_DOC_CALLS__[0].payload;
    assert.equal(payload.excerpt, "");
    assert.equal(payload.content, "");
    assert.equal(payload.image, "");
    assert.equal(payload.category, "");
  });

  test("author default เป็น \"ทีมงาน CS.SIGN\" เมื่อไม่ส่งมา, status default เป็น \"published\"", async () => {
    await saveBlog({ title: "บทความ B", slug: "post-b" });
    const payload = globalThis.__ADD_DOC_CALLS__[0].payload;
    assert.equal(payload.author, "ทีมงาน CS.SIGN");
    assert.equal(payload.status, "published");
  });

  test("author/status ที่ส่งมาจริงจะไม่ถูกทับด้วยค่า default (เช่น status=\"draft\")", async () => {
    await saveBlog({ title: "บทความ C", slug: "post-c", author: "สมชาย", status: "draft" });
    const payload = globalThis.__ADD_DOC_CALLS__[0].payload;
    assert.equal(payload.author, "สมชาย");
    assert.equal(payload.status, "draft");
  });

  test("featured ถูกบังคับเป็น boolean จริงด้วย !! (truthy string/number → true, undefined → false)", async () => {
    await saveBlog({ title: "บทความ D", slug: "post-d", featured: "yes" });
    assert.equal(globalThis.__ADD_DOC_CALLS__[0].payload.featured, true);

    resetCalls();
    await saveBlog({ title: "บทความ E", slug: "post-e" });
    assert.equal(globalThis.__ADD_DOC_CALLS__[0].payload.featured, false);

    resetCalls();
    await saveBlog({ title: "บทความ F", slug: "post-f", featured: 0 });
    assert.equal(globalThis.__ADD_DOC_CALLS__[0].payload.featured, false);
  });

  test("metaTitle/metaDescription ถูกใส่เข้า payload จริง (2 ฟิลด์ที่เคยหายเงียบๆ ตามคอมเมนต์ในโค้ด) — ทั้งกรณีส่งค่ามาและกรณี fallback \"\"", async () => {
    await saveBlog({ title: "บทความ G", slug: "post-g", metaTitle: "G Title", metaDescription: "G Desc" });
    const payload1 = globalThis.__ADD_DOC_CALLS__[0].payload;
    assert.equal(payload1.metaTitle, "G Title");
    assert.equal(payload1.metaDescription, "G Desc");

    resetCalls();
    await saveBlog({ title: "บทความ H", slug: "post-h" });
    const payload2 = globalThis.__ADD_DOC_CALLS__[0].payload;
    assert.equal(payload2.metaTitle, "");
    assert.equal(payload2.metaDescription, "");
  });
});

describe("saveBlog() — แก้ไขบทความเดิม (มี id)", () => {
  test("updateDoc ถูกเรียกที่ \"blogs/<id>\" แทน addDoc, payload มี updatedAt แต่ไม่มี createdAt", async () => {
    await saveBlog({ id: "blog-1", title: "บทความแก้ไขแล้ว", slug: "post-edited", status: "draft" });
    assert.equal(globalThis.__ADD_DOC_CALLS__.length, 0);
    const calls = globalThis.__UPDATE_DOC_CALLS__;
    assert.equal(calls.length, 1);
    assert.equal(calls[0].path, "blogs/blog-1");
    assert.equal(calls[0].payload.title, "บทความแก้ไขแล้ว");
    assert.equal(calls[0].payload.status, "draft");
    assert.equal(typeof calls[0].payload.updatedAt, "number");
    assert.equal("createdAt" in calls[0].payload, false);
  });
});

describe("deleteBlog()", () => {
  test("deleteDoc ถูกเรียกที่ \"blogs/<id>\" ตรงๆ ครั้งเดียว ไม่มีการเรียก getDoc/setDoc ใดๆ", async () => {
    await deleteBlog("blog-2");
    const calls = globalThis.__DELETE_DOC_CALLS__;
    assert.equal(calls.length, 1);
    assert.equal(calls[0].path, "blogs/blog-2");
    assert.equal(globalThis.__SET_DOC_CALLS__.length, 0);
  });
});
