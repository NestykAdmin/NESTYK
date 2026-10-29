import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { DataSource, EntityManager, IsNull } from "typeorm";
import type { CloseAgentContract, ContractClosureBilling, ContractEndReason } from "@nestyk/types";
import type { QueryDeepPartialEntity } from "typeorm/query-builder/QueryPartialEntity";
import { LeaseContractEntity } from "../../entities/lease-contract.entity";
import { LeadEntity } from "../../entities/lead.entity";
import { RentRoomEntity } from "../../entities/rent-room.entity";
import { RoomTenancyEntity } from "../../entities/room-tenancy.entity";
import { AgreementTemplateEntity } from "../../entities/agreement-template.entity";
import { MasterContractEndReasonEntity } from "../../entities/master-contract-end-reason.entity";
import { ContractDepositTransferEntity } from "../../entities/contract-deposit-transfer.entity";
import { ContractDepositSettlementEntity } from "../../entities/contract-deposit-settlement.entity";
import { TenantBillEntity } from "../../entities/tenant-bill.entity";
import { AgreementSignInviteEntity } from "../../entities/agreement-sign-invite.entity";
import { asIsoDate, isIsoDate } from "./lease-term";
import { bangkokToday } from "../../billing/rent-schedule";
import { DEAL_CANCELLATION_REASONS } from "./deal-cancellation";

const ENDED = ["cancelled", "expired", "terminated"];

export function validateContractClosure(input: unknown): CloseAgentContract {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new BadRequestException("กรุณาระบุข้อมูลปิดสัญญา");
  const b = input as Record<string, unknown>;
  if (Object.keys(b).some(key => !["endReasonCode", "effectiveEndDate", "note"].includes(key)))
    throw new BadRequestException("ข้อมูลปิดสัญญามีฟิลด์ที่ไม่รองรับ");
  if (typeof b.endReasonCode !== "string" || !/^[a-z][a-z0-9_]{0,63}$/.test(b.endReasonCode))
    throw new BadRequestException("กรุณาเลือกเหตุผลปิดสัญญา");
  if (!isIsoDate(b.effectiveEndDate))
    throw new BadRequestException("วันที่สิ้นสุดต้องเป็น ค.ศ. ในรูปแบบ YYYY-MM-DD");
  if (b.note != null && (typeof b.note !== "string" || b.note.trim().length > 1000))
    throw new BadRequestException("หมายเหตุปิดสัญญาต้องไม่เกิน 1,000 ตัวอักษร");
  return { endReasonCode: b.endReasonCode, effectiveEndDate: b.effectiveEndDate,
    note: typeof b.note === "string" ? b.note.trim() : "" };
}

export async function contractEndReasons(db: DataSource): Promise<ContractEndReason[]> {
  const rows = await db.getRepository(MasterContractEndReasonEntity).find({
    where: { is_active: true }, order: { sort_order: "ASC", id: "ASC" },
  });
  // D5: the deal cancellation reasons belong to that flow (with who caused it and evidence), not to closing a lease.
  return rows.filter(row => row.code !== "draft_cancelled" && !DEAL_CANCELLATION_REASONS.includes(row.code)).map(row => ({
    code: row.code, nameTh: row.name_th, nameEn: row.name_en,
    status: row.applicable_status, requiresNote: row.requires_note,
  }));
}

async function billingSummary(manager: EntityManager, id: number, end: string): Promise<ContractClosureBilling> {
  const summary = await manager.getRepository(TenantBillEntity).createQueryBuilder("bill")
    .select("COUNT(*) FILTER (WHERE bill.status = 'pending')", "unpaidCount")
    .addSelect("COALESCE(SUM(bill.amount) FILTER (WHERE bill.status = 'pending'), 0)::text", "unpaidAmount")
    .addSelect("COUNT(*) FILTER (WHERE bill.status = 'paid')", "paidCount")
    .addSelect("COUNT(*) FILTER (WHERE bill.due_date > :end)", "billsDueAfterEndCount")
    .where("bill.lease_contract_id = :id", { id, end }).getRawOne();
  return { policy: "retain_existing", unpaidCount: Number(summary.unpaidCount),
    unpaidAmount: Number(summary.unpaidCount) ? summary.unpaidAmount : "0.00",
    paidCount: Number(summary.paidCount), billsDueAfterEndCount: Number(summary.billsDueAfterEndCount) };
}

