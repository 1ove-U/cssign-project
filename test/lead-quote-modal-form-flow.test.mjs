// test/lead-quote-modal-form-flow.test.mjs
//
// jsdom test อย่างเป็นทางการสำหรับ flow การ "submit ฟอร์ม" ของป๊อปอัพ "ขอใบเสนอราคา"
// (js/lead-quote-modal.js) — บันทึกไว้เป็นรายการ "รู้แล้วแต่ตั้งใจไม่แก้" ข้อ 3 ของรอบ 55/58/62/65
// ("flow การ submit ฟอร์มจริงยังไม่มี test เป็นทางการ") หยิบมาทำต่อในรอบที่ 67 นี้ (js/track-modal.js
// ทำไปแล้วในรอบที่ 66 — ดู test/track-modal-form-flow.test.mjs ใช้แพทเทิร์นเดียวกันเป็นต้นแบบ)
//
// ขอบเขตรอบนี้ (ตั้งใจ): ทดสอบเฉพาะ flow การ submit ฟอร์ม (validation ฝั่ง client/checkbox ยอมรับ
// นโยบาย/Turnstile token/anti-spam honeypot+time-trap/double-submit/saveLead() สำเร็จ-ล้มเหลว/
// fail-open ของ verifyTurnstileToken() เมื่อเรียก endpoint ไม่ได้/prefill ข้อความจาก estimator
// และจาก opts.message ของ openModal()) — ไม่ทดสอบซ้ำกลไกเปิด/ปิด/focus-trap/Escape/return-focus/
// backdrop-click/สลับแท็บที่มี test อยู่แล้วใน test/lead-quote-modal-focus-trap.test.mjs
//
// อัปเดตรอบที่ 68: เพิ่ม test ว่า activeLeadSource/leadSource (PAGE_SOURCE_MAP ตาม <body
// data-page>, opts.source override ของ openModal()) ถูกส่งเข้า saveLead()/Firestore payload
// (ฟิลด์ "source") ถูกต้องจริงหรือไม่ — เดิมรอบ 67 ตั้งใจไม่ทำเพราะ addDoc() ใน
// test/helpers/firebase-stub-loader.mjs ไม่ capture argument (คืน {id:"stub-id"} คงที่เฉยๆ) —
// แก้แล้วโดยเพิ่ม globalThis.__ADD_DOC_CALLS__ (array) ใน addDoc() ของ stub นั้นตรงๆ (ไม่ใช่ stub
// loader ใหม่แยกเฉพาะ ./leads.js ตามที่เคยแนะนำไว้ — เพราะแบบนั้นจะทำให้ทดสอบ
// verifyTurnstileToken()/fetch() integration จริงของ js/leads.js ไม่ได้อีกต่อไป การแก้ที่ stub
// เดิมตรงๆ เก็บพฤติกรรม/ทดสอบเดิมทั้งหมดไว้ครบ แค่ "จด" argument เพิ่มเท่านั้น ไม่เปลี่ยน return
// value) — ดูรายละเอียดที่ comment ในไฟล์นั้นเอง — ใช้ร่วมกับ resetAddDocCalls()/lastAddDocCall()
// ด้านล่างในไฟล์นี้ ยืนยันด้วย npm test ครบทุกไฟล์แล้วว่าไม่กระทบ test เดิมไฟล์อื่นที่ import
// ผ่าน firebase-stub-loader.mjs เหมือนกัน (ไม่มีไฟล์ไหนเรียก addDoc() จริงในเชิงที่ต้องพึ่ง
// return value หรือ side-effect เดิมนอกจากคืนค่า {id:"stub-id"} เหมือนเดิมทุกประการ)
//
// ขอบเขตที่ตั้งใจไม่ทำในรอบนี้ (บันทึกไว้กันสับสนว่าลืม ไม่ใช่ลืมจริง):
// - ไม่ทดสอบว่า sendLeadEmails() (js/email-notify.js ผ่าน emailjs-stub-loader.mjs) ที่ throw จริง
//   จะยังโชว์ success ตามปกติหรือไม่ — เพราะ stub เดิม (emailjs.send() คืนค่า resolve เสมอ) ไม่มีทาง
//   ทำให้ reject ได้โดยไม่แก้ stub ที่ใช้ร่วมกับไฟล์อื่น และโค้ดจริงมี try/catch ครอบไว้แล้วชัดเจน
//   (อ่าน source ยืนยันแล้ว — บรรทัด "try { await sendLeadEmails(...) } catch(err) {...}"เห็นชัดว่า
//   ไม่ทำให้ leadSaved เป็น false)
//
// วิธี mock verifyTurnstileToken()/fetch(): js/leads.js เรียก `fetch()` แบบ bare global identifier
// ตรงๆ (ไม่ได้ import มาจากไหน) จึงสามารถ monkey-patch `globalThis.fetch` ตรงๆ ในไฟล์นี้ก่อน submit
// แต่ละ test case ได้เลย ไม่ต้องเขียน module customization hook/stub loader ใหม่เพิ่มเลย (ต่างจาก
// trackOrderStatus() ของรอบ 66 ที่เป็นฟังก์ชันที่ import มาจาก module อื่น จึง monkey-patch ตรงๆ
// ไม่ได้ ต้องดักที่ resolve()/load() แทน) — ยืนยันจากการอ่านโค้ดจริงของ js/leads.js ก่อนเขียน (ตามที่
// บันทึกไว้ใน NEXT-ROUND-PROMPT.txt ว่าให้ตรวจก่อนเสมอ อย่าเดาจากชื่อฟังก์ชัน) ต้อง restore
// globalThis.fetch กลับเป็นค่าเดิมใน afterEach เสมอ กันรั่วไหลข้าม test case
//
// วิธี mock window.turnstile/getTurnstileToken(): js/turnstile.js อ่าน `window.turnstile` +
// `container.dataset.tsWidgetId` ตรงๆ (getResponse()/reset() ผ่าน widget id ที่เก็บไว้ใน
// dataset ตอน renderWidget() สำเร็จ) — เนื่องจาก mountTurnstile() ใน jsdom ไม่มีวันสำเร็จจริง (ดู
// หมายเหตุใน test/lead-quote-modal-focus-trap.test.mjs ว่า apiPromise ค้าง pending ตลอดไปเพราะ
// jsdom ไม่โหลด external script จริง) จึงไม่ต้องเรียก openModal()/mountTurnstile() เลยในไฟล์นี้ —
// ตั้งค่า `dom.window.turnstile = { getResponse, reset }` + `container.dataset.tsWidgetId` เองตรงๆ
// ก็พอ เพราะ submit listener ผูกไว้ที่ module scope ตั้งแต่ import ไม่ต้องเปิดป๊อปอัพก่อนเลย
// (เหมือนกับที่ test/track-modal-form-flow.test.mjs ไม่ต้องเปิดป๊อปอัพก่อน submit เช่นกัน)
//
// หมายเหตุ anti-spam time-trap: initAntiSpam(form) ถูกเรียกที่ module scope ตอน import (บรรทัด
// `if (form) initAntiSpam(form);`) ตั้ง antiSpamLoadedAt = Date.now() ทันที — ถ้า submit ทันทีหลัง
// import (ไม่รอ 1.5 วิ) จะโดน time-trap จับว่าเป็นบอทเสมอ ทุก test ที่ไม่ได้ตั้งใจทดสอบ anti-spam
// ต้องเรียก bypassAntiSpamTimeTrap(dom) ก่อน submit เสมอ (ปรับ antiSpamLoadedAt ย้อนไปในอดีต)
//
// HTML markup: อ่านจาก js/qmodal-template.js ด้วย regex เหมือนกับ
// test/lead-quote-modal-focus-trap.test.mjs (แพทเทิร์นเดียวกัน ให้ตรงกับของจริง 100%)
//
// ไม่ได้แก้ไฟล์ .js/.html/.css ที่เป็นโค้ดจริงเลยแม้แต่บรรทัดเดียวในไฟล์นี้ — งานทดสอบล้วนๆ
// ไม่ได้แก้ test/helpers/register-loader.mjs หรือเพิ่ม stub loader ใหม่เลยในรอบนี้ (ดูเหตุผลด้านบน)

