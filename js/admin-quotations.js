// ===========================
// js/admin-quotations.js — แท็บ "ใบเสนอราคา" (แอดมิน) — P3.0 Phase 3 รอบย่อย 2 + 4 + 5
//
// P3.0 Phase 6 รอบ 12 (continue-prompt-p3.0-phase6-round12.md, ฟีเจอร์สุดท้ายของ Phase 6): เพิ่ม
// ปุ่ม "ส่งออก CSV" (ad-q-export-csv-btn) ใน toolbar — export allQuotations ทั้งหมดตรงๆ (แท็บนี้
// ยังไม่มีระบบ filter/search เหมือนแท็บออเดอร์ — ยืนยันจากโค้ดจริงแล้วก่อนเขียน ไม่มี searchInput/
// statusFilterValue ในไฟล์นี้เลย) — reuse pattern Blob/BOM/csvCell() จาก js/orders-tab-export.js
// ทุกจุด แต่ copy ฟังก์ชัน helper (csvCell()) มาไว้ในไฟล์นี้ตรงๆ แทนการ import ข้ามไฟล์ (ตรวจแล้วว่า
// js/orders-tab-export.js ไม่ได้ export อะไรเลยสักตัว เป็น side-effect module ล้วนๆ — ถ้าจะแก้ไฟล์
// นั้นเพิ่ม export จะกลายเป็นแตะ 3 ไฟล์ ยังอยู่ในเพดานแต่ copy สั้นกว่าและไม่กระทบไฟล์เดิมที่ทำงานอยู่
// แล้ว) — คอลัมน์: เลขที่เอกสาร/วันที่สร้าง(ISO YYYY-MM-DD แยกจาก quotationDateLabel() ที่ใช้ในตาราง
// เพราะ CSV ควรได้ format วันที่ล้วนๆ ไม่ใช่ toLocaleString เต็มรูปแบบ)/ชื่อลูกค้า/ยอดสุทธิ/สถานะ
// (แปลผ่าน QUOTATION_STATUS_LABEL)/วันหมดอายุ (validUntil ดิบ เป็น "YYYY-MM-DD" อยู่แล้วจาก input
// type="date" ในฟอร์ม ไม่ต้องแปลงซ้ำ)
//
// P3.0 Phase 6 รอบ 11 (continue-prompt-p3.0-phase6-round11.md): เพิ่มปุ่มไอคอน "คัดลอกเป็นฉบับ
// ร่างใหม่" ต่อแถว (data-action="clone") — เปิด openQuotationFormFromClone() (js/admin-quotations-
// form.js) ให้แอดมินตรวจ/แก้ก่อนกดบันทึกจริง ไม่บันทึกอัตโนมัติทันที (กันคัดลอกผิดโดยไม่ตั้งใจ)
//
// รอบย่อย 5 (continue-prompt-p3.0-phase3-round5.md): ปุ่ม "สร้างจากคำขอ"
// (ad-q-add-from-request-btn) ใช้งานได้จริงแล้ว — เปิดโมดัลเลือก quote_request
// (ad-qr-overlay) ที่กรองคำขอซึ่งแปลงเป็นใบเสนอราคาไปแล้วออก (เทียบ requestId กับ
// allQuotations ที่โหลดอยู่แล้ว ไม่ query เพิ่ม) — เลือกคำขอแล้วเรียก
// openQuotationFormFromRequest(request) (js/admin-quotations-form.js) — เพิ่ม
// startQuoteRequestsListener() เรียกจากภายใน startQuotationsListener() เอง (ไม่แก้
// admin-page.js เพิ่ม — ดูเหตุผลที่ฟังก์ชันนั้น)
//
// รอบย่อย 4: ผูกปุ่ม "สร้างใบเสนอราคาใหม่" (ad-q-add-btn) เข้ากับ openNewQuotationForm() จริง
// + เพิ่มปุ่ม "แก้ไข" ต่อแถว (เรียก openEditQuotationForm(item)) — ทั้งคู่ import จาก
// js/admin-quotations-form.js
//
// ใช้ realtime listener (listenQuotations จาก js/db-quotations.js) เริ่มครั้งเดียวตอน
// login สำเร็จ — pattern เดียวกับ startLeadsListener() ใน js/admin-leads.js เป๊ะ (listener
// เดียว ไม่หยุดตอนสลับแท็บ ไม่ต้อง stop ตอน logout เพราะหน้าเว็บ reload ใหม่ทุกครั้งที่
// login ใหม่อยู่แล้ว — สอดคล้องกับที่ leads ทำ ไม่ได้ stop เหมือน orders ที่มี stopOrdersTab())
//
// ปุ่มลบใช้ deleteWithUndo() pattern เดียวกับ admin-blog.js — firestore.rules
// บังคับ isAdminRole() สำหรับ collection "quotations" (ดู firestore.rules
// match /quotations/{id} → allow delete: if isAdminRole()) เหมือนทุกคอลเลกชันอื่นในโปรเจกต์
// นี้ (products/portfolios/blogs/leads/categories/groups/faqs/staff
// ก็ isAdminRole() ทั้งหมด) — ไม่ต้องเช็ค role ฝั่ง client เพิ่มเป็นพิเศษ ตาม pattern เดิม
// ทุกแท็บ (ถ้า login เป็น role อื่นที่ไม่ใช่ admin แล้วกดลบ Firestore จะ reject เอง
// deleteWithUndo() catch แล้วโชว์ toast "ลบไม่สำเร็จ" ให้อยู่แล้ว)
// ===========================
import { listenQuotations, deleteQuotation } from "./db-quotations.js";
import { listenAllQuoteRequests, deleteQuoteRequest } from "./db-quote-requests.js";
import { formatBaht } from "./orders-tab.js";
import { confirmDialog, errorStateHTML } from "./ui-helpers.js";
import { escapeHtml, deleteWithUndo, showToast, openOverlay, closeOverlay } from "./admin-utils.js";
import { openNewQuotationForm, openEditQuotationForm, openQuotationFormFromRequest, openQuotationFormFromClone } from "./admin-quotations-form.js";

