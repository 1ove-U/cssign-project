// test/portfolio-render.test.mjs — รอบที่ 136
//
// ขอบเขต: js/portfolio-render.js (เรนเดอร์การ์ดผลงานจริงจาก Firestore ในกริดผลงาน —
// ใช้ร่วมกันทั้ง portfolio.html เต็มหน้า "#pf-grid" และหน้าแรก "#home-pf-grid" ที่โชว์เฉพาะ
// รายการที่ปักหมุด) — โครงสร้างไฟล์เป็น IIFE top-level side effect (ไม่ export อะไรเลย)
// อ่าน document.getElementById() ตอน import ทันที (grid/isHome/countEl/emptyEl เป็นค่าคงที่
// ระดับ module) แล้วเรียก getPortfolios() ทันที — ใช้แพทเทิร์น import ด้วย query string คนละอัน
// ทุกเทส (`../js/portfolio-render.js?t=N`) เหมือน test/blog-render.test.mjs (รอบ 135) เพื่อบังคับ
// module instance ใหม่ทุกครั้ง — ยืนยันด้วย probe ก่อนว่าใช้ได้จริงในสภาพแวดล้อมนี้เหมือนเดิม
//
// **จุดสำคัญที่ต่างจาก blog-render.js มาก (ต้อง probe ก่อนเขียนเทสจริง เพราะเดาไม่ได้)**:
// crossfadeSwap() ของไฟล์นี้ "ไม่" mutate ทันทีเหมือน blog-render.js — ลำดับจริงคือ (1) ตั้ง
// grid.style.opacity='0' + class is-swapping ทันทีแบบ synchronous (2) รอ FADE_MS (220ms) ผ่าน
// setTimeout ก่อน "แล้วค่อย" เรียก mutate() จริง (เปลี่ยน innerHTML) + set opacity กลับเป็น '1'
// (3) รออีก FADE_MS ถัดไปค่อยลบ class is-swapping — ต่างจาก blog-render.js ที่ mutate() ทันทีแล้ว
// ค่อย fade opacity ทีหลังด้วย requestAnimationFrame คู่ — ยืนยันด้วย probe จริง (ดู
// ผลลัพธ์ probe1 ใน session นี้): เนื้อหา grid ยังว่างอยู่ที่ t=50ms หลัง import แล้วเพิ่งมีเนื้อหา
// จริงที่ t=300ms (ผ่าน FADE_MS แรกแล้ว) — ทุกเทสที่ต้องอ่านเนื้อหาจริงใน grid จึงต้องรอผ่าน
// FADE_MS (220ms) เสมอ ไม่ใช่แค่ microtask เหมือนไฟล์ blog-render.js
//
// **pendingSwapTimer เป็นตัวแปรเดียวใช้ร่วมกันข้าม call** — ถ้า crossfadeSwap ถูกเรียกซ้อนกัน
// (เช่น skeleton แสดงตอน SKELETON_DELAY=260ms แล้วข้อมูลจริงมาถึงก่อน skeleton จะ mutate เสร็จที่
// 480ms) การเรียกครั้งที่สองจะ clearTimeout ตัวแรกทิ้ง แล้วเจอ grid.style.opacity==='0' อยู่แล้ว
// (จากครั้งแรกที่ set ไว้ synchronous) จึง mutate() ทันทีแบบ sync ข้าม delay ไปเลย — ผลคือ
// skeleton ไม่มีทางโผล่ให้เห็นจริงถ้าข้อมูลมาถึงระหว่าง 260–480ms หลัง import (ยืนยันด้วย probe7
// ใน session นี้ก่อนเขียนเทส ไม่ใช่การเดา) — มีเทสเฉพาะ race นี้ 1 เคสด้านล่าง
//
// **ไม่พบบั๊กเชิงฟังก์ชันในโค้ดจริง** — มีข้อสังเกต 1 จุดที่ไม่ใช่บั๊กใหม่ของไฟล์นี้ (ดูหมายเหตุ
// ท้ายไฟล์ REFACTOR-PROGRESS.md รอบนี้): cardHTML() ใส่ URL รูป (`img`) ลงใน `src="..."` โดยไม่ผ่าน
// escapeHtml() (ต่างจาก client/description/tags/title/badge/category ที่ escape หมด และต่างจาก
// js/blog-render.js/js/home-dynamic-showcase.js/js/home-dynamic-social.js ที่ escape URL รูปด้วย)
// — แต่ตรวจแล้วพบว่าเป็นแพทเทิร์นเดิมที่มีอยู่แล้วอีก ≥4 ไฟล์ในโปรเจกต์ (products-cards.js,
// portfolio-lightbox.js, products-detail-popup.js/products-detail-popup-en.js,
// orders-tab-modal-attach.js) ไม่ใช่จุดที่เกิดใหม่เฉพาะไฟล์นี้ และ URL รูปมาจาก Cloudinary ที่
// แอดมินอัปโหลดเองเท่านั้น (ไม่ใช่ user input สาธารณะ) — ไม่แก้โค้ดผลิตภัณฑ์ในรอบนี้ตามธรรมเนียม
// (ขอบเขตรอบนี้คือเขียนเทสให้ไฟล์นี้ ไม่ใช่ไล่ตรวจ/แก้ทั้งโปรเจกต์) เขียนเทสยืนยัน "พฤติกรรมจริง
// ปัจจุบัน" ไว้ (กัน regression ทั้งสองทิศทาง) พร้อมบันทึกไว้ให้ผู้ใช้ตัดสินใจว่าจะทำรอบแก้แยกทีหลังไหม
//
// ตรวจโค้ดจริงทั้งไฟล์ js/portfolio-render.js ก่อนเขียนเทส (อ่านครบ)

