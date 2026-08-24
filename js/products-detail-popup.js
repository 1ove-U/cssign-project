/* ============================================================
   PRODUCTS PAGE — Product detail popup (filter/count + quick-view
   modal + variant/quantity selector)
   ย้ายออกจาก inline <script> ของ products.html รอบที่ 84
   (เตรียมเอา 'unsafe-inline' ออกจาก CSP script-src)
   classic script (ไม่ใช่ ES module) — ตั้งใจให้ตัวแปร/ฟังก์ชันเป็น
   global เหมือนพฤติกรรมเดิมตอนยังเป็น inline script
   ============================================================ */
/* ============================================================
   PRODUCT FILTER + COUNT
   ============================================================ */
(function () {
  var tabsWrap = document.getElementById('product-tabs-dynamic');
  var grid = document.getElementById('product-grid');
  var countEl = document.getElementById('pr-count');
  var emptyEl = document.getElementById('pr-empty');
  if (!tabsWrap || !grid) return;

  function filterCards(cat) {
    var cards = grid.querySelectorAll('.product-card');
    var visible = 0;
    cards.forEach(function(c) {
      if (cat === 'all' || c.dataset.cat === cat) {
        c.style.display = '';
        visible++;
      } else {
        c.style.display = 'none';
      }
    });
    if (countEl) countEl.textContent = visible;
    if (emptyEl) emptyEl.classList.toggle('show', visible === 0);
  }

  tabsWrap.addEventListener('click', function(e) {
    var tab = e.target.closest('.product-tab');
    if (!tab) return;
    tabsWrap.querySelectorAll('.product-tab').forEach(function(t){ t.classList.remove('active'); });
    tab.classList.add('active');
    filterCards(tab.dataset.filter || 'all');
  });

  filterCards('all');

  // deep-link
  var params = new URLSearchParams(window.location.search);
  var cat = params.get('cat');
  if (cat && cat !== 'all') {
    setTimeout(function() {
      var tab = document.querySelector('.product-tab[data-filter="' + cat + '"]');
      if (tab) tab.click();
    }, 200);
  }

  /* -----------------------------------------------------------
     Instant category switch — no reload, no wait.
     Header/footer links to products.html?cat=xxx are normal <a>
     tags (they need to work from OTHER pages too, so we can't just
     remove href). But if we're already ON products.html, a full
     reload just re-runs the whole page + re-fetches Firestore for
     no reason — the products are already sitting right there in
     the DOM. So: intercept those clicks here, filter instantly,
     and update the URL bar with pushState (no navigation at all).
     ----------------------------------------------------------- */
  function switchCategoryInstantly(cat, pushUrl) {
    if (pushUrl) {
      var url = new URL(window.location.href);
      if (cat && cat !== 'all') url.searchParams.set('cat', cat); else url.searchParams.delete('cat');
      history.pushState({ cat: cat || 'all' }, '', url.pathname + url.search);
    }
    var targetTab = tabsWrap.querySelector('.product-tab[data-filter="' + (cat || 'all') + '"]');
    if (targetTab) {
      targetTab.click(); /* reuses the existing active-state + filterCards logic above */
    } else {
      filterCards('all'); /* category not present in current tab set — fall back to "all" */
    }
    var grid2 = document.getElementById('product-grid');
    if (grid2) grid2.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  document.addEventListener('click', function (e) {
    var link = e.target.closest('a[href*="products.html?cat="], a[href^="?cat="]');
    if (!link) return;
    e.preventDefault();
    var linkUrl = new URL(link.getAttribute('href'), window.location.href);
    var cat = linkUrl.searchParams.get('cat') || 'all';
    switchCategoryInstantly(cat, true);
  });

  window.addEventListener('popstate', function () {
    var p = new URLSearchParams(window.location.search);
    switchCategoryInstantly(p.get('cat') || 'all', false);
  });
})();

/* ============================================================
   PRODUCT DETAIL POPUP — event delegation (no inline onclick)
   ============================================================ */

// Delegate click on any .detail-btn inside the grid
document.getElementById('product-grid').addEventListener('click', function(e) {
  var card = e.target.closest('.product-card');
  if (!card) return;
  var link = e.target.closest('.detail-btn');
  // detail-btn is a real <a href="product-detail.html?slug=..."> for real products
  // (see products.js) so crawlers and ctrl/cmd/middle-clicks can follow it as a
  // normal link straight to the standalone page. A plain left-click still opens
  // the quick-preview modal instead, matching the existing UX.
  if (link && link.tagName === 'A' && link.getAttribute('href') && link.getAttribute('href') !== '#') {
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1) return; // let it navigate/open in new tab
    e.preventDefault();
  }
  openProduct(card);
});

