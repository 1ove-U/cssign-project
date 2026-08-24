/**
 * CS.SIGN — email-notify.js (Phase 3, เวอร์ชันฟรี)
 * ──────────────────────────────────────────────────────────────
 * ส่งอีเมล auto-reply ให้ลูกค้า + แจ้งเตือนทีมงาน ผ่าน EmailJS
 * ตรงจาก browser โดยไม่ต้องมี backend / Cloud Functions / บัตรเครดิต
 *
 * ฟรี 200 อีเมล/เดือน (1 lead ใช้ 2 อีเมล = ฟรีรองรับ ~100 lead/เดือน)
 * ถ้าโตเกินนี้ในอนาคต ดูทางเลือก Cloud Functions + SendGrid ใน PHASE3-README.md
 *
 * วิธี Setup แบบละเอียด: อ่าน PHASE3-README.md หัวข้อ "เวอร์ชันฟรี (EmailJS)"
 */

import emailjs from "https://cdn.jsdelivr.net/npm/@emailjs/browser@4/+esm";

/* ═══════════════════════════════════════════════════════════════
   ✅ ตั้งค่าด้วยบัญชี EmailJS จริงของ CS.SIGN แล้ว (ยืนยันแล้วว่าส่งอีเมล
   แจ้งเตือนได้จริง — 2569-07-21) ถ้าต้องเปลี่ยนบัญชี/เทมเพลตในอนาคต แก้ค่า
   4 ตัวด้านล่างตามขั้นตอนนี้:
   1. ล็อกอิน https://www.emailjs.com ด้วยอีเมลของบริษัท
   2. Email Services → ดู/แก้ Service ที่ผูกกับ Gmail/Outlook ของบริษัท
      → EMAILJS_SERVICE_ID (ขึ้นต้นด้วย "service_")
   3. Email Templates → เทมเพลต auto-reply ลูกค้า → EMAILJS_TEMPLATE_CUSTOMER
      และเทมเพลตแจ้งทีมงานภายใน → EMAILJS_TEMPLATE_INTERNAL
   4. Account → General → "Public Key" → EMAILJS_PUBLIC_KEY
   ─────────────────────────────────────────────────────────────── */
const EMAILJS_PUBLIC_KEY        = "qigR2h9JU2To7akwe";
const EMAILJS_SERVICE_ID        = "service_uim2dtt";
const EMAILJS_TEMPLATE_CUSTOMER = "template_fjct05k";
const EMAILJS_TEMPLATE_INTERNAL = "template_gw2wtgp";

