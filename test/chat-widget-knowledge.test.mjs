// test/chat-widget-knowledge.test.mjs — เทส js/chat-widget-knowledge.js
//
// ขอบเขต: js/chat-widget-knowledge.js (135 บรรทัด) — สร้าง "ข้อมูลปัจจุบันจากเว็บไซต์" (system
// prompt knowledge block) ป้อนให้ AI chat widget จาก Firestore จริง (settings/products/
// categories/faqs/portfolios) — อ่านโค้ดจริงทั้งไฟล์ก่อนเขียนเทสแล้ว
//
// ไฟล์นี้ต่างจากไฟล์ตระกูล home-dynamic-*/nav-menu.js ที่เคยเทสมาก่อนตรงที่ **ไม่มี DOM/side
// effect ใดๆ เลย** — export แค่ 2 ตัว: `SYSTEM_RULES` (string คงที่ ไม่ต้องเทส) และ
// `buildKnowledgeBlock()` (async function คืน Promise<string> ล้วนๆ ไม่แตะ document/window เลย
// สักบรรทัด) จึงไม่ต้องตั้ง JSDOM/global window เหมือนไฟล์อื่น เรียก `await mod.buildKnowledgeBlock()`
// ตรงๆ ได้เลย
//
// Data source 5 ตัวที่ต้อง stub ให้ครบ (Promise.all ยิงพร้อมกันหมด แต่ละตัวมี .catch() คลุมของ
// ตัวเองอยู่แล้วในโค้ดจริง — reject ตัวไหนไม่กระทบตัวอื่น):
//   - getSettings() (js/db-settings.js) → getDoc() เอกฐาน → __GET_DOC_STUB__ ที่ ref.path === "settings/main"
//   - getProducts() (js/db-products.js) → getDocs() พหูพจน์ → __GET_DOCS_STUB__ ที่ ref.path === "products"
//   - getCategories() (js/db-taxonomy.js) → __GET_DOCS_STUB__ ที่ ref.path === "categories"
//   - getFaqs() (js/db-content.js) → __GET_DOCS_STUB__ ที่ ref.path === "faqs"
//   - getPortfolios() (js/db-content.js) → __GET_DOCS_STUB__ ที่ ref.path === "portfolios"
//
// ใช้แพทเทิร์น import ด้วย query string คนละอันทุกเทส (`../js/chat-widget-knowledge.js?t=N`)
// ตามธรรมเนียมเดิม แม้ไฟล์นี้ไม่มี module-level state ที่ต้องรีเซ็ต (บันทึกไว้ในคอมเมนต์หัวไฟล์เองว่า
// buildKnowledgeBlock() คืนค่าใหม่ทุกครั้งไม่แชร์ตัวแปรข้ามการเรียก) — เพื่อความสม่ำเสมอกับไฟล์เทส
// อื่นในโปรเจกต์ และกันกรณีในอนาคตที่ไฟล์อาจถูกแก้ให้มี module-level cache

import { test, describe } from "node:test";
import assert from "node:assert/strict";

let importCounter = 0;
async function loadModule() {
  importCounter += 1;
  return import(`../js/chat-widget-knowledge.js?t=${importCounter}`);
}

function stubAll({ settings, products, categories, faqs, portfolios } = {}) {
  globalThis.__GET_DOC_STUB__ = (ref) => {
    if (ref && ref.path === "settings/main") {
      return settings === undefined ? { exists: false } : { exists: true, data: settings };
    }
    return { exists: false };
  };
  globalThis.__GET_DOCS_STUB__ = (ref) => {
    if (ref && ref.path === "products") return products === undefined ? [] : products;
    if (ref && ref.path === "categories") return categories === undefined ? [] : categories;
    if (ref && ref.path === "faqs") return faqs === undefined ? [] : faqs;
    if (ref && ref.path === "portfolios") return portfolios === undefined ? [] : portfolios;
    return [];
  };
}

