// test/cart.test.mjs — P3.0 Phase 1 รอบย่อย 1
//
// ขอบเขต: js/cart.js — cart data layer ล้วนๆ ผ่าน localStorage ไม่แตะ Firestore/DOM เลย
// (pure ES module) จึงไม่ต้องใช้ jsdom หรือ Firebase stub loader ใดๆ — แค่ต้อง polyfill
// globalThis.localStorage เอง (jsdom/Node ไม่มีให้โดย default) แพทเทิร์นเดียวกับที่
// test/admin-sidebar.test.mjs ทำไว้แล้ว (in-memory Map ธรรมดา)
//
// import ด้วย query string คนละอันทุก describe block เพื่อบังคับ module state ใหม่ (ตัวแปร
// module-level ไม่มีใน cart.js จริงๆ อยู่แล้ว เพราะทุกอย่างอ่าน/เขียนผ่าน localStorage ตรงๆ
// ทุกครั้ง — แต่ import ซ้ำด้วย query ใหม่ไว้เผื่อความชัดเจนไม่ต้องพึ่ง cache ข้าม describe)

import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";

function installFakeLocalStorage() {
  const store = new Map();
  globalThis.localStorage = {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
  return store;
}

installFakeLocalStorage();

const {
  CART_STORAGE_KEY,
  getCartItems,
  getCartCount,
  addToCart,
  updateCartItemQty,
  removeFromCart,
  clearCart,
} = await import("../js/cart.js");

beforeEach(() => {
  localStorage.clear();
});

describe("CART_STORAGE_KEY", () => {
  test("เป็นสตริงคงที่", () => {
    assert.equal(typeof CART_STORAGE_KEY, "string");
    assert.ok(CART_STORAGE_KEY.length > 0);
  });
});

describe("getCartItems() / getCartCount() — ตะกร้าว่างเปล่า", () => {
  test("ไม่มีอะไรใน localStorage เลย → คืน [] ไม่ throw", () => {
    assert.deepEqual(getCartItems(), []);
    assert.equal(getCartCount(), 0);
  });

  test("localStorage มีค่าเสีย (JSON parse ไม่ผ่าน) → คืน [] ไม่ throw", () => {
    localStorage.setItem(CART_STORAGE_KEY, "{not valid json");
    assert.deepEqual(getCartItems(), []);
  });

  test("localStorage มีค่าเป็น JSON ที่ไม่ใช่ array (เช่น object เดี่ยว) → คืน []", () => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify({ foo: "bar" }));
    assert.deepEqual(getCartItems(), []);
  });
});

