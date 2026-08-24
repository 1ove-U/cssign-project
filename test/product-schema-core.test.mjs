// test/product-schema-core.test.mjs
//
// jsdom test สำหรับ js/product-schema-core.js — รอบที่ 135 (audit หา "ไฟล์ยังไม่มีเทส" ที่
// ตกหล่นจากงานเสริม "เทสไฟล์ JS ที่ไม่เคยมีเทสคลุม" ที่เจ้าของเว็บสั่งปิดไปตั้งแต่รอบ 103 —
// ไฟล์นี้อยู่ในกลุ่ม "portfolio/products แสดงผลสาธารณะ 8 ไฟล์" ที่รอบ 103 บันทึกไว้ว่ายังไม่ได้แตะ
// เลย ไม่ใช่กลุ่ม UI เล็ก/เอฟเฟกต์ที่เจ้าของเว็บอนุมัติให้ข้ามได้ — เป็น business logic จริง (สร้าง
// schema.org Product JSON-LD ที่ทั้ง products.html และ product-detail.html ใช้ร่วมกัน ตามที่คอมเมนต์
// หัวไฟล์อธิบายไว้ว่าเคย drift กันมาก่อนเพราะแยกโค้ดคนละชุด) จึงมีคุณค่าคุ้มทำมากกว่าไฟล์ตกแต่งล้วนๆ
//
// classic script (ไม่ใช่ ES module — ตั้งใจ ดูคอมเมนต์หัวไฟล์จริง) ที่แปะทุกอย่างไว้ใต้
// window.CSSIGN_PRODUCT_SCHEMA — แพทเทิร์นโหลดเหมือน admin-tap-tooltip.test.mjs/
// img-error-fallback.test.mjs: inject เป็น <script> จริงเข้า JSDOM (runScripts:"dangerously")
// แล้วเรียกฟังก์ชันผ่าน dom.window.CSSIGN_PRODUCT_SCHEMA ตรงๆ ไม่ต้อง stub อะไรเลย เพราะไฟล์นี้
// ไม่ import จาก db.js/Firestore เลย (pure function ล้วนๆ ยกเว้น injectJsonLd ที่แตะ document)
//
// ไม่ได้แก้ไฟล์ .js/.html/.css ที่เป็นโค้ดจริงเลยแม้แต่บรรทัดเดียวในไฟล์นี้ — งานทดสอบล้วนๆ

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const SOURCE = readFileSync(new URL("../js/product-schema-core.js", import.meta.url), "utf-8");

function loadDom() {
  const dom = new JSDOM(`<!doctype html><html><head></head><body></body></html>`, {
    url: "https://example.test/product-detail.html",
    runScripts: "dangerously",
  });
  const script = dom.window.document.createElement("script");
  script.textContent = SOURCE;
  dom.window.document.head.appendChild(script);
  return dom;
}

const SITE_URL = "https://cssign.co.th/";

