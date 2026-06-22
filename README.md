# 📖 คู่มือ Deploy — Firebase + Cloudinary + GitHub + Vercel

> **ฟรี 100%** · รูปสินค้าได้ 25GB · ข้อมูล 1GB · Deploy อัตโนมัติ

---

## โครงสร้างไฟล์

```
paisign/
├── index.html        ← หน้าเว็บหลัก
├── css/style.css     ← สไตล์ทั้งหมด
├── js/
│   ├── app.js        ← Logic UI ทั้งหมด
│   └── db.js         ← เชื่อม Firebase + Cloudinary  ← แก้ไขที่นี่
└── README.md
```

---

## STEP 1 — สร้าง Firebase (ฐานข้อมูล)

### 1.1 สร้างโปรเจกต์

1. ไปที่ **https://console.firebase.google.com**
2. Login ด้วย Google account
3. คลิก **Add project**
4. ตั้งชื่อ: `paisign` → คลิก **Continue**
5. Google Analytics: ปิดได้ → **Create project**
6. รอ ~30 วินาที → **Continue**

### 1.2 เปิด Firestore Database

1. เมนูซ้าย → **Build** → **Firestore Database**
2. คลิก **Create database**
3. เลือก **Start in test mode** → **Next**
4. เลือก Region: **asia-southeast1 (Singapore)** → **Enable**

### 1.3 คัดลอก Config

1. คลิกไอคอน ⚙️ (Project settings) มุมบนซ้าย
2. เลื่อนลงมาหา **Your apps** → คลิกไอคอน **</>** (Web)
3. ตั้ง App nickname: `paisign-web` → **Register app**
4. จะเห็น config แบบนี้ → **คัดลอกทั้งหมด**:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "paisign-xxxxx.firebaseapp.com",
  projectId: "paisign-xxxxx",
  storageBucket: "paisign-xxxxx.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};
```

---

## STEP 2 — สร้าง Cloudinary (เก็บรูปภาพ 25GB ฟรี)

### 2.1 สมัคร

1. ไปที่ **https://cloudinary.com** → **Sign Up Free**
2. กรอกข้อมูล → ยืนยัน Email

### 2.2 หา Cloud Name

1. Login → หน้า Dashboard
2. มุมซ้ายบน จะเห็น **Cloud name** เช่น `paisign123` → จดไว้

### 2.3 สร้าง Upload Preset (สำคัญมาก)

1. เมนูบน → **Settings** (ไอคอนฟันเฟือง)
2. แท็บ **Upload**
3. เลื่อนลงหา **Upload presets** → คลิก **Add upload preset**
4. ตั้งค่า:
   - **Preset name**: `paisign_unsigned`
   - **Signing Mode**: **Unsigned** ← ต้องเลือกนี้!
   - **Folder**: `paisign/products`
5. คลิก **Save**

---

## STEP 3 — ใส่ค่าในโค้ด

เปิดไฟล์ `js/db.js` แก้ไขบรรทัด 7-18:

```javascript
// แก้ FIREBASE_CONFIG ด้วยค่าจาก Step 1.3
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSy...",
  authDomain:        "paisign-xxxxx.firebaseapp.com",
  projectId:         "paisign-xxxxx",
  storageBucket:     "paisign-xxxxx.appspot.com",
  messagingSenderId: "123456789",
  appId:             "1:123456789:web:abcdef"
};

// แก้ด้วยค่าจาก Step 2.2 และ 2.3
const CLOUDINARY_CLOUD_NAME    = "paisign123";       // Cloud name จาก Dashboard
const CLOUDINARY_UPLOAD_PRESET = "paisign_unsigned"; // ชื่อ preset ที่สร้าง
```

---

## STEP 4 — อัปโหลดไปยัง GitHub

### 4.1 สร้าง Repository

1. ไปที่ **https://github.com** → Login
2. คลิก **+** → **New repository**
3. ชื่อ: `paisign` · Visibility: **Public** → **Create repository**

### 4.2 Upload ไฟล์

1. ใน repo → **Add file** → **Upload files**
2. ลากไฟล์ทั้งหมดเข้า (รักษาโครงสร้าง folder ด้วย):
   ```
   index.html
   css/style.css
   js/app.js
   js/db.js
   ```
3. Commit message: `Initial deploy` → **Commit changes**

---

## STEP 5 — Deploy บน Vercel

1. ไปที่ **https://vercel.com** → **Sign Up** ด้วย GitHub
2. **Add New Project** → เลือก repo `paisign` → **Import**
3. ตั้งค่า:
   - Framework Preset: **Other**
   - Build Command: ว่าง
   - Output Directory: ว่าง
4. **Deploy** → รอ ~1 นาที
5. ได้ URL เช่น `https://paisign.vercel.app` ✅

---

## STEP 6 — แก้ Firestore Security Rules

ตอนนี้ใช้ Test mode (หมดอายุ 30 วัน) ต้องแก้ก่อน:

1. Firestore → แท็บ **Rules**
2. แทนที่ทั้งหมดด้วย:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read: if true;
      allow write: if true;
    }
  }
}
```

3. **Publish** → ใช้ได้ไม่มีวันหมดอายุ

> ⚠️ Rule นี้เหมาะกับ MVP — ถ้าต้องการ login admin ค่อยอัปเกรด

---

## 🔄 Update โค้ดทีหลัง

แก้ไฟล์ใน GitHub → Vercel deploy อัตโนมัติ ~1 นาที

---

## 💰 สรุปค่าใช้จ่าย (ฟรีทั้งหมด)

| บริการ | ฟรีได้เท่าไหร่ |
|--------|--------------|
| **Firebase** | 1GB database, 50,000 reads/วัน |
| **Cloudinary** | 25GB รูปภาพ + CDN ทั่วโลก |
| **GitHub** | ไม่จำกัด |
| **Vercel** | 100GB bandwidth/เดือน |

---

## ❓ ปัญหาที่พบบ่อย

**ข้อมูลไม่โหลด / Failed to fetch**
→ ตรวจสอบ FIREBASE_CONFIG ใน `js/db.js` ว่าใส่ค่าจริงแล้ว

**อัปโหลดรูปไม่ได้**
→ ตรวจสอบ Upload Preset ว่าตั้งเป็น **Unsigned** แล้ว

**Vercel 404**
→ `index.html` ต้องอยู่ที่ root ของ repo (ไม่ใช่ใน subfolder)
