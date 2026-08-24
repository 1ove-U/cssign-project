/**
 * CS.SIGN — js/db-quotations.js
 * P3.0 Phase 3 (data layer รอบ 1) — ฝั่งแอดมิน "ออกใบเสนอราคาจริง"
 *
 * คอลเลกชันใหม่ "quotations" — เอกสารใบเสนอราคาจริงที่แอดมินออก (ต่างจาก "quote_requests"
 * ที่ลูกค้าส่งเข้ามาจากตะกร้าใน Phase 2 — ดูเหตุผลที่แยกคอลเลกชัน 2 อันใน
 * p3.0-quotation-cart-plan.md หัวข้อ "quotations — เอกสารใบเสนอราคาจริงที่แอดมินออก")
 * สร้างได้ 2 ทาง: (1) prefill จาก quote_request ที่มีอยู่แล้วผ่าน buildQuotationFromRequest()
 * แล้วส่งต่อให้ addQuotation() (2) สร้างเองจากศูนย์ (ไม่ต้องมี requestId เลย)
 *
 * เลขที่เอกสาร (quoteNo) รันอัตโนมัติผ่าน runTransaction() บน doc เดียว "counters/quotations"
 * (ยังไม่มี doc นี้จริงใน Firestore เพราะยังไม่ deploy — โค้ดเขียนให้ถูกแบบไว้ก่อน, ครั้งแรกที่
 * เรียกจริงจะสร้าง doc นี้ขึ้นมาเองผ่าน tx.set() ถ้ายังไม่มี) รูปแบบ "QT{ปี ค.ศ.}-{เลข 4 หลัก}"
 * เช่น "QT2026-0007" — รีเซ็ตเป็น 0001 ใหม่ทุกครั้งที่ปีเปลี่ยน (เทียบปีจาก counter doc เดิมกับ
 * ปีปัจจุบัน ณ ตอนเรียก ไม่ใช่ cron แยก — ฟรี ไม่ต้องพึ่ง Cloud Functions)
 *
 * ใช้ Firestore instance เดียวกับ db.js (import { db, auth }) แบบเดียวกับไฟล์ data layer อื่น
 * ทุกไฟล์ในโปรเจกต์ (ดูเหตุผลเต็มในคอมเมนต์หัวไฟล์ js/db.js) — ห้ามเรียก getFirestore(app) ซ้ำ
 *
 * ขอบเขตรอบนี้ (data layer เท่านั้น ตามเพดาน 2-3 ไฟล์โค้ดผลิตภัณฑ์/รอบ): CRUD พื้นฐาน + คำนวณ
 * ยอดรวม/VAT/สุทธิ (ฝั่ง client ล้วนๆ) + เลขที่เอกสารรันอัตโนมัติ
 *
 * P3.0 Phase 4 (รอบ 1 — data layer): เพิ่ม publicToken ให้ลิงก์สาธารณะดูใบเสนอราคาแล้ว — pattern
 * เดียวกับ trackingId/order_tracking ใน js/db-orders.js เป๊ะ (ดูคอมเมนต์หัวหมวด "ORDER TRACKING"
 * ในไฟล์นั้นเทียบเคียง): สุ่ม publicToken ด้วย crypto.randomUUID() ตอนสร้างใบเสนอราคาใหม่เท่านั้น
 * (ไม่เปลี่ยนอีกหลังจากนั้น) เก็บสำเนา "เฉพาะข้อมูลที่ปลอดภัยให้คนนอกเห็น" ไว้ที่คอลเลกชันใหม่
 * "quotation_public" โดยใช้ publicToken เองเป็น doc id (จึง "get" ทีละ doc ตรงๆ แบบ public ได้ แต่
 * "list" ทั้ง collection ปิดไว้ที่ firestore.rules กันไล่ดูใบเสนอราคาคนอื่น — ต่างจาก
 * order_tracking ตรงที่สำเนานี้ต้องมีข้อมูลครบเกือบเท่าเอกสารต้นฉบับ เพราะหน้าดูใบเสนอราคา
 * สาธารณะ (Phase 4 รอบถัดไป) ต้องโชว์ชื่อ/ที่อยู่ผู้รับใบเสนอราคาจริง — ยอมรับได้เพราะเข้าถึงได้
 * เฉพาะคนที่ "รู้ publicToken" ซึ่งเดาไม่ได้ในทางปฏิบัติ (UUID v4) เหมือนใบแจ้งหนี้ออนไลน์ทั่วไป)
 * ไม่คัดลอก createdBy (uid พนักงานภายใน ไม่เกี่ยวกับลูกค้าเลย) และไม่คัดลอก requestId (อ้างอิง
 * quote_request ภายในเท่านั้น ลูกค้าไม่จำเป็นต้องรู้) เข้าไปในสำเนา public
 * UI แอดมิน (ปุ่มคัดลอกลิงก์)/หน้าดูสาธารณะ quotation-view.html ทำใน Phase 4 รอบ 2-3 แล้ว
 *
 * P3.0 Phase 4 (รอบ 4 — ปุ่มลูกค้า "ยอมรับ"/"ขอแก้ไข" จากหน้า public): ตามแผนต้นฉบับ
 * (p3.0-quotation-cart-plan.md หัวข้อ "Phase 4") ที่ระบุว่าให้ทำ "แบบเดียวกับ design_approvals
 * เดิม (append-only, ไม่ต้อง auth)" — แต่ตัดสินใจ **ต่างจาก design_approvals ตรงจุดสำคัญหนึ่งจุด**:
 * design_approvals เป็น log แยกล้วนๆ ไม่แตะ order.status เลย (ต้องให้แอดมินกดเปลี่ยนสถานะเองหลัง
 * เห็น log) แต่ตัวนี้ (submitQuotationResponse() ด้านล่าง) **เขียน status ลงตรงๆ ที่ quotations/{id}
 * เลย** เพราะ continue-prompt รอบนี้ (P3.0 Phase 4 รอบ 4) ระบุชัดว่าต้องการให้แอดมิน "เห็นสถานะ
 * เปลี่ยนในตารางแอดมินผ่าน realtime listener เดิมทันที" โดยไม่ต้องเพิ่มขั้นตอนให้แอดมินกดยืนยันซ้ำ —
 * ยอมรับความเสี่ยงนี้ได้เพราะ (1) ค่าที่ลูกค้าเขียนได้ถูกจำกัดไว้แคบมากผ่าน firestore.rules (แค่
 * status ∈ ['accepted','changes_requested'] + customerResponse ที่ shape ตายตัว ไม่ใช่ field
 * ธุรกิจอิสระที่เชื่อมโยงกับระบบอื่นเหมือน orders) (2) เขียนได้ "ครั้งเดียว" เท่านั้น (rules บล็อก
 * ถ้า resource.data มี customerResponse อยู่แล้ว) ดู REFACTOR-PROGRESS.md หัวข้อ "P3.0 Phase 4
 * รอบ 4" สำหรับบริบทการตัดสินใจเต็ม — เพิ่ม field ใหม่ "quotationId" ในสำเนา
 * quotation_public/{publicToken} (เขียนโดย upsertQuotationPublic() ด้านล่าง) เพื่อให้หน้า public
 * รู้ id เอกสารจริงใน "quotations" (ต่างจาก doc id ของ quotation_public เองซึ่งคือ publicToken)
 * สำหรับเขียนกลับไปที่เอกสารต้นฉบับได้
 *
 * P3.0 Phase 5 (รอบ 7 — data layer): ประวัติการขอใบเสนอราคาใน my-account.html — ต่อยอด panel
 * เดิม (P2.9-D2/D3 ใช้ listenMyLeads() จาก js/leads.js) ให้เปลี่ยนไปใช้ listenMyQuoteRequests()
 * (js/db-quote-requests.js — เขียนไว้แล้วตั้งแต่ P3.0 Phase 2 แต่ยังไม่มี UI ไหนเรียกใช้จริง)
 * แทน เพื่อโชว์รายการสินค้าที่ขอจริง (items[]) ไม่ใช่แค่ lead ทั่วไป — งานนั้นเป็น UI รอทำรอบหน้า
 * รอบนี้ (data layer เท่านั้น) แก้ปัญหาจุดที่ยังขาด: ลูกค้าต้องรู้ด้วยว่าคำขอที่เคยส่งไป "แอดมิน
 * ออกใบเสนอราคาจริงให้แล้วหรือยัง" และถ้าออกแล้วต้องมีลิงก์ไปหน้า public (quotation-view.html?
 * token=...) ได้ — **ตัดสินใจสำคัญ**: ไม่เพิ่ม query ใหม่ให้ลูกค้า list/filter collection
 * "quotations" ได้เอง (ต่างจากที่แอดมิน admin-quotations.js ทำ — เทียบ requestId กับ
 * allQuotations ที่โหลดทั้งหมดอยู่แล้วฝั่ง client เพราะแอดมิน isAuthenticated() && !isLineCustomerToken()
 * อ่าน collection "quotations" ทั้งหมดได้อยู่แล้ว) เพราะ firestore.rules ปิดไม่ให้
 * isLineCustomerToken() อ่าน "quotations" เลยสักฟิลด์ (ดู match /quotations/{id} ด้านล่าง) —
 * เปิดช่องให้ query แบบนั้นจะต้องเพิ่ม rule ใหม่ที่เสี่ยงเปิดกว้างเกินไป (ต้องกรองข้าม field
 * requestId ที่ผูกกับ quote_requests ของลูกค้าคนนั้นเท่านั้น ซึ่ง native Firestore rules ทำ join
 * ข้าม 2 collection แบบนี้ไม่ได้โดยตรงในทางปฏิบัติที่ปลอดภัย) — **แทนที่ด้วยการ "ฝัง" ลิงก์กลับไป
 * ที่เอกสาร quote_requests/{requestId} เอง** (ที่ลูกค้าอ่านได้อยู่แล้วผ่าน listenMyQuoteRequests()
 * เพราะกรองด้วย lineUserId เดิม) ผ่าน linkQuotationToRequest() ด้านล่าง — เรียกจาก addQuotation()
 * อัตโนมัติทุกครั้งที่สร้างใบเสนอราคาจาก requestId (ไม่ทำอะไรถ้าไม่มี requestId เช่นสร้างจากศูนย์)
 * เขียนแค่ 3 field: quotationId (ให้ UI รู้ว่าออกแล้ว, ไม่ได้ใช้เปิดหน้า public ตรงๆ) +
 * quotePublicToken (ใช้สร้างลิงก์ quotation-view.html?token=... ให้ลูกค้ากดดูได้ทันที) + status
 * เปลี่ยนเป็น "quoted" อัตโนมัติ (สื่อความหมายตรงกับ enum เดิมของ quote_requests.status
 * ['new','quoted','closed'] อยู่แล้ว — ไม่มี UI ไหนเคยตั้งค่านี้เป็น "quoted" มาก่อนเลยจนถึงรอบนี้
 * ยืนยันจาก grep 'quoted' ทั้งโปรเจกต์ก่อนแก้) — ล้มเหลวแบบเงียบๆ (try/catch, console.warn) ไม่
 * throw ต่อ ตาม pattern เดียวกับ removeQuotationPublic() ด้านบน เพราะไม่อยากให้การซิงก์ลิงก์นี้
 * พลาดแล้วบล็อกการสร้างใบเสนอราคาหลักที่สำเร็จไปแล้ว (แอดมินยังเห็น/แก้ไขใบเสนอราคาได้ปกติแม้
 * ลิงก์ฝั่งลูกค้าจะยังไม่ขึ้นก็ตาม — ไม่ critical เท่าตัวเอกสารหลัก) — firestore.rules
 * (match /quote_requests/{requestId} allow update) ต้องแก้คู่กันให้ staff เขียน field ใหม่ 2 ตัว
 * นี้ได้ด้วย (เดิมอนุญาตแค่ status/notes)
 */

