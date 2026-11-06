import type { Page, Request } from '@playwright/test';
import { test, expect } from '../../src/web-ui/web-ui.fixture';
import { AgentShell } from '../../src/web-ui/pages/agent-shell.page';
import { AdminHome, RawApiErrors } from '../../src/web-ui/pages/app.page';
import { EN } from '../../src/web-ui/labels';
import { storedRoles } from '../../src/web-ui/support/idle';
import { waitForStableValue, watchForRequest } from '../../src/web-ui/support/wait';

/**
 * บทบาทกับ URL ของเว็บ consumer-app (ผลเทสด้วยมือ 4 พ.ย. 2026 ข้อ 1, 2, 7, 8 ใน claude/nestyk-web-test-results-for-dev-2026-11-04.md)
 * โค้ดที่ qa/e2e 648dd28 (merge pre/dev/review 9821d87): บั๊กข้อ 2, 7, 8 ทีมแก้แล้ว ข้อ 1 ยังเป็น known-bug
 *
 * สิ่งที่ต้องมีก่อนรัน: เว็บเปิดด้วย npm run web และเรียก API ของ staging, ตั้ง E2E_QA_TENANT_PASSWORD กับ E2E_QA_AGENT_PASSWORD
 *   (ข้อ /admin ของบัญชี admin ใช้ E2E_QA_ADMIN_PASSWORD ถ้าไม่ตั้งจะข้าม) รายละเอียดใน README หัวข้อ "เทส UI เว็บ consumer-app"
 *   ค่าที่คาดของข้อ 2 ถือว่าเว็บไม่ได้ตั้ง EXPO_PUBLIC_WEB_PORTAL (ค่าเริ่มต้น all: lib/route-access.ts:38-42, lib/web-routes.web.ts:36)
 *   ถ้าตั้งเป็นบทบาทใดบทบาทหนึ่ง ผลของข้อเหล่านี้ไม่มีความหมาย: บัญชีที่ไม่มีบทบาทนั้นไปหน้า /no-access หลังล็อกอิน
 *   (ตัวช่วยล็อกอินไม่แดงเพราะรอแค่ให้ออกจาก /login) และถ้าตั้งเป็น tenant แถวของ tenant จะไป /tenant เพราะ portalHome (route-access.ts:141)
 *   ซึ่งเขียวด้วยเหตุผลคนละเรื่อง ให้ดูค่านี้ของเว็บก่อนรัน
 *
 * ทุกคำขอ POST /auth/dev/roles ถูกตัดในเบราว์เซอร์ (src/web-ui/guard.ts) จึงไม่มีบทบาทใดถูกบันทึกลงฐานข้อมูล
 * เทส known-bug ของข้อ 1 ตรวจแค่ว่าแอป "พยายาม" ส่งคำขอนี้หรือไม่
 *
 * ข้อมูลที่ชุดนี้เขียนลง staging: การล็อกอินทุกครั้งเรียก POST /auth/sync (AuthContext.tsx:74-78)
 * และการเปิดหน้านายหน้าด้วยบัญชีที่ไม่มีบทบาท agent เรียก /auth/sync อีกครั้ง (lib/agent-session.ts:63-64)
 * บัญชี qa-* มีอยู่แล้ว จึงเป็นการซิงก์บัญชีเดิม เหมือนตอนเทสด้วยมือ 4 พ.ย. 2026
 * ส่วนเส้นทางบิลที่สร้างบิลถูกตัดไว้ (guard.ts) รวมถึงหน้าแรกของ tenant ที่เป็นปลายทางของการพาไปหน้าแรก
 *   (การ์ดบิลถัดไปเรียก POST /bills/mine/refresh และ GET /bills/mine/next: lib/tenant-bills-api.ts:27-30)
 *
 * ข้อ known-bug เรียก test.fail ก่อนการตรวจข้อที่เป็นตัวบั๊กเท่านั้น ความผิดพลาดของขั้นเตรียม (ล็อกอิน หาชิ้นส่วน) จึงแดงตามปกติ
 * ขั้นเตรียมของทุกข้อตรวจบทบาทจริงของบัญชีก่อน (expectLacksRole) ถ้าวันหนึ่งบัญชี QA ได้บทบาทเพิ่ม ข้อนั้นจะแดงที่ขั้นเตรียม
 * แทนที่จะถูกนับว่าระบบทำถูกหรือผิดทั้งที่บัญชีไม่ตรงกับที่เทสสมมติ (ข้อสังเกตของ test-reviewer รอบ 2)
 */

