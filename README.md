# 📖 คู่มือ Deploy เว็บฟรี — GitHub + Vercel + Supabase

> **เป้าหมาย**: เปิดเว็บ paisign ให้ใช้งานได้ฟรี 100% ภายใน 30 นาที

---

## 📁 โครงสร้างไฟล์โปรเจกต์

```
paisign/
├── index.html          ← หน้าเว็บหลัก (HTML)
├── css/
│   └── style.css       ← สไตล์ทั้งหมด
├── js/
│   ├── app.js          ← Logic หลัก (อ่าน/เขียน UI)
│   └── supabase.js     ← เชื่อม Supabase Database
├── supabase_schema.sql ← SQL สำหรับสร้างตาราง
└── README.md           ← คู่มือนี้
```

---

## STEP 1 — สร้าง Supabase (ฐานข้อมูลฟรี)

### 1.1 สมัคร Supabase

1. ไปที่ **https://supabase.com** → คลิก **Start your project**
2. Sign in ด้วย GitHub account
3. คลิก **New project**
4. ตั้งค่า:
   - **Organization**: ใช้ default หรือสร้างใหม่
   - **Name**: `paisign`
   - **Database Password**: ตั้งรหัสผ่านให้แข็งแรง (บันทึกไว้!)
   - **Region**: Singapore `ap-southeast-1` (ใกล้ไทยสุด)
5. คลิก **Create new project** → รอ ~2 นาที

### 1.2 สร้างตาราง (Database Schema)

1. ใน Supabase Dashboard → เลือก **SQL Editor** (ไอคอน </>)
2. คลิก **New query**
3. เปิดไฟล์ `supabase_schema.sql` แล้ว **copy ทั้งหมด** วางใน editor
4. คลิก **Run** (หรือ Ctrl+Enter)
5. ควรเห็น "Success. No rows returned"

### 1.3 สร้าง Storage Bucket (สำหรับรูปภาพ)

1. ใน Supabase Dashboard → คลิก **Storage** (ไอคอนรูป bucket)
2. คลิก **New bucket**
3. ตั้งค่า:
   - **Name**: `product-images`
   - **Public bucket**: ✅ เปิด (toggle เป็น ON)
4. คลิก **Create bucket**
5. คลิกเข้าไปใน bucket `product-images` → **Policies** → **Add policies**
6. เลือก template **"Give users access to only their own top level folder named as uid"** แต่แก้ไขเป็น:
   - เลือก **For full customization** แทน
   - Policy name: `Allow anon access`
   - Allowed operation: ✅ SELECT, ✅ INSERT
   - Target roles: `anon`
   - USING expression: `bucket_id = 'product-images'`
   - WITH CHECK expression: `bucket_id = 'product-images'`
   - Save

### 1.4 คัดลอก API Keys

1. ใน Supabase Dashboard → **Settings** (ไอคอนฟันเฟือง) → **API**
2. จดบันทึก 2 ค่านี้:
   - **Project URL**: `https://xxxxxxxx.supabase.co`
   - **anon public** key: `eyJhbGci...` (ยาวมาก)

---

## STEP 2 — ใส่ API Keys ในโค้ด

เปิดไฟล์ `js/supabase.js` บรรทัด 8-9 แก้ไข:

```javascript
// แก้ไขค่านี้:
const SUPABASE_URL = 'https://YOUR_PROJECT_ID.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY';

// เป็นค่าจริงจาก Step 1.4 เช่น:
const SUPABASE_URL = 'https://abcdefghij.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
```

---

## STEP 3 — อัปโหลดไปยัง GitHub

### 3.1 สมัคร/Login GitHub

ไปที่ **https://github.com** → สมัคร หรือ login

### 3.2 สร้าง Repository

1. คลิกปุ่ม **+** มุมบนขวา → **New repository**
2. ตั้งค่า:
   - **Repository name**: `paisign`
   - **Visibility**: Public ✅ (ต้องเป็น Public ถึงจะใช้ Vercel ฟรีได้)
   - **Add a README file**: ✅
3. คลิก **Create repository**

### 3.3 อัปโหลดไฟล์

**วิธี A — ผ่าน GitHub Web (ง่ายสุด)**

1. ใน repository ที่สร้าง → คลิก **Add file** → **Upload files**
2. ลาก folder `paisign/` ทั้งหมดเข้า หรือ upload ทีละไฟล์ตามโครงสร้าง:
   ```
   index.html
   css/style.css
   js/app.js
   js/supabase.js
   supabase_schema.sql
   ```
