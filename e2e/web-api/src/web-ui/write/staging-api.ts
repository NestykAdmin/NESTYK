/// <reference lib="dom" />  // โค้ดใน evaluate ทำงานในเบราว์เซอร์
import type { APIRequestContext, Page } from '@playwright/test';
import { webUiEnv } from '../web-ui-env';

/**
 * ตัวเรียก API ของ staging จากฝั่งเทส (Node) ด้วย token ของบัญชีที่ล็อกอินอยู่ในแท็บ ใช้เตรียมข้อมูล อ่านผล และเก็บกวาดของเทสเขียนบนเว็บ
 *
 * ทำไมไม่ใช้ API บนเครื่องแบบ tests/write: เว็บเขียนผ่าน staging ถ้าเตรียมหรือเก็บกวาดผ่าน API บนเครื่อง อาจเป็นคนละฐานข้อมูล
 *   (ยังไม่รู้ว่า staging กับ DATABASE_URL ใน .env.api เป็นฐานเดียวกันหรือไม่: Aof 6 พ.ย. 2026) จึงใช้ API ตัวเดียวกับที่เว็บใช้
 * คำขอจากที่นี่ไม่ผ่านตัวกันของเบราว์เซอร์ (guard.ts) จึงจำกัดคำขอเขียนไว้แค่เมธอดในคลาสนี้:
 *   PATCH /agent/leads/:id, POST /agent/leads/:id/mark-inprogress, mark-lost,
 *   POST /agent/leads/:id/viewings, PATCH /agent/viewings/:id
 * token อ่านจาก nestyk.auth.session.v1 ใน localStorage ของแท็บ ไม่พิมพ์ออกรายงาน
 */

const SESSION_KEY = 'nestyk.auth.session.v1';
const API = `${webUiEnv.apiOrigin}/api/v1`;

export interface LeadRow {
  id: number;
  name: string;
  phone: string | null;
  status: string;
  notes: string | null;
  lostReason: string | null;
  budgetMax: number | null;
  pins: unknown[];
  nextViewingAt: string | null;
  [key: string]: unknown;
}

export interface ViewingRow {
  id: number;
  rentRoomId: number;
  scheduledAt: string;
  status: 'scheduled' | 'done' | 'cancelled';
  note: string | null;
}

/** ช่องของรายละเอียดห้องที่เทสใช้ (ชนิดฝั่งแอป: components/AgentRoomEditor.tsx:24-66) */
export interface ListingDetail {
  id: number;
  visibility: string;
  listingTitle: string | null;
  property?: { id?: number; name?: string | null; district?: string | null; province?: string | null } | null;
  roomTypeId?: number | null;
  availableFromDate?: string | null;
  layout?: { code: string; value: string | number | null }[];
  prices?: { contractTypeId: number; price: number | string; termMonths?: number | null }[];
  contacts?: { id: number; name: string; isPrimary?: boolean }[];
  [key: string]: unknown;
}

export class StagingApi {
  private constructor(
    private readonly request: APIRequestContext,
    private readonly token: string,
  ) {}

  /** อ่าน token ของบัญชีที่ล็อกอินอยู่ในแท็บนี้ (ต้องล็อกอินก่อน) */
  static async of(page: Page): Promise<StagingApi> {
    const token = await page.evaluate((key) => {
      try {
        const parsed = JSON.parse(window.localStorage.getItem(key) ?? 'null') as { accessToken?: unknown } | null;
        return typeof parsed?.accessToken === 'string' ? parsed.accessToken : null;
      } catch {
        return null;
      }
    }, SESSION_KEY);
    if (!token) throw new Error(`อ่าน token จาก ${SESSION_KEY} ไม่ได้ (ล็อกอินก่อนเรียก StagingApi.of)`);
    return new StagingApi(page.request, token);
  }

  private headers(): Record<string, string> {
    return { Authorization: `Bearer ${this.token}`, Accept: 'application/json' };
  }

