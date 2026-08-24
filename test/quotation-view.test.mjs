// test/quotation-view.test.mjs — P3.0 Phase 4 รอบ 2 (หน้า public ดูใบเสนอราคา)
//
// ขอบเขต: js/quotation-view.js เท่านั้น — ไม่ทดสอบ getQuotationByToken()/addQuotation()/ฯลฯ ซ้ำ
// (มีเทสละเอียดอยู่แล้วใน test/db-quotations.test.mjs) ไฟล์นี้ทดสอบ 2 ส่วน:
//   1) pure function ล้วนๆ (formatBaht/formatQuoteDate/statusLabel/itemRowHTML/itemsTableHTML/
//      totalsHTML/customerInfoHTML/shippingInfoHTML/escapeHtml) — เรียกตรงๆ ไม่ต้องมี DOM
//   2) DOM wiring ขั้นต่ำ (token ถูก → แสดงข้อมูล, token ผิด/ไม่พบ → not-found state) — mock
//      getQuotationByToken() ที่ boundary Firestore ผ่าน globalThis.__GET_DOC_STUB__ (pattern
//      เดียวกับ test/db-quotations.test.mjs) แล้ว set location.search ก่อน import ไฟล์จริง
//
// markup ขั้นต่ำที่มีแค่ id ที่ quotation-view.js query หาเอง (pattern เดียวกับ
// test/my-orders-page.test.mjs — ไม่ต้องมี navbar/footer จริงเพราะไฟล์นี้ไม่แตะส่วนนั้นเลย)
//
// ไม่ได้แก้ไฟล์ .js/.html/.css ที่เป็นโค้ดจริงเลยแม้แต่บรรทัดเดียวในไฟล์นี้ — งานทดสอบล้วนๆ

import { test, describe, afterEach } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

let formatBaht, formatQuoteDate, statusLabel, itemRowHTML, itemsTableHTML,
    totalsHTML, customerInfoHTML, shippingInfoHTML, escapeHtml, customerResponseText;

// ต้องมี globalThis.document อยู่ก่อน import เสมอ (แม้จะไม่มี markup ของหน้านี้เลยก็ตาม) เพราะ
// IIFE ท้ายไฟล์เรียก document.getElementById() ทันทีตอนถูก evaluate ก่อนเช็ค guard — ตั้ง DOM
// เปล่าๆ ไว้ก่อน แล้วค่อยแทนที่ globalThis.document/window ด้วย DOM จริงในแต่ละเทส DOM wiring
// ด้านล่างอีกที (pattern เดียวกับ test/db-quotations.test.mjs ที่ตั้ง JSDOM ใน before() ก่อน
// import เสมอ)
{
  const bootDom = new JSDOM("<!doctype html><html><body></body></html>", { url: "https://example.test/" });
  globalThis.window = bootDom.window;
  globalThis.document = bootDom.window.document;
}

// import แบบ pure function ไม่ต้องมี DOM ของหน้านี้เลย (guard ใน IIFE ท้ายไฟล์จะ return เงียบๆ
// เพราะ qv-skeleton/qv-not-found/qv-root หาไม่เจอใน DOM เปล่าด้านบน)
const mod = await import("../js/quotation-view.js");
({ formatBaht, formatQuoteDate, statusLabel, itemRowHTML, itemsTableHTML,
   totalsHTML, customerInfoHTML, shippingInfoHTML, escapeHtml, customerResponseText } = mod);

afterEach(() => {
  globalThis.__GET_DOC_STUB__ = undefined;
  globalThis.__UPDATE_DOC_CALLS__ = undefined;
  globalThis.__SET_DOC_CALLS__ = undefined;
});

describe("escapeHtml()", () => {
  test("หนี HTML special chars ครบ", () => {
    assert.equal(escapeHtml(`<a href="x">&'</a>`), "&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;");
  });
  test("undefined/null → สตริงว่าง", () => {
    assert.equal(escapeHtml(undefined), "");
    assert.equal(escapeHtml(null), "");
  });
});