var pdOverlay = document.getElementById('pd-overlay');
var pdClose = document.getElementById('pd-close');
var pdMainImg = document.getElementById('pd-main-img');
var pdMainSvg = document.getElementById('pd-main-svg');
var pdMainImgTag = document.getElementById('pd-main-img-tag');
var pdThumbs = document.getElementById('pd-thumbs');
var pdZoomHint = document.getElementById('pd-zoom-hint');
var pdSpecsEl = document.getElementById('pd-specs');
var pdVariantBlock = document.getElementById('pd-variant-block');
var pdCurrencySelect = document.getElementById('pd-currency-select');
var pdCartBtn = document.getElementById('pd-cart-btn');

// ข้อมูลสินค้าที่เปิดป็อปอัพอยู่ตอนนี้ (ตั้งค่าใน openProduct()) — ปุ่ม "เพิ่มลงตะกร้า" อ่านจากนี้
// ตอนถูกกด แทนที่จะ re-parse card.dataset.product ใหม่ (การ์ดต้นทางอาจไม่อยู่ใน scope ตอนนั้นแล้ว
// ถ้าในอนาคตมีจุดเปิดป็อปอัพจากที่อื่นนอกเหนือจาก .detail-btn ในกริด)
var pdCurrentData = null;

// --- Currency switcher (P2.10 — TH popup, ต่อยอดจาก EN popup รอบก่อนหน้า) ---------
// เก็บ currency ที่ลูกค้าเลือกไว้ข้าม session ด้วย localStorage key เดียวกับ EN popup
// (เว็บนี้เป็น production site จริง ไม่ใช่ Claude artifact จึงใช้ localStorage ได้ปกติ)
// wrap ด้วย try/catch เผื่อ private mode/localStorage ไม่พร้อมใช้งาน — ถ้าอ่าน/เขียนไม่ได้
// ก็ fallback เป็น THB เงียบๆ ไม่ throw (แพทเทิร์นเดียวกับ js/products-detail-popup-en.js)
var PD_CURRENCY_STORAGE_KEY = 'cssignCurrency';
var pdCurrentUpdateFn = null; // อ้างอิงฟังก์ชัน update() ล่าสุดของ renderPdVariants() สำหรับสินค้าที่เปิดอยู่ตอนนี้ (ถ้ามี) — ใช้ re-render ราคาใหม่ตอนเปลี่ยน currency โดยไม่ต้องปิด/เปิดป็อปอัพใหม่

