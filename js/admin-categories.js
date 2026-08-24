// ===========================
// js/admin-categories.js — หมวดหมู่ย่อย (CATEGORIES)
//
// 2026 refactor phase 2: ย้ายมาจาก js/admin-page.js เดิม (ส่วน "CATEGORIES" บรรทัด
// 2374-2557 เดิม) แบบไม่เปลี่ยน behavior ใดๆ — เช็คด้วย diff กับต้นฉบับแล้วตรงทุกตัวอักษร
// ยกเว้นจุดที่ตั้งใจแยกไฟล์ (ดูด้านล่าง)
//
// export `renderCategories()` ตามแผนเดิม
//
// ปุ่ม "+ เพิ่มหมวดหมู่ใหญ่ใหม่" (cGroupNewBtn) เดิม assign ตัวแปร `gReturnToCategoryDraft`
// ตรงๆ เพราะอยู่ไฟล์เดียวกับ admin-groups.js — พอแยกไฟล์แล้วตัวแปรนั้นเป็น private state ของ
// admin-groups.js จึงเรียก `setGroupReturnToCategoryDraft({...})` (setter ที่ export มาจากไฟล์นั้น)
// แทน ก่อนเรียก `openGroupModal(null)` เหมือนเดิม
// ===========================
import { saveCategory, deleteCategory } from "./db-taxonomy.js";
import { confirmDialog } from "./ui-helpers.js";
import { showToast, openOverlay, closeOverlay, deleteWithUndo, escapeHtml, buildPageList, groupName } from "./admin-utils.js";
import { allCategories, allGroups, allProducts, pendingDeleteCategoryIds } from "./admin-state.js";
import { reloadAll } from "./admin-page.js";
import { fillGroupSelect, openGroupModal, setGroupReturnToCategoryDraft } from "./admin-groups.js";

export const cTableBody = document.getElementById("ad-c-table-body");
const cAddBtn     = document.getElementById("ad-c-add-btn");
const cOverlay   = document.getElementById("ad-c-overlay");
const cForm       = document.getElementById("ad-c-form");
const cModalTitle = document.getElementById("ad-c-modal-title");
const cCancelBtn  = document.getElementById("ad-c-cancel");
const cGroupNewBtn = document.getElementById("ad-c-group-new-btn");
export const cSearch     = document.getElementById("ad-c-search");
const cPaginationBox  = document.getElementById("ad-c-pagination");
const cPaginationInfo = document.getElementById("ad-c-pagination-info");
const cPaginationBtns = document.getElementById("ad-c-pagination-btns");

const CATEGORIES_PAGE_SIZE = 10;
export let cCurrentPage = 1;
// setter สำหรับไฟล์นอก module นี้ (admin-global-search.js) — reassign import binding ตรงๆ ไม่ได้
export function setCCurrentPage(v) { cCurrentPage = v; }

function getFilteredCategories() {
  let rows = allCategories.filter(c => !pendingDeleteCategoryIds.has(c.id));
  const term = cSearch.value.trim().toLowerCase();
  if (term) rows = rows.filter(c =>
    (c.name || "").toLowerCase().includes(term) || groupName(c.group_id).toLowerCase().includes(term));
  return rows;
}

function renderCategoriesPagination(totalRows) {
  const totalPages = Math.max(1, Math.ceil(totalRows / CATEGORIES_PAGE_SIZE));
  if (cCurrentPage > totalPages) cCurrentPage = totalPages;
  if (cCurrentPage < 1) cCurrentPage = 1;

  if (!totalRows) {
    cPaginationBox.style.display = "none";
    return;
  }
  cPaginationBox.style.display = "flex";

  const start = (cCurrentPage - 1) * CATEGORIES_PAGE_SIZE + 1;
  const end = Math.min(totalRows, cCurrentPage * CATEGORIES_PAGE_SIZE);
  cPaginationInfo.textContent = `แสดง ${start}–${end} จาก ${totalRows} รายการ`;

  const pages = buildPageList(cCurrentPage, totalPages);
  cPaginationBtns.innerHTML = `
    <button class="cp-page-btn cp-page-nav" data-page="prev" ${cCurrentPage === 1 ? "disabled" : ""} aria-label="หน้าก่อนหน้า">‹</button>
    ${pages.map(p => p === "…"
      ? `<span class="cp-page-ellipsis">…</span>`
      : `<button class="cp-page-btn ${p === cCurrentPage ? "active" : ""}" data-page="${p}">${p}</button>`
    ).join("")}
    <button class="cp-page-btn cp-page-nav" data-page="next" ${cCurrentPage === totalPages ? "disabled" : ""} aria-label="หน้าถัดไป">›</button>
  `;
  cPaginationBtns.querySelectorAll(".cp-page-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      if (btn.disabled) return;
      if (btn.dataset.page === "prev") cCurrentPage = Math.max(1, cCurrentPage - 1);
      else if (btn.dataset.page === "next") cCurrentPage = Math.min(totalPages, cCurrentPage + 1);
      else cCurrentPage = Number(btn.dataset.page);
      renderCategories();
      cTableBody.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  });
}