describe("addToCart()", () => {
  test("ไม่มี productId → ไม่เพิ่มอะไร คืนตะกร้าเดิม (ว่างเปล่า)", () => {
    const result = addToCart({ name: "ป้ายทดสอบ" });
    assert.deepEqual(result, []);
    assert.deepEqual(getCartItems(), []);
  });

  test("เพิ่มรายการใหม่ครบทุกฟิลด์", () => {
    addToCart({
      productId: "p1",
      name: "ป้ายอะคริลิค",
      variantLabel: "A1 / สีทอง",
      size: "30x40",
      material: "อะคริลิค",
      unitPriceHint: 590,
      unit: "ชิ้น",
      image: "https://example.com/a.jpg",
    });
    const items = getCartItems();
    assert.equal(items.length, 1);
    assert.deepEqual(items[0], {
      productId: "p1",
      name: "ป้ายอะคริลิค",
      variantLabel: "A1 / สีทอง",
      size: "30x40",
      material: "อะคริลิค",
      unitPriceHint: 590,
      qty: 1,
      unit: "ชิ้น",
      image: "https://example.com/a.jpg",
    });
  });

  test("ไม่ระบุ qty → ดีฟอลต์เป็น 1", () => {
    addToCart({ productId: "p1", name: "สินค้า" });
    assert.equal(getCartItems()[0].qty, 1);
  });

  test("ระบุ qty เอง → ใช้ค่านั้น", () => {
    addToCart({ productId: "p1", name: "สินค้า" }, 3);
    assert.equal(getCartItems()[0].qty, 3);
  });

  test("qty เป็นเลขทศนิยม/สตริง/ค่าติดลบ/0 → ปัดเศษลง+อย่างน้อย 1 เสมอ", () => {
    addToCart({ productId: "p1" }, 2.9);
    assert.equal(getCartItems()[0].qty, 2);
    localStorage.clear();
    addToCart({ productId: "p2" }, "5");
    assert.equal(getCartItems()[0].qty, 5);
    localStorage.clear();
    addToCart({ productId: "p3" }, -4);
    assert.equal(getCartItems()[0].qty, 1);
    localStorage.clear();
    addToCart({ productId: "p4" }, 0);
    assert.equal(getCartItems()[0].qty, 1);
    localStorage.clear();
    addToCart({ productId: "p5" }, "abc");
    assert.equal(getCartItems()[0].qty, 1);
  });

  test("ฟิลด์ optional ที่ไม่ระบุ → fallback เป็นค่าว่าง/null", () => {
    addToCart({ productId: "p1" });
    const it = getCartItems()[0];
    assert.equal(it.name, "");
    assert.equal(it.variantLabel, "");
    assert.equal(it.size, "");
    assert.equal(it.material, "");
    assert.equal(it.unitPriceHint, null);
    assert.equal(it.unit, "");
    assert.equal(it.image, "");
  });

  test("productId เดียวกัน + variantLabel เดียวกัน → บวก qty รวมกันในแถวเดิม ไม่สร้างแถวใหม่", () => {
    addToCart({ productId: "p1", name: "สินค้า A", variantLabel: "S" }, 2);
    addToCart({ productId: "p1", name: "สินค้า A", variantLabel: "S" }, 3);
    const items = getCartItems();
    assert.equal(items.length, 1);
    assert.equal(items[0].qty, 5);
  });

  test("productId เดียวกัน แต่ variantLabel ต่างกัน → แยกเป็นคนละแถว", () => {
    addToCart({ productId: "p1", name: "สินค้า A", variantLabel: "S" }, 1);
    addToCart({ productId: "p1", name: "สินค้า A", variantLabel: "M" }, 1);
    const items = getCartItems();
    assert.equal(items.length, 2);
  });

  test("productId ต่างกัน variantLabel เหมือนกัน → แยกเป็นคนละแถว", () => {
    addToCart({ productId: "p1", variantLabel: "S" }, 1);
    addToCart({ productId: "p2", variantLabel: "S" }, 1);
    assert.equal(getCartItems().length, 2);
  });

  test("productId เป็นตัวเลข → ถูกแปลงเป็นสตริงเก็บไว้ (เทียบ key ตรงกับสตริงได้)", () => {
    addToCart({ productId: 42 }, 1);
    addToCart({ productId: "42" }, 1);
    const items = getCartItems();
    assert.equal(items.length, 1);
    assert.equal(items[0].qty, 2);
    assert.equal(items[0].productId, "42");
  });

  test("unitPriceHint เป็น 0 → เก็บ 0 จริง ไม่ fallback เป็น null", () => {
    addToCart({ productId: "p1", unitPriceHint: 0 });
    assert.equal(getCartItems()[0].unitPriceHint, 0);
  });
});

describe("updateCartItemQty()", () => {
  beforeEach(() => {
    addToCart({ productId: "p1", name: "A", variantLabel: "S" }, 2);
    addToCart({ productId: "p1", name: "A", variantLabel: "M" }, 3);
  });

  test("ตั้งค่า qty ใหม่ตรงๆ (ไม่ใช่บวกเพิ่มแบบ addToCart)", () => {
    updateCartItemQty("p1", "S", 9);
    assert.equal(getCartItems().find((it) => it.variantLabel === "S").qty, 9);
    assert.equal(getCartItems().find((it) => it.variantLabel === "M").qty, 3);
  });

  test("qty <= 0 → ลบรายการนั้นทิ้งจากตะกร้า", () => {
    const result = updateCartItemQty("p1", "S", 0);
    assert.equal(result.length, 1);
    assert.equal(getCartItems().length, 1);
    assert.equal(getCartItems()[0].variantLabel, "M");
  });

  test("qty ติดลบ → ลบรายการทิ้งเช่นกัน", () => {
    updateCartItemQty("p1", "M", -1);
    assert.equal(getCartItems().length, 1);
    assert.equal(getCartItems()[0].variantLabel, "S");
  });

  test("key (productId+variantLabel) ที่ไม่พบในตะกร้า → ไม่ทำอะไร ไม่ throw", () => {
    const before = getCartItems();
    const result = updateCartItemQty("p-not-exist", "X", 5);
    assert.deepEqual(result, before);
    assert.deepEqual(getCartItems(), before);
  });

  test("qty เป็นทศนิยม → ปัดเศษลงก่อนเก็บ", () => {
    updateCartItemQty("p1", "S", 4.7);
    assert.equal(getCartItems().find((it) => it.variantLabel === "S").qty, 4);
  });
});

