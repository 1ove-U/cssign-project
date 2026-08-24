// test/admin-page.test.mjs — รอบที่ 134
//
// ขอบเขต: js/admin-page.js (272 บรรทัด) — ไฟล์ bootstrap สุดท้ายของหน้าแอดมิน (ไฟล์เดียวที่เหลือ
// ในกลุ่ม admin-* business logic ที่ยังไม่มีเทส ตามที่บันทึกไว้ท้ายรอบ 133): ผูก auth (login/
// logout/onAuthChange), reloadAll() (โหลดข้อมูลทุก collection พร้อมกันแล้วเรียก render ของทุกแท็บ),
// switchTab()/switchSettingsSubtab() (สลับแท็บหลัก/แท็บย่อยของหน้าตั้งค่า + คีย์บอร์ดซ้าย/ขวา/Home/
// End), ปุ่ม "?" พับ/กางคำอธิบายในหน้าตั้งค่า, deep-link เปิดแท็บจาก #hash
//
// ไฟล์นี้ import เกือบทุกไฟล์ admin-*.js อีก ~20 ไฟล์ (แต่ละไฟล์มีเทสของตัวเองอยู่แล้ว) +
// orders-tab.js (ผูก Firestore listener จริงของคำสั่งผลิต) + admin-leads.js/admin-sidebar.js/
// admin-global-search.js/admin-keyboard-shortcuts.js/admin-products-csv.js/
// admin-leads-automation.js (side-effect เท่านั้น) พร้อม side-effect ผูก event ของ auth/sidebar/
// global-search ทันทีตอน evaluate — บันทึกไว้หลายรอบ (106/121/132) ว่า "โหลดไม่ได้ในสภาพแวดล้อม
// เทส" เพราะลากทั้งแอปมาด้วย ไม่ deterministic (Firestore listener จริงของ orders-tab.js/
// admin-leads.js) — รอบนี้แก้ด้วยการสร้าง stub loader ใหม่ทิศทางตรงข้ามกับ
// admin-page-stub-loader.mjs เดิม: **ปล่อยให้ js/admin-page.js ตัวจริงถูก import ตรงๆ** (เป็น
// เป้าหมายที่กำลังเทส) แต่ดัก "สิ่งที่มันเอง import" แทน — ดู
// test/helpers/admin-page-deps-stub-loader.mjs สำหรับรายชื่อไฟล์ที่ถูกสตับทั้งหมด (~20 ไฟล์ UI
// แท็บย่อย + orders-tab.js + admin-leads.js + 5 ไฟล์ side-effect-only) — ไฟล์ที่ **ไม่** สตับ (ให้
// โหลดจริง): js/db.js (auth) + js/db-taxonomy.js/db-products.js/db-content.js/db-settings.js/
// db-blog.js (data layer — deterministic ผ่าน firebase-stub-loader.mjs เดิมอยู่แล้ว) +
// js/admin-state.js/js/ui-helpers.js/js/ui-form-validation.js (ไฟล์ DOM/state ธรรมดา ไม่พึ่ง
// Firestore ตรงๆ)
//
// เพิ่ม 2 hook ใหม่ใน firebase-stub-loader.mjs (ไม่กระทบ default เดิม): __SIGNIN_STUB__ (จำลอง
// ล็อกอินผิด), __AUTH_STATE_CALLBACK__ (เก็บ callback ของ onAuthStateChanged() ที่เดิมถูกทิ้งไปเฉยๆ
// ให้เทสยิงจำลอง login/logout เองได้ — จุดเดียวในโปรเจกต์ที่เรียก onAuthChange() คือไฟล์นี้)
//
// **ไม่ทดสอบภายในไฟล์ที่ถูกสตับเลย** (renderProducts()/startLeadsListener()/initOrdersTab() ฯลฯ
// มีเทสของตัวเองอยู่แล้วในไฟล์อื่น) — เทสที่นี่ตรวจแค่ "การเดินสาย" ของ admin-page.js เอง: เรียก
// ฟังก์ชันแท็บย่อยถูกครบ/ถูกลำดับ, auth gate แสดง/ซ่อนถูก, error path ของ reloadAll()

