/// <reference lib="dom" />  // โค้ดใน evaluateAll ทำงานในเบราว์เซอร์ (tsconfig ของชุดนี้ใช้ lib ES2022 อย่างเดียว)
import { expect, type Locator, type Page } from '@playwright/test';
import { FLOW } from '../labels';
import { escapeRegExp } from './leads.page';

/**
 * ผู้เช่าของนายหน้าบนจอกว้าง /agent/clients (apps/consumer-app/components/AgentTenantsScreen.tsx
 *   ตาราง agent-web/TenantWorkTable.web.tsx และ TenantDirectoryTable.web.tsx ที่ 648dd28)
 * API ตอนเปิด: GET /agent/tenants และ GET /bills/agent (AgentTenantsScreen.tsx reload) ค้นและกรองทำในหน้าเว็บ ไม่ขอ API เพิ่ม
 * ตารางแสดงชื่อและเบอร์ของผู้เช่าจริง ห้ามพิมพ์ข้อความของแถวออกรายงาน
 * ห้ามกดปุ่มในคอลัมน์ action ของตารางงาน (TenantWorkTable.web.tsx:129-144) เพราะพาไปหน้ายืนยันสลิปหรือสัญญา
 */
export class AgentTenantsPage {
  constructor(private readonly page: Page) {}

  /** แท็บ "To do" / "All tenants" (MobileSegmentedTabs role=tab ชื่อ "<ชื่อ> <จำนวน>": AgentTenantsScreen.tsx:808-815) */
  tab(view: 'work' | 'all'): Locator {
    const label = view === 'work' ? FLOW.tenantsTabWork : FLOW.tenantsTabAll;
    return this.page.getByRole('tab', { name: new RegExp(`^${escapeRegExp(label)}( \\S+)?$`) });
  }

  /** มุมมองงาน (TenantWorkTable.web.tsx:149 testid tenants.work) */
  get work(): Locator {
    return this.page.getByTestId('tenants.work');
  }

  /** มุมมองทั้งหมด (TenantDirectoryTable.web.tsx:123 testid tenants.all) */
  get all(): Locator {
    return this.page.getByTestId('tenants.all');
  }

  /** ช่องค้นของมุมมองทั้งหมด (:133 testid tenants.search) */
  get search(): Locator {
    return this.page.getByTestId('tenants.search');
  }

  /** ตัวนับ "Showing {shown} of {total}" (:147-149) */
  get count(): Locator {
    return this.all.locator('.awr-count');
  }

  /** แถวของมุมมองทั้งหมด แยกกลุ่มตามโครงการ ทุกกลุ่มใช้ testid tenants.table (:171-196) */
  get rows(): Locator {
    return this.page.locator('[data-testid^="tenants.table.row."]');
  }

  /** รายละเอียดผู้เช่า (TenantDetailFrame.web.tsx:29 testid tenant.detail) ไม่มี URL ของตัวเอง */
  get detail(): Locator {
    return this.page.getByTestId('tenant.detail');
  }

  /** ข้อความผิดพลาดของหน้า (AgentTenantsScreen.tsx role=alert: หน้ารายการ :818 หน้ารายละเอียด :538-545) */
  alert(text: string): Locator {
    return this.page.getByRole('alert').filter({ hasText: text });
  }

  // ---- เพิ่ม 13 พ.ย. 2026 สำหรับเคส TEN-001 ถึง TEN-016 (claude/nestyk-topic-tenants-web-ui.md หัวข้อ 2.1) โค้ดที่ qa/e2e ac7f3d8 ----

  /**
   * จำนวนบนแท็บ ชื่อของแท็บคือ "<ชื่อ> <จำนวน>" ระหว่างโหลดเป็น "<ชื่อ> –"
   * (AgentTenantsScreen.tsx:808-812, packages/ui/src/components/MobileSegmentedTabs.tsx:61-63)
   * รอจนอ่านเลขได้ในการอ่านครั้งเดียวกัน ถ้าหน้าโหลดซ้ำระหว่างรอ จะอ่านใหม่จนได้เลข
   */
  tabCount(view: 'work' | 'all'): Promise<number> {
    const label = view === 'work' ? FLOW.tenantsTabWork : FLOW.tenantsTabAll;
    return countOn(this.tab(view), label, `แท็บ ${label}`);
  }

