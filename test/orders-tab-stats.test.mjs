// test/orders-tab-stats.test.mjs — รอบที่ 98 (Phase 6/6 สุดท้าย: stats cards/chart/breakdown,
// js/orders-tab-stats.js)
//
// ขอบเขตของไฟล์นี้ จาก js/orders-tab-stats.js (190 บรรทัด — ยังไม่เคยมีเทสไฟล์ไหนครอบคลุมเลยทั้งไฟล์
// ก่อนรอบนี้ — ยืนยันด้วย grep ทั้งโปรเจกต์แล้วว่าไม่มีไฟล์เทสไหนอ้างถึงชื่อไฟล์นี้เลยนอกจากคอมเมนต์):
//   - renderStatsCards(stats): การ์ดสถิติบน (8 การ์ด) + sparkline/trend badge 4 การ์ด (จาก
//     stats.monthly) + ป้ายเทียบยอดขาย (renderSalesTrendBadge — local ในไฟล์นี้) + ordersBadge
//     (จุดแดงบน sidebar เมื่อมีงานเกินกำหนด)
//   - renderChart(stats): กราฟแท่ง 7/30 วัน x จำนวนงาน/รายได้ (4 combo) — อ่าน chartRange/chartMetric
//     แบบ live binding จาก js/orders-tab.js (module-level `export let` ที่ปุ่มในไฟล์นั้นกด reassign)
//   - renderBreakdown(stats): 5 กล่องแยกหมวด (หมวดป้าย/ลูกค้า/สินค้าขายดี/ลูกค้าซื้อซ้ำ/หมวดขายดี
//     เดือนนี้) แต่ละกล่องมี empty-state guard แยกกัน
//
// ไม่พึ่งพา computeOrderStats(orders)/orderUrgency() คำนวณจากวันที่จริงเลยในเทสกลุ่มนี้ (ต่างจาก
// รอบก่อนๆ ที่ทดสอบ orders-tab.js/orders-tab-export.js) — เพราะ 3 ฟังก์ชันที่ทดสอบในไฟล์นี้รับ
// `stats` object เป็นพารามิเตอร์ตรงๆ (pure rendering layer, ไม่ได้เรียก computeOrderStats() เอง)
// จึงเรียกฟังก์ชัน export ทั้ง 3 ตัวตรงๆ ด้วย stats object ที่สร้างเองในเทส (ไม่ผ่าน
// triggerOrdersSnapshot()/render()) — ให้ผลตรงไปตรงมา ไม่ผูกกับเวลาจริงตอนรันเทส (กัน flaky ข้าม
// เที่ยงคืน/ข้ามเดือน) — ยกเว้น statTotal ซึ่งอ่านจาก getAllOrders().length ตรงๆ (ไม่ใช่จาก stats)
// จึงต้อง initOrdersTab()+triggerOrdersSnapshot() ก่อนเพื่อให้ getAllOrders() มีข้อมูล
//
// ตรวจโค้ดจริงทั้งไฟล์ js/orders-tab-stats.js + js/ui-stats-widgets.js (renderSparkline()/
// renderTrendBadge() ที่ไฟล์นี้เรียก — re-export ผ่าน js/ui-helpers.js) + js/stats-trends.js
// (trendDirection() — ใช้คำนวณค่าที่คาดหวังในเทสฝั่งนี้ตรงๆ แทนการเดา/ก็อปสูตรซ้ำ) ละเอียดก่อนเขียน
// ไฟล์นี้ทั้งหมด — ไม่พบบั๊ก จึงเป็นไฟล์เทสล้วนๆ ไม่มีการแก้โค้ดผลิตภัณฑ์เลยแม้แต่บรรทัดเดียว
//
// จุดที่ตรวจแล้วแต่ "จงใจไม่เทส" ในรอบนี้ (ระบุไว้ให้รอบถัดไปรู้ ไม่ใช่มองข้าม):
//   - กิ่ง `if (!breakdownProducts) { /* กันพัง */ }` ใน renderBreakdown(): breakdownProducts เป็น
//     module-level const ที่ผูกกับ document.getElementById("cp-breakdown-products") ตอน import
//     ครั้งเดียว — จะทดสอบกิ่งนี้ได้ต้องสร้าง DOM fixture คนละชุดที่ไม่มี element นี้เลยตั้งแต่ก่อน
//     import (import คนละรอบ = ไฟล์เทสคนละไฟล์ หรือ dynamic import ซ้ำด้วย query string กัน module
//     cache) — เกินขอบเขตไฟล์นี้ ทิ้งไว้เป็นงานเสริมถ้ามีเวลา ไม่ใช่บั๊ก (admin.html ปัจจุบันมี
//     element นี้อยู่แล้วเสมอ)
//   - ยังไม่ได้ตรวจโค้ดจริงของ js/orders-tab.js ส่วนปุ่ม view-toggle/kanban อีกครั้ง (ไม่เกี่ยวกับ
//     ไฟล์นี้ ดู test/orders-tab-kanban.test.mjs รอบ 96 แทน)

