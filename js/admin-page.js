// ===========================
// js/admin-page.js — จัดการเนื้อหาเว็บไซต์ (สินค้า / หมวดหมู่)
// ===========================
import { onAuthChange, loginAdmin, logoutAdmin,
         getGroups, saveGroup, deleteGroup, migrateLegacyGroups,
         getCategories, saveCategory, deleteCategory,
         getProducts, saveProduct, deleteProduct,
         getPortfolios, savePortfolio, deletePortfolio,
         getSettings, saveSettings,
         listenLeads, updateLeadStatus, updateLeadNotes, updateLeadAssignee, deleteLead,
         getBlogs, saveBlog, deleteBlog,
         getFaqs, saveFaq, deleteFaq,
         getPartners, savePartner, deletePartner,
         getTestimonials, saveTestimonial, deleteTestimonial,
         daysUntilDue, computeMonthlyRevenue, auditLogToCSV,
         getStaffProfile, listStaff, upsertStaffRole, removeStaffRole, logAudit, listAuditLog,
         uploadImage, uploadFile, deleteImage } from "./db.js";
import { initOrdersTab, stopOrdersTab, getOrderReminders, jumpToOrderReminder, onOrdersChanged,
         getAllOrders, jumpToOrder, onRequestOrdersTab, onRequestOverviewTab } from "./orders-tab.js";
import { confirmDialog, emptyStateHTML, attachInlineValidation, validateFormInline,
         attachUnsavedGuard, showUndoToast, errorStateHTML, isAnyFormDirty,
         monthlySnapshotUpdate, renderSparkline } from "./ui-helpers.js";

const gate        = document.getElementById("ad-gate");
const app         = document.getElementById("ad-app");
const loginForm   = document.getElementById("ad-login-form");
const loginError  = document.getElementById("ad-login-error");
const logoutBtn   = document.getElementById("ad-logout-btn");
const userEmailEl = document.getElementById("ad-user-email");
const tabsBox     = document.getElementById("ad-tabs");

let allProducts = [];
let allCategories = [];
let allGroups = [];
let allPortfolios = [];
let allBlogs = [];
// รายการ id ที่กำลังรอ "เลิกทำ" อยู่ในช่วง undo หลังลบ (ดู deleteWithUndo ด้านบน)
const pendingDeleteProductIds = new Set();
const pendingDeletePortfolioIds = new Set();
const pendingDeleteBlogIds = new Set();
const pendingDeleteLeadIds = new Set();
const pendingDeleteCategoryIds = new Set();
const pendingDeleteGroupIds = new Set();
const pendingDeleteFaqIds = new Set();
const pendingDeletePartnerIds = new Set();
const pendingDeleteTestimonialIds = new Set();
const pendingDeleteStaffUids = new Set();
let allFaqs = [];
let allPartners = [];
let allTestimonials = [];
let activeTab = "overview";

// ── Toast notifications (แทนที่ showToast() ของเบราว์เซอร์ — ดูสไตล์เดียวกับ orders-tab.js) ──
let toastWrap = null;
function showToast(message, kind = "error") {
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
let openOverlayCount = 0;
function openOverlay(el) {
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
}
function closeOverlay(el) {
  if (!el) return;
  el.style.display = "none";
  openOverlayCount = Math.max(0, openOverlayCount - 1);
  if (openOverlayCount === 0) {
    document.body.classList.remove("cp-scroll-locked");
    document.body.style.paddingRight = "";
  }
}

// ── Undo หลังลบ ──────────────────────────────
// แทนที่จะลบจริงทันทีหลัง confirmDialog ยืนยัน จะใส่ id ไว้ใน "pendingSet" ก่อน
// (แต่ละรายการที่ลบได้ในหน้านี้มี Set ของตัวเอง — ดูตัวแปร pendingDelete*Ids ด้านล่าง)
// แล้วให้ฟังก์ชัน render/filter ของรายการนั้นซ่อนแถวที่อยู่ใน Set ออกจากหน้าจอทันที
// จากนั้นแสดง toast ค้างไว้ ~5 วิ พร้อมปุ่ม "เลิกทำ" ก่อนค่อยเรียกลบจริงจาก DB
// ถ้ากด "เลิกทำ" ทัน จะเอา id ออกจาก Set แล้ว render ใหม่ ทำให้รายการกลับมาเหมือนเดิม
async function deleteWithUndo({ pendingSet, id, renderFn, message, deleteFn, onCommitted, targetType }) {
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
  } catch (err) {
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

onAuthChange(async (user) => {
  if (!user) {
    app.style.display = "none";
    gate.style.display = "flex";
    if (leadsUnsub) { leadsUnsub(); leadsUnsub = null; leadsStarted = false; }
    stopOrdersTab();
    return;
  }
  gate.style.display = "none";
  app.style.display = "block";
  userEmailEl.textContent = user.email || "";
  await reloadAll();
  startLeadsListener();
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
});

async function reloadAll() {
  try {
    const [cats, groups, prods, pfs, settings, blogs, faqs, partners, testimonials] = await Promise.all([
      getCategories(), getGroups(), getProducts(), getPortfolios(), getSettings(),
      getBlogs(), getFaqs(), getPartners(), getTestimonials()
    ]);
    allCategories = cats;
    allGroups = groups;
    allProducts = prods;
    allPortfolios = pfs;
    allBlogs = blogs;
    allFaqs = faqs;
    allPartners = partners;
    allTestimonials = testimonials;

    // ย้ายข้อมูลเดิมของ "หัวข้อหมวดหมู่" (text) ให้กลายเป็น groups doc จริงแบบเงียบๆ
    // ครั้งเดียวพอ ครั้งต่อไปจะไม่มีอะไรให้ย้ายแล้วเพราะทุกหมวดหมู่จะมี group_id ติดมาด้วย
    try {
      const { migrated, groups: mergedGroups } = await migrateLegacyGroups(allCategories, allGroups);
      if (migrated) allGroups = mergedGroups;
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
    renderPartners();
    renderTestimonials();
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
  activeTab = tab;
  document.getElementById("ad-tab-overview").style.display   = activeTab === "overview" ? "" : "none";
  document.getElementById("ad-tab-orders").style.display     = activeTab === "orders" ? "" : "none";
  document.getElementById("ad-tab-products").style.display   = activeTab === "products" ? "" : "none";
  document.getElementById("ad-tab-leads").style.display      = activeTab === "leads" ? "" : "none";
  document.getElementById("ad-tab-categories").style.display = activeTab === "categories" ? "" : "none";
  document.getElementById("ad-tab-portfolio").style.display  = activeTab === "portfolio" ? "" : "none";
  document.getElementById("ad-tab-blog").style.display       = activeTab === "blog" ? "" : "none";
  document.getElementById("ad-tab-faq").style.display        = activeTab === "faq" ? "" : "none";
  document.getElementById("ad-tab-partners").style.display   = activeTab === "partners" ? "" : "none";
  document.getElementById("ad-tab-testimonials").style.display = activeTab === "testimonials" ? "" : "none";
  document.getElementById("ad-tab-settings").style.display   = activeTab === "settings" ? "" : "none";
  if (activeTab === "leads") startLeadsListener();
  if (activeTab === "overview") renderOverview();
  if (activeTab === "settings") { renderStaffList(); renderAuditLog(); }
}

tabsBox.querySelectorAll(".cp-tab").forEach(btn => {
  btn.addEventListener("click", () => switchTab(btn.dataset.tab));
});

// คีย์บอร์ด: ลูกศรขึ้น/ลง/ซ้าย/ขวาเลื่อนโฟกัสระหว่างแท็บ, Home/End ไปหัว/ท้ายลิสต์
// (ทำงานร่วมกับ role="tablist"/"tab" ที่ใส่ไว้ใน admin.html — ไม่แตะ data-tab เดิม)
//
// จอกว้าง (≥900px, ตรงกับ breakpoint ใน css/admin.css): sidebar เป็นคอลัมน์แนวตั้งเดียว
// (กลุ่มเรียงบนลงล่างในคอลัมน์เดียวกัน) — ลูกศรทุกทิศทางเลื่อนเชิงเส้นไป
// ตัวถัดไป/ก่อนหน้าในลิสต์รวม แบบเดิมทุกประการ ไม่แตะพฤติกรรมเดิม
//
// จอแคบ (<900px): sidebar ยุบเป็น "แถวของคอลัมน์" จริง ๆ (แต่ละกลุ่ม = 1 คอลัมน์
// เรียงซ้าย→ขวา, ในคอลัมน์เรียงบน→ล่าง) จึงทำ 2D grid navigation จริงให้ตรงกับ
// เลย์เอาต์ที่เห็น: ซ้าย/ขวา = ข้ามคอลัมน์ (คงตำแหน่งแถวเดิม ถ้าคอลัมน์ปลายทางสั้นกว่า
// จะ clamp ไปแถวสุดท้ายของคอลัมน์นั้น), ขึ้น/ลง = เลื่อนในคอลัมน์เดียวกัน (wrap ในคอลัมน์)
const AD_SIDEBAR_GRID_BP = "(max-width: 899px)";

tabsBox.addEventListener("keydown", (e) => {
  const keys = ["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight", "Home", "End"];
  if (!keys.includes(e.key)) return;

  const isGridLayout = window.matchMedia(AD_SIDEBAR_GRID_BP).matches;

  if (!isGridLayout) {
    // จอกว้าง: ลิสต์แนวตั้งเดียว — ลอจิกเดิมทุกประการ
    const allTabs = Array.from(tabsBox.querySelectorAll(".cp-tab")).filter(b => !b.classList.contains("ad-nav-hidden"));
    const currentIndex = allTabs.indexOf(document.activeElement);
    if (currentIndex === -1) return;
    e.preventDefault();
    let nextIndex = currentIndex;
    if (e.key === "ArrowDown" || e.key === "ArrowRight") nextIndex = (currentIndex + 1) % allTabs.length;
    else if (e.key === "ArrowUp" || e.key === "ArrowLeft") nextIndex = (currentIndex - 1 + allTabs.length) % allTabs.length;
    else if (e.key === "Home") nextIndex = 0;
    else if (e.key === "End") nextIndex = allTabs.length - 1;
    switchTab(allTabs[nextIndex].dataset.tab, { focus: true });
    return;
  }

  // จอแคบ: แต่ละกลุ่ม = 1 คอลัมน์ (ตรงกับ .cp-sidebar-group ที่ CSS จัดเรียงเป็นแถวของคอลัมน์)
  const groups = Array.from(tabsBox.querySelectorAll(".cp-sidebar-group"))
    .filter(g => !g.classList.contains("ad-nav-hidden"))
    .map(g => Array.from(g.querySelectorAll(".cp-tab")).filter(b => !b.classList.contains("ad-nav-hidden")))
    .filter(g => g.length > 0);
  if (groups.length === 0) return;

  let gIdx = -1, iIdx = -1;
  for (let g = 0; g < groups.length; g++) {
    const idx = groups[g].indexOf(document.activeElement);
    if (idx !== -1) { gIdx = g; iIdx = idx; break; }
  }
  if (gIdx === -1) return;
  e.preventDefault();

  let targetItem = null;
  if (e.key === "ArrowDown") {
    const col = groups[gIdx];
    targetItem = col[(iIdx + 1) % col.length];
  } else if (e.key === "ArrowUp") {
    const col = groups[gIdx];
    targetItem = col[(iIdx - 1 + col.length) % col.length];
  } else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
    const nextGIdx = e.key === "ArrowRight"
      ? (gIdx + 1) % groups.length
      : (gIdx - 1 + groups.length) % groups.length;
    const col = groups[nextGIdx];
    targetItem = col[Math.min(iIdx, col.length - 1)];
  } else if (e.key === "Home") {
    targetItem = groups[0][0];
  } else if (e.key === "End") {
    const lastCol = groups[groups.length - 1];
    targetItem = lastCol[lastCol.length - 1];
  }

  if (targetItem) switchTab(targetItem.dataset.tab, { focus: true });
});

// หมายเหตุ: การ์ด "งานใหม่" (data-jump="orders") ย้ายไปอยู่ในกริดสถิติคำสั่งผลิต
// (#cp-stats-grid) รวมกับการ์ดคำสั่งผลิตอื่น ๆ แล้ว — ตัวจับ event ของมันจึงอยู่ใน
// orders-tab.js เหมือนการ์ดคำสั่งผลิตใบอื่น ๆ ที่นี่จึงเหลือแค่การ์ดสรุปเนื้อหาเว็บไซต์
document.getElementById("ov-stats-grid").addEventListener("click", (e) => {
  const card = e.target.closest("[data-jump]");
  if (!card) return;
  switchTab(card.dataset.jump);
});

// ── Sidebar quick-filter (ค้นหาเมนู) ──────────────────────────────
// กรอง/ไฮไลต์ปุ่มเมนูตามคำค้น โดยไม่แตะ data-tab/switchTab เดิม — ถ้าไม่พิมพ์อะไร
// ก็แสดงเมนูครบเหมือนเดิมทุกประการ
//
// รองรับ 2 เรื่องที่ backlog ค้างไว้:
// 1) คำพ้อง — คนอาจพิมพ์คำที่ไม่ตรงกับ label เป๊ะ ๆ (เช่น "แดชบอร์ด" แทน "ภาพรวม",
//    "ใบเสนอราคา"/"quote" แทน "ลีด", "โลโก้" แทน "โลโก้ลูกค้า") เลยทำ synonym map
//    ต่อแท็บ ครอบคลุมทั้งไทย/อังกฤษที่คนน่าจะพิมพ์ค้นหาจริง ๆ
// 2) "ตัดคำไทย" — ภาษาไทยไม่มีเว้นวรรคระหว่างคำ การเช็ค .includes() ตรง ๆ กับ
//    label/keyword เดี่ยว ๆ จับคำย่อยที่ติดกันได้อยู่แล้วโดยธรรมชาติของสคริปต์ไทย
//    (ไม่ต้องพึ่ง word-segmentation library) แต่ถ้าคนพิมพ์หลายคำคนละลำดับหรือมี
//    เว้นวรรคคั่น (เช่น "รีวิว ลูกค้า" ขณะที่ label จริงคือ "รีวิวลูกค้า" ไม่มีเว้นวรรค)
//    การเช็คทั้งก้อนแบบเดิมจะไม่เจอ — เลยตัดคำค้นด้วยช่องว่างเป็น token แล้วเช็คว่า
//    ทุก token ต้องเจอในชุดคำของแท็บนั้น (AND ข้าม token, OR ภายใน keyword list
//    ของแต่ละแท็บ) วิธีนี้ครอบคลุมของจริงได้โดยไม่ต้องเพิ่ม dependency ตัดคำไทย
//    เต็มรูปแบบซึ่งเกินความจำเป็นสำหรับเมนูแค่ 10 รายการนี้
const AD_TAB_KEYWORDS = {
  overview:     ["ภาพรวม", "แดชบอร์ด", "dashboard", "หน้าหลัก", "สรุป", "overview"],
  orders:       ["คำสั่งผลิต", "order", "orders", "production console", "ผลิต", "จัดส่ง", "shipping", "order queue", "งานผลิต"],
  products:     ["สินค้า", "product", "products", "รายการสินค้า", "แคตตาล็อก", "catalog"],
  categories:   ["หมวดหมู่", "category", "categories", "หมวด", "กลุ่มสินค้า"],
  portfolio:    ["ผลงาน", "portfolio", "เคส", "case", "โปรเจกต์", "project", "ผลงานที่ผ่านมา"],
  blog:         ["บทความ", "blog", "บล็อก", "ข่าวสาร", "โพสต์", "post", "content", "คอนเทนต์"],
  faq:          ["คำถามที่พบบ่อย", "faq", "คำถาม", "ถามตอบ", "q&a", "qa"],
  leads:        ["ลีด", "lead", "leads", "ลูกค้าเป้าหมาย", "ใบเสนอราคา", "quote", "ผู้สนใจ", "inquiry"],
  partners:     ["โลโก้ลูกค้า", "partner", "partners", "โลโก้", "logo", "แบรนด์", "brand"],
  testimonials: ["รีวิวลูกค้า", "testimonial", "testimonials", "รีวิว", "review", "ความคิดเห็น", "คำติชม"],
  settings:     ["ตั้งค่าเว็บไซต์", "settings", "setting", "ตั้งค่า", "config", "การตั้งค่า"],
};

// ── Sidebar collapse: พับเมนูซ้ายเหลือแค่ไอคอน (จำสถานะไว้ข้ามเซสชัน) ──
const SIDEBAR_COLLAPSE_KEY = "cssign_admin_sidebar_collapsed_v1";
const sidebarCollapseBtn = document.getElementById("ad-sidebar-collapse-btn");
// ตั้ง title="ชื่อเมนู" ให้ทุกปุ่มแท็บไว้ล่วงหน้า — ใช้เป็น tooltip ของเบราว์เซอร์เองตอนเมนูพับ
// (ไม่ต้องสร้าง custom tooltip เพิ่ม เบราว์เซอร์ทำให้ฟรีเมื่อไอคอนไม่มีข้อความกำกับ)
tabsBox.querySelectorAll(".cp-tab").forEach(btn => {
  if (!btn.title) {
    const label = (btn.querySelector("span")?.textContent || "").trim();
    if (label) btn.title = label;
  }
});
function applySidebarCollapsed(collapsed) {
  tabsBox.classList.toggle("is-collapsed", collapsed);
  if (sidebarCollapseBtn) {
    sidebarCollapseBtn.setAttribute("aria-expanded", String(!collapsed));
    sidebarCollapseBtn.title = collapsed ? "กางเมนู" : "พับเมนู";
  }
}
applySidebarCollapsed(localStorage.getItem(SIDEBAR_COLLAPSE_KEY) === "1");
if (sidebarCollapseBtn) {
  sidebarCollapseBtn.addEventListener("click", () => {
    const next = !tabsBox.classList.contains("is-collapsed");
    applySidebarCollapsed(next);
    localStorage.setItem(SIDEBAR_COLLAPSE_KEY, next ? "1" : "0");
  });
}

const adSidebarSearch = document.getElementById("ad-sidebar-search");
if (adSidebarSearch) {
  adSidebarSearch.addEventListener("input", () => {
    const tokens = adSidebarSearch.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    tabsBox.querySelectorAll(".cp-sidebar-group").forEach(group => {
      let anyVisible = false;
      group.querySelectorAll(".cp-tab").forEach(btn => {
        const label = (btn.querySelector("span")?.textContent || "").toLowerCase();
        const keywords = AD_TAB_KEYWORDS[btn.dataset.tab] || [];
        const haystack = [label, ...keywords.map(k => k.toLowerCase())];
        const match = tokens.length === 0 || tokens.every(t => haystack.some(h => h.includes(t)));
        btn.classList.toggle("ad-nav-hidden", !match);
        if (match) anyVisible = true;
      });
      group.classList.toggle("ad-nav-hidden", !anyVisible);
    });
  });
}

// ── Overview dashboard: snapshot รายเดือน (localStorage) เพื่อเทียบ % กับเดือนก่อน
//    และเก็บ history จริงสำหรับ sparkline — ใช้ helper กลางจาก ui-helpers.js ร่วมกับ
//    สถิติคำสั่งผลิตใน orders-tab.js (คนละ storage key) ──
const OV_SNAPSHOT_KEY = "cssign_admin_overview_snapshot_v1";
function ovRenderTrend(el, pct) {
  if (!el) return;
  if (pct == null) { el.className = "cp-stat-trend na"; el.innerHTML = ""; return; }
  if (pct > 0) {
    el.className = "cp-stat-trend up";
    el.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M12 19V5M5 12l7-7 7 7"/></svg>+${pct}%`;
  } else if (pct < 0) {
    el.className = "cp-stat-trend down";
    el.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M12 5v14M5 12l7 7 7-7"/></svg>${pct}%`;
  } else {
    el.className = "cp-stat-trend flat";
    el.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 12h14"/></svg>0%`;
  }
}

// ── Overview dashboard ──────────────────────────────
function ovFormatBaht(n) {
  return "฿" + Math.round(n || 0).toLocaleString("th-TH");
}

// กราฟเส้นรายได้ 6 เดือนย้อนหลัง — SVG ล้วน ไม่พึ่ง library ภายนอก (สม่ำเสมอกับกราฟแท่งที่มีอยู่แล้ว)
function renderRevenueLineChart() {
  const box = document.getElementById("ov-revenue-linechart");
  if (!box) return;
  const orders = getAllOrders ? getAllOrders() : [];
  const data = computeMonthlyRevenue(orders, 6);
  const W = 640, H = 160, padL = 46, padR = 16, padT = 14, padB = 26;
  const max = Math.max(1, ...data.map(d => d.total));
  const stepX = (W - padL - padR) / (data.length - 1 || 1);
  const points = data.map((d, i) => {
    const x = padL + stepX * i;
    const y = padT + (H - padT - padB) * (1 - d.total / max);
    return { x, y, d };
  });
  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${points[points.length - 1].x.toFixed(1)},${H - padB} L${points[0].x.toFixed(1)},${H - padB} Z`;
  const gridY = [0, 0.5, 1].map(f => padT + (H - padT - padB) * f);

  box.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:${H}px;overflow:visible;">
      ${gridY.map(y => `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="var(--gray-200)" stroke-width="1"/>`).join("")}
      <path d="${areaPath}" fill="url(#ovRevGrad)" opacity="0.15"/>
      <path d="${linePath}" fill="none" stroke="var(--primary)" stroke-width="2.5"/>
      ${points.map(p => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3.5" fill="var(--primary)"><title>${escapeHtml(p.d.label)}: ${ovFormatBaht(p.d.total)}</title></circle>`).join("")}
      ${points.map(p => `<text x="${p.x.toFixed(1)}" y="${H - 8}" font-size="10" text-anchor="middle" fill="var(--text-meta)">${escapeHtml(p.d.label)}</text>`).join("")}
      <defs><linearGradient id="ovRevGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="var(--primary)"/><stop offset="100%" stop-color="var(--primary)" stop-opacity="0"/>
      </linearGradient></defs>
    </svg>`;
}

function renderOverview() {
  const ovLeadsNewCount = allLeads.filter(l => l.status === "new").length;
  // หมายเหตุ: การ์ด "จำนวนงานใหม่" ย้ายไปรวมกับสถิติคำสั่งผลิตอื่น ๆ ในกริดเดียว
  // (#cp-stats-grid ใน orders-tab.js) แล้ว เพื่อลดความซ้ำซ้อน — กริดนี้จึงเหลือแค่
  // สถิติสรุปเนื้อหาเว็บไซต์ (สินค้า/หมวดหมู่/ผลงาน/บทความ/รีวิว/ลีดใหม่)
  document.getElementById("ov-stat-products").textContent      = allProducts.length;
  document.getElementById("ov-stat-leads-new").textContent     = ovLeadsNewCount;
  document.getElementById("ov-stat-portfolio").textContent     = allPortfolios.length;
  document.getElementById("ov-stat-blog").textContent          = allBlogs.length;
  document.getElementById("ov-stat-categories").textContent    = allCategories.length;
  document.getElementById("ov-stat-testimonials").textContent  = allTestimonials.length;

  // สถิติแนวโน้ม — % เทียบเดือนก่อน + sparkline จาก history จริงที่บันทึกไว้ทุกเดือน
  const { trends: ovTrends, history: ovHistory } = monthlySnapshotUpdate(OV_SNAPSHOT_KEY, {
    products: allProducts.length,
    leadsNew: ovLeadsNewCount,
    portfolio: allPortfolios.length,
    blog: allBlogs.length,
    categories: allCategories.length,
    testimonials: allTestimonials.length
  });
  ovRenderTrend(document.getElementById("ov-trend-products"), ovTrends.products);
  ovRenderTrend(document.getElementById("ov-trend-leads-new"), ovTrends.leadsNew);
  ovRenderTrend(document.getElementById("ov-trend-portfolio"), ovTrends.portfolio);
  ovRenderTrend(document.getElementById("ov-trend-blog"), ovTrends.blog);
  ovRenderTrend(document.getElementById("ov-trend-categories"), ovTrends.categories);
  ovRenderTrend(document.getElementById("ov-trend-testimonials"), ovTrends.testimonials);
  renderSparkline(document.getElementById("ov-spark-products"), ovHistory.products);
  renderSparkline(document.getElementById("ov-spark-leads-new"), ovHistory.leadsNew);
  renderSparkline(document.getElementById("ov-spark-portfolio"), ovHistory.portfolio);
  renderSparkline(document.getElementById("ov-spark-blog"), ovHistory.blog);
  renderSparkline(document.getElementById("ov-spark-categories"), ovHistory.categories);
  renderSparkline(document.getElementById("ov-spark-testimonials"), ovHistory.testimonials);

  // Quick actions (ผูก event ครั้งเดียวพอ — เช็ค dataset.wired กันผูกซ้ำตอน render ซ้ำๆ)
  const ovQuickAddProduct = document.getElementById("ov-quick-add-product");
  const ovQuickAddOrder   = document.getElementById("ov-quick-add-order");
  if (ovQuickAddProduct && !ovQuickAddProduct.dataset.wired) {
    ovQuickAddProduct.dataset.wired = "1";
    ovQuickAddProduct.addEventListener("click", () => openProductModal(null));
  }
  if (ovQuickAddOrder && !ovQuickAddOrder.dataset.wired) {
    ovQuickAddOrder.dataset.wired = "1";
    ovQuickAddOrder.addEventListener("click", () => {
      switchTab("orders");
      const ordersAddBtn = document.getElementById("cp-add-btn");
      if (ordersAddBtn) ordersAddBtn.click();
    });
  }

  // "ดูทั้งหมด" — เชื่อมไปแท็บลีด
  const ovLeadsViewAll = document.getElementById("ov-leads-viewall");
  if (ovLeadsViewAll && !ovLeadsViewAll.dataset.wired) {
    ovLeadsViewAll.dataset.wired = "1";
    ovLeadsViewAll.addEventListener("click", () => switchTab("leads"));
  }

  // "ไปที่คำสั่งผลิต →" — หัวข้อ "สรุปคำสั่งผลิต" เชื่อมไปแท็บคำสั่งผลิต
  const ovOrdersViewAll = document.getElementById("ov-orders-viewall");
  if (ovOrdersViewAll && !ovOrdersViewAll.dataset.wired) {
    ovOrdersViewAll.dataset.wired = "1";
    ovOrdersViewAll.addEventListener("click", () => switchTab("orders"));
  }

  try { renderRevenueLineChart(); } catch (err) { console.error("[admin-page] renderRevenueLineChart ล้มเหลว", err); }

  // หมายเหตุ: กล่อง "สินค้าแยกตามหมวดหมู่" ถูกตัดออกแล้ว เพราะซ้ำ concept กับกล่อง
  // "แยกตามหมวดป้าย" (คำสั่งผลิตแยกตามหมวดหมู่) ที่อยู่ในส่วนสรุปคำสั่งผลิตด้านล่างอยู่แล้ว
  const leadsBox = document.getElementById("ov-recent-leads");
  const pendingLeads = allLeads.filter(l => !["replied", "won", "lost"].includes(l.status)).slice(0, 5);
  if (!pendingLeads.length) {
    leadsBox.innerHTML = `<div class="cp-empty">ไม่มีลีดที่รอดำเนินการ</div>`;
  } else {
    leadsBox.innerHTML = pendingLeads.map(l => `
      <div class="cp-breakdown-row" style="cursor:pointer;" data-lead-id="${l.id}">
        <span class="cp-breakdown-name" style="width:auto;flex:1;" title="${escapeHtml(l.name||'')}">${escapeHtml(l.name || l.company || "ไม่ระบุชื่อ")}</span>
        <span class="cp-breakdown-count" style="width:auto;color:${l.status==='new'?'#B45309':'var(--gray-400)'};">${l.status === "new" ? "ใหม่" : "อ่านแล้ว"}</span>
      </div>`).join("");
    leadsBox.querySelectorAll("[data-lead-id]").forEach(row => {
      row.addEventListener("click", () => switchTab("leads"));
    });
  }

  renderOverviewActivity();

  // "ดูทั้งหมด →" กิจกรรมล่าสุด — เชื่อมไปแท็บตั้งค่า (ประวัติการทำงาน / Audit Log)
  const ovActivityViewAll = document.getElementById("ov-activity-viewall");
  if (ovActivityViewAll && !ovActivityViewAll.dataset.wired) {
    ovActivityViewAll.dataset.wired = "1";
    ovActivityViewAll.addEventListener("click", () => switchTab("settings"));
  }
}

// การ์ด "กิจกรรมล่าสุดในระบบ" ในหน้าภาพรวม/แดชบอร์ด — ดึงจาก collection auditLog จริง
// (ใช้ logAudit/listAuditLog ตัวเดียวกับแท็บตั้งค่า "ประวัติการทำงาน" ไม่ใช่ข้อมูลจำลอง)
async function renderOverviewActivity() {
  const box = document.getElementById("ov-recent-activity");
  if (!box) return;
  try {
    const rows = await listAuditLog(6);
    if (!rows.length) {
      box.innerHTML = `<div class="cp-empty">ยังไม่มีกิจกรรม</div>`;
      return;
    }
    box.innerHTML = rows.map(r => `
      <div class="ad-audit-row">
        <span class="ad-audit-action">${escapeHtml(AUDIT_ACTION_LABEL[r.action] || r.action)}</span>
        <span>${escapeHtml(r.targetType || "")}${r.meta ? " — " + escapeHtml(r.meta) : ""}</span>
        <span class="ad-audit-meta">${escapeHtml(r.email || r.uid || "")} · ${fmtAuditTime(r.createdAt)}</span>
      </div>`).join("");
  } catch (err) {
    // เกิดกับบัญชี role "staff" ที่ Firestore rules ไม่ให้อ่าน auditLog — โชว์ข้อความแทน ไม่ใช่ error จริง
    box.innerHTML = `<div class="cp-empty">ดูกิจกรรมนี้ได้เฉพาะบัญชีที่มีบทบาท admin เท่านั้น</div>`;
  }
}

// ── Notification bell (ลีดใหม่) ──────────────────────────────
const adNotifBtn   = document.getElementById("ad-notif-btn");
const adNotifDot   = document.getElementById("ad-notif-dot");
const adNotifPanel = document.getElementById("ad-notif-panel");
const adNotifList  = document.getElementById("ad-notif-list");

adNotifBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  adNotifPanel.style.display = adNotifPanel.style.display === "none" ? "block" : "none";
});
document.addEventListener("click", (e) => {
  if (!adNotifPanel.contains(e.target) && e.target !== adNotifBtn) adNotifPanel.style.display = "none";
});

function renderNotifBell() {
  const newLeads = allLeads.filter(l => l.status === "new");
  const { overdue, dueSoon } = getOrderReminders();
  const totalCount = newLeads.length + overdue.length + dueSoon.length;
  adNotifDot.style.display = totalCount ? "block" : "none";
  if (!totalCount) {
    adNotifList.innerHTML = `<div class="cp-notif-empty">ไม่มีการแจ้งเตือนตอนนี้</div>`;
    return;
  }

  // เรียงเกินกำหนดขึ้นก่อน (เร่งด่วนสุด) ตามด้วยใกล้ครบกำหนด แล้วค่อยลีดใหม่
  const orderItemHtml = (o, urgent) => `
    <div class="cp-notif-item ${urgent ? "is-overdue" : "is-duesoon"}" data-order-id="${o.id}" data-urgency="${urgent ? "overdue" : "due-soon"}">
      <span class="cp-notif-item-title">${escapeHtml(o.code || o.item || "คำสั่งผลิต")}</span>
      <span class="cp-notif-item-sub">${urgent ? "เกินกำหนดส่งแล้ว" : "ใกล้ครบกำหนดส่ง"} — ${escapeHtml(o.customer || "")}</span>
    </div>`;
  const leadItemHtml = (l) => `
    <div class="cp-notif-item is-duesoon" data-lead-id="${l.id}">
      <span class="cp-notif-item-title">${escapeHtml(l.name || l.company || "ไม่ระบุชื่อ")}</span>
      <span class="cp-notif-item-sub">${escapeHtml(l.service || l.message || "ลีดใหม่ — ยังไม่ได้อ่าน")}</span>
    </div>`;

  const items = [
    ...overdue.slice(0, 5).map(o => orderItemHtml(o, true)),
    ...dueSoon.slice(0, 5).map(o => orderItemHtml(o, false)),
    ...newLeads.slice(0, 5).map(leadItemHtml)
  ].slice(0, 8);

  adNotifList.innerHTML = items.join("");
  adNotifList.querySelectorAll(".cp-notif-item").forEach(el => {
    el.addEventListener("click", () => {
      adNotifPanel.style.display = "none";
      if (el.dataset.orderId) {
        switchTab("orders");
        jumpToOrderReminder(el.dataset.urgency === "overdue" ? "overdue" : "duesoon");
      } else {
        switchTab("leads");
      }
    });
  });
}

// ── Export CSV helpers ──────────────────────────────
function downloadCsv(filename, headers, rows) {
  const csvRows = [headers.join(",")];
  rows.forEach(r => csvRows.push(r.map(csvCell).join(",")));
  const blob = new Blob(["\uFEFF" + csvRows.join("\r\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}
function csvCell(val) { return `"${String(val ?? "").replace(/"/g, '""')}"`; }

