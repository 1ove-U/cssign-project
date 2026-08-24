/* ===========================================================
   CS.SIGN — Enterprise Redesign — products.js
   Connects the new design back to the existing Firebase backend
   (same db-taxonomy.js/db-products.js / Firestore collections used by the original site's
   admin panel). If Firestore has no products yet, or the request
   fails (offline, no network, etc.), the static demo cards that
   are already in index.html stay exactly as they are — visitors
   never see a blank/broken section.

   2026 refactor phase 9: แยกส่วน "สร้าง HTML การ์ดสินค้า" (escapeHtml/formatPrice/imgUrl/
   artHTML/cardHTML/skeletonCardHTML — pure function ล้วนๆ ไม่แตะ DOM/closure state ของไฟล์นี้)
   ออกไปเป็น js/products-cards.js แบบ diff เป๊ะ ไม่มีเปลี่ยน logic — import escapeHtml/cardHTML/
   skeletonCardHTML กลับมาใช้แทนฟังก์ชัน local เดิม

   2026 refactor phase 22: แยกส่วน "การกรองด้วยหมวดหมู่" (currentGroupFilter, applyCardFilter,
   filterCategoryTabsByGroup, bindGroupDropdown, bindTabFilter, applyDeepLinkFilter) ออกไปเป็น
   js/products-filters.js (ใหม่) แบบ diff เป๊ะ ไม่มีเปลี่ยน logic — ไฟล์นี้เหลือ DOM refs
   (grid/tabsWrap/groupTabsWrap) + orchestration การโหลดข้อมูลจาก Firestore (skeleton/
   crossfade/timeout/Promise.all) — import bindTabFilter/applyDeepLinkFilter/setGroupFilter
   กลับมาใช้แทนฟังก์ชัน local เดิม (setGroupFilter คือ setter ตัวใหม่ แทนการ assign
   currentGroupFilter = 'all' ตรงๆ ใน render() เดิม เพราะตัวแปรย้ายไปอยู่ใน module ใหม่แล้ว)
   =========================================================== */
import { getGroups, getCategories } from "./db-taxonomy.js";
import { getProducts } from "./db-products.js";
import { escapeHtml, cardHTML, skeletonCardHTML } from "./products-cards.js";
import { bindTabFilter, applyDeepLinkFilter, setGroupFilter } from "./products-filters.js";

