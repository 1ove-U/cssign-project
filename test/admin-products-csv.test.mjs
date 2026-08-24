// test/admin-products-csv.test.mjs — รอบที่ 121
//
// ขอบเขต: js/admin-products-csv.js (220 บรรทัด) — ผูก event listener ของตัวเองตอนโหลดไฟล์
// (ไม่ export อะไรให้ไฟล์อื่นใช้เลย) แบ่งเป็น 2 ส่วน:
//   1) Export: ปุ่ม "ส่งออก CSV" (#ad-p-export-btn) + ปุ่ม "ดาวน์โหลดเทมเพลต" (#ad-p-import-template-btn)
//      ทั้งคู่เรียก downloadCsv() จาก admin-utils.js (มีเทสคลุมแยกต่างหากแล้วผ่าน
//      test/orders-tab-export.test.mjs รอบ 97 ที่ทดสอบ pattern เดียวกันของไฟล์อื่น — รอบนี้
//      โฟกัสที่ productToCsvRow()/exampleRow ภายในไฟล์นี้เอง ไม่ใช่ downloadCsv() เอง)
//   2) Import: เลือกไฟล์ (#ad-p-import-file) -> parseCSV()+parseProductImportRows() (private
//      ทั้งคู่) -> renderImportPreview() -> เปิด overlay ตรวจสอบ -> ปุ่มยืนยัน (#ad-p-import-confirm)
//      -> saveProduct() ทีละ chunk 15 รายการผ่าน Promise.allSettled -> logAudit()+showToast()+
//      reloadAll()
//
// **จุดที่พันกันซับซ้อนกว่าไฟล์กลุ่มเดียวกันรอบก่อนๆ (ต้องแก้ infra เทสก่อนเริ่มได้จริง)**:
// ไฟล์นี้ import { reloadAll } from "./admin-page.js" ตรงๆ เหมือนกลุ่ม portfolio-form/
// products-form/groups/... (ใช้ admin-page-stub-loader.mjs เดิม — เพิ่ม "products-csv" เข้า
// ALLOWED_PARENT_RE รอบนี้) แต่ "ยังมีอีกจุด" ที่ไฟล์กลุ่มก่อนไม่เจอ: import { ovFormatBaht }
// from "./admin-overview-dashboard.js" ตรงๆ ด้วย — ไฟล์นั้นดึงทั้งแอปตามมา (allLeads จาก
// admin-leads.js, switchTab จาก admin-page.js, openProductModal จาก admin-products.js, 4
// ฟังก์ชันจาก admin-overview-detail-cards.js, admin-overview-export.js แบบ side-effect) แล้ว
// circular กลับเข้า admin-page.js เอง (ที่ import "./admin-products-csv.js" แบบ side-effect)
// สุดท้ายลากไปถึง admin-sidebar.js ที่พึ่ง localStorage (jsdom ไม่มีให้) — ยืนยันด้วยการลอง
// import ไฟล์นี้ตรงๆ ก่อนเขียนสตับ (เจอ ReferenceError จริง) จึงสร้าง
// test/helpers/admin-overview-dashboard-stub-loader.mjs ใหม่ (stub ทั้งโมดูลด้วย ovFormatBaht()
// เวอร์ชัน hardcode สูตรเดียวกับของจริง ดักเฉพาะ parentURL ของไฟล์นี้เท่านั้น — ดูรายละเอียด/
// ความเสี่ยงเรื่อง sync สูตรในอนาคตในไฟล์นั้น) — หลังเพิ่ม 2 จุดนี้ (ALLOWED_PARENT_RE +
// stub ใหม่ + ลงทะเบียนใน register-loader.mjs) import ไฟล์นี้ตรงๆ ผ่านแล้วไม่มี error
//
// **infra เทสอีกจุดที่ต้องเพิ่ม**: addDoc()/updateDoc() เดิมใน firebase-stub-loader.mjs resolve()
// เฉยๆ เสมอ ไม่มีทางจำลอง "ล้มเหลว" ได้เลย (Promise.allSettled ในปุ่มยืนยันนำเข้าจะไม่มีทาง reject
// สักตัว) — เพิ่ม globalThis.__ADD_DOC_STUB__/__UPDATE_DOC_STUB__ (optional hook, ไม่ตั้ง = พฤติกรรม
// เดิม 100%) เพื่อทดสอบเคส "นำเข้าบางรายการล้มเหลว" — ดูรายละเอียดในไฟล์นั้น
//
// ตรวจโค้ดจริงทั้งไฟล์ js/admin-products-csv.js ก่อนเขียนเทสนี้ (อ่านครบ) — ไม่พบบั๊ก จึงเป็น
// ไฟล์เทสล้วนๆ ไม่มีการแก้โค้ดผลิตภัณฑ์เลยแม้แต่บรรทัดเดียว (ไฟล์ที่แก้มีแค่ test/helpers/*
// ซึ่งเป็นโครงสร้างพื้นฐานของเทส ไม่ใช่โค้ดผลิตภัณฑ์)

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