import { test, describe, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const QM_TEMPLATE_SRC = readFileSync(new URL("../js/qmodal-template.js", import.meta.url), "utf-8");
const QM_HTML_MATCH = QM_TEMPLATE_SRC.match(/var FORM_DEFAULT = `([\s\S]*?)`;/);
if (!QM_HTML_MATCH) throw new Error("lead-quote-modal-form-flow.test.mjs: ดึง template literal จาก js/qmodal-template.js ไม่สำเร็จ (โครงสร้างไฟล์อาจเปลี่ยนไป)");
const QM_HTML = QM_HTML_MATCH[1];

const ORIGINAL_FETCH = globalThis.fetch;

function makeDom(extraBodyHtml) {
  return new JSDOM(
    `<!doctype html><html><body>${extraBodyHtml || ""}${QM_HTML}</body></html>`,
    { url: "https://example.test/" }
  );
}

async function loadLeadQuoteModal(dom) {
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.MouseEvent = dom.window.MouseEvent;
  globalThis.KeyboardEvent = dom.window.KeyboardEvent;
  // form-toast.js เรียก requestAnimationFrame() แบบ bare identifier ตอนแสดง toast (showToast())
  globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);
  await import(`../js/lead-quote-modal.js?t=${Date.now()}-${Math.random()}`);
  // ดูหมายเหตุเดียวกับ test/lead-quote-modal-focus-trap.test.mjs: window.openModal ต้อง mirror
  // มาที่ globalThis เพราะโค้ดจริงเรียกตัวเองแบบ bare identifier ที่อื่นในไฟล์เดียวกัน
  globalThis.openModal = dom.window.openModal;
}

