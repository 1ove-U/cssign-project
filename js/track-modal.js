// ===========================
// js/track-modal.js — ป๊อปอัพเช็คสถานะคำสั่งผลิต (แทนหน้า track.html เดิม)
// Public, ไม่ต้อง login — เปิดจากปุ่ม "เช็คสถานะคำสั่งผลิต" บน navbar / เมนูมือถือ / footer ทุกหน้า
// ===========================
import { trackOrderStatus, ORDER_STATUS } from "./db.js";

(function () {
  var overlay    = document.getElementById("tm-overlay");
  var closeBtn   = document.getElementById("tm-close");
  var form       = document.getElementById("tm-form");
  var codeInput  = document.getElementById("tm-code");
  var phoneInput = document.getElementById("tm-phone");
  var submitBtn  = document.getElementById("tm-submit");
  var errorBox   = document.getElementById("tm-error");
  var errorText  = document.getElementById("tm-error-text");
  var resultBox  = document.getElementById("tm-result");
  if (!overlay || !form) return;

  // ── กันสแปม/ไล่เดาแบบเบื้องต้นฝั่ง client (เหมือน track.html เดิม) ──
  var RATE_KEY = "tk_attempts";
  var RATE_LIMIT = 10;
  var RATE_WINDOW_MS = 10 * 60 * 1000;

  function checkRateLimit() {
    var attempts = [];
    try { attempts = JSON.parse(sessionStorage.getItem(RATE_KEY) || "[]"); } catch (e) { attempts = []; }
    var now = Date.now();
    attempts = attempts.filter(function (t) { return now - t < RATE_WINDOW_MS; });
    if (attempts.length >= RATE_LIMIT) return false;
    attempts.push(now);
    sessionStorage.setItem(RATE_KEY, JSON.stringify(attempts));
    return true;
  }

  var STAGE_ORDER = ["received", "design", "approval", "production", "qc", "packing", "shipping", "completed"];
  var STAGE_LABEL = {
    received:   "รับงาน",
    design:     "ออกแบบ",
    approval:   "รออนุมัติแบบ",
    production: "กำลังผลิต",
    qc:         "ตรวจสอบคุณภาพ",
    packing:    "แพ็กสินค้า",
    shipping:   "จัดส่ง",
    completed:  "เสร็จสิ้น"
  };
  var STAGE_ICON = {
    received:   '<path d="M4 12h4l2 3h4l2-3h4"/><path d="M4 12v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6"/><path d="M4 12 6 5h12l2 7"/>',
    design:     '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    approval:   '<rect x="6" y="4" width="12" height="16" rx="2"/><path d="M9 4V2h6v2"/><path d="M9 12l2 2 4-4"/>',
    production: '<path d="M14.7 6.3a4 4 0 0 1-5.4 5.4l-6 6a1.5 1.5 0 0 0 2 2l6-6a4 4 0 0 1 5.4-5.4l-2.8 2.8-2-2 2.8-2.8Z"/>',
    qc:         '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
    packing:    '<path d="M21 8 12 3 3 8v8l9 5 9-5V8Z"/><path d="M3 8l9 5 9-5"/><path d="M12 13v8"/>',
    shipping:   '<rect x="1" y="7" width="14" height="10" rx="1"/><path d="M15 10h4l3 3v4h-7z"/><circle cx="6" cy="19" r="1.6"/><circle cx="17.5" cy="19" r="1.6"/>',
    completed:  '<circle cx="12" cy="12" r="9"/><path d="M8.5 12.5l2.5 2.5 5-5"/>'
  };

  // ── เปิด/ปิด popup ──
  var lastFocused = null;
  function openModal() {
    lastFocused = document.activeElement;
    overlay.style.display = "flex";
    document.body.style.overflow = "hidden";
    requestAnimationFrame(function () { codeInput && codeInput.focus(); });
  }
  function closeModal() {
    overlay.style.display = "none";
    document.body.style.overflow = "";
    if (lastFocused && typeof lastFocused.focus === "function") lastFocused.focus();
  }
  window.openTrackModal = openModal;
  window.closeTrackModal = closeModal;

  document.querySelectorAll("[data-track-modal-open]").forEach(function (el) {
    el.addEventListener("click", function (e) {
      e.preventDefault();
      openModal();
    });
  });
  closeBtn.addEventListener("click", closeModal);
  overlay.addEventListener("click", function (e) { if (e.target === overlay) closeModal(); });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && overlay.style.display === "flex") closeModal();
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    hideError();
    resultBox.classList.remove("show");

    var code = codeInput.value.trim();
    var phone = phoneInput.value.trim();

    if (!code) { showError("กรุณากรอกเลขที่คำสั่งผลิต (PO)"); return; }
    if (phone.replace(/\D/g, "").length < 4) { showError("กรุณากรอกเบอร์โทรอย่างน้อย 4 หลักสุดท้าย"); return; }

    if (!checkRateLimit()) {
      showError("ค้นหาบ่อยเกินไป กรุณาลองใหม่อีกครั้งในอีกสักครู่ หรือโทรสอบถามทีมงานที่ 062-883-3880");
      return;
    }

    submitBtn.disabled = true;
    submitBtn.classList.add("is-loading");

    trackOrderStatus(code, phone).then(function (order) {
      if (!order) {
        showError("ไม่พบคำสั่งผลิตนี้ กรุณาตรวจสอบเลขที่ PO และเบอร์โทรอีกครั้ง หรือติดต่อทีมงานที่ 062-883-3880");
        return;
      }
      renderResult(order);
    }).catch(function (err) {
      console.error("trackOrderStatus error:", err);
      showError("เกิดข้อผิดพลาดในการค้นหา กรุณาลองใหม่อีกครั้ง");
    }).finally(function () {
      submitBtn.disabled = false;
      submitBtn.classList.remove("is-loading");
    });
  });

  resultBox.addEventListener("click", function (e) {
    var btn = e.target.closest(".tm-copy-btn");
    if (!btn) return;
    var code = btn.dataset.code || "";
    navigator.clipboard && navigator.clipboard.writeText(code).then(function () {
      btn.classList.add("copied");
      setTimeout(function () { btn.classList.remove("copied"); }, 1800);
    }).catch(function () {});
  });

  function showError(msg) {
    errorText.textContent = msg;
    errorBox.classList.add("show");
  }
  function hideError() {
    errorBox.classList.remove("show");
  }

  function renderResult(order) {
    var statusInfo = ORDER_STATUS[order.status] || { label: order.status, css: "received" };
    var isCancelled = order.status === "cancelled";
    var dueInfo = getDueInfo(order.dueDate, order.status);

    resultBox.innerHTML =
      '<div class="tm-result-head">' +
        '<div>' +
          '<div class="tm-result-code-row">' +
            '<div class="tm-result-code">' + escapeHtml(order.code || "\u2014") + '</div>' +
            (order.code ? '<button type="button" class="tm-copy-btn" data-code="' + escapeHtml(order.code) + '" aria-label="\u0e04\u0e31\u0e14\u0e25\u0e2d\u0e01\u0e40\u0e25\u0e02\u0e17\u0e35\u0e48 PO" title="\u0e04\u0e31\u0e14\u0e25\u0e2d\u0e01\u0e40\u0e25\u0e02\u0e17\u0e35\u0e48 PO">' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" width="13" height="13"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/></svg>' +
              '<svg class="tm-copy-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" width="13" height="13"><path d="M20 6 9 17l-5-5"/></svg>' +
            '</button>' : "") +
          '</div>' +
          '<div class="tm-result-item">' + escapeHtml(order.item || "") + (order.qty ? ' \u00b7 \u0e08\u0e33\u0e19\u0e27\u0e19 ' + escapeHtml(String(order.qty)) : "") + '</div>' +
        '</div>' +
        '<span class="tm-badge ' + statusInfo.css + '">' + escapeHtml(statusInfo.label) + '</span>' +
      '</div>' +
      (!isCancelled ?
        '<div class="tm-progress-wrap">' +
          '<div class="tm-progress-top"><span>\u0e04\u0e27\u0e32\u0e21\u0e04\u0e37\u0e1a\u0e2b\u0e19\u0e49\u0e32</span><span>' + (order.progress || 0) + '%</span></div>' +
          '<div class="tm-progress-bar"><i style="width:' + Math.max(0, Math.min(100, order.progress || 0)) + '%"></i></div>' +
        '</div>' +
        renderStages(order.status)
      :
        '<div class="tm-progress-wrap"><div class="tm-field-hint" style="margin:0;">\u0e04\u0e33\u0e2a\u0e31\u0e48\u0e07\u0e1c\u0e25\u0e34\u0e15\u0e19\u0e35\u0e49\u0e16\u0e39\u0e01\u0e22\u0e01\u0e40\u0e25\u0e34\u0e01\u0e41\u0e25\u0e49\u0e27 \u0e2b\u0e32\u0e01\u0e21\u0e35\u0e02\u0e49\u0e2d\u0e2a\u0e07\u0e2a\u0e31\u0e22\u0e01\u0e23\u0e38\u0e13\u0e32\u0e15\u0e34\u0e14\u0e15\u0e48\u0e2d\u0e17\u0e35\u0e21\u0e07\u0e32\u0e19</div></div>'
      ) +
      '<div class="tm-info-grid">' +
        '<div class="tm-info-item">' +
          '<div class="tm-info-item-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg></div>' +
          '<div><div class="tm-info-item-label">\u0e01\u0e33\u0e2b\u0e19\u0e14\u0e2a\u0e48\u0e07</div><div class="tm-info-item-val ' + dueInfo.cls + '">' + dueInfo.text + '</div></div>' +
        '</div>' +
        '<div class="tm-info-item">' +
          '<div class="tm-info-item-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.4 14.5 16 10 4 20"/><path d="m21 3-9 9-4-4-6 6"/></svg></div>' +
          '<div><div class="tm-info-item-label">\u0e2b\u0e21\u0e27\u0e14\u0e1b\u0e49\u0e32\u0e22</div><div class="tm-info-item-val">' + escapeHtml(order.category || "\u2014") + '</div></div>' +
        '</div>' +
      '</div>' +
      (order.compliant ?
        '<div class="tm-compliant"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" width="16" height="16"><path d="M20 6 9 17l-5-5"/></svg>\u0e1c\u0e48\u0e32\u0e19\u0e21\u0e32\u0e15\u0e23\u0e10\u0e32\u0e19 \u0e21\u0e2d\u0e01. / ISO 9001</div>'
      : "") +
      '<div class="tm-cta">\u0e21\u0e35\u0e04\u0e33\u0e16\u0e32\u0e21\u0e40\u0e1e\u0e34\u0e48\u0e21\u0e40\u0e15\u0e34\u0e21? \u0e42\u0e17\u0e23 <a href="tel:0628833880">062-883-3880</a></div>';

    resultBox.classList.add("show");
    resultBox.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function renderStages(status) {
    var idx = STAGE_ORDER.indexOf(status);
    return '<div class="tm-stages">' +
      STAGE_ORDER.map(function (s, i) {
        var cls = "";
        if (i < idx) cls = "done";
        else if (i === idx) cls = "current";
        var iconSvg = i < idx
          ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6 9 17l-5-5"/></svg>'
          : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' + STAGE_ICON[s] + '</svg>';
        return '<div class="tm-stage ' + cls + '">' +
          '<div class="tm-stage-line"></div>' +
          '<div class="tm-stage-dot">' + iconSvg + '</div>' +
          '<div class="tm-stage-label">' + STAGE_LABEL[s] + '</div>' +
        '</div>';
      }).join("") +
    '</div>';
  }

  function getDueInfo(dueDate, status) {
    if (!dueDate) return { text: "\u0e44\u0e21\u0e48\u0e23\u0e30\u0e1a\u0e38", cls: "" };
    var due = new Date(dueDate + "T23:59:59");
    if (isNaN(due.getTime())) return { text: "\u0e44\u0e21\u0e48\u0e23\u0e30\u0e1a\u0e38", cls: "" };
    var formatted = due.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });

    if (status === "completed" || status === "cancelled") return { text: formatted, cls: "" };

    var days = Math.ceil((due.getTime() - Date.now()) / 86400000);
    if (days < 0) return { text: formatted + " (\u0e40\u0e01\u0e34\u0e19\u0e01\u0e33\u0e2b\u0e19\u0e14 " + Math.abs(days) + " \u0e27\u0e31\u0e19)", cls: "overdue" };
    if (days <= 2) return { text: formatted + " (\u0e2d\u0e35\u0e01 " + days + " \u0e27\u0e31\u0e19)", cls: "duesoon" };
    return { text: formatted, cls: "" };
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
})();
