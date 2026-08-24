// test/orders-tab-modal-sub-panels.test.mjs — รอบที่ 91 (Phase 2 ของแผน 6 phase ที่วางไว้ในรอบที่ 88)
//
// jsdom test อย่างเป็นทางการสำหรับ 3 sub-modal ย่อยของป๊อปอัพ "เพิ่ม/แก้ไขคำสั่งผลิต" ที่ยังไม่เคยมี
// test มาก่อนเลย:
//   - js/orders-tab-modal-attach.js — ไฟล์แนบ (อัปโหลดรูป/ไฟล์ผ่าน uploadImage()/uploadFile())
//   - js/orders-tab-modal-qc.js     — QC checklist (เพิ่ม/ลบ/แก้ label/ติ๊กถูก)
//   - js/orders-tab-modal-history.js — ประวัติแก้ไข (loadOrderHistory() ดึงจาก listAuditLog())
//
// รวม 3 ไฟล์ไว้ในไฟล์เทสเดียวกัน (ต่างจาก 1-ไฟล์เทส-ต่อ-1-ไฟล์โค้ดปกติของโปรเจกต์) เพราะเหตุผลทาง
// สถาปัตยกรรม ไม่ใช่แค่ทำตามที่แผนรอบ 88 บอกว่า "ทำรวมกันได้ในรอบเดียว" เฉยๆ: ทั้ง 3 ไฟล์ import
// js/orders-tab.js ซึ่ง import js/orders-tab-modal.js กลับมา (circular) และ orders-tab-modal.js เอง
// ก็ import ทั้ง 3 sub-modal นี้กลับไปอีกที (บรรทัด 50-52 ของไฟล์นั้น) — แปลว่าไม่ว่าจะ import
// sub-modal ไฟล์ไหนก่อน ก็ต้องพึ่ง DOM fixture ก้อนใหญ่เท่ากันหมด (admin.html ทั้ง body จริง แบบ
// เดียวกับ test/orders-tab-modal-submit-flow.test.mjs) เพราะ import chain ลากไปถึง
// orders-tab-kanban.js/orders-tab-stats.js/orders-tab-export.js/orders-tab-pagination.js ทั้งหมดอยู่ดี
// — แยกไฟล์เทสจะจ่ายค่า setup DOM fixture ก้อนเดียวกันซ้ำ 3 รอบเปล่าๆ โดยไม่ได้ทดสอบอะไรต่างกัน จึง
// รวมเป็นไฟล์เดียว 3 describe block แทน (import ทั้ง 3 โมดูลครั้งเดียวใน before() ของไฟล์นี้)
//
// P0.2c (รอบที่ 3 ของแผน roadmap): เพิ่ม js/orders-tab-modal-design-approvals.js เข้ามาในไฟล์
// เทสเดียวกันนี้ด้วยเหตุผลเดียวกับ 3 ไฟล์ข้างต้นทุกประการ (import chain เดียวกัน, ต้องใช้ DOM
// fixture ก้อนเดียวกัน) — เพิ่ม describe block ที่ 4 ท้ายไฟล์ ใช้แพทเทิร์นเดียวกับ
// orders-tab-modal-history.js เป๊ะ (loadOrderHistory ↔ loadDesignApprovals) เพราะไฟล์ต้นทางเขียน
// ตามแพทเทิร์นเดียวกันตั้งใจอยู่แล้ว ต่างแค่ query collection "design_approvals" แทน "auditLog"
// และกรองด้วย trackingId (คำนวณจาก buildTrackingId(order.code, order.phone)) แทน targetId ตรงๆ
// เพิ่ม checkbox "ลูกค้าเห็น" ของ js/orders-tab-modal-attach.js เข้าไปใน describe block เดิมของ
// ไฟล์นั้นด้วย (ไม่ใช่ describe block ใหม่ เพราะเป็นฟีเจอร์เสริมของ renderAttachGrid() เดิม)
//
// ใช้สถาปัตยกรรมเทสเดียวกับ test/orders-tab-modal-submit-flow.test.mjs ทุกประการ (jsdom + import
// โมดูลครั้งเดียวต่อไฟล์ใน before() ไม่ใช่ต่อเทส เพราะ state/DOM-ref ที่ module-scope ของไฟล์ลูกจะค้าง
// กับ document ตัวแรกที่เคย import มันเท่านั้นตลอดทั้งไฟล์ — ดูหมายเหตุหัวไฟล์ submit-flow สำหรับ
// รายละเอียดเต็ม) — reset state ที่จำเป็นเองในแต่ละเทสผ่าน setCurrentAttachments([])/
// setCurrentQcChecklist([]) แทนการสร้าง DOM ใหม่ทุกเทส
//
// เพิ่มเติมเฉพาะไฟล์นี้: js/orders-tab-modal-attach.js เรียก uploadImage()/uploadFile()
// (js/db-media.js) ซึ่งเรียก fetch() ตรงไปที่ Cloudinary — ไม่ผ่าน Firestore เลย จึงต้อง stub
// globalThis.fetch เอง (คนละกลไกกับ firebase-stub-loader.mjs ที่ดักเฉพาะ Firestore/Auth SDK) —
// compressImage() ภายใน uploadImage() เรียก createImageBitmap() ซึ่ง jsdom ไม่มี implementation
// (ReferenceError) แต่ตัวฟังก์ชันเองมี try/catch ครอบไว้อยู่แล้วและ fallback คืนไฟล์เดิมเงียบๆ
// (ยืนยันจากโค้ดจริง js/db-media.js) จึงไม่ต้อง stub createImageBitmap เพิ่มเอง — ปล่อยให้มัน throw
// แล้ว fallback ตามพฤติกรรมจริงได้เลย
//
// ไม่ได้แก้ไฟล์ .js/.html/.css ที่เป็นโค้ดจริงเลยแม้แต่บรรทัดเดียวในรอบนี้ — งานทดสอบล้วนๆ (ไม่พบบั๊ก
// ระหว่างอ่านโค้ด 3 ไฟล์นี้ละเอียด — ต่างจากรอบ 90 ที่เจอบั๊ก recursion จริง)

