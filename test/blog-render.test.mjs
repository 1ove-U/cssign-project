// test/blog-render.test.mjs — รอบที่ 135
//
// ขอบเขต: js/blog-render.js (เรนเดอร์การ์ดบทความจริงจาก Firestore ในหน้า blog.html/en/blog.html)
// — ไฟล์นี้ import { getBlogs } from "./db-blog.js" ที่ระดับบนสุด แล้วเรียก init() ทันทีตอน
// module ถูก evaluate (top-level side effect, ไม่ export อะไรเลย) อ่าน document.getElementById()/
// window.location.pathname ตอน import ด้วย — จึงต้อง set global window/document (jsdom) +
// __GET_DOCS_STUB__ ให้ครบ "ก่อน" import ทุกครั้ง แล้ว import ด้วย query string คนละอันทุกเทส
// (เช่น "../js/blog-render.js?t=1") เพื่อบังคับให้ได้ module instance ใหม่ (มี GRID_EL/
// FEATURED_EL/IN_EN_FOLDER เป็นค่าตาม DOM/URL ของเทสนั้นๆ จริง) — ไม่มีไฟล์เทสไหนในโปรเจกต์ใช้
// แพทเทิร์นนี้มาก่อน (ทุกไฟล์ก่อนหน้า import แค่ครั้งเดียวใน before() เพราะไม่ต้องเปลี่ยน
// window.location.pathname ระหว่างเทส) — ยืนยันด้วย probe ก่อนเขียนเทสจริงว่า query-string
// cache-bust ใช้ได้จริงในสภาพแวดล้อมนี้ (ไม่ชนกับ firebase-stub-loader.mjs เพราะ loader นั้นดัก
// เฉพาะ URL ของ gstatic.com เท่านั้น ไม่ยุ่งกับการ resolve relative specifier ธรรมดา)
//
// **แก้ test/helpers/firebase-stub-loader.mjs เพิ่ม 1 จุด (infra เทส ไม่ใช่โค้ดผลิตภัณฑ์)**:
// เพิ่ม globalThis.__GET_DOCS_DELAY_MS__ (optional) ให้ getDocs() ใช้ setTimeout(ms) จริงแทน
// Promise.resolve() เดิม — จำเป็นเพราะยืนยันด้วย probe แล้วว่า noopAsync() เดิม resolve ผ่าน
// microtask เสมอ ซึ่ง "เร็วกว่า" macrotask timer ใดๆ เสมอไม่ว่าจะรอกี่ ms — ทำให้ไม่มีทางพิสูจน์
// ได้เลยว่า SKELETON_DELAY=260ms ของไฟล์นี้ทำงานถูกต้อง (แพ้ race กับ microtask ทุกครั้ง) ถ้าไม่มี
// hook นี้ — ไม่ตั้งไว้ (undefined) ใช้พฤติกรรมเดิมทุกประการ ไม่กระทบเทสเดิมไฟล์ไหนเลย
// (ยืนยันด้วย `npm test` เต็ม 1573/1573 ผ่านก่อนเริ่มเขียนเทสไฟล์นี้)
//
// ตรวจโค้ดจริงทั้งไฟล์ js/blog-render.js ก่อนเขียนเทส (อ่านครบ) — ไม่พบบั๊ก

import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

let dom;
let importCounter = 0;

function setupDom({ pathname = "/blog.html", gridHtml = "", featuredHtml = "" } = {}) {
  dom = new JSDOM(
    `<!doctype html><html><body>
      <div id="blog-grid-dynamic">${gridHtml}</div>
      <div id="blog-featured-dynamic">${featuredHtml}</div>
    </body></html>`,
    { url: `https://example.test${pathname}`, pretendToBeVisual: true }
  );
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.requestAnimationFrame = dom.window.requestAnimationFrame;
  return dom;
}

function setupDomPartial(pathname, ids) {
  // ids: { grid: bool, featured: bool } — จำลองหน้าที่มีแค่ element เดียว หรือไม่มีเลย
  const grid = ids.grid ? `<div id="blog-grid-dynamic"></div>` : "";
  const featured = ids.featured ? `<div id="blog-featured-dynamic"></div>` : "";
  dom = new JSDOM(`<!doctype html><html><body>${grid}${featured}</body></html>`, {
    url: `https://example.test${pathname}`,
    pretendToBeVisual: true
  });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.requestAnimationFrame = dom.window.requestAnimationFrame;
  return dom;
}

