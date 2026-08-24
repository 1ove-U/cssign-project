// test/main-effects.test.mjs — รอบที่ 157
//
// js/main-effects.js (299 บรรทัด, "ส่วนที่ 2/2" ของ main.js เดิม) เป็น 3 IIFE แยกอิสระ ไม่มี
// export ไม่มี DOMContentLoaded wrapper — รันทันทีตอน script eval (ต้องโหลดหลัง js/main.js เสมอ
// เพราะใช้ window.CSSIGN_observeReveal):
//   1) initFooterExtras() (ซ้อนในอีก IIFE ชั้นนอก) — spotlight cursor-follow ที่ footer /
//      stagger reveal ของ .footer-grid / copy-to-clipboard ปุ่มติดต่อ / badge เปิด-ปิดทำการ /
//      confetti burst เมื่อกด social icon
//   2) PREMIUM FLOURISHES — cursor-spotlight (--sx/--sy) บนการ์ดทั่วเว็บ + 3D tilt (--rx/--ry)
//      เฉพาะ .ab-value-card, เดสก์ท็อป+pointer ละเอียดเท่านั้น
//   3) GENERAL POLISH — ripple บนทุก .btn / magnetic pull บน .btn-lg / เปลี่ยน tab title ตอนสลับแท็บ
//
// วิธีทดสอบ: โหลดเป็น classic <script> จริงเข้า JSDOM (runScripts: "dangerously") ตามแพทเทิร์น
// เดียวกับ test/fancy-effects.test.mjs/test/hero-parallax.test.mjs/test/exit-intent-cta.test.mjs
//
// อ่านโค้ดจริงทั้งไฟล์ js/main-effects.js ก่อนเขียนไฟล์นี้ทั้งหมด — ต่างจาก fancy-effects.js
// (รอบ 156) ไฟล์นี้ guard `window.matchMedia &&` ไว้ครบทุกจุดที่เรียก matchMedia (ตามแพทเทิร์น
// เดียวกับ main.js) จึงไม่พบบั๊ก throw กลางฟังก์ชันแบบรอบก่อน — แต่พบพฤติกรรมย่อยที่ควรบันทึกไว้
// เป็นเทส (ไม่ใช่บั๊กร้ายแรง แต่เป็น edge case ที่ควรมีหลักฐานยืนยัน ไม่แก้โค้ดผลิตภัณฑ์เอง):
//
// 🐛 (1) ripple ripple x/y centering: `(typeof e.clientX === 'number' && e.clientX) ? e.clientX - r.left : r.width/2`
//     — ถ้า e.clientX === 0 เป๊ะ (คลิกที่ขอบซ้ายสุดของ viewport พอดี พิกเซล 0) นิพจน์นี้ได้ `0`
//     ซึ่งเป็น falsy ทำให้ตกไป branch fallback (`r.width/2`, กึ่งกลางปุ่ม) แทนที่จะใช้ตำแหน่งจริง 0 —
//     สาเหตุคือใช้ `&&` เช็ค truthy ของค่าตัวเลขเอง ไม่ใช่เช็ค `!== undefined`/`isNaN` ผลกระทบจริงต่ำ
//     มาก (ต้องคลิกตรง pixel 0 เป๊ะ) แต่เป็นรูปแบบเดียวกับที่อาจเจอได้ในไฟล์อื่นของโปรเจกต์ —
//     บันทึกด้วยเทสเฉพาะจุด ไม่แก้โค้ด
// (2) confetti: `prefersReducedMotion = window.matchMedia && window.matchMedia(...).matches` — ถ้า
//     `window.matchMedia` undefined (ค่า default ของ jsdom โดยไม่ stub) นิพจน์ทั้งก้อนได้
//     `undefined` (falsy) ทำให้ `!prefersReducedMotion` เป็น `true` เสมอ → confetti "เปิดใช้งาน
//     โดยปริยาย" เมื่อไม่มี matchMedia เลย (ตรงข้ามกับ PREMIUM FLOURISHES/magnetic pull ที่ guard
//     ด้วย `window.matchMedia &&` ไว้ก่อน จึง "ปิดใช้งานโดยปริยาย" เมื่อไม่มี matchMedia) —
//     ไม่ใช่บั๊ก (ทำงานถูกต้องตามลำดับ operator จริง) แต่เป็นความไม่สมมาตรของ default behavior ที่
//     ควรมีเทสยืนยันไว้ชัดเจน
//
// ไม่แก้โค้ดผลิตภัณฑ์เลยแม้แต่บรรทัดเดียวในไฟล์นี้ — งานทดสอบล้วนๆ

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const SOURCE = readFileSync(new URL("../js/main-effects.js", import.meta.url), "utf-8");

function footerMarkup() {
  return `
    <div class="site-footer">
      <div class="footer-grid">
        <div class="fg-col">Col A</div>
        <div class="fg-col">Col B</div>
        <div class="fg-col">Col C</div>
      </div>
      <div class="footer-contact-label">โทรศัพท์</div>
      <span class="footer-contact-val">02-123-4567</span>
      <div class="footer-contact-label">อีเมล</div>
      <span class="footer-contact-val">hello@cssign.co</span>
      <div class="footer-social">
        <a href="https://facebook.com/x" aria-label="facebook">FB</a>
      </div>
    </div>
  `;
}

