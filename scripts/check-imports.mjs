#!/usr/bin/env node
// ===========================================================
// scripts/check-imports.mjs
//
// ค้างมาตั้งแต่รอบที่ 35 — cross-reference named import ทั่วทั้ง js/*.js เทียบกับ export จริง
// ของไฟล์ต้นทาง เพื่อจับเคสแบบ "import { ชื่อผิด } from './x.js'" ที่ x.js ไม่ได้ export ชื่อนั้น
// จริง (typo/ลืมแก้ตอน rename/ลืม export) ซึ่งปกติจะไป throw ตอน runtime เท่านั้น (import ของ
// named specifier ที่ไม่มีจริงจะได้ `undefined` เงียบๆ ใน some case หรือ throw SyntaxError ใน
// strict ESM — แต่กว่าจะรู้ตัวก็ต้องรันจริงเจอ code path นั้นก่อน) ตรวจล่วงหน้าได้เร็วกว่า
//
// วิธีทำงาน — "dynamic-import ground-truth" (แพทเทิร์นเดียวกับรอบ 35/36/38 ไม่ใช่ regex เดา
// export list): แทนที่จะ parse `export ...` ด้วย regex (พลาดง่ายกับ re-export/export {}), สคริปต์
// นี้ `import()` ไฟล์ต้นทางจริงแล้วอ่าน Object.keys() ของ module namespace object ที่ได้ — คือค่า
// export จริงที่ Node เห็น ไม่ใช่สิ่งที่เรา "เดา" จากหน้าตาโค้ด
//
// ข้อจำกัดที่รู้อยู่แล้ว (บันทึกไว้ตามรอบก่อนๆ):
//   - ไฟล์ที่ import Firebase SDK ตรงจาก URL (js/db.js, js/db-orders.js) ต้องพึ่ง
//     test/helpers/firebase-stub-loader.mjs (รันสคริปต์นี้ผ่าน `node --import
//     ./test/helpers/register-loader.mjs scripts/check-imports.mjs` เพื่อดัก URL เหล่านั้น)
//   - [แก้แล้วรอบที่ 52] js/email-notify.js import emailjs จาก CDN URL ตรงๆ (cdn.jsdelivr.net) —
//     ตอนนี้มี test/helpers/emailjs-stub-loader.mjs ดัก URL นี้แล้ว (แพทเทิร์นเดียวกับ
//     firebase-stub-loader.mjs) ทำให้ dynamic import ไฟล์นี้ตรงๆ ได้จริงเป็น ground truth —
//     แต่ js/lead-quote-modal.js ที่ import ไฟล์นี้ต่อ ยังคง fallback อยู่ดี เพราะตัวมันเองมี
//     top-level DOM query ที่คืน null บน generic blank DOM (ต้องมี markup จริงของฟอร์ม quote
//     ในหน้า HTML จริงถึงจะไม่ throw — ยังไม่ได้แก้ในรอบนี้)
//   - ไฟล์ที่มี top-level DOM query แบบเจาะจงหน้า HTML หนึ่งๆ (เช่น orders-tab.js/admin-page.js —
//     ดู note รอบ 35/36) อาจ throw ตอน import ถ้า document ที่ตั้งไว้ล่วงหน้าไม่มี element ที่มันหา
//     — [ปรับปรุงรอบที่ 53] เดิมสคริปต์นี้ตั้ง jsdom เป็นเอกสารเปล่า (`<html><body></body></html>`)
//     ไว้ล่วงหน้า กัน "document is not defined" ได้ แต่ไฟล์กลุ่ม admin-*.js/orders-tab-*.js ส่วนใหญ่
//     ทำ top-level `document.getElementById("ad-...")` แล้วเรียก `.addEventListener` ต่อทันทีโดยไม่
//     เช็ค null (พบตั้งแต่การสำรวจรอบ 44/51) — บน DOM เปล่าจะได้ null เสมอ แล้ว throw "Cannot read
//     properties of null" กลายเป็น fallback ทั้งหมด ทั้งที่จริงๆ element เหล่านั้นมีอยู่จริงใน
//     admin.html — จึงเปลี่ยนมาสร้าง jsdom จาก **เนื้อหาจริงของ admin.html** แทน (อ่านไฟล์ตรงๆ ไม่รัน
//     `<script>` ใดๆ เพราะไม่ได้เปิด `runScripts` — ปลอดภัย แค่ได้ DOM tree จริงที่มี id ครบ) ทำให้
//     ไฟล์กลุ่มนี้ที่ query หา element จริงที่มีอยู่ใน admin.html สำเร็จ ได้ dynamic-import ground
//     truth เพิ่มขึ้นแทนที่จะ fallback — ถ้าอ่าน admin.html ไม่ได้ (ไฟล์หาย/ย้าย) จะ fallback ไปใช้
//     เอกสารเปล่าเหมือนเดิมทันที ไม่ throw ทั้งสคริปต์ — ไฟล์ที่ query หา element เฉพาะหน้าอื่น (เช่น
//     index.html/products.html) หรือไฟล์ที่มี circular import ระหว่างกันเอง (เช่น
//     admin-leads.js/admin-leads-actions.js/admin-settings-team.js ที่ยังพึ่งพากันแบบ TDZ อยู่ — ดู
//     บันทึกรอบ 53 ด้านล่าง) ยังคง fallback เป็น static-regex เหมือนเดิม ไม่ใช่ปัญหาที่ DOM แก้ได้

