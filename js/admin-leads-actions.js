// ===========================
// js/admin-leads-actions.js — แท็บ "ลีด": bulk actions (เลือกหลายแถว + ลบ/เปลี่ยน
// สถานะทีเดียว), การแก้ไขแถวเดียว (สถานะ/ผู้รับผิดชอบ/ลบ), โน้ตของทีมขาย, และ
// mark-as-read อัตโนมัติตอนคลิกแถว
//
// 2026 refactor phase 5: แยกออกมาจาก js/admin-leads.js เดิม (505 บรรทัด) — ย้ายส่วน
// "Bulk actions" (บรรทัด 324-405 เดิม) และส่วน per-row edit handlers/โน้ต/mark-as-read
// (บรรทัด 411-505 เดิม) ไปทั้งหมดแบบ diff เป๊ะ ไม่มีเปลี่ยน logic — ไฟล์ admin-leads.js
// ยังคงมีตาราง/ค้นหา/กรอง/pagination/renderLeads() เหมือนเดิม (ดูหมายเหตุที่หัวไฟล์นั้น)
//
// จุดตัดไฟล์: เว้นส่วน "ตัวกรอง/ค้นหา" (lSearch/lFilterSource/lFilterAssignee
// addEventListener, บรรทัด 407-409 เดิม) ไว้ที่ admin-leads.js เพราะเป็นส่วนของ
// filter/pagination core ไม่ใช่ action — ไฟล์นี้จึง "ข้าม" ช่วงนั้นไป (บรรทัดก่อนหน้า
// จบที่ bulk delete button, บรรทัดถัดไปเริ่มที่ per-row status change handler)
//
// ไม่ export อะไรให้ไฟล์อื่นนอกเหนือ admin-leads.js เรียกใช้ ยกเว้น updateLeadsBulkBar()
// (admin-leads.js ต้องเรียกท้าย renderLeads() เหมือนเดิม) และ selectedLeadIds (Set —
// admin-leads.js ต้องอ่านตอน render แถว เพื่อเช็คว่า checkbox ควรติ๊กอยู่ไหม) — ทั้งคู่
// import กลับจากไฟล์นี้แบบ circular import (ปลอดภัยแบบเดียวกับที่มีอยู่แล้วในโปรเจกต์
// เช่น orders-tab.js ↔ orders-tab-kanban.js) เพราะเรียก/อ่านตอน event หรือ render
// ทำงานเท่านั้น ไม่ใช่ตอน module evaluate — selectedLeadIds เป็น Set ที่ถูก mutate
// ในที่ (add/delete/clear) ไม่เคย reassign ตัวแปรเอง จึงไม่ต้องมี setter
//
// [รอบที่ 54] lTableBody เดิม import กลับจาก admin-leads.js เหมือนกัน แต่ไฟล์นี้เรียกใช้
// `lTableBody.addEventListener(...)` ตรงๆ ที่ top-level (ไม่ได้อยู่ในฟังก์ชัน/event handler
// เหมือน allLeads/renderLeads ข้างบน) — พอ admin-leads.js เป็นฝ่าย import ไฟล์นี้ก่อน (เพื่อ
// เอา selectedLeadIds/updateLeadsBulkBar) การ evaluate module แบบ circular ทำให้ตอนไฟล์นี้
// รันถึงบรรทัดนี้ admin-leads.js ยังไปไม่ถึงบรรทัด `export const lTableBody = ...` ของตัวเอง
// เลย (spec ES module ต้อง evaluate dependency ทั้งหมดให้จบก่อนถึงจะรันโค้ดของตัวเองได้ ไม่ใช่
// แค่เรื่องลำดับบรรทัด import) → ได้ "Cannot access 'lTableBody' before initialization"
// (พบและวิเคราะห์เจาะลึกในรอบ 53/54) แก้โดย query DOM id เดียวกันเองตรงๆ แทนการ import กลับ
// (เป็นแค่ DOM ref ธรรมดา ไม่ใช่ state ที่ต้องแชร์ข้ามไฟล์ — แพทเทิร์นเดียวกับที่ทำไปแล้วกับ
// tabsBox ใน admin-sidebar.js ตอนรอบ 30) ตัด lTableBody ออกจาก import ข้างล่าง ไม่กระทบ
// behavior เลยเพราะเป็น element เดียวกัน id เดียวกันเป๊ะ
// ===========================
import { updateLeadStatus, updateLeadNotes, updateLeadAssignee, deleteLead } from "./db-orders.js";
import { confirmDialog } from "./ui-helpers.js";
import { showToast, openOverlay, closeOverlay, deleteWithUndo } from "./admin-utils.js";
import { pendingDeleteLeadIds } from "./admin-state.js";
import { allLeads, renderLeads } from "./admin-leads.js";