import { test, describe, afterEach } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

let dom;
let importCounter = 0;

function setupDom({ html, pathname = "/portfolio.html" } = {}) {
  dom = new JSDOM(`<!doctype html><html><body>${html}</body></html>`, {
    url: `https://example.test${pathname}`,
    pretendToBeVisual: true
  });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.requestAnimationFrame = dom.window.requestAnimationFrame;
  return dom;
}

// หน้า portfolio.html จริง: #pf-tabs (พร้อมปุ่ม filter) + #pf-count + #pf-grid + #pf-empty
function setupFullPage(extraTabsHtml = "") {
  return setupDom({
    html: `
      <div class="product-tabs" id="pf-tabs">
        <button class="product-tab active" data-filter="all">ทั้งหมด</button>
        <button class="product-tab" data-filter="factory">โรงงาน</button>
        <button class="product-tab" data-filter="government">ภาครัฐ</button>
        ${extraTabsHtml}
      </div>
      <span>แสดงผลงานทั้งหมด <strong id="pf-count">0</strong> โครงการ</span>
      <div class="portfolio-grid" id="pf-grid"></div>
      <div class="pf-empty" id="pf-empty">ยังไม่มีผลงานในหมวดหมู่นี้</div>
    `
  });
}

// หน้าแรก: #home-pf-grid ห่อด้วย <section> (ไม่มี tabs/count/empty ในหน้านี้จริง)
function setupHomePage() {
  return setupDom({
    pathname: "/index.html",
    html: `<section class="pf-home-section"><div class="portfolio-grid" id="home-pf-grid"></div></section>`
  });
}

function stubItems(items) {
  globalThis.__GET_DOCS_STUB__ = (ref) => {
    if (ref && ref.path === "portfolios") return items;
    return [];
  };
}

function stubThrow(err) {
  globalThis.__GET_DOCS_STUB__ = () => { throw err; };
}

function item(overrides) {
  return {
    id: overrides.id || "id-" + Math.random().toString(36).slice(2),
    data: {
      title: "ผลงานทดสอบ",
      category: "custom",
      createdAt: 1700000000000,
      ...overrides
    }
  };
}

async function importFresh() {
  importCounter += 1;
  await import(`../js/portfolio-render.js?t=${importCounter}`);
  // รอ microtask chain (getDocs -> getPortfolios -> .then()) ทำงานครบก่อน
  await new Promise((r) => setImmediate(r));
  await new Promise((r) => setImmediate(r));
  // รอผ่าน FADE_MS แรกของ crossfadeSwap (220ms) ที่เนื้อหาจริงถึงจะถูก mutate เข้า grid
  await new Promise((r) => setTimeout(r, 280));
}

function grid() {
  return dom.window.document.getElementById("pf-grid") || dom.window.document.getElementById("home-pf-grid");
}
function countEl() {
  return dom.window.document.getElementById("pf-count");
}
function emptyEl() {
  return dom.window.document.getElementById("pf-empty");
}

afterEach(() => {
  delete globalThis.__GET_DOCS_STUB__;
  delete globalThis.__GET_DOCS_DELAY_MS__;
  delete globalThis.window.CSSIGN_observeReveal;
});

describe("portfolio-render — element ขาดหายไป (ไม่มี #pf-grid/#home-pf-grid เลย)", () => {
  test("ไม่มี grid element เลย → return ทันที ไม่เรียก getPortfolios/getDocs เลย ไม่ throw", async () => {
    setupDom({ html: `<div id="unrelated"></div>` });
    let called = false;
    globalThis.__GET_DOCS_STUB__ = () => { called = true; return []; };
    await assert.doesNotReject(importFresh());
    assert.equal(called, false, "ไม่ควรมีการเรียก getDocs เลยถ้าไม่มี grid ให้เรนเดอร์");
  });
});

