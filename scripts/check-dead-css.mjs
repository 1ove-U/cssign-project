#!/usr/bin/env node
// ===========================================================
// scripts/check-dead-css.mjs
//
// รวม logic ตรวจ "dead CSS" หลายแบบที่เคยทำแบบ script ชั่วคราวมาก่อน (แล้วลบทิ้ง) ให้เป็น
// เครื่องมือถาวรในโปรเจกต์:
//   - dead class selector (.foo)         — ตรวจครั้งแรกในรอบที่ 41
//   - dead id selector    (#foo)         — ตรวจครั้งแรกในรอบที่ 43
//   - dead attribute selector ([foo="x"]) — ตรวจครั้งแรกในรอบที่ 45
//   - dead custom property (--foo)        — ตรวจครั้งแรกในรอบที่ 45
//   - dead @keyframes                     — ตรวจครั้งแรกในรอบที่ 46 (@font-face สำรวจแล้วไม่มีใช้
//     เลยทั้งโปรเจกต์ เลยไม่ได้เขียน checker ส่วนนั้น — ดูรายละเอียดเหตุผลที่ฟังก์ชัน
//     parseKeyframesDeclarations() ด้านล่าง)
//
// วิธีทำงาน (สรุป — อ่านรายละเอียดในแต่ละฟังก์ชันด้านล่าง):
//   1) parseCssSelectors() พาร์ส css/*.css ทั้ง 7 ไฟล์แบบ "brace-depth aware" จริง (เดิน char
//      ทีละตัว นับ {/} เอง ข้าม /* comment */ กับ string "..."/'...' ก่อนเสมอ) เก็บเฉพาะข้อความ
//      selector ที่อยู่ "ก่อน {" จริงๆ (ไม่ใช่ regex เดาทั้งไฟล์) เพื่อไม่ให้ hex color เช่น #FFF/
//      #BEE3D3 ที่อยู่ใน declaration value (หลัง { ก่อน }) หลุดมาปนเป็น id selector ปลอม
//      หมายเหตุ: ข้อความ "ก่อน {" ที่ขึ้นต้นด้วย @ (เช่น @media (...), @keyframes name,
//      @font-face) ไม่ใช่ selector list ของ HTML element จึงถูกข้ามไปเอง — แต่ตัว selector จริงที่
//      อยู่ "ข้างใน" @media (เช่น .foo ใน `@media (...){ .foo{...} }`) ยังถูกจับได้ปกติ เพราะ
//      buffer ของ prelude จะถูก reset ทุกครั้งที่เจอ { หรือ } (ไม่ใช่แค่ตอน depth กลับมา 0) —
//      ทำให้ selector ที่ซ้อนอยู่ใน @media ก็ยังเป็น "prelude ก่อน {" ของตัวมันเองตามปกติ
//   2) collectStaticUsage() สแกน HTML ทุกหน้า (root + en/) หา class="..."/id="..." ตรงๆ
//   3) collectDynamicUsage() สแกน js/*.js ทุกไฟล์ด้วยการ "grep แบบกว้างสุดทั้งไฟล์" (เหมือนที่ทำ
//      มาตลอดในรอบก่อนๆ — ดู NEXT-ROUND-PROMPT.txt รอบ 43) คือเช็คว่าชื่อ class/id นั้น "ปรากฏเป็น
//      คำเต็ม (word-boundary) ที่ไหนก็ได้ในไฟล์ .js" — ครอบคลุมทั้ง getElementById/querySelector/
//      querySelectorAll/closest/classList.add-remove-toggle-contains/className/comment ที่อ้างถึง
//      id เอาไว้เป็นหลักฐาน (แบบเดียวกับที่รอบ 43 grep เจอ) โดยตั้งใจ "กว้างเกินพอ" ดีกว่าตกหล่น
//      เพราะสคริปต์นี้แค่ "รายงาน" ไม่ลบอัตโนมัติ — ผลบวกลวง (false dead) อันตรายกว่าไม่ครบ
//   4) collectDynamicPrefixUsage() หา template literal ที่มี prefix คงที่ต่อด้วย ${...} เช่น
//      `` `chat-bubble--${x}` `` แล้วเก็บ "chat-bubble--" ไว้เป็น allowlist prefix — selector ใดๆ
//      ที่ชื่อขึ้นต้นด้วย prefix นี้ถือว่า "อาจถูกใช้แบบไดนามิก" ไม่ถูกรายงานว่า dead แต่จะบอกไว้ใน
//      รายงานแยกต่างหากว่าอาศัย prefix match ไม่ใช่ exact match เพื่อความโปร่งใส
//   5) เทียบทั้งหมด แล้วพิมพ์รายงาน — ไม่ลบไฟล์ใดๆ ทั้งสิ้น การตัดสินใจว่า "dead จริง" ต้องมีคนดู
//      บริบทเพิ่มเติมเสมอ (เช่นกรณี href="#id" เป็น anchor link ที่เจอในรอบ 43)
//
// รัน: node scripts/check-dead-css.mjs   หรือ  npm run check-dead-css
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

