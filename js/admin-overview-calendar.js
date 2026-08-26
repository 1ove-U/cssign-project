// ===========================================================
// js/admin-overview-calendar.js — ปฏิทินกำหนดส่งงานแบบย่อ บนหน้า "ภาพรวม"
//
// ผู้ใช้ขอให้เอาปฏิทินมาแสดงในหน้าภาพรวมด้วย (เดิมมีแค่ในแท็บ "คำสั่งผลิต" มุมมอง
// "ปฏิทิน") — ไฟล์นี้ทำหน้าที่เดียวกับ js/orders-tab-calendar.js (เดือน view,
// ไฮไลต์ overdue/due-soon, คลิกวันที่เพื่อดูรายการ) แต่แยกไฟล์ต่างหากเพราะ:
//   1) คนละ container (#ov-calendar-view ในหน้าภาพรวม vs #cp-calendar-view ในแท็บ
//      คำสั่งผลิต) — document.getElementById ของ orders-tab-calendar.js ผูกกับ
//      #cp-calendar-view ตายตัวตั้งแต่ตอนโหลดไฟล์ ใช้ซ้ำกับ container อื่นไม่ได้ตรงๆ
//   2) ไม่อยากให้ renderOverview() ไปยุ่งกับ state ภายใน (viewMonth) ของมุมมอง
//      ปฏิทินในแท็บคำสั่งผลิต ซึ่งอาจกำลังเปิดดูเดือนอื่นอยู่พร้อมกัน
// ใช้ data layer เดิมทั้งหมด (ordersByDueDate/orderUrgency จาก db-orders-stats.js,
// getAllOrders จาก orders-tab.js, openOrderModal จาก orders-tab-modal.js) ไม่มี
// การคำนวณซ้ำหรือ query Firestore เพิ่ม
// ===========================================================
import { ordersByDueDate, orderUrgency } from "./db-orders-stats.js";
import { ORDER_STATUS } from "./db-orders.js";
import { getAllOrders, escapeHtml } from "./orders-tab.js";
import { openOrderModal } from "./orders-tab-modal.js";

const DAY_LABELS = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
const MONTH_LABELS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

// เดือนที่กำลังแสดง (module-private state — เหมือนแพทเทิร์นเดียวกับ orders-tab-calendar.js
// แต่แยก state คนละตัวกัน ไม่ผูกกับมุมมองปฏิทินของแท็บคำสั่งผลิต)
let viewMonth = startOfMonth(new Date());
let dayOverlay = null;

