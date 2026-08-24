// test/site-settings.test.mjs — รอบที่ 137
//
// ขอบเขต: js/site-settings.js (ดึงข้อมูลติดต่อ (เบอร์โทร/LINE/อีเมล/ที่อยู่/Facebook) จาก
// Firestore แล้วอัปเดตให้ตรงกันทุกจุดในหน้า — top-level side effect ล้วนๆ ไม่ export อะไรเลย)
// — ไฟล์นี้ import { getSettings } from "./db-settings.js" ตรงๆ ที่ระดับบนสุด แล้วเรียกทันที
// (`getSettings().then(applySettings).catch(...)`) — ไฟล์เดี่ยว ไม่พันกับไฟล์อื่นเลย (ต่างจาก
// blog-render.js/portfolio-render.js ที่ import จาก db-blog.js/db-content.js ซึ่งใช้ getDocs()
// (พหูพจน์) — ไฟล์นี้ผ่าน db-settings.js ใช้ getDoc() (เอกฐาน) แทน จึงต้องใช้
// globalThis.__GET_DOC_STUB__ ของ firebase-stub-loader.mjs (ไม่ใช่ __GET_DOCS_STUB__) — stub รับ
// ref ที่มี .path === "settings/main" (จาก doc(db,"settings","main") ที่ stub loader คืนเป็น
// `${collectionPath}/${id}`) คืน { exists: bool, data: object }
//
// **จุดใหม่ที่ไม่เคยมีไฟล์เทสไหนในโปรเจกต์ต้องใช้มาก่อน**: ไฟล์เป้าหมายเรียก
// `document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null)` โดยอ้างอิง `NodeFilter`
// เป็นตัวแปร global ตรงๆ (ไม่ได้ import มา) — jsdom มี `window.NodeFilter` ให้อยู่แล้ว แต่ไม่มีไฟล์
// เทสไหนเคย set `globalThis.NodeFilter` มาก่อนเพราะไม่มีไฟล์อื่นเรียก createTreeWalker() เลย —
// ยืนยันด้วย grep ทั้งโปรเจกต์ก่อนเขียนเทส (`grep -rl NodeFilter test/*.test.mjs js/*.js` เจอแค่
// js/site-settings.js ไฟล์เดียว) — เพิ่ม `globalThis.NodeFilter = dom.window.NodeFilter;` ใน
// setupDom() ของไฟล์นี้เท่านั้น ไม่แก้ helper ไฟล์กลางไหนเลย (ไม่กระทบไฟล์เทสอื่น)
//
// ใช้แพทเทิร์น import ด้วย query string คนละอันทุกเทส (`../js/site-settings.js?t=N`) เหมือน
// blog-render.js/portfolio-render.js เพื่อบังคับ module instance ใหม่ (getSettings() top-level
// call ต้องยิงใหม่ทุกเทสตาม __GET_DOC_STUB__ ที่ตั้งไว้ก่อน import) — ยืนยันด้วย probe จริงก่อน
// เขียนเทสว่า flow เต็ม (tel/mailto/LINE href, QR src+alt, ข้อความ, data-site-*) ทำงานตรงตามที่
// อ่านโค้ดคาดไว้ทุกจุด (probe1 ใน session นี้)
//
// อ่านโค้ดจริงทั้งไฟล์ js/site-settings.js ก่อนเขียนเทส (อ่านครบ) — ไม่พบบั๊ก

import { test, describe, afterEach } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

let dom;
let importCounter = 0;

const DEFAULTS = {
  phoneRaw:    "0628833880",
  phone:       "062-883-3880",
  phone2:      "063-978-5670",
  fax:         "02-115-0850",
  email:       "cssigngroup@gmail.com",
  lineUrl:     "https://line.me/ti/p/@cssigngroup",
  lineHandle:  "@cssigngroup",
  facebookUrl: "https://www.facebook.com/cssignonline/",
  address:     "17 ซอยบางกระดี่ 1 แขวงแสมดำ เขตบางขุนเทียน กรุงเทพมหานคร 10150"
};

