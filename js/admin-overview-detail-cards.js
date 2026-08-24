// ===========================================================
// js/admin-overview-detail-cards.js — แท็บ "ภาพรวม" ส่วน "รายละเอียดเพิ่มเติม"
// แยกออกมาจาก js/admin-overview-dashboard.js เดิม (2026 refactor phase — รอบที่ 27) —
// ย้ายโค้ดเฉยๆ ไม่เปลี่ยน behavior — diff บรรทัดต่อบรรทัดกับต้นฉบับตรง 100% ยกเว้นเพิ่ม
// `export` หน้าทั้ง 4 ฟังก์ชันและเพิ่ม import ของตัวเอง (เดิมใช้ตัวแปร/ฟังก์ชันร่วมกับ
// admin-overview-dashboard.js อยู่แล้วในไฟล์เดียวกัน)
//
// ไฟล์นี้เก็บ 4 การ์ด "รายละเอียดเพิ่มเติม"/กิจกรรมของแท็บภาพรวม ที่ renderOverview()
// (admin-overview-dashboard.js) เรียกท้ายฟังก์ชันเหมือนเดิมทุกครั้งที่ render:
//   - renderLeadFunnel() — ช่องทางขาย/สถานะลีดทั้งหมด (bar chart แนวนอน)
//   - renderLeadSourceConversion() — อัตราปิดการขายแยกตามช่องทาง
//   - renderSlaWarning() — รายการคำสั่งผลิตที่ใกล้/เกินกำหนดส่ง
//   - renderOverviewActivity() — กิจกรรมล่าสุด (Audit Log)
// ไม่มีฟังก์ชันไหนใน 4 ตัวนี้ถูกไฟล์อื่นเรียกใช้โดยตรงนอกจาก admin-overview-dashboard.js
// (ตรวจแล้วด้วย grep ทั่วโปรเจกต์ก่อนย้าย) จึง export ให้ไฟล์นั้น import กลับมาเรียกเท่านั้น
// ===========================================================
import { listAuditLog } from "./db.js";
import { getOrderReminders, jumpToOrderReminder } from "./orders-tab.js";
import { escapeHtml } from "./admin-utils.js";
import { allLeads, LEAD_SOURCE_LABEL } from "./admin-leads.js";
import { AUDIT_ACTION_LABEL, fmtAuditTime } from "./admin-settings-audit.js";
import { switchTab } from "./admin-page.js";

