// test/products-detail-popup-en-currency.test.mjs — P2.10-currency-b + P2.10-currency-d
//
// ขอบเขต: currency switcher (#pd-currency-select) ที่เพิ่มเข้า js/products-detail-popup-en.js
// เท่านั้น (ตามพรอมต์รอบ 27/28 — เริ่มที่หน้า EN ก่อน) — js/products-detail-popup.js (TH) และ
// en/product-detail.html (หน้า standalone) ยังไม่ถูกแตะในรอบนี้ (ดู CHANGELOG.md/
// cssign-roadmap-prompt.md หัวข้อความคืบหน้าสำหรับสิ่งที่ยังไม่ทำ)
//
// P2.10-currency-d (รอบที่ 30) เพิ่มเข้ามา: เดิมสินค้าที่ "ไม่มี" variant ใช้ data.price
// (string ที่ format ไว้ล่วงหน้าเป็นภาษาไทยจาก js/products-cards.js) ตรงๆ ไม่ผ่าน
// pdFormatPrice() เลย เปลี่ยน currency แล้วราคาไม่ขยับ (ดูเทสเดิม "ปิดป็อปอัพแล้วเปิดสินค้าใหม่ที่
// ไม่มี variant..." ด้านล่างที่เคย assert พฤติกรรมนี้ไว้เป็น "ตามคาด") — แก้ให้ผ่าน
// pdRenderBasePrice()/pdFormatPrice() แทนเมื่อสินค้ามี data.priceRaw เป็นตัวเลขบวกจริง (สินค้าไม่
// มีราคาเลยยังคง fallback เป็น data.price เดิมทุกประการ ไม่เปลี่ยน) — เทสเดิมที่ fixture ไม่มี
// priceRaw เลยยังคงผ่านเหมือนเดิมไม่ต้องแก้ (พฤติกรรม fallback ไม่เปลี่ยน) เพิ่มเทสใหม่ 3 อัน
// คลุมเคส priceRaw ตัวเลขบวก + re-render สดตอนเปลี่ยน currency + priceRaw เป็น 0
//
// วิธีทดสอบ: เหมือน test/products-detail-popup.test.mjs — โหลดเป็น classic <script> จริงเข้า
// JSDOM window (runScripts: "dangerously") แต่ fixture ในไฟล์นี้เพิ่ม #pd-currency-select เข้าไป
// (fixture เดิมใน products-detail-popup.test.mjs ไม่มี element นี้ ยืนยันแล้วว่าพฤติกรรมเดิม
// ไม่เปลี่ยนเมื่อไม่มี select — ดูเทสในไฟล์นั้น) — window.CSSignCurrency ถูก stub ด้วยฟังก์ชันจริง
// จาก js/currency.js ตรงๆ (import มาจริง ไม่ mock ค่า) เพื่อเทส end-to-end ของ pdFormatPrice()
// โดยไม่ต้องพึ่งพา js/currency-global.js (ไฟล์นั้นมีเทสของตัวเองแยกใน
// test/currency-global.test.mjs อยู่แล้ว — ที่นี่เทสแค่ว่า products-detail-popup-en.js เรียกใช้
// window.CSSignCurrency ถูกต้อง) — jsdom เวอร์ชันที่ใช้ในโปรเจกต์นี้ implement localStorage จริง
// (Storage object ใช้งานได้ปกติ แต่ property เป็น getter-only แก้ไม่ได้ตรงๆ) กรณี "ไม่มี
// localStorage" (private mode) จึงจำลองด้วยการ override getter ให้ throw แทนการ stub ทั้งก้อน

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import { JSDOM } from "jsdom";
import {
  getSupportedCurrencies,
  isSupportedCurrency,
  convertFromTHB,
  formatCurrencyAmount,
  CURRENCY_SYMBOLS,
} from "../js/currency.js";

const enSource = readFileSync(new URL("../js/products-detail-popup-en.js", import.meta.url), "utf-8");

