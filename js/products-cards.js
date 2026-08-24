// ===========================
// js/products-cards.js — การ์ดสินค้า (HTML template): escapeHtml/formatPrice/imgUrl/
// artHTML/cardHTML + การ์ด skeleton ตอนโหลด (skeletonCardHTML)
// แยกออกมาจาก js/products.js
//
// 2026 refactor phase 9: แยกส่วน "สร้าง HTML การ์ดสินค้า" ออกมาทั้งหมดแบบ diff เป๊ะ ไม่มี
// เปลี่ยน logic — เป็นจุดตัดที่สะอาดเพราะฟังก์ชันกลุ่มนี้เป็น pure function ล้วนๆ (รับ
// พารามิเตอร์ คืนค่า HTML string) ไม่แตะ DOM/closure state ของ products.js เลย (ไม่มี grid/
// tabsWrap/groupTabsWrap/currentGroupFilter ใช้ในไฟล์นี้) จึงไม่ต้องมี setter ข้ามไฟล์ — ไฟล์
// เดิม (products.js) ที่เหลือคือ DOM refs + การกรอง/dropdown/deep-link + orchestration การโหลด
// (skeleton/crossfade/Promise.all จาก Firestore)
//
// escapeHtml export เพิ่มออกไปด้วย เพราะ products.js เองยังใช้ตรงๆ ในส่วน render() (สร้าง
// ตัวเลือกหมวดหมู่ใหญ่/แท็บหมวดหมู่ย่อย) ไม่ใช่แค่ในไฟล์นี้ — formatPrice/imgUrl/artHTML ใช้แค่
// ภายในไฟล์นี้เอง (โดย cardHTML/artHTML) จึงไม่ export ออกไป (module-private)
// ===========================

/* fallback line-icons cycled for products that have no photo yet */
var fallbackIcons = [
  '<path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-4z"/><path d="M9 12l2 2 4-4"/>',
  '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>',
  '<path d="M3 21h18M5 21V7l8-4 8 4v14M9 21v-6h6v6"/>',
  '<path d="M12 2 3 14h7l-1 8 10-12h-7l1-8z"/>'
];

export function escapeHtml(str) {
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

export function cardHTML(product, catName, idx) {
  var code = product.code || '';
  var priceText = formatPrice(product.price, product.unit);

  /* build data-product JSON for the detail popup */
  var dpObj = {
    name: product.name || 'สินค้า',
    cat: catName || 'สินค้า',
    code: code,
    slug: product.slug || '',
    price: priceText,
    priceRaw: (product.price != null ? product.price : null), // raw number for js/product-schema.js — priceText above is display-formatted, not safe to re-parse for JSON-LD
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

export function skeletonCardHTML() {
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
