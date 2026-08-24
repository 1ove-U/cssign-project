// ===========================
// js/admin-quotations-form.js — ฟอร์มสร้าง/แก้ไขใบเสนอราคาจริง (แอดมิน) — P3.0 Phase 3
// รอบย่อย 4 (openNewQuotationForm/openEditQuotationForm) + รอบย่อย 5
// (openQuotationFormFromRequest, ตาม continue-prompt-p3.0-phase3-round5.md)
//
// P3.0 Phase 6 (audit log ใบเสนอราคา — feature ที่ผู้ใช้ยืนยันหลัง Phase 6 หลักเสร็จ, ดู
// continue-prompt-p3.0-phase6-round12-cont.md): เพิ่ม logAudit("create"/"update","quotation",...)
// ใน submit handler ด้านล่าง — ลบ (deleteQuotation) ถูก log อยู่แล้วผ่าน deleteWithUndo() ใน
// js/admin-quotations.js (ส่ง targetType: "quotation" มาด้วยอยู่แล้วตั้งแต่ก่อนรอบนี้) จึงเหลือ
// แค่ create/update ที่ยังไม่มีการ log เลยสักจุด (ตรวจแล้วด้วย grep "logAudit" ทั้งไฟล์นี้ +
// js/db-quotations.js + js/admin-quotations.js ก่อนแก้ — ไม่มีการเรียกเลยสักที่) — ต่างจาก
// js/orders-tab-modal.js ที่ log แค่ "update" ไม่ log "create": ตัดสินใจให้ log ทั้ง 2 action
// สำหรับใบเสนอราคา เพราะเป็นเอกสารทางการเงินที่ควรตรวจสอบย้อนหลังได้ตั้งแต่ตอนออกเอกสารเลย —
// meta ที่บันทึกคือ billingName (ชื่อลูกค้า/บริษัท) ไม่ใช่ quoteNo เพราะตอน create ยัง generate
// quoteNo ไม่เสร็จจนกว่า addQuotation() จะ return กลับมา (ได้ id มาด้วยเลยใช้ id เป็น targetId
// แทน quoteNo — เทียบเคียง targetId เป็น doc id ตรงๆ เหมือนทุกจุดอื่นในโปรเจกต์นี้)
//
// P3.0 Phase 6 รอบ 11 (continue-prompt-p3.0-phase6-round11.md): เพิ่มโหมดที่ 4 —
// openQuotationFormFromClone() — "คัดลอกเป็นฉบับร่างใหม่" จากใบเสนอราคาที่มีอยู่แล้ว (ผ่าน
// buildQuotationClone() ใน js/db-quotations.js) — pattern เดียวกับ openQuotationFormFromRequest()
// เป๊ะ (editingId เป็น null เสมอ)
//
// ขอบเขต: เปิดฟอร์ม 4 โหมด — "สร้างใหม่" (เปล่า), "แก้ไข" (prefill รายการเดิม), "สร้างจากคำขอ"
// (prefill จาก quote_request ผ่าน buildQuotationFromRequest()), "คัดลอกเป็นฉบับร่างใหม่" (prefill
// จาก quotation เดิมผ่าน buildQuotationClone()) — 3 โหมดหลังนี้ editingId เป็น null เสมอ เพราะยัง
// นับเป็น "สร้างใหม่" ไม่ใช่แก้ไขของเดิม — เพิ่ม/ลบแถวรายการสินค้าได้ พร้อมคำนวณ
// lineTotal/subtotal/VAT/grandTotal สดทุกครั้งที่พิมพ์ — submit เรียก
// addQuotation()/updateQuotation() จริง (js/db-quotations.js) — listener realtime ใน
// admin-quotations.js จะ re-render ตารางเองอัตโนมัติ ไม่ต้อง reload มือ
//
// โมดัลเลือก quote_request ("สร้างจากคำขอ") อยู่ที่ js/admin-quotations.js (ad-qr-overlay) —
// ไฟล์นั้นเรียก openQuotationFormFromRequest(request) ที่นี่หลังผู้ใช้เลือกคำขอแล้ว —
// ไม่ import กลับมาที่ไฟล์นี้ (ทิศทาง import เดียว: admin-quotations.js → นำเข้าจากไฟล์นี้)
//
// รูปแบบโมดัลอ้างอิงจาก overlay/openOverlay/closeOverlay ธรรมดา (ไม่มีรายการย่อย) ที่ใช้ทั่วไป
// ในโปรเจกต์นี้ ผสมกับ
// รูปแบบ "เพิ่ม/ลบแถวได้" จาก js/admin-products-variant-table.js (แถวเก็บใน array state เดียว
// ของโมดูลนี้ แล้ว re-render ตารางทั้งก้อนทุกครั้งที่แถวเปลี่ยน — ไม่พยายามแก้ DOM ทีละ cell
// เพราะจำนวนแถวต่อใบเสนอราคาปกติไม่เยอะ re-render ทั้งก้อนเร็วพอ)
// ===========================
import { addQuotation, updateQuotation, computeQuotationTotals, buildQuotationFromRequest, buildQuotationClone } from "./db-quotations.js";
import { formatBaht } from "./orders-tab.js";
import { openOverlay, closeOverlay, showToast, escapeHtml } from "./admin-utils.js";
import { logAudit } from "./db.js";

