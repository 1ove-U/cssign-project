// test/home-dynamic.test.mjs — รอบที่ 142
//
// ขอบเขต: js/home-dynamic.js (บทความล่าสุดหน้าแรก + escapeHtml/fadeSwap ที่ export ให้ไฟล์อื่น
// ใช้ร่วม)
//
// อ่านโค้ดจริงก่อนเขียนเทส — เป็น IIFE-style top-level side effect (ไม่มี DOMContentLoaded guard
// เรียก renderLatestBlogs() ทันทีตอน import) จึงต้อง set window/document (jsdom) ให้ครบ "ก่อน"
// import ทุกครั้ง แล้ว import ด้วย query string คนละอันทุกเทส (เหมือน blog-render.test.mjs) เพื่อ
// บังคับ module instance ใหม่
//
// (หมายเหตุ: เดิมไฟล์นี้เทสคู่กับ js/home-dynamic-social.js ด้วยเพราะมี circular import ระหว่างกัน
// (renderClientLogos/circleTileHTML/fillRowHTML ที่เรนเดอร์โลโก้ลูกค้า 2 แถว #home-clients-row-a/b)
// — home-dynamic-social.js ถูกลบทิ้งทั้งไฟล์พร้อมฟีเจอร์ "โลโก้ลูกค้า/รีวิวลูกค้า" และ home-dynamic.js
// ก็ไม่ import จากไฟล์นั้นแล้ว จึงไม่มี circular import เหลืออยู่อีกต่อไป — ตัดส่วนเทส
// renderClientLogos ทั้งหมดออกจากไฟล์นี้ด้วย)

import { test, describe, afterEach } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

let dom;
let importCounter = 0;

function setupDom({
  pathname = "/index.html",
  hasBlogGrid = true,
  blogGridHtml = ""
} = {}) {
  const blog = hasBlogGrid ? `<div class="home-blog-grid" id="home-blog-grid">${blogGridHtml}</div>` : "";
  dom = new JSDOM(`<!doctype html><html><body>${blog}</body></html>`, {
    url: `https://example.test${pathname}`,
    pretendToBeVisual: true
  });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.requestAnimationFrame = dom.window.requestAnimationFrame;
  return dom;
}

function stubData({ blogs } = {}) {
  globalThis.__GET_DOCS_STUB__ = (ref) => {
    if (ref && ref.path === "blogs") return blogs === undefined ? [] : blogs;
    return [];
  };
}

function stubThrow(pathToThrow, err) {
  globalThis.__GET_DOCS_STUB__ = (ref) => {
    if (ref && ref.path === pathToThrow) throw err;
    return [];
  };
}

async function importFresh() {
  importCounter += 1;
  const mod = await import(`../js/home-dynamic.js?t=${importCounter}`);
  // getBlogs() ผ่าน noopAsync().then(run) (1 microtask) แล้ว renderLatestBlogs() ยังมี await
  // อีกชั้นก่อน fadeSwap — flush ให้พอหลายรอบกันตกหล่น (เหมือน blog-render.test.mjs)
  await new Promise((r) => setImmediate(r));
  await new Promise((r) => setImmediate(r));
  await new Promise((r) => setImmediate(r));
  return mod;
}

function post(overrides) {
  return {
    id: overrides.id || "id-" + Math.random().toString(36).slice(2),
    data: {
      title: "หัวข้อทดสอบ",
      slug: "test-slug",
      excerpt: "ข้อความสรุปสั้นๆ",
      content: "เนื้อหาบทความ",
      createdAt: 1700000000000,
      status: "published",
      ...overrides
    }
  };
}

function blogGrid() {
  return dom.window.document.getElementById("home-blog-grid");
}

afterEach(() => {
  delete globalThis.__GET_DOCS_STUB__;
});

// =====================================================================
// escapeHtml() — ฟังก์ชันล้วน (pure), เทสตรงๆ ไม่ต้องพึ่ง DOM
// =====================================================================
describe("home-dynamic — escapeHtml()", () => {
  test("escape ครบ 5 ตัวอักษรอันตราย (& < > \" ')", async () => {
    setupDom();
    const { escapeHtml } = await importFresh();
    assert.equal(escapeHtml(`<a href="x">&'test'</a>`), "&lt;a href=&quot;x&quot;&gt;&amp;&#39;test&#39;&lt;/a&gt;");
  });
  test("null/undefined → สตริงว่าง", async () => {
    setupDom();
    const { escapeHtml } = await importFresh();
    assert.equal(escapeHtml(null), "");
    assert.equal(escapeHtml(undefined), "");
  });
  test("ค่าที่ไม่ใช่สตริง (number) ถูกแปลงเป็นสตริงก่อน escape", async () => {
    setupDom();
    const { escapeHtml } = await importFresh();
    assert.equal(escapeHtml(123), "123");
  });
  test("สตริงปกติไม่มีอักขระอันตราย → คืนค่าเดิม", async () => {
    setupDom();
    const { escapeHtml } = await importFresh();
    assert.equal(escapeHtml("ข้อความปกติ"), "ข้อความปกติ");
  });
});

