/**
 * CS.SIGN — form-validate.js
 * ตรวจสอบรูปแบบข้อมูลที่กรอกจริง (อีเมล / เบอร์โทร) ก่อนส่งฟอร์ม เพื่อกันข้อมูลมั่วเข้า
 * ระบบ lead ทุกจุด — ใช้ร่วมกันได้ทุกฟอร์มในเว็บ (contact form, inline contact,
 * catalog download, qmodal ขอใบเสนอราคา)
 *
 * ใช้คู่กับ CSS .cs-field-err / .has-error ใน css/style.css
 */

// อีเมลรูปแบบมาตรฐานทั่วไป (ไม่ได้เข้มงวดระดับ RFC เต็ม แต่พอกันการกรอกมั่ว)
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// เบอร์โทรไทย: มือถือ/บ้าน 9-10 หลัก ขึ้นต้น 0 อนุญาตขีด/วรรคคั่นได้ (เช่น 08x-xxx-xxxx, 02-115-0850)
const PHONE_RE = /^0[0-9](?:[\s-]?[0-9]){7,8}$/;

export function isValidEmail(value) {
  return EMAIL_RE.test(String(value || '').trim());
}

export function isValidThaiPhone(value) {
  const v = String(value || '').trim();
  const digits = v.replace(/[\s-]/g, '');
  return PHONE_RE.test(v) && digits.length >= 9 && digits.length <= 10;
}

// ข้อความ error เริ่มต้น (ไทย) — คงพฤติกรรมเดิมของทุกฟอร์มที่เรียกใช้แบบไม่ส่ง messages มา
const DEFAULT_MESSAGES = {
  required: 'กรุณากรอกข้อมูลในช่องนี้',
  email:    'รูปแบบอีเมลไม่ถูกต้อง เช่น name@example.com',
  tel:      'กรุณากรอกเบอร์โทรศัพท์ให้ถูกต้อง เช่น 08x-xxx-xxxx'
};

/** สร้าง/แสดงข้อความ error เล็กๆ ใต้ input พร้อมไฮไลต์กรอบสีแดง */
export function showFieldError(input, message) {
  if (!input) return;
  input.classList.add('has-error');
  input.setAttribute('aria-invalid', 'true');
  let err = input.parentElement && input.parentElement.querySelector(':scope > .cs-field-err');
  if (!err) {
    err = document.createElement('small');
    err.className = 'cs-field-err';
    // select ที่ห่อด้วย wrap (cf-select-wrap / qmodal-select-wrap / cif-select-wrap) ต้องแทรกหลัง wrap ไม่ใช่หลัง select
    var host = input.closest('.cf-select-wrap, .qmodal-select-wrap, .cif-select-wrap') || input;
    host.insertAdjacentElement('afterend', err);
  }
  err.textContent = message;
  err.style.display = 'block';
}

/** ล้างข้อความ error + ไฮไลต์ */
export function clearFieldError(input) {
  if (!input) return;
  input.classList.remove('has-error');
  input.removeAttribute('aria-invalid');
  var host = input.closest('.cf-select-wrap, .qmodal-select-wrap, .cif-select-wrap') || input;
  var err = host.parentElement && host.parentElement.querySelector(':scope > .cs-field-err');
  if (err) err.remove();
}

/**
 * ตรวจ input เดี่ยวๆ ตามชนิด — คืน true ถ้าผ่าน
 * type: 'required' | 'email' | 'tel'
 * ฟิลด์ที่ไม่ required และเว้นว่างไว้ ให้ผ่าน (เช่น อีเมลใน qmodal ที่ไม่บังคับ)
 */
export function validateField(input, type, messages) {
  if (!input) return true;
  messages = Object.assign({}, DEFAULT_MESSAGES, messages || {});
  var value = (input.value || '').trim();
  var isRequired = input.hasAttribute('required');

  if (!value) {
    if (isRequired) {
      showFieldError(input, messages.required);
      return false;
    }
    clearFieldError(input);
    return true;
  }
  if (type === 'email' && !isValidEmail(value)) {
    showFieldError(input, messages.email);
    return false;
  }
  if (type === 'tel' && !isValidThaiPhone(value)) {
    showFieldError(input, messages.tel);
    return false;
  }
  clearFieldError(input);
  return true;
}

function fieldType(input) {
  if (input.type === 'email') return 'email';
  if (input.type === 'tel') return 'tel';
  return 'required';
}

/**
 * ผูก validation แบบ real-time ให้ทุกฟอร์ม — เช็คตอนออกจากช่อง (blur)
 * และล้าง error ทันทีที่เริ่มพิมพ์ใหม่ ไม่ต้องรอ submit ถึงจะรู้ว่ากรอกผิด
 */
export function wireLiveValidation(form, messages) {
  if (!form) return;
  form.querySelectorAll('input[type="email"], input[type="tel"], input[required], textarea[required], select[required]').forEach(function (input) {
    var type = fieldType(input);
    var evt = input.tagName === 'SELECT' ? 'change' : 'blur';
    input.addEventListener(evt, function () { validateField(input, type, messages); });
    input.addEventListener('input', function () {
      if (input.classList.contains('has-error')) validateField(input, type, messages);
    });
  });
}

/**
 * ตรวจทุกช่องในฟอร์มตอนกด submit — คืน true ถ้าผ่านหมด
 * ถ้ามีช่องผิด จะ focus ช่องแรกที่ผิดให้อัตโนมัติ
 */
export function validateFormFields(form, messages) {
  if (!form) return true;
  var ok = true;
  var firstInvalid = null;
  form.querySelectorAll('input[type="email"], input[type="tel"], input[required], textarea[required], select[required]').forEach(function (input) {
    var passed = validateField(input, fieldType(input), messages);
    if (!passed) {
      ok = false;
      if (!firstInvalid) firstInvalid = input;
    }
  });
  if (firstInvalid) firstInvalid.focus();
  return ok;
}
