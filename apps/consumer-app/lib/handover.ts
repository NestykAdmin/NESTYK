import type {
  HandoverItemCondition,
  HandoverRecord,
  HandoverSignParty,
  SaveHandover,
} from "@nestyk/types";
import { isIsoDate } from "./lease-term";

/**
 * D6 (AC-6.1 to 6.4): the handover form the agent fills in. The same rules as validateHandover in
 * apps/api/src/agent/contracts/handover.service.ts, checked here so the message shows beside the field.
 */
export const HANDOVER_MAX_PHOTOS = 30;
export const HANDOVER_MAX_ITEMS = 100;
export const HANDOVER_CONDITIONS: readonly HandoverItemCondition[] = ["good", "damaged", "missing"];
export const HANDOVER_SIGN_PARTIES: readonly HandoverSignParty[] = ["owner", "tenant"];

/** Quantity is the text in the field, so a half-typed number is kept while typing. */
export type HandoverItemDraft = { name: string; quantity: string; condition: HandoverItemCondition; note: string; moveInItemId?: number };
export type HandoverDraft = { handoverDate: string; note: string; items: HandoverItemDraft[] };
export type HandoverItemIssue = Partial<Record<"name" | "quantity" | "note", true>>;
export type HandoverFormIssues = {
  handoverDate?: true;
  note?: true;
  tooManyItems?: true;
  items: Record<number, HandoverItemIssue>;
};

export function emptyHandoverItem(): HandoverItemDraft {
  return { name: "", quantity: "1", condition: "good", note: "" };
}

/** The form starts from the saved record, or from the lease start date when nothing is saved yet. */
export function handoverDraft(record: HandoverRecord | null, defaultDate = ""): HandoverDraft {
  return {
    handoverDate: record?.handoverDate ?? defaultDate,
    note: record?.note ?? "",
    items: (record?.items ?? []).map((item) => ({
      name: item.name,
      quantity: String(item.quantity),
      condition: item.condition,
      note: item.note ?? "",
      ...(item.moveInItemId ? { moveInItemId: item.moveInItemId } : {}),
    })),
  };
}

export function handoverFormIssues(draft: HandoverDraft): HandoverFormIssues {
  const issues: HandoverFormIssues = { items: {} };
  if (!isIsoDate(draft.handoverDate.trim())) issues.handoverDate = true;
  if (draft.note.trim().length > 1000) issues.note = true;
  if (draft.items.length > HANDOVER_MAX_ITEMS) issues.tooManyItems = true;
  draft.items.forEach((item, index) => {
    const row: HandoverItemIssue = {};
    const name = item.name.trim();
    if (!name || name.length > 120) row.name = true;
    if (!/^\d{1,3}$/.test(item.quantity.trim()) || Number(item.quantity) < 1) row.quantity = true;
    const note = item.note.trim();
    if (note.length > 500 || (item.condition !== "good" && !note)) row.note = true;
    if (Object.keys(row).length) issues.items[index] = row;
  });
  return issues;
}

export function handoverFormValid(issues: HandoverFormIssues) {
  return !issues.handoverDate && !issues.note && !issues.tooManyItems && !Object.keys(issues.items).length;
}

/** The request body; `revision` is the one the agent edited (0 before the first save). */
export function handoverBody(draft: HandoverDraft, revision: number): SaveHandover {
  return {
    handoverDate: draft.handoverDate.trim(),
    note: draft.note.trim() || null,
    items: draft.items.map((item) => ({
      name: item.name.trim(),
      quantity: Number(item.quantity.trim()),
      condition: item.condition,
      note: item.note.trim() || null,
      ...(item.moveInItemId ? { moveInItemId: item.moveInItemId } : {}),
    })),
    revision,
  };
}

export function handoverSignedAt(record: HandoverRecord, party: HandoverSignParty) {
  return record.signatures.find((row) => row.party === party) ?? null;
}

/**
 * Why a party cannot sign yet: null when they can. The API checks the same (a date, at least 1 photo,
 * not signed yet, and a record that is open and not complete).
 */
export function handoverSignBlocker(
  record: HandoverRecord,
  party: HandoverSignParty,
): "not_open" | "signed" | "needs_date" | "needs_photo" | null {
  if (record.status !== "in_progress") return "not_open";
  if (handoverSignedAt(record, party)) return "signed";
  if (!record.handoverDate) return "needs_date";
  if (!record.photos.length) return "needs_photo";
  return null;
}

/** The agent can change the record while it is open and not signed by both. */
export function handoverEditable(record: HandoverRecord) {
  return record.status === "not_started" || record.status === "in_progress";
}