import { collection, doc, getDoc, getDocs, addDoc, setDoc, updateDoc,
         deleteDoc, orderBy, query, onSnapshot, runTransaction,
         serverTimestamp }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { db, auth } from "./db.js";

/* VAT มาตรฐานประเทศไทย 7% — ค่าคงที่เดียว ใช้ร่วมกันทั้งไฟล์ (ไม่ผูกกับ settings/main เพราะ
   อัตรานี้กำหนดโดยกฎหมาย ไม่ใช่ค่าที่ธุรกิจปรับเองได้เหมือน taxId/companyNameOfficial) */
const VAT_RATE = 0.07;

// "changes_requested" เพิ่มในรอบ Phase 4 รอบ 4 — สถานะที่ลูกค้ากด "ขอแก้ไข" เองจากหน้า public
// (ดูคอมเมนต์หัวไฟล์หัวข้อ Phase 4 รอบ 4) คนละความหมายกับ "rejected" (ลูกค้าปฏิเสธไปเลย ไม่เอา) —
// ป้ายภาษาไทยดูที่ QUOTATION_STATUS_LABEL ใน js/admin-quotations.js
const QUOTATION_STATUSES = ["draft", "sent", "accepted", "rejected", "expired", "changes_requested"];

// action ที่ลูกค้ากดได้เองจากหน้า public (quotation-view.html) ผ่าน submitQuotationResponse() —
// ตั้งใจให้ตรงกับชื่อ status ที่จะซิงก์เป๊ะ (accepted/changes_requested) เพื่อไม่ต้องมี mapping
// แยกอีกชั้นระหว่าง action กับ status (ดูเหตุผลเต็มในคอมเมนต์หัวไฟล์)
const QUOTATION_RESPONSE_ACTIONS = ["accepted", "changes_requested"];

