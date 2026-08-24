// test/helpers/firebase-stub-loader.mjs
//
// จุดประสงค์: js/db.js และ js/db-orders.js ต่าง import Firebase SDK ตรงจาก URL ของ
// gstatic.com (browser ESM) — js/db.js เรียก initializeApp()/initializeFirestore()/
// getAuth() ตอน module ถูก evaluate (top-level, ไม่ใช่ใน function) ทำให้ import ไฟล์
// เหล่านี้ตรงๆ ใน Node test runner ไม่ได้เลย (Node เข้าถึง https:// import ไม่ได้ตรงๆ
// และ initializeFirestore ใช้ persistentLocalCache ที่พึ่ง indexedDB ซึ่งไม่มีใน Node)
//
// Loader นี้ "ดัก" การ import URL ของ Firebase SDK ทั้ง 3 ไฟล์ (firebase-app.js,
// firebase-firestore.js, firebase-auth.js) โดยจับที่ตัว URL เอง ไม่ใช่ที่ว่าไฟล์ไหน
// เป็นคน import จึงครอบคลุมทั้ง js/db.js และ js/db-orders.js (และไฟล์อื่นๆ ที่ import
// Firebase URL เดียวกันในอนาคต) โดยอัตโนมัติ ไม่ต้องแก้ loader นี้ตามทุกครั้งที่มีการ
// แตกไฟล์ data-layer ใหม่ — แล้วสวมด้วย stub module ที่มีแค่ no-op function/ค่าว่าง
// สำหรับทุกชื่อที่ไฟล์เหล่านั้น import มาใช้จริง — ไม่ได้แก้โค้ดปลายทางเลยแม้แต่บรรทัดเดียว
// เป็นการ mock ที่ boundary ภายนอกเท่านั้น
//
// ฟังก์ชันที่จะทดสอบ (computeOrderStats, computeLeadStats, orderGrandTotal, orderBalance,
// daysUntilDue, orderUrgency จาก js/db-orders-stats.js — แยกออกจาก js/db-orders.js ตั้งแต่
// รอบที่ 32 — ไม่มี import Firebase เลยสักบรรทัด จึงไม่ต้องพึ่ง stub นี้ด้วยซ้ำ, buildTrackingId
// จาก js/db-orders.js และ computeMonthlyRevenue จาก js/db.js) เป็นฟังก์ชันคำนวณล้วนๆ ไม่เรียก
// ใช้ Firebase API ใดๆ เลย จึง "ปลอดภัย" ที่จะ
// stub ส่วนอื่นทั้งหมดทิ้ง เพราะ test ไม่เคยเรียกโค้ดฝั่ง Firebase จริงอยู่แล้ว — ถ้าฟังก์ชัน
// เป้าหมายถูกแก้ในอนาคตให้ไปเรียก Firebase API ตรงๆ เมื่อไหร่ test พวกนี้จะ throw ทันที
// (stub ไม่รองรับ) ซึ่งเป็นสัญญาณเตือนที่ถูกต้องว่าฟังก์ชันนั้นไม่ใช่ pure function อีกต่อไป
// ต้องย้ายออกจากชุด unit test นี้

const STUB_PREFIX = "firebase-stub:";
const FIREBASE_URL_RE = /^https:\/\/www\.gstatic\.com\/firebasejs\/[\d.]+\/firebase-(app|firestore|auth)\.js$/;

