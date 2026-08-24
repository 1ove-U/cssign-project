// ===========================
// js/product-detail-currency.js — currency switcher helpers สำหรับ
// en/product-detail.html (P2.10-currency-c)
// ===========================
// en/product-detail.html ใช้ inline <script type="module"> อยู่แล้ว (import
// getProductBySlug/getCategories ตรงๆ จาก db-products.js/db-taxonomy.js) จึง import จาก
// js/currency.js ได้โดยตรง ไม่ต้องผ่าน bridge แบบ js/currency-global.js ที่ทำไว้ให้
// js/products-detail-popup-en.js (classic script) ในรอบก่อน (P2.10-currency-b)
//
// เหตุผลที่แยกฟังก์ชันเหล่านี้ออกมาเป็นไฟล์ต่างหาก แทนที่จะเขียนอินไลน์ในสคริปต์ของ
// en/product-detail.html ตรงๆ: inline <script type="module"> ที่ฝังอยู่ใน HTML เทสยากด้วย
// jsdom (runScripts: "dangerously" อ่าน textContent ของ <script> ที่ inject เข้าไปแบบ
// dynamic ไม่รัน import statement เป็น real ES module ให้ — ปัญหาเดียวกับที่เจอตอนทำ
// js/currency-global.js) การแยก logic ที่ทดสอบได้ออกมาเป็นไฟล์ .js ต่างหากทำให้ import จริง
// เข้าเทสได้ตรงๆ ด้วย node:test (แพทเทิร์นเดียวกับที่ทำไว้รอบที่ 81 — ย้าย inline script ใน
// about.html/portfolio.html ออกมาเป็น js/about-tilt-effects.js ฯลฯ)
//
// getStoredCurrency()/setStoredCurrency() รับ storage เป็นพารามิเตอร์ optional (fallback
// เป็น window.localStorage) เพื่อให้เทสส่ง storage stub เข้ามาตรงๆ ได้โดยไม่ต้องพึ่ง jsdom —
// ทั้งคู่ wrap ด้วย try/catch กัน private mode/localStorage ไม่พร้อมใช้งาน เหมือนแพทเทิร์นที่ใช้
// ทั่วโปรเจกต์ (เช่น js/admin-onboarding.js, js/products-detail-popup-en.js)
import { isSupportedCurrency, formatCurrencyAmount } from './currency.js';

export var PDP_CURRENCY_STORAGE_KEY = 'cssignCurrency'; // key เดียวกับที่ js/products-detail-popup-en.js ใช้ — ให้ preference sync ข้ามหน้า (product-detail.html <-> products.html popup)

export function getStoredCurrency(storage) {
  try {
    var s = storage || (typeof window !== 'undefined' ? window.localStorage : null);
    var stored = s && s.getItem(PDP_CURRENCY_STORAGE_KEY);
    if (stored && isSupportedCurrency(stored)) return stored;
  } catch (e) { /* private mode / localStorage ไม่พร้อมใช้งาน — fallback THB */ }
  return 'THB';
}

export function setStoredCurrency(code, storage) {
  try {
    var s = storage || (typeof window !== 'undefined' ? window.localStorage : null);
    if (s) s.setItem(PDP_CURRENCY_STORAGE_KEY, code);
  } catch (e) { /* ไม่ critical — แค่จำ preference ข้าม session ไม่ได้ */ }
}

// แปลง+จัดรูปแบบราคา THB → currency ที่เลือกอยู่ fallback เป็นรูปแบบเดิมทุกประการ
// (สัญลักษณ์ ฿ + toLocaleString('en-US')) ถ้า currency เป็น THB เอง หรือแปลงไม่ได้
// (เช่น currency ที่ส่งมาไม่ใช่ค่าที่รองรับ) — ไม่ต้องเช็ค "bridge พร้อมหรือยัง" แบบ
// pdFormatPrice() ใน js/products-detail-popup-en.js เพราะไฟล์นี้ import จาก currency.js
// ตรงๆ ไม่ได้ผ่าน window.CSSignCurrency ที่อาจยังโหลดไม่เสร็จ
export function formatPdpAmount(amountThb, currency) {
  if (currency && currency !== 'THB') {
    var formatted = formatCurrencyAmount(amountThb, currency);
    if (formatted) return formatted;
  }
  return '฿' + Number(amountThb).toLocaleString('en-US');
}