describe("portfolio-render — หน้า portfolio.html เต็ม (#pf-grid) — เรนเดอร์การ์ดพื้นฐาน", () => {
  test("มีผลงาน 2 รายการ → เรนเดอร์ทั้งคู่ตามลำดับที่ getPortfolios() คืนมา (ไม่กรอง/ไม่ตัด)", async () => {
    setupFullPage();
    stubItems([
      item({ id: "1", title: "งานที่หนึ่ง", createdAt: 1000 }),
      item({ id: "2", title: "งานที่สอง", createdAt: 2000 })
    ]);
    await importFresh();
    const html = grid().innerHTML;
    assert.match(html, /งานที่หนึ่ง/);
    assert.match(html, /งานที่สอง/);
    const idx1 = html.indexOf("งานที่หนึ่ง");
    const idx2 = html.indexOf("งานที่สอง");
    assert.ok(idx1 < idx2, "ต้องเรียงตามลำดับเดิมที่ได้จาก getPortfolios() (ไม่ sort ซ้ำ)");
    assert.equal(countEl().textContent, "2", "pf-count ไม่ได้ถูกอัปเดตตรงนี้โดยตรง — อัปเดตผ่าน bindDynamicFilter() applyFilter('all') แทน");
  });

  test("badge: category ที่รู้จัก (factory/government/industrial/custom) map เป็นภาษาไทยถูกต้อง", async () => {
    setupFullPage();
    stubItems([
      item({ id: "1", category: "factory" }),
      item({ id: "2", category: "government" }),
      item({ id: "3", category: "industrial" }),
      item({ id: "4", category: "custom" })
    ]);
    await importFresh();
    const html = grid().innerHTML;
    assert.match(html, /โรงงานอุตสาหกรรม/);
    assert.match(html, /ภาครัฐ/);
    assert.match(html, /นิคมอุตสาหกรรม/);
    assert.match(html, /Custom Order/);
  });

  test("category ที่ไม่รู้จัก → badge ใช้ค่า category ดิบ, ไม่มี category เลย → badge fallback เป็น 'ผลงาน'", async () => {
    setupFullPage();
    stubItems([
      item({ id: "1", category: "special-edition" }),
      item({ id: "2", category: undefined })
    ]);
    await importFresh();
    const html = grid().innerHTML;
    assert.match(html, /special-edition/);
    assert.match(html, />ผลงาน</, "ไม่มี category → badge fallback 'ผลงาน'");
  });

  test("data-cat attribute: มี category → escapeHtml(category), ไม่มี category → fallback 'custom'", async () => {
    setupFullPage();
    stubItems([
      item({ id: "1", category: "factory" }),
      item({ id: "2", category: undefined })
    ]);
    await importFresh();
    const cards = dom.window.document.querySelectorAll(".port-card");
    assert.equal(cards[0].getAttribute("data-cat"), "factory");
    assert.equal(cards[1].getAttribute("data-cat"), "custom");
  });

  test("client/description/tags: มีครบ → เรนเดอร์ทั้งหมด, ไม่มีเลย → ไม่มี element ที่เกี่ยวข้องเลย", async () => {
    setupFullPage();
    stubItems([
      item({ id: "1", client: "บริษัท เอบีซี", description: "รายละเอียดงาน", tags: ["ป้ายจราจร", "ทางหลวง"] }),
      item({ id: "2", client: undefined, description: undefined, tags: undefined })
    ]);
    await importFresh();
    const cards = dom.window.document.querySelectorAll(".port-card");
    assert.match(cards[0].innerHTML, /port-client">บริษัท เอบีซี/);
    assert.match(cards[0].innerHTML, /<p>รายละเอียดงาน<\/p>/);
    assert.match(cards[0].innerHTML, /port-tags/);
    assert.match(cards[0].innerHTML, /ป้ายจราจร/);
    assert.match(cards[0].innerHTML, /ทางหลวง/);
    assert.ok(!cards[1].innerHTML.includes("port-client"));
    assert.ok(!cards[1].innerHTML.includes("<p>"));
    assert.ok(!cards[1].innerHTML.includes("port-tags"));
  });

  test("tags ยาวเกิน 3 รายการ → ตัดเหลือแค่ 3 รายการแรกเท่านั้น", async () => {
    setupFullPage();
    stubItems([item({ id: "1", tags: ["a", "b", "c", "d", "e"] })]);
    await importFresh();
    const html = grid().innerHTML;
    assert.match(html, /<span>a<\/span>/);
    assert.match(html, /<span>b<\/span>/);
    assert.match(html, /<span>c<\/span>/);
    assert.ok(!html.includes("<span>d</span>"));
    assert.ok(!html.includes("<span>e</span>"));
  });

  test("title ว่างเปล่า/ไม่มีเลย → h3 fallback เป็น 'ผลงาน'", async () => {
    setupFullPage();
    stubItems([item({ id: "1", title: undefined })]);
    await importFresh();
    assert.match(grid().innerHTML, /<h3>ผลงาน<\/h3>/);
  });

  test("pinned:true → แสดงไอคอนปักหมุด (port-pin-flag), pinned:false/ไม่มี → ไม่แสดง", async () => {
    setupFullPage();
    stubItems([
      item({ id: "1", pinned: true }),
      item({ id: "2", pinned: false }),
      item({ id: "3" })
    ]);
    await importFresh();
    const cards = dom.window.document.querySelectorAll(".port-card");
    assert.match(cards[0].innerHTML, /port-pin-flag/);
    assert.ok(!cards[1].innerHTML.includes("port-pin-flag"));
    assert.ok(!cards[2].innerHTML.includes("port-pin-flag"));
  });

  test("รูปภาพ: ไม่มีรูปเลย → class no-photo ไม่มี <img>, มีรูป 1 รูป → มี <img> ไม่มีปุ่ม zoom/photo-count", async () => {
    setupFullPage();
    stubItems([
      item({ id: "1", images: [] }),
      item({ id: "2", images: ["https://x.test/a.jpg"] })
    ]);
    await importFresh();
    const cards = dom.window.document.querySelectorAll(".port-card");
    assert.match(cards[0].innerHTML, /no-photo/);
    assert.ok(!cards[0].innerHTML.includes("<img"));
    assert.ok(!cards[1].innerHTML.includes("no-photo"));
    assert.match(cards[1].innerHTML, /<img src="https:\/\/x\.test\/a\.jpg"/);
    assert.ok(!cards[1].innerHTML.includes("port-zoom-btn"));
    assert.ok(!cards[1].innerHTML.includes("port-photo-count"));
  });

  test("รูปภาพหลายรูป (>1) → มีปุ่ม zoom และ badge จำนวนรูปถูกต้อง, ใช้รูปแรกเป็น src หลัก", async () => {
    setupFullPage();
    stubItems([item({ id: "1", images: ["https://x.test/first.jpg", "https://x.test/second.jpg", "https://x.test/third.jpg"] })]);
    await importFresh();
    const html = grid().innerHTML;
    assert.match(html, /<img src="https:\/\/x\.test\/first\.jpg"/);
    assert.match(html, /port-zoom-btn/);
    assert.match(html, /port-photo-count/);
    assert.match(html, />3</, "photo-count ต้องแสดงเลข 3");
  });

  test("images มีค่า falsy ปนอยู่ (null/'') → filter(Boolean) ตัดออกก่อนนับจำนวน", async () => {
    setupFullPage();
    stubItems([item({ id: "1", images: ["https://x.test/a.jpg", null, "", "https://x.test/b.jpg"] })]);
    await importFresh();
    const html = grid().innerHTML;
    assert.match(html, />2</, "หลัง filter(Boolean) เหลือ 2 รูปจริง ไม่ใช่ 4");
  });

  test("escapeHtml: title/client/description/tags/category (badge fallback) กัน XSS ครบ", async () => {
    setupFullPage();
    stubItems([
      item({
        id: "1",
        title: '<b>Title</b>',
        client: '<i>Client</i>',
        description: '<u>Desc</u>',
        tags: ['<tag>'],
        category: undefined
      })
    ]);
    await importFresh();
    const html = grid().innerHTML;
    assert.ok(!html.includes("<b>Title</b>"));
    assert.match(html, /&lt;b&gt;Title&lt;\/b&gt;/);
    assert.ok(!html.includes("<i>Client</i>"));
    assert.ok(!html.includes("<u>Desc</u>"));
    assert.ok(!html.includes("<tag>"));
    assert.match(html, /&lt;tag&gt;/);
  });

  test("data-images attribute: escapeHtml(JSON.stringify(imgs)) round-trip ผ่าน dataset.images ได้ปกติ (แม้ URL มีอักขระพิเศษ)", async () => {
    setupFullPage();
    stubItems([item({ id: "1", images: ['https://x.test/a.jpg?x=1&y=2', "https://x.test/b.jpg"] })]);
    await importFresh();
    const card = dom.window.document.querySelector(".port-card");
    const parsed = JSON.parse(card.dataset.images);
    assert.deepEqual(parsed, ['https://x.test/a.jpg?x=1&y=2', "https://x.test/b.jpg"]);
  });

  test("[พฤติกรรมจริงปัจจุบัน — ไม่ใช่จุดที่แก้ในรอบนี้] URL รูปใน src=\"\" ไม่ผ่าน escapeHtml() ต่างจาก client/description/title", async () => {
    setupFullPage();
    // URL ปกติไม่มีอักขระพิเศษ — ต้องถูกใส่ตรงๆ ใน src เป๊ะๆ ไม่ถูกแปลง
    stubItems([item({ id: "1", images: ["https://x.test/normal-image.jpg"] })]);
    await importFresh();
    const html = grid().innerHTML;
    assert.match(html, /<img src="https:\/\/x\.test\/normal-image\.jpg"/, "URL ปกติผ่านตรงๆ ไม่ถูก escape (พฤติกรรมเดิม)");
  });
});

describe("portfolio-render — bindDynamicFilter() (เฉพาะหน้า portfolio.html เต็ม, ไม่ใช่หน้าแรก)", () => {
  test("คลิกแท็บ filter → กรองการ์ดตาม data-cat ถูกต้อง, อัปเดต pf-count ตามจำนวนที่มองเห็น", async () => {
    setupFullPage();
    stubItems([
      item({ id: "1", category: "factory" }),
      item({ id: "2", category: "government" }),
      item({ id: "3", category: "factory" })
    ]);
    await importFresh();
    assert.equal(countEl().textContent, "3");
    const factoryTab = dom.window.document.querySelector('[data-filter="factory"]');
    factoryTab.dispatchEvent(new dom.window.Event("click", { bubbles: true }));
    assert.equal(countEl().textContent, "2");
    const visibleCards = Array.from(grid().querySelectorAll(".port-card")).filter((c) => !c.classList.contains("pf-hidden"));
    assert.equal(visibleCards.length, 2);
    assert.ok(visibleCards.every((c) => c.getAttribute("data-cat") === "factory"));
  });

  test("filter 'all' → แสดงทุกใบ, ไม่ตรงหมวดเลย → pf-hidden ทุกใบ + pf-empty ได้ class show", async () => {
    setupFullPage();
    stubItems([item({ id: "1", category: "factory" })]);
    await importFresh();
    const govTab = dom.window.document.querySelector('[data-filter="government"]');
    govTab.dispatchEvent(new dom.window.Event("click", { bubbles: true }));
    assert.equal(countEl().textContent, "0");
    assert.ok(emptyEl().classList.contains("show"));
    const allTab = dom.window.document.querySelector('[data-filter="all"]');
    allTab.dispatchEvent(new dom.window.Event("click", { bubbles: true }));
    assert.equal(countEl().textContent, "1");
    assert.ok(!emptyEl().classList.contains("show"));
  });

  test("แท็บที่ active ตั้งแต่ต้น (ไม่ใช่ 'all') → ใช้กรองทันทีตอน render เสร็จ ไม่ต้องรอคลิก", async () => {
    setupDom({
      html: `
        <div class="product-tabs" id="pf-tabs">
          <button class="product-tab" data-filter="all">ทั้งหมด</button>
          <button class="product-tab active" data-filter="government">ภาครัฐ</button>
        </div>
        <strong id="pf-count">0</strong>
        <div class="portfolio-grid" id="pf-grid"></div>
        <div class="pf-empty" id="pf-empty"></div>
      `
    });
    stubItems([item({ id: "1", category: "factory" }), item({ id: "2", category: "government" })]);
    await importFresh();
    assert.equal(countEl().textContent, "1", "ต้องกรองตามแท็บ active เดิม (government) ทันทีหลัง render");
  });

  test("ไม่มี #pf-tabs เลย → ไม่ throw, ไม่มีการกรองใดๆ (การ์ดทุกใบยังโชว์ปกติ)", async () => {
    setupDom({
      html: `<strong id="pf-count">0</strong><div class="portfolio-grid" id="pf-grid"></div><div class="pf-empty" id="pf-empty"></div>`
    });
    stubItems([item({ id: "1" }), item({ id: "2" })]);
    await assert.doesNotReject(importFresh());
    assert.equal(grid().querySelectorAll(".port-card").length, 2);
  });

  test("ไม่มี #pf-count/#pf-empty เลย → คลิก filter ไม่ throw (แค่ข้ามการอัปเดต)", async () => {
    setupDom({
      html: `
        <div class="product-tabs" id="pf-tabs">
          <button class="product-tab active" data-filter="all">ทั้งหมด</button>
          <button class="product-tab" data-filter="factory">โรงงาน</button>
        </div>
        <div class="portfolio-grid" id="pf-grid"></div>
      `
    });
    stubItems([item({ id: "1", category: "government" })]);
    await importFresh();
    const factoryTab = dom.window.document.querySelector('[data-filter="factory"]');
    assert.doesNotThrow(() => factoryTab.dispatchEvent(new dom.window.Event("click", { bubbles: true })));
  });
});

describe("portfolio-render — หน้าแรก (#home-pf-grid) — เฉพาะรายการปักหมุด", () => {
  test("มีทั้งปักหมุดและไม่ปักหมุด → แสดงเฉพาะที่ pinned:true เท่านั้น", async () => {
    setupHomePage();
    stubItems([
      item({ id: "1", title: "ไม่ปักหมุด", pinned: false }),
      item({ id: "2", title: "ปักหมุด", pinned: true })
    ]);
    await importFresh();
    const html = grid().innerHTML;
    assert.match(html, /ปักหมุด/);
    assert.ok(!html.includes("ไม่ปักหมุด"));
  });

  test("เรียงตาม order ก่อน แล้วค่อย createdAt (ascending ทั้งคู่) เมื่อ order เท่ากัน", async () => {
    setupHomePage();
    stubItems([
      item({ id: "1", title: "OrderสองA", pinned: true, order: 2, createdAt: 100 }),
      item({ id: "2", title: "OrderหนึงB", pinned: true, order: 1, createdAt: 999 }),
      item({ id: "3", title: "OrderหนึงA", pinned: true, order: 1, createdAt: 500 })
    ]);
    await importFresh();
    const html = grid().innerHTML;
    const idxA = html.indexOf("OrderหนึงA");
    const idxB = html.indexOf("OrderหนึงB");
    const idxTwo = html.indexOf("OrderสองA");
    assert.ok(idxA !== -1 && idxB !== -1 && idxTwo !== -1);
    assert.ok(idxA < idxB, "order เท่ากัน (1) → เรียงตาม createdAt เดิม (500 < 999)");
    assert.ok(idxB < idxTwo, "order 1 ต้องมาก่อน order 2");
  });

  test("ไม่มี order ระบุเลย → ถือเป็น 0 (ไม่ throw, ไม่พังลำดับ)", async () => {
    setupHomePage();
    stubItems([item({ id: "1", title: "ไม่มีorder", pinned: true, order: undefined, createdAt: 1 })]);
    await assert.doesNotReject(importFresh());
    assert.match(grid().innerHTML, /ไม่มีorder/);
  });

  test("ไม่มีรายการปักหมุดเลยสักอัน (แม้จะมีผลงานอื่นอยู่) → showEmptyState() แบบหน้าแรก (ซ่อนทั้ง section)", async () => {
    setupHomePage();
    stubItems([item({ id: "1", pinned: false }), item({ id: "2" })]);
    await importFresh();
    const section = grid().closest("section");
    assert.equal(section.style.display, "none");
  });

  test("ไม่มีผลงานเลยทั้งระบบ (array ว่าง) → showEmptyState() หน้าแรกเหมือนกัน", async () => {
    setupHomePage();
    stubItems([]);
    await importFresh();
    assert.equal(grid().closest("section").style.display, "none");
  });

  test("ไม่มี <section> ห่ออยู่เลย → showEmptyState() ไม่ throw (แค่ไม่มีอะไรให้ซ่อน)", async () => {
    setupDom({ pathname: "/index.html", html: `<div class="portfolio-grid" id="home-pf-grid"></div>` });
    stubItems([]);
    await assert.doesNotReject(importFresh());
  });

  test("หน้าแรก: bindDynamicFilter() ไม่ถูกเรียกเลย (ไม่มี #pf-tabs ให้ผูกอยู่แล้วในหน้านี้จริง แต่ยืนยันไม่ throw)", async () => {
    setupHomePage();
    stubItems([item({ id: "1", pinned: true, title: "A" }), item({ id: "2", pinned: true, title: "B" })]);
    await assert.doesNotReject(importFresh());
    assert.match(grid().innerHTML, /A/);
    assert.match(grid().innerHTML, /B/);
  });
});

describe("portfolio-render — ไม่มีผลงานเลย/getPortfolios() ล้มเหลว (หน้า portfolio.html เต็ม)", () => {
  test("array ว่างเปล่า → showEmptyState(): เคลียร์ grid, pf-count='0', pf-empty แสดงข้อความ+class show", async () => {
    setupFullPage();
    stubItems([]);
    await importFresh();
    assert.equal(grid().innerHTML, "");
    assert.equal(countEl().textContent, "0");
    assert.match(emptyEl().textContent, /ยังไม่มีผลงานในระบบ/);
    assert.ok(emptyEl().classList.contains("show"));
  });

  test("getPortfolios() reject → showEmptyState() เหมือนกัน (ไม่ throw ออกไปนอก init)", async () => {
    setupFullPage();
    stubThrow(new Error("network down"));
    await assert.doesNotReject(importFresh());
    assert.equal(grid().innerHTML, "");
    assert.ok(emptyEl().classList.contains("show"));
  });

  test("ไม่มี #pf-count/#pf-empty เลย → showEmptyState() ไม่ throw (แค่ข้ามการอัปเดตส่วนที่ไม่มี)", async () => {
    setupDom({ html: `<div class="portfolio-grid" id="pf-grid">เดิม</div>` });
    stubItems([]);
    await assert.doesNotReject(importFresh());
  });
});

describe("portfolio-render — crossfadeSwap: กลไก opacity/is-swapping/delay จริง", () => {
  test("path ปกติ (opacity เริ่มไม่ใช่ '0'): ตั้ง opacity='0'+is-swapping ทันที, เนื้อหายังไม่เปลี่ยนจนผ่าน FADE_MS", async () => {
    setupFullPage();
    stubItems([item({ id: "1", title: "เนื้อหาใหม่" })]);
    importCounter += 1;
    await import(`../js/portfolio-render.js?t=${importCounter}`);
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));
    // ตอนนี้ getPortfolios() resolve แล้วแต่ crossfadeSwap ยังไม่ผ่าน FADE_MS (220ms)
    assert.equal(grid().style.opacity, "0");
    assert.ok(grid().classList.contains("is-swapping"));
    assert.ok(!grid().innerHTML.includes("เนื้อหาใหม่"), "เนื้อหาต้องยังไม่ถูก mutate จนกว่าจะผ่าน FADE_MS");
    await new Promise((r) => setTimeout(r, 280));
    assert.match(grid().innerHTML, /เนื้อหาใหม่/, "หลังผ่าน FADE_MS แล้วต้องมีเนื้อหาจริง");
    assert.equal(grid().style.opacity, "1", "ต้องกลับเป็น 1 ทันทีที่ mutate เสร็จ");
  });

  test("class is-swapping หลุดออกหลังผ่าน FADE_MS รอบที่สอง (นับจากตอน mutate เสร็จ)", async () => {
    setupFullPage();
    stubItems([item({ id: "1" })]);
    await importFresh(); // รอผ่าน FADE_MS แรกแล้ว (mutate เสร็จ, opacity='1', is-swapping ยังติดอยู่)
    assert.ok(grid().classList.contains("is-swapping"), "ทันทีหลัง mutate เสร็จ class ต้องยังไม่หลุด");
    await new Promise((r) => setTimeout(r, 260));
    assert.ok(!grid().classList.contains("is-swapping"), "หลังผ่าน FADE_MS รอบสองแล้วต้องหลุด");
  });

  test("grid ถูกซ่อนโดย scroll-reveal อยู่ก่อนแล้ว (opacity==='0' ตั้งแต่ต้น) → mutate ทันทีแบบ sync ไม่รอ FADE_MS เลย ไม่ติด is-swapping", async () => {
    setupFullPage();
    grid().style.opacity = "0";
    stubItems([item({ id: "1", title: "โผล่ทันที" })]);
    importCounter += 1;
    await import(`../js/portfolio-render.js?t=${importCounter}`);
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));
    assert.match(grid().innerHTML, /โผล่ทันที/, "ต้องมีเนื้อหาทันทีไม่ต้องรอ FADE_MS เพราะ opacity เป็น 0 อยู่แล้ว");
    assert.equal(grid().style.opacity, "0", "opacity ต้องคงที่ 0 ไม่ถูกเปลี่ยน");
    assert.ok(!grid().classList.contains("is-swapping"));
  });
});

