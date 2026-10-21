import { request, type APIRequestContext } from '@playwright/test';
import { env } from './config/env';
import { malformedQaUuidVariables, qaAccounts, qaDevToken, QA_ROLES, type QaAccount } from './config/qa-accounts';

/**
 * ทำงาน 1 ครั้งก่อนเริ่มเทสทั้งชุด: ตรวจว่าระบบพร้อมให้เทส
 *
 * ทำไมต้องมี: ถ้า API ไม่ได้เปิด ไม่ได้ตั้ง uuid ของ qa-agent โหมดล็อกอินแบบนักพัฒนาปิดอยู่ ฐานข้อมูลยังไม่รัน migration ล่าสุด
 * หรือ API เป็นรุ่นเก่า เทสหลายข้อจะล้มด้วยข้อความที่อ่านยาก ตรวจตรงนี้ก่อนจะได้ข้อความเดียวที่บอกสาเหตุและวิธีแก้
 *
 * ลำดับการตรวจ (ห้ามสลับ):
 *   1. API ตอบที่ /health
 *   2. ตั้ง uuid ของ qa-agent แล้ว (ผู้เรียกหลักของชุดเทส: fixture agent)
 *   3. บัญชี QA ทุกบัญชีที่ตั้ง uuid (checkQaAccounts) ตรวจก่อนเรียกเส้นทางของนายหน้า
 *      เพราะถ้าบัญชีมีปัญหา ขั้นนี้บอกสาเหตุได้ตรงกว่า และไม่เรียก POST /auth/sync กับบัญชีที่ยังไม่ยืนยันว่ามีอยู่
 *   4. GET /agent/leads ด้วย qa-agent ได้ 200
 *   5. รุ่นของ API (id ที่เกินช่วงได้ 400)
 */

/** รุ่นต่ำสุดของ API ที่ชุดเทสนี้เขียนไว้ commit นี้อยู่ใน develop แล้ว (develop เป็นฐานหลักของงานเทสตั้งแต่ 16 ต.ค. 2026) */
const MIN_API_COMMIT = 'f7d52ed';

/** ข้อความของตัวตรวจ id ที่เพิ่มใน f7d52ed (apps/api/src/common/database-id.pipe.ts) ใช้แยก API รุ่นนี้ออกจากรุ่นก่อน */
const ID_OUT_OF_RANGE = 'ID must be an integer between 1 and 2147483647';

