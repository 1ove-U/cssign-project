// test/home-dynamic-showcase-video.test.mjs — รอบที่ 144
//
// ขอบเขต: js/home-dynamic-showcase-video.js (223 บรรทัด) — carousel วิดีโอแนะนำสินค้าแนวตั้ง
// (reel) หน้าแรก — แยกออกมาจาก js/home-dynamic-showcase.js เดิมตั้งแต่ "2026 refactor phase 7"
// (คอมเมนต์หัวไฟล์) — ตัวถัดไปตามคำแนะนำท้ายรอบ 143 (กลุ่ม home-dynamic-* เหลือไฟล์นี้ก่อน แล้ว
// ค่อย home-dynamic-showcase.js ที่พันกับ getProducts/getPortfolios/getSettings เยอะกว่า)
//
// อ่านโค้ดจริงทั้งไฟล์ก่อนเขียนเทส — พบจุดสำคัญที่ต่างจากไฟล์ตระกูล home-dynamic-* อื่นๆ ที่เคยเทส
// มาก่อน (home-dynamic.js/home-dynamic-social.js รอบ 142): **ไฟล์นี้ไม่มี top-level call
// renderIntroVideo() ในตัวเอง** — ฟังก์ชันแค่ export ออกไปให้ js/home-dynamic-showcase.js เรียกที่
// บรรทัดสุดท้ายของไฟล์นั้นแทน (`renderIntroVideo();` อยู่ใน home-dynamic-showcase.js ไม่ใช่ไฟล์นี้)
// ยืนยันด้วย probe จริงก่อน (ลองรอหลาย tick/delay หลัง import เฉยๆ ไม่มีอะไรเปลี่ยน จนกว่าจะเรียก
// mod.renderIntroVideo() เองตรงๆ) — เทสทุกเคสด้านล่างจึงต้องเรียก renderIntroVideo() เองเสมอ
// ไม่ใช่แค่ import เฉยๆ เหมือนไฟล์อื่น
//
// ไฟล์นี้ import { escapeHtml, fadeSwap } จาก js/home-dynamic.js ตรงๆ — การ import ไฟล์นี้จึงทำให้
// js/home-dynamic.js ถูก evaluate ไปด้วย (มี top-level side effect เรียก renderClientLogos()/
// renderLatestBlogs() ของตัวเอง — ดู test/home-dynamic.test.mjs รอบ 142) แต่ทดสอบไฟล์นี้ไม่ต้อง
// สนใจผลลัพธ์ของ 2 ฟังก์ชันนั้นเลย (ไม่มี #home-blog-grid/#home-clients-row-a/b ใน fixture ด้านล่าง
// จึงเป็น no-op ทั้งคู่ ไม่ throw ไม่ต้อง stub getBlogs()/getPartners() เพิ่ม เพราะ __GET_DOCS_STUB__
// ที่ไม่ได้ตั้งไว้จะ fallback เป็น docs: [] อัตโนมัติอยู่แล้วจาก stub loader)
//
// getSettings() จาก js/db-settings.js ใช้ getDoc() (เอกฐาน) → ต้องใช้ globalThis.__GET_DOC_STUB__
// (ของเดิมตั้งแต่รอบที่ 70) ดัก ref.path === "settings/main" เหมือน test/site-settings.test.mjs
// (รอบ 137) ไม่ใช่ __GET_DOCS_STUB__ พหูพจน์
//
// ใช้แพทเทิร์น import ด้วย query string คนละอันทุกเทส (`../js/home-dynamic-showcase-video.js?t=N`)
// บังคับ module instance ใหม่ทุกครั้งเหมือนไฟล์ side-effect อื่นๆ ทั้งหมด — แม้ไฟล์นี้จะไม่มี
// top-level call เอง แต่ module-scope ของ escapeHtml/fadeSwap (จาก home-dynamic.js ที่ถูก import
// ซ้ำ) และ intervalId ภายใน renderIntroVideo() (ตัวแปร local ในฟังก์ชัน ไม่ใช่ module-scope จริงๆ)
// ยังคงใช้แพทเทิร์นเดียวกันเพื่อความสม่ำเสมอกับทั้งโปรเจกต์
//
// jsdom (เวอร์ชันที่ใช้ในโปรเจกต์นี้): <video>.currentTime ตั้งค่าตรงๆ ได้ไม่ throw, readyState/
// duration เป็น read-only ตามสเปกต้อง Object.defineProperty ทับเอา (ยืนยันด้วย probe จริงก่อน) —
// .muted (IDL property) เริ่มต้นเป็น false เสมอไม่ว่า attribute `muted` จะมีอยู่ในองค์ประกอบหรือไม่
// (ต่างจาก .defaultMuted ที่ reflect attribute — เทสด้านล่างยึดพฤติกรรมจริงของ jsdom ที่ probe แล้ว
// ไม่ใช่พฤติกรรมสมมติของเบราว์เซอร์จริง)
//
// autoplay ใช้ window.setInterval(..., 5000) จริง (ไม่ใช่ rAF) — เทสที่ต้องรอ autoplay ใช้
// setTimeout(...,5200) จริงของ Node เอง (ไม่ mock timer) — **ไฟล์นี้เป็นไฟล์แรกในโปรเจกต์ที่ทดสอบ
// carousel แบบมี setInterval() จริง** (ไฟล์ carousel อื่นก่อนหน้า เช่น portfolio-lightbox.js ไม่มี
// autoplay/setInterval เลย) — ยืนยันด้วย probe จริงก่อนว่า interval ที่ไม่ถูก clearInterval() (เช่น
// เทสที่ปล่อยให้ autoplay เดินอยู่ตอนจบเทสโดยไม่ mouseenter หยุด) จะค้าง event loop จริง ทำให้
// `node --test` รันไฟล์นี้ไม่จบ (สมมติฐานเดิมที่คิดว่า garbage collection จะเก็บกวาดให้เองนั้นผิด —
// พิสูจน์ผิดจากการรันจริงแล้วแก้เป็น dom.window.close() ใน afterEach() ด้านล่างแทน ซึ่งเคลียร์ timer
// ทั้งหมดที่ผูกกับ window นั้นทันทีจริง ยืนยันด้วย probe ก่อนใช้)

