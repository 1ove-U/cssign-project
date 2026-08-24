// ===========================
// js/admin-blog-form.js — ฟอร์มเพิ่ม/แก้ไขบทความ (โมดัล) + รูปปกของบทความที่กำลังแก้ไข
// แยกออกมาจาก js/admin-blog.js (347 บรรทัดเดิม)
//
// 2026 refactor phase 21: แยกส่วน "ฟอร์มเพิ่ม/แก้ไขบทความ" (wireCharCounter ของฟอร์ม,
// currentBlogImage/renderBlogImage(), openBlogModal()/openBlogModalClone()/
// closeBlogModal(), submit handler, และ event listener ของปุ่ม/ช่องอัปโหลดรูปในฟอร์ม)
// ออกมาทั้งหมดแบบ diff เป๊ะ ไม่เปลี่ยน logic — แพทเทิร์นเดียวกับที่ใช้แยก
// admin-products.js → admin-products-form.js (phase 8) — เป็นจุดตัดที่สะอาดเพราะ
// currentBlogImage เป็น module-private ของไฟล์นี้ ไม่มีไฟล์อื่นอ่าน/เขียนตรงๆ และ
// openBlogModal()/openBlogModalClone() ก็ไม่มีไฟล์อื่นนอกเหนือจาก admin-blog.js
// เรียกใช้ (ต่างจาก openProductModal ที่ admin-overview-dashboard.js เรียกด้วย จึงไม่
// ต้อง re-export จาก admin-blog.js เหมือนที่ทำกับ admin-products.js)
//
// ไม่มี circular import กับ admin-blog.js — โมดัลนี้ไม่เรียก renderBlogs() ตรงๆ เลย
// (reloadAll() ที่ import จาก admin-page.js เป็นคนเรียก renderBlogs() ให้เองอยู่แล้ว
// เห็นได้จาก admin-page.js บรรทัดที่ import { renderBlogs } from "./admin-blog.js"
// แล้วเรียกใน reloadAll()) จึงไม่ต้อง import อะไรกลับจาก admin-blog.js เลย
//
// export ออกไปให้ admin-blog.js เรียกใช้:
//   - openBlogModal(post) — เปิดฟอร์มเพิ่ม/แก้ไข (post = null สำหรับเพิ่มใหม่)
//   - openBlogModalClone(post) — เปิดฟอร์ม "เพิ่ม" พร้อมข้อมูลเดิมกรอกไว้ให้ (ทำซ้ำ)
// ===========================
import { uploadImage } from "./db-media.js";
import { saveBlog } from "./db-blog.js";
import { attachUnsavedGuard } from "./ui-form-validation.js";
import { showToast, openOverlay, closeOverlay, imageGridHTML, wireCharCounter, slugify } from "./admin-utils.js";
import { allBlogs } from "./admin-state.js";
import { reloadAll } from "./admin-page.js";

const bOverlay    = document.getElementById("ad-b-overlay");
const bForm        = document.getElementById("ad-b-form");
const bModalTitle  = document.getElementById("ad-b-modal-title");
const bCancelBtn   = document.getElementById("ad-b-cancel");
const bImageBox    = document.getElementById("ad-b-image");
const bUploadInput = document.getElementById("ad-b-upload");
const bUploadStatus = document.getElementById("ad-b-upload-status");
wireCharCounter("ad-b-meta-title", "ad-b-meta-title-count", 70);
wireCharCounter("ad-b-meta-desc", "ad-b-meta-desc-count", 160);

// ── สลับหมวด/แท็บในป๊อปอัพ (เนื้อหา/SEO/เผยแพร่ & รูปปก) ──
// แพทเทิร์นเดียวกับ switchProductTab() ใน js/admin-products-form.js — คัดลอกมาเฉพาะไฟล์นี้
// แทนการ import ข้ามไฟล์ เพราะ scope อยู่แค่ bForm ของฟอร์มนี้เท่านั้น ไม่มี state ร่วมกัน
function switchBlogTab(tabName) {
  let activeTabBtn = null;
  bForm.querySelectorAll(".cp-od-tab").forEach(btn => {
    const isActive = btn.dataset.odTab === tabName;
    btn.classList.toggle("active", isActive);
    btn.setAttribute("aria-selected", isActive ? "true" : "false");
    if (isActive) activeTabBtn = btn;
  });
  bForm.querySelectorAll(".cp-od-panel").forEach(panel => {
    panel.classList.toggle("active", panel.dataset.odPanel === tabName);
  });
  if (activeTabBtn) activeTabBtn.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  bForm.scrollTop = 0;
}
bForm.querySelectorAll(".cp-od-tab").forEach(btn => {
  btn.addEventListener("click", () => switchBlogTab(btn.dataset.odTab));
});

let currentBlogImage = ""; // single cover image url of the post being edited

function renderBlogImage() {
  bImageBox.innerHTML = currentBlogImage ? imageGridHTML([currentBlogImage], false) : `<div class="ad-img-empty">ยังไม่มีรูปปก — อัปโหลดด้านล่าง</div>`;
}

bImageBox.addEventListener("click", (e) => {
  const btn = e.target.closest(".ad-img-remove");
  if (!btn) return;
  currentBlogImage = "";
  renderBlogImage();
});

