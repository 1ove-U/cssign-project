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
   ⚠️ ต้องตั้งค่าก่อนใช้งานจริง — ยังไม่ใช่บัญชี EmailJS ของบริษัทคุณ
   ═══════════════════════════════════════════════════════════════
   ค่า 4 ตัวด้านล่างเป็น "ค่าตัวอย่างจากเทมเพลต" ไม่ใช่บัญชีจริงของ CS.SIGN
   ถ้าไม่เปลี่ยนก่อนขึ้นเว็บจริง ฟอร์มติดต่อจะไม่ส่งอีเมลแจ้งเตือนใดๆ เลย
   (แต่ lead ที่ลูกค้ากรอกยังถูกบันทึกลง Firestore ตามปกติ ไม่หายไปไหน
   เพราะการบันทึกกับการส่งอีเมลเป็นคนละขั้นตอนแยกจากกัน)

   วิธีหาค่าจริงทั้ง 4 ตัว:
   1. สมัคร/ล็อกอิน https://www.emailjs.com ด้วยอีเมลของบริษัท (ไม่ใช่อีเมลนักพัฒนา)
   2. Email Services → Add New Service → เชื่อมกับ Gmail/Outlook ของบริษัท
      → จะได้ EMAILJS_SERVICE_ID (ขึ้นต้นด้วย "service_")
   3. Email Templates → สร้าง 2 เทมเพลต:
      - แบบที่ 1 ส่งหาลูกค้า (auto-reply) → ได้ EMAILJS_TEMPLATE_CUSTOMER
      - แบบที่ 2 ส่งแจ้งทีมงานภายใน → ได้ EMAILJS_TEMPLATE_INTERNAL
      (ทั้งสองขึ้นต้นด้วย "template_")
   4. Account → General → คัดลอก "Public Key" → ได้ EMAILJS_PUBLIC_KEY
   5. แทนที่ค่า YOUR_... ด้านล่างด้วยค่าจริงที่ได้ทั้ง 4 ตัว
   ─────────────────────────────────────────────────────────────── */
const EMAILJS_PUBLIC_KEY        = "qigR2h9JU2To7akwe";
const EMAILJS_SERVICE_ID        = "service_uim2dtt";
const EMAILJS_TEMPLATE_CUSTOMER = "template_fjct05k";
const EMAILJS_TEMPLATE_INTERNAL = "template_gw2wtgp";

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