// test/qmodal.test.mjs
//
// jsdom test สำหรับ js/qmodal.js (13 บรรทัด) — ไฟล์นี้ไม่เคยมีเทสของตัวเองมาก่อนเลย (รอบที่ 101)
//
// js/qmodal.js เป็น classic script เปล่าๆ (ไม่มี IIFE, ไม่มี event listener ผูกตอนโหลด) — ประกาศ
// แค่ function เดียวคือ qmodalSwitchTab(tab) ที่เป็น global function (เพราะโหลดแบบ
// <script src="js/qmodal.js"> ธรรมดา ไม่ใช่ module) เรียกใช้จริงจาก:
//   - js/qmodal-template.js: ปุ่มแท็บมี onclick="qmodalSwitchTab('form')" / "qmodalSwitchTab('contact')"
//   - js/lead-quote-modal.js: เรียก qmodalSwitchTab(tab) ตรงๆ ถ้า typeof เป็น 'function'
//
// พฤติกรรมจริงของฟังก์ชัน: สลับ active class บนปุ่มแท็บ #qm-tab-form/#qm-tab-contact และสลับ
// display บน panel #qm-panel-form/#qm-panel-contact ให้ตรงกับ tab ที่ส่งเข้ามา ('form'/'contact')
// — วนลูป 2 ค่าคงที่เสมอ (['form', 'contact']) ไม่ได้อ่านจาก DOM ว่ามีแท็บอะไรบ้าง
//
// วิธีทดสอบ: เหมือน test/about-portfolio-extracted-inline-scripts.test.mjs — โหลดเป็น classic
// <script> จริงเข้า JSDOM window (runScripts: "dangerously") แล้วเรียกฟังก์ชันตรงๆ ตรวจ DOM state
// — ไฟล์นี้ไม่ import อะไรเลย ไม่พึ่ง Firebase ไม่ต้อง stub อะไรทั้งสิ้น

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const qmodalSource = readFileSync(new URL("../js/qmodal.js", import.meta.url), "utf-8");

function runScript(dom, source) {
  const scriptEl = dom.window.document.createElement("script");
  scriptEl.textContent = source;
  dom.window.document.body.appendChild(scriptEl);
}

function makeDom() {
  return new JSDOM(
    `<!doctype html><html><body>
      <button id="qm-tab-form" class="qmodal-tab active">form</button>
      <button id="qm-tab-contact" class="qmodal-tab">contact</button>
      <div id="qm-panel-form" style="display:block;"></div>
      <div id="qm-panel-contact" style="display:none;"></div>
    </body></html>`,
    { url: "https://example.test/", runScripts: "dangerously" }
  );
}

describe("js/qmodal.js — qmodalSwitchTab() (รอบที่ 101)", () => {
  test("โหลดสคริปต์แล้ว window.qmodalSwitchTab เป็น global function ตามที่ onclick attribute inline เรียกใช้จริง", () => {
    const dom = makeDom();
    runScript(dom, qmodalSource);
    assert.equal(typeof dom.window.qmodalSwitchTab, "function");
  });

  test("qmodalSwitchTab('contact'): active class ย้ายจากปุ่ม form ไปปุ่ม contact", () => {
    const dom = makeDom();
    runScript(dom, qmodalSource);
    const { document } = dom.window;

    dom.window.qmodalSwitchTab("contact");

    assert.equal(document.getElementById("qm-tab-form").classList.contains("active"), false);
    assert.equal(document.getElementById("qm-tab-contact").classList.contains("active"), true);
  });

  test("qmodalSwitchTab('contact'): panel form ถูกซ่อน (display:none) panel contact ถูกโชว์ (display:block)", () => {
    const dom = makeDom();
    runScript(dom, qmodalSource);
    const { document } = dom.window;

    dom.window.qmodalSwitchTab("contact");

    assert.equal(document.getElementById("qm-panel-form").style.display, "none");
    assert.equal(document.getElementById("qm-panel-contact").style.display, "block");
  });

  test("qmodalSwitchTab('form'): สลับกลับมาที่ form ได้ถูกต้อง (ทั้ง class และ display) แม้เรียกซ้ำหลายครั้ง", () => {
    const dom = makeDom();
    runScript(dom, qmodalSource);
    const { document } = dom.window;

    dom.window.qmodalSwitchTab("contact");
    dom.window.qmodalSwitchTab("form");
    dom.window.qmodalSwitchTab("form"); // เรียกซ้ำ tab เดิม ต้องไม่พัง/ไม่สลับผิด

    assert.equal(document.getElementById("qm-tab-form").classList.contains("active"), true);
    assert.equal(document.getElementById("qm-tab-contact").classList.contains("active"), false);
    assert.equal(document.getElementById("qm-panel-form").style.display, "block");
    assert.equal(document.getElementById("qm-panel-contact").style.display, "none");
  });

  test("qmodalSwitchTab('unknown-tab'): ไม่ throw แม้ส่งค่าที่ไม่ตรงกับ 'form'/'contact' — ทั้งสองแท็บถูกปิด active/ซ่อน panel หมด (ไม่มี t === tab ที่ match เลย)", () => {
    const dom = makeDom();
    runScript(dom, qmodalSource);
    const { document } = dom.window;

    assert.doesNotThrow(() => dom.window.qmodalSwitchTab("unknown-tab"));

    assert.equal(document.getElementById("qm-tab-form").classList.contains("active"), false);
    assert.equal(document.getElementById("qm-tab-contact").classList.contains("active"), false);
    assert.equal(document.getElementById("qm-panel-form").style.display, "none");
    assert.equal(document.getElementById("qm-panel-contact").style.display, "none");
  });

  test("ถ้า DOM ไม่มีปุ่ม/panel บางตัวเลย (element เป็น null) ฟังก์ชันต้องไม่ throw — โค้ดจริงมี guard if (btn)/if (panel) อยู่แล้ว", () => {
    const dom = new JSDOM(
      `<!doctype html><html><body></body></html>`,
      { url: "https://example.test/", runScripts: "dangerously" }
    );
    runScript(dom, qmodalSource);

    assert.doesNotThrow(() => dom.window.qmodalSwitchTab("form"));
    assert.doesNotThrow(() => dom.window.qmodalSwitchTab("contact"));
  });

  test("ถ้ามีแค่ปุ่ม form (ไม่มี panel form) ฟังก์ชันยังอัปเดตปุ่มได้ปกติ ไม่ throw เพราะ panel เป็น null (guard แยกกันคนละ if)", () => {
    const dom = new JSDOM(
      `<!doctype html><html><body>
        <button id="qm-tab-form" class="qmodal-tab"></button>
      </body></html>`,
      { url: "https://example.test/", runScripts: "dangerously" }
    );
    runScript(dom, qmodalSource);
    const { document } = dom.window;

    assert.doesNotThrow(() => dom.window.qmodalSwitchTab("form"));
    assert.equal(document.getElementById("qm-tab-form").classList.contains("active"), true);
  });
});
