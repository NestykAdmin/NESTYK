import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { env } from '../config/env';

/**
 * ตัวกันของเทสที่เขียนข้อมูลจริง (tests/write)
 *
 * เทสชุดนี้สร้างและแก้ข้อมูลในฐานข้อมูลที่ API ต่ออยู่ ด้วยบัญชี qa-agent (เทสลีด) และ qa-agent, qa-tenant, qa-landlord (เทสวงจรเช่าห้อง)
 * ตรวจก่อนส่งคำขอใด ๆ ไปที่ API (write-global-setup.ts เรียกเป็นอย่างแรก) ถ้าข้อไหนไม่ผ่านให้หยุด
 *   1. ผู้รันตั้ง E2E_ALLOW_WRITES=yes เอง (ตั้งใจรันเทสที่เขียนข้อมูล)
 *   2. ทีมยังไม่ตกลงเรื่องข้อมูล E2E- ในฐานข้อมูลของทีม (TEAM_DB_WRITES_AGREED = false):
 *      ผู้รันต้องตั้ง E2E_WRITE_TARGET=own-db เพื่อยืนยันว่า API ต่อฐานข้อมูลที่ QA เป็นเจ้าของ ไม่ใช่ของทีม
 *      และ DATABASE_URL ทุกบรรทัดในไฟล์ .env.api ที่รากของ repo ต้องชี้ไปที่เครื่องนี้ (assertEnvFileDatabaseIsLocal)
 *   3. API อยู่ในเครื่องที่รัน (localhost, 127.0.0.1 หรือ [::1])
 *   เทสที่อัปโหลดไฟล์ (วงจรเช่าห้อง) ตรวจเพิ่มใน fixture: SUPABASE_URL ทุกบรรทัดใน .env.api ต้องชี้เครื่องนี้ด้วย (assertEnvFileStorageIsLocal)
 * ข้อจำกัด: API อ่าน .env.api ที่รากของ repo ครั้งเดียวตอนเปิด (apps/api/src/main.ts บรรทัด 5-21 ที่ qa/e2e a7eb77c) ส่วนตัวกันอ่านไฟล์ตอนรันเทส
 *   ตัวกันจึงมองไม่เห็นค่าที่ API ใช้อยู่จริงในกรณีเหล่านี้: ตั้ง DATABASE_URL ใน Terminal ตอนเปิด API (dotenv ไม่ทับตัวแปรที่ตั้งไว้แล้ว),
 *   แก้ไฟล์แล้วไม่ได้เปิด API ใหม่, เปิด API จากสำเนาอื่นของ repo, หรือ localhost เป็นทางผ่าน (port forward, tunnel) ไปยังฐานข้อมูลของทีม
 *   ข้อ 2 จึงยังต้องพึ่งการยืนยันของผู้รันด้วย
 * ตาข่ายสำรอง (assertWriteSetupDone): fixture ของเทสต้องเห็นรหัสรอบที่ write-global-setup ตั้งหลังยืนยันบัญชี qa-agent
 */

/**
 * ทีมตกลงให้ QA เขียนข้อมูลที่ติดป้าย E2E- ลงฐานข้อมูลของทีมแล้วหรือยัง
 * ณ 30 ต.ค. 2026 ยังไม่ตกลง (คำขอยังไม่ได้ส่ง) และกฎกลาง ง.14 ของงาน QA ห้ามเทสเขียนข้อมูลเมื่อ API ต่อฐานข้อมูลของทีม
 * เปลี่ยนเป็น true ใน commit แยก หลังทีมตอบรับแล้วเท่านั้น พร้อมแก้ README หัวข้อข้อตกลงให้ตรง
 */
export const TEAM_DB_WRITES_AGREED: boolean = false;

/** ชื่อตัวแปรที่ผู้รันต้องตั้งเป็น yes */
export const WRITE_SWITCH = 'E2E_ALLOW_WRITES';

/** ชื่อตัวแปรที่ผู้รันตั้งเป็น own-db เพื่อยืนยันว่า API ไม่ได้ต่อฐานข้อมูลของทีม (ใช้ระหว่างที่ TEAM_DB_WRITES_AGREED = false) */
export const TARGET_VARIABLE = 'E2E_WRITE_TARGET';

/** ชื่อตัวแปรที่ write-global-setup ตั้งหลังยืนยันบัญชีแล้ว ค่าคือรหัสรอบ (ผู้รันไม่ต้องตั้งเอง) */
export const RUN_ID_VARIABLE = 'E2E_WRITE_RUN_ID';

/** ที่อยู่ที่ถือว่าเป็นเครื่องที่รัน (URL.hostname ของ IPv6 มีวงเล็บเหลี่ยม) */
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/** ไฟล์ .env.api ที่รากของ repo (ไฟล์นี้อยู่ที่ e2e/web-api/src/write/) */
const ROOT_ENV_API = resolve(__dirname, '../../../../.env.api');

