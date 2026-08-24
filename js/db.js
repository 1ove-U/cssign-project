// ===========================
// js/db.js — Firebase init + Auth + Staff accounts + Audit log
// ===========================
// แก้ไขค่าด้านล่างด้วยค่าจริงจาก Firebase
//
// 2026 refactor phase 4: ไฟล์นี้เดิมรวม CRUD ทุกโดเมนไว้ในไฟล์เดียว (589 บรรทัด) —
// "ลีด/คำสั่งผลิต/order tracking" (Production Console) ถูกแยกไปอยู่ js/db-orders.js
// ตั้งแต่รอบก่อนแล้ว รอบนี้แยก "เนื้อหาเว็บไซต์" ที่เหลือออกเพิ่มเติมตาม collection:
// groups/categories → js/db-taxonomy.js, products → js/db-products.js, การอัปโหลด/ลบรูป
// Cloudinary → js/db-media.js, portfolio/faqs → js/db-content.js,
// blog posts → js/db-blog.js, ตั้งค่าเว็บไซต์ (settings/main) → js/db-settings.js
// (ทุกไฟล์ import { db, auth } กลับมาใช้ instance เดียวกันจากที่นี่ — ดูรายละเอียด
// เหตุผลที่หัวไฟล์เหล่านั้น) ไฟล์นี้เหลือ: Firebase init (Firestore/Auth instance),
// Auth (login/logout/onAuthChange), Staff accounts & roles, Audit log — ไม่มีการเปลี่ยน
// logic ใดๆ จากของเดิม เป็นแค่ย้ายโค้ดเชิงโครงสร้าง (ดู diff เทียบกับ js/db.js ฉบับ
// ก่อนแตกไฟล์รอบนี้)

// ── Firebase Config ──────────────────────────────
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAqTzezesfOGXDXHPjAEGntXa5MlPdT-NU",
  authDomain: "cssign.firebaseapp.com",
  projectId: "cssign",
  storageBucket: "cssign.firebasestorage.app",
  messagingSenderId: "719473469014",
  appId: "1:719473469014:web:0a9b7f63222f82f43cbdf7",
  measurementId: "G-65XCSJ42KM"
};

// ─────────────────────────────────────────────────
import { initializeApp }                            from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { initializeFirestore, persistentLocalCache,
         persistentMultipleTabManager, collection, doc,
         getDoc, getDocs, addDoc,
         deleteDoc, orderBy, query, limit,
         setDoc,
         serverTimestamp }              from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword,
         signOut, onAuthStateChanged }              from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
// หมายเหตุ: onSnapshot/deleteField และ bucketMonthly/monthlyTopCategory/
// computeRepeatCustomerRate/linearForecast (จาก ./stats-trends.js) ถูกย้าย import ไปอยู่
// js/db-orders.js แล้ว เพราะใช้เฉพาะฝั่งลีด/คำสั่งผลิต (listenLeads/computeOrderStats/
// computeLeadStats) ที่ถูกแยกไปที่นั่น ไฟล์นี้ไม่ได้เรียกใช้ฟังก์ชันเหล่านี้แล้ว —
// updateDoc ก็ไม่ได้ใช้ในไฟล์นี้แล้วเช่นกัน (ฟังก์ชันที่เคยใช้ทั้งหมดถูกแยกไปไฟล์อื่นในรอบนี้)
// ไฟล์ config/utility ของ Cloudinary (CLOUDINARY_CLOUD_NAME/CLOUDINARY_UPLOAD_PRESET/
// CLOUDINARY_DELETE_WORKER_URL) ก็ย้ายไปอยู่ js/db-media.js แล้วเช่นกัน

const app = initializeApp(firebaseConfig);
/* Persistent local cache (IndexedDB): after the first successful visit,
   category/product data is read from the local cache immediately on
   every later page load — including full reloads from the header's
   ?cat= links — instead of waiting on a fresh Firestore connection
   each time. The SDK still syncs with the server in the background,
   so data stays up to date; only the *first-ever* visit in a browser
   pays the full cold-connection cost. */
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});
export const auth = getAuth(app);

// ===========================
// AUTH
// ===========================
export async function loginAdmin(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function logoutAdmin() {
  await signOut(auth);
}

export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}

// ===========================
// STAFF ACCOUNTS & ROLES (ฟรี ไม่ต้องผูกบัตร — ใช้ Firebase Auth + Firestore
// ที่มีอยู่แล้วบน Spark plan เดิม ไม่ต้องพึ่ง Cloud Functions/Admin SDK เลย)
// ===========================
// วิธีเพิ่มพนักงานคนใหม่ (ทำครั้งเดียวตอนตั้งค่า ไม่มีค่าใช้จ่าย):
//   1) Firebase Console > Authentication > Add user (กรอกอีเมล/รหัสผ่าน) — ไม่ต้องผูกบัตร
//   2) เอา UID ที่ได้มาใส่ในแท็บ "บัญชีผู้ใช้ทีมงาน" ในหน้าตั้งค่า (เรียก upsertStaffRole)
// staff/{uid} เก็บ role ของแต่ละคน ("admin" = แก้ไข/ลบได้ทุกอย่าง, "staff" = แก้ไขได้แต่ลบไม่ได้)
export async function listStaff() {
  const snap = await getDocs(collection(db, "staff"));
  return snap.docs.map(d => ({ uid: d.id, ...d.data() }));
}

