// test/admin-blog-form.test.mjs — รอบที่ 113
//
// ขอบเขต: js/admin-blog-form.js (148 บรรทัด) — ฟอร์มเพิ่ม/แก้ไขบทความ (โมดัล) แยกออกมาจาก
// js/admin-blog.js — openBlogModal()/openBlogModalClone()/closeBlogModal(), รูปปกบทความที่กำลัง
// แก้ไข (currentBlogImage + ปุ่มลบรูปตรงๆ ไม่มี confirmDialog — ต่างจาก admin-portfolio-form.js
// รอบ 106 ที่มีหลายรูปและต้องยืนยันก่อนลบ), wireCharCounter ของ meta-title/meta-desc, ตรวจ slug
// ซ้ำก่อน submit, submit handler → saveBlog()
//
// ไฟล์นี้ import { reloadAll } from "./admin-page.js" ตรงๆ ที่ระดับบนสุด — ใช้
// test/helpers/admin-page-stub-loader.mjs แบบเดียวกับไฟล์ก่อนหน้า (ขยาย ALLOWED_PARENT_RE
// เพิ่ม "blog-form" แล้ว)
//
// ไฟล์นี้ยัง import saveBlog จาก db-blog.js (addDoc/updateDoc ผ่าน firebase-stub-loader.mjs เดิม
// — เก็บ call ไว้ที่ globalThis.__ADD_DOC_CALLS__/__UPDATE_DOC_CALLS__) — ส่วน uploadImage() จาก
// db-media.js (ทริกเกอร์จากการเลือกไฟล์อัปโหลดจริงผ่าน bUploadInput 'change') ยิง fetch ไป
// Cloudinary จริง ไม่มี stub ให้ในสภาพแวดล้อมเทสนี้ (เหตุผลเดียวกับ admin-portfolio-form.js
// รอบ 106 และไฟล์อื่นๆ ต่อเนื่องมา) — เทสไฟล์นี้จึงไม่คลุม flow อัปโหลดไฟล์จริง คลุมแค่ยืนยันว่า
// input file element ผูก event listener จริง (ผ่านการเช็คว่า element มีอยู่จริง)
//
// ตรวจโค้ดจริงทั้งไฟล์ js/admin-blog-form.js + saveBlog()/deleteBlog() ใน js/db-blog.js ก่อนเขียน
// เทสนี้ (อ่านครบ) — ไม่พบบั๊ก จึงเป็นไฟล์เทสล้วนๆ ไม่มีการแก้โค้ดผลิตภัณฑ์เลยแม้แต่บรรทัดเดียว
// (นอกจาก test/helpers/admin-page-stub-loader.mjs ที่เป็นโครงสร้างพื้นฐานของเทส ไม่ใช่โค้ด
// ผลิตภัณฑ์ — ขยาย regex บรรทัดเดียว + คอมเมนต์)

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
let mod;          // admin-blog-form.js exports
let setAllBlogs;  // จาก admin-state.js — ใช้ตั้งค่า allBlogs ก่อนแต่ละเทส (เช็ค slug ซ้ำ)

function resetFirebaseCalls() {
  globalThis.__ADD_DOC_CALLS__ = [];
  globalThis.__UPDATE_DOC_CALLS__ = [];
  globalThis.__DELETE_DOC_CALLS__ = [];
}

function resetSpies() {
  globalThis.__AD_PAGE_STUB_RELOAD_ALL_CALLS__ = [];
  globalThis.__AD_PAGE_STUB_RELOAD_ALL__ = (...args) => {
    globalThis.__AD_PAGE_STUB_RELOAD_ALL_CALLS__.push(args);
  };
}

const SAMPLE_POST = {
  id: "blog-1",
  title: "มาตรฐานป้ายความปลอดภัย มอก.",
  slug: "safety-sign-standards",
  category: "ความรู้ทั่วไป",
  excerpt: "สรุปมาตรฐานป้ายความปลอดภัยที่โรงงานควรรู้",
  content: "เนื้อหาเต็มของบทความ...",
  metaTitle: "มาตรฐานป้ายความปลอดภัย | CS.SIGN",
  metaDescription: "อ่านสรุปมาตรฐานป้ายความปลอดภัยมอก. ที่โรงงานต้องมี",
  author: "สมชาย ใจดี",
  status: "draft",
  featured: true,
  image: "https://res.cloudinary.com/x/image/upload/v1/paisign/blog/a.jpg",
};

