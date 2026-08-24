// ===========================
// js/admin-products-csv.js — Export/นำเข้าสินค้าเป็น/จาก CSV
//
// 2026 refactor phase 2: ย้ายมาจาก js/admin-page.js เดิม (ส่วน "Export CSV helpers" +
// "นำเข้าสินค้าจาก CSV") แบบไม่เปลี่ยน behavior ใดๆ — ผูก event listener ของตัวเองตอนโหลด
// ไฟล์ (เหมือนไฟล์เดิม) จึงไม่มีอะไรต้อง export ให้ไฟล์อื่นใช้
// ===========================
import { saveProduct } from "./db-products.js";
import { logAudit } from "./db.js";
import { allProducts, allCategories } from "./admin-state.js";
import { showToast, openOverlay, closeOverlay,
         downloadCsv, escapeHtml, catName } from "./admin-utils.js";
import { ovFormatBaht } from "./admin-overview-dashboard.js";
import { reloadAll } from "./admin-page.js";

// ── Export CSV helpers ──────────────────────────────
// ย้าย downloadCsv/csvCell ไป js/admin-utils.js แล้ว (2026 refactor phase 1)

// ส่งออกสินค้าทั้งหมดเป็น CSV — คอลัมน์ครบพอที่จะแก้ไขแล้ว "นำเข้ากลับ" ได้เลย (ดู ad-p-import-btn
// ด้านล่าง) จึงไม่ใช้แค่คอลัมน์แสดงผลสั้นๆ เหมือนเดิม (เดิมอ้าง p.sku ที่ไม่มีจริงในสคีมา ทำให้
// คอลัมน์รหัสสินค้าว่างเปล่าทุกแถว — สคีมาจริงใช้ field ชื่อ "code")
// หมายเหตุ: ไม่รวมรูปภาพ/ตัวเลือกสินค้า (variants) เพราะเป็นโครงสร้างซับซ้อนเกินจะเก็บในเซลล์เดียว
// ของ CSV ได้อย่างปลอดภัย — แก้ 2 ส่วนนี้ผ่านฟอร์มแก้ไขสินค้าตามปกติ
const PRODUCT_CSV_HEADERS = [
  "รหัสสินค้า (code)", "ชื่อสินค้า", "หมวดหมู่", "ราคา", "หน่วย", "วัสดุ", "ขนาด",
  "รายละเอียด", "สถานะ (active/hidden)", "แนะนำ (ใช่/ไม่ใช่)", "slug", "Meta Title", "Meta Description"
];
function productToCsvRow(p) {
  return [
    p.code || "", p.name || "", catName(p.cat_id), p.price ?? "", p.unit || "", p.material || "", p.size || "",
    p.description || "", p.status || "active", p.featured ? "ใช่" : "ไม่ใช่", p.slug || "", p.metaTitle || "", p.metaDescription || ""
  ];
}
document.getElementById("ad-p-export-btn").addEventListener("click", () => {
  const rows = allProducts.map(productToCsvRow);
  downloadCsv(`products-${new Date().toISOString().slice(0,10)}.csv`, PRODUCT_CSV_HEADERS, rows);
});

// เทมเพลตเปล่า (แถวตัวอย่าง 1 แถว) — ให้ดาวน์โหลดไปกรอกเพิ่มสินค้าใหม่หลายร้อยรายการใน Excel/Sheets
// ได้โดยไม่ต้อง export ของเดิมมาแก้ก่อน
document.getElementById("ad-p-import-template-btn").addEventListener("click", () => {
  const exampleRow = ["SIGN-001", "ป้ายทางหนีไฟ", allCategories[0] ? allCategories[0].name : "ความปลอดภัย", "350", "ชิ้น", "อลูมิเนียมคอมโพสิต", "30x40 ซม.", "ป้ายบอกทางหนีไฟ สะท้อนแสง มองเห็นชัดเจนในที่มืด", "active", "ไม่ใช่", "", "", ""];
  downloadCsv("products-import-template.csv", PRODUCT_CSV_HEADERS, [exampleRow]);
});

// ── นำเข้าสินค้าจาก CSV ──────────────────────────────
// แยกทีละ char เพราะ field รายละเอียดสินค้าอาจมีจุลภาค/ขึ้นบรรทัดใหม่อยู่ในเครื่องหมายคำพูด
// (แค่ split(",") ธรรมดาจะพังทันทีถ้ามีคำอธิบายสินค้าที่มีจุลภาคอยู่ข้างใน)
function parseCSV(text) {
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1); // ตัด BOM ของไฟล์ที่ export จากระบบนี้เอง
  const rows = [];
  let row = [], field = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false; }
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\r") { /* ข้าม — จบบรรทัดจริงรอ \n */ }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(cell => (cell || "").trim() !== ""));
}

