// test/admin-leads-automation.test.mjs — รอบที่ 126
//
// ขอบเขต: js/admin-leads-automation.js (60 บรรทัด) — CRM automation (Phase 3): auto-assign ลีดใหม่
// แบบ round-robin ให้ทีมขายที่ active เท่านั้น ไฟล์นี้ไม่ export อะไรเลย (เหมือน
// admin-overview-today.js/admin-global-search.js/admin-keyboard-shortcuts.js) — ผูก listener ของ
// ตัวเองผ่าน onNewLeadsArrived() (export จาก admin-leads.js) ตอนโหลดไฟล์ครั้งแรก (module
// side-effect ตอน import) จึงเทสผ่าน "ผลลัพธ์ปลายทาง" ล้วนๆ (globalThis.__UPDATE_DOC_CALLS__ /
// __SET_DOC_CALLS__ จาก firebase-stub-loader.mjs) ไม่มี public API ให้เรียกตรง
//
// **ลองนำเข้าตรงในสภาพแวดล้อมเทสก่อนเขียนเทสตามที่ตกลงไว้ทุกรอบ**: import ผ่านสำเร็จทันที ไม่ติด
// circular/ต้องขยาย stub ใดๆ เลย เพราะไฟล์นี้ import เฉพาะ db.js (logAudit)/db-orders.js
// (updateLeadAssignee)/admin-leads.js (onNewLeadsArrived — ตัวไฟล์นั้นเองก็ import ได้แล้วตั้งแต่
// รอบ 123 ผ่าน admin-overview-dashboard-stub-loader.mjs ที่ขยายไว้แล้ว)/admin-settings-team.js
// (currentTeamMembers/leadAssignRoundRobinIndex/setLeadAssignRoundRobinIndex — import ได้ตรงตั้งแต่
// รอบ 125) — ไม่มีไฟล์ไหนในสายนี้ที่พังตอน module evaluate เลย
//
// **สถาปัตยกรรมเทส**: import admin-leads-automation.js เข้ามาครั้งเดียว (side-effect ผูก
// onNewLeadsArrived(handleNewLeads) ทันที — เป็น singleton ใน admin-leads.js ผูกได้ทีเดียว ไม่ต้อง
// ผูกซ้ำ) แล้วขับเคลื่อนการทดสอบทั้งหมดผ่าน "ลีดใหม่จริงๆ เข้ามา" จริง: เรียก
// leadsMod.startLeadsListener() ครั้งเดียวใน before() แล้วยิง fake realtime snapshot ผ่าน
// triggerLeadsSnapshot() (แพทเทิร์นเดียวกับรอบ 123/124/125) — snapshot แรกสุดของทั้งไฟล์เทส
// (beforeEach ไม่ล้าง firstSnapshot/knownLeadIds เพราะเป็น module-private ใน admin-leads.js ไม่มี
// setter/reset ให้) ทำหน้าที่เป็น "baseline" (ไม่ trigger auto-assign แน่นอน ตามพฤติกรรมของ
// admin-leads.js เอง) — เทสถัดๆ ไปยิง snapshot ใหม่ที่มี id เพิ่มจาก snapshot ก่อนหน้าเสมอ เพื่อให้
// เข้าเงื่อนไข "ใหม่จริงๆ"
//
// ตั้งค่า currentTeamMembers/leadAssignRoundRobinIndex ผ่าน teamMod.renderTeamSettings(settings)
// เท่านั้น (ฟังก์ชัน public ของ admin-settings-team.js เอง ไม่มี setter ตรงๆ ให้ต่างหาก — แพทเทิร์น
// เดียวกับรอบ 123/125)
//
// **จุดสำคัญที่ต้องระวัง — handleNewLeads() ประมวลผลทีละรายการ "ตามลำดับ" ผ่าน reduce chain**
// (อ่านโค้ดจริงยืนยันแล้ว ไม่ใช่ Promise.all พร้อมกัน) เพื่อกัน race condition ของ
// leadAssignRoundRobinIndex — เทส "ลีดใหม่หลายใบมาพร้อมกันใน snapshot เดียว" ต้อง await
// flushMicrotasks() หลายรอบ (reduce chain มีความยาว = จำนวนลีด แต่ละ .then() เป็น microtask ใหม่)
// ถึงจะเห็นผลลัพธ์ครบทุกใบ — ใช้ flushMicrotasks() ซ้ำในลูปแทนการเดาจำนวนรอบตายตัว (กันเทส flaky
// ถ้าจำนวนลีดในเทสเปลี่ยนในอนาคต)
//
// updateLeadAssignee() (js/db-orders.js) เรียก updateDoc() ตรงๆ — capture ผ่าน
// globalThis.__UPDATE_DOC_CALLS__ (ไม่ gate ด้วย flag อยู่แล้วในสตับเดิม) — จำลอง "auto-assign
// ล้มเหลว" ผ่าน globalThis.__UPDATE_DOC_STUB__ (รอบ 121 เพิ่มไว้แล้ว รองรับ { throw: err }) เพื่อ
// ยืนยันว่า catch ในไฟล์จริงทำงาน (ไม่ throw ทะลุออกมา, ไม่เรียก setLeadAssignRoundRobinIndex ต่อ
// เพราะอยู่หลัง updateLeadAssignee() ในบล็อก try เดียวกัน)
//
// logAudit() เช็ค auth.currentUser ก่อนเสมอ ซึ่ง firebase-stub-loader.mjs คืน { currentUser: null }
// เป็นค่าเริ่มต้นเสมอ จึง exit เงียบๆ ไม่มี addDoc("auditLog") เกิดขึ้นจริงในทุกเทสของไฟล์นี้ (ยืนยัน
// ด้วย globalThis.__ADD_DOC_CALLS__.length === 0 แบบเดียวกับรอบ 119/125) — ไม่ได้ตั้ง auth.currentUser
// ปลอมเพิ่มเพราะไม่มีที่ไหนในไฟล์นี้ตรวจผล logAudit() โดยตรง (fire-and-forget ไม่ await)
//
// ตรวจโค้ดจริงทั้งไฟล์ js/admin-leads-automation.js ก่อนเขียนเทสนี้ (60 บรรทัด อ่านครบ) — ไม่พบบั๊ก
// ไม่มีการแก้โค้ดผลิตภัณฑ์เลยแม้แต่บรรทัดเดียว ไม่ต้องแก้ infra เทสไฟล์ไหนเลยในรอบนี้ (เทสไฟล์ใหม่ล้วนๆ)

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
let leadsMod; // admin-leads.js exports (startLeadsListener)
let teamMod;  // admin-settings-team.js exports (renderTeamSettings)

