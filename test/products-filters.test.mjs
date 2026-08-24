// test/products-filters.test.mjs — รอบที่ 139
//
// ขอบเขต: js/products-filters.js (157 บรรทัด) — หมวดหมู่/แท็บ (dropdown หมวดใหญ่ + แถบหมวดย่อย) +
// deep-link filter สำหรับ products.html/en/products.html — แยกออกมาจาก js/products.js phase 22
// (currentGroupFilter, applyCardFilter, filterCategoryTabsByGroup, bindGroupDropdown,
// bindTabFilter, applyDeepLinkFilter) — export แค่ setGroupFilter()/bindTabFilter()/
// applyDeepLinkFilter() ส่วน applyCardFilter/filterCategoryTabsByGroup/bindGroupDropdown เป็น
// module-private เรียกผ่านผลข้างเคียงของ export ทั้ง 3 เท่านั้น
//
// ไฟล์นี้เป็น ES module ที่ query `document.getElementById('product-group-tabs-dynamic'/
// 'product-tabs-dynamic'/'product-grid')` ที่ระดับบนสุดตอน evaluate (เหมือน js/products.js เอง
// และ js/admin-*.js หลายไฟล์) ไม่ใช่ classic IIFE แบบ js/product-schema.js — จึงต้องตั้ง
// globalThis.window/document (JSDOM) ให้มี element ทั้ง 3 นี้อยู่ก่อน แล้วค่อย dynamic
// import(\"../js/products-filters.js\") ครั้งเดียวใน before() (แพทเทิร์นเดียวกับ
// test/admin-groups.test.mjs) — ไม่มีการ import จากไฟล์อื่นเลยสักไฟล์เดียว (ไม่มี Firestore) จึง
// ไม่ต้องพึ่ง stub loader ใดๆ เพิ่มเติม
//
// markup ของ 3 container นี้ (options ของ dropdown หมวดใหญ่ + ปุ่ม tab หมวดย่อย + การ์ดสินค้า)
// ปกติถูกสร้างโดย js/products.js เอง (groupOptionsHTML/groupDropdownHTML/tabsHTML ใน render() —
// ดูโครงสร้าง class/data-* จริงจากไฟล์นั้น) — จำลองเองในเทสนี้ให้ตรงเป๊ะ (pr-group-select-btn/
// -menu/-option, product-tab, data-filter/data-group-id/data-cat/data-group) เพราะ
// products-filters.js เองไม่ได้สร้าง markup พวกนี้ แค่ query หาและผูก event handler เท่านั้น
//
// currentGroupFilter เป็น module-level state คงค้างข้ามเทส — resetDom() ใน beforeEach สร้าง
// markup ใหม่ทั้ง 3 container ทุกครั้ง (event listener เดิมหลุดไปพร้อม element เก่า) แล้วเรียก
// setGroupFilter('all') + bindTabFilter() ใหม่เสมอ เหมือนที่ products.js เรียกจริงใน render()
// ทุกครั้งที่โหลดข้อมูลใหม่ (setGroupFilter('all') ก่อนสร้าง HTML ใหม่เสมอ)
//
// applyDeepLinkFilter() อ่าน window.location.search — ใช้ dom.reconfigure({ url }) ของ JSDOM
// เปลี่ยน query string ต่อเทสได้โดยไม่ต้อง import โมดูลใหม่ (window/document object เดิม อ้างอิง
// เดียวกับ globalThis.window ตลอด)
//
// ตรวจโค้ดจริงทั้งไฟล์ js/products-filters.js ก่อนเขียนเทสนี้ (อ่านครบ 157 บรรทัด) — ไม่พบบั๊ก
// จึงเป็นไฟล์เทสล้วนๆ ไม่มีการแก้โค้ดผลิตภัณฑ์เลยแม้แต่บรรทัดเดียว

