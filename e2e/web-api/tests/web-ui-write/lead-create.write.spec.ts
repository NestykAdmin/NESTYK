import { test, expect } from '../../src/web-ui/web-ui.fixture';
import { AgentShell } from '../../src/web-ui/pages/agent-shell.page';
import { LeadForm } from '../../src/web-ui/pages/lead-write.page';
import { Notify } from '../../src/web-ui/pages/notify.page';
import { WRITE } from '../../src/web-ui/labels';
import { okJson, waitForApi } from '../../src/web-ui/support/api';
import { StagingApi } from '../../src/web-ui/write/staging-api';
import { E2E_PREFIX, runId } from '../../src/web-ui/write/web-write-env';

/**
 * เทสเขียนข้อมูลบนเว็บ: สร้างลีดผ่านฟอร์มจริง (แผน claude/nestyk-web-write-flows-plan-2026-11-06.md ข้อ LW6)
 * โค้ด: apps/consumer-app/components/CreateLeadForm.tsx, app/index.tsx:1502-1509, lib/phone.ts และ
 *   apps/api/src/agent/leads/agent-leads.service.ts ที่ qa/e2e 74b46f4 (แอป 648dd28, API a02e532)
 *
 * สร้างลีดใหม่ทุกรอบ (Aof เลือก 6 พ.ย. 2026) ลีดลบไม่ได้ (agent-leads.controller.ts:15-22 ไม่มี DELETE)
 *   - รอยต่อรอบ: ลีด 1 ราย ชื่อ E2E-WEB-<รหัสรอบ> สถานะ new
 *   - ไฟล์นี้แยกจาก agent-leads.write.spec.ts เพราะข้อนับรอยของไฟล์นั้นต้องได้จำนวนลีด E2E- เท่าเดิม
 *     ชื่อไฟล์ขึ้นต้น lead- จึงรันหลังไฟล์ agent-* (Playwright เรียงไฟล์ตามชื่อ)
 */

/**
 * เบอร์ของลีดที่สร้าง ฟอร์มรับเฉพาะเบอร์ที่ libphonenumber ถือว่าถูกต้อง (CreateLeadForm.tsx:455-460, lib/phone.ts:99-106)
 * 080-000-0000 ผ่าน (ลองกับ libphonenumber-js/max บนเครื่อง Aof 6 พ.ย. 2026: TH MOBILE +66800000000) เลือกเลขที่ซ้ำทุกหลัก
 * เพื่อให้เห็นชัดว่าเป็นข้อมูลเทส แต่ยืนยันไม่ได้ว่าไม่มีผู้ใช้เลขนี้ แอปไม่ได้โทรหรือส่งข้อความหาลีด
 */
const LEAD_PHONE = '0800000000';
const LEAD_PHONE_E164 = '+66800000000';

test('the create form saves a new lead with a name and phone', async ({ page, loginAs, guard }) => {
  await loginAs('agent');
  const api = await StagingApi.of(page);
  const before = (await api.leads(E2E_PREFIX)).total;
  const name = `${E2E_PREFIX}WEB-${runId()}`;

  // ขั้นที่ 1: Create > New lead กรอกชื่อต้นกับเบอร์ (ช่องบังคับ: CreateLeadForm.tsx:455-460)
  const shell = new AgentShell(page);
  await shell.createButton.click();
  await shell.createItem(WRITE.menuNewLead).click();
  const form = new LeadForm(page);
  await form.firstName.fill(name);
  await form.phone.fill(LEAD_PHONE);

  // ขั้นที่ 2: Save Lead ส่ง POST /agent/leads ได้ 201 เบอร์แปลงเป็นรูปสากลแล้ว (:463-503)
  guard.allowWrites({ method: 'POST', path: /^\/agent\/leads$/ });
  const created = waitForApi(page, 'POST', '/agent/leads');
  await form.save('create').click();
  const response = await created;
  const lead = await okJson<{ id: number }>(response);
  test.info().annotations.push({ type: 'ลีดที่สร้าง', description: `id ${lead.id} ชื่อ ${name}` });
  expect(response.status()).toBe(201);
  expect(response.request().postDataJSON()).toMatchObject({ name, firstName: name, lastName: '', phone: LEAD_PHONE_E164, notes: null });
  expect(guard.allowedWrites, 'คำขอเขียนที่ปล่อยผ่าน').toEqual(['POST /agent/leads']);

  // ขั้นที่ 3: toast "Lead saved" (app/index.tsx:1502-1509 key saved จึงเป็น success) แล้วพาไปหน้ารายการลีด
  await expect(new Notify(page).toast('success', WRITE.leadSaved)).toBeVisible();
  await expect(page).toHaveURL(/\/agent\/leads$/);

  // ขั้นที่ 4: อ่านลีดกลับ ชื่อ เบอร์ สถานะ new (agent-leads.service.ts:210-213) และลีด E2E- เพิ่ม 1 รายพอดี
  const saved = await api.lead(lead.id);
  expect({ name: saved.name, phone: saved.phone, status: saved.status }).toEqual({ name, phone: LEAD_PHONE_E164, status: 'new' });
  expect((await api.leads(E2E_PREFIX)).total, 'ลีดที่มี E2E- หลังสร้าง').toBe(before + 1);
});
