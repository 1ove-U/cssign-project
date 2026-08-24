// ===========================
// js/admin-products-variant-table.js — ตัวสร้างชุดค่าผสม (variant builder) + ตารางราคาของ
// ชุดค่าผสม (variant price table)
//
// 2026 refactor phase 12: แยกออกจาก js/admin-products-variants.js เดิม (416 บรรทัด) — ย้าย
// "ตัวสร้างชุดค่าผสม" (renderVariantBuilder/cartesianCount/addManualVariantRow/
// fillAllCombinations) + "ตารางราคาของชุดค่าผสม" (renderVariantTable) + event listener ของ
// pVariantBuilderBox/pVariantTableBox ทั้งหมด ออกมาแบบ diff เป๊ะ ไม่เปลี่ยน logic ใดๆ
// state currentAxes/currentVariants ยังคงอยู่ที่ js/admin-products-variants.js (ไฟล์เดิม) เพราะ
// ฟังก์ชันที่ reassign array ทั้งก้อน (stripAxisFromVariants/removeVariantsUsingOption/
// initVariantsForProduct/clearVariants) ยังอยู่ไฟล์นั้น — ไฟล์นี้ import currentAxes/
// currentVariants แบบ live binding (อ่านค่าล่าสุดเสมอ ตาม spec ES module) แล้ว mutate ผ่าน
// .push()/.splice()/เปลี่ยน property (เช่น v.price = ...) เท่านั้น ไม่เคย reassign ตัวแปรทั้งก้อน
// จากไฟล์นี้เลยสักจุด จึงไม่ต้องมี setter ใดๆ (ต่างจาก pCurrentPage ที่เคยเจอปัญหามาก่อน เพราะ
// ที่นี่ไม่มีการ reassign ข้ามไฟล์ — เหมือนแพทเทิร์นเดียวกับ selectedLeadIds ใน
// admin-leads-actions.js ที่ mutate Set ในที่ไม่เคย reassign)
// ===========================
import { showToast, escapeHtml } from "./admin-utils.js";
import { currentAxes, currentVariants, axesWithOptionsList, ensureOptionCodes } from "./admin-products-variants.js";

const pVariantLabel    = document.getElementById("ad-p-variant-label");
const pVariantBuilderBox = document.getElementById("ad-p-variant-builder");
const pVariantTableBox = document.getElementById("ad-p-variant-table");

// แถบเลือกค่าจากแต่ละหมวด (ทีละ 1 ค่าต่อหมวด) แล้วกด "+ เพิ่มชุดค่าผสม" เพื่อสร้างแถวราคาแถวนั้น
// เอง — แอดมินเลือกเฉพาะชุดที่ต้องการขายจริง ไม่ต้องเอาทุกชุดผสมเหมือนเดิม
export function renderVariantBuilder() {
  const axes = axesWithOptionsList();
  if (!axes.length) { pVariantBuilderBox.innerHTML = ""; return; }
  pVariantBuilderBox.innerHTML = `
    <div class="ad-vb-row">
      ${axes.map((axis, ai) => `
        <select class="cl-input ad-vb-select" data-axis-id="${axis.id}" data-axis-idx="${ai}">
          <option value="">${escapeHtml(axis.label || "ตัวเลือก")}...</option>
          ${axis.options.filter((o) => (o.label || "").trim()).map((o) => `<option value="${o.id}">${escapeHtml(o.label.trim())}</option>`).join("")}
        </select>
      `).join("")}
      <button type="button" class="ad-upload-btn ad-vb-add-btn" id="ad-p-vb-add">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
        เพิ่มชุดค่าผสม
      </button>
    </div>
    <button type="button" class="ad-vb-fillall-btn" id="ad-p-vb-fillall">สร้างครบทุกชุดที่ยังไม่มี (${cartesianCount(axes)} ชุดรวม)</button>
  `;
}

function cartesianCount(axes) {
  return axes.reduce((n, ax) => n * Math.max(1, ax.options.filter((o) => (o.label || "").trim()).length), 1);
}

// เพิ่มแถวราคา 1 แถวจากค่าที่เลือกไว้ในตัวสร้างชุดค่าผสม — ถ้าชุดนี้มีอยู่แล้วจะแจ้งเตือนแทนการเพิ่มซ้ำ
function addManualVariantRow() {
  const axes = axesWithOptionsList();
  const selects = Array.from(pVariantBuilderBox.querySelectorAll(".ad-vb-select"));
  if (selects.some((s) => !s.value)) { showToast("กรุณาเลือกค่าให้ครบทุกหมวดก่อนเพิ่มชุดค่าผสม"); return; }

  axes.forEach((ax) => ensureOptionCodes(ax));
  const parts = selects.map((s) => {
    const axis = axes.find((a) => a.id === s.dataset.axisId);
    const opt = axis.options.find((o) => o.id === s.value);
    return { axisId: axis.id, optId: opt.id, axisLabel: axis.label, code: (opt.code || "").trim().toUpperCase(), label: opt.label.trim() };
  });
  const key = parts.map((p) => p.optId).join("|");
  if (currentVariants.some((v) => v.key === key)) { showToast("ชุดค่าผสมนี้มีอยู่ในตารางราคาแล้ว"); return; }

  currentVariants.push({ key, parts, price: "" });
  renderVariantTable();
  renderVariantBuilder();
}