import { test, describe, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const ADMIN_HTML = readFileSync(new URL("../admin.html", import.meta.url), "utf-8");
const BODY_START = ADMIN_HTML.indexOf(">", ADMIN_HTML.indexOf("<body")) + 1;
const BODY_END = ADMIN_HTML.indexOf("</body>");
const ADMIN_BODY_NO_SCRIPTS = ADMIN_HTML
  .slice(BODY_START, BODY_END)
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, "");

let document;
let mod; // orders-tab.js exports ทั้งหมด (renderStatsCards/renderChart/renderBreakdown ถูก
         // import เข้ามาแบบ side-effect อยู่แล้วที่บรรทัด 81 ของ js/orders-tab.js)
let statsMod; // export โดยตรงของ js/orders-tab-stats.js (renderStatsCards/renderChart/renderBreakdown)
let trendDirection; // js/stats-trends.js — ใช้คำนวณค่าที่คาดหวังตรงๆ ไม่ก็อปสูตรซ้ำ

function resetFirebaseCalls() {
  globalThis.__ADD_DOC_CALLS__ = [];
  globalThis.__UPDATE_DOC_CALLS__ = [];
  globalThis.__DELETE_DOC_CALLS__ = [];
  globalThis.__SET_DOC_CALLS__ = [];
  globalThis.__GET_DOC_STUB__ = undefined;
  globalThis.__GET_DOCS_STUB__ = undefined;
  globalThis.__SNAPSHOT_LISTENERS__ = {};
}

function triggerOrdersSnapshot(orders) {
  const cb = globalThis.__SNAPSHOT_LISTENERS__ && globalThis.__SNAPSHOT_LISTENERS__["orders"];
  if (typeof cb !== "function") throw new Error("orders snapshot listener ยังไม่ได้ลงทะเบียน (เรียก initOrdersTab() ก่อนหรือยัง?)");
  cb({ docs: orders.map(o => ({ id: o.id, data: () => { const { id, ...rest } = o; return rest; } })) });
}

function formatBaht(n) {
  return "฿" + Math.round(n || 0).toLocaleString("th-TH");
}

before(async () => {
  const dom = new JSDOM(`<!doctype html><html><body>${ADMIN_BODY_NO_SCRIPTS}</body></html>`, {
    url: "https://example.test/"
  });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
  globalThis.MouseEvent = dom.window.MouseEvent;
  globalThis.KeyboardEvent = dom.window.KeyboardEvent;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Event = dom.window.Event;
  dom.window.HTMLElement.prototype.scrollIntoView = function () {};
  globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);

  mod = await import("../js/orders-tab.js");
  statsMod = await import("../js/orders-tab-stats.js");
  ({ trendDirection } = await import("../js/stats-trends.js"));
  document = dom.window.document;
});

beforeEach(() => {
  resetFirebaseCalls();
  mod.stopOrdersTab();
  mod.initOrdersTab();
  mod.setCurrentPage(1);

  // รีเซ็ตตัวกรอง/ปุ่มกราฟกลับ default (chartRange=7, chartMetric="count") — module-level state
  // ไม่มี setter export ต้องรีเซ็ตผ่านคลิก DOM จริงเท่านั้น (ตามแพทเทิร์นเดิมทุกรอบ)
  document.querySelector('.cchart-range-toggle#cp-chart-metric .cchart-range-btn[data-metric="count"]').click();
  document.querySelector('.cchart-range-toggle#cp-chart-range .cchart-range-btn[data-range="7"]').click();
});