(function () {
  "use strict";

  var groupTabsWrap = document.getElementById('product-group-tabs-dynamic');
  var tabsWrap = document.getElementById('product-tabs-dynamic');
  var grid = document.getElementById('product-grid');
  if (!tabsWrap || !grid) return;

  /* -----------------------------------------------------------
     Skeleton loading state
     Firestore usually answers fast enough that swapping straight
     from the static demo cards to real cards is invisible — so we
     only show a skeleton if the request is still pending after a
     short delay. This avoids a pointless skeleton flash on the
     common fast-network case while still giving a real loading
     state on a slow connection instead of a long static freeze.
     ----------------------------------------------------------- */
  var SKELETON_DELAY = 260;   // ms before we admit the load is "slow"
  var FADE_MS = 220;          // must match the CSS transition duration

  function showSkeleton() {
    if (grid.classList.contains('is-swapping')) return;
    var count = Math.max(grid.querySelectorAll('.product-card').length, 5);
    var html = '';
    for (var i = 0; i < count; i++) html += skeletonCardHTML();
    crossfadeSwap(function () { grid.innerHTML = html; });
  }

  /* fades `grid` out, runs `mutate` while invisible, fades back in.
     If the grid is still hidden by the page's own scroll-reveal
     system (data-reveal, see main.js) we don't fight over the same
     inline opacity — just swap the content while it's invisible and
     let scroll-reveal do its normal reveal-in whenever it fires. */
  var pendingSwapTimer = null;
  function crossfadeSwap(mutate) {
    /* Cancel any still-pending swap (e.g. the skeleton's own delayed
       insert) so it can never fire *after* this one and clobber
       whatever we're about to show — otherwise a fast Firestore
       response can render real cards, only to have the skeleton's
       stale timeout overwrite them right back a moment later. */
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

  /* สินค้าจริงมีอยู่ในระบบ แต่ถูกซ่อนหมดทุกตัว (ตั้งใจของแอดมิน) — ต่างจากกรณี
     "ฐานข้อมูลยังไม่มีอะไรเลย" ตรงที่ไม่ควร fallback ไปโชว์การ์ด demo ปลอมๆ
     เพราะจะดูเหมือนมีสินค้าขายอยู่ทั้งที่แอดมินตั้งใจซ่อนหมดแล้ว */
  function renderEmptyState() {
    crossfadeSwap(function () {
      if (groupTabsWrap) groupTabsWrap.innerHTML = '';
      tabsWrap.classList.remove('is-collapsed');
      tabsWrap.innerHTML = '<button class="product-tab active" data-filter="all">ทั้งหมด</button>';
      grid.innerHTML = '<div class="pr-empty show" style="grid-column:1/-1;">ขณะนี้ยังไม่มีสินค้าที่เปิดแสดงบนเว็บไซต์ — โปรดกลับมาตรวจสอบใหม่ภายหลัง</div>';
      var countEl = document.getElementById('pr-count');
      if (countEl) countEl.textContent = '0';
    });
  }

  function render(groups, categories, rawProducts) {
    /* nothing in the database yet (ไม่ใช่แค่ถูกซ่อน แต่ไม่มี doc เลยสักตัว)
       → fade back to the static demo content exactly as shipped, never
       leave a skeleton showing */
    if (!rawProducts || !rawProducts.length) {
      if (grid.querySelector('.product-skel-card')) {
        crossfadeSwap(function () { grid.innerHTML = originalGridHTML; });
      }
      return;
    }

    /* "hidden" (ซ่อนจากเว็บไซต์ในแอดมิน) ต้องไม่โผล่บนการ์ดสาธารณะ — เงื่อนไข
       เดียวกับที่ product-detail.html ใช้กันไว้แล้ว (status อื่นที่ไม่ใช่ "active"
       ก็ถือว่าไม่ควรแสดง เผื่อมีค่าอื่นเพิ่มในอนาคต เช่น "draft") */
    var products = rawProducts.filter(function (p) {
      return (p.status || "active") === "active";
    });

    if (!products.length) {
      renderEmptyState();
      return;
    }

    var catMap = {};
    (categories || []).forEach(function (c) { catMap[c.id] = { name: c.name, group_id: c.group_id || '' }; });
    var groupMap = {};
    (groups || []).forEach(function (g) { groupMap[g.id] = g.name; });

    /* ผูก group_id ให้สินค้าแต่ละชิ้นผ่านหมวดหมู่ย่อยของมัน (สินค้าเองไม่มีฟิลด์นี้ตรงๆ
       ในฐานข้อมูล — อ้างอิงผ่าน category เสมอ ตามโครงสร้าง หมวดใหญ่ > หมวดย่อย > สินค้า) */
    products.forEach(function (p) {
      p.group_id = (catMap[p.cat_id] && catMap[p.cat_id].group_id) || '';
    });

    /* หมวดที่ไม่เหลือสินค้า active สักตัว (ถูกซ่อนหมด) ไม่ต้องโชว์ปุ่ม tab
       เพราะคลิกไปแล้วมีแต่ความว่างเปล่า */
    var catCounts = {};
    var groupCounts = {};
    products.forEach(function (p) {
      catCounts[p.cat_id] = (catCounts[p.cat_id] || 0) + 1;
      if (p.group_id) groupCounts[p.group_id] = (groupCounts[p.group_id] || 0) + 1;
    });

    // ไม่ต้องโชว์ดรอปดาวน์หมวดหมู่ใหญ่เลยถ้ามีสินค้าอยู่ใต้หมวดใหญ่เดียว (ไม่มีประโยชน์ให้กรอง)
    // — กรณีนี้แถวหมวดหมู่ย่อยโชว์ตรงๆ ทันทีเหมือนเดิม เพราะไม่มีหมวดใหญ่ให้เลือกก่อนอยู่แล้ว
    var groupsWithProducts = Object.keys(groupCounts).length;
    var hasGroupRow = groupsWithProducts > 1;

    /* ดรอปดาวน์เดียว: ปุ่มโชว์ค่าที่เลือกอยู่ (เริ่มที่ "ทั้งหมด") + เมนูตัวเลือกหมวดใหญ่ */
    var groupOptionsHTML = '<button type="button" class="pr-group-select-option active" data-filter="all" role="option" aria-selected="true">ทั้งหมด</button>';
    (groups || []).forEach(function (g) {
      if (!groupCounts[g.id]) return;
      groupOptionsHTML += '<button type="button" class="pr-group-select-option" data-filter="' + escapeHtml(g.id) + '" role="option" aria-selected="false">' + escapeHtml(g.name) + '</button>';
    });
    var groupDropdownHTML =
      '<button type="button" class="pr-group-select-btn" aria-haspopup="listbox" aria-expanded="false">' +
        '<span class="pr-group-select-label">หมวดหมู่: <strong class="pr-group-select-value">ทั้งหมด</strong></span>' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M6 9l6 6 6-6"/></svg>' +
      '</button>' +
      '<div class="pr-group-select-menu" role="listbox">' + groupOptionsHTML + '</div>';

    /* ปุ่ม "ทั้งหมด" ของแถวหมวดย่อย: ถ้ามีดรอปดาวน์หมวดใหญ่คู่กันด้วย ใช้คำว่า
       "หมวดย่อยทั้งหมด" แทน เพื่อไม่ให้ซ้ำคำ/สับสนกับ "ทั้งหมด" บนดรอปดาวน์แถวบน
       (กรณีมีหมวดใหญ่เดียวไม่มีดรอปดาวน์ให้ชนกัน จึงยังใช้ "ทั้งหมด" เฉยๆ ได้) */
    var subAllLabel = hasGroupRow ? 'หมวดย่อยทั้งหมด' : 'ทั้งหมด';
    var tabsHTML = '<button class="product-tab active" data-filter="all">' + subAllLabel + '</button>';
    (categories || []).forEach(function (c) {
      if (!catCounts[c.id]) return;
      tabsHTML += '<button class="product-tab" data-filter="' + escapeHtml(c.id) + '" data-group-id="' + escapeHtml(c.group_id || '') + '">' + escapeHtml(c.name) + '</button>';
    });

    var gridHTML = products.map(function (p, i) { return cardHTML(p, catMap[p.cat_id] && catMap[p.cat_id].name, i); }).join('');

    setGroupFilter('all');
    if (groupTabsWrap) groupTabsWrap.innerHTML = hasGroupRow ? groupDropdownHTML : '';
    tabsWrap.innerHTML = tabsHTML;
    tabsWrap.classList.toggle('is-collapsed', hasGroupRow);
    crossfadeSwap(function () {
      grid.innerHTML = gridHTML;
      bindTabFilter();
      if (window.CSIGN && window.CSIGN.initTabsOverflow) {
        window.CSIGN.initTabsOverflow(tabsWrap);
      }
      applyDeepLinkFilter();
      if (typeof window.CSSIGN_observeReveal === 'function') {
        window.CSSIGN_observeReveal(grid);
      }
    });
  }

  var originalGridHTML = grid.innerHTML;
  var settled = false;
  var skeletonTimer = window.setTimeout(function () {
    if (!settled) showSkeleton();
  }, SKELETON_DELAY);

  /* Safety net: Firestore's very first request on a fresh page load can
     occasionally hang far longer than normal (cold connection handshake,
     slow network, a blocked/retrying request, etc.) even though the SDK
     itself is healthy — retrying the same call moments later works fine.
     Rather than leave visitors staring at a skeleton forever, treat "too
     slow" the same as "failed" and fall back to the static demo cards. */
  var LOAD_TIMEOUT_MS = 8000;
  var timedOut = false;
  var timeoutTimer = window.setTimeout(function () {
    if (settled) return;
    timedOut = true;
    settled = true;
    window.clearTimeout(skeletonTimer);
    if (grid.querySelector('.product-skel-card')) {
      crossfadeSwap(function () { grid.innerHTML = originalGridHTML; });
    }
    console.warn('CS.SIGN: โหลดสินค้าจาก Firebase นานเกินไป (>' + LOAD_TIMEOUT_MS + 'ms) แสดงข้อมูลตัวอย่างแทน');
  }, LOAD_TIMEOUT_MS);

  Promise.all([getGroups(), getCategories(), getProducts()])
    .then(function (results) {
      if (timedOut) return; /* fallback already shown — don't fight it with a late render */
      settled = true;
      window.clearTimeout(skeletonTimer);
      window.clearTimeout(timeoutTimer);
      render(results[0], results[1], results[2]);
    })
    .catch(function (err) {
      if (timedOut) return;
      window.clearTimeout(timeoutTimer);
      /* offline / Firebase unreachable / rules issue — fade back to the
         static fallback cards exactly as shipped, just log for diagnostics */
      settled = true;
      window.clearTimeout(skeletonTimer);
      if (grid.querySelector('.product-skel-card')) {
        crossfadeSwap(function () { grid.innerHTML = originalGridHTML; });
      }
      console.warn('CS.SIGN: ไม่สามารถโหลดสินค้าจาก Firebase ได้ แสดงข้อมูลตัวอย่างแทน', err);
    });

})();
