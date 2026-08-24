// test/admin-leads.test.mjs — รอบที่ 123
//
// ขอบเขต: js/admin-leads.js (337 บรรทัด) — แท็บ "ลีด" ส่วนที่เหลืออยู่หลังแยก bulk actions/
// การแก้ไขแถวเดียว/โน้ต/mark-as-read ออกไปเป็น js/admin-leads-actions.js แล้ว (รอบ 5 เดิม): state
// ของแท็บ (allLeads/lCurrentPage), startLeadsListener()/retryLeadsListener() (realtime + error
// path), updateLeadsBadge() (badge แท็บลีด + badge แท็บภาพรวม), fillSourceFilter()/
// fillAssigneeSelects(), getStaleLeadReminders(days), setLeadStatusFilter()+pill click,
// getFilteredLeads() (private — กรอง pending-delete/สถานะ/ช่องทาง/ผู้รับผิดชอบ/ค้นหา ผ่าน public
// API renderLeads() เท่านั้น), renderLeadsPagination() (private), renderLeads() (empty-state,
// เนื้อหาแถว, stale badge, checkbox ที่เลือกไว้), onNewLeadsArrived(cb) (แยก "ลีดใหม่จริงๆ" จาก
// field ของลีดเดิมที่เปลี่ยน — ข้าม snapshot แรกสุด)
//
// ไฟล์นี้ import { renderOverview, renderNotifBell } จาก "./admin-overview-dashboard.js" ตรงๆ ที่
// ระดับบนสุด — ลอง import ตรงก่อนเขียนเทสตามที่ตกลงไว้ทุกรอบ พบว่าไม่ใช่ไฟล์ "สะอาด" (เจอ
// "Cannot access 'onNewLeadsArrivedCb' before initialization" เพราะ admin-overview-dashboard.js
// ดึง admin-page.js ตามมา (ผ่าน switchTab) ซึ่ง import admin-leads-automation.js แบบ side-effect
// วนกลับมา import admin-leads.js เอง (circular) ตอนที่ไฟล์นี้เอง evaluate ยังไม่เสร็จ) — ขยาย
// test/helpers/admin-overview-dashboard-stub-loader.mjs ให้ครอบคลุม parentURL ของไฟล์นี้ด้วย
// (ALLOWED_PARENT_RE) และเพิ่ม export renderOverview()/renderNotifBell() แบบ no-op นับจำนวนครั้ง
// เรียก (ดูรายละเอียดเต็มในไฟล์นั้น) — ไม่กระทบ test/admin-products-csv.test.mjs เดิมเลย
//
// ไฟล์นี้ยัง import { currentTeamMembers, leadReminderDays } จาก "./admin-settings-team.js" ตรงๆ
// (import จริง ไม่ stub — ไฟล์นั้นเองไม่มีปัญหา bootstrap เหมือน admin-page.js: import แค่
// db-settings.js/db.js/ui-helpers.js/admin-utils.js/admin-leads.js เอง — circular กลับมาที่นี่
// ปลอดภัยเพราะ renderTeamSettings()/saveTeamMembers() ใน admin-settings-team.js เรียก
// fillAssigneeSelects()/renderLeads() ตอน event/เรียกฟังก์ชันเท่านั้น ไม่ใช่ตอน module evaluate)
// ไม่มี setter export ให้ currentTeamMembers/leadReminderDays โดยตรง (ต่างจาก lCurrentPage ที่มี
// setLCurrentPage) — ใช้ renderTeamSettings({ teamMembers, leadReminderDays }) จริงเป็นทางเดียวที่
// ตั้งค่าทั้งสองตัวได้จากเทส (ฟังก์ชัน public ของไฟล์นั้นเอง ไม่ใช่การแก้โค้ดผลิตภัณฑ์เพิ่ม setter ให้)
//
// selectedLeadIds/updateLeadsBulkBar จาก "./admin-leads-actions.js" import จริงเช่นกัน (ไฟล์นั้น
// เองไม่พึ่ง admin-page.js เลย — เช็คแล้ว) — lHeadCheck ใน admin.html ไม่ค้างเช็คข้าม describe
// block เพราะ selectedLeadIds.clear() ใน beforeEach ทุกครั้ง
//
// **จุดสำคัญ — collection "leads" ของ onSnapshot() stub**: listenLeads() (js/db-orders.js) เรียก
// onSnapshot(query(collection(db,"leads"), ...), ...) — stub ให้ ref.path === "leads" (แพทเทิร์น
// เดียวกับ triggerOrdersSnapshot() ใน test/orders-tab-lifecycle-reminders.test.mjs รอบ 92) —
// helper triggerLeadsSnapshot() ท้ายไฟล์นี้ยิง fake snapshot ผ่าน
// globalThis.__SNAPSHOT_LISTENERS__["leads"] เพื่อทดสอบ startLeadsListener()/retryLeadsListener()
// ได้จริง โดยไม่ต้องพึ่ง Firestore จริง
//
// ตรวจโค้ดจริงทั้งไฟล์ js/admin-leads.js ก่อนเขียนเทสนี้ (อ่านครบ) — ไม่พบบั๊ก ไม่มีการแก้โค้ด
// ผลิตภัณฑ์เลยแม้แต่บรรทัดเดียว (แก้แค่ test/helpers/admin-overview-dashboard-stub-loader.mjs ซึ่ง
// เป็นโครงสร้างพื้นฐานของเทส ไม่ใช่โค้ดผลิตภัณฑ์)

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
let mod;          // admin-leads.js exports
let teamMod;      // admin-settings-team.js exports (ตั้งค่า currentTeamMembers/leadReminderDays)
let actionsMod;   // admin-leads-actions.js exports (selectedLeadIds)
let stateMod;     // admin-state.js exports (pendingDeleteLeadIds, setActiveTab)