function overlay() { return document.getElementById("ad-b-overlay"); }
function field(id) { return document.getElementById(id); }

before(async () => {
  const dom = new JSDOM(`<!doctype html><html><body>${ADMIN_BODY_NO_SCRIPTS}</body></html>`);
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
  globalThis.Event = dom.window.Event;
  document = dom.window.document;

  mod = await import("../js/admin-blog-form.js");
  ({ setAllBlogs } = await import("../js/admin-state.js"));
});

beforeEach(() => {
  resetFirebaseCalls();
  resetSpies();
  setAllBlogs([]);
  const confirmOverlay = document.querySelector(".cp-confirm-overlay");
  if (confirmOverlay && confirmOverlay.style.display === "flex") {
    confirmOverlay.querySelector("#cp-confirm-cancel").click();
  }
  if (overlay().style.display === "flex") {
    overlay().style.display = "none";
  }
  document.querySelectorAll(".cp-toast-wrap .cp-toast").forEach(el => el.remove());
});

describe("openBlogModal()", () => {
  test("post = null (โหมดเพิ่ม) → หัวข้อ/ฟิลด์ว่างหมด, ผู้เขียนดีฟอลต์, สถานะดีฟอลต์เผยแพร่แล้ว, ไม่ featured, ไม่มีรูป", () => {
    mod.openBlogModal(null);
    assert.equal(field("ad-b-modal-title").textContent, "เพิ่มบทความ");
    assert.equal(field("ad-b-id").value, "");
    assert.equal(field("ad-b-title").value, "");
    assert.equal(field("ad-b-slug").value, "");
    assert.equal(field("ad-b-category").value, "");
    assert.equal(field("ad-b-excerpt").value, "");
    assert.equal(field("ad-b-content").value, "");
    assert.equal(field("ad-b-meta-title").value, "");
    assert.equal(field("ad-b-meta-desc").value, "");
    assert.equal(field("ad-b-author").value, "ทีมงาน CS.SIGN");
    assert.equal(field("ad-b-status").value, "published");
    assert.equal(field("ad-b-featured").checked, false);
    assert.match(field("ad-b-image").innerHTML, /ยังไม่มีรูปปก/);
    assert.equal(overlay().style.display, "flex");
  });

  test("post ที่มีข้อมูล (โหมดแก้ไข) → ทุกฟิลด์ถูกเติมค่าเดิม รวมรูปปกถูก render", () => {
    mod.openBlogModal(SAMPLE_POST);
    assert.equal(field("ad-b-modal-title").textContent, "แก้ไขบทความ");
    assert.equal(field("ad-b-id").value, "blog-1");
    assert.equal(field("ad-b-title").value, "มาตรฐานป้ายความปลอดภัย มอก.");
    assert.equal(field("ad-b-slug").value, "safety-sign-standards");
    assert.equal(field("ad-b-category").value, "ความรู้ทั่วไป");
    assert.equal(field("ad-b-excerpt").value, "สรุปมาตรฐานป้ายความปลอดภัยที่โรงงานควรรู้");
    assert.equal(field("ad-b-content").value, "เนื้อหาเต็มของบทความ...");
    assert.equal(field("ad-b-meta-title").value, "มาตรฐานป้ายความปลอดภัย | CS.SIGN");
    assert.equal(field("ad-b-meta-desc").value, "อ่านสรุปมาตรฐานป้ายความปลอดภัยมอก. ที่โรงงานต้องมี");
    assert.equal(field("ad-b-author").value, "สมชาย ใจดี");
    assert.equal(field("ad-b-status").value, "draft");
    assert.equal(field("ad-b-featured").checked, true);
    assert.equal(document.querySelectorAll("#ad-b-image .ad-img-item").length, 1);
    // meta-title/meta-desc counter ต้องอัปเดตตามความยาวจริง (dispatch "input" ตอนเปิดฟอร์ม)
    assert.match(field("ad-b-meta-title-count").textContent, /\/ 70/);
    assert.match(field("ad-b-meta-desc-count").textContent, /\/ 160/);
  });

  test("เปิดฟอร์มมาที่แท็บ 'เนื้อหา' เสมอ (แม้กำลังแก้ไขบทความที่มี SEO อยู่แล้ว)", () => {
    mod.openBlogModal(SAMPLE_POST);
    const contentTabBtn = document.querySelector('#ad-b-form .cp-od-tab[data-od-tab="content"]');
    const contentPanel = document.querySelector('#ad-b-form .cp-od-panel[data-od-panel="content"]');
    assert.equal(contentTabBtn.classList.contains("active"), true);
    assert.equal(contentPanel.classList.contains("active"), true);
  });

  test("post ไม่มี author/status/featured/image → ใช้ค่าดีฟอลต์ที่เหมาะสม ไม่ throw", () => {
    assert.doesNotThrow(() => mod.openBlogModal({ id: "blog-2", title: "ไม่มีอะไรเลย" }));
    assert.equal(field("ad-b-author").value, "ทีมงาน CS.SIGN");
    assert.equal(field("ad-b-status").value, "published");
    assert.equal(field("ad-b-featured").checked, false);
    assert.match(field("ad-b-image").innerHTML, /ยังไม่มีรูปปก/);
  });
});

