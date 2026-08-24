// test/products-detail-popup.test.mjs
//
// jsdom test สำหรับ js/products-detail-popup.js (TH) และ js/products-detail-popup-en.js
// (EN) — ไฟล์ใหม่ 2 ไฟล์จากรอบที่ 84 ที่ย้ายออกมาจาก inline <script> เดิมใน
// products.html/en/products.html แบบไม่มีการเปลี่ยน logic เลย (เตรียมเอา 'unsafe-inline'
// ออกจาก Content-Security-Policy script-src ในอนาคต — ดู REFACTOR-PROGRESS.md หัวข้อ
// "รอบที่ 84")
//
// วิธีทดสอบ: เหมือน test/about-portfolio-extracted-inline-scripts.test.mjs — โหลดเป็น
// classic <script> จริงเข้า JSDOM window (runScripts: "dangerously") พร้อม HTML ที่มี
// element ครบตามที่ไฟล์ต้องการ แล้วยิง event จริงตรวจพฤติกรรม — ไฟล์เหล่านี้เป็น
// UI-layer ล้วนๆ ไม่ import อะไรจาก db.js จึงไม่ต้อง stub Firebase — window.openModal
// เป็น dependency ภายนอก (มาจาก js/lead-quote-modal.js) จึง stub เป็น mock function เก็บ
// argument การเรียกไว้ตรวจสอบ

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import { JSDOM } from "jsdom";

const thSource = readFileSync(new URL("../js/products-detail-popup.js", import.meta.url), "utf-8");
const enSource = readFileSync(new URL("../js/products-detail-popup-en.js", import.meta.url), "utf-8");

function runScript(dom, source) {
  const scriptEl = dom.window.document.createElement("script");
  scriptEl.textContent = source;
  dom.window.document.body.appendChild(scriptEl);
}

// HTML fixture ครอบคลุม element ทุกตัวที่ไฟล์ต้องการ (อ้างอิงจาก id จริงใน
// products.html: product-tabs-dynamic/product-grid/pr-count/pr-empty/pd-overlay/
// pd-close/pd-main-img/pd-main-svg/pd-main-img-tag/pd-thumbs/pd-zoom-hint/pd-cat/
// pd-name/pd-code/pd-price/pd-variant-block/pd-details-label/pd-desc/pd-specs/
// pd-tags-label/pd-tags/pd-full-link/pd-inquiry-btn/pd-quote-btn) — qm-msg มาจาก
// template ของ js/qmodal-template.js เดิม (แยกไฟล์ ไม่ได้อยู่ใน DOM นี้จริงตอนโหลด
// products.html แต่ผูก event ตอนคลิกปุ่มเท่านั้น จึงใส่ไว้ในเทสเพื่อครอบคลุม flow นี้)
function buildFixture() {
  return `<!doctype html><html><body>
    <nav id="site-nav">
      <a href="products.html?cat=traffic" id="nav-link-traffic">Traffic Signage</a>
      <a href="?cat=safety" id="nav-link-safety-relative">Safety (relative href)</a>
    </nav>
    <div class="product-tabs" id="product-tabs-dynamic">
      <button class="product-tab active" data-filter="all">All</button>
      <button class="product-tab" data-filter="safety">Safety</button>
      <button class="product-tab" data-filter="traffic">Traffic</button>
    </div>
    <span id="pr-count"></span>
    <div class="product-grid" id="product-grid">
      <div class="product-card" data-cat="safety" data-product='${JSON.stringify({
        name: "Safety Sign",
        cat: "Safety Signage",
        code: "CSS-SAFE-001",
        price: "Request a quote",
        desc: "A durable safety sign.",
        material: "Aluminum",
        size: "15x15cm",
        tags: ["Safety", "Custom"],
        views: ["Front", "Back", "Side"]
      }).replace(/'/g, "&#39;")}'>
        <button type="button" class="detail-btn">Detail</button>
      </div>
      <div class="product-card" data-cat="traffic" data-product='${JSON.stringify({
        name: "Traffic Sign",
        cat: "Traffic Signage",
        code: "CSS-TRAF-002",
        price: "Request a quote",
        desc: "",
        optionAxes: [{ label: "Size", options: [{ code: "s", label: "Small" }, { code: "l", label: "Large" }] }],
        variants: [
          { codes: ["s"], price: 100 },
          { codes: ["l"], price: 200 }
        ],
        images: [{ url: "/img/traffic-1.jpg", label: "Front" }],
        tags: [],
        slug: "traffic-sign"
      }).replace(/'/g, "&#39;")}'>
        <a class="detail-btn" href="product-detail.html?slug=traffic-sign">Detail</a>
      </div>
    </div>
    <div class="pr-empty" id="pr-empty"></div>

    <div class="pd-overlay" id="pd-overlay" role="dialog" aria-modal="true">
      <div class="pd-main-img" id="pd-main-img">
        <svg id="pd-main-svg"></svg>
        <img id="pd-main-img-tag" src="" alt="" style="display:none;">
        <div class="pd-zoom-hint" id="pd-zoom-hint">Click to zoom</div>
      </div>
      <div class="pd-thumbs" id="pd-thumbs"></div>
      <button class="pd-close" id="pd-close">Close</button>
      <div class="pd-cat-label" id="pd-cat"></div>
      <h2 class="pd-name" id="pd-name"></h2>
      <div class="pd-code" id="pd-code"></div>
      <span class="pd-price" id="pd-price"></span>
      <div class="pd-variant-block" id="pd-variant-block"></div>
      <div class="pd-section-label" id="pd-details-label">Details</div>
      <p class="pd-desc" id="pd-desc"></p>
      <div class="pd-specs" id="pd-specs"></div>
      <div class="pd-section-label" id="pd-tags-label">Tags</div>
      <div class="pd-tags" id="pd-tags"></div>
      <a class="pd-full-link" id="pd-full-link" href="#" style="display:none;">Full details</a>
      <button class="pd-cart-btn" id="pd-cart-btn">Add to cart</button>
      <button class="pd-inquiry-btn" id="pd-inquiry-btn">Inquiry</button>
      <button class="pd-quote-btn" id="pd-quote-btn">Get a quote</button>
    </div>
    <textarea id="qm-msg"></textarea>
  </body></html>`;
}