//
// รัน: node --import ./test/helpers/register-loader.mjs scripts/check-imports.mjs
//   หรือ: npm run check-imports (มี --import ผูกไว้ให้แล้วใน package.json)
// ===========================================================

import { readFile, readdir } from "node:fs/promises";
import { join, dirname, resolve as pathResolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { JSDOM } from "jsdom";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const JS_DIR = join(ROOT, "js");

// ตั้ง jsdom document/window ไว้ล่วงหน้า กัน "document is not defined" สำหรับไฟล์ที่มี
// top-level document.addEventListener()/document.getElementById() ธรรมดา (พบตั้งแต่รอบ 35)
//
// [รอบที่ 53] ใช้เนื้อหาจริงของ admin.html แทนเอกสารเปล่า เพื่อให้ไฟล์กลุ่ม admin-*.js/
// orders-tab-*.js ที่ query หา element จริงของหน้าแอดมิน (เช่น `#ad-gate`, `#ad-l-table-body`)
// ตอน top-level แล้วเรียก .addEventListener ต่อทันทีโดยไม่เช็ค null เจอ element จริงแทนที่จะได้
// null แล้ว throw — ไม่ได้เปิด `runScripts` จึงไม่มี `<script>` ใดถูกรันจริง ปลอดภัย แค่ parse
// เป็น DOM tree เฉยๆ — ถ้าอ่านไฟล์ admin.html ไม่ได้ (เผื่อย้าย/ลบ) fallback เป็นเอกสารเปล่าทันที
async function setupGenericDom() {
  let html = "<!doctype html><html><body></body></html>";
  try {
    html = await readFile(join(ROOT, "admin.html"), "utf8");
  } catch {
    // เก็บ html เป็นเอกสารเปล่าตามเดิม ไม่ throw — ยังต้องมี document ใช้งานได้เสมอ
  }
  const dom = new JSDOM(html, {
    url: "https://example.test/admin.html",
    pretendToBeVisual: true,
  });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  // navigator เป็น getter-only property บน globalThis ใน Node เวอร์ชันนี้ (assign ตรงๆ throw) —
  // ต้องใช้ defineProperty ทับแทน เหมือนที่ Node ทำเองตอน bootstrap navigator ของมัน
  Object.defineProperty(globalThis, "navigator", {
    value: dom.window.navigator,
    configurable: true,
    writable: true,
  });
  globalThis.localStorage = dom.window.localStorage;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.CustomEvent = dom.window.CustomEvent;
}

// -----------------------------------------------------------
// parse import statements
//
// หมายเหตุ: เดิมลองใช้ regex เดียวกวาดทั้งไฟล์แบบ [\s\S]*? (lazy) ตรงๆ แต่พังจริง — ถ้ามี `}`
// ของโค้ดอื่น (เช่น comment block, object literal) อยู่ระหว่าง import สองจุดที่ตามด้วยข้อความที่
// ไม่ใช่ "from ...", regex จะไล่ขยายข้าม comment/โค้ดไปหา `}` ตัวถัดไปที่ตามด้วย from จริง ทำให้
// ได้ named-specifier ปนคอมเมนต์มายาวเป็นสิบบรรทัด (ตรวจพบตอนรันจริง เลยแก้เป็นวิธีนี้แทน) —
// ใช้การสแกนทีละบรรทัดขีดขอบเขต "1 import statement" ให้ชัดก่อน แล้วค่อย regex เฉพาะในขอบเขตนั้น
// ที่แคบพอจะไม่หลุดไปกินโค้ด/คอมเมนต์อื่น (มี cap กันบรรทัดยาวเกินจริงไว้ด้วยเพื่อความปลอดภัย)
// -----------------------------------------------------------
const MAX_IMPORT_STATEMENT_LINES = 20;
const IMPORT_RE =
  /^\s*import\s+(?:(\*\s*as\s+[a-zA-Z_$][\w$]*)|([a-zA-Z_$][\w$]*)(?:\s*,\s*\{([\s\S]*?)\})?|\{([\s\S]*?)\})\s+from\s*["']([^"']+)["']\s*;?/;

function isolateImportStatements(jsText) {
  const lines = jsText.split("\n");
  const statements = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^\s*import\s/.test(line)) {
      let buf = line;
      let j = i;
      // ถ้าบรรทัดนี้มี "from" พร้อม quote ปิดแล้ว ถือว่าจบในบรรทัดเดียว ไม่ต้องอ่านต่อ
      if (!/\bfrom\s*["'][^"']+["']/.test(line)) {
        let steps = 0;
        while (j + 1 < lines.length && steps < MAX_IMPORT_STATEMENT_LINES) {
          j++;
          steps++;
          buf += "\n" + lines[j];
          if (/\bfrom\s*["'][^"']+["']/.test(lines[j])) break;
        }
      }
      statements.push(buf);
      i = j + 1;
    } else {
      i++;
    }
  }
  return statements;
}

