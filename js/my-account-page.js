// ===========================
// js/my-account-page.js — ควบคุมหน้า "บัญชีของฉัน" (my-account.html) — P2.9-C, ต่อ UI ประวัติ
// ใบเสนอราคาใน P2.9-D2 → เปลี่ยนแหล่งข้อมูลเป็น quote_requests จริงใน P3.0 Phase 5 รอบ 8
// ===========================
// หน้ากลางแบบสากล (hub) แสดงโปรไฟล์ LINE ย่อ (ชื่อ/รูป จาก liff.getProfile()) + เมนูลิงก์ไปหา
// แต่ละหมวด — "ออเดอร์ของฉัน" ยังลิงก์ไป my-orders.html เดิมตรงๆ (ยังไม่ merge เข้าด้วยกันในรอบนี้
// ดูเหตุผลใน p2.9-account-hub-plan.md หัวข้อ "รอบ P2.9-C") ส่วน "ใบเสนอราคาของฉัน" (P2.9-D2)
// แสดง inline อยู่ในหน้านี้เลยแบบ expand/collapse panel ไม่ redirect ออกไปหน้าอื่น ต่างจาก
// js/my-orders-page.js
// ตรงที่หน้านี้ "ต้อง" มี liff instance เสมอเพื่อเรียก liff.getProfile() — จึงไม่ shortcut ข้าม
// liff.init() ทั้งหมดแม้มี Firebase session เดิมอยู่แล้ว (แค่ shortcut ข้าม network call ไป
// loginWithLine() เท่านั้นถ้ามี session เดิม ดู runLiffFlow() ด้านล่าง)
//
// P3.0 Phase 5 รอบ 8 — **ตัดสินใจ: แทนที่ listenMyLeads() ทั้งหมด ไม่โชว์คู่กัน 2 panel**
// (บันทึกเหตุผลเต็มไว้ใน REFACTOR-PROGRESS.md หัวข้อ "P3.0 Phase 5 รอบ 8" — สรุปสั้น: panel นี้
// ชื่อ "ใบเสนอราคาของฉัน" ตรงกับความหมายของ quote_requests เป๊ะอยู่แล้ว ตั้งแต่ P3.0 Phase 2 เป็น
// ต้นมาปุ่ม "ขอใบเสนอราคา" ทั่วเว็บทุกจุดก็ผูกเข้า flow ตะกร้า → quote_requests แล้ว (ดู
// REFACTOR-PROGRESS.md รอบที่ 173) ไม่ได้สร้าง lead ทั่วไปอีกต่อไป — leads collection เดิมยังมีชีวิต
// อยู่จริงแค่จากช่องทางอื่นที่ไม่ใช่ "ขอใบเสนอราคา" โดยตรง (เช่น js/lead-quote-modal.js แท็บ
// "ติดต่อเรา"/contact.html ฟอร์มติดต่อทั่วไป) ซึ่งไม่มี items[]/ไม่ใช่คำขอใบเสนอราคาที่มีโครงสร้าง
// สินค้าเหมือน quote_requests จึงไม่เหมาะจะปนกันในการ์ดเดียวกัน — คง id เดิมทั้งหมด (ma-leads-*)
// ไว้ตามที่ระบุในพรอมต์ เพราะกระทบ CSS/เทสเดิมน้อยกว่าเปลี่ยนชื่อ id ใหม่ทั้งหมด)
import { loginWithLine } from "./db-orders.js";
// signOut + auth เดียวกับที่ js/my-orders-page.js ใช้จาก P2.9-A/B — ก็อป pattern มาตรงๆ ตามที่ระบุ
// ในพรอมต์รอบนี้ (ไม่ต้องคิดใหม่ ไม่ abstract เป็น shared module ก่อนเวลาอันควร)
import { logoutAdmin, auth, onAuthChange } from "./db.js";
// ประวัติคำขอใบเสนอราคา (P3.0 Phase 5 รอบ 8) — listenMyQuoteRequests() เขียนไว้แล้วตั้งแต่ P3.0
// Phase 2 (js/db-quote-requests.js) แต่ยังไม่มี UI ไหนเรียกใช้จนถึงรอบนี้ — คืน items[]
// (productId/name/variantLabel/size/material/qty/unit/note ต่อชิ้น) + quotePublicToken/quotationId
// ที่ linkQuotationToRequest() (js/db-quotations.js) เขียนกลับให้อัตโนมัติตอนแอดมินออกใบเสนอราคา
// จริงจากคำขอนี้ (ดูคอมเมนต์หัวไฟล์ js/db-quotations.js หัวข้อ "P3.0 Phase 5 (รอบ 7 ...)")
import { listenMyQuoteRequests } from "./db-quote-requests.js";

