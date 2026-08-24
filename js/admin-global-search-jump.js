// ===========================
// js/admin-global-search-jump.js — jumpTo* ทั้งหมดของ Global Search (แยกจาก admin-global-search.js)
//
// 2026 refactor phase 2 — รอบที่ 28: แยกจาก js/admin-global-search.js เดิม (ฟังก์ชัน
// jumpToProduct/jumpToLead/jumpToCategory/jumpToBlogPost ท้ายไฟล์เดิม) แบบ
// ไม่เปลี่ยน behavior ใดๆ — export ทั้ง 4 ฟังก์ชันให้ admin-global-search.js เรียกใช้ตอน
// gsGoTo() (เมื่อผู้ใช้เลือกผลลัพธ์การค้นหาแล้วต้องกระโดดไปแท็บนั้นๆ พร้อมค้นหา/ไฮไลต์รายการ
// ให้เด่นที่สุด) — ทิศทาง import เดียว (ไฟล์นี้ไม่ import อะไรกลับจาก
// admin-global-search.js) จึงไม่มี circular import เพิ่มจากการแยกไฟล์รอบนี้
// ===========================
import { switchTab } from "./admin-page.js";
import { renderLeads, setLeadStatusFilter, lTableBody, lSearch, lFilterSource, lFilterAssignee, setLCurrentPage } from "./admin-leads.js";
import { renderProducts, pFilterCat, pSearch, pGrid, setPCurrentPage } from "./admin-products.js";
import { renderCategories, cSearch, cTableBody, setCCurrentPage } from "./admin-categories.js";
import { renderBlogs, bFilterStatus, bSearch, bGrid, setBCurrentPage } from "./admin-blog.js";

// กระโดดไปแท็บ "สินค้า" พร้อมค้นหาสินค้ารายการนี้ให้เด่นที่สุด แล้วเลื่อนจอ/ไฮไลต์การ์ดของสินค้านั้นชั่วครู่
export function jumpToProduct(product) {
  switchTab("products");
  pFilterCat.value = "";
  pSearch.value = product.code || product.name || "";
  setPCurrentPage(1);
  renderProducts();
  requestAnimationFrame(() => {
    const card = pGrid.querySelector(`.ad-card[data-id="${product.id}"]`);
    if (!card) return;
    card.scrollIntoView({ behavior: "smooth", block: "center" });
    card.classList.add("ad-search-highlight");
    setTimeout(() => card.classList.remove("ad-search-highlight"), 1800);
  });
}

// กระโดดไปแท็บ "ลีด" พร้อมล้างตัวกรองอื่น ๆ ทิ้ง แล้วค้นหาลีดรายการนี้ให้เด่นที่สุด
export function jumpToLead(lead) {
  switchTab("leads");
  setLeadStatusFilter("");
  if (lFilterSource) lFilterSource.value = "";
  if (lFilterAssignee) lFilterAssignee.value = "";
  lSearch.value = lead.name || lead.company || lead.email || lead.tel || lead.phone || "";
  setLCurrentPage(1);
  renderLeads();
  requestAnimationFrame(() => {
    const row = lTableBody.querySelector(`tr[data-id="${lead.id}"]`);
    if (!row) return;
    row.scrollIntoView({ behavior: "smooth", block: "center" });
    row.classList.add("ad-search-highlight");
    setTimeout(() => row.classList.remove("ad-search-highlight"), 1800);
  });
}

// กระโดดไปแท็บ "หมวดหมู่" พร้อมค้นหาหมวดหมู่นี้ให้เด่นที่สุด
export function jumpToCategory(cat) {
  switchTab("categories");
  cSearch.value = cat.name || "";
  setCCurrentPage(1);
  renderCategories();
  requestAnimationFrame(() => {
    const row = cTableBody.querySelector(`tr[data-id="${cat.id}"]`);
    if (!row) return;
    row.scrollIntoView({ behavior: "smooth", block: "center" });
    row.classList.add("ad-search-highlight");
    setTimeout(() => row.classList.remove("ad-search-highlight"), 1800);
  });
}

// กระโดดไปแท็บ "บทความ" พร้อมล้างตัวกรองสถานะแล้วค้นหาบทความนี้ให้เด่นที่สุด
export function jumpToBlogPost(post) {
  switchTab("blog");
  if (bFilterStatus) bFilterStatus.value = "";
  bSearch.value = post.title || "";
  setBCurrentPage(1);
  renderBlogs();
  requestAnimationFrame(() => {
    const card = bGrid.querySelector(`.ad-card[data-id="${post.id}"]`);
    if (!card) return;
    card.scrollIntoView({ behavior: "smooth", block: "center" });
    card.classList.add("ad-search-highlight");
    setTimeout(() => card.classList.remove("ad-search-highlight"), 1800);
  });
}