// แปลงแต่ละแถวดิบจาก CSV เป็นข้อมูลสินค้า + ตรวจสอบความถูกต้อง — ไม่บันทึกอะไรลง Firestore ตรงนี้
// (แยกขั้นตอน "ตรวจ" ออกจาก "บันทึกจริง" เพื่อให้แสดงตัวอย่าง/ข้อผิดพลาดให้แอดมินยืนยันก่อนเสมอ)
function parseProductImportRows(text) {
  const table = parseCSV(text);
  if (table.length < 2) return [];
  const dataRows = table.slice(1); // แถวแรก = หัวคอลัมน์ ข้ามเสมอ ไม่พยายามเดาว่ามี header จริงไหม
  const catByName = new Map(allCategories.map(c => [c.name.trim().toLowerCase(), c.id]));
  const existingByCode = new Map(
    allProducts.filter(p => (p.code || "").trim()).map(p => [p.code.trim().toLowerCase(), p])
  );
  return dataRows.map((r, idx) => {
    const [code, name, catNameRaw, price, unit, material, size, description, status, featuredRaw, slug, metaTitle, metaDescription] = r;
    const errors = [];
    const cleanName = (name || "").trim();
    if (!cleanName) errors.push("ไม่มีชื่อสินค้า (คอลัมน์ 'ชื่อสินค้า' ห้ามว่าง)");

    const priceNum = Number(price);
    if ((price || "").trim() !== "" && (isNaN(priceNum) || priceNum < 0)) errors.push("ราคาต้องเป็นตัวเลขไม่ติดลบ");

    const cleanCatName = (catNameRaw || "").trim();
    const catId = catByName.get(cleanCatName.toLowerCase());
    if (cleanCatName && !catId) errors.push(`ไม่พบหมวดหมู่ "${cleanCatName}" — สะกดให้ตรงกับหน้า "หมวดหมู่" เป๊ะๆ (ดูตัวพิมพ์เล็ก/ใหญ่ เว้นวรรค)`);
    else if (!cleanCatName) errors.push("ไม่ได้ระบุหมวดหมู่");

    const statusNorm = (status || "active").trim().toLowerCase();
    if (statusNorm !== "active" && statusNorm !== "hidden") errors.push('สถานะต้องเป็น "active" หรือ "hidden" เท่านั้น');

    const cleanCode = (code || "").trim();
    const existing = cleanCode ? existingByCode.get(cleanCode.toLowerCase()) : null;

    return {
      rowNum: idx + 2,
      code: cleanCode,
      name: cleanName,
      catNameRaw: cleanCatName,
      catId: catId || "",
      price: isNaN(priceNum) ? 0 : priceNum,
      unit: (unit || "").trim(),
      material: (material || "").trim(),
      size: (size || "").trim(),
      description: (description || "").trim(),
      status: statusNorm === "hidden" ? "hidden" : "active",
      featured: /^(ใช่|yes|true|1)$/i.test((featuredRaw || "").trim()),
      slug: (slug || "").trim(),
      metaTitle: (metaTitle || "").trim(),
      metaDescription: (metaDescription || "").trim(),
      existingId: existing ? existing.id : null,
      errors
    };
  });
}

let pendingImportRows = [];
const pImportFileInput = document.getElementById("ad-p-import-file");
const pImportOverlay   = document.getElementById("ad-p-import-overlay");
const pImportTableBody = document.getElementById("ad-p-import-table-body");
const pImportSummary   = document.getElementById("ad-p-import-summary");
const pImportConfirm   = document.getElementById("ad-p-import-confirm");

document.getElementById("ad-p-import-btn").addEventListener("click", () => pImportFileInput.click());

pImportFileInput.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  e.target.value = ""; // เคลียร์ค่า input กันเลือกไฟล์เดิมซ้ำแล้วไม่เกิด "change" event
  if (!file) return;
  let text;
  try { text = await file.text(); } catch (err) { showToast("อ่านไฟล์ไม่สำเร็จ: " + err.message); return; }
  pendingImportRows = parseProductImportRows(text);
  renderImportPreview();
  openOverlay(pImportOverlay);
});

