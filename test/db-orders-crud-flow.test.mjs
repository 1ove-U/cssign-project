// test/db-orders-crud-flow.test.mjs — รอบที่ 70
//
// ทดสอบ addOrder()/updateOrder()/deleteOrder() (js/db-orders.js) แบบเรียกฟังก์ชันจริงตรงๆ
// (ไม่ผ่าน UI modal ใดๆ — orders-tab-modal.js ใหญ่/ซับซ้อนเกินไปสำหรับรอบนี้ ดูหมายเหตุใน
// REFACTOR-PROGRESS.md หัวข้อ "รอบที่ 70" ว่าทำไมเลือก scope ระดับ data-layer แทน UI flow เต็ม)
// ยืนยันว่า payload ที่ถูกส่งเข้า addDoc()/updateDoc()/deleteDoc()/setDoc() จริง (ผ่าน
// firebase-stub-loader.mjs ที่แก้เพิ่มใน รอบที่ 70 ให้ capture ทั้ง 4 ฟังก์ชันนี้ผ่าน
// globalThis.__ADD_DOC_CALLS__/__UPDATE_DOC_CALLS__/__DELETE_DOC_CALLS__/__SET_DOC_CALLS__ —
// เดิม (รอบ 68) มีแค่ addDoc()) ถูกต้องตรงตาม business logic ของแต่ละฟังก์ชันจริง — ครอบคลุม:
//
// - addOrder(): normalize field (default status/progress/normalizeOrderExtras), trackingId
//   คำนวณถูกจาก code+phone, และ upsertOrderTracking() (setDoc ไปที่ "order_tracking/<id>")
//   ถูกเรียกเฉพาะตอนมี trackingId เท่านั้น
// - updateOrder(): อ่าน existing document ก่อน (getDoc — ควบคุมด้วย globalThis.__GET_DOC_STUB__
//   ที่เพิ่มใน stub รอบนี้) merge patch, ลบ field "compliant" เก่าทิ้งทุกครั้ง (deleteField()),
//   auto-set shippedAt/completedAt ตาม status, sync order_tracking (setDoc)
//   ตามการเปลี่ยน trackingId (removeOrderTracking แค่ตอน trackingId เปลี่ยนจริง, upsertOrderTracking
//   ทุกครั้งที่ trackingId ปัจจุบันไม่ null)
// - deleteOrder(): deleteDoc ที่ "orders/<id>" + ลบ order_tracking คู่กันด้วยถ้ามี trackingId เดิม
//
// รันด้วย: node --import ./test/helpers/register-loader.mjs --test
// test/db-orders-crud-flow.test.mjs

import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { addOrder, updateOrder, deleteOrder } from "../js/db-orders.js";

// ── helper: ล้าง/อ่าน capture array ทั้ง 4 ตัวก่อนแต่ละเทสต์ (pattern เดียวกับ
// resetAddDocCalls()/lastAddDocCall() ของ test/lead-quote-modal-form-flow.test.mjs รอบ 68) ──
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

