// test/db-media.test.mjs — รอบที่ 148
//
// ขอบเขต: js/db-media.js (143 บรรทัด) — data layer อัปโหลด/ลบรูปและไฟล์บน Cloudinary
// (uploadImage, uploadFile, deleteImage — export ทั้ง 3 ตัว, compressImage()/parseCloudinaryUrl()
// เป็น private function ไม่ export แต่เทสผ่านทางอ้อมได้ผ่านพฤติกรรมของ uploadImage()/deleteImage())
//
// ก่อนรอบนี้ไฟล์นี้ **ไม่เคยมีเทสตรงเลยสักไฟล์** — มีแค่ถูกเรียกทางอ้อมจากเทสของแท็บแอดมินหลายไฟล์
// (admin-blog-form.test.mjs/admin-portfolio-form.test.mjs/
// admin-products-form.test.mjs/admin-settings-promo.test.mjs/admin-settings-videos.test.mjs/
// admin-utils.test.mjs/orders-tab-modal-sub-panels.test.mjs) แต่ทุกไฟล์
// นั้น **ข้ามการเทส uploadImage()/deleteImage() จริงไว้เสมอ** (บันทึกเหตุผลไว้ตรงกันตั้งแต่รอบ 106:
// "ยิง fetch จริงไปที่ api.cloudinary.com ไม่มี stub ให้ในสภาพแวดล้อมเทสนี้") — คือฟังก์ชันเป้าหมาย
// ของไฟล์นี้เองไม่เคยถูกเทสตรงๆ เลยสักเคส
//
// **สาเหตุจริงที่ถูกข้ามคือ `fetch` ระดับ global** ไม่ใช่ boundary ของ db-media.js เอง — Node 22 มี
// `fetch`/`File`/`Blob`/`FormData` เป็น native global อยู่แล้ว จึง**override `globalThis.fetch` เอง
// ในไฟล์เทสนี้ได้ตรงๆ ไม่ต้องพึ่งเครือข่ายจริงเลย** (เหมือนแพทเทิร์น `__GET_DOC_STUB__` ของ
// firebase-stub-loader.mjs แต่ทำระดับ global ปกติ ไม่ใช่ผ่าน loader เพราะ `fetch` ไม่ได้ import จาก
// URL พิเศษเหมือน Firebase SDK) — เก็บ arg ที่ถูกเรียกไว้ตรวจสอบได้ทุกเทส แล้วคืน `globalThis.fetch`
// เดิมกลับใน afterEach() เผื่อไฟล์เทสอื่นในสูทเดียวกันพึ่ง global นี้อยู่ (ยืนยันด้วย grep ทั้ง
// โปรเจกต์ก่อนว่าไม่มีไฟล์เทสไหน override `globalThis.fetch` ค้างไว้มาก่อน)
//
// **ยังไม่เทส compressImage() เส้นทางบีบอัดจริง** (canvas/createImageBitmap) เพราะ Node ไม่มี
// `createImageBitmap`/canvas 2D context เป็น global (jsdom เองก็ไม่ implement เต็ม ต้องพึ่ง npm
// package แยกต่างหากอย่าง "canvas" ที่ไม่มีอยู่ใน devDependencies ของโปรเจกต์) — **แต่ path นี้ยัง
// ถูกคลุมทางอ้อมได้จริงผ่านเคส "ไฟล์รูปที่ compressImage() ล้มเหลว"**: เมื่อเรียก uploadImage() ด้วย
// ไฟล์ type "image/png" (ไม่ใช่ svg และไม่ null) compressImage() จะพยายามเรียก `createImageBitmap()`
// ซึ่งไม่มีอยู่จริงในสภาพแวดล้อมนี้ → throw ReferenceError → เข้า `catch (err)` เดิมของฟังก์ชัน →
// `console.warn()` 1 ครั้ง + คืนไฟล์ต้นฉบับกลับไปใช้แทน (fallback path จริงตามโค้ด ไม่ใช่การจำลอง) —
// เทสเคสนี้ตรงๆ ได้เลยโดยไม่ต้องแก้/mock อะไรเพิ่มในโค้ดผลิตภัณฑ์ (พฤติกรรมนี้เกิดขึ้นจริงเป๊ะถ้ามีคน
// เปิดเว็บนี้ด้วยเบราว์เซอร์เก่าที่ไม่มี createImageBitmap ด้วยเช่นกัน ไม่ใช่แค่ quirk ของสภาพแวดล้อม
// เทส) — เส้นทาง "บีบอัดสำเร็จจริง" (คืนไฟล์ .jpg ใหม่) ยังคงข้ามไว้เหมือนเดิม ต้องมี "canvas" package
// เพิ่มถึงจะเทสได้ ซึ่งเกินขอบเขตงานรอบนี้ (เพิ่ม dependency ใหม่เข้าโปรเจกต์)
//
// ตรวจโค้ดจริงทั้งไฟล์ js/db-media.js ก่อนเขียนเทสนี้ (อ่านครบทุกบรรทัด) — ไม่พบบั๊ก จึงเป็นไฟล์เทส
// ล้วนๆ ไม่มีการแก้โค้ดผลิตภัณฑ์เลยแม้แต่บรรทัดเดียว
//
// **auth.currentUser**: import `{ auth }` ตรงจาก "../js/db.js" (ตัวเดียวกับที่ db-media.js ใช้ภายใน
// เพราะทั้งคู่ resolve ไป URL เดียวกัน ไม่มี query-string cache-bust) แล้ว mutate
// `auth.currentUser` ตรงๆ ในเทส (เป็น plain object literal จาก firebase-stub-loader.mjs
// `getAuth()` — ไม่ใช่ frozen object) จำลอง login/logout ได้ — คืนกลับเป็น `null` ใน afterEach()
// เสมอ กันเทสอื่นในไฟล์รั่วสถานะกัน (ยืนยันด้วย grep ทั้งโปรเจกต์ก่อนว่าไม่มีไฟล์เทสไหน mutate
// `auth.currentUser` ค้างไว้ก่อนรอบนี้ — เป็นแพทเทิร์นใหม่ของไฟล์นี้)