import { test, describe, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

let dom;
let document;
let mod; // products-filters.js exports

function groupOptionsHTML(groups) {
  var html = '<button type="button" class="pr-group-select-option active" data-filter="all" role="option" aria-selected="true">ทั้งหมด</button>';
  groups.forEach(function (g) {
    html += '<button type="button" class="pr-group-select-option" data-filter="' + g.id + '" role="option" aria-selected="false">' + g.name + '</button>';
  });
  return html;
}

function groupDropdownHTML(groups) {
  return (
    '<button type="button" class="pr-group-select-btn" aria-haspopup="listbox" aria-expanded="false">' +
      '<span class="pr-group-select-label">หมวดหมู่: <strong class="pr-group-select-value">ทั้งหมด</strong></span>' +
    '</button>' +
    '<div class="pr-group-select-menu" role="listbox">' + groupOptionsHTML(groups) + '</div>'
  );
}

function tabsHTML(cats) {
  var html = '<button class="product-tab active" data-filter="all">ทั้งหมด</button>';
  cats.forEach(function (c) {
    html += '<button class="product-tab" data-filter="' + c.id + '" data-group-id="' + c.group_id + '">' + c.name + '</button>';
  });
  return html;
}

function cardHTML(card) {
  return '<div class="product-card" data-cat="' + card.cat + '" data-group="' + card.group + '"></div>';
}

// หมวดใหญ่ g1 (c1/c2) + g2 (c3) — 4 การ์ด: c1x2 (g1), c2x1 (g1), c3x1 (g2)
const GROUPS = [{ id: "g1", name: "หมวดใหญ่ A" }, { id: "g2", name: "หมวดใหญ่ B" }];
const CATS = [
  { id: "c1", group_id: "g1", name: "หมวดย่อย 1" },
  { id: "c2", group_id: "g1", name: "หมวดย่อย 2" },
  { id: "c3", group_id: "g2", name: "หมวดย่อย 3" },
];
const CARDS = [
  { cat: "c1", group: "g1" },
  { cat: "c1", group: "g1" },
  { cat: "c2", group: "g1" },
  { cat: "c3", group: "g2" },
];

function groupTabsWrap() { return document.getElementById("product-group-tabs-dynamic"); }
function tabsWrap() { return document.getElementById("product-tabs-dynamic"); }
function grid() { return document.getElementById("product-grid"); }

function tab(filter) { return tabsWrap().querySelector('.product-tab[data-filter="' + filter + '"]'); }
function groupOption(filter) { return groupTabsWrap().querySelector('.pr-group-select-option[data-filter="' + filter + '"]'); }
function groupBtn() { return groupTabsWrap().querySelector(".pr-group-select-btn"); }
function groupValueEl() { return groupTabsWrap().querySelector(".pr-group-select-value"); }
function visibleCards() {
  return Array.from(grid().querySelectorAll(".product-card")).filter(function (c) { return c.style.display !== "none"; });
}

// สร้าง markup ใหม่ทั้ง 3 container ทุกครั้ง (hasGroupRow=true เป็นดีฟอลต์ — dropdown มีตัวเลือก
// จริง) แล้วผูก event ใหม่ผ่าน bindTabFilter() จริง เหมือนที่ products.js เรียกใน render()
function resetDom({ withGroupDropdown = true } = {}) {
  // groupTabsWrap/tabsWrap เป็น element เดิมข้ามเทส (แค่ innerHTML ถูกแทนที่) — ต้องล้าง class
  // ระดับ wrapper เอง ('open'/'is-collapsed') ด้วยมือทุกครั้ง เพราะ bindGroupDropdown()/
  // filterCategoryTabsByGroup() set/toggle class พวกนี้บน wrapper ไม่ใช่บนลูกที่ถูกแทนที่ทิ้ง
  groupTabsWrap().classList.remove("open");
  groupTabsWrap().innerHTML = withGroupDropdown ? groupDropdownHTML(GROUPS) : "";
  tabsWrap().innerHTML = tabsHTML(CATS);
  tabsWrap().classList.remove("is-collapsed");
  grid().innerHTML = CARDS.map(cardHTML).join("");
  mod.setGroupFilter("all");
  mod.bindTabFilter();
}

before(async () => {
  dom = new JSDOM(
    `<!doctype html><html><body>
      <div class="pr-group-select" id="product-group-tabs-dynamic"></div>
      <div class="product-tabs" id="product-tabs-dynamic"></div>
      <div class="product-grid" id="product-grid"></div>
    </body></html>`,
    { url: "https://example.test/products.html" }
  );
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
  globalThis.Event = dom.window.Event;
  globalThis.MouseEvent = dom.window.MouseEvent;
  globalThis.KeyboardEvent = dom.window.KeyboardEvent;
  document = dom.window.document;

  mod = await import("../js/products-filters.js");
});

beforeEach(() => {
  delete dom.window.CSIGN;
  resetDom();
});

describe("setGroupFilter() + applyCardFilter() (ผ่านการคลิก tab หมวดย่อย)", () => {
  test("ดีฟอลต์ currentGroupFilter='all': คลิก tab c1 → เหลือเฉพาะการ์ด cat=c1 (2 ใบ), tab อื่นหลุด active", () => {
    tab("c1").click();
    assert.equal(visibleCards().length, 2);
    visibleCards().forEach(function (c) { assert.equal(c.getAttribute("data-cat"), "c1"); });
    assert.equal(tab("c1").classList.contains("active"), true);
    assert.equal(tab("all").classList.contains("active"), false);
  });

  test("คลิก tab 'all' หลังเลือก c1 แล้ว → การ์ดกลับมาครบทุกใบ", () => {
    tab("c1").click();
    tab("all").click();
    assert.equal(visibleCards().length, CARDS.length);
    assert.equal(tab("all").classList.contains("active"), true);
  });

  test("setGroupFilter('g2') โดยตรง + คลิก tab 'all' → เหลือเฉพาะการ์ดกลุ่ม g2 (1 ใบ) แม้ catFilter เป็น 'all'", () => {
    mod.setGroupFilter("g2");
    tab("all").click();
    assert.equal(visibleCards().length, 1);
    assert.equal(visibleCards()[0].getAttribute("data-group"), "g2");
  });

  test("setGroupFilter('g1') + คลิก tab c1 → ต้องตรงทั้ง group และ cat พร้อมกัน (2 ใบ)", () => {
    mod.setGroupFilter("g1");
    tab("c1").click();
    assert.equal(visibleCards().length, 2);
    visibleCards().forEach(function (c) {
      assert.equal(c.getAttribute("data-cat"), "c1");
      assert.equal(c.getAttribute("data-group"), "g1");
    });
  });

  test("setGroupFilter('g1') + คลิก tab c3 (คนละ group) → ไม่มีการ์ดตรงเงื่อนไขเลย (groupMatch เป็นเท็จเสมอ)", () => {
    mod.setGroupFilter("g1");
    tab("c3").click();
    assert.equal(visibleCards().length, 0);
  });
});

describe("bindGroupDropdown() — เปิด/ปิดเมนู", () => {
  test("คลิกปุ่ม → เปิดเมนู (class 'open' + aria-expanded='true')", () => {
    groupBtn().click();
    assert.equal(groupTabsWrap().classList.contains("open"), true);
    assert.equal(groupBtn().getAttribute("aria-expanded"), "true");
  });

  test("คลิกปุ่มซ้ำ → ปิดเมนู", () => {
    groupBtn().click();
    groupBtn().click();
    assert.equal(groupTabsWrap().classList.contains("open"), false);
    assert.equal(groupBtn().getAttribute("aria-expanded"), "false");
  });

  test("คลิกนอก dropdown (document.body) ขณะเปิดอยู่ → ปิดเมนู", () => {
    groupBtn().click();
    document.body.click();
    assert.equal(groupTabsWrap().classList.contains("open"), false);
  });

  test("กด Escape ขณะเมนูเปิดอยู่ → ปิดเมนู", () => {
    groupBtn().click();
    document.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Escape" }));
    assert.equal(groupTabsWrap().classList.contains("open"), false);
  });

  test("groupTabsWrap ว่างเปล่า (hasGroupRow=false เหมือนกรณีมีหมวดใหญ่เดียว) → ไม่มี .pr-group-select-btn ให้ผูก ไม่ throw ตอน bindTabFilter()", () => {
    resetDom({ withGroupDropdown: false });
    assert.equal(groupTabsWrap().querySelector(".pr-group-select-btn"), null);
  });
});

describe("bindGroupDropdown() — เลือกตัวเลือกหมวดใหญ่", () => {
  test("คลิกตัวเลือก g1 → active/aria-selected ย้ายจาก 'all' ไป g1 (exclusive), ข้อความปุ่มเปลี่ยนตาม, เมนูปิด, focus กลับที่ปุ่ม", () => {
    groupBtn().click();
    groupOption("g1").click();
    assert.equal(groupOption("g1").classList.contains("active"), true);
    assert.equal(groupOption("g1").getAttribute("aria-selected"), "true");
    assert.equal(groupOption("all").classList.contains("active"), false);
    assert.equal(groupOption("all").getAttribute("aria-selected"), "false");
    assert.equal(groupValueEl().textContent, "หมวดใหญ่ A");
    assert.equal(groupTabsWrap().classList.contains("open"), false);
    assert.equal(document.activeElement, groupBtn());
  });

  test("คลิกตัวเลือก g1 → เรียก filterCategoryTabsByGroup() + applyCardFilter('all') ผ่านผลข้างเคียง: ซ่อน tab c3 (group อื่น), โชว์ c1/c2, active tab กลับไปที่ 'all', tabsWrap เลิก is-collapsed, การ์ดเหลือแค่กลุ่ม g1", () => {
    groupOption("g1").click();
    assert.equal(tab("c1").style.display, "");
    assert.equal(tab("c2").style.display, "");
    assert.equal(tab("c3").style.display, "none");
    assert.equal(tab("all").classList.contains("active"), true);
    assert.equal(tab("c1").classList.contains("active"), false);
    assert.equal(tabsWrap().classList.contains("is-collapsed"), false);
    assert.equal(visibleCards().length, 3); // c1x2 + c2x1 อยู่ใน g1
  });

  test("คลิกตัวเลือก g1 แล้วคลิกตัวเลือก 'all' อีกที → tabsWrap กลับมา is-collapsed (แถวหมวดย่อยถูกซ่อนทั้งแถวด้วย CSS), การ์ดครบทุกใบ, ปุ่ม 'ทั้งหมด' ของแถวย่อยยัง active", () => {
    groupOption("g1").click();
    groupOption("all").click();
    assert.equal(tabsWrap().classList.contains("is-collapsed"), true);
    // currentGroupFilter==='all': visible = data-filter==='all' || tabGroup==='all' — tab หมวดย่อย
    // จริงทุกอัน (data-group-id เป็น g1/g2 ไม่ใช่ 'all') จึงยังเป็น display:none ต่อไป (ไม่ได้แปลว่า
    // "โชว์" เพราะทั้งแถวถูกซ่อนด้วย is-collapsed อยู่แล้ว — ไม่ใช่บั๊ก แค่ redundant ซ้อนกัน 2 ชั้น)
    assert.equal(tab("c1").style.display, "none");
    assert.equal(tab("c3").style.display, "none");
    assert.equal(tab("all").classList.contains("active"), true);
    assert.equal(visibleCards().length, CARDS.length);
    assert.equal(groupValueEl().textContent, "ทั้งหมด");
  });

  test("window.CSIGN.initTabsOverflow ถูกเรียกพร้อม tabsWrap ทุกครั้งที่เลือกหมวดใหญ่ใหม่ (ถ้ามี window.CSIGN)", () => {
    const calls = [];
    dom.window.CSIGN = { initTabsOverflow: function (el) { calls.push(el); } };
    groupOption("g1").click();
    assert.equal(calls.length, 1);
    assert.equal(calls[0], tabsWrap());
  });

  test("ไม่มี window.CSIGN เลย → ไม่ throw ตอนเลือกหมวดใหญ่ใหม่", () => {
    assert.doesNotThrow(() => groupOption("g2").click());
  });
});

describe("applyDeepLinkFilter()", () => {
  function setSearch(qs) {
    dom.reconfigure({ url: "https://example.test/products.html" + qs });
  }

  test("ไม่มี query เลย (?) → ไม่มีอะไรเปลี่ยน ไม่ throw", () => {
    setSearch("");
    assert.doesNotThrow(() => mod.applyDeepLinkFilter());
    assert.equal(visibleCards().length, CARDS.length);
    assert.equal(tab("all").classList.contains("active"), true);
  });

  test("?cat=all → return ทันที ไม่แตะ dropdown/tab เลย", () => {
    setSearch("?cat=all");
    mod.applyDeepLinkFilter();
    assert.equal(groupTabsWrap().classList.contains("open"), false);
    assert.equal(visibleCards().length, CARDS.length);
  });

  test("?cat=c1 (ไม่มี group) → เดา group จาก data-group-id ของ tab c1 (g1) แล้วคลิก group option g1 ก่อน จากนั้นคลิก tab c1 → ผลลัพธ์กรองทั้ง group+cat", () => {
    setSearch("?cat=c1");
    mod.applyDeepLinkFilter();
    assert.equal(groupOption("g1").classList.contains("active"), true);
    assert.equal(tab("c1").classList.contains("active"), true);
    assert.equal(visibleCards().length, 2);
    visibleCards().forEach(function (c) { assert.equal(c.getAttribute("data-cat"), "c1"); });
  });

  test("?group=g2&cat=c3 (ระบุ group ตรงๆ) → คลิก group option g2 แล้วคลิก tab c3", () => {
    setSearch("?group=g2&cat=c3");
    mod.applyDeepLinkFilter();
    assert.equal(groupOption("g2").classList.contains("active"), true);
    assert.equal(tab("c3").classList.contains("active"), true);
    assert.equal(visibleCards().length, 1);
    assert.equal(visibleCards()[0].getAttribute("data-cat"), "c3");
  });

  test("?group=all&cat=c1 → group='all' ไม่คลิก dropdown เลย (currentGroupFilter คงเป็น 'all' เดิม) แต่ยังคลิก tab c1 ตามปกติ", () => {
    setSearch("?group=all&cat=c1");
    mod.applyDeepLinkFilter();
    assert.equal(groupOption("all").classList.contains("active"), true); // ไม่เคยถูกคลิกให้เปลี่ยน
    assert.equal(tab("c1").classList.contains("active"), true);
    assert.equal(visibleCards().length, 2);
  });

  test("cat ไม่ตรง tab ไหนเลย (slug ผิด) → หา tab ไม่เจอ ไม่ throw ไม่มีอะไรถูกคลิก", () => {
    setSearch("?cat=does-not-exist");
    assert.doesNotThrow(() => mod.applyDeepLinkFilter());
    assert.equal(visibleCards().length, CARDS.length);
  });

  test("group ไม่ตรงตัวเลือกไหนเลย → ข้ามการคลิก dropdown ไม่ throw แล้วไปต่อขั้น cat ตามปกติ", () => {
    setSearch("?group=does-not-exist&cat=c2");
    assert.doesNotThrow(() => mod.applyDeepLinkFilter());
    assert.equal(tab("c2").classList.contains("active"), true);
  });

  test("groupTabsWrap ว่างเปล่า (ไม่มี dropdown ให้เลือก) + ?group=g1&cat=c1 → ข้าม group ทั้งหมด (guard `&& groupTabsWrap` เจอ querySelector คืน null) แต่ยังคลิก tab c1 ได้ตามปกติ", () => {
    resetDom({ withGroupDropdown: false });
    setSearch("?group=g1&cat=c1");
    assert.doesNotThrow(() => mod.applyDeepLinkFilter());
    assert.equal(tab("c1").classList.contains("active"), true);
  });
});