/* ═══════════════════════════════════════════════════════════════
   P0.3 + P2.9 — เทมเพลตแจ้งเตือนลูกค้าแบบ "ทั่วไป" ใช้ร่วมกัน (shared) ทั้ง 2 เหตุการณ์:
   (1) P0.3 แจ้งเปลี่ยนสถานะคำสั่งผลิต (push แทน pull เดิม)
   (2) P2.9 ขอรีวิวลูกค้าหลังงานเสร็จ (ผูกกับ status "completed")

   ⚠️ ใช้เทมเพลตเดียวกัน "โดยตั้งใจ" (ไม่ใช่แยกคนละเทมเพลตแบบที่เคยวางแผนไว้ตอนแรก) เพราะบัญชี
   EmailJS ของ CS.SIGN เป็นแพ็กเกจฟรี (200 request/เดือน, จำกัด 2 เทมเพลต) และ 2 เทมเพลตนั้นถูก
   ใช้ไปแล้วกับฟอร์มขอใบเสนอราคา (EMAILJS_TEMPLATE_CUSTOMER/EMAILJS_TEMPLATE_INTERNAL ด้านบน) —
   ถ้าจะเพิ่มอีก 2 เทมเพลตแยกจะเกินโควตาฟรีทันที จึงออกแบบเทมเพลตนี้ให้ "เนื้อหาไดนามิก" แทน:
   โค้ดฝั่ง JS (sendOrderStatusEmail()/sendReviewRequestEmail() ด้านล่าง) จะประกอบหัวเรื่อง+เนื้อหา
   เต็มไว้ล่วงหน้าเป็น subject_text/message_text แล้วส่งให้เทมเพลตแค่ "แปะ" ตัวแปรเหล่านี้ ไม่ต้อง
   สร้างเทมเพลตแยกสำหรับแต่ละเหตุการณ์ — ยังไม่ได้สร้างเทมเพลตจริงใน EmailJS dashboard
   ต้องสร้างเทมเพลตใหม่ 1 อัน แล้วแทนค่า "YOUR_NOTIFY_TEMPLATE_ID" ด้านล่างก่อนใช้งานจริง
   (ระหว่างที่ยังไม่ตั้งค่า ทั้ง 2 ฟังก์ชันจะ warn + ข้ามการส่งเงียบๆ ไม่ throw)

   วิธีสร้างเทมเพลตใน EmailJS dashboard (Email Templates → Create New Template):
   - ช่อง "To Email" → ใส่ {{to_email}}
   - เนื้อหาเทมเพลตใส่แค่ 2 ตัวแปรพอ (เนื้อหาจริงมาจากโค้ด ไม่ต้องเขียนซ้ำในเทมเพลต):
       หัวเรื่อง (Subject): {{subject_text}}
       เนื้อหา (Content):   เรียน {{to_name}}
                            {{message_text}}
   ─────────────────────────────────────────────────────────────── */
const EMAILJS_TEMPLATE_NOTIFY = "YOUR_NOTIFY_TEMPLATE_ID";

// P1.4: export เพิ่มให้ js/line-notify.js ใช้ label เดียวกันได้ (ไม่ต้อง duplicate รายการ
// สถานะซ้ำ 2 ที่ — เดิม const นี้เป็น local ไม่ export เพราะมีจุดใช้แค่ในไฟล์นี้ไฟล์เดียว)
export const ORDER_STATUS_LABEL = {
  received:   "รับคำสั่งผลิตแล้ว",
  design:     "กำลังออกแบบ",
  approval:   "รออนุมัติแบบ",
  production: "กำลังผลิต",
  qc:         "ตรวจสอบคุณภาพ",
  packing:    "แพ็คสินค้า",
  shipping:   "จัดส่งแล้ว",
  completed:  "เสร็จสมบูรณ์",
  cancelled:  "ยกเลิก",
};

const SOURCE_LABEL = {
  contact_page: "ฟอร์มหน้า Contact",
  inline_contact: "ฟอร์มหน้าแรก",
  quotation_modal: "ป๊อปอัปขอใบเสนอราคา",
  catalog_download: "ฟอร์มดาวน์โหลด Catalog",
};

let inited = false;
function ensureInit() {
  if (!inited) {
    emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });
    inited = true;
  }
}

/**
 * ส่งอีเมล auto-reply ให้ลูกค้า + แจ้งเตือนทีมงาน (ยิงคู่กัน)
 * ไม่ throw error กลับไปให้ฟอร์ม — lead ถูกบันทึกใน Firestore ไปแล้วก่อนเรียกฟังก์ชันนี้
 * (saveLead สำเร็จแล้ว) ถ้าอีเมลส่งไม่ออกแค่ log ไว้ ไม่ทำให้ผู้ใช้เห็น error ซ้อน
 *
 * @param {Object} data   — ข้อมูลเดียวกับที่ส่งให้ saveLead() เช่น {name, email, phone, service, message}
 * @param {string} source — "contact_page" | "inline_contact" | "quotation_modal"
 */