function parseImports(jsText) {
  const results = [];
  for (const stmt of isolateImportStatements(jsText)) {
    const m = stmt.match(IMPORT_RE);
    if (!m) continue; // เผื่อ statement ประหลาด/parse ไม่ครบ — ข้าม ไม่เดา
    const [, namespaceImport, defaultImport, namedAfterDefault, namedOnly, source] = m;
    const namedRaw = namedAfterDefault ?? namedOnly ?? "";
    const named = namedRaw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((spec) => {
        const asMatch = spec.match(/^([a-zA-Z_$][\w$]*)\s+as\s+([a-zA-Z_$][\w$]*)$/);
        return asMatch ? { imported: asMatch[1], local: asMatch[2] } : { imported: spec, local: spec };
      });
    results.push({ namespaceImport: !!namespaceImport, defaultImport: defaultImport || null, named, source });
  }
  return results;
}

// -----------------------------------------------------------
// export จริง — ลอง dynamic import ก่อน (ground truth) ถ้าพังค่อย fallback เป็น static regex
// -----------------------------------------------------------
const RE_EXPORT_NAMED = /^export\s+(?:async\s+)?(?:function\*?|const|let|var|class)\s+([a-zA-Z_$][\w$]*)/gm;
const RE_EXPORT_BRACE = /^export\s*\{([^}]*)\}(?:\s*from\s*["'][^"']+["'])?/gm;

function staticExportNames(jsText) {
  const names = new Set();
  for (const m of jsText.matchAll(RE_EXPORT_NAMED)) names.add(m[1]);
  for (const m of jsText.matchAll(RE_EXPORT_BRACE)) {
    for (const spec of m[1].split(",").map((s) => s.trim()).filter(Boolean)) {
      const asMatch = spec.match(/^[a-zA-Z_$][\w$]*\s+as\s+([a-zA-Z_$][\w$]*)$/);
      names.add(asMatch ? asMatch[1] : spec);
    }
  }
  return names;
}

