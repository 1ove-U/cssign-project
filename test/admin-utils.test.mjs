// test/admin-utils.test.mjs — รอบที่ 127
//
// ขอบเขต: js/admin-utils.js (309 บรรทัด) — shared/generic helpers ที่ใช้ร่วมกันทุกแท็บของหน้าแอดมิน
// **ไม่ใช่** ไฟล์ admin-* แท็บใดแท็บหนึ่งโดยเฉพาะ (ไม่มี render/submit/event-delegation ของแท็บใดๆ)
// ก่อนรอบนี้ไฟล์มีเทสอยู่แล้วบางส่วนใน test/admin-utils-focus-trap.test.mjs (เฉพาะ
// openOverlay()/closeOverlay() + focus-trap/Escape/return-focus/confirmDialog-guard — รอบที่ 58/59)
// — รอบนี้คลุมฟังก์ชันที่เหลือทั้งหมดในไฟล์ที่ยังไม่มีเทสตรงมาก่อน (มีแค่ถูกเรียกผ่านทางอ้อมจาก
// เทสของแท็บอื่นๆ เช่น admin-categories.test.mjs/admin-portfolio.test.mjs ที่ import มาใช้
// แต่ไม่เคยเทสพฤติกรรม edge-case ของตัวฟังก์ชันเองตรงๆ): showToast(), deleteWithUndo(),
// downloadCsv()/csvCell(), escapeHtml(), initials()/avatarHtml(), imgUrl()/imgLabel()/
// normalizeImage(), wireCharCounter(), genLocalId(), catName()/groupName(), fillCategorySelects(),
// imageGridHTML(), slugify(), buildPageList() — จึงไม่ซ้ำ openOverlay/closeOverlay อีกในไฟล์นี้
//
// **catName()/groupName() อ่าน allCategories/allGroups จาก js/admin-state.js โดยตรง** — ต้อง
// import "../js/admin-state.js" ด้วย **specifier เดียวกันเป๊ะ ไม่มี query-string cache-bust**
// กับที่ js/admin-utils.js ใช้ import ภายใน (ทั้งคู่เป็น "./admin-state.js"/"../js/admin-state.js"
// ที่ resolve ไป URL เดียวกัน) — ไม่งั้นจะได้ module instance คนละตัวกัน (คนละ live binding)
// ทำให้ setAllCategories()/setAllGroups() ที่เทสเรียกไม่ไปอัปเดตค่าที่ catName()/groupName() อ่าน
// จริง (ยืนยันด้วยสคริปต์ probe ก่อนเขียนเทสนี้ — ลองแยก instance ก่อนแล้วเจอว่า catName() คืน
// ค่า fallback เสมอทั้งที่ setAllCategories() แล้ว) — ไม่ cache-bust js/admin-utils.js เองด้วย
// เหตุผลเดียวกัน (กันสร้าง module instance ใหม่ที่ import admin-state.js คนละตัวจากที่เทส import
// เอง) ไฟล์นี้จึง import ทั้งสองไฟล์แค่ครั้งเดียวใน before() แบบเดียวกับไฟล์เทสของแท็บอื่นๆ
//
// **ไม่มีเทส handleImageUpload()** ด้วยเหตุผลเดียวกับที่บันทึกไว้ในไฟล์เทสรอบก่อนๆ (106/111/112):
// uploadImage() ใน js/db-media.js ยิง fetch จริงไปที่ api.cloudinary.com ไม่มี stub ให้ใน
// สภาพแวดล้อมเทสนี้ (เครือข่ายที่อนุญาตในสภาพแวดล้อมนี้ไม่รวมโดเมนนั้นด้วย) — ทดสอบ
// handleImageUpload() ตรงๆ จะกลายเป็นเทสที่พึ่งเครือข่ายจริง/ไม่แน่นอน จึงข้ามไว้เหมือนไฟล์ก่อนหน้า
//
// ตรวจโค้ดจริงทั้งไฟล์ js/admin-utils.js ก่อนเขียนเทสนี้ (อ่านครบ) — ไม่พบบั๊ก จึงเป็นไฟล์เทสล้วนๆ
// ไม่มีการแก้โค้ดผลิตภัณฑ์เลยแม้แต่บรรทัดเดียว
//
// downloadCsv(): jsdom ไม่มี Blob.text()/.arrayBuffer() ที่ตัด BOM ออกจาก .text() (TextDecoder
// ตาม WHATWG spec ตัด leading BOM ออกโดย default เวลา decode เป็น string) — ยืนยันแล้วว่า BOM
// (EF BB BF) มีอยู่จริงในไบต์ดิบผ่าน .arrayBuffer() แม้ .text() จะไม่เห็นมัน จึงเทส BOM ผ่าน
// arrayBuffer() แทน .text() (เทส .text() แยกไว้เช็คแค่เนื้อหา CSV ไม่เช็ค BOM)

