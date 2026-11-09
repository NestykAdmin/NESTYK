import { test, expect } from '../../src/web-ui/web-ui.fixture';
import { AgentShell } from '../../src/web-ui/pages/agent-shell.page';
import { LeadForm, openLead } from '../../src/web-ui/pages/lead-write.page';
import { FLOW, WRITE } from '../../src/web-ui/labels';
import { ApiLog, apiPathOf, okJson, waitForApi } from '../../src/web-ui/support/api';
import { watchForRequest } from '../../src/web-ui/support/wait';
import { StagingApi } from '../../src/web-ui/write/staging-api';
import {
  E2E_PREFIX,
  findQaData,
  LEAD_FORM_FIELDS,
  loadFootprint,
  onCleanup,
  pickFields,
  QA_LEAD_LABEL,
  QA_LEAD_PHONE,
  restoreLead,
  runCleanups,
  runId,
  saveFootprint,
  type Footprint,
} from '../../src/web-ui/write/web-write-env';

/**
 * เทสเขียนข้อมูลบนเว็บ: ลีดของนายหน้า (แผน claude/nestyk-web-write-flows-plan-2026-11-06.md ระยะ A ข้อ LW1-LW5, MW1, EW1)
 * โค้ด: apps/consumer-app/components/CreateLeadForm.tsx, AgentLeadDetailBody.tsx, app/index.tsx และ
 *   apps/api/src/agent/leads/agent-leads.service.ts ที่ qa/e2e 74b46f4 (แอป 648dd28, API a02e532)
 *
 * รันด้วย npm run test:web-ui-write เท่านั้น (ต้องตั้ง E2E_ALLOW_WRITES=yes) ใช้บัญชี qa-agent และลีดถาวร E2E-QA-LEAD-1 บน staging
 *   - ลีดลบไม่ได้: เทสไม่สร้างลีด ข้อ LW2 ส่งคำขอสร้างที่ API ปฏิเสธก่อนเขียน (validateLead :148) และตรวจว่าไม่มีลีดเพิ่ม
 *   - แก้ลีดถาวรเฉพาะ notes และสถานะ แล้วคืนทุกช่องที่ฟอร์มแก้ได้ผ่าน API ใน afterEach (restoreLead: จบที่ inprogress)
 *   - คำขอเขียนผ่านตัวกันได้เฉพาะเส้นทางที่ข้อนั้นเปิด (guard.allowWrites) คำขอเขียนอื่นยังทำให้เทสแดง
 *   - ข้อแรกกับข้อสุดท้ายนับลีดและห้องที่มีป้าย E2E- ก่อนกับหลัง ต้องเท่าเดิม
 * ห้ามรันพร้อม npm run test:write (ใช้ลีดถาวรตัวเดียวกัน)
 */

/** ช่องที่การแก้ notes ผ่านฟอร์มต้องไม่เปลี่ยน: ทุกช่องที่ฟอร์มส่ง (LEAD_FORM_FIELDS) ยกเว้น notes บวกชื่อเต็มกับสถานะ */
const UNCHANGED_FIELDS = ['name', 'status', ...LEAD_FORM_FIELDS.filter((key) => key !== 'notes')];

/** เบอร์ไทยรูปแบบถูกต้อง ไม่ถูกบันทึกที่ไหน: ใช้ในฟอร์มที่ไม่ส่งถึง API (LW1) หรือที่ API ปฏิเสธก่อนเขียน (LW2) */
const FORM_PHONE = '0812345678';

/** เวลาที่รอดูว่ามีคำขอ mark-lost ออกไปหรือไม่ (LW5) ค่าที่เลือกเอง: แอปส่งทันทีที่กด ถ้าส่งจะเห็นภายในไม่ถึง 1 วินาที */
const NO_REQUEST_WINDOW_MS = 3_000;

/** ข้อความ error ที่ API ปลอมของ EW1 ส่งกลับ (ภาษาอังกฤษ ไม่ใช่ข้อความของแอป) */
const FORCED_FAILURE = 'E2E forced failure';

/** จำนวนลีดและห้องที่มีป้าย E2E- ของ qa-agent (แบบเดียวกับ countFootprint ของ tests/write) */
async function footprint(api: StagingApi): Promise<Footprint> {
  return { leads: (await api.leads(E2E_PREFIX)).total, listings: (await api.listings(E2E_PREFIX)).total };
}

/** ป้ายสถานะที่แสดงของลีด (ไม่มีนัดค้าง จึงเท่ากับ status: findQaData ยกเลิกนัดของเทสที่ค้างแล้ว) */
function statusLabel(status: string): string {
  return FLOW.leadStatus[status as keyof typeof FLOW.leadStatus] ?? status;
}

