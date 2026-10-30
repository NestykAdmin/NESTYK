import type { LeadDetail, MatchLatestResponse, MatchSettingsResponse } from '../../src/api/types';
import { expect, test, type ApiSession } from '../../src/fixtures/api.fixture';
import { allLeads } from '../../src/support/agent-data';
import { expectError, expectJson } from '../../src/support/http';

/**
 * จับคู่ห้องให้ลีด: GET/PATCH /agent/leads/:id/match-settings, POST/DELETE /agent/leads/:id/match-runs, GET match-runs/latest
 * ที่มาของค่าที่คาด: apps/api/src/agent/leads/lead-matching.controller.ts, lead-matching.service.ts และ lead-matching.ts
 *   ที่ develop bc77a8b (qa/e2e ecc39f6) และผลยิงจริงในห้องทดลอง 30 ต.ค. 2026
 *
 * สิ่งที่ต้องมีก่อน
 *   - ล็อกอินแบบนักพัฒนาได้ ผู้เรียกคือ fixture agent = qa-agent ซึ่งต้องมีลีดอย่างน้อย 1 ราย
 *   - เคส 409 ต้องมีลีดสถานะ booked ที่ไม่มีทั้งงบสูงสุดและหมุด ถ้าไม่มี ข้อนั้นข้ามพร้อมเหตุผล
 *
 * เทสไฟล์นี้ไม่สร้างและไม่แก้ข้อมูล
 *   - ทุกเส้นทางหาลีดของนายหน้าก่อน (requireLead service 223-230) ลีด 2147483647 จึงได้ 404 ก่อนบันทึกหรือลบ
 *   - PATCH match-settings กับลีดจริง: ตรวจค่าก่อนบันทึก (validateMatchSettings service 110 แล้ว assertScoreRange 112 ; บันทึกที่ 113)
 *     เทสส่งเฉพาะค่าที่ถูกปฏิเสธเสมอไม่ว่าค่าที่บันทึกไว้คืออะไร ({} ผ่านและบันทึกจริง จึงห้ามส่ง)
 *     เคสคะแนนและ maxResults แนบช่วงคะแนนที่แคบเกินด้วย ถ้าตัวตรวจแรกถูกผ่อน assertScoreRange ยังกันไว้
 *     ส่วนเคส maxScore เท่า minScore และเคสรายการ [] มีด่านเดียว (ความเสี่ยงที่เหลือ)
 *     ทุกเคสอ่านค่าตั้งก่อนและหลัง และตรวจค่าตั้งก่อนตรวจรหัสตอบกลับ ถ้าต่าง เทสไม่ผ่านพร้อมข้อความให้แจ้งทีม
 *   - POST match-runs กับลีดจริง: ส่งเฉพาะลีด booked ที่ไม่มีทั้งงบสูงสุดและหมุด และอ่านผลจับคู่ล่าสุดก่อนกับหลัง
 *     ลีดที่พร้อมจะถูกจับคู่และบันทึกผลจริง (transaction 136-175 ลบรอบเก่าที่เกิน 5 รอบด้วย)
 *     กันได้ 2 ด่าน: booked (บรรทัด 120) แล้วความพร้อม (122-127 ; leadMatchReady ใน lead-matching.ts:70-72)
 *   - ยังไม่เทส 422 LEAD_NOT_READY (ลีดที่ไม่ใช่ booked) กับฐานข้อมูลของทีม เพราะมีด่านเดียว ถ้าตัวตรวจความพร้อมหายหรือถูกย้าย
 *     คำขอจะบันทึกรอบจับคู่และอาจลบรอบเก่าที่ย้อนไม่ได้ (Aof ตัดสินเมื่อ 30 ต.ค. 2026 ให้ย้ายไปชุดเทสแบบเขียนเมื่อทีมตอบเรื่องการเขียนข้อมูล)
 *     ข้อความ 422 ที่ยืนยันในห้องทดลอง: { code: 'LEAD_NOT_READY', message: 'A budget, at least one pin and a radius are required before matching' }
 *   - DELETE match-runs ลบผลจับคู่ทั้งหมดของลีด จึงส่งเฉพาะลีดที่ไม่มีจริง
 */