describe("formatBaht()", () => {
  test("จำนวนเต็ม → แสดงทศนิยม 2 ตำแหน่งเสมอ", () => {
    assert.equal(formatBaht(1500), "฿1,500.00");
  });
  test("มีเศษสตางค์ → ปัดตามปกติ", () => {
    assert.equal(formatBaht(1234.5), "฿1,234.50");
  });
  test("ค่าไม่ใช่ตัวเลข/undefined → ถือเป็น 0", () => {
    assert.equal(formatBaht(undefined), "฿0.00");
    assert.equal(formatBaht("x"), "฿0.00");
  });
});

describe("statusLabel()", () => {
  test("แปลสถานะที่รู้จักเป็นภาษาไทย", () => {
    assert.equal(statusLabel("sent"), "ส่งลูกค้าแล้ว");
    assert.equal(statusLabel("accepted"), "ลูกค้าตอบรับ");
  });
  test("สถานะที่ไม่รู้จัก → คืนค่าดิบ", () => {
    assert.equal(statusLabel("weird"), "weird");
  });
  test("ไม่มีค่าเลย → ถือเป็น draft/ร่าง", () => {
    assert.equal(statusLabel(undefined), "ร่าง");
  });
});

describe("formatQuoteDate()", () => {
  test("Firestore Timestamp-like (toMillis) → แปลงเป็นวันที่ไทย", () => {
    const ts = { toMillis: () => new Date("2026-03-15").getTime() };
    const out = formatQuoteDate(ts);
    assert.match(out, /2569|มีนาคม/); // พ.ศ. หรือชื่อเดือนไทย ขึ้นอยู่กับ locale ของ runtime
  });
  test("ไม่มีค่า → คืน em dash", () => {
    assert.equal(formatQuoteDate(null), "—");
    assert.equal(formatQuoteDate(undefined), "—");
  });
  test("ค่าที่ parse ไม่ได้ → คืน em dash ไม่ throw", () => {
    assert.equal(formatQuoteDate("not-a-date"), "—");
  });
});

describe("itemRowHTML() / itemsTableHTML()", () => {
  const SAMPLE_ITEM = { name: "ป้ายไฟ LED", variantLabel: "60x40 / อะคริลิค", qty: 2, unit: "ชิ้น", unitPrice: 1500, discount: 100, lineTotal: 2900 };

  test("แสดง name/variantLabel/qty/unit/unitPrice/discount/lineTotal ครบ", () => {
    const html = itemRowHTML(SAMPLE_ITEM);
    assert.match(html, /ป้ายไฟ LED/);
    assert.match(html, /60x40 \/ อะคริลิค/);
    assert.match(html, /฿1,500\.00/);
    assert.match(html, /฿100\.00/);
    assert.match(html, /฿2,900\.00/);
  });
  test("ไม่มี variantLabel → ไม่แสดงบรรทัดตัวเลือก", () => {
    const html = itemRowHTML({ name: "X", qty: 1, unit: "ชิ้น", unitPrice: 100, discount: 0, lineTotal: 100 });
    assert.doesNotMatch(html, /qv-item-variant/);
  });
  test("discount เป็น 0 → แสดง em dash แทนที่จะเป็น ฿0.00", () => {
    const html = itemRowHTML({ name: "X", qty: 1, unit: "ชิ้น", unitPrice: 100, discount: 0, lineTotal: 100 });
    assert.match(html, /—/);
  });
  test("array ว่าง → แสดงข้อความ 'ไม่มีรายการสินค้า'", () => {
    assert.match(itemsTableHTML([]), /ไม่มีรายการสินค้า/);
    assert.match(itemsTableHTML(undefined), /ไม่มีรายการสินค้า/);
  });
  test("array หลายรายการ → รวมทุกแถว", () => {
    const html = itemsTableHTML([SAMPLE_ITEM, { ...SAMPLE_ITEM, name: "ป้ายที่ 2" }]);
    assert.match(html, /ป้ายไฟ LED/);
    assert.match(html, /ป้ายที่ 2/);
  });
  test("ชื่อสินค้ามี HTML → ถูก escape ไม่ inject", () => {
    const html = itemRowHTML({ name: '<script>alert(1)</script>', qty: 1, unit: "ชิ้น", unitPrice: 0, discount: 0, lineTotal: 0 });
    assert.doesNotMatch(html, /<script>/);
  });
});