// ยิง fake realtime snapshot ไปที่ collection "leads" (แพทเทิร์นเดียวกับรอบ 123/124/125)
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

// **สำคัญ**: knownLeadIds ใน admin-leads.js เป็น module-private, ไม่มี reset ให้เทส — แต่ละ
// snapshot คำนวณ "ใหม่จริงๆ" เทียบกับ id ชุดล่าสุดที่เคยเห็น (ไม่ใช่สะสมทุก snapshot ที่ผ่านมา) แค่ละ
// เทสในไฟล์นี้จึงต้องใช้ id ที่ไม่ซ้ำกับ snapshot ก่อนหน้าเลยตลอดทั้งไฟล์ (กันชนกับ "ชุดที่เคยเห็น
// ล่าสุด" โดยไม่ตั้งใจ ไม่ว่าลำดับเทสจะถูกสลับในอนาคตหรือไม่) — ใช้ตัวนับ global สร้าง id ใหม่เสมอ
let idCounter = 0;
function freshId(prefix) { return `${prefix}-${++idCounter}`; }

function resetFirebaseCalls() {
  globalThis.__UPDATE_DOC_CALLS__ = [];
  globalThis.__SET_DOC_CALLS__ = [];
  globalThis.__ADD_DOC_CALLS__ = [];
  globalThis.__UPDATE_DOC_STUB__ = undefined;
}

function flushMicrotasks() {
  return new Promise((r) => setTimeout(r, 0));
}
async function flushMany(times) {
  for (let i = 0; i < times; i++) await flushMicrotasks();
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
  teamMod = await import("../js/admin-settings-team.js");
  await import("../js/admin-leads-automation.js"); // side-effect: onNewLeadsArrived(handleNewLeads)

  // startLeadsListener() มี leadsStarted (module-private) เรียกได้จริงแค่ครั้งเดียวตลอดไฟล์เทสนี้
  globalThis.__SNAPSHOT_LISTENERS__ = {};
  leadsMod.startLeadsListener();

  // snapshot แรกสุด = baseline (ไม่ trigger auto-assign ตามพฤติกรรมของ admin-leads.js เอง —
  // ข้าม firstSnapshot เสมอ ไม่ว่า id ไหนอยู่ในนั้นก็ตาม) — ใช้ id ที่ไม่ชนกับเทสไหนต่อไป
  triggerLeadsSnapshot([makeLead({ id: "seed-baseline", assignee: "" })]);
});

