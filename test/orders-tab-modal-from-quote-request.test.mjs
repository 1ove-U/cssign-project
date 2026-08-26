// test/orders-tab-modal-from-quote-request.test.mjs
//
// ช่องโหว่ที่ 1: "สร้างคำสั่งผลิตจากคำขอใบเสนอราคา → ไม่คัดลอก LINE user ID โดยอัตโนมัติ"
// เดิม ปุ่ม "เพิ่มคำสั่งผลิต" เปิดฟอร์มเปล่าเสมอ ช่อง LINE user ID ต้องพิมพ์/เลือกเองจาก
// <datalist> ที่รวมชื่อจากคำขอใบเสนอราคา "ทุกใบ" — เป็นแค่ตัวช่วยเดา ไม่ผูกกับคำขอต้นทางจริง
// ของคำสั่งผลิตใบนั้นเลย
//
// เทสนี้ตรวจฟังก์ชันใหม่ openOrderModalFromQuoteRequest(request) (js/orders-tab-modal.js) ที่
// เรียกจากปุ่ม "สร้างคำสั่งผลิต" ในโมดัลเลือกคำขอของ js/admin-quotations.js — ต้องคัดลอก
// lineUserId (และข้อมูลลูกค้าอื่นที่มี) ตรงจาก request object ที่ส่งเข้ามาเสมอ ไม่ใช่ค่าที่
// แอดมินต้องเลือก/พิมพ์เอง และต้องเปิดเป็นฟอร์ม "เพิ่ม" ใหม่ล้วนๆ (ไม่ใช่ "แก้ไข")
//
// pattern jsdom เดียวกับ test/orders-tab-modal-submit-flow.test.mjs (jsdom + import โมดูลครั้ง
// เดียวสำหรับทั้งไฟล์ — ดูหมายเหตุเต็มที่หัวไฟล์นั้นว่าทำไมห้ามสร้าง dom ใหม่ทุกเทส)

import { test, describe, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const ADMIN_HTML = readFileSync(new URL("../admin.html", import.meta.url), "utf-8");
const BODY_START = ADMIN_HTML.indexOf(">", ADMIN_HTML.indexOf("<body")) + 1;
const BODY_END = ADMIN_HTML.indexOf("</body>");
const ADMIN_BODY_NO_SCRIPTS = ADMIN_HTML
  .slice(BODY_START, BODY_END)
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, "");

let document;
let openOrderModalFromQuoteRequest;

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
  // switchOdTab() เรียก scrollIntoView() ทุกครั้งที่เปิดป๊อปอัพ ต้อง stub ก่อน import เสมอ
  dom.window.HTMLElement.prototype.scrollIntoView = function () {};

  const mod = await import("../js/orders-tab-modal.js");
  openOrderModalFromQuoteRequest = mod.openOrderModalFromQuoteRequest;
  document = dom.window.document;
});

describe("js/orders-tab-modal.js — openOrderModalFromQuoteRequest() (ช่องโหว่ที่ 1)", () => {
  test("คัดลอก lineUserId ตรงจาก request ต้นทาง เข้าช่อง cp-o-line-user-id โดยอัตโนมัติ", () => {
    const request = {
      id: "qr-001",
      billingName: "บริษัท ทดสอบ จำกัด",
      contactPerson: "คุณทดสอบ",
      phone: "0812345678",
      email: "test@example.com",
      lineUserId: "Uabc123realsource",
      shippingAddress: "123 ถนนทดสอบ",
      billingAddress: "456 ถนนออกใบกำกับ",
      items: [{ name: "ป้ายเตือนไฟฟ้าแรงสูง" }, { name: "ป้ายทางออกฉุกเฉิน" }]
    };

    openOrderModalFromQuoteRequest(request);

    assert.equal(document.getElementById("cp-o-line-user-id").value, "Uabc123realsource");
    assert.equal(document.getElementById("cp-o-customer").value, "บริษัท ทดสอบ จำกัด");
    assert.equal(document.getElementById("cp-o-phone").value, "0812345678");
    assert.equal(document.getElementById("cp-o-email").value, "test@example.com");
    assert.equal(document.getElementById("cp-o-shipping-address").value, "123 ถนนทดสอบ");
    assert.equal(document.getElementById("cp-o-invoice-address").value, "456 ถนนออกใบกำกับ");
    assert.equal(
      document.getElementById("cp-o-item").value,
      "ป้ายเตือนไฟฟ้าแรงสูง, ป้ายทางออกฉุกเฉิน"
    );
  });

  test("ใช้ contactPerson แทนได้ถ้า request ไม่มี billingName", () => {
    openOrderModalFromQuoteRequest({
      id: "qr-002",
      contactPerson: "คุณสำรอง",
      lineUserId: "Uonlycontactperson"
    });
    assert.equal(document.getElementById("cp-o-customer").value, "คุณสำรอง");
    assert.equal(document.getElementById("cp-o-line-user-id").value, "Uonlycontactperson");
  });

  test("เปิดเป็นฟอร์ม 'เพิ่ม' ใหม่เสมอ ไม่ใช่ 'แก้ไข' — เคลียร์เลขที่/id คำสั่งผลิตเดิม", () => {
    // ตั้งค่าเดิมไว้ก่อนเหมือนเพิ่งแก้ไขคำสั่งผลิตใบอื่นค้างอยู่ ต้องถูกเคลียร์ทับหมด
    document.getElementById("cp-o-id").value = "some-old-order-id";
    document.getElementById("cp-o-code").value = "PO-2026-0001";

    openOrderModalFromQuoteRequest({ id: "qr-003", billingName: "ลูกค้าใหม่", lineUserId: "Unewcustomer" });

    assert.equal(document.getElementById("cp-o-id").value, "");
    assert.equal(document.getElementById("cp-o-code").value, "");
    assert.equal(
      document.getElementById("cp-order-modal-title").textContent,
      "เพิ่มคำสั่งผลิต"
    );
  });

  test("request ไม่มี lineUserId → ช่องว่างเปล่า ไม่ throw (ยังกรอกเองได้ตามปกติ)", () => {
    assert.doesNotThrow(() => {
      openOrderModalFromQuoteRequest({ id: "qr-004", billingName: "ลูกค้าไม่มีไลน์" });
    });
    assert.equal(document.getElementById("cp-o-line-user-id").value, "");
  });

  test("request เป็น null/undefined → ไม่ throw และไม่เปิดป๊อปอัพ", () => {
    assert.doesNotThrow(() => openOrderModalFromQuoteRequest(null));
    assert.doesNotThrow(() => openOrderModalFromQuoteRequest(undefined));
  });
});
