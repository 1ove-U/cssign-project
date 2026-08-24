// test/admin-overview-detail-cards.test.mjs — รอบที่ 129
//
// ขอบเขต: js/admin-overview-detail-cards.js (4 การ์ด "รายละเอียดเพิ่มเติม"/กิจกรรมของแท็บ
// ภาพรวม ที่ renderOverview() ในไฟล์ admin-overview-dashboard.js เรียกท้ายฟังก์ชันทุกครั้งที่
// render): renderLeadFunnel() (ช่องทางขาย/สถานะลีดทั้งหมด), renderLeadSourceConversion()
// (อัตราปิดการขายแยกช่องทาง), renderSlaWarning() (คำสั่งผลิตใกล้/เกินกำหนดส่ง), และ
// renderOverviewActivity() (กิจกรรมล่าสุดจาก Audit Log)
//
// ไฟล์นี้ import { switchTab } จาก "./admin-page.js" ตรงๆ ที่ระดับบนสุด (circular import ที่
// ตั้งใจ แบบเดียวกับ admin-sidebar.js/admin-global-search-jump.js) — admin-page.js ตัวจริงเป็น
// ไฟล์ bootstrap ทั้งแอปโหลดไม่ได้ในสภาพแวดล้อมเทส — เพิ่ม "overview-detail-cards" เข้า
// ALLOWED_PARENT_RE ของ test/helpers/admin-page-stub-loader.mjs (สตับเดิม ไม่สร้างใหม่) ควบคุม
// การเรียก switchTab ผ่าน globalThis.__AD_PAGE_STUB_SWITCH_TAB__
//
// ไฟล์นี้ยัง import { getOrderReminders, jumpToOrderReminder } จาก "./orders-tab.js" ตรงๆ และ
// { allLeads, LEAD_SOURCE_LABEL } จาก "./admin-leads.js" ตรงๆ — ลอง import ตรงในสภาพแวดล้อมเทส
// ก่อนเขียนเทสตามที่ตกลงไว้ทุกรอบ — **import ผ่านสำเร็จทันที ไม่ต้องแก้ infra เทสไฟล์ไหนเลยสำหรับ
// 2 จุดนี้** (คนละสาเหตุจาก switchTab): orders-tab.js/admin-leads.js ทั้งคู่เคยมีเทสของตัวเองมา
// ก่อนแล้ว (orders-tab-lifecycle-reminders.test.mjs รอบ 92, admin-leads.test.mjs รอบ 123) จึง
// import ตรงได้เลยไม่ติด circular/ต้อง stub เพิ่ม
//
// สถาปัตยกรรมเทส: jsdom + admin.html body จริง (ตัด <script> ออก) เหมือนทุกไฟล์ก่อนหน้า — import
// ทั้ง 3 โมดูล (orders-tab.js/admin-leads.js/admin-overview-detail-cards.js) ครั้งเดียวใน
// before() — ตั้งค่า allOrders ผ่าน initOrdersTab()+triggerOrdersSnapshot() (แพทเทิร์นเดียวกับ
// รอบ 92) และตั้งค่า allLeads ผ่าน startLeadsListener()+triggerLeadsSnapshot() (แพทเทิร์นเดียวกับ
// รอบ 123) — listAuditLog() (renderOverviewActivity) ควบคุมผ่าน globalThis.__GET_DOCS_STUB__
// (ref.path === "auditLog", แพทเทิร์นเดียวกับ test/admin-settings-audit.test.mjs รอบ 120)
//
// ไม่พบบั๊กในโค้ดจริง (อ่านครบทั้งไฟล์ js/admin-overview-detail-cards.js ก่อนเขียนเทส) — เทสทั้งหมด
// ผ่านตั้งแต่รันครั้งแรก ไม่มีการแก้โค้ดผลิตภัณฑ์เลยแม้แต่บรรทัดเดียว (แก้แค่ 1 บรรทัดใน
// test/helpers/admin-page-stub-loader.mjs — ขยาย ALLOWED_PARENT_RE — ซึ่งเป็นโครงสร้างพื้นฐานของ
// เทส ไม่ใช่โค้ดผลิตภัณฑ์)

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
let mod;       // admin-overview-detail-cards.js exports
let ordersMod; // orders-tab.js exports (ตั้งค่า allOrders)
let leadsMod;  // admin-leads.js exports (ตั้งค่า allLeads)

