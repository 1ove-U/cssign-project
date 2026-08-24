// test/admin-overview-dashboard.test.mjs — รอบที่ 132
//
// ขอบเขต: js/admin-overview-dashboard.js (262 บรรทัด) แท็บ "ภาพรวม" ของหน้าแอดมิน — การ์ดสถิติ 6
// ใบ + อัตราปิดการขาย + เทรนด์/sparkline, ปุ่ม quick action (เพิ่มสินค้า/เพิ่มคำสั่งผลิต), กล่อง
// "ลีดที่รอดำเนินการ", กราฟเส้นรายได้ (renderRevenueLineChart — private), notification bell
// (renderNotifBell() + panel toggle ที่ผูก listener ตอน module evaluate), ovFormatBaht()
//
// ลองนำเข้าตรงในสภาพแวดล้อมเทสก่อนเขียนเทสตามที่ตกลงไว้ทุกรอบ — ไฟล์นี้ import ข้ามไฟล์เยอะที่สุด
// เท่าที่เคยเจอ (db-orders-stats/orders-tab/ui-helpers/stats-trends/admin-utils/admin-state/
// admin-leads/admin-products/admin-page/admin-overview-detail-cards/admin-overview-export แบบ
// side-effect) — ทดสอบแล้วพบสิ่งที่ **ไม่คาดคิด**: ด้วย globalThis.localStorage ที่ตั้งไว้ก่อน
// import (เหมือนทุกไฟล์เทสกลุ่ม admin-* ที่ผ่านมา) **js/admin-page.js ตัวจริงทั้งไฟล์ import ผ่าน
// สำเร็จ** (ต่างจากที่บันทึกไว้ในรอบ 106/121 ว่า "โหลดไม่ได้ในสภาพแวดล้อมเทส" — สาเหตุคือรอบก่อนๆ
// ไม่ได้ตั้ง localStorage stub ไว้ตอนทดลอง import ตรง) เหตุที่ยังโหลดผ่านได้ทั้งชุดเพราะ
// admin-page-stub-loader.mjs เดิมสตับ "./admin-page.js" ไว้แล้วสำหรับไฟล์ลูกอีก ~15 ไฟล์ที่
// admin-page.js import กลับเข้ามา (circular) พอดี ตัดวงจรให้เอง — **ตัดสินใจไม่พึ่งพฤติกรรมนี้**
// (เสี่ยงเกินไป: ต้องลาก Firestore listener ของทั้งแอปมาด้วย ไม่ deterministic/ไม่ isolate เหมือน
// แพทเทิร์นสตับที่ใช้มาตลอด 131 รอบ) — เพิ่ม "overview-dashboard" เข้า ALLOWED_PARENT_RE ของ
// admin-page-stub-loader.mjs แทน (1 บรรทัด) ให้ import { switchTab } ของไฟล์นี้ได้สตับปลอมที่
// spy ได้ผ่าน globalThis.__AD_PAGE_STUB_SWITCH_TAB__ เหมือนไฟล์กลุ่ม admin-* อื่นทั้งหมด — ไม่ต้อง
// แก้ infra อื่นเพิ่มเลย: allLeads จาก admin-leads.js/getAllOrders,getOrderReminders,
// jumpToOrderReminder จาก orders-tab.js/openProductModal จาก admin-products.js (re-export จาก
// admin-products-form.js — admin-products.js เองมี "products" อยู่ใน ALLOWED_PARENT_RE เดิม
// ครอบ reloadAll ไว้แล้ว)/4 ฟังก์ชันจาก admin-overview-detail-cards.js (มี
// "overview-detail-cards" อยู่ใน ALLOWED_PARENT_RE เดิมแล้วจากรอบ 129) ทั้งหมด import ผ่านตรงได้
// เลยเพราะเคยมีเทสของตัวเองมาก่อนแล้วทั้งคู่ — import "./admin-overview-export.js" แบบ side-effect
// ก็ไม่มีปัญหา circular กลับมาเองเพราะ admin-overview-dashboard-stub-loader.mjs เดิม (รอบ 121/131)
// ดัก parentURL ที่ตรงกับ admin-overview-export.js อยู่แล้ว (สตับ ovFormatBaht กลับไปให้ ไม่วนเข้า
// ไฟล์นี้ตัวเองซ้ำ)
//
// สถาปัตยกรรมเทส: jsdom + admin.html body จริง เหมือนทุกไฟล์ก่อนหน้า — import 3 โมดูล
// (orders-tab.js/admin-leads.js/admin-overview-dashboard.js) ครั้งเดียวใน before() — ตั้งค่า
// allOrders/allLeads ผ่าน trigger snapshot แพทเทิร์นเดียวกับรอบ 92/123/129 — allProducts/
// allCategories/ฯลฯ ตั้งผ่าน setAllX() ของ admin-state.js ตรงๆ (import เพิ่ม 1 โมดูล) —
// switchTab สปายผ่าน globalThis.__AD_PAGE_STUB_SWITCH_TAB__ — listAuditLog()
// (renderOverviewActivity ที่ renderOverview() เรียกท้ายฟังก์ชัน) ใช้ getDocs() default ของ
// firebase-stub-loader.mjs (คืน docs:[] เมื่อไม่ตั้ง __GET_DOCS_STUB__ — ไม่ throw, พอสำหรับรอบนี้
// ที่ไม่ได้ทดสอบ renderOverviewActivity() เองโดยตรง แค่ยืนยันว่าถูกเรียกจริงไม่ throw)
//
// **ขอบเขตที่ไม่เทส (บันทึกไว้เป็นข้อจำกัด ไม่ใช่บั๊ก)**: renderRevenueLineChart()/
// renderOverviewActivity()/renderLeadFunnel()/renderLeadSourceConversion()/renderSlaWarning()
// เป็นฟังก์ชันจริงจากไฟล์อื่นที่มีเทสละเอียดของตัวเองอยู่แล้ว (db-orders-stats/
// admin-overview-detail-cards) — รอบนี้ตรวจแค่ "renderOverview() เรียกมันจริง" (integration wiring)
// ไม่ re-test logic ภายในซ้ำ — ปุ่ม "เพิ่มคำสั่งผลิต" (ov-quick-add-order) คลิก cp-add-btn จริงหลัง
// switchTab("orders") แต่ event listener ของปุ่มนั้นเองอยู่ใน js/orders-tab-modal.js (ไม่ได้ import
// ในไฟล์เทสนี้) จึงทดสอบได้แค่ "คลิกได้ไม่ throw" ไม่ทดสอบว่าโมดัลเปิดจริง (คนละไฟล์ คนละขอบเขต)

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
let mod;        // admin-overview-dashboard.js exports
let ordersMod;  // orders-tab.js exports (ตั้งค่า allOrders)
let leadsMod;   // admin-leads.js exports (ตั้งค่า allLeads)
let stateMod;   // admin-state.js exports (ตั้งค่า allProducts/allCategories/ฯลฯ)

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

