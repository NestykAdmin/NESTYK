import { qaAgent2 } from '../../src/config/qa-accounts';
import { expect, test } from '../../src/fixtures/api.fixture';
import { expectJson } from '../../src/support/http';
import { expectSameAsNonexistent, findTargets, NONEXISTENT_ID, type CrossAgentTargets } from '../../src/support/cross-agent';
import { MAX_PAGE_SIZE } from '../../src/support/pagination';
import { letterLandlords, MAX_QUERY_LENGTH, searchOwners, STRIPPED_FROM_QUERY } from '../../src/support/reservation-letters';

/**
 * นายหน้าคนที่ 2 (qa-agent2) ต้องมองไม่เห็นข้อมูลของ qa-agent (อ่านอย่างเดียว ไม่สร้างและไม่แก้ข้อมูล)
 *
 * เป้าหมาย: ข้อมูลที่ติดป้าย E2E- ของ qa-agent (src/support/cross-agent.ts findTargets) หาด้วย qa-agent ตอนรัน ไม่ผูก id ตายตัว
 *   ถ้ายังไม่มีข้อมูลชนิดไหน (เช่น ยังไม่เคยรันเทสวงจรเช่าห้อง) เทสข้อที่ต้องใช้จะข้ามพร้อมเหตุผล
 * การตรวจ 2 แบบ
 *   1. รายการของ qa-agent2 ต้องไม่มี id ของ qa-agent
 *   2. เปิดด้วย id ของ qa-agent ต้องได้คำตอบเดียวกับ id ที่ไม่มีจริงทุกอย่าง (404 และข้อความเดียวกัน)
 * ที่มา (develop bc77a8b): ทุกเส้นทาง /agent/* ค้นด้วย created_by_user_id ของผู้ล็อกอิน
 *   เช่น requireLead (agent-leads.service.ts บรรทัด 335-339), รายละเอียดห้อง (agent-listings.service.ts บรรทัด 355-363),
 *   ผู้เช่า (agent-tenants.service.ts บรรทัด 200-204), สัญญา query(agentId) (agent-contracts.service.ts บรรทัด 483-493)
 * owner-users (develop accb616 R1): ค้นจากหนังสือจองของนายหน้าที่เรียก (agent-contracts.service.ts บรรทัด 3168) qa-agent2 จึงต้องค้นเจ้าของห้องของ qa-agent ไม่เจอ
 * ทุกคำขอในไฟล์นี้เป็น GET ที่อ่านอย่างเดียว ส่วน GET /bills/agent/tenants/:id ที่เขียนข้อมูลใน API รุ่นก่อน d2d4554 (กฎ ง.14) อยู่ใน tests/write/cross-agent.write.spec.ts
 */

test.skip(qaAgent2.uuid === null, `ยังไม่ได้ตั้ง ${qaAgent2.uuidVariable} (uuid ของ ${qaAgent2.email})`);

let targets: CrossAgentTargets;