document.getElementById("ad-p-export-btn").addEventListener("click", () => {
  const rows = allProducts.map(p => [p.sku || "", p.name || "", catName(p.cat_id), p.price ?? "", p.featured ? "ใช่" : "ไม่ใช่"]);
  downloadCsv(`products-${new Date().toISOString().slice(0,10)}.csv`,
    ["รหัสสินค้า","ชื่อสินค้า","หมวดหมู่","ราคา","แนะนำ"], rows);
});

document.getElementById("ad-l-export-btn").addEventListener("click", () => {
  const rows = allLeads.map(l => [
    l.createdAt && l.createdAt.toDate ? l.createdAt.toDate().toLocaleDateString("th-TH") : "",
    l.name || "", l.company || "", l.phone || "", l.email || "",
    l.service || "", l.message || "", l.source || "", LEAD_STATUS_LABEL[l.status] || l.status || "",
    l.assignee || ""
  ]);
  downloadCsv(`leads-${new Date().toISOString().slice(0,10)}.csv`,
    ["วันที่","ชื่อ","บริษัท","เบอร์โทร","อีเมล","บริการที่สนใจ","ข้อความ","ช่องทาง","สถานะ","ผู้รับผิดชอบ"], rows);
});

function escapeHtml(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
}

// ── Avatar วงกลมตัวอักษรย่อ (ใช้แทนรูปโปรไฟล์ในตารางลีด — ไม่มีรูปจริงให้ใช้) ──
function initials(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts[0][0] + (parts[1] ? parts[1][0] : "")).toUpperCase();
}
function avatarHtml(name) {
  const hues = [210, 265, 155, 25, 340, 190, 45];
  let h = 0; for (let i = 0; i < String(name||"").length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  const hue = hues[h % hues.length];
  return `<span class="cp-avatar" style="background:hsl(${hue} 70% 94%); color:hsl(${hue} 55% 38%);">${escapeHtml(initials(name))}</span>`;
}

// ── รูปภาพสินค้าเก็บได้ 2 แบบ: string url เดิม (ของเก่า) หรือ {url, label} (รองรับป้ายกำกับรูป เช่น "ซ้าย/ขวา/หน้า/หลัง") ──
function imgUrl(img) { return (img && typeof img === "object") ? (img.url || "") : (img || ""); }
function imgLabel(img) { return (img && typeof img === "object") ? (img.label || "") : ""; }
function normalizeImage(img) { return { url: imgUrl(img), label: imgLabel(img) }; }

// ===========================================================
// PRODUCTS
// ===========================================================
const pGrid       = document.getElementById("ad-p-grid");
const pSearch      = document.getElementById("ad-p-search");
const pFilterCat   = document.getElementById("ad-p-filter-cat");
const pAddBtn      = document.getElementById("ad-p-add-btn");
const pPaginationBox  = document.getElementById("ad-p-pagination");
const pPaginationInfo = document.getElementById("ad-p-pagination-info");
const pPaginationBtns = document.getElementById("ad-p-pagination-btns");

const PRODUCTS_PAGE_SIZE = 12;
let pCurrentPage = 1;
let selectedProductIds = new Set(); // bulk actions: id ที่ถูกเลือก (คงอยู่ข้ามการ re-render/หน้า)

const pOverlay   = document.getElementById("ad-p-overlay");
const pForm       = document.getElementById("ad-p-form");
const pModalTitle = document.getElementById("ad-p-modal-title");
const pCancelBtn  = document.getElementById("ad-p-cancel");
attachInlineValidation(pForm);

// Live "N / max" character counter for SEO meta title/description fields —
// maxlength on the input already hard-stops typing, but gives no feedback on
// how close you are, and Firestore's own limit (see firestore.rules) is the
// same number, so this is just a visible echo of a cap that already exists.
function wireCharCounter(inputId, countId, max) {
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
wireCharCounter("ad-p-meta-title", "ad-p-meta-title-count", 70);
wireCharCounter("ad-p-meta-desc", "ad-p-meta-desc-count", 160);

// ── Bulk actions bar (เลือกหลายการ์ด + ลบ/เปลี่ยนสถานะทีเดียว) ──
const pBulkBar          = document.getElementById("ad-p-bulk-bar");
const pBulkCount        = document.getElementById("ad-p-bulk-count");
const pBulkClearBtn     = document.getElementById("ad-p-bulk-clear");
const pBulkStatusSelect = document.getElementById("ad-p-bulk-status-select");
const pBulkApplyBtn     = document.getElementById("ad-p-bulk-apply-status");
const pBulkDeleteBtn    = document.getElementById("ad-p-bulk-delete");
const pImagesBox  = document.getElementById("ad-p-images");
const pUploadInput = document.getElementById("ad-p-upload");
const pUploadStatus = document.getElementById("ad-p-upload-status");

let currentImages = []; // images of the product currently being edited

// ── Product option axes (ตัวเลือกสินค้าที่แอดมินกำหนดเอง เช่น ชนิดของป้าย /
//    ชนิดของแผ่นรองหลัง / ขนาดของป้าย) + ตารางราคาของทุกชุดค่าผสม (variants) ──
const pAxesBox        = document.getElementById("ad-p-axes");
const pAxisAddBtn      = document.getElementById("ad-p-axis-add");
const pVariantLabel    = document.getElementById("ad-p-variant-label");
const pVariantBuilderBox = document.getElementById("ad-p-variant-builder");
const pVariantTableBox = document.getElementById("ad-p-variant-table");

let currentAxes = [];    // [{ id, label, options: [{ code, label }] }]
let currentVariants = []; // [{ key, codes: [...], price }] — key = codes.join("|"), 1 แถวต่อ 1 ชุดค่าผสม

// รหัสตัวเลือก (code) แอดมินพิมพ์เองได้ (เช่น CST, EST ให้ตรงกับ SKU จริงของบริษัท) ในช่องเล็กๆ
// หน้าค่าตัวเลือกแต่ละค่า — ถ้าเว้นว่างไว้ ระบบจะเติมให้อัตโนมัติเป็น A, B, C, ... ตามลำดับ
// (ค่าเดิมที่เคยมีรหัสอยู่แล้วจะไม่ถูกเปลี่ยน เพื่อไม่ให้ราคาที่กรอกไว้เดิมหลุดหาย)
function optionLetter(i) {
  let n = i + 1, s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}
function ensureOptionCodes(axis) {
  const opts = (axis.options || []).filter((o) => (o.label || "").trim());
  const used = new Set(opts.map((o) => (o.code || "").trim().toUpperCase()).filter(Boolean));
  opts.forEach((o) => {
    if (!(o.code || "").trim()) {
      let i = 0, candidate;
      do { candidate = optionLetter(i); i++; } while (used.has(candidate));
      o.code = candidate;
      used.add(candidate);
    }
  });
}

function genLocalId() {
  return "id" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

async function handleImageUpload(files, targetArray, renderFn, statusEl, withLabel) {
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

function imageGridHTML(images, withLabel) {
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

function fillCategorySelects() {
  const opts = allCategories.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("");
  pFilterCat.innerHTML = `<option value="">ทุกหมวดหมู่</option>` + opts;
  document.getElementById("ad-p-cat").innerHTML = opts || `<option value="">— ยังไม่มีหมวดหมู่ —</option>`;
}

function catName(id) {
  const c = allCategories.find(c => c.id === id);
  return c ? c.name : "ไม่มีหมวดหมู่";
}

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

function renderProducts() {
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
  try { await deleteImage(url); } catch (err) { /* non-blocking */ }
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

// ===========================================================
// PRODUCT OPTION AXES + MANUALLY-BUILT VARIANT PRICE TABLE
// ตัวอย่าง: แกน "ขนาด" มีค่า 20×30/30×45, แกน "เกรด" มีค่า Commercial/Engineer,
// แกน "วัสดุรองหลัง" มีค่า อลูมิเนียม/อะคริลิค — แอดมิน "เลือกเอง" ว่าจะเอาค่าไหนของ
// แต่ละแกนมาผสมกันเป็นแถวราคา ไม่บังคับต้องมีครบทุกชุดผสม (cartesian) เหมือนเดิม
// มีปุ่ม "สร้างครบทุกชุดที่ยังไม่มี" ไว้เป็นทางลัดถ้าต้องการราคาครบทุกชุดจริงๆ
// ===========================================================

// อ้างอิงค่าตัวเลือกด้วย id ที่คงที่ (ไม่ผูกกับ code/label ที่แก้ไขได้ภายหลัง) เพื่อให้แถว
// ราคาที่แอดมินเลือกไว้แล้วไม่หลุดหายเวลาเปลี่ยนชื่อ/รหัสค่าตัวเลือกภายหลัง
function axesWithOptionsList() {
  return currentAxes.filter((ax) => (ax.options || []).some((o) => (o.label || "").trim()));
}

// เมื่อเปลี่ยนชื่อหมวด/ชื่อค่า/รหัสค่า ให้อัปเดตข้อความที่โชว์ในแถวราคาที่มีอยู่แล้วตาม (ไม่ลบแถวทิ้ง)
function syncVariantLabels() {
  const axisById = {};
  currentAxes.forEach((ax) => { axisById[ax.id] = ax; });
  currentVariants.forEach((v) => {
    v.parts.forEach((p) => {
      const axis = axisById[p.axisId];
      if (!axis) return;
      p.axisLabel = axis.label;
      const opt = (axis.options || []).find((o) => o.id === p.optId);
      if (opt) { p.label = opt.label.trim(); p.code = (opt.code || "").trim().toUpperCase() || p.code; }
    });
  });
}

// เมื่อลบ "หมวด" ตัวเลือกทั้งหมวดทิ้ง — เอามิติของหมวดนั้นออกจากทุกแถวราคาที่มีอยู่ (ไม่ลบทั้งแถว)
// แล้วรวมแถวที่ซ้ำกันหลังตัดมิติออก (เหลือแถวแรกไว้พร้อมราคาที่เคยกรอก)
function stripAxisFromVariants(axisId) {
  currentVariants.forEach((v) => { v.parts = v.parts.filter((p) => p.axisId !== axisId); });
  const seen = new Set();
  currentVariants = currentVariants.filter((v) => {
    v.key = v.parts.map((p) => p.optId).join("|");
    if (!v.parts.length) return false;
    if (seen.has(v.key)) return false;
    seen.add(v.key);
    return true;
  });
}

// เมื่อลบ "ค่า" ตัวเลือกค่าใดค่าหนึ่งออกจากหมวด — แถวราคาที่ใช้ค่านั้นอยู่ไม่มีความหมายอีกต่อไป ตัดทิ้ง
function removeVariantsUsingOption(optId) {
  currentVariants = currentVariants.filter((v) => !v.parts.some((p) => p.optId === optId));
}

// เมื่อสินค้ามี "ตัวเลือกสินค้า" (axes) ตั้งไว้อย่างน้อย 1 หมวด → ช่อง "วัสดุ/ขนาด" แบบเดิม
// และช่อง "ราคา" ที่กรอกเอง กลายเป็นข้อมูลซ้ำซ้อนที่ทำให้แอดมินสับสนว่าต้องกรอกช่องไหนกันแน่
// (เคยเป็นสาเหตุที่หน้าเว็บโชว์ "วัสดุ: -" / "ขนาด: -" ทั้งที่ตั้งตัวเลือกไว้แล้ว) — ซ่อนช่องที่ไม่จำเป็น
// เหล่านี้โดยอัตโนมัติเมื่อมีตัวเลือกแล้ว โดยไม่ลบค่าที่เคยกรอกไว้ทิ้ง (เผื่อลบตัวเลือกออกภายหลัง)
function syncLegacyFieldsVisibility() {
  const hasAxes = currentAxes.some((ax) => (ax.options || []).some((o) => (o.label || "").trim()));
  const legacyRow = document.getElementById("ad-p-legacy-row");
  const priceWrap = document.getElementById("ad-p-price-wrap");
  const priceHint = document.getElementById("ad-p-price-hint");
  const priceInput = document.getElementById("ad-p-price");
  if (legacyRow) legacyRow.style.display = hasAxes ? "none" : "";
  if (priceHint) priceHint.style.display = hasAxes ? "" : "none";
  if (priceWrap) priceWrap.classList.toggle("is-auto", hasAxes);
  if (priceInput) priceInput.disabled = hasAxes;
}

function renderAxes() {
  syncLegacyFieldsVisibility();
  if (!currentAxes.length) {
    pAxesBox.innerHTML = `<div class="ad-img-empty">ยังไม่มีตัวเลือกสินค้า — กด "เพิ่มหมวดตัวเลือก" ด้านล่างถ้าสินค้านี้มีหลายแบบ/หลายราคา</div>`;
  } else {
    pAxesBox.innerHTML = currentAxes.map((axis, ai) => `
      <div class="ad-axis-card" data-axis-idx="${ai}">
        <div class="ad-axis-head">
          <input class="cl-input ad-axis-label-input" data-axis-idx="${ai}" placeholder='ชื่อหมวด เช่น "ขนาด"' value="${escapeHtml(axis.label)}">
          <button type="button" class="ad-axis-remove" data-axis-idx="${ai}" title="ลบหมวดนี้">×</button>
        </div>
        <div class="ad-axis-options" data-axis-idx="${ai}">
          ${(axis.options || []).map((opt, oi) => `
            <span class="ad-axis-option">
              <input class="ad-opt-code" data-axis-idx="${ai}" data-opt-idx="${oi}" maxlength="6" placeholder="รหัส" value="${escapeHtml(opt.code || "")}" title="รหัสย่อ (ไม่บังคับ) — ใช้ในคอลัมน์ SKU ของตารางราคา">
              <input class="ad-opt-label" data-axis-idx="${ai}" data-opt-idx="${oi}" placeholder="เช่น Commercial Grade" value="${escapeHtml(opt.label)}">
              <button type="button" class="ad-opt-remove" data-axis-idx="${ai}" data-opt-idx="${oi}" title="ลบค่านี้">×</button>
            </span>
          `).join("")}
          <button type="button" class="ad-axis-option-add" data-axis-idx="${ai}">+ เพิ่มค่า</button>
        </div>
      </div>
    `).join("");
  }
  renderVariantBuilder();
  renderVariantTable();
}

// แถบเลือกค่าจากแต่ละหมวด (ทีละ 1 ค่าต่อหมวด) แล้วกด "+ เพิ่มชุดค่าผสม" เพื่อสร้างแถวราคาแถวนั้น
// เอง — แอดมินเลือกเฉพาะชุดที่ต้องการขายจริง ไม่ต้องเอาทุกชุดผสมเหมือนเดิม
function renderVariantBuilder() {
  const axes = axesWithOptionsList();
  if (!axes.length) { pVariantBuilderBox.innerHTML = ""; return; }
  pVariantBuilderBox.innerHTML = `
    <div class="ad-vb-row">
      ${axes.map((axis, ai) => `
        <select class="cl-input ad-vb-select" data-axis-id="${axis.id}" data-axis-idx="${ai}">
          <option value="">${escapeHtml(axis.label || "ตัวเลือก")}...</option>
          ${axis.options.filter((o) => (o.label || "").trim()).map((o) => `<option value="${o.id}">${escapeHtml(o.label.trim())}</option>`).join("")}
        </select>
      `).join("")}
      <button type="button" class="ad-upload-btn ad-vb-add-btn" id="ad-p-vb-add">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
        เพิ่มชุดค่าผสม
      </button>
    </div>
    <button type="button" class="ad-vb-fillall-btn" id="ad-p-vb-fillall">สร้างครบทุกชุดที่ยังไม่มี (${cartesianCount(axes)} ชุดรวม)</button>
  `;
}

function cartesianCount(axes) {
  return axes.reduce((n, ax) => n * Math.max(1, ax.options.filter((o) => (o.label || "").trim()).length), 1);
}

// เพิ่มแถวราคา 1 แถวจากค่าที่เลือกไว้ในตัวสร้างชุดค่าผสม — ถ้าชุดนี้มีอยู่แล้วจะแจ้งเตือนแทนการเพิ่มซ้ำ
function addManualVariantRow() {
  const axes = axesWithOptionsList();
  const selects = Array.from(pVariantBuilderBox.querySelectorAll(".ad-vb-select"));
  if (selects.some((s) => !s.value)) { showToast("กรุณาเลือกค่าให้ครบทุกหมวดก่อนเพิ่มชุดค่าผสม"); return; }

  axes.forEach((ax) => ensureOptionCodes(ax));
  const parts = selects.map((s) => {
    const axis = axes.find((a) => a.id === s.dataset.axisId);
    const opt = axis.options.find((o) => o.id === s.value);
    return { axisId: axis.id, optId: opt.id, axisLabel: axis.label, code: (opt.code || "").trim().toUpperCase(), label: opt.label.trim() };
  });
  const key = parts.map((p) => p.optId).join("|");
  if (currentVariants.some((v) => v.key === key)) { showToast("ชุดค่าผสมนี้มีอยู่ในตารางราคาแล้ว"); return; }

  currentVariants.push({ key, parts, price: "" });
  renderVariantTable();
  renderVariantBuilder();
}

// ทางลัด: เติมชุดค่าผสมที่ "ยังไม่มี" ในตารางให้ครบทุกไม้ผสมที่เป็นไปได้ (ไม่แตะแถว/ราคาที่มีอยู่แล้ว)
function fillAllCombinations() {
  const axes = axesWithOptionsList();
  if (!axes.length) return;
  axes.forEach((ax) => ensureOptionCodes(ax));

  let combos = [[]];
  axes.forEach((axis) => {
    const validOptions = axis.options.filter((o) => (o.label || "").trim());
    const next = [];
    combos.forEach((combo) => {
      validOptions.forEach((opt) => next.push(combo.concat([{ axisId: axis.id, optId: opt.id, axisLabel: axis.label, code: opt.code.trim().toUpperCase(), label: opt.label.trim() }])));
    });
    combos = next;
  });

  const existingKeys = new Set(currentVariants.map((v) => v.key));
  let added = 0;
  combos.forEach((parts) => {
    const key = parts.map((p) => p.optId).join("|");
    if (!existingKeys.has(key)) { currentVariants.push({ key, parts, price: "" }); added++; }
  });
  showToast(added ? `เพิ่ม ${added} ชุดค่าผสมที่ยังไม่มีในตาราง` : "มีครบทุกชุดค่าผสมในตารางแล้ว");
  renderVariantTable();
  renderVariantBuilder();
}

function renderVariantTable() {
  const hasAxes = currentAxes.some((ax) => (ax.options || []).some((o) => (o.label || "").trim()));
  pVariantLabel.style.display = hasAxes ? "" : "none";
  if (!hasAxes) { pVariantTableBox.innerHTML = ""; return; }
  if (!currentVariants.length) {
    pVariantLabel.textContent = "ตารางราคา";
    pVariantTableBox.innerHTML = `<div class="ad-variant-empty">ยังไม่มีแถวราคา — เลือกค่าด้านบนแล้วกด "เพิ่มชุดค่าผสม" หรือกด "สร้างครบทุกชุด" เพื่อเริ่มต้น</div>`;
    return;
  }
  pVariantLabel.textContent = `ตารางราคา (${currentVariants.length} ชุดค่าผสม)`;
  const axes = axesWithOptionsList();
  pVariantTableBox.innerHTML = `
    <table class="ad-variant-table">
      <thead>
        <tr>
          <th class="ad-variant-th-num">#</th>
          <th>รหัสตัวเลือก</th>
          ${axes.map((ax) => `<th>${escapeHtml(ax.label || "ตัวเลือก")}</th>`).join("")}
          <th class="ad-variant-th-price">ราคา (บาท)</th>
          <th class="ad-variant-th-del"></th>
        </tr>
      </thead>
      <tbody>
        ${currentVariants.map((v, vi) => `
          <tr>
            <td class="ad-variant-td-num">${vi + 1}</td>
            <td><span class="ad-variant-sku">${escapeHtml(v.parts.map((p) => p.code.toUpperCase()).join("-"))}</span></td>
            ${axes.map((ax) => {
              const p = v.parts.find((pt) => pt.axisId === ax.id);
              return `<td>${p ? escapeHtml(p.label) : `<span class="ad-variant-na">—</span>`}</td>`;
            }).join("")}
            <td>
              <div class="ad-variant-price-wrap">
                ${vi > 0 ? `<button type="button" class="ad-variant-copy-btn" data-variant-idx="${vi}" title="คัดลอกราคาจากแถวบน">↓</button>` : ""}
                <span class="ad-variant-currency">฿</span>
                <input type="number" min="0" class="ad-variant-price-input" data-variant-idx="${vi}" placeholder="0" value="${v.price === "" ? "" : v.price}">
              </div>
            </td>
            <td><button type="button" class="ad-variant-del-btn" data-variant-idx="${vi}" title="ลบชุดค่าผสมนี้">×</button></td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

pAxisAddBtn.addEventListener("click", () => {
  currentAxes.push({ id: genLocalId(), label: "", options: [{ id: genLocalId(), code: "", label: "" }] });
  renderAxes();
});

pAxesBox.addEventListener("click", (e) => {
  const axisIdx = e.target.dataset.axisIdx != null ? Number(e.target.dataset.axisIdx) : null;

  if (e.target.closest(".ad-axis-remove")) {
    stripAxisFromVariants(currentAxes[axisIdx].id);
    currentAxes.splice(axisIdx, 1);
    renderAxes();
    return;
  }
  if (e.target.closest(".ad-axis-option-add")) {
    currentAxes[axisIdx].options.push({ id: genLocalId(), code: "", label: "" });
    renderAxes();
    return;
  }
  if (e.target.closest(".ad-opt-remove")) {
    const optIdx = Number(e.target.dataset.optIdx);
    const removedOpt = currentAxes[axisIdx].options[optIdx];
    if (removedOpt) removeVariantsUsingOption(removedOpt.id);
    currentAxes[axisIdx].options.splice(optIdx, 1);
    renderAxes();
    return;
  }
});

pAxesBox.addEventListener("input", (e) => {
  const axisIdx = e.target.dataset.axisIdx != null ? Number(e.target.dataset.axisIdx) : null;
  if (axisIdx == null) return;

  if (e.target.classList.contains("ad-axis-label-input")) {
    currentAxes[axisIdx].label = e.target.value;
    syncVariantLabels();
    renderVariantBuilder();
    renderVariantTable();
    return;
  }
  const optIdx = e.target.dataset.optIdx != null ? Number(e.target.dataset.optIdx) : null;
  if (optIdx == null) return;
  if (e.target.classList.contains("ad-opt-label")) {
    currentAxes[axisIdx].options[optIdx].label = e.target.value;
    syncVariantLabels();
    renderVariantBuilder();
    renderVariantTable();
    return;
  }
  if (e.target.classList.contains("ad-opt-code")) {
    currentAxes[axisIdx].options[optIdx].code = e.target.value.toUpperCase();
    syncVariantLabels();
    renderVariantTable();
  }
});

pVariantBuilderBox.addEventListener("click", (e) => {
  if (e.target.closest("#ad-p-vb-add")) addManualVariantRow();
  if (e.target.closest("#ad-p-vb-fillall")) fillAllCombinations();
});

pVariantTableBox.addEventListener("click", (e) => {
  const copyBtn = e.target.closest(".ad-variant-copy-btn");
  if (copyBtn) {
    const idx = Number(copyBtn.dataset.variantIdx);
    if (idx > 0 && currentVariants[idx - 1]) {
      currentVariants[idx].price = currentVariants[idx - 1].price;
      renderVariantTable();
    }
    return;
  }
  const delBtn = e.target.closest(".ad-variant-del-btn");
  if (delBtn) {
    const idx = Number(delBtn.dataset.variantIdx);
    currentVariants.splice(idx, 1);
    renderVariantTable();
  }
});

pVariantTableBox.addEventListener("input", (e) => {
  if (!e.target.classList.contains("ad-variant-price-input")) return;
  const idx = Number(e.target.dataset.variantIdx);
  currentVariants[idx].price = e.target.value === "" ? "" : Number(e.target.value);
});

// ราคาต่ำสุดในตารางตัวเลือก ใช้เป็น "ราคาเริ่มต้น" ของสินค้า (การ์ดหน้าเว็บ/listing แสดงค่านี้)
// คืนค่า null ถ้ายังไม่มีตัวเลือก/ยังไม่ได้กรอกราคาเลยสักแถว — ให้ใช้ช่องราคาที่กรอกเองแทน
function recomputeVariantPrice() {
  const prices = currentVariants.map((v) => Number(v.price)).filter((n) => !isNaN(n) && n > 0);
  return prices.length ? Math.min(...prices) : null;
}


pAddBtn.addEventListener("click", () => openProductModal(null));
pCancelBtn.addEventListener("click", () => productFormGuard.guardedClose());
pOverlay.addEventListener("click", (e) => { if (e.target === pOverlay) productFormGuard.guardedClose(); });

const productFormGuard = attachUnsavedGuard({
  overlay: pOverlay, form: pForm, doClose: closeProductModal,
  getExtra: () => currentImages
});

function openProductModal(product) {
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

  // ถ้าสินค้านี้เคยกรอก slug/SEO ไว้แล้ว ให้เปิดส่วน "ตั้งค่าขั้นสูง" ให้เห็นทันที
  // (ไม่งั้นแอดมินจะเข้าใจผิดว่าข้อมูลหายไปเพราะโดนพับเก็บไว้)
  const advDetails = document.getElementById("ad-p-advanced-details") || document.querySelector(".ad-advanced-details");
  if (advDetails) {
    advDetails.open = !!(product && (product.slug || product.metaTitle || product.metaDescription));
  }

  // โหลดตัวเลือกสินค้า (optionAxes) + ราคาที่เคยกรอกไว้ (variants) กลับเข้าตัวแก้ไข
  // — สินค้าเก่าที่ไม่เคยมีตัวเลือกจะได้ currentAxes = [] และช่องราคา/วัสดุ/ขนาดแบบเดิมยังใช้ได้ตามปกติ
  // ข้อมูลที่บันทึกไว้เดิมมีแค่ code/label (ไม่มี id) จึงต้องสร้าง id ให้แต่ละหมวด/ค่าใหม่ตอนโหลด
  // แล้วจับคู่แถวราคาเดิม (v.codes เรียงตามลำดับหมวดตอนบันทึก) เข้ากับ id ที่สร้างขึ้นผ่านรหัส (code)
  currentAxes = product && product.optionAxes
    ? product.optionAxes.map((ax) => ({
        id: genLocalId(),
        label: ax.label || "",
        options: (ax.options || []).map((o) => ({ id: genLocalId(), code: o.code || "", label: o.label || "" }))
      }))
    : [];
  currentVariants = [];
  if (product && product.variants) {
    product.variants.forEach((v) => {
      const codes = v.codes || [];
      const parts = codes.map((code, i) => {
        const axis = currentAxes[i];
        if (!axis) return null;
        const opt = axis.options.find((o) => (o.code || "").toUpperCase() === String(code).toUpperCase());
        if (!opt) return null;
        return { axisId: axis.id, optId: opt.id, axisLabel: axis.label, code: opt.code.toUpperCase(), label: opt.label };
      });
      if (parts.some((p) => !p) || !parts.length) return; // ข้ามแถวที่จับคู่ไม่ได้ (โครงสร้างหมวดเปลี่ยนไปจากตอนบันทึก)
      currentVariants.push({ key: parts.map((p) => p.optId).join("|"), parts, price: v.price });
    });
  }
  renderAxes();

  openOverlay(pOverlay);
  productFormGuard.capture();
}

// "ทำซ้ำ" — เปิดฟอร์ม "เพิ่มสินค้า" พร้อมข้อมูลเดิมกรอกไว้ให้ (ไม่ใช่แก้ของเดิม) เพื่อกรอกเร็วขึ้น
// เวลามีสินค้าคล้ายกันหลายรายการ (เช่น ขนาด/สีต่างกันแต่ข้อมูลอื่นเหมือนเดิม)
function openProductModalClone(product) {
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
  currentAxes = [];
  currentVariants = [];
  renderAxes();
}

pForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!validateFormInline(pForm)) return;
  const id = document.getElementById("ad-p-id").value;
  const name = document.getElementById("ad-p-name").value.trim();
  const rawSlug = document.getElementById("ad-p-slug").value.trim();

  // ตัดหมวด/ค่าที่กรอกไม่ครบ (ไม่มีชื่อหมวด หรือไม่มีค่าเลย) ออกก่อนบันทึก — รหัสของแต่ละค่า
  // (code) ไม่ต้องให้แอดมินพิมพ์เอง ระบบเติมอัตโนมัติให้ (เก็บรหัสเดิมของสินค้าเก่าไว้ ไม่เปลี่ยน)
  const cleanAxes = currentAxes
    .map((ax) => {
      ensureOptionCodes(ax);
      const validOptions = (ax.options || []).filter((o) => (o.label || "").trim());
      return {
        id: ax.id || genLocalId(),
        label: (ax.label || "").trim(),
        options: validOptions.map((o) => ({ code: o.code.trim().toUpperCase(), label: o.label.trim() }))
      };
    })
    .filter((ax) => ax.label && ax.options.length);

  const cleanVariants = cleanAxes.length
    ? currentVariants
        .filter((v) => v.parts && v.parts.length === cleanAxes.length)
        .map((v) => ({ codes: v.parts.map((p) => p.code.trim().toUpperCase()), price: Number(v.price) || 0 }))
    : [];

  // ราคาต่ำสุดในตารางตัวเลือกจะกลายเป็น "ราคาเริ่มต้น" ของสินค้าโดยอัตโนมัติ (ที่การ์ด/listing ใช้แสดง)
  // ถ้ายังไม่มีตัวเลือก หรือมีตัวเลือกแต่ยังไม่ได้กรอกราคาเลยสักแถว ให้ใช้ช่อง "ราคา" ที่กรอกเองแทน
  const autoPrice = recomputeVariantPrice();

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

// ── Popup แกลเลอรีสินค้าแนะนำ (featured) — ดูรูปทั้งหมด + รายละเอียดสินค้า ──
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

function openProductGalleryPopup(item) {
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

// ===========================================================
// LEADS
// ===========================================================
const lTableBody     = document.getElementById("ad-l-table-body");
const lSearch        = document.getElementById("ad-l-search");
const lStatusPillsBox = document.getElementById("ad-l-filter-status-pills");
const lFilterSource  = document.getElementById("ad-l-filter-source");
const lFilterAssignee = document.getElementById("ad-l-filter-assignee");
const lBadge         = document.getElementById("ad-leads-badge");
const lPaginationBox  = document.getElementById("ad-l-pagination");
const lPaginationInfo = document.getElementById("ad-l-pagination-info");
const lPaginationBtns = document.getElementById("ad-l-pagination-btns");

let allLeads = [];
let leadsUnsub = null;
let leadsStarted = false;
let lStatusFilterValue = ""; // "" = ทุกสถานะ, else key ของ LEAD_STATUS_LABEL
let selectedLeadIds = new Set(); // bulk actions: id ที่ถูกเลือก (คงอยู่ข้ามการ re-render/หน้า)
const LEADS_PAGE_SIZE = 10;
let lCurrentPage = 1;

const LEAD_STATUS_LABEL = { new: "ใหม่", read: "อ่านแล้ว", replied: "ติดต่อแล้ว", won: "ปิดการขายได้", lost: "ไม่สำเร็จ" };
const LEAD_SOURCE_LABEL = {
  quotation_modal: "ป๊อปอัพขอใบเสนอราคา",
  quotation_modal_contact: "ป๊อปอัพ (หน้าติดต่อ)",
  quotation_modal_portfolio: "ป๊อปอัพ (หน้าผลงาน)",
  inline_contact: "ฟอร์มหน้าแรก",
  contact_page_form: "ฟอร์มหน้าติดต่อ",
  catalog_download: "ดาวน์โหลดแคตตาล็อก"
};

function startLeadsListener() {
  if (leadsStarted) return;
  leadsStarted = true;
  leadsUnsub = listenLeads(
    (leads) => { allLeads = leads; fillSourceFilter(); fillAssigneeSelects(); renderLeads(); updateLeadsBadge(); renderNotifBell(); if (activeTab === "overview") renderOverview(); },
    (err) => {
      lTableBody.innerHTML = `<tr><td colspan="11">${errorStateHTML(`โหลดข้อมูลไม่สำเร็จ: ${err.message || ""}`, retryLeadsListener, { wrapTag: "span" })}</td></tr>`;
    }
  );
}

// เรียกใหม่เมื่อกดปุ่ม "ลองใหม่" ตอนโหลดลีดล้มเหลว — เลิกฟัง listener เดิม (ถ้ามี) แล้วเริ่มใหม่
// โดยไม่ต้อง refresh ทั้งหน้า
function retryLeadsListener() {
  if (leadsUnsub) { leadsUnsub(); leadsUnsub = null; }
  leadsStarted = false;
  startLeadsListener();
}

function updateLeadsBadge() {
  const newCount = allLeads.filter(l => l.status === "new").length;
  if (newCount > 0) {
    lBadge.textContent = newCount;
    lBadge.style.display = "inline-flex";
  } else {
    lBadge.style.display = "none";
  }
  // Badge จำนวนลีดใหม่ที่ปุ่มแท็บ "ภาพรวม" ในไซด์บาร์ (นอกเหนือจากแท็บ "ลีด")
  const ovBadge = document.getElementById("ad-overview-badge");
  if (ovBadge) {
    if (newCount > 0) {
      ovBadge.textContent = newCount;
      ovBadge.style.display = "inline-flex";
    } else {
      ovBadge.style.display = "none";
    }
  }
}

function fillSourceFilter() {
  const current = lFilterSource.value;
  const sources = [...new Set(allLeads.map(l => l.source).filter(Boolean))];
  lFilterSource.innerHTML = `<option value="">ทุกช่องทาง</option>` +
    sources.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(LEAD_SOURCE_LABEL[s] || s)}</option>`).join("");
  lFilterSource.value = current;
}

// เติม dropdown "กรองตามผู้รับผิดชอบ" จากรายชื่อทีมงานใน settings (renderTeamSettings เรียกฟังก์ชันนี้
// ทุกครั้งที่รายชื่อทีมงานเปลี่ยน) — รวมชื่อที่ถูกมอบหมายไว้แล้วแต่ถูกลบออกจากรายชื่อทีมงานด้วย กันตัวเลือกหาย
function fillAssigneeSelects() {
  if (!lFilterAssignee) return;
  const current = lFilterAssignee.value;
  const assignedNames = [...new Set(allLeads.map(l => l.assignee).filter(Boolean))];
  const names = [...new Set([...currentTeamMembers, ...assignedNames])];
  lFilterAssignee.innerHTML = `<option value="">ผู้รับผิดชอบทั้งหมด</option><option value="__unassigned__">— ยังไม่มอบหมาย —</option>` +
    names.map(n => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join("");
  lFilterAssignee.value = current;
}

function leadDateLabel(lead) {
  const ts = lead.createdAt;
  if (!ts) return "—";
  const ms = ts.toMillis ? ts.toMillis() : (typeof ts === "number" ? ts : null);
  if (!ms) return "—";
  return new Date(ms).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" });
}

function setLeadStatusFilter(status) {
  lStatusFilterValue = status || "";
  lStatusPillsBox.querySelectorAll(".cp-status-pill").forEach(b => {
    const isActive = (b.dataset.status || "") === lStatusFilterValue;
    b.classList.toggle("active", isActive);
    b.setAttribute("aria-selected", isActive ? "true" : "false");
  });
}
lStatusPillsBox.querySelectorAll(".cp-status-pill").forEach(btn => {
  btn.addEventListener("click", () => {
    setLeadStatusFilter(btn.dataset.status);
    lCurrentPage = 1;
    renderLeads();
  });
});

function getFilteredLeads() {
  const term = (lSearch.value || "").trim().toLowerCase();
  const sourceFilter = lFilterSource.value;
  const assigneeFilter = lFilterAssignee ? lFilterAssignee.value : "";

  return allLeads.filter(l => {
    if (pendingDeleteLeadIds.has(l.id)) return false;
    if (lStatusFilterValue && (l.status || "new") !== lStatusFilterValue) return false;
    if (sourceFilter && l.source !== sourceFilter) return false;
    if (assigneeFilter === "__unassigned__" && l.assignee) return false;
    if (assigneeFilter && assigneeFilter !== "__unassigned__" && l.assignee !== assigneeFilter) return false;
    if (term) {
      const hay = [l.name, l.email, l.tel, l.phone, l.company, l.service, l.message]
        .filter(Boolean).join(" ").toLowerCase();
      if (!hay.includes(term)) return false;
    }
    return true;
  });
}

function buildPageList(current, total) {
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

function renderLeadsPagination(totalRows) {
  const totalPages = Math.max(1, Math.ceil(totalRows / LEADS_PAGE_SIZE));
  if (lCurrentPage > totalPages) lCurrentPage = totalPages;
  if (lCurrentPage < 1) lCurrentPage = 1;

  if (!totalRows) {
    lPaginationBox.style.display = "none";
    return;
  }
  lPaginationBox.style.display = "flex";

  const start = (lCurrentPage - 1) * LEADS_PAGE_SIZE + 1;
  const end = Math.min(totalRows, lCurrentPage * LEADS_PAGE_SIZE);
  lPaginationInfo.textContent = `แสดง ${start}–${end} จาก ${totalRows} รายการ`;

  const pages = buildPageList(lCurrentPage, totalPages);
  lPaginationBtns.innerHTML = `
    <button class="cp-page-btn cp-page-nav" data-page="prev" ${lCurrentPage === 1 ? "disabled" : ""} aria-label="หน้าก่อนหน้า">‹</button>
    ${pages.map(p => p === "…"
      ? `<span class="cp-page-ellipsis">…</span>`
      : `<button class="cp-page-btn ${p === lCurrentPage ? "active" : ""}" data-page="${p}">${p}</button>`
    ).join("")}
    <button class="cp-page-btn cp-page-nav" data-page="next" ${lCurrentPage === totalPages ? "disabled" : ""} aria-label="หน้าถัดไป">›</button>
  `;
  lPaginationBtns.querySelectorAll(".cp-page-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      if (btn.disabled) return;
      if (btn.dataset.page === "prev") lCurrentPage = Math.max(1, lCurrentPage - 1);
      else if (btn.dataset.page === "next") lCurrentPage = Math.min(totalPages, lCurrentPage + 1);
      else lCurrentPage = Number(btn.dataset.page);
      renderLeads();
      lTableBody.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  });
}

function renderLeads() {
  const filtered = getFilteredLeads();

  if (!filtered.length) {
    lTableBody.innerHTML = `<tr><td colspan="11" class="cp-empty">ไม่พบรายการลีด</td></tr>`;
    renderLeadsPagination(0);
    updateLeadsBulkBar();
    return;
  }

  renderLeadsPagination(filtered.length);
  const pageStart = (lCurrentPage - 1) * LEADS_PAGE_SIZE;
  const pageRows = filtered.slice(pageStart, pageStart + LEADS_PAGE_SIZE);

  lTableBody.innerHTML = pageRows.map(l => {
    const status = l.status || "new";
    const phone = l.tel || l.phone || "—";
    const nameLine = `<div class="cp-namecell">${avatarHtml(l.name || l.email || "?")}<div class="cp-namecell-text"><span class="cp-namecell-name">${escapeHtml(l.name || "—")}</span>${l.company ? `<span class="cp-subtext">${escapeHtml(l.company)}</span>` : ""}</div></div>`;
    const contactLine = `${escapeHtml(phone)}` + (l.email ? `<br><span class="cp-subtext">${escapeHtml(l.email)}</span>` : "");
    const message = l.message ? escapeHtml(l.message).slice(0, 140) + (l.message.length > 140 ? "…" : "") : "—";
    const sourceLabel = escapeHtml(LEAD_SOURCE_LABEL[l.source] || l.source || "—");
    return `
      <tr data-id="${l.id}" class="ad-l-row ${status === "new" ? "ad-l-row-new" : ""}">
        <td><input type="checkbox" class="cp-row-check ad-l-row-check" data-id="${l.id}" ${selectedLeadIds.has(l.id) ? "checked" : ""} aria-label="เลือกลีดนี้"></td>
        <td class="cp-subtext">${leadDateLabel(l)}</td>
        <td>${nameLine}</td>
        <td>${contactLine}</td>
        <td>${escapeHtml(l.service || "—")}</td>
        <td class="ad-l-msg">${message}</td>
        <td class="cp-subtext">${sourceLabel}</td>
        <td>
          <select class="cp-status-select ad-l-status" data-id="${l.id}" data-status="${status}">
            <option value="new" ${status === "new" ? "selected" : ""}>ใหม่</option>
            <option value="read" ${status === "read" ? "selected" : ""}>อ่านแล้ว</option>
            <option value="replied" ${status === "replied" ? "selected" : ""}>ติดต่อแล้ว</option>
            <option value="won" ${status === "won" ? "selected" : ""}>ปิดการขายได้</option>
            <option value="lost" ${status === "lost" ? "selected" : ""}>ไม่สำเร็จ</option>
          </select>
        </td>
        <td>
          <select class="cp-status-select ad-l-assignee" data-id="${l.id}">
            <option value="">— ยังไม่มอบหมาย —</option>
            ${currentTeamMembers.map(name => `<option value="${escapeHtml(name)}" ${l.assignee === name ? "selected" : ""}>${escapeHtml(name)}</option>`).join("")}
            ${l.assignee && !currentTeamMembers.includes(l.assignee) ? `<option value="${escapeHtml(l.assignee)}" selected>${escapeHtml(l.assignee)} (ไม่อยู่ในรายชื่อทีมงานแล้ว)</option>` : ""}
          </select>
        </td>
        <td>
          <button type="button" class="cp-icon-text-btn ad-l-notes-btn" data-id="${l.id}" title="ดู/บันทึกโน้ต">
            📝${l.notes ? ` <span class="ad-l-notes-dot" title="มีโน้ตแล้ว"></span>` : ""}
          </button>
        </td>
        <td>
          <button class="cp-icon-btn danger ad-l-delete" data-id="${l.id}" title="ลบ">✕</button>
        </td>
      </tr>`;
  }).join("");
  updateLeadsBulkBar();
}

// ── Bulk actions (เลือกหลายแถว + ลบ/เปลี่ยนสถานะทีเดียว) ──────────────────────────────
const lBulkBar          = document.getElementById("ad-l-bulk-bar");
const lBulkCount        = document.getElementById("ad-l-bulk-count");
const lBulkClearBtn     = document.getElementById("ad-l-bulk-clear");
const lBulkStatusSelect = document.getElementById("ad-l-bulk-status-select");
const lBulkApplyBtn     = document.getElementById("ad-l-bulk-apply-status");
const lBulkDeleteBtn    = document.getElementById("ad-l-bulk-delete");
const lHeadCheck        = document.getElementById("ad-l-head-check");

function updateLeadsBulkBar() {
  if (!lBulkBar) return;
  lBulkCount.textContent = selectedLeadIds.size;
  lBulkBar.classList.toggle("active", selectedLeadIds.size > 0);
  if (lHeadCheck) {
    const rowChecks = Array.from(lTableBody.querySelectorAll(".ad-l-row-check"));
    lHeadCheck.checked = rowChecks.length > 0 && rowChecks.every(cb => cb.checked);
  }
}

lTableBody.addEventListener("change", (e) => {
  if (!e.target.classList.contains("ad-l-row-check")) return;
  const id = e.target.dataset.id;
  if (e.target.checked) selectedLeadIds.add(id); else selectedLeadIds.delete(id);
  updateLeadsBulkBar();
});

if (lHeadCheck) {
  lHeadCheck.addEventListener("change", () => {
    lTableBody.querySelectorAll(".ad-l-row-check").forEach(cb => {
      cb.checked = lHeadCheck.checked;
      if (lHeadCheck.checked) selectedLeadIds.add(cb.dataset.id); else selectedLeadIds.delete(cb.dataset.id);
    });
    updateLeadsBulkBar();
  });
}

if (lBulkClearBtn) {
  lBulkClearBtn.addEventListener("click", () => {
    selectedLeadIds.clear();
    lTableBody.querySelectorAll(".ad-l-row-check").forEach(cb => { cb.checked = false; });
    updateLeadsBulkBar();
  });
}

if (lBulkApplyBtn) {
  lBulkApplyBtn.addEventListener("click", async () => {
    const status = lBulkStatusSelect.value;
    if (!status || !selectedLeadIds.size) return;
    const ids = Array.from(selectedLeadIds);
    lBulkApplyBtn.disabled = true;
    try {
      await Promise.all(ids.map(id => updateLeadStatus(id, status)));
      showToast(`เปลี่ยนสถานะแล้ว ${ids.length} รายการ`, "success");
      selectedLeadIds.clear();
      lBulkStatusSelect.value = "";
    } catch (err) {
      showToast("อัปเดตสถานะไม่สำเร็จ: " + err.message);
    } finally {
      lBulkApplyBtn.disabled = false;
      updateLeadsBulkBar();
    }
  });
}

if (lBulkDeleteBtn) {
  lBulkDeleteBtn.addEventListener("click", async () => {
    if (!selectedLeadIds.size) return;
    const ids = Array.from(selectedLeadIds);
    if (!(await confirmDialog(`ลบลีดที่เลือก ${ids.length} รายการ? ไม่สามารถกู้คืนได้`, { title: "ลบหลายรายการ" }))) return;
    lBulkDeleteBtn.disabled = true;
    try {
      await Promise.all(ids.map(id => deleteLead(id)));
      showToast(`ลบแล้ว ${ids.length} รายการ`, "success");
      selectedLeadIds.clear();
    } catch (err) {
      showToast("ลบไม่สำเร็จ: " + err.message);
    } finally {
      lBulkDeleteBtn.disabled = false;
      updateLeadsBulkBar();
    }
  });
}

lSearch.addEventListener("input", () => { lCurrentPage = 1; renderLeads(); });
lFilterSource.addEventListener("change", () => { lCurrentPage = 1; renderLeads(); });
if (lFilterAssignee) lFilterAssignee.addEventListener("change", () => { lCurrentPage = 1; renderLeads(); });

lTableBody.addEventListener("change", async (e) => {
  if (!e.target.classList.contains("ad-l-status")) return;
  const id = e.target.dataset.id;
  const newStatus = e.target.value;
  e.target.dataset.status = newStatus;
  try {
    await updateLeadStatus(id, newStatus);
  } catch (err) {
    showToast("อัปเดตสถานะไม่สำเร็จ: " + err.message);
  }
});

lTableBody.addEventListener("change", async (e) => {
  if (!e.target.classList.contains("ad-l-assignee")) return;
  const id = e.target.dataset.id;
  const newAssignee = e.target.value;
  const select = e.target;
  select.disabled = true;
  try {
    await updateLeadAssignee(id, newAssignee);
    showToast(newAssignee ? `มอบหมายให้ "${newAssignee}" แล้ว` : "เอาผู้รับผิดชอบออกแล้ว", "success");
  } catch (err) {
    showToast("มอบหมายไม่สำเร็จ: " + err.message);
  } finally {
    select.disabled = false;
  }
});

lTableBody.addEventListener("click", async (e) => {
  const btn = e.target.closest(".ad-l-delete");
  if (!btn) return;
  const id = btn.dataset.id;
  if (!(await confirmDialog("ลบลีดรายการนี้? ไม่สามารถกู้คืนได้", { title: "ลบลีด" }))) return;
  deleteWithUndo({
    pendingSet: pendingDeleteLeadIds, id, renderFn: renderLeads,
    message: "ลบลีดแล้ว",
    deleteFn: () => deleteLead(id), targetType: "lead"
    // ไม่ต้องส่ง onCommitted — listenLeads() (realtime) จะอัปเดต allLeads และ render ใหม่เองอยู่แล้ว
  });
});

// ── โน้ตของทีมขาย ──────────────────────────────
const lNotesOverlay = document.getElementById("ad-l-notes-overlay");
const lNotesForm    = document.getElementById("ad-l-notes-form");
const lNotesName    = document.getElementById("ad-l-notes-name");
const lNotesSummary = document.getElementById("ad-l-notes-summary");
const lNotesId      = document.getElementById("ad-l-notes-id");
const lNotesText    = document.getElementById("ad-l-notes-text");

lTableBody.addEventListener("click", (e) => {
  const btn = e.target.closest(".ad-l-notes-btn");
  if (!btn) return;
  const lead = allLeads.find(l => l.id === btn.dataset.id);
  if (!lead) return;
  lNotesId.value = lead.id;
  lNotesName.textContent = lead.name || lead.company || "ไม่ระบุชื่อ";
  lNotesSummary.textContent = [lead.tel || lead.phone, lead.email, lead.service].filter(Boolean).join(" · ");
  lNotesText.value = lead.notes || "";
  openOverlay(lNotesOverlay);
  lNotesText.focus();
});

document.getElementById("ad-l-notes-cancel").addEventListener("click", () => {
  closeOverlay(lNotesOverlay);
  lNotesForm.reset();
});
lNotesOverlay.addEventListener("click", (e) => {
  if (e.target === lNotesOverlay) { closeOverlay(lNotesOverlay); lNotesForm.reset(); }
});

lNotesForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = lNotesForm.querySelector('button[type=submit]');
  btn.disabled = true; btn.textContent = "กำลังบันทึก...";
  try {
    await updateLeadNotes(lNotesId.value, lNotesText.value.trim());
    closeOverlay(lNotesOverlay);
    lNotesForm.reset();
  } catch (err) {
    showToast("บันทึกโน้ตไม่สำเร็จ: " + err.message);
  } finally {
    btn.disabled = false; btn.textContent = "บันทึกโน้ต";
  }
});

// แตะที่แถวเพื่อ mark-as-read อัตโนมัติ (ยกเว้นตอนกดที่ select/ปุ่มลบ)
lTableBody.addEventListener("click", async (e) => {
  if (e.target.closest("select") || e.target.closest("button") || e.target.closest("input")) return;
  const row = e.target.closest(".ad-l-row");
  if (!row) return;
  const lead = allLeads.find(l => l.id === row.dataset.id);
  if (lead && (lead.status || "new") === "new") {
    try { await updateLeadStatus(lead.id, "read"); } catch (err) { console.error(err); }
  }
});

// ===========================================================
// GROUPS (หมวดหมู่ใหญ่) — ชั้นบนสุด: หมวดหมู่ใหญ่ > หมวดหมู่ย่อย > รายการสินค้า
// ===========================================================
const gTableBody   = document.getElementById("ad-g-table-body");
const gAddBtn      = document.getElementById("ad-g-add-btn");
const gOverlay     = document.getElementById("ad-g-overlay");
const gForm        = document.getElementById("ad-g-form");
const gModalTitle  = document.getElementById("ad-g-modal-title");
const gCancelBtn   = document.getElementById("ad-g-cancel");

// ตั้งค่าไว้ตอนเปิดโมดัลหมวดหมู่ใหญ่จากปุ่ม "+ เพิ่มหมวดหมู่ใหญ่ใหม่" ในโมดัลหมวดหมู่ย่อย
// เพื่อจำค่าที่กรอกในโมดัลหมวดหมู่ย่อยไว้ แล้วเปิดกลับพร้อมเลือกหมวดหมู่ใหญ่ที่เพิ่งสร้างให้อัตโนมัติ
let gReturnToCategoryDraft = null;

function groupName(id) {
  const g = allGroups.find(g => g.id === id);
  return g ? g.name : "";
}

function renderGroups() {
  if (!allGroups.length) {
    gTableBody.innerHTML = `<tr><td colspan="4" class="cp-empty">ยังไม่มีหมวดหมู่ใหญ่ — เพิ่มอย่างน้อย 1 รายการก่อนสร้างหมวดหมู่ย่อย</td></tr>`;
    return;
  }
  const rows = allGroups.filter(g => !pendingDeleteGroupIds.has(g.id));
  gTableBody.innerHTML = rows.map(g => {
    const subCount = allCategories.filter(c => c.group_id === g.id && !pendingDeleteCategoryIds.has(c.id)).length;
    return `
    <tr data-id="${g.id}">
      <td style="font-size:18px;">${escapeHtml(g.icon || "🗂️")}</td>
      <td>${escapeHtml(g.name || "")}</td>
      <td><span class="ad-g-badge">${subCount} หมวดหมู่ย่อย</span></td>
      <td>
        <div class="cp-row-actions">
          <button class="cp-icon-btn" data-action="edit" title="แก้ไข"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button>
          <button class="cp-icon-btn danger" data-action="delete" title="ลบ"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg></button>
        </div>
      </td>
    </tr>`;
  }).join("");
}

function fillGroupSelect() {
  const sel = document.getElementById("ad-c-group");
  if (!sel) return;
  const prev = sel.value;
  const opts = allGroups.map(g => `<option value="${g.id}">${escapeHtml(g.name)}</option>`).join("");
  sel.innerHTML = opts || `<option value="">— ยังไม่มีหมวดหมู่ใหญ่ —</option>`;
  if (prev && allGroups.some(g => g.id === prev)) sel.value = prev;
}

gTableBody.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  const tr = btn.closest("tr");
  const id = tr.dataset.id;
  const group = allGroups.find(g => g.id === id);
  if (!group) return;

  if (btn.dataset.action === "edit") openGroupModal(group);
  if (btn.dataset.action === "delete") {
    const inUse = allCategories.some(c => c.group_id === id);
    if (inUse && !(await confirmDialog(`หมวดหมู่ใหญ่ "${group.name}" มีหมวดหมู่ย่อยอยู่ภายใน ลบแล้วหมวดหมู่ย่อยเหล่านั้นจะไม่มีหมวดหมู่ใหญ่ — ดำเนินการต่อหรือไม่?`, { title: "ลบหมวดหมู่ใหญ่" }))) return;
    if (!inUse && !(await confirmDialog(`ลบหมวดหมู่ใหญ่ "${group.name}" ใช่หรือไม่?`, { title: "ลบหมวดหมู่ใหญ่" }))) return;
    deleteWithUndo({
      pendingSet: pendingDeleteGroupIds, id, renderFn: renderGroups,
      message: `ลบหมวดหมู่ใหญ่ "${group.name || ""}" แล้ว`,
      deleteFn: () => deleteGroup(id), onCommitted: reloadAll, targetType: "group"
    });
  }
});

gAddBtn.addEventListener("click", () => openGroupModal(null));
gCancelBtn.addEventListener("click", closeGroupModal);
gOverlay.addEventListener("click", (e) => { if (e.target === gOverlay) closeGroupModal(); });

function openGroupModal(group) {
  gModalTitle.textContent = group ? "แก้ไขหมวดหมู่ใหญ่" : "เพิ่มหมวดหมู่ใหญ่";
  document.getElementById("ad-g-id").value   = group ? group.id : "";
  document.getElementById("ad-g-name").value = group ? group.name || "" : "";
  document.getElementById("ad-g-icon").value = group ? group.icon || "" : "";
  openOverlay(gOverlay);
}

function closeGroupModal() {
  closeOverlay(gOverlay);
  gForm.reset();
  // ถ้าถูกเปิดจากปุ่มลัดในโมดัลหมวดหมู่ย่อย แล้วผู้ใช้กด "ยกเลิก" แทนที่จะบันทึก
  // ให้เปิดโมดัลหมวดหมู่ย่อยเดิมกลับมาพร้อมค่าที่เคยกรอกไว้ ไม่ให้ข้อมูลหาย
  if (gReturnToCategoryDraft) {
    reopenCategoryDraft();
  }
}

gForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = document.getElementById("ad-g-id").value;
  const payload = { name: document.getElementById("ad-g-name").value.trim(),
                     icon: document.getElementById("ad-g-icon").value.trim() };
  if (id) payload.id = id;
  const btn = gForm.querySelector('button[type=submit]');
  btn.disabled = true; btn.textContent = "กำลังบันทึก...";
  try {
    await saveGroup(payload);
    const draft = gReturnToCategoryDraft;
    gReturnToCategoryDraft = null; // ปิดก่อน reload กัน closeGroupModal เปิดโมดัลเดิมซ้ำ
    closeOverlay(gOverlay);
    gForm.reset();
    const [groups] = await Promise.all([getGroups(), reloadAll()]);
    if (draft) {
      // หมวดหมู่ใหม่ล่าสุดคือรายการที่ยังไม่มีในลิสต์เดิมของ draft
      const created = groups.find(g => !draft.priorGroupIds.has(g.id));
      reopenCategoryDraft(draft, created ? created.id : "");
    }
  } catch (err) {
    showToast("บันทึกไม่สำเร็จ: " + err.message);
  } finally {
    btn.disabled = false; btn.textContent = "บันทึก";
  }
});

function reopenCategoryDraft(draft, selectGroupId) {
  const d = draft || gReturnToCategoryDraft;
  gReturnToCategoryDraft = null;
  if (!d) return;
  document.getElementById("ad-c-id").value    = d.id;
  document.getElementById("ad-c-name").value  = d.name;
  document.getElementById("ad-c-icon").value  = d.icon;
  document.getElementById("ad-c-desc").value  = d.description;
  cModalTitle.textContent = d.id ? "แก้ไขหมวดหมู่ย่อย" : "เพิ่มหมวดหมู่ย่อย";
  openOverlay(cOverlay);
  fillGroupSelect();
  const sel = document.getElementById("ad-c-group");
  if (selectGroupId) sel.value = selectGroupId;
  else if (d.groupId) sel.value = d.groupId;
}

// ===========================================================
// CATEGORIES (หมวดหมู่ย่อย)
// ===========================================================
const cTableBody = document.getElementById("ad-c-table-body");
const cAddBtn     = document.getElementById("ad-c-add-btn");
const cOverlay   = document.getElementById("ad-c-overlay");
const cForm       = document.getElementById("ad-c-form");
const cModalTitle = document.getElementById("ad-c-modal-title");
const cCancelBtn  = document.getElementById("ad-c-cancel");
const cGroupNewBtn = document.getElementById("ad-c-group-new-btn");
const cSearch     = document.getElementById("ad-c-search");
const cPaginationBox  = document.getElementById("ad-c-pagination");
const cPaginationInfo = document.getElementById("ad-c-pagination-info");
const cPaginationBtns = document.getElementById("ad-c-pagination-btns");

const CATEGORIES_PAGE_SIZE = 10;
let cCurrentPage = 1;

function getFilteredCategories() {
  let rows = allCategories.filter(c => !pendingDeleteCategoryIds.has(c.id));
  const term = cSearch.value.trim().toLowerCase();
  if (term) rows = rows.filter(c =>
    (c.name || "").toLowerCase().includes(term) || groupName(c.group_id).toLowerCase().includes(term));
  return rows;
}

function renderCategoriesPagination(totalRows) {
  const totalPages = Math.max(1, Math.ceil(totalRows / CATEGORIES_PAGE_SIZE));
  if (cCurrentPage > totalPages) cCurrentPage = totalPages;
  if (cCurrentPage < 1) cCurrentPage = 1;

  if (!totalRows) {
    cPaginationBox.style.display = "none";
    return;
  }
  cPaginationBox.style.display = "flex";

  const start = (cCurrentPage - 1) * CATEGORIES_PAGE_SIZE + 1;
  const end = Math.min(totalRows, cCurrentPage * CATEGORIES_PAGE_SIZE);
  cPaginationInfo.textContent = `แสดง ${start}–${end} จาก ${totalRows} รายการ`;

  const pages = buildPageList(cCurrentPage, totalPages);
  cPaginationBtns.innerHTML = `
    <button class="cp-page-btn cp-page-nav" data-page="prev" ${cCurrentPage === 1 ? "disabled" : ""} aria-label="หน้าก่อนหน้า">‹</button>
    ${pages.map(p => p === "…"
      ? `<span class="cp-page-ellipsis">…</span>`
      : `<button class="cp-page-btn ${p === cCurrentPage ? "active" : ""}" data-page="${p}">${p}</button>`
    ).join("")}
    <button class="cp-page-btn cp-page-nav" data-page="next" ${cCurrentPage === totalPages ? "disabled" : ""} aria-label="หน้าถัดไป">›</button>
  `;
  cPaginationBtns.querySelectorAll(".cp-page-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      if (btn.disabled) return;
      if (btn.dataset.page === "prev") cCurrentPage = Math.max(1, cCurrentPage - 1);
      else if (btn.dataset.page === "next") cCurrentPage = Math.min(totalPages, cCurrentPage + 1);
      else cCurrentPage = Number(btn.dataset.page);
      renderCategories();
      cTableBody.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  });
}

function renderCategories() {
  const filteredRows = getFilteredCategories();

  if (!allCategories.length) {
    cTableBody.innerHTML = `<tr><td colspan="5" class="cp-empty">ยังไม่มีหมวดหมู่</td></tr>`;
    renderCategoriesPagination(0);
    return;
  }
  if (!filteredRows.length) {
    cTableBody.innerHTML = `<tr><td colspan="5" class="cp-empty">ไม่พบหมวดหมู่</td></tr>`;
    renderCategoriesPagination(0);
    return;
  }

  renderCategoriesPagination(filteredRows.length);
  const pageStart = (cCurrentPage - 1) * CATEGORIES_PAGE_SIZE;
  const rows = filteredRows.slice(pageStart, pageStart + CATEGORIES_PAGE_SIZE);

  cTableBody.innerHTML = rows.map(c => `
    <tr data-id="${c.id}">
      <td style="font-size:18px;">${escapeHtml(c.icon || "🏷️")}</td>
      <td>${escapeHtml(c.name || "")}</td>
      <td>${escapeHtml(groupName(c.group_id) || "— ไม่มีหมวดหมู่ใหญ่ —")}</td>
      <td>${escapeHtml(c.description || "—")}</td>
      <td>
        <div class="cp-row-actions">
          <button class="cp-icon-btn" data-action="edit" title="แก้ไข"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button>
          <button class="cp-icon-btn danger" data-action="delete" title="ลบ"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg></button>
        </div>
      </td>
    </tr>`).join("");
}

cSearch.addEventListener("input", () => { cCurrentPage = 1; renderCategories(); });

cTableBody.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  const tr = btn.closest("tr");
  const id = tr.dataset.id;
  const cat = allCategories.find(c => c.id === id);
  if (!cat) return;

  if (btn.dataset.action === "edit") openCategoryModal(cat);
  if (btn.dataset.action === "delete") {
    const inUse = allProducts.some(p => p.cat_id === id);
    if (inUse && !(await confirmDialog(`หมวดหมู่ "${cat.name}" มีสินค้าอยู่ในหมวดนี้ ลบหมวดหมู่จะทำให้สินค้าเหล่านั้นไม่มีหมวดหมู่ — ดำเนินการต่อหรือไม่?`, { title: "ลบหมวดหมู่" }))) return;
    if (!inUse && !(await confirmDialog(`ลบหมวดหมู่ "${cat.name}" ใช่หรือไม่?`, { title: "ลบหมวดหมู่" }))) return;
    deleteWithUndo({
      pendingSet: pendingDeleteCategoryIds, id, renderFn: renderCategories,
      message: `ลบหมวดหมู่ "${cat.name || ""}" แล้ว`,
      deleteFn: () => deleteCategory(id), onCommitted: reloadAll, targetType: "category"
    });
  }
});

cAddBtn.addEventListener("click", () => {
  if (!allGroups.length) {
    showToast("กรุณาเพิ่มหมวดหมู่ใหญ่อย่างน้อย 1 รายการก่อน");
    return;
  }
  openCategoryModal(null);
});
cCancelBtn.addEventListener("click", closeCategoryModal);
cOverlay.addEventListener("click", (e) => { if (e.target === cOverlay) closeCategoryModal(); });

// "+ เพิ่มหมวดหมู่ใหญ่ใหม่" ในโมดัลหมวดหมู่ย่อย — เก็บค่าที่กรอกไว้ในฟอร์มปัจจุบัน แล้วสลับ
// ไปเปิดโมดัลหมวดหมู่ใหญ่แทนชั่วคราว บันทึกเสร็จจะพากลับมาโมดัลนี้พร้อมเลือกหมวดหมู่ใหญ่ที่เพิ่งสร้างให้เอง
cGroupNewBtn.addEventListener("click", () => {
  gReturnToCategoryDraft = {
    id: document.getElementById("ad-c-id").value,
    name: document.getElementById("ad-c-name").value,
    icon: document.getElementById("ad-c-icon").value,
    description: document.getElementById("ad-c-desc").value,
    groupId: document.getElementById("ad-c-group").value,
    priorGroupIds: new Set(allGroups.map(g => g.id))
  };
  closeOverlay(cOverlay);
  openGroupModal(null);
});

function openCategoryModal(cat) {
  cModalTitle.textContent = cat ? "แก้ไขหมวดหมู่ย่อย" : "เพิ่มหมวดหมู่ย่อย";
  fillGroupSelect();
  document.getElementById("ad-c-id").value    = cat ? cat.id : "";
  document.getElementById("ad-c-name").value  = cat ? cat.name || "" : "";
  document.getElementById("ad-c-group").value = cat ? cat.group_id || "" : "";
  document.getElementById("ad-c-icon").value  = cat ? cat.icon || "" : "";
  document.getElementById("ad-c-desc").value  = cat ? cat.description || "" : "";
  openOverlay(cOverlay);
}

function closeCategoryModal() {
  closeOverlay(cOverlay);
  cForm.reset();
}

cForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = document.getElementById("ad-c-id").value;
  const groupId = document.getElementById("ad-c-group").value;
  const payload = {
    name: document.getElementById("ad-c-name").value.trim(),
    group_id: groupId,
    group: groupName(groupId), // เก็บชื่อซ้ำไว้ให้เมกะเมนู (nav-menu.js) ใช้ต่อได้เลย
    icon: document.getElementById("ad-c-icon").value.trim(),
    description: document.getElementById("ad-c-desc").value.trim()
  };
  if (id) payload.id = id;
  const btn = cForm.querySelector('button[type=submit]');
  btn.disabled = true; btn.textContent = "กำลังบันทึก...";
  try {
    await saveCategory(payload);
    closeCategoryModal();
    await reloadAll();
  } catch (err) {
    showToast("บันทึกไม่สำเร็จ: " + err.message);
  } finally {
    btn.disabled = false; btn.textContent = "บันทึก";
  }
});

// ===========================================================
// PORTFOLIO (ผลงาน)
// ===========================================================
const pfGrid       = document.getElementById("ad-pf-grid");
const pfSearch      = document.getElementById("ad-pf-search");
const pfFilterCat   = document.getElementById("ad-pf-filter-cat");
const pfAddBtn      = document.getElementById("ad-pf-add-btn");
const pfPaginationBox  = document.getElementById("ad-pf-pagination");
const pfPaginationInfo = document.getElementById("ad-pf-pagination-info");
const pfPaginationBtns = document.getElementById("ad-pf-pagination-btns");

const PORTFOLIO_PAGE_SIZE = 12;
let pfCurrentPage = 1;
let selectedPortfolioIds = new Set(); // bulk actions: id ที่ถูกเลือก (คงอยู่ข้ามการ re-render/หน้า)

// ── Bulk actions bar (เลือกหลายการ์ด + ลบทีเดียว) ──
const pfBulkBar       = document.getElementById("ad-pf-bulk-bar");
const pfBulkCount     = document.getElementById("ad-pf-bulk-count");
const pfBulkClearBtn  = document.getElementById("ad-pf-bulk-clear");
const pfBulkDeleteBtn = document.getElementById("ad-pf-bulk-delete");

const pfOverlay   = document.getElementById("ad-pf-overlay");
const pfForm       = document.getElementById("ad-pf-form");
const pfModalTitle = document.getElementById("ad-pf-modal-title");
const pfCancelBtn  = document.getElementById("ad-pf-cancel");
const pfImagesBox  = document.getElementById("ad-pf-images");
const pfUploadInput = document.getElementById("ad-pf-upload");
const pfUploadStatus = document.getElementById("ad-pf-upload-status");

const PF_CAT_LABEL = {
  factory: "โรงงานอุตสาหกรรม",
  government: "ภาครัฐ",
  industrial: "นิคมอุตสาหกรรม",
  custom: "Custom Order"
};
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
  try { await deleteImage(url); } catch (err) { /* non-blocking */ }
});

pfUploadInput.addEventListener("change", async () => {
  const files = Array.from(pfUploadInput.files || []);
  if (!files.length) return;
  await handleImageUpload(files, currentPfImages, renderPfImages, pfUploadStatus);
  pfUploadInput.value = "";
});

function renderPortfolioPagination(totalRows) {
  const totalPages = Math.max(1, Math.ceil(totalRows / PORTFOLIO_PAGE_SIZE));
  if (pfCurrentPage > totalPages) pfCurrentPage = totalPages;
  if (pfCurrentPage < 1) pfCurrentPage = 1;

  if (!totalRows) {
    pfPaginationBox.style.display = "none";
    return;
  }
  pfPaginationBox.style.display = "flex";

  const start = (pfCurrentPage - 1) * PORTFOLIO_PAGE_SIZE + 1;
  const end = Math.min(totalRows, pfCurrentPage * PORTFOLIO_PAGE_SIZE);
  pfPaginationInfo.textContent = `แสดง ${start}–${end} จาก ${totalRows} รายการ`;

  const pages = buildPageList(pfCurrentPage, totalPages);
  pfPaginationBtns.innerHTML = `
    <button class="cp-page-btn cp-page-nav" data-page="prev" ${pfCurrentPage === 1 ? "disabled" : ""} aria-label="หน้าก่อนหน้า">‹</button>
    ${pages.map(p => p === "…"
      ? `<span class="cp-page-ellipsis">…</span>`
      : `<button class="cp-page-btn ${p === pfCurrentPage ? "active" : ""}" data-page="${p}">${p}</button>`
    ).join("")}
    <button class="cp-page-btn cp-page-nav" data-page="next" ${pfCurrentPage === totalPages ? "disabled" : ""} aria-label="หน้าถัดไป">›</button>
  `;
  pfPaginationBtns.querySelectorAll(".cp-page-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      if (btn.disabled) return;
      if (btn.dataset.page === "prev") pfCurrentPage = Math.max(1, pfCurrentPage - 1);
      else if (btn.dataset.page === "next") pfCurrentPage = Math.min(totalPages, pfCurrentPage + 1);
      else pfCurrentPage = Number(btn.dataset.page);
      renderPortfolios();
      pfGrid.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  });
}

function renderPortfolios() {
  let rows = allPortfolios.filter(p => !pendingDeletePortfolioIds.has(p.id));
  const term = pfSearch.value.trim().toLowerCase();
  if (term) rows = rows.filter(p =>
    (p.title || "").toLowerCase().includes(term) || (p.client || "").toLowerCase().includes(term));
  if (pfFilterCat.value) rows = rows.filter(p => p.category === pfFilterCat.value);

  if (!rows.length) {
    const hasFilters = pfSearch.value.trim() || pfFilterCat.value;
    pfGrid.innerHTML = hasFilters
      ? emptyStateHTML({ title: "ไม่พบผลงานที่ตรงกับตัวกรอง", desc: "ลองเปลี่ยนคำค้นหรือประเภทโครงการดูอีกครั้ง" })
      : emptyStateHTML({
          icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/></svg>`,
          title: "ยังไม่มีผลงานในระบบ",
          desc: "เพิ่มผลงานแรกเพื่อแสดงในหน้าผลงานของเว็บไซต์",
          ctaLabel: "+ เพิ่มรายการแรก", ctaId: "ad-pf-empty-add"
        });
    const emptyAddBtn = document.getElementById("ad-pf-empty-add");
    if (emptyAddBtn) emptyAddBtn.addEventListener("click", () => openPortfolioModal(null));
    renderPortfolioPagination(0);
    updatePortfoliosBulkBar();
    return;
  }

  renderPortfolioPagination(rows.length);
  const pfPageStart = (pfCurrentPage - 1) * PORTFOLIO_PAGE_SIZE;
  rows = rows.slice(pfPageStart, pfPageStart + PORTFOLIO_PAGE_SIZE);

  pfGrid.innerHTML = rows.map(p => {
    const imgs = (p.images || []).filter(Boolean);
    const img = imgs[0] || "";
    const visual = img
      ? `<img src="${img}" alt="${escapeHtml(p.title || "")}" class="port-photo" loading="lazy">`
      : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" width="34" height="34"><path d="M3 21h18M5 21V7l8-4 8 4v14M9 21v-6h6v6"/></svg>`;
    const tags = (p.tags || []).slice(0, 3).map(t => `<span>${escapeHtml(t)}</span>`).join("");
    return `
    <div class="port-card ad-pf-card" data-id="${p.id}">
      <input type="checkbox" class="ad-pf-card-check" data-id="${p.id}" ${selectedPortfolioIds.has(p.id) ? "checked" : ""} aria-label="เลือกผลงานนี้">
      <div class="ad-pf-card-actions">
        ${p.pinned ? `
        <button class="cp-icon-btn" data-action="move-up" title="เลื่อนขึ้น (แสดงก่อนในหน้าแรก)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 19V5M5 12l7-7 7 7"/></svg></button>
        <button class="cp-icon-btn" data-action="move-down" title="เลื่อนลง"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12l7 7 7-7"/></svg></button>` : ""}
        <button class="cp-icon-btn" data-action="edit" title="แก้ไข"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button>
        <button class="cp-icon-btn" data-action="clone" title="ทำซ้ำ (เปิดฟอร์มเพิ่มใหม่พร้อมข้อมูลเดิม)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
        <button class="cp-icon-btn danger" data-action="delete" title="ลบ"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg></button>
      </div>
      <div class="port-visual${img ? "" : " no-photo"}">
        ${visual}
        <div class="port-badge">${escapeHtml(PF_CAT_LABEL[p.category] || p.category || "ไม่ระบุประเภท")}</div>
        ${p.pinned ? `<div class="port-pin-flag" title="ปักหมุดแสดงหน้าแรก"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l1.6 4.9H19l-4 3 1.5 5L12 12l-4.5 3 1.5-5-4-3h5.4z"/></svg></div>` : ""}
        ${imgs.length > 1 ? `<span class="ad-pf-card-imgcount">+${imgs.length - 1} รูป</span>` : ""}
      </div>
      <div class="port-info">
        ${p.client ? `<div class="port-client">${escapeHtml(p.client)}</div>` : ""}
        <h3>${escapeHtml(p.title || "ไม่มีชื่อ")}</h3>
        ${p.description ? `<p>${escapeHtml(p.description)}</p>` : ""}
        ${tags ? `<div class="port-tags">${tags}</div>` : ""}
      </div>
    </div>`;
  }).join("");
  updatePortfoliosBulkBar();
}

pfSearch.addEventListener("input", () => { pfCurrentPage = 1; renderPortfolios(); });
pfFilterCat.addEventListener("change", () => { pfCurrentPage = 1; renderPortfolios(); });

pfGrid.addEventListener("click", async (e) => {
  const card = e.target.closest(".ad-pf-card");
  if (!card) return;
  const id = card.dataset.id;
  const item = allPortfolios.find(p => p.id === id);
  if (!item) return;

  const btn = e.target.closest("button[data-action]");
  if (btn) {
    if (btn.dataset.action === "edit") openPortfolioModal(item);
    if (btn.dataset.action === "clone") openPortfolioModalClone(item);
    if (btn.dataset.action === "delete") {
      if (await confirmDialog(`ลบผลงาน "${item.title || ""}" ใช่หรือไม่? การลบนี้ไม่สามารถย้อนกลับได้`, { title: "ลบผลงาน" })) {
        deleteWithUndo({
          pendingSet: pendingDeletePortfolioIds, id, renderFn: renderPortfolios,
          message: `ลบผลงาน "${item.title || ""}" แล้ว`,
          deleteFn: () => deletePortfolio(id), onCommitted: reloadAll, targetType: "portfolio"
        });
      }
    }
    if (btn.dataset.action === "move-up" || btn.dataset.action === "move-down") {
      await movePinnedItem(item, btn.dataset.action === "move-up" ? -1 : 1);
    }
    return;
  }
  if (e.target.closest(".ad-pf-card-check")) return;
  // คลิกที่ตัวการ์ด (ไม่ใช่ปุ่ม) → เปิด popup รายละเอียด
  openPortfolioViewPopup(item);
});

// ── Bulk actions (เลือกหลายการ์ด + ลบทีเดียว) ──────────────────────────────
function updatePortfoliosBulkBar() {
  if (!pfBulkBar) return;
  pfBulkCount.textContent = selectedPortfolioIds.size;
  pfBulkBar.classList.toggle("active", selectedPortfolioIds.size > 0);
}

pfGrid.addEventListener("change", (e) => {
  if (!e.target.classList.contains("ad-pf-card-check")) return;
  const id = e.target.dataset.id;
  if (e.target.checked) selectedPortfolioIds.add(id); else selectedPortfolioIds.delete(id);
  updatePortfoliosBulkBar();
});

if (pfBulkClearBtn) {
  pfBulkClearBtn.addEventListener("click", () => {
    selectedPortfolioIds.clear();
    pfGrid.querySelectorAll(".ad-pf-card-check").forEach(cb => { cb.checked = false; });
    updatePortfoliosBulkBar();
  });
}

if (pfBulkDeleteBtn) {
  pfBulkDeleteBtn.addEventListener("click", async () => {
    if (!selectedPortfolioIds.size) return;
    const ids = Array.from(selectedPortfolioIds);
    if (!(await confirmDialog(`ลบผลงานที่เลือก ${ids.length} รายการ? ไม่สามารถกู้คืนได้`, { title: "ลบหลายรายการ" }))) return;
    pfBulkDeleteBtn.disabled = true;
    try {
      await Promise.all(ids.map(id => deletePortfolio(id)));
      showToast(`ลบแล้ว ${ids.length} รายการ`, "success");
      selectedPortfolioIds.clear();
      await reloadAll();
    } catch (err) {
      showToast("ลบไม่สำเร็จ: " + err.message);
    } finally {
      pfBulkDeleteBtn.disabled = false;
      updatePortfoliosBulkBar();
    }
  });
}

// ── สลับลำดับการแสดงผลงานที่ปักหมุดในหน้าแรก ──
async function movePinnedItem(item, dir) {
  const pinned = allPortfolios
    .filter(p => p.pinned)
    .sort((a, b) => (a.order || 0) - (b.order || 0) || (a.createdAt || 0) - (b.createdAt || 0));
  const idx = pinned.findIndex(p => p.id === item.id);
  const swapIdx = idx + dir;
  if (idx === -1 || swapIdx < 0 || swapIdx >= pinned.length) return;

  // ใช้ index ปัจจุบันเป็นค่า order ใหม่ของทั้งคู่ที่สลับกัน เพื่อให้ลำดับเรียงต่อเนื่องเสมอ
  const a = pinned[idx], b = pinned[swapIdx];
  try {
    await Promise.all([
      savePortfolio({ ...a, id: a.id, order: swapIdx }),
      savePortfolio({ ...b, id: b.id, order: idx })
    ]);
    await reloadAll();
  } catch (err) {
    showToast("จัดลำดับไม่สำเร็จ: " + err.message);
  }
}

// ── Popup ดูรายละเอียดผลงาน (รูปทั้งหมด + ข้อมูลเต็ม) ──
const pfViewOverlay = document.getElementById("ad-pf-view-overlay");
const pfViewClose    = document.getElementById("ad-pf-view-close");
const pfViewImg      = document.getElementById("ad-pf-view-img");
const pfViewBadge    = document.getElementById("ad-pf-view-badge");
const pfViewPin      = document.getElementById("ad-pf-view-pin");
const pfViewThumbs   = document.getElementById("ad-pf-view-thumbs");
const pfViewClient   = document.getElementById("ad-pf-view-client");
const pfViewTitle    = document.getElementById("ad-pf-view-title");
const pfViewDesc     = document.getElementById("ad-pf-view-desc");
const pfViewTags     = document.getElementById("ad-pf-view-tags");
const pfViewEditBtn  = document.getElementById("ad-pf-view-edit");
let pfViewItem = null;
let pfViewImages = [];

function openPortfolioViewPopup(item) {
  pfViewItem = item;
  pfViewImages = (item.images || []).filter(Boolean);
  pfViewBadge.textContent = PF_CAT_LABEL[item.category] || item.category || "ผลงาน";
  pfViewPin.style.display = item.pinned ? "flex" : "none";
  pfViewClient.textContent = item.client || "";
  pfViewClient.style.display = item.client ? "" : "none";
  pfViewTitle.textContent = item.title || "ไม่มีชื่อ";
  pfViewDesc.textContent = item.description || "";
  pfViewDesc.style.display = item.description ? "" : "none";
  pfViewTags.innerHTML = (item.tags || []).map(t => `<span>${escapeHtml(t)}</span>`).join("");
  pfViewTags.style.display = (item.tags || []).length ? "" : "none";
  pfViewThumbs.innerHTML = pfViewImages.length > 1
    ? pfViewImages.map((src, i) => `<button type="button" class="ad-pf-view-thumb${i === 0 ? " active" : ""}" data-idx="${i}"><img src="${src}" alt="${escapeHtml(item.title || "ผลงาน")} รูปที่ ${i + 1}" loading="lazy"></button>`).join("")
    : "";
  setPfViewImage(0);
  openOverlay(pfViewOverlay);
}
function setPfViewImage(idx) {
  if (!pfViewImages.length) { pfViewImg.src = ""; return; }
  pfViewImg.src = pfViewImages[idx];
  pfViewThumbs.querySelectorAll(".ad-pf-view-thumb").forEach((t, i) => t.classList.toggle("active", i === idx));
}
function closePortfolioViewPopup() { closeOverlay(pfViewOverlay); }

pfViewClose.addEventListener("click", closePortfolioViewPopup);
pfViewOverlay.addEventListener("click", (e) => { if (e.target === pfViewOverlay) closePortfolioViewPopup(); });
pfViewThumbs.addEventListener("click", (e) => {
  const t = e.target.closest(".ad-pf-view-thumb");
  if (t) setPfViewImage(Number(t.dataset.idx));
});
pfViewEditBtn.addEventListener("click", () => {
  closePortfolioViewPopup();
  if (pfViewItem) openPortfolioModal(pfViewItem);
});

pfAddBtn.addEventListener("click", () => openPortfolioModal(null));
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

function openPortfolioModal(item) {
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
function openPortfolioModalClone(item) {
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

// ===========================================================
// BLOG POSTS
// ===========================================================
const bGrid          = document.getElementById("ad-b-grid");
const bSearch         = document.getElementById("ad-b-search");
const bFilterStatus   = document.getElementById("ad-b-filter-status");
const bAddBtn         = document.getElementById("ad-b-add-btn");
const bPaginationBox  = document.getElementById("ad-b-pagination");
const bPaginationInfo = document.getElementById("ad-b-pagination-info");
const bPaginationBtns = document.getElementById("ad-b-pagination-btns");

const BLOG_PAGE_SIZE = 12;
let bCurrentPage = 1;
let selectedBlogIds = new Set(); // bulk actions: id ที่ถูกเลือก (คงอยู่ข้ามการ re-render/หน้า)

// ── Bulk actions bar (เลือกหลายการ์ด + ลบ/เปลี่ยนสถานะทีเดียว) ──
const bBulkBar          = document.getElementById("ad-b-bulk-bar");
const bBulkCount        = document.getElementById("ad-b-bulk-count");
const bBulkClearBtn     = document.getElementById("ad-b-bulk-clear");
const bBulkStatusSelect = document.getElementById("ad-b-bulk-status-select");
const bBulkApplyBtn     = document.getElementById("ad-b-bulk-apply-status");
const bBulkDeleteBtn    = document.getElementById("ad-b-bulk-delete");

const bOverlay    = document.getElementById("ad-b-overlay");
const bForm        = document.getElementById("ad-b-form");
const bModalTitle  = document.getElementById("ad-b-modal-title");
const bCancelBtn   = document.getElementById("ad-b-cancel");
const bImageBox    = document.getElementById("ad-b-image");
const bUploadInput = document.getElementById("ad-b-upload");
const bUploadStatus = document.getElementById("ad-b-upload-status");
wireCharCounter("ad-b-meta-title", "ad-b-meta-title-count", 70);
wireCharCounter("ad-b-meta-desc", "ad-b-meta-desc-count", 160);

let currentBlogImage = ""; // single cover image url of the post being edited

function slugify(str) {
  return String(str || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9ก-๙\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function getFilteredBlogs() {
  let rows = allBlogs.filter(b => !pendingDeleteBlogIds.has(b.id));
  const term = bSearch.value.trim().toLowerCase();
  if (term) rows = rows.filter(b => (b.title || "").toLowerCase().includes(term));
  if (bFilterStatus.value) rows = rows.filter(b => (b.status || "published") === bFilterStatus.value);
  return rows;
}

function renderBlogsPagination(totalRows) {
  const totalPages = Math.max(1, Math.ceil(totalRows / BLOG_PAGE_SIZE));
  if (bCurrentPage > totalPages) bCurrentPage = totalPages;
  if (bCurrentPage < 1) bCurrentPage = 1;

  if (!totalRows) {
    bPaginationBox.style.display = "none";
    return;
  }
  bPaginationBox.style.display = "flex";

  const start = (bCurrentPage - 1) * BLOG_PAGE_SIZE + 1;
  const end = Math.min(totalRows, bCurrentPage * BLOG_PAGE_SIZE);
  bPaginationInfo.textContent = `แสดง ${start}–${end} จาก ${totalRows} รายการ`;

  const pages = buildPageList(bCurrentPage, totalPages);
  bPaginationBtns.innerHTML = `
    <button class="cp-page-btn cp-page-nav" data-page="prev" ${bCurrentPage === 1 ? "disabled" : ""} aria-label="หน้าก่อนหน้า">‹</button>
    ${pages.map(p => p === "…"
      ? `<span class="cp-page-ellipsis">…</span>`
      : `<button class="cp-page-btn ${p === bCurrentPage ? "active" : ""}" data-page="${p}">${p}</button>`
    ).join("")}
    <button class="cp-page-btn cp-page-nav" data-page="next" ${bCurrentPage === totalPages ? "disabled" : ""} aria-label="หน้าถัดไป">›</button>
  `;
  bPaginationBtns.querySelectorAll(".cp-page-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      if (btn.disabled) return;
      if (btn.dataset.page === "prev") bCurrentPage = Math.max(1, bCurrentPage - 1);
      else if (btn.dataset.page === "next") bCurrentPage = Math.min(totalPages, bCurrentPage + 1);
      else bCurrentPage = Number(btn.dataset.page);
      renderBlogs();
      bGrid.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  });
}

function renderBlogs() {
  const filteredRows = getFilteredBlogs();

  if (!filteredRows.length) {
    const hasFilters = bSearch.value.trim() || bFilterStatus.value;
    bGrid.innerHTML = hasFilters
      ? emptyStateHTML({ title: "ไม่พบบทความที่ตรงกับตัวกรอง", desc: "ลองเปลี่ยนคำค้นหรือสถานะดูอีกครั้ง" })
      : emptyStateHTML({
          icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 4h16v16H4z"/><path d="M4 9h16M9 4v16"/></svg>`,
          title: "ยังไม่มีบทความในระบบ",
          desc: "เพิ่มบทความแรกเพื่อเริ่มแสดงในหน้าบล็อกของเว็บไซต์",
          ctaLabel: "+ เพิ่มรายการแรก", ctaId: "ad-b-empty-add"
        });
    const emptyAddBtn = document.getElementById("ad-b-empty-add");
    if (emptyAddBtn) emptyAddBtn.addEventListener("click", () => openBlogModal(null));
    renderBlogsPagination(0);
    updateBlogsBulkBar();
    return;
  }

  renderBlogsPagination(filteredRows.length);
  const pageStart = (bCurrentPage - 1) * BLOG_PAGE_SIZE;
  const rows = filteredRows.slice(pageStart, pageStart + BLOG_PAGE_SIZE);

  bGrid.innerHTML = rows.map(b => {
    const visual = b.image
      ? `<img src="${b.image}" alt="${escapeHtml(b.title)}" class="port-photo" loading="lazy">`
      : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 4h16v16H4z"/><path d="M4 9h16M9 4v16"/></svg>`;
    return `
    <div class="port-card ad-card ad-b-card" data-id="${b.id}">
      <input type="checkbox" class="ad-card-check" data-id="${b.id}" ${selectedBlogIds.has(b.id) ? "checked" : ""} aria-label="เลือกบทความนี้">
      <div class="ad-card-actions">
        <button class="cp-icon-btn" data-action="edit" title="แก้ไข"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button>
        <button class="cp-icon-btn" data-action="clone" title="ทำซ้ำ (เปิดฟอร์มเพิ่มใหม่พร้อมข้อมูลเดิม)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
        <button class="cp-icon-btn danger" data-action="delete" title="ลบ"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg></button>
      </div>
      <div class="port-visual${b.image ? "" : " no-photo"}">
        ${visual}
        ${(b.status || "published") === "draft" ? `<span class="ad-b-status-draft">ฉบับร่าง</span>` : ""}
      </div>
      <div class="ad-card-body">
        <span class="ad-card-cat">${escapeHtml(b.category || "บทความ")}</span>
        <span class="ad-card-name">${escapeHtml(b.title || "ไม่มีชื่อ")}</span>
      </div>
    </div>`;
  }).join("");
  updateBlogsBulkBar();
}

bSearch.addEventListener("input", () => { bCurrentPage = 1; renderBlogs(); });
bFilterStatus.addEventListener("change", () => { bCurrentPage = 1; renderBlogs(); });

bGrid.addEventListener("click", async (e) => {
  const card = e.target.closest(".ad-card");
  if (!card) return;
  const id = card.dataset.id;
  const post = allBlogs.find(b => b.id === id);
  if (!post) return;
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  if (btn.dataset.action === "edit") openBlogModal(post);
  if (btn.dataset.action === "clone") openBlogModalClone(post);
  if (btn.dataset.action === "delete") {
    if (await confirmDialog(`ลบบทความ "${post.title || ""}" ใช่หรือไม่? การลบนี้ไม่สามารถย้อนกลับได้`, { title: "ลบบทความ" })) {
      deleteWithUndo({
        pendingSet: pendingDeleteBlogIds, id, renderFn: renderBlogs,
        message: `ลบบทความ "${post.title || ""}" แล้ว`,
        deleteFn: () => deleteBlog(id), onCommitted: reloadAll, targetType: "blog"
      });
    }
  }
});

// ── Bulk actions (เลือกหลายการ์ด + ลบ/เปลี่ยนสถานะทีเดียว) ──────────────────────────────
function updateBlogsBulkBar() {
  if (!bBulkBar) return;
  bBulkCount.textContent = selectedBlogIds.size;
  bBulkBar.classList.toggle("active", selectedBlogIds.size > 0);
}

bGrid.addEventListener("change", (e) => {
  if (!e.target.classList.contains("ad-card-check")) return;
  const id = e.target.dataset.id;
  if (e.target.checked) selectedBlogIds.add(id); else selectedBlogIds.delete(id);
  updateBlogsBulkBar();
});

if (bBulkClearBtn) {
  bBulkClearBtn.addEventListener("click", () => {
    selectedBlogIds.clear();
    bGrid.querySelectorAll(".ad-card-check").forEach(cb => { cb.checked = false; });
    updateBlogsBulkBar();
  });
}

if (bBulkApplyBtn) {
  bBulkApplyBtn.addEventListener("click", async () => {
    const status = bBulkStatusSelect.value;
    if (!status || !selectedBlogIds.size) return;
    const ids = Array.from(selectedBlogIds);
    bBulkApplyBtn.disabled = true;
    try {
      await Promise.all(ids.map(id => {
        const post = allBlogs.find(b => b.id === id);
        return post ? saveBlog({ ...post, id, status }) : Promise.resolve();
      }));
      showToast(`เปลี่ยนสถานะแล้ว ${ids.length} รายการ`, "success");
      selectedBlogIds.clear();
      bBulkStatusSelect.value = "";
      await reloadAll();
    } catch (err) {
      showToast("อัปเดตสถานะไม่สำเร็จ: " + err.message);
    } finally {
      bBulkApplyBtn.disabled = false;
      updateBlogsBulkBar();
    }
  });
}

if (bBulkDeleteBtn) {
  bBulkDeleteBtn.addEventListener("click", async () => {
    if (!selectedBlogIds.size) return;
    const ids = Array.from(selectedBlogIds);
    if (!(await confirmDialog(`ลบบทความที่เลือก ${ids.length} รายการ? ไม่สามารถกู้คืนได้`, { title: "ลบหลายรายการ" }))) return;
    bBulkDeleteBtn.disabled = true;
    try {
      await Promise.all(ids.map(id => deleteBlog(id)));
      showToast(`ลบแล้ว ${ids.length} รายการ`, "success");
      selectedBlogIds.clear();
      await reloadAll();
    } catch (err) {
      showToast("ลบไม่สำเร็จ: " + err.message);
    } finally {
      bBulkDeleteBtn.disabled = false;
      updateBlogsBulkBar();
    }
  });
}

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

bAddBtn.addEventListener("click", () => openBlogModal(null));
bCancelBtn.addEventListener("click", () => blogFormGuard.guardedClose());
bOverlay.addEventListener("click", (e) => { if (e.target === bOverlay) blogFormGuard.guardedClose(); });

const blogFormGuard = attachUnsavedGuard({
  overlay: bOverlay, form: bForm, doClose: closeBlogModal,
  getExtra: () => currentBlogImage
});

function openBlogModal(post) {
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
  openOverlay(bOverlay);
  blogFormGuard.capture();
}

// "ทำซ้ำ" — เปิดฟอร์ม "เพิ่มบทความ" พร้อมข้อมูลเดิมกรอกไว้ให้ (ไม่ใช่แก้ของเดิม)
// เวลาต้องการเขียนบทความชุดเดียวกันหลายภาษา/หลายมุม โดยใช้โครงเดิมเป็นฐาน
function openBlogModalClone(post) {
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

// ===========================================================
// FAQ
// ===========================================================
const fTableBody = document.getElementById("ad-f-table-body");
const fAddBtn    = document.getElementById("ad-f-add-btn");
const fOverlay   = document.getElementById("ad-f-overlay");
const fForm      = document.getElementById("ad-f-form");
const fModalTitle = document.getElementById("ad-f-modal-title");
const fCancelBtn  = document.getElementById("ad-f-cancel");
const fPaginationBox  = document.getElementById("ad-f-pagination");
const fPaginationInfo = document.getElementById("ad-f-pagination-info");
const fPaginationBtns = document.getElementById("ad-f-pagination-btns");
const FAQ_PAGE_SIZE = 10;
let fCurrentPage = 1;
function renderFaqPagination(totalRows) {
  const totalPages = Math.max(1, Math.ceil(totalRows / FAQ_PAGE_SIZE));
  if (fCurrentPage > totalPages) fCurrentPage = totalPages;
  if (fCurrentPage < 1) fCurrentPage = 1;
  if (!totalRows) { fPaginationBox.style.display = "none"; return; }
  fPaginationBox.style.display = "flex";
  const start = (fCurrentPage - 1) * FAQ_PAGE_SIZE + 1;
  const end = Math.min(totalRows, fCurrentPage * FAQ_PAGE_SIZE);
  fPaginationInfo.textContent = `แสดง ${start}–${end} จาก ${totalRows} รายการ`;
  const pages = buildPageList(fCurrentPage, totalPages);
  fPaginationBtns.innerHTML = `
    <button class="cp-page-btn cp-page-nav" data-page="prev" ${fCurrentPage === 1 ? "disabled" : ""} aria-label="หน้าก่อนหน้า">‹</button>
    ${pages.map(p => p === "…"
      ? `<span class="cp-page-ellipsis">…</span>`
      : `<button class="cp-page-btn ${p === fCurrentPage ? "active" : ""}" data-page="${p}">${p}</button>`
    ).join("")}
    <button class="cp-page-btn cp-page-nav" data-page="next" ${fCurrentPage === totalPages ? "disabled" : ""} aria-label="หน้าถัดไป">›</button>
  `;
  fPaginationBtns.querySelectorAll(".cp-page-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      if (btn.disabled) return;
      if (btn.dataset.page === "prev") fCurrentPage = Math.max(1, fCurrentPage - 1);
      else if (btn.dataset.page === "next") fCurrentPage = Math.min(totalPages, fCurrentPage + 1);
      else fCurrentPage = Number(btn.dataset.page);
      renderFaqs();
      fTableBody.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  });
}

function renderFaqs() {
  const filteredRows = allFaqs.filter(f => !pendingDeleteFaqIds.has(f.id));
  if (!allFaqs.length) {
    fTableBody.innerHTML = `<tr><td colspan="3" class="cp-empty">ยังไม่มีคำถามที่พบบ่อย — หน้าแรกจะแสดงชุดคำถามเริ่มต้นไปก่อน</td></tr>`;
    renderFaqPagination(0);
    return;
  }
  if (!filteredRows.length) {
    fTableBody.innerHTML = `<tr><td colspan="3" class="cp-empty">ไม่พบคำถามที่พบบ่อย</td></tr>`;
    renderFaqPagination(0);
    return;
  }
  renderFaqPagination(filteredRows.length);
  const fPageStart = (fCurrentPage - 1) * FAQ_PAGE_SIZE;
  const fRows = filteredRows.slice(fPageStart, fPageStart + FAQ_PAGE_SIZE);
  fTableBody.innerHTML = fRows.map(f => `
    <tr data-id="${f.id}">
      <td style="font-weight:700;">${escapeHtml(f.question || "")}</td>
      <td class="ad-l-msg" style="max-width:420px;">${escapeHtml(f.answer || "")}</td>
      <td>
        <div class="cp-row-actions">
          <button class="cp-icon-btn" data-action="edit" title="แก้ไข"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button>
          <button class="cp-icon-btn danger" data-action="delete" title="ลบ"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg></button>
        </div>
      </td>
    </tr>`).join("");
}

fTableBody.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  const tr = btn.closest("tr");
  const id = tr.dataset.id;
  const item = allFaqs.find(f => f.id === id);
  if (!item) return;
  if (btn.dataset.action === "edit") openFaqModal(item);
  if (btn.dataset.action === "delete") {
    if (!(await confirmDialog(`ลบคำถาม "${item.question}" ใช่หรือไม่?`, { title: "ลบคำถาม" }))) return;
    deleteWithUndo({
      pendingSet: pendingDeleteFaqIds, id, renderFn: renderFaqs,
      message: `ลบคำถาม "${item.question || ""}" แล้ว`,
      deleteFn: () => deleteFaq(id), onCommitted: reloadAll, targetType: "faq"
    });
  }
});

