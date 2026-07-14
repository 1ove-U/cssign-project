# cssign-cloudinary-delete (Cloudflare Worker)

ลบรูป/ไฟล์บน Cloudinary จริง (เรียกจาก `deleteImage()` ใน `js/db.js`) แทนที่จะแค่
`console.log` เฉยๆ เหมือนเดิม ทำเป็น Worker แยกเพราะการลบต้องเซ็น request ด้วย
Cloudinary API Secret ซึ่งห้ามฝังไว้ฝั่งเว็บ (client) โดยตรง

## ขั้นตอน deploy (ทำครั้งแรก)

จากเครื่องที่มี Node.js (ไม่ต้องติดตั้งอะไรค้างเครื่อง ใช้ `npx` ได้เลย):

```bash
cd cloudflare-worker
npm install
npx wrangler login          # ล็อกอินบัญชี Cloudflare (ฟรี สมัครได้ที่ dash.cloudflare.com)

npx wrangler secret put CLOUDINARY_API_KEY
# วางค่าจาก Cloudinary Console → Settings → Access Keys

npx wrangler secret put CLOUDINARY_API_SECRET
# วางค่าจาก Cloudinary Console → Settings → Access Keys (คนละตัวกับ API Key)

npx wrangler deploy
```

Deploy เสร็จจะได้ URL แบบ `https://cssign-cloudinary-delete.<your-subdomain>.workers.dev`
**คัดลอก URL นี้ไว้ — ต้องเอาไปใส่ในขั้นตอนถัดไป**

## ผูก URL เข้ากับเว็บ

เปิด `js/db.js` แล้วแก้บรรทัด:
```js
const CLOUDINARY_DELETE_WORKER_URL = "https://REPLACE-ME.workers.dev";
```
ให้เป็น URL จริงที่ได้จากขั้นตอน deploy ด้านบน

## ทดสอบ

1. Deploy เว็บ (hosting) ตามปกติ
2. เข้า `admin.html` → ลองลบสินค้า/ผลงานที่มีรูป
3. เข้า Cloudinary Console → Media Library เช็คว่ารูปหายไปจริง
4. ถ้ามีปัญหา ดู log ได้ที่ Cloudflare Dashboard → Workers & Pages →
   `cssign-cloudinary-delete` → Logs (หรือรัน `npx wrangler tail` ตอนทดสอบ)

## ความปลอดภัย

- Worker เช็ค Firebase ID token ของผู้เรียกทุกครั้ง (ต้อง login อยู่เท่านั้นถึงลบได้
  ตรงกับเงื่อนไข `isAdmin()` ที่ใช้ทั้งเว็บใน `firestore.rules`)
- จำกัด CORS ให้เรียกได้เฉพาะจาก `cssign.co.th` / `www.cssign.co.th`
  (แก้ได้ที่ `ALLOWED_ORIGINS` ใน `src/index.js` ถ้าโดเมนเปลี่ยน)
- API Key/Secret เก็บเป็น Worker secret ไม่ได้ฝังในโค้ดหรือ commit ขึ้น git
