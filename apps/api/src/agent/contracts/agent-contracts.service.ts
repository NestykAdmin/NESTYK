import type { ContractParty, HandoverBlockedReason } from "@nestyk/types";
import { validateSignaturePng } from './signature-image';
import {
  financialKind, validateFinancialDocument, buildReceiptFromInvoice, financialTotals, receiptReceiver, receiverLine,
  withholdingTaxOf, POWER_OF_ATTORNEY_REQUIRED, POWER_OF_ATTORNEY_MESSAGE,
} from "./financial-document";
import { createFinancialPdf } from "./financial-pdf";
import { reservationInvoice } from "./reservation-invoice";
import { depositInvoice, depositInvoiceNo, depositReceiptNo, leaseDepositAmount } from "./deposit-invoice";
import { tenantDraftPatch } from "../tenants/tenant-draft-sync";
import { validateCommissionConfirmation } from "./commission-confirmation";
import { createCommissionConfirmationPdf, stampCommissionSignatures } from "./commission-confirmation-pdf";
import { reservationCommission, reservationCommissionInput } from "./reservation-commission";
import {
  AgreementAttachmentsService,
  reservationLetterFinalized,
} from "./agreement-attachments.service";
import { PropertyEntity } from "../../entities/property.entity";
import { AgreementTemplateEntity } from "../../entities/agreement-template.entity";
import { PropertyOwnerEntity } from "../../entities/property-owner.entity";
import { UserEntity } from "../../entities/user.entity";
import { validateAgreementData } from "./agreement-data";
import { MasterAgreementTypeEntity } from "../../entities/master-agreement-type.entity";
import { MasterContractEndReasonEntity } from "../../entities/master-contract-end-reason.entity";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  Optional,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { randomBytes } from "crypto";
import { DataSource, EntityManager, In, IsNull, Raw } from "typeorm";
import type { QueryDeepPartialEntity } from "typeorm/query-builder/QueryPartialEntity";
import {
  MOCK_RESERVATION_VERSION,
  createReservationMock,
  stampReservationSignatures,
} from "./reservation-pdf";
import {
  BROKER_APPOINTMENT_VERSION,
  createBrokerAppointmentPdf,
  stampBrokerAppointmentSignatures,
} from "./broker-appointment-pdf";
import {
  LEASE_AGREEMENT_VERSION,
  createLeaseAgreementPdf,
  stampLeaseAgreementSignatures,
} from "./lease-agreement-pdf";
import {
  LEASE_RENEWAL_VERSION,
  createLeaseRenewalPdf,
  stampLeaseRenewalSignatures,
} from "./lease-renewal-pdf";
import {
  validateBrokerAppointment,
  brokerAppointmentSnapshot,
  pickBrokerRentFromRoom,
} from "./broker-appointment";
import {
  validateLeaseAgreement,
  leaseAgreementSnapshot,
  emptyLeaseAgreement,
  pickLeaseRentFromRoom,
} from "./lease-agreement";
import {
  validateLeaseRenewal,
  leaseRenewalSnapshot,
  firstLeaseFields,
  RENEWAL_ADVANCE_DAYS,
} from "./lease-renewal";
import { asIsoDate, isIsoDate, leaseTermEnd, shiftIsoDate } from "./lease-term";
import { validateReservationLetter, emptyReservationLetter, stampReservationDocumentHeader, bangkokDate, reservationTenantFields } from "./reservation-letter";
import { ensurePartyLogin } from "./party-login";
import { CO_BROKE_REQUIRED, confirmedOffer, hasCoBrokeFile, offerLeaseFields, offerReservationFields } from "./deal-offers.service";
import { hasSignature, refreshReservationDraft, type DraftFiles } from "./offer-drafts";
import { upcomingRentPeriod } from "../../billing/tenant-billing.service";
import { closeLeaseContract, contractEndReasons } from "./contract-closure";
import { bangkokToday } from "../../billing/rent-schedule";
import { handoverDueDate } from "../reminders/contract-reminders";
import { cancelDeal, dealCancellationPreview, recordDealRefund, serializeDealCancellation } from "./deal-cancellation";
import { DealCancellationEntity } from "../../entities/deal-cancellation.entity";
import type {
  AgentContract,
  AgentContractDocumentKind,
  AgentContractSignParty,
  AgreementSignatureLogEntry,
  BrokerAppointmentInput,
  CreateAgentContract,
  CommissionConfirmation,
  CommissionConfirmationInput,
  DepositPayment,
  FinancialDocumentInput,
  LeaseAgreementInput,
  LeaseRenewalInput,
  ReservationLetterInput,
  StandaloneInvoice,
} from "@nestyk/types";
import { AgreementSignInviteEntity } from "../../entities/agreement-sign-invite.entity";
import { AgreementSignatureEntity } from "../../entities/agreement-signature.entity";
import { LeaseContractEntity } from "../../entities/lease-contract.entity";
import { AgreementDocumentEntity } from "../../entities/agreement-document.entity";
import { AgentInvoiceEntity } from "../../entities/agent-invoice.entity";
import { AgentCommissionConfirmationEntity } from "../../entities/agent-commission-confirmation.entity";
import { LeadEntity } from "../../entities/lead.entity";
import { TenantEntity } from "../../entities/tenant.entity";
import { RentRoomEntity } from "../../entities/rent-room.entity";
import { RentRoomContactEntity } from "../../entities/rent-room-contact.entity";
import { RoomTenancyEntity } from "../../entities/room-tenancy.entity";
import {
  CONTRACT_DOCUMENT_KINDS,
  ContractDocumentStorageService,
} from "./contract-document-storage.service";

export const WITNESS_SIGNATURE_REQUIRED = "ต้องให้พยานลงนามในสัญญาเช่าก่อน จึงจะสร้างเอกสารได้ (นายหน้าเป็นพยานได้)";
export const brokerAppointmentKey = (roomId: number, tenantId: number) => `${roomId}:${tenantId}`;
export const BROKER_APPOINTMENT_REQUIRED =
  "ยังไม่มีสัญญาแต่งตั้งนายหน้าที่มีผลสำหรับห้องและผู้เช่านี้ (สัญญาแต่งตั้งมีอายุ 1 ปี) ให้ผู้ให้เช่าและนายหน้าลงนามในสัญญาแต่งตั้งนายหน้าและออกเอกสารก่อน จึงจะทำหนังสือจองต่อได้";
const SHAREABLE_SIGN_PARTIES = ["owner", "tenant"] as const;

const DOCUMENT_COLUMNS: Record<
  AgentContractDocumentKind,
  "document_url" | "invoice_url" | "receipt_url"
> = {
  reservation_letter: "document_url",
  lease_agreement: "document_url",
  broker_appointment: "document_url",
  invoice: "invoice_url",
  receipt: "receipt_url",
};
export const CONTRACT_SIGN_PARTIES = [
  "owner",
  "tenant",
  "agent",
] as const satisfies readonly AgentContractSignParty[];
const SIGN_COLUMNS: Record<
  AgentContractSignParty,
  {
    at: "owner_signed_at" | "tenant_signed_at" | "agent_signed_at";
    url: "owner_signature_url" | "tenant_signature_url" | "agent_signature_url";
  }
> = {
  owner: { at: "owner_signed_at", url: "owner_signature_url" },
  tenant: { at: "tenant_signed_at", url: "tenant_signature_url" },
  agent: { at: "agent_signed_at", url: "agent_signature_url" },
};
// Nothing is signed any more: closed, in force, or (D7) a generated lease waiting for its deposit or handover.
const CLOSED_STATUSES = [
  "cancelled",
  "expired",
  "terminated",
  "active",
  "awaiting_deposit",
  "awaiting_handover",
] as const;
const MAX_SIGNATURE_BYTES = 2 * 1024 * 1024;
const CONTRACT_NO_PATTERN = /^(RS|LS|BA|RN)(\d{4})(\d{5})$/;

export function contractNoPrefix(
  formKind: "reservation" | "lease" | "broker_appointment" | "renewal",
) {
  if (formKind === "reservation") return "RS";
  if (formKind === "broker_appointment") return "BA";
  if (formKind === "renewal") return "RN";
  return "LS";
}

export function contractYear(date = new Date()) {
  return Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Bangkok",
      year: "numeric",
    }).format(date),
  );
}

const INVOICE_NO_PATTERN = /^INV(\d{4})(\d{5})$/;

export function formatInvoiceNo(year: number, seq: number) {
  if (!Number.isInteger(seq) || seq < 1 || seq > 99999)
    throw new ConflictException("เลขที่ใบแจ้งหนี้เต็มสำหรับปีนี้แล้ว");
  return `INV${year}${String(seq).padStart(5, "0")}`;
}

/**
 * D11: the slip the agent looked at (its submittedAt) must still be the tenant's latest one: a slip sent meanwhile is
 * not returned (or removed) with a reason written for the earlier one.
 */
export const SLIP_CHANGED = "SLIP_CHANGED";
function assertSameSlip(input: unknown, current: string | null | undefined) {
  const seen = input && typeof input === "object" && !Array.isArray(input) ? (input as { submittedAt?: unknown }).submittedAt : undefined;
  if (typeof seen !== "string" || !current || seen !== current)
    throw new ConflictException({ code: SLIP_CHANGED, message: "ผู้เช่าส่งสลิปใหม่แล้ว กรุณาเปิดดูสลิปล่าสุดก่อนตีกลับ" });
}
/** D11: the reason the agent gives when returning a slip (the same rule as rent bills: required, up to 500 characters). */
export function slipReturnReason(input: unknown) {
  const raw = input && typeof input === "object" && !Array.isArray(input) ? (input as { reason?: unknown }).reason : undefined;
  const reason = typeof raw === "string" ? raw.trim() : "";
  if (!reason || reason.length > 500) throw new BadRequestException("กรุณาระบุเหตุผลในการตีกลับ (ไม่เกิน 500 ตัวอักษร)");
  return reason;
}
export async function nextInvoiceNo(manager: EntityManager, at = new Date()) {
  const year = contractYear(at);
  await manager.query("SELECT pg_advisory_xact_lock($1)", [900_000_000 + year]);
  const rows = (await manager.query(
    `SELECT document_no FROM agent_invoices
     WHERE document_no LIKE $1
     ORDER BY document_no DESC
     LIMIT 1`,
    [`INV${year}%`],
  )) as Array<{ document_no: string }>;
  const match = rows[0]?.document_no?.match(INVOICE_NO_PATTERN);
  const lastSeq = match && Number(match[1]) === year ? Number(match[2]) : 0;
  return formatInvoiceNo(year, lastSeq + 1);
}

const RECEIPT_NO_PATTERN = /^REC(\d{4})(\d{5})$/;

export function formatReceiptNo(year: number, seq: number) {
  if (!Number.isInteger(seq) || seq < 1 || seq > 99999)
    throw new ConflictException("เลขที่ใบเสร็จเต็มสำหรับปีนี้แล้ว");
  return `REC${year}${String(seq).padStart(5, "0")}`;
}

const INVOICE_ISSUER_NAME = "NESTYK";
const INVOICE_ISSUER_ADDRESS = "Bangkok";

function tenantMailingAddress(tenant: TenantEntity) {
  const property = tenant.lead?.rent_room?.property;
  if (!property) return "";
  return [
    property.address,
    property.subdistrict,
    property.district,
    property.province,
    property.postal_code,
  ]
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter((part) => part && part !== "-")
    .join(", ")
    .slice(0, 240);
}

export async function invoicePayer(
  manager: EntityManager,
  agentId: number,
  tenantId: unknown,
) {
  if (tenantId == null || tenantId === "") return null;
  const id = Number(tenantId);
  if (!Number.isSafeInteger(id) || id < 1 || id > 2147483647)
    throw new BadRequestException("ไม่พบผู้เช่า");
  const tenant = await manager.findOne(TenantEntity, {
    where: { id, created_by_user_id: agentId },
    relations: { lead: { rent_room: { property: true } } },
  });
  if (!tenant) throw new NotFoundException("ไม่พบผู้เช่า");
  const address = tenantMailingAddress(tenant);
  if (!address)
    throw new BadRequestException("ผู้เช่ายังไม่มีที่อยู่ จึงสร้างใบแจ้งหนี้ไม่ได้");
  const firstName = tenant.first_name?.trim() || tenant.name.trim().split(/\s+/)[0] || "";
  const lastName =
    tenant.last_name?.trim() || tenant.name.trim().split(/\s+/).slice(1).join(" ");
  const name = [firstName, lastName].filter(Boolean).join(" ") || tenant.name.trim();
  return { id: tenant.id, name, firstName, lastName, address };
}

export async function nextReceiptNo(manager: EntityManager, at = new Date()) {
  const year = contractYear(at);
  await manager.query("SELECT pg_advisory_xact_lock($1)", [910_000_000 + year]);
  const rows = (await manager.query(
    `SELECT receipt_document_no FROM agent_invoices
     WHERE receipt_document_no LIKE $1
     ORDER BY receipt_document_no DESC
     LIMIT 1`,
    [`REC${year}%`],
  )) as Array<{ receipt_document_no: string }>;
  const match = rows[0]?.receipt_document_no?.match(RECEIPT_NO_PATTERN);
  const lastSeq = match && Number(match[1]) === year ? Number(match[2]) : 0;
  return formatReceiptNo(year, lastSeq + 1);
}

const COMMISSION_NO_PATTERN = /^CCM(\d{4})(\d{5})$/;

export function formatCommissionNo(year: number, seq: number) {
  if (!Number.isInteger(seq) || seq < 1 || seq > 99999)
    throw new ConflictException("เลขที่หนังสือยืนยันค่าคอมมิชชั่นเต็มสำหรับปีนี้แล้ว");
  return `CCM${year}${String(seq).padStart(5, "0")}`;
}

export async function nextCommissionNo(manager: EntityManager, at = new Date()) {
  const year = contractYear(at);
  await manager.query("SELECT pg_advisory_xact_lock($1)", [920_000_000 + year]);
  const rows = (await manager.query(
    `SELECT document_no FROM agent_commission_confirmations
     WHERE document_no LIKE $1
     ORDER BY document_no DESC
     LIMIT 1`,
    [`CCM${year}%`],
  )) as Array<{ document_no: string }>;
  const match = rows[0]?.document_no?.match(COMMISSION_NO_PATTERN);
  const lastSeq = match && Number(match[1]) === year ? Number(match[2]) : 0;
  return formatCommissionNo(year, lastSeq + 1);
}

export function formatContractNo(
  prefix: "RS" | "LS" | "BA" | "RN",
  year: number,
  seq: number,
) {
  if (!Number.isInteger(seq) || seq < 1 || seq > 99999)
    throw new ConflictException("เลขที่สัญญาเต็มสำหรับปีนี้แล้ว");
  return `${prefix}${year}${String(seq).padStart(5, "0")}`;
}

export function parseContractSeq(contractNo: string | null | undefined) {
  const match = contractNo?.match(CONTRACT_NO_PATTERN);
  return match ? Number(match[3]) : null;
}

export async function nextContractNo(
  manager: EntityManager,
  formKind: "reservation" | "lease" | "broker_appointment" | "renewal",
  at = new Date(),
) {
  const prefix = contractNoPrefix(formKind);
  const year = contractYear(at);
  const lockKey =
    (prefix === "RS"
      ? 700_000_000
      : prefix === "BA"
        ? 750_000_000
        : prefix === "RN"
          ? 850_000_000
          : 800_000_000) + year;
  await manager.query("SELECT pg_advisory_xact_lock($1)", [lockKey]);
  const rows = (await manager.query(
    `SELECT contract_no FROM lease_contracts
     WHERE contract_no LIKE $1
     ORDER BY contract_no DESC
     LIMIT 1`,
    [`${prefix}${year}%`],
  )) as Array<{ contract_no: string }>;
  const lastSeq = parseContractSeq(rows[0]?.contract_no) ?? 0;
  return formatContractNo(prefix, year, lastSeq + 1);
}

export async function validateSign(input: unknown): Promise<{
  parties: AgentContractSignParty[];
  png: Buffer;
}> {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new BadRequestException("กรุณาระบุข้อมูลลายเซ็น");
  const b = input as Record<string, unknown>;
  if (!Array.isArray(b.parties) || !b.parties.length)
    throw new BadRequestException("กรุณาเลือกฝ่ายที่ต้องการลงนาม");
  if (
    b.parties.some(
      (party) =>
        !CONTRACT_SIGN_PARTIES.includes(party as AgentContractSignParty),
    )
  )
    throw new BadRequestException("ฝ่ายที่ลงนามไม่ถูกต้อง");
  const parties = [...new Set(b.parties as AgentContractSignParty[])];
  if (typeof b.signaturePng !== "string" || !b.signaturePng.trim())
    throw new BadRequestException("กรุณาวาดลายเซ็นก่อนยืนยัน");
  const raw = b.signaturePng.replace(/^data:image\/png;base64,/i, "");
  let png: Buffer;
  try {
    png = Buffer.from(raw, "base64");
  } catch {
    throw new BadRequestException("ลายเซ็นไม่ถูกต้อง");
  }
  if (
    png.length < 32 ||
    png.length > MAX_SIGNATURE_BYTES ||
    png.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a"
  )
    throw new BadRequestException("ลายเซ็นต้องเป็นไฟล์ PNG");
  return { parties, png: await validateSignaturePng(png) };
}

export function validateContract(
  input: unknown,
  formKind: "reservation" | "lease" | "broker_appointment" | "renewal" = "lease",
): CreateAgentContract {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new BadRequestException("กรุณาระบุข้อมูลสัญญา");
  const b = input as Record<string, unknown>;
  if (
    !Number.isSafeInteger(b.leadId) ||
    Number(b.leadId) < 1 ||
    Number(b.leadId) > 2147483647
  )
    throw new BadRequestException("กรุณาเลือกผู้เช่า");
  const dated = formKind === "lease" || formKind === "renewal";
  const dateKey =
    formKind === "reservation" ? "moveInDate" : dated ? "endDate" : null;
  for (const key of ["startDate", ...(dateKey ? [dateKey] : [])]) {
    const value = b[key];
    if (!isIsoDate(value))
      throw new BadRequestException("วันที่ต้องเป็น ค.ศ. ในรูปแบบ YYYY-MM-DD");
  }
  if (formKind === "reservation" && String(b.moveInDate) < String(b.startDate))
    throw new BadRequestException("วันที่เข้าอยู่ต้องไม่ก่อนวันที่จอง");
  if (dated && String(b.endDate) <= String(b.startDate))
    throw new BadRequestException("วันสิ้นสุดต้องอยู่หลังวันเริ่มสัญญา");
  if (formKind !== "broker_appointment") {
    for (const key of formKind === "reservation"
      ? ["reservationFee"]
      : ["monthlyRent", "deposit"]) {
      const v = b[key];
      if (
        typeof v !== "number" ||
        !Number.isFinite(v) ||
        v < 0 ||
        (key === "monthlyRent" && v === 0) ||
        v > 9999999999.99 ||
        Math.abs(v * 100 - Math.round(v * 100)) > 0.001
      )
        throw new BadRequestException(
          "จำนวนเงินต้องถูกต้อง ทศนิยมไม่เกิน 2 ตำแหน่ง",
        );
    }
  }
  if (b.notes != null && (typeof b.notes !== "string" || b.notes.length > 5000))
    throw new BadRequestException("หมายเหตุต้องไม่เกิน 5,000 ตัวอักษร");
  return {
    leadId: Number(b.leadId),
    startDate: String(b.startDate),
    ...(formKind === "reservation"
      ? { moveInDate: String(b.moveInDate) }
      : dated
        ? { endDate: String(b.endDate) }
        : {}),
    ...(formKind === "reservation"
      ? { reservationFee: Number(b.reservationFee) }
      : dated
        ? { monthlyRent: Number(b.monthlyRent), deposit: Number(b.deposit) }
        : {}),
    ...(b.agreementTypeCode
      ? { agreementTypeCode: String(b.agreementTypeCode) }
      : {}),
    notes: typeof b.notes === "string" ? b.notes.trim() : undefined,
  };
}

/** D10: a lease row with its deposit invoice attached by signedFor (undefined = not loaded). */
type WithDepositInvoice = LeaseContractEntity & { depositInvoice?: AgentInvoiceEntity | null };
/** D5: a cancelled row with the deal cancellation that closed it, attached by signedFor (undefined = not loaded). */
type WithCancellation = LeaseContractEntity & { dealCancellation?: DealCancellationEntity | null };

@Injectable()
export class AgentContractsService {
  private readonly logger = new Logger(AgentContractsService.name);
  constructor(
    private readonly db: DataSource,
    private readonly documents?: ContractDocumentStorageService,
    @Optional() private readonly attachments?: AgreementAttachmentsService,
  ) {}
  private query(agentId: number) {
    return this.db
      .getRepository(LeaseContractEntity)
      .createQueryBuilder("c")
      .leftJoinAndSelect("c.rent_room", "room")
      .leftJoinAndSelect("room.property", "property")
      .leftJoinAndSelect("c.agreement_type", "agreementType")
      .leftJoinAndSelect("c.template", "template")
      .leftJoinAndSelect("c.tenant", "tenant")
      .where("c.created_by_user_id = :agentId", { agentId });
  }
  /**
   * D1 (AC-3.2): which room + tenant pairs of this agent have a valid broker appointment: generated
   * (status active), for that room and that tenant, and less than 1 year old (dated by start_date).
   * A reservation letter can only start, be signed or be generated for such a pair. Keys are
   * `${roomId}:${tenantId}` (see brokerAppointmentKey).
   */
  async activeBrokerAppointments(
    agentId: number,
    filter: { roomIds?: number[]; tenantIds?: number[] } = {},
    manager?: EntityManager,
  ): Promise<Set<string>> {
    if ((filter.roomIds && !filter.roomIds.length) || (filter.tenantIds && !filter.tenantIds.length)) return new Set();
    let query = (manager ?? this.db)
      .getRepository(LeaseContractEntity)
      .createQueryBuilder("c")
      .leftJoin("c.agreement_type", "agreementType")
      .leftJoin("c.template", "template")
      // distinct(true), not "DISTINCT ..." inside select(): TypeORM puts addSelect columns first, which breaks the SQL.
      .select("c.rent_room_id", "roomId")
      .addSelect("c.tenant_id", "tenantId")
      .distinct(true)
      .where("c.created_by_user_id = :agentId", { agentId })
      .andWhere("c.status = 'active'")
      .andWhere("COALESCE(template.form_kind, agreementType.form_kind) = 'broker_appointment'")
      .andWhere("c.start_date + INTERVAL '1 year' > CAST(:today AS date)", { today: bangkokDate() });
    if (filter.roomIds) query = query.andWhere("c.rent_room_id IN (:...roomIds)", { roomIds: filter.roomIds });
    if (filter.tenantIds) query = query.andWhere("c.tenant_id IN (:...tenantIds)", { tenantIds: filter.tenantIds });
    const rows: Array<{ roomId: number | string; tenantId: number | string }> = await query.getRawMany();
    return new Set(rows.map((row) => brokerAppointmentKey(Number(row.roomId), Number(row.tenantId))));
  }

  private async hasBrokerAppointment(agentId: number, roomId: number, tenantId: number, manager?: EntityManager) {
    const found = await this.activeBrokerAppointments(agentId, { roomIds: [roomId], tenantIds: [tenantId] }, manager);
    return found.has(brokerAppointmentKey(roomId, tenantId));
  }