import { test, describe, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const ADMIN_HTML = readFileSync(new URL("../admin.html", import.meta.url), "utf-8");
const BODY_START = ADMIN_HTML.indexOf(">", ADMIN_HTML.indexOf("<body")) + 1;
const BODY_END = ADMIN_HTML.indexOf("</body>");
const ADMIN_BODY_NO_SCRIPTS = ADMIN_HTML
  .slice(BODY_START, BODY_END)
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, "");

let document;      // ใช้ dom เดียวตลอดทั้งไฟล์ (ดูหมายเหตุหัวไฟล์ว่าทำไม)
let attachMod, qcMod, historyMod, designApprovalsMod;

function resetFirebaseCalls() {
  globalThis.__ADD_DOC_CALLS__ = [];
  globalThis.__UPDATE_DOC_CALLS__ = [];
  globalThis.__DELETE_DOC_CALLS__ = [];
  globalThis.__SET_DOC_CALLS__ = [];
  globalThis.__GET_DOC_STUB__ = undefined;
  globalThis.__GET_DOCS_STUB__ = undefined;
}

before(async () => {
  const dom = new JSDOM(`<!doctype html><html><body>${ADMIN_BODY_NO_SCRIPTS}</body></html>`, {
    url: "https://example.test/"
  });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
  globalThis.MouseEvent = dom.window.MouseEvent;
  globalThis.KeyboardEvent = dom.window.KeyboardEvent;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Event = dom.window.Event;
  globalThis.File = dom.window.File;
  globalThis.FormData = dom.window.FormData;
  // import chain ลากไปถึง js/orders-tab-modal.js เสมอ (ดูหมายเหตุหัวไฟล์) ซึ่ง switchOdTab()
  // เรียก scrollIntoView() ทุกครั้งที่เปิดป๊อปอัพ — ต้อง stub ก่อน import เหมือน submit-flow test
  dom.window.HTMLElement.prototype.scrollIntoView = function () {};

  attachMod = await import("../js/orders-tab-modal-attach.js");
  qcMod = await import("../js/orders-tab-modal-qc.js");
  historyMod = await import("../js/orders-tab-modal-history.js");
  designApprovalsMod = await import("../js/orders-tab-modal-design-approvals.js");
  document = dom.window.document;
});

beforeEach(() => {
  resetFirebaseCalls();
  attachMod.setCurrentAttachments([]);
  qcMod.setCurrentQcChecklist([]);
  attachMod.attachStatusEl.textContent = "";
  globalThis.fetch = undefined;
});

function flushAsync() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function makeFile(name, type, content = "hello") {
  return new document.defaultView.File([content], name, { type });
}

function setInputFiles(input, file) {
  Object.defineProperty(input, "files", { value: file ? [file] : [], configurable: true });
}

function click(el) {
  el.dispatchEvent(new document.defaultView.MouseEvent("click", { bubbles: true }));
}

