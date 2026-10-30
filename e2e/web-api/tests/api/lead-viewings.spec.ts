import type { LeadDetail, LeadViewing } from '../../src/api/types';
import { expect, test, type ApiSession } from '../../src/fixtures/api.fixture';
import { allLeads } from '../../src/support/agent-data';
import { expectCodedError, expectError, expectJson } from '../../src/support/http';

/**
 * นัดดูห้อง: POST/GET /agent/leads/:id/viewings, GET /agent/viewings?from&to และ PATCH /agent/viewings/:id
 * ที่มาของค่าที่คาด: apps/api/src/agent/leads/lead-viewings.controller.ts และ lead-viewings.service.ts
 *   ที่ develop bc77a8b (qa/e2e ecc39f6) และผลยิงจริงในห้องทดลอง 30 ต.ค. 2026
 *
 * สิ่งที่ต้องมีก่อน
 *   - ล็อกอินแบบนักพัฒนาได้ ผู้เรียกคือ fixture agent = qa-agent ซึ่งต้องมีลีดอย่างน้อย 1 ราย
 *   - เคส 409 LEAD_CLOSED ต้องมีลีดสถานะ lost หรือ booked และเคสห้องที่ไม่มีจริงต้องมีลีดสถานะ new หรือ inprogress ถ้าไม่มี ข้อนั้นข้าม
 *
 * เทสไฟล์นี้ไม่สร้างและไม่แก้นัด
 *   - POST และ PATCH ตรวจเนื้อคำขอก่อนหาข้อมูล (service 115 และ 175) เทสส่งเนื้อคำขอที่ผิดไปที่ลีดหรือนัด 2147483647
 *   - POST ที่เนื้อคำขอถูกส่งไปเฉพาะ: ลีด 2147483647 (404 บรรทัด 121), ลีดที่ปิดแล้ว (409 LEAD_CLOSED ก่อนหาห้อง)
 *     หรือลีดที่เปิดอยู่กับห้อง 2147483647 (404 Room not found ก่อนบันทึก ; ระหว่างนั้นล็อกแถวลีดชั่วคราว)
 *     และอ่านนัดของลีดก่อนกับหลัง ตรวจว่าเท่ากันก่อนตรวจรหัสตอบกลับ ถ้าต่าง เทสไม่ผ่านพร้อมข้อความให้แจ้งทีม
 *   - PATCH ที่เนื้อคำขอถูกส่งไปเฉพาะนัด 2147483647 (404 Viewing not found บรรทัด 177)
 */

/** เลขจำนวนเต็มที่มากที่สุดที่คอลัมน์ id เก็บได้ = 2^31 - 1 ใช้เป็น id ที่ไม่มีอยู่จริง */
const NO_SUCH_ID = 2_147_483_647;

const DAY_MS = 24 * 60 * 60 * 1000;

/** เวลานัดที่ถูกต้อง: พรุ่งนี้ (ไม่ใช่อดีต และไม่เกินหนึ่งปี: service 59-61) คำนวณตอนรัน */
function tomorrow(): string {
  return new Date(Date.now() + DAY_MS).toISOString();
}

/** สถานะของนัด (STATUSES ใน lead-viewings.service.ts:9) */
const STATUSES = ['scheduled', 'done', 'cancelled'];

async function viewingsOf(agent: ApiSession, leadId: number): Promise<LeadViewing[]> {
  return expectJson<LeadViewing[]>(await agent.viewings.listForLead(leadId), 200);
}

/**
 * นัดของลีดแบบย่อ: id สถานะ และเวลานัดเท่านั้น
 * ไม่เทียบทั้งก้อน เพราะนัดมีชื่อลีดและชื่อห้อง (service 94-97) ถ้าเทสไม่ผ่าน Playwright จะพิมพ์ค่าที่เทียบ
 */
async function viewingSummary(agent: ApiSession, leadId: number) {
  return (await viewingsOf(agent, leadId)).map((viewing) => [viewing.id, viewing.status, viewing.scheduledAt]);
}

async function leadsOrSkip(agent: ApiSession): Promise<LeadDetail[]> {
  const leads = await allLeads(agent);
  test.skip(leads === null, 'qa-agent มีลีดเกิน 1,000 ราย ไม่อ่านทั้งหมดในเทสข้อเดียว');
  expect(leads!.length, 'qa-agent ต้องมีลีดอย่างน้อย 1 ราย ถ้าเป็น 0 ให้แจ้งทีม').toBeGreaterThan(0);
  return leads!;
}