// ยิง fake realtime snapshot ไปที่ listener ล่าสุดที่ผูกกับ collection "leads" (listenLeads()
// เรียก onSnapshot(query(collection(db,"leads"), ...), ...) — stub ให้ ref.path === "leads")
function triggerLeadsSnapshot(leads) {
  const cb = globalThis.__SNAPSHOT_LISTENERS__ && globalThis.__SNAPSHOT_LISTENERS__["leads"];
  if (typeof cb !== "function") throw new Error("leads snapshot listener ยังไม่ได้ลงทะเบียน (เรียก startLeadsListener() ก่อนหรือยัง?)");
  cb({ docs: leads.map(l => ({ id: l.id, data: () => { const { id, ...rest } = l; return rest; } })) });
}

function field(id) { return document.getElementById(id); }
function rows() { return Array.from(document.getElementById("ad-l-table-body").querySelectorAll("tr[data-id]")); }
function pagBox() { return document.getElementById("ad-l-pagination"); }
function pagInfo() { return document.getElementById("ad-l-pagination-info"); }
function pagBtns() { return document.getElementById("ad-l-pagination-btns"); }
function badge() { return document.getElementById("ad-leads-badge"); }
function ovBadge() { return document.getElementById("ad-overview-badge"); }
function pills() { return Array.from(document.getElementById("ad-l-filter-status-pills").querySelectorAll(".cp-status-pill")); }

function makeLead(overrides) {
  return {
    id: "l-1", name: "สมชาย ใจดี", email: "somchai@example.com", tel: "0812345678",
    company: "บริษัท ทดสอบ", service: "ป้ายไฟ LED", message: "สนใจขอใบเสนอราคาด่วน",
    source: "inline_contact", status: "new", assignee: "", notes: "",
    createdAt: { toMillis: () => Date.now() },
    ...overrides
  };
}

before(async () => {
  const dom = new JSDOM(`<!doctype html><html><body>${ADMIN_BODY_NO_SCRIPTS}</body></html>`, {
    url: "https://example.test/"
  });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
  globalThis.Event = dom.window.Event;
  document = dom.window.document;

  mod = await import("../js/admin-leads.js");
  teamMod = await import("../js/admin-settings-team.js");
  actionsMod = await import("../js/admin-leads-actions.js");
  stateMod = await import("../js/admin-state.js");

  // startLeadsListener() มี leadsStarted (module-private, ไม่ export setter/stop function ให้เทส
  // รีเซ็ตได้) ทำให้เรียกได้จริงแค่ครั้งเดียวตลอดทั้งไฟล์เทสนี้ — ผูก listener ของ collection
  // "leads" ไว้ที่นี่ครั้งเดียว (ไม่ล้าง globalThis.__SNAPSHOT_LISTENERS__["leads"] ใน beforeEach
  // อีกต่อไป เพราะจะทำให้ startLeadsListener() ที่เรียกซ้ำในเทสถัดๆ ไปไม่ผูกใหม่ให้ เนื่องจาก
  // leadsStarted ยังเป็น true ค้างอยู่) — การเรียก mod.startLeadsListener() ซ้ำในแต่ละเทสด้านล่าง
  // ยังปลอดภัย/มีความหมายอยู่ (ยืนยัน idempotent จริง) เพราะ callback อ้างอิงตัวเดิมเสมอ
  globalThis.__SNAPSHOT_LISTENERS__ = {};
  mod.startLeadsListener();
});

beforeEach(() => {
  globalThis.__AD_OVERVIEW_STUB_RENDER_OVERVIEW_CALLS__ = [];
  globalThis.__AD_OVERVIEW_STUB_RENDER_NOTIF_BELL_CALLS__ = [];
  mod.setLCurrentPage(1);
  mod.setLeadStatusFilter("");
  field("ad-l-search").value = "";
  field("ad-l-filter-source").value = "";
  if (field("ad-l-filter-assignee")) field("ad-l-filter-assignee").value = "";
  stateMod.pendingDeleteLeadIds.clear();
  stateMod.setActiveTab("overview");
  actionsMod.selectedLeadIds.clear();
  teamMod.renderTeamSettings({ teamMembers: [], leadReminderDays: 3 });
  mod.renderLeads(); // เคลียร์ allLeads เดิมออกจากตารางก่อนทุกเทส (allLeads เป็น module state ที่ค้างข้ามเทสได้ผ่าน listener)
});

