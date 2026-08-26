// ===========================
// js/orders-tab-row.js — เรนเดอร์ 1 แถวของตารางคำสั่งผลิต (แยกออกมาจาก js/orders-tab.js)
//
// 2026 refactor รอบที่ 35: renderOrderRow() เดิมอยู่ใน orders-tab.js เป็น local function
// ที่จริงๆ แล้วเป็น **pure function ล้วนๆ** อยู่แล้ว (ไม่แตะ document/DOM เลยสักบรรทัด —
// รับ order object + Set ของแถวที่ถูกเลือกไว้ (bulk actions) มาเป็นพารามิเตอร์ธรรมดา แล้ว
// คืนค่าเป็น HTML string อย่างเดียว ไม่มี side effect) เข้าเกณฑ์เดียวกับที่เคยแยก
// filterOrders() ไปเป็น orders-tab-filters.js ในรอบที่ 33 — ย้ายมาที่นี่แบบไม่เปลี่ยน
// behavior ใดๆ (ยืนยันด้วย diff บรรทัดต่อบรรทัดกับต้นฉบับก่อนย้ายแล้ว เหมือนกันทุกตัวอักษร
// ยกเว้นเปลี่ยนพารามิเตอร์ selectedOrderIds จากตัวแปรปิดล้อม (closure) ในไฟล์เดิม มาเป็น
// พารามิเตอร์ธรรมดาแทน)
//
// ผลคือทดสอบด้วย `node --test` ตรงๆ ได้เลยโดยไม่ต้องพึ่ง jsdom/fake-DOM stub — ต่างจาก
// renderTable()/updateOrdersBulkBar() ที่ยังคงอยู่ใน orders-tab.js เหมือนเดิม เพราะสองฟังก์ชัน
// นั้นแตะ DOM จริง (tableBody.innerHTML=, querySelectorAll ฯลฯ) จึงไม่ใช่ pure function และ
// แยกออกมาไม่ได้โดยไม่เพิ่มความซับซ้อน (ต้องส่ง element reference ข้ามไฟล์)
//
// escapeHtml/avatarHtml ใช้จาก admin-utils.js ตรงๆ (เดิม orders-tab.js มี avatarHtml()/
// initials() ก็อปซ้ำอยู่ในไฟล์ ก็อปจาก admin-utils.js มาเหมือนกันทุกตัวอักษร — admin-leads.js
// เคย import จาก admin-utils.js อยู่แล้วตั้งแต่ phase 2 (ดู pattern เดียวกับ buildPageList ที่
// เจอใน orders-tab.js ตอนรอบที่ 33) — ลบก็อปซ้ำออกจาก orders-tab.js ในรอบนี้ด้วย (ดูคอมเมนต์
// หัวไฟล์ orders-tab.js)
// ===========================
import { orderUrgency } from "./db-orders-stats.js";
import { ORDER_STATUS } from "./db-orders.js";
import { escapeHtml, avatarHtml } from "./admin-utils.js";

// P0.2-fix: approvalSummary = { [trackingId]: { action, createdAt } } จาก
// listenDesignApprovalsSummary() (js/db-orders.js) — เทียบเวลาของ log ล่าสุดกับ
// o.designApprovalSeenAt (เขียนโดย markDesignApprovalSeen() ตอนแอดมินเปิดแท็บ "อนุมัติแบบ" ของ
// order ใบนั้นดูแล้ว) ถ้ายังไม่เคยเห็น หรือมี log ใหม่กว่าที่เคยเห็นล่าสุด ถือว่า "ยังไม่เห็น"
function hasUnseenDesignApproval(o, approvalSummary) {
  if (!o.trackingId || !approvalSummary) return false;
  const latest = approvalSummary[o.trackingId];
  if (!latest || !latest.createdAt) return false;
  const latestMs = latest.createdAt.toMillis ? latest.createdAt.toMillis() : new Date(latest.createdAt).getTime();
  if (!o.designApprovalSeenAt) return true;
  const seenMs = o.designApprovalSeenAt.toMillis ? o.designApprovalSeenAt.toMillis() : new Date(o.designApprovalSeenAt).getTime();
  return latestMs > seenMs;
}

