// ===========================
// js/orders-tab-modal-attach.js — ส่วน "ไฟล์แนบ" ของป๊อปอัพเพิ่ม/แก้ไขคำสั่งผลิต
// (js/orders-tab-modal.js) — อัปโหลดรูป/ไฟล์แนบผ่าน uploadImage()/uploadFile() แล้วเก็บ
// url ไว้ใน currentAttachments จนกว่าจะกด "บันทึก" ฟอร์มหลัก
//
// 2026 refactor phase 6: แยกออกมาจาก js/orders-tab-modal.js เดิม (493 บรรทัด) — ย้ายส่วน
// DOM ref ของหมวด "ไฟล์แนบ" (บรรทัด 71-74 เดิม), state currentAttachments (บรรทัด 78 เดิม),
// และทั้งบล็อก "── ไฟล์แนบ ──" (renderAttachGrid/currentUserLabel/attachImageInput
// listener/attachFileInput listener, บรรทัด 240-302 เดิม) มาทั้งหมดแบบ diff เป๊ะ ไม่มี
// เปลี่ยน logic — orders-tab-modal.js ยังคงมีฟอร์มหลัก (ข้อมูลลูกค้า/สินค้า/ราคา/การเงิน/
// การจัดส่ง/QC/ประวัติ) เหมือนเดิม (ดูหมายเหตุที่หัวไฟล์นั้น)
//
// export ออกไปให้ js/orders-tab-modal.js เรียกใช้:
//   - currentAttachments (`let` — live binding อ่านตรงๆ ได้ เช่นตอนประกอบ payload ส่งบันทึก)
//   - setCurrentAttachments(list) — setter สำหรับตอนเปิด/ปิดป๊อปอัพ (reassign import binding
//     ตรงๆ ไม่ได้ เหมือนรูปแบบ setLCurrentPage ใน admin-leads.js)
//   - renderAttachGrid() — orders-tab-modal.js เรียกตอนเปิด/ปิดป๊อปอัพ (openOrderModal/
//     closeOrderModal) เหมือนเดิมที่เคยเรียกตอนยังอยู่ไฟล์เดียวกัน
//   - attachStatusEl (DOM element — const, ไม่ต้อง reassign ตัวแปรเอง แค่แก้
//     .textContent ได้ตรงๆ) — openOrderModal ต้องเคลียร์ข้อความสถานะทุกครั้งที่เปิดป๊อปอัพ
//
// P0.2c (Design Proof Approval — ส่วนแอดมิน): เพิ่ม checkbox "ลูกค้าเห็น" ต่อไฟล์แนบแต่ละอัน —
// เขียนค่าลง item.showToCustomer ตรงๆ ใน currentAttachments (field ใหม่ เพิ่มแบบ additive ต่อ
// attachment object เดิม ไม่กระทบ field อื่น) js/orders-tab-modal.js อ่านค่านี้ตอนประกอบ payload
// เพื่อกรองเป็น order.designFiles ที่ normalizeOrderExtras()/upsertOrderTracking() (js/db-orders.js)
// รับต่อไป — ไม่ได้เพิ่ม export ใหม่ เพราะ currentAttachments ที่ export อยู่แล้วพอสำหรับให้ไฟล์
// นั้นอ่าน showToCustomer ต่อ item ได้ตรงๆ
// ===========================
import { uploadImage, uploadFile } from "./db-media.js";
import { auth } from "./db.js";
import { escapeHtml } from "./orders-tab.js";

const attachGridBox     = document.getElementById("cp-o-attach-grid");
const attachImageInput  = document.getElementById("cp-o-attach-image");
const attachFileInput   = document.getElementById("cp-o-attach-file");
export const attachStatusEl = document.getElementById("cp-o-attach-status");

export let currentAttachments = [];
// setter สำหรับไฟล์นอก module นี้ (orders-tab-modal.js) — reassign import binding ตรงๆ ไม่ได้
export function setCurrentAttachments(list) { currentAttachments = list; }

