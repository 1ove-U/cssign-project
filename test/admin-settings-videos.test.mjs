// test/admin-settings-videos.test.mjs — รอบที่ 130
//
// ขอบเขต: js/admin-settings-videos.js (245 บรรทัด) — แท็บ SETTINGS ย่อย "วิดีโอแนะนำสินค้า"
// (หน้าแรก) — เก็บเป็น settings.introVideos: [{ url, poster, title, desc }, ...] อาร์เรย์
// สูงสุด VIDEOS_MAX=10 — รองรับอ่าน settings.introVideo (เอกฐาน แบบเก่า) เป็น fallback ตอนโหลด
// ถ้า introVideos ว่าง — โครงคล้าย admin-settings-promo.js (รอบ 119) ตรงที่มีช่องอัปโหลดผ่าน
// db-media.js + saveSettings()/logAudit() เอกสาร settings/main เดียวกัน แต่ต่างตรงที่:
// 1) มีปุ่มเลื่อนขึ้น/ลง (.ad-video-item-move) ต่อรายการ 2) แต่ละรายการมี url/title/desc/poster
// พร้อมกัน (ไม่ใช่แค่ image เดียว) 3) มี YouTube-thumbnail auto-detect (adminExtractYouTubeId
// — ฟังก์ชัน private ไม่ export แยกจาก extractYouTubeId ใน home-dynamic.js คนละสโคป) 4) preview
// อัปเดตแบบ real-time ผ่าน updateVideoPreview() ตอนพิมพ์ url โดยไม่ re-render ทั้งลิสต์
// (renderVideosList() re-render เต็มเฉพาะตอน add/remove/move/poster-remove/upload)
//
// ไฟล์นี้ import saveSettings จาก db-settings.js + logAudit จาก db.js ตรงๆ (ทั้งคู่ import
// js/db.js ต่อ) จึงต้องพึ่ง test/helpers/firebase-stub-loader.mjs เหมือนรอบ 119 — ไม่ import
// "./admin-page.js" หรือ "./admin-state.js" เลย จึงไม่ต้องใช้ admin-page-stub-loader.mjs
// (ยืนยันด้วย probe import ตรงก่อนเขียนเทส — ผ่านทันทีไม่มี error)
//
// **ไม่คลุม flow อัปโหลดไฟล์จริงผ่าน .ad-video-file-upload/.ad-video-poster-upload 'change'
// event** ด้วยเหตุผลเดียวกับทุกไฟล์ก่อนหน้าที่มีช่องอัปโหลด (รอบ 106/111/112/113/119 ฯลฯ):
// uploadImage()/uploadFile() ใน db-media.js ยิง fetch ไป Cloudinary จริง ไม่มี stub สำหรับ
// fetch/createImageBitmap ในสภาพแวดล้อมเทสนี้ — เทสคลุมแค่ว่า input file element มีอยู่จริง
// พร้อม attribute ที่ถูกต้อง
//
// **ไม่มีเทส "saveSettings() reject"** ด้วยเหตุผลเดียวกับรอบ 116/111/119 ฯลฯ:
// firebase-stub-loader.mjs ไม่มีช่องทางสั่งให้ setDoc()/addDoc() throw ได้เลย
//
// สถาปัตยกรรมเทส: import ทั้งไฟล์ครั้งเดียวใน before() ผ่าน jsdom + admin.html body จริง (ตัด
// <script> ออก) ตามแพทเทิร์นเดียวกับรอบ 119 — currentVideos เป็น private module state เข้าถึง
// ได้แค่ทางอ้อมผ่าน renderVideoSettings(settings) ตอนตั้งต้น แล้วดู/แก้ต่อผ่าน DOM จริง (คลิก
// ปุ่มเลื่อน/ลบ/พิมพ์ในช่อง) แล้วยืนยันผลลัพธ์สุดท้ายผ่าน payload ที่ส่งเข้า saveSettings()
// ตอนกดบันทึก — ไม่มี setter export ให้ตั้ง state ตรงๆ
//
// ตรวจโค้ดจริงทั้งไฟล์ js/admin-settings-videos.js ก่อนเขียนเทสนี้ (245 บรรทัด อ่านครบ) — ไม่พบ
// บั๊ก จึงเป็นไฟล์เทสล้วนๆ ไม่มีการแก้โค้ดผลิตภัณฑ์เลยแม้แต่บรรทัดเดียว

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
let mod; // admin-settings-videos.js exports