function makeOrder(over = {}) {
  return { id: "o1", code: "PO-1", status: "received", createdAt: Date.now(), ...over };
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
  stateMod = await import("../js/admin-state.js");
  mod = await import("../js/admin-overview-dashboard.js");
});

beforeEach(() => {
  globalThis.__ADD_DOC_CALLS__ = [];
  globalThis.__GET_DOCS_STUB__ = undefined;
  globalThis.__AD_PAGE_STUB_SWITCH_TAB__ = undefined;
  ordersMod.stopOrdersTab();
  leadsMod.setLeadStatusFilter("");
  stateMod.setAllProducts([]);
  stateMod.setAllCategories([]);
  stateMod.setAllPortfolios([]);
  stateMod.setAllBlogs([]);
  stateMod.setAllFaqs([]);
  document.getElementById("ov-recent-leads").innerHTML = `<div class="cp-empty">ไม่มีข้อมูล</div>`;
  document.getElementById("ov-breakdown-funnel").innerHTML = `<div class="cp-empty">ไม่มีข้อมูล</div>`;
  document.getElementById("ov-breakdown-source-conversion").innerHTML = `<div class="cp-empty">ไม่มีข้อมูล</div>`;
  document.getElementById("ov-sla-warning").style.display = "none";
  document.getElementById("ov-sla-list").innerHTML = "";
  document.getElementById("ov-recent-activity").innerHTML = `<div class="cp-empty">กำลังโหลด…</div>`;
  document.getElementById("ad-notif-panel").style.display = "none";
});

