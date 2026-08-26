// ===========================
// js/orders-tab-modal.js — ป๊อปอัพ "เพิ่ม/แก้ไขคำสั่งผลิต" ของแท็บคำสั่งผลิต (js/orders-tab.js)
//
// 2026 refactor phase 3: ย้ายมาจาก js/orders-tab.js เดิม (ส่วน "Add/Edit modal" รวมถึง
// ตัวเลือกสินค้า/พนักงานที่ผูกกับฟอร์มนี้โดยเฉพาะ) แบบไม่เปลี่ยน behavior ใดๆ — ไฟล์นี้
// ครอบคลุม: ตัวเลือกสินค้า/พนักงาน (loadProductPicker/loadStaffPicker), การสลับหมวดย่อย
// ในป๊อปอัพ (ข้อมูลงาน/การเงิน/การจัดส่ง/แนบไฟล์/ประวัติ), chip group (สถานะการชำระเงิน/
// ช่องทางจัดส่ง), สรุปยอดเงินแบบเรียลไทม์, QC checklist, ไฟล์แนบ, ประวัติแก้ไข, และการ
// เปิด/ปิด/ทำซ้ำ/บันทึกฟอร์มคำสั่งผลิตเอง
//
// export ออกไปให้ js/orders-tab.js เรียกใช้:
//   - loadProductPicker()/loadStaffPicker() — เรียกครั้งเดียวตอน initOrdersTab()
//   - openOrderModal(order)/openOrderModalClone(order) — เรียกตอนกดแถว/การ์ด "แก้ไข"/"ทำซ้ำ"
//     ในตาราง/kanban ของ orders-tab.js (และปุ่ม "เพิ่มคำสั่งผลิต" ในไฟล์นี้เองเรียก
//     openOrderModal(null))
//
// import showToast()/escapeHtml()/formatBaht() กลับจาก js/orders-tab.js (ไฟล์นั้นใช้เยอะ
// สุดเลยอยู่ที่นั่น) — เกิด circular import ระหว่าง 2 ไฟล์นี้โดยตั้งใจ เหมือนรูปแบบ
// admin-page.js ↔ admin-products.js ที่มีอยู่แล้วในโปรเจกต์นี้ ใช้ได้ปกติเพราะทุกจุดที่
// เรียกใช้ข้ามไฟล์เป็นการเรียกภายในฟังก์ชัน/event handler ไม่ใช่ตอน module ประเมินค่า
// ระดับบนสุด
//
// 2026 refactor phase 6: ส่วน "ไฟล์แนบ" (DOM ref, state currentAttachments, และการ
// อัปโหลด) ถูกแยกไปเป็น js/orders-tab-modal-attach.js แล้ว — ไฟล์นี้ import
// currentAttachments/setCurrentAttachments/renderAttachGrid/attachStatusEl กลับมาใช้แทน
// (ดูรายละเอียดที่หัวไฟล์นั้น)
//
// 2026 refactor phase 7: ส่วน "QC checklist" (DOM ref, state currentQcChecklist, และการ
// เพิ่ม/ลบ/แก้รายการ) ถูกแยกไปเป็น js/orders-tab-modal-qc.js แล้ว — ไฟล์นี้ import
// currentQcChecklist/setCurrentQcChecklist/renderQcList กลับมาใช้แทน (ใช้แพทเทิร์นเดียวกับ
// currentAttachments/setCurrentAttachments phase 6) ส่วน "ประวัติแก้ไข" (DOM ref +
// loadOrderHistory()) ถูกแยกไปเป็น js/orders-tab-modal-history.js แล้ว — ไฟล์นั้นไม่มี state
// เลยจึง import แค่ loadOrderHistory() มาเรียกใช้ตรงๆ (ดูรายละเอียดที่หัวไฟล์ทั้งสอง)
//
// P0.2c: เพิ่มหมวด "อนุมัติแบบ" (ประวัติที่ลูกค้ากดอนุมัติ/ขอแก้ไขแบบเองจากหน้า public) —
// ดึง DOM ref + loadDesignApprovals() มาจาก js/orders-tab-modal-design-approvals.js ไฟล์ใหม่
// เขียนตามแพทเทิร์นเดียวกับ orders-tab-modal-history.js เป๊ะ (ไม่มี state ข้ามไฟล์) ต่างกันแค่
// รับ order ทั้งก้อนแทนที่จะรับแค่ id เพราะต้องคำนวณ trackingId เอง (ดูหมายเหตุหัวไฟล์นั้น) —
// ส่วน checkbox "ลูกค้าเห็น" ต่อไฟล์แนบ (คัด designFiles) แก้อยู่ใน
// js/orders-tab-modal-attach.js แทน (ไม่ต้อง import อะไรเพิ่มที่นี่ เพราะยังอ่านผ่าน
// currentAttachments ตัวเดิมที่ import อยู่แล้ว — ดูตอนประกอบ payload ด้านล่าง)
//
// พบบั๊กเดิมระหว่างแยกไฟล์รอบนี้ (ไม่เกี่ยวกับการแยกไฟล์เอง — เกิดจากต้นฉบับเดิมไม่เคยประกาศ
// ตัวแปร allProducts/catNameMap เลยสักที่ ทำให้ loadProductPicker() โยน ReferenceError
// ทันทีที่มีการ assign เพราะ ES module เป็น strict mode เสมอ ใช้งานตัวเลือกสินค้าไม่ได้เลย
// ตั้งแต่ต้น) — แก้โดยเพิ่มประกาศ `let allProducts = []; let catNameMap = {};` ไว้ตรงจุดที่
// ควรอยู่ (ก่อน loadProductPicker) เป็นจุดเดียวที่เปลี่ยน logic จากของเดิมในไฟล์นี้ นอกเหนือ
// จากการย้ายโค้ดไปไฟล์ใหม่ตามปกติ
//
// 2026-08 update: 2 จุดในหมวด "ข้อมูลงาน" —
//   1) ช่อง "LINE user ID ลูกค้า" (cp-o-line-user-id) เดิมเป็นช่องพิมพ์เปล่าล้วนๆ แก้ให้ผูกกับ
//      <datalist> (cp-o-line-user-datalist) ที่เติมรายชื่อจาก collection "quote_requests" (ดู
//      js/db-quote-requests.js) อัตโนมัติ — แสดงชื่อลูกค้าคู่กับ LINE user ID ให้แอดมินรู้ว่าเป็นใคร
//      ก่อนเลือก แต่ยังพิมพ์เองได้เหมือนเดิมด้วย (input ปกติ ไม่ใช่ select บังคับเลือก) เพราะลูกค้า
//      บางคนไม่เคยขอใบเสนอราคามาก่อนเลยก็มี — โหลดผ่าน loadQuoteRequestPicker() (realtime listener
//      เดียวกับที่ js/admin-quotations.js ใช้ในโมดัลเลือกคำขอ) เรียกครั้งเดียวตอน initOrdersTab()
//   2) ช่องเลือกสินค้า (cp-o-product) เดิมเป็น <select> เลือกได้ทีละรายการ แก้เป็น <select multiple>
//      เลือกได้หลายรายการพร้อมกัน (กด Ctrl/Cmd ค้างไว้) — ตอนเลือกหลายชิ้น ชื่อรายการ/หมวดป้าย/
//      ราคารวมต่อหน่วยจะรวมจากทุกสินค้าที่เลือกให้อัตโนมัติ (ดู applyProductSelection() ด้านล่าง)
//      บันทึกเป็น product_ids (array ใหม่) คู่กับ product_id เดิม (เก็บแค่ตัวแรกไว้ backward-compat
//      กับของเก่า/หน้าอื่นที่ยังอ่าน product_id เดี่ยวอยู่ — ดู js/db-orders.js ORDER_ALLOWED_FIELDS/
//      normalizeOrderExtras() + firestore.rules ที่แก้คู่กัน)
// ===========================
import { logAudit, listStaff } from "./db.js";
import { getProducts } from "./db-products.js";
import { getCategories } from "./db-taxonomy.js";
import { addOrder, updateOrder } from "./db-orders.js";
import { listenAllQuoteRequests } from "./db-quote-requests.js";
import { orderGrandTotal, orderBalance } from "./db-orders-stats.js";
import { attachInlineValidation, validateFormInline,
         attachUnsavedGuard } from "./ui-form-validation.js";