describe("totalsHTML()", () => {
  test("vatMode excluded → โชว์แถว VAT บวกเพิ่ม", () => {
    const html = totalsHTML({ vatMode: "excluded", subtotal: 1000, vatAmount: 70, grandTotal: 1070 });
    assert.match(html, /ภาษีมูลค่าเพิ่ม 7%/);
    assert.match(html, /฿1,070\.00/);
  });
  test("vatMode included → โชว์ VAT แยกแบบ 'รวมในราคาแล้ว'", () => {
    const html = totalsHTML({ vatMode: "included", subtotal: 1070, vatAmount: 70, grandTotal: 1070 });
    assert.match(html, /รวมในราคาแล้ว/);
  });
  test("vatMode none → ไม่มีแถว VAT เลย", () => {
    const html = totalsHTML({ vatMode: "none", subtotal: 1000, vatAmount: 0, grandTotal: 1000 });
    assert.doesNotMatch(html, /ภาษีมูลค่าเพิ่ม/);
  });
  test("ไม่มี quotation เลย → ไม่ throw, แสดง 0", () => {
    const html = totalsHTML(null);
    assert.match(html, /฿0\.00/);
  });
});

describe("customerInfoHTML() / shippingInfoHTML()", () => {
  test("มีข้อมูลครบ → แสดงทุกฟิลด์", () => {
    const html = customerInfoHTML({
      billingName: "บริษัท เอบีซี จำกัด", taxId: "0105500000000",
      billingAddress: "123 ถนนสุขุมวิท", contactPerson: "คุณสมชาย",
      phone: "081-234-5678", email: "a@b.com"
    });
    assert.match(html, /บริษัท เอบีซี จำกัด/);
    assert.match(html, /0105500000000/);
    assert.match(html, /คุณสมชาย/);
  });
  test("ไม่มีข้อมูลเลย → แสดง em dash ไม่ throw", () => {
    assert.match(customerInfoHTML({}), /—/);
    assert.match(customerInfoHTML(null), /—/);
  });
  test("shippingInfoHTML: มี shippingAddress → ใช้ค่านั้น", () => {
    assert.match(shippingInfoHTML({ shippingAddress: "999 ถนนพระราม 4", billingAddress: "123 ถนนสุขุมวิท" }), /999 ถนนพระราม 4/);
  });
  test("shippingInfoHTML: ไม่มี shippingAddress → fallback ไปใช้ billingAddress", () => {
    assert.match(shippingInfoHTML({ billingAddress: "123 ถนนสุขุมวิท" }), /123 ถนนสุขุมวิท/);
  });
  test("shippingInfoHTML: ไม่มีทั้งคู่ → ข้อความ fallback มาตรฐาน", () => {
    assert.match(shippingInfoHTML({}), /จัดส่งตามที่อยู่ออกใบกำกับภาษี/);
  });
});

describe("customerResponseText()", () => {
  test("accepted → ข้อความตอบรับ", () => {
    assert.equal(customerResponseText("accepted"), "คุณตอบรับใบเสนอราคานี้แล้ว");
  });
  test("changes_requested → ข้อความขอแก้ไข", () => {
    assert.equal(customerResponseText("changes_requested"), "คุณส่งคำขอแก้ไขใบเสนอราคานี้แล้ว");
  });
  test("action ไม่รู้จัก/ไม่มีค่า → สตริงว่าง ไม่ throw", () => {
    assert.equal(customerResponseText("weird"), "");
    assert.equal(customerResponseText(undefined), "");
  });
});