  /**
   * D1 locked on: a reservation that is not generated yet cannot be signed, sent or generated once its appointment lapses.
   * Checked before the write, not inside it: an appointment closed in between is not caught (only the agent can close it).
   */
  private async assertReservationAppointment(c: LeaseContractEntity) {
    if ((c.template?.form_kind ?? c.agreement_type?.form_kind) !== "reservation") return;
    if (!(await this.hasBrokerAppointment(c.created_by_user_id, c.rent_room_id, c.tenant_id)))
      throw new BadRequestException({ code: "BROKER_APPOINTMENT_REQUIRED", message: BROKER_APPOINTMENT_REQUIRED });
  }

  /** D17: log signatures in the same transaction as the signature columns (still written until the cleanup migration). */
  private async recordSignatures(manager: EntityManager, rows: QueryDeepPartialEntity<AgreementSignatureEntity>[]) {
    if (rows.length) await manager.insert(AgreementSignatureEntity, rows);
  }

  /** D17: the live signatures of one of this agent's contracts, oldest first, with who pressed sign. */
  async signatureLog(agentId: number, id: number): Promise<AgreementSignatureLogEntry[]> {
    const c = await this.query(agentId).andWhere("c.id = :id", { id }).getOne();
    if (!c) throw new NotFoundException("ไม่พบสัญญา");
    const rows = await this.db.getRepository(AgreementSignatureEntity).find({
      // D6: the signatures of a handover record are not signatures of the lease.
      where: { agreement_id: c.id, voided_at: IsNull(), handover_record_id: IsNull() },
      relations: { signed_by: true },
      order: { signed_at: "ASC", id: "ASC" },
    });
    return rows.map((row) => ({
      party: row.party,
      channel: row.channel,
      signedAt: row.signed_at.toISOString(),
      // A witness without an account is named by the agent who pressed sign for them.
      signedBy:
        row.signer_name?.trim() ||
        [row.signed_by?.first_name, row.signed_by?.last_name].filter((part) => part?.trim()).join(" ").trim() ||
        null,
    }));
  }

  private async liveWitness(agreementId: number, manager?: EntityManager) {
    return (manager ?? this.db).getRepository(AgreementSignatureEntity).findOne({
      // No handover filter needed: a handover record cannot have a witness (chk_agreement_signatures_handover).
      where: { agreement_id: agreementId, party: "witness", voided_at: IsNull() },
      relations: { signed_by: true },
    });
  }

  /**
   * D9 (AC-4.4): the witness of a lease signs before the lease document is generated. The agent can be
   * the witness (asAgent, logged as app), or someone without an account signs on the agent's device and the
   * agent types their name (logged as on_site, pressed by the agent).
   */
  async witnessSign(agentId: number, id: number, input: unknown) {
    const b = input && typeof input === "object" && !Array.isArray(input) ? (input as Record<string, unknown>) : {};
    const asAgent = b.asAgent === true;
    const signerName = typeof b.signerName === "string" ? b.signerName.trim() : "";
    if (!asAgent && !signerName) throw new BadRequestException("กรุณาระบุชื่อพยาน");
    if (signerName.length > 255) throw new BadRequestException("ชื่อพยานยาวเกินไป");
    const { png } = await validateSign({ parties: ["agent"], signaturePng: b.signaturePng });
    const c = await this.query(agentId).andWhere("c.id = :id", { id }).getOne();
    if (!c) throw new NotFoundException("ไม่พบสัญญา");
    if ((c.template?.form_kind ?? c.agreement_type?.form_kind) !== "lease")
      throw new BadRequestException("พยานลงนามได้เฉพาะสัญญาเช่า");
    this.assertDocumentMutable(c);
    // CLOSED_STATUSES already has active and the D7 statuses after generation.
    if (CLOSED_STATUSES.includes(c.status as (typeof CLOSED_STATUSES)[number]))
      throw new BadRequestException("สัญญานี้ไม่สามารถลงนามได้");
    if (await this.liveWitness(c.id)) throw new BadRequestException("พยานลงนามแล้ว");
    if (!this.documents)
      throw new ServiceUnavailableException("ยังไม่ได้ตั้งค่าที่เก็บเอกสารสัญญา");
    const stored = await this.documents.uploadSignature(agentId, c.id, { buffer: png, size: png.length });
    try {
      await this.db.transaction(async (manager) => {
        const current = await manager.findOne(LeaseContractEntity, {
          where: { id: c.id, created_by_user_id: agentId },
          lock: { mode: "pessimistic_write" },
        });
        if (!current || current.status !== c.status || current.document_url !== c.document_url ||
            JSON.stringify(current.data) !== JSON.stringify(c.data))
          throw new ConflictException("สัญญาถูกเปลี่ยนแล้ว กรุณาเปิดใหม่ก่อนลงนาม");
        await this.recordSignatures(manager, [{
          agreement_id: c.id, party: "witness", channel: asAgent ? "app" : "on_site",
          signed_by_user_id: agentId, signer_name: asAgent ? null : signerName,
          signature_url: stored.path, signed_at: new Date(),
        }]);
      });
    } catch (error) {
      await this.documents.remove(stored.path).catch(() => undefined);
      if ((error as { code?: string }).code === "23505") throw new BadRequestException("พยานลงนามแล้ว");
      throw error;
    }
    return this.view(agentId, c.id);
  }

  /** D6: one of this agent's contracts with its template, or 404. */
  async contractForAgent(agentId: number, id: number) {
    const c = await this.query(agentId).andWhere("c.id = :id", { id }).getOne();
    if (!c) throw new NotFoundException("ไม่พบสัญญา");
    return c;
  }

  /**
   * D6 (AC-6.1): the room is handed over after the lease document is generated and, when the lease has a deposit,
   * after the deposit receipt is issued. Returns why the handover cannot be filled in yet, or null.
   */
  async handoverBlockedReason(c: LeaseContractEntity, manager?: EntityManager): Promise<HandoverBlockedReason | null> {
    if ((c.template?.form_kind ?? c.agreement_type?.form_kind) !== "lease") return "not_lease";
    if (["cancelled", "expired", "terminated"].includes(c.status)) return "contract_ended";
    if (this.leaseDocument(c)?.status !== "ready") return "lease_not_issued";
    // D7: the lease status says the deposit is still due, even if a receipt row exists.
    if (c.status === "awaiting_deposit") return "deposit_unpaid";
    if (leaseDepositAmount(c) > 0) {
      const invoice = await (manager ?? this.db).getRepository(AgentInvoiceEntity).findOne({
        where: { lease_contract_id: c.id, invoice_kind: "deposit" },
      });
      if (!invoice?.receipt_pdf_path) return "deposit_unpaid";
    }
    return null;
  }

  private inboxQuery() {
    return this.db
      .getRepository(LeaseContractEntity)
      .createQueryBuilder("c")
      .leftJoinAndSelect("c.rent_room", "room")
      .leftJoinAndSelect("room.property", "property")
      .leftJoinAndSelect("c.agreement_type", "agreementType")
      .leftJoinAndSelect("c.template", "template")
      .leftJoinAndSelect("c.tenant", "tenant")
      .where("c.status <> 'cancelled'");
  }
  private partiesFor(userId: number, c: LeaseContractEntity) {
    const parties: ContractParty[] = [];
    if (c.tenant?.user_id === userId && c.tenant_delivered_at) parties.push("tenant");
    if (c.owner_user_id === userId && c.owner_delivered_at) parties.push("owner");
    return parties;
  }
  private reservationDocument(c: LeaseContractEntity) {
    if (
      (c.template?.form_kind ?? c.agreement_type?.form_kind) !== "reservation"
    )
      return null;
    const complete = CONTRACT_SIGN_PARTIES.every(
      (party) => c[SIGN_COLUMNS[party].at] && c[SIGN_COLUMNS[party].url],
    );
    const root = `${c.created_by_user_id}/${c.id}/`;
    const versionOk = (kind: "generated" | "mock") =>
      ["letter-v1", "mock-v2"].some(
        (version) =>
          c.document_url?.startsWith(
            `${root}${kind}/reservation_letter/${version}/`,
          ) && c.document_url.endsWith(".pdf"),
      );
    const generated = versionOk("generated");
    const mock = versionOk("mock");
    return {
      status: complete
        ? generated
          ? ("ready" as const)
          : ("ready_to_generate" as const)
        : ("awaiting_signatures" as const),
      path: (generated && complete) || mock ? c.document_url : null,
    };
  }
  private brokerDocument(c: LeaseContractEntity) {
    if (
      (c.template?.form_kind ?? c.agreement_type?.form_kind) !==
      "broker_appointment"
    )
      return null;
    const complete = (["owner", "agent"] as const).every(
      (party) => c[SIGN_COLUMNS[party].at] && c[SIGN_COLUMNS[party].url],
    );
    const root = `${c.created_by_user_id}/${c.id}/`;
    const versionOk = (kind: "generated" | "mock") =>
      c.document_url?.startsWith(
        `${root}${kind}/broker_appointment/${BROKER_APPOINTMENT_VERSION}/`,
      ) && c.document_url.endsWith(".pdf");
    const generated = versionOk("generated");
    const mock = versionOk("mock");
    return {
      status: complete
        ? generated
          ? ("ready" as const)
          : ("ready_to_generate" as const)
        : ("awaiting_signatures" as const),
      path: (generated && complete) || mock ? c.document_url : null,
    };
  }
  private leaseDocument(c: LeaseContractEntity) {
    if ((c.template?.form_kind ?? c.agreement_type?.form_kind) !== "lease")
      return null;
    const templateKey = c.template?.document_template_key ?? "";
    if (templateKey && templateKey !== "lease/v1") {
      return {
        status: null,
        path: c.document_url?.endsWith(".pdf") ? c.document_url : null,
      };
    }
    const complete = (["owner", "tenant"] as const).every(
      (party) => c[SIGN_COLUMNS[party].at] && c[SIGN_COLUMNS[party].url],
    );
    const root = `${c.created_by_user_id}/${c.id}/`;
    const versionOk = (kind: "generated" | "mock") =>
      c.document_url?.startsWith(
        `${root}${kind}/lease_agreement/${LEASE_AGREEMENT_VERSION}/`,
      ) && c.document_url.endsWith(".pdf");
    const generated = versionOk("generated");
    const mock = versionOk("mock");
    return {
      status: complete
        ? generated
          ? ("ready" as const)
          : ("ready_to_generate" as const)
        : ("awaiting_signatures" as const),
      path: (generated && complete) || mock ? c.document_url : null,
    };
  }
  private renewalDocument(c: LeaseContractEntity) {
    if ((c.template?.form_kind ?? c.agreement_type?.form_kind) !== "renewal")
      return null;
    const complete = (["owner", "tenant"] as const).every(
      (party) => c[SIGN_COLUMNS[party].at] && c[SIGN_COLUMNS[party].url],
    );
    const root = `${c.created_by_user_id}/${c.id}/`;
    const versionOk = (kind: "generated" | "mock") =>
      c.document_url?.startsWith(
        `${root}${kind}/lease_renewal/${LEASE_RENEWAL_VERSION}/`,
      ) && c.document_url.endsWith(".pdf");
    const generated = versionOk("generated");
    const mock = versionOk("mock");
    return {
      status: complete
        ? generated
          ? ("ready" as const)
          : ("ready_to_generate" as const)
        : ("awaiting_signatures" as const),
      path: (generated && complete) || mock ? c.document_url : null,
    };
  }
  /** After a stamped letter exists, the agreement is view-only. */
  private assertDocumentMutable(c: LeaseContractEntity) {
    this.assertNotEnded(c);
    if (
      this.reservationDocument(c)?.status === "ready" ||
      reservationLetterFinalized(c)
    )
      throw new BadRequestException("สร้างเอกสารหนังสือจองแล้ว แก้ไขไม่ได้");
    if (
      this.brokerDocument(c)?.status === "ready" ||
      !!(
        c.document_url?.includes("/generated/broker_appointment/") &&
        c.document_url.endsWith(".pdf")
      )
    )
      throw new BadRequestException(
        "สร้างเอกสารแต่งตั้งนายหน้าแล้ว แก้ไขไม่ได้",
      );
    if (
      this.leaseDocument(c)?.status === "ready" ||
      !!(
        c.document_url?.includes("/generated/lease_agreement/") &&
        c.document_url.endsWith(".pdf")
      )
    )
      throw new BadRequestException("สร้างเอกสารสัญญาเช่าแล้ว แก้ไขไม่ได้");
    if (
      this.renewalDocument(c)?.status === "ready" ||
      !!(
        c.document_url?.includes("/generated/lease_renewal/") &&
        c.document_url.endsWith(".pdf")
      )
    )
      throw new BadRequestException("สร้างหนังสือต่อสัญญาแล้ว แก้ไขไม่ได้");
  }

  private assertNotEnded(c: LeaseContractEntity) {
    if (["cancelled", "expired", "terminated"].includes(c.status))
      throw new BadRequestException("สัญญานี้สิ้นสุดแล้ว ไม่สามารถสร้างหรือแก้ไขเอกสารใหม่ได้");
  }

  private serialize(
    c: LeaseContractEntity,
    signed = new Map<string, string>(),
  ): AgentContract {
    const url = (path: string | null | undefined) =>
      (path && signed.get(path)) || null;
    const financial = c.data?.financialDocuments as Partial<Record<string, FinancialDocumentInput>> | undefined;
    const payment = c.data?.reservationPayment as { slipPath?: string; submittedAt?: string; returnNote?: string } | undefined;
    return {
      id: c.id,
      tenantId: c.tenant_id,
      leadId: c.lead_id,
      // D2 round 2: the deal's room, so the contract screen finds the deal's offer.
      rentRoomId: c.rent_room_id ?? null,
      contractNo: c.contract_no || `EC-${c.id}`,
      templateId: c.template_id ?? null,
      templateVersion: c.template?.version ?? null,
      agreementKind: c.agreement_kind ?? "new",
      previousAgreementId: c.previous_agreement_id ?? null,
      rootAgreementId: c.root_agreement_id ?? c.id,
      data: c.data ?? {},
      property:
        (c.party_snapshot?.property as string) ||
        c.rent_room?.property?.name ||
        c.rent_room?.listing_title ||
        "ไม่ระบุโครงการ",
      room: (c.party_snapshot?.room as string) || c.rent_room?.room_id || null,
      tenant:
        (c.party_snapshot?.tenantName as string) ||
        c.tenant?.name ||
        "ไม่ระบุผู้เช่า",
      agreementTypeCode: c.agreement_type_code || "lease",
      agreementTypeName:
        c.template?.name || c.agreement_type?.name_th || "สัญญาเช่า",
      formKind:
        (c.template?.form_kind ?? c.agreement_type?.form_kind) || "lease",
      reservationFee:
        c.reservation_fee == null ? null : Number(c.reservation_fee),
      status: c.status,
      startDate: c.start_date,
      endDate:
        (c.template?.form_kind ?? c.agreement_type?.form_kind) === "reservation"
          ? null
          : c.end_date,
      bookingDate:
        (c.template?.form_kind ?? c.agreement_type?.form_kind) === "reservation"
          ? c.start_date
          : null,
      moveInDate:
        (c.template?.form_kind ?? c.agreement_type?.form_kind) === "reservation"
          ? (c.move_in_date ?? null)
          : null,
      monthlyRent: c.monthly_rent == null ? null : Number(c.monthly_rent),
      deposit: c.deposit == null ? null : Number(c.deposit),
      endReasonId: c.end_reason_id ?? null,
      endReasonNote: c.end_reason_note ?? null,
      effectiveEndDate: c.effective_end_date ?? null,
      endRecordedAt: c.end_recorded_at?.toISOString() ?? null,
      endRecordedByUserId: c.end_recorded_by_user_id ?? null,
      notes: c.notes,
      ownerSignedAt: c.owner_signed_at?.toISOString() || null,
      tenantSignedAt: c.tenant_signed_at?.toISOString() || null,
      ownerDeliveredAt: c.owner_delivered_at?.toISOString() || null,
      tenantDeliveredAt: c.tenant_delivered_at?.toISOString() || null,
      agentSignedAt: c.agent_signed_at?.toISOString() || null,
      ownerSignatureUrl: url(c.owner_signature_url),
      tenantSignatureUrl: url(c.tenant_signature_url),
      agentSignatureUrl: url(c.agent_signature_url),
      reservationLetterUrl: url(this.reservationDocument(c)?.path),
      reservationLetterStatus: this.reservationDocument(c)?.status ?? null,
      brokerAppointmentUrl: url(this.brokerDocument(c)?.path),
      brokerAppointmentStatus: this.brokerDocument(c)?.status ?? null,
      leaseDocumentUrl: url(
        this.leaseDocument(c)?.path ??
          this.renewalDocument(c)?.path ??
          ((c.template?.form_kind ?? c.agreement_type?.form_kind) === "lease"
            ? c.document_url
            : null),
      ),
      leaseAgreementStatus:
        this.leaseDocument(c)?.status ?? this.renewalDocument(c)?.status ?? null,
      invoiceUrl: url(c.invoice_url),
      receiptUrl: url(c.receipt_url),
      reservationPayment: financial?.invoice ? {
        invoiceDocumentNo: financial.invoice.documentNo,
        receiptDocumentNo: financial.receipt?.documentNo ?? null,
        total: financialTotals(financial.invoice).total,
        status: c.receipt_url ? "paid" : payment?.slipPath ? "submitted" : "unpaid",
        paymentSlipUrl: url(payment?.slipPath),
        submittedAt: payment?.submittedAt ?? null,
        slipReturnReason: !c.receipt_url && !payment?.slipPath ? payment?.returnNote ?? null : null,
      } : null,
      depositPayment: this.depositPayment(c, url),
      ...this.reservationTerms(c, url),
      ...this.handoverDue(c),
      ...((c as WithCancellation).dealCancellation !== undefined
        ? { cancellation: (c as WithCancellation).dealCancellation ? serializeDealCancellation((c as WithCancellation).dealCancellation!, url) : null }
        : {}),
    };
  }
  /** D4 (AC-5.5): a lease waiting for its deposit or handover: the handover day and each time it was moved. */
  private handoverDue(c: LeaseContractEntity) {
    if ((c.template?.form_kind ?? c.agreement_type?.form_kind) !== "lease") return {};
    if (!["awaiting_deposit", "awaiting_handover"].includes(c.status)) return { handoverDue: null };
    const date = handoverDueDate({ startDate: asIsoDate(c.start_date), data: c.data });
    const history = ((c.data?.handoverDue as { history?: Array<{ from: string; to: string; reason: string; at: string }> } | undefined)?.history ?? [])
      .map(({ from, to, reason, at }) => ({ from, to, reason, at }));
    return { handoverDue: date ? { date, history } : null };
  }
  /**
   * D13 (AC-3.7) and D3 (AC-3.6) for a reservation letter: its commission confirmation (worked out from the letter,
   * the signed PDF once generated) and the day everyone must have signed by (the 3rd day after it was made).
   */
  private reservationTerms(c: LeaseContractEntity, url: (path: string | null | undefined) => string | null) {
    if ((c.template?.form_kind ?? c.agreement_type?.form_kind) !== "reservation") return {};
    const commission = reservationCommission(c);
    const made = c.created_at ? bangkokDate(new Date(c.created_at)) : "";
    return {
      commission: commission ? { ...commission, url: url(c.data?.commissionConfirmationPath as string | undefined) } : null,
      signDueDate: made && ["draft", "awaiting_signatures"].includes(c.status) ? shiftIsoDate(made, 3) : null,
    };
  }
  /** What a landlord or tenant gets: the commission confirmation is between the landlord and the agent only. */
  private forParty<T extends AgentContract>(view: T, parties: readonly string[]): T {
    const out = parties.includes("owner") || !("commission" in view) ? view : { ...view, commission: null };
    // D5: the parties see why and the money, not the agent's evidence or refund proof.
    return out.cancellation ? { ...out, cancellation: { ...out.cancellation, evidenceUrls: [], refundProofUrl: null } } : out;
  }
  /** D10: a generated lease with a deposit above 0 has (or should have) one deposit invoice. */
  private depositEligible(c: LeaseContractEntity) {
    return this.leaseDocument(c)?.status === "ready" && leaseDepositAmount(c) > 0;
  }
  private depositPayment(c: LeaseContractEntity, url: (path: string | null | undefined) => string | null): DepositPayment | null {
    const row = (c as WithDepositInvoice).depositInvoice;
    if (!this.depositEligible(c) || row === undefined) return null;
    if (!row)
      return {
        status: "not_issued", total: leaseDepositAmount(c), invoiceId: null, invoiceDocumentNo: null, dueDate: null,
        invoiceUrl: null, receiptDocumentNo: null, receiptUrl: null, paymentSlipUrl: null, submittedAt: null, slipReturnReason: null,
      };
    return {
      status: row.voided_at ? "voided" : row.receipt_pdf_path ? "paid" : row.payment_slip_path ? "submitted" : "unpaid",
      total: financialTotals(row.data).total,
      invoiceId: row.id,
      invoiceDocumentNo: row.document_no,
      dueDate: row.due_date ? String(row.due_date).slice(0, 10) : null,
      invoiceUrl: url(row.pdf_path),
      receiptDocumentNo: row.receipt_document_no ?? null,
      receiptUrl: url(row.receipt_pdf_path),
      paymentSlipUrl: url(row.payment_slip_path),
      submittedAt: row.slip_submitted_at ? new Date(row.slip_submitted_at).toISOString() : null,
      slipReturnReason: !row.receipt_pdf_path && !row.payment_slip_path ? row.slip_return_note ?? null : null,
    };
  }
  private async loadDepositInvoices(rows: LeaseContractEntity[]) {
    const ids = rows.filter((row) => this.depositEligible(row)).map((row) => row.id);
    if (!ids.length) return;
    const found = await this.db.getRepository(AgentInvoiceEntity).find({
      where: { lease_contract_id: In(ids), invoice_kind: "deposit" },
    });
    const byContract = new Map(found.map((row) => [row.lease_contract_id, row]));
    for (const row of rows)
      if (ids.includes(row.id)) (row as WithDepositInvoice).depositInvoice = byContract.get(row.id) ?? null;
  }
  private documentPaths(c: LeaseContractEntity) {
    return [
      this.reservationDocument(c)?.path,
      this.brokerDocument(c)?.path,
      this.leaseDocument(c)?.path ??
        this.renewalDocument(c)?.path ??
        ((c.template?.form_kind ?? c.agreement_type?.form_kind) === "lease" ||
        (c.template?.form_kind ?? c.agreement_type?.form_kind) === "renewal"
          ? c.document_url
          : null),
      c.invoice_url,
      c.receipt_url,
      (c.data?.reservationPayment as { slipPath?: string } | undefined)?.slipPath,
      c.data?.commissionConfirmationPath as string | undefined,
      c.owner_signature_url,
      c.tenant_signature_url,
      c.agent_signature_url,
    ];
  }
  /** D5: the deal cancellation of each cancelled row. */
  private async loadCancellations(rows: LeaseContractEntity[]) {
    const ids = rows.filter((row) => row.status === "cancelled").map((row) => row.id);
    if (!ids.length) return;
    const found = await this.db.getRepository(DealCancellationEntity).createQueryBuilder("dc")
      .where("dc.contract_ids && CAST(:ids AS int[])", { ids }).getMany();
    for (const row of rows)
      if (ids.includes(row.id)) (row as WithCancellation).dealCancellation = found.find((dc) => Array.isArray(dc.contract_ids) && dc.contract_ids.includes(row.id)) ?? null;
  }
  private async signedFor(rows: LeaseContractEntity[]) {
    await this.loadDepositInvoices(rows);
    await this.loadCancellations(rows);
    if (!this.documents) return new Map<string, string>();
    return this.documents.signPaths(
      rows.flatMap((row) => {
        const deposit = (row as WithDepositInvoice).depositInvoice;
        const cancellation = (row as WithCancellation).dealCancellation;
        return [
          ...this.documentPaths(row),
          deposit?.pdf_path,
          deposit?.receipt_pdf_path,
          deposit?.payment_slip_path,
          ...(cancellation?.evidence_paths ?? []),
          cancellation?.refund_proof_path,
        ];
      }),
    );
  }
  async types() {
    const rows = await this.db.getRepository(MasterAgreementTypeEntity).find({
      where: { is_active: true },
      order: { sort_order: "ASC", id: "ASC" },
    });
    return rows.map((row) => ({
      code: row.code,
      nameTh: row.name_th,
      nameEn: row.name_en,
      icon: row.icon,
      formKind: row.form_kind,
    }));
  }
  async templates(code: string) {
    const type = await this.db
      .getRepository(MasterAgreementTypeEntity)
      .findOneBy({ code, is_active: true });
    if (!type) throw new NotFoundException("ไม่พบประเภทสัญญา");
    const rows = await this.db.getRepository(AgreementTemplateEntity).find({
      where: { agreement_type_code: code, is_active: true },
      order: { version: "DESC" },
    });
    return rows.map((t) => ({
      id: t.id,
      agreementTypeCode: t.agreement_type_code,
      version: t.version,
      name: t.name,
      formKind: t.form_kind,
      dataSchema: t.data_schema,
    }));
  }
  async history(agentId: number, id: number) {
    const current = await this.view(agentId, id);
    const rows = await this.query(agentId)
      .andWhere("(c.root_agreement_id = :root OR c.id = :root)", {
        root: current.rootAgreementId,
      })
      .orderBy("c.id", "ASC")
      .getMany();
    return rows.map((c) => this.serialize(c));
  }
  async list(agentId: number) {
    const rows = await this.query(agentId).orderBy("c.id", "DESC").getMany();
    const signed = await this.signedFor(rows);
    return rows.map((c) => this.serialize(c, signed));
  }
  async view(agentId: number, id: number) {
    const c = await this.query(agentId).andWhere("c.id = :id", { id }).getOne();
    if (!c) throw new NotFoundException("ไม่พบสัญญา");
    return this.serialize(c, await this.signedFor([c]));
  }
  async reservationPdf(agentId: number, id: number, generate: boolean) {
    const c = await this.query(agentId).andWhere("c.id = :id", { id }).getOne();
    if (!c) throw new NotFoundException("ไม่พบสัญญา");
    if (
      (c.template?.form_kind ?? c.agreement_type?.form_kind) !== "reservation"
    )
      throw new BadRequestException("รองรับเฉพาะหนังสือจองห้อง");
    if (
      c.template &&
      !["reservation/mock-v2", "reservation/letter-v1"].includes(
        c.template.document_template_key ?? "",
      )
    )
      throw new BadRequestException("แม่แบบนี้ยังไม่รองรับการสร้างเอกสารจอง");
    const state = this.reservationDocument(c)!;
    // D1: a letter that is already generated stays readable; only generating a new one needs a valid appointment.
    if (generate && state.status !== "ready") await this.assertReservationAppointment(c);
    if (generate && state.status === "awaiting_signatures")
      throw new BadRequestException(
        "กรุณาลงนามให้ครบทั้ง 3 ฝ่ายก่อนสร้างเอกสาร",
      );
    if (generate && state.status !== "ready") await this.assertReservationCoBroke(c);
    if (!this.documents)
      throw new ServiceUnavailableException(
        "ยังไม่ได้ตั้งค่าที่เก็บเอกสารสัญญา",
      );
    if (state.status === "ready") return this.view(agentId, id);
    this.assertNotEnded(c);
    // Always rebuild from the current letter fields so 「ดูหนังสือจอง」
    // shows the filled template, not a stale blank/mock preview.
    const serialized = this.serialize(c);
    const snap = (c.party_snapshot ?? {}) as Record<string, unknown>;
    const existing = (serialized.data?.reservationLetter ??
      null) as Record<string, unknown> | null;
    if (!existing || typeof existing !== "object") {
      serialized.data = {
        ...serialized.data,
        reservationLetter: {
          tenantPhone: String(snap.tenantPhone ?? ""),
          tenantId: String(snap.tenantIdNumber ?? ""),
          tenantNationality: String(snap.tenantNationality ?? ""),
          landlordName: String(snap.ownerName ?? ""),
          landlordPhone: String(snap.ownerPhone ?? ""),
          landlordId: String(snap.ownerIdNumber ?? ""),
          agentName: String(snap.agentName ?? ""),
          agentPhone: String(snap.agentPhone ?? ""),
          address: String(snap.propertyAddress ?? ""),
          payee: String(snap.ownerName ?? ""),
          landlordSignName: String(snap.ownerName ?? ""),
          agentSignName: String(snap.agentName ?? ""),
        },
      };
    }
    const base = await createReservationMock(serialized);
    let pdf = base;
    let commissionPdf: Buffer | null = null;
    if (generate) {
      const signatures = await Promise.all(
        CONTRACT_SIGN_PARTIES.map(async (party) => {
          const path = c[SIGN_COLUMNS[party].url]!;
          if (!path.startsWith(`${agentId}/${id}/signatures/`))
            throw new BadRequestException("ไฟล์ลายเซ็นไม่ตรงกับสัญญา");
          return this.documents!.download(path);
        }),
      );
      // D13 (AC-3.7): the landlord's and the agent's signatures on the letter also sign its commission confirmation.
      // A letter saved before letters had their fields (none in its data) is issued without one, as before.
      const letter = c.data?.reservationLetter as { issueDate?: string } | undefined;
      const day = (at: Date | null) => (at ? bangkokDate(new Date(at)) : "");
      const commission = letter
        ? reservationCommissionInput(c, {
            issueDate: isIsoDate(letter.issueDate) ? letter.issueDate : day(c.created_at),
            landlordSignDate: day(c.owner_signed_at),
            agentSignDate: day(c.agent_signed_at),
          })
        : null;
      if (letter && !commission)
        throw new BadRequestException("ค่าเช่าหรือระยะเวลาเช่าในหนังสือจองไม่ครบ จึงสร้างหนังสือยืนยันค่าคอมไม่ได้");
      try {
        pdf = await stampReservationSignatures(base, signatures);
        if (commission)
          commissionPdf = await stampCommissionSignatures(
            await createCommissionConfirmationPdf(commission), signatures[0]!, signatures[2]!);
      } catch {
        throw new BadRequestException(
          "ไม่สามารถอ่านภาพลายเซ็นเพื่อสร้าง PDF ได้",
        );
      }
    }
    const stored = await this.documents.uploadReservationPdf(
      agentId,
      id,
      pdf,
      generate,
    );
    let commissionStored: { path: string } | null = null;
    try {
      if (commissionPdf) commissionStored = await this.documents.uploadCommissionConfirmation(agentId, commissionPdf);
      // Compare-and-swap prevents a slow preview from replacing a generated PDF.
      const result = await this.db.getRepository(LeaseContractEntity).update(
        {
          id,
          created_by_user_id: agentId,
          document_url: c.document_url ?? IsNull(),
          status: c.status,
          data: Raw(alias => `${alias} = :expectedData`, { expectedData: JSON.stringify(c.data ?? {}) }),
        },
        {
          document_url: stored.path,
          ...(commissionStored ? { data: { ...(c.data ?? {}), commissionConfirmationPath: commissionStored.path } } : {}),
          ...(generate &&
          ["draft", "awaiting_signatures", "awaiting_agent_review"].includes(
            c.status,
          )
            ? { status: "active" as const }
            : {}),
        },
      );
      if (result.affected !== 1)
        throw new ConflictException("เอกสารถูกเปลี่ยนแล้ว กรุณาลองอีกครั้ง");
    } catch (error) {
      await this.documents.remove(stored.path).catch(() => undefined);
      if (commissionStored) await this.documents.remove(commissionStored.path).catch(() => undefined);
      throw error;
    }
    return this.view(agentId, id);
  }