import { showToast, escapeHtml, formatBaht } from "./orders-tab.js";
import { currentAttachments, setCurrentAttachments, renderAttachGrid, attachStatusEl } from "./orders-tab-modal-attach.js";
import { currentQcChecklist, setCurrentQcChecklist, renderQcList } from "./orders-tab-modal-qc.js";
import { loadOrderHistory } from "./orders-tab-modal-history.js";
import { loadDesignApprovals } from "./orders-tab-modal-design-approvals.js";

// ── Modal overlay helper (ดูคำอธิบายเดียวกันใน admin-utils.js) ──
// 2026 refactor — accessibility phase (รอบที่ 58): เพิ่ม focus-trap + Escape + return-focus
// แบบเดียวกับ admin-utils.js เป๊ะ (ก็อปคู่กันไว้ตั้งแต่ต้น ไม่ export/import ข้ามไฟล์ — ดูหมายเหตุ
// เดิมที่หัวไฟล์นี้) ดูรายละเอียดเพิ่มเติมใน REFACTOR-PROGRESS.md หัวข้อ "รอบที่ 58"
const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), textarea:not([disabled]), ' +
  'input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

const openOverlayStack = [];
let modalKeydownBound = false;

function topOverlayEntry() {
  return openOverlayStack.length ? openOverlayStack[openOverlayStack.length - 1] : null;
}

// ดูคำอธิบายเดียวกันใน admin-utils.js — confirmDialog() เป็น modal ซ้อนทับแยกต่างหาก ต้องปล่อยให้
// มันจัดการ Escape/Tab ของตัวเองตอนที่เปิดอยู่ ไม่ trap/Escape ทับ
function isConfirmDialogOpen() {
  const el = document.querySelector(".cp-confirm-overlay");
  return !!(el && el.style.display === "flex");
}

function handleModalKeydown(e) {
  if (isConfirmDialogOpen()) return;
  const top = topOverlayEntry();
  if (!top || top.el.style.display === "none") return;

  if (e.key === "Escape") {
    if (e.defaultPrevented) return;
    top.el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    return;
  }

  if (e.key === "Tab") {
    const focusables = Array.from(top.el.querySelectorAll(FOCUSABLE_SELECTOR));
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;
    if (e.shiftKey) {
      if (active === first || !top.el.contains(active)) { e.preventDefault(); last.focus(); }
    } else {
      if (active === last || !top.el.contains(active)) { e.preventDefault(); first.focus(); }
    }
  }
}

