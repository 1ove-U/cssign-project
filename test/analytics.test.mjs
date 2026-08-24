// test/analytics.test.mjs
//
// jsdom test สำหรับ js/analytics.js — โหลด GA4 (Google Analytics 4) แบบมีเงื่อนไข ตาม
// ความยินยอมคุกกี้หมวด analytics ที่ js/cookie-consent.js เป็นคนตั้ง (window.CSSIGN_CONSENT +
// custom event "cssign:consent") — ไฟล์นี้ไม่ import/export อะไรเลย (IIFE ธรรมดา โหลดผ่าน
// <script src="js/analytics.js"> ตรงๆ ใน HTML ไม่ใช่ ES module) จึงทดสอบด้วยแพทเทิร์นเดียวกับ
// test/img-error-fallback.test.mjs — inject เป็น classic <script> จริงเข้า JSDOM
// (runScripts: "dangerously") แล้วตรวจ side effect บน window/document โดยตรง ไม่ stub Firebase
// เพราะไฟล์นี้ไม่แตะ db.js เลย
//
// หมายเหตุสำคัญ: GA_MEASUREMENT_ID ในไฟล์จริงตอนนี้คือ "G-YPEKGLQ20Z" (ไม่ใช่ placeholder
// "G-XXXXXXXXXX" ที่ไฟล์เช็คไว้เพื่อ early-return) จึง exercise โค้ด loadGA() จริงได้เต็มๆ ในเทส
// พวกนี้ — ถ้าอนาคตมีการเปลี่ยน ID ให้เป็น placeholder อีกครั้ง เทสกลุ่ม "โหลด GA จริง" จะ fail
// ทันที (ตั้งใจให้เป็นแบบนั้น เพื่อเตือนว่าเงื่อนไข early-return เปลี่ยนพฤติกรรม ไม่ใช่บั๊กของเทส)
//
// ไม่ได้เทสว่า <script src="...googletagmanager.com..."> โหลดจริงสำเร็จหรือไม่ (jsdom ไม่ยิง
// network request ออกจริงตาม runScripts:"dangerously" ปกติสำหรับ external script src) — เทส
// แค่ว่า element ถูกสร้างและ append เข้า <head> ด้วย attribute ที่ถูกต้อง (async, src ที่มี
// measurement ID) ซึ่งเป็นขอบเขตความรับผิดชอบของโค้ดไฟล์นี้เอง

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const source = readFileSync(new URL("../js/analytics.js", import.meta.url), "utf-8");

function makeDom() {
  return new JSDOM(`<!doctype html><html><head></head><body></body></html>`, {
    url: "https://example.test/",
    runScripts: "dangerously",
    pretendToBeVisual: true,
  });
}

function runScript(dom) {
  const scriptEl = dom.window.document.createElement("script");
  scriptEl.textContent = source;
  dom.window.document.body.appendChild(scriptEl);
}

function gaScriptTags(dom) {
  return [...dom.window.document.querySelectorAll("head script")].filter((s) =>
    (s.src || "").indexOf("googletagmanager.com/gtag/js") !== -1
  );
}

function dispatchConsent(dom, detail) {
  dom.window.document.dispatchEvent(
    new dom.window.CustomEvent("cssign:consent", { detail })
  );
}

