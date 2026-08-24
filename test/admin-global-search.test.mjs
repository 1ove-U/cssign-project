// test/admin-global-search.test.mjs — รอบที่ 128
//
// ขอบเขต: js/admin-global-search.js (247 บรรทัด) — overlay ค้นหาข้ามแท็บ (สินค้า/ลีด/คำสั่งผลิต/
// หมวดหมู่/บทความ) เปิดจากปุ่ม #ad-gs-trigger หรือคีย์ลัด "/" (คีย์ลัดผูกอยู่ที่
// admin-keyboard-shortcuts.js คนละไฟล์ — ไม่อยู่ในขอบเขตไฟล์นี้ ไม่เทสตรงนี้) — ไฟล์นี้**ไม่ export
// อะไรเลย** ผูก event listener เองทั้งหมดตอนโหลดไฟล์ (เหมือน admin-products-csv.js/
// admin-sidebar.js) จึงเทสผ่านการจำลอง event จริง + เช็ค side-effect บน DOM เท่านั้น
//
// infra ที่ใช้ (แชร์กับ test/admin-global-search-jump.test.mjs รอบเดียวกัน — ดูรายละเอียดที่ไฟล์
// นั้น): เพิ่ม "global-search"/"global-search-jump"/"products" เข้า ALLOWED_PARENT_RE ของ
// test/helpers/admin-page-stub-loader.mjs (switchTab จำลองผ่าน globalThis.__AD_PAGE_STUB_SWITCH_TAB__
// ที่มีอยู่แล้วตั้งแต่รอบ 122) — ไม่ต้องใช้ localStorage polyfill (ยืนยันแล้วในรอบนี้ว่า
// admin-sidebar.js ไม่ถูกดึงเข้ามาอีกต่อไปหลัง stub ครอบ admin-page.js ตัวจริงไว้)
//
// จุดที่ตรวจโค้ดจริงก่อนเขียนเทส (อ่านครบทั้งไฟล์ 247 บรรทัด):
// - gsSearch(query): query ว่าง/เว้นวรรคล้วนๆ → ทุก type คืน [] หมด (ไม่ throw) — แต่ละ type กรอง
//   pendingDelete*Ids ออกก่อนเทียบ substring แล้ว .slice(0, 6) ตัดบนสุด — ทุก type case-insensitive
//   (.toLowerCase() ทั้งค่าที่ค้นและ query)
// - gsRender(query): เรียก gsRenderEmpty()/gsRenderNoMatch() ตามเงื่อนไข ก่อน build ผลลัพธ์จริงต่อ
//   group ตามลำดับคงที่เสมอ (สินค้า → ลีด → คำสั่งผลิต → หมวดหมู่ → บทความ) — เฉพาะ group ที่
//   มีผลลัพธ์เท่านั้นที่ขึ้น group label — gsCurrentResults ถูก build ตามลำดับ render จริง (ใช้กับ
//   ลูกศร/Enter ทีหลัง)
// - gsHighlight(text, q): escapeHtml ค่าเสมอก่อน (กัน XSS จาก field ที่มาจากฐานข้อมูล) แล้วค่อยห่อ
//   <mark> รอบคำที่ตรงกับ query (escape query ก่อนสร้าง RegExp ด้วย gsEscRe เพื่อกัน regex พิเศษใน
//   คำค้น เช่น "(" ")" "." ทำให้ throw หรือ match ผิดเพี้ยน)
// - gsOpen()/gsClose(): เรียก openOverlay()/closeOverlay() ของ admin-utils.js จริง (มีเทสของตัวเอง
//   อยู่แล้ว ไม่ทวนซ้ำที่นี่) — gsOpen() เคลียร์ gsInput.value เป็น "" + gsRenderEmpty() ทุกครั้งที่
//   เปิด (แม้เปิดซ้ำหลังเคยพิมพ์ค้างไว้ก่อนปิด) + setTimeout(...,30) โฟกัส gsInput (เทสแค่ว่า
//   focus() ถูกเรียกจริงหลัง 30ms ผ่านไป ไม่ทวนสอบ tab-trap)
// - gsGoTo(result): gsClose() ก่อนเสมอไม่ว่า type ไหน แล้วค่อย dispatch ไปยังฟังก์ชัน jumpTo* ที่
//   ถูกต้องตาม result.type — order เป็น type เดียวที่เรียก switchTab("orders") ตรงๆ ในไฟล์นี้เองก่อน
//   (จาก orders-tab.js) แล้วค่อยเรียก jumpToOrder() ตามด้วย (เพราะ jumpToOrder อยู่ orders-tab.js
//   ไม่ใช่ admin-global-search-jump.js เหมือน type อื่น — คนละไฟล์ต้นทาง) — result null/undefined →
//   early return เงียบๆ ไม่ throw
// - Debounce อินพุต 120ms ผ่าน window.setTimeout/clearTimeout (เทสด้วย real timer จริง await
//   ~150ms แทนการ mock timer — ไฟล์อื่นในโปรเจกต์นี้ก็ทำแบบนี้เสมอไม่มี fake timer)
// - คีย์ลัดในช่องค้นหา (gsInput keydown): ArrowDown/ArrowUp เลื่อน gsActiveIndex แบบ clamp ในขอบเขต
//   [0, length-1] (ไม่วนกลับหัวท้าย), ไม่มีผลลัพธ์เลย → ArrowDown/Up ไม่ throw ไม่ทำอะไร, Enter เลือก
//   gsActiveIndex ปัจจุบัน (>= 0) หรือรายการแรกถ้ายังไม่เคยกด Arrow เลย (gsActiveIndex === -1) ก่อน
//   เสมอ, Escape ปิด overlay (e.preventDefault() ก่อนเสมอ)
// - ไม่พบบั๊กในโค้ดจริง — ไฟล์เทสล้วนๆ ไม่มีการแก้โค้ดผลิตภัณฑ์เลย

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

