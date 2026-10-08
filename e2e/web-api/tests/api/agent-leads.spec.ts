import type { LeadsQuery } from '../../src/api/leads.api';
import type { Lead, LeadDisplayStatus, LeadList, LeadProvince, LeadStatus, Paginated, VisaType } from '../../src/api/types';
import { expect, test, type ApiSession } from '../../src/fixtures/api.fixture';
import { expectError, expectJson } from '../../src/support/http';
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  isAscending,
  isDescending,
  pagingFallbackCases,
  walkAllPages,
} from '../../src/support/pagination';

/**
 * ลีด (ผู้สนใจเช่า) ของนายหน้า: รายการ รายละเอียด และรายการตัวเลือกที่ฟอร์มลีดใช้
 *
 * สิ่งที่ต้องมีก่อน
 *   - ล็อกอินแบบนักพัฒนาได้ (ดู auth.spec.ts)
 *   - บัญชีตัวอย่างมีลีดอย่างน้อย 1 ราย (ข้อมูลตัวอย่างของทีมให้ 9 ราย)
 * เทสไฟล์นี้อ่านอย่างเดียว และไม่ผูกกับจำนวนลีดที่แน่นอน
 */

/** สถานะของลีดที่ฐานข้อมูลยอมรับ (ข้อบังคับ chk_leads_status) เรียงตามลำดับที่ API ใช้ตอนเรียงตามสถานะ */
const STATUS_ORDER: LeadStatus[] = ['new', 'inprogress', 'booked', 'lost'];

/** สถานะที่ตัวกรอง status รับ และเป็นชื่อช่องของ statusCounts (ที่มา: DISPLAY_STATUSES ในโค้ดของ API) */
const DISPLAY_STATUSES: LeadDisplayStatus[] = ['new', 'inprogress', 'viewing', 'booked', 'lost'];

/** ค่าการเรียงทั้งหมดที่ API รับ (ที่มา: LEAD_SORTS ในโค้ดของ API) */
const SORTS = [
  'created_desc',
  'created_asc',
  'updated_desc',
  'name_asc',
  'budget_asc',
  'budget_desc',
  'status_asc',
  'status_desc',
];

/** จำนวนหมุดทำเลสูงสุดต่อลีด 1 ราย ตามกติกาของ API */
const MAX_PINS = 3;

/** จำนวนจังหวัดของประเทศไทย (76 จังหวัด + กรุงเทพมหานคร) */
const THAI_PROVINCE_COUNT = 77;

/** เลขจำนวนเต็มที่มากที่สุดที่คอลัมน์ id (ชนิด integer ของ PostgreSQL) เก็บได้ = 2^31 - 1 */
const INT32_MAX = 2_147_483_647;

/** งบที่ API ใช้ตอนเรียงตามงบ: งบขั้นต่ำ ถ้าไม่มีให้ใช้งบสูงสุด ถ้าไม่มีทั้งคู่ถือว่าไม่ระบุงบ */
function sortBudget(lead: Lead): number | null {
  return lead.budgetMin ?? lead.budgetMax;
}

/** ดึงลีดมาให้มากที่สุดใน 1 หน้า (เท่าเพดานของ API) ตามการเรียงที่กำหนด */
async function listLeads(agent: ApiSession, sort?: string): Promise<Paginated<Lead>> {
  const query: LeadsQuery = { limit: MAX_PAGE_SIZE };
  if (sort) query.sort = sort;
  const body = await expectJson<Paginated<Lead>>(await agent.leads.list(query), 200);
  // รายการว่างทำให้การตรวจลำดับผ่านโดยไม่ได้ตรวจอะไร จึงยืนยันตรงนี้ที่เดียวว่ามีข้อมูล
  expect(body.items.length, `sort=${sort ?? 'ค่าเริ่มต้น'}: บัญชีตัวอย่างต้องมีลีดอย่างน้อย 1 ราย`).toBeGreaterThan(0);
  return body;
}

