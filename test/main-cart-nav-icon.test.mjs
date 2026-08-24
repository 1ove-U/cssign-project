// test/main-cart-nav-icon.test.mjs — P3.0 Phase 1 รอบย่อย 3
//
// jsdom test สำหรับส่วนไอคอนตะกร้า+badge ที่ cartNavIcon() ฉีดเข้า .nav-actions (เดสก์ท็อป) +
// .mobile-links (มือถือ) ใน js/main.js — ทำงานคู่กับ myOrdersNavLink() ที่รันก่อนหน้าในไฟล์
// เดียวกัน (ใช้ .nav-my-orders-trigger/.mobile-my-orders-link เป็นจุด anchor แทรกต่อ ถ้าไม่มี
// ให้ fallback ไปที่ .nav-track-trigger/[data-track-modal-open] แทน)
//
// สร้างไฟล์แยกจาก test/main-my-orders-nav-link.test.mjs (ไม่ขยายไฟล์เดิม) เพราะเป็นคนละ IIFE/
// concern กัน (cartNavIcon() ไม่ใช่ myOrdersNavLink()) — ตามธรรมเนียมที่โปรเจกต์นี้ใช้อยู่แล้ว
// เช่น test/cart.test.mjs แยกจาก test/cart-global.test.mjs แม้อยู่โดเมนเดียวกัน
//
// วิธีทดสอบ: โหลด js/main.js เป็น <script> จริงเข้า JSDOM window (runScripts: "dangerously")
// เหมือน test/main-js-dom.test.mjs ทุกประการ — จำลอง window.CSSignCart.getCartCount() เอง
// (ไม่ import js/cart-global.js จริง เพราะไฟล์นั้นเป็น ES module รัน top-level dispatchCartUpdated()
// ทันที ซึ่งทดสอบแยกอยู่แล้วใน test/cart-global.test.mjs — ที่นี่สนใจแค่ฝั่ง main.js/listener)

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const mainJsSource = readFileSync(new URL("../js/main.js", import.meta.url), "utf-8");

// โครง DOM เดียวกับ test/main-my-orders-nav-link.test.mjs (มี .nav-my-orders-trigger/
// .mobile-my-orders-link พร้อมอยู่แล้ว จำลองว่า myOrdersNavLink() ได้แทรกไปแล้วก่อนหน้า — ตรงกับ
// ลำดับการรันจริงในไฟล์ที่ myOrdersNavLink() มาก่อน cartNavIcon() เสมอ)
const baseHtmlWithMyOrders = `<!doctype html>
<html>
<head></head>
<body>
  <header id="site-header">
    <div class="nav-actions">
      <a href="contact.html" class="btn btn-primary btn-sm">ขอใบเสนอราคา</a>
      <a href="my-account.html" class="nav-icon-btn nav-my-orders-trigger">account</a>
      <button type="button" class="nav-icon-btn nav-track-trigger" data-track-modal-open>trigger</button>
      <button class="nav-burger" id="burger-btn" aria-expanded="false"></button>
    </div>
  </header>
  <nav id="mobile-menu" class="mobile-menu">
    <button id="mobile-close-btn"></button>
    <div class="mobile-links">
      <a href="#top">หน้าแรก</a>
      <a href="portfolio.html">ผลงาน</a>
      <a href="#" data-track-modal-open>เช็คสถานะคำสั่งผลิต</a>
      <a href="my-account.html" class="mobile-my-orders-link">บัญชีของฉัน</a>
      <a href="contact.html">ติดต่อ</a>
    </div>
  </nav>
</body>
</html>`;

// จำลองหน้าที่ myOrdersNavLink() ข้ามตัวเอง (เช่น my-account.html) — ไม่มี
// .nav-my-orders-trigger/.mobile-my-orders-link เลย ต้อง fallback ไป .nav-track-trigger/
// [data-track-modal-open] แทน
const baseHtmlWithoutMyOrders = `<!doctype html>
<html>
<head></head>
<body>
  <header id="site-header">
    <div class="nav-actions">
      <a href="contact.html" class="btn btn-primary btn-sm">ขอใบเสนอราคา</a>
      <button type="button" class="nav-icon-btn nav-track-trigger" data-track-modal-open>trigger</button>
      <button class="nav-burger" id="burger-btn" aria-expanded="false"></button>
    </div>
  </header>
  <nav id="mobile-menu" class="mobile-menu">
    <button id="mobile-close-btn"></button>
    <div class="mobile-links">
      <a href="#" data-track-modal-open>เช็คสถานะคำสั่งผลิต</a>
      <a href="contact.html">ติดต่อ</a>
    </div>
  </nav>
</body>
</html>`;

