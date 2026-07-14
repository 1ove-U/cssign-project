// ===========================
// js/blog-render.js — เรนเดอร์การ์ดบทความจริงจาก Firestore ในหน้า blog.html
// ===========================
// หมายเหตุ: firestore.rules อนุญาต read บทความทุกสถานะ (รวม draft) แบบ public
// ดังนั้นไฟล์นี้ "ต้อง" กรอง status === 'published' เองเสมอ ห้ามเชื่อ query ฝั่ง client ล้วนๆ

import { getBlogs } from "./db.js";

const GRID_EL = document.getElementById("blog-grid-dynamic");
const FEATURED_EL = document.getElementById("blog-featured-dynamic");

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

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
  // ภาษาไทยไม่มีเว้นวรรคระหว่างคำเสมอไป จึงประเมินคร่าวๆ จากจำนวนตัวอักษรร่วมด้วย
  const chars = String(content || "").length;
  const minutes = Math.max(1, Math.round(Math.max(words / 130, chars / 500)));
  return minutes;
}

function cardTemplate(post) {
  const href = `blog-post.html?slug=${encodeURIComponent(post.slug || "")}`;
  const title = escapeHtml(post.title);
  const excerpt = escapeHtml(post.excerpt);
  const dateStr = formatThaiDate(post.createdAt);
  const readMin = estimateReadMinutes(post.content);
  const category = post.category ? `<span class="blog-tag" style="margin-bottom:0;">${escapeHtml(post.category)}</span>` : "";

  const imgBlock = post.image
    ? `<div class="img-ph img-ph--4-3 blog-card-img-real"><img src="${escapeHtml(post.image)}" alt="${title}" loading="lazy" decoding="async"></div>`
    : `<div class="img-ph img-ph--4-3">
         <div class="img-ph-inner">
           <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-4z"/><path d="M9 12l2 2 4-4"/></svg>
           <span class="img-ph-label">${title}</span>
           <span class="img-ph-tag">4:3</span>
         </div>
       </div>`;

  return `
    <a href="${href}" class="blog-card" data-reveal="scale" style="text-decoration:none;">
      ${imgBlock}
      <div class="blog-card-body">
        ${category}
        <h3>${title}</h3>
        <p>${excerpt}</p>
        <div class="blog-card-foot">
          <span>${dateStr ? dateStr + " · " : ""}อ่าน ${readMin} นาที</span>
          <span class="blog-card-link">อ่านต่อ <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" width="13" height="13"><path d="M5 12h14M13 5l7 7-7 7"/></svg></span>
        </div>
      </div>
    </a>`;
}

/* -----------------------------------------------------------
   Featured card — always the single latest published post
   (posts[0], since getBlogs() orders by createdAt desc). This
   replaces the old "manually flagged featured:true" behaviour:
   the card at the top of the page is now just "บทความล่าสุด"
   and updates itself the moment a new post is published, with
   zero admin configuration needed.
   ----------------------------------------------------------- */
function featuredCardTemplate(post) {
  const href = `blog-post.html?slug=${encodeURIComponent(post.slug || "")}`;
  const title = escapeHtml(post.title);
  const excerpt = escapeHtml(post.excerpt);
  const dateStr = formatThaiDate(post.createdAt);
  const readMin = estimateReadMinutes(post.content);

  const imgBlock = post.image
    ? `<div class="img-ph img-ph--4-3 blog-feat-card-img-real"><img src="${escapeHtml(post.image)}" alt="${title}" loading="eager" decoding="async"></div>`
    : `<div class="img-ph img-ph--4-3">
         <div class="img-ph-inner">
           <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-4z"/><path d="M9 12l2 2 4-4"/></svg>
           <span class="img-ph-label">${title}</span>
         </div>
       </div>`;

  return `
    <a href="${href}" class="blog-feat-card" style="text-decoration:none;">
      ${imgBlock}
      <div class="blog-feat-body">
        <span class="blog-tag"><span class="blog-tag-dot"></span>บทความล่าสุด</span>
        <h2>${title}</h2>
        <div class="blog-meta">
          ${dateStr ? `<span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>${dateStr}</span>` : ""}
          <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>อ่าน ${readMin} นาที</span>
        </div>
        <p>${excerpt}</p>
        <span class="blog-card-link">อ่านบทความเต็ม <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M5 12h14M13 5l7 7-7 7"/></svg></span>
      </div>
    </a>`;
}

/* -----------------------------------------------------------
   Skeleton loading state — same pattern as products.js: only
   show a skeleton if the Firestore request is still pending
   after a short delay, so a fast response never flashes one.
   ----------------------------------------------------------- */
const SKELETON_DELAY = 260; // ms before we admit the load is "slow"
const FADE_MS = 220;        // must match .blog-grid's / .blog-featured's CSS transition

function skeletonCardHTML() {
  return `
    <div class="blog-card blog-skel-card" aria-hidden="true">
      <div class="blog-skel-thumb"></div>
      <div class="blog-card-body">
        <div class="blog-skel-line w35"></div>
        <div class="blog-skel-line w90"></div>
        <div class="blog-skel-line w60"></div>
        <div class="blog-card-foot"><div class="blog-skel-pill"></div></div>
      </div>
    </div>`;
}

