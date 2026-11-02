import { qaAgent2 } from '../../src/config/qa-accounts';
import { expect, test } from '../../src/fixtures/api.fixture';
import { expectJson } from '../../src/support/http';
import { expectSameAsNonexistent, findTargets, NONEXISTENT_ID, type CrossAgentTargets } from '../../src/support/cross-agent';
import { MAX_PAGE_SIZE } from '../../src/support/pagination';

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
 * ทุกคำขอในไฟล์นี้เป็น GET ที่อ่านอย่างเดียว ส่วน GET /bills/agent/tenants/:id ที่เขียนข้อมูล (กฎ ง.14) อยู่ใน tests/write/cross-agent.write.spec.ts
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
});
