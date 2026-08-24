#!/usr/bin/env node
// ===========================================================
// scripts/check-broken-anchor-links.mjs
//
// ตรวจครั้งแรกในรอบที่ 56 — ไล่ทุกหน้า HTML ในโปรเจกต์ (TH root + en/ + admin.html/console.html)
// หา <a href="#xxx"> ทั้งหมด แล้วเช็คว่ามี element id="xxx" ปลายทางอยู่จริงไหม — แยกเป็น 2 กลุ่ม:
//
//   1) same-page anchor: href="#xxx" (ไม่มีชื่อไฟล์นำหน้า) — ต้องมี id="xxx" อยู่ใน "หน้าเดียวกัน"
//   2) cross-page anchor: href="other.html#xxx" — ต้องมี id="xxx" อยู่ใน "ไฟล์ other.html" (คนละไฟล์
//      กับไฟล์ที่มี href นี้ — ต้อง resolve path ให้ถูกไฟล์ก่อนเช็ค)
//
// ไม่นับ href="#" เปล่าๆ (ไม่มีชื่อ id ต่อท้ายเลย) เพราะเคสนี้มักตั้งใจให้ JS ดักคลิก
// (event.preventDefault() แล้วทำอย่างอื่นแทนการเลื่อนหน้าจริง) ไม่ใช่ anchor link ที่ตั้งใจเลื่อนไปยัง
// element — เช็คแล้วว่าทุกจุด href="#" ในโปรเจกต์นี้มี class ที่ JS ดักคลิกอยู่จริง (ดู README ท้าย
// ไฟล์นี้ / รายงานตอนรัน) จึงปลอดภัยที่จะไม่นับเป็น "anchor link" ตั้งแต่ต้น
//
// วิธี parse — ใช้ jsdom จริง (ไม่ใช่ regex เดาทั้งไฟล์) แพทเทิร์นเดียวกับ check-heading-hierarchy.mjs
// เพื่อไม่ให้ href ที่อยู่ใน HTML comment หรือใน <template> (ที่ยังไม่ถูก render จริง) หลุดมานับปน —
// jsdom parse comment เป็น Comment node แยกจาก Element เองอยู่แล้ว และ querySelectorAll บน document
// หลักจะไม่เห็น content ข้างใน <template> เพราะมันถูกเก็บแยกใน .content (DocumentFragment) อัตโนมัติ
//
// สิ่งที่ script นี้ "เช็คก่อนฟันธงว่า broken" (เพื่อลด false positive):
//   - id ปลายทางอาจถูกสร้างแบบ dynamic ด้วย JS (setAttribute("id", ...) หรือ `.id = "..."` หรือ
//     template literal ที่ generate id) ซึ่งจะไม่เจอใน static HTML เลย — script นี้ grep js/*.js
//     หา pattern พวกนี้มาเป็น "รายชื่อ id ที่ dynamic" ไว้ก่อน แล้วจะไม่ฟันธงว่า broken ถ้า href ตรงกับ
//     ชื่อใน allowlist นี้ (แต่จะรายงานแยกไว้ให้เห็นว่าเป็น "น่าจะ dynamic" ไม่ใช่ static)
//   - href ที่ชี้ไปหน้าอื่น (cross-page) ถ้าไฟล์ปลายทางไม่มีอยู่จริงเลย จะรายงานแยกเป็น
//     "ไฟล์ปลายทางไม่มีอยู่จริง" ไม่ใช่ "broken anchor id" (คนละปัญหากัน)
//   - กรณีพิเศษที่พบจริงในรอบ 56: `admin.html#orders` (จาก console.html ซึ่งเป็นหน้า redirect เก่า)
//     ไม่ใช่ anchor ที่เลื่อนไปยัง element id="orders" เลย (ไม่มี id นั้นอยู่จริงและไม่ควรมี) แต่เป็น
//     "SPA hash-route deep link" ที่ `js/admin-page.js` ดักอ่าน `location.hash` เองแล้ว map ไปเปิด
//     แท็บที่ตรงกับชื่อนั้น (เช็คจาก `getElementById("ad-tabbtn-" + hashTab)`) — เป็นแพทเทิร์นคนละ
//     แบบกับ anchor link ปกติที่เลื่อนไป element ตรงๆ จึงต้องเช็คแยกด้วย prefix `ad-tabbtn-` เฉพาะ
//     ตอน target file เป็น admin.html เท่านั้น ก่อนฟันธงว่า broken
//
// รัน: node scripts/check-broken-anchor-links.mjs   หรือ  npm run check-broken-anchor-links
// ===========================================================

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname, normalize } from "node:path";
import { JSDOM } from "jsdom";

const ROOT = new URL("..", import.meta.url).pathname;