test.describe('POST /agent/leads/:id/viewings is refused before anything is saved', () => {
  // ข้อความจาก validateViewingInput (service 53, 59-61, 67, 73)
  const invalid: { title: string; body: () => unknown; message: string }[] = [
    { title: 'no body', body: () => undefined, message: 'Body must be an object' },
    { title: 'rentRoomId as text', body: () => ({ rentRoomId: '5', scheduledAt: tomorrow() }), message: 'rentRoomId is required' },
    { title: 'no rentRoomId', body: () => ({ scheduledAt: tomorrow() }), message: 'rentRoomId is required' },
    { title: 'a scheduledAt that is not a date', body: () => ({ rentRoomId: 5, scheduledAt: 'not a date' }), message: 'scheduledAt must be an ISO date-time' },
    { title: 'a scheduledAt in the past', body: () => ({ rentRoomId: 5, scheduledAt: '2020-01-01T00:00:00Z' }), message: 'scheduledAt is in the past' },
    {
      title: 'a scheduledAt more than a year ahead',
      body: () => ({ rentRoomId: 5, scheduledAt: new Date(Date.now() + 400 * DAY_MS).toISOString() }),
      message: 'scheduledAt is more than a year ahead',
    },
    { title: 'a note longer than 500 characters', body: () => ({ rentRoomId: 5, scheduledAt: tomorrow(), note: 'x'.repeat(501) }), message: 'note must be text up to 500 characters' },
  ];
  for (const item of invalid) {
    test(`answers 400 for ${item.title}`, async ({ agent }) => {
      // ขั้นที่ 1: ส่ง POST นัดที่เนื้อคำขอผิดไปลีด 2147483647
      // ขั้นที่ 2: ต้องถูกปฏิเสธ: validateViewingInput ตรวจก่อนหาลีด (service 115) ส่งไปลีดที่ไม่มีจริง จึงไม่มีทางบันทึก
      expect(await expectError(await agent.viewings.create(NO_SUCH_ID, item.body()), 400)).toBe(item.message);
    });
  }

  test('answers 404 for a lead that does not exist', async ({ agent }) => {
    // ขั้นที่ 1: ส่ง POST นัดที่เนื้อคำขอถูกไปลีด 2147483647
    // ขั้นที่ 2: ต้องถูกปฏิเสธ: เนื้อคำขอถูก หาลีดไม่เจอ (service 121) ก่อนบันทึก
    expect(await expectError(await agent.viewings.create(NO_SUCH_ID, { rentRoomId: 5, scheduledAt: tomorrow() }), 404)).toBe('Lead not found');
  });

  test('answers 409 LEAD_CLOSED for a lost or booked lead and adds no viewing', async ({ agent }) => {
    // ขั้นที่ 1: หาลีดที่ปิดแล้ว
    const closed = (await leadsOrSkip(agent)).find((lead) => lead.status === 'lost' || lead.status === 'booked');
    test.skip(!closed, 'qa-agent ไม่มีลีดสถานะ lost หรือ booked');
    const before = await viewingSummary(agent, closed!.id);
    // ขั้นที่ 2: ส่งคำขอ แล้วอ่านนัดซ้ำก่อนตรวจรหัส ถ้าต่าง แปลว่า API บันทึกนัดแล้ว ต้องแจ้งทีม
    // ห้อง 2147483647 เป็นด่านที่ 2: ถ้าตัวกันลีดปิด (service 123) หายไป คำขอยังได้ 404 Room not found (126)
    const response = await agent.viewings.create(closed!.id, { rentRoomId: NO_SUCH_ID, scheduledAt: tomorrow() });
    expect(await viewingSummary(agent, closed!.id), `ลีด id ${closed!.id}: มีนัดถูกบันทึก (รหัสตอบกลับ ${response.status()}) ให้แจ้งทีม`).toEqual(before);
    // ขั้นที่ 3: ลีดที่ปิดแล้วถูกกันก่อนหาห้อง คำตอบเป็น object ที่มี code ไม่มี statusCode
    expect(await expectCodedError(response, 409, 'LEAD_CLOSED')).toBe('Booked or lost leads cannot book viewings');
  });

  test('answers 404 for a room that does not exist on an open lead and adds no viewing', async ({ agent }) => {
    // ขั้นที่ 1: หาลีดที่เปิดอยู่ (new หรือ inprogress)
    const open = (await leadsOrSkip(agent)).find((lead) => lead.status === 'new' || lead.status === 'inprogress');
    test.skip(!open, 'qa-agent ไม่มีลีดสถานะ new หรือ inprogress');
    const before = await viewingSummary(agent, open!.id);
    // ขั้นที่ 2: ส่งคำขอ แล้วอ่านนัดซ้ำก่อนตรวจรหัส ถ้าต่าง แปลว่า API บันทึกนัดแล้ว ต้องแจ้งทีม
    const response = await agent.viewings.create(open!.id, { rentRoomId: NO_SUCH_ID, scheduledAt: tomorrow() });
    expect(await viewingSummary(agent, open!.id), `ลีด id ${open!.id}: มีนัดถูกบันทึก (รหัสตอบกลับ ${response.status()}) ให้แจ้งทีม`).toEqual(before);
    // ขั้นที่ 3: หาห้อง 2147483647 ของนายหน้าไม่เจอ (service 126) ต้องได้ 404 ก่อนบันทึก (135)
    expect(await expectError(response, 404)).toBe('Room not found');
  });

  test('answers 401 without login', async ({ anonymous }) => {
    // ขั้นที่ 1: ส่ง POST นัดโดยไม่ส่งหัวข้อ Authorization
    // ขั้นที่ 2: ต้องถูกปฏิเสธ: AuthGuard ไม่มี Bearer token (auth/guards/auth.guard.ts:39,44)
    expect(await expectError(await anonymous.viewings.create(NO_SUCH_ID, { rentRoomId: 5, scheduledAt: tomorrow() }), 401)).toBe('Missing Bearer token');
  });
});

