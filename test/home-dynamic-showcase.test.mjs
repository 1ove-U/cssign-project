// test/home-dynamic-showcase.test.mjs — เทส js/home-dynamic-showcase.js
//
// ขอบเขต: js/home-dynamic-showcase.js (292 บรรทัด) — หน้าแรกส่วนที่ 2/2: สินค้าแนะนำ
// (renderFeaturedProducts), ผลงานที่ติดดาว (renderStarredWorks), โปรโมชั่น/ข่าวอัพเดต
// (renderPromoUpdates) และการเรียก renderIntroVideo() ที่ import กลับมาจาก
// js/home-dynamic-showcase-video.js — อ่านโค้ดจริงทั้งไฟล์ก่อนเขียนเทสแล้ว
//
// จุดสำคัญที่ต่างจากไฟล์ตระกูล home-dynamic-* อื่นที่เคยเทสมาก่อน: ไฟล์นี้ "ไม่ export อะไร
// เลยสักตัว" (ไม่มี export บนฟังก์ชันไหนทั้งสิ้น รวมถึง renderFeaturedProducts/renderStarredWorks/
// renderPromoUpdates) — ทั้ง 4 ฟังก์ชัน (3 ตัวในไฟล์นี้ + renderIntroVideo ที่ import มา) ถูกเรียก
// เป็น top-level side effect ท้ายไฟล์ทั้งหมดพร้อมกัน (ไม่ await กัน รันคู่ขนาน) เทสทุกเคสด้านล่าง
// จึงต้อง set window/document (jsdom) + stub ให้ครบ "ก่อน" import แล้วสังเกตผลผ่าน DOM เท่านั้น
// ไม่มีทางเรียกฟังก์ชันภายในตรงๆ ได้เลย (ต่างจาก renderIntroVideo ในไฟล์วิดีโอที่ export ออกมา)
//
// การ import ไฟล์นี้ลาก side effect ตามมา 2 ชั้น: (1) js/home-dynamic.js ถูก import แบบ
// {escapeHtml, fadeSwap} ทำให้ renderClientLogos()/renderLatestBlogs() ของไฟล์นั้นถูกเรียกไปด้วย
// (ดู test/home-dynamic.test.mjs รอบ 142) — fixture ด้านล่างไม่มี #home-blog-grid/
// #home-clients-row-a/b เลย จึงเป็น no-op ปลอดภัยทั้งคู่ ไม่ต้อง stub getBlogs()/getPartners()
// เพิ่ม (ค่า default ของ __GET_DOCS_STUB__ ที่ไม่ได้ตั้งไว้คือ docs: [] อยู่แล้ว) (2)
// js/home-dynamic-showcase-video.js ถูก import แบบ {renderIntroVideo} แล้วไฟล์นี้เรียกเองที่บรรทัด
// สุดท้าย — รายละเอียดพฤติกรรมภายในของ renderIntroVideo() เทสไว้ครบแล้วใน
// test/home-dynamic-showcase-video.test.mjs รอบนี้เทสแค่ "การเชื่อมต่อ" (wiring) ว่าถูกเรียกจริง
//
// getProducts()/getPortfolios() (js/db-products.js, js/db-content.js) ใช้ getDocs() (พหูพจน์) →
// ดักด้วย globalThis.__GET_DOCS_STUB__ แยกตาม ref.path ("products"/"portfolios") ส่วน
// getSettings() (js/db-settings.js) ใช้ getDoc() (เอกฐาน) → ดักด้วย globalThis.__GET_DOC_STUB__
// ที่ ref.path === "settings/main" (แพทเทิร์นเดียวกับ test/site-settings.test.mjs รอบ 137)
//
// renderPromoUpdates()/renderIntroVideo() ทั้งคู่ใช้ window.setInterval() จริงสำหรับ autoplay
// (5000ms) — เทสที่ปล่อยให้ autoplay เดินอยู่ตอนจบ (ไม่ mouseenter หยุด) จะค้าง event loop ทำให้
// `node --test` รันไฟล์นี้ไม่จบ (ปัญหาเดียวกับที่พบมาแล้วในไฟล์วิดีโอ) — ปิดด้วย
// dom.window.close() ใน afterEach() เสมอเหมือนกัน
//
// ใช้แพทเทิร์น import ด้วย query string คนละอันทุกเทส (`../js/home-dynamic-showcase.js?t=N`)
// บังคับ module instance ใหม่ทุกครั้ง — หลัง import ต้อง flush microtask/macrotask หลายรอบ
// (setImmediate ซ้ำๆ) เพราะทั้ง 3 ฟังก์ชันในไฟล์นี้ + renderIntroVideo ต่างมี await ซ้อนกันหลาย
// ชั้น (getProducts()/getPortfolios() เรียก getDocs() ที่ resolve ผ่าน noopAsync().then(run) เอง
// อีกชั้นหนึ่ง) และรันคู่ขนานกันทั้ง 4 ตัวพร้อมกัน — ยืนยันด้วยการรันจริงว่า 8 รอบ setImmediate
// เพียงพอเสมอสำหรับ fixture ในไฟล์นี้