describe("addOrder()", () => {
  test("addDoc ถูกเรียกที่ collection \"orders\" พร้อม field ที่จำเป็นครบ + default status/progress", async () => {
    await addOrder({ code: "PO-001", customer: "EGAT", item: "ป้ายเตือนไฟฟ้าแรงสูง", qty: 5 });
    const calls = globalThis.__ADD_DOC_CALLS__;
    assert.equal(calls.length, 1);
    assert.equal(calls[0].path, "orders");
    assert.equal(calls[0].payload.code, "PO-001");
    assert.equal(calls[0].payload.customer, "EGAT");
    assert.equal(calls[0].payload.qty, 5);
    assert.equal(calls[0].payload.status, "received"); // default เมื่อไม่ส่ง status มา
    assert.equal(calls[0].payload.progress, 0);
  });

  test("qty/progress ที่ไม่ใช่ตัวเลข ถูก fallback (qty=1, progress clamp 0-100)", async () => {
    await addOrder({ code: "PO-002", qty: "abc", progress: 250 });
    const payload = globalThis.__ADD_DOC_CALLS__[0].payload;
    assert.equal(payload.qty, 1);
    assert.equal(payload.progress, 100); // clamp บนสุดที่ 100
  });

  test("มี code+phone ครบ → trackingId ถูกคำนวณ + upsertOrderTracking (setDoc) ถูกเรียกที่ order_tracking/<trackingId>", async () => {
    await addOrder({ code: "PO-003", phone: "0891234567", item: "ป้าย A", qty: 1 });
    const addCall = globalThis.__ADD_DOC_CALLS__[0];
    assert.equal(addCall.payload.trackingId, "PO003_4567");

    const setCalls = globalThis.__SET_DOC_CALLS__;
    assert.equal(setCalls.length, 1);
    assert.equal(setCalls[0].path, "order_tracking/PO003_4567");
    assert.equal(setCalls[0].payload.code, "PO-003");
  });

  test("ไม่มี phone (หรือสั้นกว่า 4 หลัก) → trackingId เป็น null → ไม่มีการเรียก setDoc เลย", async () => {
    await addOrder({ code: "PO-004", item: "ป้าย B", qty: 1 });
    assert.equal(globalThis.__ADD_DOC_CALLS__[0].payload.trackingId, null);
    assert.equal(globalThis.__SET_DOC_CALLS__.length, 0);
  });

  test("normalizeOrderExtras() ถูก merge เข้า payload จริง (spot check shippingMethod fallback \"pickup\" เมื่อค่าไม่อยู่ใน whitelist)", async () => {
    await addOrder({ code: "PO-005", qty: 1, shippingMethod: "teleport" });
    const payload = globalThis.__ADD_DOC_CALLS__[0].payload;
    assert.equal(payload.shippingMethod, "pickup");
    assert.equal(payload.paymentStatus, "unpaid");
    assert.deepEqual(payload.attachments, []);
    assert.deepEqual(payload.designFiles, []); // P0.2: designFiles ก็ต้องถูก merge เข้า payload เหมือน attachments
  });
});

