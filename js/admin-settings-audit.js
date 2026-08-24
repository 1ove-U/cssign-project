// ===========================
// js/admin-settings-audit.js — SETTINGS — ประวัติการทำงาน (Audit Log) — อ่านอย่างเดียว,
// ดูได้เฉพาะ role admin (ถ้าไม่มีสิทธิ์ Firestore rules จะปฏิเสธการอ่านเอง ฝั่งนี้แค่โชว์
// error message)
//
// 2026 refactor phase 2: ย้ายมาจาก js/admin-page.js เดิม (ส่วน "SETTINGS — ประวัติการทำงาน"
// บรรทัด 4317-4452 เดิม) แบบไม่เปลี่ยน behavior ใดๆ — เช็คด้วย diff กับต้นฉบับแล้วตรงทุกตัวอักษร
// ยกเว้นจุดที่ตั้งใจแยกไฟล์ (เพิ่ม `export` หน้า `renderAuditLog`, `AUDIT_ACTION_LABEL`,
// `fmtAuditTime`)
//
// export `renderAuditLog()`, `AUDIT_ACTION_LABEL`, `fmtAuditTime` ตามแผนเดิม —
// admin-overview-dashboard.js import `AUDIT_ACTION_LABEL`/`fmtAuditTime` จากไฟล์นี้ไปใช้ในการ์ด
// "กิจกรรมล่าสุด" ของแท็บภาพรวม
// ===========================
import { listAuditLog, auditLogToCSV } from "./db.js";
import { showToast, escapeHtml } from "./admin-utils.js";

const auditListBox   = document.getElementById("ad-audit-list");
const auditListCount = document.getElementById("ad-audit-list-count");
const auditRefreshBtn = document.getElementById("ad-audit-refresh");
const auditFilterActionEl = document.getElementById("ad-audit-filter-action");
const auditFilterUserEl   = document.getElementById("ad-audit-filter-user");
const auditFilterFromEl   = document.getElementById("ad-audit-filter-from");
const auditFilterToEl     = document.getElementById("ad-audit-filter-to");
const auditFilterClearBtn = document.getElementById("ad-audit-filter-clear");

export function fmtAuditTime(ts) {
  if (!ts) return "";
  const d = ts.toMillis ? new Date(ts.toMillis()) : new Date(ts);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" });
}

function auditMillis(ts) {
  if (!ts) return null;
  const d = ts.toMillis ? new Date(ts.toMillis()) : new Date(ts);
  return isNaN(d.getTime()) ? null : d.getTime();
}

export const AUDIT_ACTION_LABEL = { delete: "ลบ", update: "แก้ไข", create: "เพิ่ม" };

// เก็บชุดข้อมูลดิบไว้ในตัวแปรนี้ — ตัวกรอง (การกระทำ/คน/ช่วงวันที่) ทำฝั่ง client ล้วนๆ
// ไม่ยิง query ใหม่ทุกครั้งที่เปลี่ยนตัวกรอง เพราะโหลดมา 200 รายการอยู่แล้วในทีเดียว
let auditRawRows = [];

// เติม dropdown "ทุกคน" ด้วยรายชื่อ/อีเมลที่พบจริงใน log ที่โหลดมา (ไม่ใช่รายชื่อ staff ทั้งหมด
// เพราะบางคนอาจยังไม่เคยมีการกระทำใดๆ เลย ใส่ไว้ให้เลือกก็ไม่มีประโยชน์)
function populateAuditUserFilter(rows) {
  if (!auditFilterUserEl) return;
  const current = auditFilterUserEl.value;
  const users = Array.from(new Set(rows.map(r => r.email || r.uid || "").filter(Boolean))).sort();
  auditFilterUserEl.innerHTML = `<option value="">ทุกคน</option>` +
    users.map(u => `<option value="${escapeHtml(u)}">${escapeHtml(u)}</option>`).join("");
  if (users.includes(current)) auditFilterUserEl.value = current;
}