// หน้า HTML ทั้งหมด (TH root + en/) — เขียนตายตัวไว้แทนการ glob เพื่อให้รู้ชัดว่าสแกนอะไรบ้าง
// และกันปัญหาไฟล์ .html แปลกปลอมที่อาจเพิ่มเข้ามาทีหลังโดยไม่ตั้งใจ (เช่น backup/draft)
const HTML_FILES = [
  "index.html", "about.html", "products.html", "product-detail.html",
  "portfolio.html", "blog.html", "blog-post.html", "blog-safety-sign-standards-th.html",
  "contact.html", "quality-policy.html", "accessibility.html", "privacy-policy.html",
  "terms.html", "404.html", "admin.html", "console.html",
  "en/index.html", "en/about.html", "en/products.html", "en/product-detail.html",
  "en/portfolio.html", "en/blog.html", "en/blog-safety-sign-standards-en.html",
  "en/quality-policy.html", "en/contact.html",
];

// -----------------------------------------------------------
// 1) พาร์ส CSS แบบ brace-depth aware — เก็บ prelude (ข้อความก่อน {) ทุกจุด
// -----------------------------------------------------------
function extractPreludes(cssText) {
  const preludes = []; // { text, line }
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

    // ข้าม string "..." หรือ '...' (กัน { } ปลอมใน content: "{" เป็นต้น และกันเนื้อหาใน string
    // หลุดเข้ามาปนใน buffer ของ selector — เก็บ placeholder แทนเพื่อไม่ให้ regex เจอ .foo/#foo ปลอม
    if (ch === '"' || ch === "'") {
      const quote = ch;
      let j = i + 1;
      while (j < n && cssText[j] !== quote) {
        if (cssText[j] === "\\") j++; // ข้าม escaped char
        j++;
      }
      const raw = cssText.slice(i, j + 1);
      line += (raw.match(/\n/g) || []).length;
      buf += " ";
      i = j + 1;
      continue;
    }

    if (ch === "{") {
      preludes.push({ text: buf, line: bufStartLine });
      buf = "";
      i++;
      bufStartLine = line;
      continue;
    }

    if (ch === "}") {
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

  return preludes;
}

// เอา prelude ที่ "ไม่ใช่" at-rule (@media/@keyframes/@font-face/...) มาแยก class/#id ออกมา
function parseCssSelectors(cssText) {
  const preludes = extractPreludes(cssText);
  const classes = []; // { name, line }
  const ids = []; // { name, line }

  for (const { text, line } of preludes) {
    const trimmed = text.trim();
    if (trimmed === "") continue;
    if (trimmed.startsWith("@")) continue; // at-rule เอง ไม่ใช่ selector list

    // ลบ attribute-selector value ที่อยู่ใน [...] เช่น [lang="en-US"] กัน dot/hash ปลอมใน string
    const cleaned = trimmed.replace(/\[[^\]]*\]/g, " ");

    for (const m of cleaned.matchAll(/\.([a-zA-Z_-][\w-]*)/g)) {
      classes.push({ name: m[1], line });
    }
    for (const m of cleaned.matchAll(/#([a-zA-Z_-][\w-]*)/g)) {
      ids.push({ name: m[1], line });
    }
  }

  return { classes, ids };
}

// -----------------------------------------------------------
// 2) static usage — class="..."/id="..." ใน HTML
// -----------------------------------------------------------
function collectStaticUsage(htmlText) {
  const classes = new Set();
  const ids = new Set();

  for (const m of htmlText.matchAll(/\bclass\s*=\s*"([^"]*)"/g)) {
    for (const c of m[1].split(/\s+/).filter(Boolean)) classes.add(c);
  }
  for (const m of htmlText.matchAll(/\bclass\s*=\s*'([^']*)'/g)) {
    for (const c of m[1].split(/\s+/).filter(Boolean)) classes.add(c);
  }
  for (const m of htmlText.matchAll(/\bid\s*=\s*"([^"]+)"/g)) ids.add(m[1].trim());
  for (const m of htmlText.matchAll(/\bid\s*=\s*'([^']+)'/g)) ids.add(m[1].trim());

  return { classes, ids };
}

