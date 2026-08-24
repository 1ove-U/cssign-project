// test/portfolio-lightbox-zoom.test.mjs — รอบที่ 141
//
// ขอบเขต: js/portfolio-lightbox-zoom.js (150 บรรทัด) — ซูม/แพน/พินช์รูปในป๊อปอัพรายละเอียดผลงาน
// (แยกออกมาจาก js/portfolio-lightbox.js เดิม): เลื่อนล้อเมาส์ซูม, ลากเพื่อเลื่อนภาพตอนซูมอยู่,
// ดับเบิลคลิกซูมเร็ว, ปุ่ม +/−/รีเซ็ต, คีย์ลัด (คีย์ลัดจริงอยู่ใน portfolio-lightbox.js — ไฟล์นี้แค่ export
// setZoom/resetZoom ให้เรียก), พินช์ซูมบนมือถือ
//
// circular import กับ js/portfolio-lightbox.js (ไฟล์นี้ import modal/imgEl/mediaEl/hintEl/zoomLevelEl
// กลับไปอ่าน — อีกไฟล์ import initZoomInteractions/resetZoom/setZoom/showHint/zoom/ZOOM_STEP กลับมา)
// — ต้องเปิด popup จริงผ่าน js/portfolio-lightbox.js ก่อน (คลิกการ์ด) เพื่อให้ bindRefs()/
// initZoomInteractions() ถูกเรียก และ modal มี class "show" (wheel/zoom-toolbar handler เช็คเงื่อนไขนี้)
// — เหมือนแพทเทิร์นที่ test/portfolio-lightbox.test.mjs (รอบ 140) ใช้อยู่แล้ว dynamic import ทั้ง
// 2 ไฟล์ตรงๆ ครั้งเดียวใน before() พอ ไม่ต้อง stub loader ใดๆ เพิ่ม (ไม่มี Firestore เกี่ยวข้องเลย)
//
// jsdom ไม่มี TouchEvent constructor ที่ใช้งานได้ตรงๆ — ใช้ window.Event ธรรมดาแล้วแปะ property
// `touches` เข้าไปเองก่อน dispatch (โค้ดจริงอ่าน e.touches ตรงๆ ไม่ได้เช็ค instanceof TouchEvent
// ที่ไหนเลย จึงใช้วิธีนี้ได้ปลอดภัย)
//
// อ่านครบทั้ง js/portfolio-lightbox-zoom.js (150 บรรทัด) + js/portfolio-lightbox.js (196 บรรทัด)
// ก่อนเขียนเทสตามธรรมเนียม — ไม่พบบั๊กในโค้ดจริง