/**
 * ตัดฟิลด์ item ใบเสนอราคาให้เหลือเฉพาะ key ที่ "quotations" รองรับตาม data model ใน
 * p3.0-quotation-cart-plan.md (name/variantLabel/qty/unit/unitPrice/discount/lineTotal) —
 * คนละ shape กับ sanitizeItem() ใน js/db-quote-requests.js (คำขอฝั่งลูกค้ายังไม่มีราคา) —
 * lineTotal คำนวณใหม่เสมอจาก qty/unitPrice/discount ที่นี่ ไม่เชื่อค่าที่ส่งเข้ามาตรงๆ (กัน
 * ฝั่ง client ส่งค่าไม่ตรงกันมาโดยไม่ตั้งใจ/ตั้งใจ)
 * @param {Object} item
 * @returns {Object|null} null ถ้า item ไม่ใช่ object เลย
 */
export function sanitizeQuotationItem(item) {
  if (!item || typeof item !== "object") return null;
  const qty        = typeof item.qty === "number" && item.qty > 0 ? item.qty : 1;
  const unitPrice  = typeof item.unitPrice === "number" && item.unitPrice >= 0 ? item.unitPrice : 0;
  const discount   = typeof item.discount === "number" && item.discount >= 0 ? item.discount : 0;
  return {
    name:         typeof item.name === "string" ? item.name : "",
    variantLabel: typeof item.variantLabel === "string" ? item.variantLabel : "",
    qty,
    unit:         typeof item.unit === "string" ? item.unit : "",
    unitPrice,
    discount,
    lineTotal: computeLineTotal(qty, unitPrice, discount)
  };
}

/**
 * ยอดรวมต่อรายการ = (จำนวน x ราคาต่อหน่วย) - ส่วนลด (ส่วนลดเป็นจำนวนเงินต่อรายการ ไม่ใช่ %
 * — ยืนยันตาม data model เดิมใน plan ที่ไม่ได้ระบุหน่วย % ไว้ ถ้าแอดมินต้องการคิดเป็น % ให้คำนวณ
 * เป็นจำนวนเงินก่อนกรอกฝั่ง UI) — ไม่ติดลบ (ส่วนลดเกินยอดรวมรายการ → เหลือ 0 ไม่ใช่ค่าติดลบ)
 * @param {number} qty
 * @param {number} unitPrice
 * @param {number} discount
 * @returns {number}
 */
export function computeLineTotal(qty, unitPrice, discount) {
  const q  = Number(qty) || 0;
  const up = Number(unitPrice) || 0;
  const d  = Number(discount) || 0;
  return Math.max(0, q * up - d);
}

