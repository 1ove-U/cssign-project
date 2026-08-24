// test/site-search.test.mjs — รอบที่ 99 (js/site-search.js — UI overlay/wiring ของช่องค้นหา
// สาธารณะ) — เจ้าของเว็บเลือกไฟล์นี้เอง (เคยมีบั๊กจริงมาก่อน: ตัวแปร `lastQuery` ไม่เคยถูกประกาศ
// ใช้ "lastQuery = q;" ตรงๆ ใน renderResults() ภายใต้ "use strict" ทำให้โยน ReferenceError ทุกครั้งที่
// พิมพ์ในกล่องค้นหา — แก้ไปแล้วตั้งแต่รอบ 68 แต่ยังไม่เคยมีเทสไฟล์ไหนล็อกกันบั๊กกลับมาเลยก่อนรอบนี้ —
// ยืนยันด้วย grep ทั้งโปรเจกต์แล้ว)
//
// js/site-search.js (209 บรรทัด) เป็น classic script (IIFE ธรรมดา ไม่ใช่ ES module) โหลดผ่าน
// <script src="..."> ตรงๆ ในหน้าเว็บสาธารณะทุกหน้า — ใช้ `window.__ssIndex` (มาจาก
// js/site-search-index.js ที่ต้องโหลดก่อนไฟล์นี้เสมอ) เป็นจุดต่อเชื่อมเดียวที่ไฟล์นี้พึ่งพาจากภายนอก
// (search()/TYPE_LABEL/loadDynamicIndex()) — เทสไฟล์นี้จึง **stub `window.__ssIndex` เองทั้งหมด**
// แทนการโหลด js/site-search-index.js จริง (ซึ่งจะต้อง stub Firestore ผ่าน db-content.js/
// db-products.js เพิ่มโดยไม่จำเป็น เพราะขอบเขตของรอบนี้คือ UI ของ js/site-search.js เท่านั้น
// ตามที่เจ้าของเว็บเลือก — js/site-search-index.js เป็นไฟล์แยกที่ยังไม่มีเทสเช่นกัน เก็บไว้เป็นตัวเลือก
// รอบถัดไป)
//
// วิธีรัน classic script นี้ใน jsdom: เหมือน test/main-js-dom.test.mjs (รอบ 34) ทุกประการ — สร้าง
// <script> element ใส่ source แล้ว appendChild เข้า document.body (runScripts:"dangerously") — แต่มี
// จุดต่างสำคัญจาก main.js: ไฟล์นี้เช็ค `document.readyState` ก่อนเรียก init() เอง
// (`if(document.readyState==='loading'){ addEventListener('DOMContentLoaded', init) } else { init() }`)
// ต่างจาก main.js ที่ไม่มีการเช็คนี้เลยส่วนใหญ่ (ทำงานทันทีตอน script eval เพราะ element ที่ต้องการมี
// อยู่แล้วในหน้า) — ตรวจแล้วว่า `document.readyState` ของ jsdom **ยังเป็น "loading" ทันทีหลังสร้าง
// JSDOM instance** (ไม่ใช่ "complete" ทันที) และ jsdom เองจะยิง DOMContentLoaded/load จริงแบบ
// asynchronous ในเวลาสั้นๆ ต่อมา (ยืนยันด้วยสคริปต์ทดสอบแยก) — ถ้า appendChild script ตอน readyState
// ยังเป็น "loading" อยู่ (ทันทีหลังสร้าง dom โดยไม่รอ) จะได้ผลลัพธ์ถูกต้องเหมือนกัน **แต่ถ้าลอง dispatch
// "DOMContentLoaded" เองซ้ำอีกรอบจะทำให้ init() ถูกเรียกซ้ำสอง (ครั้งจาก listener ที่ลงทะเบียนไว้ +
// ครั้งจาก jsdom เองยิงจริงภายหลัง) สร้าง overlay ซ้ำสองชุดและ throw error ตอนเรียก
// closeBtn.addEventListener ในรอบที่สอง (ยืนยันด้วยสคริปต์ทดสอบแยกก่อนเขียนไฟล์นี้ — ไม่ใช่บั๊กของ
// js/site-search.js เอง แต่เป็นเรื่องวิธีทดสอบ)** — วิธีที่ปลอดภัยและถูกต้องที่ใช้ในไฟล์นี้คือ **รอให้
// `document.readyState === "complete"` ก่อน แล้วค่อย appendChild script** (poll ทุก 5ms) ให้ jsdom ยิง
// DOMContentLoaded ของจริงไปเรียบร้อยก่อนแล้ว (เข้า else-branch เรียก init() ทันทีครั้งเดียวตอน script
// eval พอดี ไม่มีการซ้อนทับกับ listener ใดๆ เลย)
//
// ตรวจโค้ดจริงทั้งไฟล์ js/site-search.js ละเอียดก่อนเขียนไฟล์นี้ทั้งหมด (รวมทั้ง escapeHtml()/
// highlight()/escRe() local ในไฟล์นี้) — ไม่พบบั๊กใหม่ จึงเป็นไฟล์เทสล้วนๆ ไม่มีการแก้โค้ดผลิตภัณฑ์เลย
// แม้แต่บรรทัดเดียว
//
// หมายเหตุ stderr ที่คาดไว้แล้ว (ไม่ใช่ error จริง): เทส "Enter (มีผลลัพธ์แรกอยู่)" จะเห็น log
// "Not implemented: navigation to another Document" ออกมาจาก jsdom ตอนโค้ดจริงตั้ง
// `window.location.href = first.getAttribute('href')` — jsdom ไม่ implement การนำทางจริง (เหมือนที่
// test/orders-tab-export.test.mjs รอบ 97 เจอกับ `<a>.click()`/`window.print()`) แต่ต่างจากรอบนั้นตรงที่
// **ไม่สามารถ stub `window.location` ทับได้เลย** (jsdom กำหนด property นี้แบบ non-configurable บน
// Window — ยืนยันด้วยสคริปต์ทดสอบแยกก่อนเขียนไฟล์นี้ว่า `Object.defineProperty` โยน "Cannot redefine
// property: location" เสมอ) จึงปล่อยให้ log ออกไปตามปกติ (ไม่ throw ไม่ทำให้เทสพัง) แล้วตรวจสอบแค่ว่า
// href ของผลลัพธ์แรกถูกต้องแทน (นั่นคือค่าที่โค้ดจริงจะส่งเข้า window.location.href จริงๆ)
//
// ข้อสังเกตที่ตรวจแล้ว (ไม่ใช่บั๊กใหม่ ไม่ได้อยู่ในขอบเขตที่เจ้าของเว็บสั่งแก้รอบนี้ — บันทึกไว้เฉยๆ):
// renderResults() ที่พบผลลัพธ์ (ต่างจาก renderNoMatch() ที่ escapeHtml() คำค้นหาแล้ว) ใช้
// highlight(item.title, q)/highlight(item.desc, q) แปะลง innerHTML ตรงๆ **โดยไม่ escapeHtml() เนื้อหา
// item.title/item.desc เองเลย** — สำหรับ STATIC_INDEX (hardcode ในไฟล์ js/site-search-index.js) ไม่มี
// ความเสี่ยงเพราะเป็นข้อความคงที่ที่ควบคุมเองอยู่แล้ว แต่ dynamicIndex (มาจาก Firestore ผ่าน
// getPortfolios()/getProducts()) อาจมีความเสี่ยง stored-XSS ถ้ามีการกรอกชื่อผลงาน/สินค้าที่มี HTML แฝง
// ในแอดมิน — เป็นพฤติกรรมเดิมของโค้ดที่มีอยู่ก่อนรอบนี้ (ไม่ใช่สิ่งที่รอบนี้เปลี่ยน) เจ้าของเว็บอาจ
// พิจารณาแก้ในรอบถัดไปถ้าต้องการ (นอกขอบเขตที่สั่งไว้รอบนี้)

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const SITE_SEARCH_SRC = readFileSync(new URL("../js/site-search.js", import.meta.url), "utf-8");

