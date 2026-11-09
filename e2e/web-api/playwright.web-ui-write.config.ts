import { defineConfig } from '@playwright/test';
import base from './playwright.web-ui.config';

/**
 * ค่าตั้งของเทสเขียนข้อมูลบนเว็บ consumer-app (tests/web-ui-write) รันด้วย npm run test:web-ui-write เท่านั้น
 *   - ใช้ค่าเดียวกับชุดอ่านอย่างเดียว (playwright.web-ui.config.ts) ยกเว้นโฟลเดอร์เทส global-setup และที่เก็บผล
 *   - global-setup หยุดทั้งชุดถ้าไม่ได้ตั้ง E2E_ALLOW_WRITES=yes (src/web-ui/write/web-write-global-setup.ts)
 *   - workers 1 ตามชุดเดิม ห้ามรันพร้อม npm run test:write เพราะใช้ลีดถาวรตัวเดียวกัน
 *   - ปิดภาพหน้าจอ (ต่างจากชุดอ่านอย่างเดียว): หน้าลีด ปฏิทิน และหน้าต่างนัด (LeadViewingSheet.tsx:281-286) แสดงชื่อลูกค้าจริง
 *   - ตั้ง actionTimeout เพื่อให้ข้อที่ล้มจบเร็ว และ afterEach เก็บกวาดได้ทันที
 */
export default defineConfig({
  ...base,
  testDir: './tests/web-ui-write',
  globalSetup: './src/web-ui/write/web-write-global-setup.ts',
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report-web-ui-write' }]],
  outputDir: 'test-results-web-ui-write',
  // ภาพหน้าจอปิด (ชุดอ่านอย่างเดียวเปิดเฉพาะข้อที่ไม่ผ่าน) เพราะหน้าลีดและปฏิทินแสดงชื่อลูกค้าจริง
  // actionTimeout: การคลิกหรือพิมพ์ที่หาชิ้นส่วนไม่เจอให้ล้มภายใน 20 วินาที ไม่รอจนหมดเวลาของทั้งข้อ (90 วินาที)
  //   ค่าที่เลือกเอง: มากกว่า expect (10 วินาที) และเผื่อหน้าแรกของเว็บโหมดนักพัฒนาที่โหลดช้า
  use: { ...base.use, screenshot: 'off', actionTimeout: 20_000 },
});