function pdGetStoredCurrency() {
  try {
    var stored = window.localStorage && window.localStorage.getItem(PD_CURRENCY_STORAGE_KEY);
    if (stored && window.CSSignCurrency && window.CSSignCurrency.isSupportedCurrency(stored)) return stored;
  } catch (e) { /* private mode / localStorage ไม่พร้อมใช้งาน — fallback THB */ }
  return 'THB';
}
function pdSetStoredCurrency(code) {
  try {
    if (window.localStorage) window.localStorage.setItem(PD_CURRENCY_STORAGE_KEY, code);
  } catch (e) { /* ไม่ critical — แค่จำ preference ข้าม session ไม่ได้ */ }
}
// แปลง+จัดรูปแบบราคา THB → currency ที่เลือกอยู่ตอนนี้ fallback เป็นรูปแบบเดิมทุกประการ
// (สัญลักษณ์ ฿ + toLocaleString('th-TH')) ถ้า currency เป็น THB เอง หรือ window.CSSignCurrency
// ยังไม่พร้อม (เช่น module script ยังโหลดไม่เสร็จ) หรือแปลงไม่ได้
function pdFormatPrice(amountThb) {
  var currency = pdCurrencySelect ? pdCurrencySelect.value : 'THB';
  if (currency && currency !== 'THB' && window.CSSignCurrency) {
    var formatted = window.CSSignCurrency.formatCurrencyAmount(amountThb, currency);
    if (formatted) return formatted;
  }
  return '฿' + Number(amountThb).toLocaleString('th-TH');
}
// ราคาของสินค้าที่ "ไม่มี" optionAxes/variants (ราคาเดี่ยวธรรมดา) — เดิม openProduct() เซ็ต
// pd-price จาก data.price ตรงๆ (string ที่ format มาแล้วจาก js/products-cards.js เป็นภาษาไทย
// เสมอ ไม่ผ่าน pdFormatPrice เลย จึงไม่แปลง currency ตาม selector) ถ้าสินค้ามี data.priceRaw
// เป็นตัวเลขจริง (>0) ให้แปลง+จัดรูปแบบด้วย pdFormatPrice() แทน (เหมือน EN popup ทำไปแล้ว)
// สินค้าที่ไม่มีราคาเลย (priceRaw null/0, "สอบถามราคา") ยังคง fallback เป็น data.price เดิม
// ทุกประการ เรียกทั้งตอนเปิดป็อปอัพครั้งแรกและตอนเปลี่ยน currency (ผ่าน pdCurrentUpdateFn)
function pdRenderBasePrice(data) {
  var priceEl = document.getElementById('pd-price');
  var raw = Number(data.priceRaw);
  priceEl.textContent = (data.priceRaw != null && raw > 0) ? pdFormatPrice(raw) : (data.price || 'ขอใบเสนอราคา');
}
if (pdCurrencySelect) {
  pdCurrencySelect.value = pdGetStoredCurrency();
  pdCurrencySelect.addEventListener('change', function () {
    pdSetStoredCurrency(pdCurrencySelect.value);
    if (typeof pdCurrentUpdateFn === 'function') pdCurrentUpdateFn(); // re-render ราคาของสินค้าที่เปิดอยู่ตอนนี้ทันที (ถ้ามี variant ที่เลือกครบแล้ว)
  });
}