function polishMarkup() {
  return `
    <button class="btn btn-primary">Buy now</button>
    <button class="btn-lg">Big CTA</button>
    <div class="ab-value-card">Value card</div>
    <div class="service-item">Service</div>
  `;
}

// matchMedia stub ที่คุมได้ทีละแกน — query string จริงในไฟล์มี 3 แบบ: '(hover:hover)',
// '(hover:hover) and (pointer:fine)', '(prefers-reduced-motion: reduce)' — เช็ค substring
// 'pointer:fine' ก่อน 'hover:hover' เพราะ query ผสมมีทั้งสองคำ
function makeMatchMedia({ hoverHover = false, hoverFine = false, reducedMotion = false } = {}) {
  return function (query) {
    if (query.indexOf("prefers-reduced-motion") !== -1) return { matches: reducedMotion };
    if (query.indexOf("pointer:fine") !== -1) return { matches: hoverFine };
    if (query.indexOf("hover:hover") !== -1) return { matches: hoverHover };
    return { matches: false };
  };
}

function makeDom(markup, { matchMedia, title = "หน้าเดิม — CS.SIGN" } = {}) {
  const dom = new JSDOM(
    `<!doctype html><html><head><title>${title}</title></head><body>${markup}</body></html>`,
    {
      url: "https://example.test/",
      runScripts: "dangerously",
      pretendToBeVisual: true,
    }
  );
  if (matchMedia) dom.window.matchMedia = matchMedia;
  dom.window.requestAnimationFrame = (cb) => {
    cb();
    return 1;
  };
  return dom;
}

// spy บน setTimeout — คืน { calls } ให้เทสเรียก callback เองแทนรอ real timer (unqualified
// setTimeout ในไฟล์นี้ resolve เป็น window.setTimeout เมื่อรันเป็น classic script ใน jsdom)
function stubTimers(dom) {
  const calls = [];
  let idCounter = 0;
  dom.window.setTimeout = function (cb, ms) {
    idCounter += 1;
    calls.push({ id: idCounter, cb, ms });
    return idCounter;
  };
  return calls;
}

function setRect(el, rect) {
  el.getBoundingClientRect = () => ({
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: 0,
    height: 0,
    x: 0,
    y: 0,
    ...rect,
  });
}

function runScript(dom) {
  const script = dom.window.document.createElement("script");
  script.textContent = SOURCE;
  dom.window.document.body.appendChild(script);
}