// =====================================================================
// fadeSwap(el, mutate)
// =====================================================================
describe("home-dynamic — fadeSwap()", () => {
  test("el เป็น null/undefined → เรียก mutate() ทันที ไม่ throw ไม่แตะ style ใดๆ", async () => {
    setupDom();
    const { fadeSwap } = await importFresh();
    let called = false;
    assert.doesNotThrow(() => fadeSwap(null, () => { called = true; }));
    assert.equal(called, true);
  });

  test("el จริง: ตั้ง transition ก่อน mutate() แล้วค่อยลด opacity เหลือ 0.45 ทันทีหลัง mutate", async () => {
    setupDom();
    const { fadeSwap } = await importFresh();
    const el = dom.window.document.createElement("div");
    let mutatedBeforeOpacityDrop = null;
    fadeSwap(el, () => {
      mutatedBeforeOpacityDrop = el.style.opacity !== "0.45";
      el.textContent = "เปลี่ยนแล้ว";
    });
    assert.equal(mutatedBeforeOpacityDrop, true, "mutate() ต้องถูกเรียกก่อนที่ opacity จะถูกลด");
    assert.equal(el.textContent, "เปลี่ยนแล้ว");
    assert.equal(el.style.opacity, "0.45");
    assert.equal(el.style.transition, "opacity 220ms ease");
  });

  test("opacity กลับเป็น 1 หลัง requestAnimationFrame คู่ (สองรอบถัดไป)", async () => {
    setupDom();
    const { fadeSwap } = await importFresh();
    const el = dom.window.document.createElement("div");
    fadeSwap(el, () => {});
    assert.equal(el.style.opacity, "0.45");
    await new Promise((r) => setTimeout(r, 60));
    assert.equal(el.style.opacity, "1");
  });

  test("transition กลับเป็นค่าเดิม (prevTransition) หลังผ่าน FADE_MS (220ms)", async () => {
    setupDom();
    const { fadeSwap } = await importFresh();
    const el = dom.window.document.createElement("div");
    el.style.transition = "color 1s linear";
    fadeSwap(el, () => {});
    assert.equal(el.style.transition, "opacity 220ms ease");
    await new Promise((r) => setTimeout(r, 260));
    assert.equal(el.style.transition, "color 1s linear", "ต้องกลับเป็นค่า transition เดิมก่อนเรียก fadeSwap");
  });
});

// =====================================================================
// renderLatestBlogs() — เรียกอัตโนมัติตอน import (top-level side effect)
// =====================================================================
describe("home-dynamic — renderLatestBlogs(): ไม่มี #home-blog-grid", () => {
  test("ไม่มี element เลย → ไม่เรียก getBlogs, ไม่ throw", async () => {
    setupDom({ hasBlogGrid: false });
    let calledBlogs = false;
    globalThis.__GET_DOCS_STUB__ = (ref) => {
      if (ref && ref.path === "blogs") calledBlogs = true;
      return [];
    };
    await assert.doesNotReject(importFresh());
    assert.equal(calledBlogs, false);
  });
});

describe("home-dynamic — renderLatestBlogs(): ไม่มีบทความเผยแพร่ → ปล่อยการ์ดตัวอย่างเดิม", () => {
  test("published.length === 0 (ทุกโพสต์เป็น draft) → grid ไม่ถูกแตะเลย", async () => {
    setupDom({ blogGridHtml: "STATIC-FALLBACK-CARDS" });
    stubData({ blogs: [post({ id: "1", status: "draft" })] });
    await importFresh();
    assert.equal(blogGrid().innerHTML, "STATIC-FALLBACK-CARDS");
  });

  test("ไม่มีโพสต์เลย (array ว่าง) → grid ไม่ถูกแตะเช่นกัน", async () => {
    setupDom({ blogGridHtml: "STATIC-FALLBACK-CARDS" });
    stubData({ blogs: [] });
    await importFresh();
    assert.equal(blogGrid().innerHTML, "STATIC-FALLBACK-CARDS");
  });
});

