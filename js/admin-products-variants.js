// ===========================
// js/admin-products-variants.js — Product option axes + manually-built variant price table
//
// 2026 refactor phase 2: ย้ายมาจาก js/admin-page.js เดิม (ส่วน "PRODUCT OPTION AXES +
// MANUALLY-BUILT VARIANT PRICE TABLE" บรรทัด 1298-1810 เดิม) แบบไม่เปลี่ยน behavior ใดๆ
// — เก็บ state ของ "แกนตัวเลือก" (currentAxes) และ "ตารางราคาของชุดค่าผสม" (currentVariants)
// ไว้ในไฟล์นี้เอง (เดิมเป็นตัวแปรระดับไฟล์ร่วมกับ admin-page.js เดิม) แล้ว export
// ฟังก์ชันที่ admin-products.js ต้องเรียกใช้ตอนเปิด/ปิด/บันทึกฟอร์มสินค้า:
//   - initVariantsForProduct(product) — โหลดตัวเลือก+ราคาที่เคยกรอกไว้กลับเข้าฟอร์ม (ตอนเปิดแก้ไข/เพิ่ม)
//   - clearVariants() — เคลียร์ตัวเลือกทั้งหมด (ตอนปิดฟอร์ม)
//   - getCleanVariantsPayload() — คำนวณ optionAxes/variants ที่พร้อมบันทึกลง Firestore + ราคาอัตโนมัติ
//     (ตอนกด submit ฟอร์ม)
// ตัวอย่าง: แกน "ขนาด" มีค่า 20×30/30×45, แกน "เกรด" มีค่า Commercial/Engineer,
// แกน "วัสดุรองหลัง" มีค่า อลูมิเนียม/อะคริลิค — แอดมิน "เลือกเอง" ว่าจะเอาค่าไหนของ
// แต่ละแกนมาผสมกันเป็นแถวราคา ไม่บังคับต้องมีครบทุกชุดผสม (cartesian) เหมือนเดิม
// มีปุ่ม "สร้างครบทุกชุดที่ยังไม่มี" ไว้เป็นทางลัดถ้าต้องการราคาครบทุกชุดจริงๆ
//
// 2026 refactor phase 12: แยกส่วน "ตัวสร้างชุดค่าผสม" (renderVariantBuilder/cartesianCount/
// addManualVariantRow/fillAllCombinations) + "ตารางราคาของชุดค่าผสม" (renderVariantTable) ออกไป
// เป็น js/admin-products-variant-table.js (ใหม่) — ไฟล์นี้เหลือ: การจัดการหมวด/ค่าตัวเลือก (axes
// CRUD), state currentAxes/currentVariants (ตอนนี้ export เป็น live binding ให้ไฟล์ใหม่อ่านได้),
// และ API 3 ตัวที่ admin-products.js เรียกใช้ (initVariantsForProduct/clearVariants/
// getCleanVariantsPayload) — renderAxes() import renderVariantBuilder()/renderVariantTable() จาก
// ไฟล์ใหม่กลับมาเรียกท้ายฟังก์ชัน (circular import ตั้งใจ ปลอดภัยเพราะเรียกใช้ตอน event/ฟังก์ชัน
// ทำงานเท่านั้น ไม่ใช่ตอน module evaluate — แพทเทิร์นเดียวกับไฟล์อื่นๆ ที่แยกมาก่อนหน้านี้ทั้งหมด)
// ===========================
import { escapeHtml, genLocalId } from "./admin-utils.js";
import { renderVariantBuilder, renderVariantTable } from "./admin-products-variant-table.js";

// ── Product option axes (ตัวเลือกสินค้าที่แอดมินกำหนดเอง เช่น ชนิดของป้าย /
//    ชนิดของแผ่นรองหลัง / ขนาดของป้าย) + ตารางราคาของทุกชุดค่าผสม (variants) ──
const pAxesBox        = document.getElementById("ad-p-axes");
const pAxisAddBtn      = document.getElementById("ad-p-axis-add");

export let currentAxes = [];    // [{ id, label, options: [{ code, label }] }]
export let currentVariants = []; // [{ key, codes: [...], price }] — key = codes.join("|"), 1 แถวต่อ 1 ชุดค่าผสม

// รหัสตัวเลือก (code) แอดมินพิมพ์เองได้ (เช่น CST, EST ให้ตรงกับ SKU จริงของบริษัท) ในช่องเล็กๆ
// หน้าค่าตัวเลือกแต่ละค่า — ถ้าเว้นว่างไว้ ระบบจะเติมให้อัตโนมัติเป็น A, B, C, ... ตามลำดับ
// (ค่าเดิมที่เคยมีรหัสอยู่แล้วจะไม่ถูกเปลี่ยน เพื่อไม่ให้ราคาที่กรอกไว้เดิมหลุดหาย)
function optionLetter(i) {
  let n = i + 1, s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}