// ── ovFormatBaht() ──────────────────────────────────────────────────────
describe("ovFormatBaht() (รอบที่ 132)", () => {
  test("จำนวนบวก → ฿ นำหน้า + คั่นหลักพันแบบไทย", () => {
    assert.equal(mod.ovFormatBaht(1234567), "฿1,234,567");
  });

  test("ทศนิยม → ปัดเศษก่อนแสดงผล", () => {
    assert.equal(mod.ovFormatBaht(1500.7), "฿1,501");
    assert.equal(mod.ovFormatBaht(1500.4), "฿1,500");
  });

  test("0/null/undefined/NaN → ฿0 ทั้งหมด (fallback || 0)", () => {
    assert.equal(mod.ovFormatBaht(0), "฿0");
    assert.equal(mod.ovFormatBaht(null), "฿0");
    assert.equal(mod.ovFormatBaht(undefined), "฿0");
    assert.equal(mod.ovFormatBaht(NaN), "฿0");
  });

  test("ไม่ส่ง argument เลย → ฿0", () => {
    assert.equal(mod.ovFormatBaht(), "฿0");
  });
});

// ── renderOverview() — การ์ดสถิติเนื้อหาเว็บไซต์ ─────────────────────────
describe("renderOverview() — การ์ดสถิติ (รอบที่ 132)", () => {
  test("ทุกการ์ดแสดงจำนวนตรงกับ allX.length จริง", () => {
    stateMod.setAllProducts([{ id: "p1" }, { id: "p2" }, { id: "p3" }]);
    stateMod.setAllPortfolios([{ id: "pf1" }, { id: "pf2" }]);
    stateMod.setAllBlogs([{ id: "b1" }]);
    stateMod.setAllCategories([{ id: "c1" }, { id: "c2" }, { id: "c3" }, { id: "c4" }]);
    leadsMod.startLeadsListener();
    triggerLeadsSnapshot([makeLead({ id: "l1", status: "new" }), makeLead({ id: "l2", status: "read" })]);

    mod.renderOverview();

    assert.equal(document.getElementById("ov-stat-products").textContent, "3");
    assert.equal(document.getElementById("ov-stat-portfolio").textContent, "2");
    assert.equal(document.getElementById("ov-stat-blog").textContent, "1");
    assert.equal(document.getElementById("ov-stat-categories").textContent, "4");
    // นับเฉพาะสถานะ "new" เท่านั้น (l2 เป็น "read" ไม่ถูกนับ)
    assert.equal(document.getElementById("ov-stat-leads-new").textContent, "1");
  });

  test("ไม่มีลีดที่ปิดจบเลย (ไม่มี won/lost) → conversion แสดง '—' พร้อม title อธิบาย", () => {
    leadsMod.startLeadsListener();
    triggerLeadsSnapshot([makeLead({ id: "l1", status: "new" }), makeLead({ id: "l2", status: "replied" })]);
    mod.renderOverview();
    const el = document.getElementById("ov-stat-conversion");
    assert.equal(el.textContent, "—");
    assert.match(el.title, /ยังไม่มีลีดที่ปิดจบ/);
  });

  test("มีลีดปิดจบแล้ว → conversion = won/(won+lost) ปัดเศษเป็น % พร้อม title สรุปจำนวน", () => {
    leadsMod.startLeadsListener();
    triggerLeadsSnapshot([
      makeLead({ id: "l1", status: "won" }),
      makeLead({ id: "l2", status: "won" }),
      makeLead({ id: "l3", status: "lost" }),
      makeLead({ id: "l4", status: "new" }) // ไม่นับ (ยังไม่ปิดจบ)
    ]);
    mod.renderOverview();
    const el = document.getElementById("ov-stat-conversion");
    assert.equal(el.textContent, "67%"); // round(2/3*100) = 67
    assert.equal(el.title, "ปิดการขายสำเร็จ 2 จาก 3 ลีดที่ปิดจบแล้ว (won + lost)");
  });

  test("won=0, lost=0 แต่มี won จริงทั้งหมด (100%) → title/ข้อความสอดคล้องกัน", () => {
    leadsMod.startLeadsListener();
    triggerLeadsSnapshot([makeLead({ id: "l1", status: "won" }), makeLead({ id: "l2", status: "won" })]);
    mod.renderOverview();
    const el = document.getElementById("ov-stat-conversion");
    assert.equal(el.textContent, "100%");
    assert.equal(el.title, "ปิดการขายสำเร็จ 2 จาก 2 ลีดที่ปิดจบแล้ว (won + lost)");
  });
});

