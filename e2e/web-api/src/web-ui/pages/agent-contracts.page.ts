/// <reference lib="dom" />  // โค้ดใน evaluate ทำงานในเบราว์เซอร์ (tsconfig ของชุดนี้ใช้ lib ES2022 อย่างเดียว)
import type { Locator, Page } from '@playwright/test';
import { CONTRACT_SAVE_CONFIRM, FLOW, fill } from '../labels';
import { escapeRegExp } from './leads.page';

/**
 * หน้าสัญญาของนายหน้าในรายละเอียดผู้เช่า (หัวข้อ Contracts) บนจอกว้าง: รายการเอกสาร ตัวเลือกชนิดเอกสาร
 *   ฟอร์มสัญญาแต่งตั้งนายหน้า และกล่องยืนยันก่อนบันทึก
 * โค้ด: apps/consumer-app/components/ContractsScreen.tsx, ContractTypePicker.tsx, AgentContractLibrary.tsx, BrokerAppointmentFields.tsx
 *   packages/ui/src/components/MobileInput.tsx, MobileButton.tsx, MobileBottomSheet.tsx ที่ qa/e2e 40e0496
 * กฎและเคส: เอกสารโปรเจกต์ claude/nestyk-topic-contracts-create-web-ui.md (K1-K17) และ ...-part2.md (CCR-001 ถึง CCR-011)
 *
 * หน้าสัญญาไม่มี testID เลย (K12) วิธีหาชิ้นส่วนจึงมาจาก role ข้อความ และโครงของชิ้นส่วนในโค้ด
 *   เขียนจากการอ่านโค้ด ยังไม่ได้พิสูจน์กับหน้าเว็บจริงจนกว่าจะรันรอบแรก
 * ห้ามกด: ปุ่ม "บันทึกฉบับร่าง" ในกล่องยืนยัน (ส่ง POST /agent/contracts: ContractsScreen.tsx:2518-2520)
 *   และปุ่ม "View ..." ของเอกสารในร่าง (ส่ง POST ...-preview ที่เขียนข้อมูล: K9)
 */

/** ชนิดเอกสารในตัวเลือก เรียงตามที่แสดงบนจอ (ContractTypePicker.tsx:74-81) */
export type DocumentKind = 'reservation' | 'lease' | 'renewal' | 'invoice' | 'broker';
export const DOCUMENT_KINDS: readonly DocumentKind[] = ['reservation', 'lease', 'renewal', 'invoice', 'broker'];

const KIND_LABEL: Record<DocumentKind, string> = {
  reservation: FLOW.ccKindReservation,
  lease: FLOW.ccKindLease,
  renewal: FLOW.ccKindRenewal,
  invoice: FLOW.ccKindInvoice,
  broker: FLOW.ccKindBroker,
};

/** ชื่อของปุ่มชนิดเอกสาร = "Create {label}" (ContractTypePicker.tsx:85 ; contracts.picker.createA11y) */
export function kindButtonName(kind: DocumentKind): string {
  return fill(FLOW.ccPickerCreate, { label: KIND_LABEL[kind] });
}

/** ช่องของฟอร์มสัญญาแต่งตั้งนายหน้า เรียงตามที่แสดงบนจอ (BrokerAppointmentFields.tsx:76-112) */
export type BrokerFieldKey = keyof typeof FLOW.ccBrokerFields;
export const BROKER_FIELDS: readonly BrokerFieldKey[] = [
  'issueDate',
  'landlordFirstName',
  'landlordLastName',
  'landlordNationality',
  'landlordId',
  'landlordAddress',
  'landlordPhone',
  'brokerCompany',
  'brokerContact',
  'brokerNationality',
  'brokerId',
  'brokerPhone',
  'brokerAddress',
  'propertyLine',
  'monthlyRent',
  'leaseMonths',
  'commissionFee',
  'commissionMonths',
];

/** ช่องบังคับ 5 ช่อง (BrokerAppointmentFields.tsx:53-59) ป้ายของช่องบังคับมี " *" ต่อท้าย (MobileInput.tsx:59-63) */
export const BROKER_REQUIRED: readonly BrokerFieldKey[] = ['issueDate', 'landlordFirstName', 'brokerCompany', 'brokerContact', 'propertyLine'];

/** ป้ายของช่องตามที่อ่านได้บนจอ */
export function brokerFieldLabel(key: BrokerFieldKey): string {
  return `${FLOW.ccBrokerFields[key]}${BROKER_REQUIRED.includes(key) ? ' *' : ''}`;
}

