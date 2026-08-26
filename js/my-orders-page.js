// ===========================
// js/my-orders-page.js — ควบคุมหน้า "ออเดอร์ของฉัน" (my-orders.html) — P2.8c-E
// ===========================
// LINE = ตัวตนลูกค้าเดียว ไม่มี password/OTP แยก (ดูแผนเต็มใน p2.8c-line-customer-plan.md) —
// หน้านี้เป็น consumer ตัวแรกของ loginWithLine()/listenMyOrders() ที่เพิ่มไว้ใน js/db-orders.js
// รอบ P2.8c-D — ต่างจาก js/track-modal.js (P1.5) ตรงที่ track-modal.js ต้อง "เชื่อมบัญชี" กับ
// order เดียวก่อนด้วยเลข PO/เบอร์โทร ส่วนหน้านี้ login ด้วย LINE อย่างเดียวแล้วเห็นทุกออเดอร์ที่
// เคยเชื่อมไว้แล้วทันที (ไม่ต้องรู้เลข PO ล่วงหน้า)
import { loginWithLine, listenMyOrders, linkLineAccount, ORDER_STATUS, ORDER_STATUS_FLOW, PAYMENT_STATUS, SHIPPING_METHOD } from "./db-orders.js";
// สถิติ/คำนวณล้วนๆ (pure function, ไม่แตะ Firestore เลย — ดูคอมเมนต์หัวไฟล์ js/db-orders-stats.js)
// ใช้เพิ่มข้อมูลใน renderOrderCard() รอบ redesign นี้: กำหนดส่ง (เร่งด่วน/เกินกำหนด) + ยอดคงเหลือ —
// ทุกฟังก์ชันรับแค่ order เดี่ยวๆ ที่ listenMyOrders() ส่งมาอยู่แล้ว ไม่ต้อง query เพิ่ม
import { daysUntilDue, orderUrgency, orderGrandTotal, orderBalance } from "./db-orders-stats.js";
// signOut ฝั่งลูกค้า (P2.9-A) — ใช้ logoutAdmin() เดิมจาก js/db.js ตรงๆ (ครอบ signOut(auth) ตัว
// เดียวกับที่แอดมินใช้ — ดูเหตุผลใน p2.9-account-hub-plan.md ว่าทำไมไม่เพิ่ม alias
// signOutCustomer() ใหม่ในรอบนี้: ชื่อสื่อความหมายฝั่งแอดมินก็จริง แต่ทำงานกับ auth instance
// เดียวกันเป๊ะ เพิ่มโค้ดซ้ำโดยไม่จำเป็นถ้าจะทำแค่ alias เฉยๆ — พิจารณาเปลี่ยนเป็น alias ทีหลังถ้า
// เริ่มมี consumer หลายจุดที่อยากได้ชื่อสื่อความหมายกว่านี้จริงๆ)
// เพิ่ม auth (P2.9-B) — เช็ค auth.currentUser ตรงๆ ก่อนเข้า flow liff.login() ทุกครั้ง ถ้ามี
// session ลูกค้า LINE เดิมค้างอยู่แล้ว (uid ขึ้นต้น "line_") ข้ามไป afterLogin() ได้เลย ไม่ต้อง
// บังคับ login ซ้ำ (ดูรายละเอียดที่หัวข้อ "P2.9-B" ใน p2.9-account-hub-plan.md)
import { logoutAdmin, auth, onAuthChange } from "./db.js";

