// test/my-account-page.test.mjs — P2.9-C3 (หน้า "บัญชีของฉัน")
//
// ขอบเขต: js/my-account-page.js เท่านั้น — ไม่ทดสอบ loginWithLine() เองซ้ำ (มีเทสละเอียดอยู่แล้ว
// ใน test/db-orders-line-login.test.mjs รอบ 163) ไฟล์นี้ทดสอบแค่ว่า my-account-page.js
// orchestrate การเรียกฟังก์ชันเหล่านั้นถูกจุด + สลับ state ของหน้า (loading/login/error/profile)
// ถูกต้องตาม flow จริง — mirror pattern จาก test/my-orders-page.test.mjs แต่มี state น้อยกว่า
// (ไม่มี orders-loading/empty/list/link-more) และมี liff.getProfile() เพิ่มมาที่ต้อง mock
//
// จุดที่ต่างจาก test/my-orders-page.test.mjs อย่างชัดเจนที่สุด: หน้านี้ "ยังคงเรียก liff.init()
// เสมอ" แม้มี Firebase session เดิมอยู่แล้ว (ต่างจาก my-orders-page.js ที่ข้ามไปทั้งหมด) — สิ่งที่
// ข้ามได้คือแค่ fetch /line-login เท่านั้น เพราะหน้านี้ต้องมี liff instance เพื่อเรียก
// liff.getProfile() แสดงชื่อ/รูปเสมอ ดู describe "จำ session เดิม (P2.9-B pattern)" ด้านล่าง
//
// my-account.html ไม่มีไฟล์ template แยก (เป็น static HTML เต็มหน้าเหมือนหน้าอื่นๆ ในเว็บ) —
// จึงสร้าง markup ขั้นต่ำที่มีแค่ id ที่ my-account-page.js query หาเองตรงๆ
//
// ไม่ได้แก้ไฟล์ .js/.html/.css ที่เป็นโค้ดจริงเลยแม้แต่บรรทัดเดียวในไฟล์นี้ — งานทดสอบล้วนๆ

import { test, describe, afterEach } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { auth } from "../js/db.js";

const MA_HTML = `
  <div id="ma-loading" style="display:flex;"></div>
  <div id="ma-login" style="display:none;">
    <button type="button" id="ma-login-btn"></button>
  </div>
  <div class="tm-error" id="ma-error"><span id="ma-error-text"></span></div>
  <div id="ma-profile" style="display:none;">
    <img id="ma-avatar" src="" alt="" style="display:none;">
    <div id="ma-name"></div>
    <button type="button" id="ma-logout-btn"></button>
    <button type="button" id="ma-leads-toggle" aria-expanded="false"></button>
    <svg id="ma-leads-chevron"></svg>
    <div id="ma-leads-panel" style="display:none;">
      <div id="ma-leads-loading" style="display:flex;"></div>
      <div id="ma-leads-empty" style="display:none;"></div>
      <div class="tm-error" id="ma-leads-error"><span id="ma-leads-error-text"></span></div>
      <div id="ma-leads-list" style="display:none;"></div>
    </div>
  </div>
`;

function makeDom() {
  return new JSDOM(`<!doctype html><html><body>${MA_HTML}</body></html>`, { url: "https://example.test/" });
}

async function loadMyAccountPage(dom) {
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.MouseEvent = dom.window.MouseEvent;
  await import(`../js/my-account-page.js?t=${Date.now()}-${Math.random()}`);
}