import { test, describe, afterEach } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

let dom;
let importCounter = 0;

function setupDom({ initialHtml = "STATIC-FALLBACK", hasWrap = true } = {}) {
  const wrap = hasWrap ? `<div id="home-intro-video">${initialHtml}</div>` : "";
  dom = new JSDOM(`<!doctype html><html><body>${wrap}</body></html>`, {
    url: "https://example.test/index.html",
    pretendToBeVisual: true
  });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.requestAnimationFrame = dom.window.requestAnimationFrame;
  return dom;
}

function stubSettings(data) {
  globalThis.__GET_DOC_STUB__ = (ref) => {
    if (ref && ref.path === "settings/main") {
      return data === undefined ? { exists: false, data: {} } : { exists: true, data };
    }
    return { exists: false, data: {} };
  };
}

function stubThrow(err) {
  globalThis.__GET_DOC_STUB__ = (ref) => {
    if (ref && ref.path === "settings/main") throw err;
    return { exists: false, data: {} };
  };
}

async function importFresh() {
  importCounter += 1;
  return import(`../js/home-dynamic-showcase-video.js?t=${importCounter}`);
}

function wrap() {
  return dom.window.document.getElementById("home-intro-video");
}

afterEach(() => {
  delete globalThis.__GET_DOC_STUB__;
  // renderIntroVideo() ใช้ window.setInterval() จริงสำหรับ autoplay (ต่างจากไฟล์ carousel อื่นๆ
  // ในโปรเจกต์ที่ไม่มีการทดสอบ setInterval มาก่อน) — interval ที่ยังไม่ถูก clearInterval() (เช่น
  // เทสที่ตั้งใจปล่อยให้ autoplay เดินต่อจนจบเทสโดยไม่ mouseenter หยุด) จะค้าง event loop ของ Node
  // ไว้ทำให้ test runner ไม่จบสักที (ยืนยันด้วย probe จริงก่อนแก้ — ต่างจากที่คาดไว้ตอนแรกว่า
  // garbage collection จะเก็บกวาดให้เอง) — dom.window.close() เคลียร์ timer ทั้งหมดที่ผูกกับ window
  // นั้นทันที (ยืนยันด้วย probe จริงแล้วว่า setInterval หยุดจริงหลัง close()) จึงปิดทุกครั้งหลังเทส
  // เพื่อไม่ให้ค้างข้ามไปเทสถัดไป/บล็อกกระบวนการทั้งไฟล์
  if (dom && typeof dom.window.close === "function") dom.window.close();
});