// ===========================================================================
// js/orders-tab-modal-attach.js
// ===========================================================================
describe("js/orders-tab-modal-attach.js — renderAttachGrid() (รอบที่ 91, Phase 2)", () => {
  test("currentAttachments ว่าง → แสดงข้อความ 'ยังไม่มีไฟล์แนบ'", () => {
    attachMod.setCurrentAttachments([]);
    attachMod.renderAttachGrid();
    assert.match(document.getElementById("cp-o-attach-grid").innerHTML, /ยังไม่มีไฟล์แนบ/);
  });

  test("ไฟล์ type=image → render <img> ไม่มี class 'is-file', ไฟล์อื่น → render ไอคอนไฟล์ + class 'is-file'", () => {
    attachMod.setCurrentAttachments([
      { url: "https://x/a.png", type: "image/png", label: "a.png" },
      { url: "https://x/b.pdf", type: "application/pdf", label: "b.pdf" }
    ]);
    attachMod.renderAttachGrid();
    const items = document.querySelectorAll("#cp-o-attach-grid .cp-attach-item");
    assert.equal(items.length, 2);
    assert.ok(items[0].querySelector("img"), "ไฟล์รูปต้องมี <img>");
    assert.ok(!items[0].classList.contains("is-file"));
    assert.ok(!items[1].querySelector("img"), "ไฟล์ที่ไม่ใช่รูปต้องไม่มี <img>");
    assert.ok(items[1].classList.contains("is-file"));
  });

  test("รู้จักไฟล์รูปจากนามสกุล url ได้ด้วยแม้ type จะไม่ขึ้นต้นด้วย 'image' (เช่น type ว่าง)", () => {
    attachMod.setCurrentAttachments([{ url: "https://x/photo.jpeg", type: "", label: "photo.jpeg" }]);
    attachMod.renderAttachGrid();
    const item = document.querySelector("#cp-o-attach-grid .cp-attach-item");
    assert.ok(item.querySelector("img"), "ต้อง fallback ไปเช็คนามสกุลไฟล์จาก url เมื่อ type ว่าง");
  });

  test("escape label ป้องกัน HTML injection ในชื่อไฟล์แนบที่ไม่ใช่รูป (label render เป็น text เดียว)", () => {
    attachMod.setCurrentAttachments([
      { url: "https://x/c", type: "text/plain", label: "<img src=x onerror=alert(1)>" }
    ]);
    attachMod.renderAttachGrid();
    const span = document.querySelector("#cp-o-attach-grid .cp-attach-item.is-file span");
    assert.equal(span.children.length, 0, "label ต้อง render เป็น text node เดียว ไม่มี element ย่อยจาก injection");
    assert.equal(span.textContent, "<img src=x onerror=alert(1)>");
  });

  test("คลิกปุ่มลบ (.cp-attach-remove) → splice ออกจาก currentAttachments ตาม index + re-render", () => {
    attachMod.setCurrentAttachments([
      { url: "u1", type: "image/png", label: "1" },
      { url: "u2", type: "image/png", label: "2" }
    ]);
    attachMod.renderAttachGrid();
    const grid = document.getElementById("cp-o-attach-grid");
    click(grid.querySelector('.cp-attach-remove[data-idx="0"]'));

    assert.equal(attachMod.currentAttachments.length, 1);
    assert.equal(attachMod.currentAttachments[0].label, "2");
    assert.equal(grid.querySelectorAll(".cp-attach-item").length, 1);
  });

  // P0.2c: checkbox "ลูกค้าเห็น" ต่อไฟล์ — คัด designFiles (หน้าอนุมัติแบบ)
  test("renderAttachGrid(): checkbox ลูกค้าเห็น ติ๊กตาม a.showToCustomer ที่มีอยู่ก่อนแล้ว", () => {
    attachMod.setCurrentAttachments([
      { url: "u1", type: "image/png", label: "1", showToCustomer: true },
      { url: "u2", type: "image/png", label: "2" }
    ]);
    attachMod.renderAttachGrid();
    const boxes = document.querySelectorAll("#cp-o-attach-grid .cp-attach-visible-toggle");
    assert.equal(boxes.length, 2);
    assert.equal(boxes[0].checked, true);
    assert.equal(boxes[1].checked, false);
  });

  test("ติ๊ก checkbox ลูกค้าเห็น (change event) → เขียนค่าลง currentAttachments[idx].showToCustomer ตรงๆ ไม่ re-render", () => {
    attachMod.setCurrentAttachments([{ url: "u1", type: "image/png", label: "1" }]);
    attachMod.renderAttachGrid();
    const grid = document.getElementById("cp-o-attach-grid");
    const box = grid.querySelector('.cp-attach-visible-toggle[data-idx="0"]');
    box.checked = true;
    box.dispatchEvent(new document.defaultView.Event("change", { bubbles: true }));

    assert.equal(attachMod.currentAttachments[0].showToCustomer, true);
  });

  test("เลิกติ๊ก checkbox ลูกค้าเห็น → showToCustomer กลับเป็น false", () => {
    attachMod.setCurrentAttachments([{ url: "u1", type: "image/png", label: "1", showToCustomer: true }]);
    attachMod.renderAttachGrid();
    const grid = document.getElementById("cp-o-attach-grid");
    const box = grid.querySelector('.cp-attach-visible-toggle[data-idx="0"]');
    box.checked = false;
    box.dispatchEvent(new document.defaultView.Event("change", { bubbles: true }));

    assert.equal(attachMod.currentAttachments[0].showToCustomer, false);
  });
});