async function resolveExports(absPath) {
  try {
    const mod = await import(pathToFileURL(absPath).href);
    return { names: new Set(Object.keys(mod)), method: "dynamic-import (ground truth)" };
  } catch (err) {
    const text = await readFile(absPath, "utf8");
    return {
      names: staticExportNames(text),
      method: "static-regex-fallback",
      reason: err && err.message ? err.message.split("\n")[0] : String(err),
    };
  }
}

// -----------------------------------------------------------
// main
// -----------------------------------------------------------
async function main() {
  await setupGenericDom();

  const jsFileNames = (await readdir(JS_DIR)).filter((f) => f.endsWith(".js")).sort();
  const jsTexts = new Map();
  for (const f of jsFileNames) jsTexts.set(f, await readFile(join(JS_DIR, f), "utf8"));

  // เก็บ import statement ทุกจุดที่อ้างไฟล์ local (./...) — ข้าม URL ภายนอก (http/https) เพราะ
  // ไม่ใช่ไฟล์ในโปรเจกต์ที่จะ cross-reference export ได้อยู่แล้ว
  const allImports = []; // { fromFile, source, defaultImport, named }
  for (const [fileName, text] of jsTexts) {
    for (const imp of parseImports(text)) {
      if (/^https?:\/\//.test(imp.source)) continue;
      if (!imp.source.startsWith("./") && !imp.source.startsWith("../")) continue;
      allImports.push({ fromFile: fileName, ...imp });
    }
  }

  // resolve export ของทุกไฟล์ source ที่ถูก import จริง (unique)
  const uniqueSourcePaths = new Set(
    allImports.map((imp) => pathResolve(JS_DIR, imp.source))
  );
  const exportCache = new Map(); // absPath -> { names, method, reason }
  for (const absPath of uniqueSourcePaths) {
    exportCache.set(absPath, await resolveExports(absPath));
  }

  // เทียบ
  const problems = []; // { fromFile, source, missingName, method }
  for (const imp of allImports) {
    const absPath = pathResolve(JS_DIR, imp.source);
    const info = exportCache.get(absPath);
    if (!info) continue;
    for (const { imported } of imp.named) {
      if (!info.names.has(imported)) {
        problems.push({ fromFile: imp.fromFile, source: imp.source, missingName: imported, method: info.method, reason: info.reason });
      }
    }
    if (imp.defaultImport && !info.names.has("default")) {
      problems.push({ fromFile: imp.fromFile, source: imp.source, missingName: "default", method: info.method, reason: info.reason });
    }
  }

  const dynamicCount = [...exportCache.values()].filter((v) => v.method.startsWith("dynamic")).length;
  const fallbackEntries = [...exportCache.entries()].filter(([, v]) => v.method === "static-regex-fallback");

  console.log("=== check-imports.mjs — cross-reference named import กับ export จริง ===\n");
  console.log(`import statement ที่ตรวจ (เฉพาะ local ./...): ${allImports.length} จุด`);
  console.log(`ไฟล์ source ที่ถูก import (unique): ${uniqueSourcePaths.size} ไฟล์`);
  console.log(`  - resolve ด้วย dynamic import จริง (ground truth): ${dynamicCount} ไฟล์`);
  console.log(`  - fallback เป็น static export regex (import ตรงไม่ได้): ${fallbackEntries.length} ไฟล์\n`);

  if (fallbackEntries.length > 0) {
    console.log("ไฟล์ที่ fallback เป็น static regex (เหตุผลที่ dynamic import ตรงๆ ไม่ได้):");
    for (const [absPath, info] of fallbackEntries) {
      console.log(`  - ${absPath.replace(ROOT + "/", "")}  (${info.reason})`);
    }
    console.log("");
  }

  if (problems.length === 0) {
    console.log("✓ ไม่พบ named import ที่ไม่ตรงกับ export จริงของไฟล์ต้นทาง");
  } else {
    console.log(`✗ พบ named import ที่อาจผิด ${problems.length} จุด:`);
    for (const p of problems) {
      console.log(`  js/${p.fromFile}  import { ${p.missingName} } from "${p.source}"  ← ไม่พบใน export (${p.method}${p.reason ? ": " + p.reason : ""})`);
    }
  }

  if (problems.length > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error("check-imports.mjs error:", err);
  process.exitCode = 2;
});
