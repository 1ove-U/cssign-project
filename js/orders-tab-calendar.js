// ===========================
// js/orders-tab-calendar.js — มุมมองปฏิทินของแท็บคำสั่งผลิต (นัดติดตั้ง/ส่งมอบ CS.SIGN 2026,
// P1.5b — ต่อจาก data layer ordersByDueDate() ใน js/db-orders-stats.js ที่ทำไว้แล้วใน P1.5a)
//
// ตามแพทเทิร์นเดียวกับ js/orders-tab-kanban.js เป๊ะๆ (comment header, export ฟังก์ชันเดียว
// renderCalendar(rows) ให้ orders-tab.js เรียกจาก render() ตอน activeView === "calendar",
// รับ rows ที่กรองแล้วจาก filterOrders() เหมือนกับที่ renderKanban(rows) รับ ไม่ใช่ allOrders ดิบ)
//
// แสดง month-view ของคำสั่งผลิตที่ยังไม่เสร็จ (ไม่รวม completed/cancelled — ตามเกณฑ์ของ
// ordersByDueDate() อยู่แล้ว) จัดกลุ่มตาม dueDate — แต่ละวันแสดงจำนวนรายการ + ไฮไลต์สี
// overdue/due-soon ด้วย orderUrgency() เหมือน kanban card (ใช้ urgency "หนักสุด" ของออเดอร์ใน
// วันนั้นเป็นสีของทั้ง cell: overdue > due-soon > ปกติ)
//
// เดือนที่แสดง (viewMonth) เป็น module-private state เริ่มที่เดือนปัจจุบันตอนโหลดไฟล์ครั้งแรก
// เปลี่ยนเดือนได้ด้วยปุ่มก่อนหน้า/ถัดไป (ไม่ persist ข้าม reload หน้า — เหมือน dragOrderId ของ
// kanban ที่เป็น module-private เช่นกัน) ปุ่มเปลี่ยนเดือนแค่ re-render ด้วย rows ชุดเดิมที่ผ่านมา
// ครั้งล่าสุด (ไม่ได้ไป fetch ใหม่ — ถ้าข้อมูลเปลี่ยนจริงระหว่างนั้น orders-tab.js จะเรียก
// renderCalendar(rows ใหม่) ผ่าน render() ปกติอยู่แล้วตอน snapshot listener อัปเดต)
//
// P1.5c — คลิกวันที่ (เซลล์ที่มีออเดอร์) เปิด popover แสดงรายการออเดอร์ที่ครบกำหนดวันนั้น
// (code/customer/status) คลิกแต่ละรายการเปิด openOrderModal(order) เดิมได้เลย — popover เป็น
// overlay ที่สร้างแบบ lazy-create แล้ว append เข้า document.body ครั้งเดียว (ตามแพทเทิร์นเดียวกับ
// ensureConfirmOverlay() ใน js/ui-helpers.js) ไม่ใช่ markup คงที่ใน admin.html เพื่อไม่ให้ถูกลบทิ้ง
// ทุกครั้งที่ renderCalendar() เขียนทับ calendarView.innerHTML ใหม่
// ===========================
import { ordersByDueDate, orderUrgency } from "./db-orders-stats.js";
import { ORDER_STATUS } from "./db-orders.js";
import { getAllOrders, escapeHtml } from "./orders-tab.js";
import { openOrderModal } from "./orders-tab-modal.js";

const calendarView = document.getElementById("cp-calendar-view");
let dayOverlay = null;

const DAY_LABELS = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
const MONTH_LABELS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

// เดือนที่กำลังแสดงอยู่ (วันที่ 1 ของเดือนนั้นเสมอ)
let viewMonth = startOfMonth(new Date());

function toDateKey(y, m, day) {
  const mm = String(m + 1).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${y}-${mm}-${dd}`;
}

// urgency "หนักสุด" ของออเดอร์ทั้งหมดในวันนั้น กำหนดสีของทั้ง cell (overdue ชนะ due-soon เสมอ
// แม้จะมีแค่ 1 รายการที่ overdue ในวันที่มีหลายรายการปนกัน)
function dayUrgency(orders) {
  let worst = null;
  for (const o of orders) {
    const u = orderUrgency(o);
    if (u === "overdue") return "overdue";
    if (u === "due-soon") worst = "due-soon";
  }
  return worst;
}

// สร้าง overlay popover วันที่ (lazy-create ครั้งแรกที่เรียก แล้วเก็บไว้ใช้ซ้ำ — เหมือน
// ensureConfirmOverlay() ใน js/ui-helpers.js)
function ensureDayOverlay() {
  if (dayOverlay) return dayOverlay;
  dayOverlay = document.createElement("div");
  dayOverlay.className = "cp-cal-day-overlay";
  dayOverlay.style.display = "none";
  dayOverlay.innerHTML = `
    <div class="cp-cal-day-box" role="dialog" aria-modal="true">
      <div class="cp-cal-day-head">
        <span class="cp-cal-day-title" id="cp-cal-day-title"></span>
        <button type="button" class="cp-icon-btn" id="cp-cal-day-close" title="ปิด">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>
      </div>
      <div class="cp-cal-day-list" id="cp-cal-day-list"></div>
    </div>`;
  document.body.appendChild(dayOverlay);
  dayOverlay.querySelector("#cp-cal-day-close").addEventListener("click", closeDayPopover);
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

// เปิด popover แสดงรายการออเดอร์ของวันที่ dateKey — คลิกแต่ละรายการเปิด openOrderModal(order) เดิม
function openDayPopover(dateKey, orders) {
  const overlay = ensureDayOverlay();
  overlay.querySelector("#cp-cal-day-title").textContent = formatDayPopoverTitle(dateKey, orders.length);

  const list = overlay.querySelector("#cp-cal-day-list");
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

export function renderCalendar(rows) {
  const byDate = ordersByDueDate(rows);
  const y = viewMonth.getFullYear();
  const m = viewMonth.getMonth();
  const firstWeekday = new Date(y, m, 1).getDay(); // 0 = อาทิตย์ (เหมือน getDay() มาตรฐาน)
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
      <button type="button" class="cp-icon-btn" id="cp-cal-prev" title="เดือนก่อนหน้า">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>
      </button>
      <span class="cp-cal-head-label">${MONTH_LABELS[m]} ${y + 543}</span>
      <button type="button" class="cp-icon-btn" id="cp-cal-next" title="เดือนถัดไป">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
      </button>
    </div>
    <div class="cp-cal-grid cp-cal-grid-labels">
      ${DAY_LABELS.map(l => `<div class="cp-cal-daylabel">${l}</div>`).join("")}
    </div>
    <div class="cp-cal-grid">
      ${cells.join("")}
    </div>`;

  calendarView.querySelector("#cp-cal-prev").addEventListener("click", () => {
    viewMonth = new Date(y, m - 1, 1);
    renderCalendar(rows);
  });
  calendarView.querySelector("#cp-cal-next").addEventListener("click", () => {
    viewMonth = new Date(y, m + 1, 1);
    renderCalendar(rows);
  });

  // P1.5c — คลิกเซลล์ที่มีออเดอร์ (มี .cp-cal-cell-count) เปิด popover รายการของวันนั้น เซลล์ว่าง/
  // ไม่มีออเดอร์ไม่มี listener (ไม่มีอะไรให้ดู)
  calendarView.querySelectorAll(".cp-cal-cell-clickable").forEach(cell => {
    const dateKey = cell.dataset.date;
    cell.addEventListener("click", () => {
      const orders = byDate.get(dateKey) || [];
      openDayPopover(dateKey, orders);
    });
  });
}
