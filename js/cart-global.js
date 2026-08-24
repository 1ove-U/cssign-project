// ===========================
// js/cart-global.js — เชื่อม js/cart.js (ES module, pure) เข้ากับ classic <script> เดิมที่ไม่ใช่
// module (เช่น js/products-detail-popup.js, js/main.js, js/cart-modal.js) — P3.0 Phase 1
// รอบย่อย 2-4
// ===========================
// js/cart.js เป็น ES module (`export function ...`) แต่ js/products-detail-popup.js เป็น
// classic script (ดูคอมเมนต์หัวไฟล์นั้น — ยังไม่แปลงเป็น module เพราะ test เดิมโหลดเป็น
// <script> ธรรมดาผ่าน dom.window.document.createElement('script') + textContent ซึ่งรัน
// import statement ตรงๆ ไม่ได้) ไฟล์นี้จึงทำหน้าที่เป็นสะพานแบบเดียวกับ js/currency-global.js
// ทุกประการ: import จาก cart.js (+ form-toast.js สำหรับ feedback ตอนหยิบใส่ตะกร้าสำเร็จ) แล้ว
// แปะฟังก์ชันที่ classic script ต้องใช้ไว้ที่ window.CSSignCart
//
// P3.0 Phase 1 รอบย่อย 4: เพิ่ม getCartItems (อ่านตรง ไม่ต้อง dispatch เพราะไม่ได้แก้ข้อมูล) +
// updateCartItemQty/removeFromCart (ตัวห่อ ต่างจาก addToCartAndNotify ตรงที่ไม่มี toast — modal
// ตะกร้า (js/cart-modal.js) เห็นผลการแก้ไขในหน้า modal อยู่แล้วแบบ real-time ไม่ต้องมี toast ซ้อน
// แจ้งอีกชั้น — แต่ยังคง dispatch 'cssign:cart-updated' เหมือนเดิมทุกครั้งหลังแก้ เพื่ออัปเดต
// badge ใน nav ทันที ตามที่ตัดสินใจไว้ใน continue-prompt-p3.0-phase1-round4.md ข้อ 2)
//
// ลำดับการรัน: type="module" script ถูก defer โดยอัตโนมัติเสมอ (รันหลัง parse เอกสารจบ) ส่วน
// classic script (เช่น products-detail-popup.js) รันทันทีตอน parse เจอ ดังนั้นตอนที่
// products-detail-popup.js รันครั้งแรก window.CSSignCart อาจยังไม่พร้อม — ไม่เป็นปัญหาเพราะจุดที่
// เรียกใช้ (กดปุ่ม "เพิ่มลงตะกร้า") เกิดจาก event ของผู้ใช้หลังหน้าโหลดเสร็จสมบูรณ์แล้วทั้งสิ้น
// ไม่มีจุดไหนเรียกตอน top-level execution — เผื่อไว้อีกชั้น ฝั่ง products-detail-popup.js เองก็ยัง
// เช็ค `if (!window.CSSignCart) return;` ก่อนเรียกใช้เสมอ (ดูคอมเมนต์ในไฟล์นั้น)
import { addToCart, getCartCount, getCartItems, updateCartItemQty, removeFromCart, clearCart } from './cart.js';
import { showToast } from './form-toast.js';

// หยิบสินค้าใส่ตะกร้า + โชว์ toast แจ้งผลสำเร็จให้ลูกค้าเห็นทันที (ใช้ showToast โทน 'success'
// เดียวกับที่ฟอร์มอื่นในเว็บใช้แจ้งผลสำเร็จ — ดู js/form-toast.js) รวมสองสเต็ปไว้ในฟังก์ชันเดียว
// เพราะทุกจุดที่จะเรียก addToCart จาก UI (การ์ดกริด/ป็อปอัพรายละเอียด) ต้องการ feedback แบบนี้
// เหมือนกันหมด ไม่มี usecase ที่อยากเพิ่มแบบเงียบๆ ไม่แจ้งเตือน
function addToCartAndNotify(item, qty) {
  addToCart(item, qty);
  var label = (item && item.name) ? item.name : 'สินค้า';
  showToast('เพิ่ม "' + label + '" ลงตะกร้าแล้ว', 'success', 3000);
  dispatchCartUpdated();
}

