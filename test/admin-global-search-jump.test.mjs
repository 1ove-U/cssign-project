// test/admin-global-search-jump.test.mjs — รอบที่ 128
//
// ขอบเขต: js/admin-global-search-jump.js (97 บรรทัด) — 4 ฟังก์ชัน jumpTo* (product/lead/category/
// blogPost) ที่แยกออกมาจาก js/admin-global-search.js เดิม (รอบที่ 28) — ทุกฟังก์ชันมี
// แพทเทิร์นเดียวกัน: switchTab(tab) → ล้าง/ตั้งค่าตัวกรองของแท็บนั้นให้เจอรายการที่ต้องการ →
// เรียก render ของแท็บนั้น → requestAnimationFrame หา element ที่มี data-id ตรงกัน → scrollIntoView +
// ใส่ class "ad-search-highlight" ชั่วคราว 1800ms แล้วลบออก (setTimeout)
//
// **infra ที่ต้องเพิ่มก่อนเริ่มงานได้ (ยืนยันด้วยการลอง import ตรงๆ ก่อนเขียนเทส ตามที่ตกลงไว้
// ทุกรอบ)**: ไฟล์นี้ import { switchTab } from "./admin-page.js" ตรงๆ ที่ระดับบนสุด (เหมือน
// admin-sidebar.js รอบ 122) — เพิ่ม "global-search-jump"/"global-search" เข้า ALLOWED_PARENT_RE ของ
// test/helpers/admin-page-stub-loader.mjs (มี export switchTab ปลอมอยู่แล้วจากรอบ 122 ควบคุมผ่าน
// globalThis.__AD_PAGE_STUB_SWITCH_TAB__) — และไฟล์นี้ import จาก ./admin-products.js ตรงๆ ด้วย
// (ไฟล์นั้น import reloadAll จาก ./admin-page.js ตรงๆ เหมือนกัน) จึงต้องเพิ่ม "products" เข้า
// ALLOWED_PARENT_RE ด้วย (แยกจาก "products-form"/"products-csv" เดิม — คนละรายชื่อไฟล์กัน)
//
// **ลอง import ทั้งไฟล์นี้ + admin-global-search.js (คู่กันเสมอ) หลังแก้ stub — ผ่านสำเร็จทันที
// ไม่ต้องแก้ infra อื่นเพิ่ม**: แม้ไฟล์นี้ลากทั้ง admin-leads.js/admin-products.js/
// admin-categories.js/admin-blog.js เข้ามา (ซึ่งแต่ละไฟล์ก็ลาก
// admin-overview-dashboard.js/admin-groups.js/admin-products-form.js/admin-products-gallery.js/
// admin-blog-form.js/db-media.js/db-content.js/db-taxonomy.js/db-blog.js/db-products.js ตามมาอีก
// ชั้น) เพราะทุกไฟล์ในโซ่นี้ top-level แค่ query DOM/ประกาศตัวแปร ไม่มีไฟล์ไหนเรียกฟังก์ชันข้ามไฟล์
// ตอน module evaluate เลย — **ไม่ต้องใช้ localStorage polyfill เหมือน admin-sidebar.js เลย**
// (หลอกลองก่อนแก้ stub แล้วเจอ "localStorage is not defined" ที่ js/admin-sidebar.js:150 จริง — แต่
// นั่นเป็นเพราะตอนนั้น "./admin-page.js" จากไฟล์นี้ยังไม่ถูกดักด้วย stub จึงโหลด admin-page.js ตัว
// จริงที่ import "./admin-sidebar.js" แบบ side-effect ต่อ — พอ stub ครอบแล้ว admin-page.js ตัวจริง
// ไม่ถูกโหลดเลย โซ่ไปไม่ถึง admin-sidebar.js อีกต่อไป ยืนยันด้วยการรัน probe อีกครั้งแบบไม่ตั้ง
// localStorage แล้วผ่าน)
//
// สถาปัตยกรรมเทส: import ทุกไฟล์ที่เกี่ยวข้องครั้งเดียวใน before() (แพทเทิร์นเดียวกับ
// admin-settings-team.test.mjs รอบ 125) — ตั้งข้อมูลผ่าน setter ของแต่ละไฟล์เอง
// (setAllProducts/setAllCategories/setAllBlogs จาก admin-state.js,
// triggerLeadsSnapshot() ผ่าน startLeadsListener() จาก admin-leads.js แบบเดียวกับรอบ 125,
// triggerOrdersSnapshot() ผ่าน initOrdersTab() จาก orders-tab.js แบบเดียวกับรอบ 92/95/96 — แม้ไฟล์
// นี้ไม่ใช้ orders โดยตรง แต่ import chain ผ่าน admin-leads.js → admin-overview-dashboard.js →
// orders-tab.js ทำให้ต้อง import orders-tab.js อยู่แล้ว เรียก initOrdersTab() กันไว้เผื่อโค้ดใน
// เชนอ่าน getAllOrders() ระหว่าง render จริง)
//
// จับ switchTab() ที่ถูกเรียกผ่าน globalThis.__AD_PAGE_STUB_SWITCH_TAB__ (เก็บ array ของ tab ที่ถูก
// เรียกไว้ตรวจสอบ) — requestAnimationFrame โพลีฟิลด้วย setTimeout(cb,0) (แพทเทิร์นเดียวกับ
// orders-tab-kanban.test.mjs รอบ 96) แล้ว await flushMicrotasks() (setTimeout(r,0) อีกชั้น) ก่อน
// เช็ค highlight class — scrollIntoView โพลีฟิลเป็นฟังก์ชันเปล่าบน HTMLElement.prototype (jsdom ไม่
// implement ให้)
//
// ตรวจโค้ดจริงทั้งไฟล์ js/admin-global-search-jump.js (97 บรรทัด อ่านครบ) ก่อนเขียนเทสนี้ — ไม่พบบั๊ก
// จึงเป็นไฟล์เทสล้วนๆ ไม่มีการแก้โค้ดผลิตภัณฑ์เลยแม้แต่บรรทัดเดียว (แก้แค่ ALLOWED_PARENT_RE ของ
// test/helpers/admin-page-stub-loader.mjs ซึ่งเป็นไฟล์ infra เทส ไม่ใช่โค้ดผลิตภัณฑ์)
//
// จุดที่ตรวจก่อนเขียนเทส (อ่านโค้ดจริงยืนยัน ไม่ใช่เดา):
// - jumpToProduct(): pFilterCat.value ถูกล้างเป็น "" เสมอ (ไม่ใช่แค่ pSearch) — ถ้าตั้ง filter
//   หมวดหมู่ค้างไว้ก่อนเรียก ต้องถูกล้างจริง ไม่งั้น renderProducts() จะกรองสินค้าออกจนหาการ์ดไม่เจอ
// - jumpToLead(): ล้าง lFilterSource/lFilterAssignee "เฉพาะกรณี element มีอยู่จริงเท่านั้น"
//   (`if (lFilterSource) ...`) — element ทั้งสองมีอยู่จริงใน admin.html เสมอ จึงเทสแค่ path ที่ล้าง
//   สำเร็จ (ไม่มี branch !lFilterSource ให้เทสแยกในสภาพแวดล้อมจริง)
// - jumpToBlogPost(): ล้างเฉพาะ bFilterStatus ("เฉพาะกรณี element มีอยู่จริง" เหมือนกัน) ไม่แตะ
//   ตัวกรองอื่น เพราะแท็บบทความมีแค่ search + status filter เท่านั้น
//
// (หมายเหตุ: เดิมมีฟังก์ชันที่ 5 คือ jumpToTestimonial() — ลบออกพร้อมฟีเจอร์ testimonials ทั้งระบบ
// เทสของฟังก์ชันนี้ในไฟล์นี้ก็ถูกลบออกตามไปด้วย)

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
let jumpMod;     // admin-global-search-jump.js exports (5 jumpTo*)
let productsMod, leadsMod, categoriesMod, blogMod, ordersMod, stateMod;
let switchTabCalls;

