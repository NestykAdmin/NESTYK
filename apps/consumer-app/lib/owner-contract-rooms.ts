import type { PartyContract } from "@nestyk/types";

const CLOSED = new Set(["cancelled", "expired", "terminated"]);
const OPEN = new Set([
  "draft",
  "awaiting_signatures",
  "awaiting_agent_review",
  "awaiting_payment",
  "awaiting_payment_verification",
]);

export type OwnerRoomStatus = "active" | "awaiting_owner" | "awaiting_agent" | "idle";
export type OwnerRoomAction = "renewal" | "reservation" | "lease" | "broker";

export type OwnerRoomCard = {
  status: OwnerRoomStatus;
  tone: "green" | "yellow" | "slate";
  historyRounds: number;
  pendingCount: number;
  action: OwnerRoomAction | null;
  needsOwner: boolean;
};

/** Owner still has to sign this copy. */
export function ownerMustSign(row: PartyContract) {
  return (
    (row.myParties ?? []).includes("owner") &&
    !row.ownerSignedAt &&
    (row.status === "draft" || row.status === "awaiting_signatures")
  );
}

function awaitingAgent(row: PartyContract) {
  if (row.status === "active" || CLOSED.has(row.status)) return false;
  if (row.status === "awaiting_agent_review") return true;
  if (row.formKind === "lease" || row.formKind === "renewal") return false;
  return Boolean(row.ownerSignedAt) && !row.agentSignedAt;
}

function actionKind(row: PartyContract): OwnerRoomAction {
  if (row.formKind === "reservation") return "reservation";
  if (row.formKind === "broker_appointment") return "broker";
  if (row.agreementKind === "renewal" || row.previousAgreementId) return "renewal";
  return "lease";
}

/** One card summary for an owner's room, from the contracts already on that room. */
export function ownerContractRoomCard(contracts: PartyContract[]): OwnerRoomCard {
  const active = contracts.some(
    (row) =>
      (row.formKind === "lease" || row.formKind === "renewal") &&
      row.status === "active",
  );
  const historyRounds = contracts.filter(
    (row) =>
      (row.formKind === "lease" || row.formKind === "renewal") &&
      CLOSED.has(row.status),
  ).length;
  const pending = contracts.filter((row) => OPEN.has(row.status));
  const signable = [...pending.filter(ownerMustSign)].sort((a, b) => {
    const rank = (row: PartyContract) =>
      actionKind(row) === "renewal" ? 0 : actionKind(row) === "reservation" ? 1 : actionKind(row) === "lease" ? 2 : 3;
    return rank(a) - rank(b);
  });
  const action = signable[0] ? actionKind(signable[0]) : null;
  const status: OwnerRoomStatus = active
    ? "active"
    : signable.length
      ? "awaiting_owner"
      : contracts.some(awaitingAgent)
        ? "awaiting_agent"
        : "idle";
  return {
    status,
    tone: status === "active" ? "green" : status === "idle" ? "slate" : "yellow",
    historyRounds,
    pendingCount: pending.length,
    action,
    needsOwner: signable.length > 0,
  };
}

/** Earliest move-in and latest move-out for one person in one room. */
export function ownerTenantStayDates(
  contracts: Array<Pick<PartyContract, "formKind" | "status" | "startDate" | "endDate" | "moveInDate">>,
): { moveIn: string; moveOut: string } {
  const stays = contracts.filter(
    (row) =>
      (row.formKind === "lease" || row.formKind === "renewal") &&
      row.status !== "cancelled",
  );
  const open = stays.length ? stays : contracts.filter((row) => row.status !== "cancelled");
  const dated = open.length ? open : contracts;
  const moveIn = dated.reduce((min, row) => {
    const value = row.moveInDate?.trim() || row.startDate?.trim() || "";
    if (!value) return min;
    return !min || value < min ? value : min;
  }, "");
  const activeEnds = dated.flatMap((row) => {
    const value = row.endDate?.trim() || "";
    return (row.formKind === "lease" || row.formKind === "renewal") &&
      row.status === "active" &&
      value
      ? [value]
      : [];
  });
  const moveOut = activeEnds.length
    ? activeEnds.reduce((max, value) => (value > max ? value : max), "")
    : dated.reduce((max, row) => {
        const value = row.endDate?.trim() || "";
        return value > max ? value : max;
      }, "");
  return { moveIn, moveOut };
}

export type OwnedRoomRef = { property: string; room: string | null };

/** Same key the contract list uses to group a property and room number. */
export function contractRoomKey(property: string, room: string | null) {
  return `${property.trim()}\u0000${room ?? ""}`;
}

/** Rooms the owner holds that do not already appear through a contract. */
export function ownedRoomsMissingFrom<T extends { property: string; room: string | null }>(
  existing: T[],
  owned: OwnedRoomRef[],
): OwnedRoomRef[] {
  const seen = new Set(existing.map((room) => contractRoomKey(room.property, room.room)));
  const missing: OwnedRoomRef[] = [];
  for (const room of owned) {
    const property = room.property.trim();
    const key = contractRoomKey(property, room.room);
    if (!property || seen.has(key)) continue;
    seen.add(key);
    missing.push({ property, room: room.room });
  }
  return missing;
}

export function ownerRoomMatches(
  property: string,
  room: string | null,
  contracts: PartyContract[],
  query: string,
) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const blob = [property, room, ...contracts.flatMap((row) => [row.tenant, row.contractNo, row.room])]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return blob.includes(q);
}