function makeVideos(n, startIdx = 0) {
  return Array.from({ length: n }, (_, i) => ({
    url: `https://www.youtube.com/watch?v=vid${startIdx + i}xxxxx`,
    poster: "",
    title: `หัวข้อ ${startIdx + i}`,
    desc: `คำอธิบาย ${startIdx + i}`,
  }));
}

function items() {
  return Array.from(document.querySelectorAll("#ad-videos-list .ad-video-item"));
}

function urlInputs() {
  return Array.from(document.querySelectorAll("#ad-videos-list .ad-video-url"));
}

function titleInputs() {
  return Array.from(document.querySelectorAll("#ad-videos-list .ad-video-title"));
}

function descInputs() {
  return Array.from(document.querySelectorAll("#ad-videos-list .ad-video-desc"));
}

before(async () => {
  const dom = new JSDOM(`<!doctype html><html><body>${ADMIN_BODY_NO_SCRIPTS}</body></html>`);
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
  globalThis.Event = dom.window.Event;
  globalThis.Node = dom.window.Node;
  document = dom.window.document;

  mod = await import("../js/admin-settings-videos.js");
});

beforeEach(() => {
  globalThis.__SET_DOC_CALLS__ = [];
  globalThis.__ADD_DOC_CALLS__ = [];
  document.querySelectorAll(".cp-toast-wrap .cp-toast").forEach((el) => el.remove());
  document.getElementById("ad-videos-status").textContent = "";
  mod.renderVideoSettings(null); // เคลียร์กลับสถานะว่างก่อนทุกเทส
});

