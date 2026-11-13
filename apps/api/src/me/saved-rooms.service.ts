import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { PublicRoomCard, SavedRoomIds, SavedRoomsErrorCode } from '@nestyk/types';
import { SavedRoomEntity } from '../entities/saved-room.entity';
import { PublicRoomsService } from '../public-listings/public-rooms.service';

/**
 * Saved rooms of the signed-in account (AUTH-3, project-docs/nestyk-auth3-saved-rooms-plan-20261113.md).
 * Any role (D5). S1: at most 200 per account. S2: a room that is no longer public stays saved but is not listed.
 */
export const SAVED_ROOMS_LIMIT = 200;
const MAX_INT = 2147483647;

/** The public room id in the path: a positive whole number that fits the column. */
export function parseSavedRoomId(raw: unknown): number {
  const text = typeof raw === 'string' ? raw : '';
  if (!/^[1-9]\d{0,9}$/.test(text) || Number(text) > MAX_INT) throw new BadRequestException('Invalid room id');
  return Number(text);
}

/** The rows the service needs (kept small so tests can stand in for the database). */
export interface SavedRoomsStoreLike {
  find(query: { where: { user_id: number }; order: { created_at: 'DESC' } }): Promise<Array<{ rent_room_id: number }>>;
  count(query: { where: { user_id: number } }): Promise<number>;
  exists(query: { where: { user_id: number; rent_room_id: number } }): Promise<boolean>;
  insertIgnore(row: { user_id: number; rent_room_id: number }): Promise<void>;
  delete(where: { user_id: number; rent_room_id: number }): Promise<unknown>;
}

export interface PublicRoomsLike {
  publicIdsAmong(ids: number[]): Promise<number[]>;
  cardsFor(ids: number[]): Promise<PublicRoomCard[]>;
}

/** TypeORM side of SavedRoomsStoreLike. Saving twice is a no-op (unique user + room). */
@Injectable()
export class SavedRoomsStore implements SavedRoomsStoreLike {
  constructor(@InjectRepository(SavedRoomEntity) private readonly repo: Repository<SavedRoomEntity>) {}

  find(query: { where: { user_id: number }; order: { created_at: 'DESC' } }) {
    return this.repo.find({ where: query.where, order: { created_at: 'DESC', id: 'DESC' }, select: { rent_room_id: true } });
  }

  count(query: { where: { user_id: number } }) {
    return this.repo.count(query);
  }

  exists(query: { where: { user_id: number; rent_room_id: number } }) {
    return this.repo.exists(query);
  }

  async insertIgnore(row: { user_id: number; rent_room_id: number }) {
    await this.repo.createQueryBuilder().insert().into(SavedRoomEntity).values(row).orIgnore().execute();
  }

  delete(where: { user_id: number; rent_room_id: number }) {
    return this.repo.delete(where);
  }
}

@Injectable()
export class SavedRoomsService {
  // Explicit tokens: a union type would reach Nest as Object and the API would not start. Tests pass in fakes.
  constructor(
    @Inject(SavedRoomsStore) private readonly store: SavedRoomsStoreLike,
    @Inject(PublicRoomsService) private readonly rooms: PublicRoomsLike,
  ) {}

  /** Saved room ids that are public now, newest first (the hearts). */
  async ids(userId: number): Promise<SavedRoomIds> {
    return { ids: (await this.publicSaved(userId)).map(String) };
  }

  /** Cards of the saved rooms that are public now, newest first (the saved page). */
  async list(userId: number): Promise<PublicRoomCard[]> {
    return this.rooms.cardsFor(await this.publicSaved(userId));
  }

  async save(userId: number, rawRoomId: unknown): Promise<void> {
    const roomId = parseSavedRoomId(rawRoomId);
    if (!(await this.rooms.publicIdsAmong([roomId])).length) throw new NotFoundException('Room not found');
    if (await this.store.exists({ where: { user_id: userId, rent_room_id: roomId } })) return;
    // Only rooms the account can still see count (Mos 13 Nov 2026, review R1): a hidden room cannot be unsaved from
    // /saved, so it must not block. Rows stay bounded anyway: one per room (unique user + room).
    // Two saves at the same moment can pass 200 by a few; accepted (Mos, review R4): it only affects this account.
    if ((await this.publicSaved(userId)).length >= SAVED_ROOMS_LIMIT) {
      const code: SavedRoomsErrorCode = 'SAVED_ROOMS_LIMIT';
      throw new ConflictException({ code, message: `At most ${SAVED_ROOMS_LIMIT} saved rooms` });
    }
    await this.store.insertIgnore({ user_id: userId, rent_room_id: roomId });
  }

  async remove(userId: number, rawRoomId: unknown): Promise<void> {
    const roomId = parseSavedRoomId(rawRoomId);
    await this.store.delete({ user_id: userId, rent_room_id: roomId });
  }

  private async publicSaved(userId: number): Promise<number[]> {
    const rows = await this.store.find({ where: { user_id: userId }, order: { created_at: 'DESC' } });
    return this.rooms.publicIdsAmong(rows.map((row) => Number(row.rent_room_id)));
  }
}
