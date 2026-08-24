// test/db-products-crud-flow.test.mjs — รอบที่ 71
//
// ทดสอบ saveProduct()/deleteProduct() (js/db-products.js) แบบเรียกฟังก์ชันจริงตรงๆ
// (ไม่ผ่าน UI form ใดๆ — เหมือนแนวทาง data-layer ที่เลือกใช้ตั้งแต่รอบ 70 สำหรับ orders)
// ยืนยันว่า payload ที่ถูกส่งเข้า addDoc()/updateDoc()/deleteDoc() จริง (ผ่าน
// firebase-stub-loader.mjs — ไม่ต้องแก้ stub เพิ่มเลยในรอบนี้ เพราะ addDoc()/updateDoc()/
// deleteDoc() ถูก capture ไว้ตั้งแต่รอบ 68/70 แล้ว และ saveProduct()/deleteProduct() ไม่มีการ
// เรียก getDoc()/setDoc() เลยสักบรรทัด — ต่างจาก db-orders.js ที่ต้องอ่าน existing document
// ก่อนเพื่อ sync order_tracking) ถูกต้องตรงตาม business logic ของแต่ละฟังก์ชันจริง — ครอบคลุม:
//
// - saveProduct() ไม่มี product.id (สินค้าใหม่): addDoc() ที่ collection "products" พร้อม
//   createdAt เพิ่มเข้ามา, field ที่เป็น "" เมื่อไม่ส่งมา (code/material/size), field ที่เป็น []
//   เมื่อไม่ส่งมา (optionAxes/variants/tags/images), field ที่เป็น "" เมื่อไม่ส่งมา
//   (slug/metaTitle/metaDescription — 3 ฟิลด์นี้ระบุไว้ในคอมเมนต์โค้ดว่าเคยหายเงียบๆ มาก่อน)
// - saveProduct() มี product.id (แก้ไขสินค้าเดิม): updateDoc() ที่ "products/<id>" (ไม่มี
//   createdAt ใน payload เพราะเป็นการแก้ไข ไม่ใช่สร้างใหม่) และไม่เรียก addDoc() เลย
// - deleteProduct(): deleteDoc() ที่ "products/<id>" ตรงๆ (ไม่มี sync ไฟล์อื่นใดๆ ต่างจาก
//   deleteOrder() ที่ต้องลบ order_tracking คู่กันด้วย)
//
// รันด้วย: node --import ./test/helpers/register-loader.mjs --test
// test/db-products-crud-flow.test.mjs

import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { saveProduct, deleteProduct } from "../js/db-products.js";

// ── helper: ล้าง capture array ก่อนแต่ละเทสต์ (pattern เดียวกับ resetCalls() ของ
// test/db-orders-crud-flow.test.mjs รอบ 70) ──
function resetCalls() {
  globalThis.__ADD_DOC_CALLS__ = [];
  globalThis.__UPDATE_DOC_CALLS__ = [];
  globalThis.__DELETE_DOC_CALLS__ = [];
  globalThis.__SET_DOC_CALLS__ = [];
}

beforeEach(() => {
  resetCalls();
});

