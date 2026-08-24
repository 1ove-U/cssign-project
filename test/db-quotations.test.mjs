// test/db-quotations.test.mjs — P3.0 Phase 3 (data layer รอบ 1) + Phase 4 รอบ 1 (publicToken)
//
// ขอบเขต: js/db-quotations.js ไฟล์ใหม่ — sanitizeQuotationItem()/computeLineTotal()/
// computeQuotationTotals() (คำนวณฝั่ง client ล้วนๆ), generateQuoteNo() (runTransaction บน
// counters/quotations), buildQuotationFromRequest() (prefill pure function จาก quote_request),
// addQuotation()/updateQuotation()/deleteQuotation()/getQuotations()/listenQuotations()
// — ดู test/db-quote-requests.test.mjs เป็นต้นแบบโครงสร้างเทส (ไฟล์ data layer ใหม่ล่าสุดก่อน
// รอบนี้) และ test/helpers/firebase-stub-loader.mjs สำหรับ stub ของ runTransaction()
// (__TX_GET_STUB__/__TX_SET_CALLS__/__TX_UPDATE_CALLS__)
//
// P3.0 Phase 4 รอบ 1: เพิ่มเทสของ buildPublicToken()/getQuotationByToken() + การซิงก์สำเนา
// "quotation_public/{publicToken}" ผ่าน setDoc() ใน addQuotation()/updateQuotation()/
// deleteQuotation() — ใช้ globalThis.__SET_DOC_CALLS__/__GET_DOC_STUB__ ของ
// firebase-stub-loader.mjs (pattern เดียวกับ test/db-orders.test.mjs หมวด order_tracking)

import { test, describe, before, afterEach } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { auth } from "../js/db.js";

let sanitizeQuotationItem, computeLineTotal, computeQuotationTotals, generateQuoteNo,
    buildQuotationFromRequest, buildQuotationClone, buildPublicToken, getQuotationByToken,
    addQuotation, updateQuotation, deleteQuotation,
    getQuotations, listenQuotations, submitQuotationResponse, linkQuotationToRequest;

before(async () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "https://example.test/quotations-test" });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  const mod = await import("../js/db-quotations.js");
  ({ sanitizeQuotationItem, computeLineTotal, computeQuotationTotals, generateQuoteNo,
     buildQuotationFromRequest, buildQuotationClone, buildPublicToken, getQuotationByToken,
     addQuotation, updateQuotation, deleteQuotation,
     getQuotations, listenQuotations, submitQuotationResponse, linkQuotationToRequest } = mod);
});

const SAMPLE_ITEM = { name: "ป้ายไฟ LED", variantLabel: "60x40 / อะคริลิค", qty: 2, unit: "ชิ้น", unitPrice: 1500, discount: 100 };

afterEach(() => {
  globalThis.__ADD_DOC_CALLS__ = [];
  globalThis.__UPDATE_DOC_CALLS__ = [];
  globalThis.__DELETE_DOC_CALLS__ = [];
  globalThis.__SET_DOC_CALLS__ = [];
  globalThis.__SNAPSHOT_LISTENERS__ = {};
  globalThis.__TX_GET_STUB__ = undefined;
  globalThis.__TX_SET_CALLS__ = [];
  globalThis.__GET_DOCS_STUB__ = undefined;
  globalThis.__GET_DOC_STUB__ = undefined;
  globalThis.__UPDATE_DOC_STUB__ = undefined;
  auth.currentUser = null;
});

describe("computeLineTotal()", () => {
  test("qty x unitPrice - discount ปกติ", () => {
    assert.equal(computeLineTotal(2, 1500, 100), 2900);
  });
  test("ส่วนลดเกินยอดรวมรายการ → ไม่ติดลบ (เหลือ 0)", () => {
    assert.equal(computeLineTotal(1, 100, 500), 0);
  });
  test("ค่าที่ไม่ใช่ตัวเลขเลย → ถือเป็น 0", () => {
    assert.equal(computeLineTotal("x", "y", "z"), 0);
  });
});

