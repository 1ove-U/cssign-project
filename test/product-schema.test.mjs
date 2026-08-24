// test/product-schema.test.mjs
//
// jsdom test สำหรับ js/product-schema.js — รอบที่ 137 (ต่อจากรอบ 135 ที่เทส
// js/product-schema-core.js เสร็จแล้ว — ไฟล์นี้คือ dependent ตรงของไฟล์นั้น ตามคำแนะนำท้าย
// รอบ 135 ที่บอกว่า "น่าจะทำต่อได้ลื่นที่สุดเพราะเพิ่งอ่านโค้ดที่เกี่ยวข้องมาแล้ว")
//
// classic IIFE (ไม่มี export ใดๆ) อ่าน .product-card[data-product] จาก #product-grid แล้วห่อ
// เป็น schema.org ItemList ผ่าน window.CSSIGN_PRODUCT_SCHEMA.buildProductNode()/injectJsonLd()
// (มาจาก js/product-schema-core.js ที่ต้องโหลดก่อนเสมอ) — inject() แรกรันแบบ sync ทันทีตอน
// โหลดสคริปต์ ส่วนการรีบิลด์ครั้งถัดๆ ไปมาจาก MutationObserver (debounce 200ms ผ่าน
// window.setTimeout) ที่เฝ้าดู childList/subtree/data-product attribute ของ grid
//
// แพทเทิร์นโหลด: ต้อง appendChild ทั้ง 2 สคริปต์ตามลำดับจริง (core ก่อน แล้วค่อย
// product-schema.js) เข้า JSDOM (runScripts:"dangerously") หลังมี DOM/markup ของ #product-grid
// พร้อมการ์ดอยู่ก่อนแล้วเท่านั้น (เหมือน pattern admin-overview-today.test.mjs) เพราะ IIFE นี้
// อ่าน DOM ทันทีตอน evaluate ไม่รอ DOMContentLoaded ใดๆ — ส่วนการรอ MutationObserver debounce
// ใช้ setTimeout จริง (ไม่ mock timers เหมือน portfolio-render.test.mjs) เพราะ debounce แค่ 200ms
// สั้นพอที่จะรอจริงได้โดยไม่ทำให้เทสช้าเกินไป — สปาย injectJsonLd ด้วยการ monkey-patch property
// บน window.CSSIGN_PRODUCT_SCHEMA หลังโหลด (เรียกของจริงต่อเสมอ) เพื่อนับจำนวนครั้งที่ถูกเรียก
// จริงในเคส debounce โดยไม่กระทบพฤติกรรมจริง (product-schema.js อ่าน core.injectJsonLd ผ่าน
// property lookup ตอนเรียก ไม่ใช่ตอน evaluate จึงแทนที่ทีหลังได้)
//
// ไม่ได้แก้ไฟล์ .js/.html/.css ที่เป็นโค้ดจริงเลยแม้แต่บรรทัดเดียวในไฟล์นี้ — งานทดสอบล้วนๆ

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const CORE_SOURCE = readFileSync(new URL("../js/product-schema-core.js", import.meta.url), "utf-8");
const SOURCE = readFileSync(new URL("../js/product-schema.js", import.meta.url), "utf-8");

const SITE_URL = "https://cssign.co.th/";