/** Parent lock serializes closure with billing issuance; lead/room order matches draft creation. */
export async function closeLeaseContract(db: DataSource, agentId: number, id: number, input: unknown) {
  const b = validateContractClosure(input);
  const initial = await db.getRepository(LeaseContractEntity).findOneBy({ id, created_by_user_id: agentId });
  if (!initial) throw new NotFoundException("ไม่พบสัญญา");
  return db.transaction(async manager => {
    const lead = await manager.findOne(LeadEntity, {
      where: { id: initial.lead_id, created_by_user_id: agentId }, lock: { mode: "pessimistic_write" },
    });
    const room = await manager.findOne(RentRoomEntity, {
      where: { id: initial.rent_room_id, created_by_user_id: agentId }, lock: { mode: "pessimistic_write" },
    });
    const c = await manager.findOne(LeaseContractEntity, {
      where: { id, created_by_user_id: agentId }, lock: { mode: "pessimistic_write" },
    });
    if (!c || !lead || !room) throw new NotFoundException("ไม่พบสัญญา ผู้เช่า หรือห้องที่คุณมีสิทธิ์จัดการ");
    if (c.lead_id !== initial.lead_id || c.rent_room_id !== initial.rent_room_id)
      throw new ConflictException("ข้อมูลสัญญาถูกเปลี่ยนแล้ว กรุณาเปิดใหม่");
    const template = await manager.findOneBy(AgreementTemplateEntity, { id: c.template_id });
    if (!template || !["lease", "renewal"].includes(template.form_kind))
      throw new BadRequestException("ปิดได้เฉพาะสัญญาเช่าหรือหนังสือต่อสัญญา");
    const reason = await manager.findOneBy(MasterContractEndReasonEntity, { code: b.endReasonCode });
    if (!reason) throw new BadRequestException("ไม่พบเหตุผลปิดสัญญา");
    if (ENDED.includes(c.status)) {
      if (c.end_reason_id !== reason.id || asIsoDate(c.effective_end_date) !== b.effectiveEndDate ||
          (c.end_reason_note ?? "") !== b.note)
        throw new ConflictException("สัญญานี้ปิดแล้ว ไม่สามารถเปลี่ยนข้อมูลปิดสัญญา");
      return billingSummary(manager, id, b.effectiveEndDate);
    }
    // D5 + D8 (Aof, 27 Oct 2026): a lease not handed over yet (waiting for its deposit or handover) is cancelled with
    // its deal (who caused it, evidence, the money), not closed here.
    if (["awaiting_deposit", "awaiting_handover"].includes(c.status))
      throw new BadRequestException({ code: "USE_DEAL_CANCELLATION",
        message: "สัญญาเช่าที่ยังไม่ส่งมอบห้อง ให้ยกเลิกด้วย \"ยกเลิกดีล\" (ระบุฝ่ายที่เป็นเหตุและหลักฐาน)" });
    if (c.status !== "active") throw new BadRequestException("ปิดได้เฉพาะสัญญาที่มีผลใช้งาน");
    if (!reason.is_active || reason.code === "draft_cancelled" || DEAL_CANCELLATION_REASONS.includes(reason.code))
      throw new BadRequestException("เหตุผลนี้ไม่รองรับการปิดสัญญาที่มีผลใช้งาน");
    if (reason.requires_note && !b.note) throw new BadRequestException("เหตุผลนี้ต้องระบุหมายเหตุ");
    const start = asIsoDate(c.start_date), end = asIsoDate(c.end_date);
    const today = bangkokToday();
    const status = reason.applicable_status;
    if (b.effectiveEndDate > today) throw new BadRequestException("ยังไม่สามารถปิดสัญญาด้วยวันที่ในอนาคต");
    if (status === "expired" && (!end || b.effectiveEndDate !== end || today <= end))
      throw new BadRequestException("ปิดครบกำหนดได้หลังวันสิ้นสุดสัญญา และต้องใช้วันสิ้นสุดเดิม");
    if (status === "terminated" && (b.effectiveEndDate < start || (end && b.effectiveEndDate >= end)))
      throw new BadRequestException("วันยุติก่อนกำหนดต้องอยู่ในช่วงสัญญาและก่อนวันสิ้นสุดเดิม");
    if (status === "cancelled" && b.effectiveEndDate >= start)
      throw new BadRequestException("ยกเลิกสัญญาที่มีผลได้เฉพาะก่อนวันเริ่มเช่า");
    if (status !== "expired") {
      const successor = await manager.getRepository(LeaseContractEntity).createQueryBuilder("next")
        .where("next.previous_agreement_id = :id", { id })
        .andWhere("next.status NOT IN (:...ended)", { ended: ENDED }).getCount();
      if (successor) throw new ConflictException("กรุณาปิดหรือยกเลิกฉบับต่อสัญญาที่ยังไม่สิ้นสุดก่อน");
    }
    const allocated = await manager.getRepository(ContractDepositTransferEntity).createQueryBuilder("transfer")
      .innerJoin(ContractDepositSettlementEntity, "settlement", "settlement.lease_contract_id = transfer.from_contract_id")
      .where("transfer.to_contract_id = :id AND transfer.status = 'pending'", { id })
      .andWhere("settlement.status <> 'draft'").getCount();
    if (status !== "expired" && allocated)
      throw new ConflictException("ต้องจัดการเงินประกันที่อนุมัติยกยอดมาก่อนปิดสัญญานี้");
    await finishLeaseClosure(manager, c, lead, {
      status, reasonId: reason.id, note: b.note || null, effectiveEndDate: b.effectiveEndDate, recordedBy: agentId,
    });
    return billingSummary(manager, id, b.effectiveEndDate);
  });
}

