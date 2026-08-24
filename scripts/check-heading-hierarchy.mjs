#!/usr/bin/env node
// ===========================================================
// scripts/check-heading-hierarchy.mjs
//
// ตรวจครั้งแรกในรอบที่ 55 — ไล่ทุกหน้า HTML ในโปรเจกต์ (TH root + en/ + admin.html/console.html)
// parse ลำดับ heading (h1-h6) ทั้งหมดต่อหน้าตามลำดับที่ปรากฏจริงใน DOM (document order) แล้วเช็คว่า
// "ข้ามระดับ" หรือไม่ — กฎเดียวกับที่ accessibility checker มาตรฐาน (axe-core rule "heading-order")
// ใช้: ระดับ heading ถัดไปจะ "ลึกลงกว่าเดิมได้ทีละ 1 ระดับเท่านั้น" (เช่น h1 -> h2 ผ่าน, h2 -> h3
// ผ่าน) ถ้าลึกลงมากกว่า 1 ระดับในคราวเดียว (เช่น h1 -> h3 ตรงๆ โดยไม่มี h2 คั่นก่อนหน้านั้นเลย) ถือ
// ว่า "ข้ามระดับ" ผิดหลัก heading hierarchy — ส่วนการ "ถอยขึ้น" (เช่น h3 -> h2 หรือ h3 -> h1) ไม่ถือ
// ว่าผิด เพราะเป็นการเริ่ม section ใหม่ในระดับที่สูงกว่า ซึ่งทำได้ปกติเสมอ
//
// วิธี parse — ใช้ jsdom จริง (ไม่ใช่ regex เดา) เพื่อให้ได้ document order ที่ถูกต้อง 100% และ
// เพื่อให้ HTML comment ที่มี tag heading ตัวอย่างอยู่ข้างในไม่ถูกนับปนเป็นของจริง (jsdom parse
// comment เป็น Comment node ไปเลย ไม่ใช่ Element จึงไม่ติด querySelectorAll มาด้วยอัตโนมัติ — บทเรียน
// จากรอบ 47 เรื่อง accessibility scan ต้อง strip comment ก่อนนับ)
//
// หมายเหตุสำคัญ: querySelectorAll("h1,h2,h3,h4,h5,h6") คืนผลลัพธ์เรียงตาม "document order" เสมอ
// (ไม่ใช่เรียงตามลำดับ selector ที่เขียนในสตริง) ตาม DOM spec ของ NodeList — จึงใช้ query เดียวจบ
// ได้เลย ไม่ต้อง query ทีละ level แล้วมา merge/sort เอง (ซึ่งจะผิดได้ง่ายกว่า)
//
// รายงานสิ่งที่ตรวจ (informational เพิ่มเติมนอกจากการข้ามระดับ ไม่ได้แก้อัตโนมัติ):
//   - จำนวน h1 ต่อหน้า (0 ตัว หรือมากกว่า 1 ตัว เป็นข้อสังเกต ไม่ใช่ "ข้ามระดับ" จึงแยกรายงานต่างหาก)
//   - ไม่รวม heading ที่อยู่ใน <template> เพราะไม่ได้ถูก render จริงในหน้า (jsdom เก็บ content ของ
//     <template> ไว้ใน .content ที่เป็น DocumentFragment แยกต่างหากจาก document tree หลักอยู่แล้ว
//     querySelectorAll บน document จึงไม่เห็นมันเอง ไม่ต้อง strip เพิ่ม)
//
// รัน: node scripts/check-heading-hierarchy.mjs   หรือ  npm run check-heading-hierarchy
// ===========================================================

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { JSDOM } from "jsdom";

const ROOT = new URL("..", import.meta.url).pathname;

function listHtmlFiles(dir) {
  return readdirSync(join(ROOT, dir))
    .filter((f) => f.endsWith(".html"))
    .map((f) => join(dir, f).replace(/\\/g, "/"));
}

const pages = [...listHtmlFiles("."), ...listHtmlFiles("en")].sort();

function textPreview(el) {
  const t = el.textContent.replace(/\s+/g, " ").trim();
  return t.length > 60 ? t.slice(0, 57) + "..." : t;
}

let totalSkips = 0;
let totalPagesWithSkips = 0;
const pagesNoH1 = [];
const pagesMultiH1 = [];

console.log("=== check-heading-hierarchy.mjs — ตรวจลำดับ heading (h1-h6) ทุกหน้าข้ามระดับหรือไม่ ===\n");
console.log(`หน้า HTML ที่ตรวจ: ${pages.length} หน้า\n`);

for (const page of pages) {
  const html = readFileSync(join(ROOT, page), "utf8");
  const dom = new JSDOM(html);
  const headings = [...dom.window.document.querySelectorAll("h1,h2,h3,h4,h5,h6")];

  if (headings.length === 0) continue;

  const h1Count = headings.filter((h) => h.tagName === "H1").length;
  if (h1Count === 0) pagesNoH1.push(page);
  if (h1Count > 1) pagesMultiH1.push(`${page} (${h1Count} ตัว)`);

  const skipsThisPage = [];
  let prevLevel = null;
  for (const h of headings) {
    const level = Number(h.tagName[1]);
    if (prevLevel !== null && level > prevLevel + 1) {
      skipsThisPage.push({
        from: prevLevel,
        to: level,
        text: textPreview(h),
      });
    }
    prevLevel = level;
  }

  if (skipsThisPage.length > 0) {
    totalPagesWithSkips++;
    totalSkips += skipsThisPage.length;
    console.log(`✗ ${page}`);
    for (const s of skipsThisPage) {
      console.log(`    h${s.from} -> h${s.to} (ข้าม h${s.from + 1}) ที่ "${s.text}"`);
    }
  }
}

console.log("");
if (totalSkips === 0) {
  console.log("✓ ไม่พบ heading ที่ข้ามระดับเลยทั้งโปรเจกต์");
} else {
  console.log(`✗ พบ heading ข้ามระดับรวม ${totalSkips} จุด ใน ${totalPagesWithSkips} หน้า`);
}

console.log("");
console.log(`ข้อสังเกตเพิ่มเติม (ไม่ใช่ "ข้ามระดับ" — แค่บันทึกไว้ให้ดู):`);
console.log(`  - หน้าที่ไม่มี h1 เลย: ${pagesNoH1.length ? pagesNoH1.join(", ") : "(ไม่มี)"}`);
console.log(`  - หน้าที่มี h1 มากกว่า 1 ตัว: ${pagesMultiH1.length ? pagesMultiH1.join(", ") : "(ไม่มี)"}`);

process.exitCode = totalSkips === 0 ? 0 : 1;
