// ===========================
// js/admin-sidebar.js — Sidebar เมนูแอดมิน: คีย์บอร์ดนำทาง (2D grid) / พับ-กางเมนู / ค้นหาเมนู
//
// 2026 refactor รอบที่ 30: ย้ายมาจาก js/admin-page.js เดิม (ส่วน "คีย์บอร์ด: ลูกศรขึ้น/ลง/
// ซ้าย/ขวาเลื่อนโฟกัสระหว่างแท็บ" ต่อเนื่องถึงท้ายไฟล์เดิม ก่อนบรรทัด export) แบบไม่เปลี่ยน
// behavior ใดๆ — ไม่มีอะไร export ให้ไฟล์อื่นเรียกใช้ เพราะทุกอย่างผูก event listener เอง
// ตอนโหลดไฟล์ (เหมือน admin-global-search.js/admin-products-csv.js) — ต้อง import แบบ
// side-effect `import "./admin-sidebar.js";` ไว้ใน admin-page.js ถึงจะโหลด
//
// จุดตัด: ไฟล์นี้ import `switchTab` กลับจาก admin-page.js — เป็น circular import ที่ตั้งใจ
// ปลอดภัยเพราะ switchTab เป็น function declaration ที่ hoisted ก่อนโค้ดอื่นในไฟล์รันอยู่แล้ว
// (แพทเทิร์นเดียวกับที่ admin-global-search.js/admin-overview-dashboard.js/
// admin-overview-detail-cards.js/admin-global-search-jump.js ทำอยู่แล้ว) — `tabsBox` ไม่ได้
// export มาจาก admin-page.js (เป็นแค่ const ธรรมดาไม่ใช่ state ข้ามไฟล์) จึง query DOM เองซ้ำ
// ในไฟล์นี้แทน (`document.getElementById("ad-tabs")`) — ไม่มีอะไรอื่นต่างจากต้นฉบับ
// ===========================
import { switchTab } from "./admin-page.js";

const tabsBox = document.getElementById("ad-tabs");

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
//    "ใบเสนอราคา"/"quote" แทน "ลีด") เลยทำ synonym map
//    ต่อแท็บ ครอบคลุมทั้งไทย/อังกฤษที่คนน่าจะพิมพ์ค้นหาจริง ๆ
// 2) "ตัดคำไทย" — ภาษาไทยไม่มีเว้นวรรคระหว่างคำ การเช็ค .includes() ตรง ๆ กับ
//    label/keyword เดี่ยว ๆ จับคำย่อยที่ติดกันได้อยู่แล้วโดยธรรมชาติของสคริปต์ไทย
//    (ไม่ต้องพึ่ง word-segmentation library) แต่ถ้าคนพิมพ์หลายคำคนละลำดับหรือมี
//    เว้นวรรคคั่น การเช็คทั้งก้อนแบบเดิมจะไม่เจอ — เลยตัดคำค้นด้วยช่องว่างเป็น token
//    แล้วเช็คว่าทุก token ต้องเจอในชุดคำของแท็บนั้น (AND ข้าม token, OR ภายใน
//    keyword list ของแต่ละแท็บ) วิธีนี้ครอบคลุมของจริงได้โดยไม่ต้องเพิ่ม dependency
//    ตัดคำไทยเต็มรูปแบบซึ่งเกินความจำเป็นสำหรับเมนูเท่านี้
const AD_TAB_KEYWORDS = {
  overview:     ["ภาพรวม", "แดชบอร์ด", "dashboard", "หน้าหลัก", "สรุป", "overview"],
  orders:       ["คำสั่งผลิต", "order", "orders", "production console", "ผลิต", "จัดส่ง", "shipping", "order queue", "งานผลิต"],
  products:     ["สินค้า", "product", "products", "รายการสินค้า", "แคตตาล็อก", "catalog"],
  categories:   ["หมวดหมู่", "category", "categories", "หมวด", "กลุ่มสินค้า"],
  portfolio:    ["ผลงาน", "portfolio", "เคส", "case", "โปรเจกต์", "project", "ผลงานที่ผ่านมา"],
  blog:         ["บทความ", "blog", "บล็อก", "ข่าวสาร", "โพสต์", "post", "content", "คอนเทนต์"],
  faq:          ["คำถามที่พบบ่อย", "faq", "คำถาม", "ถามตอบ", "q&a", "qa"],
  leads:        ["ลีด", "lead", "leads", "ลูกค้าเป้าหมาย", "ใบเสนอราคา", "quote", "ผู้สนใจ", "inquiry"],
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
// wrap ด้วย try/catch เผื่อ private mode/localStorage ไม่พร้อมใช้งาน — ไม่ throw ต่อ fallback
// เป็นสถานะ "ไม่พับเมนู" เงียบๆ (แพทเทิร์นเดียวกับ js/cart.js/js/track-modal.js)
let sidebarCollapsedStored = false;
try { sidebarCollapsedStored = localStorage.getItem(SIDEBAR_COLLAPSE_KEY) === "1"; } catch { /* ignore */ }
applySidebarCollapsed(sidebarCollapsedStored);
if (sidebarCollapseBtn) {
  sidebarCollapseBtn.addEventListener("click", () => {
    const next = !tabsBox.classList.contains("is-collapsed");
    applySidebarCollapsed(next);
    try { localStorage.setItem(SIDEBAR_COLLAPSE_KEY, next ? "1" : "0"); } catch { /* ignore */ }
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
