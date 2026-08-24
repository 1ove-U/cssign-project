/**
 * CS.SIGN — img-error-fallback.js
 * ย้ายมาจาก inline `onerror="this.remove()"` ที่เคยอยู่บน <img class="real-photo">
 * ในหลายหน้า (about.html/en/about.html/index.html/en/index.html — รอบที่ 82) เพื่อเตรียม
 * เอา 'unsafe-inline' ออกจาก script-src ของ CSP
 *
 * ถ้ารูปจริงโหลดไม่สำเร็จ ให้เอา <img> นั้นออก เพื่อให้เห็น placeholder icon
 * (.img-ph-inner) ที่อยู่ข้างหลังแทนที่จะเห็นไอคอนรูปหักของเบราว์เซอร์
 *
 * ใช้ event delegation แบบ capture ที่ document แทนการผูก onerror ทีละรูป เพราะ
 * 'error' event ของ <img> ไม่ bubble ขึ้นมาตามปกติ ต้องดักที่ capture phase เท่านั้น
 * ไม่มีการเปลี่ยน logic ใดๆ จากของเดิม (this.remove() ตัวเดียวกัน แค่ย้ายที่อยู่)
 */
document.addEventListener('error', function (e) {
  var t = e.target;
  if (t && t.tagName === 'IMG' && t.classList && t.classList.contains('real-photo')) {
    t.remove();
  }
}, true);
