// ===========================
// js/admin-products-form.js — ฟอร์มเพิ่ม/แก้ไขสินค้า (โมดัล) + รูปภาพสินค้าที่กำลังแก้ไข
// แยกออกมาจาก js/admin-products.js (481 บรรทัด เดิม)
//
// 2026 refactor phase 8: แยกส่วน "ฟอร์มเพิ่ม/แก้ไขสินค้า" (บรรทัด 291-431 เดิมของ
// admin-products.js: renderImages()/รูปภาพที่กำลังแก้ไข (currentImages) + openProductModal()/
// openProductModalClone()/closeProductModal() + submit handler) ออกมาทั้งหมดแบบ diff เป๊ะ
// ไม่มีเปลี่ยน logic — เป็นจุดตัดที่สะอาด เพราะ "กริด/ค้นหา/กรอง/pagination/bulk actions/popup
// แกลเลอรีสินค้าแนะนำ" ที่เหลือใน admin-products.js ไม่มี state ร่วมกับฟอร์มนี้เลย (currentImages
// เป็น module-private ของไฟล์นี้ ไม่มีไฟล์อื่นอ่าน/เขียนตรงๆ)
//
// export ออกไปให้ admin-products.js (และไฟล์อื่นที่เคย import จาก admin-products.js เดิม เช่น
// admin-overview-dashboard.js — ยังคง import จาก admin-products.js ได้เหมือนเดิมผ่าน re-export)
// เรียกใช้:
//   - openProductModal(product) — เปิดฟอร์มเพิ่ม/แก้ไข (product = null สำหรับเพิ่มใหม่)
//   - openProductModalClone(product) — เปิดฟอร์ม "เพิ่ม" พร้อมข้อมูลเดิมกรอกไว้ให้ (ทำซ้ำ)
// ===========================
import { saveProduct } from "./db-products.js";
import { deleteImage } from "./db-media.js";
import { allProducts, allCategories } from "./admin-state.js";
import { confirmDialog } from "./ui-helpers.js";
import { attachInlineValidation, validateFormInline, attachUnsavedGuard } from "./ui-form-validation.js";
import { showToast, imgUrl, normalizeImage, slugify,
         wireCharCounter, imageGridHTML, handleImageUpload,
         openOverlay, closeOverlay } from "./admin-utils.js";
import { initVariantsForProduct, clearVariants, getCleanVariantsPayload } from "./admin-products-variants.js";
import { reloadAll } from "./admin-page.js";

const pOverlay   = document.getElementById("ad-p-overlay");
const pForm       = document.getElementById("ad-p-form");
const pModalTitle = document.getElementById("ad-p-modal-title");
const pCancelBtn  = document.getElementById("ad-p-cancel");
attachInlineValidation(pForm);

// ── สลับหมวด/แท็บในป๊อปอัพ (ข้อมูลพื้นฐาน/ราคา&ตัวเลือก/รูปภาพ/SEO ขั้นสูง) ──
// แพทเทิร์นเดียวกับ switchOdTab() ใน js/orders-tab-modal.js (ป๊อปอัพคำสั่งผลิต) — คัดลอกมา
// เฉพาะไฟล์นี้แทนการ import ข้ามไฟล์ เพราะ scope อยู่แค่ pForm ของฟอร์มนี้เท่านั้น ไม่มี state
// ร่วมกับป๊อปอัพคำสั่งผลิตเลย
function switchProductTab(tabName) {
  let activeTabBtn = null;
  pForm.querySelectorAll(".cp-od-tab").forEach(btn => {
    const isActive = btn.dataset.odTab === tabName;
    btn.classList.toggle("active", isActive);
    btn.setAttribute("aria-selected", isActive ? "true" : "false");
    if (isActive) activeTabBtn = btn;
  });
  pForm.querySelectorAll(".cp-od-panel").forEach(panel => {
    panel.classList.toggle("active", panel.dataset.odPanel === tabName);
  });
  if (activeTabBtn) activeTabBtn.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  pForm.scrollTop = 0;
}
pForm.querySelectorAll(".cp-od-tab").forEach(btn => {
  btn.addEventListener("click", () => switchProductTab(btn.dataset.odTab));
});

