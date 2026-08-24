// ===========================
// js/admin-settings-contact.js — SETTINGS — ข้อมูลติดต่อทั้งเว็บไซต์
//
// 2026 refactor phase 2: ย้ายมาจาก js/admin-page.js เดิม (ส่วน "SETTINGS — ข้อมูลติดต่อ
// ทั้งเว็บไซต์" บรรทัด 3773-3813 เดิม) แบบไม่เปลี่ยน behavior ใดๆ — เช็คด้วย diff กับต้นฉบับ
// แล้วตรงทุกตัวอักษร ยกเว้นจุดที่ตั้งใจแยกไฟล์ (เพิ่ม `export` หน้า `renderContactSettings`)
//
// export `renderContactSettings()` ตามแผนเดิม
// ===========================
import { saveSettings } from "./db-settings.js";
import { showToast } from "./admin-utils.js";

const sForm   = document.getElementById("ad-s-form");
const sStatus = document.getElementById("ad-s-status");

export function renderContactSettings(settings) {
  document.getElementById("ad-s-phone").value        = (settings && settings.phone) || "";
  document.getElementById("ad-s-phone2").value        = (settings && settings.phone2) || "";
  document.getElementById("ad-s-fax").value           = (settings && settings.fax) || "";
  document.getElementById("ad-s-email").value         = (settings && settings.email) || "";
  document.getElementById("ad-s-line-url").value      = (settings && settings.lineUrl) || "";
  document.getElementById("ad-s-facebook-url").value  = (settings && settings.facebookUrl) || "";
  document.getElementById("ad-s-address").value       = (settings && settings.address) || "";
}

sForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const payload = {
    phone:       document.getElementById("ad-s-phone").value.trim(),
    phone2:      document.getElementById("ad-s-phone2").value.trim(),
    fax:         document.getElementById("ad-s-fax").value.trim(),
    email:       document.getElementById("ad-s-email").value.trim(),
    lineUrl:     document.getElementById("ad-s-line-url").value.trim(),
    facebookUrl: document.getElementById("ad-s-facebook-url").value.trim(),
    address:     document.getElementById("ad-s-address").value.trim()
  };
  const btn = sForm.querySelector('button[type=submit]');
  btn.disabled = true; btn.textContent = "กำลังบันทึก...";
  sStatus.textContent = "";
  try {
    await saveSettings(payload);
    sStatus.textContent = "บันทึกสำเร็จ — เว็บไซต์จะใช้ข้อมูลใหม่นี้ในการโหลดครั้งถัดไปทุกหน้า";
  } catch (err) {
    sStatus.textContent = "";
    showToast("บันทึกไม่สำเร็จ: " + err.message);
  } finally {
    btn.disabled = false; btn.textContent = "บันทึกข้อมูลติดต่อ";
  }
});
