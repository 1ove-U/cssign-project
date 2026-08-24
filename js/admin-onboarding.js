// ===========================================================
// js/admin-onboarding.js — onboarding checklist ตอนล็อกอินครั้งแรก
// (P1.6e — ส่วนสุดท้ายของ "Simplify Admin UI สำหรับพนักงานที่ไม่เก่ง IT")
// ===========================================================
// แสดง overlay สรุปฟีเจอร์ที่ "มีอยู่แล้ว" ในระบบ (ไม่ใช่ฟีเจอร์ใหม่) ให้บัญชีที่เพิ่งเคย
// ล็อกอินเข้าคอนโซลเห็นครั้งแรกเท่านั้น: ค้นหาแบบด่วน (global search คีย์ลัด "/"), เลิกทำได้
// หลังลบ (undo toast), ระบบยืนยันก่อนลบเสมอ (confirm dialog) — ปิดครั้งเดียวแล้วจำไว้ไม่แสดงซ้ำ
// อีก (ผูกกับ uid ผ่าน localStorage แยกต่อบัญชี ไม่ใช่ต่อเครื่อง เผื่อหลายคนใช้เครื่องเดียวกัน)
//
// สถาปัตยกรรม/แพทเทิร์น: เหมือน ensureConfirmOverlay() (js/ui-helpers.js) และ
// ensureDayOverlay() (js/orders-tab-calendar.js) ทุกประการ — สร้าง overlay ครั้งเดียวแบบ
// lazy-create เก็บไว้ใช้ซ้ำ (module-level singleton) append เข้า document.body ปิดได้ 3 ทาง
// (ปุ่มปิด/คลิก backdrop/กด Escape) ทุกทางถือว่า "รับทราบแล้ว" เหมือนกัน (ไม่ใช่ modal บังคับ
// ต้องกดปุ่มใดปุ่มหนึ่งเท่านั้น เนื้อหาเป็นแค่คำแนะนำ ไม่ใช่การยืนยันสิ่งที่ทำลายข้อมูล)
//
// เรียกจาก js/admin-page.js ท้าย onAuthChange() (หลัง applyRoleUI()) ครั้งเดียวต่อ session —
// รับ uid เป็น argument แรกตรงๆ แทนการอ่าน auth state เอง ให้ไฟล์นี้ทดสอบง่ายแบบ pure/DI
// เหมือน applyRoleUI() (js/admin-role-ui.js) ไม่ต้องพึ่ง firebase-stub-loader

// เก็บ "เห็นแล้ว" แยกต่อ uid กันบัญชีอื่นที่ล็อกอินเครื่องเดียวกันโดนข้ามไปด้วย
const STORAGE_KEY_PREFIX = "cssign_admin_onboarding_seen_v1:";

// เนื้อหา checklist — แก้/เพิ่มรายการใหม่ที่นี่ที่เดียว (ไม่ผูกกับ role ใดเป็นพิเศษ เพราะทุก
// role เห็นฟีเจอร์เหล่านี้เหมือนกันหมด แม้ role "production" จาก P1.6a จะเห็นแค่แท็บคำสั่งผลิต
// ก็ยังมีช่องค้นหากลาง/undo toast/confirm dialog ให้ใช้งานอยู่)
const ONBOARDING_ITEMS = [
  {
    title: "ค้นหาแบบด่วน",
    desc: "กดปุ่ม \"/\" ที่แป้นพิมพ์เวลาไหนก็ได้ (ไม่ได้พิมพ์อยู่ในช่องอื่น) เพื่อเปิดช่องค้นหากลาง ค้นหาสินค้า/ออเดอร์/ลีดได้ในที่เดียว",
  },
  {
    title: "เลิกทำได้ภายใน 5 วินาที",
    desc: "กดลบรายการแล้วเปลี่ยนใจ? จะมีข้อความแจ้งเตือนพร้อมปุ่ม \"เลิกทำ\" ขึ้นมุมล่างขวาให้กดยกเลิกทันก่อนที่จะลบจริง",
  },
  {
    title: "ยืนยันก่อนลบเสมอ",
    desc: "ระบบจะถามยืนยันทุกครั้งก่อนลบข้อมูลสำคัญ ไม่มีทางลบพลาดจากการกดปุ่มผิดเพียงครั้งเดียว",
  },
];

let overlay = null;
// เก็บ storage/uid ของการเรียกล่าสุดไว้ระดับโมดูล (แทนที่จะ closure จับค่าตอน wiring ครั้งแรก)
// เพื่อรองรับกรณีบัญชีอื่น login ต่อในแท็บเดียวกันโดยไม่ reload หน้า (SPA) — ปิด overlay ต้อง
// บันทึกลง storage ของ "บัญชีที่กำลังดู overlay อยู่ตอนนี้" ไม่ใช่บัญชีแรกที่เคยเรียกฟังก์ชันนี้
let currentStorage = null;
let currentUid = null;

function escapeHtmlOnboard(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
}

// storage เริ่มต้น = globalThis.localStorage ถ้ามี — ห่อด้วย try/catch เพราะบางสภาพแวดล้อม
// (เช่น sandbox เทสที่ยังไม่ได้ polyfill ไว้ หรือโหมดส่วนตัวของเบราว์เซอร์บางตัว) เข้าถึงไม่ได้
function getDefaultStorage() {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null;
  }
}

