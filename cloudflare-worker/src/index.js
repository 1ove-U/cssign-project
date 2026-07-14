// ===========================
// cloudflare-worker/src/index.js — ลบรูปบน Cloudinary (server-side, signed)
// ===========================
// เหตุผลที่ต้องมี Worker: การลบไฟล์บน Cloudinary ต้องเซ็น request ด้วย
// API Secret ซึ่งห้ามฝังไว้ฝั่ง client (ต่างจากตอนอัปโหลดที่ใช้
// unsigned upload preset ได้) — Worker นี้ถือ secret ไว้แทน และตรวจ
// Firebase ID token ของผู้เรียกก่อนทุกครั้ง กันคนนอกยิงลบมั่ว
//
// วิธี deploy (ดูรายละเอียดเต็มใน cloudflare-worker/README.md):
//   cd cloudflare-worker
//   npm install
//   npx wrangler secret put CLOUDINARY_API_KEY
//   npx wrangler secret put CLOUDINARY_API_SECRET
//   npx wrangler deploy

import { jwtVerify, createRemoteJWKSet } from "jose";

const FIREBASE_PROJECT_ID = "cssign"; // ต้องตรงกับ projectId ใน js/db.js
const CLOUDINARY_CLOUD_NAME = "dizd3payw"; // ต้องตรงกับค่าใน js/db.js

// โดเมนที่อนุญาตให้เรียก Worker นี้ได้ (กัน CSRF-ish / คนอื่นเอา Worker ไปใช้ต่อ)
const ALLOWED_ORIGINS = new Set([
  "https://cssign.vercel.app",
  "https://cssign.co.th",
  "https://www.cssign.co.th",
]);

// Firebase เอกสารแนะนำ endpoint นี้สำหรับ verify ID token แบบไม่ใช้ Admin SDK
// (คืนค่าเป็น JWK พร้อมใช้กับ JOSE ตรงๆ ไม่ต้องแกะ x509 เอง)
const JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com")
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

async function sha1Hex(str) {
  const data = new TextEncoder().encode(str);
  const hashBuffer = await crypto.subtle.digest("SHA-1", data);
  return [...new Uint8Array(hashBuffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
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

    // ── 1) ต้องแนบ Firebase ID token ของผู้ที่ login อยู่มาด้วยเสมอ ──
    // (ตรงกับเงื่อนไข isAdmin() ที่ใช้ทั้งเว็บใน firestore.rules — แอดมิน/staff
    //  ที่ login ผ่าน Firebase Auth เท่านั้นถึงจะลบรูปได้)
    const authHeader = request.headers.get("Authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) {
      return json({ error: "unauthenticated" }, 401, headers);
    }
    try {
      await jwtVerify(token, JWKS, {
        issuer: `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`,
        audience: FIREBASE_PROJECT_ID,
      });
    } catch (err) {
      return json({ error: "invalid_token", message: String(err) }, 401, headers);
    }

    // ── 2) อ่าน publicId / resourceType ที่ js/db.js ส่งมา ──
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
    // Cloudinary: เรียงพารามิเตอร์ (ยกเว้น api_key/file/signature) ตามชื่อ,
    // ต่อกันด้วย & แล้วต่อท้ายด้วย api_secret จากนั้น SHA-1
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

    // "not found" ถือว่าลบสำเร็จได้เหมือนกัน (ไฟล์ไม่อยู่แล้วก็ถือว่าจบภารกิจ)
    if (data.result !== "ok" && data.result !== "not found") {
      return json({ error: "cloudinary_delete_failed", detail: data }, 502, headers);
    }
    return json({ result: data.result, publicId }, 200, headers);
  },
};