import { test, describe, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const ADMIN_HTML = readFileSync(new URL("../admin.html", import.meta.url), "utf-8");
const BODY_START = ADMIN_HTML.indexOf(">", ADMIN_HTML.indexOf("<body")) + 1;
const BODY_END = ADMIN_HTML.indexOf("</body>");
const ADMIN_BODY_NO_SCRIPTS = ADMIN_HTML
  .slice(BODY_START, BODY_END)
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, "");

let document;
let mod;                    // admin-page.js exports: switchTab/switchSettingsSubtab/reloadAll
let attachUnsavedGuard;     // ui-form-validation.js — ใช้จำลองฟอร์ม dirty ก่อนออกจากระบบ

function el(id) { return document.getElementById(id); }
function authCallback() { return globalThis.__AUTH_STATE_CALLBACK__; }

function flush() { return new Promise((r) => setTimeout(r, 0)); }

function resetSpies() {
  globalThis.__AD_PAGE_DEPS_CALLS__ = {};
  globalThis.__AD_PAGE_DEPS_CALLBACKS__ = {};
  globalThis.__SIGNIN_STUB__ = undefined;
  globalThis.__SIGNOUT_CALLS__ = [];
  globalThis.__GET_DOCS_STUB__ = undefined;
  // P1.6a: getMyStaffRole() (เรียกท้าย onAuthChange() ใน admin-page.js ตอนนี้) อ่านผ่าน
  // getDoc() ซึ่งพึ่ง globalThis.__GET_DOC_STUB__ (คนละตัวกับ __GET_DOCS_STUB__ ด้านบน —
  // getSettings() ของ reloadAll() ก็ใช้ตัวเดียวกันนี้อยู่แล้วเดิม) reset ทุกเทสกันรั่วข้ามเทส
  // ที่ตั้งไว้เฉพาะสำหรับทดสอบ role production ด้านล่าง
  globalThis.__GET_DOC_STUB__ = undefined;
}

function callsOf(name) {
  return globalThis.__AD_PAGE_DEPS_CALLS__[name] || [];
}

// จำลองสถานะ "ยังไม่ได้ล็อกอิน" กลับสู่ปกติหลังแต่ละเทส (login/logout ผ่าน callback จริง)
async function forceLogout() {
  await authCallback()(null);
}

function makeFormFor(id) {
  const form = document.createElement("form");
  form.innerHTML = `<input id="${id}-name" value="เดิม">`;
  document.body.appendChild(form);
  return form;
}

before(async () => {
  const dom = new JSDOM(`<!doctype html><html><body>${ADMIN_BODY_NO_SCRIPTS}</body></html>`, {
    url: "https://example.com/admin.html",
  });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
  Object.defineProperty(globalThis, "location", { value: dom.window.location, configurable: true });
  globalThis.Event = dom.window.Event;
  globalThis.KeyboardEvent = dom.window.KeyboardEvent;
  document = dom.window.document;

  mod = await import("../js/admin-page.js");
  ({ attachUnsavedGuard } = await import("../js/ui-form-validation.js"));
});

beforeEach(async () => {
  resetSpies();
  // เริ่มทุกเทสจากสถานะ "ยังไม่ได้ล็อกอิน" เสมอ (เผื่อเทสก่อนหน้าล็อกอินค้างไว้)
  if (el("ad-app").style.display !== "none") {
    await forceLogout();
  }
  el("ad-login-error").style.display = "none";
  el("ad-email").value = "";
  el("ad-pass").value = "";
  location.hash = "";
});