function triggerOrdersSnapshot(orders) {
  const cb = globalThis.__SNAPSHOT_LISTENERS__ && globalThis.__SNAPSHOT_LISTENERS__["orders"];
  if (typeof cb !== "function") throw new Error("orders snapshot listener ยังไม่ได้ลงทะเบียน");
  cb({ docs: orders.map(o => ({ id: o.id, data: () => { const { id, ...rest } = o; return rest; } })) });
}

function triggerLeadsSnapshot(leads) {
  const cb = globalThis.__SNAPSHOT_LISTENERS__ && globalThis.__SNAPSHOT_LISTENERS__["leads"];
  if (typeof cb !== "function") throw new Error("leads snapshot listener ยังไม่ได้ลงทะเบียน");
  cb({ docs: leads.map(l => ({ id: l.id, data: () => { const { id, ...rest } = l; return rest; } })) });
}

function dateOffset(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function makeLead(over = {}) {
  return { id: "l1", status: "new", source: "contact_page_form", createdAt: Date.now(), ...over };
}

before(async () => {
  const dom = new JSDOM(`<!doctype html><html><body>${ADMIN_BODY_NO_SCRIPTS}</body></html>`, {
    url: "https://example.test/"
  });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
  globalThis.MouseEvent = dom.window.MouseEvent;
  globalThis.KeyboardEvent = dom.window.KeyboardEvent;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Event = dom.window.Event;
  dom.window.HTMLElement.prototype.scrollIntoView = function () {};
  globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);
  globalThis.localStorage = {
    _s: {},
    getItem(k) { return Object.prototype.hasOwnProperty.call(this._s, k) ? this._s[k] : null; },
    setItem(k, v) { this._s[k] = String(v); },
    removeItem(k) { delete this._s[k]; }
  };

  document = dom.window.document;
  ordersMod = await import("../js/orders-tab.js");
  leadsMod = await import("../js/admin-leads.js");
  mod = await import("../js/admin-overview-detail-cards.js");
});

beforeEach(() => {
  globalThis.__ADD_DOC_CALLS__ = [];
  globalThis.__GET_DOCS_STUB__ = undefined;
  globalThis.__AD_PAGE_STUB_SWITCH_TAB__ = undefined;
  ordersMod.stopOrdersTab();
  leadsMod.setLeadStatusFilter("");
  document.getElementById("ov-breakdown-funnel").innerHTML = `<div class="cp-empty">ไม่มีข้อมูล</div>`;
  document.getElementById("ov-breakdown-source-conversion").innerHTML = `<div class="cp-empty">ไม่มีข้อมูล</div>`;
  document.getElementById("ov-sla-warning").style.display = "none";
  document.getElementById("ov-sla-list").innerHTML = "";
  // หมายเหตุ: ไม่รีเซ็ต ov-sla-viewall.dataset.wired ที่นี่โดยตั้งใจ — เป็น guard จริงของโค้ด
  // ผลิตภัณฑ์ (กันผูก listener ซ้ำซ้อนทุกครั้งที่ renderSlaWarning() ถูกเรียก) ปุ่มเดิม element
  // เดิมอยู่ค้างข้ามเทสใน jsdom document เดียวกัน เหมือนพฤติกรรมจริงตอนแอปทำงาน (render() เรียก
  // renderSlaWarning() ซ้ำได้หลายครั้งตลอดอายุของหน้า ไม่ได้สร้าง element ใหม่ทุกครั้ง)
  document.getElementById("ov-recent-activity").innerHTML = `<div class="cp-empty">กำลังโหลด…</div>`;
});

