// ===========================
// js/ui-helpers.js — UX helpers ใช้ร่วมกันระหว่าง admin-page.js และ orders-tab.js
// - confirmDialog(): popup ยืนยันที่ออกแบบเอง แทน confirm() ของเบราว์เซอร์
// - emptyStateHTML(): empty state ที่มีไอคอน + ข้อความชวนทำ + ปุ่ม "เพิ่มรายการแรก"
// - inline field validation: ขึ้นข้อความแดงใต้ช่องที่กรอกผิด แทนรอ submit แล้วเจอ alert
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
 * แสดงข้อความแดงใต้ช่อง input ที่กรอกผิด (inline validation)
 */
export function showFieldError(input, message) {
  if (!input) return;
  input.classList.add("cl-invalid");
  let err = input.nextElementSibling;
  if (!err || !err.classList.contains("cl-field-error")) {
    err = document.createElement("div");
    err.className = "cl-field-error";
    input.insertAdjacentElement("afterend", err);
  }
  err.textContent = message;
  err.classList.add("active");
}

export function clearFieldError(input) {
  if (!input) return;
  input.classList.remove("cl-invalid");
  const err = input.nextElementSibling;
  if (err && err.classList.contains("cl-field-error")) {
    err.classList.remove("active");
  }
}

/**
 * ผูก inline validation ให้ฟอร์ม: เช็คตอน blur/input ของทุกช่องที่ required
 * แสดงข้อความแดงใต้ช่องทันทีแทนที่ต้องรอ submit แล้วเจอ alert ของเบราว์เซอร์
 * @param {HTMLFormElement} form
 * @param {Object.<string,string>} messages แผนที่ id ช่อง -> ข้อความ error กำหนดเอง (ไม่บังคับ)
 */
export function attachInlineValidation(form, messages) {
  if (!form) return;
  const fields = form.querySelectorAll("[required]");
  fields.forEach(field => {
    const check = () => {
      if (!field.checkValidity()) {
        const custom = messages && messages[field.id];
        showFieldError(field, custom || "กรุณากรอกข้อมูลในช่องนี้");
        return false;
      }
      clearFieldError(field);
      return true;
    };
    field.addEventListener("blur", check);
    field.addEventListener("input", () => { if (field.classList.contains("cl-invalid")) check(); });
    field.addEventListener("invalid", (e) => { e.preventDefault(); check(); });
  });
  form.addEventListener("reset", () => {
    fields.forEach(f => clearFieldError(f));
  });
}

/** เช็คฟอร์มทั้งหมดตอนกด submit — คืนค่า true ถ้าผ่านหมด, false ถ้ามีช่องไม่ผ่าน (และ scroll ไปช่องแรกที่ผิด) */
export function validateFormInline(form, messages) {
  if (!form) return true;
  const fields = form.querySelectorAll("[required]");
  let firstInvalid = null;
  fields.forEach(field => {
    if (!field.checkValidity()) {
      const custom = messages && messages[field.id];
      showFieldError(field, custom || "กรุณากรอกข้อมูลในช่องนี้");
      if (!firstInvalid) firstInvalid = field;
    } else {
      clearFieldError(field);
    }
  });
  if (firstInvalid) {
    firstInvalid.scrollIntoView({ behavior: "smooth", block: "center" });
    firstInvalid.focus();
    return false;
  }
  return true;
}

/**
 * สร้างตัวเช็คว่าฟอร์มมีการแก้ไขข้อมูลไปจากตอน capture() ครั้งล่าสุดหรือไม่
 * (เทียบ snapshot ของค่าฟิลด์ทั้งหมดในฟอร์ม + ข้อมูลเพิ่มเติมนอกฟอร์มถ้ามี เช่น รายการรูปภาพ)
 * @param {HTMLFormElement} form
 * @param {Function} [getExtra] ฟังก์ชันคืนค่าข้อมูลเพิ่มเติมที่ไม่ได้อยู่ใน <form> แต่ควรนับว่าฟอร์ม "แก้ไขแล้ว" ด้วย
 */
export function createDirtyTracker(form, getExtra) {
  let snapshot = null;
  function serialize() {
    const data = {};
    if (form) {
      form.querySelectorAll("input, select, textarea").forEach(field => {
        if (!field.id && !field.name) return;
        const key = field.id || field.name;
        if (field.type === "checkbox" || field.type === "radio") data[key] = field.checked;
        else data[key] = field.value;
      });
    }
    return JSON.stringify({ data, extra: getExtra ? getExtra() : null });
  }
  return {
    /** เรียกตอนเปิดฟอร์ม (หลังตั้งค่าเริ่มต้นทุกช่องแล้ว) เพื่อบันทึกจุดเริ่มต้นไว้เทียบ */
    capture() { snapshot = serialize(); },
    /** คืนค่า true ถ้าข้อมูลในฟอร์มตอนนี้ต่างจากตอน capture() */
    isDirty() { return snapshot !== null && serialize() !== snapshot; },
    reset() { snapshot = null; }
  };
}

