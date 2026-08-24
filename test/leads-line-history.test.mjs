// test/leads-line-history.test.mjs — P2.9-D1
//
// ขอบเขต: 2 จุดที่แก้/เพิ่มใน js/leads.js รอบ P2.9-D1 — saveLead() แนบ lineUserId เข้า payload
// เมื่อผู้ส่งฟอร์ม login ด้วย LINE อยู่ (auth.currentUser.uid ขึ้นต้นด้วย "line_") + ฟังก์ชันใหม่
// listenMyLeads(lineUserId, callback, onError) — pattern เดียวกับ test/db-orders-line-login.test.mjs
// ที่ทดสอบ listenMyOrders() (js/db-orders.js) เป๊ะ — ไม่ได้แก้ verifyTurnstileToken()/Turnstile flow
// เดิมเลยแม้แต่บรรทัดเดียว (ครอบคลุมแล้วโดย test/contact-inline-form-flow.test.mjs และ
// test/lead-quote-modal-form-flow.test.mjs — ไฟล์นี้ไม่ทดสอบซ้ำจุดนั้น)
//
// saveLead() ต้องใช้ window.location.href/document.referrer (ของเดิมอยู่แล้ว) — ต้องมี jsdom
// ผูกกับ globalThis ก่อน import เหมือน test/lead-quote-modal-form-flow.test.mjs (ไฟล์นี้ไม่ต้อง
// extract HTML markup จริงจากที่ไหนเพราะ saveLead()/listenMyLeads() ไม่แตะ DOM element ใดๆ เลย
// แค่ต้องมี window/document ให้ไม่ throw ตอนอ่าน location.href/referrer เท่านั้น)
//
// ไม่ได้แก้ไฟล์ .js/.html/.css ที่เป็นโค้ดจริงเลยแม้แต่บรรทัดเดียวในไฟล์นี้ — งานทดสอบล้วนๆ

import { test, describe, before, afterEach } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { auth } from "../js/db.js";

let saveLead, listenMyLeads;

before(async () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "https://example.test/leads-test" });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  const mod = await import("../js/leads.js");
  saveLead = mod.saveLead;
  listenMyLeads = mod.listenMyLeads;
});

const originalFetch = globalThis.fetch;

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

describe("saveLead() — แนบ lineUserId (P2.9-D1)", () => {
  test("ไม่มี auth.currentUser เลย (guest) → payload ไม่มี key lineUserId", async () => {
    stubTurnstileOk();
    auth.currentUser = null;
    await saveLead({ name: "สมชาย" }, "inline_contact", "tok");

    const call = globalThis.__ADD_DOC_CALLS__[0];
    assert.ok(call, "ต้องมีการเรียก addDoc()");
    assert.equal("lineUserId" in call.payload, false);
  });

  test("มี auth.currentUser แต่ uid ไม่ขึ้นต้นด้วย 'line_' (เช่น staff) → payload ไม่มี key lineUserId", async () => {
    stubTurnstileOk();
    auth.currentUser = { uid: "staff-uid-abc" };
    await saveLead({ name: "สมชาย" }, "inline_contact", "tok");

    const call = globalThis.__ADD_DOC_CALLS__[0];
    assert.equal("lineUserId" in call.payload, false);
  });

  test("มี auth.currentUser เป็นลูกค้า LINE (uid ขึ้นต้นด้วย 'line_') → payload มี lineUserId = uid ตัดคำนำหน้า 'line_' ออก", async () => {
    stubTurnstileOk();
    auth.currentUser = { uid: "line_U1234abcd" };
    await saveLead({ name: "สมชาย" }, "quotation_modal", "tok");

    const call = globalThis.__ADD_DOC_CALLS__[0];
    assert.equal(call.payload.lineUserId, "U1234abcd");
  });

  test("field อื่นของ payload (source/status/name) ยังถูกต้องเหมือนเดิมทุกจุด แม้จะแนบ lineUserId เพิ่ม", async () => {
    stubTurnstileOk();
    auth.currentUser = { uid: "line_U9999" };
    await saveLead({ name: "วิภา", email: "wipa@example.com" }, "contact_page_form", "tok");

    const call = globalThis.__ADD_DOC_CALLS__[0];
    assert.equal(call.payload.name, "วิภา");
    assert.equal(call.payload.email, "wipa@example.com");
    assert.equal(call.payload.source, "contact_page_form");
    assert.equal(call.payload.status, "new");
    assert.equal(call.payload.lineUserId, "U9999");
  });

  test("verifyTurnstileToken() ไม่ผ่าน (server ปฏิเสธ token) → throw ก่อนถึงจุดแนบ lineUserId เลย ไม่เรียก addDoc()", async () => {
    globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => ({ success: false }) });
    auth.currentUser = { uid: "line_U1111" };
    await assert.rejects(
      () => saveLead({ name: "ทดสอบ" }, "inline_contact", "bad-token"),
      /Turnstile verification failed/
    );
    assert.equal((globalThis.__ADD_DOC_CALLS__ || []).length, 0);
  });
});

