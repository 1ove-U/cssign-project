// ===========================
// js/db-orders.js — Data layer: Leads / Orders (Production Console) / Order Tracking
// ===========================
// 2026 refactor: แยกออกมาจาก js/db.js เดิม (~1,232 บรรทัด) เพื่อไม่ให้ไฟล์เดียวรวมทั้ง
// "ข้อมูลเนื้อหาเว็บไซต์" (สินค้า/หมวดหมู่/portfolio/ฯลฯ) และ "ข้อมูลปฏิบัติการ" (ลีด/
// คำสั่งผลิต/tracking) ปนกัน ไฟล์นี้เก็บเฉพาะฝั่งปฏิบัติการ ตามลำดับเดิมในไฟล์ต้นฉบับ:
// LEADS CRUD → ORDERS CRUD (Production Console) → ORDER TRACKING (public) — ไม่มีการ
// เปลี่ยน logic ใดๆ จากของเดิม เป็นแค่ย้ายโค้ดเชิงโครงสร้าง (ดู diff เทียบกับ js/db.js
// ฉบับก่อนแตกไฟล์)
//
// 2026 refactor รอบที่ 32: ส่วน "สถิติ" (daysUntilDue/orderUrgency/orderGrandTotal/
// orderBalance/computeOrderStats/computeLeadStats) ที่เคยอยู่ท้ายไฟล์นี้ถูกแยกออกไปเป็น
// js/db-orders-stats.js แล้ว เพราะเป็น pure function ล้วนๆ ไม่มีการเรียก Firestore เลย
// (รับ orders[]/leads[] ที่ดึงมาแล้วเข้ามาคำนวณ) ไฟล์นี้ไม่ได้เรียกใช้ฟังก์ชันกลุ่มนั้นแล้ว —
// ทุกจุดที่เคยเรียกผ่านไฟล์นี้ถูกแก้ไปเรียก "./db-orders-stats.js" โดยตรงแทนหมดแล้ว
//
// 2026 refactor รอบที่ 38: ตรวจทั้งไฟล์อย่างละเอียดทีละฟังก์ชันตามที่ค้างจากรอบ 37 (ตอนปิดเรื่อง
// js/orders-tab.js ถาวร) — พบว่าฟังก์ชัน CRUD ทั้งหมด (listenLeads/getLeads/updateLeadStatus/
// updateLeadNotes/updateLeadAssignee/deleteLead/listenOrders/getOrders/addOrder/updateOrder/
// deleteOrder/upsertOrderTracking/removeOrderTracking/trackOrderStatus) เรียก Firestore ตรงๆ
// ทุกฟังก์ชัน ไม่มีจุดตัดแบบเดียวกับรอบ 32 เหลืออีกแล้ว — เจอจุดเดียวที่ยังพอทำได้: เพิ่ม export
// ให้ normalizeOrderExtras() (pure function ที่ไม่เคย export มาก่อน) เพื่อเขียนเทสต์ตรงได้ — ไม่ได้
// ย้ายออกเป็นไฟล์ใหม่ (ดูเหตุผลที่คอมเมนต์หัวฟังก์ชันนั้นเอง) — sanitizeCodeForId()/last4Digits()
// (helper ของ buildTrackingId) ตรวจแล้วว่ายังคง local ไว้เหมือนเดิมได้ เพราะใช้แค่ภายใน
// buildTrackingId() เท่านั้น ไม่มีที่อื่นเรียกตรงๆ เลย — ไม่มีการเปลี่ยน logic ใดๆ ในรอบนี้เลย
// (เพิ่มแค่ keyword `export` 1 คำ)
//
// เหตุผลที่ยังต้อง import { db, auth } กลับจาก js/db.js: Firestore/Auth instance ต้องถูก
// initializeFirestore()/getAuth() แค่ครั้งเดียวต่อแอป (ทำใน js/db.js) ไฟล์นี้จึงใช้ instance
// เดียวกันแทนที่จะสร้างใหม่ซ้ำ — ไม่ใช่ circular import (js/db.js ไม่ import อะไรกลับจากไฟล์นี้)
// ===========================
import { collection, doc, getDocs, addDoc, updateDoc,
         deleteDoc, orderBy, query, where, getDoc, setDoc, onSnapshot,
         serverTimestamp, deleteField }              from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { signInWithCustomToken }                     from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { db, auth } from "./db.js";
// P0.3: แจ้งเตือนลูกค้าอัตโนมัติทางอีเมลเมื่อ status เปลี่ยน — import แยกจาก sendLeadEmails()
// (คนละฟังก์ชัน คนละเทมเพลต) แต่อยู่ไฟล์เดียวกัน (js/email-notify.js) ตามที่ต่อยอดจากของเดิม
import { sendOrderStatusEmail, sendReviewRequestEmail } from "./email-notify.js";
import { sendOrderStatusLine } from "./line-notify.js";

// ===========================
// LEADS — คำขอใบเสนอราคา / ติดต่อจากลูกค้า (อ่าน/จัดการฝั่งแอดมิน)
// บันทึก (create) ทำผ่าน js/leads.js แยกต่างหาก เพราะใช้ได้แม้ยังไม่ login
// ===========================
export function listenLeads(callback, onError) {
  const q = query(collection(db, "leads"), orderBy("createdAt", "desc"));
  return onSnapshot(
    q,
    snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    err => { if (onError) onError(err); else console.error("listenLeads error:", err); }
  );
}

