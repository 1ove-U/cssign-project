// ===========================
// js/orders-tab.js — คำสั่งผลิต (Order Queue) tab, embedded inside admin.html
// อแดปต์มาจาก console-page.js เดิม — ตัดส่วน login/gate ออก เพราะใช้ระบบล็อกอิน
// เดียวกับ admin-page.js (ad-gate/ad-app) อยู่แล้ว ไฟล์นี้ export แค่
// initOrdersTab()/stopOrdersTab() ให้ admin-page.js เรียกตอน login/logout
//
// 2026 refactor phase 3: ไฟล์นี้เดิมรวมทั้งแท็บไว้ในไฟล์เดียว (~1,360 บรรทัด) ส่วน "ป๊อปอัพ
// เพิ่ม/แก้ไขคำสั่งผลิต" ทั้งหมด (ตัวเลือกสินค้า/พนักงาน, หมวดข้อมูลงาน/การเงิน/การจัดส่ง/
// แนบไฟล์/ประวัติ, บันทึกฟอร์ม) ถูกแยกไปอยู่ js/orders-tab-modal.js แล้ว, มุมมอง Kanban
// (การ์ด/คอลัมน์/drag-drop) ถูกแยกไปอยู่ js/orders-tab-kanban.js แล้ว, ส่งออก CSV/พิมพ์
// รายงาน ถูกแยกไปอยู่ js/orders-tab-export.js แล้ว, การ์ดสถิติ/กราฟ/แยกหมวด ถูกแยกไปอยู่
// js/orders-tab-stats.js แล้ว ทั้งหมดแบบไม่เปลี่ยน behavior ใดๆ — ไฟล์นี้เหลือทำหน้าที่: ตาราง
// (มุมมองหลัก), ตัวกรอง/ค้นหา/pagination, bulk actions แล้วเรียก openOrderModal()/
// openOrderModalClone() ที่ import มาจาก orders-tab-modal.js ตอนผู้ใช้กด "เพิ่ม"/"แก้ไข"/
// "ทำซ้ำ", เรียก renderKanban() ที่ import มาจาก orders-tab-kanban.js ตอน render() (เมื่อ
// activeView === "kanban"), และเรียก renderStatsCards()/renderChart()/renderBreakdown() ที่
// import มาจาก orders-tab-stats.js ตอน render() (ยังคงห่อด้วย try/catch แยกกันเหมือนเดิมทุกจุด)
//
// หมายเหตุ: showToast()/escapeHtml()/formatBaht()/confirmDeleteOrder()/getAllOrders()
// ยังอยู่ในไฟล์นี้ (ใช้เยอะสุดในหน้านี้เอง) แล้ว export ออกไปให้ orders-tab-modal.js/
// orders-tab-kanban.js/orders-tab-export.js/orders-tab-stats.js import กลับมาใช้ — ไฟล์เหล่านั้น
// import openOrderModal/openOrderModalClone/loadProductPicker/loadStaffPicker/renderKanban/
// renderStatsCards/renderChart/renderBreakdown กลับมาที่นี่ (circular import ระหว่างไฟล์เหล่านี้
// ตั้งใจให้เป็นแบบนี้ เหมือนรูปแบบ admin-page.js ↔ admin-products.js ที่มีอยู่แล้วในโปรเจกต์นี้ —
// ใช้ได้ปกติเพราะทุกจุดที่เรียกใช้ข้ามไฟล์เป็นการเรียกภายในฟังก์ชัน/event handler ไม่ใช่ตอน
// module ประเมินค่าระดับบนสุด) — ตัวแปรกรอง (statusFilterValue/jumpFilter/mineOnly),
// pendingDeleteOrderIds, chartRange, chartMetric เพิ่ม export หน้าตัวแปรตรงๆ ได้เลยไม่ต้องมี
// setter เพราะไฟล์ที่ import ไปใช้ (orders-tab-export.js/orders-tab-stats.js) อ่านอย่างเดียว
// ไม่มี reassign ข้ามไฟล์
//
// 2026 refactor รอบที่ 36: แยก renderPagination() ออกเป็น js/orders-tab-pagination.js (ไฟล์ใหม่)
// — ต่างจาก renderOrderRow()/filterOrders() (รอบ 35/33) ตรงที่ renderPagination() ไม่ใช่ pure
// function (แตะ DOM ตรงๆ + ต้องเขียน currentPage ข้ามไฟล์ ไม่ใช่แค่อ่าน) — เพิ่ม
// setCurrentPage() เป็น setter export (import binding ปกติเขียนข้ามไฟล์ไม่ได้) และ export
// render() ให้ไฟล์ใหม่เรียกกลับหลังเปลี่ยนหน้า (รูปแบบ circular import เดียวกับที่มีอยู่แล้วกับ
// orders-tab-kanban.js/orders-tab-modal.js/orders-tab-stats.js) — ไม่มีการเปลี่ยน logic ใดๆ
// (ยืนยันด้วย diff แล้ว) ดูรายละเอียดเต็มที่คอมเมนต์หัวไฟล์ js/orders-tab-pagination.js —
// เอา import buildPageList ออกจากไฟล์นี้ด้วย (ย้ายไปใช้ที่ไฟล์ใหม่แทน ไม่ใช้ในไฟล์นี้แล้ว)
//
// 2026 refactor รอบที่ 35: 2 จุดที่แก้รอบนี้ —
//   1) `initials()`/`avatarHtml()` เดิมประกาศซ้ำอยู่ในไฟล์นี้ทั้งฟังก์ชัน (เหมือนกัน 100% กับที่
//      มีอยู่แล้วใน js/admin-utils.js ซึ่ง admin-leads.js import จากที่เดียวกันนั้นอยู่แล้วตั้งแต่
//      phase 2 — รูปแบบเดียวกับที่เจอ buildPageList() ซ้ำในรอบที่ 33) — ลบก็อปซ้ำออกจากไฟล์นี้
//      ไม่มี logic เปลี่ยนเลยแม้แต่บรรทัดเดียว (ยืนยันด้วย diff แล้วว่าทั้งสองที่เหมือนกันทุก
//      ตัวอักษรก่อนลบ ยกเว้นตัวแปรกลาง safeName ที่ไม่กระทบผลลัพธ์) — เนื่องจาก avatarHtml() ถูก
//      เรียกใช้แค่จุดเดียวคือใน renderOrderRow() (ดูข้อ 2 ด้านล่าง) จึงไม่ได้ import avatarHtml
//      มาที่ไฟล์นี้เลย แต่ import ตรงไปที่ js/orders-tab-row.js แทน (ไฟล์ใหม่ที่ renderOrderRow()
//      ย้ายไปอยู่)
//   2) `renderOrderRow()` เดิมเป็น local function ในไฟล์นี้ — ตรวจแล้วว่าเป็น **pure function
//      ล้วนๆ** อยู่แล้ว (รับ order + Set ของแถวที่เลือกไว้ คืนค่า HTML string อย่างเดียว ไม่แตะ
//      DOM เลย) — แยกออกเป็น js/orders-tab-row.js (ไฟล์ใหม่) แบบเดียวกับที่แยก filterOrders()
//      ไปเป็น orders-tab-filters.js ในรอบที่ 33 — renderTable()/updateOrdersBulkBar() ที่แตะ DOM
//      จริงยังอยู่ในไฟล์นี้เหมือนเดิม (ดูหมายเหตุท้ายไฟล์ orders-tab-row.js)
//
// 2026 refactor รอบที่ 33: 2 จุดที่แก้รอบนี้ —
//   1) `buildPageList()` เดิมประกาศซ้ำอยู่ในไฟล์นี้ทั้งฟังก์ชัน (เหมือนกัน 100% กับที่มีอยู่แล้ว
//      ใน js/admin-utils.js ซึ่งไฟล์อื่นๆ ในโปรเจกต์ทั้งหมด เช่น admin-leads.js/
//      admin-products.js/admin-blog.js/admin-faq.js/admin-portfolio.js/admin-categories.js
//      import จากที่เดียวกันนั้นอยู่แล้ว — ตรวจแล้วว่า
//      admin-leads.js เคยผ่านการย้ายนี้มาแล้วตั้งแต่ phase 2 (ดูคอมเมนต์หัวไฟล์นั้น) แต่ไฟล์นี้
//      ตกหล่นไป น่าจะเพราะถูกสร้าง/แยกออกมาคนละช่วงเวลากับตอนย้าย buildPageList ไป
//      admin-utils.js) — ลบฟังก์ชันซ้ำออก แล้ว import จาก admin-utils.js แทน ไม่มี logic
//      เปลี่ยนเลยแม้แต่บรรทัดเดียว (ยืนยันด้วย diff แล้วว่าทั้งสองที่เหมือนกันทุกตัวอักษรก่อนลบ)
//   2) ตรรกะกรองรายการ (ค้นหา/สถานะ/ความเร่งด่วน/"งานของฉัน") ใน render() เดิมเป็น local logic
//      อ่าน DOM (`searchInput.value`) และ `auth.currentUser` ตรงๆ ปนอยู่กับ logic กรองเอง —
//      แยกส่วนกรองล้วนๆ ออกเป็น `filterOrders()` ที่ js/orders-tab-filters.js (ไฟล์ใหม่) แบบ
//      pure function รับค่าที่ resolve จาก DOM/auth มาแล้วเป็นพารามิเตอร์ธรรมดาแทน (ไม่มีการ
//      import { db, auth } หรือแตะ DOM เลยในไฟล์ใหม่) — ทดสอบด้วย node --test ตรงๆ ได้โดยไม่ต้อง
//      พึ่ง jsdom/fake-DOM stub เลย ต่างจากไฟล์นี้ (orders-tab.js) ที่ยังผูก DOM ทั้งไฟล์เหมือนเดิม
// ===========================
import { logAudit, auth } from "./db.js";
import { listenOrders, updateOrder, deleteOrder, listenDesignApprovalsSummary } from "./db-orders.js";
import { computeOrderStats, orderUrgency } from "./db-orders-stats.js";
import { confirmDialog, showUndoToast, errorStateHTML } from "./ui-helpers.js";
import { filterOrders } from "./orders-tab-filters.js";
import { renderOrderRow } from "./orders-tab-row.js";
import { renderPagination } from "./orders-tab-pagination.js";
import { openOrderModal, openOrderModalClone,
         loadProductPicker, loadStaffPicker, loadQuoteRequestPicker } from "./orders-tab-modal.js";
