// ===========================
// js/db-blog.js — Data layer: Blog posts (บทความหน้า blog.html)
// ===========================
// 2026 refactor phase 4: แยกออกมาจาก js/db.js เดิม (589 บรรทัด) — ดูหมายเหตุเต็มใน
// js/db.js ไฟล์นี้เก็บเฉพาะ BLOG POSTS CRUD — ไม่มีการเปลี่ยน logic ใดๆ จากของเดิม เป็นแค่
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
// BLOG POSTS CRUD (บทความหน้า blog.html)
// ===========================
export async function getBlogs() {
  const q = query(collection(db, "blogs"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getBlogBySlug(slug) {
  const posts = await getBlogs();
  return posts.find(p => p.slug === slug) || null;
}

export async function saveBlog(item) {
  const payload = {
    title:     item.title,
    slug:      item.slug,
    excerpt:   item.excerpt || "",
    content:   item.content || "",
    image:     item.image || "",
    category:  item.category || "",
    author:    item.author || "ทีมงาน CS.SIGN",
    status:    item.status || "published",   // "published" | "draft"
    featured:  !!item.featured,
    // เดิม 2 ฟิลด์นี้ถูกกรอกในฟอร์มแอดมินแต่ไม่เคยถูกใส่ใน payload ที่ยิงเข้า Firestore จริง
    // (เหมือนบั๊กเดียวกับ saveProduct() ใน db-products.js) — เพิ่มกลับเข้ามาตรงนี้
    metaTitle:       item.metaTitle || "",
    metaDescription: item.metaDescription || ""
  };
  if (item.id) {
    await updateDoc(doc(db, "blogs", item.id), { ...payload, updatedAt: Date.now() });
  } else {
    await addDoc(collection(db, "blogs"), { ...payload, createdAt: Date.now(), updatedAt: Date.now() });
  }
}

export async function deleteBlog(id) {
  await deleteDoc(doc(db, "blogs", id));
}
