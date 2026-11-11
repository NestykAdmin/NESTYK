import { BadRequestException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, type Repository, type SelectQueryBuilder } from 'typeorm';
import type { PublicAreaSummary, PublicFeaturedRail, PublicRoomCard, PublicRoomDetail } from '@nestyk/types';
import { RentRoomEntity } from '../entities/rent-room.entity';
import { PUBLIC_AREAS, areaOfDistrict } from './public-areas';
import { PUBLIC_ROOM_RELATIONS, toPublicRoomCard, toPublicRoomDetail } from './public-room-mapper';

/** Rails of the home page (Mos 11 Nov 2026). */
export const PUBLIC_FEATURED_RAILS: readonly PublicFeaturedRail[] = ['recommended', 'near_transit', 'new'];
export const FEATURED_LIMIT_DEFAULT = 8;
export const FEATURED_LIMIT_MAX = 12;
export const AREAS_LIMIT_MAX = PUBLIC_AREAS.length;
/** "Near transit": a BTS or MRT station within this many metres (same as the web filter). */
export const NEAR_TRANSIT_METERS = 800;
/**
 * Newest public rooms the rails choose from. Stations come from the saved nearby places (JSON), so the near-transit
 * rail is picked in code rather than SQL; this cap keeps that cheap. Revisit with a stored column when rooms grow.
 */
export const FEATURED_CANDIDATES = 120;
export const AREA_CANDIDATES = 1000;
/** The three home rails read the same newest rooms, so one load serves them all for this long. */
export const FEATURED_CACHE_MS = 60_000;

const ROOM_ID = /^[1-9]\d{0,8}$/;

/** Optional clock for tests ("new" badge). Not provided in the app, so the real time is used. */
export const PUBLIC_ROOMS_CLOCK = 'PUBLIC_ROOMS_CLOCK';

function clampLimit(raw: unknown, fallback: number, max: number): number {
  const value = Math.floor(Number(raw));
  if (!Number.isFinite(value) || value < 1) return fallback;
  return Math.min(value, max);
}

/** Picks one rail from cards that are already ordered newest first. */
export function pickRail<T extends Pick<PublicRoomCard, 'coverImageUrl' | 'nearestStation'>>(
  cards: readonly T[],
  rail: PublicFeaturedRail,
  limit: number,
): T[] {
  if (rail === 'new') return cards.slice(0, limit);
  if (rail === 'near_transit') {
    return cards
      .filter((card) => card.nearestStation && card.nearestStation.distanceMeters <= NEAR_TRANSIT_METERS)
      .sort((a, b) => a.nearestStation!.distanceMeters - b.nearestStation!.distanceMeters)
      .slice(0, limit);
  }
  // Recommended: rooms with photos first, newest first within each group (stable sort keeps the order).
  return [...cards].sort((a, b) => Number(!!b.coverImageUrl) - Number(!!a.coverImageUrl)).slice(0, limit);
}

/**
 * Read-only queries for the guest web (S6). A room is public only when all of these hold (Mos 11 Nov 2026, H5):
 * listed by an agent (scout room), set to published, status available, and at least one price.
 * Uses the existing partial index idx_rent_rooms_public_scout_listing. Nothing here writes.
 */
@Injectable()
export class PublicRoomsService {
  private readonly now: () => Date;
  private candidates: { loadedAt: number; rooms: Promise<RentRoomEntity[]> } | null = null;

  constructor(
    @InjectRepository(RentRoomEntity) private readonly roomsRepo: Repository<RentRoomEntity>,
    @Optional() @Inject(PUBLIC_ROOMS_CLOCK) now?: () => Date,
  ) {
    this.now = typeof now === 'function' ? now : () => new Date();
  }

  private publicRooms(): SelectQueryBuilder<RentRoomEntity> {
    return this.roomsRepo
      .createQueryBuilder('room')
      .innerJoin('room.room_status', 'roomStatus')
      .where('room.is_scout_room = TRUE')
      .andWhere('room.visibility = :published', { published: 'published' })
      .andWhere('roomStatus.code = :available', { available: 'available' })
      .andWhere('EXISTS (SELECT 1 FROM rent_room_prices price WHERE price.rent_room_id = room.id AND price.price > 0)');
  }

  /**
   * Loads whole rooms for the given ids, keeping their order. Each list (photos, prices, layout, facilities) is read
   * in its own query: joining them all at once multiplies the rows (photos x prices x layout x facilities, R1).
   */
  private async loadRooms(ids: number[]): Promise<RentRoomEntity[]> {
    if (!ids.length) return [];
    const rooms = await this.roomsRepo.find({
      where: { id: In(ids) },
      relations: [...PUBLIC_ROOM_RELATIONS],
      relationLoadStrategy: 'query',
    });
    const byId = new Map(rooms.map((room) => [Number(room.id), room]));
    return ids.map((id) => byId.get(id)).filter((room): room is RentRoomEntity => !!room);
  }

