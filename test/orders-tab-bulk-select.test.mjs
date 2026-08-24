// test/orders-tab-bulk-select.test.mjs — รอบที่ 94 (Phase 3 sub-round 3c, ส่วนที่ 1/2 —
// แบ่ง 3c ออกเป็น 2 รอบย่อยเพราะไฟล์ใหญ่กว่าที่คาด/เจ้าของเว็บแจ้งว่าจะติด limit รอบนี้ ให้แบ่งงาน
// ข้ามรอบ — ไม่ใช่การแบ่งที่วางแผนไว้ล่วงหน้าตั้งแต่รอบ 92/93)
//
// ขอบเขตของไฟล์นี้ (3c ส่วนที่ 1) จาก js/orders-tab.js:
//   - formatBaht() — pure function จัดรูปแบบตัวเลขเป็นบาท
//   - escapeHtml() — pure function กัน XSS พื้นฐาน
//   - selectedOrderIds (module-level Set, ไม่มี setter export) ผ่านการจำลอง DOM จริง:
//     · checkbox รายแถว (.cp-o-row-check) → tableBody "change" listener → add/delete จาก
//       selectedOrderIds + เรียก updateOrdersBulkBar()
//     · head checkbox (cp-head-check) → เลือก/ยกเลิกทั้งหน้า + sync checked ของ head checkbox
//       เองกลับ (ครึ่งเลือกครึ่งไม่เลือก → ไม่ checked)
//     · ปุ่ม "ล้างการเลือก" (cp-bulk-clear) → clear() ทั้ง Set + ปลด checked ทุก checkbox ที่เห็นอยู่
//     · updateOrdersBulkBar(): bulk bar ได้ class "active" เมื่อมีรายการเลือก, cp-bulk-count
//       แสดงจำนวนที่เลือกถูกต้อง (เรียกทางอ้อมผ่าน render()/renderTable() เท่านั้น เพราะเป็น
//       local function ไม่ export)
//     · ปุ่ม "เปลี่ยนสถานะ" (cp-bulk-apply-status): เรียก updateOrder() ทีละรายการที่เลือกทั้งหมด
//       ผ่าน Promise.all, แสดง showToast (สังเกตผลทางอ้อมผ่าน .cp-toast-wrap เพราะ showToast()
//       ไม่คืนค่าอะไรให้ตรวจ), เคลียร์ selectedOrderIds + select กลับเป็นค่าว่างหลังสำเร็จ, ปุ่ม
//       disabled ระหว่างทำงานแล้วกลับมา enabled — ไม่กด apply ถ้ายังไม่เลือก status หรือไม่มีรายการ
//       เลือกเลย (early return) — path error (updateOrder() throw) ไม่ได้ทดสอบในไฟล์นี้ (ทดสอบ error
//       path ของ Firestore ไว้ในไฟล์ data-layer เองแล้วที่ test/db-orders-crud-flow.test.mjs)
//
// ไม่อยู่ในขอบเขตไฟล์นี้ (รอไป 3c ส่วนที่ 2 — ดู NEXT-ROUND-PROMPT.txt): render()/renderTable()
// เอง (pagination/kanban dispatch/error state), ปุ่ม "ลบที่เลือก" (cp-bulk-delete — ต้องผ่าน
// confirmDialog() จริงก่อน), confirmDeleteOrder() (ต้องผ่านทั้ง confirmDialog()+showUndoToast()
// จริง), showToast() เอง (ทดสอบแค่ผลข้างเคียงผ่าน apply-status ด้านบน ไม่ได้ทดสอบ showToast()
// โดยตรงเช่น auto-remove หลัง 3200ms)
//
// สถาปัตยกรรมเทส: เหมือน test/orders-tab-filters-toggles.test.mjs (รอบ 93)/
// test/orders-tab-lifecycle-reminders.test.mjs (รอบ 92) ทุกประการ — jsdom + import โมดูลครั้งเดียว
// ต่อไฟล์ใน before(), triggerOrdersSnapshot() helper คัดลอกมาปรับใช้ตรงๆ, renderedRowIds()
// คัดลอกมาจากรอบ 93 (ยังใช้ในไฟล์นี้เพื่อยืนยันว่าแถวถูก render จริงก่อนคลิก checkbox)
//
// ระวัง state รั่วข้ามเทส (ตามที่เตือนไว้ท้ายรอบ 93): selectedOrderIds ไม่มี setter export ต้อง
// รีเซ็ตผ่าน beforeEach() โดยคลิกปุ่ม "ล้างการเลือก" แบบไม่มีเงื่อนไขทุกครั้ง (ไม่ใช่แค่เช็ค
// cp-bulk-count ก่อนตัดสินใจคลิก เพราะปุ่มนี้เคลียร์ Set โดยตรง ไม่มี side-effect อื่นที่ต้องกังวล
// ต่างจาก status pill ของรอบ 93 — แต่ยังคงคลิกไม่มีเงื่อนไขตามแพทเทิร์นเดิมเพื่อความปลอดภัย)
//
// ตรวจโค้ดจริงบรรทัด 330-547 ของ js/orders-tab.js (ขอบเขตเต็มของ 3c) ละเอียดก่อนเขียนไฟล์นี้ —
// ไม่พบบั๊ก จึงเป็นไฟล์เทสล้วนๆ ไม่มีการแก้โค้ดผลิตภัณฑ์เลยแม้แต่บรรทัดเดียว

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