export default async function globalSetup(): Promise<void> {
  const api = await request.newContext({ baseURL: `${env.apiBaseUrl}/` });
  try {
    // ขั้นที่ 1: API ต้องตอบที่ /health
    const health = await api.get('health').catch((error: Error) => error);
    if (health instanceof Error || health.status() !== 200) {
      const detail = health instanceof Error ? health.message.split('\n')[0] : `ได้รหัส ${health.status()}`;
      throw new Error(
        `API ไม่ตอบที่ ${env.apiBaseUrl}/health (${detail})\n` +
          'วิธีแก้: เปิด API (และ Supabase ในเครื่อง ถ้า API ใช้ฐานข้อมูลในเครื่อง) ก่อน แล้วรันเทสอีกครั้ง',
      );
    }

    // ขั้นที่ 2: เทสเกือบทุกข้อเรียก API ในบทบาทนายหน้าด้วย qa-agent ถ้าไม่ได้ตั้ง uuid ให้หยุดทั้งชุดตรงนี้
    //   ดีกว่าปล่อยให้เทส 200 กว่าข้อแดงพร้อมกันด้วยข้อความเดียวกัน
    const agent = qaAccounts.agent;
    if (agent.uuid === null) {
      throw new Error(
        `ยังไม่ได้ตั้ง ${agent.uuidVariable} (uuid ของ ${agent.email} ผู้เรียกหลักของชุดเทส)\n` +
          'วิธีแก้: ตั้งตัวแปรนี้ด้วย UID จาก Supabase > Authentication > Users ตอนสั่งรัน ตามวิธีใน README หัวข้อตัวแปรแวดล้อม',
      );
    }

    // ขั้นที่ 3: ตรวจบัญชี QA ทุกบัญชีที่ตั้ง uuid (รวม qa-agent) ด้วยคำขอแบบอ่านอย่างเดียวก่อน แล้วจึงเรียก POST /auth/sync
    await checkQaAccounts(api);

    // ขั้นที่ 4: ตรวจว่า API อ่านลีดของนายหน้าได้ ด้วยคำขอแบบอ่านอย่างเดียว
    const headers = { Authorization: `Bearer ${qaDevToken(agent)}` };
    const leads = await api.get('agent/leads', { params: { limit: '1' }, headers });
    if (leads.status() >= 500) {
      throw new Error(
        `GET /agent/leads ตอบ ${leads.status()} (API ล้มระหว่างอ่านฐานข้อมูล)\n` +
          'สาเหตุที่พบบ่อย: ฐานข้อมูลยังไม่มีคอลัมน์ที่โค้ดของ API อ่าน ' +
          `(API รุ่น ${MIN_API_COMMIT} อ่านคอลัมน์ leads.booking_released_at)\n` +
          'ตรวจแบบอ่านอย่างเดียวด้วย npm run db:check -w @nestyk/api -- --check (migration ของทีมอยู่ที่ supabase/migrations/)\n' +
          'ห้ามรัน db:check ที่ไม่มี --check กับทุกฐานข้อมูล (ดู supabase/MIGRATION-RULES.md)\n' +
          'ถ้า API ต่อฐานข้อมูลของทีม ห้ามรัน db:push ทุกแบบ (รวม -- --check) และห้ามรัน SQL แก้ฐานข้อมูลเอง ให้แจ้งทีมให้ขึ้น migration\n' +
          'วิธีตรวจ: ดู log ของ API ว่ามี "column ... does not exist" หรือบรรทัด SchemaDrift หรือไม่ ถ้าไม่มี ให้ดู error อื่นใน log',
      );
    }
    if (leads.status() !== 200) {
      // ขั้นที่ 3 ยืนยันแล้วว่า qa-agent มีอยู่และมีบทบาท agent รหัสอื่นที่ไม่ใช่ 200 จึงไม่น่ามาจากบัญชี
      //   พิมพ์เนื้อคำตอบเฉพาะรหัส 4xx ขึ้นไป (เป็นข้อความ error) รหัสกลุ่ม 2xx หรือ 3xx อาจมีข้อมูลลีด จึงไม่พิมพ์
      const answer = leads.status() >= 400 ? (await leads.text()).slice(0, 200) : '(ไม่พิมพ์เนื้อคำตอบ)';
      throw new Error(
        `GET /agent/leads ด้วยบัญชี ${agent.email} ได้รหัส ${leads.status()} (คาด 200): ${answer}\n` +
          'บัญชีนี้ผ่านการตรวจบัญชีและบทบาทแล้ว ให้ดู log ของ API แล้วแจ้งทีมพร้อมผลรัน ' +
          '(ห้ามขอบทบาทเองด้วย POST /auth/dev/roles เพราะเส้นทางนั้นบันทึกบทบาทลงฐานข้อมูล)\n' +
          'ถ้าได้ 403 แปลว่ารายการบทบาทของกลุ่ม agent/leads เปลี่ยน (@Roles ใน agent-leads.controller.ts) ถ้าทีมไม่ได้ตั้งใจให้แจ้งทีม',
      );
    }

    // ขั้นที่ 5: ตรวจรุ่นของ API ด้วยคำขอแบบอ่านอย่างเดียว: ตั้งแต่ f7d52ed id ที่เกินช่วง integer ถูกปฏิเสธด้วย 400 ก่อนถึงฐานข้อมูล
    //   รุ่นก่อนหน้าตอบ 500 ถ้าไม่ตรวจตรงนี้ เทส id และ query หลายข้อจะแดงพร้อมกัน และดูเหมือนระบบถอยหลัง
    const probe = await api.get('agent/leads/2147483648', { headers });
    const probeText = await probe.text();
    if (probe.status() !== 400) {
      throw new Error(
        `API ที่ ${env.apiBaseUrl} น่าจะเก่ากว่ารุ่น ${MIN_API_COMMIT} ` +
          `(GET /agent/leads/2147483648 ได้รหัส ${probe.status()} แต่รุ่นนั้นต้องตอบ 400)\n` +
          `วิธีแก้: ใช้โค้ดของ develop ซึ่งมี ${MIN_API_COMMIT} แล้ว (ถ้ารันจาก qa/e2e โค้ดนอก e2e/ ต้องเหมือน develop) แล้วเปิด API ใหม่ ชุดเทสนี้เขียนตามพฤติกรรมของรุ่นนั้น`,
      );
    }
    if (!probeText.includes(ID_OUT_OF_RANGE)) {
      // ได้ 400 แต่ข้อความไม่ตรง: ทีมอาจเปลี่ยนข้อความของตัวตรวจ id เนื้อคำตอบเป็นข้อความ error ของ id ที่มีจริงไม่ได้ จึงพิมพ์ได้
      throw new Error(
        `ข้อความของตัวตรวจ id เปลี่ยนไปจากที่ชุดเทสคาด (ได้: ${probeText.slice(0, 200)})\n` +
          'วิธีแก้: ตรวจ apps/api/src/common/database-id.pipe.ts แล้วแก้ค่าคงที่ ID_OUT_OF_RANGE ในชุดเทสให้ตรง',
      );
    }
  } finally {
    await api.dispose();
  }
}

