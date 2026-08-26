// ===========================
// js/orders-tab-modal-design-approvals.js — ส่วน "อนุมัติแบบ" ของป๊อปอัพเพิ่ม/แก้ไขคำสั่งผลิต
// (js/orders-tab-modal.js) — P0.2c (ซับข้อสุดท้ายของ P0.2 Design Proof Approval)
//
// ดึงประวัติจาก listDesignApprovals(trackingId) (js/db-orders.js, เขียนไว้แล้วตั้งแต่ P0.2a)
// trackingId คำนวณจาก buildTrackingId(order.code, order.phone) — สูตรเดียวกับที่ลูกค้าใช้เช็ค
// สถานะ/กดอนุมัติแบบเองแบบ public (js/track-modal.js, P0.2b) ถ้า order ยังไม่มีทั้งเลข PO และ
// เบอร์โทรครบ (buildTrackingId คืน null) แปลว่ายังไม่มีทางที่ลูกค้าจะกดอนุมัติแบบได้เลย จึงคืนค่า
// ว่างตรงๆ ไม่ต้อง query — เขียนตามแพทเทิร์นเดียวกับ js/orders-tab-modal-history.js
// (loadOrderHistory) ทุกอย่าง ไม่มี state ภายในไฟล์นี้เลย เพราะ loadDesignApprovals() เป็นฟังก์ชัน
// async ที่ render DOM ของตัวเองทั้งหมดจบในตัว ไม่ต้องส่งค่าอะไรกลับข้ามไฟล์
//
// export ออกไปให้ js/orders-tab-modal.js เรียกใช้:
//   - loadDesignApprovals(order) — เรียกตอนเปิดป๊อปอัพ (openOrderModal/openOrderModalClone) รับ
//     order object เข้าตรงๆ (ต่างจาก loadOrderHistory(orderId) ที่รับแค่ id) เพราะไฟล์นี้ต้อง
//     คำนวณ trackingId เองจาก order.code + order.phone
// ===========================
import { listDesignApprovals, buildTrackingId, markDesignApprovalSeen } from "./db-orders.js";
import { errorStateHTML } from "./ui-helpers.js";
import { escapeHtml } from "./orders-tab.js";

const designApprovalsListBox = document.getElementById("cp-o-design-approvals-list");

const DESIGN_APPROVAL_ACTION_LABEL = {
  approved: "อนุมัติแบบ",
  changes_requested: "ขอแก้ไขแบบ"
};

// ── ประวัติอนุมัติแบบ (หมวด "อนุมัติแบบ") — ดึงจาก listDesignApprovals(trackingId) แล้วเรียง
// ใหม่สุดก่อน (listDesignApprovals คืนเรียงมาแบบนั้นอยู่แล้ว) ──
export async function loadDesignApprovals(order) {
  const trackingId = order ? buildTrackingId(order.code, order.phone) : null;
  if (!trackingId) {
    designApprovalsListBox.innerHTML = `<div class="cp-qc-empty">ต้องกรอกเลขที่คำสั่งผลิต + เบอร์โทรลูกค้าให้ครบก่อน ลูกค้าถึงจะเข้าหน้าอนุมัติแบบได้ แล้วประวัติจะเริ่มปรากฏที่นี่</div>`;
    return;
  }
  designApprovalsListBox.innerHTML = `<div class="cp-qc-empty">กำลังโหลด…</div>`;
  // P0.2-fix: เปิดแท็บนี้ = แอดมิน "เห็นแล้ว" — บันทึกเวลาไว้เทียบกับ log ล่าสุดของ trackingId นี้
  // (ดู markDesignApprovalSeen()/listenDesignApprovalsSummary() ใน js/db-orders.js) เพื่อเลิกโชว์
  // จุดแดงของ order ใบนี้ในตาราง — เรียกก่อน await ด้านล่างได้เลย ไม่ต้องรอโหลด log เสร็จก่อน
  // (ไม่ throw ออกมาเองอยู่แล้ว ดูคอมเมนต์หัวฟังก์ชัน)
  markDesignApprovalSeen(order.id);
  try {
    const logs = await listDesignApprovals(trackingId);
    if (!logs.length) {
      designApprovalsListBox.innerHTML = `<div class="cp-qc-empty">ยังไม่มีประวัติการอนุมัติ/ขอแก้ไขแบบสำหรับคำสั่งผลิตนี้</div>`;
      return;
    }
    designApprovalsListBox.innerHTML = logs.map(l => {
      const t = l.createdAt ? (l.createdAt.toMillis ? new Date(l.createdAt.toMillis()) : new Date(l.createdAt)) : null;
      const timeStr = t && !isNaN(t.getTime()) ? t.toLocaleString("th-TH") : "";
      const actionLabel = DESIGN_APPROVAL_ACTION_LABEL[l.action] || l.action || "";
      const isChangeRequest = l.action === "changes_requested";
      return `<div class="cp-history-item">
        <span class="cp-history-dot${isChangeRequest ? " is-warn" : ""}"></span>
        <div class="cp-history-body">
          <span class="cp-history-action">${escapeHtml(actionLabel)}${l.comment ? " — " + escapeHtml(l.comment) : ""}</span>
          <span class="cp-history-meta">${timeStr}</span>
        </div>
      </div>`;
    }).join("");
  } catch (err) {
    designApprovalsListBox.innerHTML = errorStateHTML(`โหลดประวัติอนุมัติแบบไม่สำเร็จ: ${err.message || ""}`, () => loadDesignApprovals(order), { wrapTag: "div" });
  }
}