// ── renderLeadFunnel() ───────────────────────────────────────────────────
describe("renderLeadFunnel() — ช่องทางขาย/สถานะลีดทั้งหมด (รอบที่ 129)", () => {
  test("allLeads ว่างเปล่า → ข้อความ 'ไม่มีข้อมูล'", () => {
    ordersMod.initOrdersTab();
    leadsMod.startLeadsListener();
    triggerLeadsSnapshot([]);
    mod.renderLeadFunnel();
    assert.match(document.getElementById("ov-breakdown-funnel").innerHTML, /ไม่มีข้อมูล/);
  });

  test("มีลีดครบทุกสถานะ → แสดงแถวครบ 5 สถานะพร้อมจำนวนถูกต้อง", () => {
    ordersMod.initOrdersTab();
    leadsMod.startLeadsListener();
    triggerLeadsSnapshot([]); // ข้าม snapshot แรกสุด (ถือว่ายังไม่มีลีดใหม่)
    triggerLeadsSnapshot([
      makeLead({ id: "l1", status: "new" }),
      makeLead({ id: "l2", status: "new" }),
      makeLead({ id: "l3", status: "read" }),
      makeLead({ id: "l4", status: "replied" }),
      makeLead({ id: "l5", status: "won" }),
      makeLead({ id: "l6", status: "lost" })
    ]);
    mod.renderLeadFunnel();
    const box = document.getElementById("ov-breakdown-funnel");
    const rows = box.querySelectorAll(".cp-breakdown-row");
    assert.equal(rows.length, 5);
    // ลำดับคงที่: ใหม่, อ่านแล้ว, ตอบกลับแล้ว, ปิดการขายสำเร็จ, ไม่สำเร็จ
    assert.match(rows[0].querySelector(".cp-breakdown-name").textContent, /ใหม่/);
    assert.equal(rows[0].querySelector(".cp-breakdown-count").textContent, "2");
    assert.equal(rows[1].querySelector(".cp-breakdown-count").textContent, "1");
    assert.equal(rows[4].querySelector(".cp-breakdown-count").textContent, "1");
    // max = 2 (สถานะ "ใหม่") → bar width 100% ของแถวนั้น, แถวที่มี count=1 → 50%
    assert.match(rows[0].querySelector(".cp-breakdown-bar").getAttribute("style"), /width:100%/);
    assert.match(rows[1].querySelector(".cp-breakdown-bar").getAttribute("style"), /width:50%/);
  });

  test("box ไม่มีอยู่จริงใน DOM → ไม่ throw (guard early return)", () => {
    const box = document.getElementById("ov-breakdown-funnel");
    box.remove();
    assert.doesNotThrow(() => mod.renderLeadFunnel());
    document.body.appendChild(box); // คืนกลับให้เทสอื่นใช้ต่อ
  });

  test("escapeHtml กัน XSS ในชื่อสถานะไม่เกี่ยวข้อง — label มาจากค่าคงที่ในโค้ดเองอยู่แล้วจึงไม่มี\n      ช่องโหว่จริง แต่ยืนยันว่า renderLeadFunnel() เรียกซ้ำสองครั้งข้อมูลต่างกันแล้วทับกันไม่ค้าง", () => {
    ordersMod.initOrdersTab();
    leadsMod.startLeadsListener();
    triggerLeadsSnapshot([]);
    triggerLeadsSnapshot([makeLead({ id: "l1", status: "new" })]);
    mod.renderLeadFunnel();
    triggerLeadsSnapshot([makeLead({ id: "l1", status: "new" }), makeLead({ id: "l2", status: "won" })]);
    mod.renderLeadFunnel();
    const box = document.getElementById("ov-breakdown-funnel");
    assert.equal(box.querySelectorAll(".cp-breakdown-row").length, 5);
  });
});

