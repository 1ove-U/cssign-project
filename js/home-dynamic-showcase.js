// ===========================
// js/home-dynamic-showcase.js — หน้าแรกเท่านั้น (ส่วนที่ 2/2)
// แสดงสินค้าแนะนำ / ผลงานเด่น / โปรโมชั่น-ข่าวอัพเดต / วิดีโอแนะนำสินค้า
// จากข้อมูลที่แอดมินกรอกไว้ (Firestore) ถ้ายังไม่มีข้อมูล จะปล่อยให้เนื้อหา
// เริ่มต้นในหน้า (hardcode) แสดงตามเดิม
//
// 2026 refactor: แยกออกมาจาก js/home-dynamic.js เดิม (862 บรรทัด) — ดูหมายเหตุ
// เต็มใน js/home-dynamic.js ไฟล์นี้เก็บเฉพาะ section ที่เป็นสื่อ/แกลเลอรี
// (สินค้าแนะนำ → ผลงานเด่น → โปรโมชั่น/ข่าว → วิดีโอแนะนำสินค้า) ตามลำดับเดิม
// ในไฟล์ต้นฉบับ ไม่มีการเปลี่ยน logic ใดๆ จากของเดิม เป็นแค่ย้ายโค้ดเชิงโครงสร้าง
//
// escapeHtml/fadeSwap import กลับจาก js/home-dynamic.js เพราะเป็น utility ที่
// ทั้ง 2 ไฟล์ใช้ร่วมกัน (ไม่ใช่ circular import — js/home-dynamic.js ไม่ import
// อะไรกลับจากไฟล์นี้เลย)
//
// 2026 refactor phase 7: แยกส่วน "วิดีโอแนะนำสินค้า" (บรรทัด 281-480 เดิมของ
// ไฟล์นี้) ออกไปเป็น js/home-dynamic-showcase-video.js (ใหม่) แบบ diff เป๊ะ
// ไม่มีเปลี่ยน logic — import renderIntroVideo() กลับมาเรียกที่ท้ายไฟล์เหมือน
// เดิม ไฟล์นี้ตอนนี้เหลือ 3 ส่วน: สินค้าแนะนำ / ผลงานเด่น / โปรโมชั่น-ข่าว
// ===========================
import { getProducts } from "./db-products.js";
import { getPortfolios } from "./db-content.js";
import { getSettings } from "./db-settings.js";
import { escapeHtml, fadeSwap } from "./home-dynamic.js";
import { renderIntroVideo } from "./home-dynamic-showcase-video.js";

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


renderFeaturedProducts();
renderStarredWorks();
renderPromoUpdates();
renderIntroVideo();