import { test, describe, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

let document;
let mod;
let setAllCategories, setAllGroups;

before(async () => {
  const dom = new JSDOM(`<!doctype html><html><body></body></html>`, { url: "https://example.test/" });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Event = dom.window.Event;
  globalThis.MouseEvent = dom.window.MouseEvent;
  globalThis.KeyboardEvent = dom.window.KeyboardEvent;
  document = dom.window.document;

  mod = await import("../js/admin-utils.js");
  ({ setAllCategories, setAllGroups } = await import("../js/admin-state.js"));
});

beforeEach(() => {
  document.body.innerHTML = "";
  document.querySelectorAll(".cp-toast-wrap").forEach(el => el.remove());
  setAllCategories([]);
  setAllGroups([]);
});

// ── showToast() ──────────────────────────────────────────
describe("showToast()", () => {
  test("สร้าง .cp-toast-wrap ใน body ถ้ายังไม่มี แล้วเติม .cp-toast ข้อความ+kind ตามที่ส่งเข้าไป", () => {
    mod.showToast("บันทึกไม่สำเร็จ", "error");
    const wrap = document.querySelector(".cp-toast-wrap");
    assert.ok(wrap, "ต้องมี .cp-toast-wrap ถูกสร้าง");
    const toast = wrap.querySelector(".cp-toast");
    assert.equal(toast.textContent, "บันทึกไม่สำเร็จ");
    assert.equal(toast.className, "cp-toast error");
  });

  test("kind default เป็น 'error' ถ้าไม่ได้ส่งพารามิเตอร์ที่สอง", () => {
    mod.showToast("ข้อความ default");
    const toast = document.querySelector(".cp-toast");
    assert.equal(toast.className, "cp-toast error");
  });

  test("เรียกซ้ำหลายครั้งใช้ .cp-toast-wrap ตัวเดียวกัน (ไม่สร้างซ้ำ) แต่เพิ่ม .cp-toast ทีละอัน", () => {
    mod.showToast("อันแรก", "success");
    mod.showToast("อันสอง", "error");
    const wraps = document.querySelectorAll(".cp-toast-wrap");
    assert.equal(wraps.length, 1);
    assert.equal(wraps[0].querySelectorAll(".cp-toast").length, 2);
  });

  test("toast ถูกลบออกจาก DOM เองอัตโนมัติหลังผ่านไป ~3600ms", (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    mod.showToast("จะหายไปเอง", "success");
    assert.ok(document.querySelector(".cp-toast"));
    t.mock.timers.tick(3600);
    assert.equal(document.querySelector(".cp-toast"), null, "ต้องถูกลบออกหลังครบเวลา");
    t.mock.timers.reset();
  });
});

// ── deleteWithUndo() ──────────────────────────────────────
describe("deleteWithUndo()", () => {
  function makeArgs(overrides = {}) {
    const pendingSet = new Set();
    const renderCalls = [];
    const deleteCalls = [];
    const commitCalls = [];
    return {
      pendingSet,
      id: "x-1",
      renderFn: () => renderCalls.push(pendingSet.has("x-1")),
      message: "ลบ 'ทดสอบ' แล้ว",
      deleteFn: () => { deleteCalls.push("x-1"); return Promise.resolve(); },
      onCommitted: () => { commitCalls.push("done"); },
      targetType: "testTarget",
      ...overrides,
      _spy: { renderCalls, deleteCalls, commitCalls },
    };
  }

  test("เรียกแล้วใส่ id เข้า pendingSet ทันที + renderFn() ครั้งแรกก่อนรอ toast", (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const args = makeArgs();
    mod.deleteWithUndo(args);
    assert.ok(args.pendingSet.has("x-1"));
    assert.equal(args._spy.renderCalls.length, 1);
    assert.equal(args._spy.renderCalls[0], true, "ตอน render ครั้งแรก id ต้องอยู่ใน pendingSet แล้ว (ซ่อนแถวทันที)");
    t.mock.timers.reset();
  });

  test("กด 'เลิกทำ' (undo=true) → เอา id ออกจาก pendingSet, renderFn() รอบสอง, ไม่เรียก deleteFn()", async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const args = makeArgs();
    const p = mod.deleteWithUndo(args);
    const undoBtn = document.querySelector(".cp-toast-undo-btn");
    assert.ok(undoBtn, "ต้องมีปุ่มเลิกทำโผล่มาจาก showUndoToast()");
    undoBtn.click();
    await p;
    assert.equal(args.pendingSet.has("x-1"), false);
    assert.equal(args._spy.renderCalls.length, 2);
    assert.equal(args._spy.renderCalls[1], false, "render รอบสองต้องไม่มี id อยู่ใน pendingSet แล้ว (แถวกลับมา)");
    assert.equal(args._spy.deleteCalls.length, 0);
    assert.equal(args._spy.commitCalls.length, 0);
    t.mock.timers.reset();
  });

  test("ปล่อยผ่านจนหมดเวลา (5000ms) → deleteFn() ถูกเรียกจริง, เอา id ออกจาก pendingSet, เรียก onCommitted() แทน renderFn()", async (t) => {
    const flushReal = () => new Promise((r) => setImmediate(r));
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const args = makeArgs();
    const p = mod.deleteWithUndo(args);
    t.mock.timers.tick(5000);
    await flushReal();
    await p;
    assert.equal(args.pendingSet.has("x-1"), false);
    assert.equal(args._spy.deleteCalls.length, 1);
    assert.equal(args._spy.commitCalls.length, 1);
    // renderFn() ถูกเรียกแค่ตอนเริ่ม (ครั้งแรก) — ตอนคอมมิตสำเร็จเรียก onCommitted() แทน ไม่เรียก renderFn() ซ้ำ
    assert.equal(args._spy.renderCalls.length, 1);
    t.mock.timers.reset();
  });

  test("ไม่ส่ง onCommitted มา → หลังคอมมิตสำเร็จเรียก renderFn() แทน", async (t) => {
    const flushReal = () => new Promise((r) => setImmediate(r));
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const args = makeArgs({ onCommitted: undefined });
    const p = mod.deleteWithUndo(args);
    t.mock.timers.tick(5000);
    await flushReal();
    await p;
    assert.equal(args._spy.renderCalls.length, 2, "renderFn() ต้องถูกเรียกอีกครั้งแทน onCommitted ที่ไม่ได้ส่งมา");
    t.mock.timers.reset();
  });

  test("deleteFn() reject → catch กันไว้ไม่ throw ทะลุ, เอา id ออกจาก pendingSet, renderFn() ถูกเรียก, โชว์ showToast() ข้อความ error", async (t) => {
    const flushReal = () => new Promise((r) => setImmediate(r));
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const args = makeArgs({ deleteFn: () => Promise.reject(new Error("เครือข่ายขัดข้อง")) });
    const p = mod.deleteWithUndo(args);
    t.mock.timers.tick(5000);
    await flushReal();
    await assert.doesNotReject(p);
    assert.equal(args.pendingSet.has("x-1"), false);
    assert.equal(args._spy.renderCalls.length, 2);
    assert.equal(args._spy.commitCalls.length, 0);
    // เลือกเฉพาะ .cp-toast ที่ไม่ใช่ toast แบบ undo เดิม (showUndoToast() ปิดตัวเองหลังหมดเวลา
    // ผ่าน closing+remove ใน setTimeout 200ms ซึ่งยังไม่ทันลบออกจาก DOM ตอนเทสนี้ตรวจสอบ)
    const toast = document.querySelector(".cp-toast:not(.undo)");
    assert.ok(toast, "ต้องมี toast แจ้งลบไม่สำเร็จ (จาก showToast() ของ deleteWithUndo แยกจาก toast undo เดิม)");
    assert.match(toast.textContent, /ลบไม่สำเร็จ.*เครือข่ายขัดข้อง/);
    t.mock.timers.reset();
  });

  test("ไม่ส่ง targetType มา → ไม่พังตอนคอมมิตสำเร็จ (logAudit ไม่ถูกเรียก)", async (t) => {
    const flushReal = () => new Promise((r) => setImmediate(r));
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const args = makeArgs({ targetType: undefined });
    const p = mod.deleteWithUndo(args);
    t.mock.timers.tick(5000);
    await flushReal();
    await assert.doesNotReject(p);
    assert.equal(args._spy.deleteCalls.length, 1);
    t.mock.timers.reset();
  });
});

