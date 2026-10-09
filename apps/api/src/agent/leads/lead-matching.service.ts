import { ConflictException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Not, Repository } from 'typeorm';
import type { LeadMatchRun, LeadMatchSettings, LeadMatchSettingsResponse, LeadMatchSummary } from '@nestyk/types';
import { LeadEntity } from '../../entities/lead.entity';
import { LeadMatchRunEntity } from '../../entities/lead-match-run.entity';
import { LeadMatchResultEntity } from '../../entities/lead-match-result.entity';
import { AgentListingsService, type ListingCard } from '../listings/agent-listings.service';
import {
  applyMatchSettings,
  assertScoreRange,
  effectiveMatchSettings,
  leadMatchReady,
  matchInputHash,
  matchLeadRooms,
  MATCH_DEFAULT_SETTINGS,
  pinSearchBoxes,
  SCORING_VERSION,
  validateMatchSettings,
  type LeadRoomComparison,
  type MatchLead,
} from './lead-matching';

/** Older runs of a lead beyond this many are deleted when a new run is stored. */
const KEPT_RUNS_PER_LEAD = 5;

export type LeadRoomMatchItem = {
  room: ListingCard;
  score: number;
  locationScore: number;
  price: number;
  termMonths: number | null;
  distanceKm: number;
  comparison: LeadRoomComparison;
};

export type LeadMatchRunResponse = { run: LeadMatchRun | null; items: LeadRoomMatchItem[] };

export function toMatchLead(row: LeadEntity): MatchLead {
  return {
    budgetMax: row.budget_max == null ? null : Number(row.budget_max),
    radiusKm: row.radius_km ?? null,
    pins: [...(row.pins ?? [])]
      .sort((a, b) => a.rank - b.rank)
      .map((pin) => ({ rank: pin.rank, name: pin.name, latitude: Number(pin.latitude), longitude: Number(pin.longitude) })),
    leaseDurationMonths: row.lease_duration_months ?? null,
    desiredRoomTypeCode: row.desired_room_type?.code ?? null,
    moveInPlan: row.move_in_plan ?? null,
  };
}

function currentHash(row: LeadEntity): string {
  return matchInputHash(toMatchLead(row), effectiveMatchSettings(row.match_settings));
}

function toSummary(run: LeadMatchRunEntity, row: LeadEntity): LeadMatchSummary {
  return {
    runId: run.id,
    resultCount: run.result_count,
    topScore: run.top_score ?? null,
    createdAt: new Date(run.created_at).toISOString(),
    stale: run.input_hash !== currentHash(row),
  };
}

function toRun(run: LeadMatchRunEntity, row: LeadEntity): LeadMatchRun {
  return {
    ...toSummary(run, row),
    settings: effectiveMatchSettings(run.settings),
    candidateCount: run.candidate_count,
  };
}

/** Latest run per lead for list rows; leads need `pins` and `desired_room_type` loaded for the stale check. */
export async function loadLastMatches(em: EntityManager, rows: LeadEntity[]): Promise<Map<number, LeadMatchSummary>> {
  const result = new Map<number, LeadMatchSummary>();
  if (!rows.length) return result;
  const runs = await em
    .getRepository(LeadMatchRunEntity)
    .createQueryBuilder('run')
    .distinctOn(['run.lead_id'])
    .where('run.lead_id IN (:...ids)', { ids: rows.map((row) => row.id) })
    .orderBy('run.lead_id')
    .addOrderBy('run.created_at', 'DESC')
    .addOrderBy('run.id', 'DESC')
    .getMany();
  const byId = new Map(rows.map((row) => [row.id, row]));
  for (const run of runs) {
    const row = byId.get(run.lead_id);
    if (row) result.set(row.id, toSummary(run, row));
  }
  return result;
}

@Injectable()
export class LeadMatchingService {
  constructor(
    @InjectRepository(LeadEntity) private readonly leads: Repository<LeadEntity>,
    @InjectRepository(LeadMatchRunEntity) private readonly runs: Repository<LeadMatchRunEntity>,
    @InjectRepository(LeadMatchResultEntity) private readonly results: Repository<LeadMatchResultEntity>,
    private readonly listings: AgentListingsService,
  ) {}

  async getSettings(agentId: number, leadId: number): Promise<LeadMatchSettingsResponse> {
    return settingsResponse(await this.requireLead(agentId, leadId));
  }

  async saveSettings(agentId: number, leadId: number, input: unknown): Promise<LeadMatchSettingsResponse> {
    const row = await this.requireLead(agentId, leadId);
    const patch = validateMatchSettings(input);
    const saved = { ...effectiveMatchSettings(row.match_settings), ...patch };
    assertScoreRange(saved);
    await this.leads.update({ id: leadId, created_by_user_id: agentId }, { match_settings: saved });
    row.match_settings = saved;
    return settingsResponse(row);
  }

