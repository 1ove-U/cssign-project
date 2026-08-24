// ===========================
// js/admin-portfolio.js — PORTFOLIO (ผลงาน)
//
// 2026 refactor phase 2: ย้ายมาจาก js/admin-page.js เดิม (ส่วน "PORTFOLIO" บรรทัด
// 2559-2961 เดิม) แบบไม่เปลี่ยน behavior ใดๆ — เช็คด้วย diff กับต้นฉบับแล้วตรงทุกตัวอักษร
// ยกเว้นจุดที่ตั้งใจแยกไฟล์ (เพิ่ม `export` หน้า `renderPortfolios`)
//
// export `renderPortfolios()` ตามแผนเดิม
//
// 2026 refactor phase 11: แยกส่วน "ฟอร์มเพิ่ม/แก้ไขผลงาน" (รวมรูปภาพที่กำลังแก้ไข) ออกไปเป็น
// js/admin-portfolio-form.js (ใหม่) แบบ diff เป๊ะ ไม่มีเปลี่ยน logic — ไฟล์นี้เหลือแค่กริด/ค้นหา/
// กรอง/pagination/bulk actions/popup ดูรายละเอียด เรียก openPortfolioModal()/
// openPortfolioModalClone() ที่ import กลับมาจากไฟล์ใหม่แทน — ไม่มีไฟล์อื่นในโปรเจกต์ import
// สองฟังก์ชันนี้จาก admin-portfolio.js เดิมโดยตรง จึงไม่ต้อง re-export กลับ (ต่างจากกรณี
// openProductModal ของ admin-products.js → admin-products-form.js ที่ต้อง re-export)
// ===========================
import { savePortfolio, deletePortfolio } from "./db-content.js";
import { confirmDialog } from "./ui-helpers.js";
import { emptyStateHTML } from "./ui-helpers.js";
import {
  showToast, openOverlay, closeOverlay, deleteWithUndo, escapeHtml,
  buildPageList
} from "./admin-utils.js";
import { allPortfolios, pendingDeletePortfolioIds } from "./admin-state.js";
import { reloadAll } from "./admin-page.js";
import { openPortfolioModal, openPortfolioModalClone } from "./admin-portfolio-form.js";

const pfGrid       = document.getElementById("ad-pf-grid");
const pfSearch      = document.getElementById("ad-pf-search");
const pfFilterCat   = document.getElementById("ad-pf-filter-cat");
const pfAddBtn      = document.getElementById("ad-pf-add-btn");
const pfPaginationBox  = document.getElementById("ad-pf-pagination");
const pfPaginationInfo = document.getElementById("ad-pf-pagination-info");
const pfPaginationBtns = document.getElementById("ad-pf-pagination-btns");

const PORTFOLIO_PAGE_SIZE = 12;
let pfCurrentPage = 1;
let selectedPortfolioIds = new Set(); // bulk actions: id ที่ถูกเลือก (คงอยู่ข้ามการ re-render/หน้า)

// ── Bulk actions bar (เลือกหลายการ์ด + ลบทีเดียว) ──
const pfBulkBar       = document.getElementById("ad-pf-bulk-bar");
const pfBulkCount     = document.getElementById("ad-pf-bulk-count");
const pfBulkClearBtn  = document.getElementById("ad-pf-bulk-clear");
const pfBulkDeleteBtn = document.getElementById("ad-pf-bulk-delete");

const PF_CAT_LABEL = {
  factory: "โรงงานอุตสาหกรรม",
  government: "ภาครัฐ",
  industrial: "นิคมอุตสาหกรรม",
  custom: "Custom Order"
};
function renderPortfolioPagination(totalRows) {
  const totalPages = Math.max(1, Math.ceil(totalRows / PORTFOLIO_PAGE_SIZE));
  if (pfCurrentPage > totalPages) pfCurrentPage = totalPages;
  if (pfCurrentPage < 1) pfCurrentPage = 1;

  if (!totalRows) {
    pfPaginationBox.style.display = "none";
    return;
  }
  pfPaginationBox.style.display = "flex";

  const start = (pfCurrentPage - 1) * PORTFOLIO_PAGE_SIZE + 1;
  const end = Math.min(totalRows, pfCurrentPage * PORTFOLIO_PAGE_SIZE);
  pfPaginationInfo.textContent = `แสดง ${start}–${end} จาก ${totalRows} รายการ`;

  const pages = buildPageList(pfCurrentPage, totalPages);
  pfPaginationBtns.innerHTML = `
    <button class="cp-page-btn cp-page-nav" data-page="prev" ${pfCurrentPage === 1 ? "disabled" : ""} aria-label="หน้าก่อนหน้า">‹</button>
    ${pages.map(p => p === "…"
      ? `<span class="cp-page-ellipsis">…</span>`
      : `<button class="cp-page-btn ${p === pfCurrentPage ? "active" : ""}" data-page="${p}">${p}</button>`
    ).join("")}
    <button class="cp-page-btn cp-page-nav" data-page="next" ${pfCurrentPage === totalPages ? "disabled" : ""} aria-label="หน้าถัดไป">›</button>
  `;
  pfPaginationBtns.querySelectorAll(".cp-page-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      if (btn.disabled) return;
      if (btn.dataset.page === "prev") pfCurrentPage = Math.max(1, pfCurrentPage - 1);
      else if (btn.dataset.page === "next") pfCurrentPage = Math.min(totalPages, pfCurrentPage + 1);
      else pfCurrentPage = Number(btn.dataset.page);
      renderPortfolios();
      pfGrid.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  });
}

