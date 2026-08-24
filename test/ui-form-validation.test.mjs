// test/ui-form-validation.test.mjs — รอบที่ 90
//
// js/ui-form-validation.js ไม่เคยมีไฟล์เทสของตัวเองมาก่อนเลย (ถูกใช้ผ่าน 2 ไฟล์:
// js/orders-tab-modal.js กับ js/admin-products-form.js — เทสของ orders-tab-modal.js ทดสอบผ่าน
// การเรียกจริงเป็นเพียงบางเคส ไม่ครอบคลุมทุกฟังก์ชันของไฟล์นี้) — รอบนี้เจ้าของเว็บสั่งให้ตรวจ root
// cause ของบั๊ก recursion ที่พบตอนเขียนเทส Phase 1 ในรอบที่ 89 (validateFormInline() gate เจอ
// "Maximum call stack size exceeded" ที่ jsdom ดักไว้ได้แต่ไม่ควรเกิดขึ้นเลย)
//
// ### root cause ที่พบ (ยืนยันแล้ว แก้แล้วในรอบนี้)
// attachInlineValidation(form) ผูก listener "invalid" ไว้กับทุก [required] field ที่เรียก
// field.checkValidity() ซ้ำข้างในตัวเอง — แต่ตาม HTML spec การเรียก checkValidity() ตอนที่ field
// invalid อยู่แล้วจะ "ยิง invalid event ใหม่ทุกครั้งที่เรียกไม่มีข้อยกเว้น" (ไม่มี native
// reentrancy guard) ดังนั้นเมื่อ validateFormInline(form) (เรียกตอน submit) เจอ field ที่ required
// แต่ว่าง แล้วเรียก field.checkValidity() ตรงๆ → ยิง "invalid" event → โดน listener ของ
// attachInlineValidation() ที่เรียก checkValidity() ซ้ำ → ยิง "invalid" อีกรอบ → วนซ้ำไม่จบจนสแต็กล้น
// — เกิดขึ้นได้ทุกครั้งที่ผู้ใช้กด submit ฟอร์มที่มี required field ว่างอยู่ (ทั้ง orders-tab-modal.js
// และ admin-products-form.js เพราะทั้งคู่เรียกทั้ง attachInlineValidation()+validateFormInline() คู่
// กันกับฟอร์มเดียวกัน) — ผลจริงที่สังเกตได้ตอนทดสอบ: ฟังก์ชันคืนค่าถูกต้อง (ไม่ submit) เพราะ browser/
// jsdom ดัก exception จากความลึกของ recursion ไว้ภายใน event-dispatch algorithm เอง (ไม่ throw ออกมา
// ให้โค้ดเรา) แต่ยังเสี่ยง lag/console error รกทุกครั้งที่ submit ฟอร์มไม่ครบ — แก้แล้วโดยเปลี่ยน
// "invalid" listener ให้ไม่เรียก checkValidity() ซ้ำอีก (รู้อยู่แล้วว่า invalid เพราะ event นี้เองที่
// บอก) แค่โชว์ inline error ตรงๆ พอ — ดูคอมเมนต์เต็มที่ js/ui-form-validation.js
//
// ไฟล์นี้ทดสอบทุกฟังก์ชัน export ของ js/ui-form-validation.js ให้ครบเป็นครั้งแรก ไม่ใช่แค่เคส
// recursion — ใช้ jsdom + import โมดูลครั้งเดียวสำหรับทั้งไฟล์ (before(), ไม่ใช่ต่อเทส) ตาม
// สถาปัตยกรรมที่สรุปไว้ในรอบที่ 89 (แม้ไฟล์นี้จะไม่มีปัญหา module ลูกค้าง document เหมือน
// orders-tab-modal.js เพราะเป็นยูทิลิตี้ทั่วไปไม่ผูกกับ DOM เฉพาะของ admin.html เลย — แต่ยังใช้
// pattern เดียวกันเพื่อความสม่ำเสมอ + ประหยัดเวลา import ซ้ำ) — สร้างฟอร์มสังเคราะห์เอง (ไม่ต้องอ่าน
// admin.html เพราะไฟล์นี้ generic ไม่ผูกกับ id เฉพาะหน้าไหนเลย) — ล้าง document.body ก่อนแต่ละเทส
// ที่สร้างฟอร์มใหม่กันข้อมูลจากเทสก่อนหน้าตกค้าง — ยกเว้นกลุ่มที่ทดสอบ isAnyFormDirty()/
// attachUnsavedGuard() ที่ผูกกับ _allGuardTrackers (module-level state สะสมทุก guard ที่เคยสร้างมา
// ตลอดทั้งไฟล์ ไม่มีทาง reset จากภายนอก) — จึงออกแบบเทสกลุ่มนั้นให้ไม่พึ่งพา "false เพราะไม่มี tracker
// เลย" ยกเว้นเทสแรกสุดของไฟล์ (ก่อน guard อื่นถูกสร้างขึ้นเลย)