/**
 * ข้อ 2 ส่วนที่โค้ดตรวจได้: ทุกบรรทัด DATABASE_URL ใน .env.api ที่รากของ repo ต้องเป็นที่อยู่ในเครื่องนี้
 * อ่านไฟล์โดยไม่พิมพ์ค่าใด ๆ ออกมา (ข้อความหยุดบอกแค่ว่าผิดข้อไหน) ไม่มีไฟล์ หรือไม่มี DATABASE_URL = หยุด เพราะตรวจไม่ได้
 */
export function assertEnvFileDatabaseIsLocal(path: string = ROOT_ENV_API): void {
  if (!existsSync(path)) {
    throw new Error(`หยุดก่อนเรียก API: ไม่พบ .env.api ที่รากของ repo จึงตรวจไม่ได้ว่า API ต่อฐานข้อมูลไหน (${path})`);
  }
  // dotenv 16 (รุ่นใน package-lock ของ repo ที่ a7eb77c) รับทั้ง KEY=value และ KEY: value จึงอ่านทั้ง 2 แบบ
  const values = readFileSync(path, 'utf8')
    .split(/\r?\n/)
    .map((line) => /^\s*(?:export\s+)?DATABASE_URL\s*(?:=|:\s)\s*(.*)$/.exec(line)?.[1])
    .filter((value): value is string => value !== undefined)
    .map((value) => value.trim().replace(/^(['"])(.*)\1$/, '$2'));
  if (values.length === 0) {
    throw new Error('หยุดก่อนเรียก API: .env.api ที่รากของ repo ไม่มี DATABASE_URL จึงตรวจไม่ได้ว่า API ต่อฐานข้อมูลไหน');
  }
  for (const value of values) {
    let host: string;
    let hostInQuery: boolean;
    try {
      const url = new URL(value);
      host = url.hostname.toLowerCase();
      // ตัวต่อ PostgreSQL (pg-connection-string) ให้ ?host= ทับ host ในส่วนต้นของ URL
      hostInQuery = url.searchParams.has('host') || url.searchParams.has('hostaddr');
    } catch {
      throw new Error('หยุดก่อนเรียก API: อ่าน DATABASE_URL ใน .env.api ที่รากของ repo ไม่ได้ (ไม่พิมพ์ค่า)');
    }
    if (hostInQuery) {
      throw new Error('หยุดก่อนเรียก API: DATABASE_URL ใน .env.api ที่รากของ repo มี host ในส่วน ?host= หรือ ?hostaddr= ตัวกันตรวจแบบนี้ไม่ได้ (ไม่พิมพ์ค่า)');
    }
    if (!LOCAL_HOSTS.has(host)) {
      throw new Error(
        'หยุดก่อนเรียก API: DATABASE_URL ใน .env.api ที่รากของ repo ไม่ได้ชี้ไปที่เครื่องนี้ (ไม่พิมพ์ค่า) ' +
          'จึงน่าจะเป็นฐานข้อมูลของทีม ทีมยังไม่ได้ตกลงให้เทสเขียนข้อมูลลงฐานข้อมูลของทีม',
      );
    }
  }
}

/**
 * ส่วนของเทสที่อัปโหลดไฟล์: ระหว่างที่ TEAM_DB_WRITES_AGREED = false ทุกบรรทัด SUPABASE_URL ใน .env.api ที่รากของ repo ต้องชี้เครื่องนี้
 * เหตุผล: API เขียนไฟล์ลงที่เก็บไฟล์ที่ SUPABASE_URL ชี้ (apps/api/src/agent/contracts/contract-document-storage.service.ts
 * storage() บรรทัด 65-74 ที่ develop bc77a8b) ถ้าเปลี่ยนแค่ DATABASE_URL เป็นฐานข้อมูลในเครื่อง ไฟล์ของทุกรอบจะไปอยู่ใน Storage ของทีม
 * ไม่มีไฟล์หรือไม่มี SUPABASE_URL = หยุด เพราะตรวจไม่ได้ ข้อความหยุดไม่พิมพ์ค่า ข้อจำกัดเดียวกับ DATABASE_URL (ค่าที่ตั้งใน Terminal ตอนเปิด API ตัวกันไม่เห็น)
 */
export function assertEnvFileStorageIsLocal(path: string = ROOT_ENV_API): void {
  if (TEAM_DB_WRITES_AGREED) return;
  if (!existsSync(path)) {
    throw new Error(`หยุดก่อนเรียก API: ไม่พบ .env.api ที่รากของ repo จึงตรวจไม่ได้ว่า API เขียนไฟล์ลงที่เก็บไฟล์ไหน (${path})`);
  }
  const values = readFileSync(path, 'utf8')
    .split(/\r?\n/)
    .map((line) => /^\s*(?:export\s+)?SUPABASE_URL\s*(?:=|:\s)\s*(.*)$/.exec(line)?.[1])
    .filter((value): value is string => value !== undefined)
    .map((value) => value.trim().replace(/^(['"])(.*)\1$/, '$2'));
  if (values.length === 0) {
    throw new Error('หยุดก่อนเรียก API: .env.api ที่รากของ repo ไม่มี SUPABASE_URL จึงตรวจไม่ได้ว่า API เขียนไฟล์ลงที่เก็บไฟล์ไหน');
  }
  for (const value of values) {
    let host: string;
    try {
      host = new URL(value).hostname.toLowerCase();
    } catch {
      throw new Error('หยุดก่อนเรียก API: อ่าน SUPABASE_URL ใน .env.api ที่รากของ repo ไม่ได้ (ไม่พิมพ์ค่า)');
    }
    if (!LOCAL_HOSTS.has(host)) {
      throw new Error(
        'หยุดก่อนเรียก API: SUPABASE_URL ใน .env.api ที่รากของ repo ไม่ได้ชี้ไปที่เครื่องนี้ (ไม่พิมพ์ค่า) ' +
          'เทสวงจรเช่าห้องจะอัปโหลดไฟล์ลงที่เก็บไฟล์ของทีม ซึ่งทีมยังไม่ได้ตกลง',
      );
    }
  }
}

/** ข้อ 1 ถึง 3: เรียกก่อนส่งคำขอแรกไปที่ API (รวมคำขอของ global-setup) */
export function assertWriteEnvironment(): void {
  if (process.env[WRITE_SWITCH] !== 'yes') {
    throw new Error(
      `หยุดก่อนเรียก API: ยังไม่ได้ตั้ง ${WRITE_SWITCH}=yes\n` +
        'เทสชุด tests/write สร้างและแก้ข้อมูลจริงในฐานข้อมูลที่ API ต่ออยู่ ให้ตั้งตัวแปรนี้เองเมื่อตั้งใจรันเท่านั้น (ดู README หัวข้อเทสที่เขียนข้อมูล)',
    );
  }
  if (!TEAM_DB_WRITES_AGREED && process.env[TARGET_VARIABLE] !== 'own-db') {
    throw new Error(
      `หยุดก่อนเรียก API: ทีมยังไม่ได้ตกลงให้เทสเขียนข้อมูลลงฐานข้อมูลของทีม จึงต้องตั้ง ${TARGET_VARIABLE}=own-db\n` +
        'ตั้งได้เฉพาะเมื่อ API ต่อฐานข้อมูลที่ QA เป็นเจ้าของ (DATABASE_URL ใน .env.api ไม่ใช่ฐานข้อมูลของทีม) ถ้าไม่แน่ใจ ห้ามตั้ง',
    );
  }
  if (!TEAM_DB_WRITES_AGREED) assertEnvFileDatabaseIsLocal();
  let host: string;
  try {
    host = new URL(env.apiBaseUrl).hostname.toLowerCase();
  } catch {
    throw new Error(`หยุดก่อนเรียก API: อ่านที่อยู่ของ API ไม่ได้ (${env.apiBaseUrl})`);
  }
  if (!LOCAL_HOSTS.has(host)) {
    throw new Error(
      `หยุดก่อนเรียก API: เทสที่เขียนข้อมูลรันได้เฉพาะกับ API ในเครื่องที่รัน แต่ที่อยู่ของ API คือ ${env.apiBaseUrl}\n` +
        'ใช้ได้เฉพาะ localhost, 127.0.0.1 หรือ [::1]',
    );
  }
}

/** ตาข่ายสำรอง: เรียกใน fixture ก่อนสร้างผู้เรียกที่เขียนข้อมูล คืนรหัสรอบ */
export function assertWriteSetupDone(): string {
  assertWriteEnvironment();
  const runId = process.env[RUN_ID_VARIABLE];
  if (!runId) {
    throw new Error(
      'หยุดก่อนเรียก API: ไม่มีรหัสรอบจาก src/write/write-global-setup.ts (ยังไม่ได้ยืนยันบัญชี qa-agent)\n' +
        'เทสชุดนี้ต้องรันด้วย npm run test:write ซึ่งใช้ playwright.write.config.ts',
    );
  }
  return runId;
}

/** รหัสรอบ = วันเวลาที่เริ่มรันตามเวลาของเครื่อง เช่น 20261030-111502 ใช้ใส่ในข้อความที่เทสเขียน เพื่อรู้ว่ามาจากรอบไหน */
export function makeRunId(now: Date = new Date()): string {
  const two = (value: number) => String(value).padStart(2, '0');
  return (
    `${now.getFullYear()}${two(now.getMonth() + 1)}${two(now.getDate())}-` +
    `${two(now.getHours())}${two(now.getMinutes())}${two(now.getSeconds())}`
  );
}