describe("Auth — ล็อกอิน (ad-login-form submit)", () => {
  test("กรอกอีเมล/รหัสผ่านถูก → เรียก signInWithEmailAndPassword ด้วยค่าที่ trim แล้ว, ปุ่ม disable ระหว่างทำงาน, ไม่มี error แสดง", async () => {
    let capturedArgs = null;
    globalThis.__SIGNIN_STUB__ = (email, password) => { capturedArgs = [email, password]; return { user: { email } }; };
    el("ad-email").value = "  admin@cssign.co  ";
    el("ad-pass").value = "secret123";

    const btn = el("ad-login-form").querySelector(".cp-gate-btn");
    const submitPromise = new Promise((resolve) => {
      el("ad-login-form").addEventListener("submit", () => resolve(), { once: true });
    });
    el("ad-login-form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await submitPromise;

    // ตรวจ disabled synchronous ทันทีก่อน await ตัว handler async จะ resolve
    assert.equal(btn.disabled, true);
    assert.equal(btn.textContent, "กำลังเข้าสู่ระบบ...");

    await flush();
    await flush();

    assert.deepEqual(capturedArgs, ["admin@cssign.co", "secret123"]);
    assert.equal(el("ad-login-error").style.display, "none");
    assert.equal(btn.disabled, false);
    assert.equal(btn.textContent, "เข้าสู่ระบบ");

    await forceLogout();
  });

  test("ล็อกอินผิด (signInWithEmailAndPassword reject) → แสดงข้อความ error, ปุ่มกลับมาใช้งานได้", async () => {
    globalThis.__SIGNIN_STUB__ = () => ({ throw: new Error("wrong-password") });
    el("ad-email").value = "a@b.com";
    el("ad-pass").value = "wrong";

    const btn = el("ad-login-form").querySelector(".cp-gate-btn");
    el("ad-login-form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await flush();
    await flush();

    assert.equal(el("ad-login-error").style.display, "block");
    assert.equal(el("ad-login-error").textContent, "อีเมลหรือรหัสผ่านไม่ถูกต้อง");
    assert.equal(btn.disabled, false);
    assert.equal(btn.textContent, "เข้าสู่ระบบ");
  });

  test("submit ป้องกัน default ของฟอร์ม (ไม่ reload หน้า) — preventDefault ถูกเรียกจริง", async () => {
    globalThis.__SIGNIN_STUB__ = () => ({ user: { email: "x@y.com" } });
    el("ad-email").value = "x@y.com";
    el("ad-pass").value = "p";
    const evt = new Event("submit", { bubbles: true, cancelable: true });
    el("ad-login-form").dispatchEvent(evt);
    assert.equal(evt.defaultPrevented, true);
    await flush();
    await forceLogout();
  });
});

describe("Auth — onAuthChange callback (จำลอง login/logout ผ่าน __AUTH_STATE_CALLBACK__)", () => {
  test("user login → ซ่อน gate, แสดง app, เติมอีเมล/อักษรย่อ avatar, เรียก reloadAll + startLeadsListener + initOrdersTab", async () => {
    await authCallback()({ email: "owner@cssign.co" });

    assert.equal(el("ad-gate").style.display, "none");
    assert.equal(el("ad-app").style.display, "block");
    assert.equal(el("ad-user-email").textContent, "owner@cssign.co");
    assert.equal(el("ad-user-avatar").textContent, "O");
    assert.equal(callsOf("startLeadsListener").length, 1);
    assert.equal(callsOf("initOrdersTab").length, 1);
    // reloadAll() ถูกเรียกจริง (ไม่ใช่ stub) — ตรวจทางอ้อมผ่านฟังก์ชัน render ของแท็บย่อยที่มันเรียกต่อ
    assert.equal(callsOf("renderProducts").length, 1);
    assert.equal(callsOf("renderOverview").length >= 1, true);

    await forceLogout();
  });

  test("user ไม่มี email (fallback avatar) → avatar เป็น '?'", async () => {
    await authCallback()({ email: "" });
    assert.equal(el("ad-user-avatar").textContent, "?");
    await forceLogout();
  });

  test("user logout (null) → แสดง gate, ซ่อน app, เรียก stopOrdersTab", async () => {
    await authCallback()({ email: "a@b.com" });
    await authCallback()(null);

    assert.equal(el("ad-gate").style.display, "flex");
    assert.equal(el("ad-app").style.display, "none");
    assert.equal(callsOf("stopOrdersTab").length, 1);
  });

  test("login ผูก onOrdersChanged callback → ยิง callback แล้วเรียก renderNotifBell ทุกครั้ง, renderOverview เฉพาะตอนอยู่แท็บภาพรวม", async () => {
    await authCallback()({ email: "a@b.com" });
    const before = callsOf("renderNotifBell").length;
    const beforeOverview = callsOf("renderOverview").length;

    mod.switchTab("orders"); // ออกจากแท็บภาพรวม
    globalThis.__AD_PAGE_DEPS_CALLBACKS__.onOrdersChanged();
    assert.equal(callsOf("renderNotifBell").length, before + 1);
    assert.equal(callsOf("renderOverview").length, beforeOverview); // ไม่เพิ่ม เพราะไม่ได้อยู่แท็บภาพรวม

    mod.switchTab("overview");
    const overviewAfterSwitch = callsOf("renderOverview").length;
    globalThis.__AD_PAGE_DEPS_CALLBACKS__.onOrdersChanged();
    assert.equal(callsOf("renderOverview").length, overviewAfterSwitch + 1); // เพิ่ม เพราะอยู่แท็บภาพรวมพอดี

    await forceLogout();
  });

  test("login ผูก onRequestOrdersTab/onRequestOverviewTab callback → สลับแท็บถูกทิศทาง", async () => {
    await authCallback()({ email: "a@b.com" });
    mod.switchTab("overview");

    globalThis.__AD_PAGE_DEPS_CALLBACKS__.onRequestOrdersTab();
    assert.equal(el("ad-tabbtn-orders").classList.contains("active"), true);

    globalThis.__AD_PAGE_DEPS_CALLBACKS__.onRequestOverviewTab();
    assert.equal(el("ad-tabbtn-overview").classList.contains("active"), true);

    await forceLogout();
  });

  test("deep-link #hash ตรงกับปุ่มแท็บที่มีจริง → เปิดแท็บนั้นให้อัตโนมัติหลังล็อกอิน", async () => {
    location.hash = "#products";
    await authCallback()({ email: "a@b.com" });
    assert.equal(el("ad-tabbtn-products").classList.contains("active"), true);
    assert.equal(el("ad-tab-products").style.display, "");
    await forceLogout();
  });

  test("deep-link #hash ไม่ตรงกับปุ่มแท็บไหนเลย → ไม่เปลี่ยนแท็บ (คงแท็บเดิมที่เปิดอยู่ก่อนล็อกอิน)", async () => {
    mod.switchTab("overview"); // สถานะแท็บเป็น module-level ค้างข้ามล็อกอิน/ล็อกเอาต์ — บังคับค่าเริ่มต้นก่อนเทส
    location.hash = "#ไม่มีจริง";
    await authCallback()({ email: "a@b.com" });
    assert.equal(el("ad-tabbtn-overview").classList.contains("active"), true);
    await forceLogout();
  });

  // P1.6a: role "production" (staff/{uid}.role) → หลัง login เห็นแค่แท็บ "คำสั่งผลิต"
  // (data-tab="orders") — getMyStaffRole(user.uid) เรียกผ่าน getDoc() จริง (ไม่ใช่ stub) จึง
  // ควบคุมผลลัพธ์ผ่าน globalThis.__GET_DOC_STUB__ (ตัวเดียวกับที่ getSettings() ของ
  // reloadAll() ใช้อยู่แล้ว — ไม่กระทบกันเพราะ stub รับ ref แยกตาม .path)
  describe("role \"production\" (พนักงานหน้างานผลิต) — จำกัดมุมมองแท็บ (P1.6a)", () => {
    test("login ด้วยบัญชี role production → เห็นแค่ปุ่มแท็บ \"คำสั่งผลิต\" ปุ่มอื่นถูกซ่อน + ถูกสลับไปแท็บ orders อัตโนมัติ", async () => {
      globalThis.__GET_DOC_STUB__ = (ref) => ref && ref.path === "staff/prod-uid"
        ? { exists: true, data: { role: "production" } }
        : { exists: false };
      mod.switchTab("overview"); // เริ่มจากแท็บภาพรวมเสมอก่อนล็อกอิน (ค่าเริ่มต้น)

      await authCallback()({ uid: "prod-uid", email: "prod@x.com" });

      assert.equal(el("ad-tabbtn-orders").style.display, "");
      assert.equal(el("ad-tabbtn-products").style.display, "none");
      assert.equal(el("ad-tabbtn-settings").style.display, "none");
      assert.equal(el("ad-tabbtn-overview").style.display, "none");
      assert.equal(el("ad-tabbtn-orders").classList.contains("active"), true);
      assert.equal(el("ad-tab-orders").style.display, "");

      await forceLogout();
      // logout แล้วปุ่มแท็บต้องกลับมาแสดงครบเหมือนเดิมสำหรับบัญชีถัดไปที่ login (ทดสอบ
      // ทางอ้อมด้วยเทสถัดไปในไฟล์นี้ที่ login แบบไม่มี role production แล้ว assert ว่าเห็นทุกแท็บ
      // อยู่แล้ว — เทสนี้แค่ยืนยันไม่ throw ตอน logout)
    });

    test("login ด้วยบัญชีไม่มี doc staff/{uid} เลย (role = null ตามดีฟอลต์เดิม) → ยังเห็นทุกแท็บเหมือนเดิม ไม่ถูกจำกัด", async () => {
      globalThis.__GET_DOC_STUB__ = () => ({ exists: false });
      mod.switchTab("overview");

      await authCallback()({ uid: "no-role-doc-uid", email: "owner@x.com" });

      assert.equal(el("ad-tabbtn-products").style.display, "");
      assert.equal(el("ad-tabbtn-settings").style.display, "");
      assert.equal(el("ad-tabbtn-overview").classList.contains("active"), true);

      await forceLogout();
    });

    test("getMyStaffRole() reject (getDoc throw) → ไม่ throw ทั้งกระบวนการ login, ถือว่าเห็นทุกแท็บเหมือน default เดิม (log แค่ warning)", async () => {
      globalThis.__GET_DOC_STUB__ = () => { throw new Error("network down"); };
      mod.switchTab("overview");

      await authCallback()({ uid: "err-uid", email: "a@b.com" });

      assert.equal(el("ad-app").style.display, "block"); // login สำเร็จปกติ ไม่พังทั้งกระบวนการ
      assert.equal(el("ad-tabbtn-products").style.display, "");
      assert.equal(el("ad-tabbtn-overview").classList.contains("active"), true);

      await forceLogout();
    });
  });
});

describe("Auth — ปุ่มออกจากระบบ (ad-logout-btn)", () => {
  test("ไม่มีฟอร์มค้าง dirty → logoutAdmin (signOut) ถูกเรียกทันที ไม่ถาม confirm", async () => {
    await authCallback()({ email: "a@b.com" });
    el("ad-logout-btn").click();
    await flush();
    assert.equal(globalThis.__SIGNOUT_CALLS__.length, 1);
    const overlay = document.querySelector(".cp-confirm-overlay");
    if (overlay) assert.notEqual(overlay.style.display, "flex");
  });

  test("มีฟอร์ม dirty ค้างอยู่ + ยกเลิก confirm → ไม่ logout", async () => {
    await authCallback()({ email: "a@b.com" });
    const form = makeFormFor("lg1");
    const guard = attachUnsavedGuard({ form, doClose: () => {} });
    guard.capture();
    form.querySelector("#lg1-name").value = "แก้ไขแล้ว";

    el("ad-logout-btn").click();
    await flush();
    const overlay = document.querySelector(".cp-confirm-overlay");
    assert.equal(overlay.style.display, "flex");
    overlay.querySelector("#cp-confirm-cancel").click();
    await flush();

    assert.equal(globalThis.__SIGNOUT_CALLS__.length, 0);
    assert.equal(el("ad-app").style.display, "block"); // ยังล็อกอินอยู่
    form.remove();
    await forceLogout();
  });

  test("มีฟอร์ม dirty ค้างอยู่ + ยืนยัน confirm → logout จริง", async () => {
    await authCallback()({ email: "a@b.com" });
    const form = makeFormFor("lg2");
    const guard = attachUnsavedGuard({ form, doClose: () => {} });
    guard.capture();
    form.querySelector("#lg2-name").value = "แก้ไขแล้ว";

    el("ad-logout-btn").click();
    await flush();
    const overlay = document.querySelector(".cp-confirm-overlay");
    overlay.querySelector("#cp-confirm-ok").click();
    await flush();

    assert.equal(globalThis.__SIGNOUT_CALLS__.length, 1);
    form.remove();
  });
});

describe("reloadAll()", () => {
  beforeEach(async () => {
    await authCallback()({ email: "a@b.com" }); // login เรียก reloadAll() รอบแรกไปแล้ว
  });

  test("เรียกฟังก์ชัน render ของทุกแท็บ (ยกเว้น renderStaffList/renderAuditLog ซึ่งเรียกเฉพาะตอนเปิดแท็บตั้งค่า)", async () => {
    resetSpies();
    await mod.reloadAll();
    const expected = [
      "fillCategorySelects", "fillGroupSelect", "renderProducts", "renderGroups",
      "renderCategories", "renderPortfolios", "renderBlogs", "renderFaqs",
      "renderContactSettings",
      "renderPromoSettings", "renderVideoSettings", "renderTeamSettings", "renderOverview",
    ];
    expected.forEach(name => assert.equal(callsOf(name).length, 1, `${name} ควรถูกเรียก 1 ครั้ง`));
    assert.equal(callsOf("renderStaffList").length, 0);
    assert.equal(callsOf("renderAuditLog").length, 0);
  });

  test("โหลดข้อมูลล้มเหลว (getDocs reject เช่น categories) → แสดง errorStateHTML ใน #ad-p-grid แทนการ throw", async () => {
    globalThis.__GET_DOCS_STUB__ = (ref) => {
      if (ref && ref.path === "categories") throw new Error("โหลดพัง");
      return [];
    };
    resetSpiesKeepGetDocs();
    await mod.reloadAll();
    assert.match(el("ad-p-grid").innerHTML, /โหลดข้อมูลไม่สำเร็จ: โหลดพัง/);
    assert.match(el("ad-p-grid").innerHTML, /ลองใหม่/);
    // ไม่ควรเรียก render ต่อเพราะ Promise.all reject ก่อนถึงจุดนั้น
    assert.equal(callsOf("renderProducts").length, 0);

    function resetSpiesKeepGetDocs() {
      const keep = globalThis.__GET_DOCS_STUB__;
      resetSpies();
      globalThis.__GET_DOCS_STUB__ = keep;
    }
  });

  test("ปุ่ม 'ลองใหม่' ใน error state เรียก reloadAll() ซ้ำได้จริง (retry สำเร็จ → render กลับมาเรียกปกติ)", async () => {
    globalThis.__GET_DOCS_STUB__ = (ref) => { if (ref && ref.path === "categories") throw new Error("x"); return []; };
    await mod.reloadAll();
    globalThis.__GET_DOCS_STUB__ = undefined; // ครั้งถัดไปสำเร็จ
    resetSpies();

    const retryBtn = el("ad-p-grid").querySelector("[data-retry-key]");
    assert.ok(retryBtn);
    retryBtn.click();
    await flush();
    await flush();
    assert.equal(callsOf("renderProducts").length, 1);
  });
});

describe("switchTab()", () => {
  beforeEach(async () => {
    await authCallback()({ email: "a@b.com" });
    resetSpies();
  });

  test("สลับไปแท็บ 'products' → ปุ่มถูก mark active/aria-selected/tabindex ถูกต้อง, แสดงเฉพาะ section ของแท็บนั้น", () => {
    mod.switchTab("products");
    assert.equal(el("ad-tabbtn-products").classList.contains("active"), true);
    assert.equal(el("ad-tabbtn-products").getAttribute("aria-selected"), "true");
    assert.equal(el("ad-tabbtn-products").getAttribute("tabindex"), "0");
    assert.equal(el("ad-tabbtn-overview").classList.contains("active"), false);
    assert.equal(el("ad-tabbtn-overview").getAttribute("aria-selected"), "false");
    assert.equal(el("ad-tabbtn-overview").getAttribute("tabindex"), "-1");

    assert.equal(el("ad-tab-products").style.display, "");
    assert.equal(el("ad-tab-overview").style.display, "none");
    assert.equal(el("ad-tab-orders").style.display, "none");
    assert.equal(el("ad-tab-settings").style.display, "none");
  });

  test("{ focus: true } → โฟกัสไปที่ปุ่มแท็บที่ active", () => {
    mod.switchTab("orders", { focus: true });
    assert.equal(document.activeElement, el("ad-tabbtn-orders"));
  });

  test("สลับไปแท็บ 'leads' → เรียก startLeadsListener()", () => {
    mod.switchTab("leads");
    assert.equal(callsOf("startLeadsListener").length, 1);
  });

  test("สลับไปแท็บ 'overview' → เรียก renderOverview()", () => {
    mod.switchTab("products");
    resetSpies();
    mod.switchTab("overview");
    assert.equal(callsOf("renderOverview").length, 1);
  });

  test("สลับไปแท็บ 'settings' → เรียก renderStaffList()/renderAuditLog() และเปิดแท็บย่อยที่ active ค้างไว้", () => {
    mod.switchTab("settings");
    assert.equal(callsOf("renderStaffList").length, 1);
    assert.equal(callsOf("renderAuditLog").length, 1);
    assert.equal(el("ad-stabbtn-contact").classList.contains("active"), true); // ค่าเริ่มต้น
  });

  test("คลิกปุ่มแท็บจริงใน DOM → เรียก switchTab() ให้อัตโนมัติ", () => {
    el("ad-tabbtn-blog").click();
    assert.equal(el("ad-tabbtn-blog").classList.contains("active"), true);
    assert.equal(el("ad-tab-blog").style.display, "");
  });
});

describe("switchSettingsSubtab()", () => {
  beforeEach(async () => {
    await authCallback()({ email: "a@b.com" });
    mod.switchTab("settings");
  });

  test("สลับไปแท็บย่อย 'promo' → active/hidden ถูกต้อง, แท็บอื่นถูกซ่อน", () => {
    mod.switchSettingsSubtab("promo");
    assert.equal(el("ad-stabbtn-promo").classList.contains("active"), true);
    assert.equal(el("ad-stabbtn-promo").getAttribute("aria-selected"), "true");
    assert.equal(el("set-promo").hasAttribute("hidden"), false);
    assert.equal(el("ad-stabbtn-contact").classList.contains("active"), false);
    assert.equal(el("set-contact").hasAttribute("hidden"), true);
  });

  test("ชื่อแท็บย่อยไม่รู้จัก → ไม่มีอะไรเปลี่ยน (early return)", () => {
    mod.switchSettingsSubtab("promo");
    mod.switchSettingsSubtab("ไม่มีจริง");
    assert.equal(el("ad-stabbtn-promo").classList.contains("active"), true);
  });

  test("{ focus: true } → โฟกัสปุ่มแท็บย่อยที่ active", () => {
    mod.switchSettingsSubtab("team", { focus: true });
    assert.equal(document.activeElement, el("ad-stabbtn-team"));
  });

  test("คลิกปุ่มแท็บย่อยจริงใน DOM → สลับได้", () => {
    el("ad-stabbtn-staff").click();
    assert.equal(el("ad-stabbtn-staff").classList.contains("active"), true);
  });

  describe("คีย์บอร์ด ArrowLeft/ArrowRight/Home/End บน ad-settings-tabs", () => {
    function press(key) {
      el("ad-settings-tabs").dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
    }
    test("ArrowRight จากแท็บแรก → ไปแท็บถัดไป + โฟกัส", () => {
      mod.switchSettingsSubtab("contact");
      press("ArrowRight");
      assert.equal(el("ad-stabbtn-promo").classList.contains("active"), true);
      assert.equal(document.activeElement, el("ad-stabbtn-promo"));
    });
    test("ArrowLeft จากแท็บแรก → วนไปแท็บสุดท้าย", () => {
      mod.switchSettingsSubtab("contact");
      press("ArrowLeft");
      assert.equal(el("ad-stabbtn-audit").classList.contains("active"), true);
    });
    test("ArrowRight จากแท็บสุดท้าย → วนกลับแท็บแรก", () => {
      mod.switchSettingsSubtab("audit");
      press("ArrowRight");
      assert.equal(el("ad-stabbtn-contact").classList.contains("active"), true);
    });
    test("Home → ไปแท็บแรกเสมอ", () => {
      mod.switchSettingsSubtab("staff");
      press("Home");
      assert.equal(el("ad-stabbtn-contact").classList.contains("active"), true);
    });
    test("End → ไปแท็บสุดท้ายเสมอ", () => {
      mod.switchSettingsSubtab("contact");
      press("End");
      assert.equal(el("ad-stabbtn-audit").classList.contains("active"), true);
    });
    test("คีย์อื่นที่ไม่เกี่ยว (เช่น 'a') → ไม่มีอะไรเปลี่ยน ไม่ throw", () => {
      mod.switchSettingsSubtab("contact");
      press("a");
      assert.equal(el("ad-stabbtn-contact").classList.contains("active"), true);
    });
  });
});

describe("ปุ่ม '?' พับ/กางคำอธิบายในหน้าตั้งค่า (data-help-toggle)", () => {
  beforeEach(async () => {
    await authCallback()({ email: "a@b.com" });
    mod.switchTab("settings");
    // รีเซ็ตสถานะพับ/กางของการ์ด "ข้อมูลติดต่อ" ให้เป็นค่าเริ่มต้น (พับอยู่) ทุกเทส เพราะ DOM
    // ถูกใช้ซ้ำข้ามเทสในไฟล์นี้ (ไม่ re-render จริงเหมือนแท็บอื่นที่มี render function)
    const toggle0 = el("set-contact").querySelector("[data-help-toggle]");
    const help0 = toggle0.closest(".ad-settings-title").nextElementSibling;
    help0.setAttribute("hidden", "");
    toggle0.setAttribute("aria-expanded", "false");
  });

  test("คลิกครั้งแรก → กางคำอธิบาย (เอา hidden ออก), aria-expanded เป็น true", () => {
    const toggle = el("set-contact").querySelector("[data-help-toggle]");
    const help = toggle.closest(".ad-settings-title").nextElementSibling;
    assert.equal(help.hasAttribute("hidden"), true);

    toggle.click();
    assert.equal(help.hasAttribute("hidden"), false);
    assert.equal(toggle.getAttribute("aria-expanded"), "true");
  });

  test("คลิกซ้ำ → พับกลับ (hidden กลับมา), aria-expanded เป็น false", () => {
    const toggle = el("set-contact").querySelector("[data-help-toggle]");
    const help = toggle.closest(".ad-settings-title").nextElementSibling;
    toggle.click();
    toggle.click();
    assert.equal(help.hasAttribute("hidden"), true);
    assert.equal(toggle.getAttribute("aria-expanded"), "false");
  });

  test("คลิกที่อื่นในการ์ด (ไม่ใช่ปุ่ม toggle) → ไม่มีอะไรเปลี่ยน ไม่ throw", () => {
    const card = el("set-contact");
    const help = card.querySelector(".ad-settings-help");
    card.click();
    assert.equal(help.hasAttribute("hidden"), true);
  });
});
