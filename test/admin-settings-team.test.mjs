// test/admin-settings-team.test.mjs — รอบที่ 125
//
// ขอบเขต: js/admin-settings-team.js (143 บรรทัด) — แท็บ SETTINGS ย่อย "ทีมงาน" (รายชื่อผู้รับผิดชอบ
// ลีด) เก็บเป็น settings.teamMembers: string[] ในเอกสาร settings/main เดียวกับไฟล์กลุ่ม
// admin-settings-* อื่นๆ — เพิ่ม 2 ค่าจาก Phase 3 (CRM automation) ในเอกสารเดียวกัน:
// settings.leadReminderDays (number, มี UI ตั้งค่า) และ settings.leadAssignRoundRobinIndex
// (number, ไม่มี UI — internal bookkeeping ให้ admin-leads-automation.js เท่านั้น ตั้งผ่าน
// setLeadAssignRoundRobinIndex() ที่ไฟล์นี้ export ให้)
//
// **หมายเหตุสำคัญเรื่องคำแนะนำท้ายรอบ 124**: บันทึกท้ายรอบ 124 แนะนำไฟล์ถัดไปเป็นไฟล์อื่นที่มี
// เทสอยู่แล้ว — ตรวจแล้วพบว่าคำแนะนำนั้นคลาดเคลื่อน เทียบรายชื่อ js/admin-*.js ทั้งหมดกับ
// test/admin-*.test.mjs ที่มีอยู่จริงแทน พบว่า admin-settings-team.js/admin-settings-videos.js
// เป็น 2 ไฟล์ที่ยังไม่เคยมีเทสของตัวเองเลย (ไม่ถูกกล่าวถึงในบันทึกรอบไหนเลยว่าทำแล้ว) — เลือก
// admin-settings-team.js ก่อนในรอบนี้
//
// **circular import กับ js/admin-leads.js (ของจริง ไม่ใช่แค่คอมเมนต์)**: ไฟล์นี้
// `import { allLeads, fillAssigneeSelects, renderLeads } from "./admin-leads.js"` ตรงๆ ที่ระดับ
// บนสุด และ admin-leads.js เองก็ `import { currentTeamMembers, leadReminderDays } from
// "./admin-settings-team.js"` กลับมาตรงๆ เหมือนกัน (วนครบวง) — ลองนำเข้าตรงในสภาพแวดล้อมเทสก่อน
// เขียนเทสตามที่ตกลงไว้ทุกรอบ: **import ผ่านสำเร็จทันที ไม่ต้องแก้ infra เทสไฟล์ไหนเลย** เพราะ
// top-level ของทั้งสองไฟล์แค่ query DOM element + ประกาศตัวแปรเท่านั้น ไม่มีการเรียกฟังก์ชันข้ามไฟล์
// ตอน module evaluate เลย (จุดเดียวกับที่บันทึกไว้แล้วในรอบ 123 ตอนตรวจ admin-settings-team.js/
// admin-leads-actions.js) — admin-leads.js เองก็ import ได้แล้วตั้งแต่รอบ 123 ผ่าน
// admin-overview-dashboard-stub-loader.mjs ที่ขยาย ALLOWED_PARENT_RE ครอบคลุมไว้แล้ว ไม่ต้องแก้
// stub ไหนเพิ่มในรอบนี้
//
// สถาปัตยกรรมเทส: import ทั้งสองไฟล์ (admin-settings-team.js + admin-leads.js) ในสภาพแวดล้อมเทส
// เดียวกัน (แพทเทิร์นเดียวกับ test/admin-leads-actions.test.mjs รอบ 124) — เรียก
// leadsMod.startLeadsListener() ครั้งเดียวใน before() แล้วยิง fake snapshot ผ่าน
// triggerLeadsSnapshot() ใน beforeEach() เพื่อตั้งค่า allLeads ให้ปุ่มลบชื่อทีมงานเช็คเงื่อนไข
// "มีลีดผูกอยู่หรือไม่" ได้จริง — ตั้งค่า currentTeamMembers/leadReminderDays/
// leadAssignRoundRobinIndex ผ่าน renderTeamSettings(settings) เท่านั้น (ฟังก์ชัน public ของไฟล์
// เอง ไม่มี setter ตรงๆ ให้ต่างหาก)
//
// ปุ่มลบชื่อทีมงาน (.ad-team-remove): confirmDialog() ถูกเรียก **เฉพาะกรณีมีลีดผูกอยู่จริงเท่านั้น**
// (`if (inUse && !(await confirmDialog(...))) return;`) — ชื่อที่ไม่มีลีดผูกอยู่จะลบทันทีไม่มี
// popup ยืนยันเลย (อ่านโค้ดจริงแล้วยืนยันจุดนี้ก่อนเขียนเทส ไม่ใช่เดา)
//
// ไฟล์นี้ import saveSettings จาก db-settings.js + logAudit จาก db.js ตรงๆ (เหมือนรอบ 116/119) —
// saveSettings() เรียก setDoc() ของ stub ตรงๆ (บันทึกที่ globalThis.__SET_DOC_CALLS__) —
// logAudit() เช็ค auth.currentUser ก่อนเสมอ ซึ่ง stub คืน { currentUser: null } เป็นค่าเริ่มต้น
// เสมอ จึง exit เงียบๆ ไม่มี addDoc("auditLog") เกิดขึ้นจริง — ยืนยันด้วย
// globalThis.__ADD_DOC_CALLS__.length === 0 แบบเดียวกับรอบ 119
//
// **ไม่มีเทส "saveSettings() reject"** ด้วยเหตุผลเดียวกับทุกไฟล์ก่อนหน้าที่ใช้ saveSettings():
// firebase-stub-loader.mjs ไม่มีช่องทางสั่งให้ setDoc() throw ได้เลย (มีแค่ __ADD_DOC_STUB__/
// __UPDATE_DOC_STUB__ สำหรับ addDoc()/updateDoc() เท่านั้น)
//
// ตรวจโค้ดจริงทั้งไฟล์ js/admin-settings-team.js ก่อนเขียนเทสนี้ (143 บรรทัด อ่านครบ) — ไม่พบบั๊ก
// จึงเป็นไฟล์เทสล้วนๆ ไม่มีการแก้โค้ดผลิตภัณฑ์เลยแม้แต่บรรทัดเดียว ไม่ต้องแก้ infra เทสไฟล์ไหนเลย
// ในรอบนี้

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
let mod;      // admin-settings-team.js exports
let leadsMod; // admin-leads.js exports (allLeads state, startLeadsListener)