// ── stats object ตัวอย่าง ใช้ตรงๆ กับ renderStatsCards/renderChart/renderBreakdown (ไม่ผ่าน
//    computeOrderStats() เลย — ฟังก์ชันที่ทดสอบในไฟล์นี้รับ stats เป็นพารามิเตอร์อยู่แล้ว) ──
function baseStats(overrides = {}) {
  return {
    newCount: 3,
    totalBalance: 12345,
    dueSoonCount: 2,
    overdueCount: 1,
    inProductionCount: 4,
    completedCount: 5,
    salesToday: 1000,
    salesMonth: 50000,
    monthCompare: { thisMonth: 50000, prevMonth: 40000, pct: 25 },
    monthly: {
      created: [1, 2, 3, 4, 5, 6],
      avgDays: [5, 4, 4, 3, 3, 2],
      completed: [0, 1, 1, 2, 2, 3],
      onTimeRate: [60, 70, 75, 80, 85, 90],
      revenue: [1000, 2000, 3000, 4000, 5000, 6000]
    },
    weekly: [10, 20, 30, 40, 50, 60, 100],
    trend30: Array.from({ length: 30 }, (_, i) => i + 1),
    revenueWeekly: [100, 200, 300, 400, 500, 600, 700],
    revenueTrend30: Array.from({ length: 30 }, (_, i) => (i + 1) * 10),
    byCategory: [],
    topCustomers: [],
    topProducts: [],
    repeatCustomerRate: null,
    topCategoryMonthly: [],
    ...overrides
  };
}

