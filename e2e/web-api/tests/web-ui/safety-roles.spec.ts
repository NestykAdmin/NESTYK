import type { Page, Request } from '@playwright/test';
import { test, expect } from '../../src/web-ui/web-ui.fixture';
import { AgentShell } from '../../src/web-ui/pages/agent-shell.page';
import { AdminHome, BillsScreen } from '../../src/web-ui/pages/app.page';
import { EN, RAW_ERRORS } from '../../src/web-ui/labels';
import { storedRoles } from '../../src/web-ui/support/idle';
import { waitForStableValue, watchForRequest } from '../../src/web-ui/support/wait';

/**
 * บทบาทกับ URL ของเว็บ consumer-app (ผลเทสด้วยมือ 4 พ.ย. 2026 ข้อ 1, 2, 7, 8 ใน claude/nestyk-web-test-results-for-dev-2026-11-04.md)
 *
 * สิ่งที่ต้องมีก่อนรัน: เว็บเปิดด้วย npm run web และเรียก API ของ staging, ตั้ง E2E_QA_TENANT_PASSWORD กับ E2E_QA_AGENT_PASSWORD
 *   (ข้อ /admin ใช้ E2E_QA_ADMIN_PASSWORD ถ้าไม่ตั้งจะข้าม) รายละเอียดใน README หัวข้อ "เทส UI เว็บ consumer-app"
 *
 * ทุกคำขอ POST /auth/dev/roles ถูกตัดในเบราว์เซอร์ (src/web-ui/guard.ts) จึงไม่มีบทบาทใดถูกบันทึกลงฐานข้อมูล
 * เทส known-bug ของข้อ 1 ตรวจแค่ว่าแอป "พยายาม" ส่งคำขอนี้หรือไม่
 *
 * ข้อมูลที่ชุดนี้เขียนลง staging: การล็อกอินทุกครั้งเรียก POST /auth/sync (AuthContext.tsx:72-74, 219-225)
 * และการเปิดหน้านายหน้าด้วยบัญชีที่ไม่มีบทบาท agent เรียก /auth/sync อีกครั้ง (lib/agent-session.ts:12)
 * บัญชี qa-* มีอยู่แล้ว จึงเป็นการซิงก์บัญชีเดิม เหมือนตอนเทสด้วยมือ 4 พ.ย. 2026 ส่วนเส้นทางบิลที่สร้างบิลถูกตัดไว้ (guard.ts)
 *
 * ทุกข้อ known-bug เรียก test.fail ก่อนการตรวจข้อที่เป็นตัวบั๊กเท่านั้น ความผิดพลาดของขั้นเตรียม (ล็อกอิน หาชิ้นส่วน) จึงแดงตามปกติ
 * ขั้นเตรียมของทุกข้อตรวจบทบาทจริงของบัญชีก่อน (expectLacksRole) ถ้าวันหนึ่งบัญชี QA ได้บทบาทเพิ่ม ข้อนั้นจะแดงที่ขั้นเตรียม
 * แทนที่จะถูกนับว่าเป็นบั๊กที่รู้แล้วทั้งที่ระบบทำถูก (ข้อสังเกตของ test-reviewer รอบ 2)
 */

/** บัญชีที่ล็อกอินอยู่ต้องไม่มีบทบาทนี้ (บทบาทตาม migration: src/config/qa-accounts.ts ROLES_OF) */
async function expectLacksRole(page: Page, role: string): Promise<void> {
  const roles = await storedRoles(page);
  expect(roles.length, 'อ่านบทบาทของบัญชีจาก nestyk.auth.session.v1 ไม่ได้').toBeGreaterThan(0);
  expect(roles, `บัญชีนี้มีบทบาท ${role} แล้ว ข้อนี้ใช้ไม่ได้ ให้แจ้งทีมหรือเปลี่ยนบัญชี`).not.toContain(role);
}

/** คำขอขอบทบาท agent (lib/agent-session.ts:16 ส่ง { role: 'agent' }) */
function isAgentGrant(request: Request): boolean {
  return request.url().includes('/auth/dev/roles') && (request.postData() ?? '').includes('"agent"');
}

/** เวลาที่เฝ้าคำขอขอบทบาทหลังโครงหน้าแสดง ผลเทสด้วยมือ: คำขอเกิดภายในไม่กี่วินาทีหลังหน้าแสดง */
const GRANT_WATCH_MS = 10_000;