let document, window;
let stateMod, leadsMod, ordersMod, productsMod, categoriesMod, blogMod;
let switchTabCalls;

function flushMicrotasks() {
  return new Promise((r) => setTimeout(r, 0));
}
function waitDebounce() {
  return new Promise((r) => setTimeout(r, 180)); // debounce ไฟล์นี้ = 120ms
}

function triggerLeadsSnapshot(leads) {
  const cb = globalThis.__SNAPSHOT_LISTENERS__ && globalThis.__SNAPSHOT_LISTENERS__["leads"];
  if (typeof cb !== "function") throw new Error("leads snapshot listener ยังไม่ได้ลงทะเบียน");
  cb({ docs: leads.map(l => ({ id: l.id, data: () => { const { id, ...rest } = l; return rest; } })) });
}
function triggerOrdersSnapshot(orders) {
  const cb = globalThis.__SNAPSHOT_LISTENERS__ && globalThis.__SNAPSHOT_LISTENERS__["orders"];
  if (typeof cb !== "function") throw new Error("orders snapshot listener ยังไม่ได้ลงทะเบียน");
  cb({ docs: orders.map(o => ({ id: o.id, data: () => { const { id, ...rest } = o; return rest; } })) });
}

function gsOverlay() { return document.getElementById("ad-gs-overlay"); }
function gsInput() { return document.getElementById("ad-gs-input"); }
function gsResults() { return document.getElementById("ad-gs-results"); }
function gsCloseBtn() { return document.getElementById("ad-gs-close"); }
function gsTrigger() { return document.getElementById("ad-gs-trigger"); }
function resultRows() { return Array.from(gsResults().querySelectorAll(".ad-gs-result")); }
function groupLabels() { return Array.from(gsResults().querySelectorAll(".ad-gs-group-label")).map(el => el.textContent); }

function typeQuery(q) {
  gsInput().value = q;
  gsInput().dispatchEvent(new window.Event("input", { bubbles: true }));
}

async function search(q) {
  typeQuery(q);
  await waitDebounce();
}