// เช็คว่าตั้งค่าครบทั้ง 4 ตัวแล้วหรือยัง — เช็คทุกตัวไม่ใช่แค่ public key
// เพราะถ้าตั้งค่าไม่ครบ (เช่นลืมเปลี่ยน template id ตัวใดตัวหนึ่ง) emailjs.send()
// จะยิง request ไปหา template ที่ไม่มีจริงและ fail แบบเงียบๆ โดยไม่มีคำเตือนที่ชัดเจน
function isEmailjsConfigured() {
  return [
    EMAILJS_PUBLIC_KEY,
    EMAILJS_SERVICE_ID,
    EMAILJS_TEMPLATE_CUSTOMER,
    EMAILJS_TEMPLATE_INTERNAL,
  ].every((v) => typeof v === "string" && v && !v.startsWith("YOUR_"));
}

export async function sendLeadEmails(data, source = "unknown") {
  if (!isEmailjsConfigured()) {
    console.warn(
      "[email-notify] ยังไม่ได้ตั้งค่า EmailJS ให้ครบ (public key / service id / template id x2) " +
      "— ข้ามการส่งอีเมลแจ้งเตือน แต่ lead ยังถูกบันทึกใน Firestore ตามปกติ " +
      "ดูวิธีตั้งค่าในคอมเมนต์ด้านบนของไฟล์นี้ (js/email-notify.js)"
    );
    return;
  }
  ensureInit();

  const sourceLabel = SOURCE_LABEL[source] || source;
  const phone = data.phone || data.tel || "-";

  const jobs = [];

  // 1) auto-reply ให้ลูกค้า (ส่งเฉพาะถ้ามีอีเมล)
  if (data.email) {
    jobs.push(
      emailjs
        .send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_CUSTOMER, {
          to_email: data.email,
          to_name: data.name || "คุณลูกค้า",
          service_interested: data.service || "-",
          customer_message: data.message || "-",
        })
        .catch((err) => console.error("[email-notify] customer email error:", err))
    );
  }

  // 2) แจ้งเตือนทีมงานภายใน (ปลายทางตั้งค่าตายตัวไว้ในฝั่ง EmailJS template เลย)
  jobs.push(
    emailjs
      .send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_INTERNAL, {
        lead_name: data.name || "-",
        lead_email: data.email || "-",
        lead_phone: phone,
        lead_service: data.service || "-",
        lead_message: data.message || "-",
        lead_source: sourceLabel,
        lead_page_url: window.location.href,
      })
      .catch((err) => console.error("[email-notify] internal email error:", err))
  );

  await Promise.all(jobs);
}

// เช็คว่าตั้งค่าครบสำหรับอีเมลแจ้งสถานะคำสั่งผลิตหรือยัง (คนละชุด config กับ lead ด้านบน เพราะ
// ใช้เทมเพลตคนละอันคนละหน้าที่กัน) — public key/service id ใช้ร่วมกับ lead ได้ (บัญชี EmailJS
// เดียวกัน) แต่ template id ใช้ EMAILJS_TEMPLATE_NOTIFY ร่วมกับ sendReviewRequestEmail() (shared
// เทมเพลตเดียวกัน — ดูคอมเมนต์เหตุผลด้านบน)
function isOrderStatusEmailConfigured() {
  return [EMAILJS_PUBLIC_KEY, EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_NOTIFY]
    .every((v) => typeof v === "string" && v && !v.startsWith("YOUR_"));
}