let openOverlayCount = 0;
function openOverlay(el) {
  if (!el) return;
  el.style.display = "flex";
  const scrollBox = el.querySelector(".cp-modal, .ad-pf-view");
  if (scrollBox) scrollBox.scrollTop = 0;
  if (openOverlayCount === 0) {
    const scrollbarW = window.innerWidth - document.documentElement.clientWidth;
    document.body.classList.add("cp-scroll-locked");
    if (scrollbarW > 0) document.body.style.paddingRight = scrollbarW + "px";
  }
  openOverlayCount++;
  openOverlayStack.push({ el, lastFocused: document.activeElement });
  if (!modalKeydownBound) {
    modalKeydownBound = true;
    document.addEventListener("keydown", handleModalKeydown);
  }
}
function closeOverlay(el) {
  if (!el) return;
  el.style.display = "none";
  openOverlayCount = Math.max(0, openOverlayCount - 1);
  if (openOverlayCount === 0) {
    document.body.classList.remove("cp-scroll-locked");
    document.body.style.paddingRight = "";
  }
  for (let i = openOverlayStack.length - 1; i >= 0; i--) {
    if (openOverlayStack[i].el === el) {
      const [entry] = openOverlayStack.splice(i, 1);
      if (entry.lastFocused && typeof entry.lastFocused.focus === "function") {
        entry.lastFocused.focus();
      }
      break;
    }
  }
}

const orderOverlay = document.getElementById("cp-order-overlay");
const orderForm     = document.getElementById("cp-order-form");
const orderModalTitle = document.getElementById("cp-order-modal-title");
const orderHeadCode   = document.getElementById("cp-o-head-code");
const orderCancelBtn  = document.getElementById("cp-order-cancel");
attachInlineValidation(orderForm);
const productSelect     = document.getElementById("cp-o-product");
const productChecklist  = document.getElementById("cp-o-product-checklist");
const productSearchInput = document.getElementById("cp-o-product-search");
const lineUserDatalist  = document.getElementById("cp-o-line-user-datalist");
const unitPriceRow      = document.getElementById("cp-o-unit-price-row");
const unitPriceDisplay  = document.getElementById("cp-o-unit-price-display");
const unitPriceHidden   = document.getElementById("cp-o-unit-price");
const assigneeSelect    = document.getElementById("cp-o-assignee");
const paymentChipsBox   = document.getElementById("cp-o-payment-chips");
const shippingChipsBox  = document.getElementById("cp-o-shipping-chips");

let allStaff = [];
// แก้บั๊กเดิม (ดูหมายเหตุที่หัวไฟล์): ต้นฉบับไม่เคยประกาศ 2 ตัวแปรนี้เลย
let allProducts = [];
let catNameMap = {};

// ── Product picker (ผูกคำสั่งผลิตกับสินค้าจริงในแคตตาล็อก เพื่อคำนวณยอดขาย) ──
// เลือกได้หลายรายการ (multi-select) — ไม่มี option "— เลือกสินค้า... —" เหมือนของเดิมแล้ว เพราะ
// select multiple ไม่ต้องมี placeholder แบบนั้น (ไม่เลือกเลยก็คือค่าว่างอยู่แล้วโดยไม่ต้องมี option พิเศษ)
export async function loadProductPicker() {
  try {
    const [products, categories] = await Promise.all([getProducts(), getCategories()]);
    allProducts = products || [];
    catNameMap = {};
    (categories || []).forEach(c => { catNameMap[c.id] = c.name; });
    productSelect.innerHTML = allProducts.map(p => {
      const priceLabel = p.price ? ` — ฿${Number(p.price).toLocaleString("th-TH")}` : "";
      return `<option value="${p.id}">${escapeHtml(p.name || "สินค้า")}${priceLabel}</option>`;
    }).join("");
    renderProductChecklist();
  } catch (err) {
    console.warn("โหลดรายการสินค้าสำหรับผูกคำสั่งผลิตไม่สำเร็จ", err);
  }
}

// ── UI checkbox แทน native select multiple (ดูคอมเมนต์ใน admin.html #cp-o-product-checklist) ──
// วาดรายการ checkbox ตาม allProducts — เรียกครั้งเดียวตอนโหลดสินค้าเสร็จ (ไม่ได้เรียกซ้ำตอนเปิด/
// ปิดป๊อปอัพ เพราะรายการสินค้าไม่เปลี่ยนบ่อย — สถานะติ๊ก/ไม่ติ๊กต่อครั้งจัดการผ่าน
// syncProductChecklistFromSelect() แยกต่างหาก)
function renderProductChecklist() {
  if (!allProducts.length) {
    productChecklist.innerHTML = '<div class="cp-product-checklist-empty">ยังไม่มีสินค้าในแคตตาล็อก</div>';
    return;
  }
  const rowsHtml = allProducts.map(p => {
    const priceLabel = p.price ? `฿${Number(p.price).toLocaleString("th-TH")}` : "";
    return `
      <label class="cp-product-check-row" data-product-id="${p.id}" data-product-name="${escapeHtml((p.name || "สินค้า").toLowerCase())}">
        <input type="checkbox" value="${p.id}">
        <span class="cp-product-check-row-name">${escapeHtml(p.name || "สินค้า")}</span>
        <span class="cp-product-check-row-price">${escapeHtml(priceLabel)}</span>
      </label>`;
  }).join("");
  productChecklist.innerHTML = rowsHtml +
    '<div class="cp-product-checklist-empty cp-product-search-empty" style="display:none;">ไม่พบสินค้าที่ตรงกับคำค้นหา</div>';
  filterProductChecklist();
}