// Live "N / max" character counter for SEO meta title/description fields —
// maxlength on the input already hard-stops typing, but gives no feedback on
// how close you are, and Firestore's own limit (see firestore.rules) is the
// same number, so this is just a visible echo of a cap that already exists.
wireCharCounter("ad-p-meta-title", "ad-p-meta-title-count", 70);
wireCharCounter("ad-p-meta-desc", "ad-p-meta-desc-count", 160);

const pImagesBox  = document.getElementById("ad-p-images");
const pUploadInput = document.getElementById("ad-p-upload");
const pUploadStatus = document.getElementById("ad-p-upload-status");

let currentImages = []; // images of the product currently being edited

function renderImages() {
  pImagesBox.innerHTML = imageGridHTML(currentImages, true);
}

pImagesBox.addEventListener("click", async (e) => {
  const btn = e.target.closest(".ad-img-remove");
  if (!btn) return;
  const idx = Number(btn.dataset.idx);
  const url = imgUrl(currentImages[idx]);
  if (!(await confirmDialog("ลบรูปนี้ออกจากสินค้าใช่หรือไม่?", { title: "ลบรูปภาพ" }))) return;
  currentImages.splice(idx, 1);
  renderImages();
  try { await deleteImage(url); } catch { /* non-blocking */ }
});

pImagesBox.addEventListener("input", (e) => {
  const input = e.target.closest(".ad-img-tag-input");
  if (!input) return;
  const idx = Number(input.dataset.idx);
  if (currentImages[idx]) currentImages[idx] = { url: imgUrl(currentImages[idx]), label: input.value };
});

pUploadInput.addEventListener("change", async () => {
  const files = Array.from(pUploadInput.files || []);
  if (!files.length) return;
  await handleImageUpload(files, currentImages, renderImages, pUploadStatus, true);
  pUploadInput.value = "";
});

pCancelBtn.addEventListener("click", () => productFormGuard.guardedClose());
pOverlay.addEventListener("click", (e) => { if (e.target === pOverlay) productFormGuard.guardedClose(); });

const productFormGuard = attachUnsavedGuard({
  overlay: pOverlay, form: pForm, doClose: closeProductModal,
  getExtra: () => currentImages
});

export function openProductModal(product) {
  if (!allCategories.length) {
    showToast("กรุณาเพิ่มหมวดหมู่สินค้าอย่างน้อย 1 หมวดก่อนเพิ่มสินค้า (แท็บ \"หมวดหมู่\")");
    return;
  }
  pModalTitle.textContent = product ? "แก้ไขสินค้า" : "เพิ่มสินค้า";
  document.getElementById("ad-p-id").value       = product ? product.id : "";
  document.getElementById("ad-p-name").value     = product ? product.name || "" : "";
  document.getElementById("ad-p-code").value     = product ? product.code || "" : "";
  document.getElementById("ad-p-slug").value     = product ? product.slug || "" : "";
  document.getElementById("ad-p-cat").value      = product ? product.cat_id || "" : allCategories[0].id;
  document.getElementById("ad-p-status").value   = product ? (product.status || "active") : "active";
  document.getElementById("ad-p-price").value    = product ? product.price || "" : "";
  document.getElementById("ad-p-unit").value     = product ? product.unit || "" : "";
  document.getElementById("ad-p-material").value = product ? product.material || "" : "";
  document.getElementById("ad-p-size").value     = product ? product.size || "" : "";
  document.getElementById("ad-p-desc").value     = product ? product.description || "" : "";
  document.getElementById("ad-p-meta-title").value = product ? product.metaTitle || "" : "";
  document.getElementById("ad-p-meta-desc").value  = product ? product.metaDescription || "" : "";
  document.getElementById("ad-p-meta-title").dispatchEvent(new Event("input"));
  document.getElementById("ad-p-meta-desc").dispatchEvent(new Event("input"));
  document.getElementById("ad-p-featured").checked = product ? !!product.featured : false;
  currentImages = product ? (product.images || []).map(normalizeImage) : [];
  renderImages();
  pUploadStatus.textContent = "";

  // เปิดฟอร์มมาที่แท็บ "ข้อมูลพื้นฐาน" เสมอ ยกเว้นสินค้านี้เคยกรอก slug/SEO ไว้แล้ว —
  // กรณีนั้นเปิดตรงแท็บ "SEO ขั้นสูง" ให้เห็นทันที ไม่งั้นแอดมินจะเข้าใจผิดว่าข้อมูลหายไป
  switchProductTab(product && (product.slug || product.metaTitle || product.metaDescription) ? "seo" : "basic");

  // โหลดตัวเลือกสินค้า (optionAxes) + ราคาที่เคยกรอกไว้ (variants) กลับเข้าตัวแก้ไข —
  // ย้ายไป admin-products-variants.js แล้ว (ดูฟังก์ชันนั้นสำหรับรายละเอียด)
  initVariantsForProduct(product);

  openOverlay(pOverlay);
  productFormGuard.capture();
}

