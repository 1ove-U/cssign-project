// test/my-orders-page-en.test.mjs — P2.8c-I (English "My Orders" page)
//
// Mirrors test/my-orders-page.test.mjs exactly, but imports js/my-orders-page-en.js and asserts
// on the English strings instead of the Thai ones — same pattern as the -en.js file itself
// (duplicate file, same ids/logic, only text differs). Scope: js/my-orders-page-en.js only —
// loginWithLine()/listenMyOrders()/linkLineAccount() already have their own coverage in
// test/db-orders-line-login.test.mjs (round 163).
//
// Doesn't touch any real .js/.html/.css product code — test-only file.

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
    <button type="button" id="mo-logout-btn">Log out</button>
  </div>
  <div id="mo-link-more" style="display:none;">
    <button type="button" id="mo-link-more-toggle" style="display:inline-flex;"></button>
    <form id="mo-link-more-form" style="display:none;">
      <input id="mo-link-more-code">
      <input id="mo-link-more-phone">
      <button type="submit" id="mo-link-more-submit">Link This Order</button>
      <div id="mo-link-more-msg"></div>
    </form>
  </div>
`;

function makeDom() {
  return new JSDOM(`<!doctype html><html><body>${MO_HTML}</body></html>`, { url: "https://example.test/" });
}

async function loadMyOrdersPageEn(dom) {
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.MouseEvent = dom.window.MouseEvent;
  await import(`../js/my-orders-page-en.js?t=${Date.now()}-${Math.random()}`);
}

// Minimal window.liff mock — identical to test/my-orders-page.test.mjs / test/track-modal-liff-link.test.mjs
// (added logout() this round — used to test the P2.9-A logout button calling liffInstance.logout();
// doesn't affect any existing test since nothing called it before)
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
  // added this round (P2.9-A logout button tests) — reset signOut() state between tests
  globalThis.__SIGNOUT_CALLS__ = [];
  globalThis.__SIGNOUT_STUB__ = undefined;
  auth.currentUser = null;
});

describe("my-orders-page-en.js — element guard", () => {
  test("no required elements (not on en/my-orders.html) → does not throw on import", async () => {
    const dom = new JSDOM(`<!doctype html><html><body></body></html>`, { url: "https://example.test/" });
    globalThis.window = dom.window;
    globalThis.document = dom.window.document;
    await assert.doesNotReject(() => import(`../js/my-orders-page-en.js?t=${Date.now()}-${Math.random()}`));
  });
});

describe("my-orders-page-en.js — first page load", () => {
  test("liff not logged in → hides loading, shows login button", async () => {
    const dom = makeDom();
    mockLiff(dom, { loggedIn: false });
    stubFetch(() => { throw new Error("should not be called — not logged in yet"); });

    await loadMyOrdersPageEn(dom);
    await nextTick(3);

    assert.equal(dom.window.document.getElementById("mo-loading").style.display, "none");
    assert.equal(dom.window.document.getElementById("mo-login").style.display, "block");
  });

  test("liff already logged in (has idToken) → calls /line-login automatically, no button click needed", async () => {
    const dom = makeDom();
    mockLiff(dom, { loggedIn: true, idToken: "id-token-abc" });
    const calls = stubFetch(() => jsonResponse(200, { customToken: "tok-xyz", lineUserId: "U9999" }));

    await loadMyOrdersPageEn(dom);
    await nextTick(3);

    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /\/line-login$/);
    assert.deepEqual(globalThis.__SIGNIN_CUSTOM_TOKEN_CALLS__, ["tok-xyz"]);
    assert.equal(dom.window.document.getElementById("mo-orders-loading").style.display, "flex");
    assert.equal(typeof globalThis.__SNAPSHOT_LISTENERS__["orders"], "function");
  });
});

describe("my-orders-page-en.js — remembers existing session (P2.9-B)", () => {
  test("auth.currentUser already set (uid line_*) on page load → skips liff.login(), goes straight to afterLogin()", async () => {
    const dom = makeDom();
    const liff = mockLiff(dom, { loggedIn: false }); // deliberately false — if the code
    // mistakenly falls through to the normal liff flow, it lands on the login screen instead of
    // afterLogin(), which the assertions below catch.
    auth.currentUser = { uid: "line_U9999" };
    const calls = stubFetch(() => { throw new Error("should not be called — must skip /line-login when a session already exists"); });

    await loadMyOrdersPageEn(dom);
    await nextTick(3);

    assert.equal(liff.initCalled, false, "liff.init() should never be called when a session already exists");
    assert.equal(calls.length, 0);
    assert.equal(dom.window.document.getElementById("mo-orders-loading").style.display, "flex");
    assert.equal(typeof globalThis.__SNAPSHOT_LISTENERS__["orders"], "function");
    // P2.9-E bugfix: listenMyOrders() must query with the raw lineUserId (no "line_" prefix) to
    // match order.lineUserId as stored in Firestore — not auth.currentUser.uid directly.
    const whereCall = globalThis.__WHERE_CALLS__.find((c) => c.field === "lineUserId");
    assert.ok(whereCall, "must query with the lineUserId field");
    assert.equal(whereCall.value, "U9999", "must strip the \"line_\" prefix before querying, not the raw uid (line_U9999)");
  });

  test("auth.currentUser is an admin session (uid without line_ prefix) → does not skip, follows normal liff check", async () => {
    const dom = makeDom();
    mockLiff(dom, { loggedIn: false });
    auth.currentUser = { uid: "admin-abc123" }; // an admin session that happens to still be active in the same browser
    stubFetch(() => { throw new Error("should not be called — not logged in with LINE yet"); });

    await loadMyOrdersPageEn(dom);
    await nextTick(3);

    // Must not be treated as a LINE customer session — shows the login button same as no session at all
    assert.equal(dom.window.document.getElementById("mo-loading").style.display, "none");
    assert.equal(dom.window.document.getElementById("mo-login").style.display, "block");
  });

  test("no auth.currentUser (null) → follows normal liff check as before", async () => {
    const dom = makeDom();
    mockLiff(dom, { loggedIn: false });
    auth.currentUser = null;
    stubFetch(() => { throw new Error("should not be called — not logged in yet"); });

    await loadMyOrdersPageEn(dom);
    await nextTick(3);

    assert.equal(dom.window.document.getElementById("mo-login").style.display, "block");
  });
});

// P2.9-A — logout button (missing since round A2 — the HTML fixture back then didn't even have
// #mo-logout, so it could never be tested; every old test still passed because the real code
// guards every query with `if (el)`. Added this round without touching any product code.)
describe("my-orders-page-en.js — logout button (P2.9-A)", () => {
  test("successful login (existing session P2.9-B) → shows the logout button", async () => {
    const dom = makeDom();
    mockLiff(dom, { loggedIn: false });
    auth.currentUser = { uid: "line_U9999" };
    stubFetch(() => { throw new Error("should not be called — existing session already present"); });

    await loadMyOrdersPageEn(dom);
    await nextTick(3);

    assert.equal(dom.window.document.getElementById("mo-logout").style.display, "block");
  });

  test("click logout (existing session, liffInstance still null) → calls signOut(), doesn't crash (no liffInstance to call logout() on), resets back to login screen", async () => {
    const dom = makeDom();
    mockLiff(dom, { loggedIn: false });
    auth.currentUser = { uid: "line_U9999" };
    stubFetch(() => { throw new Error("should not be called"); });

    await loadMyOrdersPageEn(dom);
    await nextTick(3);

    globalThis.__SNAPSHOT_LISTENERS__["orders"]({
      docs: [{ id: "o1", data: () => ({ code: "PO-1", item: "Sign", status: "production", progress: 10 }) }],
    });
    assert.match(dom.window.document.getElementById("mo-list").innerHTML, /PO-1/);

    click(dom, dom.window.document.getElementById("mo-logout-btn"));
    await nextTick(3);

    assert.equal(globalThis.__SIGNOUT_CALLS__.length, 1);
    assert.equal(dom.window.document.getElementById("mo-list").innerHTML, "");
    assert.equal(dom.window.document.getElementById("mo-logout").style.display, "none");
    assert.equal(dom.window.document.getElementById("mo-link-more").style.display, "none");
    assert.equal(dom.window.document.getElementById("mo-login").style.display, "block");
    assert.equal(dom.window.document.getElementById("mo-logout-btn").disabled, false, "must be re-enabled after logout finishes");
  });

  test("click logout after a fresh real LIFF login (liffInstance.isLoggedIn()=true) → also calls liff.logout()", async () => {
    const dom = makeDom();
    const liff = mockLiff(dom, { loggedIn: true, idToken: "id-token-abc" });
    stubFetch(() => jsonResponse(200, { customToken: "tok-xyz", lineUserId: "U9999" }));

    await loadMyOrdersPageEn(dom);
    await nextTick(3);
    assert.equal(dom.window.document.getElementById("mo-logout").style.display, "block");

    click(dom, dom.window.document.getElementById("mo-logout-btn"));
    await nextTick(3);

    assert.equal(liff.__logoutCalled, true, "must call liff.logout() to prevent auto-login on refresh");
    assert.equal(globalThis.__SIGNOUT_CALLS__.length, 1);
    assert.equal(dom.window.document.getElementById("mo-login").style.display, "block");
  });

  test("rapid repeated clicks while still disabled → signOut() only called once", async () => {
    const dom = makeDom();
    mockLiff(dom, { loggedIn: false });
    auth.currentUser = { uid: "line_U9999" };
    stubFetch(() => { throw new Error("should not be called"); });

    await loadMyOrdersPageEn(dom);
    await nextTick(3);

    const btn = dom.window.document.getElementById("mo-logout-btn");
    click(dom, btn);
    assert.equal(btn.disabled, true, "must disable immediately on first click to guard against double-clicks");
    click(dom, btn);
    click(dom, btn);
    await nextTick(3);

    assert.equal(globalThis.__SIGNOUT_CALLS__.length, 1);
  });

  test("signOut() fails (e.g. network drop) → still resets back to the login screen, doesn't hang", async () => {
    const dom = makeDom();
    mockLiff(dom, { loggedIn: false });
    auth.currentUser = { uid: "line_U9999" };
    stubFetch(() => { throw new Error("should not be called"); });
    globalThis.__SIGNOUT_STUB__ = () => ({ throw: new Error("network down") });

    await loadMyOrdersPageEn(dom);
    await nextTick(3);

    click(dom, dom.window.document.getElementById("mo-logout-btn"));
    await nextTick(3);

    assert.equal(dom.window.document.getElementById("mo-login").style.display, "block");
    assert.equal(dom.window.document.getElementById("mo-logout").style.display, "none");
    assert.equal(dom.window.document.getElementById("mo-logout-btn").disabled, false);
  });
});

describe("my-orders-page-en.js — login button", () => {
  test("click → liff not logged in → calls liff.login() (redirect), does not call /line-login", async () => {
    const dom = makeDom();
    const liff = mockLiff(dom, { loggedIn: false });
    const calls = stubFetch(() => { throw new Error("should not be called"); });

    await loadMyOrdersPageEn(dom);
    await nextTick(3);
    click(dom, dom.window.document.getElementById("mo-login-btn"));
    await nextTick(3);

    assert.equal(liff.__loginCalled, true);
    assert.equal(calls.length, 0);
  });

  test("login succeeds (from button) then fetch fails (invalid_line_token) → back to login button with error", async () => {
    const dom = makeDom();
    mockLiff(dom, { loggedIn: true, idToken: "id-token-abc" });
    stubFetch(() => jsonResponse(401, { error: "invalid_line_token" }));

    await loadMyOrdersPageEn(dom);
    await nextTick(3); // the auto flow on page load will already try and fail the same way — let it finish first

    const errText = dom.window.document.getElementById("mo-error-text");
    const errBox = dom.window.document.getElementById("mo-error");
    assert.equal(dom.window.document.getElementById("mo-login").style.display, "block");
    assert.ok(errBox.classList.contains("show"));
    assert.match(errText.textContent, /LINE verification failed/);
  });
});

describe("my-orders-page-en.js — order list after successful login", () => {
  async function loginAndGetSnapshotHandler(dom) {
    mockLiff(dom, { loggedIn: true, idToken: "id-token-abc" });
    stubFetch(() => jsonResponse(200, { customToken: "tok-xyz", lineUserId: "U9999" }));
    await loadMyOrdersPageEn(dom);
    await nextTick(3);
    return globalThis.__SNAPSHOT_LISTENERS__["orders"];
  }

  test("snapshot has orders → shows the list, hides empty/loading", async () => {
    const dom = makeDom();
    const snapshotHandler = await loginAndGetSnapshotHandler(dom);
    assert.equal(typeof snapshotHandler, "function");

    snapshotHandler({
      docs: [
        { id: "o1", data: () => ({ code: "PO-2026-0099", item: "High-voltage warning sign", qty: 3, status: "production", progress: 40 }) }
      ]
    });

    const listEl = dom.window.document.getElementById("mo-list");
    assert.equal(listEl.style.display, "flex");
    assert.equal(dom.window.document.getElementById("mo-empty").style.display, "none");
    assert.match(listEl.innerHTML, /PO-2026-0099/);
    assert.match(listEl.innerHTML, /High-voltage warning sign/);
    assert.match(listEl.innerHTML, /Qty 3/);
  });

  test("empty snapshot (no orders linked yet) → shows the empty state", async () => {
    const dom = makeDom();
    const snapshotHandler = await loginAndGetSnapshotHandler(dom);

    snapshotHandler({ docs: [] });

    assert.equal(dom.window.document.getElementById("mo-empty").style.display, "block");
    assert.equal(dom.window.document.getElementById("mo-list").style.display, "none");
  });
});

// P2.8c-F/I parity — "Link another order" button (reuses the LIFF session already logged in from
// round E — calls the real linkLineAccount() from js/db-orders.js directly, not mocked, same as
// loginWithLine()/listenMyOrders() above — only fetch()/signInWithCustomToken()/updateDoc() are
// stubbed at the Firebase/network layer via register-loader.mjs (firebase-stub-loader.mjs)
describe("my-orders-page-en.js — link another order (P2.8c-F/I)", () => {
  async function loginOnly(dom) {
    mockLiff(dom, { loggedIn: true, idToken: "id-token-abc" });
    stubFetch((url) => {
      if (/\/line-login$/.test(url)) return jsonResponse(200, { customToken: "tok-xyz", lineUserId: "U9999" });
      throw new Error("unexpected fetch: " + url);
    });
    await loadMyOrdersPageEn(dom);
    await nextTick(3);
  }

  test("login succeeds → 'Link Another Order' button appears (even before orders finish loading)", async () => {
    const dom = makeDom();
    await loginOnly(dom);
    assert.equal(dom.window.document.getElementById("mo-link-more").style.display, "block");
  });

  test("not logged in → 'Link Another Order' button stays hidden", async () => {
    const dom = makeDom();
    mockLiff(dom, { loggedIn: false });
    stubFetch(() => { throw new Error("should not be called"); });
    await loadMyOrdersPageEn(dom);
    await nextTick(3);
    assert.equal(dom.window.document.getElementById("mo-link-more").style.display, "none");
  });

  test("click toggle → shows the PO/phone form", async () => {
    const dom = makeDom();
    await loginOnly(dom);
    click(dom, dom.window.document.getElementById("mo-link-more-toggle"));
    assert.equal(dom.window.document.getElementById("mo-link-more-form").style.display, "block");
  });

  test("submit with nothing filled in → shows validation error, does not call fetch", async () => {
    const dom = makeDom();
    await loginOnly(dom);
    const fetchCallsBefore = globalThis.__SIGNIN_CUSTOM_TOKEN_CALLS__.length;
    submitForm(dom, "mo-link-more-form");
    await nextTick(2);
    assert.match(
      dom.window.document.getElementById("mo-link-more-msg").textContent,
      /Please enter the PO number/
    );
    assert.equal(globalThis.__SIGNIN_CUSTOM_TOKEN_CALLS__.length, fetchCallsBefore);
  });

  test("successful submit → calls the real linkLineAccount() (fetch /link-line + signInWithCustomToken + updateDoc) then hides the form", async () => {
    const dom = makeDom();
    mockLiff(dom, { loggedIn: true, idToken: "id-token-abc" });
    stubFetch((url) => {
      if (/\/line-login$/.test(url)) return jsonResponse(200, { customToken: "tok-xyz", lineUserId: "U9999" });
      if (/\/link-line$/.test(url)) return jsonResponse(200, { customToken: "tok-abc", orderId: "order-42", lineUserId: "U9999" });
      throw new Error("unexpected fetch: " + url);
    });
    await loadMyOrdersPageEn(dom);
    await nextTick(3);

    click(dom, dom.window.document.getElementById("mo-link-more-toggle")); // open the form first
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

  test("submit fetch fails (order_not_found) → shows the right error, does not hide the form", async () => {
    const dom = makeDom();
    mockLiff(dom, { loggedIn: true, idToken: "id-token-abc" });
    stubFetch((url) => {
      if (/\/line-login$/.test(url)) return jsonResponse(200, { customToken: "tok-xyz", lineUserId: "U9999" });
      if (/\/link-line$/.test(url)) return jsonResponse(404, { error: "order_not_found" });
      throw new Error("unexpected fetch: " + url);
    });
    await loadMyOrdersPageEn(dom);
    await nextTick(3);

    click(dom, dom.window.document.getElementById("mo-link-more-toggle")); // open the form first
    dom.window.document.getElementById("mo-link-more-code").value = "PO-DOES-NOT-EXIST";
    dom.window.document.getElementById("mo-link-more-phone").value = "0891234567";
    submitForm(dom, "mo-link-more-form");
    await nextTick(4);

    assert.match(
      dom.window.document.getElementById("mo-link-more-msg").textContent,
      /No order matches that PO number/
    );
    assert.equal(dom.window.document.getElementById("mo-link-more-form").style.display, "block");
    assert.equal(dom.window.document.getElementById("mo-link-more-submit").disabled, false);
  });
});