fAddBtn.addEventListener("click", () => openFaqModal(null));
fCancelBtn.addEventListener("click", closeFaqModal);
fOverlay.addEventListener("click", (e) => { if (e.target === fOverlay) closeFaqModal(); });

function openFaqModal(item) {
  fModalTitle.textContent = item ? "แก้ไขคำถาม" : "เพิ่มคำถาม";
  document.getElementById("ad-f-id").value       = item ? item.id : "";
  document.getElementById("ad-f-question").value = item ? item.question || "" : "";
  document.getElementById("ad-f-answer").value   = item ? item.answer || "" : "";
  openOverlay(fOverlay);
}

function closeFaqModal() {
  closeOverlay(fOverlay);
  fForm.reset();
}

fForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = document.getElementById("ad-f-id").value;
  const payload = {
    question: document.getElementById("ad-f-question").value.trim(),
    answer:   document.getElementById("ad-f-answer").value.trim()
  };
  if (id) payload.id = id;
  const btn = fForm.querySelector('button[type=submit]');
  btn.disabled = true; btn.textContent = "กำลังบันทึก...";
  try {
    await saveFaq(payload);
    closeFaqModal();
    await reloadAll();
  } catch (err) {
    showToast("บันทึกไม่สำเร็จ: " + err.message);
  } finally {
    btn.disabled = false; btn.textContent = "บันทึก";
  }
});

