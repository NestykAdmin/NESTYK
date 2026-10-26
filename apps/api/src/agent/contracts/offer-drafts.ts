import { ConflictException, ServiceUnavailableException } from "@nestjs/common";
import { randomBytes } from "crypto";
import { EntityManager, In, IsNull } from "typeorm";
import type { FinancialDocumentInput, LeaseAgreementInput, ReservationLetterInput } from "@nestyk/types";
import { LeaseContractEntity } from "../../entities/lease-contract.entity";
import { AgreementSignInviteEntity } from "../../entities/agreement-sign-invite.entity";
import type { ContractDocumentStorageService } from "./contract-document-storage.service";
import { financialTotals } from "./financial-document";
import { createFinancialPdf } from "./financial-pdf";
import { reservationInvoice } from "./reservation-invoice";
import { leaseAgreementSnapshot } from "./lease-agreement";
import { leaseTermEnd } from "./lease-term";
import { offerLeaseFields, offerReservationFields, plainAmount, type DealOfferRow } from "./deal-offers.service";

/**
 * D2 round 2 (AC-2.4, Aof 26 Oct 2026): when a confirmed offer changes, the documents of the deal that nobody has
 * signed yet take the new terms; documents signed by everyone keep theirs. A change is refused while the lease has
 * a signature, or while a reservation letter is signed by some but not all parties (Aof: sign or cancel it first).
 *
 * The booking money (AC-2.4, TC-2.04): before the tenant pays (or sends the slip), the reservation amount and its
 * invoice follow the new rent (1 month of rent). Once paid or the slip is sent, the amount stays what was paid; when
 * the new rent is lower the agent is warned to settle the difference with the tenant (the system computes none).
 */
export const OFFER_LEASE_SIGNED = "OFFER_LEASE_SIGNED";
export const OFFER_DOCUMENT_SIGNING = "OFFER_DOCUMENT_SIGNING";
export type OfferOfDeal = DealOfferRow & { lead_id: number; rent_room_id: number };
/** Files written inside the transaction (removed if it fails) and files they replace (removed after it commits). */
export type DraftFiles = { uploaded: string[]; replaced: string[] };
type Storage = Pick<ContractDocumentStorageService, "upload"> | undefined;

export const CLOSED_CONTRACT: readonly string[] = ["cancelled", "expired", "terminated"];
export const formKindOf = (c: Pick<LeaseContractEntity, "template" | "agreement_type">) =>
  c.template?.form_kind ?? c.agreement_type?.form_kind ?? null;
export const hasSignature = (c: Pick<LeaseContractEntity, "owner_signed_at" | "tenant_signed_at" | "agent_signed_at">) =>
  Boolean(c.owner_signed_at || c.tenant_signed_at || c.agent_signed_at);
/** A reservation the tenant paid, or sent the slip for (counts as paid, AC-2.4), and the amount on its invoice. */
export function paidReservationAmount(c: Pick<LeaseContractEntity, "receipt_url" | "data">) {
  const slip = (c.data?.reservationPayment as { slipPath?: string } | undefined)?.slipPath;
  const invoice = (c.data?.financialDocuments as { invoice?: FinancialDocumentInput } | undefined)?.invoice;
  return (c.receipt_url || slip) && invoice ? financialTotals(invoice).total : null;
}

function revokeInvites(manager: EntityManager, id: number) {
  return manager.update(AgreementSignInviteEntity,
    { agreement_id: id, used_at: IsNull(), revoked_at: IsNull() }, { revoked_at: new Date() });
}

/**
 * The reservation letter, its numbers and (when not paid yet) its invoice take the offer's terms. The invoice keeps
 * its number and date. Used after a change of the offer and after a returned slip (the tenant then pays the new amount).
 */