// role: "admin" | "staff" | "production" — เฉพาะ admin เท่านั้นที่แก้ตรงนี้ได้ (บังคับจริงใน
// firestore.rules) — "production" (พนักงานหน้างานผลิต, เพิ่มรอบ P1.6a) ฝั่ง firestore.rules
// ยังนับเป็น "ไม่ใช่ admin" เหมือน "staff" ทุกประการ (แก้ไขได้แต่ลบไม่ได้) — ต่างกันแค่ฝั่ง UI
// เท่านั้น (ดู js/admin-role-ui.js) ไม่ต้องแก้ firestore.rules เพิ่มสำหรับ role นี้
export async function upsertStaffRole({ uid, email, name, role }) {
  await setDoc(doc(db, "staff", uid), {
    email: email || "",
    name: name || "",
    role: role === "admin" ? "admin" : role === "production" ? "production" : "staff",
    updatedAt: serverTimestamp()
  }, { merge: true });
}

export async function removeStaffRole(uid) {
  await deleteDoc(doc(db, "staff", uid));
}

// อ่าน role ของบัญชีที่ login อยู่เอง (เรียกครั้งเดียวหลัง login สำเร็จ — ดู js/admin-page.js
// onAuthChange) ใช้กรองมุมมองแท็บฝั่ง UI ตาม role (ดู js/admin-role-ui.js applyRoleUI())
// คืนค่า null ถ้ายังไม่มี doc staff/{uid} เลย (ตรงกับ staffRoleExists() ใน firestore.rules
// ที่ถือว่า "ไม่มี doc นี้เลย" = admin ไปก่อน กันบัญชีเดิมถูกล็อกออกจากของตัวเอง)
export async function getMyStaffRole(uid) {
  const snap = await getDoc(doc(db, "staff", uid));
  return snap.exists() ? (snap.data().role || null) : null;
}

// ===========================
// AUDIT LOG — "ใคร แก้/ลบอะไร เมื่อไหร่" เก็บใน collection แยก ไม่ปนกับข้อมูลจริง
// ===========================
// เรียกใช้จากทุกจุดที่แก้ไข/ลบข้อมูลสำคัญ (ดูตัวอย่างการเรียกใน admin-page.js)
// ล้มเหลวได้โดยไม่กระทบการทำงานหลัก (แค่ log ไว้ใน console) เพราะการบันทึกสถิติ
// ไม่ควรทำให้แอดมินลบ/แก้ไขข้อมูลจริงไม่สำเร็จ
export async function logAudit(action, targetType, targetId, meta) {
  try {
    const user = auth.currentUser;
    if (!user) return;
    await addDoc(collection(db, "auditLog"), {
      uid: user.uid,
      email: user.email || "",
      action:     String(action || ""),
      targetType: String(targetType || ""),
      targetId:   String(targetId || ""),
      meta:       meta ? String(meta).slice(0, 500) : "",
      createdAt: serverTimestamp()
    });
  } catch (err) {
    console.warn("[db] logAudit: บันทึก audit log ไม่สำเร็จ (ไม่กระทบการทำงานหลัก)", err);
  }
}

// อ่าน log ล่าสุด (ค่าเริ่มต้น 200 รายการ) — สำหรับแท็บ "ประวัติการทำงาน" ในหน้าตั้งค่า
export async function listAuditLog(maxCount = 200) {
  const q = query(collection(db, "auditLog"), orderBy("createdAt", "desc"), limit(maxCount));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// รายได้รายเดือนย้อนหลัง N เดือน (ค่าเริ่มต้น 6) — ใช้กับกราฟเส้นในแท็บภาพรวม
// แยกจาก computeOrderStats() เพราะ overview เรียกจาก getAllOrders() (orders-tab.js)
// ไม่ผ่าน console/orders-tab render loop โดยตรง
export function computeMonthlyRevenue(orders, months = 6) {
  const now = new Date();
  const orderAmount = (o) => (Number(o.unit_price) || 0) * (Number(o.qty) || 0);
  const orderMillis = (o) => o.createdAt ? (o.createdAt.toMillis ? o.createdAt.toMillis() : o.createdAt) : null;
  const result = [];
  for (let i = months - 1; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end   = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const total = orders.reduce((sum, o) => {
      if (o.status === "cancelled") return sum;
      const t = orderMillis(o);
      if (t == null || t < start.getTime() || t >= end.getTime()) return sum;
      return sum + orderAmount(o);
    }, 0);
    result.push({ label: start.toLocaleDateString("th-TH", { month: "short", year: "2-digit" }), total });
  }
  return result;
}

// แปลง audit log rows เป็น CSV string (สำหรับปุ่ม "ส่งออก CSV" ในหน้าตั้งค่า)
export function auditLogToCSV(rows) {
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const header = ["เวลา", "อีเมล", "การกระทำ", "ประเภทข้อมูล", "รหัสรายการ", "หมายเหตุ"];
  const lines = [header.map(esc).join(",")];
  rows.forEach(r => {
    const t = r.createdAt ? (r.createdAt.toMillis ? new Date(r.createdAt.toMillis()) : new Date(r.createdAt)) : null;
    const timeStr = t && !isNaN(t.getTime()) ? t.toLocaleString("th-TH") : "";
    lines.push([timeStr, r.email || r.uid || "", r.action, r.targetType, r.targetId, r.meta].map(esc).join(","));
  });
  return lines.join("\r\n");
}