const BASE_HTML = `<!doctype html>
<html>
<head></head>
<body>
  <button class="nav-search-trigger" id="trigger-1">ค้นหา 1</button>
  <button class="nav-search-trigger" id="trigger-2">ค้นหา 2</button>
  <input id="other-input" type="text">
</body>
</html>`;

// รอ document.readyState === "complete" ก่อนเสมอ (ดูหมายเหตุยาวหัวไฟล์ — กันการเรียก init() ซ้ำสอง)
async function makeDom() {
  const dom = new JSDOM(BASE_HTML, {
    url: "https://example.test/",
    runScripts: "dangerously",
    pretendToBeVisual: true
  });
  while (dom.window.document.readyState !== "complete") {
    await new Promise(r => setTimeout(r, 5));
  }
  return dom;
}

// stub window.__ssIndex เอง (แทนการโหลด js/site-search-index.js จริง) — mockResults ปรับได้ต่อเทส
function stubSsIndex(dom, { mockResults = [], typeLabel = { page: "หน้าเว็บ", product: "สินค้า" } } = {}) {
  const searchCalls = [];
  const loadDynamicIndexCalls = [];
  dom.window.__ssIndex = {
    search: function (q) { searchCalls.push(q); return mockResults; },
    TYPE_LABEL: typeLabel,
    loadDynamicIndex: function () { loadDynamicIndexCalls.push(true); }
  };
  return { searchCalls, loadDynamicIndexCalls };
}

