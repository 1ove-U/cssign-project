// test/products-detail-popup-currency.test.mjs — P2.10 currency switcher, TH popup
//
// ขอบเขต: currency switcher (#pd-currency-select) ที่เพิ่มเข้า js/products-detail-popup.js
// (TH) ในรอบนี้ — มิเรอร์ตรงจาก test/products-detail-popup-en-currency.test.mjs (EN, ทำไปแล้ว
// รอบที่ 28/30) เกือบทุกจุด ต่างกันแค่ locale/สัญลักษณ์ราคาเริ่มต้น (th-TH แทน en-US) และ
// ข้อความ fallback ภาษาไทย ("สอบถามราคา"/"ขอใบเสนอราคา") — fixture เดิมใน
// test/products-detail-popup.test.mjs ไม่มี #pd-currency-select เลย ยืนยันแล้วว่าพฤติกรรม
// เดิมไม่เปลี่ยนเมื่อไม่มี select (ดูเทสในไฟล์นั้น)
//
// วิธีทดสอบ: โหลด js/products-detail-popup.js เป็น classic <script> จริงเข้า JSDOM window
// (runScripts: "dangerously") — window.CSSignCurrency ถูก stub ด้วยฟังก์ชันจริงจาก
// js/currency.js ตรงๆ (import มาจริง ไม่ mock ค่า) เพื่อเทส end-to-end ของ pdFormatPrice()
// โดยไม่ต้องพึ่งพา js/currency-global.js (มีเทสของตัวเองแยกใน test/currency-global.test.mjs)

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

const thSource = readFileSync(new URL("../js/products-detail-popup.js", import.meta.url), "utf-8");

function runScript(dom, source) {
  const scriptEl = dom.window.document.createElement("script");
  scriptEl.textContent = source;
  dom.window.document.body.appendChild(scriptEl);
}

// fixture เดียวกับ trafficProduct ใน test/products-detail-popup.test.mjs (s=100 THB, l=200 THB)
const trafficProduct = {
  name: "ป้ายจราจร",
  cat: "ป้ายจราจร",
  code: "CSS-TRAF-002",
  price: "ขอใบเสนอราคา",
  desc: "",
  optionAxes: [{ label: "ขนาด", options: [{ code: "s", label: "เล็ก" }, { code: "l", label: "ใหญ่" }] }],
  variants: [
    { codes: ["s"], price: 100 },
    { codes: ["l"], price: 200 }
  ],
  images: [{ url: "/img/traffic-1.jpg", label: "หน้า" }],
  tags: [],
  slug: "traffic-sign"
};

function buildFixture() {
  return `<!doctype html><html><body>
    <div class="product-tabs" id="product-tabs-dynamic">
      <button class="product-tab active" data-filter="all">ทั้งหมด</button>
    </div>
    <span id="pr-count"></span>
    <div class="product-grid" id="product-grid">
      <div class="product-card" data-cat="traffic" data-product='${JSON.stringify(trafficProduct).replace(/'/g, "&#39;")}'>
        <button type="button" class="detail-btn">รายละเอียด</button>
      </div>
    </div>
    <div class="pr-empty" id="pr-empty"></div>

    <div class="pd-overlay" id="pd-overlay" role="dialog" aria-modal="true">
      <div class="pd-main-img" id="pd-main-img">
        <svg id="pd-main-svg"></svg>
        <img id="pd-main-img-tag" src="" alt="" style="display:none;">
        <div class="pd-zoom-hint" id="pd-zoom-hint">คลิกเพื่อซูม</div>
      </div>
      <div class="pd-thumbs" id="pd-thumbs"></div>
      <button class="pd-close" id="pd-close">ปิด</button>
      <div class="pd-cat-label" id="pd-cat"></div>
      <h2 class="pd-name" id="pd-name"></h2>
      <div class="pd-code" id="pd-code"></div>
      <span class="pd-price" id="pd-price"></span>
      <select id="pd-currency-select" aria-label="สกุลเงิน">
        <option value="THB">THB ฿</option>
        <option value="USD">USD $</option>
        <option value="EUR">EUR €</option>
        <option value="CNY">CNY ¥</option>
      </select>
      <div class="pd-variant-block" id="pd-variant-block"></div>
      <div class="pd-section-label" id="pd-details-label">รายละเอียดสินค้า</div>
      <p class="pd-desc" id="pd-desc"></p>
      <div class="pd-specs" id="pd-specs"></div>
      <div class="pd-section-label" id="pd-tags-label">ป้ายกำกับ</div>
      <div class="pd-tags" id="pd-tags"></div>
      <a class="pd-full-link" id="pd-full-link" href="#" style="display:none;">รายละเอียดเต็ม</a>
      <button class="pd-inquiry-btn" id="pd-inquiry-btn">สอบถาม</button>
      <button class="pd-quote-btn" id="pd-quote-btn">ขอใบเสนอราคา</button>
    </div>
    <textarea id="qm-msg"></textarea>
  </body></html>`;
}

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
  runScript(dom, thSource);
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