function makeDom(source) {
  const dom = new JSDOM(buildFixture(), {
    url: "https://example.test/products.html",
    runScripts: "dangerously",
    pretendToBeVisual: true,
  });
  const calls = [];
  dom.window.openModal = (...args) => calls.push(args);
  // switchCategoryInstantly() เรียก grid.scrollIntoView() ทุกครั้งที่กรองกริดผ่าน pushState/popstate —
  // jsdom ไม่ implement scrollIntoView() (หมายเหตุสะสมจากรอบก่อนๆ) ต้อง stub ก่อนยิง event ใดๆ เสมอ
  // ไม่งั้น click ลิงก์ nav/popstate จะ throw ทันที (TypeError: ...scrollIntoView is not a function)
  dom.window.HTMLElement.prototype.scrollIntoView = function () {};
  runScript(dom, source);
  return { dom, openModalCalls: calls };
}

// สำหรับเทส deep-link ?cat=xxx ตอนโหลดหน้าแรก — ต้องสร้าง JSDOM ที่มี query string อยู่ใน url
// ตั้งแต่ก่อนรันสคริปต์เลย (params อ่านจาก window.location.search ตอน IIFE รันครั้งแรก)
function makeDomAtUrl(source, url) {
  const dom = new JSDOM(buildFixture(), {
    url,
    runScripts: "dangerously",
    pretendToBeVisual: true,
  });
  dom.window.openModal = () => {};
  dom.window.HTMLElement.prototype.scrollIntoView = function () {};
  runScript(dom, source);
  return dom;
}

const PD_FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), textarea:not([disabled]), ' +
  'input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