import { renderKanban } from "./orders-tab-kanban.js";
import { renderCalendar } from "./orders-tab-calendar.js";
import { renderStatsCards, renderChart, renderBreakdown } from "./orders-tab-stats.js";
import "./orders-tab-export.js";

const chartRangeBox   = document.getElementById("cp-chart-range");
const chartMetricBox  = document.getElementById("cp-chart-metric");
const tableBody       = document.getElementById("cp-table-body");
const searchInput     = document.getElementById("cp-search");
const statusPillsBox  = document.getElementById("cp-filter-status-pills");
const paginationBox   = document.getElementById("cp-pagination");

const viewToggleBox   = document.getElementById("cp-view-toggle");
const tableView       = document.getElementById("cp-table-view");
const kanbanView      = document.getElementById("cp-kanban-view");
const calendarView    = document.getElementById("cp-calendar-view");
const mineToggleBtn   = document.getElementById("cp-mine-toggle");

// ── Bulk actions bar (เลือกหลายแถว + ลบ/เปลี่ยนสถานะทีเดียว) ──
const oBulkBar          = document.getElementById("cp-bulk-bar");
const oBulkCount        = document.getElementById("cp-bulk-count");
const oBulkClearBtn     = document.getElementById("cp-bulk-clear");
const oBulkStatusSelect = document.getElementById("cp-bulk-status-select");
const oBulkApplyBtn     = document.getElementById("cp-bulk-apply-status");
const oBulkDeleteBtn    = document.getElementById("cp-bulk-delete");
const oHeadCheck        = document.getElementById("cp-head-check");

