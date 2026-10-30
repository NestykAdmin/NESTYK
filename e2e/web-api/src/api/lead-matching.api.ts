import type { APIResponse } from '@playwright/test';
import type { ApiClient } from './api-client';

/**
 * จับคู่ห้องให้ลีด: agent/leads/:id/match-settings และ match-runs
 * ที่มา (เลขบรรทัดที่ develop bc77a8b): apps/api/src/agent/leads/lead-matching.controller.ts และ lead-matching.service.ts
 *   ทุกเส้นทางหาลีดของนายหน้าก่อน (requireLead service 223-230) ลีดที่ไม่มีจริงหรือของคนอื่นได้ 404 Lead not found
 *
 * PATCH match-settings บันทึกเมื่อค่าผ่าน (รวม {}) ; POST match-runs สร้างผลจับคู่เมื่อลีดพร้อม ; DELETE match-runs ลบผลจับคู่จริง
 *   ชุดเทส tests/api ส่งไปเฉพาะลีดที่ไม่มีจริง ค่าตั้งที่ผิด ลีดที่จองแล้ว หรือลีดที่ยังไม่พร้อมจับคู่ (เหตุผลอยู่ในไฟล์เทส)
 */
export class LeadMatchingApi {
  constructor(private readonly client: ApiClient) {}

  /** GET /agent/leads/:id/match-settings : อ่านอย่างเดียว */
  settings(leadId: number | string): Promise<APIResponse> {
    return this.client.get(`agent/leads/${leadId}/match-settings`);
  }

  /** PATCH /agent/leads/:id/match-settings (หาลีด แล้วตรวจค่า แล้วจึงบันทึก: service 108-113) */
  saveSettings(leadId: number | string, body: unknown): Promise<APIResponse> {
    return this.client.patch(`agent/leads/${leadId}/match-settings`, body);
  }

  /** POST /agent/leads/:id/match-runs (หาลีด แล้วกันลีด booked 409 แล้วกันลีดที่ไม่พร้อม 422 ก่อนบันทึก: service 118-127) */
  run(leadId: number | string): Promise<APIResponse> {
    return this.client.post(`agent/leads/${leadId}/match-runs`);
  }

  /** DELETE /agent/leads/:id/match-runs (หาลีด แล้วลบผลจับคู่ทั้งหมดของลีดนั้น) */
  clear(leadId: number | string): Promise<APIResponse> {
    return this.client.delete(`agent/leads/${leadId}/match-runs`);
  }

  /** GET /agent/leads/:id/match-runs/latest : อ่านอย่างเดียว */
  latest(leadId: number | string): Promise<APIResponse> {
    return this.client.get(`agent/leads/${leadId}/match-runs/latest`);
  }
}
