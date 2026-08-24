// ===========================
// js/ui-form-validation.js — inline form validation + unsaved-changes guard
// แยกออกมาจาก js/ui-helpers.js (2026 refactor): กลุ่มนี้เกี่ยวกับการตรวจฟอร์ม/ติดตาม
// การแก้ไขข้อมูลในฟอร์ม (validation + dirty tracking) แยกจากกลุ่ม dialog/state
// (confirmDialog/errorStateHTML/emptyStateHTML/showUndoToast) ที่ยังอยู่ใน ui-helpers.js เดิม
// - showFieldError()/clearFieldError(): ขึ้น/เอาข้อความแดงใต้ช่องที่กรอกผิด
// - attachInlineValidation()/validateFormInline(): ผูก/เช็ค validation ทั้งฟอร์ม
// - createDirtyTracker()/isAnyFormDirty()/attachUnsavedGuard(): ติดตามว่าฟอร์มถูกแก้ไขไปจาก
//   ตอนเปิดหรือยัง เพื่อเตือนก่อนปิด modal/ออกจากหน้าโดยไม่บันทึก
//
// attachUnsavedGuard() เรียก confirmDialog() (อยู่ใน ui-helpers.js) ตอนจะถามยืนยันปิดฟอร์มที่
// ยังไม่ได้บันทึก จึง import กลับจากที่นั่น — เป็นทิศทางเดียว (ui-helpers.js ไม่ได้ import ไฟล์นี้)
// ===========================

import { confirmDialog } from "./ui-helpers.js";

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
    // รอบที่ 90 — เดิม handler นี้เรียก check() ซึ่งเรียก field.checkValidity() ซ้ำข้างใน — แต่ตาม
    // spec การเรียก checkValidity() ตอนที่ field invalid อยู่แล้วจะยิง "invalid" event ใหม่ทุกครั้ง
    // เสมอ (ไม่มี native reentrancy guard) ทำให้ event "invalid" ยิงตัวเองซ้ำไม่จบ (วนเรียก
    // checkValidity() -> ยิง invalid -> handler นี้ทำงาน -> checkValidity() อีก -> ...) จนสแต็กล้น —
    // เกิดขึ้นจริงทุกครั้งที่ validateFormInline() (เรียก checkValidity() ตรงๆ ตอน submit) เจอ field
    // required ที่ว่าง เพราะ handler ตัวนี้ผูกอยู่กับทุก field required อยู่แล้วจาก
    // attachInlineValidation() — ยืนยันจาก stack trace ที่เจอตอนเขียนเทส Phase 1 (รอบ 89) —
    // แก้โดยไม่เรียก checkValidity() ซ้ำใน handler นี้เลย (รู้อยู่แล้วว่า field invalid เพราะ event
    // "invalid" นี้เองที่บอก ไม่ต้องเช็คซ้ำ) แค่ preventDefault() กัน browser popup เดิม +
    // โชว์ inline error ตรงๆ ด้วย logic ข้อความเดียวกับ check() ทุกประการ (ผลลัพธ์ที่ผู้ใช้เห็นเหมือน
    // เดิมทุกอย่าง ต่างกันแค่ไม่มี recursion ข้างใน)
    field.addEventListener("invalid", (e) => {
      e.preventDefault();
      const custom = messages && messages[field.id];
      showFieldError(field, custom || "กรุณากรอกข้อมูลในช่องนี้");
    });
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
 * @param {{form:HTMLFormElement, doClose:Function, getExtra?:Function, message?:string, overlay?:HTMLElement}} opts
 *   หมายเหตุ: `overlay` (ถ้ามีส่งมา) ไม่ได้ถูกอ่านใช้งานภายในฟังก์ชันนี้เลย — เหตุผลดูคอมเมนต์
 *   ก่อนบรรทัด `return` ท้ายฟังก์ชัน (backdrop-click ของ overlay ถูกผูกแยกไว้ที่ฝั่งผู้เรียกเองแล้ว)
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
    form, doClose, getExtra,
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

  // หมายเหตุ (2026 refactor accessibility phase, รอบที่ 58): เดิมไฟล์นี้ผูก
  // document.addEventListener("keydown", ...) เช็ค Escape เองตรงนี้ — ลบออกแล้ว เพราะกลไก
  // Escape ใหม่แบบรวมศูนย์ใน admin-utils.js/orders-tab-modal.js (ยิง synthetic click ใส่ตัว
  // overlay เอง) จะไปโดน backdrop-click listener เดิมที่ทุก modal ผูกไว้อยู่แล้ว ซึ่งเรียก
  // guardedClose() ตรงนี้อยู่แล้วเป๊ะ (ดู 4 จุดที่ส่ง overlay: เข้ามาใน opts) — คงไว้ทั้ง 2 ที่จะ
  // ทำให้ Escape ยิง guardedClose() ซ้อนกัน 2 ครั้งพร้อมกัน เสี่ยง confirmDialog() เด้งซ้อน/
  // openOverlayCount หลุด

  return { capture: tracker.capture, guardedClose, isDirty: tracker.isDirty };
}