bUploadInput.addEventListener("change", async () => {
  const file = bUploadInput.files && bUploadInput.files[0];
  if (!file) return;
  bUploadStatus.textContent = "กำลังอัปโหลด...";
  try {
    currentBlogImage = await uploadImage(file);
    renderBlogImage();
    bUploadStatus.textContent = "";
  } catch (err) {
    bUploadStatus.textContent = "";
    showToast("อัปโหลดรูปไม่สำเร็จ: " + err.message);
  } finally {
    bUploadInput.value = "";
  }
});

bCancelBtn.addEventListener("click", () => blogFormGuard.guardedClose());
bOverlay.addEventListener("click", (e) => { if (e.target === bOverlay) blogFormGuard.guardedClose(); });

const blogFormGuard = attachUnsavedGuard({
  overlay: bOverlay, form: bForm, doClose: closeBlogModal,
  getExtra: () => currentBlogImage
});

export function openBlogModal(post) {
  bModalTitle.textContent = post ? "แก้ไขบทความ" : "เพิ่มบทความ";
  document.getElementById("ad-b-id").value       = post ? post.id : "";
  document.getElementById("ad-b-title").value    = post ? post.title || "" : "";
  document.getElementById("ad-b-slug").value     = post ? post.slug || "" : "";
  document.getElementById("ad-b-category").value = post ? post.category || "" : "";
  document.getElementById("ad-b-excerpt").value  = post ? post.excerpt || "" : "";
  document.getElementById("ad-b-content").value  = post ? post.content || "" : "";
  document.getElementById("ad-b-meta-title").value = post ? post.metaTitle || "" : "";
  document.getElementById("ad-b-meta-desc").value  = post ? post.metaDescription || "" : "";
  document.getElementById("ad-b-meta-title").dispatchEvent(new Event("input"));
  document.getElementById("ad-b-meta-desc").dispatchEvent(new Event("input"));
  document.getElementById("ad-b-author").value   = post ? (post.author || "ทีมงาน CS.SIGN") : "ทีมงาน CS.SIGN";
  document.getElementById("ad-b-status").value   = post ? (post.status || "published") : "published";
  document.getElementById("ad-b-featured").checked = post ? !!post.featured : false;
  currentBlogImage = post ? (post.image || "") : "";
  renderBlogImage();
  switchBlogTab("content"); // เปิดฟอร์มมาที่แท็บแรกเสมอ (ป๊อปอัพไม่ได้ถูกสร้างใหม่ทุกครั้ง แค่ toggle display)
  openOverlay(bOverlay);
  blogFormGuard.capture();
}

// "ทำซ้ำ" — เปิดฟอร์ม "เพิ่มบทความ" พร้อมข้อมูลเดิมกรอกไว้ให้ (ไม่ใช่แก้ของเดิม)
// เวลาต้องการเขียนบทความชุดเดียวกันหลายภาษา/หลายมุม โดยใช้โครงเดิมเป็นฐาน
export function openBlogModalClone(post) {
  openBlogModal(post);
  document.getElementById("ad-b-id").value = "";
  document.getElementById("ad-b-slug").value = ""; // slug ต้องไม่ซ้ำ ให้กรอก/สร้างใหม่
  document.getElementById("ad-b-status").value = "draft"; // เริ่มเป็นฉบับร่างก่อนตรวจสอบเนื้อหาซ้ำ
  bModalTitle.textContent = `ทำซ้ำบทความจาก "${post.title || ""}"`;
  blogFormGuard.capture(); // baseline ใหม่
}

function closeBlogModal() {
  closeOverlay(bOverlay);
  bForm.reset();
  currentBlogImage = "";
}

bForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = document.getElementById("ad-b-id").value;
  const title = document.getElementById("ad-b-title").value.trim();
  const rawSlug = document.getElementById("ad-b-slug").value.trim();
  const payload = {
    title,
    slug:     slugify(rawSlug || title),
    category: document.getElementById("ad-b-category").value.trim(),
    excerpt:  document.getElementById("ad-b-excerpt").value.trim(),
    content:  document.getElementById("ad-b-content").value.trim(),
    metaTitle:       document.getElementById("ad-b-meta-title").value.trim(),
    metaDescription: document.getElementById("ad-b-meta-desc").value.trim(),
    author:   document.getElementById("ad-b-author").value.trim(),
    status:   document.getElementById("ad-b-status").value,
    featured: document.getElementById("ad-b-featured").checked,
    image:    currentBlogImage
  };
  const dupSlug = allBlogs.some(b => b.slug === payload.slug && b.id !== id);
  if (dupSlug) { showToast("slug นี้ถูกใช้กับบทความอื่นแล้ว กรุณาตั้งชื่อ slug ให้ไม่ซ้ำ"); return; }
  if (id) payload.id = id;
  const btn = bForm.querySelector('button[type=submit]');
  btn.disabled = true; btn.textContent = "กำลังบันทึก...";
  try {
    await saveBlog(payload);
    closeBlogModal();
    await reloadAll();
  } catch (err) {
    showToast("บันทึกไม่สำเร็จ: " + err.message);
  } finally {
    btn.disabled = false; btn.textContent = "บันทึก";
  }
});