function runSiteSearchJs(dom) {
  const scriptEl = dom.window.document.createElement("script");
  scriptEl.textContent = SITE_SEARCH_SRC;
  dom.window.document.body.appendChild(scriptEl);
}

async function setup(opts) {
  const dom = await makeDom();
  const spies = stubSsIndex(dom, opts);
  runSiteSearchJs(dom);
  return { dom, document: dom.window.document, ...spies };
}

function fire(el, type, opts = {}) {
  const win = el.ownerDocument.defaultView;
  el.dispatchEvent(new win.Event(type, { bubbles: true, cancelable: true, ...opts }));
}

function fireKey(doc, key, opts = {}) {
  const win = doc.defaultView;
  doc.dispatchEvent(new win.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...opts }));
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

const MOCK_RESULTS = [
  { type: "product", title: "ป้ายไฟ LED", desc: "ป้ายไฟ LED คุณภาพสูง", url: "products.html?cat=safety" },
  { type: "page", title: "ติดต่อเรา", desc: "ขอใบเสนอราคา", url: "contact.html" }
];

describe("js/site-search.js — overlay markup + trigger (รอบที่ 99)", () => {
  test("buildOverlay(): สร้าง overlay 1 ชุด (#site-search-overlay) พร้อม input/close/results/foot ครบ ไม่มี class 'open' ตอนเริ่ม", async () => {
    const { document } = await setup();
    const overlays = document.querySelectorAll("#site-search-overlay");
    assert.equal(overlays.length, 1, "ต้องมี overlay แค่ 1 ชุด (init() ต้องไม่ถูกเรียกซ้ำ)");
    const overlay = overlays[0];
    assert.equal(overlay.classList.contains("open"), false);
    assert.ok(overlay.querySelector("#ss-input"));
    assert.ok(overlay.querySelector("#ss-close"));
    assert.ok(overlay.querySelector("#ss-results"));
    assert.ok(overlay.querySelector(".ss-foot"));
    assert.equal(overlay.querySelector(".ss-panel").getAttribute("role"), "dialog");
    assert.equal(overlay.querySelector(".ss-panel").getAttribute("aria-modal"), "true");
  });

  test("ปุ่ม .nav-search-trigger ทุกตัว (ไม่ใช่แค่ตัวแรก) เปิด overlay ได้ (forEach ผูก listener ทุกตัว)", async () => {
    const { document } = await setup();
    const overlay = document.getElementById("site-search-overlay");

    fire(document.getElementById("trigger-2"), "click");
    assert.ok(overlay.classList.contains("open"), "ปุ่มที่สองต้องเปิด overlay ได้เหมือนปุ่มแรก");
  });
});

