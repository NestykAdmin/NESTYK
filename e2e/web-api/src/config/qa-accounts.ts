/**
 * บัญชี QA แยกบทบาทของทีม (qa-<role>@nestyk.test) ที่เทสใช้เมื่อต้องล็อกอิน
 *   - qa-agent เป็นผู้เรียกหลัก (fixture agent ใน src/fixtures/api.fixture.ts) เทสของกลุ่ม agent/* อ่านลีดและห้องของบัญชีนี้
 *   - qa-tenant และ qa-landlord ใช้กับเส้นทางที่รับเฉพาะบทบาทนั้น (bills/mine/*, bills/received/*, contracts/mine*)
 *     และ qa-landlord เป็นบัญชีเจ้าของห้องที่เทสค้นใน GET /agent/contracts/owner-users
 *   - ทุกบัญชีใช้กับเทสสิทธิ์ตามบทบาท (401/403) ใน roles.spec.ts
 *
 * ที่มา: supabase/migrations/20261019100000_link_qa_accounts.sql บรรทัด 23-27 (ในไฟล์ migration) ที่ develop a09e6d2
 *   migration นี้ไม่สร้างบัญชีล็อกอิน ทีมสร้างบัญชีไว้ใน Supabase Authentication เอง แล้ว migration ผูกบัญชีกับตาราง users
 *   และ user_roles ด้วยอีเมล บัญชีจึงมีในฐานข้อมูลเฉพาะเมื่อทีมสร้างล็อกอินไว้ก่อนขึ้น migration
 *
 * ชุดเทสล็อกอินด้วยบัตรผ่านแบบนักพัฒนา dev|<uuid>|<email> (ต้องเป็น API ที่ตั้ง ALLOW_DEV_AUTH=true)
 *   API หาผู้ใช้จาก uuid อย่างเดียว (คอลัมน์ users.supabase_user_id: auth.guard.ts canActivate และ findBySupabaseUserId)
 *   uuid ของบัญชีเหล่านี้ทีมไม่ได้กำหนดไว้ (Supabase สร้างให้ตอนสร้างล็อกอิน) และไม่อยู่ใน repo
 *   จึงต้องตั้งเป็นตัวแปรแวดล้อมตอนรัน เช่น E2E_QA_LANDLORD_UUID=<UID จากหน้า Supabase > Authentication > Users>
 *   E2E_QA_AGENT_UUID ต้องตั้งทุกครั้ง: ถ้าไม่ได้ตั้ง global-setup หยุดทั้งชุด (เทสเกือบทุกข้อใช้ qa-agent)
 *   บัญชีอื่นที่ไม่ได้ตั้งตัวแปร: เทสที่ต้องใช้บัญชีนั้นจะข้าม พร้อมเหตุผล
 *
 * ไม่ต้องใช้รหัสผ่าน และห้ามเขียน uuid จริงลงไฟล์ที่ commit (ใครรู้ uuid ก็ล็อกอินเป็นบัญชีนั้นได้กับ API ที่เปิดโหมดนักพัฒนา)
 */

export type QaRole = 'guest' | 'tenant' | 'landlord' | 'agent' | 'admin';

export interface QaAccount {
  role: QaRole;
  /** ชื่อตัวแปรแวดล้อมที่เก็บ uuid ของบัญชีนี้ */
  uuidVariable: string;
  /** uuid ที่ตั้งไว้ (null = ไม่ได้ตั้ง) */
  uuid: string | null;
  /** อีเมลตาม migration (ตัวพิมพ์เล็กทั้งหมด migration เทียบด้วย lower(email)) */
  email: string;
  /** บทบาทที่ migration ให้บัญชีนี้ทั้งหมด (ทุกบัญชีมี guest) */
  roles: readonly string[];
}

/** ทุกบทบาทของบัญชี QA เรียงตามลำดับใน migration */
export const QA_ROLES: readonly QaRole[] = ['guest', 'tenant', 'landlord', 'agent', 'admin'];

/** บทบาทของแต่ละบัญชี ตามคอลัมน์ roles ใน migration (บรรทัด 23-27) */
const ROLES_OF: Record<QaRole, readonly string[]> = {
  guest: ['guest'],
  tenant: ['guest', 'tenant'],
  landlord: ['guest', 'landlord'],
  agent: ['guest', 'agent'],
  admin: ['guest', 'admin'],
};

/** รูปแบบ uuid (คอลัมน์ users.supabase_user_id เป็นชนิด uuid: entities/user.entity.ts) */
const UUID_FORMAT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function readAccount(role: QaRole): QaAccount {
  const uuidVariable = `E2E_QA_${role.toUpperCase()}_UUID`;
  const uuid = process.env[uuidVariable]?.trim() || null;
  return {
    role,
    uuidVariable,
    uuid,
    // โดเมนเริ่มต้นของสคริปต์ทีม (apps/api/scripts/db-test-users.cjs TEST_USER_EMAIL_DOMAIN) และของ migration คือ nestyk.test
    email: `qa-${role}@${process.env.E2E_QA_EMAIL_DOMAIN?.trim().toLowerCase() || 'nestyk.test'}`,
    roles: ROLES_OF[role],
  };
}

/** บัญชี QA ทั้ง 5 บัญชี อ่านตัวแปรแวดล้อมครั้งเดียวตอนโหลดไฟล์ */
export const qaAccounts: Record<QaRole, QaAccount> = Object.fromEntries(
  QA_ROLES.map((role) => [role, readAccount(role)]),
) as Record<QaRole, QaAccount>;

/**
 * ตรวจรูปแบบ uuid ที่ตั้งไว้ คืนรายการชื่อตัวแปรที่รูปแบบผิด
 * ตรวจก่อนส่งให้ API เพราะ dev token ที่ uuid ผิดรูปแบบทำให้ API ตอบ 500 (บั๊กที่รู้แล้ว ดู auth.spec.ts) ไม่ใช่ 401
 * ไม่คืนค่าที่ตั้งไว้ เพื่อไม่ให้ uuid ไปอยู่ในผลรัน
 */
export function malformedQaUuidVariables(): string[] {
  return QA_ROLES.map((role) => qaAccounts[role])
    .filter((account) => account.uuid !== null && !UUID_FORMAT.test(account.uuid))
    .map((account) => account.uuidVariable);
}

/** บัตรผ่านแบบนักพัฒนาของบัญชี QA (เรียกได้เฉพาะบัญชีที่ตั้ง uuid แล้ว) */
export function qaDevToken(account: QaAccount): string {
  if (account.uuid === null) {
    throw new Error(`ยังไม่ได้ตั้ง ${account.uuidVariable}`);
  }
  return `dev|${account.uuid}|${account.email}`;
}

/** เหตุผลที่เทสข้าม เมื่อยังไม่ได้ตั้ง uuid ของบัญชีที่ต้องใช้ */
export function qaSkipReason(account: QaAccount): string {
  return `ยังไม่ได้ตั้ง ${account.uuidVariable} (uuid ของ ${account.email} จาก Supabase > Authentication > Users)`;
}
