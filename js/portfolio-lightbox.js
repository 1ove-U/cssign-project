/* ===========================================================
   CS.SIGN — portfolio-lightbox.js
   Popup รายละเอียดผลงาน: คลิกที่การ์ดผลงาน (.port-card) ที่ไหนก็ได้
   เพื่อเปิดดูรายละเอียดเต็ม + รูปภาพทั้งหมด (รูปอื่นนอกจากรูปหน้าการ์ด)
   ทำงานได้ทั้งการ์ดตัวอย่าง (เขียนในหน้า HTML) และการ์ดที่แอดมินเพิ่มเอง
   =========================================================== */
(function () {
  "use strict";

  function escapeHtml(str) {
    return String(str == null ? "" : str).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // ── สร้าง modal แทรกไว้ท้าย body ──
  var modal = document.createElement("div");
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

  var imgEl, badgeEl, counterEl, thumbsEl, clientEl, titleEl, descEl, tagsEl, ctaEl, mediaEl, hintEl, zoomLevelEl;
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
    ctaEl = document.getElementById("pf-detail-cta");
    mediaEl = document.getElementById("pf-detail-media");
    hintEl = document.getElementById("pf-detail-hint");
    zoomLevelEl = document.getElementById("pf-zoom-level");
  }

  /* ── Zoom & pan — scroll to zoom, drag/pinch to pan, dblclick to
     toggle, +/− buttons, keyboard shortcuts. Pure transform on the
     <img>; .pf-detail-media keeps overflow hidden so it never spills
     over the rounded modal corners. ── */
  var ZOOM_MIN = 1, ZOOM_MAX = 4, ZOOM_STEP = 0.5;
  var zoom = { scale: 1, x: 0, y: 0 };
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

  function setZoom(scale, cx, cy) {
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

  function resetZoom() {
    zoom.scale = 1; zoom.x = 0; zoom.y = 0;
    applyZoom();
  }

  function showHint() {
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

  function initZoomInteractions() {
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
      try { imgs = JSON.parse(card.dataset.images); } catch (e) { imgs = []; }
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