/**
 * คำนวณ subtotal/vatAmount/grandTotal จากรายการที่ sanitize แล้ว (ฝั่ง client ล้วนๆ ไม่มี
 * cloud function ใดๆ) — vatMode 3 แบบตาม data model:
 *  - "excluded": ราคาที่กรอกยังไม่รวม VAT → บวก VAT เพิ่มเข้าไปเป็นยอดสุทธิ (ปกติที่สุด)
 *  - "included": ราคาที่กรอกรวม VAT แล้ว → แยก VAT ออกมาโชว์เฉยๆ ยอดสุทธิเท่ากับ subtotal เดิม
 *  - "none": ธุรกิจไม่ได้จดทะเบียน VAT → ไม่มี VAT เลย ยอดสุทธิเท่ากับ subtotal เดิม
 * @param {Array} items — รายการที่ผ่าน sanitizeQuotationItem() แล้ว (เรียกฟังก์ชันนี้เองอีกชั้น
 *   เผื่อผู้เรียกส่ง item ดิบเข้ามาตรงๆ ก็ยังปลอดภัย)
 * @param {string} vatMode — "included" | "excluded" | "none"
 * @returns {{subtotal:number, vatAmount:number, grandTotal:number}}
 */
export function computeQuotationTotals(items, vatMode) {
  const sanitized = Array.isArray(items) ? items.map(sanitizeQuotationItem).filter(Boolean) : [];
  const subtotal = sanitized.reduce((sum, it) => sum + it.lineTotal, 0);

  let vatAmount = 0;
  let grandTotal = subtotal;
  if (vatMode === "excluded") {
    vatAmount = round2(subtotal * VAT_RATE);
    grandTotal = round2(subtotal + vatAmount);
  } else if (vatMode === "included") {
    // subtotal รวม VAT อยู่แล้ว → แยกกลับ: vat = subtotal - subtotal/(1+rate)
    vatAmount = round2(subtotal - subtotal / (1 + VAT_RATE));
    grandTotal = round2(subtotal);
  } else {
    // "none" หรือค่าอื่นที่ไม่รู้จัก → ไม่มี VAT เลย (fail-safe ปลอดภัยกว่าเดา)
    vatAmount = 0;
    grandTotal = round2(subtotal);
  }

  return { subtotal: round2(subtotal), vatAmount, grandTotal };
}

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

/**
 * เลขที่เอกสารรันอัตโนมัติผ่าน runTransaction() บน doc เดียว "counters/quotations" —
 * รูปแบบ "QT{ปี ค.ศ. ปัจจุบัน}-{เลข 4 หลัก}" เช่น "QT2026-0007" — รีเซ็ตเป็น 1 ใหม่ทุกครั้งที่
 * ปีใน counter doc ไม่ตรงกับปีปัจจุบัน (ปีเปลี่ยน = เริ่มเลขใหม่) — ถ้า doc ยังไม่เคยมีมาก่อน
 * (ยังไม่ deploy/ยังไม่เคยออกใบเสนอราคาเลย) ให้ถือว่าเริ่มจาก 0 แล้วสร้าง doc ใหม่ผ่าน tx.set()
 * ในทรานแซกชันเดียวกัน (atomic กับการอ่านค่าล่าสุด กันเลขซ้ำถ้าออกพร้อมกันจากคนละเซสชัน)
 * @returns {Promise<string>} เช่น "QT2026-0001"
 */
export async function generateQuoteNo() {
  const ref = doc(db, "counters", "quotations");
  const currentYear = new Date().getFullYear();
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const existing = snap.exists() ? snap.data() : {};
    const sameYear = existing.year === currentYear;
    const nextSeq = sameYear ? (Number(existing.seq) || 0) + 1 : 1;
    tx.set(ref, { year: currentYear, seq: nextSeq }, { merge: true });
    return `QT${currentYear}-${String(nextSeq).padStart(4, "0")}`;
  });
}

// ===========================
// PUBLIC LINK (P3.0 Phase 4, รอบ 1) — ลิงก์สาธารณะดูใบเสนอราคา ไม่ต้อง login
// ===========================
// pattern เดียวกับ trackingId/order_tracking ใน js/db-orders.js — ดูคอมเมนต์หัวไฟล์ด้านบน

/**
 * สุ่ม token เดายาก (UUID v4) สำหรับลิงก์สาธารณะดูใบเสนอราคา — เรียกครั้งเดียวตอนสร้างใบเสนอราคา
 * ใหม่เท่านั้น (addQuotation()) ไม่เปลี่ยนอีกหลังจากนั้น
 * @returns {string}
 */
export function buildPublicToken() {
  return crypto.randomUUID();
}

/**
 * เขียน/อัปเดตสำเนา "เฉพาะข้อมูลที่ปลอดภัยให้คนนอกเห็น" ของใบเสนอราคาไว้ที่
 * "quotation_public/{publicToken}" — ใช้ setDoc() ทับทั้ง doc เสมอ (ไม่ใช่ merge) เพราะผู้เรียก
 * ส่ง object ที่ประกอบครบแล้วทุกครั้ง (เหมือน upsertOrderTracking() ใน js/db-orders.js) — ไม่ทำ
 * อะไรเลยถ้าไม่มี publicToken (เอกสารเก่าก่อนรอบนี้ที่ยังไม่มี field นี้)
 * @param {Object} quotation — ต้องมี publicToken ติดมาด้วย
 * @param {string} quotationId — doc id จริงใน collection "quotations" (ต่างจาก doc id ของ
 *   quotation_public เองซึ่งคือ publicToken) — เพิ่มใน Phase 4 รอบ 4 ให้หน้า public เอาไปใช้
 *   เขียนกลับผ่าน submitQuotationResponse() ได้ (ดูคอมเมนต์หัวไฟล์หัวข้อ Phase 4 รอบ 4) — เอกสาร
 *   quotation_public เก่าก่อนรอบนี้จะยังไม่มี field นี้จนกว่าแอดมินจะแก้ไขใบเสนอราคานั้นอีกครั้ง
 *   (updateQuotation() เรียก upsertQuotationPublic() ซ้ำทุกครั้งที่แก้ ซึ่งจะเติม field นี้ให้เอง)
 * @param {Object} [customerResponse] — ถ้ามีอยู่แล้ว (ลูกค้าเคยตอบรับ/ขอแก้ไขไปแล้ว) ต้องคัดลอก
 *   มาด้วยตอนแอดมินแก้ไขใบเสนอราคาซ้ำ ไม่งั้นสำเนา public จะ "ลืม" ว่าลูกค้าเคยตอบรับไปแล้ว
 *   (เห็นปุ่มกดซ้ำได้อีกทั้งที่ตอบไปแล้ว) — ไม่บังคับส่ง (undefined = ยังไม่เคยตอบ)
 */
