// ===========================
// js/admin-faq.js — FAQ
//
// 2026 refactor phase 2: ย้ายมาจาก js/admin-page.js เดิม (ส่วน "FAQ" บรรทัด
// 3300-3425 เดิม) แบบไม่เปลี่ยน behavior ใดๆ — เช็คด้วย diff กับต้นฉบับแล้วตรงทุกตัวอักษร
// ยกเว้นจุดที่ตั้งใจแยกไฟล์ (เพิ่ม `export` หน้า `renderFaqs`)
//
// export `renderFaqs()` ตามแผนเดิม
// ===========================
import { saveFaq, deleteFaq } from "./db-content.js";
import { confirmDialog } from "./ui-helpers.js";
import { showToast, openOverlay, closeOverlay, deleteWithUndo, escapeHtml, buildPageList } from "./admin-utils.js";
import { allFaqs, pendingDeleteFaqIds } from "./admin-state.js";
import { reloadAll } from "./admin-page.js";

const fTableBody = document.getElementById("ad-f-table-body");
const fAddBtn    = document.getElementById("ad-f-add-btn");
const fOverlay   = document.getElementById("ad-f-overlay");
const fForm      = document.getElementById("ad-f-form");
const fModalTitle = document.getElementById("ad-f-modal-title");
const fCancelBtn  = document.getElementById("ad-f-cancel");
const fPaginationBox  = document.getElementById("ad-f-pagination");
const fPaginationInfo = document.getElementById("ad-f-pagination-info");
const fPaginationBtns = document.getElementById("ad-f-pagination-btns");
const FAQ_PAGE_SIZE = 10;
let fCurrentPage = 1;
function renderFaqPagination(totalRows) {
  const totalPages = Math.max(1, Math.ceil(totalRows / FAQ_PAGE_SIZE));
  if (fCurrentPage > totalPages) fCurrentPage = totalPages;
  if (fCurrentPage < 1) fCurrentPage = 1;
  if (!totalRows) { fPaginationBox.style.display = "none"; return; }
  fPaginationBox.style.display = "flex";
  const start = (fCurrentPage - 1) * FAQ_PAGE_SIZE + 1;
  const end = Math.min(totalRows, fCurrentPage * FAQ_PAGE_SIZE);
  fPaginationInfo.textContent = `แสดง ${start}–${end} จาก ${totalRows} รายการ`;
  const pages = buildPageList(fCurrentPage, totalPages);
  fPaginationBtns.innerHTML = `
    <button class="cp-page-btn cp-page-nav" data-page="prev" ${fCurrentPage === 1 ? "disabled" : ""} aria-label="หน้าก่อนหน้า">‹</button>
    ${pages.map(p => p === "…"
      ? `<span class="cp-page-ellipsis">…</span>`
      : `<button class="cp-page-btn ${p === fCurrentPage ? "active" : ""}" data-page="${p}">${p}</button>`
    ).join("")}
    <button class="cp-page-btn cp-page-nav" data-page="next" ${fCurrentPage === totalPages ? "disabled" : ""} aria-label="หน้าถัดไป">›</button>
  `;
  fPaginationBtns.querySelectorAll(".cp-page-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      if (btn.disabled) return;
      if (btn.dataset.page === "prev") fCurrentPage = Math.max(1, fCurrentPage - 1);
      else if (btn.dataset.page === "next") fCurrentPage = Math.min(totalPages, fCurrentPage + 1);
      else fCurrentPage = Number(btn.dataset.page);
      renderFaqs();
      fTableBody.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  });
}

export function renderFaqs() {
  const filteredRows = allFaqs.filter(f => !pendingDeleteFaqIds.has(f.id));
  if (!allFaqs.length) {
    fTableBody.innerHTML = `<tr><td colspan="3" class="cp-empty">ยังไม่มีคำถามที่พบบ่อย — หน้าแรกจะแสดงชุดคำถามเริ่มต้นไปก่อน</td></tr>`;
    renderFaqPagination(0);
    return;
  }
  if (!filteredRows.length) {
    fTableBody.innerHTML = `<tr><td colspan="3" class="cp-empty">ไม่พบคำถามที่พบบ่อย</td></tr>`;
    renderFaqPagination(0);
    return;
  }
  renderFaqPagination(filteredRows.length);
  const fPageStart = (fCurrentPage - 1) * FAQ_PAGE_SIZE;
  const fRows = filteredRows.slice(fPageStart, fPageStart + FAQ_PAGE_SIZE);
  fTableBody.innerHTML = fRows.map(f => `
    <tr data-id="${f.id}">
      <td style="font-weight:700;">${escapeHtml(f.question || "")}</td>
      <td class="ad-l-msg" style="max-width:420px;">${escapeHtml(f.answer || "")}</td>
      <td>
        <div class="cp-row-actions">
          <button class="cp-icon-btn" data-action="edit" title="แก้ไข"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button>
          <button class="cp-icon-btn danger" data-action="delete" title="ลบ"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg></button>
        </div>
      </td>
    </tr>`).join("");
}

fTableBody.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  const tr = btn.closest("tr");
  const id = tr.dataset.id;
  const item = allFaqs.find(f => f.id === id);
  if (!item) return;
  if (btn.dataset.action === "edit") openFaqModal(item);
  if (btn.dataset.action === "delete") {
    if (!(await confirmDialog(`ลบคำถาม "${item.question}" ใช่หรือไม่?`, { title: "ลบคำถาม" }))) return;
    deleteWithUndo({
      pendingSet: pendingDeleteFaqIds, id, renderFn: renderFaqs,
      message: `ลบคำถาม "${item.question || ""}" แล้ว`,
      deleteFn: () => deleteFaq(id), onCommitted: reloadAll, targetType: "faq"
    });
  }
});

fAddBtn.addEventListener("click", () => openFaqModal(null));
fCancelBtn.addEventListener("click", closeFaqModal);
fOverlay.addEventListener("click", (e) => { if (e.target === fOverlay) closeFaqModal(); });

function openFaqModal(item) {
  fModalTitle.textContent = item ? "แก้ไขคำถาม" : "เพิ่มคำถาม";
  document.getElementById("ad-f-id").value       = item ? item.id : "";
  document.getElementById("ad-f-question").value = item ? item.question || "" : "";
  document.getElementById("ad-f-answer").value   = item ? item.answer || "" : "";
  openOverlay(fOverlay);
}

function closeFaqModal() {
  closeOverlay(fOverlay);
  fForm.reset();
}

fForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = document.getElementById("ad-f-id").value;
  const payload = {
    question: document.getElementById("ad-f-question").value.trim(),
    answer:   document.getElementById("ad-f-answer").value.trim()
  };
  if (id) payload.id = id;
  const btn = fForm.querySelector('button[type=submit]');
  btn.disabled = true; btn.textContent = "กำลังบันทึก...";
  try {
    await saveFaq(payload);
    closeFaqModal();
    await reloadAll();
  } catch (err) {
    showToast("บันทึกไม่สำเร็จ: " + err.message);
  } finally {
    btn.disabled = false; btn.textContent = "บันทึก";
  }
});
