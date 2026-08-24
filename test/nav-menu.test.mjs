// test/nav-menu.test.mjs — รอบที่ 140
//
// ขอบเขต: js/nav-menu.js (~180 บรรทัด) — เมกะเมนู "หมวดหมู่" เดสก์ท็อป (.nav-mega-grid) +
// แผงหมวดหมู่มือถือแบบ accordion (.mobile-dd-panel) — โครงสร้างไฟล์เป็น IIFE top-level side
// effect ล้วนๆ (ไม่ export อะไรเลย) เหมือน js/site-settings.js/js/portfolio-render.js —
// import { getGroups, getCategories } from "./db-taxonomy.js" ตรงๆ ที่ระดับบนสุด (db-taxonomy.js
// import { db } from "./db.js" ต่อ ซึ่งพึ่ง firebase-stub-loader.mjs ผ่าน register-loader.mjs
// เหมือนไฟล์เทสอื่นทุกไฟล์ที่แตะ Firestore) — ใช้แพทเทิร์น import ด้วย query string คนละอันทุกเทส
// (`../js/nav-menu.js?t=N`) เพื่อบังคับ module instance ใหม่ (querySelectorAll('.nav-mega-grid'/
// '.mobile-dd-panel') ที่ระดับบนสุดต้องอ่าน DOM ใหม่ทุกเทส)
//
// getGroups()/getCategories() ทั้งคู่ใช้ getDocs() (พหูพจน์ ผ่าน query()+collection()+orderBy())
// ต่างจาก js/site-settings.js ที่ใช้ getDoc() เอกฐาน — จึงต้องใช้ globalThis.__GET_DOCS_STUB__
// (ตามด้วย ref.path === "groups" หรือ "categories") ไม่ใช่ __GET_DOC_STUB__ — แพทเทิร์นเดียวกับ
// test/portfolio-render.test.mjs/test/admin-groups.test.mjs
//
// **สองเฟสที่ต้องแยกทดสอบชัดเจน**:
//   1) Sync ตอน import: ผูก interactivity ให้ markup แบบ static ที่เขียนไว้ในหน้าเว็บทันที
//      (bindDesktopFlyout เฉพาะ grid ที่มี class `.nav-mega-grid--flyout` อยู่แล้ว,
//      bindMobileAccordion เฉพาะ panel ที่มี `.mobile-dd-group` ลูกอยู่แล้ว) — ทำงานก่อน
//      Promise.all([getGroups(),getCategories()]) resolve เสมอ (ไม่ต้อง await อะไรเลย)
//   2) Async หลัง Firestore resolve สำเร็จ: ถ้ามี categories และ groupCategories() ได้กลุ่มที่ไม่
//      ว่างเปล่าอย่างน้อย 1 กลุ่ม → แทนที่ innerHTML ทั้งเดสก์ท็อป/มือถือ (ทุก grid/panel ที่ query
//      เจอตอน import ผ่าน forEach) แล้วผูก interactivity ใหม่อีกรอบบน markup ที่เพิ่งสร้าง — ถ้า
//      ไม่มี categories เลย/reject → เก็บ static fallback เดิมไว้ทั้งหมด ไม่แตะ DOM
//
// groupCategories(): จัดหมวดย่อยเข้ากลุ่มหมวดใหญ่ตาม group_id ที่ตรงกับ groups collection จริง
// (เรียงตามลำดับที่ groups มาถึง ไม่ได้ sort เองในไฟล์นี้ — orderBy("order") เป็นหน้าที่ของ
// getGroups()/Firestore query ไม่ใช่ groupCategories()) — หมวดย่อยที่ group_id ว่าง/ไม่ตรงกับ
// groups doc ไหนเลย ถูกจัดรวมเข้ากลุ่ม fallback เดียว (id: "__uncategorized__", title:
// "หมวดหมู่สินค้า") เสมอ ต่อท้ายลิสต์กลุ่มจริงทั้งหมด (fallback ถูก push เข้า `order` ตอนพบ
// หมวดย่อยกำพร้าตัวแรกเท่านั้น หลังจาก groups.forEach เดิมเสร็จไปแล้ว จึงอยู่ท้ายลิสต์เสมอไม่ว่า
// จะพบกำพร้าตอนไหนของ categories array) — กลุ่มที่ items.length===0 ถูกกรองทิ้ง (กันปุ่มหมวดใหญ่
// กดแล้วว่างเปล่า) — **หมายเหตุ**: เงื่อนไข `if (!groups.length) return;` หลัง groupCategories()
// ใน .then() เป็นโค้ดที่ไปไม่ถึงจริงในทางปฏิบัติ เพราะ early-return ก่อนหน้า
// (`if (!categories.length) return;`) รับประกันว่าถ้าเข้าถึงจุดนี้ categories.length > 0 เสมอ และ
// ทุกหมวดย่อยต้องถูกจัดเข้ากลุ่มใดกลุ่มหนึ่งเสมอ (จริงหรือ fallback) จึงมีอย่างน้อย 1 กลุ่มที่
// items.length > 0 เสมอ — ไม่ใช่บั๊ก แค่ defensive code ที่ไม่มีทางถูกทริกเกอร์ได้จริงด้วยอินพุตใดๆ
// เลยไม่มีเทสแยกสำหรับเคสนี้ (คุยกับตัวเองไว้ตรงนี้กันงงทีหลังว่าทำไมไม่มี)
//
// ตรวจโค้ดจริงทั้งไฟล์ js/nav-menu.js ก่อนเขียนเทส (อ่านครบ) — ไม่พบบั๊ก

