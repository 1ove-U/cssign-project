// test/portfolio-lightbox.test.mjs — รอบที่ 140
//
// ขอบเขต: js/portfolio-lightbox.js (196 บรรทัด) — popup รายละเอียดผลงาน: คลิกที่การ์ดผลงาน
// (.port-card) ที่ไหนก็ได้เพื่อเปิดดูรายละเอียดเต็ม + รูปภาพทั้งหมด — ทำงานได้ทั้งการ์ดตัวอย่าง
// (เขียนในหน้า HTML) และการ์ดที่ portfolio-render.js สร้างจากข้อมูลแอดมิน
//
// ไฟล์นี้เป็น IIFE (ไม่มี export function ให้เรียกตรงๆ ยกเว้นตัวแปร `export var modal, imgEl,
// mediaEl, hintEl, zoomLevelEl` ที่ reassign เอง) — สร้าง <div class="pf-detail-overlay"> ตอน
// module evaluate ทันที (ไม่รอ DOMContentLoaded ถ้า document.readyState เป็น "interactive"/
// "complete" อยู่แล้ว — jsdom ปกติ readyState เป็น "complete" หลังโหลดเสร็จ) แล้วผูก listener
// click/keydown บน document เอง — ทดสอบผ่าน side-effect บน DOM เท่านั้น (คลิกการ์ดจริง/คลิกปุ่ม
// จริง/กด key จริง) เหมือนแพทเทิร์น js/product-schema.js (รอบ 137)/js/products-filters.js
// (รอบ 139) ที่เป็น top-level DOM query ตอน evaluate
//
// circular import กับ js/portfolio-lightbox-zoom.js (import initZoomInteractions/resetZoom/
// setZoom/showHint/zoom/ZOOM_STEP กลับมา, portfolio-lightbox-zoom.js import modal/imgEl/mediaEl/
// hintEl/zoomLevelEl กลับไป) — dynamic import(".../portfolio-lightbox.js") ตรงๆ ครั้งเดียวใน
// before() พอ (เหมือน admin-groups.test.mjs) เพราะไม่มี Firestore/admin-page.js ให้ต้อง stub เลย
// สักจุด (ไฟล์นี้ไม่ import จากไฟล์ business-logic ใดๆ นอกจาก portfolio-lightbox-zoom.js เอง)
//
// อ่านครบทั้ง js/portfolio-lightbox.js (196 บรรทัด) + js/portfolio-lightbox-zoom.js (150 บรรทัด)
// ก่อนเขียนเทสตามธรรมเนียม — ไม่พบบั๊กในโค้ดจริง