export async function refreshReservationDraft(manager: EntityManager, documents: Storage, agentId: number,
  c: LeaseContractEntity, offer: DealOfferRow, files: DraftFiles) {
  const paid = paidReservationAmount(c);
  const letter = c.data?.reservationLetter as ReservationLetterInput | undefined;
  const nextLetter = letter
    ? {
        ...letter,
        ...offerReservationFields(offer),
        ...(paid != null ? { reservationPayment: plainAmount(paid.toFixed(2)), advanceAmount: plainAmount(paid.toFixed(2)) } : {}),
      }
    : undefined;
  const start = String(offer.start_date).slice(0, 10);
  const issued = letter?.issueDate;
  const data: Record<string, unknown> = {
    ...c.data,
    ...(nextLetter ? { reservationLetter: nextLetter } : {}),
    draftRevision: randomBytes(16).toString("hex"),
  };
  const patch: Record<string, unknown> = {
    data,
    reservation_fee: paid != null ? c.reservation_fee : Number(offer.monthly_rent).toFixed(2),
    monthly_rent: offer.monthly_rent,
    deposit: offer.deposit_amount,
    move_in_date: issued && start < issued ? issued : start,
    document_url: null,
  };
  const financial = c.data?.financialDocuments as ({ invoice?: FinancialDocumentInput } & Record<string, unknown>) | undefined;
  if (paid == null && financial?.invoice && c.invoice_url) {
    if (!documents) throw new ServiceUnavailableException("ยังไม่ได้ตั้งค่าที่เก็บเอกสารใบแจ้งหนี้ค่าจอง");
    const invoice = reservationInvoice({ ...c, ...patch, data: { ...data, financialDocuments: financial } } as LeaseContractEntity);
    const pdf = await createFinancialPdf("invoice", invoice);
    const stored = await documents.upload(agentId, c.id, "invoice", { buffer: pdf, size: pdf.length });
    files.uploaded.push(stored.path);
    files.replaced.push(c.invoice_url);
    patch.invoice_url = stored.path;
    data.financialDocuments = { ...financial, invoice };
    data.documentFileNames = { ...((c.data?.documentFileNames as object) ?? {}), invoice: `invoice-${invoice.documentNo}.pdf` };
  }
  await manager.update(LeaseContractEntity, { id: c.id }, patch);
  await revokeInvites(manager, c.id);
}

async function refreshLeaseDraft(manager: EntityManager, c: LeaseContractEntity, offer: DealOfferRow) {
  const lease = c.data?.leaseAgreement as LeaseAgreementInput | undefined;
  const start = String(offer.start_date).slice(0, 10);
  await manager.update(LeaseContractEntity, { id: c.id }, {
    data: {
      ...c.data,
      ...(lease ? { leaseAgreement: leaseAgreementSnapshot({ ...lease, ...offerLeaseFields(offer) } as LeaseAgreementInput) } : {}),
      draftRevision: randomBytes(16).toString("hex"),
    },
    monthly_rent: offer.monthly_rent,
    deposit: offer.deposit_amount,
    start_date: start,
    end_date: leaseTermEnd(start, offer.term_months),
    document_url: null,
  });
  await revokeInvites(manager, c.id);
}

/**
 * Applies a changed offer to the open reservation letters and leases of its deal (the agent's, for the same lead and
 * room). The deal's agreements are locked first and all checks run before anything is written.
 */
export async function refreshDealDrafts(manager: EntityManager, documents: Storage, agentId: number,
  offer: OfferOfDeal, files: DraftFiles) {
  const locked = await manager.find(LeaseContractEntity, {
    where: { created_by_user_id: agentId, lead_id: offer.lead_id, rent_room_id: offer.rent_room_id },
    order: { id: "ASC" },
    lock: { mode: "pessimistic_write" },
  });
  if (!locked.length) return;
  // Postgres cannot lock the nullable side of a join, so the form kinds are read after the lock.
  const rows = (await manager.find(LeaseContractEntity, {
    where: { id: In(locked.map((row) => row.id)) },
    // The tenant and the room are read too: a rebuilt booking invoice falls back to them (as saving the draft does).
    relations: { template: true, agreement_type: true, tenant: true, rent_room: { property: true } },
    order: { id: "ASC" },
  })).filter((c) => !CLOSED_CONTRACT.includes(c.status));
  for (const c of rows) {
    const kind = formKindOf(c);
    if (kind === "lease" && hasSignature(c))
      throw new ConflictException({ code: OFFER_LEASE_SIGNED, message: "สัญญาเช่าของดีลนี้มีลายเซ็นแล้ว แก้ข้อเสนอไม่ได้" });
    if (kind === "reservation" && hasSignature(c) && ["draft", "awaiting_signatures"].includes(c.status))
      throw new ConflictException({
        code: OFFER_DOCUMENT_SIGNING,
        message: "หนังสือจองของดีลนี้ลงนามไปบางฝ่ายแล้ว ต้องลงนามให้ครบหรือยกเลิกก่อน จึงจะแก้ข้อเสนอได้",
      });
  }
  for (const c of rows) {
    const kind = formKindOf(c);
    if (kind === "lease") await refreshLeaseDraft(manager, c, offer);
    else if (kind === "reservation" && !hasSignature(c)) await refreshReservationDraft(manager, documents, agentId, c, offer, files);
  }
}