function video(overrides) {
  return { url: "https://cdn.test/default.mp4", title: "", desc: "", ...overrides };
}

// =====================================================================
// ไม่มี #home-intro-video ในหน้า
// =====================================================================
describe("renderIntroVideo() — ไม่มี wrap element", () => {
  test("ไม่มี #home-intro-video → return ทันที ไม่เรียก getSettings เลย ไม่ throw", async () => {
    setupDom({ hasWrap: false });
    let called = false;
    globalThis.__GET_DOC_STUB__ = () => { called = true; return { exists: false, data: {} }; };
    const mod = await importFresh();
    await assert.doesNotReject(mod.renderIntroVideo());
    assert.equal(called, false);
  });
});

// =====================================================================
// ไม่มีวิดีโอให้แสดง → คง fallback เดิม (การ์ด "รออัพเดต")
// =====================================================================
describe("renderIntroVideo() — คง static fallback เดิม", () => {
  test("ไม่มีเอกสาร settings เลย (exists:false) → ไม่แตะ DOM เลย", async () => {
    setupDom();
    stubSettings(undefined);
    const mod = await importFresh();
    await mod.renderIntroVideo();
    assert.equal(wrap().innerHTML, "STATIC-FALLBACK");
  });

  test("settings เป็น object ว่างเปล่า ({}) → ไม่มีทั้ง introVideos/introVideo → คง fallback", async () => {
    setupDom();
    stubSettings({});
    const mod = await importFresh();
    await mod.renderIntroVideo();
    assert.equal(wrap().innerHTML, "STATIC-FALLBACK");
  });

  test("introVideos เป็น array แต่ทุกตัวไม่มี url เลย → กรองทิ้งหมด → ไม่มี introVideo เดี่ยวสำรอง → คง fallback", async () => {
    setupDom();
    stubSettings({ introVideos: [{ title: "ไม่มี url" }, { url: "" }] });
    const mod = await importFresh();
    await mod.renderIntroVideo();
    assert.equal(wrap().innerHTML, "STATIC-FALLBACK");
  });

  test("getSettings() reject (stub throw synchronous) → catch() เรียก console.warn 1 ครั้ง, คง fallback เดิม", async () => {
    setupDom();
    stubThrow(new Error("network down"));
    const origWarn = console.warn;
    let warnCalls = 0;
    console.warn = (...args) => { warnCalls += 1; origWarn.call(console, ...args); };
    try {
      const mod = await importFresh();
      await assert.doesNotReject(mod.renderIntroVideo());
      assert.equal(warnCalls, 1);
      assert.equal(wrap().innerHTML, "STATIC-FALLBACK");
    } finally {
      console.warn = origWarn;
    }
  });
});

// =====================================================================
// รองรับ settings.introVideo (เดี่ยว) แบบเดิมเป็น fallback เมื่อไม่มี introVideos array
// =====================================================================
describe("renderIntroVideo() — fallback ไปใช้ settings.introVideo (ตัวเดียว) แบบเก่า", () => {
  test("ไม่มี introVideos แต่มี introVideo.url → แสดงวิดีโอนั้นตัวเดียว", async () => {
    setupDom();
    stubSettings({ introVideo: { url: "https://cdn.test/legacy.mp4", title: "Legacy" } });
    const mod = await importFresh();
    await mod.renderIntroVideo();
    assert.match(wrap().innerHTML, /Legacy/);
    assert.match(wrap().innerHTML, /legacy\.mp4/);
  });

  test("มี introVideos array แต่กรองแล้วว่างเปล่า + มี introVideo.url สำรอง → ใช้ตัวสำรอง", async () => {
    setupDom();
    stubSettings({ introVideos: [{ title: "ไม่มี url" }], introVideo: { url: "https://cdn.test/fallback.mp4", title: "Fallback" } });
    const mod = await importFresh();
    await mod.renderIntroVideo();
    assert.match(wrap().innerHTML, /Fallback/);
  });

  test("introVideo ไม่มี url เลย (object ว่าง) → ไม่ใช้เป็นตัวสำรอง → คง fallback เดิม", async () => {
    setupDom();
    stubSettings({ introVideo: { title: "ไม่มี url" } });
    const mod = await importFresh();
    await mod.renderIntroVideo();
    assert.equal(wrap().innerHTML, "STATIC-FALLBACK");
  });
});

