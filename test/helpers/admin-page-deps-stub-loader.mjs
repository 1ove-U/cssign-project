// test/helpers/admin-page-deps-stub-loader.mjs
//
// รอบที่ 134: ใช้กับ test/admin-page.test.mjs เท่านั้น — ทิศทางตรงข้ามกับ
// admin-page-stub-loader.mjs (ไฟล์นั้นสตับ "./admin-page.js" ตอนไฟล์อื่น import กลับเข้ามา
// circular) — ไฟล์นี้ปล่อยให้ js/admin-page.js ตัวจริงถูก import ตรงๆ (เป็นเป้าหมายที่กำลังเทส)
// แต่ดัก import ของ "มัน" เองแทน เฉพาะกลุ่มไฟล์ UI/แท็บย่อยอีก ~20 ไฟล์ที่แต่ละไฟล์มีเทสของ
// ตัวเองอยู่แล้ว (ไม่อยากลากทั้งแอปมาด้วยแบบที่รอบ 132 ตัดสินใจไว้แล้วว่าเสี่ยงเกินไป —
// ไม่ deterministic เพราะมี Firestore listener จริงของ orders-tab.js/admin-leads.js ผูกอยู่)
//
// ดัก "เฉพาะตอนที่ parentURL ตรงกับ js/admin-page.js ตัวจริงเท่านั้น" (ไม่ใช่ทุกไฟล์ที่ import
// specifier เดียวกัน) กัน false-positive กับไฟล์อื่นที่ import "./admin-products.js" ฯลฯ ตรงๆ
// เอง (เช่น admin-global-search-jump.js) — ไฟล์เหล่านั้นยังคงได้ไฟล์จริงตามปกติ
//
// ทุกฟังก์ชันที่สตับบันทึกอาร์กิวเมนต์ล่าสุดที่ถูกเรียกไว้ใน globalThis.__AD_PAGE_DEPS_CALLS__
// (object คีย์ตามชื่อฟังก์ชัน ค่าเป็น array ของอาร์กิวเมนต์แต่ละครั้งที่ถูกเรียก) ให้เทส assert ได้
// ว่า reloadAll()/switchTab() ของ admin-page.js เรียกฟังก์ชันแท็บย่อยถูกต้องครบ — ฟังก์ชันกลุ่ม
// "on*"/"onRequest*Tab" (orders-tab.js) เก็บ callback ที่ admin-page.js ลงทะเบียนไว้ใน
// globalThis.__AD_PAGE_DEPS_CALLBACKS__ ให้เทสยิงเรียกเองได้ (จำลอง event จริงจาก orders-tab.js)

const STUB_PREFIX = "admin-page-deps-stub:";
const PARENT_RE = /\/js\/admin-page\.js(\?.*)?$/;

// ชื่อฟังก์ชัน export ธรรมดา (no-op spy, ไม่มี return value ที่ admin-page.js สนใจ)
const SIMPLE_STUBS = {
  "./admin-overview-dashboard.js": ["renderOverview", "renderNotifBell"],
  "./admin-products.js": ["fillCategorySelects", "renderProducts"],
  "./admin-groups.js": ["fillGroupSelect", "renderGroups"],
  "./admin-categories.js": ["renderCategories"],
  "./admin-portfolio.js": ["renderPortfolios"],
  "./admin-blog.js": ["renderBlogs"],
  "./admin-faq.js": ["renderFaqs"],
  "./admin-settings-contact.js": ["renderContactSettings"],
  "./admin-settings-promo.js": ["renderPromoSettings"],
  "./admin-settings-videos.js": ["renderVideoSettings"],
  "./admin-settings-team.js": ["renderTeamSettings"],
  "./admin-settings-staff.js": ["renderStaffList"],
  "./admin-settings-audit.js": ["renderAuditLog"],
  "./admin-leads.js": ["startLeadsListener"],
};