function seenKey(uid) {
  return STORAGE_KEY_PREFIX + (uid || "anon");
}

function hasSeenOnboarding(storage, uid) {
  if (!storage) return false;
  try { return storage.getItem(seenKey(uid)) === "1"; } catch { return false; }
}

function markOnboardingSeen(storage, uid) {
  if (!storage) return;
  try { storage.setItem(seenKey(uid), "1"); } catch { /* ignore quota/private mode errors */ }
}

function ensureOnboardingOverlay(root) {
  if (overlay) return overlay;
  const doc = root.ownerDocument || (typeof document !== "undefined" ? document : null);
  if (!doc) return null;
  overlay = doc.createElement("div");
  overlay.className = "cp-onboard-overlay";
  overlay.style.display = "none";
  overlay.innerHTML = `
    <div class="cp-onboard-box" role="dialog" aria-modal="true">
      <div class="cp-onboard-head">
        <span class="cp-onboard-title">ยินดีต้อนรับ 👋 รู้จักฟีเจอร์ที่มีอยู่แล้วกัน</span>
        <button type="button" class="cp-icon-btn" id="cp-onboard-close" title="ปิด">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>
      </div>
      <div class="cp-onboard-list">
        ${ONBOARDING_ITEMS.map(item => `
        <div class="cp-onboard-item">
          <div class="cp-onboard-item-title">${escapeHtmlOnboard(item.title)}</div>
          <div class="cp-onboard-item-desc">${escapeHtmlOnboard(item.desc)}</div>
        </div>`).join("")}
      </div>
      <button type="button" class="btn btn-primary cl-btn" id="cp-onboard-ok">เข้าใจแล้ว เริ่มใช้งาน</button>
    </div>`;
  root.appendChild(overlay);
  return overlay;
}

// ปิด popover + (ถ้ามี storage) จำว่ารับทราบแล้ว ไม่ต้องแสดงซ้ำอีกสำหรับ uid ที่ "กำลังดู
// overlay อยู่ตอนนี้" (currentStorage/currentUid — ไม่ใช่ uid ตอน wiring ครั้งแรก ดูหมายเหตุ
// ด้านบนเรื่อง SPA ที่ login คนละบัญชีต่อกันได้โดยไม่ reload หน้า)
function closeOnboarding() {
  if (overlay) overlay.style.display = "none";
  markOnboardingSeen(currentStorage, currentUid);
}

/**
 * แสดง onboarding checklist ถ้าเป็นครั้งแรกที่ uid นี้ล็อกอิน (ยังไม่เคยปิดมาก่อน) —
 * เรียกครั้งเดียวหลัง login สำเร็จ (ดู js/admin-page.js onAuthChange ท้ายสุด หลัง applyRoleUI())
 *
 * @param {string|null|undefined} uid - uid ของบัญชีที่ login อยู่ (จาก user.uid ของ Firebase Auth)
 * @param {object} opts
 * @param {Element} [opts.root] - container ที่จะ append overlay เข้าไป (default: document.body —
 *   ไม่มี global document เลยและไม่ได้ส่ง root มา = คืนออกเงียบๆ ไม่ throw)
 * @param {Storage|null} [opts.storage] - ที่เก็บสถานะ "เห็นแล้ว" (default: globalThis.localStorage
 *   ถ้ามี — ส่ง null ตรงๆ เพื่อจำลอง "ไม่มี storage" ได้ เช่น ในเทส)
 */
export function maybeShowOnboarding(uid, opts = {}) {
  const root = opts.root || (typeof document !== "undefined" ? document.body : null);
  if (!root) return;
  const storage = opts.storage !== undefined ? opts.storage : getDefaultStorage();
  // อัปเดต state ปัจจุบันก่อนเช็ค "เคยเห็นหรือยัง" เสมอ — ให้ closeOnboarding() (ผูก listener
  // แค่ครั้งแรก) อ้างอิง storage/uid ของ "การเรียกล่าสุด" ผ่านตัวแปรระดับโมดูลนี้ได้เสมอ
  currentStorage = storage;
  currentUid = uid;
  if (hasSeenOnboarding(storage, uid)) return;

  const box = ensureOnboardingOverlay(root);
  if (!box) return;

  // ผูก listener เฉพาะตอนสร้าง overlay ครั้งแรกเท่านั้น (ป้องกันผูกซ้ำหลายชุดถ้าเรียก
  // maybeShowOnboarding() หลายครั้งข้าม session เดียวกัน — เหมือนแพทเทิร์น ensureDayOverlay())
  // handler ไม่รับ storage/uid เป็นอาร์กิวเมนต์ตรงๆ แล้ว (เดิม closure จับค่าตอน wiring ครั้งแรก
  // ค้างไว้ตลอดไป) แต่อ่านจาก currentStorage/currentUid ที่อัปเดตทุกครั้งที่เรียกฟังก์ชันนี้แทน
  if (!box.dataset.wired) {
    box.dataset.wired = "1";
    box.querySelector("#cp-onboard-close").addEventListener("click", closeOnboarding);
    box.querySelector("#cp-onboard-ok").addEventListener("click", closeOnboarding);
    box.addEventListener("click", (e) => { if (e.target === box) closeOnboarding(); });
    const doc = root.ownerDocument || (typeof document !== "undefined" ? document : null);
    if (doc) {
      doc.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && box.style.display !== "none") closeOnboarding();
      });
    }
  }

  box.style.display = "flex";
}