import { test, describe, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

let document, window;
let mod; // portfolio-lightbox.js exports (modal/imgEl/mediaEl/hintEl/zoomLevelEl — live binding)
let zoomMod; // portfolio-lightbox-zoom.js exports (zoom/ZOOM_STEP/setZoom/resetZoom)

function overlay() { return document.getElementById("pf-detail-overlay"); }
function grid() { return document.getElementById("port-grid"); }

function cardHTML({ id, title = "โครงการทดสอบ", client = "", badge = "", desc = "", tags = [], images = [], zoomBtn = false } = {}) {
  const imgsAttr = JSON.stringify(images).replace(/'/g, "&#39;");
  const photo = images.length ? `<img src="${images[0]}" alt="" class="port-photo">` : "";
  const tagsHtml = tags.length ? `<div class="port-tags">${tags.map(t => `<span>${t}</span>`).join("")}</div>` : "";
  return `
    <div class="port-card" id="${id}" data-images='${imgsAttr}'>
      ${zoomBtn ? '<button type="button" class="port-zoom-btn">zoom</button>' : ""}
      ${photo}
      <div class="port-badge">${badge}</div>
      <div class="port-info">
        ${client ? `<div class="port-client">${client}</div>` : ""}
        <h3>${title}</h3>
        <p>${desc}</p>
        ${tagsHtml}
      </div>
      <a href="#link">ลิงก์ใน card</a>
    </div>`;
}

before(async () => {
  const dom = new JSDOM(`<!doctype html><html><body>
    <div id="port-grid"></div>
    <div id="qm-msg-holder"><textarea id="qm-msg"></textarea></div>
  </body></html>`, { url: "https://example.test/portfolio.html" });
  window = dom.window;
  document = dom.window.document;
  globalThis.window = window;
  globalThis.document = document;
  Object.defineProperty(globalThis, "navigator", { value: window.navigator, configurable: true });
  globalThis.Event = window.Event;
  globalThis.MouseEvent = window.MouseEvent;
  globalThis.KeyboardEvent = window.KeyboardEvent;

  mod = await import("../js/portfolio-lightbox.js");
  zoomMod = await import("../js/portfolio-lightbox-zoom.js");
});

beforeEach(() => {
  grid().innerHTML = "";
  overlay().classList.remove("show");
  document.body.style.overflow = "";
  zoomMod.resetZoom();
  window.openModal = undefined;
});

function click(el) {
  el.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
}

describe("สร้าง modal ตอนโหลดไฟล์ (module evaluate)", () => {
  test("แทรก #pf-detail-overlay เข้า body ครั้งเดียว มี role=dialog/aria-modal", () => {
    assert.ok(overlay());
    assert.equal(overlay().getAttribute("role"), "dialog");
    assert.equal(overlay().getAttribute("aria-modal"), "true");
    assert.equal(document.querySelectorAll("#pf-detail-overlay").length, 1);
  });

  test("export modal/imgEl/mediaEl/hintEl/zoomLevelEl อ้างอิง element จริงใน overlay หลัง bindRefs (ผ่าน openFromCard)", () => {
    grid().innerHTML = cardHTML({ id: "c1", images: ["a.jpg"] });
    click(document.getElementById("c1"));
    assert.equal(mod.imgEl, document.getElementById("pf-detail-img"));
    assert.equal(mod.mediaEl, document.getElementById("pf-detail-media"));
    assert.equal(mod.hintEl, document.getElementById("pf-detail-hint"));
    assert.equal(mod.zoomLevelEl, document.getElementById("pf-zoom-level"));
    assert.equal(mod.modal, overlay());
  });
});

describe("คลิกการ์ด → เปิด popup (openFromCard)", () => {
  test("การ์ดไม่มีรูปเลย (data-images ว่างเปล่า, ไม่มี .port-photo) → ไม่เปิด popup", () => {
    grid().innerHTML = cardHTML({ id: "c1", images: [] });
    click(document.getElementById("c1"));
    assert.equal(overlay().classList.contains("show"), false);
  });

  test("มีรูปครบ → เปิด popup, เติมข้อมูลจากการ์ดถูกต้อง (title/client/badge/desc/tags)", () => {
    grid().innerHTML = cardHTML({
      id: "c1", title: "ป้ายบริษัท ABC", client: "บริษัท ABC", badge: "ป้ายไฟ",
      desc: "รายละเอียดงาน", tags: ["ป้าย", "ไฟ LED"], images: ["a.jpg", "b.jpg"],
    });
    click(document.getElementById("c1"));
    assert.equal(overlay().classList.contains("show"), true);
    assert.equal(document.body.style.overflow, "hidden");
    assert.equal(document.getElementById("pf-detail-title").textContent, "ป้ายบริษัท ABC");
    assert.equal(document.getElementById("pf-detail-client").textContent, "บริษัท ABC");
    assert.equal(document.getElementById("pf-detail-client").style.display, "");
    assert.equal(document.getElementById("pf-detail-badge").textContent, "ป้ายไฟ");
    assert.equal(document.getElementById("pf-detail-desc").textContent, "รายละเอียดงาน");
    const tagSpans = document.getElementById("pf-detail-tags").querySelectorAll("span");
    assert.equal(tagSpans.length, 2);
    assert.equal(tagSpans[0].textContent, "ป้าย");
    assert.equal(tagSpans[1].textContent, "ไฟ LED");
  });

  test("ไม่มี client/badge/desc/tags → element ที่เกี่ยวข้องถูกซ่อน (display:none)", () => {
    grid().innerHTML = cardHTML({ id: "c1", images: ["a.jpg"] });
    click(document.getElementById("c1"));
    assert.equal(document.getElementById("pf-detail-client").style.display, "none");
    assert.equal(document.getElementById("pf-detail-badge").style.display, "none");
    assert.equal(document.getElementById("pf-detail-desc").style.display, "none");
    assert.equal(document.getElementById("pf-detail-tags").style.display, "none");
  });

  test("ไม่มีชื่อ (ไม่มี <h3>) → fallback เป็น 'ผลงาน'", () => {
    grid().innerHTML = `<div class="port-card" id="c1" data-images='["a.jpg"]'></div>`;
    click(document.getElementById("c1"));
    assert.equal(document.getElementById("pf-detail-title").textContent, "ผลงาน");
  });

  test("data-images มี JSON เสีย (parse ไม่ผ่าน) → fallback หา .port-photo แทน ไม่ throw", () => {
    grid().innerHTML = `
      <div class="port-card" id="c1" data-images="not-json">
        <img src="fallback.jpg" class="port-photo">
        <div class="port-info"><h3>งานทดสอบ</h3></div>
      </div>`;
    assert.doesNotThrow(() => click(document.getElementById("c1")));
    assert.equal(overlay().classList.contains("show"), true);
    assert.equal(document.getElementById("pf-detail-img").src, "https://example.test/fallback.jpg");
  });

  test("คลิกที่ปุ่ม/ลิงก์ในการ์ด (ไม่ใช่ตัวการ์ดตรงๆ) → ไม่เปิด popup", () => {
    grid().innerHTML = cardHTML({ id: "c1", images: ["a.jpg"], zoomBtn: false });
    click(document.querySelector("#c1 a"));
    assert.equal(overlay().classList.contains("show"), false);
  });

  test("คลิกปุ่ม .port-zoom-btn ในการ์ด → เปิด popup เหมือนคลิกการ์ด (ผ่าน closest('.port-card'))", () => {
    grid().innerHTML = cardHTML({ id: "c1", images: ["a.jpg", "b.jpg"], zoomBtn: true });
    click(document.querySelector("#c1 .port-zoom-btn"));
    assert.equal(overlay().classList.contains("show"), true);
  });

  test("รูปเดียว → thumbnails ซ่อน, ไม่มี counter, modal ไม่มี class pf-multi", () => {
    grid().innerHTML = cardHTML({ id: "c1", images: ["a.jpg"] });
    click(document.getElementById("c1"));
    assert.equal(document.getElementById("pf-detail-thumbs").style.display, "none");
    assert.equal(document.getElementById("pf-detail-counter").textContent, "");
    assert.equal(overlay().classList.contains("pf-multi"), false);
  });

  test("หลายรูป → thumbnails แสดงครบ (ปุ่มแรก active), counter '1 / N', modal มี class pf-multi", () => {
    grid().innerHTML = cardHTML({ id: "c1", images: ["a.jpg", "b.jpg", "c.jpg"] });
    click(document.getElementById("c1"));
    const thumbs = document.querySelectorAll("#pf-detail-thumbs .pf-detail-thumb");
    assert.equal(thumbs.length, 3);
    assert.equal(thumbs[0].classList.contains("active"), true);
    assert.equal(thumbs[1].classList.contains("active"), false);
    assert.equal(document.getElementById("pf-detail-counter").textContent, "1 / 3");
    assert.equal(overlay().classList.contains("pf-multi"), true);
    assert.equal(document.getElementById("pf-detail-img").alt, "โครงการทดสอบ รูปที่ 1");
  });
});

describe("เลื่อนรูป (showImage ผ่าน nav/thumbnail/keyboard)", () => {
  beforeEach(() => {
    grid().innerHTML = cardHTML({ id: "c1", images: ["a.jpg", "b.jpg", "c.jpg"] });
    click(document.getElementById("c1"));
  });

  test("ปุ่มถัดไป (.pf-detail-nav.next) → รูปที่ 2, วนกลับรูปแรกเมื่อเลยรูปสุดท้าย", () => {
    click(document.querySelector(".pf-detail-nav.next"));
    assert.equal(document.getElementById("pf-detail-counter").textContent, "2 / 3");
    click(document.querySelector(".pf-detail-nav.next"));
    click(document.querySelector(".pf-detail-nav.next"));
    assert.equal(document.getElementById("pf-detail-counter").textContent, "1 / 3");
  });

  test("ปุ่มก่อนหน้า (.pf-detail-nav.prev) จากรูปแรก → วนไปรูปสุดท้าย", () => {
    click(document.querySelector(".pf-detail-nav.prev"));
    assert.equal(document.getElementById("pf-detail-counter").textContent, "3 / 3");
  });

  test("คลิก thumbnail ตัวที่ 3 → สลับไปรูปนั้น + active ย้ายถูกจุด", () => {
    const thumbs = document.querySelectorAll("#pf-detail-thumbs .pf-detail-thumb");
    click(thumbs[2]);
    assert.equal(document.getElementById("pf-detail-counter").textContent, "3 / 3");
    assert.equal(thumbs[2].classList.contains("active"), true);
    assert.equal(thumbs[0].classList.contains("active"), false);
  });

  test("แต่ละครั้งที่เปลี่ยนรูป → resetZoom() ถูกเรียกจริง (zoom.scale กลับเป็น 1)", () => {
    zoomMod.setZoom(2.5);
    assert.equal(zoomMod.zoom.scale, 2.5);
    click(document.querySelector(".pf-detail-nav.next"));
    assert.equal(zoomMod.zoom.scale, 1);
  });
});

describe("ปิด popup", () => {
  beforeEach(() => {
    grid().innerHTML = cardHTML({ id: "c1", images: ["a.jpg"] });
    click(document.getElementById("c1"));
  });

  test("คลิกปุ่มปิด (.pf-detail-close) → ปิด popup, คืน overflow, resetZoom", () => {
    zoomMod.setZoom(2);
    click(document.querySelector(".pf-detail-close"));
    assert.equal(overlay().classList.contains("show"), false);
    assert.equal(document.body.style.overflow, "");
    assert.equal(zoomMod.zoom.scale, 1);
  });

  test("คลิก backdrop (target === modal เอง) → ปิด popup", () => {
    click(overlay());
    assert.equal(overlay().classList.contains("show"), false);
  });

  test("คลิกข้างในกล่อง (.pf-detail-box) แต่ไม่ใช่ปุ่มปิด/backdrop → ไม่ปิด", () => {
    click(document.querySelector(".pf-detail-box"));
    assert.equal(overlay().classList.contains("show"), true);
  });
});

describe("ปุ่ม 'ขอใบเสนอราคาแบบนี้' (#pf-detail-cta)", () => {
  test("ปิด popup ก่อนเสมอ แม้ไม่มี window.openModal", () => {
    grid().innerHTML = cardHTML({ id: "c1", title: "งาน A", images: ["a.jpg"] });
    click(document.getElementById("c1"));
    window.openModal = undefined;
    assert.doesNotThrow(() => click(document.getElementById("pf-detail-cta")));
    assert.equal(overlay().classList.contains("show"), false);
  });

  test("มี window.openModal('form') → ถูกเรียก แล้วเติมข้อความใน #qm-msg หลัง 80ms (ถ้าว่าง)", async () => {
    grid().innerHTML = cardHTML({ id: "c1", title: "ป้ายไฟหน้าร้าน", client: "ร้าน X", images: ["a.jpg"] });
    click(document.getElementById("c1"));
    let calledWith = null;
    window.openModal = (v) => { calledWith = v; };
    document.getElementById("qm-msg").value = "";
    click(document.getElementById("pf-detail-cta"));
    assert.equal(calledWith, "form");
    await new Promise((r) => setTimeout(r, 120));
    const val = document.getElementById("qm-msg").value;
    assert.match(val, /ป้ายไฟหน้าร้าน/);
    assert.match(val, /ร้าน X/);
  });

  test("#qm-msg มีข้อความอยู่แล้ว (ไม่ว่าง) → ไม่เขียนทับ", async () => {
    grid().innerHTML = cardHTML({ id: "c1", title: "งาน B", images: ["a.jpg"] });
    click(document.getElementById("c1"));
    window.openModal = () => {};
    document.getElementById("qm-msg").value = "ข้อความเดิมของผู้ใช้";
    click(document.getElementById("pf-detail-cta"));
    await new Promise((r) => setTimeout(r, 120));
    assert.equal(document.getElementById("qm-msg").value, "ข้อความเดิมของผู้ใช้");
  });
});

describe("คีย์บอร์ด (keydown บน document)", () => {
  beforeEach(() => {
    grid().innerHTML = cardHTML({ id: "c1", images: ["a.jpg", "b.jpg"] });
  });

  function key(k) {
    document.dispatchEvent(new window.KeyboardEvent("keydown", { key: k, bubbles: true }));
  }

  test("popup ปิดอยู่ (ไม่มี class show) → คีย์ทุกตัวไม่ทำอะไรเลย ไม่ throw", () => {
    assert.doesNotThrow(() => key("Escape"));
    assert.equal(overlay().classList.contains("show"), false);
  });

  test("Escape ตอนเปิดอยู่ → ปิด popup", () => {
    click(document.getElementById("c1"));
    key("Escape");
    assert.equal(overlay().classList.contains("show"), false);
  });

  test("ArrowRight/ArrowLeft ตอน zoom.scale<=1 → เปลี่ยนรูป", () => {
    click(document.getElementById("c1"));
    key("ArrowRight");
    assert.equal(document.getElementById("pf-detail-counter").textContent, "2 / 2");
    key("ArrowLeft");
    assert.equal(document.getElementById("pf-detail-counter").textContent, "1 / 2");
  });

  test("ArrowRight/ArrowLeft ตอนซูมอยู่ (scale > 1) → ไม่เปลี่ยนรูป", () => {
    click(document.getElementById("c1"));
    zoomMod.setZoom(2);
    key("ArrowRight");
    assert.equal(document.getElementById("pf-detail-counter").textContent, "1 / 2");
  });

  test("'+'/'=' เพิ่มซูม, '-'/'_' ลดซูม, '0' รีเซ็ตซูม", () => {
    click(document.getElementById("c1"));
    key("+");
    assert.equal(zoomMod.zoom.scale, 1 + zoomMod.ZOOM_STEP);
    key("-");
    assert.equal(zoomMod.zoom.scale, 1);
    zoomMod.setZoom(3);
    key("0");
    assert.equal(zoomMod.zoom.scale, 1);
  });
});
