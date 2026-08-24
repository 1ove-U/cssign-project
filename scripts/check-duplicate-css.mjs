#!/usr/bin/env node
// ===========================================================
// scripts/check-duplicate-css.mjs
//
// ตรวจ "duplicate CSS rule" — ไม่ใช่ dead CSS (selector ที่ไม่ได้ใช้เลย ดูได้จาก
// check-dead-css.mjs) แต่เป็นกรณีที่ selector คนละชื่อ/คนละบล็อก แต่มี "เนื้อหา declaration
// เหมือนกันทุกประการ" — ซึ่งอาจรวมเป็น selector list เดียวกันได้ (เช่น `.a, .b { ... }` แทนที่จะ
// เขียนแยก 2 บล็อก) เพื่อลดความซ้ำซ้อนในไฟล์ CSS — เริ่มสำรวจครั้งแรกในรอบที่ 49
//
// วิธีทำงาน:
//   1) extractRuleBlocks() พาร์ส css/*.css แบบ "brace-depth aware" (เดิน char ทีละตัว นับ {/} เอง
//      ข้าม /* comment */ กับ string "..."/'...' ก่อนเสมอ — แพทเทิร์นเดียวกับ extractPreludes() ใน
//      check-dead-css.mjs) แต่ต่างจากตัวเดิมตรงที่ตัวนี้ต้อง "จับเนื้อหาด้านในบล็อกด้วย" ไม่ใช่แค่
//      prelude (selector) เฉยๆ:
//      - เจอ "{" แล้ว prelude (buf ก่อนหน้า) ขึ้นต้นด้วย "@" (เช่น @media, @supports, @keyframes,
//        @font-face) → ถือเป็น "container at-rule" ไม่ใช่ selector list ของ element จริง → push
//        เข้า context stack (เก็บ prelude ของ container ไว้ระบุบริบท + flag isKeyframes) แล้วเดินต่อ
//        เข้าไปข้างในตามปกติ (rule ที่ซ้อนอยู่ข้างในยังถูกจับได้ปกติ)
//      - เจอ "{" แล้ว prelude ไม่ได้ขึ้นต้นด้วย "@" → นี่คือ selector list ของ rule จริง 1 บล็อก
//        เดินสแกนต่อไปหา "}" ที่ปิดบล็อกนี้ (ข้าม comment/string ระหว่างทางเหมือนกัน) เก็บข้อความ
//        ระหว่างนั้นไว้เป็น "เนื้อหา declaration ดิบ" ของบล็อกนี้
//      - เจอ "}" ตอน depth อยู่ใน container at-rule (ไม่ใช่ตอนปิด rule ปกติ เพราะ rule ปกติปิดบล็อก
//        ของตัวเองไปแล้วในขั้นตอนก่อนหน้า) → pop context stack ออก 1 ชั้น
//      - บล็อกที่อยู่ข้างใน @keyframes (เช่น 0%/50%/100% หรือ from/to) ไม่ใช่ "element selector"
//        ที่จะเอามารวม selector list กันได้ (มันคือ % ของ animation timeline) จึงข้ามไปเลย ไม่นับเป็น
//        rule ที่ต้องเทียบซ้ำ (ถ้า context stack มี ancestor ที่เป็น @keyframes อยู่ ให้ข้ามบล็อกนั้น)
//   2) normalizeDeclarations() ทำให้เนื้อหา declaration เทียบกันตรงๆ ได้แม้จัดบรรทัด/เว้นวรรคต่างกัน:
//      ตัด comment ที่หลุดมา (ถ้ามี), แยกด้วย ";", trim แต่ละ declaration, ตัดอันว่างทิ้ง (เช่น ";;"
//      หรือ trailing ";"), ยุบช่องว่าง/ขึ้นบรรทัดใหม่ภายในแต่ละ declaration ให้เหลือช่องว่างเดียว
//      แล้วต่อกลับด้วย "; " — **ไม่เรียงลำดับใหม่** (คงลำดับเดิมของ declaration ไว้) เพื่อความ
//      อนุรักษ์นิยม (conservative): ถือว่า "เหมือนกันทุกประการ" หมายถึงเหมือนกันทั้งเนื้อหาและลำดับ
//      จริงๆ ไม่ใช่แค่ set เดียวกันที่สลับลำดับได้ (สลับลำดับอาจมีผลถ้ามี property ซ้ำกันในบล็อก
//      เดียว แม้จะเป็นกรณีแปลกก็ตาม — ปลอดภัยกว่าที่จะไม่ตัดสินว่า duplicate ถ้าลำดับต่างกัน)
//   3) เทียบเฉพาะภายในไฟล์เดียวกัน + บริบท @media/@supports เดียวกันเท่านั้น (ไม่ข้ามไฟล์ ไม่ข้าม
//      breakpoint) ตามที่ระบุไว้ท้ายรอบ 48 — บริบทถูกเก็บเป็น chain ของ prelude (normalize ช่องว่าง
//      แล้ว) ของทุกชั้น container ที่ครอบ rule นั้นอยู่ ต่อกันด้วย " > " (เช่น
//      "@media (max-width: 768px)") ส่วน rule ที่ไม่ได้อยู่ใน container ใดๆ ใช้ context "(top-level)"
//   4) group ด้วย key = (file, context, normalizedDeclText) — เฉพาะ group ที่มี rule ตั้งแต่ 2 ขึ้น
//      ไป และ normalizedDeclText ไม่ว่างเปล่า (ข้าม empty rule เช่น `.foo {}` ที่ไม่มีเนื้อหาเลย)
//      ถือเป็น duplicate candidate — รายงานรายชื่อ selector + บรรทัดของแต่ละจุดที่ซ้ำ พร้อมจำนวน
//      declaration ในบล็อก (เรียงรายงานจากจำนวน declaration เยอะไปน้อย เพราะกลุ่มที่มีเนื้อหาเยอะ
//      น่าสนใจ/คุ้มค่าที่จะ merge มากกว่ากลุ่มที่มีแค่ 1 declaration สั้นๆ)
//   5) ไม่แก้ไฟล์ใดๆ อัตโนมัติ — แค่รายงานให้คนตัดสินใจเอง (เหมือน check-dead-css.mjs) เพราะการ
//      รวม selector list บางกรณีอาจกระทบ readability/organization ของไฟล์ต้นฉบับที่จงใจแยกไว้
//      เป็นหมวดหมู่ (เช่น comment หัวข้อคั่นระหว่าง section) แม้เนื้อหาจะเหมือนกันเป๊ะก็ตาม
//
// รัน: node scripts/check-duplicate-css.mjs   หรือ  npm run check-duplicate-css
// ===========================================================