function fireKey(key) {
  gsInput().dispatchEvent(new window.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
}

before(async () => {
  const dom = new JSDOM(`<!doctype html><html><body>${ADMIN_BODY_NO_SCRIPTS}</body></html>`, {
    url: "https://example.test/"
  });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
  globalThis.Event = dom.window.Event;
  globalThis.KeyboardEvent = dom.window.KeyboardEvent;
  globalThis.MouseEvent = dom.window.MouseEvent;
  globalThis.HTMLElement = dom.window.HTMLElement;
  dom.window.HTMLElement.prototype.scrollIntoView = function () {};
  globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);

  switchTabCalls = [];
  globalThis.__AD_PAGE_STUB_SWITCH_TAB__ = (tab) => { switchTabCalls.push(tab); };

  document = dom.window.document;
  window = dom.window;

  stateMod = await import("../js/admin-state.js");
  leadsMod = await import("../js/admin-leads.js");
  ordersMod = await import("../js/orders-tab.js");
  productsMod = await import("../js/admin-products.js");
  categoriesMod = await import("../js/admin-categories.js");
  blogMod = await import("../js/admin-blog.js");
  await import("../js/admin-global-search.js"); // ไม่ export อะไร — โหลดเพื่อผูก listener เท่านั้น

  globalThis.__SNAPSHOT_LISTENERS__ = {};
  leadsMod.startLeadsListener();
  ordersMod.initOrdersTab();
});

beforeEach(() => {
  switchTabCalls = [];
  triggerLeadsSnapshot([]);
  triggerOrdersSnapshot([]);
  stateMod.setAllProducts([]);
  stateMod.setAllCategories([]);
  stateMod.setAllBlogs([]);
  stateMod.pendingDeleteProductIds.clear();
  stateMod.pendingDeleteCategoryIds.clear();
  stateMod.pendingDeleteBlogIds.clear();
  stateMod.pendingDeleteLeadIds.clear();

  // รีเซ็ตสถานะ overlay กลับปิดก่อนทุกเทส (openOverlayCount เป็น module-private ใน admin-utils.js
  // ไม่มีวิธี reset ตรงๆ — ปิดผ่าน gsClose() จริงถ้าค้างเปิดอยู่)
  if (gsOverlay().style.display === "flex") gsCloseBtn().click();
  gsInput().value = "";
});

function seedAllTypes() {
  stateMod.setAllProducts([
    { id: "p-1", name: "ป้ายไฟ LED กล่องไฟ", code: "SIGN-001", cat_id: "c-1" },
    { id: "p-2", name: "ป้ายอะคริลิกใส", code: "SIGN-002", cat_id: "" }
  ]);
  stateMod.setAllCategories([{ id: "c-1", name: "ป้ายไฟ LED", group: "ไฟ", description: "" }]);
  stateMod.setAllBlogs([{ id: "b-1", title: "วิธีเลือกป้ายไฟ LED", category: "ความรู้", status: "published" }]);
  triggerLeadsSnapshot([
    { id: "l-1", name: "สมชาย ใจดี", company: "", email: "somchai@x.com", tel: "0812345678", service: "ป้ายไฟ LED", status: "new", source: "inline_contact", createdAt: { toMillis: () => Date.now() } }
  ]);
  triggerOrdersSnapshot([
    { id: "o-1", code: "PO-0099", customer: "ลูกค้า LED", item: "ป้ายไฟ LED ทางเข้า", qty: 1, status: "received", dueDate: new Date().toISOString().slice(0, 10) }
  ]);
}

describe("เปิด/ปิด overlay", () => {
  test("คลิกปุ่ม trigger เปิด overlay, เคลียร์ gsInput ว่าง, แสดงข้อความ empty state", () => {
    gsInput().value = "ค้างจากรอบก่อน";
    gsTrigger().click();
    assert.equal(gsOverlay().style.display, "flex");
    assert.equal(gsInput().value, "");
    assert.match(gsResults().innerHTML, /พิมพ์เพื่อค้นหา/);
  });

  test("คลิกปุ่มปิด (gsCloseBtn) ปิด overlay", () => {
    gsTrigger().click();
    assert.equal(gsOverlay().style.display, "flex");
    gsCloseBtn().click();
    assert.equal(gsOverlay().style.display, "none");
  });

  test("คลิกพื้นหลัง overlay (นอกกรอบ panel) ปิด overlay — คลิกในกรอบ panel ไม่ปิด", () => {
    gsTrigger().click();
    gsInput().dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    assert.equal(gsOverlay().style.display, "flex", "คลิกในกรอบ panel ต้องไม่ปิด");

    gsOverlay().dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    assert.equal(gsOverlay().style.display, "none");
  });

  test("Escape ในช่องค้นหาปิด overlay", () => {
    gsTrigger().click();
    fireKey("Escape");
    assert.equal(gsOverlay().style.display, "none");
  });

  test("เปิดซ้ำหลังเคยพิมพ์ค้างไว้ก่อนปิดรอบก่อน — เคลียร์ค่าทุกครั้งที่เปิดใหม่", async () => {
    gsTrigger().click();
    await search("ทดสอบ");
    gsCloseBtn().click();

    gsTrigger().click();
    assert.equal(gsInput().value, "");
    assert.match(gsResults().innerHTML, /พิมพ์เพื่อค้นหา/);
  });

  test("focus() ถูกเรียกที่ gsInput หลังเปิด ~30ms", async () => {
    let focused = false;
    gsInput().focus = () => { focused = true; };
    gsTrigger().click();
    assert.equal(focused, false, "ยังไม่ควรโฟกัสทันที (มี delay 30ms)");
    await new Promise(r => setTimeout(r, 60));
    assert.equal(focused, true);
    delete gsInput().focus; // คืนค่าเดิม ไม่กระทบเทสอื่น
  });
});

