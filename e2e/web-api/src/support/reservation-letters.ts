import { expect } from '@playwright/test';
import type { ContractsApi } from '../api/contracts.api';
import type { OwnerUserOption } from '../api/types';
import { expectJson } from './http';

/**
 * เจ้าของห้องที่นายหน้าคนหนึ่งกรอกไว้ในหนังสือจองของตัวเอง ใช้เป็นค่าที่คาดของ GET /agent/contracts/owner-users
 *
 * ที่มา (develop accb616, R1 ของทีม 2 พ.ย. 2026): searchOwnerUsers ใน apps/api/src/agent/contracts/agent-contracts.service.ts
 *   บรรทัด 3141-3199 ค้นจาก lease_contracts.data.reservationLetter ของสัญญาที่ created_by_user_id = นายหน้าที่เรียก (บรรทัด 3168)
 *   ข้ามหนังสือที่อีเมลเจ้าของห้องว่าง (บรรทัด 3170) และรวมแถวที่อีเมลซ้ำกันเหลือแถวเดียวต่ออีเมล (DISTINCT ON LOWER(email) บรรทัด 3157)
 * เทสอ่านคอลัมน์ JSON เดียวกันผ่านอีกเส้นทางคือ GET /agent/contracts (ช่อง data.reservationLetter ของแต่ละสัญญา)
 *   จึงไม่ต้องรู้ id หรือชื่อล่วงหน้า และใช้ได้ทั้งในห้องทดลองและบน dev
 * ข้อจำกัด: ถ้า GET /agent/contracts ไม่คืนสัญญาบางฉบับที่ searchOwnerUsers ค้นถึง ค่าที่คาดจะขาดอีเมลนั้น (ในห้องทดลอง 3 พ.ย. 2026 นับจาก GET /agent/contracts กับจาก SQL ได้ 22 ฉบับเท่ากัน)
 * ข้อควรระวัง: ชื่อ เบอร์ และอีเมลเป็นข้อมูลส่วนตัวของเจ้าของห้อง เทสที่ใช้ไฟล์นี้จึงตรวจเป็นจริง/เท็จหรือจำนวน
 *   ไม่เทียบค่าตรง ๆ เพราะถ้าไม่ผ่าน Playwright จะพิมพ์ค่าที่เทียบออกมาในผลรัน
 */

/** อักขระที่ API ตัดออกจากคำค้นก่อนค้น (บรรทัด 3144) คำค้นที่มีอักขระเหล่านี้จึงไม่ใช่คำเดิม */
export const STRIPPED_FROM_QUERY = /[%_\\]/;

/** ความยาวคำค้นสูงสุดที่ API ค้นให้ (บรรทัด 3143: ยาวเกิน 80 ตัวได้รายการว่าง) */
export const MAX_QUERY_LENGTH = 80;

/** จำนวนแถวสูงสุดต่อการค้น (บรรทัด 3181) */
export const OWNER_SEARCH_LIMIT = 15;

/** ข้อมูลเจ้าของห้อง 1 อีเมลจากหนังสือจองทุกฉบับที่ใช้อีเมลนี้ */
export interface LetterLandlord {
  /** อีเมลตามที่กรอก (ฉบับแรกที่พบ) */
  email: string;
  /** ชื่อที่ API จะตอบได้: ชื่อ + นามสกุล หรือ landlordName ถ้าไม่ได้กรอกชื่อ (บรรทัด 3190) */
  names: string[];
  /** เบอร์ที่กรอก (ไม่รวมค่าว่าง) */
  phones: string[];
  /** มีหนังสือฉบับที่ใช้อีเมลนี้แต่ไม่กรอกเบอร์ (API จะตอบเบอร์ว่างได้ถ้าฉบับนั้นเป็นฉบับที่แก้ล่าสุด) */
  hasBlankPhone: boolean;
}

interface LetterFields {
  landlordEmail?: unknown;
  landlordFirstName?: unknown;
  landlordLastName?: unknown;
  landlordName?: unknown;
  landlordPhone?: unknown;
}

const text = (value: unknown) => (typeof value === 'string' ? value : '');

/** อ่านเจ้าของห้องจากหนังสือจองของผู้เรียก (อ่านอย่างเดียว) คีย์ = อีเมลตัวพิมพ์เล็ก */
export async function letterLandlords(contracts: ContractsApi): Promise<Map<string, LetterLandlord>> {
  const rows = await expectJson<{ data?: { reservationLetter?: unknown } | null }[]>(await contracts.list(), 200);
  const byEmail = new Map<string, LetterLandlord>();
  for (const row of rows) {
    const letter = row.data?.reservationLetter;
    if (!letter || typeof letter !== 'object' || Array.isArray(letter)) continue;
    const fields = letter as LetterFields;
    const email = text(fields.landlordEmail);
    if (email === '') continue;
    const key = email.toLowerCase();
    const entry = byEmail.get(key) ?? { email, names: [], phones: [], hasBlankPhone: false };
    const name = `${text(fields.landlordFirstName)} ${text(fields.landlordLastName)}`.trim() || text(fields.landlordName);
    if (!entry.names.includes(name)) entry.names.push(name);
    const phone = text(fields.landlordPhone);
    if (phone === '') entry.hasBlankPhone = true;
    else if (!entry.phones.includes(phone)) entry.phones.push(phone);
    byEmail.set(key, entry);
  }
  return byEmail;
}

/**
 * เรียก GET /agent/contracts/owner-users แล้วคืนรายการ โดยไม่ใส่ที่อยู่หรือเนื้อคำตอบในข้อความของการตรวจ
 * เหตุผล: คำค้นอยู่ในที่อยู่ (?q=อีเมลหรือเบอร์ของเจ้าของห้อง) ถ้าใช้ expectJson แล้วรหัสไม่ใช่ 200 ข้อมูลส่วนตัวจะถูกพิมพ์ในผลรัน
 *   (expectJson ใน http.ts ใส่ response.url() และเนื้อคำตอบในข้อความ) จึงพิมพ์แค่รหัสตอบกลับ
 */
export async function searchOwners(contracts: ContractsApi, q?: string): Promise<OwnerUserOption[]> {
  const response = await contracts.ownerUsers(q);
  expect(response.status(), 'GET /agent/contracts/owner-users ต้องตอบ 200 (ไม่พิมพ์คำค้นและเนื้อคำตอบ เพราะเป็นข้อมูลส่วนตัว)').toBe(200);
  return (await response.json()) as OwnerUserOption[];
}
