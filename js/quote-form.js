/* Quote-request form logic (P3.0 Phase 2 รอบย่อย 2) — เปิดจาก window.openQuoteRequestForm()
   (เรียกจาก #cm-quote-btn ใน js/cart-modal.js — ผูกจริงรอบถัดไป ดู continue-prompt รอบนี้)

   **type="module" โดยตั้งใจ** — ไฟล์นี้ import ตรงจาก js/db-quote-requests.js (ต่างจาก
   js/cart-modal.js ที่เป็น classic เพราะไม่มี import เลย) — module script ถูก defer อัตโนมัติเสมอ
   (รันหลัง parse เอกสารจบ) ส่วน js/quote-form-template.js (classic, ดูไฟล์นั้น) รันทันทีตอน parse
   เจอ insert markup ไว้ก่อนแล้วเสมอ ไม่มีจังหวะพลาดเรื่อง timing — เหมือน js/track-modal.js ที่เป็น
   module และพึ่ง markup จาก classic template script ก่อนหน้าเช่นกัน */

import { saveQuoteRequest, isValidThaiTaxId } from './db-quote-requests.js';
import { initAntiSpam, isSpamSubmission } from './anti-spam.js';
import { mountTurnstile, getTurnstileToken, resetTurnstile } from './turnstile.js';
import { showToast } from './form-toast.js';
import { wireLiveValidation, validateFormFields, showFieldError, clearFieldError } from './form-validate.js';

