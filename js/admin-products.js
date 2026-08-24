// ===========================
// js/admin-products.js — แท็บ "สินค้า": กริด/ค้นหา/กรอง/pagination, bulk actions,
// popup แกลเลอรีสินค้าแนะนำ
//
// 2026 refactor phase 2: ย้ายมาจาก js/admin-page.js เดิม (ส่วน "PRODUCTS" บรรทัด 924-1297 เดิม
// รวมกับส่วนฟอร์ม/popup แกลเลอรีบรรทัด 1602-1809 เดิม) แบบไม่เปลี่ยน behavior ใดๆ
// ส่วน "PRODUCT OPTION AXES + VARIANT PRICE TABLE" (บรรทัด 1298-1810 เดิม) แยกไปอยู่
// admin-products-variants.js ต่างหาก เพราะเป็นคนละความรับผิดชอบ (ตัวเลือกสินค้า/ตารางราคา)
// — ไฟล์นี้เรียกใช้ผ่าน initVariantsForProduct/clearVariants/getCleanVariantsPayload ที่ export
// มาจากไฟล์นั้นตอนเปิด/ปิด/บันทึกฟอร์มสินค้า
//
// 2026 refactor phase 8: แยกส่วน "ฟอร์มเพิ่ม/แก้ไขสินค้า" (รวมรูปภาพที่กำลังแก้ไข) ออกไปเป็น
// js/admin-products-form.js (ใหม่) แบบ diff เป๊ะ ไม่มีเปลี่ยน logic — ไฟล์นี้เหลือแค่กริด/ค้นหา/
// กรอง/pagination/bulk actions/popup แกลเลอรีสินค้าแนะนำ เรียก openProductModal()/
// openProductModalClone() ที่ import กลับมาจากไฟล์ใหม่แทน — ไฟล์อื่นที่เคย import
// openProductModal จาก admin-products.js เดิม (เช่น admin-overview-dashboard.js) ยัง import
// จากที่นี่ได้เหมือนเดิมผ่าน re-export ด้านล่าง ไม่ต้องแก้ไฟล์นั้น
//
// fillCategorySelects/groupName/imageGridHTML/handleImageUpload ย้ายไป admin-utils.js แล้ว
// (ใช้ร่วมกันหลายแท็บ) — ไฟล์นี้ import มาใช้แทน ไม่มีนิยามซ้ำ
//
// 2026 refactor phase 24: แยกส่วน "popup แกลเลอรีสินค้าแนะนำ" (openProductGalleryPopup +
// setPViewImage/closeProductGalleryPopup ภายใน + DOM ref ทั้งหมดของ popup นี้) ออกไปเป็น
// js/admin-products-gallery.js (ใหม่) แบบ diff เป๊ะ ไม่มีเปลี่ยน logic — เรียก
// openProductGalleryPopup() กลับมาจากไฟล์ใหม่แทนฟังก์ชัน local เดิมตอนคลิกรูปสินค้า
// featured ในกริด (จุดเดียวที่เคยเรียกในไฟล์นี้) — ไฟล์นี้เหลือแค่กริด/ค้นหา/กรอง/
// pagination/bulk actions
// ===========================
import { saveProduct, deleteProduct } from "./db-products.js";
import { allProducts, pendingDeleteProductIds } from "./admin-state.js";
import { confirmDialog, emptyStateHTML } from "./ui-helpers.js";
import { showToast, escapeHtml, imgUrl, catName,
         deleteWithUndo, buildPageList } from "./admin-utils.js";
import { openProductModal, openProductModalClone } from "./admin-products-form.js";
import { openProductGalleryPopup } from "./admin-products-gallery.js";
import { reloadAll } from "./admin-page.js";

// fillCategorySelects อยู่ใน admin-utils.js แล้ว (ใช้ร่วมกับ reloadAll() ใน admin-page.js) —
// re-export จากที่นี่เพื่อให้ admin-page.js import จาก admin-products.js ได้ตามเดิม
export { fillCategorySelects } from "./admin-utils.js";
// openProductModal ย้ายไป admin-products-form.js แล้ว (ดูหมายเหตุ phase 8 ด้านบน) — re-export
// จากที่นี่เพื่อให้ admin-overview-dashboard.js import จาก admin-products.js ได้ตามเดิม
export { openProductModal } from "./admin-products-form.js";

