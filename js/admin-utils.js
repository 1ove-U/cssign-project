// ===========================================================
// js/admin-utils.js — shared/generic helpers used by every tab in admin.html
// แยกออกมาจาก admin-page.js (2026 refactor, phase 1: shared utils layer)
// ฟังก์ชันในไฟล์นี้ทั้งหมด "ไม่มี state เฉพาะแท็บใดแท็บหนึ่ง" — รับ input ผ่าน
// พารามิเตอร์ล้วน ๆ จึงย้ายมารวมที่นี่ได้โดยไม่กระทบพฤติกรรมเดิม
// ทุกโมดูลของแต่ละแท็บ (products.js, leads.js, ...) ควร import จากไฟล์นี้แทน
// การก็อปโค้ดซ้ำ — กันบั๊ก "แก้จุดหนึ่งแต่ลืมอีกจุด" ในอนาคต
// ===========================================================
import { logAudit } from "./db.js";
import { uploadImage } from "./db-media.js";
import { showUndoToast } from "./ui-helpers.js";
import { allCategories, allGroups } from "./admin-state.js";

// ── Toast notifications (แทนที่ showToast() ของเบราว์เซอร์ — ดูสไตล์เดียวกับ orders-tab.js) ──
let toastWrap = null;
export function showToast(message, kind = "error") {
  if (!toastWrap || !toastWrap.isConnected) {
    toastWrap = document.querySelector(".cp-toast-wrap") || document.createElement("div");
    toastWrap.className = "cp-toast-wrap";
    if (!toastWrap.isConnected) document.body.appendChild(toastWrap);
  }
  const el = document.createElement("div");
  el.className = `cp-toast ${kind}`;
  el.textContent = message;
  toastWrap.appendChild(el);
  setTimeout(() => el.remove(), 3600);
}

// ── Modal overlay helper ──────────────────────────────
// เปิด/ปิด popup แบบรวมศูนย์: ล็อกการเลื่อนหน้าพื้นหลังไว้ตอนที่ popup เปิดอยู่
// (กันปัญหา popup ดูเหมือน "เด้ง"/เปลี่ยนตำแหน่งเวลาเลื่อนหน้าจอค้างอยู่ด้านหลัง)
// และรีเซ็ต scrollTop ของกล่อง popup ทุกครั้งที่เปิด ให้เริ่มต้นจากบนสุดเสมอ
//
// 2026 refactor — accessibility phase (รอบที่ 58): เพิ่ม focus-trap (Tab/Shift+Tab วนใน
// modal) + Escape (ปิด modal บนสุดโดยยิง synthetic click ใส่ตัว overlay เอง ให้ "ชนกับ"
// backdrop-click listener เดิมที่ทุก modal ผูกไว้แล้ว — ทำให้ modal ที่มี unsaved-guard
// ยังถาม confirmDialog ก่อนปิดเหมือนเดิมทุกประการโดยไม่ต้องรู้ชื่อฟังก์ชันปิดเฉพาะของแต่ละ
// โมดัล) + return-focus (คืน focus กลับไปที่ element ที่โฟกัสอยู่ก่อนเปิด modal) — ดูรายละเอียด
// เพิ่มเติมใน REFACTOR-PROGRESS.md หัวข้อ "รอบที่ 58"
const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), textarea:not([disabled]), ' +
  'input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

// stack ของ overlay ที่เปิดอยู่ตอนนี้ (เผื่อเปิดซ้อนกันในอนาคต) — เก็บคู่ {el, lastFocused}
// ต่อ overlay หนึ่งตัว ใช้ทั้งเพื่อ return-focus ตอนปิด และหา "overlay บนสุด" สำหรับ trap/Escape
const openOverlayStack = [];
let modalKeydownBound = false;

function topOverlayEntry() {
  return openOverlayStack.length ? openOverlayStack[openOverlayStack.length - 1] : null;
}

