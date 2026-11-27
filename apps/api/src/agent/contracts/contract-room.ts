import { InternalServerErrorException } from '@nestjs/common';
import type { LeaseContractEntity } from '../../entities/lease-contract.entity';

/** SQL for query builders over `lease_contracts c`: agent code never sees self owner contracts (use `IsNull()` in `find`). */
export const AGENT_ROOM_ONLY = 'c.self_owner_room_id IS NULL';

/**
 * Agent code works on agent rooms only. A lease or tenancy of a self owner room has rent_room_id null
 * (chk_lease_contracts_one_room); those rows never reach the agent (see the self owner contracts plan), so a null here
 * is a bug upstream and fails loudly instead of letting `null` flow into a room lookup.
 */
export function requireRentRoomId(row: { id: number; rent_room_id: number | null }): number {
  if (row.rent_room_id === null) throw new InternalServerErrorException('สัญญานี้ไม่ใช่ห้องของนายหน้า');
  return row.rent_room_id;
}

export const NO_PROPERTY = 'ไม่ระบุโครงการ';

/** The room a contract is about: an agent room (rent_rooms) or a self owner room (self_owner_rooms). */
export type ContractRoom = { source: 'agent' | 'self_owner'; roomId: number; property: string; roomNumber: string | null };

/**
 * One resolver for the contract's room on the party paths (list, document, sign, attachments, broker appointment).
 * Source and id come from the columns, so it also works when the room relations are not loaded; the labels come
 * from the loaded relation with the same fallbacks serialize used: project name, then the listing title, then
 * "ไม่ระบุโครงการ"; the room number, else null. Null only for a row with neither room (the CHECK forbids it).
 */
export function contractRoom(
  c: Pick<LeaseContractEntity, 'rent_room_id' | 'self_owner_room_id'> &
    Partial<Pick<LeaseContractEntity, 'rent_room' | 'self_owner_room'>>,
): ContractRoom | null {
  if (c.self_owner_room_id != null) {
    const room = c.self_owner_room;
    return {
      source: 'self_owner',
      roomId: c.self_owner_room_id,
      property: room?.property?.name || room?.room_name || NO_PROPERTY,
      roomNumber: room?.room_number || null,
    };
  }
  if (c.rent_room_id != null) {
    const room = c.rent_room;
    return {
      source: 'agent',
      roomId: c.rent_room_id,
      property: room?.property?.name || room?.listing_title || NO_PROPERTY,
      roomNumber: room?.room_id || null,
    };
  }
  return null;
}

/** Same room as another contract (renewal reuse): same source and same id. */
export function sameContractRoom(
  a: Pick<LeaseContractEntity, 'rent_room_id' | 'self_owner_room_id'>,
  b: Pick<LeaseContractEntity, 'rent_room_id' | 'self_owner_room_id'>,
) {
  const x = contractRoom(a);
  const y = contractRoom(b);
  return !!x && !!y && x.source === y.source && x.roomId === y.roomId;
}