// ── ช่องค้นหาสินค้า (พิมพ์กรองรายชื่อในแชคลิสต์แบบ realtime) — ไม่กระทบสถานะติ๊ก/ไม่ติ๊กของสินค้า
// ที่ซ่อนอยู่ระหว่างค้นหา (แค่ซ่อนแถวด้วย CSS, ไม่ได้ unselect) ── */
function filterProductChecklist() {
  const q = productSearchInput.value.trim().toLowerCase();
  const rows = productChecklist.querySelectorAll(".cp-product-check-row");
  let visibleCount = 0;
  rows.forEach(row => {
    const matches = !q || (row.dataset.productName || "").includes(q);
    row.classList.toggle("cp-hidden-by-search", !matches);
    if (matches) visibleCount++;
  });
  const emptyMsg = productChecklist.querySelector(".cp-product-search-empty");
  if (emptyMsg) emptyMsg.style.display = (rows.length && !visibleCount) ? "" : "none";
}
productSearchInput.addEventListener("input", filterProductChecklist);

// อ่านสถานะ .selected ปัจจุบันของ select ที่ซ่อนไว้ (แหล่งความจริงเดียว) มาอัปเดต checkbox/active
// class ของ UI ให้ตรงกัน — ต้องเรียกทุกครั้งที่มีอะไรไปเปลี่ยน productSelect.options[].selected
// จากภายนอก checkbox เอง เช่น openOrderModal(order) ตอน restore ค่าเดิมของคำสั่งผลิตที่แก้ไข
function syncProductChecklistFromSelect() {
  const selectedIds = new Set(Array.from(productSelect.selectedOptions).map(o => o.value));
  productChecklist.querySelectorAll(".cp-product-check-row").forEach(row => {
    const isSelected = selectedIds.has(row.dataset.productId);
    row.classList.toggle("active", isSelected);
    row.querySelector('input[type="checkbox"]').checked = isSelected;
  });
}

// คลิกที่แถวไหนก็ตาม → toggle .selected ของ option คู่กันใน select จริง แล้วยิง "change" event ต่อ
// เหมือนผู้ใช้คลิกเลือกใน select multiple เอง (applyProductSelection() ที่ผูก listener ไว้กับ
// select จะทำงานต่ออัตโนมัติ ไม่ต้องเรียกซ้ำตรงนี้) — ใช้ event delegation ที่ container เพราะแถว
//ถูกสร้างใหม่ทุกครั้งที่ renderProductChecklist()
productChecklist.addEventListener("click", (e) => {
  const row = e.target.closest(".cp-product-check-row");
  if (!row) return;
  e.preventDefault(); // กัน label ค่า default toggle checkbox ซ้ำสอง (เรา toggle เองข้างล่างแล้ว)
  const productId = row.dataset.productId;
  const option = Array.from(productSelect.options).find(o => o.value === productId);
  if (!option) return;
  option.selected = !option.selected;
  productSelect.dispatchEvent(new Event("change", { bubbles: true }));
  syncProductChecklistFromSelect();
});

// ── LINE user ID picker (P.multi-select-2026-08) — เติม <datalist> จากลูกค้าที่เคยส่งคำขอใบเสนอ
// ราคา (collection "quote_requests", มี lineUserId ติดมาถ้าตอน login ด้วย LINE อยู่ตอนส่งคำขอ —
// ดู js/db-quote-requests.js saveQuoteRequest()) แสดงชื่อคู่กับ LINE user ID เพื่อให้แอดมินรู้ว่า
// เป็นใครก่อนเลือก — ใช้ pattern listener เดียวกับ js/admin-quotations.js
// startQuoteRequestsListener() (โมดัลเลือกคำขอของแท็บใบเสนอราคา) แต่แยก listener ของตัวเองเพราะ
// คนละไฟล์ คนละ scope — เรียกครั้งเดียวตอน initOrdersTab() เหมือน loadProductPicker()/loadStaffPicker()
let quoteRequestPickerStarted = false;
export function loadQuoteRequestPicker() {
  if (quoteRequestPickerStarted) return;
  quoteRequestPickerStarted = true;
  listenAllQuoteRequests(
    (requests) => {
      // เรียง createdAt ล่าสุดก่อนอยู่แล้ว (query จาก listenAllQuoteRequests()) — เจอ lineUserId
      // ซ้ำเก็บแค่ชื่อจากคำขอล่าสุดพอ (ตัวแรกที่เจอ) กันรายชื่อซ้ำในลิสต์เดียวกัน
      const seen = new Map(); // lineUserId -> ชื่อที่แสดง
      (requests || []).forEach(r => {
        const uid = String(r.lineUserId || "").trim();
        if (!uid || seen.has(uid)) return;
        seen.set(uid, r.billingName || r.contactPerson || "ไม่ระบุชื่อ");
      });
      lineUserDatalist.innerHTML = Array.from(seen.entries())
        .map(([uid, name]) => `<option value="${escapeHtml(uid)}">${escapeHtml(name)}</option>`)
        .join("");
    },
    (err) => console.warn("โหลดรายชื่อผู้ขอใบเสนอราคาสำหรับผูก LINE user ID ไม่สำเร็จ", err)
  );
}