// หมายเหตุ: ปุ่ม "เพิ่มคำสั่งผลิต" (cp-add-btn) และ event listener ของมัน ย้ายไปอยู่
// js/orders-tab-modal.js แล้ว (อยู่ติดกับ openOrderModal() ที่ปุ่มนี้เรียกใช้)

export let mineOnly = false; // "งานของฉัน" — กรองด้วย assignee === uid ผู้ใช้ปัจจุบัน (export: orders-tab-export.js อ่านอย่างเดียว)

let allOrders = [];
let activeView = "table"; // "table" | "kanban" | "calendar"
export let chartRange = 7; // 7 | 30 (export: orders-tab-stats.js อ่านอย่างเดียว)
export let chartMetric = "count"; // "count" | "revenue" (export: orders-tab-stats.js อ่านอย่างเดียว)
let unsubscribe = null;
// P0.2-fix: { [trackingId]: { action, createdAt } } ของ log อนุมัติ/ขอแก้ไขแบบล่าสุด — ฟังแบบ
// เรียลไทม์คู่กับ listenOrders() ด้านบน ใช้โชว์จุดแดงในตาราง (ดู renderOrderRow() ใน
// js/orders-tab-row.js) แยก unsubscribe คนละตัวกับ listener คำสั่งผลิตเดิม เพราะเป็น collection
// คนละตัว (design_approvals ไม่ใช่ orders) และต้องเลิกฟังพร้อมกันตอน stopOrdersTab()
let approvalSummary = {};
let unsubscribeApprovals = null;
let started = false;
export let statusFilterValue = ""; // "" = ทุกสถานะ, else key ของ ORDER_STATUS (export: orders-tab-export.js อ่านอย่างเดียว)
export let jumpFilter = null; // "duesoon" | "overdue" | null (export: orders-tab-export.js อ่านอย่างเดียว)
export const ORDERS_PAGE_SIZE = 10; // export: orders-tab-pagination.js อ่านอย่างเดียว
export let currentPage = 1; // export: orders-tab-pagination.js อ่าน + เขียนผ่าน setCurrentPage() ด้านล่าง (import binding ธรรมดาเขียนข้ามไฟล์ไม่ได้ ต้องมี setter)
let selectedOrderIds = new Set(); // bulk actions: id ที่ถูกเลือก (คงอยู่ข้ามการ re-render/หน้า)
export const pendingDeleteOrderIds = new Set(); // id ที่กำลังรอ "เลิกทำ" อยู่ในช่วง undo หลังลบ (export: orders-tab-export.js อ่านอย่างเดียว)