describe("js/products-detail-popup.js (TH) — currency switcher #pd-currency-select", () => {
  test("โหลดสคริปต์แล้ว select เริ่มต้นเป็น THB เมื่อไม่มีค่าเก็บไว้ใน localStorage", () => {
    const dom = makeDom();
    assert.equal(dom.window.document.getElementById("pd-currency-select").value, "THB");
  });

  test("โหลดสคริปต์แล้ว select อ่านค่าที่เคยเลือกไว้จาก localStorage ('EUR') มาตั้งเป็นค่าเริ่มต้น (sync ข้ามหน้ากับ EN popup เพราะใช้ key เดียวกัน)", () => {
    const dom = makeDom({ storedCurrency: "EUR" });
    assert.equal(dom.window.document.getElementById("pd-currency-select").value, "EUR");
  });

  test("localStorage เก็บค่าไม่ใช่ currency ที่รองรับ → fallback เป็น THB แทนการพัง", () => {
    const dom = makeDom({ storedCurrency: "JPY" });
    assert.equal(dom.window.document.getElementById("pd-currency-select").value, "THB");
  });

  test("currency เริ่มต้น THB: เลือก variant ครบ → ราคาแสดงเป็น '฿100' เหมือนพฤติกรรมเดิมทุกประการ (toLocaleString('th-TH'))", () => {
    const dom = makeDom();
    openTrafficProduct(dom);
    selectVariant(dom, "s");
    assert.equal(dom.window.document.getElementById("pd-price").textContent, "฿100");
  });

  test("เปลี่ยน currency เป็น USD หลังเลือก variant ครบแล้ว → ราคา/รวมแปลงเป็น USD ทันที ไม่ต้องปิด/เปิดป็อปอัพใหม่ + เก็บ preference ลง localStorage", () => {
    const dom = makeDom();
    openTrafficProduct(dom);
    selectVariant(dom, "l"); // 200 THB/หน่วย
    assert.equal(dom.window.document.getElementById("pd-price").textContent, "฿200");

    const select = dom.window.document.getElementById("pd-currency-select");
    select.value = "USD";
    select.dispatchEvent(new dom.window.Event("change", { bubbles: true }));

    // convertFromTHB(200, 'USD') = Math.round(200/36) = 6
    assert.equal(dom.window.document.getElementById("pd-price").textContent, "$6");
    const totalText = dom.window.document.getElementById("pd-variant-total").textContent;
    assert.match(totalText, /\$6/);
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

  test("window.CSSignCurrency ยังไม่พร้อม (เช่น module script ยังโหลดไม่เสร็จ) → เปลี่ยน currency แล้วไม่ throw และราคายังคง fallback เป็น THB ('฿' + th-TH)", () => {
    const dom = makeDom({ withCurrencyBridge: false });
    openTrafficProduct(dom);
    selectVariant(dom, "s");
    assert.equal(dom.window.document.getElementById("pd-price").textContent, "฿100");

    const select = dom.window.document.getElementById("pd-currency-select");
    assert.doesNotThrow(() => {
      select.value = "USD";
      select.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    });
    assert.equal(dom.window.document.getElementById("pd-price").textContent, "฿100");
  });

  test("localStorage ไม่พร้อมใช้งานเลย (เช่น private mode) → โหลด+เปลี่ยน currency ได้ปกติไม่ throw", () => {
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

  test("สินค้าไม่มี variant แต่มี priceRaw (ราคาเดี่ยว) → currency เริ่มต้น THB แสดง '฿1,500' (ผ่าน pdFormatPrice ไม่ใช่ data.price ตรงๆ)", () => {
    const dom = makeDom();
    dom.window.document.getElementById("product-grid").innerHTML = `
      <div class="product-card" data-cat="safety" data-product='${JSON.stringify({
        name: "ป้ายเซฟตี้", cat: "ป้ายเซฟตี้", code: "S-1",
        price: "เริ่มต้น ฿1,500", priceRaw: 1500,
        desc: "", material: "อลูมิเนียม", size: "15x15cm", tags: [], views: []
      }).replace(/'/g, "&#39;")}'>
        <button type="button" class="detail-btn">รายละเอียด</button>
      </div>`;
    openTrafficProduct(dom);
    assert.equal(dom.window.document.getElementById("pd-price").textContent, "฿1,500");
  });

  test("สินค้าไม่มี variant แต่มี priceRaw → เปลี่ยน currency เป็น USD หลังเปิดป็อปอัพแล้ว ราคาแปลง+re-render สดทันที", () => {
    const dom = makeDom();
    dom.window.document.getElementById("product-grid").innerHTML = `
      <div class="product-card" data-cat="safety" data-product='${JSON.stringify({
        name: "ป้ายเซฟตี้", cat: "ป้ายเซฟตี้", code: "S-1",
        price: "เริ่มต้น ฿1,500", priceRaw: 1500,
        desc: "", material: "อลูมิเนียม", size: "15x15cm", tags: [], views: []
      }).replace(/'/g, "&#39;")}'>
        <button type="button" class="detail-btn">รายละเอียด</button>
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
        name: "ป้ายเซฟตี้", cat: "ป้ายเซฟตี้", code: "S-1",
        price: "สอบถามราคา", priceRaw: 0,
        desc: "", material: "อลูมิเนียม", size: "15x15cm", tags: [], views: []
      }).replace(/'/g, "&#39;")}'>
        <button type="button" class="detail-btn">รายละเอียด</button>
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
    await sleep(250);

    const msg = dom.window.document.getElementById("qm-msg").value;
    assert.match(msg, /\$3/); // convertFromTHB(100, 'USD') = 3 → ไม่ใช่ "฿100" แบบเดิม
  });
});