// ===========================================================
// PARTNERS / โลโก้ลูกค้า
// ===========================================================
const ptGrid   = document.getElementById("ad-pt-grid");
const ptAddBtn = document.getElementById("ad-pt-add-btn");
const ptPaginationBox  = document.getElementById("ad-pt-pagination");
const ptPaginationInfo = document.getElementById("ad-pt-pagination-info");
const ptPaginationBtns = document.getElementById("ad-pt-pagination-btns");
const PARTNERS_PAGE_SIZE = 12;
let ptCurrentPage = 1;

const ptOverlay    = document.getElementById("ad-pt-overlay");
const ptForm        = document.getElementById("ad-pt-form");
const ptModalTitle  = document.getElementById("ad-pt-modal-title");
const ptCancelBtn   = document.getElementById("ad-pt-cancel");
const ptImageBox    = document.getElementById("ad-pt-image");
const ptUploadInput = document.getElementById("ad-pt-upload");
const ptUploadStatus = document.getElementById("ad-pt-upload-status");

let currentPartnerLogo = "";

function renderPartnersPagination(totalRows) {
  const totalPages = Math.max(1, Math.ceil(totalRows / PARTNERS_PAGE_SIZE));
  if (ptCurrentPage > totalPages) ptCurrentPage = totalPages;
  if (ptCurrentPage < 1) ptCurrentPage = 1;
  if (!totalRows) { ptPaginationBox.style.display = "none"; return; }
  ptPaginationBox.style.display = "flex";
  const start = (ptCurrentPage - 1) * PARTNERS_PAGE_SIZE + 1;
  const end = Math.min(totalRows, ptCurrentPage * PARTNERS_PAGE_SIZE);
  ptPaginationInfo.textContent = `แสดง ${start}–${end} จาก ${totalRows} รายการ`;
  const pages = buildPageList(ptCurrentPage, totalPages);
  ptPaginationBtns.innerHTML = `
    <button class="cp-page-btn cp-page-nav" data-page="prev" ${ptCurrentPage === 1 ? "disabled" : ""} aria-label="หน้าก่อนหน้า">‹</button>
    ${pages.map(p => p === "…"
      ? `<span class="cp-page-ellipsis">…</span>`
      : `<button class="cp-page-btn ${p === ptCurrentPage ? "active" : ""}" data-page="${p}">${p}</button>`
    ).join("")}
    <button class="cp-page-btn cp-page-nav" data-page="next" ${ptCurrentPage === totalPages ? "disabled" : ""} aria-label="หน้าถัดไป">›</button>
  `;
  ptPaginationBtns.querySelectorAll(".cp-page-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      if (btn.disabled) return;
      if (btn.dataset.page === "prev") ptCurrentPage = Math.max(1, ptCurrentPage - 1);
      else if (btn.dataset.page === "next") ptCurrentPage = Math.min(totalPages, ptCurrentPage + 1);
      else ptCurrentPage = Number(btn.dataset.page);
      renderPartners();
      ptGrid.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  });
}

