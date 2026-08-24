// test/admin-sidebar.test.mjs — รอบที่ 122
//
// ขอบเขต: js/admin-sidebar.js (177 บรรทัด) — คีย์บอร์ดนำทาง sidebar (2D grid บนจอแคบ/ลิสต์เชิงเส้น
// บนจอกว้าง), การ์ด "สรุปเนื้อหาเว็บไซต์" (#ov-stats-grid) กด jump ไปแท็บ, ปุ่มพับ/กางเมนู (จำสถานะ
// ผ่าน localStorage), ช่องค้นหาเมนู (filter + คำพ้อง + ตัดคำ AND ข้าม token) — ไฟล์นี้ไม่ export
// อะไรเลย ผูก event listener เองตอนโหลดไฟล์ (เหมือน admin-global-search.js/
// admin-keyboard-shortcuts.js) จึงเทสผ่านการ dispatch event จริงแล้วเช็ค side-effect บน DOM/
// localStorage/switchTab ที่ถูกเรียก
//
// **infra เทสที่ต้องเพิ่มก่อนเริ่มงานได้ (ยืนยันด้วยการลอง import ตรงๆ ก่อนเขียนเทส ตามที่ตกลงไว้
// ทุกรอบ)**:
// 1. ไฟล์นี้ import { switchTab } from "./admin-page.js" ตรงๆ ที่ระดับบนสุด (ไม่ใช่ reloadAll
//    เหมือนไฟล์กลุ่มก่อนหน้าที่ใช้ test/helpers/admin-page-stub-loader.mjs) — เพิ่ม "sidebar" เข้า
//    ALLOWED_PARENT_RE ของ stub loader เดิม + เพิ่ม export switchTab ปลอมเข้าไปในโมดูลสตับด้วย
//    ควบคุมผ่าน globalThis.__AD_PAGE_STUB_SWITCH_TAB__ (แพทเทิร์นเดียวกับ
//    __AD_PAGE_STUB_RELOAD_ALL__ เดิม — ไม่ตั้งไว้ = no-op เฉยๆ ไม่ throw)
// 2. ไฟล์นี้เรียก `localStorage.getItem()`/`localStorage.setItem()` ที่ระดับบนสุด (บรรทัด
//    applySidebarCollapsed(localStorage.getItem(...))) — jsdom ไม่ implement localStorage ให้
//    (ReferenceError: localStorage is not defined ยืนยันจากการลอง import ตรงๆ ก่อนแก้) — ทำ
//    in-memory polyfill เล็กๆ ในไฟล์นี้เอง (Map ธรรมดา) ตั้งเป็น globalThis.localStorage ก่อน
//    import ไม่แก้โค้ดผลิตภัณฑ์/ไม่เพิ่ม helper loader ใหม่ เพราะเป็นแค่ 4 เมธอดมาตรฐานที่ไฟล์นี้ใช้
//    (getItem/setItem เท่านั้นจริงๆ — ไม่ได้ใช้ removeItem/clear แต่ใส่ไว้ให้ครบสเปกกันเทสอื่นในอนาคต
//    ที่อาจ import ไฟล์นี้ร่วมกับไฟล์ที่ใช้ localStorage เมธอดอื่น)
// 3. `window.matchMedia` ก็ไม่ implement ใน jsdom เหมือนกัน (แพทเทิร์นเดียวกับที่เจอใน
//    test/about-portfolio-extracted-inline-scripts.test.mjs) — ไฟล์นี้เรียกตอน event-time
//    (ในตัว keydown handler ไม่ใช่ตอน import) จึงตั้ง dom.window.matchMedia เป็นฟังก์ชันปลอมที่คุม
//    ผลลัพธ์ได้ต่อเทส (คืน matches ตามที่ตั้งไว้) แทน ไม่ต้อง stub ระดับโมดูล
//
// ตรวจโค้ดจริงทั้งไฟล์ js/admin-sidebar.js ก่อนเขียนเทสนี้ (อ่านครบ 177 บรรทัด) — ไม่พบบั๊ก
//
// โครงสร้างเมนูจริงใน admin.html (5 กลุ่ม, 10 แท็บ ลำดับนี้เป๊ะๆ):
//   กลุ่ม 1: overview
//   กลุ่ม 2: orders, products, categories
//   กลุ่ม 3: portfolio, blog, faq
//   กลุ่ม 4: leads, quotations
//   กลุ่ม 5: settings