const qOverlay    = document.getElementById("ad-q-overlay");
const qForm       = document.getElementById("ad-q-form");
const qModalTitle = document.getElementById("ad-q-modal-title");
const qCancelBtn  = document.getElementById("ad-q-cancel");
const qItemsBody  = document.getElementById("ad-q-items-body");
const qAddItemBtn = document.getElementById("ad-q-add-item");
const qSubtotalEl = document.getElementById("ad-q-subtotal");
const qVatEl      = document.getElementById("ad-q-vat");
const qGrandEl    = document.getElementById("ad-q-grandtotal");

// ── สลับหมวด/แท็บในป๊อปอัพ (ข้อมูลลูกค้า/รายการสินค้า/สรุปยอด & หมายเหตุ) ──
// แพทเทิร์นเดียวกับ switchProductTab() ใน js/admin-products-form.js — คัดลอกมาเฉพาะไฟล์นี้
// แทนการ import ข้ามไฟล์ เพราะ scope อยู่แค่ qForm ของฟอร์มนี้เท่านั้น ไม่มี state ร่วมกัน
function switchQuotationTab(tabName) {
  let activeTabBtn = null;
  qForm.querySelectorAll(".cp-od-tab").forEach(btn => {
    const isActive = btn.dataset.odTab === tabName;
    btn.classList.toggle("active", isActive);
    btn.setAttribute("aria-selected", isActive ? "true" : "false");
    if (isActive) activeTabBtn = btn;
  });
  qForm.querySelectorAll(".cp-od-panel").forEach(panel => {
    panel.classList.toggle("active", panel.dataset.odPanel === tabName);
  });
  if (activeTabBtn) activeTabBtn.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  qForm.scrollTop = 0;
}
qForm.querySelectorAll(".cp-od-tab").forEach(btn => {
  btn.addEventListener("click", () => switchQuotationTab(btn.dataset.odTab));
});

// โหมดปัจจุบัน — "new" (ยังไม่มี id) หรือ "edit" (มี id เดิม, submit เรียก updateQuotation())
let editingId = null;
// requestId ของ quote_request ต้นทาง (ถ้าเปิดจาก openQuotationFormFromRequest()) — ส่งติดไปกับ
// payload ตอน addQuotation() เพื่อให้ convertedRequestIds() ใน js/admin-quotations.js กรองคำขอนี้
// ออกจากโมดัลเลือกคำขอได้หลังสร้างใบเสนอราคาสำเร็จ — เป็น null เสมอถ้าสร้างเปล่า/แก้ไขของเดิม
let requestId = null;
// state รายการสินค้าของฟอร์มที่เปิดอยู่ตอนนี้ — array ของ { name, variantLabel, qty, unit,
// unitPrice, discount } (lineTotal คำนวณสดตอน render ไม่เก็บ state ซ้ำ กันหลุด sync)
let formItems = [];