  async brokerAppointmentPdf(agentId: number, id: number, generate: boolean) {
    const c = await this.query(agentId).andWhere("c.id = :id", { id }).getOne();
    if (!c) throw new NotFoundException("ไม่พบสัญญา");
    if (
      (c.template?.form_kind ?? c.agreement_type?.form_kind) !==
      "broker_appointment"
    )
      throw new BadRequestException("รองรับเฉพาะสัญญาแต่งตั้งนายหน้า");
    if (
      c.template &&
      c.template.document_template_key !== "broker_appointment/v1"
    )
      throw new BadRequestException(
        "แม่แบบนี้ยังไม่รองรับการสร้างเอกสารแต่งตั้งนายหน้า",
      );
    const state = this.brokerDocument(c)!;
    if (generate && state.status === "awaiting_signatures")
      throw new BadRequestException(
        "กรุณาลงนามให้ครบทั้งผู้ให้เช่าและนายหน้าก่อนสร้างเอกสาร",
      );
    if (!this.documents)
      throw new ServiceUnavailableException(
        "ยังไม่ได้ตั้งค่าที่เก็บเอกสารสัญญา",
      );
    if (state.status === "ready") return this.view(agentId, id);
    this.assertNotEnded(c);
    const saved = (c.data?.brokerAppointment ?? null) as
      | BrokerAppointmentInput
      | null;
    if (!saved)
      throw new BadRequestException("ไม่พบข้อมูลฟอร์มแต่งตั้งนายหน้า");
    const data: BrokerAppointmentInput = {
      ...saved,
      documentNo: saved.documentNo || c.contract_no || `BA-${c.id}`,
      landlordSignName: saved.landlordName || saved.landlordSignName || "",
      brokerSignName:
        saved.brokerSignName || saved.brokerContact || "",
      landlordSignaturePng: "",
      brokerSignaturePng: "",
    };
    const base = await createBrokerAppointmentPdf(data);
    let pdf = base;
    if (generate) {
      const ownerPath = c.owner_signature_url!;
      const agentPath = c.agent_signature_url!;
      if (
        !ownerPath.startsWith(`${agentId}/${id}/signatures/`) ||
        !agentPath.startsWith(`${agentId}/${id}/signatures/`)
      )
        throw new BadRequestException("ไฟล์ลายเซ็นไม่ตรงกับสัญญา");
      try {
        pdf = await stampBrokerAppointmentSignatures(base, {
          owner: await this.documents.download(ownerPath),
          agent: await this.documents.download(agentPath),
        });
      } catch {
        throw new BadRequestException(
          "ไม่สามารถอ่านภาพลายเซ็นเพื่อสร้าง PDF ได้",
        );
      }
    }
    const stored = await this.documents.uploadBrokerAppointmentPdf(
      agentId,
      id,
      pdf,
      generate,
    );
    try {
      const result = await this.db.getRepository(LeaseContractEntity).update(
        {
          id,
          created_by_user_id: agentId,
          document_url: c.document_url ?? IsNull(),
          status: c.status,
          data: Raw(alias => `${alias} = :expectedData`, { expectedData: JSON.stringify(c.data ?? {}) }),
        },
        {
          document_url: stored.path,
          ...(generate &&
          ["draft", "awaiting_signatures", "awaiting_agent_review"].includes(
            c.status,
          )
            ? { status: "active" as const }
            : {}),
        },
      );
      if (result.affected !== 1)
        throw new ConflictException("เอกสารถูกเปลี่ยนแล้ว กรุณาลองอีกครั้ง");
    } catch (error) {
      await this.documents.remove(stored.path).catch(() => undefined);
      throw error;
    }
    return this.view(agentId, id);
  }

  async leaseRenewalPdf(agentId: number, id: number, generate: boolean) {
    const c = await this.query(agentId).andWhere("c.id = :id", { id }).getOne();
    if (!c) throw new NotFoundException("ไม่พบสัญญา");
    if ((c.template?.form_kind ?? c.agreement_type?.form_kind) !== "renewal")
      throw new BadRequestException("รองรับเฉพาะหนังสือต่อสัญญาเช่า");
    if (c.template && c.template.document_template_key !== "lease_renewal/v1")
      throw new BadRequestException("แม่แบบนี้ยังไม่รองรับการสร้างหนังสือต่อสัญญา");
    const state = this.renewalDocument(c)!;
    if (generate && state.status === "awaiting_signatures")
      throw new BadRequestException(
        "กรุณาลงนามให้ครบทั้งผู้ให้เช่าและผู้เช่าก่อนสร้างเอกสาร",
      );
    if (!this.documents)
      throw new ServiceUnavailableException("ยังไม่ได้ตั้งค่าที่เก็บเอกสารสัญญา");
    if (state.status === "ready") return this.view(agentId, id);
    this.assertNotEnded(c);
    const data = this.renewalPreviewInput(c);
    const base = await createLeaseRenewalPdf(data);
    let pdf = base;
    if (generate) {
      const ownerPath = c.owner_signature_url!;
      const tenantPath = c.tenant_signature_url!;
      if (
        !ownerPath.startsWith(`${agentId}/${id}/signatures/`) ||
        !tenantPath.startsWith(`${agentId}/${id}/signatures/`)
      )
        throw new BadRequestException("ไฟล์ลายเซ็นไม่ตรงกับสัญญา");
      try {
        pdf = await stampLeaseRenewalSignatures(base, {
          owner: await this.documents.download(ownerPath),
          tenant: await this.documents.download(tenantPath),
        });
      } catch {
        throw new BadRequestException("ไม่สามารถอ่านภาพลายเซ็นเพื่อสร้าง PDF ได้");
      }
    }
    const stored = await this.documents.uploadLeaseRenewalPdf(
      agentId,
      id,
      pdf,
      generate,
    );
    try {
      const result = await this.db.getRepository(LeaseContractEntity).update(
        {
          id,
          created_by_user_id: agentId,
          document_url: c.document_url ?? IsNull(),
          status: c.status,
          data: Raw((alias) => `${alias} = :expectedData`, {
            expectedData: JSON.stringify(c.data ?? {}),
          }),
        },
        {
          document_url: stored.path,
          ...(generate &&
          ["draft", "awaiting_signatures", "awaiting_agent_review"].includes(
            c.status,
          )
            ? { status: "active" as const }
            : {}),
        },
      );
      if (result.affected !== 1)
        throw new ConflictException("เอกสารถูกเปลี่ยนแล้ว กรุณาลองอีกครั้ง");
    } catch (error) {
      await this.documents.remove(stored.path).catch(() => undefined);
      throw error;
    }
    return this.view(agentId, id);
  }

  async leaseAgreementPdf(agentId: number, id: number, generate: boolean) {
    const c = await this.query(agentId).andWhere("c.id = :id", { id }).getOne();
    if (!c) throw new NotFoundException("ไม่พบสัญญา");
    if ((c.template?.form_kind ?? c.agreement_type?.form_kind) !== "lease")
      throw new BadRequestException("รองรับเฉพาะสัญญาเช่า");
    if (c.template && c.template.document_template_key !== "lease/v1")
      throw new BadRequestException(
        "แม่แบบนี้ยังไม่รองรับการสร้างเอกสารสัญญาเช่า",
      );
    const state = this.leaseDocument(c)!;
    if (generate && state.status === "awaiting_signatures")
      throw new BadRequestException(
        "กรุณาลงนามให้ครบทั้งผู้ให้เช่าและผู้เช่าก่อนสร้างเอกสาร",
      );
    if (!this.documents)
      throw new ServiceUnavailableException(
        "ยังไม่ได้ตั้งค่าที่เก็บเอกสารสัญญา",
      );
    if (state.status === "ready") return this.view(agentId, id);
    this.assertNotEnded(c);
    const saved = (c.data?.leaseAgreement ?? null) as LeaseAgreementInput | null;
    if (!saved)
      throw new BadRequestException("ไม่พบข้อมูลฟอร์มสัญญาเช่า");
    // D9: the generated lease carries the witness signature, so the witness signs first.
    const witness = generate ? await this.liveWitness(c.id) : null;
    if (generate && !witness)
      throw new BadRequestException({ code: "WITNESS_SIGNATURE_REQUIRED", message: WITNESS_SIGNATURE_REQUIRED });
    const witnessName = witness
      ? witness.signer_name?.trim() ||
        [witness.signed_by?.first_name, witness.signed_by?.last_name].filter((part) => part?.trim()).join(" ").trim()
      : "";
    const data: LeaseAgreementInput = {
      ...saved,
      documentNo: saved.documentNo || c.contract_no || `LS-${c.id}`,
      landlordSignName: saved.landlordName || saved.landlordSignName || "",
      tenantSignName: saved.tenantName || saved.tenantSignName || "",
      witnessSignName: witnessName || saved.witnessSignName || saved.agentContact || "",
      landlordSignaturePng: "",
      tenantSignaturePng: "",
    };
    const base = await createLeaseAgreementPdf(data);
    let pdf = base;
    if (generate) {
      const ownerPath = c.owner_signature_url!;
      const tenantPath = c.tenant_signature_url!;
      const witnessPath = witness!.signature_url ?? "";
      if (
        !ownerPath.startsWith(`${agentId}/${id}/signatures/`) ||
        !tenantPath.startsWith(`${agentId}/${id}/signatures/`) ||
        !witnessPath.startsWith(`${agentId}/${id}/signatures/`)
      )
        throw new BadRequestException("ไฟล์ลายเซ็นไม่ตรงกับสัญญา");
      try {
        pdf = await stampLeaseAgreementSignatures(base, {
          owner: await this.documents.download(ownerPath),
          tenant: await this.documents.download(tenantPath),
          witness: await this.documents.download(witnessPath),
        });
      } catch {
        throw new BadRequestException(
          "ไม่สามารถอ่านภาพลายเซ็นเพื่อสร้าง PDF ได้",
        );
      }
    }
    const stored = await this.documents.uploadLeaseAgreementPdf(
      agentId,
      id,
      pdf,
      generate,
    );
    try {
      const result = await this.db.getRepository(LeaseContractEntity).update(
        {
          id,
          created_by_user_id: agentId,
          document_url: c.document_url ?? IsNull(),
          status: c.status,
          data: Raw(alias => `${alias} = :expectedData`, { expectedData: JSON.stringify(c.data ?? {}) }),
        },
        {
          document_url: stored.path,
          // D7 (AC-4.6, 5.4): a generated lease waits for the deposit receipt (or, without a deposit, for the
          // handover) and is active only once the handover is signed by both. Rent bills start then.
          ...(generate &&
          ["draft", "awaiting_signatures", "awaiting_agent_review"].includes(
            c.status,
          )
            ? { status: leaseDepositAmount(c) > 0 ? ("awaiting_deposit" as const) : ("awaiting_handover" as const) }
            : {}),
        },
      );
      if (result.affected !== 1)
        throw new ConflictException("เอกสารถูกเปลี่ยนแล้ว กรุณาลองอีกครั้ง");
    } catch (error) {
      await this.documents.remove(stored.path).catch(() => undefined);
      throw error;
    }
    // D10: the generated lease is final, so its deposit invoice is issued now. A failure does not undo the
    // lease; the contract then shows the deposit as not issued and the agent issues it again.
    if (generate)
      await this.ensureDepositInvoice(agentId, id).catch((error: unknown) =>
        this.logger.warn(`deposit invoice for contract ${id} not issued: ${error instanceof Error ? error.message : String(error)}`),
      );
    return this.view(agentId, id);
  }

  /** D10: POST /agent/contracts/:id/deposit-invoice, the agent issues the deposit invoice again after a failure. */
  async issueDepositInvoice(agentId: number, id: number) {
    const c = await this.query(agentId).andWhere("c.id = :id", { id }).getOne();
    if (!c) throw new NotFoundException("ไม่พบสัญญา");
    if (this.leaseDocument(c)?.status !== "ready")
      throw new BadRequestException("ออกใบแจ้งหนี้เงินประกันได้หลังสร้างเอกสารสัญญาเช่าแล้ว");
    if (leaseDepositAmount(c) <= 0) throw new BadRequestException("สัญญานี้ไม่มีเงินประกัน");
    await this.ensureDepositInvoice(agentId, id);
    return this.view(agentId, id);
  }

  /**
   * D10 (AC-5.1 to 5.5): the one deposit invoice of a generated lease, in the landlord's name. Idempotent:
   * the lease row is locked, so a second request waits and then returns the invoice the first one saved.
   * Returns null when there is nothing to issue (not a generated lease, or the deposit is 0).
   */
  private async ensureDepositInvoice(agentId: number, id: number): Promise<AgentInvoiceEntity | null> {
    const c = await this.query(agentId).andWhere("c.id = :id", { id }).getOne();
    if (!c) throw new NotFoundException("ไม่พบสัญญา");
    if (!this.depositEligible(c)) return null;
    const find = (manager?: EntityManager) =>
      (manager ?? this.db).getRepository(AgentInvoiceEntity).findOne({
        where: { lease_contract_id: c.id, invoice_kind: "deposit" },
      });
    const existing = await find();
    if (existing) return existing;
    this.assertNotEnded(c);
    if (!this.documents) throw new ServiceUnavailableException("ยังไม่ได้ตั้งค่าที่เก็บเอกสาร");
    const documents = this.documents;
    const data = depositInvoice(c, bangkokDate());
    const bytes = await createFinancialPdf("invoice", data);
    const stored = await documents.uploadStandaloneInvoice(agentId, bytes);
    let unused = false;
    try {
      const saved = await this.db.transaction(async (manager) => {
        const current = await manager.findOne(LeaseContractEntity, {
          where: { id: c.id, created_by_user_id: agentId },
          lock: { mode: "pessimistic_write" },
        });
        if (!current || current.document_url !== c.document_url || current.deposit !== c.deposit)
          throw new ConflictException("สัญญาถูกเปลี่ยนแล้ว กรุณาลองอีกครั้ง");
        this.assertNotEnded(current);
        const again = await find(manager);
        if (again) {
          unused = true;
          return again;
        }
        return manager.getRepository(AgentInvoiceEntity).save(
          manager.getRepository(AgentInvoiceEntity).create({
            created_by_user_id: agentId,
            tenant_id: c.tenant_id,
            document_no: data.documentNo,
            issue_date: data.issueDate,
            customer_name: data.customerName,
            data,
            pdf_path: stored.path,
            invoice_kind: "deposit",
            lease_contract_id: c.id,
            issuer_party: "landlord",
            amount: financialTotals(data).total.toFixed(2),
            due_date: data.dueDate,
          }),
        );
      });
      if (unused) await documents.remove(stored.path).catch(() => undefined);
      return saved;
    } catch (error) {
      await documents.remove(stored.path).catch(() => undefined);
      // Another request saved it between our check and our insert.
      if ((error as { code?: string }).code === "23505") {
        const raced = await find();
        if (raced) return raced;
      }
      throw error;
    }
  }

