# cssign-cloudinary-delete (Cloudflare Worker)

Worker เดียวนี้ทำ 6 หน้าที่ (คนละ path แต่ deploy รวมเป็น service เดียว ฟรี ไม่มีเพดานเพิ่ม):

1. `POST /` — ลบรูป/ไฟล์บน Cloudinary จริง (เรียกจาก `deleteImage()` ใน `js/db.js`)
   แทนที่จะแค่ `console.log` เฉยๆ เหมือนเดิม ทำเป็น Worker เพราะการลบต้องเซ็น request ด้วย
   Cloudinary API Secret ซึ่งห้ามฝังไว้ฝั่งเว็บ (client) โดยตรง — ต้อง login และมี role
   `admin` ใน `staff/{uid}` เท่านั้นถึงจะลบได้
2. `POST /verify-turnstile` — ยืนยัน Cloudflare Turnstile token ของฟอร์มสาธารณะ
   (เรียกจาก `verifyTurnstileToken()` ใน `js/leads.js` ก่อนบันทึก lead ทุกครั้ง)
   ต้องมี Turnstile Secret Key ฝั่ง server ซึ่งห้ามฝังฝั่ง client เด็ดขาด — public
   endpoint ไม่ต้อง login
3. `POST /notify-line` — ส่งข้อความแจ้งเตือนผ่าน LINE Messaging API (P1.4, เรียกจาก
   `sendOrderStatusLine()` ใน `js/line-notify.js` ตอนสถานะคำสั่งผลิตเปลี่ยน) ต้องมี
   LINE Channel Access Token ฝั่ง server ซึ่งห้ามฝังฝั่ง client เด็ดขาดเช่นกัน — ต่างจาก
   endpoint ลบรูปตรงที่ **ไม่บังคับ role admin** (แค่ login พอ) เพราะ staff ทั่วไป
   เปลี่ยนสถานะคำสั่งผลิตได้อยู่แล้วตาม `firestore.rules`
4. `POST /line-webhook` — รับ webhook event จาก LINE Messaging API (ข้อความ/อีเวนต์จากลูกค้าที่
   คุยกับ Official Account) แค่ log ไว้ดูผ่าน `wrangler tail` แล้วตอบ `200 ok` กลับเสมอ (LINE
   จะยิงซ้ำถ้าไม่ได้ 200) — ยังไม่มี logic ประมวลผลข้อความจริง — public endpoint ไม่ต้อง login
5. `POST /link-line` — ลูกค้ากดปุ่ม "เชื่อมบัญชี LINE" ในหน้าเช็คสถานะคำสั่งผลิต (ผ่าน LIFF SDK,
   P1.5) — verify ทั้ง LINE ID token (กับ LINE JWKS) และคู่ PO+เบอร์โทร (ต้องมี order จริงที่
   trackingId ตรงกัน) ก่อนเซ็น Firebase custom token ที่จำกัดสิทธิ์แค่ order เดียวให้ — public
   endpoint (ลูกค้าไม่มีบัญชี staff) ต้องตั้ง `FIREBASE_SA_CLIENT_EMAIL`/`FIREBASE_SA_PRIVATE_KEY`
6. `POST /line-login` — "login กว้าง" ด้วย LINE เพียงอย่างเดียวสำหรับหน้า "ออเดอร์ของฉัน"
   (P2.8c-C) ไม่ผูกกับ order เดียวแบบ `/link-line` — verify แค่ LINE ID token แล้วเซ็น custom
   token ที่มี claim `{ lineUserId }` (สิทธิ์อ่านจริงถูกจำกัดที่ชั้น `firestore.rules`) — public
   endpoint เช่นกัน ต้องตั้ง `FIREBASE_SA_CLIENT_EMAIL`/`FIREBASE_SA_PRIVATE_KEY` เหมือนข้อ 5

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

npx wrangler secret put TURNSTILE_SECRET_KEY
# วางค่า "Secret Key" จาก Cloudflare Turnstile widget (ดูขั้นตอนสร้างด้านล่าง)

npx wrangler secret put LINE_CHANNEL_ACCESS_TOKEN
# วางค่า "Channel access token" จาก LINE Developers Console (ดูขั้นตอนสร้างด้านล่าง)

npx wrangler secret put FIREBASE_SA_CLIENT_EMAIL
# วางค่า field "client_email" จากไฟล์ service account JSON (Firebase Console → Project
# Settings → Service Accounts → Generate new private key) — ใช้เซ็น custom token สำหรับ
# LINE login (/link-line, /line-login) เท่านั้น ไม่ใช่ service account ที่มีสิทธิ์เขียน
# Firestore ตรงๆ

npx wrangler secret put FIREBASE_SA_PRIVATE_KEY
# วางค่า field "private_key" จากไฟล์เดียวกัน ทั้งก้อนตามที่อยู่ใน JSON (มีบรรทัด
# -----BEGIN PRIVATE KEY----- ... -----END PRIVATE KEY----- และมี \n อยู่ในสตริง อย่าตัดออก)

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

เปิด `js/leads.js` แล้วแก้บรรทัด:
```js
const VERIFY_TURNSTILE_URL = 'https://REPLACE-ME.workers.dev/verify-turnstile';
```
ให้เป็น URL เดียวกัน (คนละ path) จากขั้นตอน deploy ด้านบน

เปิด `js/line-notify.js` แล้วแก้บรรทัด:
```js
const NOTIFY_LINE_URL = 'https://REPLACE-ME.workers.dev/notify-line';
```
ให้เป็น URL เดียวกัน (คนละ path) จากขั้นตอน deploy ด้านบนเช่นกัน

