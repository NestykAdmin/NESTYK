import { defineConfig } from '@playwright/test';

/**
 * ค่าตั้งของ Playwright สำหรับชุดเทส e2e/web-api
 * ที่อยู่ของระบบที่จะเทสอยู่ใน src/config/env.ts (เปลี่ยนได้ด้วยตัวแปรแวดล้อม)
 */
export default defineConfig({
  testDir: './tests',

  // ตรวจว่า API พร้อมและล็อกอินได้ ก่อนเริ่มเทสทั้งชุด
  globalSetup: './src/global-setup.ts',

  // เทสชุดนี้อ่านข้อมูลอย่างเดียว จึงรันพร้อมกันหลายข้อได้โดยไม่กวนกัน
  fullyParallel: true,

  // บนระบบ CI ห้ามมี test.only ค้างอยู่ในโค้ด (จะทำให้เทสข้ออื่นไม่ถูกรันโดยไม่มีใครรู้)
  forbidOnly: !!process.env.CI,

  // ไม่รันซ้ำเมื่อไม่ผ่าน: เทส API ต้องได้ผลเหมือนเดิมทุกครั้ง ถ้าผลไม่นิ่งต้องเห็นทันที
  retries: 0,

  // list = พิมพ์ผลทีละข้อใน Terminal   html = รายงานแบบเปิดในเบราว์เซอร์ เก็บที่โฟลเดอร์ playwright-report
  reporter: [['list'], ['html', { open: 'never' }]],

  // เวลาสูงสุดของเทส 1 ข้อ และของการตรวจ (expect) 1 ครั้ง หน่วยเป็นมิลลิวินาที
  timeout: 30_000,
  expect: { timeout: 5_000 },

  projects: [
    // เทส API: ไม่เปิดเบราว์เซอร์ จึงไม่ต้องติดตั้งเบราว์เซอร์ของ Playwright
    { name: 'api', testDir: './tests/api' },
  ],
});
