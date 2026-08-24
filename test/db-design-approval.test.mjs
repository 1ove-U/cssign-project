// test/db-design-approval.test.mjs — P0.2 (หน้าอนุมัติแบบ)
//
// ทดสอบ submitDesignApproval()/listDesignApprovals() (js/db-orders.js) แบบเรียกฟังก์ชันจริง
// ตรงๆ (pattern เดียวกับ test/db-orders-crud-flow.test.mjs) ยืนยันว่า:
// - submitDesignApproval(): addDoc ถูกเรียกที่ collection "design_approvals" พร้อม payload
//   ถูกต้อง (trackingId/action/comment/createdAt), validate action ต้องอยู่ใน whitelist,
//   validate trackingId ต้องมีค่า, comment ยาวเกิน 2000 ตัวอักษรถูกตัด (สอดคล้องกับ limit
//   ฝั่ง firestore.rules ใน match /design_approvals/{id})
// - listDesignApprovals(): getDocs ถูกเรียกที่ collection เดียวกัน, กรองเฉพาะ trackingId ที่ตรง,
//   trackingId ว่าง/ไม่มีค่า → คืน [] ทันทีไม่ query เลย
//
// รันด้วย: node --import ./test/helpers/register-loader.mjs --test test/db-design-approval.test.mjs

import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { submitDesignApproval, listDesignApprovals } from "../js/db-orders.js";

function resetCalls() {
  globalThis.__ADD_DOC_CALLS__ = [];
  globalThis.__GET_DOCS_STUB__ = undefined;
}

beforeEach(() => {
  resetCalls();
});

describe("submitDesignApproval()", () => {
  test("action='approved' → addDoc ถูกเรียกที่ collection \"design_approvals\" พร้อม payload ถูกต้อง", async () => {
    await submitDesignApproval("PO001_1234", "approved", "");
    const calls = globalThis.__ADD_DOC_CALLS__;
    assert.equal(calls.length, 1);
    assert.equal(calls[0].path, "design_approvals");
    assert.equal(calls[0].payload.trackingId, "PO001_1234");
    assert.equal(calls[0].payload.action, "approved");
    assert.equal(calls[0].payload.comment, "");
    assert.ok("createdAt" in calls[0].payload);
  });

  test("action='changes_requested' พร้อม comment → payload มี comment ตรงตามที่ส่งมา", async () => {
    await submitDesignApproval("PO002_5678", "changes_requested", "ขอเปลี่ยนสีพื้นหลังเป็นสีฟ้า");
    const payload = globalThis.__ADD_DOC_CALLS__[0].payload;
    assert.equal(payload.action, "changes_requested");
    assert.equal(payload.comment, "ขอเปลี่ยนสีพื้นหลังเป็นสีฟ้า");
  });

  test("comment ยาวเกิน 2000 ตัวอักษร ถูกตัดเหลือ 2000 พอดี (สอดคล้อง limit ใน firestore.rules)", async () => {
    const longComment = "x".repeat(3000);
    await submitDesignApproval("PO003_1111", "changes_requested", longComment);
    const payload = globalThis.__ADD_DOC_CALLS__[0].payload;
    assert.equal(payload.comment.length, 2000);
  });

  test("comment ไม่ได้ส่งมาเลย (undefined) → fallback เป็น \"\" ไม่ throw", async () => {
    await submitDesignApproval("PO004_2222", "approved");
    assert.equal(globalThis.__ADD_DOC_CALLS__[0].payload.comment, "");
  });

  test("action ไม่อยู่ใน whitelist → throw ทันที ไม่เรียก addDoc เลย", async () => {
    await assert.rejects(
      () => submitDesignApproval("PO005_3333", "maybe_later"),
      /action/
    );
    assert.equal(globalThis.__ADD_DOC_CALLS__.length, 0);
  });

  test("trackingId ว่าง/undefined → throw ทันที ไม่เรียก addDoc เลย", async () => {
    await assert.rejects(() => submitDesignApproval("", "approved"), /trackingId/);
    await assert.rejects(() => submitDesignApproval(undefined, "approved"), /trackingId/);
    assert.equal(globalThis.__ADD_DOC_CALLS__.length, 0);
  });
});

describe("listDesignApprovals()", () => {
  test("trackingId ว่าง/undefined → คืน [] ทันที ไม่เรียก getDocs เลย", async () => {
    let getDocsCalled = false;
    globalThis.__GET_DOCS_STUB__ = () => { getDocsCalled = true; return []; };
    assert.deepEqual(await listDesignApprovals(""), []);
    assert.deepEqual(await listDesignApprovals(undefined), []);
    assert.equal(getDocsCalled, false);
  });

  test("getDocs คืนหลาย doc ปนกันหลาย trackingId → กรองเหลือเฉพาะที่ตรงกับที่ขอเท่านั้น", async () => {
    globalThis.__GET_DOCS_STUB__ = () => [
      { id: "a1", data: { trackingId: "PO010_4444", action: "approved", comment: "", createdAt: "2026-08-01" } },
      { id: "a2", data: { trackingId: "PO999_0000", action: "approved", comment: "", createdAt: "2026-08-01" } },
      { id: "a3", data: { trackingId: "PO010_4444", action: "changes_requested", comment: "แก้สี", createdAt: "2026-08-02" } },
    ];
    const result = await listDesignApprovals("PO010_4444");
    assert.equal(result.length, 2);
    assert.deepEqual(result.map(r => r.id).sort(), ["a1", "a3"]);
    assert.ok(result.every(r => r.trackingId === "PO010_4444"));
  });

  test("ไม่มี doc ไหนตรง trackingId ที่ขอเลย → คืน [] (ไม่ throw)", async () => {
    globalThis.__GET_DOCS_STUB__ = () => [
      { id: "a1", data: { trackingId: "PO_OTHER", action: "approved", comment: "", createdAt: "2026-08-01" } },
    ];
    assert.deepEqual(await listDesignApprovals("PO010_4444"), []);
  });
});