// =====================================================================
// จำกัดไม่เกิน 10 คลิป
// =====================================================================
describe("renderIntroVideo() — จำกัด videos.slice(0, 10)", () => {
  test("ส่งมา 15 คลิป → ใช้แค่ 10 ตัวแรก (ตัวนับแสดง 1 / 10)", async () => {
    setupDom();
    stubSettings({ introVideos: Array.from({ length: 15 }, (_, i) => video({ url: `https://cdn.test/v${i}.mp4`, title: `V${i}` })) });
    const mod = await importFresh();
    await mod.renderIntroVideo();
    assert.match(wrap().innerHTML, /1 \/ 10/);
    assert.ok(!wrap().innerHTML.includes("v10.mp4"), "ต้องไม่มีคลิปตัวที่ 11 (index 10) หลุดมา");
  });
});

// =====================================================================
// n=1 (คลิปเดียว): ไม่มี side slide/counter/dots แต่ยังมีลูกศร (ต่างจาก promo carousel ที่ disable)
// =====================================================================
describe("renderIntroVideo() — คลิปเดียว (n=1)", () => {
  test("ไม่มี .vcar-slide--side/.vcar-counter/.vcar-dots, ยังมีลูกศร prev/next ไม่ disabled", async () => {
    setupDom();
    stubSettings({ introVideos: [video({ url: "https://cdn.test/only.mp4", title: "Only" })] });
    const mod = await importFresh();
    await mod.renderIntroVideo();
    const html = wrap().innerHTML;
    assert.ok(!html.includes("vcar-slide--side"));
    assert.ok(!html.includes("vcar-counter"));
    assert.ok(!html.includes("vcar-dots"));
    const prevBtn = wrap().querySelector(".vcar-arrow--prev");
    const nextBtn = wrap().querySelector(".vcar-arrow--next");
    assert.ok(prevBtn && nextBtn);
    assert.equal(prevBtn.hasAttribute("disabled"), false);
    assert.equal(nextBtn.hasAttribute("disabled"), false);
  });
});

