// test/admin-onboarding.test.mjs — P1.6e: onboarding checklist ตอนล็อกอินครั้งแรก
//
// ขอบเขต: js/admin-onboarding.js (ไฟล์ใหม่ทั้งไฟล์) — maybeShowOnboarding(uid, opts) รับ
// root/storage ผ่าน opts ตรงๆ (แพทเทิร์นเดียวกับ applyRoleUI() ใน js/admin-role-ui.js) จึงเทส
// ได้โดยไม่ต้องพึ่ง firebase-stub-loader/admin-page-deps-stub-loader เลย ส่ง storage เป็น
// in-memory Map-based stub เอง (ไม่ใช่ localStorage จริง — jsdom ไม่ implement ให้ ดู
// test/admin-sidebar.test.mjs) ให้เทสควบคุม "เคยเห็นแล้วหรือยัง" ได้ชัดเจนทุกเคส
//
// **สำคัญเรื่องโครงสร้างเทสไฟล์นี้**: overlay เป็น module-level singleton (สร้างครั้งเดียว lazy
// แล้วใช้ซ้ำตลอดอายุโมดูล — เหมือน ensureConfirmOverlay()/ensureDayOverlay()) ทุกเทสในไฟล์นี้
// จึงใช้ root (document.body) เดียวกันตัวเดียวตลอดทั้งไฟล์ (ตั้งครั้งเดียวใน before()) แทนที่จะ
// สร้าง JSDOM ใหม่ต่อเทส (สร้างใหม่ต่อเทสจะทำให้ overlay ตัวแรกค้างอยู่กับ root เก่าที่ถูกทิ้งไป
// แล้ว ทดสอบผิดพลาด) — เทสในกลุ่ม "ปิด overlay" และ "edge cases" จึงเขียนแบบต่อเนื่องกัน
// (สถานะ overlay ที่เทสก่อนหน้าทิ้งไว้ กระทบเทสถัดไปจริง ตรงกับพฤติกรรมจริงในเบราว์เซอร์ที่หน้า
// เดียวมี overlay เดียวตลอด session) — แต่ละเทส reset สถานะที่จำเป็น (เช่น ปิด overlay ก่อน
// เริ่ม, storage ใหม่) เองอย่างชัดเจนก่อนเริ่ม assertion หลัก
//
// อ่านโค้ดจริงทั้งไฟล์ js/admin-onboarding.js ก่อนเขียนเทสนี้ — ไม่พบบั๊ก (นอกจาก closure จับ
// storage/uid ตอน wiring ครั้งแรกที่แก้ไปแล้วในรอบนี้เอง ก่อนเขียนเทสชุดนี้)

import { test, describe, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

let maybeShowOnboarding;
let document;
let root;

// storage stub ง่ายๆ (Map ธรรมดา) ตาม interface getItem/setItem ของ Storage จริง
function makeStorageStub() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
  };
}

function overlayEl() {
  return root.querySelector(".cp-onboard-overlay");
}

function click(el) {
  el.dispatchEvent(new document.defaultView.Event("click", { bubbles: true }));
}

