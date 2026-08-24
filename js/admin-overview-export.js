// ===========================================================
// js/admin-overview-export.js — Export รายงานภาพรวม (PDF/CSV) ของแท็บ "ภาพรวม"
//
// 2026 refactor phase 3 (ต่อ): แยกออกมาจาก js/admin-overview-dashboard.js เดิม (569 บรรทัด)
// ไฟล์นี้เก็บเฉพาะปุ่ม "Export CSV" และ "Export PDF" ไม่มีการเปลี่ยน logic ใดๆ จากของเดิม
// เป็นแค่ย้ายโค้ดเชิงโครงสร้าง — ไม่ export อะไรให้ไฟล์อื่นเรียกใช้ ผูก listener เองตอนโหลดไฟล์
// ต้อง import แบบ side-effect ไว้ใน admin-overview-dashboard.js เอง (แพทเทิร์นเดียวกับที่
// orders-tab.js ทำกับ orders-tab-export.js — ไม่ใช่ import ไว้ที่ admin-page.js โดยตรง)
// ===========================================================
import { computeOrderStats, computeLeadStats } from "./db-orders-stats.js";
import { getAllOrders } from "./orders-tab.js";
import { cumulativeCountHistory } from "./stats-trends.js";
import { escapeHtml, showToast, downloadCsv } from "./admin-utils.js";
import { allProducts, allPortfolios, allBlogs, allCategories } from "./admin-state.js";
import { allLeads } from "./admin-leads.js";
import { ovFormatBaht } from "./admin-overview-dashboard.js";

// ============ Export รายงาน (PDF/CSV) ============
// ปุ่ม "Export CSV" / "Export PDF" ในหัวข้อ "ภาพรวม" — ดึงสถิติภาพรวม (จำนวนสินค้า/หมวดหมู่/
// ผลงาน/บทความสะสม) + ลีด + คำสั่งผลิต แยกรายเดือน (ย้อนหลัง 6 เดือน เท่ากับกราฟ/การ์ด
// เทรนด์ในหน้านี้) มาจากชุดข้อมูลเดียวกับที่ใช้ render อยู่แล้ว (computeOrderStats/
// computeLeadStats/cumulativeCountHistory) — ไม่ query Firestore เพิ่ม ทำฝั่ง browser ล้วนๆ
// ไม่มี backend เพิ่มตามที่ระบุ
function buildOverviewReportRows() {
  const orders = getAllOrders ? getAllOrders() : [];
  const orderStats = computeOrderStats(orders);
  const leadStats = computeLeadStats(allLeads);
  const productsHist     = cumulativeCountHistory(allProducts, p => p.createdAt);
  const categoriesHist   = cumulativeCountHistory(allCategories, c => c.createdAt);
  const portfolioHist    = cumulativeCountHistory(allPortfolios, p => p.createdAt);
  const blogHist         = cumulativeCountHistory(allBlogs, b => b.createdAt);
  // ทุกฟังก์ชันข้างบนใช้ monthBuckets(6) ชุดเดียวกัน (js/stats-trends.js) เรียกในช่วงเวลาเดียวกัน
  // จึงมี label/ขอบเขตเดือนตรงกันหมด ใช้ index เดียวกัน zip ได้เลยโดยไม่ต้องเทียบ label ทีละคู่
  const labels = orderStats.monthly.labels;
  return labels.map((label, i) => ({
    label,
    productsCum: productsHist[i] ?? 0,
    categoriesCum: categoriesHist[i] ?? 0,
    portfolioCum: portfolioHist[i] ?? 0,
    blogCum: blogHist[i] ?? 0,
    newLeads: leadStats.monthly.newLeads[i] ?? 0,
    conversionRate: leadStats.monthly.conversionRate[i],
    ordersCreated: orderStats.monthly.created[i] ?? 0,
    ordersCompleted: orderStats.monthly.completed[i] ?? 0,
    revenue: orderStats.monthly.revenue[i] ?? 0
  }));
}

// ── Export CSV — ใช้ downloadCsv()/csvCell() ตัวเดียวกับ js/admin-products-csv.js ──
const OV_REPORT_CSV_HEADERS = [
  "เดือน", "สินค้าสะสม", "หมวดหมู่สะสม", "ผลงานสะสม", "บทความสะสม",
  "ลีดใหม่", "อัตราปิดการขายลีด (%)", "งานผลิตใหม่", "งานผลิตเสร็จ", "รายได้ (บาท)"
];
function reportRowToCsvRow(r) {
  return [
    r.label, r.productsCum, r.categoriesCum, r.portfolioCum, r.blogCum,
    r.newLeads, r.conversionRate == null ? "" : r.conversionRate, r.ordersCreated, r.ordersCompleted, r.revenue
  ];
}
document.getElementById("ov-export-csv-btn").addEventListener("click", () => {
  const rows = buildOverviewReportRows().map(reportRowToCsvRow);
  downloadCsv(`overview-report-${new Date().toISOString().slice(0,10)}.csv`, OV_REPORT_CSV_HEADERS, rows);
});

