import { test as base, expect, type APIRequestContext, type PlaywrightWorkerArgs } from '@playwright/test';
import { ApiClient } from '../api/api-client';
import { AuthApi } from '../api/auth.api';
import { LeadsApi } from '../api/leads.api';
import { LeadsWriteApi } from '../api/leads-write.api';
import { LifecycleAgentApi, LifecyclePartyApi } from '../api/lifecycle-write.api';
import { BillsApi } from '../api/bills.api';
import { ContractsApi } from '../api/contracts.api';
import { LeadMatchingApi } from '../api/lead-matching.api';
import { ListingsApi } from '../api/listings.api';
import { AgentRoomsApi } from '../api/rooms.api';
import { PublicRoomShareApi, RoomShareLinksApi } from '../api/share-links.api';
import { TenantsApi } from '../api/tenants.api';
import { LeadViewingsApi } from '../api/viewings.api';
import { env } from '../config/env';
import { qaAccounts, qaAgent2, qaDevToken, qaE2eLandlord, qaE2eTenant, type QaAccount } from '../config/qa-accounts';
import { assertEnvFileStorageIsLocal, assertWriteSetupDone } from './write-guard';

/**
 * fixture ของเทสที่เขียนข้อมูล ต่อจาก @playwright/test ตรง ๆ (ไม่ใช่ src/fixtures/api.fixture.ts)
 * เทสใน tests/write จึงมีแค่ผู้เรียกที่ประกาศในไฟล์นี้ ไม่มี agent, qa หรือ apiAs ที่ข้ามตัวกันได้
 *   writer    = ผู้เรียกที่ล็อกอินด้วย qa-agent (เทสลีด) ใช้ได้ทั้งใน beforeAll, afterAll และตัวเทส (ขอบเขต worker)
 *   crossAgent = qa-agent (owner) กับ qa-agent2 (intruder) ของเทสข้ามนายหน้า (ขอบเขต worker)
 *   agent2Auth = เส้นทาง /auth ของ qa-agent2 สำหรับเทสรูปโปรไฟล์ (ขอบเขต worker)
 *   shareWriter = qa-agent (ห้อง รายการห้อง ลิงก์แชร์) กับผู้เปิดหน้าแชร์สาธารณะที่ไม่ล็อกอิน สำหรับเทสลิงก์แชร์ห้อง (ขอบเขต worker)
 *   lifecycle = ผู้เรียก 3 บทบาทของเทสวงจรเช่าห้อง: qa-agent, qa-e2e-tenant และ qa-e2e-landlord (ขอบเขต worker)
 *               qa-e2e-tenant กับ qa-e2e-landlord ต้องตั้ง E2E_QA_E2E_TENANT_UUID กับ E2E_QA_E2E_LANDLORD_UUID (เทสข้ามก่อนถึง fixture ถ้าไม่ได้ตั้ง)
 *               และถ้า TEAM_DB_WRITES_AGREED เป็น false ตรวจ SUPABASE_URL ใน .env.api ก่อนสร้างผู้เรียก (assertEnvFileStorageIsLocal)
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

/** ตัวเรียกของนายหน้า 1 คนในเทสข้ามนายหน้า (tests/write/cross-agent.write.spec.ts) */
export interface CrossAgentApis {
  leads: LeadsApi;
  leadsWrite: LeadsWriteApi;
  viewings: LeadViewingsApi;
  matching: LeadMatchingApi;
  listings: ListingsApi;
  rooms: AgentRoomsApi;
  shareLinks: RoomShareLinksApi;
  tenants: TenantsApi;
  contracts: ContractsApi;
  bills: BillsApi;
  lifecycle: LifecycleAgentApi;
}

/** ผู้เรียกของเทสลิงก์แชร์ห้อง (tests/write/share-links.write.spec.ts) */
export interface ShareWriterSession {
  listings: ListingsApi;
  rooms: AgentRoomsApi;
  shareLinks: RoomShareLinksApi;
  /** เปิดหน้าแชร์สาธารณะโดยไม่ส่งบัตรผ่าน (คืนผลที่ไม่มี URL) */
  publicShares: PublicRoomShareApi;
}