describe("js/orders-tab-modal-attach.js — attachImageInput/attachFileInput change listener (รอบที่ 91, Phase 2)", () => {
  test("ไม่มีไฟล์เลือก (input.files ว่าง) → ไม่เรียก fetch เลย ไม่เปลี่ยน status", async () => {
    const input = document.getElementById("cp-o-attach-image");
    setInputFiles(input, null);
    let fetchCalled = false;
    globalThis.fetch = async () => { fetchCalled = true; };

    input.dispatchEvent(new document.defaultView.Event("change", { bubbles: true }));
    await flushAsync();

    assert.equal(fetchCalled, false);
    assert.equal(attachMod.attachStatusEl.textContent, "");
  });

  test("อัปโหลดรูปสำเร็จ → push currentAttachments (type='image', uploadedBy ว่างเพราะไม่ login) + renderAttachGrid + status สำเร็จ + เคลียร์ input.value", async () => {
    const input = document.getElementById("cp-o-attach-image");
    setInputFiles(input, makeFile("photo.png", "image/png"));
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({ secure_url: "https://res.cloudinary.com/x/image/upload/v1/paisign/products/photo.png" })
    });

    input.dispatchEvent(new document.defaultView.Event("change", { bubbles: true }));
    await flushAsync();
    await flushAsync();

    assert.equal(attachMod.currentAttachments.length, 1);
    assert.equal(attachMod.currentAttachments[0].type, "image");
    assert.equal(attachMod.currentAttachments[0].label, "photo.png");
    assert.equal(attachMod.currentAttachments[0].uploadedBy, "", "auth.currentUser เป็น null ตาม stub default → uploadedBy ว่าง");
    assert.match(attachMod.currentAttachments[0].url, /f_auto,q_auto,w_900,h_900,c_limit/);
    assert.equal(attachMod.attachStatusEl.textContent, "อัปโหลดรูปสำเร็จ");
    assert.equal(document.getElementById("cp-o-attach-grid").querySelectorAll(".cp-attach-item").length, 1);
    assert.equal(input.value, "");
  });

  test("อัปโหลดรูปล้มเหลว (fetch ok:false) → status แสดง error message ไม่ push currentAttachments", async () => {
    const input = document.getElementById("cp-o-attach-image");
    setInputFiles(input, makeFile("bad.png", "image/png"));
    globalThis.fetch = async () => ({ ok: false });

    input.dispatchEvent(new document.defaultView.Event("change", { bubbles: true }));
    await flushAsync();
    await flushAsync();

    assert.equal(attachMod.currentAttachments.length, 0);
    assert.equal(attachMod.attachStatusEl.textContent, "อัปโหลดไม่สำเร็จ: อัปโหลดรูปไม่สำเร็จ");
  });

  test("อัปโหลดไฟล์ (ไม่ใช่รูป) สำเร็จ → currentAttachments[].type = file.type จริง (ไม่ใช่ 'image') + เรียก /auto/upload", async () => {
    const input = document.getElementById("cp-o-attach-file");
    setInputFiles(input, makeFile("catalog.pdf", "application/pdf"));
    let capturedUrl;
    globalThis.fetch = async (url) => {
      capturedUrl = url;
      return { ok: true, json: async () => ({ secure_url: "https://res.cloudinary.com/x/auto/upload/v1/paisign/files/catalog.pdf" }) };
    };

    input.dispatchEvent(new document.defaultView.Event("change", { bubbles: true }));
    await flushAsync();
    await flushAsync();

    assert.equal(attachMod.currentAttachments.length, 1);
    assert.equal(attachMod.currentAttachments[0].type, "application/pdf");
    assert.equal(attachMod.currentAttachments[0].label, "catalog.pdf");
    assert.match(capturedUrl, /\/auto\/upload$/);
    assert.equal(attachMod.attachStatusEl.textContent, "อัปโหลดไฟล์สำเร็จ");
  });

  test("อัปโหลดไฟล์ล้มเหลว (fetch ok:false) → status แสดง error message เฉพาะของไฟล์ (ต่างข้อความจากรูป)", async () => {
    const input = document.getElementById("cp-o-attach-file");
    setInputFiles(input, makeFile("bad.pdf", "application/pdf"));
    globalThis.fetch = async () => ({ ok: false });

    input.dispatchEvent(new document.defaultView.Event("change", { bubbles: true }));
    await flushAsync();
    await flushAsync();

    assert.equal(attachMod.currentAttachments.length, 0);
    assert.equal(
      attachMod.attachStatusEl.textContent,
      "อัปโหลดไม่สำเร็จ: อัปโหลดไฟล์ไม่สำเร็จ (เช็คว่า Cloudinary preset เปิดรับไฟล์ประเภทนี้หรือยัง)"
    );
  });
});