export async function getLeads() {
  const q = query(collection(db, "leads"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// rule ฝั่ง Firestore อนุญาตให้ update ได้แค่ field "status"/"notes" เท่านั้น
// หมายเหตุ: เดิมฟังก์ชันนี้อัปเดตแค่ status เฉยๆ ไม่มีการบันทึกว่า "เปลี่ยนสถานะเมื่อไหร่"
// เลยทำให้คำนวณ "ระยะเวลาปิดการขาย (Lead → Won)" จาก timestamp จริงไม่ได้ — เพิ่ม
// statusUpdatedAt ไว้ทุกครั้งที่เปลี่ยนสถานะ และ wonAt เฉพาะตอนปิดการขายสำเร็จ
// (ใช้คำนวณ wonAt - createdAt = ระยะเวลาปิดการขายจริง) ลีดเก่าที่เคย won ไปแล้วก่อน
// อัปเดตนี้จะยังไม่มี wonAt ย้อนหลัง — ฟังก์ชันคำนวณเทรนด์ (computeLeadStats) จะข้าม
// ลีดที่ไม่มี wonAt ไปเอง ไม่ทำให้ค่าเฉลี่ยเพี้ยน
export async function updateLeadStatus(id, status) {
  const payload = { status, statusUpdatedAt: serverTimestamp() };
  if (status === "won") payload.wonAt = serverTimestamp();
  await updateDoc(doc(db, "leads", id), payload);
}

// บันทึกโน้ตของทีมขาย (เช่น คุยอะไรไปแล้ว นัดโทรกลับวันไหน ราคาที่เสนอ)
// เพิ่ม notesUpdatedAt (เหมือน statusUpdatedAt ของ updateLeadStatus ด้านบน) เพื่อให้
// ตัวเช็ค "ลีดไม่มีการอัปเดตโน้ต/สถานะเกิน N วัน" (js/admin-leads.js, getStaleLeadReminders())
// รู้เวลาที่มีการแตะลีดล่าสุดจริง ไม่ใช่แค่เวลาสร้าง — ลีดเก่าที่เคยบันทึกโน้ตไปแล้วก่อนอัปเดตนี้
// จะยังไม่มี notesUpdatedAt ย้อนหลัง (getStaleLeadReminders จะ fallback ไปใช้ statusUpdatedAt/
// createdAt แทนในกรณีนั้น)
export async function updateLeadNotes(id, notes) {
  await updateDoc(doc(db, "leads", id), { notes, notesUpdatedAt: serverTimestamp() });
}

// กำหนด/เปลี่ยนผู้รับผิดชอบลีด (ชื่อพนักงานจาก settings.teamMembers) — ส่ง "" เพื่อเอาผู้รับผิดชอบออก
export async function updateLeadAssignee(id, assignee) {
  await updateDoc(doc(db, "leads", id), { assignee: assignee || "" });
}

export async function deleteLead(id) {
  await deleteDoc(doc(db, "leads", id));
}

// ===========================
// ORDERS — คำสั่งผลิต (Production Console)
// ===========================
// Schema (collection "orders"):
// {
//   code:       string   "PO-2026-0118"        เลขที่คำสั่งผลิต
//   customer:   string   "EGAT"                ลูกค้า/หน่วยงาน
//   phone:      string   "0891234567"          เบอร์โทรลูกค้า (ไม่บังคับ) — ใช้เป็นรหัสยืนยันตัวตน
//                                               ตอนลูกค้าเช็คสถานะเองผ่านป๊อปอัพ (js/track-modal.js, ไม่ต้อง login)
//   item:       string   "ป้ายเตือนไฟฟ้าแรงสูง"   ชื่อสินค้า/ป้าย
//   category:   string   "ป้ายเตือนอันตราย"      หมวดป้าย (optional)
//   qty:        number   20                    จำนวน
//   status:     "received" | "design" | "approval" | "production" | "qc" |
//               "packing" | "shipping" | "completed" | "cancelled"
//   progress:   number   0-100                 % งานเสร็จ
//   dueDate:    string   "2026-07-05"          กำหนดส่ง (YYYY-MM-DD)
//   notes:      string
//   createdAt:  serverTimestamp
//   updatedAt:  serverTimestamp
//   shippedAt:  serverTimestamp | null         เซ็ตอัตโนมัติเมื่อ status = "shipping" (ออกเดินทาง)
//   completedAt:serverTimestamp | null         เซ็ตอัตโนมัติเมื่อ status = "completed" (ใช้คิด lead time)
//   createdBy:  string | null                  uid ของ admin ที่สร้าง
//   trackingId: string | null                  = buildTrackingId(code, phone) — ผูกกับ doc คู่กันใน
//                                               collection "order_tracking" (ดูด้านล่าง) — ใช้เฉพาะระบบ
//                                               "เช็คสถานะเอง" ของลูกค้า ไม่ใช่เลขพัสดุขนส่ง (ดู shippingTrackingId)
//
//   // ── Traceability (2026 phase 1) ──
//   attachments: [{ url, type, label, uploadedAt, uploadedBy }]  ไฟล์แนบ (แบบร่าง/รูปหน้างาน/ใบเสร็จ ฯลฯ)
//                                               อัปโหลดผ่าน uploadImage()/uploadFile() (ดูด้านบน)
//                                               ประวัติแก้ไข (audit trail) ไม่ได้เก็บใน order เอง แต่ดึงจาก
//                                               listAuditLog() แล้วกรองด้วย targetId === order.id แทน
//
//   // ── การเงิน ──
//   deposit:       number                      ยอดมัดจำที่รับแล้ว (บาท)
//   paymentStatus: "unpaid" | "deposit_paid" | "paid_full"
//   discount:      number                      ส่วนลด (บาท) หักจากยอดรวมก่อนคิด VAT
//   vatIncluded:   boolean                     true = unit_price รวม VAT แล้ว, false = ต้องบวก VAT 7% เพิ่ม
//   invoiceAddress: string                     ที่อยู่ออกใบกำกับภาษี (ไม่บังคับ)
//   → ใช้ orderGrandTotal(order)/orderBalance(order) ด้านล่างคำนวณยอดรวม/ยอดคงเหลือ อย่าคำนวณเองซ้ำที่อื่น
//
//   // ── โลจิสติกส์ ──
//   shippingAddress:  string                   ที่อยู่จัดส่ง
//   recipient:        string                   ชื่อผู้รับปลายทาง (อาจไม่ใช่คนเดียวกับ customer)
//   shippingMethod:   "pickup" | "self_delivery" | "courier"
//   shippingCost:     number                   ค่าขนส่ง (บาท) — รวมเข้า orderGrandTotal() ด้วย
//   shippingTrackingId: string                 เลขพัสดุของขนส่งจริง (เช่น Kerry/Flash) — คนละตัวกับ
//                                               trackingId ด้านบน ถูกคัดลอกเข้า order_tracking (public)
//                                               ด้วยเพื่อให้ลูกค้าเห็นตอนเช็คสถานะเอง
//
//   // ── การผลิตเชิงลึก ──
//   assignee:      string | null               uid ของพนักงานที่รับผิดชอบงานนี้ (ผูกกับ listStaff())
//   assigneeName:  string                      cache ชื่อ/อีเมลพนักงาน ณ ตอนมอบหมาย (กันชื่อหายถ้า staff
//                                               ถูกลบทีหลัง) — อัปเดตซ้ำได้ทุกครั้งที่เปลี่ยน assignee
//   specs:         { size, material, color, finish }  สเปกงานแยกจาก item (ชื่อ/รายการ) ที่เป็น free text
//   qcChecklist:   [{ label, checked }]         รายการตรวจสอบคุณภาพ (แทนที่ compliant boolean เดิม —
//                                               ตัดฟิลด์ compliant/มอก./ISO ออกจาก scope นี้ทั้งหมดแล้ว)
// }
//
// Schema (collection "order_tracking") — สำเนา "เฉพาะข้อมูลที่ปลอดภัยให้คนนอกเห็น" ของ order
// แต่ละ doc, id = trackingId (ดู buildTrackingId ด้านล่าง) เพื่อให้ "เดา id ไม่ได้" ถ้าไม่รู้ทั้งเลข
// PO และเบอร์โทรจริง — Firestore rule เปิด "get" แบบ public แต่ปิด "list" ทั้ง collection ไว้
// (กันไม่ให้ไล่ดูคำสั่งผลิตของลูกค้ารายอื่น) ไม่มี field ชื่อลูกค้า/หมายเหตุ/เบอร์โทรอยู่ใน doc นี้เลย
// { code, item, category, qty, status, progress, dueDate, updatedAt, shippingMethod, shippingTrackingId, designFiles }
// status ใช้ค่าเดียวกับ collection "orders" ด้านบน (received/design/approval/production/qc/packing/shipping/completed/cancelled)
// designFiles (เพิ่มใน P0.2): ไฟล์ดีไซน์ที่แอดมินคัดมาให้ลูกค้าดูได้ผ่านหน้าอนุมัติแบบ — ดูหมายเหตุ
// เต็มที่ normalizeOrderExtras()/upsertOrderTracking() ด้านล่าง
//
// ทำแบบนี้แทนการเปิด "orders" ให้อ่านแบบ public เพราะ Firestore rules คุมได้แค่ระดับทั้ง document
// (จะซ่อนแค่บาง field ไม่ได้) และหลีกเลี่ยงการเพิ่ม Cloud Function (ต้องใช้ Blaze plan ซึ่งโปรเจกต์นี้
// ตั้งใจเลี่ยงไว้ — ดูหมายเหตุใน functions/index.js เรื่อง verifyTurnstile) จึงใช้ Firestore
// security rules ล้วน ๆ ยังอยู่ใน Spark plan (ฟรี) ได้เหมือนเดิม

// Workflow การผลิต 8 ขั้นตอนหลัก + "ยกเลิก" เป็นสถานะพิเศษที่ออกจาก flow ได้จากทุกขั้นตอน
export const ORDER_STATUS = {
  received:   { label: "รับงาน",              css: "received" },
  design:     { label: "ออกแบบ",              css: "design" },
  approval:   { label: "รออนุมัติแบบ",         css: "approval" },
  production: { label: "กำลังผลิต",            css: "production" },
  qc:         { label: "ตรวจสอบคุณภาพ (QC)",   css: "qc" },
  packing:    { label: "แพ็กสินค้า",           css: "packing" },
  shipping:   { label: "จัดส่ง",               css: "shipping" },
  completed:  { label: "เสร็จสิ้น",            css: "ok" },
  cancelled:  { label: "ยกเลิก",               css: "cancel" }
};

// ลำดับ flow หลัก (ไม่รวม "cancelled") — ใช้จัดคอลัมน์ kanban และ stage tracker ของป๊อปอัพเช็คสถานะ (js/track-modal.js)
export const ORDER_STATUS_FLOW = [
  "received", "design", "approval", "production", "qc", "packing", "shipping", "completed"
];

// กลุ่มสถานะสำหรับแท็บ "คำสั่งผลิต" (งานที่ยังไม่ถึงขั้นจัดส่ง) และแท็บ "การจัดส่ง" ในหน้า console
export const PRODUCTION_TAB_STATUSES = ["received", "design", "approval", "production", "qc", "packing"];
export const SHIPPING_TAB_STATUSES   = ["shipping", "completed", "cancelled"];

// สถานะการชำระเงิน — ใช้ทั้งใน dropdown ของฟอร์มและ badge สีในป๊อปอัพ (หมวด "การเงิน")
export const PAYMENT_STATUS = {
  unpaid:        { label: "ยังไม่ชำระ",      css: "unpaid" },
  deposit_paid:  { label: "มัดจำแล้ว",       css: "deposit" },
  paid_full:     { label: "ชำระครบแล้ว",     css: "paid" }
};

// ช่องทางจัดส่ง — ใช้ทั้งใน dropdown ของฟอร์มและ badge ในหมวด "การจัดส่ง"
export const SHIPPING_METHOD = {
  pickup:        { label: "ลูกค้ามารับเอง",           css: "pickup" },
  self_delivery: { label: "ส่งเองโดยทีมงาน",          css: "self" },
  courier:       { label: "ขนส่งเอกชน (Kerry/Flash ฯลฯ)", css: "courier" }
};

// Realtime listener — ใช้ทั้งใน hero console และ console.html
// callback(orders[]) จะถูกเรียกทุกครั้งที่ข้อมูลเปลี่ยน
// return: unsubscribe function
export function listenOrders(callback, onError) {
  const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
  return onSnapshot(
    q,
    snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    err => { if (onError) onError(err); else console.error("listenOrders error:", err); }
  );
}

export async function getOrders() {
  const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// รวม field ที่ไม่ได้บังคับ (ใหม่ทั้งหมดในเฟส 2026 phase 1) ไว้ที่เดียว ให้ addOrder()/updateOrder()
// เรียกใช้ร่วมกันได้ กันพิมพ์ตกหล่นระหว่างสองฟังก์ชัน
//
// 2026 refactor รอบที่ 38: ฟังก์ชันนี้เป็น pure function ล้วนๆ (รับ order object ธรรมดา คืนค่า
// object ที่ sanitize/default แล้ว ไม่แตะ Firestore เลย) — เดิมเป็น local function ไม่ได้ export
// เลย เพิ่ม export ให้เพื่อเขียนเทสต์ตรงได้ (เหมือนที่ทำกับ buildTrackingId ไปแล้วตั้งแต่รอบ 32) —
// **ไม่ย้ายออกเป็นไฟล์ใหม่** ต่างจาก daysUntilDue/orderUrgency/computeOrderStats/
// computeLeadStats (รอบ 32 → db-orders-stats.js) เพราะฟังก์ชันนี้มีจุดเรียกใช้แค่จุดเดียวคือใน
// addOrder() ในไฟล์นี้เอง (updateOrder() ไม่ได้เรียก — อัปเดตแบบ merge patch โดยตรงแทน) ย้ายออก
// จะเพิ่ม import/circular ไม่จำเป็นโดยไม่ได้ประโยชน์ด้าน readability เลย (ต่างจาก buildTrackingId
// ที่ยังคงอยู่ไฟล์เดิมด้วยเหตุผลคล้ายกัน — ดูคอมเมนต์ท้ายไฟล์ test/db-pure-functions.test.mjs)
export function normalizeOrderExtras(order) {
  return {
    attachments:  Array.isArray(order.attachments) ? order.attachments : [],
    // P0.2 (Design Proof Approval) — คนละกลุ่มกับ attachments ทั่วไปด้านบนตั้งใจ: attachments
    // อาจมีไฟล์ที่ไม่ควรให้ลูกค้าเห็น (เช่น ใบเสนอราคาภายใน รูปหน้างานที่ยังไม่พร้อมโชว์)
    // designFiles คือไฟล์ที่แอดมิน "คัดมาแล้ว" ว่าให้ลูกค้าดูได้ผ่านหน้าอนุมัติแบบ (public) —
    // ถูกคัดลอกเข้า order_tracking (public copy) ด้วย ต่างจาก attachments ที่ไม่เคยถูกคัดลอกออกไป
    // { url, label, uploadedAt } — ไม่มี uploadedBy (ไม่ใช่ข้อมูลที่ควรโชว์ public)
    designFiles:  Array.isArray(order.designFiles)
      ? order.designFiles.map(f => ({ url: String(f.url || ""), label: String(f.label || ""), uploadedAt: f.uploadedAt || "" }))
      : [],
    deposit:      Number(order.deposit) || 0,
    paymentStatus: ["unpaid", "deposit_paid", "paid_full"].includes(order.paymentStatus) ? order.paymentStatus : "unpaid",
    discount:     Number(order.discount) || 0,
    vatIncluded:  !!order.vatIncluded,
    invoiceAddress: order.invoiceAddress || "",
    shippingAddress: order.shippingAddress || "",
    recipient:    order.recipient || "",
    shippingMethod: ["pickup", "self_delivery", "courier"].includes(order.shippingMethod) ? order.shippingMethod : "pickup",
    shippingCost: Number(order.shippingCost) || 0,
    shippingTrackingId: order.shippingTrackingId || "",
    assignee:     order.assignee || "",
    assigneeName: order.assigneeName || "",
    specs: {
      size:     (order.specs && order.specs.size) || "",
      material: (order.specs && order.specs.material) || "",
      color:    (order.specs && order.specs.color) || "",
      finish:   (order.specs && order.specs.finish) || ""
    },
    qcChecklist: Array.isArray(order.qcChecklist)
      ? order.qcChecklist.map(q => ({ label: String(q.label || ""), checked: !!q.checked }))
      : []
  };
}

export async function addOrder(order) {
  const payload = {
    code:       order.code || "",
    customer:   order.customer || "",
    phone:      order.phone || "",
    // P0.3: อีเมลลูกค้า (ไม่บังคับ — ต่างจาก phone ตรงที่ phone ใช้คู่กับ code สร้าง trackingId
    // ด้วย ส่วน email ใช้แค่เป็นปลายทางส่งอีเมลแจ้งเตือนอัตโนมัติเมื่อ status เปลี่ยน (ดู
    // js/email-notify.js sendOrderStatusEmail() + จุดเรียกใน updateOrder() ด้านล่าง) ไม่ผูกกับ
    // trackingId/order_tracking (ไม่คัดลอกเข้า public copy เพื่อความเป็นส่วนตัว)
    email:      order.email || "",
    // P1.4: LINE user ID ของลูกค้า (ไม่บังคับ — ต่างจาก email ตรงที่ใช้เป็นปลายทางส่ง
    // push message ผ่าน LINE Messaging API แทน/ควบคู่กับอีเมล ดู js/line-notify.js
    // sendOrderStatusLine() + จุดเรียกใน updateOrder() ด้านล่าง) ไม่ผูกกับ trackingId/
    // order_tracking เหมือนกัน (ไม่คัดลอกเข้า public copy เพื่อความเป็นส่วนตัว)
    lineUserId: order.lineUserId || "",
    item:       order.item || "",
    category:   order.category || "",
    product_id: order.product_id || "",
    // 2026-08: cp-o-product ในฟอร์มแอดมิน (js/orders-tab-modal.js) เปลี่ยนเป็น select multiple
    // (เลือกสินค้าได้หลายรายการ) แล้ว — product_id ยังคงเก็บแค่ตัวแรกไว้ backward-compat ส่วนนี้คือ
    // array เต็มของทุกรายการที่เลือก (กรองให้เหลือแต่ string ไม่ว่างเท่านั้น กัน field แปลกปลอม)
    product_ids: Array.isArray(order.product_ids)
      ? order.product_ids.filter(id => typeof id === "string" && id).slice(0, 50)
      : [],
    unit_price: Number(order.unit_price) || 0,
    qty:        Number(order.qty) || 1,
    status:     order.status || "received",
    progress:   Math.max(0, Math.min(100, Number(order.progress) || 0)),
    dueDate:    order.dueDate || "",
    notes:      order.notes || "",
    createdAt:  serverTimestamp(),
    updatedAt:  serverTimestamp(),
    shippedAt:  null,
    completedAt: null,
    createdBy:  auth.currentUser ? auth.currentUser.uid : null,
    trackingId: buildTrackingId(order.code, order.phone),
    ...normalizeOrderExtras(order)
  };
  await addDoc(collection(db, "orders"), payload);
  if (payload.trackingId) await upsertOrderTracking(payload);
}

// field ที่ firestore.rules อนุญาตให้มีอยู่ใน "orders/{id}" หลัง update เสมอ (ต้องตรงกับ
// hasOnly([...]) ของ allow update ใน firestore.rules เป๊ะ) — ใช้เป็นรายการอ้างอิงกลางให้
// updateOrder() เก็บกวาด field แปลกปลอมที่ค้างอยู่ในเอกสารเดิมทิ้งอัตโนมัติแบบทั่วไป (เดิมทำแบบ
// hardcode เฉพาะ field 'compliant' ตัวเดียว — ดูคอมเมนต์เดิมด้านล่างที่อธิบายกลไก hasOnly()
// ประเมินจาก "เอกสารทั้งใบหลัง merge" — ตอนนี้ครอบคลุมทุก field แปลกปลอม ไม่ใช่แค่ตัวที่รู้จัก
// ล่วงหน้าเท่านั้น เผื่อมี field เก่าอื่นอีกจากสคีมารุ่นก่อนๆ ที่ยังไม่เจอ)
const ORDER_ALLOWED_FIELDS = new Set([
  "code", "customer", "phone", "email", "lineUserId", "item", "category", "product_id", "product_ids",
  "unit_price", "qty", "status", "progress",
  "dueDate", "notes", "createdAt", "updatedAt", "shippedAt", "completedAt", "createdBy", "trackingId",
  "attachments", "designFiles",
  "deposit", "paymentStatus", "discount", "vatIncluded", "invoiceAddress",
  "shippingAddress", "recipient", "shippingMethod", "shippingCost", "shippingTrackingId",
  "assignee", "assigneeName", "specs", "qcChecklist", "reviewRequestedAt"
]);

export async function updateOrder(id, patch) {
  const ref = doc(db, "orders", id);
  const existingSnap = await getDoc(ref);
  const existing = existingSnap.exists() ? existingSnap.data() : {};
  const merged = { ...existing, ...patch };

  const payload = { ...patch, updatedAt: serverTimestamp() };
  // เอกสารเก่าบางใบยังมี field 'compliant' ค้างอยู่จริงใน Firestore (จากก่อนตัด field
  // นี้ออกจาก schema) — Firestore rules ประเมิน hasOnly() จาก "เอกสารทั้งใบหลัง merge"
  // ไม่ใช่แค่ field ที่ส่งมาใหม่ ทำให้ถึงแม้ฟอร์มจะไม่แตะ field นี้เลย แต่พอมันยังค้างอยู่ใน
  // เอกสารเดิม ก็ทำให้ hasOnly() มองว่ามี field แปลกปลอมและปฏิเสธการ update ทุกครั้ง (permission-denied)
  // แก้โดยสั่งลบ field นี้ทิ้งไปด้วยเสมอในทุกการ update — ปลอดภัยแม้เอกสารจะไม่มี field นี้อยู่แล้ว
  // (deleteField() บน field ที่ไม่มีอยู่ ไม่ error) เป็นการ "เก็บกวาด" ของเก่าไปในตัวโดยอัตโนมัติ
  payload.compliant = deleteField();
  // ครอบคลุมเพิ่มเติม: field แปลกปลอมอื่นๆ ที่อาจค้างอยู่ในเอกสารเดิมจากสคีมารุ่นก่อนหน้าที่ไม่ใช่
  // 'compliant' (กลไกเดียวกันกับด้านบน แต่ทั่วไปกว่า — ไล่เทียบทุก key ของเอกสารเดิมกับ
  // ORDER_ALLOWED_FIELDS แทนที่จะรู้ชื่อ field ล่วงหน้า) กันบั๊ก permission-denied แบบเดียวกันนี้
  // เกิดซ้ำจาก field เก่าตัวอื่นที่ยังไม่เจอ
  for (const key of Object.keys(existing)) {
    if (!ORDER_ALLOWED_FIELDS.has(key)) payload[key] = deleteField();
  }
  if ("qty" in payload)      payload.qty = Number(payload.qty) || 1;
  if ("unit_price" in payload) payload.unit_price = Number(payload.unit_price) || 0;
  if ("progress" in payload) payload.progress = Math.max(0, Math.min(100, Number(payload.progress) || 0));
  if ("deposit" in payload)      payload.deposit = Number(payload.deposit) || 0;
  if ("discount" in payload)     payload.discount = Number(payload.discount) || 0;
  if ("shippingCost" in payload) payload.shippingCost = Number(payload.shippingCost) || 0;
  if (patch.status === "shipping") {
    payload.shippedAt = serverTimestamp();
  }
  if (patch.status === "completed") {
    payload.progress = 100;
    payload.completedAt = serverTimestamp();
  }

  const oldTrackingId = existing.trackingId || null;
  const newTrackingId = buildTrackingId(merged.code, merged.phone);
  payload.trackingId = newTrackingId;

  await updateDoc(ref, payload);

  if (newTrackingId !== oldTrackingId) await removeOrderTracking(oldTrackingId);
  if (newTrackingId) {
    await upsertOrderTracking({
      ...merged,
      progress: "progress" in payload ? payload.progress : merged.progress
    });
  }

  // P0.3: แจ้งเตือนลูกค้าอัตโนมัติเมื่อ status เปลี่ยนจริง (ไม่ใช่แค่แก้ field อื่นแล้ว submit
  // ทั้งฟอร์ม) — sendOrderStatusEmail() เองไม่ throw อยู่แล้ว (ดู js/email-notify.js) แต่ยัง
  // wrap try/catch ตรงนี้ซ้ำอีกชั้นตามกฎกันโค้ดพังของโปรเจกต์ (แยก error ของ integration ใหม่
  // ออกจาก flow เปลี่ยนสถานะเดิมเสมอ ไม่ว่าจะมั่นใจแค่ไหนว่าฟังก์ชันปลายทางไม่ throw) — เรียก
  // หลัง updateDoc()/upsertOrderTracking() สำเร็จแล้วเท่านั้น ไม่ block การเปลี่ยนสถานะเอง
  if ("status" in patch) {
    try {
      await sendOrderStatusEmail(merged, existing.status, patch.status);
    } catch (err) {
      console.error("updateOrder: sendOrderStatusEmail error (ไม่กระทบการเปลี่ยนสถานะ):", err);
    }
    // P1.4: เช่นเดียวกับอีเมลด้านบน — sendOrderStatusLine() เองไม่ throw อยู่แล้ว (ดู
    // js/line-notify.js) แต่ wrap try/catch ซ้ำอีกชั้นตามกฎกันโค้ดพังเดียวกัน (แยก error ของ
    // แต่ละ integration ออกจากกันด้วย ไม่ใช่แค่แยกจาก flow เปลี่ยนสถานะ — ถ้าอีเมลพังไม่ควรทำให้
    // LINE ไม่ถูกเรียกตามไปด้วย)
    try {
      await sendOrderStatusLine(merged, existing.status, patch.status);
    } catch (err) {
      console.error("updateOrder: sendOrderStatusLine error (ไม่กระทบการเปลี่ยนสถานะ):", err);
    }
    // P2.9: ขอรีวิวลูกค้าอัตโนมัติหลังงานเสร็จ — sendReviewRequestEmail() เองไม่ throw อยู่แล้ว
    // (ดู js/email-notify.js) แต่ wrap try/catch ซ้ำอีกชั้นตามกฎกันโค้ดพังเดียวกัน แยก error
    // ของ integration นี้ออกจาก sendOrderStatusEmail()/sendOrderStatusLine() ด้านบนด้วย (ถ้า
    // อีเมลแจ้งสถานะพัง ไม่ควรทำให้อีเมลขอรีวิวไม่ถูกเรียกตามไปด้วย และในทางกลับกัน)
    try {
      const reviewEmailSent = await sendReviewRequestEmail(merged, existing.status, patch.status);
      // P2.9a2: บันทึก reviewRequestedAt ลง Firestore เฉพาะตอนที่ยิงอีเมลสำเร็จจริงเท่านั้น
      // (additive field ใหม่ — ไม่กระทบ schema เดิม) เพื่อกันส่งซ้ำถาวรแม้สถานะจะออกจาก
      // completed แล้วกลับเข้ามาใหม่ในอนาคต — เป็น updateDoc() แยกต่างหากจากก้อนหลักด้านบน
      // (ตั้งใจไม่รวมเข้า payload เดิม เพราะ payload เดิมถูกส่งไปแล้วก่อนจะรู้ผลของอีเมลนี้)
      if (reviewEmailSent) {
        try {
          await updateDoc(ref, { reviewRequestedAt: serverTimestamp() });
        } catch (err) {
          console.error("updateOrder: บันทึก reviewRequestedAt ล้มเหลว (ไม่กระทบการเปลี่ยนสถานะ):", err);
        }
      }
    } catch (err) {
      console.error("updateOrder: sendReviewRequestEmail error (ไม่กระทบการเปลี่ยนสถานะ):", err);
    }
  }
}

export async function deleteOrder(id) {
  const ref = doc(db, "orders", id);
  const snap = await getDoc(ref);
  const trackingId = snap.exists() ? (snap.data().trackingId || null) : null;
  await deleteDoc(ref);
  if (trackingId) await removeOrderTracking(trackingId);
}

// ===========================
// ORDER TRACKING (public, ไม่ต้อง login) — ใช้โดยป๊อปอัพเช็คสถานะคำสั่งผลิต (js/track-modal.js)
// ===========================
// รหัสยืนยัน = เลข PO + เบอร์โทร 4 หลักสุดท้าย รวมกันเป็น doc id เดียว ทำให้ "เดา id ไม่ได้"
// ถ้าไม่รู้ทั้งสองอย่าง (คล้ายระบบเช็คสถานะพัสดุที่ต้องใช้เลขพัสดุ + รหัสไปรษณีย์)
function sanitizeCodeForId(code) {
  return String(code || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}
function last4Digits(phone) {
  return String(phone || "").replace(/\D/g, "").slice(-4);
}
export function buildTrackingId(code, phone) {
  const c = sanitizeCodeForId(code);
  const p = last4Digits(phone);
  if (!c || p.length < 4) return null;
  return `${c}_${p}`;
}

async function upsertOrderTracking(order) {
  const trackingId = buildTrackingId(order.code, order.phone);
  if (!trackingId) return;
  await setDoc(doc(db, "order_tracking", trackingId), {
    code:       order.code || "",
    item:       order.item || "",
    category:   order.category || "",
    qty:        Number(order.qty) || 1,
    status:     order.status || "received",
    progress:   Math.max(0, Math.min(100, Number(order.progress) || 0)),
    dueDate:    order.dueDate || "",
    updatedAt:  serverTimestamp(),
    // P1.5 (LIFF auto-link) — คัดลอก "มีค่าหรือไม่" เข้ามาด้วย เพื่อให้หน้าเช็คสถานะ
    // (js/track-modal.js) โชว์ปุ่ม "เชื่อมบัญชี LINE" เฉพาะตอนยังไม่เชื่อมเท่านั้น — ไม่ได้
    // มีเหตุผลด้าน privacy ที่ต้องปิดบัง (เป็น field ภายในของลูกค้าคนนั้นเอง ไม่ใช่ข้อมูล
    // คนอื่น) จึงคัดลอกค่าจริงไปตรงๆ ได้เหมือน field อื่นๆ ในสำเนานี้
    lineUserId: order.lineUserId || "",
    // เลขพัสดุขนส่งจริง — คนละตัวกับ trackingId (id ของ doc นี้เอง ดู buildTrackingId ด้านบน)
    shippingMethod:      ["pickup", "self_delivery", "courier"].includes(order.shippingMethod) ? order.shippingMethod : "pickup",
    shippingTrackingId:  order.shippingTrackingId || "",
    // P0.2 (Design Proof Approval) — คัดลอกเฉพาะ designFiles (ไฟล์ที่แอดมินเลือกให้ลูกค้าดูได้แล้ว)
    // เข้ามาที่สำเนา public นี้ด้วย ไม่ใช่ attachments ทั้งก้อน (ดูเหตุผลที่ normalizeOrderExtras()
    // ด้านบนของไฟล์นี้) — ใช้โดยหน้าอนุมัติแบบ (public) แสดงไฟล์ดีไซน์ให้ลูกค้าดูก่อนกดอนุมัติ/ขอแก้
    designFiles: Array.isArray(order.designFiles)
      ? order.designFiles.map(f => ({ url: String(f.url || ""), label: String(f.label || ""), uploadedAt: f.uploadedAt || "" }))
      : []
  });
}

async function removeOrderTracking(trackingId) {
  if (!trackingId) return;
  try {
    await deleteDoc(doc(db, "order_tracking", trackingId));
  } catch (err) {
    console.warn("removeOrderTracking: ลบ order_tracking เดิมไม่สำเร็จ", trackingId, err);
  }
}

// ใช้โดยป๊อปอัพเช็คสถานะคำสั่งผลิต (js/track-modal.js) — ลูกค้ากรอกเลขที่ PO + เบอร์โทร (ไม่ต้อง login)
// คืนค่า null ถ้าไม่พบ (เลข PO/เบอร์โทรไม่ตรงกัน หรือยังไม่เคยกรอกเบอร์โทรไว้ในคำสั่งผลิตนี้)
export async function trackOrderStatus(code, phone) {
  const trackingId = buildTrackingId(code, phone);
  if (!trackingId) return null;
  const snap = await getDoc(doc(db, "order_tracking", trackingId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

// ===========================
// LINE ACCOUNT AUTO-LINK (P1.5, public — ไม่ต้อง Firebase login ก่อนเรียก)
// ===========================
// ต้องตรงกับ Worker URL เดียวกับ NOTIFY_LINE_URL ใน js/line-notify.js (คนละ path)
const LINK_LINE_URL = "https://cssign-cloudinary-delete.zillergotspw.workers.dev/link-line";

// เรียกจากปุ่ม "เชื่อมบัญชี LINE" ใน js/track-modal.js หลัง liff.login()/liff.getIDToken()
// สำเร็จแล้ว (ดู track-modal.js สำหรับส่วน UI/LIFF SDK — ไฟล์นี้ไม่รู้จัก liff object เลย
// รับแค่ idToken ที่ดึงมาแล้วเป็น string ธรรมดา)
//
// Flow: ส่ง idToken (LIFF) + code + phone ไป Worker /link-line ให้ verify ทั้งสองฝั่ง (LINE
// JWKS จริง + มี order ที่ trackingId ตรงกันจริงใน Firestore) แล้วเซ็น Firebase custom token
// ที่จำกัดสิทธิ์แคบมากกลับมา (แก้ได้แค่ field lineUserId ของ order เดียวที่ trackingId ตรงกัน
// เท่านั้น — ดู cloudflare-worker/src/index.js handleLinkLine() + firestore.rules) → เราแค่
// signInWithCustomToken() ด้วย token นั้น แล้ว updateDoc() ผ่าน SDK ปกติ ให้ firestore.rules
// เป็นคนบังคับสิทธิ์เหมือน write อื่นทุกจุดในระบบนี้ ("ไม่เชื่อ client เลย ให้ rules ตัดสิน")
//
// ไม่รับ/ไม่ใช้ lineUserId ที่ client อาจส่งมาเองเด็ดขาด — ใช้ค่าที่ Worker verify แล้วส่งกลับมา
// ในผลลัพธ์เท่านั้น (กันปลอมค่า lineUserId ของคนอื่นแล้วเอาไปยิงแจ้งเตือนผิดคน)
//
// @param {string} liffIdToken — จาก liff.getIDToken() (LIFF SDK, ฝั่ง client)
// @param {string} code        — เลขที่ PO ที่ลูกค้ากรอกในฟอร์ม track-modal
// @param {string} phone       — เบอร์โทรที่ลูกค้ากรอก (อย่างน้อย 4 หลักสุดท้าย)
// @returns {Promise<{lineUserId: string}>} — resolve เมื่อเชื่อมสำเร็จ
// @throws {Error & {code: string}} — code เป็นหนึ่งใน "missing_id_token" | "invalid_line_token"
//   | "order_not_found" | "invalid_response" | ข้อความ error อื่นจาก Worker (ดู
//   handleLinkLine()) — ให้ผู้เรียก (track-modal.js) จับไปแปลงเป็นข้อความไทยที่เหมาะสมเอง
export async function linkLineAccount(liffIdToken, code, phone) {
  if (!liffIdToken || typeof liffIdToken !== "string") {
    throw Object.assign(new Error("linkLineAccount: missing liffIdToken"), { code: "missing_id_token" });
  }

  const res = await fetch(LINK_LINE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken: liffIdToken, code, phone }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw Object.assign(new Error(data.error || `link-line failed (${res.status})`), { code: data.error || "link_line_failed" });
  }

  const { customToken, orderId, lineUserId } = data;
  if (!customToken || !orderId || !lineUserId) {
    throw Object.assign(new Error("link-line: invalid response from server"), { code: "invalid_response" });
  }

  await signInWithCustomToken(auth, customToken);
  await updateDoc(doc(db, "orders", orderId), { lineUserId });

  return { lineUserId };
}

// ===========================
// LINE CUSTOMER LOGIN (P2.8c-D, public — ไม่ต้อง Firebase login ก่อนเรียก)
// ===========================
// ต่างจาก linkLineAccount() ด้านบนตรงที่ endpoint นี้ (`/line-login`) ไม่ผูกกับ order เดียว
// เลย — ใช้ตอนลูกค้าเปิดหน้า "ออเดอร์ของฉัน" (P2.8c-E) โดยยังไม่รู้เลขที่ PO ใดๆ (ต่างจาก
// track-modal.js ที่ต้องกรอกเลข PO ก่อนถึงจะเชื่อมบัญชีได้) — Worker verify LINE ID token
// จริงแล้วเซ็น custom token claim แค่ `{ lineUserId }` (ไม่มี trackingId/orderId เลย ดู
// cloudflare-worker/src/index.js handleLineLogin()) — หลัง signInWithCustomToken() สำเร็จ
// ใช้ listenMyOrders(lineUserId) ด้านล่างกรองออเดอร์ของ uid นี้เอง (firestore.rules คุมสิทธิ์
// อ่านผ่าน request.auth.token.lineUserId เหมือนกับที่ order write ถูกคุมด้วย custom claim ใน
// linkLineAccount())
const LINE_LOGIN_URL = "https://cssign-cloudinary-delete.zillergotspw.workers.dev/line-login";

// เรียกจากหน้า "ออเดอร์ของฉัน" (P2.8c-E) หลัง liff.login()/liff.getIDToken() สำเร็จแล้ว —
// ไฟล์นี้ไม่รู้จัก liff object เอง รับแค่ idToken ที่ดึงมาแล้วเป็น string ธรรมดา (เหมือน
// linkLineAccount() ด้านบน)
//
// @param {string} liffIdToken — จาก liff.getIDToken() (LIFF SDK, ฝั่ง client)
// @returns {Promise<{lineUserId: string}>} — resolve เมื่อ login สำเร็จ (Firebase custom token
//   สำหรับ uid = `line_${lineUserId}` ถูก signInWithCustomToken() แล้ว)
// @throws {Error & {code: string}} — code เป็นหนึ่งใน "missing_id_token" | "invalid_line_token"
//   | "server_misconfigured" | "invalid_response" | ข้อความ error อื่นจาก Worker (ดู
//   handleLineLogin()) — ให้ผู้เรียกจับไปแปลงเป็นข้อความไทยที่เหมาะสมเอง
export async function loginWithLine(liffIdToken) {
  if (!liffIdToken || typeof liffIdToken !== "string") {
    throw Object.assign(new Error("loginWithLine: missing liffIdToken"), { code: "missing_id_token" });
  }

  const res = await fetch(LINE_LOGIN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken: liffIdToken }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw Object.assign(new Error(data.error || `line-login failed (${res.status})`), { code: data.error || "line_login_failed" });
  }

  const { customToken, lineUserId } = data;
  if (!customToken || !lineUserId) {
    throw Object.assign(new Error("line-login: invalid response from server"), { code: "invalid_response" });
  }

  await signInWithCustomToken(auth, customToken);

  return { lineUserId };
}

// มุมมองลูกค้า (ตรงข้ามกับ listenOrders() ด้านบนที่ดึง "ทั้ง collection" สำหรับ staff เท่านั้น) —
// realtime listener กรองด้วย lineUserId ตรงๆ ผ่าน Firestore query (ต้องมี composite index
// lineUserId ASC + createdAt DESC ตาม firestore.indexes.json ที่เพิ่มไว้แล้วในรอบ P2.8c-B)
// ใช้หลัง loginWithLine() สำเร็จเท่านั้น — ไม่ตรวจ auth.currentUser เองในฟังก์ชันนี้ (ปล่อยให้
// firestore.rules เป็นคนบังคับสิทธิ์อ่านเหมือนจุดอื่นๆ ในระบบนี้)
//
// @param {string} lineUserId — ค่าที่ loginWithLine() คืนมา (verify แล้วจาก Worker เท่านั้น —
//   ห้ามรับค่าที่พิมพ์เองจากที่อื่น เพราะจะเปิดช่องให้ดูออเดอร์ของคนอื่นได้ถ้า rules มีช่องโหว่)
// @returns {function} unsubscribe — เรียกตอนปิดหน้า/component unmount เหมือน listenOrders()
export function listenMyOrders(lineUserId, callback, onError) {
  if (!lineUserId) {
    const err = new Error("listenMyOrders: missing lineUserId");
    if (onError) onError(err); else console.error("listenMyOrders error:", err);
    return () => {};
  }
  const q = query(
    collection(db, "orders"),
    where("lineUserId", "==", lineUserId),
    orderBy("createdAt", "desc")
  );
  return onSnapshot(
    q,
    snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    err => { if (onError) onError(err); else console.error("listenMyOrders error:", err); }
  );
}

// ===========================
// DESIGN PROOF APPROVAL (P0.2, public — ไม่ต้อง login) — ลูกค้ากด "อนุมัติ"/"ขอแก้ไข" เอง
// จากหน้าอนุมัติแบบ ผูกกับ trackingId เดียวกับระบบเช็คสถานะ (js/track-modal.js) เพื่อยืนยันตัวตน
// ===========================
// Schema (collection "design_approvals") — append-only log, คล้าย "auditLog" (ดู js/db.js
// logAudit()/listAuditLog()) ต่างกันตรงที่ตัวนี้เขียนได้แบบ public (ไม่ต้อง login) เพราะเป็นลูกค้า
// เป็นคนกดเอง ไม่ใช่ทีมงาน — แต่ "อ่านได้" เฉพาะ admin login เท่านั้น (ดู firestore.rules)
// { trackingId, action: "approved" | "changes_requested", comment, createdAt }
//
// **สำคัญ**: ฟังก์ชันนี้ "ไม่" เปลี่ยน order.status ให้อัตโนมัติ (ตั้งใจ) — เพราะ collection
// "orders" ยังคง auth-only ทั้งหมดตามเดิม (ดู firestore.rules) การเปิดให้ public เขียน orders
// ตรงๆ เสี่ยงเกินไป (ควบคุม field ได้แต่ควบคุม "เนื้อหา" เชิงธุรกิจไม่ได้เท่า Cloud Function ซึ่ง
// โปรเจกต์นี้ตั้งใจเลี่ยงเพราะต้องใช้ Blaze plan — ดูหมายเหตุเดียวกันที่ js/leads.js เรื่อง
// verifyTurnstileToken) แอดมินยังต้องเป็นคนกด "เปลี่ยนสถานะ" เองในคอนโซลหลังเห็นการอนุมัติ/
// ขอแก้ไขใหม่ (แสดงผ่าน listDesignApprovals() ด้านล่าง เรียกจากแอดมิน) — เป็นการ "แจ้ง" ไม่ใช่ "สั่งการ"
const DESIGN_APPROVAL_ACTIONS = ["approved", "changes_requested"];

export async function submitDesignApproval(trackingId, action, comment = "") {
  if (!trackingId || typeof trackingId !== "string") {
    throw new Error("submitDesignApproval: ต้องระบุ trackingId");
  }
  if (!DESIGN_APPROVAL_ACTIONS.includes(action)) {
    throw new Error("submitDesignApproval: action ต้องเป็น \"approved\" หรือ \"changes_requested\" เท่านั้น");
  }
  const payload = {
    trackingId,
    action,
    comment: String(comment || "").slice(0, 2000),
    createdAt: serverTimestamp()
  };
  const ref = await addDoc(collection(db, "design_approvals"), payload);
  return ref.id;
}

// ใช้โดยแอดมิน (console.html) — ดูประวัติการอนุมัติ/ขอแก้ไขของคำสั่งผลิตหนึ่งใบ เรียงใหม่สุดก่อน
// รับ trackingId ตรงๆ (ไม่ใช่ order id ของ Firestore) เพราะ trackingId คือกุญแจที่ผูกกับ
// order_tracking (public) อยู่แล้ว — ถ้า order ไม่มี trackingId (ไม่เคยกรอกเบอร์โทร) จะไม่มี
// ประวัติเลย คืน [] เปล่าๆ ไปตรงๆ ไม่ต้อง query
export async function listDesignApprovals(trackingId) {
  if (!trackingId) return [];
  const q = query(collection(db, "design_approvals"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(a => a.trackingId === trackingId);
}
