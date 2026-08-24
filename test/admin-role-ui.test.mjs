// test/admin-role-ui.test.mjs — รอบ P1.6a
//
// ขอบเขต: js/admin-role-ui.js (ไฟล์ใหม่ทั้งไฟล์) — applyRoleUI(role, opts) ฟังก์ชัน pure ล้วนๆ
// รับ DOM refs/callback ผ่าน opts ตรงๆ (ไม่ query document เองยกเว้น fallback tabsBox
// เริ่มต้น) จึงเทสได้โดยไม่ต้องพึ่ง firebase-stub-loader/admin-page-deps-stub-loader เลย —
// สร้าง DOM ปุ่มแท็บง่ายๆ ด้วย jsdom ตรงๆ ไม่ต้องโหลด admin.html เต็มไฟล์
//
// อ่านโค้ดจริงทั้งไฟล์ js/admin-role-ui.js ก่อนเขียนเทสนี้ — ไม่พบบั๊ก

import { test, describe, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

let applyRoleUI, TABS_ALLOWED_FOR_PRODUCTION;
let document;

const ALL_TABS = ["overview", "orders", "products", "categories", "portfolio", "blog", "faq", "leads", "settings"];

before(async () => {
  const mod = await import("../js/admin-role-ui.js");
  applyRoleUI = mod.applyRoleUI;
  TABS_ALLOWED_FOR_PRODUCTION = mod.TABS_ALLOWED_FOR_PRODUCTION;
});

function buildTabsBox() {
  const dom = new JSDOM(`<!doctype html><html><body>
    <nav id="ad-tabs">
      ${ALL_TABS.map(t => `<button type="button" class="cp-tab" data-tab="${t}"></button>`).join("\n")}
    </nav>
  </body></html>`);
  document = dom.window.document;
  return document.getElementById("ad-tabs");
}

function visibleTabs(tabsBox) {
  return Array.from(tabsBox.querySelectorAll(".cp-tab[data-tab]"))
    .filter(b => b.style.display !== "none")
    .map(b => b.dataset.tab);
}

describe("TABS_ALLOWED_FOR_PRODUCTION", () => {
  test("มีแค่ \"orders\" ตามที่ P1.6a ระบุไว้ (\"เห็นแค่แท็บออเดอร์\")", () => {
    assert.deepEqual(TABS_ALLOWED_FOR_PRODUCTION, ["orders"]);
  });
});

describe("applyRoleUI() — role !== \"production\" (admin/staff/null/undefined/ค่าอื่น) → ไม่จำกัดอะไรเลย", () => {
  for (const role of ["admin", "staff", null, undefined, "", "unknown-role"]) {
    test(`role = ${JSON.stringify(role)} → ทุกแท็บยังแสดงเหมือนเดิม ไม่เรียก switchTab`, () => {
      const tabsBox = buildTabsBox();
      let switchTabCalls = [];
      applyRoleUI(role, {
        tabsBox,
        switchTab: (tab) => switchTabCalls.push(tab),
        getActiveTab: () => "overview",
      });
      assert.deepEqual(visibleTabs(tabsBox), ALL_TABS);
      assert.equal(switchTabCalls.length, 0);
    });
  }
});

describe("applyRoleUI() — role === \"production\" → เห็นแค่แท็บที่อยู่ใน TABS_ALLOWED_FOR_PRODUCTION", () => {
  test("ซ่อนทุกปุ่มแท็บ ยกเว้น \"orders\"", () => {
    const tabsBox = buildTabsBox();
    applyRoleUI("production", { tabsBox, switchTab: () => {}, getActiveTab: () => "orders" });
    assert.deepEqual(visibleTabs(tabsBox), ["orders"]);
  });

  test("แท็บที่กำลังเปิดอยู่ไม่ได้รับอนุญาต (เช่น \"overview\" ค่าเริ่มต้น) → เรียก switchTab(\"orders\")", () => {
    const tabsBox = buildTabsBox();
    let switchTabCalls = [];
    applyRoleUI("production", {
      tabsBox,
      switchTab: (tab) => switchTabCalls.push(tab),
      getActiveTab: () => "overview",
    });
    assert.deepEqual(switchTabCalls, ["orders"]);
  });

  test("แท็บที่กำลังเปิดอยู่ได้รับอนุญาตอยู่แล้ว (\"orders\") → ไม่เรียก switchTab ซ้ำ", () => {
    const tabsBox = buildTabsBox();
    let switchTabCalls = [];
    applyRoleUI("production", {
      tabsBox,
      switchTab: (tab) => switchTabCalls.push(tab),
      getActiveTab: () => "orders",
    });
    assert.equal(switchTabCalls.length, 0);
  });

  test("ไม่ได้ส่ง switchTab มาเลย (opts เปล่า) → ไม่ throw, ยังซ่อนแท็บที่ไม่อนุญาตได้ปกติ", () => {
    const tabsBox = buildTabsBox();
    assert.doesNotThrow(() => applyRoleUI("production", { tabsBox }));
    assert.deepEqual(visibleTabs(tabsBox), ["orders"]);
  });

  test("ไม่ได้ส่ง getActiveTab มา (switchTab มีอยู่) → ถือว่าแท็บปัจจุบันเป็น null (ไม่อยู่ใน allowed) → เรียก switchTab(\"orders\")", () => {
    const tabsBox = buildTabsBox();
    let switchTabCalls = [];
    applyRoleUI("production", { tabsBox, switchTab: (tab) => switchTabCalls.push(tab) });
    assert.deepEqual(switchTabCalls, ["orders"]);
  });
});

describe("applyRoleUI() — edge cases", () => {
  test("ไม่มี tabsBox เลย (opts เปล่าทั้งหมด, ไม่มี #ad-tags ใน DOM จริง) → ไม่ throw, ไม่ทำอะไร", () => {
    // ไม่มี globalThis.document ตั้งไว้ในเทสไฟล์นี้ (ไม่ได้ set global เหมือนไฟล์อื่นที่ผูก
    // JSDOM เข้า globalThis) — fallback `document.getElementById("ad-tabs")` ใน
    // admin-role-ui.js จะ throw ReferenceError ถ้าไม่ได้ส่ง tabsBox มาตรงๆ ผ่าน opts เอง
    // เทสนี้จึงส่ง tabsBox: null ตรงๆ แทน เพื่อยืนยันเส้นทาง "ไม่มี container" คืนออกจาก
    // ฟังก์ชันเงียบๆ โดยไม่ throw (ไม่ได้ทดสอบ fallback หา document.getElementById เอง
    // เพราะไฟล์นี้ไม่ผูก global document — ใช้งานจริงเสมอผ่าน opts.tabsBox ที่ admin-page.js ส่งมา)
    assert.doesNotThrow(() => applyRoleUI("production", { tabsBox: null, switchTab: () => {} }));
  });

  test("tabsBox ไม่มีปุ่มแท็บเลย (nav ว่างเปล่า) → ไม่ throw", () => {
    const dom = new JSDOM(`<!doctype html><html><body><nav id="ad-tabs"></nav></body></html>`);
    const emptyBox = dom.window.document.getElementById("ad-tabs");
    assert.doesNotThrow(() => applyRoleUI("production", { tabsBox: emptyBox, switchTab: () => {}, getActiveTab: () => "orders" }));
  });
});