  /** แถวของผู้เช่าตาม id (agent-web/ui/WebTable.tsx:169 testid <testID>.row.<key>, TenantDirectoryTable.web.tsx:193-195) */
  row(id: number): Locator {
    return this.page.getByTestId(`tenants.table.row.${id}`);
  }

  /** กลุ่มตัวกรองสถานะของมุมมองทั้งหมด (TenantDirectoryTable.web.tsx:136 role=group aria-label = หัวคอลัมน์ Status) */
  get filterGroup(): Locator {
    return this.all.getByRole('group', { name: FLOW.tenantsFilterGroup, exact: true });
  }

  /**
   * ตัวกรอง All / Signing contract / Tenant ชื่อที่อ่านได้คือ "<ชื่อ> <จำนวน>" ระหว่างโหลดเป็น "<ชื่อ> –"
   * (TenantDirectoryTable.web.tsx:137-145, packages/ui/src/components/MobileFilterChip.tsx:57-59)
   * regex รับ "<ชื่อ>" ตามด้วยคำเดียวที่ไม่มีช่องว่าง เพื่อให้เจอปุ่มทั้งตอนเป็นเลขและตอนเป็น "–" (LeadsPage.chip รับเฉพาะเลข)
   */
  filter(key: TenantFilterKey): Locator {
    return this.filterGroup.getByRole('button', { name: new RegExp(`^${escapeRegExp(FILTER_LABEL[key])}( \\S+)?$`) });
  }

  /** จำนวนบนตัวกรอง (รอจนอ่านเลขได้) */
  filterCount(key: TenantFilterKey): Promise<number> {
    return countOn(this.filter(key), FILTER_LABEL[key], `ตัวกรอง ${FILTER_LABEL[key]}`);
  }

  /** สถานะ "กรองแล้วไม่เจอ" ของมุมมองทั้งหมด (TenantDirectoryTable.web.tsx:158-165, agent-web/ui/WebState.tsx:63) */
  get filteredState(): Locator {
    return this.all.getByTestId('state.filtered');
  }

  /** ปุ่ม Clear filters ในสถานะนั้น (WebState.tsx:77-81) ล้างทั้งคำค้นและตัวกรอง (TenantDirectoryTable.web.tsx:161-164) */
  get clearFilters(): Locator {
    return this.filteredState.getByRole('button', { name: FLOW.webClearFilters, exact: true });
  }

  /** หัวกลุ่มโครงการ (TenantDirectoryTable.web.tsx:176-186) มี aria-expanded และ aria-label "{โครงการ}, {จำนวน} people" */
  get groupHeads(): Locator {
    return this.all.locator('button.awt-group-head');
  }

  /**
   * หัวกลุ่มทุกกลุ่มตามลำดับบนจอ: group = ชื่อโครงการกับจำนวนที่แยกจาก aria-label (null = ไม่ตรงรูปแบบ), expanded = กางอยู่หรือไม่
   * ชื่อโครงการไม่ใช่ข้อมูลส่วนตัว แต่ไม่ควรพิมพ์ออกรายงานโดยไม่จำเป็น
   */
  async groupHeadStates(): Promise<{ group: { property: string; count: number } | null; expanded: boolean }[]> {
    const heads = await this.groupHeads.evaluateAll((buttons) =>
      buttons.map((button) => ({ label: button.getAttribute('aria-label') ?? '', expanded: button.getAttribute('aria-expanded') === 'true' })),
    );
    return heads.map((head) => ({ group: parseGroupLabel(head.label), expanded: head.expanded }));
  }