import { test, describe, afterEach } from "node:test";
import assert from "node:assert/strict";
import { uploadImage, uploadFile, deleteImage } from "../js/db-media.js";
import { auth } from "../js/db.js";

const originalFetch = globalThis.fetch;
const originalWarn = console.warn;

let fetchCalls;
let warnCalls;

function stubFetch(handler) {
  fetchCalls = [];
  globalThis.fetch = async (url, options) => {
    fetchCalls.push({ url, options });
    return handler(url, options);
  };
}

function stubWarn() {
  warnCalls = [];
  console.warn = (...args) => { warnCalls.push(args); };
}

function jsonResponse(ok, status, body) {
  return {
    ok,
    status,
    json: async () => body,
  };
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  console.warn = originalWarn;
  auth.currentUser = null;
});

// ── uploadFile() ──────────────────────────────────────────────
describe("uploadFile()", () => {
  test("อัปโหลดสำเร็จ → คืน secure_url ตรงๆ (ไม่มีการแก้ URL เหมือน uploadImage)", async () => {
    stubFetch(async () => jsonResponse(true, 200, { secure_url: "https://res.cloudinary.com/dizd3payw/raw/upload/v1/paisign/files/catalog.pdf" }));
    const file = new File(["%PDF-1.4"], "catalog.pdf", { type: "application/pdf" });

    const url = await uploadFile(file);

    assert.equal(url, "https://res.cloudinary.com/dizd3payw/raw/upload/v1/paisign/files/catalog.pdf");
    assert.equal(fetchCalls.length, 1);
    assert.equal(fetchCalls[0].url, "https://api.cloudinary.com/v1_1/dizd3payw/auto/upload");
    assert.equal(fetchCalls[0].options.method, "POST");
    assert.ok(fetchCalls[0].options.body instanceof FormData);
    assert.equal(fetchCalls[0].options.body.get("upload_preset"), "paisign_unsigned");
    // ไม่ระบุ folder → ใช้ค่าเริ่มต้น "paisign/files"
    assert.equal(fetchCalls[0].options.body.get("folder"), "paisign/files");
    assert.equal(fetchCalls[0].options.body.get("file"), file);
  });

  test("ระบุ folder เองได้ (ไม่ใช้ default)", async () => {
    stubFetch(async () => jsonResponse(true, 200, { secure_url: "https://res.cloudinary.com/dizd3payw/raw/upload/v1/paisign/warranty/x.pdf" }));
    const file = new File(["x"], "x.pdf", { type: "application/pdf" });

    await uploadFile(file, "paisign/warranty");

    assert.equal(fetchCalls[0].options.body.get("folder"), "paisign/warranty");
  });

  test("res.ok เป็น false → throw ข้อความแนะนำเช็ค upload preset (ไม่ throw ข้อความของ uploadImage)", async () => {
    stubFetch(async () => jsonResponse(false, 400, { error: "invalid preset" }));
    const file = new File(["x"], "x.pdf", { type: "application/pdf" });

    await assert.rejects(
      () => uploadFile(file),
      /อัปโหลดไฟล์ไม่สำเร็จ \(เช็คว่า Cloudinary preset เปิดรับไฟล์ประเภทนี้หรือยัง\)/
    );
  });
});