export function renderCategories() {
  const filteredRows = getFilteredCategories();

  if (!allCategories.length) {
    cTableBody.innerHTML = `<tr><td colspan="5" class="cp-empty">ยังไม่มีหมวดหมู่</td></tr>`;
    renderCategoriesPagination(0);
    return;
  }
  if (!filteredRows.length) {
    cTableBody.innerHTML = `<tr><td colspan="5" class="cp-empty">ไม่พบหมวดหมู่</td></tr>`;
    renderCategoriesPagination(0);
    return;
  }

  renderCategoriesPagination(filteredRows.length);
  const pageStart = (cCurrentPage - 1) * CATEGORIES_PAGE_SIZE;
  const rows = filteredRows.slice(pageStart, pageStart + CATEGORIES_PAGE_SIZE);

  cTableBody.innerHTML = rows.map(c => `
    <tr data-id="${c.id}">
      <td style="font-size:18px;">${escapeHtml(c.icon || "🏷️")}</td>
      <td>${escapeHtml(c.name || "")}</td>
      <td>${escapeHtml(groupName(c.group_id) || "— ไม่มีหมวดหมู่ใหญ่ —")}</td>
      <td>${escapeHtml(c.description || "—")}</td>
      <td>
        <div class="cp-row-actions">
          <button class="cp-icon-btn" data-action="edit" title="แก้ไข"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button>
          <button class="cp-icon-btn danger" data-action="delete" title="ลบ"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg></button>
        </div>
      </td>
    </tr>`).join("");
}

cSearch.addEventListener("input", () => { cCurrentPage = 1; renderCategories(); });

cTableBody.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  const tr = btn.closest("tr");
  const id = tr.dataset.id;
  const cat = allCategories.find(c => c.id === id);
  if (!cat) return;

  if (btn.dataset.action === "edit") openCategoryModal(cat);
  if (btn.dataset.action === "delete") {
    const inUse = allProducts.some(p => p.cat_id === id);
    if (inUse && !(await confirmDialog(`หมวดหมู่ "${cat.name}" มีสินค้าอยู่ในหมวดนี้ ลบหมวดหมู่จะทำให้สินค้าเหล่านั้นไม่มีหมวดหมู่ — ดำเนินการต่อหรือไม่?`, { title: "ลบหมวดหมู่" }))) return;
    if (!inUse && !(await confirmDialog(`ลบหมวดหมู่ "${cat.name}" ใช่หรือไม่?`, { title: "ลบหมวดหมู่" }))) return;
    deleteWithUndo({
      pendingSet: pendingDeleteCategoryIds, id, renderFn: renderCategories,
      message: `ลบหมวดหมู่ "${cat.name || ""}" แล้ว`,
      deleteFn: () => deleteCategory(id), onCommitted: reloadAll, targetType: "category"
    });
  }
});

cAddBtn.addEventListener("click", () => {
  if (!allGroups.length) {
    showToast("กรุณาเพิ่มหมวดหมู่ใหญ่อย่างน้อย 1 รายการก่อน");
    return;
  }
  openCategoryModal(null);
});
cCancelBtn.addEventListener("click", closeCategoryModal);
cOverlay.addEventListener("click", (e) => { if (e.target === cOverlay) closeCategoryModal(); });

// "+ เพิ่มหมวดหมู่ใหญ่ใหม่" ในโมดัลหมวดหมู่ย่อย — เก็บค่าที่กรอกไว้ในฟอร์มปัจจุบัน แล้วสลับ
// ไปเปิดโมดัลหมวดหมู่ใหญ่แทนชั่วคราว บันทึกเสร็จจะพากลับมาโมดัลนี้พร้อมเลือกหมวดหมู่ใหญ่ที่เพิ่งสร้างให้เอง
cGroupNewBtn.addEventListener("click", () => {
  setGroupReturnToCategoryDraft({
    id: document.getElementById("ad-c-id").value,
    name: document.getElementById("ad-c-name").value,
    icon: document.getElementById("ad-c-icon").value,
    description: document.getElementById("ad-c-desc").value,
    groupId: document.getElementById("ad-c-group").value,
    priorGroupIds: new Set(allGroups.map(g => g.id))
  });
  closeOverlay(cOverlay);
  openGroupModal(null);
});

function openCategoryModal(cat) {
  cModalTitle.textContent = cat ? "แก้ไขหมวดหมู่ย่อย" : "เพิ่มหมวดหมู่ย่อย";
  fillGroupSelect();
  document.getElementById("ad-c-id").value    = cat ? cat.id : "";
  document.getElementById("ad-c-name").value  = cat ? cat.name || "" : "";
  document.getElementById("ad-c-group").value = cat ? cat.group_id || "" : "";
  document.getElementById("ad-c-icon").value  = cat ? cat.icon || "" : "";
  document.getElementById("ad-c-desc").value  = cat ? cat.description || "" : "";
  openOverlay(cOverlay);
}

function closeCategoryModal() {
  closeOverlay(cOverlay);
  cForm.reset();
}

cForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = document.getElementById("ad-c-id").value;
  const groupId = document.getElementById("ad-c-group").value;
  const payload = {
    name: document.getElementById("ad-c-name").value.trim(),
    group_id: groupId,
    group: groupName(groupId), // เก็บชื่อซ้ำไว้ให้เมกะเมนู (nav-menu.js) ใช้ต่อได้เลย
    icon: document.getElementById("ad-c-icon").value.trim(),
    description: document.getElementById("ad-c-desc").value.trim()
  };
  if (id) payload.id = id;
  const btn = cForm.querySelector('button[type=submit]');
  btn.disabled = true; btn.textContent = "กำลังบันทึก...";
  try {
    await saveCategory(payload);
    closeCategoryModal();
    await reloadAll();
  } catch (err) {
    showToast("บันทึกไม่สำเร็จ: " + err.message);
  } finally {
    btn.disabled = false; btn.textContent = "บันทึก";
  }
});