// ยิง fake realtime snapshot ไปที่ collection "leads" (แพทเทิร์นเดียวกับ test/admin-leads.test.mjs
// รอบ 123 / test/admin-leads-actions.test.mjs รอบ 124 — startLeadsListener() ต้องถูกเรียกก่อน
// ครั้งเดียว ผูก listener ไว้ทั้งไฟล์เทส)
function triggerLeadsSnapshot(leads) {
  const cb = globalThis.__SNAPSHOT_LISTENERS__ && globalThis.__SNAPSHOT_LISTENERS__["leads"];
  if (typeof cb !== "function") throw new Error("leads snapshot listener ยังไม่ได้ลงทะเบียน");
  cb({ docs: leads.map(l => ({ id: l.id, data: () => { const { id, ...rest } = l; return rest; } })) });
}

function makeLead(overrides) {
  return {
    id: "l-1", name: "สมชาย ใจดี", email: "somchai@example.com", tel: "0812345678",
    company: "บริษัท ทดสอบ", service: "ป้ายไฟ LED", message: "สนใจขอใบเสนอราคาด่วน",
    source: "inline_contact", status: "new", assignee: "", notes: "",
    createdAt: { toMillis: () => Date.now() },
    ...overrides
  };
}

function field(id) { return document.getElementById(id); }
function chips() { return Array.from(document.querySelectorAll("#ad-team-list .ad-team-chip")); }
function removeBtn(name) { return document.querySelector(`.ad-team-remove[data-name="${name}"]`); }
function assigneeOptions() {
  const sel = document.getElementById("ad-l-filter-assignee");
  return sel ? Array.from(sel.options).map(o => o.value) : [];
}

function resetFirebaseCalls() {
  globalThis.__SET_DOC_CALLS__ = [];
  globalThis.__ADD_DOC_CALLS__ = [];
}

