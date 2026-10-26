import { BadRequestException, ConflictException, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { DataSource, EntityManager, In, IsNull } from "typeorm";
import type { DealCancellation, DealCancellationParty, DealCancellationPreview } from "@nestyk/types";
import { LeaseContractEntity } from "../../entities/lease-contract.entity";
import { LeadEntity } from "../../entities/lead.entity";
import { RentRoomEntity } from "../../entities/rent-room.entity";
import { RoomTenancyEntity } from "../../entities/room-tenancy.entity";
import { AgreementTemplateEntity } from "../../entities/agreement-template.entity";
import { MasterAgreementTypeEntity } from "../../entities/master-agreement-type.entity";
import { MasterContractEndReasonEntity } from "../../entities/master-contract-end-reason.entity";
import { AgreementSignInviteEntity } from "../../entities/agreement-sign-invite.entity";
import { AgentInvoiceEntity } from "../../entities/agent-invoice.entity";
import { DealCancellationEntity } from "../../entities/deal-cancellation.entity";
import { bangkokToday } from "../../billing/rent-schedule";
import { asIsoDate, isIsoDate, shiftIsoDate } from "./lease-term";
import { financialTotals } from "./financial-document";
import type { ContractDocumentStorageService } from "./contract-document-storage.service";

/**
 * D5 (AC-C.1 to C.4, Aof 26 Oct 2026): the agent cancels a deal (its booking letter and lease) before the room is
 * handed over. A reason, who caused it and at least 1 evidence file are required. Only money with an issued receipt
 * counts: the tenant at fault forfeits it (AC-C.1, C.3); the landlord at fault, whoever asked to cancel, means all of
 * it is refunded within 7 days from the day the agent was told (AC-C.2, C.3). Unpaid invoices are cancelled (Aof,
 * step 15). With the landlord at fault the agent may also end the broker appointment for the room. Once the
 * handover is signed (the lease is active) the deal cannot be cancelled: the lease is ended early instead (AC-7.7).
 */
export const DEAL_CANCELLED_REASON = "deal_cancelled";
export const LANDLORD_WITHDREW_REASON = "landlord_withdrew";
/** Reasons this flow uses: not offered when closing a lease, and not accepted there. */
export const DEAL_CANCELLATION_REASONS = [DEAL_CANCELLED_REASON, LANDLORD_WITHDREW_REASON];
export const REFUND_DAYS = 7;
export const MAX_EVIDENCE_FILES = 5;
export const DEAL_HANDED_OVER = "ส่งมอบห้องแล้ว ยกเลิกดีลไม่ได้ ให้ใช้การเลิกสัญญาก่อนกำหนด";
const ENDED = ["cancelled", "expired", "terminated"];
const DEAL_FORMS = ["reservation", "lease"];
const FIELDS = { reason: "เหตุผล", evidence: "หลักฐาน (รูปหรือ PDF)", atFault: "ฝ่ายที่เป็นเหตุ", notifiedOn: "วันที่ได้รับแจ้ง" } as const;
type Field = keyof typeof FIELDS;
type UploadedFile = { buffer: Buffer; size: number; originalname?: string };

export type DealCancellationInput = {
  atFault: DealCancellationParty;
  reason: string;
  notifiedOn: string | null;
  endAppointment: boolean;
};

/** The form's fields; a missing one is named (TC-C.08). Checked before any file is stored. */
export function validateDealCancellation(input: unknown, fileCount: number, today: string): DealCancellationInput {
  const b = input && typeof input === "object" && !Array.isArray(input) ? (input as Record<string, unknown>) : {};
  if (Object.keys(b).some((key) => !["atFault", "reason", "notifiedOn", "endAppointment"].includes(key)))
    throw new BadRequestException("ข้อมูลยกเลิกดีลมีฟิลด์ที่ไม่รองรับ");
  const reason = typeof b.reason === "string" ? b.reason.trim() : "";
  const atFault = b.atFault === "tenant" || b.atFault === "landlord" ? b.atFault : null;
  const notifiedOn = typeof b.notifiedOn === "string" && b.notifiedOn.trim() ? b.notifiedOn.trim() : null;
  const missing: Field[] = [];
  if (!reason) missing.push("reason");
  if (fileCount < 1) missing.push("evidence");
  if (!atFault) missing.push("atFault");
  if (atFault === "landlord" && !notifiedOn) missing.push("notifiedOn");
  if (missing.length)
    throw new BadRequestException({
      code: "CANCELLATION_INCOMPLETE",
      missing,
      message: `กรุณากรอกให้ครบ: ${missing.map((field) => FIELDS[field]).join(", ")}`,
    });
  if (reason.length > 1000) throw new BadRequestException("เหตุผลต้องไม่เกิน 1,000 ตัวอักษร");
  if (fileCount > MAX_EVIDENCE_FILES) throw new BadRequestException(`แนบหลักฐานได้ไม่เกิน ${MAX_EVIDENCE_FILES} ไฟล์`);
  if (notifiedOn != null && !isIsoDate(notifiedOn))
    throw new BadRequestException("วันที่ได้รับแจ้งต้องเป็น ค.ศ. ในรูปแบบ YYYY-MM-DD");
  if (notifiedOn != null && notifiedOn > today) throw new BadRequestException("วันที่ได้รับแจ้งต้องไม่เกินวันนี้");
  if (b.endAppointment != null && typeof b.endAppointment !== "boolean")
    throw new BadRequestException("ตัวเลือกเลิกสัญญาแต่งตั้งนายหน้าไม่ถูกต้อง");
  const endAppointment = b.endAppointment === true;
  if (endAppointment && atFault !== "landlord")
    throw new BadRequestException("เลิกสัญญาแต่งตั้งนายหน้าพร้อมการยกเลิกได้เฉพาะเมื่อผู้ให้เช่าเป็นเหตุ");
  return { atFault: atFault!, reason, notifiedOn, endAppointment };
}

const cents = (amount: number) => Math.round(amount * 100);
/**
 * What happens to the money received with a receipt: all forfeited when the tenant is at fault, all refunded when
 * the landlord is, due 7 days after the day the agent was told (told 15 Oct: due 22 Oct, TC-C.04).
 */
export function dealMoney(atFault: DealCancellationParty, bookingReceived: number, depositReceived: number, notifiedOn: string | null) {
  const received = cents(bookingReceived) + cents(depositReceived);
  const refund = atFault === "landlord" ? received : 0;
  return {
    bookingReceived: cents(bookingReceived) / 100,
    depositReceived: cents(depositReceived) / 100,
    forfeitedAmount: (received - refund) / 100,
    refundAmount: refund / 100,
    refundDueOn: refund > 0 && notifiedOn ? shiftIsoDate(notifiedOn, REFUND_DAYS) : null,
  };
}

/** The refund's date: not in the future, not before the day the agent was told. */
export function validateRefund(input: unknown, today: string, notifiedOn: string | null) {
  const b = input && typeof input === "object" && !Array.isArray(input) ? (input as Record<string, unknown>) : {};
  if (Object.keys(b).some((key) => key !== "refundedOn")) throw new BadRequestException("ข้อมูลคืนเงินมีฟิลด์ที่ไม่รองรับ");
  if (!isIsoDate(b.refundedOn)) throw new BadRequestException("วันที่คืนเงินต้องเป็น ค.ศ. ในรูปแบบ YYYY-MM-DD");
  if (b.refundedOn > today) throw new BadRequestException("วันที่คืนเงินต้องไม่เกินวันนี้");
  if (notifiedOn && b.refundedOn < notifiedOn) throw new BadRequestException("วันที่คืนเงินต้องไม่ก่อนวันที่ได้รับแจ้ง");
  return { refundedOn: b.refundedOn };
}

type DealRow = LeaseContractEntity & { formKind: string | null };

/** The deal's booking letters and leases (same agent, lead, room and tenant), with their form, oldest first. */
async function dealRows(manager: EntityManager, c: LeaseContractEntity, lock: boolean): Promise<DealRow[]> {
  const rows = await manager.find(LeaseContractEntity, {
    where: { created_by_user_id: c.created_by_user_id, lead_id: c.lead_id, rent_room_id: c.rent_room_id, tenant_id: c.tenant_id },
    order: { id: "ASC" },
    ...(lock ? { lock: { mode: "pessimistic_write" as const } } : {}),
  });
  const templateIds = [...new Set(rows.map((row) => row.template_id).filter((id) => id != null))];
  const templates = new Map((templateIds.length ? await manager.findBy(AgreementTemplateEntity, { id: In(templateIds) }) : [])
    .map((t) => [t.id, t.form_kind]));
  const codes = [...new Set(rows.map((row) => row.agreement_type_code).filter(Boolean))];
  const types = new Map((codes.length ? await manager.findBy(MasterAgreementTypeEntity, { code: In(codes) }) : [])
    .map((t) => [t.code, t.form_kind]));
  return rows
    .map((row) => Object.assign(row, { formKind: templates.get(row.template_id) ?? types.get(row.agreement_type_code) ?? null }))
    .filter((row) => row.agreement_kind !== "renewal" && DEAL_FORMS.includes(row.formKind ?? ""));
}

/** The open agreements of the deal, after checking the deal can be cancelled at all. */
function openRows(c: DealRow, rows: DealRow[]) {
  if (!DEAL_FORMS.includes(c.formKind ?? "") || c.agreement_kind === "renewal")
    throw new BadRequestException("ยกเลิกดีลได้จากหนังสือจองหรือสัญญาเช่าเท่านั้น");
  if (ENDED.includes(c.status)) throw new BadRequestException("สัญญานี้สิ้นสุดแล้ว");
  // TC-C.09: a lease that is active (or was) has been handed over.
  if (rows.some((row) => row.formKind === "lease" && ["active", "expired", "terminated"].includes(row.status)))
    throw new BadRequestException({ code: "DEAL_HANDED_OVER", message: DEAL_HANDED_OVER });
  return rows.filter((row) => !ENDED.includes(row.status));
}

/** Received with an issued receipt: the booking fee of each letter, the deposit of each lease. */
async function received(manager: EntityManager, open: DealRow[], lock: boolean) {
  let booking = 0;
  let pendingSlip = false;
  for (const row of open.filter((r) => r.formKind === "reservation")) {
    const invoice = (row.data?.financialDocuments as { invoice?: Parameters<typeof financialTotals>[0] } | undefined)?.invoice;
    if (row.receipt_url) booking += invoice ? financialTotals(invoice).total : Number(row.reservation_fee ?? 0);
    else if ((row.data?.reservationPayment as { slipPath?: string } | undefined)?.slipPath) pendingSlip = true;
  }
  const leaseIds = open.filter((r) => r.formKind === "lease").map((r) => r.id);
  const deposits = leaseIds.length
    ? await manager.find(AgentInvoiceEntity, {
        where: { lease_contract_id: In(leaseIds), invoice_kind: "deposit" },
        ...(lock ? { lock: { mode: "pessimistic_write" as const } } : {}),
      })
    : [];
  let deposit = 0;
  for (const row of deposits) {
    if (row.voided_at) continue;
    if (row.receipt_document_no) deposit += financialTotals(row.data).total;
    else if (row.payment_slip_path) pendingSlip = true;
  }
  return { booking, deposit, pendingSlip, leaseIds };
}

/** Broker appointments for the room and tenant still in force today (AC-3.2: generated, under 1 year old). */
function liveAppointments(manager: EntityManager, c: LeaseContractEntity, today: string, lock: boolean) {
  let query = manager.getRepository(LeaseContractEntity).createQueryBuilder("a")
    .where("a.created_by_user_id = :agentId AND a.rent_room_id = :roomId AND a.tenant_id = :tenantId",
      { agentId: c.created_by_user_id, roomId: c.rent_room_id, tenantId: c.tenant_id })
    .leftJoin("a.template", "template")
    .leftJoin("a.agreement_type", "agreementType")
    .andWhere("a.status = 'active'")
    .andWhere("COALESCE(template.form_kind, agreementType.form_kind) = 'broker_appointment'")
    .andWhere("a.start_date <= CAST(:today AS date) AND a.start_date + INTERVAL '1 year' > CAST(:today AS date)", { today })
    .andWhere("(a.end_date IS NULL OR a.end_date > CAST(:today AS date))", { today })
    .orderBy("a.id", "ASC");
  // Only the agreements are locked (FOR UPDATE OF a): the joined sides may be null.
  if (lock) query = query.setLock("pessimistic_write", undefined, ["a"]);
  return query.getMany();
}

async function findOwn(db: DataSource | EntityManager, agentId: number, id: number) {
  const manager = db instanceof DataSource ? db.manager : db;
  const c = await manager.findOne(LeaseContractEntity, { where: { id, created_by_user_id: agentId } });
  if (!c) throw new NotFoundException("ไม่พบสัญญา");
  const [row] = (await dealRows(manager, c, false)).filter((r) => r.id === c.id);
  return row ?? Object.assign(c, { formKind: null });
}

/** What cancelling would close and the money involved, for the form (`GET /agent/contracts/:id/cancellation-preview`). */
export async function dealCancellationPreview(db: DataSource, agentId: number, id: number): Promise<DealCancellationPreview> {
  const c = await findOwn(db, agentId, id);
  const rows = await dealRows(db.manager, c, false);
  const open = openRows(c, rows);
  const money = await received(db.manager, open, false);
  const today = bangkokToday();
  const main = [...open].reverse().find((row) => row.formKind === "lease") ?? open[open.length - 1];
  return {
    mainContractId: main.id,
    contracts: open.map((row) => ({ id: row.id, contractNo: row.contract_no || `EC-${row.id}`, formKind: row.formKind as "reservation" | "lease", status: row.status })),
    bookingReceived: cents(money.booking) / 100,
    depositReceived: cents(money.deposit) / 100,
    pendingSlip: money.pendingSlip,
    appointmentActive: (await liveAppointments(db.manager, c, today, false)).length > 0,
    refundDays: REFUND_DAYS,
  };
}

/**
 * Cancels the deal of agreement `id` (POST /agent/contracts/:id/cancel-deal, multipart: payload + evidence files).
 * Lock order: lead, room, the deal's agreements, the deposit invoices (as closing a lease and the receipt flows).
 */
export async function cancelDeal(
  db: DataSource,
  documents: ContractDocumentStorageService | undefined,
  agentId: number,
  id: number,
  input: unknown,
  files: UploadedFile[] | undefined,
) {
  const today = bangkokToday();
  const b = validateDealCancellation(input, files?.length ?? 0, today);
  const initial = await findOwn(db, agentId, id);
  openRows(initial, await dealRows(db.manager, initial, false));
  if (!documents) throw new ServiceUnavailableException("ยังไม่ได้ตั้งค่าที่เก็บเอกสารสัญญา");
  const evidence: string[] = [];
  try {
    for (const file of files ?? []) evidence.push((await documents.uploadAttachment(agentId, id, file)).path);
    return await db.transaction(async (manager) => {
      const lead = await manager.findOne(LeadEntity, { where: { id: initial.lead_id, created_by_user_id: agentId }, lock: { mode: "pessimistic_write" } });
      const room = await manager.findOne(RentRoomEntity, { where: { id: initial.rent_room_id, created_by_user_id: agentId }, lock: { mode: "pessimistic_write" } });
      if (!lead || !room) throw new NotFoundException("ไม่พบลีดหรือห้องของดีลนี้");
      const rows = await dealRows(manager, initial, true);
      const c = rows.find((row) => row.id === id);
      if (!c) throw new ConflictException("ข้อมูลสัญญาถูกเปลี่ยนแล้ว กรุณาเปิดใหม่");
      const open = openRows(c, rows);
      const money = await received(manager, open, true);
      const reason = await manager.findOneBy(MasterContractEndReasonEntity, { code: DEAL_CANCELLED_REASON, is_active: true });
      if (!reason) throw new ServiceUnavailableException("ยังไม่ได้ตั้งค่าเหตุผลยกเลิกดีล (migration 20261026140000)");
      const at = new Date();
      const ids = open.map((row) => row.id);
      for (const row of open)
        await manager.update(LeaseContractEntity, { id: row.id }, {
          status: "cancelled", end_reason_id: reason.id, end_reason_note: b.reason, effective_end_date: today,
          end_recorded_at: at, end_recorded_by_user_id: agentId,
        });
      await manager.update(AgreementSignInviteEntity, { agreement_id: In(ids), used_at: IsNull(), revoked_at: IsNull() }, { revoked_at: at });
      // Aof (step 15): the deal's unpaid invoices are cancelled with it. A booking letter's invoice is on the letter,
      // so it ends with it; a lease's deposit invoice without a receipt is voided. A slip sent stays viewable.
      if (money.leaseIds.length)
        await manager.update(AgentInvoiceEntity, {
          lease_contract_id: In(money.leaseIds), invoice_kind: "deposit", receipt_pdf_path: IsNull(), receipt_document_no: IsNull(), voided_at: IsNull(),
        }, { voided_at: at });
      if (lead.status === "booked" && lead.rent_room_id === c.rent_room_id && lead.tenant_id === c.tenant_id && !lead.booking_released_at)
        await manager.update(LeadEntity, { id: lead.id }, { booking_released_at: at });
      for (const tenancyId of new Set(open.map((row) => row.room_tenancy_id).filter((tid) => tid != null))) {
        const others = await manager.getRepository(LeaseContractEntity).createQueryBuilder("other")
          .where("other.room_tenancy_id = :tenancyId AND other.id NOT IN (:...ids)", { tenancyId, ids })
          .andWhere("other.status NOT IN (:...ended)", { ended: ENDED }).getCount();
        if (!others)
          await manager.update(RoomTenancyEntity, { id: tenancyId, created_by_user_id: agentId, status: "prospect" }, { status: "moved_out" });
      }
      let appointmentEnded = false;
      if (b.endAppointment) {
        const appointments = await liveAppointments(manager, c, today, true);
        const withdrew = await manager.findOneBy(MasterContractEndReasonEntity, { code: LANDLORD_WITHDREW_REASON, is_active: true });
        if (appointments.length && !withdrew) throw new ServiceUnavailableException("ยังไม่ได้ตั้งค่าเหตุผลเลิกสัญญาแต่งตั้งนายหน้า");
        for (const appointment of appointments)
          await manager.update(LeaseContractEntity, { id: appointment.id, status: "active" }, {
            status: "terminated", end_reason_id: withdrew!.id, end_reason_note: b.reason, effective_end_date: today,
            end_recorded_at: at, end_recorded_by_user_id: agentId, terminated_at: at,
          });
        appointmentEnded = appointments.length > 0;
      }
      const amounts = dealMoney(b.atFault, money.booking, money.deposit, b.notifiedOn);
      const main = [...open].reverse().find((row) => row.formKind === "lease") ?? open[open.length - 1];
      const saved = await manager.save(DealCancellationEntity, manager.create(DealCancellationEntity, {
        agent_user_id: agentId, lead_id: c.lead_id, rent_room_id: c.rent_room_id, tenant_id: c.tenant_id ?? null,
        lease_contract_id: main.id, contract_ids: ids, at_fault: b.atFault, reason: b.reason, evidence_paths: evidence,
        notified_on: b.notifiedOn, booking_received: amounts.bookingReceived.toFixed(2), deposit_received: amounts.depositReceived.toFixed(2),
        forfeited_amount: amounts.forfeitedAmount.toFixed(2), refund_amount: amounts.refundAmount.toFixed(2),
        refund_due_on: amounts.refundDueOn, appointment_ended: appointmentEnded,
      }));
      return saved;
    });
  } catch (error) {
    for (const path of evidence) await documents.remove(path).catch(() => undefined);
    throw error;
  }
}

/** The cancellation that closed agreement `id`, if any. */
export function cancellationOf(manager: EntityManager, agentId: number, id: number) {
  return manager.getRepository(DealCancellationEntity).createQueryBuilder("dc")
    .where("dc.agent_user_id = :agentId AND :id = ANY(dc.contract_ids)", { agentId, id }).getOne();
}

/** The agent records the refund once, with its proof (POST /agent/contracts/:id/cancellation/refund; AC-S.2). */
export async function recordDealRefund(
  db: DataSource,
  documents: ContractDocumentStorageService | undefined,
  agentId: number,
  id: number,
  input: unknown,
  file: UploadedFile | undefined,
) {
  const row = await cancellationOf(db.manager, agentId, id);
  if (!row) throw new NotFoundException("ไม่พบการยกเลิกของสัญญานี้");
  if (!(Number(row.refund_amount) > 0)) throw new BadRequestException("การยกเลิกนี้ไม่มียอดต้องคืน");
  if (row.refunded_on) throw new ConflictException("บันทึกคืนเงินแล้ว");
  const { refundedOn } = validateRefund(input, bangkokToday(), asIsoDate(row.notified_on) || null);
  if (!file?.buffer?.length) throw new BadRequestException("กรุณาแนบหลักฐานการคืนเงิน (รูปหรือ PDF)");
  if (!documents) throw new ServiceUnavailableException("ยังไม่ได้ตั้งค่าที่เก็บเอกสารสัญญา");
  const proof = (await documents.uploadAttachment(agentId, row.lease_contract_id, file)).path;
  try {
    const result = await db.getRepository(DealCancellationEntity).update(
      { id: row.id, refunded_on: IsNull() },
      { refunded_on: refundedOn, refund_proof_path: proof, refund_recorded_at: new Date(), refund_recorded_by_user_id: agentId },
    );
    if (result.affected !== 1) throw new ConflictException("บันทึกคืนเงินแล้ว");
  } catch (error) {
    await documents.remove(proof).catch(() => undefined);
    throw error;
  }
}

/** The app's view of a cancellation; parties get it without the files. */
export function serializeDealCancellation(row: DealCancellationEntity, url: (path: string | null | undefined) => string | null): DealCancellation {
  return {
    id: row.id,
    mainContractId: row.lease_contract_id,
    contractIds: [...row.contract_ids],
    atFault: row.at_fault,
    reason: row.reason,
    notifiedOn: asIsoDate(row.notified_on) || null,
    bookingReceived: Number(row.booking_received),
    depositReceived: Number(row.deposit_received),
    forfeitedAmount: Number(row.forfeited_amount),
    refundAmount: Number(row.refund_amount),
    refundDueOn: asIsoDate(row.refund_due_on) || null,
    refundedOn: asIsoDate(row.refunded_on) || null,
    refundProofUrl: url(row.refund_proof_path),
    evidenceUrls: (row.evidence_paths ?? []).map((path) => url(path)).filter((u): u is string => !!u),
    appointmentEnded: row.appointment_ended,
    cancelledAt: row.created_at ? new Date(row.created_at).toISOString() : null,
  };
}
