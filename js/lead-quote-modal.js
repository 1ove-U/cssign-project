/* Lead capture + email notify wiring for quote modal — shared across index, products, about */

import { saveLead } from './leads.js';
import { sendLeadEmails } from './email-notify.js';
import { initAntiSpam, isSpamSubmission } from './anti-spam.js';
import { mountTurnstile, getTurnstileToken, resetTurnstile } from './turnstile.js';
import { showToast } from './form-toast.js';
import { wireLiveValidation, validateFormFields } from './form-validate.js';

(function () {
  var overlay   = document.getElementById('qmodal-overlay');
  var closeBtn  = document.getElementById('qmodal-close');
  var form      = document.getElementById('qmodal-form');
  var successEl = document.getElementById('qmodal-success');
  if (form) initAntiSpam(form);
  if (form) wireLiveValidation(form);
  var tsEl = document.getElementById('qm-turnstile');

  /* ที่มาของ lead ต่างกันตามหน้า เพื่อให้รายงาน lead source ในหน้าแอดมินยังแยกหน้าได้
     เหมือนก่อนรวมไฟล์ — ตั้งค่าด้วย <body data-page="contact|portfolio"> ถ้าไม่ตั้งไว้
     (index.html, products.html, about.html, product-detail.html) ใช้ label เดิม 'quotation_modal' */
  var PAGE_SOURCE_MAP = {
    contact: 'quotation_modal_contact',
    portfolio: 'quotation_modal_portfolio'
  };
  var leadSource = PAGE_SOURCE_MAP[document.body.dataset.page] || 'quotation_modal';

  /* leadSource ที่ใช้จริงตอน submit — ปกติเท่ากับ leadSource ข้างบนตามหน้า
     แต่ผู้เรียก openModal() รายอื่น (เช่น chat-widget.js) override ได้ผ่าน
     opts.source เพื่อแยก report ใน admin ว่า lead มาจากช่องทางไหน โดยไม่ต้อง
     แตะ saveLead()/schema เดิมเลย — reset กลับเป็นค่าเดิมของหน้าทุกครั้งที่เปิด
     โมดัลใหม่โดยไม่ระบุ source ไว้ */
  var activeLeadSource = leadSource;

  /* Open modal from any "ขอใบเสนอราคา" button (รวม data-open-quote ที่ contact/portfolio ใช้) */
  document.querySelectorAll('a[href="contact.html"].btn-primary, a[href="contact.html"].btn[class*="btn-primary"], a[href="contact.html"].btn-white, a[href="contact.html"].btn[class*="btn-white"], button[data-open-quote]').forEach(function (el) {
    el.addEventListener('click', function (e) {
      e.preventDefault();
      openModal('form');
    });
  });

  /* opts (optional): { source, message }
     - source:  override lead source label for this open only (เช่น 'chat_widget')
     - message: prefill ช่องรายละเอียด (qm-msg) ถ้ายังว่างอยู่ */
  // 2026 refactor — accessibility phase (รอบที่ 58): เก็บ lastFocused ทุกครั้งที่เรียก
  // openModal() (ไม่ใช่แค่จุดเดียว) เพราะโมดัลนี้เปิดได้หลายทาง (ปุ่ม "ขอใบเสนอราคา" ทั่วไซต์/
  // estimator-quote-btn/chat-widget.js เรียก window.openModal() ตรงๆ)
  var qmLastFocused = null;
  window.openModal = function openModal(startTab, opts) {
    qmLastFocused = document.activeElement;
    overlay.style.display = 'flex';
    if (tsEl) mountTurnstile(tsEl);
    document.body.style.overflow = 'hidden';
    var tab = startTab || 'form';
    if (typeof qmodalSwitchTab === 'function') qmodalSwitchTab(tab);

    activeLeadSource = (opts && opts.source) ? opts.source : leadSource;
    if (opts && opts.message) {
      setTimeout(function () {
        var msgEl = document.getElementById('qm-msg');
        if (msgEl && !msgEl.value.trim()) msgEl.value = opts.message;
      }, 100);
    }
  };

  function closeModal() {
    overlay.style.display = 'none';
    document.body.style.overflow = '';
    if (qmLastFocused && typeof qmLastFocused.focus === 'function') qmLastFocused.focus();
    qmLastFocused = null;
  }

  closeBtn.addEventListener('click', closeModal);
  overlay.addEventListener('click', function (e) { if (e.target === overlay) closeModal(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });

  // เพิ่ม focus-trap (Tab/Shift+Tab วนใน modal) — Escape/return-focus มีอยู่แล้วด้านบน
  var QM_FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), textarea:not([disabled]), ' +
    'input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Tab' || overlay.style.display !== 'flex') return;
    var focusables = Array.prototype.slice.call(overlay.querySelectorAll(QM_FOCUSABLE_SELECTOR));
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

  /* Estimator CTA on main page */
  var mainEstBtn = document.getElementById('estimator-quote-btn');
  if (mainEstBtn) {
    mainEstBtn.addEventListener('click', function () {
      openModal('form');
      var s = window.__estimatorSummary;
      if (s) {
        setTimeout(function () {
          var msgEl = document.getElementById('qm-msg');
          var svcEl = document.getElementById('qm-service');
          if (msgEl) msgEl.value = 'สนใจ: ' + s.typeLabel + ' | วัสดุ: ' + s.materialLabel + ' | ขนาด: ' + s.sizeLabel + ' | จำนวน: ' + s.qty + ' ชิ้น | ราคาประมาณการ: ' + s.total.toLocaleString('th-TH') + ' บาท';
          if (svcEl && s.service) {
            Array.prototype.forEach.call(svcEl.options, function (opt) {
              if (opt.value === s.service || opt.text === s.service) svcEl.value = opt.value;
            });
          }
        }, 100);
      }
    });
  }

  /* Form submit */
  if (form) {
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var name    = document.getElementById('qm-name').value.trim();
      var email   = document.getElementById('qm-email').value.trim();
      var tel     = document.getElementById('qm-tel').value.trim();
      var service = document.getElementById('qm-service').value;
      var message = document.getElementById('qm-msg').value.trim();
      var agree   = document.getElementById('qm-agree').checked;

      if (!validateFormFields(form)) { return; }
      if (!agree) { showToast('กรุณายอมรับนโยบายความเป็นส่วนตัวก่อนส่งฟอร์ม', 'warn'); return; }
      if (!getTurnstileToken(tsEl)) {
        showToast('กรุณายืนยันตัวตน (แคปช่า) ก่อนส่งฟอร์ม', 'warn');
        return;
      }
      if (isSpamSubmission(form)) {
        /* เข้าข่ายบอท (honeypot ถูกกรอก หรือ submit เร็วผิดปกติ) — เงียบ ไม่บันทึกจริง
           แต่โชว์ success ให้เหมือนสำเร็จ เพื่อไม่ให้บอทรู้ว่าโดนกันแล้วปรับตัวหนี */
        form.style.display = 'none';
        successEl.style.display = 'flex';
        setTimeout(closeModal, 3000);
        return;
      }
      var submitBtn = form.querySelector('.qm-submit-btn');
      if (submitBtn.classList.contains('is-loading')) return; // prevent double submit
      submitBtn.disabled = true;
      submitBtn.classList.add('is-loading');

      /* บั๊กที่แก้: เดิม catch error ของ saveLead() เฉยๆ แล้วโชว์ "ส่งสำเร็จ" ต่อทุกครั้ง
         ทำให้ถ้า Firestore บันทึกไม่สำเร็จ ลูกค้าเห็นข้อความสำเร็จปลอมๆ ทั้งที่ lead
         หายไปเงียบๆ ไม่มีบันทึกที่ไหนเลย แก้แล้วโดยเช็คผลก่อนโชว์ success */
      var leadSaved = true;
      try {
        await saveLead({ name, email, tel, service, message }, activeLeadSource, getTurnstileToken(tsEl));
      } catch (err) {
        leadSaved = false;
        console.error('Lead save error:', err);
      }
      if (!leadSaved) {
        showToast('ขออภัย ระบบไม่สามารถบันทึกข้อมูลได้ในขณะนี้ กรุณาลองส่งอีกครั้ง หรือโทรติดต่อทีมงานที่ 062-883-3880', 'error');
        resetTurnstile(tsEl);
        submitBtn.disabled = false;
        submitBtn.classList.remove('is-loading');
        return;
      }
      try { await sendLeadEmails({ name, email, phone: tel, service, message }, activeLeadSource); } catch(err) { console.error(err); }

      resetTurnstile(tsEl);
      form.style.display = 'none';
      successEl.style.display = 'flex';
      setTimeout(closeModal, 3000);
    });
  }
})();
