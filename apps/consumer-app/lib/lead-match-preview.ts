import type { AgentLead, LeadMatchRun } from '@nestyk/types';
import type { AgentListingCard } from './agent-listings-api';
import type { LeadRoomComparison } from './lead-room-compare';

/**
 * Shapes of the server-side room matching (`POST /agent/leads/:id/match-runs`,
 * docs/new-project/agent/leads/match-settings.md). Scores are computed by the API only.
 */

export type LeadRoomMatch = {
  room: AgentListingCard;
  /** 0–100 average of the matching-tab criteria (see lead-room-compare). */
  score: number;
  /** 0–100 weighted distance score of the best pin. */
  locationScore: number;
  /** Monthly rent compared with the budget. */
  price: number;
  termMonths: number | null;
  distanceKm: number;
  comparison: LeadRoomComparison;
};

export type LeadMatchRunResult = { run: LeadMatchRun | null; items: LeadRoomMatch[] };

/** Mirrors the API's readiness check, so the button is only offered when a run can succeed. */
export function leadMatchReady(lead: AgentLead): boolean {
  return !!lead.budgetMax && lead.budgetMax > 0 && lead.pins.length > 0 && lead.radiusKm != null;
}

export function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad;
  const dLng = (bLng - aLng) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}
