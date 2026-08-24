// test/admin-settings-promo.test.mjs — รอบที่ 119
//
// ขอบเขต: js/admin-settings-promo.js (129 บรรทัด) — แท็บ SETTINGS ย่อย "โปรโมชั่น & ข่าวอัพเดต
// ล่าสุด" (หน้าแรก) — เก็บเป็น settings.promoUpdates: [{ image, title, link }] อาร์เรย์สูงสุด
// PROMO_MAX=10 รูป — โครงคล้าย admin-settings-contact.js รอบ 116 (เอกสาร settings/main เดียวกัน,
// ไม่ import admin-page.js/admin-state.js เลย จึงไม่ต้องใช้ admin-page-stub-loader.mjs) แต่ต่างจาก
// รอบ 116 ตรงที่เป็นอาร์เรย์รูปภาพแก้ไขได้ทีละรายการ (ลบ/แก้ชื่อหัวข้อ-ลิงก์ต่อรูป) ไม่ใช่ฟอร์ม
// ข้อความล้วน — โครงสร้างคล้าย admin-settings-videos.js ตรงที่มีช่อง
// อัปโหลดรูปผ่าน db-media.js
//
// ไฟล์นี้ import saveSettings จาก db-settings.js + logAudit จาก db.js ตรงๆ (ทั้งคู่ import
// js/db.js ต่อ) จึงต้องพึ่ง test/helpers/firebase-stub-loader.mjs เหมือนรอบ 116 — saveSettings()
// เรียก setDoc() ของ stub ตรงๆ (บันทึกที่ globalThis.__SET_DOC_CALLS__) — logAudit() เช็ค
// auth.currentUser ก่อนเสมอ ซึ่ง stub คืน { currentUser: null } เป็นค่าเริ่มต้นเสมอ (ดู
// getAuth() ใน firebase-stub-loader.mjs) จึง logAudit() exit เงียบๆ ไม่มี addDoc("auditLog")
// เกิดขึ้นจริง — ยืนยันด้วย globalThis.__ADD_DOC_CALLS__.length === 0 แบบเดียวกับที่ทำไว้ใน
// test/orders-tab-modal-submit-flow.test.mjs รอบ 89
//
// **ไม่คลุม flow อัปโหลดไฟล์จริงผ่าน #ad-promo-upload 'change' event** ด้วยเหตุผลเดียวกับทุกไฟล์
// ก่อนหน้าที่มีช่องอัปโหลด (รอบ 106/111/112/113 ฯลฯ): uploadImage() ใน db-media.js ยิง fetch ไป
// Cloudinary จริง ไม่มี stub สำหรับ fetch/createImageBitmap ในสภาพแวดล้อมเทสนี้ — รวมถึงกรณี
// "remaining <= 0" ที่ return ก่อนเรียก uploadImage() จริงก็ไม่ทดสอบด้วยเพื่อความสม่ำเสมอกับ
// แพทเทิร์นที่ตกลงไว้แล้ว (ไม่มีไฟล์เทสไหนก่อนหน้านี้จำลอง input.files เลย) — เทสคลุมแค่ว่า
// input file element มีอยู่จริงในหน้า
//
// **ไม่มีเทส "saveSettings() reject"** ด้วยเหตุผลเดียวกับรอบ 116/111 ฯลฯ: firebase-stub-loader.mjs
// ไม่มีช่องทางสั่งให้ setDoc()/addDoc() throw ได้เลย
//
// สถาปัตยกรรมเทส: import ทั้งไฟล์ครั้งเดียวใน before() ผ่าน jsdom + admin.html body จริง (ตัด
// <script> ออก) ตามแพทเทิร์นเดียวกับรอบ 116 — currentPromoImages เป็น private module state
// เข้าถึงได้แค่ทางอ้อมผ่าน renderPromoSettings(settings) ตอนตั้งต้น แล้วดู/แก้ต่อผ่าน DOM จริง
// (คลิกปุ่มลบ/พิมพ์ในช่อง title-link) แล้วยืนยันผลลัพธ์สุดท้ายผ่าน payload ที่ส่งเข้า
// saveSettings() ตอนกดบันทึก — ไม่มี setter export ให้ตั้ง state ตรงๆ
//
// ตรวจโค้ดจริงทั้งไฟล์ js/admin-settings-promo.js ก่อนเขียนเทสนี้ (129 บรรทัด อ่านครบ) — ไม่พบบั๊ก
// จึงเป็นไฟล์เทสล้วนๆ ไม่มีการแก้โค้ดผลิตภัณฑ์เลยแม้แต่บรรทัดเดียว

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
let mod; // admin-settings-promo.js exports

