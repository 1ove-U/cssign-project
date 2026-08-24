// ===========================
// js/my-orders-page.js — ควบคุมหน้า "ออเดอร์ของฉัน" (my-orders.html) — P2.8c-E
// ===========================
// LINE = ตัวตนลูกค้าเดียว ไม่มี password/OTP แยก (ดูแผนเต็มใน p2.8c-line-customer-plan.md) —
// หน้านี้เป็น consumer ตัวแรกของ loginWithLine()/listenMyOrders() ที่เพิ่มไว้ใน js/db-orders.js
// รอบ P2.8c-D — ต่างจาก js/track-modal.js (P1.5) ตรงที่ track-modal.js ต้อง "เชื่อมบัญชี" กับ
// order เดียวก่อนด้วยเลข PO/เบอร์โทร ส่วนหน้านี้ login ด้วย LINE อย่างเดียวแล้วเห็นทุกออเดอร์ที่
// เคยเชื่อมไว้แล้วทันที (ไม่ต้องรู้เลข PO ล่วงหน้า)
import { loginWithLine, listenMyOrders, linkLineAccount, ORDER_STATUS } from "./db-orders.js";
// signOut ฝั่งลูกค้า (P2.9-A) — ใช้ logoutAdmin() เดิมจาก js/db.js ตรงๆ (ครอบ signOut(auth) ตัว
// เดียวกับที่แอดมินใช้ — ดูเหตุผลใน p2.9-account-hub-plan.md ว่าทำไมไม่เพิ่ม alias
// signOutCustomer() ใหม่ในรอบนี้: ชื่อสื่อความหมายฝั่งแอดมินก็จริง แต่ทำงานกับ auth instance
// เดียวกันเป๊ะ เพิ่มโค้ดซ้ำโดยไม่จำเป็นถ้าจะทำแค่ alias เฉยๆ — พิจารณาเปลี่ยนเป็น alias ทีหลังถ้า
// เริ่มมี consumer หลายจุดที่อยากได้ชื่อสื่อความหมายกว่านี้จริงๆ)
// เพิ่ม auth (P2.9-B) — เช็ค auth.currentUser ตรงๆ ก่อนเข้า flow liff.login() ทุกครั้ง ถ้ามี
// session ลูกค้า LINE เดิมค้างอยู่แล้ว (uid ขึ้นต้น "line_") ข้ามไป afterLogin() ได้เลย ไม่ต้อง
// บังคับ login ซ้ำ (ดูรายละเอียดที่หัวข้อ "P2.9-B" ใน p2.9-account-hub-plan.md)
import { logoutAdmin, auth } from "./db.js";

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

  // การ์ดออเดอร์เดี่ยว — ใช้ class .tm-* เดิมจาก css/track-modal.css ซ้ำ (โหลดอยู่แล้วทุกหน้า)
  // แทนที่จะเพิ่ม CSS ใหม่ในรอบนี้ (ตามแผน P2.8c-E: เริ่มจาก html+js ก่อน เพิ่ม CSS เฉพาะทาง
  // ในรอบ P2.8c-F ถ้าจำเป็นจริงๆ)
  function renderOrderCard(order) {
    var statusInfo = ORDER_STATUS[order.status] || { label: order.status, css: "received" };
    var progress = Math.max(0, Math.min(100, order.progress || 0));
    return (
      '<div style="border:1px solid var(--gray-100); border-radius:var(--r-lg); padding:18px 20px; background:var(--bg);">' +
        '<div style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px; margin-bottom:10px;">' +
          '<div>' +
            '<div class="tm-result-code">' + escapeHtml(order.code || "\u2014") + '</div>' +
            '<div class="tm-result-item">' + escapeHtml(order.item || "") + (order.qty ? " \u00b7 \u0e08\u0e33\u0e19\u0e27\u0e19 " + escapeHtml(String(order.qty)) : "") + '</div>' +
          '</div>' +
          '<span class="tm-badge ' + statusInfo.css + '">' + escapeHtml(statusInfo.label) + '</span>' +
        '</div>' +
        (order.status !== "cancelled" ?
          '<div class="tm-progress-bar"><i style="width:' + progress + '%"></i></div>'
        : "") +
      '</div>'
    );
  }

  function renderOrders(orders) {
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

  function afterLogin(lineUserId) {
    showOnly(ordersLoadingEl);
    showLinkMore(); // login สำเร็จแล้ว โชว์ปุ่ม "เชื่อมออเดอร์เพิ่ม" ไว้เลย ไม่ต้องรอออเดอร์โหลดเสร็จ
    showLogout();   // เช่นเดียวกัน โชว์ปุ่ม "ออกจากระบบ" ทันทีที่ login สำเร็จ (P2.9-A)
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
      });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", handleLogout);
  }

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

  // เริ่ม flow อัตโนมัติตอนหน้าโหลด (เช็คว่า login ค้างอยู่แล้วหรือยัง — เผื่อกลับมาจาก
  // liff.login() redirect หรือเคยเปิด LIFF ผ่านมาก่อนหน้านี้ในเซสชันเดียวกัน)
  showOnly(loadingEl);
  runLiffFlow(false);
})();
