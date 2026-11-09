import { defineConfig, devices } from '@playwright/test';
import base from './playwright.web-ui.config';

/**
 * ค่าตั้งของเทสสิทธิ์เข้าหน้าบนเว็บ portal agent (tests/web-ui-portal-agent) รันด้วย npm run test:web-ui:portal-agent เพิ่ม 9 พ.ย. 2026
 *   - เว็บต้องเป็น build จริงที่ตั้ง EXPO_PUBLIC_WEB_PORTAL=agent (agent.nestyk.com) ตามข้อ E ของ
 *     docs/qa-fixes/2026-11-09-qa-handoff-review-0a21689.md: npm run build:web แล้ว npm run serve:web (scripts/serve-web-dist.cjs พอร์ต 8090)
 *   - ต้องตั้ง E2E_CONSUMER_WEB_URL=http://localhost:8090 และ E2E_WEB_PORTAL=agent ใน Terminal (README หัวข้อ "เทสบนเว็บ portal agent")
 *     ถ้าไม่ตั้ง global-setup จะเปิดเว็บ dev ที่ 8081 แทน และทุกข้อในชุดนี้ข้าม (tests/web-ui-portal-agent/*.spec.ts)
 *   - ใช้ค่าตั้งของชุด UI เว็บทั้งหมด (global-setup, ตัวกันคำขอ, รันทีละข้อ, ภาษาอังกฤษ, 1280px) ต่างแค่ที่เก็บเทสกับที่เก็บผล
 *   - ห้ามรันชุด web-ui อื่นกับเว็บนี้ ชุดอื่นคาด portal all
 */
export default defineConfig({
  ...base,
  testDir: './tests/web-ui-portal-agent',
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report-web-ui-portal-agent' }]],
  outputDir: 'test-results-web-ui-portal-agent',
  projects: [{ name: 'web-ui-portal-agent', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } }],
});
