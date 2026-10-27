import { DataSource, EntityManager, In } from "typeorm";
import { RentRoomEntity } from "../../entities/rent-room.entity";
import { LeaseContractEntity } from "../../entities/lease-contract.entity";
import { LeadEntity } from "../../entities/lead.entity";
import { bangkokToday } from "../../billing/rent-schedule";
import { asIsoDate, shiftIsoDate } from "../contracts/lease-term";

/**
 * D8 (AC-1.2, 3.1, 6.3, 7.7, 8.3, 8.4, C.4; Aof 27 Oct 2026): a room's status follows its deals and the date (Bangkok),
 * worked out each time it is read, so it changes at 00:00 on its own. The stored status code keeps only what the
 * listing itself says: pending_verification and needs_edit stay; "rented" set by hand stays while the room has no
 * deal in the system (let outside it).
 *
 * - rented (เช่าแล้ว): a lease or renewal handed over (active), up to its last day.
 * - soon_vacant (ใกล้ว่าง): still let, but leaving: ended early (terminated, its last day not passed), recorded as not
 *   renewing or ending early ahead (D15, D16: `notRenewing`, `endsOn`), or a new tenant has booked it. It stays so
 *   until the day after the last day (`vacantFrom`), then follows the booking, else is available.
 * - booked (จองแล้ว): a lead holds a booking, or a booking letter or lease not cancelled and not handed over.
 * - available (พร้อมให้เช่า): none of these, including after a deal is cancelled.
 */
export type RoomDealStatus = "available" | "booked" | "rented" | "soon_vacant" | "pending_verification" | "needs_edit";
export type RoomStatusContract = {
  leadId: number | null;
  formKind: string | null;
  status: string;
  agreementKind: string | null;
  endDate: string | null;
  effectiveEndDate: string | null;
  /** D15 (AC-8.3): recorded as not renewing. */
  notRenewing?: boolean;
  /** D16 (AC-7.7): ends early on this day (recorded ahead). */
  endsOn?: string | null;
};
export type RoomStatusLead = { id: number; status: string; bookingReleasedAt: Date | string | null };
/** `nextBooked`: a soon-vacant room a new tenant has already booked (not offered to other leads, AC-3.1). */
export type RoomStatusResult = { status: RoomDealStatus; vacantFrom: string | null; nextBooked?: boolean };

const HANDED_OVER = ["active", "terminated", "expired"];
const ENDED = ["cancelled", "expired", "terminated"];

const lastDay = (c: RoomStatusContract) => c.effectiveEndDate || c.endsOn || c.endDate || null;

export function roomDealStatus(today: string, roomCode: string | null, contracts: RoomStatusContract[], leads: RoomStatusLead[]): RoomStatusResult {
  if (roomCode === "pending_verification" || roomCode === "needs_edit") return { status: roomCode, vacantFrom: null };
  const lets = contracts.filter((c) => (c.formKind === "lease" || c.formKind === "renewal") && HANDED_OVER.includes(c.status));
  const current = lets.filter((c) => { const last = lastDay(c); return !last || last >= today; });
  // The leads of the tenancy itself (its lead keeps its booking while it lives in the room).
  const own = new Set(lets.map((c) => c.leadId).filter((id) => id != null));
  const deals = (exclude: Set<number | null>) =>
    leads.some((l) => l.status === "booked" && !l.bookingReleasedAt && !exclude.has(l.id)) ||
    contracts.some((c) => c.agreementKind !== "renewal" && !ENDED.includes(c.status) && !exclude.has(c.leadId) &&
      (c.formKind === "reservation" || (c.formKind === "lease" && c.status !== "active")));
  if (current.length) {
    const lasts = current.map(lastDay);
    const last = lasts.includes(null) ? null : (lasts as string[]).sort()[lasts.length - 1];
    const leaving = current.every((c) => c.status === "terminated" || c.notRenewing || !!c.endsOn);
    const nextBooked = deals(own);
    if (leaving || nextBooked) return { status: "soon_vacant", vacantFrom: last ? shiftIsoDate(last, 1) : null, nextBooked };
    return { status: "rented", vacantFrom: null };
  }
  // A lease ended by its date leaves its lead booked until it is closed (D16): that is not a new booking.
  if (deals(own)) return { status: "booked", vacantFrom: null };
  const hasDeal = contracts.some((c) => c.status !== "cancelled" && ["reservation", "lease", "renewal"].includes(c.formKind ?? ""));
  if (roomCode === "rented" && !hasDeal) return { status: "rented", vacantFrom: null };
  return { status: "available", vacantFrom: null };
}

/** The status of each of these rooms (all of the agent's scout rooms when `roomIds` is not given), as of today. */
export async function roomDealStatuses(
  db: DataSource | EntityManager,
  agentId: number,
  roomIds?: number[],
  today = bangkokToday(),
): Promise<Map<number, RoomStatusResult>> {
  if (roomIds && !roomIds.length) return new Map();
  const rooms = await db.getRepository(RentRoomEntity).find({
    where: { created_by_user_id: agentId, is_scout_room: true, ...(roomIds ? { id: In(roomIds) } : {}) },
    relations: { room_status: true },
    select: { id: true, room_status: { id: true, code: true } },
  });
  const ids = rooms.map((r) => r.id);
  if (!ids.length) return new Map();
  const [contracts, leads] = await Promise.all([
    db.getRepository(LeaseContractEntity).find({
      where: { rent_room_id: In(ids) },
      relations: { template: true, agreement_type: true },
    }),
    db.getRepository(LeadEntity).find({ where: { rent_room_id: In(ids), status: "booked" } }),
  ]);
  const out = new Map<number, RoomStatusResult>();
  for (const room of rooms) {
    const rows: RoomStatusContract[] = contracts.filter((c) => c.rent_room_id === room.id).map((c) => ({
      leadId: c.lead_id ?? null,
      formKind: c.template?.form_kind ?? c.agreement_type?.form_kind ?? null,
      status: c.status,
      agreementKind: c.agreement_kind ?? null,
      endDate: asIsoDate(c.end_date) || null,
      effectiveEndDate: asIsoDate(c.effective_end_date) || null,
    }));
    const roomLeads = leads.filter((l) => l.rent_room_id === room.id)
      .map((l) => ({ id: l.id, status: l.status, bookingReleasedAt: l.booking_released_at ?? null }));
    out.set(room.id, roomDealStatus(today, room.room_status?.code ?? null, rows, roomLeads));
  }
  return out;
}