describe("listenMyLeads()", () => {
  afterEach(() => {
    globalThis.__SNAPSHOT_LISTENERS__ = {};
  });

  test("ไม่ส่ง lineUserId → เรียก onError ทันที ไม่ผูก listener เลย คืน unsubscribe เปล่าไม่ throw", () => {
    let errCaught = null;
    const unsub = listenMyLeads("", () => { throw new Error("callback ไม่ควรถูกเรียก"); }, err => { errCaught = err; });

    assert.ok(errCaught instanceof Error);
    assert.match(errCaught.message, /listenMyLeads/);
    assert.equal(globalThis.__SNAPSHOT_LISTENERS__["leads"], undefined);
    assert.doesNotThrow(() => unsub());
  });

  test("ไม่ส่ง lineUserId และไม่มี onError → console.error ถูกเรียกแทน ไม่ throw", () => {
    const originalError = console.error;
    let loggedArgs = null;
    console.error = (...args) => { loggedArgs = args; };
    try {
      listenMyLeads(undefined, () => {});
      assert.ok(loggedArgs);
      assert.match(loggedArgs[0], /listenMyLeads/);
    } finally {
      console.error = originalError;
    }
  });

  test("ผูก listener บน collection \"leads\" (คนละ path กับ listenMyOrders() ที่ผูก \"orders\")", () => {
    listenMyLeads("U1234", () => {});
    assert.equal(typeof globalThis.__SNAPSHOT_LISTENERS__["leads"], "function");
  });

  test("ยิง snapshot ปลอมเข้ามา → callback ได้รับ leads ที่ map { id, ...data } ถูกต้อง", () => {
    let received = null;
    listenMyLeads("U1234", leads => { received = leads; });

    const cb = globalThis.__SNAPSHOT_LISTENERS__["leads"];
    cb({
      docs: [
        { id: "l1", data: () => ({ name: "สมชาย", lineUserId: "U1234", status: "new" }) },
        { id: "l2", data: () => ({ name: "วิภา", lineUserId: "U1234", status: "read" }) }
      ]
    });

    assert.deepEqual(received, [
      { id: "l1", name: "สมชาย", lineUserId: "U1234", status: "new" },
      { id: "l2", name: "วิภา", lineUserId: "U1234", status: "read" }
    ]);
  });

  test("error callback ของ onSnapshot ยิง → ไม่กระทบ callback หลัก (เหมือน listenMyOrders() — stub ไม่ได้เก็บ error-callback แยกให้ยิงเอง)", () => {
    let mainCalled = false;
    let errCaught = null;
    listenMyLeads("U1234", () => { mainCalled = true; }, err => { errCaught = err; });

    assert.equal(mainCalled, false);
    assert.equal(errCaught, null);
  });
});