import { test, describe, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const ADMIN_HTML = readFileSync(new URL("../admin.html", import.meta.url), "utf-8");
const BODY_START = ADMIN_HTML.indexOf(">", ADMIN_HTML.indexOf("<body")) + 1;
const BODY_END = ADMIN_HTML.indexOf("</body>");
const ADMIN_BODY_NO_SCRIPTS = ADMIN_HTML
  .slice(BODY_START, BODY_END)
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, "");

const ALL_TAB_IDS = [
  "overview", "orders", "products", "categories",
  "portfolio", "blog", "faq",
  "leads", "quotations",
  "settings"
];

let dom;
let document;
let window;
let tabsBox;
let switchTabCalls;

function makeLocalStoragePolyfill() {
  const store = new Map();
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: (k) => { store.delete(k); },
    clear: () => { store.clear(); },
    __store: store
  };
}

before(async () => {
  dom = new JSDOM(`<!doctype html><html><body>${ADMIN_BODY_NO_SCRIPTS}</body></html>`);
  window = dom.window;
  globalThis.window = window;
  globalThis.document = window.document;
  Object.defineProperty(globalThis, "navigator", { value: window.navigator, configurable: true });
  globalThis.KeyboardEvent = window.KeyboardEvent;
  globalThis.MouseEvent = window.MouseEvent;
  globalThis.localStorage = makeLocalStoragePolyfill();
  // ค่าเริ่มต้น: ไม่ narrow, allTabs.indexOf(activeElement) ต้องเจอเสมอเว้นแต่เทสตั้งเอง
  window.matchMedia = (query) => ({ matches: false, media: query });

  document = window.document;
  tabsBox = document.getElementById("ad-tabs");

  switchTabCalls = [];
  globalThis.__AD_PAGE_STUB_SWITCH_TAB__ = (tab, opts) => {
    switchTabCalls.push({ tab, opts });
  };

  await import("../js/admin-sidebar.js"); // side-effect เท่านั้น ผูก listener ตอน import
});

beforeEach(() => {
  switchTabCalls.length = 0;
  window.matchMedia = (query) => ({ matches: false, media: query });
  // รีเซ็ต aria-selected/tabindex/active/ad-nav-hidden กลับสภาพเริ่มต้นทุกเทส (ไฟล์นี้ไม่ได้
  // จัดการ aria-selected เอง — เป็นหน้าที่ switchTab() ตัวจริงใน admin-page.js ที่เราสตับไว้ —
  // แต่ต้องรีเซ็ต ad-nav-hidden ที่ค้นหาเมนูอาจ set ไว้จากเทสก่อนหน้า)
  tabsBox.querySelectorAll(".cp-tab, .cp-sidebar-group").forEach(el => el.classList.remove("ad-nav-hidden"));
  const search = document.getElementById("ad-sidebar-search");
  if (search) search.value = "";
  document.getElementById("ad-sidebar-collapse-btn")?.setAttribute("aria-expanded", "true");
  tabsBox.classList.remove("is-collapsed");
  globalThis.localStorage.clear();
});

function focusTab(tabId) {
  document.getElementById("ad-tabbtn-" + tabId).focus();
}

function dispatchKey(key) {
  document.activeElement.dispatchEvent(
    new window.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true })
  );
}