import { test, describe, afterEach } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

let dom;
let importCounter = 0;

// markup จริงจาก index.html (บรรทัด ~407-530) ตัดทอนให้เหลือ 2 หมวดใหญ่/หมวดย่อยพอสังเขป — ใช้ทั้ง
// เดสก์ท็อป (.nav-mega-grid.nav-mega-grid--flyout พร้อมปุ่ม/แผงจริง) และมือถือ (#mobile-dd-panel
// พร้อม .mobile-dd-group จริง) เพื่อยืนยัน static binding เฟส 1 ทำงานบน markup รูปแบบเดียวกับที่
// ผลิตจริงในหน้าเว็บ
function staticDesktopHtml() {
  return `
    <div class="nav-mega-grid nav-mega-grid--flyout">
      <div class="nav-mega-groups">
        <button type="button" class="nav-mega-group-btn active" data-group="safety">ป้ายความปลอดภัย</button>
        <button type="button" class="nav-mega-group-btn" data-group="traffic">ป้ายจราจร</button>
      </div>
      <div class="nav-mega-panel">
        <div class="nav-mega-panel-group active" data-group="safety">
          <a href="products.html?cat=safety" class="nav-mega-item"><span><strong>ป้ายเตือน</strong><span>รายละเอียด</span></span></a>
        </div>
        <div class="nav-mega-panel-group" data-group="traffic">
          <a href="products.html?cat=traffic" class="nav-mega-item nav-mega-item--simple"><strong>ป้ายจราจร HI</strong></a>
        </div>
      </div>
    </div>
  `;
}

function staticMobileHtml() {
  return `
    <div class="mobile-dd-panel" id="mobile-dd-panel">
      <div class="mobile-dd-group">
        <button type="button" class="mobile-dd-group-btn" data-group="safety">ป้ายความปลอดภัย</button>
        <div class="mobile-dd-group-panel">
          <a href="products.html?cat=safety">ป้ายเตือน</a>
        </div>
      </div>
      <div class="mobile-dd-group">
        <button type="button" class="mobile-dd-group-btn" data-group="traffic">ป้ายจราจร</button>
        <div class="mobile-dd-group-panel">
          <a href="products.html?cat=traffic">ป้ายจราจร HI</a>
        </div>
      </div>
      <a href="products.html" class="mobile-dd-viewall">ดูสินค้าทั้งหมด</a>
    </div>
  `;
}

function fullPageHtml() {
  return staticDesktopHtml() + staticMobileHtml();
}