export const qTableBody = document.getElementById("ad-q-table-body");
const qAddBtn      = document.getElementById("ad-q-add-btn");
const qAddFromReqBtn = document.getElementById("ad-q-add-from-request-btn");
const qExportCsvBtn = document.getElementById("ad-q-export-csv-btn");
const qrOverlay    = document.getElementById("ad-qr-overlay");
const qrListBody   = document.getElementById("ad-qr-list-body");
const qrCancelBtn  = document.getElementById("ad-qr-cancel");

export let allQuotations = [];
export const pendingDeleteQuotationIds = new Set();
// รายการคำขอใบเสนอราคาทั้งหมด (quote_requests, ไม่กรอง lineUserId) — โหลดผ่าน
// listenAllQuoteRequests() ตอน startQuotationsListener() ครั้งแรก — ใช้แค่ในโมดัลเลือกคำขอ
// ด้านล่าง (ad-qr-overlay) ยังไม่ export เพราะยังไม่มีไฟล์อื่นต้องใช้
let allQuoteRequests = [];
// ปุ่มลบคำขอใบเสนอราคาในโมดัลเลือกคำขอ ใช้ pattern deleteWithUndo() เดียวกับตารางใบเสนอราคาหลัก
// ด้านบน (Set ของตัวเอง แยกจาก pendingDeleteQuotationIds เพราะคนละรายการ/คนละคอลเลกชัน)
const pendingDeleteQuoteRequestIds = new Set();

let quotationsStarted = false;
let quotationsUnsub = null;
let quoteRequestsStarted = false;
let quoteRequestsUnsub = null;

/** ป้ายชื่อสถานะภาษาไทยของใบเสนอราคา — คนละชุดกับสถานะคำสั่งผลิต/ลีด (ดู
 *  QUOTATION_STATUSES ใน js/db-quotations.js) เก็บไว้ที่นี่เพราะใช้แค่ไฟล์นี้ไฟล์เดียว */
