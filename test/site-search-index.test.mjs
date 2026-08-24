// test/site-search-index.test.mjs — รอบที่ 100 (js/site-search-index.js — ดัชนีค้นหา + ฟังก์ชัน
// จับคู่/ให้คะแนนผลลัพธ์) — เจ้าของเว็บเลือกไฟล์นี้เอง (คู่ตรงกับรอบ 99 ที่ยังไม่ได้ทำ เพราะตอนนั้น
// site-search.js stub window.__ssIndex เองแทน กันไม่ต้อง stub Firestore เพิ่มเกินขอบเขต)
//
// js/site-search-index.js (150 บรรทัด) เป็น classic script (IIFE ธรรมดา ไม่ใช่ ES module) โหลดผ่าน
// <script src="..."> ก่อน js/site-search.js เสมอในทุกหน้า HTML สาธารณะ — export ออกมาแค่ 3 อย่างผ่าน
// window.__ssIndex: search()/TYPE_LABEL/loadDynamicIndex() (score()/STATIC_INDEX/dynamicIndex/
// dynamicState เป็น closure ภายในไฟล์ ไม่ถูก export ตรงๆ จึงทดสอบผ่าน search()/loadDynamicIndex()
// เท่านั้น — ตรวจด้วย grep ทั้งไฟล์แล้วว่าไม่มีจุดอื่นให้ hook เข้าไปตรงๆ)
//
// วิธีรัน classic script นี้ใน jsdom: แพทเทิร์นเดียวกับ test/site-search.test.mjs (รอบ 99) ทุกประการ —
// รอ document.readyState === "complete" ก่อน (poll ทุก 5ms) แล้วค่อย appendChild <script> — ไฟล์นี้
// ไม่มี init()/DOMContentLoaded listener เอง (ไม่แตะ DOM เลยทั้งไฟล์ ไม่มี event listener ผูกกับหน้าเว็บ)
// จึงไม่มีความเสี่ยงเรื่องเรียกซ้ำสองแบบที่ site-search.js เจอ — แต่ยังคงรอ readyState==="complete"
// ไว้เพื่อความสอดคล้องกับแพทเทิร์นเดิมและกันปัญหาจังหวะโหลดสคริปต์อื่นๆ ที่อาจมาในอนาคต
//
// **ข้อจำกัดสำคัญของสภาพแวดล้อมทดสอบที่ตรวจพบก่อนเขียนไฟล์นี้ (ไม่ใช่บั๊กของ js/site-search-index.js
// เอง — บันทึกไว้ให้ชัดเจนเหมือนที่ round 99 บันทึกเรื่อง window.location)**: loadDynamicIndex() เรียก
// `import('./db-content.js')` / `import('./db-products.js')` (dynamic import) จากภายใน inline
// <script> ที่รันผ่าน jsdom runScripts:"dangerously" — ยืนยันด้วยสคริปต์ทดสอบแยกก่อนเขียนไฟล์นี้ว่า
// jsdom เวอร์ชัน 29.1.1 ที่โปรเจกต์นี้ใช้ **ไม่รองรับ dynamic import() ในสคริปต์ที่รันแบบนี้เลย** — จะ
// throw "A dynamic import callback was not specified" เสมอ (jsdom ไม่ได้ตั้งค่า
// importModuleDynamically callback ให้ vm.Script ภายใน) ซึ่งโค้ดจริงจับด้วย `.catch()` อยู่แล้ว (ไม่
// throw ออกมาให้เห็น) แต่ผลคือ **Promise.all([import(...), import(...)]) จะ reject เสมอในสภาพแวดล้อม
// ทดสอบนี้ ทำให้ dynamicState ไปจบที่ 'error' เสมอ ไม่มีทางไปถึง 'ready' ได้เลย** — เท่ากับว่า
// **เส้นทาง "โหลดสำเร็จ" ของ loadDynamicIndex() (การแปลง portfolios/products จาก Firestore เป็น
// pfItems/prItems, การกรอง product ที่ status==='inactive' ออก, การต่อชื่อ client กับ title,
// window.__ssRefreshResults() ถูกเรียกตอนโหลดเสร็จ) ไม่สามารถทดสอบผ่านแนวทาง "รันไฟล์เต็มใน jsdom"
// นี้ได้เลยในสภาพแวดล้อมนี้** — ไฟล์นี้จึงทดสอบได้แค่ 2 ส่วน: (1) search()/score() ผ่าน STATIC_INDEX
// ล้วนๆ (ครอบคลุมเต็มที่ ไม่มีข้อจำกัด) และ (2) พฤติกรรม guard/error-resilience ของ
// loadDynamicIndex() เอง (ไม่ throw, กัน state ซ้ำซ้อน, ให้ search() ยังทำงานต่อได้ปกติแม้โหลดไม่สำเร็จ)
// — เส้นทางโหลดสำเร็จของ dynamicIndex ยังเป็นช่องว่างที่ไม่มีเทสคลุม เจ้าของเว็บอาจพิจารณาเพิ่ม stub
// สำหรับ Node's vm importModuleDynamically หรือปรับวิธีทดสอบในรอบถัดไปถ้าต้องการปิดช่องว่างนี้
// (ต้องถามก่อน ไม่ใช่แก้เองโดยไม่บอก — นอกขอบเขตที่สั่งไว้รอบนี้)
//
// ตรวจโค้ดจริงทั้งไฟล์ js/site-search-index.js ละเอียดก่อนเขียนไฟล์นี้ทั้งหมด (รวมทั้ง STATIC_INDEX
// ทุกรายการ, score()/search() logic, loadDynamicIndex() ทั้งฟังก์ชัน) — ไม่พบบั๊กใหม่ จึงเป็นไฟล์เทส
// ล้วนๆ ไม่มีการแก้โค้ดผลิตภัณฑ์เลยแม้แต่บรรทัดเดียว
//
// การ assert ผลลัพธ์ search() ในไฟล์นี้อ้างอิงเนื้อหาจริงของ STATIC_INDEX ที่มีอยู่ตอนเขียนไฟล์นี้
// (ยืนยันด้วยการรันโค้ดจริงหลายคำค้นหาก่อนเขียนเทส ไม่ได้เดาผลลัพธ์เอง) — ถ้า STATIC_INDEX ถูกแก้ไข
// เพิ่ม/ลบ/เปลี่ยนคำในรอบถัดไป เทสบางจุดที่อ้างอิงชื่อรายการตรงๆ อาจต้องปรับตาม (เป็นเรื่องปกติของเทส
// ที่พึ่งพาข้อมูลจริงในไฟล์ ไม่ใช่บั๊ก)

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const SITE_SEARCH_INDEX_SRC = readFileSync(
  new URL("../js/site-search-index.js", import.meta.url),
  "utf-8"
);