describe("removeFromCart()", () => {
  beforeEach(() => {
    addToCart({ productId: "p1", variantLabel: "S" }, 1);
    addToCart({ productId: "p1", variantLabel: "M" }, 1);
    addToCart({ productId: "p2", variantLabel: "" }, 1);
  });

  test("ลบรายการที่ระบุออกเท่านั้น รายการอื่นไม่กระทบ", () => {
    const result = removeFromCart("p1", "S");
    assert.equal(result.length, 2);
    assert.equal(getCartItems().length, 2);
    assert.ok(!getCartItems().some((it) => it.productId === "p1" && it.variantLabel === "S"));
    assert.ok(getCartItems().some((it) => it.productId === "p1" && it.variantLabel === "M"));
  });

  test("รายการที่ไม่มี variant (variantLabel ว่างเปล่า) ลบได้ปกติ", () => {
    removeFromCart("p2", "");
    assert.ok(!getCartItems().some((it) => it.productId === "p2"));
  });

  test("key ที่ไม่พบในตะกร้า → ไม่ทำอะไร ไม่ throw ไม่ลบผิดรายการ", () => {
    const before = getCartItems();
    const result = removeFromCart("p-not-exist", "X");
    assert.equal(result.length, before.length);
    assert.deepEqual(getCartItems(), before);
  });
});

describe("clearCart()", () => {
  test("ล้างตะกร้าทั้งหมด คืน [] และ localStorage ถูกล้างจริง", () => {
    addToCart({ productId: "p1" }, 2);
    addToCart({ productId: "p2" }, 1);
    const result = clearCart();
    assert.deepEqual(result, []);
    assert.deepEqual(getCartItems(), []);
    assert.equal(localStorage.getItem(CART_STORAGE_KEY), null);
  });

  test("เรียกตอนตะกร้าว่างอยู่แล้ว → ไม่ throw", () => {
    assert.deepEqual(clearCart(), []);
  });
});

describe("getCartCount()", () => {
  test("รวม qty ของทุกรายการ ไม่ใช่แค่จำนวนแถว", () => {
    addToCart({ productId: "p1" }, 2);
    addToCart({ productId: "p2" }, 5);
    assert.equal(getCartCount(), 7);
    assert.equal(getCartItems().length, 2);
  });

  test("ตะกร้าว่างเปล่า → 0", () => {
    assert.equal(getCartCount(), 0);
  });
});

describe("localStorage เขียนล้มเหลว (เช่น private mode/โควตาเต็ม) — ไม่ throw ออกไปนอกฟังก์ชัน", () => {
  test("setItem throw → addToCart ยังคืนอาร์เรย์ที่คำนวณไว้ ไม่ throw ออกมา (แค่ไม่ persist)", () => {
    const original = localStorage.setItem;
    localStorage.setItem = () => {
      throw new Error("QuotaExceededError จำลอง");
    };
    let result;
    assert.doesNotThrow(() => {
      result = addToCart({ productId: "p1" }, 1);
    });
    assert.equal(result.length, 1);
    localStorage.setItem = original;
  });

  test("getItem throw → getCartItems() คืน [] แทนที่จะ throw", () => {
    const original = localStorage.getItem;
    localStorage.getItem = () => {
      throw new Error("อ่านไม่ได้จำลอง");
    };
    assert.doesNotThrow(() => {
      assert.deepEqual(getCartItems(), []);
    });
    localStorage.getItem = original;
  });
});