describe("updateOrder()", () => {
  test("ไม่มี existing document (getDoc คืน exists:false ตาม default ของ stub) + patch ไม่มี code/phone → ไม่เรียก removeOrderTracking/upsertOrderTracking เลย (trackingId เดิม/ใหม่เป็น null เท่ากัน)", async () => {
    await updateOrder("order-1", { status: "design" });
    assert.equal(globalThis.__UPDATE_DOC_CALLS__.length, 1);
    assert.equal(globalThis.__UPDATE_DOC_CALLS__[0].path, "orders/order-1");
    assert.equal(globalThis.__DELETE_DOC_CALLS__.length, 0);
    assert.equal(globalThis.__SET_DOC_CALLS__.length, 0);
  });

  test("updateDoc payload ลบ field \"compliant\" เก่าทิ้งเสมอ (deleteField() → undefined แต่ key ต้องมีอยู่)", async () => {
    await updateOrder("order-1", { status: "design" });
    const payload = globalThis.__UPDATE_DOC_CALLS__[0].payload;
    assert.ok("compliant" in payload);
    assert.equal(payload.compliant, undefined);
  });

  test("status = \"shipping\" → payload มี key shippedAt", async () => {
    await updateOrder("order-1", { status: "shipping" });
    const payload = globalThis.__UPDATE_DOC_CALLS__[0].payload;
    assert.ok("shippedAt" in payload);
  });

  test("status = \"completed\" → progress ถูกบังคับเป็น 100 + payload มี key completedAt", async () => {
    await updateOrder("order-1", { status: "completed", progress: 40 });
    const payload = globalThis.__UPDATE_DOC_CALLS__[0].payload;
    assert.equal(payload.progress, 100);
    assert.ok("completedAt" in payload);
  });

  test("qty/unit_price/deposit/discount/shippingCost ใน patch ถูกแปลงเป็นตัวเลขปลอดภัย (fallback 0/1 ถ้าไม่ใช่ตัวเลข)", async () => {
    await updateOrder("order-1", { qty: "xyz", unit_price: "9", deposit: "abc", discount: "10", shippingCost: "" });
    const payload = globalThis.__UPDATE_DOC_CALLS__[0].payload;
    assert.equal(payload.qty, 1);
    assert.equal(payload.unit_price, 9);
    assert.equal(payload.deposit, 0);
    assert.equal(payload.discount, 10);
    assert.equal(payload.shippingCost, 0);
  });

  test("มี existing trackingId เดิม (getDoc stub คืนข้อมูลเดิม) + patch ไม่แตะ code/phone → trackingId ไม่เปลี่ยน แต่ upsertOrderTracking (setDoc) ยังถูกเรียกทุกครั้งเพื่อ sync สถานะล่าสุด", async () => {
    globalThis.__GET_DOC_STUB__ = () => ({
      exists: true,
      data: { code: "PO-010", phone: "0891234567", trackingId: "PO010_4567", status: "received", progress: 0 }
    });
    await updateOrder("order-1", { status: "production", progress: 30 });

    assert.equal(globalThis.__DELETE_DOC_CALLS__.length, 0); // trackingId ไม่เปลี่ยน ไม่ต้องลบของเดิม
    assert.equal(globalThis.__SET_DOC_CALLS__.length, 1);
    assert.equal(globalThis.__SET_DOC_CALLS__[0].path, "order_tracking/PO010_4567");
    assert.equal(globalThis.__SET_DOC_CALLS__[0].payload.status, "production");
    assert.equal(globalThis.__SET_DOC_CALLS__[0].payload.progress, 30);
  });

  test("เปลี่ยนเบอร์โทรจน trackingId เปลี่ยน → removeOrderTracking ลบของเดิม (deleteDoc ที่ order_tracking/<เดิม>) + upsertOrderTracking สร้างใหม่ (setDoc ที่ order_tracking/<ใหม่>)", async () => {
    globalThis.__GET_DOC_STUB__ = () => ({
      exists: true,
      data: { code: "PO-020", phone: "0891111111", trackingId: "PO020_1111", status: "received", progress: 0 }
    });
    await updateOrder("order-2", { phone: "0899999999" });

    const deleteCalls = globalThis.__DELETE_DOC_CALLS__;
    assert.equal(deleteCalls.length, 1);
    assert.equal(deleteCalls[0].path, "order_tracking/PO020_1111");

    const setCalls = globalThis.__SET_DOC_CALLS__;
    assert.equal(setCalls.length, 1);
    assert.equal(setCalls[0].path, "order_tracking/PO020_9999");
  });
});