/** เลขจำนวนเต็มที่มากที่สุดที่คอลัมน์ id เก็บได้ = 2^31 - 1 ใช้เป็น id ที่ไม่มีอยู่จริง */
const NO_SUCH_ID = 2_147_483_647;

/** ค่าตั้งเริ่มต้นของการจับคู่ (MATCH_DEFAULT_SETTINGS ใน lead-matching.ts:14) */
const DEFAULTS = { minScore: 50, maxScore: 100, maxResults: 10 };

/** maxResults ที่รับ (MATCH_MAX_RESULTS_OPTIONS ใน lead-matching.ts:13) */
const MAX_RESULTS_OPTIONS = [10, 20, 50, 100];

/** ลีดทั้งหมดของ qa-agent (ข้ามทั้งข้อถ้ามีเกิน 1,000 ราย) */
async function leadsOrSkip(agent: ApiSession): Promise<LeadDetail[]> {
  const leads = await allLeads(agent);
  test.skip(leads === null, 'qa-agent มีลีดเกิน 1,000 ราย ไม่อ่านทั้งหมดในเทสข้อเดียว');
  expect(leads!.length, 'qa-agent ต้องมีลีดอย่างน้อย 1 ราย ถ้าเป็น 0 ให้แจ้งทีม').toBeGreaterThan(0);
  return leads!;
}

async function settingsOf(agent: ApiSession, leadId: number): Promise<MatchSettingsResponse> {
  return expectJson<MatchSettingsResponse>(await agent.matching.settings(leadId), 200);
}

/** ลีดที่ไม่มีทั้งงบสูงสุดและหมุด (ขาด 2 อย่าง เผื่อกติกาความพร้อมเปลี่ยนไปข้อใดข้อหนึ่ง) */
function lacksBudgetAndPins(lead: LeadDetail): boolean {
  return (lead.budgetMax === null || lead.budgetMax <= 0) && lead.pins.length === 0;
}

/**
 * ผลจับคู่ล่าสุดแบบย่อ: รอบกับ [id ห้อง, คะแนน] เท่านั้น
 * ไม่เทียบการ์ดห้องทั้งก้อน เพราะถ้าเทสไม่ผ่าน Playwright จะพิมพ์ค่าที่เทียบ ซึ่งอาจมีข้อมูลของทีม
 */
async function latestSummary(agent: ApiSession, leadId: number) {
  const latest = await expectJson<MatchLatestResponse>(await agent.matching.latest(leadId), 200);
  return { run: latest.run, items: latest.items.map((item) => [item.room.id, item.score]) };
}

test.describe('a lead that does not exist', () => {
  const calls: { name: string; call: (agent: ApiSession) => ReturnType<ApiSession['matching']['settings']> }[] = [
    { name: 'GET match-settings', call: (agent) => agent.matching.settings(NO_SUCH_ID) },
    // ค่าที่ถูกต้อง จึงต้องเห็น 404 จาก requireLead (service 228) ก่อน update ที่บรรทัด 113
    { name: 'PATCH match-settings', call: (agent) => agent.matching.saveSettings(NO_SUCH_ID, { minScore: 50 }) },
    { name: 'POST match-runs', call: (agent) => agent.matching.run(NO_SUCH_ID) },
    { name: 'DELETE match-runs', call: (agent) => agent.matching.clear(NO_SUCH_ID) },
    { name: 'GET match-runs/latest', call: (agent) => agent.matching.latest(NO_SUCH_ID) },
  ];
  for (const item of calls) {
    test(`${item.name} answers 404`, async ({ agent }) => {
      // ขั้นที่ 1: เรียกเส้นทางนี้กับลีด 2147483647
      // ขั้นที่ 2: ต้องถูกปฏิเสธ: requireLead (service 228)
      expect(await expectError(await item.call(agent), 404)).toBe('Lead not found');
    });
  }

  test('GET match-settings answers 401 without login', async ({ anonymous }) => {
    // ขั้นที่ 1: อ่านค่าตั้งโดยไม่ส่งหัวข้อ Authorization
    // ขั้นที่ 2: ต้องถูกปฏิเสธ: AuthGuard ไม่มี Bearer token (auth/guards/auth.guard.ts:39,44)
    expect(await expectError(await anonymous.matching.settings(NO_SUCH_ID), 401)).toBe('Missing Bearer token');
  });

  test('GET match-settings answers 400 for a lead id out of range', async ({ agent }) => {
    // ขั้นที่ 1: อ่านค่าตั้งของลีด id 0
    // ขั้นที่ 2: ต้องถูกปฏิเสธ: ข้อความของ DatabaseIdPipe (apps/api/src/common/database-id.pipe.ts:12)
    expect(await expectError(await agent.matching.settings('0'), 400)).toBe('ID must be an integer between 1 and 2147483647');
  });
});