3. เพิ่ม commit message: `Initial deploy`
4. คลิก **Commit changes**

**วิธี B — ผ่าน Git command line**

```bash
git init
git add .
git commit -m "Initial deploy"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/paisign.git
git push -u origin main
```

---

## STEP 4 — Deploy บน Vercel (เปิดเว็บฟรี)

### 4.1 สมัคร Vercel

1. ไปที่ **https://vercel.com** → คลิก **Sign Up**
2. เลือก **Continue with GitHub** → อนุญาต

### 4.2 Import โปรเจกต์

1. ใน Vercel Dashboard → คลิก **Add New Project**
2. ค้นหา repository `paisign` → คลิก **Import**
3. ตั้งค่า:
   - **Framework Preset**: Other (ไม่ใช่ framework ธรรมดา)
   - **Root Directory**: `./` (default)
   - **Build Command**: ว่างไว้ (ไม่ต้อง build)
   - **Output Directory**: `./` (ว่างหรือ `.`)
4. คลิก **Deploy**
5. รอ ~1 นาที → เว็บจะ live!

### 4.3 URL เว็บของคุณ

Vercel จะให้ URL เช่น:
- `https://paisign.vercel.app`
- `https://paisign-username.vercel.app`

**เข้าใช้งานได้เลย!** 🎉

---

## STEP 5 — ทดสอบเว็บ

1. เปิด URL จาก Vercel
2. ไปที่หน้า **Admin** (ปุ่มมุมบนขวา)
3. เพิ่มหมวดหมู่ทดสอบ → ตรวจสอบว่าบันทึกได้
4. เพิ่มสินค้า พร้อมรูปภาพ → ตรวจสอบว่าอัปโหลดได้
5. ไปดูหน้าแรก → สินค้าควรแสดงแล้ว ✅

---

## 🔄 การ Update โค้ด (ทุกครั้งที่แก้ไข)

เมื่อแก้โค้ดแล้ว:
- **ผ่าน GitHub Web**: แก้ไขไฟล์ → Commit → Vercel จะ deploy อัตโนมัติ (~1 นาที)
- **ผ่าน Git**: `git add . && git commit -m "update" && git push`

---

## 🌐 ใช้ Domain ของตัวเอง (ถ้ามี)

1. ใน Vercel → เลือกโปรเจกต์ → **Settings** → **Domains**
2. ใส่ domain เช่น `www.paisign.co.th`
3. ทำตาม DNS records ที่ Vercel แจ้ง

---

## 💰 ค่าใช้จ่าย (ฟรีทั้งหมด!)

| บริการ | Plan ฟรี | ขีดจำกัด |
|--------|---------|---------|
| **GitHub** | Free | ไฟล์ไม่จำกัด, Repo ไม่จำกัด |
| **Vercel** | Hobby (Free) | 100GB bandwidth/เดือน |
| **Supabase** | Free Tier | DB 500MB, Storage 1GB, 50,000 req/เดือน |

> **เพียงพอสำหรับ SME ทั่วไป** — ถ้าใช้มากขึ้น ค่อย upgrade

---

## ❓ แก้ปัญหาที่พบบ่อย

**Q: เว็บโหลดได้แต่ข้อมูลไม่แสดง**
- ตรวจสอบ SUPABASE_URL และ SUPABASE_ANON_KEY ใน `js/supabase.js`
- เปิด DevTools (F12) → Console → ดู error

**Q: อัปโหลดรูปภาพไม่ได้**
- ตรวจสอบ Storage bucket ชื่อ `product-images` ถูกสร้างแล้ว
- ตรวจสอบ Bucket Policy ว่า anon INSERT ได้

**Q: Vercel แสดง 404**
- ตรวจสอบว่า `index.html` อยู่ที่ root ของ repository (ไม่ใช่ใน subfolder)

**Q: ต้องการ Login Admin**
- ดู Supabase Auth documentation: https://supabase.com/docs/guides/auth
- หรือแจ้ง เพื่อเพิ่มระบบ Login ให้

---

## 📞 ลำดับขั้นตอนสรุป

```
1. Supabase → สร้าง project + รัน SQL + สร้าง bucket
2. แก้ไข js/supabase.js ใส่ URL + Key
3. GitHub → สร้าง repo + upload ไฟล์
4. Vercel → import repo → Deploy
5. เปิดเว็บ ✅
```

**ใช้เวลาทั้งหมด: ~30 นาที**
