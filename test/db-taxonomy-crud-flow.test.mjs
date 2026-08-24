// test/db-taxonomy-crud-flow.test.mjs — รอบที่ 74
//
// ทดสอบ saveGroup()/deleteGroup()/saveCategory()/deleteCategory()/migrateLegacyGroups()
// (js/db-taxonomy.js) แบบเรียกฟังก์ชันจริงตรงๆ (ไม่ผ่าน UI form ใดๆ — แนวทาง data-layer
// เดียวกับ db-orders/db-products/db-blog/db-content-crud-flow.test.mjs รอบ 70-73) ยืนยันว่า
// payload ที่ถูกส่งเข้า addDoc()/updateDoc()/deleteDoc() จริง (ผ่าน firebase-stub-loader.mjs —
// ไม่ต้องแก้ stub เพิ่มเลยในรอบนี้เช่นเดียวกับรอบ 71-73 เพราะทั้ง 5 ฟังก์ชันในไฟล์นี้ไม่มีการ
// เรียก getDoc()/setDoc() เลยสักบรรทัด) ถูกต้องตรงตาม business logic จริง — จุดต่างสำคัญที่
// ตรวจไว้ในไฟล์นี้ (อ่าน js/db-taxonomy.js จริงก่อนเขียน ไม่ได้สมมติว่าเหมือนไฟล์ data-layer อื่น):
//
// - saveGroup(): order fallback ด้วย **`??` (nullish coalescing)** ไม่ใช่ `||` แบบธรรมดา
//   หรือ Number.isFinite() แบบ portfolio.order — หมายความว่า order: 0 จะ "ไม่"
//   ถูกทับด้วย Date.now() (ต่างจาก || ที่จะทับ 0 เพราะ 0 เป็น falsy) — จุดสำคัญที่สุดของไฟล์นี้
// - saveGroup(): icon fallback "" ด้วย || ธรรมดา
// - saveCategory(): name/icon/description ไม่มี fallback เลย ส่งค่าตรงๆ ทั้ง 3 ฟิลด์ (เหมือน
//   saveFaq() ของ db-content.js รอบ 73) แต่ group_id/group fallback "" ด้วย || ธรรมดา
// - saveGroup()/saveCategory() ทั้งคู่: ใหม่ → addDoc พร้อม createdAt เดียว (ไม่มี updatedAt
//   ต่างจาก saveBlog() ของรอบ 72), แก้ไข → updateDoc ไม่มี createdAt
// - migrateLegacyGroups(categories, groups): ไม่เรียก getDocs() เลย รับสอง array มาตรงๆ เป็น
//   param แทน (ต่างจากทุกฟังก์ชัน CRUD อื่นที่เจอมาตั้งแต่รอบ 70) เป็นฟังก์ชัน migrate ที่ผสม
//   ทั้ง addDoc() (สร้าง group ใหม่ถ้ายังไม่มีชื่อนี้) และ updateDoc() (ผูก category.group_id)
//   พร้อมกัน + mutate object ที่รับเข้ามาตรงๆ (cat.group_id = g.id) ซึ่งเป็นแพทเทิร์นที่ไม่เคยเจอ
//   ในไฟล์ data-layer อื่นมาก่อน — ทดสอบครบทั้ง: ไม่มีอะไรต้อง migrate, ชื่อกลุ่มใหม่ (ต้องสร้าง),
//   ชื่อกลุ่มซ้ำกับที่มีอยู่แล้ว (ต้องไม่สร้างซ้ำ), หลาย category ชื่อกลุ่มเดียวกัน (สร้างครั้งเดียว
//   ใช้ร่วมกัน + order เรียงถูก), การ trim() ชื่อกลุ่มก่อนเทียบ
//
// รันด้วย: node --import ./test/helpers/register-loader.mjs --test
// test/db-taxonomy-crud-flow.test.mjs

import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { saveGroup, deleteGroup, saveCategory, deleteCategory, migrateLegacyGroups }
  from "../js/db-taxonomy.js";

// ── helper: ล้าง capture array ก่อนแต่ละเทสต์ (pattern เดียวกับรอบ 70-73) ──
function resetCalls() {
  globalThis.__ADD_DOC_CALLS__ = [];
  globalThis.__UPDATE_DOC_CALLS__ = [];
  globalThis.__DELETE_DOC_CALLS__ = [];
  globalThis.__SET_DOC_CALLS__ = [];
}

