import { test, expect } from '../../src/web-ui/web-ui.fixture';
import { AgentShell } from '../../src/web-ui/pages/agent-shell.page';
import { AgentCalendarPage } from '../../src/web-ui/pages/agent-calendar.page';
import { webUiEnv } from '../../src/web-ui/web-ui-env';

/**
 * สิทธิ์เข้าหน้าบนเว็บ portal agent (agent.nestyk.com) ข้อ B4 ของ docs/qa-fixes/2026-11-09-qa-handoff-review-0a21689.md
 * โค้ด: apps/consumer-app/lib/route-access.ts (portalFrom, PORTAL_ROLES, landingRoleFor), app/no-access.tsx,
 *   lib/web-routes.web.ts ที่ pre/dev/review 163e354 (qa/e2e d68495f)
 * อ่านอย่างเดียว: ล็อกอินแล้วเปิดหน้า ไม่บันทึกอะไร (การล็อกอินเรียก POST /auth/sync แบบเดียวกับชุด web-ui ทุกข้อ)
 *
 * สิ่งที่ต้องมีก่อนรัน: เว็บ build ด้วย EXPO_PUBLIC_WEB_PORTAL=agent แล้ว serve ที่ 8090 และตั้ง E2E_WEB_PORTAL=agent
 *   E2E_CONSUMER_WEB_URL=http://localhost:8090 (README หัวข้อ "เทสบนเว็บ portal agent") ไม่ตั้ง = ทุกข้อข้าม
 * ข้อ P3 ล็อกอินด้วยบัญชีที่ไม่ใช่นายหน้า (qa-tenant) บน portal agent:
 *   กฎ 4 พ.ย. 2026 ห้ามเปิด /agent ด้วยบัญชีที่ไม่ใช่นายหน้าวันที่ใช้ API บนเครื่อง เพราะแอปอาจขอบทบาทให้ตัวเอง
 *   Aof อนุมัติข้อนี้ 9 พ.ย. 2026 เพราะในโหมด E2E_WEB_LOCAL_API=yes global-setup ยืนยันแล้วว่า API ปิดการขอบทบาท (403)
 *   และตัวกันชั้นที่ 1 (guard.ts) ตัด /auth/dev/roles ในเบราว์เซอร์เสมอ ข้อนี้ตรวจด้วยว่าไม่มีคำขอนั้นเกิดขึ้น
 */
// global-setup ตรวจแล้วว่าเว็บเป็น portal agent เมื่อตั้ง E2E_WEB_PORTAL=agent (assertWebPortal) ถ้าไม่ตั้ง ทั้งชุดข้าม
test.skip(webUiEnv.portal !== 'agent', 'ไม่ได้ตั้ง E2E_WEB_PORTAL=agent (ชุดนี้ใช้กับเว็บ build portal agent เท่านั้น)');

test('P1 a signed-in agent who opens /tenant, /admin or /login is sent to /agent', async ({ page, loginAs }) => {
  // ขั้นที่ 1: ล็อกอินเป็น agent portal agent พาไปหน้าแรกของบทบาท (portalHome = /agent)
  await loginAs('agent');
  await expect(page).toHaveURL((url) => url.pathname === '/agent');
  const shell = new AgentShell(page);
  await expect(shell.createMenu).toBeVisible();

  // ขั้นที่ 2: เปิดหน้าของบทบาทอื่นและหน้า login ตรง ๆ ทุกหน้าต้องพากลับ /agent (portal agent แสดงแค่บทบาท agent)
  for (const path of ['/tenant', '/admin', '/login']) {
    await page.goto(path);
    await expect(page, `${path} ต้องพาไป /agent`).toHaveURL((url) => url.pathname === '/agent', { timeout: 20_000 });
    await expect(shell.createMenu).toBeVisible();
  }
});

test('P2 a signed-out visitor opening /agent/calendar is asked to sign in and comes back to it', async ({ page, loginAs }) => {
  // ขั้นที่ 1: ยังไม่ล็อกอิน เปิด /agent/calendar ต้องไปหน้า login พร้อม next ของหน้าที่ขอ
  //   แอปอาจเติม ?date=<วันนี้> ให้ URL ของปฏิทินก่อนส่งไป login (app-routes.ts routeHref) จึงตรวจแค่ path และรูปแบบของ date
  await page.goto('/agent/calendar');
  await expect(page).toHaveURL(
    (url) => {
      const next = url.searchParams.get('next') ?? '';
      const [path, query = ''] = next.split('?');
      const date = new URLSearchParams(query).get('date');
      return url.pathname === '/login' && path === '/agent/calendar' && (date === null || /^\d{4}-\d{2}-\d{2}$/.test(date));
    },
    { timeout: 20_000 },
  );
  const next = new URL(page.url()).searchParams.get('next') as string;

  // ขั้นที่ 2: ล็อกอินด้วย next ที่แอปสร้างให้ (อ่านจาก URL ขั้นที่ 1) แล้วต้องกลับมาที่ปฏิทิน
  await loginAs('agent', { next });
  await expect(page).toHaveURL((url) => url.pathname === '/agent/calendar', { timeout: 20_000 });
  await expect(new AgentCalendarPage(page).dayList).toBeVisible();
});

test('P3 an account that has only the tenant role lands on /no-access', async ({ page, loginAs, guard }) => {
  // บัญชี qa-tenant ไม่มีบทบาท agent (qa-accounts.ts roles) landingRoleFor ของ portal agent จึงได้ null และแอปพาไป /no-access
  await loginAs('tenant');
  await expect(page).toHaveURL((url) => url.pathname === '/no-access', { timeout: 20_000 });
  await expect(new AgentShell(page).createMenu).toHaveCount(0);
  // ต้องไม่มีคำขอขอบทบาทเอง (ถ้ามี ตัวกันตัดไว้แล้ว แต่ข้อนี้ต้องแดงเพื่อให้เห็น)
  expect(guard.of('dev-role-grant'), 'แอปขอบทบาทให้บัญชีเองบน portal agent').toEqual([]);
});
