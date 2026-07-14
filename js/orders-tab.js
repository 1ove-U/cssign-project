// ===========================
// js/orders-tab.js — คำสั่งผลิต (Order Queue) tab, embedded inside admin.html
// อแดปต์มาจาก console-page.js เดิม — ตัดส่วน login/gate ออก เพราะใช้ระบบล็อกอิน
// เดียวกับ admin-page.js (ad-gate/ad-app) อยู่แล้ว ไฟล์นี้ export แค่
// initOrdersTab()/stopOrdersTab() ให้ admin-page.js เรียกตอน login/logout
// ===========================
import { listenOrders, addOrder, updateOrder, deleteOrder, logAudit,
         computeOrderStats, orderUrgency, daysUntilDue, ORDER_STATUS,
         ORDER_STATUS_FLOW,
         getProducts, getCategories } from "./db.js";
import { confirmDialog, emptyStateHTML, attachInlineValidation, validateFormInline,
         attachUnsavedGuard, showUndoToast, errorStateHTML,
         monthlySnapshotUpdate, renderSparkline } from "./ui-helpers.js";

// snapshot รายเดือนของสถิติคำสั่งผลิต (คนละ storage key จากสถิติเนื้อหาเว็บไซต์ใน
// admin-page.js) — ใช้วาด sparkline จริงใต้ตัวเลขงานใหม่/กำลังผลิต/เสร็จแล้ว/ใกล้กำหนดส่ง
const ORDERS_SNAPSHOT_KEY = "cssign_admin_orders_snapshot_v1";

// ── Modal overlay helper (ดูคำอธิบายเดียวกันใน admin-page.js) ──
let openOverlayCount = 0;
function openOverlay(el) {
  if (!el) return;
  el.style.display = "flex";
  const scrollBox = el.querySelector(".cp-modal, .ad-pf-view");
  if (scrollBox) scrollBox.scrollTop = 0;
  if (openOverlayCount === 0) {
    const scrollbarW = window.innerWidth - document.documentElement.clientWidth;
    document.body.classList.add("cp-scroll-locked");
    if (scrollbarW > 0) document.body.style.paddingRight = scrollbarW + "px";
  }
  openOverlayCount++;
}
function closeOverlay(el) {
  if (!el) return;
  el.style.display = "none";
  openOverlayCount = Math.max(0, openOverlayCount - 1);
  if (openOverlayCount === 0) {
    document.body.classList.remove("cp-scroll-locked");
    document.body.style.paddingRight = "";
  }
}

const statNew        = document.getElementById("cp-stat-new");
const statCompliant = document.getElementById("cp-stat-compliant");
const statTotal       = document.getElementById("cp-stat-total");
const statDueSoon     = document.getElementById("cp-stat-duesoon");
const statOverdue     = document.getElementById("cp-stat-overdue");
const statProduction   = document.getElementById("cp-stat-production");
const statCompleted    = document.getElementById("cp-stat-completed");
const statSales        = document.getElementById("cp-stat-sales");
const statSalesTrend   = document.getElementById("cp-stat-sales-trend");
const chartBars       = document.getElementById("cp-chart-bars");
const chartTitle      = document.getElementById("cp-chart-title");
const chartRangeBox   = document.getElementById("cp-chart-range");
const chartMetricBox  = document.getElementById("cp-chart-metric");
const breakdownCat    = document.getElementById("cp-breakdown-cat");
const breakdownCust   = document.getElementById("cp-breakdown-cust");
const tableBody       = document.getElementById("cp-table-body");
const searchInput     = document.getElementById("cp-search");
const statusPillsBox  = document.getElementById("cp-filter-status-pills");
const addBtn          = document.getElementById("cp-add-btn");
const paginationBox   = document.getElementById("cp-pagination");
const paginationInfo  = document.getElementById("cp-pagination-info");
const paginationBtns  = document.getElementById("cp-pagination-btns");
const ordersBadge     = document.getElementById("ad-orders-badge");

const viewToggleBox   = document.getElementById("cp-view-toggle");
const tableView       = document.getElementById("cp-table-view");
const kanbanView      = document.getElementById("cp-kanban-view");
const exportCsvBtn    = document.getElementById("cp-export-csv-btn");
const printBtn        = document.getElementById("cp-print-btn");
const printReportBox  = document.getElementById("cp-print-report");