  async financialDocumentDefaults(agentId: number, id: number, kindInput: string) {
    const kind = financialKind(kindInput);
    const c = await this.query(agentId).andWhere("c.id = :id", { id }).getOne();
    if (!c) throw new NotFoundException("ไม่พบสัญญา");
    if ((c.template?.form_kind ?? c.agreement_type?.form_kind) !== "reservation")
      throw new BadRequestException("สร้างเอกสารได้เฉพาะหนังสือจองห้อง");
    const saved = (c.data?.financialDocuments ?? {}) as Partial<Record<string, FinancialDocumentInput>>;
    if (kind === "invoice" && saved.invoice) return saved.invoice;
    const snapshot = c.party_snapshot ?? {};
    const owner = c.rent_room?.property_owner_id
      ? await this.db.getRepository(PropertyOwnerEntity).findOneBy({ id: c.rent_room.property_owner_id }) : null;
    const ownerUser = c.rent_room?.owner_id
      ? await this.db.getRepository(UserEntity).findOneBy({ id: c.rent_room.owner_id }) : null;
    const v = this.serialize(c);
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const base: FinancialDocumentInput = {
      documentNo: `${kind === 'invoice' ? 'INV' : 'REC'}-${v.contractNo}`,
      issueDate: today, dueDate: today, reference: v.contractNo,
      customerName: [c.tenant?.first_name, c.tenant?.last_name].filter((part) => part?.trim()).join(" ") || v.tenant,
      customerFirstName: c.tenant?.first_name ?? "",
      customerLastName: c.tenant?.last_name ?? "",
      customerAddress: String(snapshot.tenantAddress ?? ''), customerTaxId: String(snapshot.tenantTaxId ?? ''),
      customerPhone: String(snapshot.tenantPhone ?? c.tenant?.phone ?? ''),
      customerEmail: String(snapshot.tenantEmail ?? c.tenant?.email ?? ''),
      issuerName: String(snapshot.ownerName ?? owner?.name ?? (ownerUser ? `${ownerUser.first_name} ${ownerUser.last_name}`.trim() : '')), issuerAddress: String(snapshot.ownerAddress ?? ''), issuerTaxId: String(snapshot.ownerTaxId ?? ''),
      issuerPhone: String(snapshot.ownerPhone ?? owner?.phone ?? ownerUser?.phone ?? ''), issuerEmail: owner?.email ?? ownerUser?.email ?? '',
      items: [{ description: `เงินจอง ${v.property}${v.room ? ` ห้อง ${v.room}` : ''}`, quantity: 1, unitPrice: v.reservationFee ?? 0 }],
      vatRate: 0, discount: 0, paymentMethod: '', paymentDetails: [c.rent_room?.owner_bank_name, c.rent_room?.owner_bank_account].filter(Boolean).join(' '), receiverName: '', notes: '',
    };
    if (kind === 'receipt') {
      if (!saved.invoice)
        throw new BadRequestException("กรุณาสร้างใบแจ้งหนี้ก่อนสร้างใบเสร็จ");
      const prev = saved.receipt;
      return {
        ...saved.invoice,
        documentNo: prev?.documentNo || base.documentNo,
        issueDate: prev?.issueDate || today,
        reference: saved.invoice.documentNo,
        paymentMethod: prev?.paymentMethod || (c.payment_submitted_at ? 'transfer' : ''),
        paymentDetails: prev?.paymentDetails || (c.payment_submitted_at ? saved.invoice.paymentDetails || 'ตามสลิปการชำระเงินที่แนบ' : ''),
        receiverName: prev?.receiverName || '',
        notes: prev?.notes || '',
      };
    }
    return base;
  }

  private assertReservationFinancialOpen(c: LeaseContractEntity) {
    if ((c.template?.form_kind ?? c.agreement_type?.form_kind ?? c.agreement_type_code) !== "reservation")
      throw new BadRequestException("เอกสารค่าจองใช้ได้เฉพาะหนังสือจองห้อง");
    if (["cancelled", "expired", "terminated"].includes(c.status))
      throw new BadRequestException("ไม่สามารถรับชำระหรือออกเอกสารให้สัญญาที่ปิดแล้ว");
  }

  async generateFinancialDocument(agentId: number, id: number, kindInput: string, input: unknown) {
    const kind = financialKind(kindInput);
    const c = await this.query(agentId).andWhere("c.id = :id", { id }).getOne();
    if (!c) throw new NotFoundException("ไม่พบสัญญา");
    this.assertReservationFinancialOpen(c);
    if (!this.documents) throw new ServiceUnavailableException("ยังไม่ได้ตั้งค่าที่เก็บเอกสาร");
    const documents = this.documents;
    let storedPath: string | null = null;
    try {
      await this.db.transaction(async (manager) => {
        const repo = manager.getRepository(LeaseContractEntity);
        const current = await repo.findOne({ where: { id, created_by_user_id: agentId }, lock: { mode: "pessimistic_write" } });
        if (!current) throw new NotFoundException("ไม่พบสัญญา");
        this.assertReservationFinancialOpen({ ...current, template: c.template, agreement_type: c.agreement_type });
        // A repeat request returns the same document. Invoice amounts are server-owned.
        const existing = current.data ?? {};
        const financial = (existing.financialDocuments ?? {}) as Partial<Record<string, FinancialDocumentInput>>;
        if (kind === "invoice" && current.invoice_url && financial.invoice) return;
        if (kind === "invoice" && (current.receipt_url || existing.reservationPayment))
          throw new BadRequestException("มีข้อมูลการชำระแล้ว ไม่สามารถเปลี่ยนใบแจ้งหนี้ได้");
        if (kind === "receipt" && current.receipt_url) return;
        let data: FinancialDocumentInput;
        if (kind === "invoice") {
          data = reservationInvoice({ ...c, ...current });
        } else {
          if (!financial.invoice || !current.invoice_url)
            throw new BadRequestException("กรุณาสร้างใบแจ้งหนี้ก่อนสร้างใบเสร็จ");
          const body = input && typeof input === "object" && !Array.isArray(input)
            ? input as Partial<FinancialDocumentInput> : {};
          // D11 (AC-3.5): the landlord receives the booking money, or the agent with a power of attorney attached.
          const receivedBy = receiptReceiver((body as { receivedBy?: unknown }).receivedBy);
          if (receivedBy === "agent" && !(await this.hasPowerOfAttorney(manager, [current.id])))
            throw new BadRequestException({ code: POWER_OF_ATTORNEY_REQUIRED, message: POWER_OF_ATTORNEY_MESSAGE });
          const letter = (current.data?.reservationLetter ?? {}) as Partial<ReservationLetterInput>;
          const snapshot = current.party_snapshot ?? {};
          const issuer = String(financial.invoice.issuerName ?? "");
          const landlordName = String(letter.landlordName || snapshot.ownerName || (issuer !== "NESTYK" ? issuer : "")).trim();
          if (receivedBy === "landlord" && !landlordName)
            throw new BadRequestException("ไม่พบชื่อผู้ให้เช่าในหนังสือจอง กรุณาตรวจสอบข้อมูลผู้ให้เช่า");
          const receiverName = receiverLine(
            receivedBy,
            landlordName,
            receivedBy === "agent" ? await this.agentName(manager, agentId, letter.agentName || snapshot.agentName) : "",
          );
          data = buildReceiptFromInvoice(financial.invoice, {
            ...body,
            receiverName,
            documentNo: `REC-${current.contract_no || `RS${current.id}`}`,
          }, { documentNo: `REC-${current.contract_no || `RS${current.id}`}`, issueDate: bangkokDate() });
          // D11 (TC-3.15): the tax the tenant withheld; the receipt keeps the full amount.
          const withheld = withholdingTaxOf((body as { withholdingTax?: unknown }).withholdingTax, financialTotals(data).total);
          data = { ...data, receivedBy, ...(withheld > 0 ? { withholdingTax: withheld } : {}) };
        }
        const bytes = await createFinancialPdf(kind, data);
        const stored = await documents.upload(agentId, id, kind, { buffer: bytes, size: bytes.length });
        storedPath = stored.path;
        await repo.update({ id, created_by_user_id: agentId }, {
          [DOCUMENT_COLUMNS[kind]]: stored.path,
          data: {
            ...existing,
            financialDocuments: { ...financial, [kind]: data },
            documentFileNames: {
              ...((existing.documentFileNames as object) ?? {}),
              [kind]: `${kind}-${data.documentNo}.pdf`,
            },
          },
        });
      });
    } catch (error) {
      if (storedPath) await documents.remove(storedPath).catch(() => undefined);
      throw error;
    }
    return this.view(agentId, id);
  }

  async listStandaloneInvoices(agentId: number): Promise<StandaloneInvoice[]> {
    // D10: deposit invoices belong to their lease and are shown there, not in the invoice menu.
    const rows = await this.db.getRepository(AgentInvoiceEntity).find({
      where: { created_by_user_id: agentId, invoice_kind: "general" },
      order: { id: "DESC" },
    });
    const signed = this.documents
      ? await this.documents.signPaths(
          rows.flatMap((row) => [
            row.pdf_path,
            row.receipt_pdf_path,
            row.payment_slip_path,
          ]),
        )
      : new Map<string, string>();
    return rows.map((row) => this.serializeStandaloneInvoice(row, signed));
  }

  async peekNextInvoiceNo() {
    return { documentNo: await this.db.transaction((manager) => nextInvoiceNo(manager)) };
  }

  async peekNextCommissionNo() {
    return {
      documentNo: await this.db.transaction((manager) => nextCommissionNo(manager)),
    };
  }

  async listCommissionConfirmations(
    agentId: number,
  ): Promise<CommissionConfirmation[]> {
    const rows = await this.db
      .getRepository(AgentCommissionConfirmationEntity)
      .find({
        where: { created_by_user_id: agentId },
        order: { id: "DESC" },
      });
    const signed = this.documents
      ? await this.documents.signPaths(rows.map((row) => row.pdf_path))
      : new Map<string, string>();
    return rows.map((row) => this.serializeCommissionConfirmation(row, signed));
  }

  async createCommissionConfirmation(
    agentId: number,
    input: unknown,
  ): Promise<CommissionConfirmation> {
    if (!this.documents)
      throw new ServiceUnavailableException("ยังไม่ได้ตั้งค่าที่เก็บเอกสาร");
    const body =
      input && typeof input === "object" && !Array.isArray(input)
        ? (input as Record<string, unknown>)
        : {};
    const documents = this.documents;
    let storedPath: string | null = null;
    try {
      const saved = await this.db.transaction(async (manager) => {
        let tenantId: number | null = null;
        if (body.tenantId != null && body.tenantId !== "") {
          const id = Number(body.tenantId);
          if (!Number.isSafeInteger(id) || id < 1 || id > 2147483647)
            throw new BadRequestException("ไม่พบผู้เช่า");
          const tenant = await manager.findOne(TenantEntity, {
            where: { id, created_by_user_id: agentId },
          });
          if (!tenant) throw new NotFoundException("ไม่พบผู้เช่า");
          tenantId = tenant.id;
        }
        const data = validateCommissionConfirmation({
          ...body,
          documentNo: await nextCommissionNo(manager),
        });
        let bytes: Buffer;
        try {
          bytes = await createCommissionConfirmationPdf(data);
        } catch (error) {
          throw new BadRequestException(
            error instanceof Error ? error.message : "สร้าง PDF ไม่สำเร็จ",
          );
        }
        const stored = await documents.uploadCommissionConfirmation(agentId, bytes);
        storedPath = stored.path;
        return manager.getRepository(AgentCommissionConfirmationEntity).save(
          manager.getRepository(AgentCommissionConfirmationEntity).create({
            created_by_user_id: agentId,
            tenant_id: tenantId,
            document_no: data.documentNo,
            issue_date: data.issueDate,
            landlord_name: data.landlordName,
            data,
            pdf_path: stored.path,
          }),
        );
      });
      const signed = await documents.signPaths([saved.pdf_path]);
      return this.serializeCommissionConfirmation(saved, signed);
    } catch (error) {
      if (storedPath) await documents.remove(storedPath).catch(() => undefined);
      throw error;
    }
  }

  private serializeCommissionConfirmation(
    row: AgentCommissionConfirmationEntity,
    signed: Map<string, string>,
  ): CommissionConfirmation {
    const data = row.data as CommissionConfirmationInput;
    return {
      id: row.id,
      documentNo: row.document_no,
      issueDate: String(row.issue_date).slice(0, 10),
      landlordName: row.landlord_name,
      agentName: data.agentName,
      tenantName: data.tenantName,
      tenantId: row.tenant_id ?? null,
      pdfUrl: signed.get(row.pdf_path) ?? null,
    };
  }

  async createStandaloneInvoice(
    agentId: number,
    input: unknown,
  ): Promise<StandaloneInvoice> {
    if (!this.documents)
      throw new ServiceUnavailableException("ยังไม่ได้ตั้งค่าที่เก็บเอกสาร");
    const body =
      input && typeof input === "object" && !Array.isArray(input)
        ? (input as Record<string, unknown>)
        : {};
    const documents = this.documents;
    let storedPath: string | null = null;
    try {
      const saved = await this.db.transaction(async (manager) => {
        const payer = await invoicePayer(manager, agentId, body.tenantId);
        const data = validateFinancialDocument(
          {
            ...body,
            documentNo: await nextInvoiceNo(manager),
            issuerName: INVOICE_ISSUER_NAME,
            issuerAddress: INVOICE_ISSUER_ADDRESS,
            ...(payer
              ? {
                  customerName: payer.name,
                  customerFirstName: payer.firstName,
                  customerLastName: payer.lastName,
                  customerAddress: payer.address,
                }
              : {}),
          },
          "invoice",
        );
        let bytes: Buffer;
        try {
          bytes = await createFinancialPdf("invoice", data);
        } catch (error) {
          throw new BadRequestException(
            error instanceof Error ? error.message : "สร้าง PDF ไม่สำเร็จ",
          );
        }
        const stored = await documents.uploadStandaloneInvoice(agentId, bytes);
        storedPath = stored.path;
        return manager.getRepository(AgentInvoiceEntity).save(
          manager.getRepository(AgentInvoiceEntity).create({
            created_by_user_id: agentId,
            tenant_id: payer?.id ?? null,
            document_no: data.documentNo,
            issue_date: data.issueDate,
            customer_name: data.customerName,
            data,
            pdf_path: stored.path,
          }),
        );
      });
      const signed = await documents.signPaths([saved.pdf_path]);
      return this.serializeStandaloneInvoice(saved, signed);
    } catch (error) {
      if (storedPath) await documents.remove(storedPath).catch(() => undefined);
      throw error;
    }
  }

  private serializeStandaloneInvoice(
    row: AgentInvoiceEntity,
    signed: Map<string, string>,
  ): StandaloneInvoice {
    const data = row.data as FinancialDocumentInput;
    const issueDate = String(row.issue_date).slice(0, 10);
    return {
      id: row.id,
      documentNo: row.document_no,
      customerName: row.customer_name,
      issueDate,
      total: financialTotals(data).total,
      invoiceUrl: signed.get(row.pdf_path) ?? null,
      tenantId: row.tenant_id ?? null,
      receiptDocumentNo: row.receipt_document_no ?? null,
      receiptUrl: row.receipt_pdf_path
        ? (signed.get(row.receipt_pdf_path) ?? null)
        : null,
      paymentSlipUrl: row.payment_slip_path
        ? (signed.get(row.payment_slip_path) ?? null)
        : null,
    };
  }

  async receiptDefaults(agentId: number, invoiceId: number) {
    const row = await this.db.getRepository(AgentInvoiceEntity).findOne({
      where: { id: invoiceId, created_by_user_id: agentId },
    });
    if (!row) throw new NotFoundException("ไม่พบใบแจ้งหนี้");
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Bangkok",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    const prev = row.receipt_data;
    const documentNo =
      row.receipt_document_no ??
      (row.invoice_kind === "deposit"
        ? depositReceiptNo(row.document_no)
        : await this.db.transaction((manager) => nextReceiptNo(manager)));
    return {
      ...row.data,
      documentNo,
      issueDate: prev?.issueDate || today,
      reference: row.document_no,
      paymentMethod: prev?.paymentMethod || "",
      paymentDetails: prev?.paymentDetails || "",
      receiverName: prev?.receiverName || "",
      notes: prev?.notes || "",
    };
  }

  /**
   * D10, decided by Aof on 21 Oct 2026: no deposit receipt once the lease is closed, and the slip the tenant
   * sent is kept (the agent attaches a slip only when the tenant has not sent one; a wrong slip is sent again
   * by the tenant until the receipt is issued).
   */
  private assertDepositReceipt(row: AgentInvoiceEntity, lease: LeaseContractEntity | null, hasSlip: boolean) {
    if (!lease) throw new NotFoundException("ไม่พบสัญญา");
    if (row.voided_at) throw new BadRequestException("ใบแจ้งหนี้เงินประกันถูกยกเลิกแล้ว ออกใบเสร็จไม่ได้");
    if (["cancelled", "expired", "terminated"].includes(lease.status))
      throw new BadRequestException("สัญญาเช่าปิดแล้ว ออกใบเสร็จเงินประกันไม่ได้");
    if (hasSlip && row.payment_slip_path && row.slip_submitted_at)
      throw new BadRequestException("ผู้เช่าส่งสลิปแล้ว ใบเสร็จเงินประกันใช้สลิปของผู้เช่า ถ้าสลิปไม่ถูกต้อง ให้ผู้เช่าส่งใหม่");
  }