// ทางลัด: เติมชุดค่าผสมที่ "ยังไม่มี" ในตารางให้ครบทุกไม้ผสมที่เป็นไปได้ (ไม่แตะแถว/ราคาที่มีอยู่แล้ว)
function fillAllCombinations() {
  const axes = axesWithOptionsList();
  if (!axes.length) return;
  axes.forEach((ax) => ensureOptionCodes(ax));

  let combos = [[]];
  axes.forEach((axis) => {
    const validOptions = axis.options.filter((o) => (o.label || "").trim());
    const next = [];
    combos.forEach((combo) => {
      validOptions.forEach((opt) => next.push(combo.concat([{ axisId: axis.id, optId: opt.id, axisLabel: axis.label, code: opt.code.trim().toUpperCase(), label: opt.label.trim() }])));
    });
    combos = next;
  });

  const existingKeys = new Set(currentVariants.map((v) => v.key));
  let added = 0;
  combos.forEach((parts) => {
    const key = parts.map((p) => p.optId).join("|");
    if (!existingKeys.has(key)) { currentVariants.push({ key, parts, price: "" }); added++; }
  });
  showToast(added ? `เพิ่ม ${added} ชุดค่าผสมที่ยังไม่มีในตาราง` : "มีครบทุกชุดค่าผสมในตารางแล้ว");
  renderVariantTable();
  renderVariantBuilder();
}

export function renderVariantTable() {
  const hasAxes = currentAxes.some((ax) => (ax.options || []).some((o) => (o.label || "").trim()));
  pVariantLabel.style.display = hasAxes ? "" : "none";
  if (!hasAxes) { pVariantTableBox.innerHTML = ""; return; }
  if (!currentVariants.length) {
    pVariantLabel.textContent = "ตารางราคา";
    pVariantTableBox.innerHTML = `<div class="ad-variant-empty">ยังไม่มีแถวราคา — เลือกค่าด้านบนแล้วกด "เพิ่มชุดค่าผสม" หรือกด "สร้างครบทุกชุด" เพื่อเริ่มต้น</div>`;
    return;
  }
  pVariantLabel.textContent = `ตารางราคา (${currentVariants.length} ชุดค่าผสม)`;
  const axes = axesWithOptionsList();
  pVariantTableBox.innerHTML = `
    <table class="ad-variant-table">
      <thead>
        <tr>
          <th class="ad-variant-th-num">#</th>
          <th>รหัสตัวเลือก</th>
          ${axes.map((ax) => `<th>${escapeHtml(ax.label || "ตัวเลือก")}</th>`).join("")}
          <th class="ad-variant-th-price">ราคา (บาท)</th>
          <th class="ad-variant-th-del"></th>
        </tr>
      </thead>
      <tbody>
        ${currentVariants.map((v, vi) => `
          <tr>
            <td class="ad-variant-td-num">${vi + 1}</td>
            <td><span class="ad-variant-sku">${escapeHtml(v.parts.map((p) => p.code.toUpperCase()).join("-"))}</span></td>
            ${axes.map((ax) => {
              const p = v.parts.find((pt) => pt.axisId === ax.id);
              return `<td>${p ? escapeHtml(p.label) : `<span class="ad-variant-na">—</span>`}</td>`;
            }).join("")}
            <td>
              <div class="ad-variant-price-wrap">
                ${vi > 0 ? `<button type="button" class="ad-variant-copy-btn" data-variant-idx="${vi}" title="คัดลอกราคาจากแถวบน">↓</button>` : ""}
                <span class="ad-variant-currency">฿</span>
                <input type="number" min="0" class="ad-variant-price-input" data-variant-idx="${vi}" placeholder="0" value="${v.price === "" ? "" : v.price}">
              </div>
            </td>
            <td><button type="button" class="ad-variant-del-btn" data-variant-idx="${vi}" title="ลบชุดค่าผสมนี้">×</button></td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

pVariantBuilderBox.addEventListener("click", (e) => {
  if (e.target.closest("#ad-p-vb-add")) addManualVariantRow();
  if (e.target.closest("#ad-p-vb-fillall")) fillAllCombinations();
});

pVariantTableBox.addEventListener("click", (e) => {
  const copyBtn = e.target.closest(".ad-variant-copy-btn");
  if (copyBtn) {
    const idx = Number(copyBtn.dataset.variantIdx);
    if (idx > 0 && currentVariants[idx - 1]) {
      currentVariants[idx].price = currentVariants[idx - 1].price;
      renderVariantTable();
    }
    return;
  }
  const delBtn = e.target.closest(".ad-variant-del-btn");
  if (delBtn) {
    const idx = Number(delBtn.dataset.variantIdx);
    currentVariants.splice(idx, 1);
    renderVariantTable();
  }
});

pVariantTableBox.addEventListener("input", (e) => {
  if (!e.target.classList.contains("ad-variant-price-input")) return;
  const idx = Number(e.target.dataset.variantIdx);
  currentVariants[idx].price = e.target.value === "" ? "" : Number(e.target.value);
});