function stubAllThrow(err) {
  globalThis.__GET_DOC_STUB__ = () => { throw err; };
  globalThis.__GET_DOCS_STUB__ = () => { throw err; };
}

function asDoc(id, data) {
  return { id, data };
}

describe("js/chat-widget-knowledge.js — SYSTEM_RULES", () => {
  test("เป็น string คงที่ มีคำว่า CS.SIGN และกฎห้ามแต่งข้อมูล", async () => {
    stubAll();
    const mod = await loadModule();
    assert.equal(typeof mod.SYSTEM_RULES, "string");
    assert.match(mod.SYSTEM_RULES, /CS\.SIGN/);
    assert.match(mod.SYSTEM_RULES, /ห้ามแต่งข้อมูล/);
  });
});

// หมายเหตุสำคัญ (ตรวจจากโค้ดจริงหลังรันเทสจริงแล้วพบว่าสมมติฐานแรกผิด — ไม่ใช่การเดา): ส่วน
// "ข้อมูลติดต่อบริษัท" ถูก parts.push() แบบไม่มีเงื่อนไขเสมอ (var s = settings || {} กันไว้แล้ว)
// ทำให้ `parts` "ไม่มีทางว่างเปล่า" เลยไม่ว่า settings/products/categories/faqs/portfolios จะเป็น
// อะไรก็ตาม — เงื่อนไข `parts.length ? parts.join(...) : STATIC_FALLBACK_KNOWLEDGE` ใน .then() จึง
// **ไปไม่ถึงฝั่ง STATIC_FALLBACK_KNOWLEDGE ได้เลยในทางปฏิบัติ** ผ่านเส้นทางนี้ — ทางเดียวที่จะเห็น
// STATIC_FALLBACK_KNOWLEDGE จริงคือ .catch() นอกสุดของทั้ง buildKnowledgeBlock() ซึ่งต้องมี throw
// แบบ synchronous เกิดขึ้น "ข้างใน" callback ของ .then() เอง (ไม่ใช่แค่ promise ใดๆ ใน
// Promise.all reject เฉยๆ — ทุกตัวมี .catch(() => null/[]) ห่อไว้ชั้นในอยู่แล้วจึง resolve
// เสมอไม่ reject) — เทส 2 ชุดด้านล่างสะท้อนพฤติกรรมจริงทั้งสองเส้นทางแยกกันชัดเจน
describe("js/chat-widget-knowledge.js — buildKnowledgeBlock(): ทุกแหล่งข้อมูลว่างเปล่า/ไม่มีเลย", () => {
  test("settings=null, products/categories/faqs/portfolios=[] ทั้งหมด → ยังคืนบล็อกข้อมูลติดต่อบริษัท (default ทุกฟิลด์) เสมอ ไม่ใช่ STATIC_FALLBACK_KNOWLEDGE เพราะ parts ไม่เคยว่างเปล่า", async () => {
    stubAll({ settings: undefined, products: [], categories: [], faqs: [], portfolios: [] });
    const mod = await loadModule();
    const block = await mod.buildKnowledgeBlock();
    assert.equal(typeof block, "string");
    assert.doesNotMatch(block, /ข้อมูลสำรอง/);
    assert.match(block, /ข้อมูลติดต่อบริษัท/);
    assert.match(block, /17 ซอยบางกระดี่ 1/);
    assert.doesNotMatch(block, /รายการสินค้าปัจจุบัน|คำถามที่พบบ่อย|ลูกค้า\/โครงการที่เคยทำ/);
  });
});

