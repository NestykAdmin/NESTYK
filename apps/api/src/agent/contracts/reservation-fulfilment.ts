import { Logger } from "@nestjs/common";
import { EntityManager } from "typeorm";
import { LeaseContractEntity } from "../../entities/lease-contract.entity";
import { MasterContractEndReasonEntity } from "../../entities/master-contract-end-reason.entity";
import { asIsoDate } from "./lease-term";

/** The end reason of a booking letter its lease has taken over. Only the system sets it (not offered when closing). */
export const RESERVATION_FULFILLED_REASON = "reservation_fulfilled";

const logger = new Logger("ReservationFulfilment");

type DealLease = Pick<LeaseContractEntity, "id" | "lead_id" | "rent_room_id" | "tenant_id" | "created_by_user_id">;

/**
 * The move-in handover made the deal's first lease active: its booking letter has done its job (the booking fee is
 * the first month's rent). End it as terminated with reservation_fulfilled, in the caller's transaction, so it no
 * longer counts as an open agreement. It ends on the handover date, or on its own date when the handover is dated
 * before it (the end reason trigger refuses an end before the start). Returns how many letters were ended.
 */
export async function endFulfilledReservations(
  manager: EntityManager,
  lease: DealLease,
  handoverDate: string,
  now: Date,
): Promise<number> {
  const reason = await manager.findOne(MasterContractEndReasonEntity, {
    where: { code: RESERVATION_FULFILLED_REASON, is_active: true },
  });
  if (!reason) {
    // The migration that adds the reason is not applied: keep the handover, leave the letter as it was.
    logger.warn(`End reason ${RESERVATION_FULFILLED_REASON} is missing; the booking letter of lease ${lease.id} stays active`);
    return 0;
  }
  const letters = await manager.find(LeaseContractEntity, {
    where: { lead_id: lease.lead_id, rent_room_id: lease.rent_room_id, tenant_id: lease.tenant_id, status: "active" },
    relations: { template: true, agreement_type: true },
  });
  let ended = 0;
  for (const letter of letters) {
    if ((letter.template?.form_kind ?? letter.agreement_type?.form_kind) !== "reservation") continue;
    const start = asIsoDate(letter.start_date);
    const result = await manager.update(LeaseContractEntity, { id: letter.id, status: "active" }, {
      status: "terminated",
      end_reason_id: reason.id,
      end_reason_note: null,
      effective_end_date: start && start > handoverDate ? start : handoverDate,
      end_recorded_at: now,
      end_recorded_by_user_id: lease.created_by_user_id,
    });
    ended += result.affected ?? 0;
  }
  return ended;
}
