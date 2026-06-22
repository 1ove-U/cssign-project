# 📖 คู่มือ Deploy — Firebase + Cloudinary + GitHub + Vercel (v2 + Admin Login)

> **ฟรี 100%** · รูปสินค้าได้ 25GB · ข้อมูล 1GB · Deploy อัตโนมัติ · ระบบ Admin Login ปลอดภัย

---

## โครงสร้างไฟล์

```
paisign/
├── index.html        ← หน้าเว็บหลัก (มี Login Modal)
├── css/style.css     ← สไตล์ทั้งหมด
├── js/
│   ├── app.js        ← Logic UI + Auth Guard
│   └── db.js         ← Firebase + Firebase Auth + Cloudinary  ← แก้ไขที่นี่
└── README.md
```

---

## STEP 1 — สร้าง Firebase (ฐานข้อมูล + Auth)

### 1.1 สร้างโปรเจกต์

1. ไปที่ **https://console.firebase.google.com**
2. Login ด้วย Google account
3. คลิก **Add project** → ตั้งชื่อ: `paisign` → **Create project**

### 1.2 เปิด Firestore Database

1. เมนูซ้าย → **Build** → **Firestore Database**
2. คลิก **Create database** → **Start in production mode** → **Next**
3. เลือก Region: **asia-southeast1 (Singapore)** → **Enable**

### 1.3 เปิด Firebase Authentication

1. เมนูซ้าย → **Build** → **Authentication**
2. คลิก **Get started**
3. แท็บ **Sign-in method** → คลิก **Email/Password** → เปิด **Enable** → **Save**

### 1.4 สร้าง Admin Account

1. ใน Authentication → แท็บ **Users**
2. คลิก **Add user**
3. ใส่ Email และ Password ที่ต้องการ (เก็บไว้ login)
4. คลิก **Add user**

### 1.5 คัดลอก Config

1. คลิกไอคอน ⚙️ (Project settings)
2. เลื่อนลงมาหา **Your apps** → คลิกไอคอน **</>** (Web)
3. ตั้ง App nickname: `paisign-web` → **Register app**
4. คัดลอก config ทั้งหมด

---

## STEP 2 — ตั้งค่า Firestore Security Rules (สำคัญมาก!)

ไปที่ Firestore → แท็บ **Rules** → แทนที่ด้วย:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // ทุกคนอ่านได้ (แสดงสินค้าบนเว็บ)
    match /categories/{id} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    match /products/{id} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    match /settings/{id} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

คลิก **Publish** ✅

> ✅ Rule นี้ปลอดภัย: ลูกค้าเห็นสินค้าได้ แต่แก้ไขได้เฉพาะ Admin ที่ login แล้วเท่านั้น

---

## STEP 3 — สร้าง Cloudinary (เก็บรูปภาพ 25GB ฟรี)

1. ไปที่ **https://cloudinary.com** → **Sign Up Free**
2. Dashboard → จด **Cloud name**
3. Settings → Upload → **Add upload preset**:
   - Preset name: `paisign_unsigned`
   - Signing Mode: **Unsigned**
   - Folder: `paisign/products`
4. คลิก **Save**

---

## STEP 4 — ใส่ค่าในโค้ด

เปิดไฟล์ `js/db.js` แก้ไขบรรทัด 7-18:

```javascript
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSy...",
  authDomain:        "paisign-xxxxx.firebaseapp.com",
  projectId:         "paisign-xxxxx",
  storageBucket:     "paisign-xxxxx.appspot.com",
  messagingSenderId: "123456789",
  appId:             "1:123456789:web:abcdef"
};

const CLOUDINARY_CLOUD_NAME    = "paisign123";
const CLOUDINARY_UPLOAD_PRESET = "paisign_unsigned";
```

---

## STEP 5 — อัปโหลดไปยัง GitHub

1. GitHub → **New repository** → ชื่อ: `paisign` · **Public**
2. Upload ไฟล์: `index.html`, `css/style.css`, `js/app.js`, `js/db.js`
3. Commit → **Commit changes**

---

## STEP 6 — Deploy บน Vercel

1. **https://vercel.com** → **Sign Up** ด้วย GitHub
2. **Add New Project** → เลือก repo `paisign` → **Import**
3. Framework: **Other** · Build/Output: ว่าง
4. **Deploy** → ได้ URL เช่น `https://paisign.vercel.app` ✅

---

## 🔐 วิธีใช้งาน Admin Login

1. เปิดเว็บ → คลิกปุ่ม **🔐 Admin** มุมขวาบน
2. ใส่ Email และ Password ที่สร้างไว้ใน Firebase Authentication (Step 1.4)
3. คลิก **เข้าสู่ระบบ**
4. จะเห็นปุ่ม **⚙ จัดการระบบ** และ badge แสดงอีเมล
5. ออกจากระบบ: คลิก **✕** ที่ badge หรือ **🚪 ออกจากระบบ** ใน sidebar

---

## 💡 ระบบที่เพิ่มใหม่ใน v2

| ฟีเจอร์ | รายละเอียด |
|--------|-----------|
| 🔐 Firebase Auth | Login ด้วย Email/Password จริง |
| 🛡 Admin Guard | ปุ่มแก้ไข/ลบทุกจุดต้องการ login |
| 🔒 Firestore Rules | เขียนได้เฉพาะ Admin ที่ authenticated |
| 👤 Admin Badge | แสดงอีเมล + ปุ่ม logout บน header |
| 🖼 Gallery | รูปสินค้าหลายรูป + คลิก thumbnail สลับได้ |
| 📱 UX ปรับปรุง | Login modal กด Enter ได้ |

---

## 💰 สรุปค่าใช้จ่าย (ฟรีทั้งหมด)

| บริการ | ฟรีได้เท่าไหร่ |
|--------|--------------|
| **Firebase Auth** | 10,000 users/เดือน |
| **Firebase Firestore** | 1GB, 50,000 reads/วัน |
| **Cloudinary** | 25GB รูปภาพ + CDN |
| **GitHub** | ไม่จำกัด |
| **Vercel** | 100GB bandwidth/เดือน |

---

## ❓ ปัญหาที่พบบ่อย

**Login ไม่ได้ — "อีเมลหรือรหัสผ่านไม่ถูกต้อง"**
→ ตรวจสอบใน Firebase → Authentication → Users ว่าสร้าง user แล้ว

**Login ได้แต่บันทึกไม่ได้ — Permission denied**
→ ตรวจสอบ Firestore Rules ว่า publish แล้ว (Step 2)

**ข้อมูลไม่โหลด**
→ ตรวจสอบ FIREBASE_CONFIG ใน `js/db.js`

**อัปโหลดรูปไม่ได้**
→ ตรวจสอบ Upload Preset ว่าตั้งเป็น **Unsigned**