describe("sanitizeQuotationItem()", () => {
  test("ตัด field แปลกปลอมออก + คำนวณ lineTotal ใหม่เสมอ (ไม่เชื่อค่าที่ส่งมา)", () => {
    const dirty = { ...SAMPLE_ITEM, lineTotal: 999999, productId: "p1", note: "x" };
    const clean = sanitizeQuotationItem(dirty);
    assert.equal(clean.lineTotal, 2900);
    assert.equal("productId" in clean, false);
    assert.equal("note" in clean, false);
  });
  test("item ไม่ใช่ object → null", () => {
    assert.equal(sanitizeQuotationItem(null), null);
    assert.equal(sanitizeQuotationItem("x"), null);
  });
  test("qty ไม่ถูกต้อง (0/ติดลบ/ไม่ใช่ตัวเลข) → default เป็น 1", () => {
    assert.equal(sanitizeQuotationItem({ ...SAMPLE_ITEM, qty: 0 }).qty, 1);
    assert.equal(sanitizeQuotationItem({ ...SAMPLE_ITEM, qty: -5 }).qty, 1);
    assert.equal(sanitizeQuotationItem({ ...SAMPLE_ITEM, qty: "abc" }).qty, 1);
  });
});

describe("computeQuotationTotals()", () => {
  test("vatMode excluded — บวก VAT 7% เพิ่มเข้าไปเป็นยอดสุทธิ", () => {
    const totals = computeQuotationTotals([SAMPLE_ITEM], "excluded");
    assert.equal(totals.subtotal, 2900);
    assert.equal(totals.vatAmount, 203);
    assert.equal(totals.grandTotal, 3103);
  });
  test("vatMode included — แยก VAT ออกมาโชว์เฉยๆ ยอดสุทธิเท่ากับ subtotal เดิม", () => {
    const totals = computeQuotationTotals([{ ...SAMPLE_ITEM, unitPrice: 1070, discount: 0, qty: 1 }], "included");
    assert.equal(totals.subtotal, 1070);
    assert.equal(totals.vatAmount, 70);
    assert.equal(totals.grandTotal, 1070);
  });
  test("vatMode none — ไม่มี VAT เลย", () => {
    const totals = computeQuotationTotals([SAMPLE_ITEM], "none");
    assert.equal(totals.vatAmount, 0);
    assert.equal(totals.grandTotal, 2900);
  });
  test("items ว่างเปล่า → ทุกค่าเป็น 0 ไม่ throw", () => {
    const totals = computeQuotationTotals([], "excluded");
    assert.deepEqual(totals, { subtotal: 0, vatAmount: 0, grandTotal: 0 });
  });
  test("vatMode แปลกปลอม/ไม่รู้จัก → fail-safe เหมือน none (ไม่มี VAT)", () => {
    const totals = computeQuotationTotals([SAMPLE_ITEM], "bogus");
    assert.equal(totals.vatAmount, 0);
  });
});

describe("generateQuoteNo()", () => {
  test("ยังไม่มี counter doc มาก่อนเลย → เริ่มจาก 0001 ปีปัจจุบัน", async () => {
    globalThis.__TX_GET_STUB__ = () => ({ exists: false });
    const quoteNo = await generateQuoteNo();
    const year = new Date().getFullYear();
    assert.equal(quoteNo, `QT${year}-0001`);
    assert.equal(globalThis.__TX_SET_CALLS__[0].path, "counters/quotations");
    assert.equal(globalThis.__TX_SET_CALLS__[0].payload.seq, 1);
    assert.equal(globalThis.__TX_SET_CALLS__[0].payload.year, year);
  });

  test("มี counter doc ปีเดียวกันอยู่แล้ว (seq=6) → รันต่อเป็น 0007", async () => {
    const year = new Date().getFullYear();
    globalThis.__TX_GET_STUB__ = () => ({ exists: true, data: { year, seq: 6 } });
    const quoteNo = await generateQuoteNo();
    assert.equal(quoteNo, `QT${year}-0007`);
    assert.equal(globalThis.__TX_SET_CALLS__[0].payload.seq, 7);
  });

  test("counter doc เป็นปีเก่ากว่าปัจจุบัน → รีเซ็ตกลับเป็น 0001 ปีใหม่", async () => {
    const year = new Date().getFullYear();
    globalThis.__TX_GET_STUB__ = () => ({ exists: true, data: { year: year - 1, seq: 42 } });
    const quoteNo = await generateQuoteNo();
    assert.equal(quoteNo, `QT${year}-0001`);
    assert.equal(globalThis.__TX_SET_CALLS__[0].payload.seq, 1);
    assert.equal(globalThis.__TX_SET_CALLS__[0].payload.year, year);
  });
});

