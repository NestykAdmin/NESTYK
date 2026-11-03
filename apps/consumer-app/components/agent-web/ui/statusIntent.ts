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
  attn: { bg: "#FFF3CC", fg: "#6B4A00", dot: "#D99A0D", border: "#F4DC95" },
  prog: { bg: "#FFFFFF", fg: "#211E1E", dot: "#211E1E", border: "#211E1E" },
  done: { bg: "#EAF5EE", fg: "#1F6B43", dot: "#1F6B43", border: "#CFE6D8" },
  neutral: { bg: "#F1F5F9", fg: "#475569", dot: "#94A3B8", border: "#E2E8F0" },
  crit: { bg: "#FDECEC", fg: "#B42318", dot: "#B42318", border: "#F7C9C5" },
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
