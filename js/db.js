// ===========================
// js/db.js — Firebase + Cloudinary + Auth
// ===========================
// แก้ไขค่าด้านล่างด้วยค่าจริงจาก Firebase และ Cloudinary

// ── Firebase Config ──────────────────────────────
const FIREBASE_CONFIG = {
  apiKey:            "YOUR_API_KEY",
  authDomain:        "YOUR_PROJECT_ID.firebaseapp.com",
  projectId:         "YOUR_PROJECT_ID",
  storageBucket:     "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId:             "YOUR_APP_ID"
};

// ── Cloudinary Config ─────────────────────────────
const CLOUDINARY_CLOUD_NAME   = "YOUR_CLOUD_NAME";
const CLOUDINARY_UPLOAD_PRESET = "YOUR_PRESET";

// ─────────────────────────────────────────────────
import { initializeApp }                            from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, collection, doc,
         getDocs, addDoc, updateDoc,
         deleteDoc, orderBy, query,
         getDoc, setDoc }                           from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword,
         signOut, onAuthStateChanged }              from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const app  = initializeApp(FIREBASE_CONFIG);
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
  return data.secure_url.replace("/upload/", "/upload/f_auto,q_auto,w_800/");
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
