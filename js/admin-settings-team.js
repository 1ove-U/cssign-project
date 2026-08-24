// ===========================
// js/admin-settings-team.js — SETTINGS — ทีมงาน (รายชื่อผู้รับผิดชอบลีด)
// เก็บเป็น settings.teamMembers: string[]
//
// 2026 refactor phase 2: ย้ายมาจาก js/admin-page.js เดิม (ส่วน "SETTINGS — ทีมงาน" บรรทัด
// 4167-4239 เดิม) แบบไม่เปลี่ยน behavior ใดๆ — เช็คด้วย diff กับต้นฉบับแล้วตรงทุกตัวอักษร
// ยกเว้นจุดที่ตั้งใจแยกไฟล์ (เพิ่ม `export` หน้า `renderTeamSettings` และ `currentTeamMembers`)
//
// export `renderTeamSettings()`, `currentTeamMembers` (`let` — admin-leads.js import ไปใช้เติม
// dropdown ผู้รับผิดชอบ เป็น circular import แบบเดียวกับ allLeads/switchTab ที่มีอยู่แล้วในไฟล์อื่น
// ปลอดภัยเพราะเรียกใช้ตอน event/render ทำงานเท่านั้น ไม่ใช่ตอน module evaluate)
//
// เพิ่มเติม (Phase 3, CRM automation): เก็บ 2 ค่าใหม่ไว้ใน settings/main doc เดิม (ตัดสินใจแล้วว่า
// ไม่แยก doc ใหม่ เพื่อให้ยังอ่าน/บันทึกได้ในจุดเดียวกับ teamMembers ด้วย saveSettings merge:true
// เหมือนเดิม ไม่ต้องเพิ่ม read อีก 1 รอบตอนโหลดหน้า):
//   - settings.leadReminderDays (number) — ตั้งค่าได้ในฟอร์มด้านล่างนี้ ใช้โดย getStaleLeadReminders
//     (admin-leads.js) แสดง badge "ค้างนาน" ในตารางลีด
//   - settings.leadAssignRoundRobinIndex (number) — ตัวชี้รอบล่าสุดที่ auto-assign ไปคนไหน
//     (admin-leads-automation.js) ไม่มี UI ให้แก้เอง เป็น internal bookkeeping ล้วนๆ
// ===========================
import { saveSettings } from "./db-settings.js";
import { logAudit } from "./db.js";
import { confirmDialog } from "./ui-helpers.js";
import { showToast, escapeHtml } from "./admin-utils.js";
import { allLeads, fillAssigneeSelects, renderLeads } from "./admin-leads.js";

const teamForm  = document.getElementById("ad-team-form");
const teamInput = document.getElementById("ad-team-input");
const teamList  = document.getElementById("ad-team-list");
export let currentTeamMembers = []; // เก็บ snapshot ล่าสุดไว้ใช้เติม dropdown ผู้รับผิดชอบในแท็บลีด

export function getTeamMembers() { return currentTeamMembers; }

// ── ตั้งค่าแจ้งเตือนลีดค้างนาน (N วัน) + ตัวชี้ round-robin ── (Phase 3, CRM automation)
const reminderForm  = document.getElementById("ad-lead-reminder-form");
const reminderInput = document.getElementById("ad-lead-reminder-days");
const DEFAULT_LEAD_REMINDER_DAYS = 3;
export let leadReminderDays = DEFAULT_LEAD_REMINDER_DAYS;
// ไม่มี UI ให้แก้ตรงๆ (internal bookkeeping ของ auto-assign เท่านั้น) — เริ่มที่ -1 แปลว่า
// "ยังไม่เคย auto-assign เลย" รอบแรกจะได้เริ่มที่คนแรก (index 0) ของ currentTeamMembers
export let leadAssignRoundRobinIndex = -1;
// setter ให้ admin-leads-automation.js เรียกหลัง auto-assign แต่ละครั้ง (reassign import
// binding ตรงๆ ไม่ได้ — แพทเทิร์นเดียวกับ setLCurrentPage ใน admin-leads.js) — บันทึกลง
// settings/main ทันทีด้วย เพื่อให้รอบถัดไปสืบต่อได้แม้ปิดหน้าแล้วเปิดใหม่/คนละเครื่อง
export async function setLeadAssignRoundRobinIndex(v) {
  leadAssignRoundRobinIndex = v;
  await saveSettings({ leadAssignRoundRobinIndex: v });
}

