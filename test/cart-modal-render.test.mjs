// test/cart-modal-render.test.mjs — P3.0 Phase 1 รอบย่อย 4 ต่อ
//
// jsdom test สำหรับ renderCart() ของ js/cart-modal.js — ตะกร้าว่าง/มีรายการ, ปุ่ม +/-/ลบ,
// มิเรอร์ EN, ปุ่ม "ขอใบเสนอราคา" — แยกจาก test/cart-modal-focus-trap.test.mjs ตามธรรมเนียม
// เดียวกับที่ test/track-modal-form-flow.test.mjs แยกจาก test/track-modal-focus-trap.test.mjs
// (คนละ concern กัน)
//
// วิธีทดสอบ: เหมือน test/cart-modal-focus-trap.test.mjs ทุกประการ (classic script, runScripts:
// "dangerously", markup จริงจาก js/cart-modal-template.js) — จำลอง window.CSSignCart ด้วย
// object ธรรมดา (ไม่ import js/cart-global.js จริง เพราะเป็น ES module ที่ทดสอบแยกอยู่แล้วใน
// test/cart-global.test.mjs — ที่นี่สนใจแค่ฝั่ง cart-modal.js/การ render)
//
// ไม่ได้แก้ไฟล์ .js/.html/.css ที่เป็นโค้ดจริงเลยแม้แต่บรรทัดเดียวในไฟล์นี้ — งานทดสอบล้วนๆ

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const CM_TEMPLATE_SRC = readFileSync(new URL("../js/cart-modal-template.js", import.meta.url), "utf-8");
const CM_HTML_MATCH = CM_TEMPLATE_SRC.match(/var HTML = `([\s\S]*?)`;/);
if (!CM_HTML_MATCH) throw new Error("cart-modal-render.test.mjs: ดึง template literal จาก js/cart-modal-template.js ไม่สำเร็จ (โครงสร้างไฟล์อาจเปลี่ยนไป)");
const CM_HTML = CM_HTML_MATCH[1];

const CM_JS_SRC = readFileSync(new URL("../js/cart-modal.js", import.meta.url), "utf-8");

const SAMPLE_ITEMS = [
  {
    productId: "p1", name: "ป้ายไฟ LED หน้าร้าน", variantLabel: "60x180cm / อะคริลิก",
    size: "60x180cm", material: "อะคริลิก", unitPriceHint: 4500, qty: 2, unit: "แผ่น",
    image: "https://res.cloudinary.com/demo/image/upload/p1.jpg",
  },
  {
    productId: "p2", name: "ป้ายบอกทางในโรงงาน", variantLabel: "",
    size: "", material: "", unitPriceHint: null, qty: 1, unit: "ชิ้น", image: "",
  },
];

function makeDom(url, cartStub) {
  const dom = new JSDOM(
    `<!doctype html><html><body>${CM_HTML}</body></html>`,
    { url: url || "https://example.test/", runScripts: "dangerously", pretendToBeVisual: true }
  );
  dom.window.requestAnimationFrame = (cb) => setTimeout(cb, 0);
  dom.window.CSSignCart = cartStub || { getCartItems: () => [] };
  return dom;
}

function runCartModalJs(dom) {
  const scriptEl = dom.window.document.createElement("script");
  scriptEl.textContent = CM_JS_SRC;
  dom.window.document.body.appendChild(scriptEl);
}