describe("js/chat-widget-knowledge.js — buildKnowledgeBlock(): ทุกแหล่งข้อมูล reject พร้อมกัน", () => {
  test("getSettings/getProducts/getCategories/getFaqs/getPortfolios ทั้งหมด throw → แต่ละตัวมี .catch() ของตัวเองอยู่แล้ว (คืน null/[]) จึงยังได้บล็อกข้อมูลติดต่อบริษัท default เหมือนกรณีว่างเปล่าทุกประการ ไม่ throw ต่อออกมาให้ buildKnowledgeBlock() reject", async () => {
    stubAllThrow(new Error("network down"));
    const mod = await loadModule();
    const block = await mod.buildKnowledgeBlock();
    assert.doesNotMatch(block, /ข้อมูลสำรอง/);
    assert.match(block, /ข้อมูลติดต่อบริษัท/);
    assert.match(block, /17 ซอยบางกระดี่ 1/);
  });
});

// **หมายเหตุ**: ลองบังคับให้ categories/products/faqs/portfolios stub คืนค่าที่ผิดรูป (เช่น string
// แทน array) เพื่อพยายามไล่ทดสอบเส้นทาง .catch() นอกสุด (STATIC_FALLBACK_KNOWLEDGE จริง) แล้วพบว่า
// "ไปไม่ถึงจริง" ในทางปฏิบัติ — ยืนยันด้วยการรันจริง ไม่ใช่การเดา: getDocs() (firebase-stub-loader.mjs)
// เรียก `list.map(...)` กับค่าที่ stub คืนมาก่อนเสมอ ถ้า stub คืนค่าที่ไม่มี .map (เช่น string) จะ throw
// "ข้างใน" getDocs() เอง กลายเป็น promise reject ซึ่งถูกดักจับไปแล้วโดย .catch(() => []) ของแต่ละแหล่ง
// ข้อมูลใน buildKnowledgeBlock() (เช่น getCategories().catch(...)) ก่อนจะถึง .then() รวมเสมอ — ผลลัพธ์
// สุดท้ายจึงยังเป็นค่า default ว่างเปล่า ไม่ใช่ STATIC_FALLBACK_KNOWLEDGE — เมื่อไล่โค้ดใน .then() ทีละ
// บรรทัด (categories.forEach/products.filter/faqs.map/portfolios.map/catNames lookup) ก็ไม่พบจุดไหน
// ที่จะ throw แบบ synchronous ได้เลยด้วยค่า resolved ที่มาจาก data-layer จริง (ทุกตัวการันตีเป็น array
// อยู่แล้วจาก .map()/catch(() => [])) — สรุปว่า `parts.length ? ... : STATIC_FALLBACK_KNOWLEDGE` และ
// `.catch(function () { return STATIC_FALLBACK_KNOWLEDGE; })` นอกสุดเป็น defensive code ที่ไม่มีทาง
// ถูกทริกเกอร์ได้จริงด้วยอินพุตใดๆ ผ่าน public API ของไฟล์นี้ (เหมือนเคส `if (!groups.length) return;`
// ใน js/nav-menu.js ที่บันทึกไว้แล้วในรอบ 143) — ไม่ใช่บั๊ก แค่ safety net เกินความจำเป็น จึงไม่มีเทส
// แยกสำหรับเคสนี้ (คุยกับตัวเองไว้ตรงนี้กันงงทีหลังว่าทำไมไม่มี)