describe("buildQuotationFromRequest()", () => {
  const SAMPLE_REQUEST = {
    id: "req1", billingName: "สมชาย", taxId: "1101700207455", billingAddress: "123 ถ.สุขุมวิท",
    contactPerson: "คุณสมชาย", phone: "0812345678", email: "a@b.com", shippingAddress: "ที่เดียวกัน",
    paymentTermsRequested: "เงินสด", notes: "ต้องการด่วน",
    items: [{ productId: "p1", name: "ป้ายไฟ LED", variantLabel: "60x40", size: "60x40", material: "อะคริลิค", qty: 3, unit: "ชิ้น", note: "x" }]
  };

  test("prefill ครบทุก field ที่มี + requestId ผูกกลับคำขอเดิม", () => {
    const draft = buildQuotationFromRequest(SAMPLE_REQUEST);
    assert.equal(draft.requestId, "req1");
    assert.equal(draft.billingName, "สมชาย");
    assert.equal(draft.taxId, "1101700207455");
    assert.equal(draft.paymentTerms, "เงินสด");
    assert.equal(draft.vatMode, "excluded");
  });

  test("items แปลง shape ถูกต้อง — unitPrice/discount เริ่มที่ 0 เสมอ (แอดมินต้องกรอกเอง)", () => {
    const draft = buildQuotationFromRequest(SAMPLE_REQUEST);
    assert.equal(draft.items.length, 1);
    assert.equal(draft.items[0].name, "ป้ายไฟ LED");
    assert.equal(draft.items[0].qty, 3);
    assert.equal(draft.items[0].unitPrice, 0);
    assert.equal(draft.items[0].discount, 0);
    assert.equal("productId" in draft.items[0], false);
  });

  test("request เป็น undefined/ว่างเปล่า → ไม่ throw คืนค่า default ทั้งหมด", () => {
    const draft = buildQuotationFromRequest(undefined);
    assert.equal(draft.requestId, null);
    assert.equal(draft.billingName, "");
    assert.deepEqual(draft.items, []);
  });
});

