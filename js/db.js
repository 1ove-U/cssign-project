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
import { getFirestore, collection, doc,
         getDocs, addDoc, updateDoc,
         deleteDoc, orderBy, query,
         getDoc, setDoc }                           from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword,
         signOut, onAuthStateChanged }              from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const app = initializeApp(firebaseConfig);
const db   = getFirestore(app);
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
// CATEGORIES CRUD (admin only)
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
  return data.secure_url.replace("/upload/", "/upload/f_auto,q_auto,w_900,h_900,c_limit/");
}

export async function deleteImage(url) {
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