// เก็บกวาดหลังทุกข้อ แม้ข้อนั้นหมดเวลา (เหตุผลที่ไม่ใช้ finally: web-write-env.ts onCleanup)
test.afterEach(async () => {
  await runCleanups();
});

test('[footprint] count E2E- leads and rooms before the run', async ({ page, loginAs }) => {
  await loginAs('agent');
  const api = await StagingApi.of(page);
  await findQaData(api);
  const before = await footprint(api);
  saveFootprint(test.info(), before);
  test.info().annotations.push({ type: 'ก่อนรัน', description: JSON.stringify(before) });
});

test('the create form checks required fields, email and budget without sending anything', async ({ page, loginAs }) => {
  // ขั้นที่ 1: เปิดฟอร์มจากเมนู Create > New lead (AgentWorkspace.web.tsx:533, app/index.tsx:437-444)
  const log = new ApiLog(page);
  await loginAs('agent');
  const shell = new AgentShell(page);
  await shell.createButton.click();
  await shell.createItem(WRITE.menuNewLead).click();
  const form = new LeadForm(page);
  await expect(form.save('create')).toBeVisible();

  // ขั้นที่ 2: บันทึกฟอร์มว่าง ชื่อกับเบอร์ต้องขึ้น "This field is required" (CreateLeadForm.tsx:455, :459)
  await form.save('create').click();
  await expect(form.fieldError(WRITE.required)).toHaveCount(2);

  // ขั้นที่ 3: อีเมลผิดรูปแบบ (:82, :462) ชื่อและเบอร์ถูกต้องแล้ว จึงเหลือข้อผิดพลาดเดียว
  await form.firstName.fill('E2E-UI-FORM');
  await form.phone.fill(FORM_PHONE);
  await form.email.fill('abc');
  await form.save('create').click();
  await expect(form.fieldError(WRITE.invalidEmail)).toBeVisible();
  await expect(form.fieldError(WRITE.required)).toHaveCount(0);

  // ขั้นที่ 4: งบต่ำสุดมากกว่างบสูงสุด (:504-506) ฟอร์มพาไปแท็บที่มีข้อผิดพลาด (:509-514)
  await form.email.fill('');
  await form.tab('matching').click();
  await form.budgetMax.fill('10000');
  await form.budgetMin.fill('20000');
  await form.save('create').click();
  await expect(form.fieldError(WRITE.budgetError)).toBeVisible();

  // ขั้นที่ 5: ไม่มีคำขอสร้างลีดออกไปเลย (ตัวกันจะแดงอยู่แล้วถ้ามี ข้อนี้ตรวจซ้ำจากรายการคำขอ)
  expect(log.count('POST', '/agent/leads'), 'คำขอ POST /agent/leads').toBe(0);
});

test('a first and last name longer than 255 together is refused by the API and no lead is created', async ({ page, loginAs, guard }) => {
  // หน้าเว็บตรวจความยาวแยกช่อง (maxLength 255) แต่ไม่ตรวจรวม (CreateLeadForm.tsx:570, :578) API ตอบ 400 ก่อนเขียน (agent-leads.service.ts:147-148)
  await loginAs('agent');
  const api = await StagingApi.of(page);
  const before = (await api.leads(E2E_PREFIX)).total;

  // ขั้นที่ 1: เปิดฟอร์ม กรอกชื่อ 212 ตัว นามสกุล 60 ตัว (แต่ละช่องไม่เกิน 255 รวมกับช่องว่างเป็น 273 ตัว) และเบอร์ถูกรูปแบบ
  const shell = new AgentShell(page);
  await shell.createButton.click();
  await shell.createItem(WRITE.menuNewLead).click();
  const form = new LeadForm(page);
  await form.firstName.fill(`${E2E_PREFIX}UI-LONG-${'x'.repeat(200)}`);
  await form.lastName.fill('y'.repeat(60));
  await form.phone.fill(FORM_PHONE);

  // ขั้นที่ 2: บันทึก ปล่อยคำขอสร้างผ่านตัวกัน API ต้องตอบ 400 ด้วยเหตุผลเรื่องความยาวชื่อ (ไม่ใช่เหตุผลอื่น)
  guard.allowWrites({ method: 'POST', path: /^\/agent\/leads$/ });
  const created = waitForApi(page, 'POST', '/agent/leads');
  await form.save('create').click();
  const response = await created;
  if (response.ok()) {
    const leaked = (await response.json().catch(() => null)) as { id?: number } | null;
    test.info().annotations.push({ type: 'ลีดค้างถาวร', description: `API รับคำขอ ลีด id ${leaked?.id ?? '?'} ถูกสร้าง ให้แจ้งทีม` });
  }
  expect(response.status(), 'API ต้องปฏิเสธชื่อรวมเกิน 255 ตัว (ถ้าได้ 201 แปลว่ามีลีดค้างถาวร ให้แจ้งทีม)').toBe(400);
  const message = ((await response.json().catch(() => null)) as { message?: unknown } | null)?.message;
  expect(String(message), 'เหตุผลที่ API ปฏิเสธ').toContain('First and last name together must be up to 255 characters');
  expect(guard.allowedWrites, 'คำขอเขียนที่ปล่อยผ่าน').toEqual(['POST /agent/leads']);

  // ขั้นที่ 3: หน้าแสดงข้อความบันทึกไม่สำเร็จ และไม่มีลีด E2E- เพิ่ม
  await expect(form.saveError).toBeVisible();
  expect((await api.leads(E2E_PREFIX)).total, 'จำนวนลีดที่มี E2E- หลังส่ง').toBe(before);
});

