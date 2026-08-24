// ===========================
// js/quotation-view.js — ควบคุมหน้า "ดูใบเสนอราคา" สาธารณะ (quotation-view.html) —
// P3.0 Phase 4 รอบ 2 (แสดงผลอย่างเดียว) + รอบ 5 (เพิ่มปุ่ม "ยอมรับ"/"ขอแก้ไข")
// ===========================
// อ่าน token จาก query param (?token=xxx) แล้วเรียก getQuotationByToken() (js/db-quotations.js,
// เพิ่มไว้แล้วใน Phase 4 รอบ 1) — pattern เดียวกับหน้า product-detail.html (skeleton/not-found/
// root 3 state คุมด้วย showOnly()) แต่ตัดส่วน gallery/related products ออกเพราะไม่เกี่ยวกับเอกสาร
//
// Phase 4 รอบ 5: ลูกค้าตอบรับ/ขอแก้ไขได้เองจากหน้านี้ผ่าน submitQuotationResponse() (data layer +
// firestore.rules พร้อมใช้แล้วตั้งแต่รอบ 4) — ถ้าเอกสารมี customerResponse อยู่แล้ว (โหลดมาตอน
// getQuotationByToken() หรือหลังตอบสำเร็จในรอบนี้เอง) ซ่อนปุ่มแล้วโชว์ badge สถานะที่ตอบไปแทนกัน
// กดซ้ำ (ชั้น data layer + firestore.rules ก็กันไว้อีกชั้นอยู่แล้ว แต่ UI กันไว้ก่อนกันสับสน)
//
// ฟังก์ชันคำนวณ/format ล้วนๆ ในไฟล์นี้ (formatQuoteDate/formatBaht/statusLabel/itemRowHTML/
// totalsHTML/customerInfoHTML/customerResponseText) เป็น pure function export ออกมาให้เทสตรงๆ ได้
// (ดู test/quotation-view.test.mjs) — ส่วนที่แตะ DOM จริง (init()) กันด้วย `if (!root) return`
// เหมือน js/my-orders-page.js ทุกประการ เพื่อให้ import ไฟล์นี้ในเทสได้โดยไม่ throw แม้ไม่มี
// markup ของหน้านี้อยู่ใน DOM
import { getQuotationByToken, submitQuotationResponse } from "./db-quotations.js";

export const QUOTATION_STATUS_LABEL = {
  draft:    "ร่าง",
  sent:     "ส่งลูกค้าแล้ว",
  accepted: "ลูกค้าตอบรับ",
  rejected: "ลูกค้าปฏิเสธ",
  expired:  "หมดอายุ",
  changes_requested: "ลูกค้าขอแก้ไข"
};

export function statusLabel(status) {
  return QUOTATION_STATUS_LABEL[status] || status || "ร่าง";
}

/** ข้อความสรุปหลังลูกค้าตอบรับ/ขอแก้ไขไปแล้ว (customerResponse.action) — ใช้แสดงในบล็อก
 *  "qv-response-done" แทนปุ่มเดิม */
export function customerResponseText(action) {
  if (action === "accepted") return "คุณตอบรับใบเสนอราคานี้แล้ว";
  if (action === "changes_requested") return "คุณส่งคำขอแก้ไขใบเสนอราคานี้แล้ว";
  return "";
}

export function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

/** ตัวเลขเป็นบาทแบบมีทศนิยม 2 ตำแหน่งเสมอ (ต่างจาก formatBaht() ฝั่งแอดมิน — orders-tab.js —
 *  ที่ปัดเป็นจำนวนเต็มเพื่อความกระชับในตาราง แต่เอกสารทางการต้องเห็นทศนิยมครบเพราะ VAT อาจมีเศษ) */