/** บัญชีที่ล็อกอินอยู่ต้องไม่มีบทบาทนี้ (บทบาทตาม migration: src/config/qa-accounts.ts ROLES_OF) */
async function expectLacksRole(page: Page, role: string): Promise<void> {
  const roles = await storedRoles(page);
  expect(roles.length, 'อ่านบทบาทของบัญชีจาก nestyk.auth.session.v1 ไม่ได้').toBeGreaterThan(0);
  expect(roles, `บัญชีนี้มีบทบาท ${role} แล้ว ข้อนี้ใช้ไม่ได้ ให้แจ้งทีมหรือเปลี่ยนบัญชี`).not.toContain(role);
}

/** คำขอขอบทบาท agent (lib/agent-session.ts:76 ส่ง { role: 'agent' }) */
function isAgentGrant(request: Request): boolean {
  return request.url().includes('/auth/dev/roles') && (request.postData() ?? '').includes('"agent"');
}

/** เวลาที่เฝ้าคำขอขอบทบาทหลังโครงหน้าแสดง ผลเทสด้วยมือ: คำขอเกิดภายในไม่กี่วินาทีหลังหน้าแสดง */
const GRANT_WATCH_MS = 10_000;

/**
 * รอจนหน้าอยู่ที่ path นี้และไม่เปลี่ยนต่ออีก (หน้าอาจแสดงหน้าของบทบาทใน URL ชั่วครู่ก่อนรู้บทบาทของบัญชี
 * แล้วจึงถูกพาไปด้วย router.replace: app/index.tsx:672-685)
 */
async function expectSettledPath(page: Page, pathname: string): Promise<void> {
  await expect(page).toHaveURL((url) => url.pathname === pathname, { timeout: 30_000 });
  const settled = await waitForStableValue(async () => new URL(page.url()).pathname);
  expect(settled, 'หน้าถูกพาไปที่อื่นต่อหลังถึงหน้าแรกของบทบาท').toBe(pathname);
}

test.describe('roles requested by the web app itself', () => {
  test(
    'opening /agent/rooms as a tenant does not ask the API for the agent role',
    { tag: '@known-bug' },
    async ({ page, loginAs, guard }) => {
      // ขั้นที่ 1: ล็อกอินเป็น tenant บัญชีต้องยังไม่มีบทบาท agent (ensureAgentSession ขอเฉพาะเมื่อยังไม่มี: agent-session.ts:63-76)
      await loginAs('tenant');
      await expectLacksRole(page, 'agent');
      // ขั้นที่ 2: เปิดหน้าห้องของนายหน้า รอให้โครงหน้าเดสก์ท็อปแสดง (หน้าห้องที่ขึ้นชั่วครู่ หรือ /tenant หลังถูกพาไป) แล้วเฝ้าคำขอขอบทบาทต่ออีกช่วงหนึ่ง
      // หน้าห้องเรียก ensureAgentSession ตอนเปิด ก่อนแอปรู้บทบาทของบัญชี (คอมเมนต์ lib/agent-session.ts:35-37) จึงยังส่งคำขอได้แม้หน้าจะถูกพาไปแล้ว
      // นับทั้งคำขอที่ตัวกันตัดไปแล้วก่อนเริ่มเฝ้า และคำขอที่เห็นระหว่างเฝ้า
      await page.goto('/agent/rooms');
      await expect(new AgentShell(page).workspaceSwitch).toBeVisible();
      const grantSeen = guard.roleGrants('agent').length > 0 || (await watchForRequest(page, isAgentGrant, GRANT_WATCH_MS));
      // ขั้นที่ 3: แอปต้องไม่ขอบทบาท
      // ที่ 648dd28 แอปขอเฉพาะ dev build ที่ตั้ง EXPO_PUBLIC_ALLOW_DEV_ROLE_GRANT=true (agent-session.ts:72-76)
      // ผลรัน 6 พ.ย. 2026 ยังเห็นคำขอ ถ้าข้อนี้แดงว่า "Expected to fail, but passed" ให้ดูค่านี้ของเว็บที่ใช้รันก่อนเอา test.fail ออก
      test.fail(true, 'บั๊กข้อ 1: ensureAgentSession (lib/agent-session.ts:72-76) ขอบทบาท agent เมื่อบัญชียังไม่มี ใน dev build ที่เปิดสวิตช์');
      expect(grantSeen, 'เห็นคำขอ POST /auth/dev/roles {role:"agent"} (ถูกตัดแล้ว)').toBe(false);
    },
  );

  test(
    'signing in as an agent does not ask the API for the admin role',
    { tag: '@known-bug' },
    async ({ page, loginAs, guard }) => {
      // ขั้นที่ 1: ล็อกอินเป็น agent ensureAdminRole ทำงานก่อนเว็บพาออกจากหน้า login (AuthContext.tsx:236 รอผลก่อน applySession)
      // ตอนตัวช่วยล็อกอินจบ คำขอ (ถ้ามี) จึงถูกส่งไปแล้ว ไม่ต้องรอเพิ่ม บัญชีต้องยังไม่มีบทบาท admin (ensureAdminRole ไม่ขอถ้ามีแล้ว :82)
      await loginAs('agent');
      await expectLacksRole(page, 'admin');
      // ขั้นที่ 2: แอปต้องไม่ขอบทบาท admin
      // ที่ 648dd28 ensureAdminRole ขอเฉพาะ dev build ที่ตั้ง EXPO_PUBLIC_ALLOW_DEV_ROLE_GRANT=true (AuthContext.tsx:81-91 เดิมขอเว้นแต่ตั้ง false)
      // ผลรัน 6 พ.ย. 2026 ยังเห็นคำขอ ถ้าข้อนี้แดงว่า "Expected to fail, but passed" ให้ดูค่านี้ของเว็บที่ใช้รันก่อนเอา test.fail ออก
      test.fail(true, 'บั๊กข้อ 1: ensureAdminRole (lib/auth/AuthContext.tsx:81-91) ขอบทบาท admin ทุกครั้งที่ล็อกอิน ใน dev build ที่เปิดสวิตช์');
      expect(guard.roleGrants('admin'), 'คำขอ POST /auth/dev/roles {role:"admin"} ที่ถูกตัด').toEqual([]);
    },
  );
});