/** ค่าที่ fieldErrorText คืนเมื่อไม่พบกล่องของช่อง */
export const BOX_MISSING = '(ไม่พบกล่องของช่อง)';

export class AgentContractsPage {
  constructor(private readonly page: Page) {}

  /** รายละเอียดผู้เช่า (agent-web/TenantDetailFrame.web.tsx:29 testid tenant.detail) หน้าสัญญาอยู่ข้างในนี้ ส่วนกล่องยืนยันอยู่นอก (Modal) */
  private get root(): Locator {
    return this.page.getByTestId('tenant.detail');
  }

  // ---- รายการเอกสารของผู้เช่า (AgentContractLibrary.tsx) ----

  /** ปุ่ม "Create document" (AgentContractLibrary.tsx:124 MobileButton role=button ปิดอยู่ระหว่างโหลดรายการ: disabled={busy || loading}) */
  get createDocument(): Locator {
    return this.root.getByRole('button', { name: FLOW.ccLibraryCreate, exact: true });
  }

  // ---- ตัวเลือกชนิดเอกสาร (ContractTypePicker.tsx) ----

  /** หัวข้อ "Choose contract type" (:62-64) */
  get pickerTitle(): Locator {
    return this.root.getByText(FLOW.ccPickerTitle, { exact: true });
  }

  /** คำถามใต้หัวข้อ (:65-67) */
  get pickerQuestion(): Locator {
    return this.root.getByText(FLOW.ccPickerQuestion, { exact: true });
  }

  /** ปุ่มกลับ "‹ Back to contracts" (:58-60) */
  get pickerBack(): Locator {
    return this.root.getByRole('button', { name: FLOW.ccPickerBack, exact: true });
  }

  /** ชื่อกลุ่ม Rental / Finance / Brokerage (:80) */
  pickerGroup(title: string): Locator {
    return this.root.getByText(title, { exact: true });
  }

  /** ปุ่มชนิดเอกสาร (:84-86 Pressable role=button, aria-label "Create {label}", ตัวที่ล็อกมี aria-disabled) */
  kind(kind: DocumentKind): Locator {
    return this.root.getByRole('button', { name: kindButtonName(kind), exact: true });
  }

  /** ชื่อของปุ่มทุกปุ่มในรายละเอียดผู้เช่าที่ชื่อเข้ารูป "Create {label}" ตามลำดับบนจอ ใช้ตรวจว่ามีปุ่มชนิดเอกสารกี่ปุ่ม */
  kindButtonNames(): Promise<string[]> {
    const [before, after] = FLOW.ccPickerCreate.split('{label}');
    const pattern = new RegExp(`^${escapeRegExp(before)}.+${escapeRegExp(after ?? '')}$`);
    return this.root.getByRole('button', { name: pattern }).evaluateAll((buttons) => buttons.map((button) => button.getAttribute('aria-label') ?? ''));
  }

  /**
   * ข้อความเหตุผลที่ล็อก: Text ตัวเดียวใต้ทุกกลุ่ม รวมเหตุผลของทุกชนิดที่ล็อก คั่นด้วยขึ้นบรรทัดใหม่
   * (ContractsScreen.tsx:1923-1928 ; ContractTypePicker.tsx:94-98) หาจากข้อความเหตุผลข้อใดข้อหนึ่งที่อยู่ในนั้น
   */
  lockHint(containing: string): Locator {
    return this.root.getByText(containing);
  }

  // ---- ฟอร์มสร้างเอกสาร (ContractsScreen.tsx:2018-2528) ----

  /** ปุ่มกลับ "← Choose contract type" (:2021-2032 ปุ่มจาก button() role=button) */
  get backToTypes(): Locator {
    return this.root.getByRole('button', { name: FLOW.ccBackToTypes, exact: true });
  }

  /** หัวข้อของฟอร์ม "Create {type}" (:2033-2050) */
  formHeading(typeName: string): Locator {
    return this.root.getByText(fill(FLOW.ccCreateTitle, { type: typeName }), { exact: true });
  }

  /** ปุ่ม "Save draft" ของฟอร์ม (:2474-2481) ปิดอยู่ระหว่าง busy (button(): :647-648) ปุ่มชื่อเดียวกันในกล่องยืนยันอยู่นอก tenant.detail */
  get saveDraft(): Locator {
    return this.root.getByRole('button', { name: FLOW.ccSaveDraft, exact: true });
  }

  /** ข้อความผิดพลาดรวมของหน้าสัญญา (ContractsScreen.tsx:675-680 Text role=alert) */
  alert(text: string): Locator {
    return this.root.getByRole('alert').filter({ hasText: text });
  }

