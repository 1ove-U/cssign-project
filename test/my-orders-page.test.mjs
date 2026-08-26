// test/my-orders-page.test.mjs — P2.8c-E (หน้า "ออเดอร์ของฉัน")
//
// ขอบเขต: js/my-orders-page.js เท่านั้น — ไม่ทดสอบ loginWithLine()/listenMyOrders() เองซ้ำ
// (มีเทสละเอียดอยู่แล้วใน test/db-orders-line-login.test.mjs รอบ 163) ไฟล์นี้ทดสอบแค่ว่า
// my-orders-page.js orchestrate การเรียกฟังก์ชันเหล่านั้นถูกจุด + สลับ state ของหน้า (loading/
// login/error/orders-loading/empty/list) ถูกต้องตาม flow จริง — pattern เดียวกับ
// test/track-modal-liff-link.test.mjs (mock window.liff เอง ไม่โหลด LIFF SDK จริง, stub fetch
// สำหรับ /line-login ตามแพทเทิร์นเดียวกับ test/db-orders-line-login.test.mjs)
//
// my-orders.html ไม่มีไฟล์ template แยกแบบ track-modal-template.js (เป็น static HTML เต็มหน้า
// เหมือนหน้าอื่นๆ ในเว็บ) — จึงสร้าง markup ขั้นต่ำที่มีแค่ id ที่ my-orders-page.js query หาเอง
// ตรงๆ (ไม่ต้องมี navbar/footer จริงเพราะไฟล์นี้ไม่แตะส่วนนั้นเลย)
//
// ไม่ได้แก้ไฟล์ .js/.html/.css ที่เป็นโค้ดจริงเลยแม้แต่บรรทัดเดียวในไฟล์นี้ — งานทดสอบล้วนๆ

import { test, describe, afterEach } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { auth } from "../js/db.js";

const MO_HTML = `
  <div id="mo-loading" style="display:flex;"></div>
  <div id="mo-login" style="display:none;">
    <button type="button" id="mo-login-btn"></button>
  </div>
  <div class="tm-error" id="mo-error"><span id="mo-error-text"></span></div>
  <div id="mo-orders-loading" style="display:none;"></div>
  <div id="mo-empty" style="display:none;"></div>
  <div id="mo-list" style="display:none;"></div>
  <div id="mo-logout" style="display:none;">
    <button type="button" id="mo-logout-btn">ออกจากระบบ</button>
  </div>
  <div id="mo-link-more" style="display:none;">
    <button type="button" id="mo-link-more-toggle" style="display:inline-flex;"></button>
    <form id="mo-link-more-form" style="display:none;">
      <input id="mo-link-more-code">
      <input id="mo-link-more-phone">
      <button type="submit" id="mo-link-more-submit">เชื่อมออเดอร์นี้</button>
      <div id="mo-link-more-msg"></div>
    </form>
  </div>
  <div id="mo-detail-overlay" style="display:none;">
    <button type="button" id="mo-detail-close"></button>
    <span id="mo-detail-code"></span>
    <h2 id="mo-detail-title"></h2>
    <p id="mo-detail-sub"></p>
    <div id="mo-detail-body"></div>
  </div>
`;

function makeDom() {
  return new JSDOM(`<!doctype html><html><body>${MO_HTML}</body></html>`, { url: "https://example.test/" });
}

async function loadMyOrdersPage(dom) {
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.MouseEvent = dom.window.MouseEvent;
  // openOrderDetail() เรียก requestAnimationFrame() เพื่อโฟกัส #mo-detail-close หลังเปิดป๊อปอัพ —
  // jsdom ไม่มี requestAnimationFrame ที่ยิงจริงใน Node test runner context นี้ (ต่างจาก browser)
  // จึง stub เป็น setTimeout เหมือน pattern เดียวกับ test/track-modal-focus-trap.test.mjs ทุกประการ
  globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);
  await import(`../js/my-orders-page.js?t=${Date.now()}-${Math.random()}`);
}