// setter สำหรับ currentPage — orders-tab-pagination.js เรียกใช้ตอน clamp หน้า/กดปุ่มเปลี่ยนหน้า
// (import binding ปกติของ `export let` อ่านได้อย่างเดียวจากไฟล์ที่ import ไป เขียนไม่ได้ตรงๆ)
export function setCurrentPage(page) { currentPage = page; }

// ── Public API เรียกจาก admin-page.js ──────────────────────────────
export function initOrdersTab() {
  if (started) return;
  started = true;
  loadProductPicker();
  loadStaffPicker();
  loadQuoteRequestPicker();
  startOrdersListener();
}

// ให้ admin-page.js ลงทะเบียนฟังก์ชันที่จะเรียกทุกครั้งที่ข้อมูลคำสั่งผลิตเปลี่ยน (เช่น renderNotifBell)
// เพื่อให้ notification bell รวมคำสั่งผลิตที่เกินกำหนด/ใกล้ครบกำหนดเข้ากับลีดใหม่ได้แบบเรียลไทม์
let onOrdersChangedCb = null;
export function onOrdersChanged(cb) { onOrdersChangedCb = cb; }

// การ์ดสถิติคำสั่งผลิต (คลิกแล้วกรอง) ถูกย้ายไปอยู่หน้า "ภาพรวม" แล้ว แต่ตัวกรอง/ตาราง
// ยังอยู่ที่แท็บ "คำสั่งผลิต" — เลยต้องให้ admin-page.js ผูกฟังก์ชันสลับแท็บมาให้ที่นี่
// เพื่อสลับไปแท็บคำสั่งผลิตพร้อมกันตอนกดการ์ด (คล้ายรูปแบบเดียวกับ onOrdersChanged)
let onRequestOrdersTabCb = null;
export function onRequestOrdersTab(cb) { onRequestOrdersTabCb = cb; }

// ทางกลับกัน: ปุ่ม "ดูสรุปภาพรวมการผลิต" ในแท็บคำสั่งผลิต ใช้พาไปหน้าภาพรวม
let onRequestOverviewTabCb = null;
export function onRequestOverviewTab(cb) { onRequestOverviewTabCb = cb; }

// ผูก/ผูกใหม่ listener ของคำสั่งผลิต — แยกออกมาต่างหากเพื่อให้ปุ่ม "ลองใหม่" เรียกซ้ำได้
// โดยไม่ต้อง refresh ทั้งหน้า (เลิกฟัง listener เดิมก่อนเสมอกันซ้อนกัน)
function startOrdersListener() {
  if (unsubscribe) { unsubscribe(); unsubscribe = null; }
  unsubscribe = listenOrders(orders => {
    allOrders = orders;
    render();
    if (onOrdersChangedCb) onOrdersChangedCb();
  }, err => {
    tableBody.innerHTML = `<tr><td colspan="8">${errorStateHTML(`โหลดข้อมูลไม่สำเร็จ: ${err.message || ""}`, startOrdersListener, { wrapTag: "span" })}</td></tr>`;
  });
  // P0.2-fix: ฟัง design_approvals คู่กันไปเลยตั้งแต่เปิดแท็บ — ไม่ต้อง fail ทั้งแท็บถ้าพลาด
  // (แค่จุดแดงจะไม่ขึ้น ตารางคำสั่งผลิตหลักยังใช้งานได้ปกติ)
  if (unsubscribeApprovals) { unsubscribeApprovals(); unsubscribeApprovals = null; }
  unsubscribeApprovals = listenDesignApprovalsSummary(summary => {
    approvalSummary = summary;
    render();
  }, err => console.error("[orders-tab] listenDesignApprovalsSummary error:", err));
}