// ── Export PDF — jsPDF + html2canvas โหลดจาก CDN แบบ dynamic import ตอนกดปุ่มครั้งแรกเท่านั้น
// (ไม่โหลดทุกครั้งที่เปิดหน้าแอดมิน เพราะ 2 ไลบรารีนี้ค่อนข้างหนักและใช้เฉพาะตอน export) แคช
// promise ไว้ใน ovPdfLibsPromise กันโหลดซ้ำถ้ากด export หลายครั้ง
//
// ทำไมต้อง "วาดเป็น HTML แล้วถ่ายภาพ" แทนการเขียนข้อความลง PDF ตรงๆ ด้วย doc.text(): ฟอนต์
// มาตรฐานที่ติดมากับ jsPDF (Helvetica/Times/Courier) ไม่มีตัวอักษรไทยอยู่ในฟอนต์ ถ้าใช้ doc.text()
// เขียนข้อความไทยตรงๆ จะได้กล่องว่าง/สัญลักษณ์แปลกๆ แทนตัวอักษรจริงทั้งหมด (ต้อง embed ฟอนต์ไทย
// เป็น custom font ถึงจะใช้ได้ ซึ่งเพิ่มความซับซ้อนและขนาดไฟล์มาก) — วิธีนี้ให้เบราว์เซอร์ของผู้ใช้
// render ข้อความไทยด้วยฟอนต์ที่มีอยู่แล้ว (เหมือนหน้าเว็บปกติ) แล้วค่อย "ถ่ายภาพ" เป็น canvas ก่อน
// แปะลง PDF จึงไม่มีปัญหาฟอนต์ไทยหายเลย โดยแลกกับ PDF ที่ได้เป็นภาพ (เลือกก็อปข้อความไม่ได้)
// ซึ่งเหมาะกับ "รายงานเอาไว้ดู/พิมพ์/ส่งต่อ" แบบนี้อยู่แล้ว
let ovPdfLibsPromise = null;
function loadPdfLibs() {
  if (!ovPdfLibsPromise) {
    ovPdfLibsPromise = Promise.all([
      import("https://esm.sh/jspdf@2.5.2"),
      import("https://esm.sh/html2canvas@1.4.1")
    ]).then(([jspdfMod, html2canvasMod]) => ({
      jsPDF: jspdfMod.jsPDF,
      html2canvas: html2canvasMod.default
    }));
  }
  return ovPdfLibsPromise;
}

// สร้าง DOM รายงาน (นอกจอ — position:fixed ซ้ายติดลบ) ด้วย inline style ล้วนๆ แทนที่จะพึ่งคลาส
// CSS ของหน้าแอดมิน (ธีมเข้ม/สไตล์แดชบอร์ด) เพื่อให้หน้ารายงานที่ export ออกมาอ่านง่าย พิมพ์ได้จริง
// ไม่ขึ้นกับว่า admin.css จะถูกแก้ในอนาคตอย่างไร
function buildOverviewReportEl(rows, summaryItems, nowStr) {
  const thStyle = "padding:6px 8px; border-bottom:2px solid #d1d5db; text-align:left; font-weight:700; color:#374151;";
  const tdStyle = "padding:6px 8px; border-bottom:1px solid #e5e7eb;";
  const el = document.createElement("div");
  el.style.cssText = "position:fixed; left:-9999px; top:0; width:760px; background:#ffffff; color:#111827; padding:32px; font-family:-apple-system,'Segoe UI','Noto Sans Thai',sans-serif;";
  el.innerHTML = `
    <div style="text-align:center; margin-bottom:22px; border-bottom:2px solid #0B5A96; padding-bottom:14px;">
      <div style="font-size:21px; font-weight:700; color:#0B5A96;">รายงานภาพรวม — CS.SIGN</div>
      <div style="font-size:12px; color:#6b7280; margin-top:4px;">สร้างเมื่อ ${escapeHtml(nowStr)}</div>
    </div>
    <div style="font-size:14.5px; font-weight:700; margin:0 0 10px;">สรุปข้อมูลปัจจุบัน</div>
    <table style="width:100%; border-collapse:collapse; margin-bottom:24px; font-size:12.5px;">
      <tbody>
        ${summaryItems.map(([label, value]) => `
          <tr>
            <td style="padding:6px 10px; border-bottom:1px solid #e5e7eb; color:#4b5563;">${escapeHtml(label)}</td>
            <td style="padding:6px 10px; border-bottom:1px solid #e5e7eb; font-weight:700; text-align:right;">${escapeHtml(String(value))}</td>
          </tr>`).join("")}
      </tbody>
    </table>
    <div style="font-size:14.5px; font-weight:700; margin:0 0 10px;">สถิติรายเดือน (ย้อนหลัง 6 เดือน)</div>
    <table style="width:100%; border-collapse:collapse; font-size:11px;">
      <thead>
        <tr style="background:#f3f4f6;">
          <th style="${thStyle}">เดือน</th>
          <th style="${thStyle}">งานผลิตใหม่</th>
          <th style="${thStyle}">งานผลิตเสร็จ</th>
          <th style="${thStyle}">รายได้ (บาท)</th>
          <th style="${thStyle}">ลีดใหม่</th>
          <th style="${thStyle}">อัตราปิดการขาย</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(r => `
          <tr>
            <td style="${tdStyle}">${escapeHtml(r.label)}</td>
            <td style="${tdStyle} text-align:right;">${r.ordersCreated}</td>
            <td style="${tdStyle} text-align:right;">${r.ordersCompleted}</td>
            <td style="${tdStyle} text-align:right;">${escapeHtml(ovFormatBaht(r.revenue))}</td>
            <td style="${tdStyle} text-align:right;">${r.newLeads}</td>
            <td style="${tdStyle} text-align:right;">${r.conversionRate == null ? "—" : r.conversionRate + "%"}</td>
          </tr>`).join("")}
      </tbody>
    </table>
    <div style="margin-top:18px; font-size:10px; color:#9ca3af; text-align:center;">
      รายงานสร้างโดยอัตโนมัติจากระบบจัดการ CS.SIGN — ตัวเลขคำนวณจากข้อมูล ณ เวลาที่ export เท่านั้น
    </div>`;
  return el;
}

