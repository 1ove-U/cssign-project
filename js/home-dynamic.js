// ===========================
// js/home-dynamic.js — หน้าแรกเท่านั้น (ส่วนที่ 1/2)
// แสดงบทความล่าสุด จากข้อมูลที่แอดมินกรอกไว้ (Firestore) ถ้ายังไม่มีข้อมูล
// จะปล่อยให้เนื้อหาเริ่มต้นในหน้า (hardcode) แสดงตามเดิม
//
// 2026 refactor: ไฟล์นี้เดิมรวมทุก section ของหน้าแรกไว้ในไฟล์เดียว (862 บรรทัด)
// ถูกแยกเป็น 2 ไฟล์ตามความรับผิดชอบ:
//   - home-dynamic.js (ไฟล์นี้): บทความล่าสุด
//   - home-dynamic-showcase.js (ไฟล์ใหม่): สินค้าแนะนำ, ผลงานเด่น, โปรโมชั่น/ข่าว, วิดีโอแนะนำสินค้า
// escapeHtml() และ fadeSwap() ใช้ร่วมกันหลายไฟล์ จึง export จากที่นี่ให้ home-dynamic-showcase.js/
// home-dynamic-showcase-video.js import กลับไปใช้ (one-way import ปกติ ไม่ใช่ circular — ไฟล์นี้
// ไม่ import อะไรกลับจากสองไฟล์นั้นเลย)
//
// 2026 refactor phase 23: แยกส่วน "โลโก้พาร์ทเนอร์/ลูกค้า + รีวิว" (renderPartnerLogos,
// circleTileHTML/fillRowHTML/renderClientLogos, renderTestimonials/injectReviewSchema) ออกไปเป็น
// js/home-dynamic-social.js (ใหม่) แบบ diff เป๊ะ ไม่มีเปลี่ยน logic — escapeHtml/fadeSwap ยัง
// export จากไฟล์นี้เหมือนเดิม (ไม่ย้าย เพราะ home-dynamic-showcase.js/home-dynamic-showcase-video.js
// import จากที่นี่อยู่แล้ว ไม่อยากแก้ import ในไฟล์ที่ไม่เกี่ยวข้องกับรอบนี้)
//
// 2026 refactor phase 25: ตรวจแล้วพบว่า #home-faq-grid/#home-partner-logos/.logo-marquee-track/
// #testi-track ไม่มีอยู่ใน index.html/en/index.html เลย — เอา renderFaqs()/bindFaqAccordion()
// ออกจากไฟล์นี้ (ใช้แค่ id ที่ไม่มีอยู่จริง)
//
// 2026 refactor: ลบ section "ลูกค้าของเรา / โลโก้ลูกค้า / ประสบการณ์ร่วมงานกับธุรกิจชั้นนำ"
// (#our-clients) ออกจาก index.html/en/index.html ตามคำขอ — js/home-dynamic-social.js
// (renderClientLogos/circleTileHTML/fillRowHTML) ที่เคยเรนเดอร์ section นี้จึงไม่มีเป้าหมายให้
// ทำงานอีกต่อไป ลบไฟล์นั้นทิ้งทั้งไฟล์ พร้อมทั้ง import/เรียกใช้ในไฟล์นี้ด้วย
// ===========================
import { getBlogs } from "./db-blog.js";

export function escapeHtml(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
}

/* mutates `el`'s content immediately, then dims briefly and fades back to
   full opacity as an "updated" cue — same feel as blog-render.js's
   crossfadeSwap on blog.html. Previously this set opacity to 0 *before*
   mutating and waited out the fade, leaving sections like the homepage
   "latest articles" grid fully blank for ~220ms — reading as the content
   disappearing rather than loading. */
const FADE_MS = 220;
export function fadeSwap(el, mutate) {
  if (!el) { mutate(); return; }
  const prevTransition = el.style.transition;
  el.style.transition = "opacity " + FADE_MS + "ms ease";
  mutate();
  el.style.opacity = "0.45";
  requestAnimationFrame(() => {
    requestAnimationFrame(() => { el.style.opacity = "1"; });
  });
  window.setTimeout(() => { el.style.transition = prevTransition; }, FADE_MS);
}