function blankItem() {
  return { name: "", variantLabel: "", qty: 1, unit: "", unitPrice: 0, discount: 0 };
}

/** เปิดฟอร์มเปล่าสำหรับสร้างใบเสนอราคาใหม่จากศูนย์ */
export function openNewQuotationForm() {
  editingId = null;
  requestId = null;
  qModalTitle.textContent = "สร้างใบเสนอราคาใหม่";
  fillCustomerFields({});
  document.getElementById("ad-q-status").value = "draft";
  formItems = [blankItem()];
  renderItems();
  switchQuotationTab("customer"); // เปิดฟอร์มมาที่แท็บแรกเสมอ (ป๊อปอัพไม่ได้ถูกสร้างใหม่ทุกครั้ง แค่ toggle display)
  openOverlay(qOverlay);
}

/** เปิดฟอร์มแก้ไขใบเสนอราคาที่มีอยู่แล้ว — prefill ทุกฟิลด์จากเอกสารเดิม
 * @param {Object} quotation — เอกสารจาก allQuotations (มี id ติดมาด้วย) */
export function openEditQuotationForm(quotation) {
  const q = quotation || {};
  editingId = q.id || null;
  requestId = q.requestId || null;
  qModalTitle.textContent = `แก้ไขใบเสนอราคา ${q.quoteNo || ""}`;
  fillCustomerFields(q);
  document.getElementById("ad-q-status").value = q.status || "draft";
  formItems = Array.isArray(q.items) && q.items.length
    ? q.items.map(it => ({
        name: it.name || "", variantLabel: it.variantLabel || "",
        qty: it.qty || 1, unit: it.unit || "",
        unitPrice: it.unitPrice || 0, discount: it.discount || 0
      }))
    : [blankItem()];
  renderItems();
  switchQuotationTab("customer"); // เปิดฟอร์มมาที่แท็บแรกเสมอ (ป๊อปอัพไม่ได้ถูกสร้างใหม่ทุกครั้ง แค่ toggle display)
  openOverlay(qOverlay);
}

/** เปิดฟอร์ม "สร้างจากคำขอ" (P3.0 Phase 3 รอบย่อย 5) — prefill จาก quote_request ที่ลูกค้าส่งมา
 * ผ่าน buildQuotationFromRequest() (js/db-quotations.js, pure function) — editingId ต้องเป็น
 * null เสมอ (ต่างจาก openEditQuotationForm() ด้านบน) เพราะนี่คือ "สร้างใบเสนอราคาใหม่" ที่แค่เอา
 * ข้อมูลลูกค้า/รายการสินค้าจาก request มาช่วยกรอกให้ ไม่ใช่การแก้ไข quotation ที่มีอยู่แล้ว —
 * submit จะเรียก addQuotation() (พร้อม requestId ติดไปด้วยจาก buildQuotationFromRequest())
 * ไม่ใช่ updateQuotation()
 * @param {Object} request — เอกสาร quote_request (มี id ติดมาด้วย) จาก allQuoteRequests ใน
 *   js/admin-quotations.js */
export function openQuotationFormFromRequest(request) {
  const built = buildQuotationFromRequest(request);
  editingId = null;
  qModalTitle.textContent = "สร้างใบเสนอราคาจากคำขอ";
  fillCustomerFields(built);
  document.getElementById("ad-q-status").value = "draft";
  formItems = Array.isArray(built.items) && built.items.length
    ? built.items.map(it => ({
        name: it.name || "", variantLabel: it.variantLabel || "",
        qty: it.qty || 1, unit: it.unit || "",
        unitPrice: it.unitPrice || 0, discount: it.discount || 0
      }))
    : [blankItem()];
  requestId = built.requestId || null;
  renderItems();
  switchQuotationTab("customer"); // เปิดฟอร์มมาที่แท็บแรกเสมอ (ป๊อปอัพไม่ได้ถูกสร้างใหม่ทุกครั้ง แค่ toggle display)
  openOverlay(qOverlay);
}