// ── renderOverview() — กล่อง "ลีดที่รอดำเนินการ" ────────────────────────
describe("renderOverview() — กล่องลีดที่รอดำเนินการ (รอบที่ 132)", () => {
  test("ไม่มีลีดที่รอดำเนินการเลย (ทุกตัวเป็น replied/won/lost) → ข้อความ 'ไม่มีลีดที่รอดำเนินการ'", () => {
    leadsMod.startLeadsListener();
    triggerLeadsSnapshot([
      makeLead({ id: "l1", status: "replied" }),
      makeLead({ id: "l2", status: "won" }),
      makeLead({ id: "l3", status: "lost" })
    ]);
    mod.renderOverview();
    assert.match(document.getElementById("ov-recent-leads").innerHTML, /ไม่มีลีดที่รอดำเนินการ/);
  });

  test("มีลีดรอดำเนินการเกิน 5 → ตัดเหลือ 5 แถวแรกเท่านั้น (slice(0,5))", () => {
    leadsMod.startLeadsListener();
    const leads = Array.from({ length: 7 }, (_, i) => makeLead({ id: `l${i}`, status: "new" }));
    triggerLeadsSnapshot(leads);
    mod.renderOverview();
    const rows = document.getElementById("ov-recent-leads").querySelectorAll("[data-lead-id]");
    assert.equal(rows.length, 5);
  });

  test("status='new' → ป้าย 'ใหม่', ทุกสถานะอื่นที่ยังไม่จบ → ป้าย 'อ่านแล้ว'; ชื่อ fallback company → 'ไม่ระบุชื่อ'", () => {
    leadsMod.startLeadsListener();
    triggerLeadsSnapshot([
      makeLead({ id: "l1", status: "new", name: "คุณเอ" }),
      makeLead({ id: "l2", status: "read", company: "บริษัท บี" }),
      makeLead({ id: "l3", status: "read" }) // ไม่มีทั้ง name/company
    ]);
    mod.renderOverview();
    const box = document.getElementById("ov-recent-leads");
    const rows = box.querySelectorAll(".cp-breakdown-row");
    assert.equal(rows.length, 3);
    assert.match(rows[0].innerHTML, /คุณเอ/);
    assert.match(rows[0].innerHTML, /ใหม่/);
    assert.match(rows[1].innerHTML, /บริษัท บี/);
    assert.match(rows[1].innerHTML, /อ่านแล้ว/);
    assert.match(rows[2].innerHTML, /ไม่ระบุชื่อ/);
  });

  test("escapeHtml กันชื่อลีดที่มีอักขระ HTML (ไม่มี <img> element จริงเกิดขึ้นใน DOM)", () => {
    leadsMod.startLeadsListener();
    triggerLeadsSnapshot([makeLead({ id: "l1", status: "new", name: `<img src=x onerror=alert(1)>` })]);
    mod.renderOverview();
    const box = document.getElementById("ov-recent-leads");
    // escapeHtml() แปลง < > เป็น entity ก่อนใส่ใน innerHTML — ยืนยันว่าไม่มี element <img> จริง
    // เกิดขึ้นใน DOM (jsdom serialize entity ใน title attribute กลับเป็นตัวอักษรปกติเวลาอ่าน
    // .innerHTML คืน เพราะอยู่ในเครื่องหมายคำพูดอยู่แล้วปลอดภัย ไม่ใช่บั๊ก — เช็คที่ DOM element
    // จริงแทนสตริงเทียบข้อความจึงแม่นกว่า)
    assert.equal(box.querySelector("img"), null);
    assert.match(box.textContent, /<img src=x onerror=alert\(1\)>/);
  });

  test("คลิกแถวลีด → switchTab('leads') ถูกเรียก", () => {
    leadsMod.startLeadsListener();
    triggerLeadsSnapshot([makeLead({ id: "l1", status: "new" })]);
    mod.renderOverview();
    const calls = [];
    globalThis.__AD_PAGE_STUB_SWITCH_TAB__ = (tab) => calls.push(tab);
    document.querySelector("#ov-recent-leads [data-lead-id]").click();
    assert.deepEqual(calls, ["leads"]);
  });
});