describe("admin-sidebar — คีย์บอร์ดนำทาง จอกว้าง (ลิสต์เชิงเส้น, matchMedia.matches=false)", () => {
  test("ArrowDown จากแท็บแรก เลื่อนไปแท็บถัดไปตามลำดับ DOM จริง (ข้ามกลุ่ม)", () => {
    focusTab("overview");
    dispatchKey("ArrowDown");
    assert.equal(switchTabCalls.length, 1);
    assert.equal(switchTabCalls[0].tab, "orders");
    assert.deepEqual(switchTabCalls[0].opts, { focus: true });
  });

  test("ArrowRight เทียบเท่า ArrowDown บนจอกว้าง", () => {
    focusTab("orders");
    dispatchKey("ArrowRight");
    assert.equal(switchTabCalls[0].tab, "products");
  });

  test("ArrowUp จากแท็บแรกวนกลับไปแท็บสุดท้าย (settings)", () => {
    focusTab("overview");
    dispatchKey("ArrowUp");
    assert.equal(switchTabCalls[0].tab, "settings");
  });

  test("ArrowLeft เทียบเท่า ArrowUp บนจอกว้าง", () => {
    focusTab("overview");
    dispatchKey("ArrowLeft");
    assert.equal(switchTabCalls[0].tab, "settings");
  });

  test("ArrowDown จากแท็บสุดท้ายวนกลับไปแท็บแรก", () => {
    focusTab("settings");
    dispatchKey("ArrowDown");
    assert.equal(switchTabCalls[0].tab, "overview");
  });

  test("Home ไปแท็บแรกเสมอไม่ว่าจะโฟกัสอยู่ที่ไหน", () => {
    focusTab("faq");
    dispatchKey("Home");
    assert.equal(switchTabCalls[0].tab, "overview");
  });

  test("End ไปแท็บสุดท้ายเสมอไม่ว่าจะโฟกัสอยู่ที่ไหน", () => {
    focusTab("products");
    dispatchKey("End");
    assert.equal(switchTabCalls[0].tab, "settings");
  });

  test("คีย์อื่นที่ไม่ใช่ 6 คีย์นำทาง ไม่ทำอะไรเลย", () => {
    focusTab("overview");
    dispatchKey("a");
    assert.equal(switchTabCalls.length, 0);
  });

  test("แท็บที่ถูกซ่อนด้วย ad-nav-hidden (จากการค้นหา) ถูกข้ามออกจากลำดับนำทาง", () => {
    document.getElementById("ad-tabbtn-orders").classList.add("ad-nav-hidden");
    focusTab("overview");
    dispatchKey("ArrowDown");
    // ข้าม orders ไปที่ products แทน
    assert.equal(switchTabCalls[0].tab, "products");
    document.getElementById("ad-tabbtn-orders").classList.remove("ad-nav-hidden");
  });

  test("ถ้า document.activeElement ไม่ใช่ปุ่มแท็บใดเลย (เช่นโฟกัสอยู่ที่ช่องค้นหาเมนู) ไม่ทำอะไร", () => {
    // body.focus() ใน jsdom ไม่ได้ผล (body ไม่ใช่ focusable โดยดีฟอลต์ ไม่มี tabindex) —
    // ใช้ input ค้นหาเมนูแทนเพราะ focusable จริงและแน่นอนว่าไม่ใช่ .cp-tab
    document.getElementById("ad-sidebar-search").focus();
    dispatchKey("ArrowDown");
    assert.equal(switchTabCalls.length, 0);
  });
});

describe("admin-sidebar — คีย์บอร์ดนำทาง จอแคบ (2D grid, matchMedia.matches=true)", () => {
  beforeEach(() => {
    window.matchMedia = () => ({ matches: true });
  });

  test("ArrowDown เลื่อนลงในคอลัมน์เดียวกัน (กลุ่ม 2: orders→products)", () => {
    focusTab("orders");
    dispatchKey("ArrowDown");
    assert.equal(switchTabCalls[0].tab, "products");
  });

  test("ArrowDown วนกลับต้นคอลัมน์เมื่อถึงท้ายคอลัมน์ (กลุ่ม 2: categories→orders)", () => {
    focusTab("categories");
    dispatchKey("ArrowDown");
    assert.equal(switchTabCalls[0].tab, "orders");
  });

  test("ArrowUp วนไปท้ายคอลัมน์เมื่อถึงต้นคอลัมน์ (กลุ่ม 2: orders→categories)", () => {
    focusTab("orders");
    dispatchKey("ArrowUp");
    assert.equal(switchTabCalls[0].tab, "categories");
  });

  test("ArrowRight ข้ามไปคอลัมน์ถัดไป คงตำแหน่งแถวเดิม (กลุ่ม1[0]overview → กลุ่ม2[0]orders)", () => {
    focusTab("overview");
    dispatchKey("ArrowRight");
    assert.equal(switchTabCalls[0].tab, "orders");
  });

  test("ArrowRight clamp ไปแถวสุดท้ายถ้าคอลัมน์ปลายทางสั้นกว่า (กลุ่ม2[2]categories → กลุ่ม3 clamp ที่ faq[2])", () => {
    focusTab("categories"); // แถวที่ 2 (index 2) ของกลุ่ม 2
    dispatchKey("ArrowRight");
    assert.equal(switchTabCalls[0].tab, "faq"); // กลุ่ม 3 มี index 0,1,2 พอดี ไม่ต้อง clamp จริง
  });

  test("ArrowRight clamp จริง: กลุ่ม 5 (settings, index 0 เดียว) → ArrowLeft กลับกลุ่ม 4 clamp ที่ index 0 (leads)", () => {
    focusTab("settings");
    dispatchKey("ArrowLeft");
    assert.equal(switchTabCalls[0].tab, "leads");
  });

  test("ArrowRight วนจากคอลัมน์สุดท้ายกลับคอลัมน์แรก", () => {
    focusTab("settings");
    dispatchKey("ArrowRight");
    assert.equal(switchTabCalls[0].tab, "overview");
  });

  test("ArrowLeft วนจากคอลัมน์แรกไปคอลัมน์สุดท้าย", () => {
    focusTab("overview");
    dispatchKey("ArrowLeft");
    assert.equal(switchTabCalls[0].tab, "settings");
  });

  test("Home ไปรายการแรกของกลุ่มแรกเสมอ", () => {
    focusTab("quotations");
    dispatchKey("Home");
    assert.equal(switchTabCalls[0].tab, "overview");
  });

  test("End ไปรายการสุดท้ายของกลุ่มสุดท้ายเสมอ", () => {
    focusTab("orders");
    dispatchKey("End");
    assert.equal(switchTabCalls[0].tab, "settings");
  });

  test("กลุ่มที่ถูกซ่อนทั้งกลุ่มด้วย ad-nav-hidden ถูกข้ามออกจากลำดับกริด", () => {
    document.querySelector('.cp-sidebar-group:has([data-tab="portfolio"])')?.classList.add("ad-nav-hidden");
    focusTab("categories"); // ท้ายกลุ่ม 2 — index 2 ในคอลัมน์
    dispatchKey("ArrowRight"); // ควรข้ามกลุ่ม 3 (ถูกซ่อน) ไปกลุ่ม 4 (leads/quotations) เลย
    // กลุ่ม 4 มี 2 รายการ (index 0..1) น้อยกว่ากลุ่ม 2 (3 รายการ) จึงต้อง clamp — Math.min(2,1)=1 → quotations
    assert.equal(switchTabCalls[0].tab, "quotations");
    document.querySelector('.cp-sidebar-group:has([data-tab="portfolio"])')?.classList.remove("ad-nav-hidden");
  });
});