function pressEscape() {
  document.dispatchEvent(new document.defaultView.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
}

before(async () => {
  const dom = new JSDOM(`<!doctype html><html><body></body></html>`);
  document = dom.window.document;
  root = document.body;
  const mod = await import("../js/admin-onboarding.js");
  maybeShowOnboarding = mod.maybeShowOnboarding;
});

describe("maybeShowOnboarding() — ครั้งแรกสุดของทั้งโมดูล (ยังไม่เคยสร้าง overlay เลย)", () => {
  test("storage ว่าง (ยังไม่เคยเห็น) → สร้าง overlay ใหม่ + แสดง (display: flex) พร้อมรายการ checklist ครบ 3 ข้อ", () => {
    assert.equal(overlayEl(), null); // ยืนยันว่านี่คือเทสแรกจริงๆ ที่ยังไม่มี overlay ค้างจากที่ไหน

    const storage = makeStorageStub();
    maybeShowOnboarding("uid-1", { root, storage });

    const overlay = overlayEl();
    assert.notEqual(overlay, null);
    assert.equal(overlay.style.display, "flex");
    assert.match(overlay.textContent, /ค้นหาแบบด่วน/);
    assert.match(overlay.textContent, /เลิกทำได้ภายใน 5 วินาที/);
    assert.match(overlay.textContent, /ยืนยันก่อนลบเสมอ/);
    assert.equal(root.querySelectorAll(".cp-onboard-overlay").length, 1);

    click(overlay.querySelector("#cp-onboard-ok")); // เก็บกวาดปิดไว้ก่อนเข้าเทสถัดไป
  });
});

describe("maybeShowOnboarding() — เคยปิดไปแล้ว (storage มีคีย์ค้างอยู่) → ไม่แสดงซ้ำ", () => {
  test("storage.getItem(key) === \"1\" ของ uid นี้ → เรียกแล้ว overlay ไม่เปิดขึ้นมา (display ยังเป็น none ต่อไป)", () => {
    const storage = makeStorageStub();
    storage.setItem("cssign_admin_onboarding_seen_v1:uid-seen", "1");

    maybeShowOnboarding("uid-seen", { root, storage });

    assert.equal(overlayEl().style.display, "none");
  });

  test("uid ต่างกัน → แยกกันคนละ key ใน storage (คนละบัญชี ไม่ควรถูกข้ามไปด้วยกัน)", () => {
    const storage = makeStorageStub();
    storage.setItem("cssign_admin_onboarding_seen_v1:uid-a", "1"); // uid-a เคยเห็นแล้ว

    maybeShowOnboarding("uid-b", { root, storage }); // uid-b ยังไม่เคยเห็น

    assert.equal(overlayEl().style.display, "flex");
    click(overlayEl().querySelector("#cp-onboard-ok"));
  });

  test("uid เป็น null/undefined → ไม่ throw, ใช้คีย์ fallback \"anon\", ยังไม่ mark จนกว่าจะปิด", () => {
    const storage = makeStorageStub();
    assert.doesNotThrow(() => maybeShowOnboarding(undefined, { root, storage }));
    assert.equal(overlayEl().style.display, "flex");
    assert.equal(storage.getItem("cssign_admin_onboarding_seen_v1:anon"), null);
    click(overlayEl().querySelector("#cp-onboard-ok"));
  });
});

describe("ปิด overlay ทั้ง 3 ทาง → ซ่อน overlay + บันทึกลง storage ของ uid ที่กำลังดูอยู่ตอนนั้น", () => {
  test("กดปุ่มปิด (ไอคอน ×) → ซ่อน + storage ถูก set เป็น \"1\"", () => {
    const storage = makeStorageStub();
    maybeShowOnboarding("uid-close-btn", { root, storage });
    const overlay = overlayEl();
    assert.equal(overlay.style.display, "flex");

    click(overlay.querySelector("#cp-onboard-close"));

    assert.equal(overlay.style.display, "none");
    assert.equal(storage.getItem("cssign_admin_onboarding_seen_v1:uid-close-btn"), "1");
  });

  test("กดปุ่ม \"เข้าใจแล้ว เริ่มใช้งาน\" → ซ่อน + บันทึก storage", () => {
    const storage = makeStorageStub();
    maybeShowOnboarding("uid-ok-btn", { root, storage });
    const overlay = overlayEl();

    click(overlay.querySelector("#cp-onboard-ok"));

    assert.equal(overlay.style.display, "none");
    assert.equal(storage.getItem("cssign_admin_onboarding_seen_v1:uid-ok-btn"), "1");
  });

  test("คลิก backdrop (นอกกล่องเนื้อหา) → ซ่อน + บันทึก storage", () => {
    const storage = makeStorageStub();
    maybeShowOnboarding("uid-backdrop", { root, storage });
    const overlay = overlayEl();

    click(overlay); // click ตรง overlay เอง (e.target === overlay) = backdrop

    assert.equal(overlay.style.display, "none");
    assert.equal(storage.getItem("cssign_admin_onboarding_seen_v1:uid-backdrop"), "1");
  });

  test("คลิกภายในกล่องเนื้อหา (ไม่ใช่ backdrop) → ไม่ปิด", () => {
    const storage = makeStorageStub();
    maybeShowOnboarding("uid-inner-click", { root, storage });
    const overlay = overlayEl();
    const box = overlay.querySelector(".cp-onboard-box");

    click(box);

    assert.equal(overlay.style.display, "flex");
    click(overlay.querySelector("#cp-onboard-ok")); // เก็บกวาด
  });

  test("กด Escape → ซ่อน + บันทึก storage (เฉพาะตอนกำลังแสดงอยู่)", () => {
    const storage = makeStorageStub();
    maybeShowOnboarding("uid-escape", { root, storage });
    const overlay = overlayEl();

    pressEscape();

    assert.equal(overlay.style.display, "none");
    assert.equal(storage.getItem("cssign_admin_onboarding_seen_v1:uid-escape"), "1");
  });

  test("กด Escape ตอน overlay ปิดอยู่แล้ว → ไม่ throw, ไม่ mark storage ของ uid ที่ไม่เคยแสดงเลย", () => {
    const storage = makeStorageStub(); // uid ใหม่ที่ยังไม่เคยแสดงเลย (overlay ยังไม่เปิดให้ uid นี้)
    assert.doesNotThrow(() => pressEscape());
    assert.equal(storage.getItem("cssign_admin_onboarding_seen_v1:uid-never-shown"), null);
  });

  test("บัญชีอื่น login ต่อในแท็บเดียวกัน (SPA ไม่ reload หน้า) → ปิด overlay ต้อง mark storage ของบัญชีล่าสุดที่กำลังดูอยู่ ไม่ใช่บัญชีแรกที่เคยเรียกฟังก์ชันนี้", () => {
    const storageX = makeStorageStub();
    maybeShowOnboarding("uid-x", { root, storage: storageX }); // บัญชี X login ก่อน เห็น overlay
    // บัญชี X ยังไม่ทันปิด บัญชี Y login ต่อทันที (storage คนละก้อน คนละ uid)
    const storageY = makeStorageStub();
    maybeShowOnboarding("uid-y", { root, storage: storageY });
    const overlay = overlayEl();
    assert.equal(overlay.style.display, "flex");

    click(overlay.querySelector("#cp-onboard-ok")); // บัญชี Y เป็นคนกดปิด

    // ต้อง mark ให้ storage ของ Y (คนที่กำลังดูอยู่จริง) ไม่ใช่ X
    assert.equal(storageY.getItem("cssign_admin_onboarding_seen_v1:uid-y"), "1");
    assert.equal(storageX.getItem("cssign_admin_onboarding_seen_v1:uid-x"), null);
  });
});

describe("maybeShowOnboarding() — edge cases", () => {
  test("ไม่มี root เลยและไม่มี global document (opts เปล่าทั้งหมด) → ไม่ throw, ไม่ทำอะไร", () => {
    // ไฟล์นี้ไม่ได้ผูก globalThis.document เอง (ทุกเทสด้านบนส่ง root ผ่าน opts ตรงๆ เสมอ) —
    // ยืนยันเส้นทาง "ไม่มี container" คืนออกเงียบๆ โดยไม่ throw เหมือน applyRoleUI()
    assert.doesNotThrow(() => maybeShowOnboarding("uid-no-root", { root: null, storage: makeStorageStub() }));
  });

  test("opts.storage: null ตรงๆ (จำลอง \"ไม่มี localStorage\" เช่น private mode) → ยังแสดง overlay ได้ปกติ ไม่ throw, ปิดแล้วไม่ throw ตอน markSeen เช่นกัน", () => {
    assert.doesNotThrow(() => maybeShowOnboarding("uid-no-storage", { root, storage: null }));
    const overlay = overlayEl();
    assert.equal(overlay.style.display, "flex");

    assert.doesNotThrow(() => click(overlay.querySelector("#cp-onboard-ok")));
    assert.equal(overlay.style.display, "none");
  });

  test("เรียกซ้ำสองครั้งติดกันในเซสชันเดียวกัน (uid เดิม ยังไม่ปิด) → ไม่สร้าง overlay ซ้ำสองชุด (ยังคงมีแค่ 1 element ในหน้า)", () => {
    const storage = makeStorageStub();
    maybeShowOnboarding("uid-repeat", { root, storage });
    maybeShowOnboarding("uid-repeat", { root, storage });

    assert.equal(root.querySelectorAll(".cp-onboard-overlay").length, 1);
    click(overlayEl().querySelector("#cp-onboard-ok")); // เก็บกวาด
  });
});