// helper: รอ microtask queue ระบาย (สำหรับ async event handler ที่ไม่มี promise ให้ await ตรงๆ)
function flushMicrotasks() {
  return new Promise((r) => setTimeout(r, 0));
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

  leadsMod = await import("../js/admin-leads.js");
  mod = await import("../js/admin-settings-team.js");

  // startLeadsListener() ผูก listener collection "leads" ไว้ครั้งเดียวทั้งไฟล์เทส (module-private
  // state ไม่มี stop/reset export — แพทเทิร์นเดียวกับรอบ 123/124)
  globalThis.__SNAPSHOT_LISTENERS__ = {};
  leadsMod.startLeadsListener();
});

beforeEach(() => {
  resetFirebaseCalls();
  field("ad-team-input").value = "";
  field("ad-lead-reminder-days").value = "";
  document.querySelectorAll(".cp-toast-wrap .cp-toast").forEach(el => el.remove());
  const confirmOverlay = document.querySelector(".cp-confirm-overlay");
  if (confirmOverlay && confirmOverlay.style.display === "flex") {
    confirmOverlay.querySelector("#cp-confirm-cancel").click();
  }
  // allLeads ว่างเปล่าก่อนทุกเทส (ทดสอบ "ในตัวเอง" จะยิง snapshot ใหม่ทับตามต้องการ)
  triggerLeadsSnapshot([]);
  mod.renderTeamSettings(null); // เคลียร์กลับสถานะว่างก่อนทุกเทส
});

describe("renderTeamSettings(settings) — สถานะว่างเปล่า/ค่าเริ่มต้น", () => {
  test("settings เป็น null → รายชื่อว่าง, ข้อความ 'ยังไม่มีรายชื่อ', leadReminderDays=3 (ดีฟอลต์), leadAssignRoundRobinIndex=-1", () => {
    mod.renderTeamSettings(null);
    assert.equal(chips().length, 0);
    assert.match(field("ad-team-list").innerHTML, /ยังไม่มีรายชื่อ/);
    assert.equal(mod.leadReminderDays, 3);
    assert.equal(field("ad-lead-reminder-days").value, "3");
    assert.equal(mod.leadAssignRoundRobinIndex, -1);
    assert.deepEqual(mod.currentTeamMembers, []);
  });

  test("settings เป็น undefined → เหมือนกับ null ทุกประการ ไม่ throw", () => {
    assert.doesNotThrow(() => mod.renderTeamSettings(undefined));
    assert.equal(chips().length, 0);
    assert.equal(mod.leadReminderDays, 3);
  });

  test("settings.teamMembers ไม่ใช่ array → ถือเป็นว่างเปล่า", () => {
    mod.renderTeamSettings({ teamMembers: "ไม่ใช่ array" });
    assert.equal(chips().length, 0);
    assert.deepEqual(mod.currentTeamMembers, []);
  });
});

describe("renderTeamSettings(settings) — render รายชื่อปกติ", () => {
  test("แสดงชิปครบทุกชื่อ พร้อมปุ่มลบต่อชื่อ (data-name ตรง)", () => {
    mod.renderTeamSettings({ teamMembers: ["สมชาย", "สมหญิง"] });
    const cs = chips();
    assert.equal(cs.length, 2);
    assert.match(cs[0].textContent, /สมชาย/);
    assert.match(cs[1].textContent, /สมหญิง/);
    assert.ok(removeBtn("สมชาย"));
    assert.ok(removeBtn("สมหญิง"));
    assert.doesNotMatch(field("ad-team-list").innerHTML, /ยังไม่มีรายชื่อ/);
  });

  test("escapeHtml กัน XSS ในชื่อ (ทั้งข้อความในชิปและ data-name attribute)", () => {
    mod.renderTeamSettings({ teamMembers: ['<script>x</script>"><img>'] });
    assert.equal(document.querySelectorAll("#ad-team-list script").length, 0);
    assert.equal(chips().length, 1);
  });

  test("currentTeamMembers/getTeamMembers() สะท้อนรายชื่อล่าสุด (เก็บ reference เดียวกัน)", () => {
    mod.renderTeamSettings({ teamMembers: ["เอ", "บี"] });
    assert.deepEqual(mod.currentTeamMembers, ["เอ", "บี"]);
    assert.deepEqual(mod.getTeamMembers(), ["เอ", "บี"]);
    assert.equal(mod.getTeamMembers(), mod.currentTeamMembers);
  });

  test("เรียกซ้ำสองครั้งด้วยข้อมูลต่างกัน → สถานะล่าสุดทับของเก่าหมด ไม่ค้าง", () => {
    mod.renderTeamSettings({ teamMembers: ["เอ", "บี", "ซี"] });
    mod.renderTeamSettings({ teamMembers: ["ดี"] });
    assert.equal(chips().length, 1);
    assert.match(chips()[0].textContent, /ดี/);
  });

  test("เรียก fillAssigneeSelects() จริง — dropdown ad-l-filter-assignee มีรายชื่อทีมงานใหม่", () => {
    mod.renderTeamSettings({ teamMembers: ["เอ", "บี"] });
    const opts = assigneeOptions();
    assert.ok(opts.includes("เอ"));
    assert.ok(opts.includes("บี"));
  });

  test("เรียก renderLeads() จริง — ไม่ throw แม้ไม่มีลีดเลย", () => {
    assert.doesNotThrow(() => mod.renderTeamSettings({ teamMembers: ["เอ"] }));
  });
});

