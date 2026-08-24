// test/fancy-effects.test.mjs — รอบที่ 156
//
// js/fancy-effects.js (204 บรรทัด) เป็น classic script (IIFE, 0 exports) ที่รันทันทีตอนโหลด —
// เพิ่ม visual-effect class/element ทั่วเว็บ: heading flicker-on (IntersectionObserver),
// magnetic button class, hazard-stripe scroll progress bar, card corner rivets (รวม popup
// panel), numbered step badge tick-in (IntersectionObserver), road-lane section dividers,
// breadcrumb "/" → chevron — และผูก MutationObserver คอยรัน initRivets()/
// initBreadcrumbChevrons() ซ้ำเมื่อมี DOM เปลี่ยนแปลง (สำหรับ card ที่ render มาจาก Firestore
// แบบ async ทีหลัง)
//
// วิธีทดสอบ: โหลดเป็น classic <script> จริงเข้า JSDOM (runScripts: "dangerously") ตามแพทเทิร์น
// เดียวกับ test/hero-parallax.test.mjs/test/exit-intent-cta.test.mjs
//
// 🐛→✅ บั๊กที่เคยพบระหว่างสำรวจรอบ 156 (บันทึกไว้ใน REFACTOR-PROGRESS.md ตอนนั้น แต่ไม่ได้แก้เพราะ
// scope งานตอนนั้นคือ "เขียนเทส" เท่านั้น) — **แก้แล้วในรอบนี้**: initFlicker()/initTick() เดิมเรียก
// `new IntersectionObserver(...)` โดยไม่มี guard `'IntersectionObserver' in window` เหมือนที่
// js/main.js ทำไว้ทุกจุด (getRevealIO()/statIO) — ถ้าเบราว์เซอร์ไม่รองรับ IntersectionObserver
// (หรือ jsdom ที่ไม่ implement ให้โดย default) และมี element ตรงกับ selector ของ initFlicker() อยู่
// ในหน้า (h1/.hero-title/h2.section-head/[data-fx-flicker]) จะ throw ReferenceError กลางฟังก์ชัน
// start() ทำให้ initMagnetic()/initProgress()/initRivets()/initTick()/initLaneDividers()/
// initBreadcrumbChevrons() และการผูก MutationObserver ท้าย start() ไม่ทำงานเลยสักจุดเดียว — ตอนนี้
// initFlicker()/initTick() ทั้งคู่ return ก่อนถึงบรรทัด IO ถ้าไม่มี IntersectionObserver รองรับ
// (เหมือน getRevealIO() ของ main.js เป๊ะ) — เทสด้านล่างอัปเดตจาก "บันทึกบั๊ก" เป็นยืนยันว่า
// start() รันจนจบครบทุกฟังก์ชันแม้ไม่มี IntersectionObserver เลย
// เทสไฟล์นี้จึงต้อง stub `window.IntersectionObserver` เองในเทสส่วนใหญ่ (เหมือนสภาพเบราว์เซอร์จริงที่
// รองรับ IO) เพื่อให้ทดสอบ behavior ที่ตั้งใจได้ครบทุกฟังก์ชัน — มีเทสเฉพาะ 1 จุดที่จำลอง
// environment ไม่มี IO (ค่า default ของ jsdom) เพื่อยืนยัน fallback ที่ถูกต้องหลังแก้บั๊ก
//
// จุดที่ต้องระวังอื่นๆ (ตรวจสอบด้วยสคริปต์ทดลองแยกก่อนเขียนไฟล์นี้):
// - reduceMotion อ่านจาก `window.matchMedia && window.matchMedia(...).matches` ครั้งเดียวตอน
//   script eval (module-level var) —ต้องตั้ง `dom.window.matchMedia` **ก่อน** appendChild script
// - initProgress() ใช้ `requestAnimationFrame` ผ่าน `onScroll()` — ต้อง mock ให้ synchronous
//   (เหมือน hero-parallax.test.mjs) ให้เทส scroll event อ่านผลได้ทันที
// - scrollHeight/clientHeight/scrollTop เป็น getter ปกติของ jsdom (ค่าคงที่ 0) — ต้อง
//   Object.defineProperty ทับบน documentElement เพื่อคุมค่า pct ที่คำนวณได้
// - initRivets()/initBreadcrumbChevrons() ถูกเรียกซ้ำจาก MutationObserver callback ทุกครั้งที่
//   body มีการเปลี่ยนแปลง (childList + subtree) — jsdom MutationObserver ทำงานจริง (ต่างจาก IO)
//   แต่ callback คิวเป็น microtask จึงต้อง await เพิ่มก่อนตรวจผลหลัง appendChild แบบ async
//
// อ่านโค้ดจริงทั้งไฟล์ js/fancy-effects.js ก่อนเขียนไฟล์นี้ทั้งหมด — ไม่พบบั๊กใหม่อื่นนอกจากจุด IO
// guard ข้างบน ไม่มีการแก้โค้ดผลิตภัณฑ์เลยแม้แต่บรรทัดเดียวในไฟล์นี้

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const SOURCE = readFileSync(new URL("../js/fancy-effects.js", import.meta.url), "utf-8");