function setupDom(html = fullPageHtml()) {
  dom = new JSDOM(`<!doctype html><html><body>${html}</body></html>`, {
    url: "https://example.test/index.html",
    pretendToBeVisual: true
  });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.requestAnimationFrame = dom.window.requestAnimationFrame;
  return dom;
}

function stubTaxonomy({ groups = [], categories = [] } = {}) {
  globalThis.__GET_DOCS_STUB__ = (ref) => {
    if (ref && ref.path === "groups") return groups.map((g) => ({ id: g.id, data: g }));
    if (ref && ref.path === "categories") return categories.map((c) => ({ id: c.id, data: c }));
    return [];
  };
}

function stubThrow(err) {
  globalThis.__GET_DOCS_STUB__ = () => { throw err; };
}

async function importFresh() {
  importCounter += 1;
  await import(`../js/nav-menu.js?t=${importCounter}`);
  // Promise.all([getGroups(), getCategories()]) -> .then()/.catch() ต้องผ่าน microtask chain
  // หลายชั้น (getDocs -> noopAsync().then() -> Promise.all -> .then/.catch) — เผื่อหลายรอบให้ชัวร์
  await new Promise((r) => setImmediate(r));
  await new Promise((r) => setImmediate(r));
  await new Promise((r) => setImmediate(r));
}

function $(sel) { return dom.window.document.querySelector(sel); }
function $all(sel) { return Array.from(dom.window.document.querySelectorAll(sel)); }

afterEach(() => {
  delete globalThis.__GET_DOCS_STUB__;
});

describe("nav-menu — ไม่มี .nav-mega-grid/.mobile-dd-panel เลยในหน้า", () => {
  test("return ทันที ไม่เรียก getDocs เลยสักครั้ง ไม่ throw", async () => {
    setupDom(`<div id="unrelated"></div>`);
    let called = false;
    globalThis.__GET_DOCS_STUB__ = () => { called = true; return []; };
    await assert.doesNotReject(importFresh());
    assert.equal(called, false, "ไม่ควรมีการเรียก getDocs เลยถ้าไม่มี grid/panel เป้าหมาย");
  });
});

