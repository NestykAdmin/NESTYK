import type { APIResponse } from '@playwright/test';
import type { ApiClient, QueryParams } from './api-client';

/**
 * นัดดูห้อง: agent/leads/:id/viewings, agent/viewings และ agent/viewings/:id
 * ที่มา (เลขบรรทัดที่ develop bc77a8b): apps/api/src/agent/leads/lead-viewings.controller.ts และ lead-viewings.service.ts
 *
 * POST สร้างนัดเมื่อเนื้อคำขอผ่าน ลีดเปิดอยู่ และห้องเป็นของนายหน้า ; PATCH แก้นัดเมื่อเนื้อคำขอผ่านและพบนัด
 *   ทั้ง 2 เส้นทางตรวจเนื้อคำขอก่อนหาข้อมูล (service 115 และ 175)
 *   ชุดเทส tests/api ส่งไปเฉพาะเนื้อคำขอที่ผิด ลีดหรือนัดหรือห้องที่ไม่มีจริง หรือลีดที่ปิดแล้ว (เหตุผลอยู่ในไฟล์เทส)
 */
export class LeadViewingsApi {
  constructor(private readonly client: ApiClient) {}

  /** POST /agent/leads/:id/viewings (body undefined = ไม่ส่งเนื้อคำขอ) */
  create(leadId: number | string, body?: unknown): Promise<APIResponse> {
    return this.client.post(`agent/leads/${leadId}/viewings`, body);
  }

  /** GET /agent/leads/:id/viewings : นัดทั้งหมดของลีด รวมที่ยกเลิก เรียงตามเวลานัด (อ่านอย่างเดียว) */
  listForLead(leadId: number | string): Promise<APIResponse> {
    return this.client.get(`agent/leads/${leadId}/viewings`);
  }

  /** GET /agent/viewings?from&to : นัดของนายหน้าในช่วงเวลา ไม่รวมที่ยกเลิก ช่วงไม่เกิน 62 วัน (อ่านอย่างเดียว) */
  range(query: QueryParams): Promise<APIResponse> {
    return this.client.get('agent/viewings', query);
  }

  /** GET /agent/viewings?from=..&from=..&to=.. : ส่ง from ซ้ำ 2 ค่า (ใช้ทดสอบตัวตรวจ query ซ้ำ) */
  rangeWithRepeatedFrom(from1: string, from2: string, to: string): Promise<APIResponse> {
    const query = new URLSearchParams([['from', from1], ['from', from2], ['to', to]]);
    return this.client.get(`agent/viewings?${query.toString()}`);
  }

  /** PATCH /agent/viewings/:id */
  update(id: number | string, body: unknown): Promise<APIResponse> {
    return this.client.patch(`agent/viewings/${id}`, body);
  }
}
