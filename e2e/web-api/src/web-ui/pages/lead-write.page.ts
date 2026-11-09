import { expect, type Locator, type Page } from '@playwright/test';
import { WRITE } from '../labels';
import { okJson, waitForApi } from '../support/api';
import { escapeRegExp, LeadsPage } from './leads.page';

/** เปิดรายละเอียดลีดจากหน้ารายการด้วยคำค้น (รายละเอียดไม่มี URL ของตัวเอง) ใช้กับลีดของเทสเท่านั้น เพราะคำค้นถูกบันทึกในชื่อขั้นของรายงาน */
export async function openLead(page: Page, id: number, q: string): Promise<LeadDetail> {
  const leads = new LeadsPage(page);
  const listed = waitForApi(page, 'GET', '/agent/leads', { query: (query) => query.get('q') === q });
  await page.goto('/agent/leads');
  await expect(leads.root).toBeVisible();
  await leads.search.fill(q);
  await okJson(await listed);
  await leads.row(id).click();
  const detail = new LeadDetail(page);
  await expect(detail.root).toBeVisible();
  return detail;
}

/**
 * ฟอร์มลีดและรายละเอียดลีดของนายหน้าบนจอกว้าง สำหรับเทสเขียนข้อมูล (tests/web-ui-write)
 *   ฟอร์ม: apps/consumer-app/components/CreateLeadForm.tsx  รายละเอียด: components/AgentLeadDetailBody.tsx (qa/e2e 74b46f4 = แอป 648dd28)
 * ไม่มี testid ในฟอร์มและ sheet ทุกตัว หาด้วย placeholder, role, aria-label และข้อความ i18n
 * sheet (MobileBottomSheet) วาดนอกต้นไม้ของหน้า จึงหาจาก page ทั้งหน้า
 */
export class LeadForm {
  constructor(private readonly page: Page) {}

  /** แท็บของฟอร์ม (role tab :539-543) ฟอร์มวาดเฉพาะแท็บที่เลือก */
  tab(which: 'profile' | 'matching'): Locator {
    return this.page.getByRole('tab', { name: which === 'profile' ? WRITE.tabProfile : WRITE.tabMatching, exact: true });
  }

  /** ช่องข้อความหาด้วย placeholder (MobileInput ไม่ผูกป้ายกับช่อง: packages/ui/src/components/MobileInput.tsx:59-63) */
  get firstName(): Locator {
    return this.page.getByPlaceholder(WRITE.firstNamePlaceholder, { exact: true });
  }

  get lastName(): Locator {
    return this.page.getByPlaceholder(WRITE.lastNamePlaceholder, { exact: true });
  }

  /** ช่องเบอร์ (PhoneField.tsx:74 aria-label = ป้าย) */
  get phone(): Locator {
    return this.page.getByLabel(WRITE.phone, { exact: true });
  }

  get email(): Locator {
    return this.page.getByPlaceholder(WRITE.emailPlaceholder, { exact: true });
  }

  get notes(): Locator {
    return this.page.getByPlaceholder(WRITE.notesPlaceholder, { exact: true });
  }

  get budgetMin(): Locator {
    return this.page.getByPlaceholder(WRITE.budgetMinPlaceholder, { exact: true });
  }

  get budgetMax(): Locator {
    return this.page.getByPlaceholder(WRITE.budgetMaxPlaceholder, { exact: true });
  }

  /** ปุ่มบันทึก (MobileButton :794-806 ข้อความ Save Lead ตอนสร้าง หรือ Save changes ตอนแก้) */
  save(mode: 'create' | 'edit'): Locator {
    return this.page.getByRole('button', { name: mode === 'create' ? WRITE.saveLead : WRITE.saveChanges, exact: true });
  }

  /** ข้อความใต้ช่อง (MobileInput.tsx:119-121 Text ธรรมดา) */
  fieldError(text: string): Locator {
    return this.page.getByText(text, { exact: true });
  }

  /** ข้อความผิดพลาดจาก API ท้ายฟอร์ม (role alert "<saveError>: <สาเหตุ>" :786-793) */
  get saveError(): Locator {
    return this.page.getByRole('alert').filter({ hasText: new RegExp(`^${escapeRegExp(WRITE.saveLeadError)}: `) });
  }
}