// P0.3: แจ้งเตือนลูกค้าอัตโนมัติทางอีเมลเมื่อ status เปลี่ยน — updateOrder() เรียก
// sendOrderStatusEmail() (js/email-notify.js) หลัง updateDoc()/upsertOrderTracking() สำเร็จแล้ว
// เท่านั้น (ดูคอมเมนต์ใน js/db-orders.js) — ตัวฟังก์ชันเองยังไม่ได้ตั้งค่าเทมเพลตจริงใน EmailJS
// (EMAILJS_TEMPLATE_NOTIFY ยังเป็น placeholder "YOUR_...") จึงยังทดสอบ "เส้นทางส่งสำเร็จ
// จริง" (params ที่ .send() ได้รับ) ไม่ได้ในรอบนี้ — ทดสอบเฉพาะเงื่อนไข "ข้าม" ที่ตรวจได้จริงกับ
// โค้ดปัจจุบัน + ยืนยันว่า updateOrder() เองไม่ล้มเหลวไม่ว่ากรณีไหน (error isolation ตามกฎ
// กันโค้ดพังของโปรเจกต์) — ดู test/email-notify-order-status.test.mjs สำหรับเทสตรงของ
// sendOrderStatusEmail() เอง (unit level แยกจากไฟล์นี้)
describe("updateOrder() → sendOrderStatusEmail() wiring (P0.3)", () => {
  test("status เปลี่ยนจริง + order มี email แต่ EmailJS ยังไม่ได้ตั้งค่าเทมเพลต → updateDoc ยังสำเร็จปกติ ไม่ throw (ไม่มี __EMAILJS_SEND_CALLS__ เพราะข้ามการส่งจริง)", async () => {
    globalThis.__EMAILJS_SEND_CALLS__ = [];
    globalThis.__GET_DOC_STUB__ = () => ({
      exists: true,
      data: { code: "PO-030", email: "customer@example.com", status: "design" }
    });
    await assert.doesNotReject(() => updateOrder("order-3", { status: "production" }));
    assert.equal(globalThis.__UPDATE_DOC_CALLS__.length, 1);
    assert.equal(globalThis.__EMAILJS_SEND_CALLS__.length, 0); // ยังไม่ตั้งค่าเทมเพลตจริง → ข้าม
  });

  test("patch ไม่มี status เลย (แก้ field อื่น เช่น notes) → ไม่พยายามส่งอีเมลเลย (ไม่เข้าเงื่อนไข \"status\" in patch)", async () => {
    globalThis.__EMAILJS_SEND_CALLS__ = [];
    globalThis.__GET_DOC_STUB__ = () => ({
      exists: true,
      data: { code: "PO-031", email: "customer2@example.com", status: "design" }
    });
    await updateOrder("order-4", { notes: "แก้หมายเหตุอย่างเดียว" });
    assert.equal(globalThis.__EMAILJS_SEND_CALLS__.length, 0);
  });

  test("status ใน patch เท่ากับ status เดิม (submit ทั้งฟอร์มโดยไม่ได้เปลี่ยนสถานะจริง) → ไม่ส่งอีเมล", async () => {
    globalThis.__EMAILJS_SEND_CALLS__ = [];
    globalThis.__GET_DOC_STUB__ = () => ({
      exists: true,
      data: { code: "PO-032", email: "customer3@example.com", status: "production" }
    });
    await updateOrder("order-5", { status: "production" });
    assert.equal(globalThis.__EMAILJS_SEND_CALLS__.length, 0);
  });
});

// P1.4: แจ้งเตือนลูกค้าอัตโนมัติผ่าน LINE เมื่อ status เปลี่ยน — updateOrder() เรียก
// sendOrderStatusLine() (js/line-notify.js) หลัง sendOrderStatusEmail() สำเร็จ/ล้มเหลวก็ตาม
// (คนละ try/catch แยกจากกัน — ดูคอมเมนต์ใน js/db-orders.js) — sendOrderStatusLine() เอง
// ในสภาพแวดล้อมเทสข้ามเสมอเพราะ auth.currentUser เป็น null (ดู
// test/line-notify-order-status.test.mjs สำหรับรายละเอียด) จึงทดสอบตรงนี้แค่ว่า updateOrder()
// ไม่ throw และ updateDoc()/sendOrderStatusEmail() ยังทำงานตามปกติแม้จะมีการเรียก
// sendOrderStatusLine() เพิ่มเข้ามาคู่กัน (error isolation ระหว่าง 2 integration ตามกฎกันโค้ดพัง)
describe("updateOrder() → sendOrderStatusLine() wiring (P1.4)", () => {
  test("status เปลี่ยนจริง + order มี lineUserId → updateDoc ยังสำเร็จปกติ ไม่ throw (ไม่มี auth.currentUser ในเทส → sendOrderStatusLine ข้ามเงียบๆ)", async () => {
    globalThis.__EMAILJS_SEND_CALLS__ = [];
    globalThis.__GET_DOC_STUB__ = () => ({
      exists: true,
      data: { code: "PO-033", lineUserId: "Uxyz001", status: "design" }
    });
    await assert.doesNotReject(() => updateOrder("order-6", { status: "production" }));
    assert.equal(globalThis.__UPDATE_DOC_CALLS__.length, 1);
  });

  test("patch ไม่มี status เลย → ไม่พยายามเรียก sendOrderStatusLine() เลย (ไม่เข้าเงื่อนไข \"status\" in patch — ยืนยันผ่านการไม่ throw เท่านั้นเพราะฟังก์ชันไม่มี call-tracking hook ในรอบนี้)", async () => {
    globalThis.__GET_DOC_STUB__ = () => ({
      exists: true,
      data: { code: "PO-034", lineUserId: "Uxyz002", status: "design" }
    });
    await assert.doesNotReject(() => updateOrder("order-7", { notes: "แก้หมายเหตุอย่างเดียว" }));
  });

  test("order ไม่มี lineUserId เลย + status เปลี่ยนจริง → updateOrder() ยังสำเร็จปกติ ไม่ throw", async () => {
    globalThis.__GET_DOC_STUB__ = () => ({
      exists: true,
      data: { code: "PO-035", status: "production" }
    });
    await assert.doesNotReject(() => updateOrder("order-8", { status: "shipping" }));
  });
});