// =====================================================================
// n>1: prev/next slide, counter, dots ครบ + escapeHtml กัน XSS
// =====================================================================
describe("renderIntroVideo() — หลายคลิป (n>1): โครงสร้าง HTML และ escapeHtml", () => {
  test("counter/dots/caption ถูกต้องตาม activeIndex เริ่มต้น (0)", async () => {
    setupDom();
    stubSettings({
      introVideos: [
        video({ url: "https://youtu.be/dQw4w9WgXcQ", title: "วิดีโอ1", desc: "คำอธิบาย1" }),
        video({ url: "https://cdn.test/v2.mp4", title: "วิดีโอ2" })
      ]
    });
    const mod = await importFresh();
    await mod.renderIntroVideo();
    const html = wrap().innerHTML;
    assert.match(html, /1 \/ 2/);
    assert.match(html, /<h3>วิดีโอ1<\/h3>/);
    assert.match(html, /<p>คำอธิบาย1<\/p>/);
    const dots = wrap().querySelectorAll(".vcar-dot");
    assert.equal(dots.length, 2);
    assert.ok(dots[0].classList.contains("active"));
    assert.ok(!dots[1].classList.contains("active"));
  });

  test("escapeHtml กัน attribute breakout ผ่าน title ที่มี quote/HTML แปลกปลอม", async () => {
    setupDom();
    stubSettings({
      introVideos: [
        video({ url: "https://cdn.test/v1.mp4", title: 'x" onerror="alert(1)' }),
        video({ url: "https://cdn.test/v2.mp4", title: "ปกติ" })
      ]
    });
    const mod = await importFresh();
    await mod.renderIntroVideo();
    // ต้องไม่มี attribute onerror หลุดออกมาเป็น attribute จริงบน element ใดๆ เลย (escapeHtml เข้ารหัส
    // quote แล้ว จึงอยู่ในค่า string ของ attribute เดิม ไม่ใช่ attribute ใหม่ที่หลุดออกมา)
    const allEls = wrap().querySelectorAll("*");
    for (const el of allEls) {
      assert.equal(el.getAttribute("onerror"), null);
    }
  });

  test("mediaHTML: มี poster (จาก video.poster ตรงๆ) → background-image span, ไม่มี <video>", async () => {
    setupDom();
    // ต้องใช้ 3 คลิปเพื่อให้ตัวที่มี poster ไปตกอยู่ในตำแหน่ง "ข้างๆ" (side) จริงๆ — ด้วย 2 คลิป
    // prevIdx/nextIdx จะชี้ไปที่ index 1 ตัวเดียวกันทั้งคู่เสมอ (วนซ้ำ) ทำให้ index 0 (center) ไม่มี
    // ทางไปโผล่เป็น side slide ได้เลย
    stubSettings({
      introVideos: [
        video({ url: "https://cdn.test/v0.mp4" }),
        video({ url: "https://cdn.test/v1.mp4", poster: "https://cdn.test/poster1.jpg" }),
        video({ url: "https://cdn.test/v2.mp4" })
      ]
    });
    const mod = await importFresh();
    await mod.renderIntroVideo();
    // active index เริ่มต้น = 0 → nextIdx = 1 (ตัวที่มี poster)
    const nextSide = wrap().querySelector(".vcar-slide--side.side--next");
    assert.match(nextSide.innerHTML, /poster1\.jpg/);
    assert.match(nextSide.innerHTML, /background-image/);
    assert.equal(nextSide.querySelector("video"), null, "มี poster แล้วต้องไม่ฝัง <video> ซ้ำ");
  });

  test("mediaHTML: ไม่มี poster แต่เป็น YouTube link → derive poster จาก img.youtube.com/vi/<id>/hqdefault.jpg", async () => {
    setupDom();
    stubSettings({
      introVideos: [
        video({ url: "https://cdn.test/v1.mp4" }),
        video({ url: "https://youtu.be/BBBBBBBBBBB" })
      ]
    });
    const mod = await importFresh();
    await mod.renderIntroVideo();
    assert.match(wrap().innerHTML, /img\.youtube\.com\/vi\/BBBBBBBBBBB\/hqdefault\.jpg/);
  });

  test("mediaHTML: ไม่มี poster, ไม่ใช่ YouTube, เป็นไฟล์วิดีโอตรง (.mp4) → ฝัง <video> จริงไว้เป็นภาพตัวอย่าง", async () => {
    setupDom();
    stubSettings({
      introVideos: [
        video({ url: "https://cdn.test/center.mp4" }),
        video({ url: "https://cdn.test/side.webm" })
      ]
    });
    const mod = await importFresh();
    await mod.renderIntroVideo();
    const sideVid = wrap().querySelector(".vcar-slide-media--video");
    assert.ok(sideVid, "ต้องมี <video> เป็น media ของการ์ดข้างๆ ที่ไม่มี poster");
    assert.equal(sideVid.getAttribute("src"), "https://cdn.test/side.webm");
  });
});

// =====================================================================
// vcarCenterPlayerHTML: 3 กรณี (ไฟล์วิดีโอตรง / YouTube / ลิงก์อื่นไม่รู้จัก)
// =====================================================================
describe("renderIntroVideo() — center player ตามประเภทลิงก์", () => {
  test("ไฟล์วิดีโอตรง (.mp4/.webm/.ogg) → <video class=vcar-player autoplay muted loop playsinline>", async () => {
    setupDom();
    stubSettings({ introVideos: [video({ url: "https://cdn.test/direct.webm", poster: "https://cdn.test/p.jpg" })] });
    const mod = await importFresh();
    await mod.renderIntroVideo();
    const player = wrap().querySelector(".vcar-player");
    assert.equal(player.tagName, "VIDEO");
    assert.equal(player.getAttribute("src"), "https://cdn.test/direct.webm");
    assert.equal(player.hasAttribute("autoplay"), true);
    assert.equal(player.hasAttribute("loop"), true);
    assert.equal(player.getAttribute("poster"), "https://cdn.test/p.jpg");
  });

  test("ลิงก์ YouTube → <iframe> youtube-nocookie.com/embed/<id> พร้อม autoplay=1&mute=1&loop=1", async () => {
    setupDom();
    stubSettings({ introVideos: [video({ url: "https://www.youtube.com/watch?v=CCCCCCCCCCC" })] });
    const mod = await importFresh();
    await mod.renderIntroVideo();
    const player = wrap().querySelector(".vcar-player");
    assert.equal(player.tagName, "IFRAME");
    assert.match(player.getAttribute("src"), /youtube-nocookie\.com\/embed\/CCCCCCCCCCC/);
    assert.match(player.getAttribute("src"), /autoplay=1/);
    assert.match(player.getAttribute("src"), /mute=1/);
  });

  test("ลิงก์รูปแบบอื่นที่ไม่รู้จัก (ไม่ใช่ YouTube ไม่ใช่ไฟล์วิดีโอตรง) → iframe fallback ฝัง url ตรงๆ", async () => {
    setupDom();
    stubSettings({ introVideos: [video({ url: "https://example.test/embed/xyz" })] });
    const mod = await importFresh();
    await mod.renderIntroVideo();
    const player = wrap().querySelector(".vcar-player");
    assert.equal(player.tagName, "IFRAME");
    assert.equal(player.getAttribute("src"), "https://example.test/embed/xyz");
  });
});