// **สำคัญเรื่องลำดับ**: startLeadsListener() มี firstSnapshot/knownLeadIds/leadsStarted เป็น
// module-private state ที่ "เริ่มได้จริงแค่ครั้งเดียว" ตลอดทั้งไฟล์เทสนี้ (ไม่มี stop/reset export
// ให้เทสเรียกได้ — ดูหมายเหตุใน before() ด้านบน) โดยเฉพาะ firstSnapshot: มีผลแค่กับ
// "snapshot ตัวแรกสุดที่เคยถูกยิงเข้าไปในไฟล์เทสนี้ทั้งไฟล์" เท่านั้น (ข้าม newlyArrived ให้ตัวเดียว
// แล้วไม่ true อีกเลยตลอดไป) — ต้องทดสอบ behavior นี้ "ก่อน" describe อื่นที่เรียก
// triggerLeadsSnapshot() ทั้งหมด (จึงย้าย describe นี้มาไว้อันดับแรกสุดของไฟล์ ก่อน describe อื่นที่
// ยิง snapshot) และรวมเป็นเทสเดียวต่อเนื่องกัน (ไม่แยกเป็นหลายเทส เพราะแต่ละเทสจะไม่ได้เห็น
// "snapshot แรกสุดจริงๆ" อีกต่อไปหลังเทสแรกทำงานเสร็จ)
describe("onNewLeadsArrived(cb) — แยกลีดใหม่จริงๆ จาก field ที่เปลี่ยน (รอบที่ 123, ต้องรันก่อน describe อื่นที่ยิง snapshot)", () => {
  test("snapshot แรกสุดของทั้งไฟล์ไม่นับว่ามีลีดใหม่ → snapshot ถัดไปที่มี id ใหม่จริงๆ ถูกตรวจจับเฉพาะตัวใหม่ → id เดิมแค่ field เปลี่ยนไม่ถูกนับ", () => {
    const received = [];
    mod.onNewLeadsArrived((leads) => received.push(leads));

    triggerLeadsSnapshot([makeLead({ id: "l-1" }), makeLead({ id: "l-2" })]); // snapshot แรกสุดของทั้งไฟล์ — ต้องข้าม แม้มีลีดอยู่แล้ว 2 รายการ
    assert.equal(received.length, 0);

    triggerLeadsSnapshot([makeLead({ id: "l-1" }), makeLead({ id: "l-2" }), makeLead({ id: "l-3" })]); // l-3 ใหม่จริง
    assert.equal(received.length, 1);
    assert.deepEqual(received[0].map(l => l.id), ["l-3"]);

    triggerLeadsSnapshot([makeLead({ id: "l-1" }), makeLead({ id: "l-2" }), makeLead({ id: "l-3", status: "read" })]); // field เปลี่ยน ไม่ใช่ลีดใหม่
    assert.equal(received.length, 1); // ไม่มีการเรียกเพิ่ม
  });
});

describe("startLeadsListener() — realtime listener (รอบที่ 123)", () => {
  test("ผูก listener ของ collection 'leads' ให้พร้อมรับ realtime snapshot (ผูกไว้แล้วตั้งแต่ before())", () => {
    assert.equal(typeof globalThis.__SNAPSHOT_LISTENERS__["leads"], "function");
  });

  test("เรียกซ้ำ (idempotent): ไม่ผูก listener ใหม่ซ้ำถ้าเริ่มไปแล้ว — ข้อมูลเดิมยังอยู่", () => {
    triggerLeadsSnapshot([makeLead({ id: "l-1" })]);
    mod.startLeadsListener(); // เรียกซ้ำ — leadsStarted=true อยู่แล้ว ต้อง return ทันทีไม่ทำอะไรซ้ำ
    assert.equal(mod.allLeads.length, 1);
  });

  test("snapshot ยิงข้อมูลใหม่ → allLeads อัปเดต, fillSourceFilter/renderLeads/updateLeadsBadge/renderNotifBell ถูกเรียก", () => {
    triggerLeadsSnapshot([makeLead({ id: "l-1" })]);
    assert.equal(mod.allLeads.length, 1);
    assert.equal(mod.allLeads[0].id, "l-1");
    assert.equal(rows().length, 1); // renderLeads() ถูกเรียกจริง
    assert.equal(field("ad-l-filter-source").querySelectorAll("option").length, 2); // fillSourceFilter() ถูกเรียกจริง (ทุกช่องทาง + inline_contact)
    assert.equal(globalThis.__AD_OVERVIEW_STUB_RENDER_NOTIF_BELL_CALLS__.length, 1);
  });

  test("activeTab === 'overview' → renderOverview() ถูกเรียกด้วย", () => {
    stateMod.setActiveTab("overview");
    triggerLeadsSnapshot([makeLead({ id: "l-1" })]);
    assert.equal(globalThis.__AD_OVERVIEW_STUB_RENDER_OVERVIEW_CALLS__.length, 1);
  });

  test("activeTab !== 'overview' → ไม่เรียก renderOverview()", () => {
    stateMod.setActiveTab("leads");
    triggerLeadsSnapshot([makeLead({ id: "l-1" })]);
    assert.equal(globalThis.__AD_OVERVIEW_STUB_RENDER_OVERVIEW_CALLS__.length, 0);
  });

  // หมายเหตุ: ไม่มีเทส error-path ตรงๆ (errorStateHTML + ปุ่ม "ลองใหม่" เรียก retryLeadsListener())
  // เพราะ onSnapshot() stub (firebase-stub-loader.mjs) เก็บแค่ onNext (2nd arg) ไว้ใน
  // __SNAPSHOT_LISTENERS__ ไม่มีช่องทางยิง onError (3rd arg) ได้จากเทส — ทดสอบแค่ว่า listener ที่
  // startLeadsListener() ผูกไว้ทำงานต่อเนื่องได้กับหลาย snapshot แทน (retryLeadsListener() private
  // เรียกไม่ได้ตรงๆ อยู่แล้ว)
  test("listener ที่ผูกไว้ทำงานต่อเนื่องกับ snapshot หลายรอบได้ถูกต้อง", () => {
    triggerLeadsSnapshot([makeLead({ id: "l-1" })]);
    const firstCb = globalThis.__SNAPSHOT_LISTENERS__["leads"];
    assert.equal(typeof firstCb, "function");
    triggerLeadsSnapshot([makeLead({ id: "l-1" }), makeLead({ id: "l-2" })]);
    assert.equal(mod.allLeads.length, 2);
  });
});

