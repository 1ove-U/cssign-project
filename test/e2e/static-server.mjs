// test/e2e/static-server.mjs
// Static file server ล้วน ๆ ด้วย node:http (ไม่เพิ่ม dependency ใหม่) — ใช้แค่ตอนรัน Playwright
// E2E test เท่านั้น (เรียกผ่าน webServer.command ใน playwright.config.js) เสิร์ฟไฟล์จาก root
// ของโปรเจกต์ตรง ๆ เหมือน static hosting จริง (firebase hosting ใช้ "public": "." เช่นกัน)
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, extname, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(import.meta.url), "..", "..", "..");
const PORT = Number(process.argv[2]) || 4173;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".pdf": "application/pdf",
  ".webmanifest": "application/manifest+json",
  ".xml": "application/xml",
  ".txt": "text/plain; charset=utf-8",
};

async function resolvePath(urlPath) {
  let safePath = normalize(decodeURIComponent(urlPath.split("?")[0])).replace(/^(\.\.[/\\])+/, "");
  if (safePath === "/" || safePath === "") safePath = "/index.html";
  let filePath = join(ROOT, safePath);

  try {
    const st = await stat(filePath);
    if (st.isDirectory()) filePath = join(filePath, "index.html");
    return filePath;
  } catch {
    // ไม่มีไฟล์ตรง ๆ (เช่น /about → /about.html) ลองเติม .html ก่อน ค่อย fallback 404.html
    if (!extname(filePath)) {
      const withHtml = `${filePath}.html`;
      try {
        await stat(withHtml);
        return withHtml;
      } catch {
        /* fallthrough */
      }
    }
    return join(ROOT, "404.html");
  }
}

const server = createServer(async (req, res) => {
  try {
    const filePath = await resolvePath(req.url || "/");
    const data = await readFile(filePath);
    const type = MIME[extname(filePath).toLowerCase()] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": type });
    res.end(data);
  } catch (err) {
    res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    res.end(`Static server error: ${err.message}`);
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[e2e static-server] serving ${ROOT} at http://127.0.0.1:${PORT}`);
});
