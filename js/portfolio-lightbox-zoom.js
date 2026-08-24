// ===========================================================
// js/portfolio-lightbox-zoom.js — ซูม/แพน/พินช์รูปในป๊อปอัพรายละเอียดผลงาน
// (js/portfolio-lightbox.js): เลื่อนล้อเมาส์ซูม, ลากเพื่อเลื่อนภาพตอนซูมอยู่,
// ดับเบิลคลิกซูมเร็ว, ปุ่ม +/− /รีเซ็ต, คีย์ลัด, พินช์ซูมบนมือถือ
//
// 2026 refactor phase 20: แยกออกจาก js/portfolio-lightbox.js เดิม (342 บรรทัด)
// แบบไม่เปลี่ยน logic ใดๆ — ย้าย ZOOM_MIN/MAX/STEP, zoom/drag/pinch state,
// hintTimer, clamp/clampPan/applyZoom/setZoom/resetZoom/showHint/touchDist/
// initZoomInteractions ออกมาทั้งหมดแบบ diff เป๊ะ
//
// import mediaEl/imgEl/hintEl/zoomLevelEl/modal กลับจาก js/portfolio-lightbox.js
// (ไฟล์นั้นเป็นเจ้าของ ตั้งค่าใน bindRefs()/ตอนสร้าง modal — เขียนทับเฉพาะฝั่งนั้น
// ไฟล์นี้ import มาอ่านอย่างเดียวผ่าน ES module live binding ไม่ต้องมี setter)
// export zoom (object, อ่าน/เขียน property ตรงๆ ได้เพราะ reference เดียวกัน ไม่ใช่
// การ reassign ตัวแปรทั้งตัว), ZOOM_STEP, setZoom()/resetZoom()/showHint()/
// initZoomInteractions() ให้ portfolio-lightbox.js เรียกใช้ — circular import
// ระหว่าง 2 ไฟล์นี้โดยตั้งใจ (เหมือน orders-tab.js ↔ orders-tab-modal.js ที่มี
// อยู่แล้วในโปรเจกต์นี้) ใช้ได้ปกติเพราะทุกจุดที่เรียกใช้ข้ามไฟล์เป็นการเรียกภายใน
// ฟังก์ชัน/event handler ไม่ใช่ตอน module ประเมินค่า
// ===========================================================
import { modal, imgEl, mediaEl, hintEl, zoomLevelEl } from "./portfolio-lightbox.js";

/* ── Zoom & pan — scroll to zoom, drag/pinch to pan, dblclick to
   toggle, +/− buttons, keyboard shortcuts. Pure transform on the
   <img>; .pf-detail-media keeps overflow hidden so it never spills
   over the rounded modal corners. ── */
var ZOOM_MIN = 1, ZOOM_MAX = 4;
export var ZOOM_STEP = 0.5;
export var zoom = { scale: 1, x: 0, y: 0 };
var drag = { active: false, startX: 0, startY: 0, origX: 0, origY: 0 };
var pinch = { active: false, startDist: 0, startScale: 1 };
var hintTimer = null;

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

function clampPan() {
  if (!mediaEl) return;
  if (zoom.scale <= 1) { zoom.x = 0; zoom.y = 0; return; }
  var rect = mediaEl.getBoundingClientRect();
  var maxX = (rect.width * (zoom.scale - 1)) / (2 * zoom.scale);
  var maxY = (rect.height * (zoom.scale - 1)) / (2 * zoom.scale);
  zoom.x = clamp(zoom.x, -maxX, maxX);
  zoom.y = clamp(zoom.y, -maxY, maxY);
}

function applyZoom() {
  if (!imgEl) return;
  imgEl.style.transform = "translate(" + zoom.x + "px," + zoom.y + "px) scale(" + zoom.scale + ")";
  if (mediaEl) {
    mediaEl.classList.toggle("is-zoomed", zoom.scale > 1.001);
    mediaEl.style.cursor = zoom.scale > 1.001 ? "grab" : "zoom-in";
  }
  if (zoomLevelEl) zoomLevelEl.textContent = Math.round(zoom.scale * 100) + "%";
}