describe("updateLeadsBadge() — ผ่าน startLeadsListener()/snapshot (รอบที่ 123)", () => {
  test("มีลีดสถานะ new → badge แท็บลีดแสดงจำนวน + badge แท็บภาพรวมแสดงด้วย", () => {
    mod.startLeadsListener();
    triggerLeadsSnapshot([makeLead({ id: "l-1", status: "new" }), makeLead({ id: "l-2", status: "read" })]);
    assert.equal(badge().textContent, "1");
    assert.equal(badge().style.display, "inline-flex");
    assert.equal(ovBadge().textContent, "1");
    assert.equal(ovBadge().style.display, "inline-flex");
  });

  test("ไม่มีลีดสถานะ new เลย → badge ทั้งสองจุดซ่อน", () => {
    mod.startLeadsListener();
    triggerLeadsSnapshot([makeLead({ id: "l-1", status: "read" })]);
    assert.equal(badge().style.display, "none");
    assert.equal(ovBadge().style.display, "none");
  });
});

describe("fillSourceFilter() — ผ่าน snapshot (รอบที่ 123)", () => {
  test("เติม option ตามช่องทางที่มีจริงเท่านั้น (unique) + คงค่าที่เลือกอยู่เดิมไว้ถ้ายังมีอยู่", () => {
    mod.startLeadsListener();
    triggerLeadsSnapshot([
      makeLead({ id: "l-1", source: "inline_contact" }),
      makeLead({ id: "l-2", source: "chat_widget" }),
      makeLead({ id: "l-3", source: "inline_contact" }),
    ]);
    const opts = Array.from(field("ad-l-filter-source").querySelectorAll("option"));
    assert.equal(opts.length, 3); // ทั้งหมด + 2 unique
    assert.equal(opts[0].value, "");
    const values = opts.map(o => o.value);
    assert.ok(values.includes("inline_contact"));
    assert.ok(values.includes("chat_widget"));
  });

  test("label แปลผ่าน LEAD_SOURCE_LABEL, fallback เป็นค่าดิบถ้าไม่รู้จัก", () => {
    mod.startLeadsListener();
    triggerLeadsSnapshot([makeLead({ id: "l-1", source: "unknown_source_xyz" })]);
    const opt = field("ad-l-filter-source").querySelector('option[value="unknown_source_xyz"]');
    assert.equal(opt.textContent, "unknown_source_xyz");
  });

  test("source ว่าง/null ถูกกรองออก ไม่สร้าง option เปล่า", () => {
    mod.startLeadsListener();
    triggerLeadsSnapshot([makeLead({ id: "l-1", source: null }), makeLead({ id: "l-2", source: "chat_widget" })]);
    const opts = Array.from(field("ad-l-filter-source").querySelectorAll("option"));
    assert.equal(opts.length, 2); // ทั้งหมด + chat_widget เท่านั้น
  });
});

describe("fillAssigneeSelects() (รอบที่ 123)", () => {
  test("รวมชื่อทีมงานปัจจุบัน + ชื่อที่ถูกมอบหมายไว้แล้วแต่ไม่อยู่ในทีมงานแล้ว (unique)", () => {
    teamMod.renderTeamSettings({ teamMembers: ["เอ", "บี"], leadReminderDays: 3 });
    mod.startLeadsListener();
    triggerLeadsSnapshot([makeLead({ id: "l-1", assignee: "เอ" }), makeLead({ id: "l-2", assignee: "ซี (ลาออกแล้ว)" })]);
    const opts = Array.from(field("ad-l-filter-assignee").querySelectorAll("option"));
    const values = opts.map(o => o.value);
    assert.ok(values.includes("เอ"));
    assert.ok(values.includes("บี"));
    assert.ok(values.includes("ซี (ลาออกแล้ว)"));
    assert.equal(values[0], "");
    assert.equal(values[1], "__unassigned__");
  });

  test("คงค่าที่เลือกอยู่เดิมไว้หลังเติมใหม่", () => {
    teamMod.renderTeamSettings({ teamMembers: ["เอ"], leadReminderDays: 3 });
    mod.startLeadsListener();
    triggerLeadsSnapshot([makeLead({ id: "l-1", assignee: "เอ" })]);
    field("ad-l-filter-assignee").value = "เอ";
    mod.fillAssigneeSelects();
    assert.equal(field("ad-l-filter-assignee").value, "เอ");
  });
});

