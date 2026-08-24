// ===========================================================
// js/admin-overview-today.js — แถบ "วันนี้ต้องทำอะไร" บนสุดของแท็บภาพรวม
//
// ทำไมแยกไฟล์: เพื่อไม่แตะ render/ข้อมูลเดิมใน admin-page.js หรือ orders-tab.js
// เลยแม้แต่บรรทัดเดียว (โค้ดทั้งสองไฟล์ทดสอบแล้วและมี logic ซับซ้อนพอสมควร)
//
// วิธีทำงาน: ตัวเลข "งานเกินกำหนด" / "งานใกล้กำหนดส่ง" / "ลีดใหม่ที่ยังไม่อ่าน"
// ถูก render ไว้แล้วโดย orders-tab.js / admin-page.js ที่ #cp-stat-overdue,
// #cp-stat-duesoon, #ov-stat-leads-new ตามลำดับ — ไฟล์นี้แค่ "เฝ้าดู" ตัวเลข
// เหล่านั้นด้วย MutationObserver แล้วแปลงเป็นประโยคภาษาคนอ่านง่าย ไม่ได้คำนวณ
// ซ้ำเอง จึงรับประกันว่าตัวเลขจะตรงกับที่การ์ดสถิติแสดงเสมอ
//
// การคลิก: จำลองคลิกไปที่การ์ด/ปุ่มกรองเดิมที่มี event ผูกไว้อยู่แล้ว
// (cp-stat-card-overdue, cp-stat-card-duesoon, แท็บลีด + pill "ใหม่")
// แทนที่จะเรียก switchTab()/jumpFilter ตรงๆ ซึ่งเป็นตัวแปร private ของไฟล์อื่น
// ===========================================================

const SOURCE_IDS = ["cp-stat-overdue", "cp-stat-duesoon", "ov-stat-leads-new"];

function readCount(id) {
  const el = document.getElementById(id);
  if (!el) return 0;
  const n = parseInt(el.textContent.replace(/[^\d]/g, ""), 10);
  return isNaN(n) ? 0 : n;
}

function goOverdue() {
  const card = document.getElementById("cp-stat-card-overdue");
  if (card) card.click();
}
function goDueSoon() {
  const card = document.getElementById("cp-stat-card-duesoon");
  if (card) card.click();
}
function goNewLeads() {
  const tabBtn = document.getElementById("ad-tabbtn-leads");
  if (tabBtn) tabBtn.click();
  // รอให้แท็บสลับ/render pill กรองก่อนค่อยกดกรอง "ใหม่" (สลับแท็บเป็น synchronous
  // อยู่แล้วในโค้ดเดิม แต่ใส่ rAF กันเหนียวเผื่อมีการปรับ timing ในอนาคต)
  requestAnimationFrame(() => {
    const pill = document.querySelector('#ad-l-filter-status-pills [data-status="new"]');
    if (pill) pill.click();
  });
}

function render() {
  const banner = document.getElementById("ov-today-banner");
  const list = document.getElementById("cp-ov-today-list");
  if (!banner || !list) return;

  const overdue = readCount("cp-stat-overdue");
  const dueSoon = readCount("cp-stat-duesoon");
  const newLeads = readCount("ov-stat-leads-new");

  const items = [
    overdue > 0 && {
      cls: "danger",
      icon: '<circle cx="12" cy="12" r="10"/><path d="M12 8v5"/><path d="M12 16h.01"/>',
      text: `มีคำสั่งผลิต <strong>${overdue}</strong> รายการเกินกำหนดส่งแล้ว — ควรรีบตรวจสอบ`,
      cta: "ดูรายการ →",
      onClick: goOverdue
    },
    dueSoon > 0 && {
      cls: "warn",
      icon: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
      text: `มีคำสั่งผลิต <strong>${dueSoon}</strong> รายการใกล้ครบกำหนดส่ง (ภายใน 2 วัน)`,
      cta: "ดูรายการ →",
      onClick: goDueSoon
    },
    newLeads > 0 && {
      cls: "info",
      icon: '<path d="M4 4h16v12H7l-3 3V4Z"/>',
      text: `มีลีดใหม่ <strong>${newLeads}</strong> รายการที่ยังไม่ได้อ่าน/ติดต่อกลับ`,
      cta: "ดูลีดใหม่ →",
      onClick: goNewLeads
    }
  ].filter(Boolean);

  banner.style.display = "";

  if (!items.length) {
    list.innerHTML = `
      <div class="cp-ov-today-item ok">
        <span class="cp-ov-today-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg></span>
        <span class="cp-ov-today-text">วันนี้ไม่มีงานด่วน — ไม่มีงานเกินกำหนดส่งและไม่มีลีดใหม่ค้างอยู่ 🎉</span>
      </div>`;
    return;
  }

  list.innerHTML = items.map((it, i) => `
    <button type="button" class="cp-ov-today-item ${it.cls}" data-today-idx="${i}">
      <span class="cp-ov-today-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${it.icon}</svg></span>
      <span class="cp-ov-today-text">${it.text}</span>
      <span class="cp-ov-today-cta">${it.cta}</span>
    </button>`).join("");

  list.querySelectorAll("[data-today-idx]").forEach(btn => {
    btn.addEventListener("click", () => {
      const it = items[Number(btn.dataset.todayIdx)];
      if (it && it.onClick) it.onClick();
    });
  });
}

let scheduled = false;
function scheduleRender() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => { scheduled = false; render(); });
}

function watch(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const observer = new MutationObserver(scheduleRender);
  observer.observe(el, { childList: true, characterData: true, subtree: true });
}

SOURCE_IDS.forEach(watch);
// วาดครั้งแรกทันที เผื่อค่าเริ่มต้น (0) ยังไม่เปลี่ยนหลังโหลดข้อมูลจริง (ไม่ควรเกิดขึ้นบ่อย
// แต่กันไว้ไม่ให้แถบว่างเปล่าหายไปเฉยๆ ระหว่างรอข้อมูลจาก Firestore)
render();
