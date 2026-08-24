// ===========================
// js/admin-portfolio-form.js — ฟอร์มเพิ่ม/แก้ไขผลงาน (โมดัล) + รูปภาพผลงานที่กำลังแก้ไข
// แยกออกมาจาก js/admin-portfolio.js (421 บรรทัด เดิม)
//
// 2026 refactor phase 11: แยกส่วน "ฟอร์มเพิ่ม/แก้ไขผลงาน" (currentPfImages/renderPfImages() +
// openPortfolioModal()/openPortfolioModalClone()/closePortfolioModal() + refreshPfPinnedHint() +
// submit handler + PF_MAX_PINNED) ออกมาทั้งหมดแบบ diff เป๊ะ ไม่มีเปลี่ยน logic — ใช้แพทเทิร์น
// เดียวกับที่แยก js/admin-products.js → js/admin-products-form.js (phase 8) — เป็นจุดตัดที่สะอาด
// เพราะ "กริด/ค้นหา/กรอง/pagination/bulk actions/popup ดูรายละเอียด" ที่เหลือใน
// admin-portfolio.js ไม่มี state ร่วมกับฟอร์มนี้เลย (currentPfImages เป็น module-private ของ
// ไฟล์นี้ ไม่มีไฟล์อื่นอ่าน/เขียนตรงๆ) — PF_CAT_LABEL ไม่ได้ย้ายตามมาเพราะฟอร์มนี้ไม่ได้ใช้เลย
// (ใช้แค่ในกริด/popup ดูรายละเอียดที่เหลืออยู่ใน admin-portfolio.js) ส่วน PF_MAX_PINNED ย้ายมา
// ทั้งหมดเพราะใช้เฉพาะใน refreshPfPinnedHint()/pinned checkbox handler/submit handler เท่านั้น
//
// savePortfolio/allPortfolios/showToast/openOverlay/closeOverlay/reloadAll/confirmDialog ยังต้อง
// import ทั้งสองไฟล์ เพราะ admin-portfolio.js เดิม (กริด/movePinnedItem/popup) ก็ใช้ชุดเดียวกันนี้
// อยู่แล้วเช่นกัน ไม่ใช่ export เฉพาะของไฟล์นี้
//
// ไม่มีไฟล์อื่นในโปรเจกต์ import openPortfolioModal/openPortfolioModalClone จาก
// admin-portfolio.js เดิมโดยตรง (ต่างจากกรณี openProductModal ใน admin-products.js ที่มี
// admin-overview-dashboard.js import อยู่) จึงไม่ต้องมี re-export กลับจาก admin-portfolio.js
//
// export ออกไปให้ admin-portfolio.js เรียกใช้:
//   - openPortfolioModal(item) — เปิดฟอร์มเพิ่ม/แก้ไข (item = null สำหรับเพิ่มใหม่)
//   - openPortfolioModalClone(item) — เปิดฟอร์ม "เพิ่ม" พร้อมข้อมูลเดิมกรอกไว้ให้ (ทำซ้ำ)
// ===========================
import { deleteImage } from "./db-media.js";
import { savePortfolio } from "./db-content.js";
import { confirmDialog } from "./ui-helpers.js";
import { attachUnsavedGuard } from "./ui-form-validation.js";
import {
  showToast, openOverlay, closeOverlay, imageGridHTML, handleImageUpload
} from "./admin-utils.js";
import { allPortfolios } from "./admin-state.js";
import { reloadAll } from "./admin-page.js";

const pfOverlay   = document.getElementById("ad-pf-overlay");
const pfForm       = document.getElementById("ad-pf-form");
const pfModalTitle = document.getElementById("ad-pf-modal-title");
const pfCancelBtn  = document.getElementById("ad-pf-cancel");
const pfImagesBox  = document.getElementById("ad-pf-images");
const pfUploadInput = document.getElementById("ad-pf-upload");
const pfUploadStatus = document.getElementById("ad-pf-upload-status");

const PF_MAX_PINNED = 12; // จำกัดจำนวนผลงานที่ปักหมุดแสดงหน้าแรก — ต้องเท่ากับจำนวนที่ wg-grid บนหน้าแรกออกแบบไว้พอดี (12 ชิ้น = แถวเต็มพอดีทุก breakpoint ไม่มีฐานแหว่ง) ห้ามแก้เลขนี้โดยไม่แก้ pattern ใน css/style.css (.wg-grid) และ js/home-dynamic.js (renderStarredWorks) ให้สอดคล้องกันด้วย

let currentPfImages = [];

function renderPfImages() {
  pfImagesBox.innerHTML = imageGridHTML(currentPfImages);
}

pfImagesBox.addEventListener("click", async (e) => {
  const btn = e.target.closest(".ad-img-remove");
  if (!btn) return;
  const idx = Number(btn.dataset.idx);
  const url = currentPfImages[idx];
  if (!(await confirmDialog("ลบรูปนี้ออกจากผลงานใช่หรือไม่?", { title: "ลบรูปภาพ" }))) return;
  currentPfImages.splice(idx, 1);
  renderPfImages();
  try { await deleteImage(url); } catch { /* non-blocking */ }
});

pfUploadInput.addEventListener("change", async () => {
  const files = Array.from(pfUploadInput.files || []);
  if (!files.length) return;
  await handleImageUpload(files, currentPfImages, renderPfImages, pfUploadStatus);
  pfUploadInput.value = "";
});