// -----------------------------------------------------------
// 3) dynamic usage แบบ "กว้างสุด" — เช็คว่าชื่อปรากฏเป็นคำเต็มที่ไหนก็ได้ในไฟล์ js (รวม comment)
//    เหตุผลที่ตั้งใจกว้างขนาดนี้ (ไม่ใช่แค่ regex เฉพาะ getElementById/querySelector เป๊ะๆ):
//    getElementById(id) แบบรับตัวแปร (ไม่ใช่ string literal ตรงๆ) มีอยู่จริงในโปรเจกต์นี้ (เช่น
//    js/admin-overview-today.js: readCount(id) ที่ id มาจาก SOURCE_IDS array) ตามรอยแบบ static
//    data-flow เต็มรูปแบบทุกเคสทำได้ยาก/เสี่ยงพลาด — เช็คแบบ "ชื่อนี้ปรากฏเป็นคำในไฟล์ไหมเลย"
//    (ผ่าน string literal ปกติ, ผ่าน array ของ id ที่ป้อนเข้า, หรือแม้แต่ comment ที่บันทึกไว้)
//    ปลอดภัยกว่าในทิศทาง "ไม่ dead ปลอม" ซึ่งสำคัญกว่าสำหรับ script ที่แค่รายงานเฉยๆ
// -----------------------------------------------------------
function buildJsUsageChecker(jsFilesText) {
  const combined = jsFilesText.join("\n");
  const cache = new Map();
  return function isUsedInJs(name) {
    if (cache.has(name)) return cache.get(name);
    const re = new RegExp(`(?<![\\w-])${escapeRegExp(name)}(?![\\w-])`);
    const found = re.test(combined);
    cache.set(name, found);
    return found;
  };
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// -----------------------------------------------------------
// 4) dynamic prefix — จับ template literal prefix ก่อน ${...} เช่น `chat-bubble--${x}`
// -----------------------------------------------------------
function collectDynamicPrefixes(jsFilesText) {
  const prefixes = new Set();
  const templateRe = /`([^`]*)`/gs;
  for (const jsText of jsFilesText) {
    for (const tmplMatch of jsText.matchAll(templateRe)) {
      const tmpl = tmplMatch[1];
      // แยกด้วย ${...} เอง (ไม่ใช้ regex ซ้อน backtick เพราะ nested template ยากเกิน scope นี้)
      const parts = tmpl.split(/\$\{[^}]*\}/);
      // parts[0] คือข้อความก่อน ${...} ตัวแรก (ถ้ามี) — ถ้ามีมากกว่า 1 part แปลว่ามี ${...} จริง
      if (parts.length > 1) {
        const before = parts[0];
        const m = before.match(/([a-zA-Z_-][\w-]*[-])$/); // ต้องจบด้วย - เพื่อดูเหมือน prefix จริง
        if (m) prefixes.add(m[1]);
      }
    }

    // เคสเดียวกันแต่เขียนแบบ string concatenation ('cs-toast--' + type หรือแม้แต่
    // 'cs-toast cs-toast--' + type ที่มีหลาย token ปนกัน) ซึ่งพบจริงในโปรเจกต์นี้ (js/form-toast.js,
    // js/chat-widget.js) มากกว่า template literal เสียอีก — เอาแค่ "ท้ายสุด" ของ string ที่จบด้วย -
    for (const m of jsText.matchAll(/['"]([^'"]*-)['"]\s*\+/g)) {
      const tail = m[1].match(/([a-zA-Z_-][\w-]*-)$/); // ตัดเอาแค่ token สุดท้ายที่ลงท้ายด้วย -
      if (tail) prefixes.add(tail[1]);
    }
  }
  return prefixes;
}

// -----------------------------------------------------------
// 5) attribute selector ([data-status="won"], [disabled], ...) — รอบที่ 45 เพิ่มใหม่
//
//    extractPreludes() เดิม (ข้อ 1) ยุบ string "..."/'...' เป็นช่องว่างเดียวทุกที่ ไม่ว่าจะอยู่ใน
//    prelude (ก่อน {) หรือ declaration content (หลัง { ก่อน }) เพราะตอนนั้นแค่ต้องการกัน content:
//    "{" ปลอมใน declaration ไม่ให้ทำให้นับ brace depth ผิด — declaration content ที่ยุบ string ไป
//    ไม่มีผลอะไรเพราะ buf นั้นถูกทิ้งอยู่แล้วตอนเจอ } แต่ผลข้างเคียงคือ value ของ attribute selector
//    ใน prelude เช่น [data-cat="equip"] ก็ถูกยุบเป็น [data-cat= ] หาย "equip" ไปด้วย ใช้ต่อไม่ได้
//    เลยต้องเขียน walker แยก (extractPreludesRaw) ที่เหมือนกันทุกอย่างยกเว้นเก็บ string เดิมไว้
// -----------------------------------------------------------
function extractPreludesRaw(cssText) {
  const preludes = [];
  let buf = "";
  let bufStartLine = 1;
  let line = 1;
  let i = 0;
  const n = cssText.length;

  while (i < n) {
    const ch = cssText[i];

    if (ch === "/" && cssText[i + 1] === "*") {
      const end = cssText.indexOf("*/", i + 2);
      const chunk = end === -1 ? cssText.slice(i) : cssText.slice(i, end + 2);
      line += (chunk.match(/\n/g) || []).length;
      i = end === -1 ? n : end + 2;
      continue;
    }

    if (ch === '"' || ch === "'") {
      const quote = ch;
      let j = i + 1;
      while (j < n && cssText[j] !== quote) {
        if (cssText[j] === "\\") j++;
        j++;
      }
      const raw = cssText.slice(i, j + 1);
      line += (raw.match(/\n/g) || []).length;
      buf += raw; // ต่างจาก extractPreludes: เก็บ string เดิมไว้ ไม่ยุบเป็นช่องว่าง
      i = j + 1;
      continue;
    }

    if (ch === "{") {
      preludes.push({ text: buf, line: bufStartLine });
      buf = "";
      i++;
      bufStartLine = line;
      continue;
    }

    if (ch === "}") {
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

  return preludes;
}

// แยก attribute selector ออกจาก prelude แบบ raw (ไม่ยุบ string) — เก็บ attr/value/operator/line
// value === null หมายถึง boolean attribute เช่น [disabled]/[hidden]/[open]/[data-count] (ไม่มี =)
// operator ที่ไม่ใช่ "=" ตรงๆ (เช่น ^=, $=, *=, ~=, |=) ถือว่า "ตรวจอัตโนมัติไม่ได้แม่นยำ" เพราะ
// เป็น partial match ไม่ใช่ exact — สำรวจโปรเจกต์นี้จริงตอนเขียน (รอบ 45) พบว่าทุกจุดใช้ "=" ตรงๆ
// ทั้งหมด (ไม่มี ^=/$=/*=/~=/|= เลย) แต่เขียนรองรับไว้เผื่ออนาคต โดยแยกไปรายงานเป็นกลุ่ม "unverifiable"
function parseAttributeSelectors(cssText) {
  const preludes = extractPreludesRaw(cssText);
  const attrs = [];

  for (const { text, line } of preludes) {
    const trimmed = text.trim();
    if (trimmed === "" || trimmed.startsWith("@")) continue;

    for (const m of trimmed.matchAll(
      /\[\s*([a-zA-Z_-][\w-]*)\s*(?:([~|^$*]?=)\s*(?:"([^"]*)"|'([^']*)'))?\s*\]/g
    )) {
      const attr = m[1];
      const op = m[2] || null;
      const value = op ? (m[3] !== undefined ? m[3] : m[4]) : null;
      attrs.push({ attr, value, op, line });
    }
  }

  return attrs;
}

// data-xxx-yyy -> xxxYyy — HTMLElement.dataset ทำการแปลงชื่อ attribute แบบนี้อัตโนมัติ (browser
// native behavior) เจอบั๊กของ checker ตัวเองระหว่างทดสอบจริง (แพทเทิร์นเดียวกับที่รอบ 44 เจอบั๊ก 2
// จุดของ check-dead-css.mjs/check-imports.mjs เอง ต้องแก้ก่อนเชื่อผลได้): [data-fx-card] ถูกรายงาน
// เป็น dead ทั้งที่ js/fancy-effects.js ใช้จริงผ่าน `card.dataset.fxCard` (บรรทัด 81, 86) ไม่ใช่
// เขียน "data-fx-card" ตรงๆ เป็น string เลย wordPresent(attr) แบบเดิมเลยหาไม่เจอ — ต้องแปลง
// data-* เป็น camelCase แล้วเช็คในพูล JS เพิ่มอีกทางหนึ่งด้วย
function dataAttrToCamelCase(attr) {
  if (!attr.startsWith("data-")) return null;
  const rest = attr.slice(5); // ตัด "data-" ออก
  if (rest === "") return null;
  return rest.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
}

// เช็คว่า attribute name/value ถูกใช้จริงหรือไม่ — ใช้แนวทาง "กว้างเกินพอ" แบบเดียวกับข้อ 3 คือเช็คว่า
// ชื่อ (word-boundary ครอบ - ด้วย) ปรากฏที่ไหนก็ได้ใน HTML+JS รวมกัน ไม่ต้องอยู่ติดกันเป๊ะๆ
// (ครอบคลุมทั้ง data-status="won" ตรงๆ ใน HTML, setAttribute('data-status','won'), และ
// el.dataset.status = 'won' ที่ค่ากับชื่อ attribute ไม่ได้เขียนติดกันในซอร์ส) บวก dataset camelCase
// ตามที่อธิบายไว้ข้างบน (dataAttrToCamelCase)
function buildAttrUsageChecker(htmlTexts, jsUsagePool) {
  const pool = [...htmlTexts, ...jsUsagePool].join("\n");
  const jsPool = jsUsagePool.join("\n");
  const cache = new Map();
  function wordPresent(text, name) {
    const key = text === jsPool ? "js:" + name : "pool:" + name;
    if (cache.has(key)) return cache.get(key);
    const re = new RegExp(`(?<![\\w-])${escapeRegExp(name)}(?![\\w-])`);
    const found = re.test(text);
    cache.set(key, found);
    return found;
  }
  return function isAttrUsed(attr, value) {
    const attrFound =
      wordPresent(pool, attr) ||
      (() => {
        const camel = dataAttrToCamelCase(attr);
        return camel ? wordPresent(jsPool, camel) : false;
      })();
    if (value === null) return attrFound;
    return attrFound && wordPresent(pool, value);
  };
}

// -----------------------------------------------------------
// 6) CSS custom property (--foo) ที่ประกาศแล้วไม่เคยถูกเรียกใช้ที่ไหนเลย — รอบที่ 45 เพิ่มใหม่
//
//    ขอบเขต: สำรวจโปรเจกต์จริงก่อนเขียน (ดู NEXT-ROUND-PROMPT.txt หัวข้อรอบ 45 ที่เสนอไว้) พบว่า
//    custom property ไม่ได้ถูกประกาศเฉพาะใน :root เท่านั้น (เช่น --cat-accent ประกาศซ้ำใน
//    [data-cat="equip"]/[data-cat="government"]/... หลายจุด, --sx/--sy ประกาศใน rule ที่ผูกกับ
//    JS main-effects.js โดยเฉพาะ ไม่ใช่ :root) จึงสแกนทุกจุดประกาศทั้งไฟล์ ไม่ใช่จำกัดแค่ :root
//    ตามที่ระบุไว้ในหัวข้อเดิม (ชื่อหัวข้อพูดถึง :root เพราะเป็นเคสที่คาดไว้ล่วงหน้า แต่ implementation
//    ต้องครอบคลุมของจริงที่เจอ ไม่ใช่ตามสมมติฐานเดิมเป๊ะๆ)
//    การใช้งานเช็ค 2 ทาง: var(--foo) ที่ไหนก็ได้ในทั้ง 7 ไฟล์ CSS, และ
//    el.style.setProperty('--foo', ...) ในไฟล์ js/*.js (บางตัวมีแค่ default ใน CSS แล้วให้ JS
//    override ค่าจริงตอน runtime เช่น --eic-rx/--eic-ry ใน exit-intent-cta.css กับ
//    js/exit-intent-cta.js, --fx/--fy/--fd/--cx/--cy/--sx/--sy/--rx/--ry ใน style.css กับ
//    js/main-effects.js — ถ้าเช็คแค่ var() ในไฟล์ CSS อย่างเดียวจะ false-positive ว่า dead ทั้งที่
//    ใช้จริงผ่าน JS)
// -----------------------------------------------------------

// ยุบ comment กับ string ทิ้ง (แทนที่ด้วยช่องว่าง คงจำนวนบรรทัดเดิมไว้เพื่อคำนวณเลขบรรทัดถูกต้อง) —
// ใช้ text เดียวกันได้ทั้งหาตำแหน่งประกาศ (--foo:) และหาตำแหน่งเรียกใช้ (var(--foo) เพราะไม่ต้องสน
// บริบท prelude/declaration แยกกันเหมือนข้อ 5 (ชื่อ custom property ไม่มีทางมี comment/string ปน)
function stripCommentsAndStringsKeepLines(cssText) {
  let out = "";
  let i = 0;
  const n = cssText.length;
  while (i < n) {
    const ch = cssText[i];
    if (ch === "/" && cssText[i + 1] === "*") {
      const end = cssText.indexOf("*/", i + 2);
      const chunk = end === -1 ? cssText.slice(i) : cssText.slice(i, end + 2);
      out += chunk.replace(/[^\n]/g, " ");
      i = end === -1 ? n : end + 2;
      continue;
    }
    if (ch === '"' || ch === "'") {
      const quote = ch;
      let j = i + 1;
      while (j < n && cssText[j] !== quote) {
        if (cssText[j] === "\\") j++;
        j++;
      }
      const raw = cssText.slice(i, j + 1);
      out += raw.replace(/[^\n]/g, " ");
      i = j + 1;
      continue;
    }
    out += ch;
    i++;
  }
  return out;
}

// จุดประกาศ --foo: value; — ต้องขึ้นต้นด้วย ; หรือ { หรือ whitespace ก่อนหน้า (กันจับ var(--foo) ที่
// ตามด้วย : ปลอมๆ ไม่ได้ เพราะ var(--foo) ปิดด้วย ) ไม่ใช่ : เลยแยกกันได้เองอยู่แล้วโดย regex นี้ แต่
// เขียน anchor ไว้ให้ชัดเจนขึ้นกันเคสแปลกที่ไม่คาดคิด)
function parseCustomPropertyDeclarations(cssText) {
  const cleaned = stripCommentsAndStringsKeepLines(cssText);
  const decls = [];
  const re = /(^|[;{\s])--([a-zA-Z][\w-]*)\s*:/gm;
  for (const m of cleaned.matchAll(re)) {
    const idx = m.index + m[1].length;
    const line = cleaned.slice(0, idx).split("\n").length;
    decls.push({ name: m[2], line });
  }
  return decls;
}

function collectCssVarUsage(cleanedCssTexts) {
  const used = new Set();
  for (const cleaned of cleanedCssTexts) {
    for (const m of cleaned.matchAll(/var\(\s*--([a-zA-Z][\w-]*)/g)) used.add(m[1]);
  }
  return used;
}

function collectJsSetPropertyUsage(jsUsagePool) {
  const used = new Set();
  const combined = jsUsagePool.join("\n");
  for (const m of combined.matchAll(/setProperty\(\s*['"]--([a-zA-Z][\w-]*)/g)) used.add(m[1]);
  return used;
}

// -----------------------------------------------------------
// 7) @keyframes ที่ประกาศไว้แต่ไม่มี animation-name/animation shorthand ไหนเรียกใช้เลย — รอบที่ 46
//
//    สำรวจก่อนเขียน (ดู NEXT-ROUND-PROMPT.txt หัวข้อรอบ 46): โปรเจกต์นี้ไม่มี @font-face เลยแม้แต่
//    จุดเดียวทั้งโปรเจกต์ (grep ยืนยันแล้ว) จึงไม่คุ้มเขียน checker ส่วนนั้น — ไม่มีทางพิสูจน์ด้วยเคส
//    จริงได้เลยสักครั้ง (ตรงข้ามกับ custom property/attribute selector ในรอบ 45 ที่เจอบั๊กจริงระหว่าง
//    ทดสอบ) ส่วน @keyframes มี 74 จุดประกาศใน css/*.css ทั้ง 7 ไฟล์ คุ้มที่จะตรวจ
//
//    ขอบเขตจุดประกาศ: เหมือนเดิมทุกแบบ จำกัดแค่ 7 ไฟล์ css/*.css (ไม่รวม @keyframes ที่ประกาศแยก
//    ใน <style> ฝังในหน้า HTML บางหน้า เช่น skel-shimmer ใน blog-post.html/product-detail.html,
//    blogTagPulse/ssShimmer ใน blog.html, pdp-shimmer ใน product-detail.html, overlay-in/modal-in
//    ใน products.html — ตัวเหล่านี้อยู่นอกขอบเขต "css/*.css" ที่ตกลงกันไว้แต่แรกทั้งโปรเจกต์ เหมือนกับ
//    ที่ class/id/attribute/custom property ก็จำกัดขอบเขตประกาศไว้แค่ 7 ไฟล์นี้เท่านั้นเช่นกัน)
//
//    การใช้งานเช็คแบบ "กว้างเกินพอ" แบบเดียวกับข้อ 3/5 (word-boundary ที่ไหนก็ได้) แทนที่จะพาร์ส
//    animation-name:/animation: shorthand ให้ตรงเป๊ะ เพราะ:
//    - หน้า HTML บางหน้ามี @keyframes ของตัวเองใน <style> ที่ "เรียกใช้" ชื่อ keyframe ที่ตรงกับใน
//      css/*.css ก็เป็นไปได้ในทางทฤษฎี (ไม่พบเคสจริงตอนสำรวจ แต่เขียนให้ครอบคลุมไว้กันพลาด) — ต้องเอา
//      full HTML text ทั้งหน้ามาเป็นพูลเช็คด้วย ไม่ใช่แค่ inline <script>
//    - ต้องตัดจุด "ประกาศ" @keyframes name ของมันเองออกจากพูลก่อนเช็ค ไม่งั้นจะเจอตัวเองเสมอ (เช่น
//      declaration @keyframes cfSpin{...} เอง มีคำว่า cfSpin อยู่แล้วในบรรทัดประกาศ) — strip ด้วย
//      regex /@keyframes\s+NAME/g ออกจากทุกไฟล์ (css+html) ก่อนเช็คแทนที่จะเทียบ occurrence count
//      (ชัดเจนกว่า ไม่มีทาง false-negative ถ้ามีการประกาศซ้ำชื่อเดียวกันในหลายไฟล์ — สำรวจแล้วไม่มี
//      ชื่อซ้ำเลยสักตัวใน 74 จุดของโปรเจกต์นี้ แต่เขียนให้ทนทานไว้เผื่ออนาคต)
// -----------------------------------------------------------
function parseKeyframesDeclarations(cssText) {
  const preludes = extractPreludes(cssText);
  const decls = [];
  for (const { text, line } of preludes) {
    const trimmed = text.trim();
    const m = trimmed.match(/^@(?:-webkit-|-moz-|-o-)?keyframes\s+([A-Za-z_-][\w-]*)/);
    if (m) decls.push({ name: m[1], line });
  }
  return decls;
}

function buildKeyframeUsageChecker(cssTexts, htmlTexts, jsUsagePool) {
  const declStripped = [...cssTexts, ...htmlTexts].map((t) =>
    t.replace(/@(?:-webkit-|-moz-|-o-)?keyframes\s+[A-Za-z_-][\w-]*/g, " ")
  );
  const combined = [...declStripped, ...jsUsagePool].join("\n");
  const cache = new Map();
  return function isKeyframeUsed(name) {
    if (cache.has(name)) return cache.get(name);
    const re = new RegExp(`(?<![\\w-])${escapeRegExp(name)}(?![\\w-])`);
    const found = re.test(combined);
    cache.set(name, found);
    return found;
  };
}

// -----------------------------------------------------------
// main
// -----------------------------------------------------------
async function main() {
  const cssTexts = await Promise.all(CSS_FILES.map((f) => readFile(join(ROOT, f), "utf8")));
  const htmlTexts = await Promise.all(HTML_FILES.map((f) => readFile(join(ROOT, f), "utf8")));

  const { readdir } = await import("node:fs/promises");
  const jsDir = join(ROOT, "js");
  const jsFileNames = (await readdir(jsDir)).filter((f) => f.endsWith(".js")).sort();
  const jsTexts = await Promise.all(jsFileNames.map((f) => readFile(join(jsDir, f), "utf8")));

  // หลายหน้า HTML มี <style>/<script> ฝังอยู่เอง (เช่น product-detail.html มี .pdp-thumb ที่ถูก
  // set ผ่าน inline <script> ไม่ใช่ js/*.js ไฟล์แยก) — ต้องดึง <script> inline (ไม่มี src=) มารวม
  // ในพูลข้อความที่เอาไว้เช็ค "ใช้จริงหรือไม่" ด้วย ไม่งั้นจะ false-positive ว่า dead ทั้งที่ใช้จริง
  // (ไม่รวม CSS scan — ขอบเขตของสิ่งที่ "ประกาศ" ยังคงอยู่ที่ 7 ไฟล์ css/*.css ตามที่ตกลงไว้เดิม)
  const inlineScriptTexts = [];
  for (const htmlText of htmlTexts) {
    for (const m of htmlText.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)) {
      inlineScriptTexts.push(m[1]);
    }
  }
  const jsUsagePool = [...jsTexts, ...inlineScriptTexts];

  // รวบรวม class/id ที่ประกาศไว้ในทุกไฟล์ CSS
  const allClasses = []; // { name, file, line }
  const allIds = [];
  CSS_FILES.forEach((file, idx) => {
    const { classes, ids } = parseCssSelectors(cssTexts[idx]);
    for (const c of classes) allClasses.push({ ...c, file });
    for (const idSel of ids) allIds.push({ ...idSel, file });
  });

  // static usage รวมทุกหน้า HTML
  const staticClasses = new Set();
  const staticIds = new Set();
  htmlTexts.forEach((text) => {
    const { classes, ids } = collectStaticUsage(text);
    classes.forEach((c) => staticClasses.add(c));
    ids.forEach((i) => staticIds.add(i));
  });

  const isUsedInJs = buildJsUsageChecker(jsUsagePool);
  const dynamicPrefixes = collectDynamicPrefixes(jsUsagePool);

  function isDeadCandidate(name) {
    if (staticClasses.has(name) || staticIds.has(name)) return false;
    if (isUsedInJs(name)) return false;
    for (const prefix of dynamicPrefixes) {
      if (name.startsWith(prefix)) return { dynamicPrefix: prefix };
    }
    return true;
  }

  // เทียบ unique class/id (selector เดียวกันอาจถูกประกาศซ้ำหลายที่ — รายงานทุกจุดที่ dead)
  const deadClasses = [];
  const deadIds = [];
  const prefixSavedClasses = [];
  const prefixSavedIds = [];

  for (const c of allClasses) {
    const result = isDeadCandidate(c.name);
    if (result === true) deadClasses.push(c);
    else if (result && result.dynamicPrefix) prefixSavedClasses.push({ ...c, prefix: result.dynamicPrefix });
  }
  for (const idSel of allIds) {
    const result = isDeadCandidate(idSel.name);
    if (result === true) deadIds.push(idSel);
    else if (result && result.dynamicPrefix) prefixSavedIds.push({ ...idSel, prefix: result.dynamicPrefix });
  }

  const uniqueClassNames = new Set(allClasses.map((c) => c.name));
  const uniqueIdNames = new Set(allIds.map((c) => c.name));

  console.log("=== check-dead-css.mjs — รายงาน dead class/id selector ===\n");
  console.log(`สแกน CSS ${CSS_FILES.length} ไฟล์ / HTML ${HTML_FILES.length} หน้า / JS ${jsFileNames.length} ไฟล์ (+ inline <script> ${inlineScriptTexts.length} บล็อกใน HTML)`);
  console.log(`class selector ทั้งหมด (unique): ${uniqueClassNames.size} ตัว (${allClasses.length} จุดประกาศ)`);
  console.log(`id selector ทั้งหมด (unique): ${uniqueIdNames.size} ตัว (${allIds.length} จุดประกาศ)`);
  console.log(`dynamic prefix ที่เจอจาก template literal: ${dynamicPrefixes.size > 0 ? [...dynamicPrefixes].join(", ") : "(ไม่มี)"}\n`);

  if (deadClasses.length === 0) {
    console.log("✓ ไม่พบ dead class selector เพิ่มเติม");
  } else {
    console.log(`✗ พบ dead class selector ${deadClasses.length} จุด:`);
    for (const c of deadClasses) console.log(`  .${c.name}  (${c.file}:${c.line})`);
  }
  console.log("");

  if (deadIds.length === 0) {
    console.log("✓ ไม่พบ dead id selector เพิ่มเติม");
  } else {
    console.log(`✗ พบ dead id selector ${deadIds.length} จุด:`);
    for (const idSel of deadIds) console.log(`  #${idSel.name}  (${idSel.file}:${idSel.line})`);
  }

  if (prefixSavedClasses.length > 0 || prefixSavedIds.length > 0) {
    console.log("\n--- selector ที่รอดจาก dead list เพราะ match กับ dynamic prefix (ไม่ exact match ตรงๆ ในไฟล์ js — ตรวจสอบเพิ่มเติมเองถ้าไม่แน่ใจ) ---");
    for (const c of prefixSavedClasses) console.log(`  .${c.name}  (${c.file}:${c.line})  ← prefix "${c.prefix}"`);
    for (const idSel of prefixSavedIds) console.log(`  #${idSel.name}  (${idSel.file}:${idSel.line})  ← prefix "${idSel.prefix}"`);
  }

  // -----------------------------------------------------------
  // 5) attribute selector — รอบที่ 45
  // -----------------------------------------------------------
  const allAttrs = []; // { attr, value, op, file, line }
  CSS_FILES.forEach((file, idx) => {
    for (const a of parseAttributeSelectors(cssTexts[idx])) allAttrs.push({ ...a, file });
  });
  const isAttrUsed = buildAttrUsageChecker(htmlTexts, jsUsagePool);

  const deadAttrs = [];
  const unverifiableAttrs = []; // operator ที่ไม่ใช่ "=" ตรงๆ — ไม่ตัดสินอัตโนมัติ
  for (const a of allAttrs) {
    if (a.op && a.op !== "=") {
      unverifiableAttrs.push(a);
      continue;
    }
    if (!isAttrUsed(a.attr, a.value)) deadAttrs.push(a);
  }

  console.log("\n=== attribute selector ([data-status=\"won\"], [disabled], ...) — รอบที่ 45 ===\n");
  console.log(`attribute selector ทั้งหมดที่ประกาศ: ${allAttrs.length} จุด`);
  if (deadAttrs.length === 0) {
    console.log("✓ ไม่พบ dead attribute selector");
  } else {
    console.log(`✗ พบ dead attribute selector ${deadAttrs.length} จุด:`);
    for (const a of deadAttrs) {
      const label = a.value === null ? `[${a.attr}]` : `[${a.attr}${a.op}"${a.value}"]`;
      console.log(`  ${label}  (${a.file}:${a.line})`);
    }
  }
  if (unverifiableAttrs.length > 0) {
    console.log(`\n--- attribute selector ที่ตรวจอัตโนมัติไม่ได้แม่นยำ (operator ไม่ใช่ "=" ตรงๆ — ต้องดูเอง) ---`);
    for (const a of unverifiableAttrs) console.log(`  [${a.attr}${a.op}"${a.value}"]  (${a.file}:${a.line})`);
  }

  // -----------------------------------------------------------
  // 6) CSS custom property — รอบที่ 45
  // -----------------------------------------------------------
  const cleanedCssTexts = cssTexts.map(stripCommentsAndStringsKeepLines);
  const cssVarUsage = collectCssVarUsage(cleanedCssTexts);
  const jsSetPropertyUsage = collectJsSetPropertyUsage(jsUsagePool);

  const allCustomProps = []; // { name, file, line }
  CSS_FILES.forEach((file, idx) => {
    for (const d of parseCustomPropertyDeclarations(cssTexts[idx])) allCustomProps.push({ ...d, file });
  });

  const deadCustomProps = allCustomProps.filter(
    (p) => !cssVarUsage.has(p.name) && !jsSetPropertyUsage.has(p.name)
  );
  const uniqueCustomPropNames = new Set(allCustomProps.map((p) => p.name));

  console.log("\n=== CSS custom property (--foo) — รอบที่ 45 ===\n");
  console.log(`custom property ทั้งหมด (unique): ${uniqueCustomPropNames.size} ตัว (${allCustomProps.length} จุดประกาศ)`);
  if (deadCustomProps.length === 0) {
    console.log("✓ ไม่พบ dead custom property");
  } else {
    console.log(`✗ พบ dead custom property ${deadCustomProps.length} จุด:`);
    for (const p of deadCustomProps) console.log(`  --${p.name}  (${p.file}:${p.line})`);
  }

  // -----------------------------------------------------------
  // 7) @keyframes — รอบที่ 46
  // -----------------------------------------------------------
  const allKeyframes = []; // { name, file, line }
  CSS_FILES.forEach((file, idx) => {
    for (const k of parseKeyframesDeclarations(cssTexts[idx])) allKeyframes.push({ ...k, file });
  });
  const isKeyframeUsed = buildKeyframeUsageChecker(cssTexts, htmlTexts, jsUsagePool);
  const deadKeyframes = allKeyframes.filter((k) => !isKeyframeUsed(k.name));

  console.log("\n=== @keyframes — รอบที่ 46 ===\n");
  console.log(`@keyframes ทั้งหมดที่ประกาศ: ${allKeyframes.length} จุด`);
  console.log(`(หมายเหตุ: @font-face ไม่ได้ตรวจ เพราะไม่มีการประกาศเลยสักจุดเดียวในทั้งโปรเจกต์)`);
  if (deadKeyframes.length === 0) {
    console.log("✓ ไม่พบ dead @keyframes");
  } else {
    console.log(`✗ พบ dead @keyframes ${deadKeyframes.length} จุด:`);
    for (const k of deadKeyframes) console.log(`  @keyframes ${k.name}  (${k.file}:${k.line})`);
  }

  console.log("\nหมายเหตุ: สคริปต์นี้รายงานอย่างเดียว ไม่ลบ CSS rule ใดๆ อัตโนมัติ — การตัดสินใจว่า");
  console.log("\"dead จริง\" ต้องดูบริบทเพิ่มเติมเสมอ (เช่น anchor href=\"#id\", หรือ id/class ที่เตรียมไว้ใช้ในอนาคต)");

  if (
    deadClasses.length > 0 ||
    deadIds.length > 0 ||
    deadAttrs.length > 0 ||
    deadCustomProps.length > 0 ||
    deadKeyframes.length > 0
  ) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("check-dead-css.mjs error:", err);
  process.exitCode = 2;
});