for (const [label, source] of [["TH — js/products-detail-popup.js", thSource], ["EN — js/products-detail-popup-en.js", enSource]]) {
  describe(`${label} (รอบที่ 84, ย้ายจาก products.html/en/products.html inline)`, () => {
    test("โหลดสคริปต์แล้วไม่ throw + กรองการ์ดเริ่มต้นเป็น 'all' (product-grid ครบทุกใบ)", () => {
      const { dom } = makeDom(source);
      const doc = dom.window.document;
      assert.equal(doc.getElementById("pr-count").textContent, "2");
      assert.equal(doc.getElementById("pr-empty").classList.contains("show"), false);
    });

    test("คลิก tab 'safety': กรองเหลือการ์ดเดียว + count/empty อัปเดตถูกต้อง", () => {
      const { dom } = makeDom(source);
      const doc = dom.window.document;
      const tab = doc.querySelector('[data-filter="safety"]');
      tab.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));

      assert.equal(tab.classList.contains("active"), true);
      const cards = doc.querySelectorAll(".product-card");
      assert.equal(cards[0].style.display, "");
      assert.equal(cards[1].style.display, "none");
      assert.equal(doc.getElementById("pr-count").textContent, "1");
      assert.equal(doc.getElementById("pr-empty").classList.contains("show"), false);
    });

    test("คลิกปุ่ม detail-btn (button ธรรมดา ไม่มี slug): เปิด pd-overlay + เติมข้อมูล + fallback material/size ใน pd-specs", () => {
      const { dom } = makeDom(source);
      const doc = dom.window.document;
      const btn = doc.querySelector('.product-card[data-cat="safety"] .detail-btn');
      btn.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));

      assert.equal(doc.getElementById("pd-overlay").classList.contains("open"), true);
      assert.equal(doc.getElementById("pd-name").textContent, "Safety Sign");
      assert.equal(doc.getElementById("pd-cat").textContent, "Safety Signage");
      assert.match(doc.getElementById("pd-code").textContent, /CSS-SAFE-001/);
      // ไม่มี optionAxes/variants → แสดง material/size แบบเดิม
      assert.match(doc.getElementById("pd-specs").innerHTML, /Aluminum/);
      assert.match(doc.getElementById("pd-specs").innerHTML, /15x15cm/);
      // ไม่มี slug (การ์ดนี้ไม่มี field slug ในตัวอย่างที่ไม่มี variants) → ซ่อน pd-full-link
      assert.equal(doc.getElementById("pd-full-link").style.display, "none");
    });

    test("คลิกลิงก์ <a class=\"detail-btn\" href=\"...\"> ปกติ (ไม่กด ctrl/shift): preventDefault ไม่ navigate จริง แล้วเปิด popup แทน", () => {
      const { dom } = makeDom(source);
      const doc = dom.window.document;
      const link = doc.querySelector('.product-card[data-cat="traffic"] a.detail-btn');
      const ev = new dom.window.MouseEvent("click", { bubbles: true, cancelable: true });
      const notPrevented = link.dispatchEvent(ev);

      assert.equal(notPrevented, false); // preventDefault ถูกเรียก
      assert.equal(doc.getElementById("pd-overlay").classList.contains("open"), true);
      assert.equal(doc.getElementById("pd-name").textContent, "Traffic Sign");
      // มี slug → แสดง pd-full-link พร้อม href ที่ถูกต้อง
      assert.equal(doc.getElementById("pd-full-link").style.display, "");
      assert.match(doc.getElementById("pd-full-link").href, /product-detail\.html\?slug=traffic-sign/);
    });

    test("สินค้าที่มี optionAxes/variants: pd-variant-block แสดง chip ตัวเลือก + ยังไม่เลือกครบ ราคาโชว์ข้อความเตือน", () => {
      const { dom } = makeDom(source);
      const doc = dom.window.document;
      const link = doc.querySelector('.product-card[data-cat="traffic"] a.detail-btn');
      link.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));

      const chips = doc.querySelectorAll(".pd-chip");
      assert.equal(chips.length, 2); // small, large
      // ยังไม่เลือก → priceEl ไม่ใช่ตัวเลข
      const priceText = doc.getElementById("pd-price").textContent;
      assert.equal(/^\d/.test(priceText.trim()), false);
    });

    test("เลือก variant chip ครบ: ราคาต่อชิ้น/ราคารวมอัปเดตถูกต้องตาม qty", () => {
      const { dom } = makeDom(source);
      const doc = dom.window.document;
      const link = doc.querySelector('.product-card[data-cat="traffic"] a.detail-btn');
      link.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));

      const chipLarge = Array.from(doc.querySelectorAll(".pd-chip")).find((c) => c.dataset.code === "l");
      chipLarge.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));

      assert.match(doc.getElementById("pd-price").textContent, /200/);
      const total = doc.getElementById("pd-variant-total").innerHTML;
      assert.match(total, /200/); // qty=1 default → total เท่ากับ unit price

      // เพิ่มจำนวนเป็น 2 ด้วยปุ่ม +
      doc.getElementById("pd-qty-plus").dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
      const totalAfter = doc.getElementById("pd-variant-total").innerHTML;
      assert.match(totalAfter, /400/); // 200 * 2
    });

    test("ปุ่ม pd-close: ปิด overlay + คืน scroll ของ body", () => {
      const { dom } = makeDom(source);
      const doc = dom.window.document;
      doc.querySelector('.product-card[data-cat="safety"] .detail-btn').dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
      assert.equal(doc.getElementById("pd-overlay").classList.contains("open"), true);

      doc.getElementById("pd-close").dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
      assert.equal(doc.getElementById("pd-overlay").classList.contains("open"), false);
      assert.equal(doc.body.style.overflow, "");
    });

    test("คลิกพื้นหลัง pd-overlay (นอกกล่องเนื้อหา): ปิด popup — คลิกในกล่องไม่ปิด", () => {
      const { dom } = makeDom(source);
      const doc = dom.window.document;
      doc.querySelector('.product-card[data-cat="safety"] .detail-btn').dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));

      // คลิกในกล่อง (target = pd-name ไม่ใช่ pd-overlay เอง) ไม่ปิด
      doc.getElementById("pd-name").dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
      assert.equal(doc.getElementById("pd-overlay").classList.contains("open"), true);

      // คลิกตัว pd-overlay เอง (target === currentTarget) ปิด
      doc.getElementById("pd-overlay").dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
      assert.equal(doc.getElementById("pd-overlay").classList.contains("open"), false);
    });

    test("กด Escape: ปิด popup", () => {
      const { dom } = makeDom(source);
      const doc = dom.window.document;
      doc.querySelector('.product-card[data-cat="safety"] .detail-btn').dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
      doc.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      assert.equal(doc.getElementById("pd-overlay").classList.contains("open"), false);
    });

    test("คลิก pd-inquiry-btn: ปิด popup แล้วเรียก window.openModal('form') หลัง 200ms", async () => {
      const { dom, openModalCalls } = makeDom(source);
      const doc = dom.window.document;
      doc.querySelector('.product-card[data-cat="safety"] .detail-btn').dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));

      doc.getElementById("pd-inquiry-btn").dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
      assert.equal(doc.getElementById("pd-overlay").classList.contains("open"), false);

      await sleep(250);
      assert.deepEqual(openModalCalls, [["form"]]);
    });

    test("เลือก variant ครบแล้วคลิก pd-quote-btn: openModal('form') ถูกเรียก + qm-msg ถูกเติมข้อความสรุปตัวเลือก/ราคา", async () => {
      const { dom, openModalCalls } = makeDom(source);
      const doc = dom.window.document;
      doc.querySelector('.product-card[data-cat="traffic"] a.detail-btn').dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
      const chipLarge = Array.from(doc.querySelectorAll(".pd-chip")).find((c) => c.dataset.code === "l");
      chipLarge.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));

      doc.getElementById("pd-quote-btn").dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
      await sleep(250);

      assert.equal(openModalCalls.length, 1);
      assert.deepEqual(openModalCalls[0], ["form"]);
      assert.match(doc.getElementById("qm-msg").value, /Traffic Sign/);
      assert.match(doc.getElementById("qm-msg").value, /200/);
    });

    test("คลิก pd-quote-btn โดยยังไม่เคยเปิด popup มาก่อน (__pdEstSummary เป็น null): ไม่ throw และ qm-msg ไม่ถูกแก้", () => {
      const { dom } = makeDom(source);
      const doc = dom.window.document;
      doc.getElementById("qm-msg").value = "";
      assert.doesNotThrow(() => {
        doc.getElementById("pd-quote-btn").dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
      });
      assert.equal(doc.getElementById("qm-msg").value, "");
    });

    test("คลิกรูปหลัก (pd-main-img): toggle class 'zoomed' + เปลี่ยนข้อความ pd-zoom-hint", () => {
      // หมายเหตุ: สคริปต์ตั้งค่า pd-zoom-hint.textContent เป็นข้อความของตัวเอง (TH/EN
      // ตามไฟล์) ทุกครั้งที่คลิก ไม่ได้แคร์ข้อความเดิมใน fixture markup ก่อนคลิก จึงเทียบ
      // ข้อความหลังคลิกครั้งที่ 1 (zoomed) กับหลังคลิกครั้งที่ 2 (unzoomed) แทนการเทียบกับ
      // ข้อความ fixture เริ่มต้นซึ่งเป็นค่าที่ตั้งขึ้นเองในเทส ไม่ใช่ค่าจริงจากสคริปต์
      const { dom } = makeDom(source);
      const doc = dom.window.document;
      const mainImg = doc.getElementById("pd-main-img");
      const hint = doc.getElementById("pd-zoom-hint");

      mainImg.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
      assert.equal(mainImg.classList.contains("zoomed"), true);
      const zoomedText = hint.textContent;

      mainImg.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
      assert.equal(mainImg.classList.contains("zoomed"), false);
      const unzoomedText = hint.textContent;

      assert.notEqual(zoomedText, unzoomedText);
      assert.equal(typeof zoomedText, "string");
      assert.notEqual(zoomedText.trim(), "");
      assert.notEqual(unzoomedText.trim(), "");
    });

    // ---------------------------------------------------------------
    // เพิ่มเติมรอบที่ 85 — ปิด 3 จุดที่บันทึกไว้ว่ายังไม่มีเทสจากรอบ 84
    // (deep-link ?cat=, instant category switch + popstate, focus trap เต็มรูปแบบ)
    // ---------------------------------------------------------------

    test("deep-link ?cat=safety ตอนโหลดหน้าแรก: ก่อน 200ms ยังเป็น 'all' ปกติ หลัง 200ms auto-click tab safety + กรองกริดตาม", async () => {
      const dom = makeDomAtUrl(source, "https://example.test/products.html?cat=safety");
      const doc = dom.window.document;

      // ทันทีหลังโหลด (ก่อน setTimeout 200ms ทำงาน): filterCards('all') ถูกเรียกไปแล้วตอนต้นไฟล์
      // เสมอ ไม่ว่าจะมี ?cat= หรือไม่ — เทสจุดนี้เพื่อยืนยันว่า auto-click ยังไม่เกิดขึ้นเร็วเกินไป
      assert.equal(doc.querySelector('[data-filter="all"]').classList.contains("active"), true);
      assert.equal(doc.getElementById("pr-count").textContent, "2");

      await sleep(250);

      const safetyTab = doc.querySelector('[data-filter="safety"]');
      assert.equal(safetyTab.classList.contains("active"), true);
      const cards = doc.querySelectorAll(".product-card");
      assert.equal(cards[0].style.display, ""); // safety card แสดง
      assert.equal(cards[1].style.display, "none"); // traffic card ซ่อน
      assert.equal(doc.getElementById("pr-count").textContent, "1");
    });

    test("deep-link ?cat=xxx ที่ไม่ตรงกับ tab ไหนเลย: ไม่มี tab ให้คลิก จึงยังคงกรองเป็น 'all' ต่อไป ไม่ throw", async () => {
      const dom = makeDomAtUrl(source, "https://example.test/products.html?cat=no-such-category");
      const doc = dom.window.document;

      await sleep(250);

      assert.equal(doc.querySelector('[data-filter="all"]').classList.contains("active"), true);
      assert.equal(doc.getElementById("pr-count").textContent, "2");
    });

    test("deep-link ?cat=all: ไม่ตั้ง setTimeout auto-click เลย (เงื่อนไข cat !== 'all')", async () => {
      const dom = makeDomAtUrl(source, "https://example.test/products.html?cat=all");
      const doc = dom.window.document;

      await sleep(250);
      // ยังเป็น 'all' เหมือนเดิมตั้งแต่ต้น ไม่มีอะไรเปลี่ยน (ไม่ throw ด้วย)
      assert.equal(doc.querySelector('[data-filter="all"]').classList.contains("active"), true);
    });

    test("คลิกลิงก์ nav href*=\"products.html?cat=traffic\" (นอก tabsWrap เดิม): preventDefault + pushState + กรองกริดทันทีไม่ reload", () => {
      const { dom } = makeDom(source);
      const doc = dom.window.document;
      const navLink = doc.getElementById("nav-link-traffic");
      const ev = new dom.window.MouseEvent("click", { bubbles: true, cancelable: true });
      const notPrevented = navLink.dispatchEvent(ev);

      assert.equal(notPrevented, false, "ต้องเรียก preventDefault ไม่ให้ reload หน้าจริง");
      assert.equal(dom.window.location.search, "?cat=traffic", "pushState ต้องอัปเดต URL bar");
      const cards = doc.querySelectorAll(".product-card");
      assert.equal(cards[0].style.display, "none"); // safety ซ่อน
      assert.equal(cards[1].style.display, ""); // traffic แสดง
      assert.equal(doc.querySelector('[data-filter="traffic"]').classList.contains("active"), true);
    });

    test("คลิกลิงก์ nav แบบ href=\"?cat=safety\" (relative, ตรง a[href^=\"?cat=\"]): ทำงานเหมือนกันทุกประการ", () => {
      const { dom } = makeDom(source);
      const doc = dom.window.document;
      const navLink = doc.getElementById("nav-link-safety-relative");
      navLink.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, cancelable: true }));

      assert.equal(dom.window.location.search, "?cat=safety");
      assert.equal(doc.querySelector('[data-filter="safety"]').classList.contains("active"), true);
      assert.equal(doc.getElementById("pr-count").textContent, "1");
    });

    test("popstate (กด back/forward เบราว์เซอร์): กรองกริดตาม query string ใหม่ทันที ไม่ pushState ซ้ำ", () => {
      const { dom } = makeDom(source);
      const doc = dom.window.document;
      // จำลองว่าเบราว์เซอร์เปลี่ยน URL ไปแล้ว (เช่นกด back) ก่อนยิง popstate event
      dom.window.history.pushState({}, "", "/products.html?cat=safety");
      dom.window.dispatchEvent(new dom.window.PopStateEvent("popstate", {}));

      const cards = doc.querySelectorAll(".product-card");
      assert.equal(cards[0].style.display, ""); // safety แสดง
      assert.equal(cards[1].style.display, "none"); // traffic ซ่อน
      assert.equal(doc.querySelector('[data-filter="safety"]').classList.contains("active"), true);
    });

    test("popstate กลับไปไม่มี query เลย (cat=all โดยปริยาย): กรองกลับเป็น all ทั้งหมด", () => {
      const { dom } = makeDom(source);
      const doc = dom.window.document;
      // กรองไป traffic ก่อน (จำลองว่าผู้ใช้เคยกดลิงก์ cat=traffic ไปแล้วก่อนหน้านี้)
      doc.querySelector('[data-filter="traffic"]').dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
      assert.equal(doc.getElementById("pr-count").textContent, "1");

      dom.window.history.pushState({}, "", "/products.html");
      dom.window.dispatchEvent(new dom.window.PopStateEvent("popstate", {}));

      assert.equal(doc.getElementById("pr-count").textContent, "2");
      assert.equal(doc.querySelector('[data-filter="all"]').classList.contains("active"), true);
    });

    test("focus trap เต็มรูปแบบ (pdTrapTab): Tab จาก focusable ตัวสุดท้ายใน pd-overlay วนกลับไปตัวแรก เมื่อ popup เปิดอยู่", () => {
      const { dom } = makeDom(source);
      const doc = dom.window.document;
      doc.querySelector('.product-card[data-cat="safety"] .detail-btn').dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));

      const overlay = doc.getElementById("pd-overlay");
      const focusables = Array.from(overlay.querySelectorAll(PD_FOCUSABLE_SELECTOR));
      assert.ok(focusables.length > 1, "pd-overlay ควรมี focusable element หลายตัว (ปุ่มปิด/ลิงก์/ปุ่มสอบถาม/ใบเสนอราคา)");
      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      last.focus();
      doc.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true }));

      assert.equal(doc.activeElement, first);
    });

    test("focus trap เต็มรูปแบบ (pdTrapTab): Shift+Tab จาก focusable ตัวแรกวนไปตัวสุดท้าย", () => {
      const { dom } = makeDom(source);
      const doc = dom.window.document;
      doc.querySelector('.product-card[data-cat="safety"] .detail-btn').dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));

      const overlay = doc.getElementById("pd-overlay");
      const focusables = Array.from(overlay.querySelectorAll(PD_FOCUSABLE_SELECTOR));
      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      first.focus();
      doc.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true, cancelable: true }));

      assert.equal(doc.activeElement, last);
    });

    test("focus trap: ถ้า focus หลุดออกไปนอก pd-overlay โดยไม่ตั้งใจ (safety net) แล้วกด Tab จะถูกดึงกลับไปตัวแรกใน overlay ทันที", () => {
      const { dom } = makeDom(source);
      const doc = dom.window.document;
      doc.querySelector('.product-card[data-cat="safety"] .detail-btn').dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));

      const outsideBtn = doc.createElement("button");
      outsideBtn.id = "outside-btn-not-in-overlay";
      doc.body.appendChild(outsideBtn);
      outsideBtn.focus();

      doc.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true }));

      const overlay = doc.getElementById("pd-overlay");
      const focusables = Array.from(overlay.querySelectorAll(PD_FOCUSABLE_SELECTOR));
      assert.equal(doc.activeElement, focusables[0]);
    });

    test("focus trap: ตอน popup ปิดอยู่ (ยังไม่เคยเปิดเลย) กด Tab ไม่ถูกดัก ไม่ throw และไม่บังคับย้าย focus", () => {
      const { dom } = makeDom(source);
      const doc = dom.window.document;
      const freeBtn = doc.createElement("button");
      freeBtn.id = "free-standing-btn";
      doc.body.appendChild(freeBtn);
      freeBtn.focus();

      assert.doesNotThrow(() => {
        doc.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true }));
      });
      assert.equal(doc.activeElement, freeBtn);
    });
  });
}

