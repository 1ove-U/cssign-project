/**
 * CS.SIGN — anti-spam.js
 * กันบอทยิงฟอร์ม leads ด้วย honeypot field + time-trap
 * ไม่ต้องพึ่ง service ภายนอก (reCAPTCHA/Turnstile) เลยไม่ต้องขอ API key,
 * ไม่ต้องรอ approve, ไม่มี script ภายนอกให้โหลดเพิ่ม — ใช้ได้ทันที
 *
 * หลักการ:
 * 1) Honeypot — แทรก input ที่คนมองไม่เห็น/โฟกัสไม่ได้ (ซ่อนด้วยการเลื่อนออก
 *    นอกจอ ไม่ใช้ display:none ตรงๆ เพราะบอทบางตัวเช็คแล้วข้าม) ชื่อ field
 *    ตั้งให้ดูน่ากรอกทั่วไป บอทที่ auto-fill ทุกช่องในฟอร์มจะกรอกค่าลงไป
 *    ส่วนคนจริงจะมองไม่เห็นเลยเว้นว่างไว้เสมอ
 * 2) Time-trap — จับเวลาตั้งแต่ form พร้อมใช้งาน ถ้า submit เร็วกว่าที่คนจริง
 *    จะกรอกฟอร์มทันได้ (ตั้งไว้ 1.5 วิ) ถือว่าเป็นบอท
 *
 * ข้อจำกัด: กัน mass-spam bot ทั่วไปที่ยิงฟอร์มอัตโนมัติได้ดี แต่ไม่ได้กันคนที่
 * ตั้งใจโจมตีเว็บนี้เจาะจง (อ่าน source แล้วเลี่ยง honeypot เอง หรือยิงตรงเข้า
 * Firestore API) — ถ้าต้องการกันระดับนั้นค่อยอัพเป็น App Check/Turnstile ทีหลัง
 */

const HP_FIELD_NAME = 'website'; // ชื่อดูปกติ ไม่บอกใบ้ว่าเป็น honeypot
const MIN_FILL_MS = 1500;

/**
 * เรียกครั้งเดียวตอนได้ form element มา (ก่อนหรือหลัง addEventListener ก็ได้)
 * แทรก honeypot input + บันทึกเวลาพร้อมใช้งานของฟอร์ม
 */
export function initAntiSpam(form) {
  if (!form || form.dataset.antiSpamReady) return;

  const wrap = document.createElement('div');
  wrap.setAttribute('aria-hidden', 'true');
  wrap.style.cssText =
    'position:absolute;left:-9999px;top:-9999px;width:1px;height:1px;overflow:hidden;';

  const input = document.createElement('input');
  input.type = 'text';
  input.name = HP_FIELD_NAME;
  input.autocomplete = 'off';
  input.tabIndex = -1;
  wrap.appendChild(input);
  form.appendChild(wrap);

  form.dataset.antiSpamReady = '1';
  form.dataset.antiSpamLoadedAt = String(Date.now());
}

/**
 * เช็คตอน submit ก่อนยิง saveLead — คืน true ถ้าเข้าข่ายบอท
 * เมื่อ true ควร "เงียบ" (โชว์ success ปลอมๆ ให้บอทเห็นแต่ไม่บันทึกจริง)
 * อย่าบอกบอทตรงๆ ว่าโดนจับ ไม่งั้นมันจะปรับตัวหนี
 */
export function isSpamSubmission(form) {
  if (!form) return false;

  const hp = form.querySelector(`[name="${HP_FIELD_NAME}"]`);
  if (hp && hp.value.trim() !== '') return true;

  const loadedAt = parseInt(form.dataset.antiSpamLoadedAt || '0', 10);
  if (!loadedAt || Date.now() - loadedAt < MIN_FILL_MS) return true;

  return false;
}
