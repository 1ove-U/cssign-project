// ===========================
// js/orders-tab-kanban.js — มุมมอง Kanban ของแท็บคำสั่งผลิต (คำสั่งผลิตของโปรเจกต์
// CS.SIGN 2026)
//
// 2026 refactor phase 3 (ต่อ): แยกออกมาจาก js/orders-tab.js เดิม (910 บรรทัด) — ดูหมายเหตุ
// เต็มใน js/orders-tab.js ไฟล์นี้เก็บเฉพาะการ์ด/คอลัมน์ Kanban + drag-and-drop เปลี่ยนสถานะ
// ไม่มีการเปลี่ยน logic ใดๆ จากของเดิม เป็นแค่ย้ายโค้ดเชิงโครงสร้าง — export แค่
// renderKanban(rows) ให้ orders-tab.js เรียกจาก render() (ตอน activeView === "kanban")
//
// หมายเหตุ: dragOrderId (state ระหว่างลาก) ใช้แค่ในไฟล์นี้เท่านั้น (ตอนแยกไฟล์ตรวจแล้วว่า
// ไม่มีจุดอื่นในไฟล์เดิมอ้างถึง) จึงเก็บเป็น module-private ในไฟล์นี้ได้เลย ไม่ต้องมี setter
// ข้ามไฟล์เหมือน pagination page ตัวอื่นๆ ในโปรเจกต์
//
// P1.6d (รอบที่ 10): เพิ่มปุ่ม "เปลี่ยนสถานะแบบกดครั้งเดียว" (data-action="next") ต่อจากปุ่ม
// edit/clone/delete เดิมบนการ์ด — โดยเฉพาะเพื่อ role "production" (P1.6a) ที่เห็นแค่แท็บออเดอร์/
// มุมมอง kanban นี้อยู่แล้ว บนแท็บเล็ตหน้างานการลาก-วาง (drag-and-drop) ทำยากกว่าการแตะปุ่มใหญ่
// ปุ่มนี้เรียก path เดียวกับ drop handler เดิมทุกประการ (เพิ่ม changeOrderStatus() กลาง ให้ทั้ง
// drop และปุ่ม next เรียกร่วมกัน ไม่ duplicate logic) — แสดงเฉพาะสถานะที่ยังมีขั้นต่อไปใน
// ORDER_STATUS_FLOW เท่านั้น (ไม่แสดงตอน completed หรือ cancelled เพราะไม่มีขั้นถัดไปที่ชัดเจน)
// ===========================
import { updateOrder, ORDER_STATUS, ORDER_STATUS_FLOW } from "./db-orders.js";
import { orderUrgency } from "./db-orders-stats.js";
import { getAllOrders, showToast, escapeHtml, confirmDeleteOrder } from "./orders-tab.js";
import { openOrderModal, openOrderModalClone } from "./orders-tab-modal.js";

const kanbanView = document.getElementById("cp-kanban-view");

let dragOrderId = null;

const KANBAN_COLUMNS = [...ORDER_STATUS_FLOW, "cancelled"];

export function renderKanban(rows) {
  kanbanView.innerHTML = KANBAN_COLUMNS.map(status => {
    const label = ORDER_STATUS[status].label;
    const items = rows.filter(o => o.status === status);
    return `
    <div class="cp-kanban-col" data-status="${status}">
      <div class="cp-kanban-col-head">
        <span class="cp-kanban-col-title">${label}</span>
        <span class="cp-kanban-col-count">${items.length}</span>
      </div>
      <div class="cp-kanban-col-body" data-status="${status}">
        ${items.map(o => kanbanCardHtml(o)).join("") || ""}
      </div>
    </div>`;
  }).join("");

  kanbanView.querySelectorAll(".cp-kanban-card").forEach(card => {
    card.addEventListener("dragstart", () => {
      dragOrderId = card.dataset.id;
      card.classList.add("dragging");
    });
    card.addEventListener("dragend", () => card.classList.remove("dragging"));
    card.querySelectorAll("button[data-action]").forEach(btn => {
      btn.addEventListener("click", () => {
        const order = getAllOrders().find(o => o.id === card.dataset.id);
        if (!order) return;
        if (btn.dataset.action === "edit") openOrderModal(order);
        if (btn.dataset.action === "clone") openOrderModalClone(order);
        if (btn.dataset.action === "delete") confirmDeleteOrder(order);
        if (btn.dataset.action === "next") changeOrderStatus(order, btn.dataset.nextStatus);
      });
    });
  });

  kanbanView.querySelectorAll(".cp-kanban-col-body").forEach(col => {
    col.addEventListener("dragover", (e) => {
      e.preventDefault();
      col.closest(".cp-kanban-col").classList.add("drag-over");
    });
    col.addEventListener("dragleave", () => col.closest(".cp-kanban-col").classList.remove("drag-over"));
    col.addEventListener("drop", async (e) => {
      e.preventDefault();
      col.closest(".cp-kanban-col").classList.remove("drag-over");
      const newStatus = col.dataset.status;
      if (!dragOrderId) return;
      const order = getAllOrders().find(o => o.id === dragOrderId);
      dragOrderId = null;
      if (!order || order.status === newStatus) return;
      await changeOrderStatus(order, newStatus);
    });
  });
}