// ---------------------------------------------------------------
// รอบย่อย 2 (P3.0 Phase 1) — ปุ่ม "เพิ่มลงตะกร้า" ใน js/products-detail-popup.js (TH เท่านั้น
// รอบนี้ — js/products-detail-popup-en.js ยังไม่แตะ ตามขอบเขตของ continue-prompt-p3.0-phase1-
// round2.md) — window.CSSignCart มาจาก js/cart-global.js (bridge module, โหลดจริงใน
// products.html แต่ในเทสนี้ stub เองตรงๆ เพราะไฟล์นี้เป็น classic script ไม่ได้ import
// cart-global.js ตรงๆ — สอดคล้องกับที่ dom.window.openModal ถูก stub ไว้แบบเดียวกันด้านบน)
describe("TH — js/products-detail-popup.js (รอบย่อย 2, ปุ่ม \"เพิ่มลงตะกร้า\")", () => {
  function makeDomWithCart() {
    const dom = new JSDOM(buildFixture(), {
      url: "https://example.test/products.html",
      runScripts: "dangerously",
      pretendToBeVisual: true,
    });
    const openModalCalls = [];
    dom.window.openModal = (...args) => openModalCalls.push(args);
    dom.window.HTMLElement.prototype.scrollIntoView = function () {};
    const cartCalls = [];
    dom.window.CSSignCart = {
      addToCart: (...args) => cartCalls.push(["addToCart", ...args]),
      addToCartAndNotify: (...args) => cartCalls.push(["addToCartAndNotify", ...args]),
    };
    runScript(dom, thSource);
    return { dom, openModalCalls, cartCalls };
  }

  test("สินค้าไม่มี optionAxes/variants: pd-cart-btn ไม่ disabled ตั้งแต่เปิด popup — กดแล้วเรียก addToCartAndNotify ด้วย qty=1", () => {
    const { dom, cartCalls } = makeDomWithCart();
    const doc = dom.window.document;
    doc.querySelector('.product-card[data-cat="safety"] .detail-btn').dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));

    const cartBtn = doc.getElementById("pd-cart-btn");
    assert.equal(cartBtn.disabled, false);

    cartBtn.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    assert.equal(cartCalls.length, 1);
    assert.deepEqual(cartCalls[0][0], "addToCartAndNotify");
    const [, item, qty] = cartCalls[0];
    assert.equal(item.name, "Safety Sign");
    assert.equal(item.productId, "CSS-SAFE-001"); // ไม่มี slug → fallback เป็น code
    assert.equal(item.variantLabel, "");
    assert.equal(item.unitPriceHint, null); // priceRaw ไม่มีในฟิกซ์เจอร์นี้ (ไม่ใช่ตัวเลข > 0)
    assert.equal(qty, 1);
    // popup ไม่ปิดหลังกด (ต่างจาก inquiry/quote) — ลูกค้าหยิบตัวเลือกอื่นต่อได้
    assert.equal(doc.getElementById("pd-overlay").classList.contains("open"), true);
  });

  test("สินค้ามี optionAxes/variants: pd-cart-btn disabled จนกว่าจะเลือกครบทุกหมวด — เลือกครบแล้วกด ส่ง variantLabel/unitPriceHint/qty ตรงตามที่เลือก", () => {
    const { dom, cartCalls } = makeDomWithCart();
    const doc = dom.window.document;
    doc.querySelector('.product-card[data-cat="traffic"] a.detail-btn').dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));

    const cartBtn = doc.getElementById("pd-cart-btn");
    assert.equal(cartBtn.disabled, true, "ยังไม่เลือก variant ใดเลย → ต้อง disabled");

    const chipLarge = Array.from(doc.querySelectorAll(".pd-chip")).find((c) => c.dataset.code === "l");
    chipLarge.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    assert.equal(cartBtn.disabled, false, "เลือกครบทุกหมวดแล้ว (มีแกนเดียว) → ต้อง enabled");

    doc.getElementById("pd-qty-plus").dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true })); // qty 1 → 2

    cartBtn.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    assert.equal(cartCalls.length, 1);
    const [, item, qty] = cartCalls[0];
    assert.equal(item.productId, "traffic-sign"); // มี slug → ใช้ slug
    assert.equal(item.variantLabel, "Size: Large");
    assert.equal(item.unitPriceHint, 200);
    assert.equal(qty, 2);
    assert.equal(item.image, "/img/traffic-1.jpg");
  });

  test("คลิก pd-cart-btn ก่อนเคยเปิด popup เลย (pdCurrentData เป็น null): ไม่ throw และไม่เรียก CSSignCart", () => {
    const { dom, cartCalls } = makeDomWithCart();
    const doc = dom.window.document;
    assert.doesNotThrow(() => {
      doc.getElementById("pd-cart-btn").dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    });
    assert.equal(cartCalls.length, 0);
  });

  test("window.CSSignCart ยังไม่พร้อม (module bridge ยังโหลดไม่เสร็จ): กดปุ่มไม่ throw และไม่ทำอะไร", () => {
    const dom = new JSDOM(buildFixture(), {
      url: "https://example.test/products.html",
      runScripts: "dangerously",
      pretendToBeVisual: true,
    });
    dom.window.openModal = () => {};
    dom.window.HTMLElement.prototype.scrollIntoView = function () {};
    // ไม่ตั้ง window.CSSignCart เลย จำลองเคสหายาก: ผู้ใช้กดเร็วมากก่อน type="module" script รันเสร็จ
    runScript(dom, thSource);
    const doc = dom.window.document;
    doc.querySelector('.product-card[data-cat="safety"] .detail-btn').dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));

    assert.doesNotThrow(() => {
      doc.getElementById("pd-cart-btn").dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    });
  });

  test("เปลี่ยนสินค้าที่เปิดอยู่ (ปิดแล้วเปิดสินค้าอื่น): pdCurrentData อัปเดตตามสินค้าล่าสุด ไม่ค้างจากสินค้าก่อนหน้า", () => {
    const { dom, cartCalls } = makeDomWithCart();
    const doc = dom.window.document;
    doc.querySelector('.product-card[data-cat="safety"] .detail-btn').dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    doc.getElementById("pd-close").dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));

    doc.querySelector('.product-card[data-cat="traffic"] a.detail-btn').dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    const chipSmall = Array.from(doc.querySelectorAll(".pd-chip")).find((c) => c.dataset.code === "s");
    chipSmall.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    doc.getElementById("pd-cart-btn").dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));

    assert.equal(cartCalls.length, 1);
    assert.equal(cartCalls[0][1].name, "Traffic Sign");
  });
});
