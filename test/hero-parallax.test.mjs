// test/hero-parallax.test.mjs
//
// jsdom test สำหรับ js/hero-parallax.js — IIFE 0 exports ที่รันทันทีตอนโหลดสคริปต์
// (ไม่มี DOMContentLoaded wrapper — ต่างจาก tabs-overflow.js/site-search.js) ทำ parallax
// tilt ของ .hero-photo-wrap/.hero-inner ตามตำแหน่งเมาส์ (เฉพาะ pointer แบบ fine + ไม่ตั้ง
// prefers-reduced-motion) และ scroll-based parallax (ทำงานเสมอยกเว้น reduced-motion)
//
// วิธีทดสอบ: โหลดเป็น classic <script> จริงเข้า JSDOM (runScripts: "dangerously") ตาม
// แพทเทิร์นเดียวกับ test/about-portfolio-extracted-inline-scripts.test.mjs (about-tilt-effects.js
// มีโครงสร้างใกล้เคียงกันมาก: matchMedia('pointer: fine')/matchMedia('prefers-reduced-motion')) —
// jsdom ไม่ implement `window.matchMedia` จริง (undefined โดย default) ซึ่งตามโค้ดจริง
// (`window.matchMedia && window.matchMedia(...).matches`) แปลว่า reduceMotion/finePointer เป็น
// undefined (falsy) ทั้งคู่ — จุดสำคัญที่ต้องระวัง: `scrollEnabled = !reduceMotion` เป็น `!undefined`
// = `true` เสมอเมื่อไม่ mock matchMedia ดังนั้น scroll listener จะถูกผูกแม้ไม่ตั้งค่า matchMedia เลย
// ต่างจาก cursor listener ที่ต้อง mock matchMedia ให้ finePointer=true ก่อนถึงจะผูก
//
// ไม่ได้แก้ไฟล์ .js/.html/.css ที่เป็นโค้ดจริงเลยแม้แต่บรรทัดเดียวในไฟล์นี้ — งานทดสอบล้วนๆ

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const SOURCE = readFileSync(new URL("../js/hero-parallax.js", import.meta.url), "utf-8");

function heroMarkup() {
  return `
    <section class="hero">
      <div class="hero-photo-wrap"></div>
      <div class="hero-inner"></div>
    </section>
  `;
}

function makeDom(markup, { matchMedia } = {}) {
  const dom = new JSDOM(`<!doctype html><html><body>${markup}</body></html>`, {
    url: "https://example.test/",
    runScripts: "dangerously",
    pretendToBeVisual: true,
  });
  if (matchMedia) dom.window.matchMedia = matchMedia;
  // ทำให้ requestAnimationFrame รันแบบ synchronous เพื่อให้เทสอ่านผลได้ทันทีโดยไม่ต้อง
  // รอ event loop เพิ่มเติม (เหมือนแพทเทิร์นใน about-portfolio-extracted-inline-scripts.test.mjs)
  dom.window.requestAnimationFrame = (cb) => { cb(); return 1; };
  return dom;
}

function runScript(dom) {
  const script = dom.window.document.createElement("script");
  script.textContent = SOURCE;
  dom.window.document.body.appendChild(script);
}

function finePointerMatchMedia(query) {
  return { matches: query.indexOf("pointer: fine") !== -1 };
}

function reducedMotionMatchMedia(query) {
  return { matches: query.indexOf("prefers-reduced-motion") !== -1 };
}