describe("gsSearch()/gsRender() — ผลลัพธ์ค้นหา", () => {
  test("query ว่างเปล่า/เว้นวรรคล้วนๆ → แสดง empty state ไม่ throw", async () => {
    seedAllTypes();
    gsTrigger().click();
    await search("   ");
    assert.match(gsResults().innerHTML, /พิมพ์เพื่อค้นหา/);
    assert.equal(resultRows().length, 0);
  });

  test("query ไม่พบผลลัพธ์ในทุก type → ข้อความ 'ไม่พบผลลัพธ์' พร้อม query ที่ escape แล้ว", async () => {
    seedAllTypes();
    gsTrigger().click();
    await search("ไม่มีทางเจอแน่นอนxyz");
    assert.match(gsResults().innerHTML, /ไม่พบผลลัพธ์/);
    assert.match(gsResults().innerHTML, /ไม่มีทางเจอแน่นอนxyz/);
    assert.equal(resultRows().length, 0);
  });

  test("query ตรงกับทุก type พร้อมกัน (คำว่า 'LED' อยู่ในชื่อสินค้า/บริการลีด/ชื่อสินค้าคำสั่งผลิต/ชื่อหมวดหมู่/หัวข้อบทความ) → กลุ่มขึ้นครบตามลำดับที่โค้ดกำหนด: สินค้า→ลีด→คำสั่งผลิต→หมวดหมู่→บทความ", async () => {
    seedAllTypes();
    gsTrigger().click();
    await search("LED");

    assert.deepEqual(groupLabels(), ["สินค้า", "ลีด", "คำสั่งผลิต", "หมวดหมู่", "บทความ"]);
  });

  test("ค้นหาไม่สนตัวพิมพ์เล็ก-ใหญ่ (รหัสสินค้าเป็นอังกฤษ)", async () => {
    seedAllTypes();
    gsTrigger().click();
    await search("sign-001");
    assert.equal(resultRows().length, 1);
    assert.match(gsResults().innerHTML, /SIGN-001/);
  });

  test("ผลลัพธ์ตัดบนสุด 6 รายการต่อ type แม้มีมากกว่า", async () => {
    stateMod.setAllProducts(Array.from({ length: 10 }, (_, i) => ({ id: `p-${i}`, name: `ป้ายทดสอบ ${i}`, code: `T-${i}` })));
    gsTrigger().click();
    await search("ป้ายทดสอบ");
    const productRows = resultRows().filter(r => r.dataset.type === "product");
    assert.equal(productRows.length, 6);
  });

  test("รายการที่อยู่ใน pendingDelete*Ids (กำลังรอ undo หลังลบ) ถูกกรองออกจากผลการค้นหา", async () => {
    stateMod.setAllProducts([{ id: "p-1", name: "ป้ายไฟ LED", code: "SIGN-001" }]);
    stateMod.pendingDeleteProductIds.add("p-1");
    gsTrigger().click();
    await search("ป้ายไฟ");
    assert.equal(resultRows().length, 0);
    assert.match(gsResults().innerHTML, /ไม่พบผลลัพธ์/);
  });

  test("ลีด: ค้นเจอผ่าน company/email/tel/service ได้เหมือนกัน ไม่ใช่แค่ name", async () => {
    triggerLeadsSnapshot([
      { id: "l-1", name: "", company: "บริษัท เอบีซี", email: "", tel: "", service: "", status: "new", source: "inline_contact", createdAt: { toMillis: () => Date.now() } }
    ]);
    gsTrigger().click();
    await search("เอบีซี");
    assert.equal(resultRows().filter(r => r.dataset.type === "lead").length, 1);
  });

  test("คำสั่งผลิต: หัวข้อผลลัพธ์ใช้ '#' + code (fallback เป็น id ถ้าไม่มี code)", async () => {
    triggerOrdersSnapshot([{ id: "o-1", code: "", customer: "ลูกค้าทดสอบ", item: "ป้ายไฟ", qty: 1, status: "received", dueDate: new Date().toISOString().slice(0, 10) }]);
    gsTrigger().click();
    await search("ลูกค้าทดสอบ");
    assert.match(gsResults().innerHTML, /#o-1/);
  });

  test("gsHighlight(): escape ค่า XSS ในผลลัพธ์เสมอ ก่อนห่อ <mark>", async () => {
    stateMod.setAllProducts([{ id: "p-1", name: `<img src=x onerror=alert(1)>LED`, code: "SIGN-XSS" }]);
    gsTrigger().click();
    await search("LED");
    assert.ok(!gsResults().innerHTML.includes("<img src=x"));
    assert.match(gsResults().innerHTML, /&lt;img/);
    assert.match(gsResults().innerHTML, /<mark>LED<\/mark>/i);
  });

  test("คำค้นมีอักขระ regex พิเศษ (วงเล็บ/จุด) ไม่ throw และไฮไลต์ถูกต้อง", async () => {
    stateMod.setAllProducts([{ id: "p-1", name: "ป้าย (พิเศษ) รุ่น 1.5", code: "X" }]);
    gsTrigger().click();
    assert.doesNotThrow(() => typeQuery("(พิเศษ)"));
    await waitDebounce();
    assert.match(gsResults().innerHTML, /<mark>\(พิเศษ\)<\/mark>/);
  });
});

describe("คีย์ลัดในช่องค้นหา (ArrowUp/ArrowDown/Enter/Escape)", () => {
  test("ArrowDown/ArrowUp เลื่อน active index แบบ clamp ในขอบเขต ไม่วนกลับหัวท้าย", async () => {
    stateMod.setAllProducts([
      { id: "p-1", name: "ป้ายทดสอบ 1", code: "A" },
      { id: "p-2", name: "ป้ายทดสอบ 2", code: "B" }
    ]);
    gsTrigger().click();
    await search("ป้ายทดสอบ");

    fireKey("ArrowDown");
    assert.ok(resultRows()[0].classList.contains("is-active"));

    fireKey("ArrowDown");
    assert.ok(resultRows()[1].classList.contains("is-active"));

    fireKey("ArrowDown"); // เกินขอบเขต — ต้อง clamp อยู่ที่ตัวสุดท้าย ไม่วนกลับตัวแรก
    assert.ok(resultRows()[1].classList.contains("is-active"));
    assert.ok(!resultRows()[0].classList.contains("is-active"));

    fireKey("ArrowUp");
    assert.ok(resultRows()[0].classList.contains("is-active"));

    fireKey("ArrowUp"); // เกินขอบเขต — ต้อง clamp อยู่ที่ตัวแรก ไม่วนกลับตัวสุดท้าย
    assert.ok(resultRows()[0].classList.contains("is-active"));
  });

  test("ไม่มีผลลัพธ์เลย → ArrowDown/ArrowUp ไม่ throw ไม่มีผลอะไร", async () => {
    gsTrigger().click();
    await search("ไม่เจอแน่ๆ");
    assert.doesNotThrow(() => fireKey("ArrowDown"));
    assert.doesNotThrow(() => fireKey("ArrowUp"));
  });

  test("Enter โดยยังไม่เคยกด Arrow เลย (gsActiveIndex=-1) → เลือกรายการแรกสุด switchTab ไปแท็บที่ถูกต้อง แล้วปิด overlay", async () => {
    stateMod.setAllCategories([{ id: "c-1", name: "หมวดทดสอบ", group: "", description: "" }]);
    gsTrigger().click();
    await search("หมวดทดสอบ");

    fireKey("Enter");
    assert.deepEqual(switchTabCalls, ["categories"]);
    assert.equal(gsOverlay().style.display, "none");
  });

  test("Enter หลังกด ArrowDown เลือกรายการที่ active index ชี้อยู่ (ไม่ใช่รายการแรกเสมอไป)", async () => {
    stateMod.setAllCategories([
      { id: "c-1", name: "หมวดทดสอบ A", group: "", description: "" },
      { id: "c-2", name: "หมวดทดสอบ B", group: "", description: "" }
    ]);
    gsTrigger().click();
    await search("หมวดทดสอบ");

    fireKey("ArrowDown");
    fireKey("ArrowDown"); // เลื่อนไปแถวที่สอง (index 1)
    fireKey("Enter");

    assert.deepEqual(switchTabCalls, ["categories"]);
    assert.equal(categoriesMod.cSearch.value, "หมวดทดสอบ B");
  });
});

describe("gsGoTo() ผ่านการคลิกผลลัพธ์ — ปิด overlay ก่อนเสมอแล้วส่งต่อให้ jumpTo* ที่ถูกต้อง", () => {
  test("คลิกผลลัพธ์สินค้า → ปิด overlay + jumpToProduct() ทำงานจริง (renderProducts เจอสินค้านั้น)", async () => {
    stateMod.setAllProducts([{ id: "p-1", name: "ป้ายไฟ LED เฉพาะกิจ", code: "SIGN-777" }]);
    gsTrigger().click();
    await search("SIGN-777");
    resultRows()[0].click();

    assert.equal(gsOverlay().style.display, "none");
    assert.deepEqual(switchTabCalls, ["products"]);
    assert.equal(productsMod.pSearch.value, "SIGN-777");
  });

  test("คลิกผลลัพธ์ลีด → jumpToLead() ทำงานจริง", async () => {
    triggerLeadsSnapshot([{ id: "l-1", name: "ลีดพิเศษทดสอบ", company: "", email: "", tel: "", service: "", status: "new", source: "inline_contact", createdAt: { toMillis: () => Date.now() } }]);
    gsTrigger().click();
    await search("ลีดพิเศษทดสอบ");
    resultRows()[0].click();

    assert.deepEqual(switchTabCalls, ["leads"]);
    assert.equal(leadsMod.lSearch.value, "ลีดพิเศษทดสอบ");
  });

  test("คลิกผลลัพธ์คำสั่งผลิต → ไฟล์นี้เรียก switchTab('orders') เองก่อน แล้วเรียก jumpToOrder() จาก orders-tab.js (คนละฟังก์ชันกับ jumpTo* อื่นที่มาจาก admin-global-search-jump.js)", async () => {
    triggerOrdersSnapshot([{ id: "o-1", code: "PO-SPECIAL", customer: "ลูกค้าพิเศษ", item: "ป้ายไฟ", qty: 1, status: "received", dueDate: new Date().toISOString().slice(0, 10) }]);
    gsTrigger().click();
    await search("PO-SPECIAL");
    resultRows()[0].click();

    assert.deepEqual(switchTabCalls, ["orders"]);
    assert.equal(gsOverlay().style.display, "none");
  });

  test("คลิกผลลัพธ์หมวดหมู่/บทความ → switchTab ไปแท็บที่ถูกต้องตรงกัน", async () => {
    stateMod.setAllCategories([{ id: "c-1", name: "หมวดเฉพาะกิจ", group: "", description: "" }]);
    gsTrigger().click();
    await search("หมวดเฉพาะกิจ");
    resultRows()[0].click();
    assert.deepEqual(switchTabCalls, ["categories"]);

    switchTabCalls = [];
    stateMod.setAllBlogs([{ id: "b-1", title: "บทความเฉพาะกิจ", category: "", status: "published" }]);
    gsTrigger().click();
    await search("บทความเฉพาะกิจ");
    resultRows()[0].click();
    assert.deepEqual(switchTabCalls, ["blog"]);
  });
});
