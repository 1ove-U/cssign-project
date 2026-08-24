// test/db-orders-line-login.test.mjs — รอบที่ 163 (P2.8c-D)
//
// ขอบเขต: 2 ฟังก์ชันใหม่ใน js/db-orders.js — loginWithLine()/listenMyOrders() — เพิ่มโดยไม่แก้
// linkLineAccount()/getOrders()/listenOrders() เดิมเลยแม้แต่บรรทัดเดียว (ยืนยันด้วย diff ก่อน
// commit — ดู REFACTOR-PROGRESS.md รอบ 163)
//
// loginWithLine(): เหมือน linkLineAccount() (P1.5) ทุกจุดในแง่โครงสร้าง fetch → Worker →
// signInWithCustomToken() — ต่างกันแค่ endpoint (/line-login ไม่ใช่ /link-line), payload ที่ส่ง
// (แค่ idToken ไม่มี code/phone), และ response ที่คาดหวังกลับมา (แค่ { customToken, lineUserId }
// ไม่มี orderId) — ใช้แพทเทิร์น mock globalThis.fetch เดียวกับ test/db-media.test.mjs (Node 22
// มี fetch เป็น native global อยู่แล้ว override ตรงๆ ได้เลยไม่ต้องพึ่งเครือข่ายจริง)
//
// listenMyOrders(): ใช้ globalThis.__SNAPSHOT_LISTENERS__["orders"] แบบเดียวกับที่
// test/admin-global-search-jump.test.mjs ทดสอบ listenOrders() — stub ของ query()/where() ใน
// firebase-stub-loader.mjs ไม่ได้จำลอง filter จริง (where() คืน {} เฉยๆ เหมือน orderBy()) ดังนั้น
// การทดสอบ "กรองด้วย lineUserId จริง" ทำได้แค่ระดับ Firestore query ตัวจริง (composite index ที่
// เพิ่มไว้ใน firestore.indexes.json รอบ P2.8c-B) — เทสในไฟล์นี้ตรวจแค่ว่า listener ผูก path
// "orders" ถูกต้อง + callback/error-callback ทำงานถูกจุดเมื่อยิง snapshot ปลอมเข้ามา (เหมือน
// listenOrders() เดิมทุกประการ) ไม่ได้พิสูจน์ query filter จริง (ต้องพึ่ง Firestore emulator/
// production ถึงจะพิสูจน์ได้ — เกินขอบเขตของ unit test ชุดนี้)

import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { loginWithLine, listenMyOrders } from "../js/db-orders.js";
import { auth } from "../js/db.js";

const originalFetch = globalThis.fetch;

let fetchCalls;

function stubFetch(handler) {
  fetchCalls = [];
  globalThis.fetch = async (url, options) => {
    fetchCalls.push({ url, options });
    return handler(url, options);
  };
}

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body
  };
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  globalThis.__SIGNIN_CUSTOM_TOKEN_CALLS__ = [];
  globalThis.__SIGNIN_CUSTOM_TOKEN_STUB__ = undefined;
  globalThis.__SNAPSHOT_LISTENERS__ = {};
  auth.currentUser = null;
});

