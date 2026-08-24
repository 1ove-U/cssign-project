// ===========================================================
// js/admin-state.js — Shared state ที่ใช้ข้ามหลายแท็บของหน้าแอดมิน
// (ชุดข้อมูลที่โหลดจาก Firestore, pending-delete sets, แท็บที่กำลังเปิดอยู่)
//
// แยกออกมาจาก js/admin-page.js เดิม (2026 refactor phase 2) เพื่อให้ทุกโมดูลย่อย
// ของแต่ละแท็บ import ตัวแปรชุดเดียวกันจากที่นี่ แทนที่จะประกาศซ้ำ/อ้างอิงไขว้กันเอง
// ไม่มีการเปลี่ยน logic ใดๆ — ย้ายตัวแปรมาเฉยๆ ค่าเริ่มต้น/พฤติกรรมเหมือนเดิมทุกประการ
//
// หมายเหตุสำคัญ: allProducts/allCategories/ฯลฯ เป็น `let` ที่ export ออกไป — โมดูลอื่น
// import มาอ่านค่าได้โดยตรง (ES module live binding อัปเดตให้อัตโนมัติ) แต่ "เขียนทับ"
// ค่าได้เฉพาะผ่านฟังก์ชัน set*() ด้านล่างเท่านั้น เพราะ JS ไม่อนุญาตให้โมดูลอื่น
// reassign ตัวแปรที่ไม่ได้ประกาศเอง (ใช้ตอน reloadAll() ใน admin-page.js โหลดข้อมูลใหม่)
// ===========================================================

// DOM ref ที่ใช้ทั้งใน admin-page.js เอง และใน admin-keyboard-shortcuts.js
// (เช็ค app.style.display === "none" ว่ายังไม่ได้ล็อกอิน)
export const app = document.getElementById("ad-app");

// ── ชุดข้อมูลหลักที่โหลดจาก Firestore ผ่าน reloadAll() ──────────────────────
export let allProducts = [];
export let allCategories = [];
export let allGroups = [];
export let allPortfolios = [];
export let allBlogs = [];
export let allFaqs = [];

export function setAllProducts(v) { allProducts = v; }
export function setAllCategories(v) { allCategories = v; }
export function setAllGroups(v) { allGroups = v; }
export function setAllPortfolios(v) { allPortfolios = v; }
export function setAllBlogs(v) { allBlogs = v; }
export function setAllFaqs(v) { allFaqs = v; }

// รายการ id ที่กำลังรอ "เลิกทำ" อยู่ในช่วง undo หลังลบ (ดู deleteWithUndo ใน admin-utils.js)
export const pendingDeleteProductIds = new Set();
export const pendingDeletePortfolioIds = new Set();
export const pendingDeleteBlogIds = new Set();
export const pendingDeleteLeadIds = new Set();
export const pendingDeleteCategoryIds = new Set();
export const pendingDeleteGroupIds = new Set();
export const pendingDeleteFaqIds = new Set();
export const pendingDeleteStaffUids = new Set();

// ── แท็บที่กำลังเปิดอยู่ — เขียนทับได้เฉพาะผ่าน setActiveTab() (เรียกจาก switchTab()
// ใน admin-page.js เท่านั้น) โมดูลอื่น (เช่น admin-keyboard-shortcuts.js) import
// มาอ่านอย่างเดียว ──
export let activeTab = "overview";
export function setActiveTab(v) { activeTab = v; }