describe("product-schema-core.js (รอบที่ 135)", () => {
  test("shape: โหลดสคริปต์ได้โดยไม่ throw และ export ครบ 3 ฟังก์ชันใต้ window.CSSIGN_PRODUCT_SCHEMA", () => {
    const dom = loadDom();
    const api = dom.window.CSSIGN_PRODUCT_SCHEMA;
    assert.ok(api, "ต้องมี window.CSSIGN_PRODUCT_SCHEMA");
    assert.equal(typeof api.buildProductNode, "function");
    assert.equal(typeof api.extractPriceNumber, "function");
    assert.equal(typeof api.injectJsonLd, "function");
  });

  describe("buildProductNode()", () => {
    test("input ว่างเปล่า/undefined: ไม่ throw, ใช้ค่า default ครบ (ชื่อ/url), ไม่มี offers/image/additionalProperty/aggregateRating/@id", () => {
      const dom = loadDom();
      const { buildProductNode } = dom.window.CSSIGN_PRODUCT_SCHEMA;
      const node = buildProductNode();
      assert.equal(node["@type"], "Product");
      assert.equal(node.name, "สินค้า CS.SIGN");
      assert.equal(node.description, "");
      assert.equal(node.sku, "");
      assert.equal(node.category, "");
      assert.deepEqual(JSON.parse(JSON.stringify(node.brand)), { "@type": "Brand", name: "CS.SIGN" });
      assert.deepEqual(JSON.parse(JSON.stringify(node.manufacturer)), { "@type": "Organization", "@id": SITE_URL + "#localbusiness" });
      assert.equal(node.url, SITE_URL);
      assert.equal("@id" in node, false);
      assert.equal("image" in node, false);
      assert.equal("additionalProperty" in node, false);
      assert.equal("offers" in node, false);
      assert.equal("aggregateRating" in node, false);
    });

    test("input ครบทุกฟิลด์: ค่าทุกฟิลด์ตรงตามที่ส่งเข้าไป", () => {
      const dom = loadDom();
      const { buildProductNode } = dom.window.CSSIGN_PRODUCT_SCHEMA;
      const node = buildProductNode({
        name: "ป้ายไฟ LED",
        description: "ป้ายไฟ LED คุณภาพสูง",
        sku: "SKU-001",
        category: "ป้ายไฟ",
        material: "อะคริลิก",
        size: "100x50 ซม.",
        images: ["https://example.test/a.jpg"],
        url: "https://cssign.co.th/products/led-sign",
        price: 1250,
        id: "https://cssign.co.th/products/led-sign#product",
      });
      assert.equal(node.name, "ป้ายไฟ LED");
      assert.equal(node.description, "ป้ายไฟ LED คุณภาพสูง");
      assert.equal(node.sku, "SKU-001");
      assert.equal(node.category, "ป้ายไฟ");
      assert.equal(node.url, "https://cssign.co.th/products/led-sign");
      assert.equal(node["@id"], "https://cssign.co.th/products/led-sign#product");
      assert.equal(node.image, "https://example.test/a.jpg");
      assert.deepEqual(JSON.parse(JSON.stringify(node.additionalProperty)), [
        { "@type": "PropertyValue", name: "วัสดุ", value: "อะคริลิก" },
        { "@type": "PropertyValue", name: "ขนาด", value: "100x50 ซม." },
      ]);
      assert.deepEqual(JSON.parse(JSON.stringify(node.offers)), {
        "@type": "Offer",
        priceCurrency: "THB",
        price: "1250",
        availability: "https://schema.org/InStock",
        url: "https://cssign.co.th/products/led-sign",
      });
    });

    test("name เป็นค่าว่าง/falsy (แต่ไม่ใช่ undefined) → fallback เป็น 'สินค้า CS.SIGN' เหมือน undefined", () => {
      const dom = loadDom();
      const { buildProductNode } = dom.window.CSSIGN_PRODUCT_SCHEMA;
      assert.equal(buildProductNode({ name: "" }).name, "สินค้า CS.SIGN");
      assert.equal(buildProductNode({ name: null }).name, "สินค้า CS.SIGN");
    });

    test("material อย่างเดียว (ไม่มี size): additionalProperty มีแค่ 1 รายการ", () => {
      const dom = loadDom();
      const { buildProductNode } = dom.window.CSSIGN_PRODUCT_SCHEMA;
      const node = buildProductNode({ material: "สแตนเลส" });
      assert.deepEqual(JSON.parse(JSON.stringify(node.additionalProperty)), [
        { "@type": "PropertyValue", name: "วัสดุ", value: "สแตนเลส" },
      ]);
    });

    test("size อย่างเดียว (ไม่มี material): additionalProperty มีแค่ 1 รายการ", () => {
      const dom = loadDom();
      const { buildProductNode } = dom.window.CSSIGN_PRODUCT_SCHEMA;
      const node = buildProductNode({ size: "30x30 ซม." });
      assert.deepEqual(JSON.parse(JSON.stringify(node.additionalProperty)), [
        { "@type": "PropertyValue", name: "ขนาด", value: "30x30 ซม." },
      ]);
    });

    test("images: array ของ string ล้วนๆ (ไม่ใช่ object) → ใช้ตัวแรกตรงๆ เป็น image", () => {
      const dom = loadDom();
      const { buildProductNode } = dom.window.CSSIGN_PRODUCT_SCHEMA;
      const node = buildProductNode({ images: ["https://example.test/first.jpg", "https://example.test/second.jpg"] });
      assert.equal(node.image, "https://example.test/first.jpg");
    });

    test("images: array ของ object { url } → ดึง .url ของตัวแรก", () => {
      const dom = loadDom();
      const { buildProductNode } = dom.window.CSSIGN_PRODUCT_SCHEMA;
      const node = buildProductNode({
        images: [{ url: "https://example.test/obj.jpg" }, { url: "https://example.test/obj2.jpg" }],
      });
      assert.equal(node.image, "https://example.test/obj.jpg");
    });

    test("images: array ว่างเปล่า / ไม่ใช่ array เลย / undefined → ไม่มี image key", () => {
      const dom = loadDom();
      const { buildProductNode } = dom.window.CSSIGN_PRODUCT_SCHEMA;
      assert.equal("image" in buildProductNode({ images: [] }), false);
      assert.equal("image" in buildProductNode({ images: "not-an-array" }), false);
      assert.equal("image" in buildProductNode({}), false);
    });

    test("images: object แรกในลิสต์ไม่มี .url (falsy) → image เป็น null ไม่ถูกใส่เป็น key (falsy ผ่าน if)", () => {
      const dom = loadDom();
      const { buildProductNode } = dom.window.CSSIGN_PRODUCT_SCHEMA;
      const node = buildProductNode({ images: [{}] });
      assert.equal("image" in node, false);
    });

    test("price: null/undefined/สตริงว่าง/'ขอใบเสนอราคา' (ไม่ใช่ตัวเลข) → ไม่มี offers เลย", () => {
      const dom = loadDom();
      const { buildProductNode } = dom.window.CSSIGN_PRODUCT_SCHEMA;
      assert.equal("offers" in buildProductNode({ price: null }), false);
      assert.equal("offers" in buildProductNode({}), false);
      assert.equal("offers" in buildProductNode({ price: "" }), false);
      assert.equal("offers" in buildProductNode({ price: "ขอใบเสนอราคา" }), false);
    });

    test("price: 0 หรือค่าติดลบ → ไม่มี offers (ต้อง n > 0 เท่านั้น)", () => {
      const dom = loadDom();
      const { buildProductNode } = dom.window.CSSIGN_PRODUCT_SCHEMA;
      assert.equal("offers" in buildProductNode({ price: 0 }), false);
      assert.equal("offers" in buildProductNode({ price: -500 }), false);
      assert.equal("offers" in buildProductNode({ price: "-500" }), false);
    });

    test("price: offers.url ใช้ node.url (ที่มาจาก input.url ถ้ามี ไม่ใช่ SITE_URL เสมอ)", () => {
      const dom = loadDom();
      const { buildProductNode } = dom.window.CSSIGN_PRODUCT_SCHEMA;
      const node = buildProductNode({ price: 500, url: "https://cssign.co.th/products/x" });
      assert.equal(node.offers.url, "https://cssign.co.th/products/x");
      const nodeNoUrl = buildProductNode({ price: 500 });
      assert.equal(nodeNoUrl.offers.url, SITE_URL);
    });

    test("aggregateRating: มีทั้ง ratingValue และ reviewCount → ถูกเพิ่มเข้า node ครบ", () => {
      const dom = loadDom();
      const { buildProductNode } = dom.window.CSSIGN_PRODUCT_SCHEMA;
      const node = buildProductNode({ aggregateRating: { ratingValue: 4.5, reviewCount: 12 } });
      assert.deepEqual(JSON.parse(JSON.stringify(node.aggregateRating)), {
        "@type": "AggregateRating",
        ratingValue: 4.5,
        reviewCount: 12,
      });
    });

    test("aggregateRating: มีแค่ ratingValue หรือแค่ reviewCount อย่างเดียว → ไม่ถูกเพิ่ม (ต้องมีครบทั้งคู่)", () => {
      const dom = loadDom();
      const { buildProductNode } = dom.window.CSSIGN_PRODUCT_SCHEMA;
      assert.equal("aggregateRating" in buildProductNode({ aggregateRating: { ratingValue: 4.5 } }), false);
      assert.equal("aggregateRating" in buildProductNode({ aggregateRating: { reviewCount: 12 } }), false);
      assert.equal("aggregateRating" in buildProductNode({ aggregateRating: {} }), false);
    });

    test("aggregateRating: ratingValue เป็น 0 (falsy แต่เป็นค่าถูกต้องทางคณิตศาสตร์) → ไม่ถูกเพิ่ม เพราะเช็คแบบ truthy ล้วนๆ ในโค้ดจริง (บันทึกพฤติกรรม ไม่ใช่บั๊ก — ไม่แก้โค้ดจริง)", () => {
      const dom = loadDom();
      const { buildProductNode } = dom.window.CSSIGN_PRODUCT_SCHEMA;
      const node = buildProductNode({ aggregateRating: { ratingValue: 0, reviewCount: 5 } });
      assert.equal("aggregateRating" in node, false);
    });

    test("input.id เป็นค่าว่าง/undefined → ไม่มี @id key เลย", () => {
      const dom = loadDom();
      const { buildProductNode } = dom.window.CSSIGN_PRODUCT_SCHEMA;
      assert.equal("@id" in buildProductNode({}), false);
      assert.equal("@id" in buildProductNode({ id: "" }), false);
    });
  });

  describe("extractPriceNumber()", () => {
    test("ตัวเลขจริง/สตริงตัวเลข → คืนเป็นสตริงตัวเลข", () => {
      const dom = loadDom();
      const { extractPriceNumber } = dom.window.CSSIGN_PRODUCT_SCHEMA;
      assert.equal(extractPriceNumber(1250), "1250");
      assert.equal(extractPriceNumber("1250"), "1250");
      assert.equal(extractPriceNumber("99.5"), "99.5");
    });

    test("null/undefined/สตริงว่าง/สตริงไม่ใช่ตัวเลข/0/ติดลบ → null ทั้งหมด", () => {
      const dom = loadDom();
      const { extractPriceNumber } = dom.window.CSSIGN_PRODUCT_SCHEMA;
      assert.equal(extractPriceNumber(null), null);
      assert.equal(extractPriceNumber(undefined), null);
      assert.equal(extractPriceNumber(""), null);
      assert.equal(extractPriceNumber("ขอใบเสนอราคา"), null);
      assert.equal(extractPriceNumber(0), null);
      assert.equal(extractPriceNumber("0"), null);
      assert.equal(extractPriceNumber(-10), null);
    });
  });

  describe("injectJsonLd()", () => {
    test("schemaOrNull มีค่า + ยังไม่มี <script> เดิม → สร้างใหม่ id/type ถูกต้อง + textContent เป็น JSON ของ schema", () => {
      const dom = loadDom();
      const { injectJsonLd } = dom.window.CSSIGN_PRODUCT_SCHEMA;
      const { document } = dom.window;
      injectJsonLd("ld-product", { "@type": "Product", name: "ทดสอบ" });
      const el = document.getElementById("ld-product");
      assert.ok(el, "ต้องสร้าง <script> ใหม่");
      assert.equal(el.tagName, "SCRIPT");
      assert.equal(el.type, "application/ld+json");
      assert.deepEqual(JSON.parse(el.textContent), { "@type": "Product", name: "ทดสอบ" });
    });

    test("เรียกซ้ำด้วย schema ใหม่ + id เดิม → อัปเดต element เดิม (reference เดิม) ไม่สร้างซ้ำสอง", () => {
      const dom = loadDom();
      const { injectJsonLd } = dom.window.CSSIGN_PRODUCT_SCHEMA;
      const { document } = dom.window;
      injectJsonLd("ld-product", { name: "รอบแรก" });
      const first = document.getElementById("ld-product");
      injectJsonLd("ld-product", { name: "รอบสอง" });
      const second = document.getElementById("ld-product");
      assert.equal(first, second, "ต้องเป็น element ตัวเดิม ไม่สร้างใหม่");
      assert.equal(document.querySelectorAll("#ld-product").length, 1);
      assert.deepEqual(JSON.parse(second.textContent), { name: "รอบสอง" });
    });

    test("schemaOrNull เป็น null + มี <script> เดิมอยู่ → ลบ element เดิมออก", () => {
      const dom = loadDom();
      const { injectJsonLd } = dom.window.CSSIGN_PRODUCT_SCHEMA;
      const { document } = dom.window;
      injectJsonLd("ld-product", { name: "มีอยู่" });
      assert.ok(document.getElementById("ld-product"));
      injectJsonLd("ld-product", null);
      assert.equal(document.getElementById("ld-product"), null);
    });

    test("schemaOrNull เป็น null + ไม่มี <script> เดิมอยู่แต่แรก → ไม่ throw ไม่มีอะไรเกิดขึ้น", () => {
      const dom = loadDom();
      const { injectJsonLd } = dom.window.CSSIGN_PRODUCT_SCHEMA;
      const { document } = dom.window;
      assert.doesNotThrow(() => injectJsonLd("ld-not-exist", null));
      assert.equal(document.getElementById("ld-not-exist"), null);
    });

    test("id ต่างกัน 2 ตัว → สร้าง 2 element แยกกันคนละ id ไม่ชนกัน", () => {
      const dom = loadDom();
      const { injectJsonLd } = dom.window.CSSIGN_PRODUCT_SCHEMA;
      const { document } = dom.window;
      injectJsonLd("ld-a", { name: "A" });
      injectJsonLd("ld-b", { name: "B" });
      assert.ok(document.getElementById("ld-a"));
      assert.ok(document.getElementById("ld-b"));
      assert.notEqual(document.getElementById("ld-a"), document.getElementById("ld-b"));
    });
  });
});