export const QUOTATION_STATUS_LABEL = {
  draft:    "ร่าง",
  sent:     "ส่งลูกค้าแล้ว",
  accepted: "ลูกค้าตอบรับ",
  rejected: "ลูกค้าปฏิเสธ",
  expired:  "หมดอายุ",
  changes_requested: "ลูกค้าขอแก้ไข"
};

// ── Badge ใกล้หมดอายุ/หมดอายุแล้ว (P3.0 Phase 6) ─────────────────────────────────────────
// คำนวณฝั่ง client ล้วนๆ ไม่มี cron/scheduled function (ฟรีทั้งหมดตามกติกาโปรเจกต์) — เทียบ
// validUntil (สตริง "YYYY-MM-DD" จาก input type="date" ในฟอร์มแอดมิน, ดู
// js/admin-quotations-form.js) กับวันนี้ทุกครั้งที่ renderQuotations() ทำงาน (ทุกครั้งที่
// listener ยิง snapshot ใหม่ — ไม่ cache เพราะ "วันนี้" เปลี่ยนได้เองแค่เปิดค้างข้ามวัน แต่ยอมรับ
// ว่าถ้าเปิดหน้าค้างไว้ข้ามเที่ยงคืนโดยไม่มี snapshot ใหม่มา badge จะไม่ขยับจนกว่าจะมีการ
// เปลี่ยนแปลงข้อมูลกระตุ้น re-render รอบถัดไป — ยอมรับได้เพราะไม่ใช่ระบบเรียลไทม์นาที/ชั่วโมง)
const EXPIRY_WARNING_DAYS = 7;
// สถานะที่ยัง "มีชีวิต" อยู่ ต้องเตือนวันหมดอายุ — เอกสารที่แอดมิน/ลูกค้าปิดผลไปแล้ว
// (accepted/rejected/expired) ไม่ต้องเตือนซ้ำเพราะรู้ผลอยู่แล้ว ไม่ใช่ "ใกล้จะพลาด" อีกต่อไป
const EXPIRY_ACTIVE_STATUSES = new Set(["draft", "sent", "changes_requested"]);

/** คืน { label, css } ถ้าควรโชว์ badge เตือนหมดอายุ หรือ null ถ้าไม่ควรโชว์ (ไม่มี validUntil,
 *  validUntil parse ไม่ได้, หรือ status ปิดผลไปแล้ว) — css ใช้ค่า data-status ที่มี CSS อยู่แล้วจาก
 *  css/console.css (.cp-status-badge[data-status="rejected"] สีแดง /
 *  .cp-status-badge[data-status="approval"] สีเหลือง) reuse ของเดิม ไม่เพิ่ม CSS ใหม่รอบนี้
 * @param {string} validUntil — "YYYY-MM-DD" หรือสตริงว่าง
 * @param {string} status
 * @param {Date} [now] — inject ได้สำหรับเทส (pattern เดียวกับ monthBuckets() ใน js/stats-trends.js)
 */
export function quotationExpiryBadge(validUntil, status, now = new Date()) {
  if (!validUntil || !EXPIRY_ACTIVE_STATUSES.has(status)) return null;
  const dueMs = Date.parse(validUntil);
  if (Number.isNaN(dueMs)) return null;
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const due = new Date(dueMs);
  const dueStart = new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime();
  const diffDays = Math.round((dueStart - todayStart) / 86400000);
  if (diffDays < 0) return { label: "หมดอายุแล้ว", css: "rejected" };
  if (diffDays <= EXPIRY_WARNING_DAYS) return { label: "ใกล้หมดอายุ", css: "approval" };
  return null;
}

/** เริ่ม realtime listener ครั้งเดียว — เรียกจาก admin-page.js ตอน login สำเร็จ
 *  (เหมือน startLeadsListener()) — เรียกซ้ำได้ปลอดภัย (guard ด้วย quotationsStarted) */
export function startQuotationsListener() {
  if (quotationsStarted) return;
  quotationsStarted = true;
  quotationsUnsub = listenQuotations(
    (quotations) => {
      allQuotations = quotations;
      renderQuotations();
    },
    (err) => {
      qTableBody.innerHTML = `<tr><td colspan="5">${errorStateHTML(`โหลดข้อมูลไม่สำเร็จ: ${err.message || ""}`, retryQuotationsListener, { wrapTag: "span" })}</td></tr>`;
    }
  );
  startQuoteRequestsListener();
}