// ── downloadCsv() / csvCell() ─────────────────────────────
describe("downloadCsv() / csvCell()", () => {
  let capturedBlob, capturedFilename, revokedUrl, createdUrl;

  beforeEach(() => {
    capturedBlob = null; capturedFilename = null; revokedUrl = null; createdUrl = "blob:mock-url";
    URL.createObjectURL = (blob) => { capturedBlob = blob; return createdUrl; };
    URL.revokeObjectURL = (u) => { revokedUrl = u; };
  });

  test("csvCell() ใส่เครื่องหมายคำพูดครอบ + escape เครื่องหมายคำพูดในค่าด้วยการเบิ้ล", () => {
    assert.equal(mod.csvCell("ธรรมดา"), '"ธรรมดา"');
    assert.equal(mod.csvCell('he said "hi"'), '"he said ""hi"""');
    assert.equal(mod.csvCell(null), '""');
    assert.equal(mod.csvCell(undefined), '""');
    assert.equal(mod.csvCell(42), '"42"');
  });

  test("สร้าง Blob ชนิด text/csv พร้อม BOM นำหน้า (ยืนยันผ่าน arrayBuffer เพราะ .text() ตัด BOM ออกตาม TextDecoder spec)", async () => {
    mod.downloadCsv("report.csv", ["A", "B"], [["1", "2"]]);
    assert.equal(capturedBlob.type, "text/csv;charset=utf-8;");
    const buf = await capturedBlob.arrayBuffer();
    assert.deepEqual(Array.from(new Uint8Array(buf.slice(0, 3))), [0xef, 0xbb, 0xbf]);
  });

  test("เนื้อหา CSV มี header + แถวข้อมูล คั่นด้วย CRLF, cell ผ่าน csvCell()", async () => {
    mod.downloadCsv("report.csv", ["A", "B"], [["1", "2"], ['he said "hi"', "x,y"]]);
    const text = await capturedBlob.text();
    assert.equal(text, 'A,B\r\n"1","2"\r\n"he said ""hi""","x,y"');
  });

  test("คลิก anchor ที่มี download=filename แล้วเรียก revokeObjectURL ด้วย URL เดียวกับที่สร้าง", () => {
    mod.downloadCsv("my-export.csv", ["A"], [["1"]]);
    assert.equal(revokedUrl, createdUrl);
  });

  test("anchor ชั่วคราวถูกลบออกจาก DOM หลังคลิกเสร็จ ไม่ค้างอยู่", () => {
    mod.downloadCsv("x.csv", ["A"], [["1"]]);
    assert.equal(document.querySelectorAll("a[download]").length, 0);
  });
});

