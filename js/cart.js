// js/cart.js — P3.0 Phase 1 รอบย่อย 1: cart data layer
//
// เก็บตะกร้าสินค้าไว้ใน localStorage ล้วนๆ (ไม่แตะ Firestore เลย) เพื่อไม่กิน quota จนกว่าลูกค้า
// จะกดส่งคำขอใบเสนอราคาจริงใน Phase 2 — ตาม continue-prompt-p3.0-phase1.md ข้อ "รอบย่อย 1"
//
// รูปแบบข้อมูลต่อรายการ: { productId, name, variantLabel, size, material, unitPriceHint, qty,
// unit, image } — unitPriceHint คือราคาที่โชว์อยู่ในหน้าสินค้า ณ ตอนหยิบใส่ตะกร้าเท่านั้น
// **ไม่ใช่ราคาทางการ** ราคาจริงต้องรอแอดมินออกใบเสนอราคาใน Phase 3 (ดู
// p3.0-quotation-cart-plan.md หัวข้อ "จุดที่ตัดสินใจแล้ว")
//
// รายการแต่ละใบระบุตัวตนด้วยคู่ (productId, variantLabel) — สินค้าเดียวกันแต่คนละตัวเลือก
// (variant) นับเป็นรายการแยกกันในตะกร้าเสมอ

export const CART_STORAGE_KEY = "cssign_cart_v1";

function safeParseArray(json) {
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readCartRaw() {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    return safeParseArray(raw);
  } catch (err) {
    console.warn("อ่านตะกร้าสินค้าไม่สำเร็จ:", err);
    return [];
  }
}

function writeCartRaw(items) {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    return true;
  } catch (err) {
    // เช่น private browsing บางเบราว์เซอร์/localStorage เต็มโควตา — ไม่ throw ต่อ ให้ UI
    // ทำงานต่อได้ปกติในหน่วยความจำของรอบโหลดหน้านั้น แค่ไม่ persist ข้ามการโหลดหน้าถัดไป
    console.warn("บันทึกตะกร้าสินค้าไม่สำเร็จ:", err);
    return false;
  }
}

function cartItemKey(productId, variantLabel) {
  return `${productId || ""}::${variantLabel || ""}`;
}

/** คืนรายการทั้งหมดในตะกร้า (array ใหม่ทุกครั้ง ไม่ใช่ reference เดียวกับที่เก็บใน localStorage) */
export function getCartItems() {
  return readCartRaw();
}

/** จำนวนรวมทุกรายการ (ผลรวม qty) ใช้แสดง badge บนไอคอนตะกร้า */
export function getCartCount() {
  return readCartRaw().reduce((sum, it) => sum + (Number(it.qty) || 0), 0);
}

/**
 * เพิ่มสินค้าลงตะกร้า — ถ้ามีรายการที่ productId+variantLabel ตรงกันอยู่แล้ว จะบวก qty เพิ่ม
 * เข้าไปในรายการเดิม (ไม่สร้างแถวซ้ำ) ไม่งั้นเพิ่มเป็นรายการใหม่
 * คืนอาร์เรย์ล่าสุดของตะกร้าเสมอ (แม้ productId ขาดหายจะคืนตะกร้าเดิมไม่เปลี่ยนแปลง)
 */
export function addToCart(item, qty = 1) {
  const items = readCartRaw();
  const productId = item && item.productId != null ? String(item.productId) : "";
  if (!productId) {
    console.warn("addToCart: ไม่มี productId ข้ามการเพิ่มลงตะกร้า");
    return items;
  }
  const addQty = Math.max(1, Math.floor(Number(qty) || 1));
  const variantLabel = (item.variantLabel || "").toString();
  const key = cartItemKey(productId, variantLabel);
  const existing = items.find((it) => cartItemKey(it.productId, it.variantLabel) === key);

  if (existing) {
    existing.qty = (Number(existing.qty) || 0) + addQty;
  } else {
    items.push({
      productId,
      name: item.name || "",
      variantLabel,
      size: item.size || "",
      material: item.material || "",
      unitPriceHint: item.unitPriceHint != null ? item.unitPriceHint : null,
      qty: addQty,
      unit: item.unit || "",
      image: item.image || "",
    });
  }

  writeCartRaw(items);
  return items;
}

/**
 * ตั้งจำนวนของรายการ (ระบุด้วย productId+variantLabel) ตรงๆ — qty <= 0 เท่ากับลบรายการทิ้ง
 * (ไม่บวกเพิ่มแบบ addToCart) รายการที่ไม่พบใน key ที่ระบุจะไม่ทำอะไรเลย
 */
export function updateCartItemQty(productId, variantLabel, qty) {
  const items = readCartRaw();
  const key = cartItemKey(productId, variantLabel);
  const nextQty = Math.floor(Number(qty) || 0);

  if (nextQty <= 0) {
    const filtered = items.filter((it) => cartItemKey(it.productId, it.variantLabel) !== key);
    writeCartRaw(filtered);
    return filtered;
  }

  const found = items.find((it) => cartItemKey(it.productId, it.variantLabel) === key);
  if (found) {
    found.qty = nextQty;
    writeCartRaw(items);
  }
  return items;
}

/** ลบรายการเดียวออกจากตะกร้า (ระบุด้วย productId+variantLabel) */
export function removeFromCart(productId, variantLabel) {
  const items = readCartRaw();
  const key = cartItemKey(productId, variantLabel);
  const filtered = items.filter((it) => cartItemKey(it.productId, it.variantLabel) !== key);
  writeCartRaw(filtered);
  return filtered;
}

/** ล้างตะกร้าทั้งหมด (เช่น หลังส่งคำขอใบเสนอราคาสำเร็จใน Phase 2) */
export function clearCart() {
  try {
    localStorage.removeItem(CART_STORAGE_KEY);
  } catch (err) {
    console.warn("ล้างตะกร้าสินค้าไม่สำเร็จ:", err);
  }
  return [];
}