  /** เมนูข้างของรายละเอียด (agent-web/TenantDetailFrame.web.tsx:54 testid tenant.section.<key>) */
  section(key: TenantSectionKey): Locator {
    return this.page.getByTestId(`tenant.section.${key}`);
  }

  /** เมนูข้างทุกรายการ และรายการที่เปิดอยู่ (TenantDetailFrame.web.tsx:49 aria-current="page") */
  get sections(): Locator {
    return this.page.locator('[data-testid^="tenant.section."]');
  }

  get currentSections(): Locator {
    return this.page.locator('[data-testid^="tenant.section."][aria-current="page"]');
  }

  /** ชื่อผู้เช่าที่หัวเมนูข้าง (TenantDetailFrame.web.tsx:35-36) ห้ามพิมพ์ค่านี้ออกรายงาน */
  get detailName(): Locator {
    return this.detail.locator('.awt-detail-who strong');
  }

  /** กล่องสรุปงาน 4 กล่องของแท็บ To do เรียง slip, overdue, signing, renewal (TenantWorkTable.web.tsx:150-176, lib/tenant-work.ts:6) */
  get tiles(): Locator {
    return this.work.getByRole('group', { name: FLOW.tenantsWorkGroup, exact: true }).getByRole('button');
  }

  /**
   * จำนวนในกล่องทั้ง 4 ตามลำดับ aria-label ของกล่องคือ "<ชื่อ> <จำนวน>, <คำอธิบาย>" (TenantWorkTable.web.tsx:162)
   * null = กล่องนั้นไม่มี หรือ aria-label ไม่ขึ้นต้นด้วยชื่อที่คาด
   */
  async tileCounts(): Promise<(number | null)[]> {
    const labels = await this.tiles.evaluateAll((tiles) => tiles.map((tile) => tile.getAttribute('aria-label') ?? ''));
    return TILE_LABELS.map((name, index) => {
      const match = (labels[index] ?? '').match(new RegExp(`^${escapeRegExp(name)} (\\d+), `));
      return match ? Number(match[1]) : null;
    });
  }

  /** แถบ "Showing: <ชื่อกล่อง>" เมื่อกรองตามกล่อง (TenantWorkTable.web.tsx:184-191 role=status class awt-filtered) */
  get workFilteredBar(): Locator {
    return this.work.locator('.awt-filtered[role="status"]');
  }

  /** ปุ่ม "Show all work" ในแถบนั้น (:187-189) */
  get showAllWork(): Locator {
    return this.workFilteredBar.getByRole('button', { name: FLOW.tenantsShowAllWork, exact: true });
  }

  /** ช่องค้นของแท็บ To do (TenantWorkTable.web.tsx:201 testid tenants.workSearch) */
  get workSearch(): Locator {
    return this.page.getByTestId('tenants.workSearch');
  }

  /** แถวของตารางงาน (TenantWorkTable.web.tsx:219 testID tenants.workTable, agent-web/ui/WebTable.tsx:169) */
  get workRows(): Locator {
    return this.page.locator('[data-testid^="tenants.workTable.row."]');
  }

  /**
   * key ของแถวงาน แยกเป็นชนิดกับเลข: slip-<id บิล> / sign-<id สัญญา> / renewal-<id ผู้เช่า> / overdue-<id ผู้เช่า>
   * (TenantWorkTable.web.tsx:20-21) null = อ่านไม่ได้
   */
  async workRowKey(row: Locator): Promise<{ kind: string; id: number } | null> {
    const match = ((await row.getAttribute('data-testid')) ?? '').match(/^tenants\.workTable\.row\.([a-z]+)-(\d+)$/);
    return match ? { kind: match[1], id: Number(match[2]) } : null;
  }

  /**
   * ช่องแรกของแถวงาน ใช้กดเพื่อเปิดผู้เช่า (กดที่แถว = onRowPress: WebTable.tsx:161)
   * ไม่ใช่ปุ่มท้ายแถว ซึ่งพาไปหัวข้อ payments หรือ contracts (TenantWorkTable.web.tsx:129-144)
   */
  workRowCell(row: Locator): Locator {
    return row.locator('td').first();
  }