describe("openBlogModalClone()", () => {
  test("เปิดฟอร์มแบบ 'เพิ่ม' พร้อมข้อมูลเดิม แต่ id/slug ว่าง และสถานะกลับเป็นฉบับร่าง", () => {
    mod.openBlogModalClone(SAMPLE_POST);
    assert.equal(field("ad-b-id").value, "");
    assert.equal(field("ad-b-slug").value, "");
    assert.equal(field("ad-b-title").value, "มาตรฐานป้ายความปลอดภัย มอก."); // ข้อมูลอื่นยังคงกรอกไว้ให้
    assert.equal(field("ad-b-status").value, "draft");
    assert.equal(
      field("ad-b-modal-title").textContent,
      'ทำซ้ำบทความจาก "มาตรฐานป้ายความปลอดภัย มอก."'
    );
    assert.equal(overlay().style.display, "flex");
  });
});

describe("แท็บในป๊อปอัพ (เนื้อหา/SEO/เผยแพร่ & รูปปก)", () => {
  test("คลิกแท็บ 'SEO' → สลับ panel/aria-selected ถูกต้อง", () => {
    mod.openBlogModal(null);
    const seoTabBtn = document.querySelector('#ad-b-form .cp-od-tab[data-od-tab="seo"]');
    const seoPanel = document.querySelector('#ad-b-form .cp-od-panel[data-od-panel="seo"]');
    const contentTabBtn = document.querySelector('#ad-b-form .cp-od-tab[data-od-tab="content"]');

    seoTabBtn.dispatchEvent(new Event("click", { bubbles: true }));

    assert.equal(seoTabBtn.classList.contains("active"), true);
    assert.equal(seoTabBtn.getAttribute("aria-selected"), "true");
    assert.equal(seoPanel.classList.contains("active"), true);
    assert.equal(contentTabBtn.classList.contains("active"), false);
    assert.equal(contentTabBtn.getAttribute("aria-selected"), "false");
  });

  test("เปิดฟอร์มใหม่อีกครั้งหลังเคยอยู่แท็บอื่น → รีเซ็ตกลับไปแท็บ 'เนื้อหา' เสมอ", () => {
    mod.openBlogModal(null);
    document.querySelector('#ad-b-form .cp-od-tab[data-od-tab="publish"]').dispatchEvent(new Event("click", { bubbles: true }));
    assert.equal(document.querySelector('#ad-b-form .cp-od-panel[data-od-panel="publish"]').classList.contains("active"), true);

    mod.openBlogModal(SAMPLE_POST); // เปิดใหม่ (ป๊อปอัพไม่ได้ถูกสร้างใหม่ แค่ toggle display)

    assert.equal(document.querySelector('#ad-b-form .cp-od-panel[data-od-panel="content"]').classList.contains("active"), true);
    assert.equal(document.querySelector('#ad-b-form .cp-od-panel[data-od-panel="publish"]').classList.contains("active"), false);
  });
});

