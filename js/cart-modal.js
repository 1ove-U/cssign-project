// ===========================
// js/cart-modal.js — ป๊อปอัพ "ตะกร้าของฉัน" (P3.0 Phase 1 รอบย่อย 4 ต่อ)
// เปิดจากไอคอนตะกร้าบน navbar / เมนูมือถือ (.nav-cart-trigger / .mobile-cart-link — ผูก click
// จาก js/main.js ฟังก์ชัน cartNavIcon()) — markup มาจาก js/cart-modal-template.js, style จาก
// css/cart-modal.css (รอบย่อย 4 ส่วนแรก) ทั้งสองไฟล์นั้นเสร็จแล้วก่อนไฟล์นี้
//
// **Classic script โดยตั้งใจ (ไม่ใช่ ES module)** — ไฟล์นี้ไม่มี import ใดๆ เลย อ่าน/แก้ข้อมูล
// ตะกร้าผ่าน window.CSSignCart (bridge จาก js/cart-global.js) เท่านั้นตามที่ตัดสินใจไว้ใน
// continue-prompt-p3.0-phase1-round4-cont.md ("ห้าม import ตรงจาก cart.js") — เพราะไม่ต้อง import
// จริงๆ จึงไม่จำเป็นต้องเป็น module เลย (ต่างจาก js/track-modal.js ที่ import จาก db-orders.js
// ตรงๆ จึงต้องเป็น module) การเป็น classic script ทำให้ไม่ต้องกังวลเรื่อง defer-timing ใดๆ —
// ปุ่มเปิด modal ใน js/main.js เช็ค `window.openCartModal` แบบ lazy ตอน click เท่านั้น (ดู
// cartNavIcon()) ไม่สนใจว่าไฟล์นี้โหลดเสร็จก่อน/หลัง main.js
//
// ต้นแบบโครงสร้างเปิด/ปิด modal + focus-trap + Escape + return-focus: js/track-modal.js
// (คัดลอกแพทเทิร์นมาปรับ prefix จาก "tm-" เป็น "cm-" ทั้งหมด)
(function () {
  var overlay     = document.getElementById("cm-overlay");
  var closeBtn    = document.getElementById("cm-close");
  var listEl      = document.getElementById("cm-list");
  var emptyEl     = document.getElementById("cm-empty");
  var footerEl    = document.getElementById("cm-footer");
  var priceNoteEl = document.getElementById("cm-price-note");
  var quoteBtn    = document.getElementById("cm-quote-btn");
  if (!overlay || !listEl) return;

  var isEn = /\/en\//.test(window.location.pathname);

  // ── มิเรอร์ EN — ทำครั้งเดียวตอน init (แพทเทิร์นเดียวกับ cartNavIcon() ใน js/main.js ที่ตั้ง
  // label ผ่าน JS ตอน runtime ไม่ทำ markup ซ้ำสองชุด) ──
  if (isEn) {
    var EN_TEXT = {
      "cm-eyebrow-text":     "Shopping Cart",
      "cm-title":            "My Cart",
      "cm-empty-title":      "Your cart is empty",
      "cm-empty-text":       "Browse our products and tap \u201cAdd to cart\u201d to collect items for a single quote request.",
      "cm-price-note-text":  "Prices shown are estimates only, based on the time each item was added \u2014 not official pricing. Final pricing will be confirmed in the quotation from our team.",
      "cm-quote-btn-label":  "Request a Quote"
    };
    Object.keys(EN_TEXT).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.textContent = EN_TEXT[id];
    });
    if (closeBtn) closeBtn.setAttribute("aria-label", "Close");
  }

  // ── เปิด/ปิด popup (คัดลอกจาก track-modal.js ทุกประการ) ──
  var lastFocused = null;
  function openModal() {
    lastFocused = document.activeElement;
    renderCart();
    overlay.style.display = "flex";
    document.body.style.overflow = "hidden";
    requestAnimationFrame(function () { closeBtn && closeBtn.focus(); });
  }
  function closeModal() {
    overlay.style.display = "none";
    document.body.style.overflow = "";
    if (lastFocused && typeof lastFocused.focus === "function") lastFocused.focus();
  }
  window.openCartModal = openModal;
  window.closeCartModal = closeModal;

  closeBtn && closeBtn.addEventListener("click", closeModal);
  overlay.addEventListener("click", function (e) { if (e.target === overlay) closeModal(); });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && overlay.style.display === "flex") closeModal();
  });

  // focus-trap (คัดลอกจาก track-modal.js บรรทัด TM_FOCUSABLE_SELECTOR เป๊ะ แค่เปลี่ยนตัวแปร)
  var CM_FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), textarea:not([disabled]), ' +
    'input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Tab" || overlay.style.display !== "flex") return;
    var focusables = Array.prototype.slice.call(overlay.querySelectorAll(CM_FOCUSABLE_SELECTOR));
    if (!focusables.length) return;
    var first = focusables[0];
    var last = focusables[focusables.length - 1];
    var active = document.activeElement;
    if (e.shiftKey) {
      if (active === first || !overlay.contains(active)) { e.preventDefault(); last.focus(); }
    } else {
      if (active === last || !overlay.contains(active)) { e.preventDefault(); first.focus(); }
    }
  });

  // ── ราคาโดยประมาณ ตาม currency ที่ลูกค้าเลือกไว้ (ถ้ามี) — แพทเทิร์นเดียวกับ pdFormatPrice()
  // ใน js/products-detail-popup.js ทุกประการ (อ่าน localStorage key 'cssignCurrency' เดียวกัน,
  // fallback เป็น THB เสมอถ้า window.CSSignCurrency ไม่พร้อม/แปลงไม่ได้) — unitPriceHint ที่เก็บ
  // ใน cart เป็นตัวเลข THB base เสมอ (ดูคอมเมนต์หัวไฟล์ js/cart.js)
  var CURRENCY_STORAGE_KEY = "cssignCurrency";
  function formatPriceHint(amountThb) {
    if (amountThb == null || isNaN(Number(amountThb))) return "";
    var currency = "THB";
    try {
      var stored = window.localStorage && window.localStorage.getItem(CURRENCY_STORAGE_KEY);
      if (stored && window.CSSignCurrency && window.CSSignCurrency.isSupportedCurrency(stored)) currency = stored;
    } catch (e) { /* private mode / localStorage ไม่พร้อมใช้งาน — fallback THB */ }
    if (currency !== "THB" && window.CSSignCurrency) {
      var formatted = window.CSSignCurrency.formatCurrencyAmount(amountThb, currency);
      if (formatted) return formatted;
    }
    return "\u0e3f" + Number(amountThb).toLocaleString("th-TH");
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // ── render รายการในตะกร้า ──
  function renderCart() {
    var items = (window.CSSignCart && typeof window.CSSignCart.getCartItems === "function")
      ? window.CSSignCart.getCartItems()
      : [];

    if (!items.length) {
      listEl.innerHTML = "";
      listEl.style.display = "none";
      if (footerEl) footerEl.style.display = "none";
      if (priceNoteEl) priceNoteEl.style.display = "none";
      if (emptyEl) emptyEl.classList.add("show");
      return;
    }

    if (emptyEl) emptyEl.classList.remove("show");
    listEl.style.display = "";
    if (footerEl) footerEl.style.display = "";
    if (priceNoteEl) priceNoteEl.style.display = "";

    listEl.innerHTML = items.map(renderItem).join("");
    renderFooterSummary(items);
  }

  // ── สรุปจำนวนรวมเหนือปุ่ม "ขอใบเสนอราคา" (ใช้ .cm-footer-row ที่เตรียมไว้แล้วใน
  // css/cart-modal.css — แสดงแค่ "จำนวนรวม" ไม่ใช่ "ราคารวม" เพราะ unitPriceHint เป็นราคา
  // โดยประมาณต่อรายการเท่านั้น การรวมเป็นยอดเดียวจะดูเหมือนราคาทางการ ขัดกับคำเตือนใน
  // #cm-price-note ด้านบน) — upsert แถวเดียว ไม่ต้องลบ/สร้าง #cm-footer ใหม่ทั้งก้อน ป้องกัน
  // event listener ของปุ่ม #cm-quote-btn (ผูกไว้ครั้งเดียวตอนท้ายไฟล์) หลุดหายถ้าเผลอแทนที่
  // innerHTML ของ #cm-footer ทั้งก้อน
  function renderFooterSummary(items) {
    if (!footerEl || !quoteBtn) return;
    var totalQty = items.reduce(function (sum, it) { return sum + (Number(it.qty) || 0); }, 0);
    var label = isEn ? "Total items" : "\u0e08\u0e33\u0e19\u0e27\u0e19\u0e23\u0e27\u0e21";
    var summaryEl = document.getElementById("cm-footer-summary");
    if (!summaryEl) {
      summaryEl = document.createElement("div");
      summaryEl.className = "cm-footer-row";
      summaryEl.id = "cm-footer-summary";
      footerEl.insertBefore(summaryEl, quoteBtn);
    }
    summaryEl.innerHTML = "<span>" + label + "</span><strong>" + escapeHtml(String(totalQty)) + "</strong>";
  }

  function renderItem(item) {
    var metaParts = [];
    if (item.size) metaParts.push(item.size);
    if (item.material) metaParts.push(item.material);
    if (item.variantLabel) metaParts.push(item.variantLabel);
    var metaText = metaParts.join(" \u00b7 ");

    var priceHtml = "";
    if (item.unitPriceHint != null) {
      var priceSuffix = isEn ? " (est.)" : " (\u0e42\u0e14\u0e22\u0e1b\u0e23\u0e30\u0e21\u0e32\u0e13)";
      priceHtml = '<div class="cm-item-price-hint"><strong>' + escapeHtml(formatPriceHint(item.unitPriceHint)) + '</strong>' + priceSuffix + '</div>';
    }

    // รูปสินค้า: ห่อ <img class="real-photo"> ไว้ใน .cm-item-img เสมอ พร้อมไอคอน placeholder
    // (.cm-item-img-ph) วางซ้อนอยู่ข้างหลัง — เดิมปล่อยให้ js/img-error-fallback.js สั่ง
    // this.remove() ตรงๆ กับ <img class="cm-item-img"> ทำให้กล่องรูปทั้งกล่องหายไปเมื่อโหลด
    // รูปไม่สำเร็จ (เหลือช่องว่างแปลกๆ หน้าชื่อสินค้า) ตอนนี้ .cm-item-img เป็นกล่องคงที่เสมอ
    // (ขนาด/พื้นหลังกำหนดใน css/cart-modal.css) ส่วน <img> เป็นแค่ชั้นซ้อนทับด้านบน ถ้าโหลด
    //ไม่สำเร็จ ตัว <img> จะถูกลบออกเอง เหลือไอคอน placeholder ให้เห็นแทน สอดคล้องกับแพทเทิร์น
    // .img-ph-inner ที่ใช้ทั่วเว็บ (ดูคอมเมนต์หัวไฟล์ js/img-error-fallback.js) แค่ปรับให้เล็กลง
    // ให้พอดีกับรูปสินค้าขนาด 56×56 ในแถวตะกร้า
    var imgHtml = '<div class="cm-item-img">' +
      '<span class="cm-item-img-ph" aria-hidden="true">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="1.8"/><path d="M21 15l-5.5-5.5L5 20"/></svg>' +
      '</span>' +
      (item.image ? '<img class="real-photo" src="' + escapeHtml(item.image) + '" alt="' + escapeHtml(item.name || "") + '">' : '') +
      '</div>';

    var removeLabel = isEn ? "Remove item" : "\u0e25\u0e1a\u0e23\u0e32\u0e22\u0e01\u0e32\u0e23\u0e19\u0e35\u0e49";
    var minusLabel   = isEn ? "Decrease quantity" : "\u0e25\u0e14\u0e08\u0e33\u0e19\u0e27\u0e19";
    var plusLabel    = isEn ? "Increase quantity" : "\u0e40\u0e1e\u0e34\u0e48\u0e21\u0e08\u0e33\u0e19\u0e27\u0e19";

    return '<div class="cm-item" data-product-id="' + escapeHtml(item.productId) + '" data-variant-label="' + escapeHtml(item.variantLabel || "") + '">' +
      imgHtml +
      '<div class="cm-item-info">' +
        '<div class="cm-item-name">' + escapeHtml(item.name || "") + '</div>' +
        (metaText ? '<div class="cm-item-meta">' + escapeHtml(metaText) + '</div>' : "") +
        priceHtml +
      '</div>' +
      '<div class="cm-item-side">' +
        '<button type="button" class="cm-item-remove" aria-label="' + removeLabel + '">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>' +
        '</button>' +
        '<div class="cm-qty">' +
          '<button type="button" class="cm-qty-btn cm-qty-minus" aria-label="' + minusLabel + '">\u2212</button>' +
          '<span class="cm-qty-val">' + escapeHtml(String(item.qty)) + '</span>' +
          '<button type="button" class="cm-qty-btn cm-qty-plus" aria-label="' + plusLabel + '">+</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  // ── delegated click สำหรับปุ่ม +/-/ลบ ในแต่ละแถว — ต้อง delegate ผ่าน #cm-list เพราะ
  // listEl.innerHTML ถูกแทนที่ทั้งก้อนทุกครั้งที่ renderCart() ถูกเรียกใหม่ (ผูก listener ตรงๆ
  // กับปุ่มจะหลุดหายไปพร้อม element เก่าทุกรอบ — เหมือน #tm-result ใน track-modal.js) ──
  listEl.addEventListener("click", function (e) {
    var itemEl = e.target.closest(".cm-item");
    if (!itemEl || !window.CSSignCart) return;
    var productId = itemEl.getAttribute("data-product-id");
    var variantLabel = itemEl.getAttribute("data-variant-label") || "";

    if (e.target.closest(".cm-item-remove")) {
      window.CSSignCart.removeFromCart(productId, variantLabel);
      renderCart();
      return;
    }

    var plusBtn = e.target.closest(".cm-qty-plus");
    var minusBtn = e.target.closest(".cm-qty-minus");
    if (plusBtn || minusBtn) {
      var qtyEl = itemEl.querySelector(".cm-qty-val");
      var currentQty = qtyEl ? Number(qtyEl.textContent) || 0 : 0;
      var nextQty = currentQty + (plusBtn ? 1 : -1);
      window.CSSignCart.updateCartItemQty(productId, variantLabel, nextQty);
      renderCart();
      return;
    }
  });

  // ── ปุ่ม "ขอใบเสนอราคา" — เปิดฟอร์มขอใบเสนอราคาจริง (js/quote-form.js, P3.0 Phase 2) ที่
  // prefill รายการจากตะกร้า — เช็คว่ามีฟังก์ชันจริงก่อนเรียกแบบ lazy (หน้าที่ยังไม่ได้เพิ่ม
  // script tag ของ js/quote-form.js/js/quote-form-template.js จะไม่มี window.openQuoteRequestForm
  // — ไฟล์นี้เป็น classic script เรียก global function แบบ lazy ได้เลยไม่มีปัญหาเรื่อง timing) —
  // ปิด cart modal ตัวเองก่อนเปิดฟอร์มใหม่เสมอ (กันสอง overlay ซ้อนกัน) ──
  if (quoteBtn) {
    quoteBtn.addEventListener("click", function () {
      closeModal();
      if (typeof window.openQuoteRequestForm === "function") {
        window.openQuoteRequestForm();
      }
    });
  }
})();
