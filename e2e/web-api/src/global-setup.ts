import { request } from '@playwright/test';
import { devToken, env } from './config/env';

/**
 * ทำงาน 1 ครั้งก่อนเริ่มเทสทั้งชุด: ตรวจว่าระบบพร้อมให้เทส
 *
 * ทำไมต้องมี: ถ้า API ไม่ได้เปิด โหมดล็อกอินแบบนักพัฒนาปิดอยู่ ฐานข้อมูลยังไม่รัน migration ล่าสุด หรือ API เป็นรุ่นเก่า
 * เทสหลายข้อจะล้มด้วยข้อความที่อ่านยาก ตรวจตรงนี้ก่อนจะได้ข้อความเดียวที่บอกสาเหตุและวิธีแก้
 */

/** รุ่นต่ำสุดของ API ที่ชุดเทสนี้เขียนไว้ (DEV/main) */
const MIN_API_COMMIT = 'f7d52ed';

/** ข้อความของตัวตรวจ id ที่เพิ่มใน f7d52ed (apps/api/src/common/database-id.pipe.ts) ใช้แยก API รุ่นนี้ออกจากรุ่นก่อน */
const ID_OUT_OF_RANGE = 'ID must be an integer between 1 and 2147483647';

export default async function globalSetup(): Promise<void> {
  const api = await request.newContext({ baseURL: `${env.apiBaseUrl}/` });
  try {
    const health = await api.get('health').catch((error: Error) => error);
    if (health instanceof Error || health.status() !== 200) {
      const detail = health instanceof Error ? health.message.split('\n')[0] : `ได้รหัส ${health.status()}`;
      throw new Error(
        `API ไม่ตอบที่ ${env.apiBaseUrl}/health (${detail})\n` +
          'วิธีแก้: เปิด Supabase ฐานข้อมูล และ API ในเครื่องก่อน แล้วรันเทสอีกครั้ง',
      );
    }

    // ตรวจการล็อกอินด้วยคำขอแบบอ่านอย่างเดียว (ไม่ใช้ POST /auth/sync เพราะเส้นทางนั้นสร้างผู้ใช้ใหม่ได้ถ้ายังไม่มี)
    const leads = await api.get('agent/leads', {
      params: { limit: '1' },
      headers: { Authorization: `Bearer ${devToken()}` },
    });
    if (leads.status() === 403) {
      throw new Error(
        `บัญชี ${env.devUser.email} ไม่มีบทบาท agent (ได้รหัส 403)\n` +
          'วิธีแก้: ใส่ข้อมูลตัวอย่างของทีมอีกครั้ง (seed-dev-user.sql) เทสชุดนี้เรียก API ในบทบาทนายหน้า',
      );
    }
    if (leads.status() >= 500) {
      throw new Error(
        `GET /agent/leads ตอบ ${leads.status()} (API ล้มระหว่างอ่านฐานข้อมูล)\n` +
          'สาเหตุที่พบบ่อย: ยังไม่รัน migration ของ apps/api ถึง 20261014-contract-closure.sql ' +
          `(API รุ่น ${MIN_API_COMMIT} อ่านคอลัมน์ leads.booking_released_at)\n` +
          'วิธีตรวจ: ดู log ของ API ว่ามี "column ... booking_released_at does not exist" หรือไม่ ถ้าไม่มี ให้ดู error อื่นใน log',
      );
    }
    if (leads.status() !== 200) {
      const answer = (await leads.text()).slice(0, 200);
      throw new Error(
        `ล็อกอินแบบนักพัฒนาด้วยบัญชี ${env.devUser.email} ไม่สำเร็จ (ได้รหัส ${leads.status()}: ${answer})\n` +
          'วิธีแก้: ตรวจว่า .env.api ตั้ง ALLOW_DEV_AUTH=true และฐานข้อมูลมีบัญชีตัวอย่างแล้ว (seed-dev-user.sql)',
      );
    }

    // ตรวจรุ่นของ API ด้วยคำขอแบบอ่านอย่างเดียว: ตั้งแต่ f7d52ed id ที่เกินช่วง integer ถูกปฏิเสธด้วย 400 ก่อนถึงฐานข้อมูล
    //   รุ่นก่อนหน้าตอบ 500 ถ้าไม่ตรวจตรงนี้ เทส id และ query หลายข้อจะแดงพร้อมกัน และดูเหมือนระบบถอยหลัง
    const probe = await api.get('agent/leads/2147483648', { headers: { Authorization: `Bearer ${devToken()}` } });
    const probeText = await probe.text();
    if (probe.status() !== 400) {
      throw new Error(
        `API ที่ ${env.apiBaseUrl} น่าจะเก่ากว่า DEV/main ${MIN_API_COMMIT} ` +
          `(GET /agent/leads/2147483648 ได้รหัส ${probe.status()} แต่รุ่นนั้นต้องตอบ 400)\n` +
          `วิธีแก้: รวม DEV/main ถึง ${MIN_API_COMMIT} แล้วเปิด API ใหม่ ชุดเทสนี้เขียนตามพฤติกรรมของรุ่นนั้น`,
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