test.describe('reading the match of a lead of qa-agent', () => {
  test('GET match-settings returns valid effective settings and the documented defaults', async ({ agent }) => {
    // ขั้นที่ 1: อ่านค่าตั้งของลีดรายแรก
    const [lead] = await leadsOrSkip(agent);
    const body = await settingsOf(agent, lead!.id);
    // ขั้นที่ 2: ค่าเริ่มต้นตรงกับโค้ด
    expect(body.defaults).toEqual(DEFAULTS);
    // ขั้นที่ 3: ค่าที่ใช้จริงอยู่ในกติกา (คะแนน 0-100 ทีละ 5 ; สูงสุดมากกว่าต่ำสุดอย่างน้อย 5 ; maxResults ในรายการ)
    const { minScore, maxScore, maxResults } = body.effective;
    for (const score of [minScore, maxScore]) expect(Number.isInteger(score) && score >= 0 && score <= 100 && score % 5 === 0).toBe(true);
    expect(maxScore - minScore).toBeGreaterThanOrEqual(5);
    expect(MAX_RESULTS_OPTIONS).toContain(maxResults);
    // ขั้นที่ 4: ถ้ายังไม่เคยบันทึก ค่าที่ใช้คือค่าเริ่มต้น
    if (body.saved === null) expect(body.effective).toEqual(DEFAULTS);
  });

  test('GET match-runs/latest agrees with the last match shown in the lead list', async ({ agent }) => {
    // ขั้นที่ 1: เลือกลีดที่เคยจับคู่ถ้ามี (lastMatch ไม่ใช่ null ในรายการลีด) ไม่มีก็ใช้ลีดรายแรก
    const leads = await leadsOrSkip(agent);
    const matched = leads.find((lead) => (lead as unknown as { lastMatch?: unknown }).lastMatch);
    const lead = matched ?? leads[0]!;
    const lastMatch = (lead as unknown as { lastMatch?: { runId: number; resultCount: number } | null }).lastMatch ?? null;
    if (!matched) {
      test.info().annotations.push({ type: 'ไม่ได้ตรวจ', description: 'qa-agent ไม่มีลีดที่เคยจับคู่ จึงตรวจได้แค่คำตอบของลีดที่ยังไม่เคยจับคู่' });
    }

    // ขั้นที่ 2: อ่านผลจับคู่ล่าสุดของลีดนั้น
    const latest = await expectJson<MatchLatestResponse>(await agent.matching.latest(lead.id), 200);

    // ขั้นที่ 3: ลีดที่ไม่เคยจับคู่ได้ run null และรายการว่าง (service 194) ส่วนลีดที่เคยจับคู่ต้องเป็นรอบเดียวกับในรายการลีด
    // ตรวจทีละช่อง ไม่เทียบทั้งก้อน เพราะรายการมีการ์ดห้อง ถ้าไม่ผ่าน Playwright จะพิมพ์การ์ดออกมา
    if (lastMatch === null) {
      expect(latest.run).toBeNull();
      expect(latest.items.length).toBe(0);
      return;
    }
    expect(latest.run?.runId).toBe(lastMatch.runId);
    expect(latest.run?.resultCount).toBe(lastMatch.resultCount);
    // ห้องที่ถูกลบหลังจับคู่หายจากรายการ แต่ resultCount ไม่ลด (service 196-213) จึงตรวจแบบไม่เกิน
    expect(latest.items.length).toBeLessThanOrEqual(latest.run!.resultCount);
    for (const item of latest.items) expect(Number.isFinite(item.score)).toBe(true);
  });
});

