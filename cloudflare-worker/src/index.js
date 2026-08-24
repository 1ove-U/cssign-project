// ===========================
// cloudflare-worker/src/index.js — ลบรูปบน Cloudinary + verify Turnstile (server-side)
// ===========================
// Worker นี้ทำ 4 หน้าที่แยกกันตาม path (ยัง deploy เป็น service เดียวเหมือนเดิม
// ไม่ต้องเปิด Worker ใหม่ ไม่กระทบเพดานฟรีของ Cloudflare Workers):
//
//   POST /                  → ลบรูปบน Cloudinary (ต้อง login + role admin เท่านั้น)
//   POST /verify-turnstile  → ยืนยัน Turnstile token ของฟอร์มสาธารณะ (ไม่ต้อง login
//                             เพราะฟอร์ม contact/quote ถูกกรอกได้โดยยังไม่ล็อกอิน)
//   POST /line-webhook      → (ชั่วคราว) รับ event จาก LINE เพื่อดู User ID ผ่าน log
//                             ลบออกได้เมื่อหา User ID ครบแล้ว
//   POST /notify-line       → ส่งข้อความแจ้งเตือนผ่าน LINE Messaging API (P1.4 — ต้อง
//                             login เท่านั้น ไม่บังคับ role admin เพราะ staff ทั่วไปก็
//                             เปลี่ยนสถานะคำสั่งผลิตได้ตาม firestore.rules อยู่แล้ว)
//   POST /link-line         → (P1.5) ลูกค้ากดปุ่ม "เชื่อมบัญชี LINE" ในหน้าเช็คสถานะ (LIFF)
//                             ไม่ต้อง Firebase login (ลูกค้าไม่มีบัญชี staff) — verify LIFF ID
//                             token กับ LINE JWKS เอง แล้วเซ็น Firebase custom token จำกัดสิทธิ์
//                             ให้ ดู handleLinkLine() ด้านล่างสำหรับรายละเอียดเต็ม
//   POST /line-login         → (P2.8c-C) "login กว้าง" ด้วย LINE อย่างเดียว ไม่ผูก order เดียว
//                             เหมือน /link-line — รับแค่ idToken (ไม่ต้อง code/phone) ออก custom
//                             token ที่มีแค่ claim lineUserId (ไม่มี trackingId) ให้สิทธิ์แค่ "อ่าน
//                             ออเดอร์ที่ lineUserId ตรงกัน" ตาม firestore.rules ที่มีอยู่แล้วจาก
//                             P2.8c-1 — ดู handleLineLogin() ด้านล่างสำหรับรายละเอียดเต็ม
//
// เหตุผลที่ลบรูปต้องมี Worker: การลบไฟล์บน Cloudinary ต้องเซ็น request ด้วย
// API Secret ซึ่งห้ามฝังไว้ฝั่ง client (ต่างจากตอนอัปโหลดที่ใช้
// unsigned upload preset ได้) — Worker นี้ถือ secret ไว้แทน และตรวจ
// Firebase ID token ของผู้เรียกก่อนทุกครั้ง กันคนนอกยิงลบมั่ว จากนั้นเช็ค
// role จาก staff/{uid} ต่อ (ต้องเป็น 'admin' เท่านั้นถึงลบได้ — ตรงกับ
// isAdminRole() ใน firestore.rules) กัน staff ที่ "แก้ได้แต่ลบไม่ได้" หลุด
// มาลบรูปได้ผ่านช่องทางนี้ (2569-07-17 แก้ช่องโหว่: เดิมเช็คแค่ login)
//
// เหตุผลที่ยิง LINE ต้องมี Worker เหมือนกัน: LINE Channel Access Token เป็นความลับ
// ห้ามฝังฝั่ง client เช่นกัน (ต่างจาก LINE Login LIFF ID ที่เปิดเผยได้) — รูปแบบ auth
// เหมือน endpoint ลบรูปด้านบนทุกประการ (ต้องแนบ Firebase ID token) แต่ไม่เช็ค role
// admin ต่อ เพราะ P1.4 นี้ผูกกับจุดเปลี่ยนสถานะคำสั่งผลิตซึ่ง staff ทั่วไปทำได้อยู่แล้ว
// (isAuthenticated() ใน firestore.rules ไม่ใช่ isAdminRole()) — ดูรายละเอียดเพิ่มเติมที่
// handleNotifyLine() ด้านล่าง
//
// วิธี deploy (ดูรายละเอียดเต็มใน cloudflare-worker/README.md):
//   cd cloudflare-worker
//   npm install
//   npx wrangler secret put CLOUDINARY_API_KEY
//   npx wrangler secret put CLOUDINARY_API_SECRET
//   npx wrangler secret put TURNSTILE_SECRET_KEY
//   npx wrangler secret put LINE_CHANNEL_ACCESS_TOKEN
//   npx wrangler secret put FIREBASE_SA_CLIENT_EMAIL   (P1.5 — เซ็น custom token เท่านั้น
//   npx wrangler secret put FIREBASE_SA_PRIVATE_KEY     ไม่ใช่ service account god-mode)
//   npx wrangler deploy
// (LIFF_ID ไม่ใช่ secret — ตั้งเป็น [vars] ใน wrangler.toml เพราะเปิดเผยได้ปกติ)