// ===========================================================================
// js/orders-tab-modal-qc.js
// ===========================================================================
describe("js/orders-tab-modal-qc.js — QC checklist (รอบที่ 91, Phase 2)", () => {
  test("renderQcList(): currentQcChecklist ว่าง → แสดงข้อความ 'ยังไม่มีรายการตรวจสอบคุณภาพ'", () => {
    qcMod.setCurrentQcChecklist([]);
    qcMod.renderQcList();
    assert.match(document.getElementById("cp-o-qc-list").innerHTML, /ยังไม่มีรายการตรวจสอบคุณภาพ/);
  });

  test("renderQcList(): แสดงแถวตาม currentQcChecklist ครบ (checkbox ติ๊กตาม checked, label ใส่ใน input ถูกต้อง)", () => {
    qcMod.setCurrentQcChecklist([
      { label: "ตรวจสี", checked: true },
      { label: "ตรวจขนาด", checked: false }
    ]);
    qcMod.renderQcList();
    const rows = document.querySelectorAll("#cp-o-qc-list .cp-qc-row");
    assert.equal(rows.length, 2);
    assert.equal(rows[0].querySelector('[data-qc-check]').checked, true);
    assert.equal(rows[0].querySelector(".cl-input").value, "ตรวจสี");
    assert.equal(rows[1].querySelector('[data-qc-check]').checked, false);
    assert.equal(rows[1].querySelector(".cl-input").value, "ตรวจขนาด");
  });

  test("escape label ป้องกัน attribute breakout ในช่อง value (label มี double-quote)", () => {
    qcMod.setCurrentQcChecklist([{ label: '" onmouseover="alert(1)', checked: false }]);
    qcMod.renderQcList();
    const rows = document.querySelectorAll("#cp-o-qc-list .cp-qc-row");
    assert.equal(rows.length, 1, "โครงสร้างต้องไม่พังจาก quote ที่ไม่ได้ escape");
    const input = rows[0].querySelector(".cl-input");
    assert.equal(input.value, '" onmouseover="alert(1)');
    assert.equal(input.getAttribute("onmouseover"), null, "ต้องไม่มี attribute แปลกปลอมถูกฉีดเข้ามา");
  });

  test("พิมพ์แก้ label (input event, data-qc-label) → currentQcChecklist[idx].label อัปเดตตรงตาม value ใหม่", () => {
    qcMod.setCurrentQcChecklist([{ label: "เดิม", checked: false }]);
    qcMod.renderQcList();
    const input = document.querySelector('#cp-o-qc-list [data-qc-label="0"]');
    input.value = "แก้ไขแล้ว";
    input.dispatchEvent(new document.defaultView.Event("input", { bubbles: true }));
    assert.equal(qcMod.currentQcChecklist[0].label, "แก้ไขแล้ว");
  });

  test("ติ๊ก checkbox (change event, data-qc-check) → currentQcChecklist[idx].checked อัปเดตตาม", () => {
    qcMod.setCurrentQcChecklist([{ label: "x", checked: false }]);
    qcMod.renderQcList();
    const cb = document.querySelector('#cp-o-qc-list [data-qc-check="0"]');
    cb.checked = true;
    cb.dispatchEvent(new document.defaultView.Event("change", { bubbles: true }));
    assert.equal(qcMod.currentQcChecklist[0].checked, true);
  });

  test("คลิกปุ่มลบ (data-qc-remove) → splice ออกจาก currentQcChecklist ตาม index + re-render", () => {
    qcMod.setCurrentQcChecklist([
      { label: "a", checked: false },
      { label: "b", checked: true }
    ]);
    qcMod.renderQcList();
    click(document.querySelector('#cp-o-qc-list [data-qc-remove="0"]'));

    assert.equal(qcMod.currentQcChecklist.length, 1);
    assert.equal(qcMod.currentQcChecklist[0].label, "b");
    assert.equal(document.querySelectorAll("#cp-o-qc-list .cp-qc-row").length, 1);
  });

  test("คลิกปุ่มเพิ่ม (#cp-o-qc-add) → push รายการใหม่ label ว่าง/checked false + re-render", () => {
    qcMod.setCurrentQcChecklist([]);
    qcMod.renderQcList();
    click(document.getElementById("cp-o-qc-add"));

    assert.equal(qcMod.currentQcChecklist.length, 1);
    assert.deepEqual(qcMod.currentQcChecklist[0], { label: "", checked: false });
    assert.equal(document.querySelectorAll("#cp-o-qc-list .cp-qc-row").length, 1);
  });
});

