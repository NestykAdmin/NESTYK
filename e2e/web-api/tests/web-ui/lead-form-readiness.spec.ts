import { test, expect } from '../../src/web-ui/web-ui.fixture';
import type { Page } from '@playwright/test';
import { AgentShell } from '../../src/web-ui/pages/agent-shell.page';
import { LeadForm } from '../../src/web-ui/pages/lead-write.page';
import { LeadReadinessPanel, type ReadinessKey } from '../../src/web-ui/pages/lead-readiness.page';
import { UI_LOCALE, WRITE } from '../../src/web-ui/labels';
import { AGENT_WEB } from '../../src/web-ui/labels.agent-web';

/**
 * แผงความพร้อมข้างฟอร์มเพิ่มลีดบนเว็บจอกว้าง (แผน 9 พ.ย. 2026 ข้อ L1-L3) อ่านอย่างเดียว ไม่บันทึกลีด
 * โค้ด: apps/consumer-app/components/agent-web/AgentLeadFormPage.web.tsx (F), lib/lead-form-readiness.ts (R),
 *   components/CreateLeadForm.tsx (C) ที่ pre/dev/review 7a9bf48 (qa/e2e 4633c54) ข้อ L3 ใช้กฎเบอร์ใหม่ของ 0a21689 (savablePhone)
 *
 * สิ่งที่ต้องมีก่อนรัน: เหมือนชุด tests/web-ui และตั้ง E2E_QA_AGENT_PASSWORD เว็บต้องเป็นโค้ดตั้งแต่ pre/dev/review 0a21689 (ไม่อย่างนั้น L3 แดง)
 * แผงอ่านสิ่งที่ฟอร์มรายงาน (onDraftChange ใน C, phoneOk ตั้งแต่ 0a21689) 4 ข้อ: ชื่อ เบอร์ งบสูงสุด หมุด (R:17-34) ไม่มีผลกับปุ่มบันทึก
 * ที่ 1280px แผงอยู่ขวาของฟอร์มและเปิดตลอด (agent-lead-form.css:56-61 พับเฉพาะ <1280)
 * ข้อ L3 กด Save Lead ด้วยเบอร์ที่ไม่ถูกต้อง ฟอร์มปฏิเสธก่อนส่ง (C submit) ถ้าคำขอหลุดไป ตัวกันคำขอ (guard.ts) ตัดและบันทึกไว้ ข้อนี้ตรวจว่าไม่มี
 * ข้อความที่พิมพ์ในฟอร์มเป็นค่าของเทส (QA Readiness) ไม่ใช่ข้อมูลลูกค้า
 * ชุดนี้ใช้ WRITE ของ labels.ts ซึ่งมีแต่ภาษาอังกฤษ จึงข้ามเมื่อรันภาษาไทย
 */
test.skip(UI_LOCALE !== 'en', 'ป้ายของฟอร์มลีด (WRITE ใน labels.ts) มีแต่ภาษาอังกฤษ');

const ITEM_LABEL = {
  firstName: AGENT_WEB.readinessFirstName,
  phone: AGENT_WEB.readinessPhone,
  budgetMax: AGENT_WEB.readinessBudgetMax,
  pins: AGENT_WEB.readinessPins,
} as const;

async function expectItem(panel: LeadReadinessPanel, key: ReadinessKey, done: boolean): Promise<void> {
  await expect(panel.item(key)).toHaveAttribute('data-done', done ? 'true' : 'false');
  await expect(panel.item(key)).toHaveAttribute('aria-label', `${ITEM_LABEL[key]}: ${done ? AGENT_WEB.readinessDone : AGENT_WEB.readinessMissing}`);
}

/** เปิดฟอร์มเพิ่มลีดจาก Create > New lead (เส้นทางเดียวกับ lead-create.write.spec.ts) แล้วคืนแผง */
async function openCreateLead(page: Page): Promise<LeadReadinessPanel> {
  const shell = new AgentShell(page);
  await shell.createButton.click();
  await shell.createItem(WRITE.menuNewLead).click();
  const panel = new LeadReadinessPanel(page);
  await expect(panel.root).toBeVisible();
  return panel;
}

test('L1 a new lead form starts with every readiness item missing and the New tag', async ({ page, loginAs }) => {
  await loginAs('agent');
  const panel = await openCreateLead(page);

  // แผงเริ่มจาก draft ว่าง (EMPTY: F:9) ทั้ง 4 ข้อยังไม่ครบ หมายเหตุบอกให้กรอกชื่อและเบอร์ (F:32) โหมดสร้างมีป้าย New (F:90-95)
  for (const key of ['firstName', 'phone', 'budgetMax', 'pins'] as const) await expectItem(panel, key, false);
  await expect(panel.root).toContainText(AGENT_WEB.readinessNeedContact);
  await expect(panel.root).toContainText(AGENT_WEB.readinessMatchMissing);
  await expect(panel.root.getByText(AGENT_WEB.readinessNewTag, { exact: true })).toBeVisible();
});