// เปลี่ยนสถานะออเดอร์จริง (ใช้ร่วมกันทั้ง drop ลากการ์ด และปุ่ม "เปลี่ยนสถานะ" กดครั้งเดียว P1.6d)
// — คง behavior เดิมของ drop handler ทุกประการ (try/catch + toast success/error) ไม่มีการแก้ logic
async function changeOrderStatus(order, newStatus) {
  if (!order || !newStatus || order.status === newStatus) return;
  try {
    await updateOrder(order.id, { status: newStatus });
    showToast(`ย้าย "${order.code || order.item}" ไปยัง ${ORDER_STATUS[newStatus].label}`, "success");
  } catch (err) {
    showToast("อัปเดตสถานะไม่สำเร็จ: " + err.message, "error");
  }
}

// สถานะถัดไปใน flow หลัก (ไม่รวม "cancelled" — ยกเลิกไม่ใช่ "ขั้นถัดไป" ของสถานะไหนเลย ต้องเปลี่ยน
// ผ่านฟอร์มแก้ไข/ลากการ์ดเองเท่านั้น) คืนค่า null ถ้าไม่มีขั้นถัดไป (completed หรือสถานะไม่อยู่ใน flow)
function nextStatusOf(status) {
  const idx = ORDER_STATUS_FLOW.indexOf(status);
  if (idx === -1 || idx === ORDER_STATUS_FLOW.length - 1) return null;
  return ORDER_STATUS_FLOW[idx + 1];
}

function kanbanCardHtml(o) {
  const urgency = orderUrgency(o);
  const urgencyClass = urgency === "overdue" ? "is-overdue" : urgency === "due-soon" ? "is-duesoon" : "";
  const nextStatus = nextStatusOf(o.status);
  const nextBtnHtml = nextStatus
    ? `<button class="cp-kanban-next-btn" data-action="next" data-next-status="${nextStatus}">เปลี่ยนเป็น "${escapeHtml(ORDER_STATUS[nextStatus].label)}" →</button>`
    : "";
  // P2 (ของเสริมไม่บังคับ, รอบที่ 15): badge เล็กๆ แสดงเมื่อออเดอร์นี้ถูกส่งอีเมลขอรีวิวไปแล้ว
  // (field reviewRequestedAt เพิ่มมาจาก P2.9a2) — ใช้ o.reviewRequestedAt ตรงๆ ไม่ต้องแปลงรูปแบบ
  // (Firestore Timestamp/string ก็ได้ ที่นี่แค่เช็ค truthy ไม่ได้ format แสดงวันที่)
  const reviewBadgeHtml = o.reviewRequestedAt
    ? `<span class="cp-kanban-card-review-badge" title="ส่งอีเมลขอรีวิวแล้ว">ขอรีวิวแล้ว</span>`
    : "";
  return `
  <div class="cp-kanban-card ${urgencyClass}" draggable="true" data-id="${o.id}">
    <span class="cp-kanban-card-code">${escapeHtml(o.code||"—")}</span>
    <span class="cp-kanban-card-item">${escapeHtml(o.item||"—")}</span>
    <span class="cp-kanban-card-cust">${escapeHtml(o.customer||"—")} · จำนวน ${o.qty ?? "—"}</span>
    ${reviewBadgeHtml}
    <div class="cp-kanban-card-foot">
      <span class="cp-kanban-card-due ${urgencyClass}">${o.dueDate ? escapeHtml(o.dueDate) : "ไม่ระบุกำหนดส่ง"}</span>
      <div class="cp-kanban-card-actions">
        <button class="cp-icon-btn" data-action="edit" title="แก้ไข"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button>
        <button class="cp-icon-btn" data-action="clone" title="ทำซ้ำ"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
        <button class="cp-icon-btn danger" data-action="delete" title="ลบ"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg></button>
      </div>
    </div>
    ${nextBtnHtml}
  </div>`;
}
