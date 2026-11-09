import { defineConfig } from '@playwright/test';
import base from './playwright.web-ui.config';

/**
 * ค่าตั้งของเทส UI เว็บแบบภาษาไทย รันชุด tests/web-ui เดิมทั้งชุดด้วย npm run test:web-ui:th
 *   - ตั้ง E2E_WEB_LOCALE=th ก่อน Playwright เริ่ม worker: fixture ตั้งภาษาของเว็บเป็นไทย และ labels.ts ใช้ข้อความจาก labels.th.ts
 *     (worker รับตัวแปรแวดล้อมจากโปรเซสหลักตอนเริ่ม ไฟล์ค่าตั้งนี้ถูกโหลดก่อนเริ่ม worker)
 *   - ค่าอื่นเหมือนชุดภาษาอังกฤษ (playwright.web-ui.config.ts) ต่างแค่ที่เก็บผล เพื่อไม่ทับผลของชุดภาษาอังกฤษ
 *   - ข้อที่ผูกกับภาษาอังกฤษปรับตาม UI_LOCALE ในไฟล์เทส (ดู README หัวข้อ "รันเป็นภาษาไทย")
 */
process.env.E2E_WEB_LOCALE = 'th';

export default defineConfig({
  ...base,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report-web-ui-th' }]],
  outputDir: 'test-results-web-ui-th',
});