// mock ขั้นต่ำสุดของ window.liff — เหมือน test/track-modal-liff-link.test.mjs ทุกประการ
// (เพิ่ม logout() รอบนี้ — ใช้เทสปุ่มออกจากระบบ P2.9-A ที่เรียก liffInstance.logout() เมื่อ LIFF
// session ยัง isLoggedIn() ค้างอยู่ ไม่กระทบเทสเดิมเพราะเป็นแค่ method เสริมที่ไม่มีใครเรียกมาก่อน)
function mockLiff(dom, { loggedIn, idToken }) {
  dom.window.liff = {
    initCalled: false,
    init: function () { this.initCalled = true; return Promise.resolve(); },
    isLoggedIn: () => !!loggedIn,
    login: function () { this.__loginCalled = true; },
    logout: function () { this.__logoutCalled = true; },
    getIDToken: () => idToken || null,
  };
  return dom.window.liff;
}

function stubFetch(handler) {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return handler(url, options);
  };
  return calls;
}

function jsonResponse(status, body) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

function click(dom, el) {
  el.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
}

function nextTick(times = 1) {
  return times <= 1
    ? new Promise((resolve) => setTimeout(resolve, 0))
    : nextTick(1).then(() => nextTick(times - 1));
}

const originalFetch = globalThis.fetch;

function submitForm(dom, formId) {
  dom.window.document.getElementById(formId).dispatchEvent(
    new dom.window.Event("submit", { bubbles: true, cancelable: true })
  );
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  globalThis.__SIGNIN_CUSTOM_TOKEN_CALLS__ = [];
  globalThis.__SIGNIN_CUSTOM_TOKEN_STUB__ = undefined;
  globalThis.__SNAPSHOT_LISTENERS__ = {};
  globalThis.__UPDATE_DOC_CALLS__ = [];
  globalThis.__UPDATE_DOC_STUB__ = undefined;
  globalThis.__WHERE_CALLS__ = [];
  // เพิ่มรอบนี้ (เทสปุ่มออกจากระบบ P2.9-A) — ล้างสถานะ signOut() ให้ไม่ leak ข้ามเทส
  globalThis.__SIGNOUT_CALLS__ = [];
  globalThis.__SIGNOUT_STUB__ = undefined;
  auth.currentUser = null;
});

describe("my-orders-page.js — element guard", () => {
  test("ไม่มี element ที่จำเป็น (ไม่ใช่หน้า my-orders.html) → ไม่ throw ตอน import", async () => {
    const dom = new JSDOM(`<!doctype html><html><body></body></html>`, { url: "https://example.test/" });
    globalThis.window = dom.window;
    globalThis.document = dom.window.document;
    await assert.doesNotReject(() => import(`../js/my-orders-page.js?t=${Date.now()}-${Math.random()}`));
  });
});

describe("my-orders-page.js — หน้าโหลดครั้งแรก", () => {
  test("liff ยังไม่ login → ซ่อน loading, โชว์ปุ่มเข้าสู่ระบบ", async () => {
    const dom = makeDom();
    mockLiff(dom, { loggedIn: false });
    stubFetch(() => { throw new Error("ไม่ควรถูกเรียก — ยังไม่ login"); });

    await loadMyOrdersPage(dom);
    await nextTick(3);

    assert.equal(dom.window.document.getElementById("mo-loading").style.display, "none");
    assert.equal(dom.window.document.getElementById("mo-login").style.display, "block");
  });

  test("liff login อยู่แล้ว (มี idToken) → เรียก /line-login อัตโนมัติ ไม่ต้องกดปุ่ม", async () => {
    const dom = makeDom();
    mockLiff(dom, { loggedIn: true, idToken: "id-token-abc" });
    const calls = stubFetch(() => jsonResponse(200, { customToken: "tok-xyz", lineUserId: "U9999" }));

    await loadMyOrdersPage(dom);
    await nextTick(3);

    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /\/line-login$/);
    assert.deepEqual(globalThis.__SIGNIN_CUSTOM_TOKEN_CALLS__, ["tok-xyz"]);
    assert.equal(dom.window.document.getElementById("mo-orders-loading").style.display, "flex");
    assert.equal(typeof globalThis.__SNAPSHOT_LISTENERS__["orders"], "function");
  });
});

