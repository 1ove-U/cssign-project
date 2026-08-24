// ===========================
// js/admin-blog.js — BLOG POSTS
//
// 2026 refactor phase 2: ย้ายมาจาก js/admin-page.js เดิม (ส่วน "BLOG POSTS" บรรทัด
// 2964-3297 เดิม) แบบไม่เปลี่ยน behavior ใดๆ — เช็คด้วย diff กับต้นฉบับแล้วตรงทุกตัวอักษร
// ยกเว้นจุดที่ตั้งใจแยกไฟล์ (ดูด้านล่าง)
//
// export `renderBlogs()` ตามแผนเดิม
//
// เอาฟังก์ชัน local `slugify()` (เดิมนิยามซ้ำอยู่ในไฟล์ต้นฉบับ) ออก ใช้ตัวที่ย้ายไป
// `admin-utils.js` แล้วแทน (ย้ายไปตอนทำ admin-products.js เพราะฟอร์มสินค้าต้องใช้ก่อน —
// ตัวที่นี่เหมือนกันทุกตัวอักษรอยู่แล้วไม่มีเปลี่ยน logic)
//
// 2026 refactor phase 21: แยกส่วน "ฟอร์มเพิ่ม/แก้ไขบทความ" (โมดัล, currentBlogImage,
// renderBlogImage(), openBlogModal()/openBlogModalClone()/closeBlogModal(), submit
// handler) ออกไปเป็น js/admin-blog-form.js (347 → 2 ไฟล์) แบบไม่เปลี่ยน behavior ใดๆ —
// ไฟล์นี้เหลือ: กริด/ค้นหา/กรอง/pagination/bulk actions ที่ import openBlogModal()/
// openBlogModalClone() กลับมาจากไฟล์ใหม่แทนของเดิม — ไม่มีไฟล์อื่นเคย import
// openBlogModal จาก admin-blog.js เดิมมาก่อน (ต่างจาก openProductModal ที่
// admin-overview-dashboard.js เรียกผ่าน admin-products.js) จึงไม่ต้อง re-export
// ===========================
import { saveBlog, deleteBlog } from "./db-blog.js";
import { confirmDialog, emptyStateHTML } from "./ui-helpers.js";
import { showToast, deleteWithUndo, escapeHtml, buildPageList } from "./admin-utils.js";
import { allBlogs, pendingDeleteBlogIds } from "./admin-state.js";
import { reloadAll } from "./admin-page.js";
import { openBlogModal, openBlogModalClone } from "./admin-blog-form.js";

export const bGrid          = document.getElementById("ad-b-grid");
export const bSearch         = document.getElementById("ad-b-search");
export const bFilterStatus   = document.getElementById("ad-b-filter-status");
const bAddBtn         = document.getElementById("ad-b-add-btn");
const bPaginationBox  = document.getElementById("ad-b-pagination");
const bPaginationInfo = document.getElementById("ad-b-pagination-info");
const bPaginationBtns = document.getElementById("ad-b-pagination-btns");

const BLOG_PAGE_SIZE = 12;
export let bCurrentPage = 1;
// setter สำหรับไฟล์นอก module นี้ (admin-global-search.js) — reassign import binding ตรงๆ ไม่ได้
export function setBCurrentPage(v) { bCurrentPage = v; }
let selectedBlogIds = new Set(); // bulk actions: id ที่ถูกเลือก (คงอยู่ข้ามการ re-render/หน้า)

// ── Bulk actions bar (เลือกหลายการ์ด + ลบ/เปลี่ยนสถานะทีเดียว) ──
const bBulkBar          = document.getElementById("ad-b-bulk-bar");
const bBulkCount        = document.getElementById("ad-b-bulk-count");
const bBulkClearBtn     = document.getElementById("ad-b-bulk-clear");
const bBulkStatusSelect = document.getElementById("ad-b-bulk-status-select");
const bBulkApplyBtn     = document.getElementById("ad-b-bulk-apply-status");
const bBulkDeleteBtn    = document.getElementById("ad-b-bulk-delete");

function getFilteredBlogs() {
  let rows = allBlogs.filter(b => !pendingDeleteBlogIds.has(b.id));
  const term = bSearch.value.trim().toLowerCase();
  if (term) rows = rows.filter(b => (b.title || "").toLowerCase().includes(term));
  if (bFilterStatus.value) rows = rows.filter(b => (b.status || "published") === bFilterStatus.value);
  return rows;
}

