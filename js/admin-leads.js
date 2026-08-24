// ===========================
// js/admin-leads.js — แท็บ "ลีด": ตาราง/ค้นหา/กรอง/pagination, mark-as-read อัตโนมัติ
// (bulk actions, การแก้ไขแถวเดียว, และโน้ตของทีมขาย ถูกแยกไปอยู่ js/admin-leads-actions.js
// แล้ว — ดูรายละเอียดที่หัวไฟล์นั้น)
//
// 2026 refactor phase 2: ย้ายมาจาก js/admin-page.js เดิม (ส่วน "LEADS" บรรทัด 1811-2236
// เดิม) แบบไม่เปลี่ยน behavior ใดๆ — เช็คด้วย diff กับต้นฉบับแล้วตรงทุกตัวอักษรยกเว้น
// จุดที่ตั้งใจแยกไฟล์ (import แทนการประกาศซ้ำ, เอา buildPageList ที่ย้ายไป
// admin-utils.js แล้วออก)
//
// 2026 refactor phase 5: ไฟล์นี้เดิมรวม bulk actions/การแก้ไขแถวเดียว/โน้ตของทีมขาย/
// mark-as-read ไว้ด้วย (505 บรรทัด) — แยกส่วน "Bulk actions" + "การแก้ไขแถวเดียว
// (สถานะ/ผู้รับผิดชอบ/ลบ)" + "โน้ตของทีมขาย" + "mark-as-read" ออกไปเป็น
// js/admin-leads-actions.js แล้ว (เว้นส่วนตัวกรอง/ค้นหาไว้ที่นี่เพราะเป็น filter core)
// ไฟล์นี้เหลือ: state ของแท็บ, listener realtime, ตัวกรอง/ค้นหา, pagination, renderLeads()
// — ไม่มีการเปลี่ยน logic ใดๆ จากของเดิม เป็นแค่ย้ายโค้ดเชิงโครงสร้าง
//
// เก็บ state ของแท็บนี้ไว้ในไฟล์นี้เอง (allLeads, leadsUnsub/leadsStarted,
// lStatusFilterValue, lCurrentPage) แล้ว export ส่วนที่ไฟล์อื่นต้องใช้:
//   - allLeads (`let` — live binding, อ่านได้จากไฟล์อื่นโดยตรงเหมือน admin-state.js)
//     ใช้โดย admin-overview-dashboard.js (การ์ดสรุป/กราฟ), admin-global-search.js
//     (ค้นข้ามแท็บ, ยังไม่สร้าง), admin-settings-team.js (เช็คว่าชื่อที่จะลบมีลีด
//     มอบหมายอยู่ไหม, ยังไม่สร้าง)
//   - startLeadsListener() — เรียกตอน login สำเร็จ (admin-page.js) และตอนสลับมาแท็บลีด
//     (switchTab() ใน admin-page.js)
//   - renderLeads(), fillAssigneeSelects() — admin-settings-team.js (ยังไม่สร้าง) ต้องเรียก
//     ทั้งคู่ทุกครั้งที่รายชื่อทีมงานเปลี่ยน (renderTeamSettings() เดิมเรียกทั้งสองตัวนี้ท้ายฟังก์ชัน)
//
// currentTeamMembers (dropdown "ผู้รับผิดชอบ") มาจาก admin-settings-team.js (ยังไม่สร้าง —
// จะ export เป็น `let` แบบเดียวกับ allLeads ตอนแยกไฟล์นั้น) — เป็น circular import กับ
// ไฟล์นั้นแบบเดียวกับที่ allLeads/switchTab เป็น circular import กับไฟล์อื่นอยู่แล้ว
// ปลอดภัยเพราะเรียกใช้ตอน event/listener ทำงานเท่านั้น ไม่ใช่ตอน module evaluate
//
// เพิ่มเติม (Phase 3, CRM automation): export `onNewLeadsArrived(cb)` — ให้
// admin-leads-automation.js ลงทะเบียนฟังก์ชัน auto-assign round-robin ที่จะถูกเรียกทุกครั้งที่
// มีลีด "ใหม่จริงๆ" เข้ามา (ไม่ใช่แค่ field ของลีดเดิมเปลี่ยน) และ export `getStaleLeadReminders
// (days)` — คืนลีดที่ยังไม่ปิดจบและไม่มีการอัปเดตโน้ต/สถานะเกิน `days` วัน ใช้ทั้งแสดง badge ใน
// ตารางที่นี่ และให้ admin-leads-automation.js ใช้ต่อได้ถ้าต้องการ
// ===========================
import { listenLeads } from "./db-orders.js";
import { errorStateHTML } from "./ui-helpers.js";
import { escapeHtml, avatarHtml, buildPageList } from "./admin-utils.js";
import { activeTab, pendingDeleteLeadIds } from "./admin-state.js";
import { renderOverview, renderNotifBell } from "./admin-overview-dashboard.js";
import { currentTeamMembers, leadReminderDays } from "./admin-settings-team.js";
// selectedLeadIds/updateLeadsBulkBar: circular import กับ admin-leads-actions.js (ปลอดภัย
// เพราะ renderLeads() อ่าน/เรียกทั้งคู่ตอน render เท่านั้น ไม่ใช่ตอน module evaluate)
import { selectedLeadIds, updateLeadsBulkBar } from "./admin-leads-actions.js";

