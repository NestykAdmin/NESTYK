import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
} from "@nestjs/common";
import { DataSource, EntityManager, In, IsNull, Not } from "typeorm";
import type {
  DealOffer,
  DealOfferConfirmationMethod,
  DealOfferRevision,
  DealOfferStatus,
  DealOfferTerms,
  LeaseAgreementInput,
  ReservationLetterInput,
} from "@nestyk/types";
import { DealOfferEntity, DealOfferRevisionEntity } from "../../entities/deal-offer.entity";
import { LeaseContractEntity } from "../../entities/lease-contract.entity";
import { ContractDocumentStorageService } from "./contract-document-storage.service";
import { CLOSED_CONTRACT, formKindOf, paidReservationAmount, refreshDealDrafts, type DraftFiles } from "./offer-drafts";
import { LeadEntity } from "../../entities/lead.entity";
import { RentRoomEntity } from "../../entities/rent-room.entity";
import { UserEntity } from "../../entities/user.entity";
import { AgreementTemplateEntity } from "../../entities/agreement-template.entity";
import { AgreementDocumentEntity } from "../../entities/agreement-document.entity";
import { contractAmount } from "./contract-money";
import { asIsoDate, isIsoDate, leaseTermEnd } from "./lease-term";

/**
 * D2 (AC-2.1 to 2.4, round 1, Aof 22 Oct 2026): the terms agreed for a lead and a room. The landlord confirms them
 * (in the app, or the agent records how the landlord confirmed), and only then can the room be booked. The numbers
 * then flow into the reservation letter and the lease. Round 2 (Aof 26 Oct 2026): a confirmed offer changes through
 * revise(), with a reason and how the landlord agreed; unsigned documents of the deal follow (offer-drafts.ts).
 * The contract date is where the lease's date starts (the agent can change it if the signing moves); the renewal
 * notice period is kept for the renewal work (D15).
 */
export const OPEN_OFFER_STATUSES = ["draft", "awaiting_landlord", "confirmed"] as const satisfies readonly DealOfferStatus[];
export const OFFER_NOT_CONFIRMED = "ต้องมีข้อเสนอที่ผู้ให้เช่ายืนยันแล้วของผู้เช่าและห้องนี้ก่อนจองห้อง";
export const CO_BROKE_REQUIRED = "ข้อเสนอนี้มีนายหน้าอีกฝ่าย กรุณาแนบข้อตกลง Co-broke ที่ลงนามแล้วก่อนออกเอกสารหนังสือจอง";
export const DEFAULT_RENEWAL_NOTICE_DAYS = 30;
const CONFIRMATION_METHODS: readonly DealOfferConfirmationMethod[] = ["phone", "line", "in_person", "other"];
const TERM_KEYS = [
  "monthlyRent", "termMonths", "startDate", "depositAmount", "contractDate", "rentDueDay", "graceDay",
  "lateFeePerDay", "renewalNoticeDays", "coBroke", "coBrokeAgentName",
];

/** Terms as stored (money as numeric text with 2 decimals). */
export interface DealOfferRow {
  monthly_rent: string;
  term_months: number;
  start_date: string;
  deposit_amount: string;
  contract_date: string;
  rent_due_day: number;
  grace_day: number | null;
  late_fee_per_day: string | null;
  renewal_notice_days: number;
  co_broke: boolean;
  co_broke_agent_name: string | null;
}

function body(input: unknown, extra: string[]): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new BadRequestException("กรุณาระบุข้อมูลข้อเสนอ");
  const b = input as Record<string, unknown>;
  if (Object.keys(b).some((key) => ![...TERM_KEYS, ...extra].includes(key)))
    throw new BadRequestException("ข้อมูลข้อเสนอมีฟิลด์ที่ไม่รองรับ");
  return b;
}
function wholeNumber(value: unknown, min: number, max: number, message: string) {
  const n = typeof value === "string" && /^\d{1,4}$/.test(value.trim()) ? Number(value) : value;
  if (typeof n !== "number" || !Number.isInteger(n) || n < min || n > max) throw new BadRequestException(message);
  return n;
}
function money(value: unknown, label: string, positive = false) {
  if (typeof value !== "string" && typeof value !== "number")
    throw new BadRequestException(`${label}ต้องเป็นจำนวนเงินที่ถูกต้อง`);
  return contractAmount(String(value), label, positive).toFixed(2);
}
const blank = (value: unknown) => value == null || (typeof value === "string" && !value.trim());