describe("portfolio-render — pendingSwapTimer race: skeleton vs ข้อมูลจริงมาถึงก่อน skeleton ทัน mutate", () => {
  test("ข้อมูลมาถึงระหว่าง 260–480ms (หลัง skeleton trigger แต่ก่อน skeleton mutate) → skeleton ไม่มีทางโผล่เลย ข้อมูลจริงแสดงทันทีแทน", async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    setupFullPage();
    globalThis.__GET_DOCS_DELAY_MS__ = 300; // ระหว่าง SKELETON_DELAY(260) กับจุดที่ skeleton จะ mutate จริง(480)
    stubItems([item({ id: "1", title: "ข้อมูลจริงไม่ต้องรอ" })]);

    importCounter += 1;
    await import(`../js/portfolio-render.js?t=${importCounter}`);
    t.mock.timers.tick(300);
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));
    assert.ok(!grid().innerHTML.includes("port-skel-card"), "skeleton ต้องไม่เคยถูก mutate เข้าไปเลยในเส้นทางนี้");
    assert.match(grid().innerHTML, /ข้อมูลจริงไม่ต้องรอ/, "ข้อมูลจริงต้องโผล่ทันทีแบบ sync เพราะ opacity เป็น 0 จาก skeleton call ก่อนหน้าอยู่แล้ว");
    t.mock.timers.reset();
  });
});

