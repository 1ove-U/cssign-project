// test/db-orders-getters.test.mjs — รอบที่ 150
//
// ขอบเขต: getLeads()/getOrders() (js/db-orders.js) — ตรวจ coverage จริงด้วย grep ทั้งโปรเจกต์
// (ไม่ใช่แค่เทียบชื่อไฟล์เทส ตามวินัยที่บันทึกไว้ตั้งแต่รอบ 148) พบว่าทั้งสองฟังก์ชัน **ไม่เคยถูก
// import/เรียกที่ไหนเลย** ไม่ว่าจะในไฟล์เทสใดๆ (grep "getLeads\b"/"getOrders\b" ทั่ว test/*.test.mjs
// = 0 จุด) หรือแม้แต่ในโค้ดผลิตภัณฑ์เอง (grep ทั่ว js/*.js เจอแค่ definition ของตัวเองกับคอมเมนต์
// อธิบายลำดับฟังก์ชันในรอบที่ 38 — ไม่มีไฟล์ไหน import ไปใช้จริง) — แอปใช้ listenLeads()/
// listenOrders() แบบ realtime listener แทนในทุกจุดที่ต้องอ่านรายการจริง (js/admin-page.js ผูก
// listener ไว้ตอน bootstrap) getLeads()/getOrders() แบบ one-shot ดูจะเป็นฟังก์ชันที่เตรียมไว้ให้
// เรียกครั้งเดียว (เช่น export/CSV/สคริปต์ฝั่ง server) แต่ยังไม่มีจุดเรียกใช้จริงในโค้ดปัจจุบัน —
// **ไม่ได้ตัดสินใจลบทิ้ง** ในรอบนี้ (ไม่ใช่ขอบเขตงาน "เขียนเทส" + policy ของโปรเจกต์คือรายงานเฉย ๆ
// ไม่ลบโค้ดเองโดยไม่มีคนสั่ง ดูตัวอย่างเดียวกันที่ check-dead-css.mjs ทำกับ CSS selector) — แค่เพิ่ม
// เทสตรงปิด coverage gap ที่เจอ
//
// ทั้งสองฟังก์ชันมี logic เหมือนกันเป๊ะกับ listenLeads()/listenOrders() ที่อยู่บรรทัดติดกัน (query
// เดียวกัน, orderBy("createdAt","desc") เดียวกัน) ต่างแค่ getDocs() ครั้งเดียวแทน onSnapshot()
// ต่อเนื่อง — ใช้ __GET_DOCS_STUB__ (ตั้งไว้ใน test/helpers/firebase-stub-loader.mjs ตั้งแต่รอบ 89)
// จำลอง Firestore คืนรายการตามที่ต้องการ แยกแยะ collection ด้วย ref.path ("leads" vs "orders" —
// ยืนยันจาก query()/collection() stub ที่คืน ref ทะลุผ่านมาเป็น {path} ตรงๆ)
//
// อ่าน js/db-orders.js เต็มไฟล์ก่อนเขียน (getLeads()/getOrders() เป็น pure wrapper รอบ
// getDocs(query(...)) ไม่มี business logic พิเศษอะไรอีก) — ไม่พบบั๊ก เทสนี้จึงเป็นแค่เทสยืนยัน
// พฤติกรรม (map d.id + d.data() เข้าด้วยกัน, query collection ถูกต้อง) ไม่มีการแก้โค้ดผลิตภัณฑ์เลย
//
// รันด้วย: node --import ./test/helpers/register-loader.mjs --test test/db-orders-getters.test.mjs

import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { getLeads, getOrders } from "../js/db-orders.js";

beforeEach(() => {
  globalThis.__GET_DOCS_STUB__ = undefined;
});

describe("getLeads()", () => {
  test("query collection \"leads\" ถูกต้อง + map d.id/d.data() เข้าด้วยกันเป็น array ปกติ", async () => {
    globalThis.__GET_DOCS_STUB__ = (ref) => {
      assert.equal(ref.path, "leads");
      return [
        { id: "lead-1", data: { customer: "EGAT", status: "new" } },
        { id: "lead-2", data: { customer: "การไฟฟ้า", status: "won" } }
      ];
    };
    const result = await getLeads();
    assert.equal(result.length, 2);
    assert.deepEqual(result[0], { id: "lead-1", customer: "EGAT", status: "new" });
    assert.deepEqual(result[1], { id: "lead-2", customer: "การไฟฟ้า", status: "won" });
  });

  test("ไม่มีเอกสารเลย (getDocs คืน docs ว่างตาม default ของ stub เมื่อไม่ตั้ง __GET_DOCS_STUB__) → คืน [] เปล่า ไม่ throw", async () => {
    // ไม่ตั้ง __GET_DOCS_STUB__ เลยในเทสนี้ (ยังคง undefined ตาม beforeEach) — ใช้ default
    // ของ stub (docs: []) ตรงๆ ตามคอมเมนต์ในไฟล์ firebase-stub-loader.mjs
    const result = await getLeads();
    assert.deepEqual(result, []);
  });

  test("เอกสารไม่มี field อื่นเลยนอกจาก id (data: {} เปล่า) → ไม่ throw คืน object ที่มีแค่ id", async () => {
    globalThis.__GET_DOCS_STUB__ = () => [{ id: "lead-empty", data: {} }];
    const result = await getLeads();
    assert.deepEqual(result, [{ id: "lead-empty" }]);
  });
});

describe("getOrders()", () => {
  test("query collection \"orders\" ถูกต้อง + map d.id/d.data() เข้าด้วยกันเป็น array ปกติ", async () => {
    globalThis.__GET_DOCS_STUB__ = (ref) => {
      assert.equal(ref.path, "orders");
      return [
        { id: "order-1", data: { code: "PO-001", status: "production" } },
        { id: "order-2", data: { code: "PO-002", status: "completed" } }
      ];
    };
    const result = await getOrders();
    assert.equal(result.length, 2);
    assert.deepEqual(result[0], { id: "order-1", code: "PO-001", status: "production" });
    assert.deepEqual(result[1], { id: "order-2", code: "PO-002", status: "completed" });
  });

  test("ไม่มีเอกสารเลย → คืน [] เปล่า ไม่ throw", async () => {
    const result = await getOrders();
    assert.deepEqual(result, []);
  });

  test("getLeads()/getOrders() เรียกติดกัน → __GET_DOCS_STUB__ ตัวเดียวกันแยกแยะ collection ได้ถูกต้องด้วย ref.path (กันเคส cache/state รั่วข้าม collection)", async () => {
    globalThis.__GET_DOCS_STUB__ = (ref) => {
      if (ref.path === "leads") return [{ id: "l1", data: { customer: "A" } }];
      if (ref.path === "orders") return [{ id: "o1", data: { code: "PO-999" } }];
      throw new Error(`unexpected collection path: ${ref.path}`);
    };
    const leads = await getLeads();
    const orders = await getOrders();
    assert.deepEqual(leads, [{ id: "l1", customer: "A" }]);
    assert.deepEqual(orders, [{ id: "o1", code: "PO-999" }]);
  });
});