let document;
let setAllProducts, setAllCategories;

const SAMPLE_CATEGORIES = [
  { id: "cat-a", name: "ความปลอดภัย" },
  { id: "cat-b", name: "จราจร" },
];

const SAMPLE_PRODUCTS = [
  {
    id: "prod-1", code: "SG-001", name: "ป้ายทางหนีไฟ", cat_id: "cat-a", price: 350,
    unit: "แผ่น", material: "อลูมิเนียม", size: "30x40 ซม.", description: "ป้ายบอกทางหนีไฟ",
    status: "active", featured: true, slug: "pai-thang-ni-fai",
    metaTitle: "ป้ายทางหนีไฟ", metaDescription: "คุณภาพสูง",
    images: ["https://res.cloudinary.com/x/a.jpg"], optionAxes: [{ name: "ขนาด" }], variants: [{ price: 350 }], tags: ["fire"],
  },
  {
    id: "prod-2", code: "", name: "ป้ายไม่มีรหัส", cat_id: "cat-b", price: 0,
    unit: "", material: "", size: "", description: "",
    status: "hidden", featured: false, slug: "", metaTitle: "", metaDescription: "",
    images: [], optionAxes: [], variants: [], tags: [],
  },
  {
    id: "prod-3", code: "SG-003", name: "ป้ายไม่มีหมวดหมู่", cat_id: "cat-x", price: null,
    unit: "ชิ้น", material: "เหล็ก", size: "20x20", description: "",
    featured: false, slug: "", metaTitle: "", metaDescription: "",
    images: [], optionAxes: [], variants: [], tags: [],
    // ไม่มี status เลย -> fallback "active" ในผลลัพธ์ export
  },
];

const PRODUCT_CSV_HEADERS = [
  "รหัสสินค้า (code)", "ชื่อสินค้า", "หมวดหมู่", "ราคา", "หน่วย", "วัสดุ", "ขนาด",
  "รายละเอียด", "สถานะ (active/hidden)", "แนะนำ (ใช่/ไม่ใช่)", "slug", "Meta Title", "Meta Description"
];
function csvCell(v) { return `"${String(v ?? "").replace(/"/g, '""')}"`; }
function csvRow(cells) { return cells.map(csvCell).join(","); }

// ── สอดแนม Blob / URL.createObjectURL / <a>.click() (ของจริงจาก Node global — เหมือน
// test/orders-tab-export.test.mjs รอบ 97 ทุกประการ) ──
let lastBlobParts, lastBlobRef;
let anchorClickCount, lastAnchor;
const OriginalBlob = globalThis.Blob;
const originalCreateObjectURL = globalThis.URL.createObjectURL.bind(globalThis.URL);
const originalRevokeObjectURL = globalThis.URL.revokeObjectURL.bind(globalThis.URL);

function resetFirebaseCalls() {
  globalThis.__ADD_DOC_CALLS__ = [];
  globalThis.__UPDATE_DOC_CALLS__ = [];
  globalThis.__ADD_DOC_STUB__ = undefined;
  globalThis.__UPDATE_DOC_STUB__ = undefined;
}
function resetReloadAllSpy() {
  globalThis.__AD_PAGE_STUB_RELOAD_ALL_CALLS__ = [];
  globalThis.__AD_PAGE_STUB_RELOAD_ALL__ = (...args) => {
    globalThis.__AD_PAGE_STUB_RELOAD_ALL_CALLS__.push(args);
  };
}

before(async () => {
  const dom = new JSDOM(`<!doctype html><html><body>${ADMIN_BODY_NO_SCRIPTS}</body></html>`, {
    url: "https://example.test/"
  });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Event = dom.window.Event;
  globalThis.MouseEvent = dom.window.MouseEvent;
  document = dom.window.document;

  dom.window.HTMLAnchorElement.prototype.click = function () { anchorClickCount++; };
  const originalCreateElement = dom.window.document.createElement.bind(dom.window.document);
  dom.window.document.createElement = function (tag) {
    const el = originalCreateElement(tag);
    if (String(tag).toLowerCase() === "a") lastAnchor = el;
    return el;
  };

  ({ setAllProducts, setAllCategories } = await import("../js/admin-state.js"));
  await import("../js/admin-products-csv.js"); // side-effect เท่านั้น (ผูก listener ตอนโหลด)
});