// ── escapeHtml() ──────────────────────────────────────────
describe("escapeHtml()", () => {
  test("escape ทั้ง 5 อักขระอันตราย & < > \" '", () => {
    assert.equal(mod.escapeHtml(`&<>"'`), "&amp;&lt;&gt;&quot;&#39;");
  });

  test("ไม่แตะข้อความปกติที่ไม่มีอักขระอันตราย", () => {
    assert.equal(mod.escapeHtml("สวัสดีครับ hello 123"), "สวัสดีครับ hello 123");
  });

  test("null/undefined → string ว่าง", () => {
    assert.equal(mod.escapeHtml(null), "");
    assert.equal(mod.escapeHtml(undefined), "");
  });

  test("ตัวเลขถูกแปลงเป็น string ก่อน escape (ไม่ throw)", () => {
    assert.equal(mod.escapeHtml(123), "123");
  });

  test("กัน XSS payload สคริปต์แท็กจริง", () => {
    assert.equal(
      mod.escapeHtml('<script>alert("x")</script>'),
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;"
    );
  });
});

// ── initials() / avatarHtml() ─────────────────────────────
describe("initials()", () => {
  test("ชื่อ 2 คำ → เอาตัวแรกของแต่ละคำ ตัวพิมพ์ใหญ่", () => {
    assert.equal(mod.initials("สมชาย ใจดี"), "สใ");
    assert.equal(mod.initials("john doe"), "JD");
  });

  test("ชื่อคำเดียว → เอาตัวแรกตัวเดียว", () => {
    assert.equal(mod.initials("Solo"), "S");
  });

  test("ชื่อว่าง/undefined/มีแต่เว้นวรรค → '?'", () => {
    assert.equal(mod.initials(""), "?");
    assert.equal(mod.initials(undefined), "?");
    assert.equal(mod.initials("   "), "?");
  });

  test("เว้นวรรคหลายช่องระหว่างคำ ไม่กระทบผลลัพธ์", () => {
    assert.equal(mod.initials("  Jane   Smith  "), "JS");
  });
});

