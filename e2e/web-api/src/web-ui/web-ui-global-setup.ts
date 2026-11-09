import { chromium, request } from '@playwright/test';
import { checkQaAccount } from '../global-setup';
import { BILL_READS_VARIABLE, classifyRequest } from './guard';
import { malformedQaUuidVariables, qaAccounts, qaDevToken } from '../config/qa-accounts';
import { LOCAL_API_SWITCH, localApiMode, PASSWORD_VARIABLES, passwordOf, unsafeApiOriginReason, webUiEnv, type WebUiRole } from './web-ui-env';

/**
 * global-setup ของเทส UI เว็บ (playwright.web-ui.config.ts) ทำก่อนเริ่มทั้งชุด ถ้าไม่ผ่าน หยุดทั้งชุดและบอกสาเหตุ
 *   1. E2E_WEB_API_ORIGIN ต้องเป็น https ไม่ใช่เครื่องนี้หรือเครื่องในวง LAN และชื่อเครื่องอยู่ใน ALLOWED_API_HOSTS (web-ui-env.ts)
 *      (ตัวกันชั้นที่ 2 ใช้ค่านี้ตัดสินว่า API ไหนเรียกได้)
 *      ถ้าตั้ง E2E_WEB_LOCAL_API=yes: API ต้องเป็น http://localhost:4000 และต้องผ่าน assertLocalDevRoleGrantOff
 *      กับ assertLocalQaAccountsLinked (บัญชีที่ตั้งรหัสผ่านมีในฐานข้อมูลแล้ว) ก่อนเปิดเว็บ
 *   2. เปิดหน้าแรกของเว็บได้ (npm run web เปิดอยู่)
 *   3. ระหว่างโหลดหน้าแรกแบบไม่ล็อกอิน ถ้าเห็นคำขอ /api/ ไปที่อื่นที่ไม่ใช่ E2E_WEB_API_ORIGIN หยุดทั้งชุดก่อนล็อกอิน (ตัวกันชั้นที่ 3)
 *      คำขอที่เห็นถูกตัดทั้งหมด ไม่ถึงปลายทาง หน้าแรกของผู้เยี่ยมชมน่าจะไม่เรียก API (index.tsx ใช้ MOCK_LISTINGS: test-reviewer อนุมาน)
 *      ถ้าไม่เห็นคำขอเลย ชั้นนี้ตรวจอะไรไม่ได้ จะพิมพ์บอกไว้ ตัวกันชั้นที่ 1-2 ยังทำงานในทุกข้อ
 *   4. พิมพ์บรรทัดสรุปว่าบัญชีไหนตั้งรหัสผ่านแล้ว (ไม่พิมพ์รหัส)
 *   5. ตรวจรุ่นของ API ว่า GET บิลอ่านอย่างเดียวหรือไม่ (probeBillReads) แล้วตั้ง E2E_WEB_BILL_READS ให้ตัวกันใน guard.ts
 *      ค่าใน process.env ที่ตั้งใน global-setup ส่งต่อถึง worker ของ Playwright
 */
