// ===========================
// js/ui-helpers.js — UX helpers กลุ่ม dialog/state ใช้ร่วมกันทั่วทั้งแอดมิน
// - confirmDialog(): popup ยืนยันที่ออกแบบเอง แทน confirm() ของเบราว์เซอร์
// - errorStateHTML(): ข้อความ error ตอนโหลดข้อมูลล้มเหลว พร้อมปุ่ม "ลองใหม่"
// - emptyStateHTML(): empty state ที่มีไอคอน + ข้อความชวนทำ + ปุ่ม "เพิ่มรายการแรก"
// - showUndoToast(): toast ค้างพร้อมปุ่ม "เลิกทำ" (ใช้กับ undo หลังลบ)
//
// 2026 refactor phase 10: แยกส่วน "สถิติแดชบอร์ด" (monthlySnapshotUpdate()/renderTrendBadge()/
// renderSparkline()) ออกไปเป็น js/ui-stats-widgets.js (ใหม่) แบบ diff เป๊ะ ไม่มีเปลี่ยน logic —
// re-export renderSparkline/renderTrendBadge กลับจากที่นี่ (ด้านล่างสุดของไฟล์) เพื่อให้
// admin-overview-dashboard.js/orders-tab-stats.js ที่เคย import จากที่นี่เดิมไม่ต้องแก้ไฟล์
//
// 2026 refactor phase 26: แยกกลุ่ม inline form validation + dirty-tracking (showFieldError/
// clearFieldError/attachInlineValidation/validateFormInline/createDirtyTracker/isAnyFormDirty/
// attachUnsavedGuard) ออกไปเป็น js/ui-form-validation.js (ใหม่) แบบ diff เป๊ะ ไม่มีเปลี่ยน logic —
// ไฟล์นั้น import confirmDialog() กลับมาจากที่นี่ (attachUnsavedGuard เรียกใช้ตอนถามยืนยันปิดฟอร์ม
// ที่ยังไม่บันทึก) เป็นทิศทางเดียว ไฟล์นี้ไม่ได้ import อะไรจาก ui-form-validation.js กลับไป
// ===========================

let confirmOverlay = null;

function escapeHtmlUI(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
}

function ensureConfirmOverlay() {
  if (confirmOverlay) return confirmOverlay;
  confirmOverlay = document.createElement("div");
  confirmOverlay.className = "cp-confirm-overlay";
  confirmOverlay.style.display = "none";
  confirmOverlay.innerHTML = `
    <div class="cp-confirm-box" role="alertdialog" aria-modal="true">
      <div class="cp-confirm-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/></svg>
      </div>
      <div class="cp-confirm-title" id="cp-confirm-title"></div>
      <div class="cp-confirm-msg" id="cp-confirm-msg"></div>
      <div class="cp-confirm-actions">
        <button type="button" class="btn btn-secondary cl-btn" id="cp-confirm-cancel">ยกเลิก</button>
        <button type="button" class="btn btn-primary cl-btn" id="cp-confirm-ok">ยืนยัน</button>
      </div>
    </div>`;
  document.body.appendChild(confirmOverlay);
  return confirmOverlay;
}

/**
 * แสดง modal ยืนยันแบบออกแบบเอง (แทนที่ confirm() ของเบราว์เซอร์)
 * @param {string} message ข้อความคำถาม เช่น 'ลบสินค้า "..." ใช่หรือไม่?'
 * @param {{title?:string, confirmLabel?:string, danger?:boolean}} opts
 * @returns {Promise<boolean>}
 */
export function confirmDialog(message, opts) {
  const { title = "ยืนยันการดำเนินการ", confirmLabel = "ยืนยันการลบ", danger = true } = opts || {};
  const overlay = ensureConfirmOverlay();
  const okBtn = overlay.querySelector("#cp-confirm-ok");
  const cancelBtn = overlay.querySelector("#cp-confirm-cancel");
  overlay.querySelector("#cp-confirm-title").textContent = title;
  overlay.querySelector("#cp-confirm-msg").textContent = message;
  okBtn.textContent = confirmLabel;
  okBtn.classList.toggle("btn-primary", !danger);
  okBtn.classList.toggle("btn-danger", danger);
  if (danger) { okBtn.style.background = "#DC2626"; okBtn.style.borderColor = "#DC2626"; }
  else { okBtn.style.background = ""; okBtn.style.borderColor = ""; }

  return new Promise((resolve) => {
    function cleanup(result) {
      overlay.style.display = "none";
      document.body.classList.remove("cp-scroll-locked");
      okBtn.removeEventListener("click", onOk);
      cancelBtn.removeEventListener("click", onCancel);
      overlay.removeEventListener("click", onOverlay);
      document.removeEventListener("keydown", onKey);
      resolve(result);
    }
    function onOk() { cleanup(true); }
    function onCancel() { cleanup(false); }
    function onOverlay(e) { if (e.target === overlay) cleanup(false); }
    function onKey(e) { if (e.key === "Escape") cleanup(false); if (e.key === "Enter") cleanup(true); }
    okBtn.addEventListener("click", onOk);
    cancelBtn.addEventListener("click", onCancel);
    overlay.addEventListener("click", onOverlay);
    document.addEventListener("keydown", onKey);
    overlay.style.display = "flex";
    document.body.classList.add("cp-scroll-locked");
    setTimeout(() => okBtn.focus(), 10);
  });
}

let retryHandlerSeq = 0;
const retryHandlers = new Map();

// ผูก listener กลางไว้ที่ document ครั้งเดียว (event delegation) เพื่อรองรับปุ่ม "ลองใหม่"
// ที่ถูกแทรกเข้ามาผ่าน innerHTML ทีหลัง (listener ตรงจุดจะหายไปพร้อม element เดิมทุกครั้งที่ re-render)
document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-retry-key]");
  if (!btn) return;
  const fn = retryHandlers.get(btn.dataset.retryKey);
  if (fn) fn(btn);
});