// P2.9: ขอรีวิวลูกค้าอัตโนมัติทางอีเมลหลังงานเสร็จ — updateOrder() เรียก sendReviewRequestEmail()
// (js/email-notify.js) หลัง sendOrderStatusEmail()/sendOrderStatusLine() สำเร็จ/ล้มเหลวก็ตาม
// (คนละ try/catch แยกจากทั้งสองอันด้านบน — ดูคอมเมนต์ใน js/db-orders.js) — ในสภาพแวดล้อมเทส
// EMAILJS_TEMPLATE_NOTIFY (ใช้ร่วมกับ order-status) ยังเป็น placeholder จึงข้ามเสมอ (ดู
// test/email-notify-review-request.test.mjs สำหรับรายละเอียด) — ทดสอบตรงนี้แค่ว่า updateOrder()
// ไม่ throw และ updateDoc() ยังทำงานตามปกติแม้จะมีการเรียก sendReviewRequestEmail() เพิ่มเข้ามา
describe("updateOrder() → sendReviewRequestEmail() wiring (P2.9)", () => {
  test("status เปลี่ยนเป็น completed จริง + order มี email แต่ EmailJS ยังไม่ได้ตั้งค่าเทมเพลตขอรีวิว → updateDoc ยังสำเร็จปกติ ไม่ throw", async () => {
    globalThis.__EMAILJS_SEND_CALLS__ = [];
    globalThis.__GET_DOC_STUB__ = () => ({
      exists: true,
      data: { code: "PO-036", email: "customer4@example.com", status: "shipping" }
    });
    await assert.doesNotReject(() => updateOrder("order-9", { status: "completed" }));
    assert.equal(globalThis.__UPDATE_DOC_CALLS__.length, 1);
    assert.equal(globalThis.__EMAILJS_SEND_CALLS__.length, 0); // ยังไม่ตั้งค่าเทมเพลตจริง → ข้าม
  });

  test("status เปลี่ยนแต่ไม่ใช่เป็น completed (เช่น production → qc) → sendReviewRequestEmail() ข้ามเงียบๆ ไม่ throw", async () => {
    globalThis.__GET_DOC_STUB__ = () => ({
      exists: true,
      data: { code: "PO-037", email: "customer5@example.com", status: "production" }
    });
    await assert.doesNotReject(() => updateOrder("order-10", { status: "qc" }));
  });

  test("patch ไม่มี status เลย → ไม่พยายามเรียก sendReviewRequestEmail() เลย (ไม่เข้าเงื่อนไข \"status\" in patch)", async () => {
    globalThis.__GET_DOC_STUB__ = () => ({
      exists: true,
      data: { code: "PO-038", email: "customer6@example.com", status: "completed" }
    });
    await assert.doesNotReject(() => updateOrder("order-11", { notes: "แก้หมายเหตุอย่างเดียว" }));
  });

  // P2.9a2: ยืนยันว่า updateOrder() ไม่เรียก updateDoc() เพิ่มเติมสำหรับ reviewRequestedAt เมื่อ
  // sendReviewRequestEmail() ไม่ได้ส่งจริง (คืนค่า false) — ในสภาพแวดล้อมเทสนี้เทมเพลตยังเป็น
  // placeholder เสมอ จึงคาดว่าจะเห็น updateDoc() แค่ 1 ครั้ง (ก้อนหลักของ updateOrder() เอง)
  // ไม่ใช่ 2 ครั้ง — ถ้าธุรกิจตั้งค่าเทมเพลตจริงในอนาคต ต้องเพิ่มเทสแยกสำหรับเส้นทาง "ส่งสำเร็จ →
  // updateDoc() ครั้งที่ 2 บันทึก reviewRequestedAt" ด้วย (ยังทำไม่ได้ตอนนี้เหมือน P0.3b)
  test("ส่งอีเมลขอรีวิวถูกข้าม (ยังไม่ตั้งค่าเทมเพลตจริง) → ไม่มี updateDoc() ครั้งที่สองสำหรับ reviewRequestedAt", async () => {
    globalThis.__GET_DOC_STUB__ = () => ({
      exists: true,
      data: { code: "PO-039", email: "customer7@example.com", status: "shipping" }
    });
    await updateOrder("order-12", { status: "completed" });
    assert.equal(globalThis.__UPDATE_DOC_CALLS__.length, 1);
  });

  // เอกสารเดิมมี reviewRequestedAt ค้างอยู่แล้ว (เคยส่งไปแล้วรอบก่อน แล้วสถานะวนออกจาก completed
  // แล้วกลับเข้ามาใหม่) → sendReviewRequestEmail() ข้ามตั้งแต่ระดับ field guard (ไม่ใช่แค่
  // transition guard) — ยืนยันว่า updateOrder() ไม่ throw และยังคง updateDoc() แค่ 1 ครั้งเช่นกัน
  test("order เดิมมี reviewRequestedAt ค้างอยู่แล้ว (เคยส่งไปก่อนหน้า) → ไม่ throw ไม่มี updateDoc() ซ้ำ", async () => {
    globalThis.__GET_DOC_STUB__ = () => ({
      exists: true,
      data: {
        code: "PO-040",
        email: "customer8@example.com",
        status: "shipping",
        reviewRequestedAt: { seconds: 1700000000, nanoseconds: 0 }
      }
    });
    await assert.doesNotReject(() => updateOrder("order-13", { status: "completed" }));
    assert.equal(globalThis.__UPDATE_DOC_CALLS__.length, 1);
  });
});