/** เปิดฟอร์ม "คัดลอกเป็นฉบับร่างใหม่" (P3.0 Phase 6, ดู
 * continue-prompt-p3.0-phase6-round11.md หัวข้อ "Clone ใบเสนอราคาเป็นฉบับร่างใหม่") — prefill
 * จากใบเสนอราคาที่มีอยู่แล้วผ่าน buildQuotationClone() (js/db-quotations.js, pure function) —
 * editingId ต้องเป็น null เสมอ (pattern เดียวกับ openQuotationFormFromRequest() ด้านบนเป๊ะ)
 * เพราะนี่คือ "สร้างใบเสนอราคาใหม่" ไม่ใช่แก้ไขของเดิม — เปิดฟอร์มให้แอดมินตรวจ/แก้ก่อนกดบันทึกจริง
 * (ไม่บันทึกอัตโนมัติทันทีที่กดปุ่ม "คัดลอกเป็นฉบับร่าง" ในตาราง — กันคัดลอกผิดโดยไม่ตั้งใจ/สร้าง
 * data ขยะ — ตัดสินใจไว้ในหัวข้อ "งานที่ต้องทำรอบนี้" ของ continue-prompt รอบนี้) — submit จะเรียก
 * addQuotation() (ไม่มี requestId ติดไปด้วย เพราะฉบับร่างใหม่ไม่ได้มาจาก quote_request)
 * @param {Object} quotation — เอกสาร quotation ต้นฉบับ (จาก allQuotations ใน
 *   js/admin-quotations.js, มี id ติดมาด้วยแต่ไม่ใช้ต่อ) */
export function openQuotationFormFromClone(quotation) {
  const built = buildQuotationClone(quotation);
  editingId = null;
  qModalTitle.textContent = "คัดลอกเป็นฉบับร่างใหม่";
  fillCustomerFields(built);
  document.getElementById("ad-q-status").value = "draft";
  formItems = Array.isArray(built.items) && built.items.length
    ? built.items.map(it => ({
        name: it.name || "", variantLabel: it.variantLabel || "",
        qty: it.qty || 1, unit: it.unit || "",
        unitPrice: it.unitPrice || 0, discount: it.discount || 0
      }))
    : [blankItem()];
  requestId = null;
  renderItems();
  switchQuotationTab("customer"); // เปิดฟอร์มมาที่แท็บแรกเสมอ (ป๊อปอัพไม่ได้ถูกสร้างใหม่ทุกครั้ง แค่ toggle display)
  openOverlay(qOverlay);
}

function fillCustomerFields(q) {
  document.getElementById("ad-q-billing-name").value = q.billingName || "";
  document.getElementById("ad-q-contact-person").value = q.contactPerson || "";
  document.getElementById("ad-q-phone").value = q.phone || "";
  document.getElementById("ad-q-billing-address").value = q.billingAddress || "";
  document.getElementById("ad-q-vat-mode").value = q.vatMode || "excluded";
  // วันหมดอายุ (P3.0 Phase 6) — input type="date" ต้องได้ค่าเป็นสตริง "YYYY-MM-DD" ตรงเป๊ะหรือ
  // สตริงว่างเท่านั้น (ใส่ค่าอื่นแล้ว browser จะเคลียร์ค่าให้เองเงียบๆ) — validUntil ที่เก็บใน
  // Firestore ก็เป็นสตริงรูปแบบเดียวกันนี้อยู่แล้วจาก input นี้เอง (ดู payload ใน submit handler
  // ด้านล่าง) จึงส่งตรงๆ ได้เลยไม่ต้องแปลงรูปแบบ
  document.getElementById("ad-q-valid-until").value = q.validUntil || "";
  document.getElementById("ad-q-notes").value = q.notes || "";
}