export function stopOrdersTab() {
  if (unsubscribe) { unsubscribe(); unsubscribe = null; }
  if (unsubscribeApprovals) { unsubscribeApprovals(); unsubscribeApprovals = null; }
  started = false;
  allOrders = [];
  approvalSummary = {};
}

// ── ใช้จาก admin-page.js เพื่อรวมคำสั่งผลิตที่เกินกำหนด/ใกล้ครบกำหนดเข้ากับ notification bell ──
// คืนค่ารายการคำสั่งผลิตที่ยังไม่จบงาน (ไม่รวม completed/cancelled) แยกเป็นเกินกำหนด/ใกล้ครบกำหนด
export function getOrderReminders() {
  const overdue = [];
  const dueSoon = [];
  allOrders.forEach(o => {
    const u = orderUrgency(o);
    if (u === "overdue") overdue.push(o);
    else if (u === "due-soon") dueSoon.push(o);
  });
  return { overdue, dueSoon };
}

// กระโดดไปแท็บคำสั่งผลิตพร้อมกรองตามความเร่งด่วน (ใช้ตอนกดรายการแจ้งเตือนใน bell)
export function jumpToOrderReminder(kind) {
  setStatusFilter("");
  searchInput.value = "";
  jumpFilter = kind;
  currentPage = 1;
  render();
}

// ── ใช้จาก Global Search (admin-page.js) ──────────────────────────────
// คืนรายการคำสั่งผลิตทั้งหมด ให้ global search ใช้ทำดัชนีค้นหาข้ามแท็บได้
export function getAllOrders() { return allOrders; }

// กระโดดไปหาคำสั่งผลิตรายการที่ระบุจากผลลัพธ์ค้นหา — สลับไปแท็บย่อย "ภาพรวม" (แสดงทุกสถานะ)
// ล้างตัวกรองอื่น ๆ ทิ้ง แล้วใส่คำค้นเป็นเลขที่คำสั่งเพื่อกรองให้เหลือรายการนี้เด่นที่สุด
// จากนั้นเลื่อนจอไปหาแถว/การ์ดของรายการนั้นพร้อมไฮไลต์ชั่วครู่
export function jumpToOrder(order) {
  if (!order) return;
  setStatusFilter("");
  jumpFilter = null;
  searchInput.value = order.code || order.customer || "";
  currentPage = 1;
  render();
  requestAnimationFrame(() => {
    const el = (tableBody && tableBody.querySelector(`tr[data-id="${order.id}"]`)) ||
               (kanbanView && kanbanView.querySelector(`[data-id="${order.id}"]`));
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("ad-search-highlight");
    setTimeout(() => el.classList.remove("ad-search-highlight"), 1800);
  });
}

// ── ปุ่มลัด "ดูสรุปภาพรวมการผลิต" — เดิมสถิติ/กราฟ/แยกหมวดอยู่ในแท็บนี้เอง
// (ผ่านแท็บย่อยภาพรวม/คำสั่งผลิต/การจัดส่ง) ตอนนี้ย้ายไปอยู่หน้า "ภาพรวม" แล้ว
// ปุ่มนี้แค่พาไปหน้านั้นผ่าน callback ที่ admin-page.js ผูกมาให้
const viewSummaryBtn = document.getElementById("cp-view-summary-btn");
if (viewSummaryBtn) {
  viewSummaryBtn.addEventListener("click", () => {
    if (onRequestOverviewTabCb) onRequestOverviewTabCb();
  });
}

searchInput.addEventListener("input", () => { currentPage = 1; jumpFilter = null; render(); });

// ── "งานของฉัน" toggle — กรองตาราง/kanban เหลือเฉพาะคำสั่งผลิตที่ assignee === uid ผู้ใช้ปัจจุบัน ──
if (mineToggleBtn) {
  mineToggleBtn.addEventListener("click", () => {
    mineOnly = !mineOnly;
    mineToggleBtn.classList.toggle("active", mineOnly);
    currentPage = 1;
    render();
  });
}