// =====================================================================
// การเลื่อน: ลูกศร prev/next, จุด, คลิกการ์ดข้างๆ — goTo() คำนวณ modulo ถูกต้อง
// =====================================================================
describe("renderIntroVideo() — การเลื่อนด้วยตนเอง (goTo)", () => {
  async function setup3Videos() {
    setupDom();
    stubSettings({
      introVideos: [
        video({ url: "https://cdn.test/v1.mp4", title: "V1" }),
        video({ url: "https://cdn.test/v2.mp4", title: "V2" }),
        video({ url: "https://cdn.test/v3.mp4", title: "V3" })
      ]
    });
    const mod = await importFresh();
    await mod.renderIntroVideo();
    return mod;
  }
  function counterText() {
    return wrap().querySelector(".vcar-counter").textContent;
  }

  test("คลิกลูกศร next → เลื่อนไปคลิปถัดไป", async () => {
    await setup3Videos();
    assert.equal(counterText(), "1 / 3");
    wrap().querySelector(".vcar-arrow--next").dispatchEvent(new dom.window.Event("click", { bubbles: true }));
    assert.equal(counterText(), "2 / 3");
  });

  test("คลิกลูกศร prev จากตัวแรก (index 0) → วนไปตัวสุดท้าย (modulo ติดลบถูกต้อง)", async () => {
    await setup3Videos();
    wrap().querySelector(".vcar-arrow--prev").dispatchEvent(new dom.window.Event("click", { bubbles: true }));
    assert.equal(counterText(), "3 / 3");
  });

  test("คลิกจุด (.vcar-dot) ตัวที่ 3 → กระโดดไปตรงๆ", async () => {
    await setup3Videos();
    wrap().querySelectorAll(".vcar-dot")[2].dispatchEvent(new dom.window.Event("click", { bubbles: true }));
    assert.equal(counterText(), "3 / 3");
  });

  test("คลิกการ์ดข้างๆ (.vcar-slide--side) → กระโดดไปตาม data-idx ของการ์ดนั้น พร้อม preventDefault", async () => {
    await setup3Videos();
    const side = wrap().querySelector(".vcar-slide--side");
    const idx = Number(side.getAttribute("data-idx"));
    side.dispatchEvent(new dom.window.Event("click", { bubbles: true }));
    assert.equal(counterText(), `${idx + 1} / 3`);
  });

  test("หลัง goTo() แต่ละครั้ง มี interactivity ใหม่ผูกกับ markup ที่เพิ่งสร้าง (คลิกซ้ำได้เรื่อยๆ ไม่ตาย)", async () => {
    await setup3Videos();
    for (let i = 0; i < 5; i++) {
      wrap().querySelector(".vcar-arrow--next").dispatchEvent(new dom.window.Event("click", { bubbles: true }));
    }
    assert.match(counterText(), /^\d \/ 3$/);
  });
});