/** ข้อความของ RolesGuard เมื่อบัตรผ่านไม่ตรงกับผู้ใช้คนไหนในตาราง users (apps/api/src/auth/guards/roles.guard.ts) */
const NOT_LINKED = 'Call POST /auth/sync first';

/**
 * เส้นทางที่ใช้ยืนยันว่าบัญชีมีในตาราง users: เลือกเส้นทางอ่านอย่างเดียวที่บัญชีนั้น "ไม่มี" บทบาท แล้วต้องได้ 403 ข้อความตรงตัวเท่านั้น
 * ทำไมไม่รับ 200: AuthGuard ปล่อยบัตรผ่านของคนที่ไม่มีในฐานข้อมูลผ่านไป (auth.guard.ts canActivate) ถ้าวันหนึ่งเส้นทางนี้ไม่มี RolesGuard
 *   บัญชีที่ยังไม่ผูกจะได้ 200 แล้วขั้นต่อไป (sync) จะสร้างผู้ใช้ใหม่ ส่วน 403 มาได้จาก RolesGuard ซึ่งต้องเจอผู้ใช้แล้วเท่านั้น
 *   - บัญชีที่ไม่มี agent: GET /agent/leads/visa-types (agent-leads.controller.ts @Roles('agent'))
 *   - qa-agent: GET /contracts/mine (party-contracts.controller.ts @Roles('tenant', 'landlord') ; listForUser อ่านอย่างเดียว)
 */
function existenceProbe(account: QaAccount): { path: string; forbidden: string } {
  return account.roles.includes('agent')
    ? { path: 'contracts/mine', forbidden: 'Required role: tenant | landlord' }
    : { path: 'agent/leads/visa-types', forbidden: 'Required role: agent' };
}

/**
 * ตรวจบัญชี QA แยกบทบาท (src/config/qa-accounts.ts) ทุกบัญชีที่ตั้ง uuid ไว้ ก่อนเริ่มเทส
 *
 * ทำไมต้องตรวจ: ถ้า uuid ผิดบัญชี หรือบัญชียังไม่ถูกผูกกับตาราง users เทส 403 จะแดงหลายสิบข้อพร้อมกัน
 * หรือแย่กว่านั้นคือผ่านทั้งที่ทดสอบผิดบัญชี ตรวจตรงนี้จะได้ข้อความเดียวที่บอกสาเหตุ
 *
 * ลำดับการตรวจของแต่ละบัญชี (ห้ามสลับ):
 *   1. เรียกเส้นทางอ่านอย่างเดียวที่บัญชีไม่มีบทบาท (existenceProbe) ต้องได้ 403 ข้อความตรงตัว จึงถือว่าบัญชีมีในตาราง users แล้ว
 *      ถ้ายังไม่มี RolesGuard ตอบ 401 "Call POST /auth/sync first" ก่อนถึง handler (AuthGuard อ่านตาราง users แล้วไม่พบ)
 *   2. เมื่อยืนยันแล้วเท่านั้น จึงเรียก POST /auth/sync เพื่ออ่านอีเมลและบทบาท
 *      sync ของบัญชีที่มีอยู่แล้วไม่บันทึกอะไร (auth.service.ts sync: สร้างผู้ใช้เฉพาะเมื่อหา supabase_user_id ไม่เจอ)
 *      ห้ามเรียก sync ก่อนข้อ 1 เพราะถ้าบัญชียังไม่มี sync จะสร้างผู้ใช้ใหม่ในฐานข้อมูลทันที (กฎข้อ ง.9)
 */