beforeEach(() => {
  resetFirebaseCalls();
  teamMod.renderTeamSettings({ teamMembers: [], leadAssignRoundRobinIndex: -1 });
});

describe("ไม่มีทีมขาย active เลย (currentTeamMembers ว่าง)", () => {
  test("ลีดใหม่เข้ามา → ไม่เรียก updateLeadAssignee/setLeadAssignRoundRobinIndex เลย (ข้ามเงียบๆ ไม่ throw)", async () => {
    triggerLeadsSnapshot([makeLead({ id: freshId("na"), assignee: "" }), makeLead({ id: freshId("na"), assignee: "" })]);
    await flushMany(3);
    assert.equal(globalThis.__UPDATE_DOC_CALLS__.length, 0);
    assert.equal(globalThis.__SET_DOC_CALLS__.length, 0);
  });
});

describe("round-robin ปกติ — มีทีมขาย active", () => {
  beforeEach(() => {
    teamMod.renderTeamSettings({ teamMembers: ["เอ", "บี", "ซี"], leadAssignRoundRobinIndex: -1 });
  });

  test("ลีดใหม่ 1 ใบ → มอบหมายให้คนแรก (index (-1+1)%3=0 = 'เอ') ผ่าน updateDoc('leads/<id>', {assignee:'เอ'})", async () => {
    const id = freshId("rr-first");
    triggerLeadsSnapshot([makeLead({ id, assignee: "" })]);
    await flushMany(3);
    assert.equal(globalThis.__UPDATE_DOC_CALLS__.length, 1);
    assert.equal(globalThis.__UPDATE_DOC_CALLS__[0].path, `leads/${id}`);
    assert.deepEqual(globalThis.__UPDATE_DOC_CALLS__[0].payload, { assignee: "เอ" });
  });

  test("setLeadAssignRoundRobinIndex ถูกเรียกจริง → leadAssignRoundRobinIndex เดินหน้าเป็น 0 + setDoc('settings/main', {leadAssignRoundRobinIndex:0})", async () => {
    triggerLeadsSnapshot([makeLead({ id: freshId("rr-idx"), assignee: "" })]);
    await flushMany(3);
    assert.equal(teamMod.leadAssignRoundRobinIndex, 0);
    assert.equal(globalThis.__SET_DOC_CALLS__.length, 1);
    assert.deepEqual(globalThis.__SET_DOC_CALLS__[0].payload, { leadAssignRoundRobinIndex: 0 });
  });

  test("เรียกต่อรอบที่สอง (index เดินต่อจากเดิม ไม่รีเซ็ตกลับ 0) → คนถัดไป 'บี' (index 1)", async () => {
    triggerLeadsSnapshot([makeLead({ id: freshId("rr-seq"), assignee: "" })]);
    await flushMany(3);
    assert.equal(globalThis.__UPDATE_DOC_CALLS__[0].payload.assignee, "เอ");

    resetFirebaseCalls();
    const id2 = freshId("rr-seq");
    triggerLeadsSnapshot([makeLead({ id: id2, assignee: "" })]);
    await flushMany(3);
    assert.equal(globalThis.__UPDATE_DOC_CALLS__.length, 1);
    assert.equal(globalThis.__UPDATE_DOC_CALLS__[0].path, `leads/${id2}`);
    assert.deepEqual(globalThis.__UPDATE_DOC_CALLS__[0].payload, { assignee: "บี" });
  });

  test("วนกลับคนแรกเมื่อครบรอบ (wrap-around): ตั้ง index เริ่มที่ 2 (คนสุดท้าย 'ซี') → คนถัดไปวนกลับเป็น 'เอ' (index 0)", async () => {
    teamMod.renderTeamSettings({ teamMembers: ["เอ", "บี", "ซี"], leadAssignRoundRobinIndex: 2 });
    triggerLeadsSnapshot([makeLead({ id: freshId("rr-wrap"), assignee: "" })]);
    await flushMany(3);
    assert.equal(globalThis.__UPDATE_DOC_CALLS__.length, 1);
    assert.deepEqual(globalThis.__UPDATE_DOC_CALLS__[0].payload, { assignee: "เอ" });
    assert.equal(teamMod.leadAssignRoundRobinIndex, 0);
  });

  test("ลีดใหม่หลายใบมาพร้อมกันใน snapshot เดียว → ประมวลผลตามลำดับทีละใบ (ไม่ใช่ Promise.all พร้อมกัน) แต่ละใบได้คนถัดไปเดินหน้าตามลำดับ ไม่ซ้ำคนเดิม", async () => {
    const idA = freshId("rr-multi"), idB = freshId("rr-multi"), idC = freshId("rr-multi");
    triggerLeadsSnapshot([
      makeLead({ id: idA, assignee: "" }),
      makeLead({ id: idB, assignee: "" }),
      makeLead({ id: idC, assignee: "" })
    ]);
    await flushMany(6);
    assert.equal(globalThis.__UPDATE_DOC_CALLS__.length, 3);
    const byPath = Object.fromEntries(globalThis.__UPDATE_DOC_CALLS__.map(c => [c.path, c.payload.assignee]));
    assert.equal(byPath[`leads/${idA}`], "เอ");
    assert.equal(byPath[`leads/${idB}`], "บี");
    assert.equal(byPath[`leads/${idC}`], "ซี");
    // ลำดับการเรียกต้องตรงกับลำดับในอาร์เรย์ (A → B → C) ไม่ใช่แค่ผลลัพธ์สุดท้ายถูกต้องเฉยๆ
    assert.deepEqual(
      globalThis.__UPDATE_DOC_CALLS__.map(c => c.path),
      [`leads/${idA}`, `leads/${idB}`, `leads/${idC}`]
    );
    assert.equal(teamMod.leadAssignRoundRobinIndex, 2);
  });

  test("ลีดที่มี assignee อยู่แล้ว (ไม่ควรเกิดกับลีดใหม่ปกติ แต่กันไว้) → ข้าม ไม่เรียก updateLeadAssignee", async () => {
    triggerLeadsSnapshot([makeLead({ id: freshId("rr-already"), assignee: "คนเดิม" })]);
    await flushMany(3);
    assert.equal(globalThis.__UPDATE_DOC_CALLS__.length, 0);
    assert.equal(globalThis.__SET_DOC_CALLS__.length, 0);
  });

  test("ลีดหลายใบมาพร้อมกัน — บางใบมี assignee อยู่แล้วปนอยู่ → ข้ามเฉพาะใบนั้น ใบอื่นยัง auto-assign ตามลำดับปกติ", async () => {
    const idX = freshId("rr-mix"), idY = freshId("rr-mix"), idZ = freshId("rr-mix");
    triggerLeadsSnapshot([
      makeLead({ id: idX, assignee: "" }),
      makeLead({ id: idY, assignee: "มีอยู่แล้ว" }),
      makeLead({ id: idZ, assignee: "" })
    ]);
    await flushMany(6);
    assert.equal(globalThis.__UPDATE_DOC_CALLS__.length, 2);
    assert.deepEqual(
      globalThis.__UPDATE_DOC_CALLS__.map(c => c.path),
      [`leads/${idX}`, `leads/${idZ}`]
    );
    assert.equal(globalThis.__UPDATE_DOC_CALLS__[0].payload.assignee, "เอ");
    assert.equal(globalThis.__UPDATE_DOC_CALLS__[1].payload.assignee, "บี");
  });

  test("updateLeadAssignee ล้มเหลว (updateDoc throw) → catch ในไฟล์จริงกันไว้ ไม่ throw ทะลุ, ไม่เรียก setLeadAssignRoundRobinIndex ต่อ (index ไม่ขยับ)", async () => {
    globalThis.__UPDATE_DOC_STUB__ = () => ({ throw: new Error("network error จำลอง") });
    triggerLeadsSnapshot([makeLead({ id: freshId("rr-fail"), assignee: "" })]);
    await flushMany(3); // ต้องไม่มี unhandled rejection ทำให้เทสรันนี้ fail
    assert.equal(globalThis.__UPDATE_DOC_CALLS__.length, 1); // ยังเรียก (แล้ว reject) แค่ 1 ครั้ง
    assert.equal(globalThis.__SET_DOC_CALLS__.length, 0);    // ไม่ไปถึงบรรทัด setLeadAssignRoundRobinIndex
    assert.equal(teamMod.leadAssignRoundRobinIndex, -1);      // ค่าเดิมไม่เปลี่ยน
  });

  test("logAudit() ไม่ทำให้พัง แม้ auth.currentUser เป็น null เสมอในสภาพแวดล้อมเทส (exit เงียบๆ ไม่มี addDoc('auditLog'))", async () => {
    triggerLeadsSnapshot([makeLead({ id: freshId("rr-audit"), assignee: "" })]);
    await flushMany(3);
    assert.equal(globalThis.__ADD_DOC_CALLS__.length, 0);
  });
});