export function renderPortfolios() {
  let rows = allPortfolios.filter(p => !pendingDeletePortfolioIds.has(p.id));
  const term = pfSearch.value.trim().toLowerCase();
  if (term) rows = rows.filter(p =>
    (p.title || "").toLowerCase().includes(term) || (p.client || "").toLowerCase().includes(term));
  if (pfFilterCat.value) rows = rows.filter(p => p.category === pfFilterCat.value);

  if (!rows.length) {
    const hasFilters = pfSearch.value.trim() || pfFilterCat.value;
    pfGrid.innerHTML = hasFilters
      ? emptyStateHTML({ title: "ไม่พบผลงานที่ตรงกับตัวกรอง", desc: "ลองเปลี่ยนคำค้นหรือประเภทโครงการดูอีกครั้ง" })
      : emptyStateHTML({
          icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/></svg>`,
          title: "ยังไม่มีผลงานในระบบ",
          desc: "เพิ่มผลงานแรกเพื่อแสดงในหน้าผลงานของเว็บไซต์",
          ctaLabel: "+ เพิ่มรายการแรก", ctaId: "ad-pf-empty-add"
        });
    const emptyAddBtn = document.getElementById("ad-pf-empty-add");
    if (emptyAddBtn) emptyAddBtn.addEventListener("click", () => openPortfolioModal(null));
    renderPortfolioPagination(0);
    updatePortfoliosBulkBar();
    return;
  }

  renderPortfolioPagination(rows.length);
  const pfPageStart = (pfCurrentPage - 1) * PORTFOLIO_PAGE_SIZE;
  rows = rows.slice(pfPageStart, pfPageStart + PORTFOLIO_PAGE_SIZE);

  pfGrid.innerHTML = rows.map(p => {
    const imgs = (p.images || []).filter(Boolean);
    const img = imgs[0] || "";
    const visual = img
      ? `<img src="${img}" alt="${escapeHtml(p.title || "")}" class="port-photo" loading="lazy">`
      : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" width="34" height="34"><path d="M3 21h18M5 21V7l8-4 8 4v14M9 21v-6h6v6"/></svg>`;
    const tags = (p.tags || []).slice(0, 3).map(t => `<span>${escapeHtml(t)}</span>`).join("");
    return `
    <div class="port-card ad-pf-card" data-id="${p.id}">
      <input type="checkbox" class="ad-pf-card-check" data-id="${p.id}" ${selectedPortfolioIds.has(p.id) ? "checked" : ""} aria-label="เลือกผลงานนี้">
      <div class="ad-pf-card-actions">
        ${p.pinned ? `
        <button class="cp-icon-btn" data-action="move-up" title="เลื่อนขึ้น (แสดงก่อนในหน้าแรก)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 19V5M5 12l7-7 7 7"/></svg></button>
        <button class="cp-icon-btn" data-action="move-down" title="เลื่อนลง"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12l7 7 7-7"/></svg></button>` : ""}
        <button class="cp-icon-btn" data-action="edit" title="แก้ไข"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button>
        <button class="cp-icon-btn" data-action="clone" title="ทำซ้ำ (เปิดฟอร์มเพิ่มใหม่พร้อมข้อมูลเดิม)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
        <button class="cp-icon-btn danger" data-action="delete" title="ลบ"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg></button>
      </div>
      <div class="port-visual${img ? "" : " no-photo"}">
        ${visual}
        <div class="port-badge">${escapeHtml(PF_CAT_LABEL[p.category] || p.category || "ไม่ระบุประเภท")}</div>
        ${p.pinned ? `<div class="port-pin-flag" title="ปักหมุดแสดงหน้าแรก"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l1.6 4.9H19l-4 3 1.5 5L12 12l-4.5 3 1.5-5-4-3h5.4z"/></svg></div>` : ""}
        ${imgs.length > 1 ? `<span class="ad-pf-card-imgcount">+${imgs.length - 1} รูป</span>` : ""}
      </div>
      <div class="port-info">
        ${p.client ? `<div class="port-client">${escapeHtml(p.client)}</div>` : ""}
        <h3>${escapeHtml(p.title || "ไม่มีชื่อ")}</h3>
        ${p.description ? `<p>${escapeHtml(p.description)}</p>` : ""}
        ${tags ? `<div class="port-tags">${tags}</div>` : ""}
      </div>
    </div>`;
  }).join("");
  updatePortfoliosBulkBar();
}

pfSearch.addEventListener("input", () => { pfCurrentPage = 1; renderPortfolios(); });
pfFilterCat.addEventListener("change", () => { pfCurrentPage = 1; renderPortfolios(); });

pfGrid.addEventListener("click", async (e) => {
  const card = e.target.closest(".ad-pf-card");
  if (!card) return;
  const id = card.dataset.id;
  const item = allPortfolios.find(p => p.id === id);
  if (!item) return;

  const btn = e.target.closest("button[data-action]");
  if (btn) {
    if (btn.dataset.action === "edit") openPortfolioModal(item);
    if (btn.dataset.action === "clone") openPortfolioModalClone(item);
    if (btn.dataset.action === "delete") {
      if (await confirmDialog(`ลบผลงาน "${item.title || ""}" ใช่หรือไม่? การลบนี้ไม่สามารถย้อนกลับได้`, { title: "ลบผลงาน" })) {
        deleteWithUndo({
          pendingSet: pendingDeletePortfolioIds, id, renderFn: renderPortfolios,
          message: `ลบผลงาน "${item.title || ""}" แล้ว`,
          deleteFn: () => deletePortfolio(id), onCommitted: reloadAll, targetType: "portfolio"
        });
      }
    }
    if (btn.dataset.action === "move-up" || btn.dataset.action === "move-down") {
      await movePinnedItem(item, btn.dataset.action === "move-up" ? -1 : 1);
    }
    return;
  }
  if (e.target.closest(".ad-pf-card-check")) return;
  // คลิกที่ตัวการ์ด (ไม่ใช่ปุ่ม) → เปิด popup รายละเอียด
  openPortfolioViewPopup(item);
});

// ── Bulk actions (เลือกหลายการ์ด + ลบทีเดียว) ──────────────────────────────
function updatePortfoliosBulkBar() {
  if (!pfBulkBar) return;
  pfBulkCount.textContent = selectedPortfolioIds.size;
  pfBulkBar.classList.toggle("active", selectedPortfolioIds.size > 0);
}

pfGrid.addEventListener("change", (e) => {
  if (!e.target.classList.contains("ad-pf-card-check")) return;
  const id = e.target.dataset.id;
  if (e.target.checked) selectedPortfolioIds.add(id); else selectedPortfolioIds.delete(id);
  updatePortfoliosBulkBar();
});

if (pfBulkClearBtn) {
  pfBulkClearBtn.addEventListener("click", () => {
    selectedPortfolioIds.clear();
    pfGrid.querySelectorAll(".ad-pf-card-check").forEach(cb => { cb.checked = false; });
    updatePortfoliosBulkBar();
  });
}

if (pfBulkDeleteBtn) {
  pfBulkDeleteBtn.addEventListener("click", async () => {
    if (!selectedPortfolioIds.size) return;
    const ids = Array.from(selectedPortfolioIds);
    if (!(await confirmDialog(`ลบผลงานที่เลือก ${ids.length} รายการ? ไม่สามารถกู้คืนได้`, { title: "ลบหลายรายการ" }))) return;
    pfBulkDeleteBtn.disabled = true;
    try {
      await Promise.all(ids.map(id => deletePortfolio(id)));
      showToast(`ลบแล้ว ${ids.length} รายการ`, "success");
      selectedPortfolioIds.clear();
      await reloadAll();
    } catch (err) {
      showToast("ลบไม่สำเร็จ: " + err.message);
    } finally {
      pfBulkDeleteBtn.disabled = false;
      updatePortfoliosBulkBar();
    }
  });
}

// ── สลับลำดับการแสดงผลงานที่ปักหมุดในหน้าแรก ──
async function movePinnedItem(item, dir) {
  const pinned = allPortfolios
    .filter(p => p.pinned)
    .sort((a, b) => (a.order || 0) - (b.order || 0) || (a.createdAt || 0) - (b.createdAt || 0));
  const idx = pinned.findIndex(p => p.id === item.id);
  const swapIdx = idx + dir;
  if (idx === -1 || swapIdx < 0 || swapIdx >= pinned.length) return;

  // ใช้ index ปัจจุบันเป็นค่า order ใหม่ของทั้งคู่ที่สลับกัน เพื่อให้ลำดับเรียงต่อเนื่องเสมอ
  const a = pinned[idx], b = pinned[swapIdx];
  try {
    await Promise.all([
      savePortfolio({ ...a, id: a.id, order: swapIdx }),
      savePortfolio({ ...b, id: b.id, order: idx })
    ]);
    await reloadAll();
  } catch (err) {
    showToast("จัดลำดับไม่สำเร็จ: " + err.message);
  }
}

// ── Popup ดูรายละเอียดผลงาน (รูปทั้งหมด + ข้อมูลเต็ม) ──
const pfViewOverlay = document.getElementById("ad-pf-view-overlay");
const pfViewClose    = document.getElementById("ad-pf-view-close");
const pfViewImg      = document.getElementById("ad-pf-view-img");
const pfViewBadge    = document.getElementById("ad-pf-view-badge");
const pfViewPin      = document.getElementById("ad-pf-view-pin");
const pfViewThumbs   = document.getElementById("ad-pf-view-thumbs");
const pfViewClient   = document.getElementById("ad-pf-view-client");
const pfViewTitle    = document.getElementById("ad-pf-view-title");
const pfViewDesc     = document.getElementById("ad-pf-view-desc");
const pfViewTags     = document.getElementById("ad-pf-view-tags");
const pfViewEditBtn  = document.getElementById("ad-pf-view-edit");
let pfViewItem = null;
let pfViewImages = [];

function openPortfolioViewPopup(item) {
  pfViewItem = item;
  pfViewImages = (item.images || []).filter(Boolean);
  pfViewBadge.textContent = PF_CAT_LABEL[item.category] || item.category || "ผลงาน";
  pfViewPin.style.display = item.pinned ? "flex" : "none";
  pfViewClient.textContent = item.client || "";
  pfViewClient.style.display = item.client ? "" : "none";
  pfViewTitle.textContent = item.title || "ไม่มีชื่อ";
  pfViewDesc.textContent = item.description || "";
  pfViewDesc.style.display = item.description ? "" : "none";
  pfViewTags.innerHTML = (item.tags || []).map(t => `<span>${escapeHtml(t)}</span>`).join("");
  pfViewTags.style.display = (item.tags || []).length ? "" : "none";
  pfViewThumbs.innerHTML = pfViewImages.length > 1
    ? pfViewImages.map((src, i) => `<button type="button" class="ad-pf-view-thumb${i === 0 ? " active" : ""}" data-idx="${i}"><img src="${src}" alt="${escapeHtml(item.title || "ผลงาน")} รูปที่ ${i + 1}" loading="lazy"></button>`).join("")
    : "";
  setPfViewImage(0);
  openOverlay(pfViewOverlay);
}
function setPfViewImage(idx) {
  if (!pfViewImages.length) { pfViewImg.src = ""; return; }
  pfViewImg.src = pfViewImages[idx];
  pfViewThumbs.querySelectorAll(".ad-pf-view-thumb").forEach((t, i) => t.classList.toggle("active", i === idx));
}
function closePortfolioViewPopup() { closeOverlay(pfViewOverlay); }

pfViewClose.addEventListener("click", closePortfolioViewPopup);
pfViewOverlay.addEventListener("click", (e) => { if (e.target === pfViewOverlay) closePortfolioViewPopup(); });
pfViewThumbs.addEventListener("click", (e) => {
  const t = e.target.closest(".ad-pf-view-thumb");
  if (t) setPfViewImage(Number(t.dataset.idx));
});
pfViewEditBtn.addEventListener("click", () => {
  closePortfolioViewPopup();
  if (pfViewItem) openPortfolioModal(pfViewItem);
});

pfAddBtn.addEventListener("click", () => openPortfolioModal(null));
