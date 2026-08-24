// ===========================
// js/home-dynamic-showcase-video.js — ส่วน "วิดีโอแนะนำสินค้า" ของหน้าแรก
// (js/home-dynamic-showcase.js) — carousel วิดีโอแนวตั้ง (reel) รองรับทั้งลิงก์
// YouTube และไฟล์วิดีโอ (.mp4/.webm), เล่นอัตโนมัติอันกลาง, ปุ่มเปิด/ปิดเสียง,
// เลื่อนเอง/เลื่อนมือ/คลิกข้างๆ
//
// 2026 refactor phase 7: แยกออกมาจาก js/home-dynamic-showcase.js เดิม (486
// บรรทัด) — ย้ายบล็อก "วิดีโอแนะนำสินค้า" ทั้งหมด (บรรทัด 281-480 เดิม: comment
// block, extractYouTubeId/isDirectVideoUrl/VCAR_AUTOPLAY_MS/vcarPosterUrl/
// vcarSlideHTML/vcarCenterPlayerHTML/vcarBuildHTML/renderIntroVideo) มาทั้งหมด
// แบบ diff เป๊ะ ไม่มีเปลี่ยน logic — home-dynamic-showcase.js ยังคงมี 3 ส่วนที่
// เหลือ (สินค้าแนะนำ/ผลงานเด่น/โปรโมชั่น-ข่าว) เหมือนเดิม เป็นจุดตัดไฟล์ที่สะอาด
// เพราะส่วนนี้ไม่มี state หรือ helper ร่วมกับอีก 3 ส่วนเลย (ใช้แค่ getSettings()/
// escapeHtml()/fadeSwap() ซึ่ง import ตรงจากไฟล์เดิมอยู่แล้ว ไม่ต้องเพิ่ม setter
// ใดๆ เพราะไม่มีตัวแปรถูก reassign ข้ามไฟล์)
//
// export ออกไปให้ js/home-dynamic-showcase.js เรียกใช้:
//   - renderIntroVideo() — เรียกครั้งเดียวตอนโหลดหน้า (เดิมเรียกที่บรรทัดสุดท้าย
//     ของไฟล์เดิม ตอนนี้ import มาเรียกแทน)
// ===========================
import { getSettings } from "./db-settings.js";
import { escapeHtml, fadeSwap } from "./home-dynamic.js";

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

export async function renderIntroVideo() {
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
          try { vid.currentTime = Math.min(0.6, Math.max(0.15, (vid.duration || 2) / 6)); } catch { /* no-op */ }
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