test('the permanent lead that has no budget and pin shows the "needs info" card, not the match button', async ({ page, loginAs }) => {
  const log = new ApiLog(page);
  await loginAs('agent');
  const api = await StagingApi.of(page);
  const { lead } = await findQaData(api);
  test.skip(lead.budgetMax != null && (lead.pins ?? []).length > 0, 'ลีดถาวรมีงบและหมุดแล้ว ข้อนี้ใช้ไม่ได้');

  // ขั้นที่ 1: เปิดรายละเอียด การ์ด "ข้อมูลไม่พอจับคู่" แสดงพร้อมปุ่มไปเติมข้อมูล (StateCard: AgentLeadDetailBody.tsx:427-435)
  const detail = await openLead(page, lead.id, QA_LEAD_LABEL);
  await expect(detail.matchNotReady).toBeVisible();
  await expect(detail.matchCompleteInfo).toBeVisible();

  // ขั้นที่ 2: ไม่มีปุ่มรันจับคู่ (:450-462 แสดงเมื่อพร้อม) และไม่มีคำขอรันจับคู่ออกไป
  await expect(detail.matchRun).toHaveCount(0);
  expect(log.count('POST', /\/match/), 'คำขอรันจับคู่').toBe(0);
});

test('editing notes through the form saves only the notes', async ({ page, loginAs, guard }) => {
  await loginAs('agent');
  const api = await StagingApi.of(page);
  const { lead } = await findQaData(api);
  onCleanup(() => restoreLead(api, lead.id, lead), test.info());
  const notes = `${E2E_PREFIX}${runId()} web notes`;

  // ขั้นที่ 1: รายละเอียด > View full lead info > Edit lead (AgentLeadDetailBody.tsx:831-844, app/index.tsx:873-884)
  const detail = await openLead(page, lead.id, QA_LEAD_LABEL);
  await detail.viewFullInfo.click();
  await detail.editLead.click();
  const form = new LeadForm(page);
  await expect(form.save('edit')).toBeVisible();
  await expect(form.firstName).toHaveValue(QA_LEAD_LABEL);

  // ขั้นที่ 2: แก้ notes แล้วบันทึก หน้าเว็บส่ง PATCH ของลีดนี้ (agent-leads-api.ts:51-54)
  await form.notes.fill(notes);
  guard.allowWrites({ method: 'PATCH', path: new RegExp(`^/agent/leads/${lead.id}$`) });
  const patched = waitForApi(page, 'PATCH', `/agent/leads/${lead.id}`);
  await form.save('edit').click();
  const response = await patched;
  await okJson(response);
  const body = response.request().postDataJSON() as Record<string, unknown>;
  expect(body.notes).toBe(notes);
  expect(body.phone, 'ฟอร์มต้องส่งเบอร์เดิม (แปลงเบอร์นี้เป็นรูปสากลไม่ได้: CreateLeadForm.tsx:456-458)').toBe(QA_LEAD_PHONE);
  expect(guard.allowedWrites, 'คำขอเขียนที่ปล่อยผ่าน').toEqual([`PATCH /agent/leads/${lead.id}`]);

  // ขั้นที่ 3: อ่านลีดกลับ notes เปลี่ยน ชื่อและเบอร์ตรงกับชุดข้อมูลถาวร (ค่าคงที่ ไม่ขึ้นกับรอบก่อน) และช่องอื่นเท่าก่อนแก้
  const saved = await api.lead(lead.id);
  expect(saved.notes).toBe(notes);
  expect(pickFields(saved, ['name', 'firstName', 'lastName', 'phone']), 'ชื่อและเบอร์ของลีดถาวร (qa-dataset.ts สร้างด้วยชื่อต้นกับเบอร์เท่านั้น)').toEqual({
    name: QA_LEAD_LABEL,
    firstName: QA_LEAD_LABEL,
    lastName: '',
    phone: QA_LEAD_PHONE,
  });
  expect(pickFields(saved, UNCHANGED_FIELDS), 'ช่องที่ไม่ได้แก้ต้องเท่าเดิม').toEqual(pickFields(lead, UNCHANGED_FIELDS));
});