describe("my-orders-page.js — จำ session เดิม (P2.9-B)", () => {
  test("มี auth.currentUser (uid line_*) อยู่แล้วตอนโหลดหน้า → ข้าม liff.login() ไป afterLogin() ตรงๆ", async () => {
    const dom = makeDom();
    const liff = mockLiff(dom, { loggedIn: false }); // ตั้งใจให้ liff.isLoggedIn() เป็น false —
    // ถ้าโค้ดพลาดไปเรียก liff flow จริงจะตกไปที่หน้า login แทน ไม่ใช่ afterLogin() ทำให้เทสจับได้
    auth.currentUser = { uid: "line_U9999" };
    const calls = stubFetch(() => { throw new Error("ไม่ควรถูกเรียก — ต้องข้าม /line-login เพราะมี session เดิมอยู่แล้ว"); });

    await loadMyOrdersPage(dom);
    await nextTick(3);

    assert.equal(liff.initCalled, false, "ไม่ควรเรียก liff.init() เลยเมื่อมี session เดิมอยู่แล้ว");
    assert.equal(calls.length, 0);
    assert.equal(dom.window.document.getElementById("mo-orders-loading").style.display, "flex");
    assert.equal(typeof globalThis.__SNAPSHOT_LISTENERS__["orders"], "function");
    // แก้บั๊ก P2.9-E: listenMyOrders() ต้อง query ด้วย lineUserId ดิบ (ไม่มี prefix "line_") ให้ตรง
    // กับ order.lineUserId ที่เก็บใน Firestore จริง — ไม่ใช่ auth.currentUser.uid ตรงๆ
    const whereCall = globalThis.__WHERE_CALLS__.find((c) => c.field === "lineUserId");
    assert.ok(whereCall, "ต้องมีการ query ด้วย field lineUserId");
    assert.equal(whereCall.value, "U9999", "ต้องตัด prefix \"line_\" ออกก่อน query ไม่ใช่ uid ดิบ (line_U9999)");
  });

  test("auth.currentUser เป็น session แอดมิน (uid ไม่ขึ้นต้นด้วย line_) → ไม่ข้าม ไปเช็ค liff ตามปกติ", async () => {
    const dom = makeDom();
    mockLiff(dom, { loggedIn: false });
    auth.currentUser = { uid: "admin-abc123" }; // session แอดมินที่บังเอิญค้างอยู่ในเบราว์เซอร์เดียวกัน
    stubFetch(() => { throw new Error("ไม่ควรถูกเรียก — ยังไม่ login LINE"); });

    await loadMyOrdersPage(dom);
    await nextTick(3);

    // ต้องไม่ถูกนับเป็น session ลูกค้า LINE — เห็นปุ่ม login ตามปกติเหมือนไม่มี session เลย
    assert.equal(dom.window.document.getElementById("mo-loading").style.display, "none");
    assert.equal(dom.window.document.getElementById("mo-login").style.display, "block");
  });

  test("ไม่มี auth.currentUser (null) → ไปเช็ค liff ตามปกติเหมือนเดิม", async () => {
    const dom = makeDom();
    mockLiff(dom, { loggedIn: false });
    auth.currentUser = null;
    stubFetch(() => { throw new Error("ไม่ควรถูกเรียก — ยังไม่ login"); });

    await loadMyOrdersPage(dom);
    await nextTick(3);

    assert.equal(dom.window.document.getElementById("mo-login").style.display, "block");
  });
});

