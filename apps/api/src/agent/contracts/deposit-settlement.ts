import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
} from "@nestjs/common";
import { DataSource } from "typeorm";
import type { DepositDeductionType, DepositSettlementBlocked, DepositSettlementView } from "@nestyk/types";
import { AgentInvoiceEntity } from "../../entities/agent-invoice.entity";
import { ContractDepositSettlementEntity } from "../../entities/contract-deposit-settlement.entity";
import { DepositDeductionItemEntity } from "../../entities/deposit-deduction-item.entity";
import { LeaseContractEntity } from "../../entities/lease-contract.entity";
import { financialTotals } from "./financial-document";
import { moveOutBlockedReason } from "./handover.service";
import { AgentContractsService } from "./agent-contracts.service";
import { ContractDocumentStorageService } from "./contract-document-storage.service";
import { bangkokToday } from "../../billing/rent-schedule";

const TYPES: readonly DepositDeductionType[] = ["rent", "utilities", "damage", "other"];
const record = (input: unknown) =>
  input && typeof input === "object" && !Array.isArray(input) ? (input as Record<string, unknown>) : {};
const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

/** A positive money amount with at most 2 decimal places, stored the way the decimal columns are. */
export function moneyText(value: unknown): string | null {
  const raw = typeof value === "number" ? String(value) : typeof value === "string" ? value.replace(/,/g, "").trim() : "";
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) return null;
  const amount = Number(raw);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 9_999_999_999.99) return null;
  return amount.toFixed(2);
}

export function deductionTotalOf(amounts: string[]): string {
  const cents = amounts.reduce((sum, amount) => sum + Math.round(Number(amount) * 100), 0);
  return (cents / 100).toFixed(2);
}

/**
 * D16 (AC-8.4): the typed refund must equal the deposit minus the deductions.
 * Nothing is carried to a renewal here, and the system does not fill the amount in.
 */
export function settlementAllocation(received: string, deductions: string, refund: string) {
  const left = Math.round(Number(received) * 100) - Math.round(Number(deductions) * 100);
  const asked = Math.round(Number(refund) * 100);
  if (left < 0) throw new BadRequestException("ยอดหักมากกว่าเงินประกัน");
  if (asked !== left) throw new BadRequestException("ยอดคืนต้องเท่ากับเงินประกันที่เหลือหลังหัก");
  return {
    available: Number(received).toFixed(2),
    deductionTotal: Number(deductions).toFixed(2),
    carried: "0.00",
    refund: (asked / 100).toFixed(2),
  };
}

/** A deduction line cannot be approved until its evidence file is stored. */
export function assertDeductionsEvidenced(items: Array<{ evidence_reference?: string | null }>) {
  if (items.some((item) => !item.evidence_reference?.trim()))
    throw new BadRequestException("รายการหักต้องมีหลักฐาน");
}

/** The transfer back to the tenant is stored once. */
export function assertRefundOnce(status: string, refunded: boolean) {
  if (status === "completed" || refunded) throw new ConflictException("บันทึกคืนเงินแล้ว");
}

export function parseDeduction(input: unknown): { deduction_type: DepositDeductionType; description: string; amount: string } {
  const body = record(input);
  const deduction_type = body.deductionType ?? body.type;
  if (!TYPES.includes(deduction_type as DepositDeductionType))
    throw new BadRequestException("กรุณาเลือกประเภทรายการหัก");
  const description = text(body.description);
  if (!description || description.length > 1000) throw new BadRequestException("กรุณาระบุรายการหัก ไม่เกิน 1,000 ตัวอักษร");
  const amount = moneyText(body.amount);
  if (!amount) throw new BadRequestException("กรุณากรอกยอดหัก");
  return { deduction_type: deduction_type as DepositDeductionType, description, amount };
}

/** Zero is a valid refund (the deductions use the whole deposit) and is not a positive moneyText. */
export function parseRefundAmount(input: unknown): string {
  const body = record(input);
  const raw = body.refundAmount ?? body.amount;
  if (raw === 0 || raw === "0" || raw === "0.00") return "0.00";
  const amount = moneyText(raw);
  if (!amount) throw new BadRequestException("กรุณากรอกยอดคืน");
  return amount;
}

