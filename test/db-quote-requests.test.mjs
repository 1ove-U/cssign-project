// test/db-quote-requests.test.mjs — P3.0 Phase 2 รอบย่อย 1
//
// ขอบเขต: js/db-quote-requests.js ไฟล์ใหม่ — saveQuoteRequest() (บันทึกลง collection
// "quote_requests" แยกจาก "leads"), listenMyQuoteRequests() (pattern เดียวกับ listenMyLeads()
// ใน js/leads.js เป๊ะ), isValidThaiTaxId() (validate checksum เลขผู้เสียภาษี 13 หลัก ฝั่ง
// client) — ดู test/leads-line-history.test.mjs เป็นต้นแบบโครงสร้างเทส

import { test, describe, before, afterEach } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { auth } from "../js/db.js";

let saveQuoteRequest, listenMyQuoteRequests, isValidThaiTaxId;

before(async () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "https://example.test/quote-request-test" });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  const mod = await import("../js/db-quote-requests.js");
  saveQuoteRequest = mod.saveQuoteRequest;
  listenMyQuoteRequests = mod.listenMyQuoteRequests;
  isValidThaiTaxId = mod.isValidThaiTaxId;
});

const originalFetch = globalThis.fetch;
const SAMPLE_ITEM = { productId: "p1", name: "ป้ายไฟ LED", variantLabel: "60x40 / อะคริลิค", size: "60x40", material: "อะคริลิค", qty: 2, unit: "ชิ้น", note: "" };

function stubTurnstileOk() {
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({ success: true })
  });
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  globalThis.__ADD_DOC_CALLS__ = [];
  globalThis.__SNAPSHOT_LISTENERS__ = {};
  auth.currentUser = null;
});

describe("saveQuoteRequest()", () => {
  test("บันทึกสำเร็จ → เรียก addDoc() กับ collection quote_requests (ไม่ใช่ leads)", async () => {
    stubTurnstileOk();
    await saveQuoteRequest({ billingName: "สมชาย", phone: "0812345678" }, [SAMPLE_ITEM], "quote_request_cart", "tok");

    const call = globalThis.__ADD_DOC_CALLS__[0];
    assert.ok(call, "ต้องมีการเรียก addDoc()");
    assert.equal(call.path, "quote_requests");
  });

  test("payload มี items ที่ sanitize แล้ว + status/source/createdAt ถูกต้อง", async () => {
    stubTurnstileOk();
    await saveQuoteRequest({ billingName: "สมชาย", phone: "0812345678" }, [SAMPLE_ITEM], "quote_request_cart", "tok");

    const { payload } = globalThis.__ADD_DOC_CALLS__[0];
    assert.equal(payload.billingName, "สมชาย");
    assert.equal(payload.status, "new");
    assert.equal(payload.source, "quote_request_cart");
    assert.equal(payload.items.length, 1);
    assert.equal(payload.items[0].productId, "p1");
    assert.equal(payload.items[0].qty, 2);
  });

  test("sanitizeItem ตัด field แปลกปลอม (เช่น image/unitPriceHint จาก getCartItems()) ออก", async () => {
    stubTurnstileOk();
    const dirtyItem = { ...SAMPLE_ITEM, image: "https://example.com/x.jpg", unitPriceHint: "฿1,200 (โดยประมาณ)" };
    await saveQuoteRequest({ billingName: "สมชาย", phone: "0812345678" }, [dirtyItem], "quote_request_cart", "tok");

    const { payload } = globalThis.__ADD_DOC_CALLS__[0];
    assert.equal("image" in payload.items[0], false);
    assert.equal("unitPriceHint" in payload.items[0], false);
  });

  test("items ว่างเปล่า (ตะกร้าว่าง) → throw ไม่เรียก addDoc() (บังคับต้องมีสินค้าอย่างน้อย 1 ชิ้น)", async () => {
    stubTurnstileOk();
    await assert.rejects(
      () => saveQuoteRequest({ billingName: "สมชาย", phone: "08" }, [], "quote_request_cart", "tok"),
      /ต้องมีรายการสินค้าอย่างน้อย 1 ชิ้น/
    );
    assert.equal((globalThis.__ADD_DOC_CALLS__ || []).length, 0);
  });

  test("items ไม่ใช่ array เลย (undefined) → throw เหมือนกัน", async () => {
    stubTurnstileOk();
    await assert.rejects(() => saveQuoteRequest({ billingName: "สมชาย" }, undefined, "quote_request_cart", "tok"));
    assert.equal((globalThis.__ADD_DOC_CALLS__ || []).length, 0);
  });

  test("verifyTurnstileToken() ไม่ผ่าน → throw ก่อนถึงจุด sanitize items เลย ไม่เรียก addDoc()", async () => {
    globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => ({ success: false }) });
    await assert.rejects(
      () => saveQuoteRequest({ billingName: "สมชาย" }, [SAMPLE_ITEM], "quote_request_cart", "bad-token"),
      /Turnstile verification failed/
    );
    assert.equal((globalThis.__ADD_DOC_CALLS__ || []).length, 0);
  });

  test("login LINE อยู่ (uid ขึ้นต้น 'line_') → payload แนบ lineUserId ตัดคำนำหน้าออก (เหมือน saveLead())", async () => {
    stubTurnstileOk();
    auth.currentUser = { uid: "line_U9999" };
    await saveQuoteRequest({ billingName: "วิภา", phone: "089" }, [SAMPLE_ITEM], "quote_request_cart", "tok");

    const { payload } = globalThis.__ADD_DOC_CALLS__[0];
    assert.equal(payload.lineUserId, "U9999");
  });

  test("guest (ไม่ login) → payload ไม่มี key lineUserId เลย", async () => {
    stubTurnstileOk();
    auth.currentUser = null;
    await saveQuoteRequest({ billingName: "วิภา", phone: "089" }, [SAMPLE_ITEM], "quote_request_cart", "tok");

    const { payload } = globalThis.__ADD_DOC_CALLS__[0];
    assert.equal("lineUserId" in payload, false);
  });
});