// IntersectionObserver stub ง่ายๆ (jsdom ไม่ implement ให้) — เก็บ instance ทุกตัวไว้ใน
// static .instances เพื่อให้เทสเรียก callback เองจำลอง entry เข้า/ออก viewport ได้
class IOStub {
  constructor(cb, opts) {
    this.cb = cb;
    this.opts = opts;
    this.observed = [];
    IOStub.instances.push(this);
  }
  observe(el) { this.observed.push(el); }
  unobserve(el) { this.observed = this.observed.filter((e) => e !== el); }
  disconnect() { this.observed = []; }
}

function makeDom(markup, { matchMedia, withIO = true } = {}) {
  const dom = new JSDOM(`<!doctype html><html><body>${markup}</body></html>`, {
    url: "https://example.test/",
    runScripts: "dangerously",
    pretendToBeVisual: true,
  });
  IOStub.instances = [];
  if (withIO) dom.window.IntersectionObserver = IOStub;
  if (matchMedia) dom.window.matchMedia = matchMedia;
  dom.window.requestAnimationFrame = (cb) => { cb(); return 1; };
  return dom;
}

async function waitReady(dom) {
  while (dom.window.document.readyState !== "complete") {
    await new Promise((r) => setTimeout(r, 5));
  }
}

function runScript(dom) {
  const script = dom.window.document.createElement("script");
  script.textContent = SOURCE;
  dom.window.document.body.appendChild(script);
}

function reducedMotionMatchMedia(query) {
  return { matches: query.indexOf("prefers-reduced-motion") !== -1 };
}