(function () {
  var loadingEl        = document.getElementById("mo-loading");
  var loginEl          = document.getElementById("mo-login");
  var loginBtn         = document.getElementById("mo-login-btn");
  var errorEl          = document.getElementById("mo-error");
  var errorTextEl      = document.getElementById("mo-error-text");
  var ordersLoadingEl  = document.getElementById("mo-orders-loading");
  var emptyEl          = document.getElementById("mo-empty");
  var listEl           = document.getElementById("mo-list");
  // ปุ่มออกจากระบบ (P2.9-A) — เหมือน linkMoreEl ด้านล่าง: ต้องอยู่คู่กับ state "login แล้ว" ได้
  // (orders-loading/empty/list) ไม่ได้อยู่ในกลุ่ม 5 state ที่ showOnly() คุมทีละอัน จึงคุม
  // visibility แยกเองด้วย showLogout()/hideLogout()
  var logoutEl         = document.getElementById("mo-logout");
  var logoutBtn        = document.getElementById("mo-logout-btn");
  // เชื่อมออเดอร์เพิ่ม (P2.8c-F) — โชว์เฉพาะหลัง login สำเร็จ ไม่ได้อยู่ในกลุ่ม state ที่
  // showOnly() คุม (mo-link-more ต้องอยู่ "คู่กับ" ทั้ง mo-list และ mo-empty พร้อมกันได้ ต่างจาก
  // 5 state ด้านบนที่โชว์ทีละอันเท่านั้น) จึงคุม visibility แยกเองด้วย showLinkMore()/hideLinkMore()
  var linkMoreEl       = document.getElementById("mo-link-more");
  var linkMoreToggle   = document.getElementById("mo-link-more-toggle");
  var linkMoreForm     = document.getElementById("mo-link-more-form");
  var linkMoreCodeEl   = document.getElementById("mo-link-more-code");
  var linkMorePhoneEl  = document.getElementById("mo-link-more-phone");
  var linkMoreSubmit   = document.getElementById("mo-link-more-submit");
  var linkMoreMsgEl    = document.getElementById("mo-link-more-msg");
  // ป๊อปอัพรายละเอียดออเดอร์แบบเต็ม (กดที่การ์ดในลิสต์ #mo-list เปิด) — element เหล่านี้ไม่บังคับ
  // อยู่ในเงื่อนไข guard ด้านล่าง (ต่างจาก loadingEl/loginEl/listEl) เพราะเทสเก่า/markup เก่าที่ยัง
  // ไม่มีป๊อปอัพนี้ต้องยังทำงานได้ปกติ ทุกจุดที่ใช้ element กลุ่มนี้จึงเช็ค null ก่อนเสมอ
  var detailOverlay    = document.getElementById("mo-detail-overlay");
  var detailClose      = document.getElementById("mo-detail-close");
  var detailBody       = document.getElementById("mo-detail-body");
  var detailTitleEl    = document.getElementById("mo-detail-title");
  var detailSubEl      = document.getElementById("mo-detail-sub");
  var detailCodeEl     = document.getElementById("mo-detail-code");
  if (!loadingEl || !loginEl || !listEl) return; // ไม่ใช่หน้า my-orders.html

  // LIFF ID เดียวกับที่ js/track-modal.js ใช้ (P1.5) — ต้องตรงกับ [vars] LIFF_ID ใน
  // cloudflare-worker/wrangler.toml เป๊ะ (Worker ใช้ค่านี้เป็น audience ตอน verify LIFF ID
  // token ทั้ง /link-line และ /line-login) — จงใจ "ก็อปมาตรงๆ" จาก track-modal.js แทนที่จะแยก
  // เป็น shared module (track-modal.js ห่อทุกอย่างไว้ใน IIFE ปิด ไม่ export loadLiffSdk()/
  // LIFF_ID ออกมาให้ import ซ้ำได้ตรงๆ อยู่แล้ว — จะแยกเป็น shared module ก็ได้ในรอบถัดไปถ้า
  // เห็นว่าคุ้ม แต่รอบนี้ทำตามกติกา "2-3 ไฟล์ต่อรอบ" ก่อน)
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

  // เก็บ liff instance ที่ init()/login() แล้วจาก runLiffFlow() ไว้ใช้ซ้ำตอนกดปุ่ม "เชื่อมออเดอร์
  // เพิ่ม" (P2.8c-F) — กัน liff.init() ซ้ำโดยไม่จำเป็น (liff.init() เรียกซ้ำได้แต่ไม่มีประโยชน์เพิ่ม
  // เพราะ session เดิมยัง valid อยู่ตราบใดที่ยังไม่ปิดหน้า)
  var liffInstance = null;

  var unsubscribeOrders = null;

  // เช็คว่าตอนนี้หน้ากำลังอยู่ใน state "login แล้ว" อยู่หรือเปล่า (afterLogin() เรียกแล้ว แต่ยังไม่
  // logout) — ใช้กันการ subscribe onAuthChange() ด้านล่างไม่ให้ทำงานซ้อนกับ runLiffFlow() ตอนหน้า
  // โหลดครั้งแรก (ตอนนั้น sessionActive ยังเป็น false อยู่ event onAuthStateChanged แรกที่ยิงมาพร้อม
  // subscribe จะถูกข้ามไปเฉยๆ ปล่อยให้ runLiffFlow() คุม flow login เองตามปกติ)
  var sessionActive = false;

  function showOnly(el) {
    [loadingEl, loginEl, ordersLoadingEl, emptyEl, listEl].forEach(function (e) {
      if (e) e.style.display = "none";
    });
    hideError();
    if (el) el.style.display = el === listEl ? "flex" : (el === loadingEl || el === ordersLoadingEl ? "flex" : "block");
  }
  function showError(msg) {
    errorTextEl.textContent = msg;
    errorEl.classList.add("show");
  }
  function hideError() {
    errorEl.classList.remove("show");
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // การ์ดออเดอร์เดี่ยว — ปรับปรุงรอบ redesign: ยังใช้ .tm-badge/.tm-progress-bar เดิมจาก
  // css/track-modal.css สำหรับสถานะ/แถบความคืบหน้า (ไม่เปลี่ยนพฤติกรรม/ลุค 2 ส่วนนี้) แต่ห่อด้วย
  // การ์ดใหม่ (.ap-item-card, css/account-pages.css) + เพิ่มข้อมูลที่มีอยู่แล้วใน order แต่ไม่เคย
  // แสดงในหน้านี้เลย: วันที่สร้าง, กำหนดส่ง (พร้อมไฮไลต์ถ้าใกล้/เกินกำหนด — ใช้ daysUntilDue()/
  // orderUrgency() จาก js/db-orders-stats.js ตรงๆ ไม่คำนวณเอง), ยอดคงเหลือที่ต้องชำระ (orderBalance()),
  // ช่องทางจัดส่ง/เลขพัสดุ — ทุกส่วนเป็น optional เพราะ order จริงบางรายการอาจไม่มีข้อมูลการเงิน/
  // โลจิสติกส์ครบ (เช่น เพิ่งรับงานสดๆ) จึง query แบบ if (order.xxx) ก่อนเรนเดอร์ทุกจุด — ไม่กระทบ
  // เทสเดิมที่ยิง order object แบบขั้นต่ำ (code/item/qty/status/progress เท่านั้น) เพราะ chip ทุกอัน
  // จะแค่ไม่ถูกเรนเดอร์เฉยๆ ถ้าไม่มีข้อมูล
  //
  // ขั้นตอนงานทั้งหมด (8 stage ตาม ORDER_STATUS_FLOW) ห่อด้วย <details>/<summary> native — เลือกใช้
  // เพราะเป็น progressive disclosure ในตัว ไม่ต้องผูก event listener เพิ่มจาก JS (การ์ดถูกเรนเดอร์
  // จาก string เข้า .innerHTML ล้วนๆ อยู่แล้ว การ toggle ด้วย addEventListener ทีละใบจะต้องรื้อ
  // โครงสร้างการ subscribe/re-render ใหม่ทั้งหมด — <details> ทำงานได้ทันทีจากเบราว์เซอร์เอง)

  // แปลง Firestore Timestamp (หรือ number ms ดิบ) เป็นวันที่แบบไทยอ่านง่าย — ใช้ร่วมกันทั้ง
  // วันที่สั่ง (createdAt) และวันที่อื่นๆ ที่โผล่เฉพาะในป๊อปอัพรายละเอียด (shippedAt/completedAt)
  function tsLabel(ts) {
    if (!ts) return "";
    var ms = ts.toMillis ? ts.toMillis() : (typeof ts === "number" ? ts : null);
    if (!ms) return "";
    return new Date(ms).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
  }

  function orderDateLabel(order) {
    return tsLabel(order && order.createdAt);
  }

  function dueDateLabel(order) {
    if (!order || !order.dueDate) return "";
    var d = new Date(order.dueDate + "T00:00:00");
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
  }

  function formatBaht(n) {
    return (Math.round((Number(n) || 0) * 100) / 100).toLocaleString("th-TH") + " บาท";
  }

  // แถวข้อมูลย่อยใต้การ์ด (กำหนดส่ง / ยอดคงเหลือ / ช่องทางจัดส่ง) — คืน "" ถ้าไม่มี chip ให้แสดงเลย
  // (order ไม่มี dueDate/ยอดเงิน/ช่องทางจัดส่งครบ) กันเหลือแถวว่างๆ ในการ์ด
  function renderChipRow(order) {
    var chips = [];

    var dueLabel = dueDateLabel(order);
    if (dueLabel && order.status !== "completed" && order.status !== "cancelled") {
      var urgency = orderUrgency(order);
      var chipClass = urgency === "overdue" ? " overdue" : (urgency === "due-soon" ? " duesoon" : "");
      var days = daysUntilDue(order);
      var urgencyText = urgency === "overdue" ? " (เกินกำหนด " + Math.abs(days) + " วัน)" : (urgency === "due-soon" ? " (อีก " + Math.max(days, 0) + " วัน)" : "");
      chips.push(
        '<span class="ap-chip' + chipClass + '">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>' +
          'กำหนดส่ง ' + escapeHtml(dueLabel) + escapeHtml(urgencyText) +
        '</span>'
      );
    }

    if (order.paymentStatus && order.status !== "cancelled") {
      if (order.paymentStatus === "paid_full") {
        chips.push(
          '<span class="ap-chip paid">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><path d="M20 6 9 17l-5-5"/></svg>' +
            'ชำระครบแล้ว' +
          '</span>'
        );
      } else {
        var balance = orderBalance(order);
        if (balance > 0) {
          chips.push(
            '<span class="ap-chip balance">' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>' +
              'ค้างชำระ ' + escapeHtml(formatBaht(balance)) +
            '</span>'
          );
        }
      }
    }

    if (order.shippingMethod) {
      var methodInfo = SHIPPING_METHOD[order.shippingMethod];
      if (methodInfo) {
        chips.push(
          '<span class="ap-chip">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13"/><path d="M16 8h4l3 3v5h-7V8Z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>' +
            escapeHtml(methodInfo.label) +
          '</span>'
        );
      }
    }

    if (order.shippingTrackingId && (order.status === "shipping" || order.status === "completed")) {
      chips.push(
        '<span class="ap-chip">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>' +
          'เลขพัสดุ ' + escapeHtml(order.shippingTrackingId) +
        '</span>'
      );
    }

    if (!chips.length) return "";
    return '<div class="ap-chip-row">' + chips.join("") + '</div>';
  }

  // ขั้นตอนงานทั้งหมด 8 stage แบบ mini tracker แนวนอน (.ap-flow, css/account-pages.css) — ใช้
  // ORDER_STATUS_FLOW เดิมจาก js/db-orders.js เป๊ะ (ลำดับเดียวกับที่ป๊อปอัพเช็คสถานะใช้) ไม่รวม
  // "cancelled" เพราะเป็นสถานะพิเศษที่ออกจาก flow ได้จากทุกขั้นตอน (แสดงแยกด้วย
  // renderCancelledNote() ด้านล่างแทน)
  var STAGE_ICON_DONE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6 9 17l-5-5"/></svg>';

  // สร้าง HTML ของแถบขั้นตอนงาน 8 stage เฉยๆ (ไม่ห่อ <details>) — แยกออกมาจาก renderFlowTracker()
  // เดิม เพื่อให้ป๊อปอัพรายละเอียดออเดอร์เต็ม (renderDetailFlowSection ด้านล่าง) เอาไปโชว์แบบ
  // "เปิดอยู่เสมอ" ได้โดยไม่ต้องพึ่ง <details>/<summary> ซ้ำ (การ์ดสรุปยังใช้ renderFlowTracker()
  // เดิมที่ห่อ <details> ตามปกติ ไม่เปลี่ยนพฤติกรรม/ลุคของการ์ดสรุปเลย)
  function buildFlowStepsHtml(order) {
    var currentIdx = ORDER_STATUS_FLOW.indexOf(order.status);
    return ORDER_STATUS_FLOW.map(function (key, idx) {
      var info = ORDER_STATUS[key] || { label: key };
      var stepClass = idx < currentIdx ? "done" : (idx === currentIdx ? "current" : "");
      return (
        '<div class="ap-flow-step' + (stepClass ? " " + stepClass : "") + '">' +
          '<div class="ap-flow-rail">' +
            '<span class="ap-flow-line"></span>' +
            '<span class="ap-flow-dot">' + (idx < currentIdx ? STAGE_ICON_DONE : "") + '</span>' +
            '<span class="ap-flow-line"></span>' +
          '</div>' +
          '<div class="ap-flow-label">' + escapeHtml(info.label) + '</div>' +
        '</div>'
      );
    }).join("");
  }

  function renderFlowTracker(order) {
    var stepsHtml = buildFlowStepsHtml(order);
    return (
      '<details class="ap-details">' +
        '<summary>ดูขั้นตอนงานทั้งหมด' +
          '<svg class="ap-details-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><polyline points="6 9 12 15 18 9"/></svg>' +
        '</summary>' +
        '<div class="ap-details-body"><div class="ap-flow">' + stepsHtml + '</div></div>' +
      '</details>'
    );
  }

  function renderCancelledNote() {
    return (
      '<div style="padding:0 18px 16px;">' +
        '<div class="ap-cancelled-note">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="13"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>' +
          'คำสั่งผลิตนี้ถูกยกเลิกแล้ว หากมีข้อสงสัยติดต่อ 062-883-3880' +
        '</div>' +
      '</div>'
    );
  }

  function renderOrderCard(order) {
    var statusInfo = ORDER_STATUS[order.status] || { label: order.status, css: "received" };
    var progress = Math.max(0, Math.min(100, order.progress || 0));
    var dateLabel = orderDateLabel(order);
    var isCancelled = order.status === "cancelled";
    var isCompleted = order.status === "completed";

    return (
      '<div class="ap-item-card" data-order-id="' + escapeHtml(order.id || "") + '" tabindex="0" role="button" aria-haspopup="dialog">' +
        '<div class="ap-item-top">' +
          '<div>' +
            '<div class="ap-item-code">' + escapeHtml(order.code || "\u2014") + '</div>' +
            (dateLabel ? '<div class="ap-item-date">สั่งเมื่อ ' + escapeHtml(dateLabel) + '</div>' : '') +
          '</div>' +
          '<span class="tm-badge ' + statusInfo.css + '">' + escapeHtml(statusInfo.label) + '</span>' +
        '</div>' +
        '<div class="ap-item-name">' + escapeHtml(order.item || "") + (order.qty ? ' <b>\u00d7 ' + escapeHtml(String(order.qty)) + '</b>' : '') + '</div>' +
        (!isCancelled ?
          '<div class="ap-item-progress">' +
            '<div class="ap-item-progress-top"><span>ความคืบหน้า</span><span>' + progress + '%</span></div>' +
            '<div class="tm-progress-bar"><i style="width:' + progress + '%"></i></div>' +
          '</div>'
        : '') +
        renderChipRow(order) +
        (isCancelled ? renderCancelledNote() : (isCompleted ? '' : renderFlowTracker(order))) +
      '</div>'
    );
  }

  // เก็บลิสต์ order ล่าสุดที่ listenMyOrders() ส่งมา ไว้ให้ handleCardClick() ด้านล่างหา order
  // เต็มๆ จาก data-order-id ตอนกดเปิดป๊อปอัพรายละเอียด (การ์ดสรุปมีแค่ id ไม่ได้ inline JSON
  // ทั้ง object ลงไปใน DOM — กันข้อมูลอ่อนไหว เช่น notes/ที่อยู่ ไปโผล่ใน view-source โดยไม่จำเป็น)
  var currentOrders = [];
  function findOrderById(id) {
    for (var i = 0; i < currentOrders.length; i++) {
      if (currentOrders[i].id === id) return currentOrders[i];
    }
    return null;
  }

  function renderOrders(orders) {
    currentOrders = orders || [];
    if (!orders || orders.length === 0) {
      showOnly(emptyEl);
      return;
    }
    listEl.innerHTML = orders.map(renderOrderCard).join("");
    showOnly(listEl);
  }

  function onOrdersError(err) {
    console.error("listenMyOrders error:", err);
    showOnly(listEl); // เก็บรายการเดิม (ถ้ามี) ไว้บนจอ ไม่เคลียร์ทิ้งตอน error ระหว่างทาง (เช่น เน็ตหลุดชั่วคราว)
    showError("โหลดรายการออเดอร์ไม่สำเร็จ กรุณาลองรีเฟรชหน้าใหม่ หรือโทร 062-883-3880");
  }

  // ===========================
  // ป๊อปอัพรายละเอียดออเดอร์แบบเต็ม — กดที่การ์ดในลิสต์เปิดขึ้นมา
  // ===========================
  // แสดงข้อมูลทุกอย่างที่มีอยู่แล้วใน order object จาก listenMyOrders() แต่การ์ดสรุปในลิสต์ไม่ได้
  // โชว์ (สเปกงาน/รายละเอียดการเงิน/ที่อยู่จัดส่งเต็ม/ไฟล์แบบ/QC checklist/หมายเหตุ) — ทุก section
  // เป็น optional เหมือน renderChipRow() เดิม: ถ้า order ไม่มีข้อมูลกลุ่มนั้นเลย section จะไม่ถูก
  // เรนเดอร์ (คืน "" แล้ว filter(Boolean) ทิ้งตอนประกอบ body รวม)
  var CHECK_ICON  = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><path d="M20 6 9 17l-5-5"/></svg>';
  var CIRCLE_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="8"/></svg>';
  var FILE_ICON   = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2Z"/></svg>';

  function detailRow(label, value, opts) {
    opts = opts || {};
    if (value === "" || value == null) return "";
    return (
      '<div class="ap-detail-row' + (opts.full ? " full" : "") + '">' +
        '<span class="ap-detail-label">' + escapeHtml(label) + '</span>' +
        '<span class="ap-detail-value' + (opts.cls ? " " + opts.cls : "") + '">' + escapeHtml(String(value)) + '</span>' +
      '</div>'
    );
  }

  function detailSection(title, iconSvg, innerHtml) {
    if (!innerHtml) return "";
    return (
      '<div class="ap-detail-section">' +
        '<div class="ap-detail-section-title"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' + iconSvg + '</svg>' + escapeHtml(title) + '</div>' +
        innerHtml +
      '</div>'
    );
  }

  function renderDetailInfoSection(order) {
    var rows = [];
    rows.push(detailRow("เลขที่คำสั่งผลิต", order.code || "\u2014"));
    if (order.qty) rows.push(detailRow("จำนวน", order.qty + " ชิ้น"));
    if (order.category) rows.push(detailRow("หมวดป้าย", order.category));
    var dateLabel = orderDateLabel(order);
    if (dateLabel) rows.push(detailRow("วันที่สั่ง", dateLabel));
    var dueLabel = dueDateLabel(order);
    if (dueLabel) {
      var urgency = orderUrgency(order);
      rows.push(detailRow("กำหนดส่ง", dueLabel, { cls: urgency === "overdue" ? "warn" : "" }));
    }
    var shippedLabel = tsLabel(order.shippedAt);
    if (shippedLabel) rows.push(detailRow("วันที่จัดส่ง", shippedLabel));
    var completedLabel = tsLabel(order.completedAt);
    if (completedLabel) rows.push(detailRow("วันที่เสร็จงาน", completedLabel));
    if (!rows.length) return "";
    return detailSection(
      "ข้อมูลคำสั่งผลิต",
      '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
      '<div class="ap-detail-grid">' + rows.join("") + '</div>'
    );
  }

  function renderDetailFlowSection(order) {
    if (order.status === "cancelled") return renderCancelledNote();
    var progress = Math.max(0, Math.min(100, order.progress || 0));
    var progressHtml = order.status === "completed" ? "" : (
      '<div class="ap-item-progress" style="padding:0 0 16px;">' +
        '<div class="ap-item-progress-top"><span>ความคืบหน้า</span><span>' + progress + '%</span></div>' +
        '<div class="tm-progress-bar"><i style="width:' + progress + '%"></i></div>' +
      '</div>'
    );
    return detailSection(
      "ความคืบหน้า",
      '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4" cy="6" r="1.6"/><circle cx="4" cy="12" r="1.6"/><circle cx="4" cy="18" r="1.6"/>',
      progressHtml + '<div class="ap-flow">' + buildFlowStepsHtml(order) + '</div>'
    );
  }

  function renderDetailSpecsSection(order) {
    var s = order.specs || {};
    var rows = [];
    if (s.size) rows.push(detailRow("ขนาด", s.size));
    if (s.material) rows.push(detailRow("วัสดุ", s.material));
    if (s.color) rows.push(detailRow("สี", s.color));
    if (s.finish) rows.push(detailRow("การเคลือบ/ผิว", s.finish));
    if (!rows.length) return "";
    return detailSection(
      "สเปกงาน",
      '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94Z"/>',
      '<div class="ap-detail-grid">' + rows.join("") + '</div>'
    );
  }

  function renderDetailFinanceSection(order) {
    var hasFinance = Number(order.unit_price) || Number(order.deposit) || Number(order.discount) ||
      Number(order.shippingCost) || order.paymentStatus || order.invoiceAddress;
    if (!hasFinance) return "";
    var rows = [];
    if (Number(order.unit_price)) {
      rows.push(detailRow("ราคาต่อหน่วย", formatBaht(order.unit_price)));
      if (order.qty) rows.push(detailRow("ยอดสินค้า", formatBaht(Number(order.unit_price) * Number(order.qty))));
    }
    if (Number(order.discount)) rows.push(detailRow("ส่วนลด", "-" + formatBaht(order.discount)));
    if (Number(order.shippingCost)) rows.push(detailRow("ค่าขนส่ง", formatBaht(order.shippingCost)));
    rows.push(detailRow("VAT", order.vatIncluded ? "รวมในราคาแล้ว" : "บวกเพิ่ม 7%"));
    rows.push(detailRow("ยอดรวมทั้งหมด", formatBaht(orderGrandTotal(order)), { cls: "accent", full: true }));
    if (Number(order.deposit)) rows.push(detailRow("ชำระแล้ว (มัดจำ)", formatBaht(order.deposit)));
    if (order.paymentStatus) {
      var payInfo = PAYMENT_STATUS[order.paymentStatus];
      if (order.paymentStatus === "paid_full") {
        rows.push(detailRow("สถานะการชำระ", (payInfo && payInfo.label) || "ชำระครบแล้ว", { cls: "ok" }));
      } else {
        var balance = orderBalance(order);
        rows.push(detailRow("สถานะการชำระ", (payInfo && payInfo.label) || ""));
        if (balance > 0) rows.push(detailRow("ยอดคงเหลือ", formatBaht(balance), { cls: "warn" }));
      }
    }
    if (order.invoiceAddress) rows.push(detailRow("ที่อยู่ออกใบกำกับภาษี", order.invoiceAddress, { full: true }));
    return detailSection(
      "การเงิน",
      '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>',
      '<div class="ap-detail-grid">' + rows.join("") + '</div>'
    );
  }

  function renderDetailShippingSection(order) {
    var methodInfo = SHIPPING_METHOD[order.shippingMethod];
    var rows = [];
    if (methodInfo) rows.push(detailRow("ช่องทางจัดส่ง", methodInfo.label));
    if (order.recipient) rows.push(detailRow("ผู้รับปลายทาง", order.recipient));
    if (order.shippingAddress) rows.push(detailRow("ที่อยู่จัดส่ง", order.shippingAddress, { full: true }));
    if (order.shippingTrackingId) rows.push(detailRow("เลขพัสดุ", order.shippingTrackingId));
    if (!rows.length) return "";
    return detailSection(
      "การจัดส่ง",
      '<rect x="1" y="3" width="15" height="13"/><path d="M16 8h4l3 3v5h-7V8Z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>',
      '<div class="ap-detail-grid">' + rows.join("") + '</div>'
    );
  }

  function renderDetailFilesSection(order) {
    var files = Array.isArray(order.designFiles) ? order.designFiles.filter(function (f) { return f && f.url; }) : [];
    if (!files.length) return "";
    var links = files.map(function (f) {
      return (
        '<a class="ap-detail-file-link" href="' + escapeHtml(f.url) + '" target="_blank" rel="noopener">' +
          FILE_ICON + '<span>' + escapeHtml(f.label || "ไฟล์แบบ") + '</span>' +
        '</a>'
      );
    }).join("");
    return detailSection(
      "ไฟล์แบบ",
      '<path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2Z"/>',
      '<div class="ap-detail-files">' + links + '</div>'
    );
  }

  function renderDetailQcSection(order) {
    var list = Array.isArray(order.qcChecklist) ? order.qcChecklist : [];
    if (!list.length) return "";
    var items = list.map(function (item) {
      var checked = !!item.checked;
      return (
        '<div class="ap-detail-list-item' + (checked ? " checked" : " unchecked") + '">' +
          (checked ? CHECK_ICON : CIRCLE_ICON) + '<span>' + escapeHtml(item.label || "") + '</span>' +
        '</div>'
      );
    }).join("");
    return detailSection(
      "ตรวจสอบคุณภาพ (QC)",
      '<path d="M20 6 9 17l-5-5"/>',
      '<div class="ap-detail-list">' + items + '</div>'
    );
  }

  function renderDetailNotesSection(order) {
    if (!order.notes) return "";
    return detailSection(
      "หมายเหตุ",
      '<path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2Z"/><path d="M9 13h6M9 17h6"/>',
      '<div class="ap-detail-note">' + escapeHtml(order.notes) + '</div>'
    );
  }

  function renderOrderDetailBody(order) {
    return [
      renderDetailInfoSection(order),
      renderDetailFlowSection(order),
      renderDetailSpecsSection(order),
      renderDetailFinanceSection(order),
      renderDetailShippingSection(order),
      renderDetailFilesSection(order),
      renderDetailQcSection(order),
      renderDetailNotesSection(order)
    ].filter(Boolean).join("");
  }

  var detailLastFocused = null;
  function openOrderDetail(order) {
    if (!detailOverlay || !detailBody || !order) return;
    var statusInfo = ORDER_STATUS[order.status] || { label: order.status };
    if (detailCodeEl) detailCodeEl.textContent = order.code || "\u2014";
    if (detailTitleEl) detailTitleEl.textContent = order.item || "รายละเอียดคำสั่งผลิต";
    if (detailSubEl) {
      var subParts = [];
      if (order.qty) subParts.push("จำนวน " + order.qty + " ชิ้น");
      subParts.push(statusInfo.label);
      detailSubEl.textContent = subParts.join(" \u00b7 ");
    }
    detailBody.innerHTML = renderOrderDetailBody(order);
    detailLastFocused = document.activeElement;
    detailOverlay.style.display = "flex";
    document.body.style.overflow = "hidden";
    if (detailClose) requestAnimationFrame(function () { detailClose.focus(); });
  }
  function closeOrderDetail() {
    if (!detailOverlay) return;
    detailOverlay.style.display = "none";
    document.body.style.overflow = "";
    if (detailLastFocused && typeof detailLastFocused.focus === "function") detailLastFocused.focus();
    detailLastFocused = null;
  }

  // การ์ดกดเปิดป๊อปอัพได้ทั้งใบ (คลิกเมาส์ + Enter/Space ตอนโฟกัสด้วยคีย์บอร์ด — การ์ดมี
  // tabindex="0" role="button" จาก renderOrderCard()) ยกเว้นส่วน .ap-details/<summary> เดิม
  // (ปล่อยให้ toggle ของตัวเองทำงานตามปกติ ไม่เปิดป๊อปอัพซ้อนทับ)
  function handleCardActivate(target) {
    var card = target.closest ? target.closest(".ap-item-card") : null;
    if (!card) return;
    var order = findOrderById(card.getAttribute("data-order-id"));
    if (order) openOrderDetail(order);
  }
  if (listEl) {
    listEl.addEventListener("click", function (e) {
      if (e.target.closest(".ap-details")) return;
      handleCardActivate(e.target);
    });
    listEl.addEventListener("keydown", function (e) {
      if (e.key !== "Enter" && e.key !== " ") return;
      if (e.target.closest(".ap-details")) return;
      if (!e.target.closest || !e.target.closest(".ap-item-card")) return;
      e.preventDefault();
      handleCardActivate(e.target);
    });
  }
  if (detailClose) detailClose.addEventListener("click", closeOrderDetail);
  if (detailOverlay) {
    detailOverlay.addEventListener("click", function (e) {
      if (e.target === detailOverlay) closeOrderDetail();
    });
  }
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && detailOverlay && detailOverlay.style.display === "flex") closeOrderDetail();
  });

  // ตัวบ่งชี้ "เข้าสู่ระบบด้วย LINE อยู่" ข้ามหน้า (2026-08 follow-up) — pattern เดียวกับ
  // js/my-account-page.js ทุกประการ ดูคอมเมนต์เต็มที่นั่น
  function setLoginIndicator(isActive) {
    if (typeof window.CSSignSetAccountLoggedIn === "function") window.CSSignSetAccountLoggedIn(isActive);
  }

  function afterLogin(lineUserId) {
    sessionActive = true;
    showOnly(ordersLoadingEl);
    showLinkMore(); // login สำเร็จแล้ว โชว์ปุ่ม "เชื่อมออเดอร์เพิ่ม" ไว้เลย ไม่ต้องรอออเดอร์โหลดเสร็จ
    showLogout();   // เช่นเดียวกัน โชว์ปุ่ม "ออกจากระบบ" ทันทีที่ login สำเร็จ (P2.9-A)
    setLoginIndicator(true);
    if (unsubscribeOrders) { unsubscribeOrders(); unsubscribeOrders = null; }
    unsubscribeOrders = listenMyOrders(lineUserId, renderOrders, onOrdersError);
  }

  // ===========================
  // ออกจากระบบ (P2.9-A)
  // ===========================
  // signOut(auth) ฝั่ง Firebase ผ่าน logoutAdmin() เดิม + liff.logout() ถ้า LIFF session ยังค้าง
  // login อยู่ (กันกรณีที่ liff ยัง isLoggedIn()=true อยู่ แล้ว runLiffFlow() รอบหน้าจะ auto
  // login กลับเข้าไปทันทีโดยไม่ทันได้เห็นปุ่ม login เลย — round B ค่อยจัดการเรื่อง "จำ session"
  // แบบเต็มรูปแบบ รอบนี้แค่ทำให้ปุ่ม logout ทำงานจริงตามชื่อก่อน) ไม่ redirect ออกจากหน้านี้ —
  // reset UI state กลับไปหน้า "เข้าสู่ระบบด้วย LINE" เดิมตรงๆ
  function handleLogout() {
    if (!logoutBtn || logoutBtn.disabled) return;
    logoutBtn.disabled = true;
    sessionActive = false; // ตั้งก่อนเรียก logoutAdmin() กันไม่ให้ onAuthChange() ด้านล่างมาซ้อนทำงาน handleSessionLost() อีกรอบ
    if (unsubscribeOrders) { unsubscribeOrders(); unsubscribeOrders = null; }
    Promise.resolve(logoutAdmin())
      .catch(function (err) {
        console.error("my-orders logout error:", err);
      })
      .finally(function () {
        try {
          if (liffInstance && liffInstance.isLoggedIn && liffInstance.isLoggedIn()) {
            liffInstance.logout();
          }
        } catch (err) {
          console.error("liff logout error:", err);
        }
        listEl.innerHTML = "";
        hideLinkMore();
        hideLogout();
        showOnly(loginEl);
        logoutBtn.disabled = false;
        setLoginIndicator(false);
      });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", handleLogout);
  }

  // ===========================
  // เซสชันหลุดจากที่อื่น + auth ยังไม่ resolve ตอนหน้าโหลด (2026-08 follow-up รอบ 2) — 2 ปัญหาที่
  // เจอจริงหลังปล่อยรอบแรก:
  //
  // (1) auth.currentUser race ตอนหน้าโหลด — เดิม runLiffFlow(false) ถูกเรียกทันทีตอนสคริปต์รัน
  // (ท้ายไฟล์) ซึ่ง auth.currentUser ยังไม่ทันถูก resolve เสร็จ (Firebase อ่าน persisted session จาก
  // IndexedDB แบบ async เสมอ ต่อให้เป็นแค่การกด "รีเฟรชหน้า" ธรรมดาไม่ใช่ redirect กลับจาก LINE ก็
  // ตาม) ทำให้ hasExistingLineSession() เช็คแล้วได้ false ทั้งที่จริงมี session ค้างอยู่ พา flow ไป
  // เรียก loginWithLine() (สร้าง custom token ใหม่) ซ้ำแข่งกับตอนที่ session เดิมกำลัง restore อยู่
  // พอดี ทำให้ auth state เปลี่ยนกลางทางไม่แน่นอน (สลับ user 2 รอบใกล้ๆ กัน) — Firestore listener ที่
  // listenMyOrders() เพิ่ง subscribe ไปได้ auth context ไม่ตรงกับตอนที่ request จริงไปถึง backend
  // กลายเป็น "Missing or insufficient permissions" (เห็นใน console ตอนแค่รีเฟรชหน้าเฉยๆ) — แก้โดย
  // รอ event แรกจาก onAuthChange() ก่อน (Firebase การันตีว่า event แรกที่ยิงมาคือ state ที่ resolve
  // เสร็จแล้วจริง — auth.currentUser ตอนนั้นจะตรงกับ user ที่ callback ได้รับเป๊ะ) แล้วค่อยเริ่ม
  // runLiffFlow(false) ตรงนั้นแทนที่จะเรียกทันทีท้ายไฟล์แบบเดิม
  //
  // (2) false positive จากรอบก่อนหน้า — เพราะเหตุผลเดียวกับข้อ (1) เบราว์เซอร์เดียวกันที่เปิดหลาย
  // แท็บของเว็บนี้พร้อมกัน (Firebase sync auth state ข้ามแท็บผ่าน storage event) บางจังหวะ
  // onAuthStateChanged จะยิง event แปลกๆ ชั่วครู่ (เช่น null สั้นๆ) ระหว่างที่แท็บอื่นกำลัง
  // init/sync ตัวเองอยู่ ทั้งที่ session จริงยังปกติดี — ถ้า handleSessionLost() ทำงานทันทีตาม event
  // แรกที่เจอ จะโดน "เตะ" ออกจากระบบ error message เร็วเกินไปทั้งที่ไม่มีอะไรผิดจริง (ตามที่เจอในหน้า
  // my-account.html) — แก้โดยหน่วงเช็คซ้ำ 1.5 วิ (sessionLostTimer) ก่อนค่อยเชื่อว่า session หลุด
  // จริง ถ้าระหว่างนั้น auth state กลับมาเป็น session ลูกค้า LINE ปกติอีกครั้ง (หรือ logout ปกติผ่าน
  // handleLogout() ไปแล้ว) จะยกเลิกไม่ทำ handleSessionLost() เลย
  // ===========================
  var authReady = false;
  var sessionLostTimer = null;

  function handleSessionLost() {
    sessionActive = false;
    if (unsubscribeOrders) { unsubscribeOrders(); unsubscribeOrders = null; }
    try {
      if (liffInstance && liffInstance.isLoggedIn && liffInstance.isLoggedIn()) {
        liffInstance.logout();
      }
    } catch (err) {
      console.error("liff logout error (session lost):", err);
    }
    listEl.innerHTML = "";
    hideLinkMore();
    hideLogout();
    showOnly(loginEl);
    showError("เซสชันหมดอายุหรือออกจากระบบจากอุปกรณ์/แท็บอื่น กรุณาเข้าสู่ระบบใหม่อีกครั้ง");
    setLoginIndicator(false);
  }

  onAuthChange(function (user) {
    if (!authReady) {
      // event แรกจาก Firebase = auth state ที่ resolve เสร็จแล้วจริง (ดูข้อ (1) ด้านบน) — เริ่ม
      // flow login จริงตอนนี้แทนที่จะเรียกทันทีท้ายไฟล์แบบเดิม
      authReady = true;
      showOnly(loadingEl);
      runLiffFlow(false);
      return;
    }
    if (!sessionActive) return; // ยังไม่เคย login สำเร็จในหน้านี้ หรือ logout ไปแล้ว
    var stillLineSession = !!(user && typeof user.uid === "string" && user.uid.indexOf("line_") === 0);
    if (stillLineSession) {
      if (sessionLostTimer) { clearTimeout(sessionLostTimer); sessionLostTimer = null; } // session กลับมาปกติทัน ยกเลิกที่รอเช็คไว้
      return;
    }
    if (sessionLostTimer) return; // กำลังรอเช็คซ้ำอยู่แล้ว ไม่ต้องตั้งซ้อน
    sessionLostTimer = setTimeout(function () {
      sessionLostTimer = null;
      if (!sessionActive) return; // logout ปกติไปแล้วระหว่างที่รอ ไม่ต้องทำซ้ำ
      handleSessionLost();
    }, 1500);
  });

  function loginErrorMessage(code) {
    if (code === "invalid_line_token") return "ยืนยันตัวตนผ่าน LINE ไม่สำเร็จ กรุณาลองเข้าสู่ระบบใหม่อีกครั้ง";
    if (code === "server_misconfigured") return "ระบบเข้าสู่ระบบขัดข้องชั่วคราว กรุณาลองใหม่ภายหลัง หรือโทร 062-883-3880";
    return "เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง หรือโทร 062-883-3880";
  }

  // ===========================
  // เชื่อมออเดอร์เพิ่ม (P2.8c-F)
  // ===========================
  // ปุ่ม "เชื่อมออเดอร์เพิ่ม" + ฟอร์ม PO/เบอร์โทร ที่โผล่หลัง login LINE สำเร็จแล้ว (ดู
  // showLinkMore()/hideLinkMore() ที่เรียกจาก afterLogin()/runLiffFlow() ด้านล่าง) — ใช้ liff
  // session เดิม (เก็บ instance ไว้ที่ liffInstance ตอน runLiffFlow() สำเร็จ) เรียก
  // linkLineAccount() เดิมจาก js/db-orders.js (P1.5) ซ้ำตรงๆ เหมือน handleLineLinkClick() ใน
  // js/track-modal.js — ต่างกันแค่ไม่ต้อง liff.login()/redirect ใหม่เพราะ login ค้างอยู่แล้วแน่นอน
  // (ฟอร์มนี้โผล่หลัง login สำเร็จเท่านั้น)
  function showLogout() {
    if (logoutEl) logoutEl.style.display = "block";
  }
  function hideLogout() {
    if (logoutEl) logoutEl.style.display = "none";
  }

  function showLinkMore() {
    if (linkMoreEl) linkMoreEl.style.display = "block";
  }
  function hideLinkMore() {
    if (linkMoreEl) linkMoreEl.style.display = "none";
    if (linkMoreForm) linkMoreForm.style.display = "none";
    if (linkMoreToggle) linkMoreToggle.style.display = "inline-flex";
  }
  function showLinkMoreMsg(msg) {
    if (linkMoreMsgEl) linkMoreMsgEl.textContent = msg;
  }
  function hideLinkMoreMsg() {
    if (linkMoreMsgEl) linkMoreMsgEl.textContent = "";
  }
  function linkMoreErrorMessage(code) {
    if (code === "invalid_line_token") return "ยืนยันตัวตนผ่าน LINE ไม่สำเร็จ กรุณาลองรีเฟรชหน้าใหม่แล้วลองอีกครั้ง";
    if (code === "order_not_found") return "ข้อมูลเลขที่ PO หรือเบอร์โทรไม่ตรงกับคำสั่งผลิตใดเลย กรุณาลองตรวจสอบอีกครั้ง";
    return "เกิดข้อผิดพลาดในการเชื่อมออเดอร์ กรุณาลองใหม่อีกครั้ง หรือโทร 062-883-3880";
  }

  if (linkMoreToggle) {
    linkMoreToggle.addEventListener("click", function () {
      if (!linkMoreForm) return;
      var showing = linkMoreForm.style.display !== "none";
      linkMoreForm.style.display = showing ? "none" : "block";
      linkMoreToggle.style.display = showing ? "inline-flex" : "none";
      if (!showing && linkMoreCodeEl) linkMoreCodeEl.focus();
    });
  }

  if (linkMoreForm) {
    linkMoreForm.addEventListener("submit", function (e) {
      e.preventDefault();
      if (linkMoreSubmit.disabled) return;
      hideLinkMoreMsg();

      var code = linkMoreCodeEl.value.trim();
      var phone = linkMorePhoneEl.value.trim();
      if (!code) { showLinkMoreMsg("กรุณากรอกเลขที่คำสั่งผลิต (PO)"); return; }
      if (phone.replace(/\D/g, "").length < 4) { showLinkMoreMsg("กรุณากรอกเบอร์โทรอย่างน้อย 4 หลักสุดท้าย"); return; }

      linkMoreSubmit.disabled = true;
      var originalLabel = linkMoreSubmit.textContent;
      linkMoreSubmit.textContent = "กำลังเชื่อม...";

      // ใช้ liffInstance ที่ login ค้างไว้แล้วจาก runLiffFlow() — ไม่เรียก liff.login() ซ้ำเพราะ
      // ฟอร์มนี้โผล่หลัง login สำเร็จเท่านั้น (ถ้า liffInstance หายไปด้วยเหตุผลใดก็ตาม โหลด/init
      // ใหม่เงียบๆ แทนที่จะพังทั้งฟอร์ม)
      (liffInstance ? Promise.resolve(liffInstance) : loadLiffSdk().then(function (liff) {
        return liff.init({ liffId: LIFF_ID }).then(function () { return liff; });
      }))
        .then(function (liff) {
          liffInstance = liff;
          var idToken = liff.getIDToken();
          if (!idToken) throw Object.assign(new Error("missing id token"), { code: "missing_id_token" });
          return linkLineAccount(idToken, code, phone);
        })
        .then(function () {
          // ไม่ต้อง re-render ลิสต์เอง — listenMyOrders() ที่ subscribe อยู่แล้วจาก afterLogin()
          // จะได้ snapshot update อัตโนมัติทันทีที่ linkLineAccount() เขียน lineUserId ลง order
          linkMoreCodeEl.value = "";
          linkMorePhoneEl.value = "";
          linkMoreForm.style.display = "none";
          linkMoreToggle.style.display = "inline-flex";
        })
        .catch(function (err) {
          console.error("link more order error:", err);
          showLinkMoreMsg(linkMoreErrorMessage(err && err.code));
        })
        .finally(function () {
          linkMoreSubmit.disabled = false;
          linkMoreSubmit.textContent = originalLabel;
        });
    });
  }

  // จุดเดียวที่ orchestrate ทั้ง flow (เหมือน handleLineLinkClick() ใน track-modal.js) — เรียก
  // ทั้งตอนกดปุ่ม "เข้าสู่ระบบด้วย LINE" และตอนหน้าโหลดครั้งแรก (เผื่อเป็นการกลับมาจาก
  // liff.login() redirect ที่ login สำเร็จแล้ว — จะได้ไม่ต้องให้ลูกค้ากดปุ่มซ้ำอีกรอบ)
  //
  // จำ session เดิม (P2.9-B) — เช็ค auth.currentUser ตรงๆ ก่อนเข้า flow LIFF ทุกครั้ง (ทั้งตอนโหลด
  // หน้าครั้งแรกและตอนกดปุ่ม login เอง — ในทางปฏิบัติปุ่ม login จะโชว์เฉพาะตอนยังไม่มี session
  // อยู่แล้ว แต่เช็คซ้ำไว้ให้ชัวร์ไม่มีผลเสีย) ถ้ามี session ลูกค้า LINE เดิมค้างอยู่แล้ว (ต้องเช็ค
  // prefix "line_" ที่ uid ให้ชัดเจนก่อน — กันเคสที่บังเอิญเป็น session แอดมินค้างอยู่ในเบราว์เซอร์
  // เดียวกัน ซึ่งต้องไม่ถูกนับเป็น session ลูกค้า ต้องไป flow liff.login() ตามปกติ) ให้ข้าม
  // liff.init()/liff.login() ทั้งหมดไป afterLogin() ตรงๆ เลย ไม่ต้องรอโหลด LIFF SDK ด้วยซ้ำ เพราะ
  // listenMyOrders() ทำงานได้จาก lineUserId (uid) อย่างเดียวไม่ต้องพึ่ง LIFF SDK เลย (liffInstance
  // จะยังเป็น null ในเคสนี้ — ปุ่ม "เชื่อมออเดอร์เพิ่ม" จะ lazy-load/init LIFF เองตอนกดใช้งานจริง
  // อยู่แล้ว ดู handleLinkMoreSubmit ด้านบน)
  function hasExistingLineSession() {
    var user = auth && auth.currentUser;
    return !!(user && typeof user.uid === "string" && user.uid.indexOf("line_") === 0);
  }

  // คืน lineUserId ดิบ (ตัด prefix "line_" ออกจาก uid) เมื่อมี session ลูกค้า LINE เดิมค้างอยู่ —
  // ใช้เฉพาะ path ที่ shortcut ข้าม flow liff.login() ปกติไป (path ปกติได้ lineUserId ดิบตรงๆ จาก
  // response ของ loginWithLine() อยู่แล้ว ไม่ต้องพึ่งฟังก์ชันนี้) — แก้บั๊กที่พบระหว่าง P2.9-D2:
  // เดิมโค้ดส่ง auth.currentUser.uid ที่มี prefix "line_" ติดไปด้วยเข้า listenMyOrders() ตรงๆ ซึ่งไม่
  // ตรงกับ order.lineUserId ที่เก็บแบบไม่มี prefix ทำให้ query ไม่ match ออเดอร์เลยสักรายการตอนมี
  // session เดิมค้างอยู่ (เคส login ครั้งแรกสดๆ ไม่กระทบ) — pattern ตัด prefix เดียวกับ
  // existingSessionLineUserId() ใน js/my-account-page.js (P2.9-D2/D3) และ saveLead() ใน
  // js/leads.js (P2.9-D1)
  function existingSessionLineUserId() {
    var user = auth && auth.currentUser;
    if (user && typeof user.uid === "string" && user.uid.indexOf("line_") === 0) {
      return user.uid.slice("line_".length);
    }
    return null;
  }

  function runLiffFlow(fromButtonClick) {
    if (hasExistingLineSession()) {
      afterLogin(existingSessionLineUserId());
      return;
    }
    loadLiffSdk()
      .then(function (liff) {
        return liff.init({ liffId: LIFF_ID }).then(function () {
          liffInstance = liff; // เก็บไว้ให้ handleLinkMoreSubmit ใช้ซ้ำ ไม่ต้อง init() ใหม่
          if (!liff.isLoggedIn()) {
            if (fromButtonClick) {
              liff.login(); // redirect ออกจากหน้านี้แล้วกลับมาเอง
              return null;
            }
            // เช็คตอนหน้าโหลดครั้งแรก ยังไม่เคย login มาก่อน — โชว์ปุ่มให้กดเอง ไม่ redirect เอง
            hideLinkMore();
            hideLogout();
            showOnly(loginEl);
            return undefined;
          }
          var idToken = liff.getIDToken();
          if (!idToken) throw Object.assign(new Error("missing id token"), { code: "missing_id_token" });
          return loginWithLine(idToken);
        });
      })
      .then(function (result) {
        if (result === undefined) return; // แสดงปุ่ม login ไปแล้ว ไม่ต้องทำอะไรต่อ
        if (result === null) return; // กำลัง redirect ไป liff.login()
        afterLogin(result.lineUserId);
      })
      .catch(function (err) {
        console.error("my-orders login error:", err);
        hideLinkMore();
        hideLogout();
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

  // เดิมเรียก runLiffFlow(false) ตรงนี้ทันที — ย้ายไปเรียกตอน onAuthChange() ยิง event แรกแทน (ดู
  // คอมเมนต์ยาวที่จุด subscribe ด้านบน หัวข้อ "เซสชันหลุดจากที่อื่น + auth ยังไม่ resolve ตอนหน้า
  // โหลด") กัน auth.currentUser race ตอนหน้าโหลด/รีเฟรช — showOnly(loadingEl) ยังคงอยู่ตรงนี้เพื่อให้
  // เห็น loading state ทันทีระหว่างรอ event แรกนั้น (ปกติเร็วมาก แต่กันจอกระพริบ)
  showOnly(loadingEl);
})();