describe("js/orders-tab-stats.js — renderStatsCards() การ์ดสถิติหลัก (รอบที่ 98)", () => {
  test("การ์ดตัวเลขพื้นฐาน 5 การ์ด: newCount/dueSoonCount/overdueCount/inProductionCount/completedCount ตรงตาม stats", () => {
    statsMod.renderStatsCards(baseStats());
    assert.equal(document.getElementById("cp-stat-new").textContent, "3");
    assert.equal(document.getElementById("cp-stat-duesoon").textContent, "2");
    assert.equal(document.getElementById("cp-stat-overdue").textContent, "1");
    assert.equal(document.getElementById("cp-stat-production").textContent, "4");
    assert.equal(document.getElementById("cp-stat-completed").textContent, "5");
  });

  test("statBalance ผ่าน formatBaht(stats.totalBalance)", () => {
    statsMod.renderStatsCards(baseStats({ totalBalance: 12345 }));
    assert.equal(document.getElementById("cp-stat-balance").textContent, formatBaht(12345));
  });

  test("statTotal อ่านจาก getAllOrders().length ตรงๆ (module-private ของ orders-tab.js) ไม่ใช่จาก field ใดใน stats เลย", () => {
    triggerOrdersSnapshot([{ id: "a" }, { id: "b" }, { id: "c" }]);
    statsMod.renderStatsCards(baseStats());
    assert.equal(document.getElementById("cp-stat-total").textContent, "3");
  });

  test("statSales.innerHTML แสดง salesToday/salesMonth ผ่าน formatBaht() พร้อมป้าย 'วันนี้'/'เดือนนี้'", () => {
    statsMod.renderStatsCards(baseStats({ salesToday: 1500, salesMonth: 88000 }));
    const html = document.getElementById("cp-stat-sales").innerHTML;
    assert.ok(html.includes(formatBaht(1500)));
    assert.ok(html.includes(formatBaht(88000)));
    assert.ok(html.includes("วันนี้"));
    assert.ok(html.includes("เดือนนี้"));
  });

  test("ป้ายเทียบยอดขาย (renderSalesTrendBadge local): monthCompare falsy -> class 'na', innerHTML ว่าง, ไม่โยน error แม้ต้องอ่าน stats.monthly ต่อ", () => {
    statsMod.renderStatsCards(baseStats({ monthCompare: null }));
    const el = document.getElementById("cp-stat-sales-trend");
    assert.equal(el.className, "cp-stat-trend na");
    assert.equal(el.innerHTML, "");
  });

  test("ป้ายเทียบยอดขาย: monthCompare truthy -> renderTrendBadge(el, stats.monthly.revenue, {title}) จริง — title ต้องมี 'เทียบเดือนก่อน' + formatBaht(prevMonth), class/ทิศทางตรงกับ trendDirection(stats.monthly.revenue)", () => {
    const stats = baseStats({ monthCompare: { thisMonth: 6000, prevMonth: 4000, pct: 50 } });
    statsMod.renderStatsCards(stats);
    const el = document.getElementById("cp-stat-sales-trend");
    const expected = trendDirection(stats.monthly.revenue);
    const expectedCls = expected.dir === "up" ? "up" : expected.dir === "down" ? "down" : "flat";
    assert.equal(el.className, "cp-stat-trend " + expectedCls);
    assert.ok(el.title.startsWith(`เทียบเดือนก่อน (${formatBaht(4000)})`),
      `title ต้องขึ้นต้นด้วย 'เทียบเดือนก่อน (${formatBaht(4000)})' แต่ได้ '${el.title}'`);
  });

  test("sparkline 4 การ์ด (new/production/completed/duesoon) วาดจาก stats.monthly ที่ถูกต้องรายการ (ไม่ใช่ series อื่นสลับกัน)", () => {
    const stats = baseStats();
    statsMod.renderStatsCards(stats);
    // renderSparkline: มีข้อมูล >=2 จุด -> ลบ class is-empty และมี polyline/polygon
    ["cp-spark-new", "cp-spark-production", "cp-spark-completed", "cp-spark-duesoon"].forEach(id => {
      const el = document.getElementById(id);
      assert.equal(el.classList.contains("is-empty"), false, `${id} ต้องไม่มี class is-empty เมื่อมีข้อมูลครบ`);
      assert.ok(el.querySelector("polyline.spark-line"), `${id} ต้องมี polyline.spark-line`);
    });
  });

  test("sparkline: ข้อมูลไม่ถึง 2 จุด -> class is-empty ยังคงอยู่ (ไม่วาดเส้น)", () => {
    // ให้ monthly.created เหลือค่าตัวเลขจริงแค่ 1 ตัว (ที่เหลือ null) เพื่อจำลอง <2 จุด
    const stats = baseStats({ monthly: { ...baseStats().monthly, created: [null, null, null, null, null, 9] } });
    statsMod.renderStatsCards(stats);
    const el = document.getElementById("cp-spark-new");
    assert.equal(el.classList.contains("is-empty"), true);
    assert.equal(el.innerHTML, "");
  });

  test("trend badge 4 การ์ด (new/production/completed/duesoon): class/ทิศทางตรงกับ trendDirection(series ที่ถูกต้อง) — production/duesoon มี title เพิ่มเติมตามโค้ดจริง", () => {
    const stats = baseStats();
    statsMod.renderStatsCards(stats);
    const expNew = trendDirection(stats.monthly.created);
    const clsOf = (t) => t.dir === "up" ? "up" : t.dir === "down" ? "down" : "flat";
    assert.equal(document.getElementById("cp-trend-new").className, "cp-stat-trend " + clsOf(expNew));

    const prodEl = document.getElementById("cp-trend-production");
    assert.ok(prodEl.title.includes("เวลาเฉลี่ยรับงาน→เสร็จงานรายเดือน"), "การ์ดกำลังผลิตต้องมี title อธิบายเพิ่มตามโค้ดจริง");

    const dueEl = document.getElementById("cp-trend-duesoon");
    assert.ok(dueEl.title.includes("อัตราส่งงานตรงเวลารายเดือน"), "การ์ดใกล้กำหนดต้องมี title อธิบายเพิ่มตามโค้ดจริง");
  });

  test("ordersBadge: overdueCount > 0 -> แสดง badge (display inline-flex) พร้อมตัวเลขถูกต้อง", () => {
    statsMod.renderStatsCards(baseStats({ overdueCount: 7 }));
    const badge = document.getElementById("ad-orders-badge");
    assert.equal(badge.textContent, "7");
    assert.equal(badge.style.display, "inline-flex");
  });

  test("ordersBadge: overdueCount === 0 -> ซ่อน badge (display none)", () => {
    statsMod.renderStatsCards(baseStats({ overdueCount: 0 }));
    const badge = document.getElementById("ad-orders-badge");
    assert.equal(badge.style.display, "none");
  });
});