describe("buildQuotationClone() (P3.0 Phase 6 รอบ 11)", () => {
  const SAMPLE_QUOTATION = {
    id: "q1", quoteNo: "QT2026-0007", publicToken: "abc-123-uuid", requestId: "req9",
    billingName: "สมชาย", taxId: "1101700207455", billingAddress: "123 ถ.สุขุมวิท",
    contactPerson: "คุณสมชาย", phone: "0812345678", email: "a@b.com", shippingAddress: "ที่เดียวกัน",
    items: [{ name: "ป้ายไฟ LED", variantLabel: "60x40", qty: 2, unit: "ชิ้น", unitPrice: 1500, discount: 100 }],
    vatMode: "included", paymentTerms: "เงินสด", validUntil: "2026-01-01", notes: "โน้ตเดิม",
    status: "sent", customerResponse: { action: "accepted", comment: "โอเค" }
  };

  test("copy field ข้อมูลลูกค้า/รายการสินค้า/vatMode/paymentTerms/notes มาครบ", () => {
    const clone = buildQuotationClone(SAMPLE_QUOTATION);
    assert.equal(clone.billingName, "สมชาย");
    assert.equal(clone.taxId, "1101700207455");
    assert.equal(clone.billingAddress, "123 ถ.สุขุมวิท");
    assert.equal(clone.contactPerson, "คุณสมชาย");
    assert.equal(clone.phone, "0812345678");
    assert.equal(clone.email, "a@b.com");
    assert.equal(clone.shippingAddress, "ที่เดียวกัน");
    assert.equal(clone.vatMode, "included");
    assert.equal(clone.paymentTerms, "เงินสด");
    assert.equal(clone.notes, "โน้ตเดิม");
  });

  test("items คัด unitPrice/discount ที่กรอกไว้แล้วมาด้วย (ต่างจาก buildQuotationFromRequest ที่ตั้ง 0 เสมอ)", () => {
    const clone = buildQuotationClone(SAMPLE_QUOTATION);
    assert.equal(clone.items.length, 1);
    assert.equal(clone.items[0].name, "ป้ายไฟ LED");
    assert.equal(clone.items[0].qty, 2);
    assert.equal(clone.items[0].unitPrice, 1500);
    assert.equal(clone.items[0].discount, 100);
  });

  test("quoteNo/publicToken ไม่ถูก copy มาเลย (generate ใหม่ผ่าน addQuotation() เอง)", () => {
    const clone = buildQuotationClone(SAMPLE_QUOTATION);
    assert.equal("quoteNo" in clone, false);
    assert.equal("publicToken" in clone, false);
  });

  test("status บังคับเป็น draft เสมอ ไม่สนใจ status ต้นฉบับ", () => {
    const clone = buildQuotationClone(SAMPLE_QUOTATION);
    assert.equal(clone.status, "draft");
  });

  test("validUntil เคลียร์เป็นค่าว่างเสมอ (ไม่ copy วันหมดอายุเดิม)", () => {
    const clone = buildQuotationClone(SAMPLE_QUOTATION);
    assert.equal(clone.validUntil, "");
  });

  test("requestId เป็น null เสมอ (ไม่ผูกกลับคำขอเดิมของต้นฉบับ)", () => {
    const clone = buildQuotationClone(SAMPLE_QUOTATION);
    assert.equal(clone.requestId, null);
  });

  test("customerResponse ไม่ถูก copy มาเลย (ฉบับร่างใหม่ยังไม่เคยส่งลูกค้าดู)", () => {
    const clone = buildQuotationClone(SAMPLE_QUOTATION);
    assert.equal("customerResponse" in clone, false);
  });

  test("vatMode แปลกปลอม/ไม่รู้จัก → fallback เป็น excluded (เหมือน addQuotation())", () => {
    const clone = buildQuotationClone({ ...SAMPLE_QUOTATION, vatMode: "bogus" });
    assert.equal(clone.vatMode, "excluded");
  });

  test("quotation เป็น undefined/ว่างเปล่า → ไม่ throw คืนค่า default ทั้งหมด", () => {
    const clone = buildQuotationClone(undefined);
    assert.equal(clone.requestId, null);
    assert.equal(clone.billingName, "");
    assert.equal(clone.status, "draft");
    assert.equal(clone.validUntil, "");
    assert.deepEqual(clone.items, []);
  });

  test("item unitPrice/discount ไม่ใช่ตัวเลข (undefined/สตริง) → fallback เป็น 0", () => {
    const dirty = { ...SAMPLE_QUOTATION, items: [{ name: "x", qty: 1, unit: "ชิ้น" }] };
    const clone = buildQuotationClone(dirty);
    assert.equal(clone.items[0].unitPrice, 0);
    assert.equal(clone.items[0].discount, 0);
  });
});