// ── renderOverview() — quick actions ────────────────────────────────────
describe("renderOverview() — ปุ่ม quick action และลิงก์ 'ดูทั้งหมด' (รอบที่ 132)", () => {
  test("ปุ่ม 'เพิ่มสินค้า' → เรียก openProductModal(null) จริง (allCategories มีข้อมูล → เปิดฟอร์ม)", () => {
    stateMod.setAllCategories([{ id: "c1", name: "หมวด 1" }]);
    mod.renderOverview();
    document.getElementById("ov-quick-add-product").click();
    assert.equal(document.getElementById("ad-p-modal-title").textContent, "เพิ่มสินค้า");
    assert.equal(document.getElementById("ad-p-overlay").style.display, "flex");
    // ปิดฟอร์มกลับเพื่อไม่ให้ค้างข้ามเทสอื่น
    document.getElementById("ad-p-overlay").style.display = "none";
  });

  test("ปุ่ม 'เพิ่มสินค้า' ไม่มีหมวดหมู่เลย → openProductModal(null) แจ้งเตือนแทนไม่เปิดฟอร์ม (ไม่ throw)", () => {
    stateMod.setAllCategories([]);
    mod.renderOverview();
    assert.doesNotThrow(() => document.getElementById("ov-quick-add-product").click());
    assert.notEqual(document.getElementById("ad-p-overlay").style.display, "flex");
  });

  test("ปุ่ม 'เพิ่มคำสั่งผลิต' → switchTab('orders') ถูกเรียกก่อน แล้วคลิก cp-add-btn (ไม่ throw)", () => {
    mod.renderOverview();
    const calls = [];
    globalThis.__AD_PAGE_STUB_SWITCH_TAB__ = (tab) => calls.push(tab);
    assert.doesNotThrow(() => document.getElementById("ov-quick-add-order").click());
    assert.deepEqual(calls, ["orders"]);
  });

  test("ลิงก์ 'ดูทั้งหมด' (ลีด) → switchTab('leads')", () => {
    mod.renderOverview();
    const calls = [];
    globalThis.__AD_PAGE_STUB_SWITCH_TAB__ = (tab) => calls.push(tab);
    document.getElementById("ov-leads-viewall").click();
    assert.deepEqual(calls, ["leads"]);
  });

  test("ลิงก์ 'ไปที่คำสั่งผลิต →' → switchTab('orders')", () => {
    mod.renderOverview();
    const calls = [];
    globalThis.__AD_PAGE_STUB_SWITCH_TAB__ = (tab) => calls.push(tab);
    document.getElementById("ov-orders-viewall").click();
    assert.deepEqual(calls, ["orders"]);
  });

  test("ลิงก์ 'ดูทั้งหมด →' กิจกรรมล่าสุด → switchTab('settings')", () => {
    mod.renderOverview();
    const calls = [];
    globalThis.__AD_PAGE_STUB_SWITCH_TAB__ = (tab) => calls.push(tab);
    document.getElementById("ov-activity-viewall").click();
    assert.deepEqual(calls, ["settings"]);
  });

  test("เรียก renderOverview() ซ้ำหลายครั้ง → ปุ่ม/ลิงก์ผูก listener แค่ครั้งเดียว (dataset.wired guard กันซ้อน)", () => {
    mod.renderOverview();
    mod.renderOverview();
    mod.renderOverview();
    const calls = [];
    globalThis.__AD_PAGE_STUB_SWITCH_TAB__ = (tab) => calls.push(tab);
    document.getElementById("ov-leads-viewall").click();
    assert.deepEqual(calls, ["leads"]); // ถ้าผูกซ้อนจะเป็น ["leads","leads","leads"]
  });
});