async function upsertQuotationPublic(quotation, quotationId, customerResponse) {
  const publicToken = quotation && quotation.publicToken;
  if (!publicToken) return;
  const payload = {
    quoteNo:         quotation.quoteNo || "",
    billingName:     quotation.billingName || "",
    taxId:           quotation.taxId || "",
    billingAddress:  quotation.billingAddress || "",
    contactPerson:   quotation.contactPerson || "",
    phone:           quotation.phone || "",
    email:           quotation.email || "",
    shippingAddress: quotation.shippingAddress || "",
    items:           Array.isArray(quotation.items) ? quotation.items : [],
    subtotal:        Number(quotation.subtotal) || 0,
    vatMode:         quotation.vatMode || "excluded",
    vatAmount:       Number(quotation.vatAmount) || 0,
    grandTotal:      Number(quotation.grandTotal) || 0,
    paymentTerms:    quotation.paymentTerms || "",
    validUntil:      quotation.validUntil || "",
    notes:           quotation.notes || "",
    status:          quotation.status || "draft",
    createdAt:       quotation.createdAt || null,
    updatedAt:       serverTimestamp()
  };
  if (quotationId) payload.quotationId = quotationId;
  if (customerResponse) payload.customerResponse = customerResponse;
  await setDoc(doc(db, "quotation_public", publicToken), payload);
}

/**
 * ลบสำเนา public ทิ้ง — เรียกตอนลบใบเสนอราคาต้นฉบับ (deleteQuotation()) จับ error เองเงียบๆ
 * (ไม่ throw ต่อ) ตาม pattern เดียวกับ removeOrderTracking() — ไม่ให้การลบสำเนา public ที่พลาด
 * ไปบล็อกการลบเอกสารหลักที่สำเร็จไปแล้ว
 * @param {string|null} publicToken
 */
async function removeQuotationPublic(publicToken) {
  if (!publicToken) return;
  try {
    await deleteDoc(doc(db, "quotation_public", publicToken));
  } catch (err) {
    console.warn("removeQuotationPublic: ลบสำเนา public เดิมไม่สำเร็จ", publicToken, err);
  }
}

/**
 * อ่านใบเสนอราคาแบบ public ผ่าน token — ใช้โดยหน้า quotation-view.html (ลูกค้าดูเอง ไม่ต้อง
 * login) — คืน null ถ้าไม่พบ (token ผิด/ใบเสนอราคาถูกลบไปแล้ว)
 * @param {string} token
 * @returns {Promise<Object|null>}
 */
