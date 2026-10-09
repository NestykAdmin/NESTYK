import { createHash } from 'node:crypto';
import { BadRequestException } from '@nestjs/common';
import type { LeadMatchSettings } from '@nestyk/types';

/**
 * Lead ↔ room scoring (docs/new-project/agent/leads/matching.md §5.1, match-settings.md).
 * Bump SCORING_VERSION whenever a score for the same inputs would change, so stored runs read as stale.
 */
export const SCORING_VERSION = 1;

/** Same as `LEAD_MATCH_MIN_SCORE` in @nestyk/types. */
export const MATCH_MIN_SCORE_RANGE = { min: 0, max: 100, step: 5, gap: 5 };
export const MATCH_MAX_RESULTS_OPTIONS = [10, 20, 50, 100];
export const MATCH_DEFAULT_SETTINGS: LeadMatchSettings = { minScore: 50, maxScore: 100, maxResults: 10 };

/** Rooms up to this multiple of the lead's radius still qualify, with a falling distance score. */
export const RADIUS_MULTIPLIER = 2;
export const PIN_RANK_WEIGHTS: Record<number, number> = { 1: 1, 2: 0.85, 3: 0.7 };
export const MOVE_IN_GRACE_DAYS = 30;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}/;
const DAY_MS = 86_400_000;
const KM_PER_DEGREE = 111.32;

export type MatchLead = {
  budgetMax: number | null;
  radiusKm: number | null;
  pins: Array<{ rank: number; name: string; latitude: number; longitude: number }>;
  leaseDurationMonths: number | null;
  desiredRoomTypeCode: string | null;
  moveInPlan: string | null;
};

export type MatchRoom = {
  id: number;
  latitude: number | null;
  longitude: number | null;
  prices: Array<{ termMonths?: number | null; price: number }>;
  roomTypeCode: string | null;
  availableFromDate: string | null;
};

export type CompareStatus = 'pass' | 'near' | 'mismatch' | 'later' | 'unspecified' | 'unknown' | 'notEvaluable';

type Row<S extends CompareStatus, T> = T & { status: S; score: number | null };

export type LeadRoomComparison = {
  budget: Row<'pass', { price: number; headroom: number | null }>;
  location: Row<
    'pass' | 'near',
    { distanceKm: number; overKm: number; pinName: string; pinRank: number; distanceScore: number; pinWeight: number }
  >;
  roomType: Row<CompareStatus, { want: string | null; have: string | null }>;
  lease: Row<CompareStatus, { want: number | null; terms: number[] }>;
  moveIn: Row<CompareStatus, { want: string | null; availableFrom: string | null; daysLate: number }>;
};

const COMPARE_KEYS: Array<keyof LeadRoomComparison> = ['budget', 'location', 'roomType', 'lease', 'moveIn'];

export type RoomMatch = {
  roomId: number;
  score: number;
  locationScore: number;
  price: number;
  termMonths: number | null;
  distanceKm: number;
  pinRank: number;
  comparison: LeadRoomComparison;
};

export function leadMatchReady(lead: MatchLead): boolean {
  return !!lead.budgetMax && lead.budgetMax > 0 && lead.pins.length > 0 && lead.radiusKm != null;
}

function isScore(value: unknown): value is number {
  const { min, max, step } = MATCH_MIN_SCORE_RANGE;
  return Number.isInteger(value) && (value as number) >= min && (value as number) <= max && ((value as number) - min) % step === 0;
}

/** The merged settings must leave a score range of at least `gap`. */
export function assertScoreRange(settings: LeadMatchSettings): void {
  if (settings.maxScore - settings.minScore < MATCH_MIN_SCORE_RANGE.gap) {
    throw new BadRequestException(`maxScore must be at least ${MATCH_MIN_SCORE_RANGE.gap} above minScore`);
  }
}

export function validateMatchSettings(input: unknown): Partial<LeadMatchSettings> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new BadRequestException('Match settings are required');
  const body = input as Record<string, unknown>;
  const result: Partial<LeadMatchSettings> = {};
  for (const key of ['minScore', 'maxScore'] as const) {
    if (body[key] == null) continue;
    const score = body[key];
    if (!isScore(score)) {
      const { min, max, step } = MATCH_MIN_SCORE_RANGE;
      throw new BadRequestException(`${key} must be ${min}–${max} in steps of ${step}`);
    }
    result[key] = score;
  }
  if (body.maxResults != null) {
    if (!MATCH_MAX_RESULTS_OPTIONS.includes(body.maxResults as number)) throw new BadRequestException(`maxResults must be one of ${MATCH_MAX_RESULTS_OPTIONS.join(', ')}`);
    result.maxResults = body.maxResults as number;
  }
  return result;
}

