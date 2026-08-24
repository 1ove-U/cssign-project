// test/my-account-page-en.test.mjs — P2.9-C3 (English "My Account" page)
//
// Mirrors test/my-account-page.test.mjs exactly, but imports js/my-account-page-en.js and
// asserts on the English strings instead of the Thai ones — same pattern as the -en.js file
// itself (duplicate file, same ids/logic, only text differs). Scope: js/my-account-page-en.js
// only — loginWithLine() already has its own coverage in test/db-orders-line-login.test.mjs
// (round 163).
//
// Same key difference from test/my-orders-page-en.test.mjs as in the Thai version: this page
// "always calls liff.init()" even when an existing Firebase session is there (unlike
// my-orders-page-en.js, which shortcuts past the whole flow) — the only thing that gets skipped
// is the fetch to /line-login, because this page always needs a live liff instance to call
// liff.getProfile() for the name/picture. See the "remember existing session (P2.9-B pattern)"
// describe block below.
//
// Doesn't touch any real .js/.html/.css product code — test-only file.

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

async function loadMyAccountPageEn(dom) {
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.MouseEvent = dom.window.MouseEvent;
  await import(`../js/my-account-page-en.js?t=${Date.now()}-${Math.random()}`);
}

// Minimal window.liff mock — identical to test/my-account-page.test.mjs / test/my-orders-page-en.test.mjs,
// plus getProfile() since this page always calls it to show the name/picture (my-orders-page-en.js
// doesn't have getProfile() at all).
function mockLiff(dom, { loggedIn, idToken, profile }) {
  dom.window.liff = {
    initCalled: false,
    init: function () { this.initCalled = true; return Promise.resolve(); },
    isLoggedIn: () => !!loggedIn,
    login: function () { this.__loginCalled = true; },
    logout: function () { this.__logoutCalled = true; },
    getIDToken: () => idToken || null,
    getProfile: () => Promise.resolve(profile || { displayName: "John Smith", pictureUrl: "https://example.test/avatar.png" }),
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

describe("my-account-page-en.js — element guard", () => {
  test("missing required elements (not en/my-account.html) → does not throw on import", async () => {
    const dom = new JSDOM(`<!doctype html><html><body></body></html>`, { url: "https://example.test/" });
    globalThis.window = dom.window;
    globalThis.document = dom.window.document;
    await assert.doesNotReject(() => import(`../js/my-account-page-en.js?t=${Date.now()}-${Math.random()}`));
  });
});

describe("my-account-page-en.js — first page load", () => {
  test("liff not logged in yet → hides loading, shows the login button", async () => {
    const dom = makeDom();
    mockLiff(dom, { loggedIn: false });
    stubFetch(() => { throw new Error("should not be called — not logged in yet"); });

    await loadMyAccountPageEn(dom);
    await nextTick(3);

    assert.equal(dom.window.document.getElementById("ma-loading").style.display, "none");
    assert.equal(dom.window.document.getElementById("ma-login").style.display, "block");
  });

  test("liff already logged in (has idToken) → calls /line-login then fetches the profile, shows name/picture", async () => {
    const dom = makeDom();
    mockLiff(dom, {
      loggedIn: true,
      idToken: "id-token-abc",
      profile: { displayName: "Jane Doe", pictureUrl: "https://example.test/jane.png" },
    });
    const calls = stubFetch(() => jsonResponse(200, { customToken: "tok-xyz", lineUserId: "U9999" }));

    await loadMyAccountPageEn(dom);
    await nextTick(3);

    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /\/line-login$/);
    assert.deepEqual(globalThis.__SIGNIN_CUSTOM_TOKEN_CALLS__, ["tok-xyz"]);
    assert.equal(dom.window.document.getElementById("ma-profile").style.display, "block");
    assert.equal(dom.window.document.getElementById("ma-name").textContent, "Jane Doe");
    assert.equal(dom.window.document.getElementById("ma-avatar").src, "https://example.test/jane.png");
    assert.equal(dom.window.document.getElementById("ma-avatar").style.display, "block");
  });
});

describe("my-account-page-en.js — remember existing session (P2.9-B pattern)", () => {
  test("has auth.currentUser (uid line_*) already → still calls liff.init() but skips the /line-login fetch and goes straight to the profile fetch", async () => {
    const dom = makeDom();
    const liff = mockLiff(dom, {
      loggedIn: true,
      idToken: "id-token-abc",
      profile: { displayName: "Existing Customer", pictureUrl: "https://example.test/existing.png" },
    });
    auth.currentUser = { uid: "line_U9999" };
    const calls = stubFetch(() => { throw new Error("should not be called — must skip /line-login since a session already exists"); });

    await loadMyAccountPageEn(dom);
    await nextTick(3);

    // Key difference from my-orders-page-en.js: this page still always calls liff.init() because
    // it needs liff.getProfile() to show the name/picture — the only thing that gets skipped is
    // the /line-login fetch.
    assert.equal(liff.initCalled, true, "must still call liff.init() even with an existing session");
    assert.equal(calls.length, 0, "must skip the /line-login fetch since an existing Firebase session is there");
    assert.equal(dom.window.document.getElementById("ma-profile").style.display, "block");
    assert.equal(dom.window.document.getElementById("ma-name").textContent, "Existing Customer");
  });

  test("auth.currentUser is an admin session (uid doesn't start with line_) → doesn't skip, calls /line-login as usual", async () => {
    const dom = makeDom();
    mockLiff(dom, { loggedIn: true, idToken: "id-token-abc" });
    auth.currentUser = { uid: "admin-abc123" }; // a stray admin session that happens to be sitting in the same browser
    const calls = stubFetch(() => jsonResponse(200, { customToken: "tok-xyz", lineUserId: "U9999" }));

    await loadMyAccountPageEn(dom);
    await nextTick(3);

    // Must not be mistaken for a LINE customer session — calls /line-login as usual, same as no session at all
    assert.equal(calls.length, 1);
    assert.equal(dom.window.document.getElementById("ma-profile").style.display, "block");
  });

  test("no auth.currentUser (null) → calls /line-login as usual", async () => {
    const dom = makeDom();
    mockLiff(dom, { loggedIn: true, idToken: "id-token-abc" });
    auth.currentUser = null;
    const calls = stubFetch(() => jsonResponse(200, { customToken: "tok-xyz", lineUserId: "U9999" }));

    await loadMyAccountPageEn(dom);
    await nextTick(3);

    assert.equal(calls.length, 1);
    assert.equal(dom.window.document.getElementById("ma-profile").style.display, "block");
  });
});

describe("my-account-page-en.js — login button", () => {
  test("click → liff not logged in → calls liff.login() (redirect), no fetch call", async () => {
    const dom = makeDom();
    const liff = mockLiff(dom, { loggedIn: false });
    const calls = stubFetch(() => { throw new Error("should not be called"); });

    await loadMyAccountPageEn(dom);
    await nextTick(3);
    click(dom, dom.window.document.getElementById("ma-login-btn"));
    await nextTick(3);

    assert.equal(liff.__loginCalled, true);
    assert.equal(calls.length, 0);
  });

  test("login succeeds (via button) then fetch fails (invalid_line_token) → back to login button with an error", async () => {
    const dom = makeDom();
    mockLiff(dom, { loggedIn: true, idToken: "id-token-abc" });
    stubFetch(() => jsonResponse(401, { error: "invalid_line_token" }));

    await loadMyAccountPageEn(dom);
    await nextTick(3); // the automatic flow on page load already tries and fails the same way — let it settle first

    const errText = dom.window.document.getElementById("ma-error-text");
    const errBox = dom.window.document.getElementById("ma-error");
    assert.equal(dom.window.document.getElementById("ma-login").style.display, "block");
    assert.ok(errBox.classList.contains("show"));
    assert.match(errText.textContent, /LINE verification failed/);
  });
});

describe("my-account-page-en.js — log out", () => {
  async function loginAndGetElements(dom) {
    mockLiff(dom, {
      loggedIn: true,
      idToken: "id-token-abc",
      profile: { displayName: "Logout Test", pictureUrl: "https://example.test/logout-test.png" },
    });
    stubFetch(() => jsonResponse(200, { customToken: "tok-xyz", lineUserId: "U9999" }));
    await loadMyAccountPageEn(dom);
    await nextTick(3);
    return {
      nameEl: dom.window.document.getElementById("ma-name"),
      avatarEl: dom.window.document.getElementById("ma-avatar"),
      profileEl: dom.window.document.getElementById("ma-profile"),
      loginEl: dom.window.document.getElementById("ma-login"),
      logoutBtn: dom.window.document.getElementById("ma-logout-btn"),
    };
  }

  test("logged in, then click logout → clears name/picture, back to the login state", async () => {
    const dom = makeDom();
    const els = await loginAndGetElements(dom);
    assert.equal(els.profileEl.style.display, "block");
    assert.equal(els.nameEl.textContent, "Logout Test");

    click(dom, els.logoutBtn);
    await nextTick(3);

    assert.equal(els.nameEl.textContent, "");
    assert.equal(els.avatarEl.getAttribute("src"), ""); // jsdom resolves .src to an absolute URL even when set to "" — check the raw attribute instead
    assert.equal(els.avatarEl.style.display, "none");
    assert.equal(els.loginEl.style.display, "block");
    assert.equal(els.profileEl.style.display, "none");
    assert.equal(els.logoutBtn.disabled, false); // re-enabled after logout finishes, so it can be clicked again
  });
});

// "My Quote Requests" — P3.0 Phase 5 round 9 (replaces the P2.9-D2/D3 listenMyLeads() entirely,
// mirroring the same switch made on the Thai page in round 8)
// Scope: only that my-account-page-en.js orchestrates the call to listenMyQuoteRequests()
// (js/db-quote-requests.js) at the right point/with the right lineUserId, and switches the panel
// state (loading/empty/list/error) correctly along the real flow, and renders request cards
// (items[]/status/quotePublicToken link) correctly — does not re-test listenMyQuoteRequests()
// itself (already covered elsewhere in the data-layer test suite). Fires a fake snapshot through
// globalThis.__SNAPSHOT_LISTENERS__["quote_requests"](...), same pattern as the old leads tests
// (see the onSnapshot() stub in test/helpers/firebase-stub-loader.mjs — query()/collection() drop
// the real where() clause, just returning ref.path = "quote_requests" since
// listenMyQuoteRequests() calls collection(db, "quote_requests") directly in
// js/db-quote-requests.js).
describe("my-account-page-en.js — My Quote Requests (P3.0 Phase 5 round 9)", () => {
  async function loginAndGetLeadsElements(dom, lineUserId) {
    mockLiff(dom, {
      loggedIn: true,
      idToken: "id-token-abc",
      profile: { displayName: "Quote Test", pictureUrl: "https://example.test/lead-test.png" },
    });
    stubFetch(() => jsonResponse(200, { customToken: "tok-xyz", lineUserId: lineUserId || "U9999" }));
    await loadMyAccountPageEn(dom);
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

  test("no ma-leads-toggle in the DOM (older page/other test) → does not throw on import or login", async () => {
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
    await assert.doesNotReject(() => loadMyAccountPageEn(dom));
    await nextTick(3);
    assert.equal(dom.window.document.getElementById("ma-profile").style.display, "block");
  });

  test("click to expand panel the first time → calls listenMyQuoteRequests() with the lineUserId from loginWithLine() + shows loading first", async () => {
    const dom = makeDom();
    const els = await loginAndGetLeadsElements(dom, "U9999");
    assert.equal(els.panel.style.display, "none");

    click(dom, els.toggle);
    await nextTick(1);

    assert.equal(els.panel.style.display, "block");
    assert.equal(els.toggle.getAttribute("aria-expanded"), "true");
    assert.equal(typeof globalThis.__SNAPSHOT_LISTENERS__["quote_requests"], "function", "must subscribe listenMyQuoteRequests() the first time the panel is expanded");
  });

  test("snapshot returns an empty list → shows the empty state", async () => {
    const dom = makeDom();
    const els = await loginAndGetLeadsElements(dom);
    click(dom, els.toggle);
    await nextTick(1);

    globalThis.__SNAPSHOT_LISTENERS__["quote_requests"]({ docs: [] });
    await nextTick(1);

    assert.equal(els.emptyEl.style.display, "block");
    assert.equal(els.listEl.style.display, "none");
  });

  test("snapshot returns quote requests → renders cards in the list (shows items[] + English status label)", async () => {
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
              { productId: "p1", name: "Reflective traffic sign", variantLabel: "Post-mounted", size: "60x60cm", material: "Aluminum", qty: 2, unit: "pc", note: "" },
            ],
          }),
        },
        {
          id: "qr2",
          data: () => ({
            status: "quoted",
            createdAt: null,
            items: [{ productId: "p2", name: "Safety sign", variantLabel: "", size: "", material: "", qty: 1, unit: "", note: "" }],
            quotePublicToken: "tok-abc-123",
          }),
        },
      ],
    });
    await nextTick(1);

    assert.equal(els.listEl.style.display, "flex");
    assert.equal(els.emptyEl.style.display, "none");
    assert.match(els.listEl.innerHTML, /Reflective traffic sign/);
    assert.match(els.listEl.innerHTML, /Pending/); // label for status "new"
    assert.match(els.listEl.innerHTML, /Quote issued/); // label for status "quoted"
  });

  test("a request with quotePublicToken → shows a 'View Quotation' link to quotation-view.html?token=... opening a new tab", async () => {
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

  test("a request without quotePublicToken yet → no view-quotation link, just the status", async () => {
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

  test("expand twice (toggle closed then open again) → subscribes listenMyQuoteRequests() only once, no duplicate subscription", async () => {
    const dom = makeDom();
    const els = await loginAndGetLeadsElements(dom);

    click(dom, els.toggle); // open — subscribes
    await nextTick(1);
    click(dom, els.toggle); // close — does not unsubscribe (keeps the subscription for later)
    await nextTick(1);
    assert.equal(els.panel.style.display, "none");
    click(dom, els.toggle); // open again — does not subscribe again
    await nextTick(1);

    assert.equal(els.panel.style.display, "block");
    // still works normally (the existing subscription still works) — fire a snapshot and it
    // should render the same as before
    globalThis.__SNAPSHOT_LISTENERS__["quote_requests"]({ docs: [] });
    await nextTick(1);
    assert.equal(els.emptyEl.style.display, "block");
  });

  test("click logout → unsubscribes listenMyQuoteRequests() + collapses the panel + clears the existing list", async () => {
    const dom = makeDom();
    const els = await loginAndGetLeadsElements(dom);
    const logoutBtn = dom.window.document.getElementById("ma-logout-btn");

    click(dom, els.toggle);
    await nextTick(1);
    globalThis.__SNAPSHOT_LISTENERS__["quote_requests"]({
      docs: [{ id: "qr1", data: () => ({ status: "new", createdAt: null, items: [{ productId: "p1", name: "Traffic sign", variantLabel: "", size: "", material: "", qty: 1, unit: "", note: "" }] }) }],
    });
    await nextTick(1);
    assert.match(els.listEl.innerHTML, /Traffic sign/);

    click(dom, logoutBtn);
    await nextTick(3);

    assert.equal(els.panel.style.display, "none");
    assert.equal(els.toggle.getAttribute("aria-expanded"), "false");
    assert.equal(els.listEl.innerHTML, "");
  });

  // Note: no test fires the error callback of listenMyQuoteRequests() directly in this file — the
  // onSnapshot() stub in test/helpers/firebase-stub-loader.mjs only keeps the onNext callback in
  // __SNAPSHOT_LISTENERS__, not the error callback (3rd arg), for a test to fire itself (see the
  // same comment in test/leads-line-history.test.mjs). onLeadsError()/showLeadsError() in this
  // file are thin wrappers around showLeadsOnly()/classList.add("show"), which already have
  // direct coverage through the other states above (loading/empty/list) — so this file doesn't
  // fabricate an integration test the stub can't actually support.
  test("ma-leads-error is hidden by default (normal state) before the panel is expanded", async () => {
    const dom = makeDom();
    const els = await loginAndGetLeadsElements(dom);
    assert.equal(els.errorEl.classList.contains("show"), false);
  });
});
