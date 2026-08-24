// ===========================
// js/my-orders-page-en.js — controls the English "My Orders" page (en/my-orders.html) — P2.8c-I
// ===========================
// English-text duplicate of js/my-orders-page.js (P2.8c-E/F), following the same pattern as
// js/products-detail-popup-en.js — the project keeps a separate `-en.js` file per bilingual page
// instead of runtime language-detection inside one file. Logic, element ids, and flow are
// identical to js/my-orders-page.js; only user-facing strings differ. Any future logic fix to
// my-orders-page.js should be mirrored here too (see comment left in my-orders-page.js at the
// consumer import, and the note added to REFACTOR-PROGRESS.md/CHANGELOG.md for this round).
import { loginWithLine, listenMyOrders, linkLineAccount, ORDER_STATUS } from "./db-orders.js";
// Customer-side signOut (P2.9-A2, mirrors P2.9-A1) — uses the existing logoutAdmin() from
// js/db.js directly (wraps signOut(auth), the same auth instance the admin uses — see
// p2.9-account-hub-plan.md for why no separate signOutCustomer() alias was added this round).
// auth (P2.9-B) — check auth.currentUser directly before entering the liff.login() flow every
// time; if an existing LINE customer session is already there (uid starting with "line_"), skip
// straight to afterLogin() instead of forcing a re-login (see "P2.9-B" in
// p2.9-account-hub-plan.md).
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
  // Log out button (P2.9-A2, mirrors P2.9-A1) — same as linkMoreEl below: must stay visible
  // alongside the "logged in" states (orders-loading/empty/list), not part of the 5-state
  // showOnly() group, so visibility is controlled separately via showLogout()/hideLogout()
  var logoutEl         = document.getElementById("mo-logout");
  var logoutBtn        = document.getElementById("mo-logout-btn");
  // "Link another order" (P2.8c-F parity) — shown only after successful login, controlled
  // separately from the 5-state showOnly() group (see my-orders-page.js for the full rationale).
  var linkMoreEl       = document.getElementById("mo-link-more");
  var linkMoreToggle   = document.getElementById("mo-link-more-toggle");
  var linkMoreForm     = document.getElementById("mo-link-more-form");
  var linkMoreCodeEl   = document.getElementById("mo-link-more-code");
  var linkMorePhoneEl  = document.getElementById("mo-link-more-phone");
  var linkMoreSubmit   = document.getElementById("mo-link-more-submit");
  var linkMoreMsgEl    = document.getElementById("mo-link-more-msg");
  if (!loadingEl || !loginEl || !listEl) return; // not on en/my-orders.html

  // Same LIFF_ID as js/track-modal.js / js/my-orders-page.js (P1.5/P2.8c) — must match
  // [vars] LIFF_ID in cloudflare-worker/wrangler.toml exactly.
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
        reject(new Error("Failed to load LIFF SDK"));
      };
      document.head.appendChild(script);
    });
    return liffSdkPromise;
  }

  // Kept from the successful runLiffFlow() call so the "link another order" form (P2.8c-F) can
  // reuse the same LIFF session without calling liff.init() again.
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

  // Single order card — reuses the existing .tm-* classes from css/track-modal.css (already
  // loaded on every page) instead of adding new CSS, same as my-orders-page.js.
  function renderOrderCard(order) {
    var statusInfo = ORDER_STATUS[order.status] || { label: order.status, css: "received" };
    var progress = Math.max(0, Math.min(100, order.progress || 0));
    return (
      '<div style="border:1px solid var(--gray-100); border-radius:var(--r-lg); padding:18px 20px; background:var(--bg);">' +
        '<div style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px; margin-bottom:10px;">' +
          '<div>' +
            '<div class="tm-result-code">' + escapeHtml(order.code || "\u2014") + '</div>' +
            '<div class="tm-result-item">' + escapeHtml(order.item || "") + (order.qty ? " \u00b7 Qty " + escapeHtml(String(order.qty)) : "") + '</div>' +
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
    showOnly(listEl); // keep whatever is already on screen instead of clearing it on a transient error
    showError("Failed to load your orders. Please refresh the page or call +66 62-883-3880");
  }

  function afterLogin(lineUserId) {
    showOnly(ordersLoadingEl);
    showLinkMore(); // login succeeded — show "link another order" right away, no need to wait for orders to load
    showLogout();   // same idea — show the "log out" button as soon as login succeeds (P2.9-A2)
    if (unsubscribeOrders) { unsubscribeOrders(); unsubscribeOrders = null; }
    unsubscribeOrders = listenMyOrders(lineUserId, renderOrders, onOrdersError);
  }

  // ===========================
  // Log out (P2.9-A2, mirrors P2.9-A1)
  // ===========================
  // signOut(auth) on the Firebase side via the existing logoutAdmin() + liff.logout() if a LIFF
  // session is still active (avoids the next runLiffFlow() auto-logging back in before the
  // login button is even visible — full "remember session" handling is P2.9-B). Does not
  // redirect away from this page — resets the UI back to the "Log in with LINE" state.
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
    if (code === "invalid_line_token") return "LINE verification failed. Please try logging in again.";
    if (code === "server_misconfigured") return "The login system is temporarily unavailable. Please try again later or call +66 62-883-3880";
    return "Login failed. Please try again or call +66 62-883-3880";
  }

  // ===========================
  // Link another order (P2.8c-F parity)
  // ===========================
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
    if (code === "invalid_line_token") return "LINE verification failed. Please refresh the page and try again.";
    if (code === "order_not_found") return "No order matches that PO number and phone number. Please double-check and try again.";
    return "Something went wrong linking this order. Please try again or call +66 62-883-3880";
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
      if (!code) { showLinkMoreMsg("Please enter the PO number"); return; }
      if (phone.replace(/\D/g, "").length < 4) { showLinkMoreMsg("Please enter at least the last 4 digits of your phone number"); return; }

      linkMoreSubmit.disabled = true;
      var originalLabel = linkMoreSubmit.textContent;
      linkMoreSubmit.textContent = "Linking...";

      // Reuse the liffInstance kept from runLiffFlow() — no liff.login() redirect needed since
      // this form only appears after a successful login. Fall back to a silent re-init if the
      // instance is somehow missing rather than breaking the whole form.
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
          // No need to re-render the list ourselves — the listenMyOrders() subscription from
          // afterLogin() gets a snapshot update automatically as soon as linkLineAccount() writes
          // lineUserId onto the order.
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

  // Orchestrates the whole flow (same shape as handleLineLinkClick() in track-modal.js) —
  // called both from the "Log in with LINE" button click and on first page load (in case this
  // is a return from a liff.login() redirect that already succeeded).
  //
  // Remember existing session (P2.9-B) — check auth.currentUser directly before entering the
  // LIFF flow every time (both on first page load and on the login button click — in practice
  // the login button only shows when there's no session already, but re-checking here doesn't
  // hurt). If an existing LINE customer session is already there (must check the "line_" uid
  // prefix explicitly — guards against a stray admin session in the same browser being mistaken
  // for a customer session, which must still go through the normal liff.login() flow), skip
  // liff.init()/liff.login() entirely and go straight to afterLogin() — no need to even wait for
  // the LIFF SDK to load, since listenMyOrders() only needs the lineUserId (uid), not the LIFF
  // SDK itself (liffInstance stays null in this case — the "link another order" button lazily
  // loads/inits LIFF itself when actually clicked, see handleLinkMoreSubmit above).
  function hasExistingLineSession() {
    var user = auth && auth.currentUser;
    return !!(user && typeof user.uid === "string" && user.uid.indexOf("line_") === 0);
  }

  // Returns the raw lineUserId (with the "line_" prefix stripped off the uid) when an existing
  // LINE customer session is present — only used on the path that shortcuts past the normal
  // liff.login() flow (the normal path already gets a raw lineUserId straight from the
  // loginWithLine() response, no need for this). Fixes a bug found during P2.9-D2: the code used
  // to pass auth.currentUser.uid — which still has the "line_" prefix — straight into
  // listenMyOrders(), which didn't match order.lineUserId (stored without the prefix), so no
  // orders would ever match when an existing session was found (a fresh first-time login was
  // unaffected). Same prefix-stripping pattern as existingSessionLineUserId() in
  // js/my-account-page.js / js/my-account-page-en.js (P2.9-D2/D3) and saveLead() in js/leads.js
  // (P2.9-D1).
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
          liffInstance = liff; // kept for the "link more" submit handler, avoids re-init()
          if (!liff.isLoggedIn()) {
            if (fromButtonClick) {
              liff.login(); // redirects away from this page and back
              return null;
            }
            // First page load, never logged in before — show the button, don't auto-redirect.
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
        if (result === undefined) return; // already showing the login button
        if (result === null) return; // redirecting to liff.login()
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

  // Kick off the flow automatically on page load (checks whether we're already logged in — e.g.
  // returning from a liff.login() redirect, or a LIFF session already open in this tab).
  showOnly(loadingEl);
  runLiffFlow(false);
})();