// หน้าจำลองที่มีทุกจุดที่ไฟล์เป้าหมายแตะ: tel/mailto/LINE/Facebook links (2 ชุดต่อแบบ เพื่อยืนยัน
// ว่าอัปเดตครบทุก element ที่ตรง selector ไม่ใช่แค่ตัวแรก), QR image (LINE), ข้อความที่มีค่า default
// ปนกันหลายจุด/หลายรอบในโหนดเดียว, และ data-site-* elements
function fullPageHtml() {
  return `
    <a id="tel1" href="tel:${DEFAULTS.phoneRaw}">${DEFAULTS.phone}</a>
    <a id="tel2" href="tel:${DEFAULTS.phoneRaw}">โทรเลย</a>
    <a id="mail1" href="mailto:${DEFAULTS.email}">${DEFAULTS.email}</a>
    <a id="mail2" href="mailto:${DEFAULTS.email}">ส่งอีเมล</a>
    <a id="line1" href="${DEFAULTS.lineUrl}">แอด LINE</a>
    <a id="line2" href="${DEFAULTS.lineUrl}">คุยผ่าน LINE</a>
    <a id="fb1" href="${DEFAULTS.facebookUrl}">Facebook</a>
    <img id="qr1" src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&amp;data=${encodeURIComponent(DEFAULTS.lineUrl)}" alt="QR LINE ${DEFAULTS.lineHandle}">
    <img id="qr-noalt" src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&amp;data=${encodeURIComponent(DEFAULTS.lineUrl)}">
    <img id="not-qr" src="https://example.com/logo.png" alt="โลโก้">
    <p id="txt-phone">โทร ${DEFAULTS.phone} หรือ ${DEFAULTS.phone2} (สายด่วน ${DEFAULTS.phone})</p>
    <p id="txt-fax">แฟกซ์ ${DEFAULTS.fax}</p>
    <p id="txt-email">${DEFAULTS.email}</p>
    <p id="txt-address">${DEFAULTS.address}</p>
    <p id="txt-line">แอด LINE ${DEFAULTS.lineHandle} วันนี้</p>
    <p id="txt-empty">   </p>
    <span id="dsp" data-site-phone>ค่าเดิม</span>
    <span id="dse" data-site-email>ค่าเดิม</span>
    <span id="dsa" data-site-address>ค่าเดิม</span>
  `;
}

function setupDom(html = fullPageHtml(), pathname = "/index.html") {
  dom = new JSDOM(`<!doctype html><html><body>${html}</body></html>`, {
    url: `https://example.test${pathname}`,
    pretendToBeVisual: true
  });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.NodeFilter = dom.window.NodeFilter;
  return dom;
}

function stubSettings(data) {
  globalThis.__GET_DOC_STUB__ = (ref) => {
    if (ref && ref.path === "settings/main") {
      return data === null ? { exists: false } : { exists: true, data };
    }
    return { exists: false };
  };
}

function stubThrow(err) {
  globalThis.__GET_DOC_STUB__ = () => { throw err; };
}

async function importFresh() {
  importCounter += 1;
  await import(`../js/site-settings.js?t=${importCounter}`);
  // getSettings() ต้องผ่าน microtask chain: getDoc() -> noopAsync().then() -> getSettings()
  // await -> .then(applySettings)/.catch() — เผื่อหลายรอบให้ชัวร์ (ไม่มี delay hook ในไฟล์นี้)
  await new Promise((r) => setImmediate(r));
  await new Promise((r) => setImmediate(r));
  await new Promise((r) => setImmediate(r));
}

function $(id) { return dom.window.document.getElementById(id); }

afterEach(() => {
  delete globalThis.__GET_DOC_STUB__;
});