function renderBlogsPagination(totalRows) {
  const totalPages = Math.max(1, Math.ceil(totalRows / BLOG_PAGE_SIZE));
  if (bCurrentPage > totalPages) bCurrentPage = totalPages;
  if (bCurrentPage < 1) bCurrentPage = 1;

  if (!totalRows) {
    bPaginationBox.style.display = "none";
    return;
  }
  bPaginationBox.style.display = "flex";

  const start = (bCurrentPage - 1) * BLOG_PAGE_SIZE + 1;
  const end = Math.min(totalRows, bCurrentPage * BLOG_PAGE_SIZE);
  bPaginationInfo.textContent = `แสดง ${start}–${end} จาก ${totalRows} รายการ`;

  const pages = buildPageList(bCurrentPage, totalPages);
  bPaginationBtns.innerHTML = `
    <button class="cp-page-btn cp-page-nav" data-page="prev" ${bCurrentPage === 1 ? "disabled" : ""} aria-label="หน้าก่อนหน้า">‹</button>
    ${pages.map(p => p === "…"
      ? `<span class="cp-page-ellipsis">…</span>`
      : `<button class="cp-page-btn ${p === bCurrentPage ? "active" : ""}" data-page="${p}">${p}</button>`
    ).join("")}
    <button class="cp-page-btn cp-page-nav" data-page="next" ${bCurrentPage === totalPages ? "disabled" : ""} aria-label="หน้าถัดไป">›</button>
  `;
  bPaginationBtns.querySelectorAll(".cp-page-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      if (btn.disabled) return;
      if (btn.dataset.page === "prev") bCurrentPage = Math.max(1, bCurrentPage - 1);
      else if (btn.dataset.page === "next") bCurrentPage = Math.min(totalPages, bCurrentPage + 1);
      else bCurrentPage = Number(btn.dataset.page);
      renderBlogs();
      bGrid.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  });
}

export function renderBlogs() {
  const filteredRows = getFilteredBlogs();

  if (!filteredRows.length) {
    const hasFilters = bSearch.value.trim() || bFilterStatus.value;
    bGrid.innerHTML = hasFilters
      ? emptyStateHTML({ title: "ไม่พบบทความที่ตรงกับตัวกรอง", desc: "ลองเปลี่ยนคำค้นหรือสถานะดูอีกครั้ง" })
      : emptyStateHTML({
          icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 4h16v16H4z"/><path d="M4 9h16M9 4v16"/></svg>`,
          title: "ยังไม่มีบทความในระบบ",
          desc: "เพิ่มบทความแรกเพื่อเริ่มแสดงในหน้าบล็อกของเว็บไซต์",
          ctaLabel: "+ เพิ่มรายการแรก", ctaId: "ad-b-empty-add"
        });
    const emptyAddBtn = document.getElementById("ad-b-empty-add");
    if (emptyAddBtn) emptyAddBtn.addEventListener("click", () => openBlogModal(null));
    renderBlogsPagination(0);
    updateBlogsBulkBar();
    return;
  }

  renderBlogsPagination(filteredRows.length);
  const pageStart = (bCurrentPage - 1) * BLOG_PAGE_SIZE;
  const rows = filteredRows.slice(pageStart, pageStart + BLOG_PAGE_SIZE);

  bGrid.innerHTML = rows.map(b => {
    const visual = b.image
      ? `<img src="${b.image}" alt="${escapeHtml(b.title)}" class="port-photo" loading="lazy">`
      : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 4h16v16H4z"/><path d="M4 9h16M9 4v16"/></svg>`;
    return `
    <div class="port-card ad-card ad-b-card" data-id="${b.id}">
      <input type="checkbox" class="ad-card-check" data-id="${b.id}" ${selectedBlogIds.has(b.id) ? "checked" : ""} aria-label="เลือกบทความนี้">
      <div class="ad-card-actions">
        <button class="cp-icon-btn" data-action="edit" title="แก้ไข"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button>
        <button class="cp-icon-btn" data-action="clone" title="ทำซ้ำ (เปิดฟอร์มเพิ่มใหม่พร้อมข้อมูลเดิม)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
        <button class="cp-icon-btn danger" data-action="delete" title="ลบ"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg></button>
      </div>
      <div class="port-visual${b.image ? "" : " no-photo"}">
        ${visual}
        ${(b.status || "published") === "draft" ? `<span class="ad-b-status-draft">ฉบับร่าง</span>` : ""}
      </div>
      <div class="ad-card-body">
        <span class="ad-card-cat">${escapeHtml(b.category || "บทความ")}</span>
        <span class="ad-card-name">${escapeHtml(b.title || "ไม่มีชื่อ")}</span>
      </div>
    </div>`;
  }).join("");
  updateBlogsBulkBar();
}