test.describe('roles requested by the web app itself', () => {
  test(
    'opening /agent/rooms as a tenant does not ask the API for the agent role',
    { tag: '@known-bug' },
    async ({ page, loginAs, guard }) => {
      // ขั้นที่ 1: ล็อกอินเป็น tenant บัญชีต้องยังไม่มีบทบาท agent (ensureAgentSession ขอเฉพาะเมื่อยังไม่มี: agent-session.ts:13-16)
      await loginAs('tenant');
      await expectLacksRole(page, 'agent');
      // ขั้นที่ 2: เปิดหน้าห้องของนายหน้า รอให้โครงหน้าแสดง แล้วเฝ้าคำขอขอบทบาทต่ออีกช่วงหนึ่ง
      // นับทั้งคำขอที่ตัวกันตัดไปแล้วก่อนเริ่มเฝ้า และคำขอที่เห็นระหว่างเฝ้า
      await page.goto('/agent/rooms');
      await expect(new AgentShell(page).workspaceSwitch).toBeVisible();
      const grantSeen = guard.roleGrants('agent').length > 0 || (await watchForRequest(page, isAgentGrant, GRANT_WATCH_MS));
      // ขั้นที่ 3: แอปต้องไม่ขอบทบาท
      test.fail(true, 'บั๊กข้อ 1: ensureAgentSession (lib/agent-session.ts:16) ขอบทบาท agent เมื่อบัญชียังไม่มี');
      expect(grantSeen, 'เห็นคำขอ POST /auth/dev/roles {role:"agent"} (ถูกตัดแล้ว)').toBe(false);
    },
  );

  test(
    'signing in as an agent does not ask the API for the admin role',
    { tag: '@known-bug' },
    async ({ page, loginAs, guard }) => {
      // ขั้นที่ 1: ล็อกอินเป็น agent ensureAdminRole ทำงานก่อนเว็บพาออกจากหน้า login (AuthContext.tsx:219-225 รอผลก่อน applySession)
      // ตอนตัวช่วยล็อกอินจบ คำขอ (ถ้ามี) จึงถูกส่งไปแล้ว ไม่ต้องรอเพิ่ม บัญชีต้องยังไม่มีบทบาท admin (ensureAdminRole ไม่ขอถ้ามีแล้ว :77)
      await loginAs('agent');
      await expectLacksRole(page, 'admin');
      // ขั้นที่ 2: แอปต้องไม่ขอบทบาท admin
      // ensureAdminRole ไม่ขอเมื่อ build ตั้ง EXPO_PUBLIC_ALLOW_DEV_ROLE_GRANT=false (AuthContext.tsx:76-85)
      // ถ้า .env ของเว็บตั้งค่านี้ ข้อนี้จะแดงว่า "Expected to fail, but passed" ซึ่งไม่ได้แปลว่าทีมแก้บั๊กแล้ว ให้ดูโค้ดก่อนเอา test.fail ออก
      test.fail(true, 'บั๊กข้อ 1: ensureAdminRole (lib/auth/AuthContext.tsx:76-85) ขอบทบาท admin ทุกครั้งที่ล็อกอิน');
      expect(guard.roleGrants('admin'), 'คำขอ POST /auth/dev/roles {role:"admin"} ที่ถูกตัด').toEqual([]);
    },
  );
});

test.describe('pages of a role the account does not have', () => {
  // ผลที่ควรเป็น (ผลเทสข้อ 2): ไม่แสดงหน้าของบทบาทนั้น จะพาไปหน้าแรกของบทบาทตัวเองหรือแจ้งว่าไม่มีสิทธิ์ก็ได้
  // เทสจึงตรวจแค่ว่าไม่เห็น workspace ของบทบาทนั้น ไม่ผูกกับ URL ปลายทาง
  // ต้นเหตุ: index.tsx:668 (applyRoute ตั้งบทบาทตาม URL) และ :622-644 (ตรวจแค่ว่าล็อกอินแล้ว)
  const rows = [
    { account: 'tenant', path: '/agent/rooms', role: 'agent', notRole: EN.roleAgent },
    { account: 'tenant', path: '/agent/leads', role: 'agent', notRole: EN.roleAgent },
    { account: 'tenant', path: '/landlord/income', role: 'landlord', notRole: EN.roleLandlord },
    // /owner/... ถูกส่งต่อไป /landlord/... (lib/app-routes.ts:52) โดยไม่ตรวจบทบาท
    { account: 'tenant', path: '/owner/contracts', role: 'landlord', notRole: EN.roleLandlord },
    { account: 'agent', path: '/tenant/bills?history=1', role: 'tenant', notRole: EN.roleTenant },
  ] as const;

  for (const row of rows) {
    test(
      `${row.account} opening ${row.path} does not get the ${row.notRole} workspace`,
      { tag: '@known-bug' },
      async ({ page, loginAs }) => {
        // ขั้นที่ 1: ล็อกอิน (บัญชีต้องไม่มีบทบาทของหน้านั้น) แล้วพิมพ์ URL ของบทบาทที่บัญชีไม่มี
        await loginAs(row.account);
        await expectLacksRole(page, row.role);
        await page.goto(row.path);
        const shell = new AgentShell(page);
        await expect(shell.workspaceRole).toBeVisible();
        // ขั้นที่ 2: รอให้ชื่อ workspace นิ่ง (หน้าอาจแสดง workspace ของบทบาทที่จำไว้ก่อนเปลี่ยนตาม URL)
        const role = await waitForStableValue(() => shell.workspaceRole.innerText());
        // ขั้นที่ 3: ต้องไม่ใช่ workspace ของบทบาทนั้น
        test.fail(true, 'บั๊กข้อ 2: หน้าเว็บไม่ตรวจบทบาทตาม URL');
        expect(role.trim()).not.toBe(row.notRole);
      },
    );
  }

  test('tenant opening /admin does not get the admin dashboard', { tag: '@known-bug' }, async ({ page, loginAs }) => {
    // ขั้นที่ 1: ล็อกอินเป็น tenant (ต้องไม่มีบทบาท admin) แล้วเปิด /admin
    await loginAs('tenant');
    await expectLacksRole(page, 'admin');
    await page.goto('/admin');
    // ขั้นที่ 2: รอให้หน้าแสดงอย่างใดอย่างหนึ่ง: หน้าแอดมิน (ตอนนี้) หรือ workspace ของบทบาทตัวเอง (เมื่อแก้แล้ว)
    // admin ไม่มีโครงหน้าเดสก์ท็อป (index.tsx:709-713) หน้าแอดมินมีหัวข้อที่เขียนไว้ในโค้ด (index.tsx:1092)
    const adminTitle = new AdminHome(page).title;
    await expect(new AgentShell(page).workspaceSwitch.or(adminTitle).first()).toBeVisible();
    const adminTitles = await waitForStableValue(async () => String(await adminTitle.count()));
    // ขั้นที่ 3: ต้องไม่เห็นหน้าแอดมิน
    test.fail(true, 'บั๊กข้อ 2: หน้าเว็บไม่ตรวจบทบาทตาม URL');
    expect(adminTitles).toBe('0');
  });

  test('signing in with next= pointing at a role the account lacks lands on its own home', async ({ page, loginAs }) => {
    // ผลเทสข้อ 2 "ส่วนที่ทำงานถูก": postLoginPath ใช้ next เฉพาะบทบาทที่บัญชีมี (lib/app-routes.ts:94-102)
    // เบราว์เซอร์ใหม่ไม่มีบทบาทที่จำไว้ จึงไปหน้าแรกของ agent (LANDING_ORDER :28)
    await loginAs('agent', { next: '/tenant/bills' });
    await expectLacksRole(page, 'tenant');
    await expect(page).toHaveURL((url) => url.pathname === '/agent');
    await expect(new AgentShell(page).workspaceRole).toHaveText(EN.roleAgent);
  });
});

