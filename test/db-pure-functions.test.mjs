// test/db-pure-functions.test.mjs
//
// Unit test สำหรับฟังก์ชันคำนวณล้วนๆ ที่ไม่เรียก Firebase โดยตรง:
// computeOrderStats, computeLeadStats, orderGrandTotal, orderBalance, daysUntilDue,
// orderUrgency (อยู่ใน js/db-orders-stats.js — แยกออกมาจาก js/db-orders.js ตั้งแต่รอบที่ 32
// เพราะไม่มีการเรียก Firestore เลย), buildTrackingId (ยังอยู่ใน js/db-orders.js เหมือนเดิม
// เพราะเป็นฟังก์ชัน pure แต่ import อยู่ในไฟล์ที่มีการเรียก Firestore อื่นๆ ร่วมด้วย),
// normalizeOrderExtras (เพิ่ม export ในรอบที่ 38 — ยังอยู่ใน js/db-orders.js เหมือนกัน ด้วยเหตุผล
// เดียวกับ buildTrackingId คือมีจุดเรียกใช้แค่จุดเดียวในไฟล์เดียวกันเอง ไม่คุ้มย้ายออกเป็นไฟล์ใหม่)
// และ computeMonthlyRevenue (อยู่ใน js/db.js — เดิมทั้งหมดเคยอยู่ไฟล์เดียวกัน แต่ db-orders.js
// ถูกแยกออกจาก db.js ไปตั้งแต่รอบ refactor ก่อนหน้านี้แล้ว จึงต้อง import จากคนละไฟล์กันตามด้านบน)
//
// รันด้วย: node --import ./test/helpers/register-loader.mjs --test test/db-pure-functions.test.mjs
// (ดู package.json script "test" ที่เพิ่มไว้ให้เรียกสั้นๆ ด้วย `npm test`)
//
// ทำไมต้องมี loader: js/db.js และ js/db-orders.js ต่าง import Firebase SDK จาก URL ตรงๆ
// (https://www.gstatic.com/...) และ js/db.js เรียก initializeApp/initializeFirestore/
// getAuth ตอน module ถูก evaluate — Node ธรรมดาโหลดไฟล์เหล่านี้ตรงๆ ไม่ได้ ดู
// test/helpers/firebase-stub-loader.mjs สำหรับรายละเอียดวิธี stub (ดักที่ URL ของ SDK
// ไม่ว่าไฟล์ไหนจะเป็นคน import จึงไม่ต้องแก้ loader ตามการแตกไฟล์ db.js/db-orders.js)
//
// ไม่มีการแก้ logic ใดๆ ในฟังก์ชันเป้าหมายเพื่อให้ test รันได้ — stub อยู่ที่ boundary การ import เท่านั้น

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  buildTrackingId,
  normalizeOrderExtras,
} from "../js/db-orders.js";
import {
  computeOrderStats,
  computeLeadStats,
  orderGrandTotal,
  orderBalance,
  daysUntilDue,
  orderUrgency,
  ordersByDueDate,
} from "../js/db-orders-stats.js";
import { computeMonthlyRevenue } from "../js/db.js";