describe("renderVideoSettings(settings)", () => {
  test("settings เป็น null → ข้อความ 'ยังไม่มีวิดีโอ' ไม่มีรายการ", () => {
    mod.renderVideoSettings(null);
    assert.equal(items().length, 0);
    assert.match(document.getElementById("ad-videos-list").innerHTML, /ยังไม่มีวิดีโอ/);
  });

  test("settings เป็น undefined → เหมือนกับ null ทุกประการ", () => {
    assert.doesNotThrow(() => mod.renderVideoSettings(undefined));
    assert.equal(items().length, 0);
  });

  test("settings.introVideos ไม่ใช่ array (ไม่มีฟิลด์นี้เลย) → ถือเป็นว่างเปล่า", () => {
    mod.renderVideoSettings({ someOtherField: 1 });
    assert.equal(items().length, 0);
  });

  test("render รายการปกติ 3 วิดีโอ → 3 .ad-video-item ค่า url/title/desc ตรง", () => {
    mod.renderVideoSettings({ introVideos: makeVideos(3) });
    assert.equal(items().length, 3);
    const urls = urlInputs();
    const titles = titleInputs();
    const descs = descInputs();
    assert.equal(urls[1].value, "https://www.youtube.com/watch?v=vid1xxxxx");
    assert.equal(titles[1].value, "หัวข้อ 1");
    assert.equal(descs[1].value, "คำอธิบาย 1");
  });

  test("รายการที่ไม่มี url (falsy) ถูกกรองออกทั้งหมด", () => {
    mod.renderVideoSettings({
      introVideos: [
        { url: "https://x/1.mp4", title: "มีลิงก์" },
        { title: "ไม่มีลิงก์" },
        { url: "", title: "ลิงก์ว่างเปล่า" },
      ],
    });
    assert.equal(items().length, 1);
    assert.equal(titleInputs()[0].value, "มีลิงก์");
  });

  test("ไม่มีฟิลด์ title/desc/poster → fallback เป็นค่าว่าง \"\"", () => {
    mod.renderVideoSettings({ introVideos: [{ url: "https://x/1.mp4" }] });
    assert.equal(titleInputs()[0].value, "");
    assert.equal(descInputs()[0].value, "");
  });

  test("introVideos ว่าง แต่ settings.introVideo (เอกฐาน แบบเก่า) มี url → fallback เป็นรายการเดียว", () => {
    mod.renderVideoSettings({
      introVideo: { url: "https://old.example.com/legacy.mp4", title: "วิดีโอเก่า" },
    });
    assert.equal(items().length, 1);
    assert.equal(urlInputs()[0].value, "https://old.example.com/legacy.mp4");
    assert.equal(titleInputs()[0].value, "วิดีโอเก่า");
  });

  test("introVideos ว่าง และ introVideo ไม่มี url → ยังคงว่างเปล่า (ไม่ fallback)", () => {
    mod.renderVideoSettings({ introVideo: { title: "ไม่มีลิงก์" } });
    assert.equal(items().length, 0);
  });

  test("introVideos มีรายการอยู่แล้ว → ไม่ fallback ไปที่ introVideo แม้จะมีอยู่", () => {
    mod.renderVideoSettings({
      introVideos: makeVideos(1),
      introVideo: { url: "https://old.example.com/legacy.mp4" },
    });
    assert.equal(items().length, 1);
    assert.equal(urlInputs()[0].value, "https://www.youtube.com/watch?v=vid0xxxxx");
  });

  test("เรียกซ้ำสองครั้งด้วยข้อมูลต่างกัน → สถานะล่าสุดทับของเก่าหมด ไม่ค้าง", () => {
    mod.renderVideoSettings({ introVideos: makeVideos(5) });
    mod.renderVideoSettings({ introVideos: makeVideos(2, 100) });
    assert.equal(items().length, 2);
    assert.equal(titleInputs()[0].value, "หัวข้อ 100");
  });

  test("escapeHtml กัน XSS ในช่อง title/desc/url (attribute ถูก escape ไม่แตกโครงสร้าง input)", () => {
    mod.renderVideoSettings({
      introVideos: [{
        url: '"><script>x</script>',
        title: '"><b>y</b>',
        desc: "'><i>z</i>",
      }],
    });
    assert.equal(items().length, 1);
    assert.equal(document.querySelectorAll("#ad-videos-list script").length, 0);
    assert.equal(titleInputs()[0].value, '"><b>y</b>');
  });
});