function setStatusFilter(status) {
  statusFilterValue = status || "";
  statusPillsBox.querySelectorAll(".cp-status-pill").forEach(b => {
    const isActive = (b.dataset.status || "") === statusFilterValue;
    b.classList.toggle("active", isActive);
    b.setAttribute("aria-selected", isActive ? "true" : "false");
  });
}
statusPillsBox.querySelectorAll(".cp-status-pill").forEach(btn => {
  btn.addEventListener("click", () => {
    setStatusFilter(btn.dataset.status);
    jumpFilter = null;
    currentPage = 1;
    render();
  });
});

// ── View toggle (table / kanban) ──────────────────────────────
viewToggleBox.querySelectorAll(".cp-view-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    activeView = btn.dataset.view;
    currentPage = 1;
    viewToggleBox.querySelectorAll(".cp-view-btn").forEach(b => b.classList.toggle("active", b === btn));
    tableView.style.display    = activeView === "table"    ? "" : "none";
    kanbanView.style.display   = activeView === "kanban"   ? "" : "none";
    calendarView.style.display = activeView === "calendar" ? "" : "none";
    render();
  });
});

// ── Chart range toggle (7 / 30 days) ──────────────────────────────
if (chartMetricBox) {
  chartMetricBox.querySelectorAll(".cchart-range-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      chartMetric = btn.dataset.metric;
      chartMetricBox.querySelectorAll(".cchart-range-btn").forEach(b => b.classList.toggle("active", b === btn));
      render();
    });
  });
}

chartRangeBox.querySelectorAll(".cchart-range-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    chartRange = Number(btn.dataset.range);
    chartRangeBox.querySelectorAll(".cchart-range-btn").forEach(b => b.classList.toggle("active", b === btn));
    render();
  });
});

// ── Stat card quick-jump ──────────────────────────────
// การ์ด "งานใหม่" (cp-stat-card-new) อยู่รวมกับการ์ดคำสั่งผลิตอื่น ๆ ในกริดสถิติเดียวกัน
// ที่หน้าภาพรวม (#cp-stats-grid) แล้ว จึงผูก event ไว้ที่นี่เหมือนการ์ดใบอื่น ๆ
export function jumpToNewOrders() {
  if (onRequestOrdersTabCb) onRequestOrdersTabCb();
  searchInput.value = "";
  jumpFilter = null;
  setStatusFilter("received");
  currentPage = 1;
  render();
}
document.getElementById("cp-stat-card-new").addEventListener("click", jumpToNewOrders);
document.getElementById("cp-stat-card-production").addEventListener("click", () => {
  if (onRequestOrdersTabCb) onRequestOrdersTabCb();
  searchInput.value = "";
  jumpFilter = null;
  setStatusFilter("production");
  currentPage = 1;
  render();
});
document.getElementById("cp-stat-card-completed").addEventListener("click", () => {
  if (onRequestOrdersTabCb) onRequestOrdersTabCb();
  searchInput.value = "";
  jumpFilter = null;
  setStatusFilter("completed");
  currentPage = 1;
  render();
});
document.getElementById("cp-stat-card-duesoon").addEventListener("click", () => {
  if (onRequestOrdersTabCb) onRequestOrdersTabCb();
  setStatusFilter("");
  searchInput.value = "";
  jumpFilter = "duesoon";
  currentPage = 1;
  render();
});
document.getElementById("cp-stat-card-overdue").addEventListener("click", () => {
  if (onRequestOrdersTabCb) onRequestOrdersTabCb();
  setStatusFilter("");
  searchInput.value = "";
  jumpFilter = "overdue";
  currentPage = 1;
  render();
});

// ── Render ──────────────────────────────
export function formatBaht(n) {
  return "฿" + Math.round(n || 0).toLocaleString("th-TH");
}

