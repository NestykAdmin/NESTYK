import type { BrowserContext, Route } from '@playwright/test';
import { webUiEnv } from './web-ui-env';

/**
 * ตัวกันของเทส UI เว็บ: ตัดคำขอที่อันตรายตั้งแต่ในเบราว์เซอร์ คำขอที่ถูกตัดไปไม่ถึงเครื่องปลายทางเลย
 *
 * เหตุผล (บันทึก QA 4 พ.ย. 2026 และผลเทสเว็บข้อ 1):
 *   - แอปขอบทบาทให้ตัวเองผ่าน POST /auth/dev/roles 2 จุด
 *       apps/consumer-app/lib/agent-session.ts:72-76  ensureAgentSession ขอ agent เมื่อเปิดหน้านายหน้าด้วยบัญชีที่ยังไม่มีบทบาทนี้
 *       apps/consumer-app/lib/auth/AuthContext.tsx:81-91  ensureAdminRole ขอ admin ทุกครั้งที่ล็อกอิน
 *         (ที่ qa/e2e 648dd28 ทั้ง 2 จุดขอเฉพาะ dev build ที่ตั้ง EXPO_PUBLIC_ALLOW_DEV_ROLE_GRANT=true ผลรัน 6 พ.ย. 2026 ยังเห็นคำขอ)
 *   - API บนเครื่อง Aof ตั้ง ALLOW_DEV_ROLE_GRANT=true และต่อฐานข้อมูลของทีม ถ้าคำขอนี้ถึง API บนเครื่อง
 *     บทบาท agent หรือ admin จะถูกบันทึกถาวรให้บัญชี QA ในฐานข้อมูลของทีม
 *
 * ชั้นที่ 1: คำขอ /auth/dev/roles ถูกตัดทุกครั้ง ไม่ว่าจะไป API ตัวไหน (ทุก method) และคำขอ /auth/dev/ อื่น
 *   (เช่น /auth/dev/register ที่สร้างผู้ใช้: AuthContext.tsx:388 ที่ qa/e2e 648dd28) ถูกตัดและทำให้เทสไม่ผ่าน
 * ชั้นที่ 2: คำขอที่ path ขึ้นต้นด้วย /api/ แต่ไม่ได้ไปที่ webUiEnv.apiOrigin ถูกตัด และทำให้เทสข้อนั้นไม่ผ่าน
 *   ครอบถึง proxy ของ Metro: เมื่อ EXPO_PUBLIC_API_URL เป็นที่อยู่ในเครื่อง เว็บเรียก API ผ่าน /api/... บน localhost:8081
 *   (apps/consumer-app/lib/web-api-proxy.ts, lib/config.ts) ซึ่งส่งต่อไป API บนเครื่อง
 * ชั้นที่ 3: global-setup เปิดหน้าแรกก่อนเริ่มทั้งชุด ถ้าเห็นคำขอ /api/ ไปที่อื่น หยุดทั้งชุด (web-ui-global-setup.ts)
 *
 * ตัดเพิ่ม เผื่อเทสหรือหน้าเว็บผิดพลาด (ถ้าเกิด เทสไม่ผ่าน)
 *   - ออกจากทุกอุปกรณ์ (Supabase POST /auth/v1/logout ที่ไม่ใช่ scope=local): จะตัด session ของบัญชี QA ที่ทีมใช้ร่วมกัน
 *   - สมัครสมาชิก (Supabase POST /auth/v1/signup): ไม่ให้สร้างบัญชีจริงในระบบของทีม
 *   - ส่งอีเมลรีเซ็ตรหัส (Supabase POST /auth/v1/recover): ไม่ให้ส่งอีเมลจริงหรือใช้เพดานการส่งของทีม
 *
 *   - คำขอไป E2E_WEB_API_ORIGIN ที่ method ไม่ใช่ GET, HEAD หรือ OPTIONS และไม่อยู่ใน ALLOWED_WRITES (ตอนนี้มีแค่ POST /auth/sync ที่ทุกการล็อกอินเรียก)
 *     ชั้นนี้ไม่ครอบคำขอเขียนไป Supabase โดยตรง (เช่น PUT /auth/v1/user หรือ /rest/v1/)
 *     กันไว้ก่อน เผื่อหน้าใดส่งคำขอเขียนเองตอนเปิด (ข้อเสนอของ test-reviewer รอบ 2) ถ้าเกิด ให้ดูว่าเป็นคำขออะไรก่อนเพิ่มในรายการ
 *
 * ตัดโดยไม่ทำให้เทสไม่ผ่าน (หน้าเว็บเรียกเองเป็นปกติ):
 *   - POST /bills/mine/refresh และ POST /bills/received/refresh (ตั้งแต่ d2d4554, billing/bill-refresh.controller.ts)
 *     ออกบิลที่ถึงกำหนดและเปลี่ยนการเข้าพักจาก prospect เป็น active ของผู้เรียก แอปเรียกก่อนอ่านบิลทุกครั้ง
 *     (apps/consumer-app/lib/tenant-bills-api.ts refreshOnce) และถ้าคำขอล้ม แอปอ่านบิลต่อโดยไม่แจ้ง error
 *     ตัดเป็นชนิด bill-write เสมอ (ไม่มีข้อไหนเปิดให้ผ่าน) ถ้าไม่ตัด จะตกเป็น unexpected-write และทำให้ทุกข้อที่เปิดหน้าบิลแดง
 *   - เส้นทางบิล GET: ตั้งแต่ d2d4554 อ่านอย่างเดียว แต่ API รุ่นก่อนหน้านั้นสร้างบิลก่อนตอบ จึงตัดไว้เป็นค่าเริ่มต้น
 *     และปล่อยผ่านเฉพาะเมื่อ global-setup ตรวจรุ่นแล้ว (ดูหัวข้อ "ระยะ 2" ด้านล่าง)
 *     GET /bills/mine, /bills/mine/next (ensureForUser ใน API รุ่นก่อน d2d4554) และ /bills/agent/tenants/:id (listForAgentTenant)
 *     หน้าแรกของ tenant เรียก /bills/mine/next ทันทีที่ล็อกอิน (TenantNextBillCard) ถ้าฐานข้อมูลของ staging เป็นของทีม จะสร้างบิลจริง
 *     และ GET /bills/received (listReceived เรียก ensureForOwner ใน API รุ่นก่อน d2d4554) ซึ่งตัดเป็นค่าเริ่มต้นด้วย
 *     เทสข้อความดิบ "Required role: landlord" ให้หน้าได้คำตอบ 403 ของเส้นทางนี้จริง จึงเปิดให้ผ่านเฉพาะข้อนั้นด้วย allowOwnerBills()
 *     หลังตรวจแล้วว่าบัญชีไม่มีบทบาท landlord (RolesGuard ตอบ 403 ก่อนถึง ensureForOwner)
 *   - ระยะ 2 (6 พ.ย. 2026): global-setup ตรวจรุ่นของ API ก่อนเริ่มทั้งชุด (web-ui-global-setup.ts probeBillReads)
 *     ถ้า API มีเส้นทาง POST /bills/mine/refresh (ตอบ 401 เมื่อไม่ล็อกอิน) แปลว่าเป็นรุ่นตั้งแต่ d2d4554 ที่ GET บิลอ่านอย่างเดียว
 *     จึงตั้ง E2E_WEB_BILL_READS=allowed และตัวกันปล่อย GET 4 เส้นทางนี้ผ่าน (isBillRead) ส่วน POST refresh ยังถูกตัดทุกครั้ง
 *     ตรวจโค้ดที่ API a02e532 แล้ว: listMine, nextForUser, listReceived, listForAgentTenant ไม่มีคำสั่งเขียน
 *       (apps/api/src/billing/tenant-billing.service.ts:435-500, 598-640 เขียนเฉพาะ insertBills ที่ refresh และงาน 00:05 เรียก)
 *     ได้ค่าอื่น (404 = รุ่นเก่า, เครือข่ายล้ม, เลขอื่น) หรือ Aof ตั้ง E2E_WEB_BILL_READS=blocked เอง ตัดต่อเหมือนเดิม
 *
 * ทุกคำขอที่ถูกตัดถูกจดไว้ (เฉพาะ origin + path ไม่จด query เพราะอาจมี token) เทสใช้จำนวนที่จดเป็นหลักฐานได้
 */