// ── renderLeadSourceConversion() ────────────────────────────────────────
describe("renderLeadSourceConversion() — อัตราปิดการขายแยกตามช่องทาง (รอบที่ 129)", () => {
  test("ไม่มีช่องทางเลย (source ทุกลีดว่าง/null) → ข้อความ 'ไม่มีข้อมูล'", () => {
    ordersMod.initOrdersTab();
    leadsMod.startLeadsListener();
    triggerLeadsSnapshot([]);
    triggerLeadsSnapshot([makeLead({ id: "l1", source: "" }), makeLead({ id: "l2", source: null })]);
    mod.renderLeadSourceConversion();
    assert.match(document.getElementById("ov-breakdown-source-conversion").innerHTML, /ไม่มีข้อมูล/);
  });

  test("คำนวณอัตราปิดการขาย (won ÷ (won+lost)) ถูกต้องต่อช่องทาง + เรียงจากอัตราสูงสุดก่อน", () => {
    ordersMod.initOrdersTab();
    leadsMod.startLeadsListener();
    triggerLeadsSnapshot([]);
    triggerLeadsSnapshot([
      // contact_page_form: 1 won, 1 lost → 50%
      makeLead({ id: "l1", source: "contact_page_form", status: "won" }),
      makeLead({ id: "l2", source: "contact_page_form", status: "lost" }),
      // chat_widget: 2 won, 0 lost → 100%
      makeLead({ id: "l3", source: "chat_widget", status: "won" }),
      makeLead({ id: "l4", source: "chat_widget", status: "won" }),
      // exit_intent_cta: ยังไม่ปิดจบเลย (status new) → rate = null → "—"
      makeLead({ id: "l5", source: "exit_intent_cta", status: "new" })
    ]);
    mod.renderLeadSourceConversion();
    const rows = document.getElementById("ov-breakdown-source-conversion").querySelectorAll(".cp-breakdown-row");
    assert.equal(rows.length, 3);
    // เรียงตาม rate มากไปน้อย: chat_widget(100%) > contact_page_form(50%) > exit_intent_cta(—, rate=null ท้ายสุด)
    assert.equal(rows[0].querySelector(".cp-breakdown-count").textContent, "100%");
    assert.equal(rows[1].querySelector(".cp-breakdown-count").textContent, "50%");
    assert.equal(rows[2].querySelector(".cp-breakdown-count").textContent, "—");
  });

  test("label ใช้ LEAD_SOURCE_LABEL ที่รู้จัก / fallback เป็นค่าดิบถ้าไม่รู้จัก", () => {
    ordersMod.initOrdersTab();
    leadsMod.startLeadsListener();
    triggerLeadsSnapshot([]);
    triggerLeadsSnapshot([
      makeLead({ id: "l1", source: "contact_page_form", status: "won" }),
      makeLead({ id: "l2", source: "some_unknown_source_xyz", status: "won" })
    ]);
    mod.renderLeadSourceConversion();
    const names = [...document.getElementById("ov-breakdown-source-conversion").querySelectorAll(".cp-breakdown-name")]
      .map(el => el.textContent);
    assert.ok(names.includes(leadsMod.LEAD_SOURCE_LABEL["contact_page_form"]));
    assert.ok(names.includes("some_unknown_source_xyz"));
  });

  test("box ไม่มีอยู่จริงใน DOM → ไม่ throw (guard early return)", () => {
    const box = document.getElementById("ov-breakdown-source-conversion");
    box.remove();
    assert.doesNotThrow(() => mod.renderLeadSourceConversion());
    document.body.appendChild(box);
  });
});