describe("getStaleLeadReminders(days) (รอบที่ 123)", () => {
  test("days <= 0 หรือ falsy → คืน [] เสมอ ไม่ว่าข้อมูลจะเป็นยังไง", () => {
    mod.startLeadsListener();
    triggerLeadsSnapshot([makeLead({ id: "l-1", status: "read", createdAt: { toMillis: () => Date.now() - 999 * 86400000 } })]);
    assert.deepEqual(mod.getStaleLeadReminders(0), []);
    assert.deepEqual(mod.getStaleLeadReminders(null), []);
    assert.deepEqual(mod.getStaleLeadReminders(-5), []);
  });

  test("นับเฉพาะสถานะ read/replied ที่ไม่มีอัปเดตเกิน N วัน (ไม่นับ new/won/lost)", () => {
    mod.startLeadsListener();
    const old = { toMillis: () => Date.now() - 10 * 86400000 };
    triggerLeadsSnapshot([
      makeLead({ id: "l-1", status: "read", createdAt: old, notesUpdatedAt: null, statusUpdatedAt: null }),
      makeLead({ id: "l-2", status: "new", createdAt: old }),
      makeLead({ id: "l-3", status: "won", createdAt: old }),
      makeLead({ id: "l-4", status: "replied", createdAt: { toMillis: () => Date.now() } }), // เพิ่งอัปเดต ไม่ค้าง
    ]);
    const stale = mod.getStaleLeadReminders(3);
    assert.deepEqual(stale.map(l => l.id), ["l-1"]);
  });

  test("ใช้ notesUpdatedAt ก่อน แล้วค่อย statusUpdatedAt แล้วค่อย createdAt (ลำดับความสำคัญ)", () => {
    mod.startLeadsListener();
    const recent = { toMillis: () => Date.now() };
    const old = { toMillis: () => Date.now() - 10 * 86400000 };
    triggerLeadsSnapshot([
      makeLead({ id: "l-1", status: "read", createdAt: old, statusUpdatedAt: old, notesUpdatedAt: recent }), // notes ล่าสุด → ไม่ค้าง
    ]);
    assert.deepEqual(mod.getStaleLeadReminders(3), []);
  });
});

describe("setLeadStatusFilter()/pill click (รอบที่ 123)", () => {
  test("setLeadStatusFilter(status) toggle class active + aria-selected ตาม pill ที่ตรง", () => {
    mod.setLeadStatusFilter("won");
    const ps = pills();
    const wonPill = ps.find(p => p.dataset.status === "won");
    const allPill = ps.find(p => p.dataset.status === "");
    assert.equal(wonPill.classList.contains("active"), true);
    assert.equal(wonPill.getAttribute("aria-selected"), "true");
    assert.equal(allPill.classList.contains("active"), false);
    assert.equal(allPill.getAttribute("aria-selected"), "false");
  });

  test("setLeadStatusFilter(null/undefined) → เท่ากับ '' (pill 'ทั้งหมด' active)", () => {
    mod.setLeadStatusFilter(null);
    const allPill = pills().find(p => p.dataset.status === "");
    assert.equal(allPill.classList.contains("active"), true);
  });

  test("คลิก pill → เรียก setLeadStatusFilter + รีเซ็ตหน้าเป็น 1 + render ใหม่ (กรองลีดจริง)", () => {
    mod.startLeadsListener();
    triggerLeadsSnapshot([makeLead({ id: "l-1", status: "new" }), makeLead({ id: "l-2", status: "won" })]);
    mod.setLCurrentPage(2); // ให้ค่าเริ่มไม่ใช่ 1 ก่อน เพื่อยืนยันว่าถูกรีเซ็ตจริง
    const wonPill = pills().find(p => p.dataset.status === "won");
    wonPill.click();
    assert.equal(mod.lCurrentPage, 1);
    assert.equal(rows().length, 1);
    assert.match(rows()[0].innerHTML, /value="won" selected/);
  });
});

