// ===========================
// js/admin-groups.js — หมวดหมู่ใหญ่ (GROUPS) — ชั้นบนสุด: หมวดหมู่ใหญ่ > หมวดหมู่ย่อย > รายการสินค้า
//
// 2026 refactor phase 2: ย้ายมาจาก js/admin-page.js เดิม (ส่วน "GROUPS" บรรทัด 2237-2373
// เดิม) แบบไม่เปลี่ยน behavior ใดๆ — เช็คด้วย diff กับต้นฉบับแล้วตรงทุกตัวอักษรยกเว้นจุดที่
// ตั้งใจแยกไฟล์ (ดูด้านล่าง)
//
// export `fillGroupSelect()`, `renderGroups()` ตามแผนเดิม — เพิ่ม export `openGroupModal()`
// และ `setGroupReturnToCategoryDraft()` เพราะปุ่ม "+ เพิ่มหมวดหมู่ใหญ่ใหม่" ใน
// admin-categories.js (ยังไม่สร้าง) ต้องเรียกทั้งสองตัวนี้ข้ามไฟล์:
//   cGroupNewBtn.addEventListener("click", () => {
//     setGroupReturnToCategoryDraft({ ...ค่าฟอร์มหมวดหมู่ย่อยปัจจุบัน... });
//     closeOverlay(cOverlay);
//     openGroupModal(null);
//   });
// (เดิมโค้ดส่วนนี้ assign ตัวแปร gReturnToCategoryDraft ตรงๆ เพราะอยู่ไฟล์เดียวกัน —
// พอแยกไฟล์ ตัวแปรนี้เป็น private state ของไฟล์นี้ จึงต้องมี setter ให้เรียกจากนอกไฟล์แทน)
//
// `groupName(id)` ถูกย้ายไป admin-utils.js แล้วตั้งแต่ตอนแตก admin-products.js (ไม่ได้ใช้ในไฟล์นี้
// เอง แต่ admin-categories.js/global-search จะ import จาก admin-utils.js โดยตรง ไม่ต้องมาสร้างซ้ำที่นี่)
//
// `cOverlay`/`cModalTitle` ใน reopenCategoryDraft() ด้านล่าง query ผ่าน document.getElementById()
// ตรงๆ (แทนที่จะ import DOM node ข้ามไฟล์จาก admin-categories.js) เพราะเป็นแค่ DOM lookup
// เฉยๆ ไม่ใช่ state ที่ต้องซิงก์กัน — ปลอดภัยและเรียบง่ายกว่า
// ===========================
import { getGroups, saveGroup, deleteGroup } from "./db-taxonomy.js";
import { confirmDialog } from "./ui-helpers.js";
import { showToast, openOverlay, closeOverlay, deleteWithUndo, escapeHtml } from "./admin-utils.js";
import { allGroups, allCategories, pendingDeleteGroupIds, pendingDeleteCategoryIds } from "./admin-state.js";
import { reloadAll } from "./admin-page.js";

const gTableBody   = document.getElementById("ad-g-table-body");
const gAddBtn      = document.getElementById("ad-g-add-btn");
const gOverlay     = document.getElementById("ad-g-overlay");
const gForm        = document.getElementById("ad-g-form");
const gModalTitle  = document.getElementById("ad-g-modal-title");
const gCancelBtn   = document.getElementById("ad-g-cancel");

// ตั้งค่าไว้ตอนเปิดโมดัลหมวดหมู่ใหญ่จากปุ่ม "+ เพิ่มหมวดหมู่ใหญ่ใหม่" ในโมดัลหมวดหมู่ย่อย
// เพื่อจำค่าที่กรอกในโมดัลหมวดหมู่ย่อยไว้ แล้วเปิดกลับพร้อมเลือกหมวดหมู่ใหญ่ที่เพิ่งสร้างให้อัตโนมัติ
let gReturnToCategoryDraft = null;
export function setGroupReturnToCategoryDraft(draft) { gReturnToCategoryDraft = draft; }

export function renderGroups() {
  if (!allGroups.length) {
    gTableBody.innerHTML = `<tr><td colspan="4" class="cp-empty">ยังไม่มีหมวดหมู่ใหญ่ — เพิ่มอย่างน้อย 1 รายการก่อนสร้างหมวดหมู่ย่อย</td></tr>`;
    return;
  }
  const rows = allGroups.filter(g => !pendingDeleteGroupIds.has(g.id));
  gTableBody.innerHTML = rows.map(g => {
    const subCount = allCategories.filter(c => c.group_id === g.id && !pendingDeleteCategoryIds.has(c.id)).length;
    return `
    <tr data-id="${g.id}">
      <td style="font-size:18px;">${escapeHtml(g.icon || "🗂️")}</td>
      <td>${escapeHtml(g.name || "")}</td>
      <td><span class="ad-g-badge">${subCount} หมวดหมู่ย่อย</span></td>
      <td>
        <div class="cp-row-actions">
          <button class="cp-icon-btn" data-action="edit" title="แก้ไข"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button>
          <button class="cp-icon-btn danger" data-action="delete" title="ลบ"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg></button>
        </div>
      </td>
    </tr>`;
  }).join("");
}