function runScript(dom, source) {
  const scriptEl = dom.window.document.createElement("script");
  scriptEl.textContent = source;
  dom.window.document.body.appendChild(scriptEl);
}


// สินค้า variant เดียวกับ fixture ใน test/products-detail-popup.test.mjs (traffic sign,
// s=100 THB, l=200 THB) — เพียงพอสำหรับเทสการแปลง currency ของราคาต่อ variant
const trafficProduct = {
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
};

function buildFixture() {
  return `<!doctype html><html><body>
    <div class="product-tabs" id="product-tabs-dynamic">
      <button class="product-tab active" data-filter="all">All</button>
    </div>
    <span id="pr-count"></span>
    <div class="product-grid" id="product-grid">
      <div class="product-card" data-cat="traffic" data-product='${JSON.stringify(trafficProduct).replace(/'/g, "&#39;")}'>
        <button type="button" class="detail-btn">Detail</button>
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
      <select id="pd-currency-select" aria-label="Currency">
        <option value="THB">THB ฿</option>
        <option value="USD">USD $</option>
        <option value="EUR">EUR €</option>
        <option value="CNY">CNY ¥</option>
      </select>
      <div class="pd-variant-block" id="pd-variant-block"></div>
      <div class="pd-section-label" id="pd-details-label">Details</div>
      <p class="pd-desc" id="pd-desc"></p>
      <div class="pd-specs" id="pd-specs"></div>
      <div class="pd-section-label" id="pd-tags-label">Tags</div>
      <div class="pd-tags" id="pd-tags"></div>
      <a class="pd-full-link" id="pd-full-link" href="#" style="display:none;">Full details</a>
      <button class="pd-inquiry-btn" id="pd-inquiry-btn">Inquiry</button>
      <button class="pd-quote-btn" id="pd-quote-btn">Get a quote</button>
    </div>
    <textarea id="qm-msg"></textarea>
  </body></html>`;
}

// makeDom(): opts.withCurrencyBridge (default true) ตั้ง window.CSSignCurrency ด้วยฟังก์ชันจริง
// จาก js/currency.js ก่อนรันสคริปต์ (จำลองว่า js/currency-global.js โหลดเสร็จก่อนแล้ว — ใน
// หน้าเว็บจริง module script จะรันหลัง classic script เสมอ แต่ในเทสนี้ต้อง "พร้อมก่อน" เพราะ
// เราจะยิง event เปลี่ยน currency ทันทีหลัง runScript ไม่ได้รอ async ใดๆ) opts.withStorage
// (default true) ตั้ง window.localStorage เป็น in-memory stub
function makeDom({ withCurrencyBridge = true, withStorage = true, storedCurrency = null } = {}) {
  const dom = new JSDOM(buildFixture(), {
    url: "https://example.test/products.html",
    runScripts: "dangerously",
    pretendToBeVisual: true,
  });
  dom.window.openModal = () => {};
  dom.window.HTMLElement.prototype.scrollIntoView = function () {};
  if (withStorage) {
    if (storedCurrency) dom.window.localStorage.setItem("cssignCurrency", storedCurrency);
  } else {
    // jsdom เดี๋ยวนี้ implement localStorage จริง (Storage object ปกติ, property เป็น
    // getter-only แก้ไม่ได้ตรงๆ) จำลอง "ไม่มี localStorage" (เช่น private mode ที่เข้าถึงแล้ว
    // throw SecurityError) ด้วยการ override getter ให้ throw แทน
    Object.defineProperty(dom.window, "localStorage", {
      get() { throw new Error("SecurityError: localStorage unavailable (private mode)"); },
      configurable: true,
    });
  }
  if (withCurrencyBridge) {
    dom.window.CSSignCurrency = {
      getSupportedCurrencies,
      isSupportedCurrency,
      convertFromTHB,
      formatCurrencyAmount,
      CURRENCY_SYMBOLS,
    };
  }
  runScript(dom, enSource);
  return dom;
}