describe("home-dynamic — renderLatestBlogs(): มีบทความเผยแพร่", () => {
  test("แสดงแค่ 3 อันดับแรกตามลำดับเดิมของ getBlogs() (ไม่ sort ซ้ำ), กรอง draft ออก", async () => {
    setupDom();
    stubData({
      blogs: [
        post({ id: "1", title: "อันดับ1", status: "draft" }),
        post({ id: "2", title: "อันดับ2" }),
        post({ id: "3", title: "อันดับ3" }),
        post({ id: "4", title: "อันดับ4" }),
        post({ id: "5", title: "อันดับ5" })
      ]
    });
    await importFresh();
    const html = blogGrid().innerHTML;
    assert.ok(!html.includes("อันดับ1"), "draft ต้องถูกกรองออก");
    assert.match(html, /อันดับ2/);
    assert.match(html, /อันดับ3/);
    assert.match(html, /อันดับ4/);
    assert.ok(!html.includes("อันดับ5"), "ต้องแสดงแค่ 3 อันดับแรกหลังกรอง draft");
    const i2 = html.indexOf("อันดับ2");
    const i3 = html.indexOf("อันดับ3");
    const i4 = html.indexOf("อันดับ4");
    assert.ok(i2 < i3 && i3 < i4, "ต้องเรียงตามลำดับเดิมที่ getBlogs() คืนมา");
  });

  test("href ใช้ blog-post.html (root) บนหน้า TH พร้อม slug encode", async () => {
    setupDom({ pathname: "/index.html" });
    stubData({ blogs: [post({ id: "1", slug: "a b/c" })] });
    await importFresh();
    assert.match(blogGrid().innerHTML, /href="blog-post\.html\?slug=a%20b%2Fc"/);
    assert.ok(!blogGrid().innerHTML.includes("lang-tag"), "หน้า TH ต้องไม่มีป้าย TH");
  });

  test("href ใช้ ../blog-post.html พร้อมป้าย TH lang-tag บนหน้า EN (en/index.html)", async () => {
    setupDom({ pathname: "/en/index.html" });
    stubData({ blogs: [post({ id: "1", slug: "hello" })] });
    await importFresh();
    const html = blogGrid().innerHTML;
    assert.match(html, /href="\.\.\/blog-post\.html\?slug=hello"/);
    assert.match(html, /lang-tag/);
  });

  test("escapeHtml ป้องกัน XSS ใน title/excerpt", async () => {
    setupDom();
    stubData({ blogs: [post({ id: "1", title: '<script>x</script>', excerpt: '"><img onerror=1>' })] });
    await importFresh();
    const html = blogGrid().innerHTML;
    assert.ok(!html.includes("<script>x</script>"));
    assert.match(html, /&lt;script&gt;/);
    assert.ok(!html.includes('<img onerror=1>'));
  });

  test("มี category → badge blog-tag, ไม่มี category → ไม่มี badge", async () => {
    setupDom();
    stubData({
      blogs: [
        post({ id: "1", title: "มีหมวด", category: "ป้ายไฟ" }),
        post({ id: "2", title: "ไม่มีหมวด", category: "" })
      ]
    });
    await importFresh();
    const html = blogGrid().innerHTML;
    assert.match(html, /<span class="blog-tag">ป้ายไฟ<\/span>/);
    // ตรวจว่าการ์ด "ไม่มีหมวด" ไม่มี blog-tag ก่อนหน้าชื่อของมันเอง (ตัดช่วงข้อความรอบ h3 ของมัน)
    const idxNoCat = html.indexOf("ไม่มีหมวด");
    const segment = html.slice(Math.max(0, idxNoCat - 200), idxNoCat);
    assert.ok(!segment.includes("blog-tag"), "การ์ดที่ไม่มี category ต้องไม่มี badge");
  });

  test("มี post.image → <img> จริง, ไม่มี → placeholder svg + label", async () => {
    setupDom();
    stubData({
      blogs: [
        post({ id: "1", title: "มีรูป", image: "https://cdn.test/a.jpg" }),
        post({ id: "2", title: "ไม่มีรูป", image: "" })
      ]
    });
    await importFresh();
    const html = blogGrid().innerHTML;
    assert.match(html, /<img src="https:\/\/cdn\.test\/a\.jpg" alt="มีรูป"/);
    assert.match(html, /img-ph-label">ไม่มีรูป</);
  });

  test("มี createdAt → แสดงวันที่ไทย, ไม่มี createdAt → fallback 'อ่าน N นาที'", async () => {
    setupDom();
    stubData({
      blogs: [
        post({ id: "1", title: "มีวันที่", createdAt: 1700000000000 }),
        post({ id: "2", title: "ไม่มีวันที่", createdAt: 0, content: "a ".repeat(300) })
      ]
    });
    await importFresh();
    const html = blogGrid().innerHTML;
    assert.match(html, /14 พ\.ย\. 2566/);
    assert.match(html, /อ่าน \d+ นาที/);
  });

  test("getBlogs() reject → grid ไม่ถูกแตะ (ยังเป็นการ์ดตัวอย่างเดิม), ไม่ throw", async () => {
    setupDom({ blogGridHtml: "STATIC-FALLBACK-CARDS" });
    stubThrow("blogs", new Error("network down"));
    await assert.doesNotReject(importFresh());
    assert.equal(blogGrid().innerHTML, "STATIC-FALLBACK-CARDS");
  });
});

