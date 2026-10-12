import type { PartyContract, TenantNextBill } from "@nestyk/types";

/** Use the server's future schedule rather than the dashboard's oldest unpaid bill. */
export function upcomingTenantBill(
  contracts: PartyContract[],
): TenantNextBill | null {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
  const stays = contracts.filter(
    (row) =>
      (row.formKind === "lease" || row.formKind === "renewal") &&
      row.status === "active" &&
      row.myParties.includes("tenant") &&
      row.nextRentBill &&
      Number(row.monthlyRent) > 0,
  );
  // A renewal replaces only its own predecessor, never another room's contract.
  // Include successors without an upcoming bill so a finished renewal cannot revive its predecessor.
  const covered = new Set(contracts.filter((row) =>
    (row.formKind === "lease" || row.formKind === "renewal") &&
    row.status === "active" && row.myParties.includes("tenant") &&
    row.previousAgreementId != null && row.startDate.slice(0, 10) <= today,
  ).map((row) => row.previousAgreementId));
  const lease = stays.filter((row) => !covered.has(row.id)).sort(
      (a, b) =>
        a.nextRentBill!.issueDate.localeCompare(b.nextRentBill!.issueDate) ||
        a.id - b.id,
    )[0];
  if (!lease) return null;
  return {
    ...lease.nextRentBill!,
    billId: null,
    leaseContractId: lease.id,
    property: lease.property,
    room: lease.room,
    amount: Number(lease.monthlyRent),
    status: "upcoming",
  };
}
