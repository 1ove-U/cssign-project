// test/cart-global.test.mjs — P3.0 Phase 1 รอบย่อย 2-3
//
// Unit test สำหรับ js/cart-global.js — สะพานเชื่อม js/cart.js (ES module, pure) เข้ากับ
// window.CSSignCart เพื่อให้ classic script (js/products-detail-popup.js, js/main.js) เรียกใช้ได้
// (แพทเทิร์นเดียวกับ test/currency-global.test.mjs สำหรับ js/currency-global.js)
//
// วิธีทดสอบ: ไฟล์นี้ import ทั้ง js/cart.js (ต้องมี localStorage) และ js/form-toast.js (ต้องมี
// document) เข้ามาใช้จริง — ตั้ง global.window/global.document เป็น jsdom ก่อน + polyfill
// globalThis.localStorage แบบ in-memory Map เดียวกับ test/cart.test.mjs ก่อน dynamic import()
// (import แบบ dynamic เพราะต้องตั้ง global ให้เสร็จก่อน evaluate module — เหมือน
// currency-global.test.mjs ทำไว้)
//
// รอบย่อย 3 เพิ่ม: getCartCount (expose ตรงจาก cart.js) + คลุมว่า addToCartAndNotify และ
// ตอนโมดูลนี้โหลดเสร็จ (top-level) ต้อง dispatch 'cssign:cart-updated' บน window ให้ nav
// (js/main.js) ฟังไปอัปเดต badge ได้ — ต้องสร้าง event ด้วย window.CustomEvent (ไม่ใช่
// CustomEvent เฉยๆ) ไม่งั้น jsdom throw เพราะคนละ realm กับ global ของ Node (v19+)

import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

function installFakeLocalStorage() {
  const store = new Map();
  globalThis.localStorage = {
    getItem(key) { return store.has(key) ? store.get(key) : null; },
    setItem(key, value) { store.set(key, String(value)); },
    removeItem(key) { store.delete(key); },
    clear() { store.clear(); },
  };
  return store;
}

// js/form-toast.js เรียก requestAnimationFrame() ตอนแสดง toast (ใส่ class 'is-visible' เพื่อ
// เล่น transition) — jsdom ไม่ implement ให้ default (เหมือนที่บันทึกไว้ซ้ำหลายเทสในโปรเจกต์
// เช่น test/admin-global-search-jump.test.mjs) ต้อง stub เป็น synchronous เอง
function installFakeRAF() {
  globalThis.requestAnimationFrame = (cb) => { cb(); return 1; };
}

