// ===========================
// js/home-dynamic.js — หน้าแรกเท่านั้น
// แสดง FAQ และโลโก้ลูกค้าจากข้อมูลที่แอดมินกรอกไว้ (Firestore)
// ถ้ายังไม่มีข้อมูล จะปล่อยให้เนื้อหาเริ่มต้นในหน้า (hardcode) แสดงตามเดิม
// ===========================
import { getFaqs, getPartners, getTestimonials, getBlogs, getProducts, getPortfolios, getSettings } from "./db.js";

function escapeHtml(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
}

/* mutates `el`'s content immediately, then dims briefly and fades back to
   full opacity as an "updated" cue — same feel as blog-render.js's
   crossfadeSwap on blog.html. Previously this set opacity to 0 *before*
   mutating and waited out the fade, leaving sections like the homepage
   "latest articles" grid fully blank for ~220ms — reading as the content
   disappearing rather than loading. */
const FADE_MS = 220;
function fadeSwap(el, mutate) {
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

function bindFaqAccordion(container) {
  const items = container.querySelectorAll(".faq-item");
  items.forEach(item => {
    const q = item.querySelector(".faq-q");
    const a = item.querySelector(".faq-a");
    q.addEventListener("click", () => {
      const isOpen = item.classList.contains("open");
      items.forEach(other => {
        if (other !== item) {
          other.classList.remove("open");
          other.querySelector(".faq-a").style.maxHeight = null;
        }
      });
      if (isOpen) {
        item.classList.remove("open");
        a.style.maxHeight = null;
      } else {
        item.classList.add("open");
        a.style.maxHeight = a.scrollHeight + "px";
      }
    });
  });
}

async function renderFaqs() {
  const grid = document.getElementById("home-faq-grid");
  if (!grid) return;
  try {
    const faqs = await getFaqs();
    if (!faqs.length) return; // ไม่มีข้อมูล → ปล่อยให้ FAQ เดิมในหน้าแสดงต่อไป

    const mid = Math.ceil(faqs.length / 2);
    const colA = faqs.slice(0, mid);
    const colB = faqs.slice(mid);
    const itemHTML = f => `
      <div class="faq-item">
        <button class="faq-q"><span>${escapeHtml(f.question)}</span><span class="faq-q-icon"></span></button>
        <div class="faq-a"><p>${escapeHtml(f.answer)}</p></div>
      </div>`;

    fadeSwap(grid, () => {
      grid.innerHTML = `
        <div class="faq-col">${colA.map(itemHTML).join("")}</div>
        <div class="faq-col">${colB.map(itemHTML).join("")}</div>`;
      bindFaqAccordion(grid);
    });
  } catch (err) {
    console.warn("[home-dynamic] โหลด FAQ ไม่สำเร็จ ใช้ชุดคำถามเริ่มต้นในหน้าแทน:", err);
  }
}

async function renderPartnerLogos() {
  const wrap = document.getElementById("home-partner-logos");
  // จุดที่ 2: แถบโลโก้วิ่ง (marquee) ก่อนฟุตเตอร์ — เดิม hardcode SVG/ชื่อบริษัทสมมติไว้ตรงๆ
  // ไม่เชื่อมกับข้อมูลแอดมินเลย ทำให้แก้ที่แอดมินแล้วจุดนี้ไม่เปลี่ยนตาม จึงต่อเข้ากับ
  // ข้อมูล partners ชุดเดียวกับด้านบนแทน
  const marqueeTrack = document.querySelector(".logo-marquee-track");
  if (!wrap && !marqueeTrack) return;
  try {
    const partners = await getPartners();
    const withLogo = partners.filter(p => p.logo);
    if (!withLogo.length) return; // ไม่มีข้อมูล → ปล่อยให้ placeholder เดิมแสดงต่อไปทั้ง 2 จุด

    if (wrap) {
      fadeSwap(wrap, () => {
        wrap.classList.remove("stats-logos-ph");
        wrap.innerHTML = `
          <div class="stats-logos-real-row">
            ${withLogo.map(p => `<img src="${p.logo}" alt="${escapeHtml(p.name || "")}" loading="lazy" decoding="async">`).join("")}
          </div>`;
      });
    }

    if (marqueeTrack) {
      const itemHTML = p => `
        <div class="logo-marquee-item logo-marquee-item--plain">
          <img src="${p.logo}" alt="${escapeHtml(p.name || "")}" loading="lazy" decoding="async" style="width:auto;height:64px;max-width:180px;object-fit:contain;">
        </div>`;
      // ทำซ้ำ 2 ชุดต่อกัน เพื่อให้แอนิเมชันเลื่อน (translateX(-50%)) วนลูปได้ต่อเนื่องไม่มีรอยต่อ
      fadeSwap(marqueeTrack, () => {
        marqueeTrack.innerHTML = withLogo.map(itemHTML).join("") + withLogo.map(itemHTML).join("");
      });
    }
  } catch (err) {
    console.warn("[home-dynamic] โหลดโลโก้ลูกค้าไม่สำเร็จ ใช้ placeholder เดิมในหน้าแทน:", err);
  }
}

/* ---------------------------------------------------------------
   ลูกค้าของเรา (หน้าแรก) — แถบโลโก้วงกลม (grayscale) 2 แถวสลับตำแหน่ง
   วิ่งเลื่อนไปทางซ้าย ใน #home-clients-row-a / #home-clients-row-b
   ใช้ข้อมูลชุดเดียวกับ getPartners() ที่ renderPartnerLogos() ด้านบนใช้อยู่
   แล้ว (collection "partners" ที่แอดมินกรอกชื่อ + โลโก้ไว้) แค่ขึ้น UI
   คนละแบบ ถ้ายังไม่มีข้อมูลที่แอดมินกรอกไว้เลย จะปล่อยวงกลมตัวอย่างที่
   hardcode ไว้ใน index.html ให้แสดงต่อไป เหมือน pattern ของ FAQ/บทความ
   --------------------------------------------------------------- */
function circleTileHTML(p) {
  const name = escapeHtml(p.name || "");
  const logoBlock = p.logo
    ? `<img src="${escapeHtml(p.logo)}" alt="${name}" loading="lazy" decoding="async">`
    : `<svg viewBox="0 0 40 40" fill="none"><circle cx="20" cy="20" r="18" stroke="currentColor" stroke-width="2"/><path d="M15 20l3 3 7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  return `
    <div class="client-circle">
      <div class="client-circle-inner">${logoBlock}</div>
    </div>`;
}

// เติมรายการ HTML ของวงกลมให้ยาวเกินความกว้างจอปัจจุบันเสมอ (คำนวณใหม่ทุก
// ครั้งที่เรียก จึงรองรับจอกว้างมากๆ ได้ด้วย) ก่อนค่อยทำซ้ำอีกชุดต่อท้าย
// สำหรับให้แอนิเมชัน translateX(-50%) วนลูปได้แบบไร้รอยต่อ — ถ้าไม่เติมให้
// พอก่อน แถวที่มีโลโก้น้อยชิ้นจะจบก่อนสุดขอบขวาแล้วเห็นพื้นที่ว่างก่อนวนกลับ
// (แถวเริ่มชิดซ้ายเสมอ ไม่ได้ยืดเต็มจอ)
function fillRowHTML(row, baseHTMLList) {
  if (!row || !baseHTMLList.length) return;
  const ITEM_PX = window.innerWidth <= 640 ? 82 : 114; // ต้องตรงกับ width+gap ใน CSS
  const minRowPx = Math.max(window.innerWidth * 2.2, 2400);
  const neededCount = Math.ceil(minRowPx / ITEM_PX);
  const repeats = Math.max(2, Math.ceil(neededCount / baseHTMLList.length));
  let filled = [];
  for (let i = 0; i < repeats; i++) filled = filled.concat(baseHTMLList);
  const set = filled.join("");
  row.innerHTML = set + set;
}

// เก็บชุดฐาน (ก่อนเติม/ทำซ้ำ) ของแต่ละแถวไว้ เผื่อต้องคำนวณใหม่ตอนย่อ-ขยาย
// หน้าต่างเบราว์เซอร์ โดยไม่ต้องยิง getPartners() ซ้ำ
let _clientsRowABaseHTML = null;
let _clientsRowBBaseHTML = null;

async function renderClientLogos() {
  const rowA = document.getElementById("home-clients-row-a");
  const rowB = document.getElementById("home-clients-row-b");
  if (!rowA && !rowB) return;

  try {
    const partners = await getPartners();
    if (partners.length) {
      // แบ่งโลโก้สลับคู่-คี่ลงสองแถว ให้แต่ละแถวได้ชุดที่ต่างกัน
      const rowAItems = partners.filter((_, i) => i % 2 === 0);
      const rowBItems = partners.filter((_, i) => i % 2 === 1);
      _clientsRowABaseHTML = rowAItems.map(circleTileHTML);
      _clientsRowBBaseHTML = (rowBItems.length ? rowBItems : rowAItems).map(circleTileHTML);
      if (rowA) fadeSwap(rowA, () => fillRowHTML(rowA, _clientsRowABaseHTML));
      if (rowB) fadeSwap(rowB, () => fillRowHTML(rowB, _clientsRowBBaseHTML));
      return;
    }
    // ไม่มีข้อมูลที่แอดมินกรอกไว้ → ใช้วงกลมตัวอย่างที่ hardcode ไว้ในหน้าเป็นฐาน
    // ต่อด้านล่าง (ไม่ return เปล่าๆ) เพราะยังต้องคำนวณจำนวนซ้ำใหม่ให้พอดี
    // ความกว้างจอปัจจุบันอยู่ดี โดยเฉพาะจอกว้างมากๆ ที่ชุดฐาน 5 ชิ้นในหน้า
    // อาจสั้นเกินไป
  } catch (err) {
    console.warn("[home-dynamic] โหลดโลโก้ลูกค้าไม่สำเร็จ ใช้วงกลมตัวอย่างเดิมในหน้าแทน:", err);
  }

  [[rowA, "A"], [rowB, "B"]].forEach(([row, tag]) => {
    if (!row || !row.children.length) return;
    // ครึ่งแรกของวงกลมที่ hardcode ไว้ในหน้าคือชุดฐาน (ครึ่งหลังคือที่ทำซ้ำ
    // ไว้เผื่อวนลูปอยู่แล้วในตัว HTML เดิม) — ดึงแค่ครึ่งแรกมาคำนวณซ้ำใหม่
    const baseCount = Math.max(1, Math.floor(row.children.length / 2));
    const baseHTMLList = Array.from(row.children).slice(0, baseCount).map(el => el.outerHTML);
    if (tag === "A") _clientsRowABaseHTML = baseHTMLList; else _clientsRowBBaseHTML = baseHTMLList;
    fillRowHTML(row, baseHTMLList);
  });
}

// ย่อ-ขยายหน้าต่าง (เช่น หมุนจอมือถือ, ปรับขนาดหน้าต่างเดสก์ท็อป) → คำนวณ
// จำนวนซ้ำใหม่จากชุดฐานที่แคชไว้ ไม่ต้องยิง getPartners() ซ้ำ
let _clientsResizeTimer = null;
window.addEventListener("resize", () => {
  if (!_clientsRowABaseHTML && !_clientsRowBBaseHTML) return;
  clearTimeout(_clientsResizeTimer);
  _clientsResizeTimer = setTimeout(() => {
    const rowA = document.getElementById("home-clients-row-a");
    const rowB = document.getElementById("home-clients-row-b");
    if (rowA && _clientsRowABaseHTML) fillRowHTML(rowA, _clientsRowABaseHTML);
    if (rowB && _clientsRowBBaseHTML) fillRowHTML(rowB, _clientsRowBBaseHTML);
  }, 200);
});

async function renderTestimonials() {
  const track = document.getElementById("testi-track");
  if (!track) return;
  try {
    const testimonials = await getTestimonials();
    if (!testimonials.length) return; // ไม่มีข้อมูล → ปล่อยให้รีวิวตัวอย่างเดิมในหน้าแสดงต่อไป (และไม่ใส่ Review schema ด้วย ดูหมายเหตุใน injectReviewSchema)

    const cardHTML = t => `
      <div class="testi-card">
        <div class="testi-post">
          <div class="testi-post-head">
            <div class="testi-post-logo">CS</div>
            <div class="testi-post-headtext">
              <span class="testi-post-brand">${escapeHtml(t.company || "")}</span>
              <span class="testi-company">รีวิวจากลูกค้าองค์กร</span>
            </div>
            <span class="testi-stars">${"★".repeat(t.stars || 5)}</span>
          </div>
          <p class="testi-quote">${escapeHtml(t.quote || "")}</p>
          <div class="testi-post-media">
            <div class="testi-post-tag">
              ${t.logo
                ? `<div class="testi-avatar testi-avatar--img"><img src="${t.logo}" alt="${escapeHtml(t.name || "")}" loading="lazy" decoding="async"></div>`
                : `<div class="testi-avatar">${escapeHtml((t.name || "?").trim().charAt(0) || "?")}</div>`}
              <div><div class="testi-name">${escapeHtml(t.name || "")}</div><div class="testi-role">${escapeHtml(t.role || "")}</div></div>
            </div>
            <span class="testi-post-verified-badge"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>ยืนยันจริง</span>
          </div>
        </div>
      </div>`;

    fadeSwap(track, () => {
      track.innerHTML = testimonials.map(cardHTML).join("");
      injectReviewSchema(testimonials);

      // main.js ตั้งค่า carousel (ลูกศร/จุด/autoplay) ไว้ตอนโหลดหน้าจากการ์ดตัวอย่างเดิม
      // ต้องสั่งให้ตั้งค่าใหม่อีกครั้งหลังเปลี่ยนการ์ดเป็นของจริง ไม่งั้นปุ่ม/จุดจะอ้างอิงการ์ดเก่าที่ถูกลบไปแล้ว
      if (typeof window.CSSIGN_initTestiCarousel === "function") {
        window.CSSIGN_initTestiCarousel();
      }
    });
  } catch (err) {
    console.warn("[home-dynamic] โหลดรีวิวลูกค้าไม่สำเร็จ ใช้ชุดตัวอย่างเดิมในหน้าแทน:", err);
  }
}

/* ---------------------------------------------------------------
   Review / AggregateRating JSON-LD — deliberately NOT static.
   The 6 testimonial cards shipped in index.html are placeholder
   copy (fictional names) so the section never looks empty before
   an admin adds real reviews — see FIXES-2026-07-02.md. Hard-coding
   Review schema for those would mean marking up reviews that were
   never actually left by a customer, which is both misleading and
   the kind of mismatched/fabricated review markup Google's structured
   data policies penalize. So this only ever runs on the branch above
   where `testimonials.length` is real Firestore data — if the admin
   hasn't added any yet, no Review schema is emitted at all, matching
   what's actually on the page.
   --------------------------------------------------------------- */
function injectReviewSchema(testimonials) {
  const SCRIPT_ID = "testimonial-review-schema";
  const existing = document.getElementById(SCRIPT_ID);
  const real = testimonials.filter(t => t && t.quote && t.name);
  if (!real.length) {
    if (existing) existing.remove();
    return;
  }

  const ratings = real.map(t => Math.min(5, Math.max(1, Number(t.stars) || 5)));
  const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length;

  const schema = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": "https://cssign.co.th/#localbusiness",
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": avg.toFixed(1),
      "reviewCount": real.length,
      "bestRating": "5",
      "worstRating": "1"
    },
    "review": real.slice(0, 20).map(t => ({
      "@type": "Review",
      "reviewRating": {
        "@type": "Rating",
        "ratingValue": String(Math.min(5, Math.max(1, Number(t.stars) || 5))),
        "bestRating": "5",
        "worstRating": "1"
      },
      "author": { "@type": "Person", "name": t.name },
      "reviewBody": t.quote,
      ...(t.company ? { "publisher": { "@type": "Organization", "name": t.company } } : {})
    }))
  };

  let el = existing;
  if (!el) {
    el = document.createElement("script");
    el.type = "application/ld+json";
    el.id = SCRIPT_ID;
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(schema);
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

function blogCardHTML(post) {
  const href = `blog-post.html?slug=${encodeURIComponent(post.slug || "")}`;
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
          <span class="blog-card-link">อ่านเพิ่มเติม <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M5 12h14M13 5l7 7-7 7"/></svg></span>
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

/* ---------------------------------------------------------------
   สินค้าแนะนำ (หน้าแรก) — แกลเลอรีรูปสินค้าที่แอดมิน "ติดรายการโปรด"
   (ฟิลด์ product.featured เดียวกับที่ใช้ในหน้าแอดมิน) จัดเป็น marquee
   2 แถว เลื่อนอัตโนมัติสลับทิศทาง ถ้ายังไม่มีสินค้าที่ติดรายการโปรด
   เลย (หรือมีแต่ไม่มีรูป) จะไม่แสดง section นี้เลย ปล่อยว่างไว้ตามเดิม
   (ดู .fp-section{display:none} ใน style.css)
   --------------------------------------------------------------- */
function fpImgUrl(img) { return (img && typeof img === "object") ? (img.url || "") : (img || ""); }

function fpTileHTML(p) {
  const img = (p.images && p.images[0]) ? fpImgUrl(p.images[0]) : "";
  if (!img) return "";
  const href = p.slug ? `product-detail.html?slug=${encodeURIComponent(p.slug)}` : "products.html";
  const name = escapeHtml(p.name || "สินค้า");
  return `
    <a class="fp-tile" href="${href}">
      ${p.code ? `<span class="fp-tile-badge">${escapeHtml(p.code)}</span>` : ""}
      <div class="fp-tile-img"><img src="${img}" alt="${name}" loading="lazy" decoding="async"></div>
      <div class="fp-tile-overlay">
        <span class="fp-tile-name">${name}</span>
        <span class="fp-tile-cta">ดูรายละเอียด <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><path d="M5 12h14M13 5l7 7-7 7"/></svg></span>
      </div>
    </a>`;
}

// กระจายสินค้าลง 4 แถวแบบวนรอบ (round-robin) ให้แต่ละแถวมีจำนวนใกล้เคียงกัน
function fpDistributeRows(items, rowCount) {
  const rows = Array.from({ length: rowCount }, () => []);
  items.forEach((item, i) => rows[i % rowCount].push(item));
  return rows;
}

async function renderFeaturedProducts() {
  const section = document.getElementById("featured-products");
  const marquee = document.getElementById("home-fp-marquee");
  if (!section || !marquee) return;
  try {
    const products = await getProducts();
    const featured = products.filter(p => p && p.featured && p.status === "active" && p.images && p.images[0]);
    if (!featured.length) return; // ยังไม่มีสินค้าติดรายการโปรด → เว้น section นี้ไว้ ไม่แสดงอะไรเลย

    const ROWS = 2;
    const rows = fpDistributeRows(featured, ROWS);

    const rowsHTML = rows.map((rowItems, i) => {
      if (!rowItems.length) return "";
      // เติมรายการซ้ำให้ยาวพอสำหรับ marquee ก่อน แล้วค่อย duplicate อีกชุด (x2)
      // เพื่อให้ translateX(-50%) วนลูปต่อเนื่องสนิทไม่มีรอยต่อ เหมือน logo-marquee-track เดิม
      let tiles = rowItems.slice();
      while (tiles.length < 6) tiles = tiles.concat(rowItems);
      const tilesHTML = tiles.map(fpTileHTML).join("") + tiles.map(fpTileHTML).join("");
      const dirClass = (i % 2 === 1) ? " fp-row--reverse" : "";
      return `<div class="fp-row${dirClass}"><div class="fp-track">${tilesHTML}</div></div>`;
    }).join("");

    marquee.innerHTML = rowsHTML;
    section.classList.add("is-visible");

    // section เพิ่งเปลี่ยนจาก display:none เป็นแสดงผลจริง — เรียก reveal-on-scroll
    // ใหม่อีกครั้งสำหรับ section นี้ (เหมือน pattern ของ portfolio-render.js / blog-render.js)
    if (typeof window.CSSIGN_observeReveal === "function") {
      window.CSSIGN_observeReveal(section);
    }
  } catch (err) {
    console.warn("[home-dynamic] โหลดสินค้าติดรายการโปรดไม่สำเร็จ ไม่แสดง section สินค้าแนะนำ:", err);
  }
}

/* ---------------------------------------------------------------
   ผลงานที่ติดดาว (หน้าแรก) — bento gallery ของผลงานที่แอดมิน "ปักหมุด"
   (item.pinned เดียวกับที่ section "PROJECT SHOWCASE" ด้านบนใช้อยู่แล้ว)
   จงใจให้หน้าตาต่างจาก marquee สินค้า: กริดขนาดสลับใหญ่-เล็กนิ่งๆ ไม่เลื่อน
   แคปชันลอยค้างบนรูปตลอด ใช้คลาส .port-card เดิมเพื่อให้คลิกแล้วเปิด
   ป๊อปอัปรายละเอียดผ่าน portfolio-lightbox.js ที่ผูก event ไว้ทั้งเว็บอยู่แล้ว
   โดยไม่ต้องเขียนโค้ดคลิก/โมดัลใหม่ ถ้ายังไม่มีผลงานที่ปักหมุดเลย (หรือ
   ปักหมุดไว้แต่ไม่มีรูป) จะไม่แสดง section นี้เลย
   --------------------------------------------------------------- */
const WG_CAT_LABEL = {
  factory: "โรงงานอุตสาหกรรม",
  government: "ภาครัฐ",
  industrial: "นิคมอุตสาหกรรม",
  custom: "Custom Order"
};
// วนรูปแบบขนาดกระเบื้อง: การ์ดใหญ่ 1 ใบ, ปกติ 2 ใบ, การ์ดกว้าง 1 ใบ, ปกติ 2 ใบ แล้ววนซ้ำ
// ให้ผังหน้าตาน่าสนใจไม่ว่าจะมีผลงานที่ปักหมุดกี่ชิ้นก็ตาม
const WG_SIZE_PATTERN = ["wg-tile--big", "", "", "wg-tile--wide", "", ""];

function wgTileHTML(item, idx) {
  const imgs = (item.images || []).filter(Boolean);
  const img = imgs[0];
  if (!img) return ""; // ไม่มีรูป ไม่นำมาแสดงใน gallery นี้
  const sizeClass = WG_SIZE_PATTERN[idx % WG_SIZE_PATTERN.length];
  const title = escapeHtml(item.title || "ผลงาน");
  const badge = WG_CAT_LABEL[item.category] || item.category || "ผลงาน";
  const imagesAttr = escapeHtml(JSON.stringify(imgs));
  return `
    <div class="port-card wg-tile${sizeClass ? " " + sizeClass : ""}" data-cat="${escapeHtml(item.category || "custom")}" data-images='${imagesAttr}'>
      <div class="port-visual">
        <img src="${escapeHtml(img)}" alt="${title}" class="port-photo" loading="lazy" decoding="async">
        <div class="port-badge">${escapeHtml(badge)}</div>
      </div>
      <div class="port-info">
        ${item.client ? `<div class="port-client">${escapeHtml(item.client)}</div>` : ""}
        <h3>${title}</h3>
        ${item.description ? `<p>${escapeHtml(item.description)}</p>` : ""}
      </div>
    </div>`;
}

async function renderStarredWorks() {
  const section = document.getElementById("starred-works");
  const grid = document.getElementById("home-wg-grid");
  if (!section || !grid) return;
  try {
    const items = await getPortfolios();
    const pinned = items
      .filter(p => p && p.pinned && p.images && p.images.length)
      .sort((a, b) => (a.order || 0) - (b.order || 0) || (a.createdAt || 0) - (b.createdAt || 0))
      // จำกัดไว้ที่ 12 ชิ้นเสมอ — ลาย big/wide/normal วนซ้ำครบ 2 รอบพอดีที่ 12 ชิ้น
      // ทำให้แถวสุดท้ายของกริดเต็มพอดีทุกครั้ง ไม่มีช่องว่างแหว่งที่ฐาน
      .slice(0, 12);
    if (!pinned.length) return; // ยังไม่มีผลงานที่ติดดาว → เว้น section นี้ไว้ ไม่แสดงอะไรเลย

    const tilesHTML = pinned.map(wgTileHTML).join("");
    if (!tilesHTML.trim()) return;

    grid.innerHTML = tilesHTML;
    section.classList.add("is-visible");

    if (typeof window.CSSIGN_observeReveal === "function") {
      window.CSSIGN_observeReveal(section);
    }
  } catch (err) {
    console.warn("[home-dynamic] โหลดผลงานที่ติดดาวไม่สำเร็จ ไม่แสดง section ผลงานเด่น:", err);
  }
}

/* ---------------------------------------------------------------
   โปรโมชั่น & ข่าวอัพเดตล่าสุด (หน้าแรก) — คารูเซลรูปภาพสไตล์พรีเมียม
   ดึงจาก settings.promoUpdates: [{ image, title, link }] ที่แอดมินอัปโหลด
   ไว้ในแท็บตั้งค่า (สูงสุด 10 รูป) ต่างจาก fp-section/wg-section ตรงที่
   section นี้แสดงผลเสมอ — ถ้ายังไม่มีรูปเลย ให้คงการ์ด "รออัพเดต" (hardcode
   ไว้ในหน้าอยู่แล้ว) แทนที่จะซ่อน section ทิ้งไป
   แสดงทีละ 3 รูป: อันกลางใหญ่สุด/เด่นสุด ซ้าย-ขวาเล็กเท่ากัน ใช้ object-fit
   contain (ไม่ครอบตัดภาพ) พื้นหลังในกรอบเป็นผิวกระจกด้านเรียบเนียนตา (ไม่ใช่
   ภาพเบลอ กันปัญหาขอบมัว/มืดไม่เนียนรอบภาพที่สัดส่วนไม่ตรง 16:9 พอดี)
   เลื่อนอัตโนมัติทุก 5 วิ หยุดเลื่อนเมื่อเมาส์ชี้ค้าง คลิกลูกศร/รูปข้างๆ/จุด
   ด้านล่างเพื่อเลื่อนเองได้เช่นเดียวกับคารูเซลวิดีโอแนะนำสินค้า
   --------------------------------------------------------------- */
const PROMO_AUTOPLAY_MS = 5000;
const PROMO_MAX = 10;

function pcarSlideHTML(item, idx, role) {
  // role: "center" | "side"
  const title = escapeHtml(item.title || "");
  return `
    <button type="button" class="pcar-slide pcar-slide--${role}${title ? " has-title" : ""}" data-idx="${idx}" aria-label="${title || "ดูรูปนี้ขนาดใหญ่"}">
      <span class="pcar-slide-frame">
        <img src="${escapeHtml(item.image)}" alt="${title || "โปรโมชั่น/ข่าวอัพเดตจาก CS.SIGN"}" loading="lazy" decoding="async">
      </span>
      ${title ? `<span class="pcar-slide-title">${title}</span>` : ""}
    </button>`;
}

function pcarBuildHTML(items, activeIndex) {
  const n = items.length;
  const prevIdx = (activeIndex - 1 + n) % n;
  const nextIdx = (activeIndex + 1) % n;
  const active = items[activeIndex];
  const title = escapeHtml(active.title || "");
  const isLink = !!(active.link && active.link.trim());

  return `
    <div class="pcar">
      <div class="pcar-stage-wrap">
        <div class="pcar-stage-glow" aria-hidden="true"></div>
        <div class="pcar-stage">
          <button type="button" class="pcar-arrow pcar-arrow--prev" aria-label="รูปก่อนหน้า" ${n < 2 ? "disabled" : ""}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M15 5l-7 7 7 7"/></svg>
          </button>
          ${n > 1 ? pcarSlideHTML(items[prevIdx], prevIdx, "side side--prev") : ""}
          <div class="pcar-slide pcar-slide--center" data-idx="${activeIndex}">
            <span class="pcar-slide-frame">
              <img src="${escapeHtml(active.image)}" alt="${title || "โปรโมชั่น/ข่าวอัพเดตจาก CS.SIGN"}" loading="lazy" decoding="async">
            </span>
            ${n > 1 ? `<span class="pcar-counter">${activeIndex + 1} / ${n}</span>` : ""}
            ${isLink ? `<a class="pcar-view-link" href="${escapeHtml(active.link.trim())}" target="_blank" rel="noopener" aria-label="เปิดลิงก์">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M18 13v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6"/><path d="M10 14 21 3"/></svg>
            </a>` : ""}
          </div>
          ${n > 1 ? pcarSlideHTML(items[nextIdx], nextIdx, "side side--next") : ""}
          <button type="button" class="pcar-arrow pcar-arrow--next" aria-label="รูปถัดไป" ${n < 2 ? "disabled" : ""}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M9 5l7 7-7 7"/></svg>
          </button>
        </div>
      </div>
      ${title ? `<div class="pcar-caption"><h3>${title}</h3></div>` : ""}
      ${n > 1 ? `<div class="pcar-dots">${items.map((_, i) => `<span class="pcar-dot${i === activeIndex ? " active" : ""}" data-idx="${i}"></span>`).join("")}</div>` : ""}
    </div>`;
}

async function renderPromoUpdates() {
  const wrap = document.getElementById("home-promo-grid");
  if (!wrap) return;
  try {
    const settings = await getSettings();
    const items = (settings && Array.isArray(settings.promoUpdates))
      ? settings.promoUpdates.filter(it => it && it.image).slice(0, PROMO_MAX)
      : [];
    if (!items.length) return; // ยังไม่มีรูปที่แอดมินอัปโหลด → ปล่อยการ์ด "รออัพเดต" เดิมในหน้าแสดงต่อไป

    let activeIndex = 0;
    let timer = null;

    function goTo(idx) {
      const n = items.length;
      activeIndex = ((idx % n) + n) % n;
      wrap.innerHTML = pcarBuildHTML(items, activeIndex);
      bind();
    }

    function startAutoplay() {
      stopAutoplay();
      if (items.length < 2) return;
      timer = window.setInterval(() => goTo(activeIndex + 1), PROMO_AUTOPLAY_MS);
    }
    function stopAutoplay() {
      if (timer) { window.clearInterval(timer); timer = null; }
    }

    function bind() {
      const pcar = wrap.querySelector(".pcar");
      if (!pcar) return;
      pcar.addEventListener("mouseenter", stopAutoplay);
      pcar.addEventListener("mouseleave", startAutoplay);

      const prevBtn = pcar.querySelector(".pcar-arrow--prev");
      const nextBtn = pcar.querySelector(".pcar-arrow--next");
      if (prevBtn) prevBtn.addEventListener("click", () => goTo(activeIndex - 1));
      if (nextBtn) nextBtn.addEventListener("click", () => goTo(activeIndex + 1));

      pcar.querySelectorAll(".pcar-slide--side").forEach(el => {
        el.addEventListener("click", () => goTo(Number(el.dataset.idx)));
      });
      pcar.querySelectorAll(".pcar-dot").forEach(el => {
        el.addEventListener("click", () => goTo(Number(el.dataset.idx)));
      });
    }

    fadeSwap(wrap, () => {
      wrap.classList.remove("promo-grid--empty");
      wrap.innerHTML = pcarBuildHTML(items, activeIndex);
      bind();
      startAutoplay();
    });
  } catch (err) {
    console.warn("[home-dynamic] โหลดโปรโมชั่น/ข่าวอัพเดตไม่สำเร็จ ใช้การ์ด \"รออัพเดต\" เดิมในหน้าแทน:", err);
  }
}

/* ---------------------------------------------------------------
   วิดีโอแนะนำสินค้า (หน้าแรก) — การ์ดสไตล์วิดีโอแนวตั้ง (reel) เลื่อนได้
   ดึงจาก settings.introVideos: [{ url, poster, title, desc }, ...] (สูงสุด
   10 คลิป) ที่แอดมินตั้งค่าไว้ในแท็บตั้งค่า รองรับทั้งลิงก์ YouTube และไฟล์
   วิดีโอ (.mp4/.webm) — แสดงทีละ 3 คลิป: อันกลางใหญ่สุด สว่างสุด และเริ่ม
   เล่นอัตโนมัติ (ปิดเสียงไว้ก่อนตามข้อจำกัดเบราว์เซอร์ มีปุ่มเปิดเสียง)
   ส่วนอันซ้าย/ขวาเล็กกว่าและหรี่ไว้ ยังไม่เริ่มเล่น เพื่อให้อันกลางเด่น
   เลื่อนเองทุก 5 วิเมื่อไม่มีเมาส์ชี้ค้าง และเลื่อนมือ/คลิกข้างๆ ได้ด้วย
   รองรับ settings.introVideo (ตัวเดียว) แบบเดิมไว้เป็น fallback
   --------------------------------------------------------------- */
function extractYouTubeId(url) {
  const m = String(url || "").match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/i);
  return m ? m[1] : "";
}

function isDirectVideoUrl(url) {
  return /\.(mp4|webm|ogg)(\?.*)?$/i.test(String(url || "").trim());
}

const VCAR_AUTOPLAY_MS = 5000;

function vcarPosterUrl(video) {
  const ytId = extractYouTubeId(video.url);
  return video.poster || (ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : "");
}

// ไอคอน "เล่น" ที่แปะไว้บนการ์ดข้างๆ เสมอ — ให้เห็นชัดเจนตั้งแต่แวบแรกว่า
// นี่คือวิดีโออีกคลิปที่กดดูได้ ไม่ใช่กล่องเปล่าๆ แม้ตอนที่ยังโหลดภาพปกไม่ทัน
const VCAR_PLAY_ICON = `
  <span class="vcar-slide-playicon" aria-hidden="true">
    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
  </span>`;

function vcarSlideHTML(video, idx, role) {
  // role: "center" | "side"
  const poster = vcarPosterUrl(video);
  const title = escapeHtml(video.title || "");
  // มีรูปปก (อัปโหลดเองหรือดึงจาก YouTube) → ใช้ background-image ที่โหลดเร็ว
  // ไม่มีรูปปกแต่เป็นไฟล์วิดีโอโดยตรง → ฝัง <video> จริงไว้แทน ให้เบราว์เซอร์
  // แสดงเฟรมแรกของคลิปเป็นภาพตัวอย่างเอง (กันปัญหาการ์ดข้างๆ ว่างเปล่ามืดสนิท
  // จนดูไม่ออกว่ามีวิดีโออีกคลิปซ่อนอยู่)
  const mediaHTML = poster
    ? `<span class="vcar-slide-media" style="background-image:url('${escapeHtml(poster)}')"></span>`
    : (isDirectVideoUrl(video.url)
        ? `<video class="vcar-slide-media vcar-slide-media--video" src="${escapeHtml((video.url || "").trim())}" muted playsinline preload="auto" tabindex="-1"></video>`
        : `<span class="vcar-slide-media"></span>`);
  return `
    <button type="button" class="vcar-slide vcar-slide--${role}" data-idx="${idx}" aria-label="${title || "ดูวิดีโอนี้"}">
      ${mediaHTML}
      ${VCAR_PLAY_ICON}
      ${title ? `<span class="vcar-slide-title">${title}</span>` : ""}
    </button>`;
}

function vcarCenterPlayerHTML(video) {
  const ytId = extractYouTubeId(video.url);
  const url = (video.url || "").trim();
  const isDirectFile = !ytId && /\.(mp4|webm|ogg)(\?.*)?$/i.test(url);
  if (isDirectFile) {
    return `<video class="vcar-player" src="${escapeHtml(url)}" autoplay muted loop playsinline poster="${escapeHtml(vcarPosterUrl(video))}"></video>`;
  }
  if (ytId) {
    const src = `https://www.youtube-nocookie.com/embed/${ytId}?autoplay=1&mute=1&loop=1&playlist=${ytId}&rel=0&playsinline=1&controls=1`;
    return `<iframe class="vcar-player" src="${src}" title="วิดีโอแนะนำสินค้า CS.SIGN" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
  }
  // ลิงก์รูปแบบอื่นที่ไม่รู้จัก — ฝัง iframe ตรงๆ เป็นทางเลือกสุดท้าย
  return url ? `<iframe class="vcar-player" src="${escapeHtml(url)}" title="วิดีโอแนะนำสินค้า CS.SIGN" frameborder="0" allowfullscreen></iframe>` : "";
}

function vcarBuildHTML(videos, activeIndex) {
  const n = videos.length;
  const prevIdx = (activeIndex - 1 + n) % n;
  const nextIdx = (activeIndex + 1) % n;
  const active = videos[activeIndex];
  const title = escapeHtml(active.title || "");
  const desc = escapeHtml(active.desc || "");

  return `
    <div class="vcar">
      <div class="vcar-stage-wrap">
        <div class="vcar-stage-glow" aria-hidden="true"></div>
        <div class="vcar-stage">
          <button type="button" class="vcar-arrow vcar-arrow--prev" aria-label="วิดีโอก่อนหน้า">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M15 5l-7 7 7 7"/></svg>
          </button>
          ${n > 1 ? vcarSlideHTML(videos[prevIdx], prevIdx, "side side--prev") : ""}
          <div class="vcar-slide vcar-slide--center" data-idx="${activeIndex}">
            <div class="vcar-center-frame">${vcarCenterPlayerHTML(active)}</div>
            ${n > 1 ? `<span class="vcar-counter">${activeIndex + 1} / ${n}</span>` : ""}
            <button type="button" class="vcar-mute-toggle" aria-label="เปิด/ปิดเสียง" data-muted="1">
              <svg class="vcar-icon-muted" viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 12A4.5 4.5 0 0 0 14 8v8a4.5 4.5 0 0 0 2.5-4z"/><path d="M11 5 6 9H3v6h3l5 4V5zM19.07 4.93a10 10 0 0 1 0 14.14l-1.41-1.41a8 8 0 0 0 0-11.32z"/></svg>
              <svg class="vcar-icon-unmuted" viewBox="0 0 24 24" fill="currentColor" style="display:none"><path d="M11 5 6 9H3v6h3l5 4V5zM16.5 12A4.5 4.5 0 0 0 14 8v8a4.5 4.5 0 0 0 2.5-4z"/></svg>
            </button>
          </div>
          ${n > 1 ? vcarSlideHTML(videos[nextIdx], nextIdx, "side side--next") : ""}
          <button type="button" class="vcar-arrow vcar-arrow--next" aria-label="วิดีโอถัดไป">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M9 5l7 7-7 7"/></svg>
          </button>
        </div>
      </div>
      ${(title || desc) ? `<div class="video-caption">${title ? `<h3>${title}</h3>` : ""}${desc ? `<p>${desc}</p>` : ""}</div>` : ""}
      ${n > 1 ? `<div class="vcar-dots">${videos.map((_, i) => `<span class="vcar-dot${i === activeIndex ? " active" : ""}" data-idx="${i}"></span>`).join("")}</div>` : ""}
    </div>`;
}

async function renderIntroVideo() {
  const wrap = document.getElementById("home-intro-video");
  if (!wrap) return;
  try {
    const settings = await getSettings();
    let videos = (settings && Array.isArray(settings.introVideos))
      ? settings.introVideos.filter(v => v && v.url)
      : [];
    if (!videos.length && settings && settings.introVideo && settings.introVideo.url) {
      videos = [settings.introVideo]; // เว็บรุ่นเก่าที่ยังตั้งค่าไว้แบบวิดีโอเดียว
    }
    if (!videos.length) return; // ยังไม่ได้ตั้งค่าวิดีโอ → ปล่อยการ์ด "รออัพเดต" เดิมในหน้าแสดงต่อไป
    videos = videos.slice(0, 10);

    let activeIndex = 0;
    let timer = null;

    function goTo(idx) {
      const n = videos.length;
      activeIndex = ((idx % n) + n) % n;
      wrap.innerHTML = vcarBuildHTML(videos, activeIndex);
      bind();
    }

    function startAutoplay() {
      stopAutoplay();
      if (videos.length < 2) return;
      timer = window.setInterval(() => goTo(activeIndex + 1), VCAR_AUTOPLAY_MS);
    }
    function stopAutoplay() {
      if (timer) { window.clearInterval(timer); timer = null; }
    }

    function bind() {
      const vcar = wrap.querySelector(".vcar");
      if (!vcar) return;
      vcar.addEventListener("mouseenter", stopAutoplay);
      vcar.addEventListener("mouseleave", startAutoplay);

      const prevBtn = vcar.querySelector(".vcar-arrow--prev");
      const nextBtn = vcar.querySelector(".vcar-arrow--next");
      if (prevBtn) prevBtn.addEventListener("click", () => goTo(activeIndex - 1));
      if (nextBtn) nextBtn.addEventListener("click", () => goTo(activeIndex + 1));

      vcar.querySelectorAll(".vcar-slide--side").forEach(el => {
        el.addEventListener("click", () => goTo(Number(el.dataset.idx)));
      });
      vcar.querySelectorAll(".vcar-dot").forEach(el => {
        el.addEventListener("click", () => goTo(Number(el.dataset.idx)));
      });

      // การ์ดข้างๆ ที่ไม่มีรูปปก ใช้ <video preload="auto"> แทน — ต้องรอให้
      // เบราว์เซอร์ถอดรหัสเฟรมจริงพร้อมแสดง (loadeddata) ก่อนค่อย seek ไปยัง
      // จุดที่ไม่ใช่เฟรมแรกสุดของคลิป (มักเบลอ/มืดจากคีย์เฟรมเปิด) ถ้า seek
      // ตอน loadedmetadata เพียงอย่างเดียวจะยังไม่มีข้อมูลภาพจริง ทำให้ภาพ
      // ตัวอย่างที่ได้ดูเบลอ/พร่ามัว
      vcar.querySelectorAll(".vcar-slide-media--video").forEach(vid => {
        const seekToFrame = () => {
          try { vid.currentTime = Math.min(0.6, Math.max(0.15, (vid.duration || 2) / 6)); } catch (e) { /* no-op */ }
        };
        if (vid.readyState >= 2) seekToFrame();
        else vid.addEventListener("loadeddata", seekToFrame, { once: true });
      });

      const muteBtn = vcar.querySelector(".vcar-mute-toggle");
      const player = vcar.querySelector(".vcar-player");
      if (muteBtn && player) {
        muteBtn.addEventListener("click", () => {
          const iconMuted = muteBtn.querySelector(".vcar-icon-muted");
          const iconUnmuted = muteBtn.querySelector(".vcar-icon-unmuted");
          if (player.tagName === "VIDEO") {
            player.muted = !player.muted;
            iconMuted.style.display = player.muted ? "" : "none";
            iconUnmuted.style.display = player.muted ? "none" : "";
          } else {
            // YouTube iframe — โหลดใหม่พร้อม mute=0 เพื่อเปิดเสียง (ต้องอาศัย gesture การคลิกนี้)
            const isMuted = muteBtn.dataset.muted === "1";
            player.src = player.src.replace(/([?&])mute=\d/, `$1mute=${isMuted ? 0 : 1}`);
            muteBtn.dataset.muted = isMuted ? "0" : "1";
            iconMuted.style.display = isMuted ? "none" : "";
            iconUnmuted.style.display = isMuted ? "" : "none";
          }
        });
      }
    }

    fadeSwap(wrap, () => {
      wrap.innerHTML = vcarBuildHTML(videos, activeIndex);
      bind();
      startAutoplay();
    });
  } catch (err) {
    console.warn("[home-dynamic] โหลดวิดีโอแนะนำสินค้าไม่สำเร็จ ใช้การ์ด \"รออัพเดต\" เดิมในหน้าแทน:", err);
  }
}

renderFaqs();
renderPartnerLogos();
renderClientLogos();
renderTestimonials();
renderLatestBlogs();
renderFeaturedProducts();
renderStarredWorks();
renderPromoUpdates();
renderIntroVideo();