// กล่อง "ช่องทางขาย — สถานะลีดทั้งหมด" ในส่วน "รายละเอียดเพิ่มเติม" — แสดงจำนวนลีด
// แยกตามสถานะทุกสถานะ (new/read/replied/won/lost) เป็น bar chart แนวนอน คู่กับตัวเลข
// อัตราปิดการขายด้านบน ให้เห็นภาพรวมทั้ง funnel ไม่ใช่แค่ % เดียวลอยๆ
export function renderLeadFunnel() {
  const box = document.getElementById("ov-breakdown-funnel");
  if (!box) return;
  if (!allLeads.length) {
    box.innerHTML = `<div class="cp-empty">ไม่มีข้อมูล</div>`;
    return;
  }
  const statuses = [
    { key: "new",     label: "ใหม่" },
    { key: "read",    label: "อ่านแล้ว" },
    { key: "replied", label: "ตอบกลับแล้ว" },
    { key: "won",     label: "ปิดการขายสำเร็จ" },
    { key: "lost",    label: "ไม่สำเร็จ" }
  ];
  const counts = statuses.map(s => ({ ...s, count: allLeads.filter(l => l.status === s.key).length }));
  const max = Math.max(1, ...counts.map(c => c.count));
  box.innerHTML = counts.map(c => `
    <div class="cp-breakdown-row">
      <span class="cp-breakdown-name">${escapeHtml(c.label)}</span>
      <span class="cp-breakdown-bar-wrap"><span class="cp-breakdown-bar" style="width:${Math.round(c.count/max*100)}%"></span></span>
      <span class="cp-breakdown-count">${c.count}</span>
    </div>`).join("");
}// กล่อง "อัตราปิดการขายแยกตามช่องทาง" ในส่วน "รายละเอียดเพิ่มเติม" — เหมือน renderLeadFunnel
// ด้านบนแต่แยกอัตราปิดการขาย (won ÷ (won+lost)) เป็นรายช่องทางแทนที่จะรวมทุกช่องทางเป็นเลขเดียว
// (ov-stat-conversion) — reuse allLeads ที่โหลดไว้แล้ว ไม่ query Firestore ซ้ำ
//
// หมายเหตุเรื่อง label ช่องทาง: ใช้ LEAD_SOURCE_LABEL จาก admin-leads.js (ชุดเดียวกับตัวกรอง
// "ช่องทาง" ในแท็บลีด) แทนที่จะใช้ SOURCE_LABEL ใน email-notify.js ตามที่ระบุมา เพราะ
// SOURCE_LABEL มีแค่ 4 ค่า (contact_page/inline_contact/quotation_modal/catalog_download) และ
// ใช้เฉพาะตอนขึ้นชื่อช่องทางในอีเมลแจ้งเตือนภายใน ไม่ตรงกับค่า source จริงที่บันทึกลง Firestore
// เช่น 'contact_page' ในนั้นจริงๆ ไม่มีฟอร์มไหนบันทึกค่านี้ (ฟอร์มหน้าติดต่อบันทึกค่าอื่น) และไม่มี
// 'chat_widget'/'exit_intent_cta'/'quotation_modal_contact'/'quotation_modal_portfolio' ที่ใช้จริง
// เลย — ถ้าใช้ตามที่ระบุมาการ์ดนี้จะโชว์ label ผิด/ไม่ครบสำหรับหลายช่องทาง จึงใช้ LEAD_SOURCE_LABEL
// ที่ตรงกับค่าจริงแทน (ค่าที่ไม่มีใน map จะ fallback ไปโชว์ key ดิบเหมือน fillSourceFilter เดิม)
export function renderLeadSourceConversion() {
  const box = document.getElementById("ov-breakdown-source-conversion");
  if (!box) return;
  const sources = [...new Set(allLeads.map(l => l.source).filter(Boolean))];
  if (!sources.length) {
    box.innerHTML = `<div class="cp-empty">ไม่มีข้อมูล</div>`;
    return;
  }
  const rows = sources.map(s => {
    const leadsOfSource = allLeads.filter(l => l.source === s);
    const won = leadsOfSource.filter(l => l.status === "won").length;
    const lost = leadsOfSource.filter(l => l.status === "lost").length;
    const closed = won + lost;
    const rate = closed ? Math.round((won / closed) * 100) : null;
    return { label: LEAD_SOURCE_LABEL[s] || s, total: leadsOfSource.length, won, closed, rate };
  }).sort((a, b) => (b.rate ?? -1) - (a.rate ?? -1) || b.total - a.total);

  box.innerHTML = rows.map(r => `
    <div class="cp-breakdown-row" title="${r.closed ? `ปิดการขายสำเร็จ ${r.won} จาก ${r.closed} ลีดที่ปิดจบแล้ว (${r.total} ลีดรวมจากช่องทางนี้)` : `ยังไม่มีลีดที่ปิดจบ (won/lost) จากช่องทางนี้ (${r.total} ลีดรวม)`}">
      <span class="cp-breakdown-name">${escapeHtml(r.label)}</span>
      <span class="cp-breakdown-bar-wrap"><span class="cp-breakdown-bar" style="width:${r.rate ?? 0}%"></span></span>
      <span class="cp-breakdown-count">${r.rate !== null ? r.rate + "%" : "—"}</span>
    </div>`).join("");
}

