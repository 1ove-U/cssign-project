// cloudflare-worker/test/line-login.test.mjs — P2.8c-C (LINE "login กว้าง") — Worker-side test
//
// เทส handleLineLogin() ผ่าน default export ของ src/index.js ตรงๆ (worker.fetch(request, env))
// รูปแบบเดียวกับ test/link-line.test.mjs ทุกจุด (ดูคอมเมนต์ในไฟล์นั้นสำหรับเหตุผลที่ต้องรันด้วย
// `node --conditions=workerd` — jose ต้อง resolve ไป build ที่ใช้ global fetch() ไม่งั้นจะพยายาม
// ต่อเน็ตจริงไปหา api.line.me แล้วค้าง/timeout) — endpoint นี้ไม่แตะ Firestore เลย (ต่างจาก
// /link-line ที่ query runQuery หา order) จึง mock แค่ LINE JWKS พอ ไม่ต้อง mock Firestore
//
// ครอบตามที่ระบุไว้ใน p2.8c-line-customer-plan.md หัวข้อ P2.8c-2:
//   1) idToken ปลอม/verify ไม่ผ่าน → 401 invalid_line_token
//   2) idToken เซ็นถูกแต่ audience ไม่ตรง LIFF_ID → 401 invalid_line_token
//   3) สำเร็จ → 200 พร้อม customToken ที่ decode แล้วมี claim lineUserId ถูกต้อง ไม่มี
//      trackingId เจือปน (ต่างจาก /link-line)
// บวกเคส input-validation/server-misconfigured ที่คุ้มเทสเพิ่มถูกๆ เพราะเป็น branch แยกใน
// handleLineLogin() ที่ยังไม่มีการันตีเลย (แพทเทิร์นเดียวกับ link-line.test.mjs)

import { test, describe, before } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPair, exportJWK, SignJWT, decodeJwt } from "jose";
import { generateKeyPairSync } from "node:crypto";

// รูปแบบเดียวกับของจริง "{channelId}-{suffix}" (เช่น "2011108044-Nmgfktx5") — ตั้งใจใส่ขีด
// ไว้ในเทสเพื่อจับบั๊กแบบที่เจอจริงใน production: aud ของ ID token คือ channel ID ล้วนๆ
// ก่อนขีดเท่านั้น ไม่ใช่ LIFF_ID เต็มทั้งสตริง (ดูคอมเมนต์ channelIdFromLiffId() ใน src/index.js)
const LIFF_ID = "1234567890-testSuffix1";
const LINE_CHANNEL_ID = LIFF_ID.split("-")[0]; // ค่าที่ควรอยู่ใน aud จริง
const LINE_CERTS_URL = "https://api.line.me/oauth2/v2.1/certs";
const LINE_KID = "test-line-kid-1";

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

// mock global.fetch — /line-login ยิงแค่ LINE JWKS เท่านั้น ไม่มี Firestore runQuery
// เลย (ต่างจาก /link-line) — เรียก URL อื่นใดก็ถือว่าไม่คาดคิด ให้ throw ทันที
function installFetchMock() {
  const original = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.startsWith(LINE_CERTS_URL)) {
      return new Response(JSON.stringify(lineJwks), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    throw new Error("installFetchMock: unexpected fetch url ที่ไม่ได้ mock ไว้ -> " + u);
  };
  return () => {
    globalThis.fetch = original;
  };
}

function makeRequest(body) {
  return new Request("https://worker.test/line-login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /line-login", () => {
  test("idToken ปลอม (malformed) → 401 invalid_line_token", async () => {
    const restore = installFetchMock();
    try {
      const res = await worker.fetch(makeRequest({ idToken: "this-is-not-a-valid-jwt" }), baseEnv());
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
      const res = await worker.fetch(makeRequest({ idToken }), baseEnv());
      assert.equal(res.status, 401);
      const data = await res.json();
      assert.equal(data.error, "invalid_line_token");
    } finally {
      restore();
    }
  });

  test("สำเร็จ → 200 พร้อม customToken ที่ decode แล้วมี claim lineUserId ถูกต้อง ไม่มี trackingId เจือปน", async () => {
    const restore = installFetchMock();
    try {
      const lineUserId = "U_real_line_user_456";
      const idToken = await makeLineIdToken({ sub: lineUserId });

      const res = await worker.fetch(makeRequest({ idToken }), baseEnv());
      assert.equal(res.status, 200);
      const data = await res.json();

      assert.equal(data.lineUserId, lineUserId);
      assert.equal(data.trackingId, undefined); // ไม่มี trackingId เจือปนต่างจาก /link-line
      assert.equal(data.orderId, undefined);
      assert.ok(typeof data.customToken === "string" && data.customToken.length > 0);

      // decode (ไม่ verify signature — key เซ็นเป็น key จำลองในเทสนี้ ไม่ใช่ของ Firebase จริง)
      const payload = decodeJwt(data.customToken);
      assert.equal(payload.uid, `line_${lineUserId}`);
      assert.equal(payload.claims.lineUserId, lineUserId);
      assert.equal(payload.claims.trackingId, undefined); // claim ต้องไม่มี trackingId เลย
      assert.deepEqual(Object.keys(payload.claims).sort(), ["lineUserId"]);
      assert.equal(payload.aud, "https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit");
    } finally {
      restore();
    }
  });

  test("ไม่ส่ง idToken มา → 400 missing_id_token", async () => {
    const res = await worker.fetch(makeRequest({}), baseEnv());
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.error, "missing_id_token");
  });

  test("body ไม่ใช่ JSON ที่ parse ได้ → 400 invalid_json", async () => {
    const res = await worker.fetch(
      new Request("https://worker.test/line-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not json at all {{{",
      }),
      baseEnv()
    );
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.error, "invalid_json");
  });

  test("Worker ยังไม่ได้ตั้ง LIFF_ID (server misconfigured) → 500 server_misconfigured", async () => {
    const res = await worker.fetch(makeRequest({ idToken: "whatever" }), baseEnv({ LIFF_ID: undefined }));
    assert.equal(res.status, 500);
    const data = await res.json();
    assert.equal(data.error, "server_misconfigured");
  });

  test("Worker ยังไม่ได้ตั้ง FIREBASE_SA_CLIENT_EMAIL/FIREBASE_SA_PRIVATE_KEY → 500 server_misconfigured", async () => {
    const res = await worker.fetch(
      makeRequest({ idToken: "whatever" }),
      baseEnv({ FIREBASE_SA_CLIENT_EMAIL: undefined, FIREBASE_SA_PRIVATE_KEY: undefined })
    );
    assert.equal(res.status, 500);
    const data = await res.json();
    assert.equal(data.error, "server_misconfigured");
  });

  test("OPTIONS /line-login (preflight) → 204 ไม่ต้อง idToken", async () => {
    const res = await worker.fetch(
      new Request("https://worker.test/line-login", { method: "OPTIONS" }),
      baseEnv()
    );
    assert.equal(res.status, 204);
  });
});