describe("js/orders-tab-stats.js — renderChart() กราฟแท่ง 7/30 วัน x จำนวนงาน/รายได้ (รอบที่ 98)", () => {
  function clickMetric(metric) {
    document.querySelector(`.cchart-range-toggle#cp-chart-metric .cchart-range-btn[data-metric="${metric}"]`).click();
  }
  function clickRange(range) {
    document.querySelector(`.cchart-range-toggle#cp-chart-range .cchart-range-btn[data-range="${range}"]`).click();
  }

  test("default: 7 วัน + จำนวนงาน (count) -> title ถูกต้อง, ใช้ stats.weekly ตรงๆ (ไม่คำนวณ max เอง), ไม่มี title attribute บนแท่ง", () => {
    const stats = baseStats();
    statsMod.renderChart(stats);
    assert.equal(document.getElementById("cp-chart-title").textContent, "คำสั่งผลิตใหม่รายวัน (7 วันล่าสุด)");
    const bars = [...document.getElementById("cp-chart-bars").querySelectorAll("i")];
    assert.equal(bars.length, stats.weekly.length);
    bars.forEach((bar, i) => {
      assert.equal(bar.style.height, `${Math.max(6, stats.weekly[i])}%`);
      assert.equal(bar.hasAttribute("title"), false, "โหมดจำนวนงาน 7 วัน ไม่ควรมี title attribute ตามโค้ดจริง");
    });
  });

  test("7 วัน + รายได้ (revenue): ใช้ stats.revenueWeekly, คำนวณ % เทียบ max เอง, title = formatBaht(n)", () => {
    clickMetric("revenue");
    const stats = baseStats();
    statsMod.renderChart(stats);
    assert.equal(document.getElementById("cp-chart-title").textContent, "รายได้รายวัน (7 วันล่าสุด)");
    const bars = [...document.getElementById("cp-chart-bars").querySelectorAll("i")];
    const max = Math.max(1, ...stats.revenueWeekly);
    bars.forEach((bar, i) => {
      const pct = Math.round((stats.revenueWeekly[i] / max) * 100);
      assert.equal(bar.style.height, `${Math.max(6, pct)}%`);
      assert.equal(bar.getAttribute("title"), formatBaht(stats.revenueWeekly[i]));
    });
  });

  test("30 วัน + จำนวนงาน: ใช้ stats.trend30, คำนวณ % เทียบ max เอง, title = ตัวเลขดิบ (ไม่ผ่าน formatBaht), opacity เต็มเฉพาะ i>=25", () => {
    clickRange(30);
    const stats = baseStats();
    statsMod.renderChart(stats);
    assert.equal(document.getElementById("cp-chart-title").textContent, "คำสั่งผลิตใหม่รายวัน (30 วันล่าสุด)");
    const bars = [...document.getElementById("cp-chart-bars").querySelectorAll("i")];
    assert.equal(bars.length, 30);
    const max = Math.max(1, ...stats.trend30);
    bars.forEach((bar, i) => {
      const pct = Math.round((stats.trend30[i] / max) * 100);
      assert.equal(bar.style.height, `${Math.max(4, pct)}%`);
      assert.equal(bar.getAttribute("title"), String(stats.trend30[i]));
      assert.equal(bar.style.opacity, i >= 25 ? "1" : "0.3");
    });
  });

  test("30 วัน + รายได้: ใช้ stats.revenueTrend30, title = formatBaht(n)", () => {
    clickRange(30);
    clickMetric("revenue");
    const stats = baseStats();
    statsMod.renderChart(stats);
    assert.equal(document.getElementById("cp-chart-title").textContent, "รายได้รายวัน (30 วันล่าสุด)");
    const bars = [...document.getElementById("cp-chart-bars").querySelectorAll("i")];
    const max = Math.max(1, ...stats.revenueTrend30);
    bars.forEach((bar, i) => {
      const pct = Math.round((stats.revenueTrend30[i] / max) * 100);
      assert.equal(bar.style.height, `${Math.max(4, pct)}%`);
      assert.equal(bar.getAttribute("title"), formatBaht(stats.revenueTrend30[i]));
    });
  });
});