describe("addQuotation()", () => {
  test("บันทึกสำเร็จ → เรียก addDoc() กับ collection quotations พร้อม quoteNo ที่จัดให้อัตโนมัติ", async () => {
    globalThis.__TX_GET_STUB__ = () => ({ exists: false });
    const result = await addQuotation({ billingName: "สมชาย", items: [SAMPLE_ITEM], vatMode: "excluded" });

    const year = new Date().getFullYear();
    assert.equal(result.quoteNo, `QT${year}-0001`);
    const call = globalThis.__ADD_DOC_CALLS__[0];
    assert.equal(call.path, "quotations");
    assert.equal(call.payload.quoteNo, `QT${year}-0001`);
    assert.equal(call.payload.status, "draft");
  });

  test("สร้าง publicToken อัตโนมัติ (UUID) + บันทึกลง payload หลัก + คืนใน result", async () => {
    globalThis.__TX_GET_STUB__ = () => ({ exists: false });
    const result = await addQuotation({ billingName: "สมชาย", items: [SAMPLE_ITEM], vatMode: "excluded" });

    const call = globalThis.__ADD_DOC_CALLS__[0];
    assert.equal(typeof call.payload.publicToken, "string");
    assert.match(call.payload.publicToken, /^[0-9a-f-]{36}$/);
    assert.equal(result.publicToken, call.payload.publicToken);
  });

  test("เขียนสำเนา public ไปที่ quotation_public/{publicToken} พร้อมข้อมูลแสดงผลครบ", async () => {
    globalThis.__TX_GET_STUB__ = () => ({ exists: false });
    auth.currentUser = { uid: "staff-1" };
    const result = await addQuotation({
      billingName: "สมชาย", taxId: "1101700207455", items: [SAMPLE_ITEM], vatMode: "excluded", requestId: "req1"
    });

    const setCall = globalThis.__SET_DOC_CALLS__[0];
    assert.equal(setCall.path, `quotation_public/${result.publicToken}`);
    assert.equal(setCall.payload.billingName, "สมชาย");
    assert.equal(setCall.payload.taxId, "1101700207455");
    assert.equal(setCall.payload.subtotal, 2900);
    assert.equal(setCall.payload.grandTotal, 3103);
    assert.equal(setCall.payload.status, "draft");
    // ไม่คัดลอก field ภายในที่ลูกค้าไม่จำเป็นต้องรู้
    assert.equal("createdBy" in setCall.payload, false);
    assert.equal("requestId" in setCall.payload, false);
  });

  test("คำนวณ subtotal/vatAmount/grandTotal จาก items ให้อัตโนมัติ", async () => {
    globalThis.__TX_GET_STUB__ = () => ({ exists: false });
    await addQuotation({ billingName: "สมชาย", items: [SAMPLE_ITEM], vatMode: "excluded" });

    const { payload } = globalThis.__ADD_DOC_CALLS__[0];
    assert.equal(payload.subtotal, 2900);
    assert.equal(payload.vatAmount, 203);
    assert.equal(payload.grandTotal, 3103);
  });

  test("vatMode ไม่ถูกต้อง/ไม่ส่งมา → fallback เป็น 'excluded'", async () => {
    globalThis.__TX_GET_STUB__ = () => ({ exists: false });
    await addQuotation({ billingName: "สมชาย", items: [SAMPLE_ITEM] });
    assert.equal(globalThis.__ADD_DOC_CALLS__[0].payload.vatMode, "excluded");
  });

  test("createdBy เป็น uid ของแอดมินที่ login อยู่", async () => {
    globalThis.__TX_GET_STUB__ = () => ({ exists: false });
    auth.currentUser = { uid: "staff-1" };
    await addQuotation({ billingName: "สมชาย", items: [SAMPLE_ITEM] });
    assert.equal(globalThis.__ADD_DOC_CALLS__[0].payload.createdBy, "staff-1");
  });

  // P3.0 Phase 5 รอบ 7 — ฝังลิงก์กลับไปที่ quote_requests/{requestId} อัตโนมัติถ้ามี requestId มาด้วย
  test("มี requestId มาด้วย → เรียก linkQuotationToRequest() เขียนกลับไปที่ quote_requests/{requestId}", async () => {
    globalThis.__TX_GET_STUB__ = () => ({ exists: false });
    const result = await addQuotation({ billingName: "สมชาย", items: [SAMPLE_ITEM], requestId: "req1" });

    const updateCall = globalThis.__UPDATE_DOC_CALLS__[0];
    assert.equal(updateCall.path, "quote_requests/req1");
    assert.equal(updateCall.payload.quotationId, result.id);
    assert.equal(updateCall.payload.quotePublicToken, result.publicToken);
    assert.equal(updateCall.payload.status, "quoted");
  });

  test("ไม่มี requestId (สร้างจากศูนย์) → ไม่แตะ quote_requests เลย", async () => {
    globalThis.__TX_GET_STUB__ = () => ({ exists: false });
    await addQuotation({ billingName: "สมชาย", items: [SAMPLE_ITEM] });
    assert.equal(globalThis.__UPDATE_DOC_CALLS__.length, 0);
  });
});

describe("linkQuotationToRequest()", () => {
  test("เขียน quotationId/quotePublicToken/status=\"quoted\" ไปที่ quote_requests/{requestId}", async () => {
    await linkQuotationToRequest("req1", "q1", "tok-abc");
    const call = globalThis.__UPDATE_DOC_CALLS__[0];
    assert.equal(call.path, "quote_requests/req1");
    assert.deepEqual(call.payload, { quotationId: "q1", quotePublicToken: "tok-abc", status: "quoted" });
  });

  test("requestId ว่าง/ไม่ใช่ string → ไม่เรียก updateDoc() เลย", async () => {
    await linkQuotationToRequest("", "q1", "tok-abc");
    await linkQuotationToRequest(null, "q1", "tok-abc");
    assert.equal(globalThis.__UPDATE_DOC_CALLS__.length, 0);
  });

  test("quotationId/publicToken ว่าง → fallback เป็น string ว่าง ไม่ throw", async () => {
    await linkQuotationToRequest("req1", "", "");
    const call = globalThis.__UPDATE_DOC_CALLS__[0];
    assert.equal(call.payload.quotationId, "");
    assert.equal(call.payload.quotePublicToken, "");
  });

  test("updateDoc() ล้มเหลว → ไม่ throw ต่อ (จับ error เงียบๆ)", async () => {
    globalThis.__UPDATE_DOC_STUB__ = () => ({ throw: new Error("permission-denied") });
    await assert.doesNotReject(() => linkQuotationToRequest("req1", "q1", "tok-abc"));
  });
});

