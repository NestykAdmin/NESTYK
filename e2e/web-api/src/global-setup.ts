import { request } from '@playwright/test';
import { devToken, env } from './config/env';

/**
 * ทำงาน 1 ครั้งก่อนเริ่มเทสทั้งชุด: ตรวจว่าระบบพร้อมให้เทส
 *
 * ทำไมต้องมี: ถ้า API ไม่ได้เปิด หรือโหมดล็อกอินแบบนักพัฒนาปิดอยู่ เทสทุกข้อจะล้มด้วยข้อความที่อ่านยาก
 * ตรวจตรงนี้ก่อนจะได้ข้อความเดียวที่บอกสาเหตุและวิธีแก้
 */
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
    if (leads.status() !== 200) {
      const answer = (await leads.text()).slice(0, 200);
      throw new Error(
        `ล็อกอินแบบนักพัฒนาด้วยบัญชี ${env.devUser.email} ไม่สำเร็จ (ได้รหัส ${leads.status()}: ${answer})\n` +
          'วิธีแก้: ตรวจว่า .env.api ตั้ง ALLOW_DEV_AUTH=true และฐานข้อมูลมีบัญชีตัวอย่างแล้ว (seed-dev-user.sql)',
      );
    }
  } finally {
    await api.dispose();
  }
}