export async function getQuotationByToken(token) {
  if (!token || typeof token !== "string") return null;
  const snap = await getDoc(doc(db, "quotation_public", token));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/**
 * ลูกค้ากด "ยอมรับใบเสนอราคา"/"ขอแก้ไข" เองจากหน้า public (quotation-view.html) ไม่ต้อง login —
 * ดูเหตุผลการออกแบบเต็มในคอมเมนต์หัวไฟล์หัวข้อ "P3.0 Phase 4 (รอบ 4 ...)" — สรุปสั้นๆ: เขียน
 * status ลงตรงๆ ที่ "quotations/{id}" (ไม่ใช่ log แยกแบบ design_approvals) จำกัดขอบเขตด้วย
 * firestore.rules (เขียนได้ครั้งเดียว, เขียนได้แค่ field ที่เกี่ยวกับการตอบรับเท่านั้น)
 *
 * lookup เอกสารจริงผ่าน quotation_public/{publicToken} ก่อนเสมอ (ได้ quotationId ที่เก็บไว้ตั้งแต่
 * Phase 4 รอบ 4 — ถ้าไม่มี แปลว่าใบเสนอราคานี้สร้างก่อนรอบนี้ ยังไม่รองรับฟีเจอร์นี้) แล้วค่อยเขียน
 * ไปที่เอกสารต้นฉบับ "quotations/{quotationId}" + ซิงก์สำเนา public ให้ตรงกันทันที (กันกดซ้ำจาก
 * เครื่องเดิมถ้า refresh หน้าแล้วยังไม่เห็น listener อัปเดต — เทียบเท่า pattern optimistic sync
 * เดียวกับ upsertQuotationPublic() จุดอื่นในไฟล์นี้)
 *
 * @param {string} publicToken
 * @param {"accepted"|"changes_requested"} action
 * @param {string} [comment] — บังคับกรอกจริงที่ชั้น UI ตอน "ขอแก้ไข" (ที่นี่ไม่บังคับ เผื่อกรณีอื่น)
 * @returns {Promise<void>}
 */
export async function submitQuotationResponse(publicToken, action, comment = "") {
  if (!publicToken || typeof publicToken !== "string") {
    throw new Error("submitQuotationResponse: ต้องระบุ publicToken");
  }
  if (!QUOTATION_RESPONSE_ACTIONS.includes(action)) {
    throw new Error("submitQuotationResponse: action ต้องเป็น \"accepted\" หรือ \"changes_requested\" เท่านั้น");
  }
  const publicRef = doc(db, "quotation_public", publicToken);
  const publicSnap = await getDoc(publicRef);
  if (!publicSnap.exists()) {
    throw new Error("submitQuotationResponse: ไม่พบใบเสนอราคานี้ (token ผิดหรือถูกลบไปแล้ว)");
  }
  const publicData = publicSnap.data();
  if (publicData.customerResponse) {
    throw new Error("submitQuotationResponse: ใบเสนอราคานี้มีการตอบรับไปแล้ว ไม่สามารถตอบซ้ำได้");
  }
  const quotationId = publicData.quotationId;
  if (!quotationId) {
    throw new Error("submitQuotationResponse: ใบเสนอราคานี้สร้างก่อนรอบที่รองรับฟีเจอร์นี้ กรุณาติดต่อทีมงานโดยตรง");
  }

  const customerResponse = {
    action,
    comment: String(comment || "").slice(0, 2000),
    respondedAt: serverTimestamp()
  };

  await updateDoc(doc(db, "quotations", quotationId), {
    customerResponse,
    status: action
  });
  await setDoc(publicRef, {
    ...publicData,
    customerResponse,
    status: action,
    updatedAt: serverTimestamp()
  });
}

/**
 * สร้างโครงร่างใบเสนอราคา (draft) prefill จาก quote_request ที่ลูกค้าส่งเข้ามาแล้ว (Phase 2) —
 * pure function ล้วนๆ ไม่เรียก Firestore เลย (ไม่ได้บันทึกอะไรตรงนี้) — ส่งผลลัพธ์ต่อให้
 * addQuotation() อีกทีเพื่อบันทึกจริง — items แปลงจาก shape ของ quote_requests (productId/name/
 * variantLabel/size/material/qty/unit/note) มาเป็น shape ของ quotations (name/variantLabel/qty/
 * unit/unitPrice/discount/lineTotal) โดยตั้ง unitPrice/discount เป็น 0 เสมอ (แอดมินต้องกรอกราคา
 * เองที่ UI ในรอบถัดไป — คำขอลูกค้าไม่มีราคามาด้วยตั้งแต่ต้น)
 * @param {Object} request — เอกสาร quote_request (ต้องมี id ติดมาด้วย จาก { id, ...data() })
 * @returns {Object} payload พร้อมส่งต่อให้ addQuotation()
 */
export function buildQuotationFromRequest(request) {
  const req = request || {};
  const items = Array.isArray(req.items) ? req.items.map(it => ({
    name:         (it && it.name) || "",
    variantLabel: (it && it.variantLabel) || "",
    qty:          (it && it.qty) || 1,
    unit:         (it && it.unit) || "",
    unitPrice: 0,
    discount: 0
  })) : [];

  return {
    requestId: req.id || null,
    billingName:      req.billingName || "",
    taxId:            req.taxId || "",
    billingAddress:   req.billingAddress || "",
    contactPerson:    req.contactPerson || "",
    phone:            req.phone || "",
    email:            req.email || "",
    shippingAddress:  req.shippingAddress || "",
    items,
    vatMode: "excluded",
    paymentTerms: req.paymentTermsRequested || "",
    validUntil: "",
    notes: req.notes || ""
  };
}

/**
 * สร้างโครงร่างใบเสนอราคา (draft) จาก "คัดลอก" ใบเสนอราคาที่มีอยู่แล้ว (P3.0 Phase 6, ดู
 * continue-prompt-p3.0-phase6-round11.md หัวข้อ "Clone ใบเสนอราคาเป็นฉบับร่างใหม่") — pure
 * function ล้วนๆ ไม่เรียก Firestore เลย (pattern เดียวกับ buildQuotationFromRequest() ด้านล่าง
 * ทุกจุด) — ส่งผลลัพธ์ต่อให้ addQuotation() เพื่อบันทึกจริง (generate quoteNo/publicToken ใหม่
 * ของตัวเองเสมอ ไม่ใช้ของต้นฉบับซ้ำ)
 *
 * field ที่ copy มาจากต้นฉบับ: billingName/taxId/billingAddress/contactPerson/phone/email/
 * shippingAddress/items (คัด unitPrice/discount ที่กรอกไว้แล้วมาด้วยเลย ต่างจาก
 * buildQuotationFromRequest() ที่ตั้ง unitPrice/discount เป็น 0 เสมอ — เพราะ clone มาจาก
 * quotation ที่มีราคาจริงอยู่แล้ว ไม่ใช่จาก quote_request ที่ยังไม่มีราคา)/vatMode/paymentTerms/
 * notes — field ที่ "ไม่" copy (ตั้งค่าใหม่เสมอ ตามที่ตัดสินใจไว้ใน continue-prompt รอบนี้):
 * quoteNo/publicToken (generate ใหม่ผ่าน addQuotation() เอง ไม่ส่งมาที่นี่เลย), status (บังคับ
 * "draft" เสมอ ไม่สนใจ status ต้นฉบับ — addQuotation() ตั้งให้เองอยู่แล้วด้วย แต่ระบุซ้ำที่นี่ให้
 * ชัดเจนว่าเป็นการตัดสินใจตั้งใจ ไม่ใช่ default เฉยๆ), validUntil (เคลียร์เป็นค่าว่างเสมอ — วัน
 * หมดอายุเดิมมักไม่สมเหตุสมผลกับใบร่างใหม่ที่เพิ่ง clone ให้แอดมินกรอกวันใหม่เองตอนแก้ฟอร์มก่อน
 * บันทึกจริง), requestId (null เสมอ — ฉบับร่างใหม่ไม่ได้มาจาก quote_request โดยตรง ต่างจาก
 * buildQuotationFromRequest()), customerResponse (ไม่มีทางมีอยู่แล้วในฉบับร่างใหม่ที่ยังไม่เคยส่ง
 * ให้ลูกค้าดูเลย)
 * @param {Object} quotation — เอกสาร quotation ต้นฉบับ (จาก allQuotations, มี id ติดมาด้วยแต่ไม่ใช้)
 * @returns {Object} payload พร้อมส่งต่อให้ addQuotation()
 */
export function buildQuotationClone(quotation) {
  const q = quotation || {};
  const items = Array.isArray(q.items) ? q.items.map(it => ({
    name:         (it && it.name) || "",
    variantLabel: (it && it.variantLabel) || "",
    qty:          (it && it.qty) || 1,
    unit:         (it && it.unit) || "",
    unitPrice:    (it && typeof it.unitPrice === "number") ? it.unitPrice : 0,
    discount:     (it && typeof it.discount === "number") ? it.discount : 0
  })) : [];

  return {
    requestId: null,
    billingName:      q.billingName || "",
    taxId:            q.taxId || "",
    billingAddress:   q.billingAddress || "",
    contactPerson:    q.contactPerson || "",
    phone:            q.phone || "",
    email:            q.email || "",
    shippingAddress:  q.shippingAddress || "",
    items,
    vatMode: ["included", "excluded", "none"].includes(q.vatMode) ? q.vatMode : "excluded",
    paymentTerms: q.paymentTerms || "",
    validUntil: "",
    notes: q.notes || "",
    status: "draft"
  };
}

/**
 * บันทึกใบเสนอราคาใหม่ลง Firestore collection "quotations" — จัดเลขที่เอกสารให้อัตโนมัติผ่าน
 * generateQuoteNo() เสมอ (ไม่รับ quoteNo จากผู้เรียก กันเลขซ้ำ/เลขปลอมหลุดเข้ามา) — คำนวณ
 * subtotal/vatAmount/grandTotal ใหม่จาก items ที่ sanitize แล้วเสมอ (ไม่เชื่อค่าที่ผู้เรียกส่งมา
 * ตรงๆ เหมือน lineTotal ต่อรายการด้านบน)
 * @param {Object} data — ฟิลด์ตาม buildQuotationFromRequest() หรือกรอกเองจากศูนย์ก็ได้
 *   (requestId/billingName/taxId/billingAddress/contactPerson/phone/email/shippingAddress/
 *   items/vatMode/paymentTerms/validUntil/notes) — status เริ่มต้นเป็น "draft" เสมอ
 * @returns {Promise<{id:string, quoteNo:string, publicToken:string}>}
 */
export async function addQuotation(data) {
  const quoteNo = await generateQuoteNo();
  const publicToken = buildPublicToken();
  const sanitizedItems = Array.isArray(data.items) ? data.items.map(sanitizeQuotationItem).filter(Boolean) : [];
  const vatMode = ["included", "excluded", "none"].includes(data.vatMode) ? data.vatMode : "excluded";
  const totals = computeQuotationTotals(sanitizedItems, vatMode);

  const payload = {
    quoteNo,
    publicToken,
    requestId:        data.requestId || null,
    billingName:      data.billingName || "",
    taxId:            data.taxId || "",
    billingAddress:   data.billingAddress || "",
    contactPerson:    data.contactPerson || "",
    phone:            data.phone || "",
    email:            data.email || "",
    shippingAddress:  data.shippingAddress || "",
    items: sanitizedItems,
    subtotal: totals.subtotal,
    vatMode,
    vatAmount: totals.vatAmount,
    grandTotal: totals.grandTotal,
    paymentTerms: data.paymentTerms || "",
    validUntil: data.validUntil || "",
    notes: data.notes || "",
    status: "draft",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: auth.currentUser ? auth.currentUser.uid : null
  };

  const ref = await addDoc(collection(db, "quotations"), payload);
  await upsertQuotationPublic(payload, ref.id);
  if (payload.requestId) await linkQuotationToRequest(payload.requestId, ref.id, publicToken);
  return { id: ref.id, quoteNo, publicToken };
}

/**
 * ฝังลิงก์ใบเสนอราคาที่เพิ่งออกกลับไปที่เอกสารคำขอเดิม "quote_requests/{requestId}" — ให้
 * listenMyQuoteRequests() (js/db-quote-requests.js) ที่ลูกค้าอ่านคำขอของตัวเองอยู่แล้วเห็นด้วยว่า
 * คำขอนี้ "ออกใบเสนอราคาให้แล้ว" + มีลิงก์ไปหน้า public ทันที โดยไม่ต้องเปิดสิทธิ์ query
 * collection "quotations" ให้ลูกค้าเพิ่ม (ดูเหตุผลเต็มในคอมเมนต์หัวไฟล์หัวข้อ "P3.0 Phase 5
 * (รอบ 7 ...)") — เรียกจาก addQuotation() เท่านั้น ทุกครั้งที่ requestId มากับ payload
 * (ไม่ export ให้เรียกตรงจาก UI อื่น เพราะต้องคู่กับการสร้างใบเสนอราคาจริงเสมอ — ยกเว้น export
 * ไว้เพื่อให้ทดสอบตรงๆ ได้ด้วย ตาม pattern ฟังก์ชันย่อยอื่นในไฟล์นี้ เช่น buildPublicToken())
 * ล้มเหลวแบบเงียบๆ (ไม่ throw ต่อ) — ไม่ให้บล็อกการสร้างใบเสนอราคาหลักที่สำเร็จไปแล้ว
 * @param {string} requestId — doc id ของ quote_requests ต้นทาง
 * @param {string} quotationId — doc id จริงใน "quotations" ที่เพิ่งสร้าง
 * @param {string} publicToken — publicToken ของใบเสนอราคานั้น (ใช้สร้างลิงก์
 *   quotation-view.html?token=...)
 * @returns {Promise<void>}
 */
export async function linkQuotationToRequest(requestId, quotationId, publicToken) {
  if (!requestId || typeof requestId !== "string") return;
  try {
    await updateDoc(doc(db, "quote_requests", requestId), {
      quotationId: quotationId || "",
      quotePublicToken: publicToken || "",
      status: "quoted"
    });
  } catch (err) {
    console.warn("linkQuotationToRequest: ฝังลิงก์กลับไปที่ quote_requests ไม่สำเร็จ", requestId, err);
  }
}

/**
 * แก้ไขใบเสนอราคาที่มีอยู่แล้ว — ถ้า patch มี items และ/หรือ vatMode มาด้วย คำนวณ
 * subtotal/vatAmount/grandTotal ใหม่เสมอ (ต้องส่ง items เต็มชุดถ้าจะแก้ ไม่ใช่ diff เดียว —
 * เหมือน pattern การแก้ items ทั้งก้อนของ orders/leads เดิมในโปรเจกต์นี้)
 * แก้แล้วยังซิงก์สำเนา public (quotation_public/{publicToken}) ให้ตรงกันเสมอด้วย (อ่านเอกสาร
 * เดิมก่อนเพื่อได้ publicToken + field อื่นที่ patch ไม่ได้แตะมาประกอบเป็นสำเนาเต็ม — pattern
 * เดียวกับ updateOrder()/upsertOrderTracking() ใน js/db-orders.js เป๊ะ)
 * @param {string} id
 * @param {Object} patch — field ใดก็ได้ในหัวข้อ data model (ยกเว้น quoteNo/publicToken/
 *   createdAt/createdBy ที่ห้ามแก้หลังสร้างแล้ว — ผู้เรียกส่งมาก็จะถูกละทิ้งเงียบๆ ที่นี่)
 */
export async function updateQuotation(id, patch) {
  const { quoteNo, publicToken, createdAt, createdBy, ...rest } = patch || {};
  const payload = { ...rest, updatedAt: serverTimestamp() };

  if ("items" in payload || "vatMode" in payload) {
    const sanitizedItems = Array.isArray(payload.items) ? payload.items.map(sanitizeQuotationItem).filter(Boolean) : [];
    const vatMode = ["included", "excluded", "none"].includes(payload.vatMode) ? payload.vatMode : "excluded";
    const totals = computeQuotationTotals(sanitizedItems, vatMode);
    payload.items = sanitizedItems;
    payload.vatMode = vatMode;
    payload.subtotal = totals.subtotal;
    payload.vatAmount = totals.vatAmount;
    payload.grandTotal = totals.grandTotal;
  }
  if ("status" in payload && !QUOTATION_STATUSES.includes(payload.status)) {
    delete payload.status; // ค่าสถานะแปลกปลอม → ไม่แก้ (ทิ้งเงียบๆ แทน throw กันฟอร์มพังทั้งก้อน)
  }

  const ref = doc(db, "quotations", id);
  const existingSnap = await getDoc(ref);
  const existing = existingSnap.exists() ? existingSnap.data() : {};
  const merged = { ...existing, ...payload };

  await updateDoc(ref, payload);
  // ส่ง existing.customerResponse ต่อไปด้วยเสมอ (ถ้ามี) กันสำเนา public "ลืม" ว่าลูกค้าเคยตอบรับ/
  // ขอแก้ไขไปแล้ว (ดูคอมเมนต์หัว upsertQuotationPublic()) — patch จาก UI แอดมินตอนนี้ยังไม่มีทางแก้
  // customerResponse ได้เอง (ไม่อยู่ใน field ที่ฟอร์มแอดมินกรอก) จึงใช้ค่าจาก existing ตรงๆ ได้เลย
  await upsertQuotationPublic(merged, id, existing.customerResponse);
}

/** ลบใบเสนอราคา + สำเนา public คู่กัน (ถ้ามี publicToken — เอกสารเก่าก่อนรอบนี้อาจยังไม่มี) */
export async function deleteQuotation(id) {
  const ref = doc(db, "quotations", id);
  const snap = await getDoc(ref);
  const publicToken = snap.exists() ? (snap.data().publicToken || null) : null;
  await deleteDoc(ref);
  if (publicToken) await removeQuotationPublic(publicToken);
}

/** อ่านครั้งเดียว เรียงตามวันที่สร้างล่าสุดก่อน — สำหรับแท็บ "ใบเสนอราคา" ในแอดมิน */
export async function getQuotations() {
  const q = query(collection(db, "quotations"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/** realtime listener แบบเดียวกับ listenOrders()/listenLeads() ใน js/db-orders.js เป๊ะ */
export function listenQuotations(callback, onError) {
  const q = query(collection(db, "quotations"), orderBy("createdAt", "desc"));
  return onSnapshot(
    q,
    snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    err => { if (onError) onError(err); else console.error("listenQuotations error:", err); }
  );
}