/**
 * ผูก guard ป้องกันข้อมูลหายให้ modal: ถ้าฟอร์มมีการแก้ไขข้อมูลไปแล้ว (เทียบกับตอนเปิดฟอร์ม)
 * ก่อนปิดจริง (ปุ่มยกเลิก / คลิกนอก modal / กด Esc) จะถาม confirmDialog() ก่อนเสมอ
 * ถ้าฟอร์มยังไม่ถูกแก้ไข จะปิดทันทีโดยไม่ถาม
 *
 * ใช้คู่กับปุ่มยกเลิก/คลิกนอก modal โดยเรียก guard.guardedClose() แทนฟังก์ชันปิดตรงๆ
 * และเรียก guard.capture() ท้ายฟังก์ชัน openXxxModal() หลังตั้งค่าฟิลด์ครบแล้ว
 *
 * @param {{overlay:HTMLElement, form:HTMLFormElement, doClose:Function, getExtra?:Function, message?:string}} opts
 * @returns {{capture:Function, guardedClose:Function}}
 */
// รายการ tracker ของทุก guard ที่ถูกสร้างขึ้นทั้งหน้า (ใช้เช็ครวมตอนจะออกจากระบบ/ปิดหน้าเว็บ)
const _allGuardTrackers = [];

/** true ถ้ามีฟอร์มใดๆ ในหน้าที่ยังไม่ได้บันทึก (ใช้ก่อนออกจากระบบ/ปิดแท็บ) */
export function isAnyFormDirty() {
  return _allGuardTrackers.some(t => t.isDirty());
}

// เตือนก่อนปิดแท็บ/รีเฟรช/ออกจากเว็บ ถ้ามีฟอร์มค้างที่ยังไม่บันทึก (ผูกครั้งเดียวพอ)
if (typeof window !== "undefined" && !window.__unsavedGuardBeforeUnloadBound) {
  window.__unsavedGuardBeforeUnloadBound = true;
  window.addEventListener("beforeunload", (e) => {
    if (isAnyFormDirty()) {
      e.preventDefault();
      e.returnValue = "";
      return "";
    }
  });
}

export function attachUnsavedGuard(opts) {
  const {
    overlay, form, doClose, getExtra,
    message = "คุณมีข้อมูลที่ยังไม่ได้บันทึก หากปิดตอนนี้การแก้ไขจะหายไป ต้องการปิดหน้าต่างนี้ใช่หรือไม่?"
  } = opts || {};
  const tracker = createDirtyTracker(form, getExtra);
  _allGuardTrackers.push(tracker);
  let confirming = false;

  async function guardedClose() {
    if (confirming) return;
    if (tracker.isDirty()) {
      confirming = true;
      let ok;
      try {
        ok = await confirmDialog(message, { title: "ยังไม่ได้บันทึกข้อมูล", confirmLabel: "ปิดโดยไม่บันทึก", danger: true });
      } finally {
        confirming = false;
      }
      if (!ok) return;
    }
    doClose();
  }

  if (overlay) {
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && overlay.style.display === "flex") guardedClose();
    });
  }

  return { capture: tracker.capture, guardedClose, isDirty: tracker.isDirty };
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

// ── สถิติแดชบอร์ด: snapshot รายเดือนใน localStorage (ใช้ทั้งภาพรวมเนื้อหาเว็บไซต์
//    และสถิติคำสั่งผลิต) เพื่อคำนวณ % เทียบเดือนก่อน และเก็บ history จริงสำหรับ sparkline
//    (ไม่ใช่ตัวเลขสุ่ม — มาจากค่าที่บันทึกไว้จริงทุกเดือนที่เปิดแดชบอร์ด) ──
export function monthlySnapshotUpdate(storageKey, counts) {
  let snap;
  try { snap = JSON.parse(localStorage.getItem(storageKey) || "{}"); } catch (err) { snap = {}; }
  const monthKeyOf = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
  const now = new Date();
  const curKey = monthKeyOf(now);
  const prevKey = monthKeyOf(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  snap[curKey] = counts;
  try { localStorage.setItem(storageKey, JSON.stringify(snap)); } catch (err) { /* ignore quota/private mode errors */ }

  const prev = snap[prevKey];
  const monthKeys = Object.keys(snap).sort();
  const trends = {};
  const history = {};
  Object.keys(counts).forEach(k => {
    if (!prev || prev[k] == null) { trends[k] = null; }
    else {
      const cur = counts[k], old = prev[k];
      trends[k] = old === 0 ? (cur === 0 ? 0 : 100) : Math.round(((cur - old) / old) * 100);
    }
    history[k] = monthKeys.map(mk => snap[mk] ? snap[mk][k] : null).filter(v => typeof v === "number").slice(-6);
  });
  return { trends, history };
}

/** วาด sparkline (เส้นแนวโน้ม) จากค่าจริงใน history — ถ้ามีข้อมูลไม่ถึง 2 จุด จะซ่อนไว้เฉยๆ */
export function renderSparkline(svgEl, values) {
  if (!svgEl) return;
  const pts = (values || []).filter(v => typeof v === "number");
  if (pts.length < 2) { svgEl.classList.add("is-empty"); svgEl.innerHTML = ""; return; }
  svgEl.classList.remove("is-empty");
  const min = Math.min(...pts), max = Math.max(...pts);
  const flat = max === min;
  const span = flat ? 1 : (max - min);
  const stepX = 100 / (pts.length - 1);
  const coords = pts.map((v, i) => {
    const x = Math.round(i * stepX * 10) / 10;
    const y = flat ? 13 : Math.round((3 + (1 - (v - min) / span) * 20) * 10) / 10;
    return x + "," + y;
  });
  svgEl.innerHTML = `<polyline class="spark-line" points="${coords.join(" ")}"/>`;
}
