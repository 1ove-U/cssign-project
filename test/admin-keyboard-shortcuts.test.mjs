// test/admin-keyboard-shortcuts.test.mjs — รอบที่ 117
//
// ขอบเขต: js/admin-keyboard-shortcuts.js (56 บรรทัด) — คีย์ลัดหน้าแอดมิน 2 ปุ่ม: "/" (โฟกัสช่อง
// ค้นหาของแท็บที่เปิดอยู่) และ "n"/"N" (คลิกปุ่มเพิ่มรายการใหม่ของแท็บที่เปิดอยู่) — ไฟล์นี้ไม่
// export อะไรเลย (ผูก document.addEventListener("keydown", ...) เองตอนโหลดไฟล์ครั้งแรก เหมือน
// admin-global-search.js/admin-overview-today.js) จึงเทสผ่านการ dispatch KeyboardEvent จริงแล้ว
// เช็ค side-effect บน DOM เท่านั้น
//
// ไฟล์นี้ import { app, activeTab } from "./admin-state.js" — โหลดเป็นโมดูลจริง ไม่ stub เพราะ
// admin-state.js เองไม่มีปัญหา bootstrap ทั้งแอปเหมือน admin-page.js (ประกาศตัวแปร/setter ล้วนๆ
// ไม่มี import อื่นเลยนอกจาก DOM global) — เทสเปลี่ยนแท็บที่ "เปิดอยู่" ผ่าน setActiveTab() จริง
// (activeTab เป็น live binding อัปเดตอัตโนมัติ อ่านจาก admin-keyboard-shortcuts.js ได้ทันที)
//
// TAB_SEARCH_INPUT / TAB_ADD_BUTTON เป็น object ตายตัวในไฟล์ (ไม่ export) แมปแท็บ →
// id ของ input ค้นหา/ปุ่มเพิ่ม — สังเกตว่า TAB_SEARCH_INPUT ไม่มี "faq" (แท็บนี้ไม่มีช่องค้นหาใน
// หน้าเดิม ตรงกับที่เจอตอนเทส admin-faq.js รอบ 110) — กด "/" ในแท็บนี้จึงไม่ต้องทำอะไร (ไม่มี id
// ให้หาเจอ ไม่ throw) — (เดิมยังมี "partners"/"testimonials" อยู่ในลิสต์นี้ด้วย แต่ทั้งสองแท็บถูก
// ลบออกจากระบบไปแล้วในรอบลบฟีเจอร์ "โลโก้ลูกค้า/รีวิวลูกค้า")
//
// เงื่อนไข guard 3 อย่างที่ทำให้คีย์ลัดไม่ทำงานเลย (เช็คก่อน key อะไรทั้งสิ้น): กด modifier key
// (metaKey/ctrlKey/altKey) ค้างอยู่, app.style.display === "none" (ยังไม่ได้ล็อกอิน), body มี
// class "cp-scroll-locked" (มี modal/dialog/global search เปิดอยู่แล้ว — class เดียวกับที่
// openOverlay()/closeOverlay() ใน admin-utils.js set/unset) — และเงื่อนไข "กำลังพิมพ์อยู่" แยก
// อีกชั้น (เช็ค document.activeElement เป็น INPUT/TEXTAREA/SELECT/contentEditable)
//
// ตรวจโค้ดจริงทั้งไฟล์ js/admin-keyboard-shortcuts.js ก่อนเขียนเทสนี้ (อ่านครบ 56 บรรทัด) —
// ไม่พบบั๊ก จึงเป็นไฟล์เทสล้วนๆ ไม่มีการแก้โค้ดผลิตภัณฑ์เลยแม้แต่บรรทัดเดียว ไม่ต้องแก้/สร้าง
// helper stub loader ใดๆ เพิ่ม (ไม่พึ่ง admin-page.js เลย)

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
let setActiveTab;
let app;

before(async () => {
  const dom = new JSDOM(`<!doctype html><html><body>${ADMIN_BODY_NO_SCRIPTS}</body></html>`);
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
  globalThis.KeyboardEvent = dom.window.KeyboardEvent;
  document = dom.window.document;

  ({ app, setActiveTab } = await import("../js/admin-state.js"));
  await import("../js/admin-keyboard-shortcuts.js"); // side-effect เท่านั้น ผูก listener ตอน import
});

beforeEach(() => {
  app.style.display = "flex"; // จำลองว่าล็อกอินแล้ว (ค่าเริ่มต้นในไฟล์จริงคือ display:none)
  document.body.classList.remove("cp-scroll-locked");
  setActiveTab("orders");
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  document.querySelectorAll("input, textarea").forEach((el) => { el.value = ""; });
});

function press(key, opts = {}) {
  const ev = new document.defaultView.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...opts });
  document.dispatchEvent(ev);
  return ev;
}

function field(id) { return document.getElementById(id); }