describe("js/fancy-effects.js — heading flicker/magnetic btn/progress bar/rivets/tick/lane dividers/breadcrumb chevron", () => {
  test("ไม่มี element ตรง selector ใดเลย — ไม่ throw, progress bar ยังถูกสร้างเสมอ (initProgress ไม่มี guard element)", async () => {
    const dom = makeDom("<div>empty page</div>");
    await waitReady(dom);
    assert.doesNotThrow(() => runScript(dom));
    assert.ok(dom.window.document.getElementById("fx-progress"));
  });

  test("✅ แก้บั๊กแล้ว: มี h1 แต่ไม่มี window.IntersectionObserver (ค่า default ของ jsdom) — ไม่ throw อีกต่อไป, initFlicker() ข้าม (ไม่ติด fx-flicker เลย เพราะจะค้าง opacity:0 ถ้าไม่มี IO มา activate) แต่ initMagnetic()/initProgress() ที่ตามมาใน start() ยังทำงานต่อครบปกติ", async () => {
    const dom = makeDom(`<h1>Hero</h1><button class="btn-primary">Buy</button>`, { withIO: false });
    await waitReady(dom);
    assert.equal(dom.window.IntersectionObserver, undefined);
    assert.doesNotThrow(() => runScript(dom));
    // initFlicker() เจอ !('IntersectionObserver' in window) → return ก่อนติด class เลย
    // (ต่างจากพฤติกรรมเดิมก่อนแก้ที่ติด fx-flicker ไปแล้วค่อย throw ทำให้ค้าง opacity:0 ถาวร)
    assert.equal(dom.window.document.querySelector("h1").className, "");
    // initMagnetic() (ลำดับถัดไปใน start()) ทำงานต่อปกติ ไม่ถูกตัดตอนอีกแล้ว
    assert.ok(dom.window.document.querySelector(".btn-primary").classList.contains("fx-magnetic"));
    // initProgress() (ลำดับถัดไปอีก) ก็ทำงานปกติเช่นกัน — #fx-progress ถูกสร้างขึ้นจริง
    assert.ok(dom.window.document.getElementById("fx-progress"));
  });

  test("✅ ไม่มี IntersectionObserver + มี .qp-pillar-num (target ของ initTick()) — ข้าม initTick() เงียบๆ เหมือนกัน ไม่ throw, ไม่ติด fx-tick ค้าง opacity:0", async () => {
    const dom = makeDom(`<span class="qp-pillar-num">01</span>`, { withIO: false });
    await waitReady(dom);
    assert.doesNotThrow(() => runScript(dom));
    assert.equal(dom.window.document.querySelector(".qp-pillar-num").className, "qp-pillar-num");
    // ยืนยันว่า start() รันจนจบจริง (initProgress() มาหลัง initTick() ในลำดับของ start())
    assert.ok(dom.window.document.getElementById("fx-progress"));
  });

  describe("initFlicker() — heading flicker-on ผ่าน IntersectionObserver", () => {
    test("h1/.hero-title/h2.section-head/[data-fx-flicker] ทุก selector ได้ class fx-flicker + ผูก IO", async () => {
      const dom = makeDom(`
        <h1>Title</h1>
        <div class="hero-title">Hero</div>
        <h2 class="section-head">Section</h2>
        <p data-fx-flicker>Custom</p>
        <p>Untouched</p>
      `);
      await waitReady(dom);
      runScript(dom);
      const doc = dom.window.document;
      assert.ok(doc.querySelector("h1").classList.contains("fx-flicker"));
      assert.ok(doc.querySelector(".hero-title").classList.contains("fx-flicker"));
      assert.ok(doc.querySelector("h2.section-head").classList.contains("fx-flicker"));
      assert.ok(doc.querySelector("[data-fx-flicker]").classList.contains("fx-flicker"));
      assert.equal(doc.querySelector("p:not([data-fx-flicker])").className, "");
    });

    test("entry.isIntersecting true → เพิ่ม fx-flicker--active + unobserve ตัวเอง (แสดงครั้งเดียว)", async () => {
      const dom = makeDom(`<h1>Title</h1>`);
      await waitReady(dom);
      runScript(dom);
      const h1 = dom.window.document.querySelector("h1");
      const io = IOStub.instances[0];
      assert.equal(io.observed.length, 1);
      io.cb([{ isIntersecting: true, target: h1 }]);
      assert.ok(h1.classList.contains("fx-flicker--active"));
      assert.equal(io.observed.includes(h1), false);
    });

    test("entry.isIntersecting false → ไม่เพิ่ม fx-flicker--active, ยังถูก observe ต่อ", async () => {
      const dom = makeDom(`<h1>Title</h1>`);
      await waitReady(dom);
      runScript(dom);
      const h1 = dom.window.document.querySelector("h1");
      const io = IOStub.instances[0];
      io.cb([{ isIntersecting: false, target: h1 }]);
      assert.equal(h1.classList.contains("fx-flicker--active"), false);
      assert.equal(io.observed.includes(h1), true);
    });

    test("prefers-reduced-motion: reduce → ไม่เพิ่ม class เลย ไม่ผูก IO (element คงสภาพเดิม)", async () => {
      const dom = makeDom(`<h1>Title</h1>`, { matchMedia: reducedMotionMatchMedia });
      await waitReady(dom);
      runScript(dom);
      assert.equal(dom.window.document.querySelector("h1").className, "");
      assert.equal(IOStub.instances.length, 0);
    });

    test("ไม่มี target เลยในหน้า — ไม่ throw, ไม่สร้าง IO instance สำหรับ flicker", async () => {
      const dom = makeDom(`<p>no headings</p>`);
      await waitReady(dom);
      assert.doesNotThrow(() => runScript(dom));
      assert.equal(IOStub.instances.length, 0);
    });
  });

  describe("initMagnetic() — ปุ่มได้ class fx-magnetic", () => {
    test("btn-primary/btn-secondary/btn-white ทุกตัวได้ class, ปุ่มอื่นไม่ได้", async () => {
      const dom = makeDom(`
        <button class="btn-primary">A</button>
        <a class="btn-secondary">B</a>
        <button class="btn-white">C</button>
        <button class="btn-other">D</button>
      `);
      await waitReady(dom);
      runScript(dom);
      const doc = dom.window.document;
      assert.ok(doc.querySelector(".btn-primary").classList.contains("fx-magnetic"));
      assert.ok(doc.querySelector(".btn-secondary").classList.contains("fx-magnetic"));
      assert.ok(doc.querySelector(".btn-white").classList.contains("fx-magnetic"));
      assert.equal(doc.querySelector(".btn-other").classList.contains("fx-magnetic"), false);
    });
  });

  describe("initProgress() — hazard-stripe scroll progress bar", () => {
    test("สร้าง #fx-progress ต่อท้าย body เสมอ + คำนวณ % เริ่มต้นจาก scrollTop/scrollable ทันที (เรียก update() ตอน init)", async () => {
      const dom = makeDom(`<div>x</div>`);
      await waitReady(dom);
      const doc = dom.window.document;
      Object.defineProperty(doc.documentElement, "scrollHeight", { value: 2000, configurable: true });
      Object.defineProperty(doc.documentElement, "clientHeight", { value: 1000, configurable: true });
      Object.defineProperty(doc.documentElement, "scrollTop", { value: 500, configurable: true, writable: true });
      runScript(dom);
      const bar = doc.getElementById("fx-progress");
      assert.ok(bar);
      assert.equal(bar.style.width, "50%");
    });

    test("scroll event → อัปเดต % ใหม่ผ่าน requestAnimationFrame (mock แบบ synchronous)", async () => {
      const dom = makeDom(`<div>x</div>`);
      await waitReady(dom);
      const doc = dom.window.document;
      Object.defineProperty(doc.documentElement, "scrollHeight", { value: 2000, configurable: true });
      Object.defineProperty(doc.documentElement, "clientHeight", { value: 1000, configurable: true });
      Object.defineProperty(doc.documentElement, "scrollTop", { value: 0, configurable: true, writable: true });
      runScript(dom);
      const bar = doc.getElementById("fx-progress");
      assert.equal(bar.style.width, "0%");
      doc.documentElement.scrollTop = 1000;
      doc.dispatchEvent(new dom.window.Event("scroll"));
      assert.equal(bar.style.width, "100%");
    });

    test("resize event ก็ทริกเกอร์ update() เหมือนกัน (ผูกกับ window resize)", async () => {
      const dom = makeDom(`<div>x</div>`);
      await waitReady(dom);
      const doc = dom.window.document;
      Object.defineProperty(doc.documentElement, "scrollHeight", { value: 800, configurable: true });
      Object.defineProperty(doc.documentElement, "clientHeight", { value: 400, configurable: true });
      Object.defineProperty(doc.documentElement, "scrollTop", { value: 400, configurable: true, writable: true });
      runScript(dom);
      const bar = doc.getElementById("fx-progress");
      assert.equal(bar.style.width, "100%");
      doc.documentElement.scrollTop = 0;
      dom.window.dispatchEvent(new dom.window.Event("resize"));
      assert.equal(bar.style.width, "0%");
    });

    test("หน้าไม่ scrollable เลย (scrollHeight === clientHeight) — pct 0% ไม่ throw division by zero", async () => {
      const dom = makeDom(`<div>x</div>`);
      await waitReady(dom);
      const doc = dom.window.document;
      Object.defineProperty(doc.documentElement, "scrollHeight", { value: 500, configurable: true });
      Object.defineProperty(doc.documentElement, "clientHeight", { value: 500, configurable: true });
      Object.defineProperty(doc.documentElement, "scrollTop", { value: 0, configurable: true, writable: true });
      assert.doesNotThrow(() => runScript(dom));
      assert.equal(doc.getElementById("fx-progress").style.width, "0%");
    });
  });

  describe("initRivets() — card corner rivets (มุมสี่เหลี่ยมแบบสกรูยึด)", () => {
    test("เพิ่ม 2 rivet (tl/tr) ต่อ card ที่ position:static → เปลี่ยนเป็น relative + ตั้ง dataset.fxCard กันรันซ้ำ", async () => {
      const dom = makeDom(`<div class="cert-card"></div>`);
      await waitReady(dom);
      runScript(dom);
      const card = dom.window.document.querySelector(".cert-card");
      assert.equal(card.querySelectorAll(".fx-rivet").length, 2);
      assert.ok(card.querySelector(".fx-rivet--tl"));
      assert.ok(card.querySelector(".fx-rivet--tr"));
      assert.equal(card.style.position, "relative");
      assert.equal(card.dataset.fxCard, "1");
    });

    test("card ที่ position ไม่ใช่ static (เช่น absolute) — ไม่ถูกบังคับเปลี่ยน position แต่ยังได้ rivet", async () => {
      const dom = makeDom(`<div class="cert-card" style="position:absolute"></div>`);
      await waitReady(dom);
      runScript(dom);
      const card = dom.window.document.querySelector(".cert-card");
      assert.equal(card.style.position, "absolute");
      assert.equal(card.querySelectorAll(".fx-rivet").length, 2);
    });

    test("card ที่มี dataset.fxCard ติดมาก่อนแล้ว (เคยรันแล้ว) — guard ข้าม ไม่เพิ่ม rivet ซ้ำ", async () => {
      const dom = makeDom(`<div class="cert-card" data-fx-card="1"></div>`);
      await waitReady(dom);
      runScript(dom);
      assert.equal(dom.window.document.querySelector(".cert-card").querySelectorAll(".fx-rivet").length, 0);
    });

    test("ครอบคลุมทุก selector ที่ระบุไว้ (popup panel รวมถึง product/portfolio/blog card)", async () => {
      const dom = makeDom(`
        <div class="benefit-card"></div>
        <div class="trust-feature-card"></div>
        <div class="qp-doc-card"></div>
        <div class="qp-policy-card"></div>
        <div class="ab-value-card"></div>
        <div class="pdp-related-card"></div>
        <div class="nf-link-card"></div>
        <div class="product-card"></div>
        <div class="port-card"></div>
        <div class="blog-card"></div>
        <div class="qmodal"></div>
        <div class="tm-modal"></div>
        <div class="pf-detail-box"></div>
        <div class="ss-panel"></div>
        <div class="chat-popup"></div>
        <div class="cookie-banner"></div>
      `);
      await waitReady(dom);
      runScript(dom);
      const doc = dom.window.document;
      const selectors = [
        ".benefit-card", ".trust-feature-card", ".qp-doc-card", ".qp-policy-card",
        ".ab-value-card", ".pdp-related-card", ".nf-link-card", ".product-card",
        ".port-card", ".blog-card", ".qmodal", ".tm-modal", ".pf-detail-box",
        ".ss-panel", ".chat-popup", ".cookie-banner",
      ];
      for (const sel of selectors) {
        assert.equal(doc.querySelector(sel).querySelectorAll(".fx-rivet").length, 2, `${sel} ควรได้ rivet 2 อัน`);
      }
    });

    test("MutationObserver: card ที่เพิ่มเข้ามาใน DOM ทีหลัง (จำลอง Firestore async render) ได้ rivet อัตโนมัติ", async () => {
      const dom = makeDom(`<main></main>`);
      await waitReady(dom);
      runScript(dom);
      const main = dom.window.document.querySelector("main");
      const card = dom.window.document.createElement("div");
      card.className = "cert-card";
      main.appendChild(card);
      // MutationObserver callback คิวเป็น microtask — รอสักครู่ให้ callback ทำงาน
      await new Promise((r) => setTimeout(r, 20));
      assert.equal(card.querySelectorAll(".fx-rivet").length, 2);
    });
  });

  describe("initTick() — numbered step badge tick-in ผ่าน IntersectionObserver", () => {
    test("qp-pillar-num/ab-consult-num ได้ class fx-tick + ผูก IO แยกจากตัว flicker", async () => {
      const dom = makeDom(`<span class="qp-pillar-num">1</span><span class="ab-consult-num">2</span>`);
      await waitReady(dom);
      runScript(dom);
      const doc = dom.window.document;
      assert.ok(doc.querySelector(".qp-pillar-num").classList.contains("fx-tick"));
      assert.ok(doc.querySelector(".ab-consult-num").classList.contains("fx-tick"));
      assert.equal(IOStub.instances.length, 1); // ไม่มี h1/flicker target ในหน้านี้ เหลือแค่ IO ของ tick
    });

    test("entry.isIntersecting true → เพิ่ม fx-tick--active + unobserve ตัวเอง", async () => {
      const dom = makeDom(`<span class="qp-pillar-num">1</span>`);
      await waitReady(dom);
      runScript(dom);
      const el = dom.window.document.querySelector(".qp-pillar-num");
      const io = IOStub.instances[0];
      io.cb([{ isIntersecting: true, target: el }]);
      assert.ok(el.classList.contains("fx-tick--active"));
      assert.equal(io.observed.includes(el), false);
    });

    test("prefers-reduced-motion: reduce → ไม่เพิ่ม fx-tick เลย ไม่ผูก IO", async () => {
      const dom = makeDom(`<span class="qp-pillar-num">1</span>`, { matchMedia: reducedMotionMatchMedia });
      await waitReady(dom);
      runScript(dom);
      assert.equal(dom.window.document.querySelector(".qp-pillar-num").classList.contains("fx-tick"), false);
      assert.equal(IOStub.instances.length, 0);
    });

    test("ไม่มี target เลย — ไม่ throw, ไม่สร้าง IO", async () => {
      const dom = makeDom(`<p>no badges</p>`);
      await waitReady(dom);
      assert.doesNotThrow(() => runScript(dom));
      assert.equal(IOStub.instances.length, 0);
    });
  });

  describe("initLaneDividers() — road-lane section divider ก่อนทุก <section> ยกเว้นตัวแรก", () => {
    test("มี 3 sections ใน <main> — แทรก .fx-lane ก่อน section ที่ 2 กับ 3 เท่านั้น (ข้าม hero)", async () => {
      const dom = makeDom(`<main><section>a</section><section>b</section><section>c</section></main>`);
      await waitReady(dom);
      runScript(dom);
      const doc = dom.window.document;
      assert.equal(doc.querySelectorAll(".fx-lane").length, 2);
      const children = Array.from(doc.querySelector("main").children);
      assert.equal(children[0].tagName, "SECTION"); // section แรกไม่มี divider นำหน้า
      assert.equal(children[1].className, "fx-lane");
      assert.equal(children[3].className, "fx-lane");
      // โครงสร้างภายใน divider ครบ 3 ส่วน (track-stud-track)
      const lane = doc.querySelector(".fx-lane");
      assert.equal(lane.getAttribute("aria-hidden"), "true");
      assert.equal(lane.children.length, 3);
      assert.ok(lane.children[0].classList.contains("fx-lane-track"));
      assert.ok(lane.children[1].classList.contains("fx-lane-stud"));
      assert.ok(lane.children[2].classList.contains("fx-lane-track"));
    });

    test("มี section เดียว — ไม่แทรก divider เลย (guard length < 2)", async () => {
      const dom = makeDom(`<main><section>only</section></main>`);
      await waitReady(dom);
      runScript(dom);
      assert.equal(dom.window.document.querySelectorAll(".fx-lane").length, 0);
    });

    test("ไม่มี section เลย — ไม่ throw", async () => {
      const dom = makeDom(`<div>no sections</div>`);
      await waitReady(dom);
      assert.doesNotThrow(() => runScript(dom));
    });

    test("มี .fx-lane อยู่ก่อนหน้า section แล้ว (idempotent) — ไม่แทรกซ้ำ", async () => {
      const dom = makeDom(`<main><section>a</section><div class="fx-lane"></div><section>b</section></main>`);
      await waitReady(dom);
      runScript(dom);
      assert.equal(dom.window.document.querySelectorAll(".fx-lane").length, 1);
    });

    test("body > section (ไม่มี <main> ครอบ) ก็ทำงานเหมือนกัน", async () => {
      const dom = makeDom(`<section>a</section><section>b</section>`);
      await waitReady(dom);
      runScript(dom);
      assert.equal(dom.window.document.querySelectorAll(".fx-lane").length, 1);
    });
  });

  describe("initBreadcrumbChevrons() — แทนที่ text node \"/\" ด้วย chevron", () => {
    test("แทนที่เฉพาะ text node ที่ trim แล้วเป็น \"/\" เป๊ะ ทั้ง .article-breadcrumb และ .pdp-breadcrumb", async () => {
      const dom = makeDom(`
        <div class="article-breadcrumb"><a href="/">Home</a> / <span>Article</span></div>
        <div class="pdp-breadcrumb"><a href="/">Home</a> / <span>Product</span></div>
      `);
      await waitReady(dom);
      runScript(dom);
      const doc = dom.window.document;
      for (const sel of [".article-breadcrumb", ".pdp-breadcrumb"]) {
        const chevron = doc.querySelector(`${sel} .fx-crumb-sep`);
        assert.ok(chevron, `${sel} ควรมี chevron`);
        assert.equal(chevron.getAttribute("aria-hidden"), "true");
        assert.equal(chevron.textContent, "\u203A");
      }
    });

    test("text node ที่มี \"/\" เป็นแค่ส่วนหนึ่ง (ไม่ใช่ trim แล้วเท่ากับ \"/\" เป๊ะ) — ไม่ถูกแทนที่ (กันชื่อสินค้า/บทความที่มี / อยู่ในนั้น)", async () => {
      const dom = makeDom(`<div class="pdp-breadcrumb">A / B / C</div>`);
      await waitReady(dom);
      runScript(dom);
      const el = dom.window.document.querySelector(".pdp-breadcrumb");
      assert.equal(el.querySelectorAll(".fx-crumb-sep").length, 0);
      assert.equal(el.textContent, "A / B / C");
    });

    test("ไม่มี .article-breadcrumb/.pdp-breadcrumb เลยในหน้า — ไม่ throw", async () => {
      const dom = makeDom(`<div>no breadcrumb</div>`);
      await waitReady(dom);
      assert.doesNotThrow(() => runScript(dom));
    });

    test("idempotent: เรียกซ้ำผ่าน MutationObserver หลัง breadcrumb ถูกแทนที่แล้วไม่พังซ้ำ (ไม่มี text node \"/\" เหลือให้แทนอีก)", async () => {
      const dom = makeDom(`<main><div class="pdp-breadcrumb"><a href="/">Home</a> / <span>Product</span></div></main>`);
      await waitReady(dom);
      runScript(dom);
      const doc = dom.window.document;
      assert.equal(doc.querySelectorAll(".fx-crumb-sep").length, 1);
      // trigger MutationObserver ด้วยการเพิ่ม element อื่นเข้า DOM (ไม่เกี่ยวกับ breadcrumb)
      const filler = doc.createElement("div");
      doc.querySelector("main").appendChild(filler);
      await new Promise((r) => setTimeout(r, 20));
      // ยังมี chevron แค่ 1 อัน ไม่ถูกแทนที่ซ้ำหรือพังจากการรัน initBreadcrumbChevrons() ซ้ำ
      assert.equal(doc.querySelectorAll(".fx-crumb-sep").length, 1);
    });
  });

  describe("start() — DOMContentLoaded guard ตาม document.readyState", () => {
    test("readyState เป็น \"loading\" ตอน inject script — ผูก DOMContentLoaded listener แล้วรันตอน event ยิงจริง", async () => {
      const dom = makeDom(`<h1>Title</h1>`);
      // inject ทันทีตอนสร้าง (ปกติ readyState ยังเป็น "loading" อยู่ ก่อน await ใดๆ)
      assert.equal(dom.window.document.readyState, "loading");
      runScript(dom);
      // ยังไม่ทำงานทันที เพราะรอ DOMContentLoaded
      assert.equal(dom.window.document.querySelector("h1").className, "");
      await waitReady(dom);
      // รอ event loop อีกนิดให้ listener ที่ผูกไว้ทำงานจบ
      await new Promise((r) => setTimeout(r, 20));
      assert.equal(dom.window.document.querySelector("h1").className, "fx-flicker");
    });

    test("readyState เป็น \"complete\" อยู่แล้วตอน inject — รัน start() ทันที (sync)", async () => {
      const dom = makeDom(`<h1>Title</h1>`);
      await waitReady(dom);
      runScript(dom);
      assert.equal(dom.window.document.querySelector("h1").className, "fx-flicker");
    });
  });
});