export const pGrid       = document.getElementById("ad-p-grid");
export const pSearch      = document.getElementById("ad-p-search");
export const pFilterCat   = document.getElementById("ad-p-filter-cat");
const pAddBtn      = document.getElementById("ad-p-add-btn");
const pPaginationBox  = document.getElementById("ad-p-pagination");
const pPaginationInfo = document.getElementById("ad-p-pagination-info");
const pPaginationBtns = document.getElementById("ad-p-pagination-btns");

const PRODUCTS_PAGE_SIZE = 12;
export let pCurrentPage = 1;
// setter สำหรับไฟล์นอก module นี้ (admin-global-search.js) — import binding เป็น live แต่ reassign
// ตรงๆ จากนอกไฟล์ไม่ได้ (ES module อ่านอย่างเดียว) ต้องผ่านฟังก์ชันนี้แทน
export function setPCurrentPage(v) { pCurrentPage = v; }
let selectedProductIds = new Set(); // bulk actions: id ที่ถูกเลือก (คงอยู่ข้ามการ re-render/หน้า)

// ── Bulk actions bar (เลือกหลายการ์ด + ลบ/เปลี่ยนสถานะทีเดียว) ──
const pBulkBar          = document.getElementById("ad-p-bulk-bar");
const pBulkCount        = document.getElementById("ad-p-bulk-count");
const pBulkClearBtn     = document.getElementById("ad-p-bulk-clear");
const pBulkStatusSelect = document.getElementById("ad-p-bulk-status-select");
const pBulkApplyBtn     = document.getElementById("ad-p-bulk-apply-status");
const pBulkDeleteBtn    = document.getElementById("ad-p-bulk-delete");

function getFilteredProducts() {
  let rows = allProducts.filter(p => !pendingDeleteProductIds.has(p.id));
  const term = pSearch.value.trim().toLowerCase();
  if (term) rows = rows.filter(p =>
    (p.name || "").toLowerCase().includes(term) || (p.code || "").toLowerCase().includes(term));
  if (pFilterCat.value) rows = rows.filter(p => p.cat_id === pFilterCat.value);
  return rows;
}

function renderProductsPagination(totalRows) {
  const totalPages = Math.max(1, Math.ceil(totalRows / PRODUCTS_PAGE_SIZE));
  if (pCurrentPage > totalPages) pCurrentPage = totalPages;
  if (pCurrentPage < 1) pCurrentPage = 1;

  if (!totalRows) {
    pPaginationBox.style.display = "none";
    return;
  }
  pPaginationBox.style.display = "flex";

  const start = (pCurrentPage - 1) * PRODUCTS_PAGE_SIZE + 1;
  const end = Math.min(totalRows, pCurrentPage * PRODUCTS_PAGE_SIZE);
  pPaginationInfo.textContent = `แสดง ${start}–${end} จาก ${totalRows} รายการ`;

  const pages = buildPageList(pCurrentPage, totalPages);
  pPaginationBtns.innerHTML = `
    <button class="cp-page-btn cp-page-nav" data-page="prev" ${pCurrentPage === 1 ? "disabled" : ""} aria-label="หน้าก่อนหน้า">‹</button>
    ${pages.map(p => p === "…"
      ? `<span class="cp-page-ellipsis">…</span>`
      : `<button class="cp-page-btn ${p === pCurrentPage ? "active" : ""}" data-page="${p}">${p}</button>`
    ).join("")}
    <button class="cp-page-btn cp-page-nav" data-page="next" ${pCurrentPage === totalPages ? "disabled" : ""} aria-label="หน้าถัดไป">›</button>
  `;
  pPaginationBtns.querySelectorAll(".cp-page-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      if (btn.disabled) return;
      if (btn.dataset.page === "prev") pCurrentPage = Math.max(1, pCurrentPage - 1);
      else if (btn.dataset.page === "next") pCurrentPage = Math.min(totalPages, pCurrentPage + 1);
      else pCurrentPage = Number(btn.dataset.page);
      renderProducts();
      pGrid.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  });
}