export function ensureOptionCodes(axis) {
  const opts = (axis.options || []).filter((o) => (o.label || "").trim());
  const used = new Set(opts.map((o) => (o.code || "").trim().toUpperCase()).filter(Boolean));
  opts.forEach((o) => {
    if (!(o.code || "").trim()) {
      let i = 0, candidate;
      do { candidate = optionLetter(i); i++; } while (used.has(candidate));
      o.code = candidate;
      used.add(candidate);
    }
  });
}

// อ้างอิงค่าตัวเลือกด้วย id ที่คงที่ (ไม่ผูกกับ code/label ที่แก้ไขได้ภายหลัง) เพื่อให้แถว
// ราคาที่แอดมินเลือกไว้แล้วไม่หลุดหายเวลาเปลี่ยนชื่อ/รหัสค่าตัวเลือกภายหลัง
export function axesWithOptionsList() {
  return currentAxes.filter((ax) => (ax.options || []).some((o) => (o.label || "").trim()));
}

// เมื่อเปลี่ยนชื่อหมวด/ชื่อค่า/รหัสค่า ให้อัปเดตข้อความที่โชว์ในแถวราคาที่มีอยู่แล้วตาม (ไม่ลบแถวทิ้ง)
function syncVariantLabels() {
  const axisById = {};
  currentAxes.forEach((ax) => { axisById[ax.id] = ax; });
  currentVariants.forEach((v) => {
    v.parts.forEach((p) => {
      const axis = axisById[p.axisId];
      if (!axis) return;
      p.axisLabel = axis.label;
      const opt = (axis.options || []).find((o) => o.id === p.optId);
      if (opt) { p.label = opt.label.trim(); p.code = (opt.code || "").trim().toUpperCase() || p.code; }
    });
  });
}

// เมื่อลบ "หมวด" ตัวเลือกทั้งหมวดทิ้ง — เอามิติของหมวดนั้นออกจากทุกแถวราคาที่มีอยู่ (ไม่ลบทั้งแถว)
// แล้วรวมแถวที่ซ้ำกันหลังตัดมิติออก (เหลือแถวแรกไว้พร้อมราคาที่เคยกรอก)
function stripAxisFromVariants(axisId) {
  currentVariants.forEach((v) => { v.parts = v.parts.filter((p) => p.axisId !== axisId); });
  const seen = new Set();
  currentVariants = currentVariants.filter((v) => {
    v.key = v.parts.map((p) => p.optId).join("|");
    if (!v.parts.length) return false;
    if (seen.has(v.key)) return false;
    seen.add(v.key);
    return true;
  });
}

// เมื่อลบ "ค่า" ตัวเลือกค่าใดค่าหนึ่งออกจากหมวด — แถวราคาที่ใช้ค่านั้นอยู่ไม่มีความหมายอีกต่อไป ตัดทิ้ง
function removeVariantsUsingOption(optId) {
  currentVariants = currentVariants.filter((v) => !v.parts.some((p) => p.optId === optId));
}

// เมื่อสินค้ามี "ตัวเลือกสินค้า" (axes) ตั้งไว้อย่างน้อย 1 หมวด → ช่อง "วัสดุ/ขนาด" แบบเดิม
// และช่อง "ราคา" ที่กรอกเอง กลายเป็นข้อมูลซ้ำซ้อนที่ทำให้แอดมินสับสนว่าต้องกรอกช่องไหนกันแน่
// (เคยเป็นสาเหตุที่หน้าเว็บโชว์ "วัสดุ: -" / "ขนาด: -" ทั้งที่ตั้งตัวเลือกไว้แล้ว) — ซ่อนช่องที่ไม่จำเป็น
// เหล่านี้โดยอัตโนมัติเมื่อมีตัวเลือกแล้ว โดยไม่ลบค่าที่เคยกรอกไว้ทิ้ง (เผื่อลบตัวเลือกออกภายหลัง)
function syncLegacyFieldsVisibility() {
  const hasAxes = currentAxes.some((ax) => (ax.options || []).some((o) => (o.label || "").trim()));
  const legacyRow = document.getElementById("ad-p-legacy-row");
  const priceWrap = document.getElementById("ad-p-price-wrap");
  const priceHint = document.getElementById("ad-p-price-hint");
  const priceInput = document.getElementById("ad-p-price");
  if (legacyRow) legacyRow.style.display = hasAxes ? "none" : "";
  if (priceHint) priceHint.style.display = hasAxes ? "" : "none";
  if (priceWrap) priceWrap.classList.toggle("is-auto", hasAxes);
  if (priceInput) priceInput.disabled = hasAxes;
}

