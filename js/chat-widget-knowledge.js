// ===========================
// js/chat-widget-knowledge.js — สร้าง "ข้อมูลปัจจุบันจากเว็บไซต์" (system prompt knowledge
// block) ที่ป้อนให้ AI chat widget จาก Firestore จริง (ราคา/สต็อกสินค้า, หมวดหมู่, FAQ,
// ผลงาน, ข้อมูลติดต่อบริษัท) แทนที่จะ hardcode
//
// 2026 refactor phase 19: แยกออกจาก js/chat-widget.js เดิม (369 บรรทัด) — ย้าย
// STATIC_FALLBACK_KNOWLEDGE/SYSTEM_RULES/formatPrice/buildKnowledgeBlock ออกมาแบบ diff เป๊ะ
// ไม่เปลี่ยน logic ใดๆ — ไฟล์นี้ไม่มี state ที่ reassign ข้ามไฟล์ (buildKnowledgeBlock คืนค่า
// เป็น Promise<string> ใหม่ทุกครั้งที่เรียก ไม่ได้แชร์ตัวแปรกับ chat-widget.js เลย
// chat-widget.js เป็นฝ่ายเก็บผลลัพธ์ไว้เองในตัวแปร knowledgePromise ของตัวเอง) จึงไม่ต้องมี
// setter ใดๆ — import แบบทางเดียว (chat-widget.js → ไฟล์นี้) ไม่มี circular import
// ===========================
import { getProducts } from "./db-products.js";
import { getCategories } from "./db-taxonomy.js";
import { getFaqs, getPortfolios } from "./db-content.js";
import { getSettings } from "./db-settings.js";

/* ── system prompt ──
   Split in two: a fixed instruction block (rules never change),
   plus a live "ข้อมูลปัจจุบันจากเว็บไซต์" block rebuilt from real
   Firestore data every time the page loads (see buildKnowledgeBlock
   below) — company contact info, the real product catalog with
   current prices, real FAQ answers, and recent project references —
   so the bot answers off what's actually published on the site
   right now instead of a snapshot that goes stale the moment an
   admin edits something in admin.html. If Firestore can't be
   reached (offline, blocked, first paint before data loads), it
   falls back to this static block so the bot still works. */
var STATIC_FALLBACK_KNOWLEDGE = `ข้อมูลบริษัท:
- ที่อยู่: 17 ซอยบางกระดี่ 1 แขวงแสมดำ เขตบางขุนเทียน กรุงเทพฯ 10150
- โทร: 062-883-3880, 063-978-5670
- โทรสาร (Fax): 02-115-0850
- อีเมล: cssigngroup@gmail.com
- LINE: @cssigngroup
- Facebook: facebook.com/cssignonline

มาตรฐาน: มอก., มาตรฐานกรมทางหลวง (DOH Standard) — ดูรายละเอียดที่หน้านโยบายคุณภาพ
สินค้า: ป้ายความปลอดภัย, ป้ายจราจรสะท้อนแสง, ป้ายโรงงานอุตสาหกรรม, กรวยจราจร, แบริเออร์, เสาล้มลุก, Custom Order พร้อม Artwork ฟรี
บริการ: สำรวจพื้นที่ฟรี, ออกแบบ Artwork ฟรี, ผลิต, ติดตั้ง, ออกใบกำกับภาษีเต็มรูปแบบ
ราคาตัวอย่าง: กรวยจราจร เริ่ม ฿350/ชิ้น, เสาล้มลุก เริ่ม ฿280/ชิ้น — สินค้าอื่น ขอใบเสนอราคา
ระยะเวลา: สต็อก 1-3 วัน, Custom 5-10 วันทำการ
(หมายเหตุ: นี่คือข้อมูลสำรอง ระบบไม่สามารถโหลดข้อมูลล่าสุดจากเว็บไซต์ได้ในขณะนี้ — ห้ามอ้างชื่อลูกค้าหรือใบรับรองใดๆ ที่ไม่ได้อยู่ในข้อมูลนี้)`;

export var SYSTEM_RULES = `คุณคือผู้ช่วยขายของ CS.SIGN (บริษัท ซีเอส.ไซน์ แอนด์ โปรดักส์ จำกัด)
ผู้ผลิตป้ายจราจรและป้ายความปลอดภัยครบวงจร ประสบการณ์ 20+ ปี

กฎ:
- ใช้ "ข้อมูลปัจจุบันจากเว็บไซต์" ด้านล่างเป็นแหล่งความจริงหลักเสมอ เพราะดึงมาจากฐานข้อมูลจริงของเว็บไซต์ตอนนี้ ถ้าข้อมูลในนั้นขัดกับความรู้เดิมของคุณ ให้เชื่อข้อมูลด้านล่างนี้แทน
- คุณคือ AI ผู้ช่วย ไม่ใช่พนักงานจริง หากลูกค้าถามว่าคุยกับคนหรือ AI หรือขอคุยกับพนักงาน/คนจริง ให้ตอบตรงไปตรงมาว่าคุณเป็น AI ผู้ช่วยตอบคำถามเบื้องต้น และแนะนำให้ติดต่อทีมขายจริงผ่านช่องทางที่ระบุไว้ด้านล่าง
- ตอบเป็นภาษาไทยเสมอ สั้นกระชับ เป็นมิตร เป็นมืออาชีพ
- ถ้าไม่แน่ใจในราคาหรือรายละเอียด หรือเป็นเรื่องที่ต้องใช้ดุลยพินิจ/เจรจา (เช่น ราคาต่อรอง เงื่อนไขพิเศษ) หรือสินค้าที่ไม่มีอยู่ในรายการด้านล่าง ให้แนะนำติดต่อพนักงานขายจริง หรือขอใบเสนอราคาแทนการเดาคำตอบ
- ห้ามแต่งข้อมูลที่ไม่รู้ หรือไม่มีอยู่ใน "ข้อมูลปัจจุบันจากเว็บไซต์" ด้านล่าง โดยเฉพาะราคาและสเปกสินค้า
- ตอบสูงสุด 3-4 ประโยค ยกเว้นถ้าถูกถามให้อธิบายละเอียด
- ถ้าลูกค้าทักทายหรือพูดคุยเล็กน้อยที่ไม่เกี่ยวกับธุรกิจ (เช่น ทายทัก ถามสภาพอากาศ ชวนคุยเล่น) ตอบรับแบบสุภาพสั้นๆได้ แต่ให้วกกลับมาที่สินค้า/บริการของ CS.SIGN เสมอในประโยคถัดไป
- ถ้าลูกค้าถามเรื่องที่ไม่เกี่ยวข้องกับ CS.SIGN เลยและไม่ใช่การพูดคุยทั่วไป (เช่น ขอให้แต่งเรื่อง ทำการบ้าน ถามความรู้ทั่วไปที่ไม่เกี่ยวกับป้าย) ให้ตอบสุภาพว่าช่วยเรื่องนี้ไม่ได้ และแนะนำให้ถามเกี่ยวกับป้ายความปลอดภัย/ป้ายจราจร หรือบริการของ CS.SIGN แทน

ข้อมูลปัจจุบันจากเว็บไซต์:
`;

