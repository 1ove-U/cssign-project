// ===========================
// js/admin-settings-videos.js — SETTINGS — วิดีโอแนะนำสินค้า (หน้าแรก) — การ์ดวิดีโอแนวตั้งเลื่อนได้
// เก็บเป็น settings.introVideos: [{ url, poster, title, desc }, ...] (สูงสุด 10)
// รองรับอ่าน settings.introVideo (ตัวเดียว) แบบเก่าไว้เป็น fallback ตอนโหลด
//
// 2026 refactor phase 2: ย้ายมาจาก js/admin-page.js เดิม (ส่วน "SETTINGS — วิดีโอแนะนำสินค้า"
// บรรทัด 3932-4166 เดิม) แบบไม่เปลี่ยน behavior ใดๆ — เช็คด้วย diff กับต้นฉบับแล้วตรงทุกตัวอักษร
// ยกเว้นจุดที่ตั้งใจแยกไฟล์ (เพิ่ม `export` หน้า `renderVideoSettings`)
//
// export `renderVideoSettings()` ตามแผนเดิม
// ===========================
import { uploadImage, uploadFile } from "./db-media.js";
import { saveSettings } from "./db-settings.js";
import { logAudit } from "./db.js";
import { showToast, escapeHtml, imageGridHTML } from "./admin-utils.js";

const VIDEOS_MAX = 10;
const videosListBox  = document.getElementById("ad-videos-list");
const videosAddBtn   = document.getElementById("ad-videos-add");
const videosSaveBtn  = document.getElementById("ad-videos-save");
const videosStatus   = document.getElementById("ad-videos-status");

// ดึง YouTube video ID จากลิงก์ เพื่อโชว์รูปตัวอย่าง (thumbnail) ในการ์ดแอดมิน
// เอง — รูปแบบเดียวกับ extractYouTubeId() ใน home-dynamic.js (คนละไฟล์/สโคป จึงแยกไว้ที่นี่)
function adminExtractYouTubeId(url) {
  const m = String(url || "").match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/i);
  return m ? m[1] : "";
}

let currentVideos = []; // [{ url, poster, title, desc }]

function videoItemHTML(video, i) {
  const url = (video.url || "").trim();
  const isDirectFile = /\.(mp4|webm|ogg)(\?.*)?$/i.test(url);
  const ytId = adminExtractYouTubeId(url);
  const thumbSrc = video.poster || (ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : "");
  const hasUrl = !!url;
  return `
    <div class="ad-video-item" data-idx="${i}">
      <div class="ad-video-item-head">
        <span class="ad-video-item-num">วิดีโอที่ ${i + 1}</span>
        <span class="ad-video-item-status ${hasUrl ? "is-ready" : "is-empty"}">${hasUrl ? "● พร้อมแสดงผล" : "○ ยังไม่ได้ตั้งค่า"}</span>
        <span class="ad-video-item-actions">
          <button type="button" class="ad-video-item-move" data-act="up" data-idx="${i}" ${i === 0 ? "disabled" : ""} title="เลื่อนขึ้น">↑</button>
          <button type="button" class="ad-video-item-move" data-act="down" data-idx="${i}" ${i === currentVideos.length - 1 ? "disabled" : ""} title="เลื่อนลง">↓</button>
          <button type="button" class="ad-video-item-remove" data-act="remove" data-idx="${i}" title="ลบวิดีโอนี้">×</button>
        </span>
      </div>

      <div class="ad-video-preview">${
        thumbSrc
          ? `<img src="${escapeHtml(thumbSrc)}" alt="ตัวอย่างวิดีโอที่ ${i + 1}">`
          : (hasUrl && isDirectFile)
            ? `<div class="ad-video-preview-placeholder">🎬 ไฟล์วิดีโออัปโหลดแล้ว (ยังไม่มีรูปปก — ใส่ด้านล่างได้)</div>`
            : `<div class="ad-video-preview-placeholder">ยังไม่มีตัวอย่าง — วางลิงก์หรืออัปโหลดไฟล์ด้านล่าง</div>`
      }</div>

      <div class="ad-field">
        <label for="ad-video-url-${i}">ลิงก์วิดีโอ — วาง URL YouTube หรือไฟล์ .mp4/.webm</label>
        <input type="text" id="ad-video-url-${i}" class="cl-input ad-video-url" data-idx="${i}" placeholder="เช่น https://www.youtube.com/watch?v=xxxxx" value="${escapeHtml(url)}">
      </div>
      <div class="ad-video-or-divider"><span>หรือ</span></div>
      <label class="ad-upload-btn">
        <input type="file" class="ad-video-file-upload" data-idx="${i}" accept="video/*" hidden>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
        อัปโหลดไฟล์วิดีโอจากเครื่อง (ไม่เกิน ~50MB) — เติมลิงก์ด้านบนให้อัตโนมัติ
      </label>
      <div class="ad-upload-status ad-video-file-upload-status" data-idx="${i}"></div>
      ${(url && isDirectFile) ? `<div class="ad-video-current">ไฟล์ปัจจุบัน: <a href="${escapeHtml(url)}" target="_blank" rel="noopener">เปิดดู</a></div>` : ""}

      <div class="cp-modal-row">
        <div class="ad-field"><label for="ad-video-title-${i}">ชื่อวิดีโอ (ไม่บังคับ)</label><input type="text" id="ad-video-title-${i}" class="cl-input ad-video-title" data-idx="${i}" value="${escapeHtml(video.title || "")}"></div>
        <div class="ad-field"><label for="ad-video-desc-${i}">คำอธิบายสั้นๆ (ไม่บังคับ)</label><input type="text" id="ad-video-desc-${i}" class="cl-input ad-video-desc" data-idx="${i}" value="${escapeHtml(video.desc || "")}"></div>
      </div>

      <div class="ad-field">
        <label>รูปปกวิดีโอ (ไม่บังคับ — ลิงก์ YouTube ดึงให้อัตโนมัติ)</label>
        <div class="ad-img-grid ad-video-poster-box" data-idx="${i}">${video.poster
          ? imageGridHTML([video.poster], false)
          : `<div class="ad-img-empty">ยังไม่มีรูปปก</div>`}</div>
        <label class="ad-upload-btn">
          <input type="file" class="ad-video-poster-upload" data-idx="${i}" accept="image/*" hidden>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
          อัปโหลดรูปปก
        </label>
        <div class="ad-upload-status ad-video-poster-upload-status" data-idx="${i}"></div>
      </div>
    </div>`;
}

