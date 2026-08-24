// test/chat-widget-template.test.mjs
//
// jsdom test สำหรับ js/chat-widget-template.js — IIFE 0 exports ที่ไม่มี logic เลยสักบรรทัด
// (ต่างจาก hero-parallax.js/cookie-consent.js/analytics.js ที่มี branching ตาม matchMedia/
// localStorage/consent) — ไฟล์นี้แค่เก็บ HTML string คงที่ตัวเดียว (`HTML`) แล้วเรียก
// `document.currentScript.insertAdjacentHTML('beforebegin', HTML)` ครั้งเดียวตอนสคริปต์รัน
// ไม่มีเงื่อนไข ไม่มี state ไม่มี event listener ใดๆ ในไฟล์นี้เลย (event listener จริงของ
// ปุ่ม/ช่องแชทอยู่ที่ js/chat-widget.js ซึ่งมีเทสของตัวเองอยู่แล้วผ่าน
// test/chat-widget-focus-trap.test.mjs — ไฟล์นี้ทดสอบแค่ "โครงสร้าง HTML ที่ถูกฉีดเข้ามาถูกต้อง"
//
// วิธีทดสอบ: โหลดเป็น classic <script> จริงเข้า JSDOM (runScripts: "dangerously") — สำคัญ:
// ต้อง appendChild script เข้า container ที่มี parent จริง (ไม่ใช่ document ตรงๆ) เพื่อให้
// `insertAdjacentHTML('beforebegin', ...)` มีที่ให้แทรก markup ก่อนตัว <script> เอง แล้วเช็คว่า
// markup ที่แทรกเข้ามาเป็น sibling ก่อนหน้า script tag จริง (ไม่ใช่แค่เช็คว่า element มีอยู่ใน
// document เฉยๆ — ต้องยืนยันตำแหน่งที่แทรกตรงกับที่โค้ดตั้งใจด้วย)
//
// ไม่ได้แก้ไฟล์ .js/.html/.css ที่เป็นโค้ดจริงเลยแม้แต่บรรทัดเดียวในไฟล์นี้ — งานทดสอบล้วนๆ

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const SOURCE = readFileSync(new URL("../js/chat-widget-template.js", import.meta.url), "utf-8");

function makeDom() {
  return new JSDOM(`<!doctype html><html><body><div id="container"></div></body></html>`, {
    url: "https://example.test/",
    runScripts: "dangerously",
  });
}

// รัน script จริงภายใน #container (ทำให้ document.currentScript มี parentNode ให้แทรก
// markup ก่อนหน้าตัวมันเองได้จริง) แล้วคืน container element ให้เทสตรวจสอบ
function runScript(dom) {
  const container = dom.window.document.getElementById("container");
  const script = dom.window.document.createElement("script");
  script.textContent = SOURCE;
  container.appendChild(script);
  return container;
}