import { test, describe, afterEach } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

let dom;
let importCounter = 0;
let originalWarn;

function setupDom({
  hasFP = true,
  hasWG = true,
  hasPromo = true,
  hasIntroVideo = true,
  promoInitialHtml = "PROMO-FALLBACK",
  promoEmptyClass = true,
  introInitialHtml = "INTRO-FALLBACK",
  pathname = "/index.html"
} = {}) {
  const fp = hasFP ? `<section id="featured-products"><div id="home-fp-marquee"></div></section>` : "";
  const wg = hasWG ? `<section id="starred-works"><div id="home-wg-grid"></div></section>` : "";
  const promo = hasPromo
    ? `<div id="home-promo-grid" class="${promoEmptyClass ? "promo-grid--empty" : ""}">${promoInitialHtml}</div>`
    : "";
  const intro = hasIntroVideo ? `<div id="home-intro-video">${introInitialHtml}</div>` : "";
  dom = new JSDOM(`<!doctype html><html><body>${fp}${wg}${promo}${intro}</body></html>`, {
    url: `https://example.test${pathname}`,
    pretendToBeVisual: true
  });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.requestAnimationFrame = dom.window.requestAnimationFrame;
  return dom;
}

function stubCollections({ products, portfolios } = {}) {
  globalThis.__GET_DOCS_STUB__ = (ref) => {
    if (ref && ref.path === "products") return products === undefined ? [] : products;
    if (ref && ref.path === "portfolios") return portfolios === undefined ? [] : portfolios;
    return [];
  };
}

function stubCollectionsThrow(path, err) {
  globalThis.__GET_DOCS_STUB__ = (ref) => {
    if (ref && ref.path === path) throw err;
    return [];
  };
}

function stubSettings(data) {
  globalThis.__GET_DOC_STUB__ = (ref) => {
    if (ref && ref.path === "settings/main") {
      return data === undefined ? { exists: false, data: {} } : { exists: true, data };
    }
    return { exists: false, data: {} };
  };
}

function stubSettingsThrow(err) {
  globalThis.__GET_DOC_STUB__ = (ref) => {
    if (ref && ref.path === "settings/main") throw err;
    return { exists: false, data: {} };
  };
}

function captureWarn() {
  const calls = [];
  originalWarn = console.warn;
  console.warn = (...args) => { calls.push(args); };
  return calls;
}

async function importFresh() {
  importCounter += 1;
  const mod = await import(`../js/home-dynamic-showcase.js?t=${importCounter}`);
  for (let i = 0; i < 8; i++) await new Promise((r) => setImmediate(r));
  return mod;
}

function $(id) { return dom.window.document.getElementById(id); }

afterEach(() => {
  delete globalThis.__GET_DOCS_STUB__;
  delete globalThis.__GET_DOC_STUB__;
  if (originalWarn) { console.warn = originalWarn; originalWarn = undefined; }
  if (dom && typeof dom.window.close === "function") dom.window.close();
  dom = undefined;
});

function product(overrides = {}) {
  return {
    id: overrides.id || "p-" + Math.random().toString(36).slice(2),
    data: {
      name: "สินค้าไฟ LED",
      code: "",
      slug: "",
      featured: true,
      status: "active",
      images: [{ url: "https://cdn.test/p.jpg" }],
      ...overrides
    }
  };
}

function portfolioItem(overrides = {}) {
  return {
    id: overrides.id || "w-" + Math.random().toString(36).slice(2),
    data: {
      title: "ผลงานทดสอบ",
      category: "factory",
      client: "",
      description: "",
      images: ["https://cdn.test/w.jpg"],
      pinned: true,
      order: 0,
      createdAt: 1000,
      ...overrides
    }
  };
}