function cardHtml(product) {
  const json = JSON.stringify(product).replace(/'/g, "&#39;");
  return `<div class="product-card" data-product='${json}'></div>`;
}

function loadDom({ gridHtml = "", loadCore = true, loadSchema = true } = {}) {
  const dom = new JSDOM(
    `<!doctype html><html><head></head><body><div id="product-grid">${gridHtml}</div></body></html>`,
    { url: "https://example.test/products.html", runScripts: "dangerously" }
  );
  const { document } = dom.window;
  if (loadCore) {
    const coreScript = document.createElement("script");
    coreScript.textContent = CORE_SOURCE;
    document.head.appendChild(coreScript);
  }
  if (loadSchema) {
    const script = document.createElement("script");
    script.textContent = SOURCE;
    document.head.appendChild(script);
  }
  return dom;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getSchema(dom) {
  const el = dom.window.document.getElementById("product-list-schema");
  return el ? JSON.parse(el.textContent) : null;
}

/* แทนที่ injectJsonLd ด้วยตัวนับ (เรียกของจริงต่อเสมอ) — ต้องเรียกหลัง loadDom() เท่านั้น
   เพราะ product-schema.js เก็บ reference ของ core ไว้ตอน evaluate แต่ core.injectJsonLd ถูก
   lookup ผ่าน property ตอนเรียกจริง (`core.injectJsonLd(...)`) จึงแทนที่ทีหลังได้ */
function spyOnInject(dom) {
  const api = dom.window.CSSIGN_PRODUCT_SCHEMA;
  const original = api.injectJsonLd;
  const calls = { count: 0 };
  api.injectJsonLd = function (...args) {
    calls.count += 1;
    return original.apply(this, args);
  };
  return calls;
}

describe("product-schema.js (รอบที่ 137)", () => {
  test("shape: โหลดสคริปต์ได้โดยไม่ throw เมื่อมี #product-grid + core + การ์ดถูกต้อง 1 ใบ", () => {
    assert.doesNotThrow(() =>
      loadDom({ gridHtml: cardHtml({ name: "ป้ายไฟ LED", slug: "led-sign" }) })
    );
  });

  test("ไม่มี #product-grid เลย → ไม่ throw และไม่มี <script id=product-list-schema> ถูกสร้างเลย", () => {
    const dom = new JSDOM(`<!doctype html><html><head></head><body></body></html>`, {
      url: "https://example.test/products.html",
      runScripts: "dangerously",
    });
    const { document } = dom.window;
    const coreScript = document.createElement("script");
    coreScript.textContent = CORE_SOURCE;
    document.head.appendChild(coreScript);
    assert.doesNotThrow(() => {
      const script = document.createElement("script");
      script.textContent = SOURCE;
      document.head.appendChild(script);
    });
    assert.equal(document.getElementById("product-list-schema"), null);
  });

  test("มี #product-grid แต่ window.CSSIGN_PRODUCT_SCHEMA ยังไม่ถูกโหลด (core ไม่มา) → fail quiet ไม่ throw ไม่สร้าง schema", () => {
    const dom = loadDom({
      gridHtml: cardHtml({ name: "ป้ายไฟ LED" }),
      loadCore: false,
    });
    assert.equal(getSchema(dom), null);
  });

  test("grid มีอยู่แต่ไม่มีการ์ด .product-card[data-product] เลย → buildSchema() คืน null ไม่สร้าง schema", () => {
    const dom = loadDom({ gridHtml: `<div class="product-card">ไม่มี data-product</div>` });
    assert.equal(getSchema(dom), null);
  });

  test("การ์ดที่มี data-product='' (ค่าว่างเปล่า) → ถูกข้าม ไม่พัง", () => {
    const dom = loadDom({ gridHtml: `<div class="product-card" data-product=''></div>` });
    assert.equal(getSchema(dom), null);
  });

  test("การ์ด 1 ใบข้อมูลครบ: ห่อเป็น ItemList ถูกต้อง (@context/@type/itemListElement) + ListItem position=1", () => {
    const dom = loadDom({
      gridHtml: cardHtml({
        name: "ป้ายไฟ LED",
        cat: "ป้ายไฟ",
        code: "SKU-001",
        slug: "led-sign",
        priceRaw: 1250,
        material: "อะคริลิก",
        size: "100x50 ซม.",
        images: ["https://example.test/a.jpg"],
      }),
    });
    const schema = getSchema(dom);
    assert.ok(schema, "ต้องมี schema");
    assert.equal(schema["@context"], "https://schema.org");
    assert.equal(schema["@type"], "ItemList");
    assert.equal(schema.itemListElement.length, 1);
    assert.equal(schema.itemListElement[0]["@type"], "ListItem");
    assert.equal(schema.itemListElement[0].position, 1);
    const item = schema.itemListElement[0].item;
    assert.equal(item["@type"], "Product");
    assert.equal(item.name, "ป้ายไฟ LED");
    assert.equal(item.sku, "SKU-001");
    assert.equal(item.category, "ป้ายไฟ");
    assert.equal(item.image, "https://example.test/a.jpg");
    assert.deepEqual(item.additionalProperty, [
      { "@type": "PropertyValue", name: "วัสดุ", value: "อะคริลิก" },
      { "@type": "PropertyValue", name: "ขนาด", value: "100x50 ซม." },
    ]);
    assert.equal(item.offers.price, "1250");
    assert.equal(item["@id"], SITE_URL + "products.html#product-1");
  });

  test("metaTitle/metaDescription ชนะ name/desc เมื่อมีทั้งคู่", () => {
    const dom = loadDom({
      gridHtml: cardHtml({
        name: "ชื่อธรรมดา",
        metaTitle: "ชื่อ SEO",
        desc: "คำอธิบายธรรมดา",
        metaDescription: "คำอธิบาย SEO",
      }),
    });
    const item = getSchema(dom).itemListElement[0].item;
    assert.equal(item.name, "ชื่อ SEO");
    assert.equal(item.description, "คำอธิบาย SEO");
  });

  test("ไม่มี metaTitle/metaDescription → fallback เป็น name/desc ธรรมดา, ไม่มี desc เลยก็ fallback เป็น description", () => {
    const dom = loadDom({
      gridHtml: cardHtml({ name: "ชื่อธรรมดา", description: "คำอธิบายจาก .description" }),
    });
    const item = getSchema(dom).itemListElement[0].item;
    assert.equal(item.name, "ชื่อธรรมดา");
    assert.equal(item.description, "คำอธิบายจาก .description");
  });

  test("price ใช้ priceRaw (ตัวเลขดิบ) ไม่ใช่ price (สตริง format แล้ว) — ส่ง price เป็นข้อความ format ไว้ก็ไม่ถูกเอามาคำนวณ offers", () => {
    const dom = loadDom({
      gridHtml: cardHtml({ name: "สินค้า", price: "เริ่มต้น ฿1,250 / ชิ้น", priceRaw: 1250 }),
    });
    const item = getSchema(dom).itemListElement[0].item;
    assert.equal(item.offers.price, "1250");
  });

  test("มี slug → url เป็น product-detail.html?slug=..., ไม่มี slug → url เป็น products.html?cat=cat_id", () => {
    const dom1 = loadDom({ gridHtml: cardHtml({ name: "A", slug: "sign-a" }) });
    const item1 = getSchema(dom1).itemListElement[0].item;
    assert.equal(item1.url, SITE_URL + "product-detail.html?slug=sign-a");

    const dom2 = loadDom({ gridHtml: cardHtml({ name: "B", cat_id: "cat-lightbox" }) });
    const item2 = getSchema(dom2).itemListElement[0].item;
    assert.equal(item2.url, SITE_URL + "products.html?cat=cat-lightbox");
  });

  test("ไม่มีทั้ง slug และ cat_id → url เป็น products.html?cat= (ว่างเปล่า)", () => {
    const dom = loadDom({ gridHtml: cardHtml({ name: "C" }) });
    const item = getSchema(dom).itemListElement[0].item;
    assert.equal(item.url, SITE_URL + "products.html?cat=");
  });

  test("การ์ดหลายใบ: itemListElement เรียงตามลำดับ DOM จริง (ไม่ sort ซ้ำ) position/@id อิงตาม index", () => {
    const dom = loadDom({
      gridHtml:
        cardHtml({ name: "สินค้า A" }) +
        cardHtml({ name: "สินค้า B" }) +
        cardHtml({ name: "สินค้า C" }),
    });
    const schema = getSchema(dom);
    assert.equal(schema.itemListElement.length, 3);
    assert.deepEqual(
      schema.itemListElement.map((li) => li.position),
      [1, 2, 3]
    );
    assert.deepEqual(
      schema.itemListElement.map((li) => li.item.name),
      ["สินค้า A", "สินค้า B", "สินค้า C"]
    );
    assert.equal(schema.itemListElement[2].item["@id"], SITE_URL + "products.html#product-3");
  });

  test("การ์ดที่มี data-product เป็น JSON เสีย (parse ไม่ผ่าน) → ถูกข้ามเงียบๆ ไม่กระทบการ์ดอื่นที่ถูกต้อง", () => {
    const dom = loadDom({
      gridHtml:
        `<div class="product-card" data-product='{broken json'></div>` +
        cardHtml({ name: "สินค้าดี" }),
    });
    const schema = getSchema(dom);
    assert.equal(schema.itemListElement.length, 1);
    assert.equal(schema.itemListElement[0].item.name, "สินค้าดี");
  });

  test("MutationObserver: เพิ่มการ์ดใหม่เข้า grid หลังโหลดแล้ว → รีบิลด์ schema อัตโนมัติหลังผ่าน debounce (~200ms)", async () => {
    const dom = loadDom({ gridHtml: cardHtml({ name: "สินค้าเดิม" }) });
    const { document } = dom.window;
    assert.equal(getSchema(dom).itemListElement.length, 1);

    const grid = document.getElementById("product-grid");
    const wrap = document.createElement("div");
    wrap.innerHTML = cardHtml({ name: "สินค้าใหม่" });
    grid.appendChild(wrap.firstElementChild);

    await wait(280);
    const schema = getSchema(dom);
    assert.equal(schema.itemListElement.length, 2);
    assert.deepEqual(
      schema.itemListElement.map((li) => li.item.name),
      ["สินค้าเดิม", "สินค้าใหม่"]
    );
  });

  test("MutationObserver: แก้ data-product attribute ของการ์ดเดิม → รีบิลด์เนื้อหาใหม่หลัง debounce", async () => {
    const dom = loadDom({ gridHtml: cardHtml({ name: "ชื่อเก่า" }) });
    const { document } = dom.window;
    const card = document.querySelector(".product-card");
    card.setAttribute("data-product", JSON.stringify({ name: "ชื่อใหม่" }));

    await wait(280);
    const schema = getSchema(dom);
    assert.equal(schema.itemListElement[0].item.name, "ชื่อใหม่");
  });

  test("MutationObserver: mutate จนไม่เหลือการ์ดเลย → schema ถูกลบออกจาก <head>", async () => {
    const dom = loadDom({ gridHtml: cardHtml({ name: "สินค้าเดียว" }) });
    const { document } = dom.window;
    assert.ok(document.getElementById("product-list-schema"));

    document.querySelector(".product-card").remove();
    await wait(280);
    assert.equal(document.getElementById("product-list-schema"), null);
  });

  test("debounce: mutation รัวๆ ติดกันหลายครั้งภายใน 200ms → รีบิลด์แค่ครั้งเดียวหลังนิ่ง (ไม่ใช่ครั้งละ mutation)", async () => {
    const dom = loadDom({ gridHtml: cardHtml({ name: "เริ่มต้น" }) });
    const { document } = dom.window;
    const calls = spyOnInject(dom); // เริ่มนับหลัง inject() แรกตอนโหลดไปแล้ว
    const grid = document.getElementById("product-grid");

    for (let i = 0; i < 3; i++) {
      const wrap = document.createElement("div");
      wrap.innerHTML = cardHtml({ name: "สินค้า " + i });
      grid.appendChild(wrap.firstElementChild);
      await wait(50); // สั้นกว่า debounce 200ms เสมอ — ต้อง clearTimeout ตัวเก่าทิ้งทุกรอบ
    }
    await wait(280);

    assert.equal(calls.count, 1, "ต้องรีบิลด์แค่ครั้งเดียวหลัง mutation รัวๆ นิ่งแล้ว");
    assert.equal(getSchema(dom).itemListElement.length, 4);
  });
});