describe('คีย์ "/" — โฟกัสช่องค้นหาของแท็บที่เปิดอยู่', () => {
  test("แท็บ orders (cp-search) → โฟกัสช่องค้นหาจริง + preventDefault", () => {
    setActiveTab("orders");
    const ev = press("/");
    assert.equal(document.activeElement, field("cp-search"));
    assert.equal(ev.defaultPrevented, true);
  });

  test("แท็บ products (ad-p-search) → โฟกัสถูกช่อง", () => {
    setActiveTab("products");
    press("/");
    assert.equal(document.activeElement, field("ad-p-search"));
  });

  test("แท็บ leads (ad-l-search) → โฟกัสถูกช่อง", () => {
    setActiveTab("leads");
    press("/");
    assert.equal(document.activeElement, field("ad-l-search"));
  });

  test("แท็บ categories/portfolio/blog → โฟกัสถูกช่องตามแท็บ", () => {
    setActiveTab("categories");
    press("/");
    assert.equal(document.activeElement, field("ad-c-search"));

    field("ad-c-search").blur();
    setActiveTab("portfolio");
    press("/");
    assert.equal(document.activeElement, field("ad-pf-search"));

    field("ad-pf-search").blur();
    setActiveTab("blog");
    press("/");
    assert.equal(document.activeElement, field("ad-b-search"));
  });

  test("แท็บที่ไม่มีช่องค้นหา (faq) → ไม่ throw, ไม่มีอะไรถูกโฟกัส", () => {
    for (const tab of ["faq"]) {
      setActiveTab(tab);
      assert.doesNotThrow(() => press("/"));
      assert.notEqual(document.activeElement.tagName, "INPUT");
    }
  });

  test("แท็บที่ไม่รู้จักเลย (เช่น 'overview') → ไม่ throw", () => {
    setActiveTab("overview");
    assert.doesNotThrow(() => press("/"));
  });
});

describe('คีย์ "n"/"N" — คลิกปุ่มเพิ่มรายการของแท็บที่เปิดอยู่', () => {
  test("แท็บ orders (cp-add-btn) → ปุ่มถูกคลิกจริง + preventDefault", () => {
    let clicked = 0;
    field("cp-add-btn").addEventListener("click", () => { clicked++; });
    setActiveTab("orders");
    const ev = press("n");
    assert.equal(clicked, 1);
    assert.equal(ev.defaultPrevented, true);
  });

  test('ตัวพิมพ์ใหญ่ "N" ก็ทำงานเหมือนกัน', () => {
    let clicked = 0;
    field("ad-p-add-btn").addEventListener("click", () => { clicked++; });
    setActiveTab("products");
    press("N");
    assert.equal(clicked, 1);
  });

  test("แท็บ faq (มีปุ่มเพิ่มแต่ไม่มีช่องค้นหา) → ปุ่มถูกคลิกจริง", () => {
    const cases = [["faq", "ad-f-add-btn"]];
    for (const [tab, btnId] of cases) {
      let clicked = 0;
      const btn = field(btnId);
      const handler = () => { clicked++; };
      btn.addEventListener("click", handler);
      setActiveTab(tab);
      press("n");
      assert.equal(clicked, 1, `ปุ่มเพิ่มของแท็บ ${tab} ต้องถูกคลิก`);
      btn.removeEventListener("click", handler);
    }
  });

  test("แท็บที่ไม่มีปุ่มเพิ่มเลย (เช่น 'overview') → ไม่ throw", () => {
    setActiveTab("overview");
    assert.doesNotThrow(() => press("n"));
  });
});

describe("guard — เงื่อนไขที่ทำให้คีย์ลัดไม่ทำงานเลย", () => {
  test("ยังไม่ได้ล็อกอิน (app.style.display === 'none') → ไม่โฟกัส ไม่คลิก", () => {
    app.style.display = "none";
    let clicked = 0;
    field("cp-add-btn").addEventListener("click", () => { clicked++; });
    setActiveTab("orders");
    press("/");
    assert.notEqual(document.activeElement, field("cp-search"));
    press("n");
    assert.equal(clicked, 0);
  });

  test("body มี class cp-scroll-locked (มี modal เปิดอยู่) → ไม่โฟกัส", () => {
    document.body.classList.add("cp-scroll-locked");
    setActiveTab("orders");
    press("/");
    assert.notEqual(document.activeElement, field("cp-search"));
  });

  test("กด metaKey/ctrlKey/altKey ค้างอยู่ → ไม่ทำงานเลยแม้ key ตรง", () => {
    setActiveTab("orders");
    press("/", { metaKey: true });
    assert.notEqual(document.activeElement, field("cp-search"));
    press("/", { ctrlKey: true });
    assert.notEqual(document.activeElement, field("cp-search"));
    press("/", { altKey: true });
    assert.notEqual(document.activeElement, field("cp-search"));
  });

  test("กำลังพิมพ์อยู่ในช่อง input อื่น → ไม่ตัดคำที่พิมพ์อยู่ (ไม่สลับโฟกัส/ไม่คลิกปุ่มเพิ่ม)", () => {
    setActiveTab("orders");
    const otherInput = field("ad-p-search"); // ช่องของแท็บอื่น แต่ยังนับเป็น "กำลังพิมพ์"
    otherInput.focus();
    press("/");
    assert.equal(document.activeElement, otherInput, "โฟกัสต้องไม่ถูกแย่งไปช่องค้นหาของแท็บ orders");
    press("n");
    assert.equal(document.activeElement, otherInput);
  });

  test("กำลังพิมพ์อยู่ใน textarea → ไม่ทำงานเช่นกัน", () => {
    setActiveTab("orders");
    const textarea = document.querySelector("textarea");
    assert.ok(textarea, "ต้องมี textarea อย่างน้อยหนึ่งช่องในหน้า admin.html");
    textarea.focus();
    press("/");
    assert.equal(document.activeElement, textarea);
  });
});