export const lTableBody     = document.getElementById("ad-l-table-body");
export const lSearch        = document.getElementById("ad-l-search");
const lStatusPillsBox = document.getElementById("ad-l-filter-status-pills");
export const lFilterSource  = document.getElementById("ad-l-filter-source");
export const lFilterAssignee = document.getElementById("ad-l-filter-assignee");
const lBadge         = document.getElementById("ad-leads-badge");
const lPaginationBox  = document.getElementById("ad-l-pagination");
const lPaginationInfo = document.getElementById("ad-l-pagination-info");
const lPaginationBtns = document.getElementById("ad-l-pagination-btns");

export let allLeads = [];
let leadsUnsub = null;
let leadsStarted = false;
let lStatusFilterValue = ""; // "" = ทุกสถานะ, else key ของ LEAD_STATUS_LABEL
const LEADS_PAGE_SIZE = 10;
export let lCurrentPage = 1;
// setter สำหรับไฟล์นอก module นี้ (admin-global-search.js) — reassign import binding ตรงๆ ไม่ได้
export function setLCurrentPage(v) { lCurrentPage = v; }

// รู้ id ของลีดที่เคยเห็นแล้ว (ทุก snapshot ตั้งแต่เปิดหน้านี้) — ใช้แยกว่า snapshot ล่าสุด
// มีลีด "ใหม่จริงๆ" เข้ามากี่รายการ (ไม่ใช่แค่ field ของลีดเดิมเปลี่ยน) สำหรับ auto-assign
// round-robin (js/admin-leads-automation.js) — เก็บเป็น module-private ไว้ที่นี่เพราะผูกกับ
// listener ของไฟล์นี้โดยตรง ไม่ export ตรงๆ
let knownLeadIds = new Set();
// ให้ไฟล์อื่น (admin-leads-automation.js) ลงทะเบียนฟังก์ชันที่จะเรียกทุกครั้งที่มีลีดใหม่เข้ามาจริง
// (เรียกครั้งเดียวพอ แบบเดียวกับ onOrdersChanged ใน orders-tab.js — ไม่ใช่ array ของ subscriber
// หลายตัว เพราะโปรเจกต์นี้มีแค่จุดเดียวที่ต้องฟัง)
let onNewLeadsArrivedCb = null;
export function onNewLeadsArrived(cb) { onNewLeadsArrivedCb = cb; }

