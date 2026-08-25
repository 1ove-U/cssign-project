// cloudflare-worker/test/link-line.test.mjs — P1.5 (LIFF auto-link) — Worker-side test
//
// เทส handleLinkLine() ผ่าน default export ของ src/index.js ตรงๆ (worker.fetch(request, env))
// ไม่ตั้ง test runner แยก (vitest/miniflare) เพราะ endpoint นี้ไม่ได้พึ่ง Workers-only API อะไร
// ที่ Node ไม่มี (แค่ fetch/crypto.subtle/Response ซึ่ง Node 22 มีให้ในตัวอยู่แล้ว) — ใช้
// node:test แบบเดียวกับฝั่ง frontend (ดู ../../test/track-modal-liff-link.test.mjs) เพื่อไม่ต้อง
// เพิ่ม dependency ใหม่ (jose มีอยู่แล้วเป็น dependency ของ src/index.js เอง)
//
// วิธี mock:
//   - LINE JWKS (https://api.line.me/oauth2/v2.1/certs) → สร้าง RSA keypair จริงด้วย jose
//     เอง แล้ว mock global.fetch ให้คืน JWKS ที่มี public key ตัวนี้ ใช้เซ็น "LIFF ID token"
//     ปลอมแบบถูกต้องตามรูปแบบจริงทุกประการ (iss/aud/sub/exp) — เพื่อเทสเคส "สำเร็จ" ได้จริง
//     ไม่ใช่แค่ mock ให้ผ่านลอยๆ
//   - Firestore runQuery (…documents:runQuery) → mock global.fetch คืนค่า order document
//     ปลอมตามแต่ละเคส (ไม่พบ / พบ)
//   - FIREBASE_SA_PRIVATE_KEY (สำหรับเซ็น custom token) → สร้าง RSA keypair แยกอีกชุดด้วย
//     node:crypto (PKCS8 PEM) ไม่ใช่ key จริงของ Firebase (เทสนี้ไม่ต้องยิง Firebase Auth จริง
//     แค่เช็คว่า custom token ที่เซ็นออกมามี claim ถูกต้อง — decode ด้วย jose.decodeJwt() ซึ่ง
//     ไม่ verify signature พอสำหรับตรวจ payload)
//
// สำคัญ — ทำไม npm test ต้องรันด้วย `node --conditions=workerd`:
// jose มี build แยก 2 ชุดสำหรับ createRemoteJWKSet(): บน Cloudflare Workers จริง (runtime
// "workerd") มันใช้ global fetch() แต่พอรันผ่าน plain `node` เฉยๆ (ตาม export condition
// "import" ปกติของ package.json) jose จะสลับไปใช้ node:http/node:https ตรงๆ แทน (ไม่ผ่าน
// global.fetch เลย) ทำให้ mock fetch ด้านล่างไม่มีผล และมันจะพยายามต่อเน็ตจริงไปหา
// api.line.me ซึ่ง network ของ sandbox/CI ส่วนใหญ่ไม่ได้เปิดโดเมนนี้ไว้ → ค้าง/timeout
// การสั่ง `--conditions=workerd` (ตั้งไว้แล้วใน package.json script "test") บังคับ Node
// ให้ resolve "jose" ไปที่ build เดียวกับที่ใช้จริงบน Cloudflare Workers (ใช้ fetch())
// ทำให้ mock ด้านล่างทำงานตรงกับพฤติกรรมจริงบน production ด้วย — ถ้ารันไฟล์นี้ตรงๆ ด้วย
// `node --test test/link-line.test.mjs` เฉยๆ (ไม่มี --conditions=workerd) จะค้าง/พังที่เคส
// "สำเร็จ" กับเคส audience ไม่ตรง เพราะพยายามต่อเน็ตจริง ต้องรันผ่าน `npm test` เท่านั้น
//
// ครอบ 3 เคสตามสเปกเดิม (line-liff-autolink-spec.md):
//   1) idToken ปลอม/verify ไม่ผ่าน → 401 invalid_line_token
//   2) code/เบอร์ไม่ตรงกับ order จริง → 404 order_not_found
//   3) สำเร็จ → 200 พร้อม customToken ที่ decode แล้วมี claim trackingId/lineUserId ถูกต้อง,
//      orderId เป็น real doc id
// บวกเคส input-validation ที่คุ้มเทสเพิ่มถูกๆ (missing_id_token, missing_code_or_phone) เพราะ
// เป็น branch แยกใน handleLinkLine() ที่ยังไม่มีการันตีเลย

import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPair, exportJWK, SignJWT, decodeJwt } from "jose";
import { generateKeyPairSync } from "node:crypto";