describe("js/chat-widget-knowledge.js — buildKnowledgeBlock(): ข้อมูลติดต่อบริษัท (settings)", () => {
  test("settings มีครบทุกฟิลด์ (รวม phone2) → ใช้ค่าจริงทั้งหมด ไม่ใช่ default", async () => {
    stubAll({
      settings: {
        address: "99 ถนนทดสอบ", phone: "099-999-9999", phone2: "088-888-8888",
        fax: "02-999-9999", email: "test@example.com", lineUrl: "@testline",
        facebookUrl: "facebook.com/testpage"
      },
      products: [], categories: [], faqs: [], portfolios: []
    });
    const mod = await loadModule();
    const block = await mod.buildKnowledgeBlock();
    assert.match(block, /99 ถนนทดสอบ/);
    assert.match(block, /099-999-9999, 088-888-8888/);
    assert.match(block, /02-999-9999/);
    assert.match(block, /test@example\.com/);
    assert.match(block, /@testline/);
    assert.match(block, /facebook\.com\/testpage/);
    // ไม่มี STATIC_FALLBACK_KNOWLEDGE เพราะ parts ไม่ว่างเปล่า (มีอย่างน้อย contact info เสมอ)
    assert.doesNotMatch(block, /ข้อมูลสำรอง/);
  });

  test("settings เป็น {} (เอกสารว่างเปล่า) → ใช้ default ครบทุกฟิลด์ ไม่มี phone2 (ไม่มี ', ' ต่อท้ายเบอร์แรก)", async () => {
    stubAll({ settings: {}, products: [], categories: [], faqs: [], portfolios: [] });
    const mod = await loadModule();
    const block = await mod.buildKnowledgeBlock();
    assert.match(block, /17 ซอยบางกระดี่ 1 แขวงแสมดำ เขตบางขุนเทียน กรุงเทพฯ 10150/);
    assert.match(block, /062-883-3880/);
    assert.doesNotMatch(block, /062-883-3880,/);
    assert.match(block, /02-115-0850/);
    assert.match(block, /cssigngroup@gmail\.com/);
    assert.match(block, /@cssigngroup/);
    assert.match(block, /facebook\.com\/cssignonline/);
  });
});