/* ---------------------------------------------------------------
   ข่าวสารและบทความ (หน้าแรก) — เอาการ์ดตัวอย่าง 3 ใบที่ hardcode ไว้ใน
   index.html (#home-blog-grid) มาแทนที่ด้วยบทความจริงล่าสุดจาก Firestore
   ถ้ามีเผยแพร่แล้ว เหมือน pattern ของ blog-render.js บนหน้า blog.html
   --------------------------------------------------------------- */
function formatThaiDate(ms) {
  if (!ms) return "";
  try {
    return new Date(ms).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return "";
  }
}

function estimateReadMinutes(content) {
  const words = String(content || "").trim().split(/\s+/).filter(Boolean).length;
  const chars = String(content || "").length;
  return Math.max(1, Math.round(Math.max(words / 130, chars / 500)));
}

// หน้านี้ถูกใช้ร่วมกันทั้ง index.html (root) และ en/index.html — โพสต์จาก
// Firestore เป็นเนื้อหาภาษาไทยเดี่ยว ลิงก์จึงต้องขึ้นไปหา blog-post.html ที่
// root เสมอ ไม่งั้นจากหน้า en/index.html จะ resolve ไปหา en/blog-post.html
// ซึ่งไม่มีไฟล์นี้อยู่จริง (404) — ดู js/blog-render.js สำหรับ pattern เดียวกัน
const IN_EN_FOLDER = /\/en\//.test(window.location.pathname);
const BLOG_POST_BASE = IN_EN_FOLDER ? "../blog-post.html" : "blog-post.html";
const TH_ONLY_TAG = IN_EN_FOLDER ? ' <small class="lang-tag">TH</small>' : "";

function blogCardHTML(post) {
  const href = `${BLOG_POST_BASE}?slug=${encodeURIComponent(post.slug || "")}`;
  const title = escapeHtml(post.title);
  const excerpt = escapeHtml(post.excerpt);
  const dateStr = formatThaiDate(post.createdAt);
  const readMin = estimateReadMinutes(post.content);
  const category = post.category ? `<span class="blog-tag">${escapeHtml(post.category)}</span>` : "";

  const imgBlock = post.image
    ? `<div class="img-ph img-ph--4-3 blog-card-img-real"><img src="${escapeHtml(post.image)}" alt="${title}" loading="lazy" decoding="async"></div>`
    : `<div class="img-ph img-ph--4-3">
         <div class="img-ph-inner">
           <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-4z"/><path d="M9 12l2 2 4-4"/></svg>
           <span class="img-ph-label">${title}</span>
         </div>
       </div>`;

  return `
    <a href="${href}" class="blog-card">
      ${imgBlock}
      <div class="blog-card-body">
        ${category}
        <h3>${title}</h3>
        <p>${excerpt}</p>
        <div class="blog-card-foot">
          <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>${dateStr ? dateStr : "อ่าน " + readMin + " นาที"}</span>
          <span class="blog-card-link">อ่านเพิ่มเติม${TH_ONLY_TAG} <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M5 12h14M13 5l7 7-7 7"/></svg></span>
        </div>
      </div>
    </a>`;
}

async function renderLatestBlogs() {
  const grid = document.getElementById("home-blog-grid");
  if (!grid) return;
  try {
    const posts = await getBlogs();
    const published = posts.filter(p => p.status === "published");
    if (!published.length) return; // ไม่มีบทความที่เผยแพร่ → ปล่อยให้การ์ดตัวอย่างเดิมในหน้าแสดงต่อไป

    const latest = published.slice(0, 3);
    fadeSwap(grid, () => {
      grid.innerHTML = latest.map(blogCardHTML).join("");
    });
  } catch (err) {
    console.warn("[home-dynamic] โหลดบทความล่าสุดไม่สำเร็จ ใช้การ์ดตัวอย่างเดิมในหน้าแทน:", err);
  }
}

renderLatestBlogs();