  /** สถานะของตารางงานเมื่อไม่มีแถว: empty = ไม่มีงาน, filtered = กรองหรือค้นแล้วไม่เจอ (agent-web/ui/WebTable.tsx:134-147, TenantWorkTable.web.tsx:212-217) */
  workState(kind: 'empty' | 'filtered'): Locator {
    return this.work.getByTestId(`state.${kind}`);
  }

  /** ปุ่ม Edit tenant ที่หัวหน้า แสดงเมื่ออยู่ที่ Overview หรือ profile และยังไม่ได้แก้ไข (app/index.tsx:839, 897-907 ; AgentTenantsScreen.tsx:362 ; agent-web/AgentSectionHeader.web.tsx:52, 64-77) */
  get editButton(): Locator {
    return this.page.locator('.aw-page-actions').getByRole('button', { name: FLOW.tenantsEdit });
  }

  /** แถบล่างตอนแก้ไข (agent-web/AgentWorkspace.web.tsx:1190 class aw-page-bottom ; app/index.tsx:1936, 1954-1960 ; AgentTenantsScreen.tsx TenantEditBar :867-912) */
  private get editBar(): Locator {
    return this.page.locator('.aw-page-bottom');
  }

  get saveButton(): Locator {
    return this.editBar.getByRole('button', { name: FLOW.tenantsSave });
  }

  get cancelButton(): Locator {
    return this.editBar.getByRole('button', { name: FLOW.tenantsCancel });
  }

  /** ข้อความผิดพลาดตอนแก้ไข ขึ้นในแถบล่างเท่านั้น (AgentTenantsScreen.tsx:538 ซ่อนในเนื้อหน้าเมื่อ editing, TenantEditBar :883-890) */
  get editAlert(): Locator {
    return this.editBar.getByRole('alert');
  }

  /**
   * ช่องของฟอร์มแก้ไขตามป้าย (accessibilityLabel = ป้ายของช่อง: AgentTenantsScreen.tsx:698-712)
   * ช่องนี้มีข้อมูลจริงของผู้เช่า (ชื่อ อีเมล) และ React ใส่ค่าลงแอตทริบิวต์ value ของ <input>
   * ถ้าใช้ expect หรือ fill กับ locator นี้แล้วไม่ผ่าน Playwright จะพิมพ์ตัวชิ้นส่วนพร้อมค่าลงรายงาน
   * จึงให้เทสใช้ fieldReadOnly / fieldIsEmpty (คืนแค่ true/false) และ setInputValueHidden แทน
   */
  field(label: string): Locator {
    return this.detail.getByLabel(label, { exact: true });
  }

  /** ช่องนี้แก้ไม่ได้หรือไม่ (แอตทริบิวต์ readonly ของ <input>) null = ไม่พบช่อง หรือพบมากกว่า 1 ช่อง */
  fieldReadOnly(label: string): Promise<boolean | null> {
    return this.field(label).evaluateAll((inputs) => (inputs.length === 1 ? (inputs[0] as HTMLInputElement).readOnly === true : null));
  }

  /** ช่องนี้ว่างหรือไม่ null = ไม่พบช่อง หรือพบมากกว่า 1 ช่อง */
  fieldIsEmpty(label: string): Promise<boolean | null> {
    return this.field(label).evaluateAll((inputs) => (inputs.length === 1 ? (inputs[0] as HTMLInputElement).value === '' : null));
  }

  /** ข้อความใต้ช่องอีเมลของผู้เช่าที่มีบัญชีล็อกอินแล้ว (AgentTenantsScreen.tsx:749-751) */
  get emailLockedNote(): Locator {
    return this.detail.getByText(FLOW.tenantsEmailLocked, { exact: true });
  }
}

export type TenantSectionKey = 'overview' | 'profile' | 'room' | 'contracts' | 'bills' | 'payments' | 'attachments';