test('status goes In care > Not proceeding (with a reason) > In care', async ({ page, loginAs, guard }) => {
  await loginAs('agent');
  const api = await StagingApi.of(page);
  const { lead: before } = await findQaData(api);
  onCleanup(() => restoreLead(api, before.id, before), test.info());
  const reason = `${E2E_PREFIX}${runId()} web lost`;

  // ขั้นเตรียม: เริ่มจาก inprogress (new ย้ายต่อได้ แต่กลับเป็น new ไม่ได้ ; lost ค้างจากรอบก่อน findQaData ย้ายกลับแล้ว)
  const lead = before.status === 'inprogress' ? before : await api.markInProgress(before.id);
  const detail = await openLead(page, lead.id, QA_LEAD_LABEL);
  guard.allowWrites(
    { method: 'POST', path: new RegExp(`^/agent/leads/${lead.id}/mark-lost$`) },
    { method: 'POST', path: new RegExp(`^/agent/leads/${lead.id}/mark-inprogress$`) },
  );

  // ขั้นที่ 1: In care > Not proceeding กดตัวเลือกแล้วต้องใส่เหตุผลก่อนยืนยัน (AgentLeadDetailBody.tsx:388-404)
  await detail.statusButton(statusLabel('inprogress')).click();
  await detail.statusOption(WRITE.markLost).click();
  await detail.lostReason.fill(reason);
  const lost = waitForApi(page, 'POST', `/agent/leads/${lead.id}/mark-lost`);
  await detail.confirmLost.click();
  const lostResponse = await lost;
  await okJson(lostResponse);
  expect(lostResponse.request().postDataJSON()).toEqual({ lostReason: reason });
  await expect(detail.statusButton(statusLabel('lost'))).toBeVisible();
  expect((await api.lead(lead.id)).status).toBe('lost');

  // ขั้นที่ 2: Not proceeding > Start caring ส่งทันทีไม่ต้องยืนยัน (:386-401) และ API ล้างเหตุผล (agent-leads.service.ts:310-318)
  await detail.statusButton(statusLabel('lost')).click();
  const back = waitForApi(page, 'POST', `/agent/leads/${lead.id}/mark-inprogress`);
  await detail.statusOption(WRITE.markInProgress).click();
  await okJson(await back);
  await expect(detail.statusButton(statusLabel('inprogress'))).toBeVisible();
  const saved = await api.lead(lead.id);
  expect(saved.status).toBe('inprogress');
  expect(saved.lostReason ?? null).toBeNull();
  expect(guard.allowedWrites, 'คำขอเขียนที่ปล่อยผ่าน').toEqual([
    `POST /agent/leads/${lead.id}/mark-lost`,
    `POST /agent/leads/${lead.id}/mark-inprogress`,
  ]);
});

test('confirming Not proceeding with an empty reason sends nothing and says why', async ({ page, loginAs }) => {
  await loginAs('agent');
  const api = await StagingApi.of(page);
  const { lead: before } = await findQaData(api);
  onCleanup(() => restoreLead(api, before.id, before), test.info());
  const lead = before.status === 'inprogress' ? before : await api.markInProgress(before.id);

  // ขั้นที่ 1: เปิดตัวเลือก Not proceeding แล้วปล่อยเหตุผลว่าง
  const detail = await openLead(page, lead.id, QA_LEAD_LABEL);
  await detail.statusButton(statusLabel('inprogress')).click();
  await detail.statusOption(WRITE.markLost).click();
  await detail.lostReason.fill('');

  // ขั้นที่ 2: ยืนยันโดยไม่มีเหตุผล ต้องไม่มีคำขอ mark-lost (:393-397) และ sheet ยังเปิดอยู่
  const sent = watchForRequest(
    page,
    (request) => request.method() === 'POST' && apiPathOf(request.url()) === `/agent/leads/${lead.id}/mark-lost`,
    NO_REQUEST_WINDOW_MS,
  );
  await detail.confirmLost.click();
  expect(await sent, 'ส่ง mark-lost ทั้งที่ไม่มีเหตุผล').toBe(false);
  await expect(detail.confirmLost).toBeVisible();

  // ขั้นที่ 3: แอปแจ้ง Alert.alert(lostReasonRequired) (:395) บนเว็บเป็น toast สีแดง (key ลงท้าย Required)
  await expect(detail.errorToast(WRITE.lostReasonRequired)).toBeVisible();
});