describe("js/hero-parallax.js — hero photo/copy parallax tilt + scroll drift", () => {
  test("ไม่มี .hero ในหน้า — ไม่ throw (guard ป้องกัน element ไม่มีจริง)", () => {
    const dom = makeDom("<div>no hero here</div>");
    assert.doesNotThrow(() => runScript(dom));
  });

  test("มี .hero แต่ไม่มี .hero-photo-wrap — ไม่ throw (guard ต้องมีครบทั้ง 3 element)", () => {
    const dom = makeDom(`<section class="hero"><div class="hero-inner"></div></section>`);
    assert.doesNotThrow(() => runScript(dom));
  });

  test("มี .hero แต่ไม่มี .hero-inner — ไม่ throw", () => {
    const dom = makeDom(`<section class="hero"><div class="hero-photo-wrap"></div></section>`);
    assert.doesNotThrow(() => runScript(dom));
  });

  test("ไม่ mock matchMedia เลย (ค่า default ของ jsdom คือ undefined) — ไม่ throw, ผูก scroll listener (scrollEnabled คำนวณจาก !undefined = true) แต่ไม่ผูก mousemove (cursorEnabled = undefined && ... = falsy)", () => {
    const dom = makeDom(heroMarkup());
    assert.equal(dom.window.matchMedia, undefined);
    assert.doesNotThrow(() => runScript(dom));

    const hero = dom.window.document.querySelector(".hero");
    const photo = dom.window.document.querySelector(".hero-photo-wrap");
    const inner = dom.window.document.querySelector(".hero-inner");

    // scrollEnabled=true เรียก updateScrollFrac()+apply() ทันทีตอนโหลด (ไม่ต้องรอ scroll event
    // จริง) — jsdom getBoundingClientRect() คืน 0 ทุกด้านโดย default (ไม่มี layout engine จริง)
    // ดังนั้น scrollFrac = clamp(-0/1) = 0 → transform ควรถูกตั้งค่าแล้วตั้งแต่ตอนนี้
    assert.ok(photo.style.transform.length > 0, "photo transform ควรถูกตั้งค่าแล้วจาก apply() ตอนโหลด");
    assert.ok(inner.style.transform.length > 0, "inner transform ควรถูกตั้งค่าแล้วจาก apply() ตอนโหลด");
    assert.equal(inner.style.opacity, "1", "scrollFrac=0 ตอนโหลด → opacity เต็ม 1");

    // ยิง mousemove — cursor ปิดอยู่ (ไม่มี listener ผูก) transform ของ photo/inner ต้องไม่เปลี่ยน
    const before = { photo: photo.style.transform, inner: inner.style.transform };
    assert.doesNotThrow(() => {
      hero.dispatchEvent(
        new dom.window.MouseEvent("mousemove", { clientX: 50, clientY: 50, bubbles: true })
      );
    });
    assert.equal(photo.style.transform, before.photo);
    assert.equal(inner.style.transform, before.inner);
  });

  test("finePointer=true, reduceMotion=false — mousemove เอียงภาพ/ข้อความคนละทิศ, mouseleave รีเซ็ตกลับ 0", () => {
    const dom = makeDom(heroMarkup(), { matchMedia: finePointerMatchMedia });
    runScript(dom);

    const hero = dom.window.document.querySelector(".hero");
    const photo = dom.window.document.querySelector(".hero-photo-wrap");
    const inner = dom.window.document.querySelector(".hero-inner");

    // jsdom getBoundingClientRect() คืน { top:0, left:0, width:0, height:0, ... } โดย default
    // ทำให้ (clientX-left)/width = Infinity/NaN — ยืนยันแค่ว่าไม่ throw และ transform ยังถูกตั้ง
    // เป็น string รูปแบบ translate3d(...) เสมอ (ไม่ throw ระหว่างคำนวณ)
    assert.doesNotThrow(() => {
      hero.dispatchEvent(
        new dom.window.MouseEvent("mousemove", { clientX: 50, clientY: 50, bubbles: true })
      );
    });
    assert.match(photo.style.transform, /^translate3d\(/);
    assert.match(inner.style.transform, /^translate3d\(/);

    assert.doesNotThrow(() => {
      hero.dispatchEvent(new dom.window.MouseEvent("mouseleave", { bubbles: true }));
    });
    // mouseleave ตั้ง pendingX/pendingY กลับ 0 แล้วเรียก apply() ใหม่ — scrollFrac ยังเป็น 0
    // (ไม่มี scroll event เกิดขึ้นเลยในเทสนี้) ดังนั้น photoX/photoY/copyX/copyY ต้องเป็น 0 พอดี
    assert.equal(photo.style.transform, "translate3d(0px,0px,0)");
    assert.equal(inner.style.transform, "translate3d(0px,0px,0)");
    assert.equal(inner.style.opacity, "1");
  });

  test("reduceMotion=true — ไม่ผูกทั้ง mousemove และ scroll listener เลย (cursorEnabled และ scrollEnabled เป็น false ทั้งคู่)", () => {
    const dom = makeDom(heroMarkup(), { matchMedia: reducedMotionMatchMedia });
    assert.doesNotThrow(() => runScript(dom));

    const hero = dom.window.document.querySelector(".hero");
    const photo = dom.window.document.querySelector(".hero-photo-wrap");
    const inner = dom.window.document.querySelector(".hero-inner");

    // reduceMotion=true → scrollEnabled=false → ไม่เรียก apply() เลยตอนโหลด → ไม่มี inline
    // style ใดๆ ถูกตั้งค่าเลยสักจุด
    assert.equal(photo.style.transform, "");
    assert.equal(inner.style.transform, "");

    assert.doesNotThrow(() => {
      hero.dispatchEvent(
        new dom.window.MouseEvent("mousemove", { clientX: 50, clientY: 50, bubbles: true })
      );
    });
    // ยืนยันว่า mousemove ไม่มีผลอะไรเลย (ไม่มี listener ผูกไว้)
    assert.equal(photo.style.transform, "");
    assert.equal(inner.style.transform, "");
  });

  test("finePointer=false (มือถือ), reduceMotion=false — cursor ปิด แต่ scroll parallax ยังทำงาน", () => {
    const dom = makeDom(heroMarkup(), { matchMedia: () => ({ matches: false }) });
    runScript(dom);

    const photo = dom.window.document.querySelector(".hero-photo-wrap");
    const inner = dom.window.document.querySelector(".hero-inner");

    // matchMedia('pointer: fine').matches=false, matchMedia('prefers-reduced-motion').matches=false
    // → finePointer=false, reduceMotion=false → cursorEnabled=false, scrollEnabled=true
    assert.ok(photo.style.transform.length > 0, "scroll parallax ยังเรียก apply() ตอนโหลดแม้ cursor ปิด");
    assert.equal(inner.style.opacity, "1");
  });

  test("scroll event จริง — updateScrollFrac() คำนวณจาก getBoundingClientRect().top/height แล้ว apply() ปรับ opacity/transform ตาม scrollFrac", () => {
    const dom = makeDom(heroMarkup(), { matchMedia: () => ({ matches: false }) });
    const hero = dom.window.document.querySelector(".hero");

    // mock getBoundingClientRect ให้จำลองว่า hero ถูกเลื่อนขึ้นไปครึ่งหนึ่งแล้ว
    // (top = -200, height = 400 → scrollFrac = clamp(200/400) = 0.5)
    hero.getBoundingClientRect = () => ({
      top: -200,
      left: 0,
      width: 800,
      height: 400,
      right: 800,
      bottom: 200,
      x: 0,
      y: -200,
      toJSON() {},
    });

    runScript(dom);

    const inner = dom.window.document.querySelector(".hero-inner");
    // ยิง scroll event จริงบน window เพื่อให้ callback re-run updateScrollFrac() ด้วย rect ใหม่
    assert.doesNotThrow(() => {
      dom.window.dispatchEvent(new dom.window.Event("scroll"));
    });

    // opacity = max(0, 1 - scrollFrac*1.15) = max(0, 1 - 0.575) = 0.425
    // (เทียบด้วย parseFloat + closeTo แทน string ตรงๆ เพราะ floating point คำนวณได้
    // 0.42500000000000004 ไม่ใช่ 0.425 พอดี — ยังคงตรวจค่าจริงที่คำนวณได้ ไม่ใช่แค่ไม่ throw)
    assert.ok(
      Math.abs(parseFloat(inner.style.opacity) - 0.425) < 1e-9,
      `expected opacity ~0.425, got ${inner.style.opacity}`
    );
  });

  test("scroll ไกลเกิน 100% ของความสูง hero — scrollFrac ถูก clamp ไม่เกิน 1 (opacity ไม่ติดลบ)", () => {
    const dom = makeDom(heroMarkup(), { matchMedia: () => ({ matches: false }) });
    const hero = dom.window.document.querySelector(".hero");

    // top = -1000, height = 400 → -top/total = 2.5 ก่อน clamp → ต้องถูกจำกัดที่ 1
    hero.getBoundingClientRect = () => ({
      top: -1000,
      left: 0,
      width: 800,
      height: 400,
      right: 800,
      bottom: -600,
      x: 0,
      y: -1000,
      toJSON() {},
    });

    runScript(dom);

    const inner = dom.window.document.querySelector(".hero-inner");
    // scrollFrac clamp ที่ 1 → opacity = max(0, 1 - 1*1.15) = max(0, -0.15) = 0
    assert.equal(inner.style.opacity, "0");
  });
});