export type BlockedKind =
  | 'dev-role-grant'
  | 'dev-endpoint'
  | 'foreign-api'
  | 'global-sign-out'
  | 'sign-up'
  | 'password-recovery'
  | 'unexpected-write'
  | 'bill-write'
  | 'owner-bills';

export interface BlockedRequest {
  kind: BlockedKind;
  method: string;
  /** origin + path เท่านั้น */
  target: string;
  /** ค่า role ในเนื้อคำขอของ /auth/dev/roles (agent หรือ admin) ชนิดอื่นเป็น null */
  role: string | null;
}

/** คำขอเขียนไป API ที่ยอมให้ผ่าน: METHOD + path ต่อจาก /api/v1 (การล็อกอินทุกครั้ง: AuthContext.tsx:74-78 และ lib/agent-session.ts:44-51 ที่ 648dd28) */
const ALLOWED_WRITES: readonly string[] = ['POST /auth/sync'];

/** method ที่ไม่เขียนข้อมูล (OPTIONS คือคำขอตรวจ CORS ที่เบราว์เซอร์ส่งเอง) */
const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * แยกชนิดของคำขอที่ต้องตัด (null = ปล่อยผ่าน) export ไว้ให้ global-setup ใช้กติกาเดียวกัน
 * method: ถ้าไม่ระบุ (ตัวเลือก URL ของ route ไม่รู้ method) จะไม่ตรวจชนิด unexpected-write
 * เทียบ path แบบตัวพิมพ์เล็ก เผื่อ API รับ path แบบไม่สนตัวพิมพ์ (ข้อเสนอของ test-reviewer รอบ 2)
 */