// ── renderOverview() — เรียกฟังก์ชันจากไฟล์ลูกจริง (integration wiring) ──
describe("renderOverview() — เรียก renderRevenueLineChart/detail-cards จริงท้ายฟังก์ชัน (รอบที่ 132)", () => {
  test("renderRevenueLineChart() วาด SVG ลง #ov-revenue-linechart จริง (ไม่ว่างเปล่า)", () => {
    ordersMod.initOrdersTab();
    triggerOrdersSnapshot([]);
    mod.renderOverview();
    const html = document.getElementById("ov-revenue-linechart").innerHTML;
    assert.match(html, /<svg/);
    // ข้อมูลจริง 6 เดือน + คาดการณ์ 3 เดือน (linearForecast อาศัยข้อมูล ≥2 จุดเสมอ เพราะ monthly มี 6 บัคเก็ตคงที่)
    assert.equal((html.match(/<circle/g) || []).length, 9);
    assert.match(html, /เส้นประคือค่าประมาณคร่าวๆ/);
  });

  test("getAllOrders() ไม่พร้อม (ยังไม่ initOrdersTab) → renderRevenueLineChart ไม่ throw ทั้ง renderOverview (มี try/catch คลุม)", () => {
    ordersMod.stopOrdersTab();
    assert.doesNotThrow(() => mod.renderOverview());
  });

  test("renderOverviewActivity()/renderLeadFunnel()/renderLeadSourceConversion()/renderSlaWarning() ถูกเรียกจริง (เปลี่ยนเนื้อหากล่องจาก placeholder เดิม)", async () => {
    leadsMod.startLeadsListener();
    triggerLeadsSnapshot([makeLead({ id: "l1", status: "new", source: "contact_page_form" })]);
    ordersMod.initOrdersTab();
    triggerOrdersSnapshot([]);

    mod.renderOverview();
    // renderLeadFunnel/renderLeadSourceConversion เป็น sync — เปลี่ยนทันที
    assert.doesNotMatch(document.getElementById("ov-breakdown-funnel").innerHTML, /^<div class="cp-empty">ไม่มีข้อมูล<\/div>$/);
    // renderOverviewActivity เป็น async (await listAuditLog()) — รอ microtask ให้เสร็จก่อนเช็ค
    await new Promise(r => setTimeout(r, 0));
    assert.doesNotMatch(document.getElementById("ov-recent-activity").innerHTML, /กำลังโหลด…/);
  });
});