function escapeHtmlPd(str) {
  return String(str == null ? '' : str).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function pdSpecsHTML(items) {
  return items.map(function (it) {
    return '<div class="pd-spec-item"><div class="pd-spec-key">' + escapeHtmlPd(it.key) + '</div><div class="pd-spec-val">' + escapeHtmlPd(it.val) + '</div></div>';
  }).join('');
}

// สินค้าที่มีตัวเลือกแบบ chip (optionAxes/variants) → แสดงตัวเลือกให้กดในป็อปอัพนี้ด้วย
// เหมือน product-detail.html: ราคา (pd-price) และ "รายละเอียดสินค้า" (pd-specs) จะ
// เปลี่ยนตามตัวเลือกที่ลูกค้ากำลังเลือกอยู่แบบสด ๆ ไม่มีส่วนลดตามจำนวน (ราคาต่อชิ้น
// คูณจำนวนตรง ๆ เท่านั้น) — สินค้าที่ไม่มีตัวเลือกจะแสดงวัสดุ/ขนาดแบบเดิมตามปกติ
function renderPdVariants(data) {
  var axes = (data.optionAxes || []).filter(function (ax) { return ax.label && (ax.options || []).length; });
  var variants = data.variants || [];
  window.__pdEstSummary = null;
  pdCurrentUpdateFn = null;

  if (!axes.length || !variants.length) {
    pdVariantBlock.className = 'pd-variant-block';
    pdVariantBlock.innerHTML = '';
    pdSpecsEl.innerHTML = pdSpecsHTML([
      { key: 'วัสดุ', val: data.material || '-' },
      { key: 'ขนาด', val: data.size || '-' }
    ]);
    // สินค้าไม่มี variant ก็ยังต้อง re-render ราคาสดตอนเปลี่ยน currency ได้เหมือน EN popup
    pdCurrentUpdateFn = function () { pdRenderBasePrice(data); };
    // ไม่มีตัวเลือกให้เลือก จึงไม่มีอะไรต้อง "เลือกให้ครบ" ก่อน — เปิดใช้ปุ่มได้ทันที
    if (pdCartBtn) pdCartBtn.disabled = false;
    return;
  }

  pdSpecsEl.innerHTML = ''; // ล้างสเปกของสินค้าก่อนหน้า ป้องกันข้อมูลค้างก่อนลูกค้าเลือกตัวเลือกใหม่
  var variantMap = {};
  variants.forEach(function (v) { variantMap[(v.codes || []).join('|')] = v; });
  var selected = axes.map(function () { return null; }); // ไม่ auto-select ตัวเลือกใดไว้ล่วงหน้า — ลูกค้าต้องกดเลือกเองทุกหมวด

  pdVariantBlock.className = 'pd-variant-block show';
  pdVariantBlock.innerHTML =
    '<div class="pd-variant-alert"><strong>ก่อนสั่งซื้อ</strong> กรุณาเลือกตัวเลือกที่ต้องการด้านล่างนี้ให้ตรงกับที่ต้องการทุกครั้ง เนื่องจากแต่ละตัวเลือกมีราคาแตกต่างกัน<span class="tax-note">*ราคาสินค้านี้ยังไม่รวมภาษีมูลค่าเพิ่ม</span></div>' +
    axes.map(function (ax, ai) {
      return '<div class="pd-opt-block"><div class="pd-opt-label">' + escapeHtmlPd(ax.label) + '</div><div class="pd-chip-row" data-axis-idx="' + ai + '">' +
        ax.options.map(function (opt) {
          return '<button type="button" class="pd-chip" data-axis-idx="' + ai + '" data-code="' + escapeHtmlPd(opt.code) + '">' + escapeHtmlPd(opt.label) + '</button>';
        }).join('') + '</div></div>';
    }).join('') +
    '<div class="pd-qty-block"><div class="pd-opt-label">จำนวน</div><div class="pd-qty-stepper">' +
      '<button type="button" class="pd-qty-btn" id="pd-qty-minus" aria-label="ลดจำนวน">−</button>' +
      '<input type="number" id="pd-qty" value="1" min="1" inputmode="numeric" aria-label="จำนวน">' +
      '<button type="button" class="pd-qty-btn" id="pd-qty-plus" aria-label="เพิ่มจำนวน">+</button>' +
    '</div></div>' +
    '<div class="pd-variant-total" id="pd-variant-total"></div>';

  var qtyEl = document.getElementById('pd-qty');
  var totalEl = document.getElementById('pd-variant-total');
  var priceEl = document.getElementById('pd-price');

  function update() {
    var qty = Math.max(1, parseInt(qtyEl.value, 10) || 1);
    qtyEl.value = qty;
    var allSelected = selected.every(function (v) { return v != null; });

    if (!allSelected) {
      // ยังเลือกไม่ครบทุกหมวด — ยังไม่โชว์ราคาจริง และยังไม่เปลี่ยนกล่องสเปก + ปิดปุ่ม
      // "เพิ่มลงตะกร้า" ไว้ก่อน ป้องกันหยิบสินค้าที่ยังไม่รู้ variant ใส่ตะกร้า
      priceEl.textContent = 'กรุณาเลือกตัวเลือกให้ครบทุกหมวด';
      totalEl.innerHTML = '<div class="pd-vt-empty">กรุณาเลือกตัวเลือกให้ครบทุกหมวดด้านบนเพื่อดูราคา</div>';
      window.__pdEstSummary = null;
      if (pdCartBtn) pdCartBtn.disabled = true;
      return;
    }
    if (pdCartBtn) pdCartBtn.disabled = false;

    var variant = variantMap[selected.join('|')];
    var unitPrice = (variant && Number(variant.price) > 0) ? Number(variant.price) : null;

    priceEl.textContent = unitPrice ? pdFormatPrice(unitPrice) : 'สอบถามราคา';

    var axisRows = axes.map(function (ax, ai) {
      var opt = ax.options.find(function (o) { return o.code === selected[ai]; });
      return { label: ax.label, valueLabel: opt ? opt.label : selected[ai] };
    });
    // "รายละเอียดสินค้า" ด้านล่างสลับไปโชว้ตัวเลือกที่กำลังเลือกอยู่ ก็ต่อเมื่อเลือกครบทุกหมวดแล้ว
    pdSpecsEl.innerHTML = pdSpecsHTML(axisRows.map(function (r) { return { key: r.label, val: r.valueLabel }; }));

    totalEl.innerHTML = unitPrice == null
      ? '<div class="pd-vt-empty">ตัวเลือกนี้ยังไม่ได้ตั้งราคาไว้ — กรุณาติดต่อฝ่ายขายเพื่อสอบถามราคา</div>'
      : '<div class="pd-vt-row"><span>ราคาต่อชิ้น</span><span>' + pdFormatPrice(unitPrice) + '</span></div>' +
        '<div class="pd-vt-row pd-vt-total"><span>ราคารวม (' + qty.toLocaleString('th-TH') + ' ชิ้น)</span><span>' + pdFormatPrice(Math.round(unitPrice * qty)) + '</span></div>';

    window.__pdEstSummary = {
      productName: data.name || '',
      productCode: data.code || '',
      skuCode: (variant ? variant.codes : selected).join('-'),
      axesSelected: axisRows,
      qty: qty,
      unitPrice: unitPrice,
      total: unitPrice != null ? Math.round(unitPrice * qty) : null
    };
  }

  pdVariantBlock.querySelectorAll('.pd-chip').forEach(function (chip) {
    chip.addEventListener('click', function () {
      var ai = Number(chip.dataset.axisIdx);
      pdVariantBlock.querySelectorAll('.pd-chip[data-axis-idx="' + ai + '"]').forEach(function (c) { c.classList.remove('active'); });
      chip.classList.add('active');
      selected[ai] = chip.dataset.code;
      update();
    });
  });
  document.getElementById('pd-qty-plus').addEventListener('click', function () { qtyEl.value = (parseInt(qtyEl.value, 10) || 1) + 1; update(); });
  document.getElementById('pd-qty-minus').addEventListener('click', function () { qtyEl.value = Math.max(1, (parseInt(qtyEl.value, 10) || 1) - 1); update(); });
  qtyEl.addEventListener('input', update);

  pdCurrentUpdateFn = update;
  update();
}

// สร้างข้อความ pre-fill ช่อง qm-msg จากตัวเลือกที่ลูกค้ากำลังเลือกอยู่ในป็อปอัพนี้
function buildPdQuoteMessage() {
  var s = window.__pdEstSummary;
  if (!s) return null;
  var parts = ['สนใจ: ' + s.productName + (s.skuCode ? ' (รหัส ' + s.skuCode + ')' : '')];
  s.axesSelected.forEach(function (a) { parts.push(a.label + ': ' + a.valueLabel); });
  parts.push(s.unitPrice != null
    ? 'ราคาประมาณการ: ' + pdFormatPrice(s.unitPrice) + '/ชิ้น × ' + s.qty
    : 'ราคา: สอบถามราคา');
  return parts.join(' | ');
}

// SVG shapes for each card index (placeholder until real images)
var svgShapes = [
  '<path d="M32 4 6 16v14c0 14 11 23 26 30 15-7 26-16 26-30V16L32 4z"/><path d="M22 32l7 7 14-14" stroke="#C6862A"/>',
  '<circle cx="32" cy="32" r="26"/><path d="M16 32h32M32 16v32" stroke="#C6862A"/>',
  '<rect x="10" y="10" width="44" height="44" rx="4"/><path d="M20 38l8-12 6 8 10-14" stroke="#C6862A"/>',
  '<path d="M32 8l16 48H16L32 8z"/><path d="M24 40h16" stroke="#C6862A"/>',
  '<path d="M32 6c-12 0-22 9-22 21 0 16 22 31 22 31s22-15 22-31c0-12-10-21-22-21z"/><circle cx="32" cy="27" r="6" stroke="#C6862A"/>'
];

var currentSvgIndex = 0;
var allCards = [];

// 2026 refactor — accessibility phase (รอบที่ 58): focus-trap สำหรับ pd-overlay (Escape +
// return-focus มีอยู่แล้วเดิม — ดูท้ายไฟล์) — selector ตัวเดียวกับที่ใช้ทั่วโปรเจกต์
var PD_FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), textarea:not([disabled]), ' +
  'input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