export function formatBaht(n) {
  const num = Number(n) || 0;
  return "฿" + num.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** แปลง Firestore Timestamp (หรือค่าอื่นที่คล้ายกัน)/undefined ให้เป็นข้อความวันที่ไทยอ่านง่าย —
 *  คืน "—" ถ้าไม่มีค่า (เอกสารเก่าก่อน Phase 4 หรือยังไม่มี validUntil) */
export function formatQuoteDate(ts) {
  if (!ts) return "—";
  const ms = ts.toMillis ? ts.toMillis() : (typeof ts === "number" ? ts : Date.parse(ts));
  if (!ms || Number.isNaN(ms)) return "—";
  return new Date(ms).toLocaleDateString("th-TH", { dateStyle: "long" });
}

/** วันที่ + เวลาออกเอกสาร (createdAt) — ต่างจาก formatQuoteDate() ที่ใช้กับ validUntil (แค่วันที่
 *  ไม่มีเวลา เพราะ validUntil ปกติกรอกเป็นวันที่ล้วนๆ ในฟอร์มแอดมิน) */
export function formatQuoteDateTime(ts) {
  if (!ts) return "—";
  const ms = ts.toMillis ? ts.toMillis() : (typeof ts === "number" ? ts : Date.parse(ts));
  if (!ms || Number.isNaN(ms)) return "—";
  return "วันที่ออกเอกสาร " + new Date(ms).toLocaleDateString("th-TH", { dateStyle: "long" });
}

/** HTML แถวเดียวของตารางรายการสินค้า — รับ item ที่ shape ตรงตาม sanitizeQuotationItem()
 *  ใน js/db-quotations.js (name/variantLabel/qty/unit/unitPrice/discount/lineTotal) */
export function itemRowHTML(item) {
  const it = item || {};
  const variantRow = it.variantLabel
    ? `<div class="qv-item-variant">${escapeHtml(it.variantLabel)}</div>`
    : "";
  return `
    <tr>
      <td><div class="qv-item-name">${escapeHtml(it.name || "")}</div>${variantRow}</td>
      <td class="qv-num">${escapeHtml(String(it.qty ?? ""))}</td>
      <td class="qv-num">${escapeHtml(it.unit || "")}</td>
      <td class="qv-num">${formatBaht(it.unitPrice)}</td>
      <td class="qv-num">${it.discount ? formatBaht(it.discount) : "—"}</td>
      <td class="qv-num">${formatBaht(it.lineTotal)}</td>
    </tr>`;
}

export function itemsTableHTML(items) {
  const list = Array.isArray(items) ? items : [];
  if (!list.length) {
    return `<tr><td colspan="6" style="text-align:center;color:var(--gray-400);padding:24px;">ไม่มีรายการสินค้า</td></tr>`;
  }
  return list.map(itemRowHTML).join("");
}

/** สรุปยอดตาม vatMode — "excluded" โชว์ subtotal + VAT บวกเพิ่ม, "included" โชว์ subtotal
 *  (รวม VAT แล้ว) + แยก VAT ให้ดูเฉยๆ, "none" ไม่โชว์แถว VAT เลย — ตรงกับ logic การคำนวณจริงใน
 *  computeQuotationTotals() (js/db-quotations.js) ทุกประการ ไฟล์นี้แค่ "แสดงผล" ค่าที่คำนวณ
 *  มาแล้วเท่านั้น ไม่คำนวณซ้ำ (เชื่อค่า subtotal/vatAmount/grandTotal ที่บันทึกไว้ในเอกสารตรงๆ) */
export function totalsHTML(quotation) {
  const q = quotation || {};
  const vatMode = q.vatMode || "excluded";
  const subtotal = q.subtotal || 0;
  const vatAmount = q.vatAmount || 0;
  const grandTotal = q.grandTotal || 0;

  const rows = [`<div class="qv-totals-row"><span>ยอดรวม</span><span>${formatBaht(subtotal)}</span></div>`];
  if (vatMode === "excluded") {
    rows.push(`<div class="qv-totals-row"><span>ภาษีมูลค่าเพิ่ม 7%</span><span>${formatBaht(vatAmount)}</span></div>`);
  } else if (vatMode === "included") {
    rows.push(`<div class="qv-totals-row"><span>ภาษีมูลค่าเพิ่ม 7% (รวมในราคาแล้ว)</span><span>${formatBaht(vatAmount)}</span></div>`);
  }
  rows.push(`<div class="qv-totals-row qv-grand"><span>ยอดสุทธิ</span><span>${formatBaht(grandTotal)}</span></div>`);
  return rows.join("");
}

/** บล็อกข้อมูลลูกค้า (ชื่อ/เลขผู้เสียภาษี/ที่อยู่ออกใบกำกับ/ผู้ติดต่อ/เบอร์/อีเมล) —
 *  ข้ามฟิลด์ที่ไม่มีค่าเงียบๆ (ไม่โชว์บรรทัดว่างเปล่า) */
export function customerInfoHTML(quotation) {
  const q = quotation || {};
  const lines = [];
  if (q.billingName) lines.push(`<div><strong>${escapeHtml(q.billingName)}</strong></div>`);
  if (q.taxId) lines.push(`<div class="qv-muted">เลขประจำตัวผู้เสียภาษี ${escapeHtml(q.taxId)}</div>`);
  if (q.billingAddress) lines.push(`<div>${escapeHtml(q.billingAddress)}</div>`);
  if (q.contactPerson) lines.push(`<div class="qv-muted">ผู้ติดต่อ ${escapeHtml(q.contactPerson)}</div>`);
  if (q.phone) lines.push(`<div class="qv-muted">โทร ${escapeHtml(q.phone)}</div>`);
  if (q.email) lines.push(`<div class="qv-muted">${escapeHtml(q.email)}</div>`);
  return lines.length ? lines.join("") : `<div class="qv-muted">—</div>`;
}

/** ที่อยู่จัดส่ง — fallback ไปใช้ billingAddress ถ้าไม่ได้กรอกที่อยู่จัดส่งแยกไว้ต่างหาก
 *  (สอดคล้องกับฟอร์มแอดมินที่ shippingAddress เป็นช่องเสริม ไม่บังคับกรอก) */
export function shippingInfoHTML(quotation) {
  const q = quotation || {};
  const addr = q.shippingAddress || q.billingAddress || "";
  return addr ? `<div>${escapeHtml(addr)}</div>` : `<div class="qv-muted">จัดส่งตามที่อยู่ออกใบกำกับภาษี</div>`;
}

// ===========================
// DOM wiring — เหมือน js/my-orders-page.js: guard ด้วย element ที่ต้องมีจริงก่อน แล้วค่อยทำงาน
// ต่อ กัน throw ตอนไฟล์นี้ถูก import ในหน้าอื่น/ในเทสที่ไม่มี markup ของหน้านี้
// ===========================
(function () {
  const skeletonEl = document.getElementById("qv-skeleton");
  const notFoundEl = document.getElementById("qv-not-found");
  const rootEl     = document.getElementById("qv-root");
  if (!skeletonEl || !notFoundEl || !rootEl) return; // ไม่ใช่หน้า quotation-view.html

  function showOnly(el) {
    [skeletonEl, notFoundEl, rootEl].forEach((e) => { if (e) e.style.display = "none"; });
    if (el) el.style.display = "";
  }

  function getToken() {
    const params = new URLSearchParams(window.location.search);
    return (params.get("token") || "").trim();
  }

  let loadedQuotation = null;

  function renderResponseState(quotation) {
    const formEl = document.getElementById("qv-response-form");
    const doneEl = document.getElementById("qv-response-done");
    if (!formEl || !doneEl) return;
    const cr = quotation && quotation.customerResponse;
    if (cr) {
      formEl.style.display = "none";
      doneEl.style.display = "";
      doneEl.dataset.action = cr.action || "";
      const textEl = document.getElementById("qv-response-done-text");
      if (textEl) textEl.textContent = customerResponseText(cr.action);
      const metaEl = document.getElementById("qv-response-done-meta");
      if (metaEl) metaEl.textContent = "เมื่อ " + formatQuoteDate(cr.respondedAt);
      const commentEl = document.getElementById("qv-response-done-comment");
      if (commentEl) {
        if (cr.comment) { commentEl.style.display = ""; commentEl.textContent = cr.comment; }
        else { commentEl.style.display = "none"; }
      }
    } else {
      formEl.style.display = "";
      doneEl.style.display = "none";
    }
  }

  function render(quotation) {
    loadedQuotation = quotation;
    document.getElementById("qv-quote-no").textContent = quotation.quoteNo ? `เลขที่ ${quotation.quoteNo}` : "—";
    document.getElementById("qv-quote-date").textContent = formatQuoteDateTime(quotation.createdAt);

    const badge = document.getElementById("qv-status-badge");
    const status = quotation.status || "draft";
    badge.dataset.status = status;
    badge.textContent = statusLabel(status);

    document.getElementById("qv-customer-info").innerHTML = customerInfoHTML(quotation);
    document.getElementById("qv-shipping-info").innerHTML = shippingInfoHTML(quotation);
    document.getElementById("qv-items-body").innerHTML = itemsTableHTML(quotation.items);
    document.getElementById("qv-totals").innerHTML = totalsHTML(quotation);
    document.getElementById("qv-payment-terms").textContent = quotation.paymentTerms || "ตามที่ตกลงกัน";
    document.getElementById("qv-valid-until").textContent = quotation.validUntil
      ? formatQuoteDate(Date.parse(quotation.validUntil))
      : "ไม่ระบุ";

    const notesWrap = document.getElementById("qv-notes-wrap");
    if (quotation.notes) {
      notesWrap.style.display = "";
      document.getElementById("qv-notes").textContent = quotation.notes;
    } else {
      notesWrap.style.display = "none";
    }

    document.title = `ใบเสนอราคา ${quotation.quoteNo || ""} — CS.SIGN`.trim();
    renderResponseState(quotation);
    showOnly(rootEl);
  }

  const printBtn = document.getElementById("qv-print-btn");
  if (printBtn) printBtn.addEventListener("click", () => window.print());

  // ── ปุ่ม "ยอมรับ"/"ขอแก้ไข" (P3.0 Phase 4 รอบ 5) ──────────────────────────────────
  const acceptBtn         = document.getElementById("qv-accept-btn");
  const requestChangesBtn = document.getElementById("qv-request-changes-btn");
  const actionsRow        = document.getElementById("qv-response-actions-row");
  const changesPanel      = document.getElementById("qv-changes-panel");
  const changesComment    = document.getElementById("qv-changes-comment");
  const changesSubmitBtn  = document.getElementById("qv-changes-submit-btn");
  const changesCancelBtn  = document.getElementById("qv-changes-cancel-btn");
  const responseErrorEl   = document.getElementById("qv-response-error");

  function setResponseError(msg) {
    if (!responseErrorEl) return;
    if (msg) { responseErrorEl.textContent = msg; responseErrorEl.style.display = ""; }
    else { responseErrorEl.style.display = "none"; }
  }

  function setResponseBusy(busy) {
    [acceptBtn, requestChangesBtn, changesSubmitBtn, changesCancelBtn].forEach((b) => {
      if (b) b.disabled = busy;
    });
  }

  async function handleResponseSubmit(action, comment) {
    setResponseError(null);
    setResponseBusy(true);
    try {
      await submitQuotationResponse(token, action, comment);
      const customerResponse = { action, comment: comment || "", respondedAt: Date.now() };
      if (loadedQuotation) {
        loadedQuotation.customerResponse = customerResponse;
        loadedQuotation.status = action;
      }
      const badge = document.getElementById("qv-status-badge");
      if (badge) { badge.dataset.status = action; badge.textContent = statusLabel(action); }
      renderResponseState(loadedQuotation || { customerResponse });
    } catch (err) {
      console.error("submitQuotationResponse error:", err);
      setResponseError((err && err.message) || "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
    } finally {
      setResponseBusy(false);
    }
  }

  if (acceptBtn) {
    acceptBtn.addEventListener("click", () => { handleResponseSubmit("accepted", ""); });
  }
  if (requestChangesBtn && changesPanel) {
    requestChangesBtn.addEventListener("click", () => {
      changesPanel.style.display = "";
      if (actionsRow) actionsRow.style.display = "none";
      setResponseError(null);
      if (changesComment) changesComment.focus();
    });
  }
  if (changesCancelBtn && changesPanel) {
    changesCancelBtn.addEventListener("click", () => {
      changesPanel.style.display = "none";
      if (actionsRow) actionsRow.style.display = "";
      if (changesComment) changesComment.value = "";
      setResponseError(null);
    });
  }
  if (changesSubmitBtn) {
    changesSubmitBtn.addEventListener("click", () => {
      const comment = changesComment ? changesComment.value.trim() : "";
      if (!comment) {
        setResponseError("กรุณาระบุรายละเอียดที่ต้องการแก้ไขก่อนส่ง");
        return;
      }
      handleResponseSubmit("changes_requested", comment);
    });
  }

  const token = getToken();
  if (!token) {
    showOnly(notFoundEl);
  } else {
    getQuotationByToken(token)
      .then((quotation) => {
        if (!quotation) { showOnly(notFoundEl); return; }
        render(quotation);
      })
      .catch((err) => {
        console.error("getQuotationByToken error:", err);
        showOnly(notFoundEl);
      });
  }
})();