// ── renderNotifBell() ────────────────────────────────────────────────────
describe("renderNotifBell() (รอบที่ 132)", () => {
  test("ไม่มีการแจ้งเตือนเลย → จุดแดง (dot) ซ่อน + ข้อความ 'ไม่มีการแจ้งเตือนตอนนี้'", () => {
    leadsMod.startLeadsListener();
    triggerLeadsSnapshot([]);
    ordersMod.initOrdersTab();
    triggerOrdersSnapshot([]);
    mod.renderNotifBell();
    assert.equal(document.getElementById("ad-notif-dot").style.display, "none");
    assert.match(document.getElementById("ad-notif-list").innerHTML, /ไม่มีการแจ้งเตือนตอนนี้/);
  });

  test("มีการแจ้งเตือน → จุดแดงแสดง + เรียงลำดับ overdue ก่อน ตามด้วย due-soon แล้วค่อยลีดใหม่", () => {
    leadsMod.startLeadsListener();
    triggerLeadsSnapshot([makeLead({ id: "l1", status: "new", name: "ลีดใหม่ล่าสุด" })]);
    ordersMod.initOrdersTab();
    triggerOrdersSnapshot([
      makeOrder({ id: "o1", code: "PO-OVERDUE", status: "production", dueDate: dateOffset(-3) }),
      makeOrder({ id: "o2", code: "PO-DUESOON", status: "design", dueDate: dateOffset(1) })
    ]);
    mod.renderNotifBell();
    assert.equal(document.getElementById("ad-notif-dot").style.display, "block");
    const items = document.getElementById("ad-notif-list").querySelectorAll(".cp-notif-item");
    assert.equal(items.length, 3);
    assert.equal(items[0].dataset.orderId, "o1");
    assert.equal(items[0].dataset.urgency, "overdue");
    assert.match(items[0].innerHTML, /PO-OVERDUE/);
    assert.match(items[0].innerHTML, /เกินกำหนดส่งแล้ว/);
    assert.equal(items[1].dataset.orderId, "o2");
    assert.equal(items[1].dataset.urgency, "due-soon");
    assert.match(items[1].innerHTML, /ใกล้ครบกำหนดส่ง/);
    assert.equal(items[2].dataset.leadId, "l1");
    assert.match(items[2].innerHTML, /ลีดใหม่ล่าสุด/);
  });

  test("รายการรวมเกิน 8 → ตัดเหลือ 8 รายการสุดท้ายสุด (slice(0,8) หลังต่อ overdue+dueSoon+newLeads)", () => {
    leadsMod.startLeadsListener();
    triggerLeadsSnapshot(Array.from({ length: 6 }, (_, i) => makeLead({ id: `l${i}`, status: "new" })));
    ordersMod.initOrdersTab();
    triggerOrdersSnapshot([
      makeOrder({ id: "o1", status: "production", dueDate: dateOffset(-3) }),
      makeOrder({ id: "o2", status: "production", dueDate: dateOffset(-2) }),
      makeOrder({ id: "o3", status: "production", dueDate: dateOffset(-1) })
    ]);
    mod.renderNotifBell();
    const items = document.getElementById("ad-notif-list").querySelectorAll(".cp-notif-item");
    assert.equal(items.length, 8); // 3 overdue + 5 (ตัดจาก 6 ลีดใหม่)
  });

  test("escapeHtml กันชื่อ/รหัสคำสั่งผลิตที่มีอักขระ HTML", () => {
    leadsMod.startLeadsListener();
    triggerLeadsSnapshot([]);
    ordersMod.initOrdersTab();
    triggerOrdersSnapshot([makeOrder({ id: "o1", code: `<b>PO</b>`, status: "production", dueDate: dateOffset(-1) })]);
    mod.renderNotifBell();
    const html = document.getElementById("ad-notif-list").innerHTML;
    assert.doesNotMatch(html, /<b>PO<\/b>/);
    assert.match(html, /&lt;b&gt;PO/);
  });

  test("คลิกรายการคำสั่งผลิต → ซ่อน panel + switchTab('orders') + jumpToOrderReminder() ถูกเรียกจริง (ล้างช่องค้นหาคำสั่งผลิต)", () => {
    leadsMod.startLeadsListener();
    triggerLeadsSnapshot([]);
    ordersMod.initOrdersTab();
    triggerOrdersSnapshot([makeOrder({ id: "o1", status: "production", dueDate: dateOffset(-1) })]);
    mod.renderNotifBell();

    document.getElementById("cp-search").value = "ค่าค้างเก่า";
    document.getElementById("ad-notif-panel").style.display = "block";
    const calls = [];
    globalThis.__AD_PAGE_STUB_SWITCH_TAB__ = (tab) => calls.push(tab);

    document.querySelector('#ad-notif-list [data-order-id="o1"]').click();

    assert.equal(document.getElementById("ad-notif-panel").style.display, "none");
    assert.deepEqual(calls, ["orders"]);
    // jumpToOrderReminder() ของจริงเคลียร์ช่องค้นหาคำสั่งผลิต — ยืนยันว่าไม่ใช่ no-op
    assert.equal(document.getElementById("cp-search").value, "");
  });

  test("คลิกรายการลีดใหม่ → ซ่อน panel + switchTab('leads')", () => {
    leadsMod.startLeadsListener();
    triggerLeadsSnapshot([makeLead({ id: "l1", status: "new" })]);
    ordersMod.initOrdersTab();
    triggerOrdersSnapshot([]);
    mod.renderNotifBell();

    document.getElementById("ad-notif-panel").style.display = "block";
    const calls = [];
    globalThis.__AD_PAGE_STUB_SWITCH_TAB__ = (tab) => calls.push(tab);

    document.querySelector('#ad-notif-list [data-lead-id="l1"]').click();

    assert.equal(document.getElementById("ad-notif-panel").style.display, "none");
    assert.deepEqual(calls, ["leads"]);
  });

  test("เรียกซ้ำสองครั้งข้อมูลต่างกัน → ไม่มีรายการเก่าค้าง (re-render ทับทั้งหมดทุกครั้ง)", () => {
    leadsMod.startLeadsListener();
    triggerLeadsSnapshot([makeLead({ id: "l1", status: "new" })]);
    ordersMod.initOrdersTab();
    triggerOrdersSnapshot([]);
    mod.renderNotifBell();
    assert.equal(document.getElementById("ad-notif-list").querySelectorAll(".cp-notif-item").length, 1);

    triggerLeadsSnapshot([]); // ลีดใหม่หายไปหมด
    mod.renderNotifBell();
    assert.match(document.getElementById("ad-notif-list").innerHTML, /ไม่มีการแจ้งเตือนตอนนี้/);
    assert.equal(document.getElementById("ad-notif-list").querySelectorAll(".cp-notif-item").length, 0);
  });
});