describe("admin-sidebar — การ์ดสรุปเนื้อหาเว็บไซต์ (#ov-stats-grid data-jump)", () => {
  test("คลิกการ์ดที่มี data-jump เรียก switchTab(jump) โดยไม่ส่ง opts (ไม่ focus)", () => {
    const card = document.querySelector('#ov-stats-grid [data-jump="products"]');
    card.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    assert.equal(switchTabCalls.length, 1);
    assert.equal(switchTabCalls[0].tab, "products");
    assert.equal(switchTabCalls[0].opts, undefined);
  });

  test("คลิกจุดที่ไม่ใช่การ์ด data-jump (เช่นพื้นที่ว่างในกริด) ไม่ทำอะไร", () => {
    const grid = document.getElementById("ov-stats-grid");
    grid.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    assert.equal(switchTabCalls.length, 0);
  });

  test("คลิกลูกของการ์ด (เช่น svg/text ข้างใน) ยังหา closest('[data-jump]') เจอ ทำงานเหมือนคลิกการ์ดตรงๆ", () => {
    const card = document.querySelector('#ov-stats-grid [data-jump="leads"]');
    const innerText = card.querySelector("*") || card;
    innerText.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    assert.equal(switchTabCalls.length, 1);
    assert.equal(switchTabCalls[0].tab, "leads");
  });
});

describe("admin-sidebar — ปุ่มพับ/กางเมนู (localStorage)", () => {
  test("โหลดครั้งแรก (ไม่มีค่าเดิมใน localStorage) → ไม่พับเมนู", () => {
    assert.equal(tabsBox.classList.contains("is-collapsed"), false);
  });

  test("คลิกปุ่มพับเมนู → เพิ่ม class is-collapsed + set localStorage เป็น '1' + aria-expanded=false + title เปลี่ยน", () => {
    const btn = document.getElementById("ad-sidebar-collapse-btn");
    btn.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    assert.equal(tabsBox.classList.contains("is-collapsed"), true);
    assert.equal(globalThis.localStorage.getItem("cssign_admin_sidebar_collapsed_v1"), "1");
    assert.equal(btn.getAttribute("aria-expanded"), "false");
    assert.equal(btn.title, "กางเมนู");
  });

  test("คลิกอีกครั้ง → กางกลับคืน + set localStorage เป็น '0' + aria-expanded=true + title กลับเดิม", () => {
    const btn = document.getElementById("ad-sidebar-collapse-btn");
    btn.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); // พับ
    btn.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); // กางกลับ
    assert.equal(tabsBox.classList.contains("is-collapsed"), false);
    assert.equal(globalThis.localStorage.getItem("cssign_admin_sidebar_collapsed_v1"), "0");
    assert.equal(btn.getAttribute("aria-expanded"), "true");
    assert.equal(btn.title, "พับเมนู");
  });

  test("ปุ่มแท็บทุกปุ่มถูกตั้ง title = ข้อความใน <span> ไว้ล่วงหน้าตอนโหลดไฟล์ (ใช้เป็น tooltip ตอนเมนูพับ)", () => {
    assert.equal(document.getElementById("ad-tabbtn-overview").title, "ภาพรวม");
    assert.equal(document.getElementById("ad-tabbtn-settings").title, "ตั้งค่าเว็บไซต์");
  });
});