/* ── build the live knowledge block from Firestore (products,
   categories, FAQs, settings, recent projects). Runs once per page
   load, in parallel with the rest of the page, cached in a promise
   so askBot() only ever waits on it the first time it's needed. ── */
function formatPrice(price, unit) {
  var num = Number(price);
  if (!price || isNaN(num) || num <= 0) return 'สอบถามราคา';
  return '฿' + num.toLocaleString('th-TH') + (unit ? '/' + unit : '');
}

export function buildKnowledgeBlock() {
  return Promise.all([
    getSettings().catch(function () { return null; }),
    getProducts().catch(function () { return []; }),
    getCategories().catch(function () { return []; }),
    getFaqs().catch(function () { return []; }),
    getPortfolios().catch(function () { return []; })
  ]).then(function (results) {
    var settings = results[0], products = results[1] || [], categories = results[2] || [],
        faqs = results[3] || [], portfolios = results[4] || [];

    var parts = [];

    /* ── contact info: live settings, falling back per-field to the
       same defaults used sitewide (see js/site-settings.js) ── */
    var s = settings || {};
    parts.push('ข้อมูลติดต่อบริษัท:\n' +
      '- ที่อยู่: ' + (s.address || '17 ซอยบางกระดี่ 1 แขวงแสมดำ เขตบางขุนเทียน กรุงเทพฯ 10150') + '\n' +
      '- โทร: ' + (s.phone || '062-883-3880') + (s.phone2 ? ', ' + s.phone2 : '') + '\n' +
      '- โทรสาร: ' + (s.fax || '02-115-0850') + '\n' +
      '- อีเมล: ' + (s.email || 'cssigngroup@gmail.com') + '\n' +
      '- LINE: ' + (s.lineUrl || '@cssigngroup') + '\n' +
      '- Facebook: ' + (s.facebookUrl || 'facebook.com/cssignonline'));

    /* ── catalog: only currently-published ("active") products,
       same filter products.js itself uses for the public product
       grid, so the bot never quotes a draft/hidden item ── */
    var catNames = {};
    categories.forEach(function (c) { catNames[c.id] = c.name; });
    var live = products.filter(function (p) { return (p.status || 'active') === 'active'; });
    if (live.length) {
      var MAX_ITEMS = 60;
      var lines = live.slice(0, MAX_ITEMS).map(function (p) {
        var cat = catNames[p.cat_id] ? ' [' + catNames[p.cat_id] + ']' : '';
        return '- ' + p.name + cat + ': ' + formatPrice(p.price, p.unit) +
          (p.material ? ' | วัสดุ: ' + p.material : '') +
          (p.size ? ' | ขนาด: ' + p.size : '');
      });
      var more = live.length > MAX_ITEMS ? '\n(และสินค้าอื่นอีก ' + (live.length - MAX_ITEMS) + ' รายการ ดูทั้งหมดได้ที่หน้าสินค้าบนเว็บไซต์)' : '';
      parts.push('รายการสินค้าปัจจุบัน (' + live.length + ' รายการ):\n' + lines.join('\n') + more);
    }

    /* ── FAQs: real question/answer pairs maintained by the admin ── */
    if (faqs.length) {
      var faqLines = faqs.map(function (f) { return 'ถาม: ' + f.question + '\nตอบ: ' + f.answer; });
      parts.push('คำถามที่พบบ่อย (FAQ):\n' + faqLines.join('\n\n'));
    }

    /* ── recent projects: a short list of client names/categories
       only — enough to answer "เคยทำให้ใครบ้าง" without dumping
       full case-study copy into the prompt ── */
    if (portfolios.length) {
      var clients = portfolios
        .map(function (p) { return p.client; })
        .filter(function (c, i, arr) { return c && arr.indexOf(c) === i; })
        .slice(0, 20);
      if (clients.length) {
        parts.push('ลูกค้า/โครงการที่เคยทำ (ตัวอย่าง): ' + clients.join(', '));
      }
    }

    return parts.length ? parts.join('\n\n') : STATIC_FALLBACK_KNOWLEDGE;
  }).catch(function () {
    return STATIC_FALLBACK_KNOWLEDGE;
  });
}