// confirmDialog() (js/ui-helpers.js) เป็น modal ซ้อนทับแยกต่างหาก (ไม่ได้อยู่ใน stack นี้ และ
// ไม่ได้เป็นลูกของ overlay ใดๆ ใน stack — ถูก appendChild เข้า document.body ตรงๆ) มันจัดการ
// Escape/Enter/click ของตัวเองอยู่แล้ว — ถ้า trap/Escape ของเราทำงานทับตอน confirmDialog เปิดอยู่
// จะแย่งโฟกัสจากปุ่ม "ยืนยัน/ยกเลิก" ของ confirmDialog กลับเข้า modal ข้างล่าง (Tab-trap) หรือเปิด
// confirmDialog ซ้อนกันสองชั้น (Escape ยิง synthetic click ไปโดน backdrop ของ modal ข้างล่างซึ่งบาง
// modal เรียก guardedClose() ที่เปิด confirmDialog ใหม่อีกรอบ) จึงต้องปล่อยให้ confirmDialog จัดการ
// ตัวเองเต็มที่ตอนที่มันเปิดอยู่ — ไม่ trap/Escape ทับ
function isConfirmDialogOpen() {
  const el = document.querySelector(".cp-confirm-overlay");
  return !!(el && el.style.display === "flex");
}

function handleModalKeydown(e) {
  if (isConfirmDialogOpen()) return;
  const top = topOverlayEntry();
  if (!top || top.el.style.display === "none") return;

  if (e.key === "Escape") {
    // เผื่อมี dropdown/autocomplete ของตัวเองในฟอร์ม (เช่น ad-gs-input) ที่จัดการ Escape ของ
    // ตัวเองไปแล้วก่อนหน้า (เรียก e.preventDefault() ไว้) — ให้กลไกนั้นทำงานเดี่ยวๆ ไม่ต้องปิด
    // modal ทั้งอันทับ
    if (e.defaultPrevented) return;
    top.el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    return;
  }

  if (e.key === "Tab") {
    const focusables = Array.from(top.el.querySelectorAll(FOCUSABLE_SELECTOR));
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;
    if (e.shiftKey) {
      if (active === first || !top.el.contains(active)) { e.preventDefault(); last.focus(); }
    } else {
      if (active === last || !top.el.contains(active)) { e.preventDefault(); first.focus(); }
    }
  }
}

let openOverlayCount = 0;
export function openOverlay(el) {
  if (!el) return;
  el.style.display = "flex";
  const scrollBox = el.querySelector(".cp-modal, .ad-pf-view");
  if (scrollBox) scrollBox.scrollTop = 0;
  if (openOverlayCount === 0) {
    const scrollbarW = window.innerWidth - document.documentElement.clientWidth;
    document.body.classList.add("cp-scroll-locked");
    if (scrollbarW > 0) document.body.style.paddingRight = scrollbarW + "px";
  }
  openOverlayCount++;
  openOverlayStack.push({ el, lastFocused: document.activeElement });
  if (!modalKeydownBound) {
    modalKeydownBound = true;
    document.addEventListener("keydown", handleModalKeydown);
  }
}
export function closeOverlay(el) {
  if (!el) return;
  el.style.display = "none";
  openOverlayCount = Math.max(0, openOverlayCount - 1);
  if (openOverlayCount === 0) {
    document.body.classList.remove("cp-scroll-locked");
    document.body.style.paddingRight = "";
  }
  // หา entry ล่าสุดที่ตรงกับ el ตัวนี้ (ปกติจะเป็นตัวบนสุดของ stack อยู่แล้ว เพราะ modal ในโปรเจกต์
  // นี้ไม่เปิดซ้อนกันจริง — เผื่อไว้กรณีปิดไม่เรียงลำดับ ใช้ lastIndexOf หา entry ที่ el ตรงกัน)
  for (let i = openOverlayStack.length - 1; i >= 0; i--) {
    if (openOverlayStack[i].el === el) {
      const [entry] = openOverlayStack.splice(i, 1);
      if (entry.lastFocused && typeof entry.lastFocused.focus === "function") {
        entry.lastFocused.focus();
      }
      break;
    }
  }
}

// ── Undo หลังลบ ──────────────────────────────
// แทนที่จะลบจริงทันทีหลัง confirmDialog ยืนยัน จะใส่ id ไว้ใน "pendingSet" ก่อน
// (แต่ละรายการที่ลบได้ในหน้านี้มี Set ของตัวเอง — ดูตัวแปร pendingDelete*Ids ในแต่ละแท็บ)
// แล้วให้ฟังก์ชัน render/filter ของรายการนั้นซ่อนแถวที่อยู่ใน Set ออกจากหน้าจอทันที
// จากนั้นแสดง toast ค้างไว้ ~5 วิ พร้อมปุ่ม "เลิกทำ" ก่อนค่อยเรียกลบจริงจาก DB
// ถ้ากด "เลิกทำ" ทัน จะเอา id ออกจาก Set แล้ว render ใหม่ ทำให้รายการกลับมาเหมือนเดิม
export async function deleteWithUndo({ pendingSet, id, renderFn, message, deleteFn, onCommitted, targetType }) {
  pendingSet.add(id);
  renderFn();
  const undone = await showUndoToast(message, 5000);
  if (undone) {
    pendingSet.delete(id);
    renderFn();
    return;
  }
  try {
    await deleteFn();
    if (targetType) logAudit("delete", targetType, id);
    pendingSet.delete(id);
    if (onCommitted) await onCommitted();
    else renderFn();
  } catch (err) {
    pendingSet.delete(id);
    renderFn();
    showToast("ลบไม่สำเร็จ: " + err.message);
  }
}

