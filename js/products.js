/* ===========================================================
   CS.SIGN — Enterprise Redesign — products.js
   Connects the new design back to the existing Firebase backend
   (same db.js / Firestore collections used by the original site's
   admin panel). If Firestore has no products yet, or the request
   fails (offline, no network, etc.), the static demo cards that
   are already in index.html stay exactly as they are — visitors
   never see a blank/broken section.
   =========================================================== */
import { getGroups, getCategories, getProducts } from './db.js';

(function () {
  "use strict";

  var groupTabsWrap = document.getElementById('product-group-tabs-dynamic');
  var tabsWrap = document.getElementById('product-tabs-dynamic');
  var grid = document.getElementById('product-grid');
  if (!tabsWrap || !grid) return;

  /* หมวดหมู่ใหญ่ที่กำลังเลือกอยู่ ('all' = ทุกหมวดหมู่ใหญ่) — คุมว่าแถบหมวดหมู่ย่อย
     แถวที่สองจะกรองให้เหลือแค่หมวดหมู่ย่อยของหมวดใหญ่นี้เท่านั้น */
  var currentGroupFilter = 'all';

  /* fallback line-icons cycled for products that have no photo yet */
  var fallbackIcons = [
    '<path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-4z"/><path d="M9 12l2 2 4-4"/>',
    '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>',
    '<path d="M3 21h18M5 21V7l8-4 8 4v14M9 21v-6h6v6"/>',
    '<path d="M12 2 3 14h7l-1 8 10-12h-7l1-8z"/>'
  ];

  function escapeHtml(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function formatPrice(price, unit) {
    var num = Number(price);
    if (!price || isNaN(num) || num <= 0) return 'สอบถามราคา';
    return 'เริ่มต้น ฿' + num.toLocaleString('th-TH') + (unit ? ' / ' + unit : '');
  }

  function imgUrl(img) { return (img && typeof img === 'object') ? (img.url || '') : (img || ''); }

  function artHTML(product, idx) {
    var img = (product.images && product.images[0]) ? imgUrl(product.images[0]) : '';
    if (img) {
      return '<img src="' + img + '" alt="' + escapeHtml(product.name) + '" loading="lazy" decoding="async" ' +
        'style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain;padding:12px;box-sizing:border-box;">';
    }
    var path = fallbackIcons[idx % fallbackIcons.length];
    return '<div class="pa-grid"></div>' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="#0B5A96" stroke-width="1.6" style="width:64px;height:64px;">' + path + '</svg>';
  }

  function cardHTML(product, catName, idx) {
    var code = product.code || '';
    var priceText = formatPrice(product.price, product.unit);

    /* build data-product JSON for the detail popup */
    var dpObj = {
      name: product.name || 'สินค้า',
      cat: catName || 'สินค้า',
      code: code,
      slug: product.slug || '',
      price: priceText,
      desc: product.description || '',
      metaTitle: product.metaTitle || '',
      metaDescription: product.metaDescription || '',
      material: product.material || '-',
      size: product.size || '-',
      badge: code,
      tags: product.tags || [],
      views: ['หน้า','หลัง','ด้านข้าง'],
      images: product.images || [],
      cat_id: product.cat_id || '',
      optionAxes: product.optionAxes || [],
      variants: product.variants || []
    };
    var dpJson = JSON.stringify(dpObj).replace(/'/g, "&#39;");
    /* real href when a slug exists so the product has an actual crawlable/shareable
       URL (product-detail.html) even though the primary click still opens the
       in-page quick-preview modal — see products.html's click delegation, which
       only preventDefault()s a plain left-click and lets ctrl/cmd/middle-click
       (and crawlers) follow this href normally. */
    var detailHref = product.slug ? 'product-detail.html?slug=' + encodeURIComponent(product.slug) : '#';

    return (
      '<div class="product-card" data-reveal="scale" data-cat="' + escapeHtml(product.cat_id || 'all') + '" data-group="' + escapeHtml(product.group_id || 'all') + '" data-product=\'' + dpJson + '\' >' +
        '<div class="product-art">' + artHTML(product, idx) + '</div>' +
        (code ? '<div class="product-badge">' + escapeHtml(code) + '</div>' : '') +
        '<div class="product-body">' +
          '<h3>' + escapeHtml(product.name || 'สินค้า') + '</h3>' +
        '</div>' +
        '<div class="product-footer">' +
          '<a class="product-cta-btn detail-btn" href="' + escapeHtml(detailHref) + '">' +
            'ดูรายละเอียด ' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M5 12h14M13 5l7 7-7 7"/></svg>' +
          '</a>' +
        '</div>' +
      '</div>'
    );
  }

  /* กรองการ์ดตามหมวดหมู่ใหญ่ที่เลือก (currentGroupFilter) และหมวดหมู่ย่อยที่เลือกในแถวที่สอง
     ('all' ทั้งคู่ = แสดงทุกใบ) เรียกทุกครั้งที่มีการคลิก tab แถวไหนก็ตาม */
  function applyCardFilter(catFilter) {
    var cards = grid.querySelectorAll('.product-card');
    cards.forEach(function (card) {
      var groupMatch = (currentGroupFilter === 'all') || (card.getAttribute('data-group') === currentGroupFilter);
      var catMatch = (catFilter === 'all') || (card.getAttribute('data-cat') === catFilter);
      card.style.display = (groupMatch && catMatch) ? '' : 'none';
    });
  }

  /* แถบหมวดหมู่ย่อยแสดงเฉพาะรายการที่อยู่ใต้หมวดหมู่ใหญ่ที่กำลังเลือก และ "ซ่อนทั้งแถว"
     ไปเลยตอนยังไม่ได้เลือกหมวดหมู่ใหญ่ใดๆ (currentGroupFilter === 'all') — ผู้ใช้ต้องคลิก
     หมวดหมู่ใหญ่ก่อน แถวหมวดหมู่ย่อยถึงค่อยโผล่มาให้เลือกต่อ ไม่ใช่โชว์ทั้ง 2 แถวพร้อมกัน
     ตั้งแต่แรก — สลับ tab ที่ active กลับไปที่ "ทั้งหมด" ของแถวย่อยทุกครั้งที่หมวดหมู่ใหญ่
     เปลี่ยน เพื่อไม่ให้ค้างหมวดหมู่ย่อยของหมวดใหญ่ก่อนหน้า */
  function filterCategoryTabsByGroup() {
    var catTabs = tabsWrap.querySelectorAll('.product-tab');
    catTabs.forEach(function (tab) {
      var tabGroup = tab.getAttribute('data-group-id');
      var visible = (tab.getAttribute('data-filter') === 'all') || (tabGroup === currentGroupFilter);
      tab.style.display = visible ? '' : 'none';
    });
    catTabs.forEach(function (t) { t.classList.remove('active'); });
    var allCatTab = tabsWrap.querySelector('.product-tab[data-filter="all"]');
    if (allCatTab) allCatTab.classList.add('active');
    tabsWrap.classList.toggle('is-collapsed', currentGroupFilter === 'all');
    if (window.CSIGN && window.CSIGN.initTabsOverflow) window.CSIGN.initTabsOverflow(tabsWrap);
  }

  /* ดรอปดาวน์หมวดหมู่ใหญ่ (แทนที่แถบปุ่มพิลแถวบนแบบเดิม) — เปิด/ปิดเมนู, อัปเดต
     ข้อความหมวดที่เลือกอยู่บนปุ่ม, แล้วส่งต่อไปยัง pipeline การกรองเดิมทุกจุด
     (filterCategoryTabsByGroup + applyCardFilter) เหมือนตอนยังเป็นปุ่มพิลอยู่ ไม่มี
     อะไรเปลี่ยนในฝั่งตรรกะการกรอง เปลี่ยนแค่ UI ที่ใช้เลือก */
  function bindGroupDropdown() {
    if (!groupTabsWrap) return;
    var btn = groupTabsWrap.querySelector('.pr-group-select-btn');
    var menu = groupTabsWrap.querySelector('.pr-group-select-menu');
    var valueEl = groupTabsWrap.querySelector('.pr-group-select-value');
    var options = groupTabsWrap.querySelectorAll('.pr-group-select-option');
    if (!btn || !menu) return;

    function closeDropdown() {
      groupTabsWrap.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
    }
    function openDropdown() {
      groupTabsWrap.classList.add('open');
      btn.setAttribute('aria-expanded', 'true');
    }

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (groupTabsWrap.classList.contains('open')) closeDropdown(); else openDropdown();
    });
    document.addEventListener('click', function (e) {
      if (!groupTabsWrap.contains(e.target)) closeDropdown();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeDropdown();
    });

    options.forEach(function (opt) {
      opt.addEventListener('click', function () {
        options.forEach(function (o) {
          o.classList.remove('active');
          o.setAttribute('aria-selected', 'false');
        });
        opt.classList.add('active');
        opt.setAttribute('aria-selected', 'true');
        if (valueEl) valueEl.textContent = opt.textContent;
        currentGroupFilter = opt.getAttribute('data-filter');
        filterCategoryTabsByGroup();
        applyCardFilter('all');
        closeDropdown();
        btn.focus();
      });
    });
  }

  function bindTabFilter() {
    var tabs = tabsWrap.querySelectorAll('.product-tab');
    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        tabs.forEach(function (t) { t.classList.remove('active'); });
        tab.classList.add('active');
        applyCardFilter(tab.getAttribute('data-filter'));
      });
    });
    bindGroupDropdown();
  }

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

  function skeletonCardHTML() {
    return (
      '<div class="product-card product-skel-card" aria-hidden="true">' +
        '<div class="product-art product-skel-art"></div>' +
        '<div class="product-body">' +
          '<div class="product-skel-line w80"></div>' +
          '<div class="product-skel-line w45"></div>' +
        '</div>' +
        '<div class="product-footer">' +
          '<div class="product-skel-pill"></div>' +
        '</div>' +
      '</div>'
    );
  }

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

    currentGroupFilter = 'all';
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

  /* -----------------------------------------------------------
     Deep-link category filter (?cat=xxx from header/menu links).
     The header links do a full page reload to products.html?cat=...
     and an inline script in products.html clicks the matching tab
     ~200ms after load. But once real Firestore data arrives, render()
     rebuilds the tab buttons from scratch (always defaulting back to
     "all"), silently wiping out that selection. Re-apply it here for
     any category value, right after the real tabs are in the DOM.
     ----------------------------------------------------------- */
  function applyDeepLinkFilter() {
    var params = new URLSearchParams(window.location.search);
    var group = params.get('group');
    var cat = params.get('cat');

    // ลิงก์จากเมนู header (nav-menu.js) ส่งมาแค่ ?cat=... ไม่มี ?group= —
    // หาหมวดใหญ่ของหมวดย่อยนั้นเอง แล้วจำลองคลิกหมวดใหญ่ก่อน แถวหมวดย่อยถึงจะโผล่ขึ้นมา
    if (!group && cat && cat !== 'all') {
      var catTabPeek = tabsWrap.querySelector('.product-tab[data-filter="' + cat + '"]');
      var peekedGroup = catTabPeek ? catTabPeek.getAttribute('data-group-id') : '';
      if (peekedGroup) group = peekedGroup;
    }

    if (group && group !== 'all' && groupTabsWrap) {
      var gOpt = groupTabsWrap.querySelector('.pr-group-select-option[data-filter="' + group + '"]');
      if (gOpt) gOpt.click();
    }
    if (!cat || cat === 'all') return;
    var tab = tabsWrap.querySelector('.product-tab[data-filter="' + cat + '"]');
    if (tab) tab.click();
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