/** owner = qa-agent (เจ้าของข้อมูล ใช้อ่านก่อนกับหลัง) ; intruder = qa-agent2 (ส่งคำขอที่ต้องถูกปฏิเสธ) */
export interface CrossAgentSession {
  owner: CrossAgentApis;
  intruder: CrossAgentApis;
}

function crossAgentApis(client: ApiClient): CrossAgentApis {
  return {
    leads: new LeadsApi(client),
    leadsWrite: new LeadsWriteApi(client),
    viewings: new LeadViewingsApi(client),
    matching: new LeadMatchingApi(client),
    listings: new ListingsApi(client),
    rooms: new AgentRoomsApi(client),
    shareLinks: new RoomShareLinksApi(client),
    tenants: new TenantsApi(client),
    contracts: new ContractsApi(client),
    bills: new BillsApi(client),
    lifecycle: new LifecycleAgentApi(client),
  };
}

interface WriteWorkerFixtures {
  writer: WriterSession;
  lifecycle: LifecycleSession;
  crossAgent: CrossAgentSession;
  agent2Auth: AuthApi;
  shareWriter: ShareWriterSession;
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
      // เทสนี้อัปโหลดไฟล์ ถ้าค่าคงที่เป็น false ต้องให้ที่เก็บไฟล์อยู่เครื่องนี้ (ตรวจก่อนสร้างผู้เรียก ตอนนี้ข้ามเพราะทีมตกลงแล้ว)
      assertEnvFileStorageIsLocal();
      // qaDevToken หยุดพร้อมชื่อตัวแปรถ้ายังไม่ได้ตั้ง uuid ของบัญชีนั้น จึงอ่านบัตรผ่านครบทั้ง 3 ก่อนสร้างตัวส่งคำขอ
      const tokens = [tokenOf(qaAccounts.agent), tokenOf(qaE2eTenant), tokenOf(qaE2eLandlord)];
      const contexts = await Promise.all(tokens.map((token) => contextFor(playwright, token)));
      const [agent, tenant, landlord] = contexts.map((context) => new ApiClient(context));
      await use({ agent: new LifecycleAgentApi(agent), tenant: new LifecyclePartyApi(tenant), landlord: new LifecyclePartyApi(landlord) });
      for (const context of contexts) await context.dispose();
    },
    { scope: 'worker' },
  ],

  crossAgent: [
    async ({ playwright, runId }, use) => {
      void runId;
      // เทสข้อนี้ข้ามก่อนถึง fixture ถ้ายังไม่ได้ตั้ง E2E_QA_AGENT2_UUID (ดู tests/write/cross-agent.write.spec.ts) qaDevToken จึงเป็นตาข่ายสำรอง
      const tokens = [tokenOf(qaAccounts.agent), tokenOf(qaAgent2)];
      const contexts = await Promise.all(tokens.map((token) => contextFor(playwright, token)));
      const [owner, intruder] = contexts.map((context) => crossAgentApis(new ApiClient(context)));
      await use({ owner, intruder });
      for (const context of contexts) await context.dispose();
    },
    { scope: 'worker' },
  ],

  agent2Auth: [
    async ({ playwright, runId }, use) => {
      void runId;
      // เทสรูปโปรไฟล์ข้ามก่อนถึง fixture ถ้ายังไม่ได้ตั้ง E2E_QA_AGENT2_UUID qaDevToken จึงเป็นตาข่ายสำรอง
      const context = await contextFor(playwright, tokenOf(qaAgent2));
      await use(new AuthApi(new ApiClient(context)));
      await context.dispose();
    },
    { scope: 'worker' },
  ],

  shareWriter: [
    async ({ playwright, runId }, use) => {
      void runId;
      const agentContext = await contextFor(playwright, tokenOf(qaAccounts.agent));
      const client = new ApiClient(agentContext);
      await use({
        listings: new ListingsApi(client),
        rooms: new AgentRoomsApi(client),
        shareLinks: new RoomShareLinksApi(client),
        // ผู้เปิดหน้าแชร์ไม่ส่งบัตรผ่าน (หน้าแชร์ไม่มี guard: room-share-links.controller.ts บรรทัด 48-58)
        publicShares: new PublicRoomShareApi(env.apiBaseUrl),
      });
      await agentContext.dispose();
    },
    { scope: 'worker' },
  ],
});

export { expect };