// DOM ref ของตัวเอง ไม่ import กลับจาก admin-leads.js (ดูหมายเหตุรอบ 54 ด้านบน) — id เดียวกับ
// ที่ admin-leads.js ใช้ประกาศ lTableBody ของตัวเองเป๊ะ
const lTableBody = document.getElementById("ad-l-table-body");

// ── Bulk actions (เลือกหลายแถว + ลบ/เปลี่ยนสถานะทีเดียว) ──────────────────────────────
const lBulkBar          = document.getElementById("ad-l-bulk-bar");
const lBulkCount        = document.getElementById("ad-l-bulk-count");
const lBulkClearBtn     = document.getElementById("ad-l-bulk-clear");
const lBulkStatusSelect = document.getElementById("ad-l-bulk-status-select");
const lBulkApplyBtn     = document.getElementById("ad-l-bulk-apply-status");
const lBulkDeleteBtn    = document.getElementById("ad-l-bulk-delete");
const lHeadCheck        = document.getElementById("ad-l-head-check");

// bulk actions: id ที่ถูกเลือก (คงอยู่ข้ามการ re-render/หน้า) — export ให้ admin-leads.js
// อ่านตอน render แถว (เช็คว่า checkbox ควรติ๊กอยู่ไหม)
export let selectedLeadIds = new Set();

export function updateLeadsBulkBar() {
  if (!lBulkBar) return;
  lBulkCount.textContent = selectedLeadIds.size;
  lBulkBar.classList.toggle("active", selectedLeadIds.size > 0);
  if (lHeadCheck) {
    const rowChecks = Array.from(lTableBody.querySelectorAll(".ad-l-row-check"));
    lHeadCheck.checked = rowChecks.length > 0 && rowChecks.every(cb => cb.checked);
  }
}

lTableBody.addEventListener("change", (e) => {
  if (!e.target.classList.contains("ad-l-row-check")) return;
  const id = e.target.dataset.id;
  if (e.target.checked) selectedLeadIds.add(id); else selectedLeadIds.delete(id);
  updateLeadsBulkBar();
});

if (lHeadCheck) {
  lHeadCheck.addEventListener("change", () => {
    lTableBody.querySelectorAll(".ad-l-row-check").forEach(cb => {
      cb.checked = lHeadCheck.checked;
      if (lHeadCheck.checked) selectedLeadIds.add(cb.dataset.id); else selectedLeadIds.delete(cb.dataset.id);
    });
    updateLeadsBulkBar();
  });
}

if (lBulkClearBtn) {
  lBulkClearBtn.addEventListener("click", () => {
    selectedLeadIds.clear();
    lTableBody.querySelectorAll(".ad-l-row-check").forEach(cb => { cb.checked = false; });
    updateLeadsBulkBar();
  });
}

if (lBulkApplyBtn) {
  lBulkApplyBtn.addEventListener("click", async () => {
    const status = lBulkStatusSelect.value;
    if (!status || !selectedLeadIds.size) return;
    const ids = Array.from(selectedLeadIds);
    lBulkApplyBtn.disabled = true;
    try {
      await Promise.all(ids.map(id => updateLeadStatus(id, status)));
      showToast(`เปลี่ยนสถานะแล้ว ${ids.length} รายการ`, "success");
      selectedLeadIds.clear();
      lBulkStatusSelect.value = "";
    } catch (err) {
      showToast("อัปเดตสถานะไม่สำเร็จ: " + err.message);
    } finally {
      lBulkApplyBtn.disabled = false;
      updateLeadsBulkBar();
    }
  });
}

if (lBulkDeleteBtn) {
  lBulkDeleteBtn.addEventListener("click", async () => {
    if (!selectedLeadIds.size) return;
    const ids = Array.from(selectedLeadIds);
    if (!(await confirmDialog(`ลบลีดที่เลือก ${ids.length} รายการ? ไม่สามารถกู้คืนได้`, { title: "ลบหลายรายการ" }))) return;
    lBulkDeleteBtn.disabled = true;
    try {
      await Promise.all(ids.map(id => deleteLead(id)));
      showToast(`ลบแล้ว ${ids.length} รายการ`, "success");
      selectedLeadIds.clear();
    } catch (err) {
      showToast("ลบไม่สำเร็จ: " + err.message);
    } finally {
      lBulkDeleteBtn.disabled = false;
      updateLeadsBulkBar();
    }
  });
}

