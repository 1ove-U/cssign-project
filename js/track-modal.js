// ===========================
// js/track-modal.js — ป๊อปอัพเช็คสถานะคำสั่งผลิต (แทนหน้า track.html เดิม)
// Public, ไม่ต้อง login — เปิดจากปุ่ม "เช็คสถานะคำสั่งผลิต" บน navbar / เมนูมือถือ / footer ทุกหน้า
// ===========================
import { trackOrderStatus, submitDesignApproval, linkLineAccount, ORDER_STATUS, ORDER_STATUS_FLOW } from "./db-orders.js";
import { buildReorderMessage, shouldOfferReorder } from "./reorder-helper.js";

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

  // P0.2 (Design Proof Approval) — เก็บ order ล่าสุดที่ค้นเจอไว้ในตัวแปรนี้ ให้ delegated click
  // handler ของปุ่มอนุมัติ/ขอแก้ไข (ผูกกับ #tm-result ด้านล่าง) เข้าถึง trackingId (order.id) ได้
  // โดยไม่ต้องฝังไว้ใน DOM (เช่น data-attribute) — reset ทุกครั้งที่ renderResult() ถูกเรียกใหม่
  var currentOrder = null;

  // P1.5 (LIFF auto-link) — LIFF ID ของ LIFF app ที่สร้างไว้ใน LINE Developers Console
  // (ไม่ใช่ความลับ เปิดเผยได้ปกติเหมือน Firebase apiKey ฝั่ง client) ต้องตรงกับ [vars] LIFF_ID
  // ใน cloudflare-worker/wrangler.toml เป๊ะ (Worker ใช้ค่านี้เป็น audience ตอน verify LIFF ID
  // token — ถ้าไม่ตรงกัน verify จะ fail เสมอ) — แทนที่ placeholder นี้ด้วย LIFF ID จริงหลัง
  // สร้าง LIFF app เสร็จ (ขั้นตอนที่ 1 ใน line-liff-autolink-spec.md)
  var LIFF_ID = "2011108044-Nmgfktx5";

  // โหลด LIFF SDK แบบ dynamic (inject <script> tag) เฉพาะตอนลูกค้ากดปุ่ม "เชื่อมบัญชี LINE"
  // จริงๆ เท่านั้น ไม่ใช่ตอนหน้าเว็บโหลด — กันไม่ให้ทุกหน้าที่มี track-modal (เกือบทุกหน้าในเว็บ)
  // ต้องโหลด SDK ก้อนนี้เสมอทั้งที่ส่วนใหญ่ไม่เคยกดปุ่มนี้เลย (ตรงกับที่ spec ข้อ 5 เปิดทางให้ทำแบบ
  // "dynamic import ตามแพทเทิร์น ES module ที่ไฟล์นี้ใช้อยู่" — อันนี้คือ dynamic <script> เพราะ LIFF
  // SDK เป็น global script ปกติ ไม่ใช่ ES module ให้ import ตรงๆ ได้) — cache promise ไว้กันโหลดซ้ำ
  // ถ้ากดปุ่มหลายครั้ง/เคยโหลดสำเร็จแล้วจากที่อื่น (window.liff มีอยู่แล้ว) ก็ resolve ทันทีไม่โหลดซ้ำ
  var liffSdkPromise = null;
  function loadLiffSdk() {
    if (window.liff) return Promise.resolve(window.liff);
    if (liffSdkPromise) return liffSdkPromise;
    liffSdkPromise = new Promise(function (resolve, reject) {
      var script = document.createElement("script");
      script.src = "https://static.line-scdn.net/liff/edge/2/sdk.js";
      script.onload = function () { resolve(window.liff); };
      script.onerror = function () {
        liffSdkPromise = null; // ให้ลองโหลดใหม่ได้ถ้าเน็ตหลุดตอนกดครั้งแรก
        reject(new Error("โหลด LIFF SDK ไม่สำเร็จ"));
      };
      document.head.appendChild(script);
    });
    return liffSdkPromise;
  }

  // ── กันสแปม/ไล่เดาแบบเบื้องต้นฝั่ง client (เหมือน track.html เดิม) ──
  var RATE_KEY = "tk_attempts";
  var RATE_LIMIT = 10;
  var RATE_WINDOW_MS = 10 * 60 * 1000;

  function checkRateLimit() {
    var attempts = [];
    try { attempts = JSON.parse(sessionStorage.getItem(RATE_KEY) || "[]"); } catch { attempts = []; }
    var now = Date.now();
    attempts = attempts.filter(function (t) { return now - t < RATE_WINDOW_MS; });
    if (attempts.length >= RATE_LIMIT) return false;
    attempts.push(now);
    // wrap ด้วย try/catch เผื่อ private mode/sessionStorage เต็มโควตา — ไม่ throw ต่อ ปล่อยให้
    // ผู้ใช้ยังส่งฟอร์มได้ต่อ แค่ rate-limit จะไม่ persist ข้ามครั้งถ้าเขียนไม่ได้ (แพทเทิร์นเดียวกับ
    // js/cart.js writeCartRaw())
    try { sessionStorage.setItem(RATE_KEY, JSON.stringify(attempts)); } catch { /* ignore */ }
    return true;
  }

  // ลำดับ + label ของ stage ดึงจาก db-orders.js (ORDER_STATUS_FLOW / ORDER_STATUS) ตรงๆ
  // ไม่ hardcode ซ้ำที่นี่ — ถ้าวันหลังเพิ่ม/แก้ลำดับ workflow ใน db-orders.js จุดเดียว
  // หน้านี้จะอัปเดตตามอัตโนมัติ ไม่ต้องมาแก้ไฟล์นี้คู่กันอีก
  var STAGE_ORDER = ORDER_STATUS_FLOW;
  var STAGE_LABEL = STAGE_ORDER.reduce(function (acc, s) {
    acc[s] = (ORDER_STATUS[s] && ORDER_STATUS[s].label) || s;
    return acc;
  }, {});
  // ไอคอนแต่ละ stage — เป็นเรื่องการแสดงผลล้วนๆ ไม่เกี่ยวกับ business logic ของ workflow
  // จึงยังอยู่ในไฟล์นี้ (db-orders.js ไม่ควรต้องรู้จัก SVG path ของ UI)
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

  // 2026 refactor — accessibility phase (รอบที่ 58): เพิ่ม focus-trap อย่างเดียว (Escape +
  // return-focus มีอยู่แล้วเดิมด้านบน — ดีที่สุดในบรรดา public modal ทั้งหมดของโปรเจกต์)
  var TM_FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), textarea:not([disabled]), ' +
    'input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Tab" || overlay.style.display !== "flex") return;
    var focusables = Array.prototype.slice.call(overlay.querySelectorAll(TM_FOCUSABLE_SELECTOR));
    if (!focusables.length) return;
    var first = focusables[0];
    var last = focusables[focusables.length - 1];
    var active = document.activeElement;
    if (e.shiftKey) {
      if (active === first || !overlay.contains(active)) { e.preventDefault(); last.focus(); }
    } else {
      if (active === last || !overlay.contains(active)) { e.preventDefault(); first.focus(); }
    }
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
    if (btn) {
      var code = btn.dataset.code || "";
      navigator.clipboard && navigator.clipboard.writeText(code).then(function () {
        btn.classList.add("copied");
        setTimeout(function () { btn.classList.remove("copied"); }, 1800);
      }).catch(function () {});
      return;
    }

    // P2.8b (Portal ลูกค้าประจำ) — ปุ่ม "สั่งซ้ำ" (แสดงเฉพาะ order.status === "completed" ดูใน
    // renderResult()/shouldOfferReorder()) ปิด track-modal นี้ก่อน แล้วเปิดฟอร์มขอใบเสนอราคา
    // (js/lead-quote-modal.js) พร้อม prefill ข้อความจาก buildReorderMessage() — guard ด้วย
    // typeof เสมอ กันพังตอนเทส หรือหน้าที่ไม่ได้โหลด js/lead-quote-modal.js คู่กัน (เปิดโมดัลสอง
    // ชั้นซ้อนกันพร้อมกันดูแปลก จึงปิดตัวนี้ก่อนเปิดอีกตัว)
    if (e.target.closest(".tm-reorder-btn")) {
      if (typeof window.openModal === "function") {
        var reorderMessage = buildReorderMessage(currentOrder);
        closeModal();
        window.openModal("form", { source: "reorder_track_modal", message: reorderMessage });
      }
      return;
    }

    // P0.2 (Design Proof Approval) — 3 ปุ่มใหม่ ทั้งหมด delegate ผ่าน #tm-result เหมือน
    // .tm-copy-btn ด้านบน เพราะ innerHTML ถูกแทนที่ทั้งก้อนทุกครั้งที่ renderResult() ถูกเรียกใหม่
    // (ผูก listener ตรงๆ กับปุ่มจะหลุดหายไปพร้อม element เก่าทุกรอบค้นหาใหม่)
    if (e.target.closest("#tm-approve-btn")) {
      submitApproval("approved", "");
      return;
    }
    if (e.target.closest("#tm-request-changes-btn")) {
      var actionsEl = document.getElementById("tm-approval-actions");
      var commentWrap = document.getElementById("tm-approval-comment-wrap");
      if (actionsEl) actionsEl.style.display = "none";
      if (commentWrap) {
        commentWrap.style.display = "block";
        var ta = document.getElementById("tm-approval-comment");
        if (ta) ta.focus();
      }
      return;
    }
    if (e.target.closest("#tm-submit-changes-btn")) {
      var textarea = document.getElementById("tm-approval-comment");
      var comment = textarea ? textarea.value.trim() : "";
      if (!comment) {
        showApprovalMsg("กรุณาระบุสิ่งที่อยากให้แก้ไข ก่อนกดส่ง");
        return;
      }
      submitApproval("changes_requested", comment);
      return;
    }

    // P1.5 (LIFF auto-link) — ปุ่ม "เชื่อมบัญชี LINE" delegate ผ่าน #tm-result เหมือนปุ่มอื่น
    // ทั้งหมดด้านบน (innerHTML ถูกแทนที่ทั้งก้อนทุกครั้งที่ renderResult() ถูกเรียกใหม่)
    if (e.target.closest("#tm-line-link-btn")) {
      handleLineLinkClick(e.target.closest("#tm-line-link-btn"));
      return;
    }
  });

  // P0.2 (Design Proof Approval) — เรียกจากทั้ง #tm-approve-btn และ #tm-submit-changes-btn ด้านบน
  // ปิดปุ่มทั้งหมดในส่วนอนุมัติระหว่างรอผล (กันกดซ้ำ/กดสองปุ่มพร้อมกัน) แล้วแทนที่ทั้ง section ด้วย
  // ข้อความขอบคุณเมื่อสำเร็จ — ตั้งใจไม่ re-render resultBox ทั้งก้อนใหม่ทั้งหมด (จะไป trigger
  // scrollIntoView()/animation ของ .tm-result.show ซ้ำโดยไม่จำเป็น) แก้แค่ #tm-approval-section
  // ของมันเองพอ
  function submitApproval(action, comment) {
    if (!currentOrder || !currentOrder.id) return;
    var section = document.getElementById("tm-approval-section");
    if (!section) return;
    var buttons = section.querySelectorAll("button");
    buttons.forEach(function (b) { b.disabled = true; });
    hideApprovalMsg();

    submitDesignApproval(currentOrder.id, action, comment).then(function () {
      section.innerHTML = '<div class="tm-approval-thanks">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6 9 17l-5-5"/></svg>' +
        '<span>' + (action === "approved"
          ? "ขอบคุณค่ะ! เราได้รับการอนุมัติแบบของคุณแล้ว ทีมงานจะเริ่มดำเนินการผลิตต่อไป"
          : "ขอบคุณค่ะ! เราได้รับข้อเสนอแนะของคุณแล้ว ทีมงานจะติดต่อกลับเพื่อปรับแก้แบบ") +
        '</span></div>';
    }).catch(function (err) {
      console.error("submitDesignApproval error:", err);
      buttons.forEach(function (b) { b.disabled = false; });
      showApprovalMsg("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง หรือโทร 062-883-3880");
    });
  }

  function showApprovalMsg(msg) {
    var msgEl = document.getElementById("tm-approval-msg");
    if (msgEl) msgEl.textContent = msg;
  }
  function hideApprovalMsg() {
    var msgEl = document.getElementById("tm-approval-msg");
    if (msgEl) msgEl.textContent = "";
  }

  // P1.5 (LIFF auto-link) — จุดเดียวที่ orchestrate ทั้ง flow: โหลด LIFF SDK (ถ้ายังไม่โหลด) →
  // liff.init() → liff.login() ถ้ายังไม่ login (จะ redirect ออกไปแล้วกลับมาเอง หยุดที่นี่ ไม่ต้อง
  // ทำอะไรต่อ) → ได้ idToken → ยิงไป linkLineAccount() (js/db-orders.js — เรียก Worker /link-line
  // แล้ว signInWithCustomToken()/updateDoc() ให้เอง) → สำเร็จแล้ว re-render แค่ #tm-line-link-section
  // ของมันเอง (ไม่ re-render resultBox ทั้งก้อน เหมือนกับ submitApproval() ด้านบน กัน
  // scrollIntoView()/animation ของ .tm-result.show ทำงานซ้ำโดยไม่จำเป็น)
  function handleLineLinkClick(btn) {
    if (!currentOrder || btn.disabled) return;
    btn.disabled = true;
    var originalHtml = btn.innerHTML;
    btn.textContent = "กำลังเชื่อมบัญชี...";
    hideLineLinkMsg();

    loadLiffSdk()
      .then(function (liff) {
        return liff.init({ liffId: LIFF_ID }).then(function () {
          if (!liff.isLoggedIn()) {
            liff.login(); // จะ redirect ออกจากหน้านี้แล้วกลับมาเองหลัง login สำเร็จ
            return null;
          }
          var idToken = liff.getIDToken();
          if (!idToken) throw Object.assign(new Error("missing id token"), { code: "missing_id_token" });
          return linkLineAccount(idToken, codeInput.value.trim(), phoneInput.value.trim());
        });
      })
      .then(function (result) {
        if (!result) return; // กำลัง redirect ไป liff.login() อยู่ (ไม่ใช่ error)
        currentOrder.lineUserId = result.lineUserId;
        var section = document.getElementById("tm-line-link-section");
        if (section) section.outerHTML = renderLineLinkSection(currentOrder);
      })
      .catch(function (err) {
        console.error("link-line error:", err);
        btn.disabled = false;
        btn.innerHTML = originalHtml;
        showLineLinkMsg(lineLinkErrorMessage(err && err.code));
      });
  }

  function lineLinkErrorMessage(code) {
    if (code === "invalid_line_token") return "ยืนยันตัวตนผ่าน LINE ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง";
    if (code === "order_not_found") return "ข้อมูลเลขที่ PO หรือเบอร์โทรไม่ตรงกับคำสั่งผลิตนี้ กรุณาลองค้นหาใหม่อีกครั้ง";
    return "เกิดข้อผิดพลาดในการเชื่อมบัญชี LINE กรุณาลองใหม่อีกครั้ง หรือโทร 062-883-3880";
  }
  function showLineLinkMsg(msg) {
    var msgEl = document.getElementById("tm-line-link-msg");
    if (msgEl) msgEl.textContent = msg;
  }
  function hideLineLinkMsg() {
    var msgEl = document.getElementById("tm-line-link-msg");
    if (msgEl) msgEl.textContent = "";
  }

  // P1.5 (LIFF auto-link) — ปุ่ม "เชื่อมบัญชี LINE" (ยังไม่เชื่อม) หรือข้อความยืนยัน (เชื่อมแล้ว)
  // แยกเป็นฟังก์ชันของตัวเอง (ไม่ inline อยู่ใน renderResult() เหมือน renderStages()/
  // renderDesignApprovalSection() ด้านบน) เพราะต้อง re-render เฉพาะ section นี้ซ้ำได้เองหลังเชื่อม
  // สำเร็จ (ดู handleLineLinkClick() ด้านบน) โดยไม่แตะ resultBox ทั้งก้อน
  function renderLineLinkSection(order) {
    if (order.lineUserId) {
      return '<div class="tm-line-link-section" id="tm-line-link-section">' +
        '<div class="tm-compliant tm-line-linked">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" width="16" height="16"><path d="M20 6 9 17l-5-5"/></svg>' +
          'เชื่อมบัญชี LINE แล้ว รับแจ้งเตือนสถานะอัตโนมัติ' +
        '</div>' +
      '</div>';
    }
    return '<div class="tm-line-link-section" id="tm-line-link-section">' +
      '<button type="button" class="tm-line-link-btn" id="tm-line-link-btn">' +
        '<svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M12 2C6.48 2 2 5.94 2 10.8c0 2.98 1.78 5.62 4.5 7.24-.15.5-.63 2.14-.72 2.47-.11.4.15.4.31.29.13-.09 2.05-1.4 2.88-1.97a13 13 0 0 0 3.03.35c5.52 0 10-3.94 10-8.8S17.52 2 12 2Z"/></svg>' +
        'เชื่อมบัญชี LINE รับแจ้งเตือนสถานะ' +
      '</button>' +
      '<div class="tm-line-link-msg" id="tm-line-link-msg"></div>' +
    '</div>';
  }

  function showError(msg) {
    errorText.textContent = msg;
    errorBox.classList.add("show");
  }
  function hideError() {
    errorBox.classList.remove("show");
  }

  function renderResult(order) {
    currentOrder = order;
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
      renderDesignApprovalSection(order) +
      renderLineLinkSection(order) +
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
      // เลขพัสดุขนส่งจริง (Kerry/Flash ฯลฯ) — คนละตัวกับ trackingId ภายใน (id ของ order_tracking เอง)
      // แสดงเฉพาะตอนมีข้อมูลจริง (ปกติกรอกไว้ตอนสถานะเข้าสู่ "จัดส่ง")
      (order.shippingTrackingId ?
        '<div class="tm-compliant"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" width="16" height="16"><rect x="1" y="7" width="14" height="10" rx="1"/><path d="M15 10h4l3 3v4h-7z"/><circle cx="6" cy="19" r="1.6"/><circle cx="17.5" cy="19" r="1.6"/></svg>\u0e40\u0e25\u0e02\u0e1e\u0e31\u0e2a\u0e14\u0e38: ' + escapeHtml(order.shippingTrackingId) + '</div>'
      : "") +
      // P2.8b (Portal ลูกค้าประจำ) — ปุ่ม "สั่งซ้ำ" แสดงเฉพาะออเดอร์ที่เสร็จสมบูรณ์แล้ว
      // (shouldOfferReorder() ดูรายละเอียดใน js/reorder-helper.js) — วางไว้ก่อน .tm-cta
      // เดิม กดแล้วเปิดฟอร์มขอใบเสนอราคา (js/lead-quote-modal.js) พร้อม prefill ข้อความ
      (shouldOfferReorder(order) ?
        '<button type="button" class="tm-reorder-btn">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" width="16" height="16"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></svg>' +
          '\u0e2a\u0e31\u0e48\u0e07\u0e0b\u0e49\u0e33' +
        '</button>'
      : "") +
      '<div class="tm-cta">\u0e21\u0e35\u0e04\u0e33\u0e16\u0e32\u0e21\u0e40\u0e1e\u0e34\u0e48\u0e21\u0e40\u0e15\u0e34\u0e21? \u0e42\u0e17\u0e23 <a href="tel:0628833880">062-883-3880</a></div>';

    resultBox.classList.add("show");
    resultBox.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  // P0.2 (Design Proof Approval) — แสดงเฉพาะตอน status เป็น "design"/"approval" และมี
  // designFiles อย่างน้อย 1 ไฟล์ (คัดลอกมาจาก order_tracking public copy โดย
  // upsertOrderTracking() ใน js/db-orders.js) — คืน "" เฉยๆ ถ้าไม่เข้าเงื่อนไข (ไม่แสดง section
  // นี้เลย ไม่ใช่แสดง section ว่าง)
  function renderDesignApprovalSection(order) {
    var showApproval = (order.status === "design" || order.status === "approval") &&
      Array.isArray(order.designFiles) && order.designFiles.length > 0;
    if (!showApproval) return "";

    var filesHtml = order.designFiles.map(function (f) {
      return '<a class="tm-design-file" href="' + escapeHtml(f.url || "") + '" target="_blank" rel="noopener noreferrer">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2Z"/></svg>' +
        '<span>' + escapeHtml(f.label || "\u0e44\u0e1f\u0e25\u0e4c\u0e14\u0e35\u0e44\u0e0b\u0e19\u0e4c") + '</span>' +
      '</a>';
    }).join("");

    return '<div class="tm-approval-section" id="tm-approval-section">' +
      '<div class="tm-approval-head">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>' +
        '<span>\u0e44\u0e1f\u0e25\u0e4c\u0e14\u0e35\u0e44\u0e0b\u0e19\u0e4c\u0e23\u0e2d\u0e15\u0e23\u0e27\u0e08\u0e2a\u0e2d\u0e1a</span>' +
      '</div>' +
      '<div class="tm-design-files">' + filesHtml + '</div>' +
      '<p class="tm-approval-hint">\u0e15\u0e23\u0e27\u0e08\u0e14\u0e39\u0e44\u0e1f\u0e25\u0e4c\u0e14\u0e35\u0e44\u0e0b\u0e19\u0e4c\u0e14\u0e49\u0e32\u0e19\u0e1a\u0e19 \u0e41\u0e25\u0e49\u0e27\u0e01\u0e14\u0e2d\u0e19\u0e38\u0e21\u0e31\u0e15\u0e34\u0e2b\u0e23\u0e37\u0e2d\u0e02\u0e2d\u0e41\u0e01\u0e49\u0e44\u0e02\u0e44\u0e14\u0e49\u0e40\u0e25\u0e22</p>' +
      '<div class="tm-approval-actions" id="tm-approval-actions">' +
        '<button type="button" class="tm-approve-btn" id="tm-approve-btn">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6 9 17l-5-5"/></svg>' +
          '\u0e2d\u0e19\u0e38\u0e21\u0e31\u0e15\u0e34\u0e41\u0e1a\u0e1a\u0e19\u0e35\u0e49' +
        '</button>' +
        '<button type="button" class="tm-request-changes-btn" id="tm-request-changes-btn">\u0e02\u0e2d\u0e41\u0e01\u0e49\u0e44\u0e02</button>' +
      '</div>' +
      '<div class="tm-approval-comment-wrap" id="tm-approval-comment-wrap" style="display:none;">' +
        '<textarea id="tm-approval-comment" placeholder="\u0e1a\u0e2d\u0e01\u0e2a\u0e34\u0e48\u0e07\u0e17\u0e35\u0e48\u0e2d\u0e22\u0e32\u0e01\u0e43\u0e2b\u0e49\u0e41\u0e01\u0e49\u0e44\u0e02..." rows="3"></textarea>' +
        '<button type="button" class="tm-submit-changes-btn" id="tm-submit-changes-btn">\u0e2a\u0e48\u0e07\u0e02\u0e49\u0e2d\u0e40\u0e2a\u0e19\u0e2d\u0e41\u0e19\u0e30</button>' +
      '</div>' +
      '<div class="tm-approval-msg" id="tm-approval-msg"></div>' +
    '</div>';
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
