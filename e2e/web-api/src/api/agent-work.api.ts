import type { APIResponse } from '@playwright/test';
import type { ApiClient } from './api-client';

/**
 * เส้นทางภาพรวมงานของนายหน้าคนที่ล็อกอิน (@Roles('agent') ระดับ class: agent-dashboard.controller.ts:10
 * และ contract-reminders.controller.ts:11 ตรวจซ้ำที่ develop 9644dd9)
 *   GET /agent/dashboard : apps/api/src/agent/dashboard/agent-dashboard.controller.ts
 *   GET /agent/reminders : apps/api/src/agent/reminders/contract-reminders.controller.ts
 * ทั้ง 2 เส้นทางอ่านอย่างเดียว (ตรวจซ้ำที่ 9644dd9 เลขบรรทัดตามรุ่นนี้):
 *   - dashboard: agent-dashboard.service.ts ทั้งไฟล์ (getDashboard บรรทัด 111-221 และตัวช่วยบรรทัด 47-109) ไม่มีคำสั่งเขียน
 *     ตั้งแต่ 9644dd9 เรียก roomDealStatuses (บรรทัด 49) ใน apps/api/src/agent/rooms/room-deal-status.ts ซึ่งใช้แค่ find
 *   - reminders: contract-reminders.service.ts forAgent (บรรทัด 108-113) เรียก due() กับ openRefunds() (บรรทัด 31-105)
 *     ซึ่งอ่านอย่างเดียว คำสั่งเขียนลงตาราง contract_reminders ทั้งหมดอยู่ใน run() (บรรทัด 125 เป็นต้นไป)
 *     ซึ่งเรียกจากงานตั้งเวลา contract-reminders.scheduler.ts:12-15 เท่านั้น
 *     (git grep -n "\.run(" ทั้ง apps/api/src ที่ 9644dd9 พบ 3 จุด จุดที่เรียก ContractRemindersService คือ scheduler บรรทัด 15 ที่เดียว
 *     อีก 2 จุดเป็นของ lead-matching และ schema-drift)
 *     ตั้งแต่ 9644dd9 due() อ่านตาราง contract_deposit_settlements ด้วย (บรรทัด 50) และอ่านทุกคอลัมน์ของ entity
 *     รวม return_received_reference ที่ migration 20261028100000 เพิ่ม (contract-deposit-settlement.entity.ts:45)
 *     อนุมานจากโค้ด ยังไม่ได้ทดลอง: กับฐานข้อมูลที่ยังไม่ขึ้น migration นี้ เส้นทางนี้น่าจะได้ 500 เมื่อนายหน้ามีสัญญาที่ยังเปิดอยู่
 */
export class AgentWorkApi {
  constructor(private readonly client: ApiClient) {}

  /** GET /agent/dashboard : ข้อมูลหน้าภาพรวมของนายหน้า */
  dashboard(): Promise<APIResponse> {
    return this.client.get('agent/dashboard');
  }

  /** GET /agent/reminders : รายการแจ้งเตือนสัญญาที่ถึงกำหนดหรือเลยกำหนด */
  reminders(): Promise<APIResponse> {
    return this.client.get('agent/reminders');
  }
}