// ไฟล์ side-effect-only (ไม่มีอะไรให้ import ใช้จริง — admin-page.js import แบบ `import "..."`
// เฉยๆ) — คืนโมดูลว่างเปล่า ไม่ต้อง export อะไร
const SIDE_EFFECT_ONLY = [
  "./admin-products-csv.js",
  "./admin-leads-automation.js",
  "./admin-global-search.js",
  "./admin-keyboard-shortcuts.js",
  "./admin-sidebar.js",
];

// orders-tab.js: ฟังก์ชัน on*/onRequest*Tab ต้องเก็บ callback ไว้ให้เทสยิงเรียกเองได้ (ไม่ใช่แค่
// spy เฉยๆ) ต่างจากกลุ่ม SIMPLE_STUBS ด้านบน จึงเขียนแยกเป็น source ของตัวเอง
const ORDERS_TAB_SPECIFIER = "./orders-tab.js";

function buildSimpleStubSource(fnNames) {
  const body = fnNames.map(name => `
export function ${name}(...args) {
  if (!globalThis.__AD_PAGE_DEPS_CALLS__) globalThis.__AD_PAGE_DEPS_CALLS__ = {};
  if (!Array.isArray(globalThis.__AD_PAGE_DEPS_CALLS__["${name}"])) globalThis.__AD_PAGE_DEPS_CALLS__["${name}"] = [];
  globalThis.__AD_PAGE_DEPS_CALLS__["${name}"].push(args);
}
`).join("\n");
  return body;
}

const ORDERS_TAB_SOURCE = `
function recordCall(name, args) {
  if (!globalThis.__AD_PAGE_DEPS_CALLS__) globalThis.__AD_PAGE_DEPS_CALLS__ = {};
  if (!Array.isArray(globalThis.__AD_PAGE_DEPS_CALLS__[name])) globalThis.__AD_PAGE_DEPS_CALLS__[name] = [];
  globalThis.__AD_PAGE_DEPS_CALLS__[name].push(args);
}
function recordCallback(name, cb) {
  if (!globalThis.__AD_PAGE_DEPS_CALLBACKS__) globalThis.__AD_PAGE_DEPS_CALLBACKS__ = {};
  globalThis.__AD_PAGE_DEPS_CALLBACKS__[name] = cb;
}
export function stopOrdersTab(...args) { recordCall("stopOrdersTab", args); }
export function initOrdersTab(...args) { recordCall("initOrdersTab", args); }
export function onOrdersChanged(cb) { recordCall("onOrdersChanged", [cb]); recordCallback("onOrdersChanged", cb); }
export function onRequestOrdersTab(cb) { recordCall("onRequestOrdersTab", [cb]); recordCallback("onRequestOrdersTab", cb); }
export function onRequestOverviewTab(cb) { recordCall("onRequestOverviewTab", [cb]); recordCallback("onRequestOverviewTab", cb); }
`;

export async function resolve(specifier, context, nextResolve) {
  if (context.parentURL && PARENT_RE.test(context.parentURL)) {
    if (SIMPLE_STUBS[specifier]) {
      return { url: STUB_PREFIX + "simple:" + encodeURIComponent(specifier), shortCircuit: true };
    }
    if (specifier === ORDERS_TAB_SPECIFIER) {
      return { url: STUB_PREFIX + "orders-tab", shortCircuit: true };
    }
    if (SIDE_EFFECT_ONLY.includes(specifier)) {
      return { url: STUB_PREFIX + "empty:" + encodeURIComponent(specifier), shortCircuit: true };
    }
  }
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url.startsWith(STUB_PREFIX)) {
    if (url === STUB_PREFIX + "orders-tab") {
      return { format: "module", source: ORDERS_TAB_SOURCE, shortCircuit: true };
    }
    if (url.startsWith(STUB_PREFIX + "empty:")) {
      return { format: "module", source: "// side-effect-only stub (รอบที่ 134)\n", shortCircuit: true };
    }
    if (url.startsWith(STUB_PREFIX + "simple:")) {
      const specifier = decodeURIComponent(url.slice((STUB_PREFIX + "simple:").length));
      const source = buildSimpleStubSource(SIMPLE_STUBS[specifier]);
      return { format: "module", source, shortCircuit: true };
    }
  }
  return nextLoad(url, context);
}