(function () {
  var overlay   = document.getElementById('qr-overlay');
  var closeBtn  = document.getElementById('qr-close');
  var form      = document.getElementById('qr-form');
  var successEl = document.getElementById('qr-success');
  var itemsList = document.getElementById('qr-items-list');
  if (!overlay || !form) return; // หน้านี้ไม่มีฟอร์มนี้ (ยังไม่ได้เพิ่ม script tag) — ข้าม

  if (form) initAntiSpam(form);
  if (form) wireLiveValidation(form);
  var tsEl = document.getElementById('qr-turnstile');

  var isEn = /\/en\//.test(window.location.pathname);

  if (isEn) {
    var EN_TEXT = {
      'qr-eyebrow':              'REQUEST QUOTATION',
      'qr-title':                'Request a Quotation',
      'qr-items-label':          'Items requested',
      'qr-label-name':           'Full name / Company name *',
      'qr-label-taxid':          'Tax ID (13 digits, optional)',
      'qr-label-billing-address':'Billing address',
      'qr-label-contact-person': 'Contact person',
      'qr-label-phone':          'Phone number *',
      'qr-label-email':          'Email',
      'qr-shipping-same-label':  'Shipping address same as billing address',
      'qr-label-shipping-address':'Shipping address',
      'qr-label-wanted-date':    'Date needed',
      'qr-label-payment-terms':  'Requested payment terms',
      'qr-label-notes':          'Additional notes',
      'qr-submit-label':         'Send Quote Request',
      'qr-success-text':         'Thank you! Our team will prepare your quotation and get back to you within 24 hours.'
    };
    Object.keys(EN_TEXT).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.textContent = EN_TEXT[id];
    });
    var nameEl = document.getElementById('qr-name');
    if (nameEl) nameEl.placeholder = 'Enter your name or company name';
    var billingAddrEl = document.getElementById('qr-billing-address');
    if (billingAddrEl) billingAddrEl.placeholder = 'Address for issuing documents';
    var contactPersonEl = document.getElementById('qr-contact-person');
    if (contactPersonEl) contactPersonEl.placeholder = 'Coordinator name';
    var emailEl = document.getElementById('qr-email');
    if (emailEl) emailEl.placeholder = 'Your email';
    var shippingAddrEl = document.getElementById('qr-shipping-address');
    if (shippingAddrEl) shippingAddrEl.placeholder = 'Delivery address';
    var notesEl = document.getElementById('qr-notes');
    if (notesEl) notesEl.placeholder = 'Any additional details (optional)';
    var agreeLabelEl = document.getElementById('qr-agree-label');
    if (agreeLabelEl) {
      agreeLabelEl.innerHTML = 'I agree to the<a href="privacy-policy.html" target="_blank" rel="noopener" style="color:var(--primary);"> Privacy Policy</a>';
    }
    var ptSel = document.getElementById('qr-payment-terms');
    if (ptSel) {
      var PT_EN = {
        '': 'Not specified',
        cash_on_delivery: 'Cash on delivery',
        full_prepay: 'Full prepayment before production',
        deposit_50: '50% deposit before production, balance before delivery',
        credit_30: '30-day credit (corporate customers)',
        other: 'Other / discuss with our team'
      };
      Array.prototype.forEach.call(ptSel.options, function (opt) {
        if (PT_EN[opt.value] != null) opt.textContent = PT_EN[opt.value];
      });
    }
    if (closeBtn) closeBtn.setAttribute('aria-label', 'Close');
  }

  var EMPTY_CART_MSG = isEn
    ? 'Please add at least one product before requesting a quote.'
    : 'กรุณาเลือกสินค้าอย่างน้อย 1 ชิ้นก่อนขอใบเสนอราคา';

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* render รายการสินค้า read-only (ไม่มีปุ่มแก้ไข/ลบ — ต่างจาก renderCart() ใน cart-modal.js
     ตรงนี้จุดเดียว) — ใช้ class .cm-item/.cm-item-name/.cm-item-meta เดิมของ css/cart-modal.css
     ซ้ำ (ทุกหน้าที่มีฟอร์มนี้โหลด cart-modal.css อยู่แล้วเสมอ ดูคอมเมนต์ js/quote-form-template.js) */
  function renderItemsSummary(items) {
    if (!itemsList) return;
    itemsList.innerHTML = items.map(function (item) {
      var metaParts = [];
      if (item.size) metaParts.push(item.size);
      if (item.material) metaParts.push(item.material);
      if (item.variantLabel) metaParts.push(item.variantLabel);
      var qtyLabel = (isEn ? 'Qty ' : 'จำนวน ') + (Number(item.qty) || 1) + (item.unit ? ' ' + item.unit : '');
      metaParts.push(qtyLabel);
      var metaText = metaParts.join(' \u00b7 ');
      return '<div class="cm-item">' +
        '<div class="cm-item-info">' +
          '<div class="cm-item-name">' + escapeHtml(item.name || '') + '</div>' +
          '<div class="cm-item-meta">' + escapeHtml(metaText) + '</div>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  /* เก็บรายการตะกร้า ณ ตอนเปิดฟอร์มไว้ในตัวแปรนี้ — ใช้ตอน submit (ไม่อ่านตะกร้าซ้ำตอน submit
     เพราะถ้าลูกค้าเปิดหลายแท็บ/แก้ localStorage ระหว่างกรอกฟอร์ม รายการที่ส่งจริงควรตรงกับที่
     ลูกค้าเห็นบนหน้าจอฟอร์มนี้เป๊ะ ไม่ใช่ค่าล่าสุดที่อาจเปลี่ยนไปแล้วเงียบๆ) */
  var currentCartItems = [];

  var qrLastFocused = null;
  window.openQuoteRequestForm = function openQuoteRequestForm() {
    var items = (window.CSSignCart && typeof window.CSSignCart.getCartItems === 'function')
      ? window.CSSignCart.getCartItems()
      : [];

    if (!items.length) {
      // ตะกร้าว่าง — ห้ามเปิดฟอร์มนี้เด็ดขาด (ยืนยันแล้วในคำถามที่เคยค้าง ข้อ 2) นำทางไปหน้า
      // สินค้าแทน พร้อม toast แจ้งสั้นๆ
      // "products.html" เป็น relative path เสมอ — หน้าใน en/ อยู่ที่ en/xxx.html อยู่แล้ว
      // relative "products.html" จึงชี้ไปที่ en/products.html ถูกต้องโดยไม่ต้องเช็ค isEn เพิ่ม —
      // ดีเลย์เล็กน้อยก่อนนำทางจริง ให้ toast มีเวลาแสดงให้ลูกค้าเห็นก่อนหน้าเปลี่ยน (ไม่งั้น
      // นำทางทันทีจะบังไม่ให้เห็น toast เลย)
      showToast(EMPTY_CART_MSG, 'warn');
      setTimeout(function () { window.location.href = 'products.html'; }, 1500);
      return;
    }

    currentCartItems = items;
    renderItemsSummary(items);

    qrLastFocused = document.activeElement;
    overlay.style.display = 'flex';
    if (tsEl) mountTurnstile(tsEl);
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(function () { closeBtn && closeBtn.focus(); });
  };

  function closeModal() {
    overlay.style.display = 'none';
    document.body.style.overflow = '';
    if (qrLastFocused && typeof qrLastFocused.focus === 'function') qrLastFocused.focus();
    qrLastFocused = null;
  }

  closeBtn && closeBtn.addEventListener('click', closeModal);
  overlay.addEventListener('click', function (e) { if (e.target === overlay) closeModal(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && overlay.style.display === 'flex') closeModal(); });

  var QR_FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), textarea:not([disabled]), ' +
    'input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Tab' || overlay.style.display !== 'flex') return;
    var focusables = Array.prototype.slice.call(overlay.querySelectorAll(QR_FOCUSABLE_SELECTOR));
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

  /* checkbox "ที่อยู่จัดส่งเหมือนที่อยู่ออกใบกำกับ" — ติ๊กแล้ว copy ค่าจาก billingAddress แล้ว
     disable ช่อง shippingAddress (ตามสเปครอบนี้) — ถ้าติ๊กออกให้ enable กลับ (ไม่ล้างค่าที่เคย
     copy ไว้ ลูกค้าอาจแค่อยากแก้ไขบางส่วนต่อจากที่ copy มา) */
  var shippingSameEl = document.getElementById('qr-shipping-same');
  var billingAddrInput = document.getElementById('qr-billing-address');
  var shippingAddrInput = document.getElementById('qr-shipping-address');
  function syncShippingAddress() {
    if (!shippingSameEl || !shippingAddrInput) return;
    if (shippingSameEl.checked) {
      shippingAddrInput.value = billingAddrInput ? billingAddrInput.value : '';
      shippingAddrInput.disabled = true;
    } else {
      shippingAddrInput.disabled = false;
    }
  }
  if (shippingSameEl) shippingSameEl.addEventListener('change', syncShippingAddress);
  if (billingAddrInput) {
    billingAddrInput.addEventListener('input', function () {
      if (shippingSameEl && shippingSameEl.checked) syncShippingAddress();
    });
  }

  /* validate taxId แยกต่างหากจาก validateFormFields() เดิม (built-in validator ไม่รู้จัก
     checksum เลขผู้เสียภาษี) — เช็คตอน blur (เหมือน wireLiveValidation ของช่องอื่น) + ตอน submit */
  var taxIdInput = document.getElementById('qr-taxid');
  var TAXID_ERR_MSG = isEn
    ? 'Invalid Tax ID — please check the 13 digits entered'
    : 'เลขผู้เสียภาษีไม่ถูกต้อง กรุณาตรวจสอบตัวเลข 13 หลักที่กรอก';
  function validateTaxIdField() {
    if (!taxIdInput) return true;
    if (isValidThaiTaxId(taxIdInput.value)) {
      clearFieldError(taxIdInput);
      return true;
    }
    showFieldError(taxIdInput, TAXID_ERR_MSG);
    return false;
  }
  if (taxIdInput) taxIdInput.addEventListener('blur', validateTaxIdField);

  /* Form submit */
  if (form) {
    form.addEventListener('submit', async function (e) {
      e.preventDefault();

      if (!currentCartItems.length) {
        // เผื่อกรณีเปิดฟอร์มค้างไว้นานแล้วตะกร้าถูกล้างจากแท็บ/หน้าอื่นระหว่างนั้น
        closeModal();
        showToast(EMPTY_CART_MSG, 'warn');
        return;
      }

      var formOk = validateFormFields(form);
      var taxIdOk = validateTaxIdField();
      if (!formOk || !taxIdOk) return;

      var agree = document.getElementById('qr-agree').checked;
      if (!agree) {
        showToast(isEn ? 'Please accept the privacy policy before submitting.' : 'กรุณายอมรับนโยบายความเป็นส่วนตัวก่อนส่งฟอร์ม', 'warn');
        return;
      }
      if (!getTurnstileToken(tsEl)) {
        showToast(isEn ? 'Please complete the verification (captcha) before submitting.' : 'กรุณายืนยันตัวตน (แคปช่า) ก่อนส่งฟอร์ม', 'warn');
        return;
      }
      if (isSpamSubmission(form)) {
        // เข้าข่ายบอท — เงียบ ไม่บันทึกจริง แต่โชว์ success ปลอมๆ (pattern เดียวกับ lead-quote-modal.js)
        form.style.display = 'none';
        successEl.style.display = 'flex';
        setTimeout(closeModal, 3000);
        return;
      }

      var submitBtn = form.querySelector('.qm-submit-btn');
      if (submitBtn.classList.contains('is-loading')) return; // prevent double submit
      submitBtn.disabled = true;
      submitBtn.classList.add('is-loading');

      var formData = {
        billingName: document.getElementById('qr-name').value.trim(),
        taxId: taxIdInput ? taxIdInput.value.trim() : '',
        billingAddress: billingAddrInput ? billingAddrInput.value.trim() : '',
        contactPerson: document.getElementById('qr-contact-person').value.trim(),
        phone: document.getElementById('qr-phone').value.trim(),
        email: document.getElementById('qr-email').value.trim(),
        shippingAddress: shippingAddrInput ? shippingAddrInput.value.trim() : '',
        wantedDate: document.getElementById('qr-wanted-date').value,
        paymentTermsRequested: document.getElementById('qr-payment-terms').value,
        notes: document.getElementById('qr-notes').value.trim()
      };

      var saved = true;
      var savedId = null;
      try {
        savedId = await saveQuoteRequest(formData, currentCartItems, 'quote_request_cart', getTurnstileToken(tsEl));
      } catch (err) {
        saved = false;
        console.error('saveQuoteRequest error:', err);
      }
      if (!saved) {
        showToast(isEn
          ? 'Sorry, we could not save your request right now. Please try again or call us at 062-883-3880.'
          : 'ขออภัย ระบบไม่สามารถบันทึกคำขอได้ในขณะนี้ กรุณาลองส่งอีกครั้ง หรือโทรติดต่อทีมงานที่ 062-883-3880', 'error');
        resetTurnstile(tsEl);
        submitBtn.disabled = false;
        submitBtn.classList.remove('is-loading');
        return;
      }

      // อีเมลแจ้งลูกค้า+ทีมงาน — reuse sendLeadEmails()/เทมเพลตเดิมของ js/email-notify.js (ตั้งใจ
      // ไม่สร้างเทมเพลต EmailJS ใหม่ เพราะบัญชีฟรีจำกัด 2 เทมเพลตและใช้เต็มโควตาแล้ว — ดูคอมเมนต์
      // หัวไฟล์ email-notify.js) แมป field ของ quote_requests เข้ากับ shape เดิมที่เทมเพลตรองรับ
      // (name/email/phone/service/message) — เรื่องนี้คนละประเด็นกับ Phase 6 ที่ตัด "แจ้งอีเมล
      // ลูกค้าตอนใบเสนอราคาถูกออก" ออกไปแล้ว (นั่นคือตอนแอดมินออกเอกสารจริงใน Phase 3 ยังไม่ทำ) —
      // ตรงนี้คือแค่อีเมลยืนยันว่า "ได้รับคำขอแล้ว" เหมือนฟอร์ม qmodal เดิมทำอยู่แล้วทุกประการ
      try {
        var itemsSummary = currentCartItems.map(function (it) {
          return (it.name || '') + ' x' + (it.qty || 1) + (it.unit ? ' ' + it.unit : '');
        }).join(', ');
        var messageForEmail = (isEn ? 'Requested items: ' : 'รายการที่ขอใบเสนอราคา: ') + itemsSummary +
          (formData.notes ? ' | ' + (isEn ? 'Notes: ' : 'หมายเหตุ: ') + formData.notes : '');
        var emailNotifyMod = await import('./email-notify.js');
        await emailNotifyMod.sendLeadEmails({
          name: formData.billingName,
          email: formData.email,
          phone: formData.phone,
          service: isEn ? 'Quote request (cart)' : 'ขอใบเสนอราคา (จากตะกร้า)',
          message: messageForEmail
        }, 'quote_request_cart');
      } catch (err) { console.error(err); }

      if (window.CSSignCart && typeof window.CSSignCart.clearCart === 'function') {
        window.CSSignCart.clearCart();
      }
      if (typeof window.closeCartModal === 'function') window.closeCartModal();

      resetTurnstile(tsEl);
      form.style.display = 'none';
      successEl.style.display = 'flex';
      setTimeout(closeModal, 3000);
    });
  }
})();