describe("portfolio-render — skeleton loading state (race กับเวลาโหลดจริง)", () => {
  test("โหลดเร็ว (ไม่มี delay) → ไม่มีทางเห็น skeleton เลย (settled ก่อน timer 260ms เสมอ)", async () => {
    setupFullPage();
    stubItems([item({ id: "1" })]);
    await importFresh();
    assert.ok(!grid().innerHTML.includes("port-skel-card"));
  });

  test("โหลดช้าจริง (>480ms ผ่าน __GET_DOCS_DELAY_MS__) → เห็น skeleton ก่อน แล้วเปลี่ยนเป็นข้อมูลจริงหลังโหลดเสร็จ", async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    setupFullPage();
    globalThis.__GET_DOCS_DELAY_MS__ = 5000;
    stubItems([item({ id: "1", title: "โหลดช้า" }), item({ id: "2", title: "โหลดช้า2" })]);

    importCounter += 1;
    await import(`../js/portfolio-render.js?t=${importCounter}`);
    t.mock.timers.tick(260); // ผ่าน SKELETON_DELAY -> showSkeleton() เริ่ม crossfadeSwap (opacity=0)
    t.mock.timers.tick(220); // ผ่าน FADE_MS แรกของ skeleton -> mutate จริง (skeleton HTML เข้า DOM, opacity กลับเป็น '1' ในคอลแบ็กเดียวกัน)
    assert.match(grid().innerHTML, /port-skel-card/, "ต้องเห็น skeleton หลังผ่าน 480ms รวม ที่ข้อมูลยังไม่มา");

    t.mock.timers.tick(5000); // getDocs delay ผ่าน -> ข้อมูลจริง resolve -> เรียก crossfadeSwap() รอบใหม่
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));
    // ตอนที่ skeleton mutate() รันเสร็จ (480ms) มันตั้ง opacity กลับเป็น '1' เองในคอลแบ็กเดียวกัน (ดูโค้ด
    // crossfadeSwap) ดังนั้นตอนข้อมูลจริง resolve ที่ 5480ms grid ไม่ได้ opacity==='0' อีกต่อไป —
    // crossfadeSwap() รอบข้อมูลจริงจึงเดินเส้นทางปกติ (ตั้ง opacity='0' ใหม่ + รอ FADE_MS อีกรอบ) ไม่ใช่
    // fast path แบบ sync — ต้อง tick(220) เพิ่มอีกรอบก่อนเนื้อหาจริงจะเข้า DOM (ยืนยันด้วย probe8/9 ก่อน
    // เขียนเทส ไม่ใช่การเดา — ต่างจากเคส pendingSwapTimer race ด้านบนที่ข้อมูลมาถึง "ก่อน" skeleton จะ
    // mutate เสร็จ ซึ่ง opacity ยังเป็น '0' ค้างอยู่จริง)
    assert.match(grid().innerHTML, /port-skel-card/, "ที่ 5480ms ยังเป็น skeleton อยู่ (เพิ่งเริ่มรอบ delay ใหม่)");
    t.mock.timers.tick(220);
    assert.match(grid().innerHTML, /โหลดช้า2/);
    assert.ok(!grid().innerHTML.includes("port-skel-card"), "skeleton ต้องหายไปหลังข้อมูลจริงมาถึงและผ่าน FADE_MS รอบใหม่แล้ว");
    t.mock.timers.reset();
  });

  test("โหลดช้ากว่า 480ms แต่สุดท้าย reject → skeleton หายไป เปลี่ยนเป็น showEmptyState() แทน", async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    setupFullPage();
    globalThis.__GET_DOCS_DELAY_MS__ = 5000;
    stubThrow(new Error("slow network fail"));

    importCounter += 1;
    await import(`../js/portfolio-render.js?t=${importCounter}`);
    t.mock.timers.tick(260);
    t.mock.timers.tick(220);
    assert.match(grid().innerHTML, /port-skel-card/);

    t.mock.timers.tick(5000);
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));
    // เช่นเดียวกับเทสด้านบน: opacity กลับเป็น '1' ไปแล้วตอน skeleton mutate เสร็จ -> showEmptyState()'s
    // crossfadeSwap(() => grid.innerHTML='') เดินเส้นทางปกติ ต้องรอ FADE_MS อีกรอบก่อน grid จะว่างจริง
    t.mock.timers.tick(220);
    assert.equal(grid().innerHTML, "", "showEmptyState() (ไม่ใช่หน้าแรก) เคลียร์ grid ให้ว่างเปล่าหลังผ่าน FADE_MS รอบใหม่");
    assert.ok(emptyEl().classList.contains("show"));
    t.mock.timers.reset();
  });

  test("จำนวน skeleton card = max(จำนวนการ์ดเดิมใน grid, 6) สำหรับหน้าไม่ใช่หน้าแรก", async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    setupFullPage();
    globalThis.__GET_DOCS_DELAY_MS__ = 5000;
    stubItems([item({ id: "1" })]);
    importCounter += 1;
    await import(`../js/portfolio-render.js?t=${importCounter}`);
    t.mock.timers.tick(260);
    t.mock.timers.tick(220);
    const count = grid().querySelectorAll(".port-skel-card").length;
    assert.equal(count, 6, "grid เริ่มว่างเปล่า (0 การ์ดเดิม) -> ใช้ max(0,6)=6");
    t.mock.timers.reset();
  });

  test("จำนวน skeleton card = max(จำนวนการ์ดเดิม, 3) สำหรับหน้าแรก", async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    setupHomePage();
    globalThis.__GET_DOCS_DELAY_MS__ = 5000;
    stubItems([item({ id: "1", pinned: true })]);
    importCounter += 1;
    await import(`../js/portfolio-render.js?t=${importCounter}`);
    t.mock.timers.tick(260);
    t.mock.timers.tick(220);
    const count = grid().querySelectorAll(".port-skel-card").length;
    assert.equal(count, 3, "หน้าแรกเริ่มว่างเปล่า -> ใช้ max(0,3)=3");
    t.mock.timers.reset();
  });
});