beforeEach(() => {
  resetFirebaseCalls();
  resetReloadAllSpy();
  setAllProducts(SAMPLE_PRODUCTS.map(p => ({ ...p })));
  setAllCategories(SAMPLE_CATEGORIES.map(c => ({ ...c })));

  // ปิด overlay/toast ที่อาจค้างจากเทสก่อนหน้า
  const importOverlay = document.getElementById("ad-p-import-overlay");
  if (importOverlay.style.display === "flex") {
    document.getElementById("ad-p-import-cancel").click();
  }
  document.querySelectorAll(".cp-toast-wrap .cp-toast").forEach(el => el.remove());

  lastBlobParts = lastBlobRef = null;
  anchorClickCount = 0;
  lastAnchor = null;
  class SpyBlob extends OriginalBlob {
    constructor(parts, opts) { super(parts, opts); lastBlobParts = parts; lastBlobRef = this; }
  }
  globalThis.Blob = SpyBlob;
  globalThis.URL.createObjectURL = (blob) => originalCreateObjectURL(blob);
  globalThis.URL.revokeObjectURL = (url) => originalRevokeObjectURL(url);
});

function lastToast(kind) {
  const els = document.querySelectorAll(`.cp-toast-wrap .cp-toast.${kind}`);
  return els.length ? els[els.length - 1] : null;
}
function todayIso() { return new Date().toISOString().slice(0, 10); }
function blobBody() {
  assert.ok(lastBlobParts, "ต้องมี Blob ถูกสร้าง");
  const raw = lastBlobParts[0];
  assert.equal(raw.charCodeAt(0), 0xFEFF, "ต้องมี BOM นำหน้า (จาก downloadCsv() ใน admin-utils.js)");
  return raw.slice(1).split("\r\n");
}

// ── ทำ File ปลอมสำหรับยิง event change บน input[type=file] (Node's global File รองรับ .text()
// จริง — ยืนยันแล้วก่อนเขียนไฟล์นี้ว่า Blob.prototype.text()/File ของ Node ใช้ได้ตรงๆ ไม่ต้อง stub) ──
function setInputFile(el, file) {
  Object.defineProperty(el, "files", { value: file ? [file] : [], configurable: true });
}
async function importFile(text) {
  const input = document.getElementById("ad-p-import-file");
  setInputFile(input, new File([text], "products.csv", { type: "text/csv" }));
  input.dispatchEvent(new Event("change"));
  await flushMicrotasks();
}
// ต้องรอ microtask หลายรอบ (await file.text() ข้างในตัว handler เอง) ก่อนที่ DOM จะอัปเดตจริง
function flushMicrotasks() { return new Promise(resolve => setTimeout(resolve, 0)); }

describe("js/admin-products-csv.js — ปุ่มส่งออกสินค้าทั้งหมดเป็น CSV (#ad-p-export-btn) (รอบที่ 121)", () => {
  function exportCsv() { document.getElementById("ad-p-export-btn").click(); }

  test("allProducts ว่างเปล่า -> Blob มีแค่ header row, ไฟล์ชื่อ products-YYYY-MM-DD.csv", () => {
    setAllProducts([]);
    exportCsv();
    const lines = blobBody();
    assert.equal(lines.length, 1);
    assert.equal(lines[0], PRODUCT_CSV_HEADERS.join(","));
    assert.equal(lastAnchor.download, `products-${todayIso()}.csv`);
  });

  test("แถวข้อมูลครบ (prod-1) -> ทุกคอลัมน์ตรงตามสูตร productToCsvRow(), featured=true -> \"ใช่\"", () => {
    exportCsv();
    const lines = blobBody();
    assert.equal(lines.length, 4); // header + 3 สินค้า
    assert.equal(lines[1], csvRow([
      "SG-001", "ป้ายทางหนีไฟ", "ความปลอดภัย", 350, "แผ่น", "อลูมิเนียม", "30x40 ซม.",
      "ป้ายบอกทางหนีไฟ", "active", "ใช่", "pai-thang-ni-fai", "ป้ายทางหนีไฟ", "คุณภาพสูง"
    ]));
  });

  test("price=0 -> คอลัมน์ราคาแสดง \"0\" ไม่ใช่ค่าว่าง (?? แค่กัน null/undefined ไม่กัน 0), featured=false -> \"ไม่ใช่\", code ว่าง fallback \"\"", () => {
    exportCsv();
    const lines = blobBody();
    assert.equal(lines[2], csvRow(["", "ป้ายไม่มีรหัส", "จราจร", 0, "", "", "", "", "hidden", "ไม่ใช่", "", "", ""]));
  });

  test("price=null + ไม่มี status + cat_id ไม่ตรงหมวดหมู่ไหนเลย -> ราคาว่าง, status fallback \"active\", หมวดหมู่ \"ไม่มีหมวดหมู่\"", () => {
    exportCsv();
    const lines = blobBody();
    assert.equal(lines[3], csvRow(["SG-003", "ป้ายไม่มีหมวดหมู่", "ไม่มีหมวดหมู่", "", "ชิ้น", "เหล็ก", "20x20", "", "active", "ไม่ใช่", "", "", ""]));
  });

  test("เรียงแถวตามลำดับ allProducts เป๊ะๆ ไม่ sort เอง", () => {
    setAllProducts([SAMPLE_PRODUCTS[2], SAMPLE_PRODUCTS[0]].map(p => ({ ...p })));
    exportCsv();
    const lines = blobBody();
    assert.equal(lines.length, 3);
    assert.ok(lines[1].startsWith('"SG-003"'));
    assert.ok(lines[2].startsWith('"SG-001"'));
  });
});