describe("การแสดงผลรายการ (videoItemHTML) — สถานะ/พรีวิว/ปุ่มเลื่อน", () => {
  test("มี url → ป้ายสถานะ 'พร้อมแสดงผล' (is-ready) ไม่มี url → 'ยังไม่ได้ตั้งค่า' (is-empty)", () => {
    mod.renderVideoSettings({
      introVideos: [{ url: "https://x/1.mp4" }, { url: "" }],
    });
    // รายการที่สองถูกกรองออกเพราะ url ว่าง เหลือแค่รายการแรก — ทดสอบผ่าน add แทนเพื่อให้ได้ item ว่าง
    const statuses = document.querySelectorAll(".ad-video-item-status");
    assert.equal(statuses[0].classList.contains("is-ready"), true);
    assert.match(statuses[0].textContent, /พร้อมแสดงผล/);
  });

  test("รายการว่าง (จากปุ่มเพิ่ม) → is-empty + ข้อความ 'ยังไม่ได้ตั้งค่า'", () => {
    document.getElementById("ad-videos-add").dispatchEvent(new Event("click", { bubbles: true }));
    const status = document.querySelector(".ad-video-item-status");
    assert.equal(status.classList.contains("is-empty"), true);
    assert.match(status.textContent, /ยังไม่ได้ตั้งค่า/);
  });

  test("ลิงก์ YouTube → thumbnail จาก img.youtube.com/vi/<id>/hqdefault.jpg", () => {
    mod.renderVideoSettings({ introVideos: [{ url: "https://www.youtube.com/watch?v=abcDEF12345" }] });
    const img = document.querySelector("#ad-videos-list .ad-video-preview img");
    assert.ok(img);
    assert.equal(img.getAttribute("src"), "https://img.youtube.com/vi/abcDEF12345/hqdefault.jpg");
  });

  test("ลิงก์ youtu.be แบบสั้น → ดึง id ได้เหมือนกัน", () => {
    mod.renderVideoSettings({ introVideos: [{ url: "https://youtu.be/abcDEF12345" }] });
    const img = document.querySelector("#ad-videos-list .ad-video-preview img");
    assert.equal(img.getAttribute("src"), "https://img.youtube.com/vi/abcDEF12345/hqdefault.jpg");
  });

  test("มี poster ตั้งเอง → ใช้ poster แทน YouTube thumbnail auto", () => {
    mod.renderVideoSettings({
      introVideos: [{ url: "https://www.youtube.com/watch?v=abcDEF12345", poster: "https://custom.example.com/p.jpg" }],
    });
    const img = document.querySelector("#ad-videos-list .ad-video-preview img");
    assert.equal(img.getAttribute("src"), "https://custom.example.com/p.jpg");
  });

  test("ไฟล์วิดีโอโดยตรง (.mp4) ไม่มี poster/YouTube id → placeholder 'ไฟล์วิดีโออัปโหลดแล้ว' + ลิงก์ 'เปิดดู'", () => {
    mod.renderVideoSettings({ introVideos: [{ url: "https://res.cloudinary.com/x/video/upload/v1/clip.mp4" }] });
    assert.match(document.querySelector("#ad-videos-list .ad-video-preview").innerHTML, /ไฟล์วิดีโออัปโหลดแล้ว/);
    const link = document.querySelector("#ad-videos-list .ad-video-current a");
    assert.ok(link);
    assert.equal(link.getAttribute("href"), "https://res.cloudinary.com/x/video/upload/v1/clip.mp4");
  });

  test("ไม่มี url เลย (รายการว่าง) → placeholder 'ยังไม่มีตัวอย่าง'", () => {
    document.getElementById("ad-videos-add").dispatchEvent(new Event("click", { bubbles: true }));
    assert.match(document.querySelector("#ad-videos-list .ad-video-preview").innerHTML, /ยังไม่มีตัวอย่าง/);
  });

  test("ปุ่มเลื่อนขึ้นของรายการแรก disabled, ปุ่มเลื่อนลงของรายการสุดท้าย disabled", () => {
    mod.renderVideoSettings({ introVideos: makeVideos(3) });
    const rows = items();
    assert.equal(rows[0].querySelector('[data-act="up"]').disabled, true);
    assert.equal(rows[0].querySelector('[data-act="down"]').disabled, false);
    assert.equal(rows[2].querySelector('[data-act="up"]').disabled, false);
    assert.equal(rows[2].querySelector('[data-act="down"]').disabled, true);
  });

  test("มี poster → กล่องรูปปกแสดง .ad-img-item (จาก imageGridHTML) ไม่มี poster → 'ยังไม่มีรูปปก'", () => {
    mod.renderVideoSettings({
      introVideos: [
        { url: "https://x/1.mp4", poster: "https://x/poster.jpg" },
        { url: "https://x/2.mp4" },
      ],
    });
    const boxes = document.querySelectorAll(".ad-video-poster-box");
    assert.ok(boxes[0].querySelector(".ad-img-item"));
    assert.match(boxes[1].innerHTML, /ยังไม่มีรูปปก/);
  });
});