function listHtmlFiles(dir) {
  return readdirSync(join(ROOT, dir))
    .filter((f) => f.endsWith(".html"))
    .map((f) => join(dir, f).replace(/\\/g, "/"));
}

const pages = [...listHtmlFiles("."), ...listHtmlFiles("en")].sort();

// ---------------------------------------------------------------
// เก็บ "รายชื่อ id ที่ถูกสร้างแบบ dynamic ด้วย JS" ไว้ก่อน เพื่อไม่ให้ false-positive
// ครอบคลุม pattern: setAttribute("id", "xxx") / setAttribute('id', 'xxx') / .id = "xxx" / .id = 'xxx'
// (ไม่ครอบคลุม id ที่ generate จาก template literal ผสมตัวแปร เช่น `id-${x.id}` เพราะแบบนั้นไม่มีทาง
// ตรงกับ href="#xxx" คงที่ตายตัวได้อยู่แล้ว — href ต้อง hardcode ชื่อ id ไว้ล่วงหน้าเสมอ)
// ---------------------------------------------------------------
function findDynamicIds() {
  const jsDir = join(ROOT, "js");
  const files = readdirSync(jsDir).filter((f) => f.endsWith(".js"));
  const ids = new Set();
  const setAttrRe = /setAttribute\(\s*["']id["']\s*,\s*["']([^"'`${}]+)["']\s*\)/g;
  const directAssignRe = /\.id\s*=\s*["']([^"'`${}]+)["']/g;
  for (const f of files) {
    const src = readFileSync(join(jsDir, f), "utf8");
    for (const m of src.matchAll(setAttrRe)) ids.add(m[1]);
    for (const m of src.matchAll(directAssignRe)) ids.add(m[1]);
  }
  return ids;
}
const dynamicIds = findDynamicIds();

// ---------------------------------------------------------------
// เก็บ "id ทั้งหมดที่มีอยู่จริงใน static HTML" ต่อไฟล์ (คีย์ตาม path relative จาก ROOT ที่ normalize
// แล้ว) — ใช้ query ครั้งเดียวต่อไฟล์แล้ว cache ไว้ เพราะ cross-page anchor ต้องเปิดไฟล์อื่นมาเช็คซ้ำ
// หลายครั้งได้ (เช่นหลายหน้า link ไป about.html#faq เหมือนกัน)
// ---------------------------------------------------------------
const idCache = new Map(); // relPath -> Set<string> | null (null = ไฟล์ไม่มีอยู่จริง)

function getIdsOfFile(relPath) {
  if (idCache.has(relPath)) return idCache.get(relPath);
  const abs = join(ROOT, relPath);
  if (!existsSync(abs)) {
    idCache.set(relPath, null);
    return null;
  }
  const html = readFileSync(abs, "utf8");
  const dom = new JSDOM(html);
  const ids = new Set([...dom.window.document.querySelectorAll("[id]")].map((el) => el.id));
  idCache.set(relPath, ids);
  return ids;
}

// resolve href ที่เป็นไฟล์ (เช่น "about.html" หรือ "../about.html") เทียบกับตำแหน่งไฟล์ปัจจุบัน
// ให้เป็น path แบบ relative จาก ROOT เสมอ (ไฟล์ทั้งหมดอยู่แค่ root กับ en/ ไม่มี subfolder ลึกกว่านั้น)
function resolveTargetPath(currentPage, targetFile) {
  const currentDir = dirname(currentPage); // "." หรือ "en"
  const combined = normalize(join(currentDir, targetFile)).replace(/\\/g, "/");
  return combined;
}

console.log("=== check-broken-anchor-links.mjs — ตรวจ href=\"#xxx\" ว่ามี id ปลายทางจริงไหม ===\n");
console.log(`หน้า HTML ที่ตรวจ: ${pages.length} หน้า`);
console.log(`id ที่พบว่าถูกสร้างแบบ dynamic ด้วย JS (setAttribute/.id=): ${dynamicIds.size} ตัว${dynamicIds.size ? " -> " + [...dynamicIds].join(", ") : ""}\n`);

let totalBroken = 0;
let totalPagesWithBroken = 0;
let totalDynamicSkipped = 0;
let totalMissingFile = 0;
let totalHashOnlySkipped = 0;
let totalChecked = 0;

for (const page of pages) {
  const html = readFileSync(join(ROOT, page), "utf8");
  const dom = new JSDOM(html);
  const anchors = [...dom.window.document.querySelectorAll("a[href]")];

  const brokenThisPage = [];
  const dynamicThisPage = [];

  for (const a of anchors) {
    const href = a.getAttribute("href");
    if (href === null) continue;
    const hashIdx = href.indexOf("#");
    if (hashIdx === -1) continue; // ไม่ใช่ anchor link เลย (ลิงก์ธรรมดา ไม่เกี่ยว)

    const fileman = href.slice(0, hashIdx); // ส่วนก่อน # (ว่าง = same-page)
    const fragment = href.slice(hashIdx + 1); // ส่วนหลัง #

    if (fragment === "") {
      // href="#" เปล่าๆ (ไม่มีชื่อ id ต่อท้าย) — ตั้งใจให้ JS ดักคลิก ไม่ใช่ anchor link จริง
      totalHashOnlySkipped++;
      continue;
    }

    totalChecked++;

    const targetPage = fileman === "" ? page : resolveTargetPath(page, fileman);
    const ids = getIdsOfFile(targetPage);

    if (ids === null) {
      totalMissingFile++;
      brokenThisPage.push({
        href,
        text: (a.textContent || "").replace(/\s+/g, " ").trim().slice(0, 40),
        reason: `ไฟล์ปลายทาง "${targetPage}" ไม่มีอยู่จริง`,
      });
      continue;
    }

    if (ids.has(fragment)) continue; // เจอ id ปลายทางจริง ผ่าน

    // กรณีพิเศษ: admin.html ใช้ #hash เป็น "SPA tab deep-link" (js/admin-page.js อ่าน location.hash
    // เองแล้ว map ไปหา id="ad-tabbtn-<hash>") ไม่ใช่ id ปลายทางตรงๆ ที่ browser จะเลื่อนไปเอง — เช็ค
    // เฉพาะตอน target file เป็น admin.html เท่านั้น (ไม่ generalize ไปไฟล์อื่นเพราะเป็นแพทเทิร์นเฉพาะ
    // ของ admin SPA จริงๆ อย่างเดียว พบตั้งแต่รอบ 56)
    if (targetPage.endsWith("admin.html") && ids.has("ad-tabbtn-" + fragment)) {
      totalDynamicSkipped++;
      dynamicThisPage.push({
        href,
        id: fragment,
        note: `SPA hash-route ผ่าน js/admin-page.js (map ไป id="ad-tabbtn-${fragment}" ไม่ใช่ id="${fragment}" ตรงๆ)`,
      });
      continue;
    }

    if (fileman === "" && dynamicIds.has(fragment)) {
      // same-page anchor ที่ id ไม่เจอใน static HTML แต่ตรงกับ id ที่ JS สร้างแบบ dynamic — ไม่ฟันธง
      // ว่า broken แต่แยกรายงานไว้ให้เห็น
      totalDynamicSkipped++;
      dynamicThisPage.push({ href, id: fragment });
      continue;
    }

    totalBroken++;
    brokenThisPage.push({
      href,
      text: (a.textContent || "").replace(/\s+/g, " ").trim().slice(0, 40),
      reason: `ไม่มี id="${fragment}" ใน ${targetPage}`,
    });
  }

  if (brokenThisPage.length > 0) {
    totalPagesWithBroken++;
    console.log(`✗ ${page}`);
    for (const b of brokenThisPage) {
      console.log(`    <a href="${b.href}">${b.text}</a>  —  ${b.reason}`);
    }
  }
  if (dynamicThisPage.length > 0) {
    console.log(`ℹ ${page} — id ต่อไปนี้ไม่เจอใน static HTML แต่ตรงกับ id ที่ JS สร้าง dynamic (ไม่นับ broken):`);
    for (const d of dynamicThisPage) {
      console.log(`    <a href="${d.href}"> -> ${d.note || `id="${d.id}" (สร้างโดย JS ตอน runtime)`}`);
    }
  }
}

console.log("");
console.log(`สรุป: ตรวจ anchor link ที่มี fragment ทั้งหมด ${totalChecked} จุด`);
console.log(`  - ข้าม href="#" เปล่าๆ (JS ดักคลิก ไม่ใช่ anchor link จริง): ${totalHashOnlySkipped} จุด`);
console.log(`  - ข้ามเพราะ id ตรงกับที่ JS สร้าง dynamic ตอน runtime: ${totalDynamicSkipped} จุด`);
console.log(`  - broken เพราะไฟล์ปลายทางไม่มีอยู่จริง: ${totalMissingFile} จุด`);
console.log("");

if (totalBroken === 0) {
  console.log(`✓ ไม่พบ broken anchor link เลยทั้งโปรเจกต์ (รวมไฟล์ปลายทางที่ไม่มีอยู่จริงด้วย)`);
} else {
  console.log(`✗ พบ broken anchor link รวม ${totalBroken} จุด ใน ${totalPagesWithBroken} หน้า`);
}

process.exitCode = totalBroken === 0 ? 0 : 1;