/**
 * D16 (AC-8.4 to 8.6): one deposit settlement per lease. Deductions need a photo.
 * Approving and recording the refund do not change the lease or the room, and the refund is recorded once.
 */
@Injectable()
export class DepositSettlementService {
  constructor(
    private readonly db: DataSource,
    private readonly contracts: AgentContractsService,
    @Optional() private readonly documents?: ContractDocumentStorageService,
  ) {}

  private storage() {
    if (!this.documents) throw new ServiceUnavailableException("ยังไม่ได้ตั้งค่าที่เก็บเอกสาร");
    return this.documents;
  }

  async agentView(agentId: number, id: number) {
    return this.present(await this.contracts.contractForAgent(agentId, id));
  }

  async partyView(userId: number, id: number) {
    return this.present((await this.contracts.contractForParty(userId, id)).contract);
  }

  /** Opens the draft from the paid deposit receipt. A renewal that is already linked has no settlement. */
  async open(agentId: number, id: number) {
    const c = await this.contracts.contractForAgent(agentId, id);
    const blocked = await this.gate(c);
    if (blocked) throw new BadRequestException(this.blockedMessage(blocked));
    const existing = await this.db.getRepository(ContractDepositSettlementEntity).findOneBy({ lease_contract_id: id });
    if (existing) return this.present(c, existing);
    const invoice = await this.depositReceipt(c);
    const received = invoice.total.toFixed(2);
    try {
      await this.db.getRepository(ContractDepositSettlementEntity).insert({
        lease_contract_id: id,
        deposit_received_amount: received,
        deposit_received_reference: invoice.path,
        available_deposit_amount: received,
        deduction_total: "0.00",
        carried_forward_total: "0.00",
        refund_amount: "0.00",
        status: "draft",
        created_by_user_id: agentId,
      });
    } catch (error) {
      if ((error as { code?: string }).code === "23505") return this.present(c);
      throw error;
    }
    return this.present(c);
  }

  async addItem(agentId: number, id: number, input: unknown, file: { buffer: Buffer; size: number } | undefined) {
    const item = parseDeduction(input);
    const c = await this.contracts.contractForAgent(agentId, id);
    const settlement = await this.draftOf(c);
    const stored = await this.storage().uploadHandoverPhoto(c.created_by_user_id, c.id, file);
    try {
      await this.db.transaction(async (manager) => {
        const current = await manager.findOne(ContractDepositSettlementEntity, {
          where: { id: settlement.id }, lock: { mode: "pessimistic_write" },
        });
        if (!current || current.status !== "draft") throw new ConflictException("อนุมัติแล้ว แก้ไขรายการหักไม่ได้");
        await manager.insert(DepositDeductionItemEntity, {
          settlement_id: current.id, ...item, evidence_reference: stored.path,
        });
      });
    } catch (error) {
      await this.documents?.remove(stored.path).catch(() => undefined);
      throw error;
    }
    return this.present(c);
  }

  async removeItem(agentId: number, id: number, itemId: number) {
    const c = await this.contracts.contractForAgent(agentId, id);
    const settlement = await this.draftOf(c);
    const removed = await this.db.transaction(async (manager) => {
      const current = await manager.findOne(ContractDepositSettlementEntity, {
        where: { id: settlement.id }, lock: { mode: "pessimistic_write" },
      });
      if (!current || current.status !== "draft") throw new ConflictException("อนุมัติแล้ว แก้ไขรายการหักไม่ได้");
      const item = await manager.findOne(DepositDeductionItemEntity, { where: { id: itemId, settlement_id: current.id } });
      if (!item) throw new NotFoundException("ไม่พบรายการหัก");
      await manager.delete(DepositDeductionItemEntity, { id: item.id });
      return item.evidence_reference;
    });
    if (removed) await this.documents?.remove(removed).catch(() => undefined);
    return this.present(c);
  }