describe("ปุ่มเพิ่มวิดีโอ (#ad-videos-add)", () => {
  test("กดครั้งแรกจากว่างเปล่า → มี 1 รายการว่าง (url/title/desc/poster เป็น \"\")", () => {
    document.getElementById("ad-videos-add").dispatchEvent(new Event("click", { bubbles: true }));
    assert.equal(items().length, 1);
    assert.equal(urlInputs()[0].value, "");
  });

  test("เพิ่มจนครบ VIDEOS_MAX=10 → กดอีกครั้งไม่เพิ่ม + toast แจ้งเตือน", () => {
    mod.renderVideoSettings({ introVideos: makeVideos(10) });
    const addBtn = document.getElementById("ad-videos-add");
    addBtn.dispatchEvent(new Event("click", { bubbles: true }));
    assert.equal(items().length, 10);
    const toast = document.querySelector(".cp-toast-wrap .cp-toast");
    assert.ok(toast);
    assert.match(toast.textContent, /เพิ่มวิดีโอได้สูงสุด 10 คลิป/);
  });

  test("ต่ำกว่า 10 → กดเพิ่มได้ตามปกติไม่มี toast", () => {
    mod.renderVideoSettings({ introVideos: makeVideos(9) });
    document.getElementById("ad-videos-add").dispatchEvent(new Event("click", { bubbles: true }));
    assert.equal(items().length, 10);
    assert.equal(document.querySelectorAll(".cp-toast-wrap .cp-toast").length, 0);
  });
});

describe("ปุ่มเลื่อนขึ้น/ลง (.ad-video-item-move)", () => {
  beforeEach(() => {
    mod.renderVideoSettings({ introVideos: makeVideos(3) });
  });

  test("เลื่อนรายการกลาง (idx=1) ขึ้น → สลับกับรายการแรก", () => {
    items()[1].querySelector('[data-act="up"]').dispatchEvent(new Event("click", { bubbles: true }));
    const titles = titleInputs();
    assert.equal(titles[0].value, "หัวข้อ 1");
    assert.equal(titles[1].value, "หัวข้อ 0");
    assert.equal(titles[2].value, "หัวข้อ 2");
  });

  test("เลื่อนรายการกลาง (idx=1) ลง → สลับกับรายการสุดท้าย", () => {
    items()[1].querySelector('[data-act="down"]').dispatchEvent(new Event("click", { bubbles: true }));
    const titles = titleInputs();
    assert.equal(titles[0].value, "หัวข้อ 0");
    assert.equal(titles[1].value, "หัวข้อ 2");
    assert.equal(titles[2].value, "หัวข้อ 1");
  });

  test("คลิกในกล่องแต่ไม่ใช่ปุ่มเลื่อน/ลบ → ไม่มีอะไรเปลี่ยน ไม่ throw", () => {
    assert.doesNotThrow(() => {
      document.querySelector("#ad-videos-list .ad-video-item-head").dispatchEvent(new Event("click", { bubbles: true }));
    });
    assert.equal(items().length, 3);
  });
});

describe("ปุ่มลบวิดีโอ (.ad-video-item-remove)", () => {
  beforeEach(() => {
    mod.renderVideoSettings({ introVideos: makeVideos(3) });
  });

  test("ลบรายการกลาง (idx=1) → เหลือ 2 รายการ (idx 0 กับ 2 เดิม)", () => {
    items()[1].querySelector(".ad-video-item-remove").dispatchEvent(new Event("click", { bubbles: true }));
    const titles = titleInputs();
    assert.equal(items().length, 2);
    assert.equal(titles[0].value, "หัวข้อ 0");
    assert.equal(titles[1].value, "หัวข้อ 2");
  });

  test("ลบจนหมด → กลับไปข้อความ 'ยังไม่มีวิดีโอ'", () => {
    for (let i = 0; i < 3; i++) {
      document.querySelector("#ad-videos-list .ad-video-item-remove").dispatchEvent(new Event("click", { bubbles: true }));
    }
    assert.equal(items().length, 0);
    assert.match(document.getElementById("ad-videos-list").innerHTML, /ยังไม่มีวิดีโอ/);
  });
});