// ── DOM wiring smoke test (token ถูก/ผิด → state ที่ถูกต้อง) ──────────────────────────
const QV_HTML = `
  <div class="qv-skel" id="qv-skeleton"></div>
  <div class="qv-state" id="qv-not-found" style="display:none;"></div>
  <div id="qv-root" style="display:none;">
    <button type="button" id="qv-print-btn"></button>
    <div id="qv-quote-no"></div>
    <div id="qv-quote-date"></div>
    <span id="qv-status-badge" data-status="draft"></span>
    <div id="qv-customer-info"></div>
    <div id="qv-shipping-info"></div>
    <table><tbody id="qv-items-body"></tbody></table>
    <div id="qv-totals"></div>
    <div id="qv-payment-terms"></div>
    <div id="qv-valid-until"></div>
    <div id="qv-notes-wrap" style="display:none;"><div id="qv-notes"></div></div>
    <div id="qv-response-form">
      <div id="qv-response-actions-row">
        <button type="button" id="qv-accept-btn"></button>
        <button type="button" id="qv-request-changes-btn"></button>
      </div>
      <div id="qv-changes-panel" style="display:none;">
        <textarea id="qv-changes-comment"></textarea>
        <button type="button" id="qv-changes-submit-btn"></button>
        <button type="button" id="qv-changes-cancel-btn"></button>
      </div>
      <div id="qv-response-error" style="display:none;"></div>
    </div>
    <div id="qv-response-done" style="display:none;">
      <div id="qv-response-done-text"></div>
      <div id="qv-response-done-meta"></div>
      <div id="qv-response-done-comment" style="display:none;"></div>
    </div>
  </div>
`;

async function loadQuotationView(url) {
  const dom = new JSDOM(`<!doctype html><html><body>${QV_HTML}</body></html>`, { url });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  await import(`../js/quotation-view.js?t=${Date.now()}-${Math.random()}`);
  return dom;
}

function nextTick() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe("quotation-view.js — DOM wiring", () => {
  test("ไม่มี token ใน query param เลย → แสดง not-found ทันที ไม่เรียก Firestore", async () => {
    globalThis.__GET_DOC_STUB__ = () => { throw new Error("ไม่ควรถูกเรียกเลยถ้าไม่มี token"); };
    const dom = await loadQuotationView("https://example.test/quotation-view.html");
    await nextTick();
    assert.equal(dom.window.document.getElementById("qv-not-found").style.display, "");
    assert.equal(dom.window.document.getElementById("qv-root").style.display, "none");
  });

  test("token ไม่พบเอกสาร (getDoc exists:false) → แสดง not-found", async () => {
    globalThis.__GET_DOC_STUB__ = () => ({ exists: false });
    const dom = await loadQuotationView("https://example.test/quotation-view.html?token=bad-token");
    await nextTick();
    await nextTick();
    assert.equal(dom.window.document.getElementById("qv-not-found").style.display, "");
  });

  test("token ถูกต้อง → แสดงข้อมูลจริงในหน้า root", async () => {
    globalThis.__GET_DOC_STUB__ = () => ({
      exists: true,
      data: {
        quoteNo: "QT2026-0007", status: "sent", billingName: "บริษัท เอบีซี จำกัด",
        items: [{ name: "ป้ายไฟ LED", qty: 1, unit: "ชิ้น", unitPrice: 1000, discount: 0, lineTotal: 1000 }],
        vatMode: "excluded", subtotal: 1000, vatAmount: 70, grandTotal: 1070,
        paymentTerms: "เงินสด", validUntil: "", notes: ""
      }
    });
    const dom = await loadQuotationView("https://example.test/quotation-view.html?token=good-token");
    await nextTick();
    await nextTick();
    assert.equal(dom.window.document.getElementById("qv-root").style.display, "");
    assert.equal(dom.window.document.getElementById("qv-not-found").style.display, "none");
    assert.match(dom.window.document.getElementById("qv-quote-no").textContent, /QT2026-0007/);
    assert.equal(dom.window.document.getElementById("qv-status-badge").dataset.status, "sent");
  });

  test("token ถูกต้อง + มี notes → แสดงบล็อกหมายเหตุ", async () => {
    globalThis.__GET_DOC_STUB__ = () => ({
      exists: true,
      data: { quoteNo: "QT2026-0008", status: "draft", items: [], vatMode: "none", subtotal: 0, vatAmount: 0, grandTotal: 0, notes: "กรุณาโทรยืนยันก่อนผลิต" }
    });
    const dom = await loadQuotationView("https://example.test/quotation-view.html?token=note-token");
    await nextTick();
    await nextTick();
    assert.equal(dom.window.document.getElementById("qv-notes-wrap").style.display, "");
    assert.match(dom.window.document.getElementById("qv-notes").textContent, /กรุณาโทรยืนยันก่อนผลิต/);
  });

  test("กดปุ่มพิมพ์ → เรียก window.print()", async () => {
    globalThis.__GET_DOC_STUB__ = () => ({ exists: false });
    const dom = await loadQuotationView("https://example.test/quotation-view.html");
    let printCalled = false;
    dom.window.print = () => { printCalled = true; };
    const btn = dom.window.document.getElementById("qv-print-btn");
    btn.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    assert.equal(printCalled, true);
  });
});