function promoItem(overrides = {}) {
  return { image: "https://cdn.test/promo.jpg", title: "", link: "", ...overrides };
}

// =====================================================================
// renderFeaturedProducts() — สินค้าแนะนำ
// =====================================================================
describe("renderFeaturedProducts() — element guard", () => {
  test("ไม่มี #featured-products → ไม่เรียก getProducts เลย", async () => {
    setupDom({ hasFP: false });
    let called = false;
    globalThis.__GET_DOCS_STUB__ = (ref) => { if (ref && ref.path === "products") called = true; return []; };
    await importFresh();
    assert.equal(called, false);
  });

  test("ไม่มี #home-fp-marquee → ไม่เรียก getProducts เลย", async () => {
    setupDom();
    $("home-fp-marquee").remove();
    let called = false;
    globalThis.__GET_DOCS_STUB__ = (ref) => { if (ref && ref.path === "products") called = true; return []; };
    await importFresh();
    assert.equal(called, false);
  });
});

describe("renderFeaturedProducts() — ไม่มีสินค้าติดรายการโปรด → เว้น section ไว้", () => {
  test("ไม่มีสินค้าเลย (array ว่าง) → ไม่แสดง section, marquee ว่างเปล่า", async () => {
    setupDom();
    stubCollections({ products: [] });
    await importFresh();
    assert.equal($("featured-products").classList.contains("is-visible"), false);
    assert.equal($("home-fp-marquee").innerHTML, "");
  });

  test("มีสินค้าแต่ featured:false ทั้งหมด → ไม่แสดง section", async () => {
    setupDom();
    stubCollections({ products: [product({ featured: false })] });
    await importFresh();
    assert.equal($("featured-products").classList.contains("is-visible"), false);
  });

  test("featured:true แต่ status ไม่ใช่ active → ไม่แสดง section", async () => {
    setupDom();
    stubCollections({ products: [product({ status: "draft" })] });
    await importFresh();
    assert.equal($("featured-products").classList.contains("is-visible"), false);
  });

  test("featured:true, active แต่ไม่มีรูป (images: []) → ไม่แสดง section", async () => {
    setupDom();
    stubCollections({ products: [product({ images: [] })] });
    await importFresh();
    assert.equal($("featured-products").classList.contains("is-visible"), false);
  });
});