/**
 * สร้าง HTML ข้อความ error ตอนโหลดข้อมูลล้มเหลว พร้อมปุ่ม "ลองใหม่"
 * ปุ่มนี้เรียก onRetry() ที่ส่งเข้ามาโดยไม่ต้อง refresh ทั้งหน้า (ผูกผ่าน event delegation อัตโนมัติ)
 * @param {string} message ข้อความ error เช่น 'โหลดข้อมูลไม่สำเร็จ: ...'
 * @param {Function} onRetry ฟังก์ชันที่จะเรียกเมื่อกดปุ่ม "ลองใหม่" (เช่น reloadAll หรือ listener เดิม)
 * @param {{wrapTag?:string}} [opts] wrapTag: แท็กที่ครอบ เช่น "div" (ค่าเริ่มต้น) หรือ "span" สำหรับใส่ใน <td>
 */
export function errorStateHTML(message, onRetry, opts) {
  const { wrapTag = "div" } = opts || {};
  const key = "retry-" + (++retryHandlerSeq);
  if (typeof onRetry === "function") {
    retryHandlers.set(key, async (btn) => {
      const original = btn.textContent;
      btn.disabled = true;
      btn.textContent = "กำลังลองใหม่...";
      try {
        await onRetry();
      } finally {
        // ปุ่มอาจถูกลบไปแล้วถ้า retry สำเร็จและ re-render ทับ — ไม่ต้องทำอะไรถ้าไม่ได้อยู่ใน DOM แล้ว
        if (btn.isConnected) { btn.disabled = false; btn.textContent = original; }
        retryHandlers.delete(key);
      }
    });
  }
  return `<${wrapTag} class="cp-empty cp-load-error">
      <span class="cp-load-error-msg">${escapeHtmlUI(message)}</span>
      <button type="button" class="btn btn-secondary cl-btn cp-retry-btn" data-retry-key="${key}">ลองใหม่</button>
    </${wrapTag}>`;
}

/**
 * สร้าง HTML สำหรับ empty state ที่มีประโยชน์ (ไอคอน + ข้อความ + ปุ่ม "เพิ่มรายการแรก")

 * @param {{icon?:string, title:string, desc?:string, ctaLabel?:string, ctaId?:string}} opts
 */
export function emptyStateHTML(opts) {
  const {
    icon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 21h18M5 21V7l8-4 8 4v14M9 21v-6h6v6"/></svg>`,
    title, desc = "", ctaLabel = "", ctaId = ""
  } = opts;
  return `
    <div class="cp-empty-state">
      <div class="cp-empty-state-icon">${icon}</div>
      <div class="cp-empty-state-title">${escapeHtmlUI(title)}</div>
      ${desc ? `<div class="cp-empty-state-desc">${escapeHtmlUI(desc)}</div>` : ""}
      ${ctaLabel && ctaId ? `<button type="button" class="btn btn-primary cl-btn" id="${ctaId}">${escapeHtmlUI(ctaLabel)}</button>` : ""}
    </div>`;
}

/**
 * แสดง toast ค้างไว้พร้อมปุ่ม "เลิกทำ" (ใช้กับ undo หลังลบ) — ถ้าไม่มีการกดเลิกทำภายในเวลาที่กำหนด
 * จะถือว่ายืนยันแล้ว (resolve false) ให้ผู้เรียกไปทำ action จริง (เช่น ลบจริงจาก DB)
 * @param {string} message ข้อความที่แสดง เช่น 'ลบสินค้า "..." แล้ว'
 * @param {number} [duration=5000] ms ก่อนหมดเวลาเลิกทำ
 * @returns {Promise<boolean>} true = ผู้ใช้กด "เลิกทำ" (ยกเลิก action), false = หมดเวลา (ทำ action ต่อ)
 */
export function showUndoToast(message, duration = 5000) {
  let wrap = document.querySelector(".cp-toast-wrap");
  if (!wrap) {
    wrap = document.createElement("div");
    wrap.className = "cp-toast-wrap";
    document.body.appendChild(wrap);
  }
  const el = document.createElement("div");
  el.className = "cp-toast undo";
  el.setAttribute("role", "status");
  el.innerHTML = `
    <span class="cp-toast-msg"></span>
    <button type="button" class="cp-toast-undo-btn">เลิกทำ</button>
    <div class="cp-toast-progress"></div>`;
  el.querySelector(".cp-toast-msg").textContent = message;
  const bar = el.querySelector(".cp-toast-progress");
  bar.style.animationDuration = duration + "ms";
  wrap.appendChild(el);

  return new Promise((resolve) => {
    let done = false;
    let timer = null;
    function finish(undone) {
      if (done) return;
      done = true;
      if (timer) clearTimeout(timer);
      el.classList.add("closing");
      setTimeout(() => el.remove(), 200);
      resolve(undone);
    }
    el.querySelector(".cp-toast-undo-btn").addEventListener("click", () => finish(true));
    timer = setTimeout(() => finish(false), duration);
  });
}

// monthlySnapshotUpdate/renderTrendBadge/renderSparkline ย้ายไป js/ui-stats-widgets.js แล้ว
// (ดูหมายเหตุ phase 10 ที่หัวไฟล์) — re-export กลับจากที่นี่เพื่อให้ admin-overview-dashboard.js/
// orders-tab-stats.js import จาก ui-helpers.js ได้เหมือนเดิม
export { renderSparkline, renderTrendBadge } from "./ui-stats-widgets.js";
