import { test as base, expect, type APIRequestContext } from '@playwright/test';
import { ApiClient } from '../api/api-client';
import { AuthApi } from '../api/auth.api';
import { BillsApi } from '../api/bills.api';
import { ContractsApi } from '../api/contracts.api';
import { HealthApi } from '../api/health.api';
import { LeadsApi } from '../api/leads.api';
import { ListingsApi } from '../api/listings.api';
import { PartyContractsApi, RetiredContractSignApi } from '../api/party-contracts.api';
import { PlacesApi } from '../api/places.api';
import { TenantsApi } from '../api/tenants.api';
import { env } from '../config/env';
import { qaAccounts, qaDevToken, qaSkipReason, type QaRole } from '../config/qa-accounts';

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
  /** เส้นทางลิงก์ลงนามแบบไม่ต้องล็อกอินที่ทีมลบแล้ว (ใช้ตรวจว่าเปิดไม่ได้แล้วเท่านั้น) */
  retiredContractSign: RetiredContractSignApi;
  /** บิลค่าเช่าและสลิป (ผู้เช่า เจ้าของห้อง นายหน้า) */
  bills: BillsApi;
  /** ค้นสถานที่ (เรียกด้วยบทบาทที่ไม่ใช่ agent เท่านั้น ดู places.api.ts) */
  places: PlacesApi;
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
    retiredContractSign: new RetiredContractSignApi(client),
    bills: new BillsApi(client),
    places: new PlacesApi(client),
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
  /**
   * นายหน้าที่ล็อกอินแล้ว ด้วยบัญชี qa-agent (ดู src/config/qa-accounts.ts) บัญชีเดียวกับ qa('agent')
   * global-setup หยุดทั้งชุดถ้าไม่ได้ตั้ง uuid ของบัญชีนี้ fixture นี้จึงไม่ข้ามเทส
   */
  agent: ApiSession;
  /**
   * ผู้เรียกที่ล็อกอินด้วยบัญชี QA ของบทบาทที่ระบุ (ดู src/config/qa-accounts.ts)
   * ถ้ายังไม่ได้ตั้ง uuid ของบัญชีนั้น เทสข้อนั้นจะข้ามพร้อมเหตุผล (เรียกได้ทุกที่ในตัวเทส)
   * global-setup ตรวจแล้วว่าทุกบัญชีที่ตั้ง uuid มีในฐานข้อมูลและบทบาทตรงกับ migration
   */
  qa: (role: QaRole) => Promise<ApiSession>;
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
    // qaDevToken โยน error ที่บอกชื่อตัวแปรถ้ายังไม่ได้ตั้ง uuid (ปกติไม่ถึงจุดนี้ เพราะ global-setup หยุดก่อน)
    await use(await apiAs(`Bearer ${qaDevToken(qaAccounts.agent)}`));
  },

  qa: async ({ apiAs }, use, testInfo) => {
    await use(async (role) => {
      const account = qaAccounts[role];
      // ข้ามเทสข้อนี้ทันทีถ้ายังไม่ได้ตั้ง uuid (testInfo.skip หยุดเทสที่จุดนี้)
      testInfo.skip(account.uuid === null, qaSkipReason(account));
      return apiAs(`Bearer ${qaDevToken(account)}`);
    });
  },
});

export { expect };