describe("listenMyQuoteRequests()", () => {
  test("ไม่มี lineUserId → เรียก onError ถ้ามี ไม่ throw", () => {
    let errCaught = null;
    listenMyQuoteRequests(undefined, () => {}, err => { errCaught = err; });
    assert.ok(errCaught);
    assert.match(errCaught.message, /listenMyQuoteRequests/);
  });

  test("ผูก listener บน collection \"quote_requests\" (คนละ path กับ leads/orders)", () => {
    listenMyQuoteRequests("U1234", () => {});
    assert.equal(typeof globalThis.__SNAPSHOT_LISTENERS__["quote_requests"], "function");
  });

  test("ยิง snapshot ปลอมเข้ามา → callback ได้รับรายการที่ map { id, ...data } ถูกต้อง", () => {
    let received = null;
    listenMyQuoteRequests("U1234", reqs => { received = reqs; });

    const cb = globalThis.__SNAPSHOT_LISTENERS__["quote_requests"];
    cb({
      docs: [
        { id: "q1", data: () => ({ billingName: "สมชาย", lineUserId: "U1234", status: "new" }) },
        { id: "q2", data: () => ({ billingName: "วิภา", lineUserId: "U1234", status: "quoted" }) }
      ]
    });

    assert.deepEqual(received, [
      { id: "q1", billingName: "สมชาย", lineUserId: "U1234", status: "new" },
      { id: "q2", billingName: "วิภา", lineUserId: "U1234", status: "quoted" }
    ]);
  });
});

describe("isValidThaiTaxId()", () => {
  test("ค่าว่างเปล่า/undefined → true (optional field ไม่บังคับกรอก)", () => {
    assert.equal(isValidThaiTaxId(""), true);
    assert.equal(isValidThaiTaxId(undefined), true);
  });

  test("13 หลักที่ผ่าน checksum จริง → true", () => {
    // 1101700207455 คำนวณ mod-11 checksum จากหลัก 1-12 ("110170020745") ได้หลักที่ 13 = 5 จริง
    assert.equal(isValidThaiTaxId("1101700207455"), true);
  });

  test("13 หลักแต่ checksum ไม่ผ่าน (เปลี่ยนหลักสุดท้าย) → false", () => {
    assert.equal(isValidThaiTaxId("1101700207451"), false);
  });

  test("มีตัวคั่น (ขีด/ช่องว่าง) แต่ตัดแล้วผ่าน checksum → true", () => {
    assert.equal(isValidThaiTaxId("1-1017-00207-45-5"), true);
  });

  test("ไม่ครบ 13 หลัก → false", () => {
    assert.equal(isValidThaiTaxId("12345"), false);
  });

  test("มีตัวอักษรปน → false", () => {
    assert.equal(isValidThaiTaxId("110170020745X"), false);
  });
});