// ── Bulk actions bar (เลือกหลายแถว + ลบ/เปลี่ยนสถานะทีเดียว) ──
const oBulkBar          = document.getElementById("cp-bulk-bar");
const oBulkCount        = document.getElementById("cp-bulk-count");
const oBulkClearBtn     = document.getElementById("cp-bulk-clear");
const oBulkStatusSelect = document.getElementById("cp-bulk-status-select");
const oBulkApplyBtn     = document.getElementById("cp-bulk-apply-status");
const oBulkDeleteBtn    = document.getElementById("cp-bulk-delete");
const oHeadCheck        = document.getElementById("cp-head-check");

const orderOverlay = document.getElementById("cp-order-overlay");
const orderForm     = document.getElementById("cp-order-form");
const orderModalTitle = document.getElementById("cp-order-modal-title");
const orderCancelBtn  = document.getElementById("cp-order-cancel");
attachInlineValidation(orderForm);
const productSelect     = document.getElementById("cp-o-product");
const unitPriceRow      = document.getElementById("cp-o-unit-price-row");
const unitPriceDisplay  = document.getElementById("cp-o-unit-price-display");
const unitPriceHidden   = document.getElementById("cp-o-unit-price");

let allOrders = [];
let allProducts = [];
let catNameMap = {};
let activeView = "table"; // "table" | "kanban"
let chartRange = 7; // 7 | 30
let chartMetric = "count"; // "count" | "revenue"
let unsubscribe = null;
let started = false;
let dragOrderId = null;
let statusFilterValue = ""; // "" = ทุกสถานะ, else key ของ ORDER_STATUS
let jumpFilter = null; // "duesoon" | "overdue" | null
const ORDERS_PAGE_SIZE = 10;
let currentPage = 1;
let selectedOrderIds = new Set(); // bulk actions: id ที่ถูกเลือก (คงอยู่ข้ามการ re-render/หน้า)
const pendingDeleteOrderIds = new Set(); // id ที่กำลังรอ "เลิกทำ" อยู่ในช่วง undo หลังลบ

// ── Public API เรียกจาก admin-page.js ──────────────────────────────
export function initOrdersTab() {
  if (started) return;
  started = true;
  loadProductPicker();
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
    tableBody.innerHTML = `<tr><td colspan="10">${errorStateHTML(`โหลดข้อมูลไม่สำเร็จ: ${err.message || ""}`, startOrdersListener, { wrapTag: "span" })}</td></tr>`;
  });
}