describe("js/site-search.js — open()/close() (รอบที่ 99)", () => {
  test("open(): เติม class 'open', ล็อก body scroll (overflow:hidden), เรียก loadDynamicIndex() ครั้งเดียว, แสดงสถานะว่าง (chip คำค้นหายอดนิยม) ทันที", async () => {
    const { document, loadDynamicIndexCalls } = await setup();
    fire(document.getElementById("trigger-1"), "click");

    const overlay = document.getElementById("site-search-overlay");
    assert.ok(overlay.classList.contains("open"));
    assert.equal(document.body.style.overflow, "hidden");
    assert.equal(loadDynamicIndexCalls.length, 1);
    const chips = document.querySelectorAll("#ss-results .ss-chip");
    assert.equal(chips.length, 5, "ต้องมี chip คำค้นหายอดนิยม 5 ปุ่มตามโค้ดจริง");
    assert.equal(chips[0].getAttribute("data-q"), "ป้ายความปลอดภัย");
  });

  test("open(): โฟกัส input หลัง ~30ms ตามโค้ดจริง (setTimeout)", async () => {
    const { document } = await setup();
    fire(document.getElementById("trigger-1"), "click");
    const input = document.getElementById("ss-input");
    assert.notEqual(document.activeElement, input, "ยังไม่ควรโฟกัสทันทีก่อนครบ 30ms");
    await delay(60);
    assert.equal(document.activeElement, input, "ต้องโฟกัส input หลังผ่านไป ~30ms");
  });

  test("ปุ่มปิด (#ss-close): เอา class 'open' ออก, คืนค่า overflow, เคลียร์ค่าในกล่องค้นหา", async () => {
    const { document } = await setup();
    const overlay = document.getElementById("site-search-overlay");
    fire(document.getElementById("trigger-1"), "click");
    const input = document.getElementById("ss-input");
    input.value = "ทดสอบ";

    fire(document.getElementById("ss-close"), "click");
    assert.equal(overlay.classList.contains("open"), false);
    assert.equal(document.body.style.overflow, "");
    assert.equal(input.value, "");
  });

  test("คลิกที่พื้นหลัง overlay (นอก .ss-panel) ปิด, คลิกภายใน .ss-panel เองไม่ปิด", async () => {
    const { document } = await setup();
    const overlay = document.getElementById("site-search-overlay");
    fire(document.getElementById("trigger-1"), "click");

    fire(overlay.querySelector(".ss-panel"), "click");
    assert.ok(overlay.classList.contains("open"), "คลิกภายในกล่องค้นหาต้องไม่ปิด overlay");

    fire(overlay, "click"); // target === overlay ตรงๆ (พื้นหลัง)
    assert.equal(overlay.classList.contains("open"), false);
  });
});

