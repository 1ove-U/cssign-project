// ===========================
// js/currency.js — แปลง/จัดรูปแบบราคาข้ามสกุลเงิน (pure functions) — P2.10-currency-a
// ===========================
// สำรวจขอบเขตก่อนเขียน (ดู cssign-roadmap-prompt.md หัวข้อ P2.10 รอบที่ 27): ราคาสินค้าทั้งหมด
// ในระบบ (js/db-products.js field `price`, ตัวเลือก/variant ใน admin-products-variant-table.js,
// รายการที่ query จาก Firestore) เก็บเป็น "ตัวเลข THB ตัวเดียว" ล้วนๆ ไม่มี field currency ทั้งฝั่ง
// schema/Firestore/UI เลยสักจุดเดียว — จุดที่ format ราคาออกจอมี 3 จุดหลัก: formatPrice() ใน
// js/products-cards.js (การ์ดสินค้า, TH เท่านั้นตอนนี้), js/products-detail-popup.js (popup
// รายละเอียด TH, ใช้ toLocaleString('th-TH')), js/products-detail-popup-en.js (popup รายละเอียด
// EN — ปัจจุบันโชว์สัญลักษณ์ ฿ + toLocaleString('en-US') คือ "บาทแต่จัดรูปแบบเลขแบบอังกฤษ" ไม่ใช่
// แปลงสกุลเงินจริง)
//
// ตัดสินใจ (หลังสำรวจ): ทำแบบ "client-side conversion ด้วย exchange rate คงที่ที่ปรับได้เป็นระยะ"
// ไม่ใช่เก็บราคาแยกต่อ currency ใน Firestore เพราะ (1) ธุรกิจตั้งราคาเป็น THB จริงอยู่แล้วเป็นฐาน
// (2) ราคาป้าย/งานสั่งทำเป็นราคา "เริ่มต้น"/estimate อยู่แล้วในหลายจุด ไม่ใช่ fixed-price ที่ต้อง
// ล็อกเป๊ะข้าม currency (3) เก็บ THB single-source-of-truth เดิมไว้ ไม่ต้องแตะ Firestore
// schema/rules/admin form เลย (ตรงกฎ "additive only" — รอบนี้ไม่แตะ schema เลยด้วยซ้ำ)
//
// ไฟล์นี้เป็น "data layer" ล้วนๆ — pure function รับ/คืนตัวเลข ไม่แตะ DOM ไม่มี state ข้าม call
// ยังไม่ได้ wire เข้า UI จุดไหนเลยในรอบนี้ (formatPrice ใน products-cards.js และราคาใน
// products-detail-popup.js/-en.js ยังเป็นโค้ดเดิมทุกตัวอักษร) — ซับข้อถัดไป (P2.10-currency-b)
// ค่อยเพิ่ม currency switcher UI (เช่นที่ nav-menu.js หรือหน้า EN products.html/product-detail.html)
// แล้วเรียกใช้ฟังก์ชันจากไฟล์นี้แทนที่ toLocaleString('th-TH')/'en-US' ตรงๆ ที่ 3 จุดข้างต้น

// อัตราแลกเปลี่ยนคงที่ (THB ต่อ 1 หน่วยสกุลเงินปลายทาง) — ต้องอัปเดตเป็นระยะโดยธุรกิจ/รอบถัดไป
// ที่มา: อัตรากลางโดยประมาณ ณ ช่วงเขียนโค้ดนี้ (ไม่ใช่ real-time rate, ห้ามใช้เพื่อธุรกรรมจริง)
export var EXCHANGE_RATES_THB = Object.freeze({
  THB: 1,
  USD: 36,
  EUR: 39,
  CNY: 5,
});

export var CURRENCY_SYMBOLS = Object.freeze({
  THB: '฿',
  USD: '$',
  EUR: '€',
  CNY: '¥',
});

// locale สำหรับ toLocaleString() ต่อสกุลเงิน (แยกจาก locale ของภาษาเว็บไซต์ TH/EN — ตัวเลข USD
// ควรจัดรูปแบบแบบอังกฤษเสมอไม่ว่าเว็บจะภาษาไหน)
var CURRENCY_LOCALES = Object.freeze({
  THB: 'th-TH',
  USD: 'en-US',
  EUR: 'en-US',
  CNY: 'en-US',
});

export function getSupportedCurrencies() {
  return Object.keys(EXCHANGE_RATES_THB);
}

export function isSupportedCurrency(code) {
  return typeof code === 'string' && Object.prototype.hasOwnProperty.call(EXCHANGE_RATES_THB, code);
}

// แปลงจำนวนเงิน THB → สกุลเงินปลายทาง (ปัดเศษเป็นจำนวนเต็ม — ราคาป้าย/งานสั่งทำเดิมก็แสดงแบบ
// จำนวนเต็มบาทอยู่แล้วทุกจุด ไม่มีทศนิยม) คืน null ถ้า input ไม่ใช่ตัวเลขบวก หรือ currency ไม่รองรับ
export function convertFromTHB(amountThb, currencyCode) {
  var num = Number(amountThb);
  if (!amountThb || isNaN(num) || num <= 0) return null;
  if (!isSupportedCurrency(currencyCode)) return null;
  var rate = EXCHANGE_RATES_THB[currencyCode];
  return Math.round(num / rate);
}

// จัดรูปแบบเต็ม: สัญลักษณ์ + ตัวเลขคั่นหลักพันตาม locale ของสกุลเงินนั้น คืน null ตามเงื่อนไข
// เดียวกับ convertFromTHB() (ให้ผู้เรียกตัดสินใจ fallback ข้อความเอง เหมือน formatPrice() เดิม
// ที่คืน 'สอบถามราคา' ตอน price ไม่ถูกต้อง — ไฟล์นี้ไม่ผูกข้อความ fallback ภาษาใดภาษาหนึ่งไว้)
export function formatCurrencyAmount(amountThb, currencyCode) {
  var converted = convertFromTHB(amountThb, currencyCode);
  if (converted == null) return null;
  var symbol = CURRENCY_SYMBOLS[currencyCode];
  var locale = CURRENCY_LOCALES[currencyCode];
  return symbol + converted.toLocaleString(locale);
}