const ovExportPdfBtn = document.getElementById("ov-export-pdf-btn");
ovExportPdfBtn.addEventListener("click", async () => {
  const originalHtml = ovExportPdfBtn.innerHTML;
  ovExportPdfBtn.disabled = true;
  ovExportPdfBtn.innerHTML = "กำลังสร้าง PDF...";
  let reportEl = null;
  try {
    const { jsPDF, html2canvas } = await loadPdfLibs();
    const rows = buildOverviewReportRows();
    const orders = getAllOrders ? getAllOrders() : [];
    const orderStats = computeOrderStats(orders);
    const ovWonCount    = allLeads.filter(l => l.status === "won").length;
    const ovLostCount   = allLeads.filter(l => l.status === "lost").length;
    const ovClosedCount = ovWonCount + ovLostCount;
    const ovConversionRate = ovClosedCount ? Math.round((ovWonCount / ovClosedCount) * 100) : null;
    const ovLeadsNewCount = allLeads.filter(l => l.status === "new").length;

    const summaryItems = [
      ["สินค้าทั้งหมด", allProducts.length],
      ["หมวดหมู่", allCategories.length],
      ["ผลงาน", allPortfolios.length],
      ["บทความ", allBlogs.length],
      ["ลีดใหม่ (ยังไม่จัดการ)", ovLeadsNewCount],
      ["อัตราปิดการขาย (สะสม)", ovConversionRate == null ? "—" : ovConversionRate + "%"],
      ["งานที่กำลังดำเนินการ", orderStats.activeCount],
      ["งานที่เสร็จแล้ว", orderStats.completedCount],
      ["ยอดค้างชำระรวม", ovFormatBaht(orderStats.totalBalance)]
    ];
    const nowStr = new Date().toLocaleString("th-TH", { dateStyle: "long", timeStyle: "short" });

    reportEl = buildOverviewReportEl(rows, summaryItems, nowStr);
    document.body.appendChild(reportEl);

    const canvas = await html2canvas(reportEl, { scale: 2, backgroundColor: "#ffffff", useCORS: true });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({ unit: "pt", format: "a4" });
    const pageWidth  = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth  = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    // เนื้อหาสูงกว่า 1 หน้า A4 ได้ (ยิ่งมีหลายเดือน/หลายแถวยิ่งสูง) — ตัดภาพเดียวกันขึ้นหน้าใหม่
    // ไปเรื่อยๆ โดยเลื่อนตำแหน่ง y ขึ้นทีละหน้า (pattern มาตรฐานของ jsPDF+html2canvas)
    let heightLeft = imgHeight;
    let position = 0;
    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
    while (heightLeft > 0) {
      position -= pageHeight;
      pdf.addPage();
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }
    pdf.save(`overview-report-${new Date().toISOString().slice(0,10)}.pdf`);
  } catch (err) {
    console.error("[admin-overview-dashboard] export PDF ล้มเหลว", err);
    showToast("สร้าง PDF ไม่สำเร็จ: " + err.message);
  } finally {
    if (reportEl) reportEl.remove();
    ovExportPdfBtn.disabled = false;
    ovExportPdfBtn.innerHTML = originalHtml;
  }
});
