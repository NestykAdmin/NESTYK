import type { APIResponse } from '@playwright/test';
import type { ApiClient } from './api-client';

/**
 * เส้นทางกลุ่ม /agent/deal-offers ที่ยังไม่มีเทสก่อน 11 พ.ย. 2026 (ยกเลิกและแก้ข้อเสนอ)
 *
 * ทั้ง 2 เส้นทางบันทึกข้อมูล ตัวเรียกนี้มีไว้ส่งไปที่ข้อเสนอที่ไม่มีอยู่จริงเท่านั้น (tests/api/agent-contracts-gaps.spec.ts)
 * ถ้าส่งไปที่ข้อเสนอที่มีอยู่จริงของผู้เรียก และเนื้อคำขอผ่าน ระบบจะบันทึกทันที
 * ตัวเรียกของเส้นทางอื่นในกลุ่มนี้อยู่ใน lifecycle-write.api.ts (ใช้ในชุดเขียนข้อมูลเท่านั้น)
 *
 * ที่มา (เลขบรรทัดของ apps/api/src/agent/contracts ที่ qa/e2e 311ab35):
 *   deal-offers.controller.ts บรรทัด 10-12 (@Roles("agent") ระดับ class), 32-36 (revise), 51-55 (cancel) ทั้ง 2 ตอบ 200 (@HttpCode OK)
 */
export class DealOffersApi {
  constructor(private readonly client: ApiClient) {}

  /**
   * POST /agent/deal-offers/:id/cancel เนื้อคำขอ { revision }
   * cancel (deal-offers.service.ts:512) เรียก locked ซึ่งตรวจ revision ก่อนหาข้อเสนอ (บรรทัด 405-410)
   */
  cancel(id: number | string, body: unknown): Promise<APIResponse> {
    return this.client.post(`agent/deal-offers/${id}/cancel`, body);
  }

  /**
   * POST /agent/deal-offers/:id/revise เนื้อคำขอ = เงื่อนไขข้อเสนอ + revision, reason, agreedVia
   * revise (deal-offers.service.ts:439) ตรวจเงื่อนไข เหตุผล และช่องทางก่อน (บรรทัด 440-445) แล้วจึงหาข้อเสนอใน transaction (บรรทัด 451-453)
   */
  revise(id: number | string, body: unknown): Promise<APIResponse> {
    return this.client.post(`agent/deal-offers/${id}/revise`, body);
  }
}