// รายการสินค้าที่ถูกเลือกอยู่ตอนนี้ใน cp-o-product (multi-select) — คืนเป็น object สินค้าเต็ม
// (จับคู่กับ allProducts) ไม่ใช่แค่ id เฉยๆ เพราะต้องใช้ name/price/unit/cat_id ต่อ
function selectedProducts() {
  return Array.from(productSelect.selectedOptions)
    .map(opt => allProducts.find(p => p.id === opt.value))
    .filter(Boolean);
}

// รวมชื่อ/หมวด/ราคาต่อหน่วยจากสินค้าที่เลือกทั้งหมด (เลือกได้หลายรายการ) เข้าช่อง "ชื่อรายการ/ป้าย",
// "หมวดป้าย" และแถวราคาต่อหน่วย — ยังเก็บโมเดลข้อมูลเดิมไว้ (unit_price ตัวเดียว, item เป็น text
// เดียว) เพื่อไม่กระทบการคำนวณยอดเงิน/สถิติที่อื่นที่อ่าน field เดิมอยู่ — แค่ "รวม" ค่าจากทุกสินค้า
// ที่เลือกเข้าไปในนั้นแทนที่จะดึงจากสินค้าชิ้นเดียว
function applyProductSelection() {
  const products = selectedProducts();
  if (!products.length) {
    unitPriceRow.style.display = "none";
    unitPriceHidden.value = "0";
    return;
  }
  document.getElementById("cp-o-item").value = products.map(p => p.name || "สินค้า").join(", ");
  const categories = [...new Set(products.map(p => catNameMap[p.cat_id]).filter(Boolean))];
  document.getElementById("cp-o-category").value = categories.join(", ");
  const totalPrice = products.reduce((sum, p) => sum + (Number(p.price) || 0), 0);
  unitPriceHidden.value = String(totalPrice);
  if (!totalPrice) {
    unitPriceDisplay.value = "สินค้าที่เลือกยังไม่ระบุราคา";
  } else if (products.length > 1) {
    unitPriceDisplay.value = `฿${totalPrice.toLocaleString("th-TH")} รวม ${products.length} รายการ / หน่วย`;
  } else {
    unitPriceDisplay.value = `฿${totalPrice.toLocaleString("th-TH")} / ${products[0].unit || "หน่วย"}`;
  }
  unitPriceRow.style.display = "";
  updateFinanceSummary();
}

productSelect.addEventListener("change", applyProductSelection);

// ── Staff picker (ผูก assignee ของคำสั่งผลิตกับ collection "staff" — ดู listStaff() ใน js/db.js) ──
export async function loadStaffPicker() {
  try {
    allStaff = await listStaff();
    assigneeSelect.innerHTML = '<option value="">— ยังไม่มอบหมาย —</option>' +
      allStaff.map(s => `<option value="${s.uid}">${escapeHtml(s.name || s.email || s.uid)}</option>`).join("");
  } catch (err) {
    console.warn("โหลดรายชื่อพนักงานสำหรับมอบหมายงานไม่สำเร็จ", err);
  }
}

// ปุ่ม "เพิ่มคำสั่งผลิต" ใน toolbar ของแท็บ (ย้ายมาจาก DOM ref block ของ js/orders-tab.js เดิม
// มาไว้ที่นี่ เพราะใช้แค่เปิดป๊อปอัพนี้เท่านั้น)
const addBtn = document.getElementById("cp-add-btn");
// ── Add/Edit modal ──────────────────────────────
addBtn.addEventListener("click", () => openOrderModal(null));
orderCancelBtn.addEventListener("click", () => orderFormGuard.guardedClose());
orderOverlay.addEventListener("click", (e) => { if (e.target === orderOverlay) orderFormGuard.guardedClose(); });

const orderFormGuard = attachUnsavedGuard({ overlay: orderOverlay, form: orderForm, doClose: closeOrderModal });

// ── สลับหมวด/แท็บในป๊อปอัพ (ข้อมูลงาน/การเงิน/การจัดส่ง/แนบไฟล์/ประวัติ) ──
// หมายเหตุแก้บัค: ป๊อปอัพนี้ไม่ได้ถูกสร้างใหม่ทุกครั้งที่เปิด (แค่ toggle display) ดังนั้น
// ถ้าผู้ใช้เคยเลื่อนแถบแท็บ (.cp-od-tabs, overflow-x:auto) ไปทางขวาไว้ก่อนปิดป๊อปอัพ
// ตำแหน่งเลื่อนจะค้างอยู่ พอเปิดครั้งถัดไปแถบแท็บจะ "ว่างเปล่า" (เลื่อนเลยตัวปุ่มทั้งหมดไปแล้ว)
// เหมือนหัวข้อหายไป — จึงต้องเลื่อนแท็บที่ active กลับเข้ามาให้เห็นทุกครั้งที่สลับ/เปิดป๊อปอัพ
function switchOdTab(tabName) {
  let activeTabBtn = null;
  orderForm.querySelectorAll(".cp-od-tab").forEach(btn => {
    const isActive = btn.dataset.odTab === tabName;
    btn.classList.toggle("active", isActive);
    btn.setAttribute("aria-selected", isActive ? "true" : "false");
    if (isActive) activeTabBtn = btn;
  });
  orderForm.querySelectorAll(".cp-od-panel").forEach(panel => {
    panel.classList.toggle("active", panel.dataset.odPanel === tabName);
  });
  // เลื่อนแถบแท็บให้เห็นปุ่มที่เพิ่ง active เสมอ (กันแถบว่างเปล่าตามที่อธิบายด้านบน)
  if (activeTabBtn) {
    activeTabBtn.scrollIntoView({ block: "nearest", inline: "nearest" });
  }
  // เลื่อนเนื้อหาป๊อปอัพกลับขึ้นบนสุดทุกครั้งที่สลับหมวด กันเนื้อหาหมวดใหม่โผล่มาแบบเลื่อนค้างจากหมวดก่อนหน้า
  orderForm.scrollTop = 0;
}
orderForm.querySelectorAll(".cp-od-tab").forEach(btn => {
  btn.addEventListener("click", () => switchOdTab(btn.dataset.odTab));
});