function renderPartners() {
  const filteredRows = allPartners.filter(p => !pendingDeletePartnerIds.has(p.id));
  if (!allPartners.length) {
    ptGrid.innerHTML = `<div class="cp-empty">ยังไม่มีโลโก้ลูกค้า — หน้าแรกจะแสดงตัวอย่าง placeholder ไปก่อน</div>`;
    renderPartnersPagination(0);
    return;
  }
  if (!filteredRows.length) {
    ptGrid.innerHTML = `<div class="cp-empty">ไม่พบโลโก้ลูกค้า</div>`;
    renderPartnersPagination(0);
    return;
  }
  renderPartnersPagination(filteredRows.length);
  const ptPageStart = (ptCurrentPage - 1) * PARTNERS_PAGE_SIZE;
  const ptRows = filteredRows.slice(ptPageStart, ptPageStart + PARTNERS_PAGE_SIZE);
  ptGrid.innerHTML = ptRows.map(p => {
    const visual = p.logo
      ? `<img src="${p.logo}" alt="${escapeHtml(p.name)}" class="port-photo" loading="lazy">`
      : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 21h18M5 21V7l8-4 8 4v14"/></svg>`;
    return `
    <div class="port-card ad-card ad-pt-card" data-id="${p.id}">
      <div class="ad-card-actions">
        <button class="cp-icon-btn" data-action="edit" title="แก้ไข"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button>
        <button class="cp-icon-btn danger" data-action="delete" title="ลบ"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg></button>
      </div>
      <div class="port-visual${p.logo ? "" : " no-photo"}">${visual}</div>
      <div class="ad-card-body">
        <span class="ad-card-name">${escapeHtml(p.name || "")}</span>
      </div>
    </div>`;
  }).join("");
}