describe("js/admin-products-csv.js — ปุ่มดาวน์โหลดเทมเพลตนำเข้า (#ad-p-import-template-btn) (รอบที่ 121)", () => {
  function downloadTemplate() { document.getElementById("ad-p-import-template-btn").click(); }

  test("ชื่อไฟล์คงที่ \"products-import-template.csv\" (ไม่มีวันที่ต่อท้ายต่างจากปุ่ม export)", () => {
    downloadTemplate();
    assert.equal(lastAnchor.download, "products-import-template.csv");
  });

  test("แถวตัวอย่าง 1 แถว ใช้ allCategories[0].name เมื่อมีหมวดหมู่จริง", () => {
    downloadTemplate();
    const lines = blobBody();
    assert.equal(lines.length, 2);
    assert.equal(lines[0], PRODUCT_CSV_HEADERS.join(","));
    assert.equal(lines[1], csvRow([
      "SIGN-001", "ป้ายทางหนีไฟ", "ความปลอดภัย", "350", "ชิ้น", "อลูมิเนียมคอมโพสิต", "30x40 ซม.",
      "ป้ายบอกทางหนีไฟ สะท้อนแสง มองเห็นชัดเจนในที่มืด", "active", "ไม่ใช่", "", "", ""
    ]));
  });

  test("allCategories ว่างเปล่า -> fallback ชื่อหมวดหมู่ \"ความปลอดภัย\" แบบ hardcode", () => {
    setAllCategories([]);
    downloadTemplate();
    const lines = blobBody();
    assert.ok(lines[1].includes('"ความปลอดภัย"'));
  });
});

