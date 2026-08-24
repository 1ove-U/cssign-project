// ===========================
// js/reorder-helper.js — P2.8a (Portal ลูกค้าประจำ, ซับข้อแรก): data layer สำหรับ "สั่งซ้ำ"
// ===========================
// บริบท: P2.8 เดิมในแผน (cssign-roadmap-prompt.md) คือ "Portal ลูกค้าประจำ (login ดูประวัติ/
// สั่งซ้ำ)" — ระบบ login ลูกค้าเต็มรูปแบบเป็นงานใหญ่และมีความเสี่ยงด้าน security สูง (ดูคำเตือน
// ใน firestore.rules หัวข้อ isAuthenticated() ว่าต้องทบทวนทุกจุดก่อนเปิด public signup ให้ลูกค้า)
// รอบนี้เลือกเริ่มจากส่วนที่ปลอดภัยและมีคุณค่าจริงก่อน: "สั่งซ้ำ" ไม่จำเป็นต้องรอระบบ login เต็มรูปแบบ
// เลย — ลูกค้าที่เพิ่งเช็คสถานะคำสั่งผลิตผ่าน track-modal (js/track-modal.js, ป้อนเลข PO + เบอร์โทร
// เหมือนเดิม ไม่ต้อง login) เห็นข้อมูลออเดอร์ตัวเองอยู่แล้ว — แค่ต้องมีปุ่ม "สั่งซ้ำ" ที่พาไปเปิดฟอร์ม
// ขอใบเสนอราคาเดิม (js/lead-quote-modal.js, window.openModal()) พร้อม prefill ข้อความอัตโนมัติ
// ตามแพทเทิร์นเดียวกับที่ js/chat-widget.js ใช้อยู่แล้ว (openModal('form', {source, message}))
//
// ไฟล์นี้เป็น pure function ล้วนๆ ไม่มีการเรียก Firestore/DOM ใดๆ เลย (แยกออกมาต่างหากเพื่อ
// เทสได้ตรงไปตรงมา ไม่ต้องพึ่ง jsdom) — รับ order object รูปแบบเดียวกับที่ trackOrderStatus()
// คืนกลับมา (ดู js/db-orders.js upsertOrderTracking() สำหรับ field ที่มีจริงใน order_tracking)
// แล้วคืนสตริงข้อความภาษาไทยพร้อมส่งเข้า opts.message ของ window.openModal()
//
// ยังไม่ได้ wire เข้า UI จุดไหนในรอบนี้ (ซับข้อถัดไป P2.8b ค่อยเพิ่มปุ่ม "สั่งซ้ำ" ใน
// js/track-modal.js เรียกใช้ฟังก์ชันนี้จริง)

/**
 * สร้างข้อความ prefill สำหรับฟอร์มขอใบเสนอราคา เมื่อลูกค้ากด "สั่งซ้ำ" จากออเดอร์เดิม
 * @param {Object} order - object รูปแบบเดียวกับที่ trackOrderStatus()/renderResult() ใช้
 *   ต้องมีอย่างน้อย field `item` (ชื่อสินค้า) ฟิลด์อื่น (`qty`, `code`, `category`) เป็น optional
 * @returns {string} ข้อความภาษาไทย พร้อมใช้เป็น opts.message ของ window.openModal('form', {message})
 *   คืนสตริงว่าง "" ถ้า order ไม่มีข้อมูลพอจะสร้างข้อความที่มีความหมาย (ไม่มี item เลย)
 */
export function buildReorderMessage(order) {
  if (!order || typeof order !== "object") return "";
  var item = typeof order.item === "string" ? order.item.trim() : "";
  if (!item) return "";

  var qty = Number(order.qty);
  var hasQty = Number.isFinite(qty) && qty > 0;
  var code = typeof order.code === "string" ? order.code.trim() : "";

  var msg = "ต้องการสั่งซ้ำ: " + item;
  if (hasQty) msg += " จำนวน " + qty;
  if (code) msg += " (อ้างอิงคำสั่งผลิตเดิม " + code + ")";

  return msg;
}

/**
 * ตัดสินใจว่าควรแสดงปุ่ม "สั่งซ้ำ" ให้ลูกค้าหรือไม่ — เฉพาะออเดอร์ที่เสร็จสมบูรณ์แล้วเท่านั้น
 * (`completed`) กันสับสนกับ "ขอแก้ไข"/"ยกเลิก" ของออเดอร์ที่ยังไม่จบ หรือออเดอร์ที่ถูกยกเลิกไป
 * @param {Object} order
 * @returns {boolean}
 */
export function shouldOfferReorder(order) {
  if (!order || typeof order !== "object") return false;
  return order.status === "completed" && !!buildReorderMessage(order);
}