// render() ถูกแบ่งเป็นบล็อกย่อย ๆ ห่อด้วย try/catch แยกกัน เพื่อกัน error ของ
// ส่วนใดส่วนหนึ่ง (เช่น การ์ดสถิติ/กราฟ/breakdown) ไม่ให้ทำให้ "ตารางคำสั่งผลิต"
// ไม่อัปเดตหรือว่างเปล่าไปด้วย — ถ้าพลาดตรงไหนจะ log ไว้ใน console และ render
// ส่วนที่เหลือต่อไปตามปกติ
export function render() {
  let stats = null;
  try {
    stats = computeOrderStats(allOrders);
    renderStatsCards(stats);
  } catch (err) {
    console.error("[orders-tab] render(): อัปเดตการ์ดสถิติล้มเหลว", err);
  }

  try {
    if (stats) renderChart(stats);
  } catch (err) {
    console.error("[orders-tab] render(): renderChart ล้มเหลว", err);
  }

  try {
    if (stats) renderBreakdown(stats);
  } catch (err) {
    console.error("[orders-tab] render(): renderBreakdown ล้มเหลว", err);
  }

  try {
    let rows = filterOrders(allOrders, {
      searchTerm: searchInput.value,
      statusFilterValue,
      jumpFilter,
      mineOnly,
      currentUserUid: auth.currentUser ? auth.currentUser.uid : null,
      excludeIds: pendingDeleteOrderIds,
    });

    if (activeView === "kanban") {
      paginationBox.style.display = "none";
      renderKanban(rows);
    } else if (activeView === "calendar") {
      paginationBox.style.display = "none";
      renderCalendar(rows);
    } else {
      renderPagination(rows.length);
      const start = (currentPage - 1) * ORDERS_PAGE_SIZE;
      renderTable(rows.slice(start, start + ORDERS_PAGE_SIZE));
    }
  } catch (err) {
    console.error("[orders-tab] render(): แสดงตาราง/kanban คำสั่งผลิตล้มเหลว", err);
    if (tableBody) {
      tableBody.innerHTML = `<tr><td colspan="8">${errorStateHTML(`แสดงตารางคำสั่งผลิตไม่สำเร็จ: ${err.message || ""}`, () => render(), { wrapTag: "span" })}</td></tr>`;
    }
    if (paginationBox) paginationBox.style.display = "none";
  }
}

function renderTable(rows) {
  if (!rows.length) {
    tableBody.innerHTML = `<tr><td colspan="8" class="cp-empty">ไม่พบคำสั่งผลิต</td></tr>`;
    updateOrdersBulkBar();
    return;
  }

  tableBody.innerHTML = rows.map(o => {
    try {
      return renderOrderRow(o, selectedOrderIds, approvalSummary);
    } catch (err) {
      console.error("[orders-tab] renderTable(): แสดงแถวคำสั่งผลิตล้มเหลว", o && o.id, err);
      return `<tr data-id="${o && o.id || ""}"><td colspan="8" class="cp-empty">แสดงรายการนี้ไม่สำเร็จ (เลขที่: ${escapeHtml((o && o.code) || (o && o.id) || "-")})</td></tr>`;
    }
  }).join("");
  updateOrdersBulkBar();
}
// renderOrderRow() ย้ายไปอยู่ js/orders-tab-row.js แล้ว (pure function — ดูคอมเมนต์หัวไฟล์นี้ รอบที่ 35)

// ── Bulk actions (เลือกหลายแถว + ลบ/เปลี่ยนสถานะทีเดียว) ──────────────────────────────
function updateOrdersBulkBar() {
  if (!oBulkBar) return;
  oBulkCount.textContent = selectedOrderIds.size;
  oBulkBar.classList.toggle("active", selectedOrderIds.size > 0);
  if (oHeadCheck) {
    const rowChecks = Array.from(tableBody.querySelectorAll(".cp-o-row-check"));
    oHeadCheck.checked = rowChecks.length > 0 && rowChecks.every(cb => cb.checked);
  }
}

tableBody.addEventListener("change", (e) => {
  if (!e.target.classList.contains("cp-o-row-check")) return;
  const id = e.target.dataset.id;
  if (e.target.checked) selectedOrderIds.add(id); else selectedOrderIds.delete(id);
  updateOrdersBulkBar();
});

if (oHeadCheck) {
  oHeadCheck.addEventListener("change", () => {
    tableBody.querySelectorAll(".cp-o-row-check").forEach(cb => {
      cb.checked = oHeadCheck.checked;
      if (oHeadCheck.checked) selectedOrderIds.add(cb.dataset.id); else selectedOrderIds.delete(cb.dataset.id);
    });
    updateOrdersBulkBar();
  });
}

if (oBulkClearBtn) {
  oBulkClearBtn.addEventListener("click", () => {
    selectedOrderIds.clear();
    tableBody.querySelectorAll(".cp-o-row-check").forEach(cb => { cb.checked = false; });
    updateOrdersBulkBar();
  });
}