describe("avatarHtml()", () => {
  test("มี initials() ที่ escape แล้วอยู่ในผลลัพธ์", () => {
    const html = mod.avatarHtml("Ann Lee");
    assert.match(html, /cp-avatar/);
    assert.match(html, />AL</);
  });

  test("ชื่อเดียวกันได้สี (hue) เดิมทุกครั้ง (deterministic hash)", () => {
    const a = mod.avatarHtml("Somsak");
    const b = mod.avatarHtml("Somsak");
    assert.equal(a, b);
  });

  test("ชื่อที่มีอักขระ HTML อันตรายถูก escape ก่อนใส่ใน initials ที่แสดงผล", () => {
    const html = mod.avatarHtml('<b>X</b>');
    assert.doesNotMatch(html, /<b>X/);
  });
});

// ── imgUrl() / imgLabel() / normalizeImage() ──────────────
describe("imgUrl() / imgLabel() / normalizeImage()", () => {
  test("string เดิม (รูปแบบเก่า) → imgUrl คืนค่า string ตรงๆ, imgLabel คืนค่าว่าง", () => {
    assert.equal(mod.imgUrl("a.jpg"), "a.jpg");
    assert.equal(mod.imgLabel("a.jpg"), "");
  });

  test("object {url,label} → imgUrl/imgLabel ดึงค่าตาม key", () => {
    assert.equal(mod.imgUrl({ url: "b.jpg", label: "ซ้าย" }), "b.jpg");
    assert.equal(mod.imgLabel({ url: "b.jpg", label: "ซ้าย" }), "ซ้าย");
  });

  test("object ไม่มี label → imgLabel คืนค่าว่าง (ไม่ throw)", () => {
    assert.equal(mod.imgLabel({ url: "b.jpg" }), "");
  });

  test("null/undefined → imgUrl/imgLabel คืนค่าว่างทั้งคู่ ไม่ throw", () => {
    assert.equal(mod.imgUrl(null), "");
    assert.equal(mod.imgUrl(undefined), "");
    assert.equal(mod.imgLabel(null), "");
  });

  test("normalizeImage() คืน object {url,label} เสมอ ไม่ว่า input จะเป็น string หรือ object", () => {
    assert.deepEqual(mod.normalizeImage("a.jpg"), { url: "a.jpg", label: "" });
    assert.deepEqual(mod.normalizeImage({ url: "b.jpg", label: "L" }), { url: "b.jpg", label: "L" });
  });
});