## ตั้งค่า LINE Messaging API จริง (ฟรี)

1. ไปที่ https://developers.line.biz/console/ → สร้าง Provider (ถ้ายังไม่มี) →
   สร้าง Channel ประเภท **Messaging API**
2. ในหน้า Channel → แท็บ "Messaging API" → เลื่อนลงไปที่ "Channel access token" →
   กด Issue เพื่อออกโทเคน (แบบ long-lived) → คัดลอกไปตั้งเป็น Worker secret ด้วยคำสั่ง
   `npx wrangler secret put LINE_CHANNEL_ACCESS_TOKEN` ด้านบน (ค่านี้ห้ามฝังฝั่ง client)
3. หา LINE user ID ของลูกค้าแต่ละราย (ต้องยินยอมให้แจ้งเตือนก่อน) — ให้ลูกค้าเพิ่มเพื่อน
   (Add Friend) กับ Official Account ของ Channel นี้ก่อน (สแกน QR code จากหน้า Channel ใน
   คอนโซล) แล้วดู user ID จาก Webhook log หรือ LINE Official Account Manager จากนั้นกรอกใน
   ช่อง "LINE user ID ลูกค้า" ตอนเพิ่ม/แก้ไขคำสั่งผลิตในแอดมิน (คู่กับช่องอีเมลลูกค้าที่มีอยู่แล้ว)

## ตั้งค่า Turnstile widget จริง (ฟรี ไม่ต้องผูกบัตร)

1. ไปที่ https://dash.cloudflare.com/?to=/:account/turnstile แล้วสร้าง Widget ใหม่
   ตั้ง domain เป็นโดเมนจริงของเว็บ (เช่น `cssign.co.th`, `www.cssign.co.th`)
2. เอา **Site Key** ที่ได้มาแทนค่า `TURNSTILE_SITE_KEY` ใน `js/turnstile.js`
   (ค่านี้เปิดเผยฝั่ง client ได้ปกติ ไม่ใช่ความลับ)
3. เอา **Secret Key** ไปตั้งเป็น Worker secret ด้วยคำสั่ง `npx wrangler secret put
   TURNSTILE_SECRET_KEY` ด้านบน (ค่านี้ห้ามฝังฝั่ง client เด็ดขาด)

ก่อนเปลี่ยนคีย์จริง เว็บใช้ Cloudflare "test site key" (`1x00000000000000000000AA`)
ซึ่งผ่านทุกครั้ง — ฟอร์มทุกอันจะยังไม่มีการกัน spam จริงจนกว่าจะทำ 3 ขั้นตอนนี้ครบ

## ทดสอบ

**ลบรูป Cloudinary:**
1. Deploy เว็บ (hosting) ตามปกติ
2. เข้า `admin.html` → ลองลบสินค้า/ผลงานที่มีรูป
3. เข้า Cloudinary Console → Media Library เช็คว่ารูปหายไปจริง

**Turnstile verify:**
1. เข้าหน้าเว็บที่มีฟอร์ม (เช่น `contact.html`) → กรอกฟอร์มแล้วส่ง
2. เปิด DevTools → Network → เช็คว่ามี request ไป `/verify-turnstile` และได้
   `{"success": true}` กลับมา
3. ลองปลอม token มั่วๆ (แก้ผ่าน DevTools) → ควรได้ `{"success": false}` และฟอร์ม
   ต้องขึ้น error ไม่บันทึก lead

**LINE push message:**
1. กรอกช่อง "LINE user ID ลูกค้า" ในคำสั่งผลิต แล้วเปลี่ยนสถานะ (เช่น เปลี่ยนเป็น "จัดส่งแล้ว")
2. เช็คที่แชท LINE ของบัญชีทดสอบว่าได้รับข้อความจริง
3. เปิด DevTools → Network → เช็คว่ามี request ไป `/notify-line` และได้ `{"result":"ok"}` กลับมา

ถ้ามีปัญหา ดู log ได้ที่ Cloudflare Dashboard → Workers & Pages →
`cssign-cloudinary-delete` → Logs (หรือรัน `npx wrangler tail` ตอนทดสอบ)

## ความปลอดภัย

- Worker เช็ค Firebase ID token ของผู้เรียกทุกครั้ง (ต้อง login อยู่เท่านั้น) สำหรับ `POST /`
  และ `POST /notify-line` — เส้นทางลบรูป (`POST /`) เช็คต่อว่า role ใน `staff/{uid}` ต้องเป็น
  `admin` เท่านั้นถึงจะลบได้ (ตรงกับ `isAdminRole()`) ส่วน `/notify-line` แค่ต้อง login
  (ตรงกับ `isAuthenticated()`) เพราะ staff ทั่วไปเปลี่ยนสถานะคำสั่งผลิตได้อยู่แล้ว
  (แก้ 2569-07-17 พร้อมกับ Phase 0 ช่องโหว่สิทธิ์ของเส้นทางลบรูป)
- จำกัด CORS ให้เรียกได้เฉพาะจาก `cssign.co.th` / `www.cssign.co.th`
  (แก้ได้ที่ `ALLOWED_ORIGINS` ใน `src/index.js` ถ้าโดเมนเปลี่ยน)
- API Key/Secret/Channel Access Token เก็บเป็น Worker secret ไม่ได้ฝังในโค้ดหรือ commit ขึ้น git