function applyAuditFilters(rows) {
  const action = auditFilterActionEl ? auditFilterActionEl.value : "";
  const user   = auditFilterUserEl ? auditFilterUserEl.value : "";
  const fromMs = auditFilterFromEl && auditFilterFromEl.value ? new Date(auditFilterFromEl.value + "T00:00:00").getTime() : null;
  const toMs   = auditFilterToEl && auditFilterToEl.value ? new Date(auditFilterToEl.value + "T23:59:59").getTime() : null;
  return rows.filter(r => {
    if (action && r.action !== action) return false;
    if (user && (r.email || r.uid || "") !== user) return false;
    const t = auditMillis(r.createdAt);
    if (fromMs != null && (t == null || t < fromMs)) return false;
    if (toMs != null && (t == null || t > toMs)) return false;
    return true;
  });
}

function renderAuditRows() {
  if (!auditListBox) return;
  const filtered = applyAuditFilters(auditRawRows);
  if (auditListCount) {
    auditListCount.textContent = auditRawRows.length
      ? `แสดง ${filtered.length} จาก ${auditRawRows.length} รายการที่โหลดไว้`
      : "";
  }
  if (!filtered.length) {
    auditListBox.innerHTML = `<div class="ad-team-empty">${auditRawRows.length ? "ไม่พบประวัติที่ตรงกับตัวกรอง" : "ยังไม่มีประวัติ"}</div>`;
    return;
  }
  auditListBox.innerHTML = filtered.map(r => `
    <div class="ad-audit-row">
      <span class="ad-audit-action">${escapeHtml(AUDIT_ACTION_LABEL[r.action] || r.action)}</span>
      <span>${escapeHtml(r.targetType || "")}${r.meta ? " — " + escapeHtml(r.meta) : ""}</span>
      <span class="ad-audit-meta">${escapeHtml(r.email || r.uid || "")} · ${fmtAuditTime(r.createdAt)}</span>
    </div>`).join("");
}

export async function renderAuditLog() {
  if (!auditListBox) return;
  auditListBox.innerHTML = `<div class="ad-team-empty">กำลังโหลด…</div>`;
  try {
    auditRawRows = await listAuditLog(200);
    populateAuditUserFilter(auditRawRows);
    renderAuditRows();
  } catch (err) {
    // ปกติจะขึ้นตรงนี้ถ้าบัญชีที่ล็อกอินอยู่มี role เป็น "staff" (ไม่ใช่ admin) — Firestore rules
    // ปฏิเสธการอ่านให้เองอยู่แล้ว ถือว่าทำงานถูกต้องตามที่ตั้งใจ
    auditRawRows = [];
    if (auditListCount) auditListCount.textContent = "";
    auditListBox.innerHTML = `<div class="ad-team-empty">ดูประวัตินี้ได้เฉพาะบัญชีที่มีบทบาท admin เท่านั้น (${escapeHtml(err.message || "")})</div>`;
  }
}

if (auditRefreshBtn) auditRefreshBtn.addEventListener("click", renderAuditLog);
[auditFilterActionEl, auditFilterUserEl, auditFilterFromEl, auditFilterToEl].forEach(el => {
  if (el) el.addEventListener("change", renderAuditRows);
});
if (auditFilterClearBtn) {
  auditFilterClearBtn.addEventListener("click", () => {
    if (auditFilterActionEl) auditFilterActionEl.value = "";
    if (auditFilterUserEl) auditFilterUserEl.value = "";
    if (auditFilterFromEl) auditFilterFromEl.value = "";
    if (auditFilterToEl) auditFilterToEl.value = "";
    renderAuditRows();
  });
}

const auditExportBtn = document.getElementById("ad-audit-export");
if (auditExportBtn) {
  auditExportBtn.addEventListener("click", async () => {
    auditExportBtn.disabled = true;
    try {
      // ส่งออกตามตัวกรองปัจจุบัน ถ้ามีการกรองอยู่ — ถ้ายังไม่เคยกดโหลด/ไม่มีตัวกรองเลย ดึงมาใหม่ 1000 รายการล่าสุด
      const hasFilter = (auditFilterActionEl && auditFilterActionEl.value) ||
                         (auditFilterUserEl && auditFilterUserEl.value) ||
                         (auditFilterFromEl && auditFilterFromEl.value) ||
                         (auditFilterToEl && auditFilterToEl.value);
      const rows = hasFilter ? applyAuditFilters(auditRawRows) : await listAuditLog(1000);
      const csv = auditLogToCSV(rows);
      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }); // BOM กันภาษาไทยเพี้ยนตอนเปิดด้วย Excel
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      showToast("ส่งออกไม่สำเร็จ: " + err.message);
    } finally {
      auditExportBtn.disabled = false;
    }
  });
}