// รวมทุกชื่อที่ js/db.js import จาก 3 ไฟล์นี้ไว้ในสตับเดียว (ดูรายชื่อจริงจาก import
// statement ของ js/db.js) — ฟังก์ชันคืนค่า no-op ที่ "สมเหตุสมผล" พอให้ไม่ throw ถ้าเผลอถูกเรียก
const STUB_SOURCE = `
function noop() {}
function noopAsync() { return Promise.resolve(); }

export function initializeApp() { return {}; }
export function initializeFirestore() { return {}; }
export function persistentLocalCache() { return {}; }
export function persistentMultipleTabManager() { return {}; }
export function collection(_db, path) { return { path }; }
// รอบที่ 70: doc() เดิมคืน {} เปล่าๆ เสมอ ไม่ว่าจะเรียกด้วย arg อะไร — ทำให้ getDoc()/updateDoc()/
// deleteDoc()/setDoc() แยกไม่ออกว่าถูกเรียกกับ collection/id ไหน — เปลี่ยนให้คืน { path } แบบเดียวกับ
// collection() ด้านบน (path = "<collectionPath>/<id>" ถ้ามี id, ไม่งั้นแค่ collectionPath) — ไม่กระทบ
// test เดิมไฟล์ไหนเลยเพราะไม่มีไฟล์ไหนอ้างอิง return value ของ doc() ตรงๆ มาก่อน (เดิมได้ {} ว่างๆ
// อยู่แล้ว เพิ่งมาใช้ path ตอนนี้เป็นครั้งแรก) — เรียกแบบ doc() เปล่าไม่มี arg ยังไม่ throw (path เป็น
// undefined เฉยๆ)
export function doc(_db, collectionPath, id) {
  return { path: id !== undefined ? \`\${collectionPath}/\${id}\` : collectionPath };
}
// รอบที่ 89: getDocs() เดิมไม่รับ arg เลย (คืน docs: [] คงที่เสมอไม่ว่าจะ query collection ไหน) —
// ทำให้ทดสอบฟังก์ชันที่ต้องพึ่งผลลัพธ์จริงจาก getDocs() (เช่น listStaff()/getProducts()/
// getCategories() ที่ js/orders-tab-modal.js Phase 1 ต้องใช้ตอนทดสอบ assigneeName resolution/
// product picker) ไม่ได้เลยสักเคส — เพิ่ม globalThis.__GET_DOCS_STUB__ (function รับ ref ที่มี
// .path เป็น string เช่น "staff"/"products"/"categories" คืน array ของ {id, data} ธรรมดา — ไม่ต้อง
// คืนแบบ .docs/.exists()/.data() เป็น method) ให้ test override ได้ต่อ collection ตามแพทเทิร์น
// เดียวกับ __GET_DOC_STUB__ ของรอบที่ 70 ด้านล่าง — ถ้าไม่ตั้งไว้ (undefined) ใช้ default เดิม
// (docs: []) ทุกประการ ไม่กระทบ test เดิมไฟล์ไหนเลยเพราะแค่เพิ่ม hook เฉยๆ — ต้องแก้ query() คู่กัน
// ด้านล่างให้ผ่าน ref เดิมทะลุไปแทนที่จะคืน {} ทิ้ง ไม่งั้น getDocs() จะไม่รู้ว่า query มาจาก
// collection ไหน
// รอบที่ 135: เพิ่ม globalThis.__GET_DOCS_DELAY_MS__ (optional, number) — ถ้าตั้งไว้ ใช้
// setTimeout(ms) จริงแทน Promise.resolve() เดิมตอน resolve getDocs() เพื่อจำลอง network
// request ที่ "ช้าจริง" ข้ามรอบ macrotask (ต่างจาก noopAsync() เดิมที่ resolve ผ่าน microtask
// เท่านั้น — resolve เร็วกว่า setTimeout() ใดๆ เสมอไม่ว่าจะตั้ง delay ไว้กี่ ms ก็ตาม เพราะ
// microtask queue ถูก drain ก่อน macrotask/timer queue เสมอตามสเปก event loop) จำเป็นสำหรับ
// เทสที่ต้องพิสูจน์ race ระหว่าง "ตัวจับเวลาโชว์ skeleton" (เช่น js/blog-render.js
// SKELETON_DELAY=260ms) กับการโหลดข้อมูลจริงเสร็จ — ถ้าไม่ตั้งไว้ (undefined) ใช้
// noopAsync() เดิมทุกประการ ไม่กระทบ test เดิมไฟล์ไหนเลย
export function getDocs(ref) {
  const stub = globalThis.__GET_DOCS_STUB__;
  const delayMs = globalThis.__GET_DOCS_DELAY_MS__;
  // run() ทำหน้าที่เรียก stub() จริง (ซึ่งอาจ throw ได้) — ต้องอยู่ "ข้างใน" เส้นทาง delay ด้วย
  // ไม่ใช่แค่ผลลัพธ์ตอน resolve เฉยๆ ไม่งั้นเทสที่จำลอง "โหลดช้าแล้วพัง" จะพังทันทีแบบ synchronous
  // ก่อนถึงเวลา delay ที่ตั้งไว้เลย (เจอบั๊กนี้จากรันจริงตอนเขียนเทส test/blog-render.test.mjs
  // ก่อนแก้จุดนี้ — ไม่ใช่การเดา)
  const run = () => {
    if (typeof stub === "function") {
      const list = stub(ref) || [];
      const docs = list.map(d => ({ id: d.id, data: () => d.data || {} }));
      return { docs };
    }
    return { docs: [] };
  };
  if (typeof delayMs === "number") {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        try { resolve(run()); } catch (e) { reject(e); }
      }, delayMs);
    });
  }
  return noopAsync().then(run);
}
// เก็บ argument ล่าสุดที่เรียกไว้ใน globalThis.__ADD_DOC_CALLS__ (array, ไม่ gate ด้วย flag —
// อ่านตรงๆ เสมอตอน runtime เพราะโค้ดนี้ถูก generate ไปรันใน main thread จริงตอน module
// evaluation ไม่ใช่ตอน resolve()/load() hook เอง จึงอ่าน/เขียน globalThis ได้ปกติ — ดูหมายเหตุ
// เดียวกันใน db-orders-stub-loader.mjs — เพิ่มในรอบที่ 68) ไม่กระทบ test เดิมไฟล์ไหนเลยเพราะแค่
// "จด" เพิ่ม ไม่ได้เปลี่ยนพฤติกรรม return value เดิม (ยังคืน {id:"stub-id"} คงที่เหมือนเดิมทุกประการ)
// รอบที่ 121: เพิ่ม globalThis.__ADD_DOC_STUB__ (function รับ (collRef, payload) — ถ้า return
// ค่าที่มี key "throw" (Error object) จะกลายเป็น rejected promise, ถ้า return object อื่นใช้เป็น
// ผลลัพธ์ resolve แทน { id: "stub-id" } เดิม, ถ้าไม่ได้ตั้งไว้ (undefined) ใช้ default เดิมทุก
// ประการ) ตามแพทเทิร์นเดียวกับ __GET_DOCS_STUB__/__GET_DOC_STUB__ ด้านล่าง — เพิ่มเพื่อทดสอบเคส
// "นำเข้าบางรายการล้มเหลว" ของ js/admin-products-csv.js (Promise.allSettled ต้องมี rejection จริง
// อย่างน้อย 1 รายการถึงจะเทสได้ — เดิม addDoc()/updateDoc() resolve เฉยๆ เสมอไม่มีทางจำลอง
// ล้มเหลวได้เลย) ไม่กระทบ test เดิมไฟล์ไหนเลยเพราะ default (stub ไม่ได้ตั้ง) พฤติกรรมเหมือนเดิม
// 100% (ยัง resolve({id:"stub-id"}) เหมือนเดิมทุกประการ)
export function addDoc(collRef, payload) {
  if (!Array.isArray(globalThis.__ADD_DOC_CALLS__)) globalThis.__ADD_DOC_CALLS__ = [];
  globalThis.__ADD_DOC_CALLS__.push({ path: collRef && collRef.path, payload });
  const stub = globalThis.__ADD_DOC_STUB__;
  return noopAsync().then(() => {
    if (typeof stub === "function") {
      const r = stub(collRef, payload);
      if (r && r.throw) throw r.throw;
      return r || { id: "stub-id" };
    }
    return { id: "stub-id" };
  });
}
// รอบที่ 70: capture updateDoc()/deleteDoc()/setDoc() แบบเดียวกับ addDoc() ข้างบน (ไม่ gate ด้วย
// flag, ไม่เปลี่ยน return value เดิม — updateDoc()/deleteDoc() ยัง resolve() เฉยๆ เหมือนเดิม) เพิ่ม
// เพื่อเขียนเทสต์ addOrder/updateOrder/deleteOrder (js/db-orders.js) ที่เรียกทั้ง 3 ฟังก์ชันนี้จริง —
// เผื่อไฟล์ data-layer อื่นในอนาคต (db-products.js/db-blog.js/db-content.js/db-taxonomy.js) อยากใช้
// pattern เดียวกันได้เลยไม่ต้องแก้ stub ซ้ำ
// รอบที่ 121: เพิ่ม globalThis.__UPDATE_DOC_STUB__ แบบเดียวกับ __ADD_DOC_STUB__ ข้างบนทุกประการ
// (return { throw: err } เพื่อจำลองล้มเหลว, ไม่ตั้งไว้ = default เดิม resolve() เฉยๆ)
export function updateDoc(ref, payload) {
  if (!Array.isArray(globalThis.__UPDATE_DOC_CALLS__)) globalThis.__UPDATE_DOC_CALLS__ = [];
  globalThis.__UPDATE_DOC_CALLS__.push({ path: ref && ref.path, payload });
  const stub = globalThis.__UPDATE_DOC_STUB__;
  return noopAsync().then(() => {
    if (typeof stub === "function") {
      const r = stub(ref, payload);
      if (r && r.throw) throw r.throw;
    }
  });
}
export function deleteDoc(ref) {
  if (!Array.isArray(globalThis.__DELETE_DOC_CALLS__)) globalThis.__DELETE_DOC_CALLS__ = [];
  globalThis.__DELETE_DOC_CALLS__.push({ path: ref && ref.path });
  return noopAsync();
}
export function orderBy() { return {}; }
// P2.8c-D: where() clause ของ query() ใหม่ (ใช้โดย listenMyOrders() ใน js/db-orders.js กรอง
// orders ด้วย lineUserId) — stub นี้ไม่จำลอง filter จริง (เหมือน orderBy()/limit() ข้างบน)
// เพราะ query() ด้านล่างทิ้ง arg ที่ไม่ใช่ตัวแรกอยู่แล้ว ไม่มี test เดิมไฟล์ไหนพึ่งพฤติกรรม filter
// จริงจาก stub มาก่อน — เพิ่มแค่กัน ReferenceError ตอน import เท่านั้น
// รอบ P2.9-E (แก้บั๊ก prefix "line_"): เดิม where() ทิ้ง arg ทั้งหมดแล้วคืน {} เปล่าๆ เสมอ ทำให้ไม่มี
// test ไหนตรวจได้เลยว่า listenMyOrders()/listenMyLeads() query ด้วยค่า lineUserId ที่ถูกต้องจริง
// (ไม่มี prefix "line_"ติดไป) — เพิ่มแค่ "จด" arg ที่เรียกไว้ใน globalThis.__WHERE_CALLS__ (array ของ
// {field, op, value}) ตาม pattern เดียวกับ __ADD_DOC_CALLS__/__UPDATE_DOC_CALLS__ ด้านบน ไม่เปลี่ยน
// return value เดิม ({} ว่างๆ เหมือนเดิมทุกประการ) จึงไม่กระทบ test เดิมไฟล์ไหนเลย
export function where(field, op, value) {
  if (!Array.isArray(globalThis.__WHERE_CALLS__)) globalThis.__WHERE_CALLS__ = [];
  globalThis.__WHERE_CALLS__.push({ field, op, value });
  return {};
}
// รอบที่ 89: เดิม query() ทิ้ง ref ที่ได้รับมาแล้วคืน {} เปล่าๆ เสมอ (ทำให้ getDocs(query(...))
// แยกไม่ออกว่ามาจาก collection ไหน) — เปลี่ยนให้คืน ref ตัวแรก (collection ref) ทะลุผ่านไปตรงๆ
// แทน (ละ orderBy()/limit() clause อื่นที่ตามมา เพราะ stub นี้ไม่ได้จำลอง sort/limit จริงอยู่แล้ว
// — ฟังก์ชันที่ใช้ query() ทั้งหมดในโปรเจกต์คาดหวังแค่ getDocs()/onSnapshot() ทำงานได้ไม่ throw
// เท่านั้น ไม่มีที่ไหนตรวจ sort order จริงจาก stub) — onSnapshot() ยังไม่ใช้ค่านี้อยู่ดี (ทิ้ง arg
// เหมือนเดิมทุกประการ) จึงไม่กระทบ listenLeads()/listenOrders() เลย — ไม่มี test เดิมไฟล์ไหนตรวจ
// return value ของ query() ตรงๆ มาก่อน (ยืนยันด้วย grep ทั้งโปรเจกต์)
export function query(ref) { return ref; }
export function limit() { return {}; }
// รอบที่ 70: getDoc() เดิมคืนค่า "ไม่พบเอกสาร" คงที่เสมอ (exists: () => false) — ทำให้ทดสอบ
// updateOrder()/deleteOrder() (ที่อ่าน existing document ก่อนด้วย getDoc() เพื่อ merge/หา trackingId
// เดิม) ได้แค่เคส "ไม่มีเอกสารเดิม" เคสเดียว — เพิ่ม globalThis.__GET_DOC_STUB__ (function รับ ref
// คืน { exists, data } object ธรรมดา — ไม่ต้องคืนแบบ exists()/data() เป็น method) ให้ test
// override ได้ต่อเคส ถ้าไม่ตั้งไว้ (undefined) ใช้ default เดิมทุกประการ (exists: () => false,
// data: () => ({})) — ไม่กระทบ test เดิมไฟล์ไหนเลยเพราะ default พฤติกรรมเหมือนเดิม 100%
// (test/track-modal-form-flow.test.mjs เคส "ไม่พบ" อาศัย default นี้อยู่แล้ว)
export function getDoc(ref) {
  const stub = globalThis.__GET_DOC_STUB__;
  if (typeof stub === "function") {
    const result = stub(ref) || {};
    return noopAsync().then(() => ({
      exists: () => !!result.exists,
      data: () => result.data || {}
    }));
  }
  return noopAsync().then(() => ({ exists: () => false, data: () => ({}) }));
}
export function setDoc(ref, payload, options) {
  if (!Array.isArray(globalThis.__SET_DOC_CALLS__)) globalThis.__SET_DOC_CALLS__ = [];
  globalThis.__SET_DOC_CALLS__.push({ path: ref && ref.path, payload, options });
  return noopAsync();
}
// รอบที่ 92 (Phase 3 sub-round 3a): เดิม onSnapshot() ทิ้ง arg ทั้งหมดแล้วคืน noop เฉยๆ — ทำให้
// listenOrders()/listenLeads() (js/db-orders.js) ไม่มีทางถูกทดสอบเลยสักเคส เพราะ callback ที่ผู้
// เรียก (เช่น startOrdersListener() ใน js/orders-tab.js) ผูกไว้ไม่เคยถูกเรียกจริง — เก็บ callback
// ล่าสุดที่ลงทะเบียนไว้ต่อ ref.path ใน globalThis.__SNAPSHOT_LISTENERS__ (object ธรรมดา ไม่ต้องเป็น
// array เพราะแต่ละ collection ในโปรเจกต์นี้มี listener ที่ active อยู่จุดเดียวต่อครั้งเสมอ — ถ้ามีการ
// เรียกซ้ำ เช่น startOrdersListener() reconnect ใหม่ ก็ควรทับตัวเก่าอยู่แล้วสมเหตุสมผล) ให้ทดสอบยิง
// snapshot ปลอมได้เองผ่าน globalThis.__SNAPSHOT_LISTENERS__[path]({ docs: [...] }) — ไม่กระทบ test
// เดิมไฟล์ไหนเลย (ไม่มีไฟล์ไหนเรียก/พึ่ง onSnapshot() มาก่อนรอบนี้ — ยืนยันด้วย grep แล้ว) return
// value (unsubscribe function) ยังเป็น noop เหมือนเดิมทุกประการ ไม่เปลี่ยน error-path เดิม
export function onSnapshot(ref, onNext) {
  if (!globalThis.__SNAPSHOT_LISTENERS__) globalThis.__SNAPSHOT_LISTENERS__ = {};
  globalThis.__SNAPSHOT_LISTENERS__[ref && ref.path] = onNext;
  return noop;
}
export function serverTimestamp() { return null; }
export function deleteField() { return undefined; }
// P3.0 Phase 3 (data layer รอบ 1): runTransaction() สำหรับ generateQuoteNo() ใน
// js/db-quotations.js (เลขที่เอกสารรันอัตโนมัติผ่าน counters/quotations) — เดิมไม่มี stub นี้
// เลยเพราะไม่มีไฟล์ไหนในโปรเจกต์ใช้ runTransaction() มาก่อนรอบนี้ (ยืนยันด้วย grep แล้ว) —
// จำลอง transaction object แบบง่าย (ไม่ใช่ optimistic-concurrency retry จริงแบบ Firestore SDK —
// ไม่จำเป็นสำหรับ unit test เพราะเทสไม่เคยทดสอบ race condition ข้าม transaction จริง แค่ทดสอบว่า
// เรียก get/set ถูก path/payload หรือไม่) — tx.get(ref) อ่านจาก globalThis.__TX_GET_STUB__(ref)
// (function คืน { exists, data } เหมือน __GET_DOC_STUB__ เดิม, ไม่ตั้งไว้ = ถือว่าไม่มีเอกสาร
// อยู่ก่อน exists:false) — tx.set(ref, payload)/tx.update(ref, payload) เก็บ call ไว้ใน
// globalThis.__TX_SET_CALLS__/__TX_UPDATE_CALLS__ (array) ตาม pattern เดียวกับ __SET_DOC_CALLS__/
// __UPDATE_DOC_CALLS__ ด้านบน — runTransaction(db, updateFunction) เรียก updateFunction(tx) แล้ว
// คืนค่าที่ updateFunction คืนมาตรงๆ (resolve ผ่าน Promise เหมือน SDK จริง) — error จาก
// updateFunction ปล่อยให้ throw ทะลุออกไปตรงๆ ไม่ catch เอง (เหมือน SDK จริงที่ reject transaction
// ทั้งก้อนถ้า updateFunction throw)
export function runTransaction(_db, updateFunction) {
  const tx = {
    get: (ref) => {
      const stub = globalThis.__TX_GET_STUB__;
      const result = typeof stub === "function" ? (stub(ref) || {}) : {};
      return noopAsync().then(() => ({
        exists: () => !!result.exists,
        data: () => result.data || {}
      }));
    },
    set: (ref, payload) => {
      if (!Array.isArray(globalThis.__TX_SET_CALLS__)) globalThis.__TX_SET_CALLS__ = [];
      globalThis.__TX_SET_CALLS__.push({ path: ref && ref.path, payload });
    },
    update: (ref, payload) => {
      if (!Array.isArray(globalThis.__TX_UPDATE_CALLS__)) globalThis.__TX_UPDATE_CALLS__ = [];
      globalThis.__TX_UPDATE_CALLS__.push({ path: ref && ref.path, payload });
    }
  };
  return noopAsync().then(() => updateFunction(tx));
}
export function getAuth() { return { currentUser: null }; }
// รอบที่ 134: เพิ่ม globalThis.__SIGNIN_STUB__ (function รับ (email, password) — return object
// ที่มี key "throw" (Error) จะกลายเป็น rejected promise จำลองล็อกอินผิด, return object อื่นใช้เป็น
// { user } แทนค่าเริ่มต้น { user: null }, ไม่ตั้งไว้ = default เดิมทุกประการ) ตามแพทเทิร์นเดียวกับ
// __ADD_DOC_STUB__/__UPDATE_DOC_STUB__ — เพิ่มเพื่อทดสอบ js/admin-page.js (ปุ่มล็อกอิน error path)
export function signInWithEmailAndPassword(_auth, email, password) {
  const stub = globalThis.__SIGNIN_STUB__;
  return noopAsync().then(() => {
    if (typeof stub === "function") {
      const r = stub(email, password);
      if (r && r.throw) throw r.throw;
      return r || { user: null };
    }
    return { user: null };
  });
}
// เพิ่ม globalThis.__SIGNOUT_STUB__ (function ไม่รับ arg — return object ที่มี key "throw" (Error)
// จะกลายเป็น rejected promise จำลอง signOut(auth) ล้มเหลว, ไม่ตั้งไว้ = default resolve เดิมทุก
// ประการ) ตามแพทเทิร์นเดียวกับ __SIGNIN_STUB__/__SIGNIN_CUSTOM_TOKEN_STUB__ ด้านบน — เพิ่มเพื่อ
// ทดสอบ handleLogout() error-path ใน js/my-orders-page.js/-en.js (ปุ่มออกจากระบบ P2.9-A ที่ยังไม่
// เคยมีเทสของตัวเองมาก่อนรอบนี้)
export function signOut() {
  if (!Array.isArray(globalThis.__SIGNOUT_CALLS__)) globalThis.__SIGNOUT_CALLS__ = [];
  globalThis.__SIGNOUT_CALLS__.push(true);
  const stub = globalThis.__SIGNOUT_STUB__;
  return noopAsync().then(() => {
    if (typeof stub === "function") {
      const r = stub();
      if (r && r.throw) throw r.throw;
    }
  });
}
// P1.5 (LIFF auto-link) — signInWithCustomToken() สำหรับ linkLineAccount() (js/db-orders.js) —
// แยก stub/globalThis flag ออกจาก __SIGNIN_STUB__ เดิมด้านบนเพราะคนละฟังก์ชัน คนละ signature
// (รับ token string เดียว ไม่ใช่ email/password) — เก็บ token ที่เรียกไว้ใน
// globalThis.__SIGNIN_CUSTOM_TOKEN_CALLS__ (array) ให้ test ตรวจได้ว่าถูกเรียกด้วย token ที่ถูกต้อง
// ตามแพทเทิร์นเดียวกับ __UPDATE_DOC_CALLS__ ด้านบน — __SIGNIN_CUSTOM_TOKEN_STUB__ (function รับ
// token, return { throw: err } จำลองล้มเหลว, ไม่ตั้งไว้ = default resolve({ user: null }))
export function signInWithCustomToken(_auth, token) {
  if (!Array.isArray(globalThis.__SIGNIN_CUSTOM_TOKEN_CALLS__)) globalThis.__SIGNIN_CUSTOM_TOKEN_CALLS__ = [];
  globalThis.__SIGNIN_CUSTOM_TOKEN_CALLS__.push(token);
  const stub = globalThis.__SIGNIN_CUSTOM_TOKEN_STUB__;
  return noopAsync().then(() => {
    if (typeof stub === "function") {
      const r = stub(token);
      if (r && r.throw) throw r.throw;
      return r || { user: null };
    }
    return { user: null };
  });
}
// รอบที่ 134: เดิม onAuthStateChanged() ทิ้ง callback ที่รับมาทั้งหมด (ไม่เก็บไว้เลย) — ทำให้
// js/db.js onAuthChange() ที่ js/admin-page.js เรียกตอน module evaluate ไม่มีทางถูกทริกเกอร์จาก
// เทสได้เลยสักครั้ง — เก็บ callback ล่าสุดไว้ใน globalThis.__AUTH_STATE_CALLBACK__ (ตัวแปรเดียว
// พอ เพราะโปรเจกต์นี้มีจุดเรียก onAuthChange() แค่จุดเดียวคือ js/admin-page.js) ให้เทสยิง
// globalThis.__AUTH_STATE_CALLBACK__(fakeUser | null) จำลอง login/logout ได้เอง — ไม่กระทบ
// test เดิมไฟล์ไหนเลย (ไม่มีไฟล์ไหนเรียก onAuthChange() มาก่อนรอบนี้ — ยืนยันด้วย grep แล้ว)
// return value (unsubscribe function) ยังเป็น noop เหมือนเดิมทุกประการ
export function onAuthStateChanged(_auth, callback) {
  globalThis.__AUTH_STATE_CALLBACK__ = callback;
  return noop;
}
`;

export async function resolve(specifier, context, nextResolve) {
  if (FIREBASE_URL_RE.test(specifier)) {
    return { url: STUB_PREFIX + encodeURIComponent(specifier), shortCircuit: true };
  }
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url.startsWith(STUB_PREFIX)) {
    return { format: "module", source: STUB_SOURCE, shortCircuit: true };
  }
  return nextLoad(url, context);
}