import { jwtVerify, createRemoteJWKSet, SignJWT, importPKCS8 } from "jose";

const FIREBASE_PROJECT_ID = "cssign"; // ต้องตรงกับ projectId ใน js/db.js
const CLOUDINARY_CLOUD_NAME = "dizd3payw"; // ต้องตรงกับค่าใน js/db-media.js

// LINE ID token (จาก liff.getIDToken()) verify ด้วย JWKS ของ LINE เอง — คนละชุดกับ
// JWKS ของ Firebase ด้านล่าง (Firebase สำหรับ verify Authorization header ปกติของ staff,
// อันนี้สำหรับ verify ตัวตนลูกค้าที่ login ผ่าน LINE ใน LIFF app)
const LINE_JWKS = createRemoteJWKSet(new URL("https://api.line.me/oauth2/v2.1/certs"));

// ── buildTrackingId — ต้อง match กับ js/db-orders.js เป๊ะ (คัดลอกมา ไม่ import ข้าม
// runtime ได้ เพราะฝั่งนี้รันบน Cloudflare Workers ไม่ใช่ browser/bundler เดียวกัน) ──
// รหัสยืนยัน = เลข PO (ตัดอักขระที่ไม่ใช่ A-Z0-9 ออก) + เบอร์โทร 4 หลักสุดท้าย
function sanitizeCodeForId(code) {
  return String(code || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}
function last4Digits(phone) {
  return String(phone || "").replace(/\D/g, "").slice(-4);
}
function buildTrackingId(code, phone) {
  const c = sanitizeCodeForId(code);
  const p = last4Digits(phone);
  if (!c || p.length < 4) return null;
  return `${c}_${p}`;
}

// โดเมนที่อนุญาตให้เรียก Worker นี้ได้ (กัน CSRF-ish / คนอื่นเอา Worker ไปใช้ต่อ)
const ALLOWED_ORIGINS = new Set([
  "https://cssign.vercel.app",
  "https://cssign.co.th",
  "https://www.cssign.co.th",
  "http://127.0.0.1:5500",
  "http://localhost:5500",
]);

// Firebase เอกสารแนะนำ endpoint นี้สำหรับ verify ID token แบบไม่ใช้ Admin SDK
// (คืนค่าเป็น JWK พร้อมใช้กับ JOSE ตรงๆ ไม่ต้องแกะ x509 เอง)
const JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com")
);