function flushMicrotasks() {
  return new Promise((r) => setTimeout(r, 0));
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

function makeLead(overrides) {
  return {
    id: "l-1", name: "สมชาย ใจดี", email: "somchai@example.com", tel: "0812345678",
    company: "บริษัท ทดสอบ", service: "ป้ายไฟ LED", message: "",
    source: "inline_contact", status: "new", assignee: "", notes: "",
    createdAt: { toMillis: () => Date.now() },
    ...overrides
  };
}

function makeProduct(overrides) {
  return { id: "p-1", name: "ป้ายไฟ LED กล่องไฟ", code: "SIGN-001", cat_id: "", status: "active", ...overrides };
}

function makeCategory(overrides) {
  return { id: "c-1", name: "ป้ายไฟ LED", group: "", description: "", ...overrides };
}

function makeBlog(overrides) {
  return { id: "b-1", title: "วิธีเลือกป้ายไฟ LED", category: "ความรู้", status: "published", ...overrides };
}

before(async () => {
  const dom = new JSDOM(`<!doctype html><html><body>${ADMIN_BODY_NO_SCRIPTS}</body></html>`, {
    url: "https://example.test/"
  });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
  globalThis.Event = dom.window.Event;
  globalThis.HTMLElement = dom.window.HTMLElement;
  dom.window.HTMLElement.prototype.scrollIntoView = function () {};
  globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);

  switchTabCalls = [];
  globalThis.__AD_PAGE_STUB_SWITCH_TAB__ = (tab) => { switchTabCalls.push(tab); };

  document = dom.window.document;

  stateMod = await import("../js/admin-state.js");
  productsMod = await import("../js/admin-products.js");
  leadsMod = await import("../js/admin-leads.js");
  categoriesMod = await import("../js/admin-categories.js");
  blogMod = await import("../js/admin-blog.js");
  ordersMod = await import("../js/orders-tab.js");
  jumpMod = await import("../js/admin-global-search-jump.js");

  globalThis.__SNAPSHOT_LISTENERS__ = {};
  leadsMod.startLeadsListener();
  ordersMod.initOrdersTab();
});

