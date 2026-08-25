// ===========================
// js/my-account-page-en.js — controls the English "My Account" page (en/my-account.html) — P2.9-C2,
// leads panel UI mirrored in P2.9-D3, quote-request panel switched to quote_requests in P3.0
// Phase 5 round 9
// ===========================
// English-text duplicate of js/my-account-page.js (P2.9-C, leads panel added in P2.9-D2, switched
// to quote_requests in P3.0 Phase 5 round 8), following the same pattern as
// js/my-orders-page-en.js (P2.8c-I) — the project keeps a separate `-en.js` file per bilingual
// page instead of runtime language-detection inside one file. Logic, element ids, and flow are
// identical to js/my-account-page.js; only user-facing strings (and comments) differ. Any future
// logic fix to my-account-page.js should be mirrored here too.
//
// Central hub page (hub) showing a brief LINE profile (name/picture from liff.getProfile()) plus
// a menu of links out to each section — "My Orders" still links straight to the existing
// my-orders.html (not merged into one page this round, see p2.9-account-hub-plan.md "รอบ
// P2.9-C"). "My Quote Requests" is shown inline on this page as an expand/collapse panel instead,
// no redirect — same as the Thai page. Differs from js/my-orders-page-en.js in that this page
// always needs a live liff instance to call liff.getProfile() — so it does not shortcut past
// liff.init() entirely even when an existing Firebase session is present (it only shortcuts past
// the network call to loginWithLine() in that case — see runLiffFlow() below).
//
// P3.0 Phase 5 round 9 — mirrors the round-8 decision made on the Thai page: this panel now
// replaces listenMyLeads() entirely with listenMyQuoteRequests() (no side-by-side panels). See
// the long comment at the top of js/my-account-page.js and REFACTOR-PROGRESS.md "P3.0 Phase 5
// รอบ 8" for the full reasoning — not re-decided here, just mirrored. All `ma-leads-*` element
// ids are kept unchanged (ids are not translated per project convention).
import { loginWithLine } from "./db-orders.js";
// Same signOut + auth as js/my-orders-page-en.js uses from P2.9-A2/B — copied straight over per
// this round's prompt (not abstracted into a shared module ahead of time).
import { logoutAdmin, auth, onAuthChange } from "./db.js";
// Quote request history (P3.0 Phase 5 round 9) — listenMyQuoteRequests() (js/db-quote-requests.js)
// was already wired into the Thai page in round 8; this round wires the same function into the
// English page, replacing listenMyLeads() (js/leads.js). No `-en` version of
// js/db-quote-requests.js exists — the data layer isn't language-split.
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
  // "My Quote Requests" section (P2.9-D3) — all-new elements, not present on older pages/tests
  // yet, so every use below is guarded with if (el) (same pattern as P2.9-A/B before it).
  var leadsToggle       = document.getElementById("ma-leads-toggle");
  var leadsPanel        = document.getElementById("ma-leads-panel");
  var leadsChevron      = document.getElementById("ma-leads-chevron");
  var leadsLoadingEl    = document.getElementById("ma-leads-loading");
  var leadsEmptyEl      = document.getElementById("ma-leads-empty");
  var leadsErrorEl      = document.getElementById("ma-leads-error");
  var leadsErrorTextEl  = document.getElementById("ma-leads-error-text");
  var leadsListEl       = document.getElementById("ma-leads-list");
  if (!loadingEl || !loginEl || !profileEl) return; // not on en/my-account.html

  // Same LIFF_ID as js/my-account-page.js / js/my-orders-page-en.js / js/track-modal.js (P1.5) —
  // must match [vars] LIFF_ID in cloudflare-worker/wrangler.toml exactly.
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

  var liffInstance = null;

  // Raw lineUserId (no "line_" prefix) of the customer currently logged in — kept around so
  // toggleLeadsPanel() can call listenMyQuoteRequests() the first time the panel is expanded (see
  // afterLogin()/handleLogout() below, which set/reset this value). Must be the raw value that
  // matches the lead.lineUserId field in Firestore exactly (no "line_" prefix like
  // auth.currentUser.uid has) or the query in listenMyQuoteRequests() won't match anything.
  var currentLineUserId = null;
  var unsubscribeLeads = null;

  // Tracks whether the page is currently in the "logged in" state (afterLogin() has run, no
  // logout yet) — keeps the onAuthChange() subscription below from firing during the normal
  // runLiffFlow() startup flow (same pattern as js/my-orders-page-en.js).
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

  // Check for an existing LINE customer session (P2.9-B pattern, same as my-account-page.js /
  // my-orders-page-en.js) — used only to "skip the network call to loginWithLine() (Cloudflare
  // Worker)", not to skip liff.init() entirely like the orders page does, because this page
  // always needs a live liff instance to call getProfile().
  function hasExistingLineSession() {
    var user = auth && auth.currentUser;
    return !!(user && typeof user.uid === "string" && user.uid.indexOf("line_") === 0);
  }

  // Returns the raw lineUserId (strips the "line_" prefix off uid) when an existing LINE
  // customer session is present — only used on the path that shortcuts past loginWithLine()
  // (the normal loginWithLine() path already gets the raw lineUserId straight from the response,
  // no need for this helper there). Same prefix-stripping pattern as saveLead() in js/leads.js
  // (P2.9-D1).
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
  // My Quote Requests (P3.0 Phase 5 round 9) — expand/collapse panel + lazy
  // listenMyQuoteRequests() subscription (subscribes only the first time the panel is expanded,
  // not right away on login — see the matching comment in en/my-account.html for why this
  // differs from "My Orders") — enum matches js/db-quote-requests.js: new | quoted | closed
  // (same as the Thai page — mirrors the round-8 decision, not re-decided here).
  // ===========================
  var QUOTE_REQUEST_STATUS_INFO = {
    new:    { label: "Pending",      css: "received" },
    quoted: { label: "Quote issued", css: "qc" },
    closed: { label: "Closed",       css: "ok" }
  };

  function requestDateLabel(qr) {
    var ts = qr && qr.createdAt;
    if (!ts) return "\u2014";
    var ms = ts.toMillis ? ts.toMillis() : (typeof ts === "number" ? ts : null);
    if (!ms) return "\u2014";
    return new Date(ms).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
  }

  // Summarizes a single item as one line — shape matches sanitizeItem() in
  // js/db-quote-requests.js (productId/name/variantLabel/size/material/qty/unit/note) — a
  // different shape from quotations.items (no unitPrice/discount/lineTotal since a customer's
  // request doesn't have pricing yet). Mirrors formatQuoteItemLine() in js/my-account-page.js.
  function formatQuoteItemLine(item) {
    var descParts = [item.name, item.variantLabel, item.size, item.material].filter(Boolean);
    var qty = (typeof item.qty === "number" && item.qty > 0) ? item.qty : 1;
    var unit = item.unit || "pc";
    return escapeHtml(descParts.join(" \u00b7 ")) + ' <span style="color:var(--gray-500);">\u00d7 ' + escapeHtml(String(qty)) + ' ' + escapeHtml(unit) + '</span>';
  }

  // A single quote-request card — reuses the existing .tm-badge class from css/track-modal.css
  // (already loaded on every page), same as js/my-orders-page-en.js does for order cards. No new
  // CSS added this round. If quotePublicToken is present (admin has issued a real quotation from
  // this request), shows a link to the public quotation-view.html page in a new tab (same
  // target="_blank" rel="noopener noreferrer" pattern as the attachment links in
  // js/track-modal.js) — quotation-view.html has no separate EN version (confirmed via `find .
  // -iname "quotation-view*"`), so this links to the same Thai-language public page as the Thai
  // account page does.
  function renderQuoteRequestCard(qr) {
    var statusInfo = QUOTE_REQUEST_STATUS_INFO[qr.status] || { label: qr.status || "\u2014", css: "received" };
    var items = Array.isArray(qr.items) ? qr.items : [];
    var itemsHtml = items.map(function (item) {
      return '<div style="font-size:13px; color:var(--gray-700); padding:3px 0;">' + formatQuoteItemLine(item) + '</div>';
    }).join("");
    var linkHtml = qr.quotePublicToken
      ? '<a href="quotation-view.html?token=' + encodeURIComponent(qr.quotePublicToken) + '" target="_blank" rel="noopener noreferrer" class="btn btn-primary btn-sm" style="margin-top:10px;">View Quotation</a>'
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
    showLeadsOnly(leadsListEl); // keep whatever's already on screen (if any), same as onOrdersError() in my-orders-page-en.js
    showLeadsError("Couldn't load your quote request history. Please try again, or call +66 62-883-3880");
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
  // Log out — same pattern as js/my-account-page.js (P2.9-C, mirroring P2.9-A/B) — does not
  // redirect away from this page.
  // ===========================
  function handleLogout() {
    if (!logoutBtn || logoutBtn.disabled) return;
    logoutBtn.disabled = true;
    sessionActive = false; // set before logoutAdmin() so the onAuthChange() listener below doesn't also run handleSessionLost()
    currentLineUserId = null;
    resetLeadsPanel(); // cancels any pending listenMyQuoteRequests() subscription + collapses the panel back
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
  // Session lost elsewhere (2026-08 follow-up) — same pattern as js/my-orders-page-en.js: if the
  // LINE customer session logged in on this page gets signed out from a different tab in the
  // same browser (e.g. an admin.html tab left open that auto-signs-out any session carrying a
  // lineUserId claim), this page previously had no idea — the profile/quote-requests panel stayed
  // on screen as if still logged in. Fixed by subscribing to onAuthChange() separately, watched
  // only while sessionActive=true (after afterLogin() has run), resetting gently back to the
  // "Log in with LINE" screen if the session goes away.
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
    showError("Your session expired or was signed out from another device/tab. Please log in again.");
  }

  onAuthChange(function (user) {
    if (!sessionActive) return; // never logged in on this page yet (runLiffFlow() owns startup), or already logged out
    var stillLineSession = !!(user && typeof user.uid === "string" && user.uid.indexOf("line_") === 0);
    if (stillLineSession) return;
    handleSessionLost();
  });

  function loginErrorMessage(code) {
    if (code === "invalid_line_token") return "LINE verification failed. Please try logging in again.";
    if (code === "server_misconfigured") return "The login system is temporarily unavailable. Please try again later or call +66 62-883-3880";
    return "Login failed. Please try again or call +66 62-883-3880";
  }

  // Orchestrates the whole flow — same shape as runLiffFlow() in js/my-account-page.js, differing
  // from js/my-orders-page-en.js in that this page always calls liff.init() (never shortcuts past
  // it entirely even with an existing Firebase session), because it always needs a liff instance
  // to call liff.getProfile() to show the name/picture. The only thing that gets shortcut is the
  // network call to loginWithLine() (Cloudflare Worker) when an existing Firebase session is
  // already there.
  function runLiffFlow(fromButtonClick) {
    loadLiffSdk()
      .then(function (liff) {
        return liff.init({ liffId: LIFF_ID }).then(function () {
          liffInstance = liff;
          if (!liff.isLoggedIn()) {
            if (fromButtonClick) {
              liff.login(); // redirects away from this page and back
              return null;
            }
            showOnly(loginEl);
            return undefined;
          }
          return liff.getProfile().then(function (profile) {
            if (hasExistingLineSession()) {
              // An existing Firebase session for this LINE customer is already there — no need
              // to call loginWithLine() again. Pull the raw lineUserId from the existing uid
              // instead (used to call listenMyQuoteRequests()).
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
        if (result === undefined || result === null) return; // already showing the login button, or redirecting
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