bSearch.addEventListener("input", () => { bCurrentPage = 1; renderBlogs(); });
bFilterStatus.addEventListener("change", () => { bCurrentPage = 1; renderBlogs(); });

bGrid.addEventListener("click", async (e) => {
  const card = e.target.closest(".ad-card");
  if (!card) return;
  const id = card.dataset.id;
  const post = allBlogs.find(b => b.id === id);
  if (!post) return;
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  if (btn.dataset.action === "edit") openBlogModal(post);
  if (btn.dataset.action === "clone") openBlogModalClone(post);
  if (btn.dataset.action === "delete") {
    if (await confirmDialog(`ลบบทความ "${post.title || ""}" ใช่หรือไม่? การลบนี้ไม่สามารถย้อนกลับได้`, { title: "ลบบทความ" })) {
      deleteWithUndo({
        pendingSet: pendingDeleteBlogIds, id, renderFn: renderBlogs,
        message: `ลบบทความ "${post.title || ""}" แล้ว`,
        deleteFn: () => deleteBlog(id), onCommitted: reloadAll, targetType: "blog"
      });
    }
  }
});

// ── Bulk actions (เลือกหลายการ์ด + ลบ/เปลี่ยนสถานะทีเดียว) ──────────────────────────────
function updateBlogsBulkBar() {
  if (!bBulkBar) return;
  bBulkCount.textContent = selectedBlogIds.size;
  bBulkBar.classList.toggle("active", selectedBlogIds.size > 0);
}

bGrid.addEventListener("change", (e) => {
  if (!e.target.classList.contains("ad-card-check")) return;
  const id = e.target.dataset.id;
  if (e.target.checked) selectedBlogIds.add(id); else selectedBlogIds.delete(id);
  updateBlogsBulkBar();
});

if (bBulkClearBtn) {
  bBulkClearBtn.addEventListener("click", () => {
    selectedBlogIds.clear();
    bGrid.querySelectorAll(".ad-card-check").forEach(cb => { cb.checked = false; });
    updateBlogsBulkBar();
  });
}

if (bBulkApplyBtn) {
  bBulkApplyBtn.addEventListener("click", async () => {
    const status = bBulkStatusSelect.value;
    if (!status || !selectedBlogIds.size) return;
    const ids = Array.from(selectedBlogIds);
    bBulkApplyBtn.disabled = true;
    try {
      await Promise.all(ids.map(id => {
        const post = allBlogs.find(b => b.id === id);
        return post ? saveBlog({ ...post, id, status }) : Promise.resolve();
      }));
      showToast(`เปลี่ยนสถานะแล้ว ${ids.length} รายการ`, "success");
      selectedBlogIds.clear();
      bBulkStatusSelect.value = "";
      await reloadAll();
    } catch (err) {
      showToast("อัปเดตสถานะไม่สำเร็จ: " + err.message);
    } finally {
      bBulkApplyBtn.disabled = false;
      updateBlogsBulkBar();
    }
  });
}

if (bBulkDeleteBtn) {
  bBulkDeleteBtn.addEventListener("click", async () => {
    if (!selectedBlogIds.size) return;
    const ids = Array.from(selectedBlogIds);
    if (!(await confirmDialog(`ลบบทความที่เลือก ${ids.length} รายการ? ไม่สามารถกู้คืนได้`, { title: "ลบหลายรายการ" }))) return;
    bBulkDeleteBtn.disabled = true;
    try {
      await Promise.all(ids.map(id => deleteBlog(id)));
      showToast(`ลบแล้ว ${ids.length} รายการ`, "success");
      selectedBlogIds.clear();
      await reloadAll();
    } catch (err) {
      showToast("ลบไม่สำเร็จ: " + err.message);
    } finally {
      bBulkDeleteBtn.disabled = false;
      updateBlogsBulkBar();
    }
  });
}

bAddBtn.addEventListener("click", () => openBlogModal(null));