beforeEach(() => {
  switchTabCalls = [];
  globalThis.__ADD_DOC_CALLS__ = [];
  globalThis.__UPDATE_DOC_CALLS__ = [];
  globalThis.__DELETE_DOC_CALLS__ = [];
  globalThis.__SET_DOC_CALLS__ = [];

  triggerLeadsSnapshot([]);
  triggerOrdersSnapshot([]);
  stateMod.setAllProducts([]);
  stateMod.setAllCategories([]);
  stateMod.setAllBlogs([]);

  productsMod.pSearch.value = "";
  productsMod.pFilterCat.value = "";
  productsMod.setPCurrentPage(1);

  leadsMod.setLeadStatusFilter("");
  leadsMod.lSearch.value = "";
  if (leadsMod.lFilterSource) leadsMod.lFilterSource.value = "";
  if (leadsMod.lFilterAssignee) leadsMod.lFilterAssignee.value = "";
  leadsMod.setLCurrentPage(1);

  categoriesMod.cSearch.value = "";
  categoriesMod.setCCurrentPage(1);

  blogMod.bSearch.value = "";
  if (blogMod.bFilterStatus) blogMod.bFilterStatus.value = "";
  blogMod.setBCurrentPage(1);

  document.querySelectorAll(".ad-search-highlight").forEach(el => el.classList.remove("ad-search-highlight"));
});

describe("jumpToProduct(product)", () => {
  test("switchTab('products') ถูกเรียก, ล้าง pFilterCat, ตั้ง pSearch เป็นรหัสสินค้า, กลับหน้า 1, renderProducts() ถูกเรียกจริง", () => {
    const p1 = makeProduct({ id: "p-1", name: "ป้ายไฟ LED", code: "SIGN-001" });
    const p2 = makeProduct({ id: "p-2", name: "ป้ายอะคริลิก", code: "SIGN-002" });
    stateMod.setAllProducts([p1, p2]);
    productsMod.pFilterCat.value = "cat-x"; // ตั้งค้างไว้ก่อน ต้องถูกล้างเป็น "" ไม่งั้นกรองสินค้าออกหมด
    productsMod.setPCurrentPage(3);

    jumpMod.jumpToProduct(p1);

    assert.deepEqual(switchTabCalls, ["products"]);
    assert.equal(productsMod.pFilterCat.value, "");
    assert.equal(productsMod.pSearch.value, "SIGN-001");
    assert.equal(productsMod.pCurrentPage, 1);
    // renderProducts() ถูกเรียกจริง: การ์ดของ p1 ต้องอยู่ใน DOM แล้ว (p2 ถูกกรองออกด้วย search)
    assert.ok(productsMod.pGrid.querySelector('.ad-card[data-id="p-1"]'));
    assert.equal(productsMod.pGrid.querySelectorAll(".ad-card").length, 1);
  });

  test("ไม่มี product.code (สินค้าที่ยังไม่ตั้งรหัส) → ใช้ product.name แทนในช่องค้นหา", () => {
    const p1 = makeProduct({ id: "p-1", name: "ป้ายไฟ LED เฉพาะกิจ", code: "" });
    stateMod.setAllProducts([p1]);

    jumpMod.jumpToProduct(p1);

    assert.equal(productsMod.pSearch.value, "ป้ายไฟ LED เฉพาะกิจ");
    assert.ok(productsMod.pGrid.querySelector('.ad-card[data-id="p-1"]'));
  });

  test("requestAnimationFrame callback: การ์ดที่เจอถูกเรียก scrollIntoView + ใส่ class ad-search-highlight แล้วลบออกหลัง 1800ms", async () => {
    const p1 = makeProduct({ id: "p-1", name: "ป้ายไฟ LED", code: "SIGN-001" });
    stateMod.setAllProducts([p1]);

    jumpMod.jumpToProduct(p1);
    await flushMicrotasks(); // ระบาย requestAnimationFrame (polyfill = setTimeout(cb,0))

    const card = productsMod.pGrid.querySelector('.ad-card[data-id="p-1"]');
    assert.ok(card.classList.contains("ad-search-highlight"));

    await new Promise(r => setTimeout(r, 1850));
    assert.ok(!card.classList.contains("ad-search-highlight"));
  });

  test("product ที่หาการ์ดไม่เจอ (id ไม่ตรงกับที่ render จริง) → requestAnimationFrame callback early return เงียบๆ ไม่ throw", async () => {
    stateMod.setAllProducts([]); // ไม่มีสินค้าเลย → renderProducts() แสดง empty state ไม่มีการ์ด
    const ghost = makeProduct({ id: "ghost-id" });

    assert.doesNotThrow(() => jumpMod.jumpToProduct(ghost));
    await flushMicrotasks();
    // ไม่ throw และไม่มี .ad-search-highlight ค้างที่ไหนเลย
    assert.equal(document.querySelectorAll(".ad-search-highlight").length, 0);
  });
});