// สำหรับเช็ค hostname ที่ siteverify คืนมา (ไม่มี scheme) — derive จาก ALLOWED_ORIGINS
// เดียวกันด้านบน กันไม่ให้ต้องแก้ 2 ที่เวลาโดเมนเปลี่ยน
const ALLOWED_HOSTNAMES = new Set(
  [...ALLOWED_ORIGINS].map((o) => o.replace(/^https?:\/\//, ""))
);

function corsHeaders(origin) {
  const allowOrigin = ALLOWED_ORIGINS.has(origin) ? origin : "";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Vary": "Origin",
  };
}

function json(obj, status, headers) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

// ── verifyLineIdToken — verify LIFF ID token กับ LINE JWKS จริง คืน lineUserId ที่ verify
// แล้ว (payload.sub) — ใช้ร่วมกันระหว่าง /link-line และ /line-login (ทั้งคู่ verify แบบ
// เดียวกันเป๊ะ ต่างกันแค่ว่าทำอะไรต่อหลัง verify ผ่าน) throw ถ้า verify ไม่ผ่านหรือไม่มี sub
// ในผลลัพธ์ ให้ผู้เรียกจับเองแล้วแปลงเป็น response ตามบริบทของ endpoint นั้นๆ ──
async function verifyLineIdToken(idToken, liffId) {
  const { payload } = await jwtVerify(idToken, LINE_JWKS, {
    issuer: "https://access.line.me",
    audience: liffId,
  });
  const lineUserId = payload.sub;
  if (!lineUserId || typeof lineUserId !== "string") {
    throw new Error("missing sub");
  }
  return lineUserId;
}

async function sha1Hex(str) {
  const data = new TextEncoder().encode(str);
  const hashBuffer = await crypto.subtle.digest("SHA-1", data);
  return [...new Uint8Array(hashBuffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ── /verify-turnstile ──────────────────────────────────────────
// Public endpoint (ไม่ต้อง login): รับ token จาก widget ฝั่ง client แล้วยิงไป
// เช็คกับ Cloudflare siteverify ตรงๆ ด้วย secret key ที่เก็บเป็น Worker secret
// (ห้ามฝัง secret นี้ฝั่ง client เด็ดขาด — ต่างจาก site key ที่เปิดเผยได้ปกติ)
async function handleVerifyTurnstile(request, headers, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_json" }, 400, headers);
  }
  const token = body && body.token;
  if (!token || typeof token !== "string") {
    return json({ success: false, error: "missing_token" }, 400, headers);
  }
  if (!env.TURNSTILE_SECRET_KEY) {
    return json({ success: false, error: "server_misconfigured", message: "TURNSTILE_SECRET_KEY ยังไม่ได้ตั้งค่าบน Worker" }, 500, headers);
  }

  const remoteIp = request.headers.get("CF-Connecting-IP") || "";
  const form = new URLSearchParams({ secret: env.TURNSTILE_SECRET_KEY, response: token });
  if (remoteIp) form.set("remoteip", remoteIp);

  let data;
  try {
    const cfRes = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
    });
    data = await cfRes.json();
  } catch (err) {
    return json({ success: false, error: "siteverify_request_failed", message: String(err) }, 502, headers);
  }

  // Defense-in-depth: siteverify คืน hostname ที่ widget ถูก solve จริง (คนละชั้นกับ CORS
  // Origin header) — เช็คซ้ำกับ ALLOWED_HOSTNAMES กันกรณี token ถูกขโมยไปยิงจากที่อื่น
  // (ALLOWED_ORIGINS ด้านบนเป็น "https://domain" ส่วน siteverify คืนแค่ "domain" เฉยๆ)
  const ok = !!data.success && (!data.hostname || ALLOWED_HOSTNAMES.has(data.hostname));
  return json({ success: ok, errorCodes: data["error-codes"] || [] }, 200, headers);
}

// ── /line-webhook (ชั่วคราว — ใช้หา User ID เท่านั้น ไม่ใช่ของถาวร) ──────
// LINE จะยิง POST มาที่ path นี้ทุกครั้งที่มีเหตุการณ์เกิดขึ้นกับ Official Account
// (เช่น มีคนเพิ่มเพื่อน, ส่งข้อความมาหาบอท) — เราแค่ log ข้อมูลออกมาให้ดูผ่าน
// `npx wrangler tail` เพื่อเอา User ID (ขึ้นต้นด้วย "U") ไปใช้ทดสอบ P1.4
// ไม่ต้องเช็ค signature เพราะแค่ใช้ดู log ชั่วคราว ไม่ได้เก็บ/ประมวลผลอะไรต่อ —
// ลบ endpoint นี้ออกได้เมื่อหา User ID ที่ต้องการครบแล้ว (ไม่ใช่ของที่ต้องเก็บถาวร)
async function handleLineWebhook(request, headers) {
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response("ok", { status: 200, headers });
  }
  const events = (body && body.events) || [];
  for (const ev of events) {
    const userId = ev?.source?.userId || "(ไม่มี userId ในอีเวนต์นี้)";
    const type = ev?.type || "unknown";
    const text = ev?.message?.text ? ` ข้อความ: "${ev.message.text}"` : "";
    console.log(`[line-webhook] type=${type} userId=${userId}${text}`);
  }
  // LINE ต้องได้ 200 กลับไปเสมอ ไม่งั้นจะลองยิง webhook ซ้ำ
  return new Response("ok", { status: 200, headers });
}

