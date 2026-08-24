// ===========================
// js/orders-tab-stats.js — การ์ดสถิติ/กราฟ/แยกหมวด ของแท็บคำสั่งผลิต (คำสั่งผลิตของ
// โปรเจกต์ CS.SIGN 2026)
//
// 2026 refactor phase 3 (ต่อ): แยกออกมาจาก js/orders-tab.js เดิม (761 บรรทัด) — ดูหมายเหตุ
// เต็มใน js/orders-tab.js ไฟล์นี้เก็บเฉพาะการ์ดสถิติด้านบน (คำสั่งผลิตใหม่/ยอดค้างชำระ/
// ทั้งหมด/ใกล้กำหนด/เกินกำหนด/กำลังผลิต/เสร็จแล้ว/ยอดขาย + sparkline/trend badge), กราฟแท่ง
// (7/30 วัน), และกล่องแยกหมวด (หมวดป้าย/ลูกค้า/สินค้าขายดี/ลูกค้าซื้อซ้ำ/หมวดขายดีเดือนนี้) —
// ไม่มีการเปลี่ยน logic ใดๆ จากของเดิม เป็นแค่ย้ายโค้ดเชิงโครงสร้าง — export
// `renderStatsCards(stats)`/`renderChart(stats)`/`renderBreakdown(stats)` ให้ render() ใน
// orders-tab.js เรียกแทนฟังก์ชัน local เดิม (ยังคงห่อด้วย try/catch แยกกันที่ orders-tab.js
// เหมือนเดิมทุกจุด เพื่อกัน error ของบล็อกใดบล็อกหนึ่งไม่ให้กระทบตาราง/kanban)
//
// หมายเหตุ: ตัวกรองกราฟ (chartRange/chartMetric) ยังเป็น state ของ orders-tab.js อยู่ (ปุ่ม
// สลับช่วง/ตัวชี้วัดกราฟยังอยู่ในไฟล์นั้น เพราะต้องเรียก render() ข้ามกลับมาตอนสลับ) — ไฟล์นี้
// import กลับมาใช้แบบอ่านอย่างเดียว ไม่มี reassign ข้ามไฟล์ จึงไม่ต้องมี setter (เพิ่ม export
// หน้าตัวแปรทั้งสองในไฟล์ต้นฉบับตรงๆ ได้เลย)
// ===========================
import { renderSparkline, renderTrendBadge } from "./ui-helpers.js";
import { formatBaht, escapeHtml, chartRange, chartMetric, getAllOrders } from "./orders-tab.js";

const statNew          = document.getElementById("cp-stat-new");
const statBalance      = document.getElementById("cp-stat-balance");
const statTotal        = document.getElementById("cp-stat-total");
const statDueSoon      = document.getElementById("cp-stat-duesoon");
const statOverdue      = document.getElementById("cp-stat-overdue");
const statProduction   = document.getElementById("cp-stat-production");
const statCompleted    = document.getElementById("cp-stat-completed");
const statSales        = document.getElementById("cp-stat-sales");
const statSalesTrend   = document.getElementById("cp-stat-sales-trend");
const ordersBadge      = document.getElementById("ad-orders-badge");
const chartBars        = document.getElementById("cp-chart-bars");
const chartTitle       = document.getElementById("cp-chart-title");
const breakdownCat     = document.getElementById("cp-breakdown-cat");
const breakdownCust    = document.getElementById("cp-breakdown-cust");
const breakdownProducts = document.getElementById("cp-breakdown-products");
const breakdownRepeat  = document.getElementById("cp-breakdown-repeat");
const breakdownTopCatMonth = document.getElementById("cp-breakdown-topcat-month");