pfCancelBtn.addEventListener("click", () => portfolioFormGuard.guardedClose());
pfOverlay.addEventListener("click", (e) => { if (e.target === pfOverlay) portfolioFormGuard.guardedClose(); });

const portfolioFormGuard = attachUnsavedGuard({
  overlay: pfOverlay, form: pfForm, doClose: closePortfolioModal,
  getExtra: () => currentPfImages
});

let pfEditingItem = null;

function refreshPfPinnedHint() {
  const hintEl = document.getElementById("ad-pf-pinned-hint");
  if (!hintEl) return;
  const count = allPortfolios.filter(p => p.pinned && (!pfEditingItem || p.id !== pfEditingItem.id)).length;
  hintEl.textContent = `ปักหมุดอยู่ ${count}/${PF_MAX_PINNED} รายการ (แนะนำไม่เกิน ${PF_MAX_PINNED} เพื่อไม่ให้การ์ดล้นหน้าแรก)`;
}

export function openPortfolioModal(item) {
  pfEditingItem = item || null;
  pfModalTitle.textContent = item ? "แก้ไขผลงาน" : "เพิ่มผลงาน";
  document.getElementById("ad-pf-id").value     = item ? item.id : "";
  document.getElementById("ad-pf-title").value  = item ? item.title || "" : "";
  document.getElementById("ad-pf-client").value = item ? item.client || "" : "";
  document.getElementById("ad-pf-cat").value    = item ? item.category || "factory" : "factory";
  document.getElementById("ad-pf-desc").value   = item ? item.description || "" : "";
  document.getElementById("ad-pf-tags").value   = item ? (item.tags || []).join(", ") : "";
  document.getElementById("ad-pf-pinned").checked = item ? !!item.pinned : false;
  currentPfImages = item ? [...(item.images || [])] : [];
  renderPfImages();
  pfUploadStatus.textContent = "";
  refreshPfPinnedHint();
  openOverlay(pfOverlay);
  portfolioFormGuard.capture();
}

// "ทำซ้ำ" — เปิดฟอร์ม "เพิ่มผลงาน" พร้อมข้อมูลเดิมกรอกไว้ให้ (ไม่ใช่แก้ของเดิม)
// เวลามีผลงานคล้ายกันหลายชิ้น (เช่น โครงการเดียวกันแต่คนละสถานที่/รูปภาพ)
export function openPortfolioModalClone(item) {
  openPortfolioModal(item);
  document.getElementById("ad-pf-id").value = "";
  document.getElementById("ad-pf-pinned").checked = false; // ปักหมุดไม่ควรก็อปตามไปด้วย
  pfModalTitle.textContent = `ทำซ้ำผลงานจาก "${item.title || ""}"`;
  refreshPfPinnedHint();
  portfolioFormGuard.capture(); // baseline ใหม่
}

function closePortfolioModal() {
  closeOverlay(pfOverlay);
  pfForm.reset();
  currentPfImages = [];
  pfEditingItem = null;
}

document.getElementById("ad-pf-pinned").addEventListener("change", (e) => {
  const alreadyPinned = allPortfolios.filter(p => p.pinned && (!pfEditingItem || p.id !== pfEditingItem.id)).length;
  if (e.target.checked && alreadyPinned >= PF_MAX_PINNED) {
    showToast(`ปักหมุดได้สูงสุด ${PF_MAX_PINNED} รายการ เพื่อไม่ให้การ์ดล้นหน้าแรก กรุณายกเลิกปักหมุดผลงานอื่นก่อน`);
    e.target.checked = false;
  }
  refreshPfPinnedHint();
});

pfForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = document.getElementById("ad-pf-id").value;
  const tagsRaw = document.getElementById("ad-pf-tags").value.trim();
  const wantPinned = document.getElementById("ad-pf-pinned").checked;
  const alreadyPinned = allPortfolios.filter(p => p.pinned && (!pfEditingItem || p.id !== pfEditingItem.id)).length;
  if (wantPinned && alreadyPinned >= PF_MAX_PINNED) {
    showToast(`ปักหมุดได้สูงสุด ${PF_MAX_PINNED} รายการ เพื่อไม่ให้การ์ดล้นหน้าแรก กรุณายกเลิกปักหมุดผลงานอื่นก่อน`);
    return;
  }
  const payload = {
    title:       document.getElementById("ad-pf-title").value.trim(),
    client:      document.getElementById("ad-pf-client").value.trim(),
    category:    document.getElementById("ad-pf-cat").value,
    description: document.getElementById("ad-pf-desc").value.trim(),
    tags:        tagsRaw ? tagsRaw.split(",").map(t => t.trim()).filter(Boolean) : [],
    images:      currentPfImages,
    pinned:      wantPinned,
    order:       pfEditingItem ? (pfEditingItem.order || 0) : (allPortfolios.filter(p => p.pinned).length)
  };
  if (id) payload.id = id;
  const btn = pfForm.querySelector('button[type=submit]');
  btn.disabled = true; btn.textContent = "กำลังบันทึก...";
  try {
    await savePortfolio(payload);
    closePortfolioModal();
    await reloadAll();
  } catch (err) {
    showToast("บันทึกไม่สำเร็จ: " + err.message);
  } finally {
    btn.disabled = false; btn.textContent = "บันทึก";
  }
});
