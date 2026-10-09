import type { TenantLeadOption, UpdateAgentTenant } from "@nestyk/types";

/** A tenant's contact details as typed when a room is booked. */
export type TenantProfileForm = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  identityNumber: string;
  nationality: string;
  note: string;
};

export type TenantProfileField = keyof TenantProfileForm;

/** Why a field was refused; the screen turns it into a message. */
export type TenantProfileIssue = "required" | "phone" | "email" | "identity";

/** Longest value the API accepts per field. */
export const TENANT_PROFILE_MAX: Record<TenantProfileField, number> = {
  firstName: 255,
  lastName: 255,
  phone: 50,
  email: 255,
  identityNumber: 100,
  nationality: 120,
  note: 500,
};

/** A new tenant starts as a copy of the lead's contact details. */
export function tenantProfileFromLead(
  lead: TenantLeadOption,
): TenantProfileForm {
  const parts = lead.name.trim().split(/\s+/);
  return {
    firstName: lead.firstName || parts[0] || "",
    lastName: lead.lastName || parts.slice(1).join(" "),
    phone: lead.phone,
    email: lead.email || "",
    identityNumber: "",
    nationality: lead.nationality || "",
    note: "",
  };
}

/**
 * The API's rules (`parseTenantProfile` in apps/api agent-tenants.service.ts), checked here first
 * so the message shows beside the field instead of after the request. One rule is stricter: a
 * first name is required, where the API would take a lone last name as the first name.
 */
export function tenantProfileIssues(
  form: TenantProfileForm,
): Partial<Record<TenantProfileField, TenantProfileIssue>> {
  const issues: Partial<Record<TenantProfileField, TenantProfileIssue>> = {};
  if (!form.firstName.trim()) issues.firstName = "required";
  const phone = form.phone.trim();
  const digits = phone.replace(/\D/g, "");
  if (!phone) issues.phone = "required";
  else if (
    !/^[+\d\s().-]+$/.test(phone) ||
    digits.length < 7 ||
    digits.length > 15
  )
    issues.phone = "phone";
  const email = form.email.trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    issues.email = "email";
  const identity = form.identityNumber.trim();
  if (identity && !/^[A-Za-z0-9][A-Za-z0-9\s/-]{4,99}$/.test(identity))
    issues.identityNumber = "identity";
  return issues;
}

/** Request body for POST / PATCH /agent/tenants. */
export function tenantProfileBody(form: TenantProfileForm): UpdateAgentTenant {
  const firstName = form.firstName.trim();
  const lastName = form.lastName.trim();
  return {
    name: [firstName, lastName].filter(Boolean).join(" "),
    firstName,
    lastName,
    phone: form.phone.trim(),
    email: form.email.trim(),
    note: form.note.trim(),
    identityNumber: form.identityNumber.trim(),
    nationality: form.nationality.trim(),
  };
}