export function validateDealOfferTerms(input: unknown, extra: string[] = []): DealOfferRow {
  const b = body(input, extra);
  const startDate = b.startDate, contractDate = b.contractDate;
  if (!isIsoDate(startDate)) throw new BadRequestException("วันเริ่มสัญญาต้องเป็น ค.ศ. ในรูปแบบ YYYY-MM-DD");
  if (!isIsoDate(contractDate)) throw new BadRequestException("วันทำสัญญาต้องเป็น ค.ศ. ในรูปแบบ YYYY-MM-DD");
  if (contractDate > startDate) throw new BadRequestException("วันทำสัญญาต้องไม่หลังวันเริ่มสัญญา");
  if (typeof b.coBroke !== "boolean") throw new BadRequestException("กรุณาระบุว่ามีนายหน้าอีกฝ่ายหรือไม่");
  const coBrokeName = typeof b.coBrokeAgentName === "string" ? b.coBrokeAgentName.trim() : b.coBrokeAgentName;
  if (b.coBroke && (typeof coBrokeName !== "string" || !coBrokeName || coBrokeName.length > 120))
    throw new BadRequestException("กรุณาระบุชื่อนายหน้าอีกฝ่าย (ไม่เกิน 120 ตัวอักษร)");
  if (!b.coBroke && !blank(coBrokeName))
    throw new BadRequestException("ระบุชื่อนายหน้าอีกฝ่ายได้เมื่อมีนายหน้าอีกฝ่ายเท่านั้น");
  return {
    monthly_rent: money(b.monthlyRent, "ค่าเช่า", true),
    term_months: wholeNumber(b.termMonths, 1, 120, "ระยะเวลาเช่าต้องเป็น 1–120 เดือน"),
    start_date: startDate,
    deposit_amount: money(b.depositAmount, "เงินประกัน"),
    contract_date: contractDate,
    rent_due_day: wholeNumber(b.rentDueDay, 1, 31, "วันครบกำหนดค่าเช่าต้องเป็นวันที่ 1–31"),
    grace_day: blank(b.graceDay) ? null : wholeNumber(b.graceDay, 1, 31, "วันผ่อนผันต้องเป็นวันที่ 1–31"),
    late_fee_per_day: blank(b.lateFeePerDay) ? null : money(b.lateFeePerDay, "ค่าปรับต่อวัน"),
    // AC-2.3: left blank, the notice period is 30 days.
    renewal_notice_days: blank(b.renewalNoticeDays)
      ? DEFAULT_RENEWAL_NOTICE_DAYS
      : wholeNumber(b.renewalNoticeDays, 1, 365, "จำนวนวันแจ้งต่ออายุต้องเป็น 1–365 วัน"),
    co_broke: b.coBroke,
    co_broke_agent_name: b.coBroke ? (coBrokeName as string) : null,
  };
}

function revisionOf(input: unknown) {
  const b = input && typeof input === "object" && !Array.isArray(input) ? (input as Record<string, unknown>) : {};
  if (typeof b.revision !== "number" || !Number.isSafeInteger(b.revision) || b.revision < 1)
    throw new BadRequestException("กรุณาระบุรุ่นของข้อเสนอที่เปิดอยู่");
  return b.revision;
}
function assertRevision(row: DealOfferEntity, revision: number) {
  if (row.revision !== revision)
    throw new ConflictException({ code: "OFFER_CHANGED", message: "ข้อเสนอถูกแก้ไขแล้ว กรุณาเปิดใหม่ก่อนดำเนินการ" });
}

/** Amounts as the contract forms show them: "15000", "15000.5". */
export const plainAmount = (value: string | null) => (value == null ? "" : String(Number(value)));

/** The terms as the app shows and sends them; kept before and after each change of a confirmed offer. */
export function offerTerms(o: DealOfferRow): DealOfferTerms {
  return {
    monthlyRent: plainAmount(o.monthly_rent),
    termMonths: o.term_months,
    startDate: String(o.start_date).slice(0, 10),
    depositAmount: plainAmount(o.deposit_amount),
    contractDate: String(o.contract_date).slice(0, 10),
    rentDueDay: o.rent_due_day,
    graceDay: o.grace_day,
    lateFeePerDay: o.late_fee_per_day == null ? null : plainAmount(o.late_fee_per_day),
    renewalNoticeDays: o.renewal_notice_days,
    coBroke: o.co_broke,
    coBrokeAgentName: o.co_broke_agent_name,
  };
}

