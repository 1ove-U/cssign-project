// ===========================
// js/orders-tab-export.js — ส่งออก CSV + พิมพ์รายงานคำสั่งผลิต (คำสั่งผลิตของโปรเจกต์
// CS.SIGN 2026)
//
// 2026 refactor phase 3 (ต่อ): แยกออกมาจาก js/orders-tab.js เดิม (910 บรรทัด) — ดูหมายเหตุ
// เต็มใน js/orders-tab.js ไฟล์นี้เก็บเฉพาะปุ่ม "ส่งออก CSV" และ "พิมพ์รายงาน" ไม่มีการ
// เปลี่ยน logic ใดๆ จากของเดิม เป็นแค่ย้ายโค้ดเชิงโครงสร้าง — ไม่ export อะไรให้ไฟล์อื่นเรียก
// ใช้ ผูก listener เองตอนโหลดไฟล์ ต้อง import แบบ side-effect ไว้ใน orders-tab.js
//
// หมายเหตุ: ตัวแปรตัวกรอง (statusFilterValue/jumpFilter/mineOnly) และ pendingDeleteOrderIds
// ไฟล์นี้ "อ่านอย่างเดียว" ไม่มีจุดไหน reassign เลย จึงไม่ต้องมี setter ข้ามไฟล์ — ใช้วิธีเพิ่ม
// export หน้าตัวแปรเหล่านี้ในไฟล์ต้นฉบับ (orders-tab.js) ตรงๆ ได้เลย (live binding ของ ES
// module จะอ่านค่าล่าสุดเสมอ ปลอดภัยเพราะไฟล์นี้ไม่เขียนทับ)
// ===========================
import { auth } from "./db.js";
import { ORDER_STATUS, PAYMENT_STATUS } from "./db-orders.js";
import { computeOrderStats, orderUrgency, orderBalance } from "./db-orders-stats.js";
import { getAllOrders, showToast, escapeHtml, formatBaht,
         pendingDeleteOrderIds, statusFilterValue, jumpFilter, mineOnly } from "./orders-tab.js";

const searchInput    = document.getElementById("cp-search");
const exportCsvBtn   = document.getElementById("cp-export-csv-btn");
const printBtn       = document.getElementById("cp-print-btn");
const printReportBox = document.getElementById("cp-print-report");

// ── Export CSV ──────────────────────────────
exportCsvBtn.addEventListener("click", () => {
  const rows = getCurrentFilteredRows();
  if (!rows.length) { showToast("ไม่มีข้อมูลให้ส่งออก", "error"); return; }
  const headers = ["เลขที่คำสั่ง","ลูกค้า","รายการ","หมวดป้าย","จำนวน","สถานะ","ความคืบหน้า(%)","กำหนดส่ง","สถานะการชำระเงิน","ยอดค้างชำระ (บาท)"];
  const csvRows = [headers.join(",")];
  rows.forEach(o => {
    csvRows.push([
      csvCell(o.code), csvCell(o.customer), csvCell(o.item), csvCell(o.category),
      o.qty ?? "", csvCell(ORDER_STATUS[o.status] ? ORDER_STATUS[o.status].label : o.status),
      o.progress ?? 0, csvCell(o.dueDate),
      csvCell(PAYMENT_STATUS[o.paymentStatus] ? PAYMENT_STATUS[o.paymentStatus].label : "ยังไม่ชำระ"),
      orderBalance(o)
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
  const allOrders = getAllOrders();
  const stats = computeOrderStats(allOrders);
  const now = new Date();
  printReportBox.innerHTML = `
    <h1>รายงานคำสั่งผลิต — CS.SIGN</h1>
    <div class="cp-print-sub">พิมพ์เมื่อ ${now.toLocaleDateString("th-TH")} ${now.toLocaleTimeString("th-TH")} · ทั้งหมด ${rows.length} รายการ (จากทั้งหมด ${allOrders.length} รายการ) · กำลังดำเนินการ ${stats.activeCount} · เกินกำหนด ${stats.overdueCount} · ใกล้ครบกำหนด ${stats.dueSoonCount}</div>
    <table>
      <thead><tr>
        <th>เลขที่คำสั่ง</th><th>ลูกค้า</th><th>รายการ</th><th>จำนวน</th><th>สถานะ</th><th>ความคืบหน้า</th><th>กำหนดส่ง</th><th>สถานะการชำระเงิน</th><th>ยอดค้างชำระ</th>
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
          <td>${escapeHtml(PAYMENT_STATUS[o.paymentStatus] ? PAYMENT_STATUS[o.paymentStatus].label : "ยังไม่ชำระ")}</td>
          <td>${formatBaht(orderBalance(o))}</td>
        </tr>`).join("")}
      </tbody>
    </table>`;
  window.print();
});

function getCurrentFilteredRows() {
  let rows = getAllOrders().filter(o => !pendingDeleteOrderIds.has(o.id));
  const term = searchInput.value.trim().toLowerCase();
  if (term) rows = rows.filter(o =>
    (o.code||"").toLowerCase().includes(term) ||
    (o.customer||"").toLowerCase().includes(term) ||
    (o.item||"").toLowerCase().includes(term)
  );
  if (statusFilterValue) rows = rows.filter(o => o.status === statusFilterValue);
  if (jumpFilter === "duesoon") rows = rows.filter(o => orderUrgency(o) === "due-soon");
  if (jumpFilter === "overdue") rows = rows.filter(o => orderUrgency(o) === "overdue");
  if (mineOnly) rows = rows.filter(o => o.assignee && auth.currentUser && o.assignee === auth.currentUser.uid);
  return rows;
}
