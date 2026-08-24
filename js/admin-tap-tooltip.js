// ===========================================================
// js/admin-tap-tooltip.js — แปลง title="..." (hover-only) บนการ์ดสถิติ
// ให้เป็นปุ่ม "ⓘ" ที่กดดูคำอธิบายได้จริงบนจอสัมผัส
//
// ทำไมต้องมี: การ์ดสถิติบางใบ (เช่น "อัตราปิดการขาย", "งานใหม่",
// "ยอดขายวันนี้/เดือนนี้") ใช้ title="..." อธิบายวิธีคำนวณ ซึ่งจะไม่มีวันแสดง
// เลยถ้าเปิดจากแท็บเล็ต/มือถือ (ไม่มี mouse hover) — พนักงานหน้างานที่ไม่ใช่
// สายไอทีจึงไม่มีทางรู้ที่มาของตัวเลขเหล่านี้ได้เลย
//
// วิธีทำงาน: หาการ์ดที่มี [title] ทุกใบ, ย้ายข้อความจาก title ไปไว้ในปุ่ม
// "ⓘ" เล็กๆ ที่มุมขวาบนของการ์ด (ลบ title ออกจาก element เดิมกันเบราว์เซอร์
// โชว์ tooltip ซ้อนสอง) กดปุ่มแล้วเด้ง popover ข้อความ — ใช้ stopPropagation
// กันไม่ให้ทริกเกอร์ event คลิกของการ์ด (เช่น data-jump) ไปพร้อมกัน
// ===========================================================

function buildInfoButton(card, text) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "cp-tap-info-btn";
  btn.setAttribute("aria-label", "ดูคำอธิบายเพิ่มเติม");
  btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-5"/><path d="M12 8h.01"/></svg>';

  const bubble = document.createElement("div");
  bubble.className = "cp-tap-info-bubble";
  bubble.textContent = text;
  bubble.style.display = "none";

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    e.preventDefault();
    const isOpen = bubble.style.display !== "none";
    closeAllBubbles();
    bubble.style.display = isOpen ? "none" : "block";
  });

  card.style.position = card.style.position || "relative";
  card.appendChild(btn);
  card.appendChild(bubble);
}

function closeAllBubbles() {
  document.querySelectorAll(".cp-tap-info-bubble").forEach(b => { b.style.display = "none"; });
}

document.addEventListener("click", closeAllBubbles);

document.querySelectorAll(".cp-stat-card[title]").forEach(card => {
  const text = card.getAttribute("title");
  if (!text) return;
  card.removeAttribute("title");
  buildInfoButton(card, text);
});