async function checkQaAccounts(api: APIRequestContext): Promise<void> {
  const malformed = malformedQaUuidVariables();
  if (malformed.length > 0) {
    throw new Error(
      `ค่าใน ${malformed.join(', ')} ไม่ใช่ uuid (รูปแบบ xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)\n` +
        'วิธีแก้: คัดลอก UID ของบัญชีจาก Supabase > Authentication > Users ใหม่ทั้งค่า',
    );
  }

  const configured = QA_ROLES.map((role) => qaAccounts[role]).filter((account) => account.uuid !== null);
  const uuids = configured.map((account) => account.uuid!.toLowerCase());
  // รวมทุกตัวแปรที่ใช้ uuid เดียวกัน (ทั้งตัวแรกและตัวที่ซ้ำ) เพราะไม่รู้ว่าตัวไหนคัดลอกผิด
  const duplicated = configured.filter((account) => uuids.filter((uuid) => uuid === account.uuid!.toLowerCase()).length > 1);
  if (duplicated.length > 0) {
    throw new Error(
      `${duplicated.map((account) => account.uuidVariable).join(', ')} ใช้ uuid ซ้ำกัน\n` +
        'วิธีแก้: แต่ละบทบาทต้องใช้ UID ของบัญชีตัวเอง (qa-<บทบาท>@...) ตรวจการคัดลอกอีกครั้ง',
    );
  }

  for (const account of configured) {
    await checkQaAccount(api, account);
  }

  // บรรทัดสรุปในผลรัน ไม่พิมพ์ uuid
  const missing = QA_ROLES.filter((role) => qaAccounts[role].uuid === null);
  console.log(
    `[บัญชี QA] ตรวจแล้ว ${configured.length} จาก ${QA_ROLES.length} บัญชี` +
      (configured.length > 0 ? `: ${configured.map((account) => account.role).join(', ')}` : '') +
      (missing.length > 0 ? ` | ไม่ได้ตั้ง uuid (เทสที่ใช้บัญชีนี้จะข้าม): ${missing.join(', ')}` : ''),
  );
}