// ── helper: สร้างวันที่ในรูปแบบ "YYYY-MM-DD" ห่างจากวันนี้ N วัน (ใช้ทดสอบ due date) ──
function dateOffset(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// ── helper: จำลอง Firestore Timestamp object ({ toMillis() }) เพราะ orders/leads จริง
//    เก็บ createdAt เป็น Firestore Timestamp ไม่ใช่ number ตรงๆ (ฟังก์ชันเป้าหมายรองรับ
//    ทั้งสองแบบผ่าน `.toMillis ? .toMillis() : value`) ──
function ts(millis) {
  return { toMillis: () => millis };
}

describe("buildTrackingId", () => {
  test("รวมรหัส PO (ตัดอักขระแปลกปลอมออก, ตัวพิมพ์ใหญ่) + เบอร์โทร 4 หลักสุดท้าย", () => {
    assert.equal(buildTrackingId("po-001", "0812345678"), "PO001_5678");
  });

  test("คืนค่า null ถ้าไม่มีรหัส PO", () => {
    assert.equal(buildTrackingId("", "0812345678"), null);
    assert.equal(buildTrackingId(null, "0812345678"), null);
  });

  test("คืนค่า null ถ้าเบอร์โทรสั้นกว่า 4 หลัก", () => {
    assert.equal(buildTrackingId("PO001", "123"), null);
    assert.equal(buildTrackingId("PO001", ""), null);
  });

  test("รหัส PO ที่มีขีด/ช่องว่าง/ตัวพิมพ์เล็กถูก normalize เหมือนกันจึงได้ id เดียวกัน", () => {
    const a = buildTrackingId("PO-001", "081-234-5678");
    const b = buildTrackingId("po001", "0812345678");
    assert.equal(a, b);
  });
});

describe("normalizeOrderExtras", () => {
  test("order ว่างเปล่า (object เปล่า) ได้ค่า default ทุก field ไม่ throw", () => {
    const extras = normalizeOrderExtras({});
    // หมายเหตุ (P0.2): เพิ่ม designFiles ในผลลัพธ์ default ของฟังก์ชันนี้ตั้งใจ (feature ใหม่
    // "หน้าอนุมัติแบบ") — ต้องอัปเดต object ที่ deepEqual เทียบด้วยตรงนี้ ไม่งั้น test เดิมจะพังเพราะ
    // shape เปลี่ยนจริง (ดูเหตุผลเต็มที่คอมเมนต์ normalizeOrderExtras() ใน js/db-orders.js)
    assert.deepEqual(extras, {
      attachments: [],
      designFiles: [],
      deposit: 0,
      paymentStatus: "unpaid",
      discount: 0,
      vatIncluded: false,
      invoiceAddress: "",
      shippingAddress: "",
      recipient: "",
      shippingMethod: "pickup",
      shippingCost: 0,
      shippingTrackingId: "",
      assignee: "",
      assigneeName: "",
      specs: { size: "", material: "", color: "", finish: "" },
      qcChecklist: [],
    });
  });

  test("ค่าตัวเลขที่เป็น string/undefined/NaN ถูกแปลงเป็น number ปลอดภัย (fallback 0)", () => {
    assert.equal(normalizeOrderExtras({ deposit: "1500" }).deposit, 1500);
    assert.equal(normalizeOrderExtras({ deposit: undefined }).deposit, 0);
    assert.equal(normalizeOrderExtras({ deposit: "not-a-number" }).deposit, 0);
    assert.equal(normalizeOrderExtras({ discount: "200" }).discount, 200);
    assert.equal(normalizeOrderExtras({ shippingCost: "80.5" }).shippingCost, 80.5);
  });

  test("paymentStatus/shippingMethod ที่ไม่อยู่ใน whitelist ถูก fallback เป็นค่าเริ่มต้น", () => {
    assert.equal(normalizeOrderExtras({ paymentStatus: "bogus" }).paymentStatus, "unpaid");
    assert.equal(normalizeOrderExtras({ paymentStatus: "paid_full" }).paymentStatus, "paid_full");
    assert.equal(normalizeOrderExtras({ shippingMethod: "teleport" }).shippingMethod, "pickup");
    assert.equal(normalizeOrderExtras({ shippingMethod: "courier" }).shippingMethod, "courier");
  });

  test("vatIncluded ถูกแปลงเป็น boolean เสมอ (รับ truthy/falsy หลายแบบ)", () => {
    assert.equal(normalizeOrderExtras({ vatIncluded: true }).vatIncluded, true);
    assert.equal(normalizeOrderExtras({ vatIncluded: 1 }).vatIncluded, true);
    assert.equal(normalizeOrderExtras({ vatIncluded: 0 }).vatIncluded, false);
    assert.equal(normalizeOrderExtras({ vatIncluded: undefined }).vatIncluded, false);
  });

  test("attachments/qcChecklist/designFiles ที่ไม่ใช่ array ถูก fallback เป็น []", () => {
    assert.deepEqual(normalizeOrderExtras({ attachments: "not-an-array" }).attachments, []);
    assert.deepEqual(normalizeOrderExtras({ attachments: null }).attachments, []);
    assert.deepEqual(normalizeOrderExtras({ qcChecklist: "nope" }).qcChecklist, []);
    assert.deepEqual(normalizeOrderExtras({ designFiles: "nope" }).designFiles, []);
    assert.deepEqual(normalizeOrderExtras({ designFiles: null }).designFiles, []);
  });

  // P0.2 (Design Proof Approval) — designFiles ต้องถูก sanitize ทีละรายการเหมือน qcChecklist
  // ด้านบน (url/label เป็น string เสมอ, ไม่มี field แปลกปลอมหลุดเข้ามา เช่น uploadedBy ที่ตั้งใจ
  // ไม่ให้อยู่ใน field นี้เพราะจะถูกคัดลอกไปที่ order_tracking แบบ public ด้วย — ดูหมายเหตุเต็มที่
  // js/db-orders.js)
  test("designFiles array ที่ถูกต้องถูก sanitize ทีละรายการ (url/label เป็น string, ไม่มี field แปลกปลอมหลุดเข้ามา)", () => {
    const extras = normalizeOrderExtras({
      designFiles: [
        { url: "https://example.com/a.jpg", label: "แบบร่างหน้าแรก", uploadedAt: "2026-08-01", uploadedBy: "admin@cssign.local" },
        { url: 123, label: null, uploadedAt: undefined }
      ]
    });
    assert.deepEqual(extras.designFiles, [
      { url: "https://example.com/a.jpg", label: "แบบร่างหน้าแรก", uploadedAt: "2026-08-01" },
      { url: "123", label: "", uploadedAt: "" }
    ]);
    // ไม่มี uploadedBy หลุดเข้ามาในผลลัพธ์เลยแม้ input จะส่งมา
    assert.ok(!("uploadedBy" in extras.designFiles[0]));
  });

  test("qcChecklist array ที่ถูกต้องถูก sanitize ทีละรายการ (label เป็น string, checked เป็น boolean)", () => {
    const extras = normalizeOrderExtras({
      qcChecklist: [
        { label: "ตรวจสี", checked: true },
        { label: 123, checked: "yes" }, // ข้อมูลแปลกปลอม — ต้องถูก sanitize
        { checked: false }, // ไม่มี label
      ],
    });
    assert.deepEqual(extras.qcChecklist, [
      { label: "ตรวจสี", checked: true },
      { label: "123", checked: true },
      { label: "", checked: false },
    ]);
  });

  test("specs รวม default ทีละ field เมื่อ order.specs มีแค่บาง field", () => {
    const extras = normalizeOrderExtras({ specs: { size: "A4", color: "แดง" } });
    assert.deepEqual(extras.specs, { size: "A4", material: "", color: "แดง", finish: "" });
  });

  test("specs เป็น null/undefined ทั้งก้อน ยังคืน default ครบทุก field ไม่ throw", () => {
    assert.deepEqual(normalizeOrderExtras({ specs: null }).specs, { size: "", material: "", color: "", finish: "" });
    assert.deepEqual(normalizeOrderExtras({}).specs, { size: "", material: "", color: "", finish: "" });
  });

  test("string field (invoiceAddress/shippingAddress/recipient/assignee/assigneeName/shippingTrackingId) fallback เป็น \"\" ถ้าไม่ส่งมา", () => {
    const extras = normalizeOrderExtras({});
    assert.equal(extras.invoiceAddress, "");
    assert.equal(extras.shippingAddress, "");
    assert.equal(extras.recipient, "");
    assert.equal(extras.assignee, "");
    assert.equal(extras.assigneeName, "");
    assert.equal(extras.shippingTrackingId, "");
  });
});

describe("daysUntilDue", () => {
  test("คืนค่า null ถ้า order ไม่มี dueDate", () => {
    assert.equal(daysUntilDue({}), null);
    assert.equal(daysUntilDue(null), null);
    assert.equal(daysUntilDue({ dueDate: "" }), null);
  });

  test("คืนค่า null ถ้า dueDate เป็นวันที่ไม่ถูกต้อง", () => {
    assert.equal(daysUntilDue({ dueDate: "not-a-date" }), null);
  });

  // หมายเหตุ: due คำนวณจาก "T23:59:59" ของ dueDate เทียบกับเวลาปัจจุบันตามนาฬิกาจริง (ไม่ใช่
  // เที่ยงคืนพอดี) ดังนั้นผลของ offset N วันจะอยู่ที่ N หรือ N+1 ขึ้นกับว่าตอนรัน test เป็นเวลา
  // ไหนของวัน (ต้นวัน → มักได้ N+1, ท้ายวัน → มักได้ N) — จึงใช้ offset ที่มีระยะห่างพอ กัน
  // ไม่ให้ผลลัพธ์ก้ำกึ่งข้ามเส้นแบ่งที่สนใจจริง (บวก/ลบ, มากกว่า/น้อยกว่า 2) แทนการเทียบเลขวันเป๊ะ

  test("คืนค่าบวกถ้ากำหนดส่งยังไม่ถึงอีกหลายวัน", () => {
    const d = daysUntilDue({ dueDate: dateOffset(5) });
    assert.ok(d >= 5 && d <= 6, `expected 5 or 6, got ${d}`);
  });

  test("คืนค่าลบถ้าเกินกำหนดส่งไปแล้วหลายวัน", () => {
    const d = daysUntilDue({ dueDate: dateOffset(-5) });
    assert.ok(d < 0, `expected negative, got ${d}`);
  });

  test("วันนี้ (dueDate = วันนี้) ให้ค่าใกล้ 0 (0 หรือ 1 ขึ้นกับเวลาปัจจุบัน) ไม่ใช่ค่าลบ", () => {
    const d = daysUntilDue({ dueDate: dateOffset(0) });
    assert.ok(d === 0 || d === 1, `expected 0 or 1, got ${d}`);
  });
});

describe("orderUrgency", () => {
  test("null ถ้างานเสร็จแล้วหรือยกเลิกแล้ว แม้เกินกำหนดส่งก็ตาม", () => {
    assert.equal(orderUrgency({ status: "completed", dueDate: dateOffset(-5) }), null);
    assert.equal(orderUrgency({ status: "cancelled", dueDate: dateOffset(-5) }), null);
  });

  test("null ถ้าไม่มี dueDate", () => {
    assert.equal(orderUrgency({ status: "production" }), null);
  });

  test("'overdue' ถ้าเกินกำหนดส่งและงานยังไม่จบ", () => {
    // ใช้ offset -3 (ไม่ใช่ -1) เพื่อกันกรณีก้ำกึ่งที่ผลลัพธ์อาจกลายเป็น 0 (due-soon) แทน
    // ขึ้นกับเวลาปัจจุบัน ณ ตอนรัน test (ดูหมายเหตุใน describe("daysUntilDue"))
    assert.equal(orderUrgency({ status: "production", dueDate: dateOffset(-3) }), "overdue");
  });

  test("'due-soon' ถ้าเหลือ 0-2 วัน", () => {
    assert.equal(orderUrgency({ status: "production", dueDate: dateOffset(1) }), "due-soon");
    assert.equal(orderUrgency({ status: "qc", dueDate: dateOffset(0) }), "due-soon");
  });

  test("null ถ้าเหลือมากกว่า 2 วัน", () => {
    assert.equal(orderUrgency({ status: "design", dueDate: dateOffset(10) }), null);
  });
});

describe("ordersByDueDate", () => {
  test("อาร์เรย์ว่าง/undefined/null → Map ว่าง", () => {
    assert.equal(ordersByDueDate([]).size, 0);
    assert.equal(ordersByDueDate(undefined).size, 0);
    assert.equal(ordersByDueDate(null).size, 0);
  });

  test("คำสั่งผลิตที่ไม่มี dueDate เลย → ไม่ปรากฏในผลลัพธ์", () => {
    const map = ordersByDueDate([{ id: "1", status: "production" }, { id: "2", status: "production", dueDate: "" }]);
    assert.equal(map.size, 0);
  });

  test("ข้าม status completed/cancelled แม้จะมี dueDate", () => {
    const map = ordersByDueDate([
      { id: "1", status: "completed", dueDate: "2026-01-10" },
      { id: "2", status: "cancelled", dueDate: "2026-01-10" },
    ]);
    assert.equal(map.size, 0);
  });

  test("จัดกลุ่มคำสั่งผลิตหลายรายการที่มี dueDate วันเดียวกันไว้ใน key เดียวกัน", () => {
    const map = ordersByDueDate([
      { id: "1", status: "production", dueDate: "2026-01-10" },
      { id: "2", status: "qc", dueDate: "2026-01-10" },
      { id: "3", status: "design", dueDate: "2026-01-11" },
    ]);
    assert.equal(map.size, 2);
    assert.equal(map.get("2026-01-10").length, 2);
    assert.deepEqual(map.get("2026-01-10").map(o => o.id), ["1", "2"]);
    assert.equal(map.get("2026-01-11").length, 1);
    assert.equal(map.get("2026-01-11")[0].id, "3");
  });

  test("รายการ order ที่เป็น null/undefined ในอาร์เรย์ → ข้ามไปเฉยๆ ไม่ throw", () => {
    const map = ordersByDueDate([null, undefined, { id: "1", status: "production", dueDate: "2026-02-01" }]);
    assert.equal(map.size, 1);
    assert.equal(map.get("2026-02-01").length, 1);
  });
});

describe("orderGrandTotal", () => {
  test("คำนวณ unit_price x qty ลบส่วนลด บวก VAT 7% ถ้ายังไม่รวม", () => {
    // (100 * 10 - 0) * 1.07 = 1070
    assert.equal(orderGrandTotal({ unit_price: 100, qty: 10, vatIncluded: false }), 1070);
  });

  test("ไม่บวก VAT ถ้า vatIncluded = true", () => {
    assert.equal(orderGrandTotal({ unit_price: 100, qty: 10, vatIncluded: true }), 1000);
  });

  test("หักส่วนลดก่อนคำนวณ VAT", () => {
    // (100*10 - 200) * 1.07 = 856
    assert.equal(orderGrandTotal({ unit_price: 100, qty: 10, discount: 200, vatIncluded: false }), 856);
  });

  test("ไม่ติดลบแม้ส่วนลดมากกว่ายอดสินค้า (ยึด base เป็น 0)", () => {
    assert.equal(orderGrandTotal({ unit_price: 100, qty: 1, discount: 999, vatIncluded: true }), 0);
  });

  test("บวกค่าขนส่งหลังคำนวณ VAT แล้ว", () => {
    // (100*1)*1.07 + 50 = 157
    assert.equal(orderGrandTotal({ unit_price: 100, qty: 1, vatIncluded: false, shippingCost: 50 }), 157);
  });

  test("field ที่ไม่ใช่ตัวเลข/ไม่มีค่า ถือเป็น 0 ไม่ throw", () => {
    assert.equal(orderGrandTotal({}), 0);
    assert.equal(orderGrandTotal({ unit_price: "abc", qty: "xyz" }), 0);
  });
});

describe("orderBalance", () => {
  test("0 เสมอถ้า paymentStatus = paid_full แม้ deposit จะไม่ตรงกับยอดรวมจริง", () => {
    assert.equal(orderBalance({ unit_price: 1000, qty: 1, vatIncluded: true, paymentStatus: "paid_full", deposit: 0 }), 0);
  });

  test("ยอดคงเหลือ = ยอดรวม - มัดจำ", () => {
    // grand total = 1000 (vatIncluded true, qty 1), deposit 300 -> balance 700
    assert.equal(orderBalance({ unit_price: 1000, qty: 1, vatIncluded: true, deposit: 300, paymentStatus: "deposit_paid" }), 700);
  });

  test("ไม่ติดลบแม้มัดจำเกินยอดรวม (กันแสดงยอดค้างติดลบ)", () => {
    assert.equal(orderBalance({ unit_price: 100, qty: 1, vatIncluded: true, deposit: 9999, paymentStatus: "deposit_paid" }), 0);
  });

  test("ไม่มี deposit ถือเป็นยอดค้างเต็มจำนวน", () => {
    assert.equal(orderBalance({ unit_price: 1000, qty: 1, vatIncluded: true, paymentStatus: "unpaid" }), 1000);
  });
});

describe("computeMonthlyRevenue", () => {
  test("คืน array ความยาวเท่ากับจำนวนเดือนที่ขอ พร้อม label", () => {
    const result = computeMonthlyRevenue([], 3);
    assert.equal(result.length, 3);
    result.forEach(r => {
      assert.equal(typeof r.label, "string");
      assert.equal(r.total, 0);
    });
  });

  test("ไม่นับคำสั่งที่ถูกยกเลิกไม่ว่าจะอยู่เดือนไหน", () => {
    const now = Date.now();
    const orders = [
      { unit_price: 1000, qty: 1, status: "cancelled", createdAt: ts(now) },
    ];
    const result = computeMonthlyRevenue(orders, 1);
    assert.equal(result[0].total, 0);
  });

  test("รวมยอดของเดือนปัจจุบันถูกต้องจากหลายคำสั่ง", () => {
    const now = Date.now();
    const orders = [
      { unit_price: 100, qty: 2, status: "completed", createdAt: ts(now) },
      { unit_price: 200, qty: 1, status: "production", createdAt: ts(now) },
    ];
    const result = computeMonthlyRevenue(orders, 1);
    // 100*2 + 200*1 = 400
    assert.equal(result[0].total, 400);
  });

  test("order ที่ไม่มี createdAt ถูกข้าม ไม่ throw", () => {
    const result = computeMonthlyRevenue([{ unit_price: 100, qty: 1 }], 1);
    assert.equal(result[0].total, 0);
  });
});

describe("computeOrderStats", () => {
  test("orders ว่างเปล่า ไม่ throw และคืนค่าตัวเลขพื้นฐานเป็น 0", () => {
    const stats = computeOrderStats([]);
    assert.equal(stats.activeCount, 0);
    assert.equal(stats.totalBalance, 0);
    assert.equal(stats.newCount, 0);
    assert.equal(stats.inProductionCount, 0);
    assert.equal(stats.completedCount, 0);
    assert.equal(stats.salesToday, 0);
    assert.equal(stats.salesMonth, 0);
    assert.equal(stats.avgDays, null);
    assert.deepEqual(stats.byCategory, []);
    assert.deepEqual(stats.topCustomers, []);
    assert.deepEqual(stats.topProducts, []);
  });

  test("นับสถานะ 'shipping' รวมอยู่ใน inProductionCount (ไม่หายไปจากทุกการ์ด — บั๊กเดิมที่เคยแก้)", () => {
    const now = Date.now();
    const orders = [
      { status: "shipping", createdAt: ts(now), unit_price: 100, qty: 1 },
    ];
    const stats = computeOrderStats(orders);
    assert.equal(stats.inProductionCount, 1);
    assert.equal(stats.newCount, 0);
    assert.equal(stats.completedCount, 0);
    // activeCount ต้องนับ shipping ด้วย เพราะยังไม่ completed/cancelled
    assert.equal(stats.activeCount, 1);
  });

  test("ยอดค้างชำระรวม (totalBalance) ไม่นับงานที่ยกเลิก", () => {
    const now = Date.now();
    const orders = [
      { status: "production", unit_price: 1000, qty: 1, vatIncluded: true, deposit: 0, createdAt: ts(now) },
      { status: "cancelled", unit_price: 5000, qty: 1, vatIncluded: true, deposit: 0, createdAt: ts(now) },
    ];
    const stats = computeOrderStats(orders);
    assert.equal(stats.totalBalance, 1000);
  });

  test("dueSoonCount/overdueCount แยกงานที่ยังไม่จบตามกำหนดส่ง", () => {
    const now = Date.now();
    const orders = [
      { status: "production", dueDate: dateOffset(-2), createdAt: ts(now), unit_price: 0, qty: 0 }, // overdue
      { status: "production", dueDate: dateOffset(1), createdAt: ts(now), unit_price: 0, qty: 0 },  // due-soon
      { status: "completed", dueDate: dateOffset(-2), createdAt: ts(now), unit_price: 0, qty: 0 },  // เสร็จแล้ว ไม่นับ
    ];
    const stats = computeOrderStats(orders);
    assert.equal(stats.overdueCount, 1);
    assert.equal(stats.dueSoonCount, 1);
  });

  test("byCategory จัดกลุ่มและเรียงจากมากไปน้อย, ไม่มีหมวดใช้ป้ายกำกับ 'ไม่ระบุหมวด'", () => {
    const now = Date.now();
    const orders = [
      { category: "ป้ายไฟ", createdAt: ts(now), unit_price: 0, qty: 0, status: "production" },
      { category: "ป้ายไฟ", createdAt: ts(now), unit_price: 0, qty: 0, status: "production" },
      { createdAt: ts(now), unit_price: 0, qty: 0, status: "production" }, // ไม่มี category
    ];
    const stats = computeOrderStats(orders);
    assert.equal(stats.byCategory[0].name, "ป้ายไฟ");
    assert.equal(stats.byCategory[0].count, 2);
    assert.ok(stats.byCategory.some(c => c.name === "ไม่ระบุหมวด" && c.count === 1));
  });

  test("topProducts รวม qty/revenue ตามชื่อสินค้า (o.item) ไม่รวมงานที่ยกเลิก", () => {
    const now = Date.now();
    const orders = [
      { item: "ป้ายอะคริลิค", qty: 2, unit_price: 100, status: "production", createdAt: ts(now) },
      { item: "ป้ายอะคริลิค", qty: 3, unit_price: 100, status: "completed", createdAt: ts(now) },
      { item: "ป้ายอะคริลิค", qty: 999, unit_price: 100, status: "cancelled", createdAt: ts(now) },
    ];
    const stats = computeOrderStats(orders);
    const p = stats.topProducts.find(p => p.name === "ป้ายอะคริลิค");
    assert.ok(p, "expected 'ป้ายอะคริลิค' in topProducts");
    assert.equal(p.qty, 5); // 2 + 3, ไม่รวม 999 ของงานที่ยกเลิก
    assert.equal(p.orderCount, 2);
  });

  test("avgDays เป็น null ถ้าไม่มีงานที่เสร็จแล้วพร้อมวันที่ครบ", () => {
    const stats = computeOrderStats([{ status: "production", createdAt: ts(Date.now()) }]);
    assert.equal(stats.avgDays, null);
  });

  test("avgDays คำนวณจากผลต่าง createdAt/completedAt ของงานที่เสร็จแล้วเท่านั้น", () => {
    const created = Date.now() - 5 * 86400000; // 5 วันก่อน
    const completed = Date.now();
    const orders = [
      { status: "completed", createdAt: ts(created), completedAt: ts(completed) },
    ];
    const stats = computeOrderStats(orders);
    assert.ok(stats.avgDays >= 4.9 && stats.avgDays <= 5.1, `expected ~5, got ${stats.avgDays}`);
  });
});

describe("computeLeadStats", () => {
  test("leads ว่างเปล่า ไม่ throw", () => {
    const stats = computeLeadStats([]);
    assert.equal(stats.monthly.labels.length, 6);
    assert.equal(stats.hasCloseTimeData, false);
  });

  test("monthlyConversion เป็น null ในเดือนที่ไม่มีลีดปิดจบ (won/lost) เลย", () => {
    const now = Date.now();
    const leads = [{ status: "new", createdAt: ts(now) }];
    const stats = computeLeadStats(leads);
    const lastMonth = stats.monthly.conversionRate[stats.monthly.conversionRate.length - 1];
    assert.equal(lastMonth, null);
  });

  test("monthlyConversion คำนวณ won/(won+lost) เป็นเปอร์เซ็นต์ของเดือนนั้น", () => {
    const now = Date.now();
    const leads = [
      { status: "won", createdAt: ts(now) },
      { status: "won", createdAt: ts(now) },
      { status: "lost", createdAt: ts(now) },
      { status: "new", createdAt: ts(now) }, // ยังไม่ปิด ไม่นับในตัวหาร
    ];
    const stats = computeLeadStats(leads);
    const lastMonth = stats.monthly.conversionRate[stats.monthly.conversionRate.length - 1];
    // won=2, lost=1 -> 2/3 = 67%
    assert.equal(lastMonth, 67);
  });

  test("hasCloseTimeData เป็น true เมื่อมีลีดที่มีทั้ง createdAt และ wonAt", () => {
    const now = Date.now();
    const leads = [
      { status: "won", createdAt: ts(now - 3 * 86400000), wonAt: ts(now) },
    ];
    const stats = computeLeadStats(leads);
    assert.equal(stats.hasCloseTimeData, true);
    const lastCloseTime = stats.monthly.closeTimeDays[stats.monthly.closeTimeDays.length - 1];
    assert.ok(lastCloseTime >= 2.9 && lastCloseTime <= 3.1, `expected ~3, got ${lastCloseTime}`);
  });
});
