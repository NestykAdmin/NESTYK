import { defineConfig } from '@playwright/test';

/**
 * ค่าตั้งของเทสที่เขียนข้อมูลจริง (tests/write) แยกจาก playwright.config.ts โดยตั้งใจ
 *   - npm test กับ npm run test:api ใช้ playwright.config.ts จึงไม่รันเทสชุดนี้
 *   - รันด้วย E2E_ALLOW_WRITES=yes npm run test:write เท่านั้น (ตัวกันอยู่ใน src/write/write-guard.ts)
 */
export default defineConfig({
  testDir: './tests/write',

  // ตรวจตัวกันก่อน แล้วจึงรัน global-setup เดิมของชุดเทส
  globalSetup: './src/write/write-global-setup.ts',

  // เทสชุดนี้แก้ลีดถาวรตัวเดียวกัน จึงต้องรันทีละข้อตามลำดับในไฟล์
  fullyParallel: false,
  workers: 1,

  forbidOnly: !!process.env.CI,
  retries: 0,

  // เก็บรายงานแยกโฟลเดอร์ ไม่ทับรายงานของ npm test
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report-write' }]],
  outputDir: 'test-results-write',

  timeout: 30_000,
  expect: { timeout: 5_000 },

  projects: [{ name: 'write', testDir: './tests/write' }],
});