beforeEach(() => {
  resetCalls();
});

describe("saveGroup() — กลุ่มใหม่ (ไม่มี id)", () => {
  test("addDoc ถูกเรียกที่ collection \"groups\" พร้อม createdAt, ไม่มี updateDoc", async () => {
    await saveGroup({ name: "ป้ายเซฟตี้" });
    const calls = globalThis.__ADD_DOC_CALLS__;
    assert.equal(calls.length, 1);
    assert.equal(calls[0].path, "groups");
    assert.equal(calls[0].payload.name, "ป้ายเซฟตี้");
    assert.equal(typeof calls[0].payload.createdAt, "number");
    assert.equal(globalThis.__UPDATE_DOC_CALLS__.length, 0);
  });

  test("icon fallback เป็น \"\" ด้วย || ธรรมดา เมื่อไม่ส่งมา, ค่าที่ส่งมาจริงไม่ถูกทับ", async () => {
    await saveGroup({ name: "กลุ่ม A" });
    assert.equal(globalThis.__ADD_DOC_CALLS__[0].payload.icon, "");

    resetCalls();
    await saveGroup({ name: "กลุ่ม B", icon: "icon-b.svg" });
    assert.equal(globalThis.__ADD_DOC_CALLS__[0].payload.icon, "icon-b.svg");
  });

  test("order fallback เป็น Date.now() (number) เมื่อไม่ส่งมาเลย (undefined)", async () => {
    await saveGroup({ name: "กลุ่ม C" });
    assert.equal(typeof globalThis.__ADD_DOC_CALLS__[0].payload.order, "number");
  });

  test("order: 0 ต้อง \"ไม่\" ถูกทับด้วย Date.now() เพราะใช้ ?? (nullish) ไม่ใช่ || — จุดสำคัญที่สุดของไฟล์นี้", async () => {
    await saveGroup({ name: "กลุ่ม D", order: 0 });
    assert.equal(globalThis.__ADD_DOC_CALLS__[0].payload.order, 0);
  });

  test("order ที่เป็น null/undefined ชัดเจน → fallback เป็น Date.now(), ส่วน order ปกติที่ส่งมาไม่ถูกทับ", async () => {
    await saveGroup({ name: "กลุ่ม E", order: null });
    assert.equal(typeof globalThis.__ADD_DOC_CALLS__[0].payload.order, "number");
    assert.notEqual(globalThis.__ADD_DOC_CALLS__[0].payload.order, null);

    resetCalls();
    await saveGroup({ name: "กลุ่ม F", order: 7 });
    assert.equal(globalThis.__ADD_DOC_CALLS__[0].payload.order, 7);
  });
});

describe("saveGroup() — แก้ไขกลุ่มเดิม (มี id)", () => {
  test("updateDoc ถูกเรียกที่ \"groups/<id>\" แทน addDoc, payload ไม่มี createdAt", async () => {
    await saveGroup({ id: "group-1", name: "กลุ่มแก้ไขแล้ว", icon: "new.svg", order: 3 });
    assert.equal(globalThis.__ADD_DOC_CALLS__.length, 0);
    const calls = globalThis.__UPDATE_DOC_CALLS__;
    assert.equal(calls.length, 1);
    assert.equal(calls[0].path, "groups/group-1");
    assert.equal(calls[0].payload.name, "กลุ่มแก้ไขแล้ว");
    assert.equal(calls[0].payload.icon, "new.svg");
    assert.equal(calls[0].payload.order, 3);
    assert.equal("createdAt" in calls[0].payload, false);
  });
});

describe("deleteGroup()", () => {
  test("deleteDoc ถูกเรียกที่ \"groups/<id>\" ตรงๆ ครั้งเดียว", async () => {
    await deleteGroup("group-2");
    const calls = globalThis.__DELETE_DOC_CALLS__;
    assert.equal(calls.length, 1);
    assert.equal(calls[0].path, "groups/group-2");
  });
});