export function stopOrdersTab() {
  if (unsubscribe) { unsubscribe(); unsubscribe = null; }
  started = false;
  allOrders = [];
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

// ── Product picker (ผูกคำสั่งผลิตกับสินค้าจริงในแคตตาล็อก เพื่อคำนวณยอดขาย) ──
async function loadProductPicker() {
  try {
    const [products, categories] = await Promise.all([getProducts(), getCategories()]);
    allProducts = products || [];
    catNameMap = {};
    (categories || []).forEach(c => { catNameMap[c.id] = c.name; });
    productSelect.innerHTML = '<option value="">— เลือกสินค้าจากแคตตาล็อก (ไม่บังคับ แต่จำเป็นถ้าต้องการนับยอดขาย) —</option>' +
      allProducts.map(p => {
        const priceLabel = p.price ? ` — ฿${Number(p.price).toLocaleString("th-TH")}` : "";
        return `<option value="${p.id}">${escapeHtml(p.name || "สินค้า")}${priceLabel}</option>`;
      }).join("");
  } catch (err) {
    console.warn("โหลดรายการสินค้าสำหรับผูกคำสั่งผลิตไม่สำเร็จ", err);
  }
}

productSelect.addEventListener("change", () => {
  const product = allProducts.find(p => p.id === productSelect.value);
  if (!product) {
    unitPriceRow.style.display = "none";
    unitPriceHidden.value = "0";
    return;
  }
  document.getElementById("cp-o-item").value = product.name || "";
  document.getElementById("cp-o-category").value = catNameMap[product.cat_id] || "";
  const price = Number(product.price) || 0;
  unitPriceHidden.value = String(price);
  unitPriceDisplay.value = price ? `฿${price.toLocaleString("th-TH")} / ${product.unit || "หน่วย"}` : "สินค้านี้ยังไม่ระบุราคา";
  unitPriceRow.style.display = "";
});

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
    tableView.style.display  = activeView === "table"  ? "" : "none";
    kanbanView.style.display = activeView === "kanban" ? "" : "none";
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
function formatBaht(n) {
  return "฿" + Math.round(n || 0).toLocaleString("th-TH");
}

// การ์ดเทียบยอดขาย "เดือนนี้ vs เดือนก่อน" — โชว์ทั้งตัวเลขสองเดือนและ % เปลี่ยนแปลง
// (ไม่ใช่แค่ % ตัวเดียวลอยๆ เหมือนแนวโน้มสถิติอื่นในแท็บภาพรวม)
function renderSalesTrendBadge(monthCompare) {
  if (!monthCompare) { statSalesTrend.className = "cp-stat-trend na"; statSalesTrend.innerHTML = ""; return; }
  const { pct, prevMonth } = monthCompare;
  const arrowUp   = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M12 19V5M5 12l7-7 7 7"/></svg>`;
  const arrowDown = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M12 5v14M5 12l7 7 7-7"/></svg>`;
  const flat      = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 12h14"/></svg>`;
  const label = `เทียบเดือนก่อน (${formatBaht(prevMonth)})`;
  statSalesTrend.title = label;
  if (pct > 0)      { statSalesTrend.className = "cp-stat-trend up";   statSalesTrend.innerHTML = `${arrowUp}+${pct}%`; }
  else if (pct < 0) { statSalesTrend.className = "cp-stat-trend down"; statSalesTrend.innerHTML = `${arrowDown}${pct}%`; }
  else              { statSalesTrend.className = "cp-stat-trend flat"; statSalesTrend.innerHTML = `${flat}0%`; }
}

// render() ถูกแบ่งเป็นบล็อกย่อย ๆ ห่อด้วย try/catch แยกกัน เพื่อกัน error ของ
// ส่วนใดส่วนหนึ่ง (เช่น การ์ดสถิติ/กราฟ/breakdown) ไม่ให้ทำให้ "ตารางคำสั่งผลิต"
// ไม่อัปเดตหรือว่างเปล่าไปด้วย — ถ้าพลาดตรงไหนจะ log ไว้ใน console และ render
// ส่วนที่เหลือต่อไปตามปกติ
function render() {
  let stats = null;
  try {
    stats = computeOrderStats(allOrders);
    statNew.textContent       = stats.newCount;
    statCompliant.textContent = stats.compliantRate + "%";
    statTotal.textContent      = allOrders.length;
    statDueSoon.textContent    = stats.dueSoonCount;
    statOverdue.textContent    = stats.overdueCount;
    statProduction.textContent = stats.inProductionCount;
    statCompleted.textContent  = stats.completedCount;
    statSales.innerHTML        = `${formatBaht(stats.salesToday)} <small>วันนี้</small> / ${formatBaht(stats.salesMonth)} <small>เดือนนี้</small>`;
    if (statSalesTrend) renderSalesTrendBadge(stats.monthCompare);

    const { history: ordersHistory } = monthlySnapshotUpdate(ORDERS_SNAPSHOT_KEY, {
      newCount: stats.newCount,
      inProductionCount: stats.inProductionCount,
      completedCount: stats.completedCount,
      dueSoonCount: stats.dueSoonCount
    });
    renderSparkline(document.getElementById("cp-spark-new"), ordersHistory.newCount);
    renderSparkline(document.getElementById("cp-spark-production"), ordersHistory.inProductionCount);
    renderSparkline(document.getElementById("cp-spark-completed"), ordersHistory.completedCount);
    renderSparkline(document.getElementById("cp-spark-duesoon"), ordersHistory.dueSoonCount);

    if (ordersBadge) {
      if (stats.overdueCount > 0) {
        ordersBadge.textContent = stats.overdueCount;
        ordersBadge.style.display = "inline-flex";
      } else {
        ordersBadge.style.display = "none";
      }
    }
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
    let rows = allOrders.filter(o => !pendingDeleteOrderIds.has(o.id));

    const term = searchInput.value.trim().toLowerCase();
    if (term) rows = rows.filter(o =>
      (o.code||"").toLowerCase().includes(term) ||
      (o.customer||"").toLowerCase().includes(term) ||
      (o.item||"").toLowerCase().includes(term)
    );
    if (statusFilterValue) rows = rows.filter(o => o.status === statusFilterValue);
    if (jumpFilter === "duesoon") rows = rows.filter(o => orderUrgency(o) === "due-soon");
    if (jumpFilter === "overdue") rows = rows.filter(o => orderUrgency(o) === "overdue");

    if (activeView === "kanban") {
      paginationBox.style.display = "none";
      renderKanban(rows);
    } else {
      renderPagination(rows.length);
      const start = (currentPage - 1) * ORDERS_PAGE_SIZE;
      renderTable(rows.slice(start, start + ORDERS_PAGE_SIZE));
    }
  } catch (err) {
    console.error("[orders-tab] render(): แสดงตาราง/kanban คำสั่งผลิตล้มเหลว", err);
    if (tableBody) {
      tableBody.innerHTML = `<tr><td colspan="10">${errorStateHTML(`แสดงตารางคำสั่งผลิตไม่สำเร็จ: ${err.message || ""}`, () => render(), { wrapTag: "span" })}</td></tr>`;
    }
    if (paginationBox) paginationBox.style.display = "none";
  }
}

// ── Pagination footer ("Showing 1–10 of 80") ──────────────────────────────
function buildPageList(current, total) {
  if (total <= 7) { const a = []; for (let i = 1; i <= total; i++) a.push(i); return a; }
  const pages = [1];
  if (current > 3) pages.push("…");
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) pages.push(i);
  if (current < total - 2) pages.push("…");
  pages.push(total);
  return pages;
}