/** Saved values over defaults; anything stored that is no longer an option falls back to the default. */
export function effectiveMatchSettings(saved: unknown): LeadMatchSettings {
  const raw = saved && typeof saved === 'object' && !Array.isArray(saved) ? (saved as Record<string, unknown>) : {};
  const { max, gap } = MATCH_MIN_SCORE_RANGE;
  const minScore = isScore(raw.minScore) && raw.minScore <= max - gap ? raw.minScore : MATCH_DEFAULT_SETTINGS.minScore;
  return {
    minScore,
    maxScore: isScore(raw.maxScore) && raw.maxScore - minScore >= gap ? raw.maxScore : MATCH_DEFAULT_SETTINGS.maxScore,
    maxResults: MATCH_MAX_RESULTS_OPTIONS.includes(raw.maxResults as number) ? (raw.maxResults as number) : MATCH_DEFAULT_SETTINGS.maxResults,
  };
}

/** Fingerprint of everything a run's result depends on except the room inventory. */
export function matchInputHash(lead: MatchLead, settings: LeadMatchSettings): string {
  const payload = {
    v: SCORING_VERSION,
    budgetMax: lead.budgetMax,
    radiusKm: lead.radiusKm,
    pins: [...lead.pins].sort((a, b) => a.rank - b.rank).map((p) => [p.rank, p.name, p.latitude, p.longitude]),
    lease: lead.leaseDurationMonths,
    roomType: lead.desiredRoomTypeCode,
    moveIn: lead.moveInPlan?.trim() || null,
    minScore: settings.minScore,
    maxResults: settings.maxResults,
    // Only when set, so runs saved before `maxScore` existed keep their fingerprint.
    ...(settings.maxScore !== MATCH_MIN_SCORE_RANGE.max ? { maxScore: settings.maxScore } : {}),
  };
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

/** Lat/lng boxes around each pin that contain every room within the matching distance. */
export function pinSearchBoxes(lead: MatchLead) {
  const reachKm = (lead.radiusKm ?? 0) * RADIUS_MULTIPLIER;
  return lead.pins.map((pin) => {
    const dLat = reachKm / KM_PER_DEGREE;
    const dLng = reachKm / (KM_PER_DEGREE * Math.max(Math.cos((pin.latitude * Math.PI) / 180), 0.01));
    return {
      minLat: pin.latitude - dLat * 1.01,
      maxLat: pin.latitude + dLat * 1.01,
      minLng: pin.longitude - dLng * 1.01,
      maxLng: pin.longitude + dLng * 1.01,
    };
  });
}

export function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad;
  const dLng = (bLng - aLng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Price for the lead's lease term when the room offers it, otherwise the cheapest price
 * (a missing term is scored by the lease criterion, not filtered out).
 */
function comparablePrice(room: MatchRoom, lead: MatchLead) {
  const prices = room.prices.filter((p) => Number.isFinite(p.price) && p.price > 0);
  const forTerm = lead.leaseDurationMonths != null ? prices.filter((p) => p.termMonths === lead.leaseDurationMonths) : [];
  const best = [...(forTerm.length ? forTerm : prices)].sort((a, b) => a.price - b.price)[0];
  return best ? { price: best.price, termMonths: best.termMonths ?? null } : null;
}

function isoDay(value: string): number {
  return Date.UTC(Number(value.slice(0, 4)), Number(value.slice(5, 7)) - 1, Number(value.slice(8, 10)));
}

type Located = {
  price: number;
  locationScore: number;
  distanceScore: number;
  pinWeight: number;
  distanceKm: number;
  withinRadius: boolean;
  pin: { name: string; rank: number };
};

export function compareLeadRoom(lead: MatchLead, located: Located, room: MatchRoom): LeadRoomComparison {
  const roomTypeWant = lead.desiredRoomTypeCode ?? null;
  const roomTypeHave = room.roomTypeCode ?? null;
  const roomTypeStatus: CompareStatus = !roomTypeWant
    ? 'unspecified'
    : !roomTypeHave
      ? 'unknown'
      : roomTypeWant === roomTypeHave
        ? 'pass'
        : 'mismatch';

  const terms = [
    ...new Set(room.prices.map((p) => p.termMonths).filter((m): m is number => m != null && m > 0)),
  ].sort((a, b) => a - b);
  const leaseWant = lead.leaseDurationMonths ?? null;
  const leaseStatus: CompareStatus =
    leaseWant == null ? 'unspecified' : !terms.length ? 'unknown' : terms.includes(leaseWant) ? 'pass' : 'mismatch';

  const moveInWant = lead.moveInPlan?.trim() || null;
  const availableFrom = room.availableFromDate ? room.availableFromDate.slice(0, 10) : null;
  let moveInStatus: CompareStatus;
  let daysLate = 0;
  if (!moveInWant) moveInStatus = 'unspecified';
  else if (!ISO_DATE.test(moveInWant)) moveInStatus = 'notEvaluable';
  else if (!availableFrom || !ISO_DATE.test(availableFrom)) moveInStatus = 'unknown';
  else {
    daysLate = Math.max(0, Math.round((isoDay(availableFrom) - isoDay(moveInWant)) / DAY_MS));
    moveInStatus = daysLate === 0 ? 'pass' : 'later';
  }

  const binary = (status: CompareStatus) => (status === 'pass' ? 100 : status === 'mismatch' ? 0 : null);
  const radius = lead.radiusKm ?? 0;

  return {
    budget: {
      status: 'pass',
      score: 100,
      price: located.price,
      headroom: lead.budgetMax != null ? Math.max(0, lead.budgetMax - located.price) : null,
    },
    location: {
      status: located.withinRadius ? 'pass' : 'near',
      score: located.locationScore,
      distanceKm: located.distanceKm,
      overKm: Math.max(0, located.distanceKm - radius),
      pinName: located.pin.name,
      pinRank: located.pin.rank,
      distanceScore: located.distanceScore,
      pinWeight: located.pinWeight,
    },
    roomType: { status: roomTypeStatus, score: binary(roomTypeStatus), want: roomTypeWant, have: roomTypeHave },
    lease: { status: leaseStatus, score: binary(leaseStatus), want: leaseWant, terms },
    moveIn: {
      status: moveInStatus,
      score:
        moveInStatus === 'pass' || moveInStatus === 'later'
          ? Math.max(0, 100 * (1 - daysLate / MOVE_IN_GRACE_DAYS))
          : null,
      want: moveInWant,
      availableFrom,
      daysLate,
    },
  };
}

/** Equal-weight average of the criteria that could be judged. */
export function overallScore(comparison: LeadRoomComparison): number {
  const scores = COMPARE_KEYS.map((key) => comparison[key].score).filter((s): s is number => s != null);
  return scores.length ? Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length) : 0;
}

/** Every room that passes the hard filters (budget, distance), best first. */
export function matchLeadRooms(lead: MatchLead, rooms: MatchRoom[]): RoomMatch[] {
  if (!leadMatchReady(lead)) return [];
  const radius = lead.radiusKm!;
  const budget = lead.budgetMax!;
  const matches: RoomMatch[] = [];
  for (const room of rooms) {
    if (room.latitude == null || room.longitude == null) continue;
    const priced = comparablePrice(room, lead);
    if (!priced || priced.price > budget) continue;
    let best: Omit<Located, 'price'> | null = null;
    for (const pin of lead.pins) {
      const d = distanceKm(pin.latitude, pin.longitude, room.latitude, room.longitude);
      if (d > radius * RADIUS_MULTIPLIER) continue;
      const distanceScore = d <= radius ? 100 : 100 * (1 - (d - radius) / (radius * (RADIUS_MULTIPLIER - 1)));
      const pinWeight = PIN_RANK_WEIGHTS[pin.rank] ?? 0.7;
      const locationScore = distanceScore * pinWeight;
      if (!best || locationScore > best.locationScore) {
        best = { locationScore, distanceScore, pinWeight, pin: { name: pin.name, rank: pin.rank }, distanceKm: d, withinRadius: d <= radius };
      }
    }
    if (!best) continue;
    const located: Located = {
      ...best,
      price: priced.price,
      locationScore: Math.round(best.locationScore),
      distanceScore: Math.round(best.distanceScore),
    };
    const comparison = compareLeadRoom(lead, located, room);
    matches.push({
      roomId: room.id,
      score: overallScore(comparison),
      locationScore: located.locationScore,
      price: priced.price,
      termMonths: priced.termMonths,
      distanceKm: located.distanceKm,
      pinRank: located.pin.rank,
      comparison,
    });
  }
  return matches.sort((a, b) => b.score - a.score || a.distanceKm - b.distanceKm || a.roomId - b.roomId);
}

export function applyMatchSettings(matches: RoomMatch[], settings: LeadMatchSettings): RoomMatch[] {
  return matches
    .filter((m) => m.score >= settings.minScore && m.score <= settings.maxScore)
    .slice(0, settings.maxResults);
}
