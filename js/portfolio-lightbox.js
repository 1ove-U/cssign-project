/* ===========================================================
   CS.SIGN — portfolio-lightbox.js
   Popup รายละเอียดผลงาน: คลิกที่การ์ดผลงาน (.port-card) ที่ไหนก็ได้
   เพื่อเปิดดูรายละเอียดเต็ม + รูปภาพทั้งหมด (รูปอื่นนอกจากรูปหน้าการ์ด)
   ทำงานได้ทั้งการ์ดตัวอย่าง (เขียนในหน้า HTML) และการ์ดที่แอดมินเพิ่มเอง

   2026 refactor phase 20: แยกส่วนซูม/แพน/พินช์รูปออกไปเป็น
   js/portfolio-lightbox-zoom.js (342 → 2 ไฟล์) แบบไม่เปลี่ยน behavior ใดๆ —
   ย้าย ZOOM_MIN/MAX/STEP, zoom/drag/pinch state, hintTimer, clamp/clampPan/
   applyZoom/setZoom/resetZoom/showHint/touchDist/initZoomInteractions ออกไป
   ทั้งหมดแบบ diff เป๊ะ ไฟล์นี้เหลือ: สร้าง modal, bindRefs, อ่านข้อมูลจากการ์ด
   (readCardData), เปิด/ปิด/เลื่อนรูป (openFromCard/close/showImage), และ event
   handler หลัก (click/keydown บน document)

   modal/imgEl/mediaEl/hintEl/zoomLevelEl export ออกไปให้ portfolio-lightbox-
   zoom.js อ่าน — ทุกตัวเขียนทับ (reassign) เฉพาะในไฟล์นี้เท่านั้น (ตอนสร้าง modal
   ด้านล่าง และใน bindRefs()) อีกไฟล์ import มาอ่านอย่างเดียวผ่าน ES module live
   binding จึงไม่ต้องมี setter ใดๆ — import initZoomInteractions()/resetZoom()/
   setZoom()/showHint()/zoom(object)/ZOOM_STEP กลับจาก portfolio-lightbox-zoom.js
   circular import ระหว่าง 2 ไฟล์นี้โดยตั้งใจ (เหมือน orders-tab.js ↔
   orders-tab-modal.js ที่มีอยู่แล้วในโปรเจกต์นี้) ใช้ได้ปกติเพราะทุกจุดที่เรียกใช้
   ข้ามไฟล์เป็นการเรียกภายในฟังก์ชัน/event handler ไม่ใช่ตอน module ประเมินค่า
   =========================================================== */
import { initZoomInteractions, resetZoom, setZoom, showHint, zoom, ZOOM_STEP } from "./portfolio-lightbox-zoom.js";

export var modal, imgEl, mediaEl, hintEl, zoomLevelEl;

