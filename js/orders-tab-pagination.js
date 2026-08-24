// ===========================
// js/orders-tab-pagination.js — ส่วนแถบ pagination footer ("แสดง 1–10 จาก 80 รายการ" + ปุ่ม
// เปลี่ยนหน้า) ของแท็บคำสั่งผลิต (คำสั่งผลิตของโปรเจกต์ CS.SIGN 2026)
//
// 2026 refactor รอบที่ 36: แยกออกมาจาก js/orders-tab.js เดิม (renderPagination() เดิมเป็น local
// function ในไฟล์นั้น) — ตรวจแล้วว่า**ไม่ใช่** pure function (แตะ DOM ตรงๆ ทั้ง
// paginationBox/paginationInfo/paginationBtns/tableView, ผูก event listener ปุ่มเปลี่ยนหน้า) —
// ต่างจาก renderOrderRow()/filterOrders() ที่แยกไปรอบก่อนๆ (รอบ 33/35) ตรงที่ตัวนี้ยังต้อง
// **เขียน** currentPage ข้ามไฟล์ด้วย ไม่ใช่แค่อ่าน — currentPage เดิมเป็น module-level `let` ใน
// orders-tab.js อย่างเดียว, ไฟล์นี้ import กลับมาใช้แบบ live binding (อ่านค่าล่าสุดได้เสมอ) แต่
// import binding ปกติเขียนข้ามไฟล์ไม่ได้ (ES module spec) จึงต้องมี setCurrentPage() เป็น setter
// export จาก orders-tab.js แทน — เมื่อไฟล์นี้เรียก setCurrentPage(n) แล้ว การอ่าน currentPage
// (live binding) ในบรรทัดถัดไปของไฟล์นี้จะเห็นค่าใหม่ทันที (synchronous เหมือนเรียกฟังก์ชันปกติ)
// — เช่นเดียวกับ render() ที่ปุ่มเปลี่ยนหน้าต้องเรียกกลับหลังอัปเดต currentPage: export render()
// จาก orders-tab.js มาให้ไฟล์นี้ import กลับ (รูปแบบ circular import เดียวกับที่มีอยู่แล้วระหว่าง
// orders-tab.js ↔ orders-tab-kanban.js/orders-tab-modal.js/orders-tab-stats.js — วนกลับได้ปกติ
// เพราะทุกจุดเรียกใช้ข้ามไฟล์เป็นการเรียกภายใน event handler ไม่ใช่ตอน module ประเมินค่าระดับบนสุด)
//
// ไม่มีการเปลี่ยน logic ใดๆ จากของเดิม เป็นแค่ย้ายโค้ดเชิงโครงสร้าง + เปลี่ยนจุดที่เคยเขียน
// currentPage ตรงๆ (`currentPage = X`) ให้เรียก setCurrentPage(X) แทน (ยืนยันด้วย diff บรรทัดต่อ
// บรรทัดแล้วว่าพฤติกรรมเหมือนเดิมทุกจุด) — paginationBox ยังถูก query ซ้ำในไฟล์นี้ (เหมือนกับ
// tableView) แม้ orders-tab.js เองจะยัง query ตัวมันเองไว้ใช้ตรงๆ ใน render() ด้วย (ซ่อน/แสดงตอน
// สลับมุมมอง kanban กับตอน error) — เป็นรูปแบบเดียวกับที่ orders-tab-stats.js/orders-tab-kanban.js
// query DOM element ของตัวเองอยู่แล้วโดยไม่ยุ่งกับตัวแปร const ใน orders-tab.js เลย
// ===========================
import { buildPageList } from "./admin-utils.js";
import { ORDERS_PAGE_SIZE, currentPage, setCurrentPage, render } from "./orders-tab.js";

const paginationBox   = document.getElementById("cp-pagination");
const paginationInfo  = document.getElementById("cp-pagination-info");
const paginationBtns  = document.getElementById("cp-pagination-btns");
const tableView       = document.getElementById("cp-table-view");

export function renderPagination(totalRows) {
  const totalPages = Math.max(1, Math.ceil(totalRows / ORDERS_PAGE_SIZE));
  if (currentPage > totalPages) setCurrentPage(totalPages);
  if (currentPage < 1) setCurrentPage(1);

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
      if (btn.dataset.page === "prev") setCurrentPage(Math.max(1, currentPage - 1));
      else if (btn.dataset.page === "next") setCurrentPage(Math.min(totalPages, currentPage + 1));
      else setCurrentPage(Number(btn.dataset.page));
      render();
      tableView.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  });
}
