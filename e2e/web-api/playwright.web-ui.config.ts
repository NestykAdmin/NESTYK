import { defineConfig, devices } from '@playwright/test';
import { webUiEnv } from './src/web-ui/web-ui-env';

/**
 * ค่าตั้งของเทส UI เว็บ consumer-app (tests/web-ui) แยกจาก playwright.config.ts โดยตั้งใจ เหมือนชุด write
 *   - npm test กับ npm run test:api ไม่รันชุดนี้ (project api ของ playwright.config.ts ใช้แค่ tests/api)
 *   - รันด้วย npm run test:web-ui เท่านั้น ต้องเปิดเว็บไว้ก่อนด้วย npm run web ใน apps/consumer-app (ดู README หัวข้อ "เทส UI เว็บ consumer-app")
 *   - global-setup ของชุดนี้ไม่เรียกตัวตรวจของชุด API (ไม่ต้องเปิด API บนเครื่อง และไม่ใช้ uuid) เว็บล็อกอินด้วยรหัสผ่านผ่าน Supabase
 */
export default defineConfig({
  testDir: './tests/web-ui',

  // ตรวจว่าเว็บเปิดอยู่ และเว็บไม่ได้ชี้ไปที่ API บนเครื่อง (ตัวกันชั้นที่ 3 ใน src/web-ui/guard.ts)
  globalSetup: './src/web-ui/web-ui-global-setup.ts',

  // ทุกข้อใช้บัญชี QA ร่วมกัน และเทสหมดเวลาข้ามแท็บอาศัย localStorage ของแท็บในบริบทเดียวกัน
  // รันทีละข้อเพื่อให้ผลนิ่ง และไม่ยิงคำขอล็อกอินไปที่ Supabase ของทีมพร้อมกันหลายคำขอ
  fullyParallel: false,
  workers: 1,

  // ชุดนี้รันบนเครื่อง QA ไม่ใช่ CI จึงห้าม test.only ทุกครั้ง (ข้อเสนอของ test-reviewer)
  forbidOnly: true,

  // ไม่รันซ้ำเมื่อไม่ผ่าน: ถ้าผลแกว่งต้องเห็นทันที เหมือนชุด API
  retries: 0,

  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report-web-ui' }]],
  outputDir: 'test-results-web-ui',

  // เว็บในโหมดนักพัฒนา (Metro) โหลดช้าในครั้งแรก และเทสหมดเวลาต้องรอตัวตรวจที่ทำงานทุก 15 วินาที
  timeout: 90_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: webUiEnv.webUrl,
    // ปิด trace และวิดีโอ: trace เก็บค่าที่พิมพ์และเนื้อคำตอบของทุกคำขอ (รวม token ของ Supabase)
    trace: 'off',
    video: 'off',
    // ภาพหน้าจอเฉพาะข้อที่ไม่ผ่าน (ช่องรหัสผ่านแสดงเป็นจุด)
    // ข้อที่ไม่ผ่านยังมีไฟล์ error-context.md ที่เก็บโครงหน้าจอเป็นข้อความ รวมค่าในช่องรหัสผ่าน (ดู README หัวข้อ "รหัสผ่านกับรายงาน")
    screenshot: 'only-on-failure',
    // service worker ส่งคำขอได้โดยไม่ผ่าน page.route จึงต้องปิด ไม่อย่างนั้นตัวกันใน guard.ts อาจถูกข้าม
    serviceWorkers: 'block',
    locale: 'en-US',
    timezoneId: 'Asia/Bangkok',
    viewport: { width: 1280, height: 800 },
  },

  projects: [{ name: 'web-ui', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } }],
});