describe("saveCategory() — หมวดหมู่ใหม่ (ไม่มี id)", () => {
  test("addDoc ถูกเรียกที่ collection \"categories\" พร้อม createdAt, name/icon/description ส่งตรงๆ ไม่มี fallback", async () => {
    await saveCategory({ name: "ป้ายจราจร", icon: "traffic.svg", description: "หมวดป้ายจราจร" });
    const calls = globalThis.__ADD_DOC_CALLS__;
    assert.equal(calls.length, 1);
    assert.equal(calls[0].path, "categories");
    assert.equal(calls[0].payload.name, "ป้ายจราจร");
    assert.equal(calls[0].payload.icon, "traffic.svg");
    assert.equal(calls[0].payload.description, "หมวดป้ายจราจร");
    assert.equal(typeof calls[0].payload.createdAt, "number");
  });

  test("icon/description ที่ไม่ส่งมาเลยกลายเป็น undefined ตรงๆ (ไม่มี fallback ใดๆ ในโค้ด)", async () => {
    await saveCategory({ name: "หมวด B" });
    const payload = globalThis.__ADD_DOC_CALLS__[0].payload;
    assert.equal(payload.icon, undefined);
    assert.equal(payload.description, undefined);
  });

  test("group_id/group fallback \"\" ด้วย || ธรรมดา เมื่อไม่ส่งมา, ค่าที่ส่งมาจริงไม่ถูกทับ", async () => {
    await saveCategory({ name: "หมวด C" });
    const payload1 = globalThis.__ADD_DOC_CALLS__[0].payload;
    assert.equal(payload1.group_id, "");
    assert.equal(payload1.group, "");

    resetCalls();
    await saveCategory({ name: "หมวด D", group_id: "group-9", group: "หัวข้อ D" });
    const payload2 = globalThis.__ADD_DOC_CALLS__[0].payload;
    assert.equal(payload2.group_id, "group-9");
    assert.equal(payload2.group, "หัวข้อ D");
  });
});

describe("saveCategory() — แก้ไขหมวดหมู่เดิม (มี id)", () => {
  test("updateDoc ถูกเรียกที่ \"categories/<id>\" แทน addDoc, payload ไม่มี createdAt", async () => {
    await saveCategory({ id: "cat-1", name: "หมวดแก้ไขแล้ว", group_id: "group-1", group: "กลุ่ม A" });
    assert.equal(globalThis.__ADD_DOC_CALLS__.length, 0);
    const calls = globalThis.__UPDATE_DOC_CALLS__;
    assert.equal(calls.length, 1);
    assert.equal(calls[0].path, "categories/cat-1");
    assert.equal(calls[0].payload.name, "หมวดแก้ไขแล้ว");
    assert.equal(calls[0].payload.group_id, "group-1");
    assert.equal("createdAt" in calls[0].payload, false);
  });
});

describe("deleteCategory()", () => {
  test("deleteDoc ถูกเรียกที่ \"categories/<id>\" ตรงๆ ครั้งเดียว, ไม่มี addDoc/updateDoc/setDoc ใดๆ", async () => {
    await deleteCategory("cat-2");
    const calls = globalThis.__DELETE_DOC_CALLS__;
    assert.equal(calls.length, 1);
    assert.equal(calls[0].path, "categories/cat-2");
    assert.equal(globalThis.__SET_DOC_CALLS__.length, 0);
  });
});

describe("migrateLegacyGroups() — ไม่มีอะไรต้อง migrate", () => {
  test("category ทุกตัวมี group_id อยู่แล้ว → คืน migrated:0, groups เดิม (reference เดิม), ไม่มี addDoc/updateDoc", async () => {
    const groups = [{ id: "g1", name: "กลุ่ม A", icon: "", order: 0 }];
    const categories = [{ id: "c1", name: "หมวด A", group_id: "g1", group: "กลุ่ม A" }];
    const result = await migrateLegacyGroups(categories, groups);
    assert.equal(result.migrated, 0);
    assert.equal(result.groups, groups);
    assert.equal(globalThis.__ADD_DOC_CALLS__.length, 0);
    assert.equal(globalThis.__UPDATE_DOC_CALLS__.length, 0);
  });

  test("category ไม่มี group_id แต่ค่า group เป็นค่าว่าง/whitespace ล้วน → ไม่ถือว่า pending", async () => {
    const groups = [];
    const categories = [{ id: "c1", name: "หมวด A", group_id: "", group: "   " }];
    const result = await migrateLegacyGroups(categories, groups);
    assert.equal(result.migrated, 0);
    assert.equal(globalThis.__ADD_DOC_CALLS__.length, 0);
  });
});