function renderPagination(totalRows) {
  const totalPages = Math.max(1, Math.ceil(totalRows / ORDERS_PAGE_SIZE));
  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  if (!totalRows) {
    paginationBox.style.display = "none";
    return;
  }
  paginationBox.style.display = "flex";

  const start = totalRows ? (currentPage - 1) * ORDERS_PAGE_SIZE + 1 : 0;
  const end = Math.min(totalRows, currentPage * ORDERS_PAGE_SIZE);
  paginationInfo.textContent = `แสดง ${start}–${end} จาก ${totalRows} รายการ`;

  const pages = buildPageList(currentPage, totalPages);
  paginationBtns.innerHTML = `
    <button class="cp-page-btn cp-page-nav" data-page="prev" ${currentPage === 1 ? "disabled" : ""} aria-label="หน้าก่อนหน้า">‹</button>
    ${pages.map(p => p === "…"
      ? `<span class="cp-page-ellipsis">…</span>`
      : `<button class="cp-page-btn ${p === currentPage ? "active" : ""}" data-page="${p}">${p}</button>`
    ).join("")}
    <button class="cp-page-btn cp-page-nav" data-page="next" ${currentPage === totalPages ? "disabled" : ""} aria-label="หน้าถัดไป">›</button>
  `;
  paginationBtns.querySelectorAll(".cp-page-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      if (btn.disabled) return;
      if (btn.dataset.page === "prev") currentPage = Math.max(1, currentPage - 1);
      else if (btn.dataset.page === "next") currentPage = Math.min(totalPages, currentPage + 1);
      else currentPage = Number(btn.dataset.page);
      render();
      tableView.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  });
}

function renderChart(stats) {
  const isRevenue = chartMetric === "revenue";
  const metricLabel = isRevenue ? "รายได้รายวัน" : "คำสั่งผลิตใหม่รายวัน";
  chartTitle.textContent = chartRange === 30 ? `${metricLabel} (30 วันล่าสุด)` : `${metricLabel} (7 วันล่าสุด)`;

  let bars;
  if (chartRange === 30) {
    const series = isRevenue ? stats.revenueTrend30 : stats.trend30;
    const max = Math.max(1, ...series);
    bars = series.map((n, i) => {
      const pct = Math.round((n / max) * 100);
      const title = isRevenue ? formatBaht(n) : n;
      return `<i title="${title}" style="height:${Math.max(4,pct)}%;flex:1;border-radius:3px 3px 1px 1px;background:linear-gradient(180deg,var(--primary-light),var(--primary));opacity:${i>=25?1:.3}"></i>`;
    });
  } else if (isRevenue) {
    // stats.revenueWeekly เป็นค่าเงินจริง (บาท) ไม่ใช่ % สำเร็จรูปแบบ weekly (จำนวนงาน) เลยต้อง
    // คำนวณสัดส่วนความสูงเทียบ max เองตรงนี้
    const max = Math.max(1, ...stats.revenueWeekly);
    bars = stats.revenueWeekly.map((n, i) => {
      const pct = Math.round((n / max) * 100);
      return `<i title="${formatBaht(n)}" style="height:${Math.max(6,pct)}%;flex:1;border-radius:5px 5px 2px 2px;background:linear-gradient(180deg,var(--primary-light),var(--primary));opacity:${i>=5?1:.25}"></i>`;
    });
  } else {
    bars = stats.weekly.map((h, i) =>
      `<i style="height:${Math.max(6,h)}%;flex:1;border-radius:5px 5px 2px 2px;background:linear-gradient(180deg,var(--primary-light),var(--primary));opacity:${i>=5?1:.25}"></i>`
    );
  }
  chartBars.innerHTML = bars.join("");
}