describe("saveProduct() — สินค้าใหม่ (ไม่มี id)", () => {
  test("addDoc ถูกเรียกที่ collection \"products\" พร้อม field ที่จำเป็นครบ + createdAt", async () => {
    await saveProduct({
      cat_id: "cat-1", name: "ป้ายเตือนไฟฟ้าแรงสูง", price: 250, unit: "แผ่น",
      description: "ป้ายอะคริลิก", status: "active", featured: false
    });
    const calls = globalThis.__ADD_DOC_CALLS__;
    assert.equal(calls.length, 1);
    assert.equal(calls[0].path, "products");
    assert.equal(calls[0].payload.cat_id, "cat-1");
    assert.equal(calls[0].payload.name, "ป้ายเตือนไฟฟ้าแรงสูง");
    assert.equal(calls[0].payload.price, 250);
    assert.equal(calls[0].payload.status, "active");
    assert.equal(typeof calls[0].payload.createdAt, "number");
    assert.equal(globalThis.__UPDATE_DOC_CALLS__.length, 0);
  });

  test("field ที่ไม่ส่งมา (code/material/size) fallback เป็น \"\" ทั้งหมด", async () => {
    await saveProduct({ cat_id: "cat-1", name: "ป้าย A", price: 100, unit: "แผ่น", description: "x", status: "active", featured: false });
    const payload = globalThis.__ADD_DOC_CALLS__[0].payload;
    assert.equal(payload.code, "");
    assert.equal(payload.material, "");
    assert.equal(payload.size, "");
  });

  test("field แบบ array (optionAxes/variants/tags/images) ที่ไม่ส่งมา fallback เป็น [] ทั้งหมด", async () => {
    await saveProduct({ cat_id: "cat-1", name: "ป้าย B", price: 100, unit: "แผ่น", description: "x", status: "active", featured: false });
    const payload = globalThis.__ADD_DOC_CALLS__[0].payload;
    assert.deepEqual(payload.optionAxes, []);
    assert.deepEqual(payload.variants, []);
    assert.deepEqual(payload.tags, []);
    assert.deepEqual(payload.images, []);
  });

  test("slug/metaTitle/metaDescription ถูกใส่เข้า payload จริง (3 ฟิลด์ที่เคยหายเงียบๆ ตามคอมเมนต์ในโค้ด) — ทั้งกรณีส่งค่ามาและกรณี fallback \"\"", async () => {
    await saveProduct({
      cat_id: "cat-1", name: "ป้าย C", price: 100, unit: "แผ่น", description: "x",
      status: "active", featured: false,
      slug: "pai-c", metaTitle: "Pai C Title", metaDescription: "Pai C Desc"
    });
    const payload1 = globalThis.__ADD_DOC_CALLS__[0].payload;
    assert.equal(payload1.slug, "pai-c");
    assert.equal(payload1.metaTitle, "Pai C Title");
    assert.equal(payload1.metaDescription, "Pai C Desc");

    resetCalls();
    await saveProduct({ cat_id: "cat-1", name: "ป้าย D", price: 100, unit: "แผ่น", description: "x", status: "active", featured: false });
    const payload2 = globalThis.__ADD_DOC_CALLS__[0].payload;
    assert.equal(payload2.slug, "");
    assert.equal(payload2.metaTitle, "");
    assert.equal(payload2.metaDescription, "");
  });

  test("optionAxes/variants ที่ส่งมาจริง (สินค้าแบบมีตัวเลือก) ถูกส่งเข้า payload ตรงๆ ไม่ถูกคำนวณซ้ำ", async () => {
    const optionAxes = [{ id: "size", label: "ขนาด", options: ["30x40", "50x60"] }];
    const variants = [{ combo: ["30x40"], price: 150 }, { combo: ["50x60"], price: 300 }];
    await saveProduct({
      cat_id: "cat-1", name: "ป้ายมีตัวเลือก", price: 150, unit: "แผ่น", description: "x",
      status: "active", featured: true, optionAxes, variants
    });
    const payload = globalThis.__ADD_DOC_CALLS__[0].payload;
    assert.deepEqual(payload.optionAxes, optionAxes);
    assert.deepEqual(payload.variants, variants);
    assert.equal(payload.price, 150); // ราคาต่ำสุดที่คำนวณมาจากฝั่ง admin แล้ว ไม่ถูกแก้ซ้ำ
  });
});

describe("saveProduct() — แก้ไขสินค้าเดิม (มี id)", () => {
  test("updateDoc ถูกเรียกที่ \"products/<id>\" แทน addDoc, payload ไม่มี createdAt", async () => {
    await saveProduct({
      id: "prod-1", cat_id: "cat-1", name: "ป้ายแก้ไขแล้ว", price: 300, unit: "แผ่น",
      description: "แก้ไขคำอธิบาย", status: "inactive", featured: true
    });
    assert.equal(globalThis.__ADD_DOC_CALLS__.length, 0);
    const calls = globalThis.__UPDATE_DOC_CALLS__;
    assert.equal(calls.length, 1);
    assert.equal(calls[0].path, "products/prod-1");
    assert.equal(calls[0].payload.name, "ป้ายแก้ไขแล้ว");
    assert.equal(calls[0].payload.status, "inactive");
    assert.equal(calls[0].payload.featured, true);
    assert.equal("createdAt" in calls[0].payload, false);
  });
});

describe("deleteProduct()", () => {
  test("deleteDoc ถูกเรียกที่ \"products/<id>\" ตรงๆ ครั้งเดียว ไม่มีการเรียก getDoc/setDoc ใดๆ (ต่างจาก deleteOrder ที่ต้อง sync order_tracking)", async () => {
    await deleteProduct("prod-2");
    const calls = globalThis.__DELETE_DOC_CALLS__;
    assert.equal(calls.length, 1);
    assert.equal(calls[0].path, "products/prod-2");
    assert.equal(globalThis.__SET_DOC_CALLS__.length, 0);
  });
});
