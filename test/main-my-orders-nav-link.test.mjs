// test/main-my-orders-nav-link.test.mjs
//
// jsdom test สำหรับส่วน nav link ที่ myOrdersNavLink() ฉีดเข้า .nav-actions (เดสก์ท็อป) +
// .mobile-links (มือถือ) ใน js/main.js เดิมจากรอบที่ 167 (P2.8c-H) — อัปเดตรอบ P2.9-C:
// เปลี่ยนปลายทางลิงก์จาก my-orders.html ตรงๆ เป็น my-account.html (hub กลาง) แทน ชื่อฟังก์ชัน/
// class selector (.nav-my-orders-trigger/.mobile-my-orders-link) คงเดิมไว้ตามโค้ดจริงใน main.js
// (ไม่เปลี่ยนชื่อ เพื่อลด diff — ดู p2.9-account-hub-plan.md หัวข้อ "รอบ P2.9-C")
//
// วิธีทดสอบ: โหลด js/main.js เป็น <script> จริงเข้า JSDOM window (runScripts: "dangerously")
// เหมือน test/main-js-dom.test.mjs ทุกประการ — คุม `url` ของแต่ละ JSDOM instance ให้จำลอง
// pathname ที่ต่างกัน (root page / /en/ page / my-account.html เอง) เพื่อเทส path-guard logic

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const mainJsSource = readFileSync(new URL("../js/main.js", import.meta.url), "utf-8");

// โครง DOM ขั้นต่ำที่ทุกหน้า HTML จริงมี (nav-actions + nav-track-trigger + mobile-links +
// mobile track-modal trigger) — ตรงกับที่ grep ยืนยันแล้วว่ามีครบใน 15 หน้า root ที่ไม่ใช่
// admin.html/console.html (สองหน้านั้นไม่มี public nav เลย จึงไม่ต้องเทสแยก เพราะ selector
// ไม่เจอ element แล้ว guard `if (navActions && navTrackTrigger ...)` จะข้ามไปเงียบๆ)
const baseHtml = `<!doctype html>
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
      <a href="#top">หน้าแรก</a>
      <a href="portfolio.html">ผลงาน</a>
      <a href="#" data-track-modal-open>เช็คสถานะคำสั่งผลิต</a>
      <a href="contact.html">ติดต่อ</a>
    </div>
  </nav>
</body>
</html>`;