function renderBreakdown(stats) {
  if (!stats.byCategory.length) {
    breakdownCat.innerHTML = `<div class="cp-empty">ไม่มีข้อมูล</div>`;
  } else {
    const max = Math.max(1, ...stats.byCategory.map(c => c.count));
    breakdownCat.innerHTML = stats.byCategory.slice(0, 6).map(c => `
      <div class="cp-breakdown-row">
        <span class="cp-breakdown-name" title="${escapeHtml(c.name)}">${escapeHtml(c.name)}</span>
        <span class="cp-breakdown-bar-wrap"><span class="cp-breakdown-bar" style="width:${Math.round(c.count/max*100)}%"></span></span>
        <span class="cp-breakdown-count">${c.count}</span>
      </div>`).join("");
  }
  if (!stats.topCustomers.length) {
    breakdownCust.innerHTML = `<div class="cp-empty">ไม่มีข้อมูล</div>`;
  } else {
    const max = Math.max(1, ...stats.topCustomers.map(c => c.count));
    breakdownCust.innerHTML = stats.topCustomers.map(c => `
      <div class="cp-breakdown-row">
        <span class="cp-breakdown-name" title="${escapeHtml(c.name)}">${escapeHtml(c.name)}</span>
        <span class="cp-breakdown-bar-wrap"><span class="cp-breakdown-bar" style="width:${Math.round(c.count/max*100)}%"></span></span>
        <span class="cp-breakdown-count">${c.count}</span>
      </div>`).join("");
  }
}

function renderTable(rows) {
  if (!rows.length) {
    tableBody.innerHTML = `<tr><td colspan="10" class="cp-empty">ไม่พบคำสั่งผลิต</td></tr>`;
    updateOrdersBulkBar();
    return;
  }

  tableBody.innerHTML = rows.map(o => {
    try {
      return renderOrderRow(o);
    } catch (err) {
      console.error("[orders-tab] renderTable(): แสดงแถวคำสั่งผลิตล้มเหลว", o && o.id, err);
      return `<tr data-id="${o && o.id || ""}"><td colspan="10" class="cp-empty">แสดงรายการนี้ไม่สำเร็จ (เลขที่: ${escapeHtml((o && o.code) || (o && o.id) || "-")})</td></tr>`;
    }
  }).join("");
  updateOrdersBulkBar();
}

function renderOrderRow(o) {
    const statusOptions = Object.entries(ORDER_STATUS).map(([key, v]) =>
      `<option value="${key}" ${o.status===key?"selected":""}>${v.label}</option>`).join("");
    const urgency = orderUrgency(o);
    return `
    <tr data-id="${o.id}">
      <td><input type="checkbox" class="cp-row-check cp-o-row-check" data-id="${o.id}" ${selectedOrderIds.has(o.id) ? "checked" : ""} aria-label="เลือกคำสั่งผลิตนี้"></td>
      <td class="cp-code" title="${escapeHtml(o.code||"")}">${escapeHtml(o.code||"—")}</td>
      <td><div class="cp-namecell">${avatarHtml(o.customer || "?")}<span class="cp-namecell-name" title="${escapeHtml(o.customer||"")}">${escapeHtml(o.customer||"—")}</span></div></td>
      <td title="${escapeHtml(o.item||"")}">${escapeHtml(o.item||"—")}</td>
      <td>${o.qty ?? "—"}</td>
      <td><select class="cp-status-select" data-action="status" data-status="${o.status}">${statusOptions}</select></td>
      <td class="cp-td-progress">
        <div class="cp-progress-wrap">
          <div class="cp-progress-bar"><i style="width:${o.progress||0}%"></i></div>
          <span>${o.progress||0}%</span>
        </div>
      </td>
      <td>${o.dueDate ? `<span class="${urgency==='overdue'?'cp-kanban-card-due is-overdue':urgency==='due-soon'?'cp-kanban-card-due is-duesoon':''}">${escapeHtml(o.dueDate)}</span>` : "—"}</td>
      <td>${o.compliant ? '<span class="cp-compliant-yes">✓ ผ่าน</span>' : '<span class="cp-compliant-no">—</span>'}</td>
      <td>
        <div class="cp-row-actions">
          <button class="cp-icon-btn" data-action="edit" title="แก้ไข"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button>
          <button class="cp-icon-btn" data-action="clone" title="ทำซ้ำ (เปิดฟอร์มเพิ่มใหม่พร้อมข้อมูลเดิม)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
          <button class="cp-icon-btn danger" data-action="delete" title="ลบ"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg></button>
        </div>
      </td>
    </tr>`;
}

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

