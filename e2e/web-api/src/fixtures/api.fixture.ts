import { test as base, expect, type APIRequestContext } from '@playwright/test';
import { ApiClient } from '../api/api-client';
import { AuthApi } from '../api/auth.api';
import { BillsApi } from '../api/bills.api';
import { ContractsApi } from '../api/contracts.api';
import { HealthApi } from '../api/health.api';
import { LeadsApi } from '../api/leads.api';
import { ListingsApi } from '../api/listings.api';
import { PartyContractsApi, PublicContractSignApi } from '../api/party-contracts.api';
import { TenantsApi } from '../api/tenants.api';
import { devToken, env } from '../config/env';

/** ชุดตัวเรียก API ของผู้เรียก 1 คน แยกตามเรื่อง */
export interface ApiSession {
  /** ตัวส่งคำขอพื้นฐาน สำหรับเส้นทางที่ยังไม่มีตัวเรียกเฉพาะเรื่อง หรือคำขอที่ตั้งใจส่งผิดรูปแบบ */
  client: ApiClient;
  health: HealthApi;
  auth: AuthApi;
  listings: ListingsApi;
  leads: LeadsApi;
  tenants: TenantsApi;
  contracts: ContractsApi;
  /** สัญญาในฐานะคู่สัญญา (ผู้เช่าหรือเจ้าของห้อง) */
  partyContracts: PartyContractsApi;
  /** ลิงก์ลงนามที่เปิดได้โดยไม่ต้องล็อกอิน */
  publicContractSign: PublicContractSignApi;
  /** บิลค่าเช่าและสลิป (ผู้เช่า เจ้าของห้อง นายหน้า) */
  bills: BillsApi;
}

function createSession(request: APIRequestContext): ApiSession {
  const client = new ApiClient(request);
  return {
    client,
    health: new HealthApi(client),
    auth: new AuthApi(client),
    listings: new ListingsApi(client),
    leads: new LeadsApi(client),
    tenants: new TenantsApi(client),
    contracts: new ContractsApi(client),
    partyContracts: new PartyContractsApi(client),
    publicContractSign: new PublicContractSignApi(client),
    bills: new BillsApi(client),
  };
}

/**
 * fixture = ของที่ Playwright เตรียมให้ก่อนเริ่มเทสแต่ละข้อ และเก็บกวาดให้หลังเทสจบ
 * เทสขอใช้ได้โดยใส่ชื่อไว้ในวงเล็บปีกกาของฟังก์ชันเทส เช่น  async ({ agent }) => { ... }
 */
interface ApiFixtures {
  /**
   * สร้างผู้เรียกที่ส่งหัวข้อ Authorization ตามค่าที่กำหนด (null = ไม่ส่งหัวข้อนี้เลย)
   * ใช้ทดสอบบัตรผ่านรูปแบบต่าง ๆ ที่ API ต้องปฏิเสธ
   */
  apiAs: (authorization: string | null) => Promise<ApiSession>;
  /** ผู้เรียกที่ไม่ได้ล็อกอิน */
  anonymous: ApiSession;
  /** นายหน้าที่ล็อกอินแล้ว ด้วยบัญชีตัวอย่างของทีม (ดู src/config/env.ts) */
  agent: ApiSession;
}

export const test = base.extend<ApiFixtures>({
  apiAs: async ({ playwright }, use) => {
    const contexts: APIRequestContext[] = [];
    await use(async (authorization) => {
      // baseURL ต้องปิดท้ายด้วย / เพื่อให้ path ที่ส่งมาถูกต่อท้าย /api/v1 (ดู relativePath ใน api-client.ts)
      const context = await playwright.request.newContext({
        baseURL: `${env.apiBaseUrl}/`,
        extraHTTPHeaders: {
          Accept: 'application/json',
          ...(authorization === null ? {} : { Authorization: authorization }),
        },
      });
      contexts.push(context);
      return createSession(context);
    });
    // หลังเทสจบ ปิดการเชื่อมต่อทุกตัวที่เทสข้อนั้นสร้างไว้
    await Promise.all(contexts.map((context) => context.dispose()));
  },

  anonymous: async ({ apiAs }, use) => {
    await use(await apiAs(null));
  },

  agent: async ({ apiAs }, use) => {
    await use(await apiAs(`Bearer ${devToken()}`));
  },
});

export { expect };
