/**
 * CS.SIGN — form-toast.js
 * แจ้งเตือนแบบ toast โทนเดียวกับดีไซน์เว็บ ใช้แทน alert() เดิมทุกจุดในฟอร์ม
 * (คนกรอกฟอร์มไม่ต้องเจอ popup ของเบราว์เซอร์ที่ดูไม่น่าเชื่อถือและบล็อกหน้าจออีกต่อไป)
 * ใช้ร่วมกันได้ทุกฟอร์มในเว็บ — โหลด CSS คู่กันจาก css/style.css (.cs-toast*)
 */

const ICONS = {
  error:   '<circle cx="12" cy="12" r="10"/><line x1="12" y1="7.5" x2="12" y2="13"/><circle cx="12" cy="16.3" r="0.6" fill="currentColor" stroke="none"/>',
  success: '<circle cx="12" cy="12" r="10"/><path d="M7.5 12.5l2.8 2.8L16.5 9"/>',
  warn:    '<path d="M12 8.5v4.6M12 17h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>'
};

let host = null;
function ensureHost() {
  if (host && document.body.contains(host)) return host;
  host = document.createElement('div');
  host.className = 'cs-toast-host';
  host.setAttribute('aria-live', 'polite');
  document.body.appendChild(host);
  return host;
}

/**
 * แสดง toast แจ้งเตือน
 * @param {string} message ข้อความที่จะแสดง
 * @param {'error'|'success'|'warn'} [type='error']
 * @param {number} [duration=6000] ms ก่อนหายเอง ใส่ 0 เพื่อไม่ให้หายเอง
 * @returns {Function} เรียกเพื่อปิด toast นี้ทันที
 */
export function showToast(message, type = 'error', duration = 6000) {
  const h = ensureHost();
  const el = document.createElement('div');
  el.className = 'cs-toast cs-toast--' + type;
  el.setAttribute('role', type === 'error' ? 'alert' : 'status');
  el.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" width="20" height="20">' + (ICONS[type] || ICONS.error) + '</svg>' +
    '<span class="cs-toast-msg"></span>' +
    '<button type="button" class="cs-toast-close" aria-label="ปิดข้อความแจ้งเตือน">&times;</button>';
  el.querySelector('.cs-toast-msg').textContent = message;
  h.appendChild(el);
  requestAnimationFrame(() => el.classList.add('is-visible'));

  let timer = null;
  function remove() {
    if (timer) clearTimeout(timer);
    el.classList.remove('is-visible');
    setTimeout(() => el.remove(), 300);
  }
  el.querySelector('.cs-toast-close').addEventListener('click', remove);
  if (duration > 0) timer = setTimeout(remove, duration);
  return remove;
}