/**
 * AC-2.5: a room still let (its lease or renewal not ended, or ended later than the new start) takes an offer only
 * when the new lease starts after the current one ends: its end date, or the date it ended early. The deal's own
 * leases and drafts do not count.
 */
export async function assertStartAfterRoomLease(db: DataSource | EntityManager, roomId: number, leadId: number, startDate: string) {
  const rows = await db.getRepository(LeaseContractEntity).find({
    where: { rent_room_id: roomId }, relations: { template: true, agreement_type: true },
  });
  const ends = rows
    .filter((c) => c.lead_id !== leadId && !["cancelled", "draft"].includes(c.status) &&
      ["lease", "renewal"].includes(formKindOf(c) ?? ""))
    .map((c) => asIsoDate(c.effective_end_date) || asIsoDate(c.end_date))
    .filter((end): end is string => Boolean(end))
    .sort();
  const last = ends[ends.length - 1];
  if (last && startDate <= last)
    throw new BadRequestException({
      code: "OFFER_START_BEFORE_LEASE_END",
      message: `ห้องนี้มีสัญญาเช่าเดิมถึงวันที่ ${last} วันเริ่มสัญญาใหม่ต้องหลังวันนั้น`,
    });
}

/** Whole months of rent in the deposit (in satang, so no rounding error), or null. */
function depositMonthsOf(o: DealOfferRow) {
  const rent = Math.round(Number(o.monthly_rent) * 100), deposit = Math.round(Number(o.deposit_amount) * 100);
  return rent > 0 && deposit % rent === 0 && deposit / rent <= 12 ? deposit / rent : null;
}

/**
 * AC-2.2: the reservation is 1 month of rent paid in advance, so it goes to the advance rent and what is left to pay
 * at signing is the deposit.
 */
export function offerReservationFields(o: DealOfferRow): Partial<ReservationLetterInput> {
  const depositMonths = depositMonthsOf(o);
  return {
    monthlyRent: plainAmount(o.monthly_rent),
    termMonths: String(o.term_months),
    termFrom: o.start_date,
    termTo: leaseTermEnd(o.start_date, o.term_months),
    advanceMonths: "1",
    advanceAmount: plainAmount(o.monthly_rent),
    reservationPayment: plainAmount(o.monthly_rent),
    depositAmount: plainAmount(o.deposit_amount),
    depositMonths: depositMonths == null ? "" : String(depositMonths),
    applyToAdvance: true,
    applyToDeposit: false,
    balanceDue: plainAmount(o.deposit_amount),
  };
}
export const OFFER_RESERVATION_KEYS = Object.keys(offerReservationFields({
  monthly_rent: "1.00", term_months: 1, start_date: "2026-01-01", deposit_amount: "0.00", contract_date: "2026-01-01",
  rent_due_day: 1, grace_day: null, late_fee_per_day: null, renewal_notice_days: 30, co_broke: false, co_broke_agent_name: null,
})) as Array<keyof ReservationLetterInput>;

export function offerLeaseFields(o: DealOfferRow): Partial<LeaseAgreementInput> {
  const r = offerReservationFields(o);
  return {
    monthlyRent: r.monthlyRent,
    termMonths: r.termMonths,
    termFrom: r.termFrom,
    termTo: r.termTo,
    advanceMonths: r.advanceMonths,
    advanceAmount: r.advanceAmount,
    depositMonths: r.depositMonths,
    depositAmount: r.depositAmount,
    rentDueDay: String(o.rent_due_day),
    graceDay: o.grace_day == null ? "" : String(o.grace_day),
    latePenalty: plainAmount(o.late_fee_per_day),
  };
}

type Db = DataSource | EntityManager;
/** The offer the landlord confirmed for this lead and room (open offers are unique per lead and room). */
export function confirmedOffer(db: Db, leadId: number | null | undefined, roomId: number | null | undefined) {
  if (leadId == null || roomId == null) return Promise.resolve(null);
  return db.getRepository(DealOfferEntity).findOne({ where: { lead_id: leadId, rent_room_id: roomId, status: "confirmed" } });
}

