// ===========================
// js/admin-page.js — bootstrap หน้าแอดมิน: auth / tabs / settings-subtabs / sidebar
//
// 2026 refactor phase 2: ไฟล์นี้เดิมรวมทุกแท็บไว้ในไฟล์เดียว (~4,800 บรรทัด) ถูกแตกเป็น
// โมดูลย่อยตามแท็บ/ฟีเจอร์แล้ว (ดู js/admin-*.js) ไฟล์นี้เหลือทำหน้าที่ "เปิดประตู" เท่านั้น:
// ผูก auth, สลับแท็บหลัก/แท็บย่อยของหน้าตั้งค่า แล้วเรียก render ฟังก์ชันของแต่ละแท็บที่
// import มาจากไฟล์ของมันเอง — ไม่มีการเปลี่ยน behavior ใดๆ จากของเดิม เป็นแค่ย้ายโค้ดเชิงโครงสร้าง
//
// รอบที่ 30: แยกส่วน sidebar (คีย์บอร์ดนำทาง 2D grid/พับ-กางเมนู/ค้นหาเมนู) ออกไป
// js/admin-sidebar.js ทั้งหมด (156 บรรทัดท้ายไฟล์เดิม ก่อน export) — ไฟล์ใหม่ import
// switchTab กลับมาจากไฟล์นี้ (circular import ที่ตั้งใจ ปลอดภัยเพราะเป็น function
// declaration ที่ hoisted, แพทเทิร์นเดียวกับ admin-global-search.js) และ query `tabsBox`
// เองซ้ำแทนการ export ข้ามไฟล์ (เป็นแค่ DOM ref ธรรมดา ไม่ใช่ state ที่ต้องแชร์)
// ===========================
import { onAuthChange, loginAdmin, logoutAdmin, getMyStaffRole } from "./db.js";
import { applyRoleUI } from "./admin-role-ui.js";
import { maybeShowOnboarding } from "./admin-onboarding.js";
import { getGroups, getCategories, migrateLegacyGroups } from "./db-taxonomy.js";
import { getProducts } from "./db-products.js";
import { getPortfolios, getFaqs } from "./db-content.js";
import { getSettings } from "./db-settings.js";
import { getBlogs } from "./db-blog.js";
import { stopOrdersTab, onOrdersChanged, onRequestOrdersTab, onRequestOverviewTab,
         initOrdersTab } from "./orders-tab.js";
import { confirmDialog, errorStateHTML } from "./ui-helpers.js";
import { isAnyFormDirty } from "./ui-form-validation.js";
import { app, activeTab, setActiveTab,
         setAllProducts, setAllCategories, setAllGroups, setAllPortfolios,
         setAllBlogs, setAllFaqs } from "./admin-state.js";
import { renderOverview, renderNotifBell } from "./admin-overview-dashboard.js";
import { fillCategorySelects, renderProducts } from "./admin-products.js";
import "./admin-products-csv.js"; // แค่ผูก event listener ของปุ่ม export/import CSV — ไม่มีอะไรให้ import ใช้ตรงๆ
import { fillGroupSelect, renderGroups } from "./admin-groups.js";
import { renderCategories } from "./admin-categories.js";
import { renderPortfolios } from "./admin-portfolio.js";
import { renderBlogs } from "./admin-blog.js";
import { renderFaqs } from "./admin-faq.js";
import { renderContactSettings } from "./admin-settings-contact.js";
import { renderPromoSettings } from "./admin-settings-promo.js";
import { renderVideoSettings } from "./admin-settings-videos.js";
import { renderTeamSettings } from "./admin-settings-team.js";
import { renderStaffList } from "./admin-settings-staff.js";
import { renderAuditLog } from "./admin-settings-audit.js";
import { startLeadsListener } from "./admin-leads.js";
import { startQuotationsListener } from "./admin-quotations.js";
import "./admin-leads-automation.js"; // แค่ผูก listener auto-assign round-robin (onNewLeadsArrived ใน admin-leads.js) — ไม่มีอะไรให้ import ใช้ตรงๆ
import "./admin-global-search.js"; // แค่ผูก event listener ของกล่องค้นหากลาง/คีย์ลัด "/" — ไม่มีอะไรให้ import ใช้ตรงๆ
import "./admin-keyboard-shortcuts.js"; // แค่ผูก event listener คีย์ลัด "/" และ "n" ของแต่ละแท็บ — ไม่มีอะไรให้ import ใช้ตรงๆ
import "./admin-sidebar.js"; // แค่ผูก event listener คีย์บอร์ดนำทาง/พับ-กางเมนู/ค้นหาเมนูของ sidebar — ไม่มีอะไรให้ import ใช้ตรงๆ