const KANBAN_COLUMNS = [...ORDER_STATUS_FLOW, "cancelled"];

function renderKanban(rows) {
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
        const order = allOrders.find(o => o.id === card.dataset.id);
        if (!order) return;
        if (btn.dataset.action === "edit") openOrderModal(order);
        if (btn.dataset.action === "clone") openOrderModalClone(order);
        if (btn.dataset.action === "delete") confirmDeleteOrder(order);
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
      const order = allOrders.find(o => o.id === dragOrderId);
      dragOrderId = null;
      if (!order || order.status === newStatus) return;
      try {
        await updateOrder(order.id, { status: newStatus });
        showToast(`ย้าย "${order.code || order.item}" ไปยัง ${ORDER_STATUS[newStatus].label}`, "success");
      } catch (err) {
        showToast("อัปเดตสถานะไม่สำเร็จ: " + err.message, "error");
      }
    });
  });
}

function kanbanCardHtml(o) {
  const urgency = orderUrgency(o);
  const urgencyClass = urgency === "overdue" ? "is-overdue" : urgency === "due-soon" ? "is-duesoon" : "";
  return `
  <div class="cp-kanban-card ${urgencyClass}" draggable="true" data-id="${o.id}">
    <span class="cp-kanban-card-code">${escapeHtml(o.code||"—")}</span>
    <span class="cp-kanban-card-item">${escapeHtml(o.item||"—")}</span>
    <span class="cp-kanban-card-cust">${escapeHtml(o.customer||"—")} · จำนวน ${o.qty ?? "—"}</span>
    <div class="cp-kanban-card-foot">
      <span class="cp-kanban-card-due ${urgencyClass}">${o.dueDate ? escapeHtml(o.dueDate) : "ไม่ระบุกำหนดส่ง"}</span>
      <div class="cp-kanban-card-actions">
        <button class="cp-icon-btn" data-action="edit" title="แก้ไข"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button>
        <button class="cp-icon-btn" data-action="clone" title="ทำซ้ำ"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
        <button class="cp-icon-btn danger" data-action="delete" title="ลบ"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg></button>
      </div>
    </div>
  </div>`;
}

tableBody.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  const tr = btn.closest("tr");
  const id = tr.dataset.id;
  const order = allOrders.find(o => o.id === id);
  if (!order) return;

  if (btn.dataset.action === "edit") openOrderModal(order);
  if (btn.dataset.action === "clone") openOrderModalClone(order);
  if (btn.dataset.action === "delete") confirmDeleteOrder(order);
});