export function renderTeamSettings(settings) {
  currentTeamMembers = (settings && Array.isArray(settings.teamMembers)) ? settings.teamMembers : [];
  if (!currentTeamMembers.length) {
    teamList.innerHTML = `<div class="ad-team-empty">ยังไม่มีรายชื่อ — เพิ่มชื่อพนักงานคนแรกด้านบน</div>`;
  } else {
    teamList.innerHTML = currentTeamMembers.map(name => `
      <span class="ad-team-chip">
        ${escapeHtml(name)}
        <button type="button" class="ad-team-remove" data-name="${escapeHtml(name)}" title="ลบชื่อนี้ออก">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </span>`).join("");
  }
  leadReminderDays = (settings && Number.isFinite(settings.leadReminderDays) && settings.leadReminderDays > 0)
    ? settings.leadReminderDays : DEFAULT_LEAD_REMINDER_DAYS;
  if (reminderInput) reminderInput.value = leadReminderDays;
  leadAssignRoundRobinIndex = (settings && Number.isFinite(settings.leadAssignRoundRobinIndex))
    ? settings.leadAssignRoundRobinIndex : -1;
  fillAssigneeSelects();
  renderLeads();
}

async function saveTeamMembers(next, auditMsg) {
  currentTeamMembers = next;
  await saveSettings({ teamMembers: next });
  renderTeamSettings({ teamMembers: next });
  if (auditMsg) logAudit("update", "team-members", "", auditMsg);
}

if (teamForm) {
  teamForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = teamInput.value.trim();
    if (!name) return;
    if (currentTeamMembers.includes(name)) { teamInput.value = ""; return; }
    const btn = teamForm.querySelector('button[type=submit]');
    btn.disabled = true;
    try {
      await saveTeamMembers([...currentTeamMembers, name], `เพิ่ม "${name}"`);
      teamInput.value = "";
    } catch (err) {
      showToast("เพิ่มชื่อไม่สำเร็จ: " + err.message);
    } finally {
      btn.disabled = false;
    }
  });
}

if (teamList) {
  teamList.addEventListener("click", async (e) => {
    const btn = e.target.closest(".ad-team-remove");
    if (!btn) return;
    const name = btn.dataset.name;
    // ถ้ามีลีดที่ผู้รับผิดชอบคนนี้ถืออยู่ ให้ถามยืนยันก่อน เพราะลบชื่อออกจากรายชื่อกลางแล้ว
    // ลีดที่เคยมอบหมายไว้จะยังเก็บชื่อเดิมค้างอยู่ (แค่เลือกใหม่ไม่ได้จาก dropdown เท่านั้น)
    const inUse = allLeads.some(l => l.assignee === name);
    if (inUse && !(await confirmDialog(
      `"${name}" ยังมีลีดที่มอบหมายไว้อยู่ — ลบชื่อออกจากรายชื่อทีมงานจะทำให้เลือกชื่อนี้ใหม่ไม่ได้ (ลีดเดิมจะยังโชว์ชื่อนี้ค้างไว้) ดำเนินการต่อหรือไม่?`,
      { title: "ลบรายชื่อทีมงาน" }
    ))) return;
    try {
      await saveTeamMembers(currentTeamMembers.filter(n => n !== name), `ลบ "${name}"`);
    } catch (err) {
      showToast("ลบชื่อไม่สำเร็จ: " + err.message);
    }
  });
}

// จำนวนวันที่ถ้าลีด (สถานะ "อ่านแล้ว"/"ติดต่อแล้ว") ไม่มีการอัปเดตโน้ต/สถานะเลย จะถือว่า "ค้างนาน"
// (แสดง badge ในตารางลีด — ดู getStaleLeadReminders() ใน admin-leads.js) ตั้งค่าได้ที่นี่แทนที่จะ
// hardcode ตามที่โจทย์ระบุ
if (reminderForm) {
  reminderForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const days = parseInt(reminderInput.value, 10);
    if (!Number.isFinite(days) || days <= 0) {
      showToast("กรอกจำนวนวันเป็นตัวเลขที่มากกว่า 0");
      return;
    }
    const btn = reminderForm.querySelector('button[type=submit]');
    btn.disabled = true;
    try {
      leadReminderDays = days;
      await saveSettings({ leadReminderDays: days });
      logAudit("update", "lead-reminder-days", "", `ตั้งค่าแจ้งเตือนลีดค้างนานเป็น ${days} วัน`);
      renderLeads(); // อัปเดต badge "ค้างนาน" ในตารางลีดทันทีด้วยเกณฑ์ใหม่
      showToast("บันทึกแล้ว", "success");
    } catch (err) {
      showToast("บันทึกไม่สำเร็จ: " + err.message);
    } finally {
      btn.disabled = false;
    }
  });
}