import { test, describe, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

let document, window;
let lightboxMod; // js/portfolio-lightbox.js (modal/imgEl/mediaEl/hintEl/zoomLevelEl — live binding)
let zoomMod; // js/portfolio-lightbox-zoom.js (zoom/ZOOM_STEP/setZoom/resetZoom/showHint/initZoomInteractions)

function grid() { return document.getElementById("port-grid"); }
function mediaEl() { return lightboxMod.mediaEl; }
function imgEl() { return lightboxMod.imgEl; }
function zoomLevelEl() { return lightboxMod.zoomLevelEl; }
function hintEl() { return lightboxMod.hintEl; }
function modal() { return lightboxMod.modal; }

function cardHTML(id, images) {
  return `<div class="port-card" id="${id}" data-images='${JSON.stringify(images)}'>
    <img src="${images[0]}" class="port-photo">
    <div class="port-info"><h3>งานทดสอบ</h3></div>
  </div>`;
}

function click(el) {
  el.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
}

function openPopup() {
  grid().innerHTML = cardHTML("c1", ["a.jpg", "b.jpg"]);
  click(document.getElementById("c1"));
}

// stub คงที่สำหรับ mediaEl.getBoundingClientRect() เพื่อให้คำนวณ anchor-point/clampPan คาดผลได้แน่นอน
// (jsdom ไม่มี layout engine จริง — ปกติค่า default เป็น 0 ทั้งหมดซึ่งทำให้สูตร anchor-point หารด้วย 0)
function stubRect(el, { left = 100, top = 50, width = 200, height = 100 } = {}) {
  el.getBoundingClientRect = () => ({
    left, top, width, height, right: left + width, bottom: top + height,
  });
}

function touchEvent(type, touches, opts = {}) {
  const ev = new window.Event(type, { bubbles: true, cancelable: true, ...opts });
  ev.touches = touches;
  return ev;
}

before(async () => {
  const dom = new JSDOM(`<!doctype html><html><body>
    <div id="port-grid"></div>
  </body></html>`, { url: "https://example.test/portfolio.html" });
  window = dom.window;
  document = dom.window.document;
  globalThis.window = window;
  globalThis.document = document;
  Object.defineProperty(globalThis, "navigator", { value: window.navigator, configurable: true });
  globalThis.Event = window.Event;
  globalThis.MouseEvent = window.MouseEvent;
  globalThis.WheelEvent = window.WheelEvent;
  globalThis.KeyboardEvent = window.KeyboardEvent;

  lightboxMod = await import("../js/portfolio-lightbox.js");
  zoomMod = await import("../js/portfolio-lightbox-zoom.js");

  // เปิด popup ครั้งแรกเพื่อให้ bindRefs()/initZoomInteractions() ถูกเรียก (ผูก listener ครั้งเดียว
  // เพราะ initZoomInteractions() มี guard mediaEl.dataset.zoomBound กันผูกซ้ำ — ทำครั้งเดียวพอ)
  openPopup();
  stubRect(mediaEl());
});

beforeEach(() => {
  zoomMod.resetZoom();
  stubRect(mediaEl());
});

describe("ค่าคงที่ & state เริ่มต้น", () => {
  test("ZOOM_STEP = 0.5", () => {
    assert.equal(zoomMod.ZOOM_STEP, 0.5);
  });

  test("resetZoom() → zoom = {scale:1, x:0, y:0}", () => {
    zoomMod.setZoom(3);
    zoomMod.resetZoom();
    assert.equal(zoomMod.zoom.scale, 1);
    assert.equal(zoomMod.zoom.x, 0);
    assert.equal(zoomMod.zoom.y, 0);
  });
});

describe("setZoom() — ขอบเขต & applyZoom (transform/class/cursor/zoom-level text)", () => {
  test("clamp ขอบล่าง: setZoom(0) → scale เป็น 1 (ZOOM_MIN)", () => {
    zoomMod.setZoom(0);
    assert.equal(zoomMod.zoom.scale, 1);
  });

  test("clamp ขอบบน: setZoom(10) → scale เป็น 4 (ZOOM_MAX)", () => {
    zoomMod.setZoom(10);
    assert.equal(zoomMod.zoom.scale, 4);
  });

  test("scale <= 1.001 → x/y ถูกรีเซ็ตเป็น 0 เสมอ แม้ก่อนหน้าจะ pan ไว้", () => {
    zoomMod.setZoom(2, 250, 100); // pan ไปก่อน
    assert.notEqual(zoomMod.zoom.x, 0);
    zoomMod.setZoom(1);
    assert.equal(zoomMod.zoom.x, 0);
    assert.equal(zoomMod.zoom.y, 0);
  });

  test("applyZoom: imgEl.style.transform ตรงกับ x/y/scale ปัจจุบัน", () => {
    zoomMod.setZoom(2);
    assert.equal(imgEl().style.transform, `translate(${zoomMod.zoom.x}px,${zoomMod.zoom.y}px) scale(2)`);
  });

  test("applyZoom: scale > 1.001 → mediaEl มี class is-zoomed + cursor grab; scale <= 1.001 → ไม่มี class + cursor zoom-in", () => {
    zoomMod.setZoom(2);
    assert.equal(mediaEl().classList.contains("is-zoomed"), true);
    assert.equal(mediaEl().style.cursor, "grab");
    zoomMod.resetZoom();
    assert.equal(mediaEl().classList.contains("is-zoomed"), false);
    assert.equal(mediaEl().style.cursor, "zoom-in");
  });

  test("applyZoom: zoomLevelEl.textContent = Math.round(scale*100)+'%'", () => {
    zoomMod.setZoom(2.6);
    assert.equal(zoomLevelEl().textContent, "260%");
    zoomMod.resetZoom();
    assert.equal(zoomLevelEl().textContent, "100%");
  });

  test("setZoom(scale, cx, cy) — anchor-point คงที่ใต้เคอร์เซอร์ (สูตรคำนวณตรงตามโค้ดจริง)", () => {
    // rect: left=100, top=50, width=200, height=100 → center=(200,100)
    // cx=250, cy=100 → ox=50, oy=0 ; scale 1→2 (ratio=2)
    // zoom.x = (0-50)*2+50 = -50 ; clampPan: maxX = 200*(2-1)/(2*2) = 50 → clamp(-50,-50,50) = -50
    zoomMod.setZoom(2, 250, 100);
    assert.equal(zoomMod.zoom.x, -50);
    assert.equal(zoomMod.zoom.y, 0);
  });

  test("setZoom โดยไม่ส่ง cx/cy — ไม่คำนวณ anchor-point ใหม่ (x/y ไม่เปลี่ยนจากค่าปัจจุบัน นอกจาก clampPan)", () => {
    zoomMod.setZoom(2, 250, 100); // pan ไปที่ x=-50 ก่อน
    zoomMod.setZoom(2); // เรียกซ้ำ scale เดิม ไม่ส่ง cx/cy
    assert.equal(zoomMod.zoom.x, -50);
  });

  test("!mediaEl (ไม่มี element) → ไม่คำนวณ anchor-point แต่ไม่ throw (guard `if (mediaEl && ...)`)", () => {
    // จำลองด้วยการส่ง cx/cy ปกติ แต่ mediaEl มีอยู่จริงเสมอในสภาพแวดล้อมเทสนี้ (guard นี้ยากจะจำลอง
    // ตรงๆ โดยไม่แก้โค้ด — ยืนยันแค่ว่าเรียกด้วย cx/cy ปกติไม่ throw เป็น sanity check เส้นทางหลัก)
    assert.doesNotThrow(() => zoomMod.setZoom(3, 10, 10));
  });
});

describe("showHint() — แสดง hint + ซ่อนหลัง 2600ms + debounce เมื่อเรียกซ้อน", () => {
  test("เพิ่ม class 'show' ทันที แล้วหายไปหลัง 2600ms", (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    zoomMod.showHint();
    assert.equal(hintEl().classList.contains("show"), true);
    t.mock.timers.tick(2599);
    assert.equal(hintEl().classList.contains("show"), true);
    t.mock.timers.tick(1);
    assert.equal(hintEl().classList.contains("show"), false);
    t.mock.timers.reset();
  });

  test("เรียกซ้อนกัน → clearTimeout ตัวเก่าทิ้ง นับเวลาใหม่จากครั้งหลังสุด", (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    zoomMod.showHint();
    t.mock.timers.tick(1000);
    zoomMod.showHint(); // รีเซ็ตตัวจับเวลาใหม่ตรงนี้
    t.mock.timers.tick(2599);
    assert.equal(hintEl().classList.contains("show"), true, "ยังไม่ครบ 2600ms นับจากครั้งหลังสุด");
    t.mock.timers.tick(1);
    assert.equal(hintEl().classList.contains("show"), false);
    t.mock.timers.reset();
  });
});

describe("initZoomInteractions() — wheel", () => {
  test("modal ไม่มี class 'show' → wheel ไม่ทำอะไร", () => {
    modal().classList.remove("show");
    mediaEl().dispatchEvent(new window.WheelEvent("wheel", { deltaY: -100, clientX: 200, clientY: 100, bubbles: true, cancelable: true }));
    assert.equal(zoomMod.zoom.scale, 1);
    modal().classList.add("show"); // คืนสถานะให้เทสถัดไป
  });

  test("deltaY < 0 (เลื่อนขึ้น) → ซูมเข้าเพิ่ม ZOOM_STEP", () => {
    mediaEl().dispatchEvent(new window.WheelEvent("wheel", { deltaY: -100, clientX: 200, clientY: 100, bubbles: true, cancelable: true }));
    assert.equal(zoomMod.zoom.scale, 1 + zoomMod.ZOOM_STEP);
  });

  test("deltaY > 0 (เลื่อนลง) → ซูมออกลด ZOOM_STEP", () => {
    zoomMod.setZoom(2);
    mediaEl().dispatchEvent(new window.WheelEvent("wheel", { deltaY: 100, clientX: 200, clientY: 100, bubbles: true, cancelable: true }));
    assert.equal(zoomMod.zoom.scale, 2 - zoomMod.ZOOM_STEP);
  });
});

describe("initZoomInteractions() — ดับเบิลคลิก (dblclick บน imgEl)", () => {
  test("scale <= 1.001 → ดับเบิลคลิก setZoom(2.6, cx, cy)", () => {
    imgEl().dispatchEvent(new window.MouseEvent("dblclick", { clientX: 250, clientY: 100, bubbles: true, cancelable: true }));
    assert.equal(zoomMod.zoom.scale, 2.6);
  });

  test("scale > 1.001 → ดับเบิลคลิก resetZoom()", () => {
    zoomMod.setZoom(3);
    imgEl().dispatchEvent(new window.MouseEvent("dblclick", { clientX: 250, clientY: 100, bubbles: true, cancelable: true }));
    assert.equal(zoomMod.zoom.scale, 1);
  });
});

describe("initZoomInteractions() — ลากด้วยเมาส์ (mousedown/mousemove/mouseup)", () => {
  function mouse(type, el, opts) {
    el.dispatchEvent(new window.MouseEvent(type, { bubbles: true, cancelable: true, ...opts }));
  }

  test("scale <= 1.001 (ยังไม่ซูม) → mousedown ไม่เริ่มลาก (mousemove ไม่เปลี่ยน zoom.x/y)", () => {
    mouse("mousedown", mediaEl(), { clientX: 200, clientY: 100, button: 0 });
    mouse("mousemove", window.document, { clientX: 260, clientY: 100 });
    assert.equal(zoomMod.zoom.x, 0);
    mouse("mouseup", window.document);
  });

  test("button !== 0 (ไม่ใช่คลิกซ้าย) → ไม่เริ่มลากแม้ซูมอยู่", () => {
    zoomMod.setZoom(2);
    mouse("mousedown", mediaEl(), { clientX: 200, clientY: 100, button: 2 });
    mouse("mousemove", window.document, { clientX: 260, clientY: 100 });
    assert.equal(mediaEl().classList.contains("is-dragging"), false);
  });

  test("ซูมอยู่ (scale > 1.001) + คลิกซ้าย → เริ่มลาก (class is-dragging), mousemove เลื่อนภาพตามระยะลาก, mouseup จบลาก", () => {
    zoomMod.setZoom(2); // x=0,y=0 (ไม่ส่ง cx/cy)
    mouse("mousedown", mediaEl(), { clientX: 200, clientY: 100, button: 0 });
    assert.equal(mediaEl().classList.contains("is-dragging"), true);
    mouse("mousemove", window.document, { clientX: 220, clientY: 110 }); // เลื่อนไป +20,+10 จากจุดเริ่ม
    // clampPan: maxX = 200*(2-1)/(2*2) = 50, maxY = 100*1/4 = 25 → +20/+10 อยู่ในขอบเขตไม่ถูก clamp
    assert.equal(zoomMod.zoom.x, 20);
    assert.equal(zoomMod.zoom.y, 10);
    mouse("mouseup", window.document);
    assert.equal(mediaEl().classList.contains("is-dragging"), false);
  });

  test("ลากเกินขอบเขต clampPan → ถูกจำกัดไม่ให้เลื่อนเกิน maxX/maxY", () => {
    zoomMod.setZoom(2);
    mouse("mousedown", mediaEl(), { clientX: 200, clientY: 100, button: 0 });
    mouse("mousemove", window.document, { clientX: 500, clientY: 500 }); // เลื่อนเกินขอบเยอะ
    assert.equal(zoomMod.zoom.x, 50); // maxX = 50
    assert.equal(zoomMod.zoom.y, 25); // maxY = 25
    mouse("mouseup", window.document);
  });

  test("mousemove ตอนไม่ได้ลากอยู่ (drag.active=false) → ไม่ทำอะไร ไม่ throw", () => {
    assert.doesNotThrow(() => mouse("mousemove", window.document, { clientX: 999, clientY: 999 }));
  });

  test("mouseup ตอนไม่ได้ลากอยู่ → ไม่ throw ไม่มีผลอะไร", () => {
    assert.doesNotThrow(() => mouse("mouseup", window.document));
  });
});

describe("initZoomInteractions() — พินช์ซูม/ลากด้วยนิ้ว (touchstart/touchmove/touchend)", () => {
  test("2 นิ้วแตะ → เริ่ม pinch (pinch.active) ไม่กระทบ zoom.scale ทันที", () => {
    zoomMod.resetZoom();
    mediaEl().dispatchEvent(touchEvent("touchstart", [
      { clientX: 150, clientY: 100 },
      { clientX: 250, clientY: 100 },
    ]));
    assert.equal(zoomMod.zoom.scale, 1); // ยังไม่เปลี่ยนจนกว่าจะ touchmove
    mediaEl().dispatchEvent(touchEvent("touchend", []));
  });

  test("touchmove 2 นิ้วระหว่าง pinch → setZoom ตามอัตราส่วนระยะห่างนิ้ว (dist/startDist) คูณ startScale", () => {
    zoomMod.resetZoom();
    // startDist ระหว่าง (150,100)-(250,100) = 100
    mediaEl().dispatchEvent(touchEvent("touchstart", [
      { clientX: 150, clientY: 100 },
      { clientX: 250, clientY: 100 },
    ]));
    // ขยับนิ้วให้ห่างเป็น 200 (dist/startDist = 2) → scale = startScale(1) * 2 = 2
    mediaEl().dispatchEvent(touchEvent("touchmove", [
      { clientX: 100, clientY: 100 },
      { clientX: 300, clientY: 100 },
    ]));
    assert.equal(zoomMod.zoom.scale, 2);
    mediaEl().dispatchEvent(touchEvent("touchend", []));
  });

  test("touchend เหลือนิ้วน้อยกว่า 2 → pinch.active=false (touchmove ครั้งถัดไปไม่ setZoom ต่อผ่าน pinch path)", () => {
    zoomMod.resetZoom();
    mediaEl().dispatchEvent(touchEvent("touchstart", [
      { clientX: 150, clientY: 100 },
      { clientX: 250, clientY: 100 },
    ]));
    mediaEl().dispatchEvent(touchEvent("touchend", [{ clientX: 150, clientY: 100 }])); // เหลือ 1 นิ้ว → pinch จบ
    const scaleBefore = zoomMod.zoom.scale;
    mediaEl().dispatchEvent(touchEvent("touchmove", [
      { clientX: 100, clientY: 100 },
      { clientX: 300, clientY: 100 },
    ]));
    assert.equal(zoomMod.zoom.scale, scaleBefore, "touchmove 2 นิ้วหลัง pinch จบไปแล้ว ต้องไม่เปลี่ยน scale อีก");
  });

  test("1 นิ้วแตะตอนซูมอยู่ (scale > 1.001) → เริ่มลากด้วยนิ้ว, touchmove เลื่อนภาพ, touchend (0 นิ้ว) จบลาก", () => {
    zoomMod.setZoom(2);
    mediaEl().dispatchEvent(touchEvent("touchstart", [{ clientX: 200, clientY: 100 }]));
    mediaEl().dispatchEvent(touchEvent("touchmove", [{ clientX: 220, clientY: 110 }]));
    assert.equal(zoomMod.zoom.x, 20);
    assert.equal(zoomMod.zoom.y, 10);
    mediaEl().dispatchEvent(touchEvent("touchend", []));
  });

  test("1 นิ้วแตะตอนยังไม่ซูม (scale <= 1.001) → ไม่เริ่มลาก (touchmove ไม่เปลี่ยน x/y)", () => {
    zoomMod.resetZoom();
    mediaEl().dispatchEvent(touchEvent("touchstart", [{ clientX: 200, clientY: 100 }]));
    mediaEl().dispatchEvent(touchEvent("touchmove", [{ clientX: 260, clientY: 160 }]));
    assert.equal(zoomMod.zoom.x, 0);
    assert.equal(zoomMod.zoom.y, 0);
  });
});

describe("initZoomInteractions() — ปุ่มซูม toolbar (document click delegation, .pf-zoom-btn)", () => {
  test("modal ไม่มี class 'show' → คลิกปุ่มซูมไม่ทำอะไร", () => {
    modal().classList.remove("show");
    zoomMod.resetZoom();
    click(document.querySelector('.pf-zoom-btn[data-zoom-action="in"]'));
    assert.equal(zoomMod.zoom.scale, 1);
    modal().classList.add("show");
  });

  test("data-zoom-action='in' → setZoom(scale + ZOOM_STEP)", () => {
    zoomMod.resetZoom();
    click(document.querySelector('.pf-zoom-btn[data-zoom-action="in"]'));
    assert.equal(zoomMod.zoom.scale, 1 + zoomMod.ZOOM_STEP);
  });

  test("data-zoom-action='out' → setZoom(scale - ZOOM_STEP)", () => {
    zoomMod.setZoom(2);
    click(document.querySelector('.pf-zoom-btn[data-zoom-action="out"]'));
    assert.equal(zoomMod.zoom.scale, 2 - zoomMod.ZOOM_STEP);
  });

  test("data-zoom-action='reset' → resetZoom()", () => {
    zoomMod.setZoom(3);
    click(document.querySelector('.pf-zoom-btn[data-zoom-action="reset"]'));
    assert.equal(zoomMod.zoom.scale, 1);
  });

  test("คลิกที่ไม่ใช่ .pf-zoom-btn เลย → ไม่ throw ไม่มีผลอะไร", () => {
    zoomMod.resetZoom();
    assert.doesNotThrow(() => click(document.querySelector(".pf-detail-box")));
    assert.equal(zoomMod.zoom.scale, 1);
  });
});

describe("initZoomInteractions() — เรียกซ้ำ (idempotent guard mediaEl.dataset.zoomBound)", () => {
  test("เรียก initZoomInteractions() ซ้ำอีกครั้ง → ไม่ผูก listener ซ้ำ (wheel ครั้งเดียวยังขยับแค่ 1 step)", () => {
    zoomMod.resetZoom();
    zoomMod.initZoomInteractions(); // เรียกซ้ำตรงๆ
    zoomMod.initZoomInteractions();
    mediaEl().dispatchEvent(new window.WheelEvent("wheel", { deltaY: -100, clientX: 200, clientY: 100, bubbles: true, cancelable: true }));
    assert.equal(zoomMod.zoom.scale, 1 + zoomMod.ZOOM_STEP, "ถ้าผูกซ้ำ scale จะขยับมากกว่า 1 step");
  });
});
