// ===========================
// js/db.js — Firebase + Cloudinary + Auth
// ===========================
// แก้ไขค่าด้านล่างด้วยค่าจริงจาก Firebase และ Cloudinary

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

// ── Cloudinary Config ─────────────────────────────
const CLOUDINARY_CLOUD_NAME   = "dizd3payw";
const CLOUDINARY_UPLOAD_PRESET = "paisign_unsigned";

// ─────────────────────────────────────────────────
import { initializeApp }                            from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { initializeFirestore, persistentLocalCache,
         persistentMultipleTabManager, collection, doc,
         getDocs, addDoc, updateDoc,
         deleteDoc, orderBy, query, limit,
         getDoc, setDoc, onSnapshot,
         serverTimestamp, Timestamp }                from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword,
         signOut, onAuthStateChanged }              from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// URL ของ Cloudflare Worker ที่ลบรูปบน Cloudinary จริง (ดู cloudflare-worker/README.md)
// ต้องแก้เป็น URL จริงหลัง deploy Worker แล้ว
const CLOUDINARY_DELETE_WORKER_URL = "https://cssign-cloudinary-delete.zillergotspw.workers.dev";

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
export async function getStaffProfile(uid) {
  if (!uid) return null;
  const snap = await getDoc(doc(db, "staff", uid));
  return snap.exists() ? { uid: snap.id, ...snap.data() } : null;
}

export async function listStaff() {
  const snap = await getDocs(collection(db, "staff"));
  return snap.docs.map(d => ({ uid: d.id, ...d.data() }));
}

// role: "admin" | "staff" — เฉพาะ admin เท่านั้นที่แก้ตรงนี้ได้ (บังคับจริงใน firestore.rules)
export async function upsertStaffRole({ uid, email, name, role }) {
  await setDoc(doc(db, "staff", uid), {
    email: email || "",
    name: name || "",
    role: role === "admin" ? "admin" : "staff",
    updatedAt: serverTimestamp()
  }, { merge: true });
}

export async function removeStaffRole(uid) {
  await deleteDoc(doc(db, "staff", uid));
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

// ===========================
// PARTNERS CRUD (admin only) — ลูกค้าและพันธมิตรของเรา
// ===========================
export async function getPartners() {
  const snap = await getDocs(collection(db, "partners"));
  return snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b)=>(a.createdAt||0)-(b.createdAt||0));
}

export async function savePartner(partner) {
  const payload = {
    name: partner.name,
    logo: partner.logo || ""
  };
  if (partner.id) {
    await updateDoc(doc(db, "partners", partner.id), payload);
  } else {
    await addDoc(collection(db, "partners"), { ...payload, createdAt: Date.now() });
  }
}

export async function deletePartner(id) {
  await deleteDoc(doc(db, "partners", id));
}