function renderVideosList() {
  if (!currentVideos.length) {
    videosListBox.innerHTML = `<div class="ad-videos-empty">ยังไม่มีวิดีโอ — กด "+ เพิ่มวิดีโอ" ด้านล่างเพื่อเริ่ม (หน้าแรกจะขึ้น "รออัพเดต" จนกว่าจะมีอย่างน้อย 1 คลิป)</div>`;
    return;
  }
  videosListBox.innerHTML = currentVideos.map(videoItemHTML).join("");
}

// อัปเดตแค่รูปตัวอย่าง + ป้ายสถานะของการ์ดวิดีโอตัวเดียว (ไม่ re-render ทั้งลิสต์)
// ใช้ตอนพิมพ์ลิงก์วิดีโอ เพื่อให้เห็นตัวอย่างเปลี่ยนแบบ real-time โดยไม่ทำให้ช่องกรอกเสียโฟกัส
function updateVideoPreview(idx) {
  const video = currentVideos[idx];
  const item = videosListBox.querySelector(`.ad-video-item[data-idx="${idx}"]`);
  if (!video || !item) return;
  const url = (video.url || "").trim();
  const hasUrl = !!url;
  const isDirectFile = /\.(mp4|webm|ogg)(\?.*)?$/i.test(url);
  const ytId = adminExtractYouTubeId(url);
  const thumbSrc = video.poster || (ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : "");

  const statusEl = item.querySelector(".ad-video-item-status");
  if (statusEl) {
    statusEl.className = `ad-video-item-status ${hasUrl ? "is-ready" : "is-empty"}`;
    statusEl.textContent = hasUrl ? "● พร้อมแสดงผล" : "○ ยังไม่ได้ตั้งค่า";
  }
  const previewEl = item.querySelector(".ad-video-preview");
  if (previewEl) {
    previewEl.innerHTML = thumbSrc
      ? `<img src="${escapeHtml(thumbSrc)}" alt="ตัวอย่างวิดีโอที่ ${idx + 1}">`
      : (hasUrl && isDirectFile)
        ? `<div class="ad-video-preview-placeholder">🎬 ไฟล์วิดีโออัปโหลดแล้ว (ยังไม่มีรูปปก — ใส่ด้านล่างได้)</div>`
        : `<div class="ad-video-preview-placeholder">ยังไม่มีตัวอย่าง — วางลิงก์หรืออัปโหลดไฟล์ด้านล่าง</div>`;
  }
}

export function renderVideoSettings(settings) {
  currentVideos = (settings && Array.isArray(settings.introVideos))
    ? settings.introVideos.map(v => ({ url: v.url || "", poster: v.poster || "", title: v.title || "", desc: v.desc || "" })).filter(v => v.url)
    : [];
  if (!currentVideos.length && settings && settings.introVideo && settings.introVideo.url) {
    const v = settings.introVideo;
    currentVideos = [{ url: v.url || "", poster: v.poster || "", title: v.title || "", desc: v.desc || "" }];
  }
  renderVideosList();
}