// ── /notify-line ───────────────────────────────────────────────
// P1.4a: ส่ง push message ผ่าน LINE Messaging API แทนทีมงาน/ระบบ (เรียกจาก
// js/line-notify.js sendOrderStatusLine() ตอนสถานะคำสั่งผลิตเปลี่ยน — pattern เดียวกับ
// EmailJS ใน js/email-notify.js แต่ต้องผ่าน Worker เพราะ Channel Access Token เป็นความลับ
// ห้ามฝังฝั่ง client) — ผู้เรียกต้อง login แล้วเท่านั้น (เช็คใน fetch() ก่อนเรียกฟังก์ชันนี้)
// แต่ไม่บังคับ role admin เพิ่มเหมือน endpoint ลบรูป เพราะ staff ทั่วไปเปลี่ยนสถานะคำสั่งผลิต
// ได้อยู่แล้วตาม firestore.rules (isAuthenticated() ไม่ใช่ isAdminRole())
async function handleNotifyLine(request, headers, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_json" }, 400, headers);
  }
  // P1.4d: trim ตัด whitespace/newline แปลกปลอมที่อาจติดมาจากการ copy-paste user ID
  // (เช่นเผลอ copy รวมช่องว่างท้ายบรรทัด) — ป้องกันเคสที่ to ดูถูกต้องตอนพิมพ์ตาแต่มีอักขระ
  // แฝงอยู่จริงในสตริง
  const to = typeof body?.to === "string" ? body.to.trim() : body?.to;
  const message = body && body.message;
  if (!to || typeof to !== "string") {
    return json({ error: "missing_to" }, 400, headers);
  }
  if (!message || typeof message !== "string") {
    return json({ error: "missing_message" }, 400, headers);
  }
  if (!env.LINE_CHANNEL_ACCESS_TOKEN) {
    return json(
      { error: "server_misconfigured", message: "LINE_CHANNEL_ACCESS_TOKEN ยังไม่ได้ตั้งค่าบน Worker" },
      500,
      headers
    );
  }

  let data;
  try {
    const lineRes = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({ to, messages: [{ type: "text", text: message }] }),
    });
    if (lineRes.status === 200) {
      return json({ result: "ok" }, 200, headers);
    }
    // P1.4c: เดิม .json().catch(() => ({})) กลืน error message จริงจาก LINE ทิ้งไปเงียบๆ
    // เวลา body ไม่ใช่ JSON (หรือ parse ไม่ผ่านด้วยเหตุอื่น) ทำให้ debug ไม่ได้ว่า LINE บ่นว่าอะไร
    // แก้โดย clone response ไว้ก่อน แล้ว fallback ไปอ่านเป็น text ถ้า .json() ล้มเหลว จะได้เห็น
    // ข้อความ error ตัวเต็มจาก LINE เสมอ (เช่น "not a friend" / invalid uid format ฯลฯ) พร้อม
    // console.error ไว้ฝั่ง Worker ด้วย จะได้เห็นผ่าน `npx wrangler tail` โดยไม่ต้องพึ่ง response
    // ฝั่ง client เพียงอย่างเดียว
    const lineResClone = lineRes.clone();
    data = await lineRes.json().catch(async () => {
      const raw = await lineResClone.text().catch(() => "");
      return { raw };
    });
    console.error("[notify-line] LINE API push failed:", lineRes.status, JSON.stringify(data));
    return json({ error: "line_push_failed", status: lineRes.status, detail: data }, 502, headers);
  } catch (err) {
    return json({ error: "line_request_failed", message: String(err) }, 502, headers);
  }
}