(function () {
  var loadingEl   = document.getElementById("ma-loading");
  var loginEl     = document.getElementById("ma-login");
  var loginBtn    = document.getElementById("ma-login-btn");
  var errorEl     = document.getElementById("ma-error");
  var errorTextEl = document.getElementById("ma-error-text");
  var profileEl   = document.getElementById("ma-profile");
  var avatarEl    = document.getElementById("ma-avatar");
  var nameEl      = document.getElementById("ma-name");
  var logoutBtn   = document.getElementById("ma-logout-btn");
  // ส่วน "ใบเสนอราคาของฉัน" (P2.9-D2) — องค์ประกอบใหม่ทั้งหมด ยังไม่มีในเทส/หน้าเก่าบางจุด จึง
  // query แบบ if (el) ป้องกัน null ทุกจุดที่ใช้ (pattern เดียวกับ P2.9-A/B ที่ผ่านมา)
  var leadsToggle       = document.getElementById("ma-leads-toggle");
  var leadsPanel        = document.getElementById("ma-leads-panel");
  var leadsChevron      = document.getElementById("ma-leads-chevron");
  var leadsLoadingEl    = document.getElementById("ma-leads-loading");
  var leadsEmptyEl      = document.getElementById("ma-leads-empty");
  var leadsErrorEl      = document.getElementById("ma-leads-error");
  var leadsErrorTextEl  = document.getElementById("ma-leads-error-text");
  var leadsListEl       = document.getElementById("ma-leads-list");
  if (!loadingEl || !loginEl || !profileEl) return; // ไม่ใช่หน้า my-account.html

  // LIFF ID เดียวกับ js/my-orders-page.js/js/track-modal.js (P1.5) — ก็อปมาตรงๆ ด้วยเหตุผล
  // เดียวกัน (ดูคอมเมนต์ยาวใน js/my-orders-page.js) — ยังไม่แยกเป็น shared module รอบนี้
  var LIFF_ID = "2011108044-Nmgfktx5";

  var liffSdkPromise = null;
  function loadLiffSdk() {
    if (window.liff) return Promise.resolve(window.liff);
    if (liffSdkPromise) return liffSdkPromise;
    liffSdkPromise = new Promise(function (resolve, reject) {
      var script = document.createElement("script");
      script.src = "https://static.line-scdn.net/liff/edge/2/sdk.js";
      script.onload = function () { resolve(window.liff); };
      script.onerror = function () {
        liffSdkPromise = null;
        reject(new Error("โหลด LIFF SDK ไม่สำเร็จ"));
      };
      document.head.appendChild(script);
    });
    return liffSdkPromise;
  }

  var liffInstance = null;

  // lineUserId ดิบ (ไม่มี prefix "line_") ของลูกค้าที่ login อยู่ตอนนี้ — เก็บไว้ให้
  // toggleLeadsPanel() ใช้เรียก listenMyQuoteRequests() ตอนกดขยาย panel (ดู afterLogin()/handleLogout()
  // ด้านล่างที่ set/reset ค่านี้) — ต้องเป็นค่าดิบตรงกับ field lead.lineUserId ใน Firestore เป๊ะ
  // (ไม่มี "line_" prefix แบบ auth.currentUser.uid) ไม่งั้น query ใน listenMyQuoteRequests() จะไม่ match
  // อะไรเลย
  var currentLineUserId = null;
  var unsubscribeLeads = null;

  // เช็คว่าตอนนี้หน้ากำลังอยู่ใน state "login แล้ว" อยู่หรือเปล่า (afterLogin() เรียกแล้ว แต่ยังไม่
  // logout) — ใช้กันการ subscribe onAuthChange() ด้านล่างไม่ให้ทำงานซ้อนกับ runLiffFlow() ตอนหน้า
  // โหลดครั้งแรก (pattern เดียวกับ js/my-orders-page.js)
  var sessionActive = false;

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function showOnly(el) {
    [loadingEl, loginEl, profileEl].forEach(function (e) {
      if (e) e.style.display = "none";
    });
    hideError();
    if (el) el.style.display = el === profileEl ? "block" : (el === loadingEl ? "flex" : "block");
  }
  function showError(msg) {
    errorTextEl.textContent = msg;
    errorEl.classList.add("show");
  }
  function hideError() {
    errorEl.classList.remove("show");
  }

  // เช็ค session ลูกค้า LINE เดิมที่ค้างอยู่ (P2.9-B pattern เดียวกับ my-orders-page.js) — ใช้เพื่อ
  // "ข้าม network call ไป loginWithLine() (Cloudflare Worker)" เท่านั้น ไม่ได้ใช้ข้าม liff.init()
  // ทั้งหมดเหมือนหน้าออเดอร์ เพราะหน้านี้ต้องมี liff instance เพื่อเรียก getProfile() เสมอ
  function hasExistingLineSession() {
    var user = auth && auth.currentUser;
    return !!(user && typeof user.uid === "string" && user.uid.indexOf("line_") === 0);
  }

  // คืน lineUserId ดิบ (ตัด prefix "line_" ออกจาก uid) เมื่อมี session ลูกค้า LINE เดิมค้างอยู่ —
  // ใช้เฉพาะ path ที่ shortcut ข้าม loginWithLine() ไป (path ที่เรียก loginWithLine() ปกติจะได้
  // lineUserId ดิบตรงๆ จาก response อยู่แล้ว ไม่ต้องพึ่งฟังก์ชันนี้) — pattern การตัด prefix
  // เดียวกับ saveLead() ใน js/leads.js (P2.9-D1)
  function existingSessionLineUserId() {
    var user = auth && auth.currentUser;
    if (user && typeof user.uid === "string" && user.uid.indexOf("line_") === 0) {
      return user.uid.slice("line_".length);
    }
    return null;
  }

  function renderProfile(profile) {
    var displayName = (profile && profile.displayName) || "";
    nameEl.textContent = displayName;
    if (profile && profile.pictureUrl) {
      avatarEl.src = profile.pictureUrl;
      avatarEl.alt = displayName;
      avatarEl.style.display = "block";
    } else {
      avatarEl.style.display = "none";
    }
  }

  function afterLogin(profile, lineUserId) {
    sessionActive = true;
    renderProfile(profile);
    currentLineUserId = lineUserId || null;
    showOnly(profileEl);
  }

  // ===========================
  // ใบเสนอราคาของฉัน (P3.0 Phase 5 รอบ 8) — expand/collapse panel + subscribe
  // listenMyQuoteRequests() แบบ lazy (subscribe จริงตอนกดขยาย panel ครั้งแรกเท่านั้น ไม่ใช่ตอน
  // login สำเร็จทันที — ดูคอมเมนต์ใน my-account.html หัวข้อ "ใบเสนอราคาของฉัน" ว่าทำไมต่างจาก
  // "ออเดอร์ของฉัน") — enum เดิมตรงกับ js/db-quote-requests.js: new | quoted | closed
  // ===========================
  var QUOTE_REQUEST_STATUS_INFO = {
    new:    { label: "รอดำเนินการ",           css: "received" },
    quoted: { label: "ออกใบเสนอราคาแล้ว",     css: "qc" },
    closed: { label: "ปิดรายการแล้ว",          css: "ok" }
  };

  function requestDateLabel(qr) {
    var ts = qr && qr.createdAt;
    if (!ts) return "\u2014";
    var ms = ts.toMillis ? ts.toMillis() : (typeof ts === "number" ? ts : null);
    if (!ms) return "\u2014";
    return new Date(ms).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" });
  }

  // สรุปรายการสินค้า 1 ชิ้นเป็นบรรทัดเดียว — shape ตรงกับ sanitizeItem() ใน
  // js/db-quote-requests.js (productId/name/variantLabel/size/material/qty/unit/note) — คนละ
  // shape กับ quotations.items (ไม่มี unitPrice/discount/lineTotal เพราะคำขอลูกค้ายังไม่มีราคา)
  function formatQuoteItemLine(item) {
    var descParts = [item.name, item.variantLabel, item.size, item.material].filter(Boolean);
    var qty = (typeof item.qty === "number" && item.qty > 0) ? item.qty : 1;
    var unit = item.unit || "ชิ้น";
    return escapeHtml(descParts.join(" \u00b7 ")) + ' <span style="color:var(--gray-500);">\u00d7 ' + escapeHtml(String(qty)) + ' ' + escapeHtml(unit) + '</span>';
  }

  // การ์ดคำขอใบเสนอราคาเดี่ยว — ใช้ class .tm-badge เดิมจาก css/track-modal.css ซ้ำ (โหลดอยู่แล้ว
  // ทุกหน้า) เหมือนที่ js/my-orders-page.js ใช้กับการ์ดออเดอร์ ไม่เพิ่ม CSS ใหม่รอบนี้ — ถ้ามี
  // quotePublicToken (แอดมินออกใบเสนอราคาจริงแล้ว) โชว์ปุ่มลิงก์ไปหน้า public
  // quotation-view.html?token=... เปิดแท็บใหม่ (pattern target="_blank" rel="noopener noreferrer"
  // เดียวกับลิงก์ไฟล์แนบใน js/track-modal.js) — ไม่มี token → โชว์แค่ badge สถานะเฉยๆ
  function renderQuoteRequestCard(qr) {
    var statusInfo = QUOTE_REQUEST_STATUS_INFO[qr.status] || { label: qr.status || "\u2014", css: "received" };
    var items = Array.isArray(qr.items) ? qr.items : [];
    var itemsHtml = items.map(function (item) {
      return '<div style="font-size:13px; color:var(--gray-700); padding:3px 0;">' + formatQuoteItemLine(item) + '</div>';
    }).join("");
    var linkHtml = qr.quotePublicToken
      ? '<a href="quotation-view.html?token=' + encodeURIComponent(qr.quotePublicToken) + '" target="_blank" rel="noopener noreferrer" class="btn btn-primary btn-sm" style="margin-top:10px;">ดูใบเสนอราคา</a>'
      : '';
    return (
      '<div style="border:1px solid var(--gray-100); border-radius:var(--r-lg); padding:14px 16px; background:var(--bg);">' +
        '<div style="display:flex; align-items:flex-start; justify-content:space-between; gap:10px; margin-bottom:6px;">' +
          '<div style="font-size:13px; color:var(--gray-500);">' + escapeHtml(requestDateLabel(qr)) + '</div>' +
          '<span class="tm-badge ' + statusInfo.css + '">' + escapeHtml(statusInfo.label) + '</span>' +
        '</div>' +
        itemsHtml +
        linkHtml +
      '</div>'
    );
  }

  function showLeadsOnly(el) {
    [leadsLoadingEl, leadsEmptyEl, leadsListEl].forEach(function (e) {
      if (e) e.style.display = "none";
    });
    hideLeadsError();
    if (el) el.style.display = (el === leadsListEl) ? "flex" : (el === leadsLoadingEl ? "flex" : "block");
  }
  function showLeadsError(msg) {
    if (leadsErrorTextEl) leadsErrorTextEl.textContent = msg;
    if (leadsErrorEl) leadsErrorEl.classList.add("show");
  }
  function hideLeadsError() {
    if (leadsErrorEl) leadsErrorEl.classList.remove("show");
  }

  function renderLeads(quoteRequests) {
    if (!quoteRequests || quoteRequests.length === 0) {
      showLeadsOnly(leadsEmptyEl);
      return;
    }
    if (leadsListEl) leadsListEl.innerHTML = quoteRequests.map(renderQuoteRequestCard).join("");
    showLeadsOnly(leadsListEl);
  }

  function onLeadsError(err) {
    console.error("listenMyQuoteRequests error:", err);
    showLeadsOnly(leadsListEl); // เก็บรายการเดิมไว้ (ถ้ามี) บนจอ เหมือน onOrdersError() ใน my-orders-page.js
    showLeadsError("โหลดประวัติคำขอใบเสนอราคาไม่สำเร็จ กรุณาลองใหม่อีกครั้ง หรือโทร 062-883-3880");
  }

  function resetLeadsPanel() {
    if (unsubscribeLeads) { unsubscribeLeads(); unsubscribeLeads = null; }
    if (leadsPanel) leadsPanel.style.display = "none";
    if (leadsToggle) leadsToggle.setAttribute("aria-expanded", "false");
    if (leadsChevron) leadsChevron.style.transform = "";
    if (leadsListEl) leadsListEl.innerHTML = "";
  }

  function toggleLeadsPanel() {
    if (!leadsPanel) return;
    var expanded = leadsPanel.style.display !== "none";
    if (expanded) {
      leadsPanel.style.display = "none";
      if (leadsToggle) leadsToggle.setAttribute("aria-expanded", "false");
      if (leadsChevron) leadsChevron.style.transform = "";
      return;
    }
    leadsPanel.style.display = "block";
    if (leadsToggle) leadsToggle.setAttribute("aria-expanded", "true");
    if (leadsChevron) leadsChevron.style.transform = "rotate(180deg)";
    if (!unsubscribeLeads && currentLineUserId) {
      showLeadsOnly(leadsLoadingEl);
      unsubscribeLeads = listenMyQuoteRequests(currentLineUserId, renderLeads, onLeadsError);
    }
  }
  if (leadsToggle) {
    leadsToggle.addEventListener("click", toggleLeadsPanel);
  }

  // ===========================
  // ออกจากระบบ — pattern เดียวกับ js/my-orders-page.js (P2.9-A/B) ไม่ redirect ออกจากหน้านี้
  // ===========================
  function handleLogout() {
    if (!logoutBtn || logoutBtn.disabled) return;
    logoutBtn.disabled = true;
    sessionActive = false; // ตั้งก่อนเรียก logoutAdmin() กันไม่ให้ onAuthChange() ด้านล่างมาซ้อนทำงาน handleSessionLost() อีกรอบ
    currentLineUserId = null;
    resetLeadsPanel(); // ยกเลิก listenMyQuoteRequests() ที่ subscribe ค้างไว้ (ถ้ามี) + ยุบ panel กลับ
    Promise.resolve(logoutAdmin())
      .catch(function (err) {
        console.error("my-account logout error:", err);
      })
      .finally(function () {
        try {
          if (liffInstance && liffInstance.isLoggedIn && liffInstance.isLoggedIn()) {
            liffInstance.logout();
          }
        } catch (err) {
          console.error("liff logout error:", err);
        }
        nameEl.textContent = "";
        avatarEl.src = "";
        avatarEl.style.display = "none";
        showOnly(loginEl);
        logoutBtn.disabled = false;
      });
  }
  if (logoutBtn) {
    logoutBtn.addEventListener("click", handleLogout);
  }

  // ===========================
  // เซสชันหลุดจากที่อื่น (2026-08 follow-up) — pattern เดียวกับ js/my-orders-page.js: ถ้า session
  // ของบัญชี LINE ที่ login ค้างอยู่ในหน้านี้ถูก signOut(auth) จากแท็บอื่นในเบราว์เซอร์เดียวกัน
  // (เช่น เปิด admin.html ค้างไว้อีกแท็บ แล้ว admin-page.js ตรวจเจอ custom claim lineUserId แล้ว
  // signOut ให้อัตโนมัติ) หน้านี้จะไม่รู้ตัวเลย — โปรไฟล์/panel ใบเสนอราคายังค้างโชว์อยู่ทั้งที่
  // session หลุดไปแล้วจริง แก้โดย subscribe onAuthChange() แยกไว้เฝ้าดูตลอดเวลาที่
  // sessionActive=true (หลัง afterLogin() เรียกไปแล้ว) พากลับไปหน้า "เข้าสู่ระบบด้วย LINE" อย่าง
  // นุ่มนวลถ้า session หลุด
  // ===========================
  function handleSessionLost() {
    sessionActive = false;
    currentLineUserId = null;
    resetLeadsPanel();
    try {
      if (liffInstance && liffInstance.isLoggedIn && liffInstance.isLoggedIn()) {
        liffInstance.logout();
      }
    } catch (err) {
      console.error("liff logout error (session lost):", err);
    }
    nameEl.textContent = "";
    avatarEl.src = "";
    avatarEl.style.display = "none";
    showOnly(loginEl);
    showError("เซสชันหมดอายุหรือออกจากระบบจากอุปกรณ์/แท็บอื่น กรุณาเข้าสู่ระบบใหม่อีกครั้ง");
  }

  onAuthChange(function (user) {
    if (!sessionActive) return; // ยังไม่เคย login สำเร็จในหน้านี้ (runLiffFlow() คุม flow เริ่มต้นเองอยู่แล้ว) หรือ logout ไปแล้ว
    var stillLineSession = !!(user && typeof user.uid === "string" && user.uid.indexOf("line_") === 0);
    if (stillLineSession) return;
    handleSessionLost();
  });

  function loginErrorMessage(code) {
    if (code === "invalid_line_token") return "ยืนยันตัวตนผ่าน LINE ไม่สำเร็จ กรุณาลองเข้าสู่ระบบใหม่อีกครั้ง";
    if (code === "server_misconfigured") return "ระบบเข้าสู่ระบบขัดข้องชั่วคราว กรุณาลองใหม่ภายหลัง หรือโทร 062-883-3880";
    return "เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง หรือโทร 062-883-3880";
  }

  // จุดเดียวที่ orchestrate ทั้ง flow — เหมือน runLiffFlow() ใน js/my-orders-page.js แต่ต่างกันตรง
  // ที่หน้านี้เรียก liff.init() เสมอ (ไม่ shortcut ข้ามไปทั้งหมดแม้มี Firebase session เดิม) เพราะ
  // ต้องใช้ liff instance เพื่อเรียก liff.getProfile() แสดงชื่อ/รูปเสมอ — สิ่งที่ shortcut ได้คือแค่
  // ข้าม network call ไป loginWithLine() (Cloudflare Worker) ถ้ามี Firebase session เดิมอยู่แล้ว
  function runLiffFlow(fromButtonClick) {
    loadLiffSdk()
      .then(function (liff) {
        return liff.init({ liffId: LIFF_ID }).then(function () {
          liffInstance = liff;
          if (!liff.isLoggedIn()) {
            if (fromButtonClick) {
              liff.login(); // redirect ออกจากหน้านี้แล้วกลับมาเอง
              return null;
            }
            showOnly(loginEl);
            return undefined;
          }
          return liff.getProfile().then(function (profile) {
            if (hasExistingLineSession()) {
              // มี Firebase session ลูกค้า LINE เดิมอยู่แล้ว ไม่ต้องเรียก loginWithLine() ซ้ำ —
              // ดึง lineUserId ดิบจาก uid เดิมแทน (P3.0 Phase 5 ใช้ค่านี้เรียก listenMyQuoteRequests())
              return { profile: profile, lineUserId: existingSessionLineUserId() };
            }
            var idToken = liff.getIDToken();
            if (!idToken) throw Object.assign(new Error("missing id token"), { code: "missing_id_token" });
            return loginWithLine(idToken).then(function (result) {
              return { profile: profile, lineUserId: result.lineUserId };
            });
          });
        });
      })
      .then(function (result) {
        if (result === undefined || result === null) return; // แสดงปุ่ม login แล้ว หรือกำลัง redirect
        afterLogin(result.profile, result.lineUserId);
      })
      .catch(function (err) {
        console.error("my-account login error:", err);
        showOnly(loginEl);
        showError(loginErrorMessage(err && err.code));
      });
  }

  if (loginBtn) {
    loginBtn.addEventListener("click", function () {
      loginBtn.disabled = true;
      runLiffFlow(true);
    });
  }

  showOnly(loadingEl);
  runLiffFlow(false);
})();
