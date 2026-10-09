import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { DataSource, IsNull } from "typeorm";
import type { TenantBill, TenantNextBill } from "@nestyk/types";
import { LeaseContractEntity } from "../entities/lease-contract.entity";
import { TenantBillEntity } from "../entities/tenant-bill.entity";
import { ContractDocumentStorageService } from "../agent/contracts/contract-document-storage.service";
import {
  addDays,
  bangkokToday,
  parseAdvanceMonths,
  rentPeriodsUntil,
} from "./rent-schedule";

type LeaseFormData = {
  rentDueDay?: unknown;
  advanceMonths?: unknown;
  bankName?: unknown;
  accountName?: unknown;
  accountNo?: unknown;
};

function leaseForm(c: LeaseContractEntity): LeaseFormData {
  const saved = c.data?.leaseAgreement;
  return saved && typeof saved === "object" ? (saved as LeaseFormData) : {};
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function billDocumentNo(leaseId: number, period: string) {
  return `RB${period.replace("-", "")}${String(leaseId).padStart(6, "0")}`;
}

function scheduleInput(c: LeaseContractEntity) {
  const form = leaseForm(c);
  return {
    anchorDate: c.move_in_date ?? c.start_date,
    endDate: c.end_date,
    dueDay: form.rentDueDay,
    advanceMonths: parseAdvanceMonths(form.advanceMonths, c.advance_rent, c.monthly_rent),
  };
}

/** First period whose bill is not issued yet (issue date after `today`). */
export function upcomingRentPeriod(c: LeaseContractEntity, today: string) {
  if (!(Number(c.monthly_rent ?? 0) > 0)) return null;
  // Bounded horizon: a lease without `end_date` would otherwise never stop producing periods.
  return rentPeriodsUntil(scheduleInput(c), addDays(today, 3660)).find((p) => p.issueDate > today) ?? null;
}

/** Bills still open today; periods already past their grace window are never backfilled. */
export function openRentBills(c: LeaseContractEntity, today: string) {
  const amount = Number(c.monthly_rent ?? 0);
  if (!(amount > 0)) return [];
  return rentPeriodsUntil(scheduleInput(c), today)
    .filter((p) => p.graceUntil >= today)
    .map((p) => ({
      lease_contract_id: c.id,
      tenant_id: c.tenant_id,
      period: p.period,
      document_no: billDocumentNo(c.id, p.period),
      issue_date: p.issueDate,
      due_date: p.dueDate,
      grace_until: p.graceUntil,
      amount: amount.toFixed(2),
      status: "pending" as const,
    }));
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
      .where("c.status = 'active'")
      .andWhere("COALESCE(template.form_kind, agreementType.form_kind) = 'lease'");
  }

  private async insertBills(leases: LeaseContractEntity[], today: string) {
    const rows = leases.flatMap((c) => openRentBills(c, today));
    if (!rows.length) return 0;
    const result = await this.db
      .createQueryBuilder()
      .insert()
      .into(TenantBillEntity)
      .values(rows)
      .orIgnore()
      .execute();
    return Array.isArray(result.raw) ? result.raw.length : 0;
  }

  async ensureAllActive(today = bangkokToday()) {
    const created = await this.insertBills(await this.activeLeases().getMany(), today);
    if (created) this.logger.log(`Issued ${created} rent bill(s) for ${today}`);
    return created;
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
      .andWhere("(c.owner_user_id = :userId OR ownerRoom.owner_id = :userId)", { userId });
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

  serialize(b: TenantBillEntity, today = bangkokToday()): TenantBill {
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
      status: b.status === "paid" ? "paid" : today > b.grace_until ? "overdue" : "pending",
      paidAt: b.paid_at ? new Date(b.paid_at).toISOString() : null,
      hasPaymentSlip: !!b.payment_slip_path,
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
    return rows.map((row) => this.serialize(row, today));
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
    const next = leases
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
      .where("(c.owner_user_id = :userId OR room.owner_id = :userId)", { userId })
      .orderBy("b.due_date", "DESC")
      .addOrderBy("b.id", "DESC")
      .getMany();
    return rows.map((row) => this.serialize(row, today));
  }

  private async owned(userId: number, id: number) {
    const bill = await this.billsQuery()
      .where("b.id = :id", { id })
      .andWhere("(c.owner_user_id = :userId OR room.owner_id = :userId)", { userId })
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
    if (bill.status === "paid") throw new BadRequestException("ยืนยันการชำระแล้ว เปลี่ยนสลิปไม่ได้");
    if (!this.documents) throw new ServiceUnavailableException("ยังไม่ได้ตั้งค่าที่เก็บเอกสาร");
    const stored = await this.documents.uploadPaymentSlip(bill.lease_contract.created_by_user_id, file);
    const oldPath = bill.payment_slip_path;
    try {
      const result = await this.db.getRepository(TenantBillEntity).update(
        { id, status: "pending", payment_slip_path: oldPath ?? IsNull() },
        { payment_slip_path: stored.path },
      );
      if (result.affected !== 1)
        throw new ConflictException("บิลถูกเปลี่ยนแล้ว กรุณาเปิดใหม่");
    } catch (error) {
      await this.documents.remove(stored.path).catch(() => undefined);
      throw error;
    }
    if (oldPath) await this.documents.remove(oldPath).catch(() => undefined);
    return this.serialize(await this.mine(userId, id));
  }

  private agentBills(agentId: number) {
    return this.billsQuery()
      .leftJoin("c.template", "template")
      .leftJoin("c.agreement_type", "agreementType")
      .where("(c.created_by_user_id = :agentId OR tenant.created_by_user_id = :agentId)", { agentId })
      .andWhere("COALESCE(template.form_kind, agreementType.form_kind) = 'lease'");
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
      .orderBy("b.due_date", "ASC")
      .addOrderBy("b.id", "ASC")
      .getMany();
    return rows.map((bill) => this.serialize(bill));
  }

  async agentSlipUrl(agentId: number, id: number) {
    const bill = await this.forAgent(agentId, id);
    if (!bill.payment_slip_path) throw new NotFoundException("ยังไม่ได้แนบสลิป");
    if (!this.documents) throw new ServiceUnavailableException("ยังไม่ได้ตั้งค่าที่เก็บเอกสาร");
    const url = (await this.documents.signPaths([bill.payment_slip_path])).get(bill.payment_slip_path);
    if (!url) throw new ServiceUnavailableException("เปิดเอกสารไม่สำเร็จ กรุณาลองอีกครั้ง");
    return { url };
  }

  async confirmForAgent(agentId: number, id: number) {
    const bill = await this.forAgent(agentId, id);
    if (bill.status === "paid") return this.serialize(bill);
    if (!bill.payment_slip_path) throw new BadRequestException("กรุณาแนบสลิปก่อนยืนยัน");
    const result = await this.db.getRepository(TenantBillEntity).update(
      { id, status: "pending" },
      { status: "paid", paid_at: new Date() },
    );
    if (result.affected !== 1) throw new ConflictException("บิลถูกเปลี่ยนแล้ว กรุณาเปิดใหม่");
    return this.serialize(await this.forAgent(agentId, id));
  }
}
