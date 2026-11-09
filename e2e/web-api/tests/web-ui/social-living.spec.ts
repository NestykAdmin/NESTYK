import { test, expect } from '../../src/web-ui/web-ui.fixture';
import type { Page } from '@playwright/test';
import { LoginPage } from '../../src/web-ui/pages/login.page';
import { RegisterPage } from '../../src/web-ui/pages/register.page';
import { AgentShell } from '../../src/web-ui/pages/agent-shell.page';
import { AGENT_WEB } from '../../src/web-ui/labels.agent-web';

/**
 * ปุ่ม social ที่ยังไม่เปิด และเมนู Living ของผู้เช่าที่ปิดไว้ (แผน 9 พ.ย. 2026 ข้อ S1-S3) อ่านอย่างเดียว
 * โค้ด: apps/consumer-app/app/login.tsx:386-443, app/register.tsx:262-304, lib/auth/google-oauth.ts:8-11,
 *   components/tenant-web/navigation.ts:26, app/index.tsx:1731-1748, components/agent-web/AgentWorkspace.web.tsx:332-351
 *   ที่ pre/dev/review 7a9bf48 (qa/e2e 4633c54)
 *
 * สิ่งที่ต้องมีก่อนรัน: เหมือนชุด tests/web-ui ข้อ S3 ต้องตั้ง E2E_QA_TENANT_PASSWORD
 * ปุ่ม social "พร้อม" เมื่อเว็บ build ด้วย EXPO_PUBLIC_ENABLE_SOCIAL_LOGIN=true และเป็น Google หรือ Facebook (google-oauth.ts:8-11)
 *   Apple ยังไม่พร้อมเสมอ ปุ่มที่ไม่พร้อมจางลง มีข้อความ Coming soon และกดแล้วขึ้นคำอธิบายแทนการเปิด OAuth (ปุ่มไม่ถูก disable)
 *   ข้อนี้กดเฉพาะปุ่มที่ขึ้น Coming soon ถ้าเว็บเปิด Google/Facebook ไว้ ปุ่มนั้นข้าม (กดแล้วจะออกไปหน้า Google จริง)
 */

/** เฝ้าคำขอที่จะเริ่ม OAuth (Supabase /auth/v1/authorize หรือโดเมนของผู้ให้บริการ) ตลอดข้อ */
function watchOAuth(page: Page): string[] {
  const seen: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname.includes('/auth/v1/authorize') || /(^|\.)(google|facebook|apple)\.com$/.test(url.hostname)) seen.push(`${url.origin}${url.pathname}`);
  });
  return seen;
}

test('S1 on /login, social buttons marked Coming soon explain themselves and start no sign-in', async ({ page }) => {
  const oauth = watchOAuth(page);
  const login = new LoginPage(page);

  const tapped: string[] = [];
  for (const provider of ['Google', 'Facebook', 'Apple'] as const) {
    // เปิด /login ใหม่ทุกปุ่ม: ข้อความอธิบายไม่ถูกล้างจนกว่าจะเริ่ม OAuth (setNotice: login.tsx:408, ล้างที่ :413)
    //   ถ้าไม่เปิดใหม่ ข้อความจากปุ่มก่อนหน้าจะค้าง แล้วการตรวจของปุ่มถัดไปผ่านโดยไม่ได้ตรวจอะไร
    await login.goto();
    await expect(login.submit).toBeVisible();
    await expect(login.socialButton(provider)).toBeVisible();
    if ((await login.socialComingSoon(provider).count()) === 0) {
      expect(provider, 'Apple ต้องเป็น Coming soon เสมอ (google-oauth.ts:10 คืน null)').not.toBe('Apple');
      // ไม่ยืนยันค่า EXPO_PUBLIC_ENABLE_SOCIAL_LOGIN ของเว็บได้จากเทส จึงจดเฉพาะสิ่งที่เห็น และไม่กด (กดแล้วอาจออกไปหน้าผู้ให้บริการจริง)
      test.info().annotations.push({ type: 'ข้าม', description: `${provider}: ไม่พบป้าย Coming soon ใต้ปุ่ม จึงไม่กด` });
      continue;
    }
    await expect(login.socialComingSoon(provider)).toBeVisible();
    await expect(login.socialUnavailable).toHaveCount(0);
    // กดแล้วขึ้น mobile.auth.unavailable (:405-409, :448-461) และยังอยู่ที่ /login
    await login.socialButton(provider).click();
    await expect(login.socialUnavailable).toBeVisible();
    await expect(page).toHaveURL((url) => url.pathname === '/login');
    tapped.push(provider);
  }
  test.info().annotations.push({ type: 'ปุ่มที่กด', description: tapped.join(', ') });
  expect(tapped, 'อย่างน้อยต้องกด Apple').toContain('Apple');
  expect(oauth, 'ไม่มีคำขอเริ่ม OAuth').toEqual([]);
});

test('S2 on /register, Sign up with Apple is Coming soon and explains itself', async ({ page }) => {
  const oauth = watchOAuth(page);
  const register = new RegisterPage(page);
  await register.goto();
  // Apple มี start: null จึงไม่พร้อมเสมอ (register.tsx:265, :269) ป้าย Coming soon อยู่ในปุ่ม (:301)
  await expect(register.appleButton).toBeVisible();
  await expect(register.appleButton).toContainText(AGENT_WEB.socialComingSoon);
  await expect(register.socialUnavailable).toHaveCount(0);
  await register.appleButton.click();
  await expect(register.socialUnavailable).toBeVisible();
  await expect(page).toHaveURL((url) => url.pathname === '/register');
  expect(oauth, 'ไม่มีคำขอเริ่ม OAuth').toEqual([]);
});

test('S3 the tenant side menu shows Living as Coming soon and it does nothing', async ({ page, loginAs }) => {
  await loginAs('tenant', { next: '/tenant' });
  await expect(page).toHaveURL((url) => url.pathname === '/tenant');

  // เมนู living เป็น { type: "soon" } (tenant-web/navigation.ts:26) วาดเป็น <button disabled title="Living · Coming soon"> (index.tsx:1741-1744, AgentWorkspace.web.tsx:332-351)
  //   หาจากรายการเมนูที่ยังไม่เปิดใช้ของ AgentShell (title ลงท้าย "· Coming soon") แล้วกรองด้วยชื่อ Living
  //   ไม่ต้องลองกด: <button disabled> ของ HTML เบราว์เซอร์ไม่ส่ง click ให้อยู่แล้ว toBeDisabled ตรวจตรงนี้พอ
  const living = new AgentShell(page).comingSoonItems.filter({ hasText: AGENT_WEB.living });
  await expect(living).toHaveCount(1);
  await expect(living).toHaveAttribute('title', `${AGENT_WEB.living} · ${AGENT_WEB.comingSoon}`);
  await expect(living).toBeDisabled();
  await expect(living).toContainText(AGENT_WEB.comingSoon);
});