// ── panel toggle (module-level listener ผูกครั้งเดียวตอน import) ────────
describe("Notification bell — panel toggle listener (module-level, รอบที่ 132)", () => {
  test("คลิกปุ่มกระดิ่ง → เปิด panel (display:none → block)", () => {
    const panel = document.getElementById("ad-notif-panel");
    panel.style.display = "none";
    document.getElementById("ad-notif-btn").click();
    assert.equal(panel.style.display, "block");
  });

  test("คลิกปุ่มกระดิ่งซ้ำ (toggle) → ปิด panel กลับ (block → none)", () => {
    const panel = document.getElementById("ad-notif-panel");
    panel.style.display = "block";
    document.getElementById("ad-notif-btn").click();
    assert.equal(panel.style.display, "none");
  });

  test("คลิกนอก panel/ปุ่ม → ปิด panel เสมอ", () => {
    const panel = document.getElementById("ad-notif-panel");
    panel.style.display = "block";
    document.body.click();
    assert.equal(panel.style.display, "none");
  });

  test("คลิกภายใน panel เอง (ไม่ใช่ปุ่ม) → panel ไม่ถูกปิด (contains(e.target) กันไว้)", () => {
    const panel = document.getElementById("ad-notif-panel");
    panel.style.display = "block";
    panel.click();
    assert.equal(panel.style.display, "block");
  });
});