import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const CSS_FILES = [
  "css/style.css",
  "css/shared-widgets.css",
  "css/fancy-effects.css",
  "css/track-modal.css",
  "css/cart-modal.css",
  "css/admin.css",
  "css/console.css",
  "css/exit-intent-cta.css",
];

// -----------------------------------------------------------
// helper: ยุบช่องว่าง/ขึ้นบรรทัดใหม่ให้เหลือช่องว่างเดียว + trim
// -----------------------------------------------------------
function collapseWhitespace(text) {
  return text.replace(/\s+/g, " ").trim();
}

// -----------------------------------------------------------
// 1) พาร์ส CSS แบบ brace-depth aware — จับทั้ง selector (prelude) และเนื้อหา declaration
//    ของแต่ละ rule จริง พร้อม context chain ของ @media/@supports/@keyframes ที่ครอบอยู่
// -----------------------------------------------------------
function extractRuleBlocks(cssText) {
  const rules = []; // { selectorText, declRaw, contextChain: [{prelude,isKeyframes}], line }
  const contextStack = [];
  let buf = "";
  let bufStartLine = 1;
  let line = 1;
  let i = 0;
  const n = cssText.length;

  while (i < n) {
    const ch = cssText[i];

    // ข้าม comment /* ... */
    if (ch === "/" && cssText[i + 1] === "*") {
      const end = cssText.indexOf("*/", i + 2);
      const chunk = end === -1 ? cssText.slice(i) : cssText.slice(i, end + 2);
      line += (chunk.match(/\n/g) || []).length;
      i = end === -1 ? n : end + 2;
      continue;
    }

    // ข้าม string "..." หรือ '...' ในระดับ prelude (ก่อนเจอ "{") — เก็บข้อความ string จริงไว้ใน buf
    // (ไม่ blank เป็น placeholder เหมือน extractPreludes() ของ check-dead-css.mjs เพราะที่นี่แค่
    // เก็บ selectorText ไว้ "แสดงผล" ไม่ได้เอาไปทำ regex หา .foo/#foo ปลอมจากใน string เหมือนที่นั่น
    // — เก็บของจริงไว้ทำให้รายงาน attribute selector เช่น [data-status="pending"] อ่านออกว่าเป็น
    // ค่าอะไรจริง แทนที่จะโชว์เป็น [data-status= ] ว่างๆ)
    if (ch === '"' || ch === "'") {
      const quote = ch;
      let j = i + 1;
      while (j < n && cssText[j] !== quote) {
        if (cssText[j] === "\\") j++;
        j++;
      }
      const raw = cssText.slice(i, j + 1);
      line += (raw.match(/\n/g) || []).length;
      buf += raw;
      i = j + 1;
      continue;
    }

    if (ch === "{") {
      const trimmed = buf.trim();
      const selLine = bufStartLine;

      if (trimmed.startsWith("@")) {
        // container at-rule (@media/@supports/@keyframes/@font-face/...) — เข้าไปข้างในต่อ
        const isKeyframes = /^@(-\w+-)?keyframes\b/i.test(trimmed);
        contextStack.push({ prelude: collapseWhitespace(trimmed), isKeyframes });
        buf = "";
        i++;
        bufStartLine = line;
        continue;
      }

      // rule ปกติ — สแกนหาเนื้อหาจนกว่าจะเจอ "}" ที่ปิดบล็อกนี้ (ข้าม comment/string ระหว่างทาง)
      let declRaw = "";
      let j = i + 1;
      while (j < n) {
        const c2 = cssText[j];
        if (c2 === "/" && cssText[j + 1] === "*") {
          const end = cssText.indexOf("*/", j + 2);
          j = end === -1 ? n : end + 2;
          declRaw += " ";
          continue;
        }
        if (c2 === '"' || c2 === "'") {
          const quote = c2;
          let k = j + 1;
          while (k < n && cssText[k] !== quote) {
            if (cssText[k] === "\\") k++;
            k++;
          }
          declRaw += cssText.slice(j, k + 1);
          j = k + 1;
          continue;
        }
        if (c2 === "}") break;
        declRaw += c2;
        j++;
      }
      line += (cssText.slice(i, j).match(/\n/g) || []).length;
      i = j + 1; // ข้าม "}" ปิดบล็อกไปด้วย

      const insideKeyframes = contextStack.some((c) => c.isKeyframes);
      if (!insideKeyframes) {
        rules.push({
          selectorText: trimmed,
          declRaw,
          contextChain: contextStack.map((c) => c.prelude),
          line: selLine,
        });
      }

      buf = "";
      bufStartLine = line;
      continue;
    }

    if (ch === "}") {
      // ปิด container at-rule (เพราะ rule ปกติปิดบล็อกตัวเองไปแล้วในขั้นตอนก่อนหน้า)
      if (contextStack.length > 0) contextStack.pop();
      buf = "";
      i++;
      bufStartLine = line;
      continue;
    }

    if (ch === "\n") line++;
    if (buf === "") bufStartLine = line;
    buf += ch;
    i++;
  }

  return rules;
}