test('a failed status change tells the user it failed', async ({ page, loginAs }) => {
  await loginAs('agent');
  const api = await StagingApi.of(page);
  const { lead: before } = await findQaData(api);
  onCleanup(() => restoreLead(api, before.id, before), test.info());
  const lead = before.status === 'inprogress' ? before : await api.markInProgress(before.id);

  // ขั้นที่ 1: ให้ mark-lost ล้มในเบราว์เซอร์เอง (route ของ page ทำงานก่อนตัวกันของ context คำขอไม่ออกถึง staging)
  let hit = false;
  await page.route(
    (url) => url.pathname === `/api/v1/agent/leads/${lead.id}/mark-lost`,
    (route) => {
      hit = true;
      return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: FORCED_FAILURE }) });
    },
  );

  // ขั้นที่ 2: In care > Not proceeding ใส่เหตุผลแล้วยืนยัน คำขอถูกตอบ 500 ในเบราว์เซอร์ ลีดบน staging ต้องไม่เปลี่ยน
  const detail = await openLead(page, lead.id, QA_LEAD_LABEL);
  await detail.statusButton(statusLabel('inprogress')).click();
  await detail.statusOption(WRITE.markLost).click();
  await detail.lostReason.fill(`${E2E_PREFIX}${runId()} forced`);
  await detail.confirmLost.click();
  await expect.poll(() => hit, { message: 'คำขอ mark-lost ไม่ถูกส่ง' }).toBe(true);
  expect((await api.lead(lead.id)).status, 'คำขอถูกตอบในเบราว์เซอร์ ลีดต้องไม่เปลี่ยน').toBe('inprogress');

  // ขั้นที่ 3: แอปแจ้ง Alert.alert(saveError, localizedError(...)) (AgentLeadDetailBody.tsx changeStatus ที่ fc1a351 เดิมเป็น loadError)
  //   บนเว็บเป็น toast สีแดงที่มีทั้งหัวและข้อความของ API
  //   localizedError คืนข้อความเดิมเมื่อเป็นภาษาของหน้าและไม่ใช่ 403 หรือ "HTTP <เลข>" (packages/i18n/src/error-message.ts:29-43)
  const toast = detail.errorToast(FORCED_FAILURE);
  await expect(toast).toBeVisible();
  await expect(toast).toContainText(WRITE.saveLeadError);
  await expect(detail.statusButton(statusLabel('inprogress')), 'ป้ายสถานะบนหน้าต้องไม่เปลี่ยน').toBeVisible();
});

test('[footprint] no E2E- lead or room was added', async ({ page, loginAs }) => {
  const before = loadFootprint(test.info());
  test.skip(before === null, 'ไม่มีค่านับก่อนรันของรอบนี้ (ข้อนับก่อนรันไม่ได้รัน เช่น รันด้วย --grep หรือข้อนั้นไม่ผ่าน)');
  await loginAs('agent');
  const api = await StagingApi.of(page);
  // อ่านลีดถาวรตรง ๆ ก่อนเรียก findQaData เพราะ findQaData ย้าย lost กลับเป็น inprogress และ API ล้างเหตุผล lost ไปด้วย (agent-leads.service.ts:314-315)
  //   ถ้าเรียกก่อน การตรวจสถานะกับเหตุผล lost ด้านล่างจะผ่านเสมอ
  const found = (await api.leads(QA_LEAD_LABEL)).items.filter((row) => row.name === QA_LEAD_LABEL);
  expect(found.length, `ลีดชื่อ ${QA_LEAD_LABEL}`).toBe(1);
  const lead = await api.lead(found[0].id);
  const after = await footprint(api);
  test.info().annotations.push({ type: 'หลังรัน', description: JSON.stringify(after) });
  expect(after).toEqual(before);
  expect(lead.status, 'ลีดถาวรต้องจบที่ inprogress').toBe('inprogress');
  expect((lead.notes ?? '').includes(runId()), 'notes ของรอบนี้ต้องถูกคืนแล้ว').toBe(false);
  expect((lead.lostReason ?? '').includes(runId()), 'เหตุผล lost ของรอบนี้ต้องไม่ค้าง').toBe(false);
});