function click(dom, el) {
  el.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
}
function nextTick() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe("js/cart-modal.js — renderCart() ตะกร้าว่าง/มีรายการ", () => {
  test("ตะกร้าว่าง: โชว์ #cm-empty (.show) ซ่อน #cm-list/#cm-footer/#cm-price-note", async () => {
    const dom = makeDom();
    runCartModalJs(dom);
    dom.window.openCartModal();
    await nextTick();
    const { document } = dom.window;

    assert.ok(document.getElementById("cm-empty").classList.contains("show"));
    assert.equal(document.getElementById("cm-list").style.display, "none");
    assert.equal(document.getElementById("cm-footer").style.display, "none");
    assert.equal(document.getElementById("cm-price-note").style.display, "none");
    assert.equal(document.getElementById("cm-list").innerHTML, "");
  });

  test("มีรายการ: ซ่อน #cm-empty, โชว์ #cm-list/#cm-footer/#cm-price-note, สร้าง .cm-item ครบตามจำนวนรายการ", async () => {
    const dom = makeDom("https://example.test/", { getCartItems: () => SAMPLE_ITEMS });
    runCartModalJs(dom);
    dom.window.openCartModal();
    await nextTick();
    const { document } = dom.window;

    assert.ok(!document.getElementById("cm-empty").classList.contains("show"));
    assert.notEqual(document.getElementById("cm-list").style.display, "none");
    const rows = document.querySelectorAll(".cm-item");
    assert.equal(rows.length, 2);
  });

  test("แสดงสรุป \"จำนวนรวม\" (.cm-footer-row) เหนือปุ่มขอใบเสนอราคา — ไม่ใช่ราคารวม (unitPriceHint เป็นราคาโดยประมาณต่อรายการเท่านั้น)", async () => {
    const dom = makeDom("https://example.test/", { getCartItems: () => SAMPLE_ITEMS });
    runCartModalJs(dom);
    dom.window.openCartModal();
    await nextTick();
    const { document } = dom.window;
    const summary = document.getElementById("cm-footer-summary");
    assert.ok(summary, "ต้องมีแถวสรุปจำนวนรวม");
    assert.ok(summary.classList.contains("cm-footer-row"));
    assert.equal(summary.querySelector("strong").textContent, "3", "รวม qty ของทั้ง 2 รายการ (2+1)");
    assert.ok(summary.compareDocumentPosition(document.getElementById("cm-quote-btn")) & 4, "แถวสรุปต้องอยู่ก่อนปุ่มขอใบเสนอราคาเสมอ");
  });

  test("แถวสินค้า: แสดงชื่อ, meta (size/material/variantLabel คั่นด้วย ·), ราคาโดยประมาณพร้อมคำเตือน", async () => {
    const dom = makeDom("https://example.test/", { getCartItems: () => SAMPLE_ITEMS });
    runCartModalJs(dom);
    dom.window.openCartModal();
    await nextTick();
    const { document } = dom.window;
    const firstRow = document.querySelectorAll(".cm-item")[0];

    assert.ok(firstRow.querySelector(".cm-item-name").textContent.includes("ป้ายไฟ LED หน้าร้าน"));
    const meta = firstRow.querySelector(".cm-item-meta").textContent;
    assert.ok(meta.includes("60x180cm") && meta.includes("อะคริลิก"));
    const priceHint = firstRow.querySelector(".cm-item-price-hint").textContent;
    assert.ok(priceHint.includes("4,500"), "ต้อง format ตัวเลขแบบ th-TH");
    assert.ok(priceHint.includes("โดยประมาณ"), "ต้องมีคำเตือนว่าเป็นราคาโดยประมาณเสมอ ห้ามโชว์เป็นราคานิ่งๆ");
  });

  test("รายการที่ไม่มี unitPriceHint (null): ไม่แสดง .cm-item-price-hint เลย", async () => {
    const dom = makeDom("https://example.test/", { getCartItems: () => SAMPLE_ITEMS });
    runCartModalJs(dom);
    dom.window.openCartModal();
    await nextTick();
    const { document } = dom.window;
    const secondRow = document.querySelectorAll(".cm-item")[1];
    assert.equal(secondRow.querySelector(".cm-item-price-hint"), null);
  });

  test("รายการที่ไม่มี image: ไม่สร้าง <img> ใช้ div.cm-item-img เปล่าแทน (ไม่ throw)", async () => {
    const dom = makeDom("https://example.test/", { getCartItems: () => SAMPLE_ITEMS });
    runCartModalJs(dom);
    dom.window.openCartModal();
    await nextTick();
    const { document } = dom.window;
    const secondRow = document.querySelectorAll(".cm-item")[1];
    assert.equal(secondRow.querySelector("img"), null);
    assert.ok(secondRow.querySelector(".cm-item-img"));
  });

  test("รายการที่มี image: ใช้ <img class=\"cm-item-img real-photo\"> (piggyback js/img-error-fallback.js เดิม ไม่เขียน fallback ใหม่)", async () => {
    const dom = makeDom("https://example.test/", { getCartItems: () => SAMPLE_ITEMS });
    runCartModalJs(dom);
    dom.window.openCartModal();
    await nextTick();
    const { document } = dom.window;
    const firstRow = document.querySelectorAll(".cm-item")[0];
    const img = firstRow.querySelector("img.cm-item-img");
    assert.ok(img);
    assert.ok(img.classList.contains("real-photo"));
    assert.equal(img.getAttribute("src"), SAMPLE_ITEMS[0].image);
  });

  test("ชื่อ/ค่าที่มี HTML พิเศษถูก escape ป้องกัน XSS (ตรวจผ่าน querySelector ไม่ใช่ raw innerHTML)", async () => {
    const xssItems = [{
      productId: "p3", name: '<img src=x onerror=alert(1)>', variantLabel: "",
      size: "", material: "", unitPriceHint: null, qty: 1, unit: "", image: "",
    }];
    const dom = makeDom("https://example.test/", { getCartItems: () => xssItems });
    runCartModalJs(dom);
    dom.window.openCartModal();
    await nextTick();
    const { document } = dom.window;
    assert.equal(document.querySelectorAll(".cm-item img[onerror]").length, 0, "ห้ามมี <img onerror> ที่ inject เข้ามาจริงในโครงสร้าง DOM");
    assert.ok(document.querySelector(".cm-item-name").textContent.includes("<img"), "แต่ข้อความยังต้องอ่านได้ปกติในรูปแบบ text");
  });
});