type LeaseClosure = {
  status: string; reasonId: number; note: string | null; effectiveEndDate: string; recordedBy: number | null;
  /** AC-8.7: the stay goes on (no decision yet): the lead keeps its booking and the tenancy stays. */
  keepStay?: boolean;
};

/**
 * The closing writes shared by closing a lease by hand and the daily close of an ended lease: the end fields, the
 * open signing links revoked, and (unless the stay goes on) the stay released. The caller holds the locks (lead,
 * room, contract).
 */
export async function finishLeaseClosure(manager: EntityManager, c: LeaseContractEntity, lead: LeadEntity | null, end: LeaseClosure) {
  const id = c.id;
  const recorded = new Date();
  await manager.update(LeaseContractEntity, { id }, {
    status: end.status as LeaseContractEntity["status"], end_reason_id: end.reasonId, end_reason_note: end.note,
    effective_end_date: end.effectiveEndDate, end_recorded_at: recorded,
    end_recorded_by_user_id: end.recordedBy,
    ...(end.status === "terminated" ? { terminated_at: recorded } : {}),
  });
  await manager.update(AgreementSignInviteEntity,
    { agreement_id: id, used_at: IsNull(), revoked_at: IsNull() }, { revoked_at: recorded });
  if (!end.keepStay) await releaseStay(manager, c, lead, end.effectiveEndDate, recorded);
}

/**
 * The stay is over: the lead's booking is released when no other lease of it in the room is open, and the tenancy
 * moves out (from `moveOutDate`) when no other agreement of it is open.
 */
