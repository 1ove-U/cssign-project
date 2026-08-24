// ===========================
// js/admin-global-search.js — Global search overlay (ดัชนีค้นหา/render/keyboard nav)
//
// 2026 refactor phase 2: ย้ายมาจาก js/admin-page.js เดิม (ส่วน "GLOBAL SEARCH" บรรทัด
// 4456-4750 เดิม) แบบไม่เปลี่ยน behavior ใดๆ — ไม่มีอะไร export ให้ไฟล์อื่นเรียกใช้ เพราะปุ่ม/
// คีย์ลัด "/" ผูก listener เองตอนโหลดไฟล์ (เหมือน admin-products-csv.js) — ต้อง import แบบ
// side-effect `import "./admin-global-search.js";` ไว้ใน admin-page.js/admin.html ถึงจะโหลด
//
// รอบที่ 28: แยกกลุ่ม jumpToProduct/jumpToLead/jumpToCategory/jumpToBlogPost
// ออกไป js/admin-global-search-jump.js (ไฟล์นี้เหลือแค่ดัชนีค้นหา/gsSearch/gsRender/gsHighlight/
// overlay open-close/keyboard navigation — เรียก 4 ฟังก์ชันที่แยกไปผ่าน gsGoTo() แทน) —
// ทิศทาง import เดียว (ไฟล์ใหม่ไม่ import อะไรกลับมาจากไฟล์นี้เลย)
//
// ข้อแตกต่างจากต้นฉบับที่ตั้งใจแก้ (นอกเหนือจากจุดตัดไฟล์): pCurrentPage/lCurrentPage/
// cCurrentPage/bCurrentPage เป็น `let` ที่ import มาจากไฟล์อื่น — ES module
// import binding เป็น read-only ในไฟล์ที่ import มาใช้ reassign ตรงๆ แบบเดิม (`pCurrentPage = 1;`)
// ไม่ได้ (จะ throw ตอนรัน) จึงเปลี่ยนไปเรียกฟังก์ชัน setter ที่เพิ่ม export ไว้ในไฟล์ต้นทางแทน
// (setPCurrentPage/setLCurrentPage/setCCurrentPage/setBCurrentPage) — ตัวแปร/
// ฟังก์ชันอื่นๆ ที่เหลือทั้งหมดของไฟล์นี้ตรงกับต้นฉบับ 100%
// ===========================
import { switchTab } from "./admin-page.js";
import {
  allProducts, pendingDeleteProductIds,
  allCategories, pendingDeleteCategoryIds,
  allBlogs, pendingDeleteBlogIds,
  pendingDeleteLeadIds
} from "./admin-state.js";
import { allLeads } from "./admin-leads.js";
import { getAllOrders, jumpToOrder } from "./orders-tab.js";
import { catName, escapeHtml, openOverlay, closeOverlay } from "./admin-utils.js";
import { jumpToProduct, jumpToLead, jumpToCategory, jumpToBlogPost } from "./admin-global-search-jump.js";

// ===========================================================
// GLOBAL SEARCH — ค้นข้ามสินค้า/ลีด/คำสั่งผลิตในกล่องเดียว พร้อมลิงก์กระโดดไปแท็บที่เจอ
// เปิดได้จากปุ่ม "ค้นหา" บน topbar หรือคีย์ลัด "/" (โฟกัสอยู่นอกช่องพิมพ์อื่น — ดู KEYBOARD SHORTCUTS ด้านล่าง)
// ===========================================================
const gsOverlay  = document.getElementById("ad-gs-overlay");
const gsInput    = document.getElementById("ad-gs-input");
const gsResults  = document.getElementById("ad-gs-results");
const gsCloseBtn = document.getElementById("ad-gs-close");
const gsTrigger  = document.getElementById("ad-gs-trigger");

const GS_ICONS = {
  product: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>`,
  lead:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16v12H7l-3 3V4Z"/></svg>`,
  order:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 7 12 3 4 7l8 4 8-4Z"/><path d="M4 7v10l8 4 8-4V7"/><path d="M12 11v10"/></svg>`,
  category: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41 12 22l-9-9 8.59-8.59A2 2 0 0 1 13 4h6a2 2 0 0 1 2 2v6a2 2 0 0 1-.41 1.41Z"/><circle cx="16.5" cy="7.5" r="1"/></svg>`,
  blog:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16v16H4z"/><path d="M4 9h16M9 4v16"/></svg>`
};
const GS_TYPE_LABEL = { product: "สินค้า", lead: "ลีด", order: "คำสั่งผลิต", category: "หมวดหมู่", blog: "บทความ" };

function gsEscRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

// ไฮไลต์คำค้นในผลลัพธ์ — escape ค่าทั้งหมดก่อนเสมอ (กันช่องค้นหากลายเป็นช่องโหว่ XSS แบบเดียวกับที่แก้ใน site-search.js)
function gsHighlight(text, q) {
  const safe = escapeHtml(text == null ? "" : String(text));
  if (!q) return safe;
  const re = new RegExp("(" + gsEscRe(escapeHtml(q)) + ")", "ig");
  return safe.replace(re, "<mark>$1</mark>");
}

// ดัชนีค้นหา: รวมสินค้า/ลีด/คำสั่งผลิตทั้งหมดที่โหลดไว้แล้วในหน้านี้ ค้นแบบ substring ไม่สนตัวพิมพ์เล็ก-ใหญ่
// (ไม่ต้องยิง query เพิ่ม เพราะ allProducts/allLeads/getAllOrders() เป็นข้อมูลที่ realtime listener ซิงก์ไว้อยู่แล้ว)
function gsSearch(query) {
  const q = query.trim().toLowerCase();
  if (!q) return { products: [], leads: [], orders: [], categories: [], blogs: [] };

  const products = allProducts
    .filter(p => !pendingDeleteProductIds.has(p.id))
    .filter(p => (p.name || "").toLowerCase().includes(q) || (p.code || "").toLowerCase().includes(q))
    .slice(0, 6);

  const leads = allLeads
    .filter(l => !pendingDeleteLeadIds.has(l.id))
    .filter(l => [l.name, l.company, l.email, l.tel, l.phone, l.service].filter(Boolean).join(" ").toLowerCase().includes(q))
    .slice(0, 6);

  const orders = getAllOrders()
    .filter(o => [o.code, o.customer, o.item].filter(Boolean).join(" ").toLowerCase().includes(q))
    .slice(0, 6);

  const categories = allCategories
    .filter(c => !pendingDeleteCategoryIds.has(c.id))
    .filter(c => [c.name, c.group, c.description].filter(Boolean).join(" ").toLowerCase().includes(q))
    .slice(0, 6);

  const blogs = allBlogs
    .filter(b => !pendingDeleteBlogIds.has(b.id))
    .filter(b => [b.title, b.category, b.excerpt].filter(Boolean).join(" ").toLowerCase().includes(q))
    .slice(0, 6);

  return { products, leads, orders, categories, blogs };
}

function gsResultRow(type, title, desc) {
  return `
    <button type="button" class="ad-gs-result" data-type="${type}">
      <span class="ad-gs-result-icon">${GS_ICONS[type]}</span>
      <span class="ad-gs-result-body">
        <span class="ad-gs-result-title">${title}</span>
        <span class="ad-gs-result-desc">${desc || "&nbsp;"}</span>
      </span>
      <span class="ad-gs-result-tag">${GS_TYPE_LABEL[type]}</span>
    </button>`;
}

let gsCurrentResults = []; // ลิสต์เรียบ [{type, item}, ...] ตามลำดับที่ render จริง — ใช้กับลูกศร/Enter
let gsActiveIndex = -1;

function gsRenderEmpty() {
  gsResults.innerHTML = `<div class="ad-gs-empty">พิมพ์เพื่อค้นหาชื่อ/รหัสสินค้า, ชื่อ/บริษัทลีด, เลขที่คำสั่งผลิต, หมวดหมู่ หรือบทความ</div>`;
  gsCurrentResults = [];
  gsActiveIndex = -1;
}

function gsRenderNoMatch(q) {
  gsResults.innerHTML = `<div class="ad-gs-empty">ไม่พบผลลัพธ์สำหรับ &ldquo;<strong>${escapeHtml(q)}</strong>&rdquo;</div>`;
  gsCurrentResults = [];
  gsActiveIndex = -1;
}