function makeItems(n, startIdx = 0) {
  return Array.from({ length: n }, (_, i) => ({
    image: `https://res.cloudinary.com/x/image/upload/img${startIdx + i}.jpg`,
    title: `หัวข้อ ${startIdx + i}`,
    link: `https://example.com/${startIdx + i}`,
  }));
}

function gridItems() {
  return Array.from(document.querySelectorAll("#ad-promo-images .ad-img-item"));
}

function titleInputs() {
  return Array.from(document.querySelectorAll("#ad-promo-images .ad-promo-title"));
}

function linkInputs() {
  return Array.from(document.querySelectorAll("#ad-promo-images .ad-promo-link"));
}

function labelText() {
  const label = document.getElementById("ad-promo-upload-label");
  const textNode = Array.from(label.childNodes).find(n => n.nodeType === 3 && n.textContent.trim());
  return textNode ? textNode.textContent : "";
}

before(async () => {
  const dom = new JSDOM(`<!doctype html><html><body>${ADMIN_BODY_NO_SCRIPTS}</body></html>`);
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
  globalThis.Event = dom.window.Event;
  globalThis.Node = dom.window.Node;
  document = dom.window.document;

  mod = await import("../js/admin-settings-promo.js");
});

beforeEach(() => {
  globalThis.__SET_DOC_CALLS__ = [];
  globalThis.__ADD_DOC_CALLS__ = [];
  document.querySelectorAll(".cp-toast-wrap .cp-toast").forEach((el) => el.remove());
  document.getElementById("ad-promo-status").textContent = "";
  mod.renderPromoSettings(null); // เคลียร์กลับสถานะว่างก่อนทุกเทส
});

describe("renderPromoSettings(settings)", () => {
  test("settings เป็น null → กล่องว่างเปล่า ข้อความ 'ยังไม่มีรูป' + label เหลือ 10 รูป", () => {
    mod.renderPromoSettings(null);
    assert.equal(gridItems().length, 0);
    assert.match(document.getElementById("ad-promo-images").innerHTML, /ยังไม่มีรูป/);
    assert.equal(labelText(), "อัปโหลดรูปโปรโมชั่น/ข่าว (เหลือ 10 รูป)");
  });

  test("settings เป็น undefined → เหมือนกับ null ทุกประการ", () => {
    assert.doesNotThrow(() => mod.renderPromoSettings(undefined));
    assert.equal(gridItems().length, 0);
  });

  test("settings.promoUpdates ไม่ใช่ array (เช่น ไม่มีฟิลด์นี้เลย) → ถือเป็นว่างเปล่า", () => {
    mod.renderPromoSettings({ someOtherField: 1 });
    assert.equal(gridItems().length, 0);
  });

  test("render รายการปกติ 3 รูป → กริดมี 3 .ad-img-item พร้อม src/alt/ช่อง title-link ค่าตรง", () => {
    mod.renderPromoSettings({ promoUpdates: makeItems(3) });
    const items = gridItems();
    assert.equal(items.length, 3);
    const imgs = document.querySelectorAll("#ad-promo-images img");
    assert.equal(imgs[0].getAttribute("src"), "https://res.cloudinary.com/x/image/upload/img0.jpg");
    assert.equal(imgs[0].getAttribute("alt"), "โปรโมชั่น/ข่าว 1");
    assert.equal(imgs[2].getAttribute("alt"), "โปรโมชั่น/ข่าว 3");
    const titles = titleInputs();
    const links = linkInputs();
    assert.equal(titles[1].value, "หัวข้อ 1");
    assert.equal(links[1].value, "https://example.com/1");
    assert.equal(labelText(), "อัปโหลดรูปโปรโมชั่น/ข่าว (เหลือ 7 รูป)");
  });

  test("รายการที่ไม่มี image (falsy) ถูกกรองออกทั้งหมด", () => {
    mod.renderPromoSettings({
      promoUpdates: [
        { image: "https://x/1.jpg", title: "มีรูป" },
        { title: "ไม่มีรูป", link: "https://x" },
        { image: "", title: "รูปว่างเปล่า" },
      ],
    });
    assert.equal(gridItems().length, 1);
    assert.equal(titleInputs()[0].value, "มีรูป");
  });

  test("รายการที่ไม่มี title/link → fallback เป็นค่าว่าง \"\"", () => {
    mod.renderPromoSettings({ promoUpdates: [{ image: "https://x/1.jpg" }] });
    assert.equal(titleInputs()[0].value, "");
    assert.equal(linkInputs()[0].value, "");
  });

  test("ครบ 10 รูปพอดี (PROMO_MAX) → label เปลี่ยนเป็น 'ครบ 10 รูปแล้ว (สูงสุด)' + is-disabled + input.disabled=true", () => {
    mod.renderPromoSettings({ promoUpdates: makeItems(10) });
    assert.equal(gridItems().length, 10);
    assert.equal(labelText(), "ครบ 10 รูปแล้ว (สูงสุด)");
    assert.equal(document.getElementById("ad-promo-upload-label").classList.contains("is-disabled"), true);
    assert.equal(document.getElementById("ad-promo-upload").disabled, true);
  });

  test("ต่ำกว่า 10 รูป → label ไม่มี is-disabled และ input ไม่ disabled", () => {
    mod.renderPromoSettings({ promoUpdates: makeItems(9) });
    assert.equal(document.getElementById("ad-promo-upload-label").classList.contains("is-disabled"), false);
    assert.equal(document.getElementById("ad-promo-upload").disabled, false);
  });

  test("เรียกซ้ำสองครั้งด้วยข้อมูลต่างกัน → สถานะล่าสุดทับของเก่าหมด ไม่ค้าง", () => {
    mod.renderPromoSettings({ promoUpdates: makeItems(5) });
    mod.renderPromoSettings({ promoUpdates: makeItems(2, 100) });
    assert.equal(gridItems().length, 2);
    assert.equal(titleInputs()[0].value, "หัวข้อ 100");
  });

  test("escapeHtml กัน XSS ในช่อง title/link (ค่า attribute ถูก escape ไม่แตกโครงสร้าง input)", () => {
    mod.renderPromoSettings({
      promoUpdates: [{ image: "https://x/1.jpg", title: '"><script>x</script>', link: "'><b>y</b>" }],
    });
    assert.equal(titleInputs().length, 1);
    assert.equal(document.querySelectorAll("#ad-promo-images script").length, 0);
    // ค่าที่ decode กลับมาจาก .value ต้องตรงกับต้นฉบับเป๊ะ (jsdom unescape ให้อัตโนมัติตอนอ่าน .value)
    assert.equal(titleInputs()[0].value, '"><script>x</script>');
  });
});