// P3.0 Phase 1 รอบย่อย 3: แจ้งไอคอนตะกร้า+badge ใน nav (js/main.js, classic script — อ่าน
// ผ่าน window.CSSignCart.getCartCount() ไม่ import ตรงๆ ได้เพราะเป็น classic script) ว่าจำนวน
// สินค้าในตะกร้าเปลี่ยนไปแล้ว โดยไม่ต้อง reload หน้า — dispatch เป็น custom event บน window
// แทนการให้ main.js poll เอง เพราะ module script (ไฟล์นี้) โหลด/รันหลัง main.js เสมอ (ES module
// defer โดยอัตโนมัติ main.js เป็น classic script รันทันทีตอน parse เจอ) การ dispatch event จึง
// รับประกันว่า listener ฝั่ง main.js (ที่ผูกไว้ตั้งแต่ตอนไฟล์นั้นรัน ก่อนไฟล์นี้จะรันเสร็จ) จะ
// ได้รับ event แน่นอน ไม่มีจังหวะพลาด
function dispatchCartUpdated() {
  // ใช้ window.CustomEvent (ไม่ใช่ CustomEvent เฉยๆ) — ต้องสร้าง event จาก realm เดียวกับ
  // window ที่จะ dispatch เสมอ ไม่งั้น jsdom (และเบราว์เซอร์บางตัวที่คุม realm เข้ม) จะ throw
  // "parameter 1 is not of type 'Event'" เพราะ global CustomEvent ของ Node (v19+) คนละ
  // constructor กับของ jsdom window แม้หน้าตาเหมือนกันทุกประการ
  window.dispatchEvent(new window.CustomEvent('cssign:cart-updated', { detail: { count: getCartCount() } }));
}

// แก้จำนวน/ลบรายการจาก modal ตะกร้า (js/cart-modal.js รอบย่อย 4) — ทั้งคู่ต้อง dispatch
// 'cssign:cart-updated' ใหม่ทุกครั้งหลังแก้ (เหมือน addToCartAndNotify ด้านบน) เพื่อให้ badge
// ใน nav อัปเดตทันทีโดยไม่ต้อง reload หน้า — ไม่มี toast เพราะ modal ที่เปิดอยู่แล้วเห็นผลลัพธ์
// ตรงหน้าอยู่แล้ว การเด้ง toast ซ้อนจะรกเกินจำเป็น
function updateCartItemQtyAndNotify(productId, variantLabel, qty) {
  var items = updateCartItemQty(productId, variantLabel, qty);
  dispatchCartUpdated();
  return items;
}

function removeFromCartAndNotify(productId, variantLabel) {
  var items = removeFromCart(productId, variantLabel);
  dispatchCartUpdated();
  return items;
}

// P3.0 Phase 2 รอบย่อย 2: ล้างตะกร้าทั้งหมดหลังส่งคำขอใบเสนอราคาสำเร็จ (js/quote-form.js เรียก
// window.CSSignCart.clearCart() เป็น classic-script bridge เหมือนฟังก์ชันอื่นทั้งหมดในไฟล์นี้ —
// clearCart() เดิมมีอยู่แล้วใน js/cart.js ตั้งแต่ Phase 1 แต่ยังไม่เคยถูกแปะเข้า bridge นี้เพราะ
// ยังไม่มีจุดเรียกใช้จริงจนกว่าจะถึง Phase 2) — ต้อง dispatch 'cssign:cart-updated' เหมือนจุดอื่น
// เพื่อให้ badge ใน nav กลับไปเป็น 0 ทันทีโดยไม่ต้อง reload หน้า
function clearCartAndNotify() {
  var items = clearCart();
  dispatchCartUpdated();
  return items;
}

window.CSSignCart = {
  addToCart: addToCart,
  addToCartAndNotify: addToCartAndNotify,
  getCartCount: getCartCount,
  getCartItems: getCartItems,
  updateCartItemQty: updateCartItemQtyAndNotify,
  removeFromCart: removeFromCartAndNotify,
  clearCart: clearCartAndNotify,
};

// แจ้ง nav ทันทีที่โมดูลนี้พร้อมใช้งาน (ไม่ใช่แค่ตอนกด "เพิ่มลงตะกร้า") — เผื่อลูกค้ามีของค้างอยู่
// ในตะกร้าจาก session ก่อนหน้าแล้ว (persist ผ่าน localStorage) badge ใน nav จะได้ขึ้นเลขที่ถูกต้อง
// ทันทีที่หน้าโหลดเสร็จ ไม่ต้องรอกด "เพิ่มลงตะกร้า" อีกครั้งก่อนถึงจะเห็นเลขที่ถูกต้อง
dispatchCartUpdated();