describe("renderFeaturedProducts() — มีสินค้าติดรายการโปรด → แสดงและกระจาย 2 แถว", () => {
  test("2 สินค้า → กระจาย round-robin ลง 2 แถว, ทำซ้ำจนครบ 6 แล้ว duplicate x2 = 12 tiles/แถว", async () => {
    setupDom();
    stubCollections({ products: [product({ id: "a" }), product({ id: "b" })] });
    await importFresh();
    const section = $("featured-products");
    assert.equal(section.classList.contains("is-visible"), true);
    const rows = dom.window.document.querySelectorAll("#home-fp-marquee .fp-row");
    assert.equal(rows.length, 2);
    rows.forEach((row) => {
      assert.equal(row.querySelectorAll(".fp-tile").length, 12);
    });
  });

  test("แถวที่ 2 (index คี่) ได้ class fp-row--reverse, แถวแรกไม่ได้", async () => {
    setupDom();
    stubCollections({ products: [product({ id: "a" }), product({ id: "b" })] });
    await importFresh();
    const rows = dom.window.document.querySelectorAll("#home-fp-marquee .fp-row");
    assert.equal(rows[0].classList.contains("fp-row--reverse"), false);
    assert.equal(rows[1].classList.contains("fp-row--reverse"), true);
  });

  test("มีสินค้าแค่ 1 ชิ้น → แถวที่ 2 ไม่มีการ์ดเลย (rowItems ว่าง → คืนสตริงว่าง ไม่มี .fp-row)", async () => {
    setupDom();
    stubCollections({ products: [product({ id: "only" })] });
    await importFresh();
    const rows = dom.window.document.querySelectorAll("#home-fp-marquee .fp-row");
    assert.equal(rows.length, 1);
  });

  test("product.code มีค่า → มี badge, ไม่มี code → ไม่มี badge", async () => {
    setupDom();
    stubCollections({
      products: [
        product({ id: "a", code: "LED-01" }),
        product({ id: "b", code: "" })
      ]
    });
    await importFresh();
    const html = $("home-fp-marquee").innerHTML;
    assert.match(html, /fp-tile-badge">LED-01</);
  });

  test("product.slug มีค่า → href เป็น product-detail.html?slug=..., ไม่มี slug → products.html", async () => {
    setupDom();
    stubCollections({
      products: [
        product({ id: "a", slug: "led-sign" }),
        product({ id: "b", slug: "" })
      ]
    });
    await importFresh();
    const html = $("home-fp-marquee").innerHTML;
    assert.match(html, /href="product-detail\.html\?slug=led-sign"/);
    assert.match(html, /href="products\.html"/);
  });

  test("ชื่อสินค้าที่มีอักขระพิเศษ → escape ผ่าน escapeHtml ไม่มี tag ดิบหลุดออกมา", async () => {
    setupDom();
    stubCollections({ products: [product({ id: "a", name: `<img src=x onerror=alert(1)>` })] });
    await importFresh();
    // ตรวจผ่านโครงสร้าง DOM จริง (ไม่ใช่ substring บน innerHTML string) เพราะ jsdom serialize
    // ค่า attribute กลับมาโดยไม่เข้ารหัส < > ซ้ำ (ไม่จำเป็นต้อง escape ภายใน quoted attribute
    // value ตามสเปก HTML — ไม่ใช่บั๊ก) จุดที่ต้องยืนยันจริงคือ: ไม่มี <img> เพิ่มขึ้นมาจากการฉีด
    // (ยังมีแค่ img เดียวคือรูปสินค้าเอง) และ .fp-tile-name แสดงชื่อดิบครบถ้วนเป็น text ไม่ใช่ tag
    const tile = dom.window.document.querySelector("#home-fp-marquee .fp-tile");
    assert.equal(tile.querySelectorAll("img").length, 1);
    assert.equal(tile.querySelector(".fp-tile-name").textContent, "<img src=x onerror=alert(1)>");
    assert.equal(tile.querySelector(".fp-tile-name").children.length, 0);
  });

  test("ไม่มีชื่อสินค้าเลย → fallback เป็น 'สินค้า'", async () => {
    setupDom();
    stubCollections({ products: [product({ id: "a", name: "" })] });
    await importFresh();
    assert.match($("home-fp-marquee").innerHTML, /fp-tile-name">สินค้า</);
  });
});

describe("renderFeaturedProducts() — error path / reveal hook", () => {
  test("getProducts() throw → console.warn 1 ครั้ง, section ไม่แสดง, ไม่ throw ออกมา", async () => {
    setupDom();
    const calls = captureWarn();
    stubCollectionsThrow("products", new Error("โหลดพัง"));
    await importFresh();
    assert.equal($("featured-products").classList.contains("is-visible"), false);
    assert.equal(calls.length, 1);
  });

  test("window.CSSIGN_observeReveal เป็นฟังก์ชัน → ถูกเรียกด้วย section element เมื่อแสดงผลสำเร็จ", async () => {
    setupDom();
    stubCollections({ products: [product()] });
    let calledWith = null;
    dom.window.CSSIGN_observeReveal = (el) => { calledWith = el; };
    await importFresh();
    assert.equal(calledWith, $("featured-products"));
  });

  test("ไม่มี window.CSSIGN_observeReveal (undefined) → ไม่ throw", async () => {
    setupDom();
    stubCollections({ products: [product()] });
    await assert.doesNotReject(importFresh());
  });
});

// =====================================================================
// renderStarredWorks() — ผลงานที่ติดดาว
// =====================================================================
describe("renderStarredWorks() — element guard", () => {
  test("ไม่มี #starred-works → ไม่เรียก getPortfolios เลย", async () => {
    setupDom({ hasWG: false });
    let called = false;
    globalThis.__GET_DOCS_STUB__ = (ref) => { if (ref && ref.path === "portfolios") called = true; return []; };
    await importFresh();
    assert.equal(called, false);
  });

  test("ไม่มี #home-wg-grid → ไม่เรียก getPortfolios เลย", async () => {
    setupDom();
    $("home-wg-grid").remove();
    let called = false;
    globalThis.__GET_DOCS_STUB__ = (ref) => { if (ref && ref.path === "portfolios") called = true; return []; };
    await importFresh();
    assert.equal(called, false);
  });
});

describe("renderStarredWorks() — ไม่มีผลงานที่ติดดาว → เว้น section ไว้", () => {
  test("ไม่มีผลงานเลย → ไม่แสดง section", async () => {
    setupDom();
    stubCollections({ portfolios: [] });
    await importFresh();
    assert.equal($("starred-works").classList.contains("is-visible"), false);
    assert.equal($("home-wg-grid").innerHTML, "");
  });

  test("มีผลงานแต่ pinned:false ทั้งหมด → ไม่แสดง section", async () => {
    setupDom();
    stubCollections({ portfolios: [portfolioItem({ pinned: false })] });
    await importFresh();
    assert.equal($("starred-works").classList.contains("is-visible"), false);
  });

  test("pinned:true แต่ images เป็น array ว่าง → ไม่แสดง section", async () => {
    setupDom();
    stubCollections({ portfolios: [portfolioItem({ images: [] })] });
    await importFresh();
    assert.equal($("starred-works").classList.contains("is-visible"), false);
  });

  test("pinned:true, images:[null] (ผ่าน filter ระดับ portfolios แต่ทุกตัวใน array เป็น falsy) → wgTileHTML คืนค่าว่างทุกใบ → ไม่แสดง section", async () => {
    setupDom();
    stubCollections({ portfolios: [portfolioItem({ images: [null] })] });
    await importFresh();
    assert.equal($("starred-works").classList.contains("is-visible"), false);
    assert.equal($("home-wg-grid").innerHTML, "");
  });
});

describe("renderStarredWorks() — มีผลงานที่ติดดาว → แสดงผล", () => {
  test("images: [null, url] → กรอง Boolean แล้วใช้รูปแรกที่ไม่ falsy", async () => {
    setupDom();
    stubCollections({ portfolios: [portfolioItem({ images: [null, "https://cdn.test/real.jpg"] })] });
    await importFresh();
    assert.equal($("starred-works").classList.contains("is-visible"), true);
    assert.match($("home-wg-grid").innerHTML, /src="https:\/\/cdn\.test\/real\.jpg"/);
  });

  test("sort ตาม order ก่อน แล้วค่อย createdAt, จำกัดที่ 12 ชิ้น (13 ชิ้น → เหลือ 12 อันดับแรก)", async () => {
    setupDom();
    const items = Array.from({ length: 13 }, (_, i) => portfolioItem({ id: "w" + i, order: i, title: "T" + i }));
    // สลับลำดับก่อนส่งเข้า stub เพื่อยืนยันว่ามีการ sort จริง ไม่ใช่แค่ slice ตามลำดับที่ส่งมา
    stubCollections({ portfolios: [...items].reverse() });
    await importFresh();
    const cards = dom.window.document.querySelectorAll("#home-wg-grid .port-card");
    assert.equal(cards.length, 12);
    // อันดับ order สูงสุด (T12) ต้องถูกตัดออก ไม่ใช่ตัวใดตัวหนึ่งแบบสุ่ม
    assert.doesNotMatch($("home-wg-grid").innerHTML, /<h3>T12<\/h3>/);
    assert.match($("home-wg-grid").innerHTML, /<h3>T0<\/h3>/);
    assert.match($("home-wg-grid").innerHTML, /<h3>T11<\/h3>/);
  });

  test("ลาย wg-tile--big/wg-tile--wide วนตาม WG_SIZE_PATTERN (index 0=big, 3=wide, อื่นๆ ไม่มี class เพิ่ม)", async () => {
    setupDom();
    const items = Array.from({ length: 6 }, (_, i) => portfolioItem({ id: "w" + i, order: i, title: "T" + i }));
    stubCollections({ portfolios: items });
    await importFresh();
    const cards = dom.window.document.querySelectorAll("#home-wg-grid .port-card");
    assert.equal(cards[0].classList.contains("wg-tile--big"), true);
    assert.equal(cards[3].classList.contains("wg-tile--wide"), true);
    [1, 2, 4, 5].forEach((i) => {
      assert.equal(cards[i].classList.contains("wg-tile--big"), false);
      assert.equal(cards[i].classList.contains("wg-tile--wide"), false);
    });
  });

  test("category ที่รู้จัก (factory) → badge เป็นภาษาไทยตาม WG_CAT_LABEL", async () => {
    setupDom();
    stubCollections({ portfolios: [portfolioItem({ category: "factory" })] });
    await importFresh();
    assert.match($("home-wg-grid").innerHTML, /port-badge">โรงงานอุตสาหกรรม</);
  });

  test("category ที่ไม่รู้จัก → badge ใช้ค่า category ดิบ, ไม่มี category เลย → badge fallback เป็น 'ผลงาน' และ data-cat เป็น 'custom'", async () => {
    setupDom();
    stubCollections({
      portfolios: [
        portfolioItem({ id: "a", category: "งานพิเศษ" }),
        portfolioItem({ id: "b", category: "" })
      ]
    });
    await importFresh();
    const html = $("home-wg-grid").innerHTML;
    assert.match(html, /port-badge">งานพิเศษ</);
    assert.match(html, /port-badge">ผลงาน</);
    assert.match(html, /data-cat="custom"/);
  });

  test("client/description มีค่า → แสดง, ไม่มีค่า → ไม่แสดง element นั้นเลย", async () => {
    setupDom();
    stubCollections({
      portfolios: [
        portfolioItem({ id: "a", client: "บริษัท เอ", description: "รายละเอียดงาน" }),
        portfolioItem({ id: "b", client: "", description: "" })
      ]
    });
    await importFresh();
    const html = $("home-wg-grid").innerHTML;
    assert.match(html, /port-client">บริษัท เอ</);
    assert.match(html, /<p>รายละเอียดงาน<\/p>/);
    const cards = dom.window.document.querySelectorAll("#home-wg-grid .port-card");
    assert.equal(cards[1].querySelector(".port-client"), null);
    assert.equal(cards[1].querySelector(".port-info p"), null);
  });

  test("data-images round-trip ผ่าน DOM parser จริง — เฉพาะรูปที่ไม่ falsy เท่านั้น", async () => {
    setupDom();
    stubCollections({
      portfolios: [portfolioItem({ images: ["https://cdn.test/1.jpg", null, "https://cdn.test/2.jpg"] })]
    });
    await importFresh();
    const card = dom.window.document.querySelector("#home-wg-grid .port-card");
    const images = JSON.parse(card.dataset.images);
    assert.deepEqual(images, ["https://cdn.test/1.jpg", "https://cdn.test/2.jpg"]);
  });
});

describe("renderStarredWorks() — error path", () => {
  test("getPortfolios() throw → console.warn 1 ครั้ง, section ไม่แสดง, ไม่ throw ออกมา", async () => {
    setupDom();
    const calls = captureWarn();
    stubCollectionsThrow("portfolios", new Error("โหลดพัง"));
    await importFresh();
    assert.equal($("starred-works").classList.contains("is-visible"), false);
    assert.equal(calls.length, 1);
  });
});

// =====================================================================
// renderPromoUpdates() — โปรโมชั่น & ข่าวอัพเดตล่าสุด
// =====================================================================
describe("renderPromoUpdates() — element guard", () => {
  test("ไม่มี #home-promo-grid → ไม่เรียก getSettings เลย", async () => {
    // ปิด #home-intro-video ด้วย เพราะ renderIntroVideo() ก็เรียก getSettings() ที่ path เดียวกัน
    // อิสระจากกัน ถ้าเปิดทิ้งไว้จะทำให้ flag ติด true จากคนละฟังก์ชัน แยกไม่ออกว่า renderPromoUpdates
    // เรียกเองหรือไม่
    setupDom({ hasPromo: false, hasIntroVideo: false });
    let called = false;
    globalThis.__GET_DOC_STUB__ = (ref) => { if (ref && ref.path === "settings/main") called = true; return { exists: false, data: {} }; };
    await importFresh();
    assert.equal(called, false);
  });
});

describe("renderPromoUpdates() — ไม่มีรูป → คงการ์ด 'รออัพเดต' เดิม", () => {
  test("ไม่มีเอกสาร settings เลย → ไม่แตะ DOM, ยังมี class promo-grid--empty เดิม", async () => {
    setupDom();
    stubSettings(undefined);
    await importFresh();
    assert.equal($("home-promo-grid").innerHTML, "PROMO-FALLBACK");
    assert.equal($("home-promo-grid").classList.contains("promo-grid--empty"), true);
  });

  test("settings ไม่มี promoUpdates เลย → คง fallback เดิม", async () => {
    setupDom();
    stubSettings({});
    await importFresh();
    assert.equal($("home-promo-grid").innerHTML, "PROMO-FALLBACK");
  });

  test("promoUpdates ทุกตัวไม่มี .image → กรองทิ้งหมด → คง fallback เดิม", async () => {
    setupDom();
    stubSettings({ promoUpdates: [{ title: "ไม่มีรูป" }, { image: "" }] });
    await importFresh();
    assert.equal($("home-promo-grid").innerHTML, "PROMO-FALLBACK");
  });
});

describe("renderPromoUpdates() — มีรูป → แสดงคารูเซล", () => {
  test("มี 1 รูป → ลูกศร prev/next มี disabled, ไม่มี counter/dots", async () => {
    setupDom();
    stubSettings({ promoUpdates: [promoItem()] });
    await importFresh();
    const grid = $("home-promo-grid");
    assert.equal(grid.classList.contains("promo-grid--empty"), false);
    assert.ok(grid.querySelector(".pcar-arrow--prev").hasAttribute("disabled"));
    assert.ok(grid.querySelector(".pcar-arrow--next").hasAttribute("disabled"));
    assert.equal(grid.querySelector(".pcar-counter"), null);
    assert.equal(grid.querySelector(".pcar-dots"), null);
  });

  test("มี 3 รูป → counter '1 / 3', dots 3 จุด, ลูกศรไม่ disabled", async () => {
    setupDom();
    stubSettings({ promoUpdates: [promoItem(), promoItem(), promoItem()] });
    await importFresh();
    const grid = $("home-promo-grid");
    assert.equal(grid.querySelector(".pcar-counter").textContent, "1 / 3");
    assert.equal(grid.querySelectorAll(".pcar-dot").length, 3);
    assert.equal(grid.querySelector(".pcar-arrow--prev").hasAttribute("disabled"), false);
  });

  test("PROMO_MAX=10 → ส่งมา 12 รูป ใช้แค่ 10 แรก", async () => {
    setupDom();
    const items = Array.from({ length: 12 }, (_, i) => promoItem({ title: "รูป" + i }));
    stubSettings({ promoUpdates: items });
    await importFresh();
    const grid = $("home-promo-grid");
    assert.equal(grid.querySelectorAll(".pcar-dot").length, 10);
    assert.equal(grid.querySelector(".pcar-counter").textContent, "1 / 10");
  });

  test("title มีค่า → มี caption + has-title class, ไม่มี title → ไม่มี caption", async () => {
    setupDom();
    stubSettings({ promoUpdates: [promoItem({ title: "โปรใหญ่ประจำเดือน" })] });
    await importFresh();
    assert.match($("home-promo-grid").innerHTML, /pcar-caption"><h3>โปรใหญ่ประจำเดือน<\/h3>/);
  });

  test("link มีค่าจริง (ตัด whitespace แล้วไม่ว่าง) → มีลิงก์เปิดแท็บใหม่, link เป็นช่องว่างล้วน → ไม่มีลิงก์", async () => {
    setupDom();
    stubSettings({
      promoUpdates: [promoItem({ link: "  https://example.test/promo  " }), promoItem({ link: "   " })]
    });
    await importFresh();
    const grid = $("home-promo-grid");
    const link = grid.querySelector(".pcar-view-link");
    assert.equal(link.getAttribute("href"), "https://example.test/promo");
    assert.equal(link.getAttribute("target"), "_blank");
    assert.equal(link.getAttribute("rel"), "noopener");
  });

  test("คลิกลูกศร next/prev, การ์ดข้าง, จุด — เปลี่ยน activeIndex และอัปเดต DOM", async () => {
    setupDom();
    stubSettings({
      promoUpdates: [
        promoItem({ title: "A" }),
        promoItem({ title: "B" }),
        promoItem({ title: "C" })
      ]
    });
    await importFresh();
    const grid = $("home-promo-grid");

    grid.querySelector(".pcar-arrow--next").click();
    assert.equal(grid.querySelector(".pcar-counter").textContent, "2 / 3");

    grid.querySelector(".pcar-arrow--prev").click();
    assert.equal(grid.querySelector(".pcar-counter").textContent, "1 / 3");

    // ลูกศร prev จาก index 0 ต้องวนไปที่ตัวสุดท้าย (n-1)
    grid.querySelector(".pcar-arrow--prev").click();
    assert.equal(grid.querySelector(".pcar-counter").textContent, "3 / 3");

    grid.querySelector(".pcar-dot[data-idx='0']").click();
    assert.equal(grid.querySelector(".pcar-counter").textContent, "1 / 3");

    grid.querySelector(".pcar-slide--side").click();
    // คลิกการ์ดข้าง (ตัวถัดไปหรือก่อนหน้า) ต้อง sync ไปที่ index ของการ์ดนั้น
    assert.notEqual(grid.querySelector(".pcar-counter").textContent, "1 / 3");
  });
});

describe("renderPromoUpdates() — autoplay จริงด้วย setInterval (real timer)", () => {
  test("มี ≥2 รูป → เลื่อนอัตโนมัติทุก 5 วิ, hover ค้าง (mouseenter) หยุดเลื่อน, ปล่อยเมาส์ (mouseleave) เลื่อนต่อ", async () => {
    setupDom();
    stubSettings({ promoUpdates: [promoItem({ title: "A" }), promoItem({ title: "B" })] });
    await importFresh();
    const grid = $("home-promo-grid");
    assert.equal(grid.querySelector(".pcar-counter").textContent, "1 / 2");

    await new Promise((r) => setTimeout(r, 5200));
    assert.equal(grid.querySelector(".pcar-counter").textContent, "2 / 2");

    grid.querySelector(".pcar").dispatchEvent(new dom.window.Event("mouseenter", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 5200));
    assert.equal(grid.querySelector(".pcar-counter").textContent, "2 / 2", "hover ค้างต้องหยุด autoplay");

    grid.querySelector(".pcar").dispatchEvent(new dom.window.Event("mouseleave", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 5200));
    assert.equal(grid.querySelector(".pcar-counter").textContent, "1 / 2", "ปล่อยเมาส์ต้องเลื่อนต่อ");
  });
});

describe("renderPromoUpdates() — error path", () => {
  test("getSettings() throw → console.warn, คงการ์ด 'รออัพเดต' เดิม", async () => {
    // ปิด #home-intro-video เพื่อแยกให้เหลือแค่ renderPromoUpdates() ที่เรียก getSettings()
    // (renderIntroVideo() เรียก getSettings() อิสระจากกัน ถ้าเปิดทิ้งไว้จะ throw ซ้ำอีกรอบ
    // ทำให้นับจำนวนครั้งที่ console.warn ถูกเรียกไม่ตรงกับที่ renderPromoUpdates() เรียกเอง)
    setupDom({ hasIntroVideo: false });
    const calls = captureWarn();
    stubSettingsThrow(new Error("โหลดพัง"));
    await importFresh();
    assert.equal($("home-promo-grid").innerHTML, "PROMO-FALLBACK");
    assert.equal($("home-promo-grid").classList.contains("promo-grid--empty"), true);
    assert.equal(calls.length, 1);
  });
});

// =====================================================================
// renderIntroVideo() — เทสแค่ "การเชื่อมต่อ" (wiring) ผ่าน home-dynamic-showcase.js
// (พฤติกรรมภายในละเอียดเทสไว้ครบแล้วใน test/home-dynamic-showcase-video.test.mjs)
// =====================================================================
describe("renderIntroVideo() — ถูกเรียกอัตโนมัติจาก home-dynamic-showcase.js", () => {
  test("settings มี introVideos → #home-intro-video เปลี่ยนจาก fallback เป็น .vcar จริง", async () => {
    setupDom();
    stubSettings({ introVideos: [{ url: "https://cdn.test/v.mp4", title: "แนะนำสินค้า" }] });
    await importFresh();
    const wrap = $("home-intro-video");
    assert.notEqual(wrap.innerHTML, "INTRO-FALLBACK");
    assert.ok(wrap.querySelector(".vcar"));
  });

  test("ไม่มี introVideos/introVideo เลย → #home-intro-video คง fallback เดิม", async () => {
    setupDom();
    stubSettings({});
    await importFresh();
    assert.equal($("home-intro-video").innerHTML, "INTRO-FALLBACK");
  });
});

// =====================================================================
// การรันร่วมกันของทั้ง 4 ส่วน — sanity check ว่าไม่รบกวนกันข้าม section
// =====================================================================
describe("integration — ทุก section ทำงานพร้อมกันโดยไม่รบกวนกัน", () => {
  test("สินค้าแนะนำ + ผลงานเด่น + โปรโมชั่น + วิดีโอ ครบทุกส่วนในการ import เดียว", async () => {
    setupDom();
    stubCollections({
      products: [product({ id: "p1" })],
      portfolios: [portfolioItem({ id: "w1" })]
    });
    stubSettings({
      promoUpdates: [promoItem({ title: "โปร" })],
      introVideos: [{ url: "https://cdn.test/v.mp4" }]
    });
    await importFresh();
    assert.equal($("featured-products").classList.contains("is-visible"), true);
    assert.equal($("starred-works").classList.contains("is-visible"), true);
    assert.ok($("home-promo-grid").querySelector(".pcar"));
    assert.ok($("home-intro-video").querySelector(".vcar"));
  });
});