describe("js/admin-products-csv.js — เลือกไฟล์นำเข้า (#ad-p-import-file change) + preview (รอบที่ 121)", () => {
  function overlay() { return document.getElementById("ad-p-import-overlay"); }
  function summary() { return document.getElementById("ad-p-import-summary").textContent; }
  function tbody() { return document.getElementById("ad-p-import-table-body"); }
  function confirmBtn() { return document.getElementById("ad-p-import-confirm"); }
  const HEADER = "code,name,cat,price,unit,material,size,description,status,featured,slug,metaTitle,metaDesc";

  test("ไม่ได้เลือกไฟล์เลย (files[0] undefined) -> ไม่เปิด overlay ไม่ทำอะไร", async () => {
    const input = document.getElementById("ad-p-import-file");
    setInputFile(input, null);
    input.dispatchEvent(new Event("change"));
    await flushMicrotasks();
    assert.notEqual(overlay().style.display, "flex");
  });

  test("input.value ถูกเคลียร์เป็น \"\" เสมอหลังเลือกไฟล์ (กันเลือกไฟล์เดิมซ้ำไม่เกิด change event)", async () => {
    const input = document.getElementById("ad-p-import-file");
    setInputFile(input, new File(["a"], "x.csv"));
    input.dispatchEvent(new Event("change"));
    await flushMicrotasks();
    assert.equal(input.value, "");
  });

  test("ไฟล์มีแค่ header ไม่มีข้อมูล -> summary ข้อความ \"ไม่พบข้อมูลสินค้าในไฟล์นี้...\", ปุ่มยืนยัน disabled", async () => {
    await importFile(HEADER);
    assert.match(summary(), /ไม่พบข้อมูลสินค้าในไฟล์นี้/);
    assert.equal(confirmBtn().disabled, true);
    assert.equal(overlay().style.display, "flex", "ยังต้องเปิด overlay แม้ไม่มีข้อมูล");
  });

  test("แถวใหม่ (code ไม่ตรงของเดิม) -> badge \"เพิ่มใหม่\", summary นับถูกต้อง", async () => {
    const row = csvRow(["SG-NEW", "ป้ายใหม่", "ความปลอดภัย", "100", "ชิ้น", "", "", "", "active", "", "", "", ""]);
    await importFile(HEADER + "\n" + row);
    assert.match(summary(), /พบทั้งหมด 1 แถว.*เพิ่มใหม่ 1 รายการ.*อัปเดตของเดิม 0 รายการ.*ข้าม 0 รายการ/);
    assert.match(tbody().innerHTML, /ad-import-status new">เพิ่มใหม่/);
    assert.equal(confirmBtn().disabled, false);
    assert.equal(confirmBtn().textContent, "ยืนยันนำเข้า (1 รายการ)");
  });

  test("แถวจับคู่ code เดิมได้ (case-insensitive) -> badge \"จะอัปเดต\"", async () => {
    const row = csvRow(["sg-001", "ป้ายทางหนีไฟ (แก้)", "ความปลอดภัย", "100", "", "", "", "", "active", "", "", "", ""]);
    await importFile(HEADER + "\n" + row);
    assert.match(summary(), /อัปเดตของเดิม 1 รายการ/);
    assert.match(tbody().innerHTML, /ad-import-status update">จะอัปเดต/);
  });

  test("ไม่มีชื่อสินค้า -> error \"ไม่มีชื่อสินค้า...\" -> badge \"ข้าม\"", async () => {
    const row = csvRow(["SG-X", "", "ความปลอดภัย", "100", "", "", "", "", "active", "", "", "", ""]);
    await importFile(HEADER + "\n" + row);
    assert.match(summary(), /ข้าม 1 รายการ/);
    assert.match(tbody().innerHTML, /ไม่มีชื่อสินค้า/);
    assert.match(tbody().innerHTML, /ad-import-status error">ข้าม/);
  });

  test("ราคาไม่ใช่ตัวเลข -> error \"ราคาต้องเป็นตัวเลขไม่ติดลบ\"", async () => {
    const row = csvRow(["SG-X", "ป้าย", "ความปลอดภัย", "abc", "", "", "", "", "active", "", "", "", ""]);
    await importFile(HEADER + "\n" + row);
    assert.match(tbody().innerHTML, /ราคาต้องเป็นตัวเลขไม่ติดลบ/);
  });

  test("ราคาติดลบ -> error เดียวกัน, ราคาว่างเปล่า -> ไม่ error (ไม่ตรวจถ้าไม่กรอก)", async () => {
    const rowNeg = csvRow(["SG-X", "ป้าย", "ความปลอดภัย", "-5", "", "", "", "", "active", "", "", "", ""]);
    await importFile(HEADER + "\n" + rowNeg);
    assert.match(tbody().innerHTML, /ราคาต้องเป็นตัวเลขไม่ติดลบ/);

    const rowEmpty = csvRow(["SG-X", "ป้าย", "ความปลอดภัย", "", "", "", "", "", "active", "", "", "", ""]);
    await importFile(HEADER + "\n" + rowEmpty);
    assert.doesNotMatch(tbody().innerHTML, /ราคาต้องเป็นตัวเลขไม่ติดลบ/);
  });

  test("หมวดหมู่ระบุแต่ไม่ตรงชื่อไหนเลย -> error ระบุชื่อที่พิมพ์มา, หมวดหมู่ว่างเปล่า -> error \"ไม่ได้ระบุหมวดหมู่\"", async () => {
    const rowUnknown = csvRow(["SG-X", "ป้าย", "หมวดไม่มีจริง", "1", "", "", "", "", "active", "", "", "", ""]);
    await importFile(HEADER + "\n" + rowUnknown);
    // หมายเหตุ: escapeHtml() แปลง " เป็น &quot; ในสตริงจริง แต่เมื่อเซ็ตผ่าน innerHTML แล้วอ่านกลับ
    // ออกมา เครื่องหมายคำพูดใน text content (ไม่ใช่ attribute) ไม่จำเป็นต้อง re-escape ตามสเปก HTML
    // จึงเห็นเป็น " ตรงๆ ตอนอ่าน .innerHTML กลับ (ไม่ใช่บั๊ก escapeHtml — ปลอดภัยเพราะไม่ได้อยู่ใน
    // attribute context ที่จะหลุดออกมาได้)
    assert.match(tbody().innerHTML, /ไม่พบหมวดหมู่ "หมวดไม่มีจริง"/);

    const rowEmpty = csvRow(["SG-X", "ป้าย", "", "1", "", "", "", "", "active", "", "", "", ""]);
    await importFile(HEADER + "\n" + rowEmpty);
    assert.match(tbody().innerHTML, /ไม่ได้ระบุหมวดหมู่/);
  });

  test("สถานะไม่ใช่ active/hidden -> error, สถานะว่างเปล่า -> fallback \"active\" ไม่ error", async () => {
    const rowBad = csvRow(["SG-X", "ป้าย", "ความปลอดภัย", "1", "", "", "", "", "แปลกๆ", "", "", "", ""]);
    await importFile(HEADER + "\n" + rowBad);
    assert.match(tbody().innerHTML, /สถานะต้องเป็น/);

    const rowEmpty = csvRow(["SG-Y", "ป้าย2", "ความปลอดภัย", "1", "", "", "", "", "", "", "", "", ""]);
    await importFile(HEADER + "\n" + rowEmpty);
    assert.doesNotMatch(tbody().innerHTML, /สถานะต้องเป็น/);
    assert.match(tbody().innerHTML, /ad-import-status new">เพิ่มใหม่/);
  });

  test("คอลัมน์ \"แนะนำ\": \"ใช่\"/\"yes\"/\"true\"/\"1\" (ไม่สนตัวพิมพ์เล็กใหญ่) -> ถือว่าแนะนำ, ค่าอื่น -> ไม่แนะนำ (ยืนยันทางอ้อมผ่าน payload ตอนกดยืนยันนำเข้า)", async () => {
    const rows = ["YES", "TRUE", "1", "ใช่", "ไม่ใช่", "", "อื่นๆ"].map((v, i) =>
      csvRow([`SG-F${i}`, `ป้าย${i}`, "ความปลอดภัย", "1", "", "", "", "", "active", v, "", "", ""])
    );
    await importFile(HEADER + "\n" + rows.join("\n"));
    document.getElementById("ad-p-import-confirm").click();
    await flushMicrotasks();
    const payloads = globalThis.__ADD_DOC_CALLS__.map(c => c.payload);
    assert.deepEqual(payloads.slice(0, 4).map(p => p.featured), [true, true, true, true]);
    assert.deepEqual(payloads.slice(4).map(p => p.featured), [false, false, false]);
  });

  test("ตัด BOM นำหน้าไฟล์ออกก่อน parse (แถวหัวคอลัมน์ไม่เพี้ยน)", async () => {
    const row = csvRow(["SG-X", "ป้าย", "ความปลอดภัย", "1", "", "", "", "", "active", "", "", "", ""]);
    await importFile("\uFEFF" + HEADER + "\n" + row);
    assert.match(summary(), /เพิ่มใหม่ 1 รายการ/);
    assert.doesNotMatch(summary(), /ข้าม 1/);
  });

  test("ฟิลด์รายละเอียดมีจุลภาค/ขึ้นบรรทัดใหม่ในเครื่องหมายคำพูด -> parse ไม่พังเป็นหลายแถว", async () => {
    const descWithComma = 'มีจุลภาค, และ\nขึ้นบรรทัดใหม่ด้วย';
    const row = csvRow(["SG-X", "ป้าย", "ความปลอดภัย", "1", "", "", "", descWithComma, "active", "", "", "", ""]);
    await importFile(HEADER + "\n" + row);
    assert.match(summary(), /พบทั้งหมด 1 แถว/, "ต้องยังนับเป็น 1 แถวข้อมูล ไม่ใช่หลายแถวเพราะจุลภาค/ขึ้นบรรทัดใหม่ในเครื่องหมายคำพูด");
  });

  test("escapeHtml กัน XSS ในตาราง preview (ชื่อสินค้า/ข้อความ error มี markup แปลกปลอม)", async () => {
    const row = csvRow(['<img src=x onerror=alert(1)>SG-X', '<script>bad</script>', "ความปลอดภัย", "1", "", "", "", "", "active", "", "", "", ""]);
    await importFile(HEADER + "\n" + row);
    assert.doesNotMatch(tbody().innerHTML, /<script>bad<\/script>/);
    assert.match(tbody().innerHTML, /&lt;script&gt;bad&lt;\/script&gt;/);
  });

  test("อ่านไฟล์ไม่สำเร็จ (file.text() reject) -> showToast error ข้อความมี err.message, ไม่เปิด overlay", async () => {
    const input = document.getElementById("ad-p-import-file");
    const fakeFile = { text: () => Promise.reject(new Error("อ่านไฟล์เสีย")) };
    setInputFile(input, fakeFile);
    input.dispatchEvent(new Event("change"));
    await flushMicrotasks();
    const t = lastToast("error");
    assert.ok(t);
    assert.match(t.textContent, /อ่านไฟล์ไม่สำเร็จ.*อ่านไฟล์เสีย/);
    assert.notEqual(overlay().style.display, "flex");
  });
});

describe("js/admin-products-csv.js — ปุ่มยกเลิก/backdrop click ของ overlay ตรวจสอบนำเข้า (รอบที่ 121)", () => {
  const HEADER = "code,name,cat,price,unit,material,size,description,status,featured,slug,metaTitle,metaDesc";
  function overlay() { return document.getElementById("ad-p-import-overlay"); }

  async function openWithOneRow() {
    const row = csvRow(["SG-X", "ป้าย", "ความปลอดภัย", "1", "", "", "", "", "active", "", "", "", ""]);
    await importFile(HEADER + "\n" + row);
  }

  test("ปุ่ม \"ยกเลิก\" -> ปิด overlay + เคลียร์ pendingImportRows (ยืนยันทางอ้อม: เปิดใหม่ด้วยไฟล์อื่นแล้วยืนยันนำเข้า ไม่มีรายการเก่าปนมา)", async () => {
    await openWithOneRow();
    document.getElementById("ad-p-import-cancel").click();
    assert.equal(overlay().style.display, "none");
  });

  test("backdrop click (target === overlay เอง) -> ปิดเหมือนปุ่มยกเลิก", async () => {
    await openWithOneRow();
    overlay().dispatchEvent(new Event("click", { bubbles: true }));
    assert.equal(overlay().style.display, "none");
  });

  test("คลิกจุดอื่นในโมดัล (ไม่ใช่ backdrop เอง) -> ไม่ปิด", async () => {
    await openWithOneRow();
    document.getElementById("ad-p-import-summary").dispatchEvent(new Event("click", { bubbles: true }));
    assert.equal(overlay().style.display, "flex");
    document.getElementById("ad-p-import-cancel").click(); // เคลียร์ท้ายเทส
  });
});

describe("js/admin-products-csv.js — ปุ่มยืนยันนำเข้า (#ad-p-import-confirm) (รอบที่ 121)", () => {
  const HEADER = "code,name,cat,price,unit,material,size,description,status,featured,slug,metaTitle,metaDesc";
  function overlay() { return document.getElementById("ad-p-import-overlay"); }
  function confirmBtn() { return document.getElementById("ad-p-import-confirm"); }

  test("ทุกแถวมี error ทั้งหมด -> rowsToImport ว่างเปล่า -> return ก่อน ไม่มี saveProduct() เรียกเลย ปุ่มไม่ถูก disable", async () => {
    const row = csvRow(["SG-X", "", "ความปลอดภัย", "1", "", "", "", "", "active", "", "", "", ""]); // ไม่มีชื่อ -> error
    await importFile(HEADER + "\n" + row);
    confirmBtn().click();
    await flushMicrotasks();
    assert.deepEqual(globalThis.__ADD_DOC_CALLS__, []);
    assert.deepEqual(globalThis.__UPDATE_DOC_CALLS__, []);
    document.getElementById("ad-p-import-cancel").click();
  });

  test("แถวใหม่ (ไม่มี existingId) -> addDoc() พร้อม images/optionAxes/variants/tags เป็น [] ทั้งหมด", async () => {
    const row = csvRow(["SG-NEW", "ป้ายใหม่", "ความปลอดภัย", "99", "ชิ้น", "ไม้", "10x10", "รายละเอียด", "hidden", "ใช่", "slug-x", "mt", "md"]);
    await importFile(HEADER + "\n" + row);
    confirmBtn().click();
    await flushMicrotasks();

    assert.equal(globalThis.__ADD_DOC_CALLS__.length, 1);
    assert.equal(globalThis.__UPDATE_DOC_CALLS__.length, 0);
    const p = globalThis.__ADD_DOC_CALLS__[0].payload;
    assert.equal(p.id, undefined);
    assert.equal(p.name, "ป้ายใหม่");
    assert.equal(p.code, "SG-NEW");
    assert.equal(p.cat_id, "cat-a", "r.catId (จับคู่จากชื่อ 'ความปลอดภัย') ต้องถูกส่งเป็น cat_id เข้า saveProduct()");
    assert.equal(p.status, "hidden");
    assert.equal(p.featured, true);
    assert.deepEqual(p.images, []);
    assert.deepEqual(p.optionAxes, []);
    assert.deepEqual(p.variants, []);
    assert.deepEqual(p.tags, []);
  });

  test("แถวจับคู่ code เดิม (SG-001) -> updateDoc() พร้อมส่ง images/optionAxes/variants/tags ของเดิมกลับไปด้วย (กันหายตอน saveProduct เขียนทับทั้งเอกสาร)", async () => {
    const row = csvRow(["sg-001", "ป้ายทางหนีไฟ (แก้ราคา)", "ความปลอดภัย", "500", "", "", "", "", "active", "", "", "", ""]);
    await importFile(HEADER + "\n" + row);
    confirmBtn().click();
    await flushMicrotasks();

    assert.equal(globalThis.__UPDATE_DOC_CALLS__.length, 1);
    assert.equal(globalThis.__ADD_DOC_CALLS__.length, 0);
    assert.equal(globalThis.__UPDATE_DOC_CALLS__[0].path, "products/prod-1", "updateDoc(doc(db,\"products\",r.existingId), payload) — id อยู่ใน ref.path ไม่ใช่ใน payload เอง (saveProduct() ไม่ใส่ id ลง payload)");
    const p = globalThis.__UPDATE_DOC_CALLS__[0].payload;
    assert.equal(p.name, "ป้ายทางหนีไฟ (แก้ราคา)");
    assert.deepEqual(p.images, ["https://res.cloudinary.com/x/a.jpg"]);
    assert.deepEqual(p.optionAxes, [{ name: "ขนาด" }]);
    assert.deepEqual(p.variants, [{ price: 350 }]);
    assert.deepEqual(p.tags, ["fire"]);
  });

  test("นำเข้าสำเร็จทั้งหมด -> showToast success ข้อความ \"นำเข้าสำเร็จ N รายการ\", ปิด overlay, เคลียร์ pendingImportRows, ปุ่มกลับมา enable, reloadAll() ถูกเรียก 1 ครั้ง", async () => {
    const rows = [
      csvRow(["SG-A", "ป้าย A", "ความปลอดภัย", "1", "", "", "", "", "active", "", "", "", ""]),
      csvRow(["SG-B", "ป้าย B", "ความปลอดภัย", "1", "", "", "", "", "active", "", "", "", ""]),
    ];
    await importFile(HEADER + "\n" + rows.join("\n"));
    confirmBtn().click();
    await flushMicrotasks();

    const t = lastToast("success");
    assert.ok(t);
    assert.equal(t.textContent, "นำเข้าสำเร็จ 2 รายการ");
    assert.equal(overlay().style.display, "none");
    assert.equal(confirmBtn().disabled, false);
    assert.equal(globalThis.__AD_PAGE_STUB_RELOAD_ALL_CALLS__.length, 1);
  });

  test("นำเข้าบางรายการล้มเหลว (__UPDATE_DOC_STUB__ จำลอง reject) -> showToast error ข้อความมีทั้งสำเร็จ+ล้มเหลว", async () => {
    globalThis.__UPDATE_DOC_STUB__ = () => ({ throw: new Error("เขียนไม่สำเร็จ") });
    const rows = [
      csvRow(["SG-NEW-OK", "ป้ายใหม่ สำเร็จ", "ความปลอดภัย", "1", "", "", "", "", "active", "", "", "", ""]), // addDoc -> ไม่ throw
      csvRow(["sg-001", "ป้ายทางหนีไฟ แก้", "ความปลอดภัย", "1", "", "", "", "", "active", "", "", "", ""]),   // updateDoc -> throw
    ];
    await importFile(HEADER + "\n" + rows.join("\n"));
    confirmBtn().click();
    await flushMicrotasks();

    const t = lastToast("error");
    assert.ok(t);
    assert.equal(t.textContent, "นำเข้าสำเร็จ 1 รายการ, ล้มเหลว 1 รายการ");
    assert.equal(overlay().style.display, "none", "ปิด overlay เหมือนกันแม้มีบางรายการล้มเหลว");
  });

  test("logAudit() ถูกเรียกแต่ auth.currentUser เป็น null ตาม stub ค่าเริ่มต้น -> exit เงียบๆ ไม่มี addDoc(\"auditLog\") เกิดขึ้นจริง", async () => {
    const row = csvRow(["SG-A", "ป้าย A", "ความปลอดภัย", "1", "", "", "", "", "active", "", "", "", ""]);
    await importFile(HEADER + "\n" + row);
    confirmBtn().click();
    await flushMicrotasks();
    const auditCalls = globalThis.__ADD_DOC_CALLS__.filter(c => c.path === "auditLog");
    assert.deepEqual(auditCalls, []);
  });

  test("นำเข้า >15 รายการ -> แบ่งเป็น chunk ละ 15 (ยืนยันทางอ้อม: จำนวน addDoc() ทั้งหมดตรงกับจำนวนแถวเป๊ะ ไม่ตกหล่น/ซ้ำข้าม chunk)", async () => {
    const rows = Array.from({ length: 22 }, (_, i) =>
      csvRow([`SG-BULK-${i}`, `ป้าย ${i}`, "ความปลอดภัย", "1", "", "", "", "", "active", "", "", "", ""])
    );
    await importFile(HEADER + "\n" + rows.join("\n"));
    confirmBtn().click();
    await flushMicrotasks();
    await flushMicrotasks(); // 2 chunk (15+7) ต้องรอ tick เพิ่มให้ loop ทำครบ

    assert.equal(globalThis.__ADD_DOC_CALLS__.length, 22);
    const codes = globalThis.__ADD_DOC_CALLS__.map(c => c.payload.code).sort();
    const expected = rows.map((_, i) => `SG-BULK-${i}`).sort();
    assert.deepEqual(codes, expected);
  });
});