  /** ข้อความ role=alert ทุกตัวในรายละเอียดผู้เช่า ใช้ตรวจว่าฟอร์มเปิดมาโดยไม่มีข้อความผิดพลาด เช่น ไม่มีแม่แบบ (ContractsScreen.tsx:1458-1459) */
  get alerts(): Locator {
    return this.root.getByRole('alert');
  }

  /**
   * ข้อความ "Broker appointment details" ทุกที่ในฟอร์ม ข้อความนี้ขึ้น 2 ที่ด้วยคีย์เดียวกัน (contracts.broker.details):
   *   ที่ 1 หัวข้อของกรอบนอก (ContractsScreen.tsx:2248-2254 แสดงเมื่อไม่ใช่ฟอร์มหลายขั้น) ที่ 2 หัวการ์ดของช่อง (BrokerAppointmentFields.tsx:139-148)
   */
  get brokerDetailsTitles(): Locator {
    return this.root.getByText(FLOW.ccBrokerDetails, { exact: true });
  }

  /** หัวการ์ดของช่อง = ที่หลังสุดตามลำดับในหน้า เพราะการ์ดของช่องอยู่ในกรอบนอกและมาหลังหัวข้อของกรอบนอก (ContractsScreen.tsx:2250, 2292) */
  get brokerCardTitle(): Locator {
    return this.brokerDetailsTitles.last();
  }

  /**
   * การ์ดของช่อง: View ที่มีหัวการ์ดเป็นลูกตัวแรก ตามด้วย MobileInput 18 ตัว (BrokerAppointmentFields.tsx:129-175)
   */
  private get brokerCard(): Locator {
    return this.brokerCardTitle.locator('xpath=..');
  }

  /**
   * กล่องของช่องตามลำดับในการ์ด: ลูกตัวที่ 0 คือหัวการ์ด ลูกตัวที่ 1-18 คือ MobileInput ตามลำดับของ BROKER_FIELDS
   * ช่องของฟอร์มนี้ไม่มี accessibilityLabel (BrokerAppointmentFields.tsx:150-155) จึงหาด้วยลำดับ แล้วให้ CCR-005 ตรวจว่าป้ายตรงกับลำดับ
   * กล่องของ MobileInput มีลูกเรียงเป็น ป้าย, ช่องกรอก, ข้อความผิดพลาด (มีเมื่อผิด) (MobileInput.tsx:54-124)
   */
  private fieldBox(key: BrokerFieldKey): Locator {
    return this.brokerCard.locator(':scope > *').nth(BROKER_FIELDS.indexOf(key) + 1);
  }

  /** จำนวนลูกของการ์ด (คาด 19 = หัวการ์ด 1 + ช่อง 18) */
  brokerCardChildCount(): Promise<number> {
    return this.brokerCard.locator(':scope > *').count();
  }

  /** ป้ายของช่อง (ลูกตัวแรกของกล่อง) */
  fieldLabel(key: BrokerFieldKey): Locator {
    return this.fieldBox(key).locator(':scope > *').first();
  }

  /**
   * ช่องกรอก (input หรือ textarea เมื่อเป็นช่องหลายบรรทัด)
   * ฟอร์มเติมข้อมูลของผู้ให้เช่าและนายหน้ามาให้ (ชื่อ เลขบัตร เบอร์ ที่อยู่) และ React ใส่ค่าลงแอตทริบิวต์ value ของช่อง
   * ถ้าใช้ fill หรือ expect กับ locator นี้แล้วไม่ผ่าน Playwright จะพิมพ์ตัวชิ้นส่วนพร้อมค่าลงรายงาน (ดู AgentTenantsPage.field)
   * จึงให้เทสใช้ setField / fieldIsEmpty / fieldValueIs ซึ่งทำงานผ่าน evaluateAll และคืนแค่ true/false/null
   * ใช้ locator นี้ตรงได้เฉพาะการนับจำนวน (toHaveCount)
   */
  field(key: BrokerFieldKey): Locator {
    return this.fieldBox(key).locator('input, textarea');
  }