  async run(agentId: number, leadId: number): Promise<LeadMatchRunResponse> {
    const row = await this.requireLead(agentId, leadId);
    if (row.status === 'booked') throw new ConflictException('Booked leads are not matched');
    const lead = toMatchLead(row);
    if (!leadMatchReady(lead)) {
      throw new UnprocessableEntityException({
        code: 'LEAD_NOT_READY',
        message: 'A budget, at least one pin and a radius are required before matching',
      });
    }
    const settings = effectiveMatchSettings(row.match_settings);
    const candidates = await this.listings.matchCandidates(agentId, {
      maxPrice: lead.budgetMax!,
      boxes: pinSearchBoxes(lead),
    });
    const matched = matchLeadRooms(lead, candidates);
    const kept = applyMatchSettings(matched, settings);

    const run = await this.leads.manager.transaction(async (em) => {
      const runRepo = em.getRepository(LeadMatchRunEntity);
      const saved = await runRepo.save(
        runRepo.create({
          lead_id: leadId,
          run_by_user_id: agentId,
          settings,
          input_hash: matchInputHash(lead, settings),
          scoring_version: SCORING_VERSION,
          candidate_count: matched.length,
          result_count: kept.length,
          top_score: kept[0]?.score ?? null,
        }),
      );
      if (kept.length) {
        const resultRepo = em.getRepository(LeadMatchResultEntity);
        await resultRepo.save(resultRepo.create(
          kept.map((match, index) => ({
            run_id: saved.id,
            rent_room_id: match.roomId,
            rank: index + 1,
            score: match.score,
            location_score: match.locationScore,
            price: String(match.price),
            term_months: match.termMonths,
            distance_km: match.distanceKm,
            pin_rank: match.pinRank,
            comparison: match.comparison as unknown as Record<string, unknown>,
          })),
        ));
      }
      const keep = await runRepo.find({
        select: { id: true },
        where: { lead_id: leadId },
        order: { created_at: 'DESC', id: 'DESC' },
        take: KEPT_RUNS_PER_LEAD,
      });
      await runRepo.delete({ lead_id: leadId, id: Not(In(keep.map((r) => r.id))) });
      await em.getRepository(LeadEntity).update({ id: leadId }, { updated_at: new Date() });
      return saved;
    });

    const cards = new Map((await this.listings.cardsByIds(agentId, kept.map((m) => m.roomId))).map((c) => [c.id, c]));
    return {
      run: toRun(run, row),
      items: kept.flatMap((match) => {
        const room = cards.get(match.roomId);
        if (!room) return [];
        const { roomId: _roomId, pinRank: _pinRank, ...rest } = match;
        return [{ room, ...rest }];
      }),
    };
  }

  /** Latest stored run with fresh room cards; rooms deleted since then drop out. */
  async latest(agentId: number, leadId: number): Promise<LeadMatchRunResponse> {
    const row = await this.requireLead(agentId, leadId);
    const run = await this.runs.findOne({ where: { lead_id: leadId }, order: { created_at: 'DESC', id: 'DESC' } });
    if (!run) return { run: null, items: [] };
    const results = await this.results.find({ where: { run_id: run.id }, order: { rank: 'ASC' } });
    const cards = new Map(
      (await this.listings.cardsByIds(agentId, results.map((r) => r.rent_room_id))).map((c) => [c.id, c]),
    );
    return {
      run: toRun(run, row),
      items: results.flatMap((result) => {
        const room = cards.get(result.rent_room_id);
        if (!room) return [];
        return [{
          room,
          score: result.score ?? 0,
          locationScore: result.location_score,
          price: Number(result.price),
          termMonths: result.term_months ?? null,
          distanceKm: Number(result.distance_km),
          comparison: result.comparison as unknown as LeadRoomComparison,
        }];
      }),
    };
  }

  /** Results go with their runs (FK cascade); saved settings stay for the next run. */
  async clear(agentId: number, leadId: number): Promise<void> {
    await this.requireLead(agentId, leadId);
    await this.runs.delete({ lead_id: leadId });
  }

  private async requireLead(agentId: number, id: number) {
    const row = await this.leads.findOne({
      where: { id, created_by_user_id: agentId },
      relations: { desired_room_type: true, pins: true },
    });
    if (!row) throw new NotFoundException('Lead not found');
    return row;
  }
}

function settingsResponse(row: LeadEntity): LeadMatchSettingsResponse {
  const saved = row.match_settings ? (row.match_settings as Partial<LeadMatchSettings>) : null;
  return { saved, effective: effectiveMatchSettings(row.match_settings), defaults: { ...MATCH_DEFAULT_SETTINGS } };
}