export function renderProducts() {
  const filteredRows = getFilteredProducts();

  if (!filteredRows.length) {
    const hasFilters = pSearch.value.trim() || pFilterCat.value;
    pGrid.innerHTML = hasFilters
      ? emptyStateHTML({ title: "ไม่พบสินค้าที่ตรงกับตัวกรอง", desc: "ลองเปลี่ยนคำค้นหรือหมวดหมู่ดูอีกครั้ง" })
      : emptyStateHTML({
          icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>`,
          title: "ยังไม่มีสินค้าในแคตตาล็อก",
          desc: "เพิ่มสินค้าแรกเพื่อเริ่มแสดงในหน้าเว็บและใช้ผูกกับคำสั่งผลิต",
          ctaLabel: "+ เพิ่มรายการแรก", ctaId: "ad-p-empty-add"
        });
    const emptyAddBtn = document.getElementById("ad-p-empty-add");
    if (emptyAddBtn) emptyAddBtn.addEventListener("click", () => openProductModal(null));
    renderProductsPagination(0);
    updateProductsBulkBar();
    return;
  }

  renderProductsPagination(filteredRows.length);
  const pageStart = (pCurrentPage - 1) * PRODUCTS_PAGE_SIZE;
  const rows = filteredRows.slice(pageStart, pageStart + PRODUCTS_PAGE_SIZE);

  pGrid.innerHTML = rows.map(p => {
    const imgs = (p.images || []).filter(img => imgUrl(img));
    const img = imgs[0] ? imgUrl(imgs[0]) : "";
    const visual = img
      ? `<img src="${img}" alt="${escapeHtml(p.name)}" class="port-photo" loading="lazy">`
      : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 21h18M5 21V7l8-4 8 4v14M9 21v-6h6v6"/></svg>`;
    const priceText = p.price ? `฿${Number(p.price).toLocaleString("th-TH")}${p.unit ? " / " + escapeHtml(p.unit) : ""}` : "สอบถามราคา";
    const isHidden = p.status === "hidden";
    return `
    <div class="port-card ad-card${isHidden ? " ad-card--hidden" : ""}" data-id="${p.id}" title="คลิกเพื่อแก้ไขสินค้า">
      <input type="checkbox" class="ad-card-check" data-id="${p.id}" ${selectedProductIds.has(p.id) ? "checked" : ""} aria-label="เลือกสินค้านี้">
      <div class="ad-card-actions">
        <button class="cp-icon-btn${p.featured ? " is-starred" : ""}" data-action="star" title="${p.featured ? "เอาออกจากสินค้าแนะนำ" : "ติดดาวเป็นสินค้าแนะนำ"}"><svg viewBox="0 0 24 24" fill="${p.featured ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2"><path d="M12 2l1.6 4.9H19l-4 3 1.5 5L12 12l-4.5 3 1.5-5-4-3h5.4z"/></svg></button>
        <button class="cp-icon-btn" data-action="edit" title="แก้ไข"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button>
        <button class="cp-icon-btn" data-action="clone" title="ทำซ้ำ (เปิดฟอร์มเพิ่มใหม่พร้อมข้อมูลเดิม)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
        <button class="cp-icon-btn danger" data-action="delete" title="ลบ"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg></button>
      </div>
      <div class="port-visual${img ? "" : " no-photo"}" data-action="${imgs.length ? "gallery" : ""}">
        ${visual}
        ${p.status === "hidden" ? `<span class="ad-card-status">ซ่อนอยู่</span>` : ""}
        ${p.featured ? `<div class="ad-card-feat-flag" title="สินค้าแนะนำ">${`<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l1.6 4.9H19l-4 3 1.5 5L12 12l-4.5 3 1.5-5-4-3h5.4z"/></svg>แนะนำ`}</div>` : ""}
        ${imgs.length > 1 ? `<span class="ad-card-imgcount">+${imgs.length - 1} รูป</span>` : ""}
      </div>
      <div class="ad-card-body">
        <div class="ad-card-toprow">
          <span class="ad-card-cat">${escapeHtml(catName(p.cat_id))}</span>
          ${p.code ? `<span class="ad-card-code">${escapeHtml(p.code)}</span>` : ""}
        </div>
        <span class="ad-card-name">${escapeHtml(p.name || "ไม่มีชื่อ")}</span>
        <span class="ad-card-price">${priceText}</span>
      </div>
    </div>`;
  }).join("");
  updateProductsBulkBar();
}

pSearch.addEventListener("input", () => { pCurrentPage = 1; renderProducts(); });
pFilterCat.addEventListener("change", () => { pCurrentPage = 1; renderProducts(); });

pGrid.addEventListener("click", async (e) => {
  const card = e.target.closest(".ad-card");
  if (!card) return;
  const id = card.dataset.id;
  const product = allProducts.find(p => p.id === id);
  if (!product) return;

  // คลิกที่เช็คบ็อกซ์เลือกการ์ด → ปล่อยให้ event "change" จัดการ ไม่ต้องเปิดแก้ไข
  if (e.target.closest(".ad-card-check")) return;

  const btn = e.target.closest("button[data-action]");
  if (btn) {
    if (btn.dataset.action === "star") {
      btn.disabled = true;
      try {
        await saveProduct({ ...product, id, featured: !product.featured });
        showToast(product.featured ? `เอา "${product.name || ""}" ออกจากสินค้าแนะนำแล้ว` : `ติดดาว "${product.name || ""}" เป็นสินค้าแนะนำแล้ว`, "success");
        await reloadAll();
      } catch (err) {
        showToast("อัปเดตไม่สำเร็จ: " + err.message);
        btn.disabled = false;
      }
      return;
    }
    if (btn.dataset.action === "edit") openProductModal(product);
    if (btn.dataset.action === "clone") openProductModalClone(product);
    if (btn.dataset.action === "delete") {
      if (await confirmDialog(`ลบสินค้า "${product.name || ""}" ใช่หรือไม่? การลบนี้ไม่สามารถย้อนกลับได้`, { title: "ลบสินค้า" })) {
        deleteWithUndo({
          pendingSet: pendingDeleteProductIds, id, renderFn: renderProducts,
          message: `ลบสินค้า "${product.name || ""}" แล้ว`,
          deleteFn: () => deleteProduct(id), onCommitted: reloadAll, targetType: "product"
        });
      }
    }
    return;
  }
  // คลิกที่รูปสินค้า "แนะนำ" (featured) → เปิด popup แกลเลอรีรูปภาพ
  if (e.target.closest('[data-action="gallery"]')) {
    openProductGalleryPopup(product);
    return;
  }
  // คลิกที่ตัวการ์ด (นอกเหนือจากปุ่ม/เช็คบ็อกซ์/แกลเลอรี) → เปิดฟอร์มแก้ไขสินค้าทันที
  // เพื่อให้ใช้งานง่ายขึ้น ไม่ต้อง hover หาไอคอนดินสอเล็กๆ ก่อน (โดยเฉพาะบนมือถือ/แท็บเล็ต)
  openProductModal(product);
});

// ── Bulk actions (เลือกหลายการ์ด + ลบ/เปลี่ยนสถานะทีเดียว) ──────────────────────────────
function updateProductsBulkBar() {
  if (!pBulkBar) return;
  pBulkCount.textContent = selectedProductIds.size;
  pBulkBar.classList.toggle("active", selectedProductIds.size > 0);
}

pGrid.addEventListener("change", (e) => {
  if (!e.target.classList.contains("ad-card-check")) return;
  const id = e.target.dataset.id;
  if (e.target.checked) selectedProductIds.add(id); else selectedProductIds.delete(id);
  updateProductsBulkBar();
});

if (pBulkClearBtn) {
  pBulkClearBtn.addEventListener("click", () => {
    selectedProductIds.clear();
    pGrid.querySelectorAll(".ad-card-check").forEach(cb => { cb.checked = false; });
    updateProductsBulkBar();
  });
}

if (pBulkApplyBtn) {
  pBulkApplyBtn.addEventListener("click", async () => {
    const status = pBulkStatusSelect.value;
    if (!status || !selectedProductIds.size) return;
    const ids = Array.from(selectedProductIds);
    pBulkApplyBtn.disabled = true;
    try {
      await Promise.all(ids.map(id => {
        const product = allProducts.find(p => p.id === id);
        return product ? saveProduct({ ...product, id, status }) : Promise.resolve();
      }));
      showToast(`เปลี่ยนสถานะแล้ว ${ids.length} รายการ`, "success");
      selectedProductIds.clear();
      pBulkStatusSelect.value = "";
      await reloadAll();
    } catch (err) {
      showToast("อัปเดตสถานะไม่สำเร็จ: " + err.message);
    } finally {
      pBulkApplyBtn.disabled = false;
      updateProductsBulkBar();
    }
  });
}

if (pBulkDeleteBtn) {
  pBulkDeleteBtn.addEventListener("click", async () => {
    if (!selectedProductIds.size) return;
    const ids = Array.from(selectedProductIds);
    if (!(await confirmDialog(`ลบสินค้าที่เลือก ${ids.length} รายการ? ไม่สามารถกู้คืนได้`, { title: "ลบหลายรายการ" }))) return;
    pBulkDeleteBtn.disabled = true;
    try {
      await Promise.all(ids.map(id => deleteProduct(id)));
      showToast(`ลบแล้ว ${ids.length} รายการ`, "success");
      selectedProductIds.clear();
      await reloadAll();
    } catch (err) {
      showToast("ลบไม่สำเร็จ: " + err.message);
    } finally {
      pBulkDeleteBtn.disabled = false;
      updateProductsBulkBar();
    }
  });
}

pAddBtn.addEventListener("click", () => openProductModal(null));
