// test/orders-tab-filters.test.mjs
//
// Unit test สำหรับ filterOrders() ที่ js/orders-tab-filters.js — แยกออกมาจาก render()
// ของ js/orders-tab.js ตั้งแต่รอบที่ 33 (ดูคอมเมนต์หัวไฟล์ทั้งสอง) เป็น pure function
// ล้วนๆ ไม่มี import Firebase/แตะ DOM เลย จึงไม่ต้องพึ่ง firebase-stub-loader.mjs เหมือน
// test/db-pure-functions.test.mjs (import ตรงๆ ได้ ปล่อยให้ผ่าน --import ร่วมกันไม่มีผลกระทบ)
//
// รันด้วย: npm test (รวมอยู่ใน test/**/*.test.mjs ตาม package.json อยู่แล้ว)

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { filterOrders } from "../js/orders-tab-filters.js";

// ── helper: สร้างวันที่ในรูปแบบ "YYYY-MM-DD" ห่างจากวันนี้ N วัน (ใช้ทดสอบ jumpFilter) ──
function dateOffset(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

describe("filterOrders", () => {
  test("ไม่ใส่ตัวกรองอะไรเลย คืนค่าทุกรายการตามลำดับเดิม", () => {
    const orders = [{ id: "1" }, { id: "2" }, { id: "3" }];
    const result = filterOrders(orders);
    assert.deepEqual(result.map(o => o.id), ["1", "2", "3"]);
  });

  test("ไม่แก้ไข array ต้นฉบับ (คืน array ใหม่เสมอ)", () => {
    const orders = [{ id: "1" }, { id: "2" }];
    const result = filterOrders(orders, { statusFilterValue: "production" });
    assert.notEqual(result, orders);
    assert.equal(orders.length, 2); // ต้นฉบับไม่ถูกแก้ไข
  });

  test("excludeIds ตัดรายการที่ id ตรงกันออกก่อนกรองอื่นๆ (ใช้กรณีรอ 'เลิกทำ' หลังลบ)", () => {
    const orders = [{ id: "1" }, { id: "2" }, { id: "3" }];
    const result = filterOrders(orders, { excludeIds: new Set(["2"]) });
    assert.deepEqual(result.map(o => o.id), ["1", "3"]);
  });

  test("searchTerm เทียบกับ code/customer/item แบบไม่สนตัวพิมพ์เล็ก-ใหญ่", () => {
    const orders = [
      { id: "1", code: "PO-001", customer: "สมชาย", item: "ป้ายไฟ" },
      { id: "2", code: "PO-002", customer: "Somsak", item: "สติกเกอร์" },
    ];
    assert.deepEqual(filterOrders(orders, { searchTerm: "somsak" }).map(o => o.id), ["2"]);
    assert.deepEqual(filterOrders(orders, { searchTerm: "สมชาย" }).map(o => o.id), ["1"]);
    assert.deepEqual(filterOrders(orders, { searchTerm: "  po-001  " }).map(o => o.id), ["1"]); // trim ช่องว่างหัวท้ายก่อนเทียบ
  });

  test("searchTerm ว่างเปล่า (หรือมีแต่ช่องว่าง) ไม่กรองอะไรเลย", () => {
    const orders = [{ id: "1", code: "A" }, { id: "2", code: "B" }];
    assert.equal(filterOrders(orders, { searchTerm: "" }).length, 2);
    assert.equal(filterOrders(orders, { searchTerm: "   " }).length, 2);
    assert.equal(filterOrders(orders).length, 2);
  });

  test("statusFilterValue กรองเฉพาะสถานะที่ตรงกัน, ค่าว่าง = ทุกสถานะ", () => {
    const orders = [
      { id: "1", status: "production" },
      { id: "2", status: "completed" },
    ];
    assert.deepEqual(filterOrders(orders, { statusFilterValue: "completed" }).map(o => o.id), ["2"]);
    assert.equal(filterOrders(orders, { statusFilterValue: "" }).length, 2);
  });

  test("jumpFilter 'duesoon'/'overdue' ใช้ orderUrgency() จริงกรอง (ไม่ใช่แค่เทียบ field ตรงๆ)", () => {
    const orders = [
      { id: "overdue-order", status: "production", dueDate: dateOffset(-3) },
      { id: "duesoon-order", status: "production", dueDate: dateOffset(1) },
      { id: "safe-order", status: "production", dueDate: dateOffset(10) },
      { id: "done-order", status: "completed", dueDate: dateOffset(-5) }, // เสร็จแล้ว ไม่นับ
    ];
    assert.deepEqual(filterOrders(orders, { jumpFilter: "overdue" }).map(o => o.id), ["overdue-order"]);
    assert.deepEqual(filterOrders(orders, { jumpFilter: "duesoon" }).map(o => o.id), ["duesoon-order"]);
  });

  test("mineOnly กรองเฉพาะ assignee ตรงกับ currentUserUid, ไม่กรองถ้าไม่มี currentUserUid", () => {
    const orders = [
      { id: "1", assignee: "uid-A" },
      { id: "2", assignee: "uid-B" },
      { id: "3", assignee: null },
    ];
    assert.deepEqual(filterOrders(orders, { mineOnly: true, currentUserUid: "uid-A" }).map(o => o.id), ["1"]);
    // mineOnly = true แต่ไม่มี currentUserUid (ยังไม่ login) -> ไม่มีรายการไหนผ่านเลย (ตรงกับ
    // เดิมที่เช็ค auth.currentUser ก่อนเทียบ uid เสมอ)
    assert.deepEqual(filterOrders(orders, { mineOnly: true, currentUserUid: null }).map(o => o.id), []);
  });

  test("ตัวกรองหลายตัวรวมกัน (AND ทั้งหมด) ตามลำดับเดียวกับของเดิมใน render()", () => {
    const orders = [
      { id: "1", code: "PO-001", status: "production", assignee: "uid-A", dueDate: dateOffset(1) },
      { id: "2", code: "PO-002", status: "production", assignee: "uid-A", dueDate: dateOffset(10) },
      { id: "3", code: "PO-003", status: "completed", assignee: "uid-A", dueDate: dateOffset(1) },
    ];
    const result = filterOrders(orders, {
      statusFilterValue: "production",
      jumpFilter: "duesoon",
      mineOnly: true,
      currentUserUid: "uid-A",
    });
    assert.deepEqual(result.map(o => o.id), ["1"]);
  });
});