describe("js/cart-modal.js — ปุ่ม +/- และปุ่มลบในแต่ละแถว", () => {
  test("ปุ่ม + เรียก window.CSSignCart.updateCartItemQty(productId, variantLabel, currentQty+1) แล้ว render ใหม่ทันที", async () => {
    let calledWith = null;
    let items = SAMPLE_ITEMS.map((it) => ({ ...it }));
    const cartStub = {
      getCartItems: () => items,
      updateCartItemQty: (productId, variantLabel, qty) => {
        calledWith = [productId, variantLabel, qty];
        items = items.map((it) => (it.productId === productId && it.variantLabel === variantLabel ? { ...it, qty } : it));
        return items;
      },
    };
    const dom = makeDom("https://example.test/", cartStub);
    runCartModalJs(dom);
    dom.window.openCartModal();
    await nextTick();
    const { document } = dom.window;
    const firstRow = document.querySelectorAll(".cm-item")[0];
    click(dom, firstRow.querySelector(".cm-qty-plus"));

    assert.deepEqual(calledWith, ["p1", "60x180cm / อะคริลิก", 3]);
    assert.equal(document.querySelectorAll(".cm-item")[0].querySelector(".cm-qty-val").textContent, "3");
  });

  test("ปุ่ม - เรียก updateCartItemQty ด้วย currentQty-1", async () => {
    let calledWith = null;
    const cartStub = {
      getCartItems: () => SAMPLE_ITEMS,
      updateCartItemQty: (productId, variantLabel, qty) => { calledWith = [productId, variantLabel, qty]; return SAMPLE_ITEMS; },
    };
    const dom = makeDom("https://example.test/", cartStub);
    runCartModalJs(dom);
    dom.window.openCartModal();
    await nextTick();
    const firstRow = dom.window.document.querySelectorAll(".cm-item")[0];
    click(dom, firstRow.querySelector(".cm-qty-minus"));
    assert.deepEqual(calledWith, ["p1", "60x180cm / อะคริลิก", 1]);
  });

  test("ปุ่มลบเรียก window.CSSignCart.removeFromCart(productId, variantLabel) แล้ว render ใหม่ทันที (แถวหายไป)", async () => {
    let calledWith = null;
    let items = SAMPLE_ITEMS.map((it) => ({ ...it }));
    const cartStub = {
      getCartItems: () => items,
      removeFromCart: (productId, variantLabel) => {
        calledWith = [productId, variantLabel];
        items = items.filter((it) => !(it.productId === productId && it.variantLabel === variantLabel));
        return items;
      },
    };
    const dom = makeDom("https://example.test/", cartStub);
    runCartModalJs(dom);
    dom.window.openCartModal();
    await nextTick();
    const { document } = dom.window;
    click(dom, document.querySelectorAll(".cm-item")[0].querySelector(".cm-item-remove"));

    assert.deepEqual(calledWith, ["p1", "60x180cm / อะคริลิก"]);
    assert.equal(document.querySelectorAll(".cm-item").length, 1);
  });
});