test.describe('pages of a role the account does not have', () => {
  // บั๊กข้อ 2 แก้แล้วที่ 648dd28: บัญชีที่ล็อกอินแล้วเปิดหน้าของบทบาทที่ไม่มี ถูกพาไปหน้าแรกของบทบาทตัวเองเงียบ ๆ
  //   ไม่มีข้อความแจ้ง ไม่มีหน้า 403 (app/index.tsx:665-667) และใช้ replace จึงกดย้อนกลับไม่กลับไปหน้าที่ถูกปฏิเสธ
  // ตัวตัดสิน: lib/route-access.ts decideRoleAccess (:137-146) เรียกผ่าน roleRedirect (lib/web-routes.web.ts:191-198)
  //   หน้าแรกเลือกจากบทบาทที่จำไว้ถ้าบัญชีมี ไม่งั้นเรียง agent, landlord, tenant (landingFor :56-68) admin ไม่ถูกเลือกเอง
  //   บัญชี QA tenant มีแค่ tenant (+guest) จึงไป /tenant ส่วนบัญชี QA agent ไป /agent
  // หน้า /no-access (app/no-access.tsx) ใช้เฉพาะเว็บที่ตั้ง EXPO_PUBLIC_WEB_PORTAL เป็นบทบาท ชุดนี้ไม่ได้ตั้ง จึงไม่ได้ตรวจ
  const rows = [
    { account: 'tenant', path: '/agent/rooms', lacks: 'agent', home: '/tenant', homeRole: EN.roleTenant },
    { account: 'tenant', path: '/agent/leads', lacks: 'agent', home: '/tenant', homeRole: EN.roleTenant },
    { account: 'tenant', path: '/landlord/income', lacks: 'landlord', home: '/tenant', homeRole: EN.roleTenant },
    // /owner/... ถูกส่งต่อไป /landlord/... ก่อน (lib/app-routes.ts:55, components/web-routes/WebAppHost.web.tsx:14) แล้วจึงตรวจบทบาท
    { account: 'tenant', path: '/owner/contracts', lacks: 'landlord', home: '/tenant', homeRole: EN.roleTenant },
    // query ?history=1 ไม่ตามไป (replace ไปที่หน้าแรกเปล่า: web-routes.web.ts:195) เทสตรวจแค่ pathname
    { account: 'agent', path: '/tenant/bills?history=1', lacks: 'tenant', home: '/agent', homeRole: EN.roleAgent },
  ] as const;

  for (const row of rows) {
    test(`${row.account} opening ${row.path} is sent to its own home ${row.home}`, async ({ page, loginAs }) => {
      // ขั้นที่ 1: ล็อกอิน (บัญชีต้องไม่มีบทบาทของหน้านั้น) แล้วพิมพ์ URL ของบทบาทที่บัญชีไม่มี
      await loginAs(row.account);
      await expectLacksRole(page, row.lacks);
      await page.goto(row.path);
      // ขั้นที่ 2: ต้องจบที่หน้าแรกของบทบาทตัวเอง และ workspace เป็นของบทบาทตัวเอง
      await expectSettledPath(page, row.home);
      await expect(new AgentShell(page).workspaceRole).toHaveText(row.homeRole);
    });
  }

  // ข้อนี้ตรวจหน้าหลังนิ่งแล้วเท่านั้น หน้าแอดมินอาจขึ้นชั่วครู่ก่อนถูกพาไป (อนุมาน: index.tsx:668, route-access.ts:142) ซึ่งเทสนี้ไม่จับ
  test('tenant opening /admin is sent to its own home with no admin card left on the page', async ({ page, loginAs }) => {
    // ขั้นที่ 1: ล็อกอินเป็น tenant (ต้องไม่มีบทบาท admin) แล้วเปิด /admin
    await loginAs('tenant');
    await expectLacksRole(page, 'admin');
    await page.goto('/admin');
    // ขั้นที่ 2: ต้องจบที่ /tenant ในโครงหน้าของ tenant (admin ไม่มีโครงหน้าเดสก์ท็อป: index.tsx:757-760)
    await expectSettledPath(page, '/tenant');
    await expect(new AgentShell(page).workspaceRole).toHaveText(EN.roleTenant);
    // ขั้นที่ 3: ไม่มีการ์ดหน้าแรกของแอดมินบนหน้า
    await expect(new AdminHome(page).title).toHaveCount(0);
  });

  test('signing in with next= pointing at a role the account lacks lands on its own home', async ({ page, loginAs }) => {
    // ผลเทสข้อ 2 "ส่วนที่ทำงานถูก": postLoginPath ใช้ next เฉพาะบทบาทที่บัญชีมี (lib/app-routes.ts:116 ที่ 648dd28)
    // เบราว์เซอร์ใหม่ไม่มีบทบาทที่จำไว้ จึงไปหน้าแรกของ agent (LANDING_ORDER :31)
    await loginAs('agent', { next: '/tenant/bills' });
    await expectLacksRole(page, 'tenant');
    await expect(page).toHaveURL((url) => url.pathname === '/agent');
    await expect(new AgentShell(page).workspaceRole).toHaveText(EN.roleAgent);
  });
});

