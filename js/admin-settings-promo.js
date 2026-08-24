// ===========================
// js/admin-settings-promo.js — SETTINGS — โปรโมชั่น & ข่าวอัพเดตล่าสุด (หน้าแรก)
// เก็บเป็น settings.promoUpdates: [{ image, title, link }]
//
// 2026 refactor phase 2: ย้ายมาจาก js/admin-page.js เดิม (ส่วน "SETTINGS — โปรโมชั่น &
// ข่าวอัพเดตล่าสุด" บรรทัด 3814-3931 เดิม) แบบไม่เปลี่ยน behavior ใดๆ — เช็คด้วย diff กับ
// ต้นฉบับแล้วตรงทุกตัวอักษร ยกเว้นจุดที่ตั้งใจแยกไฟล์ (เพิ่ม `export` หน้า `renderPromoSettings`)
//
// export `renderPromoSettings()` ตามแผนเดิม
// ===========================
import { uploadImage } from "./db-media.js";
import { saveSettings } from "./db-settings.js";
import { logAudit } from "./db.js";
import { showToast, escapeHtml } from "./admin-utils.js";

const PROMO_MAX = 10;
const promoBox          = document.getElementById("ad-promo-images");
const promoUploadInput  = document.getElementById("ad-promo-upload");
const promoUploadStatus = document.getElementById("ad-promo-upload-status");
const promoSaveBtn      = document.getElementById("ad-promo-save");
const promoStatus       = document.getElementById("ad-promo-status");

let currentPromoImages = []; // [{ image, title, link }]

function promoGridHTML() {
  if (!currentPromoImages.length) return `<div class="ad-img-empty">ยังไม่มีรูป — อัปโหลดด้านล่าง (หน้าแรกจะขึ้น "รออัพเดต" จนกว่าจะมีรูป)</div>`;
  return currentPromoImages.map((item, i) => `
    <div class="ad-img-cell">
      <div class="ad-img-item" data-idx="${i}">
        <img src="${item.image}" alt="โปรโมชั่น/ข่าว ${i + 1}" loading="lazy">
        <button type="button" class="ad-img-remove" data-idx="${i}" title="ลบรูปนี้">×</button>
      </div>
      <input type="text" class="ad-img-tag-input ad-promo-title" data-idx="${i}" maxlength="60"
             placeholder="ชื่อหัวข้อ (ไม่บังคับ)" value="${escapeHtml(item.title || "")}">
      <input type="text" class="ad-img-tag-input ad-promo-link" data-idx="${i}" maxlength="300"
             placeholder="ลิงก์ปลายทาง (ไม่บังคับ)" value="${escapeHtml(item.link || "")}">
    </div>`).join("");
}

function renderPromoImages() {
  promoBox.innerHTML = promoGridHTML();
  const label = document.getElementById("ad-promo-upload-label");
  if (label) {
    const atMax = currentPromoImages.length >= PROMO_MAX;
    label.classList.toggle("is-disabled", atMax);
    if (promoUploadInput) promoUploadInput.disabled = atMax;
    const textNode = Array.from(label.childNodes).find(n => n.nodeType === Node.TEXT_NODE && n.textContent.trim());
    const labelText = atMax
      ? `ครบ ${PROMO_MAX} รูปแล้ว (สูงสุด)`
      : `อัปโหลดรูปโปรโมชั่น/ข่าว (เหลือ ${PROMO_MAX - currentPromoImages.length} รูป)`;
    if (textNode) textNode.textContent = labelText;
  }
}

export function renderPromoSettings(settings) {
  currentPromoImages = (settings && Array.isArray(settings.promoUpdates))
    ? settings.promoUpdates.map(it => ({ image: it.image || "", title: it.title || "", link: it.link || "" })).filter(it => it.image)
    : [];
  renderPromoImages();
}

if (promoUploadInput) {
  promoUploadInput.addEventListener("change", async () => {
    let files = Array.from(promoUploadInput.files || []);
    if (!files.length) return;

    const remaining = PROMO_MAX - currentPromoImages.length;
    if (remaining <= 0) {
      showToast(`อัปโหลดรูปโปรโมชั่น/ข่าวได้สูงสุด ${PROMO_MAX} รูป — กรุณาลบรูปเดิมบางส่วนก่อนเพิ่มรูปใหม่`);
      promoUploadInput.value = "";
      return;
    }
    if (files.length > remaining) {
      showToast(`อัปโหลดรูปโปรโมชั่น/ข่าวได้สูงสุด ${PROMO_MAX} รูป — จะอัปโหลดให้ ${remaining} รูปแรกเท่านั้น`);
      files = files.slice(0, remaining);
    }

    promoUploadStatus.textContent = `กำลังอัปโหลด ${files.length} รูป...`;
    let done = 0;
    for (const file of files) {
      try {
        const url = await uploadImage(file);
        currentPromoImages.push({ image: url, title: "", link: "" });
        renderPromoImages();
      } catch (err) {
        showToast(`อัปโหลดรูป "${file.name}" ไม่สำเร็จ: ` + err.message);
      }
      done++;
      promoUploadStatus.textContent = `อัปโหลดแล้ว ${done}/${files.length}`;
    }
    promoUploadStatus.textContent = "";
    promoUploadInput.value = "";
  });
}

if (promoBox) {
  promoBox.addEventListener("click", (e) => {
    const btn = e.target.closest(".ad-img-remove");
    if (!btn) return;
    currentPromoImages.splice(Number(btn.dataset.idx), 1);
    renderPromoImages();
  });
  promoBox.addEventListener("input", (e) => {
    const idx = Number(e.target.dataset.idx);
    if (Number.isNaN(idx) || !currentPromoImages[idx]) return;
    if (e.target.classList.contains("ad-promo-title")) currentPromoImages[idx].title = e.target.value;
    if (e.target.classList.contains("ad-promo-link"))  currentPromoImages[idx].link  = e.target.value;
  });
}

if (promoSaveBtn) {
  promoSaveBtn.addEventListener("click", async () => {
    promoSaveBtn.disabled = true;
    const originalLabel = promoSaveBtn.textContent;
    promoSaveBtn.textContent = "กำลังบันทึก...";
    promoStatus.textContent = "";
    try {
      await saveSettings({ promoUpdates: currentPromoImages });
      promoStatus.textContent = "บันทึกสำเร็จ — หน้าแรกจะอัปเดตตามนี้ในการโหลดครั้งถัดไป";
      logAudit("update", "promo-updates", "", `อัปเดตรูปโปรโมชั่น/ข่าว (${currentPromoImages.length} รูป)`);
    } catch (err) {
      showToast("บันทึกไม่สำเร็จ: " + err.message);
    } finally {
      promoSaveBtn.disabled = false;
      promoSaveBtn.textContent = originalLabel;
    }
  });
}