function skeletonFeaturedHTML() {
  return `
    <div class="blog-feat-card blog-feat-skel" aria-hidden="true">
      <div class="blog-skel-thumb"></div>
      <div class="blog-feat-body">
        <div class="blog-skel-pill" style="margin-bottom:16px;"></div>
        <div class="blog-skel-line w60"></div>
        <div class="blog-skel-line w90"></div>
        <div class="blog-skel-line w90"></div>
        <div class="blog-skel-line w35" style="margin-top:10px;"></div>
      </div>
    </div>`;
}

function showSkeleton() {
  if (GRID_EL && !GRID_EL.classList.contains("is-swapping")) {
    const count = Math.max(GRID_EL.querySelectorAll(".blog-card").length, 6);
    crossfadeSwap(GRID_EL, () => {
      GRID_EL.innerHTML = Array.from({ length: count }, skeletonCardHTML).join("");
    });
  }
  if (FEATURED_EL && !FEATURED_EL.classList.contains("is-swapping")) {
    crossfadeSwap(FEATURED_EL, () => {
      FEATURED_EL.innerHTML = skeletonFeaturedHTML();
    });
  }
}

/* fades `el` — mutates content immediately (so the card/grid is never
   fully blank, it just switches straight to the skeleton or the real
   cards) then dims briefly and fades back to full opacity as a "this
   just updated" cue. Previously this set opacity to 0 *before*
   mutating and waited out the fade, which left the featured card /
   grid completely invisible for ~220ms on every load — reading as the
   content "disappearing" rather than loading. */
const pendingSwapTimers = new WeakMap();
function crossfadeSwap(el, mutate) {
  if (!el) { mutate(); return; }
  window.clearTimeout(pendingSwapTimers.get(el));
  // ถ้า element ถูกซ่อนอยู่แล้วโดยระบบ scroll-reveal (data-reveal, ยังไม่เข้า viewport)
  // ไม่ต้องยุ่งกับ opacity เอง แค่สลับเนื้อหาไปเลย เดี๋ยว reveal ระบบจะโชว์เองตอนเลื่อนถึง
  if (el.style.opacity === "0") {
    mutate();
    return;
  }
  el.classList.add("is-swapping");
  if (!el.style.transition) el.style.transition = `opacity ${FADE_MS}ms var(--ease, ease)`;
  mutate();
  el.style.opacity = "0.45";
  requestAnimationFrame(() => {
    requestAnimationFrame(() => { el.style.opacity = "1"; });
  });
  pendingSwapTimers.set(el, window.setTimeout(() => {
    el.classList.remove("is-swapping");
  }, FADE_MS));
}

function observeCardsReveal() {
  if (typeof window.CSSIGN_observeReveal === "function") {
    window.CSSIGN_observeReveal(GRID_EL);
  }
}

function renderEmpty() {
  // ไม่แตะ FEATURED_EL — ปล่อยการ์ด fallback ที่เขียนไว้ตรงๆ ใน blog.html ให้แสดงต่อไป
  // เมื่อยังไม่มีบทความใน Firestore เลย
  if (!GRID_EL) return;
  crossfadeSwap(GRID_EL, () => {
    GRID_EL.innerHTML = `<div class="blog-empty-state">ยังไม่มีบทความเผยแพร่ในขณะนี้ กลับมาดูใหม่เร็วๆ นี้นะครับ</div>`;
  });
}

function renderNoOtherPosts() {
  if (!GRID_EL) return;
  crossfadeSwap(GRID_EL, () => {
    GRID_EL.innerHTML = `<div class="blog-empty-state">กำลังจัดทำบทความถัดไป กลับมาดูใหม่เร็วๆ นี้นะครับ</div>`;
  });
}

function renderError() {
  if (GRID_EL) {
    crossfadeSwap(GRID_EL, () => {
      GRID_EL.innerHTML = `<div class="blog-empty-state">ไม่สามารถโหลดบทความได้ในขณะนี้ กรุณาลองรีเฟรชหน้าอีกครั้ง</div>`;
    });
  }
  // FEATURED_EL: เก็บการ์ด fallback ไว้เหมือนเดิมเมื่อโหลดพลาด แทนที่จะเคลียร์ทิ้ง
}

async function init() {
  if (!GRID_EL && !FEATURED_EL) return;

  let settled = false;
  const skeletonTimer = window.setTimeout(() => {
    if (!settled) showSkeleton();
  }, SKELETON_DELAY);

  let posts = [];
  try {
    const all = await getBlogs();
    posts = (all || []).filter((p) => p.status === "published");
  } catch (err) {
    console.error("[blog-render] getBlogs() failed:", err);
    settled = true;
    window.clearTimeout(skeletonTimer);
    renderError();
    return;
  }

  settled = true;
  window.clearTimeout(skeletonTimer);

  if (!posts.length) {
    renderEmpty();
    return;
  }

  // getBlogs() มา orderBy createdAt desc อยู่แล้ว (ใหม่สุดก่อน) — ตัวแรกคือบทความล่าสุด
  // ใช้เป็นการ์ด "บทความล่าสุด" ด้านบนเสมอ โดยไม่ต้องตั้งค่า featured:true อีกต่อไป
  const [latest, ...rest] = posts;

  if (FEATURED_EL) {
    crossfadeSwap(FEATURED_EL, () => {
      FEATURED_EL.innerHTML = featuredCardTemplate(latest);
    });
  }

  if (GRID_EL) {
    if (!rest.length) {
      renderNoOtherPosts();
    } else {
      crossfadeSwap(GRID_EL, () => {
        GRID_EL.innerHTML = rest.map(cardTemplate).join("");
        observeCardsReveal();
      });
    }
  }
}

init();