function makeDom(url) {
  return new JSDOM(baseHtml, {
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

describe("js/main.js — myOrdersNavLink() (อัปเดต P2.9-C: ลิงก์ 'บัญชีของฉัน' ไป my-account.html)", () => {
  test("หน้าปกติ (root, ไม่ใช่ /en/): เพิ่มปุ่มไอคอนใน .nav-actions ก่อน .nav-track-trigger ชี้ไป my-account.html", () => {
    const dom = makeDom("https://cssign.test/about.html");
    runMainJs(dom);
    const doc = dom.window.document;
    const link = doc.querySelector(".nav-my-orders-trigger");
    assert.ok(link, "ควรมี .nav-my-orders-trigger ถูกสร้างขึ้น");
    assert.equal(link.tagName, "A");
    assert.equal(link.getAttribute("href"), "my-account.html");
    assert.equal(link.getAttribute("aria-label"), "บัญชีของฉัน");
    assert.ok(link.classList.contains("nav-icon-btn"), "ต้องใช้ class เดิม .nav-icon-btn ไม่เพิ่ม CSS ใหม่");

    const navActions = doc.querySelector(".nav-actions");
    const children = Array.from(navActions.children);
    const linkIdx = children.indexOf(link);
    const triggerIdx = children.indexOf(doc.querySelector(".nav-track-trigger"));
    assert.ok(linkIdx > -1 && triggerIdx > -1 && linkIdx < triggerIdx, "ต้องแทรกก่อนปุ่มเช็คสถานะเดิม");
  });

  test("หน้าปกติ: เพิ่มลิงก์ข้อความใน .mobile-links ต่อจากลิงก์ 'เช็คสถานะคำสั่งผลิต' เดิม ชี้ไป my-account.html", () => {
    const dom = makeDom("https://cssign.test/index.html");
    runMainJs(dom);
    const doc = dom.window.document;
    const link = doc.querySelector(".mobile-my-orders-link");
    assert.ok(link, "ควรมี .mobile-my-orders-link ถูกสร้างขึ้น");
    assert.equal(link.getAttribute("href"), "my-account.html");
    assert.equal(link.textContent, "บัญชีของฉัน");

    const mobileLinks = doc.querySelector(".mobile-links");
    const children = Array.from(mobileLinks.children);
    const trackLink = doc.querySelector('.mobile-links [data-track-modal-open]');
    assert.equal(children[children.indexOf(trackLink) + 1], link, "ต้องอยู่ถัดจากลิงก์เช็คสถานะเดิมทันที");
  });

  test("หน้า /en/* : เพิ่มลิงก์ด้วย label ภาษาอังกฤษ 'My Account' (en/my-account.html ยังไม่มีในรอบนี้ แต่ label ต้องพร้อมอยู่แล้ว)", () => {
    const dom = makeDom("https://cssign.test/en/about.html");
    runMainJs(dom);
    const doc = dom.window.document;
    const iconLink = doc.querySelector(".nav-my-orders-trigger");
    const mobileLink = doc.querySelector(".mobile-my-orders-link");
    assert.ok(iconLink, "ควรมี .nav-my-orders-trigger ถูกสร้างขึ้นบนหน้า /en/ ด้วย");
    assert.equal(iconLink.getAttribute("href"), "my-account.html");
    assert.equal(iconLink.getAttribute("aria-label"), "My Account");
    assert.ok(mobileLink, "ควรมี .mobile-my-orders-link ถูกสร้างขึ้นบนหน้า /en/ ด้วย");
    assert.equal(mobileLink.textContent, "My Account");
  });

  test("หน้า my-account.html เอง (P2.9-C): ไม่เพิ่มลิงก์ซ้ำ (ไม่มีประโยชน์ลิงก์ไปหาตัวเอง)", () => {
    const dom = makeDom("https://cssign.test/my-account.html");
    runMainJs(dom);
    const doc = dom.window.document;
    assert.equal(doc.querySelector(".nav-my-orders-trigger"), null);
    assert.equal(doc.querySelector(".mobile-my-orders-link"), null);
  });

  test("หน้า my-orders.html เอง: ไม่ใช่ตัวเองอีกต่อไปหลัง P2.9-C จึงควรมีลิงก์ 'บัญชีของฉัน' โผล่ตามปกติ", () => {
    const dom = makeDom("https://cssign.test/my-orders.html");
    runMainJs(dom);
    const doc = dom.window.document;
    const link = doc.querySelector(".nav-my-orders-trigger");
    assert.ok(link, "my-orders.html ไม่ใช่หน้า my-account.html จึงควรยังโผล่ลิงก์ 'บัญชีของฉัน' ให้กดย้อนกลับไปหน้า hub ได้");
    assert.equal(link.getAttribute("href"), "my-account.html");
  });

  test("ไม่ throw และไม่สร้างอะไรถ้าไม่มี .nav-actions/.mobile-links เลย (จำลอง admin.html/console.html)", () => {
    const dom = new JSDOM(
      `<!doctype html><html><head></head><body><div id="app"></div></body></html>`,
      { url: "https://cssign.test/admin.html", runScripts: "dangerously", pretendToBeVisual: true }
    );
    assert.doesNotThrow(() => runMainJs(dom));
    const doc = dom.window.document;
    assert.equal(doc.querySelector(".nav-my-orders-trigger"), null);
    assert.equal(doc.querySelector(".mobile-my-orders-link"), null);
  });

  test("idempotent: รัน main.js DOM setup ซ้ำ (จำลอง script ถูกโหลดผ่านครั้งเดียวปกติ) ไม่สร้างลิงก์ซ้ำ", () => {
    const dom = makeDom("https://cssign.test/contact.html");
    runMainJs(dom);
    // เรียกฟังก์ชันเดิมซ้ำเป็นครั้งที่สองด้วยการ inject script อีกรอบ จำลองกรณี guard ทำงาน
    runMainJs(dom);
    const doc = dom.window.document;
    assert.equal(doc.querySelectorAll(".nav-my-orders-trigger").length, 1);
    assert.equal(doc.querySelectorAll(".mobile-my-orders-link").length, 1);
  });
});