ptGrid.addEventListener("click", async (e) => {
  const card = e.target.closest(".ad-card");
  if (!card) return;
  const id = card.dataset.id;
  const item = allPartners.find(p => p.id === id);
  if (!item) return;
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  if (btn.dataset.action === "edit") openPartnerModal(item);
  if (btn.dataset.action === "delete") {
    if (await confirmDialog(`ลบโลโก้ "${item.name || ""}" ใช่หรือไม่?`, { title: "ลบโลโก้" })) {
      deleteWithUndo({
        pendingSet: pendingDeletePartnerIds, id, renderFn: renderPartners,
        message: `ลบโลโก้ "${item.name || ""}" แล้ว`,
        deleteFn: () => deletePartner(id), onCommitted: reloadAll, targetType: "partner"
      });
    }
  }
});

function renderPartnerImage() {
  ptImageBox.innerHTML = currentPartnerLogo ? imageGridHTML([currentPartnerLogo], false) : `<div class="ad-img-empty">ยังไม่มีโลโก้ — อัปโหลดด้านล่าง</div>`;
}

ptImageBox.addEventListener("click", (e) => {
  const btn = e.target.closest(".ad-img-remove");
  if (!btn) return;
  currentPartnerLogo = "";
  renderPartnerImage();
});

ptUploadInput.addEventListener("change", async () => {
  const file = ptUploadInput.files && ptUploadInput.files[0];
  if (!file) return;
  ptUploadStatus.textContent = "กำลังอัปโหลด...";
  try {
    currentPartnerLogo = await uploadImage(file);
    renderPartnerImage();
    ptUploadStatus.textContent = "";
  } catch (err) {
    ptUploadStatus.textContent = "";
    showToast("อัปโหลดรูปไม่สำเร็จ: " + err.message);
  } finally {
    ptUploadInput.value = "";
  }
});