describe("ปุ่มลบรูปปก (.ad-img-remove ใน .ad-video-poster-box)", () => {
  test("มี poster อยู่ → คลิกลบ → poster กลายเป็นค่าว่าง (กล่องกลับเป็น 'ยังไม่มีรูปปก')", () => {
    mod.renderVideoSettings({ introVideos: [{ url: "https://x/1.mp4", poster: "https://x/poster.jpg" }] });
    document.querySelector(".ad-video-poster-box .ad-img-remove").dispatchEvent(new Event("click", { bubbles: true }));
    const box = document.querySelector(".ad-video-poster-box");
    assert.match(box.innerHTML, /ยังไม่มีรูปปก/);
  });

  test("ไม่มี poster ให้ลบ (ไม่มีปุ่มในกล่อง) → ไม่มี .ad-img-remove ให้คลิก ไม่กระทบสถานะอื่น", () => {
    mod.renderVideoSettings({ introVideos: [{ url: "https://x/1.mp4" }] });
    assert.equal(document.querySelectorAll(".ad-video-poster-box .ad-img-remove").length, 0);
  });
});

describe("แก้ไข url/title/desc ผ่าน input event บน #ad-videos-list", () => {
  beforeEach(() => {
    mod.renderVideoSettings({ introVideos: makeVideos(2) });
  });

  test("พิมพ์ url (.ad-video-url) → state เปลี่ยนจริง (ยืนยันผ่าน payload ตอนบันทึก) + เรียก updateVideoPreview (ไม่ re-render ทั้งลิสต์)", async () => {
    const urlEl = urlInputs()[0];
    const itemBefore = items()[0];
    urlEl.value = "https://www.youtube.com/watch?v=newvideoid1";
    urlEl.dispatchEvent(new Event("input", { bubbles: true }));

    // preview อัปเดตแบบ real-time ไม่ re-render ทั้งลิสต์ → node เดิมยังอยู่ (ไม่ถูกแทนที่)
    assert.equal(items()[0], itemBefore);
    const img = itemBefore.querySelector(".ad-video-preview img");
    assert.equal(img.getAttribute("src"), "https://img.youtube.com/vi/newvideoid1/hqdefault.jpg");

    document.getElementById("ad-videos-save").dispatchEvent(new Event("click", { bubbles: true }));
    await flushMicrotasks();
    assert.equal(globalThis.__SET_DOC_CALLS__[0].payload.introVideos[0].url, "https://www.youtube.com/watch?v=newvideoid1");
  });

  test("พิมพ์ title (.ad-video-title) → state เปลี่ยนจริง", async () => {
    const titleEl = titleInputs()[1];
    titleEl.value = "ชื่อใหม่";
    titleEl.dispatchEvent(new Event("input", { bubbles: true }));

    document.getElementById("ad-videos-save").dispatchEvent(new Event("click", { bubbles: true }));
    await flushMicrotasks();
    assert.equal(globalThis.__SET_DOC_CALLS__[0].payload.introVideos[1].title, "ชื่อใหม่");
  });

  test("พิมพ์ desc (.ad-video-desc) → state เปลี่ยนจริง", async () => {
    const descEl = descInputs()[1];
    descEl.value = "คำอธิบายใหม่";
    descEl.dispatchEvent(new Event("input", { bubbles: true }));

    document.getElementById("ad-videos-save").dispatchEvent(new Event("click", { bubbles: true }));
    await flushMicrotasks();
    assert.equal(globalThis.__SET_DOC_CALLS__[0].payload.introVideos[1].desc, "คำอธิบายใหม่");
  });

  test("input event บน element ที่ dataset.idx เป็น NaN หรือชี้ index ที่ไม่มีจริง → ไม่ throw", () => {
    const fakeInput = document.createElement("input");
    fakeInput.className = "ad-video-url";
    fakeInput.dataset.idx = "99";
    document.getElementById("ad-videos-list").appendChild(fakeInput);
    assert.doesNotThrow(() => {
      fakeInput.dispatchEvent(new Event("input", { bubbles: true }));
    });
    fakeInput.remove();
  });

  test("input event บน element อื่นที่ไม่มี class url/title/desc ที่เกี่ยวข้อง → ไม่ throw ไม่มีผล", () => {
    assert.doesNotThrow(() => {
      document.getElementById("ad-videos-list").dispatchEvent(new Event("input", { bubbles: true }));
    });
  });
});