describe('js/analytics.js — โหลด GA4 แบบมีเงื่อนไขตาม consent (PDPA)', () => {
  test("ไม่มี window.CSSIGN_CONSENT เลย (ยังไม่เคยตัดสินใจ) — ไม่โหลด GA, ไม่ throw", () => {
    const dom = makeDom();
    assert.doesNotThrow(() => runScript(dom));
    assert.equal(gaScriptTags(dom).length, 0);
    assert.equal(dom.window.gtag, undefined);
  });

  test("window.CSSIGN_CONSENT.analytics = false ตอนโหลดสคริปต์ — ไม่โหลด GA", () => {
    const dom = makeDom();
    dom.window.CSSIGN_CONSENT = { necessary: true, analytics: false, marketing: false };
    runScript(dom);
    assert.equal(gaScriptTags(dom).length, 0);
    assert.equal(dom.window.gtag, undefined);
  });

  test("window.CSSIGN_CONSENT.analytics = true ตอนโหลดสคริปต์ (เคยกดยอมรับไว้ก่อนหน้า) — โหลด GA ทันที", () => {
    const dom = makeDom();
    dom.window.CSSIGN_CONSENT = { necessary: true, analytics: true, marketing: false };
    runScript(dom);
    const tags = gaScriptTags(dom);
    assert.equal(tags.length, 1);
    assert.equal(tags[0].async, true);
    assert.match(tags[0].src, /^https:\/\/www\.googletagmanager\.com\/gtag\/js\?id=G-YPEKGLQ20Z$/);
    assert.equal(typeof dom.window.gtag, "function");
    assert.ok(Array.isArray(dom.window.dataLayer));
  });

  test("โหลด GA ตอนเริ่มต้น — dataLayer มีคำสั่ง js + config ที่ถูกต้อง (รวม anonymize_ip: true)", () => {
    const dom = makeDom();
    dom.window.CSSIGN_CONSENT = { necessary: true, analytics: true, marketing: false };
    runScript(dom);
    const calls = dom.window.dataLayer.map((args) => Array.from(args));
    assert.equal(calls[0][0], "js");
    assert.ok(calls[0][1] instanceof dom.window.Date);
    assert.equal(calls[1][0], "config");
    assert.equal(calls[1][1], "G-YPEKGLQ20Z");
    // ใช้ JSON.stringify เทียบแทน assert.deepEqual ตรงๆ เพราะ object นี้ถูกสร้างขึ้นใน
    // realm ของ jsdom (ผ่าน vm context) คนละ Object.prototype กับ object literal ฝั่งเทส —
    // deepStrictEqual ของ node:assert เช็ค prototype ด้วย ทำให้ fail แม้โครงสร้าง/ค่าตรงกันทุก
    // ประการ (เห็นชัดจาก error message เอง: "same structure but are not reference-equal")
    assert.equal(JSON.stringify(calls[1][2]), JSON.stringify({ anonymize_ip: true }));
  });

  test('ไม่มี consent ตอนโหลด แต่ยิง cssign:consent { analytics: true } ทีหลัง — โหลด GA ตอนนั้น', () => {
    const dom = makeDom();
    runScript(dom);
    assert.equal(gaScriptTags(dom).length, 0, "ก่อนยิง event ต้องยังไม่โหลด");
    dispatchConsent(dom, { necessary: true, analytics: true, marketing: false });
    assert.equal(gaScriptTags(dom).length, 1, "หลังยิง event analytics:true ต้องโหลดแล้ว");
  });

  test('ยิง cssign:consent { analytics: false } — ไม่โหลด GA', () => {
    const dom = makeDom();
    runScript(dom);
    dispatchConsent(dom, { necessary: true, analytics: false, marketing: false });
    assert.equal(gaScriptTags(dom).length, 0);
  });

  test("ยิง cssign:consent โดยไม่มี detail เลย (edge case ผิดปกติ) — ไม่ throw และไม่โหลด GA", () => {
    const dom = makeDom();
    runScript(dom);
    assert.doesNotThrow(() => {
      dom.window.document.dispatchEvent(new dom.window.CustomEvent("cssign:consent"));
    });
    assert.equal(gaScriptTags(dom).length, 0);
  });

  test("ยิง cssign:consent { analytics: true } ซ้ำหลายครั้ง — โหลด GA แค่ครั้งเดียว (loaded guard)", () => {
    const dom = makeDom();
    runScript(dom);
    dispatchConsent(dom, { necessary: true, analytics: true, marketing: false });
    dispatchConsent(dom, { necessary: true, analytics: true, marketing: false });
    dispatchConsent(dom, { necessary: true, analytics: true, marketing: false });
    assert.equal(gaScriptTags(dom).length, 1, "ต้องมี script tag เดียวเท่านั้นแม้ยิง event ซ้ำ 3 ครั้ง");
  });

  test("มี consent = true ตั้งแต่โหลด แล้วยิง event ซ้ำอีกครั้ง — ยังคงโหลดแค่ครั้งเดียว", () => {
    const dom = makeDom();
    dom.window.CSSIGN_CONSENT = { necessary: true, analytics: true, marketing: false };
    runScript(dom);
    assert.equal(gaScriptTags(dom).length, 1);
    dispatchConsent(dom, { necessary: true, analytics: true, marketing: false });
    assert.equal(gaScriptTags(dom).length, 1, "loaded guard ต้องกันการโหลดซ้ำข้ามทั้งสองเส้นทาง (init + event)");
  });
});