/** AC-3.8: the signed co-broke file a reservation letter needs when its offer names another agent. */
export const CO_BROKE_REQUIREMENT = {
  group_key: "co_broke",
  label: "ข้อตกลง Co-broke ที่ลงนามแล้ว (มีนายหน้าอีกฝ่าย ต้องแนบก่อนออกเอกสารหนังสือจอง)",
  subject: "property",
  document_type_code: "agent_commission_agreement",
} as const;
export async function coBrokeRequired(db: Db, c: { template_id: number; lead_id: number; rent_room_id: number }) {
  if (!(await confirmedOffer(db, c.lead_id, c.rent_room_id))?.co_broke) return false;
  const template = await db.getRepository(AgreementTemplateEntity).findOneBy({ id: c.template_id });
  return template?.form_kind === "reservation";
}
/** A current (not removed, not replaced) co-broke file of the contract, attached as a document of the deal. */
export async function hasCoBrokeFile(db: Db, agreementId: number) {
  const docs = await db.getRepository(AgreementDocumentEntity).find({ where: { agreement_id: agreementId } });
  const replaced = new Set(docs.map((d) => d.supersedes_document_id));
  return docs.some((d) => !d.removed_at && !replaced.has(d.id) && d.subject === CO_BROKE_REQUIREMENT.subject &&
    d.document_type_code === CO_BROKE_REQUIREMENT.document_type_code);
}

const iso = (value: Date | null) => (value ? new Date(value).toISOString() : null);
const fullName = (user?: UserEntity | null) =>
  [user?.first_name, user?.last_name].filter((part) => part?.trim()).join(" ").trim() || null;
export function serializeDealOffer(row: DealOfferEntity, lead?: LeadEntity | null, room?: RentRoomEntity | null,
  confirmedBy?: UserEntity | null): DealOffer {
  const project = room?.property?.name?.trim() || room?.listing_title?.trim() || "";
  return {
    id: row.id,
    leadId: row.lead_id,
    leadName: lead?.name ?? "",
    rentRoomId: row.rent_room_id,
    roomLabel: [project, room?.room_id?.trim() ? `ห้อง ${room.room_id.trim()}` : ""].filter(Boolean).join(" · "),
    status: row.status,
    revision: row.revision,
    monthlyRent: plainAmount(row.monthly_rent),
    termMonths: row.term_months,
    startDate: String(row.start_date).slice(0, 10),
    endDate: leaseTermEnd(String(row.start_date).slice(0, 10), row.term_months),
    depositAmount: plainAmount(row.deposit_amount),
    reservationAmount: plainAmount(row.monthly_rent),
    contractDate: String(row.contract_date).slice(0, 10),
    rentDueDay: row.rent_due_day,
    graceDay: row.grace_day,
    lateFeePerDay: row.late_fee_per_day == null ? null : plainAmount(row.late_fee_per_day),
    renewalNoticeDays: row.renewal_notice_days,
    coBroke: row.co_broke,
    coBrokeAgentName: row.co_broke_agent_name,
    sentAt: iso(row.sent_at),
    confirmedAt: iso(row.confirmed_at),
    confirmationChannel: row.confirmation_channel,
    confirmationMethod: row.confirmation_method,
    confirmationNote: row.confirmation_note,
    confirmedByName: fullName(confirmedBy),
    landlordInApp: room?.owner_id != null,
    closedAt: iso(row.closed_at),
  };
}

/**
 * What the landlord sees: the terms, the room and the tenant's name. The agent's notes, who recorded a confirmation
 * and the other agent's name stay with the agent.
 */
export function landlordDealOffer(offer: DealOffer): DealOffer {
  return {
    ...offer,
    confirmationNote: null,
    confirmedByName: offer.confirmationChannel === "app" ? offer.confirmedByName : null,
    coBrokeAgentName: null,
    // D2 round 2: the landlord sees what changed and when, not the agent's reason or the other agent's name.
    revisions: (offer.revisions ?? []).map((r) => ({
      ...r,
      reason: null,
      before: { ...r.before, coBrokeAgentName: null },
      after: { ...r.after, coBrokeAgentName: null },
    })),
    reservationPaid: null,
  };
}