// -----------------------------------------------------------
// 2) normalize เนื้อหา declaration ให้เทียบกันตรงๆ ได้ (ไม่เรียงลำดับใหม่)
//
//    สำคัญ: split ";" แบบ "string-aware" (ไม่ใช่ .split(";") ตรงๆ) เพราะพบว่ามี declaration ที่ใช้
//    data URI ฝังอยู่ใน url("data:image/svg+xml;utf8,...") ซึ่งมี ";" อยู่ *ข้างใน* string — ถ้า
//    split ตรงๆ จะตัดกลาง data URI ผิดจุด ทำให้นับจำนวน declaration ผิดและเทียบเนื้อหาไม่ตรง
// -----------------------------------------------------------
function splitDeclarationsStringAware(declRaw) {
  const parts = [];
  let buf = "";
  let i = 0;
  const n = declRaw.length;
  while (i < n) {
    const ch = declRaw[i];
    if (ch === '"' || ch === "'") {
      const quote = ch;
      let j = i + 1;
      while (j < n && declRaw[j] !== quote) {
        if (declRaw[j] === "\\") j++;
        j++;
      }
      buf += declRaw.slice(i, j + 1);
      i = j + 1;
      continue;
    }
    if (ch === ";") {
      parts.push(buf);
      buf = "";
      i++;
      continue;
    }
    buf += ch;
    i++;
  }
  parts.push(buf);
  return parts;
}