// =====================================================================
// Autoplay: setInterval 5000ms, หยุดตอน mouseenter, กลับมาเดินตอน mouseleave
// =====================================================================
describe("renderIntroVideo() — autoplay", () => {
  test("videos.length < 2 → ไม่เริ่ม autoplay เลย (ไม่ throw, counter ไม่เปลี่ยนแม้รอนาน)", async () => {
    setupDom();
    stubSettings({ introVideos: [video({ url: "https://cdn.test/only.mp4" })] });
    const mod = await importFresh();
    await mod.renderIntroVideo();
    // n=1 ไม่มี counter อยู่แล้ว แค่ยืนยันไม่ throw และ DOM ไม่พังหลังรอเกิน 5s
    await new Promise((r) => setTimeout(r, 5200));
    assert.ok(wrap().querySelector(".vcar"));
  });

  test("รอเกิน 5s โดยไม่ชี้เมาส์ → เลื่อนไปคลิปถัดไปอัตโนมัติ", async () => {
    setupDom();
    stubSettings({
      introVideos: [
        video({ url: "https://cdn.test/v1.mp4" }),
        video({ url: "https://cdn.test/v2.mp4" }),
        video({ url: "https://cdn.test/v3.mp4" })
      ]
    });
    const mod = await importFresh();
    await mod.renderIntroVideo();
    assert.equal(wrap().querySelector(".vcar-counter").textContent, "1 / 3");
    await new Promise((r) => setTimeout(r, 5200));
    assert.equal(wrap().querySelector(".vcar-counter").textContent, "2 / 3");
  });

  test("mouseenter หยุด autoplay, รอเกิน 5s ระหว่างชี้ค้าง → counter ไม่เปลี่ยน, mouseleave แล้วรอ 5s ใหม่ → เดินต่อ", async () => {
    setupDom();
    stubSettings({
      introVideos: [
        video({ url: "https://cdn.test/v1.mp4" }),
        video({ url: "https://cdn.test/v2.mp4" })
      ]
    });
    const mod = await importFresh();
    await mod.renderIntroVideo();
    const vcarEl = () => wrap().querySelector(".vcar");
    vcarEl().dispatchEvent(new dom.window.Event("mouseenter", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 5200));
    assert.equal(wrap().querySelector(".vcar-counter").textContent, "1 / 2", "ต้องไม่เลื่อนระหว่างเมาส์ชี้ค้าง");
    vcarEl().dispatchEvent(new dom.window.Event("mouseleave", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 5200));
    assert.equal(wrap().querySelector(".vcar-counter").textContent, "2 / 2", "ต้องเลื่อนต่อหลัง mouseleave");
  });
});

// =====================================================================
// ปุ่มเปิด/ปิดเสียง (mute toggle) — พฤติกรรมต่างกันตาม player เป็น <video> หรือ <iframe>
// =====================================================================
describe("renderIntroVideo() — ปุ่มเปิด/ปิดเสียง", () => {
  test("player เป็น <video> (ไฟล์วิดีโอตรง) → toggle player.muted และสลับไอคอนแสดง/ซ่อน", async () => {
    setupDom();
    stubSettings({ introVideos: [video({ url: "https://cdn.test/main.mp4" })] });
    const mod = await importFresh();
    await mod.renderIntroVideo();
    const player = wrap().querySelector(".vcar-player");
    const muteBtn = wrap().querySelector(".vcar-mute-toggle");
    const iconMuted = muteBtn.querySelector(".vcar-icon-muted");
    const iconUnmuted = muteBtn.querySelector(".vcar-icon-unmuted");
    const initialMuted = player.muted;
    muteBtn.dispatchEvent(new dom.window.Event("click", { bubbles: true }));
    assert.equal(player.muted, !initialMuted);
    assert.equal(iconMuted.style.display, player.muted ? "" : "none");
    assert.equal(iconUnmuted.style.display, player.muted ? "none" : "");
    muteBtn.dispatchEvent(new dom.window.Event("click", { bubbles: true }));
    assert.equal(player.muted, initialMuted);
  });

  test("player เป็น <iframe> (YouTube) → toggle ผ่าน src replace mute=0/1 และ data-muted", async () => {
    setupDom();
    stubSettings({ introVideos: [video({ url: "https://youtu.be/DDDDDDDDDDD" })] });
    const mod = await importFresh();
    await mod.renderIntroVideo();
    const player = wrap().querySelector(".vcar-player");
    const muteBtn = wrap().querySelector(".vcar-mute-toggle");
    assert.equal(muteBtn.dataset.muted, "1");
    assert.match(player.src, /mute=1/);
    muteBtn.dispatchEvent(new dom.window.Event("click", { bubbles: true }));
    assert.equal(muteBtn.dataset.muted, "0");
    assert.match(player.src, /mute=0/);
    muteBtn.dispatchEvent(new dom.window.Event("click", { bubbles: true }));
    assert.equal(muteBtn.dataset.muted, "1");
    assert.match(player.src, /mute=1/);
  });

  test("ไม่มีปุ่ม mute หรือไม่มี player (กรณี n=1 ไม่มีปัญหา เพราะ center player render เสมอ) → ไม่ throw", async () => {
    setupDom();
    stubSettings({ introVideos: [video({ url: "https://cdn.test/only.mp4" })] });
    const mod = await importFresh();
    await assert.doesNotReject(mod.renderIntroVideo());
  });
});

