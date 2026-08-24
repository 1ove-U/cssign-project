// ===========================
// js/ui-stats-widgets.js — สถิติแดชบอร์ด: snapshot รายเดือน + ป้ายแนวโน้ม + sparkline
// แยกออกมาจาก js/ui-helpers.js
//
// 2026 refactor phase 10: แยกส่วน "สถิติแดชบอร์ด" (monthlySnapshotUpdate()/renderTrendBadge()/
// renderSparkline()) ออกมาทั้งหมดแบบ diff เป๊ะ ไม่มีเปลี่ยน logic — เป็นจุดตัดที่สะอาดเพราะ
// ทั้ง 3 ฟังก์ชันนี้ไม่แตะ state ของกลุ่ม dialog/form (confirmOverlay/retryHandlers/
// _allGuardTrackers) เลยสักตัว และไม่มีฟังก์ชันกลุ่มนั้นเรียกกลับมาใช้ 3 ฟังก์ชันนี้ด้วย —
// ui-helpers.js ที่เหลือคือ confirmDialog/errorStateHTML/emptyStateHTML/inline form
// validation/unsaved-changes guard/showUndoToast
//
// renderSparkline/renderTrendBadge ยัง re-export กลับจาก ui-helpers.js ด้วย (ดูท้ายไฟล์นั้น)
// เพื่อให้ admin-overview-dashboard.js/orders-tab-stats.js ที่เคย import จาก ui-helpers.js เดิม
// ไม่ต้องแก้ไฟล์ — monthlySnapshotUpdate ไม่มีไฟล์ไหนเรียกใช้จริงแล้ว (ถูกแทนที่ด้วยแนวทางของ
// stats-trends.js ไปแล้ว ตามคอมเมนต์เดิมใน ui-helpers.js/admin-overview-dashboard.js) แต่ยังคง
// export ไว้เผื่อใช้ในอนาคต (ตามที่คอมเมนต์เดิมระบุ) ไม่ได้ลบทิ้ง
// ===========================
import { trendDirection } from "./stats-trends.js";

// ── สถิติแดชบอร์ด: snapshot รายเดือนใน localStorage (ใช้ทั้งภาพรวมเนื้อหาเว็บไซต์
//    และสถิติคำสั่งผลิต) เพื่อคำนวณ % เทียบเดือนก่อน และเก็บ history จริงสำหรับ sparkline
//    (ไม่ใช่ตัวเลขสุ่ม — มาจากค่าที่บันทึกไว้จริงทุกเดือนที่เปิดแดชบอร์ด) ──
export function monthlySnapshotUpdate(storageKey, counts) {
  let snap;
  try { snap = JSON.parse(localStorage.getItem(storageKey) || "{}"); } catch { snap = {}; }
  const monthKeyOf = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
  const now = new Date();
  const curKey = monthKeyOf(now);
  const prevKey = monthKeyOf(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  snap[curKey] = counts;
  try { localStorage.setItem(storageKey, JSON.stringify(snap)); } catch { /* ignore quota/private mode errors */ }

  const prev = snap[prevKey];
  const monthKeys = Object.keys(snap).sort();
  const trends = {};
  const history = {};
  Object.keys(counts).forEach(k => {
    if (!prev || prev[k] == null) { trends[k] = null; }
    else {
      const cur = counts[k], old = prev[k];
      trends[k] = old === 0 ? (cur === 0 ? 0 : 100) : Math.round(((cur - old) / old) * 100);
    }
    history[k] = monthKeys.map(mk => snap[mk] ? snap[mk][k] : null).filter(v => typeof v === "number").slice(-6);
  });
  return { trends, history };
}

// ── ป้ายทิศทางแนวโน้มแบบอ่านง่าย (🔼 เติบโต / ▶️ ทรงตัว / 🔽 ลดลง) ──
// ใช้ moving average 3 ช่วงล่าสุดจาก js/stats-trends.js (ไม่ใช่แค่เทียบ 2 จุด) เพื่อกัน
// การตีความผิดจากช่วงเดียวที่ผิดปกติ — แทนที่ ovRenderTrend/renderSalesTrendBadge แบบเดิม
// ที่โชว์แค่ "+12%" ลอยๆ จาก % เทียบเดือนก่อนตรงๆ

/**
 * @param {HTMLElement} el       element ที่จะใส่ป้าย (คลาส .cp-stat-trend)
 * @param {number[]} series      อนุกรมค่าตามลำดับเวลา (เก่า→ใหม่) เช่น stats.monthly.revenue
 * @param {Object} [opts]
 * @param {string} [opts.title]  ข้อความ title เพิ่มเติม (เช่น ตัวเลขจริงเทียบเดือนก่อน)
 */
export function renderTrendBadge(el, series, opts = {}) {
  if (!el) return;
  const t = trendDirection(series);
  if (t.pct == null) {
    el.className = "cp-stat-trend na";
    el.innerHTML = "";
    el.title = opts.title || "";
    return;
  }
  const cls = t.dir === "up" ? "up" : t.dir === "down" ? "down" : "flat";
  const sign = t.pct > 0 ? "+" : "";
  el.className = "cp-stat-trend " + cls;
  el.innerHTML = `<span class="cp-trend-emoji" aria-hidden="true">${t.icon}</span><span>${sign}${t.pct}%</span>`;
  el.title = (opts.title ? opts.title + " — " : "") + `แนวโน้ม: ${t.label} (เทียบค่าเฉลี่ยเคลื่อนที่ 3 ช่วงล่าสุด)`;
}

/** วาด sparkline (เส้นแนวโน้ม) จากค่าจริงใน history — ถ้ามีข้อมูลไม่ถึง 2 จุด จะซ่อนไว้เฉยๆ */
export function renderSparkline(svgEl, values) {
  if (!svgEl) return;
  const pts = (values || []).filter(v => typeof v === "number");
  if (pts.length < 2) { svgEl.classList.add("is-empty"); svgEl.innerHTML = ""; return; }
  svgEl.classList.remove("is-empty");
  const min = Math.min(...pts), max = Math.max(...pts);
  const flat = max === min;
  const span = flat ? 1 : (max - min);
  const stepX = 100 / (pts.length - 1);
  const coords = pts.map((v, i) => {
    const x = Math.round(i * stepX * 10) / 10;
    const y = flat ? 13 : Math.round((3 + (1 - (v - min) / span) * 20) * 10) / 10;
    return { x, y };
  });
  const pointsStr = coords.map(c => c.x + "," + c.y).join(" ");
  // พื้นที่ใต้เส้น (fill จางๆ ไล่ถึง baseline) — ให้การ์ดสถิติดูเป็นกราฟการเงินสมัยใหม่
  // มากขึ้น แทนที่จะเป็นแค่เส้นลอยๆ; สีของ fill ผูกกับสี stroke เดิมผ่าน CSS
  // (.cp-stat-card.warn/.danger/.good .spark-fill) จึงไม่ต้องแก้ logic การเลือกสีที่นี่
  const fillPoints = `0,26 ${pointsStr} 100,26`;
  svgEl.innerHTML = `<polygon class="spark-fill" points="${fillPoints}"/><polyline class="spark-line" points="${pointsStr}"/>`;
}