// รูปแบบเดียวกับของจริง "{channelId}-{suffix}" (เช่น "2011108044-Nmgfktx5") — ตั้งใจใส่ขีด
// ไว้ในเทสเพื่อจับบั๊กแบบที่เจอจริงใน production: aud ของ ID token คือ channel ID ล้วนๆ
// ก่อนขีดเท่านั้น ไม่ใช่ LIFF_ID เต็มทั้งสตริง (ดูคอมเมนต์ channelIdFromLiffId() ใน src/index.js)
const LIFF_ID = "1234567890-testSuffix1";
const LINE_CHANNEL_ID = LIFF_ID.split("-")[0]; // ค่าที่ควรอยู่ใน aud จริง
const FIREBASE_PROJECT_ID = "cssign"; // ต้องตรงกับ src/index.js
const LINE_CERTS_URL = "https://api.line.me/oauth2/v2.1/certs";
const RUN_QUERY_URL_SUFFIX = `/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents:runQuery`;
const LINE_KID = "test-line-kid-1";

// ── buildTrackingId — คัดลอก logic เดียวกับ src/index.js (และ js/db-orders.js) มาไว้ในเทส
// เพื่อคำนวณค่าที่ "ควรจะเป็น" แล้ว assert เทียบกับผลจริงจาก endpoint (ไม่ import ข้ามจาก
// src/index.js เพราะฟังก์ชันนั้นไม่ได้ export — การคัดลอกมาเทียบตรงนี้คือสิ่งที่เทสต้องทำอยู่แล้ว) ──
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

let worker;
let lineKeyPair; // { publicKey, privateKey } สำหรับเซ็น/verify LIFF ID token จำลอง
let lineJwks; // JWKS document (public) ที่จะให้ mock fetch คืนกลับตอน verify
let firebaseSaPrivateKeyPem; // PKCS8 PEM จำลอง แทน FIREBASE_SA_PRIVATE_KEY จริง