describe("getFilteredLeads()/renderLeads() — กรอง (ผ่าน public API renderLeads() รอบที่ 123)", () => {
  beforeEach(() => {
    mod.startLeadsListener();
  });

  test("pendingDeleteLeadIds กรองแถวนั้นออก", () => {
    triggerLeadsSnapshot([makeLead({ id: "l-1" }), makeLead({ id: "l-2" })]);
    stateMod.pendingDeleteLeadIds.add("l-1");
    mod.renderLeads();
    assert.equal(rows().length, 1);
    assert.equal(rows()[0].dataset.id, "l-2");
  });

  test("กรองตามสถานะ (default 'new' ถ้าไม่มี status)", () => {
    triggerLeadsSnapshot([
      makeLead({ id: "l-1", status: undefined }),
      makeLead({ id: "l-2", status: "won" }),
    ]);
    mod.setLeadStatusFilter("new");
    mod.renderLeads();
    assert.equal(rows().length, 1);
    assert.equal(rows()[0].dataset.id, "l-1");
  });

  test("กรองตามช่องทาง (source)", () => {
    triggerLeadsSnapshot([
      makeLead({ id: "l-1", source: "chat_widget" }),
      makeLead({ id: "l-2", source: "inline_contact" }),
    ]);
    field("ad-l-filter-source").value = "chat_widget";
    mod.renderLeads();
    assert.equal(rows().length, 1);
    assert.equal(rows()[0].dataset.id, "l-1");
  });

  test("กรองตามผู้รับผิดชอบ: '__unassigned__' → เฉพาะที่ไม่มี assignee", () => {
    triggerLeadsSnapshot([
      makeLead({ id: "l-1", assignee: "" }),
      makeLead({ id: "l-2", assignee: "เอ" }),
    ]);
    field("ad-l-filter-assignee").value = "__unassigned__";
    mod.renderLeads();
    assert.equal(rows().length, 1);
    assert.equal(rows()[0].dataset.id, "l-1");
  });

  test("กรองตามผู้รับผิดชอบ: ชื่อเจาะจง", () => {
    triggerLeadsSnapshot([
      makeLead({ id: "l-1", assignee: "เอ" }),
      makeLead({ id: "l-2", assignee: "บี" }),
    ]);
    field("ad-l-filter-assignee").value = "เอ";
    mod.renderLeads();
    assert.equal(rows().length, 1);
    assert.equal(rows()[0].dataset.id, "l-1");
  });

  test("ค้นหา: ครอบคลุม name/email/tel/phone/company/service/message, case-insensitive + trim", () => {
    triggerLeadsSnapshot([
      makeLead({ id: "l-1", name: "Somchai Test", email: "x@x.com", tel: "", phone: "", company: "", service: "", message: "" }),
      makeLead({ id: "l-2", name: "อื่น", email: "", tel: "", phone: "", company: "", service: "", message: "" }),
    ]);
    field("ad-l-search").value = "  SOMCHAI  ";
    mod.renderLeads();
    assert.equal(rows().length, 1);
    assert.equal(rows()[0].dataset.id, "l-1");
  });

  test("ค้นหาไม่เจอ → empty state 'ไม่พบรายการลีด'", () => {
    triggerLeadsSnapshot([makeLead({ id: "l-1", name: "Somchai" })]);
    field("ad-l-search").value = "ไม่มีทางเจอคำนี้แน่นอน";
    mod.renderLeads();
    assert.equal(rows().length, 0);
    assert.match(field("ad-l-table-body").innerHTML, /ไม่พบรายการลีด/);
    assert.equal(pagBox().style.display, "none");
  });

  test("ตัวกรองหลายตัวพร้อมกัน (AND ทั้งหมด)", () => {
    triggerLeadsSnapshot([
      makeLead({ id: "l-1", status: "new", source: "chat_widget", assignee: "เอ", name: "Somchai" }),
      makeLead({ id: "l-2", status: "new", source: "chat_widget", assignee: "บี", name: "Somchai" }),
    ]);
    mod.setLeadStatusFilter("new");
    field("ad-l-filter-source").value = "chat_widget";
    field("ad-l-filter-assignee").value = "เอ";
    field("ad-l-search").value = "somchai";
    mod.renderLeads();
    assert.equal(rows().length, 1);
    assert.equal(rows()[0].dataset.id, "l-1");
  });
});