describe("ปุ่มลบรูปปก (.ad-img-remove)", () => {
  test("คลิกปุ่มลบ → currentBlogImage ถูกล้างทันที ไม่มี confirmDialog มาถาม (ต่างจาก portfolio หลายรูป)", () => {
    mod.openBlogModal(SAMPLE_POST); // มี 1 รูป
    assert.equal(document.querySelectorAll("#ad-b-image .ad-img-item").length, 1);

    field("ad-b-image").querySelector(".ad-img-remove").dispatchEvent(new Event("click", { bubbles: true }));

    assert.match(field("ad-b-image").innerHTML, /ยังไม่มีรูปปก/);
    const confirmOverlay = document.querySelector(".cp-confirm-overlay");
    assert.notEqual(confirmOverlay && confirmOverlay.style.display, "flex");
  });

  test("คลิกที่กล่องรูปแต่ไม่ตรงปุ่มลบ (.ad-img-remove) → ไม่มีอะไรเกิดขึ้น รูปยังอยู่", () => {
    mod.openBlogModal(SAMPLE_POST);
    field("ad-b-image").querySelector(".ad-img-item img").dispatchEvent(new Event("click", { bubbles: true }));
    assert.equal(document.querySelectorAll("#ad-b-image .ad-img-item").length, 1);
  });
});

describe("ปุ่มยกเลิก / คลิกนอก modal (attachUnsavedGuard)", () => {
  test("ยังไม่แก้ไขอะไรเลย → ปุ่มยกเลิกปิดทันที ไม่ถาม confirmDialog", async () => {
    mod.openBlogModal(SAMPLE_POST);
    field("ad-b-cancel").dispatchEvent(new Event("click", { bubbles: true }));
    await flushMicrotasks();
    assert.equal(overlay().style.display, "none");
    const confirmOverlay = document.querySelector(".cp-confirm-overlay");
    assert.notEqual(confirmOverlay && confirmOverlay.style.display, "flex");
  });

  test("แก้ไขฟิลด์แล้วกดยกเลิก → เด้ง confirmDialog ก่อน, กด 'ยกเลิก' บน dialog → modal ยังเปิดอยู่", async () => {
    mod.openBlogModal(SAMPLE_POST);
    field("ad-b-title").value = "ชื่อใหม่ที่แก้ไข";
    field("ad-b-title").dispatchEvent(new Event("input", { bubbles: true }));

    field("ad-b-cancel").dispatchEvent(new Event("click", { bubbles: true }));
    await flushMicrotasks();
    const confirmOverlay = document.querySelector(".cp-confirm-overlay");
    assert.equal(confirmOverlay.style.display, "flex");

    confirmOverlay.querySelector("#cp-confirm-cancel").click();
    await flushMicrotasks();
    assert.equal(overlay().style.display, "flex", "ยกเลิกที่ dialog แล้ว modal เดิมต้องยังเปิดอยู่");
  });

  test("แก้ไขฟิลด์แล้วกดยกเลิก แล้วยืนยัน 'ปิดโดยไม่บันทึก' → modal ปิดจริงและฟอร์มถูกล้าง", async () => {
    mod.openBlogModal(SAMPLE_POST);
    field("ad-b-title").value = "ชื่อใหม่ที่แก้ไข";
    field("ad-b-title").dispatchEvent(new Event("input", { bubbles: true }));

    field("ad-b-cancel").dispatchEvent(new Event("click", { bubbles: true }));
    await flushMicrotasks();
    document.querySelector("#cp-confirm-ok").click();
    await flushMicrotasks();

    assert.equal(overlay().style.display, "none");
    assert.equal(field("ad-b-title").value, "");
  });

  test("คลิก backdrop ของ overlay เอง (ไม่ใช่ .cp-modal ข้างใน) → ทำงานเหมือนปุ่มยกเลิก", async () => {
    mod.openBlogModal(null); // ยังไม่แก้ไข ไม่ dirty
    overlay().dispatchEvent(new Event("click", { bubbles: true, cancelable: true }));
    await flushMicrotasks();
    assert.equal(overlay().style.display, "none");
  });
});