export default async function webUiGlobalSetup(): Promise<void> {
  const unsafe = unsafeApiOriginReason(webUiEnv.apiOrigin);
  if (unsafe) {
    throw new Error(
      `หยุดก่อนเปิดเว็บ: E2E_WEB_API_ORIGIN=${webUiEnv.apiOrigin} ใช้ไม่ได้ (${unsafe})\n` +
        (localApiMode()
          ? `ตั้ง ${LOCAL_API_SWITCH}=yes ไว้ ให้เว็บและเทสใช้ API บนเครื่องที่ http://localhost:4000 เท่านั้น (README หัวข้อ "ใช้ API บนเครื่อง")`
          : 'API บนเครื่องตั้ง ALLOW_DEV_ROLE_GRANT=true และต่อฐานข้อมูลของทีม เทส UI ต้องรันกับเว็บที่เรียก staging เว้นแต่ตั้ง E2E_WEB_LOCAL_API=yes (บันทึก QA 4 พ.ย. 2026)'),
    );
  }
  if (localApiMode()) {
    await assertLocalDevRoleGrantOff();
    await assertLocalQaAccountsLinked();
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
          (localApiMode()
            ? `ตั้ง ${LOCAL_API_SWITCH}=yes ไว้ แต่เว็บไม่ได้เรียก ${webUiEnv.apiOrigin} ตรง ๆ ให้ตั้ง EXPO_PUBLIC_API_URL เป็น ${webUiEnv.apiOrigin}/api/v1 และ EXPO_PUBLIC_WEB_API_PROXY=false ใน .env แล้วเปิดเว็บใหม่\n`
            : 'เว็บน่าจะชี้ไป API บนเครื่อง (EXPO_PUBLIC_API_URL ใน .env) ห้ามรันเทส UI แบบนี้ เพราะเว็บจะขอบทบาทให้บัญชี QA ในฐานข้อมูลของทีม\n') +
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

  const billReads = await probeBillReads();
  process.env[BILL_READS_VARIABLE] = billReads.result;
  console.log(`[เทส UI เว็บ] API: ${webUiEnv.apiOrigin}${localApiMode() ? ' (API บนเครื่อง ต่อฐานข้อมูลของทีม ตรวจแล้วว่าปิดการขอบทบาท)' : ''}`);
  console.log(`[เทส UI เว็บ] ปลายทางหลัง Sign Out ที่คาด: ${webUiEnv.signOutTo} (ต้องตรงกับ EXPO_PUBLIC_WEB_SIGN_OUT_TO ของเว็บ ตั้ง E2E_WEB_SIGN_OUT_TO=login ถ้าเว็บตั้ง login)`);
  console.log(`[เทส UI เว็บ] ภาษาของเว็บ: ${process.env.E2E_WEB_LOCALE === 'th' ? 'ไทย (th)' : 'อังกฤษ (en)'}`);
  console.log(`[เทส UI เว็บ] GET บิล: ${billReads.result === 'allowed' ? 'ปล่อยผ่าน' : 'ตัด'} (${billReads.reason})`);

  const roles = Object.keys(PASSWORD_VARIABLES) as WebUiRole[];
  const missing = roles.filter((role) => passwordOf(role) === null).map((role) => PASSWORD_VARIABLES[role]);
  console.log(
    `[เทส UI เว็บ] ตั้งรหัสผ่านแล้ว ${roles.length - missing.length} จาก ${roles.length} บัญชี` +
      (missing.length ? ` (ไม่ได้ตั้ง ${missing.join(', ')}: เทสที่ใช้บัญชีนั้นจะข้าม)` : ''),
  );
}

/**
 * ตรวจว่า API ของ staging เป็นรุ่นที่ GET บิลอ่านอย่างเดียว (ตั้งแต่ d2d4554) หรือไม่ ด้วย POST /bills/mine/refresh แบบไม่ส่ง token
 *   รุ่นใหม่: เส้นทางนี้มี และ AuthGuard ตอบ 401 ก่อนถึงโค้ดของเส้นทาง (apps/api/src/billing/bill-refresh.controller.ts:14-15
 *   @UseGuards(AuthGuard, RolesGuard) ที่ API a02e532) จึงไม่มีการเขียน
 *   รุ่นเก่า: ไม่มีเส้นทางนี้ Nest ตอบ 404
 * ค่าอื่นทุกแบบ (เครือข่ายล้ม หมดเวลา เลขอื่น) ถือว่าไม่รู้ จึงตัดต่อเหมือนเดิม
 * Aof ตั้ง E2E_WEB_BILL_READS=blocked ก่อนรันได้ เพื่อตัด GET บิลโดยไม่ตรวจ (ค่า allowed ที่ตั้งเองไม่ถูกเชื่อ ต้องตรวจทุกครั้ง)
 */
async function probeBillReads(): Promise<{ result: 'allowed' | 'blocked'; reason: string }> {
  if (process.env[BILL_READS_VARIABLE] === 'blocked') return { result: 'blocked', reason: `ตั้ง ${BILL_READS_VARIABLE}=blocked ไว้` };
  try {
    const response = await fetch(`${webUiEnv.apiOrigin}/api/v1/bills/mine/refresh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
      redirect: 'manual',
      signal: AbortSignal.timeout(15_000),
    });
    if (response.status === 401) return { result: 'allowed', reason: 'POST /bills/mine/refresh แบบไม่ล็อกอินได้ 401 = API รุ่นที่ GET บิลอ่านอย่างเดียว' };
    return { result: 'blocked', reason: `POST /bills/mine/refresh แบบไม่ล็อกอินได้ ${response.status} (401 เท่านั้นที่ปล่อย) เทสหน้าบิลจะข้าม` };
  } catch (error) {
    return { result: 'blocked', reason: `ตรวจรุ่นของ API ไม่ได้ (${(error as Error).name}) เทสหน้าบิลจะข้าม` };
  }
}

/**
 * ตรวจว่า API บนเครื่องปิดการขอบทบาทแบบนักพัฒนา (POST /auth/dev/roles) ก่อนให้เว็บเรียก ถ้าไม่แน่ใจ หยุดทั้งชุด
 *   ส่ง POST /auth/dev/roles ด้วย dev token ของ qa-agent และชื่อบทบาทที่ไม่มีอยู่จริง
 *   - ปิดอยู่: assertDevGrantEnabled ตอบ 403 "Dev role grant is disabled" ก่อนตรวจชื่อบทบาท
 *     (apps/api/src/auth/auth.service.ts:255-257, :496-502 ที่ qa/e2e 03a45a3)
 *   - เปิดอยู่: ชื่อบทบาทไม่อยู่ใน DEV_GRANTABLE จึงตอบ 400 ก่อนเขียน (:257-261) ไม่มีบทบาทถูกบันทึกทั้ง 2 กรณี
 *   - AuthGuard กับ dev token อ่านผู้ใช้อย่างเดียว (auth.guard.ts canActivate, findBySupabaseUserId, loadUserWithRoles)
 *   ผลอื่นทุกแบบ (401 = API ไม่รับ dev token หรือ uuid ไม่ตรง, เครือข่ายล้ม, เลขอื่น) ถือว่าไม่แน่ใจ และหยุดทั้งชุด
 *   ไม่พิมพ์ token หรือ uuid
 */
const DEV_ROLE_PROBE = 'e2e-not-a-role';

async function assertLocalDevRoleGrantOff(): Promise<void> {
  const agent = qaAccounts.agent;
  if (agent.uuid === null) {
    throw new Error(`หยุดก่อนเปิดเว็บ: ตั้ง ${LOCAL_API_SWITCH}=yes ต้องตั้ง ${agent.uuidVariable} ด้วย เพื่อตรวจว่า API บนเครื่องปิดการขอบทบาทแล้ว`);
  }
  // uuid ผิดรูปแบบทำให้ API ตอบ 500 แทน 401 (บั๊กที่รู้แล้วใน auth.spec.ts) ตรวจก่อนส่ง
  if (malformedQaUuidVariables().includes(agent.uuidVariable)) {
    throw new Error(`หยุดก่อนเปิดเว็บ: ${agent.uuidVariable} ไม่ใช่รูปแบบ uuid`);
  }
  let status: number;
  let message = '';
  try {
    const response = await fetch(`${webUiEnv.apiOrigin}/api/v1/auth/dev/roles`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${qaDevToken(agent)}` },
      body: JSON.stringify({ role: DEV_ROLE_PROBE }),
      redirect: 'manual',
      signal: AbortSignal.timeout(15_000),
    });
    status = response.status;
    const body = (await response.json().catch(() => null)) as { message?: unknown } | null;
    message = typeof body?.message === 'string' ? body.message : '';
  } catch (error) {
    throw new Error(`หยุดก่อนเปิดเว็บ: เรียก API บนเครื่อง ${webUiEnv.apiOrigin} ไม่ได้ (${(error as Error).name}) ให้เปิด API ก่อน`, { cause: error });
  }
  if (status === 403 && message === 'Dev role grant is disabled') {
    console.log('[เทส UI เว็บ] API บนเครื่องปิดการขอบทบาทแล้ว (POST /auth/dev/roles ได้ 403 "Dev role grant is disabled")');
    return;
  }
  const hint =
    status === 400
      ? 'API บนเครื่องยังเปิดการขอบทบาทอยู่ ให้ตั้ง ALLOW_DEV_ROLE_GRANT=false ใน .env.api แล้วเปิด API ใหม่'
      : status === 401 && message.includes('Call POST /auth/sync first')
        ? `${agent.uuidVariable} ไม่อยู่ในตาราง users ของฐานข้อมูลที่ API ใช้ (uuid ผิด หรือบัญชียังไม่ได้ผูก) ห้ามเรียก POST /auth/sync เอง ให้แจ้งทีม`
        : status === 401
          ? 'API ไม่รับ dev token (ตั้ง ALLOW_DEV_AUTH=true ใน .env.api แล้วเปิด API ใหม่)'
          : 'ผลไม่ตรงกับที่คาด';
  throw new Error(`หยุดก่อนเปิดเว็บ: ตรวจการขอบทบาทของ API บนเครื่องได้ ${status}${message ? ` "${message.slice(0, 120)}"` : ''} ไม่ใช่ 403 "Dev role grant is disabled"\n${hint}`);
}