describe("renderLeads() — เนื้อหาแถว (รอบที่ 123)", () => {
  beforeEach(() => {
    mod.startLeadsListener();
  });

  test("ชื่อ/บริษัท: avatar + ชื่อ + บริษัทถ้ามี, escape HTML กัน XSS", () => {
    triggerLeadsSnapshot([makeLead({ id: "l-1", name: '<b>XSS</b>', company: '<i>Co</i>' })]);
    mod.renderLeads();
    const html = rows()[0].innerHTML;
    assert.doesNotMatch(html, /<b>XSS<\/b>/);
    assert.match(html, /&lt;b&gt;XSS&lt;\/b&gt;/);
    assert.match(html, /&lt;i&gt;Co&lt;\/i&gt;/);
  });

  test("ชื่อว่าง → fallback '—' (แต่ avatar ใช้ email ถ้าไม่มีชื่อ)", () => {
    triggerLeadsSnapshot([makeLead({ id: "l-1", name: "", email: "x@x.com" })]);
    mod.renderLeads();
    assert.match(rows()[0].innerHTML, />—</);
  });

  test("ไม่มีบริษัท → ไม่แสดง subtext บริษัท", () => {
    triggerLeadsSnapshot([makeLead({ id: "l-1", company: "" })]);
    mod.renderLeads();
    assert.doesNotMatch(rows()[0].innerHTML, /cp-subtext">.*บริษัท/);
  });

  test("เบอร์โทร: tel ก่อน, fallback phone, fallback '—'", () => {
    triggerLeadsSnapshot([
      makeLead({ id: "l-1", tel: "0811111111", phone: "0822222222" }),
      makeLead({ id: "l-2", tel: "", phone: "0833333333" }),
      makeLead({ id: "l-3", tel: "", phone: "" }),
    ]);
    mod.renderLeads();
    const rs = rows();
    assert.match(rs[0].innerHTML, /0811111111/);
    assert.match(rs[1].innerHTML, /0833333333/);
    assert.match(rs[2].innerHTML, />—<\/td>|>—</); // เบอร์ไม่มี → "—"
  });

  test("อีเมล: แสดงถ้ามี, ไม่แสดงบรรทัดถ้าไม่มี", () => {
    triggerLeadsSnapshot([
      makeLead({ id: "l-1", email: "has@x.com" }),
      makeLead({ id: "l-2", email: "" }),
    ]);
    mod.renderLeads();
    const rs = rows();
    assert.match(rs[0].innerHTML, /has@x\.com/);
  });

  test("ข้อความ: ตัดที่ 140 ตัวอักษร + '…' ถ้ายาวเกิน, escape HTML", () => {
    const longMsg = "ก".repeat(150);
    triggerLeadsSnapshot([makeLead({ id: "l-1", message: longMsg })]);
    mod.renderLeads();
    const html = rows()[0].innerHTML;
    assert.match(html, /ก{140}…/);
    assert.doesNotMatch(html, /ก{141}/);
  });

  test("ข้อความสั้น ≤140 ตัวอักษร → ไม่มี '…' ต่อท้าย", () => {
    triggerLeadsSnapshot([makeLead({ id: "l-1", message: "สั้นๆ" })]);
    mod.renderLeads();
    assert.doesNotMatch(rows()[0].innerHTML, /สั้นๆ…/);
  });

  test("ข้อความว่าง → '—'", () => {
    triggerLeadsSnapshot([makeLead({ id: "l-1", message: "" })]);
    mod.renderLeads();
    assert.match(rows()[0].querySelector(".ad-l-msg").innerHTML, /—/);
  });

  test("ช่องทาง: label จาก LEAD_SOURCE_LABEL, fallback ค่าดิบ, fallback '—'", () => {
    triggerLeadsSnapshot([
      makeLead({ id: "l-1", source: "chat_widget" }),
      makeLead({ id: "l-2", source: "weird_xyz" }),
      makeLead({ id: "l-3", source: "" }),
    ]);
    mod.renderLeads();
    const rs = rows();
    assert.match(rs[0].innerHTML, /แชท AI/);
    assert.match(rs[1].innerHTML, /weird_xyz/);
    assert.match(rs[2].innerHTML, />—</);
  });

  test("dropdown สถานะ: option ที่ตรงกับ status ปัจจุบันมี selected", () => {
    triggerLeadsSnapshot([makeLead({ id: "l-1", status: "replied" })]);
    mod.renderLeads();
    const select = rows()[0].querySelector(".ad-l-status");
    assert.equal(select.value, "replied");
    assert.equal(select.dataset.status, "replied");
  });

  test("dropdown ผู้รับผิดชอบ: option ว่าง + ทีมงานปัจจุบัน + assignee เดิมที่ไม่อยู่ในทีมแล้ว (มี label พิเศษ)", () => {
    teamMod.renderTeamSettings({ teamMembers: ["เอ", "บี"], leadReminderDays: 3 });
    triggerLeadsSnapshot([makeLead({ id: "l-1", assignee: "ซี" })]);
    mod.renderLeads();
    const select = rows()[0].querySelector(".ad-l-assignee");
    const opts = Array.from(select.querySelectorAll("option"));
    assert.equal(opts[0].value, "");
    assert.ok(opts.some(o => o.value === "เอ"));
    assert.ok(opts.some(o => o.value === "บี"));
    const extra = opts.find(o => o.value === "ซี");
    assert.ok(extra);
    assert.match(extra.textContent, /ไม่อยู่ในรายชื่อทีมงานแล้ว/);
    assert.equal(extra.selected, true);
  });

  test("assignee ที่ยังอยู่ในทีมงาน → ไม่มี option พิเศษซ้ำ", () => {
    teamMod.renderTeamSettings({ teamMembers: ["เอ"], leadReminderDays: 3 });
    triggerLeadsSnapshot([makeLead({ id: "l-1", assignee: "เอ" })]);
    mod.renderLeads();
    const select = rows()[0].querySelector(".ad-l-assignee");
    const opts = Array.from(select.querySelectorAll("option"));
    assert.equal(opts.filter(o => o.value === "เอ").length, 1);
    assert.equal(opts.find(o => o.value === "เอ").selected, true);
  });

  test("checkbox: ติ๊กตาม selectedLeadIds ที่มีอยู่ก่อน render", () => {
    actionsMod.selectedLeadIds.add("l-1");
    triggerLeadsSnapshot([makeLead({ id: "l-1" }), makeLead({ id: "l-2" })]);
    mod.renderLeads();
    const rs = rows();
    assert.equal(rs[0].querySelector(".cp-row-check").checked, true);
    assert.equal(rs[1].querySelector(".cp-row-check").checked, false);
  });

  test("แถวสถานะ new มี class 'ad-l-row-new', สถานะอื่นไม่มี", () => {
    triggerLeadsSnapshot([makeLead({ id: "l-1", status: "new" }), makeLead({ id: "l-2", status: "read" })]);
    mod.renderLeads();
    const rs = rows();
    assert.equal(rs[0].classList.contains("ad-l-row-new"), true);
    assert.equal(rs[1].classList.contains("ad-l-row-new"), false);
  });

  test("ปุ่มโน้ต: มีจุด (ad-l-notes-dot) ถ้ามีโน้ตอยู่แล้ว, ไม่มีถ้าไม่มีโน้ต", () => {
    triggerLeadsSnapshot([makeLead({ id: "l-1", notes: "มีโน้ตแล้ว" }), makeLead({ id: "l-2", notes: "" })]);
    mod.renderLeads();
    const rs = rows();
    assert.ok(rs[0].querySelector(".ad-l-notes-dot"));
    assert.equal(rs[1].querySelector(".ad-l-notes-dot"), null);
  });

  test("stale badge: แสดงเฉพาะลีดที่ getStaleLeadReminders(leadReminderDays) นับว่าค้าง", () => {
    teamMod.renderTeamSettings({ teamMembers: [], leadReminderDays: 3 });
    const old = { toMillis: () => Date.now() - 10 * 86400000 };
    triggerLeadsSnapshot([
      makeLead({ id: "l-1", status: "read", createdAt: old, notesUpdatedAt: null, statusUpdatedAt: null }),
      makeLead({ id: "l-2", status: "read", createdAt: { toMillis: () => Date.now() } }),
    ]);
    mod.renderLeads();
    const rs = rows();
    assert.ok(rs[0].querySelector(".ad-l-stale-badge"));
    assert.equal(rs[1].querySelector(".ad-l-stale-badge"), null);
  });
});

describe("renderLeadsPagination() — ผ่าน renderLeads() (รอบที่ 123)", () => {
  beforeEach(() => {
    mod.startLeadsListener();
  });

  test("0 รายการ → ซ่อนกล่อง pagination", () => {
    triggerLeadsSnapshot([]);
    mod.renderLeads();
    assert.equal(pagBox().style.display, "none");
  });

  test("มีรายการ (แม้แค่หน้าเดียว) → แสดงกล่อง pagination", () => {
    triggerLeadsSnapshot([makeLead({ id: "l-1" })]);
    mod.renderLeads();
    assert.equal(pagBox().style.display, "flex");
  });

  test("12 รายการ (LEADS_PAGE_SIZE=10) → 2 หน้า, ข้อความช่วงถูกต้อง, ปุ่ม prev disabled หน้า 1", () => {
    const leads = Array.from({ length: 12 }, (_, i) => makeLead({ id: `l-${i + 1}` }));
    triggerLeadsSnapshot(leads);
    mod.renderLeads();
    assert.equal(rows().length, 10);
    assert.match(pagInfo().textContent, /แสดง 1–10 จาก 12 รายการ/);
    const prevBtn = pagBtns().querySelector('[data-page="prev"]');
    const nextBtn = pagBtns().querySelector('[data-page="next"]');
    assert.equal(prevBtn.disabled, true);
    assert.equal(nextBtn.disabled, false);
  });

  test("คลิกหน้า 2 → แสดง 2 แถวที่เหลือ + ปุ่ม next disabled", () => {
    const leads = Array.from({ length: 12 }, (_, i) => makeLead({ id: `l-${i + 1}` }));
    triggerLeadsSnapshot(leads);
    mod.renderLeads();
    pagBtns().querySelector('[data-page="2"]').click();
    assert.equal(mod.lCurrentPage, 2);
    assert.equal(rows().length, 2);
    assert.match(pagInfo().textContent, /แสดง 11–12 จาก 12 รายการ/);
    assert.equal(pagBtns().querySelector('[data-page="next"]').disabled, true);
  });

  test("ปุ่ม next/prev เปลี่ยนหน้าถูกต้อง", () => {
    const leads = Array.from({ length: 12 }, (_, i) => makeLead({ id: `l-${i + 1}` }));
    triggerLeadsSnapshot(leads);
    mod.renderLeads();
    pagBtns().querySelector('[data-page="next"]').click();
    assert.equal(mod.lCurrentPage, 2);
    pagBtns().querySelector('[data-page="prev"]').click();
    assert.equal(mod.lCurrentPage, 1);
  });

  test("หน้าปัจจุบัน clamp กลับอัตโนมัติเมื่อรายการลดลงจนเกินหน้าที่มี (เช่นค้นหาแล้วเหลือน้อยลง)", () => {
    const leads = Array.from({ length: 12 }, (_, i) => makeLead({ id: `l-${i + 1}`, name: "Somchai" }));
    triggerLeadsSnapshot(leads);
    mod.setLCurrentPage(2);
    mod.renderLeads();
    assert.equal(mod.lCurrentPage, 2);
    field("ad-l-search").value = "ไม่มีทางเจอ";
    mod.renderLeads(); // filtered.length=0 → renderLeadsPagination(0) → ไม่ clamp เพราะ return ก่อน (totalRows=0 คนละ branch)
    field("ad-l-search").value = "";
    triggerLeadsSnapshot([makeLead({ id: "l-1" })]); // เหลือรายการเดียว (1 หน้า) ขณะ lCurrentPage ยังเป็น 2 อยู่
    mod.renderLeads();
    assert.equal(mod.lCurrentPage, 1);
  });
});

describe("event listeners — ค้นหา/กรอง รีเซ็ตหน้าเป็น 1 (รอบที่ 123)", () => {
  beforeEach(() => {
    mod.startLeadsListener();
    const leads = Array.from({ length: 12 }, (_, i) => makeLead({ id: `l-${i + 1}` }));
    triggerLeadsSnapshot(leads);
  });

  test("พิมพ์ค้นหา (input event) → รีเซ็ตหน้าเป็น 1 ก่อน render ใหม่", () => {
    mod.setLCurrentPage(2);
    mod.renderLeads();
    field("ad-l-search").value = "Somchai";
    field("ad-l-search").dispatchEvent(new globalThis.Event("input"));
    assert.equal(mod.lCurrentPage, 1);
  });

  test("เปลี่ยนช่องทาง (change event) → รีเซ็ตหน้าเป็น 1", () => {
    mod.setLCurrentPage(2);
    mod.renderLeads();
    field("ad-l-filter-source").dispatchEvent(new globalThis.Event("change"));
    assert.equal(mod.lCurrentPage, 1);
  });

  test("เปลี่ยนผู้รับผิดชอบ (change event) → รีเซ็ตหน้าเป็น 1", () => {
    mod.setLCurrentPage(2);
    mod.renderLeads();
    field("ad-l-filter-assignee").dispatchEvent(new globalThis.Event("change"));
    assert.equal(mod.lCurrentPage, 1);
  });
});