describe("jumpToLead(lead)", () => {
  test("switchTab('leads') ถูกเรียก, ล้าง status/source/assignee filter, ตั้ง lSearch เป็นชื่อ, กลับหน้า 1, renderLeads() ถูกเรียกจริง", () => {
    const l1 = makeLead({ id: "l-1", name: "สมชาย ใจดี" });
    const l2 = makeLead({ id: "l-2", name: "สมหญิง รักดี" });
    triggerLeadsSnapshot([l1, l2]);
    leadsMod.setLeadStatusFilter("new");
    leadsMod.lFilterSource.value = "inline_contact";
    leadsMod.setLCurrentPage(5);

    jumpMod.jumpToLead(l1);

    assert.deepEqual(switchTabCalls, ["leads"]);
    assert.equal(leadsMod.lFilterSource.value, "");
    assert.equal(leadsMod.lSearch.value, "สมชาย ใจดี");
    assert.equal(leadsMod.lCurrentPage, 1);
    assert.ok(leadsMod.lTableBody.querySelector('tr[data-id="l-1"]'));
    assert.equal(leadsMod.lTableBody.querySelectorAll("tr.ad-l-row").length, 1);
  });

  test("lead ไม่มีชื่อ → fallback company → email → tel/phone ตามลำดับที่ประกาศไว้ในโค้ด", () => {
    triggerLeadsSnapshot([makeLead({ id: "l-1", name: "", company: "บริษัท เอบีซี" })]);
    jumpMod.jumpToLead({ id: "l-1", name: "", company: "บริษัท เอบีซี", email: "x@x.com", tel: "0899999999" });
    assert.equal(leadsMod.lSearch.value, "บริษัท เอบีซี");

    triggerLeadsSnapshot([makeLead({ id: "l-1", name: "", company: "" })]);
    jumpMod.jumpToLead({ id: "l-1", name: "", company: "", email: "x@x.com", tel: "0899999999" });
    assert.equal(leadsMod.lSearch.value, "x@x.com");

    triggerLeadsSnapshot([makeLead({ id: "l-1", name: "", company: "" })]);
    jumpMod.jumpToLead({ id: "l-1", name: "", company: "", email: "", tel: "", phone: "0888888888" });
    assert.equal(leadsMod.lSearch.value, "0888888888");
  });

  test("requestAnimationFrame callback ไฮไลต์แถวที่เจอจริง แล้วลบ class ออกหลัง 1800ms", async () => {
    const l1 = makeLead({ id: "l-1", name: "สมชาย ใจดี" });
    triggerLeadsSnapshot([l1]);

    jumpMod.jumpToLead(l1);
    await flushMicrotasks();

    const row = leadsMod.lTableBody.querySelector('tr[data-id="l-1"]');
    assert.ok(row.classList.contains("ad-search-highlight"));
    await new Promise(r => setTimeout(r, 1850));
    assert.ok(!row.classList.contains("ad-search-highlight"));
  });
});