async function releaseStay(manager: EntityManager, c: LeaseContractEntity, lead: LeadEntity | null, moveOutDate: string, recorded = new Date()) {
  const id = c.id;
  const remaining = manager.getRepository(LeaseContractEntity).createQueryBuilder("other")
    .leftJoin("other.template", "template")
    .where("other.lead_id = :leadId AND other.rent_room_id = :roomId AND other.id <> :id",
      { leadId: c.lead_id, roomId: c.rent_room_id, id })
    .andWhere("other.status NOT IN (:...ended)", { ended: ENDED })
    .andWhere("template.form_kind IN ('lease', 'renewal')");
  if (lead && !await remaining.getCount() && lead.rent_room_id === c.rent_room_id)
    await manager.update(LeadEntity, { id: lead.id }, { booking_released_at: recorded });
  const sameOccupancy = await manager.getRepository(LeaseContractEntity).createQueryBuilder("other")
    .where("other.room_tenancy_id = :tenancyId AND other.id <> :id", { tenancyId: c.room_tenancy_id, id })
    .andWhere("other.status NOT IN (:...ended)", { ended: ENDED }).getCount();
  if (!sameOccupancy) {
    const moved = await manager.update(RoomTenancyEntity, { id: c.room_tenancy_id, tenant_id: c.tenant_id, rent_room_id: c.rent_room_id,
      created_by_user_id: c.created_by_user_id }, { status: "moved_out",
        move_out_date: () => `GREATEST(move_out_date, '${moveOutDate}'::date)` });
    if (moved.affected !== 1)
      throw new ConflictException("ข้อมูลการเข้าพักไม่ตรงกับสัญญา กรุณาตรวจสอบก่อนปิดสัญญา");
  }
}

export type EndedLeaseInput = {
  start: string;
  end: string | null;
  endsOn: { date?: unknown; reason?: unknown; recordedBy?: unknown } | null;
  notRenewing: { recordedOn?: unknown; recordedBy?: unknown } | null;
  /** A renewal of this lease is in force. */
  renewed: boolean;
  today: string;
};
export type EndedLeaseClosure = {
  status: "expired" | "terminated"; reasonCode: string; note: string | null; effectiveEndDate: string; recordedBy: number | null;
  /** AC-8.7: ended with no decision yet: the room stays let, the lead and the tenancy stay, the agent decides. */
  undecided: boolean;
};

const userId = (value: unknown) => (Number.isSafeInteger(value) && (value as number) > 0 ? (value as number) : null);

/**
 * H1/H2, AC-8.7 (Aof 29 Oct 2026): how the daily close ends a handed-over lease. Every lease ends at 00:00 of the day
 * after its last day:
 * - ended early (D16), from the day after that date: terminated, "other termination" with the reason typed then;
 * - otherwise from the day after its end: expired. Recorded as not renewing (D15, its record day passed) or renewed
 *   (the renewal in force): the stay is over. With no decision yet (or a renewal not signed by everyone yet), it is
 *   `undecided`: the room stays let and the agent records renewing or not; the stay is released later
 *   (endedStayRelease).
 * An early end is not applied over a renewal in force (the agent closes it by hand).
 */
export function endedLeaseClosure(input: EndedLeaseInput): EndedLeaseClosure | null {
  const { start, end, endsOn, notRenewing, today } = input;
  const early = isIsoDate(endsOn?.date) ? (endsOn!.date as string) : null;
  // A renewal in force means the stay goes on: an early end recorded before it is not applied by the job.
  if (early && !input.renewed && early < today && early >= start && (!end || early < end)) {
    const reason = typeof endsOn?.reason === "string" ? endsOn.reason.trim() : "";
    return { status: "terminated", reasonCode: "other_termination", note: reason || "เลิกสัญญาก่อนกำหนด",
      effectiveEndDate: early, recordedBy: userId(endsOn?.recordedBy), undecided: false };
  }
  if (!end || end >= today) return null;
  const expired = { status: "expired" as const, reasonCode: "term_completed", note: null, effectiveEndDate: end };
  if (input.renewed) return { ...expired, recordedBy: null, undecided: false };
  if (notRenewing) {
    const recordedOn = isIsoDate(notRenewing.recordedOn) ? (notRenewing.recordedOn as string) : end;
    // Recorded after the end (TC-8.11): the stay lasts until that day.
    return { ...expired, recordedBy: userId(notRenewing.recordedBy), undecided: recordedOn >= today };
  }
  return { ...expired, recordedBy: null, undecided: true };
}