describe("updateVideoPreview() ผ่าน input url — เคสเพิ่มเติม", () => {
  test("video หรือ item ใน DOM ไม่พบ (idx ไม่มีจริง) → return เงียบๆ ไม่ throw", () => {
    mod.renderVideoSettings({ introVideos: makeVideos(1) });
    const urlEl = urlInputs()[0];
    urlEl.dataset.idx = "5"; // ชี้ index ที่ไม่มีจริงใน currentVideos
    assert.doesNotThrow(() => {
      urlEl.dispatchEvent(new Event("input", { bubbles: true }));
    });
  });

  test("ลบ url จนว่างเปล่า → สถานะกลับเป็น 'ยังไม่ได้ตั้งค่า' + placeholder 'ยังไม่มีตัวอย่าง'", () => {
    mod.renderVideoSettings({ introVideos: [{ url: "https://www.youtube.com/watch?v=abcDEF12345" }] });
    const urlEl = urlInputs()[0];
    urlEl.value = "";
    urlEl.dispatchEvent(new Event("input", { bubbles: true }));
    const item = items()[0];
    assert.equal(item.querySelector(".ad-video-item-status").classList.contains("is-empty"), true);
    assert.match(item.querySelector(".ad-video-preview").innerHTML, /ยังไม่มีตัวอย่าง/);
  });

  test("เปลี่ยน url เป็นไฟล์ .mp4 โดยตรง (ไม่มี YouTube id/poster) → placeholder 'ไฟล์วิดีโออัปโหลดแล้ว'", () => {
    mod.renderVideoSettings({ introVideos: [{ url: "https://www.youtube.com/watch?v=abcDEF12345" }] });
    const urlEl = urlInputs()[0];
    urlEl.value = "https://res.cloudinary.com/x/video/upload/v1/clip.mp4";
    urlEl.dispatchEvent(new Event("input", { bubbles: true }));
    assert.match(items()[0].querySelector(".ad-video-preview").innerHTML, /ไฟล์วิดีโออัปโหลดแล้ว/);
  });
});