describe("site-settings — ไม่มีเอกสารตั้งค่าเลย (exists:false) → ไม่แตะหน้าเลย", () => {
  test("settings เป็น null → href/ข้อความ/data-site-* ทั้งหมดคงค่าเริ่มต้นเดิม ไม่ throw", async () => {
    setupDom();
    stubSettings(null);
    await importFresh();
    assert.equal($("tel1").getAttribute("href"), `tel:${DEFAULTS.phoneRaw}`);
    assert.equal($("mail1").getAttribute("href"), `mailto:${DEFAULTS.email}`);
    assert.equal($("line1").getAttribute("href"), DEFAULTS.lineUrl);
    assert.equal($("fb1").getAttribute("href"), DEFAULTS.facebookUrl);
    assert.match($("txt-phone").textContent, new RegExp(DEFAULTS.phone.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.equal($("dsp").textContent, "ค่าเดิม");
  });
});

describe("site-settings — getSettings() reject → catch เงียบๆ ไม่ throw ไม่แก้หน้า", () => {
  test("getDoc stub throw → console.warn ถูกเรียก 1 ครั้ง, หน้าเว็บคงค่าเริ่มต้นเดิมทั้งหมด", async () => {
    setupDom();
    stubThrow(new Error("โหลดล้มเหลว"));
    const originalWarn = console.warn;
    const calls = [];
    console.warn = (...args) => calls.push(args);
    try {
      await importFresh();
    } finally {
      console.warn = originalWarn;
    }
    assert.equal(calls.length, 1);
    assert.match(calls[0][0], /\[site-settings\]/);
    assert.equal($("tel1").getAttribute("href"), `tel:${DEFAULTS.phoneRaw}`);
    assert.equal($("dse").textContent, "ค่าเดิม");
  });
});

describe("site-settings — settings ครบทุกฟิลด์ → อัปเดตครบทุกจุดในหน้า", () => {
  test("tel href ทุกลิงก์ → เบอร์ใหม่แบบตัวเลขล้วน (digitsOnly ตัดขีดออก)", async () => {
    setupDom();
    stubSettings({ phone: "099-999-9999" });
    await importFresh();
    assert.equal($("tel1").getAttribute("href"), "tel:0999999999");
    assert.equal($("tel2").getAttribute("href"), "tel:0999999999");
  });

  test("mailto href ทุกลิงก์ → อีเมลใหม่ตรงตามค่า settings", async () => {
    setupDom();
    stubSettings({ email: "new@example.com" });
    await importFresh();
    assert.equal($("mail1").getAttribute("href"), "mailto:new@example.com");
    assert.equal($("mail2").getAttribute("href"), "mailto:new@example.com");
  });

  test("LINE href ทุกลิงก์ → เปลี่ยนเป็น lineUrl ใหม่ตรงตัว", async () => {
    setupDom();
    stubSettings({ lineUrl: "https://line.me/ti/p/@newhandle" });
    await importFresh();
    assert.equal($("line1").getAttribute("href"), "https://line.me/ti/p/@newhandle");
    assert.equal($("line2").getAttribute("href"), "https://line.me/ti/p/@newhandle");
  });

  test("Facebook href → เปลี่ยนเป็น facebookUrl ใหม่ตรงตัว", async () => {
    setupDom();
    stubSettings({ facebookUrl: "https://www.facebook.com/newpage" });
    await importFresh();
    assert.equal($("fb1").getAttribute("href"), "https://www.facebook.com/newpage");
  });

  test("QR image (มีทั้ง qrserver.com และ line.me ใน src) → data= param เปลี่ยนเป็น lineUrl ใหม่ (encoded), alt แทนที่ handle เดิมด้วยใหม่", async () => {
    setupDom();
    stubSettings({ lineUrl: "https://line.me/ti/p/@newhandle" });
    await importFresh();
    const expectedEncoded = encodeURIComponent("https://line.me/ti/p/@newhandle");
    assert.equal(
      $("qr1").getAttribute("src"),
      `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${expectedEncoded}`
    );
    assert.equal($("qr1").getAttribute("alt"), "QR LINE @newhandle");
  });

  test("QR image ที่ไม่มี alt attribute เลย → src ยังอัปเดตปกติ ไม่ throw (ไม่มี alt ให้แก้)", async () => {
    setupDom();
    stubSettings({ lineUrl: "https://line.me/ti/p/@newhandle" });
    await importFresh();
    const expectedEncoded = encodeURIComponent("https://line.me/ti/p/@newhandle");
    assert.equal(
      $("qr-noalt").getAttribute("src"),
      `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${expectedEncoded}`
    );
    assert.equal($("qr-noalt").hasAttribute("alt"), false);
  });

  test("รูปที่ไม่ตรง selector (ไม่มี qrserver.com หรือ line.me ใน src) → ไม่ถูกแตะเลย", async () => {
    setupDom();
    stubSettings({ lineUrl: "https://line.me/ti/p/@newhandle" });
    await importFresh();
    assert.equal($("not-qr").getAttribute("src"), "https://example.com/logo.png");
    assert.equal($("not-qr").getAttribute("alt"), "โลโก้");
  });

  test("ข้อความ (text node): แทนที่ phone ทุกจุดที่ปรากฏในโหนดเดียวกัน (เกิดซ้ำ 2 ครั้ง)", async () => {
    setupDom();
    stubSettings({ phone: "099-999-9999" });
    await importFresh();
    assert.equal(
      $("txt-phone").textContent,
      `โทร 099-999-9999 หรือ ${DEFAULTS.phone2} (สายด่วน 099-999-9999)`
    );
  });

  test("ข้อความ: แทนที่ phone2/fax/email/address ตามค่าที่ตั้ง", async () => {
    setupDom();
    stubSettings({
      phone2: "088-000-1111",
      fax: "02-999-0000",
      email: "new@example.com",
      address: "ที่อยู่ใหม่ กรุงเทพฯ"
    });
    await importFresh();
    assert.match($("txt-phone").textContent, /088-000-1111/);
    assert.equal($("txt-fax").textContent, "แฟกซ์ 02-999-0000");
    assert.equal($("txt-email").textContent, "new@example.com");
    assert.equal($("txt-address").textContent, "ที่อยู่ใหม่ กรุงเทพฯ");
  });

  test("ข้อความ: แทนที่ @handle (จาก lineUrl) ทุกจุดที่มี @cssigngroup เดิม", async () => {
    setupDom();
    stubSettings({ lineUrl: "https://line.me/ti/p/@newhandle" });
    await importFresh();
    assert.equal($("txt-line").textContent, "แอด LINE @newhandle วันนี้");
  });

  test("data-site-phone/data-site-email/data-site-address → textContent ถูกตั้งค่าใหม่ตรงตัว", async () => {
    setupDom();
    stubSettings({
      phone: "099-999-9999",
      email: "new@example.com",
      address: "ที่อยู่ใหม่ กรุงเทพฯ"
    });
    await importFresh();
    assert.equal($("dsp").textContent, "099-999-9999");
    assert.equal($("dse").textContent, "new@example.com");
    assert.equal($("dsa").textContent, "ที่อยู่ใหม่ กรุงเทพฯ");
  });

  test("text node ที่เป็นช่องว่างล้วน (whitespace-only) → ข้ามไปเลย ไม่ throw ไม่เปลี่ยนอะไร", async () => {
    setupDom();
    stubSettings({ phone: "099-999-9999" });
    await importFresh();
    assert.equal($("txt-empty").textContent, "   ");
  });
});

describe("site-settings — settings มีบางฟิลด์เท่านั้น → อัปเดตเฉพาะจุดที่มีค่า ที่เหลือคงค่าเริ่มต้น", () => {
  test("มีแค่ phone → mailto/LINE/Facebook/ที่อยู่ ยังเป็นค่าเริ่มต้นเดิมหมด", async () => {
    setupDom();
    stubSettings({ phone: "099-999-9999" });
    await importFresh();
    assert.equal($("tel1").getAttribute("href"), "tel:0999999999");
    assert.equal($("mail1").getAttribute("href"), `mailto:${DEFAULTS.email}`);
    assert.equal($("line1").getAttribute("href"), DEFAULTS.lineUrl);
    assert.equal($("fb1").getAttribute("href"), DEFAULTS.facebookUrl);
    assert.equal($("txt-address").textContent, DEFAULTS.address);
  });

  test("มีแค่ address → data-site-phone/data-site-email ยังเป็น \"ค่าเดิม\" (ไม่ถูกแตะ เพราะ phone/email ว่าง)", async () => {
    setupDom();
    stubSettings({ address: "ที่อยู่ใหม่" });
    await importFresh();
    assert.equal($("dsp").textContent, "ค่าเดิม");
    assert.equal($("dse").textContent, "ค่าเดิม");
    assert.equal($("dsa").textContent, "ที่อยู่ใหม่");
  });

  test("object ว่างเปล่าทั้งหมด ({}) → ทุกฟิลด์ fallback เป็นค่าว่าง → ไม่มีอะไรเปลี่ยนเลยทั้งหน้า", async () => {
    setupDom();
    stubSettings({});
    await importFresh();
    assert.equal($("tel1").getAttribute("href"), `tel:${DEFAULTS.phoneRaw}`);
    assert.equal($("mail1").getAttribute("href"), `mailto:${DEFAULTS.email}`);
    assert.equal($("line1").getAttribute("href"), DEFAULTS.lineUrl);
    assert.equal($("fb1").getAttribute("href"), DEFAULTS.facebookUrl);
    assert.equal($("txt-address").textContent, DEFAULTS.address);
    assert.equal($("dsp").textContent, "ค่าเดิม");
  });
});

describe("site-settings — extractLineHandle(): กรณี LINE URL รูปแบบต่างๆ", () => {
  test("lineUrl ไม่ตรง pattern /p/@ หรือ /p/%40 เลย → lineHandle ว่าง → href เปลี่ยนตาม lineUrl ปกติ แต่ข้อความ @handle เดิมไม่ถูกแทนที่", async () => {
    setupDom();
    stubSettings({ lineUrl: "https://line.me/R/ti/xyz" });
    await importFresh();
    assert.equal($("line1").getAttribute("href"), "https://line.me/R/ti/xyz");
    assert.equal($("txt-line").textContent, `แอด LINE ${DEFAULTS.lineHandle} วันนี้`);
  });

  test("lineUrl ใช้ %40 แบบ encoded แทน @ ตรงๆ → decode เป็น @handle ถูกต้อง", async () => {
    setupDom();
    stubSettings({ lineUrl: "https://line.me/ti/p/%40encodedhandle" });
    await importFresh();
    assert.equal($("txt-line").textContent, "แอด LINE @encodedhandle วันนี้");
  });

  test("lineUrl มี query/hash ต่อท้าย handle → ตัดที่ /?#\\ อย่างถูกต้อง ไม่รวมส่วนเกิน", async () => {
    setupDom();
    stubSettings({ lineUrl: "https://line.me/ti/p/@cleanhandle?ref=footer" });
    await importFresh();
    assert.equal($("txt-line").textContent, "แอด LINE @cleanhandle วันนี้");
  });

  test("handle มี % encoding ที่ไม่ใช่รูปแบบถูกต้อง (decodeURIComponent throw) → fallback คืนค่าดิบไม่ decode แทนที่จะพัง", async () => {
    setupDom();
    stubSettings({ lineUrl: "https://line.me/ti/p/@abc%zzbad" });
    await importFresh();
    assert.equal($("txt-line").textContent, "แอด LINE @abc%zzbad วันนี้");
  });
});

describe("site-settings — ไม่มี element เป้าหมายในหน้าเลย → ไม่ throw", () => {
  test("หน้าเปล่าไม่มี a/img/data-site-* เลยสักตัว → applySettings ทำงานจบโดยไม่ throw", async () => {
    setupDom("<p>หน้าว่างเปล่า ไม่มี element เป้าหมาย</p>");
    stubSettings({
      phone: "099-999-9999",
      email: "new@example.com",
      lineUrl: "https://line.me/ti/p/@newhandle",
      facebookUrl: "https://fb.com/new",
      address: "ที่อยู่ใหม่"
    });
    await assert.doesNotReject(importFresh());
  });
});
