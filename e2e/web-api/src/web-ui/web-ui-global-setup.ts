import { chromium } from '@playwright/test';
import { classifyRequest } from './guard';
import { PASSWORD_VARIABLES, passwordOf, unsafeApiOriginReason, webUiEnv, type WebUiRole } from './web-ui-env';

/**
 * global-setup ของเทส UI เว็บ (playwright.web-ui.config.ts) ทำก่อนเริ่มทั้งชุด ถ้าไม่ผ่าน หยุดทั้งชุดและบอกสาเหตุ
 *   1. E2E_WEB_API_ORIGIN ต้องเป็น https ไม่ใช่เครื่องนี้หรือเครื่องในวง LAN และชื่อเครื่องอยู่ใน ALLOWED_API_HOSTS (web-ui-env.ts)
 *      (ตัวกันชั้นที่ 2 ใช้ค่านี้ตัดสินว่า API ไหนเรียกได้)
 *   2. เปิดหน้าแรกของเว็บได้ (npm run web เปิดอยู่)
 *   3. ระหว่างโหลดหน้าแรกแบบไม่ล็อกอิน ถ้าเห็นคำขอ /api/ ไปที่อื่นที่ไม่ใช่ E2E_WEB_API_ORIGIN หยุดทั้งชุดก่อนล็อกอิน (ตัวกันชั้นที่ 3)
 *      คำขอที่เห็นถูกตัดทั้งหมด ไม่ถึงปลายทาง หน้าแรกของผู้เยี่ยมชมน่าจะไม่เรียก API (index.tsx ใช้ MOCK_LISTINGS: test-reviewer อนุมาน)
 *      ถ้าไม่เห็นคำขอเลย ชั้นนี้ตรวจอะไรไม่ได้ จะพิมพ์บอกไว้ ตัวกันชั้นที่ 1-2 ยังทำงานในทุกข้อ
 *   4. พิมพ์บรรทัดสรุปว่าบัญชีไหนตั้งรหัสผ่านแล้ว (ไม่พิมพ์รหัส)
 */
export default async function webUiGlobalSetup(): Promise<void> {
  const unsafe = unsafeApiOriginReason(webUiEnv.apiOrigin);
  if (unsafe) {
    throw new Error(
      `หยุดก่อนเปิดเว็บ: E2E_WEB_API_ORIGIN=${webUiEnv.apiOrigin} ใช้ไม่ได้ (${unsafe})\n` +
        'API บนเครื่องตั้ง ALLOW_DEV_ROLE_GRANT=true และต่อฐานข้อมูลของทีม เทส UI ต้องรันกับเว็บที่เรียก staging เท่านั้น (บันทึก QA 4 พ.ย. 2026)',
    );
  }

  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ serviceWorkers: 'block' });
    const seen: string[] = [];
    let foreign = 0;
    // ตัดทุกคำขอ /api/ ระหว่างตรวจ (ไม่ส่งอะไรไป API เลยในขั้นนี้) แล้วจดว่าไปที่ไหน
    await context.route(
      (url) => url.pathname.toLowerCase().startsWith('/api/') || classifyRequest(url) !== null,
      async (route) => {
        const url = new URL(route.request().url());
        seen.push(url.origin);
        if (classifyRequest(url) === 'foreign-api') foreign += 1;
        await route.abort('blockedbyclient');
      },
    );
    const page = await context.newPage();
    try {
      await page.goto(`${webUiEnv.webUrl}/`, { timeout: 120_000 });
    } catch (error) {
      throw new Error(
        `หยุดก่อนเริ่มเทส: เปิด ${webUiEnv.webUrl}/ ไม่ได้ ให้เปิดเว็บก่อนด้วย  cd apps/consumer-app && npm run web`,
        { cause: error },
      );
    }
    // หน้าแรกของผู้เยี่ยมชมแสดง footer ของหน้าผู้เยี่ยมชม (GuestPublicFooter.web.tsx:15) รอให้แอปโหลดเสร็จก่อนสรุป
    await page.getByTestId('guest.footer').waitFor({ timeout: 120_000 });
    // รอจนไม่มีคำขอค้างอย่างน้อย 0.5 วินาที (networkidle) ให้คำขอที่หน้าเรียกตอนเปิดออกครบ ถ้าไม่นิ่งใน 15 วินาทีให้สรุปจากที่เห็น
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => undefined);

    if (foreign > 0) {
      throw new Error(
        `หยุดก่อนล็อกอิน: หน้าแรกของเว็บเรียก API ที่ ${[...new Set(seen)].join(', ')} ไม่ใช่ ${webUiEnv.apiOrigin}\n` +
          'เว็บน่าจะชี้ไป API บนเครื่อง (EXPO_PUBLIC_API_URL ใน .env) ห้ามรันเทส UI แบบนี้ เพราะเว็บจะขอบทบาทให้บัญชี QA ในฐานข้อมูลของทีม\n' +
          'คำขอที่เห็นถูกตัดไว้แล้ว ไม่ถึง API',
      );
    }
    console.log(
      seen.length > 0
        ? `[เทส UI เว็บ] เว็บ ${webUiEnv.webUrl} เรียก API ที่ ${webUiEnv.apiOrigin} ตามที่กำหนด`
        : `[เทส UI เว็บ] หน้าแรกไม่เรียก API จึงยืนยันปลายทางจากหน้าแรกไม่ได้ ตัวกันใน guard.ts ยังตัดคำขอที่ไม่ได้ไป ${webUiEnv.apiOrigin} ในทุกข้อ`,
    );
  } finally {
    await browser.close();
  }

  const roles = Object.keys(PASSWORD_VARIABLES) as WebUiRole[];
  const missing = roles.filter((role) => passwordOf(role) === null).map((role) => PASSWORD_VARIABLES[role]);
  console.log(
    `[เทส UI เว็บ] ตั้งรหัสผ่านแล้ว ${roles.length - missing.length} จาก ${roles.length} บัญชี` +
      (missing.length ? ` (ไม่ได้ตั้ง ${missing.join(', ')}: เทสที่ใช้บัญชีนั้นจะข้าม)` : ''),
  );
}
