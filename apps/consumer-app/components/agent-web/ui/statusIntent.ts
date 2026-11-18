import type { MobileStatusPillTone } from "@nestyk/ui/native";
import type {
  AgentTenantBillStatus,
  LeadDisplayStatus,
  LeadViewingStatus,
} from "@nestyk/types";
import type { TenantWorkKind } from "../../../lib/tenant-work";

/**
 * Five status levels shared by every agent web page.
 * attn = you must act · prog = in progress / waiting on others · done = ready / complete
 * neutral = nothing to do / closed · crit = overdue, error or must fix (red only for these)
 * Rule: a badge always carries text; at most one coloured badge per row.
 */
export type StatusIntent = "attn" | "prog" | "done" | "neutral" | "crit";

export type StatusIntentTone = MobileStatusPillTone & { dot: string; border: string };

export const STATUS_INTENTS: readonly StatusIntent[] = ["attn", "prog", "done", "neutral", "crit"];

export const STATUS_INTENT_TONES: Record<StatusIntent, StatusIntentTone> = {
  // Colour system v1.2 (12 Nov 2026): same values as the app's STATUS_PILL_TONES (rose, purple, green, slate, red);
  // badges have no border (`border` is kept for filter chips and outlines). Dark mode comes from `pillToneFor`.
  attn: { bg: "#FFF0C4", fg: "#211E1E", dot: "#F8B615", border: "#FCDE96" },
  prog: { bg: "#211E1E", fg: "#FFFFFF", dot: "#F8B615", border: "#211E1E" },
  done: { bg: "#DCFCE7", fg: "#166534", dot: "#15803D", border: "#BBF7D0" },
  neutral: { bg: "#E2E8F0", fg: "#334155", dot: "#64748B", border: "#CBD5E1" },
  crit: { bg: "#FEE2E2", fg: "#991B1B", dot: "#B91C1C", border: "#FECACA" },
};

const ROOM: Record<string, StatusIntent> = {
  available: "done",
  booked: "prog",
  rented: "neutral",
  needs_edit: "crit",
};

const LEAD: Record<LeadDisplayStatus, StatusIntent> = {
  new: "attn",
  inprogress: "prog",
  viewing: "prog",
  booked: "done",
  lost: "neutral",
};

const BILL: Record<AgentTenantBillStatus, StatusIntent> = {
  pending: "prog",
  awaiting_review: "attn",
  overdue: "crit",
  paid: "done",
};

const WORK: Record<TenantWorkKind, StatusIntent> = {
  slip: "attn",
  overdue: "crit",
  signing: "prog",
  renewal: "attn",
};

/** Room listing status code (`available`, `booked`, `rented`, `needs_edit`). Unknown → neutral. */
export function roomStatusIntent(code: string | null | undefined): StatusIntent {
  return (code && ROOM[code]) || "neutral";
}

export function leadStatusIntent(status: LeadDisplayStatus | string | null | undefined): StatusIntent {
  return (status && LEAD[status as LeadDisplayStatus]) || "neutral";
}

export function billStatusIntent(status: AgentTenantBillStatus | string | null | undefined): StatusIntent {
  return (status && BILL[status as AgentTenantBillStatus]) || "neutral";
}

export function tenantWorkIntent(kind: TenantWorkKind | string | null | undefined): StatusIntent {
  return (kind && WORK[kind as TenantWorkKind]) || "neutral";
}

/** A scheduled viewing whose time has passed reads as "attn" (เลยเวลานัด). */
export function viewingIntent(
  status: LeadViewingStatus | string | null | undefined,
  scheduledAt?: string | null,
  now: Date = new Date(),
): StatusIntent {
  if (status === "done") return "done";
  if (status === "cancelled") return "neutral";
  if (status === "scheduled") {
    const at = scheduledAt ? Date.parse(scheduledAt) : NaN;
    return Number.isFinite(at) && at < now.getTime() ? "attn" : "prog";
  }
  return "neutral";
}
