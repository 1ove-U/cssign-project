// ===========================
// js/orders-tab-filters.js — ตรรกะกรองรายการคำสั่งผลิต (แยกออกมาจาก js/orders-tab.js)
//
// 2026 refactor รอบที่ 33: เดิม logic กรอง (ค้นหา/สถานะ/ความเร่งด่วนที่ต้องกระโดดไปหา/
// "งานของฉัน") อยู่เป็น local logic ปนอยู่ใน render() ของ orders-tab.js เอง อ่าน
// `searchInput.value`/`auth.currentUser` (DOM/Firebase auth) ตรงๆ ปนกับตรรกะกรอง —
// ย้าย `filterOrders()` มาไว้ที่นี่เป็น **pure function ล้วนๆ** รับค่าที่ resolve จาก
// DOM/auth มาแล้วเป็นพารามิเตอร์ธรรมดาแทนทั้งหมด (ไม่มีการ import { db, auth } จาก
// db.js เลย ไม่มีการแตะ document/DOM เลยสักบรรทัดในไฟล์นี้) — import แค่ orderUrgency
// จาก db-orders-stats.js (pure function เดิมอยู่แล้ว ไม่มี Firestore call เช่นกัน)
//
// ผลคือทดสอบด้วย `node --test` ตรงๆ ได้เลยโดยไม่ต้องพึ่ง jsdom/fake-DOM stub —
// ต่างจาก orders-tab.js ที่ยังผูก DOM ทั้งไฟล์เหมือนเดิม (ดูคอมเมนต์หัวไฟล์นั้น)
//
// ลำดับการกรอง (ตัด id ที่รอ "เลิกทำ" หลังลบ → ค้นหา → สถานะ → jumpFilter → "งานของฉัน")
// ตรงกับของเดิมใน render() ทุกจุด ไม่มีจุดไหนสลับลำดับ/เปลี่ยน logic
// ===========================
import { orderUrgency } from "./db-orders-stats.js";

// กรองรายการคำสั่งผลิต (allOrders) ให้เหลือแถวที่จะแสดงในตาราง/kanban จริง
//
// orders        — array คำสั่งผลิตทั้งหมด (ยังไม่กรอง)
// searchTerm    — ค่าจากช่องค้นหา (คำสั่งผลิตนี้เทียบกับ code/customer/item)
// statusFilterValue — "" = ทุกสถานะ, else key ของ ORDER_STATUS
// jumpFilter    — "duesoon" | "overdue" | null (จากการกดการ์ดแจ้งเตือน/สถิติ)
// mineOnly      — true = เหลือเฉพาะงานที่ assignee ตรงกับผู้ใช้ปัจจุบัน
// currentUserUid — uid ของผู้ใช้ปัจจุบัน (resolve จาก auth.currentUser มาก่อนแล้ว) หรือ null
// excludeIds    — Set ของ id ที่ต้องตัดออกก่อนกรองอื่นๆ (เช่น รายการที่รอ "เลิกทำ" หลังลบ)
export function filterOrders(orders, {
  searchTerm = "",
  statusFilterValue = "",
  jumpFilter = null,
  mineOnly = false,
  currentUserUid = null,
  excludeIds = null,
} = {}) {
  let rows = excludeIds ? orders.filter(o => !excludeIds.has(o.id)) : orders.slice();

  const term = String(searchTerm || "").trim().toLowerCase();
  if (term) rows = rows.filter(o =>
    (o.code||"").toLowerCase().includes(term) ||
    (o.customer||"").toLowerCase().includes(term) ||
    (o.item||"").toLowerCase().includes(term)
  );
  if (statusFilterValue) rows = rows.filter(o => o.status === statusFilterValue);
  if (jumpFilter === "duesoon") rows = rows.filter(o => orderUrgency(o) === "due-soon");
  if (jumpFilter === "overdue") rows = rows.filter(o => orderUrgency(o) === "overdue");
  if (mineOnly) rows = rows.filter(o => o.assignee && currentUserUid && o.assignee === currentUserUid);

  return rows;
}