function serializeRevision(row: DealOfferRevisionEntity): DealOfferRevision {
  return {
    revision: row.revision,
    reason: row.reason,
    agreedVia: row.agreed_via,
    before: row.before_terms,
    after: row.after_terms,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

@Injectable()
export class DealOffersService {
  constructor(
    private readonly db: DataSource,
    @Optional() private readonly documents?: ContractDocumentStorageService,
  ) {}

  private async view(row: DealOfferEntity, manager?: EntityManager): Promise<DealOffer> {
    const db = manager ?? this.db;
    const [lead, room, confirmedBy, revisions, reservations] = await Promise.all([
      db.getRepository(LeadEntity).findOneBy({ id: row.lead_id }),
      db.getRepository(RentRoomEntity).findOne({ where: { id: row.rent_room_id }, relations: { property: true } }),
      row.confirmed_by_user_id ? db.getRepository(UserEntity).findOneBy({ id: row.confirmed_by_user_id }) : null,
      db.getRepository(DealOfferRevisionEntity).find({ where: { deal_offer_id: row.id }, order: { revision: "ASC" } }),
      row.status === "confirmed"
        ? db.getRepository(LeaseContractEntity).find({
            where: { created_by_user_id: row.created_by_user_id, lead_id: row.lead_id, rent_room_id: row.rent_room_id },
            relations: { template: true, agreement_type: true },
            order: { id: "DESC" },
          })
        : [],
    ]);
    // AC-2.4: what the tenant paid (or sent the slip for) on the deal's reservation, so the agent is warned when the
    // rent is changed below it.
    const reservation = reservations.find((c) => formKindOf(c) === "reservation" && !CLOSED_CONTRACT.includes(c.status));
    const paid = reservation ? paidReservationAmount(reservation) : null;
    return {
      ...serializeDealOffer(row, lead, room, confirmedBy),
      revisions: revisions.map(serializeRevision),
      reservationPaid: paid == null ? null : plainAmount(paid.toFixed(2)),
    };
  }

  /** The agent's offers of one lead, newest first. */
  async listForLead(agentId: number, leadId: number): Promise<DealOffer[]> {
    const lead = await this.db.getRepository(LeadEntity).findOneBy({ id: leadId, created_by_user_id: agentId });
    if (!lead) throw new NotFoundException("ไม่พบ Lead ที่คุณมีสิทธิ์จัดการ");
    const rows = await this.db.getRepository(DealOfferEntity).find({
      where: { lead_id: leadId, created_by_user_id: agentId }, order: { id: "DESC" },
    });
    return Promise.all(rows.map((row) => this.view(row)));
  }

  async create(agentId: number, input: unknown): Promise<DealOffer> {
    const terms = validateDealOfferTerms(input, ["leadId", "rentRoomId"]);
    const b = input as Record<string, unknown>;
    for (const key of ["leadId", "rentRoomId"])
      if (!Number.isSafeInteger(b[key]) || Number(b[key]) < 1) throw new BadRequestException("กรุณาเลือกผู้เช่าและห้อง");
    const leadId = Number(b.leadId), roomId = Number(b.rentRoomId);
    const row = await this.db.transaction(async (manager) => {
      // Lead then room, the order booking locks them in, so an offer and a booking of the room queue up.
      const lead = await manager.findOne(LeadEntity, {
        where: { id: leadId, created_by_user_id: agentId }, lock: { mode: "pessimistic_write" },
      });
      if (!lead) throw new NotFoundException("ไม่พบ Lead ที่คุณมีสิทธิ์จัดการ");
      if (lead.status === "lost") throw new BadRequestException("Lead ที่ปิดเป็นไม่สำเร็จทำข้อเสนอไม่ได้");
      if (lead.status === "booked" && !lead.booking_released_at)
        throw new ConflictException({ code: "LEAD_ALREADY_BOOKED", message: "Lead นี้จองห้องแล้ว" });
      // A lead that became a tenant cannot be booked again (agent-tenants.service.ts promote), so no new offer.
      if (lead.tenant_id)
        throw new ConflictException({ code: "LEAD_HAS_TENANT", message: "Lead นี้เป็นผู้เช่าแล้ว ทำข้อเสนอใหม่ไม่ได้" });
      const room = await manager.findOne(RentRoomEntity, {
        where: { id: roomId, created_by_user_id: agentId }, lock: { mode: "pessimistic_write" },
      });
      if (!room) throw new NotFoundException("ไม่พบห้องที่คุณมีสิทธิ์จัดการ");
      const taken = await manager.findOne(LeadEntity, {
        where: { rent_room_id: roomId, status: "booked", booking_released_at: IsNull() },
      });
      if (taken) throw new ConflictException({ code: "ROOM_ALREADY_BOOKED", message: "ห้องนี้ถูกจองแล้ว" });
      const open = await manager.findOne(DealOfferEntity, {
        where: { lead_id: leadId, rent_room_id: roomId, status: In([...OPEN_OFFER_STATUSES]) },
      });
      if (open) throw new ConflictException({ code: "OFFER_EXISTS", message: "มีข้อเสนอของผู้เช่าและห้องนี้อยู่แล้ว" });
      await assertStartAfterRoomLease(manager, roomId, leadId, terms.start_date);
      return manager.save(DealOfferEntity, manager.create(DealOfferEntity, {
        ...terms, lead_id: leadId, rent_room_id: roomId, status: "draft", revision: 1, created_by_user_id: agentId,
      }));
    });
    return this.view(row);
  }

  /** Locks one of the agent's offers and checks it is still open for the step. */
  private async locked(manager: EntityManager, agentId: number, id: number, statuses: readonly DealOfferStatus[], input: unknown) {
    const revision = revisionOf(input);
    const row = await manager.findOne(DealOfferEntity, {
      where: { id, created_by_user_id: agentId }, lock: { mode: "pessimistic_write" },
    });
    if (!row) throw new NotFoundException("ไม่พบข้อเสนอ");
    if (!statuses.includes(row.status))
      throw new ConflictException({
        code: "OFFER_LOCKED",
        message: row.status === "confirmed"
          ? "ข้อเสนอที่ผู้ให้เช่ายืนยันแล้ว ต้องแก้ผ่าน \"แก้ข้อเสนอ\" พร้อมเหตุผล"
          : statuses.includes("confirmed") ? "ข้อเสนอนี้ยังไม่ได้รับการยืนยัน หรือปิดแล้ว" : "ข้อเสนอนี้ปิดแล้ว",
      });
    assertRevision(row, revision);
    return row;
  }

  /** Before confirmation only. An offer already sent stays with the landlord, who confirms the latest terms. */
  async update(agentId: number, id: number, input: unknown): Promise<DealOffer> {
    const terms = validateDealOfferTerms(input, ["revision"]);
    const row = await this.db.transaction(async (manager) => {
      const row = await this.locked(manager, agentId, id, ["draft", "awaiting_landlord"], input);
      await assertStartAfterRoomLease(manager, row.rent_room_id, row.lead_id, terms.start_date);
      await manager.update(DealOfferEntity, { id }, { ...terms, revision: row.revision + 1 });
      return manager.findOneByOrFail(DealOfferEntity, { id });
    });
    return this.view(row);
  }

  /**
   * D2 round 2 (AC-2.4, Aof 26 Oct 2026): the agent changes a confirmed offer the landlord agreed to change, with a
   * reason and how the landlord agreed. The landlord does not confirm again. The deal's documents nobody has signed
   * take the new terms (offer-drafts.ts); refused while the lease has a signature or a letter is partly signed.
   */
  async revise(agentId: number, id: number, input: unknown): Promise<DealOffer> {
    const terms = validateDealOfferTerms(input, ["revision", "reason", "agreedVia"]);
    const b = input as Record<string, unknown>;
    const reason = typeof b.reason === "string" ? b.reason.trim() : "";
    if (!reason || reason.length > 500) throw new BadRequestException("กรุณาระบุเหตุผลที่แก้ข้อเสนอ (ไม่เกิน 500 ตัวอักษร)");
    if (!CONFIRMATION_METHODS.includes(b.agreedVia as DealOfferConfirmationMethod))
      throw new BadRequestException("กรุณาเลือกช่องทางที่ผู้ให้เช่าตกลง");
    const files: DraftFiles = { uploaded: [], replaced: [] };
    let row: DealOfferEntity;
    try {
      row = await this.db.transaction(async (manager) => {
        // The lead is locked first, as booking and saving a draft do, so a draft saved meanwhile sees this change.
        const offer = await manager.findOne(DealOfferEntity, { where: { id, created_by_user_id: agentId } });
        if (offer) await manager.findOne(LeadEntity, { where: { id: offer.lead_id }, lock: { mode: "pessimistic_write" } });
        const row = await this.locked(manager, agentId, id, ["confirmed"], input);
        const before = offerTerms(row);
        const after = offerTerms({ ...row, ...terms });
        if (JSON.stringify(before) === JSON.stringify(after))
          throw new BadRequestException({ code: "OFFER_UNCHANGED", message: "ข้อเสนอไม่ได้เปลี่ยน" });
        await assertStartAfterRoomLease(manager, row.rent_room_id, row.lead_id, terms.start_date);
        const revision = row.revision + 1;
        await refreshDealDrafts(manager, this.documents, agentId, { ...row, ...terms }, files);
        await manager.update(DealOfferEntity, { id }, { ...terms, revision });
        await manager.save(DealOfferRevisionEntity, manager.create(DealOfferRevisionEntity, {
          deal_offer_id: id, revision, reason, agreed_via: b.agreedVia as DealOfferConfirmationMethod,
          before_terms: before, after_terms: after, created_by_user_id: agentId,
        }));
        return manager.findOneByOrFail(DealOfferEntity, { id });
      });
    } catch (error) {
      for (const path of files.uploaded) await this.documents?.remove(path).catch(() => undefined);
      throw error;
    }
    // Committed: the replaced files go, and a failure from here on must not remove the new ones.
    for (const path of files.replaced) await this.documents?.remove(path).catch(() => undefined);
    return this.view(row);
  }

  async send(agentId: number, id: number, input: unknown): Promise<DealOffer> {
    const row = await this.db.transaction(async (manager) => {
      const row = await this.locked(manager, agentId, id, ["draft"], input);
      // Only a room with a landlord account can be confirmed in the app; otherwise the agent records it.
      const room = await manager.findOneBy(RentRoomEntity, { id: row.rent_room_id });
      if (room?.owner_id == null)
        throw new BadRequestException({ code: "OFFER_NO_LANDLORD_APP", message: "ผู้ให้เช่าของห้องนี้ไม่มีบัญชีในแอป กรุณาบันทึกการยืนยันแทน" });
      await manager.update(DealOfferEntity, { id }, { status: "awaiting_landlord", sent_at: new Date() });
      return manager.findOneByOrFail(DealOfferEntity, { id });
    });
    return this.view(row);
  }

  /** The agent records how the landlord confirmed (the landlord may have no account in the app). */
  async recordConfirmation(agentId: number, id: number, input: unknown): Promise<DealOffer> {
    const b = input && typeof input === "object" && !Array.isArray(input) ? (input as Record<string, unknown>) : {};
    if (Object.keys(b).some((key) => !["revision", "method", "note"].includes(key)))
      throw new BadRequestException("ข้อมูลการยืนยันมีฟิลด์ที่ไม่รองรับ");
    if (!CONFIRMATION_METHODS.includes(b.method as DealOfferConfirmationMethod))
      throw new BadRequestException("กรุณาเลือกวิธีที่ผู้ให้เช่ายืนยัน");
    const note = typeof b.note === "string" ? b.note.trim() : "";
    if (!note || note.length > 500) throw new BadRequestException("กรุณาบันทึกรายละเอียดการยืนยัน (ไม่เกิน 500 ตัวอักษร)");
    const row = await this.db.transaction(async (manager) => {
      await this.locked(manager, agentId, id, ["draft", "awaiting_landlord"], input);
      await manager.update(DealOfferEntity, { id }, {
        status: "confirmed", confirmed_at: new Date(), confirmed_by_user_id: agentId,
        confirmation_channel: "agent_recorded", confirmation_method: b.method as DealOfferConfirmationMethod,
        confirmation_note: note,
      });
      return manager.findOneByOrFail(DealOfferEntity, { id });
    });
    return this.view(row);
  }

  /** Before the room is booked on it; a booked deal is closed through its contracts, not here. */
  async cancel(agentId: number, id: number, input: unknown): Promise<DealOffer> {
    const row = await this.db.transaction(async (manager) => {
      const row = await this.locked(manager, agentId, id, OPEN_OFFER_STATUSES, input);
      const lead = await manager.findOneBy(LeadEntity, { id: row.lead_id });
      if (lead?.status === "booked" && lead.rent_room_id === row.rent_room_id && !lead.booking_released_at)
        throw new ConflictException({ code: "OFFER_BOOKED", message: "จองห้องตามข้อเสนอนี้แล้ว ยกเลิกข้อเสนอไม่ได้" });
      await manager.update(DealOfferEntity, { id }, { status: "cancelled", closed_at: new Date() });
      return manager.findOneByOrFail(DealOfferEntity, { id });
    });
    return this.view(row);
  }

  /** The landlord's offers to confirm, and the ones already confirmed, for rooms the landlord owns. */
  async listForLandlord(userId: number): Promise<DealOffer[]> {
    const rooms = await this.db.getRepository(RentRoomEntity).find({ where: { owner_id: userId } });
    if (!rooms.length) return [];
    const rows = await this.db.getRepository(DealOfferEntity).find({
      where: { rent_room_id: In(rooms.map((room) => room.id)), status: In(["awaiting_landlord", "confirmed"]) },
      order: { id: "DESC" },
    });
    return Promise.all(rows.map(async (row) => landlordDealOffer(await this.view(row))));
  }

  async confirmAsLandlord(userId: number, id: number, input: unknown): Promise<DealOffer> {
    const b = input && typeof input === "object" && !Array.isArray(input) ? (input as Record<string, unknown>) : {};
    if (Object.keys(b).some((key) => key !== "revision")) throw new BadRequestException("ข้อมูลการยืนยันมีฟิลด์ที่ไม่รองรับ");
    const revision = revisionOf(input);
    const row = await this.db.transaction(async (manager) => {
      const row = await manager.findOne(DealOfferEntity, { where: { id }, lock: { mode: "pessimistic_write" } });
      const room = row ? await manager.findOneBy(RentRoomEntity, { id: row.rent_room_id }) : null;
      // Someone else's offer reads as missing, so its existence does not leak.
      if (!row || room?.owner_id !== userId) throw new NotFoundException("ไม่พบข้อเสนอ");
      if (row.status !== "awaiting_landlord")
        throw new ConflictException({
          code: "OFFER_LOCKED",
          message: row.status === "confirmed" ? "ยืนยันข้อเสนอนี้แล้ว" : "ข้อเสนอนี้ยังไม่ได้ส่งให้ยืนยัน หรือปิดแล้ว",
        });
      assertRevision(row, revision);
      await manager.update(DealOfferEntity, { id }, {
        status: "confirmed", confirmed_at: new Date(), confirmed_by_user_id: userId, confirmation_channel: "app",
      });
      return manager.findOneByOrFail(DealOfferEntity, { id });
    });
    return landlordDealOffer(await this.view(row));
  }
}

/**
 * AC-3.1: booking the room closes the other leads' open offers for it (room taken). The lead's own open offers on
 * other rooms close too (cancelled), so no landlord keeps a room for a lead who booked elsewhere.
 */
export async function closeOffersOfBookedRoom(manager: EntityManager, roomId: number, leadId: number, at: Date) {
  // Locked in id order first, so two bookings at once (lead 1 on room A, lead 2 on room B, each with an offer on the
  // other's room) wait for each other instead of deadlocking between the 2 updates.
  await manager.find(DealOfferEntity, {
    where: [
      { rent_room_id: roomId, lead_id: Not(leadId), status: In([...OPEN_OFFER_STATUSES]) },
      { lead_id: leadId, rent_room_id: Not(roomId), status: In([...OPEN_OFFER_STATUSES]) },
    ],
    order: { id: "ASC" },
    lock: { mode: "pessimistic_write" },
  });
  await manager.update(DealOfferEntity,
    { rent_room_id: roomId, lead_id: Not(leadId), status: In([...OPEN_OFFER_STATUSES]) },
    { status: "room_taken", closed_at: at });
  await manager.update(DealOfferEntity,
    { lead_id: leadId, rent_room_id: Not(roomId), status: In([...OPEN_OFFER_STATUSES]) },
    { status: "cancelled", closed_at: at });
}