/**
 * ส่งอีเมลแจ้งลูกค้าอัตโนมัติเมื่อสถานะคำสั่งผลิตเปลี่ยน (P0.3)
 * ออกแบบให้เรียกจากจุดเปลี่ยนสถานะจริง (updateOrder() ใน js/db-orders.js) — **ฟังก์ชันนี้เอง
 * ไม่ throw ออกไปเลยไม่ว่ากรณีใด** (กฎกันโค้ดพังของโปรเจกต์: error ของ integration ใหม่ต้องไม่
 * ทำให้ flow เปลี่ยนสถานะเดิมล้มเหลวตามไปด้วย) — catch ทุกอย่างแล้ว console.error ไว้แทน
 *
 * เงื่อนไขที่ "ข้าม" (ไม่ใช่ error — ไม่ log อะไรเลยเพื่อไม่ให้ console รกในสถานการณ์ปกติ):
 * - previousStatus === newStatus (ไม่ได้เปลี่ยนสถานะจริง เช่น แก้ field อื่นในฟอร์มแล้ว submit)
 * - order.email ว่างเปล่า (ลูกค้าไม่ได้ให้อีเมลไว้ — phone ยังใช้เช็คสถานะแบบ pull ได้ตามปกติ)
 * - ยังไม่ตั้งค่า EmailJS template สำหรับฟีเจอร์นี้ครบ (log แค่ warn ครั้งเดียวต่อการเรียก
 *   เหมือน sendLeadEmails() ด้านบน ไม่ใช่ error เพราะเป็นสถานะที่คาดไว้ก่อน setup จริง)
 *
 * @param {Object} order          — order object เต็ม (ต้องมี code/item/email อย่างน้อย)
 * @param {string} previousStatus — สถานะเดิมก่อนแก้ (มาจาก existing doc ก่อน merge)
 * @param {string} newStatus      — สถานะใหม่หลังแก้
 */
export async function sendOrderStatusEmail(order, previousStatus, newStatus) {
  try {
    if (!newStatus || previousStatus === newStatus) return;
    if (!order || !order.email) return;
    if (!isOrderStatusEmailConfigured()) {
      console.warn(
        "[email-notify] ยังไม่ได้ตั้งค่าเทมเพลตแจ้งเตือน (EMAILJS_TEMPLATE_NOTIFY) " +
        "— ข้ามการส่งอีเมล ดูวิธีตั้งค่าในคอมเมนต์ด้านบนของไฟล์นี้ (js/email-notify.js)"
      );
      return;
    }
    ensureInit();

    const statusLabel = ORDER_STATUS_LABEL[newStatus] || newStatus;
    const statusLabelOld = ORDER_STATUS_LABEL[previousStatus] || previousStatus || "-";
    const orderCode = order.code || "-";
    const orderItem = order.item || "-";

    await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_NOTIFY, {
      to_email: order.email,
      to_name: order.customer || "คุณลูกค้า",
      subject_text: `คำสั่งผลิต ${orderCode} อัปเดตสถานะเป็น "${statusLabel}"`,
      message_text:
        `คำสั่งผลิต ${orderCode} (${orderItem}) ของท่านเปลี่ยนสถานะจาก ` +
        `"${statusLabelOld}" เป็น "${statusLabel}" แล้ว\n` +
        `ตรวจสอบรายละเอียดเพิ่มเติมได้ที่เว็บไซต์ CS.SIGN`,
    });
  } catch (err) {
    console.error("[email-notify] order status email error:", err);
  }
}

// เช็คว่าตั้งค่าครบสำหรับอีเมลขอรีวิวหรือยัง — ใช้ EMAILJS_TEMPLATE_NOTIFY เทมเพลตเดียวกับ
// sendOrderStatusEmail() ด้านบน (shared เทมเพลต — ดูคอมเมนต์เหตุผลเรื่องโควตาฟรีด้านบนสุดของไฟล์)
function isReviewRequestEmailConfigured() {
  return [EMAILJS_PUBLIC_KEY, EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_NOTIFY]
    .every((v) => typeof v === "string" && v && !v.startsWith("YOUR_"));
}