describe("nav-menu — เฟส 1: ผูก interactivity ให้ static markup ทันทีตอน import (ก่อน Firestore resolve)", () => {
  test("bindDesktopFlyout: mouseenter ปุ่มหมวดใหญ่ตัวที่สอง → active ย้ายไปปุ่ม/แผงนั้น ตัวแรกหลุด active", async () => {
    setupDom();
    stubTaxonomy({ categories: [] }); // เก็บ static fallback ไว้ ไม่ยุ่งกับผลการทดสอบเฟส 1
    await importFresh();

    var btnTraffic = $all(".nav-mega-group-btn")[1];
    btnTraffic.dispatchEvent(new dom.window.Event("mouseenter"));

    var btns = $all(".nav-mega-group-btn");
    var panels = $all(".nav-mega-panel-group");
    assert.equal(btns[0].classList.contains("active"), false);
    assert.equal(btns[1].classList.contains("active"), true);
    assert.equal(panels[0].classList.contains("active"), false);
    assert.equal(panels[1].classList.contains("active"), true);
  });

  test("bindDesktopFlyout: click ปุ่ม → preventDefault + active ย้ายเหมือน mouseenter, focus ก็ย้ายเช่นกัน", async () => {
    setupDom();
    stubTaxonomy({ categories: [] });
    await importFresh();

    var btnTraffic = $all(".nav-mega-group-btn")[1];
    var clickEvt = new dom.window.MouseEvent("click", { bubbles: true, cancelable: true });
    btnTraffic.dispatchEvent(clickEvt);
    assert.equal(clickEvt.defaultPrevented, true);
    assert.equal($all(".nav-mega-group-btn")[1].classList.contains("active"), true);

    // สลับกลับไปตัวแรกด้วย focus
    $all(".nav-mega-group-btn")[0].dispatchEvent(new dom.window.Event("focus"));
    assert.equal($all(".nav-mega-group-btn")[0].classList.contains("active"), true);
    assert.equal($all(".nav-mega-group-btn")[1].classList.contains("active"), false);
  });

  test("bindMobileAccordion: คลิกปุ่มหมวดใหญ่ที่ปิดอยู่ → เปิด (class open + maxHeight ไม่เป็น null)", async () => {
    setupDom();
    stubTaxonomy({ categories: [] });
    await importFresh();

    var btn = $all(".mobile-dd-group-btn")[0];
    var sub = $all(".mobile-dd-group-panel")[0];
    btn.click();
    assert.equal(btn.classList.contains("open"), true);
    assert.notEqual(sub.style.maxHeight, "");
  });

  test("bindMobileAccordion: เปิดหมวดใหญ่ที่สองขณะหมวดแรกเปิดอยู่ → หมวดแรกปิดอัตโนมัติ (เปิดได้ทีละหมวด)", async () => {
    setupDom();
    stubTaxonomy({ categories: [] });
    await importFresh();

    var btns = $all(".mobile-dd-group-btn");
    var subs = $all(".mobile-dd-group-panel");
    btns[0].click();
    assert.equal(btns[0].classList.contains("open"), true);

    btns[1].click();
    assert.equal(btns[1].classList.contains("open"), true);
    assert.equal(btns[0].classList.contains("open"), false);
    assert.equal(subs[0].style.maxHeight, "");
  });

  test("bindMobileAccordion: คลิกปุ่มที่เปิดอยู่แล้วซ้ำ → ปิดตัวเอง (toggle)", async () => {
    setupDom();
    stubTaxonomy({ categories: [] });
    await importFresh();

    var btn = $all(".mobile-dd-group-btn")[0];
    btn.click();
    assert.equal(btn.classList.contains("open"), true);
    btn.click();
    assert.equal(btn.classList.contains("open"), false);
  });

  test("bindMobileAccordion: มี #mobile-dd-panel ตั้ง maxHeight ไว้ก่อน + เปิดหมวดย่อย → outer maxHeight ถูกปรับผ่าน requestAnimationFrame", async () => {
    setupDom();
    stubTaxonomy({ categories: [] });
    await importFresh();

    var outer = dom.window.document.getElementById("mobile-dd-panel");
    outer.style.maxHeight = "300px"; // จำลองสถานะ "เมนูมือถือกำลังเปิดอยู่" ที่ main.js ตั้งไว้
    $all(".mobile-dd-group-btn")[0].click();
    await new Promise((r) => dom.window.requestAnimationFrame(r));
    // scrollHeight ใน jsdom คงที่ที่ 0 เสมอ (ไม่มี layout engine จริง) — ยืนยันแค่ว่าค่าถูกเขียนทับ
    // เป็น "0px" (ไม่ใช่ "300px" เดิมที่ค้างอยู่) เพื่อพิสูจน์ branch requestAnimationFrame ทำงานจริง
    assert.equal(outer.style.maxHeight, "0px");
  });

  test("grid ไม่มี class nav-mega-grid--flyout ตอน static (รูปแบบเก่า) → ไม่ผูก bindDesktopFlyout ตอน import, คลิกปุ่มไม่มีผล", async () => {
    setupDom(`
      <div class="nav-mega-grid">
        <div class="nav-mega-groups">
          <button type="button" class="nav-mega-group-btn active" data-group="safety">A</button>
          <button type="button" class="nav-mega-group-btn" data-group="traffic">B</button>
        </div>
      </div>
    `);
    stubTaxonomy({ categories: [] });
    await importFresh();
    $all(".nav-mega-group-btn")[1].dispatchEvent(new dom.window.Event("mouseenter"));
    // ไม่ throw และปุ่มแรกยังคง active เดิม เพราะไม่มี listener ผูกไว้เลย
    assert.equal($all(".nav-mega-group-btn")[0].classList.contains("active"), true);
    assert.equal($all(".nav-mega-group-btn")[1].classList.contains("active"), false);
  });

  test("panel ไม่มี .mobile-dd-group ลูกเลย (มือถือยังไม่มีข้อมูล) → ไม่ผูก bindMobileAccordion ตอน import ไม่ throw", async () => {
    setupDom(`<div class="mobile-dd-panel" id="mobile-dd-panel"></div>`);
    stubTaxonomy({ categories: [] });
    await assert.doesNotReject(importFresh());
  });
});