function renderAxes() {
  syncLegacyFieldsVisibility();
  if (!currentAxes.length) {
    pAxesBox.innerHTML = `<div class="ad-img-empty">ยังไม่มีตัวเลือกสินค้า — กด "เพิ่มหมวดตัวเลือก" ด้านล่างถ้าสินค้านี้มีหลายแบบ/หลายราคา</div>`;
  } else {
    pAxesBox.innerHTML = currentAxes.map((axis, ai) => `
      <div class="ad-axis-card" data-axis-idx="${ai}">
        <div class="ad-axis-head">
          <input class="cl-input ad-axis-label-input" data-axis-idx="${ai}" placeholder='ชื่อหมวด เช่น "ขนาด"' value="${escapeHtml(axis.label)}">
          <button type="button" class="ad-axis-remove" data-axis-idx="${ai}" title="ลบหมวดนี้">×</button>
        </div>
        <div class="ad-axis-options" data-axis-idx="${ai}">
          ${(axis.options || []).map((opt, oi) => `
            <span class="ad-axis-option">
              <input class="ad-opt-code" data-axis-idx="${ai}" data-opt-idx="${oi}" maxlength="6" placeholder="รหัส" value="${escapeHtml(opt.code || "")}" title="รหัสย่อ (ไม่บังคับ) — ใช้ในคอลัมน์ SKU ของตารางราคา">
              <input class="ad-opt-label" data-axis-idx="${ai}" data-opt-idx="${oi}" placeholder="เช่น Commercial Grade" value="${escapeHtml(opt.label)}">
              <button type="button" class="ad-opt-remove" data-axis-idx="${ai}" data-opt-idx="${oi}" title="ลบค่านี้">×</button>
            </span>
          `).join("")}
          <button type="button" class="ad-axis-option-add" data-axis-idx="${ai}">+ เพิ่มค่า</button>
        </div>
      </div>
    `).join("");
  }
  renderVariantBuilder();
  renderVariantTable();
}

pAxisAddBtn.addEventListener("click", () => {
  currentAxes.push({ id: genLocalId(), label: "", options: [{ id: genLocalId(), code: "", label: "" }] });
  renderAxes();
});

pAxesBox.addEventListener("click", (e) => {
  const axisIdx = e.target.dataset.axisIdx != null ? Number(e.target.dataset.axisIdx) : null;

  if (e.target.closest(".ad-axis-remove")) {
    stripAxisFromVariants(currentAxes[axisIdx].id);
    currentAxes.splice(axisIdx, 1);
    renderAxes();
    return;
  }
  if (e.target.closest(".ad-axis-option-add")) {
    currentAxes[axisIdx].options.push({ id: genLocalId(), code: "", label: "" });
    renderAxes();
    return;
  }
  if (e.target.closest(".ad-opt-remove")) {
    const optIdx = Number(e.target.dataset.optIdx);
    const removedOpt = currentAxes[axisIdx].options[optIdx];
    if (removedOpt) removeVariantsUsingOption(removedOpt.id);
    currentAxes[axisIdx].options.splice(optIdx, 1);
    renderAxes();
    return;
  }
});

pAxesBox.addEventListener("input", (e) => {
  const axisIdx = e.target.dataset.axisIdx != null ? Number(e.target.dataset.axisIdx) : null;
  if (axisIdx == null) return;

  if (e.target.classList.contains("ad-axis-label-input")) {
    currentAxes[axisIdx].label = e.target.value;
    syncVariantLabels();
    renderVariantBuilder();
    renderVariantTable();
    return;
  }
  const optIdx = e.target.dataset.optIdx != null ? Number(e.target.dataset.optIdx) : null;
  if (optIdx == null) return;
  if (e.target.classList.contains("ad-opt-label")) {
    currentAxes[axisIdx].options[optIdx].label = e.target.value;
    syncVariantLabels();
    renderVariantBuilder();
    renderVariantTable();
    return;
  }
  if (e.target.classList.contains("ad-opt-code")) {
    currentAxes[axisIdx].options[optIdx].code = e.target.value.toUpperCase();
    syncVariantLabels();
    renderVariantTable();
  }
});