// ── ป้ายสถานะคอลัมน์ "แบบงาน" — สรุปสถานะอนุมัติแบบล่าสุดของ order นี้แบบย่อ (ไม่ต้อง query
// เพิ่ม ใช้ approvalSummary ตัวเดียวกับที่คำนวณ approvalDot ด้านล่างอยู่แล้ว) ──
function designApprovalBadge(o, approvalSummary, unseenApproval) {
  if (!o.trackingId) {
    return `<span class="cp-design-badge is-none" title="ต้องกรอกเลขที่คำสั่ง + เบอร์โทรลูกค้าให้ครบก่อน ลูกค้าถึงจะเข้าหน้าอนุมัติแบบได้">ยังไม่พร้อม</span>`;
  }
  const latest = approvalSummary && approvalSummary[o.trackingId];
  if (!latest) {
    return `<span class="cp-design-badge is-waiting">รอลูกค้าตรวจ</span>`;
  }
  const label = latest.action === "approved" ? "อนุมัติแล้ว"
    : latest.action === "changes_requested" ? "ขอแก้ไข"
    : "รอลูกค้าตรวจ";
  const cls = latest.action === "approved" ? "is-approved"
    : latest.action === "changes_requested" ? "is-changes"
    : "is-waiting";
  return `<span class="cp-design-badge ${cls}">${unseenApproval ? `<span class="cp-approval-dot" title="มีลูกค้าอนุมัติ/ขอแก้ไขแบบใหม่ที่ยังไม่เห็น"></span>` : ""}${label}</span>`;
}

export function renderOrderRow(o, selectedOrderIds, approvalSummary) {
  const urgency = orderUrgency(o);
  const statusInfo = ORDER_STATUS[o.status] || { label: o.status || "—" };
  const unseenApproval = hasUnseenDesignApproval(o, approvalSummary);
  const designBadgeHtml = designApprovalBadge(o, approvalSummary, unseenApproval);
  const dueHtml = o.dueDate
    ? `<span class="${urgency==='overdue'?'is-overdue':urgency==='due-soon'?'is-duesoon':''}">${escapeHtml(o.dueDate)}</span>`
    : "—";
  const assigneeChip = o.assigneeName
    ? `<span class="cp-assignee-chip"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>${escapeHtml(o.assigneeName)}</span>`
    : "";
  return `
    <tr data-id="${o.id}" class="cp-row-clickable">
      <td><input type="checkbox" class="cp-row-check cp-o-row-check" data-id="${o.id}" ${selectedOrderIds.has(o.id) ? "checked" : ""} aria-label="เลือกคำสั่งผลิตนี้"></td>
      <td class="cp-code" title="${escapeHtml(o.code||"")}">${escapeHtml(o.code||"—")}</td>
      <td>
        <div class="cp-namecell">${avatarHtml(o.customer || "?")}<span class="cp-namecell-name" title="${escapeHtml(o.customer||"")}">${escapeHtml(o.customer||"—")}</span></div>
        ${assigneeChip}
      </td>
      <td>${escapeHtml(o.phone || "—")}</td>
      <td><span class="cp-status-badge" data-status="${o.status}">${escapeHtml(statusInfo.label)}</span></td>
      <td>
        <button class="cp-design-btn" type="button" data-action="design" title="ดูแบบ / ประวัติการอนุมัติและขอแก้ไข">${designBadgeHtml}</button>
      </td>
      <td>${dueHtml}</td>
      <td>
        <div class="cp-row-actions">
          <button class="cp-detail-btn" type="button" data-action="detail" title="ดูรายละเอียด">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
          <button class="cp-icon-btn" type="button" data-action="clone" title="ทำซ้ำ (เปิดฟอร์มเพิ่มใหม่พร้อมข้อมูลเดิม)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
          <button class="cp-icon-btn danger" type="button" data-action="delete" title="ลบ"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg></button>
        </div>
      </td>
    </tr>`;
}
