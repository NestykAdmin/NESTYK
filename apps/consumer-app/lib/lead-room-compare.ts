/**
 * Lead vs room on the criteria of the lead form's "จับคู่ห้อง" tab (matching.md §5.1).
 * The API computes these rows (`apps/api/src/agent/leads/lead-matching.ts`); this file only types and reads them.
 */

export type CompareStatus =
  | 'pass'
  | 'near'
  | 'mismatch'
  | 'later'
  /** The lead did not fill this in. */
  | 'unspecified'
  /** The room has no data for this. */
  | 'unknown'
  /** The lead's value cannot be compared (free-text move-in). */
  | 'notEvaluable';

type Row<S extends CompareStatus, T> = T & {
  status: S;
  /** 0–100, or null when excluded from the average. */
  score: number | null;
};

export type LeadRoomComparison = {
  /** `headroom` = budget max − price (≥ 0 after the hard filter). */
  budget: Row<'pass', { price: number; headroom: number | null }>;
  /** `score` = `distanceScore` × `pinWeight`. */
  location: Row<
    'pass' | 'near',
    { distanceKm: number; overKm: number; pinName: string; pinRank: number; distanceScore: number; pinWeight: number }
  >;
  roomType: Row<CompareStatus, { want: string | null; have: string | null }>;
  lease: Row<CompareStatus, { want: number | null; terms: number[] }>;
  moveIn: Row<CompareStatus, { want: string | null; availableFrom: string | null; daysLate: number }>;
};

export type CompareKey = keyof LeadRoomComparison;

export const COMPARE_KEYS: CompareKey[] = ['budget', 'location', 'roomType', 'lease', 'moveIn'];

export function roomLayoutValue(room: { layout: Array<{ code: string; value: string }> } | null, code: string): string | null {
  return room?.layout.find((item) => item.code === code)?.value?.trim() || null;
}

export type CriterionTone = 'green' | 'yellow' | 'red' | 'slate';

/** Colour from the row's own score as displayed (rounded): 100 green, 1–99 yellow, 0 red, unjudged slate. */
export function criterionTone(score: number | null): CriterionTone {
  if (score == null) return 'slate';
  const shown = Math.round(score);
  if (shown >= 100) return 'green';
  return shown <= 0 ? 'red' : 'yellow';
}

export type ComparisonSummary = {
  passed: number;
  /** Judged criteria that did not fully pass, in display order. */
  issues: CompareKey[];
  /** Filled in by the lead but not comparable yet. */
  unknown: CompareKey[];
};

export function summarizeComparison(comparison: LeadRoomComparison): ComparisonSummary {
  const summary: ComparisonSummary = { passed: 0, issues: [], unknown: [] };
  for (const key of COMPARE_KEYS) {
    const status = comparison[key].status;
    if (status === 'pass') summary.passed += 1;
    else if (status === 'near' || status === 'mismatch' || status === 'later') summary.issues.push(key);
    else if (status === 'unknown' || status === 'notEvaluable') summary.unknown.push(key);
  }
  return summary;
}
