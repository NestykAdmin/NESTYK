import { test as base, expect } from '@playwright/test';
import { ApiClient } from '../api/api-client';
import { LeadsApi } from '../api/leads.api';
import { LeadsWriteApi } from '../api/leads-write.api';
import { ListingsApi } from '../api/listings.api';
import { env } from '../config/env';
import { qaAccounts, qaDevToken } from '../config/qa-accounts';
import { assertWriteSetupDone } from './write-guard';

/**
 * fixture ของเทสที่เขียนข้อมูล ต่อจาก @playwright/test ตรง ๆ (ไม่ใช่ src/fixtures/api.fixture.ts)
 * เทสใน tests/write จึงมีแค่ผู้เรียก writer ไม่มี agent, qa หรือ apiAs ที่ข้ามตัวกันได้
 *   writer = ผู้เรียกที่ล็อกอินด้วย qa-agent ใช้ได้ทั้งใน beforeAll, afterAll และตัวเทส (ขอบเขต worker)
 *   ตรวจตัวกันก่อนสร้างผู้เรียก ถ้าไม่ผ่าน เทสหยุดก่อนส่งคำขอ
 */

/** ตัวเรียกที่เทสเขียนข้อมูลใช้: อ่านลีด อ่านห้อง และเส้นทางที่เขียนลีด */
export interface WriterSession {
  leads: LeadsApi;
  listings: ListingsApi;
  leadsWrite: LeadsWriteApi;
}

interface WriteWorkerFixtures {
  writer: WriterSession;
  /** รหัสรอบที่ write-global-setup ตั้ง */
  runId: string;
}

export const test = base.extend<object, WriteWorkerFixtures>({
  runId: [
    async ({}, use) => {
      await use(assertWriteSetupDone());
    },
    { scope: 'worker' },
  ],

  writer: [
    async ({ playwright, runId }, use) => {
      // ขอ runId ไว้เพื่อให้ตัวกันทำงานก่อนสร้างผู้เรียกเสมอ
      void runId;
      // baseURL ต้องปิดท้ายด้วย / (ดู relativePath ใน api-client.ts)
      const context = await playwright.request.newContext({
        baseURL: `${env.apiBaseUrl}/`,
        extraHTTPHeaders: { Accept: 'application/json', Authorization: `Bearer ${qaDevToken(qaAccounts.agent)}` },
      });
      const client = new ApiClient(context);
      await use({ leads: new LeadsApi(client), listings: new ListingsApi(client), leadsWrite: new LeadsWriteApi(client) });
      await context.dispose();
    },
    { scope: 'worker' },
  ],
});

export { expect };