  /** The newest public rooms, shared by every rail for FEATURED_CACHE_MS. A failed load is dropped at once. */
  private newestRooms(): Promise<RentRoomEntity[]> {
    const nowMs = this.now().getTime();
    if (this.candidates && nowMs - this.candidates.loadedAt < FEATURED_CACHE_MS) return this.candidates.rooms;
    const rooms = this.publicRooms()
      .select('room.id', 'id')
      .orderBy('room.created_at', 'DESC')
      .addOrderBy('room.id', 'DESC')
      .limit(FEATURED_CANDIDATES)
      .getRawMany<{ id: number | string }>()
      .then((rows) => this.loadRooms(rows.map((row) => Number(row.id))));
    const entry = { loadedAt: nowMs, rooms };
    this.candidates = entry;
    rooms.catch(() => {
      if (this.candidates === entry) this.candidates = null;
    });
    return rooms;
  }

  async featured(rail: string | undefined, limit: unknown): Promise<PublicRoomCard[]> {
    const chosen = (rail ?? 'recommended') as PublicFeaturedRail;
    if (!PUBLIC_FEATURED_RAILS.includes(chosen)) throw new BadRequestException('Unknown rail');
    const take = clampLimit(limit, FEATURED_LIMIT_DEFAULT, FEATURED_LIMIT_MAX);
    const rows = await this.newestRooms();
    const now = this.now();
    return pickRail(rows.map((row) => toPublicRoomCard(row, now)), chosen, take);
  }

  async detail(id: string): Promise<PublicRoomDetail> {
    if (!ROOM_ID.test(id ?? '')) throw new NotFoundException('Room not found');
    const found = await this.publicRooms()
      .select('room.id', 'id')
      .andWhere('room.id = :id', { id: Number(id) })
      .getRawOne<{ id: number | string }>();
    const [row] = found ? await this.loadRooms([Number(found.id)]) : [];
    // Rented, private, needs edit or unknown: the same answer, so nobody can tell a hidden room exists (D3).
    if (!row) throw new NotFoundException('Room not found');
    return toPublicRoomDetail(row, this.now());
  }

  /**
   * One row per public room with only what the area cards need; the database works out the lowest price and the
   * cover photo (same order as the room cards: cover first, then sort order).
   */
  async areas(limit: unknown): Promise<PublicAreaSummary[]> {
    const take = clampLimit(limit, AREAS_LIMIT_MAX, AREAS_LIMIT_MAX);
    const rows = await this.publicRooms()
      .leftJoin('room.property', 'property')
      .select('room.id', 'id')
      .addSelect('property.district', 'district')
      .addSelect(
        '(SELECT MIN(p.price) FROM rent_room_prices p WHERE p.rent_room_id = room.id AND p.price > 0)',
        'price_from',
      )
      .addSelect(
        "(SELECT m.media_url FROM room_medias m WHERE m.rent_id = room.id AND m.media_type = 'image' " +
          'ORDER BY m.is_cover DESC, m.sort_order ASC, m.id ASC LIMIT 1)',
        'cover',
      )
      .orderBy('room.created_at', 'DESC')
      .addOrderBy('room.id', 'DESC')
      .limit(AREA_CANDIDATES)
      .getRawMany<{ id: number | string; district: string | null; price_from: string | number | null; cover: string | null }>();
    const groups = new Map<string, { count: number; priceFrom: number | null; cover: string | null }>();
    for (const row of rows) {
      const area = areaOfDistrict(row.district);
      if (!area) continue;
      const price = row.price_from === null || row.price_from === undefined ? null : Number(row.price_from);
      const group = groups.get(area.slug) ?? { count: 0, priceFrom: null, cover: null };
      group.count += 1;
      if (price !== null && Number.isFinite(price) && (group.priceFrom === null || price < group.priceFrom)) group.priceFrom = price;
      if (!group.cover && row.cover) group.cover = row.cover;
      groups.set(area.slug, group);
    }
    return PUBLIC_AREAS.filter((area) => groups.has(area.slug))
      .map((area) => {
        const group = groups.get(area.slug)!;
        return {
          slug: area.slug,
          name: area.nameTh,
          transitLines: [...area.transitLines],
          roomCount: group.count,
          priceFrom: group.priceFrom,
          coverImageUrl: group.cover,
        };
      })
      .slice(0, take);
  }
}