// ── ปุ่ม "ยอมรับ"/"ขอแก้ไข" (P3.0 Phase 4 รอบ 5) — mock submitQuotationResponse() ที่
// boundary Firestore เดียวกับ getQuotationByToken() (globalThis.__GET_DOC_STUB__ ใช้ทั้งคู่
// อยู่แล้ว) ผ่าน __UPDATE_DOC_CALLS__/__SET_DOC_CALLS__ เหมือน test/db-quotations.test.mjs —
// ไฟล์นี้เรียก submitQuotationResponse() ตัวจริง ไม่ได้ mock module import แยก
describe("quotation-view.js — ปุ่มตอบรับ/ขอแก้ไข", () => {
  const QUOTATION_DATA = {
    quotationId: "q1", quoteNo: "QT2026-0009", status: "sent",
    billingName: "บริษัท เอบีซี จำกัด",
    items: [{ name: "ป้ายไฟ LED", qty: 1, unit: "ชิ้น", unitPrice: 1000, discount: 0, lineTotal: 1000 }],
    vatMode: "excluded", subtotal: 1000, vatAmount: 70, grandTotal: 1070,
    paymentTerms: "เงินสด", validUntil: "", notes: ""
  };

  function stubForToken() {
    // getQuotationByToken() (via getQuotationByToken → publicToken doc) และ submitQuotationResponse()
    // ทั้งคู่อ่านจาก quotation_public/{token} ผ่าน getDoc — คืนค่าเดียวกันได้เลย (ไม่มี
    // customerResponse ตั้งต้น เพื่อให้ปุ่มโชว์)
    globalThis.__GET_DOC_STUB__ = () => ({ exists: true, data: { ...QUOTATION_DATA } });
    globalThis.__UPDATE_DOC_CALLS__ = [];
    globalThis.__SET_DOC_CALLS__ = [];
  }

  test("กดปุ่ม 'ยอมรับ' → เรียก submitQuotationResponse(token, 'accepted', '') สำเร็จ → โชว์ badge แทนปุ่ม", async () => {
    stubForToken();
    const dom = await loadQuotationView("https://example.test/quotation-view.html?token=tok-accept");
    await nextTick(); await nextTick();

    const acceptBtn = dom.window.document.getElementById("qv-accept-btn");
    acceptBtn.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    await nextTick(); await nextTick(); await nextTick();

    assert.equal(globalThis.__UPDATE_DOC_CALLS__.length, 1);
    assert.equal(globalThis.__UPDATE_DOC_CALLS__[0].payload.status, "accepted");
    assert.equal(dom.window.document.getElementById("qv-response-form").style.display, "none");
    assert.equal(dom.window.document.getElementById("qv-response-done").style.display, "");
    assert.match(dom.window.document.getElementById("qv-response-done-text").textContent, /ตอบรับใบเสนอราคานี้แล้ว/);
  });

  test("กดปุ่ม 'ขอแก้ไข' พร้อมกรอก comment → เรียกด้วย action/comment ถูกต้อง", async () => {
    stubForToken();
    const dom = await loadQuotationView("https://example.test/quotation-view.html?token=tok-changes");
    await nextTick(); await nextTick();

    dom.window.document.getElementById("qv-request-changes-btn")
      .dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    assert.equal(dom.window.document.getElementById("qv-changes-panel").style.display, "");

    dom.window.document.getElementById("qv-changes-comment").value = "ขอเปลี่ยนสีเป็นน้ำเงิน";
    dom.window.document.getElementById("qv-changes-submit-btn")
      .dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    await nextTick(); await nextTick(); await nextTick();

    assert.equal(globalThis.__UPDATE_DOC_CALLS__.length, 1);
    assert.equal(globalThis.__UPDATE_DOC_CALLS__[0].payload.status, "changes_requested");
    assert.equal(globalThis.__UPDATE_DOC_CALLS__[0].payload.customerResponse.comment, "ขอเปลี่ยนสีเป็นน้ำเงิน");
    assert.match(dom.window.document.getElementById("qv-response-done-text").textContent, /ขอแก้ไขใบเสนอราคานี้แล้ว/);
  });

  test("กดปุ่ม 'ขอแก้ไข' โดยไม่กรอก comment → ไม่เรียก submitQuotationResponse() และแสดง error", async () => {
    stubForToken();
    const dom = await loadQuotationView("https://example.test/quotation-view.html?token=tok-empty");
    await nextTick(); await nextTick();

    dom.window.document.getElementById("qv-request-changes-btn")
      .dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    dom.window.document.getElementById("qv-changes-submit-btn")
      .dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    await nextTick();

    assert.equal(globalThis.__UPDATE_DOC_CALLS__.length, 0);
    assert.equal(dom.window.document.getElementById("qv-response-error").style.display, "");
  });

  test("เอกสารที่โหลดมามี customerResponse อยู่แล้ว → ปุ่มไม่แสดง โชว์ badge สถานะที่ตอบไปแทน", async () => {
    globalThis.__GET_DOC_STUB__ = () => ({
      exists: true,
      data: {
        ...QUOTATION_DATA, status: "accepted",
        customerResponse: { action: "accepted", comment: "", respondedAt: { toMillis: () => Date.now() } }
      }
    });
    const dom = await loadQuotationView("https://example.test/quotation-view.html?token=tok-already");
    await nextTick(); await nextTick();

    assert.equal(dom.window.document.getElementById("qv-response-form").style.display, "none");
    assert.equal(dom.window.document.getElementById("qv-response-done").style.display, "");
  });

  test("submit ล้มเหลว (getDoc ใน submitQuotationResponse โยน error ผ่าน exists:false) → แสดง error ไม่ throw", async () => {
    let callCount = 0;
    globalThis.__GET_DOC_STUB__ = () => {
      callCount += 1;
      // ครั้งแรก (getQuotationByToken ตอนโหลดหน้า) สำเร็จ, ครั้งที่ 2 (submitQuotationResponse)
      // จำลอง token ถูกลบไปแล้วระหว่างนั้น (exists:false) → throw
      if (callCount === 1) return { exists: true, data: { ...QUOTATION_DATA } };
      return { exists: false };
    };
    globalThis.__UPDATE_DOC_CALLS__ = [];
    globalThis.__SET_DOC_CALLS__ = [];
    const dom = await loadQuotationView("https://example.test/quotation-view.html?token=tok-fail");
    await nextTick(); await nextTick();

    dom.window.document.getElementById("qv-accept-btn")
      .dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    await nextTick(); await nextTick(); await nextTick();

    assert.equal(globalThis.__UPDATE_DOC_CALLS__.length, 0);
    assert.equal(dom.window.document.getElementById("qv-response-error").style.display, "");
    // ปุ่มยังอยู่ (ไม่ได้สลับไปโชว์ badge) เพราะ submit ล้มเหลว
    assert.equal(dom.window.document.getElementById("qv-response-form").style.display, "");
  });
});
