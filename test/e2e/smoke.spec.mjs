// test/e2e/smoke.spec.mjs
// P0.1a — smoke test เปล่า ๆ ยืนยันว่า pipeline ทั้งชุด (Playwright + static-server + config)
// ทำงานจริงได้ก่อนจะเริ่มเขียน test ของจริงใน P0.1b เป็นต้นไป
import { test, expect } from "@playwright/test";

test("หน้าแรกโหลดได้ + title ถูกต้อง", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/CS\.SIGN|ป้าย/);
  await expect(page.locator("body")).toBeVisible();
});
