// test/track-modal-po-deeplink.test.mjs — ช่องโหว่ที่ 3 (แจ้งเตือนไม่มีลิงก์กลับมาดูรายละเอียด)
//
// jsdom test สำหรับฟีเจอร์ใหม่ใน js/track-modal.js: อ่าน query param "?po=" ตอนหน้าโหลด แล้วเติม
// เลข PO ลงช่อง #tm-code อัตโนมัติ + เปิด popup ให้เลย (ไม่ auto-fill เบอร์โทร) — ผูกกับลิงก์ที่
// buildTrackingLink() (js/email-notify.js) และ buildStatusMessage() (js/line-notify.js) แนบไปกับ
// อีเมล/ข้อความ LINE แจ้งเตือนสถานะ
//
// pattern เดียวกับ test/track-modal-form-flow.test.mjs (โหลด markup จาก
// js/track-modal-template.js, JSDOM url option คุม window.location.search)
//
// ไม่ได้แก้ไฟล์ .js/.html/.css ที่เป็นโค้ดจริงเลยแม้แต่บรรทัดเดียวในไฟล์นี้ — งานทดสอบล้วนๆ

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const TM_TEMPLATE_SRC = readFileSync(new URL("../js/track-modal-template.js", import.meta.url), "utf-8");
const TM_HTML_MATCH = TM_TEMPLATE_SRC.match(/var HTML = `([\s\S]*?)`;/);
if (!TM_HTML_MATCH) throw new Error("track-modal-po-deeplink.test.mjs: ดึง template literal จาก js/track-modal-template.js ไม่สำเร็จ");
const TM_HTML = TM_HTML_MATCH[1];

function makeDom(url) {
  return new JSDOM(
    `<!doctype html><html><body>${TM_HTML}</body></html>`,
    { url }
  );
}

async function loadTrackModal(dom) {
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.MouseEvent = dom.window.MouseEvent;
  globalThis.KeyboardEvent = dom.window.KeyboardEvent;
  globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);
  globalThis.sessionStorage = dom.window.sessionStorage;
  await import(`../js/track-modal.js?t=${Date.now()}-${Math.random()}`);
}

describe('js/track-modal.js — deep-link "?po=" (ช่องโหว่ที่ 3)', () => {
  test("มี ?po=PO-2026-0120 ใน URL → เติมเลข PO ลง #tm-code อัตโนมัติ", async () => {
    const dom = makeDom("https://example.test/?po=PO-2026-0120");
    await loadTrackModal(dom);
    const codeInput = dom.window.document.getElementById("tm-code");
    assert.equal(codeInput.value, "PO-2026-0120");
  });

  test("มี ?po=... ใน URL → เปิด popup ให้อัตโนมัติ (ไม่ต้องกดปุ่มเอง)", async () => {
    const dom = makeDom("https://example.test/?po=PO-2026-0120");
    await loadTrackModal(dom);
    const overlay = dom.window.document.getElementById("tm-overlay");
    assert.equal(overlay.style.display, "flex");
  });

  test("มี ?po=... ใน URL → ไม่ auto-fill เบอร์โทร (ต้องให้ลูกค้ากรอกเองเพื่อยืนยันตัวตน)", async () => {
    const dom = makeDom("https://example.test/?po=PO-2026-0120");
    await loadTrackModal(dom);
    const phoneInput = dom.window.document.getElementById("tm-phone");
    assert.equal(phoneInput.value, "");
  });

  test("ไม่มี ?po= ใน URL → ไม่เติมค่า ไม่เปิด popup เอง (พฤติกรรมเดิม)", async () => {
    const dom = makeDom("https://example.test/");
    await loadTrackModal(dom);
    const codeInput = dom.window.document.getElementById("tm-code");
    const overlay = dom.window.document.getElementById("tm-overlay");
    assert.equal(codeInput.value, "");
    assert.equal(overlay.style.display, "none");
  });

  test("?po= ว่างเปล่า (?po=) → ไม่เปิด popup เอง", async () => {
    const dom = makeDom("https://example.test/?po=");
    await loadTrackModal(dom);
    const overlay = dom.window.document.getElementById("tm-overlay");
    assert.equal(overlay.style.display, "none");
  });

  test('มี query param อื่นที่ไม่ใช่ "po" → ไม่เปิด popup เอง', async () => {
    const dom = makeDom("https://example.test/?utm_source=line");
    await loadTrackModal(dom);
    const overlay = dom.window.document.getElementById("tm-overlay");
    assert.equal(overlay.style.display, "none");
  });
});