// ===========================================================================
// js/orders-tab-modal-history.js
// ===========================================================================
describe("js/orders-tab-modal-history.js — loadOrderHistory(orderId) (รอบที่ 91, Phase 2)", () => {
  test("orderId ว่าง (null) → แสดงข้อความ placeholder ไม่เรียก listAuditLog", async () => {
    let getDocsCalled = false;
    globalThis.__GET_DOCS_STUB__ = () => { getDocsCalled = true; return []; };
    await historyMod.loadOrderHistory(null);
    assert.match(document.getElementById("cp-o-history-list").innerHTML, /บันทึกคำสั่งผลิตนี้ให้เสร็จก่อน/);
    assert.equal(getDocsCalled, false, "ไม่ควรเรียก getDocs()/listAuditLog() เลยเมื่อ orderId ว่าง");
  });

  test("ระหว่างโหลด (ก่อน promise resolve) → แสดงข้อความ 'กำลังโหลด…' ชั่วคราว", async () => {
    globalThis.__GET_DOCS_STUB__ = (ref) => (ref.path === "auditLog" ? [] : []);
    const box = document.getElementById("cp-o-history-list");
    const p = historyMod.loadOrderHistory("order-loading");
    assert.match(box.innerHTML, /กำลังโหลด/);
    await p;
  });

  test("orderId มีค่า แต่ไม่มี log ที่ targetType/targetId ตรงกัน → แสดง 'ยังไม่มีประวัติการแก้ไขสำหรับคำสั่งผลิตนี้'", async () => {
    globalThis.__GET_DOCS_STUB__ = (ref) => (ref.path === "auditLog"
      ? [{ id: "l1", data: { targetType: "order", targetId: "other-order", action: "แก้ไข" } }]
      : []);
    await historyMod.loadOrderHistory("order-1");
    assert.match(document.getElementById("cp-o-history-list").innerHTML, /ยังไม่มีประวัติการแก้ไขสำหรับคำสั่งผลิตนี้/);
  });

  test("orderId มีค่า + มี log ตรง targetId → render เฉพาะ log ที่ targetType='order' และ targetId ตรงกัน (กรอง log อื่นออก)", async () => {
    globalThis.__GET_DOCS_STUB__ = (ref) => (ref.path === "auditLog"
      ? [
        { id: "l1", data: { targetType: "order", targetId: "order-1", action: "สร้างคำสั่งผลิต", email: "a@x.com" } },
        { id: "l2", data: { targetType: "order", targetId: "order-1", action: "แก้ไขที่อยู่จัดส่ง", meta: "เปลี่ยนที่อยู่", uid: "uid-9" } },
        { id: "l3", data: { targetType: "order", targetId: "order-2", action: "คนละคำสั่งผลิต" } },
        { id: "l4", data: { targetType: "lead", targetId: "order-1", action: "คนละ targetType" } }
      ]
      : []);
    await historyMod.loadOrderHistory("order-1");
    const items = document.querySelectorAll("#cp-o-history-list .cp-history-item");
    assert.equal(items.length, 2, "ต้องกรองเหลือแค่ log ที่ targetType=order และ targetId ตรงกันเท่านั้น");
    assert.match(items[0].querySelector(".cp-history-action").textContent, /สร้างคำสั่งผลิต/);
    assert.match(items[0].querySelector(".cp-history-meta").textContent, /a@x\.com/);
    assert.match(items[1].querySelector(".cp-history-action").textContent, /แก้ไขที่อยู่จัดส่ง — เปลี่ยนที่อยู่/);
    assert.match(items[1].querySelector(".cp-history-meta").textContent, /uid-9/);
  });

  test("listAuditLog() throw error → แสดง errorStateHTML พร้อมปุ่ม 'ลองใหม่' (ไม่ throw ออกมานอกฟังก์ชัน)", async () => {
    globalThis.__GET_DOCS_STUB__ = (ref) => {
      if (ref.path === "auditLog") throw new Error("โหลดล้มเหลวทดสอบ");
      return [];
    };
    await assert.doesNotReject(async () => { await historyMod.loadOrderHistory("order-err"); });
    const box = document.getElementById("cp-o-history-list");
    assert.match(box.innerHTML, /โหลดประวัติไม่สำเร็จ/);
    assert.ok(box.querySelector(".cp-retry-btn"));
  });

  test("กดปุ่ม 'ลองใหม่' หลัง error → เรียก loadOrderHistory(orderId) ซ้ำจริง (สำเร็จรอบ 2 → แสดงผลใหม่แทน error เดิม)", async () => {
    let shouldFail = true;
    globalThis.__GET_DOCS_STUB__ = (ref) => {
      if (ref.path !== "auditLog") return [];
      if (shouldFail) throw new Error("ล้มเหลวรอบแรก");
      return [{ id: "l1", data: { targetType: "order", targetId: "order-retry", action: "กู้คืนสำเร็จ" } }];
    };
    await historyMod.loadOrderHistory("order-retry");
    const box = document.getElementById("cp-o-history-list");
    const retryBtn = box.querySelector(".cp-retry-btn");
    assert.ok(retryBtn, "ต้องมีปุ่มลองใหม่หลัง error");

    shouldFail = false;
    retryBtn.dispatchEvent(new document.defaultView.MouseEvent("click", { bubbles: true }));
    await flushAsync();
    await flushAsync();

    assert.match(box.innerHTML, /กู้คืนสำเร็จ/);
  });
});