export function setZoom(scale, cx, cy) {
  var prev = zoom.scale;
  scale = clamp(scale, ZOOM_MIN, ZOOM_MAX);
  if (mediaEl && typeof cx === "number") {
    // keep the point under the cursor/finger stable while scale changes
    var rect = mediaEl.getBoundingClientRect();
    var ox = cx - (rect.left + rect.width / 2);
    var oy = cy - (rect.top + rect.height / 2);
    var ratio = scale / prev;
    zoom.x = (zoom.x - ox) * ratio + ox;
    zoom.y = (zoom.y - oy) * ratio + oy;
  }
  zoom.scale = scale;
  if (scale <= 1.001) { zoom.x = 0; zoom.y = 0; }
  clampPan();
  applyZoom();
}

export function resetZoom() {
  zoom.scale = 1; zoom.x = 0; zoom.y = 0;
  applyZoom();
}

export function showHint() {
  if (!hintEl) return;
  hintEl.classList.add("show");
  window.clearTimeout(hintTimer);
  hintTimer = window.setTimeout(function () { hintEl.classList.remove("show"); }, 2600);
}

function touchDist(touches) {
  var dx = touches[0].clientX - touches[1].clientX;
  var dy = touches[0].clientY - touches[1].clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

export function initZoomInteractions() {
  if (!mediaEl || mediaEl.dataset.zoomBound) return;
  mediaEl.dataset.zoomBound = "1";

  mediaEl.addEventListener("wheel", function (e) {
    if (!modal.classList.contains("show")) return;
    e.preventDefault();
    var dir = e.deltaY < 0 ? 1 : -1;
    setZoom(zoom.scale + dir * ZOOM_STEP, e.clientX, e.clientY);
  }, { passive: false });

  imgEl.addEventListener("dblclick", function (e) {
    if (zoom.scale > 1.001) { resetZoom(); }
    else { setZoom(2.6, e.clientX, e.clientY); }
  });

  mediaEl.addEventListener("mousedown", function (e) {
    if (zoom.scale <= 1.001 || e.button !== 0) return;
    e.preventDefault();
    drag.active = true;
    drag.startX = e.clientX; drag.startY = e.clientY;
    drag.origX = zoom.x; drag.origY = zoom.y;
    mediaEl.classList.add("is-dragging");
  });
  window.addEventListener("mousemove", function (e) {
    if (!drag.active) return;
    zoom.x = drag.origX + (e.clientX - drag.startX);
    zoom.y = drag.origY + (e.clientY - drag.startY);
    clampPan();
    applyZoom();
  });
  window.addEventListener("mouseup", function () {
    if (!drag.active) return;
    drag.active = false;
    mediaEl.classList.remove("is-dragging");
  });

  mediaEl.addEventListener("touchstart", function (e) {
    if (e.touches.length === 2) {
      pinch.active = true;
      pinch.startDist = touchDist(e.touches);
      pinch.startScale = zoom.scale;
    } else if (e.touches.length === 1 && zoom.scale > 1.001) {
      drag.active = true;
      drag.startX = e.touches[0].clientX; drag.startY = e.touches[0].clientY;
      drag.origX = zoom.x; drag.origY = zoom.y;
    }
  }, { passive: true });
  mediaEl.addEventListener("touchmove", function (e) {
    if (pinch.active && e.touches.length === 2) {
      e.preventDefault();
      var dist = touchDist(e.touches);
      var cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      var cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      setZoom(pinch.startScale * (dist / pinch.startDist), cx, cy);
    } else if (drag.active && e.touches.length === 1) {
      e.preventDefault();
      zoom.x = drag.origX + (e.touches[0].clientX - drag.startX);
      zoom.y = drag.origY + (e.touches[0].clientY - drag.startY);
      clampPan();
      applyZoom();
    }
  }, { passive: false });
  mediaEl.addEventListener("touchend", function (e) {
    if (e.touches.length < 2) pinch.active = false;
    if (e.touches.length < 1) drag.active = false;
  });

  document.addEventListener("click", function (e) {
    var zb = e.target.closest(".pf-zoom-btn");
    if (!zb || !modal.classList.contains("show")) return;
    var action = zb.getAttribute("data-zoom-action");
    if (action === "in") setZoom(zoom.scale + ZOOM_STEP);
    else if (action === "out") setZoom(zoom.scale - ZOOM_STEP);
    else if (action === "reset") resetZoom();
  });
}