describe("js/chat-widget-knowledge.js — buildKnowledgeBlock(): รายการสินค้า (products)", () => {
  test("มีเฉพาะสินค้า status active ที่แสดง — สินค้า inactive/draft ถูกกรองทิ้ง", async () => {
    stubAll({
      settings: {}, categories: [], faqs: [], portfolios: [],
      products: [
        asDoc("p1", { name: "กรวยจราจร A", price: 350, unit: "ชิ้น", status: "active" }),
        asDoc("p2", { name: "ป้ายซ่อนอยู่", price: 999, unit: "ชิ้น", status: "draft" }),
        asDoc("p3", { name: "ป้ายเก่าไม่ขายแล้ว", price: 500, unit: "ชิ้น", status: "inactive" })
      ]
    });
    const mod = await loadModule();
    const block = await mod.buildKnowledgeBlock();
    assert.match(block, /กรวยจราจร A/);
    assert.doesNotMatch(block, /ป้ายซ่อนอยู่/);
    assert.doesNotMatch(block, /ป้ายเก่าไม่ขายแล้ว/);
  });

  test("สินค้าที่ไม่มี field status เลย → ถือเป็น active (default) และแสดงในรายการ", async () => {
    stubAll({
      settings: {}, categories: [], faqs: [], portfolios: [],
      products: [asDoc("p1", { name: "สินค้าไม่มี status", price: 100, unit: "ชิ้น" })]
    });
    const mod = await loadModule();
    const block = await mod.buildKnowledgeBlock();
    assert.match(block, /สินค้าไม่มี status/);
  });

  test("ราคาแสดงพร้อมหน่วยและจัดรูปแบบเลขไทย, ราคา 0/ไม่มี/NaN → 'สอบถามราคา'", async () => {
    stubAll({
      settings: {}, categories: [], faqs: [], portfolios: [],
      products: [
        asDoc("p1", { name: "มีราคา", price: 12345, unit: "ชิ้น", status: "active" }),
        asDoc("p2", { name: "ราคาศูนย์", price: 0, unit: "ชิ้น", status: "active" }),
        asDoc("p3", { name: "ไม่มีราคา", unit: "ชิ้น", status: "active" }),
        asDoc("p4", { name: "ราคาเพี้ยน", price: "abc", unit: "ชิ้น", status: "active" })
      ]
    });
    const mod = await loadModule();
    const block = await mod.buildKnowledgeBlock();
    assert.match(block, /มีราคา \[?.*฿12,345\/ชิ้น|มีราคา.*฿12,345\/ชิ้น/);
    assert.match(block, /ราคาศูนย์: สอบถามราคา/);
    assert.match(block, /ไม่มีราคา: สอบถามราคา/);
    assert.match(block, /ราคาเพี้ยน: สอบถามราคา/);
  });

  test("ราคาไม่มี unit → ไม่มี '/' ต่อท้าย", async () => {
    stubAll({
      settings: {}, categories: [], faqs: [], portfolios: [],
      products: [asDoc("p1", { name: "ไม่มีหน่วย", price: 500, status: "active" })]
    });
    const mod = await loadModule();
    const block = await mod.buildKnowledgeBlock();
    assert.match(block, /ไม่มีหน่วย: ฿500(?!\/)/);
  });

  test("แสดงชื่อหมวดหมู่ [cat] เมื่อ cat_id ตรงกับ categories ที่โหลดมา, ไม่ตรง/ไม่มี cat_id → ไม่มี [ ] ต่อท้ายชื่อ", async () => {
    stubAll({
      settings: {}, faqs: [], portfolios: [],
      categories: [asDoc("c1", { name: "ป้ายจราจร" })],
      products: [
        asDoc("p1", { name: "สินค้ามีหมวด", price: 100, cat_id: "c1", status: "active" }),
        asDoc("p2", { name: "สินค้าไม่มีหมวด", price: 100, status: "active" }),
        asDoc("p3", { name: "สินค้าหมวดไม่ตรง", price: 100, cat_id: "c-not-exist", status: "active" })
      ]
    });
    const mod = await loadModule();
    const block = await mod.buildKnowledgeBlock();
    assert.match(block, /สินค้ามีหมวด \[ป้ายจราจร\]/);
    assert.match(block, /สินค้าไม่มีหมวด: /);
    assert.doesNotMatch(block, /สินค้าไม่มีหมวด \[/);
    assert.match(block, /สินค้าหมวดไม่ตรง: /);
    assert.doesNotMatch(block, /สินค้าหมวดไม่ตรง \[/);
  });

  test("แสดง material/size เฉพาะเมื่อมีค่า", async () => {
    stubAll({
      settings: {}, categories: [], faqs: [], portfolios: [],
      products: [
        asDoc("p1", { name: "มีครบ", price: 100, status: "active", material: "อลูมิเนียม", size: "60x60ซม." }),
        asDoc("p2", { name: "ไม่มีเลย", price: 100, status: "active" })
      ]
    });
    const mod = await loadModule();
    const block = await mod.buildKnowledgeBlock();
    assert.match(block, /มีครบ.*วัสดุ: อลูมิเนียม.*ขนาด: 60x60ซม\./);
    const lineNoExtra = block.split("\n").find((l) => l.includes("ไม่มีเลย"));
    assert.ok(lineNoExtra);
    assert.doesNotMatch(lineNoExtra, /วัสดุ|ขนาด/);
  });

  test("จำนวนสินค้า active ที่แสดงในหัวข้อ ตรงกับจำนวนจริงหลังกรอง (ไม่นับ inactive)", async () => {
    stubAll({
      settings: {}, categories: [], faqs: [], portfolios: [],
      products: [
        asDoc("p1", { name: "A", price: 1, status: "active" }),
        asDoc("p2", { name: "B", price: 1, status: "active" }),
        asDoc("p3", { name: "C", price: 1, status: "inactive" })
      ]
    });
    const mod = await loadModule();
    const block = await mod.buildKnowledgeBlock();
    assert.match(block, /รายการสินค้าปัจจุบัน \(2 รายการ\)/);
  });

  test("สินค้า active เกิน 60 รายการ → ตัดเหลือ 60 รายการแรก + ข้อความจำนวนที่เหลือ", async () => {
    const products = [];
    for (let i = 1; i <= 65; i += 1) {
      products.push(asDoc(`p${i}`, { name: `สินค้า ${i}`, price: 100, status: "active" }));
    }
    stubAll({ settings: {}, categories: [], faqs: [], portfolios: [], products });
    const mod = await loadModule();
    const block = await mod.buildKnowledgeBlock();
    assert.match(block, /รายการสินค้าปัจจุบัน \(65 รายการ\)/);
    assert.match(block, /สินค้า 60/);
    assert.doesNotMatch(block, /สินค้า 61(?!\d)/);
    assert.match(block, /และสินค้าอื่นอีก 5 รายการ/);
  });

  test("สินค้า active พอดี 60 รายการ → ไม่มีข้อความ 'และสินค้าอื่นอีก'", async () => {
    const products = [];
    for (let i = 1; i <= 60; i += 1) {
      products.push(asDoc(`p${i}`, { name: `สินค้า ${i}`, price: 100, status: "active" }));
    }
    stubAll({ settings: {}, categories: [], faqs: [], portfolios: [], products });
    const mod = await loadModule();
    const block = await mod.buildKnowledgeBlock();
    assert.doesNotMatch(block, /และสินค้าอื่นอีก/);
  });

  test("ไม่มีสินค้า active เลย (ทั้งหมด inactive หรือ products=[]) → ไม่มีหัวข้อ 'รายการสินค้าปัจจุบัน' เลย", async () => {
    stubAll({
      settings: {}, categories: [], faqs: [], portfolios: [],
      products: [asDoc("p1", { name: "ปิดขาย", price: 1, status: "inactive" })]
    });
    const mod = await loadModule();
    const block = await mod.buildKnowledgeBlock();
    assert.doesNotMatch(block, /รายการสินค้าปัจจุบัน/);
  });
});

describe("js/chat-widget-knowledge.js — buildKnowledgeBlock(): FAQ", () => {
  test("มี FAQ → แสดงหัวข้อ + คู่ ถาม/ตอบ ทุกคู่คั่นด้วยบรรทัดว่าง", async () => {
    stubAll({
      settings: {}, products: [], categories: [], portfolios: [],
      faqs: [
        asDoc("f1", { question: "ส่งของนานไหม", answer: "5-10 วัน" }),
        asDoc("f2", { question: "รับผลิตตามแบบไหม", answer: "รับ มี Artwork ฟรี" })
      ]
    });
    const mod = await loadModule();
    const block = await mod.buildKnowledgeBlock();
    assert.match(block, /คำถามที่พบบ่อย \(FAQ\)/);
    assert.match(block, /ถาม: ส่งของนานไหม\nตอบ: 5-10 วัน/);
    assert.match(block, /ถาม: รับผลิตตามแบบไหม\nตอบ: รับ มี Artwork ฟรี/);
  });

  test("faqs=[] → ไม่มีหัวข้อ FAQ เลย", async () => {
    stubAll({ settings: {}, products: [], categories: [], portfolios: [], faqs: [] });
    const mod = await loadModule();
    const block = await mod.buildKnowledgeBlock();
    assert.doesNotMatch(block, /คำถามที่พบบ่อย/);
  });
});

describe("js/chat-widget-knowledge.js — buildKnowledgeBlock(): ผลงาน/ลูกค้า (portfolios)", () => {
  test("มี portfolios ที่มี client → แสดงหัวข้อพร้อมรายชื่อ ไม่ซ้ำ (dedupe)", async () => {
    stubAll({
      settings: {}, products: [], categories: [], faqs: [],
      portfolios: [
        asDoc("w1", { client: "บริษัท A" }),
        asDoc("w2", { client: "บริษัท B" }),
        asDoc("w3", { client: "บริษัท A" })
      ]
    });
    const mod = await loadModule();
    const block = await mod.buildKnowledgeBlock();
    assert.match(block, /ลูกค้า\/โครงการที่เคยทำ \(ตัวอย่าง\): บริษัท A, บริษัท B/);
    const occurrences = block.split("บริษัท A").length - 1;
    assert.equal(occurrences, 1);
  });

  test("portfolio ที่ไม่มี client (falsy) ถูกกรองทิ้งจากรายชื่อ", async () => {
    stubAll({
      settings: {}, products: [], categories: [], faqs: [],
      portfolios: [asDoc("w1", { client: "" }), asDoc("w2", { client: "บริษัท C" })]
    });
    const mod = await loadModule();
    const block = await mod.buildKnowledgeBlock();
    assert.match(block, /ลูกค้า\/โครงการที่เคยทำ \(ตัวอย่าง\): บริษัท C/);
  });

  test("portfolios มี client จริงเกิน 20 ราย (ไม่ซ้ำ) → ตัดเหลือ 20 รายชื่อแรก", async () => {
    const portfolios = [];
    for (let i = 1; i <= 25; i += 1) portfolios.push(asDoc(`w${i}`, { client: `ลูกค้า ${i}` }));
    stubAll({ settings: {}, products: [], categories: [], faqs: [], portfolios });
    const mod = await loadModule();
    const block = await mod.buildKnowledgeBlock();
    const line = block.split("\n").find((l) => l.startsWith("ลูกค้า/โครงการที่เคยทำ"));
    assert.ok(line);
    const names = line.replace("ลูกค้า/โครงการที่เคยทำ (ตัวอย่าง): ", "").split(", ");
    assert.equal(names.length, 20);
  });

  test("portfolios=[] หรือทุกรายการไม่มี client → ไม่มีหัวข้อลูกค้าเลย", async () => {
    stubAll({
      settings: {}, products: [], categories: [], faqs: [],
      portfolios: [asDoc("w1", {})]
    });
    const mod = await loadModule();
    const block = await mod.buildKnowledgeBlock();
    assert.doesNotMatch(block, /ลูกค้า\/โครงการที่เคยทำ/);
  });
});

describe("js/chat-widget-knowledge.js — buildKnowledgeBlock(): รวมหลายส่วนพร้อมกัน + escape/XSS", () => {
  test("มีข้อมูลครบทุกส่วน → ทุกส่วนต่อกันด้วยบรรทัดว่างคั่น (\\n\\n) ตามลำดับ contact→products→faq→portfolio", async () => {
    stubAll({
      settings: { address: "ที่อยู่ทดสอบ" },
      products: [asDoc("p1", { name: "สินค้า", price: 1, status: "active" })],
      categories: [],
      faqs: [asDoc("f1", { question: "Q", answer: "A" })],
      portfolios: [asDoc("w1", { client: "ลูกค้า" })]
    });
    const mod = await loadModule();
    const block = await mod.buildKnowledgeBlock();
    const contactIdx = block.indexOf("ข้อมูลติดต่อบริษัท");
    const productsIdx = block.indexOf("รายการสินค้าปัจจุบัน");
    const faqIdx = block.indexOf("คำถามที่พบบ่อย");
    const portfolioIdx = block.indexOf("ลูกค้า/โครงการที่เคยทำ");
    assert.ok(contactIdx >= 0 && productsIdx > contactIdx && faqIdx > productsIdx && portfolioIdx > faqIdx);
    assert.match(block, /\n\n/);
  });

  test("ไม่ escape HTML ใดๆ ในชื่อสินค้า/คำถาม FAQ (เนื้อหาถูกส่งไปเป็น system prompt สำหรับ AI ไม่ใช่ HTML ที่ render บนหน้าเว็บ)", async () => {
    stubAll({
      settings: {},
      products: [asDoc("p1", { name: "<script>alert(1)</script>", price: 1, status: "active" })],
      categories: [], faqs: [], portfolios: []
    });
    const mod = await loadModule();
    const block = await mod.buildKnowledgeBlock();
    assert.match(block, /<script>alert\(1\)<\/script>/);
  });
});