test.describe('GET /agent/leads', () => {
  test('returns the first page with default paging', { tag: '@smoke' }, async ({ agent }) => {
    // ขั้นที่ 1: เรียกรายการลีดโดยไม่ส่งค่าแบ่งหน้า
    const body = await expectJson<Paginated<Lead>>(await agent.leads.list(), 200);

    // ขั้นที่ 2: ต้องได้หน้า 1 ขนาดหน้าเริ่มต้น และมีลีดอย่างน้อย 1 ราย (จากข้อมูลตัวอย่าง)
    expect(body.page).toBe(1);
    expect(body.limit).toBe(DEFAULT_PAGE_SIZE);
    expect(body.total, 'บัญชีตัวอย่างต้องมีลีดอย่างน้อย 1 ราย ถ้าเป็น 0 ให้ใส่ข้อมูลตัวอย่างของทีมก่อน').toBeGreaterThan(0);

    // ขั้นที่ 3: จำนวนรายการในหน้านี้ = ค่าที่น้อยกว่าระหว่าง total กับขนาดหน้า
    expect(body.items).toHaveLength(Math.min(body.total, DEFAULT_PAGE_SIZE));
  });

  test('every lead carries valid core fields', async ({ agent }) => {
    // ขั้นที่ 1: ดึงลีดมาให้มากที่สุดใน 1 หน้า
    const body = await listLeads(agent);

    // ขั้นที่ 2: ตรวจทีละราย
    for (const lead of body.items) {
      const label = `ลีด id ${lead.id}`;
      expect(Number.isInteger(lead.id) && lead.id > 0, label).toBe(true);
      // ชื่อและเบอร์โทรเป็นช่องบังคับตอนสร้างลีด
      expect(lead.name.trim().length, label).toBeGreaterThan(0);
      expect(lead.phone.trim().length, label).toBeGreaterThan(0);
      expect(STATUS_ORDER, label).toContain(lead.status);
      // งบ: ถ้าระบุทั้งขั้นต่ำและสูงสุด ขั้นต่ำต้องไม่เกินสูงสุด
      if (lead.budgetMin !== null && lead.budgetMax !== null) {
        expect(lead.budgetMin, label).toBeLessThanOrEqual(lead.budgetMax);
      }
      // หมุดทำเล: ไม่เกิน 3 หมุด และลำดับ (rank) นับ 1, 2, 3 ต่อเนื่อง
      expect(lead.pins.length, label).toBeLessThanOrEqual(MAX_PINS);
      expect(lead.pins.map((pin) => pin.rank), label).toEqual(lead.pins.map((_, index) => index + 1));
      expect(Number.isNaN(Date.parse(lead.createdAt)), label).toBe(false);
    }

    // ขั้นที่ 3: ใน 1 หน้าต้องไม่มีลีดซ้ำ
    const ids = body.items.map((lead) => lead.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('pages do not overlap and together contain every lead', async ({ agent }) => {
    // ขั้นที่ 1: อ่าน total ก่อน แล้วเลือกขนาดหน้าที่ทำให้ได้ประมาณ 3 หน้า (ไม่เกินเพดานของ API)
    const { total } = await expectJson<Paginated<Lead>>(await agent.leads.list({ limit: 1 }), 200);
    const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.ceil(total / 3)));
    test.skip(total > MAX_PAGE_SIZE * 20, `มี ${total} ราย มากเกินกว่าจะเดินอ่านทุกหน้าในเทสข้อเดียว`);

    // ขั้นที่ 2: เดินอ่านทุกหน้า โดยเรียงตามเวลาที่สร้าง ซึ่งไม่เปลี่ยนระหว่างรัน
    //   (ลำดับเริ่มต้นคือเวลาที่แก้ล่าสุด ซึ่งขยับได้เมื่อมีการจับคู่ห้องหรือนัดดูห้อง ลีดจึงอาจย้ายหน้ากลางทาง)
    const walk = await walkAllPages((query) => agent.leads.list({ ...query, sort: 'created_asc' }), limit);

    // ขั้นที่ 3: จำนวนที่อ่านได้ต้องเท่ากับ total และไม่มี id ซ้ำข้ามหน้า
    expect(walk.ids).toHaveLength(walk.total);
    expect(new Set(walk.ids).size).toBe(walk.total);

    // ขั้นที่ 4: ทุกหน้าต้องเต็ม ยกเว้นหน้าสุดท้ายที่มีเท่าที่เหลือ
    const lastPageSize = walk.total - limit * (walk.pageSizes.length - 1);
    expect(walk.pageSizes.slice(0, -1).every((size) => size === limit)).toBe(true);
    expect(walk.pageSizes.at(-1)).toBe(lastPageSize);
  });

  test('a page past the end is empty but still reports the total', async ({ agent }) => {
    // ขั้นที่ 1: หาหมายเลขหน้าที่เลยหน้าสุดท้าย = ปัดขึ้น(total / limit) + 1
    const limit = 5;
    const first = await expectJson<Paginated<Lead>>(await agent.leads.list({ limit }), 200);
    const pagePastEnd = Math.ceil(first.total / limit) + 1;

    // ขั้นที่ 2: ขอหน้านั้น ต้องได้รายการว่าง โดย total ยังเท่าเดิม
    const body = await expectJson<Paginated<Lead>>(await agent.leads.list({ limit, page: pagePastEnd }), 200);
    expect(body.items).toEqual([]);
    expect(body.total).toBe(first.total);
    expect(body.page).toBe(pagePastEnd);
  });

  for (const paging of pagingFallbackCases) {
    test(`paging: ${paging.title}`, async ({ agent }) => {
      // ขั้นที่ 1: ส่งค่าแบ่งหน้าที่ใช้ไม่ได้   ขั้นที่ 2: API ต้องไม่ล้ม และตอบด้วยค่าที่ปรับให้ปลอดภัยแล้ว
      const body = await expectJson<Paginated<Lead>>(await agent.leads.list(paging.query), 200);
      expect({ page: body.page, limit: body.limit }).toEqual(paging.expected);
      expect(body.items.length).toBeLessThanOrEqual(paging.expected.limit);
    });
  }

  test('every sort option returns the same leads, only in a different order', async ({ agent }) => {
    // ขั้นที่ 1: ใช้ลำดับเริ่มต้นเป็นตัวตั้ง
    const expectedIds = (await listLeads(agent)).items.map((lead) => lead.id).sort((a, b) => a - b);

    // ขั้นที่ 2: ลองทุกค่าการเรียง ชุดของ id ต้องเหมือนเดิม (การเรียงต้องไม่ทำให้ลีดหายหรือซ้ำ)
    for (const sort of SORTS) {
      const ids = (await listLeads(agent, sort)).items.map((lead) => lead.id).sort((a, b) => a - b);
      expect(ids, `sort=${sort}`).toEqual(expectedIds);
    }
  });

  test('the default order is the same as updated_desc', async ({ agent }) => {
    // ที่มาของค่าที่คาด: โค้ดของ API (normalizeLeadSort) ใช้ updated_desc เมื่อไม่ระบุการเรียง ตั้งแต่ commit 74787c1
    //   (ก่อนหน้านั้นค่าเริ่มต้นคือ created_desc)
    // คำตอบของ API ไม่มีเวลาที่แก้ล่าสุด จึงตรวจด้วยการเทียบลำดับ id กับตอนที่ระบุ updated_desc ตรง ๆ
    const ids = (body: Paginated<Lead>) => body.items.map((lead) => lead.id);

    // ขั้นที่ 1: ดึงลำดับของ updated_desc กับ created_desc มาเทียบกันก่อน
    //   ถ้าลีดทุกรายยังไม่เคยถูกแก้ สองลำดับนี้จะเหมือนกัน เทสจึงแยกไม่ได้ว่าค่าเริ่มต้นเป็นตัวไหน ให้ข้ามแทนที่จะผ่านโดยไม่ได้ตรวจ
    const byUpdated = await listLeads(agent, 'updated_desc');
    const byCreated = await listLeads(agent, 'created_desc');
    test.skip(
      JSON.stringify(ids(byUpdated)) === JSON.stringify(ids(byCreated)),
      'ลำดับของ updated_desc กับ created_desc เหมือนกันทุกตำแหน่ง (ยังไม่มีลีดที่ถูกแก้หลังสร้าง) จึงแยกค่าเริ่มต้นไม่ได้',
    );

    // ขั้นที่ 2: ไม่ระบุการเรียง   ขั้นที่ 3: ลำดับของ id ต้องเหมือน updated_desc ทุกตำแหน่ง
    const byDefault = await listLeads(agent);
    expect(ids(byDefault)).toEqual(ids(byUpdated));
  });

  test('created_desc is newest first, and created_asc is the reverse', async ({ agent }) => {
    // ขั้นที่ 1: created_desc เวลาที่สร้างต้องเรียงจากใหม่ไปเก่า
    const newestFirst = await listLeads(agent, 'created_desc');
    expect(isDescending(newestFirst.items.map((lead) => Date.parse(lead.createdAt)))).toBe(true);

    // ขั้นที่ 2: created_asc ต้องเรียงจากเก่าไปใหม่
    const oldestFirst = await listLeads(agent, 'created_asc');
    expect(isAscending(oldestFirst.items.map((lead) => Date.parse(lead.createdAt)))).toBe(true);

    // ขั้นที่ 3: เมื่อลีดทั้งหมดอยู่ในหน้าเดียว ลำดับ id ของสองทิศต้องกลับด้านกันพอดี
    //   ที่มา: applyLeadSort ใช้ id เป็นตัวตัดสินเมื่อเวลาเท่ากัน (id จากมากไปน้อยใน created_desc และน้อยไปมากใน created_asc)
    //   ข้อนี้จับกรณีที่เวลาสร้างเท่ากันทุกราย ซึ่งขั้นที่ 1 กับ 2 ผ่านได้ไม่ว่า API จะเรียงแบบไหน
    if (newestFirst.total <= MAX_PAGE_SIZE) {
      expect(oldestFirst.items.map((lead) => lead.id)).toEqual(newestFirst.items.map((lead) => lead.id).reverse());
    }
  });

  test('budget sorts order by budget and keep leads without a budget last', async ({ agent }) => {
    for (const [sort, inOrder] of [
      ['budget_asc', isAscending],
      ['budget_desc', isDescending],
    ] as const) {
      // ขั้นที่ 1: ขอรายการเรียงตามงบ
      const body = await listLeads(agent, sort);
      const budgets = body.items.map(sortBudget);
      const withBudget = budgets.filter((value): value is number => value !== null);

      // ขั้นที่ 2: ลีดที่ระบุงบต้องเรียงถูกทิศ
      expect(inOrder(withBudget), `sort=${sort}`).toBe(true);

      // ขั้นที่ 3: ลีดที่ไม่ระบุงบต้องอยู่ท้ายรายการเสมอ ไม่ว่าเรียงทิศไหน
      expect(budgets.slice(withBudget.length).every((value) => value === null), `sort=${sort}`).toBe(true);
    }
  });

  test('status sorts follow the pipeline order new, inprogress, booked, lost', async ({ agent }) => {
    // แปลงสถานะเป็นเลขลำดับตามขั้นของงานขาย เพื่อตรวจการเรียงด้วยตัวเลข
    const rank = (lead: Lead) => STATUS_ORDER.indexOf(lead.status);

    // ขั้นที่ 1: status_asc ต้องไล่จากลีดใหม่ไปลีดที่ปิดไม่ได้
    expect(isAscending((await listLeads(agent, 'status_asc')).items.map(rank))).toBe(true);

    // ขั้นที่ 2: status_desc ต้องไล่ย้อนกลับ
    expect(isDescending((await listLeads(agent, 'status_desc')).items.map(rank))).toBe(true);
  });

  test('answers 400 for a sort option that does not exist', async ({ agent }) => {
    // ขั้นที่ 1: ส่งค่าการเรียงที่ API ไม่รู้จัก   ขั้นที่ 2: ต้องได้ 400 พร้อมข้อความบอกสาเหตุ
    const message = await expectError(await agent.leads.list({ sort: 'e2e-unknown-sort' }), 400);
    expect(message.length).toBeGreaterThan(0);
  });

  test('answers 400 for a status filter that does not exist', async ({ agent }) => {
    // ขั้นที่ 1: ส่งสถานะที่ API ไม่รู้จัก และสถานะที่สะกดด้วยตัวพิมพ์ใหญ่
    //   (ที่มา: normalizeLeadStatusFilter ในโค้ดของ API เทียบกับรายการสถานะแบบตรงตัว จึงรับเฉพาะตัวพิมพ์เล็ก)
    for (const status of ['e2e-unknown-status', 'NEW']) {
      // ขั้นที่ 2: ต้องได้ 400 พร้อมข้อความบอกสาเหตุ
      const message = await expectError(await agent.leads.list({ status }), 400);
      expect(message.length, `status=${status}`).toBeGreaterThan(0);
    }
  });

  test('status counts cover every display status and add up to the total', async ({ agent }) => {
    // ขั้นที่ 1: เรียกรายการโดยไม่กรองสถานะ
    const body = await expectJson<LeadList>(await agent.leads.list({ limit: 1 }), 200);
    expect(body.total, 'บัญชีตัวอย่างต้องมีลีดอย่างน้อย 1 ราย').toBeGreaterThan(0);

    // ขั้นที่ 2: statusCounts ต้องมีครบ 5 สถานะ ไม่ขาดไม่เกิน และทุกค่าเป็นจำนวนเต็มที่ไม่ติดลบ
    expect(Object.keys(body.statusCounts).sort()).toEqual([...DISPLAY_STATUSES].sort());
    for (const status of DISPLAY_STATUSES) {
      const count = body.statusCounts[status];
      expect(Number.isInteger(count) && count >= 0, `statusCounts.${status} = ${count}`).toBe(true);
    }

    // ขั้นที่ 3: ลีด 1 รายอยู่ได้สถานะเดียว ผลรวมของทุกสถานะจึงต้องเท่ากับ total
    //   (ที่มา: countByDisplayStatus ในโค้ดของ API นับจากเงื่อนไขชุดเดียวกับรายการ โดยจัดกลุ่มตามสถานะที่แอปแสดง)
    const sum = DISPLAY_STATUSES.reduce((acc, status) => acc + body.statusCounts[status], 0);
    expect(sum).toBe(body.total);
  });

  test('each status filter returns only matching leads and agrees with its count', async ({ agent }) => {
    // ขั้นที่ 1: อ่านจำนวนของแต่ละสถานะจากรายการที่ไม่กรอง
    const all = await expectJson<LeadList>(await agent.leads.list({ limit: 1 }), 200);
    expect(all.total, 'บัญชีตัวอย่างต้องมีลีดอย่างน้อย 1 ราย').toBeGreaterThan(0);
    if (all.statusCounts.viewing === 0) {
      // บันทึกลงรายงานว่ากลุ่ม viewing ไม่ถูกตรวจในรอบนี้ คนอ่านผลจะได้ไม่เข้าใจว่าตรวจครบ 5 สถานะ
      test.info().annotations.push({ type: 'ไม่ได้ตรวจ', description: 'ไม่มีลีดที่มีนัดดูห้อง กลุ่ม viewing จึงได้รายการว่างและไม่ถูกตรวจรายลีด' });
    }
    let filteredTotal = 0;

    for (const status of DISPLAY_STATUSES) {
      const label = `status=${status}`;
      // ขั้นที่ 2: กรองทีละสถานะ
      const body = await expectJson<LeadList>(await agent.leads.list({ status, limit: MAX_PAGE_SIZE }), 200);

      // ขั้นที่ 3: total ต้องเท่ากับจำนวนของสถานะนั้น ส่วน statusCounts นับก่อนกรอง จึงต้องเท่ากับตอนไม่กรอง
      //   (ที่มา: โค้ดของ API คัดลอกเงื่อนไขไว้นับ statusCounts ก่อนใส่ตัวกรอง status)
      expect(body.total, label).toBe(all.statusCounts[status]);
      expect(body.statusCounts, label).toEqual(all.statusCounts);
      expect(body.items, label).toHaveLength(Math.min(body.total, MAX_PAGE_SIZE));
      filteredTotal += body.total;

      // ขั้นที่ 4: ทุกรายในผลต้องตรงกับสถานะที่ขอ
      //   (ข้อมูลตัวอย่างของทีมไม่มีนัดดูห้อง สถานะ viewing จึงได้รายการว่าง และวงนี้ไม่ได้ตรวจลีดรายไหนจนกว่าจะมีเทสที่สร้างนัด)
      for (const lead of body.items) {
        const leadLabel = `${label} ลีด id ${lead.id}`;
        if (status === 'viewing') {
          // viewing = ลีดสถานะ new หรือ inprogress ที่มีนัดดูห้องซึ่งยังไม่ถึงเวลา
          expect(['new', 'inprogress'], leadLabel).toContain(lead.status);
          expect(lead.nextViewingAt, leadLabel).not.toBeNull();
        } else {
          expect(lead.status, leadLabel).toBe(status);
          // ลีด new หรือ inprogress ที่มีนัดซึ่งยังไม่ถึงเวลา ต้องไปอยู่ในกลุ่ม viewing ไม่ใช่กลุ่มนี้
          if (status === 'new' || status === 'inprogress') expect(lead.nextViewingAt, leadLabel).toBeNull();
        }
      }
    }

    // ขั้นที่ 5: ผลของตัวกรองทั้ง 5 สถานะรวมกัน ต้องได้ลีดครบเท่ากับตอนไม่กรอง
    expect(filteredTotal).toBe(all.total);
  });

  test('search finds a lead by name', async ({ agent }) => {
    // ขั้นที่ 1: หยิบชื่อของลีดจริง 1 รายมาเป็นคำค้น
    const all = await listLeads(agent);
    expect(all.items.length, 'บัญชีตัวอย่างต้องมีลีดอย่างน้อย 1 ราย').toBeGreaterThan(0);
    const target = all.items[0]!;

    // ขั้นที่ 2: ค้นด้วยชื่อนั้น ผลต้องมีลีดรายนั้นอยู่ด้วย
    const found = await expectJson<Paginated<Lead>>(await agent.leads.list({ q: target.name, limit: MAX_PAGE_SIZE }), 200);
    expect(found.items.map((lead) => lead.id)).toContain(target.id);
  });

  test('search with no match returns an empty list', async ({ agent }) => {
    // ขั้นที่ 1: ค้นด้วยคำที่ไม่มีทางตรงกับลีดรายไหน   ขั้นที่ 2: ต้องได้รายการว่างและ total เป็น 0
    const body = await expectJson<Paginated<Lead>>(await agent.leads.list({ q: 'e2e-no-lead-has-this-text-7f3a' }), 200);
    expect(body).toMatchObject({ items: [], total: 0 });
  });

  test('province filter accepts the English name and returns leads of that province only', async ({ agent }) => {
    // ขั้นที่ 1: หาลีดที่มีจังหวัดตรงกับรายการจังหวัดของระบบ
    const provinces = await expectJson<LeadProvince[]>(await agent.leads.locations(), 200);
    const all = await listLeads(agent);
    const target = all.items.find((lead) => provinces.some((province) => province.name === lead.province));
    test.skip(!target, 'ไม่มีลีดที่ระบุจังหวัดตามรายการของระบบ จึงทดสอบการกรองจังหวัดไม่ได้');
    const province = provinces.find((item) => item.name === target!.province)!;

    // ขั้นที่ 2: กรองด้วยชื่อจังหวัดภาษาอังกฤษ (API ต้องแปลงเป็นชื่อมาตรฐานภาษาไทยให้เอง)
    const body = await expectJson<Paginated<Lead>>(
      await agent.leads.list({ province: province.nameEn, limit: MAX_PAGE_SIZE }),
      200,
    );

    // ขั้นที่ 3: ผลต้องมีลีดรายนั้น และทุกรายต้องอยู่จังหวัดเดียวกัน
    expect(body.items.map((lead) => lead.id)).toContain(target!.id);
    expect(body.items.every((lead) => lead.province === province.name)).toBe(true);
  });

  test('locations filter returns leads interested in that area', async ({ agent }) => {
    // ขั้นที่ 1: หาลีดที่ระบุทั้งจังหวัดมาตรฐานและเขตหรืออำเภอ
    const provinces = await expectJson<LeadProvince[]>(await agent.leads.locations(), 200);
    const all = await listLeads(agent);
    const target = all.items.find(
      (lead) => lead.locations.length > 0 && provinces.some((province) => province.name === lead.province),
    );
    test.skip(!target, 'ไม่มีลีดที่ระบุเขตหรืออำเภอ จึงทดสอบการกรองทำเลไม่ได้');
    const area = target!.locations[0]!;

    // ขั้นที่ 2: กรองด้วยจังหวัดกับเขตนั้น (ค่า locations ต้องส่งเป็นข้อความ JSON)
    const body = await expectJson<Paginated<Lead>>(
      await agent.leads.list({ province: target!.province!, locations: JSON.stringify([area]), limit: MAX_PAGE_SIZE }),
      200,
    );

    // ขั้นที่ 3: ผลต้องมีลีดรายนั้น และทุกรายต้องสนใจเขตนั้น
    expect(body.items.map((lead) => lead.id)).toContain(target!.id);
    expect(body.items.every((lead) => lead.locations.includes(area))).toBe(true);
  });

  const invalidFilters = [
    { name: 'a province that does not exist', query: { province: 'Atlantis' } },
    { name: 'locations that is not JSON', query: { locations: 'not-json' } },
    { name: 'locations that is not a list of text', query: { locations: '[1,2]' } },
    { name: 'locations without a province', query: { locations: '["e2e-area"]' } },
  ];
  for (const invalid of invalidFilters) {
    test(`answers 400 for ${invalid.name}`, async ({ agent }) => {
      // ขั้นที่ 1: ส่งตัวกรองที่ผิดกติกา   ขั้นที่ 2: ต้องได้ 400 พร้อมข้อความบอกสาเหตุ
      const message = await expectError(await agent.leads.list(invalid.query), 400);
      expect(message.length).toBeGreaterThan(0);
    });
  }

  test('answers 400 when the same query parameter is sent twice', async ({ agent }) => {
    // ขั้นที่ 1: ส่ง q ซ้ำ 2 ครั้งในที่อยู่เดียว (เฟรมเวิร์กจะแปลงค่าเป็นรายการ ซึ่ง API ไม่รับ)
    const response = await agent.client.get('agent/leads?q=a&q=b');

    // ขั้นที่ 2: ต้องได้ 400 ไม่ใช่ 500
    await expectError(response, 400);
  });
});

test.describe('GET /agent/leads/:id', () => {
  test('returns the same lead that the list shows', { tag: '@smoke' }, async ({ agent }) => {
    // ขั้นที่ 1: หยิบลีดแรกจากรายการ
    const list = await expectJson<LeadList>(await agent.leads.list({ limit: 1 }), 200);
    expect(list.items, 'บัญชีตัวอย่างต้องมีลีดอย่างน้อย 1 ราย').toHaveLength(1);
    const summary = list.items[0]!;

    // ขั้นที่ 2: แยกช่อง lastMatch ออกจากรายการก่อนเทียบ
    //   ตั้งแต่ commit 74787c1 รายการส่ง lastMatch (ผลจับคู่ห้องครั้งล่าสุด หรือ null) แต่หน้ารายละเอียดไม่ส่งช่องนี้
    //   ถ้าวันหนึ่งหน้ารายละเอียดส่งช่องนี้ด้วย เทสข้อนี้จะแดง เพื่อเตือนให้กลับมาเทียบช่องนี้ด้วย
    const { lastMatch, ...sharedFields } = summary;
    expect(lastMatch === null || (typeof lastMatch === 'object' && !Array.isArray(lastMatch)), 'lastMatch ในรายการต้องเป็น null หรือวัตถุ').toBe(true);

    // ขั้นที่ 3: เปิดรายละเอียดด้วย id ของลีดรายนั้น   ขั้นที่ 4: ช่องที่เหลือต้องตรงกับในรายการทุกช่อง
    const detail = await expectJson<Lead>(await agent.leads.getById(summary.id), 200);
    expect(detail).toEqual(sharedFields);
  });

  test('answers 404 for an id that does not exist', async ({ agent }) => {
    // ขั้นที่ 1: ใช้ id ที่มากที่สุดที่ฐานข้อมูลเก็บได้ ซึ่งไม่มีลีดรายไหนใช้   ขั้นที่ 2: ต้องได้ 404
    await expectError(await agent.leads.getById(INT32_MAX), 404);
  });

  test('answers 400 for an id that is not a whole number', async ({ agent }) => {
    // ขั้นที่ 1: ส่ง id ที่เป็นตัวอักษร และ id ที่เป็นทศนิยม   ขั้นที่ 2: ต้องได้ 400 ทั้งคู่
    await expectError(await agent.leads.getById('abc'), 400);
    await expectError(await agent.leads.getById('1.5'), 400);
  });

  test(
    'answers with a client error for an id above the 32-bit integer range',
    {
      tag: '@known-bug',
      annotation: {
        type: 'issue',
        description: 'id ที่เกิน 2147483647 ทำให้ API ตอบ 500 (ฐานข้อมูลแจ้ง out of range for type integer) ควรตอบ 404 หรือ 400',
      },
    },
    async ({ agent }) => {
      // test.fail = บอก Playwright ว่าเทสข้อนี้ "ต้องไม่ผ่าน" ในตอนนี้ เพราะเป็นบั๊กที่รู้แล้วและรอแก้
      // (คำอธิบายเต็มอยู่ใน agent-listings.spec.ts)
      test.fail(true, 'API ตอบ 500 เมื่อ id เกินช่วงของ integer');

      // ขั้นที่ 1: ส่ง id ที่มากกว่าค่าสูงสุดของ integer อยู่ 1
      const response = await agent.leads.getById(INT32_MAX + 1);

      // ขั้นที่ 2: ที่ถูกต้องคือปฏิเสธแบบความผิดของผู้เรียก (404 หรือ 400) ไม่ใช่ความผิดของเซิร์ฟเวอร์ (500)
      expect([400, 404]).toContain(response.status());
    },
  );
});

test.describe('lead form catalogs', () => {
  test('GET /agent/leads/visa-types lists selectable visa types with unique codes', async ({ agent }) => {
    // ขั้นที่ 1: ดึงรายการประเภทวีซ่า
    const visaTypes = await expectJson<VisaType[]>(await agent.leads.visaTypes(), 200);

    // ขั้นที่ 2: ต้องมีอย่างน้อย 1 รายการ แต่ละรายการมี id กับ code และ code ต้องไม่ซ้ำกัน
    expect(visaTypes.length).toBeGreaterThan(0);
    for (const visaType of visaTypes) {
      expect(Number.isInteger(visaType.id), JSON.stringify(visaType)).toBe(true);
      expect(visaType.code, JSON.stringify(visaType)).toMatch(/^[a-z0-9_]+$/);
    }
    const codes = visaTypes.map((visaType) => visaType.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  test('GET /agent/leads/locations lists all 77 Thai provinces', async ({ agent }) => {
    // ขั้นที่ 1: ดึงรายการจังหวัด
    const provinces = await expectJson<LeadProvince[]>(await agent.leads.locations(), 200);

    // ขั้นที่ 2: ต้องครบ 77 จังหวัด และชื่อไม่ซ้ำกัน
    expect(provinces).toHaveLength(THAI_PROVINCE_COUNT);
    expect(new Set(provinces.map((province) => province.name)).size).toBe(THAI_PROVINCE_COUNT);

    // ขั้นที่ 3: ทุกจังหวัดต้องมีชื่อไทย ชื่ออังกฤษ และรายการเขตหรืออำเภอ (ว่างได้ถ้ายังไม่มีข้อมูล)
    for (const province of provinces) {
      expect(province.name.trim().length, JSON.stringify(province)).toBeGreaterThan(0);
      expect(province.nameEn.trim().length, JSON.stringify(province)).toBeGreaterThan(0);
      expect(Array.isArray(province.locations), province.name).toBe(true);
    }
  });
});