// ── renderSlaWarning() ──────────────────────────────────────────────────
describe("renderSlaWarning() — คำสั่งผลิตใกล้/เกินกำหนดส่ง (รอบที่ 129)", () => {
  test("ไม่มีคำสั่งผลิตเกิน/ใกล้กำหนดเลย → ซ่อนกล่องทั้งหมด (display:none)", () => {
    ordersMod.initOrdersTab();
    triggerOrdersSnapshot([{ id: "o1", code: "PO-1", status: "received", dueDate: dateOffset(30) }]);
    mod.renderSlaWarning();
    assert.equal(document.getElementById("ov-sla-warning").style.display, "none");
  });

  test("มีทั้งเกินกำหนด/ใกล้ครบกำหนด → แสดงกล่อง, เกินกำหนดขึ้นก่อนเสมอ, ข้อความ/หัวข้อถูกต้อง", () => {
    ordersMod.initOrdersTab();
    triggerOrdersSnapshot([
      { id: "o-due", code: "PO-DUE", customer: "ลูกค้า A", status: "received", dueDate: dateOffset(1) },
      { id: "o-over", code: "PO-OVER", customer: "ลูกค้า B", status: "received", dueDate: dateOffset(-3) }
    ]);
    mod.renderSlaWarning();
    const section = document.getElementById("ov-sla-warning");
    assert.equal(section.style.display, "");
    const items = document.getElementById("ov-sla-list").querySelectorAll("[data-order-id]");
    assert.equal(items.length, 2);
    // เกินกำหนดขึ้นก่อนเสมอ
    assert.equal(items[0].dataset.orderId, "o-over");
    assert.equal(items[0].dataset.urgency, "overdue");
    assert.match(items[0].querySelector(".cp-notif-item-title").textContent, /PO-OVER/);
    assert.match(items[0].querySelector(".cp-notif-item-title").textContent, /ลูกค้า B/);
    assert.match(items[0].querySelector(".cp-notif-item-sub").textContent, /เกินกำหนดส่งแล้ว/);
    assert.equal(items[1].dataset.orderId, "o-due");
    assert.equal(items[1].dataset.urgency, "due-soon");
    assert.match(items[1].querySelector(".cp-notif-item-sub").textContent, /ใกล้ครบกำหนดส่ง/);
  });

  test("ไม่มี code/item → fallback 'คำสั่งผลิต', ไม่มี customer → fallback 'ไม่ระบุลูกค้า'", () => {
    ordersMod.initOrdersTab();
    triggerOrdersSnapshot([{ id: "o1", status: "received", dueDate: dateOffset(-1) }]);
    mod.renderSlaWarning();
    const title = document.getElementById("ov-sla-list").querySelector(".cp-notif-item-title").textContent;
    assert.match(title, /คำสั่งผลิต/);
    assert.match(title, /ไม่ระบุลูกค้า/);
  });

  test("escapeHtml กัน XSS ในชื่อลูกค้า/รหัสคำสั่งผลิต", () => {
    ordersMod.initOrdersTab();
    triggerOrdersSnapshot([{
      id: "o1", code: '<img src=x onerror=alert(1)>', customer: "<b>ลูกค้า</b>",
      status: "received", dueDate: dateOffset(-1)
    }]);
    mod.renderSlaWarning();
    const html = document.getElementById("ov-sla-list").innerHTML;
    assert.doesNotMatch(html, /<img src=x onerror=alert\(1\)>/);
    assert.doesNotMatch(html, /<b>ลูกค้า<\/b>/);
  });

  test("คลิกแถวเตือน → switchTab('orders') + jumpToOrderReminder() ตาม urgency ของแถวนั้น", () => {
    ordersMod.initOrdersTab();
    triggerOrdersSnapshot([
      { id: "o-over", code: "PO-OVER", status: "received", dueDate: dateOffset(-3) }
    ]);
    mod.renderSlaWarning();
    let switchTabCalls = [];
    globalThis.__AD_PAGE_STUB_SWITCH_TAB__ = (tab) => switchTabCalls.push(tab);
    const row = document.getElementById("ov-sla-list").querySelector("[data-order-id]");
    row.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    assert.deepEqual(switchTabCalls, ["orders"]);
    // jumpToOrderReminder("overdue") ต้องเซ็ต jumpFilter ของ orders-tab.js เป็น "overdue" จริง —
    // ยืนยันทางอ้อมผ่าน public export ordersMod.jumpFilter (live binding อ่านได้ตรงๆ)
    assert.equal(ordersMod.jumpFilter, "overdue");
  });

  test("ปุ่ม 'ไปที่คำสั่งผลิต →' (ov-sla-viewall) คลิกแล้วเรียก switchTab('orders') + ไม่ผูกซ้ำ (dataset.wired)", () => {
    ordersMod.initOrdersTab();
    triggerOrdersSnapshot([{ id: "o1", code: "PO-1", status: "received", dueDate: dateOffset(-1) }]);
    mod.renderSlaWarning();
    mod.renderSlaWarning(); // เรียกซ้ำ — ต้องไม่ผูก listener ซ้ำซ้อน (dataset.wired guard)
    let switchTabCalls = [];
    globalThis.__AD_PAGE_STUB_SWITCH_TAB__ = (tab) => switchTabCalls.push(tab);
    document.getElementById("ov-sla-viewall").click();
    assert.deepEqual(switchTabCalls, ["orders"]);
  });
});

