// ===========================
// js/db-settings.js — Data layer: Settings (เอกสารตั้งค่าเว็บไซต์ตัวเดียว "main")
// ===========================
// 2026 refactor phase 4: แยกออกมาจาก js/db.js เดิม (589 บรรทัด) — ดูหมายเหตุเต็มใน
// js/db.js ไฟล์นี้เก็บเฉพาะ getSettings()/saveSettings() — ไม่มีการเปลี่ยน logic ใดๆ
// จากของเดิม เป็นแค่ย้ายโค้ดเชิงโครงสร้าง (ดู diff เทียบกับ js/db.js ฉบับก่อนแตกไฟล์)
//
// เหตุผลที่ยังต้อง import { db } กลับจาก js/db.js: Firestore instance ต้องถูก
// initializeFirestore() แค่ครั้งเดียวต่อแอป (ทำใน js/db.js) ไฟล์นี้จึงใช้ instance
// เดียวกันแทนที่จะสร้างใหม่ซ้ำ — ไม่ใช่ circular import (js/db.js ไม่ import อะไรกลับจากไฟล์นี้)
// ===========================
import { doc, getDoc, setDoc }              from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { db } from "./db.js";

// ===========================
// SETTINGS
// ===========================
export async function getSettings() {
  const ref = doc(db, "settings", "main");
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

export async function saveSettings(settings) {
  await setDoc(doc(db, "settings", "main"), settings, { merge: true });
}