async function confirmDeleteOrder(order) {
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

tableBody.addEventListener("change", async (e) => {
  if (e.target.dataset.action !== "status") return;
  const tr = e.target.closest("tr");
  const id = tr.dataset.id;
  e.target.dataset.status = e.target.value;
  try {
    await updateOrder(id, { status: e.target.value });
    showToast("อัปเดตสถานะแล้ว", "success");
  } catch (err) { showToast("อัปเดตสถานะไม่สำเร็จ: " + err.message, "error"); }
});

// ── Add/Edit modal ──────────────────────────────
addBtn.addEventListener("click", () => openOrderModal(null));
orderCancelBtn.addEventListener("click", () => orderFormGuard.guardedClose());
orderOverlay.addEventListener("click", (e) => { if (e.target === orderOverlay) orderFormGuard.guardedClose(); });

const orderFormGuard = attachUnsavedGuard({ overlay: orderOverlay, form: orderForm, doClose: closeOrderModal });

function openOrderModal(order) {
  orderModalTitle.textContent = order ? "แก้ไขคำสั่งผลิต" : "เพิ่มคำสั่งผลิต";
  document.getElementById("cp-o-id").value         = order ? order.id : "";
  document.getElementById("cp-o-code").value       = order ? order.code || "" : "";
  document.getElementById("cp-o-customer").value   = order ? order.customer || "" : "";
  document.getElementById("cp-o-phone").value      = order ? order.phone || "" : "";
  productSelect.value                              = order ? order.product_id || "" : "";
  document.getElementById("cp-o-item").value       = order ? order.item || "" : "";
  document.getElementById("cp-o-category").value   = order ? order.category || "" : "";
  const price = order ? Number(order.unit_price) || 0 : 0;
  unitPriceHidden.value = String(price);
  if (order && order.product_id && price) {
    const product = allProducts.find(p => p.id === order.product_id);
    unitPriceDisplay.value = `฿${price.toLocaleString("th-TH")} / ${(product && product.unit) || "หน่วย"}`;
    unitPriceRow.style.display = "";
  } else {
    unitPriceRow.style.display = "none";
  }
  document.getElementById("cp-o-qty").value        = order ? order.qty || 1 : 1;
  document.getElementById("cp-o-due").value        = order ? order.dueDate || "" : "";
  document.getElementById("cp-o-status").value     = order ? order.status || "received" : "received";
  document.getElementById("cp-o-progress").value   = order ? order.progress || 0 : 0;
  document.getElementById("cp-o-compliant").checked = order ? !!order.compliant : true;
  document.getElementById("cp-o-notes").value      = order ? order.notes || "" : "";
  openOverlay(orderOverlay);
  orderFormGuard.capture();
}

function closeOrderModal() {
  closeOverlay(orderOverlay);
  orderForm.reset();
  unitPriceRow.style.display = "none";
  unitPriceHidden.value = "0";
}

// "ทำซ้ำ" — เปิดฟอร์ม "เพิ่มคำสั่งผลิต" พร้อมข้อมูลเดิมกรอกไว้ให้ (ไม่ใช่แก้ของเดิม) สำหรับงานที่คล้ายกัน
// ล้างเลขที่คำสั่งผลิต/กำหนดส่ง/สถานะ/ความคืบหน้า เพราะเป็นค่าเฉพาะของงานใหม่แต่ละครั้ง
function openOrderModalClone(order) {
  openOrderModal(order);
  document.getElementById("cp-o-id").value = "";
  document.getElementById("cp-o-code").value = "";
  document.getElementById("cp-o-due").value = "";
  document.getElementById("cp-o-status").value = "received";
  document.getElementById("cp-o-progress").value = 0;
  orderModalTitle.textContent = `ทำซ้ำคำสั่งผลิตจาก "${order.code || order.item || ""}"`;
  orderFormGuard.capture();
}

orderForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!validateFormInline(orderForm)) return;
  const id = document.getElementById("cp-o-id").value;
  const payload = {
    code:      document.getElementById("cp-o-code").value.trim(),
    customer:  document.getElementById("cp-o-customer").value.trim(),
    phone:     document.getElementById("cp-o-phone").value.trim(),
    item:      document.getElementById("cp-o-item").value.trim(),
    category:  document.getElementById("cp-o-category").value.trim(),
    product_id: productSelect.value,
    unit_price: Number(unitPriceHidden.value) || 0,
    qty:       document.getElementById("cp-o-qty").value,
    dueDate:   document.getElementById("cp-o-due").value,
    status:    document.getElementById("cp-o-status").value,
    progress:  document.getElementById("cp-o-progress").value,
    compliant: document.getElementById("cp-o-compliant").checked,
    notes:     document.getElementById("cp-o-notes").value.trim()
  };
  const btn = orderForm.querySelector('button[type=submit]');
  btn.disabled = true; btn.textContent = "กำลังบันทึก...";
  try {
    if (id) await updateOrder(id, payload);
    else    await addOrder(payload);
    closeOrderModal();
    showToast(id ? "บันทึกการแก้ไขแล้ว" : "เพิ่มคำสั่งผลิตแล้ว", "success");
  } catch (err) {
    showToast("บันทึกไม่สำเร็จ: " + err.message, "error");
  } finally {
    btn.disabled = false; btn.textContent = "บันทึก";
  }
});