test.describe('cross-agent isolation (read only)', () => {
  test.beforeEach(async ({ agent }) => {
    // อ่านเป้าหมายครั้งเดียวต่อ worker (อ่านอย่างเดียว)
    targets ??= await findTargets(agent);
  });

  test('qa-agent2 lists contain none of the qa-agent E2E data', async ({ agent2 }) => {
    // แต่ละชนิดที่ qa-agent ยังไม่มีข้อมูล ตรวจไม่ได้ จึงบันทึกไว้ในรายงาน ถ้าไม่มีสักชนิด เทสข้าม
    const kinds = [
      { name: 'ลีด', ids: targets.leadIds, read: async () => (await expectJson<{ items: { id: number }[] }>(await agent2.leads.list({ q: 'E2E-', limit: MAX_PAGE_SIZE }), 200)).items },
      { name: 'ห้อง', ids: targets.roomIds, read: async () => (await expectJson<{ items: { id: number }[] }>(await agent2.listings.list({ q: 'E2E-', limit: MAX_PAGE_SIZE }), 200)).items },
      { name: 'ผู้เช่า', ids: targets.tenantIds, read: async () => expectJson<{ id: number }[]>(await agent2.tenants.list(), 200) },
      { name: 'สัญญา', ids: targets.contractIds, read: async () => expectJson<{ id: number }[]>(await agent2.contracts.list(), 200) },
    ];
    test.skip(kinds.every((kind) => kind.ids.length === 0), 'qa-agent ยังไม่มีข้อมูลที่ติดป้าย E2E- (รัน tests/write ก่อน)');
    for (const kind of kinds) {
      if (kind.ids.length === 0) {
        test.info().annotations.push({ type: 'ไม่ได้ตรวจ', description: `qa-agent ยังไม่มี${kind.name}ที่ติดป้าย E2E-` });
        continue;
      }
      // qa-agent2 ไม่มีข้อมูล E2E- ของตัวเอง หน้าแรก 50 รายการจึงครอบรายการทั้งหมดของ qa-agent2 ที่ตรงคำค้น
      const rows = await kind.read();
      expect(rows.map((row) => row.id).filter((id) => kind.ids.includes(id)), `${kind.name}ของ qa-agent ในรายการของ qa-agent2`).toEqual([]);
    }
  });

  test('qa-agent2 cannot open a qa-agent lead, its viewings, match settings or deal offers', async ({ agent2 }) => {
    test.skip(targets.leadIds.length === 0, 'qa-agent ยังไม่มีลีดที่ติดป้าย E2E- (รัน tests/write ก่อน)');
    const leadId = targets.viewingLeadId ?? Math.max(...targets.leadIds);
    const pairs: [string, (id: number) => ReturnType<typeof agent2.leads.getById>][] = [
      ['GET /agent/leads/:id', (id) => agent2.leads.getById(id)],
      ['GET /agent/leads/:id/viewings', (id) => agent2.viewings.listForLead(id)],
      ['GET /agent/leads/:id/match-settings', (id) => agent2.matching.settings(id)],
      ['GET /agent/leads/:id/match-runs/latest', (id) => agent2.matching.latest(id)],
      ['GET /agent/leads/:leadId/deal-offers', (id) => agent2.leads.dealOffers(id)],
    ];
    for (const [what, call] of pairs) {
      await expectSameAsNonexistent(await call(leadId), await call(NONEXISTENT_ID), what);
    }
  });

  test('qa-agent2 cannot open a qa-agent room or its share links', async ({ agent2 }) => {
    test.skip(targets.roomId === undefined, 'qa-agent ยังไม่มีห้องที่ติดป้าย E2E- (รันเทสวงจรเช่าห้องก่อน)');
    const roomId = targets.roomId!;
    await expectSameAsNonexistent(await agent2.listings.getById(roomId), await agent2.listings.getById(NONEXISTENT_ID), 'GET /agent/listings/:id');
    await expectSameAsNonexistent(
      await agent2.shareLinks.list(roomId),
      await agent2.shareLinks.list(NONEXISTENT_ID),
      'GET /agent/listings/:id/share-links',
    );
  });

  test('qa-agent2 cannot open a qa-agent tenant', async ({ agent2 }) => {
    test.skip(targets.tenantId === undefined, 'qa-agent ยังไม่มีผู้เช่าที่ติดป้าย E2E- (รันเทสวงจรเช่าห้องก่อน)');
    await expectSameAsNonexistent(await agent2.tenants.getById(targets.tenantId!), await agent2.tenants.getById(NONEXISTENT_ID), 'GET /agent/tenants/:id');
  });

  test('qa-agent2 cannot open a qa-agent contract or its documents', async ({ agent2 }) => {
    test.skip(targets.contractId === undefined, 'qa-agent ยังไม่มีสัญญาที่ติดป้าย E2E- (รันเทสวงจรเช่าห้องก่อน)');
    const contractId = targets.contractId!;
    const pairs: [string, (id: number) => ReturnType<typeof agent2.contracts.getById>][] = [
      ['GET /agent/contracts/:id', (id) => agent2.contracts.getById(id)],
      ['GET /agent/contracts/:id/history', (id) => agent2.contracts.history(id)],
      ['GET /agent/contracts/:id/signatures', (id) => agent2.contracts.signatures(id)],
      ['GET /agent/contracts/:id/attachments', (id) => agent2.contracts.attachments(id)],
      ['GET /agent/contracts/:id/handover', (id) => agent2.contracts.handover(id)],
      ['GET /agent/contracts/:id/deposit-settlement', (id) => agent2.contracts.depositSettlement(id)],
    ];
    for (const [what, call] of pairs) {
      await expectSameAsNonexistent(await call(contractId), await call(NONEXISTENT_ID), what);
    }
  });

  test('qa-agent2 cannot find the landlords from qa-agent reservation letters', async ({ agent, agent2 }) => {
    // ขั้นที่ 1: เจ้าของห้องจากหนังสือจองของ qa-agent และของ qa-agent2 เอง อ่านผ่าน GET /agent/contracts (src/support/reservation-letters.ts)
    //   ต้องใช้ API ตั้งแต่ develop accb616 (ก่อนนั้น owner-users ค้นบัญชีเจ้าของห้องทั้งระบบ ข้อนี้จึงไม่ผ่าน)
    const own = await letterLandlords(agent.contracts);
    test.skip(own.size === 0, 'qa-agent ยังไม่มีหนังสือจองที่กรอกอีเมลเจ้าของห้อง (รันเทสวงจรเช่าห้องก่อน)');
    const intruderOwn = await letterLandlords(agent2.contracts);
    // ค่าทุกช่องที่ API ค้น (อีเมล เบอร์ ชื่อ) ในหนังสือของ qa-agent2 ตัวพิมพ์เล็ก API ค้นแบบมีคำอยู่ข้างใน (%q% บรรทัด 3144, 3172-3176)
    const intruderValues = [...intruderOwn.values()].flatMap((l) => [l.email, ...l.phones, ...l.names]).map((v) => v.toLowerCase());

    // ขั้นที่ 2: คำค้น = อีเมลและเบอร์ 1 เบอร์ของเจ้าของห้องไม่เกิน 5 ราย ข้ามค่าที่มี % _ \ (API ตัดทิ้ง) หรือยาวเกิน 80 ตัว
    //   และข้ามค่าที่อยู่ในหนังสือจองของ qa-agent2 เอง (qa-agent2 ค้นเจอหนังสือของตัวเองได้ตามปกติ ข้อนั้นจึงตัดสินไม่ได้)
    const targets = [...own.values()].filter((l) => !STRIPPED_FROM_QUERY.test(l.email) && l.email.length <= MAX_QUERY_LENGTH).slice(0, 5);
    const candidates = targets.flatMap((l) => [l.email, ...l.phones.filter((p) => !STRIPPED_FROM_QUERY.test(p)).slice(0, 1)].map((q) => ({ q, owner: l })));
    const searches = candidates.filter(({ q }) => !intruderValues.some((v) => v.includes(q.toLowerCase())));
    if (searches.length < candidates.length) {
      test.info().annotations.push({ type: 'ไม่ได้ตรวจ', description: `${candidates.length - searches.length} คำค้นตรงกับหนังสือจองของ qa-agent2 เอง` });
    }
    test.skip(searches.length === 0, 'ไม่มีคำค้นที่ใช้ได้ (อีเมลใช้เป็นคำค้นไม่ได้ หรือตรงกับหนังสือจองของ qa-agent2 เอง)');

    // ขั้นที่ 3: ตัวคุม: qa-agent ค้นด้วยคำแรก (อีเมลหรือเบอร์) ต้องเจออีเมลของเจ้าของห้องคนนั้นพอดี 1 แถว
    //   (ถ้าไม่มีขั้นนี้ การค้นที่พังจนได้รายการว่างเสมอจะทำให้ขั้นที่ 4 ผ่าน)
    const control = await searchOwners(agent.contracts, searches[0].q);
    const controlRows = control.filter((o) => o.email.toLowerCase() === searches[0].owner.email.toLowerCase()).length;
    expect(controlRows, 'ตัวคุม: qa-agent ค้นเจ้าของห้องของตัวเองต้องเจอ 1 แถว').toBe(1);

    // ขั้นที่ 4: qa-agent2 ค้นทุกคำต้องได้รายการว่าง (ข้อความไม่ใส่คำค้น และ searchOwners ไม่พิมพ์ที่อยู่ เพราะเป็นข้อมูลส่วนตัว)
    for (const [index, { q }] of searches.entries()) {
      const owners = await searchOwners(agent2.contracts, q);
      expect(owners.length, `ผลค้นของ qa-agent2 คำค้นที่ ${index + 1}`).toBe(0);
    }

    // ขั้นที่ 5: % และ _ (API ตัดทิ้ง คำค้นจึงเป็น %% ซึ่งตรงกับทุกแถวที่ผู้เรียกค้นได้) ต้องได้รายการว่าง
    //   ใช้ได้เฉพาะเมื่อ qa-agent2 ไม่มีหนังสือจองของตัวเอง ถ้ามี ผลจะมีเจ้าของห้องของ qa-agent2 เอง ข้อนี้จึงตัดสินไม่ได้
    if (intruderOwn.size > 0) {
      test.info().annotations.push({ type: 'ไม่ได้ตรวจ', description: 'ค้นด้วย % และ _: qa-agent2 มีหนังสือจองของตัวเอง' });
      return;
    }
    for (const q of ['%', '_']) {
      const owners = await searchOwners(agent2.contracts, q);
      expect(owners.length, `ผลค้นของ qa-agent2 ด้วย ${q}`).toBe(0);
    }
  });
});