function normalizeDeclarations(declRaw) {
  const parts = splitDeclarationsStringAware(declRaw)
    .map((p) => collapseWhitespace(p))
    .filter((p) => p !== "");
  return { normalized: parts.join("; "), count: parts.length };
}

async function main() {
  const cssTexts = await Promise.all(
    CSS_FILES.map((f) => readFile(join(ROOT, f), "utf8"))
  );

  console.log("=== check-duplicate-css.mjs — รายงาน duplicate CSS declaration block (รอบที่ 49) ===\n");
  console.log(`สแกน CSS ${CSS_FILES.length} ไฟล์\n`);

  let totalRules = 0;
  let totalGroups = 0;
  let totalDuplicateRuleInstances = 0;

  for (let idx = 0; idx < CSS_FILES.length; idx++) {
    const file = CSS_FILES[idx];
    const rules = extractRuleBlocks(cssTexts[idx]);
    totalRules += rules.length;

    // group ด้วย key = context chain + normalized declaration text
    const groups = new Map(); // key -> { contextLabel, normalized, count, entries: [{selectorText, line}] }

    for (const r of rules) {
      const { normalized, count } = normalizeDeclarations(r.declRaw);
      if (normalized === "") continue; // ข้าม empty rule เช่น .foo {}

      const contextLabel = r.contextChain.length > 0 ? r.contextChain.join(" > ") : "(top-level)";
      const key = `${contextLabel}\u0000${normalized}`;

      if (!groups.has(key)) {
        groups.set(key, { contextLabel, normalized, count, entries: [] });
      }
      groups.get(key).entries.push({ selectorText: r.selectorText, line: r.line });
    }

    const dupGroups = [...groups.values()]
      .filter((g) => g.entries.length >= 2)
      .sort((a, b) => b.count - a.count || b.entries.length - a.entries.length);

    console.log(`--- ${file} ---`);
    console.log(`  rule ทั้งหมด (ไม่รวมใน @keyframes): ${rules.length} บล็อก`);

    if (dupGroups.length === 0) {
      console.log("  ✓ ไม่พบ duplicate declaration block\n");
      continue;
    }

    console.log(`  ✗ พบ duplicate declaration block ${dupGroups.length} กลุ่ม:\n`);
    totalGroups += dupGroups.length;

    for (const g of dupGroups) {
      totalDuplicateRuleInstances += g.entries.length;
      console.log(`  [context: ${g.contextLabel}] — ${g.count} declaration, ซ้ำกัน ${g.entries.length} จุด:`);
      for (const e of g.entries) {
        console.log(`    ${e.selectorText}  (บรรทัด ${e.line})`);
      }
      console.log(`    เนื้อหา: { ${g.normalized} }`);
      console.log("");
    }
  }

  console.log("=== สรุป ===");
  console.log(`rule ทั้งหมดที่สแกน (ไม่รวมใน @keyframes): ${totalRules} บล็อก`);
  console.log(`กลุ่ม duplicate ที่พบ: ${totalGroups} กลุ่ม (รวม ${totalDuplicateRuleInstances} rule ที่เกี่ยวข้อง)`);
  console.log("\nหมายเหตุ: สคริปต์นี้รายงานอย่างเดียว ไม่แก้/รวม selector ใดๆ อัตโนมัติ — การตัดสินใจ");
  console.log("ว่าจะรวม selector list หรือไม่ ต้องดูบริบทเพิ่มเติมเสมอ (เช่น ตั้งใจแยก section เพื่อ");
  console.log("readability แม้เนื้อหาจะเหมือนกันเป๊ะ) — เทียบเฉพาะภายในไฟล์เดียวกัน + บริบท @media/");
  console.log("@supports เดียวกันเท่านั้น ไม่ข้ามไฟล์ ไม่ข้าม breakpoint");

  if (totalGroups > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error("check-duplicate-css.mjs error:", err);
  process.exitCode = 2;
});