var pdLastFocused = null;

function pdTrapTab(e) {
  if (e.key !== 'Tab' || !pdOverlay.classList.contains('open')) return;
  var focusables = Array.prototype.slice.call(pdOverlay.querySelectorAll(PD_FOCUSABLE_SELECTOR));
  if (!focusables.length) return;
  var first = focusables[0];
  var last = focusables[focusables.length - 1];
  var active = document.activeElement;
  if (e.shiftKey) {
    if (active === first || !pdOverlay.contains(active)) { e.preventDefault(); last.focus(); }
  } else {
    if (active === last || !pdOverlay.contains(active)) { e.preventDefault(); first.focus(); }
  }
}
document.addEventListener('keydown', pdTrapTab);

function openProduct(card) {
  var rawData = card.dataset.product;
  if (!rawData) return;
  var data;
  try { data = JSON.parse(rawData); } catch { return; }
  pdLastFocused = document.activeElement;
  pdCurrentData = data;

  allCards = Array.from(document.querySelectorAll('.product-card[data-product]'));
  currentSvgIndex = allCards.indexOf(card);

  // Fill info
  document.getElementById('pd-cat').textContent = data.cat || '';
  document.getElementById('pd-name').textContent = data.name || '';
  document.getElementById('pd-code').textContent = 'รหัสสินค้า: ' + (data.code || '-');
  pdRenderBasePrice(data);
  document.getElementById('pd-desc').textContent = data.desc || '';
  renderPdVariants(data);

  // "รายละเอียดสินค้า" หัวข้อนี้ครอบทั้งคำอธิบาย (pd-desc) และสเปก (pd-specs) —
  // ถ้าทั้งสองส่วนไม่มีข้อมูลจริง ก็ไม่ต้องโชว์หัวข้อค้างไว้
  var detailsLabelEl = document.getElementById('pd-details-label');
  var hasDesc = !!(data.desc && data.desc.trim());
  var hasAxes = !!((data.optionAxes || []).filter(function (ax) { return ax.label && (ax.options || []).length; }).length && (data.variants || []).length);
  var hasSpecs = hasAxes || !!pdSpecsEl.innerHTML.trim();
  detailsLabelEl.style.display = (hasDesc || hasSpecs) ? '' : 'none';

  // Tags
  var tagsEl = document.getElementById('pd-tags');
  var tagsLabelEl = document.getElementById('pd-tags-label');
  tagsEl.innerHTML = '';
  (data.tags || []).forEach(function(t) {
    var span = document.createElement('span');
    span.className = 'pd-tag';
    span.textContent = t;
    tagsEl.appendChild(span);
  });
  // ไม่มี "ป้ายกำกับ" (tags) จริง ก็ไม่ต้องโชว์หัวข้อนี้
  tagsLabelEl.style.display = (data.tags && data.tags.length) ? '' : 'none';

  // Link to the standalone product-detail.html page — only real (Firestore-backed)
  // products carry a slug; the 5 static fallback cards shown when Firestore is
  // unreachable have no matching document, so there's no real page to link to.
  var fullLinkEl = document.getElementById('pd-full-link');
  if (data.slug) {
    fullLinkEl.href = 'product-detail.html?slug=' + encodeURIComponent(data.slug);
    fullLinkEl.style.display = '';
  } else {
    fullLinkEl.style.display = 'none';
  }

  // Thumbnails (views) — ใช้รูปจริงของสินค้าถ้ามี ไม่งั้น fallback เป็นไอคอน placeholder
  pdThumbs.innerHTML = '';
  function imgUrlOf(img) { return (img && typeof img === 'object') ? (img.url || '') : (img || ''); }
  function imgLabelOf(img) { return (img && typeof img === 'object') ? (img.label || '') : ''; }
  var rawImages = (data.images || []).filter(function(img) { return imgUrlOf(img); });

  if (rawImages.length) {
    rawImages.forEach(function(img, i) {
      var src = imgUrlOf(img);
      var label = imgLabelOf(img);
      var thumb = document.createElement('div');
      thumb.className = 'pd-thumb' + (i === 0 ? ' active' : '');
      thumb.innerHTML = '<img src="' + src + '" alt="' + (data.name || 'สินค้า') + (label ? ' — ' + label : '') + '">' +
        (label ? '<div class="pd-thumb-label">' + label + '</div>' : '');
      thumb.addEventListener('click', function() {
        pdThumbs.querySelectorAll('.pd-thumb').forEach(function(t){ t.classList.remove('active'); });
        thumb.classList.add('active');
        pdMainImgTag.src = src;
        pdMainImg.classList.remove('zoomed');
      });
      pdThumbs.appendChild(thumb);
    });
  } else {
    var views = data.views || ['หน้า','หลัง','ด้านข้าง'];
    views.forEach(function(v, i) {
      var thumb = document.createElement('div');
      thumb.className = 'pd-thumb' + (i === 0 ? ' active' : '');
      thumb.innerHTML = '<svg viewBox="0 0 64 64" fill="none" stroke="#0B5A96" stroke-width="2.5">' + (svgShapes[currentSvgIndex] || svgShapes[0]) + '</svg><div class="pd-thumb-label">' + v + '</div>';
      thumb.addEventListener('click', function() {
        pdThumbs.querySelectorAll('.pd-thumb').forEach(function(t){ t.classList.remove('active'); });
        thumb.classList.add('active');
        pdMainImg.classList.remove('zoomed');
      });
      pdThumbs.appendChild(thumb);
    });
  }

  // Main image: ใช้รูปจริงถ้ามี ไม่งั้น fallback เป็น SVG placeholder
  if (rawImages.length) {
    pdMainSvg.style.display = 'none';
    pdMainImgTag.src = imgUrlOf(rawImages[0]);
    pdMainImgTag.alt = data.name || 'สินค้า';
    pdMainImgTag.style.display = 'block';
  } else {
    pdMainSvg.style.display = 'block';
    pdMainSvg.innerHTML = svgShapes[currentSvgIndex] || svgShapes[0];
    pdMainImgTag.style.display = 'none';
  }
  pdMainImg.classList.remove('zoomed');

  // Open
  pdOverlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

// Zoom
pdMainImg.addEventListener('click', function() {
  pdMainImg.classList.toggle('zoomed');
  pdZoomHint.textContent = pdMainImg.classList.contains('zoomed') ? 'คลิกเพื่อย่อ' : 'คลิกเพื่อซูม';
});

function closePdModal() {
  pdOverlay.classList.remove('open');
  document.body.style.overflow = '';
  if (pdLastFocused && typeof pdLastFocused.focus === 'function') pdLastFocused.focus();
  pdLastFocused = null;
}

pdClose.addEventListener('click', closePdModal);
pdOverlay.addEventListener('click', function(e) { if (e.target === pdOverlay) closePdModal(); });
document.addEventListener('keydown', function(e) { if (e.key === 'Escape') closePdModal(); });

// "เพิ่มลงตะกร้า" — P3.0 Phase 1 รอบย่อย 2 — window.CSSignCart มาจาก js/cart-global.js (bridge
// module เดียวกับ window.CSSignCurrency ที่ js/currency-global.js เตรียมไว้ให้ไฟล์นี้อยู่แล้ว)
// ไม่ปิด popup ตอนกด ต่างจากปุ่มสอบถาม/ขอใบเสนอราคา เพราะลูกค้าอาจอยากหยิบหลายตัวเลือกของสินค้า
// เดิมต่อเนื่องกัน (เช่น เลือกไซส์ S ใส่ตะกร้า แล้วเปลี่ยนเป็นไซส์ L ใส่ตะกร้าอีกแถวหนึ่ง) โดยไม่ต้อง
// เปิดป็อปอัพใหม่ทุกครั้ง — toast แจ้งผลสำเร็จ (จาก addToCartAndNotify) ทำหน้าที่ยืนยันแทน
if (pdCartBtn) {
  pdCartBtn.addEventListener('click', function () {
    if (!pdCurrentData || !window.CSSignCart) return; // ยังไม่มีสินค้าเปิดอยู่ หรือ module bridge ยังโหลดไม่เสร็จ (เคสหายากมาก — กดเร็วกว่า type="module" script รันเสร็จ)

    var unitPrice = null, qty = 1, variantLabel = '';
    var s = window.__pdEstSummary;
    if (s) {
      // สินค้ามี optionAxes/variants — ปุ่มถูก disabled ไว้จนกว่าจะเลือกครบทุกหมวดแล้ว (ดู
      // renderPdVariants()) ดังนั้นถึงจุดนี้ __pdEstSummary ต้องมีค่าเสมอ แต่ unitPrice ยังอาจ
      // เป็น null ได้ (variant ที่เลือกยังไม่ได้ตั้งราคาไว้ในระบบ) — ยังหยิบใส่ตะกร้าได้ตามปกติ
      // เพราะ unitPriceHint แค่เป็นตัวเลขอ้างอิงให้แอดมินเห็นตอนออกใบเสนอราคาจริงใน Phase 3
      // ไม่ใช่ราคาทางการอยู่แล้ว (ดูคอมเมนต์หัวไฟล์ js/cart.js)
      unitPrice = s.unitPrice;
      qty = s.qty;
      variantLabel = s.axesSelected.map(function (a) { return a.label + ': ' + a.valueLabel; }).join(' / ');
    } else {
      // สินค้าราคาเดี่ยว ไม่มีตัวเลือกให้กด — ไม่มี qty stepper ในป็อปอัพนี้เลยสำหรับเคสนี้ ใช้ 1 เสมอ
      var raw = Number(pdCurrentData.priceRaw);
      unitPrice = (pdCurrentData.priceRaw != null && raw > 0) ? raw : null;
    }

    // productId: dpObj จาก js/products-cards.js ยังไม่พก Firestore doc id ติดมาด้วย (ดู
    // REFACTOR-PROGRESS.md รอบนี้) — ใช้ slug (unique ต่อสินค้าจริงที่มาจาก Firestore, ดูคอมเมนต์
    // "real href when a slug exists" ใน products-cards.js) แทนชั่วคราว ตกกลับไปใช้ code แล้วชื่อ
    // สินค้าตามลำดับถ้าไม่มี slug (เช่น 5 การ์ด fallback ตอน Firestore เข้าไม่ถึง)
    var productId = pdCurrentData.slug || pdCurrentData.code || pdCurrentData.name || '';
    var firstImg = (pdCurrentData.images || [])[0];
    var imgUrlVal = (firstImg && typeof firstImg === 'object') ? (firstImg.url || '') : (firstImg || '');

    window.CSSignCart.addToCartAndNotify({
      productId: productId,
      name: pdCurrentData.name || 'สินค้า',
      variantLabel: variantLabel,
      size: pdCurrentData.size || '',
      material: pdCurrentData.material || '',
      unitPriceHint: unitPrice,
      unit: pdCurrentData.unit || '',
      image: imgUrlVal
    }, qty);
  });
}

// Inquiry button → opens quotation modal after closing product detail
document.getElementById('pd-inquiry-btn').addEventListener('click', function() {
  closePdModal();
  setTimeout(function() { openModal('form'); }, 200);
});
document.getElementById('pd-quote-btn').addEventListener('click', function() {
  var msg = buildPdQuoteMessage();
  closePdModal();
  setTimeout(function() {
    openModal('form');
    if (msg) {
      var msgEl = document.getElementById('qm-msg');
      if (msgEl) msgEl.value = msg;
    }
  }, 200);
});