ptAddBtn.addEventListener("click", () => openPartnerModal(null));
ptCancelBtn.addEventListener("click", closePartnerModal);
ptOverlay.addEventListener("click", (e) => { if (e.target === ptOverlay) closePartnerModal(); });

function openPartnerModal(item) {
  ptModalTitle.textContent = item ? "แก้ไขโลโก้ลูกค้า" : "เพิ่มโลโก้ลูกค้า";
  document.getElementById("ad-pt-id").value   = item ? item.id : "";
  document.getElementById("ad-pt-name").value = item ? item.name || "" : "";
  currentPartnerLogo = item ? (item.logo || "") : "";
  renderPartnerImage();
  openOverlay(ptOverlay);
}

function closePartnerModal() {
  closeOverlay(ptOverlay);
  ptForm.reset();
  currentPartnerLogo = "";
}

ptForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = document.getElementById("ad-pt-id").value;
  const payload = {
    name: document.getElementById("ad-pt-name").value.trim(),
    logo: currentPartnerLogo
  };
  if (id) payload.id = id;
  const btn = ptForm.querySelector('button[type=submit]');
  btn.disabled = true; btn.textContent = "กำลังบันทึก...";
  try {
    await savePartner(payload);
    closePartnerModal();
    await reloadAll();
  } catch (err) {
    showToast("บันทึกไม่สำเร็จ: " + err.message);
  } finally {
    btn.disabled = false; btn.textContent = "บันทึก";
  }
});

// ===========================================================
// TESTIMONIALS — รีวิวลูกค้า (แสดงในหน้าแรก "เสียงจากลูกค้าองค์กร")
// ===========================================================
const tTableBody  = document.getElementById("ad-t-table-body");
const tAddBtn     = document.getElementById("ad-t-add-btn");
const tOverlay    = document.getElementById("ad-t-overlay");
const tForm       = document.getElementById("ad-t-form");
const tModalTitle = document.getElementById("ad-t-modal-title");
const tCancelBtn  = document.getElementById("ad-t-cancel");
const tImageBox   = document.getElementById("ad-t-image");
const tUploadInput = document.getElementById("ad-t-upload");
const tUploadStatus = document.getElementById("ad-t-upload-status");
const tPaginationBox  = document.getElementById("ad-t-pagination");
const tPaginationInfo = document.getElementById("ad-t-pagination-info");
const tPaginationBtns = document.getElementById("ad-t-pagination-btns");
const TESTIMONIALS_PAGE_SIZE = 10;
let tCurrentPage = 1;

let currentTestimonialLogo = "";

function renderTestimonialsPagination(totalRows) {
  const totalPages = Math.max(1, Math.ceil(totalRows / TESTIMONIALS_PAGE_SIZE));
  if (tCurrentPage > totalPages) tCurrentPage = totalPages;
  if (tCurrentPage < 1) tCurrentPage = 1;
  if (!totalRows) { tPaginationBox.style.display = "none"; return; }
  tPaginationBox.style.display = "flex";
  const start = (tCurrentPage - 1) * TESTIMONIALS_PAGE_SIZE + 1;
  const end = Math.min(totalRows, tCurrentPage * TESTIMONIALS_PAGE_SIZE);
  tPaginationInfo.textContent = `แสดง ${start}–${end} จาก ${totalRows} รายการ`;
  const pages = buildPageList(tCurrentPage, totalPages);
  tPaginationBtns.innerHTML = `
    <button class="cp-page-btn cp-page-nav" data-page="prev" ${tCurrentPage === 1 ? "disabled" : ""} aria-label="หน้าก่อนหน้า">‹</button>
    ${pages.map(p => p === "…"
      ? `<span class="cp-page-ellipsis">…</span>`
      : `<button class="cp-page-btn ${p === tCurrentPage ? "active" : ""}" data-page="${p}">${p}</button>`
    ).join("")}
    <button class="cp-page-btn cp-page-nav" data-page="next" ${tCurrentPage === totalPages ? "disabled" : ""} aria-label="หน้าถัดไป">›</button>
  `;
  tPaginationBtns.querySelectorAll(".cp-page-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      if (btn.disabled) return;
      if (btn.dataset.page === "prev") tCurrentPage = Math.max(1, tCurrentPage - 1);
      else if (btn.dataset.page === "next") tCurrentPage = Math.min(totalPages, tCurrentPage + 1);
      else tCurrentPage = Number(btn.dataset.page);
      renderTestimonials();
      tTableBody.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  });
}

function renderTestimonials() {
  const filteredRows = allTestimonials.filter(t => !pendingDeleteTestimonialIds.has(t.id));
  if (!allTestimonials.length) {
    tTableBody.innerHTML = `<tr><td colspan="5" class="cp-empty">ยังไม่มีรีวิวลูกค้า — หน้าแรกจะแสดงชุดตัวอย่างไปก่อน</td></tr>`;
    renderTestimonialsPagination(0);
    return;
  }
  if (!filteredRows.length) {
    tTableBody.innerHTML = `<tr><td colspan="5" class="cp-empty">ไม่พบรีวิวลูกค้า</td></tr>`;
    renderTestimonialsPagination(0);
    return;
  }
  renderTestimonialsPagination(filteredRows.length);
  const tPageStart = (tCurrentPage - 1) * TESTIMONIALS_PAGE_SIZE;
  const tRows = filteredRows.slice(tPageStart, tPageStart + TESTIMONIALS_PAGE_SIZE);
  tTableBody.innerHTML = tRows.map(t => `
    <tr class="ad-card" data-id="${t.id}">
      <td>${escapeHtml(t.company || "")}</td>
      <td>${escapeHtml(t.name || "")}${t.role ? " — " + escapeHtml(t.role) : ""}</td>
      <td>${escapeHtml((t.quote || "").slice(0, 60))}${(t.quote || "").length > 60 ? "…" : ""}</td>
      <td>${"★".repeat(t.stars || 5)}</td>
      <td>
        <div class="cp-row-actions">
          <button class="cp-icon-btn" data-action="edit" title="แก้ไข"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button>
          <button class="cp-icon-btn danger" data-action="delete" title="ลบ"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg></button>
        </div>
      </td>
    </tr>`).join("");
}

tTableBody.addEventListener("click", async (e) => {
  const row = e.target.closest("tr[data-id]");
  if (!row) return;
  const id = row.dataset.id;
  const item = allTestimonials.find(t => t.id === id);
  if (!item) return;
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  if (btn.dataset.action === "edit") openTestimonialModal(item);
  if (btn.dataset.action === "delete") {
    if (await confirmDialog(`ลบรีวิวของ "${item.name || ""}" ใช่หรือไม่?`, { title: "ลบรีวิว" })) {
      deleteWithUndo({
        pendingSet: pendingDeleteTestimonialIds, id, renderFn: renderTestimonials,
        message: `ลบรีวิวของ "${item.name || ""}" แล้ว`,
        deleteFn: () => deleteTestimonial(id), onCommitted: reloadAll, targetType: "testimonial"
      });
    }
  }
});

function renderTestimonialImage() {
  tImageBox.innerHTML = currentTestimonialLogo ? imageGridHTML([currentTestimonialLogo], false) : `<div class="ad-img-empty">ยังไม่มีรูป — อัปโหลดด้านล่าง (ไม่บังคับ)</div>`;
}

tImageBox.addEventListener("click", (e) => {
  const btn = e.target.closest(".ad-img-remove");
  if (!btn) return;
  currentTestimonialLogo = "";
  renderTestimonialImage();
});

tUploadInput.addEventListener("change", async () => {
  const file = tUploadInput.files && tUploadInput.files[0];
  if (!file) return;
  tUploadStatus.textContent = "กำลังอัปโหลด...";
  try {
    currentTestimonialLogo = await uploadImage(file);
    renderTestimonialImage();
    tUploadStatus.textContent = "";
  } catch (err) {
    tUploadStatus.textContent = "";
    showToast("อัปโหลดรูปไม่สำเร็จ: " + err.message);
  } finally {
    tUploadInput.value = "";
  }
});

tAddBtn.addEventListener("click", () => openTestimonialModal(null));
tCancelBtn.addEventListener("click", closeTestimonialModal);
tOverlay.addEventListener("click", (e) => { if (e.target === tOverlay) closeTestimonialModal(); });

function openTestimonialModal(item) {
  tModalTitle.textContent = item ? "แก้ไขรีวิว" : "เพิ่มรีวิวลูกค้า";
  document.getElementById("ad-t-id").value      = item ? item.id : "";
  document.getElementById("ad-t-company").value = item ? item.company || "" : "";
  document.getElementById("ad-t-stars").value   = item ? String(item.stars || 5) : "5";
  document.getElementById("ad-t-quote").value   = item ? item.quote || "" : "";
  document.getElementById("ad-t-name").value    = item ? item.name || "" : "";
  document.getElementById("ad-t-role").value    = item ? item.role || "" : "";
  currentTestimonialLogo = item ? (item.logo || "") : "";
  renderTestimonialImage();
  openOverlay(tOverlay);
}

function closeTestimonialModal() {
  closeOverlay(tOverlay);
  tForm.reset();
  currentTestimonialLogo = "";
}

tForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = document.getElementById("ad-t-id").value;
  const payload = {
    company: document.getElementById("ad-t-company").value.trim(),
    stars:   Number(document.getElementById("ad-t-stars").value) || 5,
    quote:   document.getElementById("ad-t-quote").value.trim(),
    name:    document.getElementById("ad-t-name").value.trim(),
    role:    document.getElementById("ad-t-role").value.trim(),
    logo:    currentTestimonialLogo
  };
  if (id) payload.id = id;
  const btn = tForm.querySelector('button[type=submit]');
  btn.disabled = true; btn.textContent = "กำลังบันทึก...";
  try {
    await saveTestimonial(payload);
    closeTestimonialModal();
    await reloadAll();
  } catch (err) {
    showToast("บันทึกไม่สำเร็จ: " + err.message);
  } finally {
    btn.disabled = false; btn.textContent = "บันทึก";
  }
});

// ===========================================================
// SETTINGS — ข้อมูลติดต่อทั้งเว็บไซต์
// ===========================================================
const sForm   = document.getElementById("ad-s-form");
const sStatus = document.getElementById("ad-s-status");

function renderContactSettings(settings) {
  document.getElementById("ad-s-phone").value        = (settings && settings.phone) || "";
  document.getElementById("ad-s-phone2").value        = (settings && settings.phone2) || "";
  document.getElementById("ad-s-fax").value           = (settings && settings.fax) || "";
  document.getElementById("ad-s-email").value         = (settings && settings.email) || "";
  document.getElementById("ad-s-line-url").value      = (settings && settings.lineUrl) || "";
  document.getElementById("ad-s-facebook-url").value  = (settings && settings.facebookUrl) || "";
  document.getElementById("ad-s-address").value       = (settings && settings.address) || "";
}

sForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const payload = {
    phone:       document.getElementById("ad-s-phone").value.trim(),
    phone2:      document.getElementById("ad-s-phone2").value.trim(),
    fax:         document.getElementById("ad-s-fax").value.trim(),
    email:       document.getElementById("ad-s-email").value.trim(),
    lineUrl:     document.getElementById("ad-s-line-url").value.trim(),
    facebookUrl: document.getElementById("ad-s-facebook-url").value.trim(),
    address:     document.getElementById("ad-s-address").value.trim()
  };
  const btn = sForm.querySelector('button[type=submit]');
  btn.disabled = true; btn.textContent = "กำลังบันทึก...";
  sStatus.textContent = "";
  try {
    await saveSettings(payload);
    sStatus.textContent = "บันทึกสำเร็จ — เว็บไซต์จะใช้ข้อมูลใหม่นี้ในการโหลดครั้งถัดไปทุกหน้า";
  } catch (err) {
    sStatus.textContent = "";
    showToast("บันทึกไม่สำเร็จ: " + err.message);
  } finally {
    btn.disabled = false; btn.textContent = "บันทึกข้อมูลติดต่อ";
  }
});

// ===========================================================
// SETTINGS — โปรโมชั่น & ข่าวอัพเดตล่าสุด (หน้าแรก)
// เก็บเป็น settings.promoUpdates: [{ image, title, link }]
// ===========================================================
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

function renderPromoSettings(settings) {
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

// ===========================================================
// SETTINGS — วิดีโอแนะนำสินค้า (หน้าแรก) — การ์ดวิดีโอแนวตั้งเลื่อนได้
// เก็บเป็น settings.introVideos: [{ url, poster, title, desc }, ...] (สูงสุด 10)
// รองรับอ่าน settings.introVideo (ตัวเดียว) แบบเก่าไว้เป็น fallback ตอนโหลด
// ===========================================================
const VIDEOS_MAX = 10;
const videosListBox  = document.getElementById("ad-videos-list");
const videosAddBtn   = document.getElementById("ad-videos-add");
const videosSaveBtn  = document.getElementById("ad-videos-save");
const videosStatus   = document.getElementById("ad-videos-status");

let currentVideos = []; // [{ url, poster, title, desc }]

function videoItemHTML(video, i) {
  const isDirectFile = /\.(mp4|webm|ogg)(\?.*)?$/i.test((video.url || "").trim());
  return `
    <div class="ad-video-item" data-idx="${i}">
      <div class="ad-video-item-head">
        <span class="ad-video-item-num">วิดีโอที่ ${i + 1}</span>
        <span class="ad-video-item-actions">
          <button type="button" class="ad-video-item-move" data-act="up" data-idx="${i}" ${i === 0 ? "disabled" : ""} title="เลื่อนขึ้น">↑</button>
          <button type="button" class="ad-video-item-move" data-act="down" data-idx="${i}" ${i === currentVideos.length - 1 ? "disabled" : ""} title="เลื่อนลง">↓</button>
          <button type="button" class="ad-video-item-remove" data-act="remove" data-idx="${i}" title="ลบวิดีโอนี้">×</button>
        </span>
      </div>
      <div class="ad-img-label">อัปโหลดไฟล์วิดีโอโดยตรง (.mp4/.webm แนะนำไม่เกิน ~50MB) หรือวางลิงก์ YouTube ด้านล่างแทนก็ได้</div>
      <label class="ad-upload-btn">
        <input type="file" class="ad-video-file-upload" data-idx="${i}" accept="video/*" hidden>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
        อัปโหลดไฟล์วิดีโอ
      </label>
      <div class="ad-upload-status ad-video-file-upload-status" data-idx="${i}"></div>
      ${(video.url && isDirectFile) ? `<div class="ad-video-current">ไฟล์วิดีโอที่อัปโหลดไว้: <a href="${escapeHtml(video.url)}" target="_blank" rel="noopener">เปิดดู</a></div>` : ""}
      <input type="text" class="cl-input ad-video-url" data-idx="${i}" placeholder="หรือวางลิงก์วิดีโอ เช่น https://www.youtube.com/watch?v=xxxxx หรือ https://.../video.mp4" value="${escapeHtml(video.url || "")}">
      <div class="cp-modal-row">
        <input type="text" class="cl-input ad-video-title" data-idx="${i}" placeholder="ชื่อวิดีโอ (ไม่บังคับ)" value="${escapeHtml(video.title || "")}">
        <input type="text" class="cl-input ad-video-desc" data-idx="${i}" placeholder="คำอธิบายสั้นๆ (ไม่บังคับ)" value="${escapeHtml(video.desc || "")}">
      </div>
      <div class="ad-img-label">รูปปกวิดีโอ (ไม่บังคับ — ลิงก์ YouTube จะดึงภาพปกให้อัตโนมัติ)</div>
      <div class="ad-img-grid ad-video-poster-box" data-idx="${i}">${video.poster
        ? imageGridHTML([video.poster], false)
        : `<div class="ad-img-empty">ยังไม่มีรูปปก</div>`}</div>
      <label class="ad-upload-btn">
        <input type="file" class="ad-video-poster-upload" data-idx="${i}" accept="image/*" hidden>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
        อัปโหลดรูปปก
      </label>
      <div class="ad-upload-status ad-video-poster-upload-status" data-idx="${i}"></div>
    </div>`;
}

function renderVideosList() {
  if (!currentVideos.length) {
    videosListBox.innerHTML = `<div class="ad-videos-empty">ยังไม่มีวิดีโอ — กด "+ เพิ่มวิดีโอ" ด้านล่างเพื่อเริ่ม (หน้าแรกจะขึ้น "รออัพเดต" จนกว่าจะมีอย่างน้อย 1 คลิป)</div>`;
    return;
  }
  videosListBox.innerHTML = currentVideos.map(videoItemHTML).join("");
}

function renderVideoSettings(settings) {
  currentVideos = (settings && Array.isArray(settings.introVideos))
    ? settings.introVideos.map(v => ({ url: v.url || "", poster: v.poster || "", title: v.title || "", desc: v.desc || "" })).filter(v => v.url)
    : [];
  if (!currentVideos.length && settings && settings.introVideo && settings.introVideo.url) {
    const v = settings.introVideo;
    currentVideos = [{ url: v.url || "", poster: v.poster || "", title: v.title || "", desc: v.desc || "" }];
  }
  renderVideosList();
}

if (videosAddBtn) {
  videosAddBtn.addEventListener("click", () => {
    if (currentVideos.length >= VIDEOS_MAX) {
      showToast(`เพิ่มวิดีโอได้สูงสุด ${VIDEOS_MAX} คลิป`);
      return;
    }
    currentVideos.push({ url: "", poster: "", title: "", desc: "" });
    renderVideosList();
  });
}

if (videosListBox) {
  videosListBox.addEventListener("click", async (e) => {
    const moveBtn = e.target.closest(".ad-video-item-move");
    if (moveBtn) {
      const idx = Number(moveBtn.dataset.idx);
      const dir = moveBtn.dataset.act === "up" ? -1 : 1;
      const swapIdx = idx + dir;
      if (swapIdx < 0 || swapIdx >= currentVideos.length) return;
      [currentVideos[idx], currentVideos[swapIdx]] = [currentVideos[swapIdx], currentVideos[idx]];
      renderVideosList();
      return;
    }
    const removeBtn = e.target.closest(".ad-video-item-remove");
    if (removeBtn) {
      currentVideos.splice(Number(removeBtn.dataset.idx), 1);
      renderVideosList();
      return;
    }
    const posterRemoveBtn = e.target.closest(".ad-img-remove");
    if (posterRemoveBtn) {
      const box = e.target.closest(".ad-video-poster-box");
      const idx = Number(box.dataset.idx);
      if (currentVideos[idx]) {
        currentVideos[idx].poster = "";
        renderVideosList();
      }
    }
  });

  videosListBox.addEventListener("input", (e) => {
    const idx = Number(e.target.dataset.idx);
    if (Number.isNaN(idx) || !currentVideos[idx]) return;
    if (e.target.classList.contains("ad-video-url"))   currentVideos[idx].url   = e.target.value;
    if (e.target.classList.contains("ad-video-title")) currentVideos[idx].title = e.target.value;
    if (e.target.classList.contains("ad-video-desc"))  currentVideos[idx].desc  = e.target.value;
  });

  videosListBox.addEventListener("change", async (e) => {
    const idx = Number(e.target.dataset.idx);
    if (Number.isNaN(idx) || !currentVideos[idx]) return;

    if (e.target.classList.contains("ad-video-file-upload")) {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const statusEl = videosListBox.querySelector(`.ad-video-file-upload-status[data-idx="${idx}"]`);
      if (statusEl) statusEl.textContent = "กำลังอัปโหลดวิดีโอ... (ไฟล์ใหญ่อาจใช้เวลาสักครู่)";
      try {
        const url = await uploadFile(file, "paisign/videos");
        currentVideos[idx].url = url;
        renderVideosList();
      } catch (err) {
        if (statusEl) statusEl.textContent = "";
        showToast("อัปโหลดวิดีโอไม่สำเร็จ: " + err.message + " (เช็คว่า Cloudinary preset เปิดรับไฟล์วิดีโอหรือยัง)");
      }
      e.target.value = "";
      return;
    }

    if (e.target.classList.contains("ad-video-poster-upload")) {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const statusEl = videosListBox.querySelector(`.ad-video-poster-upload-status[data-idx="${idx}"]`);
      if (statusEl) statusEl.textContent = "กำลังอัปโหลด...";
      try {
        currentVideos[idx].poster = await uploadImage(file);
        renderVideosList();
      } catch (err) {
        if (statusEl) statusEl.textContent = "";
        showToast("อัปโหลดรูปไม่สำเร็จ: " + err.message);
      }
      e.target.value = "";
      return;
    }
  });
}

if (videosSaveBtn) {
  videosSaveBtn.addEventListener("click", async () => {
    const payload = currentVideos.filter(v => v.url && v.url.trim()).slice(0, VIDEOS_MAX);
    videosSaveBtn.disabled = true;
    const originalLabel = videosSaveBtn.textContent;
    videosSaveBtn.textContent = "กำลังบันทึก...";
    videosStatus.textContent = "";
    try {
      await saveSettings({ introVideos: payload });
      videosStatus.textContent = "บันทึกสำเร็จ — หน้าแรกจะอัปเดตตามนี้ในการโหลดครั้งถัดไป";
      logAudit("update", "intro-video", "", `อัปเดตวิดีโอแนะนำสินค้า (${payload.length} คลิป)`);
    } catch (err) {
      showToast("บันทึกไม่สำเร็จ: " + err.message);
    } finally {
      videosSaveBtn.disabled = false;
      videosSaveBtn.textContent = originalLabel;
    }
  });
}

// ===========================================================
// SETTINGS — ทีมงาน (รายชื่อผู้รับผิดชอบลีด) — เก็บเป็น settings.teamMembers: string[]
// ===========================================================
const teamForm  = document.getElementById("ad-team-form");
const teamInput = document.getElementById("ad-team-input");
const teamList  = document.getElementById("ad-team-list");
let currentTeamMembers = []; // เก็บ snapshot ล่าสุดไว้ใช้เติม dropdown ผู้รับผิดชอบในแท็บลีด

export function getTeamMembers() { return currentTeamMembers; }

function renderTeamSettings(settings) {
  currentTeamMembers = (settings && Array.isArray(settings.teamMembers)) ? settings.teamMembers : [];
  if (!currentTeamMembers.length) {
    teamList.innerHTML = `<div class="ad-team-empty">ยังไม่มีรายชื่อ — เพิ่มชื่อพนักงานคนแรกด้านบน</div>`;
  } else {
    teamList.innerHTML = currentTeamMembers.map(name => `
      <span class="ad-team-chip">
        ${escapeHtml(name)}
        <button type="button" class="ad-team-remove" data-name="${escapeHtml(name)}" title="ลบชื่อนี้ออก">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </span>`).join("");
  }
  fillAssigneeSelects();
  renderLeads();
}

async function saveTeamMembers(next, auditMsg) {
  currentTeamMembers = next;
  await saveSettings({ teamMembers: next });
  renderTeamSettings({ teamMembers: next });
  if (auditMsg) logAudit("update", "team-members", "", auditMsg);
}

if (teamForm) {
  teamForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = teamInput.value.trim();
    if (!name) return;
    if (currentTeamMembers.includes(name)) { teamInput.value = ""; return; }
    const btn = teamForm.querySelector('button[type=submit]');
    btn.disabled = true;
    try {
      await saveTeamMembers([...currentTeamMembers, name], `เพิ่ม "${name}"`);
      teamInput.value = "";
    } catch (err) {
      showToast("เพิ่มชื่อไม่สำเร็จ: " + err.message);
    } finally {
      btn.disabled = false;
    }
  });
}