export function classifyRequest(url: URL, apiOrigin: string = webUiEnv.apiOrigin, method?: string): BlockedKind | null {
  const path = url.pathname.toLowerCase();
  if (path.includes('/auth/dev/roles')) return 'dev-role-grant';
  if (path.includes('/auth/dev/')) return 'dev-endpoint';
  if (path.startsWith('/api/') && url.origin !== apiOrigin) return 'foreign-api';
  if (path.endsWith('/auth/v1/logout') && url.searchParams.get('scope') !== 'local') return 'global-sign-out';
  if (path.endsWith('/auth/v1/signup')) return 'sign-up';
  if (path.endsWith('/auth/v1/recover')) return 'password-recovery';
  // ถ้าเปลี่ยนชนิดของ 2 เส้นทางนี้ ให้แก้ตัวกรอง '/bills/received' ใน tests/web-ui/safety-roles.spec.ts (ข้อ landlord income) ด้วย
  if (/\/bills\/(mine|received)\/refresh\/?$/.test(path)) return 'bill-write';
  if (/\/bills\/mine(\/next)?\/?$/.test(path) || path.includes('/bills/agent/tenants/')) return 'bill-write';
  if (/\/bills\/received\/?$/.test(path)) return 'owner-bills';
  if (method && !READ_METHODS.has(method.toUpperCase()) && path.startsWith('/api/') && url.origin === apiOrigin) {
    const apiPath = path.replace(/^\/api\/v\d+/, '');
    if (!ALLOWED_WRITES.includes(`${method.toUpperCase()} ${apiPath}`)) return 'unexpected-write';
  }
  return null;
}

/** ชนิดที่ต้องไม่เกิดเลยในเทสใด ๆ (fixture ตรวจหลังจบทุกข้อ และตรวจซ้ำตอนปิด worker) */
export const NEVER_ALLOWED: readonly BlockedKind[] = [
  'dev-endpoint',
  'foreign-api',
  'global-sign-out',
  'sign-up',
  'password-recovery',
  'unexpected-write',
];

/** ตัวแปรแวดล้อมที่ global-setup ตั้งหลังตรวจรุ่นของ API ('allowed' = ปล่อย GET บิลผ่าน ค่าอื่น = ตัด) */
export const BILL_READS_VARIABLE = 'E2E_WEB_BILL_READS';