describe("chat-widget-template.js", () => {
  test("ฉีด markup เข้ามาก่อนหน้าตัว <script> เอง (beforebegin) ไม่ใช่แทรกที่อื่น", () => {
    const dom = makeDom();
    const container = runScript(dom);
    // container ควรมี: [chat-fab button, chat-popup div, script] ตามลำดับ
    const children = Array.from(container.children);
    const scriptIdx = children.findIndex((el) => el.tagName === "SCRIPT");
    assert.ok(scriptIdx > 0, "ต้องมี element ถูกแทรกก่อนหน้า <script> อย่างน้อย 1 ตัว");
    // ทุก element ก่อนหน้า script ต้องเป็นส่วนหนึ่งของ markup ที่ฉีดเข้ามา (fab + popup)
    const before = children.slice(0, scriptIdx);
    assert.equal(before.length, 2, "ต้องมี 2 top-level element ที่ถูกแทรก (fab + popup)");
    assert.equal(before[0].id, "chat-fab");
    assert.equal(before[1].id, "chat-popup");
  });

  test("ปุ่ม chat-fab: aria-label ถูกต้อง มี badge เลข 1 และไอคอน chat/close", () => {
    const dom = makeDom();
    const { document } = runScript(dom).ownerDocument.defaultView;
    const fab = document.getElementById("chat-fab");
    assert.ok(fab);
    assert.equal(fab.tagName, "BUTTON");
    assert.equal(fab.getAttribute("aria-label"), "เปิดแชทกับ AI ผู้ช่วย CS.SIGN");
    const badge = document.getElementById("chat-badge");
    assert.equal(badge.textContent, "1");
    assert.equal(document.querySelectorAll(".chat-fab-icon--chat").length, 1);
    assert.equal(document.querySelectorAll(".chat-fab-icon--close").length, 1);
  });

  test("chat-popup: role/aria ถูกต้อง มี header/avatar/close button", () => {
    const dom = makeDom();
    const { document } = runScript(dom).ownerDocument.defaultView;
    const popup = document.getElementById("chat-popup");
    assert.ok(popup);
    assert.equal(popup.getAttribute("role"), "dialog");
    assert.equal(popup.getAttribute("aria-modal"), "true");
    assert.equal(popup.getAttribute("aria-label"), "AI ผู้ช่วย CS.SIGN");
    assert.equal(
      document.querySelector(".chat-header-name").textContent,
      "บอทตอบคำถาม (AI Chatbot)"
    );
    const closeBtn = document.getElementById("chat-close-btn");
    assert.ok(closeBtn);
    assert.equal(closeBtn.getAttribute("aria-label"), "ปิด");
  });

  test("chat-messages เป็นกล่องว่างเปล่าตอนโหลด (greeting ถูกฉีดโดย js/chat-widget.js ทีหลัง)", () => {
    const dom = makeDom();
    const { document } = runScript(dom).ownerDocument.defaultView;
    const messages = document.getElementById("chat-messages");
    assert.ok(messages);
    assert.equal(messages.textContent.trim(), "");
    assert.equal(messages.children.length, 0);
  });

  test("chat-chips มีครบ 6 ปุ่มพร้อม data-msg/ข้อความตรงตามที่กำหนด เรียงลำดับถูกต้อง", () => {
    const dom = makeDom();
    const { document } = runScript(dom).ownerDocument.defaultView;
    const chips = Array.from(document.querySelectorAll("#chat-chips .chat-chip"));
    assert.equal(chips.length, 6);
    const expected = [
      ["ต้องการใบเสนอราคา", "ขอใบเสนอราคา"],
      ["ป้ายมีมาตรฐานอะไรบ้าง", "มาตรฐานที่รองรับ"],
      ["ระยะเวลาผลิตและจัดส่งกี่วัน", "ระยะเวลาจัดส่ง"],
      ["ราคาป้ายความปลอดภัยเริ่มต้นเท่าไร", "สอบถามราคา"],
      ["ขอดูผลงานหรือตัวอย่างป้ายที่เคยทำ", "ผลงานตัวอย่าง"],
      ["ขอคุยกับพนักงานขายโดยตรง", "คุยกับพนักงานขาย"],
    ];
    chips.forEach((chip, i) => {
      assert.equal(chip.getAttribute("data-msg"), expected[i][0]);
      assert.equal(chip.textContent.trim(), expected[i][1]);
      assert.equal(chip.tagName, "BUTTON");
    });
  });

  test("ช่องทางติดต่อ: โทร/LINE/อีเมล/Facebook มี href ถูกต้อง เฉพาะลิงก์ภายนอกมี target=_blank+rel=noopener", () => {
    const dom = makeDom();
    const { document } = runScript(dom).ownerDocument.defaultView;
    const links = Array.from(document.querySelectorAll("#chat-contacts-anchor a.chat-contact-btn"));
    assert.equal(links.length, 4);

    const byHref = Object.fromEntries(links.map((a) => [a.getAttribute("href"), a]));

    const phone = byHref["tel:0628833880"];
    assert.ok(phone, "ต้องมีลิงก์โทรศัพท์");
    assert.equal(phone.getAttribute("aria-label"), "โทรศัพท์");
    assert.equal(phone.hasAttribute("target"), false, "ลิงก์ tel: ไม่ควรมี target=_blank");

    const line = byHref["https://line.me/ti/p/@cssigngroup"];
    assert.ok(line, "ต้องมีลิงก์ LINE");
    assert.equal(line.getAttribute("target"), "_blank");
    assert.equal(line.getAttribute("rel"), "noopener");

    const email = byHref["mailto:cssigngroup@gmail.com"];
    assert.ok(email, "ต้องมีลิงก์อีเมล");
    assert.equal(email.hasAttribute("target"), false, "ลิงก์ mailto: ไม่ควรมี target=_blank");

    const fb = byHref["https://www.facebook.com/cssignonline/"];
    assert.ok(fb, "ต้องมีลิงก์ Facebook");
    assert.equal(fb.getAttribute("target"), "_blank");
    assert.equal(fb.getAttribute("rel"), "noopener");
  });

  test("ช่องพิมพ์ข้อความ + ปุ่มส่ง: maxlength=500, ปุ่มส่ง disabled ตั้งแต่ต้น", () => {
    const dom = makeDom();
    const { document } = runScript(dom).ownerDocument.defaultView;
    const input = document.getElementById("chat-input");
    assert.ok(input);
    assert.equal(input.tagName, "TEXTAREA");
    assert.equal(input.getAttribute("maxlength"), "500");
    assert.equal(input.getAttribute("placeholder"), "พิมพ์ข้อความ...");

    const sendBtn = document.getElementById("chat-send-btn");
    assert.ok(sendBtn);
    assert.equal(sendBtn.disabled, true);
    assert.equal(sendBtn.getAttribute("aria-label"), "ส่ง");
  });

  test("ฟุตเตอร์ข้อความอ้างอิงแสดงถูกต้อง", () => {
    const dom = makeDom();
    const { document } = runScript(dom).ownerDocument.defaultView;
    const footer = document.querySelector(".chat-footer-note");
    assert.ok(footer);
    assert.equal(footer.textContent, "ผู้ช่วย AI · ข้อมูลอ้างอิงจาก cssign.com");
  });

  test("ไม่มีการ guard ซ้ำ — รันสคริปต์ 2 ครั้งในหน้าเดียวกัน (คนละ container) ฉีด markup อิสระจากกันได้ทั้งคู่", () => {
    const dom = new JSDOM(
      `<!doctype html><html><body><div id="a"></div><div id="b"></div></body></html>`,
      { url: "https://example.test/", runScripts: "dangerously" }
    );
    const { document } = dom.window;
    ["a", "b"].forEach((id) => {
      const script = document.createElement("script");
      script.textContent = SOURCE;
      document.getElementById(id).appendChild(script);
    });
    // ทั้งสองจุดต้องมี #chat-fab/#chat-popup ของตัวเอง — querySelectorAll ทั้ง document
    // ควรเจอ 2 ชุด (id ซ้ำกันเป็นเรื่องของ markup ต้นฉบับเอง ไม่ใช่ขอบเขตของไฟล์นี้ที่ต้องแก้)
    assert.equal(document.querySelectorAll(".chat-fab").length, 2);
    assert.equal(document.querySelectorAll(".chat-popup").length, 2);
    assert.equal(document.querySelectorAll(".chat-chip").length, 12);
  });
});