// P2.9-A — ปุ่มออกจากระบบ (ค้างมาตั้งแต่รอบ A1 เดิม — HTML fixture ตอนนั้นยังไม่มี #mo-logout เลย
// จึงไม่มีทางเทสได้ ทุกเทสเดิมผ่านเพราะโค้ดจริง query แบบ `if (el)` กัน null ไว้อยู่แล้ว — เพิ่มรอบ
// นี้โดยไม่แตะโค้ดผลิตภัณฑ์เลยแม้แต่บรรทัดเดียว)
describe("my-orders-page.js — ปุ่มออกจากระบบ (P2.9-A)", () => {
  test("login สำเร็จ (มี session เดิม P2.9-B) → โชว์ปุ่มออกจากระบบ", async () => {
    const dom = makeDom();
    mockLiff(dom, { loggedIn: false });
    auth.currentUser = { uid: "line_U9999" };
    stubFetch(() => { throw new Error("ไม่ควรถูกเรียก — มี session เดิมอยู่แล้ว"); });

    await loadMyOrdersPage(dom);
    await nextTick(3);

    assert.equal(dom.window.document.getElementById("mo-logout").style.display, "block");
  });

  test("กดปุ่มออกจากระบบ (มี session เดิม, liffInstance ยังเป็น null) → signOut() ถูกเรียก, ไม่พัง (ไม่มี liffInstance ให้ logout()), รีเซ็ตกลับหน้า login", async () => {
    const dom = makeDom();
    mockLiff(dom, { loggedIn: false });
    auth.currentUser = { uid: "line_U9999" };
    stubFetch(() => { throw new Error("ไม่ควรถูกเรียก"); });

    await loadMyOrdersPage(dom);
    await nextTick(3);

    // ยิง snapshot ปลอมให้มีรายการก่อน จะได้เช็คว่าโดนเคลียร์ทิ้งตอน logout จริง
    globalThis.__SNAPSHOT_LISTENERS__["orders"]({
      docs: [{ id: "o1", data: () => ({ code: "PO-1", item: "ป้าย", status: "production", progress: 10 }) }],
    });
    assert.match(dom.window.document.getElementById("mo-list").innerHTML, /PO-1/);

    click(dom, dom.window.document.getElementById("mo-logout-btn"));
    await nextTick(3);

    assert.equal(globalThis.__SIGNOUT_CALLS__.length, 1);
    assert.equal(dom.window.document.getElementById("mo-list").innerHTML, "");
    assert.equal(dom.window.document.getElementById("mo-logout").style.display, "none");
    assert.equal(dom.window.document.getElementById("mo-link-more").style.display, "none");
    assert.equal(dom.window.document.getElementById("mo-login").style.display, "block");
    assert.equal(dom.window.document.getElementById("mo-logout-btn").disabled, false, "ต้องปลด disabled คืนหลัง logout เสร็จ");
  });

  test("กดปุ่มออกจากระบบหลัง login สดจาก LIFF จริง (liffInstance.isLoggedIn()=true) → เรียก liff.logout() ด้วย", async () => {
    const dom = makeDom();
    const liff = mockLiff(dom, { loggedIn: true, idToken: "id-token-abc" });
    stubFetch(() => jsonResponse(200, { customToken: "tok-xyz", lineUserId: "U9999" }));

    await loadMyOrdersPage(dom);
    await nextTick(3);
    assert.equal(dom.window.document.getElementById("mo-logout").style.display, "block");

    click(dom, dom.window.document.getElementById("mo-logout-btn"));
    await nextTick(3);

    assert.equal(liff.__logoutCalled, true, "ต้องเรียก liff.logout() เพื่อกัน auto-login กลับตอนรีเฟรชหน้า");
    assert.equal(globalThis.__SIGNOUT_CALLS__.length, 1);
    assert.equal(dom.window.document.getElementById("mo-login").style.display, "block");
  });

  test("กดปุ่มออกจากระบบซ้ำรัวๆ ระหว่างที่ยัง disabled อยู่ → signOut() ถูกเรียกแค่ครั้งเดียว", async () => {
    const dom = makeDom();
    mockLiff(dom, { loggedIn: false });
    auth.currentUser = { uid: "line_U9999" };
    stubFetch(() => { throw new Error("ไม่ควรถูกเรียก"); });

    await loadMyOrdersPage(dom);
    await nextTick(3);

    const btn = dom.window.document.getElementById("mo-logout-btn");
    click(dom, btn);
    assert.equal(btn.disabled, true, "ต้อง disabled ทันทีตอนกดครั้งแรก กันกดซ้ำ");
    click(dom, btn); // กดซ้ำระหว่างที่ยัง disabled อยู่ — ต้องถูก guard ทิ้งไป ไม่เรียก signOut() ซ้ำ
    click(dom, btn);
    await nextTick(3);

    assert.equal(globalThis.__SIGNOUT_CALLS__.length, 1);
  });

  test("signOut() ล้มเหลว (เช่น เน็ตหลุด) → ยังคง reset UI กลับหน้า login ได้ตามปกติ ไม่ค้าง", async () => {
    const dom = makeDom();
    mockLiff(dom, { loggedIn: false });
    auth.currentUser = { uid: "line_U9999" };
    stubFetch(() => { throw new Error("ไม่ควรถูกเรียก"); });
    globalThis.__SIGNOUT_STUB__ = () => ({ throw: new Error("network down") });

    await loadMyOrdersPage(dom);
    await nextTick(3);

    click(dom, dom.window.document.getElementById("mo-logout-btn"));
    await nextTick(3);

    assert.equal(dom.window.document.getElementById("mo-login").style.display, "block");
    assert.equal(dom.window.document.getElementById("mo-logout").style.display, "none");
    assert.equal(dom.window.document.getElementById("mo-logout-btn").disabled, false);
  });
});