describe("admin-sidebar — ช่องค้นหาเมนู (#ad-sidebar-search)", () => {
  const search = () => document.getElementById("ad-sidebar-search");

  test("พิมพ์คำว่างเปล่า (แค่เว้นวรรค) → ทุกแท็บ/กลุ่มแสดงครบ ไม่มีอะไรถูกซ่อน", () => {
    search().value = "   ";
    search().dispatchEvent(new window.Event("input", { bubbles: true }));
    ALL_TAB_IDS.forEach(id => {
      assert.equal(document.getElementById("ad-tabbtn-" + id).classList.contains("ad-nav-hidden"), false);
    });
  });

  test("ค้นหาด้วย label ตรงๆ (case-insensitive) → เจอเฉพาะแท็บนั้น แท็บอื่นถูกซ่อน", () => {
    search().value = "สินค้า";
    search().dispatchEvent(new window.Event("input", { bubbles: true }));
    assert.equal(document.getElementById("ad-tabbtn-products").classList.contains("ad-nav-hidden"), false);
    assert.equal(document.getElementById("ad-tabbtn-orders").classList.contains("ad-nav-hidden"), true);
  });

  test("ค้นหาด้วยคำพ้อง (synonym) ที่ไม่ตรงกับ label เป๊ะๆ เช่น 'แดชบอร์ด' แทน 'ภาพรวม'", () => {
    search().value = "แดชบอร์ด";
    search().dispatchEvent(new window.Event("input", { bubbles: true }));
    assert.equal(document.getElementById("ad-tabbtn-overview").classList.contains("ad-nav-hidden"), false);
    assert.equal(document.getElementById("ad-tabbtn-orders").classList.contains("ad-nav-hidden"), true);
  });

  test("ค้นหาด้วยคำอังกฤษ (เช่น 'quote' → แท็บลีด ที่มีคำพ้อง 'ใบเสนอราคา'/'quote')", () => {
    search().value = "quote";
    search().dispatchEvent(new window.Event("input", { bubbles: true }));
    assert.equal(document.getElementById("ad-tabbtn-leads").classList.contains("ad-nav-hidden"), false);
  });

  test("ค้นหาหลาย token คั่นด้วยเว้นวรรค (AND ข้าม token) เช่น 'ลีด ผู้สนใจ' เจอแท็บ leads", () => {
    search().value = "ลีด ผู้สนใจ";
    search().dispatchEvent(new window.Event("input", { bubbles: true }));
    assert.equal(document.getElementById("ad-tabbtn-leads").classList.contains("ad-nav-hidden"), false);
  });

  test("ค้นหาคำที่ไม่มีในระบบเลย → ทุกแท็บถูกซ่อนหมด และทุกกลุ่มถูกซ่อนหมด (ไม่มี anyVisible)", () => {
    search().value = "xyzxyznotfound";
    search().dispatchEvent(new window.Event("input", { bubbles: true }));
    ALL_TAB_IDS.forEach(id => {
      assert.equal(document.getElementById("ad-tabbtn-" + id).classList.contains("ad-nav-hidden"), true);
    });
    tabsBox.querySelectorAll(".cp-sidebar-group").forEach(g => {
      assert.equal(g.classList.contains("ad-nav-hidden"), true);
    });
  });

  test("กลุ่มที่มีอย่างน้อย 1 แท็บผ่านเงื่อนไข ไม่ถูกซ่อนทั้งกลุ่ม แม้แท็บอื่นในกลุ่มเดียวกันจะถูกซ่อน", () => {
    search().value = "สินค้า"; // เจอแค่ products ในกลุ่ม 2 (orders/products/categories)
    search().dispatchEvent(new window.Event("input", { bubbles: true }));
    const group2 = document.getElementById("ad-tabbtn-products").closest(".cp-sidebar-group");
    assert.equal(group2.classList.contains("ad-nav-hidden"), false);
  });

  test("ล้างช่องค้นหากลับเป็นว่างเปล่า → ทุกอย่างกลับมาแสดงครบเหมือนเดิม", () => {
    search().value = "xyzxyznotfound";
    search().dispatchEvent(new window.Event("input", { bubbles: true }));
    search().value = "";
    search().dispatchEvent(new window.Event("input", { bubbles: true }));
    ALL_TAB_IDS.forEach(id => {
      assert.equal(document.getElementById("ad-tabbtn-" + id).classList.contains("ad-nav-hidden"), false);
    });
  });
});