  /**
   * ตั้งค่าในช่องโดยไม่ผ่าน fill (เหตุผลเดียวกับ support/inputs.ts setInputValueHidden แต่รองรับ textarea ของช่องหลายบรรทัดด้วย)
   * ตั้งผ่าน setter ของชนิดช่องแล้วส่ง input event ให้ React รับค่า
   * คืน 'ok' เมื่อตั้งได้ 'missing' เมื่อไม่พบช่องหรือพบมากกว่า 1 ช่อง 'readonly' เมื่อช่องยังแก้ไม่ได้ (ฟอร์มยัง busy: BrokerAppointmentFields.tsx:171)
   */
  setField(key: BrokerFieldKey, value: string): Promise<'ok' | 'missing' | 'readonly'> {
    return this.field(key).evaluateAll((inputs, next) => {
      if (inputs.length !== 1) return 'missing';
      const input = inputs[0] as HTMLInputElement | HTMLTextAreaElement;
      if (input.readOnly || input.disabled) return 'readonly';
      const proto = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(input, next);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      return 'ok';
    }, value);
  }

  /**
   * ข้อความผิดพลาดใต้ช่อง (null = ไม่มี) กล่องมีลูก 2 ตัวเมื่อไม่ผิด และ 3 ตัวเมื่อผิด (MobileInput.tsx:119-123 ฟอร์มนี้ไม่ส่ง helperText)
   * ถ้าไม่พบกล่องของช่อง คืนข้อความ BOX_MISSING เพื่อให้เทสแดงโดยไม่พิมพ์ตัวชิ้นส่วน
   */
  fieldErrorText(key: BrokerFieldKey): Promise<string | null> {
    return this.fieldBox(key).evaluateAll(
      (boxes, missing) => {
        if (boxes.length !== 1) return missing;
        const box = boxes[0];
        return box.children.length > 2 ? (box.children[box.children.length - 1].textContent ?? '') : null;
      },
      BOX_MISSING,
    );
  }

  /** ช่องนี้ว่างหรือไม่ คืนแค่ true/false ไม่คืนค่าในช่อง (null = ไม่พบช่อง หรือพบมากกว่า 1 ช่อง) */
  fieldIsEmpty(key: BrokerFieldKey): Promise<boolean | null> {
    return this.field(key).evaluateAll((inputs) => (inputs.length === 1 ? (inputs[0] as HTMLInputElement | HTMLTextAreaElement).value === '' : null));
  }

  /** ค่าในช่องเท่ากับข้อความนี้หรือไม่ คืนแค่ true/false เพื่อไม่ให้ค่าตั้งต้นของฟอร์มไปอยู่ในรายงานเมื่อไม่ผ่าน (null = ไม่พบช่อง หรือพบมากกว่า 1 ช่อง) */
  fieldValueIs(key: BrokerFieldKey, text: string): Promise<boolean | null> {
    return this.field(key).evaluateAll(
      (inputs, expected) => (inputs.length === 1 ? (inputs[0] as HTMLInputElement | HTMLTextAreaElement).value === expected : null),
      text,
    );
  }

  // ---- กล่องยืนยันก่อนบันทึก (ContractsScreen.tsx:2488-2526 ใน MobileBottomSheet) ----

  /** ปุ่มพื้นหลังของกล่อง ชื่อ "Close" เขียนตายตัว (MobileBottomSheet.tsx:139-144) มีเมื่อกล่องเปิดเท่านั้น (:128 ไม่ mount เมื่อปิด) */
  get confirmBackdrop(): Locator {
    return this.page.getByRole('button', { name: CONTRACT_SAVE_CONFIRM.backdrop, exact: true });
  }

  /** ทั้งกล่อง: พ่อของปุ่มพื้นหลัง มีฉากมืด ปุ่มพื้นหลัง และแผ่นเนื้อหา (MobileBottomSheet.tsx:133-160) */
  private get confirm(): Locator {
    return this.confirmBackdrop.locator('xpath=..');
  }

  /** หัวข้อของกล่อง (ContractsScreen.tsx:2495-2497) */
  confirmTitle(text: string): Locator {
    return this.confirm.getByText(text, { exact: true });
  }

  /** เนื้อความของกล่อง (:2498-2504) */
  get confirmBody(): Locator {
    return this.confirm.getByText(CONTRACT_SAVE_CONFIRM.bodyNewDraft, { exact: true });
  }

  /** ปุ่ม "ยกเลิก" ของกล่อง (:2506-2513) กดแล้วปิดกล่องอย่างเดียว */
  get confirmCancel(): Locator {
    return this.confirm.getByRole('button', { name: CONTRACT_SAVE_CONFIRM.cancel, exact: true });
  }

  /** ปุ่ม "บันทึกฉบับร่าง" ของกล่อง (:2514-2523) ห้ามกด: ส่ง POST /agent/contracts */
  get confirmSave(): Locator {
    return this.confirm.getByRole('button', { name: CONTRACT_SAVE_CONFIRM.save, exact: true });
  }
}