describe("nav-menu — เฟส 2: Firestore ไม่มี categories เลย/reject → คง static fallback ทั้งหมดไว้", () => {
  test("categories เป็น array ว่าง → ไม่แตะ innerHTML ของ grid/panel เลย", async () => {
    setupDom();
    stubTaxonomy({ groups: [{ id: "safety", name: "ป้ายความปลอดภัย" }], categories: [] });
    await importFresh();
    assert.equal($all(".nav-mega-group-btn").length, 2, "ยังเป็น static เดิม 2 ปุ่ม ไม่ถูกแทนที่");
    assert.equal($(".nav-mega-grid").classList.contains("nav-mega-grid--flyout"), true);
  });

  test("getDocs stub throw → console.warn ถูกเรียก 1 ครั้งพร้อมข้อความภาษาไทย, ไม่แตะ DOM เลย", async () => {
    setupDom();
    stubThrow(new Error("โหลดล้มเหลว"));
    const originalWarn = console.warn;
    const calls = [];
    console.warn = (...args) => calls.push(args);
    try {
      await importFresh();
    } finally {
      console.warn = originalWarn;
    }
    assert.equal(calls.length, 1);
    assert.match(calls[0][0], /ไม่สามารถโหลดหมวดหมู่จาก Firebase ได้/);
    assert.equal(calls[0][1] instanceof Error, true);
    assert.equal($all(".nav-mega-group-btn").length, 2);
    assert.equal($all(".mobile-dd-group").length, 2);
  });

  test("มี categories แต่ทุกอันมี group_id ไม่ตรงกับ groups ที่ส่งมา (groups เป็น array ว่าง) + หมวดกำพร้าเดียว → ยัง 'มี' อย่างน้อย 1 กลุ่ม (fallback) แทนที่ static ตามปกติ ไม่ใช่การคง fallback", async () => {
    setupDom();
    stubTaxonomy({ groups: [], categories: [{ id: "c-1", name: "กำพร้า", group_id: "" }] });
    await importFresh();
    // ต่างจาก 2 เทสก่อนหน้า — เคสนี้ categories.length > 0 จึงต้องเข้าสู่ branch แทนที่ innerHTML จริง
    // (กลุ่ม fallback 1 กลุ่ม) ไม่ใช่การคง static เดิมไว้ — ตรวจแยกในกลุ่มเทสถัดไปอย่างละเอียด
    assert.equal($all(".nav-mega-group-btn").length, 1);
    assert.equal($all(".nav-mega-group-btn")[0].textContent, "หมวดหมู่สินค้า");
  });
});