const gate        = document.getElementById("ad-gate");
const loginForm   = document.getElementById("ad-login-form");
const loginError  = document.getElementById("ad-login-error");
const logoutBtn   = document.getElementById("ad-logout-btn");
const userEmailEl = document.getElementById("ad-user-email");
const userAvatarEl = document.getElementById("ad-user-avatar");
const tabsBox     = document.getElementById("ad-tabs");

// ── สวัสดี + วันที่ปัจจุบันใต้หัวข้อ "ภาพรวม" — เพิ่มความรู้สึกเป็นมิตร
//    และช่วยยืนยันว่าระบบยังทำงานสด (ไม่ใช่หน้าค้าง) โดยไม่กระทบ layout เดิม
function renderOverviewGreeting(){
  const titleEl = document.getElementById("ov-greeting-title");
  const dateEl  = document.getElementById("ov-greeting-date");
  if (!titleEl || !dateEl) return;
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? "สวัสดีตอนเช้า" : hour < 17 ? "สวัสดีตอนบ่าย" : "สวัสดีตอนเย็น";
  titleEl.textContent = `${greeting} 👋`;
  const days = ["อาทิตย์","จันทร์","อังคาร","พุธ","พฤหัสบดี","ศุกร์","เสาร์"];
  const months = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
  dateEl.textContent = `วัน${days[now.getDay()]}ที่ ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear() + 543}`;
}

// ── Auth ──────────────────────────────
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("ad-email").value.trim();
  const pass  = document.getElementById("ad-pass").value;
  const btn   = loginForm.querySelector(".cp-gate-btn");
  loginError.style.display = "none";
  btn.disabled = true; btn.textContent = "กำลังเข้าสู่ระบบ...";
  try {
    await loginAdmin(email, pass);
  } catch {
    loginError.textContent = "อีเมลหรือรหัสผ่านไม่ถูกต้อง";
    loginError.style.display = "block";
  } finally {
    btn.disabled = false; btn.textContent = "เข้าสู่ระบบ";
  }
});

logoutBtn.addEventListener("click", async () => {
  if (isAnyFormDirty()) {
    const ok = await confirmDialog(
      "คุณมีข้อมูลที่ยังไม่ได้บันทึกอยู่ในฟอร์มที่เปิดค้างไว้ หากออกจากระบบตอนนี้การแก้ไขจะหายไป ต้องการออกจากระบบใช่หรือไม่?",
      { title: "ยังไม่ได้บันทึกข้อมูล", confirmLabel: "ออกจากระบบโดยไม่บันทึก", danger: true }
    );
    if (!ok) return;
  }
  await logoutAdmin();
});

let leadsUnsub = null;