export function fillGroupSelect() {
  const sel = document.getElementById("ad-c-group");
  if (!sel) return;
  const prev = sel.value;
  const opts = allGroups.map(g => `<option value="${g.id}">${escapeHtml(g.name)}</option>`).join("");
  sel.innerHTML = opts || `<option value="">— ยังไม่มีหมวดหมู่ใหญ่ —</option>`;
  if (prev && allGroups.some(g => g.id === prev)) sel.value = prev;
}

gTableBody.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  const tr = btn.closest("tr");
  const id = tr.dataset.id;
  const group = allGroups.find(g => g.id === id);
  if (!group) return;

  if (btn.dataset.action === "edit") openGroupModal(group);
  if (btn.dataset.action === "delete") {
    const inUse = allCategories.some(c => c.group_id === id);
    if (inUse && !(await confirmDialog(`หมวดหมู่ใหญ่ "${group.name}" มีหมวดหมู่ย่อยอยู่ภายใน ลบแล้วหมวดหมู่ย่อยเหล่านั้นจะไม่มีหมวดหมู่ใหญ่ — ดำเนินการต่อหรือไม่?`, { title: "ลบหมวดหมู่ใหญ่" }))) return;
    if (!inUse && !(await confirmDialog(`ลบหมวดหมู่ใหญ่ "${group.name}" ใช่หรือไม่?`, { title: "ลบหมวดหมู่ใหญ่" }))) return;
    deleteWithUndo({
      pendingSet: pendingDeleteGroupIds, id, renderFn: renderGroups,
      message: `ลบหมวดหมู่ใหญ่ "${group.name || ""}" แล้ว`,
      deleteFn: () => deleteGroup(id), onCommitted: reloadAll, targetType: "group"
    });
  }
});

gAddBtn.addEventListener("click", () => openGroupModal(null));
gCancelBtn.addEventListener("click", closeGroupModal);
gOverlay.addEventListener("click", (e) => { if (e.target === gOverlay) closeGroupModal(); });

export function openGroupModal(group) {
  gModalTitle.textContent = group ? "แก้ไขหมวดหมู่ใหญ่" : "เพิ่มหมวดหมู่ใหญ่";
  document.getElementById("ad-g-id").value   = group ? group.id : "";
  document.getElementById("ad-g-name").value = group ? group.name || "" : "";
  document.getElementById("ad-g-icon").value = group ? group.icon || "" : "";
  openOverlay(gOverlay);
}

function closeGroupModal() {
  closeOverlay(gOverlay);
  gForm.reset();
  // ถ้าถูกเปิดจากปุ่มลัดในโมดัลหมวดหมู่ย่อย แล้วผู้ใช้กด "ยกเลิก" แทนที่จะบันทึก
  // ให้เปิดโมดัลหมวดหมู่ย่อยเดิมกลับมาพร้อมค่าที่เคยกรอกไว้ ไม่ให้ข้อมูลหาย
  if (gReturnToCategoryDraft) {
    reopenCategoryDraft();
  }
}

gForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = document.getElementById("ad-g-id").value;
  const payload = { name: document.getElementById("ad-g-name").value.trim(),
                     icon: document.getElementById("ad-g-icon").value.trim() };
  if (id) payload.id = id;
  const btn = gForm.querySelector('button[type=submit]');
  btn.disabled = true; btn.textContent = "กำลังบันทึก...";
  try {
    await saveGroup(payload);
    const draft = gReturnToCategoryDraft;
    gReturnToCategoryDraft = null; // ปิดก่อน reload กัน closeGroupModal เปิดโมดัลเดิมซ้ำ
    closeOverlay(gOverlay);
    gForm.reset();
    const [groups] = await Promise.all([getGroups(), reloadAll()]);
    if (draft) {
      // หมวดหมู่ใหม่ล่าสุดคือรายการที่ยังไม่มีในลิสต์เดิมของ draft
      const created = groups.find(g => !draft.priorGroupIds.has(g.id));
      reopenCategoryDraft(draft, created ? created.id : "");
    }
  } catch (err) {
    showToast("บันทึกไม่สำเร็จ: " + err.message);
  } finally {
    btn.disabled = false; btn.textContent = "บันทึก";
  }
});

function reopenCategoryDraft(draft, selectGroupId) {
  const d = draft || gReturnToCategoryDraft;
  gReturnToCategoryDraft = null;
  if (!d) return;
  document.getElementById("ad-c-id").value    = d.id;
  document.getElementById("ad-c-name").value  = d.name;
  document.getElementById("ad-c-icon").value  = d.icon;
  document.getElementById("ad-c-desc").value  = d.description;
  document.getElementById("ad-c-modal-title").textContent = d.id ? "แก้ไขหมวดหมู่ย่อย" : "เพิ่มหมวดหมู่ย่อย";
  openOverlay(document.getElementById("ad-c-overlay"));
  fillGroupSelect();
  const sel = document.getElementById("ad-c-group");
  if (selectGroupId) sel.value = selectGroupId;
  else if (d.groupId) sel.value = d.groupId;
}
