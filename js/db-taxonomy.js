// ===========================
// js/db-taxonomy.js — Data layer: Groups (หัวข้อหมวดหมู่ใหญ่) + Categories
// ===========================
// 2026 refactor phase 4: แยกออกมาจาก js/db.js เดิม (589 บรรทัด) — ดูหมายเหตุเต็มใน
// js/db.js ไฟล์นี้เก็บเฉพาะ GROUPS CRUD (รวม migrateLegacyGroups) และ CATEGORIES CRUD
// อยู่ไฟล์เดียวกันเพราะทั้งสอง collection ผูกกันโดยตรง (category.group_id ชี้ไปที่
// groups doc, migrateLegacyGroups() ก็แก้ทั้งสอง collection พร้อมกัน) และไฟล์ที่ใช้งาน
// จริงส่วนใหญ่ (products.js/nav-menu.js/admin-page.js) import ทั้งคู่พร้อมกันเสมอ —
// ไม่มีการเปลี่ยน logic ใดๆ จากของเดิม เป็นแค่ย้ายโค้ดเชิงโครงสร้าง (ดู diff เทียบกับ
// js/db.js ฉบับก่อนแตกไฟล์)
//
// เหตุผลที่ยังต้อง import { db } กลับจาก js/db.js: Firestore instance ต้องถูก
// initializeFirestore() แค่ครั้งเดียวต่อแอป (ทำใน js/db.js) ไฟล์นี้จึงใช้ instance
// เดียวกันแทนที่จะสร้างใหม่ซ้ำ — ไม่ใช่ circular import (js/db.js ไม่ import อะไรกลับจากไฟล์นี้)
// ===========================
import { collection, doc, getDocs, addDoc, updateDoc,
         deleteDoc, orderBy, query }              from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { db } from "./db.js";

// ===========================
// GROUPS CRUD (หมวดหมู่ใหญ่ — admin only)
// ===========================
export async function getGroups() {
  const q = query(collection(db, "groups"), orderBy("order"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function saveGroup(group) {
  const payload = {
    name:  group.name,
    icon:  group.icon || "",
    order: group.order ?? Date.now()
  };
  if (group.id) {
    await updateDoc(doc(db, "groups", group.id), payload);
  } else {
    await addDoc(collection(db, "groups"), { ...payload, createdAt: Date.now() });
  }
}

export async function deleteGroup(id) {
  await deleteDoc(doc(db, "groups", id));
}

// ย้ายข้อมูลเดิม: "หัวข้อหมวดหมู่" ที่เคยเป็น text ล้วน (category.group) → เอกสารจริง
// ใน collection "groups" แล้วผูกกลับด้วย category.group_id — เรียกจากแอดมินตอนโหลด
// แท็บหมวดหมู่ครั้งแรกในแต่ละเซสชัน ทำงานซ้ำได้อย่างปลอดภัย (idempotent) เพราะข้าม
// หมวดหมู่ที่มี group_id อยู่แล้วเสมอ และรวมชื่อหัวข้อที่สะกดตรงกันเป๊ะเป็นกลุ่มเดียว
export async function migrateLegacyGroups(categories, groups) {
  const byName = new Map(groups.map(g => [(g.name || "").trim(), g]));
  const pending = categories.filter(c => !c.group_id && (c.group || "").trim());
  if (!pending.length) return { migrated: 0, groups };

  const nextGroups = groups.slice();
  let nextOrder = nextGroups.length;
  for (const cat of pending) {
    const name = cat.group.trim();
    let g = byName.get(name);
    if (!g) {
      const order = nextOrder++;
      const ref = await addDoc(collection(db, "groups"), {
        name, icon: "", order, createdAt: Date.now()
      });
      g = { id: ref.id, name, icon: "", order };
      byName.set(name, g);
      nextGroups.push(g);
    }
    await updateDoc(doc(db, "categories", cat.id), { group_id: g.id });
    cat.group_id = g.id;
  }
  return { migrated: pending.length, groups: nextGroups };
}

// ===========================
// CATEGORIES CRUD (admin only)
// ===========================
export async function getCategories() {
  const q = query(collection(db, "categories"), orderBy("createdAt"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function saveCategory(cat) {
  const payload = {
    name: cat.name, icon: cat.icon, description: cat.description,
    group_id: cat.group_id || "",
    // ชื่อหัวข้อหมวดหมู่ที่ก็อปมาจาก groups doc ที่เลือก — เก็บซ้ำ (denormalized) ไว้
    // เพื่อให้ nav-menu.js (เมกะเมนู) ยังจัดคอลัมน์ได้เหมือนเดิมโดยไม่ต้องแก้ไฟล์นั้น
    group: cat.group || ""
  };
  if (cat.id) {
    await updateDoc(doc(db, "categories", cat.id), payload);
  } else {
    await addDoc(collection(db, "categories"), { ...payload, createdAt: Date.now() });
  }
}

export async function deleteCategory(id) {
  await deleteDoc(doc(db, "categories", id));
}