describe("portfolio-render — LOAD_TIMEOUT_MS (8000ms) safety net", () => {
  test("getPortfolios() ค้างเกิน 8000ms (ไม่ resolve/reject เลย) → fallback เป็น showEmptyState() พร้อม console.warn", async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    setupFullPage();
    globalThis.__GET_DOCS_DELAY_MS__ = 999999999; // ไม่มีทาง resolve ทันเวลา
    stubItems([item({ id: "1", title: "ไม่มีทางมาถึง" })]);

    const originalWarn = console.warn;
    let warned = "";
    console.warn = (msg) => { warned = msg; };

    importCounter += 1;
    await import(`../js/portfolio-render.js?t=${importCounter}`);
    t.mock.timers.tick(8000);
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));
    t.mock.timers.tick(300); // ให้ crossfadeSwap ของ showEmptyState (ถ้ามี delay) ทำงานจนจบ

    assert.equal(grid().innerHTML, "", "showEmptyState() ต้องทำงานหลัง timeout");
    assert.match(warned, /โหลดผลงานจาก Firebase นานเกินไป/);
    console.warn = originalWarn;
    t.mock.timers.reset();
  });

  test("ข้อมูลมาถึงหลัง timeout ไปแล้ว (late resolve) → ไม่ throw, ไม่ทับ showEmptyState() ที่แสดงไปแล้วด้วยข้อมูลเก่า", async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    setupFullPage();
    globalThis.__GET_DOCS_DELAY_MS__ = 8500; // resolve หลัง timeout(8000) ไปแล้ว
    stubItems([item({ id: "1", title: "มาสายเกินไป" })]);

    importCounter += 1;
    await import(`../js/portfolio-render.js?t=${importCounter}`);
    t.mock.timers.tick(8000);
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));
    assert.equal(grid().innerHTML, "", "timeout ทำงานก่อนแล้ว grid ต้องว่างจาก showEmptyState()");

    t.mock.timers.tick(1000); // ให้ getDocs delay(8500) ที่เหลือผ่านไปด้วย
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));
    t.mock.timers.tick(500);
    assert.doesNotMatch(grid().innerHTML, /มาสายเกินไป/, "ข้อมูลที่มาสายหลัง timeout ต้องไม่ถูกเรนเดอร์ทับ (timedOut guard)");
    t.mock.timers.reset();
  });
});