describe("updateQuotation()", () => {
  test("แก้ items → คำนวณยอดรวมใหม่ทั้งหมด", async () => {
    await updateQuotation("q1", { items: [SAMPLE_ITEM, SAMPLE_ITEM], vatMode: "excluded" });
    const { path, payload } = globalThis.__UPDATE_DOC_CALLS__[0];
    assert.equal(path, "quotations/q1");
    assert.equal(payload.subtotal, 5800);
    assert.equal(payload.grandTotal, 6206);
  });

  test("แก้ field ที่ไม่เกี่ยวกับ items/vatMode (เช่น notes) → ไม่แตะยอดรวม", async () => {
    await updateQuotation("q1", { notes: "แก้หมายเหตุ" });
    const { payload } = globalThis.__UPDATE_DOC_CALLS__[0];
    assert.equal(payload.notes, "แก้หมายเหตุ");
    assert.equal("subtotal" in payload, false);
  });

  test("พยายามแก้ quoteNo/publicToken/createdAt/createdBy → ถูกละทิ้งเงียบๆ ไม่ส่งเข้า payload", async () => {
    await updateQuotation("q1", {
      quoteNo: "QT2099-9999", publicToken: "hacked-token", createdAt: "hacked", createdBy: "someone-else", notes: "x"
    });
    const { payload } = globalThis.__UPDATE_DOC_CALLS__[0];
    assert.equal("quoteNo" in payload, false);
    assert.equal("publicToken" in payload, false);
    assert.equal("createdAt" in payload, false);
    assert.equal("createdBy" in payload, false);
  });

  test("status แปลกปลอม (ไม่อยู่ใน whitelist) → ไม่แก้ status", async () => {
    await updateQuotation("q1", { status: "bogus-status" });
    const { payload } = globalThis.__UPDATE_DOC_CALLS__[0];
    assert.equal("status" in payload, false);
  });

  test("status ที่ถูกต้อง → แก้ปกติ", async () => {
    await updateQuotation("q1", { status: "sent" });
    const { payload } = globalThis.__UPDATE_DOC_CALLS__[0];
    assert.equal(payload.status, "sent");
  });

  test("ซิงก์สำเนา public: อ่าน publicToken จากเอกสารเดิม แล้วเขียนสำเนาที่ path เดียวกันด้วยข้อมูลรวมล่าสุด", async () => {
    globalThis.__GET_DOC_STUB__ = () => ({
      exists: true,
      data: { publicToken: "tok-abc", billingName: "สมชาย (เดิม)", items: [], vatMode: "excluded", status: "draft" }
    });
    await updateQuotation("q1", { status: "sent" });
    const setCall = globalThis.__SET_DOC_CALLS__[0];
    assert.equal(setCall.path, "quotation_public/tok-abc");
    assert.equal(setCall.payload.status, "sent");
    // field ที่ patch รอบนี้ไม่ได้แตะ (billingName) ต้องยังคงมาจากเอกสารเดิมที่อ่านมา merge
    assert.equal(setCall.payload.billingName, "สมชาย (เดิม)");
  });

  test("เอกสารเดิมไม่มี publicToken (สร้างก่อนรอบ Phase 4) → ไม่เขียนสำเนา public (ไม่ throw)", async () => {
    globalThis.__GET_DOC_STUB__ = () => ({ exists: true, data: { billingName: "สมชาย" } });
    await updateQuotation("q1", { status: "sent" });
    assert.equal(globalThis.__SET_DOC_CALLS__.length, 0);
  });
});

