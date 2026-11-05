/**
 * "ใหม่" tag on a lead (Mos 5 Nov 2026): shown from creation until anything changes the lead. Editing, running a match
 * and booking or changing a viewing all move the lead's updated_at (agent-leads / lead-matching / lead-viewings
 * services), so the tag goes away on the first of them. The status `new` itself now reads "ปกติ".
 */
export const FRESH_LEAD_WINDOW_MS = 5_000;

export function leadIsFresh(lead: { status?: string | null; createdAt?: string | null; updatedAt?: string | null }): boolean {
  // A status change is a change too (seed rows can be booked with updated_at = created_at).
  if (lead.status !== 'new' || !lead.createdAt || !lead.updatedAt) return false;
  const created = Date.parse(lead.createdAt);
  const updated = Date.parse(lead.updatedAt);
  if (!Number.isFinite(created) || !Number.isFinite(updated)) return false;
  // Creating a lead can write updated_at a few ms after created_at (pins saved in the same request).
  return updated - created < FRESH_LEAD_WINDOW_MS;
}