test.describe('GET /agent/leads/:id/viewings', () => {
  test('lists the viewings of a lead of qa-agent in time order', async ({ agent }) => {
    // ขั้นที่ 1: เลือกลีดที่มีนัดที่ยังไม่ถึงเวลาถ้ามี ไม่มีก็ใช้ลีดรายแรก
    const leads = await leadsOrSkip(agent);
    const withViewing = leads.find((lead) => lead.nextViewingAt !== null);
    const lead = withViewing ?? leads[0]!;
    const items = await viewingsOf(agent, lead.id);
    if (items.length === 0) {
      test.info().annotations.push({ type: 'ไม่ได้ตรวจ', description: `ลีด id ${lead.id} ไม่มีนัด จึงตรวจได้แค่ว่าตอบเป็นรายการ` });
    }
    // ขั้นที่ 2: ลีดที่มีนัดที่ยังไม่ถึงเวลาต้องมีนัดในรายการ
    if (withViewing) expect(items.length).toBeGreaterThan(0);
    // ขั้นที่ 3: ทุกนัดเป็นของลีดนี้ สถานะถูก และเรียงตามเวลานัดแล้ว id จากน้อยไปมาก (service 154)
    // ลีดที่เลือกอาจมีนัดเดียว ซึ่งตรวจลำดับไม่ได้ จึงติดป้าย
    for (const viewing of items) {
      expect(viewing.leadId).toBe(lead.id);
      expect(STATUSES).toContain(viewing.status);
    }
    const order = items.map((viewing) => [Date.parse(viewing.scheduledAt), viewing.id] as const);
    const sorted = [...order].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    expect(order).toEqual(sorted);
    if (items.length === 1) {
      test.info().annotations.push({ type: 'ไม่ได้ตรวจ', description: `ลีด id ${lead.id} มีนัดเดียว จึงตรวจลำดับของนัดไม่ได้` });
    }
  });

  test('answers 404 for a lead that does not exist', async ({ agent }) => {
    // ขั้นที่ 1: อ่านนัดของลีด 2147483647
    // ขั้นที่ 2: ต้องถูกปฏิเสธ: หาลีดไม่เจอ (service 153)
    expect(await expectError(await agent.viewings.listForLead(NO_SUCH_ID), 404)).toBe('Lead not found');
  });
});

