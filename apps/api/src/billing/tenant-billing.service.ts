import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { DataSource, EntityManager, In, IsNull } from "typeorm";
import type { AgentTenantBilling, BillLateFee, BillReservationCredit, FinancialDocumentInput, TenantBill, TenantNextBill } from "@nestyk/types";
import { TenantEntity } from '../entities/tenant.entity';
import { RoomTenancyEntity } from '../entities/room-tenancy.entity';
import { financialTotals } from '../agent/contracts/financial-document';
import { LeaseContractEntity } from "../entities/lease-contract.entity";
import { TenantBillEntity } from "../entities/tenant-bill.entity";
import { AgentInvoiceEntity } from "../entities/agent-invoice.entity";
import { ContractDocumentStorageService } from "../agent/contracts/contract-document-storage.service";
import { createFinancialPdf } from "../agent/contracts/financial-pdf";
import {
  lateFeeDays,
  lateFeeInput,
  lateFeeInvoice,
  lateFeeOpen,
  lateFeeRate,
  paidOn,
  sameLateFeeSlip,
} from "./late-fee-invoice";
import {
  addDays,
  bangkokToday,
  firstRentPeriod,
  proratedFirstRent,
  graceUntilFor,
  parseAdvanceMonths,
  parseDueDay,
  renewalActiveOn,
  rentPeriodsUntil,
  shiftDueAfter,
} from "./rent-schedule";

type LeaseFormData = {
  rentDueDay?: unknown;
  graceDay?: unknown;
  advanceMonths?: unknown;
  bankName?: unknown;
  accountName?: unknown;
  accountNo?: unknown;
};

function leaseForm(c: LeaseContractEntity): LeaseFormData {
  const saved = c.data?.leaseAgreement;
  const base = saved && typeof saved === "object" ? (saved as LeaseFormData) : {};
  const renewal = c.data?.leaseRenewal;
  if (!renewal || typeof renewal !== "object") return base;
  const form = renewal as { dueDay?: unknown; bankAccount?: unknown };
  const bank = typeof form.bankAccount === "string" ? form.bankAccount.trim() : "";
  const parts = bank.split(/\s*\/\s*/);
  return {
    ...base,
    rentDueDay: form.dueDay || base.rentDueDay,
    ...(parts.length === 3 ? { bankName: parts[0], accountName: parts[1], accountNo: parts[2] }
      : parts.length === 2 ? { bankName: parts[0], accountNo: parts[1] } : { accountNo: bank || base.accountNo }),
  };
}