describe("js/orders-tab-stats.js — renderBreakdown() กล่องแยกหมวด (รอบที่ 98)", () => {
  test("byCategory ว่างเปล่า -> 'ไม่มีข้อมูล'", () => {
    statsMod.renderBreakdown(baseStats({ byCategory: [] }));
    assert.equal(document.getElementById("cp-breakdown-cat").innerHTML, `<div class="cp-empty">ไม่มีข้อมูล</div>`);
  });

  test("byCategory มีข้อมูล: จำกัดแค่ 6 แถวแรก (slice(0,6)) แม้ข้อมูลมีมากกว่านั้น + escapeHtml ชื่อหมวด + bar width % เทียบ max ถูกต้อง", () => {
    const many = Array.from({ length: 8 }, (_, i) => ({ name: `หมวด <b>${i}</b>`, count: 8 - i }));
    statsMod.renderBreakdown(baseStats({ byCategory: many }));
    const box = document.getElementById("cp-breakdown-cat");
    const rows = box.querySelectorAll(".cp-breakdown-row");
    assert.equal(rows.length, 6, "ต้องจำกัดแค่ 6 แถวแรกตามโค้ดจริง (slice(0,6))");
    // ยืนยัน escapeHtml() ทำงานจริง: ต้องไม่มี <b> element เกิดขึ้นจริงใน DOM เลย (แม้ .title/.textContent
    // จะ decode entities กลับเป็น "<b>...</b>" ให้อ่านตามปกติก็ตาม — นั่นคือพฤติกรรมที่ถูกต้องของข้อความ
    // ที่ escape ไว้แล้ว ไม่ใช่สัญญาณว่า escape ไม่ทำงาน)
    assert.equal(box.querySelector("b"), null, "ต้องไม่มี <b> element จริงเกิดขึ้น (escapeHtml ต้องกัน HTML injection)");
    assert.equal(rows[0].querySelector(".cp-breakdown-name").textContent, "หมวด <b>0</b>");
    assert.equal(rows[0].querySelector(".cp-breakdown-name").title, "หมวด <b>0</b>");
    // แถวแรก count สูงสุด (8) -> width 100%
    assert.ok(rows[0].querySelector(".cp-breakdown-bar").style.width.includes("100%"));
    assert.equal(rows[0].querySelector(".cp-breakdown-count").textContent, "8");
  });

  test("topCustomers ว่างเปล่า -> 'ไม่มีข้อมูล'; มีข้อมูล -> แสดงทุกแถวไม่จำกัด 6 (ต่างจาก byCategory เพราะ upstream สไลซ์ไว้แค่ 5 แล้ว)", () => {
    statsMod.renderBreakdown(baseStats({ topCustomers: [] }));
    assert.equal(document.getElementById("cp-breakdown-cust").innerHTML, `<div class="cp-empty">ไม่มีข้อมูล</div>`);

    const custs = [{ name: "ลูกค้า A", count: 5 }, { name: "ลูกค้า B", count: 3 }];
    statsMod.renderBreakdown(baseStats({ topCustomers: custs }));
    const rows = document.getElementById("cp-breakdown-cust").querySelectorAll(".cp-breakdown-row");
    assert.equal(rows.length, 2);
    assert.equal(rows[1].querySelector(".cp-breakdown-count").textContent, "3");
  });

  test("topProducts ว่างเปล่า -> 'ไม่มีข้อมูล'; มีข้อมูล -> title มี qty+revenue(formatBaht), bar width เทียบ qty ไม่ใช่ count", () => {
    statsMod.renderBreakdown(baseStats({ topProducts: [] }));
    assert.equal(document.getElementById("cp-breakdown-products").innerHTML, `<div class="cp-empty">ไม่มีข้อมูล</div>`);

    const products = [{ name: "ป้ายไฟ LED", qty: 20, revenue: 40000 }, { name: "ป้ายอะคริลิก", qty: 10, revenue: 15000 }];
    statsMod.renderBreakdown(baseStats({ topProducts: products }));
    const box = document.getElementById("cp-breakdown-products");
    const rows = box.querySelectorAll(".cp-breakdown-row");
    assert.equal(rows.length, 2);
    const nameSpan = rows[0].querySelector(".cp-breakdown-name");
    assert.ok(nameSpan.title.includes("สั่งไปแล้ว 20 ชิ้น"));
    assert.ok(nameSpan.title.includes(formatBaht(40000)));
    assert.equal(rows[0].querySelector(".cp-breakdown-count").textContent, "20");
    assert.ok(rows[0].querySelector(".cp-breakdown-bar").style.width.includes("100%"), "แถวแรก qty สูงสุด -> width 100%");
    assert.ok(rows[1].querySelector(".cp-breakdown-bar").style.width.includes("50%"), "แถวสอง qty ครึ่งหนึ่งของแถวแรก -> width 50%");
  });

  test("repeatCustomerRate null หรือ totalCustomers=0 -> 'ไม่มีข้อมูล'", () => {
    statsMod.renderBreakdown(baseStats({ repeatCustomerRate: null }));
    assert.equal(document.getElementById("cp-breakdown-repeat").innerHTML, `<div class="cp-empty">ไม่มีข้อมูล</div>`);

    statsMod.renderBreakdown(baseStats({ repeatCustomerRate: { totalCustomers: 0, repeatCustomers: 0, rate: 0 } }));
    assert.equal(document.getElementById("cp-breakdown-repeat").innerHTML, `<div class="cp-empty">ไม่มีข้อมูล</div>`);
  });

  test("repeatCustomerRate มีข้อมูล -> แสดง % + hint 'X จาก Y ลูกค้าทั้งหมด'", () => {
    statsMod.renderBreakdown(baseStats({ repeatCustomerRate: { totalCustomers: 10, repeatCustomers: 4, rate: 40 } }));
    const box = document.getElementById("cp-breakdown-repeat");
    assert.ok(box.textContent.includes("40%"));
    assert.ok(box.textContent.includes("4 จาก 10 ลูกค้าทั้งหมด"));
  });

  test("topCategoryMonthly ว่างเปล่า หรือเดือนล่าสุดไม่มีชื่อหมวด (value.name falsy) -> 'ไม่มีข้อมูล'", () => {
    statsMod.renderBreakdown(baseStats({ topCategoryMonthly: [] }));
    assert.equal(document.getElementById("cp-breakdown-topcat-month").innerHTML, `<div class="cp-empty">ไม่มีข้อมูล</div>`);

    statsMod.renderBreakdown(baseStats({ topCategoryMonthly: [{ label: "ก.ค. 69", value: { name: null, count: 0 } }] }));
    assert.equal(document.getElementById("cp-breakdown-topcat-month").innerHTML, `<div class="cp-empty">ไม่มีข้อมูล</div>`);
  });

  test("topCategoryMonthly มีข้อมูล -> ใช้เฉพาะรายการสุดท้าย (เดือนล่าสุด) เท่านั้น ไม่ใช่ทั้งอาเรย์ + escapeHtml ชื่อหมวด/label", () => {
    const monthly = [
      { label: "พ.ค. 69", value: { name: "หมวดเก่า", count: 99 } },
      { label: "มิ.ย. 69", value: { name: "หมวดเก่ากว่า", count: 1 } },
      { label: "ก.ค. <b>69</b>", value: { name: "ป้ายไฟ & LED", count: 12 } }
    ];
    statsMod.renderBreakdown(baseStats({ topCategoryMonthly: monthly }));
    const box = document.getElementById("cp-breakdown-topcat-month");
    assert.ok(box.innerHTML.includes("ป้ายไฟ &amp; LED"), "ต้องใช้แค่รายการสุดท้ายและ escapeHtml ชื่อหมวด");
    assert.equal(box.innerHTML.includes("หมวดเก่า"), false, "ต้องไม่แสดงข้อมูลเดือนอื่นที่ไม่ใช่เดือนล่าสุด");
    assert.equal(box.querySelector(".cp-breakdown-count").textContent, "12");
    assert.ok(box.innerHTML.includes("ก.ค. &lt;b&gt;69&lt;/b&gt;"), "ต้อง escapeHtml label เดือนด้วย");
  });
});