// =====================================================================
// seekToFrame(): การ์ดข้างๆ ที่ใช้ <video preload=auto> แทน poster
// =====================================================================
describe("renderIntroVideo() — seekToFrame ของการ์ดข้างๆ ที่ไม่มี poster", () => {
  test("readyState >= 2 อยู่แล้วตอน bind → seek ทันที (synchronous) ตามสูตร clamp(0.15, duration/6, 0.6)", async () => {
    setupDom();
    // แพตช์ HTMLMediaElement.prototype ก่อน import/render ให้ video ใหม่ทุกตัวรายงาน readyState=4
    Object.defineProperty(dom.window.HTMLMediaElement.prototype, "readyState", { value: 4, configurable: true });
    Object.defineProperty(dom.window.HTMLMediaElement.prototype, "duration", { value: 1, configurable: true });
    stubSettings({
      introVideos: [
        video({ url: "https://cdn.test/main.mp4" }),
        video({ url: "https://cdn.test/side.mp4" })
      ]
    });
    const mod = await importFresh();
    await mod.renderIntroVideo();
    const sideVideo = wrap().querySelector(".vcar-slide-media--video");
    // duration=1 → 1/6=0.1667, max(0.15, 0.1667)=0.1667, min(0.6, 0.1667)=0.1667
    assert.ok(Math.abs(sideVideo.currentTime - (1 / 6)) < 0.001);
  });

  test("readyState ยังไม่พร้อม (0) ตอน bind → รอ event loadeddata ก่อนค่อย seek", async () => {
    setupDom();
    stubSettings({
      introVideos: [
        video({ url: "https://cdn.test/main.mp4" }),
        video({ url: "https://cdn.test/side.mp4" })
      ]
    });
    const mod = await importFresh();
    await mod.renderIntroVideo();
    const sideVideo = wrap().querySelector(".vcar-slide-media--video");
    assert.equal(sideVideo.currentTime, 0, "ยังไม่ seek ก่อน loadeddata");
    Object.defineProperty(sideVideo, "duration", { value: 12, configurable: true });
    sideVideo.dispatchEvent(new dom.window.Event("loadeddata"));
    // duration=12 → 12/6=2, max(0.15,2)=2, min(0.6,2)=0.6 (ชนเพดานบน)
    assert.equal(sideVideo.currentTime, 0.6);
  });

  test("ไม่มีการ์ดข้างๆ ที่เป็น <video> เลย (ทุกตัวมี poster) → ไม่ throw ไม่มี seek เกิดขึ้น", async () => {
    setupDom();
    stubSettings({
      introVideos: [
        video({ url: "https://cdn.test/v1.mp4", poster: "https://cdn.test/p1.jpg" }),
        video({ url: "https://cdn.test/v2.mp4", poster: "https://cdn.test/p2.jpg" })
      ]
    });
    const mod = await importFresh();
    await assert.doesNotReject(mod.renderIntroVideo());
    assert.equal(wrap().querySelectorAll(".vcar-slide-media--video").length, 0);
  });
});

// =====================================================================
// vcarPosterUrl() ทางอ้อม: video.poster ชนะ YouTube-derived เสมอเมื่อมีทั้งคู่
// =====================================================================
describe("renderIntroVideo() — ลำดับความสำคัญของ poster", () => {
  test("มีทั้ง video.poster และเป็นลิงก์ YouTube → ใช้ video.poster ที่ตั้งเองก่อนเสมอ ไม่ derive จาก YouTube", async () => {
    setupDom();
    stubSettings({
      introVideos: [
        video({ url: "https://cdn.test/v1.mp4" }),
        video({ url: "https://youtu.be/EEEEEEEEEEE", poster: "https://cdn.test/custom-poster.jpg" })
      ]
    });
    const mod = await importFresh();
    await mod.renderIntroVideo();
    const side = wrap().querySelector(".vcar-slide--side");
    assert.match(side.innerHTML, /custom-poster\.jpg/);
    assert.ok(!side.innerHTML.includes("img.youtube.com"), "ต้องไม่ derive poster จาก YouTube เมื่อมี video.poster ตั้งเองอยู่แล้ว");
  });
});