describe("my-orders-page.js — ปุ่มเข้าสู่ระบบ", () => {
  test("กดปุ่ม → liff ยังไม่ login → เรียก liff.login() (redirect) ไม่เรียก /line-login", async () => {
    const dom = makeDom();
    const liff = mockLiff(dom, { loggedIn: false });
    const calls = stubFetch(() => { throw new Error("ไม่ควรถูกเรียก"); });

    await loadMyOrdersPage(dom);
    await nextTick(3);
    click(dom, dom.window.document.getElementById("mo-login-btn"));
    await nextTick(3);

    assert.equal(liff.__loginCalled, true);
    assert.equal(calls.length, 0);
  });

  test("login สำเร็จ (จากปุ่ม) แล้ว fetch fail (invalid_line_token) → กลับไปโชว์ปุ่ม login พร้อม error", async () => {
    const dom = makeDom();
    mockLiff(dom, { loggedIn: true, idToken: "id-token-abc" });
    stubFetch(() => jsonResponse(401, { error: "invalid_line_token" }));

    await loadMyOrdersPage(dom);
    await nextTick(3); // auto flow ตอนโหลดหน้าจะพยายามเรียกก่อนแล้วก็ fail เหมือนกัน ปล่อยให้จบก่อน

    const errText = dom.window.document.getElementById("mo-error-text");
    const errBox = dom.window.document.getElementById("mo-error");
    assert.equal(dom.window.document.getElementById("mo-login").style.display, "block");
    assert.ok(errBox.classList.contains("show"));
    assert.match(errText.textContent, /ยืนยันตัวตนผ่าน LINE ไม่สำเร็จ/);
  });
});

describe("my-orders-page.js — รายการออเดอร์หลัง login สำเร็จ", () => {
  async function loginAndGetSnapshotHandler(dom) {
    mockLiff(dom, { loggedIn: true, idToken: "id-token-abc" });
    stubFetch(() => jsonResponse(200, { customToken: "tok-xyz", lineUserId: "U9999" }));
    await loadMyOrdersPage(dom);
    await nextTick(3);
    return globalThis.__SNAPSHOT_LISTENERS__["orders"];
  }

  test("snapshot มีออเดอร์ → แสดงรายการ ซ่อน empty/loading", async () => {
    const dom = makeDom();
    const snapshotHandler = await loginAndGetSnapshotHandler(dom);
    assert.equal(typeof snapshotHandler, "function");

    snapshotHandler({
      docs: [
        { id: "o1", data: () => ({ code: "PO-2026-0099", item: "ป้ายเตือนไฟฟ้าแรงสูง", qty: 3, status: "production", progress: 40 }) }
      ]
    });

    const listEl = dom.window.document.getElementById("mo-list");
    assert.equal(listEl.style.display, "flex");
    assert.equal(dom.window.document.getElementById("mo-empty").style.display, "none");
    assert.match(listEl.innerHTML, /PO-2026-0099/);
    assert.match(listEl.innerHTML, /ป้ายเตือนไฟฟ้าแรงสูง/);
  });

  test("snapshot ว่างเปล่า (ยังไม่เคยเชื่อมออเดอร์ไหนเลย) → แสดง empty state", async () => {
    const dom = makeDom();
    const snapshotHandler = await loginAndGetSnapshotHandler(dom);

    snapshotHandler({ docs: [] });

    assert.equal(dom.window.document.getElementById("mo-empty").style.display, "block");
    assert.equal(dom.window.document.getElementById("mo-list").style.display, "none");
  });
});