// ── wireCharCounter() ──────────────────────────────────────
describe("wireCharCounter()", () => {
  function makeFields(value = "hello") {
    const input = document.createElement("input");
    input.id = "wc-input"; input.value = value;
    const countEl = document.createElement("span");
    countEl.id = "wc-count";
    document.body.appendChild(input);
    document.body.appendChild(countEl);
    return { input, countEl };
  }

  test("ตั้งค่าตัวนับทันทีตอนเรียก wireCharCounter() (ไม่ต้องรอ input event)", () => {
    makeFields("hello");
    mod.wireCharCounter("wc-input", "wc-count", 10);
    assert.equal(document.getElementById("wc-count").textContent, "5 / 10");
  });

  test("พิมพ์เพิ่ม → อัปเดตตัวนับผ่าน 'input' event", () => {
    const { input } = makeFields("hi");
    mod.wireCharCounter("wc-input", "wc-count", 10);
    input.value = "hi there!";
    input.dispatchEvent(new Event("input"));
    assert.equal(document.getElementById("wc-count").textContent, "9 / 10");
  });

  test("ความยาว >= 85% ของ max แต่ยังไม่ถึง max → class 'is-near-limit'", () => {
    const { input } = makeFields("");
    mod.wireCharCounter("wc-input", "wc-count", 10);
    input.value = "123456789"; // 9 = 90% ของ 10
    input.dispatchEvent(new Event("input"));
    const countEl = document.getElementById("wc-count");
    assert.ok(countEl.classList.contains("is-near-limit"));
    assert.ok(!countEl.classList.contains("is-over-limit"));
  });

  test("ความยาว >= max → class 'is-over-limit' (ไม่ใช่ is-near-limit)", () => {
    const { input } = makeFields("");
    mod.wireCharCounter("wc-input", "wc-count", 10);
    input.value = "12345678901234"; // 14 > 10
    input.dispatchEvent(new Event("input"));
    const countEl = document.getElementById("wc-count");
    assert.ok(countEl.classList.contains("is-over-limit"));
    assert.ok(!countEl.classList.contains("is-near-limit"));
  });

  test("ความยาวน้อยกว่า 85% → ไม่มี class พิเศษเลย", () => {
    const { input } = makeFields("");
    mod.wireCharCounter("wc-input", "wc-count", 10);
    input.value = "12";
    input.dispatchEvent(new Event("input"));
    const countEl = document.getElementById("wc-count");
    assert.ok(!countEl.classList.contains("is-near-limit"));
    assert.ok(!countEl.classList.contains("is-over-limit"));
  });

  test("หา element ไม่เจอ (id ผิด) → return เงียบๆ ไม่ throw", () => {
    assert.doesNotThrow(() => mod.wireCharCounter("no-such-input", "no-such-count", 10));
  });
});

// ── genLocalId() ───────────────────────────────────────────
describe("genLocalId()", () => {
  test("ขึ้นต้นด้วย 'id' ตามด้วยอักขระ base36 เท่านั้น", () => {
    assert.match(mod.genLocalId(), /^id[a-z0-9]+$/);
  });

  test("เรียกซ้ำหลายครั้งได้ค่าไม่ซ้ำกัน", () => {
    const ids = new Set(Array.from({ length: 20 }, () => mod.genLocalId()));
    assert.equal(ids.size, 20);
  });
});

