import type { LeaseContractEntity } from "../../entities/lease-contract.entity";
import type { TenantEntity } from "../../entities/tenant.entity";
import { reservationTenantFields } from "../contracts/reservation-letter";

/**
 * The tenant details a draft should carry after the agent edits the tenant: the party snapshot and the
 * tenant fields of a saved reservation letter (both are refilled from the tenant record on every draft
 * save anyway). Lease agreement fields are left alone because the agent types those in the form.
 * Returns null when the draft already has these values, so an unrelated edit (a note) changes nothing.
 * Which drafts may change, and the booking invoice, are handled by
 * AgentContractsService.saveTenantAndRefreshDrafts.
 */
export function tenantDraftPatch(
  draft: Pick<LeaseContractEntity, "data" | "party_snapshot">,
  tenant: TenantEntity,
): { data: Record<string, unknown>; party_snapshot: Record<string, unknown> } | null {
  const snapshot = {
    ...(draft.party_snapshot ?? {}),
    tenantName: tenant.name,
    tenantPhone: tenant.phone,
    tenantEmail: tenant.email,
    tenantIdNumber: tenant.identity_number,
    tenantNationality: tenant.nationality,
  };
  const data = { ...(draft.data ?? {}) };
  const letter = data.reservationLetter;
  if (letter && typeof letter === "object" && !Array.isArray(letter))
    data.reservationLetter = { ...(letter as Record<string, unknown>), ...reservationTenantFields(tenant) };
  // A booking invoice that still names someone else also needs the refresh.
  const invoice = (data.financialDocuments as { invoice?: Record<string, unknown> } | undefined)?.invoice;
  const letterFields = reservationTenantFields(tenant);
  const invoiceCurrent =
    !invoice ||
    (invoice.customerName === letterFields.tenantName &&
      invoice.customerPhone === letterFields.tenantPhone &&
      invoice.customerEmail === letterFields.tenantEmail);
  const same =
    invoiceCurrent &&
    JSON.stringify(snapshot) === JSON.stringify(draft.party_snapshot ?? {}) &&
    JSON.stringify(data) === JSON.stringify(draft.data ?? {});
  return same ? null : { data, party_snapshot: snapshot };
}