onAuthChange(async (user) => {
  if (!user) {
    app.style.display = "none";
    gate.style.display = "flex";
    if (leadsUnsub) { leadsUnsub(); leadsUnsub = null; }
    stopOrdersTab();
    return;
  }
  gate.style.display = "none";
  app.style.display = "block";
  userEmailEl.textContent = user.email || "";
  if (userAvatarEl) userAvatarEl.textContent = (user.email || "?").trim().charAt(0).toUpperCase();
  renderOverviewGreeting();
  await reloadAll();
  startLeadsListener();
  startQuotationsListener();
  onOrdersChanged(() => {
    renderNotifBell();
    // อัปเดตการ์ด "จำนวนงานใหม่" ในภาพรวมแบบเรียลไทม์ ถ้ากำลังเปิดแท็บภาพรวมอยู่
    if (activeTab === "overview") renderOverview();
  });
  // การ์ดสถิติคำสั่งผลิต (งานที่กำลังผลิต/เสร็จแล้ว/ค้าง/ใกล้ครบกำหนด) ย้ายไปอยู่ในหน้า
  // "ภาพรวม" แล้ว — กดแล้วต้องสลับมาที่แท็บ "คำสั่งผลิต" ให้ด้วยเพื่อเห็นตารางที่กรองไว้
  onRequestOrdersTab(() => switchTab("orders"));
  // ปุ่ม "ดูสรุปภาพรวมการผลิต" ในหน้าคำสั่งผลิต พากลับไปหน้าภาพรวม
  onRequestOverviewTab(() => switchTab("overview"));
  initOrdersTab();

  // Deep-link: เปิดแท็บที่ระบุใน #hash ได้ (เช่น admin.html#orders จากลิงก์เก่า console.html)
  const hashTab = (location.hash || "").replace("#", "").trim();
  if (hashTab && document.getElementById("ad-tabbtn-" + hashTab)) {
    switchTab(hashTab);
  }

  // P1.6a: จำกัดมุมมองแท็บตาม role ของบัญชีที่ login อยู่ (role "production" = เห็นแค่
  // แท็บคำสั่งผลิต) — เรียกหลังสุดเสมอ ให้ชนะทั้งแท็บเริ่มต้น (overview) และ deep-link
  // #hash ด้านบน ดูรายละเอียด/ขอบเขตเต็มใน js/admin-role-ui.js
  let myRole = null;
  try {
    myRole = await getMyStaffRole(user.uid);
  } catch (err) {
    console.warn("[admin-page] โหลด role ของบัญชีตัวเองไม่สำเร็จ (ถือว่าเป็น admin ตามค่าเริ่มต้นเดิม เห็นทุกแท็บ)", err);
  }
  applyRoleUI(myRole, { tabsBox, switchTab, getActiveTab: () => activeTab });

  // P1.6e: onboarding checklist ตอนล็อกอินครั้งแรก (แนะนำฟีเจอร์ที่มีอยู่แล้ว: ค้นหากลาง/
  // undo หลังลบ/confirm dialog) — เรียกท้ายสุดเสมอ หลัง applyRoleUI() ไม่ให้บัง flow อื่น
  // ห่อ try/catch กันพังทั้งกระบวนการ login ถ้า overlay สร้างไม่สำเร็จด้วยเหตุใดก็ตาม
  // (ตามกฎ "แยก error ของฟีเจอร์ใหม่ออกจาก flow เดิม" ในพรอมต์แผนงาน)
  try {
    maybeShowOnboarding(user.uid);
  } catch (err) {
    console.warn("[admin-page] แสดง onboarding checklist ไม่สำเร็จ", err);
  }
});

async function reloadAll() {
  try {
    const [cats, groups, prods, pfs, settings, blogs, faqs] = await Promise.all([
      getCategories(), getGroups(), getProducts(), getPortfolios(), getSettings(),
      getBlogs(), getFaqs()
    ]);
    setAllCategories(cats);
    setAllGroups(groups);
    setAllProducts(prods);
    setAllPortfolios(pfs);
    setAllBlogs(blogs);
    setAllFaqs(faqs);

    // ย้ายข้อมูลเดิมของ "หัวข้อหมวดหมู่" (text) ให้กลายเป็น groups doc จริงแบบเงียบๆ
    // ครั้งเดียวพอ ครั้งต่อไปจะไม่มีอะไรให้ย้ายแล้วเพราะทุกหมวดหมู่จะมี group_id ติดมาด้วย
    try {
      const { migrated, groups: mergedGroups } = await migrateLegacyGroups(cats, groups);
      if (migrated) setAllGroups(mergedGroups);
    } catch (err) {
      console.warn("ย้ายข้อมูลหมวดหมู่ใหญ่เดิมไม่สำเร็จ", err);
    }

    fillCategorySelects();
    fillGroupSelect();
    renderProducts();
    renderGroups();
    renderCategories();
    renderPortfolios();
    renderBlogs();
    renderFaqs();
    renderContactSettings(settings);
    renderPromoSettings(settings);
    renderVideoSettings(settings);
    renderTeamSettings(settings);
    renderOverview();
  } catch (err) {
    document.getElementById("ad-p-grid").innerHTML =
      errorStateHTML(`โหลดข้อมูลไม่สำเร็จ: ${err.message || ""}`, reloadAll);
  }
}