describe("renderTeamSettings(settings) — leadReminderDays", () => {
  test("ค่าเลขบวกที่ถูกต้อง → ใช้ค่านั้นตรงๆ", () => {
    mod.renderTeamSettings({ leadReminderDays: 7 });
    assert.equal(mod.leadReminderDays, 7);
    assert.equal(field("ad-lead-reminder-days").value, "7");
  });

  test("ไม่มีฟิลด์นี้เลย → fallback เป็นดีฟอลต์ 3", () => {
    mod.renderTeamSettings({ teamMembers: ["เอ"] });
    assert.equal(mod.leadReminderDays, 3);
  });

  test("ค่า 0 → ไม่ผ่านเงื่อนไข >0 → fallback เป็นดีฟอลต์ 3", () => {
    mod.renderTeamSettings({ leadReminderDays: 0 });
    assert.equal(mod.leadReminderDays, 3);
  });

  test("ค่าติดลบ → fallback เป็นดีฟอลต์ 3", () => {
    mod.renderTeamSettings({ leadReminderDays: -5 });
    assert.equal(mod.leadReminderDays, 3);
  });

  test("ค่าที่ไม่ใช่ finite number (NaN/string) → fallback เป็นดีฟอลต์ 3", () => {
    mod.renderTeamSettings({ leadReminderDays: "abc" });
    assert.equal(mod.leadReminderDays, 3);
    mod.renderTeamSettings({ leadReminderDays: NaN });
    assert.equal(mod.leadReminderDays, 3);
  });
});

describe("renderTeamSettings(settings) — leadAssignRoundRobinIndex", () => {
  test("ค่า finite number ที่ถูกต้อง (รวม 0) → ใช้ค่านั้นตรงๆ", () => {
    mod.renderTeamSettings({ leadAssignRoundRobinIndex: 0 });
    assert.equal(mod.leadAssignRoundRobinIndex, 0);
    mod.renderTeamSettings({ leadAssignRoundRobinIndex: 4 });
    assert.equal(mod.leadAssignRoundRobinIndex, 4);
  });

  test("ไม่มีฟิลด์นี้เลย/ค่าไม่ใช่ finite number → fallback เป็น -1", () => {
    mod.renderTeamSettings({ teamMembers: ["เอ"] });
    assert.equal(mod.leadAssignRoundRobinIndex, -1);
    mod.renderTeamSettings({ leadAssignRoundRobinIndex: "abc" });
    assert.equal(mod.leadAssignRoundRobinIndex, -1);
  });
});