// export เพราะ admin-overview-dashboard.js ต้องใช้ label ชุดเดียวกันตอนแสดงการ์ด
// "อัตราปิดการขายแยกตามช่องทาง" — กันไม่ให้ต้องประกาศ label ซ้ำอีกชุดที่อาจไม่ตรงกัน
export const LEAD_SOURCE_LABEL = {
  quotation_modal: "ป๊อปอัพขอใบเสนอราคา",
  quotation_modal_contact: "ป๊อปอัพ (หน้าติดต่อ)",
  quotation_modal_portfolio: "ป๊อปอัพ (หน้าผลงาน)",
  inline_contact: "ฟอร์มหน้าแรก",
  contact_page_form: "ฟอร์มหน้าติดต่อ",
  catalog_download: "ดาวน์โหลดแคตตาล็อก",
  chat_widget: "แชท AI",
  exit_intent_cta: "ป๊อปอัพ Exit-intent"
};

export function startLeadsListener() {
  if (leadsStarted) return;
  leadsStarted = true;
  let firstSnapshot = true;
  leadsUnsub = listenLeads(
    (leads) => {
      // หา "ลีดใหม่จริงๆ" ก่อนเขียนทับ allLeads (เทียบกับ id ที่เคยเห็นแล้ว) — ข้าม snapshot
      // แรกสุดตอนเปิดหน้า เพราะลีดเก่าทั้งหมดจะนับเป็น "ใหม่" ไปหมดถ้าไม่ข้าม (จะทำให้ auto-assign
      // ไล่มอบหมายลีดเก่าที่ยังไม่มีผู้รับผิดชอบทั้งหมดทันทีที่เปิดหน้า ซึ่งไม่ใช่พฤติกรรมที่ต้องการ —
      // ต้องการแค่ "ลีดที่เพิ่งเข้ามาใหม่ระหว่างที่เปิดหน้าอยู่" เท่านั้น)
      const newlyArrived = firstSnapshot ? [] : leads.filter(l => !knownLeadIds.has(l.id));
      knownLeadIds = new Set(leads.map(l => l.id));
      firstSnapshot = false;

      allLeads = leads; fillSourceFilter(); fillAssigneeSelects(); renderLeads(); updateLeadsBadge(); renderNotifBell(); if (activeTab === "overview") renderOverview();

      if (newlyArrived.length && onNewLeadsArrivedCb) onNewLeadsArrivedCb(newlyArrived);
    },
    (err) => {
      lTableBody.innerHTML = `<tr><td colspan="11">${errorStateHTML(`โหลดข้อมูลไม่สำเร็จ: ${err.message || ""}`, retryLeadsListener, { wrapTag: "span" })}</td></tr>`;
    }
  );
}

// เรียกใหม่เมื่อกดปุ่ม "ลองใหม่" ตอนโหลดลีดล้มเหลว — เลิกฟัง listener เดิม (ถ้ามี) แล้วเริ่มใหม่
// โดยไม่ต้อง refresh ทั้งหน้า
function retryLeadsListener() {
  if (leadsUnsub) { leadsUnsub(); leadsUnsub = null; }
  leadsStarted = false;
  startLeadsListener();
}

function updateLeadsBadge() {
  const newCount = allLeads.filter(l => l.status === "new").length;
  if (newCount > 0) {
    lBadge.textContent = newCount;
    lBadge.style.display = "inline-flex";
  } else {
    lBadge.style.display = "none";
  }
  // Badge จำนวนลีดใหม่ที่ปุ่มแท็บ "ภาพรวม" ในไซด์บาร์ (นอกเหนือจากแท็บ "ลีด")
  const ovBadge = document.getElementById("ad-overview-badge");
  if (ovBadge) {
    if (newCount > 0) {
      ovBadge.textContent = newCount;
      ovBadge.style.display = "inline-flex";
    } else {
      ovBadge.style.display = "none";
    }
  }
}