function closeQuotationForm() {
  closeOverlay(qOverlay);
  qForm.reset();
  editingId = null;
  requestId = null;
  formItems = [];
}

qCancelBtn.addEventListener("click", closeQuotationForm);
qOverlay.addEventListener("click", (e) => { if (e.target === qOverlay) closeQuotationForm(); });

/** วาดตารางแถวรายการสินค้าใหม่ทั้งก้อน + อัปเดตยอดรวมท้ายฟอร์ม — เรียกทุกครั้งที่ formItems
 *  เปลี่ยน (เพิ่ม/ลบแถว) หรือค่า vatMode เปลี่ยน */
function renderItems() {
  qItemsBody.innerHTML = formItems.map((it, idx) => `
    <tr data-idx="${idx}">
      <td><input class="cl-input ad-q-item-name" data-field="name" value="${escapeHtml(it.name)}" placeholder="ชื่อสินค้า" required></td>
      <td><input class="cl-input ad-q-item-variant" data-field="variantLabel" value="${escapeHtml(it.variantLabel)}" placeholder="เช่น สี/ขนาด"></td>
      <td><input class="cl-input ad-q-item-qty" type="number" min="1" step="1" data-field="qty" value="${it.qty}"></td>
      <td><input class="cl-input ad-q-item-unit" data-field="unit" value="${escapeHtml(it.unit)}" placeholder="ชิ้น"></td>
      <td><input class="cl-input ad-q-item-price" type="number" min="0" step="0.01" data-field="unitPrice" value="${it.unitPrice}"></td>
      <td><input class="cl-input ad-q-item-discount" type="number" min="0" step="0.01" data-field="discount" value="${it.discount}"></td>
      <td class="ad-q-item-linetotal">${formatBaht(computeLineTotalLocal(it))}</td>
      <td><button type="button" class="cp-icon-btn danger ad-q-item-remove" title="ลบแถว" ${formItems.length <= 1 ? "disabled" : ""}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg></button></td>
    </tr>
  `).join("");
  updateTotals();
}

function computeLineTotalLocal(it) {
  const q = Number(it.qty) || 0, up = Number(it.unitPrice) || 0, d = Number(it.discount) || 0;
  return Math.max(0, q * up - d);
}

function updateTotals() {
  const vatMode = document.getElementById("ad-q-vat-mode").value;
  const totals = computeQuotationTotals(formItems, vatMode);
  qSubtotalEl.textContent = formatBaht(totals.subtotal);
  qVatEl.textContent = formatBaht(totals.vatAmount);
  qGrandEl.textContent = formatBaht(totals.grandTotal);
}

// อ่านค่าที่พิมพ์ในแถว (input/change) กลับเข้า formItems แล้ว re-render แค่ line total + ยอดรวม
// (ไม่ re-render ทั้งตาราง กันโฟกัสหลุดกลางคันตอนพิมพ์)
qItemsBody.addEventListener("input", (e) => {
  const row = e.target.closest("tr[data-idx]");
  if (!row) return;
  const idx = Number(row.dataset.idx);
  const field = e.target.dataset.field;
  if (!field || !formItems[idx]) return;
  const isNumberField = ["qty", "unitPrice", "discount"].includes(field);
  formItems[idx][field] = isNumberField ? Number(e.target.value) || 0 : e.target.value;
  row.querySelector(".ad-q-item-linetotal").textContent = formatBaht(computeLineTotalLocal(formItems[idx]));
  updateTotals();
});

qItemsBody.addEventListener("click", (e) => {
  const btn = e.target.closest(".ad-q-item-remove");
  if (!btn) return;
  const row = btn.closest("tr[data-idx]");
  const idx = Number(row.dataset.idx);
  if (formItems.length <= 1) return; // ต้องเหลืออย่างน้อย 1 แถวเสมอ
  formItems.splice(idx, 1);
  renderItems();
});