describe("deleteQuotation()", () => {
  test("ลบ doc ที่ path ถูกต้อง", async () => {
    await deleteQuotation("q1");
    assert.equal(globalThis.__DELETE_DOC_CALLS__[0].path, "quotations/q1");
  });

  test("มี publicToken เดิม → ลบสำเนา public คู่กันด้วย", async () => {
    globalThis.__GET_DOC_STUB__ = () => ({ exists: true, data: { publicToken: "tok-xyz" } });
    await deleteQuotation("q1");
    assert.equal(globalThis.__DELETE_DOC_CALLS__[0].path, "quotations/q1");
    assert.equal(globalThis.__DELETE_DOC_CALLS__[1].path, "quotation_public/tok-xyz");
  });

  test("ไม่มี publicToken เดิม (เอกสารเก่า) → ลบแค่เอกสารหลัก ไม่พยายามลบสำเนา public", async () => {
    globalThis.__GET_DOC_STUB__ = () => ({ exists: true, data: { billingName: "สมชาย" } });
    await deleteQuotation("q1");
    assert.equal(globalThis.__DELETE_DOC_CALLS__.length, 1);
  });
});

describe("buildPublicToken()", () => {
  test("คืนค่า UUID v4 string ที่ไม่ซ้ำกันทุกครั้งที่เรียก", () => {
    const a = buildPublicToken();
    const b = buildPublicToken();
    assert.match(a, /^[0-9a-f-]{36}$/);
    assert.notEqual(a, b);
  });
});

describe("getQuotationByToken()", () => {
  test("พบเอกสาร → คืน { id, ...data } (stub ของ getDoc() ไม่คืน snap.id จริง จึงเป็น undefined ในเทสนี้ — id จริงมาจาก Firestore SDK ตอน production)", async () => {
    globalThis.__GET_DOC_STUB__ = () => ({ exists: true, data: { quoteNo: "QT2026-0001", billingName: "สมชาย" } });
    const result = await getQuotationByToken("tok-abc");
    assert.equal(result.quoteNo, "QT2026-0001");
    assert.equal(result.billingName, "สมชาย");
    assert.equal("id" in result, true);
  });

  test("ไม่พบเอกสาร (token ผิด) → คืน null", async () => {
    globalThis.__GET_DOC_STUB__ = () => ({ exists: false });
    const result = await getQuotationByToken("tok-wrong");
    assert.equal(result, null);
  });

  test("token ว่าง/ไม่ใช่ string → คืน null ทันที ไม่เรียก Firestore", async () => {
    assert.equal(await getQuotationByToken(""), null);
    assert.equal(await getQuotationByToken(null), null);
    assert.equal(await getQuotationByToken(undefined), null);
  });
});