describe("migrateLegacyGroups() — ต้องสร้างกลุ่มใหม่", () => {
  test("category ไม่มี group_id, ชื่อ group ยังไม่มีในกลุ่มเดิม → addDoc สร้างกลุ่มใหม่ + updateDoc ผูก group_id + mutate cat.group_id", async () => {
    const groups = [];
    const categories = [{ id: "c1", name: "หมวด A", group_id: "", group: "หัวข้อใหม่" }];
    const result = await migrateLegacyGroups(categories, groups);

    assert.equal(result.migrated, 1);
    assert.equal(globalThis.__ADD_DOC_CALLS__.length, 1);
    assert.equal(globalThis.__ADD_DOC_CALLS__[0].path, "groups");
    assert.equal(globalThis.__ADD_DOC_CALLS__[0].payload.name, "หัวข้อใหม่");
    assert.equal(globalThis.__ADD_DOC_CALLS__[0].payload.order, 0);

    assert.equal(globalThis.__UPDATE_DOC_CALLS__.length, 1);
    assert.equal(globalThis.__UPDATE_DOC_CALLS__[0].path, "categories/c1");
    assert.equal(globalThis.__UPDATE_DOC_CALLS__[0].payload.group_id, "stub-id");

    // mutate object เดิมตรงๆ
    assert.equal(categories[0].group_id, "stub-id");
    // groups ที่คืนมาต้องมีกลุ่มใหม่เพิ่มเข้าไป
    assert.equal(result.groups.length, 1);
    assert.equal(result.groups[0].name, "หัวข้อใหม่");
  });

  test("ชื่อ group ตรงกับกลุ่มที่มีอยู่แล้วเป๊ะ (หลัง trim) → ใช้กลุ่มเดิม ไม่สร้างซ้ำ", async () => {
    const groups = [{ id: "g-existing", name: "หัวข้อเดิม", icon: "", order: 0 }];
    const categories = [{ id: "c1", name: "หมวด A", group_id: "", group: "  หัวข้อเดิม  " }];
    const result = await migrateLegacyGroups(categories, groups);

    assert.equal(result.migrated, 1);
    assert.equal(globalThis.__ADD_DOC_CALLS__.length, 0, "ไม่ควรสร้างกลุ่มใหม่เพราะชื่อตรงกับที่มีอยู่แล้ว");
    assert.equal(globalThis.__UPDATE_DOC_CALLS__.length, 1);
    assert.equal(globalThis.__UPDATE_DOC_CALLS__[0].payload.group_id, "g-existing");
    assert.equal(categories[0].group_id, "g-existing");
  });

  test("หลาย category ชื่อกลุ่มเดียวกัน (ยังไม่มีกลุ่มเดิม) → สร้างกลุ่มแค่ครั้งเดียว ใช้ร่วมกันทั้งสอง category", async () => {
    const groups = [];
    const categories = [
      { id: "c1", name: "หมวด A", group_id: "", group: "หัวข้อร่วม" },
      { id: "c2", name: "หมวด B", group_id: "", group: "หัวข้อร่วม" }
    ];
    const result = await migrateLegacyGroups(categories, groups);

    assert.equal(result.migrated, 2);
    assert.equal(globalThis.__ADD_DOC_CALLS__.length, 1, "สร้างกลุ่มแค่ครั้งเดียว แม้มี 2 category ชื่อกลุ่มเดียวกัน");
    assert.equal(globalThis.__UPDATE_DOC_CALLS__.length, 2);
    assert.equal(categories[0].group_id, "stub-id");
    assert.equal(categories[1].group_id, "stub-id");
    assert.equal(result.groups.length, 1);
  });

  test("กลุ่มใหม่หลายชื่อต่างกัน → order เรียงต่อจาก groups.length เดิมตามลำดับที่สร้าง", async () => {
    const groups = [{ id: "g0", name: "กลุ่มเดิม", icon: "", order: 0 }];
    const categories = [
      { id: "c1", name: "หมวด A", group_id: "", group: "หัวข้อใหม่ 1" },
      { id: "c2", name: "หมวด B", group_id: "", group: "หัวข้อใหม่ 2" }
    ];
    await migrateLegacyGroups(categories, groups);

    const addCalls = globalThis.__ADD_DOC_CALLS__;
    assert.equal(addCalls.length, 2);
    assert.equal(addCalls[0].payload.order, 1);
    assert.equal(addCalls[1].payload.order, 2);
  });
});