// P2.8c-F — ปุ่ม "เชื่อมออเดอร์เพิ่ม" (ใช้ liff session เดิมที่ login ค้างไว้จากรอบ E — เรียก
// linkLineAccount() จริงจาก js/db-orders.js ตรงๆ ไม่ mock ฟังก์ชันนี้เอง เหมือนกับ
// loginWithLine()/listenMyOrders() ด้านบน — stub แค่ fetch()/signInWithCustomToken()/updateDoc()
// ที่ระดับ Firebase/network เท่านั้น ผ่าน register-loader.mjs (firebase-stub-loader.mjs)
describe("my-orders-page.js — เชื่อมออเดอร์เพิ่ม (P2.8c-F)", () => {
  async function loginOnly(dom) {
    mockLiff(dom, { loggedIn: true, idToken: "id-token-abc" });
    stubFetch((url) => {
      if (/\/line-login$/.test(url)) return jsonResponse(200, { customToken: "tok-xyz", lineUserId: "U9999" });
      throw new Error("unexpected fetch: " + url);
    });
    await loadMyOrdersPage(dom);
    await nextTick(3);
  }

  test("login สำเร็จ → ปุ่ม 'เชื่อมออเดอร์เพิ่ม' โผล่ (แม้ก่อนออเดอร์โหลดเสร็จ)", async () => {
    const dom = makeDom();
    await loginOnly(dom);
    assert.equal(dom.window.document.getElementById("mo-link-more").style.display, "block");
  });

  test("ยังไม่ login → ปุ่ม 'เชื่อมออเดอร์เพิ่ม' ซ่อนอยู่", async () => {
    const dom = makeDom();
    mockLiff(dom, { loggedIn: false });
    stubFetch(() => { throw new Error("ไม่ควรถูกเรียก"); });
    await loadMyOrdersPage(dom);
    await nextTick(3);
    assert.equal(dom.window.document.getElementById("mo-link-more").style.display, "none");
  });

  test("กด toggle → โชว์ฟอร์ม PO/เบอร์โทร", async () => {
    const dom = makeDom();
    await loginOnly(dom);
    click(dom, dom.window.document.getElementById("mo-link-more-toggle"));
    assert.equal(dom.window.document.getElementById("mo-link-more-form").style.display, "block");
  });

  test("submit ไม่กรอกอะไรเลย → โชว์ error validation ไม่เรียก fetch", async () => {
    const dom = makeDom();
    await loginOnly(dom);
    const fetchCallsBefore = globalThis.__SIGNIN_CUSTOM_TOKEN_CALLS__.length;
    submitForm(dom, "mo-link-more-form");
    await nextTick(2);
    assert.match(
      dom.window.document.getElementById("mo-link-more-msg").textContent,
      /กรุณากรอกเลขที่คำสั่งผลิต/
    );
    assert.equal(globalThis.__SIGNIN_CUSTOM_TOKEN_CALLS__.length, fetchCallsBefore);
  });

  test("submit สำเร็จ → เรียก linkLineAccount() จริง (fetch /link-line + signInWithCustomToken + updateDoc) แล้วซ่อนฟอร์ม", async () => {
    const dom = makeDom();
    mockLiff(dom, { loggedIn: true, idToken: "id-token-abc" });
    stubFetch((url) => {
      if (/\/line-login$/.test(url)) return jsonResponse(200, { customToken: "tok-xyz", lineUserId: "U9999" });
      if (/\/link-line$/.test(url)) return jsonResponse(200, { customToken: "tok-abc", orderId: "order-42", lineUserId: "U9999" });
      throw new Error("unexpected fetch: " + url);
    });
    await loadMyOrdersPage(dom);
    await nextTick(3);

    click(dom, dom.window.document.getElementById("mo-link-more-toggle")); // เปิดฟอร์มก่อน
    dom.window.document.getElementById("mo-link-more-code").value = "PO-2026-0555";
    dom.window.document.getElementById("mo-link-more-phone").value = "0891234567";
    submitForm(dom, "mo-link-more-form");
    await nextTick(4);

    assert.deepEqual(globalThis.__SIGNIN_CUSTOM_TOKEN_CALLS__, ["tok-xyz", "tok-abc"]);
    assert.equal(globalThis.__UPDATE_DOC_CALLS__.length, 1);
    assert.deepEqual(globalThis.__UPDATE_DOC_CALLS__[0].payload, { lineUserId: "U9999" });
    assert.equal(dom.window.document.getElementById("mo-link-more-form").style.display, "none");
    assert.equal(dom.window.document.getElementById("mo-link-more-code").value, "");
  });

  test("submit fetch fail (order_not_found) → โชว์ error ที่ถูกต้อง ไม่ซ่อนฟอร์ม", async () => {
    const dom = makeDom();
    mockLiff(dom, { loggedIn: true, idToken: "id-token-abc" });
    stubFetch((url) => {
      if (/\/line-login$/.test(url)) return jsonResponse(200, { customToken: "tok-xyz", lineUserId: "U9999" });
      if (/\/link-line$/.test(url)) return jsonResponse(404, { error: "order_not_found" });
      throw new Error("unexpected fetch: " + url);
    });
    await loadMyOrdersPage(dom);
    await nextTick(3);

    click(dom, dom.window.document.getElementById("mo-link-more-toggle")); // เปิดฟอร์มก่อน
    dom.window.document.getElementById("mo-link-more-code").value = "PO-ไม่มีจริง";
    dom.window.document.getElementById("mo-link-more-phone").value = "0891234567";
    submitForm(dom, "mo-link-more-form");
    await nextTick(4);

    assert.match(
      dom.window.document.getElementById("mo-link-more-msg").textContent,
      /ไม่ตรงกับคำสั่งผลิตใดเลย/
    );
    assert.equal(dom.window.document.getElementById("mo-link-more-form").style.display, "block");
    assert.equal(dom.window.document.getElementById("mo-link-more-submit").disabled, false);
  });
});

