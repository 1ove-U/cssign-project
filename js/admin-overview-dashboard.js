// ===========================================================
// js/admin-overview-dashboard.js — แท็บ "ภาพรวม" (Overview dashboard)
// แยกออกมาจาก admin-page.js เดิม (2026 refactor phase 2) — ย้ายโค้ดเฉยๆ ไม่เปลี่ยน behavior
//
// เดิมใช้ monthlySnapshotUpdate() (localStorage) เพื่อเทียบ % กับเดือนก่อนและเก็บ history
// สำหรับ sparkline — ตอนนี้ใช้ cumulativeCountHistory()/computeLeadStats()
// (js/stats-trends.js, js/db-orders.js) คำนวณจาก createdAt จริงใน Firestore แทน จึงตรงกันทุกเครื่อง/
// ทุกคนที่เปิดดู ไม่ผูกกับ localStorage ของเครื่องใดเครื่องหนึ่ง (ดูรายละเอียดเพิ่มเติมที่หัวไฟล์
// js/stats-trends.js) แล้วแสดงด้วย renderTrendBadge() (ป้าย 🔼/▶️/🔽 จากค่าเฉลี่ยเคลื่อนที่
// 3 ช่วงล่าสุด แทนที่ ovRenderTrend เดิมที่โชว์แค่ % เทียบเดือนก่อนตรงๆ)
//
// 2026 refactor phase 3 (ต่อ): ปุ่ม "Export CSV"/"Export PDF" ของแท็บนี้ถูกแยกไปอยู่
// js/admin-overview-export.js แล้ว (ไม่เปลี่ยน behavior) — ไฟล์นี้เหลือทำหน้าที่: การ์ดสถิติ/
// เทรนด์/sparkline, กราฟเส้นรายได้, notification bell — ovFormatBaht ยังอยู่ในไฟล์นี้ (ใช้เยอะสุด
// ในหน้านี้เอง + admin-products-csv.js เรียกใช้ข้ามไฟล์ด้วย) แล้ว export ออกไปให้
// admin-overview-export.js import กลับมาใช้เหมือนเดิม
//
// 2026 refactor รอบที่ 27 (ต่อ): การ์ด "รายละเอียดเพิ่มเติม"/กิจกรรม 4 การ์ด (ช่องทางขาย-สถานะ
// ลีดทั้งหมด/อัตราปิดการขายแยกช่องทาง/แจ้งเตือน SLA/กิจกรรมล่าสุด) ถูกแยกไปอยู่
// js/admin-overview-detail-cards.js แล้ว (ไม่เปลี่ยน behavior) — renderOverview() ด้านล่าง
// ยัง import 4 ฟังก์ชันนั้นกลับมาเรียกท้ายฟังก์ชันเหมือนเดิมทุกจุด
// ===========================================================
import { computeOrderStats, computeLeadStats } from "./db-orders-stats.js";
import { getAllOrders, getOrderReminders, jumpToOrderReminder } from "./orders-tab.js";
import { renderSparkline, renderTrendBadge } from "./ui-helpers.js";
import { cumulativeCountHistory } from "./stats-trends.js";
import { escapeHtml } from "./admin-utils.js";
import { allProducts, allPortfolios, allBlogs, allCategories } from "./admin-state.js";
import { allLeads } from "./admin-leads.js";
import { openProductModal } from "./admin-products.js";
import { switchTab } from "./admin-page.js";
import { renderLeadFunnel, renderLeadSourceConversion, renderSlaWarning, renderOverviewActivity } from "./admin-overview-detail-cards.js";
import { renderOverviewCalendar } from "./admin-overview-calendar.js";
import "./admin-overview-export.js";


// ── Overview dashboard ──────────────────────────────
export function ovFormatBaht(n) {
  return "฿" + Math.round(n || 0).toLocaleString("th-TH");
}