  async createReceiptForInvoice(
    agentId: number,
    invoiceId: number,
    input: unknown,
    file?: { buffer: Buffer; size: number },
  ): Promise<StandaloneInvoice> {
    if (!this.documents)
      throw new ServiceUnavailableException("ยังไม่ได้ตั้งค่าที่เก็บเอกสาร");
    const body =
      input && typeof input === "object" && !Array.isArray(input)
        ? (input as Partial<FinancialDocumentInput>)
        : {};
    const method = String(body.paymentMethod ?? "").trim();
    const hasSlip = Boolean(file?.buffer?.length);
    // D10: a deposit receipt can rest on the slip the tenant already sent.
    const slipOnFile = (row: AgentInvoiceEntity | null) =>
      row?.invoice_kind === "deposit" && Boolean(row.payment_slip_path);
    const before = await this.db.getRepository(AgentInvoiceEntity).findOne({ where: { id: invoiceId, created_by_user_id: agentId } });
    if (!before) throw new NotFoundException("ไม่พบใบแจ้งหนี้");
    if (!method && !hasSlip && !slipOnFile(before))
      throw new BadRequestException("กรุณาแนบสลิปการชำระเงิน");
    if (before.invoice_kind === "deposit")
      this.assertDepositReceipt(before, await this.db.getRepository(LeaseContractEntity).findOne({ where: { id: before.lease_contract_id ?? 0 } }), hasSlip);
    const documents = this.documents;
    let storedPath: string | null = null;
    let slipPath: string | null = null;
    let previousPath: string | null = null;
    let previousSlip: string | null = null;
    try {
      if (hasSlip) {
        const storedSlip = await documents.uploadPaymentSlip(agentId, file);
        slipPath = storedSlip.path;
      }
      const saved = await this.db.transaction(async (manager) => {
        // D10: for a deposit the lease is locked first, then the invoice (the order the tenant's slip upload uses).
        const lease = before.invoice_kind === "deposit"
          ? await manager.findOne(LeaseContractEntity, { where: { id: before.lease_contract_id ?? 0 }, lock: { mode: "pessimistic_write" } })
          : null;
        const repo = manager.getRepository(AgentInvoiceEntity);
        const row = await repo.findOne({
          where: { id: invoiceId, created_by_user_id: agentId },
          lock: { mode: "pessimistic_write" },
        });
        if (!row) throw new NotFoundException("ไม่พบใบแจ้งหนี้");
        if (!method && !hasSlip && !slipOnFile(row))
          throw new BadRequestException("กรุณาแนบสลิปการชำระเงิน");
        if (row.invoice_kind === "deposit") this.assertDepositReceipt(row, lease, hasSlip);
        const today = new Intl.DateTimeFormat("en-CA", {
          timeZone: "Asia/Bangkok",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date());
        const documentNo =
          row.receipt_document_no ??
          (row.invoice_kind === "deposit"
            ? depositReceiptNo(row.document_no)
            : await nextReceiptNo(manager));
        // D11 (AC-3.5): a deposit receipt is received by the landlord, or by the agent with a power of attorney
        // attached to the lease or its reservation. There is no withholding tax on a deposit.
        let receipt: { receiverName?: string; receivedBy?: "landlord" | "agent" } = {};
        if (row.invoice_kind === "deposit") {
          const receivedBy = receiptReceiver((body as { receivedBy?: unknown }).receivedBy);
          if (withholdingTaxOf((body as { withholdingTax?: unknown }).withholdingTax, Number.MAX_SAFE_INTEGER) > 0)
            throw new BadRequestException("ใบเสร็จเงินประกันไม่มีภาษีหัก ณ ที่จ่าย");
          if (receivedBy === "agent" && !(await this.hasPowerOfAttorney(manager, await this.dealAgreementIds(manager, agentId, lease!))))
            throw new BadRequestException({ code: POWER_OF_ATTORNEY_REQUIRED, message: POWER_OF_ATTORNEY_MESSAGE });
          receipt = {
            receivedBy,
            receiverName: receiverLine(
              receivedBy,
              row.data.issuerName,
              receivedBy === "agent" ? await this.agentName(manager, agentId, lease?.party_snapshot?.agentName) : "",
            ),
          };
        }
        const built = buildReceiptFromInvoice(
          row.data,
          { ...body, ...receipt, documentNo },
          {
            documentNo,
            issueDate:
              String(body.issueDate ?? "").trim() ||
              row.receipt_data?.issueDate ||
              today,
          },
          { paymentMethodOptional: !method },
        );
        const data: FinancialDocumentInput = receipt.receivedBy ? { ...built, receivedBy: receipt.receivedBy } : built;
        let bytes: Buffer;
        try {
          bytes = await createFinancialPdf("receipt", data);
        } catch (error) {
          throw new BadRequestException(
            error instanceof Error ? error.message : "สร้าง PDF ไม่สำเร็จ",
          );
        }
        const stored = await documents.uploadStandaloneReceipt(agentId, bytes);
        storedPath = stored.path;
        previousPath = row.receipt_pdf_path;
        row.receipt_document_no = data.documentNo;
        row.receipt_issue_date = data.issueDate;
        row.receipt_data = data;
        row.receipt_pdf_path = stored.path;
        if (slipPath) {
          // Only a slip the agent attached before is replaced here: a deposit slip the tenant sent is kept.
          previousSlip = row.payment_slip_path;
          row.payment_slip_path = slipPath;
        }
        // D7: the deposit is received, so the lease (locked above) now waits for the handover.
        if (lease?.status === "awaiting_deposit")
          await manager.update(LeaseContractEntity, { id: lease.id, status: "awaiting_deposit" }, { status: "awaiting_handover" });
        return repo.save(row);
      });
      if (previousPath && previousPath !== saved.receipt_pdf_path)
        await documents.remove(previousPath).catch(() => undefined);
      if (previousSlip && previousSlip !== saved.payment_slip_path)
        await documents.remove(previousSlip).catch(() => undefined);
      const signed = await documents.signPaths([
        saved.pdf_path,
        saved.receipt_pdf_path,
        saved.payment_slip_path,
      ]);
      return this.serializeStandaloneInvoice(saved, signed);
    } catch (error) {
      if (storedPath) await documents.remove(storedPath).catch(() => undefined);
      if (slipPath) await documents.remove(slipPath).catch(() => undefined);
      throw error;
    }
  }

  async uploadDocument(
    agentId: number,
    id: number,
    kind: string,
    file: { buffer: Buffer; size: number; originalname?: string } | undefined,
  ) {
    if (!CONTRACT_DOCUMENT_KINDS.some((allowed) => allowed === kind))
      throw new BadRequestException("ชนิดเอกสารไม่ถูกต้อง");
    const documentKind = kind as AgentContractDocumentKind;
    const c = await this.query(agentId).andWhere("c.id = :id", { id }).getOne();
    if (!c) throw new NotFoundException("ไม่พบสัญญา");
    this.assertDocumentMutable(c);
    const formKind =
      c.template?.form_kind ?? c.agreement_type?.form_kind ?? "lease";
    if ((documentKind === "invoice" || documentKind === "receipt") && c.data?.financialDocuments)
      throw new BadRequestException("เอกสารค่าจองต้องสร้างจากใบแจ้งหนี้ที่ผูกกับหนังสือจอง");
    if (documentKind === "lease_agreement") {
      if (formKind !== "lease")
        throw new BadRequestException("อัปโหลดสัญญาเช่าได้เฉพาะสัญญาเช่า");
    } else if (formKind !== "reservation") {
      throw new BadRequestException("อัปโหลดเอกสารได้เฉพาะหนังสือจองห้อง");
    }
    if (!this.documents)
      throw new ServiceUnavailableException(
        "ยังไม่ได้ตั้งค่าที่เก็บเอกสารสัญญา",
      );
    const stored = await this.documents.upload(
      agentId,
      c.id,
      documentKind,
      file,
    );
    try {
      const result = await this.db
        .getRepository(LeaseContractEntity)
        .update(
          { id: c.id, created_by_user_id: agentId, status: c.status,
            [DOCUMENT_COLUMNS[documentKind]]: c[DOCUMENT_COLUMNS[documentKind]] ?? IsNull(),
            data: Raw(alias => `${alias} = :expectedData`, { expectedData: JSON.stringify(c.data ?? {}) }),
          },
          {
            [DOCUMENT_COLUMNS[documentKind]]: stored.path,
            ...(file?.originalname ? {
              data: () => `COALESCE(data, '{}'::jsonb) || jsonb_build_object('documentFileNames', COALESCE(data->'documentFileNames', '{}'::jsonb) || ${"'" + JSON.stringify({ [documentKind]: file.originalname }).replace(/'/g, "''") + "'"}::jsonb)`,
            } : {}),
          },
        );
      if (result.affected !== 1) throw new ConflictException("สัญญาถูกเปลี่ยนแล้ว กรุณาเปิดใหม่ก่อนอัปโหลด");
    } catch (error) {
      await this.documents.remove(stored.path).catch(() => undefined);
      throw error;
    }
    return this.view(agentId, c.id);
  }
  /** D11 (AC-3.5): a current, not rejected power of attorney is attached to one of these agreements. */
  private async hasPowerOfAttorney(manager: EntityManager, agreementIds: number[]) {
    if (!agreementIds.length) return false;
    const docs = await manager.find(AgreementDocumentEntity, { where: { agreement_id: In(agreementIds) } });
    const replaced = new Set(docs.map((d) => d.supersedes_document_id).filter((id) => id != null));
    // The landlord's power of attorney: one filed for the tenant does not let the agent receive for the landlord.
    return docs.some((d) => d.document_type_code === "power_of_attorney" && d.subject !== "tenant" && !d.removed_at &&
      !replaced.has(d.id) && d.review_status !== "rejected");
  }
  /** D11: the lease and the not cancelled reservations of the same lead and room (where the power of attorney may be attached). */
  private async dealAgreementIds(manager: EntityManager, agentId: number, lease: LeaseContractEntity) {
    const rows = await manager.find(LeaseContractEntity, {
      where: { created_by_user_id: agentId, lead_id: lease.lead_id, rent_room_id: lease.rent_room_id },
      relations: { template: true, agreement_type: true },
    });
    return [lease.id, ...rows
      .filter((row) => row.id !== lease.id && row.status !== "cancelled" &&
        (row.template?.form_kind ?? row.agreement_type?.form_kind) === "reservation")
      .map((row) => row.id)];
  }
  private async agentName(manager: EntityManager, agentId: number, known?: unknown) {
    if (typeof known === "string" && known.trim()) return known.trim();
    const user = await manager.findOne(UserEntity, { where: { id: agentId } });
    return [user?.first_name, user?.last_name].filter((part) => part?.trim()).join(" ").trim();
  }
  /** D11 (AC-3.4): the agent returns the tenant's booking slip with a reason; the tenant then sends a new one. */
  /**
   * D4 (AC-5.5, Aof 26 Oct 2026): the agent moves the handover day of a lease waiting for its deposit or its
   * handover, with a reason (body: { date, reason }). The reminder that the deposit is unpaid follows the new day.
   */
  async moveHandoverDue(agentId: number, id: number, input: unknown) {
    const b = input && typeof input === "object" && !Array.isArray(input) ? (input as Record<string, unknown>) : {};
    const reason = typeof b.reason === "string" ? b.reason.trim() : "";
    if (!isIsoDate(b.date)) throw new BadRequestException("วันส่งมอบไม่ถูกต้อง");
    if (!reason || reason.length > 500) throw new BadRequestException("กรุณาระบุเหตุผลที่เลื่อนวันส่งมอบ (ไม่เกิน 500 ตัวอักษร)");
    const date = b.date;
    if (date < bangkokToday()) throw new BadRequestException("วันส่งมอบใหม่ต้องไม่ก่อนวันนี้");
    const c = await this.query(agentId).andWhere("c.id = :id", { id }).getOne();
    if (!c) throw new NotFoundException("ไม่พบสัญญา");
    if ((c.template?.form_kind ?? c.agreement_type?.form_kind) !== "lease")
      throw new BadRequestException("เลื่อนวันส่งมอบได้เฉพาะสัญญาเช่า");
    await this.db.transaction(async (manager) => {
      const current = await manager.findOne(LeaseContractEntity, {
        where: { id, created_by_user_id: agentId }, lock: { mode: "pessimistic_write" },
      });
      if (!current) throw new NotFoundException("ไม่พบสัญญา");
      if (!["awaiting_deposit", "awaiting_handover"].includes(current.status))
        throw new BadRequestException("เลื่อนวันส่งมอบได้เฉพาะสัญญาเช่าที่รอเงินประกันหรือรอส่งมอบห้อง");
      const from = handoverDueDate({ startDate: asIsoDate(current.start_date), data: current.data });
      if (from === date) throw new BadRequestException("วันส่งมอบใหม่ต้องต่างจากวันเดิม");
      const previous = current.data?.handoverDue as { history?: unknown[] } | undefined;
      await manager.update(LeaseContractEntity, { id }, {
        data: {
          ...current.data,
          handoverDue: {
            date,
            history: [...(previous?.history ?? []), { from, to: date, reason, at: new Date().toISOString(), by: agentId }],
          },
        },
      });
    });
    return this.view(agentId, id);
  }

  async returnReservationSlip(agentId: number, id: number, input: unknown) {
    const reason = slipReturnReason(input);
    const c = await this.query(agentId).andWhere("c.id = :id", { id }).getOne();
    if (!c) throw new NotFoundException("ไม่พบสัญญา");
    this.assertReservationFinancialOpen(c);
    let oldPath: string | undefined;
    const files: DraftFiles = { uploaded: [], replaced: [] };
    try {
      await this.db.transaction(async (manager) => {
        const current = await manager.findOne(LeaseContractEntity, {
          where: { id, created_by_user_id: agentId }, lock: { mode: "pessimistic_write" },
        });
        if (!current) throw new NotFoundException("ไม่พบสัญญา");
        this.assertReservationFinancialOpen({ ...current, template: c.template, agreement_type: c.agreement_type });
        if (current.receipt_url) throw new BadRequestException("ออกใบเสร็จแล้ว ตีกลับสลิปไม่ได้");
        const payment = current.data?.reservationPayment as { slipPath?: string; submittedAt?: string } | undefined;
        if (!payment?.slipPath) throw new BadRequestException("ยังไม่มีสลิปที่ส่งมาให้ตีกลับ");
        assertSameSlip(input, payment.submittedAt);
        oldPath = payment.slipPath;
        const data = {
          ...current.data,
          reservationPayment: { returnNote: reason, returnedAt: new Date().toISOString(), returnedBy: agentId },
        };
        await manager.update(LeaseContractEntity, { id: current.id }, { payment_submitted_at: null, data });
        // D2 round 2 (AC-2.4, TC-2.04): the tenant pays again at the latest agreed amount, so a letter nobody has
        // signed and its invoice follow the offer when its rent changed after the slip was sent.
        const offer = await confirmedOffer(manager, current.lead_id, current.rent_room_id);
        if (offer && !hasSignature(current) && Number(offer.monthly_rent) !== Number(current.reservation_fee))
          await refreshReservationDraft(manager, this.documents, agentId,
            { ...current, payment_submitted_at: null, data, template: c.template, agreement_type: c.agreement_type,
              rent_room: c.rent_room, tenant: c.tenant } as LeaseContractEntity,
            offer, files);
      });
    } catch (error) {
      for (const path of files.uploaded) await this.documents?.remove(path).catch(() => undefined);
      throw error;
    }
    if (oldPath) await this.documents?.remove(oldPath).catch(() => undefined);
    for (const path of files.replaced) await this.documents?.remove(path).catch(() => undefined);
    return this.view(agentId, id);
  }
  /** D11 (AC-5.4): the same for the deposit slip of a generated lease. */
  async returnDepositSlip(agentId: number, id: number, input: unknown) {
    const reason = slipReturnReason(input);
    let oldPath: string | null = null;
    await this.db.transaction(async (manager) => {
      // The lease first, then the invoice: the order the slip upload and the receipt use.
      const lease = await manager.findOne(LeaseContractEntity, {
        where: { id, created_by_user_id: agentId }, lock: { mode: "pessimistic_write" },
      });
      if (!lease) throw new NotFoundException("ไม่พบสัญญา");
      this.assertNotEnded(lease);
      const row = await manager.findOne(AgentInvoiceEntity, {
        where: { lease_contract_id: lease.id, invoice_kind: "deposit", created_by_user_id: agentId },
        lock: { mode: "pessimistic_write" },
      });
      if (!row) throw new BadRequestException("ยังไม่มีใบแจ้งหนี้เงินประกัน");
      if (row.voided_at) throw new BadRequestException("ใบแจ้งหนี้เงินประกันถูกยกเลิกแล้ว");
      if (row.receipt_pdf_path) throw new BadRequestException("ออกใบเสร็จแล้ว ตีกลับสลิปไม่ได้");
      if (!row.payment_slip_path || !row.slip_submitted_at)
        throw new BadRequestException("ยังไม่มีสลิปที่ผู้เช่าส่งมาให้ตีกลับ");
      assertSameSlip(input, new Date(row.slip_submitted_at).toISOString());
      oldPath = row.payment_slip_path;
      await manager.update(AgentInvoiceEntity, { id: row.id }, {
        payment_slip_path: null, slip_submitted_at: null, slip_return_note: reason,
      });
    });
    if (oldPath) await this.documents?.remove(oldPath).catch(() => undefined);
    return this.view(agentId, id);
  }
  private reservationSigningBlockedReason(c: LeaseContractEntity, parties: AgentContractSignParty[]) {
    const formKind = c.template?.form_kind ?? c.agreement_type?.form_kind ?? "lease";
    // D3 (AC-3.6): every party signs the letter only after the booking receipt is issued.
    return formKind === "reservation" && parties.length > 0 && !c.receipt_url
      ? "ทุกฝ่ายลงนามหนังสือจองได้หลังผู้เช่าชำระค่าจอง และเอเจนต์ออกใบเสร็จแล้ว"
      : null;
  }
  private assertReservationPaidForSigning(c: LeaseContractEntity, parties: AgentContractSignParty[]) {
    const reason = this.reservationSigningBlockedReason(c, parties);
    if (reason) throw new BadRequestException(reason);
  }
  async sign(agentId: number, id: number, input: unknown) {
    const { parties, png } = await validateSign(input);
    const c = await this.query(agentId).andWhere("c.id = :id", { id }).getOne();
    if (!c) throw new NotFoundException("ไม่พบสัญญา");
    this.assertDocumentMutable(c);
    await this.assertReservationAppointment(c);
    if (CLOSED_STATUSES.includes(c.status as (typeof CLOSED_STATUSES)[number]))
      throw new BadRequestException("สัญญานี้ไม่สามารถลงนามได้");
    const formKind =
      c.template?.form_kind ?? c.agreement_type?.form_kind ?? "lease";
    if (formKind === "broker_appointment" && parties.includes("tenant"))
      throw new BadRequestException(
        "สัญญาแต่งตั้งนายหน้าลงนามได้เฉพาะผู้ให้เช่าและนายหน้า",
      );
    if (
      (formKind === "lease" || formKind === "renewal") &&
      parties.includes("agent")
    )
      throw new BadRequestException(
        "สัญญานี้ลงนามได้เฉพาะผู้ให้เช่าและผู้เช่า",
      );
    this.assertReservationPaidForSigning(c, parties);
    if (this.attachments) await this.attachments.assertReady(c);
    const pending = parties.filter((party) => !c[SIGN_COLUMNS[party].at]);
    if (!pending.length) throw new BadRequestException("ฝ่ายที่เลือกลงนามแล้ว");
    if (!this.documents)
      throw new ServiceUnavailableException(
        "ยังไม่ได้ตั้งค่าที่เก็บเอกสารสัญญา",
      );
    const stored = await this.documents.uploadSignature(agentId, c.id, {
      buffer: png,
      size: png.length,
    });
    const now = new Date();
    const patch: {
      owner_signed_at?: Date;
      tenant_signed_at?: Date;
      agent_signed_at?: Date;
      owner_signature_url?: string;
      tenant_signature_url?: string;
      agent_signature_url?: string;
      status?: LeaseContractEntity["status"];
    } = {};
    for (const party of pending) {
      patch[SIGN_COLUMNS[party].at] = now;
      patch[SIGN_COLUMNS[party].url] = stored.path;
    }
    const ownerAt = patch.owner_signed_at ?? c.owner_signed_at;
    const tenantAt = patch.tenant_signed_at ?? c.tenant_signed_at;
    const agentAt = patch.agent_signed_at ?? c.agent_signed_at;
    if (c.status === "draft" || c.status === "awaiting_signatures") {
      const complete =
        formKind === "broker_appointment"
          ? !!(ownerAt && agentAt)
          : formKind === "lease" || formKind === "renewal"
            ? !!(ownerAt && tenantAt)
            : !!(ownerAt && tenantAt && agentAt);
      patch.status = complete ? "awaiting_agent_review" : "awaiting_signatures";
    }
    try {
      await this.db.transaction(async (manager) => {
        const result = await manager.update(LeaseContractEntity, { id: c.id, created_by_user_id: agentId, status: c.status,
          receipt_url: c.receipt_url ?? IsNull(),
          data: Raw(alias => `${alias} = :expectedData`, { expectedData: JSON.stringify(c.data ?? {}) }),
        }, patch);
        if (result.affected !== 1) throw new ConflictException("สัญญาถูกเปลี่ยนแล้ว กรุณาเปิดใหม่ก่อนลงนาม");
        // D17: the agent's own signature is made in the app; any other party here is signed for by the agent.
        await this.recordSignatures(manager, pending.map((party) => ({
          agreement_id: c.id, party, channel: party === "agent" ? "app" as const : "on_site" as const,
          signed_by_user_id: agentId, signature_url: stored.path, signed_at: now,
        })));
      });
    } catch (error) {
      await this.documents.remove(stored.path).catch(() => undefined);
      // D17: one live signature per party; a second signature that raced in is the same answer as "already signed".
      if ((error as { code?: string }).code === "23505") throw new BadRequestException("ฝ่ายนี้ลงนามแล้ว");
      if ((error as { code?: string }).code === "23514")
        throw new BadRequestException(
          "กรุณาแนบเอกสารที่จำเป็นให้ครบก่อนลงนาม",
        );
      throw error;
    }
    return this.view(agentId, c.id);
  }
  private shareParty(input: unknown) {
    const party =
      input &&
      typeof input === "object" &&
      !Array.isArray(input) &&
      typeof (input as { party?: unknown }).party === "string"
        ? (input as { party: string }).party
        : "";
    if (!SHAREABLE_SIGN_PARTIES.includes(party as ContractParty))
      throw new BadRequestException("ส่งสัญญาได้เฉพาะผู้เช่าหรือผู้ให้เช่า");
    return party as ContractParty;
  }
  async deliverToParty(agentId: number, id: number, input: unknown) {
    const party = this.shareParty(input);
    const c = await this.query(agentId).andWhere("c.id = :id", { id }).getOne();
    if (!c) throw new NotFoundException("ไม่พบสัญญา");
    const formKind =
      c.template?.form_kind ?? c.agreement_type?.form_kind ?? "lease";
    if (formKind === "broker_appointment" && party === "tenant")
      throw new BadRequestException(
        "สัญญาแต่งตั้งนายหน้าส่งให้ได้เฉพาะผู้ให้เช่า",
      );
    this.assertDocumentMutable(c);
    await this.assertReservationAppointment(c);
    if (CLOSED_STATUSES.includes(c.status as (typeof CLOSED_STATUSES)[number]))
      throw new BadRequestException("สัญญานี้ไม่สามารถส่งได้");
    if (c[SIGN_COLUMNS[party].at])
      throw new BadRequestException("ฝ่ายนี้ลงนามแล้ว");
    if (this.attachments) await this.attachments.assertReady(c);
    const userId =
      party === "tenant"
        ? (c.tenant?.user_id ?? null)
        : (c.owner_user_id ?? c.rent_room?.owner_id ?? null);
    if (!userId)
      throw new BadRequestException(
        party === "tenant"
          ? "ผู้เช่ายังไม่มีบัญชีในระบบ"
          : "ผู้ให้เช่ายังไม่มีบัญชีในระบบ",
      );
    const now = new Date();
    const patch =
      party === "tenant"
        ? { tenant_delivered_at: now }
        : { owner_delivered_at: now, owner_user_id: userId };
    const result = await this.db.getRepository(LeaseContractEntity).update(
      {
        id: c.id,
        created_by_user_id: agentId,
        status: c.status,
        data: Raw((alias) => `${alias} = :expectedData`, {
          expectedData: JSON.stringify(c.data ?? {}),
        }),
      },
      patch,
    );
    if (result.affected !== 1)
      throw new ConflictException("สัญญาถูกเปลี่ยนแล้ว กรุณาเปิดใหม่");
    return { party, userId, deliveredAt: now.toISOString() };
  }
  async contractForParty(userId: number, id: number) {
    const c = await this.inboxQuery().andWhere("c.id = :id", { id }).getOne();
    const parties = c ? this.partiesFor(userId, c) : [];
    if (!c || !parties.length) throw new NotFoundException("ไม่พบสัญญา");
    return { contract: c, parties };
  }
  async financialDocumentForParty(userId: number, id: number, kind: string) {
    const { contract: c, parties } = await this.contractForParty(userId, id);
    // D13: the commission confirmation is the landlord's (and the agent's), not the tenant's.
    if (kind === "commission-confirmation" && !parties.includes("owner")) throw new NotFoundException("ไม่พบเอกสารการชำระเงิน");
    // D10: both parties of a lease can open its deposit invoice, slip and receipt.
    const deposit = kind.startsWith("deposit-") && this.depositEligible(c)
      ? await this.db.getRepository(AgentInvoiceEntity).findOne({ where: { lease_contract_id: c.id, invoice_kind: "deposit" } })
      : null;
    const path = kind === "invoice" ? c.invoice_url
      : kind === "receipt" ? c.receipt_url
      : kind === "payment-slip" ? (c.data?.reservationPayment as { slipPath?: string } | undefined)?.slipPath
      : kind === "deposit-invoice" ? deposit?.pdf_path
      : kind === "deposit-receipt" ? deposit?.receipt_pdf_path
      : kind === "deposit-payment-slip" ? deposit?.payment_slip_path
      : kind === "commission-confirmation" ? (c.data?.commissionConfirmationPath as string | undefined)
      : null;
    if (!path) throw new NotFoundException("ไม่พบเอกสารการชำระเงิน");
    if (!this.documents) throw new ServiceUnavailableException("ยังไม่ได้ตั้งค่าที่เก็บเอกสาร");
    const signed = await this.documents.signPaths([path]);
    const url = signed.get(path);
    if (!url) throw new ServiceUnavailableException("เปิดเอกสารไม่สำเร็จ กรุณาลองอีกครั้ง");
    return { url };
  }

  async uploadReservationPaymentSlip(userId: number, id: number, file: { buffer: Buffer; size: number; originalname?: string } | undefined) {
    const { contract: c, parties } = await this.contractForParty(userId, id);
    if (!parties.includes("tenant")) throw new ForbiddenException("เฉพาะผู้เช่าในหนังสือจองเท่านั้นที่ส่งสลิปได้");
    this.assertReservationFinancialOpen(c);
    if (!c.invoice_url) throw new BadRequestException("ยังไม่มีใบแจ้งหนี้ค่าจอง");
    if (!(c.data?.financialDocuments as { invoice?: FinancialDocumentInput } | undefined)?.invoice)
      throw new BadRequestException("กรุณาให้เอเจนต์สร้างใบแจ้งหนี้ค่าจองที่ผูกกับหนังสือจองก่อน");
    if (c.receipt_url) throw new BadRequestException("ออกใบเสร็จแล้ว ไม่สามารถเปลี่ยนสลิปได้");
    if (!this.documents) throw new ServiceUnavailableException("ยังไม่ได้ตั้งค่าที่เก็บเอกสาร");
    const documents = this.documents;
    const stored = await documents.uploadPaymentSlip(c.created_by_user_id, file);
    let oldPath: string | undefined;
    try {
      await this.db.transaction(async (manager) => {
        const repo = manager.getRepository(LeaseContractEntity);
        const current = await repo.findOne({ where: { id, created_by_user_id: c.created_by_user_id }, lock: { mode: "pessimistic_write" } });
        if (!current || !current.tenant_delivered_at || current.tenant_id !== c.tenant_id)
          throw new NotFoundException("ไม่พบสัญญา");
        const tenant = await manager.findOneBy(TenantEntity, { id: current.tenant_id, user_id: userId });
        if (!tenant) throw new NotFoundException("ไม่พบสัญญา");
        this.assertReservationFinancialOpen({ ...current, template: c.template, agreement_type: c.agreement_type });
        if (!current.invoice_url) throw new BadRequestException("ยังไม่มีใบแจ้งหนี้ค่าจอง");
        if (current.receipt_url) throw new ConflictException("ออกใบเสร็จแล้ว ไม่สามารถเปลี่ยนสลิปได้");
        if (current.invoice_url !== c.invoice_url)
          throw new ConflictException("ใบแจ้งหนี้เปลี่ยนแล้ว กรุณาเปิดตรวจสอบยอดก่อนส่งสลิปใหม่");
        oldPath = (current.data?.reservationPayment as { slipPath?: string } | undefined)?.slipPath;
        const now = new Date();
        await repo.update({ id }, {
          payment_submitted_at: now,
          data: {
            ...current.data,
            reservationPayment: {
              slipPath: stored.path,
              submittedAt: now.toISOString(),
              submittedBy: userId,
              fileName: file?.originalname?.slice(0, 255) || "สลิปชำระค่าจอง",
            },
          },
        });
      });
    } catch (error) {
      await documents.remove(stored.path).catch(() => undefined);
      throw error;
    }
    if (oldPath) await documents.remove(oldPath).catch(() => undefined);
    const { contract: updated, parties: mine } = await this.contractForParty(userId, id);
    return { ...this.forParty(this.serialize(updated, await this.signedFor([updated])), mine), myParties: mine };
  }
  /** D10: the tenant of a generated lease sends the deposit slip; the agent then issues the receipt. */
  async uploadDepositPaymentSlip(userId: number, id: number, file: { buffer: Buffer; size: number; originalname?: string } | undefined) {
    const { contract: c, parties } = await this.contractForParty(userId, id);
    if (!parties.includes("tenant")) throw new ForbiddenException("เฉพาะผู้เช่าในสัญญาเท่านั้นที่ส่งสลิปเงินประกันได้");
    this.assertNotEnded(c);
    const invoice = this.depositEligible(c)
      ? await this.db.getRepository(AgentInvoiceEntity).findOne({ where: { lease_contract_id: c.id, invoice_kind: "deposit" } })
      : null;
    if (!invoice) throw new BadRequestException("ยังไม่มีใบแจ้งหนี้เงินประกัน");
    if (invoice.receipt_pdf_path) throw new BadRequestException("ออกใบเสร็จแล้ว ไม่สามารถเปลี่ยนสลิปได้");
    if (!this.documents) throw new ServiceUnavailableException("ยังไม่ได้ตั้งค่าที่เก็บเอกสาร");
    const documents = this.documents;
    const stored = await documents.uploadPaymentSlip(c.created_by_user_id, file);
    let oldPath: string | null = null;
    try {
      await this.db.transaction(async (manager) => {
        // The lease first, then the invoice: the same order as ensureDepositInvoice, so a lease closed
        // meanwhile is seen here.
        const lease = await manager.findOne(LeaseContractEntity, { where: { id: c.id }, lock: { mode: "pessimistic_write" } });
        if (!lease || !lease.tenant_delivered_at || lease.tenant_id !== c.tenant_id)
          throw new NotFoundException("ไม่พบสัญญา");
        this.assertNotEnded(lease);
        const tenant = await manager.findOneBy(TenantEntity, { id: lease.tenant_id, user_id: userId });
        if (!tenant) throw new NotFoundException("ไม่พบสัญญา");
        const current = await manager.findOne(AgentInvoiceEntity, {
          where: { id: invoice.id, lease_contract_id: c.id, invoice_kind: "deposit" },
          lock: { mode: "pessimistic_write" },
        });
        if (!current) throw new NotFoundException("ไม่พบใบแจ้งหนี้เงินประกัน");
        if (current.receipt_pdf_path) throw new ConflictException("ออกใบเสร็จแล้ว ไม่สามารถเปลี่ยนสลิปได้");
        if (current.voided_at) throw new ConflictException("ใบแจ้งหนี้เงินประกันถูกยกเลิกแล้ว ไม่ต้องส่งสลิป");
        oldPath = current.payment_slip_path;
        await manager.update(AgentInvoiceEntity, { id: current.id }, {
          payment_slip_path: stored.path,
          slip_submitted_at: new Date(),
          slip_return_note: null,
        });
      });
    } catch (error) {
      await documents.remove(stored.path).catch(() => undefined);
      throw error;
    }
    if (oldPath) await documents.remove(oldPath).catch(() => undefined);
    const { contract: updated, parties: mine } = await this.contractForParty(userId, id);
    return { ...this.forParty(this.serialize(updated, await this.signedFor([updated])), mine), myParties: mine };
  }
  async documentForParty(userId: number, id: number) {

    const c = await this.inboxQuery().andWhere("c.id = :id", { id }).getOne();
    if (!c || !this.partiesFor(userId, c).length)
      throw new NotFoundException("ไม่พบสัญญา");
    if (!this.documents)
      throw new ServiceUnavailableException("ยังไม่ได้ตั้งค่าที่เก็บเอกสารสัญญา");
    const existing = this.partyDocumentPath(c);
    const path = existing ?? (await this.storePartyPreview(c)).path;
    const signed = await this.documents.signPaths([path]);
    const url = signed.get(path);
    if (!url)
      throw new ServiceUnavailableException("ไม่สามารถเปิดเอกสารได้ กรุณาลองอีกครั้ง");
    return { url };
  }
  private partyDocumentPath(c: LeaseContractEntity) {
    return (
      this.reservationDocument(c)?.path ??
      this.brokerDocument(c)?.path ??
      this.leaseDocument(c)?.path ??
      this.renewalDocument(c)?.path ??
      null
    );
  }
  private async storePartyPreview(c: LeaseContractEntity) {
    const formKind =
      c.template?.form_kind ?? c.agreement_type?.form_kind ?? "lease";
    const pdf =
      formKind === "reservation"
        ? await createReservationMock(this.reservationPreviewContract(c))
        : formKind === "broker_appointment"
          ? await createBrokerAppointmentPdf(this.brokerPreviewInput(c))
          : formKind === "renewal"
            ? await createLeaseRenewalPdf(this.renewalPreviewInput(c))
            : await createLeaseAgreementPdf(this.leasePreviewInput(c));
    return this.documents!.uploadPartyPreview(
      c.created_by_user_id,
      c.id,
      formKind,
      pdf,
    );
  }
  private reservationPreviewContract(c: LeaseContractEntity): AgentContract {
    const serialized = this.serialize(c);
    const snap = (c.party_snapshot ?? {}) as Record<string, unknown>;
    const existing = (serialized.data?.reservationLetter ?? null) as
      | Record<string, unknown>
      | null;
    if (!existing || typeof existing !== "object") {
      serialized.data = {
        ...serialized.data,
        reservationLetter: {
          tenantPhone: String(snap.tenantPhone ?? ""),
          tenantId: String(snap.tenantIdNumber ?? ""),
          tenantNationality: String(snap.tenantNationality ?? ""),
          landlordName: String(snap.ownerName ?? ""),
          landlordPhone: String(snap.ownerPhone ?? ""),
          landlordId: String(snap.ownerIdNumber ?? ""),
          agentName: String(snap.agentName ?? ""),
          agentPhone: String(snap.agentPhone ?? ""),
          address: String(snap.propertyAddress ?? ""),
          payee: String(snap.ownerName ?? ""),
          landlordSignName: String(snap.ownerName ?? ""),
          agentSignName: String(snap.agentName ?? ""),
        },
      };
    }
    return serialized;
  }
  private leasePreviewInput(c: LeaseContractEntity): LeaseAgreementInput {
    const saved = (c.data?.leaseAgreement ?? null) as LeaseAgreementInput | null;
    if (!saved) throw new BadRequestException("ไม่พบข้อมูลฟอร์มสัญญาเช่า");
    return {
      ...saved,
      documentNo: saved.documentNo || c.contract_no || `LS-${c.id}`,
      landlordSignName: saved.landlordName || saved.landlordSignName || "",
      tenantSignName: saved.tenantName || saved.tenantSignName || "",
      witnessSignName: saved.witnessSignName || saved.agentContact || "",
      landlordSignaturePng: "",
      tenantSignaturePng: "",
    };
  }
  private renewalPreviewInput(c: LeaseContractEntity): LeaseRenewalInput {
    const saved = (c.data?.leaseRenewal ?? null) as LeaseRenewalInput | null;
    if (!saved) throw new BadRequestException("ไม่พบข้อมูลหนังสือต่อสัญญา");
    return {
      ...saved,
      documentNo: saved.documentNo || c.contract_no || `RN-${c.id}`,
      landlordSignName: saved.landlordSignName || saved.landlordName || "",
      tenantSignName: saved.tenantSignName || saved.tenantName || "",
      landlordSignaturePng: "",
      tenantSignaturePng: "",
    };
  }
  private brokerPreviewInput(c: LeaseContractEntity): BrokerAppointmentInput {
    const saved = (c.data?.brokerAppointment ?? null) as
      | BrokerAppointmentInput
      | null;
    if (!saved)
      throw new BadRequestException("ไม่พบข้อมูลฟอร์มแต่งตั้งนายหน้า");
    return {
      ...saved,
      documentNo: saved.documentNo || c.contract_no || `BA-${c.id}`,
      landlordSignName: saved.landlordName || saved.landlordSignName || "",
      brokerSignName: saved.brokerSignName || saved.brokerContact || "",
      landlordSignaturePng: "",
      brokerSignaturePng: "",
    };
  }
  async listOwnedRooms(userId: number) {
    const rooms = await this.db.getRepository(RentRoomEntity).find({
      where: { owner_id: userId },
      relations: { property: true },
      order: { id: "ASC" },
    });
    return rooms.map((room) => ({
      property:
        room.property?.name?.trim() ||
        room.listing_title?.trim() ||
        "ไม่ระบุโครงการ",
      room: room.room_id?.trim() || null,
    }));
  }
  async listForUser(userId: number) {
    const rows = await this.inboxQuery()
      .andWhere(
        `((tenant.user_id = :userId AND c.tenant_delivered_at IS NOT NULL) OR (c.owner_user_id = :userId AND c.owner_delivered_at IS NOT NULL))`,
        { userId },
      )
      .orderBy("c.id", "DESC")
      .getMany();
    const signed = await this.signedFor(rows);
    const today = bangkokToday();
    return rows.map((row) => ({
      ...this.forParty(this.serialize(row, signed), this.partiesFor(userId, row)),
      myParties: this.partiesFor(userId, row),
      nextRentBill:
        row.status === "active" &&
        ["lease", "renewal"].includes(
          row.template?.form_kind ?? row.agreement_type?.form_kind ?? "lease",
        )
          ? upcomingRentPeriod(row, today)
          : null,
    }));
  }
  async signAsParty(userId: number, id: number, input: unknown) {
    const c = await this.inboxQuery().andWhere("c.id = :id", { id }).getOne();
    if (!c || !this.partiesFor(userId, c).length)
      throw new NotFoundException("ไม่พบสัญญา");
    const party = this.shareParty(input);
    if (!this.partiesFor(userId, c).includes(party))
      throw new BadRequestException("ลงนามได้เฉพาะฝ่ายของคุณ");
    this.assertDocumentMutable(c);
    await this.assertReservationAppointment(c);
    if (CLOSED_STATUSES.includes(c.status as (typeof CLOSED_STATUSES)[number]))
      throw new BadRequestException("สัญญานี้ไม่สามารถลงนามได้");
    if (c[SIGN_COLUMNS[party].at])
      throw new BadRequestException("ฝ่ายนี้ลงนามแล้ว");
    this.assertReservationPaidForSigning(c, [party]);
    if (this.attachments)
      await this.attachments.assertReadyForSubject(c, party);
    const { png } = await validateSign({
      parties: [party],
      signaturePng:
        input &&
        typeof input === "object" &&
        !Array.isArray(input) &&
        typeof (input as { signaturePng?: unknown }).signaturePng === "string"
          ? (input as { signaturePng: string }).signaturePng
          : "",
    });
    if (!this.documents)
      throw new ServiceUnavailableException("ยังไม่ได้ตั้งค่าที่เก็บเอกสารสัญญา");
    const stored = await this.documents.uploadSignature(
      c.created_by_user_id,
      c.id,
      { buffer: png, size: png.length },
    );
    const now = new Date();
    const patch: {
      owner_signed_at?: Date;
      tenant_signed_at?: Date;
      owner_signature_url?: string;
      tenant_signature_url?: string;
      status?: LeaseContractEntity["status"];
    } = {
      [SIGN_COLUMNS[party].at]: now,
      [SIGN_COLUMNS[party].url]: stored.path,
    };
    const ownerAt = party === "owner" ? now : c.owner_signed_at;
    const tenantAt = party === "tenant" ? now : c.tenant_signed_at;
    const agentAt = c.agent_signed_at;
    if (c.status === "draft" || c.status === "awaiting_signatures") {
      const formKind =
        c.template?.form_kind ?? c.agreement_type?.form_kind ?? "lease";
      const complete =
        formKind === "broker_appointment"
          ? !!(ownerAt && agentAt)
          : formKind === "lease" || formKind === "renewal"
            ? !!(ownerAt && tenantAt)
            : !!(ownerAt && tenantAt && agentAt);
      patch.status = complete ? "awaiting_agent_review" : "awaiting_signatures";
    }
    try {
      await this.db.transaction(async (manager) => {
        const result = await manager.update(
          LeaseContractEntity,
          {
            id: c.id,
            status: c.status,
            receipt_url: c.receipt_url ?? IsNull(),
            data: Raw((alias) => `${alias} = :expectedData`, {
              expectedData: JSON.stringify(c.data ?? {}),
            }),
          },
          patch,
        );
        if (result.affected !== 1)
          throw new ConflictException("สัญญาถูกเปลี่ยนแล้ว กรุณาเปิดใหม่ก่อนลงนาม");
        // D17: the party signed in their own app.
        await this.recordSignatures(manager, [{
          agreement_id: c.id, party, channel: "app", signed_by_user_id: userId, signature_url: stored.path, signed_at: now,
        }]);
      });
    } catch (error) {
      await this.documents.remove(stored.path).catch(() => undefined);
      // D17: one live signature per party; a second signature that raced in is the same answer as "already signed".
      if ((error as { code?: string }).code === "23505") throw new BadRequestException("ฝ่ายนี้ลงนามแล้ว");
      if ((error as { code?: string }).code === "23514")
        throw new BadRequestException("กรุณาแนบเอกสารของคุณให้ครบก่อนลงนาม");
      throw error;
    }
    const latest = await this.inboxQuery().andWhere("c.id = :id", { id }).getOne();
    return {
      ...this.forParty(this.serialize(latest ?? c, await this.signedFor([latest ?? c])), this.partiesFor(userId, latest ?? c)),
      myParties: this.partiesFor(userId, latest ?? c),
    };
  }
  async candidates(agentId: number) {
    const leads = await this.db
      .getRepository(LeadEntity)
      .createQueryBuilder("lead")
      .innerJoinAndSelect("lead.tenant", "tenant")
      .innerJoinAndSelect("lead.rent_room", "room")
      .leftJoinAndSelect("room.property", "property")
      .where("lead.created_by_user_id = :agentId", { agentId })
      .andWhere("lead.status = :status", { status: "booked" })
      .andWhere("lead.booking_released_at IS NULL")
      .andWhere(
        "tenant.lead_id = lead.id AND tenant.created_by_user_id = :agentId",
        { agentId },
      )
      .andWhere("room.created_by_user_id = :agentId", { agentId })
      .orderBy("lead.id", "DESC")
      .getMany();
    // D1: the reservation picker only offers leads whose room + tenant has a valid broker appointment.
    const appointments = await this.activeBrokerAppointments(agentId, {
      roomIds: [...new Set(leads.map((l) => l.rent_room!.id))],
      tenantIds: leads.map((l) => l.tenant!.id),
    });
    return leads.map((l) => ({
      leadId: l.id,
      tenant: l.tenant!.name,
      property:
        l.rent_room!.property?.name ||
        l.rent_room!.listing_title ||
        "ไม่ระบุโครงการ",
      room: l.rent_room!.room_id,
      rentRoomId: l.rent_room!.id,
      brokerAppointmentReady: appointments.has(brokerAppointmentKey(l.rent_room!.id, l.tenant!.id)),
    }));
  }

  async searchOwnerUsers(query: string) {
    const q = query.trim();
    if (!q || q.length > 80) return [];
    const like = `%${q.replace(/[%_\\]/g, "")}%`;
    const rows: Array<{
      id: number;
      email: string;
      phone: string | null;
      first_name: string;
      last_name: string;
      identity_number: string | null;
      nationality: string | null;
    }> = await this.db.query(
      `
      SELECT u.id, u.email, u.phone, u.first_name, u.last_name,
             u.identity_number, u.nationality
      FROM users u
      INNER JOIN user_roles ur ON ur.user_id = u.id
      INNER JOIN master_roles r ON r.id = ur.role_id
      WHERE r.name = 'landlord'
        AND (
          u.email ILIKE $1
          OR COALESCE(u.phone, '') ILIKE $1
          OR u.first_name ILIKE $1
          OR u.last_name ILIKE $1
          OR (u.first_name || ' ' || u.last_name) ILIKE $1
          OR COALESCE(u.identity_number, '') ILIKE $1
        )
      ORDER BY u.first_name ASC, u.id ASC
      LIMIT 15
      `,
      [like],
    );
    return rows.map((row) => ({
      id: row.id,
      name: `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim(),
      firstName: row.first_name ?? "",
      lastName: row.last_name ?? "",
      email: row.email,
      phone: row.phone ?? "",
      identityNumber: row.identity_number ?? "",
      nationality: row.nationality ?? "",
    }));
  }

  async reservationDefaults(
    agentId: number,
    leadId: number,
  ): Promise<ReservationLetterInput> {
    const lead = await this.db.getRepository(LeadEntity).findOne({
      where: { id: leadId, created_by_user_id: agentId },
      relations: {
        tenant: true,
        rent_room: { property: true },
      },
    });
    if (!lead?.tenant || !lead.rent_room)
      throw new NotFoundException("ไม่พบผู้เช่าสำหรับดึงข้อมูลตั้งต้น");
    const room = lead.rent_room;
    const tenant = lead.tenant;
    const property = room.property;
    const owner = room.property_owner_id
      ? await this.db
          .getRepository(PropertyOwnerEntity)
          .findOneBy({ id: room.property_owner_id, created_by_user_id: agentId })
      : null;
    const ownerUser = room.owner_id
      ? await this.db.getRepository(UserEntity).findOneBy({ id: room.owner_id })
      : null;
    const roomContacts = await this.db.getRepository(RentRoomContactEntity).find({
      where: { rent_room_id: room.id },
      relations: { contact: true },
    });
    const roomContact =
      roomContacts.find((link) => link.is_primary)?.contact ??
      roomContacts[0]?.contact ??
      null;
    const firstText = (...values: Array<string | null | undefined>) => {
      for (const value of values) {
        const text = value?.trim();
        if (text) return text;
      }
      return "";
    };
    const agent = await this.db.getRepository(UserEntity).findOneBy({
      id: agentId,
    });
    const address = property
      ? [
          property.address,
          property.subdistrict,
          property.district,
          property.province,
          property.postal_code,
        ]
          .filter((part) => part && part !== "-")
          .join(" ")
      : "";
    const landlordName = firstText(
      owner?.name,
      ownerUser
        ? `${ownerUser.first_name ?? ""} ${ownerUser.last_name ?? ""}`
        : "",
      roomContact?.name,
    );
    const agentName = agent
      ? `${agent.first_name ?? ""} ${agent.last_name ?? ""}`.trim()
      : "";
    const ownerFull = ownerUser
      ? `${ownerUser.first_name ?? ""} ${ownerUser.last_name ?? ""}`.trim()
      : "";
    const landlordIsUser = Boolean(ownerFull) && landlordName === ownerFull;
    // D2: the terms the landlord confirmed replace the room's numbers.
    const offer = await confirmedOffer(this.db, lead.id, room.id);
    const letter: ReservationLetterInput = {
      ...emptyReservationLetter(),
      issueDate: bangkokDate(),
      ...reservationTenantFields(tenant),
      landlordName,
      landlordFirstName: landlordIsUser ? ownerUser?.first_name ?? "" : "",
      landlordLastName: landlordIsUser ? ownerUser?.last_name ?? "" : "",
      landlordPhone: firstText(owner?.phone, ownerUser?.phone, roomContact?.phone),
      landlordEmail: firstText(owner?.email, ownerUser?.email, roomContact?.email),
      landlordId: firstText(
        room.owner_identity_number,
        landlordIsUser ? ownerUser?.identity_number : "",
      ),
      landlordNationality: landlordIsUser ? ownerUser?.nationality ?? "" : "",
      agentName,
      agentPhone: agent?.phone ?? "",
      project: property?.name || room.listing_title || "",
      address,
      unitNo: room.room_id ?? "",
      advanceMonths:
        room.advance_rent_months != null
          ? String(room.advance_rent_months)
          : "",
      depositMonths:
        room.deposit_months != null ? String(room.deposit_months) : "",
      bankAccount: [room.owner_bank_name, room.owner_bank_account]
        .filter(Boolean)
        .join(" "),
      payee: landlordName,
      tenantSignName: tenant.name ?? "",
      landlordSignName: landlordName,
      agentSignName: agentName,
    };
    return offer ? { ...letter, ...offerReservationFields(offer) } : letter;
  }

  /** D2: the offer the landlord confirmed for the lead's room, which fixes the numbers of its letter and lease. */
  private async leadOffer(agentId: number, leadId: number) {
    const lead = await this.db.getRepository(LeadEntity).findOneBy({ id: leadId, created_by_user_id: agentId });
    return confirmedOffer(this.db, lead?.id, lead?.rent_room_id);
  }

  /** D14 (AC-3.8): an offer naming another agent needs the signed co-broke file before the letter is issued. */
  private async assertReservationCoBroke(c: LeaseContractEntity) {
    if ((await confirmedOffer(this.db, c.lead_id, c.rent_room_id))?.co_broke && !(await hasCoBrokeFile(this.db, c.id)))
      throw new BadRequestException({ code: "CO_BROKE_REQUIRED", message: CO_BROKE_REQUIRED });
  }

  async brokerAppointmentDefaults(
    agentId: number,
    leadId: number,
  ): Promise<BrokerAppointmentInput> {
    const base = await this.reservationDefaults(agentId, leadId);
    const lead = await this.db.getRepository(LeadEntity).findOne({
      where: { id: leadId, created_by_user_id: agentId },
      relations: { rent_room: { price_rows: { contract_type: true } } },
    });
    const { monthlyRent, leaseMonths } = pickBrokerRentFromRoom(
      lead?.rent_room,
      lead?.lease_duration_months,
    );
    const propertyLine = [
      base.project,
      base.unitNo ? `ห้อง ${base.unitNo}` : "",
      base.address,
    ]
      .filter(Boolean)
      .join(" · ");
    return {
      documentNo: "",
      issueDate: base.issueDate,
      landlordName: base.landlordName,
      landlordFirstName: base.landlordFirstName,
      landlordLastName: base.landlordLastName,
      landlordNationality: "",
      landlordId: base.landlordId,
      landlordAddress: base.address,
      landlordPhone: base.landlordPhone,
      brokerCompany: "NESTYK",
      brokerContact: base.agentName,
      brokerNationality: "ไทย",
      brokerId: "",
      brokerPhone: base.agentPhone,
      brokerAddress: "",
      propertyLine,
      monthlyRent,
      leaseMonths,
      commissionFee: "",
      commissionMonths: "",
      landlordSignName: base.landlordSignName,
      brokerSignName: base.agentSignName,
      landlordSignaturePng: "",
      brokerSignaturePng: "",
    };
  }

  async leaseDefaults(
    agentId: number,
    leadId: number,
  ): Promise<LeaseAgreementInput> {
    const base = await this.reservationDefaults(agentId, leadId);
    const lead = await this.db.getRepository(LeadEntity).findOne({
      where: { id: leadId, created_by_user_id: agentId },
      relations: {
        tenant: true,
        rent_room: {
          price_rows: { contract_type: true },
          property: { property_type: true },
          room_type: true,
          layout_values: { layout: true },
        },
      },
    });
    const room = lead?.rent_room;
    const tenant = lead?.tenant;
    const property = room?.property;
    const defaults = pickLeaseRentFromRoom(room, lead?.lease_duration_months);
    const reservations = await this.query(agentId).andWhere('c.lead_id = :leadId', { leadId })
      .andWhere("COALESCE(template.form_kind, agreementType.form_kind) = 'reservation'")
      .andWhere("c.status NOT IN ('cancelled', 'expired', 'terminated')")
      .orderBy('c.id', 'DESC').getMany();
    const booked = reservations.find(reservationLetterFinalized);
    const letter = booked?.data?.reservationLetter as Partial<ReservationLetterInput> | undefined;
    const moneyText = (value: unknown, fallback: string) => {
      const amount = Number(typeof value === 'string' ? value.replace(/,/g, '') : value);
      return value != null && value !== '' && Number.isFinite(amount) && amount >= 0 ? String(amount) : fallback;
    };
    const monthlyRent = moneyText(booked?.monthly_rent ?? letter?.monthlyRent, defaults.monthlyRent);
    const termMonths = letter?.termMonths || defaults.termMonths;
    const advanceMonths = letter?.advanceMonths || defaults.advanceMonths;
    const depositMonths = letter?.depositMonths || defaults.depositMonths;
    const bookedMoveIn = asIsoDate(booked?.move_in_date), plannedMoveIn = asIsoDate(lead?.move_in_plan);
    const termFrom = isIsoDate(bookedMoveIn) ? bookedMoveIn : isIsoDate(plannedMoveIn) ? plannedMoveIn : base.issueDate;
    const rentNum = Number(String(monthlyRent).replace(/,/g, ""));
    const advanceNum =
      Number.isFinite(rentNum) && advanceMonths
        ? rentNum * Number(advanceMonths)
        : advanceMonths === '0' ? 0 : NaN;
    const depositNum =
      Number.isFinite(rentNum) && depositMonths
        ? rentNum * Number(depositMonths)
        : depositMonths === '0' ? 0 : NaN;
    const months = Number(termMonths);
    const termTo =
      /^\d{4}-\d{2}-\d{2}$/.test(termFrom) &&
      Number.isInteger(months) &&
      months > 0
        ? leaseTermEnd(termFrom, months)
        : "";
    const floor =
      room?.layout_values?.find((row) => row.layout?.code === "floor")
        ?.value ??
      "";
    const area =
      room?.layout_values?.find((row) => row.layout?.code === "area_sqm")
        ?.value ??
      room?.layout_values?.find((row) => row.layout?.code === "area")?.value ??
      "";
    const agentContact = [base.agentName, base.agentPhone, "NESTYK"]
      .filter(Boolean)
      .join(" · ");
    const offer = await confirmedOffer(this.db, lead?.id, room?.id);
    const lease: LeaseAgreementInput = {
      ...emptyLeaseAgreement(),
      issueDate: base.issueDate,
      landlordName: base.landlordName,
      landlordFirstName: base.landlordFirstName,
      landlordLastName: base.landlordLastName,
      landlordId: base.landlordId,
      landlordAddress: base.address,
      landlordPhone: base.landlordPhone,
      tenantName: base.tenantName,
      tenantFirstName: base.tenantFirstName,
      tenantLastName: base.tenantLastName,
      tenantNationality: base.tenantNationality,
      tenantId: base.tenantId,
      tenantPhone: base.tenantPhone,
      tenantEmail: tenant?.email ?? "",
      propertyType: property?.property_type?.code ?? "",
      project: base.project,
      houseNo: base.unitNo,
      propertyAddress: base.address,
      roomType: room?.room_type?.code ?? "",
      floor,
      area,
      termMonths,
      termFrom,
      termTo,
      monthlyRent,
      advanceMonths,
      advanceAmount: moneyText(letter?.advanceAmount, Number.isFinite(advanceNum) ? String(advanceNum) : ""),
      depositMonths,
      depositAmount: moneyText(booked?.deposit ?? letter?.depositAmount, Number.isFinite(depositNum) ? String(depositNum) : ""),
      bankName: room?.owner_bank_name ?? "",
      accountName: base.landlordName,
      accountNo: room?.owner_bank_account ?? "",
      agentContact,
      landlordSignName: base.landlordName,
      tenantSignName: base.tenantName,
      witnessSignName: base.agentName,
    };
    // D2: the due day, grace day and late fee come only from the offer; the other numbers replace the letter's.
    // The contract date only starts the lease's date: the signing may move, so the agent can change it.
    return offer ? { ...lease, ...offerLeaseFields(offer), issueDate: String(offer.contract_date).slice(0, 10) } : lease;
  }

  private assertDraft(c: LeaseContractEntity) {
    if (c.status !== "draft" || c.owner_signed_at || c.tenant_signed_at || c.agent_signed_at ||
        c.owner_signature_url || c.tenant_signature_url || c.agent_signature_url)
      throw new BadRequestException("แก้ไขหรือยกเลิกได้เฉพาะฉบับร่างที่ยังไม่มีผู้ลงนาม");
    if ((c.data?.reservationPayment as { slipPath?: string } | undefined)?.slipPath || c.receipt_url)
      throw new BadRequestException("มีหลักฐานชำระเงินหรือใบเสร็จแล้ว ไม่สามารถแก้ไขหรือยกเลิกฉบับร่างได้");
    this.assertDocumentMutable(c);
  }

  async draftTemplate(agentId: number, id: number) {
    const c = await this.query(agentId).andWhere("c.id = :id", { id }).getOne();
    if (!c) throw new NotFoundException("ไม่พบสัญญา");
    this.assertDraft(c);
    const t = c.template;
    if (!t) throw new BadRequestException("ไม่พบแม่แบบสัญญา");
    return { id: t.id, agreementTypeCode: t.agreement_type_code, version: t.version,
      name: t.name, formKind: t.form_kind, dataSchema: t.data_schema };
  }

  /**
   * C1: save an edited tenant and bring that tenant's untouched drafts up to date in one transaction.
   * Untouched means the same rule as editing a draft by hand (assertDraft): no signature, slip, receipt
   * or generated document. A reservation draft's booking invoice is rebuilt with the same number and
   * date, as saveDraft does, so the invoice and a later receipt show the new details. Drafts whose
   * details are already current are not written, and unused sign links of changed drafts are revoked.
   */
  async saveTenantAndRefreshDrafts(agentId: number, tenant: TenantEntity): Promise<number[]> {
    const stored: string[] = [];
    const replaced: string[] = [];
    const updated = await this.db
      .transaction(async (manager) => {
        await manager.getRepository(TenantEntity).save(tenant);
        const drafts = await manager.find(LeaseContractEntity, {
          where: { tenant_id: tenant.id, created_by_user_id: agentId, status: "draft" },
          lock: { mode: "pessimistic_write" },
        });
        const ids: number[] = [];
        for (const draft of drafts) {
          try {
            this.assertDraft(draft);
          } catch (error) {
            // A draft that may no longer be edited is skipped; anything else is a real failure.
            if (error instanceof BadRequestException) continue;
            throw error;
          }
          const patch = tenantDraftPatch(draft, tenant);
          if (!patch) continue;
          const update: Record<string, unknown> = { ...patch };
          const previousFinancial = patch.data.financialDocuments as
            | { invoice?: FinancialDocumentInput }
            | undefined;
          if (previousFinancial?.invoice) {
            // Without document storage the invoice cannot be rebuilt; leave the whole draft as it is.
            if (!this.documents) continue;
            const invoice = reservationInvoice({ ...draft, ...patch } as LeaseContractEntity);
            let file: { path: string };
            try {
              const pdf = await createFinancialPdf("invoice", invoice);
              file = await this.documents.upload(agentId, draft.id, "invoice", { buffer: pdf, size: pdf.length });
            } catch {
              throw new ServiceUnavailableException(
                "บันทึกข้อมูลผู้เช่าไม่สำเร็จ เพราะสร้างใบแจ้งหนี้ค่าจองใหม่ไม่ได้ ข้อมูลผู้เช่ายังไม่ถูกแก้ กรุณาลองอีกครั้ง",
              );
            }
            stored.push(file.path);
            if (draft.invoice_url && draft.invoice_url !== file.path) replaced.push(draft.invoice_url);
            update.invoice_url = file.path;
            update.data = { ...patch.data, financialDocuments: { ...previousFinancial, invoice } };
          }
          await manager.update(
            LeaseContractEntity,
            { id: draft.id, created_by_user_id: agentId },
            update as QueryDeepPartialEntity<LeaseContractEntity>,
          );
          await this.revokeDraftInvites(manager, draft.id);
          ids.push(draft.id);
        }
        return ids;
      })
      .catch(async (error) => {
        for (const path of stored) await this.documents?.remove(path).catch(() => undefined);
        throw error;
      });
    for (const path of replaced) await this.documents?.remove(path).catch(() => undefined);
    return updated;
  }

  private async revokeDraftInvites(manager: EntityManager, id: number) {
    await manager.update(AgreementSignInviteEntity,
      { agreement_id: id, used_at: IsNull(), revoked_at: IsNull() },
      { revoked_at: new Date() });
  }

  endReasons() {
    return contractEndReasons(this.db);
  }

  async close(agentId: number, id: number, input: unknown) {
    const billing = await closeLeaseContract(this.db, agentId, id, input);
    return { contract: await this.view(agentId, id), billing };
  }

  /** D5 (AC-C.1 to C.4): what cancelling the deal of this booking letter or lease would close, and the money so far. */
  dealCancellationPreview(agentId: number, id: number) {
    return dealCancellationPreview(this.db, agentId, id);
  }
  /** D5: cancel the deal before the handover, with who caused it, a reason and evidence files. */
  async cancelDeal(agentId: number, id: number, input: unknown, files: Array<{ buffer: Buffer; size: number; originalname?: string }> | undefined) {
    await cancelDeal(this.db, this.documents, agentId, id, input, files);
    return this.view(agentId, id);
  }
  /** D5 (AC-C.2, C.3): the refund to the tenant, recorded once with its proof. */
  async recordDealRefund(agentId: number, id: number, input: unknown, file: { buffer: Buffer; size: number; originalname?: string } | undefined) {
    await recordDealRefund(this.db, this.documents, agentId, id, input, file);
    return this.view(agentId, id);
  }

  async cancelDraft(agentId: number, id: number, input: unknown) {
    const reason = input && typeof input === "object" ? (input as { reason?: unknown }).reason : null;
    if (typeof reason !== "string" || !reason.trim() || reason.trim().length > 1000)
      throw new BadRequestException("กรุณาระบุเหตุผลยกเลิกไม่เกิน 1,000 ตัวอักษร");
    const initial = await this.db.getRepository(LeaseContractEntity).findOneBy({ id, created_by_user_id: agentId });
    if (!initial) throw new NotFoundException('ไม่พบสัญญา');
    await this.db.transaction(async manager => {
      const lead = await manager.findOne(LeadEntity, { where: { id: initial.lead_id, created_by_user_id: agentId }, lock: { mode: 'pessimistic_write' } });
      const room = await manager.findOne(RentRoomEntity, { where: { id: initial.rent_room_id, created_by_user_id: agentId }, lock: { mode: 'pessimistic_write' } });
      const c = await manager.findOne(LeaseContractEntity, {
        where: { id, created_by_user_id: agentId }, lock: { mode: "pessimistic_write" },
      });
      if (!c || !lead || !room) throw new NotFoundException("ไม่พบสัญญา");
      if (c.lead_id !== initial.lead_id || c.rent_room_id !== initial.rent_room_id) throw new ConflictException('ข้อมูลสัญญาถูกเปลี่ยนแล้ว กรุณาเปิดใหม่');
      this.assertDraft(c);
      const endReason = await manager.findOneBy(MasterContractEndReasonEntity, {
        code: "draft_cancelled", is_active: true,
      });
      if (!endReason) throw new BadRequestException("ไม่พบเหตุผลยกเลิกฉบับร่างที่เปิดใช้งาน");
      const cancelledAt = new Date();
      await manager.update(LeaseContractEntity, { id }, {
        status: "cancelled",
        end_reason_id: endReason.id,
        end_reason_note: reason.trim(),
        effective_end_date: bangkokToday(cancelledAt),
        end_recorded_at: cancelledAt,
        end_recorded_by_user_id: agentId,
        data: { ...c.data, draftCancellation: { reason: reason.trim(), at: cancelledAt.toISOString(), by: agentId } },
      });
      await this.revokeDraftInvites(manager, id);
      const template = c.template_id == null ? null : await manager.findOneBy(AgreementTemplateEntity, { id: c.template_id });
      const formKind = template?.form_kind ?? (c.agreement_type_code
        ? (await manager.findOneBy(MasterAgreementTypeEntity, { code: c.agreement_type_code }))?.form_kind : undefined);
      const remaining = await manager.getRepository(LeaseContractEntity).createQueryBuilder('other')
        .leftJoin('other.template', 'template').leftJoin('other.agreement_type', 'agreementType')
        .where('other.lead_id = :leadId AND other.rent_room_id = :roomId', { leadId: c.lead_id, roomId: c.rent_room_id })
        .andWhere('other.id <> :id', { id })
        // A predecessor's booking letter is historical when cancelling its renewal.
        // An active predecessor still holds the room through the lease/renewal branches.
        .andWhere('COALESCE(template.form_kind, agreementType.form_kind) IN (:...rentalForms)', {
          rentalForms: c.previous_agreement_id ? ['lease', 'renewal'] : ['reservation', 'lease', 'renewal'],
        })
        .andWhere("other.status NOT IN ('cancelled', 'expired', 'terminated')").getCount();
      if (formKind && ['reservation', 'lease', 'renewal'].includes(formKind) && !remaining && lead.status === 'booked' && lead.rent_room_id === c.rent_room_id && lead.tenant_id === c.tenant_id) {
        await manager.update(LeadEntity, { id: lead.id }, { booking_released_at: cancelledAt });
        if (c.room_tenancy_id) await manager.update(RoomTenancyEntity, { id: c.room_tenancy_id, created_by_user_id: agentId, status: 'prospect' }, { status: 'moved_out' });
      }
    });
    return this.view(agentId, id);
  }

  async updateDraft(agentId: number, id: number, input: unknown) {
    return this.saveDraft(agentId, input, id);
  }

  async create(agentId: number, input: unknown) {
    return this.saveDraft(agentId, input);
  }

  private async saveDraft(agentId: number, input: unknown, editingId?: number) {
    if (!input || typeof input !== "object" || Array.isArray(input))
      throw new BadRequestException("กรุณาระบุข้อมูลสัญญา");
    const existing = editingId == null ? null : await this.db.getRepository(LeaseContractEntity)
      .findOneBy({ id: editingId, created_by_user_id: agentId });
    if (editingId != null && !existing) throw new NotFoundException("ไม่พบสัญญา");
    if (existing) {
      this.assertDraft(existing);
      const body = input as Record<string, unknown>;
      if ((body.expectedDraftRevision ?? null) !== (existing.data?.draftRevision ?? null))
        throw new ConflictException("ฉบับร่างถูกแก้ไขแล้ว กรุณาเปิดใหม่ก่อนบันทึก");
      if (body.leadId !== existing.lead_id || body.agreementTypeCode !== existing.agreement_type_code ||
          (body.templateId != null && body.templateId !== existing.template_id) ||
          (body.previousAgreementId != null && body.previousAgreementId !== existing.previous_agreement_id))
        throw new BadRequestException("ไม่สามารถเปลี่ยนผู้เช่า ห้อง ประเภท หรือแม่แบบของฉบับร่างเดิม");
      input = { ...body, templateId: existing.template_id, previousAgreementId: existing.previous_agreement_id };
    }
    const code =
      input && typeof input === "object"
        ? ((input as Record<string, unknown>).agreementTypeCode ?? "lease")
        : "lease";
    if (typeof code !== "string" || !code || code.length > 64)
      throw new BadRequestException("กรุณาเลือกประเภทสัญญา");
    const type = await this.db
      .getRepository(MasterAgreementTypeEntity)
      .findOneBy({ code, ...(!existing ? { is_active: true } : {}) });
    if (
      !type ||
      !["lease", "reservation", "broker_appointment", "renewal"].includes(
        type.form_kind,
      )
    )
      throw new BadRequestException("ประเภทสัญญานี้ยังไม่เปิดใช้งาน");
    const raw = input as Record<string, unknown>;
    for (const key of ["templateId", "previousAgreementId"]) {
      if (
        raw[key] != null &&
        (!Number.isSafeInteger(raw[key]) ||
          Number(raw[key]) < 1 ||
          Number(raw[key]) > 2147483647)
      )
        throw new BadRequestException("รหัสแม่แบบหรือสัญญาอ้างอิงไม่ถูกต้อง");
    }
    const template = await this.db
      .getRepository(AgreementTemplateEntity)
      .findOne({
        where: {
          agreement_type_code: code,
          ...(!existing ? { is_active: true } : {}),
          ...(raw.templateId != null ? { id: Number(raw.templateId) } : {}),
        },
        order: { version: "DESC" },
      });
    if (!template || template.form_kind !== type.form_kind)
      throw new BadRequestException("ไม่พบแม่แบบสัญญาที่เปิดใช้งาน");
    let b = validateContract(input, template.form_kind);
    const needsAppointment = template.form_kind === "reservation" && !existing;
    if (needsAppointment) {
      // D1: the agent must be appointed for the room before booking it. A draft saved before this rule keeps working.
      // Checked here, before the letter creates any login, and again inside the transaction with the lead locked
      // (that narrows the window; the appointment row itself is not locked, and only this agent can close it).
      const lead = await this.db.getRepository(LeadEntity).findOneBy({ id: b.leadId, created_by_user_id: agentId });
      if (!lead) throw new NotFoundException("ไม่พบผู้เช่า");
      // A lead without a room or tenant is refused inside the transaction (and reservationDefaults 404s before any login).
      if (lead.rent_room_id != null && lead.tenant_id != null && !(await this.hasBrokerAppointment(agentId, lead.rent_room_id, lead.tenant_id)))
        throw new BadRequestException({ code: "BROKER_APPOINTMENT_REQUIRED", message: BROKER_APPOINTMENT_REQUIRED });
    }
    const rawData =
      raw.data && typeof raw.data === "object" && !Array.isArray(raw.data)
        ? { ...(raw.data as Record<string, unknown>) }
        : {};
    for (const key of ["financialDocuments", "reservationPayment", "documentFileNames", "draftRevision", "draftCancellation"])
      if (key in rawData)
        throw new BadRequestException("ไม่สามารถกำหนดข้อมูลเอกสารการเงินหรือสถานะระบบเองได้");
    let reservationLetter: ReservationLetterInput | undefined;
    let brokerAppointment: BrokerAppointmentInput | undefined;
    let leaseAgreement: LeaseAgreementInput | undefined;
    let leaseRenewal: LeaseRenewalInput | undefined;
    // D2 (AC-2.4): with an offer the landlord confirmed, its numbers are the letter's and the lease's whatever was typed.
    const offer = ["reservation", "lease"].includes(type.form_kind) ? await this.leadOffer(agentId, b.leadId) : null;
    // The booking invoice and the move-in date follow the offer too (AC-3.3), with or without the letter's fields.
    if (offer && type.form_kind === "reservation")
      b = { ...b, reservationFee: Number(offer.monthly_rent), moveInDate: String(offer.start_date).slice(0, 10) };
    if (type.form_kind === "reservation" && rawData.reservationLetter != null) {
      const savedLetter = existing?.data?.reservationLetter as
        | ReservationLetterInput
        | undefined;
      const pulled = await this.reservationDefaults(agentId, b.leadId);
      const stamped = stampReservationDocumentHeader(
        rawData.reservationLetter,
        savedLetter,
      );
      if (stamped && typeof stamped === "object" && !Array.isArray(stamped)) {
        const letter = stamped as Record<string, unknown>;
        letter.tenantName = pulled.tenantName;
        letter.tenantFirstName = pulled.tenantFirstName;
        letter.tenantLastName = pulled.tenantLastName;
        letter.tenantPhone = pulled.tenantPhone;
        letter.tenantEmail = pulled.tenantEmail;
        letter.tenantId = pulled.tenantId;
        letter.tenantNationality = pulled.tenantNationality;
        if (offer) Object.assign(letter, offerReservationFields(offer));
      }
      reservationLetter = validateReservationLetter(stamped);
      if (Number(reservationLetter.reservationPayment.replace(/,/g, "")) !== b.reservationFee)
        throw new BadRequestException("ยอดเงินจองในหนังสือจองต้องตรงกับยอดใบแจ้งหนี้");
      delete rawData.reservationLetter;
    }
    const reservationParties = reservationLetter
      ? {
          tenantUserId: await ensurePartyLogin(this.db, {
            email: reservationLetter.tenantEmail,
            phone: reservationLetter.tenantPhone,
            firstName: reservationLetter.tenantFirstName,
            lastName: reservationLetter.tenantLastName,
            name: reservationLetter.tenantName,
            identityNumber: reservationLetter.tenantId,
            nationality: reservationLetter.tenantNationality,
            role: "tenant",
            who: "ผู้เช่า",
            tenantLeadId: b.leadId,
          }),
          ownerUserId: await ensurePartyLogin(this.db, {
            email: reservationLetter.landlordEmail,
            phone: reservationLetter.landlordPhone,
            firstName: reservationLetter.landlordFirstName,
            lastName: reservationLetter.landlordLastName,
            name: reservationLetter.landlordName,
            identityNumber: reservationLetter.landlordId,
            nationality: reservationLetter.landlordNationality,
            role: "landlord",
            who: "ผู้ให้เช่า",
          }),
        }
      : null;
    if (type.form_kind === "broker_appointment" && rawData.brokerAppointment != null) {
      brokerAppointment = validateBrokerAppointment(rawData.brokerAppointment);
      delete rawData.brokerAppointment;
    }
    if (type.form_kind === "lease" && rawData.leaseAgreement != null) {
      const typed = rawData.leaseAgreement;
      leaseAgreement = validateLeaseAgreement(
        offer && typed && typeof typed === "object" && !Array.isArray(typed) ? { ...typed, ...offerLeaseFields(offer) } : typed,
      );
      delete rawData.leaseAgreement;
    }
    if (type.form_kind === "renewal" && rawData.leaseRenewal != null) {
      leaseRenewal = validateLeaseRenewal(rawData.leaseRenewal);
      delete rawData.leaseRenewal;
    }
    // Prefer lease form dates/money when the overlay payload is present.
    let contractInput = b;
    if (reservationLetter) {
      const moveIn =
        contractInput.moveInDate &&
        contractInput.moveInDate >= reservationLetter.issueDate
          ? contractInput.moveInDate
          : reservationLetter.issueDate;
      contractInput = {
        ...contractInput,
        startDate: reservationLetter.issueDate,
        moveInDate: moveIn,
      };
    }
    if (leaseAgreement) {
      const rent = Number(String(leaseAgreement.monthlyRent).replace(/,/g, ""));
      const deposit = Number(
        String(leaseAgreement.depositAmount).replace(/,/g, ""),
      );
      contractInput = {
        ...b,
        startDate: leaseAgreement.termFrom || b.startDate,
        endDate: leaseAgreement.termTo || b.endDate,
        monthlyRent: rent,
        deposit: deposit,
      };
    } else if (offer && type.form_kind === "lease") {
      // D2: a lease saved without its form still takes the offer's terms.
      const terms = offerLeaseFields(offer);
      contractInput = {
        ...b,
        startDate: terms.termFrom!,
        endDate: terms.termTo!,
        monthlyRent: Number(offer.monthly_rent),
        deposit: Number(offer.deposit_amount),
      };
    }
    if (leaseRenewal) {
      const rent = Number(String(leaseRenewal.monthlyRent).replace(/,/g, ""));
      const deposit = Number(
        String(leaseRenewal.depositCarried).replace(/,/g, ""),
      );
      contractInput = {
        ...b,
        startDate: leaseRenewal.startDate || b.startDate,
        endDate: leaseRenewal.endDate || b.endDate,
        monthlyRent: rent,
        deposit: deposit,
      };
    }
    // Overlay fields become the persisted terms; validate those exact values too.
    contractInput = validateContract(contractInput, template.form_kind);
    const data = validateAgreementData(
      template.data_schema,
      Object.keys(rawData).length ? rawData : undefined,
      contractInput,
      template.form_kind,
    );
    if (existing) data.draftRevision = randomBytes(16).toString("hex");
    if (reservationLetter) data.reservationLetter = reservationLetter;
    if (brokerAppointment)
      data.brokerAppointment = brokerAppointmentSnapshot(brokerAppointment);
    if (leaseAgreement)
      data.leaseAgreement = leaseAgreementSnapshot(leaseAgreement);
    if (leaseRenewal) data.leaseRenewal = leaseRenewalSnapshot(leaseRenewal);
    // D11: a returned booking slip keeps its reason for the tenant when the draft is edited before a new slip comes.
    const returned = existing?.data?.reservationPayment as { slipPath?: string; returnNote?: string } | undefined;
    if (template.form_kind === "reservation" && returned?.returnNote && !returned.slipPath) data.reservationPayment = returned;
    let storedInvoicePath: string | null = null;
    const id = await this.db.transaction(async (manager) => {
      const lead = await manager.findOne(LeadEntity, {
        where: { id: b.leadId, created_by_user_id: agentId },
        lock: { mode: "pessimistic_write" },
      });
      if (!lead) throw new NotFoundException("ไม่พบผู้เช่า");
      if (lead.status !== "booked" || !lead.tenant_id || !lead.rent_room_id)
        throw new BadRequestException(
          "ต้องจองห้องและสร้างผู้เช่าจาก Lead ก่อนทำสัญญา",
        );
      if (needsAppointment && !(await this.hasBrokerAppointment(agentId, lead.rent_room_id, lead.tenant_id, manager)))
        throw new BadRequestException({ code: "BROKER_APPOINTMENT_REQUIRED", message: BROKER_APPOINTMENT_REQUIRED });
      const tenant = await manager.findOneBy(TenantEntity, {
        id: lead.tenant_id,
        lead_id: lead.id,
        created_by_user_id: agentId,
      });
      const room = await manager.findOne(RentRoomEntity, {
        where: { id: lead.rent_room_id, created_by_user_id: agentId },
        lock: { mode: "pessimistic_write" },
      });
      if (!tenant || !room)
        throw new NotFoundException("ไม่พบผู้เช่าหรือห้องที่คุณมีสิทธิ์จัดการ");
      // D2 round 2: the offer was read before the lead was locked; a change of it meanwhile must not be lost.
      if (offer && (await confirmedOffer(manager, lead.id, room.id))?.revision !== offer.revision)
        throw new ConflictException({ code: "OFFER_CHANGED", message: "ข้อเสนอถูกแก้ระหว่างบันทึก กรุณาเปิดฉบับร่างใหม่" });
      if (lead.booking_released_at) {
        if (!raw.previousAgreementId || existing)
          throw new ConflictException("การจองนี้สิ้นสุดแล้ว ไม่สามารถสร้างหรือแก้ไขฉบับร่างใหม่ได้");
        const taken = await manager.findOne(LeadEntity, {
          where: { rent_room_id: room.id, status: "booked", booking_released_at: IsNull() },
        });
        if (taken && taken.id !== lead.id)
          throw new ConflictException("ห้องนี้มีผู้จองใหม่แล้ว ไม่สามารถต่อสัญญาเดิมได้");
        await manager.update(LeadEntity, { id: lead.id }, { booking_released_at: null });
      }
      if (reservationParties) {
        tenant.user_id = reservationParties.tenantUserId;
        await manager.save(tenant);
        // Scout rooms must keep owner_id empty. The landlord account is stored on the contract.
        if (!room.is_scout_room) {
          room.owner_id = reservationParties.ownerUserId;
          await manager.save(room);
        }
      }
      if (existing) {
        const current = await manager.findOne(LeaseContractEntity, {
          where: { id: existing.id, created_by_user_id: agentId }, lock: { mode: "pessimistic_write" },
        });
        if (!current) throw new NotFoundException("ไม่พบสัญญา");
        this.assertDraft(current);
        if (current.updated_at.getTime() !== existing.updated_at.getTime())
          throw new ConflictException("ฉบับร่างถูกเปลี่ยนแล้ว กรุณาเปิดใหม่");
        if (current.tenant_id !== tenant.id || current.rent_room_id !== room.id)
          throw new ConflictException("ข้อมูลผู้เช่าหรือห้องเปลี่ยนไป กรุณาสร้างฉบับร่างใหม่");
      }
      let previous: LeaseContractEntity | null = null;
      if (raw.previousAgreementId != null) {
        previous = await manager.findOne(LeaseContractEntity, {
          where: {
            id: Number(raw.previousAgreementId),
            created_by_user_id: agentId,
          },
          lock: { mode: "pessimistic_write" },
        });
        if (!previous)
          throw new NotFoundException("ไม่พบสัญญาที่ต้องการต่ออายุ");
        const previousTemplate = await manager.findOneBy(
          AgreementTemplateEntity,
          { id: previous.template_id },
        );
        const sameParties =
          previous.tenant_id === tenant.id &&
          previous.rent_room_id === room.id &&
          previous.lead_id === lead.id;
        const previousKind = previousTemplate?.form_kind;
        const previousEnd = asIsoDate(previous.end_date);
        if (template.form_kind === "renewal") {
          if (!leaseRenewal)
            throw new BadRequestException("ข้อมูลหนังสือต่อสัญญาไม่ครบ");
          if (previousKind !== "lease" && previousKind !== "renewal")
            throw new BadRequestException(
              "ต่อสัญญาได้จากสัญญาเช่าหรือหนังสือต่อสัญญาก่อนหน้าเท่านั้น",
            );
          if (!["active", "expired"].includes(previous.status))
            throw new BadRequestException(
              "ต่อสัญญาได้จากสัญญาที่มีผลหรือหมดอายุแล้วเท่านั้น",
            );
          if (!previousEnd)
            throw new BadRequestException(
              "สัญญาเดิมต้องมีวันสิ้นสุดก่อนต่อสัญญา",
            );
          const nextStart = shiftIsoDate(previousEnd, 1);
          if (contractInput.startDate !== nextStart)
            throw new BadRequestException(
              "สัญญาใหม่ต้องเริ่มวันถัดจากวันที่สัญญาเดิมหมดอายุ",
            );
          const termMonths = Number(leaseRenewal.renewMonths);
          if (
            /^\d{1,3}$/.test(leaseRenewal.renewMonths) &&
            termMonths > 0 &&
            contractInput.endDate !== leaseTermEnd(nextStart, termMonths)
          )
            throw new BadRequestException(
              "วันสิ้นสุดต้องเป็นวันก่อนครบรอบตามจำนวนเดือนที่ต่อ",
            );
          const rootId =
            previous.root_agreement_id && previous.root_agreement_id !== previous.id
              ? previous.root_agreement_id
              : previous.id;
          const root =
            rootId === previous.id
              ? previous
              : await manager.findOne(LeaseContractEntity, {
                  where: { id: rootId, created_by_user_id: agentId },
                  lock: { mode: "pessimistic_write" },
                });
          if (!root)
            throw new NotFoundException("ไม่พบสัญญาเช่าฉบับแรก");
          const rootTemplate =
            root.id === previous.id
              ? previousTemplate
              : await manager.findOneBy(AgreementTemplateEntity, {
                  id: root.template_id,
                });
          if (
            rootTemplate?.form_kind !== "lease" ||
            root.tenant_id !== tenant.id ||
            root.rent_room_id !== room.id
          )
            throw new BadRequestException(
              "ไม่พบสัญญาเช่าฉบับแรกของผู้เช่าและห้องนี้",
            );
          Object.assign(leaseRenewal, firstLeaseFields(root));
          const predecessor = firstLeaseFields(previous);
          leaseRenewal.originalLeaseNo = predecessor.firstLeaseNo;
          leaseRenewal.originalLeaseDate = predecessor.firstLeaseDate;
          leaseRenewal.originalExpiryDate = previousEnd;
          data.leaseRenewal = leaseRenewalSnapshot(leaseRenewal);
        }
        const renewalAddendum =
          template.form_kind === "renewal" &&
          sameParties &&
          (previousKind === "lease" || previousKind === "renewal") &&
          ["active", "expired"].includes(previous.status) &&
          !!previousEnd &&
          contractInput.startDate === shiftIsoDate(previousEnd, 1);
        const fullLeaseRenewal =
          template.form_kind === "lease" &&
          previousKind === "lease" &&
          sameParties &&
          ["active", "expired"].includes(previous.status) &&
          !!previousEnd &&
          contractInput.startDate > previousEnd;
        if (!renewalAddendum && !fullLeaseRenewal)
          throw new BadRequestException(
            template.form_kind === "renewal"
              ? "ต่อสัญญาได้จากสัญญาเช่าหรือหนังสือต่อสัญญาที่มีผลของผู้เช่าและห้องเดิม โดยฉบับใหม่เริ่มวันถัดจากวันสิ้นสุดของฉบับล่าสุด"
              : "ต่ออายุได้เฉพาะสัญญาเช่าที่ใช้งานหรือหมดอายุ ผู้เช่าและห้องเดิม และเริ่มหลังวันสิ้นสุดเดิม",
          );
        // The legacy full-lease route must not bypass the renewal advance window.
        if (bangkokToday() < shiftIsoDate(previousEnd, -RENEWAL_ADVANCE_DAYS))
          throw new BadRequestException(
            "ต่อสัญญาล่วงหน้าได้ไม่เกิน 30 วันก่อนสัญญาเดิมหมดอายุ",
          );
        const successor = await manager
          .getRepository(LeaseContractEntity)
          .createQueryBuilder("c")
          .where("c.previous_agreement_id = :previousId", {
            previousId: previous.id,
          })
          .andWhere("c.status <> 'cancelled'")
          .andWhere("c.id <> :editingId", { editingId: editingId ?? 0 })
          .getCount();
        if (successor) throw new ConflictException("สัญญานี้มีฉบับต่ออายุแล้ว");
      }
      if (type.form_kind === "renewal" && !previous)
        throw new BadRequestException("ต้องมีสัญญาเช่าฉบับแรกก่อนต่อสัญญา");
      if (type.form_kind === "lease" && !previous) {
        const reservations = await manager
          .getRepository(LeaseContractEntity)
          .createQueryBuilder("c")
          .leftJoin("c.template", "contractTemplate")
          .leftJoin("c.agreement_type", "agreementType")
          .where("c.created_by_user_id = :agentId", { agentId })
          .andWhere("c.lead_id = :leadId", { leadId: lead.id })
          .andWhere("c.rent_room_id = :roomId", { roomId: room.id })
          .andWhere("c.status NOT IN (:...closed)", {
            closed: ["cancelled", "expired", "terminated"],
          })
          .andWhere(
            "COALESCE(contractTemplate.form_kind, agreementType.form_kind) = :formKind",
            { formKind: "reservation" },
          )
          .getMany();
        const booked = reservations.some(
          (row) =>
            !["cancelled", "expired", "terminated"].includes(row.status) &&
            reservationLetterFinalized(row),
        );
        if (!booked)
          throw new BadRequestException(
            "ต้องสร้างหนังสือจองและออกเอกสารก่อนทำสัญญาเช่า",
          );
      }
      const overlap = await manager
        .getRepository(LeaseContractEntity)
        .createQueryBuilder("c")
        .leftJoin("c.agreement_type", "agreementType")
        .leftJoin("c.template", "contractTemplate")
        .where("c.rent_room_id = :roomId", { roomId: room.id })
        .andWhere("c.id <> :editingId", { editingId: editingId ?? 0 })
        // Lease and renewal both occupy the room; reservations and appointments coexist.
        .andWhere(
          "COALESCE(contractTemplate.form_kind, agreementType.form_kind) IN (:...formKinds)",
          { formKinds: ["lease", "renewal"].includes(type.form_kind)
              ? ["lease", "renewal"] : [type.form_kind] },
        )
        .andWhere("c.status NOT IN (:...closed)", {
          // Ended stays still occupied their historical interval; only cancellation erases occupancy.
          closed: ["lease", "renewal"].includes(type.form_kind)
            ? ["cancelled"] : ["cancelled", "expired", "terminated"],
        })
        .andWhere(
          "(CAST(:end AS date) IS NULL OR (CASE WHEN COALESCE(contractTemplate.form_kind, agreementType.form_kind) = 'reservation' THEN COALESCE(c.move_in_date, c.start_date) ELSE c.start_date END) <= :end) AND (COALESCE(contractTemplate.form_kind, agreementType.form_kind) = 'reservation' OR COALESCE(c.effective_end_date, c.end_date) IS NULL OR COALESCE(c.effective_end_date, c.end_date) >= :start)",
          {
            start:
              type.form_kind === "reservation"
                ? contractInput.moveInDate
                : contractInput.startDate,
            end:
              type.form_kind === "reservation" ||
              type.form_kind === "broker_appointment"
                ? null
                : contractInput.endDate,
          },
        )
        .getCount();
      if (overlap)
        throw new ConflictException(
          "ห้องนี้มีสัญญาประเภทเดียวกันในช่วงวันที่เลือกแล้ว กรุณาตรวจสอบรายการสัญญา",
        );
      let continuedTenancy: RoomTenancyEntity | null = null;
      if (!existing && previous?.end_date && previous.room_tenancy_id) {
        if (contractInput.startDate === shiftIsoDate(asIsoDate(previous.end_date), 1)) {
          const occupancy = await manager.findOne(RoomTenancyEntity, {
            where: { id: previous.room_tenancy_id, tenant_id: tenant.id, rent_room_id: room.id,
              created_by_user_id: agentId }, lock: { mode: "pessimistic_write" },
          });
          if (occupancy?.status === "active") continuedTenancy = occupancy;
        }
      }
      const tenancy = existing ? { id: existing.room_tenancy_id } : continuedTenancy ?? await manager.save(
        RoomTenancyEntity,
        manager.create(RoomTenancyEntity, {
          rent_room_id: room.id,
          tenant_id: tenant.id,
          created_by_user_id: agentId,
          status: "prospect",
        }),
      );
      const owner = room.property_owner_id
        ? await manager.findOneBy(PropertyOwnerEntity, {
            id: room.property_owner_id,
            created_by_user_id: agentId,
          })
        : null;
      let ownerUserId = reservationParties?.ownerUserId ?? room.owner_id ?? null;
      if (ownerUserId == null && type.form_kind !== "reservation") {
        const bookedOwner = await manager
          .getRepository(LeaseContractEntity)
          .createQueryBuilder("c")
          .leftJoin("c.template", "contractTemplate")
          .leftJoin("c.agreement_type", "agreementType")
          .where("c.lead_id = :leadId", { leadId: lead.id })
          .andWhere("c.rent_room_id = :roomId", { roomId: room.id })
          .andWhere("c.owner_user_id IS NOT NULL")
          .andWhere("c.status NOT IN (:...closed)", {
            closed: ["cancelled", "expired", "terminated"],
          })
          .andWhere(
            "COALESCE(contractTemplate.form_kind, agreementType.form_kind) = 'reservation'",
          )
          .orderBy("c.id", "DESC")
          .getOne();
        ownerUserId = bookedOwner?.owner_user_id ?? null;
      }
      const ownerUser = ownerUserId
        ? await manager.findOneBy(UserEntity, { id: ownerUserId })
        : null;
      const deliveredAt = new Date();
      const deliverTenant =
        type.form_kind !== "broker_appointment" && tenant.user_id != null;
      const deliverOwner = ownerUserId != null;
      const property = await manager.findOneBy(PropertyEntity, {
        id: room.properties_id,
      });
      const agent = await manager.findOneBy(UserEntity, { id: agentId });
      const contractNo = existing?.contract_no ?? await nextContractNo(manager, type.form_kind);
      if (reservationLetter && !reservationLetter.documentNo)
        reservationLetter = { ...reservationLetter, documentNo: contractNo };
      if (reservationLetter) data.reservationLetter = reservationLetter;
      if (brokerAppointment && !brokerAppointment.documentNo)
        brokerAppointment = { ...brokerAppointment, documentNo: contractNo };
      if (brokerAppointment)
        data.brokerAppointment = brokerAppointmentSnapshot(brokerAppointment);
      if (leaseAgreement && !leaseAgreement.documentNo)
        leaseAgreement = { ...leaseAgreement, documentNo: contractNo };
      if (leaseAgreement)
        data.leaseAgreement = leaseAgreementSnapshot(leaseAgreement);
      const letterRent = reservationLetter?.monthlyRent
        ? Number(String(reservationLetter.monthlyRent).replace(/,/g, ""))
        : null;
      const letterDeposit = reservationLetter?.depositAmount
        ? Number(String(reservationLetter.depositAmount).replace(/,/g, ""))
        : null;
      const contract = await manager.save(
        LeaseContractEntity,
        manager.create(LeaseContractEntity, {
          ...(existing ? { id: existing.id, document_url: null, invoice_url: null, receipt_url: null } : {}),
          contract_no: contractNo,
          template_id: template.id,
          data,
          party_snapshot: {
            tenantName: tenant.name,
            tenantPhone: tenant.phone,
            tenantEmail: tenant.email,
            tenantIdNumber: tenant.identity_number,
            tenantNationality: tenant.nationality,
            ownerName:
              reservationLetter?.landlordName ||
              owner?.name ||
              (ownerUser
                ? `${ownerUser.first_name} ${ownerUser.last_name}`.trim()
                : null) ||
              null,
            ownerPhone:
              reservationLetter?.landlordPhone ||
              owner?.phone ||
              ownerUser?.phone ||
              null,
            ownerIdNumber: room.owner_identity_number,
            agentName: agent
              ? `${agent.first_name} ${agent.last_name}`.trim()
              : null,
            agentPhone: agent?.phone ?? null,
            room: room.room_id,
            property: property?.name ?? room.listing_title,
            propertyAddress: property
              ? [
                  property.address,
                  property.subdistrict,
                  property.district,
                  property.province,
                  property.postal_code,
                ]
                  .filter((part) => part && part !== "-")
                  .join(" ")
              : null,
          },
          agreement_kind: previous ? "renewal" : "new",
          previous_agreement_id: previous?.id ?? null,
          root_agreement_id: previous
            ? (previous.root_agreement_id ?? previous.id)
            : null,
          lead_id: lead.id,
          tenant_id: tenant.id,
          rent_room_id: room.id,
          room_tenancy_id: tenancy.id,
          property_owner_id: room.property_owner_id,
          owner_user_id: ownerUserId,
          tenant_delivered_at: deliverTenant
            ? (existing?.tenant_delivered_at ?? deliveredAt)
            : (existing?.tenant_delivered_at ?? null),
          owner_delivered_at: deliverOwner
            ? (existing?.owner_delivered_at ?? deliveredAt)
            : (existing?.owner_delivered_at ?? null),
          created_by_user_id: agentId,
          start_date: contractInput.startDate,
          end_date:
            type.form_kind === "reservation" ||
            type.form_kind === "broker_appointment"
              ? null
              : contractInput.endDate,
          move_in_date:
            type.form_kind === "reservation" ? contractInput.moveInDate : null,
          agreement_type_code: type.code,
          reservation_fee:
            contractInput.reservationFee == null
              ? null
              : contractInput.reservationFee.toFixed(2),
          monthly_rent:
            type.form_kind === "reservation"
              ? letterRent != null && Number.isFinite(letterRent)
                ? letterRent.toFixed(2)
                : null
              : contractInput.monthlyRent == null
                ? null
                : contractInput.monthlyRent.toFixed(2),
          deposit:
            type.form_kind === "reservation"
              ? letterDeposit != null && Number.isFinite(letterDeposit)
                ? letterDeposit.toFixed(2)
                : null
              : contractInput.deposit == null
                ? null
                : contractInput.deposit.toFixed(2),
          notes: contractInput.notes || null,
          status: "draft",
        }),
      );
      if (type.form_kind === "reservation") {
        if (!this.documents)
          throw new ServiceUnavailableException("ยังไม่ได้ตั้งค่าที่เก็บเอกสารใบแจ้งหนี้ค่าจอง");
        // Keep the same invoice number/date on a draft edit; amounts follow the reservation.
        const previousFinancial = existing?.data?.financialDocuments as { invoice?: FinancialDocumentInput } | undefined;
        const invoice = reservationInvoice({
          ...contract,
          data: { ...data, financialDocuments: previousFinancial },
        } as LeaseContractEntity);
        const pdf = await createFinancialPdf("invoice", invoice);
        const stored = await this.documents.upload(agentId, contract.id, "invoice", { buffer: pdf, size: pdf.length });
        storedInvoicePath = stored.path;
        await manager.update(LeaseContractEntity, { id: contract.id }, {
          invoice_url: stored.path,
          data: {
            ...data,
            financialDocuments: { invoice },
            documentFileNames: { invoice: `invoice-${invoice.documentNo}.pdf` },
          },
        });
      }
      if (existing) await this.revokeDraftInvites(manager, existing.id);
      if (!previous)
        await manager.update(
          LeaseContractEntity,
          { id: contract.id },
          { root_agreement_id: contract.id },
        );
      return contract.id;
    }).catch(async (error) => {
      if (storedInvoicePath) await this.documents?.remove(storedInvoicePath).catch(() => undefined);
      throw error;
    });
    if (existing?.invoice_url && storedInvoicePath && existing.invoice_url !== storedInvoicePath)
      await this.documents?.remove(existing.invoice_url).catch(() => undefined);
    return this.view(agentId, id);
  }
}