(function () {
  "use strict";

  function escapeHtml(str) {
    return String(str == null ? "" : str).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // ── สร้าง modal แทรกไว้ท้าย body ──
  modal = document.createElement("div");
  modal.className = "pf-detail-overlay";
  modal.id = "pf-detail-overlay";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.innerHTML =
    '<div class="pf-detail-box">' +
      '<button type="button" class="pf-detail-close" aria-label="ปิด">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" width="16" height="16"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
      "</button>" +
      '<div class="pf-detail-media" id="pf-detail-media">' +
        '<button type="button" class="pf-detail-nav prev" aria-label="รูปก่อนหน้า">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" width="18" height="18"><path d="M15 18l-6-6 6-6"/></svg>' +
        "</button>" +
        '<img src="" alt="" class="pf-detail-img" id="pf-detail-img" draggable="false">' +
        '<div class="pf-detail-badge" id="pf-detail-badge"></div>' +
        '<button type="button" class="pf-detail-nav next" aria-label="รูปถัดไป">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" width="18" height="18"><path d="M9 18l6-6-6-6"/></svg>' +
        "</button>" +
        '<div class="pf-detail-counter" id="pf-detail-counter"></div>' +
        '<div class="pf-detail-hint" id="pf-detail-hint">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>' +
          'เลื่อนล้อเมาส์ซูม · ลากเพื่อเลื่อนภาพ · ดับเบิลคลิกซูมเร็ว' +
        "</div>" +
        '<div class="pf-detail-zoom-toolbar">' +
          '<button type="button" class="pf-zoom-btn" data-zoom-action="out" aria-label="ซูมออก">−</button>' +
          '<span class="pf-zoom-level" id="pf-zoom-level">100%</span>' +
          '<button type="button" class="pf-zoom-btn" data-zoom-action="in" aria-label="ซูมเข้า">+</button>' +
          '<button type="button" class="pf-zoom-btn" data-zoom-action="reset" aria-label="รีเซ็ตซูม">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>' +
          "</button>" +
        "</div>" +
      "</div>" +
      '<div class="pf-detail-thumbs" id="pf-detail-thumbs"></div>' +
      '<div class="pf-detail-info">' +
        '<div class="pf-detail-client" id="pf-detail-client"></div>' +
        '<h3 id="pf-detail-title"></h3>' +
        '<p id="pf-detail-desc"></p>' +
        '<div class="pf-detail-tags" id="pf-detail-tags"></div>' +
        '<button type="button" class="btn btn-primary pf-detail-cta" id="pf-detail-cta">' +
          'ขอใบเสนอราคาแบบนี้' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" width="16" height="16"><path d="M5 12h14M13 5l7 7-7 7"/></svg>' +
        '</button>' +
      "</div>" +
    "</div>";
  document.addEventListener("DOMContentLoaded", function () {
    document.body.appendChild(modal);
  });
  if (document.readyState === "interactive" || document.readyState === "complete") {
    document.body.appendChild(modal);
  }

  var badgeEl, counterEl, thumbsEl, clientEl, titleEl, descEl, tagsEl;
  var images = [];
  var current = 0;
  var currentData = null;

  function bindRefs() {
    imgEl = document.getElementById("pf-detail-img");
    badgeEl = document.getElementById("pf-detail-badge");
    counterEl = document.getElementById("pf-detail-counter");
    thumbsEl = document.getElementById("pf-detail-thumbs");
    clientEl = document.getElementById("pf-detail-client");
    titleEl = document.getElementById("pf-detail-title");
    descEl = document.getElementById("pf-detail-desc");
    tagsEl = document.getElementById("pf-detail-tags");
    mediaEl = document.getElementById("pf-detail-media");
    hintEl = document.getElementById("pf-detail-hint");
    zoomLevelEl = document.getElementById("pf-zoom-level");
  }

  function showImage(idx) {
    if (!images.length) return;
    current = (idx + images.length) % images.length;
    resetZoom();
    imgEl.src = images[current];
    imgEl.alt = (titleEl.textContent || "ผลงาน CS.SIGN") + (images.length > 1 ? " รูปที่ " + (current + 1) : "");
    counterEl.textContent = images.length > 1 ? (current + 1) + " / " + images.length : "";
    modal.classList.toggle("pf-multi", images.length > 1);
    var thumbs = thumbsEl.querySelectorAll(".pf-detail-thumb");
    thumbs.forEach(function (t, i) { t.classList.toggle("active", i === current); });
    showHint();
  }

  function readCardData(card) {
    var title = (card.querySelector("h3") || {}).textContent || "ผลงาน";
    var client = (card.querySelector(".port-client") || {}).textContent || "";
    var badge = (card.querySelector(".port-badge") || {}).textContent || "";
    var desc = (card.querySelector(".port-info p") || {}).textContent || "";
    var tags = Array.prototype.map.call(card.querySelectorAll(".port-tags span"), function (s) { return s.textContent; });

    var imgs = [];
    if (card.dataset.images) {
      try { imgs = JSON.parse(card.dataset.images); } catch { imgs = []; }
    }
    if (!imgs.length) {
      var photo = card.querySelector(".port-photo");
      if (photo && photo.getAttribute("src")) imgs = [photo.getAttribute("src")];
    }
    return { title: title, client: client, badge: badge, desc: desc, tags: tags, images: imgs };
  }

  function openFromCard(card) {
    bindRefs();
    var data = readCardData(card);
    if (!data.images.length) return; // ไม่มีรูป ไม่ต้องเปิด popup

    currentData = data;
    images = data.images;
    badgeEl.textContent = data.badge;
    badgeEl.style.display = data.badge ? "" : "none";
    clientEl.textContent = data.client;
    clientEl.style.display = data.client ? "" : "none";
    titleEl.textContent = data.title;
    descEl.textContent = data.desc;
    descEl.style.display = data.desc ? "" : "none";
    tagsEl.innerHTML = data.tags.map(function (t) { return "<span>" + escapeHtml(t) + "</span>"; }).join("");
    tagsEl.style.display = data.tags.length ? "" : "none";

    thumbsEl.innerHTML = images.length > 1
      ? images.map(function (src, i) {
          return '<button type="button" class="pf-detail-thumb' + (i === 0 ? " active" : "") + '" data-idx="' + i + '"><img src="' + src + '" alt="' + escapeHtml(data.title) + " รูปที่ " + (i + 1) + '" loading="lazy" decoding="async"></button>';
        }).join("")
      : "";
    thumbsEl.style.display = images.length > 1 ? "" : "none";

    initZoomInteractions();
    showImage(0);
    modal.classList.add("show");
    document.body.style.overflow = "hidden";
  }

  function close() {
    modal.classList.remove("show");
    document.body.style.overflow = "";
    resetZoom();
    if (hintEl) hintEl.classList.remove("show");
  }

  document.addEventListener("click", function (e) {
    var card = e.target.closest(".port-card");
    if (card && !e.target.closest("button") && !e.target.closest("a")) {
      openFromCard(card);
      return;
    }
    if (e.target.closest(".pf-detail-close") || e.target === modal) { close(); return; }
    if (e.target.closest(".pf-detail-nav.next")) { showImage(current + 1); return; }
    if (e.target.closest(".pf-detail-nav.prev")) { showImage(current - 1); return; }
    var thumb = e.target.closest(".pf-detail-thumb");
    if (thumb) { showImage(Number(thumb.dataset.idx)); return; }
    var zoomBtn = e.target.closest(".port-zoom-btn");
    if (zoomBtn) {
      var c = zoomBtn.closest(".port-card");
      if (c) openFromCard(c);
      return;
    }
    if (e.target.closest("#pf-detail-cta")) {
      close();
      if (typeof window.openModal === "function" && currentData) {
        window.openModal("form");
        setTimeout(function () {
          var msgEl = document.getElementById("qm-msg");
          if (msgEl && !msgEl.value) {
            msgEl.value = "สนใจผลงานลักษณะนี้: " + currentData.title + (currentData.client ? " (" + currentData.client + ")" : "") + " — รบกวนขอใบเสนอราคาสำหรับโครงการของเราครับ/ค่ะ";
          }
        }, 80);
      }
    }
  });

  document.addEventListener("keydown", function (e) {
    if (!modal.classList.contains("show")) return;
    if (e.key === "Escape") close();
    if (e.key === "ArrowRight" && zoom.scale <= 1.001) showImage(current + 1);
    if (e.key === "ArrowLeft" && zoom.scale <= 1.001) showImage(current - 1);
    if (e.key === "+" || e.key === "=") setZoom(zoom.scale + ZOOM_STEP);
    if (e.key === "-" || e.key === "_") setZoom(zoom.scale - ZOOM_STEP);
    if (e.key === "0") resetZoom();
  });
})();