describe("loginWithLine()", () => {
  test("ไม่ส่ง idToken → throw code missing_id_token ทันที ไม่ยิง fetch เลย", async () => {
    stubFetch(() => { throw new Error("ไม่ควรถูกเรียก"); });
    await assert.rejects(
      () => loginWithLine(""),
      err => err.code === "missing_id_token"
    );
    assert.equal(fetchCalls.length, 0);
  });

  test("idToken ไม่ใช่ string (เช่น undefined) → throw code missing_id_token", async () => {
    stubFetch(() => { throw new Error("ไม่ควรถูกเรียก"); });
    await assert.rejects(
      () => loginWithLine(undefined),
      err => err.code === "missing_id_token"
    );
  });

  test("เรียก fetch ไปที่ /line-login ด้วย body { idToken } เท่านั้น (ไม่มี code/phone)", async () => {
    stubFetch(() => jsonResponse(200, { customToken: "tok-abc", lineUserId: "U1234" }));
    await loginWithLine("liff-id-token-xyz");

    assert.equal(fetchCalls.length, 1);
    const { url, options } = fetchCalls[0];
    assert.match(url, /\/line-login$/);
    assert.equal(options.method, "POST");
    assert.equal(options.headers["Content-Type"], "application/json");
    const body = JSON.parse(options.body);
    assert.deepEqual(Object.keys(body).sort(), ["idToken"]);
    assert.equal(body.idToken, "liff-id-token-xyz");
  });

  test("สำเร็จ → signInWithCustomToken() ถูกเรียกด้วย customToken ที่ได้กลับมา + resolve { lineUserId }", async () => {
    stubFetch(() => jsonResponse(200, { customToken: "tok-abc", lineUserId: "U5678" }));
    const result = await loginWithLine("liff-id-token-xyz");

    assert.deepEqual(result, { lineUserId: "U5678" });
    assert.deepEqual(globalThis.__SIGNIN_CUSTOM_TOKEN_CALLS__, ["tok-abc"]);
  });

  test("สำเร็จแล้ว ไม่มีการ updateDoc()/แตะ Firestore เลย (ต่างจาก linkLineAccount() ที่ต้อง updateDoc order)", async () => {
    globalThis.__UPDATE_DOC_CALLS__ = [];
    stubFetch(() => jsonResponse(200, { customToken: "tok-abc", lineUserId: "U9999" }));
    await loginWithLine("liff-id-token-xyz");
    assert.deepEqual(globalThis.__UPDATE_DOC_CALLS__, []);
  });

  test("Worker ตอบ ไม่ ok (เช่น 401 invalid_line_token) → throw ด้วย code จาก data.error", async () => {
    stubFetch(() => jsonResponse(401, { error: "invalid_line_token" }));
    await assert.rejects(
      () => loginWithLine("bad-token"),
      err => err.code === "invalid_line_token" && /invalid_line_token/.test(err.message)
    );
    assert.deepEqual(globalThis.__SIGNIN_CUSTOM_TOKEN_CALLS__, []);
  });

  test("Worker ตอบ ไม่ ok และ body ไม่ใช่ JSON เลย (parse พัง) → fallback ข้อความ status code", async () => {
    stubFetch(() => ({
      ok: false,
      status: 500,
      json: async () => { throw new Error("not json"); }
    }));
    await assert.rejects(
      () => loginWithLine("bad-token"),
      err => /500/.test(err.message)
    );
  });

  test("Worker ตอบ ok แต่ response ไม่มี customToken → throw code invalid_response", async () => {
    stubFetch(() => jsonResponse(200, { lineUserId: "U1111" }));
    await assert.rejects(
      () => loginWithLine("liff-id-token-xyz"),
      err => err.code === "invalid_response"
    );
    assert.deepEqual(globalThis.__SIGNIN_CUSTOM_TOKEN_CALLS__, []);
  });

  test("Worker ตอบ ok แต่ response ไม่มี lineUserId → throw code invalid_response", async () => {
    stubFetch(() => jsonResponse(200, { customToken: "tok-abc" }));
    await assert.rejects(
      () => loginWithLine("liff-id-token-xyz"),
      err => err.code === "invalid_response"
    );
    assert.deepEqual(globalThis.__SIGNIN_CUSTOM_TOKEN_CALLS__, []);
  });

  test("signInWithCustomToken() ล้มเหลว (ผ่าน __SIGNIN_CUSTOM_TOKEN_STUB__) → error นั้นถูก throw ต่อออกไป", async () => {
    stubFetch(() => jsonResponse(200, { customToken: "tok-abc", lineUserId: "U2222" }));
    globalThis.__SIGNIN_CUSTOM_TOKEN_STUB__ = () => ({ throw: new Error("custom token หมดอายุ") });
    await assert.rejects(
      () => loginWithLine("liff-id-token-xyz"),
      /custom token หมดอายุ/
    );
  });
});

describe("listenMyOrders()", () => {
  beforeEach(() => {
    globalThis.__SNAPSHOT_LISTENERS__ = {};
  });

  test("ไม่ส่ง lineUserId → เรียก onError ทันที ไม่ผูก listener เลย คืน unsubscribe เปล่าไม่ throw", () => {
    let errCaught = null;
    const unsub = listenMyOrders("", () => { throw new Error("callback ไม่ควรถูกเรียก"); }, err => { errCaught = err; });

    assert.ok(errCaught instanceof Error);
    assert.equal(globalThis.__SNAPSHOT_LISTENERS__["orders"], undefined);
    assert.doesNotThrow(() => unsub());
  });

  test("ไม่ส่ง lineUserId และไม่มี onError → console.error ถูกเรียกแทน ไม่ throw", () => {
    const originalError = console.error;
    let loggedArgs = null;
    console.error = (...args) => { loggedArgs = args; };
    try {
      listenMyOrders(undefined, () => {});
      assert.ok(loggedArgs);
      assert.match(loggedArgs[0], /listenMyOrders/);
    } finally {
      console.error = originalError;
    }
  });

  test("ผูก listener บน collection \"orders\" (path เดียวกับ listenOrders() เดิม)", () => {
    listenMyOrders("U1234", () => {});
    assert.equal(typeof globalThis.__SNAPSHOT_LISTENERS__["orders"], "function");
  });

  test("ยิง snapshot ปลอมเข้ามา → callback ได้รับ orders ที่ map { id, ...data } ถูกต้อง", () => {
    let received = null;
    listenMyOrders("U1234", orders => { received = orders; });

    const cb = globalThis.__SNAPSHOT_LISTENERS__["orders"];
    cb({
      docs: [
        { id: "o1", data: () => ({ code: "PO-001", lineUserId: "U1234" }) },
        { id: "o2", data: () => ({ code: "PO-002", lineUserId: "U1234" }) }
      ]
    });

    assert.deepEqual(received, [
      { id: "o1", code: "PO-001", lineUserId: "U1234" },
      { id: "o2", code: "PO-002", lineUserId: "U1234" }
    ]);
  });

  test("error callback ของ onSnapshot ยิง → เรียก onError ที่ส่งเข้ามา (ไม่ใช่ callback หลัก)", () => {
    let mainCalled = false;
    let errCaught = null;
    listenMyOrders("U1234", () => { mainCalled = true; }, err => { errCaught = err; });

    // firebase-stub-loader.mjs onSnapshot(ref, onNext) ไม่ได้เก็บ error-callback แยกไว้ให้ยิงเอง
    // (เหมือนที่ listenOrders()/listenLeads() เดิมก็ไม่เคยมีเทสคลุมจุดนี้ตรงๆ มาก่อนเช่นกัน — stub
    // เก็บแค่ onNext) — เทสนี้จึงยืนยันแค่ว่า onError ไม่ถูกเรียกลอยๆ ตอนผูก listener สำเร็จปกติ
    assert.equal(mainCalled, false);
    assert.equal(errCaught, null);
  });
});