describe("portfolio-render — observeCardsReveal() เรียก window.CSSIGN_observeReveal ถ้ามี", () => {
  test("เรียกด้วย grid element จริงเมื่อ render การ์ดสำเร็จ (หน้า portfolio.html เต็ม)", async () => {
    setupFullPage();
    let calledWith = null;
    dom.window.CSSIGN_observeReveal = (el) => { calledWith = el; };
    stubItems([item({ id: "1" })]);
    await importFresh();
    assert.equal(calledWith, grid());
  });

  test("เรียกด้วย grid element จริงเมื่อ render สำเร็จบนหน้าแรก (pinned items)", async () => {
    setupHomePage();
    let calledWith = null;
    dom.window.CSSIGN_observeReveal = (el) => { calledWith = el; };
    stubItems([item({ id: "1", pinned: true })]);
    await importFresh();
    assert.equal(calledWith, grid());
  });

  test("ไม่ถูกเรียกเมื่อไม่มีผลงานเลย (showEmptyState)", async () => {
    setupFullPage();
    let called = false;
    dom.window.CSSIGN_observeReveal = () => { called = true; };
    stubItems([]);
    await importFresh();
    assert.equal(called, false);
  });

  test("ไม่มี window.CSSIGN_observeReveal เลย (undefined) → ไม่ throw", async () => {
    setupFullPage();
    stubItems([item({ id: "1" })]);
    await assert.doesNotReject(importFresh());
  });
});