describe("js/cart-global.js — window.CSSignCart bridge (P3.0 Phase 1 รอบย่อย 2)", () => {
  test("import แล้วตั้ง window.CSSignCart ครบทุกฟังก์ชัน + addToCart เขียนลง localStorage จริงตรงกับ js/cart.js ต้นทาง", async () => {
    installFakeLocalStorage();
    const dom = new JSDOM("<!doctype html><body></body>", { url: "https://example.test/" });
    global.window = dom.window;
    global.document = dom.window.document;
    try {
      await import("../js/cart-global.js");
      assert.ok(global.window.CSSignCart, "window.CSSignCart ต้องถูกตั้งค่า");
      assert.equal(typeof global.window.CSSignCart.addToCart, "function");
      assert.equal(typeof global.window.CSSignCart.addToCartAndNotify, "function");
      assert.equal(typeof global.window.CSSignCart.getCartCount, "function");

      global.window.CSSignCart.addToCart({ productId: "p1", name: "Sign A" }, 2);
      const raw = globalThis.localStorage.getItem("cssign_cart_v1");
      const items = JSON.parse(raw);
      assert.equal(items.length, 1);
      assert.equal(items[0].productId, "p1");
      assert.equal(items[0].qty, 2);
    } finally {
      delete global.window;
      delete global.document;
    }
  });

  test("addToCartAndNotify: เขียนตะกร้าเหมือน addToCart เป๊ะ + โผล่ toast (.cs-toast) ใน DOM พร้อมชื่อสินค้า", async () => {
    installFakeLocalStorage();
    installFakeRAF();
    const dom = new JSDOM("<!doctype html><body></body>", { url: "https://example.test/" });
    global.window = dom.window;
    global.document = dom.window.document;
    try {
      // import ด้วย query string ใหม่ให้ต่างจากเทสก่อนหน้า — module cache ของ Node ผูกกับ
      // specifier string เป๊ะๆ ถ้า import ซ้ำ specifier เดิมจะได้ instance ที่ผูกกับ
      // global.window ก้อนเก่า (ปิดไปแล้ว) แทนที่จะ evaluate ใหม่กับ jsdom ก้อนนี้
      const mod = await import("../js/cart-global.js?round2-notify-test");
      mod; // เผื่อ lint ไม่ใช้ตัวแปร — จริงๆ ใช้ผ่าน global.window.CSSignCart ด้านล่าง

      global.window.CSSignCart.addToCartAndNotify({ productId: "p2", name: "ป้ายทดสอบ" }, 1);

      const raw = globalThis.localStorage.getItem("cssign_cart_v1");
      const items = JSON.parse(raw);
      assert.equal(items.length, 1);
      assert.equal(items[0].productId, "p2");

      const toastEl = dom.window.document.querySelector(".cs-toast--success .cs-toast-msg");
      assert.ok(toastEl, "toast แจ้งผลสำเร็จต้องถูกสร้างขึ้นใน DOM");
      assert.match(toastEl.textContent, /ป้ายทดสอบ/);
    } finally {
      delete global.window;
      delete global.document;
    }
  });

  test("addToCartAndNotify: item ไม่มี name → toast fallback เป็นคำว่า 'สินค้า' ไม่ throw", async () => {
    installFakeLocalStorage();
    installFakeRAF();
    const dom = new JSDOM("<!doctype html><body></body>", { url: "https://example.test/" });
    global.window = dom.window;
    global.document = dom.window.document;
    try {
      await import("../js/cart-global.js?round2-fallback-test");
      assert.doesNotThrow(() => {
        global.window.CSSignCart.addToCartAndNotify({ productId: "p3" }, 1);
      });
      const toastEl = dom.window.document.querySelector(".cs-toast--success .cs-toast-msg");
      assert.match(toastEl.textContent, /สินค้า/);
    } finally {
      delete global.window;
      delete global.document;
    }
  });

  test("getCartCount: คืนผลรวม qty ตรงกับ js/cart.js ต้นทาง (P3.0 รอบย่อย 3)", async () => {
    installFakeLocalStorage();
    const dom = new JSDOM("<!doctype html><body></body>", { url: "https://example.test/" });
    global.window = dom.window;
    global.document = dom.window.document;
    try {
      await import("../js/cart-global.js?round3-getcartcount-test");
      assert.equal(global.window.CSSignCart.getCartCount(), 0, "ตะกร้าว่าง → 0");

      global.window.CSSignCart.addToCart({ productId: "p1", name: "Sign A" }, 2);
      global.window.CSSignCart.addToCart({ productId: "p2", name: "Sign B" }, 3);
      assert.equal(global.window.CSSignCart.getCartCount(), 5, "ผลรวม qty ทุกแถว");
    } finally {
      delete global.window;
      delete global.document;
    }
  });

  test("getCartItems: คืนรายการตรงกับ js/cart.js ต้นทาง (P3.0 รอบย่อย 4)", async () => {
    installFakeLocalStorage();
    const dom = new JSDOM("<!doctype html><body></body>", { url: "https://example.test/" });
    global.window = dom.window;
    global.document = dom.window.document;
    try {
      await import("../js/cart-global.js?round4-getcartitems-test");
      assert.deepEqual(global.window.CSSignCart.getCartItems(), [], "ตะกร้าว่าง → array ว่าง");

      global.window.CSSignCart.addToCart({ productId: "p1", name: "Sign A", variantLabel: "size-s" }, 2);
      const items = global.window.CSSignCart.getCartItems();
      assert.equal(items.length, 1);
      assert.equal(items[0].productId, "p1");
      assert.equal(items[0].qty, 2);
    } finally {
      delete global.window;
      delete global.document;
    }
  });

  test("updateCartItemQty: แก้จำนวนได้จริง + dispatch 'cssign:cart-updated' พร้อมจำนวนล่าสุด (P3.0 รอบย่อย 4)", async () => {
    installFakeLocalStorage();
    const dom = new JSDOM("<!doctype html><body></body>", { url: "https://example.test/" });
    global.window = dom.window;
    global.document = dom.window.document;
    try {
      await import("../js/cart-global.js?round4-updateqty-test");
      global.window.CSSignCart.addToCart({ productId: "p1", name: "Sign A", variantLabel: "size-s" }, 2);

      let receivedCount = null;
      let eventCount = 0;
      dom.window.addEventListener("cssign:cart-updated", (e) => { receivedCount = e.detail.count; eventCount++; });

      const items = global.window.CSSignCart.updateCartItemQty("p1", "size-s", 5);
      assert.equal(items[0].qty, 5, "จำนวนต้องอัปเดตจริง");
      assert.equal(eventCount, 1, "ต้อง dispatch พอดี 1 ครั้ง");
      assert.equal(receivedCount, 5);
    } finally {
      delete global.window;
      delete global.document;
    }
  });

  test("updateCartItemQty: qty <= 0 ลบรายการทิ้ง + badge เหลือ 0 (P3.0 รอบย่อย 4)", async () => {
    installFakeLocalStorage();
    const dom = new JSDOM("<!doctype html><body></body>", { url: "https://example.test/" });
    global.window = dom.window;
    global.document = dom.window.document;
    try {
      await import("../js/cart-global.js?round4-updateqty-zero-test");
      global.window.CSSignCart.addToCart({ productId: "p1", name: "Sign A", variantLabel: "" }, 2);

      const items = global.window.CSSignCart.updateCartItemQty("p1", "", 0);
      assert.equal(items.length, 0);
      assert.equal(global.window.CSSignCart.getCartCount(), 0);
    } finally {
      delete global.window;
      delete global.document;
    }
  });

  test("removeFromCart: ลบรายการที่ระบุได้จริง + dispatch 'cssign:cart-updated' พร้อมจำนวนล่าสุด (P3.0 รอบย่อย 4)", async () => {
    installFakeLocalStorage();
    const dom = new JSDOM("<!doctype html><body></body>", { url: "https://example.test/" });
    global.window = dom.window;
    global.document = dom.window.document;
    try {
      await import("../js/cart-global.js?round4-remove-test");
      global.window.CSSignCart.addToCart({ productId: "p1", name: "Sign A", variantLabel: "" }, 2);
      global.window.CSSignCart.addToCart({ productId: "p2", name: "Sign B", variantLabel: "" }, 3);

      let receivedCount = null;
      let eventCount = 0;
      dom.window.addEventListener("cssign:cart-updated", (e) => { receivedCount = e.detail.count; eventCount++; });

      const items = global.window.CSSignCart.removeFromCart("p1", "");
      assert.equal(items.length, 1);
      assert.equal(items[0].productId, "p2");
      assert.equal(eventCount, 1);
      assert.equal(receivedCount, 3);
    } finally {
      delete global.window;
      delete global.document;
    }
  });

  test("dispatch 'cssign:cart-updated' บน window ทันทีที่โมดูลโหลดเสร็จ (ไม่ต้องรอกด 'เพิ่มลงตะกร้า' ก่อน — เผื่อของค้างจาก session ก่อนหน้า)", async () => {
    const store = installFakeLocalStorage();
    // จำลองตะกร้าที่มีของค้างอยู่แล้วจาก session ก่อนหน้า ก่อน import โมดูล
    store.set("cssign_cart_v1", JSON.stringify([{ productId: "p9", variantLabel: "", qty: 4 }]));
    const dom = new JSDOM("<!doctype html><body></body>", { url: "https://example.test/" });
    global.window = dom.window;
    global.document = dom.window.document;
    try {
      let receivedCount = null;
      dom.window.addEventListener("cssign:cart-updated", (e) => { receivedCount = e.detail.count; });
      await import("../js/cart-global.js?round3-initial-dispatch-test");
      assert.equal(receivedCount, 4, "ต้อง dispatch event พร้อมจำนวนที่ถูกต้องทันทีตอนโมดูลโหลดเสร็จ ไม่ต้องรอ action ใดๆ ก่อน");
    } finally {
      delete global.window;
      delete global.document;
    }
  });

  test("addToCartAndNotify: dispatch 'cssign:cart-updated' บน window พร้อมจำนวนล่าสุดหลังหยิบใส่ตะกร้า", async () => {
    installFakeLocalStorage();
    installFakeRAF();
    const dom = new JSDOM("<!doctype html><body></body>", { url: "https://example.test/" });
    global.window = dom.window;
    global.document = dom.window.document;
    try {
      await import("../js/cart-global.js?round3-notify-dispatch-test");
      let receivedCount = null;
      let eventCount = 0;
      dom.window.addEventListener("cssign:cart-updated", (e) => { receivedCount = e.detail.count; eventCount++; });

      global.window.CSSignCart.addToCartAndNotify({ productId: "p5", name: "Sign C" }, 3);
      assert.equal(eventCount, 1, "ต้อง dispatch เพิ่มอีก 1 ครั้งหลังกด เพิ่มลงตะกร้า");
      assert.equal(receivedCount, 3);
    } finally {
      delete global.window;
      delete global.document;
    }
  });
});