function fillSourceFilter() {
  const current = lFilterSource.value;
  const sources = [...new Set(allLeads.map(l => l.source).filter(Boolean))];
  lFilterSource.innerHTML = `<option value="">ทุกช่องทาง</option>` +
    sources.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(LEAD_SOURCE_LABEL[s] || s)}</option>`).join("");
  lFilterSource.value = current;
}

// เติม dropdown "กรองตามผู้รับผิดชอบ" จากรายชื่อทีมงานใน settings (renderTeamSettings เรียกฟังก์ชันนี้
// ทุกครั้งที่รายชื่อทีมงานเปลี่ยน) — รวมชื่อที่ถูกมอบหมายไว้แล้วแต่ถูกลบออกจากรายชื่อทีมงานด้วย กันตัวเลือกหาย
export function fillAssigneeSelects() {
  if (!lFilterAssignee) return;
  const current = lFilterAssignee.value;
  const assignedNames = [...new Set(allLeads.map(l => l.assignee).filter(Boolean))];
  const names = [...new Set([...currentTeamMembers, ...assignedNames])];
  lFilterAssignee.innerHTML = `<option value="">ผู้รับผิดชอบทั้งหมด</option><option value="__unassigned__">— ยังไม่มอบหมาย —</option>` +
    names.map(n => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join("");
  lFilterAssignee.value = current;
}

function leadDateLabel(lead) {
  const ts = lead.createdAt;
  if (!ts) return "—";
  const ms = ts.toMillis ? ts.toMillis() : (typeof ts === "number" ? ts : null);
  if (!ms) return "—";
  return new Date(ms).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" });
}

// เวลาที่ "แตะ" ลีดล่าสุดจริง — ใช้ notesUpdatedAt ก่อน (ล่าสุดสุด ถ้ามี) ตามด้วย statusUpdatedAt
// แล้วค่อย fallback เป็น createdAt (ลีดที่ยังไม่เคยมีการอัปเดตอะไรเลยตั้งแต่สร้าง)
function leadLastActivityMs(lead) {
  const ts = lead.notesUpdatedAt || lead.statusUpdatedAt || lead.createdAt;
  if (!ts) return null;
  return ts.toMillis ? ts.toMillis() : (typeof ts === "number" ? ts : null);
}

// ลีดที่ "ค้าง" — ยังอยู่ระหว่างดำเนินการ (ไม่นับ new เพราะยังไม่มีใครแตะเป็นธรรมดา และไม่นับ
// won/lost เพราะปิดจบแล้ว) แต่ไม่มีการอัปเดตโน้ต/สถานะมาเกิน `days` วัน — ใช้ทั้งแสดง badge ใน
// ตารางลีด (renderLeads ด้านล่าง) และให้ admin-leads-automation.js ใช้แจ้งเตือนจากภายนอกไฟล์นี้ได้
export function getStaleLeadReminders(days) {
  if (!days || days <= 0) return [];
  const cutoffMs = Date.now() - days * 86400000;
  return allLeads.filter(l => {
    if (!["read", "replied"].includes(l.status)) return false;
    const lastMs = leadLastActivityMs(l);
    return lastMs !== null && lastMs < cutoffMs;
  });
}

export function setLeadStatusFilter(status) {
  lStatusFilterValue = status || "";
  lStatusPillsBox.querySelectorAll(".cp-status-pill").forEach(b => {
    const isActive = (b.dataset.status || "") === lStatusFilterValue;
    b.classList.toggle("active", isActive);
    b.setAttribute("aria-selected", isActive ? "true" : "false");
  });
}
lStatusPillsBox.querySelectorAll(".cp-status-pill").forEach(btn => {
  btn.addEventListener("click", () => {
    setLeadStatusFilter(btn.dataset.status);
    lCurrentPage = 1;
    renderLeads();
  });
});

function getFilteredLeads() {
  const term = (lSearch.value || "").trim().toLowerCase();
  const sourceFilter = lFilterSource.value;
  const assigneeFilter = lFilterAssignee ? lFilterAssignee.value : "";

  return allLeads.filter(l => {
    if (pendingDeleteLeadIds.has(l.id)) return false;
    if (lStatusFilterValue && (l.status || "new") !== lStatusFilterValue) return false;
    if (sourceFilter && l.source !== sourceFilter) return false;
    if (assigneeFilter === "__unassigned__" && l.assignee) return false;
    if (assigneeFilter && assigneeFilter !== "__unassigned__" && l.assignee !== assigneeFilter) return false;
    if (term) {
      const hay = [l.name, l.email, l.tel, l.phone, l.company, l.service, l.message]
        .filter(Boolean).join(" ").toLowerCase();
      if (!hay.includes(term)) return false;
    }
    return true;
  });
}

function renderLeadsPagination(totalRows) {
  const totalPages = Math.max(1, Math.ceil(totalRows / LEADS_PAGE_SIZE));
  if (lCurrentPage > totalPages) lCurrentPage = totalPages;
  if (lCurrentPage < 1) lCurrentPage = 1;

  if (!totalRows) {
    lPaginationBox.style.display = "none";
    return;
  }
  lPaginationBox.style.display = "flex";

  const start = (lCurrentPage - 1) * LEADS_PAGE_SIZE + 1;
  const end = Math.min(totalRows, lCurrentPage * LEADS_PAGE_SIZE);
  lPaginationInfo.textContent = `แสดง ${start}–${end} จาก ${totalRows} รายการ`;

  const pages = buildPageList(lCurrentPage, totalPages);
  lPaginationBtns.innerHTML = `
    <button class="cp-page-btn cp-page-nav" data-page="prev" ${lCurrentPage === 1 ? "disabled" : ""} aria-label="หน้าก่อนหน้า">‹</button>
    ${pages.map(p => p === "…"
      ? `<span class="cp-page-ellipsis">…</span>`
      : `<button class="cp-page-btn ${p === lCurrentPage ? "active" : ""}" data-page="${p}">${p}</button>`
    ).join("")}
    <button class="cp-page-btn cp-page-nav" data-page="next" ${lCurrentPage === totalPages ? "disabled" : ""} aria-label="หน้าถัดไป">›</button>
  `;
  lPaginationBtns.querySelectorAll(".cp-page-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      if (btn.disabled) return;
      if (btn.dataset.page === "prev") lCurrentPage = Math.max(1, lCurrentPage - 1);
      else if (btn.dataset.page === "next") lCurrentPage = Math.min(totalPages, lCurrentPage + 1);
      else lCurrentPage = Number(btn.dataset.page);
      renderLeads();
      lTableBody.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  });
}

export function renderLeads() {
  const filtered = getFilteredLeads();

  if (!filtered.length) {
    lTableBody.innerHTML = `<tr><td colspan="11" class="cp-empty">ไม่พบรายการลีด</td></tr>`;
    renderLeadsPagination(0);
    updateLeadsBulkBar();
    return;
  }

  renderLeadsPagination(filtered.length);
  const pageStart = (lCurrentPage - 1) * LEADS_PAGE_SIZE;
  const pageRows = filtered.slice(pageStart, pageStart + LEADS_PAGE_SIZE);
  // คำนวณครั้งเดียวต่อการ render (ไม่ใช่ต่อแถว) — กันวนลูป allLeads ซ้ำทุกแถวโดยไม่จำเป็น
  const staleIds = new Set(getStaleLeadReminders(leadReminderDays).map(l => l.id));

  lTableBody.innerHTML = pageRows.map(l => {
    const status = l.status || "new";
    const phone = l.tel || l.phone || "—";
    const nameLine = `<div class="cp-namecell">${avatarHtml(l.name || l.email || "?")}<div class="cp-namecell-text"><span class="cp-namecell-name">${escapeHtml(l.name || "—")}</span>${l.company ? `<span class="cp-subtext">${escapeHtml(l.company)}</span>` : ""}</div></div>`;
    const contactLine = `${escapeHtml(phone)}` + (l.email ? `<br><span class="cp-subtext">${escapeHtml(l.email)}</span>` : "");
    const message = l.message ? escapeHtml(l.message).slice(0, 140) + (l.message.length > 140 ? "…" : "") : "—";
    const sourceLabel = escapeHtml(LEAD_SOURCE_LABEL[l.source] || l.source || "—");
    // เตือนว่าลีดนี้ค้างมานาน — ไม่มีการอัปเดตโน้ต/สถานะเกิน N วัน (ตั้งค่าได้ที่หน้าตั้งค่า
    // ทีมงาน) แสดงเป็นไอคอนเล็กๆ ต่อจาก dropdown สถานะ กดแล้วไม่ต้องทำอะไร แค่เตือนสายตา
    const staleBadge = staleIds.has(l.id)
      ? `<span class="ad-l-stale-badge" title="ลีดนี้ยังไม่มีการอัปเดตโน้ต/สถานะมาเกิน ${leadReminderDays} วัน">⏰ ค้างนาน</span>`
      : "";
    return `
      <tr data-id="${l.id}" class="ad-l-row ${status === "new" ? "ad-l-row-new" : ""}">
        <td><input type="checkbox" class="cp-row-check ad-l-row-check" data-id="${l.id}" ${selectedLeadIds.has(l.id) ? "checked" : ""} aria-label="เลือกลีดนี้"></td>
        <td class="cp-subtext">${leadDateLabel(l)}</td>
        <td>${nameLine}</td>
        <td>${contactLine}</td>
        <td>${escapeHtml(l.service || "—")}</td>
        <td class="ad-l-msg">${message}</td>
        <td class="cp-subtext">${sourceLabel}</td>
        <td>
          <select class="cp-status-select ad-l-status" data-id="${l.id}" data-status="${status}">
            <option value="new" ${status === "new" ? "selected" : ""}>ใหม่</option>
            <option value="read" ${status === "read" ? "selected" : ""}>อ่านแล้ว</option>
            <option value="replied" ${status === "replied" ? "selected" : ""}>ติดต่อแล้ว</option>
            <option value="won" ${status === "won" ? "selected" : ""}>ปิดการขายได้</option>
            <option value="lost" ${status === "lost" ? "selected" : ""}>ไม่สำเร็จ</option>
          </select>
          ${staleBadge}
        </td>
        <td>
          <select class="cp-status-select ad-l-assignee" data-id="${l.id}">
            <option value="">— ยังไม่มอบหมาย —</option>
            ${currentTeamMembers.map(name => `<option value="${escapeHtml(name)}" ${l.assignee === name ? "selected" : ""}>${escapeHtml(name)}</option>`).join("")}
            ${l.assignee && !currentTeamMembers.includes(l.assignee) ? `<option value="${escapeHtml(l.assignee)}" selected>${escapeHtml(l.assignee)} (ไม่อยู่ในรายชื่อทีมงานแล้ว)</option>` : ""}
          </select>
        </td>
        <td>
          <button type="button" class="cp-icon-text-btn ad-l-notes-btn" data-id="${l.id}" title="ดู/บันทึกโน้ต">
            📝${l.notes ? ` <span class="ad-l-notes-dot" title="มีโน้ตแล้ว"></span>` : ""}
          </button>
        </td>
        <td>
          <button class="cp-icon-btn danger ad-l-delete" data-id="${l.id}" title="ลบ">✕</button>
        </td>
      </tr>`;
  }).join("");
  updateLeadsBulkBar();
}

lSearch.addEventListener("input", () => { lCurrentPage = 1; renderLeads(); });
lFilterSource.addEventListener("change", () => { lCurrentPage = 1; renderLeads(); });
if (lFilterAssignee) lFilterAssignee.addEventListener("change", () => { lCurrentPage = 1; renderLeads(); });