describe("js/cart-modal.js — มิเรอร์ EN (/en/*)", () => {
  test("หน้า /en/*: text node ทุกจุดถูกแปลเป็นอังกฤษตอน init (ก่อนแม้แต่เปิด modal)", () => {
    const dom = makeDom("https://example.test/en/products.html");
    runCartModalJs(dom);
    const { document } = dom.window;

    assert.equal(document.getElementById("cm-eyebrow-text").textContent, "Shopping Cart");
    assert.equal(document.getElementById("cm-title").textContent, "My Cart");
    assert.equal(document.getElementById("cm-empty-title").textContent, "Your cart is empty");
    assert.equal(document.getElementById("cm-quote-btn-label").textContent, "Request a Quote");
    assert.equal(document.getElementById("cm-close").getAttribute("aria-label"), "Close");
  });

  test("หน้าไทยปกติ (ไม่มี /en/): ข้อความยังเป็นไทยเดิมจาก template ไม่ถูกแก้", () => {
    const dom = makeDom("https://example.test/products.html");
    runCartModalJs(dom);
    const { document } = dom.window;
    assert.equal(document.getElementById("cm-title").textContent, "ตะกร้าของฉัน");
  });

  test("หน้า /en/*: ปุ่ม +/-/ลบ ใช้ aria-label ภาษาอังกฤษ", async () => {
    const dom = makeDom("https://example.test/en/products.html", { getCartItems: () => SAMPLE_ITEMS });
    runCartModalJs(dom);
    dom.window.openCartModal();
    await nextTick();
    const { document } = dom.window;
    const firstRow = document.querySelectorAll(".cm-item")[0];
    assert.equal(firstRow.querySelector(".cm-qty-plus").getAttribute("aria-label"), "Increase quantity");
    assert.equal(firstRow.querySelector(".cm-item-remove").getAttribute("aria-label"), "Remove item");
    assert.ok(firstRow.querySelector(".cm-item-price-hint").textContent.includes("(est.)"));
  });
});

describe("js/cart-modal.js — ปุ่ม \"ขอใบเสนอราคา\" (#cm-quote-btn)", () => {
  test("กดแล้วปิด modal ตัวเองไปก่อน (Phase 2 ฟอร์ม prefill จากตะกร้ายังไม่ถูกสร้าง ไม่ผูก qmodal เดิม)", async () => {
    const dom = makeDom();
    runCartModalJs(dom);
    dom.window.openCartModal();
    await nextTick();
    const { document } = dom.window;
    click(dom, document.getElementById("cm-quote-btn"));
    assert.equal(document.getElementById("cm-overlay").style.display, "none");
  });
});
