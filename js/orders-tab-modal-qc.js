// ===========================
// js/orders-tab-modal-qc.js — ส่วน "QC checklist" ของป๊อปอัพเพิ่ม/แก้ไขคำสั่งผลิต
// (js/orders-tab-modal.js) — รายการตรวจสอบคุณภาพแบบ dynamic (เพิ่ม/ลบ/แก้ label/ติ๊กถูก)
// เก็บไว้ใน currentQcChecklist จนกว่าจะกด "บันทึก" ฟอร์มหลัก (แทนที่ checkbox "compliant"
// เดิม — ตัดฟิลด์ compliant/มอก./ISO ออกจาก scope นี้ทั้งหมดแล้ว)
//
// 2026 refactor phase 7: แยกออกมาจาก js/orders-tab-modal.js เดิม (440 บรรทัด) — ย้าย DOM ref
// ของหมวด "QC checklist" (บรรทัด 80-81 เดิม), state currentQcChecklist (บรรทัด 87 เดิม), และ
// ทั้งบล็อก "── QC checklist ──" (renderQcList/3 event listener ของ qcListBox/qcAddBtn click,
// บรรทัด 219-249 เดิม) มาทั้งหมดแบบ diff เป๊ะ ไม่มีเปลี่ยน logic — ใช้แพทเทิร์นเดียวกับ
// currentAttachments/setCurrentAttachments ใน js/orders-tab-modal-attach.js (phase 6) ทุก
// ประการ (state export เป็น `let` อ่านตรงได้ ส่วนเขียนต้องผ่าน setter เพราะ reassign import
// binding ตรงๆ จากไฟล์อื่นไม่ได้)
//
// export ออกไปให้ js/orders-tab-modal.js เรียกใช้:
//   - currentQcChecklist (`let` — live binding อ่านตรงๆ ได้ เช่นตอนประกอบ payload ส่งบันทึก)
//   - setCurrentQcChecklist(list) — setter สำหรับตอนเปิด/ปิดป๊อปอัพ (openOrderModal/
//     closeOrderModal) เหมือนรูปแบบ setCurrentAttachments
//   - renderQcList() — orders-tab-modal.js เรียกตอนเปิด/ปิดป๊อปอัพ เหมือนเดิมที่เคยเรียกตอน
//     ยังอยู่ไฟล์เดียวกัน
// ===========================
import { escapeHtml } from "./orders-tab.js";

const qcListBox = document.getElementById("cp-o-qc-list");
const qcAddBtn  = document.getElementById("cp-o-qc-add");

export let currentQcChecklist = [];
// setter สำหรับไฟล์นอก module นี้ (orders-tab-modal.js) — reassign import binding ตรงๆ ไม่ได้
export function setCurrentQcChecklist(list) { currentQcChecklist = list; }

// ── QC checklist (แทนที่ checkbox "compliant" เดิม — ตัดฟิลด์ compliant/มอก./ISO ออกจาก scope นี้ทั้งหมดแล้ว) ──
export function renderQcList() {
  if (!currentQcChecklist.length) {
    qcListBox.innerHTML = `<div class="cp-qc-empty">ยังไม่มีรายการตรวจสอบคุณภาพ</div>`;
    return;
  }
  qcListBox.innerHTML = currentQcChecklist.map((q, idx) => `
    <div class="cp-qc-row">
      <input type="checkbox" ${q.checked ? "checked" : ""} data-qc-check="${idx}">
      <input type="text" class="cl-input" value="${escapeHtml(q.label || "")}" placeholder="รายการตรวจสอบ เช่น สีตรงตามสเปก" data-qc-label="${idx}">
      <button type="button" class="cp-qc-remove" data-qc-remove="${idx}" title="ลบรายการนี้">×</button>
    </div>`).join("");
}
qcListBox.addEventListener("input", (e) => {
  if (e.target.dataset.qcLabel == null) return;
  currentQcChecklist[Number(e.target.dataset.qcLabel)].label = e.target.value;
});
qcListBox.addEventListener("change", (e) => {
  if (e.target.dataset.qcCheck == null) return;
  currentQcChecklist[Number(e.target.dataset.qcCheck)].checked = e.target.checked;
});
qcListBox.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-qc-remove]");
  if (!btn) return;
  currentQcChecklist.splice(Number(btn.dataset.qcRemove), 1);
  renderQcList();
});
qcAddBtn.addEventListener("click", () => {
  currentQcChecklist.push({ label: "", checked: false });
  renderQcList();
});