// ── catName() / groupName() (อ่าน admin-state.js) ──────────
describe("catName() / groupName()", () => {
  test("catName() หา id เจอ → คืนชื่อหมวดหมู่", () => {
    setAllCategories([{ id: "c1", name: "หมวด A" }, { id: "c2", name: "หมวด B" }]);
    assert.equal(mod.catName("c1"), "หมวด A");
    assert.equal(mod.catName("c2"), "หมวด B");
  });

  test("catName() หา id ไม่เจอ (หรือ allCategories ว่าง) → คืน 'ไม่มีหมวดหมู่'", () => {
    setAllCategories([{ id: "c1", name: "หมวด A" }]);
    assert.equal(mod.catName("nope"), "ไม่มีหมวดหมู่");
    setAllCategories([]);
    assert.equal(mod.catName("c1"), "ไม่มีหมวดหมู่");
  });

  test("groupName() หา id เจอ → คืนชื่อหมวดหมู่ใหญ่", () => {
    setAllGroups([{ id: "g1", name: "กลุ่ม A" }]);
    assert.equal(mod.groupName("g1"), "กลุ่ม A");
  });

  test("groupName() หา id ไม่เจอ → คืน string ว่าง (ต่างจาก catName ที่คืนข้อความ fallback)", () => {
    setAllGroups([{ id: "g1", name: "กลุ่ม A" }]);
    assert.equal(mod.groupName("nope"), "");
  });
});

// ── fillCategorySelects() ───────────────────────────────────
describe("fillCategorySelects()", () => {
  function makeSelects() {
    const filterSel = document.createElement("select");
    filterSel.id = "ad-p-filter-cat";
    const pCatSel = document.createElement("select");
    pCatSel.id = "ad-p-cat";
    document.body.appendChild(filterSel);
    document.body.appendChild(pCatSel);
    return { filterSel, pCatSel };
  }

  test("มีหมวดหมู่ → เติม <option> ในทั้งสอง select, ตัวกรองมี 'ทุกหมวดหมู่' นำหน้าเพิ่ม", () => {
    setAllCategories([{ id: "c1", name: "หมวด A" }, { id: "c2", name: "หมวด B" }]);
    const { filterSel, pCatSel } = makeSelects();
    mod.fillCategorySelects();
    assert.equal(filterSel.querySelectorAll("option").length, 3); // "ทุกหมวดหมู่" + 2
    assert.equal(filterSel.querySelector('option[value=""]').textContent, "ทุกหมวดหมู่");
    assert.equal(pCatSel.querySelectorAll("option").length, 2);
    assert.equal(pCatSel.querySelectorAll("option")[0].value, "c1");
  });

  test("ไม่มีหมวดหมู่เลย → ad-p-cat แสดงข้อความ placeholder แทน option ว่างเปล่า", () => {
    setAllCategories([]);
    const { pCatSel } = makeSelects();
    mod.fillCategorySelects();
    assert.equal(pCatSel.querySelectorAll("option").length, 1);
    assert.match(pCatSel.innerHTML, /ยังไม่มีหมวดหมู่/);
  });

  test("ชื่อหมวดหมู่ที่มีอักขระ HTML ถูก escape ในตัวเลือก", () => {
    setAllCategories([{ id: "c1", name: '<script>x</script>' }]);
    const { pCatSel } = makeSelects();
    mod.fillCategorySelects();
    assert.doesNotMatch(pCatSel.innerHTML, /<script>x/);
  });

  test("ไม่มี element ในหน้า (ยังไม่ได้เรนเดอร์ select) → ไม่ throw", () => {
    setAllCategories([{ id: "c1", name: "A" }]);
    assert.doesNotThrow(() => mod.fillCategorySelects());
  });
});