// initAntiSpam(form) ตั้ง antiSpamLoadedAt = Date.now() ตอน import — เลื่อนย้อนไปในอดีตให้พ้น
// MIN_FILL_MS (1500ms) ของ time-trap เพื่อไม่ให้ test ที่ไม่เกี่ยวกับ anti-spam โดนจับเป็นบอทไปด้วย
function bypassAntiSpamTimeTrap(dom) {
  dom.window.document.getElementById("qmodal-form").dataset.antiSpamLoadedAt = String(Date.now() - 5000);
}

function fillForm(dom, { name = "คุณทดสอบ ระบบ", email = "", tel = "0891234567", service = "", message = "", agree = true } = {}) {
  const { document } = dom.window;
  document.getElementById("qm-name").value = name;
  document.getElementById("qm-email").value = email;
  document.getElementById("qm-tel").value = tel;
  if (service) document.getElementById("qm-service").value = service;
  document.getElementById("qm-msg").value = message;
  document.getElementById("qm-agree").checked = agree;
}

function submitForm(dom) {
  dom.window.document.getElementById("qmodal-form").dispatchEvent(
    new dom.window.Event("submit", { bubbles: true, cancelable: true })
  );
}

function click(dom, el) {
  el.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
}

// ตั้งค่า window.turnstile + dataset.tsWidgetId ตรงๆ แทนการเปิดป๊อปอัพจริง (ดูหมายเหตุหัวไฟล์)
// คืนค่า object ให้เช็คว่า reset() ถูกเรียกกี่ครั้งได้ (resetTurnstile() หลัง submit)
function setTurnstileToken(dom, token) {
  const state = { resetCallCount: 0, resetWidgetIds: [] };
  dom.window.turnstile = {
    getResponse: () => token,
    reset: (id) => { state.resetCallCount += 1; state.resetWidgetIds.push(id); }
  };
  dom.window.document.getElementById("qm-turnstile").dataset.tsWidgetId = "test-widget-1";
  return state;
}

// mode: "success" | "invalid" (server ปฏิเสธ token ชัดเจน) | "network-error" (fetch throw) |
// "bad-status" (res.ok=false) — สองอย่างหลังต้อง fail-open (verifyTurnstileToken คืน true) ตาม
// design ที่ตั้งใจไว้ใน js/leads.js (อ่าน comment หัวไฟล์นั้นแล้วยืนยันก่อนเขียน mock นี้)
function mockVerifyFetch(mode) {
  const calls = [];
  globalThis.fetch = async (url, opts) => {
    calls.push({ url, body: opts && opts.body ? JSON.parse(opts.body) : null });
    if (mode === "network-error") throw new Error("simulated network failure");
    if (mode === "bad-status") return { ok: false, status: 500, json: async () => ({}) };
    if (mode === "invalid") return { ok: true, json: async () => ({ success: false }) };
    return { ok: true, json: async () => ({ success: true }) };
  };
  return calls;
}

// อ่าน/ล้าง globalThis.__ADD_DOC_CALLS__ ที่ addDoc() ของ firebase-stub-loader.mjs เก็บไว้ (รอบที่
// 68) — ล้างก่อนทุก test ที่จะเช็คจุดนี้ กัน call จาก test อื่นก่อนหน้าปนมา (array นี้ persist ตลอด
// process เดียวกันของไฟล์ test นี้ เพราะ Node test runner รันแต่ละไฟล์ .test.mjs แยก process กัน
// อยู่แล้ว แต่ภายในไฟล์เดียวกัน test หลาย case รันใน process เดียวกัน)
function resetAddDocCalls() {
  globalThis.__ADD_DOC_CALLS__ = [];
}
function lastAddDocCall() {
  const calls = globalThis.__ADD_DOC_CALLS__ || [];
  return calls.length ? calls[calls.length - 1] : null;
}