function gsRender(query) {
  const q = query.trim();
  if (!q) { gsRenderEmpty(); return; }
  const { products, leads, orders, categories, blogs } = gsSearch(q);
  if (!products.length && !leads.length && !orders.length && !categories.length && !blogs.length) { gsRenderNoMatch(q); return; }

  gsCurrentResults = [];
  let html = "";
  if (products.length) {
    html += `<div class="ad-gs-group-label">สินค้า</div>`;
    products.forEach(p => {
      gsCurrentResults.push({ type: "product", item: p });
      html += gsResultRow("product", gsHighlight(p.name || "ไม่มีชื่อ", q), gsHighlight([p.code, catName(p.cat_id)].filter(Boolean).join(" · "), q));
    });
  }
  if (leads.length) {
    html += `<div class="ad-gs-group-label">ลีด</div>`;
    leads.forEach(l => {
      gsCurrentResults.push({ type: "lead", item: l });
      html += gsResultRow("lead", gsHighlight(l.name || l.company || "(ไม่ระบุชื่อ)", q), gsHighlight([l.company, l.email, l.tel || l.phone].filter(Boolean).join(" · "), q));
    });
  }
  if (orders.length) {
    html += `<div class="ad-gs-group-label">คำสั่งผลิต</div>`;
    orders.forEach(o => {
      gsCurrentResults.push({ type: "order", item: o });
      html += gsResultRow("order", gsHighlight("#" + (o.code || o.id), q), gsHighlight([o.customer, o.item].filter(Boolean).join(" · "), q));
    });
  }
  if (categories.length) {
    html += `<div class="ad-gs-group-label">หมวดหมู่</div>`;
    categories.forEach(c => {
      gsCurrentResults.push({ type: "category", item: c });
      html += gsResultRow("category", gsHighlight(c.name || "ไม่มีชื่อ", q), gsHighlight(c.group || c.description || "", q));
    });
  }
  if (blogs.length) {
    html += `<div class="ad-gs-group-label">บทความ</div>`;
    blogs.forEach(b => {
      gsCurrentResults.push({ type: "blog", item: b });
      html += gsResultRow("blog", gsHighlight(b.title || "ไม่มีชื่อ", q), gsHighlight([b.category, (b.status || "published") === "draft" ? "ฉบับร่าง" : ""].filter(Boolean).join(" · "), q));
    });
  }
  gsResults.innerHTML = html;
  gsActiveIndex = -1;
}

function gsSetActive(idx) {
  const rows = gsResults.querySelectorAll(".ad-gs-result");
  rows.forEach(r => r.classList.remove("is-active"));
  if (idx >= 0 && rows[idx]) {
    rows[idx].classList.add("is-active");
    rows[idx].scrollIntoView({ block: "nearest" });
  }
  gsActiveIndex = idx;
}

function gsOpen() {
  openOverlay(gsOverlay);
  gsInput.value = "";
  gsRenderEmpty();
  setTimeout(() => gsInput.focus(), 30);
}
function gsClose() {
  closeOverlay(gsOverlay);
}

// ปิด overlay แล้วกระโดดไปแท็บที่เจอผลลัพธ์ พร้อมค้นหา/ไฮไลต์รายการนั้นให้เด่นที่สุด
function gsGoTo(result) {
  if (!result) return;
  gsClose();
  if (result.type === "product") jumpToProduct(result.item);
  else if (result.type === "lead") jumpToLead(result.item);
  else if (result.type === "order") { switchTab("orders"); jumpToOrder(result.item); }
  else if (result.type === "category") jumpToCategory(result.item);
  else if (result.type === "blog") jumpToBlogPost(result.item);
}

gsTrigger.addEventListener("click", gsOpen);
gsCloseBtn.addEventListener("click", gsClose);
gsOverlay.addEventListener("click", (e) => { if (e.target === gsOverlay) gsClose(); });

let gsDebounceTimer = null;
gsInput.addEventListener("input", () => {
  window.clearTimeout(gsDebounceTimer);
  const val = gsInput.value;
  gsDebounceTimer = window.setTimeout(() => gsRender(val), 120);
});

gsResults.addEventListener("click", (e) => {
  const row = e.target.closest(".ad-gs-result");
  if (!row) return;
  const idx = Array.from(gsResults.querySelectorAll(".ad-gs-result")).indexOf(row);
  gsGoTo(gsCurrentResults[idx]);
});

gsInput.addEventListener("keydown", (e) => {
  if (e.key === "ArrowDown") {
    e.preventDefault();
    if (gsCurrentResults.length) gsSetActive(Math.min(gsActiveIndex + 1, gsCurrentResults.length - 1));
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    if (gsCurrentResults.length) gsSetActive(Math.max(gsActiveIndex - 1, 0));
  } else if (e.key === "Enter") {
    e.preventDefault();
    if (gsCurrentResults.length) gsGoTo(gsCurrentResults[gsActiveIndex >= 0 ? gsActiveIndex : 0]);
  } else if (e.key === "Escape") {
    e.preventDefault();
    gsClose();
  }
});
