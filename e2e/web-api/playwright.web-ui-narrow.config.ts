import { defineConfig, devices } from '@playwright/test';
import base from './playwright.web-ui.config';

/**
 * ค่าตั้งของเทส UI เว็บบนจอแคบ (tests/web-ui-narrow) รันด้วย npm run test:web-ui:narrow เพิ่ม 9 พ.ย. 2026
 *   - เว็บที่กว้างน้อยกว่า 768px แสดงหน้าแบบเดียวกับแอปมือถือ (แท็บล่าง + เมนูด้านข้าง) แทนโครงหน้าเดสก์ท็อป
 *     (apps/consumer-app/app/index.tsx:188 WEB_SHELL_MIN_WIDTH, :756-760 isWideWeb/isDesktopWeb ที่ qa/e2e 74b46f4)
 *   - ชุด tests/web-ui รันที่ 1280px จึงไม่เคยเห็นหน้าแบบนี้ของนายหน้า ผู้เช่า และผู้ให้เช่า
 *   - ใช้ค่าตั้งของชุด UI เว็บทั้งหมด (global-setup, ตัวกันคำขอ, รันทีละข้อ, ภาษาอังกฤษ) ต่างแค่ขนาดจอ ที่เก็บเทส และที่เก็บผล
 *   - ขนาด 390x844 เท่าจอมือถือทั่วไป ใช้ Desktop Chrome (เมาส์ ไม่ใช่จอสัมผัส) เพราะแอปเลือกหน้าตามความกว้างอย่างเดียว (useWindowDimensions)
 *   - ปิดภาพหน้าจอทั้งชุด: หน้าลีด ผู้เช่า และบิลแสดงชื่อลูกค้าจริง (เหมือนชุดเขียนข้อมูลบนเว็บ)
 *     ข้อที่ไม่ผ่านยังมี error-context.md ที่เก็บข้อความบนหน้า ห้าม commit หรือแนบส่งต่อ
 */
const NARROW_VIEWPORT = { width: 390, height: 844 };

export default defineConfig({
  ...base,
  testDir: './tests/web-ui-narrow',
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report-web-ui-narrow' }]],
  outputDir: 'test-results-web-ui-narrow',
  use: { ...base.use, viewport: NARROW_VIEWPORT, screenshot: 'off' },
  projects: [{ name: 'web-ui-narrow', use: { ...devices['Desktop Chrome'], viewport: NARROW_VIEWPORT } }],
});