// เรียกใหม่เมื่อกดปุ่ม "ลองใหม่" ตอนโหลดล้มเหลว — เลิกฟัง listener เดิม (ถ้ามี) แล้วเริ่มใหม่
// โดยไม่ต้อง refresh ทั้งหน้า (pattern เดียวกับ retryLeadsListener() ใน admin-leads.js)
function retryQuotationsListener() {
  if (quotationsUnsub) { quotationsUnsub(); quotationsUnsub = null; }
  quotationsStarted = false;
  startQuotationsListener();
}

// เริ่ม realtime listener ของ quote_requests ครั้งเดียว — เรียกจากภายใน
// startQuotationsListener() ด้านบนโดยตรง (ไม่ export แยกให้ admin-page.js เรียกเอง เพื่อไม่ต้อง
// แก้ไฟล์นั้นเพิ่ม — ตัดสินใจตามเพดาน 2-3 ไฟล์/รอบ ดู REFACTOR-PROGRESS.md รอบนี้) — ใช้แค่เป็น
// ข้อมูลให้โมดัลเลือกคำขอด้านล่าง ไม่ต้อง re-render ตารางหลักเมื่อเปลี่ยน (คนละตารางกัน)
function startQuoteRequestsListener() {
  if (quoteRequestsStarted) return;
  quoteRequestsStarted = true;
  quoteRequestsUnsub = listenAllQuoteRequests(
    (requests) => {
      allQuoteRequests = requests;
      // ถ้าโมดัลเลือกคำขอเปิดอยู่พอดี ให้ render ใหม่ทันที (เช่น มีคำขอใหม่เข้ามา หรือแอดมิน
      // อีกคนลบคำขอไปพร้อมกัน) — ไม่ re-render ตารางหลักเหมือนเดิม (คนละตารางกัน)
      if (qrOverlay && qrOverlay.style.display !== "none") renderQuoteRequestPicker();
    },
    (err) => { console.error("listenAllQuoteRequests error:", err); }
  );
}

// ── ปุ่ม "คัดลอกลิงก์" ต่อแถว (P3.0 Phase 4 รอบ 3) ──────────────────────────────────────
// คัดลอกลิงก์ public (quotation-view.html?token=...) ให้แอดมินส่งให้ลูกค้าเอง — ใช้
// navigator.clipboard.writeText() ตรงๆ (pattern เดียวกับ js/track-modal.js บรรทัดปุ่มคัดลอก
// เลขพัสดุ — ไม่ต้องมี fallback execCommand เหมือน js/main-effects.js เพราะแอดมินใช้เบราว์เซอร์
// สมัยใหม่แน่นอน ต่างจากหน้าเว็บสาธารณะที่ต้องรองรับผู้เยี่ยมชมทั่วไป) — feedback ผ่าน
// showToast() ที่ import อยู่แล้วในไฟล์นี้ — เอกสารเก่าก่อน Phase 4 ที่ไม่มี publicToken ปุ่มถูก
// ปิด (disabled) ไว้ตั้งแต่ renderQuotations() ด้านล่างแล้ว (เห็นแต่กดไม่ได้ พร้อม title อธิบาย
// เหตุผล) — ยังกันซ้ำอีกชั้นในฟังก์ชันนี้เผื่อกรณี edge case (data เปลี่ยนระหว่างที่ปุ่มยัง
// enabled ค้างอยู่ใน DOM เก่า)
function quotationPublicUrl(item) {
  return `${window.location.origin}/quotation-view.html?token=${encodeURIComponent(item.publicToken)}`;
}