// ── renderOverviewActivity() ────────────────────────────────────────────
describe("renderOverviewActivity() — กิจกรรมล่าสุด (Audit Log) (รอบที่ 129)", () => {
  function setAuditStub(rows) {
    globalThis.__GET_DOCS_STUB__ = (ref) => {
      if (ref && ref.path === "auditLog") {
        return rows.map(r => ({ id: r.id, data: r }));
      }
      return [];
    };
  }

  test("box ไม่มีอยู่จริงใน DOM → ไม่ throw (guard early return)", async () => {
    const box = document.getElementById("ov-recent-activity");
    box.remove();
    await assert.doesNotReject(() => mod.renderOverviewActivity());
    document.body.appendChild(box);
  });

  test("โหลดสำเร็จแต่ไม่มีรายการ → ข้อความ 'ยังไม่มีกิจกรรม'", async () => {
    setAuditStub([]);
    await mod.renderOverviewActivity();
    assert.match(document.getElementById("ov-recent-activity").innerHTML, /ยังไม่มีกิจกรรม/);
  });

  test("โหลดสำเร็จมีรายการ → label การกระทำที่รู้จัก/ไม่รู้จัก, targetType+meta ต่อกัน, email/uid fallback", async () => {
    setAuditStub([
      { id: "a1", action: "update", targetType: "order", targetId: "o1", meta: "แก้ไขสถานะ", email: "a@x.com", uid: "u1", createdAt: 1700000000000 },
      { id: "a2", action: "unknown_action_xyz", targetType: "lead", targetId: "l1", meta: "", email: "", uid: "u2", createdAt: 1700000001000 }
    ]);
    await mod.renderOverviewActivity();
    const box = document.getElementById("ov-recent-activity");
    const rows = box.querySelectorAll(".ad-audit-row");
    assert.equal(rows.length, 2);
    assert.match(rows[0].querySelector(".ad-audit-action").textContent, /แก้ไข/); // AUDIT_ACTION_LABEL.update
    assert.match(rows[0].textContent, /order/);
    assert.match(rows[0].textContent, /แก้ไขสถานะ/);
    assert.match(rows[0].querySelector(".ad-audit-meta").textContent, /a@x\.com/);
    // action ไม่รู้จัก → fallback ใช้ค่าดิบ
    assert.match(rows[1].querySelector(".ad-audit-action").textContent, /unknown_action_xyz/);
    // meta ว่าง → ไม่มีขีดต่อท้าย targetType
    assert.doesNotMatch(rows[1].textContent, /lead —/);
    // email ว่าง → fallback เป็น uid
    assert.match(rows[1].querySelector(".ad-audit-meta").textContent, /u2/);
  });

  test("escapeHtml กัน XSS ในทุกฟิลด์ข้อความ (targetType/meta/email)", async () => {
    setAuditStub([{
      id: "a1", action: "delete", targetType: "<script>alert(1)</script>",
      meta: "<img src=x onerror=alert(2)>", email: "<b>x</b>", uid: "u1", createdAt: Date.now()
    }]);
    await mod.renderOverviewActivity();
    const html = document.getElementById("ov-recent-activity").innerHTML;
    assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
    assert.doesNotMatch(html, /<img src=x onerror=alert\(2\)>/);
    assert.doesNotMatch(html, /<b>x<\/b>/);
  });

  test("โหลดล้มเหลว (สิทธิ์ role staff ไม่ให้อ่าน auditLog) → ข้อความแจ้งสิทธิ์แทน error จริง", async () => {
    globalThis.__GET_DOCS_STUB__ = (ref) => {
      if (ref && ref.path === "auditLog") throw new Error("permission denied");
      return [];
    };
    await mod.renderOverviewActivity();
    assert.match(
      document.getElementById("ov-recent-activity").innerHTML,
      /ดูกิจกรรมนี้ได้เฉพาะบัญชีที่มีบทบาท admin เท่านั้น/
    );
  });

  test("เรียกซ้ำสองครั้งข้อมูลต่างกัน → เนื้อหาทับกันไม่ค้างของเดิม", async () => {
    setAuditStub([{ id: "a1", action: "create", targetType: "blog", targetId: "b1", meta: "", email: "a@x.com", uid: "u1", createdAt: Date.now() }]);
    await mod.renderOverviewActivity();
    assert.equal(document.getElementById("ov-recent-activity").querySelectorAll(".ad-audit-row").length, 1);
    setAuditStub([]);
    await mod.renderOverviewActivity();
    assert.equal(document.getElementById("ov-recent-activity").querySelectorAll(".ad-audit-row").length, 0);
    assert.match(document.getElementById("ov-recent-activity").innerHTML, /ยังไม่มีกิจกรรม/);
  });
});