import { test, describe, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

let document;
let showFieldError, clearFieldError, attachInlineValidation, validateFormInline,
    createDirtyTracker, isAnyFormDirty, attachUnsavedGuard;

before(async () => {
  const dom = new JSDOM(`<!doctype html><html><body></body></html>`, { url: "https://example.test/" });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Event = dom.window.Event;
  dom.window.HTMLElement.prototype.scrollIntoView = function () {}; // validateFormInline() เรียกตอน field ผิด

  const mod = await import("../js/ui-form-validation.js");
  ({ showFieldError, clearFieldError, attachInlineValidation, validateFormInline,
     createDirtyTracker, isAnyFormDirty, attachUnsavedGuard } = mod);
  document = dom.window.document;
});

// helper: ฟอร์มสังเคราะห์ 2 required field (text + email) + 1 optional
// หมายเหตุ: เอาแค่ <form> เก่าออก ห้ามใช้ document.body.innerHTML = "" เด็ดขาด — เพราะ
// confirmDialog() (js/ui-helpers.js) cache <div class="cp-confirm-overlay"> ไว้ใน module-level
// variable ครั้งเดียวแล้ว append เข้า document.body แค่ครั้งแรกที่เรียก (ensureConfirmOverlay()
// เช็คแค่ว่า variable นั้นตั้งค่าไว้แล้วหรือยัง ไม่เช็คว่ายังอยู่ใน DOM จริงไหม) — ถ้าล้าง body ทั้งหมด
// ทิ้ง overlay ตัวนี้จะหลุดจาก document แต่โมดูลยังคิดว่ามีอยู่แล้วไม่สร้างใหม่ให้ ทำให้เทสกลุ่ม
// attachUnsavedGuard() หา ".cp-confirm-overlay" ผ่าน document.querySelector() ไม่เจอเลย (เจอจริง
// ตอนพัฒนาไฟล์นี้)
function makeForm() {
  document.body.querySelectorAll("form").forEach(f => f.remove());
  const form = document.createElement("form");
  form.innerHTML = `
    <input id="f-name" required />
    <input id="f-email" type="email" required />
    <input id="f-optional" />
  `;
  document.body.appendChild(form);
  return form;
}

function dispatchEvt(el, type) {
  el.dispatchEvent(new document.defaultView.Event(type, { bubbles: true, cancelable: true }));
}

describe("isAnyFormDirty() — เช็คก่อน guard ตัวแรกถูกสร้างเลย (ต้องเป็นเทสแรกสุดของไฟล์นี้)", () => {
  test("ยังไม่มี guard ไหนถูกสร้างเลย → false", () => {
    assert.equal(isAnyFormDirty(), false);
  });
});

describe("showFieldError()/clearFieldError() (รอบที่ 90)", () => {
  test("showFieldError: เพิ่ม class cl-invalid + สร้าง .cl-field-error sibling พร้อมข้อความ", () => {
    const form = makeForm();
    const field = form.querySelector("#f-name");

    showFieldError(field, "กรุณากรอกชื่อ");

    assert.ok(field.classList.contains("cl-invalid"));
    const err = field.nextElementSibling;
    assert.ok(err.classList.contains("cl-field-error"));
    assert.ok(err.classList.contains("active"));
    assert.equal(err.textContent, "กรุณากรอกชื่อ");
  });

  test("showFieldError เรียกซ้ำ 2 ครั้ง: ใช้ error element ตัวเดิมซ้ำ ไม่สร้างใหม่ซ้อนกัน", () => {
    const form = makeForm();
    const field = form.querySelector("#f-name");

    showFieldError(field, "ข้อความแรก");
    const errFirst = field.nextElementSibling;
    showFieldError(field, "ข้อความที่สอง");
    const errSecond = field.nextElementSibling;

    assert.equal(errFirst, errSecond, "ต้องเป็น element เดิม ไม่สร้างใหม่ซ้อน");
    assert.equal(errSecond.textContent, "ข้อความที่สอง");
    // ต้องไม่มี .cl-field-error เกิน 1 ตัวติดกับ field นี้
    assert.equal(form.querySelectorAll(".cl-field-error").length, 1);
  });

  test("clearFieldError: เอา cl-invalid ออก + เอา active ออกจาก error element (แต่ไม่ลบ node ทิ้ง)", () => {
    const form = makeForm();
    const field = form.querySelector("#f-name");
    showFieldError(field, "ผิด");

    clearFieldError(field);

    assert.equal(field.classList.contains("cl-invalid"), false);
    const err = field.nextElementSibling;
    assert.equal(err.classList.contains("active"), false);
  });

  test("showFieldError(null)/clearFieldError(null) ไม่ throw (fallback ปลอดภัย)", () => {
    assert.doesNotThrow(() => showFieldError(null, "x"));
    assert.doesNotThrow(() => clearFieldError(null));
  });
});

describe("attachInlineValidation() — blur/input/reset (รอบที่ 90)", () => {
  test("blur ที่ required field ว่าง → โชว์ error, blur ที่ field ที่กรอกแล้ว → ไม่โชว์ error", () => {
    const form = makeForm();
    attachInlineValidation(form);
    const nameField = form.querySelector("#f-name");

    dispatchEvt(nameField, "blur");
    assert.ok(nameField.classList.contains("cl-invalid"));

    nameField.value = "สมชาย";
    dispatchEvt(nameField, "blur");
    assert.equal(nameField.classList.contains("cl-invalid"), false);
  });

  test("ข้อความ error กำหนดเองผ่าน messages map ตาม field.id", () => {
    const form = makeForm();
    attachInlineValidation(form, { "f-name": "กรุณากรอกชื่อ-นามสกุล" });
    const nameField = form.querySelector("#f-name");

    dispatchEvt(nameField, "blur");

    assert.equal(nameField.nextElementSibling.textContent, "กรุณากรอกชื่อ-นามสกุล");
  });

  test("input event: เช็คซ้ำเฉพาะตอน field มี cl-invalid ค้างอยู่แล้วเท่านั้น (ไม่เช็คทุกครั้งที่พิมพ์)", () => {
    const form = makeForm();
    attachInlineValidation(form);
    const nameField = form.querySelector("#f-name");

    // ยังไม่เคย blur เลย ไม่มี cl-invalid ค้าง → พิมพ์แล้ว input event ไม่ควรไปสร้าง error ใหม่
    nameField.value = "a";
    dispatchEvt(nameField, "input");
    assert.equal(nameField.classList.contains("cl-invalid"), false);
    assert.equal(form.querySelectorAll(".cl-field-error").length, 0, "ยังไม่ควรมี error box ถูกสร้างเลย");

    // ทำให้ invalid ก่อน (ผ่าน blur ตอนว่าง)
    nameField.value = "";
    dispatchEvt(nameField, "blur");
    assert.ok(nameField.classList.contains("cl-invalid"));

    // ตอนนี้มี cl-invalid ค้างแล้ว → พิมพ์ค่าที่ถูกต้อง input event ต้องเคลียร์ error ให้ทันที
    nameField.value = "สมหญิง";
    dispatchEvt(nameField, "input");
    assert.equal(nameField.classList.contains("cl-invalid"), false);
  });

  test("form reset event: เคลียร์ error ของทุก required field ที่ผูกไว้", () => {
    const form = makeForm();
    attachInlineValidation(form);
    const nameField = form.querySelector("#f-name");
    const emailField = form.querySelector("#f-email");
    dispatchEvt(nameField, "blur");
    dispatchEvt(emailField, "blur");
    assert.ok(nameField.classList.contains("cl-invalid"));
    assert.ok(emailField.classList.contains("cl-invalid"));

    dispatchEvt(form, "reset");

    assert.equal(nameField.classList.contains("cl-invalid"), false);
    assert.equal(emailField.classList.contains("cl-invalid"), false);
  });

  test("attachInlineValidation(null) ไม่ throw (fallback ปลอดภัย)", () => {
    assert.doesNotThrow(() => attachInlineValidation(null));
  });
});

describe("validateFormInline() (รอบที่ 90)", () => {
  test("ฟอร์มผ่านหมด → คืน true, ไม่มี error โชว์, ไม่ throw", () => {
    const form = makeForm();
    form.querySelector("#f-name").value = "สมชาย";
    form.querySelector("#f-email").value = "test@example.com";

    const result = validateFormInline(form);

    assert.equal(result, true);
    assert.equal(form.querySelectorAll(".cl-field-error.active").length, 0);
  });

  test("ฟอร์มไม่ผ่าน (required ว่าง) → คืน false, โชว์ error ที่ field แรกที่ผิด, focus+scrollIntoView field นั้น", () => {
    const form = makeForm();
    form.querySelector("#f-email").value = "test@example.com"; // f-name ว่างไว้ตั้งใจ
    const nameField = form.querySelector("#f-name");
    let scrolledInto = false;
    nameField.scrollIntoView = () => { scrolledInto = true; };

    const result = validateFormInline(form);

    assert.equal(result, false);
    assert.ok(nameField.classList.contains("cl-invalid"));
    assert.equal(document.activeElement, nameField, "ต้อง focus() ไปที่ field แรกที่ผิด");
    assert.equal(scrolledInto, true);
  });

  test("validateFormInline(null) คืน true (fallback ปลอดภัย ไม่บล็อกอะไรถ้าไม่มีฟอร์ม)", () => {
    assert.equal(validateFormInline(null), true);
  });

  // === รอบที่ 90: regression test ล็อกบั๊ก recursion ที่พบในรอบที่ 89 ===
  test("[regression รอบ 90] attachInlineValidation()+validateFormInline() ผูกกับฟอร์มเดียวกัน แล้วเจอ required field ว่างตอน submit → ไม่ recursion/ไม่ throw (เดิมเจอ 'Maximum call stack size exceeded')", () => {
    const form = makeForm();
    // ผูกทั้งคู่กับฟอร์มเดียวกัน เหมือนที่ js/orders-tab-modal.js และ js/admin-products-form.js ทำจริง
    attachInlineValidation(form);
    // f-name/f-email ว่างทั้งคู่ตั้งใจ (ไม่กรอกอะไรเลย)

    let result;
    assert.doesNotThrow(() => {
      result = validateFormInline(form);
    }, "ต้องไม่ throw ('Maximum call stack size exceeded' หรืออื่นๆ) แม้ field required จะว่างอยู่");

    assert.equal(result, false, "ต้องยัง block submit ถูกต้องเหมือนเดิม (พฤติกรรมไม่เปลี่ยนหลังแก้บั๊ก)");
    assert.ok(form.querySelector("#f-name").classList.contains("cl-invalid"));
    assert.equal(form.querySelector("#f-name").nextElementSibling.textContent, "กรุณากรอกข้อมูลในช่องนี้");
  });

  test("[regression รอบ 90] เรียกซ้ำหลายรอบติดกัน (จำลอง submit ซ้ำๆ ตอนฟอร์มยังไม่ครบ) ก็ไม่ throw ทุกครั้ง", () => {
    const form = makeForm();
    attachInlineValidation(form);

    assert.doesNotThrow(() => {
      for (let i = 0; i < 5; i++) validateFormInline(form);
    });
  });
});

describe("createDirtyTracker() (รอบที่ 90)", () => {
  test("capture() แล้วไม่แก้อะไรเลย → isDirty() false", () => {
    const form = makeForm();
    form.querySelector("#f-name").value = "เดิม";
    const tracker = createDirtyTracker(form);

    tracker.capture();

    assert.equal(tracker.isDirty(), false);
  });

  test("แก้ค่า field หลัง capture() → isDirty() true", () => {
    const form = makeForm();
    form.querySelector("#f-name").value = "เดิม";
    const tracker = createDirtyTracker(form);
    tracker.capture();

    form.querySelector("#f-name").value = "ใหม่";

    assert.equal(tracker.isDirty(), true);
  });

  test("getExtra() เปลี่ยนค่า (เช่น รายการรูปภาพนอกฟอร์ม) → นับเป็น dirty ด้วย แม้ field ในฟอร์มไม่เปลี่ยนเลย", () => {
    const form = makeForm();
    let extraList = ["a.jpg"];
    const tracker = createDirtyTracker(form, () => extraList);
    tracker.capture();
    assert.equal(tracker.isDirty(), false);

    extraList = ["a.jpg", "b.jpg"];

    assert.equal(tracker.isDirty(), true);
  });

  test("reset() แล้ว isDirty() ต้องเป็น false (ยังไม่ capture() ใหม่)", () => {
    const form = makeForm();
    const tracker = createDirtyTracker(form);
    tracker.capture();
    form.querySelector("#f-name").value = "เปลี่ยนแล้ว";
    assert.equal(tracker.isDirty(), true);

    tracker.reset();

    assert.equal(tracker.isDirty(), false);
  });

  test("checkbox field: นับ .checked ไม่ใช่ .value", () => {
    document.body.querySelectorAll("form").forEach(f => f.remove());
    const form = document.createElement("form");
    form.innerHTML = `<input type="checkbox" id="f-agree" />`;
    document.body.appendChild(form);
    const tracker = createDirtyTracker(form);
    tracker.capture();

    form.querySelector("#f-agree").checked = true;

    assert.equal(tracker.isDirty(), true);
  });
});

describe("attachUnsavedGuard() — guardedClose()/confirmDialog flow (รอบที่ 90)", () => {
  test("ฟอร์มยังไม่ dirty → guardedClose() ปิดทันทีโดยไม่ถาม confirmDialog เลย", async () => {
    const form = makeForm();
    let closed = false;
    const guard = attachUnsavedGuard({ form, doClose: () => { closed = true; } });
    guard.capture();

    await guard.guardedClose();

    assert.equal(closed, true);
    // ต้องไม่มี confirm overlay ถูกเปิดขึ้นมาเลย (ไม่งั้น display จะเป็น flex)
    const confirmOverlay = document.querySelector(".cp-confirm-overlay");
    if (confirmOverlay) assert.notEqual(confirmOverlay.style.display, "flex");
  });

  test("ฟอร์ม dirty → guardedClose() เปิด confirmDialog ก่อน, กด 'ยกเลิก' → ไม่ปิดฟอร์ม", async () => {
    const form = makeForm();
    let closed = false;
    const guard = attachUnsavedGuard({ form, doClose: () => { closed = true; } });
    guard.capture();
    form.querySelector("#f-name").value = "แก้ไขแล้ว";

    const closePromise = guard.guardedClose();
    // confirmDialog() เปิด synchronous ก่อน await คำตอบ — ตรวจว่า overlay โผล่มาจริง
    await new Promise(r => setTimeout(r, 0));
    const overlay = document.querySelector(".cp-confirm-overlay");
    assert.equal(overlay.style.display, "flex");
    overlay.querySelector("#cp-confirm-cancel").click();
    await closePromise;

    assert.equal(closed, false, "กดยกเลิกต้องไม่ปิดฟอร์ม");
    assert.equal(overlay.style.display, "none");
  });

  test("ฟอร์ม dirty → guardedClose() เปิด confirmDialog, กด 'ปิดโดยไม่บันทึก' (ok) → ปิดฟอร์มจริง", async () => {
    const form = makeForm();
    let closed = false;
    const guard = attachUnsavedGuard({ form, doClose: () => { closed = true; } });
    guard.capture();
    form.querySelector("#f-name").value = "แก้ไขแล้ว";

    const closePromise = guard.guardedClose();
    await new Promise(r => setTimeout(r, 0));
    const overlay = document.querySelector(".cp-confirm-overlay");
    overlay.querySelector("#cp-confirm-ok").click();
    await closePromise;

    assert.equal(closed, true);
  });

  test("isAnyFormDirty(): true ทันทีที่มี guard ใดๆ dirty อยู่ (ไม่ต้องสนใจ guard อื่นที่เคยสร้างมาก่อน)", () => {
    const form = makeForm();
    const guard = attachUnsavedGuard({ form, doClose: () => {} });
    guard.capture();

    form.querySelector("#f-name").value = "ทำให้ dirty";

    assert.equal(isAnyFormDirty(), true);
  });
});