// กราฟเส้นรายได้ 6 เดือนย้อนหลัง — SVG ล้วน ไม่พึ่ง library ภายนอก (สม่ำเสมอกับกราฟแท่งที่มีอยู่แล้ว)
// ต่อด้วยเส้นประ (dashed) 3 เดือนถัดไปจาก stats.revenueForecast.predicted (computeOrderStats,
// js/db-orders.js) ซึ่งคำนวณด้วย linear regression อย่างง่าย (linearForecast, js/stats-trends.js) —
// ไม่ใช่ AI/ML แค่ลากเส้นแนวโน้มตรงไปข้างหน้า จึงเหมาะกับ "ประมาณคร่าวๆ" เท่านั้น ไม่ควรใช้
// ตัดสินใจสำคัญ (มีคำอธิบายกำกับไว้ใต้กราฟด้วย)
function renderRevenueLineChart() {
  const box = document.getElementById("ov-revenue-linechart");
  if (!box) return;
  const orders = getAllOrders ? getAllOrders() : [];
  const stats = computeOrderStats(orders);
  const data = stats.monthly.labels.map((label, i) => ({ label, total: stats.monthly.revenue[i] || 0 }));

  const forecastValues = (stats.revenueForecast && stats.revenueForecast.predicted) || [];
  const now = new Date();
  const forecastData = forecastValues.map((total, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() + 1 + i, 1);
    return { label: d.toLocaleDateString("th-TH", { month: "short", year: "2-digit" }), total };
  });

  const W = 640, H = 160, padL = 46, padR = 16, padT = 14, padB = 26;
  const allPoints = data.concat(forecastData);
  const max = Math.max(1, ...allPoints.map(d => d.total));
  const stepX = (W - padL - padR) / (allPoints.length - 1 || 1);
  const toPoint = (d, i) => ({
    x: padL + stepX * i,
    y: padT + (H - padT - padB) * (1 - d.total / max),
    d
  });
  const points = data.map((d, i) => toPoint(d, i));
  const forecastPoints = forecastData.map((d, i) => toPoint(d, data.length + i));

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${points[points.length - 1].x.toFixed(1)},${H - padB} L${points[0].x.toFixed(1)},${H - padB} Z`;
  // เส้นประคาดการณ์ต่อจากจุดสุดท้ายของข้อมูลจริง เพื่อให้ดูต่อเนื่องกัน
  const forecastLinePath = forecastPoints.length
    ? [points[points.length - 1], ...forecastPoints].map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")
    : "";
  const gridY = [0, 0.5, 1].map(f => padT + (H - padT - padB) * f);

  box.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:${H}px;overflow:visible;">
      ${gridY.map(y => `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="var(--gray-200)" stroke-width="1"/>`).join("")}
      <path d="${areaPath}" fill="url(#ovRevGrad)" opacity="0.15"/>
      <path d="${linePath}" fill="none" stroke="var(--primary)" stroke-width="2.5"/>
      ${forecastLinePath ? `<path d="${forecastLinePath}" fill="none" stroke="var(--primary)" stroke-width="2" stroke-dasharray="5 4" opacity="0.55"/>` : ""}
      ${points.map(p => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3.5" fill="var(--primary)"><title>${escapeHtml(p.d.label)}: ${ovFormatBaht(p.d.total)}</title></circle>`).join("")}
      ${forecastPoints.map(p => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3.5" fill="#fff" stroke="var(--primary)" stroke-width="2" opacity="0.7"><title>${escapeHtml(p.d.label)} (คาดการณ์): ${ovFormatBaht(p.d.total)}</title></circle>`).join("")}
      ${allPoints.map((d, i) => `<text x="${(padL + stepX * i).toFixed(1)}" y="${H - 8}" font-size="10" text-anchor="middle" fill="var(--text-meta)">${escapeHtml(d.label)}</text>`).join("")}
      <defs><linearGradient id="ovRevGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="var(--primary)"/><stop offset="100%" stop-color="var(--primary)" stop-opacity="0"/>
      </linearGradient></defs>
    </svg>
    ${forecastPoints.length ? `<div class="ov-revenue-forecast-note">เส้นประคือค่าประมาณคร่าวๆ ด้วยการคำนวณ linear regression อย่างง่าย (ไม่ใช่ AI/ML) จากแนวโน้มรายได้ย้อนหลัง ใช้ดูทิศทางคร่าวๆ เท่านั้น ไม่ควรใช้ตัดสินใจสำคัญ</div>` : ""}`;
}

export function renderOverview() {
  const ovLeadsNewCount = allLeads.filter(l => l.status === "new").length;
  // หมายเหตุ: การ์ด "จำนวนงานใหม่" ย้ายไปรวมกับสถิติคำสั่งผลิตอื่น ๆ ในกริดเดียว
  // (#cp-stats-grid ใน orders-tab.js) แล้ว เพื่อลดความซ้ำซ้อน — กริดนี้จึงเหลือแค่
  // สถิติสรุปเนื้อหาเว็บไซต์ (สินค้า/หมวดหมู่/ผลงาน/บทความ/ลีดใหม่)
  document.getElementById("ov-stat-products").textContent      = allProducts.length;
  document.getElementById("ov-stat-leads-new").textContent     = ovLeadsNewCount;
  document.getElementById("ov-stat-portfolio").textContent     = allPortfolios.length;
  document.getElementById("ov-stat-blog").textContent          = allBlogs.length;
  document.getElementById("ov-stat-categories").textContent    = allCategories.length;

  // อัตราปิดการขาย (conversion rate) = won ÷ (won + lost) — นับเฉพาะลีดที่ "ปิดจบ" แล้ว
  // (ไม่รวมลีดที่ยังอยู่ระหว่างดำเนินการ new/read/replied เพราะยังไม่รู้ผลว่าจบแบบไหน)
  const ovWonCount    = allLeads.filter(l => l.status === "won").length;
  const ovLostCount   = allLeads.filter(l => l.status === "lost").length;
  const ovClosedCount = ovWonCount + ovLostCount;
  const ovConversionRate = ovClosedCount ? Math.round((ovWonCount / ovClosedCount) * 100) : 0;
  document.getElementById("ov-stat-conversion").textContent = ovClosedCount ? ovConversionRate + "%" : "—";
  document.getElementById("ov-stat-conversion").title = ovClosedCount
    ? `ปิดการขายสำเร็จ ${ovWonCount} จาก ${ovClosedCount} ลีดที่ปิดจบแล้ว (won + lost)`
    : "ยังไม่มีลีดที่ปิดจบ (won/lost) ให้คำนวณอัตรา";

  // สถิติแนวโน้ม — คำนวณจาก createdAt จริงใน Firestore แทน snapshot รายเดือนใน localStorage เดิม
  // (ดูคำอธิบายเต็มที่หัวไฟล์ js/stats-trends.js) เนื้อหาเว็บไซต์ (products/portfolio/blog/
  // categories) ใช้ cumulativeCountHistory() นับจำนวนที่มีอยู่จริง ณ สิ้นเดือนนั้น
  // ส่วนลีด (leadsNew/conversion) ใช้ computeLeadStats() ซึ่งคำนวณจาก createdAt/status/wonAt จริง
  const ovProductsHist     = cumulativeCountHistory(allProducts, p => p.createdAt);
  const ovPortfolioHist    = cumulativeCountHistory(allPortfolios, p => p.createdAt);
  const ovBlogHist         = cumulativeCountHistory(allBlogs, b => b.createdAt);
  const ovCategoriesHist   = cumulativeCountHistory(allCategories, c => c.createdAt);
  const ovLeadStats        = computeLeadStats(allLeads);

  renderTrendBadge(document.getElementById("ov-trend-products"), ovProductsHist);
  renderTrendBadge(document.getElementById("ov-trend-leads-new"), ovLeadStats.monthly.newLeads);
  renderTrendBadge(document.getElementById("ov-trend-portfolio"), ovPortfolioHist);
  renderTrendBadge(document.getElementById("ov-trend-blog"), ovBlogHist);
  renderTrendBadge(document.getElementById("ov-trend-categories"), ovCategoriesHist);
  renderTrendBadge(document.getElementById("ov-trend-conversion"), ovLeadStats.monthly.conversionRate);
  renderSparkline(document.getElementById("ov-spark-products"), ovProductsHist);
  renderSparkline(document.getElementById("ov-spark-leads-new"), ovLeadStats.monthly.newLeads);
  renderSparkline(document.getElementById("ov-spark-portfolio"), ovPortfolioHist);
  renderSparkline(document.getElementById("ov-spark-blog"), ovBlogHist);
  renderSparkline(document.getElementById("ov-spark-categories"), ovCategoriesHist);
  renderSparkline(document.getElementById("ov-spark-conversion"), ovLeadStats.monthly.conversionRate);

  // Quick actions (ผูก event ครั้งเดียวพอ — เช็ค dataset.wired กันผูกซ้ำตอน render ซ้ำๆ)
  const ovQuickAddProduct = document.getElementById("ov-quick-add-product");
  const ovQuickAddOrder   = document.getElementById("ov-quick-add-order");
  if (ovQuickAddProduct && !ovQuickAddProduct.dataset.wired) {
    ovQuickAddProduct.dataset.wired = "1";
    ovQuickAddProduct.addEventListener("click", () => openProductModal(null));
  }
  if (ovQuickAddOrder && !ovQuickAddOrder.dataset.wired) {
    ovQuickAddOrder.dataset.wired = "1";
    ovQuickAddOrder.addEventListener("click", () => {
      switchTab("orders");
      const ordersAddBtn = document.getElementById("cp-add-btn");
      if (ordersAddBtn) ordersAddBtn.click();
    });
  }

  // "ดูทั้งหมด" — เชื่อมไปแท็บลีด
  const ovLeadsViewAll = document.getElementById("ov-leads-viewall");
  if (ovLeadsViewAll && !ovLeadsViewAll.dataset.wired) {
    ovLeadsViewAll.dataset.wired = "1";
    ovLeadsViewAll.addEventListener("click", () => switchTab("leads"));
  }

  // "ไปที่คำสั่งผลิต →" — หัวข้อ "สรุปคำสั่งผลิต" เชื่อมไปแท็บคำสั่งผลิต
  const ovOrdersViewAll = document.getElementById("ov-orders-viewall");
  if (ovOrdersViewAll && !ovOrdersViewAll.dataset.wired) {
    ovOrdersViewAll.dataset.wired = "1";
    ovOrdersViewAll.addEventListener("click", () => switchTab("orders"));
  }

  // "ดูมุมมองปฏิทินเต็ม →" — เชื่อมไปแท็บคำสั่งผลิต แล้วสลับเป็นมุมมองปฏิทิน (เหมือนกดปุ่ม
  // "มุมมองปฏิทิน" ในแถบสลับมุมมองเดิมของแท็บนั้น)
  const ovCalViewAll = document.getElementById("ov-cal-viewall");
  if (ovCalViewAll && !ovCalViewAll.dataset.wired) {
    ovCalViewAll.dataset.wired = "1";
    ovCalViewAll.addEventListener("click", () => {
      switchTab("orders");
      const calBtn = document.querySelector('#cp-view-toggle [data-view="calendar"]');
      if (calBtn) calBtn.click();
    });
  }

  try { renderOverviewCalendar(); } catch (err) { console.error("[admin-page] renderOverviewCalendar ล้มเหลว", err); }

  try { renderRevenueLineChart(); } catch (err) { console.error("[admin-page] renderRevenueLineChart ล้มเหลว", err); }

  // หมายเหตุ: กล่อง "สินค้าแยกตามหมวดหมู่" ถูกตัดออกแล้ว เพราะซ้ำ concept กับกล่อง
  // "แยกตามหมวดป้าย" (คำสั่งผลิตแยกตามหมวดหมู่) ที่อยู่ในส่วนสรุปคำสั่งผลิตด้านล่างอยู่แล้ว
  const leadsBox = document.getElementById("ov-recent-leads");
  const pendingLeads = allLeads.filter(l => !["replied", "won", "lost"].includes(l.status)).slice(0, 5);
  if (!pendingLeads.length) {
    leadsBox.innerHTML = `<div class="cp-empty">ไม่มีลีดที่รอดำเนินการ</div>`;
  } else {
    leadsBox.innerHTML = pendingLeads.map(l => `
      <div class="cp-breakdown-row" style="cursor:pointer;" data-lead-id="${l.id}">
        <span class="cp-breakdown-name" style="width:auto;flex:1;" title="${escapeHtml(l.name||'')}">${escapeHtml(l.name || l.company || "ไม่ระบุชื่อ")}</span>
        <span class="cp-breakdown-count" style="width:auto;color:${l.status==='new'?'#B45309':'var(--gray-400)'};">${l.status === "new" ? "ใหม่" : "อ่านแล้ว"}</span>
      </div>`).join("");
    leadsBox.querySelectorAll("[data-lead-id]").forEach(row => {
      row.addEventListener("click", () => switchTab("leads"));
    });
  }

  renderOverviewActivity();
  renderLeadFunnel();
  renderLeadSourceConversion();
  renderSlaWarning();

  // "ดูทั้งหมด →" กิจกรรมล่าสุด — เชื่อมไปแท็บตั้งค่า (ประวัติการทำงาน / Audit Log)
  const ovActivityViewAll = document.getElementById("ov-activity-viewall");
  if (ovActivityViewAll && !ovActivityViewAll.dataset.wired) {
    ovActivityViewAll.dataset.wired = "1";
    ovActivityViewAll.addEventListener("click", () => switchTab("settings"));
  }
}

// ── Notification bell (ลีดใหม่) ──────────────────────────────
const adNotifBtn   = document.getElementById("ad-notif-btn");
const adNotifDot   = document.getElementById("ad-notif-dot");
const adNotifPanel = document.getElementById("ad-notif-panel");
const adNotifList  = document.getElementById("ad-notif-list");

adNotifBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  adNotifPanel.style.display = adNotifPanel.style.display === "none" ? "block" : "none";
});
document.addEventListener("click", (e) => {
  if (!adNotifPanel.contains(e.target) && e.target !== adNotifBtn) adNotifPanel.style.display = "none";
});

export function renderNotifBell() {
  const newLeads = allLeads.filter(l => l.status === "new");
  const { overdue, dueSoon } = getOrderReminders();
  const totalCount = newLeads.length + overdue.length + dueSoon.length;
  adNotifDot.style.display = totalCount ? "block" : "none";
  if (!totalCount) {
    adNotifList.innerHTML = `<div class="cp-notif-empty">ไม่มีการแจ้งเตือนตอนนี้</div>`;
    return;
  }

  // เรียงเกินกำหนดขึ้นก่อน (เร่งด่วนสุด) ตามด้วยใกล้ครบกำหนด แล้วค่อยลีดใหม่
  const orderItemHtml = (o, urgent) => `
    <div class="cp-notif-item ${urgent ? "is-overdue" : "is-duesoon"}" data-order-id="${o.id}" data-urgency="${urgent ? "overdue" : "due-soon"}">
      <span class="cp-notif-item-title">${escapeHtml(o.code || o.item || "คำสั่งผลิต")}</span>
      <span class="cp-notif-item-sub">${urgent ? "เกินกำหนดส่งแล้ว" : "ใกล้ครบกำหนดส่ง"} — ${escapeHtml(o.customer || "")}</span>
    </div>`;
  const leadItemHtml = (l) => `
    <div class="cp-notif-item is-duesoon" data-lead-id="${l.id}">
      <span class="cp-notif-item-title">${escapeHtml(l.name || l.company || "ไม่ระบุชื่อ")}</span>
      <span class="cp-notif-item-sub">${escapeHtml(l.service || l.message || "ลีดใหม่ — ยังไม่ได้อ่าน")}</span>
    </div>`;

  const items = [
    ...overdue.slice(0, 5).map(o => orderItemHtml(o, true)),
    ...dueSoon.slice(0, 5).map(o => orderItemHtml(o, false)),
    ...newLeads.slice(0, 5).map(leadItemHtml)
  ].slice(0, 8);

  adNotifList.innerHTML = items.join("");
  adNotifList.querySelectorAll(".cp-notif-item").forEach(el => {
    el.addEventListener("click", () => {
      adNotifPanel.style.display = "none";
      if (el.dataset.orderId) {
        switchTab("orders");
        jumpToOrderReminder(el.dataset.urgency === "overdue" ? "overdue" : "duesoon");
      } else {
        switchTab("leads");
      }
    });
  });
}