describe("js/site-search.js — คีย์ลัด (รอบที่ 99)", () => {
  test("Ctrl+K / Cmd+K เปิด overlay ได้จากทุกที่ (metaKey หรือ ctrlKey อย่างใดอย่างหนึ่ง) แม้ overlay ปิดอยู่และไม่ได้โฟกัสช่องค้นหา", async () => {
    const { document } = await setup();
    fireKey(document, "k", { ctrlKey: true });
    assert.ok(document.getElementById("site-search-overlay").classList.contains("open"));
  });

  test("Cmd+K (metaKey) เปิดได้เช่นกัน + ตัวพิมพ์ใหญ่ 'K' ก็เปิดได้", async () => {
    const { document } = await setup();
    fireKey(document, "K", { metaKey: true });
    assert.ok(document.getElementById("site-search-overlay").classList.contains("open"));
  });

  test("'/' เปิด overlay เมื่อยังไม่โฟกัสช่องค้นหาและ overlay ยังปิดอยู่ + เรียก preventDefault()", async () => {
    const { document } = await setup();
    document.getElementById("other-input").focus();
    const win = document.defaultView;
    const evt = new win.KeyboardEvent("keydown", { key: "/", bubbles: true, cancelable: true });
    document.dispatchEvent(evt);
    assert.ok(document.getElementById("site-search-overlay").classList.contains("open"));
    assert.equal(evt.defaultPrevented, true);
  });

  test("'/' ไม่เปิดซ้ำเมื่อ overlay เปิดอยู่แล้ว (ไม่ throw, ไม่มีผลอะไรเพิ่ม)", async () => {
    const { document } = await setup();
    fire(document.getElementById("trigger-1"), "click"); // เปิดไว้ก่อน
    const overlay = document.getElementById("site-search-overlay");
    fireKey(document, "/");
    assert.ok(overlay.classList.contains("open"), "ยังคงเปิดอยู่ตามเดิม ไม่พัง");
  });

  test("Escape ปิด overlay เมื่อเปิดอยู่, ไม่มีผลอะไรเมื่อ overlay ปิดอยู่แล้ว", async () => {
    const { document } = await setup();
    const overlay = document.getElementById("site-search-overlay");
    fire(document.getElementById("trigger-1"), "click");
    fireKey(document, "Escape");
    assert.equal(overlay.classList.contains("open"), false);

    fireKey(document, "Escape"); // ปิดอยู่แล้ว ยิงซ้ำต้องไม่พัง
    assert.equal(overlay.classList.contains("open"), false);
  });

  test("Enter (มีผลลัพธ์แรกอยู่): ไม่ throw error — ผลลัพธ์แรกมี href ตรงกับ item.url ที่คาดไว้ (สิ่งที่โค้ดจริงใช้นำทาง)", async () => {
    const { document } = await setup({ mockResults: MOCK_RESULTS });
    fire(document.getElementById("trigger-1"), "click");
    const input = document.getElementById("ss-input");
    input.value = "ป้าย";
    fire(input, "input");
    await delay(250);

    const first = document.querySelector("#ss-results .ss-result");
    assert.equal(first.getAttribute("href"), MOCK_RESULTS[0].url);
    assert.doesNotThrow(() => fireKey(document, "Enter"));
  });

  test("Enter (ไม่มีผลลัพธ์เลย): ไม่ throw error และไม่มีการนำทางใดๆ (ไม่มี .ss-result ให้เลือก)", async () => {
    const { document } = await setup({ mockResults: [] });
    fire(document.getElementById("trigger-1"), "click"); // สถานะว่าง (popular chips) ไม่มี .ss-result เลย
    assert.equal(document.querySelectorAll("#ss-results .ss-result").length, 0);
    assert.doesNotThrow(() => fireKey(document, "Enter"));
  });
});

