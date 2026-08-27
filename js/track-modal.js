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
  var lookupPill      = document.getElementById("tm-lookup-pill");
  var lookupPhoneEl   = document.getElementById("tm-lookup-phone");
  var lookupAgainBtn  = document.getElementById("tm-lookup-again-btn");
  if (!overlay || !form) return;

  // 2026 refactor (ป๊อปอัพเวอร์ชันแท็บ) — หลังค้นเจอสำเร็จ ฟอร์มเต็มจะถูกซ่อนแล้วแทนที่ด้วยแถบ
  // สรุปเล็กๆ (#tm-lookup-pill: "ยืนยันด้วยเบอร์ลงท้าย XXXX" + ปุ่ม "เช็คใบอื่น") กันฟอร์มเปล่าเปลือง
  // พื้นที่ด้านบนโดยไม่จำเป็นหลังกรอกเสร็จแล้ว — showLookupPill()/hideLookupPill() คุมการสลับ 2
  // สถานะนี้ ถูกเรียกจาก submit handler (สำเร็จ), ปุ่ม "เช็คใบอื่น", และ closeModal() (reset ตอนปิด)
  function showLookupPill(phone) {
    form.style.display = "none";
    if (lookupPhoneEl) lookupPhoneEl.textContent = String(phone || "").replace(/\D/g, "").slice(-4);
    if (lookupPill) lookupPill.style.display = "flex";
  }
  function hideLookupPill() {
    form.style.display = "";
    if (lookupPill) lookupPill.style.display = "none";
  }
  if (lookupAgainBtn) {
    lookupAgainBtn.addEventListener("click", function () {
      hideLookupPill();
      resultBox.classList.remove("show");
      resultBox.innerHTML = "";
      currentOrder = null;
      requestAnimationFrame(function () { codeInput && codeInput.focus(); });
    });
  }

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

  // 2026 refactor (ป๊อปอัพเวอร์ชันแท็บ) — คำอธิบาย 1 บรรทัดของ "ขั้นตอนปัจจุบัน" แสดงในการ์ด
  // ไฮไลต์ของแท็บ "สรุป" (ดู renderOverviewPanel()) + สีของการ์ดนั้น (STAGE_CALLOUT_TONE) —
  // แยกจาก STAGE_LABEL (ป้ายสั้นๆ ของ stage tracker เดิม) เพราะอันนี้ต้องอธิบายละเอียดกว่า/พูดกับ
  // ลูกค้าตรงๆ ว่า "ตอนนี้รออะไรอยู่"
  var STAGE_DESC = {
    received:   "รับคำสั่งผลิตเรียบร้อยแล้ว ทีมงานกำลังเตรียมเข้าสู่ขั้นตอนออกแบบ",
    design:     "ทีมออกแบบกำลังจัดทำแบบป้ายให้คุณอยู่",
    approval:   "ทีมออกแบบส่งไฟล์ดีไซน์แล้ว ดูและกดอนุมัติได้ในแท็บ \u201cดำเนินการ\u201d",
    production: "แบบได้รับการอนุมัติแล้ว กำลังเข้าสู่ขั้นตอนผลิต",
    qc:         "ผลิตเสร็จแล้ว กำลังตรวจสอบคุณภาพก่อนแพ็กสินค้า",
    packing:    "ผ่านการตรวจสอบคุณภาพแล้ว กำลังแพ็กสินค้าเตรียมจัดส่ง",
    shipping:   "สินค้าอยู่ระหว่างการจัดส่งไปยังคุณ",
    completed:  "งานเสร็จสมบูรณ์แล้ว ขอบคุณที่ใช้บริการ"
  };
  var STAGE_CALLOUT_TONE = {
    received: "accent", design: "accent", approval: "accent",
    production: "primary", qc: "primary", packing: "primary", shipping: "primary",
    completed: "success"
  };
  var TAB_ICON = {
    overview: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
    steps:    '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4" cy="6" r="1.6"/><circle cx="4" cy="12" r="1.6"/><circle cx="4" cy="18" r="1.6"/>',
    actions:  '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>'
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
    // รีเซ็ตกลับสู่สถานะเริ่มต้นทุกครั้งที่ปิด (ฟอร์มเปล่า ไม่มี pill/ผลลัพธ์ค้าง) กันสับสนตอนเปิดใหม่
    hideLookupPill();
    hideError();
    resultBox.classList.remove("show");
    resultBox.innerHTML = "";
    currentOrder = null;
    form.reset();
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
      showLookupPill(phone);
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
    // แท็บสรุป / ขั้นตอนงาน / ดำเนินการ — สลับ .active ทั้งปุ่มแท็บและ panel ที่ data-tmtab ตรงกัน
    // เก็บ current tab ไว้ที่ DOM เอง (ไม่ผูก state แยก) เพราะ renderResult() แทนที่ทั้งก้อนใหม่ทุกครั้ง
    // ที่ค้นหาใหม่อยู่แล้ว (กลับไปเริ่มที่แท็บ "สรุป" เสมอเมื่อผลลัพธ์เปลี่ยน ถือว่าตั้งใจ)
    var tabBtn = e.target.closest(".tm-tab");
    if (tabBtn) {
      var targetId = tabBtn.dataset.tmtab;
      resultBox.querySelectorAll(".tm-tab").forEach(function (t) { t.classList.toggle("active", t === tabBtn); });
      resultBox.querySelectorAll(".tm-tabpanel").forEach(function (p) {
        p.classList.toggle("active", p.id === "tm-tabpanel-" + targetId);
      });
      return;
    }

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

  // 2026 refactor (ป๊อปอัพเวอร์ชันแท็บ) — เดิม renderResult() เทเนื้อหาทั้งหมด (progress + stage
  // tracker + อนุมัติแบบ + LINE + info grid + เลขพัสดุ + สั่งซ้ำ + cta) ลงมาเรียงยาวก้อนเดียว ทำให้
  // ต้องเลื่อนอ่านเยอะ — ตอนนี้แบ่งเป็น 3 แท็บ: "สรุป" (ภาพรวม + สิ่งที่ต้องรู้ตอนนี้), "ขั้นตอนงาน"
  // (stage tracker แบบเต็ม), "ดำเนินการ" (อนุมัติแบบ/เชื่อม LINE/เลขพัสดุ/สั่งซ้ำ/ติดต่อทีมงาน) แต่ละ
  // แท็บสั้นพอที่จะไม่ต้องเลื่อน — ยังคง class/id เดิมทั้งหมดที่ test อื่นอ้างถึง (.tm-stage,
  // .tm-progress-bar, .tm-compliant, #tm-approval-section, .tm-reorder-btn, #tm-line-link-* ฯลฯ)
  // ไว้ครบ แค่จัดตำแหน่งใหม่ ไม่ได้ลบอะไรออก
  function renderResult(order) {
    currentOrder = order;
    var statusInfo = ORDER_STATUS[order.status] || { label: order.status, css: "received" };
    var isCancelled = order.status === "cancelled";
    var dueInfo = getDueInfo(order.dueDate, order.status);

    var headHtml =
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
      '</div>';

    if (isCancelled) {
      // ยกเลิกแล้ว: ไม่มีความหมายจะโชว์ progress/stage tracker ("ขั้นตอนงาน") อีกต่อไป — เหลือแค่
      // หัวการ์ด + ข้อความแจ้ง + LINE/เลขพัสดุ/cta (สิ่งเหล่านี้ยังมีประโยชน์แม้ยกเลิกแล้ว)
      resultBox.innerHTML = headHtml +
        '<div class="tm-progress-wrap"><div class="tm-field-hint" style="margin:0;">\u0e04\u0e33\u0e2a\u0e31\u0e48\u0e07\u0e1c\u0e25\u0e34\u0e15\u0e19\u0e35\u0e49\u0e16\u0e39\u0e01\u0e22\u0e01\u0e40\u0e25\u0e34\u0e01\u0e41\u0e25\u0e49\u0e27 \u0e2b\u0e32\u0e01\u0e21\u0e35\u0e02\u0e49\u0e2d\u0e2a\u0e07\u0e2a\u0e31\u0e22\u0e01\u0e23\u0e38\u0e13\u0e32\u0e15\u0e34\u0e14\u0e15\u0e48\u0e2d\u0e17\u0e35\u0e21\u0e07\u0e32\u0e19</div></div>' +
        renderLineLinkSection(order) +
        renderShippingAndReorder(order) +
        '<div class="tm-cta">\u0e21\u0e35\u0e04\u0e33\u0e16\u0e32\u0e21\u0e40\u0e1e\u0e34\u0e48\u0e21\u0e40\u0e15\u0e34\u0e21? \u0e42\u0e17\u0e23 <a href="tel:0628833880">062-883-3880</a></div>';
    } else {
      var tone = STAGE_CALLOUT_TONE[order.status] || "primary";
      var approvalSection = renderDesignApprovalSection(order);

      resultBox.innerHTML = headHtml +
        renderTabBar() +
        '<div class="tm-tabpanels">' +
          '<div class="tm-tabpanel active" id="tm-tabpanel-overview">' +
            '<div class="tm-progress-wrap">' +
              '<div class="tm-progress-top"><span>\u0e04\u0e27\u0e32\u0e21\u0e04\u0e37\u0e1a\u0e2b\u0e19\u0e49\u0e32</span><span>' + (order.progress || 0) + '%</span></div>' +
              '<div class="tm-progress-bar"><i style="width:' + Math.max(0, Math.min(100, order.progress || 0)) + '%"></i></div>' +
            '</div>' +
            '<div class="tm-callout tm-callout-' + tone + '">' +
              '<div class="tm-callout-dot"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">' + STAGE_ICON[order.status] + '</svg></div>' +
              '<div><h4>' + escapeHtml(statusInfo.label) + '</h4><p>' + (STAGE_DESC[order.status] || "") + '</p></div>' +
            '</div>' +
            '<div class="tm-info-grid">' +
              '<div class="tm-info-item">' +
                '<div class="tm-info-item-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg></div>' +
                '<div><div class="tm-info-item-label">\u0e01\u0e33\u0e2b\u0e19\u0e14\u0e2a\u0e48\u0e07</div><div class="tm-info-item-val ' + dueInfo.cls + '">' + dueInfo.text + '</div></div>' +
              '</div>' +
              '<div class="tm-info-item">' +
                '<div class="tm-info-item-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.4 14.5 16 10 4 20"/><path d="m21 3-9 9-4-4-6 6"/></svg></div>' +
                '<div><div class="tm-info-item-label">\u0e2b\u0e21\u0e27\u0e14\u0e1b\u0e49\u0e32\u0e22</div><div class="tm-info-item-val">' + escapeHtml(order.category || "\u2014") + '</div></div>' +
              '</div>' +
              '<div class="tm-info-item tm-info-item-full">' +
                '<div class="tm-info-item-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 8v4l3 3"/><circle cx="12" cy="12" r="9"/></svg></div>' +
                '<div><div class="tm-info-item-label">\u0e2d\u0e31\u0e1b\u0e40\u0e14\u0e15\u0e25\u0e48\u0e32\u0e2a\u0e38\u0e14</div><div class="tm-info-item-val">' + formatUpdatedAt(order.updatedAt) + '</div></div>' +
              '</div>' +
            '</div>' +
            // ช่องโหว่ที่ 2 (opt-in ซ่อนอยู่) — เดิม CTA เชื่อมบัญชี LINE อยู่แค่ในแท็บ "ดำเนินการ"
            // เท่านั้น (ต้องกดเปลี่ยนแท็บเองก่อนถึงจะเห็น) ลูกค้าที่ไม่รู้ว่าฟีเจอร์นี้มีอยู่เลยจะไม่มี
            // ทางเจอปุ่มนี้เลยแม้จะเปิด track-modal มาเช็คสถานะแล้วก็ตาม — ย้ายมาแสดงในแท็บ "สรุป"
            // แทน (แท็บ default ที่เห็นทันทีหลังค้นเจอ ไม่ต้องกดอะไรเพิ่ม) เพื่อให้ลูกค้าทุกคนที่เคย
            // เช็คสถานะอย่างน้อย 1 ครั้งเห็น CTA นี้แน่ๆ — id/markup (#tm-line-link-section,
            // #tm-line-link-btn ฯลฯ) เหมือนเดิมทุกประการ แค่ย้ายตำแหน่งเรนเดอร์ (ไม่ duplicate ไว้ 2
            // แท็บ เพราะจะทำให้มี id ซ้ำใน DOM พร้อมกัน ผิดกติกา HTML และ handleLineLinkClick()/
            // renderLineLinkSection() re-render section เดียวที่เจอก่อนตาม id เท่านั้น)
            '<div class="tm-action-block">' +
              '<div class="tm-action-head"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>\u0e23\u0e31\u0e1a\u0e41\u0e08\u0e49\u0e07\u0e40\u0e15\u0e37\u0e2d\u0e19\u0e2d\u0e31\u0e15\u0e42\u0e19\u0e21\u0e31\u0e15\u0e34</div>' +
              renderLineLinkSection(order) +
            '</div>' +
          '</div>' +
          '<div class="tm-tabpanel" id="tm-tabpanel-steps">' + renderStages(order.status) + '</div>' +
          '<div class="tm-tabpanel" id="tm-tabpanel-actions">' +
            (approvalSection || '') +
            renderShippingAndReorder(order) +
            '<div class="tm-cta">\u0e21\u0e35\u0e04\u0e33\u0e16\u0e32\u0e21\u0e40\u0e1e\u0e34\u0e48\u0e21\u0e40\u0e15\u0e34\u0e21? \u0e42\u0e17\u0e23 <a href="tel:0628833880">062-883-3880</a></div>' +
          '</div>' +
        '</div>';
    }

    resultBox.classList.add("show");
    resultBox.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function renderTabBar() {
    var tabs = [["overview", "\u0e2a\u0e23\u0e38\u0e1b"], ["steps", "\u0e02\u0e31\u0e49\u0e19\u0e15\u0e2d\u0e19\u0e07\u0e32\u0e19"], ["actions", "\u0e14\u0e33\u0e40\u0e19\u0e34\u0e19\u0e01\u0e32\u0e23"]];
    return '<div class="tm-tabs" role="tablist">' +
      tabs.map(function (t, i) {
        return '<button type="button" class="tm-tab' + (i === 0 ? ' active' : '') + '" data-tmtab="' + t[0] + '">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' + TAB_ICON[t[0]] + '</svg>' + t[1] +
        '</button>';
      }).join("") +
    '</div>';
  }

  // เลขพัสดุขนส่งจริง (Kerry/Flash ฯลฯ) + ปุ่ม "สั่งซ้ำ" — แยกเป็นฟังก์ชันของตัวเองเพราะใช้ทั้งใน
  // เคสปกติ (แท็บ "ดำเนินการ") และเคส cancelled (ไม่มีแท็บ แต่ยังอยากโชว์ทั้งสองอย่างนี้อยู่)
  function renderShippingAndReorder(order) {
    return (order.shippingTrackingId ?
      '<div class="tm-compliant"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" width="16" height="16"><rect x="1" y="7" width="14" height="10" rx="1"/><path d="M15 10h4l3 3v4h-7z"/><circle cx="6" cy="19" r="1.6"/><circle cx="17.5" cy="19" r="1.6"/></svg>\u0e40\u0e25\u0e02\u0e1e\u0e31\u0e2a\u0e14\u0e38: ' + escapeHtml(order.shippingTrackingId) + '</div>'
    : "") +
    // P2.8b (Portal ลูกค้าประจำ) — ปุ่ม "สั่งซ้ำ" แสดงเฉพาะออเดอร์ที่เสร็จสมบูรณ์แล้ว
    // (shouldOfferReorder() ดูรายละเอียดใน js/reorder-helper.js) — เดิม กดแล้วเปิดฟอร์มขอใบเสนอราคา
    // (js/lead-quote-modal.js) พร้อม prefill ข้อความ
    (shouldOfferReorder(order) ?
      '<button type="button" class="tm-reorder-btn">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" width="16" height="16"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></svg>' +
        '\u0e2a\u0e31\u0e48\u0e07\u0e0b\u0e49\u0e33' +
      '</button>'
    : "");
  }

  // P0.2 (Design Proof Approval) — แสดงเฉพาะตอน status เป็น "design"/"approval" และมี
  // designFiles อย่างน้อย 1 ไฟล์ (คัดลอกมาจาก order_tracking public copy โดย
  // upsertOrderTracking() ใน js/db-orders.js) — คืน "" เฉยๆ ถ้าไม่เข้าเงื่อนไข (ไม่แสดง section
  // นี้เลย ไม่ใช่แสดง section ว่าง)
  function isImageFileUrl(url) {
    return /\.(png|jpe?g|webp|gif)(\?.*)?$/i.test(String(url || ""));
  }

  // ป้องกันเคส admin ตั้งสถานะ "รออนุมัติแบบ" ไปแล้วแต่ลืมติ๊ก "ลูกค้าเห็น" ที่ไฟล์ไหนเลย (ควรถูก
  // กันไว้แล้วตั้งแต่ฟอร์มแอดมิน — ดู guard ใน js/orders-tab-modal.js submit handler — แต่เผื่อ
  // order เก่าที่บันทึกไว้ก่อนมี guard นั้น) — โชว์การ์ดแจ้งว่ากำลังรอไฟล์แทนที่จะปล่อยแท็บ
  // "ดำเนินการ" ว่างเปล่าเฉยๆ ทั้งที่แท็บ "สรุป" เพิ่งบอกลูกค้าไปว่ามีไฟล์ให้ดูแล้ว
  function renderDesignApprovalSection(order) {
    var hasFiles = Array.isArray(order.designFiles) && order.designFiles.length > 0;
    if (order.status === "approval" && !hasFiles) {
      return '<div class="tm-approval-waiting" id="tm-approval-waiting">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>' +
        '<span>\u0e17\u0e35\u0e21\u0e07\u0e32\u0e19\u0e01\u0e33\u0e25\u0e31\u0e07\u0e40\u0e15\u0e23\u0e35\u0e22\u0e21\u0e44\u0e1f\u0e25\u0e4c\u0e14\u0e35\u0e44\u0e0b\u0e19\u0e4c\u0e43\u0e2b\u0e49\u0e04\u0e38\u0e13\u0e14\u0e39 \u0e08\u0e30\u0e02\u0e36\u0e49\u0e19\u0e17\u0e35\u0e48\u0e19\u0e35\u0e48\u0e17\u0e31\u0e19\u0e17\u0e35\u0e17\u0e35\u0e48\u0e1e\u0e23\u0e49\u0e2d\u0e21</span>' +
      '</div>';
    }
    var showApproval = (order.status === "design" || order.status === "approval") && hasFiles;
    if (!showApproval) return "";

    // P0.2-fix: เดิมจุดนี้ไม่เช็คเลยว่าลูกค้าเคยกดอนุมัติ/ขอแก้ไขไปแล้วหรือยัง (ดูแค่
    // order.status ซึ่งไม่ถูกแก้อัตโนมัติตอนลูกค้ากด — ต้องรอแอดมินมาเปลี่ยนเองเสมอ) ทำให้ปุ่ม
    // "อนุมัติแบบนี้" โผล่ซ้ำทุกครั้งที่เข้ามาเช็คสถานะใหม่ ทั้งที่กดไปแล้วจริง — ตอนนี้
    // submitDesignApproval() (js/db-orders.js) บันทึก order.designApprovalDecision ไว้ที่
    // order_tracking ด้วยแล้ว เช็คตรงนี้แทน ถ้ามีผลค้างอยู่แล้ว (และยังไม่ถูกล้างเพราะแอดมิน
    // อัปโหลดแบบรอบใหม่ — ดู upsertOrderTracking()) โชว์การ์ด "ขอบคุณ/รอทีมงาน" แทนปุ่มไปเลย
    if (order.designApprovalDecision === "approved" || order.designApprovalDecision === "changes_requested") {
      var isChangeReq = order.designApprovalDecision === "changes_requested";
      return '<div class="tm-approval-section" id="tm-approval-section">' +
        '<div class="tm-approval-thanks">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6 9 17l-5-5"/></svg>' +
          '<span>' + (isChangeReq
            ? "\u0e02\u0e2d\u0e1a\u0e04\u0e38\u0e13\u0e04\u0e48\u0e30! \u0e40\u0e23\u0e32\u0e44\u0e14\u0e49\u0e23\u0e31\u0e1a\u0e02\u0e49\u0e2d\u0e40\u0e2a\u0e19\u0e2d\u0e41\u0e19\u0e30\u0e02\u0e2d\u0e07\u0e04\u0e38\u0e13\u0e41\u0e25\u0e49\u0e27 \u0e17\u0e35\u0e21\u0e07\u0e32\u0e19\u0e08\u0e30\u0e15\u0e34\u0e14\u0e15\u0e48\u0e2d\u0e01\u0e25\u0e31\u0e1a\u0e40\u0e1e\u0e37\u0e48\u0e2d\u0e1b\u0e23\u0e31\u0e1a\u0e41\u0e01\u0e49\u0e41\u0e1a\u0e1a"
            : "\u0e02\u0e2d\u0e1a\u0e04\u0e38\u0e13\u0e04\u0e48\u0e30! \u0e40\u0e23\u0e32\u0e44\u0e14\u0e49\u0e23\u0e31\u0e1a\u0e01\u0e32\u0e23\u0e2d\u0e19\u0e38\u0e21\u0e31\u0e15\u0e34\u0e41\u0e1a\u0e1a\u0e02\u0e2d\u0e07\u0e04\u0e38\u0e13\u0e41\u0e25\u0e49\u0e27 \u0e17\u0e35\u0e21\u0e07\u0e32\u0e19\u0e08\u0e30\u0e40\u0e23\u0e34\u0e48\u0e21\u0e14\u0e33\u0e40\u0e19\u0e34\u0e19\u0e01\u0e32\u0e23\u0e1c\u0e25\u0e34\u0e15\u0e15\u0e48\u0e2d\u0e44\u0e1b") +
          '</span>' +
        '</div>' +
      '</div>';
    }

    var filesHtml = order.designFiles.map(function (f) {
      var isImg = isImageFileUrl(f.url);
      var thumb = isImg
        ? '<img class="tm-design-file-thumb" src="' + escapeHtml(f.url || "") + '" alt="" loading="lazy">'
        : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2Z"/></svg>';
      return '<a class="tm-design-file' + (isImg ? ' has-thumb' : '') + '" href="' + escapeHtml(f.url || "") + '" target="_blank" rel="noopener noreferrer">' +
        thumb +
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

  // 2026 refactor (ป๊อปอัพเวอร์ชันแท็บ) — เปลี่ยนจาก stage tracker แนวนอนที่ต้องเลื่อนดูบนจอเล็ก
  // (ของเดิม overflow-x:auto) เป็นลิสต์แนวตั้งกระชับที่เห็นครบทั้ง 8 ขั้นในจอเดียว พร้อม tag บอก
  // สถานะแต่ละขั้น (เสร็จแล้ว/กำลังทำ/รอดำเนินการ) และคำอธิบายสั้นๆ เฉพาะขั้นที่กำลังทำอยู่ — ยังคง
  // class "tm-stage"/"done"/"current" เดิมไว้ครบ (test/track-modal-form-flow.test.mjs อ้างถึง)
  function renderStages(status) {
    var idx = STAGE_ORDER.indexOf(status);
    return '<div class="tm-stages">' +
      STAGE_ORDER.map(function (s, i) {
        var cls = "tm-stage";
        var tag = "\u0e23\u0e2d\u0e14\u0e33\u0e40\u0e19\u0e34\u0e19\u0e01\u0e32\u0e23";
        if (i < idx) { cls += " done"; tag = "\u0e40\u0e2a\u0e23\u0e47\u0e08\u0e41\u0e25\u0e49\u0e27"; }
        else if (i === idx) { cls += " current"; tag = "\u0e01\u0e33\u0e25\u0e31\u0e07\u0e17\u0e33"; }
        var iconSvg = i < idx
          ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6 9 17l-5-5"/></svg>'
          : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' + STAGE_ICON[s] + '</svg>';
        var noteHtml = (i === idx && STAGE_DESC[s]) ? '<div class="tm-stage-note">' + STAGE_DESC[s] + '</div>' : "";
        var isLast = i === STAGE_ORDER.length - 1;
        return '<div class="' + cls + '">' +
          '<div class="tm-stage-rail"><div class="tm-stage-dot">' + iconSvg + '</div>' + (isLast ? "" : '<div class="tm-stage-line"></div>') + '</div>' +
          '<div class="tm-stage-body">' +
            '<div class="tm-stage-label">' + STAGE_LABEL[s] + '</div>' +
            noteHtml +
            '<span class="tm-stage-tag">' + tag + '</span>' +
          '</div>' +
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

  // "อัปเดตล่าสุด" ในแท็บ "สรุป" (2026 refactor) — order.updatedAt เป็น Firestore Timestamp
  // (คืนจาก getDoc()) ในโปรดักชัน แต่เป็น plain value ธรรมดาในเทส/สภาพแวดล้อมอื่นๆ — เช็ค
  // .toMillis() ก่อนเสมอ (แพทเทิร์นเดียวกับ js/orders-tab-modal-design-approvals.js) กัน throw
  function formatUpdatedAt(updatedAt) {
    if (!updatedAt) return "\u2014";
    var d = (updatedAt && typeof updatedAt.toMillis === "function") ? new Date(updatedAt.toMillis()) : new Date(updatedAt);
    if (isNaN(d.getTime())) return "\u2014";
    return d.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" }) +
      " \u0e19. " + d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
})();