// ── Export CSV helpers ──────────────────────────────
export function downloadCsv(filename, headers, rows) {
  const csvRows = [headers.join(",")];
  rows.forEach(r => csvRows.push(r.map(csvCell).join(",")));
  const blob = new Blob(["\uFEFF" + csvRows.join("\r\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}
export function csvCell(val) { return `"${String(val ?? "").replace(/"/g, '""')}"`; }

export function escapeHtml(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
}

// ── Avatar วงกลมตัวอักษรย่อ (ใช้แทนรูปโปรไฟล์ในตารางลีด — ไม่มีรูปจริงให้ใช้) ──
export function initials(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts[0][0] + (parts[1] ? parts[1][0] : "")).toUpperCase();
}
export function avatarHtml(name) {
  const hues = [210, 265, 155, 25, 340, 190, 45];
  let h = 0; for (let i = 0; i < String(name||"").length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  const hue = hues[h % hues.length];
  return `<span class="cp-avatar" style="background:hsl(${hue} 70% 94%); color:hsl(${hue} 55% 38%);">${escapeHtml(initials(name))}</span>`;
}

// ── รูปภาพสินค้าเก็บได้ 2 แบบ: string url เดิม (ของเก่า) หรือ {url, label} (รองรับป้ายกำกับรูป เช่น "ซ้าย/ขวา/หน้า/หลัง") ──
export function imgUrl(img) { return (img && typeof img === "object") ? (img.url || "") : (img || ""); }
export function imgLabel(img) { return (img && typeof img === "object") ? (img.label || "") : ""; }
export function normalizeImage(img) { return { url: imgUrl(img), label: imgLabel(img) }; }

// ── ตัวนับตัวอักษรใต้ input/textarea (ใช้ทั้งใน SEO fields ของสินค้าและบทความ) ──
export function wireCharCounter(inputId, countId, max) {
  const input = document.getElementById(inputId);
  const countEl = document.getElementById(countId);
  if (!input || !countEl) return;
  function update() {
    const len = input.value.length;
    countEl.textContent = `${len} / ${max}`;
    countEl.classList.toggle("is-near-limit", len >= max * 0.85 && len < max);
    countEl.classList.toggle("is-over-limit", len >= max);
  }
  input.addEventListener("input", update);
  update();
}

// ── สร้าง id ชั่วคราวฝั่ง client (ก่อนบันทึกลง DB จริง) ──
export function genLocalId() {
  return "id" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ── ชื่อหมวดหมู่จาก id — ใช้ข้ามหลายแท็บ (products, products-csv, global-search)
// ย้ายมาไว้ที่นี่ก่อนกำหนดในแผนเดิม (ตอนแตก admin-products-csv.js) เพราะเป็นจุดแรกที่ต้องใช้
export function catName(id) {
  const c = allCategories.find(c => c.id === id);
  return c ? c.name : "ไม่มีหมวดหมู่";
}

// ── ชื่อหมวดหมู่ใหญ่ (group) จาก id — ใช้ข้ามหลายแท็บ (categories, global-search)
// ย้ายมาจาก admin-page.js เดิมตอนแตก admin-products.js (2026 refactor phase 2)
export function groupName(id) {
  const g = allGroups.find(g => g.id === id);
  return g ? g.name : "";
}

// ── ช่องกรอง "หมวดหมู่" ของแท็บสินค้า (ทั้ง dropdown กรองในกริด และ dropdown ในฟอร์มเพิ่ม/แก้ไข) ──
// ย้ายมาจาก admin-page.js เดิมตอนแตก admin-products.js (2026 refactor phase 2) — วางไว้ที่นี่
// (แม้จะผูกกับ DOM id เฉพาะของแท็บสินค้า) ตามแผนเดิมที่วางไว้ก่อนหน้า เพื่อให้เรียกใช้ได้ตั้งแต่
// reloadAll() ใน admin-page.js โดยไม่ต้อง import ข้ามจาก admin-products.js
export function fillCategorySelects() {
  const opts = allCategories.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("");
  const pFilterCat = document.getElementById("ad-p-filter-cat");
  if (pFilterCat) pFilterCat.innerHTML = `<option value="">ทุกหมวดหมู่</option>` + opts;
  const pCat = document.getElementById("ad-p-cat");
  if (pCat) pCat.innerHTML = opts || `<option value="">— ยังไม่มีหมวดหมู่ —</option>`;
}

// ── กริดรูปภาพ (แสดง thumbnail + ปุ่มลบ + ช่องป้ายกำกับถ้า withLabel) — ใช้ร่วมกันทุกแท็บที่มีรูป
// (สินค้า/ผลงาน/บทความ/โลโก้ลูกค้า/รีวิวลูกค้า/วิดีโอ) ย้ายมาจาก admin-page.js เดิมตอนแตก
// admin-products.js (2026 refactor phase 2)
export function imageGridHTML(images, withLabel) {
  if (!images.length) return `<div class="ad-img-empty">ยังไม่มีรูปภาพ — อัปโหลดด้านล่าง</div>`;
  return images.map((img, i) => {
    const url = imgUrl(img);
    const thumb = `
    <div class="ad-img-item" data-idx="${i}">
      <img src="${url}" alt="รูปภาพ ${i + 1}" loading="lazy">
      <button type="button" class="ad-img-remove" data-idx="${i}" title="ลบรูปนี้">×</button>
    </div>`;
    if (!withLabel) return thumb;
    return `
    <div class="ad-img-cell">
      ${thumb}
      <input type="text" class="ad-img-tag-input" data-idx="${i}" maxlength="30"
             placeholder="ป้ายกำกับ เช่น ซ้าย, หน้า" value="${escapeHtml(imgLabel(img))}">
    </div>`;
  }).join("");
}

// ── อัปโหลดรูปภาพหลายไฟล์ทีละไฟล์ ทยอยอัปเดตสถานะ + เรียก renderFn() ให้ทุกครั้งที่อัปโหลดเสร็จ
// ทีละรูป (ไม่รอครบทุกไฟล์ก่อนค่อยแสดงผล) ใช้ร่วมกันทุกแท็บที่มีรูป ย้ายมาจาก admin-page.js เดิม
// ตอนแตก admin-products.js (2026 refactor phase 2)
export async function handleImageUpload(files, targetArray, renderFn, statusEl, withLabel) {
  statusEl.textContent = `กำลังอัปโหลด ${files.length} รูป...`;
  let done = 0;
  for (const file of files) {
    try {
      const url = await uploadImage(file);
      targetArray.push(withLabel ? { url, label: "" } : url);
      renderFn();
    } catch (err) {
      showToast(`อัปโหลดรูป "${file.name}" ไม่สำเร็จ: ` + err.message);
    }
    done++;
    statusEl.textContent = `อัปโหลดแล้ว ${done}/${files.length}`;
  }
  statusEl.textContent = "";
}

// ── สร้างรายการเลขหน้าแบบมีจุดไข่ปลา (1 … 4 5 6 … 20) ใช้ร่วมกันทุกแท็บที่มี pagination
// (สินค้า/ลีด/หมวดหมู่/ผลงาน/บทความ/คำถามที่พบบ่อย/โลโก้ลูกค้า/รีวิวลูกค้า) ย้ายมาจาก admin-page.js
// เดิมตอนแตก admin-products.js (2026 refactor phase 2) — ต้องย้ายมาก่อนกำหนดในแผนเดิม (ตอนทำ
// admin-leads.js) เพราะ renderProductsPagination() ต้องใช้ก่อน
// ── สร้าง slug จากข้อความ (ตัดอักขระที่ไม่ใช่ a-z/0-9/ไทย/เว้นวรรค/ขีดกลางออก, เว้นวรรค→ขีดกลาง)
// ใช้ทั้งในฟอร์มสินค้าและบทความ ย้ายมาไว้ที่นี่ก่อนกำหนดในแผนเดิม (ตอนทำ admin-blog.js)
// เพราะฟอร์มสินค้า (admin-products.js) ต้องใช้ก่อน
export function slugify(str) {
  return String(str || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9ก-๙\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function buildPageList(current, total) {
  if (total <= 7) { const a = []; for (let i = 1; i <= total; i++) a.push(i); return a; }
  const pages = [1];
  if (current > 3) pages.push("…");
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) pages.push(i);
  if (current < total - 2) pages.push("…");
  pages.push(total);
  return pages;
}