/**
 * ส่งอีเมลขอรีวิวลูกค้าอัตโนมัติหลังคำสั่งผลิตเสร็จสมบูรณ์ (P2.9)
 * ออกแบบให้เรียกจากจุดเปลี่ยนสถานะจริง (updateOrder() ใน js/db-orders.js) เหมือน
 * sendOrderStatusEmail() ด้านบน — **ฟังก์ชันนี้เองไม่ throw ออกไปเลยไม่ว่ากรณีใด** (กฎกันโค้ดพัง
 * ของโปรเจกต์: error ของ integration ใหม่ต้องไม่ทำให้ flow เปลี่ยนสถานะเดิมล้มเหลวตามไปด้วย)
 *
 * เงื่อนไขที่ "ข้าม" (ไม่ log เพื่อไม่ให้ console รกในสถานการณ์ปกติ):
 * - newStatus ไม่ใช่ "completed" (ขอรีวิวเฉพาะตอนงานเสร็จจริงเท่านั้น ไม่ใช่ทุก status เปลี่ยน
 *   ต่างจาก sendOrderStatusEmail() ที่ยิงทุกครั้งที่ status เปลี่ยน)
 * - previousStatus === "completed" อยู่แล้ว (กันส่งซ้ำถ้ามีคน submit ฟอร์มซ้ำโดยสถานะเดิมเป็น
 *   completed อยู่แล้ว — ไม่ใช่การเปลี่ยนเข้าสู่ completed ใหม่จริงๆ)
 * - order.reviewRequestedAt มีค่าอยู่แล้ว (P2.9a2: กันส่งซ้ำแบบถาวรด้วย field ใน Firestore เอง
 *   ไม่ใช่แค่ระดับ transition-based ด้านบน — ครอบคลุมเคส "สถานะออกจาก completed แล้วกลับเข้ามา
 *   ใหม่" ที่ transition-guard เดิมป้องกันไม่ได้)
 * - order.email ว่างเปล่า
 * - ยังไม่ตั้งค่า EmailJS template สำหรับฟีเจอร์นี้ครบ (log แค่ warn ครั้งเดียวต่อการเรียก)
 *
 * @param {Object} order          — order object เต็ม (ต้องมี code/item/email อย่างน้อย)
 * @param {string} previousStatus — สถานะเดิมก่อนแก้
 * @param {string} newStatus      — สถานะใหม่หลังแก้
 * @returns {Promise<boolean>} true เฉพาะตอนที่ emailjs.send() ถูกเรียกและสำเร็จจริงเท่านั้น —
 *   ผู้เรียก (updateOrder() ใน js/db-orders.js) ใช้ค่านี้ตัดสินใจว่าจะบันทึก reviewRequestedAt
 *   ลง Firestore หรือไม่ (P2.9a2) — ทุก early-return ด้านบนคืนค่า false (ไม่ใช่ throw)
 */
export async function sendReviewRequestEmail(order, previousStatus, newStatus) {
  try {
    if (newStatus !== "completed" || previousStatus === "completed") return false;
    if (!order || !order.email) return false;
    if (order.reviewRequestedAt) return false;
    if (!isReviewRequestEmailConfigured()) {
      console.warn(
        "[email-notify] ยังไม่ได้ตั้งค่าเทมเพลตแจ้งเตือน (EMAILJS_TEMPLATE_NOTIFY) " +
        "— ข้ามการส่งอีเมล ดูวิธีตั้งค่าในคอมเมนต์ด้านบนของไฟล์นี้ (js/email-notify.js)"
      );
      return false;
    }
    ensureInit();

    const orderCode = order.code || "-";
    const orderItem = order.item || "-";

    await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_NOTIFY, {
      to_email: order.email,
      to_name: order.customer || "คุณลูกค้า",
      subject_text: `ขอความคิดเห็นเกี่ยวกับงาน ${orderCode}`,
      message_text:
        `ขอบคุณที่ไว้วางใจ CS.SIGN สำหรับคำสั่งผลิต ${orderCode} (${orderItem}) ค่ะ\n` +
        `หากสะดวก รบกวนขอความคิดเห็น/รีวิวการใช้บริการสักเล็กน้อย เพื่อนำไปพัฒนาบริการให้ดียิ่งขึ้น`,
    });
    return true;
  } catch (err) {
    console.error("[email-notify] review request email error:", err);
    return false;
  }
}