if (videosAddBtn) {
  videosAddBtn.addEventListener("click", () => {
    if (currentVideos.length >= VIDEOS_MAX) {
      showToast(`เพิ่มวิดีโอได้สูงสุด ${VIDEOS_MAX} คลิป`);
      return;
    }
    currentVideos.push({ url: "", poster: "", title: "", desc: "" });
    renderVideosList();
  });
}

if (videosListBox) {
  videosListBox.addEventListener("click", async (e) => {
    const moveBtn = e.target.closest(".ad-video-item-move");
    if (moveBtn) {
      const idx = Number(moveBtn.dataset.idx);
      const dir = moveBtn.dataset.act === "up" ? -1 : 1;
      const swapIdx = idx + dir;
      if (swapIdx < 0 || swapIdx >= currentVideos.length) return;
      [currentVideos[idx], currentVideos[swapIdx]] = [currentVideos[swapIdx], currentVideos[idx]];
      renderVideosList();
      return;
    }
    const removeBtn = e.target.closest(".ad-video-item-remove");
    if (removeBtn) {
      currentVideos.splice(Number(removeBtn.dataset.idx), 1);
      renderVideosList();
      return;
    }
    const posterRemoveBtn = e.target.closest(".ad-img-remove");
    if (posterRemoveBtn) {
      const box = e.target.closest(".ad-video-poster-box");
      const idx = Number(box.dataset.idx);
      if (currentVideos[idx]) {
        currentVideos[idx].poster = "";
        renderVideosList();
      }
    }
  });

  videosListBox.addEventListener("input", (e) => {
    const idx = Number(e.target.dataset.idx);
    if (Number.isNaN(idx) || !currentVideos[idx]) return;
    if (e.target.classList.contains("ad-video-url")) {
      currentVideos[idx].url = e.target.value;
      updateVideoPreview(idx);
    }
    if (e.target.classList.contains("ad-video-title")) currentVideos[idx].title = e.target.value;
    if (e.target.classList.contains("ad-video-desc"))  currentVideos[idx].desc  = e.target.value;
  });

  videosListBox.addEventListener("change", async (e) => {
    const idx = Number(e.target.dataset.idx);
    if (Number.isNaN(idx) || !currentVideos[idx]) return;

    if (e.target.classList.contains("ad-video-file-upload")) {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const statusEl = videosListBox.querySelector(`.ad-video-file-upload-status[data-idx="${idx}"]`);
      if (statusEl) statusEl.textContent = "กำลังอัปโหลดวิดีโอ... (ไฟล์ใหญ่อาจใช้เวลาสักครู่)";
      try {
        const url = await uploadFile(file, "paisign/videos");
        currentVideos[idx].url = url;
        renderVideosList();
      } catch (err) {
        if (statusEl) statusEl.textContent = "";
        showToast("อัปโหลดวิดีโอไม่สำเร็จ: " + err.message + " (เช็คว่า Cloudinary preset เปิดรับไฟล์วิดีโอหรือยัง)");
      }
      e.target.value = "";
      return;
    }

    if (e.target.classList.contains("ad-video-poster-upload")) {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const statusEl = videosListBox.querySelector(`.ad-video-poster-upload-status[data-idx="${idx}"]`);
      if (statusEl) statusEl.textContent = "กำลังอัปโหลด...";
      try {
        currentVideos[idx].poster = await uploadImage(file);
        renderVideosList();
      } catch (err) {
        if (statusEl) statusEl.textContent = "";
        showToast("อัปโหลดรูปไม่สำเร็จ: " + err.message);
      }
      e.target.value = "";
      return;
    }
  });
}

if (videosSaveBtn) {
  videosSaveBtn.addEventListener("click", async () => {
    const payload = currentVideos.filter(v => v.url && v.url.trim()).slice(0, VIDEOS_MAX);
    videosSaveBtn.disabled = true;
    const originalLabel = videosSaveBtn.textContent;
    videosSaveBtn.textContent = "กำลังบันทึก...";
    videosStatus.textContent = "";
    try {
      await saveSettings({ introVideos: payload });
      videosStatus.textContent = "บันทึกสำเร็จ — หน้าแรกจะอัปเดตตามนี้ในการโหลดครั้งถัดไป";
      logAudit("update", "intro-video", "", `อัปเดตวิดีโอแนะนำสินค้า (${payload.length} คลิป)`);
    } catch (err) {
      showToast("บันทึกไม่สำเร็จ: " + err.message);
    } finally {
      videosSaveBtn.disabled = false;
      videosSaveBtn.textContent = originalLabel;
    }
  });
}