/**
 * AC-8.7: an ended lease still `undecided` whose stay is now over: recorded as not renewing, from the day after the
 * record (released then, moved out on the record day). A renewal in force takes the stay over (nothing to release).
 */
export function endedStayRelease(input: { end: string | null; notRenewing: EndedLeaseInput["notRenewing"]; renewed: boolean; today: string }):
  { moveOutDate: string } | "renewed" | null {
  if (input.renewed) return "renewed";
  if (!input.notRenewing || !input.end) return null;
  const recordedOn = isIsoDate(input.notRenewing.recordedOn) ? (input.notRenewing.recordedOn as string) : input.end;
  const last = recordedOn > input.end ? recordedOn : input.end;
  return last < input.today ? { moveOutDate: last } : null;
}

/** The daily close of one lease (see endedLeaseClosure, endedStayRelease). Returns what it did, or null. */
export async function closeEndedLease(db: DataSource, id: number, today = bangkokToday()): Promise<string | null> {
  const initial = await db.getRepository(LeaseContractEntity).findOneBy({ id });
  if (!initial || !["active", "expired"].includes(initial.status)) return null;
  return db.transaction(async manager => {
    // Same lock order as closing by hand: lead, room, contract.
    const lead = initial.lead_id != null
      ? await manager.findOne(LeadEntity, { where: { id: initial.lead_id }, lock: { mode: "pessimistic_write" } }) : null;
    await manager.findOne(RentRoomEntity, { where: { id: initial.rent_room_id }, lock: { mode: "pessimistic_write" } });
    const c = await manager.findOne(LeaseContractEntity, { where: { id, status: initial.status }, lock: { mode: "pessimistic_write" } });
    if (!c || c.lead_id !== initial.lead_id || c.rent_room_id !== initial.rent_room_id) return null;
    const template = await manager.findOneBy(AgreementTemplateEntity, { id: c.template_id });
    if (!template || !["lease", "renewal"].includes(template.form_kind)) return null;
    const renewed = await manager.getRepository(LeaseContractEntity).createQueryBuilder("next")
      .where("next.previous_agreement_id = :id", { id })
      .andWhere("next.status = 'active'").getCount();
    const data = (c.data ?? {}) as { endsOn?: EndedLeaseInput["endsOn"]; notRenewing?: EndedLeaseInput["notRenewing"]; undecided?: unknown };
    if (c.status === "expired") {
      if (!data.undecided) return null;
      const release = endedStayRelease({ end: asIsoDate(c.end_date) || null, notRenewing: data.notRenewing ?? null, renewed: renewed > 0, today });
      if (!release) return null;
      const rest = { ...data } as Record<string, unknown>;
      delete rest.undecided;
      await manager.update(LeaseContractEntity, { id }, { data: rest } as QueryDeepPartialEntity<LeaseContractEntity>);
      if (release === "renewed") return "renewed";
      await releaseStay(manager, c, lead, release.moveOutDate);
      return "released";
    }
    const end = endedLeaseClosure({
      start: asIsoDate(c.start_date), end: asIsoDate(c.end_date) || null,
      endsOn: data.endsOn ?? null, notRenewing: data.notRenewing ?? null, renewed: renewed > 0, today,
    });
    if (!end) return null;
    const reason = await manager.findOneBy(MasterContractEndReasonEntity, { code: end.reasonCode });
    if (!reason) throw new Error(`end reason ${end.reasonCode} is missing`);
    await finishLeaseClosure(manager, c, lead, {
      status: end.status, reasonId: reason.id, note: end.note, effectiveEndDate: end.effectiveEndDate, recordedBy: end.recordedBy,
      keepStay: end.undecided,
    });
    if (end.undecided)
      await manager.update(LeaseContractEntity, { id }, { data: { ...data, undecided: { since: today } } } as QueryDeepPartialEntity<LeaseContractEntity>);
    return end.status;
  });
}