// รอ document.readyState === "complete" ก่อนเสมอ (แพทเทิร์นเดียวกับรอบ 99 — ดูหมายเหตุหัวไฟล์)
async function makeDom() {
  const dom = new JSDOM(`<!doctype html><html><head></head><body></body></html>`, {
    url: "https://example.test/",
    runScripts: "dangerously",
    pretendToBeVisual: true
  });
  while (dom.window.document.readyState !== "complete") {
    await new Promise(r => setTimeout(r, 5));
  }
  return dom;
}

function runSiteSearchIndexJs(dom) {
  const scriptEl = dom.window.document.createElement("script");
  scriptEl.textContent = SITE_SEARCH_INDEX_SRC;
  dom.window.document.body.appendChild(scriptEl);
}

async function setup() {
  const dom = await makeDom();
  runSiteSearchIndexJs(dom);
  return { dom, ssIndex: dom.window.__ssIndex };
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

describe("js/site-search-index.js — window.__ssIndex: shape (รอบที่ 100)", () => {
  test("export ออกมาแค่ 3 อย่างตามที่ไฟล์ตั้งใจ: search/TYPE_LABEL/loadDynamicIndex", async () => {
    const { ssIndex } = await setup();
    assert.deepEqual(Object.keys(ssIndex).sort(), ["TYPE_LABEL", "loadDynamicIndex", "search"]);
    assert.equal(typeof ssIndex.search, "function");
    assert.equal(typeof ssIndex.loadDynamicIndex, "function");
  });

  test("TYPE_LABEL ครบ 5 ประเภทตามที่โค้ดจริงกำหนด (page/product/project/cert/faq)", async () => {
    const { ssIndex } = await setup();
    // JSON.stringify normalize ก่อนเทียบ — TYPE_LABEL เป็น object literal ที่ถูกสร้างในบริบท vm
    // (คนละ realm จาก Node ฝั่งเทส) ทำให้ Object.prototype คนละตัวกับ literal ฝั่งเทส (ดูหมายเหตุ
    // เดียวกันที่ใช้กับ array ผลลัพธ์ search() ด้านล่าง)
    assert.deepEqual(JSON.parse(JSON.stringify(ssIndex.TYPE_LABEL)), {
      page: "หน้าเว็บ",
      product: "สินค้า",
      project: "ผลงาน",
      cert: "ใบรับรอง",
      faq: "คำถามที่พบบ่อย"
    });
  });
});

describe("js/site-search-index.js — search(): คำค้นหาว่าง/ไม่พบ (รอบที่ 100)", () => {
  // หมายเหตุ: search() รันจริงในบริบท vm ของ jsdom (คนละ realm จาก Node ฝั่งเทส) — array ที่คืนมา
  // จึงใช้ Array.prototype คนละตัวกับ [] literal ฝั่งเทส ทำให้ assert.deepEqual (strict) ตรวจ
  // prototype แล้วไม่ผ่านแม้โครงสร้างจะเหมือนกัน (ยืนยันด้วยการรันจริงก่อนแก้) — ใช้ .length === 0
  // ตรวจแทนความว่างเปล่าของ array ในทุกเทสของกลุ่มนี้ (ไม่ใช่ปัญหาของโค้ดจริง เป็นเรื่อง cross-realm
  // ของวิธีทดสอบเท่านั้น)
  test("search(''): คืน array ว่างทันที ไม่ throw", async () => {
    const { ssIndex } = await setup();
    assert.equal(ssIndex.search("").length, 0);
  });

  test("search('   '): คำค้นหามีแต่ whitespace -> trim() แล้วว่าง -> คืน array ว่าง", async () => {
    const { ssIndex } = await setup();
    assert.equal(ssIndex.search("   ").length, 0);
  });

  test("search(คำที่ไม่มีในดัชนีเลย): คืน array ว่าง ไม่ throw", async () => {
    const { ssIndex } = await setup();
    assert.equal(ssIndex.search("ไม่มีทางเจอคำนี้แน่นอน xyz999").length, 0);
  });
});

describe("js/site-search-index.js — search(): การให้คะแนนและจัดลำดับผลลัพธ์ (score()) (รอบที่ 100)", () => {
  test("คำค้นตรงกับต้นชื่อ (title ขึ้นต้นด้วยคำค้นพอดี) ได้คะแนนสูงสุด ขึ้นเป็นอันดับแรก", async () => {
    const { ssIndex } = await setup();
    // "อุปกรณ์จราจร" เป็น title เป๊ะของ 1 รายการ (title.indexOf(q)===0 -> score 3) และ "จราจร" (mid-word)
    // ยังไปแมตช์คำอื่นด้วยที่คะแนนต่ำกว่า -> ตรวจว่ารายการที่ title ขึ้นต้นตรงเป๊ะ ต้องมาก่อนเสมอ
    const results = ssIndex.search("อุปกรณ์จราจร");
    assert.ok(results.length >= 1);
    assert.equal(results[0].title, "อุปกรณ์จราจร");
    assert.equal(results[0].url, "products.html?cat=equip");
  });

  test("คำค้นอยู่กลาง/ท้ายชื่อ (title มีคำค้นแต่ไม่ได้ขึ้นต้น) ได้คะแนนรองลงมา แต่ยังสูงกว่ารายการที่แมตช์แค่ desc/keywords", async () => {
    const { ssIndex } = await setup();
    // "line": title "แชท LINE @cssigngroup" มีคำว่า line อยู่กลางคำ (ไม่ขึ้นต้น -> score 2) ต้องมาก่อน
    // รายการอื่นที่ "line" ไปแมตช์แค่ keywords เท่านั้น (เช่น "ติดต่อเรา" ที่มี keyword "...line แชท...")
    const results = ssIndex.search("line");
    assert.ok(results.length >= 2, "ต้องมีอย่างน้อย 2 รายการ (title match + keyword-only match) ให้เทียบลำดับได้");
    assert.equal(results[0].title, "แชท LINE @cssigngroup");
    assert.equal(results[0].url, "https://line.me/ti/p/@cssigngroup");
  });

  test("case-insensitive: คำค้นภาษาอังกฤษตัวพิมพ์ใหญ่ล้วนยังแมตช์ keyword ตัวพิมพ์เล็กได้ปกติ", async () => {
    const { ssIndex } = await setup();
    const upper = ssIndex.search("PRODUCTS");
    const lower = ssIndex.search("products");
    // JSON.stringify normalize ก่อนเทียบ — กัน cross-realm array/object prototype mismatch (ดูหมายเหตุ
    // หัวไฟล์กลุ่มก่อนหน้า) เทียบแค่โครงสร้าง/ค่าจริง ไม่ใช่ reference/prototype
    assert.deepEqual(JSON.parse(JSON.stringify(upper)), JSON.parse(JSON.stringify(lower)), "ผลลัพธ์ตัวพิมพ์ใหญ่/เล็กต้องเหมือนกันทุกประการ (score() ใช้ toLowerCase() ทั้งคู่ฝั่ง)");
    assert.ok(upper.some(r => r.title === "สินค้าทั้งหมด"));
  });

  test("จำกัดผลลัพธ์สูงสุด 8 รายการเสมอ แม้คำค้นจะแมตช์มากกว่านั้น (slice(0,8))", async () => {
    const { ssIndex } = await setup();
    // "ป้าย" แมตช์มากกว่า 8 รายการใน STATIC_INDEX จริง (ยืนยันด้วยการรันจริงก่อนเขียนเทส) — ต้องถูกตัด
    // เหลือแค่ 8 พอดี และ 2 อันดับแรกต้องเป็นรายการที่ title ขึ้นต้นด้วย "ป้าย" ตรงๆ (score 3 ทั้งคู่)
    const results = ssIndex.search("ป้าย");
    assert.equal(results.length, 8);
    assert.equal(results[0].title, "ป้ายความปลอดภัย");
    assert.equal(results[1].title, "ป้ายจราจร");
  });

  test("คำค้นมี whitespace ล้อมรอบ: trim() ก่อนค้นหา ให้ผลลัพธ์เหมือนไม่มี whitespace ทุกประการ", async () => {
    const { ssIndex } = await setup();
    const padded = ssIndex.search("   หน้าแรก   ");
    const clean = ssIndex.search("หน้าแรก");
    // JSON.stringify normalize ก่อนเทียบ — กัน cross-realm array/object prototype mismatch (ดูหมายเหตุ
    // หัวไฟล์กลุ่มก่อนหน้า)
    assert.deepEqual(JSON.parse(JSON.stringify(padded)), JSON.parse(JSON.stringify(clean)));
    assert.equal(clean.length, 1);
    assert.equal(clean[0].url, "index.html");
  });

  test("แต่ละผลลัพธ์มีโครงสร้าง field ครบตามที่ site-search.js (ไฟล์ UI) ต้องใช้จริง (type/title/desc/url)", async () => {
    const { ssIndex } = await setup();
    const results = ssIndex.search("หน้าแรก");
    assert.equal(results.length, 1);
    const item = results[0];
    assert.equal(typeof item.type, "string");
    assert.equal(typeof item.title, "string");
    assert.equal(typeof item.desc, "string");
    assert.equal(typeof item.url, "string");
    assert.equal(item.type, "page");
  });
});

describe("js/site-search-index.js — loadDynamicIndex(): guard + error-resilience (รอบที่ 100)", () => {
  // หมายเหตุ: dynamic import() reject เสมอในสภาพแวดล้อมทดสอบนี้ (ดูหมายเหตุยาวหัวไฟล์) ทำให้
  // loadDynamicIndex() จบที่ dynamicState='error' เสมอ — เทสกลุ่มนี้จึงตรวจแค่ "ไม่ throw" +
  // "search() ด้วย STATIC_INDEX ยังทำงานต่อได้ปกติ" ไม่ใช่เส้นทางโหลดสำเร็จ

  test("เรียกครั้งแรก: ไม่ throw ทันที (synchronous)", async () => {
    const { ssIndex } = await setup();
    assert.doesNotThrow(() => ssIndex.loadDynamicIndex());
  });

  test("เรียกซ้ำทันทีขณะยังอยู่ในสถานะ 'loading' (ก่อน promise reject เสร็จ): ไม่ throw ไม่ทำให้พัง", async () => {
    const { ssIndex } = await setup();
    assert.doesNotThrow(() => {
      ssIndex.loadDynamicIndex();
      ssIndex.loadDynamicIndex(); // ยิงซ้ำทันที — ต้องโดน guard (dynamicState==='loading') กันไว้ ไม่ throw
      ssIndex.loadDynamicIndex();
    });
    await delay(300); // ปล่อยให้ promise chain (ที่ reject แน่นอนในสภาพแวดล้อมนี้) จบก่อนเทสถัดไป
  });

  test("หลังโหลดไม่สำเร็จ (dynamicState -> 'error'): search() ยังค้นหาจาก STATIC_INDEX ได้ตามปกติ ไม่พัง", async () => {
    const { ssIndex } = await setup();
    ssIndex.loadDynamicIndex();
    await delay(300); // รอให้ promise chain reject จบ (ไปที่ .catch() -> dynamicState='error')

    const results = ssIndex.search("หน้าแรก");
    assert.equal(results.length, 1, "STATIC_INDEX ต้องยังค้นหาได้ปกติแม้ dynamicIndex โหลดไม่สำเร็จ");
    assert.equal(results[0].url, "index.html");
  });

  test("ไม่ throw แม้ window.__ssRefreshResults ไม่ถูกกำหนดไว้เลย (ไฟล์นี้เช็คด้วย typeof ก่อนเรียกเสมอ)", async () => {
    const { dom, ssIndex } = await setup();
    assert.equal(dom.window.__ssRefreshResults, undefined, "สถานการณ์ปกติของไฟล์นี้ตัวเดียว (ไม่มี site-search.js ร่วมโหลด) ต้องไม่มีตัวแปรนี้อยู่ก่อน");
    assert.doesNotThrow(() => ssIndex.loadDynamicIndex());
    await delay(300);
  });

  test("เรียกซ้ำอีกครั้งหลังเข้าสถานะ 'error' แล้ว (retry): ไม่ throw เช่นกัน (guard เดิมไม่กัน state 'error')", async () => {
    const { ssIndex } = await setup();
    ssIndex.loadDynamicIndex();
    await delay(300); // เข้า state 'error' แล้ว

    assert.doesNotThrow(() => ssIndex.loadDynamicIndex(), "state 'error' ไม่ถูกกันโดย guard (if loading||ready) — ต้อง retry ได้ ไม่ throw");
    await delay(300);

    const results = ssIndex.search("หน้าแรก");
    assert.equal(results.length, 1, "หลัง retry ซ้ำ search() ต้องยังทำงานปกติ ไม่พัง");
  });
});