function toDateKey(y, m, day) {
  const mm = String(m + 1).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${y}-${mm}-${dd}`;
}

function dayUrgency(orders) {
  let worst = null;
  for (const o of orders) {
    const u = orderUrgency(o);
    if (u === "overdue") return "overdue";
    if (u === "due-soon") worst = "due-soon";
  }
  return worst;
}

function ensureDayOverlay() {
  if (dayOverlay) return dayOverlay;
  dayOverlay = document.createElement("div");
  dayOverlay.className = "cp-cal-day-overlay";
  dayOverlay.style.display = "none";
  dayOverlay.innerHTML = `
    <div class="cp-cal-day-box" role="dialog" aria-modal="true">
      <div class="cp-cal-day-head">
        <span class="cp-cal-day-title" id="ov-cal-day-title"></span>
        <button type="button" class="cp-icon-btn" id="ov-cal-day-close" title="ปิด">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>
      </div>
      <div class="cp-cal-day-list" id="ov-cal-day-list"></div>
    </div>`;
  document.body.appendChild(dayOverlay);
  dayOverlay.querySelector("#ov-cal-day-close").addEventListener("click", closeDayPopover);
  dayOverlay.addEventListener("click", (e) => { if (e.target === dayOverlay) closeDayPopover(); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && dayOverlay.style.display !== "none") closeDayPopover();
  });
  return dayOverlay;
}

function closeDayPopover() {
  if (dayOverlay) dayOverlay.style.display = "none";
}

function formatDayPopoverTitle(dateKey, count) {
  const [y, m, d] = dateKey.split("-").map(Number);
  return `วันที่ ${d} ${MONTH_LABELS[m - 1]} ${y + 543} (${count} รายการ)`;
}

function openDayPopover(dateKey, orders) {
  const overlay = ensureDayOverlay();
  overlay.querySelector("#ov-cal-day-title").textContent = formatDayPopoverTitle(dateKey, orders.length);

  const list = overlay.querySelector("#ov-cal-day-list");
  list.innerHTML = orders.map(o => {
    const statusLabel = (ORDER_STATUS[o.status] && ORDER_STATUS[o.status].label) || o.status || "-";
    return `
    <button type="button" class="cp-cal-day-item" data-id="${o.id}">
      <span class="cp-cal-day-item-main">
        <span class="cp-cal-day-item-code">${escapeHtml(o.code || "-")}</span>
        <span class="cp-cal-day-item-item">${escapeHtml(o.item || "-")}</span>
      </span>
      <span class="cp-cal-day-item-side">
        <span class="cp-cal-day-item-cust">${escapeHtml(o.customer || "-")}</span>
        <span class="cp-cal-day-item-status">${escapeHtml(statusLabel)}</span>
      </span>
    </button>`;
  }).join("");

  list.querySelectorAll(".cp-cal-day-item").forEach(btn => {
    btn.addEventListener("click", () => {
      const order = getAllOrders().find(o => o.id === btn.dataset.id);
      closeDayPopover();
      if (order) openOrderModal(order);
    });
  });

  overlay.style.display = "flex";
}

export function renderOverviewCalendar() {
  const calendarView = document.getElementById("ov-calendar-view");
  if (!calendarView) return;

  const byDate = ordersByDueDate(getAllOrders());
  const y = viewMonth.getFullYear();
  const m = viewMonth.getMonth();
  const firstWeekday = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < firstWeekday; i++) {
    cells.push(`<div class="cp-cal-cell cp-cal-cell-empty"></div>`);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const dateKey = toDateKey(y, m, day);
    const orders = byDate.get(dateKey) || [];
    const urgency = dayUrgency(orders);
    const urgencyClass = urgency === "overdue" ? "is-overdue" : urgency === "due-soon" ? "is-duesoon" : "";
    const clickableClass = orders.length ? "cp-cal-cell-clickable" : "";
    cells.push(`
      <div class="cp-cal-cell ${urgencyClass} ${clickableClass}" data-date="${dateKey}">
        <span class="cp-cal-cell-daynum">${day}</span>
        ${orders.length ? `<span class="cp-cal-cell-count">${orders.length} รายการ</span>` : ""}
      </div>`);
  }
  const totalCellsSoFar = firstWeekday + daysInMonth;
  const trailing = (7 - (totalCellsSoFar % 7)) % 7;
  for (let i = 0; i < trailing; i++) {
    cells.push(`<div class="cp-cal-cell cp-cal-cell-empty"></div>`);
  }

  calendarView.innerHTML = `
    <div class="cp-cal-head">
      <button type="button" class="cp-icon-btn" id="ov-cal-prev" title="เดือนก่อนหน้า">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>
      </button>
      <span class="cp-cal-head-label">${MONTH_LABELS[m]} ${y + 543}</span>
      <button type="button" class="cp-icon-btn" id="ov-cal-next" title="เดือนถัดไป">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
      </button>
    </div>
    <div class="cp-cal-grid cp-cal-grid-labels">
      ${DAY_LABELS.map(l => `<div class="cp-cal-daylabel">${l}</div>`).join("")}
    </div>
    <div class="cp-cal-grid">
      ${cells.join("")}
    </div>`;

  calendarView.querySelector("#ov-cal-prev").addEventListener("click", () => {
    viewMonth = new Date(y, m - 1, 1);
    renderOverviewCalendar();
  });
  calendarView.querySelector("#ov-cal-next").addEventListener("click", () => {
    viewMonth = new Date(y, m + 1, 1);
    renderOverviewCalendar();
  });

  calendarView.querySelectorAll(".cp-cal-cell-clickable").forEach(cell => {
    const dateKey = cell.dataset.date;
    cell.addEventListener("click", () => {
      const orders = byDate.get(dateKey) || [];
      openDayPopover(dateKey, orders);
    });
  });
}