describe("deleteOrder()", () => {
  test("ไม่มี trackingId เดิม (getDoc default exists:false) → deleteDoc แค่ครั้งเดียวที่ orders/<id> ไม่มี removeOrderTracking เพิ่ม", async () => {
    await deleteOrder("order-3");
    const calls = globalThis.__DELETE_DOC_CALLS__;
    assert.equal(calls.length, 1);
    assert.equal(calls[0].path, "orders/order-3");
  });

  test("มี trackingId เดิม (getDoc stub คืน exists:true พร้อม trackingId) → deleteDoc ถูกเรียก 2 ครั้ง: orders/<id> และ order_tracking/<trackingId>", async () => {
    globalThis.__GET_DOC_STUB__ = () => ({
      exists: true,
      data: { trackingId: "PO030_2222" }
    });
    await deleteOrder("order-4");
    const calls = globalThis.__DELETE_DOC_CALLS__;
    assert.equal(calls.length, 2);
    assert.equal(calls[0].path, "orders/order-4");
    assert.equal(calls[1].path, "order_tracking/PO030_2222");
  });

  test("exists:true แต่ไม่มี field trackingId ใน document (undefined) → deleteDoc แค่ครั้งเดียว ไม่พยายามลบ order_tracking ที่ไม่มีอยู่จริง", async () => {
    globalThis.__GET_DOC_STUB__ = () => ({ exists: true, data: {} });
    await deleteOrder("order-5");
    assert.equal(globalThis.__DELETE_DOC_CALLS__.length, 1);
  });
});