// ── imageGridHTML() ──────────────────────────────────────────
describe("imageGridHTML()", () => {
  test("array ว่าง → ข้อความ placeholder 'ยังไม่มีรูปภาพ'", () => {
    assert.match(mod.imageGridHTML([], false), /ยังไม่มีรูปภาพ/);
  });

  test("withLabel=false → แสดงรูป+ปุ่มลบ ไม่มีช่องป้ายกำกับ", () => {
    const html = mod.imageGridHTML(["a.jpg"], false);
    assert.match(html, /<img src="a\.jpg"/);
    assert.match(html, /ad-img-remove/);
    assert.doesNotMatch(html, /ad-img-tag-input/);
  });

  test("withLabel=true → มีช่อง input ป้ายกำกับด้วย ค่าเริ่มต้นตาม label ของรูป (escape แล้ว)", () => {
    const html = mod.imageGridHTML([{ url: "b.jpg", label: '"ซ้าย"' }], true);
    assert.match(html, /ad-img-tag-input/);
    assert.match(html, /value="&quot;ซ้าย&quot;"/);
  });

  test("หลายรูป → data-idx ของแต่ละ .ad-img-item เรียงตามลำดับ index จริง", () => {
    const html = mod.imageGridHTML(["a.jpg", "b.jpg", "c.jpg"], false);
    // แต่ละรูปมี data-idx ซ้ำ 2 จุด (ตัว <div class="ad-img-item"> เอง และปุ่ม .ad-img-remove
    // ข้างใน) — เจาะจงจับเฉพาะจุดของ .ad-img-item กันนับซ้ำ
    const idxs = Array.from(html.matchAll(/<div class="ad-img-item" data-idx="(\d+)">/g)).map(m => m[1]);
    assert.deepEqual(idxs, ["0", "1", "2"]);
  });
});

// ── slugify() ────────────────────────────────────────────────
describe("slugify()", () => {
  test("แปลงเป็นตัวพิมพ์เล็ก + แทนเว้นวรรคด้วยขีดกลาง", () => {
    assert.equal(mod.slugify("Hello World"), "hello-world");
  });

  test("ตัดอักขระที่ไม่ใช่ a-z/0-9/ไทย/เว้นวรรค/ขีดกลางทิ้ง", () => {
    assert.equal(mod.slugify("Hello!! World??"), "hello-world");
  });

  test("รองรับภาษาไทย", () => {
    assert.equal(mod.slugify("สวัสดี ครับ"), "สวัสดี-ครับ");
  });

  test("เว้นวรรค/ขีดกลางซ้ำหลายตัวติดกัน → เหลือขีดกลางเดียว", () => {
    assert.equal(mod.slugify("a   b--c"), "a-b-c");
  });

  test("ตัดขีดกลางนำหน้า/ต่อท้ายทิ้ง", () => {
    assert.equal(mod.slugify("  -hello-  "), "hello");
  });

  test("null/undefined/ว่างเปล่า → string ว่าง ไม่ throw", () => {
    assert.equal(mod.slugify(null), "");
    assert.equal(mod.slugify(undefined), "");
    assert.equal(mod.slugify(""), "");
  });
});

// ── buildPageList() ─────────────────────────────────────────
describe("buildPageList()", () => {
  test("total <= 7 → แสดงทุกหน้า ไม่มีจุดไข่ปลา", () => {
    assert.deepEqual(mod.buildPageList(1, 5), [1, 2, 3, 4, 5]);
    assert.deepEqual(mod.buildPageList(4, 7), [1, 2, 3, 4, 5, 6, 7]);
  });

  test("current ใกล้หน้าแรก (total>7) → ไม่มีจุดไข่ปลาซ้าย มีจุดไข่ปลาขวา", () => {
    assert.deepEqual(mod.buildPageList(1, 20), [1, 2, "…", 20]);
    assert.deepEqual(mod.buildPageList(2, 20), [1, 2, 3, "…", 20]);
  });

  test("current อยู่กลางๆ (total>7) → มีจุดไข่ปลาทั้งสองข้าง คั่นด้วยหน้ารอบๆ current", () => {
    assert.deepEqual(mod.buildPageList(10, 20), [1, "…", 9, 10, 11, "…", 20]);
  });

  test("current ใกล้หน้าสุดท้าย (total>7) → มีจุดไข่ปลาซ้าย ไม่มีจุดไข่ปลาขวา", () => {
    assert.deepEqual(mod.buildPageList(20, 20), [1, "…", 19, 20]);
    assert.deepEqual(mod.buildPageList(19, 20), [1, "…", 18, 19, 20]);
  });

  test("total = 8 (ขอบเขตพอดีเกิน 7) → ยังมีจุดไข่ปลาได้ตามสูตร", () => {
    assert.deepEqual(mod.buildPageList(1, 8), [1, 2, "…", 8]);
  });
});