test.describe('changing the match settings of a lead of qa-agent is refused', () => {
  // validateMatchSettings ตรวจ minScore, maxScore แล้ว maxResults ตามลำดับ (lead-matching.ts:86-103) ก่อน assertScoreRange (80-84)
  // แต่ละเคสแนบช่วงคะแนนที่แคบเกิน 5 เป็นด่านที่ 2 ข้อความที่คาดยังเป็นของตัวตรวจแรก
  const refused: { title: string; body: unknown; message: string }[] = [
    { title: 'minScore 3', body: { minScore: 3, maxScore: 5 }, message: 'minScore must be 0–100 in steps of 5' },
    { title: 'minScore 105', body: { minScore: 105, maxScore: 100 }, message: 'minScore must be 0–100 in steps of 5' },
    { title: 'maxResults 15', body: { maxResults: 15, minScore: 50, maxScore: 50 }, message: 'maxResults must be one of 10, 20, 50, 100' },
    { title: 'maxResults as text', body: { maxResults: '10', minScore: 50, maxScore: 50 }, message: 'maxResults must be one of 10, 20, 50, 100' },
    // ส่งทั้ง 2 ค่า ผลจึงไม่ขึ้นกับค่าที่บันทึกไว้ (assertScoreRange เทียบหลังรวมกับค่าเดิม: service 111-112) ด่านเดียว
    { title: 'maxScore equal to minScore', body: { minScore: 50, maxScore: 50 }, message: 'maxScore must be at least 5 above minScore' },
    // ด่านเดียว (lead-matching.ts:87)
    { title: 'a list instead of an object', body: [], message: 'Match settings are required' },
  ];
  for (const item of refused) {
    test(`PATCH match-settings answers 400 for ${item.title} and keeps the settings`, async ({ agent }) => {
      // ขั้นที่ 1: อ่านค่าตั้งก่อนส่ง
      const [lead] = await leadsOrSkip(agent);
      const before = await settingsOf(agent, lead!.id);
      // ขั้นที่ 2: ส่งคำขอ แล้วอ่านค่าตั้งซ้ำก่อนตรวจรหัส ถ้าต่าง แปลว่า API บันทึกแล้ว ต้องแจ้งทีม
      const response = await agent.matching.saveSettings(lead!.id, item.body);
      expect(await settingsOf(agent, lead!.id), `ลีด id ${lead!.id}: ค่าตั้งการจับคู่ถูกเปลี่ยน (รหัสตอบกลับ ${response.status()}) ให้แจ้งทีม`).toEqual(before);
      // ขั้นที่ 3: ต้องได้ 400 พร้อมข้อความของตัวตรวจ
      expect(await expectError(response, 400)).toBe(item.message);
    });
  }
});

test.describe('running a match is refused for leads that cannot be matched', () => {
  test('POST match-runs answers 409 for a booked lead', async ({ agent }) => {
    // ขั้นที่ 1: หาลีดที่จองแล้วและไม่มีทั้งงบและหมุด ถ้าตัวกัน booked (service 120) หายไป คำขอยังถูกกันด้วย 422 (122-127)
    const booked = (await leadsOrSkip(agent)).find((lead) => lead.status === 'booked' && lacksBudgetAndPins(lead));
    test.skip(!booked, 'qa-agent ไม่มีลีดสถานะ booked ที่ไม่มีทั้งงบสูงสุดและหมุด');
    const before = await latestSummary(agent, booked!.id);
    // ขั้นที่ 2: ส่งคำขอ แล้วอ่านผลจับคู่ล่าสุดซ้ำก่อนตรวจรหัส ถ้าต่าง แปลว่า API บันทึกการจับคู่แล้ว ต้องแจ้งทีม
    const response = await agent.matching.run(booked!.id);
    expect(await latestSummary(agent, booked!.id), `ลีด id ${booked!.id}: มีผลจับคู่ถูกบันทึก (รหัสตอบกลับ ${response.status()}) รอบเก่าที่เกิน 5 รอบอาจถูกลบด้วย ให้แจ้งทีม`).toEqual(before);
    // ขั้นที่ 3: กันลีด booked ก่อนจับคู่ (service 120)
    expect(await expectError(response, 409)).toBe('Booked leads are not matched');
  });
});