// ── Tabs ──────────────────────────────
function switchTab(tab, opts) {
  var focusTab = opts && opts.focus;
  tabsBox.querySelectorAll(".cp-tab").forEach(b => {
    const isActive = b.dataset.tab === tab;
    b.classList.toggle("active", isActive);
    b.setAttribute("aria-selected", isActive ? "true" : "false");
    b.setAttribute("tabindex", isActive ? "0" : "-1");
    if (isActive && focusTab) b.focus();
  });
  setActiveTab(tab);
  document.getElementById("ad-tab-overview").style.display   = activeTab === "overview" ? "" : "none";
  document.getElementById("ad-tab-orders").style.display     = activeTab === "orders" ? "" : "none";
  document.getElementById("ad-tab-products").style.display   = activeTab === "products" ? "" : "none";
  document.getElementById("ad-tab-leads").style.display      = activeTab === "leads" ? "" : "none";
  document.getElementById("ad-tab-categories").style.display = activeTab === "categories" ? "" : "none";
  document.getElementById("ad-tab-portfolio").style.display  = activeTab === "portfolio" ? "" : "none";
  document.getElementById("ad-tab-blog").style.display       = activeTab === "blog" ? "" : "none";
  document.getElementById("ad-tab-faq").style.display        = activeTab === "faq" ? "" : "none";
  document.getElementById("ad-tab-quotations").style.display = activeTab === "quotations" ? "" : "none";
  document.getElementById("ad-tab-settings").style.display   = activeTab === "settings" ? "" : "none";
  if (activeTab === "leads") startLeadsListener();
  if (activeTab === "overview") renderOverview();
  if (activeTab === "settings") { renderStaffList(); renderAuditLog(); switchSettingsSubtab(activeSettingsSubtab); }
}

tabsBox.querySelectorAll(".cp-tab").forEach(btn => {
  btn.addEventListener("click", () => switchTab(btn.dataset.tab));
});

// ── แท็บย่อยในหน้า "ตั้งค่าเว็บไซต์": เดิมเป็นการ์ดเรียงยาวทั้งหมดในหน้าเดียว
// ปรับให้กดสลับดูทีละเรื่อง (ข้อมูลติดต่อ/โปรโมชั่น/วิดีโอ/ทีมงาน/บัญชีผู้ใช้/ประวัติ)
// แทน — ลดความรกของหน้าจอ ใช้งานง่ายขึ้นสำหรับคนที่ไม่คุ้นหน้าตั้งค่า
const SETTINGS_SUBTABS = ["contact", "promo", "videos", "team", "staff", "audit"];
let activeSettingsSubtab = "contact";
const settingsTabsBox = document.getElementById("ad-settings-tabs");

function switchSettingsSubtab(subtab, opts) {
  if (!SETTINGS_SUBTABS.includes(subtab)) return;
  const focusTab = opts && opts.focus;
  activeSettingsSubtab = subtab;
  SETTINGS_SUBTABS.forEach(id => {
    const isActive = id === subtab;
    const btn = document.getElementById("ad-stabbtn-" + id);
    const panel = document.getElementById("set-" + id);
    if (btn) {
      btn.classList.toggle("active", isActive);
      btn.setAttribute("aria-selected", isActive ? "true" : "false");
      btn.setAttribute("tabindex", isActive ? "0" : "-1");
      if (isActive && focusTab) btn.focus();
    }
    if (panel) panel.toggleAttribute("hidden", !isActive);
  });
}

if (settingsTabsBox) {
  settingsTabsBox.querySelectorAll(".ad-settings-tab").forEach(btn => {
    btn.addEventListener("click", () => switchSettingsSubtab(btn.dataset.settingsTab));
  });
  // ลูกศรซ้าย/ขวา + Home/End เลื่อนโฟกัสระหว่างแท็บย่อย เหมือนเมนูหลัก
  settingsTabsBox.addEventListener("keydown", (e) => {
    const keys = ["ArrowLeft", "ArrowRight", "Home", "End"];
    if (!keys.includes(e.key)) return;
    const tabs = SETTINGS_SUBTABS;
    const currentIndex = tabs.indexOf(activeSettingsSubtab);
    if (currentIndex === -1) return;
    e.preventDefault();
    let nextIndex = currentIndex;
    if (e.key === "ArrowRight") nextIndex = (currentIndex + 1) % tabs.length;
    else if (e.key === "ArrowLeft") nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") nextIndex = 0;
    else if (e.key === "End") nextIndex = tabs.length - 1;
    switchSettingsSubtab(tabs[nextIndex], { focus: true });
  });
}

// ── แท็บตั้งค่า: ปุ่ม "?" พับ/กางคำอธิบายยาวในแต่ละการ์ด (ลดความรกของฟอร์ม, กดดูเพิ่มได้เมื่อจำเป็น) ──
document.getElementById("ad-tab-settings")?.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-help-toggle]");
  if (!btn) return;
  const help = btn.closest(".ad-settings-title")?.nextElementSibling;
  if (!help || !help.classList.contains("ad-settings-help")) return;
  const isHidden = help.hasAttribute("hidden");
  help.toggleAttribute("hidden", !isHidden);
  btn.setAttribute("aria-expanded", String(isHidden));
});

export { switchTab, switchSettingsSubtab, reloadAll };