function openTrafficProduct(dom) {
  const card = dom.window.document.querySelector(".product-card");
  card.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
}

function selectVariant(dom, sizeCode) {
  const chip = dom.window.document.querySelector(`.pd-chip[data-code="${sizeCode}"]`);
  chip.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
}

describe("js/products-detail-popup-en.js — currency switcher #pd-currency-select (P2.10-currency-b)", () => {
  test("โหลดสคริปต์แล้ว select เริ่มต้นเป็น THB เมื่อไม่มีค่าเก็บไว้ใน localStorage", () => {
    const dom = makeDom();
    assert.equal(dom.window.document.getElementById("pd-currency-select").value, "THB");
  });

  test("โหลดสคริปต์แล้ว select อ่านค่าที่เคยเลือกไว้จาก localStorage ('EUR') มาตั้งเป็นค่าเริ่มต้น", () => {
    const dom = makeDom({ storedCurrency: "EUR" });
    assert.equal(dom.window.document.getElementById("pd-currency-select").value, "EUR");
  });

  test("localStorage เก็บค่าไม่ใช่ currency ที่รองรับ (เช่นถูกแก้ด้วยมือ) → fallback เป็น THB แทนการพัง", () => {
    const dom = makeDom({ storedCurrency: "JPY" });
    assert.equal(dom.window.document.getElementById("pd-currency-select").value, "THB");
  });

  test("currency เริ่มต้น THB: เลือก variant ครบ → ราคาแสดงเป็น '฿100' เหมือนพฤติกรรมเดิมทุกประการ", () => {
    const dom = makeDom();
    openTrafficProduct(dom);
    selectVariant(dom, "s");
    assert.equal(dom.window.document.getElementById("pd-price").textContent, "฿100");
  });

  test("เปลี่ยน currency เป็น USD หลังเลือก variant ครบแล้ว → ราคา/รวมแปลงเป็น USD ทันที ไม่ต้องปิด/เปิดป็อปอัพใหม่ + เก็บ preference ลง localStorage", () => {
    const dom = makeDom();
    openTrafficProduct(dom);
    selectVariant(dom, "l"); // ราคา 200 THB/หน่วย
    assert.equal(dom.window.document.getElementById("pd-price").textContent, "฿200");

    const select = dom.window.document.getElementById("pd-currency-select");
    select.value = "USD";
    select.dispatchEvent(new dom.window.Event("change", { bubbles: true }));

    // convertFromTHB(200, 'USD') = Math.round(200/36) = 6
    assert.equal(dom.window.document.getElementById("pd-price").textContent, "$6");
    const totalText = dom.window.document.getElementById("pd-variant-total").textContent;
    assert.match(totalText, /\$6/); // ราคาต่อหน่วย
    assert.match(totalText, /\$6/); // ราคารวม (qty เริ่มต้น = 1 → เท่ากับต่อหน่วย)
    assert.equal(dom.window.localStorage.getItem("cssignCurrency"), "USD");
  });

  test("เปลี่ยน currency ตอนยังไม่ได้เปิดสินค้าใดเลย (ไม่มี pdCurrentUpdateFn) → ไม่ throw", () => {
    const dom = makeDom();
    const select = dom.window.document.getElementById("pd-currency-select");
    assert.doesNotThrow(() => {
      select.value = "CNY";
      select.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    });
    assert.equal(dom.window.localStorage.getItem("cssignCurrency"), "CNY");
  });

  test("window.CSSignCurrency ยังไม่พร้อม (เช่น module script ยังโหลดไม่เสร็จ) → เปลี่ยน currency แล้วไม่ throw และราคายังคง fallback เป็น THB ('฿' + en-US)", () => {
    const dom = makeDom({ withCurrencyBridge: false });
    openTrafficProduct(dom);
    selectVariant(dom, "s");
    assert.equal(dom.window.document.getElementById("pd-price").textContent, "฿100");

    const select = dom.window.document.getElementById("pd-currency-select");
    assert.doesNotThrow(() => {
      select.value = "USD";
      select.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    });
    // ไม่มี window.CSSignCurrency ให้แปลง — ยังคงแสดง THB ตามเดิม ไม่ throw ไม่ค้าง
    assert.equal(dom.window.document.getElementById("pd-price").textContent, "฿100");
  });

  test("localStorage ไม่พร้อมใช้งานเลย (เช่น private mode) → โหลด+เปลี่ยน currency ได้ปกติไม่ throw (แค่จำ preference ข้าม session ไม่ได้)", () => {
    const dom = makeDom({ withStorage: false });
    assert.equal(dom.window.document.getElementById("pd-currency-select").value, "THB");
    openTrafficProduct(dom);
    selectVariant(dom, "s");
    const select = dom.window.document.getElementById("pd-currency-select");
    assert.doesNotThrow(() => {
      select.value = "USD";
      select.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    });
    // convertFromTHB(100, 'USD') = 3
    assert.equal(dom.window.document.getElementById("pd-price").textContent, "$3");
  });

  test("ปิดป็อปอัพแล้วเปิดสินค้าใหม่ที่ไม่มี variant และไม่มีราคาเลย (priceRaw ไม่มี, fallback data.price ธรรมดา) → เปลี่ยน currency ไม่ throw และยังคงข้อความเดิม", () => {
    const dom = makeDom();
    // เปิดสินค้าที่ไม่มี optionAxes/variants เลย (ไม่มี chip ให้เลือก) และไม่มี priceRaw เลย
    dom.window.document.getElementById("product-grid").innerHTML = `
      <div class="product-card" data-cat="safety" data-product='${JSON.stringify({
        name: "Safety Sign", cat: "Safety", code: "S-1", price: "Request a quote",
        desc: "", material: "Aluminum", size: "15x15cm", tags: [], views: []
      }).replace(/'/g, "&#39;")}'>
        <button type="button" class="detail-btn">Detail</button>
      </div>`;
    openTrafficProduct(dom); // เปิดการ์ดใบเดียวที่เหลืออยู่ (safety sign ไม่มี variant, ไม่มี priceRaw)
    assert.equal(dom.window.document.getElementById("pd-price").textContent, "Request a quote");

    const select = dom.window.document.getElementById("pd-currency-select");
    assert.doesNotThrow(() => {
      select.value = "EUR";
      select.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    });
    // ไม่มี priceRaw ให้แปลง (สินค้าไม่มีราคาตายตัว) ราคาจึงยังคงเป็นข้อความเดิม (data.price ตรงๆ) ตามคาด
    assert.equal(dom.window.document.getElementById("pd-price").textContent, "Request a quote");
  });

  // P2.10-currency-d: สินค้าไม่มี variant แต่ "มี" ราคาเดี่ยวจริง (priceRaw ตัวเลข > 0) — เดิม
  // pd-price ใช้ data.price (string ที่ format ไว้ล่วงหน้าเป็นภาษาไทยจาก js/products-cards.js)
  // ตรงๆ ไม่ผ่าน pdFormatPrice() เลย เปลี่ยน currency แล้วราคาไม่ขยับ — รอบนี้แก้ให้ใช้
  // pdFormatPrice(priceRaw) แทนเมื่อมี priceRaw เป็นตัวเลขบวกจริง
  test("สินค้าไม่มี variant แต่มี priceRaw (ราคาเดี่ยว) → currency เริ่มต้น THB แสดง '฿1,500' (ผ่าน pdFormatPrice ไม่ใช่ data.price ตรงๆ)", () => {
    const dom = makeDom();
    dom.window.document.getElementById("product-grid").innerHTML = `
      <div class="product-card" data-cat="safety" data-product='${JSON.stringify({
        name: "Safety Sign", cat: "Safety", code: "S-1",
        price: "เริ่มต้น ฿1,500", priceRaw: 1500,
        desc: "", material: "Aluminum", size: "15x15cm", tags: [], views: []
      }).replace(/'/g, "&#39;")}'>
        <button type="button" class="detail-btn">Detail</button>
      </div>`;
    openTrafficProduct(dom);
    assert.equal(dom.window.document.getElementById("pd-price").textContent, "฿1,500");
  });

  test("สินค้าไม่มี variant แต่มี priceRaw → เปลี่ยน currency เป็น USD หลังเปิดป็อปอัพแล้ว ราคาแปลง+re-render สดทันที (pdCurrentUpdateFn ถูกตั้งสำหรับสาขานี้ด้วย)", () => {
    const dom = makeDom();
    dom.window.document.getElementById("product-grid").innerHTML = `
      <div class="product-card" data-cat="safety" data-product='${JSON.stringify({
        name: "Safety Sign", cat: "Safety", code: "S-1",
        price: "เริ่มต้น ฿1,500", priceRaw: 1500,
        desc: "", material: "Aluminum", size: "15x15cm", tags: [], views: []
      }).replace(/'/g, "&#39;")}'>
        <button type="button" class="detail-btn">Detail</button>
      </div>`;
    openTrafficProduct(dom);
    assert.equal(dom.window.document.getElementById("pd-price").textContent, "฿1,500");

    const select = dom.window.document.getElementById("pd-currency-select");
    select.value = "USD";
    select.dispatchEvent(new dom.window.Event("change", { bubbles: true }));

    // convertFromTHB(1500, 'USD') = Math.round(1500/36) = 42
    assert.equal(dom.window.document.getElementById("pd-price").textContent, "$42");
    assert.equal(dom.window.localStorage.getItem("cssignCurrency"), "USD");
  });

  test("สินค้าไม่มี variant, priceRaw เป็น 0 (ยังไม่ตั้งราคา) → ถือว่าไม่มีราคาจริง fallback เป็น data.price เดิม ไม่พัง", () => {
    const dom = makeDom();
    dom.window.document.getElementById("product-grid").innerHTML = `
      <div class="product-card" data-cat="safety" data-product='${JSON.stringify({
        name: "Safety Sign", cat: "Safety", code: "S-1",
        price: "สอบถามราคา", priceRaw: 0,
        desc: "", material: "Aluminum", size: "15x15cm", tags: [], views: []
      }).replace(/'/g, "&#39;")}'>
        <button type="button" class="detail-btn">Detail</button>
      </div>`;
    openTrafficProduct(dom);
    assert.equal(dom.window.document.getElementById("pd-price").textContent, "สอบถามราคา");

    const select = dom.window.document.getElementById("pd-currency-select");
    assert.doesNotThrow(() => {
      select.value = "USD";
      select.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    });
    assert.equal(dom.window.document.getElementById("pd-price").textContent, "สอบถามราคา");
  });

  test("buildPdQuoteMessage() (ข้อความ pre-fill ตอนกดขอใบเสนอราคา) สะท้อน currency ที่เลือกอยู่ ไม่ใช่ THB ตายตัว", async () => {
    const dom = makeDom();
    openTrafficProduct(dom);
    selectVariant(dom, "s"); // 100 THB
    const select = dom.window.document.getElementById("pd-currency-select");
    select.value = "USD";
    select.dispatchEvent(new dom.window.Event("change", { bubbles: true }));

    dom.window.document.getElementById("pd-quote-btn").dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    await sleep(250); // ปุ่มนี้ปิดป็อปอัพก่อนแล้วเปิด qmodal + เติม qm-msg หลัง setTimeout(200) — แพทเทิร์นเดียวกับ test/products-detail-popup.test.mjs

    const msg = dom.window.document.getElementById("qm-msg").value;
    assert.match(msg, /\$3/); // convertFromTHB(100, 'USD') = 3 → ไม่ใช่ "฿100" แบบเดิม
  });
});