// ============ SLA warning: รายการคำสั่งผลิตที่ใกล้/เกินกำหนดส่ง แสดงเด่นบนหน้าภาพรวม ============
// ต่างจากแถบ "วันนี้ต้องทำอะไร" (js/admin-overview-today.js) ที่โชว์แค่ตัวเลขสรุปรวม
// (เฝ้าดู #cp-stat-overdue/#cp-stat-duesoon ด้วย MutationObserver) — กล่องนี้แสดง "รายการ"
// คำสั่งผลิตแต่ละใบที่เกิน/ใกล้ครบกำหนดจริงๆ ให้กดดูแล้วกระโดดไปแท็บคำสั่งผลิตพร้อมตัวกรองได้ทันที
// เหมือนกับที่ notif bell (renderNotifBell ใน admin-overview-dashboard.js) ทำอยู่แล้ว — reuse
// getOrderReminders()/jumpToOrderReminder() ที่ import มาจาก orders-tab.js อยู่แล้ว (อ่านจาก
// allOrders ที่โหลดไว้แล้วในแท็บคำสั่งผลิต ไม่ query Firestore ซ้ำ)
export function renderSlaWarning() {
  const section = document.getElementById("ov-sla-warning");
  const list = document.getElementById("ov-sla-list");
  if (!section || !list) return;
  const { overdue, dueSoon } = getOrderReminders();
  if (!overdue.length && !dueSoon.length) {
    section.style.display = "none";
    return;
  }
  section.style.display = "";

  const itemHtml = (o, urgent) => `
    <div class="cp-notif-item ${urgent ? "is-overdue" : "is-duesoon"}" data-order-id="${o.id}" data-urgency="${urgent ? "overdue" : "due-soon"}">
      <span class="cp-notif-item-title">${escapeHtml(o.code || o.item || "คำสั่งผลิต")} — ${escapeHtml(o.customer || "ไม่ระบุลูกค้า")}</span>
      <span class="cp-notif-item-sub">${urgent ? "เกินกำหนดส่งแล้ว" : "ใกล้ครบกำหนดส่ง"}${o.dueDate ? " · กำหนดส่ง " + escapeHtml(o.dueDate) : ""}</span>
    </div>`;

  // เกินกำหนดขึ้นก่อนเสมอ (เร่งด่วนกว่า) ตามด้วยใกล้ครบกำหนด — เหมือน pattern ใน renderNotifBell
  list.innerHTML = [
    ...overdue.map(o => itemHtml(o, true)),
    ...dueSoon.map(o => itemHtml(o, false))
  ].join("");

  list.querySelectorAll("[data-order-id]").forEach(row => {
    row.addEventListener("click", () => {
      switchTab("orders");
      jumpToOrderReminder(row.dataset.urgency === "overdue" ? "overdue" : "duesoon");
    });
  });

  const viewAllBtn = document.getElementById("ov-sla-viewall");
  if (viewAllBtn && !viewAllBtn.dataset.wired) {
    viewAllBtn.dataset.wired = "1";
    viewAllBtn.addEventListener("click", () => switchTab("orders"));
  }
}

// (ใช้ logAudit/listAuditLog ตัวเดียวกับแท็บตั้งค่า "ประวัติการทำงาน" ไม่ใช่ข้อมูลจำลอง)
export async function renderOverviewActivity() {
  const box = document.getElementById("ov-recent-activity");
  if (!box) return;
  try {
    const rows = await listAuditLog(6);
    if (!rows.length) {
      box.innerHTML = `<div class="cp-empty">ยังไม่มีกิจกรรม</div>`;
      return;
    }
    box.innerHTML = rows.map(r => `
      <div class="ad-audit-row">
        <span class="ad-audit-action">${escapeHtml(AUDIT_ACTION_LABEL[r.action] || r.action)}</span>
        <span>${escapeHtml(r.targetType || "")}${r.meta ? " — " + escapeHtml(r.meta) : ""}</span>
        <span class="ad-audit-meta">${escapeHtml(r.email || r.uid || "")} · ${fmtAuditTime(r.createdAt)}</span>
      </div>`).join("");
  } catch {
    // เกิดกับบัญชี role "staff" ที่ Firestore rules ไม่ให้อ่าน auditLog — โชว์ข้อความแทน ไม่ใช่ error จริง
    box.innerHTML = `<div class="cp-empty">ดูกิจกรรมนี้ได้เฉพาะบัญชีที่มีบทบาท admin เท่านั้น</div>`;
  }
}