test.describe('messages and sample numbers', () => {
  test('the landlord income page does not show the raw API error', { tag: '@known-bug' }, async ({ page, loginAs, guard }) => {
    // ขั้นที่ 1: ล็อกอินเป็น tenant ที่ไม่มีบทบาท landlord แล้วเปิดหน้ารายได้ของผู้ให้เช่า
    // บัญชีที่ไม่มีบทบาท landlord ได้ 403 จาก GET /bills/received (ผลเทสด้วยมือข้อ 2) ก่อนถึงขั้นสร้างบิล
    // ตัวกันตัดเส้นทางนี้เป็นค่าเริ่มต้น (guard.ts) ข้อนี้เปิดให้ผ่านหลังตรวจบทบาทแล้วเท่านั้น
    await loginAs('tenant');
    await expectLacksRole(page, 'landlord');
    guard.allowOwnerBills();
    const income = page.waitForResponse((response) => response.url().includes('/bills/received'), { timeout: 30_000 });
    await page.goto('/landlord/income');
    expect((await income).status(), 'GET /bills/received ต้องถูกปฏิเสธด้วย 403').toBe(403);
    // ขั้นที่ 2: รอให้หน้าแสดงข้อความผิดพลาด (TenantBillsScreen.tsx:74, 172-174 role=alert)
    // เมื่อแก้บั๊กข้อ 2 แล้ว tenant จะไม่เห็นหน้านี้ ข้อนี้จะแดงที่ขั้นนี้ ให้ย้ายไปเทสด้วยบัญชีที่มีหน้านี้แต่ API ปฏิเสธ
    const alert = new BillsScreen(page).alert;
    await expect(alert.first()).toBeVisible();
    // ขั้นที่ 3: ข้อความต้องไม่ใช่ข้อความดิบจาก API
    // localizedError ส่งข้อความภาษาอังกฤษของ API ออกมาตรง ๆ เมื่อหน้าเป็นภาษาอังกฤษ (packages/i18n/src/error-message.ts:26-29)
    test.fail(true, 'บั๊กข้อ 7: ข้อความผิดพลาดจาก API แสดงให้ผู้ใช้เห็นตรง ๆ');
    await expect(alert.filter({ hasText: RAW_ERRORS.requiredRoleLandlord })).toHaveCount(0);
  });

  test('the admin page does not show numbers written into the code', { tag: '@known-bug' }, async ({ page, loginAs }) => {
    // ขั้นที่ 1: ล็อกอินเป็น admin แล้วเปิด /admin
    await loginAs('admin');
    await page.goto('/admin');
    const admin = new AdminHome(page);
    await expect(admin.title).toBeVisible();
    // ขั้นที่ 2: ต้องไม่เห็นตัวเลขที่เขียนไว้ในโค้ด
    test.fail(true, 'บั๊กข้อ 8: /admin แสดงตัวเลขที่เขียนไว้ในโค้ด (app/index.tsx:1092) ไม่มีคำขอไป API');
    await expect(admin.hardcodedSummary).toHaveCount(0);
  });
});