qAddItemBtn.addEventListener("click", () => {
  formItems.push(blankItem());
  renderItems();
});

document.getElementById("ad-q-vat-mode").addEventListener("change", updateTotals);

qForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!formItems.length || !formItems.some(it => (it.name || "").trim())) {
    showToast("กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ (ต้องมีชื่อสินค้า)");
    return;
  }
  const billingName = document.getElementById("ad-q-billing-name").value.trim();
  if (!billingName) {
    showToast("กรุณากรอกชื่อลูกค้า/บริษัท");
    return;
  }

  const payload = {
    billingName,
    contactPerson:  document.getElementById("ad-q-contact-person").value.trim(),
    phone:          document.getElementById("ad-q-phone").value.trim(),
    billingAddress: document.getElementById("ad-q-billing-address").value.trim(),
    vatMode:        document.getElementById("ad-q-vat-mode").value,
    // ไม่บังคับ — เว้นว่างได้ (input type="date" คืนสตริงว่างเองถ้าไม่กรอก ไม่ต้องเช็ค required)
    validUntil:     document.getElementById("ad-q-valid-until").value,
    notes:          document.getElementById("ad-q-notes").value.trim(),
    status:         document.getElementById("ad-q-status").value,
    items: formItems.filter(it => (it.name || "").trim())
  };
  // requestId ติดไปกับโหมด "สร้างใหม่" เท่านั้น (ทั้งสร้างเปล่าและสร้างจากคำขอ) — โหมดแก้ไข
  // ไม่ส่ง requestId ซ้ำเพราะ updateQuotation() ไม่รับแก้ field นี้อยู่แล้ว (ไม่ใช่ field ต้องห้าม
  // ใน updateQuotation() จริงๆ แต่ไม่มีเหตุผลต้องส่งซ้ำ เอกสารเดิมมี requestId ติดมาแล้วตั้งแต่สร้าง)
  if (!editingId) payload.requestId = requestId;

  const btn = qForm.querySelector('button[type=submit]');
  btn.disabled = true; btn.textContent = "กำลังบันทึก...";
  try {
    if (editingId) {
      await updateQuotation(editingId, payload);
      // Audit log (P3.0 Phase 6 — "audit log ใบเสนอราคา" ที่เคยข้ามไปตอนทำ Phase 6 หลัก) —
      // pattern เดียวกับ logAudit("update","order",...) ใน js/orders-tab-modal.js เป๊ะ — ลบเดิม
      // (deleteQuotation, ดู js/admin-quotations.js) ถูก log อยู่แล้วผ่าน deleteWithUndo() ที่ส่ง
      // targetType: "quotation" มาด้วย (ดู admin-utils.js) จึงเหลือแค่ create/update ที่ยังไม่ log
      logAudit("update", "quotation", editingId, billingName);
      showToast("บันทึกการแก้ไขใบเสนอราคาแล้ว", "success");
    } else {
      const created = await addQuotation(payload);
      // create ก็ log ด้วย (ต่างจาก order ที่ log แค่ update เพราะใบเสนอราคาเป็นเอกสารการเงินที่
      // ควรตรวจสอบย้อนหลังได้ตั้งแต่ตอนออกเอกสารเลย ไม่ใช่แค่ตอนแก้ไข) — ใช้ id ที่ addQuotation()
      // คืนกลับมา (created.id) เพราะตอนนี้ยังไม่มี doc id จนกว่าจะสร้างสำเร็จ
      logAudit("create", "quotation", created.id, billingName);
      showToast("สร้างใบเสนอราคาใหม่แล้ว", "success");
    }
    closeQuotationForm();
  } catch (err) {
    showToast("บันทึกไม่สำเร็จ: " + err.message);
  } finally {
    btn.disabled = false; btn.textContent = "บันทึก";
  }
});