// "ทำซ้ำ" — เปิดฟอร์ม "เพิ่มสินค้า" พร้อมข้อมูลเดิมกรอกไว้ให้ (ไม่ใช่แก้ของเดิม) เพื่อกรอกเร็วขึ้น
// เวลามีสินค้าคล้ายกันหลายรายการ (เช่น ขนาด/สีต่างกันแต่ข้อมูลอื่นเหมือนเดิม)
export function openProductModalClone(product) {
  openProductModal(product);
  document.getElementById("ad-p-id").value = "";
  document.getElementById("ad-p-code").value = ""; // รหัสสินค้ามักไม่ซ้ำกัน ให้กรอกใหม่
  document.getElementById("ad-p-slug").value = ""; // slug ต้องไม่ซ้ำ ให้กรอก/สร้างใหม่
  pModalTitle.textContent = `ทำซ้ำสินค้าจาก "${product.name || ""}"`;
  productFormGuard.capture(); // baseline ใหม่ (id/code ที่เคลียร์แล้วไม่นับเป็น "แก้ไข" ทันทีที่เปิด)
}

function closeProductModal() {
  closeOverlay(pOverlay);
  pForm.reset();
  currentImages = [];
  clearVariants();
}

pForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!validateFormInline(pForm)) return;
  const id = document.getElementById("ad-p-id").value;
  const name = document.getElementById("ad-p-name").value.trim();
  const rawSlug = document.getElementById("ad-p-slug").value.trim();

  // ตัดหมวด/ค่าที่กรอกไม่ครบออก + คำนวณราคาอัตโนมัติจากตารางตัวเลือก — ย้ายไป
  // admin-products-variants.js แล้ว (ดูฟังก์ชันนั้นสำหรับรายละเอียด)
  const { optionAxes: cleanAxes, variants: cleanVariants, autoPrice } = getCleanVariantsPayload();

  const payload = {
    name:        name,
    code:        document.getElementById("ad-p-code").value.trim(),
    slug:        slugify(rawSlug || name),
    cat_id:      document.getElementById("ad-p-cat").value,
    status:      document.getElementById("ad-p-status").value,
    price:       autoPrice != null ? autoPrice : (Number(document.getElementById("ad-p-price").value) || 0),
    unit:        document.getElementById("ad-p-unit").value.trim(),
    material:    document.getElementById("ad-p-material").value.trim(),
    size:        document.getElementById("ad-p-size").value.trim(),
    description: document.getElementById("ad-p-desc").value.trim(),
    metaTitle:       document.getElementById("ad-p-meta-title").value.trim(),
    metaDescription: document.getElementById("ad-p-meta-desc").value.trim(),
    featured:    document.getElementById("ad-p-featured").checked,
    images:      currentImages,
    optionAxes:  cleanAxes,
    variants:    cleanVariants
  };
  const dupSlug = allProducts.some(p => p.slug && p.slug === payload.slug && p.id !== id);
  if (dupSlug) { showToast("slug นี้ถูกใช้กับสินค้าอื่นแล้ว กรุณาตั้งชื่อ slug ให้ไม่ซ้ำ"); return; }
  if (id) payload.id = id;
  const btn = pForm.querySelector('button[type=submit]');
  btn.disabled = true; btn.textContent = "กำลังบันทึก...";
  try {
    await saveProduct(payload);
    closeProductModal();
    await reloadAll();
  } catch (err) {
    showToast("บันทึกไม่สำเร็จ: " + err.message);
  } finally {
    btn.disabled = false; btn.textContent = "บันทึก";
  }
});