// mock ขั้นต่ำสุดของ window.liff — เหมือน test/my-orders-page.test.mjs แต่เพิ่ม getProfile()
// เพราะหน้านี้ต้องเรียกเสมอเพื่อแสดงชื่อ/รูป (my-orders-page.js ไม่มี getProfile() เลย)
function mockLiff(dom, { loggedIn, idToken, profile }) {
  dom.window.liff = {
    initCalled: false,
    init: function () { this.initCalled = true; return Promise.resolve(); },
    isLoggedIn: () => !!loggedIn,
    login: function () { this.__loginCalled = true; },
    logout: function () { this.__logoutCalled = true; },
    getIDToken: () => idToken || null,
    getProfile: () => Promise.resolve(profile || { displayName: "สมชาย ใจดี", pictureUrl: "https://example.test/avatar.png" }),
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

afterEach(() => {
  globalThis.fetch = originalFetch;
  globalThis.__SIGNIN_CUSTOM_TOKEN_CALLS__ = [];
  globalThis.__SIGNIN_CUSTOM_TOKEN_STUB__ = undefined;
  globalThis.__SNAPSHOT_LISTENERS__ = {};
  auth.currentUser = null;
});

describe("my-account-page.js — element guard", () => {
  test("ไม่มี element ที่จำเป็น (ไม่ใช่หน้า my-account.html) → ไม่ throw ตอน import", async () => {
    const dom = new JSDOM(`<!doctype html><html><body></body></html>`, { url: "https://example.test/" });
    globalThis.window = dom.window;
    globalThis.document = dom.window.document;
    await assert.doesNotReject(() => import(`../js/my-account-page.js?t=${Date.now()}-${Math.random()}`));
  });
});

describe("my-account-page.js — หน้าโหลดครั้งแรก", () => {
  test("liff ยังไม่ login → ซ่อน loading, โชว์ปุ่มเข้าสู่ระบบ", async () => {
    const dom = makeDom();
    mockLiff(dom, { loggedIn: false });
    stubFetch(() => { throw new Error("ไม่ควรถูกเรียก — ยังไม่ login"); });

    await loadMyAccountPage(dom);
    await nextTick(3);

    assert.equal(dom.window.document.getElementById("ma-loading").style.display, "none");
    assert.equal(dom.window.document.getElementById("ma-login").style.display, "block");
  });

  test("liff login อยู่แล้ว (มี idToken) → เรียก /line-login แล้วดึงโปรไฟล์ แสดงชื่อ/รูป", async () => {
    const dom = makeDom();
    mockLiff(dom, {
      loggedIn: true,
      idToken: "id-token-abc",
      profile: { displayName: "สมหญิง รักดี", pictureUrl: "https://example.test/somying.png" },
    });
    const calls = stubFetch(() => jsonResponse(200, { customToken: "tok-xyz", lineUserId: "U9999" }));

    await loadMyAccountPage(dom);
    await nextTick(3);

    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /\/line-login$/);
    assert.deepEqual(globalThis.__SIGNIN_CUSTOM_TOKEN_CALLS__, ["tok-xyz"]);
    assert.equal(dom.window.document.getElementById("ma-profile").style.display, "block");
    assert.equal(dom.window.document.getElementById("ma-name").textContent, "สมหญิง รักดี");
    assert.equal(dom.window.document.getElementById("ma-avatar").src, "https://example.test/somying.png");
    assert.equal(dom.window.document.getElementById("ma-avatar").style.display, "block");
  });
});

describe("my-account-page.js — จำ session เดิม (P2.9-B pattern)", () => {
  test("มี auth.currentUser (uid line_*) อยู่แล้ว → ยังคงเรียก liff.init() แต่ข้าม fetch /line-login ไปดึงโปรไฟล์ตรงๆ", async () => {
    const dom = makeDom();
    const liff = mockLiff(dom, {
      loggedIn: true,
      idToken: "id-token-abc",
      profile: { displayName: "ลูกค้าเดิม", pictureUrl: "https://example.test/existing.png" },
    });
    auth.currentUser = { uid: "line_U9999" };
    const calls = stubFetch(() => { throw new Error("ไม่ควรถูกเรียก — ต้องข้าม /line-login เพราะมี session เดิมอยู่แล้ว"); });

    await loadMyAccountPage(dom);
    await nextTick(3);

    // ต่างจาก my-orders-page.js ตรงนี้: หน้านี้ยังต้องเรียก liff.init() เสมอเพราะต้องใช้
    // liff.getProfile() แสดงชื่อ/รูป — สิ่งที่ข้ามได้คือแค่ fetch /line-login เท่านั้น
    assert.equal(liff.initCalled, true, "ต้องเรียก liff.init() เสมอ แม้มี session เดิมอยู่แล้ว");
    assert.equal(calls.length, 0, "ต้องข้าม fetch /line-login เพราะมี Firebase session เดิมอยู่แล้ว");
    assert.equal(dom.window.document.getElementById("ma-profile").style.display, "block");
    assert.equal(dom.window.document.getElementById("ma-name").textContent, "ลูกค้าเดิม");
  });

  test("auth.currentUser เป็น session แอดมิน (uid ไม่ขึ้นต้นด้วย line_) → ไม่ข้าม เรียก /line-login ตามปกติ", async () => {
    const dom = makeDom();
    mockLiff(dom, { loggedIn: true, idToken: "id-token-abc" });
    auth.currentUser = { uid: "admin-abc123" }; // session แอดมินที่บังเอิญค้างอยู่ในเบราว์เซอร์เดียวกัน
    const calls = stubFetch(() => jsonResponse(200, { customToken: "tok-xyz", lineUserId: "U9999" }));

    await loadMyAccountPage(dom);
    await nextTick(3);

    // ต้องไม่ถูกนับเป็น session ลูกค้า LINE — เรียก /line-login ตามปกติเหมือนไม่มี session เลย
    assert.equal(calls.length, 1);
    assert.equal(dom.window.document.getElementById("ma-profile").style.display, "block");
  });

  test("ไม่มี auth.currentUser (null) → เรียก /line-login ตามปกติเหมือนเดิม", async () => {
    const dom = makeDom();
    mockLiff(dom, { loggedIn: true, idToken: "id-token-abc" });
    auth.currentUser = null;
    const calls = stubFetch(() => jsonResponse(200, { customToken: "tok-xyz", lineUserId: "U9999" }));

    await loadMyAccountPage(dom);
    await nextTick(3);

    assert.equal(calls.length, 1);
    assert.equal(dom.window.document.getElementById("ma-profile").style.display, "block");
  });
});

describe("my-account-page.js — ปุ่มเข้าสู่ระบบ", () => {
  test("กดปุ่ม → liff ยังไม่ login → เรียก liff.login() (redirect) ไม่เรียก fetch", async () => {
    const dom = makeDom();
    const liff = mockLiff(dom, { loggedIn: false });
    const calls = stubFetch(() => { throw new Error("ไม่ควรถูกเรียก"); });

    await loadMyAccountPage(dom);
    await nextTick(3);
    click(dom, dom.window.document.getElementById("ma-login-btn"));
    await nextTick(3);

    assert.equal(liff.__loginCalled, true);
    assert.equal(calls.length, 0);
  });

  test("login สำเร็จ (จากปุ่ม) แล้ว fetch fail (invalid_line_token) → กลับไปโชว์ปุ่ม login พร้อม error", async () => {
    const dom = makeDom();
    mockLiff(dom, { loggedIn: true, idToken: "id-token-abc" });
    stubFetch(() => jsonResponse(401, { error: "invalid_line_token" }));

    await loadMyAccountPage(dom);
    await nextTick(3); // auto flow ตอนโหลดหน้าจะพยายามเรียกก่อนแล้วก็ fail เหมือนกัน ปล่อยให้จบก่อน

    const errText = dom.window.document.getElementById("ma-error-text");
    const errBox = dom.window.document.getElementById("ma-error");
    assert.equal(dom.window.document.getElementById("ma-login").style.display, "block");
    assert.ok(errBox.classList.contains("show"));
    assert.match(errText.textContent, /ยืนยันตัวตนผ่าน LINE ไม่สำเร็จ/);
  });
});

describe("my-account-page.js — ออกจากระบบ", () => {
  async function loginAndGetElements(dom) {
    mockLiff(dom, {
      loggedIn: true,
      idToken: "id-token-abc",
      profile: { displayName: "ทดสอบ ออกจากระบบ", pictureUrl: "https://example.test/logout-test.png" },
    });
    stubFetch(() => jsonResponse(200, { customToken: "tok-xyz", lineUserId: "U9999" }));
    await loadMyAccountPage(dom);
    await nextTick(3);
    return {
      nameEl: dom.window.document.getElementById("ma-name"),
      avatarEl: dom.window.document.getElementById("ma-avatar"),
      profileEl: dom.window.document.getElementById("ma-profile"),
      loginEl: dom.window.document.getElementById("ma-login"),
      logoutBtn: dom.window.document.getElementById("ma-logout-btn"),
    };
  }

  test("login สำเร็จแล้วกด logout → เคลียร์ชื่อ/รูป กลับไปหน้า login", async () => {
    const dom = makeDom();
    const els = await loginAndGetElements(dom);
    assert.equal(els.profileEl.style.display, "block");
    assert.equal(els.nameEl.textContent, "ทดสอบ ออกจากระบบ");

    click(dom, els.logoutBtn);
    await nextTick(3);

    assert.equal(els.nameEl.textContent, "");
    assert.equal(els.avatarEl.getAttribute("src"), ""); // jsdom resolves .src to an absolute URL even when set to "" — check the raw attribute instead
    assert.equal(els.avatarEl.style.display, "none");
    assert.equal(els.loginEl.style.display, "block");
    assert.equal(els.profileEl.style.display, "none");
    assert.equal(els.logoutBtn.disabled, false); // เปิดใช้งานปุ่มกลับมาให้กดซ้ำได้หลัง logout เสร็จ
  });
});

// ===========================
// "ใบเสนอราคาของฉัน" — P3.0 Phase 5 รอบ 8 (แทนที่ listenMyLeads() เดิมของ P2.9-D2/D3 ทั้งหมด)
// ===========================
// ขอบเขต: แค่ว่า my-account-page.js orchestrate การเรียก listenMyQuoteRequests()
// (js/db-quote-requests.js) ถูกจุด/ถูก lineUserId + สลับ state ของ panel
// (loading/empty/list/error) + เรนเดอร์การ์ดคำขอ (items[]/สถานะ/ลิงก์ quotePublicToken) ถูกต้อง
// ตาม flow จริง — ไม่ทดสอบ listenMyQuoteRequests() เองซ้ำ (มีเทสละเอียดอยู่แล้วใน
// test/db-quote-requests.test.mjs ถ้ามี หรือไฟล์เทสของ Phase 2/5 อื่นที่ครอบ data layer) —
// ยิง snapshot ปลอมผ่าน globalThis.__SNAPSHOT_LISTENERS__["quote_requests"](...) ตาม pattern
// เดียวกับ leads เดิม (ดู stub onSnapshot() ใน test/helpers/firebase-stub-loader.mjs —
// query()/collection() ทิ้ง where() clause จริง คืนแค่ ref.path = "quote_requests" เฉยๆ เพราะ
// listenMyQuoteRequests() เรียก collection(db, "quote_requests") ตรงๆ ใน js/db-quote-requests.js)
describe("my-account-page.js — ใบเสนอราคาของฉัน (P3.0 Phase 5 รอบ 8)", () => {
  async function loginAndGetLeadsElements(dom, lineUserId) {
    mockLiff(dom, {
      loggedIn: true,
      idToken: "id-token-abc",
      profile: { displayName: "ทดสอบ ใบเสนอราคา", pictureUrl: "https://example.test/lead-test.png" },
    });
    stubFetch(() => jsonResponse(200, { customToken: "tok-xyz", lineUserId: lineUserId || "U9999" }));
    await loadMyAccountPage(dom);
    await nextTick(3);
    return {
      toggle: dom.window.document.getElementById("ma-leads-toggle"),
      panel: dom.window.document.getElementById("ma-leads-panel"),
      loadingEl: dom.window.document.getElementById("ma-leads-loading"),
      emptyEl: dom.window.document.getElementById("ma-leads-empty"),
      listEl: dom.window.document.getElementById("ma-leads-list"),
      errorEl: dom.window.document.getElementById("ma-leads-error"),
      errorTextEl: dom.window.document.getElementById("ma-leads-error-text"),
    };
  }

  test("ไม่มี ma-leads-toggle ใน DOM (หน้าเก่า/เทสอื่น) → ไม่ throw ตอน import หรือ login", async () => {
    const dom = new JSDOM(`<!doctype html><html><body>
      <div id="ma-loading" style="display:flex;"></div>
      <div id="ma-login" style="display:none;"><button type="button" id="ma-login-btn"></button></div>
      <div class="tm-error" id="ma-error"><span id="ma-error-text"></span></div>
      <div id="ma-profile" style="display:none;">
        <img id="ma-avatar" src="" alt="" style="display:none;">
        <div id="ma-name"></div>
        <button type="button" id="ma-logout-btn"></button>
      </div>
    </body></html>`, { url: "https://example.test/" });
    mockLiff(dom, { loggedIn: true, idToken: "id-token-abc" });
    stubFetch(() => jsonResponse(200, { customToken: "tok-xyz", lineUserId: "U9999" }));
    await assert.doesNotReject(() => loadMyAccountPage(dom));
    await nextTick(3);
    assert.equal(dom.window.document.getElementById("ma-profile").style.display, "block");
  });

  test("กดปุ่มขยาย panel ครั้งแรก → เรียก listenMyQuoteRequests() ด้วย lineUserId จาก loginWithLine() + โชว์ loading ก่อน", async () => {
    const dom = makeDom();
    const els = await loginAndGetLeadsElements(dom, "U9999");
    assert.equal(els.panel.style.display, "none");

    click(dom, els.toggle);
    await nextTick(1);

    assert.equal(els.panel.style.display, "block");
    assert.equal(els.toggle.getAttribute("aria-expanded"), "true");
    assert.equal(typeof globalThis.__SNAPSHOT_LISTENERS__["quote_requests"], "function", "ต้อง subscribe listenMyQuoteRequests() ตอนกดขยาย panel ครั้งแรก");
  });

  test("snapshot คืนลิสต์ว่าง → โชว์ empty state", async () => {
    const dom = makeDom();
    const els = await loginAndGetLeadsElements(dom);
    click(dom, els.toggle);
    await nextTick(1);

    globalThis.__SNAPSHOT_LISTENERS__["quote_requests"]({ docs: [] });
    await nextTick(1);

    assert.equal(els.emptyEl.style.display, "block");
    assert.equal(els.listEl.style.display, "none");
  });

  test("snapshot คืนรายการคำขอ → เรนเดอร์การ์ดในลิสต์ (แสดงรายการสินค้า items[] + status label ภาษาไทย)", async () => {
    const dom = makeDom();
    const els = await loginAndGetLeadsElements(dom);
    click(dom, els.toggle);
    await nextTick(1);

    globalThis.__SNAPSHOT_LISTENERS__["quote_requests"]({
      docs: [
        {
          id: "qr1",
          data: () => ({
            status: "new",
            createdAt: null,
            items: [
              { productId: "p1", name: "ป้ายจราจรสะท้อนแสง", variantLabel: "แบบเสา", size: "60x60ซม.", material: "อลูมิเนียม", qty: 2, unit: "แผ่น", note: "" },
            ],
          }),
        },
        {
          id: "qr2",
          data: () => ({
            status: "quoted",
            createdAt: null,
            items: [{ productId: "p2", name: "ป้ายความปลอดภัย", variantLabel: "", size: "", material: "", qty: 1, unit: "", note: "" }],
            quotePublicToken: "tok-abc-123",
          }),
        },
      ],
    });
    await nextTick(1);

    assert.equal(els.listEl.style.display, "flex");
    assert.equal(els.emptyEl.style.display, "none");
    assert.match(els.listEl.innerHTML, /ป้ายจราจรสะท้อนแสง/);
    assert.match(els.listEl.innerHTML, /รอดำเนินการ/); // label ของ status "new"
    assert.match(els.listEl.innerHTML, /ออกใบเสนอราคาแล้ว/); // label ของ status "quoted"
  });

  test("คำขอที่มี quotePublicToken → แสดงลิงก์ 'ดูใบเสนอราคา' ไปที่ quotation-view.html?token=... เปิดแท็บใหม่", async () => {
    const dom = makeDom();
    const els = await loginAndGetLeadsElements(dom);
    click(dom, els.toggle);
    await nextTick(1);

    globalThis.__SNAPSHOT_LISTENERS__["quote_requests"]({
      docs: [
        { id: "qr1", data: () => ({ status: "quoted", createdAt: null, items: [], quotePublicToken: "tok-xyz-999" }) },
      ],
    });
    await nextTick(1);

    assert.match(els.listEl.innerHTML, /quotation-view\.html\?token=tok-xyz-999/);
    assert.match(els.listEl.innerHTML, /target="_blank"/);
    assert.match(els.listEl.innerHTML, /rel="noopener noreferrer"/);
  });

  test("คำขอที่ยังไม่มี quotePublicToken → ไม่มีลิงก์ดูใบเสนอราคา แสดงแค่สถานะ", async () => {
    const dom = makeDom();
    const els = await loginAndGetLeadsElements(dom);
    click(dom, els.toggle);
    await nextTick(1);

    globalThis.__SNAPSHOT_LISTENERS__["quote_requests"]({
      docs: [{ id: "qr1", data: () => ({ status: "new", createdAt: null, items: [] }) }],
    });
    await nextTick(1);

    assert.doesNotMatch(els.listEl.innerHTML, /quotation-view\.html/);
  });

  test("กดขยายซ้ำสองครั้ง (toggle ปิดแล้วเปิดใหม่) → subscribe listenMyQuoteRequests() แค่ครั้งเดียว ไม่ subscribe ซ้ำ", async () => {
    const dom = makeDom();
    const els = await loginAndGetLeadsElements(dom);

    click(dom, els.toggle); // เปิด — subscribe
    await nextTick(1);
    click(dom, els.toggle); // ปิด — ไม่ unsubscribe (เก็บ subscription ไว้ใช้ต่อ)
    await nextTick(1);
    assert.equal(els.panel.style.display, "none");
    click(dom, els.toggle); // เปิดอีกครั้ง — ไม่ subscribe ซ้ำ
    await nextTick(1);

    assert.equal(els.panel.style.display, "block");
    // ยังทำงานได้ปกติ (subscription เดิมยังใช้ได้) — ยิง snapshot แล้วต้อง render ได้เหมือนเดิม
    globalThis.__SNAPSHOT_LISTENERS__["quote_requests"]({ docs: [] });
    await nextTick(1);
    assert.equal(els.emptyEl.style.display, "block");
  });

  test("กดปุ่ม logout → unsubscribe listenMyQuoteRequests() + ยุบ panel + เคลียร์ลิสต์เดิม", async () => {
    const dom = makeDom();
    const els = await loginAndGetLeadsElements(dom);
    const logoutBtn = dom.window.document.getElementById("ma-logout-btn");

    click(dom, els.toggle);
    await nextTick(1);
    globalThis.__SNAPSHOT_LISTENERS__["quote_requests"]({
      docs: [{ id: "qr1", data: () => ({ status: "new", createdAt: null, items: [{ productId: "p1", name: "ป้ายจราจร", variantLabel: "", size: "", material: "", qty: 1, unit: "", note: "" }] }) }],
    });
    await nextTick(1);
    assert.match(els.listEl.innerHTML, /ป้ายจราจร/);

    click(dom, logoutBtn);
    await nextTick(3);

    assert.equal(els.panel.style.display, "none");
    assert.equal(els.toggle.getAttribute("aria-expanded"), "false");
    assert.equal(els.listEl.innerHTML, "");
  });

  // หมายเหตุ: ไม่มีเทสยิง error callback ของ listenMyQuoteRequests() ตรงๆ ในไฟล์นี้ — stub
  // onSnapshot() ใน test/helpers/firebase-stub-loader.mjs เก็บแค่ onNext callback ไว้ใน
  // __SNAPSHOT_LISTENERS__ เท่านั้น ไม่ได้เก็บ error-callback (arg ที่ 3) ให้ยิงเองจากเทสได้
  // (ดู comment เดียวกันใน test/leads-line-history.test.mjs) — onLeadsError()/showLeadsError()
  // ในไฟล์นี้เป็น thin wrapper รอบ showLeadsOnly()/classList.add("show") ที่มีเทสตรงครอบคลุม
  // อยู่แล้วผ่าน state อื่นๆ ด้านบน (loading/empty/list) จึงไม่ผลิตเทส integration ปลอมที่ stub
  // ไม่รองรับจริง
  test("ma-leads-error เริ่มต้นไม่โชว์ (state ปกติ) ก่อนกดขยาย panel", async () => {
    const dom = makeDom();
    const els = await loginAndGetLeadsElements(dom);
    assert.equal(els.errorEl.classList.contains("show"), false);
  });
});