  async approve(agentId: number, id: number, input: unknown) {
    const note = text(record(input).note ?? record(input).decisionNote);
    if (!note || note.length > 1000) throw new BadRequestException("กรุณาระบุหมายเหตุการอนุมัติ ไม่เกิน 1,000 ตัวอักษร");
    const refund = parseRefundAmount(input);
    const c = await this.contracts.contractForAgent(agentId, id);
    await this.db.transaction(async (manager) => {
      const settlement = await manager.findOne(ContractDepositSettlementEntity, {
        where: { lease_contract_id: id, created_by_user_id: agentId }, lock: { mode: "pessimistic_write" },
      });
      if (!settlement) throw new BadRequestException("เปิดรายการหักเงินประกันก่อน");
      if (settlement.status !== "draft") throw new ConflictException("อนุมัติรายการนี้แล้ว");
      const items = await manager.find(DepositDeductionItemEntity, { where: { settlement_id: settlement.id } });
      assertDeductionsEvidenced(items);
      const money = settlementAllocation(settlement.deposit_received_amount, deductionTotalOf(items.map((item) => item.amount)), refund);
      await manager.update(ContractDepositSettlementEntity, { id: settlement.id }, {
        available_deposit_amount: money.available,
        deduction_total: money.deductionTotal,
        carried_forward_total: money.carried,
        refund_amount: money.refund,
        decision_note: note,
        approved_by_user_id: agentId,
        approved_at: new Date(),
        status: money.refund === "0.00" ? "completed" : "approved",
      });
    });
    return this.present(c);
  }

  /** Records the money received from the landlord and the transfer to the tenant. Once only. */
  async complete(agentId: number, id: number, received: { buffer: Buffer; size: number } | undefined, transfer: { buffer: Buffer; size: number } | undefined) {
    const c = await this.contracts.contractForAgent(agentId, id);
    const settlement = await this.db.getRepository(ContractDepositSettlementEntity).findOneBy({ lease_contract_id: id, created_by_user_id: agentId });
    if (!settlement) throw new BadRequestException("เปิดรายการหักเงินประกันก่อน");
    assertRefundOnce(settlement.status, settlement.refunded_at != null);
    if (settlement.status !== "approved") throw new BadRequestException("อนุมัติยอดก่อน จึงบันทึกการคืนได้");
    if (Number(settlement.refund_amount) <= 0) throw new BadRequestException("ไม่มียอดที่ต้องโอนคืน");
    const storage = this.storage();
    const receivedFile = await storage.uploadPaymentSlip(agentId, received);
    const transferFile = await storage.uploadPaymentSlip(agentId, transfer).catch(async (error) => {
      await storage.remove(receivedFile.path).catch(() => undefined);
      throw error;
    });
    try {
      await this.db.transaction(async (manager) => {
        const current = await manager.findOne(ContractDepositSettlementEntity, {
          where: { id: settlement.id }, lock: { mode: "pessimistic_write" },
        });
        if (!current || current.status !== "approved" || current.refunded_at)
          throw new ConflictException("บันทึกคืนเงินแล้ว");
        await manager.update(ContractDepositSettlementEntity, { id: current.id }, {
          status: "completed",
          refunded_at: new Date(),
          return_received_reference: receivedFile.path,
          refund_reference: transferFile.path,
        });
      });
    } catch (error) {
      await storage.remove(receivedFile.path).catch(() => undefined);
      await storage.remove(transferFile.path).catch(() => undefined);
      throw error;
    }
    return this.present(c);
  }

  private async draftOf(c: LeaseContractEntity) {
    const settlement = await this.db.getRepository(ContractDepositSettlementEntity).findOneBy({
      lease_contract_id: c.id, created_by_user_id: c.created_by_user_id,
    });
    if (!settlement) throw new BadRequestException("เปิดรายการหักเงินประกันก่อน");
    if (settlement.status !== "draft") throw new ConflictException("อนุมัติแล้ว แก้ไขรายการหักไม่ได้");
    return settlement;
  }