describe("ปุ่มลบรูป (.ad-img-remove ใน #ad-promo-images)", () => {
  beforeEach(() => {
    mod.renderPromoSettings({ promoUpdates: makeItems(3) });
  });

  test("คลิกปุ่มลบรูปกลาง (idx=1) → เหลือ 2 รูป รูปที่เหลือคือ idx 0 กับ 2 เดิม (title ตรง)", () => {
    document.querySelectorAll("#ad-promo-images .ad-img-remove")[1].dispatchEvent(new Event("click", { bubbles: true }));
    const titles = titleInputs();
    assert.equal(gridItems().length, 2);
    assert.equal(titles[0].value, "หัวข้อ 0");
    assert.equal(titles[1].value, "หัวข้อ 2");
  });

  test("คลิกในกล่องแต่ไม่ใช่ปุ่มลบ → ไม่มีอะไรเปลี่ยน", () => {
    document.querySelector("#ad-promo-images .ad-img-item img").dispatchEvent(new Event("click", { bubbles: true }));
    assert.equal(gridItems().length, 3);
  });

  test("ลบจนหมด (ลบทีละรูปจากรูปแรกซ้ำ 3 ครั้ง) → กลับไปข้อความ 'ยังไม่มีรูป' + label เหลือ 10 รูป", () => {
    for (let i = 0; i < 3; i++) {
      document.querySelector("#ad-promo-images .ad-img-remove").dispatchEvent(new Event("click", { bubbles: true }));
    }
    assert.equal(gridItems().length, 0);
    assert.match(document.getElementById("ad-promo-images").innerHTML, /ยังไม่มีรูป/);
    assert.equal(labelText(), "อัปโหลดรูปโปรโมชั่น/ข่าว (เหลือ 10 รูป)");
  });
});

describe("แก้ไข title/link ผ่าน input event บน #ad-promo-images", () => {
  beforeEach(() => {
    mod.renderPromoSettings({ promoUpdates: makeItems(2) });
  });

  test("พิมพ์ในช่อง title (.ad-promo-title) → state เปลี่ยนจริง (ยืนยันผ่าน payload ตอนบันทึก)", async () => {
    const titleEl = titleInputs()[0];
    titleEl.value = "หัวข้อใหม่";
    titleEl.dispatchEvent(new Event("input", { bubbles: true }));

    document.getElementById("ad-promo-save").dispatchEvent(new Event("click", { bubbles: true }));
    await flushMicrotasks();

    assert.equal(globalThis.__SET_DOC_CALLS__[0].payload.promoUpdates[0].title, "หัวข้อใหม่");
  });

  test("พิมพ์ในช่อง link (.ad-promo-link) → state เปลี่ยนจริง", async () => {
    const linkEl = linkInputs()[1];
    linkEl.value = "https://new-link.example.com";
    linkEl.dispatchEvent(new Event("input", { bubbles: true }));

    document.getElementById("ad-promo-save").dispatchEvent(new Event("click", { bubbles: true }));
    await flushMicrotasks();

    assert.equal(globalThis.__SET_DOC_CALLS__[0].payload.promoUpdates[1].link, "https://new-link.example.com");
  });

  test("input event บน element อื่นที่ไม่มี class title/link ที่เกี่ยวข้อง → ไม่ throw ไม่มีผล", () => {
    assert.doesNotThrow(() => {
      document.getElementById("ad-promo-images").dispatchEvent(new Event("input", { bubbles: true }));
    });
  });

  test("input event ที่ dataset.idx เป็น NaN หรือชี้ index ที่ไม่มีจริง → ไม่ throw", () => {
    const fakeInput = document.createElement("input");
    fakeInput.className = "ad-promo-title";
    fakeInput.dataset.idx = "99";
    document.getElementById("ad-promo-images").appendChild(fakeInput);
    assert.doesNotThrow(() => {
      fakeInput.dispatchEvent(new Event("input", { bubbles: true }));
    });
    fakeInput.remove();
  });
});