// ── /link-line ────────────────────────────────────────────────
// P1.5: ลูกค้ากดปุ่ม "เชื่อมบัญชี LINE" ในหน้าเช็คสถานะ (js/track-modal.js, ผ่าน LIFF SDK)
// Public endpoint (ไม่ต้อง Firebase login — ลูกค้าไม่มีบัญชี staff) แต่ "ไม่เชื่อ client เลย"
// เหมือนทุก endpoint public อื่นในไฟล์นี้: ต้อง verify ทั้งสองฝั่งก่อนออก token ให้เสมอ —
//   1) LINE ID token (จาก liff.getIDToken()) → verify กับ LINE JWKS จริง ได้ lineUserId
//      ที่ verify แล้ว (payload.sub) ไม่เชื่อค่าที่ client ส่งมาตรงๆ
//   2) code+phone → ต้อง build เป็น trackingId แล้วมี order จริงใน collection "orders" ที่
//      trackingId ตรงกัน (มาตรฐานเดียวกับหน้า track ปกติ — พิสูจน์ว่า "รู้ทั้ง PO และเบอร์โทร
//      ของออเดอร์นี้จริง" ไม่ใช่แค่เดา)
// ผ่านทั้งสองข้อแล้วเท่านั้นถึงเซ็น Firebase custom token ให้ (จำกัดสิทธิ์แค่ trackingId เดียว
// ผ่าน firestore.rules — ดูเงื่อนไข "หรือ" ใน allow update ของ orders/{id}) — Worker เองไม่มี
// สิทธิ์เขียน Firestore ตรงๆ เลย (ไม่ถือ service account god-mode) แค่ "รับรองตัวตน" แล้วส่ง
// custom token กลับไปให้ client เขียนเองผ่าน SDK ปกติ ให้ rules เป็นคนตัดสินสิทธิ์เหมือน
// ทุก write อื่นในระบบนี้
async function handleLinkLine(request, headers, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_json" }, 400, headers);
  }
  const idToken = body && body.idToken;
  const code = body && body.code;
  const phone = body && body.phone;
  if (!idToken || typeof idToken !== "string") {
    return json({ error: "missing_id_token" }, 400, headers);
  }
  if (!code || typeof code !== "string" || !phone || typeof phone !== "string") {
    return json({ error: "missing_code_or_phone" }, 400, headers);
  }
  if (!env.LIFF_ID) {
    return json({ error: "server_misconfigured", message: "LIFF_ID ยังไม่ได้ตั้งค่าบน Worker" }, 500, headers);
  }
  if (!env.FIREBASE_SA_CLIENT_EMAIL || !env.FIREBASE_SA_PRIVATE_KEY) {
    return json(
      { error: "server_misconfigured", message: "FIREBASE_SA_CLIENT_EMAIL/FIREBASE_SA_PRIVATE_KEY ยังไม่ได้ตั้งค่าบน Worker" },
      500,
      headers
    );
  }

  // ── 1) verify LIFF ID token กับ LINE JWKS จริง — payload.sub คือ lineUserId ที่ verify แล้ว
  // (audience ต้องตรงกับ LIFF ID/Channel ID กัน token จาก LIFF app อื่นหลุดเข้ามาใช้ได้) ──
  let lineUserId;
  try {
    lineUserId = await verifyLineIdToken(idToken, env.LIFF_ID);
  } catch (err) {
    return json({ error: "invalid_line_token", message: String(err) }, 401, headers);
  }

  // ── 2) ตรวจ code+phone ว่าเป็น order จริง — build trackingId แบบเดียวกับ js/db-orders.js
  // แล้ว query collection "orders" ตรงๆ ด้วย runQuery (ไม่ผ่าน client SDK/rules เพราะ Worker
  // เป็นคน query เอง ไม่มี Authorization header แนบ — ต้องใช้ runQuery ไม่ใช่ GET doc ตรงๆ
  // เพราะเราไม่รู้ doc id ของ orders/{id} ล่วงหน้า มีแต่ trackingId ที่เป็น field ข้างใน) ──
  const trackingId = buildTrackingId(code, phone);
  if (!trackingId) {
    return json({ error: "order_not_found" }, 404, headers);
  }

  let orderId;
  try {
    const queryRes = await fetch(
      `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents:runQuery`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          structuredQuery: {
            from: [{ collectionId: "orders" }],
            where: {
              fieldFilter: {
                field: { fieldPath: "trackingId" },
                op: "EQUAL",
                value: { stringValue: trackingId },
              },
            },
            limit: 1,
          },
        }),
      }
    );
    if (queryRes.status !== 200) {
      return json({ error: "order_lookup_failed", status: queryRes.status }, 502, headers);
    }
    const rows = await queryRes.json();
    const docPath = rows?.[0]?.document?.name;
    // ชื่อ doc เต็มรูปแบบ ".../documents/orders/{id}" — เอาแค่ตัวสุดท้ายมาใช้เป็น order id
    orderId = docPath ? docPath.split("/").pop() : null;
  } catch (err) {
    return json({ error: "order_lookup_failed", message: String(err) }, 502, headers);
  }
  if (!orderId) {
    // ไม่พบ order ที่ trackingId ตรงกัน = code/เบอร์โทรไม่ตรงกับออเดอร์จริง (พิสูจน์ตัวตนไม่ผ่าน
    // มาตรฐานเดียวกับตอนค้นหาในหน้า track ปกติ — ไม่บอกรายละเอียดเพิ่มเติมว่าอันไหนผิด กัน
    // ไล่เดา code หรือเบอร์โทรทีละส่วน)
    return json({ error: "order_not_found" }, 404, headers);
  }

  // ── 3) เซ็น Firebase custom token เอง ด้วย jose (ไม่พึ่ง firebase-admin SDK) — โครงสร้าง
  // ต้องตรงตาม spec ของ Firebase custom token จาก third-party JWT library ดูอ้างอิงที่
  // https://firebase.google.com/docs/auth/admin/create-custom-tokens#create_custom_tokens_using_a_third-party_jwt_library
  // claim trackingId ผูกสิทธิ์ไว้แคบมาก — firestore.rules จะยอมให้แก้ได้แค่ field lineUserId
  // ของ order ที่ trackingId ตรงกันเท่านั้น (ดู allow update ของ orders/{id})
  let customToken;
  try {
    const privateKey = await importPKCS8(env.FIREBASE_SA_PRIVATE_KEY, "RS256");
    const now = Math.floor(Date.now() / 1000);
    customToken = await new SignJWT({
      uid: `line_${lineUserId}`, // Firebase Auth uid เทียม (ไม่ผูกกับ staff account จริง)
      claims: { trackingId, lineUserId },
    })
      .setProtectedHeader({ alg: "RS256" })
      .setIssuedAt(now)
      .setExpirationTime(now + 3600)
      .setIssuer(env.FIREBASE_SA_CLIENT_EMAIL)
      .setSubject(env.FIREBASE_SA_CLIENT_EMAIL)
      .setAudience("https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit")
      .sign(privateKey);
  } catch (err) {
    return json({ error: "sign_token_failed", message: String(err) }, 500, headers);
  }

  return json({ customToken, trackingId, orderId, lineUserId }, 200, headers);
}

