// ===========================
// js/db.js — Firebase + Cloudinary
// ===========================
// แก้ไขค่าด้านล่างด้วยค่าจริงจาก Firebase และ Cloudinary

// ── Firebase Config ──────────────────────────────
// Firebase Console → Project Settings → Your apps → SDK setup
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
// Cloudinary Dashboard → Settings → Upload → Upload presets
const CLOUDINARY_CLOUD_NAME = "YOUR_CLOUD_NAME";   // เช่น "paisign123"
const CLOUDINARY_UPLOAD_PRESET = "YOUR_PRESET";    // เช่น "paisign_unsigned"

// ─────────────────────────────────────────────────
import { initializeApp }                            from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, collection, doc,
         getDocs, addDoc, updateDoc,
         deleteDoc, orderBy, query,
         getDoc, setDoc }                           from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const app = initializeApp(FIREBASE_CONFIG);
const db  = getFirestore(app);

// ===========================
// CATEGORIES CRUD
// ===========================
export async function getCategories() {
  const q = query(collection(db, "categories"), orderBy("createdAt"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function saveCategory(cat) {
  if (cat.id) {
    await updateDoc(doc(db, "categories", cat.id), {
      name: cat.name, icon: cat.icon, description: cat.description
    });
  } else {
    await addDoc(collection(db, "categories"), {
      name: cat.name, icon: cat.icon, description: cat.description,
      createdAt: Date.now()
    });
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

export async function saveProduct(product) {
  const payload = {
    cat_id:      product.cat_id,
    name:        product.name,
    price:       product.price,
    unit:        product.unit,
    description: product.description,
    status:      product.status,
    featured:    product.featured,
    images:      product.images || []
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
// CLOUDINARY — อัปโหลดรูปภาพ
// ===========================
export async function uploadImage(file) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  formData.append("folder", "paisign/products");

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
    { method: "POST", body: formData }
  );
  if (!res.ok) throw new Error("อัปโหลดรูปไม่สำเร็จ");
  const data = await res.json();
  // คืน URL แบบ auto-optimize (WebP + resize)
  return data.secure_url.replace("/upload/", "/upload/f_auto,q_auto,w_800/");
}

export async function deleteImage(url) {
  // Cloudinary ลบรูปต้องใช้ API key (server-side) — ข้ามได้สำหรับ MVP
  console.log("deleteImage: ข้ามการลบบน Cloudinary", url);
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