test.describe('GET /agent/viewings', () => {
  // ข้อความของ listRange (service 163 และ 165)
  const RANGE = 'Range must be positive and at most 62 days';
  const start = '2026-11-01T00:00:00.000Z';
  const refused: { title: string; query: Record<string, string>; message: string }[] = [
    { title: 'without from and to', query: {}, message: 'from and to must be ISO date-times' },
    { title: 'a from that is not a date', query: { from: 'x', to: '2026-11-02T00:00:00.000Z' }, message: 'from and to must be ISO date-times' },
    { title: 'a range that ends before it starts', query: { from: '2026-11-03T00:00:00.000Z', to: start }, message: RANGE },
    { title: 'a range of 63 days', query: { from: start, to: '2027-01-03T00:00:00.000Z' }, message: RANGE },
  ];
  for (const item of refused) {
    test(`answers 400 for ${item.title}`, async ({ agent }) => {
      // ขั้นที่ 1: อ่านปฏิทินนัดด้วยช่วงวันที่ที่ผิด
      // ขั้นที่ 2: ต้องถูกปฏิเสธ: GET อ่านอย่างเดียว ตรวจช่วงวันที่ก่อนค้น (service 160-165)
      expect(await expectError(await agent.viewings.range(item.query), 400)).toBe(item.message);
    });
  }

  test('answers 400 when from is sent twice', async ({ agent }) => {
    // ขั้นที่ 1: อ่านปฏิทินนัดโดยส่ง from 2 ครั้ง
    // ขั้นที่ 2: ต้องถูกปฏิเสธ: SingleQueryPipe (common/single-query.pipe.ts:5-17) ข้อความเดียวกับที่ agent-listings.spec.ts ใช้
    expect(await expectError(await agent.viewings.rangeWithRepeatedFrom(start, '2026-11-02T00:00:00.000Z', '2026-11-03T00:00:00.000Z'), 400)).toBe(
      'from must be a single string',
    );
  });

  test('accepts a range of exactly 62 days and lists only viewings inside it that are not cancelled', async ({ agent }) => {
    // ขั้นที่ 1: ช่วง 62 วันพอดีนับจากเมื่อวาน (service 165: เกิน 62 วันจึงปฏิเสธ)
    const from = new Date(Date.now() - DAY_MS);
    const to = new Date(from.getTime() + 62 * DAY_MS);
    const items = await expectJson<LeadViewing[]>(await agent.viewings.range({ from: from.toISOString(), to: to.toISOString() }), 200);
    if (items.length === 0) {
      test.info().annotations.push({ type: 'ไม่ได้ตรวจ', description: 'qa-agent ไม่มีนัดในช่วงนี้ จึงตรวจได้แค่ว่าตอบเป็นรายการ' });
    }
    // ขั้นที่ 2: ทุกนัดอยู่ในช่วง (รวมปลายทั้งสอง) และไม่ใช่ cancelled (service 166-171)
    for (const viewing of items) {
      const at = Date.parse(viewing.scheduledAt);
      expect(at >= from.getTime() && at <= to.getTime(), `นัด id ${viewing.id}`).toBe(true);
      expect(viewing.status, `นัด id ${viewing.id}`).not.toBe('cancelled');
    }
  });
});

test.describe('PATCH /agent/viewings/:id is refused before anything is saved', () => {
  test('answers 400 for an empty body', async ({ agent }) => {
    // ขั้นที่ 1: ส่ง PATCH เนื้อคำขอว่างไปนัด 2147483647
    // ขั้นที่ 2: ต้องถูกปฏิเสธ: validateViewingPatch ตรวจก่อนหานัด (service 175)
    expect(await expectError(await agent.viewings.update(NO_SUCH_ID, {}), 400)).toBe('Nothing to update');
  });

  test('answers 400 for an unknown status', async ({ agent }) => {
    // ขั้นที่ 1: ส่ง PATCH สถานะที่ไม่มีจริงไปนัด 2147483647
    // ขั้นที่ 2: ต้องถูกปฏิเสธ: validateViewingPatch (service 82) ก่อนหานัด
    expect(await expectError(await agent.viewings.update(NO_SUCH_ID, { status: 'maybe' }), 400)).toBe('status is invalid');
  });

  test('answers 404 for a viewing that does not exist', async ({ agent }) => {
    // ขั้นที่ 1: ส่ง PATCH ที่เนื้อคำขอถูกไปนัด 2147483647
    // ขั้นที่ 2: ต้องถูกปฏิเสธ: เนื้อคำขอถูก หานัดไม่เจอ (service 177) ก่อนเปิด transaction ที่บรรทัด 181
    expect(await expectError(await agent.viewings.update(NO_SUCH_ID, { status: 'done' }), 404)).toBe('Viewing not found');
  });
});