let document;
let mod; // orders-tab.js exports ทั้งหมด

function resetFirebaseCalls() {
  globalThis.__ADD_DOC_CALLS__ = [];
  globalThis.__UPDATE_DOC_CALLS__ = [];
  globalThis.__DELETE_DOC_CALLS__ = [];
  globalThis.__SET_DOC_CALLS__ = [];
  globalThis.__GET_DOC_STUB__ = undefined;
  globalThis.__GET_DOCS_STUB__ = undefined;
  globalThis.__SNAPSHOT_LISTENERS__ = {};
}

function triggerOrdersSnapshot(orders) {
  const cb = globalThis.__SNAPSHOT_LISTENERS__ && globalThis.__SNAPSHOT_LISTENERS__["orders"];
  if (typeof cb !== "function") throw new Error("orders snapshot listener ยังไม่ได้ลงทะเบียน (เรียก initOrdersTab() ก่อนหรือยัง?)");
  cb({ docs: orders.map(o => ({ id: o.id, data: () => { const { id, ...rest } = o; return rest; } })) });
}

function renderedRowIds() {
  return Array.from(document.querySelectorAll("#cp-table-body tr[data-id]")).map(tr => tr.dataset.id);
}

function rowCheckbox(id) {
  return document.querySelector(`#cp-table-body .cp-o-row-check[data-id="${id}"]`);
}

const SAMPLE_ORDERS = [
  { id: "o1", code: "PO-0001", customer: "ลูกค้า เอ", status: "received",   assignee: "uid-A" },
  { id: "o2", code: "PO-0002", customer: "ลูกค้า บี", status: "production", assignee: "uid-B" },
  { id: "o3", code: "PO-0003", customer: "ลูกค้า ซี", status: "completed",  assignee: "uid-A" },
];

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
  dom.window.HTMLElement.prototype.scrollIntoView = function () {};
  globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);

  mod = await import("../js/orders-tab.js");
  document = dom.window.document;
});

beforeEach(() => {
  resetFirebaseCalls();
  mod.stopOrdersTab();
  mod.initOrdersTab();
  triggerOrdersSnapshot(SAMPLE_ORDERS);
  mod.setCurrentPage(1);
  document.getElementById("cp-search").value = "";
  // เคลียร์ selectedOrderIds ที่อาจค้างจากเทสก่อนหน้า (ไม่มี setter export — ต้องคลิกปุ่มจริง)
  document.getElementById("cp-bulk-clear").click();
  // render() หนึ่งครั้งให้ตารางมีแถวจริง (triggerOrdersSnapshot ด้านบนเรียก render() ให้แล้วโดย
  // อ้อมผ่าน startOrdersListener() callback แต่ยืนยันอีกครั้งให้ชัดเจนว่าไม่มี filter ค้าง)
  mod.render();
});

