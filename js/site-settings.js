// ===========================
// js/site-settings.js
// ดึงข้อมูลติดต่อ (เบอร์โทร/LINE/อีเมล/ที่อยู่/Facebook) จาก Firestore
// แล้วอัปเดตให้ตรงกันทุกจุดในหน้านี้ทันที — โดยไม่ต้องแก้ HTML เดิมทีละหน้า
//
// วิธีทำงาน: ค่าที่ hardcode ไว้ในทุกหน้าเป็น "ค่าเริ่มต้น" เดียวกันหมด
// สคริปต์นี้จะหาตำแหน่งที่ตรงกับค่าเริ่มต้นเหล่านั้น (href และ text) แล้วแทนที่
// ด้วยค่าล่าสุดจากแอดมิน ถ้าแอดมินยังไม่เคยตั้งค่าอะไรเลย หน้าเว็บจะแสดงค่าเดิมตามปกติ
// ===========================
import { getSettings } from "./db.js";

const DEFAULTS = {
  phoneRaw:    "0628833880",
  phone:       "062-883-3880",
  phone2:      "063-978-5670",
  fax:         "02-115-0850",
  email:       "cssigngroup@gmail.com",
  lineUrl:     "https://line.me/ti/p/@cssigngroup",
  lineHandle:  "@cssigngroup",
  facebookUrl: "https://www.facebook.com/cssignonline/",
  address:     "17 ซอยบางกระดี่ 1 แขวงแสมดำ เขตบางขุนเทียน กรุงเทพมหานคร 10150"
};

// ดึง "@handle" จาก URL รูปแบบ https://line.me/ti/p/@xxxxx เพื่อเอาไปแทนที่
// ข้อความ "@cssigngroup" ที่โผล่เป็น plain text อยู่หลายจุด (footer, chat widget,
// ป๊อปอัปขอใบเสนอราคา, ปุ่ม "แอด LINE @cssigngroup" ในหน้า blog) — เดิม script นี้
// อัปเดตแค่ href ของลิงก์ + รูป QR แต่ไม่เคยแตะข้อความที่มองเห็น ทำให้ถ้าแอดมินเปลี่ยน
// ลิงก์ LINE ในหน้าตั้งค่า ลิงก์จะไปที่บัญชีใหม่ถูกต้อง แต่ตัวหนังสือที่ลูกค้าเห็นยังเป็น
// ไอดีเก่าอยู่ ไม่ตรงกับปลายทางจริงของลิงก์
function extractLineHandle(url) {
  const m = String(url || "").match(/\/p\/(%40|@)([^/?#]+)/i);
  if (!m) return "";
  try { return "@" + decodeURIComponent(m[2]); }
  catch { return "@" + m[2]; }
}

function digitsOnly(s) { return String(s || "").replace(/[^\d]/g, ""); }

function applySettings(settings) {
  if (!settings) return;

  const phone       = settings.phone || "";
  const phone2      = settings.phone2 || "";
  const fax         = settings.fax || "";
  const email       = settings.email || "";
  const lineUrl     = settings.lineUrl || "";
  const facebookUrl = settings.facebookUrl || "";
  const address     = settings.address || "";

  const phoneRaw = phone ? digitsOnly(phone) : "";
  const lineHandle = lineUrl ? extractLineHandle(lineUrl) : "";

  // ── href="tel:..." ──
  if (phoneRaw) {
    document.querySelectorAll(`a[href="tel:${DEFAULTS.phoneRaw}"]`).forEach(a => {
      a.setAttribute("href", `tel:${phoneRaw}`);
    });
  }

  // ── href="mailto:..." ──
  if (email) {
    document.querySelectorAll(`a[href="mailto:${DEFAULTS.email}"]`).forEach(a => {
      a.setAttribute("href", `mailto:${email}`);
    });
  }

  // ── LINE link ──
  if (lineUrl) {
    document.querySelectorAll(`a[href="${DEFAULTS.lineUrl}"]`).forEach(a => {
      a.setAttribute("href", lineUrl);
    });
    // QR code image ที่ฝังลิงก์ LINE ไว้ใน query string (popup ขอใบเสนอราคา)
    document.querySelectorAll('img[src*="qrserver.com"][src*="line.me"]').forEach(img => {
      const encoded = encodeURIComponent(lineUrl);
      img.src = img.src.replace(/data=[^&]+/, `data=${encoded}`);
      if (lineHandle && img.alt) img.alt = img.alt.split(DEFAULTS.lineHandle).join(lineHandle);
    });
  }

  // ── Facebook link ──
  if (facebookUrl) {
    document.querySelectorAll(`a[href="${DEFAULTS.facebookUrl}"]`).forEach(a => {
      a.setAttribute("href", facebookUrl);
    });
  }

  // ── ข้อความที่แสดงเบอร์โทร/แฟกซ์/อีเมล/ที่อยู่ — เดิน text node ทั้งหน้าแล้วแทนที่ ──
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
  const nodes = [];
  let n;
  while ((n = walker.nextNode())) nodes.push(n);

  nodes.forEach(node => {
    let text = node.nodeValue;
    if (!text || !text.trim()) return;
    let changed = false;

    if (phone && text.includes(DEFAULTS.phone)) {
      text = text.split(DEFAULTS.phone).join(phone);
      changed = true;
    }
    if (phone2 && text.includes(DEFAULTS.phone2)) {
      text = text.split(DEFAULTS.phone2).join(phone2);
      changed = true;
    }
    if (fax && text.includes(DEFAULTS.fax)) {
      text = text.split(DEFAULTS.fax).join(fax);
      changed = true;
    }
    if (email && text.includes(DEFAULTS.email)) {
      text = text.split(DEFAULTS.email).join(email);
      changed = true;
    }
    if (address && text.includes(DEFAULTS.address)) {
      text = text.split(DEFAULTS.address).join(address);
      changed = true;
    }
    if (lineHandle && text.includes(DEFAULTS.lineHandle)) {
      text = text.split(DEFAULTS.lineHandle).join(lineHandle);
      changed = true;
    }

    if (changed) node.nodeValue = text;
  });

  // ── แอตทริบิวต์ value/placeholder/alt ที่อาจมีเบอร์ผูกอยู่ (data-* ปุ่มโทรลัด ฯลฯ) ──
  document.querySelectorAll("[data-site-phone]").forEach(el => { if (phone) el.textContent = phone; });
  document.querySelectorAll("[data-site-email]").forEach(el => { if (email) el.textContent = email; });
  document.querySelectorAll("[data-site-address]").forEach(el => { if (address) el.textContent = address; });
}

getSettings()
  .then(settings => applySettings(settings))
  .catch(err => console.warn("[site-settings] โหลดข้อมูลติดต่อไม่สำเร็จ ใช้ค่าเริ่มต้นในหน้าแทน:", err));