/** global-setup ตรวจแล้วว่า GET บิลของ API นี้อ่านอย่างเดียว (อ่านค่าตอนเรียก เพราะ global-setup ตั้งค่าหลังโหลดไฟล์นี้) */
export function billReadsAllowed(): boolean {
  return process.env[BILL_READS_VARIABLE] === 'allowed';
}

/**
 * GET บิลที่ปล่อยผ่านได้เมื่อ billReadsAllowed(): /bills/mine, /bills/mine/next, /bills/received, /bills/agent/tenants/<เลข>
 * ต้องไปที่ E2E_WEB_API_ORIGIN เท่านั้น (ข้อเสนอของ test-reviewer: path /bills/... ที่ไปเครื่องอื่นโดยไม่มี /api/ ไม่ตกเป็น foreign-api)
 * path ย่อยอื่นใต้ /bills/agent/tenants/ ยังถูกตัดเป็น bill-write (ไม่ได้ตรวจโค้ดของเส้นทางเหล่านั้น)
 */
export function isBillRead(url: URL, method: string): boolean {
  if (method.toUpperCase() !== 'GET' || url.origin !== webUiEnv.apiOrigin) return false;
  const path = url.pathname.toLowerCase().replace(/^\/api\/v\d+/, '').replace(/\/+$/, '');
  return /^\/bills\/(mine|mine\/next|received|agent\/tenants\/\d+)$/.test(path);
}

/** อ่าน role จากเนื้อคำขอขอบทบาท เช่น {"role":"agent"} (ไม่เก็บเนื้อคำขอชนิดอื่น เพราะอาจมีข้อมูลส่วนตัว) */
function roleOf(kind: BlockedKind, body: string | null): string | null {
  if (kind !== 'dev-role-grant' || !body) return null;
  try {
    const parsed: unknown = JSON.parse(body);
    const role = (parsed as { role?: unknown } | null)?.role;
    return typeof role === 'string' ? role : null;
  } catch {
    return null;
  }
}

export class RequestGuard {
  readonly blocked: BlockedRequest[] = [];
  private ownerBillsAllowed = false;

  /**
   * ให้ GET /bills/received ผ่าน (เฉพาะ GET method อื่นยังถูกตัดเป็น owner-bills) ใช้ได้เฉพาะเมื่อตรวจแล้วว่าบัญชีที่ล็อกอินไม่มีบทบาท landlord
   * (RolesGuard ตอบ 403 ก่อนถึง ensureForOwner ที่สร้างบิล) เรียกได้จากเทสเท่านั้น
   */
  allowOwnerBills(): void {
    this.ownerBillsAllowed = true;
  }

  /** ติดตั้งกับ context ก่อนเปิดหน้าใด ๆ ใน context นั้น (มีผลกับทุกแท็บของ context) */
  async install(context: BrowserContext): Promise<void> {
    await context.route(
      // ส่งทุกคำขอ /api/ เข้าตัวจัดการ เพราะต้องรู้ method ก่อนตัดสินชนิด unexpected-write
      (url) => url.pathname.toLowerCase().startsWith('/api/') || classifyRequest(url) !== null,
      async (route: Route) => {
        const request = route.request();
        const url = new URL(request.url());
        const kind = classifyRequest(url, webUiEnv.apiOrigin, request.method());
        const billRead = (kind === 'bill-write' || kind === 'owner-bills') && billReadsAllowed() && isBillRead(url, request.method());
        if (kind === null || billRead || (kind === 'owner-bills' && this.ownerBillsAllowed && request.method() === 'GET')) {
          await route.continue();
          return;
        }
        this.blocked.push({ kind, method: request.method(), target: `${url.origin}${url.pathname}`, role: roleOf(kind, request.postData()) });
        await route.abort('blockedbyclient');
      },
    );
  }

  /** คำขอที่ถูกตัดของชนิดที่ระบุ */
  of(kind: BlockedKind): BlockedRequest[] {
    return this.blocked.filter((entry) => entry.kind === kind);
  }

  /** คำขอขอบทบาทที่ถูกตัด เฉพาะบทบาทที่ระบุ */
  roleGrants(role: 'agent' | 'admin'): BlockedRequest[] {
    return this.of('dev-role-grant').filter((entry) => entry.role === role);
  }
}