// ===========================================================================
// js/orders-tab-modal-design-approvals.js — P0.2c
// ===========================================================================
describe("js/orders-tab-modal-design-approvals.js — loadDesignApprovals(order) (P0.2c)", () => {
  test("order เป็น null → แสดงข้อความ placeholder ไม่เรียก listDesignApprovals", async () => {
    let getDocsCalled = false;
    globalThis.__GET_DOCS_STUB__ = () => { getDocsCalled = true; return []; };
    await designApprovalsMod.loadDesignApprovals(null);
    assert.match(
      document.getElementById("cp-o-design-approvals-list").innerHTML,
      /ต้องกรอกเลขที่คำสั่งผลิต \+ เบอร์โทรลูกค้าให้ครบก่อน/
    );
    assert.equal(getDocsCalled, false, "ไม่ควรเรียก getDocs()/listDesignApprovals() เลยเมื่อ trackingId ว่าง");
  });

  test("order มี code/phone ไม่ครบ (buildTrackingId คืน null) → แสดง placeholder เดียวกัน ไม่ query", async () => {
    let getDocsCalled = false;
    globalThis.__GET_DOCS_STUB__ = () => { getDocsCalled = true; return []; };
    await designApprovalsMod.loadDesignApprovals({ code: "PO123", phone: "" });
    assert.match(
      document.getElementById("cp-o-design-approvals-list").innerHTML,
      /ต้องกรอกเลขที่คำสั่งผลิต/
    );
    assert.equal(getDocsCalled, false);
  });

  test("ระหว่างโหลด (ก่อน promise resolve) → แสดงข้อความ 'กำลังโหลด…' ชั่วคราว", async () => {
    globalThis.__GET_DOCS_STUB__ = (ref) => (ref.path === "design_approvals" ? [] : []);
    const box = document.getElementById("cp-o-design-approvals-list");
    const p = designApprovalsMod.loadDesignApprovals({ code: "PO123", phone: "0812345678" });
    assert.match(box.innerHTML, /กำลังโหลด/);
    await p;
  });

  test("trackingId ถูกต้อง แต่ไม่มี log ตรงกัน → แสดง 'ยังไม่มีประวัติการอนุมัติ/ขอแก้ไขแบบสำหรับคำสั่งผลิตนี้'", async () => {
    globalThis.__GET_DOCS_STUB__ = (ref) => (ref.path === "design_approvals"
      ? [{ id: "a1", data: { trackingId: "OTHER_5678", action: "approved" } }]
      : []);
    await designApprovalsMod.loadDesignApprovals({ code: "PO123", phone: "0812345678" });
    assert.match(
      document.getElementById("cp-o-design-approvals-list").innerHTML,
      /ยังไม่มีประวัติการอนุมัติ\/ขอแก้ไขแบบสำหรับคำสั่งผลิตนี้/
    );
  });

  test("มี log ตรง trackingId → render ครบ (label ตาม action, คอมเมนต์ต่อท้าย, กรอง trackingId อื่นออก)", async () => {
    // buildTrackingId("PO123", "0812345678") → "PO123_5678"
    globalThis.__GET_DOCS_STUB__ = (ref) => (ref.path === "design_approvals"
      ? [
        { id: "a1", data: { trackingId: "PO123_5678", action: "approved", comment: "" } },
        { id: "a2", data: { trackingId: "PO123_5678", action: "changes_requested", comment: "ขอเปลี่ยนสี" } },
        { id: "a3", data: { trackingId: "OTHER_9999", action: "approved" } }
      ]
      : []);
    await designApprovalsMod.loadDesignApprovals({ code: "PO123", phone: "0812345678" });
    const items = document.querySelectorAll("#cp-o-design-approvals-list .cp-history-item");
    assert.equal(items.length, 2, "ต้องกรองเหลือแค่ log ที่ trackingId ตรงกันเท่านั้น");
    assert.match(items[0].querySelector(".cp-history-action").textContent, /^อนุมัติแบบ$/);
    assert.match(items[1].querySelector(".cp-history-action").textContent, /ขอแก้ไขแบบ — ขอเปลี่ยนสี/);
    assert.ok(items[1].querySelector(".cp-history-dot").classList.contains("is-warn"), "ขอแก้ไขแบบต้องมีจุดสี is-warn");
    assert.ok(!items[0].querySelector(".cp-history-dot").classList.contains("is-warn"), "อนุมัติแบบไม่ควรมี is-warn");
  });

  test("escape comment ป้องกัน HTML injection", async () => {
    globalThis.__GET_DOCS_STUB__ = (ref) => (ref.path === "design_approvals"
      ? [{ id: "a1", data: { trackingId: "PO123_5678", action: "changes_requested", comment: "<img src=x onerror=alert(1)>" } }]
      : []);
    await designApprovalsMod.loadDesignApprovals({ code: "PO123", phone: "0812345678" });
    const actionEl = document.querySelector("#cp-o-design-approvals-list .cp-history-action");
    assert.equal(actionEl.children.length, 0, "ต้อง render เป็น text node เดียว ไม่มี element ย่อยจาก injection");
    assert.match(actionEl.textContent, /<img src=x onerror=alert\(1\)>/);
  });

  test("listDesignApprovals() throw error → แสดง errorStateHTML พร้อมปุ่ม 'ลองใหม่' (ไม่ throw ออกมานอกฟังก์ชัน)", async () => {
    globalThis.__GET_DOCS_STUB__ = (ref) => {
      if (ref.path === "design_approvals") throw new Error("โหลดล้มเหลวทดสอบ");
      return [];
    };
    await assert.doesNotReject(async () => {
      await designApprovalsMod.loadDesignApprovals({ code: "PO123", phone: "0812345678" });
    });
    const box = document.getElementById("cp-o-design-approvals-list");
    assert.match(box.innerHTML, /โหลดประวัติอนุมัติแบบไม่สำเร็จ/);
    assert.ok(box.querySelector(".cp-retry-btn"));
  });

  test("กดปุ่ม 'ลองใหม่' หลัง error → เรียก loadDesignApprovals(order) ซ้ำจริง (สำเร็จรอบ 2 → แสดงผลใหม่แทน error เดิม)", async () => {
    let shouldFail = true;
    globalThis.__GET_DOCS_STUB__ = (ref) => {
      if (ref.path !== "design_approvals") return [];
      if (shouldFail) throw new Error("ล้มเหลวรอบแรก");
      return [{ id: "a1", data: { trackingId: "PO123_5678", action: "approved" } }];
    };
    await designApprovalsMod.loadDesignApprovals({ code: "PO123", phone: "0812345678" });
    const box = document.getElementById("cp-o-design-approvals-list");
    const retryBtn = box.querySelector(".cp-retry-btn");
    assert.ok(retryBtn, "ต้องมีปุ่มลองใหม่หลัง error");

    shouldFail = false;
    retryBtn.dispatchEvent(new document.defaultView.MouseEvent("click", { bubbles: true }));
    await flushAsync();
    await flushAsync();

    assert.match(box.innerHTML, /อนุมัติแบบ/);
  });
});