describe("jumpToCategory(cat)", () => {
  test("switchTab('categories') ถูกเรียก, ตั้ง cSearch เป็นชื่อหมวดหมู่, กลับหน้า 1, renderCategories() ถูกเรียกจริง", () => {
    const c1 = makeCategory({ id: "c-1", name: "ป้ายไฟ LED" });
    const c2 = makeCategory({ id: "c-2", name: "ป้ายอะคริลิก" });
    stateMod.setAllCategories([c1, c2]);
    categoriesMod.setCCurrentPage(2);

    jumpMod.jumpToCategory(c1);

    assert.deepEqual(switchTabCalls, ["categories"]);
    assert.equal(categoriesMod.cSearch.value, "ป้ายไฟ LED");
    assert.equal(categoriesMod.cCurrentPage, 1);
    assert.ok(categoriesMod.cTableBody.querySelector('tr[data-id="c-1"]'));
    assert.equal(categoriesMod.cTableBody.querySelectorAll("tr[data-id]").length, 1);
  });

  test("ไม่มีชื่อหมวดหมู่ (undefined) → cSearch ตั้งเป็นสตริงว่าง ไม่ throw", () => {
    stateMod.setAllCategories([{ id: "c-1" }]);
    assert.doesNotThrow(() => jumpMod.jumpToCategory({ id: "c-1" }));
    assert.equal(categoriesMod.cSearch.value, "");
  });

  test("requestAnimationFrame callback ไฮไลต์แถวที่เจอจริง แล้วลบ class ออกหลัง 1800ms", async () => {
    const c1 = makeCategory({ id: "c-1", name: "ป้ายไฟ LED" });
    stateMod.setAllCategories([c1]);

    jumpMod.jumpToCategory(c1);
    await flushMicrotasks();

    const row = categoriesMod.cTableBody.querySelector('tr[data-id="c-1"]');
    assert.ok(row.classList.contains("ad-search-highlight"));
    await new Promise(r => setTimeout(r, 1850));
    assert.ok(!row.classList.contains("ad-search-highlight"));
  });
});

describe("jumpToBlogPost(post)", () => {
  test("switchTab('blog') ถูกเรียก, ล้าง bFilterStatus, ตั้ง bSearch เป็นชื่อบทความ, กลับหน้า 1, renderBlogs() ถูกเรียกจริง", () => {
    const b1 = makeBlog({ id: "b-1", title: "วิธีเลือกป้ายไฟ LED" });
    const b2 = makeBlog({ id: "b-2", title: "ความรู้ป้ายอะคริลิก" });
    stateMod.setAllBlogs([b1, b2]);
    blogMod.bFilterStatus.value = "draft";
    blogMod.setBCurrentPage(4);

    jumpMod.jumpToBlogPost(b1);

    assert.deepEqual(switchTabCalls, ["blog"]);
    assert.equal(blogMod.bFilterStatus.value, "");
    assert.equal(blogMod.bSearch.value, "วิธีเลือกป้ายไฟ LED");
    assert.equal(blogMod.bCurrentPage, 1);
    assert.ok(blogMod.bGrid.querySelector('.ad-card[data-id="b-1"]'));
  });

  test("post ไม่มี title → bSearch ตั้งเป็นสตริงว่าง ไม่ throw", () => {
    stateMod.setAllBlogs([{ id: "b-1", status: "published" }]);
    assert.doesNotThrow(() => jumpMod.jumpToBlogPost({ id: "b-1" }));
    assert.equal(blogMod.bSearch.value, "");
  });

  test("requestAnimationFrame callback ไฮไลต์การ์ดที่เจอจริง แล้วลบ class ออกหลัง 1800ms", async () => {
    const b1 = makeBlog({ id: "b-1", title: "วิธีเลือกป้ายไฟ LED" });
    stateMod.setAllBlogs([b1]);

    jumpMod.jumpToBlogPost(b1);
    await flushMicrotasks();

    const card = blogMod.bGrid.querySelector('.ad-card[data-id="b-1"]');
    assert.ok(card.classList.contains("ad-search-highlight"));
    await new Promise(r => setTimeout(r, 1850));
    assert.ok(!card.classList.contains("ad-search-highlight"));
  });
});