describe("js/main-effects.js — footer extras / premium flourishes / general polish", () => {
  // ===========================================================
  // IIFE 1 — initFooterExtras() (ซ้อนอยู่ในอีก IIFE ชั้นนอก อีกชั้น)
  // ===========================================================
  describe("initFooterExtras() — guard เริ่มต้น", () => {
    test("ไม่มี .site-footer ในหน้า → ไม่ throw และไม่มี element ใดถูกสร้างจากส่วนนี้เลย", () => {
      const dom = makeDom("<div>no footer here</div>");
      assert.doesNotThrow(() => runScript(dom));
      assert.equal(dom.window.document.querySelector(".footer-spotlight"), null);
      assert.equal(dom.window.document.querySelector(".footer-toast-host"), null);
      assert.equal(dom.window.document.querySelector(".footer-hours-badge"), null);
    });
  });

  describe("1. cursor-follow spotlight บน footer", () => {
    test("matchMedia('(hover:hover)').matches=true → สร้าง .footer-spotlight เป็น firstChild ของ footer พร้อม aria-hidden", () => {
      const dom = makeDom(footerMarkup(), { matchMedia: makeMatchMedia({ hoverHover: true }) });
      runScript(dom);
      const footer = dom.window.document.querySelector(".site-footer");
      const spot = footer.firstElementChild;
      assert.ok(spot.classList.contains("footer-spotlight"));
      assert.equal(spot.getAttribute("aria-hidden"), "true");
    });

    test("mousemove บน footer อัปเดต --fx/--fy เป็น % จากตำแหน่งเมาส์เทียบ rect ของ footer (ผ่าน rAF)", () => {
      const dom = makeDom(footerMarkup(), { matchMedia: makeMatchMedia({ hoverHover: true }) });
      runScript(dom);
      const footer = dom.window.document.querySelector(".site-footer");
      setRect(footer, { left: 0, top: 0, width: 200, height: 100 });
      const evt = new dom.window.MouseEvent("mousemove", {
        bubbles: true,
        clientX: 50,
        clientY: 25,
      });
      footer.dispatchEvent(evt);
      const spot = footer.querySelector(".footer-spotlight");
      assert.equal(spot.style.getPropertyValue("--fx"), "25%");
      assert.equal(spot.style.getPropertyValue("--fy"), "25%");
    });

    test("matchMedia('(hover:hover)').matches=false (touch device) → ไม่สร้าง .footer-spotlight", () => {
      const dom = makeDom(footerMarkup(), { matchMedia: makeMatchMedia({ hoverHover: false }) });
      runScript(dom);
      assert.equal(dom.window.document.querySelector(".footer-spotlight"), null);
    });

    test("ไม่ stub window.matchMedia เลย (ค่า default undefined ของ jsdom) → ไม่ throw, ไม่สร้าง spotlight", () => {
      const dom = makeDom(footerMarkup());
      assert.equal(dom.window.matchMedia, undefined);
      assert.doesNotThrow(() => runScript(dom));
      assert.equal(dom.window.document.querySelector(".footer-spotlight"), null);
    });
  });

  describe("3. stagger reveal ของ .footer-grid columns", () => {
    test("แต่ละ child ได้ attribute data-reveal + custom prop --fd = i*90ms ตามลำดับ", () => {
      const dom = makeDom(footerMarkup());
      runScript(dom);
      const cols = dom.window.document.querySelectorAll(".footer-grid > .fg-col");
      assert.equal(cols.length, 3);
      cols.forEach((col, i) => {
        assert.equal(col.getAttribute("data-reveal"), "");
        assert.equal(col.style.getPropertyValue("--fd"), i * 90 + "ms");
      });
    });

    test("เรียก window.CSSIGN_observeReveal(gridEl) ครั้งเดียวเมื่อมีฟังก์ชันนี้ตั้งไว้ (จาก main.js)", () => {
      const dom = makeDom(footerMarkup());
      const calls = [];
      dom.window.CSSIGN_observeReveal = (el) => calls.push(el);
      runScript(dom);
      const gridEl = dom.window.document.querySelector(".footer-grid");
      assert.equal(calls.length, 1);
      assert.equal(calls[0], gridEl);
    });

    test("window.CSSIGN_observeReveal ไม่ถูกตั้งไว้เลย (undefined) → ไม่ throw, columns ยังได้ data-reveal/--fd ตามปกติ", () => {
      const dom = makeDom(footerMarkup());
      assert.equal(dom.window.CSSIGN_observeReveal, undefined);
      assert.doesNotThrow(() => runScript(dom));
      const col = dom.window.document.querySelector(".footer-grid > .fg-col");
      assert.equal(col.getAttribute("data-reveal"), "");
    });

    test("ไม่มี .footer-grid ในหน้า → ส่วนนี้ข้ามเงียบๆ ไม่ throw", () => {
      const dom = makeDom(`<div class="site-footer"><span class="footer-contact-val">02-000-0000</span></div>`);
      assert.doesNotThrow(() => runScript(dom));
    });
  });

  describe("4. copy-to-clipboard ปุ่มติดต่อ", () => {
    test("แต่ละ .footer-contact-val ที่มีข้อความ ถูกห่อเป็น .footer-contact-row + เพิ่ม .footer-copy-btn", () => {
      const dom = makeDom(footerMarkup());
      runScript(dom);
      const rows = dom.window.document.querySelectorAll(".footer-contact-row");
      assert.equal(rows.length, 2, "มี 2 ค่า (โทรศัพท์+อีเมล) ต้องได้ 2 row");
      rows.forEach((row) => {
        assert.ok(row.querySelector(".footer-contact-val"));
        const btn = row.querySelector(".footer-copy-btn");
        assert.ok(btn);
        assert.equal(btn.type, "button");
        assert.equal(btn.getAttribute("aria-label"), "คัดลอกข้อมูลนี้");
      });
    });

    test("ข้อความว่าง (trim แล้วเป็นค่าว่าง) → ข้าม ไม่สร้าง row/ปุ่ม", () => {
      const dom = makeDom(`<div class="site-footer"><span class="footer-contact-val">   </span></div>`);
      runScript(dom);
      assert.equal(dom.window.document.querySelector(".footer-contact-row"), null);
      assert.equal(dom.window.document.querySelector(".footer-copy-btn"), null);
    });

    test("ค่าที่อยู่ใน .footer-contact-row อยู่แล้ว (markup ห่อไว้ล่วงหน้า) → guard idempotent ข้ามไป ไม่ห่อซ้ำ/ไม่เพิ่มปุ่มซ้ำ", () => {
      const dom = makeDom(`
        <div class="site-footer">
          <div class="footer-contact-row">
            <span class="footer-contact-val">already-wrapped@cssign.co</span>
            <button class="footer-copy-btn"></button>
          </div>
        </div>
      `);
      runScript(dom);
      const rows = dom.window.document.querySelectorAll(".footer-contact-row");
      const btns = dom.window.document.querySelectorAll(".footer-copy-btn");
      assert.equal(rows.length, 1);
      assert.equal(btns.length, 1);
    });

    test("คลิกปุ่ม → navigator.clipboard.writeText สำเร็จ → toast 'คัดลอกแล้ว!' ปรากฏ + ปุ่มได้ class is-copied", async () => {
      const dom = makeDom(footerMarkup());
      dom.window.navigator.clipboard = { writeText: () => Promise.resolve() };
      const calls = stubTimers(dom);
      runScript(dom);
      const btn = dom.window.document.querySelector(".footer-copy-btn");
      btn.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, cancelable: true }));
      // clipboard.writeText().then(...) เป็น microtask — ต้อง await ก่อนตรวจผล
      await Promise.resolve();
      await Promise.resolve();
      const toast = dom.window.document.querySelector(".footer-toast");
      assert.ok(toast, "ต้องมี .footer-toast ถูกสร้าง");
      assert.equal(toast.querySelector("span").textContent, "คัดลอกแล้ว!");
      assert.ok(btn.classList.contains("is-copied"));
      // toast host ต้องมีแค่ 1 อัน แม้เรียก showFooterToast ซ้ำ
      assert.equal(dom.window.document.querySelectorAll(".footer-toast-host").length, 1);
      // เทียบว่ามี timer ถูกตั้งไว้สำหรับซ่อน toast (2000ms) และลบปุ่ม is-copied (1500ms)
      assert.ok(calls.some((c) => c.ms === 2000));
      assert.ok(calls.some((c) => c.ms === 1500));
    });

    test("ไม่มี navigator.clipboard (ค่า default jsdom) → fallback ใช้ document.execCommand('copy') สำเร็จเหมือนกัน", async () => {
      const dom = makeDom(footerMarkup());
      assert.equal(dom.window.navigator.clipboard, undefined);
      dom.window.document.execCommand = () => true;
      stubTimers(dom);
      runScript(dom);
      const btn = dom.window.document.querySelector(".footer-copy-btn");
      btn.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, cancelable: true }));
      assert.ok(dom.window.document.querySelector(".footer-toast"));
      assert.ok(btn.classList.contains("is-copied"));
    });

    test("ไม่มีทั้ง navigator.clipboard และ document.execCommand (ค่า default jsdom เปล่าๆ) → fallback จับ error เงียบๆ ok=false ไม่มี toast/is-copied", () => {
      const dom = makeDom(footerMarkup());
      assert.equal(dom.window.navigator.clipboard, undefined);
      assert.equal(dom.window.document.execCommand, undefined);
      stubTimers(dom);
      runScript(dom);
      const btn = dom.window.document.querySelector(".footer-copy-btn");
      assert.doesNotThrow(() =>
        btn.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, cancelable: true }))
      );
      assert.equal(dom.window.document.querySelector(".footer-toast"), null);
      assert.equal(btn.classList.contains("is-copied"), false);
    });

    test("clipboard.writeText reject → ตกไป fallbackCopy อัตโนมัติ (ผ่าน .catch)", async () => {
      const dom = makeDom(footerMarkup());
      dom.window.navigator.clipboard = { writeText: () => Promise.reject(new Error("denied")) };
      dom.window.document.execCommand = () => true;
      stubTimers(dom);
      runScript(dom);
      const btn = dom.window.document.querySelector(".footer-copy-btn");
      btn.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, cancelable: true }));
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      assert.ok(dom.window.document.querySelector(".footer-toast"), "reject แล้วต้อง fallback สำเร็จ");
    });

    test("toast ถูกลบออกจาก DOM หลัง timer ครบ (2000ms ซ่อน → 250ms ถอด element)", async () => {
      const dom = makeDom(footerMarkup());
      dom.window.navigator.clipboard = { writeText: () => Promise.resolve() };
      const calls = stubTimers(dom);
      runScript(dom);
      const btn = dom.window.document.querySelector(".footer-copy-btn");
      btn.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, cancelable: true }));
      await Promise.resolve();
      await Promise.resolve();
      const toast = dom.window.document.querySelector(".footer-toast");
      assert.ok(toast.classList.contains("is-visible"));
      // เรียก timer ตัวแรก (2000ms, ซ่อน toast)
      calls.find((c) => c.ms === 2000).cb();
      assert.equal(toast.classList.contains("is-visible"), false);
      // เรียก timer ที่สอง (250ms, ถอด element ออกจริง — ถูกตั้งตอนเรียก callback ข้างบน)
      const removeTimer = calls.find((c) => c.ms === 250);
      assert.ok(removeTimer, "ต้องมี timer 250ms ถูกตั้งเพิ่มหลัง 2000ms callback ทำงาน");
      removeTimer.cb();
      assert.equal(toast.parentNode, null);
    });
  });

  describe("5. badge เปิด/ปิดทำการ (Mon–Sat 08:00–17:00 Asia/Bangkok)", () => {
    test("มี .footer-contact-label ที่ match /โทรศัพท์|hotline|phone/i → เพิ่ม .footer-hours-badge ตรงกับเวลาจริงขณะรันเทส", () => {
      const dom = makeDom(footerMarkup());
      runScript(dom);
      const label = Array.from(dom.window.document.querySelectorAll(".footer-contact-label")).find((l) =>
        /โทรศัพท์|hotline|phone/i.test(l.textContent)
      );
      const badge = label.querySelector(".footer-hours-badge");
      assert.ok(badge, "ต้องมี badge ถูกเพิ่มใน label ที่ match");
      assert.ok(badge.querySelector(".fhb-dot"));

      // คำนวณค่าที่คาดหวังด้วยตรรกะเดียวกับโค้ดจริง เทียบกับเวลาจริงตอนรันเทสนี้ (ไม่ mock Date)
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Bangkok",
        hour: "2-digit",
        hour12: false,
        weekday: "short",
      }).formatToParts(new Date());
      let hour = 0,
        weekday = "";
      parts.forEach((p) => {
        if (p.type === "hour") hour = parseInt(p.value, 10);
        if (p.type === "weekday") weekday = p.value;
      });
      const expectOpen = weekday !== "Sun" && hour >= 8 && hour < 17;
      assert.equal(badge.classList.contains("is-closed"), !expectOpen);
      assert.equal(badge.textContent.trim(), expectOpen ? "เปิดทำการอยู่" : "ปิดทำการแล้ว");
    });

    test("ไม่มี label ใด match regex เบอร์โทร → ไม่มี badge ถูกเพิ่มเลย", () => {
      const dom = makeDom(`
        <div class="site-footer">
          <div class="footer-contact-label">ที่อยู่บริษัท</div>
          <span class="footer-contact-val">123 ถนนสุขุมวิท</span>
        </div>
      `);
      runScript(dom);
      assert.equal(dom.window.document.querySelector(".footer-hours-badge"), null);
    });
  });

  describe("6. confetti burst เมื่อกด social icon", () => {
    test("คลิก .footer-social a → สร้าง 8 .footer-confetti-dot ต่อท้าย body ด้วยสี/มุม/ระยะกระจาย", () => {
      const dom = makeDom(footerMarkup(), { matchMedia: makeMatchMedia({ reducedMotion: false }) });
      stubTimers(dom);
      runScript(dom);
      const link = dom.window.document.querySelector(".footer-social a");
      setRect(link, { left: 100, top: 200, width: 20, height: 20 });
      link.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, cancelable: true }));
      const dots = dom.window.document.querySelectorAll(".footer-confetti-dot");
      assert.equal(dots.length, 8);
      dots.forEach((d) => {
        assert.equal(d.style.left, "110px"); // cx = 100+20/2
        assert.equal(d.style.top, "210px"); // cy = 200+20/2
        assert.ok(d.style.background);
        assert.ok(d.style.getPropertyValue("--cx"));
        assert.ok(d.style.getPropertyValue("--cy"));
      });
    });

    test("แต่ละ dot ถูกลบออกหลัง 750ms ผ่าน setTimeout ต่อ dot", () => {
      const dom = makeDom(footerMarkup());
      const calls = stubTimers(dom);
      runScript(dom);
      const link = dom.window.document.querySelector(".footer-social a");
      setRect(link, { left: 0, top: 0, width: 10, height: 10 });
      link.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, cancelable: true }));
      const dotTimers = calls.filter((c) => c.ms === 750);
      assert.equal(dotTimers.length, 8);
      dotTimers.forEach((t) => t.cb());
      assert.equal(dom.window.document.querySelectorAll(".footer-confetti-dot").length, 0);
    });

    test("matchMedia('(prefers-reduced-motion: reduce)').matches=true → ไม่ผูก listener, คลิกแล้วไม่มี confetti", () => {
      const dom = makeDom(footerMarkup(), { matchMedia: makeMatchMedia({ reducedMotion: true }) });
      runScript(dom);
      const link = dom.window.document.querySelector(".footer-social a");
      setRect(link, { left: 0, top: 0, width: 10, height: 10 });
      link.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, cancelable: true }));
      assert.equal(dom.window.document.querySelectorAll(".footer-confetti-dot").length, 0);
    });

    test("(บันทึกพฤติกรรม) ไม่ stub window.matchMedia เลย (undefined) → prefersReducedMotion กลายเป็น falsy โดยปริยาย ทำให้ confetti ยัง 'เปิดใช้งาน' ตามปกติ ต่างจาก PREMIUM FLOURISHES/magnetic ที่ปิดโดยปริยายในสถานการณ์เดียวกัน", () => {
      const dom = makeDom(footerMarkup());
      assert.equal(dom.window.matchMedia, undefined);
      runScript(dom);
      const link = dom.window.document.querySelector(".footer-social a");
      setRect(link, { left: 0, top: 0, width: 10, height: 10 });
      link.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, cancelable: true }));
      assert.equal(dom.window.document.querySelectorAll(".footer-confetti-dot").length, 8);
    });
  });

  // ===========================================================
  // IIFE 2 — PREMIUM FLOURISHES (cursor-spotlight + 3D tilt)
  // ===========================================================
  describe("PREMIUM FLOURISHES — cursor-spotlight cards + 3D tilt", () => {
    test("ไม่ stub matchMedia เลย (default undefined) → IIFE return ทันที ไม่ throw ไม่มี custom prop ใดถูกตั้ง", () => {
      const dom = makeDom(polishMarkup());
      assert.doesNotThrow(() => runScript(dom));
      const card = dom.window.document.querySelector(".service-item");
      setRect(card, { left: 0, top: 0, width: 100, height: 100 });
      dom.window.document.dispatchEvent(
        new dom.window.PointerEvent("pointermove", { bubbles: true, clientX: 50, clientY: 50 })
      );
      // dispatch จาก document เอง (ไม่มี target เป็น card) — แค่ยืนยันไม่ throw เพราะไม่มี listener ผูกไว้เลย
      assert.equal(card.style.getPropertyValue("--sx"), "");
    });

    test("matchMedia hover+pointer:fine = false → IIFE return ทันที ไม่ผูก pointermove listener", () => {
      const dom = makeDom(polishMarkup(), { matchMedia: makeMatchMedia({ hoverFine: false }) });
      runScript(dom);
      const card = dom.window.document.querySelector(".service-item");
      setRect(card, { left: 0, top: 0, width: 100, height: 100 });
      card.dispatchEvent(new dom.window.PointerEvent("pointermove", { bubbles: true, clientX: 50, clientY: 25 }));
      assert.equal(card.style.getPropertyValue("--sx"), "");
    });

    test("matchMedia hover+pointer:fine = true → pointermove เหนือ element ที่ตรง SPOTLIGHT_SEL ตั้ง --sx/--sy เป็น % ตำแหน่งเมาส์เทียบ rect", () => {
      const dom = makeDom(polishMarkup(), { matchMedia: makeMatchMedia({ hoverFine: true }) });
      runScript(dom);
      const card = dom.window.document.querySelector(".service-item");
      setRect(card, { left: 0, top: 0, width: 100, height: 100 });
      card.dispatchEvent(new dom.window.PointerEvent("pointermove", { bubbles: true, clientX: 25, clientY: 75 }));
      assert.equal(card.style.getPropertyValue("--sx"), "25%");
      assert.equal(card.style.getPropertyValue("--sy"), "75%");
    });

    test(".ab-value-card ได้ทั้ง --sx/--sy และ --rx/--ry (tilt) เมื่อไม่ reduced-motion", () => {
      const dom = makeDom(polishMarkup(), {
        matchMedia: makeMatchMedia({ hoverFine: true, reducedMotion: false }),
      });
      runScript(dom);
      const card = dom.window.document.querySelector(".ab-value-card");
      setRect(card, { left: 0, top: 0, width: 200, height: 100 });
      // sx=75% (>50 → rotate right), sy=25% (<50 → tilt toward viewer)
      card.dispatchEvent(new dom.window.PointerEvent("pointermove", { bubbles: true, clientX: 150, clientY: 25 }));
      assert.equal(card.style.getPropertyValue("--sx"), "75%");
      assert.equal(card.style.getPropertyValue("--sy"), "25%");
      const rx = parseFloat(card.style.getPropertyValue("--rx"));
      const ry = parseFloat(card.style.getPropertyValue("--ry"));
      // rx = ((sy/100)-0.5) * -10 = (0.25-0.5)*-10 = 2.5
      assert.equal(rx, 2.5);
      // ry = ((sx/100)-0.5) * 12 = (0.75-0.5)*12 = 3
      assert.equal(ry, 3);
    });

    test("reduced-motion=true → .ab-value-card ยังได้ --sx/--sy แต่ไม่ได้ --rx/--ry", () => {
      const dom = makeDom(polishMarkup(), {
        matchMedia: makeMatchMedia({ hoverFine: true, reducedMotion: true }),
      });
      runScript(dom);
      const card = dom.window.document.querySelector(".ab-value-card");
      setRect(card, { left: 0, top: 0, width: 200, height: 100 });
      card.dispatchEvent(new dom.window.PointerEvent("pointermove", { bubbles: true, clientX: 100, clientY: 50 }));
      assert.equal(card.style.getPropertyValue("--sx"), "50%");
      assert.equal(card.style.getPropertyValue("--rx"), "");
      assert.equal(card.style.getPropertyValue("--ry"), "");
    });

    test("ย้ายเมาส์ออกจาก .ab-value-card ไปยัง element ที่ไม่ตรง selector ใดเลย → รีเซ็ต --rx/--ry เป็น 0deg", () => {
      const dom = makeDom(polishMarkup() + '<div id="plain">plain</div>', {
        matchMedia: makeMatchMedia({ hoverFine: true }),
      });
      runScript(dom);
      const card = dom.window.document.querySelector(".ab-value-card");
      const plain = dom.window.document.getElementById("plain");
      setRect(card, { left: 0, top: 0, width: 200, height: 100 });
      card.dispatchEvent(new dom.window.PointerEvent("pointermove", { bubbles: true, clientX: 150, clientY: 25 }));
      assert.notEqual(card.style.getPropertyValue("--rx"), "0deg");
      plain.dispatchEvent(new dom.window.PointerEvent("pointermove", { bubbles: true, clientX: 5, clientY: 5 }));
      assert.equal(card.style.getPropertyValue("--rx"), "0deg");
      assert.equal(card.style.getPropertyValue("--ry"), "0deg");
    });

    test("pointermove เหนือ element ที่ไม่ตรง SPOTLIGHT_SEL ใดเลย → ไม่ throw ไม่มี custom prop ใดถูกตั้ง", () => {
      const dom = makeDom(polishMarkup() + '<div id="plain">plain</div>', {
        matchMedia: makeMatchMedia({ hoverFine: true }),
      });
      runScript(dom);
      const plain = dom.window.document.getElementById("plain");
      assert.doesNotThrow(() =>
        plain.dispatchEvent(new dom.window.PointerEvent("pointermove", { bubbles: true, clientX: 5, clientY: 5 }))
      );
      assert.equal(plain.style.getPropertyValue("--sx"), "");
    });
  });

  // ===========================================================
  // IIFE 3 — GENERAL POLISH (ripple / magnetic / tab-title)
  // ===========================================================
  describe("1. ripple บนทุก .btn", () => {
    test("คลิกบน .btn → สร้าง .btn-ripple span ขนาด/ตำแหน่งคำนวณจาก rect + พิกัดคลิกจริง", () => {
      const dom = makeDom(polishMarkup());
      runScript(dom);
      const btn = dom.window.document.querySelector(".btn-primary");
      setRect(btn, { left: 10, top: 20, width: 100, height: 40 });
      btn.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, cancelable: true, clientX: 60, clientY: 40 }));
      const span = btn.querySelector(".btn-ripple");
      assert.ok(span);
      const size = Math.max(100, 40) * 1.6; // 160
      assert.equal(span.style.width, size + "px");
      assert.equal(span.style.height, size + "px");
      const x = 60 - 10; // clientX - left = 50
      const y = 40 - 20; // clientY - top = 20
      assert.equal(span.style.left, x - size / 2 + "px");
      assert.equal(span.style.top, y - size / 2 + "px");
    });

    test("คลิกแบบไม่มี clientX/clientY เป็นตัวเลข (เช่น click ที่ยิงจากคีย์บอร์ด) → ripple อยู่กึ่งกลางปุ่ม (r.width/2, r.height/2)", () => {
      const dom = makeDom(polishMarkup());
      runScript(dom);
      const btn = dom.window.document.querySelector(".btn-primary");
      setRect(btn, { left: 0, top: 0, width: 100, height: 40 });
      btn.dispatchEvent(new dom.window.Event("click", { bubbles: true, cancelable: true }));
      const span = btn.querySelector(".btn-ripple");
      const size = Math.max(100, 40) * 1.6;
      assert.equal(span.style.left, 100 / 2 - size / 2 + "px");
      assert.equal(span.style.top, 40 / 2 - size / 2 + "px");
    });

    test("🐛 บันทึกพฤติกรรม: clientX===0 เป๊ะ (คลิกที่ตำแหน่ง pixel 0 ของ viewport พอดี) ตกไป branch กึ่งกลางปุ่มผิดพลาด เพราะเช็ค truthy ของค่าตัวเลขเอง ไม่ใช่เช็คว่ามีค่าหรือไม่", () => {
      const dom = makeDom(polishMarkup());
      runScript(dom);
      const btn = dom.window.document.querySelector(".btn-primary");
      setRect(btn, { left: 0, top: 0, width: 100, height: 40 });
      // clientX=0, clientY=20 (จุดกึ่งกลางแนวตั้งพอดี แต่ x เป๊ะ 0)
      btn.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, cancelable: true, clientX: 0, clientY: 20 }));
      const span = btn.querySelector(".btn-ripple");
      const size = Math.max(100, 40) * 1.6;
      // ตามโค้ด: x ควรเป็น 0-0=0 แต่ (typeof 0 === 'number' && 0) → 0 (falsy) → fallback r.width/2 = 50
      assert.equal(span.style.left, 100 / 2 - size / 2 + "px", "ตกไป fallback กึ่งกลางแทนที่จะใช้ 0 จริง");
    });

    test("span ถูกลบเมื่อ event animationend ยิง", () => {
      const dom = makeDom(polishMarkup());
      runScript(dom);
      const btn = dom.window.document.querySelector(".btn-primary");
      setRect(btn, { left: 0, top: 0, width: 100, height: 40 });
      btn.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, cancelable: true, clientX: 10, clientY: 10 }));
      const span = btn.querySelector(".btn-ripple");
      span.dispatchEvent(new dom.window.Event("animationend"));
      assert.equal(btn.querySelector(".btn-ripple"), null);
    });

    test("span ถูกลบด้วย safety-net timer 900ms ถ้า animationend ไม่ยิง", () => {
      const dom = makeDom(polishMarkup());
      const calls = stubTimers(dom);
      runScript(dom);
      const btn = dom.window.document.querySelector(".btn-primary");
      setRect(btn, { left: 0, top: 0, width: 100, height: 40 });
      btn.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, cancelable: true, clientX: 10, clientY: 10 }));
      assert.ok(btn.querySelector(".btn-ripple"));
      const t = calls.find((c) => c.ms === 900);
      assert.ok(t);
      t.cb();
      assert.equal(btn.querySelector(".btn-ripple"), null);
    });

    test("คลิกนอก .btn ใดๆ → ไม่สร้าง ripple ไม่ throw", () => {
      const dom = makeDom(polishMarkup() + '<div id="plain">plain</div>');
      runScript(dom);
      const plain = dom.window.document.getElementById("plain");
      assert.doesNotThrow(() =>
        plain.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, cancelable: true, clientX: 1, clientY: 1 }))
      );
      assert.equal(dom.window.document.querySelector(".btn-ripple"), null);
    });
  });

  describe("2. magnetic pull สำหรับ .btn-lg", () => {
    test("hover+pointer:fine=true และไม่ reduced-motion → mousemove ปรับ transform ตามระยะจากจุดกึ่งกลางปุ่ม", () => {
      const dom = makeDom(polishMarkup(), {
        matchMedia: makeMatchMedia({ hoverFine: true, reducedMotion: false }),
      });
      runScript(dom);
      const btn = dom.window.document.querySelector(".btn-lg");
      setRect(btn, { left: 0, top: 0, width: 100, height: 40 });
      // ศูนย์กลางปุ่มคือ (50,20) — เมาส์อยู่ที่ (70,30) → mx=20, my=10
      btn.dispatchEvent(new dom.window.MouseEvent("mousemove", { bubbles: true, clientX: 70, clientY: 30 }));
      assert.equal(btn.style.transform, "translate(" + 20 * 0.12 + "px," + 10 * 0.22 + "px)");
    });

    test("mouseleave ล้าง transform กลับเป็นค่าว่าง", () => {
      const dom = makeDom(polishMarkup(), { matchMedia: makeMatchMedia({ hoverFine: true }) });
      runScript(dom);
      const btn = dom.window.document.querySelector(".btn-lg");
      setRect(btn, { left: 0, top: 0, width: 100, height: 40 });
      btn.dispatchEvent(new dom.window.MouseEvent("mousemove", { bubbles: true, clientX: 70, clientY: 30 }));
      assert.notEqual(btn.style.transform, "");
      btn.dispatchEvent(new dom.window.MouseEvent("mouseleave", { bubbles: true }));
      assert.equal(btn.style.transform, "");
    });

    test("reduced-motion=true → ไม่ผูก listener เลย mousemove แล้ว transform ยังว่าง", () => {
      const dom = makeDom(polishMarkup(), {
        matchMedia: makeMatchMedia({ hoverFine: true, reducedMotion: true }),
      });
      runScript(dom);
      const btn = dom.window.document.querySelector(".btn-lg");
      setRect(btn, { left: 0, top: 0, width: 100, height: 40 });
      btn.dispatchEvent(new dom.window.MouseEvent("mousemove", { bubbles: true, clientX: 70, clientY: 30 }));
      assert.equal(btn.style.transform, "");
    });

    test("ไม่ stub matchMedia เลย (default undefined) → ไม่ throw ไม่ผูก magnetic listener", () => {
      const dom = makeDom(polishMarkup());
      assert.doesNotThrow(() => runScript(dom));
      const btn = dom.window.document.querySelector(".btn-lg");
      setRect(btn, { left: 0, top: 0, width: 100, height: 40 });
      btn.dispatchEvent(new dom.window.MouseEvent("mousemove", { bubbles: true, clientX: 70, clientY: 30 }));
      assert.equal(btn.style.transform, "");
    });
  });

  describe("3. tab-title reaction ตอนสลับแท็บ", () => {
    test("document.hidden=true → title เปลี่ยนเป็นข้อความเรียกกลับ", () => {
      const dom = makeDom("<div></div>", {});
      runScript(dom);
      Object.defineProperty(dom.window.document, "hidden", { value: true, configurable: true });
      dom.window.document.dispatchEvent(new dom.window.Event("visibilitychange"));
      assert.equal(dom.window.document.title, "👋 กลับมาคุยกันต่อได้เลย — CS.SIGN");
    });

    test("กลับมาที่แท็บ (hidden=false) → title คืนค่าเดิมตอน script eval ตอนแรก", () => {
      const dom = makeDom("<div></div>", { title: "หน้าทดสอบเดิม — CS.SIGN" });
      runScript(dom);
      Object.defineProperty(dom.window.document, "hidden", { value: true, configurable: true });
      dom.window.document.dispatchEvent(new dom.window.Event("visibilitychange"));
      assert.equal(dom.window.document.title, "👋 กลับมาคุยกันต่อได้เลย — CS.SIGN");

      Object.defineProperty(dom.window.document, "hidden", { value: false, configurable: true });
      dom.window.document.dispatchEvent(new dom.window.Event("visibilitychange"));
      assert.equal(dom.window.document.title, "หน้าทดสอบเดิม — CS.SIGN");
    });
  });
});