/**
 * ตรวจว่าทุกบัญชีที่ตั้งรหัสผ่านไว้ มีอยู่ในตาราง users ของฐานข้อมูลที่ API บนเครื่องใช้ ก่อนให้เว็บล็อกอิน (ข้อสังเกต test-reviewer 9 พ.ย. 2026)
 *   การล็อกอินทุกครั้งเรียก POST /auth/sync ถ้าบัญชีไม่มี sync จะสร้างผู้ใช้ใหม่ในฐานข้อมูลของทีม (apps/api/src/auth/auth.service.ts sync)
 *   ใช้ checkQaAccount ของชุด API (src/global-setup.ts): ขั้นที่ 1 อ่านอย่างเดียวว่าบัญชีมีอยู่ ถ้ามีจึงเรียก sync และเทียบอีเมลกับบทบาท
 *   บัญชีที่ตั้งรหัสผ่านต้องตั้ง E2E_QA_<ROLE>_UUID ด้วย ไม่อย่างนั้นหยุดทั้งชุด
 */
async function assertLocalQaAccountsLinked(): Promise<void> {
  const roles = (Object.keys(PASSWORD_VARIABLES) as WebUiRole[]).filter((role) => passwordOf(role) !== null);
  const noUuid = roles.filter((role) => qaAccounts[role].uuid === null).map((role) => qaAccounts[role].uuidVariable);
  if (noUuid.length > 0) {
    throw new Error(`หยุดก่อนเปิดเว็บ: ตั้ง ${LOCAL_API_SWITCH}=yes ต้องตั้ง ${noUuid.join(', ')} ของบัญชีที่ตั้งรหัสผ่านไว้ด้วย เพื่อตรวจว่าบัญชีมีในฐานข้อมูลก่อนล็อกอิน`);
  }
  const malformed = malformedQaUuidVariables().filter((name) => roles.some((role) => qaAccounts[role].uuidVariable === name));
  if (malformed.length > 0) {
    throw new Error(`หยุดก่อนเปิดเว็บ: ${malformed.join(', ')} ไม่ใช่รูปแบบ uuid`);
  }
  const api = await request.newContext({ baseURL: `${webUiEnv.apiOrigin}/api/v1/` });
  try {
    for (const role of roles) {
      await checkQaAccount(api, qaAccounts[role]);
    }
  } finally {
    await api.dispose();
  }
  console.log(`[เทส UI เว็บ] ตรวจบัญชีในฐานข้อมูลของ API บนเครื่องแล้ว ${roles.length} บัญชี (${roles.join(', ')})`);
}