// ── /line-login ───────────────────────────────────────────────
// P2.8c-C: "login กว้าง" ด้วย LINE เพียงอย่างเดียว ไม่ผูกกับ order เดียวแบบ /link-line —
// ใช้ตอนลูกค้าเปิดหน้า "ออเดอร์ของฉัน" (P2.8c-D/E) แล้วกด "เข้าสู่ระบบด้วย LINE" โดยไม่ต้องกรอก
// PO/เบอร์โทรก่อน — Public endpoint เหมือน /link-line (ลูกค้าไม่มีบัญชี staff) แต่ต่างกันตรงที่
// ไม่ query Firestore หา order ใดๆ เลย เพราะจุดประสงค์คือแค่ "รับรองว่าเป็นเจ้าของ LINE user
// นี้จริง" — สิทธิ์ที่ token นี้ให้จำกัดอยู่แล้วที่ชั้น firestore.rules (อ่านได้เฉพาะ order ที่
// lineUserId ตรงกัน เขียนไม่ได้เลย จาก P2.8c-1) จึงปลอดภัยแม้จะออก token ให้ทุกคนที่ login LINE
// สำเร็จโดยไม่ต้องพิสูจน์ความเป็นเจ้าของออเดอร์ก่อน — claim มีแค่ { lineUserId } เท่านั้น
// (ไม่มี trackingId เหมือน /link-line เพราะไม่ได้ผูกกับ order เดียว)
async function handleLineLogin(request, headers, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_json" }, 400, headers);
  }
  const idToken = body && body.idToken;
  if (!idToken || typeof idToken !== "string") {
    return json({ error: "missing_id_token" }, 400, headers);
  }
  if (!env.LIFF_ID) {
    return json({ error: "server_misconfigured", message: "LIFF_ID ยังไม่ได้ตั้งค่าบน Worker" }, 500, headers);
  }
  if (!env.FIREBASE_SA_CLIENT_EMAIL || !env.FIREBASE_SA_PRIVATE_KEY) {
    return json(
      { error: "server_misconfigured", message: "FIREBASE_SA_CLIENT_EMAIL/FIREBASE_SA_PRIVATE_KEY ยังไม่ได้ตั้งค่าบน Worker" },
      500,
      headers
    );
  }

  // ── 1) verify LIFF ID token กับ LINE JWKS จริง (helper เดียวกับ /link-line) ──
  let lineUserId;
  try {
    lineUserId = await verifyLineIdToken(idToken, env.LIFF_ID);
  } catch (err) {
    return json({ error: "invalid_line_token", message: String(err) }, 401, headers);
  }

  // ── 2) เซ็น Firebase custom token — claim มีแค่ lineUserId เท่านั้น (ไม่มี trackingId
  // ต่างจาก /link-line เพราะ token นี้ไม่ได้ผูกกับ order เดียว) ──
  let customToken;
  try {
    const privateKey = await importPKCS8(env.FIREBASE_SA_PRIVATE_KEY, "RS256");
    const now = Math.floor(Date.now() / 1000);
    customToken = await new SignJWT({
      uid: `line_${lineUserId}`, // uid เทียมเดียวกับ /link-line กันสับสน (คนเดียวกัน = uid เดียวกัน)
      claims: { lineUserId },
    })
      .setProtectedHeader({ alg: "RS256" })
      .setIssuedAt(now)
      .setExpirationTime(now + 3600)
      .setIssuer(env.FIREBASE_SA_CLIENT_EMAIL)
      .setSubject(env.FIREBASE_SA_CLIENT_EMAIL)
      .setAudience("https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit")
      .sign(privateKey);
  } catch (err) {
    return json({ error: "sign_token_failed", message: String(err) }, 500, headers);
  }

  return json({ customToken, lineUserId }, 200, headers);
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const headers = corsHeaders(origin);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers });
    }
    if (request.method !== "POST") {
      return json({ error: "method_not_allowed" }, 405, headers);
    }

    // ── 0) เส้นทางสาธารณะ (ไม่ต้อง login) แยกออกไปก่อนเช็ค auth ด้านล่าง ──
    const pathname = new URL(request.url).pathname;
    if (pathname === "/verify-turnstile") {
      return handleVerifyTurnstile(request, headers, env);
    }
    if (pathname === "/line-webhook") {
      return handleLineWebhook(request, headers);
    }
    if (pathname === "/link-line") {
      return handleLinkLine(request, headers, env);
    }
    if (pathname === "/line-login") {
      return handleLineLogin(request, headers, env);
    }

    // ── 1) ต้องแนบ Firebase ID token ของผู้ที่ login อยู่มาด้วยเสมอ ──
    const authHeader = request.headers.get("Authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) {
      return json({ error: "unauthenticated" }, 401, headers);
    }
    let uid;
    try {
      const { payload } = await jwtVerify(token, JWKS, {
        issuer: `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`,
        audience: FIREBASE_PROJECT_ID,
      });
      uid = payload.user_id || payload.sub;
    } catch (err) {
      return json({ error: "invalid_token", message: String(err) }, 401, headers);
    }
    if (!uid) {
      return json({ error: "invalid_token", message: "missing uid" }, 401, headers);
    }

    // ── 1a) /notify-line ต้อง login เท่านั้น (เช็คแล้วด้านบน) ไม่ต้องเช็ค role admin
    // เพิ่มเหมือนเส้นทางลบรูปด้านล่าง — แยกออกไปตรงนี้ก่อนถึงส่วนเช็ค role ──
    if (pathname === "/notify-line") {
      return handleNotifyLine(request, headers, env);
    }

    // ── 1b) เช็ค role จาก staff/{uid} ก่อนอนุญาตให้ลบ — แค่ login ไม่พอ ──
    try {
      const staffRes = await fetch(
        `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/staff/${uid}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (staffRes.status === 200) {
        const staffDoc = await staffRes.json();
        const role = staffDoc?.fields?.role?.stringValue;
        if (role !== "admin") {
          return json({ error: "forbidden", message: "ต้องเป็น role admin เท่านั้นถึงจะลบรูปได้" }, 403, headers);
        }
      } else if (staffRes.status !== 404) {
        return json({ error: "role_check_failed", status: staffRes.status }, 502, headers);
      }
    } catch (err) {
      return json({ error: "role_check_failed", message: String(err) }, 502, headers);
    }

    // ── 2) อ่าน publicId / resourceType ที่ js/db-media.js (deleteImage) ส่งมา ──
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "invalid_json" }, 400, headers);
    }
    const publicId = body && body.publicId;
    const resourceType = ["image", "video", "raw"].includes(body?.resourceType) ? body.resourceType : "image";
    if (!publicId || typeof publicId !== "string") {
      return json({ error: "invalid_public_id" }, 400, headers);
    }

    // ── 3) เซ็น request ด้วย SHA-1 แล้วยิงไป Cloudinary destroy ──
    const timestamp = Math.floor(Date.now() / 1000);
    const toSign = `public_id=${publicId}&timestamp=${timestamp}${env.CLOUDINARY_API_SECRET}`;
    const signature = await sha1Hex(toSign);

    const form = new URLSearchParams({
      public_id: publicId,
      timestamp: String(timestamp),
      api_key: env.CLOUDINARY_API_KEY,
      signature,
    });

    let data;
    try {
      const cloudinaryRes = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${resourceType}/destroy`,
        { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: form }
      );
      data = await cloudinaryRes.json();
    } catch (err) {
      return json({ error: "cloudinary_request_failed", message: String(err) }, 502, headers);
    }

    if (data.result !== "ok" && data.result !== "not found") {
      return json({ error: "cloudinary_delete_failed", detail: data }, 502, headers);
    }
    return json({ result: data.result, publicId }, 200, headers);
  },
};