// ป๊อปอัพรายละเอียดออเดอร์เต็ม — กดที่การ์ดในลิสต์เปิดขึ้นมา (ดูคอมเมนต์เต็มที่จุด
// openOrderDetail()/handleCardActivate() ใน js/my-orders-page.js)
describe("my-orders-page.js — ป๊อปอัพรายละเอียดออเดอร์", () => {
  async function loginAndListOrders(dom, order) {
    mockLiff(dom, { loggedIn: false });
    auth.currentUser = { uid: "line_U9999" };
    stubFetch(() => { throw new Error("ไม่ควรถูกเรียก — มี session เดิมอยู่แล้ว"); });

    await loadMyOrdersPage(dom);
    // จำลอง event แรกจาก onAuthStateChanged() ที่ Firebase ยิงมาจริงตอน resolve auth state เสร็จ —
    // stub เดิม (test/helpers/firebase-stub-loader.mjs) เก็บ callback ไว้ที่
    // globalThis.__AUTH_STATE_CALLBACK__ เฉยๆ ไม่ยิงเอง (pattern เดียวกับ authCallback() ใน
    // test/admin-page.test.mjs) — my-orders-page.js รอ event นี้ก่อนถึงจะเริ่ม runLiffFlow()
    // (ดูคอมเมนต์ "เซสชันหลุดจากที่อื่น + auth ยังไม่ resolve ตอนหน้าโหลด" ในไฟล์จริง)
    if (typeof globalThis.__AUTH_STATE_CALLBACK__ === "function") {
      globalThis.__AUTH_STATE_CALLBACK__(auth.currentUser);
    }
    await nextTick(3);

    globalThis.__SNAPSHOT_LISTENERS__["orders"]({
      docs: [{ id: "o1", data: () => order }],
    });
  }

  test("กดที่การ์ดออเดอร์ → เปิดป๊อปอัพ พร้อมข้อมูลครบ (สเปก/การเงิน/จัดส่ง/หมายเหตุ)", async () => {
    const dom = makeDom();
    await loginAndListOrders(dom, {
      code: "PO-159", item: "ป้ายเตือนอันตราย", qty: 60, status: "production", progress: 45,
      specs: { size: "60x40 ซม.", material: "อะลูมิเนียม", color: "เหลือง-ดำ", finish: "สะท้อนแสง" },
      unit_price: 300, discount: 500, vatIncluded: false, shippingCost: 200,
      deposit: 5000, paymentStatus: "deposit_paid",
      shippingMethod: "courier", recipient: "คุณสมชาย", shippingAddress: "123 ถ.สุขุมวิท",
      notes: "ลูกค้าขอให้ติดต่อก่อนส่ง",
    });

    const card = dom.window.document.querySelector(".ap-item-card");
    assert.ok(card, "ต้องมีการ์ดออเดอร์ในลิสต์");
    click(dom, card);

    assert.equal(dom.window.document.getElementById("mo-detail-overlay").style.display, "flex");
    assert.equal(dom.window.document.getElementById("mo-detail-code").textContent, "PO-159");
    const bodyHtml = dom.window.document.getElementById("mo-detail-body").innerHTML;
    assert.match(bodyHtml, /อะลูมิเนียม/);
    assert.match(bodyHtml, /เหลือง-ดำ/);
    assert.match(bodyHtml, /คุณสมชาย/);
    assert.match(bodyHtml, /123 ถ\.สุขุมวิท/);
    assert.match(bodyHtml, /ลูกค้าขอให้ติดต่อก่อนส่ง/);
  });

  test("กดปุ่มปิด → ป๊อปอัพซ่อนกลับ", async () => {
    const dom = makeDom();
    await loginAndListOrders(dom, { code: "PO-1", item: "ป้าย", qty: 1, status: "received", progress: 0 });

    click(dom, dom.window.document.querySelector(".ap-item-card"));
    assert.equal(dom.window.document.getElementById("mo-detail-overlay").style.display, "flex");

    click(dom, dom.window.document.getElementById("mo-detail-close"));
    assert.equal(dom.window.document.getElementById("mo-detail-overlay").style.display, "none");
  });

  test("กดที่ <summary> ขั้นตอนงานในการ์ด (การ์ดสรุป) → ไม่เปิดป๊อปอัพซ้อน", async () => {
    const dom = makeDom();
    await loginAndListOrders(dom, { code: "PO-1", item: "ป้าย", qty: 1, status: "design", progress: 20 });

    const summary = dom.window.document.querySelector(".ap-item-card summary");
    assert.ok(summary, "ต้องมี <summary> ของแถบขั้นตอนงานในการ์ด");
    click(dom, summary);

    assert.equal(dom.window.document.getElementById("mo-detail-overlay").style.display, "none");
  });

  test("order ไม่มีข้อมูลเสริมเลย (แค่ code/item/qty/status/progress) → ยังเปิดป๊อปอัพได้ปกติ ไม่พัง", async () => {
    const dom = makeDom();
    await loginAndListOrders(dom, { code: "PO-2", item: "ป้ายจราจร", qty: 5, status: "received", progress: 0 });

    click(dom, dom.window.document.querySelector(".ap-item-card"));

    assert.equal(dom.window.document.getElementById("mo-detail-overlay").style.display, "flex");
    assert.match(dom.window.document.getElementById("mo-detail-body").innerHTML, /PO-2/);
  });
});