async function checkQaAccount(api: APIRequestContext, account: QaAccount): Promise<void> {
  const headers = { Authorization: `Bearer ${qaDevToken(account)}` };

  // ขั้นที่ 1: ยืนยันว่าบัญชีมีในตาราง users แล้ว ด้วยคำขอแบบอ่านอย่างเดียว
  const { path, forbidden } = existenceProbe(account);
  const probe = await api.get(path, { headers });
  const probeText = await probe.text();
  if (probe.status() === 401 && probeText.includes(NOT_LINKED)) {
    throw new Error(
      `บัญชี ${account.email} (${account.uuidVariable}) ยังไม่มีในตาราง users ของฐานข้อมูลที่ API ใช้\n` +
        'สาเหตุที่เป็นไปได้: (1) uuid ที่ตั้งไม่ใช่ UID ของบัญชีนี้ ' +
        '(2) ทีมยังไม่ได้ขึ้น migration 20261019100000_link_qa_accounts.sql หรือสร้างล็อกอินหลังจาก migration นั้นรันไปแล้ว ' +
        '(หัวไฟล์ migration บอกวิธีให้ทีมผูกบัญชีที่สร้างทีหลัง)\n' +
        'ห้ามเรียก POST /auth/sync ด้วยบัญชีนี้ แม้ API จะบอกให้เรียก เพราะจะสร้างผู้ใช้ใหม่ในฐานข้อมูล ให้แจ้งทีม',
    );
  }
  if (probe.status() === 401) {
    // 401 ที่ไม่ใช่ข้อความข้างบนมาจาก AuthGuard ก่อนค้นตาราง users: API ไม่ได้อ่านบัตรผ่านนี้เป็นแบบนักพัฒนา
    //   (auth.guard.ts resolveIdentity: ถ้า ALLOW_DEV_AUTH ไม่ใช่ true บัตรผ่าน dev|... ถูกส่งไปตรวจกับ Supabase แล้วได้ 401)
    throw new Error(
      `API ไม่รับบัตรผ่านแบบนักพัฒนาของบัญชี ${account.email} (GET /${path} ได้รหัส 401: ${probeText.slice(0, 200)})\n` +
        'วิธีแก้: ตรวจว่า .env.api ตั้ง ALLOW_DEV_AUTH=true แล้วเปิด API ใหม่',
    );
  }
  if (probe.status() === 200) {
    // ไม่พิมพ์เนื้อคำตอบ เพราะเป็นข้อมูลของระบบ และไม่เรียก sync ต่อ (ยืนยันไม่ได้ว่าบัญชีมีอยู่)
    throw new Error(
      `บัญชี ${account.email} เรียก GET /${path} ได้ (200) แต่บทบาทตาม migration ต้องได้ 403\n` +
        'สาเหตุที่เป็นไปได้ (ตรวจตามลำดับ): (1) uuid ที่ตั้งเป็นของบัญชีอื่น ให้คัดลอก UID จากแถวของอีเมลนี้ใหม่ ' +
        '(2) บัญชีมีบทบาทเกินจาก migration (3) เส้นทางนี้เลิกกันสิทธิ์แล้ว ข้อ 2 และ 3 ให้แจ้งทีม\n' +
        'ชุดเทสหยุดก่อนเรียก POST /auth/sync',
    );
  }
  if (probe.status() !== 403 || !probeText.includes(`"${forbidden}"`)) {
    throw new Error(
      `ตรวจบัญชี ${account.email} ไม่ได้: GET /${path} ได้รหัส ${probe.status()} ` +
        `(คาด 403 "${forbidden}") คำตอบ: ${probeText.slice(0, 200)}\n` +
        'ถ้าได้ 403 แต่ข้อความต่าง แปลว่ารายการบทบาทของเส้นทางนี้เปลี่ยน ถ้าทีมไม่ได้ตั้งใจถือเป็นช่องโหว่เรื่องสิทธิ์ ให้แจ้งทีม ' +
        '(ถ้าตั้งใจ ต้องแก้ existenceProbe และ roles.spec.ts ให้ตรง) ' +
        'ถ้าข้อความมีชื่อบทบาท owner แปลว่า API เป็นโค้ดก่อน develop 84087e2 ให้ใช้โค้ดของ develop แล้วเปิด API ใหม่',
    );
  }

  // ขั้นที่ 2: บัญชีมีอยู่แล้ว จึงเรียก sync ได้โดยไม่สร้างข้อมูล แล้วเทียบอีเมลกับบทบาทกับที่ migration กำหนด
  const sync = await api.post('auth/sync', { headers });
  const syncText = await sync.text();
  if (sync.status() !== 201) {
    throw new Error(`POST /auth/sync ของบัญชี ${account.email} ได้รหัส ${sync.status()} (คาด 201) คำตอบ: ${syncText.slice(0, 200)}`);
  }
  const user = JSON.parse(syncText) as { email: string; roles: string[]; provisioned: boolean };
  if (user.provisioned) {
    // ไม่ควรเกิด เพราะขั้นที่ 1 ยืนยันแล้วว่าบัญชีมีอยู่ ถ้าเกิดแปลว่ามีผู้ใช้ใหม่ถูกสร้าง ต้องแจ้งทีม
    throw new Error(
      `POST /auth/sync สร้างผู้ใช้ใหม่ให้ ${account.uuidVariable} (provisioned = true) ทั้งที่ขั้นตรวจก่อนหน้ายืนยันว่ามีบัญชีแล้ว\n` +
        'ให้แจ้งทีมพร้อมเวลาที่รัน เพื่อตรวจและลบแถวที่ถูกสร้าง',
    );
  }
  if (user.email.toLowerCase() !== account.email) {
    // ไม่พิมพ์อีเมลของบัญชีที่ได้ เพราะอาจเป็นบัญชีของคนจริง
    throw new Error(
      `${account.uuidVariable} เป็น uuid ของบัญชีอื่น ไม่ใช่ ${account.email}\n` +
        'วิธีแก้: คัดลอก UID จากแถวของอีเมลนี้ใน Supabase > Authentication > Users ' +
        '(ถ้าตั้ง E2E_QA_EMAIL_DOMAIN ไว้ ให้ตรวจว่าโดเมนตรงกับบัญชีของทีมด้วย)',
    );
  }
  const actual = [...user.roles].sort();
  const expected = [...account.roles].sort();
  if (actual.join(',') !== expected.join(',')) {
    throw new Error(
      `บัญชี ${account.email} มีบทบาท ${actual.join(', ') || '(ไม่มี)'} แต่ชุดเทสคาด ${expected.join(', ')} ` +
        '(ตาม migration 20261019100000_link_qa_accounts.sql)\n' +
        'เทส 403 ต้องใช้บัญชีที่บทบาทตรงตามนี้ ถ้ามีบทบาทเกินหรือขาด ให้แจ้งทีม (ห้ามขอบทบาทเองด้วย POST /auth/dev/roles)',
    );
  }
}
