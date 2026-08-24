// ===========================
// js/orders-tab-modal-history.js — ส่วน "ประวัติแก้ไข" ของป๊อปอัพเพิ่ม/แก้ไขคำสั่งผลิต
// (js/orders-tab-modal.js) — ดึงจาก listAuditLog() (js/db.js) แล้วกรองด้วย
// targetType === "order" && targetId === order.id
//
// 2026 refactor phase 7: แยกออกมาจาก js/orders-tab-modal.js เดิม (440 บรรทัด) — ย้าย DOM ref
// ของหมวด "ประวัติ" (บรรทัด 84 เดิม) และฟังก์ชัน loadOrderHistory() ทั้งหมด (บรรทัด 251-278
// เดิม) มาแบบ diff เป๊ะ ไม่มีเปลี่ยน logic — ไฟล์นี้ไม่มี state ภายในเลย (ต่างจาก
// orders-tab-modal-qc.js/orders-tab-modal-attach.js) เพราะ loadOrderHistory() เป็นฟังก์ชัน
// async ที่ render DOM ของตัวเองทั้งหมดจบในตัว ไม่ต้องส่งค่าอะไรกลับ จึงไม่ต้องมี setter/getter
// ข้ามไฟล์เลย มีแค่ทิศทางเดียว (orders-tab-modal.js เรียก loadOrderHistory() ตอนเปิดป๊อปอัพ/
// ทำซ้ำ)
//
// export ออกไปให้ js/orders-tab-modal.js เรียกใช้:
//   - loadOrderHistory(orderId) — เรียกตอนเปิดป๊อปอัพ (openOrderModal/openOrderModalClone)
// ===========================
import { listAuditLog } from "./db.js";
import { errorStateHTML } from "./ui-helpers.js";
import { escapeHtml } from "./orders-tab.js";

const historyListBox = document.getElementById("cp-o-history-list");

// ── ประวัติแก้ไข (หมวด "ประวัติ") — ดึงจาก listAuditLog() แล้วกรองด้วย targetId === order.id ──
export async function loadOrderHistory(orderId) {
  if (!orderId) {
    historyListBox.innerHTML = `<div class="cp-qc-empty">บันทึกคำสั่งผลิตนี้ให้เสร็จก่อน แล้วประวัติการแก้ไขจะเริ่มปรากฏที่นี่</div>`;
    return;
  }
  historyListBox.innerHTML = `<div class="cp-qc-empty">กำลังโหลด…</div>`;
  try {
    const logs = (await listAuditLog(200)).filter(l => l.targetType === "order" && l.targetId === orderId);
    if (!logs.length) {
      historyListBox.innerHTML = `<div class="cp-qc-empty">ยังไม่มีประวัติการแก้ไขสำหรับคำสั่งผลิตนี้</div>`;
      return;
    }
    historyListBox.innerHTML = logs.map(l => {
      const t = l.createdAt ? (l.createdAt.toMillis ? new Date(l.createdAt.toMillis()) : new Date(l.createdAt)) : null;
      const timeStr = t && !isNaN(t.getTime()) ? t.toLocaleString("th-TH") : "";
      return `<div class="cp-history-item">
        <span class="cp-history-dot"></span>
        <div class="cp-history-body">
          <span class="cp-history-action">${escapeHtml(l.action || "")}${l.meta ? " — " + escapeHtml(l.meta) : ""}</span>
          <span class="cp-history-meta">${escapeHtml(l.email || l.uid || "")} · ${timeStr}</span>
        </div>
      </div>`;
    }).join("");
  } catch (err) {
    historyListBox.innerHTML = errorStateHTML(`โหลดประวัติไม่สำเร็จ: ${err.message || ""}`, () => loadOrderHistory(orderId), { wrapTag: "div" });
  }
}