// ── uploadImage() ─────────────────────────────────────────────
describe("uploadImage()", () => {
  test("type เป็น image/svg+xml → compressImage() ข้ามการบีบอัด ใช้ไฟล์เดิมตรงๆ, secure_url ถูกแทรก transformation หลัง /upload/", async () => {
    stubFetch(async () => jsonResponse(true, 200, {
      secure_url: "https://res.cloudinary.com/dizd3payw/image/upload/v1699999999/paisign/products/logo.svg",
    }));
    const file = new File(["<svg></svg>"], "logo.svg", { type: "image/svg+xml" });

    const url = await uploadImage(file);

    assert.equal(
      url,
      "https://res.cloudinary.com/dizd3payw/image/upload/f_auto,q_auto,w_900,h_900,c_limit/v1699999999/paisign/products/logo.svg"
    );
    assert.equal(fetchCalls[0].url, "https://api.cloudinary.com/v1_1/dizd3payw/image/upload");
    assert.equal(fetchCalls[0].options.body.get("folder"), "paisign/products");
    // ไฟล์ที่แนบไปคือไฟล์ต้นฉบับเป๊ะ (ไม่ถูกแปลงเป็น .jpg ใหม่ เพราะ svg ข้ามการบีบอัด)
    assert.equal(fetchCalls[0].options.body.get("file"), file);
  });

  test("type ว่างเปล่า (falsy) → compressImage() ข้ามการบีบอัดเช่นกัน ใช้ไฟล์เดิม", async () => {
    stubFetch(async () => jsonResponse(true, 200, { secure_url: "https://res.cloudinary.com/dizd3payw/image/upload/v1/paisign/products/a.jpg" }));
    const file = new File(["a"], "a", { type: "" });

    await uploadImage(file);

    assert.equal(fetchCalls[0].options.body.get("file"), file);
  });

  test("type เป็นรูปจริง (image/png) แต่ไม่มี createImageBitmap ในสภาพแวดล้อมนี้ → compressImage() catch แล้วคืนไฟล์เดิม พร้อม console.warn 1 ครั้ง", async () => {
    stubWarn();
    stubFetch(async () => jsonResponse(true, 200, { secure_url: "https://res.cloudinary.com/dizd3payw/image/upload/v1/paisign/products/pic.jpg" }));
    assert.equal(typeof globalThis.createImageBitmap, "undefined", "สมมติฐานของเทสนี้: createImageBitmap ต้องไม่มีอยู่จริงในสภาพแวดล้อมนี้");
    const file = new File(["\x89PNG"], "pic.png", { type: "image/png" });

    const url = await uploadImage(file);

    assert.equal(warnCalls.length, 1);
    assert.equal(warnCalls[0][0], "compressImage: ข้ามการบีบอัด ใช้ไฟล์ต้นฉบับแทน");
    assert.ok(warnCalls[0][1] instanceof Error);
    // ยัง resolve จนจบ flow ปกติได้ (ไม่ throw ทั้ง uploadImage) เพราะ compressImage คืนไฟล์เดิมสำเร็จ
    assert.equal(url, "https://res.cloudinary.com/dizd3payw/image/upload/f_auto,q_auto,w_900,h_900,c_limit/v1/paisign/products/pic.jpg");
    assert.equal(fetchCalls[0].options.body.get("file"), file);
  });

  test("res.ok เป็น false → throw ข้อความเฉพาะของ uploadImage (คนละข้อความกับ uploadFile)", async () => {
    stubFetch(async () => jsonResponse(false, 500, {}));
    const file = new File(["x"], "x.svg", { type: "image/svg+xml" });

    await assert.rejects(() => uploadImage(file), /^Error: อัปโหลดรูปไม่สำเร็จ$/);
  });
});