describe("setLeadAssignRoundRobinIndex(v)", () => {
  test("อัปเดต leadAssignRoundRobinIndex ทันที (ก่อน await ด้วยซ้ำ) + เรียก saveSettings() ผ่าน setDoc('settings/main', {..}, {merge:true})", async () => {
    const p = mod.setLeadAssignRoundRobinIndex(3);
    assert.equal(mod.leadAssignRoundRobinIndex, 3); // sync assignment ก่อน await ข้างในฟังก์ชัน
    await p;
    assert.equal(globalThis.__SET_DOC_CALLS__.length, 1);
    assert.equal(globalThis.__SET_DOC_CALLS__[0].path, "settings/main");
    assert.deepEqual(globalThis.__SET_DOC_CALLS__[0].payload, { leadAssignRoundRobinIndex: 3 });
    assert.deepEqual(globalThis.__SET_DOC_CALLS__[0].options, { merge: true });
  });

  test("เรียกซ้ำหลายครั้ง → setDoc() ถูกเรียกทุกครั้งตามจำนวน", async () => {
    await mod.setLeadAssignRoundRobinIndex(1);
    await mod.setLeadAssignRoundRobinIndex(2);
    assert.equal(globalThis.__SET_DOC_CALLS__.length, 2);
    assert.equal(mod.leadAssignRoundRobinIndex, 2);
  });
});