test.describe('messages and sample numbers', () => {
  test('a tenant opening /landlord/income is sent to /tenant with no raw API error left on the page', async ({ page, loginAs, guard }) => {
    // บั๊กข้อ 7 แก้แล้วที่ 648dd28 ใน 2 ชั้น
    //   (1) tenant ไม่เห็นหน้ารายได้ของผู้ให้เช่าอีก: ถูกพาไปหน้าแรกของตัวเอง (บั๊กข้อ 2)
    //   (2) 403 ที่เป็นภาษาอังกฤษ เช่น "Required role: landlord" ถูกนับเป็นข้อความสำหรับนักพัฒนา แสดงข้อความสำรองแทน
    //       (packages/i18n/src/error-message.ts:29-34, 40-44) ชั้นนี้ชุดนี้ตรวจผ่านหน้าจริงไม่ได้ เพราะ tenant ไปไม่ถึงหน้านั้นแล้ว
    // ข้อนี้ตรวจหน้าหลังนิ่งแล้วเท่านั้น ถ้าข้อความดิบขึ้นชั่วครู่บนหน้ารายได้ก่อนถูกพาไป เทสนี้ไม่จับ
    // ขั้นที่ 1: ล็อกอินเป็น tenant ที่ไม่มีบทบาท landlord
    // ให้ GET /bills/received ผ่านหลังตรวจบทบาทแล้วเท่านั้น (RolesGuard ตอบ 403 ก่อนถึงขั้นสร้างบิล: guard.ts method อื่นยังถูกตัด)
    // เหตุผลที่เปิดให้ผ่าน: ขั้นที่ 4 ตรวจว่า API ปฏิเสธ tenant จริงทุกครั้งที่หน้ารายได้ส่งคำขอออกไปก่อนถูกพา
    await loginAs('tenant');
    await expectLacksRole(page, 'landlord');
    guard.allowOwnerBills();
    // จดคำขอ GET /bills/received ทุกครั้ง และผลของแต่ละคำขอ 1 ผลต่อ 1 คำขอ: เลขสถานะ หรือ 'failed' ถ้าไม่มีคำตอบครบ
    // (คำขอเดียวอาจได้หัวคำตอบแล้วล้มตอนโหลดเนื้อ จึงจดผลตอน requestfinished และไม่ทับผลที่จดแล้ว: test-reviewer รอบ 2)
    // POST .../refresh ถูกตัดเป็น bill-write ไม่ถูกนับ เพราะ path ไม่ตรง เทียบ path แบบตัวพิมพ์เล็กเหมือนตัวกัน (guard.ts:78)
    const isOwnerBills = (request: Request) =>
      request.method() === 'GET' && /\/bills\/received\/?$/.test(new URL(request.url()).pathname.toLowerCase());
    const sent = new Set<Request>();
    const outcome = new Map<Request, number | 'failed'>();
    page.on('request', (request) => {
      if (isOwnerBills(request)) sent.add(request);
    });
    page.on('requestfinished', (request) => {
      if (!isOwnerBills(request)) return;
      void request.response().then(
        (response) => outcome.set(request, response?.status() ?? 'failed'),
        () => outcome.set(request, 'failed'),
      );
    });
    page.on('requestfailed', (request) => {
      if (isOwnerBills(request) && !outcome.has(request)) outcome.set(request, 'failed');
    });
    await page.goto('/landlord/income');
    // ขั้นที่ 2: ต้องจบที่หน้าแรกของ tenant
    await expectSettledPath(page, '/tenant');
    await expect(new AgentShell(page).workspaceRole).toHaveText(EN.roleTenant);
    // ขั้นที่ 3: ไม่มีข้อความดิบจาก API เหลือบนหน้า
    await expect(new RawApiErrors(page).requiredRoleLandlord).toHaveCount(0);
    // ขั้นที่ 4: รอจนทุกคำขอที่ส่งออกไปได้ผล แล้วทุกคำตอบต้องเป็น 403 (ถ้าได้ 200 แปลว่า tenant อ่านรายได้ของผู้ให้เช่าได้)
    // ถ้าไม่มีคำขอเลย ขั้นนี้ไม่ได้ตรวจอะไร จำนวนคำขอจดไว้ในผลรัน (annotation) เพื่อแจ้งทีมว่าหน้าของบทบาทอื่นยังเรียก API ก่อนถูกพาไปหรือไม่
    await expect.poll(() => outcome.size, { timeout: 15_000, message: 'คำขอ GET /bills/received ที่ยังไม่ได้ผล' }).toBe(sent.size);
    const results = [...outcome.values()];
    test.info().annotations.push({ type: 'GET /bills/received ก่อนถูกพาไป', description: `ส่ง ${sent.size} ครั้ง ผล ${JSON.stringify(results)}` });
    expect(results.filter((result) => result !== 403 && result !== 'failed'), 'คำตอบของ GET /bills/received ที่ไม่ใช่ 403').toEqual([]);
  });

  test('the admin page shows the i18n title and no made-up numbers', async ({ page, loginAs }) => {
    // บั๊กข้อ 8 แก้แล้วที่ 648dd28: การ์ดของแอดมินใช้ข้อความจาก i18n และไม่มีตัวเลขสมมติ (app/index.tsx:1134-1166)
    // ขั้นที่ 1: ล็อกอินเป็น admin แล้วเปิด /admin
    await loginAs('admin');
    await page.goto('/admin');
    await expect(page).toHaveURL((url) => url.pathname === '/admin');
    // ขั้นที่ 2: เห็นการ์ดที่มีหัวข้อ "Admin home" และข้อความ "Coming soon" ในการ์ดเดียวกัน (mobile.roleHome.adminTitle, comingSoon)
    const admin = new AdminHome(page);
    await expect(admin.title).toBeVisible();
    await expect(admin.card).toBeVisible();
    // ขั้นที่ 3: ในการ์ดไม่มีตัวเลขเลย (ชื่อบทบาท "Admin Nestyk" ก็ไม่มีตัวเลข) และหัวข้อกับตัวเลขที่เคยเขียนไว้ในโค้ดไม่อยู่บนหน้า
    await expect(admin.card).not.toContainText(/\d/);
    await expect(admin.retiredText).toHaveCount(0);
  });
});