function copyQuotationPublicLink(item) {
  if (!item.publicToken) {
    showToast("ใบเสนอราคานี้ยังไม่มีลิงก์สาธารณะ (สร้างก่อนอัปเดตระบบ Phase 4) — แก้ไขแล้วบันทึกใหม่อีกครั้งเพื่อสร้างลิงก์", "warn");
    return;
  }
  const url = quotationPublicUrl(item);
  if (!navigator.clipboard || !navigator.clipboard.writeText) {
    showToast("เบราว์เซอร์นี้ไม่รองรับการคัดลอกอัตโนมัติ — คัดลอกลิงก์เอง: " + url, "warn");
    return;
  }
  navigator.clipboard.writeText(url)
    .then(() => showToast("คัดลอกลิงก์ใบเสนอราคาแล้ว", "success"))
    .catch(() => showToast("คัดลอกลิงก์ไม่สำเร็จ กรุณาลองใหม่", "error"));
}

// ── ปุ่ม "ดูใบเสนอราคา" ต่อแถว ── เปิดหน้า public (quotation-view.html) ในแท็บใหม่ทันที
// ให้แอดมินดูหน้าตาเอกสารจริงที่ลูกค้าเห็น โดยไม่ต้องคัดลอกลิงก์ไปวางเองอีกต่อไป
function viewQuotationPublic(item) {
  if (!item.publicToken) {
    showToast("ใบเสนอราคานี้ยังไม่มีลิงก์สาธารณะ (สร้างก่อนอัปเดตระบบ Phase 4) — แก้ไขแล้วบันทึกใหม่อีกครั้งเพื่อสร้างลิงก์", "warn");
    return;
  }
  window.open(quotationPublicUrl(item), "_blank", "noopener");
}

function quotationDateLabel(q) {
  const ts = q.createdAt;
  if (!ts) return "—";
  const ms = ts.toMillis ? ts.toMillis() : (typeof ts === "number" ? ts : null);
  if (!ms) return "—";
  return new Date(ms).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" });
}

// ── ส่งออก CSV (P3.0 Phase 6 รอบ 12) ────────────────────────────────────────────────────
// วันที่สร้างของ CSV แยกจาก quotationDateLabel() ด้านบน (ใช้กับตารางในหน้าเว็บ) — CSV ควรได้
// ISO date ล้วนๆ "YYYY-MM-DD" ไม่ใช่ toLocaleString() เต็มรูปแบบพร้อมเวลา (เปิดใน Excel/Sheets
// แล้วเรียง/กรองวันที่ได้ง่ายกว่า)
function quotationCsvDateLabel(q) {
  const ts = q.createdAt;
  if (!ts) return "";
  const ms = ts.toMillis ? ts.toMillis() : (typeof ts === "number" ? ts : null);
  if (!ms) return "";
  return new Date(ms).toISOString().slice(0, 10);
}

// escape เซลล์ CSV — pattern เดียวกับ csvCell() ใน js/orders-tab-export.js เป๊ะ (ไฟล์นั้นไม่ export
// อะไรเลย จึง copy ฟังก์ชันสั้นๆนี้มาไว้ในไฟล์นี้ตรงๆ แทนการแก้ไฟล์นั้นเพิ่ม export)
function csvCell(val) {
  const s = String(val ?? "");
  return `"${s.replace(/"/g, '""')}"`;
}

/** ส่งออกใบเสนอราคาทั้งหมด (allQuotations) เป็นไฟล์ CSV ดาวน์โหลด — แท็บนี้ยังไม่มีระบบ filter/
 *  search จึง export allQuotations ตรงๆ ทั้งหมด ไม่กรองอะไรก่อน (ต่างจาก getCurrentFilteredRows()
 *  ของแท็บออเดอร์) — pattern Blob/BOM/URL.createObjectURL() เดียวกับ js/orders-tab-export.js */