describe("ปุ่มบันทึก (#ad-videos-save)", () => {
  beforeEach(() => {
    mod.renderVideoSettings({ introVideos: makeVideos(2) });
  });

  test("คลิกบันทึก → saveSettings() ถูกเรียกด้วย path 'settings/main' payload {introVideos} options merge:true", async () => {
    document.getElementById("ad-videos-save").dispatchEvent(new Event("click", { bubbles: true }));
    await flushMicrotasks();

    assert.equal(globalThis.__SET_DOC_CALLS__.length, 1);
    assert.equal(globalThis.__SET_DOC_CALLS__[0].path, "settings/main");
    assert.deepEqual(globalThis.__SET_DOC_CALLS__[0].payload, { introVideos: makeVideos(2) });
    assert.deepEqual(globalThis.__SET_DOC_CALLS__[0].options, { merge: true });
  });

  test("สำเร็จ → ข้อความบันทึกสำเร็จใน #ad-videos-status, ปุ่มกลับมา disabled=false + ข้อความเดิม", async () => {
    const btn = document.getElementById("ad-videos-save");
    const originalText = btn.textContent;

    btn.dispatchEvent(new Event("click", { bubbles: true }));
    await flushMicrotasks();

    assert.match(document.getElementById("ad-videos-status").textContent, /บันทึกสำเร็จ/);
    assert.equal(btn.disabled, false);
    assert.equal(btn.textContent, originalText);
  });

  test("ระหว่างบันทึก ปุ่มถูก disable + เปลี่ยนข้อความเป็น 'กำลังบันทึก...' (เช็คทันทีก่อน microtask resolve)", async () => {
    const btn = document.getElementById("ad-videos-save");
    btn.dispatchEvent(new Event("click", { bubbles: true }));
    assert.equal(btn.disabled, true);
    assert.equal(btn.textContent, "กำลังบันทึก...");
    await flushMicrotasks();
  });

  test("logAudit() ถูกเรียกจากภายใน handler แต่ auth.currentUser เป็น null (ค่าเริ่มต้นของ stub) จึง exit เงียบๆ — ไม่มี addDoc(\"auditLog\") เกิดขึ้น", async () => {
    document.getElementById("ad-videos-save").dispatchEvent(new Event("click", { bubbles: true }));
    await flushMicrotasks();
    assert.equal(globalThis.__ADD_DOC_CALLS__.length, 0);
  });

  test("บันทึกด้วยรายการว่างเปล่าทั้งหมด (ลบวิดีโอหมดก่อนกด) → payload.introVideos เป็น [] ไม่ throw", async () => {
    while (document.querySelector("#ad-videos-list .ad-video-item-remove")) {
      document.querySelector("#ad-videos-list .ad-video-item-remove").dispatchEvent(new Event("click", { bubbles: true }));
    }
    document.getElementById("ad-videos-save").dispatchEvent(new Event("click", { bubbles: true }));
    await flushMicrotasks();
    assert.deepEqual(globalThis.__SET_DOC_CALLS__[0].payload.introVideos, []);
  });

  test("บันทึกโดยมีรายการที่กรอก url ว่าง (จากปุ่มเพิ่มแล้วยังไม่กรอก) → payload กรอง url ว่างออก", async () => {
    document.getElementById("ad-videos-add").dispatchEvent(new Event("click", { bubbles: true }));
    document.getElementById("ad-videos-save").dispatchEvent(new Event("click", { bubbles: true }));
    await flushMicrotasks();
    assert.equal(globalThis.__SET_DOC_CALLS__[0].payload.introVideos.length, 2);
  });
});

describe("ช่องอัปโหลดไฟล์ (.ad-video-file-upload / .ad-video-poster-upload)", () => {
  beforeEach(() => {
    mod.renderVideoSettings({ introVideos: makeVideos(1) });
  });

  test(".ad-video-file-upload มีอยู่จริง พร้อม accept='video/*'", () => {
    const input = document.querySelector(".ad-video-file-upload");
    assert.ok(input);
    assert.equal(input.getAttribute("accept"), "video/*");
  });

  test(".ad-video-poster-upload มีอยู่จริง พร้อม accept='image/*'", () => {
    const input = document.querySelector(".ad-video-poster-upload");
    assert.ok(input);
    assert.equal(input.getAttribute("accept"), "image/*");
  });

  test("change event บนไฟล์ที่ไม่มี files (ไม่ได้เลือกไฟล์จริง) → return เงียบๆ ไม่ throw ไม่มี toast", async () => {
    const input = document.querySelector(".ad-video-file-upload");
    assert.doesNotThrow(() => {
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await flushMicrotasks();
    assert.equal(document.querySelectorAll(".cp-toast-wrap .cp-toast").length, 0);
  });

  test("change event ที่ dataset.idx ไม่มีรายการจริง (idx=99) → return ก่อนถึง files check ไม่ throw", () => {
    const fakeInput = document.createElement("input");
    fakeInput.className = "ad-video-file-upload";
    fakeInput.dataset.idx = "99";
    document.getElementById("ad-videos-list").appendChild(fakeInput);
    assert.doesNotThrow(() => {
      fakeInput.dispatchEvent(new Event("change", { bubbles: true }));
    });
    fakeInput.remove();
  });
});

// helper: รอ microtask queue ระบาย (สำหรับ async event handler ที่ไม่มี promise ให้ await ตรงๆ)
function flushMicrotasks() {
  return new Promise((r) => setTimeout(r, 0));
}