before(async () => {
  worker = (await import("../src/index.js")).default;

  lineKeyPair = await generateKeyPair("RS256", { extractable: true });
  const publicJwk = await exportJWK(lineKeyPair.publicKey);
  lineJwks = { keys: [{ ...publicJwk, kid: LINE_KID, alg: "RS256", use: "sig" }] };

  const { privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  firebaseSaPrivateKeyPem = privateKey;
});

function baseEnv(overrides) {
  return {
    LIFF_ID,
    FIREBASE_SA_CLIENT_EMAIL: "test-sa@cssign.iam.gserviceaccount.com",
    FIREBASE_SA_PRIVATE_KEY: firebaseSaPrivateKeyPem,
    ...overrides,
  };
}

async function makeLineIdToken({ sub = "U_line_user_123", aud = LINE_CHANNEL_ID, iss = "https://access.line.me", expiresIn = "10m" } = {}) {
  return new SignJWT({})
    .setProtectedHeader({ alg: "RS256", kid: LINE_KID })
    .setIssuedAt()
    .setIssuer(iss)
    .setAudience(aud)
    .setSubject(sub)
    .setExpirationTime(expiresIn)
    .sign(lineKeyPair.privateKey);
}

// mock global.fetch — คืนค่าตาม URL ที่ handleLinkLine() ยิงออกไปจริง (LINE JWKS /
// Firestore runQuery) เคสไหนไม่ตั้ง runQueryResult ไว้ = ไม่ควรถูกเรียกถึง (เช่นเคส idToken
// ปลอมที่ควรตายตั้งแต่ verify ก่อนถึง Firestore)
function installFetchMock({ runQueryResult } = {}) {
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const u = String(url);
    if (u.startsWith(LINE_CERTS_URL)) {
      return new Response(JSON.stringify(lineJwks), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (u.includes(RUN_QUERY_URL_SUFFIX)) {
      if (!runQueryResult) throw new Error("installFetchMock: ไม่คาดว่าจะมีการเรียก Firestore runQuery ในเคสนี้");
      return new Response(JSON.stringify(runQueryResult), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    throw new Error("installFetchMock: unexpected fetch url ที่ไม่ได้ mock ไว้ -> " + u);
  };
  return () => {
    globalThis.fetch = original;
  };
}

function makeRequest(body) {
  return new Request("https://worker.test/link-line", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /link-line", () => {
  test("idToken ปลอม (malformed/แก้ payload เอง) → 401 invalid_line_token", async () => {
    const restore = installFetchMock();
    try {
      const res = await worker.fetch(
        makeRequest({ idToken: "this-is-not-a-valid-jwt", code: "PO2569001", phone: "0812345678" }),
        baseEnv()
      );
      assert.equal(res.status, 401);
      const data = await res.json();
      assert.equal(data.error, "invalid_line_token");
    } finally {
      restore();
    }
  });

  test("idToken เซ็นถูกแต่ audience ไม่ตรง LIFF_ID → 401 invalid_line_token (verify ไม่ผ่าน)", async () => {
    const restore = installFetchMock();
    try {
      const idToken = await makeLineIdToken({ aud: "some-other-liff-id" });
      const res = await worker.fetch(
        makeRequest({ idToken, code: "PO2569001", phone: "0812345678" }),
        baseEnv()
      );
      assert.equal(res.status, 401);
      const data = await res.json();
      assert.equal(data.error, "invalid_line_token");
    } finally {
      restore();
    }
  });

  test("idToken ถูกต้อง แต่ code/เบอร์ไม่ตรงกับ order จริง → 404 order_not_found", async () => {
    const restore = installFetchMock({ runQueryResult: [] }); // Firestore ไม่พบ document ที่ trackingId ตรงกัน
    try {
      const idToken = await makeLineIdToken({ sub: "U_line_user_123" });
      const res = await worker.fetch(
        makeRequest({ idToken, code: "PO-NOT-REAL", phone: "0000000000" }),
        baseEnv()
      );
      assert.equal(res.status, 404);
      const data = await res.json();
      assert.equal(data.error, "order_not_found");
    } finally {
      restore();
    }
  });

  test("code/phone build trackingId ไม่ได้ (เบอร์สั้นกว่า 4 หลัก) → 404 order_not_found โดยไม่ยิง Firestore เลย", async () => {
    const restore = installFetchMock(); // ไม่ตั้ง runQueryResult ไว้ — ถ้าโค้ดยิง Firestore จริงจะ throw ทันที ยืนยันว่า short-circuit ก่อนถึง network
    try {
      const idToken = await makeLineIdToken({ sub: "U_line_user_123" });
      const res = await worker.fetch(
        makeRequest({ idToken, code: "PO2569001", phone: "12" }),
        baseEnv()
      );
      assert.equal(res.status, 404);
      const data = await res.json();
      assert.equal(data.error, "order_not_found");
    } finally {
      restore();
    }
  });

  test("สำเร็จ → 200 พร้อม customToken ที่ decode แล้วมี claim trackingId/lineUserId ถูกต้อง, orderId เป็น real doc id", async () => {
    const realOrderDocId = "abc123RealOrderDocId";
    const restore = installFetchMock({
      runQueryResult: [
        {
          document: {
            name: `projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/orders/${realOrderDocId}`,
          },
        },
      ],
    });
    try {
      const lineUserId = "U_real_line_user_456";
      const idToken = await makeLineIdToken({ sub: lineUserId });
      const code = "PO-2569-001";
      const phone = "081-234-5678";
      const expectedTrackingId = buildTrackingId(code, phone);

      const res = await worker.fetch(makeRequest({ idToken, code, phone }), baseEnv());
      assert.equal(res.status, 200);
      const data = await res.json();

      assert.equal(data.orderId, realOrderDocId);
      assert.equal(data.trackingId, expectedTrackingId);
      assert.equal(data.lineUserId, lineUserId);
      assert.ok(typeof data.customToken === "string" && data.customToken.length > 0);

      // decode (ไม่ verify signature — key เซ็นเป็น key จำลองในเทสนี้ ไม่ใช่ของ Firebase จริง)
      // แค่เช็คว่า claim ที่ handleLinkLine() ใส่เข้าไปตรงตามที่ firestore.rules คาดหวัง
      const payload = decodeJwt(data.customToken);
      assert.equal(payload.uid, `line_${lineUserId}`);
      assert.equal(payload.claims.trackingId, expectedTrackingId);
      assert.equal(payload.claims.lineUserId, lineUserId);
      assert.equal(payload.aud, "https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit");
    } finally {
      restore();
    }
  });

  test("ไม่ส่ง idToken มา → 400 missing_id_token", async () => {
    const res = await worker.fetch(makeRequest({ code: "PO2569001", phone: "0812345678" }), baseEnv());
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.error, "missing_id_token");
  });

  test("ส่ง idToken มาแต่ไม่ส่ง code/phone → 400 missing_code_or_phone", async () => {
    const res = await worker.fetch(makeRequest({ idToken: "whatever" }), baseEnv());
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.error, "missing_code_or_phone");
  });

  test("Worker ยังไม่ได้ตั้ง LIFF_ID (server misconfigured) → 500 server_misconfigured", async () => {
    const res = await worker.fetch(
      makeRequest({ idToken: "whatever", code: "PO2569001", phone: "0812345678" }),
      baseEnv({ LIFF_ID: undefined })
    );
    assert.equal(res.status, 500);
    const data = await res.json();
    assert.equal(data.error, "server_misconfigured");
  });
});
