import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { DataSource, EntityManager, IsNull } from "typeorm";
import type { CloseAgentContract, ContractClosureBilling, ContractEndReason } from "@nestyk/types";
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
import { AgentInvoiceEntity } from "../../entities/agent-invoice.entity";
import { asIsoDate, isIsoDate } from "./lease-term";
import { bangkokToday } from "../../billing/rent-schedule";

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
  return rows.filter(row => row.code !== "draft_cancelled").map(row => ({
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
    // D7 (Aof, 22 Oct 2026): a lease waiting for its deposit or handover can be closed too (e.g. the tenant withdraws).
    if (!["active", "awaiting_deposit", "awaiting_handover"].includes(c.status))
      throw new BadRequestException("ปิดได้เฉพาะสัญญาที่มีผลใช้งาน หรือสัญญาเช่าที่รอเงินประกันหรือรอส่งมอบ");
    if (!reason.is_active || reason.code === "draft_cancelled")
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
    const recorded = new Date();
    await manager.update(LeaseContractEntity, { id }, {
      status, end_reason_id: reason.id, end_reason_note: b.note || null,
      effective_end_date: b.effectiveEndDate, end_recorded_at: recorded,
      end_recorded_by_user_id: agentId,
      ...(status === "terminated" ? { terminated_at: recorded } : {}),
    });
    await manager.update(AgreementSignInviteEntity,
      { agreement_id: id, used_at: IsNull(), revoked_at: IsNull() }, { revoked_at: recorded });
    // D7 (Aof, 22 Oct 2026): the deposit is due by the move-in day. A lease closed while it waits for the deposit
    // cancels its unpaid deposit invoice, so the tenant owes nothing. A slip the tenant sent stays viewable.
    if (c.status === "awaiting_deposit")
      await manager.update(AgentInvoiceEntity,
        { lease_contract_id: id, invoice_kind: "deposit", receipt_pdf_path: IsNull(), receipt_document_no: IsNull(), voided_at: IsNull() },
        { voided_at: recorded });
    const remaining = manager.getRepository(LeaseContractEntity).createQueryBuilder("other")
      .leftJoin("other.template", "template")
      .where("other.lead_id = :leadId AND other.rent_room_id = :roomId AND other.id <> :id",
        { leadId: c.lead_id, roomId: c.rent_room_id, id })
      .andWhere("other.status NOT IN (:...ended)", { ended: ENDED })
      .andWhere("template.form_kind IN ('lease', 'renewal')");
    if (!await remaining.getCount() && lead.rent_room_id === c.rent_room_id)
      await manager.update(LeadEntity, { id: lead.id }, { booking_released_at: recorded });
    const sameOccupancy = await manager.getRepository(LeaseContractEntity).createQueryBuilder("other")
      .where("other.room_tenancy_id = :tenancyId AND other.id <> :id", { tenancyId: c.room_tenancy_id, id })
      .andWhere("other.status NOT IN (:...ended)", { ended: ENDED }).getCount();
    if (!sameOccupancy) {
      const moved = await manager.update(RoomTenancyEntity, { id: c.room_tenancy_id, tenant_id: c.tenant_id, rent_room_id: c.rent_room_id,
        created_by_user_id: agentId }, { status: "moved_out",
          move_out_date: () => `GREATEST(move_out_date, '${b.effectiveEndDate}'::date)` });
      if (moved.affected !== 1)
        throw new ConflictException("ข้อมูลการเข้าพักไม่ตรงกับสัญญา กรุณาตรวจสอบก่อนปิดสัญญา");
    }
    return billingSummary(manager, id, b.effectiveEndDate);
  });
}
