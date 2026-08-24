// ===========================
// js/db-content.js — Data layer: Portfolio / FAQs
// ===========================
// 2026 refactor phase 4: แยกออกมาจาก js/db.js เดิม (589 บรรทัด) — ดูหมายเหตุเต็มใน
// js/db.js ไฟล์นี้เก็บ collection เนื้อหาเว็บไซต์ขนาดเล็กที่มีรูปแบบ CRUD
// เหมือนกัน (ก็อป field ล้วนๆ ไม่มี query ซับซ้อน, sort ฝั่ง client ด้วย createdAt) และ
// ถูกใช้ประกอบกันใน home-dynamic.js/admin-page.js อยู่แล้ว: PORTFOLIO (ผลงานรับทำป้าย),
// FAQS (คำถามที่พบบ่อย) —
// ไม่มีการเปลี่ยน logic ใดๆ จากของเดิม เป็นแค่ย้ายโค้ดเชิงโครงสร้าง (ดู diff เทียบกับ
// js/db.js ฉบับก่อนแตกไฟล์)
//
// 2026 refactor: ลบ PARTNERS CRUD (โลโก้ลูกค้า) และ TESTIMONIALS CRUD (รีวิวลูกค้า) ออก
// ทั้งคู่ตามคำขอลบฟีเจอร์ "โลโก้ลูกค้า/รีวิวลูกค้า/ประสบการณ์ร่วมงานกับธุรกิจชั้นนำ" — ไฟล์ที่
// เคยเรียกใช้ getPartners()/getTestimonials() ได้รับการแก้ไขให้เอาการเรียกใช้ออกแล้วเช่นกัน
//
// เหตุผลที่ยังต้อง import { db } กลับจาก js/db.js: Firestore instance ต้องถูก
// initializeFirestore() แค่ครั้งเดียวต่อแอป (ทำใน js/db.js) ไฟล์นี้จึงใช้ instance
// เดียวกันแทนที่จะสร้างใหม่ซ้ำ — ไม่ใช่ circular import (js/db.js ไม่ import อะไรกลับจากไฟล์นี้)
// ===========================
import { collection, doc, getDocs, addDoc,
         updateDoc, deleteDoc }              from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { db } from "./db.js";

// ===========================
// PORTFOLIO CRUD (ผลงานรับทำป้าย)
// ===========================
export async function getPortfolios() {
  const snap = await getDocs(collection(db, "portfolios"));
  return snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b)=>(a.createdAt||0)-(b.createdAt||0));
}

export async function savePortfolio(item) {
  const payload = {
    title:       item.title,
    category:    item.category || "",
    client:      item.client || "",
    description: item.description || "",
    tags:        item.tags || [],
    images:      item.images || [],
    pinned:      !!item.pinned,
    order:       Number.isFinite(item.order) ? item.order : 0
  };
  if (item.id) {
    await updateDoc(doc(db, "portfolios", item.id), payload);
  } else {
    await addDoc(collection(db, "portfolios"), { ...payload, createdAt: Date.now() });
  }
}

export async function deletePortfolio(id) {
  await deleteDoc(doc(db, "portfolios", id));
}

// ===========================
// FAQS CRUD (คำถามที่พบบ่อย)
// ===========================
export async function getFaqs() {
  const snap = await getDocs(collection(db, "faqs"));
  return snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b)=>(a.createdAt||0)-(b.createdAt||0));
}

export async function saveFaq(item) {
  const payload = {
    question: item.question,
    answer:   item.answer
  };
  if (item.id) {
    await updateDoc(doc(db, "faqs", item.id), payload);
  } else {
    await addDoc(collection(db, "faqs"), { ...payload, createdAt: Date.now() });
  }
}

export async function deleteFaq(id) {
  await deleteDoc(doc(db, "faqs", id));
}