lTableBody.addEventListener("change", async (e) => {
  if (!e.target.classList.contains("ad-l-status")) return;
  const id = e.target.dataset.id;
  const newStatus = e.target.value;
  e.target.dataset.status = newStatus;
  try {
    await updateLeadStatus(id, newStatus);
  } catch (err) {
    showToast("อัปเดตสถานะไม่สำเร็จ: " + err.message);
  }
});

lTableBody.addEventListener("change", async (e) => {
  if (!e.target.classList.contains("ad-l-assignee")) return;
  const id = e.target.dataset.id;
  const newAssignee = e.target.value;
  const select = e.target;
  select.disabled = true;
  try {
    await updateLeadAssignee(id, newAssignee);
    showToast(newAssignee ? `มอบหมายให้ "${newAssignee}" แล้ว` : "เอาผู้รับผิดชอบออกแล้ว", "success");
  } catch (err) {
    showToast("มอบหมายไม่สำเร็จ: " + err.message);
  } finally {
    select.disabled = false;
  }
});

lTableBody.addEventListener("click", async (e) => {
  const btn = e.target.closest(".ad-l-delete");
  if (!btn) return;
  const id = btn.dataset.id;
  if (!(await confirmDialog("ลบลีดรายการนี้? ไม่สามารถกู้คืนได้", { title: "ลบลีด" }))) return;
  deleteWithUndo({
    pendingSet: pendingDeleteLeadIds, id, renderFn: renderLeads,
    message: "ลบลีดแล้ว",
    deleteFn: () => deleteLead(id), targetType: "lead"
    // ไม่ต้องส่ง onCommitted — listenLeads() (realtime) จะอัปเดต allLeads และ render ใหม่เองอยู่แล้ว
  });
});

// ── โน้ตของทีมขาย ──────────────────────────────
const lNotesOverlay = document.getElementById("ad-l-notes-overlay");
const lNotesForm    = document.getElementById("ad-l-notes-form");
const lNotesName    = document.getElementById("ad-l-notes-name");
const lNotesSummary = document.getElementById("ad-l-notes-summary");
const lNotesId      = document.getElementById("ad-l-notes-id");
const lNotesText    = document.getElementById("ad-l-notes-text");

lTableBody.addEventListener("click", (e) => {
  const btn = e.target.closest(".ad-l-notes-btn");
  if (!btn) return;
  const lead = allLeads.find(l => l.id === btn.dataset.id);
  if (!lead) return;
  lNotesId.value = lead.id;
  lNotesName.textContent = lead.name || lead.company || "ไม่ระบุชื่อ";
  lNotesSummary.textContent = [lead.tel || lead.phone, lead.email, lead.service].filter(Boolean).join(" · ");
  lNotesText.value = lead.notes || "";
  openOverlay(lNotesOverlay);
  lNotesText.focus();
});

document.getElementById("ad-l-notes-cancel").addEventListener("click", () => {
  closeOverlay(lNotesOverlay);
  lNotesForm.reset();
});
lNotesOverlay.addEventListener("click", (e) => {
  if (e.target === lNotesOverlay) { closeOverlay(lNotesOverlay); lNotesForm.reset(); }
});

lNotesForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = lNotesForm.querySelector('button[type=submit]');
  btn.disabled = true; btn.textContent = "กำลังบันทึก...";
  try {
    await updateLeadNotes(lNotesId.value, lNotesText.value.trim());
    closeOverlay(lNotesOverlay);
    lNotesForm.reset();
  } catch (err) {
    showToast("บันทึกโน้ตไม่สำเร็จ: " + err.message);
  } finally {
    btn.disabled = false; btn.textContent = "บันทึกโน้ต";
  }
});

// แตะที่แถวเพื่อ mark-as-read อัตโนมัติ (ยกเว้นตอนกดที่ select/ปุ่มลบ)
lTableBody.addEventListener("click", async (e) => {
  if (e.target.closest("select") || e.target.closest("button") || e.target.closest("input")) return;
  const row = e.target.closest(".ad-l-row");
  if (!row) return;
  const lead = allLeads.find(l => l.id === row.dataset.id);
  if (lead && (lead.status || "new") === "new") {
    try { await updateLeadStatus(lead.id, "read"); } catch (err) { console.error(err); }
  }
});
