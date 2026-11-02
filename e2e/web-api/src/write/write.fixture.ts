import { test as base, expect, type APIRequestContext, type PlaywrightWorkerArgs } from '@playwright/test';
import { ApiClient } from '../api/api-client';
import { LeadsApi } from '../api/leads.api';
import { LeadsWriteApi } from '../api/leads-write.api';
import { LifecycleAgentApi, LifecyclePartyApi } from '../api/lifecycle-write.api';
import { ListingsApi } from '../api/listings.api';
import { env } from '../config/env';
import { qaAccounts, qaDevToken, type QaAccount } from '../config/qa-accounts';
import { assertEnvFileStorageIsLocal, assertWriteSetupDone } from './write-guard';

/**
 * fixture ของเทสที่เขียนข้อมูล ต่อจาก @playwright/test ตรง ๆ (ไม่ใช่ src/fixtures/api.fixture.ts)
 * เทสใน tests/write จึงมีแค่ผู้เรียกที่ประกาศในไฟล์นี้ ไม่มี agent, qa หรือ apiAs ที่ข้ามตัวกันได้
 *   writer    = ผู้เรียกที่ล็อกอินด้วย qa-agent (เทสลีด) ใช้ได้ทั้งใน beforeAll, afterAll และตัวเทส (ขอบเขต worker)
 *   lifecycle = ผู้เรียก 3 บทบาทของเทสวงจรเช่าห้อง: qa-agent, qa-tenant และ qa-landlord (ขอบเขต worker)
 *               qa-tenant กับ qa-landlord ต้องตั้ง E2E_QA_TENANT_UUID กับ E2E_QA_LANDLORD_UUID (เทสข้ามก่อนถึง fixture ถ้าไม่ได้ตั้ง)
 *               และตรวจ SUPABASE_URL ใน .env.api ก่อนสร้างผู้เรียก (assertEnvFileStorageIsLocal)
 *   ตรวจตัวกันก่อนสร้างผู้เรียกทุกตัว ถ้าไม่ผ่าน เทสหยุดก่อนส่งคำขอ
 */

/** ตัวเรียกที่เทสเขียนข้อมูลใช้: อ่านลีด อ่านห้อง และเส้นทางที่เขียนลีด */
export interface WriterSession {
  leads: LeadsApi;
  listings: ListingsApi;
  leadsWrite: LeadsWriteApi;
}

/** ผู้เรียก 3 บทบาทของเทสวงจรเช่าห้อง (tests/write/rental-lifecycle.write.spec.ts) */
export interface LifecycleSession {
  agent: LifecycleAgentApi;
  tenant: LifecyclePartyApi;
  landlord: LifecyclePartyApi;
}

interface WriteWorkerFixtures {
  writer: WriterSession;
  lifecycle: LifecycleSession;
  /** รหัสรอบที่ write-global-setup ตั้ง */
  runId: string;
}

/** สร้างตัวส่งคำขอด้วยบัตรผ่านของบัญชี QA 1 บัญชี baseURL ต้องปิดท้ายด้วย / (ดู relativePath ใน api-client.ts) */
function contextFor(playwright: PlaywrightWorkerArgs['playwright'], token: string): Promise<APIRequestContext> {
  return playwright.request.newContext({
    baseURL: `${env.apiBaseUrl}/`,
    extraHTTPHeaders: { Accept: 'application/json', Authorization: `Bearer ${token}` },
  });
}

function tokenOf(account: QaAccount): string {
  return qaDevToken(account);
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
      const context = await contextFor(playwright, tokenOf(qaAccounts.agent));
      const client = new ApiClient(context);
      await use({ leads: new LeadsApi(client), listings: new ListingsApi(client), leadsWrite: new LeadsWriteApi(client) });
      await context.dispose();
    },
    { scope: 'worker' },
  ],

  lifecycle: [
    async ({ playwright, runId }, use) => {
      void runId;
      // เทสนี้อัปโหลดไฟล์ ระหว่างที่ทีมยังไม่ตกลง ที่เก็บไฟล์ต้องอยู่เครื่องนี้ด้วย (ตรวจก่อนสร้างผู้เรียก)
      assertEnvFileStorageIsLocal();
      // qaDevToken หยุดพร้อมชื่อตัวแปรถ้ายังไม่ได้ตั้ง uuid ของบัญชีนั้น จึงอ่านบัตรผ่านครบทั้ง 3 ก่อนสร้างตัวส่งคำขอ
      const tokens = [tokenOf(qaAccounts.agent), tokenOf(qaAccounts.tenant), tokenOf(qaAccounts.landlord)];
      const contexts = await Promise.all(tokens.map((token) => contextFor(playwright, token)));
      const [agent, tenant, landlord] = contexts.map((context) => new ApiClient(context));
      await use({ agent: new LifecycleAgentApi(agent), tenant: new LifecyclePartyApi(tenant), landlord: new LifecyclePartyApi(landlord) });
      for (const context of contexts) await context.dispose();
    },
    { scope: 'worker' },
  ],
});

export { expect };
