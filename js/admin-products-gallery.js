// ===========================
// js/admin-products-gallery.js — Popup แกลเลอรีสินค้าแนะนำ (featured): ดูรูปทั้งหมด +
// รายละเอียดสินค้า เปิดจากการคลิกรูปสินค้าที่ติดดาว "แนะนำ" ในกริดของแท็บสินค้า
//
// 2026 refactor phase 24: แยกออกมาจาก js/admin-products.js เดิม (332 บรรทัด, ส่วนท้ายไฟล์
// บรรทัด 284-332 เดิม) แบบ diff เป๊ะ ไม่มีเปลี่ยน logic — จุดตัดไฟล์ที่เลือกเพราะเป็น section
// ที่ปิดตัวเองสมบูรณ์ที่สุดในไฟล์เดิม: grep แล้วไม่มีไฟล์อื่นอ้างถึง openProductGalleryPopup/
// pViewItem/pViewImages/setPViewImage/closeProductGalleryPopup/DOM ref ใดๆ ในกลุ่มนี้เลย
// นอกจาก admin-products.js เอง และเป็น one-way import ทางเดียว (admin-products.js เรียก
// openProductGalleryPopup() ตอนคลิกรูป featured ในกริด — ไฟล์นี้ไม่ import อะไรกลับจาก
// admin-products.js เลย เรียก openProductModal() ตรงจาก admin-products-form.js แทน) —
// ไม่ใช่ circular import
//
// export แค่ openProductGalleryPopup() ตัวเดียว (เป็นจุดเรียกเข้าเดียวที่ไฟล์นอกต้องใช้)
// ===========================
import { imgUrl, imgLabel, catName, escapeHtml, openOverlay, closeOverlay } from "./admin-utils.js";
import { openProductModal } from "./admin-products-form.js";

const pViewOverlay = document.getElementById("ad-p-view-overlay");
const pViewClose    = document.getElementById("ad-p-view-close");
const pViewImg      = document.getElementById("ad-p-view-img");
const pViewBadge    = document.getElementById("ad-p-view-badge");
const pViewThumbs   = document.getElementById("ad-p-view-thumbs");
const pViewCat      = document.getElementById("ad-p-view-cat");
const pViewTitle    = document.getElementById("ad-p-view-title");
const pViewDesc     = document.getElementById("ad-p-view-desc");
const pViewMeta     = document.getElementById("ad-p-view-meta");
const pViewEditBtn  = document.getElementById("ad-p-view-edit");
let pViewItem = null;
let pViewImages = [];

export function openProductGalleryPopup(item) {
  pViewItem = item;
  pViewImages = (item.images || []).filter(img => imgUrl(img));
  pViewBadge.textContent = catName(item.cat_id);
  pViewCat.textContent = catName(item.cat_id);
  pViewTitle.textContent = item.name || "ไม่มีชื่อ";
  pViewDesc.textContent = item.description || "";
  pViewDesc.style.display = item.description ? "" : "none";
  const priceText = item.price ? `฿${Number(item.price).toLocaleString("th-TH")}${item.unit ? " / " + item.unit : ""}` : "สอบถามราคา";
  const meta = [priceText, item.material, item.size].filter(Boolean);
  pViewMeta.innerHTML = meta.map(m => `<span>${escapeHtml(m)}</span>`).join("");
  pViewThumbs.innerHTML = pViewImages.length > 1
    ? pViewImages.map((img, i) => `<button type="button" class="ad-pf-view-thumb${i === 0 ? " active" : ""}" data-idx="${i}" title="${escapeHtml(imgLabel(img))}"><img src="${imgUrl(img)}" alt="${escapeHtml(item.name || "สินค้า")}${imgLabel(img) ? " — " + escapeHtml(imgLabel(img)) : ""}" loading="lazy"></button>`).join("")
    : "";
  setPViewImage(0);
  openOverlay(pViewOverlay);
}
function setPViewImage(idx) {
  if (!pViewImages.length) { pViewImg.src = ""; pViewImg.alt = ""; return; }
  pViewImg.src = imgUrl(pViewImages[idx]);
  pViewImg.alt = imgLabel(pViewImages[idx]) || (pViewItem && pViewItem.name) || "";
  pViewThumbs.querySelectorAll(".ad-pf-view-thumb").forEach((t, i) => t.classList.toggle("active", i === idx));
}
function closeProductGalleryPopup() { closeOverlay(pViewOverlay); }

pViewClose.addEventListener("click", closeProductGalleryPopup);
pViewOverlay.addEventListener("click", (e) => { if (e.target === pViewOverlay) closeProductGalleryPopup(); });
pViewThumbs.addEventListener("click", (e) => {
  const t = e.target.closest(".ad-pf-view-thumb");
  if (t) setPViewImage(Number(t.dataset.idx));
});
pViewEditBtn.addEventListener("click", () => {
  closeProductGalleryPopup();
  if (pViewItem) openProductModal(pViewItem);
});