// ราคาต่ำสุดในตารางตัวเลือก ใช้เป็น "ราคาเริ่มต้น" ของสินค้า (การ์ดหน้าเว็บ/listing แสดงค่านี้)
// คืนค่า null ถ้ายังไม่มีตัวเลือก/ยังไม่ได้กรอกราคาเลยสักแถว — ให้ใช้ช่องราคาที่กรอกเองแทน
function recomputeVariantPrice() {
  const prices = currentVariants.map((v) => Number(v.price)).filter((n) => !isNaN(n) && n > 0);
  return prices.length ? Math.min(...prices) : null;
}

// ── API ที่ admin-products.js เรียกใช้ตอนเปิด/ปิด/บันทึกฟอร์มสินค้า ──────────────────────────────

// เรียกตอนเปิดฟอร์มแก้ไข/เพิ่มสินค้า (openProductModal) — โหลดตัวเลือกสินค้า (optionAxes) +
// ราคาที่เคยกรอกไว้ (variants) กลับเข้าตัวแก้ไข แล้ว render ทันที
// — สินค้าเก่าที่ไม่เคยมีตัวเลือกจะได้ currentAxes = [] และช่องราคา/วัสดุ/ขนาดแบบเดิมยังใช้ได้ตามปกติ
// ข้อมูลที่บันทึกไว้เดิมมีแค่ code/label (ไม่มี id) จึงต้องสร้าง id ให้แต่ละหมวด/ค่าใหม่ตอนโหลด
// แล้วจับคู่แถวราคาเดิม (v.codes เรียงตามลำดับหมวดตอนบันทึก) เข้ากับ id ที่สร้างขึ้นผ่านรหัส (code)
export function initVariantsForProduct(product) {
  currentAxes = product && product.optionAxes
    ? product.optionAxes.map((ax) => ({
        id: genLocalId(),
        label: ax.label || "",
        options: (ax.options || []).map((o) => ({ id: genLocalId(), code: o.code || "", label: o.label || "" }))
      }))
    : [];
  currentVariants = [];
  if (product && product.variants) {
    product.variants.forEach((v) => {
      const codes = v.codes || [];
      const parts = codes.map((code, i) => {
        const axis = currentAxes[i];
        if (!axis) return null;
        const opt = axis.options.find((o) => (o.code || "").toUpperCase() === String(code).toUpperCase());
        if (!opt) return null;
        return { axisId: axis.id, optId: opt.id, axisLabel: axis.label, code: opt.code.toUpperCase(), label: opt.label };
      });
      if (parts.some((p) => !p) || !parts.length) return; // ข้ามแถวที่จับคู่ไม่ได้ (โครงสร้างหมวดเปลี่ยนไปจากตอนบันทึก)
      currentVariants.push({ key: parts.map((p) => p.optId).join("|"), parts, price: v.price });
    });
  }
  renderAxes();
}

// เรียกตอนปิดฟอร์มสินค้า (closeProductModal) — เคลียร์ตัวเลือกทั้งหมดทิ้ง
export function clearVariants() {
  currentAxes = [];
  currentVariants = [];
  renderAxes();
}

// เรียกตอน submit ฟอร์มสินค้า — ตัดหมวด/ค่าที่กรอกไม่ครบ (ไม่มีชื่อหมวด หรือไม่มีค่าเลย) ออกก่อนบันทึก
// รหัสของแต่ละค่า (code) ไม่ต้องให้แอดมินพิมพ์เอง ระบบเติมอัตโนมัติให้ (เก็บรหัสเดิมของสินค้าเก่าไว้
// ไม่เปลี่ยน) พร้อมคำนวณ "ราคาเริ่มต้น" อัตโนมัติจากราคาต่ำสุดในตาราง (null ถ้ายังไม่มีตัวเลือก/ราคา)
export function getCleanVariantsPayload() {
  const cleanAxes = currentAxes
    .map((ax) => {
      ensureOptionCodes(ax);
      const validOptions = (ax.options || []).filter((o) => (o.label || "").trim());
      return {
        id: ax.id || genLocalId(),
        label: (ax.label || "").trim(),
        options: validOptions.map((o) => ({ code: o.code.trim().toUpperCase(), label: o.label.trim() }))
      };
    })
    .filter((ax) => ax.label && ax.options.length);

  const cleanVariants = cleanAxes.length
    ? currentVariants
        .filter((v) => v.parts && v.parts.length === cleanAxes.length)
        .map((v) => ({ codes: v.parts.map((p) => p.code.trim().toUpperCase()), price: Number(v.price) || 0 }))
    : [];

  const autoPrice = recomputeVariantPrice();

  return { optionAxes: cleanAxes, variants: cleanVariants, autoPrice };
}