describe("input file อัปโหลดรูปปก (#ad-b-upload)", () => {
  test("element มีอยู่จริงและผูก 'change' listener ไว้ (ไม่คลุม flow อัปโหลดจริงเพราะยิง fetch ไป Cloudinary)", () => {
    assert.ok(field("ad-b-upload"));
    assert.equal(field("ad-b-upload").getAttribute("type"), "file");
  });
});

describe("submit ฟอร์ม", () => {
  test("กรอกครบ โหมดเพิ่มใหม่ → saveBlog() (addDoc) ถูกเรียกด้วย payload ถูกต้อง + ปิด modal + reloadAll()", async () => {
    mod.openBlogModal(null);
    field("ad-b-title").value = "  บทความใหม่  ";
    field("ad-b-slug").value = "";
    field("ad-b-category").value = "  ความรู้  ";
    field("ad-b-excerpt").value = "  สรุปย่อ  ";
    field("ad-b-content").value = "  เนื้อหา  ";
    field("ad-b-author").value = "  ผู้เขียนใหม่  ";
    field("ad-b-status").value = "published";
    field("ad-b-featured").checked = true;

    field("ad-b-form").dispatchEvent(new Event("submit", { cancelable: true }));
    await flushMicrotasks();
    await flushMicrotasks();

    assert.equal(globalThis.__ADD_DOC_CALLS__.length, 1);
    const { path, payload } = globalThis.__ADD_DOC_CALLS__[0];
    assert.equal(path, "blogs");
    assert.equal(payload.title, "บทความใหม่");
    assert.equal(payload.slug, "บทความใหม่"); // slug ว่าง → สร้างจาก title ผ่าน slugify()
    assert.equal(payload.category, "ความรู้");
    assert.equal(payload.excerpt, "สรุปย่อ");
    assert.equal(payload.content, "เนื้อหา");
    assert.equal(payload.author, "ผู้เขียนใหม่");
    assert.equal(payload.status, "published");
    assert.equal(payload.featured, true);
    assert.equal(payload.image, "");
    assert.ok(payload.createdAt);
    assert.equal(payload.id, undefined);

    assert.equal(overlay().style.display, "none");
    assert.equal(globalThis.__AD_PAGE_STUB_RELOAD_ALL_CALLS__.length, 1);
  });

  test("กรอก slug เองแล้ว submit → ใช้ slug ที่กรอกเอง (ผ่าน slugify()) ไม่ auto-generate จาก title", () => {
    mod.openBlogModal(null);
    field("ad-b-title").value = "ชื่อบทความ";
    field("ad-b-slug").value = " My Custom Slug! ";
    field("ad-b-form").dispatchEvent(new Event("submit", { cancelable: true }));
    return flushMicrotasks().then(() => flushMicrotasks()).then(() => {
      const { payload } = globalThis.__ADD_DOC_CALLS__[0];
      assert.equal(payload.slug, "my-custom-slug");
    });
  });

  test("โหมดแก้ไข (มี id) → updateDoc ถูกเรียกที่ blogs/<id>, payload ไม่มี field id ปน", async () => {
    setAllBlogs([SAMPLE_POST]);
    mod.openBlogModal(SAMPLE_POST);
    field("ad-b-title").value = "มาตรฐานป้ายความปลอดภัย มอก. (แก้ไข)";

    field("ad-b-form").dispatchEvent(new Event("submit", { cancelable: true }));
    await flushMicrotasks();
    await flushMicrotasks();

    assert.equal(globalThis.__UPDATE_DOC_CALLS__.length, 1);
    const { path, payload } = globalThis.__UPDATE_DOC_CALLS__[0];
    assert.equal(path, "blogs/blog-1");
    assert.equal(payload.title, "มาตรฐานป้ายความปลอดภัย มอก. (แก้ไข)");
    assert.equal(payload.slug, "safety-sign-standards"); // ไม่แก้ slug เดิมติดไปด้วย
    assert.equal(payload.id, undefined, "payload ต้องไม่มี field id ปนเข้าไป");
  });

  test("โหมดแก้ไขแล้วลบรูปก่อน submit → payload.image เป็นค่าว่างจริง", async () => {
    setAllBlogs([SAMPLE_POST]);
    mod.openBlogModal(SAMPLE_POST);
    field("ad-b-image").querySelector(".ad-img-remove").dispatchEvent(new Event("click", { bubbles: true }));

    field("ad-b-form").dispatchEvent(new Event("submit", { cancelable: true }));
    await flushMicrotasks();
    await flushMicrotasks();

    const { payload } = globalThis.__UPDATE_DOC_CALLS__[0];
    assert.equal(payload.image, "");
  });

  test("slug ซ้ำกับบทความอื่น (คนละ id) → ไม่เรียก saveBlog() เลย + toast เตือน, modal ยังเปิดอยู่", async () => {
    setAllBlogs([SAMPLE_POST, { id: "blog-3", slug: "duplicate-slug" }]);
    mod.openBlogModal(null);
    field("ad-b-title").value = "บทความชื่ออื่น";
    field("ad-b-slug").value = "duplicate-slug";

    field("ad-b-form").dispatchEvent(new Event("submit", { cancelable: true }));
    await flushMicrotasks();

    assert.equal((globalThis.__ADD_DOC_CALLS__ || []).length, 0);
    assert.equal((globalThis.__UPDATE_DOC_CALLS__ || []).length, 0);
    assert.match(
      document.querySelector(".cp-toast.error")?.textContent || "",
      /slug นี้ถูกใช้กับบทความอื่นแล้ว/
    );
    assert.equal(overlay().style.display, "flex", "submit ถูกบล็อก modal ต้องยังเปิดอยู่");
  });

  test("slug ซ้ำกับ 'ตัวเอง' ตอนแก้ไข (id เดียวกัน) → ไม่นับว่าซ้ำ ยัง submit ได้ปกติ", async () => {
    setAllBlogs([SAMPLE_POST]);
    mod.openBlogModal(SAMPLE_POST); // slug เดิมของตัวเองคือ safety-sign-standards
    field("ad-b-form").dispatchEvent(new Event("submit", { cancelable: true }));
    await flushMicrotasks();
    await flushMicrotasks();

    assert.equal(globalThis.__UPDATE_DOC_CALLS__.length, 1);
    assert.equal(document.querySelector(".cp-toast.error"), null);
  });

  test("ปุ่ม submit ถูก disable + เปลี่ยนข้อความระหว่างบันทึก แล้วกลับมาปกติหลังเสร็จ", async () => {
    mod.openBlogModal(null);
    field("ad-b-title").value = "ทดสอบปุ่ม";
    const btn = field("ad-b-form").querySelector("button[type=submit]");
    assert.equal(btn.disabled, false);
    assert.equal(btn.textContent, "บันทึก");

    field("ad-b-form").dispatchEvent(new Event("submit", { cancelable: true }));
    await flushMicrotasks();
    await flushMicrotasks();

    assert.equal(btn.disabled, false);
    assert.equal(btn.textContent, "บันทึก");
  });

  // หมายเหตุ: ไม่มีเทส "saveBlog() reject" ด้วยเหตุผลเดียวกับที่บันทึกไว้ใน
  // test/admin-portfolio-form.test.mjs รอบ 106 — firebase-stub-loader.mjs ไม่มีช่องทางสั่งให้
  // addDoc()/updateDoc() throw ได้ (resolve สำเร็จเสมอตามดีไซน์ปัจจุบัน) การเพิ่มความสามารถนี้
  // ต้องแก้ shared stub ที่ทุกไฟล์เทสอื่นก็ใช้ร่วมกัน เกินขอบเขตงานเสริมรอบนี้
});

// helper: รอ microtask queue ระบาย (สำหรับ async event handler ที่ไม่มี promise ให้ await ตรงๆ)
function flushMicrotasks() {
  return new Promise((r) => setTimeout(r, 0));
}