// ── ไฟล์แนบ — อัปโหลดผ่าน uploadImage()/uploadFile() (js/db-media.js) แล้วเก็บ url ไว้ใน currentAttachments
// จนกว่าจะกด "บันทึก" ฟอร์ม (เหมือนฟิลด์อื่นๆ ในป๊อปอัพนี้) ──
export function renderAttachGrid() {
  if (!currentAttachments.length) {
    attachGridBox.innerHTML = `<div class="cp-qc-empty">ยังไม่มีไฟล์แนบ</div>`;
    return;
  }
  attachGridBox.innerHTML = currentAttachments.map((a, idx) => {
    const isImage = (a.type || "").startsWith("image") || /\.(png|jpe?g|webp|gif)$/i.test(a.url || "");
    // P0.2c: checkbox "ลูกค้าเห็น" ต่อไฟล์ — เขียนกลับลง a.showToCustomer ตรงๆ (ดูหมายเหตุหัวไฟล์)
    const visibleToggle = `<label class="cp-attach-visible" title="แสดงไฟล์นี้ให้ลูกค้าดูได้ในหน้าอนุมัติแบบ">
          <input type="checkbox" class="cp-attach-visible-toggle" data-idx="${idx}" ${a.showToCustomer ? "checked" : ""}>
          <span>ลูกค้าเห็น</span>
        </label>`;
    return isImage
      ? `<div class="cp-attach-item">
          <a class="cp-attach-link" href="${a.url}" target="_blank" rel="noopener"></a>
          <img src="${a.url}" alt="${escapeHtml(a.label || "")}">
          <button type="button" class="cp-attach-remove" data-idx="${idx}" title="ลบไฟล์นี้">×</button>
          ${visibleToggle}
        </div>`
      : `<div class="cp-attach-item is-file">
          <a class="cp-attach-link" href="${a.url}" target="_blank" rel="noopener"></a>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
          <span>${escapeHtml(a.label || "ไฟล์แนบ")}</span>
          <button type="button" class="cp-attach-remove" data-idx="${idx}" title="ลบไฟล์นี้">×</button>
          ${visibleToggle}
        </div>`;
  }).join("");
}
attachGridBox.addEventListener("click", (e) => {
  const btn = e.target.closest(".cp-attach-remove");
  if (!btn) return;
  currentAttachments.splice(Number(btn.dataset.idx), 1);
  renderAttachGrid();
});
// P0.2c: toggle "ลูกค้าเห็น" — เขียนค่าตรงลง currentAttachments[idx] ไม่ต้อง renderAttachGrid()
// ใหม่ทั้งก้อน (กัน checkbox เสีย focus ระหว่างติ๊ก เหมือนกันปัญหาเดียวกับ input ทั่วไปในฟอร์มนี้)
attachGridBox.addEventListener("change", (e) => {
  const box = e.target.closest(".cp-attach-visible-toggle");
  if (!box) return;
  const item = currentAttachments[Number(box.dataset.idx)];
  if (item) item.showToCustomer = box.checked;
});
function currentUserLabel() {
  const u = auth.currentUser;
  return u ? (u.email || u.uid) : "";
}
attachImageInput.addEventListener("change", async () => {
  const file = attachImageInput.files[0];
  if (!file) return;
  attachStatusEl.textContent = "กำลังอัปโหลดรูป...";
  try {
    const url = await uploadImage(file);
    currentAttachments.push({ url, type: "image", label: file.name, uploadedAt: new Date().toISOString(), uploadedBy: currentUserLabel() });
    renderAttachGrid();
    attachStatusEl.textContent = "อัปโหลดรูปสำเร็จ";
  } catch (err) {
    attachStatusEl.textContent = "อัปโหลดไม่สำเร็จ: " + err.message;
  } finally {
    attachImageInput.value = "";
  }
});
attachFileInput.addEventListener("change", async () => {
  const file = attachFileInput.files[0];
  if (!file) return;
  attachStatusEl.textContent = "กำลังอัปโหลดไฟล์...";
  try {
    const url = await uploadFile(file, "paisign/order-attachments");
    currentAttachments.push({ url, type: file.type || "file", label: file.name, uploadedAt: new Date().toISOString(), uploadedBy: currentUserLabel() });
    renderAttachGrid();
    attachStatusEl.textContent = "อัปโหลดไฟล์สำเร็จ";
  } catch (err) {
    attachStatusEl.textContent = "อัปโหลดไม่สำเร็จ: " + err.message;
  } finally {
    attachFileInput.value = "";
  }
});
