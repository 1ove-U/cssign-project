// test/products-cards.test.mjs
//
// Unit test สำหรับ js/products-cards.js — รอบที่ 138 (ต่อจากรอบ 137 ที่เทส
// js/product-schema.js เสร็จแล้ว — ไฟล์ถัดไปตามคำแนะนำท้ายรอบนั้น)
//
// ไฟล์นี้เป็น ES module pure function ล้วนๆ (escapeHtml/cardHTML/skeletonCardHTML — export
// ทั้ง 3, formatPrice/imgUrl/artHTML เป็น module-private) ไม่มี import จากไฟล์อื่นเลยสักไฟล์
// เดียว (ไม่มี Firestore/DOM ใดๆ ในไฟล์นี้) จึง import ตรงๆ ได้เลยไม่ต้องพึ่ง
// test/helpers/register-loader.mjs (ไม่มี URL ของ Firebase SDK ให้ stub) — ต่างจากไฟล์ที่ผ่านๆ
// มาในกลุ่มนี้ที่ต้อง inject เป็น <script> เข้า JSDOM เพราะเป็น classic script ที่แปะ window
//
// รับพารามิเตอร์คืนค่า HTML string ล้วนๆ — ทดสอบส่วนใหญ่จึงตรวจ string ที่คืนมาตรงๆ (regex/
// includes) ยกเว้นการตรวจ `data-product` attribute ที่ใช้ JSDOM แปะเข้า DOM จริงแล้วอ่านผ่าน
// `.dataset.product`/`JSON.parse()` เพื่อยืนยัน round-trip ผ่าน browser parser จริง (โดยเฉพาะจุด
// escape เครื่องหมาย ' ด้วย `.replace(/'/g, "&#39;")` เพราะ attribute ห่อด้วย single-quote —
// ไม่ใช่แค่ escapeHtml() ปกติที่ห่อด้วย double-quote) — แพทเทิร์นเดียวกับที่
// test/portfolio-render.test.mjs ยืนยัน `data-images` round-trip ไว้ก่อนหน้านี้
//
// ไม่ได้แก้ไฟล์ .js/.html/.css ที่เป็นโค้ดจริงเลยแม้แต่บรรทัดเดียวในไฟล์นี้ — งานทดสอบล้วนๆ

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { escapeHtml, cardHTML, skeletonCardHTML } from "../js/products-cards.js";

/* อ่านค่า data-product attribute ผ่าน DOM จริง (ไม่ใช่ regex บนสตริง) แล้ว JSON.parse
   เพื่อยืนยัน round-trip ผ่าน browser attribute parser จริง */
function parseDataProduct(html) {
  const dom = new JSDOM(`<!doctype html><body><div id="wrap"></div></body>`);
  const wrap = dom.window.document.getElementById("wrap");
  wrap.innerHTML = html;
  const card = wrap.querySelector(".product-card");
  return { card, data: JSON.parse(card.dataset.product) };
}