describe("ฟอร์มเพิ่มชื่อทีมงาน (#ad-team-form)", () => {
  beforeEach(() => {
    mod.renderTeamSettings({ teamMembers: ["เอ"] });
  });

  test("ชื่อว่างเปล่า (trim แล้วว่าง) → return ทันที ไม่เรียก saveSettings()", async () => {
    field("ad-team-input").value = "   ";
    field("ad-team-form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await flushMicrotasks();
    assert.equal(globalThis.__SET_DOC_CALLS__.length, 0);
    assert.deepEqual(mod.currentTeamMembers, ["เอ"]);
  });

  test("ชื่อซ้ำกับที่มีอยู่แล้ว → เคลียร์ช่อง input แต่ไม่เรียก saveSettings()", async () => {
    field("ad-team-input").value = "เอ";
    field("ad-team-form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await flushMicrotasks();
    assert.equal(globalThis.__SET_DOC_CALLS__.length, 0);
    assert.equal(field("ad-team-input").value, "");
    assert.deepEqual(mod.currentTeamMembers, ["เอ"]);
  });

  test("ชื่อใหม่ (trim แล้ว) → saveSettings() ถูกเรียกด้วย teamMembers ที่เพิ่มชื่อใหม่ต่อท้าย, currentTeamMembers อัปเดต, ช่อง input เคลียร์, ชิปใหม่โผล่ในตาราง", async () => {
    field("ad-team-input").value = "  บี  ";
    field("ad-team-form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await flushMicrotasks();
    assert.equal(globalThis.__SET_DOC_CALLS__.length, 1);
    assert.equal(globalThis.__SET_DOC_CALLS__[0].path, "settings/main");
    assert.deepEqual(globalThis.__SET_DOC_CALLS__[0].payload, { teamMembers: ["เอ", "บี"] });
    assert.deepEqual(globalThis.__SET_DOC_CALLS__[0].options, { merge: true });
    assert.deepEqual(mod.currentTeamMembers, ["เอ", "บี"]);
    assert.equal(field("ad-team-input").value, "");
    assert.equal(chips().length, 2);
  });

  test("ระหว่างบันทึก ปุ่ม submit ถูก disable (เช็คทันทีก่อน microtask resolve) แล้วกลับมา enable หลังเสร็จ", async () => {
    const btn = field("ad-team-form").querySelector('button[type=submit]');
    field("ad-team-input").value = "บี";
    field("ad-team-form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    assert.equal(btn.disabled, true);
    await flushMicrotasks();
    await flushMicrotasks();
    assert.equal(btn.disabled, false);
  });

  test("logAudit() ถูกเรียกจากภายใน handler แต่ auth.currentUser เป็น null (ค่าเริ่มต้นของ stub) จึง exit เงียบๆ — ไม่มี addDoc(\"auditLog\") เกิดขึ้น", async () => {
    field("ad-team-input").value = "บี";
    field("ad-team-form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await flushMicrotasks();
    assert.equal(globalThis.__ADD_DOC_CALLS__.length, 0);
  });
});

describe("ลบชื่อทีมงาน (.ad-team-remove ใน #ad-team-list)", () => {
  beforeEach(() => {
    mod.renderTeamSettings({ teamMembers: ["เอ", "บี"] });
  });

  test("คลิกในกล่องแต่ไม่ใช่ปุ่มลบ → ไม่มีอะไรเกิดขึ้น", async () => {
    field("ad-team-list").dispatchEvent(new Event("click", { bubbles: true }));
    await flushMicrotasks();
    assert.equal(globalThis.__SET_DOC_CALLS__.length, 0);
    assert.equal(chips().length, 2);
  });

  test("ลบชื่อที่ไม่มีลีดผูกอยู่เลย (allLeads ว่าง) → ไม่เปิด confirmDialog เลย ลบทันที", async () => {
    // allLeads ว่างอยู่แล้วจาก beforeEach ของไฟล์ (triggerLeadsSnapshot([]))
    removeBtn("เอ").dispatchEvent(new Event("click", { bubbles: true }));
    await flushMicrotasks();
    // confirmDialog() สร้าง .cp-confirm-overlay แบบ lazy (ครั้งแรกที่ถูกเรียกเท่านั้น) — ถ้ายังไม่
    // เคยถูกเรียกเลยตั้งแต่ต้นไฟล์เทส element นี้จะยังไม่มีอยู่ใน DOM เลย ถือว่าไม่เปิด popup แน่นอน
    const co = document.querySelector(".cp-confirm-overlay");
    assert.notEqual(co && co.style.display, "flex", "ไม่ควรมี popup ยืนยันเลยเพราะไม่มีลีดผูกอยู่");
    assert.equal(globalThis.__SET_DOC_CALLS__.length, 1);
    assert.deepEqual(globalThis.__SET_DOC_CALLS__[0].payload, { teamMembers: ["บี"] });
    assert.deepEqual(mod.currentTeamMembers, ["บี"]);
  });

  test("ลบชื่อที่มีลีดผูกอยู่จริง (assignee ตรงกัน) → เปิด confirmDialog ข้อความเตือนมีชื่อ + คำว่า 'ยังมีลีด'", async () => {
    triggerLeadsSnapshot([makeLead({ id: "l-1", assignee: "เอ" })]);
    removeBtn("เอ").dispatchEvent(new Event("click", { bubbles: true }));
    await flushMicrotasks();
    const co = document.querySelector(".cp-confirm-overlay");
    assert.equal(co.style.display, "flex");
    assert.match(co.querySelector("#cp-confirm-msg").textContent, /"เอ"/);
    assert.match(co.querySelector("#cp-confirm-msg").textContent, /ยังมีลีดที่มอบหมายไว้อยู่/);
  });

  test("มีลีดผูกอยู่ + กด 'ยกเลิก' บน confirm → ไม่ลบ, ชิปยังอยู่ครบ", async () => {
    triggerLeadsSnapshot([makeLead({ id: "l-1", assignee: "เอ" })]);
    removeBtn("เอ").dispatchEvent(new Event("click", { bubbles: true }));
    await flushMicrotasks();
    document.querySelector("#cp-confirm-cancel").click();
    await flushMicrotasks();
    assert.equal(globalThis.__SET_DOC_CALLS__.length, 0);
    assert.equal(chips().length, 2);
  });

  test("มีลีดผูกอยู่ + กด 'ยืนยัน' บน confirm → ลบจริง saveSettings() ถูกเรียกด้วยรายชื่อที่กรองออกแล้ว", async () => {
    triggerLeadsSnapshot([makeLead({ id: "l-1", assignee: "เอ" })]);
    removeBtn("เอ").dispatchEvent(new Event("click", { bubbles: true }));
    await flushMicrotasks();
    document.querySelector("#cp-confirm-ok").click();
    await flushMicrotasks();
    assert.equal(globalThis.__SET_DOC_CALLS__.length, 1);
    assert.deepEqual(globalThis.__SET_DOC_CALLS__[0].payload, { teamMembers: ["บี"] });
    assert.equal(chips().length, 1);
  });

  test("ลบชื่อที่ไม่ตรงกับ assignee ของลีดใดๆ เลย (มีลีดแต่ assignee เป็นคนอื่น) → ไม่เปิด confirm ลบทันที", async () => {
    triggerLeadsSnapshot([makeLead({ id: "l-1", assignee: "บี" })]);
    removeBtn("เอ").dispatchEvent(new Event("click", { bubbles: true }));
    await flushMicrotasks();
    const co = document.querySelector(".cp-confirm-overlay");
    assert.notEqual(co && co.style.display, "flex");
    assert.equal(globalThis.__SET_DOC_CALLS__.length, 1);
  });
});

describe("ฟอร์มตั้งค่าแจ้งเตือนลีดค้างนาน (#ad-lead-reminder-form)", () => {
  beforeEach(() => {
    mod.renderTeamSettings({ leadReminderDays: 3 });
  });

  test("ค่าว่างเปล่า → showToast() แจ้งข้อผิดพลาด ไม่เรียก saveSettings() ไม่เปลี่ยน leadReminderDays", async () => {
    field("ad-lead-reminder-days").value = "";
    field("ad-lead-reminder-form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await flushMicrotasks();
    assert.equal(globalThis.__SET_DOC_CALLS__.length, 0);
    assert.equal(mod.leadReminderDays, 3);
    const toast = document.querySelector(".cp-toast-wrap .cp-toast");
    assert.ok(toast);
    assert.match(toast.textContent, /มากกว่า 0/);
  });

  test("ค่า 0 → showToast() แจ้งข้อผิดพลาด ไม่บันทึก", async () => {
    field("ad-lead-reminder-days").value = "0";
    field("ad-lead-reminder-form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await flushMicrotasks();
    assert.equal(globalThis.__SET_DOC_CALLS__.length, 0);
    assert.equal(mod.leadReminderDays, 3);
  });

  test("ค่าติดลบ → showToast() แจ้งข้อผิดพลาด ไม่บันทึก", async () => {
    field("ad-lead-reminder-days").value = "-2";
    field("ad-lead-reminder-form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await flushMicrotasks();
    assert.equal(globalThis.__SET_DOC_CALLS__.length, 0);
    assert.equal(mod.leadReminderDays, 3);
  });

  test("ค่าที่ไม่ใช่ตัวเลข → showToast() แจ้งข้อผิดพลาด ไม่บันทึก", async () => {
    field("ad-lead-reminder-days").value = "abc";
    field("ad-lead-reminder-form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await flushMicrotasks();
    assert.equal(globalThis.__SET_DOC_CALLS__.length, 0);
    assert.equal(mod.leadReminderDays, 3);
  });

  test("ค่าถูกต้อง (จำนวนเต็มบวก) → saveSettings() ถูกเรียกด้วย {leadReminderDays: N}, leadReminderDays export อัปเดตทันที, showToast สำเร็จ", async () => {
    field("ad-lead-reminder-days").value = "10";
    field("ad-lead-reminder-form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await flushMicrotasks();
    assert.equal(globalThis.__SET_DOC_CALLS__.length, 1);
    assert.equal(globalThis.__SET_DOC_CALLS__[0].path, "settings/main");
    assert.deepEqual(globalThis.__SET_DOC_CALLS__[0].payload, { leadReminderDays: 10 });
    assert.deepEqual(globalThis.__SET_DOC_CALLS__[0].options, { merge: true });
    assert.equal(mod.leadReminderDays, 10);
    const toast = document.querySelector(".cp-toast-wrap .cp-toast");
    assert.ok(toast);
    assert.match(toast.textContent, /บันทึกแล้ว/);
    assert.equal(toast.classList.contains("success"), true);
  });

  test("ระหว่างบันทึก ปุ่ม submit ถูก disable (เช็คทันทีก่อน microtask resolve) แล้วกลับมา enable หลังเสร็จ", async () => {
    const btn = field("ad-lead-reminder-form").querySelector('button[type=submit]');
    field("ad-lead-reminder-days").value = "5";
    field("ad-lead-reminder-form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    assert.equal(btn.disabled, true);
    await flushMicrotasks();
    await flushMicrotasks();
    assert.equal(btn.disabled, false);
  });

  test("ค่าถูกต้อง → เรียก renderLeads() ต่อท้ายด้วย (ไม่ throw แม้ allLeads ว่าง)", async () => {
    field("ad-lead-reminder-days").value = "5";
    await assert.doesNotReject(async () => {
      field("ad-lead-reminder-form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await flushMicrotasks();
    });
  });
});