function exportQuotationsCSV() {
  if (!allQuotations.length) { showToast("ไม่มีข้อมูลให้ส่งออก", "error"); return; }
  const headers = ["เลขที่เอกสาร","วันที่สร้าง","ลูกค้า","ยอดสุทธิ (บาท)","สถานะ","วันหมดอายุ"];
  const csvRows = [headers.join(",")];
  allQuotations.forEach(q => {
    const status = q.status || "draft";
    csvRows.push([
      csvCell(q.quoteNo), csvCell(quotationCsvDateLabel(q)),
      csvCell(q.billingName || q.contactPerson), q.grandTotal ?? 0,
      csvCell(QUOTATION_STATUS_LABEL[status] || status), csvCell(q.validUntil)
    ].join(","));
  });
  const blob = new Blob(["\uFEFF" + csvRows.join("\r\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `quotations-${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast("ส่งออก CSV แล้ว", "success");
}

if (qExportCsvBtn) qExportCsvBtn.addEventListener("click", exportQuotationsCSV);

export function renderQuotations() {
  const filtered = allQuotations.filter(q => !pendingDeleteQuotationIds.has(q.id));

  // colspan แก้จาก 5 เป็น 6 (P3.0 Phase 6) — ตาราง <thead> จริงใน admin.html มี 6 คอลัมน์
  // (วันที่/เลขที่เอกสาร/ลูกค้า/ยอดสุทธิ/สถานะ/action) ตรงกับ skeleton row ที่ colspan="6" อยู่แล้ว
  // — colspan="5" เดิมตรงนี้เป็นบั๊กเดิมที่ค้างมาก่อนรอบนี้ (ไม่กระทบการแสดงผลจริงเพราะ browser
  // ยอมรับ colspan สั้นกว่าจำนวนคอลัมน์จริงได้เงียบๆ แค่กว้างไม่เต็มแถว) เจอระหว่างแก้ไฟล์นี้
  // รอบนี้พอดี เลยแก้ไปด้วยเลย (บันทึกไว้ใน REFACTOR-PROGRESS.md)
  if (!allQuotations.length) {
    qTableBody.innerHTML = `<tr><td colspan="6" class="cp-empty">ยังไม่มีใบเสนอราคา — กด "สร้างใบเสนอราคาใหม่" ด้านบนเพื่อเริ่มต้น</td></tr>`;
    return;
  }
  if (!filtered.length) {
    qTableBody.innerHTML = `<tr><td colspan="6" class="cp-empty">ไม่พบใบเสนอราคา</td></tr>`;
    return;
  }

  qTableBody.innerHTML = filtered.map(q => {
    const customerName = q.billingName || q.contactPerson || "—";
    const status = q.status || "draft";
    const statusLabel = QUOTATION_STATUS_LABEL[status] || status;
    const hasPublicToken = !!q.publicToken;
    // badge เตือนหมดอายุ (P3.0 Phase 6) — ต่อท้าย badge สถานะหลักในคอลัมน์เดียวกัน ไม่เพิ่มคอลัมน์
    // ใหม่ (กระทบ colspan/เทสเดิมน้อยกว่า)
    const expiryBadge = quotationExpiryBadge(q.validUntil, status);
    const expiryBadgeHtml = expiryBadge
      ? ` <span class="cp-status-badge" data-status="${expiryBadge.css}" style="margin-left:4px;">${escapeHtml(expiryBadge.label)}</span>`
      : "";
    return `
      <tr data-id="${q.id}" class="cp-row-clickable" title="คลิกเพื่อดู/แก้ไขข้อมูลใบเสนอราคานี้">
        <td class="cp-subtext">${quotationDateLabel(q)}</td>
        <td>${escapeHtml(q.quoteNo || "—")}</td>
        <td>${escapeHtml(customerName)}</td>
        <td>${formatBaht(q.grandTotal)}</td>
        <td><span class="cp-status-badge" data-status="${escapeHtml(status)}">${escapeHtml(statusLabel)}</span>${expiryBadgeHtml}</td>
        <td>
          <div class="cp-row-actions">
            <button class="cp-icon-btn" data-action="view" title="${hasPublicToken ? "ดูใบเสนอราคา (เปิดหน้าที่ลูกค้าเห็น)" : "ใบเสนอราคานี้ยังไม่มีลิงก์สาธารณะ (สร้างก่อน Phase 4)"}" ${hasPublicToken ? "" : "disabled"}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z"/><circle cx="12" cy="12" r="3"/></svg></button>
            <button class="cp-icon-btn" data-action="copy-link" title="${hasPublicToken ? "คัดลอกลิงก์ให้ลูกค้า" : "ใบเสนอราคานี้ยังไม่มีลิงก์สาธารณะ (สร้างก่อน Phase 4)"}" ${hasPublicToken ? "" : "disabled"}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
            <button class="cp-icon-btn" data-action="clone" title="คัดลอกเป็นฉบับร่างใหม่"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="8" y="8" width="13" height="13" rx="2"/><path d="M4 16V4a2 2 0 0 1 2-2h10"/></svg></button>
            <button class="cp-icon-btn" data-action="edit" title="แก้ไข"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button>
            <button class="cp-icon-btn danger" data-action="delete" title="ลบ"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg></button>
          </div>
        </td>
      </tr>`;
  }).join("");
}

qTableBody.addEventListener("click", async (e) => {
  const row = e.target.closest("tr[data-id]");
  if (!row) return;
  const id = row.dataset.id;
  const item = allQuotations.find(q => q.id === id);
  if (!item) return;
  const btn = e.target.closest("button[data-action]");
  if (!btn) {
    // คลิกที่แถว (ไม่ใช่ปุ่ม) — เปิดข้อมูลใบเสนอราคาให้ดูทันที ไม่ต้องกดปุ่ม "แก้ไข" อีกขั้น
    // (ฟอร์มเดียวกันนี้แสดงข้อมูลครบทุกช่องอยู่แล้ว จึงใช้เป็นทั้งหน้าดู/แก้ไขในตัว
    // เหมือน pattern คลิกแถวของแท็บคำสั่งผลิต — ดู js/orders-tab.js)
    if (!row.classList.contains("cp-row-clickable")) return;
    openEditQuotationForm(item);
    return;
  }
  if (btn.dataset.action === "view") {
    viewQuotationPublic(item);
    return;
  }
  if (btn.dataset.action === "edit") {
    openEditQuotationForm(item);
    return;
  }
  if (btn.dataset.action === "copy-link") {
    copyQuotationPublicLink(item);
    return;
  }
  if (btn.dataset.action === "clone") {
    // เปิดฟอร์ม "คัดลอกเป็นฉบับร่างใหม่" ให้แอดมินตรวจ/แก้ก่อนกดบันทึกจริง (ไม่บันทึกอัตโนมัติ
    // ทันที กันคัดลอกผิดโดยไม่ตั้งใจ — P3.0 Phase 6 รอบ 11, ดู admin-quotations-form.js)
    openQuotationFormFromClone(item);
    return;
  }
  if (btn.dataset.action === "delete") {
    if (await confirmDialog(`ลบใบเสนอราคา "${item.quoteNo || ""}" ใช่หรือไม่?`, { title: "ลบใบเสนอราคา", danger: true })) {
      deleteWithUndo({
        pendingSet: pendingDeleteQuotationIds, id, renderFn: renderQuotations,
        message: `ลบใบเสนอราคา "${item.quoteNo || ""}" แล้ว`,
        deleteFn: () => deleteQuotation(id), targetType: "quotation"
      });
    }
  }
});

// ── โมดัลเลือกคำขอใบเสนอราคา (ปุ่ม "สร้างจากคำขอ", P3.0 Phase 3 รอบย่อย 5) ──────────────
// กรองคำขอที่ "แปลงเป็นใบเสนอราคาแล้ว" ออกจาก list ด้วยการเทียบ requestId กับ allQuotations
// ที่โหลดอยู่แล้วผ่าน listener หลักของไฟล์นี้ — ไม่ query เพิ่มเลย (ตามที่ continue-prompt แนะนำ)
function convertedRequestIds() {
  return new Set(allQuotations.map(q => q.requestId).filter(Boolean));
}

function quoteRequestDateLabel(r) {
  const ts = r.createdAt;
  const ms = ts && ts.toMillis ? ts.toMillis() : (typeof ts === "number" ? ts : null);
  if (!ms) return "—";
  return new Date(ms).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" });
}

function renderQuoteRequestPicker() {
  if (!qrListBody) return;
  const converted = convertedRequestIds();
  const available = allQuoteRequests.filter(r => !converted.has(r.id) && !pendingDeleteQuoteRequestIds.has(r.id));

  if (!available.length) {
    qrListBody.innerHTML = `<tr><td colspan="4" class="cp-empty">ไม่มีคำขอใบเสนอราคาที่ยังไม่ถูกแปลง — ลูกค้ายังไม่ส่งคำขอเข้ามา หรือแปลงเป็นใบเสนอราคาไปหมดแล้ว</td></tr>`;
    return;
  }

  qrListBody.innerHTML = available.map(r => {
    const customerName = r.billingName || r.contactPerson || "—";
    const itemCount = Array.isArray(r.items) ? r.items.length : 0;
    return `
      <tr data-id="${r.id}">
        <td class="cp-subtext">${quoteRequestDateLabel(r)}</td>
        <td>${escapeHtml(customerName)}</td>
        <td>${itemCount} รายการ</td>
        <td>
          <div class="cp-row-actions ad-qr-row-actions">
            <button type="button" class="btn btn-primary cl-btn ad-qr-use-btn" data-action="use">ใช้คำขอนี้</button>
            <button type="button" class="cp-icon-btn danger" data-action="delete" title="ลบคำขอนี้"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg></button>
          </div>
        </td>
      </tr>`;
  }).join("");
}

if (qrListBody) {
  qrListBody.addEventListener("click", async (e) => {
    const useBtn = e.target.closest('button[data-action="use"]');
    if (useBtn) {
      const row = useBtn.closest("tr[data-id]");
      const request = allQuoteRequests.find(r => r.id === row.dataset.id);
      if (!request) return;
      closeOverlay(qrOverlay);
      openQuotationFormFromRequest(request);
      return;
    }
    const delBtn = e.target.closest('button[data-action="delete"]');
    if (delBtn) {
      const row = delBtn.closest("tr[data-id]");
      const id = row.dataset.id;
      const request = allQuoteRequests.find(r => r.id === id);
      if (!request) return;
      const customerName = request.billingName || request.contactPerson || "";
      // ลบคำขอนี้ทิ้ง — เอกสารเดียวกับที่ลูกค้าเห็นใน "ใบเสนอราคาของฉัน" (my-account.html)
      // ลบครั้งนี้ครั้งเดียวก็หายไปจากฝั่งลูกค้าด้วยทันที (ดูคอมเมนต์ deleteQuoteRequest()
      // ใน js/db-quote-requests.js — คนละคอลเลกชันกับ "quotations"/"leads" จึงไม่กระทบข้อมูล
      // ใบเสนอราคาที่ออกไปแล้วหรือลีดอื่นในระบบ)
      if (await confirmDialog(`ลบคำขอใบเสนอราคาของ "${customerName}" ใช่หรือไม่? (ลูกค้าจะไม่เห็นคำขอนี้อีกต่อไป)`, { title: "ลบคำขอใบเสนอราคา", danger: true })) {
        deleteWithUndo({
          pendingSet: pendingDeleteQuoteRequestIds, id, renderFn: renderQuoteRequestPicker,
          message: `ลบคำขอใบเสนอราคาของ "${customerName}" แล้ว`,
          deleteFn: () => deleteQuoteRequest(id), targetType: "quote_request"
        });
      }
    }
  });
}
if (qrCancelBtn) qrCancelBtn.addEventListener("click", () => closeOverlay(qrOverlay));
if (qrOverlay) qrOverlay.addEventListener("click", (e) => { if (e.target === qrOverlay) closeOverlay(qrOverlay); });

// ปุ่ม "สร้างใบเสนอราคาใหม่" — เปิดฟอร์มเปล่าจริง — ปุ่ม "สร้างจากคำขอ" เปิดโมดัลเลือกคำขอจริง
// (รอบย่อย 5 — ก่อนหน้านี้เป็นแค่ placeholder toast)
if (qAddBtn) {
  qAddBtn.addEventListener("click", () => {
    openNewQuotationForm();
  });
}
if (qAddFromReqBtn) {
  qAddFromReqBtn.addEventListener("click", () => {
    if (!qrOverlay) {
      showToast('ฟอร์ม "สร้างจากคำขอ" ยังไม่พร้อมใช้งาน', "warn");
      return;
    }
    renderQuoteRequestPicker();
    openOverlay(qrOverlay);
  });
}