// การ์ดเทียบยอดขาย — ป้ายทิศทาง 🔼/▶️/🔽 คำนวณจากค่าเฉลี่ยเคลื่อนที่ 3 เดือนล่าสุดของ
// รายได้จริงรายเดือน (stats.monthly.revenue) กันการตีความผิดจากเดือนเดียวที่ผิดปกติ
// (เดิมใช้แค่เทียบเดือนนี้กับเดือนก่อน 2 จุด) — ยังคงโชว์ตัวเลขเดือนก่อนจริงไว้ใน title
function renderSalesTrendBadge(stats) {
  const monthCompare = stats && stats.monthCompare;
  if (!monthCompare) { statSalesTrend.className = "cp-stat-trend na"; statSalesTrend.innerHTML = ""; return; }
  renderTrendBadge(statSalesTrend, stats.monthly.revenue,
    { title: `เทียบเดือนก่อน (${formatBaht(monthCompare.prevMonth)})` });
}

export function renderStatsCards(stats) {
  statNew.textContent       = stats.newCount;
  statBalance.textContent  = formatBaht(stats.totalBalance);
  statTotal.textContent      = getAllOrders().length; // เดิมอ่าน allOrders.length ตรงๆ (module-private ของ orders-tab.js) — getAllOrders() คืน array เดียวกันเป๊ะ ผลลัพธ์เหมือนเดิมทุกกรณี
  statDueSoon.textContent    = stats.dueSoonCount;
  statOverdue.textContent    = stats.overdueCount;
  statProduction.textContent = stats.inProductionCount;
  statCompleted.textContent  = stats.completedCount;
  statSales.innerHTML        = `${formatBaht(stats.salesToday)} <small>วันนี้</small> / ${formatBaht(stats.salesMonth)} <small>เดือนนี้</small>`;
  if (statSalesTrend) renderSalesTrendBadge(stats);

  // sparkline + ป้ายแนวโน้ม 4 การ์ดด้านบน — คำนวณจากข้อมูลจริงรายเดือน (stats.monthly)
  // แทน localStorage snapshot เดิม บางการ์ดถูกปรับความหมายให้สื่อ "แนวโน้ม" ที่มีจริง
  // ย้อนหลังได้ (แทนที่จะเป็นแค่ยอดคงเหลือ ณ ตอนนี้ ซึ่งไม่มีประวัติให้ย้อนดูจริง):
  //  - งานใหม่      → จำนวนคำสั่งผลิตที่สร้างใหม่ต่อเดือน (createdAt)
  //  - เสร็จแล้ว     → จำนวนงานที่เสร็จต่อเดือน (completedAt)
  //  - กำลังผลิต    → เวลาเฉลี่ยรับงาน→เสร็จงาน (avgDays) ต่อเดือน — ยิ่งน้อยยิ่งเร็ว
  //  - ใกล้กำหนดส่ง → อัตราส่งงานตรงเวลาต่อเดือน (%) — ยิ่งสูงยิ่งดี
  const m = stats.monthly;
  renderSparkline(document.getElementById("cp-spark-new"), m.created);
  renderSparkline(document.getElementById("cp-spark-production"), m.avgDays);
  renderSparkline(document.getElementById("cp-spark-completed"), m.completed);
  renderSparkline(document.getElementById("cp-spark-duesoon"), m.onTimeRate);
  renderTrendBadge(document.getElementById("cp-trend-new"), m.created);
  renderTrendBadge(document.getElementById("cp-trend-production"), m.avgDays,
    { title: "เวลาเฉลี่ยรับงาน→เสร็จงานรายเดือน (ยิ่งลดยิ่งดี)" });
  renderTrendBadge(document.getElementById("cp-trend-completed"), m.completed);
  renderTrendBadge(document.getElementById("cp-trend-duesoon"), m.onTimeRate,
    { title: "อัตราส่งงานตรงเวลารายเดือน" });

  if (ordersBadge) {
    if (stats.overdueCount > 0) {
      ordersBadge.textContent = stats.overdueCount;
      ordersBadge.style.display = "inline-flex";
    } else {
      ordersBadge.style.display = "none";
    }
  }
}

