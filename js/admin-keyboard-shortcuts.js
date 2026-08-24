// ===========================
// js/admin-keyboard-shortcuts.js — คีย์ลัด "/" (โฟกัสช่องค้นหาของแท็บที่เปิดอยู่) และ "n"
// (เปิด modal เพิ่มรายการใหม่ของแท็บนั้น)
//
// 2026 refactor phase 2: ย้ายมาจาก js/admin-page.js เดิม (ส่วน "KEYBOARD SHORTCUTS" บรรทัด
// 4751-4793 เดิม — ส่วนสุดท้ายของไฟล์เดิม) แบบไม่เปลี่ยน behavior ใดๆ — ไม่มีอะไร export ให้ไฟล์
// อื่นเรียกใช้ เพราะผูก listener เองตอนโหลดไฟล์ (เหมือน admin-global-search.js) — ต้อง import
// แบบ side-effect `import "./admin-keyboard-shortcuts.js";` ไว้ใน admin-page.js/admin.html
// ถึงจะโหลด — ไฟล์นี้แค่อ่าน `app`/`activeTab` เท่านั้น ไม่มีการ reassign ตัวแปรที่ import มา
// จากไฟล์อื่น จึงไม่ต้องผ่าน setter เหมือน admin-global-search.js
// ===========================
import { app, activeTab } from "./admin-state.js";

// ===========================================================
// KEYBOARD SHORTCUTS — "/" โฟกัสช่องค้นหาของแท็บที่เปิดอยู่, "n" เปิด modal เพิ่มรายการใหม่ของแท็บนั้น
// ไม่ทำงานถ้า: กำลังพิมพ์อยู่ในช่องอื่น (input/textarea/select/contenteditable), ยังไม่ได้ล็อกอิน,
// หรือมี modal/dialog/global search เปิดค้างอยู่แล้ว — เช็คง่าย ๆ จาก body.cp-scroll-locked ซึ่งทุก
// overlay ในระบบนี้ (product/order/portfolio modal, confirmDialog, global search) ใช้ร่วมกันอยู่แล้ว
// ===========================================================
const TAB_SEARCH_INPUT = {
  orders: "cp-search",
  products: "ad-p-search",
  leads: "ad-l-search",
  categories: "ad-c-search",
  portfolio: "ad-pf-search",
  blog: "ad-b-search"
};
const TAB_ADD_BUTTON = {
  orders: "cp-add-btn",
  products: "ad-p-add-btn",
  categories: "ad-c-add-btn",
  portfolio: "ad-pf-add-btn",
  blog: "ad-b-add-btn",
  faq: "ad-f-add-btn"
};

document.addEventListener("keydown", (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (app.style.display === "none") return; // ยังไม่ได้ล็อกอิน
  if (document.body.classList.contains("cp-scroll-locked")) return; // มี modal/dialog อื่นเปิดอยู่แล้ว

  const activeEl = document.activeElement;
  const tag = activeEl ? activeEl.tagName : "";
  const isTyping = ["INPUT", "TEXTAREA", "SELECT"].includes(tag) || (activeEl && activeEl.isContentEditable);
  if (isTyping) return;

  if (e.key === "/") {
    const input = document.getElementById(TAB_SEARCH_INPUT[activeTab] || "");
    if (input) { e.preventDefault(); input.focus(); input.select(); }
  } else if (e.key === "n" || e.key === "N") {
    const btn = document.getElementById(TAB_ADD_BUTTON[activeTab] || "");
    if (btn) { e.preventDefault(); btn.click(); }
  }
});