describe("products-cards.js (รอบที่ 138)", () => {
  describe("escapeHtml()", () => {
    test("null/undefined → สตริงว่างเปล่า", () => {
      assert.equal(escapeHtml(null), "");
      assert.equal(escapeHtml(undefined), "");
    });

    test("escape ครบทั้ง 5 ตัวอักษร & < > \" '", () => {
      assert.equal(escapeHtml(`& < > " '`), "&amp; &lt; &gt; &quot; &#39;");
    });

    test("ตัวเลข/สตริงธรรมดาที่ไม่มีอักขระพิเศษ → คืนค่าเดิม (แปลงเป็นสตริง)", () => {
      assert.equal(escapeHtml(1250), "1250");
      assert.equal(escapeHtml("ป้ายไฟ LED"), "ป้ายไฟ LED");
    });

    test("payload พยายามฉีด XSS ทั่วไป (<script>) → ถูก escape หมด ไม่เหลือ tag จริง", () => {
      const out = escapeHtml(`<script>alert(1)</script>`);
      assert.equal(out, "&lt;script&gt;alert(1)&lt;/script&gt;");
    });
  });

  describe("cardHTML() — ค่า default เมื่อไม่ส่งฟิลด์มา", () => {
    test("product ว่างเปล่า {}: ชื่อ fallback 'สินค้า' ทั้งใน h3 และ data-product.name, ไม่มี badge (ไม่มี code)", () => {
      const html = cardHTML({}, undefined, 0);
      assert.match(html, /<h3>สินค้า<\/h3>/);
      assert.doesNotMatch(html, /product-badge/);
      const { data } = parseDataProduct(html);
      assert.equal(data.name, "สินค้า");
      assert.equal(data.code, "");
      assert.equal(data.slug, "");
      assert.equal(data.badge, "");
      assert.equal(data.material, "-");
      assert.equal(data.size, "-");
      assert.deepEqual(data.tags, []);
      assert.deepEqual(data.images, []);
      assert.deepEqual(data.optionAxes, []);
      assert.deepEqual(data.variants, []);
      assert.equal(data.cat_id, "");
    });

    test("ไม่ส่ง catName เลย → data-product.cat fallback เป็น 'สินค้า'", () => {
      const { data } = parseDataProduct(cardHTML({ name: "A" }, undefined, 0));
      assert.equal(data.cat, "สินค้า");
    });

    test("ส่ง catName มา → ใช้ catName ตรงๆ", () => {
      const { data } = parseDataProduct(cardHTML({ name: "A" }, "ป้ายไฟ", 0));
      assert.equal(data.cat, "ป้ายไฟ");
    });

    test("ไม่มี cat_id/group_id → data-cat/data-group เป็น 'all' ทั้งคู่", () => {
      const html = cardHTML({ name: "A" }, "cat", 0);
      assert.match(html, /data-cat="all"/);
      assert.match(html, /data-group="all"/);
    });
  });

  describe("cardHTML() — ฟิลด์ครบ + escaping", () => {
    test("ค่าทุกฟิลด์ตรงตามที่ส่งเข้า data-product JSON", () => {
      const product = {
        name: "ป้ายไฟ LED",
        code: "SKU-001",
        slug: "led-sign",
        description: "คำอธิบายสินค้า",
        metaTitle: "ชื่อ SEO",
        metaDescription: "คำอธิบาย SEO",
        material: "อะคริลิก",
        size: "100x50 ซม.",
        tags: ["ป้าย", "ไฟ LED"],
        images: ["https://example.test/a.jpg"],
        cat_id: "cat-led",
        group_id: "group-1",
        optionAxes: [{ name: "สี" }],
        variants: [{ sku: "V1" }],
        price: 1500,
        unit: "ชิ้น",
      };
      const html = cardHTML(product, "ป้ายไฟ", 2);
      const { data } = parseDataProduct(html);
      assert.equal(data.name, "ป้ายไฟ LED");
      assert.equal(data.cat, "ป้ายไฟ");
      assert.equal(data.code, "SKU-001");
      assert.equal(data.slug, "led-sign");
      assert.equal(data.desc, "คำอธิบายสินค้า");
      assert.equal(data.metaTitle, "ชื่อ SEO");
      assert.equal(data.metaDescription, "คำอธิบาย SEO");
      assert.equal(data.material, "อะคริลิก");
      assert.equal(data.size, "100x50 ซม.");
      assert.deepEqual(data.tags, ["ป้าย", "ไฟ LED"]);
      assert.deepEqual(data.images, ["https://example.test/a.jpg"]);
      assert.equal(data.cat_id, "cat-led");
      assert.deepEqual(data.optionAxes, [{ name: "สี" }]);
      assert.deepEqual(data.variants, [{ sku: "V1" }]);
      assert.equal(data.badge, "SKU-001");
      assert.deepEqual(data.views, ["หน้า", "หลัง", "ด้านข้าง"]);
      assert.equal(data.priceRaw, 1500);
      assert.match(data.price, /1,500/);
      assert.match(data.price, /ชิ้น/);
    });

    test("มี code → มี <div class=\"product-badge\"> พร้อมข้อความ escape แล้ว", () => {
      const html = cardHTML({ name: "A", code: `<b>SKU</b>` }, "cat", 0);
      assert.match(html, /<div class="product-badge">&lt;b&gt;SKU&lt;\/b&gt;<\/div>/);
    });

    test("name มี XSS payload → escape ใน h3 และ alt ของ <img> (เมื่อมีรูป)", () => {
      const product = { name: `"><img src=x onerror=alert(1)>`, images: ["https://example.test/a.jpg"] };
      const html = cardHTML(product, "cat", 0);
      assert.doesNotMatch(html, /<h3>"><img/);
      assert.match(html, /alt="&quot;&gt;&lt;img src=x onerror=alert\(1\)&gt;"/);
    });

    test("data-cat/data-group escape อักขระพิเศษใน cat_id/group_id", () => {
      const html = cardHTML({ name: "A", cat_id: `x" onmouseover="y`, group_id: `<z>` }, "cat", 0);
      assert.match(html, /data-cat="x&quot; onmouseover=&quot;y"/);
      assert.match(html, /data-group="&lt;z&gt;"/);
    });

    test("data-product JSON ที่มีเครื่องหมาย ' (single quote) ใน field → escape เป็น &#39; ไม่ทำให้ attribute แตกก่อนจบ (round-trip ผ่าน DOM จริงได้ถูกต้อง)", () => {
      const product = { name: `สินค้า 'พิเศษ' ทดสอบ`, description: `it's a test` };
      const html = cardHTML(product, "cat", 0);
      // ต้องไม่มี ' ดิบหลุดออกมาในตัว JSON string ที่ห่อด้วย ' (จะทำให้ attribute ปิดก่อนจบ)
      const rawJsonMatch = html.match(/data-product='([^]*?)' >/);
      assert.ok(rawJsonMatch, "ต้อง match data-product attribute ได้");
      assert.doesNotMatch(rawJsonMatch[1], /(?<!&#39);/); // ไม่มี ' ดิบเดี่ยวๆ หลุดออกมา (แค่ sanity เสริม)
      assert.doesNotMatch(rawJsonMatch[1], /[^#]'/);
      const { data } = parseDataProduct(html);
      assert.equal(data.name, `สินค้า 'พิเศษ' ทดสอบ`);
      assert.equal(data.desc, `it's a test`);
    });

    test("href: มี slug → 'product-detail.html?slug=' + encodeURIComponent(slug), ไม่มี slug → '#'", () => {
      const withSlug = cardHTML({ name: "A", slug: "ป้าย พิเศษ" }, "cat", 0);
      assert.match(withSlug, /href="product-detail\.html\?slug=%E0%B8%9B%E0%B9%89%E0%B8%B2%E0%B8%A2%20%E0%B8%9E%E0%B8%B4%E0%B9%80%E0%B8%A8%E0%B8%A9"/);
      const noSlug = cardHTML({ name: "A" }, "cat", 0);
      assert.match(noSlug, /href="#"/);
    });
  });

  describe("cardHTML() — ราคา (formatPrice, ผ่าน data-product.price/priceRaw ล้วนๆ เพราะไม่แสดงบนการ์ดตรงๆ)", () => {
    test("ไม่มี price เลย → priceRaw เป็น null, price text เป็น 'สอบถามราคา'", () => {
      const { data } = parseDataProduct(cardHTML({ name: "A" }, "cat", 0));
      assert.equal(data.priceRaw, null);
      assert.equal(data.price, "สอบถามราคา");
    });

    test("price เป็น 0 → priceRaw ยังคงเป็น 0 (ไม่ใช่ null เพราะเช็คแค่ != null) แต่ price text เป็น 'สอบถามราคา' (0 เป็น falsy ใน formatPrice)", () => {
      const { data } = parseDataProduct(cardHTML({ name: "A", price: 0 }, "cat", 0));
      assert.equal(data.priceRaw, 0);
      assert.equal(data.price, "สอบถามราคา");
    });

    test("price ติดลบ → price text เป็น 'สอบถามราคา' เช่นกัน (ต้อง num > 0 เท่านั้น) แต่ priceRaw ยังเป็นค่าติดลบดิบ", () => {
      const { data } = parseDataProduct(cardHTML({ name: "A", price: -500 }, "cat", 0));
      assert.equal(data.priceRaw, -500);
      assert.equal(data.price, "สอบถามราคา");
    });

    test("price เป็นสตริงไม่ใช่ตัวเลข → price text เป็น 'สอบถามราคา'", () => {
      const { data } = parseDataProduct(cardHTML({ name: "A", price: "ขอใบเสนอราคา" }, "cat", 0));
      assert.equal(data.price, "สอบถามราคา");
    });

    test("price เป็นตัวเลขบวกจริง + มี unit → format 'เริ่มต้น ฿x,xxx / unit' ด้วย toLocaleString('th-TH')", () => {
      const { data } = parseDataProduct(cardHTML({ name: "A", price: 125000, unit: "ตร.ม." }, "cat", 0));
      assert.equal(data.price, "เริ่มต้น ฿125,000 / ตร.ม.");
    });

    test("price บวกจริงแต่ไม่มี unit → ไม่มี ' / ' ต่อท้าย", () => {
      const { data } = parseDataProduct(cardHTML({ name: "A", price: 500 }, "cat", 0));
      assert.equal(data.price, "เริ่มต้น ฿500");
    });
  });

  describe("cardHTML() — รูปภาพ/ไอคอน fallback (artHTML/imgUrl แบบ private ผ่านผลลัพธ์ HTML)", () => {
    test("ไม่มีรูปเลย → ไม่มี <img> แสดงไอคอน fallback แทน (svg + pa-grid)", () => {
      const html = cardHTML({ name: "A" }, "cat", 0);
      assert.doesNotMatch(html, /<img/);
      assert.match(html, /pa-grid/);
      assert.match(html, /<svg/);
    });

    test("images เป็น array ว่าง → ยังนับว่าไม่มีรูป (เหมือนไม่มี images เลย)", () => {
      const html = cardHTML({ name: "A", images: [] }, "cat", 0);
      assert.doesNotMatch(html, /<img/);
    });

    test("images เป็น array ของ string ล้วนๆ → ใช้ตัวแรกเป็น src ตรงๆ", () => {
      const html = cardHTML({ name: "A", images: ["https://example.test/x.jpg", "https://example.test/y.jpg"] }, "cat", 0);
      assert.match(html, /<img src="https:\/\/example\.test\/x\.jpg"/);
    });

    test("images เป็น array ของ object { url } → ดึง .url ของตัวแรก", () => {
      const html = cardHTML({ name: "A", images: [{ url: "https://example.test/obj.jpg" }] }, "cat", 0);
      assert.match(html, /<img src="https:\/\/example\.test\/obj\.jpg"/);
    });

    test("object แรกในลิสต์ไม่มี .url (falsy) → imgUrl() คืนสตริงว่าง ซึ่งเป็น falsy ต่อ artHTML() จึงตกไปใช้ไอคอน fallback แทน (ไม่ใช่ <img src=\"\">) ไม่ throw", () => {
      const html = cardHTML({ name: "A", images: [{}] }, "cat", 0);
      assert.doesNotMatch(html, /<img/);
      assert.match(html, /pa-grid/);
    });

    test("<img> มี loading=\"lazy\" decoding=\"async\" เสมอ", () => {
      const html = cardHTML({ name: "A", images: ["https://example.test/x.jpg"] }, "cat", 0);
      assert.match(html, /loading="lazy" decoding="async"/);
    });

    test("ไอคอน fallback หมุนตาม idx % 4 (fallbackIcons มี 4 แบบ) — idx=0 และ idx=4 ใช้ path เดียวกัน", () => {
      const html0 = cardHTML({ name: "A" }, "cat", 0);
      const html4 = cardHTML({ name: "A" }, "cat", 4);
      const path0 = html0.match(/<svg[^]*?<\/svg>/)[0];
      const path4 = html4.match(/<svg[^]*?<\/svg>/)[0];
      assert.equal(path0, path4);
      const html1 = cardHTML({ name: "A" }, "cat", 1);
      const path1 = html1.match(/<svg[^]*?<\/svg>/)[0];
      assert.notEqual(path0, path1);
    });

    test("ข้อสังเกต (ไม่ใช่บั๊กใหม่ — บันทึกไว้เหมือนที่รอบ 136 พบใน portfolio-render.js): URL รูปใส่ลง src=\"...\" โดยตรงไม่ผ่าน escapeHtml() — เขียนเทสยืนยันพฤติกรรมจริงปัจจุบันกัน regression ทั้งสองทิศทาง ไม่แก้โค้ดผลิตภัณฑ์", () => {
      const html = cardHTML({ name: "A", images: [`https://example.test/x.jpg"onerror="alert(1)`] }, "cat", 0);
      assert.match(html, /src="https:\/\/example\.test\/x\.jpg"onerror="alert\(1\)"/);
    });
  });

  describe("skeletonCardHTML()", () => {
    test("คืนโครงสร้าง skeleton ครบตามที่คาด (class ถูกต้อง + aria-hidden)", () => {
      const html = skeletonCardHTML();
      assert.match(html, /class="product-card product-skel-card" aria-hidden="true"/);
      assert.match(html, /product-skel-art/);
      assert.match(html, /product-skel-line w80/);
      assert.match(html, /product-skel-line w45/);
      assert.match(html, /product-skel-pill/);
    });

    test("ไม่รับพารามิเตอร์ใดๆ เลย เรียกซ้ำได้ผลลัพธ์เดิมทุกครั้ง (pure)", () => {
      assert.equal(skeletonCardHTML(), skeletonCardHTML());
    });
  });
});