function renderImportPreview() {
  const rows = pendingImportRows;
  const errorRows  = rows.filter(r => r.errors.length);
  const updateRows = rows.filter(r => !r.errors.length && r.existingId);
  const newRows     = rows.filter(r => !r.errors.length && !r.existingId);

  pImportSummary.textContent = rows.length
    ? `พบทั้งหมด ${rows.length} แถว — เพิ่มใหม่ ${newRows.length} รายการ, อัปเดตของเดิม ${updateRows.length} รายการ (จับคู่ด้วยรหัสสินค้า), ข้าม ${errorRows.length} รายการ (มีปัญหา)`
    : "ไม่พบข้อมูลสินค้าในไฟล์นี้ — ตรวจว่าไฟล์มีอย่างน้อยแถวหัวคอลัมน์ + ข้อมูล 1 แถว";

  pImportTableBody.innerHTML = rows.map(r => {
    const badge = r.errors.length
      ? `<span class="ad-import-status error">ข้าม</span>${r.errors.map(e => `<span class="ad-import-error-msg">${escapeHtml(e)}</span>`).join("")}`
      : r.existingId
        ? `<span class="ad-import-status update">จะอัปเดต</span>`
        : `<span class="ad-import-status new">เพิ่มใหม่</span>`;
    return `<tr>
      <td>${r.rowNum}</td>
      <td>${escapeHtml(r.code || "—")}</td>
      <td>${escapeHtml(r.name || "—")}</td>
      <td>${escapeHtml(r.catNameRaw || "—")}</td>
      <td>${r.price ? ovFormatBaht(r.price) : "—"}</td>
      <td>${badge}</td>
    </tr>`;
  }).join("") || `<tr><td colspan="6" class="cp-empty">ไม่มีข้อมูล</td></tr>`;

  const importableCount = newRows.length + updateRows.length;
  pImportConfirm.disabled = importableCount === 0;
  pImportConfirm.textContent = importableCount ? `ยืนยันนำเข้า (${importableCount} รายการ)` : "ไม่มีรายการที่นำเข้าได้";
}

document.getElementById("ad-p-import-cancel").addEventListener("click", () => {
  closeOverlay(pImportOverlay);
  pendingImportRows = [];
});
// 2026 refactor — accessibility phase (รอบที่ 58): เดิม overlay นี้ไม่มีแม้แต่
// backdrop-click-to-close เลย (ต่างจาก overlay อื่นทุกตัวใน admin.html) — เพิ่มให้เหมือนกัน
// (mirror พฤติกรรมปุ่ม "ยกเลิก" ด้านบนเป๊ะ) จำเป็นสำหรับกลไก Escape ใหม่แบบรวมศูนย์ใน
// admin-utils.js ด้วย (ยิง synthetic click ใส่ตัว overlay เอง — ถ้าไม่มี listener นี้ Escape
// จะปิด modal นี้ไม่ได้)
pImportOverlay.addEventListener("click", (e) => {
  if (e.target === pImportOverlay) {
    closeOverlay(pImportOverlay);
    pendingImportRows = [];
  }
});

pImportConfirm.addEventListener("click", async () => {
  const rowsToImport = pendingImportRows.filter(r => !r.errors.length);
  if (!rowsToImport.length) return;
  pImportConfirm.disabled = true;
  let done = 0, failed = 0;
  const CHUNK = 15; // ทยอยบันทึกทีละกลุ่มเล็กๆ แทนยิงพร้อมกันหมดหลายร้อยรายการ กัน request ล้น/ค้าง
  for (let i = 0; i < rowsToImport.length; i += CHUNK) {
    const chunk = rowsToImport.slice(i, i + CHUNK);
    const results = await Promise.allSettled(chunk.map(r => {
      // สินค้าที่มีอยู่แล้ว (จับคู่ด้วยรหัสสินค้า): ต้องส่ง images/optionAxes/variants/tags เดิมกลับไปด้วย
      // เพราะ saveProduct() เขียนทับทั้งเอกสาร ไม่ใช่แก้เฉพาะ field ที่ส่งมา — ถ้าไม่ส่งของเดิมกลับไป
      // รูปภาพและตัวเลือกสินค้าที่เคยตั้งไว้จะหายไปทันทีตอนอัปเดตผ่าน CSV (CSV ไม่รองรับ 2 ฟิลด์นี้)
      const existingProduct = r.existingId ? allProducts.find(p => p.id === r.existingId) : null;
      return saveProduct({
        id: r.existingId || undefined,
        name: r.name, code: r.code, cat_id: r.catId, price: r.price, unit: r.unit,
        material: r.material, size: r.size, description: r.description, status: r.status,
        featured: r.featured, slug: r.slug, metaTitle: r.metaTitle, metaDescription: r.metaDescription,
        images:     existingProduct ? existingProduct.images     : [],
        optionAxes: existingProduct ? existingProduct.optionAxes : [],
        variants:   existingProduct ? existingProduct.variants   : [],
        tags:       existingProduct ? existingProduct.tags       : []
      });
    }));
    results.forEach(res => { if (res.status === "fulfilled") done++; else failed++; });
    pImportConfirm.textContent = `กำลังนำเข้า... (${Math.min(i + CHUNK, rowsToImport.length)}/${rowsToImport.length})`;
  }
  logAudit("create", "product-import-csv", "", `นำเข้าสินค้าจาก CSV: สำเร็จ ${done} รายการ${failed ? `, ล้มเหลว ${failed} รายการ` : ""}`);
  showToast(failed ? `นำเข้าสำเร็จ ${done} รายการ, ล้มเหลว ${failed} รายการ` : `นำเข้าสำเร็จ ${done} รายการ`, failed ? "error" : "success");
  closeOverlay(pImportOverlay);
  pendingImportRows = [];
  pImportConfirm.disabled = false;
  await reloadAll();
});
