import { InternalServerErrorException } from '@nestjs/common';

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