function stubPosts(posts) {
  globalThis.__GET_DOCS_STUB__ = (ref) => {
    if (ref && ref.path === "blogs") return posts;
    return [];
  };
}

function stubThrow(err) {
  globalThis.__GET_DOCS_STUB__ = () => { throw err; };
}

async function importFresh() {
  importCounter += 1;
  await import(`../js/blog-render.js?t=${importCounter}`);
  // เผื่อ microtask chain (getDocs -> getBlogs -> init) ทำงานครบ (ไม่มี delay hook ตั้งไว้)
  await new Promise((r) => setImmediate(r));
  await new Promise((r) => setImmediate(r));
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

function grid() {
  return dom.window.document.getElementById("blog-grid-dynamic");
}
function featured() {
  return dom.window.document.getElementById("blog-featured-dynamic");
}

afterEach(() => {
  delete globalThis.__GET_DOCS_STUB__;
  delete globalThis.__GET_DOCS_DELAY_MS__;
  delete globalThis.window.CSSIGN_observeReveal;
});

describe("blog-render — หน้า TH (blog.html) — โพสต์เดียว → ปักหมุดเป็นการ์ดเด่น", () => {
  test("โพสต์เดียว → featured = โพสต์นั้น, grid แสดงข้อความยังไม่มีบทความอื่น", async () => {
    setupDom({ pathname: "/blog.html" });
    stubPosts([post({ id: "1", title: "โพสต์เดียว" })]);
    await importFresh();
    assert.match(featured().innerHTML, /โพสต์เดียว/);
    assert.match(featured().innerHTML, /blog-feat-card/);
    assert.match(grid().innerHTML, /กำลังจัดทำบทความถัดไป/);
  });
});

describe("blog-render — หน้า TH — หลายโพสต์", () => {
  test("โพสต์ล่าสุด (posts[0]) → featured, ที่เหลือ → grid ตามลำดับเดิม (createdAt desc จาก getBlogs)", async () => {
    setupDom({ pathname: "/blog.html" });
    stubPosts([
      post({ id: "1", title: "ล่าสุด", createdAt: 3000 }),
      post({ id: "2", title: "รองลงมา", createdAt: 2000 }),
      post({ id: "3", title: "เก่าสุด", createdAt: 1000 })
    ]);
    await importFresh();
    assert.match(featured().innerHTML, /ล่าสุด/);
    assert.ok(!featured().innerHTML.includes("รองลงมา"), "featured ต้องมีแค่โพสต์ล่าสุดเท่านั้น");
    const gridHtml = grid().innerHTML;
    const idxRong = gridHtml.indexOf("รองลงมา");
    const idxOld = gridHtml.indexOf("เก่าสุด");
    assert.ok(idxRong !== -1 && idxOld !== -1, "grid ต้องมีทั้งสองโพสต์ที่เหลือ");
    assert.ok(idxRong < idxOld, "ลำดับใน grid ต้องเรียงตาม createdAt desc เดิม");
    assert.ok(!gridHtml.includes("ล่าสุด<"), "โพสต์ล่าสุดต้องไม่ซ้ำใน grid (ไปอยู่ featured แล้ว)");
  });

  test("โพสต์สถานะ draft ถูกกรองออกทั้ง featured และ grid", async () => {
    setupDom({ pathname: "/blog.html" });
    stubPosts([
      post({ id: "1", title: "ฉบับร่าง", status: "draft", createdAt: 5000 }),
      post({ id: "2", title: "เผยแพร่แล้ว", status: "published", createdAt: 3000 }),
      post({ id: "3", title: "เผยแพร่แล้ว2", status: "published", createdAt: 1000 })
    ]);
    await importFresh();
    assert.ok(!featured().innerHTML.includes("ฉบับร่าง"));
    assert.ok(!grid().innerHTML.includes("ฉบับร่าง"));
    assert.match(featured().innerHTML, /เผยแพร่แล้ว(?!2)/);
    assert.match(grid().innerHTML, /เผยแพร่แล้ว2/);
  });

  test("ทุกโพสต์เป็น draft หมด (ไม่มีที่เผยแพร่เลย) → renderEmpty(), ไม่แตะ featured", async () => {
    setupDom({ pathname: "/blog.html", featuredHtml: "STATIC-FALLBACK" });
    stubPosts([post({ id: "1", status: "draft" }), post({ id: "2", status: "draft" })]);
    await importFresh();
    assert.match(grid().innerHTML, /ยังไม่มีบทความเผยแพร่ในขณะนี้/);
    assert.equal(featured().innerHTML, "STATIC-FALLBACK", "featured ต้องไม่ถูกแตะเมื่อไม่มีโพสต์เผยแพร่เลย");
  });

  test("ไม่มีโพสต์ใน Firestore เลย (array ว่าง) → renderEmpty() เหมือนกัน", async () => {
    setupDom({ pathname: "/blog.html", featuredHtml: "STATIC-FALLBACK" });
    stubPosts([]);
    await importFresh();
    assert.match(grid().innerHTML, /ยังไม่มีบทความเผยแพร่ในขณะนี้/);
    assert.equal(featured().innerHTML, "STATIC-FALLBACK");
  });
});

describe("blog-render — getBlogs() ล้มเหลว (reject)", () => {
  test("แสดงข้อความ error ใน grid, ไม่แตะ featured (คงการ์ด fallback เดิมไว้)", async () => {
    setupDom({ pathname: "/blog.html", featuredHtml: "STATIC-FALLBACK" });
    stubThrow(new Error("network down"));
    await importFresh();
    assert.match(grid().innerHTML, /ไม่สามารถโหลดบทความได้ในขณะนี้/);
    assert.equal(featured().innerHTML, "STATIC-FALLBACK");
  });
});

describe("blog-render — เนื้อหาการ์ด: escape/รูปภาพ/วันที่/เวลาอ่าน/หมวดหมู่", () => {
  test("escapeHtml ป้องกัน XSS ใน title/excerpt", async () => {
    setupDom({ pathname: "/blog.html" });
    stubPosts([
      post({ id: "1", title: "ล่าสุด" }),
      post({ id: "2", title: '<script>alert(1)</script>', excerpt: '<img src=x onerror=alert(2)>' })
    ]);
    await importFresh();
    const html = grid().innerHTML;
    assert.ok(!html.includes("<script>alert(1)</script>"));
    assert.ok(html.includes("&lt;script&gt;"));
    assert.ok(!html.includes("<img src=x onerror"));
  });

  test("มี image → ใช้ <img>, ไม่มี image → placeholder svg", async () => {
    setupDom({ pathname: "/blog.html" });
    stubPosts([
      post({ id: "1", title: "ล่าสุด" }),
      post({ id: "2", title: "มีรูป", image: "https://example.com/pic.jpg" }),
      post({ id: "3", title: "ไม่มีรูป" })
    ]);
    await importFresh();
    const html = grid().innerHTML;
    assert.match(html, /blog-card-img-real/);
    assert.match(html, /<img src="https:\/\/example\.com\/pic\.jpg"/);
    // การ์ด "ไม่มีรูป" ต้องมี svg placeholder อยู่ใกล้ๆ ข้อความนั้น
    const noImgIdx = html.indexOf("ไม่มีรูป");
    const surrounding = html.slice(Math.max(0, noImgIdx - 600), noImgIdx);
    assert.match(surrounding, /<svg/);
  });

  test("มี category → render blog-tag, ไม่มี category → ไม่มี tag เลย", async () => {
    setupDom({ pathname: "/blog.html" });
    stubPosts([
      post({ id: "1", title: "ล่าสุด" }),
      post({ id: "2", title: "มีหมวดหมู่", category: "ป้ายเซฟตี้" }),
      post({ id: "3", title: "ไม่มีหมวดหมู่" })
    ]);
    await importFresh();
    const html = grid().innerHTML;
    assert.match(html, /ป้ายเซฟตี้/);
    // นับจำนวน blog-tag ที่ไม่ใช่ TH_ONLY_TAG lang-tag (ต้องมีแค่ 1 อันจากโพสต์ที่มี category)
    const tagCount = (html.match(/class="blog-tag"/g) || []).length;
    assert.equal(tagCount, 1);
  });

  test("มี createdAt → แสดงวันที่ไทย, ไม่มี createdAt (0/undefined) → ไม่แสดงวันที่", async () => {
    setupDom({ pathname: "/blog.html" });
    stubPosts([
      post({ id: "1", title: "ล่าสุด" }),
      post({ id: "2", title: "มีวันที่", createdAt: 1700000000000 }),
      post({ id: "3", title: "ไม่มีวันที่", createdAt: 0 })
    ]);
    await importFresh();
    const html = grid().innerHTML;
    const withDateIdx = html.indexOf("มีวันที่");
    const noDateIdx = html.indexOf("ไม่มีวันที่");
    const withDateBlock = html.slice(withDateIdx - 400, withDateIdx + 400);
    const noDateBlock = html.slice(noDateIdx - 400, noDateIdx + 400);
    assert.match(withDateBlock, /2566|2023/); // พ.ศ. ของ th-TH locale
    assert.doesNotMatch(noDateBlock.slice(0, 400), /2566|2023/);
  });

  test("estimateReadMinutes: เนื้อหาสั้นมาก → อ่านอย่างน้อย 1 นาทีเสมอ", async () => {
    setupDom({ pathname: "/blog.html" });
    stubPosts([post({ id: "1", title: "ล่าสุด" }), post({ id: "2", title: "สั้นมาก", content: "" })]);
    await importFresh();
    assert.match(grid().innerHTML, /อ่าน 1 นาที/);
  });

  test("estimateReadMinutes: เนื้อหายาว (~800 ตัวอักษร) → คำนวณนาทีมากกว่า 1", async () => {
    setupDom({ pathname: "/blog.html" });
    stubPosts([
      post({ id: "1", title: "ล่าสุด" }),
      post({ id: "2", title: "เนื้อหายาว", content: "ก".repeat(800) })
    ]);
    await importFresh();
    assert.match(grid().innerHTML, /อ่าน 2 นาที/);
  });
});

describe("blog-render — หน้า EN (en/blog.html)", () => {
  test("featured ถูก pin ไว้กับเนื้อหา static เดิมเสมอ ไม่ถูก Firestore ทับ", async () => {
    setupDom({ pathname: "/en/blog.html", featuredHtml: "STATIC-EN-FEATURED" });
    stubPosts([post({ id: "1", title: "โพสต์ล่าสุดจาก Firestore" })]);
    await importFresh();
    assert.equal(featured().innerHTML, "STATIC-EN-FEATURED");
  });

  test("grid รวมโพสต์ล่าสุดด้วย (ต่างจากหน้า TH) พร้อม TH lang-tag และลิงก์ ../blog-post.html", async () => {
    setupDom({ pathname: "/en/blog.html" });
    stubPosts([
      post({ id: "1", title: "ล่าสุดEN", slug: "latest-en", createdAt: 3000 }),
      post({ id: "2", title: "รองลงมาEN", createdAt: 2000 })
    ]);
    await importFresh();
    const html = grid().innerHTML;
    assert.match(html, /ล่าสุดEN/, "หน้า EN ต้องมีโพสต์ล่าสุดโผล่ใน grid ด้วย ต่างจากหน้า TH");
    assert.match(html, /รองลงมาEN/);
    assert.match(html, /href="\.\.\/blog-post\.html\?slug=latest-en"/);
    assert.match(html, /lang-tag/, "ต้องมีป้าย TH กำกับเพราะเนื้อหายังเป็นภาษาไทยเดี่ยว");
  });

  test("draft ยังถูกกรองออกในหน้า EN เหมือนกัน", async () => {
    setupDom({ pathname: "/en/blog.html" });
    stubPosts([post({ id: "1", title: "ร่างEN", status: "draft" }), post({ id: "2", title: "จริงEN" })]);
    await importFresh();
    assert.ok(!grid().innerHTML.includes("ร่างEN"));
    assert.match(grid().innerHTML, /จริงEN/);
  });

  test("ไม่มีโพสต์เผยแพร่เลยในหน้า EN → ข้อความ empty เป็นภาษาอังกฤษ, featured ไม่ถูกแตะ", async () => {
    setupDom({ pathname: "/en/blog.html", featuredHtml: "STATIC-EN-FEATURED" });
    stubPosts([]);
    await importFresh();
    assert.match(grid().innerHTML, /No published articles yet/);
    assert.equal(featured().innerHTML, "STATIC-EN-FEATURED");
  });

  test("getBlogs() ล้มเหลวในหน้า EN → ข้อความ error ภาษาอังกฤษ", async () => {
    setupDom({ pathname: "/en/blog.html" });
    stubThrow(new Error("boom"));
    await importFresh();
    assert.match(grid().innerHTML, /Couldn't load articles right now/);
  });
});

describe("blog-render — element ขาดหายไปบางส่วน (หน้าที่ไม่มี grid หรือ featured)", () => {
  test("ไม่มีทั้ง grid และ featured เลย → init() return ทันที ไม่ throw ไม่เรียก getBlogs", async () => {
    setupDomPartial("/blog.html", { grid: false, featured: false });
    let called = false;
    globalThis.__GET_DOCS_STUB__ = () => { called = true; return []; };
    await assert.doesNotReject(importFresh());
    assert.equal(called, false, "ไม่ควรมีการเรียก getDocs เลยถ้าไม่มี element ให้เรนเดอร์");
  });

  test("มีแค่ grid ไม่มี featured → เรนเดอร์ grid ได้ปกติไม่ throw", async () => {
    setupDomPartial("/blog.html", { grid: true, featured: false });
    stubPosts([post({ id: "1", title: "A" }), post({ id: "2", title: "B" })]);
    await assert.doesNotReject(importFresh());
    assert.match(grid().innerHTML, /B/);
  });

  test("มีแค่ featured ไม่มี grid → เรนเดอร์ featured ได้ปกติไม่ throw", async () => {
    setupDomPartial("/blog.html", { grid: false, featured: true });
    stubPosts([post({ id: "1", title: "เดี่ยว" })]);
    await assert.doesNotReject(importFresh());
    assert.match(featured().innerHTML, /เดี่ยว/);
  });
});

describe("blog-render — crossfadeSwap: กลไก opacity/is-swapping จริง", () => {
  test("element ปกติ (opacity ไม่ใช่ '0') → opacity ลดเหลือ 0.45 ทันที + class is-swapping, กลับเป็น 1 ผ่าน RAF คู่, class หลุดหลัง ~220ms", async () => {
    setupDom({ pathname: "/blog.html" });
    stubPosts([post({ id: "1", title: "A" }), post({ id: "2", title: "B" })]);
    await importFresh();
    const el = grid();
    assert.equal(el.style.opacity, "0.45");
    assert.ok(el.classList.contains("is-swapping"));
    assert.equal(el.style.transition, "opacity 220ms var(--ease, ease)");
    await new Promise((r) => setTimeout(r, 60));
    assert.equal(el.style.opacity, "1", "หลัง requestAnimationFrame คู่ (สองรอบถัดไป) ต้องกลับเป็น 1");
    await new Promise((r) => setTimeout(r, 250));
    assert.ok(!el.classList.contains("is-swapping"), "class ต้องหลุดหลังผ่าน FADE_MS (220ms)");
  });

  test("element ที่ถูกซ่อนโดยระบบ scroll-reveal (opacity==='0') → ข้าม opacity animation ไปเลย สลับเนื้อหาตรงๆ", async () => {
    setupDom({ pathname: "/blog.html" });
    grid().style.opacity = "0";
    stubPosts([post({ id: "1", title: "A" }), post({ id: "2", title: "B" })]);
    await importFresh();
    const el = grid();
    assert.equal(el.style.opacity, "0", "opacity ต้องคงที่ 0 ไม่ถูกเปลี่ยนเป็น 0.45");
    assert.ok(!el.classList.contains("is-swapping"), "ไม่ควรติด class is-swapping ในเส้นทางนี้");
    assert.match(el.innerHTML, /B/, "เนื้อหาต้องถูกสลับจริงแม้ opacity ยังเป็น 0");
  });
});

describe("blog-render — observeCardsReveal() เรียก window.CSSIGN_observeReveal ถ้ามี", () => {
  test("เรียกด้วย GRID_EL จริงเมื่อ render การ์ดสำเร็จ (มีโพสต์ใน grid)", async () => {
    setupDom({ pathname: "/blog.html" });
    let calledWith = null;
    dom.window.CSSIGN_observeReveal = (el) => { calledWith = el; };
    stubPosts([post({ id: "1", title: "A" }), post({ id: "2", title: "B" })]);
    await importFresh();
    assert.equal(calledWith, grid());
  });

  test("ไม่ถูกเรียกเมื่อ grid ว่าง (renderNoOtherPosts) — ไม่มีการ์ดให้ observe", async () => {
    setupDom({ pathname: "/blog.html" });
    let called = false;
    dom.window.CSSIGN_observeReveal = () => { called = true; };
    stubPosts([post({ id: "1", title: "เดี่ยว" })]); // ไปอยู่ featured หมด grid ว่าง
    await importFresh();
    assert.equal(called, false);
  });

  test("ไม่มี window.CSSIGN_observeReveal เลย (undefined) → ไม่ throw", async () => {
    setupDom({ pathname: "/blog.html" });
    stubPosts([post({ id: "1", title: "A" }), post({ id: "2", title: "B" })]);
    await assert.doesNotReject(importFresh());
  });
});

describe("blog-render — skeleton loading state (race กับเวลาโหลดจริง)", () => {
  test("โหลดเร็ว (ผ่าน microtask ปกติ ไม่มี delay) → ไม่มีทางเห็น skeleton เลย (settled ก่อน timer 260ms ทำงานเสมอ)", async () => {
    setupDom({ pathname: "/blog.html" });
    stubPosts([post({ id: "1", title: "A" }), post({ id: "2", title: "B" })]);
    await importFresh();
    assert.ok(!grid().innerHTML.includes("blog-skel-card"));
    assert.ok(!featured().innerHTML.includes("blog-feat-skel"));
  });

  test("โหลดช้า (>260ms จริง ผ่าน __GET_DOCS_DELAY_MS__) → เห็น skeleton ก่อน แล้วค่อยเปลี่ยนเป็นข้อมูลจริงหลังโหลดเสร็จ", async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    setupDom({ pathname: "/blog.html" });
    globalThis.__GET_DOCS_DELAY_MS__ = 500;
    stubPosts([post({ id: "1", title: "โหลดช้า" }), post({ id: "2", title: "โหลดช้า2" })]);

    importCounter += 1;
    await import(`../js/blog-render.js?t=${importCounter}`);
    // ผ่านจุด SKELETON_DELAY (260ms) แต่ยังไม่ถึง __GET_DOCS_DELAY_MS__ (500ms)
    t.mock.timers.tick(300);
    assert.match(grid().innerHTML, /blog-skel-card/, "ต้องเห็น skeleton หลังผ่าน 260ms ที่ข้อมูลยังไม่มา");
    assert.match(featured().innerHTML, /blog-feat-skel/);

    // ผ่านจุดที่ getDocs delay (500ms) เสร็จสมบูรณ์
    t.mock.timers.tick(300);
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));
    assert.match(featured().innerHTML, /โหลดช้า(?!2)/);
    assert.match(grid().innerHTML, /โหลดช้า2/);
    assert.ok(!grid().innerHTML.includes("blog-skel-card"), "skeleton ต้องหายไปหลังข้อมูลจริงมาถึง");
  });

  test("โหลดช้ากว่า 260ms แต่สุดท้ายล้มเหลว (reject) → skeleton หายไป เปลี่ยนเป็นข้อความ error แทน", async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    setupDom({ pathname: "/blog.html" });
    globalThis.__GET_DOCS_DELAY_MS__ = 500;
    stubThrow(new Error("slow network fail"));

    importCounter += 1;
    await import(`../js/blog-render.js?t=${importCounter}`);
    t.mock.timers.tick(300);
    assert.match(grid().innerHTML, /blog-skel-card/);

    t.mock.timers.tick(300);
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));
    assert.match(grid().innerHTML, /ไม่สามารถโหลดบทความได้ในขณะนี้/);
    assert.ok(!grid().innerHTML.includes("blog-skel-card"));
  });
});