// ── deleteImage() ─────────────────────────────────────────────
describe("deleteImage()", () => {
  test("URL ไม่ตรง pattern ของ Cloudinary เลย → warn แล้ว return (ไม่ยิง fetch เลย ไม่ต้อง login ด้วยซ้ำ)", async () => {
    stubWarn();
    stubFetch(async () => { throw new Error("ไม่ควรถูกเรียก"); });

    const result = await deleteImage("https://example.com/not-cloudinary.jpg");

    assert.equal(result, undefined);
    assert.equal(fetchCalls.length, 0);
    assert.equal(warnCalls.length, 1);
    assert.equal(warnCalls[0][0], "deleteImage: อ่านข้อมูลจาก Cloudinary URL ไม่ได้ ข้ามการลบ");
  });

  test("URL เป็น undefined/ไม่ใช่ string → parseCloudinaryUrl คืน null เช่นกัน ไม่ throw", async () => {
    stubWarn();
    stubFetch(async () => { throw new Error("ไม่ควรถูกเรียก"); });

    const result = await deleteImage(undefined);

    assert.equal(result, undefined);
    assert.equal(fetchCalls.length, 0);
  });

  test("URL ถูกต้องแต่ auth.currentUser เป็น null (ยังไม่ login) → warn แล้ว return โดยไม่ยิง fetch", async () => {
    stubWarn();
    stubFetch(async () => { throw new Error("ไม่ควรถูกเรียก"); });
    auth.currentUser = null;

    const result = await deleteImage("https://res.cloudinary.com/dizd3payw/image/upload/v1/paisign/products/abc.jpg");

    assert.equal(result, undefined);
    assert.equal(fetchCalls.length, 0);
    assert.equal(warnCalls[0][0], "deleteImage: ต้อง login ก่อนถึงจะลบรูปได้ ข้ามการลบ");
  });

  test("login แล้ว + URL ถูกต้อง → ยิง fetch ไป Cloudflare Worker พร้อม Bearer token, body เป็น resourceType/publicId ที่แกะถูกต้อง, คืนค่า data ตอนสำเร็จ", async () => {
    auth.currentUser = { getIdToken: async () => "fake-id-token" };
    stubFetch(async () => jsonResponse(true, 200, { deleted: true }));

    const result = await deleteImage(
      "https://res.cloudinary.com/dizd3payw/image/upload/f_auto,q_auto,w_900,h_900,c_limit/v1699999999/paisign/products/abc.jpg"
    );

    assert.deepEqual(result, { deleted: true });
    assert.equal(fetchCalls.length, 1);
    assert.equal(fetchCalls[0].url, "https://cssign-cloudinary-delete.zillergotspw.workers.dev");
    assert.equal(fetchCalls[0].options.method, "POST");
    assert.equal(fetchCalls[0].options.headers.Authorization, "Bearer fake-id-token");
    assert.equal(fetchCalls[0].options.headers["Content-Type"], "application/json");
    const body = JSON.parse(fetchCalls[0].options.body);
    // ยืนยันว่าตัด transformation segment (f_auto,q_auto,...) และ version segment (v169...) ออกแล้ว
    // เหลือแค่ public_id จริงโดยไม่มีนามสกุลไฟล์
    assert.deepEqual(body, { resourceType: "image", publicId: "paisign/products/abc" });
  });

  test("URL ไม่มี version segment (v123) เลย ตัดแค่ transformation segment ก็พอ", async () => {
    auth.currentUser = { getIdToken: async () => "tok" };
    stubFetch(async () => jsonResponse(true, 200, {}));

    await deleteImage("https://res.cloudinary.com/dizd3payw/raw/upload/f_auto/paisign/files/doc.pdf");

    const body = JSON.parse(fetchCalls[0].options.body);
    assert.deepEqual(body, { resourceType: "raw", publicId: "paisign/files/doc" });
  });

  test("URL เป็น video resource + มี query string ต่อท้าย → resourceType ถูกต้อง, query ถูกตัดออกจาก publicId", async () => {
    auth.currentUser = { getIdToken: async () => "tok" };
    stubFetch(async () => jsonResponse(true, 200, {}));

    await deleteImage("https://res.cloudinary.com/dizd3payw/video/upload/v1/paisign/portfolio/clip.mp4?_a=abc");

    const body = JSON.parse(fetchCalls[0].options.body);
    assert.deepEqual(body, { resourceType: "video", publicId: "paisign/portfolio/clip" });
  });

  test("public_id ไม่มีนามสกุลไฟล์เลย (ไม่มีจุด) → ใช้ทั้ง segment ตรงๆ ไม่ตัดอะไรผิด", async () => {
    auth.currentUser = { getIdToken: async () => "tok" };
    stubFetch(async () => jsonResponse(true, 200, {}));

    await deleteImage("https://res.cloudinary.com/dizd3payw/image/upload/v1/paisign/products/no-extension");

    const body = JSON.parse(fetchCalls[0].options.body);
    assert.deepEqual(body, { resourceType: "image", publicId: "paisign/products/no-extension" });
  });

  test("res.ok เป็น false + response.json() มี error message → throw รวมข้อความ error นั้นเข้าไปด้วย", async () => {
    auth.currentUser = { getIdToken: async () => "tok" };
    stubFetch(async () => jsonResponse(false, 403, { error: "forbidden: not the owner" }));

    await assert.rejects(
      () => deleteImage("https://res.cloudinary.com/dizd3payw/image/upload/v1/paisign/products/abc.jpg"),
      /^Error: ลบรูปบน Cloudinary ไม่สำเร็จ: forbidden: not the owner$/
    );
  });

  test("res.ok เป็น false + response.json() พังเอง (ไม่ใช่ JSON) → fallback ใช้ res.status แทนข้อความ error", async () => {
    auth.currentUser = { getIdToken: async () => "tok" };
    globalThis.fetch = async () => ({
      ok: false,
      status: 502,
      json: async () => { throw new SyntaxError("Unexpected token"); },
    });

    await assert.rejects(
      () => deleteImage("https://res.cloudinary.com/dizd3payw/image/upload/v1/paisign/products/abc.jpg"),
      /^Error: ลบรูปบน Cloudinary ไม่สำเร็จ: 502$/
    );
  });
});