// ── Chip group (ปุ่มเลือกแบบ chip แทน select ทึบๆ) — ใช้ทั้งสถานะการชำระเงินและช่องทางจัดส่ง ──
function bindChipGroup(container, onChange) {
  container.querySelectorAll(".cp-chip-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      container.querySelectorAll(".cp-chip-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      if (onChange) onChange(btn.dataset.value);
    });
  });
}
function getChipValue(container, fallback) {
  const active = container.querySelector(".cp-chip-btn.active");
  return active ? active.dataset.value : fallback;
}
function setChipValue(container, value) {
  container.querySelectorAll(".cp-chip-btn").forEach(b => b.classList.toggle("active", b.dataset.value === value));
}
bindChipGroup(paymentChipsBox, updateFinanceSummary);
bindChipGroup(shippingChipsBox);

// ── สรุปยอดเงินแบบเรียลไทม์ในหมวด "การเงิน" — คำนวณด้วย orderGrandTotal()/orderBalance()
// จุดเดียวกับที่การ์ดสถิติ/CSV/พิมพ์รายงานใช้ กันเลขไม่ตรงกันระหว่างที่ต่างๆ ──
function updateFinanceSummary() {
  const tempOrder = {
    unit_price:   Number(unitPriceHidden.value) || 0,
    qty:          Number(document.getElementById("cp-o-qty").value) || 0,
    discount:     Number(document.getElementById("cp-o-discount").value) || 0,
    vatIncluded:  document.getElementById("cp-o-vat-included").checked,
    shippingCost: Number(document.getElementById("cp-o-shipping-cost").value) || 0,
    deposit:      Number(document.getElementById("cp-o-deposit").value) || 0,
    paymentStatus: getChipValue(paymentChipsBox, "unpaid")
  };
  const total = orderGrandTotal(tempOrder);
  const balance = orderBalance(tempOrder);
  const goods = Math.max(0, total - tempOrder.shippingCost);
  document.getElementById("cp-o-sum-goods").textContent    = formatBaht(goods);
  document.getElementById("cp-o-sum-shipping").textContent = formatBaht(tempOrder.shippingCost);
  document.getElementById("cp-o-sum-total").textContent    = formatBaht(total);
  document.getElementById("cp-o-sum-deposit").textContent  = formatBaht(tempOrder.deposit);
  document.getElementById("cp-o-sum-balance").textContent  = formatBaht(balance);
}
["cp-o-qty", "cp-o-discount", "cp-o-shipping-cost", "cp-o-deposit"].forEach(id => {
  document.getElementById(id).addEventListener("input", updateFinanceSummary);
});
document.getElementById("cp-o-vat-included").addEventListener("change", updateFinanceSummary);

