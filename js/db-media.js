// ===========================
// js/db-media.js — Data layer: อัปโหลด/ลบรูปและไฟล์บน Cloudinary
// ===========================
// 2026 refactor phase 4: แยกออกมาจาก js/db.js เดิม (589 บรรทัด) — ดูหมายเหตุเต็มใน
// js/db.js ไฟล์นี้เก็บเฉพาะส่วน Cloudinary (compressImage/uploadImage/uploadFile/
// deleteImage) ซึ่งเป็น utility ที่ไฟล์ CRUD เนื้อหาเว็บไซต์หลายไฟล์เรียกใช้ร่วมกัน
// (ผลิตภัณฑ์/บล็อก/พันธมิตร/เสียงจากลูกค้า/ผลงาน) จึงแยกเป็นไฟล์กลางแยกต่างหาก แทนที่จะ
// ผูกไว้กับ collection ใด collection หนึ่ง — ไม่มีการเปลี่ยน logic ใดๆ จากของเดิม เป็นแค่
// ย้ายโค้ดเชิงโครงสร้าง (ดู diff เทียบกับ js/db.js ฉบับก่อนแตกไฟล์) — ค่าคงที่
// CLOUDINARY_CLOUD_NAME/CLOUDINARY_UPLOAD_PRESET/CLOUDINARY_DELETE_WORKER_URL ย้ายมา
// อยู่ที่นี่ด้วยเพราะใช้เฉพาะในไฟล์นี้เท่านั้น
//
// เหตุผลที่ยังต้อง import { auth } กลับจาก js/db.js: Auth instance ต้องถูก getAuth()
// แค่ครั้งเดียวต่อแอป (ทำใน js/db.js) ไฟล์นี้จึงใช้ instance เดียวกันแทนที่จะสร้างใหม่ซ้ำ
// — ไม่ใช่ circular import (js/db.js ไม่ import อะไรกลับจากไฟล์นี้)
// ===========================
import { auth } from "./db.js";

// ── Cloudinary Config ─────────────────────────────
const CLOUDINARY_CLOUD_NAME   = "dizd3payw";
const CLOUDINARY_UPLOAD_PRESET = "paisign_unsigned";

// URL ของ Cloudflare Worker ที่ลบรูปบน Cloudinary จริง (ดู cloudflare-worker/README.md)
// ต้องแก้เป็น URL จริงหลัง deploy Worker แล้ว
const CLOUDINARY_DELETE_WORKER_URL = "https://cssign-cloudinary-delete.zillergotspw.workers.dev";

// ย่อ/บีบอัดรูปฝั่ง browser ก่อนอัปโหลด — ลดเวลาอัปโหลดและประหยัด bandwidth
// โดยเฉพาะรูปที่ถ่ายจากมือถือซึ่งมักมีขนาดไฟล์หลาย MB
async function compressImage(file, maxDim = 1600, quality = 0.82) {
  if (!file.type || !file.type.startsWith("image/") || file.type === "image/svg+xml") return file;
  try {
    const bitmap = await createImageBitmap(file);
    let { width, height } = bitmap;
    if (width <= maxDim && height <= maxDim && file.size < 600 * 1024) {
      bitmap.close && bitmap.close();
      return file; // ไฟล์เล็กพออยู่แล้ว ไม่ต้องบีบซ้ำ
    }
    const scale = Math.min(1, maxDim / Math.max(width, height));
    const targetW = Math.round(width * scale);
    const targetH = Math.round(height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bitmap, 0, 0, targetW, targetH);
    bitmap.close && bitmap.close();
    const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", quality));
    if (!blob) return file;
    return new File([blob], (file.name || "image").replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch (err) {
    console.warn("compressImage: ข้ามการบีบอัด ใช้ไฟล์ต้นฉบับแทน", err);
    return file;
  }
}

// ===========================
// CLOUDINARY — อัปโหลดรูปภาพ
// ===========================
export async function uploadImage(file) {
  const optimized = await compressImage(file);
  const formData = new FormData();
  formData.append("file", optimized);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  formData.append("folder", "paisign/products");

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
    { method: "POST", body: formData }
  );
  if (!res.ok) throw new Error("อัปโหลดรูปไม่สำเร็จ");
  const data = await res.json();
  return data.secure_url.replace("/upload/", "/upload/f_auto,q_auto,w_900,h_900,c_limit/");
}

// อัปโหลดไฟล์ทั่วไป (เช่น PDF แคตตาล็อก) — ใช้ resource_type "auto"
// หมายเหตุ: Cloudinary unsigned upload preset ต้องเปิดรับไฟล์ประเภท raw/pdf ไว้ด้วย
// (ตั้งค่าได้ที่ Cloudinary Console → Settings → Upload → แก้ preset ที่ใช้อยู่)
export async function uploadFile(file, folder = "paisign/files") {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  formData.append("folder", folder);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`,
    { method: "POST", body: formData }
  );
  if (!res.ok) throw new Error("อัปโหลดไฟล์ไม่สำเร็จ (เช็คว่า Cloudinary preset เปิดรับไฟล์ประเภทนี้หรือยัง)");
  const data = await res.json();
  return data.secure_url;
}

// แกะ resource_type + public_id จาก URL ของ Cloudinary เพื่อส่งไปให้ Cloud Function ลบจริง
// รองรับทั้ง URL ธรรมดา และ URL ที่มี transformation อยู่ก่อน public_id
// (เช่น uploadImage() ข้างบนจะแทรก "f_auto,q_auto,w_900,h_900,c_limit" ไว้หลัง /upload/)
//   ตัวอย่าง: https://res.cloudinary.com/xxx/image/upload/f_auto,q_auto/v123/paisign/products/abc.jpg
//   → { resourceType: "image", publicId: "paisign/products/abc" }
function parseCloudinaryUrl(url) {
  const m = typeof url === "string" && url.match(/\/(image|video|raw)\/upload\/(.+)$/);
  if (!m) return null;
  const resourceType = m[1];
  const segments = m[2].split("?")[0].split("/");
  // ตัด segment transformation (เช่น "f_auto,q_auto,w_900") และ segment เวอร์ชัน
  // (เช่น "v1699999999") ทิ้งไปเรื่อยๆ จนกว่าจะเจอ segment แรกของ public_id จริง
  while (
    segments.length &&
    (/^v\d+$/.test(segments[0]) || /^[a-z]{1,3}_[^/]+$/.test(segments[0]))
  ) {
    segments.shift();
  }
  const publicIdWithExt = segments.join("/");
  if (!publicIdWithExt) return null;
  const lastDot = publicIdWithExt.lastIndexOf(".");
  const publicId = lastDot === -1 ? publicIdWithExt : publicIdWithExt.slice(0, lastDot);
  return { resourceType, publicId };
}

export async function deleteImage(url) {
  const parsed = parseCloudinaryUrl(url);
  if (!parsed) {
    console.warn("deleteImage: อ่านข้อมูลจาก Cloudinary URL ไม่ได้ ข้ามการลบ", url);
    return;
  }
  if (!auth.currentUser) {
    console.warn("deleteImage: ต้อง login ก่อนถึงจะลบรูปได้ ข้ามการลบ", url);
    return;
  }

  const idToken = await auth.currentUser.getIdToken();
  const res = await fetch(CLOUDINARY_DELETE_WORKER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(parsed),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`ลบรูปบน Cloudinary ไม่สำเร็จ: ${data.error || res.status}`);
  }
  return data;
}