export class LeadDetail {
  constructor(private readonly page: Page) {}

  /** รากของรายละเอียด (LeadDetailColumns.web.tsx:12 testid lead.detail) */
  get root(): Locator {
    return this.page.getByTestId('lead.detail');
  }

  /** ปุ่มสถานะข้างชื่อ (aria-label "Change status: <ป้าย>" :775-780) */
  statusButton(label: string): Locator {
    return this.page.getByRole('button', { name: `${WRITE.changeStatus}: ${label}`, exact: true });
  }

  /** ตัวเลือกใน sheet เปลี่ยนสถานะ (Pressable :727-745 ข้อความ = ป้ายสถานะเป้าหมาย ตามด้วยชื่อการกระทำ) */
  statusOption(action: string): Locator {
    return this.page.getByRole('button').filter({ hasText: new RegExp(`${escapeRegExp(action)}$`) });
  }

  /** ช่องเหตุผลของ lost (placeholder :710-715 ไม่มีป้าย) */
  get lostReason(): Locator {
    return this.page.getByPlaceholder(WRITE.lostReasonPlaceholder, { exact: true });
  }

  /** ตัวนับตัวอักษรใต้ช่องเหตุผล "<จำนวน>/500" (AgentLeadDetailBody.tsx LOST_REASON_MAX ที่ fc1a351 เป็นตัวเลขอย่างเดียว ไม่มีคำแปล) */
  lostReasonCounter(count: number, max: number): Locator {
    return this.page.getByText(`${count}/${max}`, { exact: true });
  }

  get confirmLost(): Locator {
    return this.page.getByRole('button', { name: WRITE.confirmLost, exact: true });
  }

  /** ปุ่มปิด sheet (SheetHeader :1089 aria-label common.cancel) */
  get closeSheet(): Locator {
    return this.page.getByRole('button', { name: WRITE.sheetClose, exact: true });
  }

  /** การ์ด "View full lead info" (Pressable :831-844 ชื่อจากข้อความ) */
  get viewFullInfo(): Locator {
    return this.page.getByRole('button', { name: WRITE.viewFullInfo });
  }

  /** หัวการ์ดของลีดที่ยังจับคู่ไม่ได้ (StateCard: AgentLeadDetailBody.tsx:427-435) */
  get matchNotReady(): Locator {
    return this.page.getByText(WRITE.matchNotReadyTitle, { exact: true });
  }

  /** ปุ่มไปเติมข้อมูลจับคู่บนการ์ดเดียวกัน */
  get matchCompleteInfo(): Locator {
    return this.page.getByRole('button', { name: WRITE.matchCompleteInfo });
  }

  /** ปุ่มรันจับคู่ (:450-462 แสดงเมื่อลีดพร้อมจับคู่) หาแบบมีคำนี้อยู่ เผื่อชื่อปุ่มมีข้อความโควตาต่อท้าย */
  get matchRun(): Locator {
    return this.page.getByRole('button', { name: WRITE.matchRun });
  }

  /**
   * toast สีแดงที่มีข้อความนี้ บนเว็บ Alert.alert ถูกแทนด้วย toast หรือกล่องยืนยัน (components/web-notify/WebNotifier.web.tsx:25-38
   * commit 27a6e05) ข้อความที่ key ลงท้าย error, required ฯลฯ เป็น toast แบบ error ซึ่งค้างจนกดปิด (lib/web-notify.ts:39-40, :52-53, :82-88)
   * toast: <div role="alert" data-testid="notify.toast.error"> (WebNotifier.web.tsx:66-71)
   */
  errorToast(text: string): Locator {
    return this.page.getByTestId('notify.toast.error').filter({ hasText: text });
  }

  /** ปุ่ม Edit lead บนหัวหน้าข้อมูลทั้งหมด (AgentSectionHeader.web.tsx:64-77 ปุ่มที่มีข้อความ actionLabel) */
  get editLead(): Locator {
    return this.page.locator('.aw-page-heading').getByRole('button', { name: WRITE.editLead });
  }
}