export function openOrderModal(order, initialTab = "info") {
  orderModalTitle.textContent = order ? "แก้ไขคำสั่งผลิต" : "เพิ่มคำสั่งผลิต";
  orderHeadCode.textContent = order ? (order.code || "") : "";
  switchOdTab(initialTab);
  productSearchInput.value = "";
  filterProductChecklist();

  document.getElementById("cp-o-id").value         = order ? order.id : "";
  document.getElementById("cp-o-code").value       = order ? order.code || "" : "";
  document.getElementById("cp-o-customer").value   = order ? order.customer || "" : "";
  document.getElementById("cp-o-phone").value      = order ? order.phone || "" : "";
  document.getElementById("cp-o-email").value      = order ? order.email || "" : "";
  document.getElementById("cp-o-line-user-id").value = order ? order.lineUserId || "" : "";
  // เลือกได้หลายรายการ — order.product_ids (array ใหม่) ถ้ามี ไม่งั้น fallback ไป product_id
  // เดี่ยวของเดิม (คำสั่งผลิตเก่าก่อนอัปเดตนี้ยังมีแค่ field เดียว)
  {
    const selectedIds = order
      ? (Array.isArray(order.product_ids) && order.product_ids.length
          ? order.product_ids
          : (order.product_id ? [order.product_id] : []))
      : [];
    Array.from(productSelect.options).forEach(opt => { opt.selected = selectedIds.includes(opt.value); });
    syncProductChecklistFromSelect();
  }
  document.getElementById("cp-o-item").value       = order ? order.item || "" : "";
  document.getElementById("cp-o-category").value   = order ? order.category || "" : "";
  const price = order ? Number(order.unit_price) || 0 : 0;
  unitPriceHidden.value = String(price);
  if (order && order.product_id && price) {
    const product = allProducts.find(p => p.id === order.product_id);
    unitPriceDisplay.value = `฿${price.toLocaleString("th-TH")} / ${(product && product.unit) || "หน่วย"}`;
    unitPriceRow.style.display = "";
  } else {
    unitPriceRow.style.display = "none";
  }
  document.getElementById("cp-o-qty").value      = order ? order.qty || 1 : 1;
  document.getElementById("cp-o-due").value      = order ? order.dueDate || "" : "";
  document.getElementById("cp-o-status").value   = order ? order.status || "received" : "received";
  document.getElementById("cp-o-progress").value = order ? order.progress || 0 : 0;
  assigneeSelect.value = order ? order.assignee || "" : "";

  document.getElementById("cp-o-spec-size").value     = order && order.specs ? order.specs.size || "" : "";
  document.getElementById("cp-o-spec-material").value = order && order.specs ? order.specs.material || "" : "";
  document.getElementById("cp-o-spec-color").value    = order && order.specs ? order.specs.color || "" : "";
  document.getElementById("cp-o-spec-finish").value   = order && order.specs ? order.specs.finish || "" : "";

  setCurrentQcChecklist(order && Array.isArray(order.qcChecklist)
    ? order.qcChecklist.map(q => ({ label: q.label || "", checked: !!q.checked }))
    : []);
  renderQcList();
  document.getElementById("cp-o-notes").value = order ? order.notes || "" : "";

  // การเงิน
  document.getElementById("cp-o-deposit").value  = order ? order.deposit || 0 : 0;
  document.getElementById("cp-o-discount").value = order ? order.discount || 0 : 0;
  document.getElementById("cp-o-vat-included").checked = order ? !!order.vatIncluded : false;
  setChipValue(paymentChipsBox, order ? order.paymentStatus || "unpaid" : "unpaid");
  document.getElementById("cp-o-invoice-address").value = order ? order.invoiceAddress || "" : "";

  // การจัดส่ง
  document.getElementById("cp-o-recipient").value       = order ? order.recipient || "" : "";
  document.getElementById("cp-o-shipping-cost").value    = order ? order.shippingCost || 0 : 0;
  document.getElementById("cp-o-shipping-address").value = order ? order.shippingAddress || "" : "";
  setChipValue(shippingChipsBox, order ? order.shippingMethod || "pickup" : "pickup");
  document.getElementById("cp-o-shipping-tracking").value = order ? order.shippingTrackingId || "" : "";

  updateFinanceSummary();

  // แนบไฟล์
  setCurrentAttachments(order && Array.isArray(order.attachments) ? order.attachments.slice() : []);
  renderAttachGrid();
  attachStatusEl.textContent = "";

  // อนุมัติแบบ (P0.2c)
  loadDesignApprovals(order);

  // ประวัติ
  loadOrderHistory(order ? order.id : null);

  openOverlay(orderOverlay);
  orderFormGuard.capture();
}

function closeOrderModal() {
  closeOverlay(orderOverlay);
  orderForm.reset();
  unitPriceRow.style.display = "none";
  unitPriceHidden.value = "0";
  setCurrentAttachments([]);
  setCurrentQcChecklist([]);
  renderQcList();
  renderAttachGrid();
  setChipValue(paymentChipsBox, "unpaid");
  setChipValue(shippingChipsBox, "pickup");
}

// "ทำซ้ำ" — เปิดฟอร์ม "เพิ่มคำสั่งผลิต" พร้อมข้อมูลเดิมกรอกไว้ให้ (ไม่ใช่แก้ของเดิม) สำหรับงานที่คล้ายกัน
// ล้างเลขที่คำสั่งผลิต/กำหนดส่ง/สถานะ/ความคืบหน้า/เลขพัสดุ เพราะเป็นค่าเฉพาะของงานใหม่แต่ละครั้ง
export function openOrderModalClone(order) {
  openOrderModal(order);
  document.getElementById("cp-o-id").value = "";
  document.getElementById("cp-o-code").value = "";
  document.getElementById("cp-o-due").value = "";
  document.getElementById("cp-o-status").value = "received";
  document.getElementById("cp-o-progress").value = 0;
  document.getElementById("cp-o-shipping-tracking").value = "";
  orderHeadCode.textContent = "";
  orderModalTitle.textContent = `ทำซ้ำคำสั่งผลิตจาก "${order.code || order.item || ""}"`;
  loadOrderHistory(null);
  loadDesignApprovals(null);
  orderFormGuard.capture();
}

orderForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!validateFormInline(orderForm)) return;

  // P0.2 guard (2026 refactor) — กันเคสสถานะ "รออนุมัติแบบ" ที่ไม่มีไฟล์ดีไซน์ติ๊ก "ลูกค้าเห็น"
  // เลยสักไฟล์เดียว: หน้าเช็คสถานะ public (js/track-modal.js) จะบอกลูกค้าให้ไปดู/กดอนุมัติที่
  // แท็บ "ดำเนินการ" ทันทีที่ status เป็น approval แต่ renderDesignApprovalSection() จะไม่แสดง
  // อะไรเลยถ้า designFiles ว่าง — ลูกค้าจึงเจอแท็บว่างเปล่าที่สวนทางกับสิ่งที่บอกไว้ ก่อนหน้านี้ไม่มี
  // อะไรกันไม่ให้แอดมินเผลอตั้งสถานะนี้ได้โดยไม่มีไฟล์ จึงเพิ่ม guard ไว้ตรงนี้ (ไม่ใช่ที่
  // db-orders.js เพราะเป็นกฎ UX ของฟอร์มนี้ล้วนๆ ไม่ใช่กฎข้อมูลระดับ schema)
  const statusSelect = document.getElementById("cp-o-status");
  if (statusSelect.value === "approval" && !currentAttachments.some(a => a.showToCustomer)) {
    showToast("ก่อนตั้งสถานะเป็น \"รออนุมัติแบบ\" ต้องติ๊ก \"ลูกค้าเห็น\" ที่ไฟล์แนบอย่างน้อย 1 ไฟล์ก่อน ไม่งั้นลูกค้าจะเข้าไปเช็คสถานะแล้วเจอแท็บ \"ดำเนินการ\" ว่างเปล่า", "error");
    const attachGrid = document.getElementById("cp-o-attach-grid");
    if (attachGrid) attachGrid.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }

  const id = document.getElementById("cp-o-id").value;
  const assigneeUid = assigneeSelect.value;
  const assigneeStaff = allStaff.find(s => s.uid === assigneeUid);
  const payload = {
    code:      document.getElementById("cp-o-code").value.trim(),
    customer:  document.getElementById("cp-o-customer").value.trim(),
    phone:     document.getElementById("cp-o-phone").value.trim(),
    email:     document.getElementById("cp-o-email").value.trim(),
    lineUserId: document.getElementById("cp-o-line-user-id").value.trim(),
    item:      document.getElementById("cp-o-item").value.trim(),
    category:  document.getElementById("cp-o-category").value.trim(),
    // cp-o-product เป็น select multiple แล้ว (เลือกได้หลายรายการ) — product_id เก็บแค่ตัวแรกไว้
    // backward-compat กับของเก่า/หน้าอื่นที่ยังอ่าน field เดี่ยวอยู่ ส่วน product_ids คือ array
    // เต็มของทุกรายการที่เลือก (ดูหมายเหตุหัวไฟล์ "2026-08 update" ข้อ 2)
    product_id: Array.from(productSelect.selectedOptions).map(o => o.value)[0] || "",
    product_ids: Array.from(productSelect.selectedOptions).map(o => o.value),
    unit_price: Number(unitPriceHidden.value) || 0,
    qty:       document.getElementById("cp-o-qty").value,
    dueDate:   document.getElementById("cp-o-due").value,
    status:    document.getElementById("cp-o-status").value,
    progress:  document.getElementById("cp-o-progress").value,
    notes:     document.getElementById("cp-o-notes").value.trim(),

    // ── การผลิตเชิงลึก ──
    assignee:     assigneeUid,
    assigneeName: assigneeStaff ? (assigneeStaff.name || assigneeStaff.email || "") : "",
    specs: {
      size:     document.getElementById("cp-o-spec-size").value.trim(),
      material: document.getElementById("cp-o-spec-material").value.trim(),
      color:    document.getElementById("cp-o-spec-color").value.trim(),
      finish:   document.getElementById("cp-o-spec-finish").value.trim()
    },
    qcChecklist: currentQcChecklist
      .map(q => ({ label: q.label.trim(), checked: !!q.checked }))
      .filter(q => q.label),

    // ── การเงิน ──
    deposit:        document.getElementById("cp-o-deposit").value,
    paymentStatus:  getChipValue(paymentChipsBox, "unpaid"),
    discount:       document.getElementById("cp-o-discount").value,
    vatIncluded:    document.getElementById("cp-o-vat-included").checked,
    invoiceAddress: document.getElementById("cp-o-invoice-address").value.trim(),

    // ── โลจิสติกส์ ──
    shippingAddress:    document.getElementById("cp-o-shipping-address").value.trim(),
    recipient:          document.getElementById("cp-o-recipient").value.trim(),
    shippingMethod:     getChipValue(shippingChipsBox, "pickup"),
    shippingCost:       document.getElementById("cp-o-shipping-cost").value,
    shippingTrackingId: document.getElementById("cp-o-shipping-tracking").value.trim(),

    attachments: currentAttachments,
    // P0.2c: คัดเฉพาะไฟล์แนบที่แอดมินติ๊ก "ลูกค้าเห็น" (a.showToCustomer, ดู
    // js/orders-tab-modal-attach.js) ส่งเป็น designFiles แยกจาก attachments ทั้งก้อน —
    // normalizeOrderExtras()/upsertOrderTracking() (js/db-orders.js) จะ sanitize รูปทรง
    // { url, label, uploadedAt } อีกชั้นตอนบันทึกจริง (ไม่คัดลอก uploadedBy ไปด้วยตรงนี้ เพราะ
    // ไม่ใช่ข้อมูลที่ควรโชว์ public — ดูหมายเหตุเดียวกันใน normalizeOrderExtras())
    designFiles: currentAttachments
      .filter(a => a.showToCustomer)
      .map(a => ({ url: a.url, label: a.label || "", uploadedAt: a.uploadedAt || "" }))
  };
  const btn = orderForm.querySelector('button[type=submit]');
  btn.disabled = true; btn.textContent = "กำลังบันทึก...";
  try {
    if (id) {
      await updateOrder(id, payload);
      logAudit("update", "order", id, payload.code || payload.item || "");
    } else {
      await addOrder(payload);
    }
    closeOrderModal();
    showToast(id ? "บันทึกการแก้ไขแล้ว" : "เพิ่มคำสั่งผลิตแล้ว", "success");
  } catch (err) {
    showToast("บันทึกไม่สำเร็จ: " + err.message, "error");
  } finally {
    btn.disabled = false; btn.textContent = "บันทึก";
  }
});