function makeDom(html, url) {
  return new JSDOM(html, {
    url: url || "https://cssign.test/about.html",
    runScripts: "dangerously",
    pretendToBeVisual: true,
  });
}

function runMainJs(dom) {
  const scriptEl = dom.window.document.createElement("script");
  scriptEl.textContent = mainJsSource;
  dom.window.document.body.appendChild(scriptEl);
}

describe("js/main.js — cartNavIcon() (P3.0 Phase 1 รอบย่อย 3)", () => {
  test("แทรกปุ่มไอคอนตะกร้าใน .nav-actions ต่อจาก .nav-my-orders-trigger (ก่อน .nav-track-trigger)", () => {
    const dom = makeDom(baseHtmlWithMyOrders, "https://cssign.test/about.html");
    runMainJs(dom);
    const doc = dom.window.document;
    const cartBtn = doc.querySelector(".nav-cart-trigger");
    assert.ok(cartBtn, "ควรมี .nav-cart-trigger ถูกสร้างขึ้น");
    assert.equal(cartBtn.tagName, "BUTTON");
    assert.equal(cartBtn.getAttribute("aria-label"), "ตะกร้าสินค้า");
    assert.ok(cartBtn.classList.contains("nav-icon-btn"), "ต้องใช้ class เดิม .nav-icon-btn ไม่เพิ่ม CSS ใหม่สำหรับตัวปุ่มเอง");
    assert.ok(cartBtn.querySelector(".nav-cart-badge"), "ต้องมี badge span อยู่ข้างใน");

    const navActions = doc.querySelector(".nav-actions");
    const children = Array.from(navActions.children);
    const myOrdersIdx = children.indexOf(doc.querySelector(".nav-my-orders-trigger"));
    const cartIdx = children.indexOf(cartBtn);
    const trackIdx = children.indexOf(doc.querySelector(".nav-track-trigger"));
    assert.ok(myOrdersIdx < cartIdx && cartIdx < trackIdx, "ลำดับต้องเป็น: บัญชีของฉัน → ตะกร้า → เช็คสถานะ");
  });

  test("แทรกลิงก์ตะกร้าใน .mobile-links ต่อจาก .mobile-my-orders-link ทันที", () => {
    const dom = makeDom(baseHtmlWithMyOrders, "https://cssign.test/index.html");
    runMainJs(dom);
    const doc = dom.window.document;
    const cartLink = doc.querySelector(".mobile-cart-link");
    assert.ok(cartLink, "ควรมี .mobile-cart-link ถูกสร้างขึ้น");
    assert.equal(cartLink.getAttribute("href"), "#");
    assert.ok(cartLink.textContent.startsWith("ตะกร้าสินค้า"));
    assert.ok(cartLink.querySelector(".mobile-cart-badge"), "ต้องมี badge span อยู่ข้างใน");

    const mobileLinks = doc.querySelector(".mobile-links");
    const children = Array.from(mobileLinks.children);
    const myOrdersLink = doc.querySelector(".mobile-my-orders-link");
    assert.equal(children[children.indexOf(myOrdersLink) + 1], cartLink, "ต้องอยู่ถัดจากลิงก์บัญชีของฉันทันที");
  });

  test("คลิกลิงก์ตะกร้าบนมือถือ: preventDefault ไม่พาไปไหน (ยังไม่มีหน้า/modal ตะกร้าจริงในรอบนี้)", () => {
    const dom = makeDom(baseHtmlWithMyOrders, "https://cssign.test/index.html");
    runMainJs(dom);
    const doc = dom.window.document;
    const cartLink = doc.querySelector(".mobile-cart-link");
    const evt = new dom.window.MouseEvent("click", { bubbles: true, cancelable: true });
    cartLink.dispatchEvent(evt);
    assert.equal(evt.defaultPrevented, true, "click ต้องถูก preventDefault เสมอในรอบนี้");
  });

  test("หน้าที่ myOrdersNavLink() ข้ามตัวเอง (ไม่มี .nav-my-orders-trigger/.mobile-my-orders-link เลย): fallback ไปแทรกต่อจาก .nav-track-trigger/[data-track-modal-open] แทน", () => {
    const dom = makeDom(baseHtmlWithoutMyOrders, "https://cssign.test/my-account.html");
    runMainJs(dom);
    const doc = dom.window.document;
    assert.ok(doc.querySelector(".nav-cart-trigger"), "ไอคอนตะกร้าต้องยังโผล่แม้ไม่มีปุ่มบัญชีของฉันในหน้านี้");
    assert.ok(doc.querySelector(".mobile-cart-link"), "ลิงก์ตะกร้ามือถือต้องยังโผล่เช่นกัน");

    const navActions = doc.querySelector(".nav-actions");
    const children = Array.from(navActions.children);
    const trackIdx = children.indexOf(doc.querySelector(".nav-track-trigger"));
    const cartIdx = children.indexOf(doc.querySelector(".nav-cart-trigger"));
    assert.ok(trackIdx < cartIdx, "ต้องแทรกต่อจากปุ่มเช็คสถานะเดิมเมื่อไม่มีปุ่มบัญชีของฉันให้ยึด");
  });

  test("หน้า /en/*: label เป็นภาษาอังกฤษ 'Cart'", () => {
    const dom = makeDom(baseHtmlWithMyOrders, "https://cssign.test/en/about.html");
    runMainJs(dom);
    const doc = dom.window.document;
    assert.equal(doc.querySelector(".nav-cart-trigger").getAttribute("aria-label"), "Cart");
    assert.ok(doc.querySelector(".mobile-cart-link").textContent.startsWith("Cart"));
  });

  test("ไม่ throw และไม่สร้างอะไรถ้าไม่มี .nav-actions/.mobile-links เลย (จำลอง admin.html/console.html)", () => {
    const dom = new JSDOM(
      `<!doctype html><html><head></head><body><div id="app"></div></body></html>`,
      { url: "https://cssign.test/admin.html", runScripts: "dangerously", pretendToBeVisual: true }
    );
    assert.doesNotThrow(() => runMainJs(dom));
    const doc = dom.window.document;
    assert.equal(doc.querySelector(".nav-cart-trigger"), null);
    assert.equal(doc.querySelector(".mobile-cart-link"), null);
  });

  test("idempotent: รัน main.js DOM setup ซ้ำ ไม่สร้างไอคอน/ลิงก์ตะกร้าซ้ำ", () => {
    const dom = makeDom(baseHtmlWithMyOrders, "https://cssign.test/contact.html");
    runMainJs(dom);
    runMainJs(dom);
    const doc = dom.window.document;
    assert.equal(doc.querySelectorAll(".nav-cart-trigger").length, 1);
    assert.equal(doc.querySelectorAll(".mobile-cart-link").length, 1);
  });

  test("badge ตั้งต้น: ซ่อนไว้ (display:none) และไม่มีตัวเลข เพราะ window.CSSignCart ยังไม่พร้อมตอนสคริปต์นี้รัน (classic script รันก่อน module เสมอ)", () => {
    const dom = makeDom(baseHtmlWithMyOrders, "https://cssign.test/about.html");
    runMainJs(dom);
    const doc = dom.window.document;
    const badge = doc.querySelector(".nav-cart-badge");
    assert.equal(badge.style.display, "none");
    assert.equal(badge.textContent, "0");
    const mobileBadge = doc.querySelector(".mobile-cart-badge");
    assert.equal(mobileBadge.textContent, "", "มือถือ: ไม่มีวงเล็บจำนวนเลยตอน count เป็น 0");
  });

  test("เมื่อ window.CSSignCart พร้อมอยู่แล้วตั้งแต่ต้น (จำลอง edge case) badge อ่านค่าได้ทันทีตอน setup", () => {
    const dom = makeDom(baseHtmlWithMyOrders, "https://cssign.test/about.html");
    dom.window.CSSignCart = { getCartCount: () => 7 };
    runMainJs(dom);
    const doc = dom.window.document;
    assert.equal(doc.querySelector(".nav-cart-badge").textContent, "7");
    assert.equal(doc.querySelector(".nav-cart-badge").style.display, "block");
    assert.equal(doc.querySelector(".mobile-cart-badge").textContent, " (7)");
  });

  test("อัปเดต badge แบบสดเมื่อ window รับ event 'cssign:cart-updated' โดยไม่ต้อง reload หน้า (จำลองจังหวะที่ cart-global.js โหลดเสร็จ/หลังกด เพิ่มลงตะกร้า)", () => {
    const dom = makeDom(baseHtmlWithMyOrders, "https://cssign.test/products.html");
    runMainJs(dom);
    const doc = dom.window.document;
    assert.equal(doc.querySelector(".nav-cart-badge").style.display, "none", "ตั้งต้นต้องซ่อนอยู่ก่อน");

    dom.window.CSSignCart = { getCartCount: () => 3 };
    dom.window.dispatchEvent(new dom.window.CustomEvent("cssign:cart-updated", { detail: { count: 3 } }));

    assert.equal(doc.querySelector(".nav-cart-badge").textContent, "3");
    assert.equal(doc.querySelector(".nav-cart-badge").style.display, "block");
    assert.equal(doc.querySelector(".mobile-cart-badge").textContent, " (3)");
  });

  test("จำนวนเกิน 99 → แสดง '99+' ทั้งเดสก์ท็อปและมือถือ (กันเลขล้นวงกลม badge)", () => {
    const dom = makeDom(baseHtmlWithMyOrders, "https://cssign.test/products.html");
    runMainJs(dom);
    dom.window.CSSignCart = { getCartCount: () => 150 };
    dom.window.dispatchEvent(new dom.window.CustomEvent("cssign:cart-updated", { detail: { count: 150 } }));
    const doc = dom.window.document;
    assert.equal(doc.querySelector(".nav-cart-badge").textContent, "99+");
    assert.equal(doc.querySelector(".mobile-cart-badge").textContent, " (99+)");
  });

  test("count กลับไปเป็น 0 (เช่น ลบสินค้าออกจนหมดตะกร้าในรอบย่อยถัดไป) → badge กลับไปซ่อน/ว่างเปล่าอีกครั้ง", () => {
    const dom = makeDom(baseHtmlWithMyOrders, "https://cssign.test/products.html");
    runMainJs(dom);
    dom.window.CSSignCart = { getCartCount: () => 2 };
    dom.window.dispatchEvent(new dom.window.CustomEvent("cssign:cart-updated", {}));
    dom.window.CSSignCart = { getCartCount: () => 0 };
    dom.window.dispatchEvent(new dom.window.CustomEvent("cssign:cart-updated", {}));
    const doc = dom.window.document;
    assert.equal(doc.querySelector(".nav-cart-badge").style.display, "none");
    assert.equal(doc.querySelector(".mobile-cart-badge").textContent, "");
  });

  // P3.0 Phase 1 รอบย่อย 4 ต่อ: ตอนนี้ปุ่มตะกร้าคลิกได้จริงแล้ว (เดิมรอบย่อย 3 ยังไม่ผูก action
  // ใดๆ) — เช็ค window.openCartModal แบบ lazy ตอน click เท่านั้น (ดูคอมเมนต์ cartNavIcon() ใน
  // js/main.js) ไม่ import js/cart-modal.js จริงในเทสนี้ (ทดสอบแยกอยู่แล้วใน
  // test/cart-modal-focus-trap.test.mjs/test/cart-modal-render.test.mjs) แค่ stub
  // window.openCartModal เป็นฟังก์ชันเปล่าๆ พอ
  test("คลิกไอคอนตะกร้าเดสก์ท็อป (.nav-cart-trigger) เรียก window.openCartModal() ถ้ามี", () => {
    const dom = makeDom(baseHtmlWithMyOrders, "https://cssign.test/about.html");
    runMainJs(dom);
    let called = false;
    dom.window.openCartModal = () => { called = true; };
    const doc = dom.window.document;
    const evt = new dom.window.MouseEvent("click", { bubbles: true, cancelable: true });
    doc.querySelector(".nav-cart-trigger").dispatchEvent(evt);
    assert.equal(called, true);
  });

  test("คลิกไอคอนตะกร้าเดสก์ท็อป ไม่ throw ถ้า window.openCartModal ยังไม่มี (เช่น หน้าไหนลืมใส่ cart-modal.js)", () => {
    const dom = makeDom(baseHtmlWithMyOrders, "https://cssign.test/about.html");
    runMainJs(dom);
    const doc = dom.window.document;
    const evt = new dom.window.MouseEvent("click", { bubbles: true, cancelable: true });
    assert.doesNotThrow(() => doc.querySelector(".nav-cart-trigger").dispatchEvent(evt));
  });

  test("คลิกลิงก์ตะกร้ามือถือ (.mobile-cart-link) preventDefault เสมอ + เรียก window.openCartModal() ถ้ามี (ครอบทั้งสองอย่างในฟังก์ชันเดียว ไม่ใช่ listener ที่สองซ้อนทับ)", () => {
    const dom = makeDom(baseHtmlWithMyOrders, "https://cssign.test/index.html");
    runMainJs(dom);
    let called = false;
    dom.window.openCartModal = () => { called = true; };
    const doc = dom.window.document;
    const evt = new dom.window.MouseEvent("click", { bubbles: true, cancelable: true });
    doc.querySelector(".mobile-cart-link").dispatchEvent(evt);
    assert.equal(evt.defaultPrevented, true);
    assert.equal(called, true);
  });
});