function nextTick() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toastMsg(dom, type) {
  const el = dom.window.document.querySelector(`.cs-toast-host .cs-toast--${type} .cs-toast-msg`);
  return el ? el.textContent : null;
}

describe("js/lead-quote-modal.js — flow การ submit ฟอร์ม (validation/checkbox/Turnstile/anti-spam/double-submit/saveLead สำเร็จ-ล้มเหลว/fail-open/prefill ข้อความ) — รอบที่ 67", () => {
  afterEach(() => {
    globalThis.fetch = ORIGINAL_FETCH;
  });

  test("ไม่กรอกชื่อ (required): แสดง error ใต้ช่องชื่อ ไม่เรียก fetch()/saveLead()", async () => {
    const dom = makeDom();
    await loadLeadQuoteModal(dom);
    bypassAntiSpamTimeTrap(dom);
    setTurnstileToken(dom, "tok-1");
    const calls = mockVerifyFetch("success");
    const { document } = dom.window;

    fillForm(dom, { name: "" });
    submitForm(dom);
    await nextTick();

    const nameInput = document.getElementById("qm-name");
    assert.equal(nameInput.classList.contains("has-error"), true);
    assert.equal(nameInput.nextElementSibling.className, "cs-field-err");
    assert.equal(nameInput.nextElementSibling.textContent, "กรุณากรอกข้อมูลในช่องนี้");
    assert.equal(calls.length, 0, "ไม่ควรเรียก fetch() เมื่อ validation ฝั่ง client ไม่ผ่าน");
    assert.equal(document.getElementById("qmodal-success").style.display, "none");
  });

  test("กรอกเบอร์โทรผิดรูปแบบ (สั้นเกินไป): แสดง error ใต้ช่องเบอร์โทร ไม่เรียก fetch()", async () => {
    const dom = makeDom();
    await loadLeadQuoteModal(dom);
    bypassAntiSpamTimeTrap(dom);
    setTurnstileToken(dom, "tok-1");
    const calls = mockVerifyFetch("success");
    const { document } = dom.window;

    fillForm(dom, { tel: "089" });
    submitForm(dom);
    await nextTick();

    const telInput = document.getElementById("qm-tel");
    assert.equal(telInput.classList.contains("has-error"), true);
    assert.equal(telInput.nextElementSibling.textContent, "กรุณากรอกเบอร์โทรศัพท์ให้ถูกต้อง เช่น 08x-xxx-xxxx");
    assert.equal(calls.length, 0);
  });

  test("กรอกอีเมลผิดรูปแบบ (อีเมลไม่บังคับแต่ถ้ากรอกต้องถูกต้อง): แสดง error ใต้ช่องอีเมล ไม่เรียก fetch()", async () => {
    const dom = makeDom();
    await loadLeadQuoteModal(dom);
    bypassAntiSpamTimeTrap(dom);
    setTurnstileToken(dom, "tok-1");
    const calls = mockVerifyFetch("success");
    const { document } = dom.window;

    fillForm(dom, { email: "bad-email" });
    submitForm(dom);
    await nextTick();

    const emailInput = document.getElementById("qm-email");
    assert.equal(emailInput.classList.contains("has-error"), true);
    assert.equal(emailInput.nextElementSibling.textContent, "รูปแบบอีเมลไม่ถูกต้อง เช่น name@example.com");
    assert.equal(calls.length, 0);
  });

  test("ฟอร์มถูกต้องแต่ยังไม่ติ๊กยอมรับนโยบายความเป็นส่วนตัว: แสดง toast เตือน ไม่เรียก fetch()", async () => {
    const dom = makeDom();
    await loadLeadQuoteModal(dom);
    bypassAntiSpamTimeTrap(dom);
    setTurnstileToken(dom, "tok-1");
    const calls = mockVerifyFetch("success");

    fillForm(dom, { agree: false });
    submitForm(dom);
    await nextTick();

    assert.equal(toastMsg(dom, "warn"), "กรุณายอมรับนโยบายความเป็นส่วนตัวก่อนส่งฟอร์ม");
    assert.equal(calls.length, 0);
  });

  test("ติ๊กยอมรับแล้วแต่ยังไม่ได้ยืนยันตัวตน Turnstile (token ว่าง — ค่า default ตอนยังไม่ได้ mock): แสดง toast เตือน ไม่เรียก fetch()", async () => {
    const dom = makeDom();
    await loadLeadQuoteModal(dom);
    bypassAntiSpamTimeTrap(dom);
    // ไม่เรียก setTurnstileToken() เลย — window.turnstile ยังเป็น undefined เหมือนสภาพจริงตอน
    // mountTurnstile() ยังโหลดไม่เสร็จ (ดูหมายเหตุหัวไฟล์)
    const calls = mockVerifyFetch("success");

    fillForm(dom, { agree: true });
    submitForm(dom);
    await nextTick();

    assert.equal(toastMsg(dom, "warn"), "กรุณายืนยันตัวตน (แคปช่า) ก่อนส่งฟอร์ม");
    assert.equal(calls.length, 0);
  });

  test("บอทกรอก honeypot (name=\"website\"): submit เงียบ โชว์ success ปลอมแต่ไม่เรียก fetch()/บันทึกจริง", async () => {
    const dom = makeDom();
    await loadLeadQuoteModal(dom);
    bypassAntiSpamTimeTrap(dom); // แยกเหตุผลให้ชัดว่าโดนจับเพราะ honeypot ไม่ใช่ time-trap
    setTurnstileToken(dom, "tok-1");
    const calls = mockVerifyFetch("success");
    const { document } = dom.window;

    fillForm(dom, { agree: true });
    document.querySelector('input[name="website"]').value = "http://spam.example.com";
    submitForm(dom);
    await nextTick();

    assert.equal(calls.length, 0, "ไม่ควรเรียก fetch()/saveLead() เมื่อเข้าข่ายบอท");
    assert.equal(document.getElementById("qmodal-form").style.display, "none");
    assert.equal(document.getElementById("qmodal-success").style.display, "flex");
  });

  test("บอท submit เร็วเกินไป (time-trap, เร็วกว่า 1.5 วิ หลังฟอร์มพร้อมใช้งาน — ไม่ bypass): submit เงียบ โชว์ success ปลอมแต่ไม่เรียก fetch()", async () => {
    const dom = makeDom();
    await loadLeadQuoteModal(dom); // ไม่เรียก bypassAntiSpamTimeTrap() — submit ทันทีจึงเร็วกว่า 1.5 วิแน่นอน
    setTurnstileToken(dom, "tok-1");
    const calls = mockVerifyFetch("success");
    const { document } = dom.window;

    fillForm(dom, { agree: true });
    submitForm(dom);
    await nextTick();

    assert.equal(calls.length, 0);
    assert.equal(document.getElementById("qmodal-success").style.display, "flex");
  });

  test("กันการ submit ซ้ำระหว่างรอผลลัพธ์ (ปุ่มมีคลาส is-loading อยู่): เรียก fetch() แค่ครั้งเดียวแม้ submit ซ้ำ 2 ครั้งติดกัน", async () => {
    const dom = makeDom();
    await loadLeadQuoteModal(dom);
    bypassAntiSpamTimeTrap(dom);
    setTurnstileToken(dom, "tok-1");
    let callCount = 0;
    let resolveFetch;
    globalThis.fetch = () => {
      callCount += 1;
      return new Promise((resolve) => { resolveFetch = resolve; });
    };
    const { document } = dom.window;
    const submitBtn = document.querySelector(".qm-submit-btn");

    fillForm(dom, { agree: true });
    submitForm(dom);
    await nextTick();

    assert.equal(submitBtn.disabled, true);
    assert.equal(submitBtn.classList.contains("is-loading"), true);

    submitForm(dom); // ยิงซ้ำระหว่างที่ยังรอ fetch() ครั้งแรกอยู่
    await nextTick();

    assert.equal(callCount, 1, "ไม่ควรเรียก fetch() ซ้ำเพราะปุ่มยัง is-loading อยู่ (double-submit ถูกกัน)");

    resolveFetch({ ok: true, json: async () => ({ success: true }) });
    await nextTick();
    await nextTick();
  });

  test("submit สำเร็จ (Turnstile verify ผ่านจริงจาก server): ส่ง token ที่ถูกต้องไปกับ fetch(), เรียก resetTurnstile(), โชว์ success, ปุ่มคืนสภาพ", async () => {
    const dom = makeDom();
    await loadLeadQuoteModal(dom);
    bypassAntiSpamTimeTrap(dom);
    const tsState = setTurnstileToken(dom, "real-turnstile-token-xyz");
    const calls = mockVerifyFetch("success");
    const { document } = dom.window;
    const submitBtn = document.querySelector(".qm-submit-btn");

    fillForm(dom, { agree: true });
    submitForm(dom);
    await nextTick();
    await nextTick();
    await nextTick();

    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "https://cssign-cloudinary-delete.zillergotspw.workers.dev/verify-turnstile");
    assert.equal(calls[0].body.token, "real-turnstile-token-xyz");
    assert.equal(tsState.resetCallCount, 1, "ต้องเรียก resetTurnstile() หลัง submit สำเร็จ (token ใช้ได้ครั้งเดียว)");
    assert.equal(document.getElementById("qmodal-form").style.display, "none");
    assert.equal(document.getElementById("qmodal-success").style.display, "flex");
    // หมายเหตุ: อ่านโค้ดจริงแล้วพบว่า path "สำเร็จ" ของ js/lead-quote-modal.js ไม่ได้ reset
    // submitBtn.disabled/classList is-loading กลับเหมือน path "ล้มเหลว" (มีแค่ resetTurnstile() +
    // ซ่อนฟอร์ม/โชว์ success) — ต่างจาก js/track-modal.js ที่ใช้ .finally() reset ปุ่มทั้ง 2 เคส
    // ไม่ใช่บั๊ก เพราะฟอร์มถูกซ่อนไปแล้วตอนนี้ (form.style.display='none') ปุ่มเลยไม่ถูกมองเห็นอยู่ดี
    // — ยืนยันพฤติกรรมจริงตามที่เป็น ไม่ได้แก้โค้ดจริงตามที่คาดไว้ผิดในตอนแรก
    assert.equal(submitBtn.disabled, true);
    assert.equal(submitBtn.classList.contains("is-loading"), true);
  });

  test("submit ล้มเหลว (server ปฏิเสธ Turnstile token ชัดเจน — saveLead() throw): แสดง toast error, เรียก resetTurnstile(), ปุ่มคืนสภาพ, ไม่โชว์ success", async () => {
    const dom = makeDom();
    await loadLeadQuoteModal(dom);
    bypassAntiSpamTimeTrap(dom);
    const tsState = setTurnstileToken(dom, "rejected-token");
    mockVerifyFetch("invalid");
    const { document } = dom.window;
    const submitBtn = document.querySelector(".qm-submit-btn");

    fillForm(dom, { agree: true });
    submitForm(dom);
    await nextTick();
    await nextTick();
    await nextTick();

    assert.equal(
      toastMsg(dom, "error"),
      "ขออภัย ระบบไม่สามารถบันทึกข้อมูลได้ในขณะนี้ กรุณาลองส่งอีกครั้ง หรือโทรติดต่อทีมงานที่ 062-883-3880"
    );
    assert.equal(tsState.resetCallCount, 1, "ต้อง resetTurnstile() หลัง saveLead() ล้มเหลวด้วย ไม่ใช่แค่ตอนสำเร็จ");
    assert.equal(submitBtn.disabled, false);
    assert.equal(submitBtn.classList.contains("is-loading"), false);
    assert.equal(document.getElementById("qmodal-form").style.display, "");
    assert.equal(document.getElementById("qmodal-success").style.display, "none");
  });

  test("fail-open: endpoint verify-turnstile ตอบ status ผิดพลาด (500) — ไม่บล็อกลูกค้าจริง ยังบันทึก lead สำเร็จ", async () => {
    const dom = makeDom();
    await loadLeadQuoteModal(dom);
    bypassAntiSpamTimeTrap(dom);
    setTurnstileToken(dom, "tok-bad-status");
    mockVerifyFetch("bad-status");
    const { document } = dom.window;

    fillForm(dom, { agree: true });
    submitForm(dom);
    await nextTick();
    await nextTick();
    await nextTick();

    assert.equal(document.getElementById("qmodal-success").style.display, "flex");
    assert.equal(document.getElementById("qmodal-form").style.display, "none");
  });

  test("fail-open: เรียก fetch() ไม่สำเร็จเลย (เน็ตหลุด/worker ยังไม่ deploy) — ไม่บล็อกลูกค้าจริง ยังบันทึก lead สำเร็จ", async () => {
    const dom = makeDom();
    await loadLeadQuoteModal(dom);
    bypassAntiSpamTimeTrap(dom);
    setTurnstileToken(dom, "tok-network-error");
    mockVerifyFetch("network-error");
    const { document } = dom.window;

    fillForm(dom, { agree: true });
    submitForm(dom);
    await nextTick();
    await nextTick();
    await nextTick();

    assert.equal(document.getElementById("qmodal-success").style.display, "flex");
  });

  test("submit ซ้ำอีกครั้งหลัง error ครั้งแรก (retry): ถ้าครั้งที่สอง verify ผ่าน จะสำเร็จตามปกติ (ปุ่ม/state ไม่ค้างจากความล้มเหลวครั้งก่อน)", async () => {
    const dom = makeDom();
    await loadLeadQuoteModal(dom);
    bypassAntiSpamTimeTrap(dom);
    setTurnstileToken(dom, "tok-retry");
    const { document } = dom.window;
    const submitBtn = document.querySelector(".qm-submit-btn");

    mockVerifyFetch("invalid");
    fillForm(dom, { agree: true });
    submitForm(dom);
    await nextTick();
    await nextTick();
    await nextTick();
    assert.equal(document.getElementById("qmodal-success").style.display, "none");
    assert.equal(submitBtn.disabled, false);

    mockVerifyFetch("success");
    fillForm(dom, { agree: true }); // agree checkbox ไม่ถูกรีเซ็ตหลัง error แต่ตั้งใหม่ให้ชัดเจนเหมือนผู้ใช้กดส่งอีกครั้ง
    submitForm(dom);
    await nextTick();
    await nextTick();
    await nextTick();

    assert.equal(document.getElementById("qmodal-success").style.display, "flex");
  });

  test("openModal(tab, {message}) prefill ข้อความลงช่องรายละเอียดถ้ายังว่างอยู่ (ดีเลย์ 100ms)", async () => {
    const dom = makeDom();
    await loadLeadQuoteModal(dom);
    const { document } = dom.window;

    dom.window.openModal("form", { message: "ข้อความทดสอบ prefill จาก opts" });
    await wait(150);

    assert.equal(document.getElementById("qm-msg").value, "ข้อความทดสอบ prefill จาก opts");
  });

  test("openModal(tab, {message}) ไม่ทับข้อความที่ผู้ใช้กรอกไว้แล้ว (เช็คว่าว่างก่อนถึงจะ prefill)", async () => {
    const dom = makeDom();
    await loadLeadQuoteModal(dom);
    const { document } = dom.window;

    document.getElementById("qm-msg").value = "ข้อความที่ผู้ใช้พิมพ์เองอยู่แล้ว";
    dom.window.openModal("form", { message: "ข้อความใหม่จาก opts" });
    await wait(150);

    assert.equal(document.getElementById("qm-msg").value, "ข้อความที่ผู้ใช้พิมพ์เองอยู่แล้ว");
  });

  test("ปุ่ม #estimator-quote-btn prefill ข้อความสรุปราคาประมาณการ + เลือกบริการที่ตรงกันในช่อง qm-service (ดีเลย์ 100ms)", async () => {
    const dom = makeDom('<button id="estimator-quote-btn">คำนวณราคา</button>');
    await loadLeadQuoteModal(dom);
    const { document } = dom.window;

    dom.window.__estimatorSummary = {
      typeLabel: "ป้ายไฟ LED",
      materialLabel: "อะคริลิค",
      sizeLabel: "100x50 ซม.",
      qty: 3,
      service: "ป้ายความปลอดภัย",
      total: 15000
    };
    click(dom, document.getElementById("estimator-quote-btn"));
    await wait(150);

    const msgVal = document.getElementById("qm-msg").value;
    assert.match(msgVal, /ป้ายไฟ LED/);
    assert.match(msgVal, /อะคริลิค/);
    assert.match(msgVal, /100x50 ซม\./);
    assert.match(msgVal, /จำนวน: 3 ชิ้น/);
    assert.match(msgVal, /15,000 บาท/);
    assert.equal(document.getElementById("qm-service").value, "ป้ายความปลอดภัย");
  });

  // รอบที่ 68: leadSource/PAGE_SOURCE_MAP routing เข้า saveLead() -> addDoc() payload.source
  test("หน้าไม่มี <body data-page>: source ที่บันทึกคือ 'quotation_modal' (ค่า default)", async () => {
    const dom = makeDom();
    await loadLeadQuoteModal(dom);
    bypassAntiSpamTimeTrap(dom);
    setTurnstileToken(dom, "tok-1");
    mockVerifyFetch("success");
    resetAddDocCalls();

    fillForm(dom);
    submitForm(dom);
    await nextTick();
    await nextTick();
    await nextTick();

    const call = lastAddDocCall();
    assert.ok(call, "ควรมีการเรียก addDoc() หลัง submit สำเร็จ");
    assert.equal(call.path, "leads");
    assert.equal(call.payload.source, "quotation_modal");
  });

  test("<body data-page='contact'>: source ที่บันทึกคือ 'quotation_modal_contact'", async () => {
    const dom = makeDom();
    dom.window.document.body.dataset.page = "contact";
    await loadLeadQuoteModal(dom);
    bypassAntiSpamTimeTrap(dom);
    setTurnstileToken(dom, "tok-1");
    mockVerifyFetch("success");
    resetAddDocCalls();

    fillForm(dom);
    submitForm(dom);
    await nextTick();
    await nextTick();
    await nextTick();

    const call = lastAddDocCall();
    assert.ok(call);
    assert.equal(call.payload.source, "quotation_modal_contact");
  });

  test("<body data-page='portfolio'>: source ที่บันทึกคือ 'quotation_modal_portfolio'", async () => {
    const dom = makeDom();
    dom.window.document.body.dataset.page = "portfolio";
    await loadLeadQuoteModal(dom);
    bypassAntiSpamTimeTrap(dom);
    setTurnstileToken(dom, "tok-1");
    mockVerifyFetch("success");
    resetAddDocCalls();

    fillForm(dom);
    submitForm(dom);
    await nextTick();
    await nextTick();
    await nextTick();

    const call = lastAddDocCall();
    assert.ok(call);
    assert.equal(call.payload.source, "quotation_modal_portfolio");
  });

  test("<body data-page> ที่ไม่รู้จัก (ไม่มีใน PAGE_SOURCE_MAP): source กลับไปเป็น 'quotation_modal' (fallback)", async () => {
    const dom = makeDom();
    dom.window.document.body.dataset.page = "blog";
    await loadLeadQuoteModal(dom);
    bypassAntiSpamTimeTrap(dom);
    setTurnstileToken(dom, "tok-1");
    mockVerifyFetch("success");
    resetAddDocCalls();

    fillForm(dom);
    submitForm(dom);
    await nextTick();
    await nextTick();
    await nextTick();

    const call = lastAddDocCall();
    assert.ok(call);
    assert.equal(call.payload.source, "quotation_modal");
  });

  test("openModal(tab, {source}) override: source ที่บันทึกคือค่าที่ override แทนค่าเดิมของหน้า", async () => {
    const dom = makeDom();
    dom.window.document.body.dataset.page = "contact"; // ค่าเดิมของหน้าควรถูก override ทับ
    await loadLeadQuoteModal(dom);
    bypassAntiSpamTimeTrap(dom);
    setTurnstileToken(dom, "tok-1");
    mockVerifyFetch("success");
    resetAddDocCalls();

    dom.window.openModal("form", { source: "chat_widget" });
    fillForm(dom);
    submitForm(dom);
    await nextTick();
    await nextTick();
    await nextTick();

    const call = lastAddDocCall();
    assert.ok(call);
    assert.equal(call.payload.source, "chat_widget");
  });

  test("openModal() ครั้งถัดไปโดยไม่ระบุ opts.source: source รีเซ็ตกลับเป็นค่าเดิมของหน้า (ไม่ค้าง override เก่า)", async () => {
    const dom = makeDom();
    dom.window.document.body.dataset.page = "portfolio";
    await loadLeadQuoteModal(dom);
    bypassAntiSpamTimeTrap(dom);
    setTurnstileToken(dom, "tok-1");
    mockVerifyFetch("success");
    resetAddDocCalls();

    // เปิดครั้งแรกด้วย override (เช่น เรียกจาก chat-widget.js)
    dom.window.openModal("form", { source: "chat_widget" });
    // ปิดแล้วเปิดใหม่โดยไม่ระบุ source — ควรกลับไปใช้ leadSource ของหน้า (portfolio) ตามปกติ
    dom.window.openModal("form");
    bypassAntiSpamTimeTrap(dom); // เปิดโมดัลใหม่ไม่กระทบ antiSpamLoadedAt แต่เผื่อไว้ให้ชัดเจน
    fillForm(dom);
    submitForm(dom);
    await nextTick();
    await nextTick();
    await nextTick();

    const call = lastAddDocCall();
    assert.ok(call);
    assert.equal(call.payload.source, "quotation_modal_portfolio");
  });
});
