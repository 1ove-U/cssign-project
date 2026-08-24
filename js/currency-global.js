// ===========================
// js/currency-global.js — เชื่อม js/currency.js (ES module, pure functions) เข้ากับ
// classic <script> เดิมที่ไม่ใช่ module (เช่น js/products-detail-popup-en.js) — P2.10-currency-b
// ===========================
// js/currency.js เป็น ES module (`export function ...`) แต่ js/products-detail-popup-en.js
// เป็น classic script (ดูคอมเมนต์หัวไฟล์นั้น — ยังไม่แปลงเป็น module เพราะ test เดิมโหลดเป็น
// <script> ธรรมดาผ่าน dom.window.document.createElement('script') + textContent ซึ่งรัน
// import statement ตรงๆ ไม่ได้) ไฟล์นี้จึงทำหน้าที่เป็นสะพาน: import จาก currency.js แล้วแปะ
// ฟังก์ชันที่ classic script ต้องใช้ไว้ที่ window.CSSignCurrency
//
// ลำดับการรัน: type="module" script ถูก defer โดยอัตโนมัติเสมอ (รันหลัง parse เอกสารจบ)
// ส่วน classic script (เช่น products-detail-popup-en.js) รันทันทีตอน parse เจอ ดังนั้นตอนที่
// products-detail-popup-en.js รันครั้งแรก window.CSSignCurrency อาจยังไม่พร้อม — แต่ไม่เป็นปัญหา
// เพราะจุดที่เรียกใช้ฟังก์ชันเหล่านี้ (เปิดป็อปอัพ/เปลี่ยนตัวเลือก/เปลี่ยนสกุลเงิน) ล้วนเกิดจาก
// event ของผู้ใช้หลังหน้าโหลดเสร็จสมบูรณ์แล้วทั้งสิ้น ไม่มีจุดไหนเรียกตอน top-level execution
import {
  getSupportedCurrencies,
  isSupportedCurrency,
  convertFromTHB,
  formatCurrencyAmount,
  CURRENCY_SYMBOLS,
} from './currency.js';

window.CSSignCurrency = {
  getSupportedCurrencies: getSupportedCurrencies,
  isSupportedCurrency: isSupportedCurrency,
  convertFromTHB: convertFromTHB,
  formatCurrencyAmount: formatCurrencyAmount,
  CURRENCY_SYMBOLS: CURRENCY_SYMBOLS,
};