describe("nav-menu — เฟส 2: Firestore สำเร็จมีข้อมูล → groupCategories() + แทนที่ innerHTML + ผูก interactivity ใหม่", () => {
  const GROUPS = [
    { id: "safety", name: "ป้ายความปลอดภัย" },
    { id: "traffic", name: "ป้ายจราจร" },
    { id: "empty-group", name: "กลุ่มว่างเปล่า" } // ไม่มีหมวดย่อยอ้างถึงเลย → ต้องถูกกรองทิ้ง
  ];
  const CATEGORIES = [
    { id: "c-safety", name: "ป้ายเตือน", icon: "⚠️", description: "รายละเอียด A", group_id: "safety" },
    { id: "c-traffic", name: "ป้ายจราจร HI", group_id: "traffic" }, // ไม่มี description/icon
    { id: "c-orphan-1", name: "กำพร้า1", group_id: "no-such-group" }, // group_id ไม่ตรงกับ groups เลย
    { id: "c-orphan-2", name: "กำพร้า2", group_id: "" } // ไม่มี group_id เลย
  ];

  function importWithData() {
    setupDom();
    stubTaxonomy({ groups: GROUPS, categories: CATEGORIES });
    return importFresh();
  }

  test("กลุ่มว่างเปล่า (empty-group) ถูกกรองทิ้ง, กลุ่มกำพร้าทั้งสองถูกรวมเป็น fallback เดียวท้ายลิสต์", async () => {
    await importWithData();
    var btns = $all(".nav-mega-group-btn");
    assert.equal(btns.length, 3, "safety + traffic + fallback (ไม่รวม empty-group)");
    assert.deepEqual(btns.map((b) => b.getAttribute("data-group")), ["safety", "traffic", "__uncategorized__"]);
    assert.equal(btns[2].textContent, "หมวดหมู่สินค้า");
  });

  test("ปุ่ม/แผงตัวแรกได้ class active อัตโนมัติ ตัวอื่นไม่มี", async () => {
    await importWithData();
    var btns = $all(".nav-mega-group-btn");
    var panels = $all(".nav-mega-panel-group");
    assert.equal(btns[0].classList.contains("active"), true);
    assert.equal(btns[1].classList.contains("active"), false);
    assert.equal(btns[2].classList.contains("active"), false);
    assert.equal(panels[0].classList.contains("active"), true);
    assert.equal(panels[1].classList.contains("active"), false);
  });

  test("รายการสินค้ามี description → มี <span> ซ้อน ไม่ติด class nav-mega-item--simple, ไม่มี description → ติด simple", async () => {
    await importWithData();
    var items = $all(".nav-mega-item");
    var safetyItem = items[0];
    var trafficItem = items[1];
    assert.equal(safetyItem.classList.contains("nav-mega-item--simple"), false);
    assert.equal(safetyItem.querySelector("span span") !== null, true);
    assert.match(safetyItem.querySelector("strong").innerHTML, /⚠️\s*ป้ายเตือน/);

    assert.equal(trafficItem.classList.contains("nav-mega-item--simple"), true);
    assert.equal(trafficItem.querySelector("span") === null || trafficItem.querySelectorAll("span").length === 1, true);
  });

  test("href ของแต่ละรายการใช้ encodeURIComponent(c.id) ต่อท้าย products.html?cat=", async () => {
    await importWithData();
    var items = $all(".nav-mega-item");
    assert.equal(items[0].getAttribute("href"), "products.html?cat=c-safety");
    assert.equal(items[1].getAttribute("href"), "products.html?cat=c-traffic");
  });

  test("กลุ่ม fallback มีหมวดย่อยกำพร้าทั้งสองอยู่ครบ (c-orphan-1 + c-orphan-2)", async () => {
    await importWithData();
    var fallbackPanel = $all(".nav-mega-panel-group")[2];
    var links = Array.from(fallbackPanel.querySelectorAll(".nav-mega-item")).map((a) => a.getAttribute("href"));
    assert.deepEqual(links, [
      "products.html?cat=c-orphan-1",
      "products.html?cat=c-orphan-2"
    ]);
  });

  test("มือถือ: 3 accordion group ตามลำดับเดียวกับเดสก์ท็อป + ลิงก์ 'ดูสินค้าทั้งหมด' อยู่ท้ายสุดเสมอ", async () => {
    await importWithData();
    var panel = dom.window.document.getElementById("mobile-dd-panel");
    var groups = $all(".mobile-dd-group");
    assert.equal(groups.length, 3);
    assert.equal(groups[0].querySelector(".mobile-dd-group-btn").getAttribute("data-group"), "safety");
    assert.equal(groups[2].querySelector(".mobile-dd-group-btn").getAttribute("data-group"), "__uncategorized__");

    var viewAll = panel.querySelector(".mobile-dd-viewall");
    assert.notEqual(viewAll, null);
    assert.equal(viewAll, panel.lastElementChild, "ลิงก์ดูสินค้าทั้งหมดต้องอยู่ท้ายสุดของแผงเสมอ");
    assert.equal(viewAll.getAttribute("href"), "products.html");
  });

  test("มือถือ: ลิงก์หมวดย่อยในแต่ละ accordion ใช้ escapeHtml(name) ตรงตามชื่อจริง ไม่ใส่ไอคอน", async () => {
    await importWithData();
    var safetyGroup = $all(".mobile-dd-group")[0];
    var link = safetyGroup.querySelector(".mobile-dd-group-panel a");
    assert.equal(link.textContent, "ป้ายเตือน", "มือถือไม่แสดง icon ผสมกับชื่อเหมือนเดสก์ท็อป");
    assert.equal(link.getAttribute("href"), "products.html?cat=c-safety");
  });

  test("หลังแทนที่ innerHTML แล้ว interactivity ใหม่ทำงานจริง: mouseenter ปุ่มหมวดใหญ่ที่ 2 บน markup ที่เพิ่งสร้าง → สลับ active ได้", async () => {
    await importWithData();
    var btns = $all(".nav-mega-group-btn");
    btns[1].dispatchEvent(new dom.window.Event("mouseenter"));
    assert.equal($all(".nav-mega-group-btn")[0].classList.contains("active"), false);
    assert.equal($all(".nav-mega-group-btn")[1].classList.contains("active"), true);
  });

  test("หลังแทนที่ innerHTML แล้ว มือถือ accordion ใหม่คลิกเปิดได้จริง", async () => {
    await importWithData();
    var btn = $all(".mobile-dd-group-btn")[1];
    btn.click();
    assert.equal(btn.classList.contains("open"), true);
  });

  test("escapeHtml: ชื่อ/คำอธิบายมีอักขระพิเศษ (& < > \" ') ไม่ถูกแปลความเป็น HTML tag จริง แสดงเป็นข้อความล้วน", async () => {
    setupDom();
    stubTaxonomy({
      groups: [{ id: "g1", name: "หมวด <script>alert(1)</script> & \"พิเศษ\"" }],
      categories: [{
        id: "c1",
        name: "ชื่อ <b>ตัวหนา</b> & 'เดี่ยว'",
        description: "อธิบาย <i>เอียง</i>",
        group_id: "g1"
      }]
    });
    await importFresh();
    var btn = $(".nav-mega-group-btn");
    assert.equal(btn.textContent, `หมวด <script>alert(1)</script> & "พิเศษ"`);
    assert.equal(btn.querySelector("script"), null, "ต้องไม่ถูกแปลงเป็น element script จริง");

    var strong = $(".nav-mega-item strong");
    assert.equal(strong.textContent, "ชื่อ <b>ตัวหนา</b> & 'เดี่ยว'");
    assert.equal(strong.querySelector("b"), null);

    var descSpan = $(".nav-mega-item span span");
    assert.equal(descSpan.textContent, "อธิบาย <i>เอียง</i>");
    assert.equal(descSpan.querySelector("i"), null);
  });

  test("มีหลาย .nav-mega-grid/.mobile-dd-panel ในหน้าเดียว (เช่นเดสก์ท็อป+เมนูซ้อน) → ทุกตัวถูกแทนที่/ผูกใหม่เหมือนกันหมดผ่าน forEach", async () => {
    setupDom(fullPageHtml() + fullPageHtml().replace(/id="mobile-dd-panel"/, 'id="mobile-dd-panel-2"'));
    stubTaxonomy({ groups: GROUPS, categories: CATEGORIES });
    await importFresh();
    assert.equal($all(".nav-mega-grid").length, 2);
    assert.equal($all(".mobile-dd-panel").length, 2);
    $all(".nav-mega-grid").forEach((grid) => {
      assert.equal(grid.querySelectorAll(".nav-mega-group-btn").length, 3);
      assert.equal(grid.classList.contains("nav-mega-grid--flyout"), true);
    });
    $all(".mobile-dd-panel").forEach((panel) => {
      assert.equal(panel.querySelectorAll(".mobile-dd-group").length, 3);
      assert.notEqual(panel.querySelector(".mobile-dd-viewall"), null);
    });
  });
});