  private async gate(c: LeaseContractEntity): Promise<DepositSettlementBlocked | null> {
    const successors = await this.db.getRepository(LeaseContractEntity).find({
      where: { previous_agreement_id: c.id }, select: { id: true, status: true },
    });
    const data = c.data as { notRenewing?: unknown; endsOn?: unknown } | null;
    const leaving = moveOutBlockedReason({
      formKind: c.template?.form_kind ?? c.agreement_type?.form_kind ?? null,
      status: c.status,
      endDate: c.end_date ? String(c.end_date).slice(0, 10) : null,
      notRenewing: Boolean(data?.notRenewing),
      endsOn: Boolean(data?.endsOn),
      hasSuccessor: successors.some((row) => row.status !== "cancelled"),
      today: bangkokToday(),
    });
    if (leaving && leaving !== "lease_not_issued" && leaving !== "deposit_unpaid") return leaving;
    const invoice = await this.db.getRepository(AgentInvoiceEntity).findOne({
      where: { lease_contract_id: c.id, invoice_kind: "deposit" },
    });
    if (!invoice?.receipt_pdf_path || !invoice.data?.items?.length) return "no_deposit";
    const total = financialTotals(invoice.data).total;
    if (!Number.isFinite(total) || total <= 0) return "no_deposit";
    return null;
  }

  private async depositReceipt(c: LeaseContractEntity) {
    const invoice = await this.db.getRepository(AgentInvoiceEntity).findOne({
      where: { lease_contract_id: c.id, invoice_kind: "deposit" },
    });
    if (!invoice?.receipt_pdf_path || !invoice.data?.items?.length)
      throw new BadRequestException("ยังไม่มีใบเสร็จเงินประกัน");
    const total = financialTotals(invoice.data).total;
    if (!Number.isFinite(total) || total <= 0) throw new BadRequestException("ยังไม่มีใบเสร็จเงินประกัน");
    return { total, path: invoice.receipt_pdf_path };
  }

  private blockedMessage(reason: DepositSettlementBlocked) {
    return {
      not_lease: "หักเงินประกันได้เฉพาะสัญญาเช่า",
      contract_ended: "สัญญานี้ยกเลิกแล้ว",
      not_leaving: "บันทึกหักเงินประกันได้เมื่อไม่ต่อสัญญา เลิกก่อนกำหนด หรือถึงวันสิ้นสุดแล้ว",
      has_successor: "มีหนังสือต่อสัญญาแล้ว ไม่มีรายการคืนเงินประกัน",
      no_deposit: "ยังไม่มีใบเสร็จเงินประกัน",
    }[reason];
  }

  private async present(c: LeaseContractEntity, known?: ContractDepositSettlementEntity): Promise<DepositSettlementView> {
    const settlement = known ?? await this.db.getRepository(ContractDepositSettlementEntity).findOneBy({ lease_contract_id: c.id });
    if (!settlement) {
      const blockedReason = await this.gate(c);
      return {
        contractId: c.id, status: blockedReason ? "blocked" : "not_started", blockedReason,
        depositReceived: null, deductionTotal: null, refundAmount: null, decisionNote: null,
        items: [], returnReceivedUrl: null, refundProofUrl: null, refundedAt: null,
      };
    }
    const items = await this.db.getRepository(DepositDeductionItemEntity).find({
      where: { settlement_id: settlement.id }, order: { id: "ASC" },
    });
    const paths = [settlement.return_received_reference, settlement.refund_reference, ...items.map((item) => item.evidence_reference)]
      .filter((path): path is string => Boolean(path));
    const urls = paths.length && this.documents ? await this.documents.signPaths(paths) : new Map<string, string>();
    return {
      contractId: c.id,
      status: settlement.status,
      blockedReason: null,
      depositReceived: Number(settlement.deposit_received_amount).toFixed(2),
      deductionTotal: Number(settlement.deduction_total).toFixed(2),
      refundAmount: Number(settlement.refund_amount).toFixed(2),
      decisionNote: settlement.decision_note,
      items: items.map((item) => ({
        id: item.id, type: item.deduction_type, description: item.description,
        amount: Number(item.amount).toFixed(2), evidenceUrl: urls.get(item.evidence_reference) ?? null,
      })),
      returnReceivedUrl: settlement.return_received_reference ? urls.get(settlement.return_received_reference) ?? null : null,
      refundProofUrl: settlement.refund_reference ? urls.get(settlement.refund_reference) ?? null : null,
      refundedAt: settlement.refunded_at ? settlement.refunded_at.toISOString() : null,
    };
  }
}