  private async json<T>(method: string, path: string, response: Awaited<ReturnType<APIRequestContext['get']>>): Promise<T> {
    if (!response.ok()) {
      const text = (await response.text()).slice(0, 300);
      throw new Error(`${method} ${path} ตอบ ${response.status()}: ${text}`);
    }
    const text = await response.text();
    return (text ? JSON.parse(text) : null) as T;
  }

  private async get<T>(path: string): Promise<T> {
    return this.json<T>('GET', path, await this.request.get(`${API}${path}`, { headers: this.headers() }));
  }

  private async send<T>(method: 'POST' | 'PATCH', path: string, body: unknown): Promise<T> {
    const response = await this.request.fetch(`${API}${path}`, { method, headers: this.headers(), data: body });
    return this.json<T>(method, path, response);
  }

  // ---- อ่าน ----

  leads(q: string): Promise<{ items: LeadRow[]; total: number }> {
    return this.get(`/agent/leads?${new URLSearchParams({ q, page: '1', limit: '50' })}`);
  }

  lead(id: number): Promise<LeadRow> {
    return this.get(`/agent/leads/${id}`);
  }

  /** รายการห้องของนายหน้า (ช่องตามชนิดฝั่งแอป lib/agent-listings-api.ts:5-42) */
  listings(q: string): Promise<{ items: { id: number; listingTitle: string | null; isScoutRoom?: boolean }[]; total: number }> {
    return this.get(`/agent/listings?${new URLSearchParams({ q, page: '1', limit: '50' })}`);
  }

  /** รายละเอียดห้องของนายหน้า (ข้อมูลเดียวกับหน้ารายละเอียดและหน้าแก้: lib/agent-listings-api.ts:183-186) */
  listing(id: number): Promise<ListingDetail> {
    return this.get(`/agent/listings/${id}`);
  }

  /** ชนิดสัญญา (ความยาวเป็นเดือน) ที่ตัวช่วยใช้ทำ chip (controller :47-50, lib/agent-listings-api.ts:112-116) */
  contractTypes(): Promise<{ id: number; code: string; termMonths: number }[]> {
    return this.get('/agent/rooms/contract-types');
  }

  /** ผู้ติดต่อที่นายหน้าคนนี้สร้าง (agent-rooms.service.ts listContacts :123-151 กรองตาม created_by_user_id) */
  contacts(): Promise<{ id: number; name: string; phone: string; roomCount: number }[]> {
    return this.get('/agent/rooms/contacts');
  }

  viewings(leadId: number): Promise<ViewingRow[]> {
    return this.get(`/agent/leads/${leadId}/viewings`);
  }

  /** นัดของนายหน้าในช่วงเวลา (ข้อมูลเดียวกับที่ปฏิทินใช้: lib/agent-leads-api.ts:110-114) */
  agentViewings(from: string, to: string): Promise<(ViewingRow & { leadId: number; leadName: string; roomTitle: string })[]> {
    return this.get(`/agent/viewings?${new URLSearchParams({ from, to })}`);
  }

  // ---- เขียน (ข้อมูลของเทสเท่านั้น) ----

  patchLead(id: number, body: Record<string, unknown>): Promise<LeadRow> {
    return this.send('PATCH', `/agent/leads/${id}`, body);
  }

  markInProgress(id: number): Promise<LeadRow> {
    return this.send('POST', `/agent/leads/${id}/mark-inprogress`, {});
  }

  markLost(id: number, lostReason: string): Promise<LeadRow> {
    return this.send('POST', `/agent/leads/${id}/mark-lost`, { lostReason });
  }

  createViewing(leadId: number, body: { rentRoomId: number; scheduledAt: string; note: string }): Promise<ViewingRow> {
    return this.send('POST', `/agent/leads/${leadId}/viewings`, body);
  }

  updateViewing(id: number, body: Record<string, unknown>): Promise<ViewingRow> {
    return this.send('PATCH', `/agent/viewings/${id}`, body);
  }
}