describe("js/site-search.js — พิมพ์ค้นหา: skeleton -> debounce -> ผลลัพธ์ (รอบที่ 99, บั๊กเดิม lastQuery)", () => {
  test("พิมพ์คำค้น: แสดง skeleton (4 แถว) ทันที ก่อนครบ debounce 150ms — ไม่ throw ReferenceError เรื่อง lastQuery (บั๊กเดิมที่เคยเกิดตรงนี้พอดี)", async () => {
    const { document } = await setup({ mockResults: MOCK_RESULTS });
    fire(document.getElementById("trigger-1"), "click");
    const input = document.getElementById("ss-input");

    input.value = "ป";
    assert.doesNotThrow(() => fire(input, "input"),
      "ห้าม throw ReferenceError: lastQuery is not defined (บั๊กเดิมก่อนรอบ 68)");

    const skelRows = document.querySelectorAll("#ss-results .ss-skel-row");
    assert.equal(skelRows.length, 4, "ต้องมี skeleton แถวชั่วคราว 4 แถวทันทีตามโค้ดจริง ก่อนผลลัพธ์จริงมาถึง");
  });

  test("หลังครบ debounce (150ms): renderResults(q) แสดงผลลัพธ์จริงจาก window.__ssIndex.search() — icon/highlight/tag ครบตามสูตร", async () => {
    const { document, searchCalls } = await setup({
      mockResults: MOCK_RESULTS,
      typeLabel: { product: "สินค้า", page: "หน้าเว็บ" }
    });
    fire(document.getElementById("trigger-1"), "click");
    const input = document.getElementById("ss-input");
    input.value = "ป้ายไฟ";
    fire(input, "input");
    await delay(250);

    assert.deepEqual(searchCalls, ["ป้ายไฟ"]);
    const results = document.querySelectorAll("#ss-results .ss-result");
    assert.equal(results.length, 2);
    assert.equal(results[0].getAttribute("data-idx"), "0");
    assert.equal(results[0].getAttribute("href"), "products.html?cat=safety");
    assert.ok(results[0].querySelector(".ss-result-icon svg"), "ต้องมีไอคอน svg");
    assert.equal(results[0].querySelector(".ss-result-tag").textContent, "สินค้า");
    // highlight(): คำที่ตรงกับคำค้นหาต้องถูกห่อด้วย <mark> (case-insensitive) ในหัวข้อผลลัพธ์
    assert.ok(results[0].querySelector(".ss-result-title mark"), "คำที่ตรงคำค้นหาต้องถูกห่อด้วย <mark>");
    assert.equal(results[0].querySelector(".ss-result-title mark").textContent, "ป้ายไฟ");
  });

  test("พิมพ์รัวๆ ภายในช่วง debounce เดียวกัน: ใช้เฉพาะคำค้นหาล่าสุดเท่านั้น (requestId guard กันคำค้นหาเก่าแทรก)", async () => {
    const { document, searchCalls } = await setup({ mockResults: MOCK_RESULTS });
    fire(document.getElementById("trigger-1"), "click");
    const input = document.getElementById("ss-input");

    input.value = "ป";
    fire(input, "input");
    await delay(50); // ยังไม่ครบ 150ms ของคำแรก
    input.value = "ป้ายไฟ";
    fire(input, "input"); // ตั้ง debounce ใหม่ ยกเลิกของเดิม (clearTimeout)

    await delay(250);
    assert.deepEqual(searchCalls, ["ป้ายไฟ"], "ต้องเรียก search() แค่ครั้งเดียวด้วยคำล่าสุด ไม่ใช่คำแรกที่พิมพ์ไปก่อน");
  });

  test("ลบข้อความในกล่องค้นหาจนว่าง: renderResults('') ทำงานทันที (ไม่ผ่าน debounce) กลับไปแสดง chip คำค้นหายอดนิยม", async () => {
    const { document } = await setup({ mockResults: MOCK_RESULTS });
    fire(document.getElementById("trigger-1"), "click");
    const input = document.getElementById("ss-input");
    input.value = "ป้ายไฟ";
    fire(input, "input");
    await delay(250);
    assert.equal(document.querySelectorAll("#ss-results .ss-result").length, 2);

    input.value = "";
    fire(input, "input"); // trim ว่าง -> renderResults(q) เรียกทันที ไม่รอ debounce
    assert.equal(document.querySelectorAll("#ss-results .ss-result").length, 0);
    assert.ok(document.querySelector("#ss-results .ss-chip-row"), "ต้องกลับไปแสดง chip คำค้นหายอดนิยมทันที");
  });

  test("ไม่พบผลลัพธ์ (search() คืน []): escapeHtml() คำค้นหาก่อนแสดงเสมอ กัน reflected XSS (บั๊กความปลอดภัยที่เคยแก้แล้ว)", async () => {
    const { document } = await setup({ mockResults: [] });
    fire(document.getElementById("trigger-1"), "click");
    const input = document.getElementById("ss-input");
    input.value = '<img src=x onerror="alert(1)">';
    fire(input, "input");
    await delay(250);

    const box = document.getElementById("ss-results");
    assert.equal(box.querySelector("img"), null, "ต้องไม่มี <img> element จริงเกิดขึ้น (escapeHtml ต้องกัน HTML injection)");
    assert.ok(box.textContent.includes('<img src=x onerror="alert(1)">'), "ข้อความคำค้นหาต้องยังอ่านได้ปกติ (แค่ escape ไม่ใช่ตัดทิ้ง)");
    assert.ok(box.querySelector('a[href="contact.html"]'), "ต้องมีลิงก์ 'สอบถามทีมงานโดยตรง'");
    assert.ok(box.querySelector('a[href="products.html"]'), "ต้องมีลิงก์ 'ดูสินค้าทั้งหมด'");
  });

  test("คลิก chip คำค้นหายอดนิยม: เติมคำนั้นลงกล่องค้นหา + ค้นหาทันที + โฟกัส input", async () => {
    const { document, searchCalls } = await setup({ mockResults: MOCK_RESULTS });
    fire(document.getElementById("trigger-1"), "click");

    const chip = document.querySelector('.ss-chip[data-q="ป้ายจราจร"]');
    fire(chip, "click");

    const input = document.getElementById("ss-input");
    assert.equal(input.value, "ป้ายจราจร");
    assert.deepEqual(searchCalls, ["ป้ายจราจร"], "คลิก chip ต้องเรียก renderResults() ทันทีไม่ผ่าน debounce");
    assert.equal(document.querySelectorAll("#ss-results .ss-result").length, 2);
    assert.equal(document.activeElement, input);
  });
});