export function renderChart(stats) {
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

export function renderBreakdown(stats) {
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
  // สินค้าขายดี — เรียงตามจำนวนที่สั่งรวม (qty) ไม่ใช่จำนวนคำสั่งผลิต เพราะ 1 คำสั่งผลิตอาจสั่งหลายชิ้น
  // แสดงรายได้รวมของสินค้านั้นกำกับไว้ใน title ให้ดูรายละเอียดเพิ่มได้โดยไม่ต้องเพิ่มคอลัมน์
  if (!breakdownProducts) { /* กันพัง ถ้าหน้า HTML รุ่นเก่ายังไม่มีกล่องนี้ */ }
  else if (!stats.topProducts.length) {
    breakdownProducts.innerHTML = `<div class="cp-empty">ไม่มีข้อมูล</div>`;
  } else {
    const max = Math.max(1, ...stats.topProducts.map(p => p.qty));
    breakdownProducts.innerHTML = stats.topProducts.map(p => `
      <div class="cp-breakdown-row">
        <span class="cp-breakdown-name" title="${escapeHtml(p.name)} — สั่งไปแล้ว ${p.qty} ชิ้น, รายได้รวม ${formatBaht(p.revenue)}">${escapeHtml(p.name)}</span>
        <span class="cp-breakdown-bar-wrap"><span class="cp-breakdown-bar" style="width:${Math.round(p.qty/max*100)}%"></span></span>
        <span class="cp-breakdown-count">${p.qty}</span>
      </div>`).join("");
  }

  // อัตราลูกค้าซื้อซ้ำ — stats.repeatCustomerRate จาก computeRepeatCustomerRate() (js/stats-trends.js)
  // นับจากชื่อลูกค้าที่ปรากฏซ้ำในคำสั่งผลิต ≥2 รายการขึ้นไป (ดูหมายเหตุข้อจำกัดที่ stats-trends.js)
  if (breakdownRepeat) {
    const r = stats.repeatCustomerRate;
    if (!r || !r.totalCustomers) {
      breakdownRepeat.innerHTML = `<div class="cp-empty">ไม่มีข้อมูล</div>`;
    } else {
      breakdownRepeat.innerHTML = `
        <div class="cp-breakdown-row">
          <span class="cp-breakdown-name" style="width:auto;flex:1;">ลูกค้าซื้อซ้ำ (≥2 คำสั่งผลิต)</span>
          <span class="cp-breakdown-count" style="width:auto;">${r.rate}%</span>
        </div>
        <div class="cp-breakdown-hint">${r.repeatCustomers} จาก ${r.totalCustomers} ลูกค้าทั้งหมด</div>`;
    }
  }

  // หมวดขายดีเดือนนี้ — เอาตัวสุดท้ายของ stats.topCategoryMonthly (เดือนล่าสุด = เดือนปัจจุบัน)
  // จาก monthlyTopCategory() (js/stats-trends.js) ซึ่งไม่นับงานที่ยกเลิก
  if (breakdownTopCatMonth) {
    const monthly = stats.topCategoryMonthly || [];
    const thisMonth = monthly[monthly.length - 1];
    if (!thisMonth || !thisMonth.value || !thisMonth.value.name) {
      breakdownTopCatMonth.innerHTML = `<div class="cp-empty">ไม่มีข้อมูล</div>`;
    } else {
      breakdownTopCatMonth.innerHTML = `
        <div class="cp-breakdown-row">
          <span class="cp-breakdown-name" style="width:auto;flex:1;" title="${escapeHtml(thisMonth.value.name)}">${escapeHtml(thisMonth.value.name)}</span>
          <span class="cp-breakdown-count" style="width:auto;">${thisMonth.value.count}</span>
        </div>
        <div class="cp-breakdown-hint">หมวดป้ายที่มีคำสั่งผลิตมากที่สุดใน ${escapeHtml(thisMonth.label)}</div>`;
    }
  }
}
