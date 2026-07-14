/**
 * CS.SIGN — turnstile.js
 * โหลดและควบคุม Cloudflare Turnstile widget แบบใช้ร่วมกันได้ทุกฟอร์มในเว็บ
 * (contact form, inline contact form, catalog download form, qmodal ขอใบเสนอราคา)
 *
 * วิธีตั้งค่าให้ใช้งานจริงบน production:
 * 1) ไปที่ https://dash.cloudflare.com/?to=/:account/turnstile แล้วสร้าง Widget
 *    ใหม่ ตั้ง domain เป็นโดเมนจริงของเว็บ (เช่น cssign.co.th)
 * 2) เอา "Site Key" ที่ได้มาแทนค่า TURNSTILE_SITE_KEY ด้านล่างนี้
 * 3) เอา "Secret Key" ไปตั้งเป็น secret ฝั่ง Firebase Functions แล้ว deploy ใหม่
 *      firebase functions:secrets:set TURNSTILE_SECRET_KEY
 *      firebase deploy --only functions
 *    (ฟังก์ชันฝั่ง server อยู่ใน functions/index.js -> verifyTurnstile และถูกเรียก
 *    จาก js/leads.js ก่อนบันทึก lead ทุกครั้ง)
 *
 * หมายเหตุ: ตอนนี้ตั้งค่าเป็น Cloudflare "test site key" (1x0000...AA) ซึ่ง
 * "ผ่านทุกครั้ง" ไว้ให้ demo ใช้งานได้ทันทีโดยไม่ต้องสมัคร Cloudflare ก่อน
 * แต่คีย์นี้ไม่ป้องกันบอทจริง ต้องเปลี่ยนเป็น Site Key ของจริงก่อนใช้งานจริง
 *
 * UI: ห่อ widget ด้วยการ์ดโทนเดียวกับเว็บ (label + loading skeleton + error
 * state ที่กดลองใหม่ได้) แทนที่จะปล่อยเป็นกล่องเปล่าๆ รอ iframe ของ Cloudflare
 */

export const TURNSTILE_SITE_KEY = '1x00000000000000000000AA';

const API_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=__csTurnstileReady&render=explicit';

const SHIELD_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l7 3v6c0 4.5-3 8-7 9-4-1-7-4.5-7-9V6l7-3z"/></svg>';
const WARN_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M12 8.5v4.6M12 17h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>';

let apiPromise = null;

function loadApi() {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve, reject) => {
    window.__csTurnstileReady = () => resolve(window.turnstile);
    const s = document.createElement('script');
    s.src = API_URL;
    s.async = true;
    s.defer = true;
    s.onerror = () => reject(new Error('โหลด Cloudflare Turnstile ไม่สำเร็จ'));
    document.head.appendChild(s);
  });
  return apiPromise;
}

/** สร้างโครงการ์ด (label + กล่องสำหรับ widget) รอบ container ครั้งแรกที่ mount */
function ensureCard(container) {
  if (container.dataset.tsCardBuilt) {
    return {
      card: container.querySelector('.cs-turnstile-card'),
      box: container.querySelector('.cs-turnstile-box')
    };
  }
  container.innerHTML =
    '<div class="cs-turnstile-card">' +
      '<div class="cs-turnstile-label">' + SHIELD_ICON + '<span>ยืนยันตัวตนก่อนส่งฟอร์ม (ป้องกันสแปม)</span></div>' +
      '<div class="cs-turnstile-box">' +
        '<div class="cs-turnstile-loading"><span class="cs-turnstile-spinner" aria-hidden="true"></span>กำลังโหลดระบบยืนยันตัวตน...</div>' +
      '</div>' +
    '</div>';
  container.dataset.tsCardBuilt = '1';
  return {
    card: container.querySelector('.cs-turnstile-card'),
    box: container.querySelector('.cs-turnstile-box')
  };
}

function renderWidget(container, box) {
  return loadApi().then((ts) => {
    box.innerHTML = '';
    const id = ts.render(box, {
      sitekey: TURNSTILE_SITE_KEY,
      theme: 'light',
      size: 'flexible',
      'error-callback': () => { showError(container); },
      'expired-callback': () => { /* ผู้ใช้ต้องกดยืนยันใหม่เอง — ปุ่มถัดไปจะเช็ค token ให้ */ }
    });
    container.dataset.tsWidgetId = id;
    container.dataset.tsMounted = '1';
  });
}

function showError(container) {
  container.dataset.tsMounted = 'error';
  const card = container.querySelector('.cs-turnstile-card');
  const box = container.querySelector('.cs-turnstile-box');
  if (card) card.classList.add('is-error');
  if (box) {
    box.innerHTML =
      '<div class="cs-turnstile-error">' + WARN_ICON +
      '<span>ระบบยืนยันตัวตนโหลดไม่สำเร็จ อาจเป็นเพราะการเชื่อมต่ออินเทอร์เน็ตหรือตัวบล็อกสคริปต์ ' +
      '<button type="button" class="cs-turnstile-retry">ลองอีกครั้ง</button></span></div>';
    const retryBtn = box.querySelector('.cs-turnstile-retry');
    if (retryBtn) {
      retryBtn.addEventListener('click', function () {
        if (card) card.classList.remove('is-error');
        box.innerHTML = '<div class="cs-turnstile-loading"><span class="cs-turnstile-spinner" aria-hidden="true"></span>กำลังโหลดระบบยืนยันตัวตน...</div>';
        container.dataset.tsMounted = 'pending';
        renderWidget(container, box).catch(() => showError(container));
      });
    }
  }
}

/**
 * วาด widget ลงใน container ที่ให้มา — เรียกซ้ำได้ปลอดภัย (no-op ถ้าวาดไปแล้ว)
 * ใช้แบบ lazy mount ตอนฟอร์มถูกเปิด/มองเห็น แทนที่จะโหลด script ตั้งแต่โหลดหน้าเว็บ
 */
export async function mountTurnstile(container) {
  if (!container || container.dataset.tsMounted) return;
  container.dataset.tsMounted = 'pending';
  const { box } = ensureCard(container);
  try {
    await renderWidget(container, box);
  } catch (err) {
    console.warn('CS.SIGN: Turnstile ใช้งานไม่ได้ในขณะนี้ (เช็คการเชื่อมต่ออินเทอร์เน็ต)', err);
    showError(container);
  }
}

/** คืนค่า token ปัจจุบันของ widget (ว่างถ้ายังไม่ได้ยืนยัน) */
export function getTurnstileToken(container) {
  if (!container || !window.turnstile || container.dataset.tsWidgetId === undefined) return '';
  try {
    return window.turnstile.getResponse(container.dataset.tsWidgetId) || '';
  } catch (err) {
    return '';
  }
}

/** รีเซ็ต widget ให้ยืนยันใหม่ — เรียกหลัง submit สำเร็จ/ล้มเหลว เพราะ token ใช้ได้ครั้งเดียว */
export function resetTurnstile(container) {
  if (!container || !window.turnstile || container.dataset.tsWidgetId === undefined) return;
  try {
    window.turnstile.reset(container.dataset.tsWidgetId);
  } catch (err) { /* เงียบไว้ — ไม่ใช่ error ที่ต้องรบกวนผู้ใช้ */ }
}