test('L2 typing the name, phone and budget ticks those items, and an item opens its tab', async ({ page, loginAs, guard }) => {
  await loginAs('agent');
  const panel = await openCreateLead(page);
  const form = new LeadForm(page);

  // ขั้นที่ 1: ชื่อต้น ข้อชื่อครบ (hasName = ไม่ว่างหลัง trim: R:20) ข้ออื่นยังไม่ครบ
  await form.firstName.fill('QA Readiness');
  await expectItem(panel, 'firstName', true);
  await expectItem(panel, 'phone', false);
  await expect(panel.root).toContainText(AGENT_WEB.readinessNeedContact);

  // ขั้นที่ 2: เบอร์ที่ถูกต้อง ข้อเบอร์ครบ บันทึกได้แล้ว หมายเหตุเปลี่ยนเป็น noteSaveFirst (F:32) เพราะยังไม่มีงบกับหมุด
  await form.phone.fill('0800000000');
  await expectItem(panel, 'phone', true);
  await expect(panel.root).toContainText(AGENT_WEB.readinessSaveFirst);

  // ขั้นที่ 3: กดข้องบสูงสุดในแผง ฟอร์มเปิดแท็บ Room matching (requestedTab: F:76, C:250-254) ช่องงบสูงสุดอยู่ในแท็บนี้เท่านั้น
  await expect(form.budgetMax).toHaveCount(0);
  await panel.item('budgetMax').click();
  await expect(form.budgetMax).toBeVisible();
  await form.budgetMax.fill('20000');
  await expectItem(panel, 'budgetMax', true);
  await expectItem(panel, 'pins', false);
  await expect(panel.root).toContainText(AGENT_WEB.readinessSaveFirst);

  // ขั้นที่ 4: กดข้อชื่อ กลับแท็บข้อมูลลีด ช่องชื่อยังมีค่าเดิม (ฟอร์มเก็บค่าข้ามแท็บ)
  await panel.item('firstName').click();
  await expect(form.firstName).toHaveValue('QA Readiness');
  await expect(form.budgetMax).toHaveCount(0);
  // คำขอเขียนที่ไม่อยู่ในรายการที่รู้จัก (unexpected-write) ต้องไม่มี การพิมพ์ในฟอร์มไม่ควรส่งอะไร
  expect(guard.of('unexpected-write'), 'ไม่มีคำขอเขียนจากการพิมพ์ในฟอร์ม').toEqual([]);
});

test('L3 a phone the form cannot save is not ticked, and Save Lead refuses it without sending anything', async ({ page, loginAs, guard }) => {
  await loginAs('agent');
  const panel = await openCreateLead(page);
  const form = new LeadForm(page);

  // ขั้นที่ 1: ชื่อกับเบอร์ที่บันทึกได้ ข้อเบอร์ครบ (ใช้เป็นจุดเริ่มเพื่อให้เห็นว่าแผงเปลี่ยนตามจริง ไม่ใช่ค้างค่าเดิม)
  //   ตั้งแต่ pre/dev/review 0a21689 แผงใช้กฎเดียวกับปุ่ม Save (savablePhone: lib/phone.ts, phoneOk: CreateLeadForm.tsx)
  //   เดิม (7a9bf48) แผงนับเบอร์ 1 หลักว่าครบ (บั๊กที่แจ้งทีม nestyk-web-lead-readiness-phone-for-dev-2026-11-09.md)
  await form.firstName.fill('QA Readiness');
  await expect(panel.item('firstName')).toHaveAttribute('data-done', 'true');
  for (const invalid of ['1', '12345']) {
    await form.phone.fill('0800000000');
    await expectItem(panel, 'phone', true);
    // ขั้นที่ 2: เปลี่ยนเป็นเบอร์ที่ Save ปฏิเสธ (1 หลัก และ 5 หลัก ตามที่ทีมขอใน docs/qa-fixes/2026-11-09-lead-readiness-phone-reply.md)
    //   ข้อเบอร์ต้องกลับเป็นยังไม่ครบ และหมายเหตุกลับเป็นข้อความให้กรอกชื่อและเบอร์
    await form.phone.fill(invalid);
    await expectItem(panel, 'phone', false);
    await expect(panel.note).toHaveText(AGENT_WEB.readinessNeedContact);
  }

  // ขั้นที่ 3: กด Save Lead (เบอร์ 12345) ฟอร์มขึ้น invalidPhone ใต้ช่อง และไม่ส่ง POST /agent/leads
  const posts: string[] = [];
  page.on('request', (request) => {
    if (request.method() === 'POST' && new URL(request.url()).pathname.endsWith('/agent/leads')) posts.push(request.url());
  });
  await form.save('create').click();
  await expect(form.fieldError(AGENT_WEB.invalidPhone)).toBeVisible();
  expect(posts, 'ไม่มีคำขอสร้างลีด').toEqual([]);
  expect(guard.of('unexpected-write'), 'ไม่มีคำขอเขียนที่ตัวกันต้องตัด').toEqual([]);
  // ยังอยู่ที่ฟอร์ม (ไม่ได้บันทึกแล้วย้ายไปหน้ารายการ)
  await expect(panel.root).toBeVisible();
});