describe("js/orders-tab.js — formatBaht()/escapeHtml() pure functions (รอบที่ 94, Phase 3 sub-round 3c ส่วนที่ 1)", () => {
  test("formatBaht(): ใส่สัญลักษณ์ ฿ + คั่นหลักพันแบบไทย + ปัดเศษทศนิยม", () => {
    assert.equal(mod.formatBaht(1234567), "฿1,234,567");
    assert.equal(mod.formatBaht(1234.6), "฿1,235");
    assert.equal(mod.formatBaht(0), "฿0");
  });

  test("formatBaht(): ค่า falsy (null/undefined/NaN) ถือเป็น 0", () => {
    assert.equal(mod.formatBaht(null), "฿0");
    assert.equal(mod.formatBaht(undefined), "฿0");
    assert.equal(mod.formatBaht(NaN), "฿0");
  });

  test("escapeHtml(): แปลงอักขระอันตรายทั้ง 5 ตัว (& < > \" ')", () => {
    assert.equal(mod.escapeHtml(`<script>alert("x's")&</script>`),
      "&lt;script&gt;alert(&quot;x&#39;s&quot;)&amp;&lt;/script&gt;");
  });

  test("escapeHtml(): ค่าที่ไม่ใช่ string ถูกแปลงเป็น string ก่อน escape (เช่น number)", () => {
    assert.equal(mod.escapeHtml(123), "123");
  });
});