if (teamList) {
  teamList.addEventListener("click", async (e) => {
    const btn = e.target.closest(".ad-team-remove");
    if (!btn) return;
    const name = btn.dataset.name;
    // ถ้ามีลีดที่ผู้รับผิดชอบคนนี้ถืออยู่ ให้ถามยืนยันก่อน เพราะลบชื่อออกจากรายชื่อกลางแล้ว
    // ลีดที่เคยมอบหมายไว้จะยังเก็บชื่อเดิมค้างอยู่ (แค่เลือกใหม่ไม่ได้จาก dropdown เท่านั้น)
    const inUse = allLeads.some(l => l.assignee === name);
    if (inUse && !(await confirmDialog(
      `"${name}" ยังมีลีดที่มอบหมายไว้อยู่ — ลบชื่อออกจากรายชื่อทีมงานจะทำให้เลือกชื่อนี้ใหม่ไม่ได้ (ลีดเดิมจะยังโชว์ชื่อนี้ค้างไว้) ดำเนินการต่อหรือไม่?`,
      { title: "ลบรายชื่อทีมงาน" }
    ))) return;
    try {
      await saveTeamMembers(currentTeamMembers.filter(n => n !== name), `ลบ "${name}"`);
    } catch (err) {
      showToast("ลบชื่อไม่สำเร็จ: " + err.message);
    }
  });
}

// ===========================================================
// SETTINGS — บัญชีผู้ใช้ทีมงาน (staff/{uid}.role) — สิทธิ์ admin (ลบได้ทุกอย่าง)
// vs staff (แก้ไขได้แต่ลบไม่ได้) บังคับจริงฝั่ง Firestore rules; ฝั่งนี้แค่เป็นหน้าจอจัดการ
// ===========================================================
const staffForm      = document.getElementById("ad-staff-form");
const staffUidInput  = document.getElementById("ad-staff-uid");
const staffNameInput = document.getElementById("ad-staff-name");
const staffEmailInput= document.getElementById("ad-staff-email");
const staffRoleSelect= document.getElementById("ad-staff-role");
const staffListBox   = document.getElementById("ad-staff-list");

const roleLabel = (role) => role === "admin" ? "admin" : "staff";

async function renderStaffList() {
  if (!staffListBox) return;
  staffListBox.innerHTML = `<div class="ad-team-empty">กำลังโหลด…</div>`;
  try {
    const staff = (await listStaff()).filter(s => !pendingDeleteStaffUids.has(s.uid));
    if (!staff.length) {
      staffListBox.innerHTML = `<div class="ad-team-empty">ยังไม่มีใครถูกกำหนดสิทธิ์ไว้ — ทุกบัญชีที่ล็อกอินได้ถือเป็น admin ไปก่อน</div>`;
      return;
    }
    staffListBox.innerHTML = staff.map(s => `
      <div class="ad-staff-row" data-uid="${escapeHtml(s.uid)}">
        <span class="ad-staff-name">${escapeHtml(s.name || "(ไม่ระบุชื่อ)")}</span>
        <span class="ad-staff-email">${escapeHtml(s.email || "")}</span>
        <span class="ad-staff-role-badge ${s.role === "admin" ? "" : "role-staff"}">${roleLabel(s.role)}</span>
        <button type="button" class="ad-staff-remove" data-uid="${escapeHtml(s.uid)}" title="เอาออกจากรายชื่อ (กลับไปนับเป็น admin เหมือนยังไม่ตั้งค่า)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </div>`).join("");
  } catch (err) {
    staffListBox.innerHTML = errorStateHTML(`โหลดรายชื่อไม่สำเร็จ: ${err.message || ""}`, renderStaffList, { wrapTag: "div" });
  }
}

if (staffForm) {
  staffForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const uid = staffUidInput.value.trim();
    if (!uid) return;
    const name = staffNameInput.value.trim();
    const email = staffEmailInput.value.trim();
    const role = staffRoleSelect.value;
    const btn = staffForm.querySelector('button[type=submit]');
    btn.disabled = true;
    try {
      await upsertStaffRole({ uid, name, email, role });
      logAudit("update", "staff-role", uid, `${name || email || uid} → ${role}`);
      staffUidInput.value = ""; staffNameInput.value = ""; staffEmailInput.value = "";
      staffRoleSelect.value = "staff";
      await renderStaffList();
      showToast("บันทึกสิทธิ์แล้ว", "success");
    } catch (err) {
      showToast("บันทึกไม่สำเร็จ: " + err.message);
    } finally {
      btn.disabled = false;
    }
  });
}

if (staffListBox) {
  staffListBox.addEventListener("click", async (e) => {
    const btn = e.target.closest(".ad-staff-remove");
    if (!btn) return;
    const uid = btn.dataset.uid;
    const row = btn.closest(".ad-staff-row");
    const staffName = row ? (row.querySelector(".ad-staff-name")?.textContent || "") : "";
    if (!(await confirmDialog("เอาสิทธิ์คนนี้ออกจากรายชื่อ? (บัญชียัง login ได้ปกติ แค่ไม่มี role กำหนดไว้แล้ว)", { title: "ลบบัญชีผู้ใช้ทีมงาน" }))) return;
    deleteWithUndo({
      pendingSet: pendingDeleteStaffUids, id: uid, renderFn: renderStaffList,
      message: `ลบสิทธิ์ของ "${staffName || uid}" แล้ว`,
      deleteFn: () => removeStaffRole(uid), onCommitted: renderStaffList, targetType: "staff-role"
    });
  });
}

// ===========================================================
// SETTINGS — ประวัติการทำงาน (Audit Log) — อ่านอย่างเดียว, ดูได้เฉพาะ role admin
// (ถ้าไม่มีสิทธิ์ Firestore rules จะปฏิเสธการอ่านเอง ฝั่งนี้แค่โชว์ error message)
// ===========================================================
const auditListBox   = document.getElementById("ad-audit-list");
const auditRefreshBtn = document.getElementById("ad-audit-refresh");

function fmtAuditTime(ts) {
  if (!ts) return "";
  const d = ts.toMillis ? new Date(ts.toMillis()) : new Date(ts);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" });
}

const AUDIT_ACTION_LABEL = { delete: "ลบ", update: "แก้ไข", create: "เพิ่ม" };

async function renderAuditLog() {
  if (!auditListBox) return;
  auditListBox.innerHTML = `<div class="ad-team-empty">กำลังโหลด…</div>`;
  try {
    const rows = await listAuditLog(200);
    if (!rows.length) {
      auditListBox.innerHTML = `<div class="ad-team-empty">ยังไม่มีประวัติ</div>`;
      return;
    }
    auditListBox.innerHTML = rows.map(r => `
      <div class="ad-audit-row">
        <span class="ad-audit-action">${escapeHtml(AUDIT_ACTION_LABEL[r.action] || r.action)}</span>
        <span>${escapeHtml(r.targetType || "")}${r.meta ? " — " + escapeHtml(r.meta) : ""}</span>
        <span class="ad-audit-meta">${escapeHtml(r.email || r.uid || "")} · ${fmtAuditTime(r.createdAt)}</span>
      </div>`).join("");
  } catch (err) {
    // ปกติจะขึ้นตรงนี้ถ้าบัญชีที่ล็อกอินอยู่มี role เป็น "staff" (ไม่ใช่ admin) — Firestore rules
    // ปฏิเสธการอ่านให้เองอยู่แล้ว ถือว่าทำงานถูกต้องตามที่ตั้งใจ
    auditListBox.innerHTML = `<div class="ad-team-empty">ดูประวัตินี้ได้เฉพาะบัญชีที่มีบทบาท admin เท่านั้น (${escapeHtml(err.message || "")})</div>`;
  }
}

if (auditRefreshBtn) auditRefreshBtn.addEventListener("click", renderAuditLog);

const auditExportBtn = document.getElementById("ad-audit-export");
if (auditExportBtn) {
  auditExportBtn.addEventListener("click", async () => {
    auditExportBtn.disabled = true;
    try {
      const rows = await listAuditLog(1000);
      const csv = auditLogToCSV(rows);
      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }); // BOM กันภาษาไทยเพี้ยนตอนเปิดด้วย Excel
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      showToast("ส่งออกไม่สำเร็จ: " + err.message);
    } finally {
      auditExportBtn.disabled = false;
    }
  });
}



// ===========================================================
// GLOBAL SEARCH — ค้นข้ามสินค้า/ลีด/คำสั่งผลิตในกล่องเดียว พร้อมลิงก์กระโดดไปแท็บที่เจอ
// เปิดได้จากปุ่ม "ค้นหา" บน topbar หรือคีย์ลัด "/" (โฟกัสอยู่นอกช่องพิมพ์อื่น — ดู KEYBOARD SHORTCUTS ด้านล่าง)
// ===========================================================
const gsOverlay  = document.getElementById("ad-gs-overlay");
const gsInput    = document.getElementById("ad-gs-input");
const gsResults  = document.getElementById("ad-gs-results");
const gsCloseBtn = document.getElementById("ad-gs-close");
const gsTrigger  = document.getElementById("ad-gs-trigger");

const GS_ICONS = {
  product: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>`,
  lead:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16v12H7l-3 3V4Z"/></svg>`,
  order:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 7 12 3 4 7l8 4 8-4Z"/><path d="M4 7v10l8 4 8-4V7"/><path d="M12 11v10"/></svg>`,
  category: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41 12 22l-9-9 8.59-8.59A2 2 0 0 1 13 4h6a2 2 0 0 1 2 2v6a2 2 0 0 1-.41 1.41Z"/><circle cx="16.5" cy="7.5" r="1"/></svg>`,
  blog:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16v16H4z"/><path d="M4 9h16M9 4v16"/></svg>`,
  testimonial: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l1.6 4.9H19l-4 3 1.5 5L12 12l-4.5 3 1.5-5-4-3h5.4z"/></svg>`
};
const GS_TYPE_LABEL = { product: "สินค้า", lead: "ลีด", order: "คำสั่งผลิต", category: "หมวดหมู่", blog: "บทความ", testimonial: "รีวิว" };

function gsEscRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

// ไฮไลต์คำค้นในผลลัพธ์ — escape ค่าทั้งหมดก่อนเสมอ (กันช่องค้นหากลายเป็นช่องโหว่ XSS แบบเดียวกับที่แก้ใน site-search.js)
function gsHighlight(text, q) {
  const safe = escapeHtml(text == null ? "" : String(text));
  if (!q) return safe;
  const re = new RegExp("(" + gsEscRe(escapeHtml(q)) + ")", "ig");
  return safe.replace(re, "<mark>$1</mark>");
}

// ดัชนีค้นหา: รวมสินค้า/ลีด/คำสั่งผลิตทั้งหมดที่โหลดไว้แล้วในหน้านี้ ค้นแบบ substring ไม่สนตัวพิมพ์เล็ก-ใหญ่
// (ไม่ต้องยิง query เพิ่ม เพราะ allProducts/allLeads/getAllOrders() เป็นข้อมูลที่ realtime listener ซิงก์ไว้อยู่แล้ว)
function gsSearch(query) {
  const q = query.trim().toLowerCase();
  if (!q) return { products: [], leads: [], orders: [], categories: [], blogs: [], testimonials: [] };

  const products = allProducts
    .filter(p => !pendingDeleteProductIds.has(p.id))
    .filter(p => (p.name || "").toLowerCase().includes(q) || (p.code || "").toLowerCase().includes(q))
    .slice(0, 6);

  const leads = allLeads
    .filter(l => !pendingDeleteLeadIds.has(l.id))
    .filter(l => [l.name, l.company, l.email, l.tel, l.phone, l.service].filter(Boolean).join(" ").toLowerCase().includes(q))
    .slice(0, 6);

  const orders = getAllOrders()
    .filter(o => [o.code, o.customer, o.item].filter(Boolean).join(" ").toLowerCase().includes(q))
    .slice(0, 6);

  const categories = allCategories
    .filter(c => !pendingDeleteCategoryIds.has(c.id))
    .filter(c => [c.name, c.group, c.description].filter(Boolean).join(" ").toLowerCase().includes(q))
    .slice(0, 6);

  const blogs = allBlogs
    .filter(b => !pendingDeleteBlogIds.has(b.id))
    .filter(b => [b.title, b.category, b.excerpt].filter(Boolean).join(" ").toLowerCase().includes(q))
    .slice(0, 6);

  const testimonials = allTestimonials
    .filter(t => !pendingDeleteTestimonialIds.has(t.id))
    .filter(t => [t.name, t.company, t.role, t.quote].filter(Boolean).join(" ").toLowerCase().includes(q))
    .slice(0, 6);

  return { products, leads, orders, categories, blogs, testimonials };
}

function gsResultRow(type, title, desc) {
  return `
    <button type="button" class="ad-gs-result" data-type="${type}">
      <span class="ad-gs-result-icon">${GS_ICONS[type]}</span>
      <span class="ad-gs-result-body">
        <span class="ad-gs-result-title">${title}</span>
        <span class="ad-gs-result-desc">${desc || "&nbsp;"}</span>
      </span>
      <span class="ad-gs-result-tag">${GS_TYPE_LABEL[type]}</span>
    </button>`;
}

let gsCurrentResults = []; // ลิสต์เรียบ [{type, item}, ...] ตามลำดับที่ render จริง — ใช้กับลูกศร/Enter
let gsActiveIndex = -1;

function gsRenderEmpty() {
  gsResults.innerHTML = `<div class="ad-gs-empty">พิมพ์เพื่อค้นหาชื่อ/รหัสสินค้า, ชื่อ/บริษัทลีด, เลขที่คำสั่งผลิต, หมวดหมู่, บทความ หรือรีวิวลูกค้า</div>`;
  gsCurrentResults = [];
  gsActiveIndex = -1;
}

function gsRenderNoMatch(q) {
  gsResults.innerHTML = `<div class="ad-gs-empty">ไม่พบผลลัพธ์สำหรับ &ldquo;<strong>${escapeHtml(q)}</strong>&rdquo;</div>`;
  gsCurrentResults = [];
  gsActiveIndex = -1;
}

function gsRender(query) {
  const q = query.trim();
  if (!q) { gsRenderEmpty(); return; }
  const { products, leads, orders, categories, blogs, testimonials } = gsSearch(q);
  if (!products.length && !leads.length && !orders.length && !categories.length && !blogs.length && !testimonials.length) { gsRenderNoMatch(q); return; }

  gsCurrentResults = [];
  let html = "";
  if (products.length) {
    html += `<div class="ad-gs-group-label">สินค้า</div>`;
    products.forEach(p => {
      gsCurrentResults.push({ type: "product", item: p });
      html += gsResultRow("product", gsHighlight(p.name || "ไม่มีชื่อ", q), gsHighlight([p.code, catName(p.cat_id)].filter(Boolean).join(" · "), q));
    });
  }
  if (leads.length) {
    html += `<div class="ad-gs-group-label">ลีด</div>`;
    leads.forEach(l => {
      gsCurrentResults.push({ type: "lead", item: l });
      html += gsResultRow("lead", gsHighlight(l.name || l.company || "(ไม่ระบุชื่อ)", q), gsHighlight([l.company, l.email, l.tel || l.phone].filter(Boolean).join(" · "), q));
    });
  }
  if (orders.length) {
    html += `<div class="ad-gs-group-label">คำสั่งผลิต</div>`;
    orders.forEach(o => {
      gsCurrentResults.push({ type: "order", item: o });
      html += gsResultRow("order", gsHighlight("#" + (o.code || o.id), q), gsHighlight([o.customer, o.item].filter(Boolean).join(" · "), q));
    });
  }
  if (categories.length) {
    html += `<div class="ad-gs-group-label">หมวดหมู่</div>`;
    categories.forEach(c => {
      gsCurrentResults.push({ type: "category", item: c });
      html += gsResultRow("category", gsHighlight(c.name || "ไม่มีชื่อ", q), gsHighlight(c.group || c.description || "", q));
    });
  }
  if (blogs.length) {
    html += `<div class="ad-gs-group-label">บทความ</div>`;
    blogs.forEach(b => {
      gsCurrentResults.push({ type: "blog", item: b });
      html += gsResultRow("blog", gsHighlight(b.title || "ไม่มีชื่อ", q), gsHighlight([b.category, (b.status || "published") === "draft" ? "ฉบับร่าง" : ""].filter(Boolean).join(" · "), q));
    });
  }
  if (testimonials.length) {
    html += `<div class="ad-gs-group-label">รีวิว</div>`;
    testimonials.forEach(t => {
      gsCurrentResults.push({ type: "testimonial", item: t });
      html += gsResultRow("testimonial", gsHighlight(t.name || t.company || "(ไม่ระบุชื่อ)", q), gsHighlight([t.company, t.role].filter(Boolean).join(" · "), q));
    });
  }
  gsResults.innerHTML = html;
  gsActiveIndex = -1;
}

function gsSetActive(idx) {
  const rows = gsResults.querySelectorAll(".ad-gs-result");
  rows.forEach(r => r.classList.remove("is-active"));
  if (idx >= 0 && rows[idx]) {
    rows[idx].classList.add("is-active");
    rows[idx].scrollIntoView({ block: "nearest" });
  }
  gsActiveIndex = idx;
}

function gsOpen() {
  openOverlay(gsOverlay);
  gsInput.value = "";
  gsRenderEmpty();
  setTimeout(() => gsInput.focus(), 30);
}
function gsClose() {
  closeOverlay(gsOverlay);
}

// ปิด overlay แล้วกระโดดไปแท็บที่เจอผลลัพธ์ พร้อมค้นหา/ไฮไลต์รายการนั้นให้เด่นที่สุด
function gsGoTo(result) {
  if (!result) return;
  gsClose();
  if (result.type === "product") jumpToProduct(result.item);
  else if (result.type === "lead") jumpToLead(result.item);
  else if (result.type === "order") { switchTab("orders"); jumpToOrder(result.item); }
  else if (result.type === "category") jumpToCategory(result.item);
  else if (result.type === "blog") jumpToBlogPost(result.item);
  else if (result.type === "testimonial") jumpToTestimonial(result.item);
}

gsTrigger.addEventListener("click", gsOpen);
gsCloseBtn.addEventListener("click", gsClose);
gsOverlay.addEventListener("click", (e) => { if (e.target === gsOverlay) gsClose(); });

let gsDebounceTimer = null;
gsInput.addEventListener("input", () => {
  window.clearTimeout(gsDebounceTimer);
  const val = gsInput.value;
  gsDebounceTimer = window.setTimeout(() => gsRender(val), 120);
});

gsResults.addEventListener("click", (e) => {
  const row = e.target.closest(".ad-gs-result");
  if (!row) return;
  const idx = Array.from(gsResults.querySelectorAll(".ad-gs-result")).indexOf(row);
  gsGoTo(gsCurrentResults[idx]);
});

gsInput.addEventListener("keydown", (e) => {
  if (e.key === "ArrowDown") {
    e.preventDefault();
    if (gsCurrentResults.length) gsSetActive(Math.min(gsActiveIndex + 1, gsCurrentResults.length - 1));
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    if (gsCurrentResults.length) gsSetActive(Math.max(gsActiveIndex - 1, 0));
  } else if (e.key === "Enter") {
    e.preventDefault();
    if (gsCurrentResults.length) gsGoTo(gsCurrentResults[gsActiveIndex >= 0 ? gsActiveIndex : 0]);
  } else if (e.key === "Escape") {
    e.preventDefault();
    gsClose();
  }
});

// กระโดดไปแท็บ "สินค้า" พร้อมค้นหาสินค้ารายการนี้ให้เด่นที่สุด แล้วเลื่อนจอ/ไฮไลต์การ์ดของสินค้านั้นชั่วครู่
function jumpToProduct(product) {
  switchTab("products");
  pFilterCat.value = "";
  pSearch.value = product.code || product.name || "";
  pCurrentPage = 1;
  renderProducts();
  requestAnimationFrame(() => {
    const card = pGrid.querySelector(`.ad-card[data-id="${product.id}"]`);
    if (!card) return;
    card.scrollIntoView({ behavior: "smooth", block: "center" });
    card.classList.add("ad-search-highlight");
    setTimeout(() => card.classList.remove("ad-search-highlight"), 1800);
  });
}

// กระโดดไปแท็บ "ลีด" พร้อมล้างตัวกรองอื่น ๆ ทิ้ง แล้วค้นหาลีดรายการนี้ให้เด่นที่สุด
function jumpToLead(lead) {
  switchTab("leads");
  setLeadStatusFilter("");
  if (lFilterSource) lFilterSource.value = "";
  if (lFilterAssignee) lFilterAssignee.value = "";
  lSearch.value = lead.name || lead.company || lead.email || lead.tel || lead.phone || "";
  lCurrentPage = 1;
  renderLeads();
  requestAnimationFrame(() => {
    const row = lTableBody.querySelector(`tr[data-id="${lead.id}"]`);
    if (!row) return;
    row.scrollIntoView({ behavior: "smooth", block: "center" });
    row.classList.add("ad-search-highlight");
    setTimeout(() => row.classList.remove("ad-search-highlight"), 1800);
  });
}

// กระโดดไปแท็บ "หมวดหมู่" พร้อมค้นหาหมวดหมู่นี้ให้เด่นที่สุด
function jumpToCategory(cat) {
  switchTab("categories");
  cSearch.value = cat.name || "";
  cCurrentPage = 1;
  renderCategories();
  requestAnimationFrame(() => {
    const row = cTableBody.querySelector(`tr[data-id="${cat.id}"]`);
    if (!row) return;
    row.scrollIntoView({ behavior: "smooth", block: "center" });
    row.classList.add("ad-search-highlight");
    setTimeout(() => row.classList.remove("ad-search-highlight"), 1800);
  });
}

// กระโดดไปแท็บ "บทความ" พร้อมล้างตัวกรองสถานะแล้วค้นหาบทความนี้ให้เด่นที่สุด
function jumpToBlogPost(post) {
  switchTab("blog");
  if (bFilterStatus) bFilterStatus.value = "";
  bSearch.value = post.title || "";
  bCurrentPage = 1;
  renderBlogs();
  requestAnimationFrame(() => {
    const card = bGrid.querySelector(`.ad-card[data-id="${post.id}"]`);
    if (!card) return;
    card.scrollIntoView({ behavior: "smooth", block: "center" });
    card.classList.add("ad-search-highlight");
    setTimeout(() => card.classList.remove("ad-search-highlight"), 1800);
  });
}

// กระโดดไปแท็บ "รีวิวลูกค้า" — ไม่มีช่องค้นหาในแท็บนี้ จึงพลิกไปหน้าที่มีรายการนี้แล้วไฮไลต์แทน
function jumpToTestimonial(item) {
  switchTab("testimonials");
  const idx = allTestimonials.findIndex(t => t.id === item.id);
  tCurrentPage = idx >= 0 ? Math.floor(idx / TESTIMONIALS_PAGE_SIZE) + 1 : 1;
  renderTestimonials();
  requestAnimationFrame(() => {
    const row = tTableBody.querySelector(`tr[data-id="${item.id}"]`);
    if (!row) return;
    row.scrollIntoView({ behavior: "smooth", block: "center" });
    row.classList.add("ad-search-highlight");
    setTimeout(() => row.classList.remove("ad-search-highlight"), 1800);
  });
}

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
  faq: "ad-f-add-btn",
  partners: "ad-pt-add-btn",
  testimonials: "ad-t-add-btn"
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