// ── Export CSV ──────────────────────────────
exportCsvBtn.addEventListener("click", () => {
  const rows = getCurrentFilteredRows();
  if (!rows.length) { showToast("ไม่มีข้อมูลให้ส่งออก", "error"); return; }
  const headers = ["เลขที่คำสั่ง","ลูกค้า","รายการ","หมวดป้าย","จำนวน","สถานะ","ความคืบหน้า(%)","กำหนดส่ง","ผ่านมาตรฐาน มอก./ISO"];
  const csvRows = [headers.join(",")];
  rows.forEach(o => {
    csvRows.push([
      csvCell(o.code), csvCell(o.customer), csvCell(o.item), csvCell(o.category),
      o.qty ?? "", csvCell(ORDER_STATUS[o.status] ? ORDER_STATUS[o.status].label : o.status),
      o.progress ?? 0, csvCell(o.dueDate), o.compliant ? "ผ่าน" : "-"
    ].join(","));
  });
  const blob = new Blob(["\uFEFF" + csvRows.join("\r\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `production-orders-${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast("ส่งออก CSV แล้ว", "success");
});

function csvCell(val) {
  const s = String(val ?? "");
  return `"${s.replace(/"/g, '""')}"`;
}

// ── Print report ──────────────────────────────
printBtn.addEventListener("click", () => {
  const rows = getCurrentFilteredRows();
  const stats = computeOrderStats(allOrders);
  const now = new Date();
  printReportBox.innerHTML = `
    <h1>รายงานคำสั่งผลิต — CS.SIGN</h1>
    <div class="cp-print-sub">พิมพ์เมื่อ ${now.toLocaleDateString("th-TH")} ${now.toLocaleTimeString("th-TH")} · ทั้งหมด ${rows.length} รายการ (จากทั้งหมด ${allOrders.length} รายการ) · กำลังดำเนินการ ${stats.activeCount} · เกินกำหนด ${stats.overdueCount} · ใกล้ครบกำหนด ${stats.dueSoonCount}</div>
    <table>
      <thead><tr>
        <th>เลขที่คำสั่ง</th><th>ลูกค้า</th><th>รายการ</th><th>จำนวน</th><th>สถานะ</th><th>ความคืบหน้า</th><th>กำหนดส่ง</th><th>มอก./ISO</th>
      </tr></thead>
      <tbody>
        ${rows.map(o => `<tr>
          <td>${escapeHtml(o.code||"—")}</td>
          <td>${escapeHtml(o.customer||"—")}</td>
          <td>${escapeHtml(o.item||"—")}</td>
          <td>${o.qty ?? "—"}</td>
          <td>${escapeHtml(ORDER_STATUS[o.status] ? ORDER_STATUS[o.status].label : o.status)}</td>
          <td>${o.progress||0}%</td>
          <td>${escapeHtml(o.dueDate||"—")}</td>
          <td>${o.compliant ? "ผ่าน" : "—"}</td>
        </tr>`).join("")}
      </tbody>
    </table>`;
  window.print();
});

function getCurrentFilteredRows() {
  let rows = allOrders.filter(o => !pendingDeleteOrderIds.has(o.id));
  const term = searchInput.value.trim().toLowerCase();
  if (term) rows = rows.filter(o =>
    (o.code||"").toLowerCase().includes(term) ||
    (o.customer||"").toLowerCase().includes(term) ||
    (o.item||"").toLowerCase().includes(term)
  );
  if (statusFilterValue) rows = rows.filter(o => o.status === statusFilterValue);
  if (jumpFilter === "duesoon") rows = rows.filter(o => orderUrgency(o) === "due-soon");
  if (jumpFilter === "overdue") rows = rows.filter(o => orderUrgency(o) === "overdue");
  return rows;
}

// ── Toast notifications (ใช้ร่วมกับหน้า admin ทั้งหน้า) ──────────────────────────────
let toastWrap = null;
function showToast(message, kind = "success") {
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

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
}

// ── Avatar วงกลมตัวอักษรย่อ (ใช้แทนรูปโปรไฟล์ลูกค้าในตารางคำสั่งผลิต) ──
function initials(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts[0][0] + (parts[1] ? parts[1][0] : "")).toUpperCase();
}
function avatarHtml(name) {
  const safeName = String(name || "");
  const hues = [210, 265, 155, 25, 340, 190, 45];
  let h = 0; for (let i = 0; i < safeName.length; i++) h = (h * 31 + safeName.charCodeAt(i)) >>> 0;
  const hue = hues[h % hues.length];
  return `<span class="cp-avatar" style="background:hsl(${hue} 70% 94%); color:hsl(${hue} 55% 38%);">${escapeHtml(initials(safeName))}</span>`;
}
