// ===========================
// js/db-products.js — Data layer: Products (สินค้า/ป้าย)
// ===========================
// 2026 refactor phase 4: แยกออกมาจาก js/db.js เดิม (589 บรรทัด) — ดูหมายเหตุเต็มใน
// js/db.js ไฟล์นี้เก็บเฉพาะ PRODUCTS CRUD — ไม่มีการเปลี่ยน logic ใดๆ จากของเดิม เป็นแค่
// ย้ายโค้ดเชิงโครงสร้าง (ดู diff เทียบกับ js/db.js ฉบับก่อนแตกไฟล์)
//
// เหตุผลที่ยังต้อง import { db } กลับจาก js/db.js: Firestore instance ต้องถูก
// initializeFirestore() แค่ครั้งเดียวต่อแอป (ทำใน js/db.js) ไฟล์นี้จึงใช้ instance
// เดียวกันแทนที่จะสร้างใหม่ซ้ำ — ไม่ใช่ circular import (js/db.js ไม่ import อะไรกลับจากไฟล์นี้)
// ===========================
import { collection, doc, getDocs, addDoc, updateDoc,
         deleteDoc, orderBy, query }              from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { db } from "./db.js";

// ===========================
// PRODUCTS CRUD
// ===========================
export async function getProducts() {
  const q = query(collection(db, "products"), orderBy("createdAt"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getProductBySlug(slug) {
  const products = await getProducts();
  return products.find(p => p.slug === slug) || null;
}

export async function saveProduct(product) {
  const payload = {
    code:        product.code || "",
    cat_id:      product.cat_id,
    name:        product.name,
    price:       product.price,
    unit:        product.unit,
    description: product.description,
    material:    product.material || "",
    size:        product.size || "",
    // ตัวเลือกสินค้าแบบกำหนดเอง (เช่น ชนิดของป้าย / ชนิดของแผ่นรองหลัง / ขนาดของป้าย)
    // optionAxes = นิยามหมวดตัวเลือกแต่ละแกน, variants = ราคาของทุกชุดค่าผสมที่เกิดจากแกนเหล่านั้น
    // product.price ที่ส่งเข้ามาถูกคำนวณเป็น "ราคาต่ำสุดในตัวเลือกทั้งหมด" แล้วจากฝั่งแอดมิน
    // (ดู recomputeVariantPrice() ใน admin-page.js) จึงบันทึกตรงๆ ตรงนี้โดยไม่ต้องคำนวณซ้ำ
    optionAxes:  product.optionAxes || [],
    variants:    product.variants || [],
    tags:        product.tags || [],
    status:      product.status,
    featured:    product.featured,
    images:      product.images || [],
    // เดิม 3 ฟิลด์นี้ถูกกรอกในฟอร์มแอดมินแต่ไม่เคยถูกใส่ใน payload ที่ยิงเข้า Firestore จริง
    // (ค่าที่แอดมินกรอกไว้จึงหายเงียบๆ ทุกครั้งที่บันทึก) — เพิ่มกลับเข้ามาตรงนี้
    slug:            product.slug || "",
    metaTitle:       product.metaTitle || "",
    metaDescription: product.metaDescription || ""
  };
  if (product.id) {
    await updateDoc(doc(db, "products", product.id), payload);
  } else {
    await addDoc(collection(db, "products"), { ...payload, createdAt: Date.now() });
  }
}

export async function deleteProduct(id) {
  await deleteDoc(doc(db, "products", id));
}