// P3.0 Phase 4 รอบ 4: submitQuotationResponse() — ลูกค้ากด "ยอมรับ"/"ขอแก้ไข" เองจากหน้า public
// (quotation-view.html) ไม่ต้อง login — เขียนทั้ง quotations/{quotationId} (updateDoc) และ
// quotation_public/{publicToken} (setDoc ทับทั้ง doc) พร้อมกัน — ดูคอมเมนต์หัวไฟล์หัวข้อ
// "Phase 4 (รอบ 4 ...)" สำหรับเหตุผลที่เขียน status ตรงๆ แทน log แยกแบบ design_approvals
describe("submitQuotationResponse()", () => {
  test("submit \"accepted\" สำเร็จ → updateDoc()/setDoc() ได้ payload ถูกต้อง", async () => {
    globalThis.__GET_DOC_STUB__ = () => ({
      exists: true,
      data: { quotationId: "q1", billingName: "สมชาย", status: "sent" }
    });
    await submitQuotationResponse("tok-abc", "accepted");

    const updateCall = globalThis.__UPDATE_DOC_CALLS__[0];
    assert.equal(updateCall.path, "quotations/q1");
    assert.equal(updateCall.payload.status, "accepted");
    assert.equal(updateCall.payload.customerResponse.action, "accepted");
    assert.equal(updateCall.payload.customerResponse.comment, "");

    const setCall = globalThis.__SET_DOC_CALLS__[0];
    assert.equal(setCall.path, "quotation_public/tok-abc");
    assert.equal(setCall.payload.status, "accepted");
    assert.equal(setCall.payload.customerResponse.action, "accepted");
    // field เดิมของสำเนา public ต้องยังอยู่ครบ (spread publicData เดิมมาก่อน)
    assert.equal(setCall.payload.billingName, "สมชาย");
  });

  test("submit \"changes_requested\" พร้อม comment สำเร็จ", async () => {
    globalThis.__GET_DOC_STUB__ = () => ({
      exists: true,
      data: { quotationId: "q1", status: "sent" }
    });
    await submitQuotationResponse("tok-abc", "changes_requested", "ขอเปลี่ยนสีเป็นน้ำเงิน");

    const updateCall = globalThis.__UPDATE_DOC_CALLS__[0];
    assert.equal(updateCall.payload.status, "changes_requested");
    assert.equal(updateCall.payload.customerResponse.comment, "ขอเปลี่ยนสีเป็นน้ำเงิน");
  });

  test("publicToken ไม่พบ → throw ไม่เรียก updateDoc()/setDoc()", async () => {
    globalThis.__GET_DOC_STUB__ = () => ({ exists: false });
    await assert.rejects(() => submitQuotationResponse("tok-wrong", "accepted"));
    assert.equal(globalThis.__UPDATE_DOC_CALLS__.length, 0);
    assert.equal(globalThis.__SET_DOC_CALLS__.length, 0);
  });

  test("มี customerResponse อยู่แล้ว (กดซ้ำ) → throw", async () => {
    globalThis.__GET_DOC_STUB__ = () => ({
      exists: true,
      data: { quotationId: "q1", status: "accepted", customerResponse: { action: "accepted" } }
    });
    await assert.rejects(() => submitQuotationResponse("tok-abc", "accepted"));
    assert.equal(globalThis.__UPDATE_DOC_CALLS__.length, 0);
  });

  test("ไม่มี quotationId ในสำเนา public (เอกสารเก่า) → throw", async () => {
    globalThis.__GET_DOC_STUB__ = () => ({ exists: true, data: { billingName: "สมชาย" } });
    await assert.rejects(() => submitQuotationResponse("tok-abc", "accepted"));
    assert.equal(globalThis.__UPDATE_DOC_CALLS__.length, 0);
  });

  test("action ไม่ถูกต้อง (ไม่ใช่ accepted/changes_requested) → throw ก่อนเรียก Firestore เลย", async () => {
    await assert.rejects(() => submitQuotationResponse("tok-abc", "rejected"));
    assert.equal(globalThis.__UPDATE_DOC_CALLS__.length, 0);
    assert.equal(globalThis.__SET_DOC_CALLS__.length, 0);
  });

  test("publicToken ว่าง/ไม่ใช่ string → throw ก่อนเรียก Firestore เลย", async () => {
    await assert.rejects(() => submitQuotationResponse("", "accepted"));
    await assert.rejects(() => submitQuotationResponse(null, "accepted"));
    assert.equal(globalThis.__UPDATE_DOC_CALLS__.length, 0);
  });

  test("comment ยาวเกิน 2000 ตัวอักษร → ถูกตัดสั้นลงเหลือ 2000", async () => {
    globalThis.__GET_DOC_STUB__ = () => ({ exists: true, data: { quotationId: "q1", status: "sent" } });
    const longComment = "ก".repeat(2500);
    await submitQuotationResponse("tok-abc", "changes_requested", longComment);
    const updateCall = globalThis.__UPDATE_DOC_CALLS__[0];
    assert.equal(updateCall.payload.customerResponse.comment.length, 2000);
  });
});

describe("getQuotations()", () => {
  test("คืน array ที่ map { id, ...data } ถูกต้อง", async () => {
    globalThis.__GET_DOCS_STUB__ = () => [
      { id: "q1", data: { quoteNo: "QT2026-0001", status: "draft" } },
      { id: "q2", data: { quoteNo: "QT2026-0002", status: "sent" } }
    ];
    const result = await getQuotations();
    assert.deepEqual(result, [
      { id: "q1", quoteNo: "QT2026-0001", status: "draft" },
      { id: "q2", quoteNo: "QT2026-0002", status: "sent" }
    ]);
  });
});

describe("listenQuotations()", () => {
  test("ผูก listener บน collection \"quotations\" + callback ได้รับรายการที่ map ถูกต้อง", () => {
    let received = null;
    listenQuotations(list => { received = list; });

    const cb = globalThis.__SNAPSHOT_LISTENERS__["quotations"];
    assert.equal(typeof cb, "function");
    cb({ docs: [{ id: "q1", data: () => ({ quoteNo: "QT2026-0001" }) }] });

    assert.deepEqual(received, [{ id: "q1", quoteNo: "QT2026-0001" }]);
  });
});