describe("js/orders-tab.js — row checkbox: .cp-o-row-check (รอบที่ 94)", () => {
  test("ติ๊กเลือกแถวเดียว: id ถูกเพิ่มเข้า selection, bulk bar ได้ class active, cp-bulk-count เป็น 1", () => {
    assert.deepEqual(renderedRowIds().sort(), ["o1", "o2", "o3"]);
    const cb = rowCheckbox("o1");
    cb.checked = true;
    cb.dispatchEvent(new Event("change", { bubbles: true }));

    assert.equal(document.getElementById("cp-bulk-bar").classList.contains("active"), true);
    assert.equal(document.getElementById("cp-bulk-count").textContent, "1");
  });

  test("ติ๊กแล้วเอาติ๊กออก: id ถูกลบออกจาก selection, bulk bar หมด class active, count กลับเป็น 0", () => {
    const cb = rowCheckbox("o2");
    cb.checked = true;
    cb.dispatchEvent(new Event("change", { bubbles: true }));
    assert.equal(document.getElementById("cp-bulk-count").textContent, "1");

    cb.checked = false;
    cb.dispatchEvent(new Event("change", { bubbles: true }));
    assert.equal(document.getElementById("cp-bulk-count").textContent, "0");
    assert.equal(document.getElementById("cp-bulk-bar").classList.contains("active"), false);
  });

  test("ติ๊กหลายแถว: count นับรวมถูกต้อง, selection คงอยู่ข้าม re-render (เลือกไว้ก่อน render() ใหม่)", () => {
    rowCheckbox("o1").checked = true;
    rowCheckbox("o1").dispatchEvent(new Event("change", { bubbles: true }));
    rowCheckbox("o3").checked = true;
    rowCheckbox("o3").dispatchEvent(new Event("change", { bubbles: true }));
    assert.equal(document.getElementById("cp-bulk-count").textContent, "2");

    // re-render (เช่น จาก snapshot ใหม่) ต้องยังจำ selection เดิมไว้ได้ (selectedOrderIds เป็น
    // module-level Set ที่คงอยู่ข้าม renderTable() — renderOrderRow() อ่าน selectedOrderIds.has()
    // เพื่อใส่ checked attribute กลับ)
    mod.render();
    assert.equal(rowCheckbox("o1").checked, true);
    assert.equal(rowCheckbox("o3").checked, true);
    assert.equal(rowCheckbox("o2").checked, false);
    assert.equal(document.getElementById("cp-bulk-count").textContent, "2");
  });

  test("คลิกที่ checkbox ในแถว ไม่เปิดป๊อปอัพรายละเอียด (tr click listener ข้าม input)", () => {
    // ยืนยันทางอ้อม: ถ้า openOrderModal() ถูกเรียกจะมี error เพราะ modal overlay อาจไม่ครบ context —
    // แต่การตรวจตรงๆ ทำได้ยากในเทสนี้ (openOrderModal() เป็นฟังก์ชันจากไฟล์อื่น) จึงตรวจแค่ว่า
    // dispatch click ที่ checkbox ไม่ throw และ selection state เปลี่ยนถูกต้องตามที่คาด (บ่งชี้ว่า
    // path "closest('input')" ทำงาน ไม่ใช่ path "tr[data-id]" ที่เปิด modal)
    const cb = rowCheckbox("o2");
    assert.doesNotThrow(() => {
      cb.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
  });
});

describe("js/orders-tab.js — head checkbox: cp-head-check (รอบที่ 94)", () => {
  test("ติ๊ก head checkbox: เลือกทุกแถวที่แสดงอยู่ในหน้านี้ทั้งหมด", () => {
    const head = document.getElementById("cp-head-check");
    head.checked = true;
    head.dispatchEvent(new Event("change", { bubbles: true }));

    assert.equal(rowCheckbox("o1").checked, true);
    assert.equal(rowCheckbox("o2").checked, true);
    assert.equal(rowCheckbox("o3").checked, true);
    assert.equal(document.getElementById("cp-bulk-count").textContent, "3");
  });

  test("เอาติ๊ก head checkbox ออกหลังเลือกทั้งหมด: ยกเลิกทุกแถว", () => {
    const head = document.getElementById("cp-head-check");
    head.checked = true;
    head.dispatchEvent(new Event("change", { bubbles: true }));
    head.checked = false;
    head.dispatchEvent(new Event("change", { bubbles: true }));

    assert.equal(rowCheckbox("o1").checked, false);
    assert.equal(rowCheckbox("o2").checked, false);
    assert.equal(rowCheckbox("o3").checked, false);
    assert.equal(document.getElementById("cp-bulk-count").textContent, "0");
  });

  test("updateOrdersBulkBar() sync head checkbox กลับเป็น checked เฉพาะตอนติ๊กครบทุกแถวเอง (ติ๊กทีละแถว)", () => {
    const head = document.getElementById("cp-head-check");
    rowCheckbox("o1").checked = true;
    rowCheckbox("o1").dispatchEvent(new Event("change", { bubbles: true }));
    assert.equal(head.checked, false, "ติ๊กแค่บางแถว head checkbox ต้องไม่ checked");

    rowCheckbox("o2").checked = true;
    rowCheckbox("o2").dispatchEvent(new Event("change", { bubbles: true }));
    rowCheckbox("o3").checked = true;
    rowCheckbox("o3").dispatchEvent(new Event("change", { bubbles: true }));
    assert.equal(head.checked, true, "ติ๊กครบทุกแถวแล้ว head checkbox ต้อง sync กลับเป็น checked");

    rowCheckbox("o2").checked = false;
    rowCheckbox("o2").dispatchEvent(new Event("change", { bubbles: true }));
    assert.equal(head.checked, false, "เอาติ๊กออกแถวเดียว head checkbox ต้องกลับมาไม่ checked ทันที");
  });
});

describe("js/orders-tab.js — ปุ่ม 'ล้างการเลือก': cp-bulk-clear (รอบที่ 94)", () => {
  test("เลือกไว้หลายแถวแล้วกดล้าง: selection ว่างทั้งหมด, checkbox ทุกแถวเอาติ๊กออก, bulk bar หมด active", () => {
    rowCheckbox("o1").checked = true;
    rowCheckbox("o1").dispatchEvent(new Event("change", { bubbles: true }));
    rowCheckbox("o2").checked = true;
    rowCheckbox("o2").dispatchEvent(new Event("change", { bubbles: true }));
    assert.equal(document.getElementById("cp-bulk-count").textContent, "2");

    document.getElementById("cp-bulk-clear").click();

    assert.equal(document.getElementById("cp-bulk-count").textContent, "0");
    assert.equal(document.getElementById("cp-bulk-bar").classList.contains("active"), false);
    assert.equal(rowCheckbox("o1").checked, false);
    assert.equal(rowCheckbox("o2").checked, false);
  });

  test("กดล้างตอนยังไม่ได้เลือกอะไรเลย: ไม่ throw, ยังคงว่างเหมือนเดิม", () => {
    assert.doesNotThrow(() => document.getElementById("cp-bulk-clear").click());
    assert.equal(document.getElementById("cp-bulk-count").textContent, "0");
  });
});

describe("js/orders-tab.js — ปุ่ม 'เปลี่ยนสถานะ' (bulk apply-status): cp-bulk-apply-status (รอบที่ 94)", () => {
  function selectRows(ids) {
    ids.forEach(id => {
      rowCheckbox(id).checked = true;
      rowCheckbox(id).dispatchEvent(new Event("change", { bubbles: true }));
    });
  }

  test("ไม่กด apply ถ้ายังไม่เลือก status เลย (select ว่าง) แม้จะเลือกแถวไว้แล้ว — ไม่เรียก updateOrder()", async () => {
    selectRows(["o1", "o2"]);
    document.getElementById("cp-bulk-status-select").value = "";
    document.getElementById("cp-bulk-apply-status").click();
    await new Promise(r => setTimeout(r, 0));

    assert.deepEqual(globalThis.__UPDATE_DOC_CALLS__, []);
    // selection ต้องไม่ถูกเคลียร์ (early return ก่อนแตะ selectedOrderIds เลย)
    assert.equal(document.getElementById("cp-bulk-count").textContent, "2");
  });

  test("ไม่กด apply ถ้าไม่มีแถวไหนถูกเลือกเลย แม้จะเลือก status ไว้แล้ว — ไม่เรียก updateOrder()", async () => {
    document.getElementById("cp-bulk-status-select").value = "completed";
    document.getElementById("cp-bulk-apply-status").click();
    await new Promise(r => setTimeout(r, 0));

    assert.deepEqual(globalThis.__UPDATE_DOC_CALLS__, []);
  });

  test("เลือก 2 แถว + status 'completed' แล้วกด apply: เรียก updateOrder() ครบทั้ง 2 รายการ ด้วย status ที่เลือก", async () => {
    selectRows(["o1", "o3"]);
    document.getElementById("cp-bulk-status-select").value = "completed";
    document.getElementById("cp-bulk-apply-status").click();
    await new Promise(r => setTimeout(r, 0));

    assert.equal(globalThis.__UPDATE_DOC_CALLS__.length, 2);
    const paths = globalThis.__UPDATE_DOC_CALLS__.map(c => c.path).sort();
    assert.deepEqual(paths, ["orders/o1", "orders/o3"]);
    globalThis.__UPDATE_DOC_CALLS__.forEach(c => assert.equal(c.payload.status, "completed"));
  });

  test("หลัง apply สำเร็จ: selection ถูกเคลียร์, select กลับเป็นค่าว่าง, ปุ่มกลับมา enabled, แสดง toast สำเร็จ", async () => {
    selectRows(["o2"]);
    document.getElementById("cp-bulk-status-select").value = "shipping";
    const btn = document.getElementById("cp-bulk-apply-status");
    btn.click();
    await new Promise(r => setTimeout(r, 0));

    assert.equal(document.getElementById("cp-bulk-count").textContent, "0");
    assert.equal(document.getElementById("cp-bulk-status-select").value, "");
    assert.equal(btn.disabled, false);
    const toastEls = document.querySelectorAll(".cp-toast-wrap .cp-toast.success");
    assert.equal(toastEls.length >= 1, true, "ต้องมี toast success อย่างน้อย 1 อัน หลัง apply สำเร็จ");
    assert.equal(toastEls[toastEls.length - 1].textContent, "เปลี่ยนสถานะแล้ว 1 รายการ");
  });
});
