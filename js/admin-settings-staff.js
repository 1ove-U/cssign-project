// ===========================
// js/admin-settings-staff.js — SETTINGS — บัญชีผู้ใช้ทีมงาน (staff/{uid}.role) — สิทธิ์ admin
// (ลบได้ทุกอย่าง) vs staff (แก้ไขได้แต่ลบไม่ได้) บังคับจริงฝั่ง Firestore rules; ฝั่งนี้แค่เป็น
// หน้าจอจัดการ
//
// 2026 refactor phase 2: ย้ายมาจาก js/admin-page.js เดิม (ส่วน "SETTINGS — บัญชีผู้ใช้ทีมงาน"
// บรรทัด 4240-4316 เดิม) แบบไม่เปลี่ยน behavior ใดๆ — เช็คด้วย diff กับต้นฉบับแล้วตรงทุกตัวอักษร
// ยกเว้นจุดที่ตั้งใจแยกไฟล์ (เพิ่ม `export` หน้า `renderStaffList`)
//
// export `renderStaffList()` ตามแผนเดิม
// ===========================
import { listStaff, upsertStaffRole, removeStaffRole, logAudit } from "./db.js";
import { confirmDialog, errorStateHTML } from "./ui-helpers.js";
import { showToast, escapeHtml, deleteWithUndo } from "./admin-utils.js";
import { pendingDeleteStaffUids } from "./admin-state.js";

const staffForm      = document.getElementById("ad-staff-form");
const staffUidInput  = document.getElementById("ad-staff-uid");
const staffNameInput = document.getElementById("ad-staff-name");
const staffEmailInput= document.getElementById("ad-staff-email");
const staffRoleSelect= document.getElementById("ad-staff-role");
const staffListBox   = document.getElementById("ad-staff-list");

const roleLabel = (role) => role === "admin" ? "admin" : role === "production" ? "production" : "staff";

export async function renderStaffList() {
  if (!staffListBox) return;
  staffListBox.innerHTML = `<div class="ad-team-empty">กำลังโหลด…</div>`;
  try {
    const staff = (await listStaff()).filter(s => !pendingDeleteStaffUids.has(s.uid));
    if (!staff.length) {
      staffListBox.innerHTML = `<div class="ad-team-empty">ยังไม่มีใครถูกกำหนดสิทธิ์ไว้ — ทุกบัญชีที่ล็อกอินได้ถือเป็น admin ไปก่อน</div>`;
      return;
    }
    staffListBox.innerHTML = staff.map(s => `
      <div class="ad-staff-row" data-uid="${escapeHtml(s.uid)}">
        <span class="ad-staff-name">${escapeHtml(s.name || "(ไม่ระบุชื่อ)")}</span>
        <span class="ad-staff-email">${escapeHtml(s.email || "")}</span>
        <span class="ad-staff-role-badge ${s.role === "admin" ? "" : "role-staff"}">${roleLabel(s.role)}</span>
        <button type="button" class="ad-staff-remove" data-uid="${escapeHtml(s.uid)}" title="เอาออกจากรายชื่อ (กลับไปนับเป็น admin เหมือนยังไม่ตั้งค่า)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </div>`).join("");
  } catch (err) {
    staffListBox.innerHTML = errorStateHTML(`โหลดรายชื่อไม่สำเร็จ: ${err.message || ""}`, renderStaffList, { wrapTag: "div" });
  }
}

if (staffForm) {
  staffForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const uid = staffUidInput.value.trim();
    if (!uid) return;
    const name = staffNameInput.value.trim();
    const email = staffEmailInput.value.trim();
    const role = staffRoleSelect.value;
    const btn = staffForm.querySelector('button[type=submit]');
    btn.disabled = true;
    try {
      await upsertStaffRole({ uid, name, email, role });
      logAudit("update", "staff-role", uid, `${name || email || uid} → ${role}`);
      staffUidInput.value = ""; staffNameInput.value = ""; staffEmailInput.value = "";
      staffRoleSelect.value = "staff";
      await renderStaffList();
      showToast("บันทึกสิทธิ์แล้ว", "success");
    } catch (err) {
      showToast("บันทึกไม่สำเร็จ: " + err.message);
    } finally {
      btn.disabled = false;
    }
  });
}

if (staffListBox) {
  staffListBox.addEventListener("click", async (e) => {
    const btn = e.target.closest(".ad-staff-remove");
    if (!btn) return;
    const uid = btn.dataset.uid;
    const row = btn.closest(".ad-staff-row");
    const staffName = row ? (row.querySelector(".ad-staff-name")?.textContent || "") : "";
    if (!(await confirmDialog("เอาสิทธิ์คนนี้ออกจากรายชื่อ? (บัญชียัง login ได้ปกติ แค่ไม่มี role กำหนดไว้แล้ว)", { title: "ลบบัญชีผู้ใช้ทีมงาน" }))) return;
    deleteWithUndo({
      pendingSet: pendingDeleteStaffUids, id: uid, renderFn: renderStaffList,
      message: `ลบสิทธิ์ของ "${staffName || uid}" แล้ว`,
      deleteFn: () => removeStaffRole(uid), onCommitted: renderStaffList, targetType: "staff-role"
    });
  });
}