/** Once a renewal term has started, rent follows that contract and the one it extends stops. */
export function currentRentContracts(rows: LeaseContractEntity[], today: string) {
  const covered = new Set(
    rows
      .filter((row) => row.previous_agreement_id != null && row.start_date.slice(0, 10) <= today)
      .map((row) => row.previous_agreement_id as number),
  );
  return rows.filter((row) => !covered.has(row.id));
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function returnReason(input: unknown) {
  const reason = text(
    input && typeof input === "object" && !Array.isArray(input)
      ? (input as { reason?: unknown }).reason
      : undefined,
  );
  if (!reason || reason.length > 500)
    throw new BadRequestException("กรุณาระบุเหตุผลในการตีกลับ");
  return reason;
}

export function billDocumentNo(leaseId: number, period: string) {
  return `RB${period.replace("-", "")}${String(leaseId).padStart(6, "0")}`;
}

function scheduleInput(c: LeaseContractEntity) {
  const form = leaseForm(c);
  const endsOn = (c.data as { endsOn?: { date?: unknown } } | null)?.endsOn?.date;
  const end = typeof endsOn === "string" && c.end_date && endsOn < c.end_date ? endsOn : c.end_date;
  return {
    anchorDate: c.move_in_date ?? c.start_date,
    endDate: end,
    dueDay: form.rentDueDay,
    graceDay: form.graceDay,
    advanceMonths: parseAdvanceMonths(form.advanceMonths, c.advance_rent, c.monthly_rent),
  };
}

/** D12 (AC-7.2): a new lease (not a renewal) bills its first period with the reservation taken off. */
const isNewLease = (c: LeaseContractEntity) => c.agreement_kind === "new";

/** First period whose bill is not issued yet (issue date after `today`). */
export function upcomingRentPeriod(c: LeaseContractEntity, today: string) {
  if (!(Number(c.monthly_rent ?? 0) > 0)) return null;
  // The first period of a new lease is issued once the lease is in effect, so it is never "upcoming".
  const schedule = { ...scheduleInput(c), afterFirst: isNewLease(c) };
  // Bounded horizon: a lease without `end_date` would otherwise never stop producing periods.
  return rentPeriodsUntil(schedule, addDays(today, 3660)).find((p) => p.issueDate > today) ?? null;
}

/**
 * Bills still open today; periods already past their grace window are never backfilled. A new lease always gets
 * its first period, issued as soon as the lease is in effect, for the rent less `reservationCredit` (the booking
 * receipt). At 0 it is paid at once with no slip; a reservation above the rent is left to the parties (AC-2.4).
 */
export function openRentBills(c: LeaseContractEntity, today: string, reservationCredit: number | null = null) {
  const amount = Number(c.monthly_rent ?? 0);
  if (!(amount > 0)) return [];
  const schedule = scheduleInput(c);
  const fresh = isNewLease(c);
  const bill = (p: { period: string; issueDate: string; dueDate: string; graceUntil: string }, value: number) => ({
    lease_contract_id: c.id,
    tenant_id: c.tenant_id,
    period: p.period,
    document_no: billDocumentNo(c.id, p.period),
    issue_date: p.issueDate,
    due_date: p.dueDate,
    grace_until: p.graceUntil,
    amount: value.toFixed(2),
    status: "pending" as "pending" | "paid",
  });
  const signedOn = c.agreement_kind === "renewal" && typeof c.data?.renewalSignedOn === "string"
    ? c.data.renewalSignedOn : null;
  const source = signedOn
    ? rentPeriodsUntil({ ...schedule, advanceMonths: 0 }, today).map((p) => {
        if (p.dueDate > signedOn) return p;
        const dueDay = parseDueDay(schedule.dueDay) ?? Number(schedule.anchorDate.slice(8, 10));
        const dueDate = shiftDueAfter(signedOn, dueDay, p.dueDate);
        return { ...p, dueDate, graceUntil: graceUntilFor(dueDate, parseDueDay(schedule.graceDay)), issueDate: today < p.issueDate ? p.issueDate : today };
      })
    : rentPeriodsUntil({ ...schedule, afterFirst: fresh }, today);
  const rows = source
    .filter((p) => p.graceUntil >= today)
    .map((p) => bill(p, amount));
  const first = fresh ? firstRentPeriod(schedule) : null;
  if (!first) return rows;
  const firstRent = proratedFirstRent(amount, schedule.anchorDate, first.dueDate);
  const due = Math.max(0, Math.round((firstRent - (reservationCredit ?? 0)) * 100) / 100);
  const firstBill = bill({ ...first, issueDate: first.issueDate < today ? first.issueDate : today }, due);
  return [due === 0 ? { ...firstBill, status: "paid" as const, paid_at: new Date() } : firstBill, ...rows];
}

type Db = DataSource | EntityManager;
const formKind = (c: LeaseContractEntity) => c.template?.form_kind ?? c.agreement_type?.form_kind ?? null;

/**
 * D12 (AC-7.2): the booking receipt of each new lease, by lease id: the invoice total of the deal's reservation
 * (same lead, room and agent, not cancelled) once its receipt is issued. Leases without one are left out.
 */
export async function reservationCredits(db: Db, leases: LeaseContractEntity[]) {
  const wanted = [...new Map(leases.filter((c) => c && isNewLease(c) && c.lead_id != null && c.rent_room_id != null)
    .map((c) => [c.id, c])).values()];
  const out = new Map<number, number>();
  if (!wanted.length) return out;
  const rows = await db.getRepository(LeaseContractEntity).find({
    where: wanted.map((c) => ({ created_by_user_id: c.created_by_user_id, lead_id: c.lead_id, rent_room_id: c.rent_room_id })),
    relations: { template: true, agreement_type: true },
  });
  for (const c of wanted) {
    const reservation = rows
      .filter((r) => r.created_by_user_id === c.created_by_user_id && r.lead_id === c.lead_id &&
        r.rent_room_id === c.rent_room_id && r.status !== "cancelled" && !!r.receipt_url && formKind(r) === "reservation")
      .sort((a, b) => b.id - a.id)[0];
    const invoice = (reservation?.data?.financialDocuments as { invoice?: FinancialDocumentInput } | undefined)?.invoice;
    const total = invoice?.items?.length ? financialTotals(invoice).total : NaN;
    if (Number.isFinite(total) && total >= 0) out.set(c.id, total);
  }
  return out;
}

/** The "rent − reservation" line of a new lease's first bill, or null for any other bill. */
function billReservationCredit(b: TenantBillEntity, credits?: Map<number, number>): BillReservationCredit | null {
  const c = b.lease_contract;
  const credit = c ? credits?.get(c.id) : undefined;
  if (!c || credit == null || !isNewLease(c)) return null;
  const rent = Number(c.monthly_rent ?? 0);
  if (!(Number(b.amount) < rent) || firstRentPeriod(scheduleInput(c))?.period !== b.period) return null;
  return { rent, credit };
}

/** The late fee invoice shown next to its rent bill. A receipt closes it; a sent slip waits for the agent. */
function lateFeeSummary(row: AgentInvoiceEntity | null): BillLateFee | null {
  if (!row) return null;
  const awaiting = !row.receipt_pdf_path && !!row.payment_slip_path && !!row.slip_submitted_at;
  return {
    invoiceId: row.id,
    documentNo: row.document_no,
    amount: Number(row.amount),
    dueDate: row.due_date ?? row.issue_date,
    status: row.receipt_pdf_path ? "paid" : awaiting ? "awaiting_review" : "pending",
    slipReturnReason: !row.receipt_pdf_path && !row.payment_slip_path ? text(row.slip_return_note) || null : null,
    hasPaymentSlip: !!row.payment_slip_path,
    slipSubmitted: !!row.slip_submitted_at,
    slipSubmittedAt: row.slip_submitted_at ? new Date(row.slip_submitted_at).toISOString() : null,
    receiptIssued: !!row.receipt_pdf_path,
  };
}

@Injectable()
export class TenantBillingService {
  private readonly logger = new Logger(TenantBillingService.name);

  constructor(
    private readonly db: DataSource,
    private readonly documents?: ContractDocumentStorageService,
  ) {}

  private activeLeases() {
    return this.db
      .getRepository(LeaseContractEntity)
      .createQueryBuilder("c")
      .leftJoin("c.template", "template")
      .leftJoin("c.agreement_type", "agreementType")
      .leftJoinAndSelect("c.tenant", "tenant")
      .where("(c.status = 'active' OR (c.agreement_kind = 'renewal' AND c.document_url IS NOT NULL AND c.status IN ('awaiting_signatures', 'awaiting_agent_review')))")
      .andWhere("COALESCE(template.form_kind, agreementType.form_kind) IN ('lease', 'renewal')");
  }

  private async insertBills(leases: LeaseContractEntity[], today: string) {
    if (!leases.length) return 0;
    return this.db.transaction(async manager => {
      const current: LeaseContractEntity[] = [];
      // Re-read under the same parent lock as closure; stale scheduler snapshots cannot issue bills after closure.
      for (const id of [...new Set(leases.map(c => c.id))].sort((a, b) => a - b)) {
        const snapshot = leases.find((row) => row.id === id);
        const c = await manager.findOne(LeaseContractEntity, {
          where: { id, status: "active" }, lock: { mode: "pessimistic_write" },
        });
        if (c) { current.push(c); continue; }
        if (snapshot?.agreement_kind !== "renewal" || snapshot.status === "active") continue;
        const pending = await manager.findOne(LeaseContractEntity, {
          where: { id, agreement_kind: "renewal" }, lock: { mode: "pessimistic_write" },
        });
        const signedOn = typeof pending?.data?.renewalSignedOn === "string" ? pending.data.renewalSignedOn : null;
        if (!pending || !signedOn || !["awaiting_signatures", "awaiting_agent_review"].includes(pending.status)) continue;
        const start = String(pending.start_date).slice(0, 10);
        if (today >= renewalActiveOn(start, signedOn))
          await manager.update(LeaseContractEntity, { id: pending.id, status: pending.status }, { status: "active" });
        current.push(pending.status === "active" || today >= renewalActiveOn(start, signedOn) ? { ...pending, status: "active" } : pending);
      }
      // Lock all parents before touching shared tenancies, matching closure's parent-before-occupancy order.
      for (const c of current) {
        const moveIn = c.move_in_date ?? c.start_date;
        if (c.room_tenancy_id && moveIn <= today && (!c.end_date || today <= c.end_date)) {
          // The daily job and billing reads activate occupancy only once the signed stay starts.
          // The parent lock keeps a concurrent closure from reactivating a moved-out tenancy.
          await manager.update(RoomTenancyEntity, { id: c.room_tenancy_id, tenant_id: c.tenant_id,
            rent_room_id: c.rent_room_id, created_by_user_id: c.created_by_user_id, status: 'prospect' },
            { status: 'active', move_in_date: moveIn });
        }
      }
      const rent = currentRentContracts(current, today);
      const credits = await reservationCredits(manager, rent);
      const rows = rent.flatMap(c => openRentBills(c, today, credits.get(c.id) ?? null));
      if (!rows.length) return 0;
      const result = await manager.createQueryBuilder().insert().into(TenantBillEntity)
        .values(rows).orIgnore().execute();
      return Array.isArray(result.raw) ? result.raw.length : 0;
    });
  }

  async ensureAllActive(today = bangkokToday()) {
    const created = await this.insertBills(await this.activeLeases().getMany(), today);
    if (created) this.logger.log(`Issued ${created} rent bill(s) for ${today}`);
    return created;
  }

  /** Writes the ended status the day after the last day. An early ending becomes terminated; a natural end becomes expired. */
  async persistEndedLeases(today = bangkokToday()) {
    const rows = await this.db.getRepository(LeaseContractEntity).createQueryBuilder("c")
      .leftJoin("c.template", "template")
      .leftJoin("c.agreement_type", "agreementType")
      .where("c.status = :active", { active: "active" })
      .andWhere("COALESCE(template.form_kind, agreementType.form_kind) IN ('lease', 'renewal')")
      .andWhere("(c.end_date < :today OR (c.data->'endsOn'->>'date') < :today)", { today })
      .getMany();
    let changed = 0;
    for (const lease of rows) {
      const endsOn = (lease.data as { endsOn?: { date?: unknown } } | null)?.endsOn?.date;
      const early = typeof endsOn === "string" ? endsOn.slice(0, 10) : null;
      const end = lease.end_date ? String(lease.end_date).slice(0, 10) : null;
      const last = early && end ? (early < end ? early : end) : early || end;
      if (!last || last >= today) continue;
      const status = early && early < today && (!end || early <= end) ? "terminated" : "expired";
      const result = await this.db.getRepository(LeaseContractEntity).update({ id: lease.id, status: "active" }, { status });
      changed += result.affected ?? 0;
    }
    if (changed) this.logger.log(`Closed ${changed} ended lease(s) on ${today}`);
    return changed;
  }

  async ensureForUser(userId: number, today = bangkokToday()) {
    const leases = await this.activeLeases()
      .andWhere("tenant.user_id = :userId", { userId })
      .getMany();
    return this.insertBills(leases, today);
  }

  private ownerLeases(userId: number) {
    return this.activeLeases()
      .leftJoin("c.rent_room", "ownerRoom")
      .andWhere("(c.owner_user_id = :userId OR (c.owner_user_id IS NULL AND ownerRoom.owner_id = :userId))", { userId });
  }

  async ensureForOwner(userId: number, today = bangkokToday()) {
    return this.insertBills(await this.ownerLeases(userId).getMany(), today);
  }

  private billsQuery() {
    return this.db
      .getRepository(TenantBillEntity)
      .createQueryBuilder("b")
      .innerJoinAndSelect("b.tenant", "tenant")
      .innerJoinAndSelect("b.lease_contract", "c")
      .leftJoinAndSelect("c.rent_room", "room")
      .leftJoinAndSelect("room.property", "property");
  }

  /** Serializes bills with the reservation taken off each new lease's first bill (AC-7.2). */
  private async views(rows: TenantBillEntity[], today = bangkokToday()) {
    const credits = await reservationCredits(this.db, rows.map((row) => row.lease_contract));
    const fees = await this.lateFees(rows.map((row) => row.id));
    return rows.map((row) => this.serialize(row, today, credits, fees.get(row.id) ?? null));
  }

  private async lateFees(billIds: number[]) {
    const ids = [...new Set(billIds)].filter((id) => id != null);
    const out = new Map<number, AgentInvoiceEntity>();
    if (!ids.length) return out;
    const rows = await this.db.getRepository(AgentInvoiceEntity).find({
      where: { tenant_bill_id: In(ids), invoice_kind: "late_fee" },
    });
    for (const row of rows) if (row.tenant_bill_id != null) out.set(row.tenant_bill_id, row);
    return out;
  }

  private async view(row: TenantBillEntity) {
    return (await this.views([row]))[0];
  }

  serialize(b: TenantBillEntity, today = bangkokToday(), credits?: Map<number, number>, lateFee: AgentInvoiceEntity | null = null): TenantBill {
    const c = b.lease_contract;
    const form = c ? leaseForm(c) : {};
    const payTo = {
      bankName: text(form.bankName),
      accountName: text(form.accountName),
      accountNo: text(form.accountNo),
    };
    return {
      id: b.id,
      leaseContractId: b.lease_contract_id,
      contractNo: c?.contract_no ?? null,
      tenantName:
        [b.tenant?.first_name, b.tenant?.last_name].filter((part) => part?.trim()).join(" ") ||
        b.tenant?.name ||
        "",
      property: c?.rent_room?.property?.name ?? "",
      room: c?.rent_room?.room_id ?? null,
      period: b.period,
      documentNo: b.document_no,
      issueDate: b.issue_date,
      dueDate: b.due_date,
      graceUntil: b.grace_until,
      amount: Number(b.amount),
      reservationCredit: billReservationCredit(b, credits),
      lateDays: lateFeeDays(b.grace_until, paidOn(b.paid_at) ?? today),
      lateFeePerDay: lateFeeRate((c?.data?.leaseAgreement as { latePenalty?: unknown } | undefined)?.latePenalty),
      lateFee: lateFeeSummary(lateFee),
      status: b.status === "paid" ? "paid" : today > b.grace_until ? "overdue" : "pending",
      leaseActive: c?.status === "active",
      paidAt: b.paid_at ? new Date(b.paid_at).toISOString() : null,
      hasPaymentSlip: !!b.payment_slip_path,
      slipSubmitted: !!b.slip_submitted_at,
      slipReturnReason: text(b.slip_return_note) || null,
      payTo: payTo.bankName || payTo.accountName || payTo.accountNo ? payTo : null,
    };
  }

  async listMine(userId: number) {
    const today = bangkokToday();
    await this.ensureForUser(userId, today);
    const rows = await this.billsQuery()
      .where("tenant.user_id = :userId", { userId })
      .orderBy("b.due_date", "DESC")
      .addOrderBy("b.id", "DESC")
      .getMany();
    return this.views(rows, today);
  }

  async nextForUser(userId: number): Promise<TenantNextBill | null> {
    const today = bangkokToday();
    await this.ensureForUser(userId, today);
    const unpaid = await this.billsQuery()
      .where("tenant.user_id = :userId", { userId })
      .andWhere("b.status = 'pending'")
      .orderBy("b.due_date", "ASC")
      .addOrderBy("b.id", "ASC")
      .getOne();
    if (unpaid) {
      const view = this.serialize(unpaid, today);
      return {
        billId: view.id,
        leaseContractId: view.leaseContractId,
        property: view.property,
        room: view.room,
        period: view.period,
        issueDate: view.issueDate,
        dueDate: view.dueDate,
        graceUntil: view.graceUntil,
        amount: view.amount,
        status: view.status === "overdue" ? "overdue" : "pending",
      };
    }
    const leases = await this.activeLeases()
      .leftJoinAndSelect("c.rent_room", "room")
      .leftJoinAndSelect("room.property", "property")
      .andWhere("tenant.user_id = :userId", { userId })
      .getMany();
    const next = currentRentContracts(leases, today)
      .map((c) => ({ c, period: upcomingRentPeriod(c, today) }))
      .filter((row): row is { c: LeaseContractEntity; period: NonNullable<typeof row.period> } => !!row.period)
      .sort((a, b) => a.period.dueDate.localeCompare(b.period.dueDate))[0];
    if (!next) return null;
    return {
      billId: null,
      leaseContractId: next.c.id,
      property: next.c.rent_room?.property?.name ?? "",
      room: next.c.rent_room?.room_id ?? null,
      ...next.period,
      amount: Number(next.c.monthly_rent),
      status: "upcoming",
    };
  }

  async listReceived(userId: number) {
    const today = bangkokToday();
    await this.ensureForOwner(userId, today);
    const rows = await this.billsQuery()
      .where("(c.owner_user_id = :userId OR (c.owner_user_id IS NULL AND room.owner_id = :userId))", { userId })
      .orderBy("b.due_date", "DESC")
      .addOrderBy("b.id", "DESC")
      .getMany();
    return this.views(rows, today);
  }

  private async owned(userId: number, id: number) {
    const bill = await this.billsQuery()
      .where("b.id = :id", { id })
      .andWhere("(c.owner_user_id = :userId OR (c.owner_user_id IS NULL AND room.owner_id = :userId))", { userId })
      .getOne();
    if (!bill) throw new NotFoundException("ไม่พบบิล");
    return bill;
  }

  async receivedSlipUrl(userId: number, id: number) {
    const bill = await this.owned(userId, id);
    if (bill.status !== "paid" || !bill.payment_slip_path) throw new NotFoundException("ยังไม่ได้ยืนยันการชำระ");
    if (!this.documents) throw new ServiceUnavailableException("ยังไม่ได้ตั้งค่าที่เก็บเอกสาร");
    const url = (await this.documents.signPaths([bill.payment_slip_path])).get(bill.payment_slip_path);
    if (!url) throw new ServiceUnavailableException("เปิดเอกสารไม่สำเร็จ กรุณาลองอีกครั้ง");
    return { url };
  }

  private async mine(userId: number, id: number) {
    const bill = await this.billsQuery()
      .where("b.id = :id", { id })
      .andWhere("tenant.user_id = :userId", { userId })
      .getOne();
    if (!bill) throw new NotFoundException("ไม่พบบิล");
    return bill;
  }

  async paymentSlipUrl(userId: number, id: number) {
    const bill = await this.mine(userId, id);
    if (!bill.payment_slip_path) throw new NotFoundException("ยังไม่ได้แนบสลิป");
    if (!this.documents) throw new ServiceUnavailableException("ยังไม่ได้ตั้งค่าที่เก็บเอกสาร");
    const url = (await this.documents.signPaths([bill.payment_slip_path])).get(bill.payment_slip_path);
    if (!url) throw new ServiceUnavailableException("เปิดเอกสารไม่สำเร็จ กรุณาลองอีกครั้ง");
    return { url };
  }

  async uploadPaymentSlip(
    userId: number,
    id: number,
    file: { buffer: Buffer; size: number; originalname?: string } | undefined,
  ) {
    const bill = await this.mine(userId, id);
    if (bill.status === "paid" || bill.slip_submitted_at)
      throw new BadRequestException("ยืนยันแล้ว เปลี่ยนสลิปไม่ได้");
    if (!this.documents) throw new ServiceUnavailableException("ยังไม่ได้ตั้งค่าที่เก็บเอกสาร");
    const stored = await this.documents.uploadPaymentSlip(bill.lease_contract.created_by_user_id, file);
    const oldPath = bill.payment_slip_path;
    try {
      const result = await this.db.getRepository(TenantBillEntity).update(
        { id, status: "pending", payment_slip_path: oldPath ?? IsNull(), slip_submitted_at: IsNull() },
        { payment_slip_path: stored.path, slip_return_note: null },
      );
      if (result.affected !== 1)
        throw new ConflictException("บิลถูกเปลี่ยนแล้ว กรุณาเปิดใหม่");
    } catch (error) {
      await this.documents.remove(stored.path).catch(() => undefined);
      throw error;
    }
    if (oldPath) await this.documents.remove(oldPath).catch(() => undefined);
    return this.view(await this.mine(userId, id));
  }

  async submitForTenant(userId: number, id: number) {
    const bill = await this.mine(userId, id);
    if (bill.slip_submitted_at || bill.status === "paid") return this.view(bill);
    if (!bill.payment_slip_path) throw new BadRequestException("กรุณาแนบสลิปก่อนยืนยัน");
    const result = await this.db.getRepository(TenantBillEntity).update(
      { id, status: "pending", payment_slip_path: bill.payment_slip_path, slip_submitted_at: IsNull() },
      { slip_submitted_at: new Date() },
    );
    if (result.affected !== 1) throw new ConflictException("บิลถูกเปลี่ยนแล้ว กรุณาเปิดใหม่");
    return this.view(await this.mine(userId, id));
  }

  private agentBills(agentId: number) {
    return this.billsQuery()
      .leftJoin("c.template", "template")
      .leftJoin("c.agreement_type", "agreementType")
      .where("(c.created_by_user_id = :agentId OR tenant.created_by_user_id = :agentId)", { agentId })
      .andWhere("COALESCE(template.form_kind, agreementType.form_kind) IN ('lease', 'renewal')");
  }

  private async forAgent(agentId: number, id: number) {
    const bill = await this.agentBills(agentId).andWhere("b.id = :id", { id }).getOne();
    if (!bill) throw new NotFoundException("ไม่พบบิล");
    return bill;
  }

  async listForAgent(agentId: number) {
    const rows = await this.agentBills(agentId)
      .andWhere("b.status = 'pending'")
      .andWhere("b.payment_slip_path IS NOT NULL")
      .andWhere("b.slip_submitted_at IS NOT NULL")
      .orderBy("b.due_date", "ASC")
      .addOrderBy("b.id", "ASC")
      .getMany();
    return this.views(rows);
  }

  async listForAgentTenant(agentId: number, tenantId: number): Promise<AgentTenantBilling> {
    const tenant = await this.db.getRepository(TenantEntity).findOneBy({ id: tenantId, created_by_user_id: agentId });
    if (!tenant) throw new NotFoundException('ไม่พบผู้เช่า');
    const today = bangkokToday();
    const leases = await this.activeLeases().andWhere('c.tenant_id = :tenantId', { tenantId }).getMany();
    await this.insertBills(leases, today);
    const rows = await this.agentBills(agentId).andWhere('b.tenant_id = :tenantId', { tenantId })
      .orderBy('b.due_date', 'DESC').addOrderBy('b.id', 'DESC').getMany();
    const credits = await reservationCredits(this.db, rows.map(row => row.lease_contract));
    const bills = rows.map(row => {
      const view = this.serialize(row, today, credits);
      return { id: row.id, period: row.period, documentNo: row.document_no, issueDate: row.issue_date,
        dueDate: row.due_date, amount: view.amount, reservationCredit: view.reservationCredit,
        lateDays: view.lateDays, lateFeePerDay: view.lateFeePerDay, lateFee: view.lateFee,
        status: row.status === 'pending' && row.payment_slip_path && row.slip_submitted_at ? 'awaiting_review' as const : view.status,
        slipSubmittedAt: row.slip_submitted_at ? new Date(row.slip_submitted_at).toISOString() : null, paidAt: view.paidAt };
    });
    const current = currentRentContracts(leases, today);
    const upcoming = current.map(c => ({ period: upcomingRentPeriod(c, today), amount: Number(c.monthly_rent) }))
      .filter(row => row.period !== null).sort((a, b) => a.period!.dueDate.localeCompare(b.period!.dueDate))[0];
    const advancePeriods = [...new Set(current.flatMap(c => {
      const schedule = scheduleInput(c), count = Math.max(0, schedule.advanceMonths);
      // A new lease bills its first period (less the reservation), so only the periods after it are prepaid.
      return rentPeriodsUntil({ ...schedule, advanceMonths: 0 }, addDays(schedule.anchorDate, Math.min(count, 1200) * 32 + 32))
        .slice(isNewLease(c) ? 1 : 0, count).map(period => period.period);
    }))].sort();
    // A first bill the reservation fully covered moved no money, so it is not a payment.
    const payments: AgentTenantBilling['payments'] = rows.filter(row => row.status === 'paid' && row.paid_at && Number(row.amount) > 0).map(row => ({
      id: `bill-${row.id}`, kind: 'rent', period: row.period, amount: Number(row.amount),
      paidAt: new Date(row.paid_at!).toISOString(), hasSlip: !!row.payment_slip_path, receiptIssued: false,
    }));
    const reservations = await this.db.getRepository(LeaseContractEntity).createQueryBuilder('c')
      .leftJoin('c.template', 'template').leftJoin('c.agreement_type', 'agreementType')
      .where('c.tenant_id = :tenantId', { tenantId })
      .andWhere("COALESCE(template.form_kind, agreementType.form_kind) = 'reservation'")
      .andWhere('c.receipt_url IS NOT NULL').getMany();
    for (const c of reservations) {
      const financial = c.data?.financialDocuments as { invoice?: FinancialDocumentInput; receipt?: FinancialDocumentInput } | undefined;
      const payment = c.data?.reservationPayment as { slipPath?: string; submittedAt?: string } | undefined;
      if (!financial?.invoice) continue;
      payments.push({ id: `reservation-${c.id}`, kind: 'reservation', period: null, amount: financialTotals(financial.invoice).total,
        paidAt: financial.receipt?.issueDate || payment?.submittedAt || c.start_date, hasSlip: !!payment?.slipPath, receiptIssued: true });
    }
    payments.sort((a, b) => b.paidAt.localeCompare(a.paidAt));
    return { bills, upcoming: upcoming ? { period: upcoming.period!.period, issueDate: upcoming.period!.issueDate,
      dueDate: upcoming.period!.dueDate, amount: upcoming.amount } : null, advancePeriods, payments };
  }

  async agentSlipUrl(agentId: number, id: number) {
    const bill = await this.forAgent(agentId, id);
    if (!bill.payment_slip_path || !bill.slip_submitted_at) throw new NotFoundException("ยังไม่ได้ส่งสลิป");
    if (!this.documents) throw new ServiceUnavailableException("ยังไม่ได้ตั้งค่าที่เก็บเอกสาร");
    const url = (await this.documents.signPaths([bill.payment_slip_path])).get(bill.payment_slip_path);
    if (!url) throw new ServiceUnavailableException("เปิดเอกสารไม่สำเร็จ กรุณาลองอีกครั้ง");
    return { url };
  }

  async confirmForAgent(agentId: number, id: number) {
    const bill = await this.forAgent(agentId, id);
    if (bill.status === "paid") return this.view(bill);
    if (!bill.payment_slip_path || !bill.slip_submitted_at)
      throw new BadRequestException("ผู้เช่ายังไม่ได้ยืนยันสลิป");
    const result = await this.db.getRepository(TenantBillEntity).update(
      { id, status: "pending", payment_slip_path: bill.payment_slip_path,
        slip_submitted_at: bill.slip_submitted_at },
      { status: "paid", paid_at: new Date(), slip_return_note: null },
    );
    if (result.affected !== 1) throw new ConflictException("บิลถูกเปลี่ยนแล้ว กรุณาเปิดใหม่");
    return this.view(await this.forAgent(agentId, id));
  }

  async returnForAgent(agentId: number, id: number, input: unknown) {
    const bill = await this.forAgent(agentId, id);
    if (bill.status === "paid") throw new BadRequestException("ยืนยันการชำระแล้ว ตีกลับไม่ได้");
    if (!bill.payment_slip_path || !bill.slip_submitted_at)
      throw new BadRequestException("ยังไม่มีสลิปที่ส่งมาให้ตีกลับ");
    const reason = returnReason(input);
    const oldPath = bill.payment_slip_path;
    const result = await this.db.getRepository(TenantBillEntity).update(
      { id, status: "pending", payment_slip_path: oldPath },
      { payment_slip_path: null, slip_return_note: reason, slip_submitted_at: null },
    );
    if (result.affected !== 1) throw new ConflictException("บิลถูกเปลี่ยนแล้ว กรุณาเปิดใหม่");
    if (this.documents) await this.documents.remove(oldPath).catch(() => undefined);
    return this.view(await this.forAgent(agentId, id));
  }

  /** D12 (AC-7.8): only the agent who owns the deal can issue or return a late fee. */
  private async ownedDealBill(agentId: number, id: number) {
    const bill = await this.forAgent(agentId, id);
    if (bill.lease_contract.created_by_user_id !== agentId)
      throw new ForbiddenException("เฉพาะนายหน้าเจ้าของดีล");
    return bill;
  }

  /**
   * D12 (AC-7.8): the deal's agent issues one late fee invoice for a rent bill, in the landlord's name.
   * The amount is typed. It is allowed once the grace day has passed, or the bill was confirmed after it.
   */
  async createLateFee(agentId: number, id: number, input: unknown) {
    const today = bangkokToday();
    const { amount, dueDate } = lateFeeInput(input, today);
    const bill = await this.ownedDealBill(agentId, id);
    if (!lateFeeOpen(bill.grace_until, today, paidOn(bill.paid_at)))
      throw new BadRequestException("ยังไม่เลยวันผ่อนผัน ออกใบแจ้งหนี้ค่าปรับไม่ได้");
    if (!this.documents) throw new ServiceUnavailableException("ยังไม่ได้ตั้งค่าที่เก็บเอกสาร");
    const documents = this.documents;
    const data = lateFeeInvoice(bill.lease_contract, bill.document_no, amount, dueDate, today);
    const stored = await documents.uploadStandaloneInvoice(agentId, await createFinancialPdf("invoice", data));
    try {
      await this.db.transaction(async (manager) => {
        const lease = await manager.findOne(LeaseContractEntity, {
          where: { id: bill.lease_contract_id }, lock: { mode: "pessimistic_write" },
        });
        if (!lease || lease.created_by_user_id !== agentId) throw new ForbiddenException("เฉพาะนายหน้าเจ้าของดีล");
        const current = await manager.findOne(TenantBillEntity, {
          where: { id, lease_contract_id: lease.id }, lock: { mode: "pessimistic_write" },
        });
        if (!current) throw new NotFoundException("ไม่พบบิล");
        if (!lateFeeOpen(current.grace_until, today, paidOn(current.paid_at)))
          throw new BadRequestException("ยังไม่เลยวันผ่อนผัน ออกใบแจ้งหนี้ค่าปรับไม่ได้");
        const existing = await manager.findOne(AgentInvoiceEntity, {
          where: { tenant_bill_id: id, invoice_kind: "late_fee" },
        });
        if (existing) throw new ConflictException("บิลนี้มีใบแจ้งหนี้ค่าปรับแล้ว");
        await manager.getRepository(AgentInvoiceEntity).save(manager.getRepository(AgentInvoiceEntity).create({
          created_by_user_id: agentId,
          tenant_id: current.tenant_id,
          document_no: data.documentNo,
          issue_date: data.issueDate,
          customer_name: data.customerName,
          data,
          pdf_path: stored.path,
          invoice_kind: "late_fee",
          lease_contract_id: lease.id,
          tenant_bill_id: current.id,
          issuer_party: "landlord",
          amount: amount.toFixed(2),
          due_date: data.dueDate,
        }));
      });
    } catch (error) {
      await documents.remove(stored.path).catch(() => undefined);
      if ((error as { code?: string }).code === "23505") throw new ConflictException("บิลนี้มีใบแจ้งหนี้ค่าปรับแล้ว");
      throw error;
    }
    return this.view(await this.forAgent(agentId, id));
  }

  /** AC-7.8: the landlord of the lease can issue the same late fee. It is still filed under the deal agent. */
  async createLateFeeForLandlord(landlordId: number, id: number, input: unknown) {
    const bill = await this.db.getRepository(TenantBillEntity).findOne({
      where: { id },
      relations: { lease_contract: { rent_room: true } },
    });
    const lease = bill?.lease_contract;
    const owns = lease?.owner_user_id === landlordId || (lease?.owner_user_id == null && lease?.rent_room?.owner_id === landlordId);
    if (!bill || !lease || !owns) throw new ForbiddenException("เฉพาะผู้ให้เช่าของห้องนี้");
    return this.createLateFee(lease.created_by_user_id, id, input);
  }

  /** D12: the agent returns the tenant's late fee slip with a reason. */
  async returnLateFeeSlip(agentId: number, id: number, input: unknown) {
    const bill = await this.ownedDealBill(agentId, id);
    const invoice = await this.db.getRepository(AgentInvoiceEntity).findOne({
      where: { tenant_bill_id: bill.id, invoice_kind: "late_fee", created_by_user_id: agentId },
    });
    if (!invoice) throw new BadRequestException("ยังไม่มีใบแจ้งหนี้ค่าปรับ");
    if (invoice.receipt_pdf_path) throw new BadRequestException("ออกใบเสร็จแล้ว ตีกลับสลิปไม่ได้");
    if (!invoice.payment_slip_path || !invoice.slip_submitted_at)
      throw new BadRequestException("ยังไม่มีสลิปที่ผู้เช่าส่งมาให้ตีกลับ");
    sameLateFeeSlip(input, invoice.slip_submitted_at);
    const reason = returnReason(input);
    const oldPath = invoice.payment_slip_path;
    const result = await this.db.getRepository(AgentInvoiceEntity).update(
      { id: invoice.id, payment_slip_path: oldPath, receipt_pdf_path: IsNull() },
      { payment_slip_path: null, slip_submitted_at: null, slip_return_note: reason },
    );
    if (result.affected !== 1) throw new ConflictException("ใบแจ้งหนี้ถูกเปลี่ยนแล้ว กรุณาเปิดใหม่");
    if (this.documents) await this.documents.remove(oldPath).catch(() => undefined);
    return this.view(await this.forAgent(agentId, id));
  }

  private async lateFeeDocument(row: AgentInvoiceEntity, kind: string) {
    const path = kind === "invoice" ? row.pdf_path
      : kind === "receipt" ? row.receipt_pdf_path
      : kind === "payment-slip" ? row.payment_slip_path
      : null;
    if (!path || !["invoice", "receipt", "payment-slip"].includes(kind)) throw new NotFoundException("ไม่พบเอกสาร");
    if (!this.documents) throw new ServiceUnavailableException("ยังไม่ได้ตั้งค่าที่เก็บเอกสาร");
    const url = (await this.documents.signPaths([path])).get(path);
    if (!url) throw new ServiceUnavailableException("เปิดเอกสารไม่สำเร็จ กรุณาลองอีกครั้ง");
    return { url };
  }

  /** The deal's agent opens the late fee invoice, receipt or slip. */
  async lateFeeUrlForAgent(agentId: number, id: number, kind: string) {
    const bill = await this.ownedDealBill(agentId, id);
    const invoice = await this.db.getRepository(AgentInvoiceEntity).findOne({
      where: { tenant_bill_id: bill.id, invoice_kind: "late_fee", created_by_user_id: agentId },
    });
    if (!invoice) throw new NotFoundException("ไม่พบใบแจ้งหนี้ค่าปรับ");
    return this.lateFeeDocument(invoice, kind);
  }

  /** The tenant opens the late fee invoice, receipt or slip of their own rent bill. */
  async lateFeeUrlForTenant(userId: number, id: number, kind: string) {
    const bill = await this.mine(userId, id);
    const invoice = await this.db.getRepository(AgentInvoiceEntity).findOne({
      where: { tenant_bill_id: bill.id, invoice_kind: "late_fee", tenant_id: bill.tenant_id },
    });
    if (!invoice) throw new NotFoundException("ไม่พบใบแจ้งหนี้ค่าปรับ");
    return this.lateFeeDocument(invoice, kind);
  }

  /** The landlord opens the same documents, and cannot send a slip. */
  async lateFeeUrlForOwner(userId: number, id: number, kind: string) {
    const bill = await this.owned(userId, id);
    const invoice = await this.db.getRepository(AgentInvoiceEntity).findOne({
      where: { tenant_bill_id: bill.id, invoice_kind: "late_fee" },
    });
    if (!invoice) throw new NotFoundException("ไม่พบใบแจ้งหนี้ค่าปรับ");
    return this.lateFeeDocument(invoice, kind);
  }

  /** D12: the tenant sends the slip for the late fee invoice of their own bill. */
  async uploadLateFeeSlip(userId: number, id: number, file: { buffer: Buffer; size: number; originalname?: string } | undefined) {
    const bill = await this.mine(userId, id);
    const invoice = await this.db.getRepository(AgentInvoiceEntity).findOne({
      where: { tenant_bill_id: bill.id, invoice_kind: "late_fee", tenant_id: bill.tenant_id },
    });
    if (!invoice) throw new BadRequestException("ยังไม่มีใบแจ้งหนี้ค่าปรับ");
    if (invoice.receipt_pdf_path) throw new BadRequestException("ออกใบเสร็จแล้ว ไม่สามารถเปลี่ยนสลิปได้");
    if (!this.documents) throw new ServiceUnavailableException("ยังไม่ได้ตั้งค่าที่เก็บเอกสาร");
    const documents = this.documents;
    const stored = await documents.uploadPaymentSlip(bill.lease_contract.created_by_user_id, file);
    let oldPath: string | null = null;
    try {
      await this.db.transaction(async (manager) => {
        const current = await manager.findOne(AgentInvoiceEntity, {
          where: { id: invoice.id, tenant_bill_id: bill.id, invoice_kind: "late_fee", tenant_id: bill.tenant_id },
          lock: { mode: "pessimistic_write" },
        });
        if (!current) throw new NotFoundException("ไม่พบใบแจ้งหนี้ค่าปรับ");
        if (current.receipt_pdf_path) throw new ConflictException("ออกใบเสร็จแล้ว ไม่สามารถเปลี่ยนสลิปได้");
        oldPath = current.payment_slip_path;
        await manager.update(AgentInvoiceEntity, { id: current.id }, {
          payment_slip_path: stored.path, slip_submitted_at: new Date(), slip_return_note: null,
        });
      });
    } catch (error) {
      await documents.remove(stored.path).catch(() => undefined);
      throw error;
    }
    if (oldPath) await documents.remove(oldPath).catch(() => undefined);
    return this.view(await this.mine(userId, id));
  }
}