describe("ปุ่มบันทึก (#ad-promo-save)", () => {
  beforeEach(() => {
    mod.renderPromoSettings({ promoUpdates: makeItems(2) });
  });

  test("คลิกบันทึก → saveSettings() ถูกเรียกด้วย path 'settings/main' payload {promoUpdates} options merge:true", async () => {
    document.getElementById("ad-promo-save").dispatchEvent(new Event("click", { bubbles: true }));
    await flushMicrotasks();

    assert.equal(globalThis.__SET_DOC_CALLS__.length, 1);
    assert.equal(globalThis.__SET_DOC_CALLS__[0].path, "settings/main");
    assert.deepEqual(globalThis.__SET_DOC_CALLS__[0].payload, { promoUpdates: makeItems(2) });
    assert.deepEqual(globalThis.__SET_DOC_CALLS__[0].options, { merge: true });
  });

  test("สำเร็จ → ข้อความบันทึกสำเร็จใน #ad-promo-status, ปุ่มกลับมา disabled=false + ข้อความเดิม", async () => {
    const btn = document.getElementById("ad-promo-save");
    const originalText = btn.textContent;

    btn.dispatchEvent(new Event("click", { bubbles: true }));
    await flushMicrotasks();

    assert.match(document.getElementById("ad-promo-status").textContent, /บันทึกสำเร็จ/);
    assert.equal(btn.disabled, false);
    assert.equal(btn.textContent, originalText);
  });

  test("ระหว่างบันทึก ปุ่มถูก disable + เปลี่ยนข้อความเป็น 'กำลังบันทึก...' (เช็คทันทีก่อน microtask resolve)", async () => {
    const btn = document.getElementById("ad-promo-save");
    btn.dispatchEvent(new Event("click", { bubbles: true }));
    assert.equal(btn.disabled, true);
    assert.equal(btn.textContent, "กำลังบันทึก...");
    await flushMicrotasks();
  });

  test("logAudit() ถูกเรียกจากภายใน handler แต่ auth.currentUser เป็น null (ค่าเริ่มต้นของ stub) จึง exit เงียบๆ — ไม่มี addDoc(\"auditLog\") เกิดขึ้น", async () => {
    document.getElementById("ad-promo-save").dispatchEvent(new Event("click", { bubbles: true }));
    await flushMicrotasks();
    assert.equal(globalThis.__ADD_DOC_CALLS__.length, 0);
  });

  test("บันทึกด้วยรายการว่างเปล่าทั้งหมด (ลบรูปหมดก่อนกด) → payload.promoUpdates เป็น [] ไม่ throw", async () => {
    // ลบทีละตัวจากรูปแรกซ้ำๆ (แทน forEach บน NodeList ที่จะเพี้ยนเพราะ DOM re-render ระหว่างลูป)
    while (document.querySelector("#ad-promo-images .ad-img-remove")) {
      document.querySelector("#ad-promo-images .ad-img-remove").dispatchEvent(new Event("click", { bubbles: true }));
    }
    document.getElementById("ad-promo-save").dispatchEvent(new Event("click", { bubbles: true }));
    await flushMicrotasks();
    assert.deepEqual(globalThis.__SET_DOC_CALLS__[0].payload.promoUpdates, []);
  });
});

describe("ช่องอัปโหลดไฟล์ #ad-promo-upload", () => {
  test("element มีอยู่จริงในหน้า พร้อม accept='image/*' และ multiple", () => {
    const input = document.getElementById("ad-promo-upload");
    assert.ok(input);
    assert.equal(input.getAttribute("accept"), "image/*");
    assert.equal(input.multiple, true);
  });
});

// helper: รอ microtask queue ระบาย (สำหรับ async event handler ที่ไม่มี promise ให้ await ตรงๆ)
function flushMicrotasks() {
  return new Promise((r) => setTimeout(r, 0));
}

