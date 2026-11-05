import type { BrowserContext, Route } from '@playwright/test';
import { webUiEnv } from './web-ui-env';

/**
 * ตัวกันของเทส UI เว็บ: ตัดคำขอที่อันตรายตั้งแต่ในเบราว์เซอร์ คำขอที่ถูกตัดไปไม่ถึงเครื่องปลายทางเลย
 *
 * เหตุผล (บันทึก QA 4 พ.ย. 2026 และผลเทสเว็บข้อ 1):
 *   - แอปขอบทบาทให้ตัวเองผ่าน POST /auth/dev/roles 2 จุด
 *       apps/consumer-app/lib/agent-session.ts:16  ensureAgentSession ขอ agent เมื่อเปิดหน้านายหน้าด้วยบัญชีที่ยังไม่มีบทบาทนี้
 *       apps/consumer-app/lib/auth/AuthContext.tsx:76-85  ensureAdminRole ขอ admin ทุกครั้งที่ล็อกอิน
 *         (ปิดได้ด้วย EXPO_PUBLIC_ALLOW_DEV_ROLE_GRANT=false แต่ ensureAgentSession ไม่ตรวจสวิตช์นี้)
 *   - API บนเครื่อง Aof ตั้ง ALLOW_DEV_ROLE_GRANT=true และต่อฐานข้อมูลของทีม ถ้าคำขอนี้ถึง API บนเครื่อง
 *     บทบาท agent หรือ admin จะถูกบันทึกถาวรให้บัญชี QA ในฐานข้อมูลของทีม
 *
 * ชั้นที่ 1: คำขอ /auth/dev/roles ถูกตัดทุกครั้ง ไม่ว่าจะไป API ตัวไหน (ทุก method) และคำขอ /auth/dev/ อื่น
 *   (เช่น /auth/dev/register ที่สร้างผู้ใช้: AuthContext.tsx:370-373) ถูกตัดและทำให้เทสไม่ผ่าน
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
 *   - เส้นทางบิลที่ "อ่าน" แต่สร้างบิลก่อนตอบ: GET /bills/mine, /bills/mine/next (ensureForUser
 *     apps/api/src/billing/tenant-billing.service.ts:335-340, 422-435) และ /bills/agent/tenants/:id (listForAgentTenant :588-604)
 *     หน้าแรกของ tenant เรียก /bills/mine/next ทันทีที่ล็อกอิน (TenantNextBillCard) ถ้าฐานข้อมูลของ staging เป็นของทีม จะสร้างบิลจริง
 *     และ GET /bills/received (listReceived เรียก ensureForOwner :478-480) ซึ่งตัดเป็นค่าเริ่มต้นด้วย
 *     เทสข้อความดิบ "Required role: landlord" ต้องได้คำตอบ 403 ของเส้นทางนี้ จึงเปิดให้ผ่านเฉพาะข้อนั้นด้วย allowOwnerBills()
 *     หลังตรวจแล้วว่าบัญชีไม่มีบทบาท landlord (RolesGuard ตอบ 403 ก่อนถึง ensureForOwner)
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

/** คำขอเขียนไป API ที่ยอมให้ผ่าน: METHOD + path ต่อจาก /api/v1 (การล็อกอินทุกครั้ง: AuthContext.tsx:72-74 และ lib/agent-session.ts:12) */
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
   * ให้ GET /bills/received ผ่าน ใช้ได้เฉพาะเมื่อตรวจแล้วว่าบัญชีที่ล็อกอินไม่มีบทบาท landlord
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
        if (kind === null || (kind === 'owner-bills' && this.ownerBillsAllowed)) {
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