describe("js/site-search.js — window.__ssRefreshResults() (รอบที่ 99)", () => {
  test("overlay เปิดอยู่ + มีคำค้นหาอยู่ในกล่อง -> เรียก __ssRefreshResults() แล้ว render ซ้ำด้วยคำเดิม (ใช้ตอน loadDynamicIndex โหลดเสร็จ)", async () => {
    const { document, dom, searchCalls } = await setup({ mockResults: MOCK_RESULTS });
    fire(document.getElementById("trigger-1"), "click");
    const input = document.getElementById("ss-input");
    input.value = "ป้ายไฟ";
    fire(input, "input");
    await delay(250);
    assert.equal(searchCalls.length, 1);

    assert.equal(typeof dom.window.__ssRefreshResults, "function");
    dom.window.__ssRefreshResults();
    assert.deepEqual(searchCalls, ["ป้ายไฟ", "ป้ายไฟ"], "ต้องเรียก search() ซ้ำอีกครั้งด้วยคำเดิมที่อยู่ในกล่อง");
  });

  test("overlay ปิดอยู่ -> เรียก __ssRefreshResults() ไม่มีผลอะไร (ไม่ throw, ไม่เรียก search() เพิ่ม)", async () => {
    const { dom, searchCalls } = await setup({ mockResults: MOCK_RESULTS });
    assert.doesNotThrow(() => dom.window.__ssRefreshResults());
    assert.deepEqual(searchCalls, []);
  });

  test("overlay เปิดอยู่แต่กล่องค้นหาว่างเปล่า -> เรียก __ssRefreshResults() ไม่มีผลอะไรเช่นกัน", async () => {
    const { document, dom, searchCalls } = await setup({ mockResults: MOCK_RESULTS });
    fire(document.getElementById("trigger-1"), "click");
    dom.window.__ssRefreshResults();
    assert.deepEqual(searchCalls, [], "input ว่างเปล่า -> ไม่ควรเรียก search() เลย");
  });
});
