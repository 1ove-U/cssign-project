// ===========================================================
// admin-overview-ui.js — UI-only enhancements for the "ภาพรวม" (Overview) tab:
//   1) collapsible sub-sections (ปิดโดยดีฟอลต์ ลดความรกของหน้า)
//   2) chart tab switcher (รายวัน / รายเดือน อยู่กล่องเดียวกัน)
// ไม่แตะข้อมูล/การ render ใดๆ ใน admin-page.js — ผูก event เพิ่มเติมเท่านั้น
// จึงแยกไฟล์ต่างหากเพื่อไม่ให้กระทบโค้ดเดิมที่ทดสอบแล้ว
// ===========================================================

function wireCollapsible(toggleId, wrapId, labelOn, labelOff) {
  const btn = document.getElementById(toggleId);
  const wrap = document.getElementById(wrapId);
  if (!btn || !wrap) return;
  btn.addEventListener("click", () => {
    const open = wrap.classList.toggle("is-open");
    btn.setAttribute("aria-expanded", open ? "true" : "false");
    const label = btn.querySelector("span");
    if (label) label.textContent = open ? (labelOff || "ซ่อน") : (labelOn || "แสดง");
  });
}

function wireChartTabs() {
  const tabs = document.getElementById("ov-chart-tabs");
  if (!tabs) return;
  const panels = {
    daily: document.getElementById("ov-chart-panel-daily"),
    monthly: document.getElementById("ov-chart-panel-monthly")
  };
  tabs.addEventListener("click", (e) => {
    const btn = e.target.closest(".cchart-tab");
    if (!btn) return;
    const which = btn.dataset.chartPanel;
    tabs.querySelectorAll(".cchart-tab").forEach(b => {
      const active = b === btn;
      b.classList.toggle("active", active);
      b.setAttribute("aria-selected", active ? "true" : "false");
    });
    Object.entries(panels).forEach(([key, el]) => {
      if (el) el.style.display = key === which ? "" : "none";
    });
  });
}

wireCollapsible("ov-content-toggle", "ov-content-stats-wrap", "แสดงสถิติ", "ซ่อนสถิติ");
wireCollapsible("ov-more-toggle", "ov-more-wrap", "แสดง", "ซ่อน");
wireChartTabs();