/** ลำดับของเมนูข้าง (agent-web/TenantDetailFrame.web.tsx:18-26) */
export const TENANT_SECTIONS: readonly TenantSectionKey[] = ['overview', 'profile', 'room', 'contracts', 'bills', 'payments', 'attachments'];

export type TenantFilterKey = 'all' | 'signing' | 'active';

const FILTER_LABEL: Record<TenantFilterKey, string> = {
  all: FLOW.tenantsFilterAll,
  signing: FLOW.tenantsFilterSigning,
  active: FLOW.tenantsFilterActive,
};

/** ชื่อกล่องสรุปงานตามลำดับบนจอ (lib/tenant-work.ts:6 TENANT_WORK_KINDS, TenantWorkTable.web.tsx:35-40) */
export const TILE_LABELS: readonly string[] = [FLOW.tenantsTileSlip, FLOW.tenantsTileOverdue, FLOW.tenantsTileSigning, FLOW.tenantsTileRenewal];

/** เลขท้ายชื่อแบบ "<ชื่อ> <จำนวน>" (null = ไม่ตรงรูปแบบ เช่น ระหว่างโหลดเป็น "<ชื่อ> –") */
function trailingNumber(text: string | null, label: string): number | null {
  const match = (text ?? '').match(new RegExp(`^${escapeRegExp(label)} (\\d+)$`));
  return match ? Number(match[1]) : null;
}

/**
 * รอจน aria-label ของชิ้นส่วนเป็น "<ชื่อ> <จำนวน>" แล้วคืนจำนวน
 * อ่านและตรวจในครั้งเดียวกัน: ถ้าหน้าโหลดซ้ำแล้วชื่อกลับเป็น "<ชื่อ> –" จะอ่านใหม่ ไม่คืนค่าว่าง
 * ถ้าอ่านไม่ได้ภายใน 30 วินาที ไม่ผ่าน พร้อมข้อความว่าอ่านจากชิ้นส่วนไหน
 * ค่าเวลา 2 ค่าเป็นค่าที่เลือกเอง ไม่มีที่มาจากโค้ดของแอป:
 *   30 วินาที = เท่ากับเวลาที่ waitForApi รอคำตอบ (support/api.ts:47) เพราะเลขขึ้นหลังคำตอบของรายการมาถึง
 *   1 วินาทีต่อการอ่าน 1 ครั้ง = ไม่ให้การอ่านครั้งเดียวค้างจนกินเวลาทั้งหมดเมื่อชิ้นส่วนยังไม่ขึ้น (แท็บขึ้นหลังแถบโหลดปิด: AgentTenantsScreen.tsx:413-422)
 * ตัวช่วยนี้ใช้ expect.poll แบบเดียวกับ waitForStableValue (support/wait.ts:28-45) วางไว้ในไฟล์นี้เพราะใช้เฉพาะหน้าผู้เช่า
 */
async function countOn(target: Locator, label: string, what: string): Promise<number> {
  const seen: { value: number | null } = { value: null };
  await expect
    .poll(
      async () => {
        seen.value = trailingNumber(await target.getAttribute('aria-label', { timeout: 1_000 }).catch(() => null), label);
        return seen.value;
      },
      { message: `อ่านจำนวนบน${what}ไม่ได้ (aria-label ต้องเป็น "${label} <จำนวน>")`, timeout: 30_000 },
    )
    .not.toBeNull();
  return seen.value as number;
}

/**
 * แยก aria-label ของหัวกลุ่มโครงการ "{property}, {count} people" (agent.tenants.list.groupToggle) เป็นชื่อโครงการกับจำนวน
 * null = ไม่ตรงรูปแบบ
 */
export function parseGroupLabel(text: string): { property: string; count: number } | null {
  const pattern = escapeRegExp(FLOW.tenantsGroupToggle).replace('\\{property\\}', '(.*)').replace('\\{count\\}', '(\\d+)');
  const match = text.match(new RegExp(`^${pattern}$`));
  return match ? { property: match[1], count: Number(match[2]) } : null;
}
