/* ===========================================================
   CS.SIGN — portfolio-render.js
   ดึงผลงานที่แอดมินเพิ่ม/แก้ไขจาก admin.html (Firestore) มาแสดง
   ในกริดผลงาน (ไม่มีการ์ดตัวอย่างฝังในโค้ดอีกต่อไป — ถ้ายังไม่มี
   ข้อมูลใน Firestore เลย จะแสดงข้อความ "ยังไม่มีผลงาน" / ซ่อนส่วนนี้แทน)
   =========================================================== */
import { getPortfolios } from './db.js';

(function () {
  "use strict";

  var grid = document.getElementById('pf-grid') || document.getElementById('home-pf-grid');
  var isHome = !!(grid && grid.id === 'home-pf-grid');
  var countEl = document.getElementById('pf-count');
  var emptyEl = document.getElementById('pf-empty');
  if (!grid) return;

  var CAT_LABEL = {
    factory: 'โรงงานอุตสาหกรรม',
    government: 'ภาครัฐ',
    industrial: 'นิคมอุตสาหกรรม',
    custom: 'Custom Order'
  };

  function escapeHtml(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  var VISUAL_CLASS = {
    factory: 'port-visual--factory',
    government: 'port-visual--traffic',
    industrial: 'port-visual--industrial',
    custom: 'port-visual--custom'
  };

  function cardHTML(item) {
    var imgs = (item.images || []).filter(Boolean);
    var img = imgs[0] || '';
    var badge = CAT_LABEL[item.category] || item.category || 'ผลงาน';
    var tags = (item.tags || []).slice(0, 3)
      .map(function (t) { return '<span>' + escapeHtml(t) + '</span>'; }).join('');

    var visual = img
      ? '<img src="' + img + '" alt="' + escapeHtml(item.title) + '" class="port-photo" loading="lazy" decoding="async">'
      : '';
    var visualClass = VISUAL_CLASS[item.category] || 'port-visual--custom';

    return (
      '<div class="port-card" data-reveal="scale" data-cat="' + escapeHtml(item.category || 'custom') + '" data-images=\'' + escapeHtml(JSON.stringify(imgs)) + '\'>' +
        '<div class="port-visual ' + visualClass + (img ? '' : ' no-photo') + '">' +
          visual +
          '<div class="port-badge">' + escapeHtml(badge) + '</div>' +
          (item.pinned ? '<div class="port-pin-flag" title="ปักหมุดแสดงหน้าแรก"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l1.6 4.9H19l-4 3 1.5 5L12 12l-4.5 3 1.5-5-4-3h5.4z"/></svg></div>' : '') +
          (imgs.length > 1 ? '<button type="button" class="port-zoom-btn" aria-label="ดูภาพทั้งหมด"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></button>' : '') +
          (imgs.length > 1 ? '<div class="port-photo-count"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="15" height="15" rx="2"/><path d="M8 21h10a2 2 0 0 0 2-2V8"/></svg>' + imgs.length + '</div>' : '') +
        '</div>' +
        '<div class="port-info">' +
          (item.client ? '<div class="port-client">' + escapeHtml(item.client) + '</div>' : '') +
          '<h3>' + escapeHtml(item.title || 'ผลงาน') + '</h3>' +
          (item.description ? '<p>' + escapeHtml(item.description) + '</p>' : '') +
          (tags ? '<div class="port-tags">' + tags + '</div>' : '') +
          '<span class="port-more">ดูรายละเอียด<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M5 12h14M13 5l7 7-7 7"/></svg></span>' +
        '</div>' +
      '</div>'
    );
  }

  /* -----------------------------------------------------------
     Skeleton loading state — same pattern as products.js: only
     show a skeleton if the Firestore request is still pending
     after a short delay, so a fast response never flashes one.
     ----------------------------------------------------------- */
  var SKELETON_DELAY = 260;  // ms before we admit the load is "slow"
  var FADE_MS = 220;         // must match .portfolio-grid's CSS transition

  function skeletonCardHTML() {
    return (
      '<div class="port-card port-skel-card" aria-hidden="true">' +
        '<div class="port-visual port-skel-visual"></div>' +
        '<div class="port-info">' +
          '<div class="port-skel-line w40"></div>' +
          '<div class="port-skel-line w90"></div>' +
          '<div class="port-skel-line w70"></div>' +
          '<div class="port-skel-line w50"></div>' +
        '</div>' +
      '</div>'
    );
  }

  function showSkeleton() {
    if (grid.classList.contains('is-swapping')) return;
    var count = Math.max(grid.querySelectorAll('.port-card').length, isHome ? 3 : 6);
    var html = '';
    for (var i = 0; i < count; i++) html += skeletonCardHTML();
    crossfadeSwap(function () { grid.innerHTML = html; });
  }

  /* fades `grid` out, runs `mutate` while invisible, fades back in —
     mirrors products.js's crossfadeSwap so both grids feel identical.
     If the grid is still hidden by the page's own scroll-reveal system
     (data-reveal, see main.js) we don't fight over the same inline
     opacity — just swap the content while it's invisible and let
     scroll-reveal do its normal reveal-in whenever it fires. */
  var pendingSwapTimer = null;
  function crossfadeSwap(mutate) {
    window.clearTimeout(pendingSwapTimer);
    if (grid.style.opacity === '0') {
      mutate();
      return;
    }
    grid.classList.add('is-swapping');
    grid.style.opacity = '0';
    pendingSwapTimer = window.setTimeout(function () {
      mutate();
      grid.style.opacity = '1';
      window.setTimeout(function () { grid.classList.remove('is-swapping'); }, FADE_MS);
    }, FADE_MS);
  }

  function bindDynamicFilter() {
    var tabs = document.querySelectorAll('#pf-tabs .product-tab');
    var allCards = function () { return grid.querySelectorAll('.port-card'); };

    function applyFilter(filter) {
      var visible = 0;
      allCards().forEach(function (card) {
        var match = filter === 'all' || card.getAttribute('data-cat') === filter;
        card.classList.toggle('pf-hidden', !match);
        if (match) visible++;
      });
      if (countEl) countEl.textContent = visible;
      if (emptyEl) emptyEl.classList.toggle('show', visible === 0);
    }

    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        applyFilter(tab.getAttribute('data-filter'));
      });
    });

    /* re-apply whichever tab is currently active, now that new cards exist */
    var activeTab = document.querySelector('#pf-tabs .product-tab.active');
    applyFilter(activeTab ? activeTab.getAttribute('data-filter') : 'all');
  }

  /* ไม่มีผลงานให้แสดงเลย — แทนที่จะปล่อยกริดว่างเปล่าแบบไม่มีคำอธิบาย
     ให้แสดงข้อความ "ยังไม่มีผลงาน" (หน้า portfolio.html) หรือซ่อนทั้ง section (หน้าแรก) */
  function showEmptyState() {
    if (isHome) {
      var section = grid.closest('section');
      if (section) section.style.display = 'none';
      return;
    }
    crossfadeSwap(function () { grid.innerHTML = ''; });
    if (countEl) countEl.textContent = '0';
    if (emptyEl) {
      emptyEl.textContent = 'ยังไม่มีผลงานในระบบ — กำลังอัปเดตเร็ว ๆ นี้';
      emptyEl.classList.add('show');
    }
  }

  function observeCardsReveal() {
    if (typeof window.CSSIGN_observeReveal === 'function') {
      window.CSSIGN_observeReveal(grid);
    }
  }

  var settled = false;
  var skeletonTimer = window.setTimeout(function () {
    if (!settled) showSkeleton();
  }, SKELETON_DELAY);

  /* safety net: an unusually slow/hung first Firestore request shouldn't
     leave visitors staring at a skeleton forever — same treatment as
     products.js */
  var LOAD_TIMEOUT_MS = 8000;
  var timedOut = false;
  var timeoutTimer = window.setTimeout(function () {
    if (settled) return;
    timedOut = true;
    settled = true;
    window.clearTimeout(skeletonTimer);
    showEmptyState();
    console.warn('CS.SIGN: โหลดผลงานจาก Firebase นานเกินไป (>' + LOAD_TIMEOUT_MS + 'ms)');
  }, LOAD_TIMEOUT_MS);

  getPortfolios()
    .then(function (items) {
      if (timedOut) return;
      settled = true;
      window.clearTimeout(skeletonTimer);
      window.clearTimeout(timeoutTimer);

      if (!items || !items.length) { showEmptyState(); return; }
      if (isHome) {
        var pinned = items.filter(function (i) { return i.pinned; })
          .sort(function (a, b) { return (a.order || 0) - (b.order || 0) || (a.createdAt || 0) - (b.createdAt || 0); });
        if (!pinned.length) { showEmptyState(); return; }
        crossfadeSwap(function () {
          grid.innerHTML = pinned.map(cardHTML).join('');
          observeCardsReveal();
        });
        return;
      }
      crossfadeSwap(function () {
        grid.innerHTML = items.map(cardHTML).join('');
        bindDynamicFilter();
        observeCardsReveal();
      });
    })
    .catch(function (err) {
      if (timedOut) return;
      settled = true;
      window.clearTimeout(skeletonTimer);
      window.clearTimeout(timeoutTimer);
      console.warn('CS.SIGN: ไม่สามารถโหลดผลงานจาก Firebase ได้', err);
      showEmptyState();
    });

})();