if (oBulkApplyBtn) {
  oBulkApplyBtn.addEventListener("click", async () => {
    const status = oBulkStatusSelect.value;
    if (!status || !selectedOrderIds.size) return;
    const ids = Array.from(selectedOrderIds);
    oBulkApplyBtn.disabled = true;
    try {
      await Promise.all(ids.map(id => updateOrder(id, { status })));
      showToast(`เปลี่ยนสถานะแล้ว ${ids.length} รายการ`, "success");
      selectedOrderIds.clear();
      oBulkStatusSelect.value = "";
    } catch (err) {
      showToast("อัปเดตสถานะไม่สำเร็จ: " + err.message, "error");
    } finally {
      oBulkApplyBtn.disabled = false;
      updateOrdersBulkBar();
    }
  });
}

if (oBulkDeleteBtn) {
  oBulkDeleteBtn.addEventListener("click", async () => {
    if (!selectedOrderIds.size) return;
    const ids = Array.from(selectedOrderIds);
    if (!(await confirmDialog(`ลบคำสั่งผลิตที่เลือก ${ids.length} รายการ? ไม่สามารถกู้คืนได้`, { title: "ลบหลายรายการ" }))) return;
    oBulkDeleteBtn.disabled = true;
    try {
      await Promise.all(ids.map(id => deleteOrder(id)));
      ids.forEach(id => logAudit("delete", "order", id, "bulk"));
      showToast(`ลบแล้ว ${ids.length} รายการ`, "success");
      selectedOrderIds.clear();
    } catch (err) {
      showToast("ลบไม่สำเร็จ: " + err.message, "error");
    } finally {
      oBulkDeleteBtn.disabled = false;
      updateOrdersBulkBar();
    }
  });
}

tableBody.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-action]");
  if (btn) {
    const tr = btn.closest("tr");
    const id = tr.dataset.id;
    const order = allOrders.find(o => o.id === id);
    if (!order) return;
    if (btn.dataset.action === "detail") openOrderModal(order);
    if (btn.dataset.action === "design") openOrderModal(order, "design-approvals");
    if (btn.dataset.action === "clone") openOrderModalClone(order);
    if (btn.dataset.action === "delete") confirmDeleteOrder(order);
    return;
  }
  // ทั้งแถวคลิกได้ (ไม่ใช่แค่ปุ่ม) — ยกเว้นคลิกที่ checkbox เลือกหลายแถว
  if (e.target.closest("input")) return;
  const tr = e.target.closest("tr[data-id]");
  if (!tr || !tr.classList.contains("cp-row-clickable")) return;
  const order = allOrders.find(o => o.id === tr.dataset.id);
  if (order) openOrderModal(order);
});

export async function confirmDeleteOrder(order) {
  if (!(await confirmDialog(`ลบคำสั่งผลิต "${order.code || order.item}" ใช่หรือไม่?`, { title: "ลบคำสั่งผลิต" }))) return;
  const id = order.id;
  pendingDeleteOrderIds.add(id);
  render();
  const undone = await showUndoToast(`ลบคำสั่งผลิต "${order.code || order.item}" แล้ว`, 5000);
  if (undone) {
    pendingDeleteOrderIds.delete(id);
    render();
    return;
  }
  try {
    await deleteOrder(id);
    logAudit("delete", "order", id, order.code || order.item || "");
    pendingDeleteOrderIds.delete(id);
    render();
    showToast("ลบคำสั่งผลิตแล้ว", "success");
  } catch (err) {
    pendingDeleteOrderIds.delete(id);
    render();
    showToast("ลบไม่สำเร็จ: " + err.message, "error");
  }
}


// ── Toast notifications (ใช้ร่วมกับหน้า admin ทั้งหน้า) ──────────────────────────────
let toastWrap = null;
export function showToast(message, kind = "success") {
  if (!toastWrap) {
    toastWrap = document.querySelector(".cp-toast-wrap") || document.createElement("div");
    toastWrap.className = "cp-toast-wrap";
    if (!toastWrap.isConnected) document.body.appendChild(toastWrap);
  }
  const el = document.createElement("div");
  el.className = `cp-toast ${kind}`;
  el.textContent = message;
  toastWrap.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
}

// initials()/avatarHtml() ย้ายไปใช้จาก js/admin-utils.js แล้ว (ก็อปซ้ำเดิม — ดูคอมเมนต์หัวไฟล์นี้ รอบที่ 35)