// ย่อ/บีบอัดรูปฝั่ง browser ก่อนอัปโหลด — ลดเวลาอัปโหลดและประหยัด bandwidth
// โดยเฉพาะรูปที่ถ่ายจากมือถือซึ่งมักมีขนาดไฟล์หลาย MB
async function compressImage(file, maxDim = 1600, quality = 0.82) {
  if (!file.type || !file.type.startsWith("image/") || file.type === "image/svg+xml") return file;
  try {
    const bitmap = await createImageBitmap(file);
    let { width, height } = bitmap;
    if (width <= maxDim && height <= maxDim && file.size < 600 * 1024) {
      bitmap.close && bitmap.close();
      return file; // ไฟล์เล็กพออยู่แล้ว ไม่ต้องบีบซ้ำ
    }
    const scale = Math.min(1, maxDim / Math.max(width, height));
    const targetW = Math.round(width * scale);
    const targetH = Math.round(height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bitmap, 0, 0, targetW, targetH);
    bitmap.close && bitmap.close();
    const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", quality));
    if (!blob) return file;
    return new File([blob], (file.name || "image").replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch (err) {
    console.warn("compressImage: ข้ามการบีบอัด ใช้ไฟล์ต้นฉบับแทน", err);
    return file;
  }
}

// ===========================
// CLOUDINARY — อัปโหลดรูปภาพ
// ===========================
export async function uploadImage(file) {
  const optimized = await compressImage(file);
  const formData = new FormData();
  formData.append("file", optimized);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  formData.append("folder", "paisign/products");

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
    { method: "POST", body: formData }
  );
  if (!res.ok) throw new Error("อัปโหลดรูปไม่สำเร็จ");
  const data = await res.json();
  return data.secure_url.replace("/upload/", "/upload/f_auto,q_auto,w_900,h_900,c_limit/");
}

// อัปโหลดไฟล์ทั่วไป (เช่น PDF แคตตาล็อก) — ใช้ resource_type "auto"
// หมายเหตุ: Cloudinary unsigned upload preset ต้องเปิดรับไฟล์ประเภท raw/pdf ไว้ด้วย
// (ตั้งค่าได้ที่ Cloudinary Console → Settings → Upload → แก้ preset ที่ใช้อยู่)
export async function uploadFile(file, folder = "paisign/files") {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  formData.append("folder", folder);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`,
    { method: "POST", body: formData }
  );
  if (!res.ok) throw new Error("อัปโหลดไฟล์ไม่สำเร็จ (เช็คว่า Cloudinary preset เปิดรับไฟล์ประเภทนี้หรือยัง)");
  const data = await res.json();
  return data.secure_url;
}

// แกะ resource_type + public_id จาก URL ของ Cloudinary เพื่อส่งไปให้ Cloud Function ลบจริง
// รองรับทั้ง URL ธรรมดา และ URL ที่มี transformation อยู่ก่อน public_id
// (เช่น uploadImage() ข้างบนจะแทรก "f_auto,q_auto,w_900,h_900,c_limit" ไว้หลัง /upload/)
//   ตัวอย่าง: https://res.cloudinary.com/xxx/image/upload/f_auto,q_auto/v123/paisign/products/abc.jpg
//   → { resourceType: "image", publicId: "paisign/products/abc" }
function parseCloudinaryUrl(url) {
  const m = typeof url === "string" && url.match(/\/(image|video|raw)\/upload\/(.+)$/);
  if (!m) return null;
  const resourceType = m[1];
  const segments = m[2].split("?")[0].split("/");
  // ตัด segment transformation (เช่น "f_auto,q_auto,w_900") และ segment เวอร์ชัน
  // (เช่น "v1699999999") ทิ้งไปเรื่อยๆ จนกว่าจะเจอ segment แรกของ public_id จริง
  while (
    segments.length &&
    (/^v\d+$/.test(segments[0]) || /^[a-z]{1,3}_[^/]+$/.test(segments[0]))
  ) {
    segments.shift();
  }
  const publicIdWithExt = segments.join("/");
  if (!publicIdWithExt) return null;
  const lastDot = publicIdWithExt.lastIndexOf(".");
  const publicId = lastDot === -1 ? publicIdWithExt : publicIdWithExt.slice(0, lastDot);
  return { resourceType, publicId };
}

export async function deleteImage(url) {
  const parsed = parseCloudinaryUrl(url);
  if (!parsed) {
    console.warn("deleteImage: อ่านข้อมูลจาก Cloudinary URL ไม่ได้ ข้ามการลบ", url);
    return;
  }
  if (!auth.currentUser) {
    console.warn("deleteImage: ต้อง login ก่อนถึงจะลบรูปได้ ข้ามการลบ", url);
    return;
  }

  const idToken = await auth.currentUser.getIdToken();
  const res = await fetch(CLOUDINARY_DELETE_WORKER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(parsed),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`ลบรูปบน Cloudinary ไม่สำเร็จ: ${data.error || res.status}`);
  }
  return data;
}

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
// TESTIMONIALS CRUD (เสียงจากลูกค้า)
// ===========================
export async function getTestimonials() {
  const snap = await getDocs(collection(db, "testimonials"));
  return snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b)=>(a.createdAt||0)-(b.createdAt||0));
}

export async function saveTestimonial(item) {
  const payload = {
    company:  item.company,
    name:     item.name,
    role:     item.role || "",
    quote:    item.quote,
    stars:    item.stars || 5,
    logo:     item.logo || ""
  };
  if (item.id) {
    await updateDoc(doc(db, "testimonials", item.id), payload);
  } else {
    await addDoc(collection(db, "testimonials"), { ...payload, createdAt: Date.now() });
  }
}

export async function deleteTestimonial(id) {
  await deleteDoc(doc(db, "testimonials", id));
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
    // (เหมือนบั๊กเดียวกับ saveProduct() ด้านบน) — เพิ่มกลับเข้ามาตรงนี้
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

// ===========================
// LEADS — คำขอใบเสนอราคา / ติดต่อจากลูกค้า (อ่าน/จัดการฝั่งแอดมิน)
// บันทึก (create) ทำผ่าน js/leads.js แยกต่างหาก เพราะใช้ได้แม้ยังไม่ login
// ===========================
export function listenLeads(callback, onError) {
  const q = query(collection(db, "leads"), orderBy("createdAt", "desc"));
  return onSnapshot(
    q,
    snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    err => { if (onError) onError(err); else console.error("listenLeads error:", err); }
  );
}

export async function getLeads() {
  const q = query(collection(db, "leads"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// rule ฝั่ง Firestore อนุญาตให้ update ได้แค่ field "status"/"notes" เท่านั้น
export async function updateLeadStatus(id, status) {
  await updateDoc(doc(db, "leads", id), { status });
}

// บันทึกโน้ตของทีมขาย (เช่น คุยอะไรไปแล้ว นัดโทรกลับวันไหน ราคาที่เสนอ)
export async function updateLeadNotes(id, notes) {
  await updateDoc(doc(db, "leads", id), { notes });
}

// กำหนด/เปลี่ยนผู้รับผิดชอบลีด (ชื่อพนักงานจาก settings.teamMembers) — ส่ง "" เพื่อเอาผู้รับผิดชอบออก
export async function updateLeadAssignee(id, assignee) {
  await updateDoc(doc(db, "leads", id), { assignee: assignee || "" });
}

export async function deleteLead(id) {
  await deleteDoc(doc(db, "leads", id));
}

// ===========================
// ORDERS — คำสั่งผลิต (Production Console)
// ===========================
// Schema (collection "orders"):
// {
//   code:       string   "PO-2026-0118"        เลขที่คำสั่งผลิต
//   customer:   string   "EGAT"                ลูกค้า/หน่วยงาน
//   phone:      string   "0891234567"          เบอร์โทรลูกค้า (ไม่บังคับ) — ใช้เป็นรหัสยืนยันตัวตน
//                                               ตอนลูกค้าเช็คสถานะเองผ่านป๊อปอัพ (js/track-modal.js, ไม่ต้อง login)
//   item:       string   "ป้ายเตือนไฟฟ้าแรงสูง"   ชื่อสินค้า/ป้าย
//   category:   string   "ป้ายเตือนอันตราย"      หมวดป้าย (optional)
//   qty:        number   20                    จำนวน
//   status:     "received" | "design" | "approval" | "production" | "qc" |
//               "packing" | "shipping" | "completed" | "cancelled"
//   progress:   number   0-100                 % งานเสร็จ
//   compliant:  boolean  true                   ผ่านมาตรฐาน มอก./ISO หรือไม่
//   dueDate:    string   "2026-07-05"          กำหนดส่ง (YYYY-MM-DD)
//   notes:      string
//   createdAt:  serverTimestamp
//   updatedAt:  serverTimestamp
//   shippedAt:  serverTimestamp | null         เซ็ตอัตโนมัติเมื่อ status = "shipping" (ออกเดินทาง)
//   completedAt:serverTimestamp | null         เซ็ตอัตโนมัติเมื่อ status = "completed" (ใช้คิด lead time)
//   createdBy:  string | null                  uid ของ admin ที่สร้าง
//   trackingId: string | null                  = buildTrackingId(code, phone) — ผูกกับ doc คู่กันใน
//                                               collection "order_tracking" (ดูด้านล่าง)
// }
//
// Schema (collection "order_tracking") — สำเนา "เฉพาะข้อมูลที่ปลอดภัยให้คนนอกเห็น" ของ order
// แต่ละ doc, id = trackingId (ดู buildTrackingId ด้านล่าง) เพื่อให้ "เดา id ไม่ได้" ถ้าไม่รู้ทั้งเลข
// PO และเบอร์โทรจริง — Firestore rule เปิด "get" แบบ public แต่ปิด "list" ทั้ง collection ไว้
// (กันไม่ให้ไล่ดูคำสั่งผลิตของลูกค้ารายอื่น) ไม่มี field ชื่อลูกค้า/หมายเหตุ/เบอร์โทรอยู่ใน doc นี้เลย
// { code, item, category, qty, status, progress, compliant, dueDate, updatedAt }
// status ใช้ค่าเดียวกับ collection "orders" ด้านบน (received/design/approval/production/qc/packing/shipping/completed/cancelled)
//
// ทำแบบนี้แทนการเปิด "orders" ให้อ่านแบบ public เพราะ Firestore rules คุมได้แค่ระดับทั้ง document
// (จะซ่อนแค่บาง field ไม่ได้) และหลีกเลี่ยงการเพิ่ม Cloud Function (ต้องใช้ Blaze plan ซึ่งโปรเจกต์นี้
// ตั้งใจเลี่ยงไว้ — ดูหมายเหตุใน functions/index.js เรื่อง verifyTurnstile) จึงใช้ Firestore
// security rules ล้วน ๆ ยังอยู่ใน Spark plan (ฟรี) ได้เหมือนเดิม

// Workflow การผลิต 8 ขั้นตอนหลัก + "ยกเลิก" เป็นสถานะพิเศษที่ออกจาก flow ได้จากทุกขั้นตอน
export const ORDER_STATUS = {
  received:   { label: "รับงาน",              css: "received" },
  design:     { label: "ออกแบบ",              css: "design" },
  approval:   { label: "รออนุมัติแบบ",         css: "approval" },
  production: { label: "กำลังผลิต",            css: "production" },
  qc:         { label: "ตรวจสอบคุณภาพ (QC)",   css: "qc" },
  packing:    { label: "แพ็กสินค้า",           css: "packing" },
  shipping:   { label: "จัดส่ง",               css: "shipping" },
  completed:  { label: "เสร็จสิ้น",            css: "ok" },
  cancelled:  { label: "ยกเลิก",               css: "cancel" }
};

// ลำดับ flow หลัก (ไม่รวม "cancelled") — ใช้จัดคอลัมน์ kanban และ stage tracker ของป๊อปอัพเช็คสถานะ (js/track-modal.js)
export const ORDER_STATUS_FLOW = [
  "received", "design", "approval", "production", "qc", "packing", "shipping", "completed"
];

// กลุ่มสถานะสำหรับแท็บ "คำสั่งผลิต" (งานที่ยังไม่ถึงขั้นจัดส่ง) และแท็บ "การจัดส่ง" ในหน้า console
export const PRODUCTION_TAB_STATUSES = ["received", "design", "approval", "production", "qc", "packing"];
export const SHIPPING_TAB_STATUSES   = ["shipping", "completed", "cancelled"];

// Realtime listener — ใช้ทั้งใน hero console และ console.html
// callback(orders[]) จะถูกเรียกทุกครั้งที่ข้อมูลเปลี่ยน
// return: unsubscribe function
export function listenOrders(callback, onError) {
  const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
  return onSnapshot(
    q,
    snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    err => { if (onError) onError(err); else console.error("listenOrders error:", err); }
  );
}

export async function getOrders() {
  const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function addOrder(order) {
  const payload = {
    code:       order.code || "",
    customer:   order.customer || "",
    phone:      order.phone || "",
    item:       order.item || "",
    category:   order.category || "",
    product_id: order.product_id || "",
    unit_price: Number(order.unit_price) || 0,
    qty:        Number(order.qty) || 1,
    status:     order.status || "received",
    progress:   Math.max(0, Math.min(100, Number(order.progress) || 0)),
    compliant:  !!order.compliant,
    dueDate:    order.dueDate || "",
    notes:      order.notes || "",
    createdAt:  serverTimestamp(),
    updatedAt:  serverTimestamp(),
    shippedAt:  null,
    completedAt: null,
    createdBy:  auth.currentUser ? auth.currentUser.uid : null,
    trackingId: buildTrackingId(order.code, order.phone)
  };
  await addDoc(collection(db, "orders"), payload);
  if (payload.trackingId) await upsertOrderTracking(payload);
}

export async function updateOrder(id, patch) {
  const ref = doc(db, "orders", id);
  const existingSnap = await getDoc(ref);
  const existing = existingSnap.exists() ? existingSnap.data() : {};
  const merged = { ...existing, ...patch };

  const payload = { ...patch, updatedAt: serverTimestamp() };
  if ("qty" in payload)      payload.qty = Number(payload.qty) || 1;
  if ("unit_price" in payload) payload.unit_price = Number(payload.unit_price) || 0;
  if ("progress" in payload) payload.progress = Math.max(0, Math.min(100, Number(payload.progress) || 0));
  if (patch.status === "shipping") {
    payload.shippedAt = serverTimestamp();
  }
  if (patch.status === "completed") {
    payload.progress = 100;
    payload.completedAt = serverTimestamp();
  }

  const oldTrackingId = existing.trackingId || null;
  const newTrackingId = buildTrackingId(merged.code, merged.phone);
  payload.trackingId = newTrackingId;

  await updateDoc(ref, payload);

  if (newTrackingId !== oldTrackingId) await removeOrderTracking(oldTrackingId);
  if (newTrackingId) {
    await upsertOrderTracking({
      ...merged,
      progress: "progress" in payload ? payload.progress : merged.progress
    });
  }
}

export async function deleteOrder(id) {
  const ref = doc(db, "orders", id);
  const snap = await getDoc(ref);
  const trackingId = snap.exists() ? (snap.data().trackingId || null) : null;
  await deleteDoc(ref);
  if (trackingId) await removeOrderTracking(trackingId);
}

// ===========================
// ORDER TRACKING (public, ไม่ต้อง login) — ใช้โดยป๊อปอัพเช็คสถานะคำสั่งผลิต (js/track-modal.js)
// ===========================
// รหัสยืนยัน = เลข PO + เบอร์โทร 4 หลักสุดท้าย รวมกันเป็น doc id เดียว ทำให้ "เดา id ไม่ได้"
// ถ้าไม่รู้ทั้งสองอย่าง (คล้ายระบบเช็คสถานะพัสดุที่ต้องใช้เลขพัสดุ + รหัสไปรษณีย์)
function sanitizeCodeForId(code) {
  return String(code || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}
function last4Digits(phone) {
  return String(phone || "").replace(/\D/g, "").slice(-4);
}
export function buildTrackingId(code, phone) {
  const c = sanitizeCodeForId(code);
  const p = last4Digits(phone);
  if (!c || p.length < 4) return null;
  return `${c}_${p}`;
}

async function upsertOrderTracking(order) {
  const trackingId = buildTrackingId(order.code, order.phone);
  if (!trackingId) return;
  await setDoc(doc(db, "order_tracking", trackingId), {
    code:       order.code || "",
    item:       order.item || "",
    category:   order.category || "",
    qty:        Number(order.qty) || 1,
    status:     order.status || "received",
    progress:   Math.max(0, Math.min(100, Number(order.progress) || 0)),
    compliant:  !!order.compliant,
    dueDate:    order.dueDate || "",
    updatedAt:  serverTimestamp()
  });
}

async function removeOrderTracking(trackingId) {
  if (!trackingId) return;
  try {
    await deleteDoc(doc(db, "order_tracking", trackingId));
  } catch (err) {
    console.warn("removeOrderTracking: ลบ order_tracking เดิมไม่สำเร็จ", trackingId, err);
  }
}

// ใช้โดยป๊อปอัพเช็คสถานะคำสั่งผลิต (js/track-modal.js) — ลูกค้ากรอกเลขที่ PO + เบอร์โทร (ไม่ต้อง login)
// คืนค่า null ถ้าไม่พบ (เลข PO/เบอร์โทรไม่ตรงกัน หรือยังไม่เคยกรอกเบอร์โทรไว้ในคำสั่งผลิตนี้)
export async function trackOrderStatus(code, phone) {
  const trackingId = buildTrackingId(code, phone);
  if (!trackingId) return null;
  const snap = await getDoc(doc(db, "order_tracking", trackingId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

// แปลง dueDate ("YYYY-MM-DD") เป็นจำนวนวันที่เหลือ (ลบได้ = เกินกำหนด), null ถ้าไม่มีวันกำหนดส่ง
export function daysUntilDue(order) {
  if (!order || !order.dueDate) return null;
  const due = new Date(order.dueDate + "T23:59:59");
  if (isNaN(due.getTime())) return null;
  const now = new Date();
  return Math.ceil((due.getTime() - now.getTime()) / 86400000);
}

// สถานะความเร่งด่วนของคำสั่งผลิตที่ยังไม่จบงาน (ใช้ไฮไลต์ในตาราง/การ์ด/แจ้งเตือน)
export function orderUrgency(order) {
  if (!order || order.status === "completed" || order.status === "cancelled") return null;
  const d = daysUntilDue(order);
  if (d === null) return null;
  if (d < 0) return "overdue";
  if (d <= 2) return "due-soon";
  return null;
}

// คำนวณสถิติสำหรับ Production Console จาก orders ที่ได้จาก listenOrders/getOrders
export function computeOrderStats(orders) {
  const active = orders.filter(o => o.status !== "completed" && o.status !== "cancelled");
  const finished = orders.filter(o => o.status === "completed");
  const compliantCount = finished.filter(o => o.compliant).length;
  const compliantRate = finished.length ? Math.round((compliantCount / finished.length) * 100) : 100;

  // นับตามสถานะ สำหรับการ์ด "จำนวนงานใหม่ / งานที่กำลังผลิต / งานที่เสร็จแล้ว"
  // หมายเหตุ: เดิมสถานะ "shipping" (จัดส่ง) ไม่ถูกนับในกลุ่มไหนเลย ทำให้คำสั่งผลิตที่อยู่ระหว่าง
  // จัดส่งหายไปจากการ์ดสรุปทั้งหมด (newCount/inProductionCount/completedCount รวมกันไม่เท่ากับ
  // จำนวนงานที่ยังไม่เสร็จ/ไม่ยกเลิกจริง) — แก้โดยนับ "shipping" รวมอยู่ในงานที่กำลังผลิต/ดำเนินการอยู่
  const newCount          = orders.filter(o => o.status === "received").length;
  const inProductionCount = orders.filter(o =>
    o.status === "design" || o.status === "approval" || o.status === "production" ||
    o.status === "qc" || o.status === "packing" || o.status === "shipping"
  ).length;
  const completedCount    = orders.filter(o => o.status === "completed").length;

  // ยอดขายวันนี้ / เดือนนี้ — คำนวณจาก qty × ราคาสินค้าที่ผูกกับคำสั่งผลิต (unit_price)
  // เฉพาะคำสั่งผลิตที่ไม่ถูกยกเลิก; คำสั่งที่ไม่ได้ผูกกับสินค้าในแคตตาล็อกจะมี unit_price = 0
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const orderMillis = (o) => o.createdAt ? (o.createdAt.toMillis ? o.createdAt.toMillis() : o.createdAt) : null;
  const orderAmount = (o) => (Number(o.unit_price) || 0) * (Number(o.qty) || 0);
  let salesToday = 0, salesMonth = 0;
  orders.forEach(o => {
    if (o.status === "cancelled") return;
    const t = orderMillis(o);
    if (t == null) return;
    const amount = orderAmount(o);
    if (t >= monthStart) salesMonth += amount;
    if (t >= todayStart) salesToday += amount;
  });

  const completedWithDates = orders.filter(o => o.status === "completed" && o.completedAt && o.createdAt);
  let avgDays = null;
  if (completedWithDates.length) {
    const totalMs = completedWithDates.reduce((sum, o) => {
      const created = o.createdAt.toMillis ? o.createdAt.toMillis() : o.createdAt;
      const completed = o.completedAt.toMillis ? o.completedAt.toMillis() : o.completedAt;
      return sum + Math.max(0, completed - created);
    }, 0);
    avgDays = Math.round((totalMs / completedWithDates.length) / 86400000 * 10) / 10;
  }

  // นับคำสั่งผลิตใหม่ของแต่ละวันใน 7 วันล่าสุด (สำหรับ bar chart)
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    d.setHours(0, 0, 0, 0);
    days.push(d.getTime());
  }
  const weekly = days.map(dayStart => {
    const dayEnd = dayStart + 86400000;
    return orders.filter(o => {
      if (!o.createdAt) return false;
      const t = o.createdAt.toMillis ? o.createdAt.toMillis() : o.createdAt;
      return t >= dayStart && t < dayEnd;
    }).length;
  });
  const weekMax = Math.max(1, ...weekly);

  // เทรนด์ 30 วันล่าสุด (สำหรับกราฟเส้น)
  const days30 = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    d.setHours(0, 0, 0, 0);
    days30.push(d.getTime());
  }
  const trend30 = days30.map(dayStart => {
    const dayEnd = dayStart + 86400000;
    return orders.filter(o => {
      if (!o.createdAt) return false;
      const t = o.createdAt.toMillis ? o.createdAt.toMillis() : o.createdAt;
      return t >= dayStart && t < dayEnd;
    }).length;
  });

  // ยอดขาย (รายได้) รายวัน 7/30 วันล่าสุด — คู่ขนานกับ weekly/trend30 ที่นับ "จำนวนงาน"
  // แยกกราฟนี้ออกมาต่างหาก เพราะจำนวนงานมากไม่ได้แปลว่ารายได้สูง (งานเล็ก-ใหญ่ราคาต่างกัน)
  // ไม่นับคำสั่งผลิตที่ถูกยกเลิก เหมือนกับ salesToday/salesMonth ด้านบน
  const revenueWeekly = days.map(dayStart => {
    const dayEnd = dayStart + 86400000;
    return orders.filter(o => {
      if (o.status === "cancelled" || !o.createdAt) return false;
      const t = o.createdAt.toMillis ? o.createdAt.toMillis() : o.createdAt;
      return t >= dayStart && t < dayEnd;
    }).reduce((sum, o) => sum + orderAmount(o), 0);
  });
  const revenueTrend30 = days30.map(dayStart => {
    const dayEnd = dayStart + 86400000;
    return orders.filter(o => {
      if (o.status === "cancelled" || !o.createdAt) return false;
      const t = o.createdAt.toMillis ? o.createdAt.toMillis() : o.createdAt;
      return t >= dayStart && t < dayEnd;
    }).reduce((sum, o) => sum + orderAmount(o), 0);
  });

  // เทียบยอดขาย "เดือนนี้ vs เดือนก่อน" แบบเห็นตัวเลขทั้งคู่ชัดๆ ไม่ใช่แค่ % เดียวลอยๆ
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
  const prevMonthEnd   = monthStart; // เดือนนี้เริ่มตรงไหน เดือนก่อนหน้าจบตรงนั้นพอดี
  let salesPrevMonth = 0;
  orders.forEach(o => {
    if (o.status === "cancelled") return;
    const t = orderMillis(o);
    if (t == null || t < prevMonthStart || t >= prevMonthEnd) return;
    salesPrevMonth += orderAmount(o);
  });
  const monthCompare = {
    thisMonth: salesMonth,
    prevMonth: salesPrevMonth,
    pct: salesPrevMonth === 0
      ? (salesMonth === 0 ? 0 : 100)
      : Math.round(((salesMonth - salesPrevMonth) / salesPrevMonth) * 100)
  };

  // ใกล้ครบกำหนด (0-2 วัน) / เกินกำหนด — เฉพาะงานที่ยังไม่จบ
  const dueSoon = active.filter(o => orderUrgency(o) === "due-soon");
  const overdue = active.filter(o => orderUrgency(o) === "overdue");

  // แยกตามหมวดป้าย
  const catMap = new Map();
  orders.forEach(o => {
    const key = o.category || "ไม่ระบุหมวด";
    catMap.set(key, (catMap.get(key) || 0) + 1);
  });
  const byCategory = [...catMap.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  // ลูกค้าที่มีคำสั่งผลิตมากที่สุด (top 5)
  const custMap = new Map();
  orders.forEach(o => {
    const key = o.customer || "ไม่ระบุลูกค้า";
    custMap.set(key, (custMap.get(key) || 0) + 1);
  });
  const topCustomers = [...custMap.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    activeCount: active.length,
    compliantRate,
    avgDays,
    weekly: weekly.map(n => Math.round((n / weekMax) * 100)),
    trend30,
    revenueWeekly,
    revenueTrend30,
    monthCompare,
    dueSoonCount: dueSoon.length,
    overdueCount: overdue.length,
    dueSoonOrders: dueSoon,
    overdueOrders: overdue,
    byCategory,
    topCustomers,
    newCount,
    inProductionCount,
    completedCount,
    salesToday,
    salesMonth
  };
}
