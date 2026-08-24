// playwright.config.js
// Config สำหรับ E2E test ด้วย Playwright — แยก layer จาก unit test เดิม (Node test runner + jsdom)
// รันด้วย `npm run test:e2e` (ดู scripts ใน package.json) ไม่รวมเข้า `npm test` เดิมเด็ดขาด
//
// หมายเหตุ: โปรเจกต์นี้ไม่มี build step (vanilla JS, static HTML) — webServer ด้านล่างจึง
// เสิร์ฟไฟล์ static ตรง ๆ ด้วย test/e2e/static-server.mjs (เขียนเองด้วย node:http ล้วน ๆ
// ไม่เพิ่ม dependency ใหม่สำหรับแค่เสิร์ฟไฟล์)
import { defineConfig, devices } from "@playwright/test";

const PORT = 4173;

export default defineConfig({
  testDir: "./test/e2e",
  testMatch: "**/*.spec.mjs",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [["list"]],
  timeout: 30_000,
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `node test/e2e/static-server.mjs ${PORT}`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 10_000,
  },
});
