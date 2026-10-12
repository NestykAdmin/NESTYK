import React, { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocale } from "@nestyk/i18n";
import {
  MobileButton,
  MobileFilterChip,
  MobileIcon,
  MobileListSearchRow,
  MobileStatusPill,
  tokens,
  useMobileTheme,
} from "@nestyk/ui/native";
import type {
  AgreementAttachmentChecklist,
  PartyContract,
} from "@nestyk/types";
import type { PartyContractRoom } from "./PartyContractsScreen";
import { billFormatters } from "../lib/bill-format";
import {
  ownerContractRoomCard,
  ownerRoomMatches,
  ownerTenantStayDates,
  ownedRoomsMissingFrom,
  type OwnedRoomRef,
  type OwnerRoomAction,
} from "../lib/owner-contract-rooms";
import { tenantWorkspaceCopy } from "../lib/tenant-workspace-copy";

export function TenantContractList({
  rows,
  ownedRooms = [],
  selectedRoom,
  history = false,
  mode = "tenant",
  onSelectRoom,
  onOpen,
}: {
  rows: PartyContract[];
  ownedRooms?: OwnedRoomRef[];
  selectedRoom: PartyContractRoom | null;
  history?: boolean;
  mode?: "tenant" | "owner";
  onSelectRoom: (room: PartyContractRoom) => void;
  onOpen: (contract: PartyContract) => void;
}) {
  const { theme } = useMobileTheme();
  const { t, locale } = useLocale();
  const copy = tenantWorkspaceCopy(locale);
  const [roomQuery, setRoomQuery] = useState("");
  const [tenantQuery, setTenantQuery] = useState("");
  const [ownerFilter, setOwnerFilter] = useState<"all" | "action">("all");
  const format = billFormatters(locale);
  const ink = { color: theme.textHeading };
  const muted = { color: theme.textSecondary };
  const surface = { backgroundColor: theme.surface, borderColor: theme.border };
  const grouped = new Map<
    string,
    { room: PartyContractRoom; contracts: PartyContract[] }
  >();
  for (const row of rows) {
    const key = `${row.property?.trim() || ""}\u0000${row.room ?? ""}`;
    const group = grouped.get(key);
    if (group) group.contracts.push(row);
    else
      grouped.set(key, {
        room: { key, property: row.property?.trim() || "—", room: row.room },
        contracts: [row],
      });
  }
  if (mode === "owner") {
    for (const owned of ownedRoomsMissingFrom(
      [...grouped.values()].map((group) => group.room),
      ownedRooms,
    )) {
      const key = `${owned.property}\u0000${owned.room ?? ""}`;
      grouped.set(key, {
        room: { key, property: owned.property, room: owned.room },
        contracts: [],
      });
    }
  }
  const staying = (contracts: PartyContract[]) =>
    contracts.some((row) => row.formKind === "lease" && row.status === "active");
  const occupant = (contracts: PartyContract[]) =>
    contracts.find((row) => row.formKind === "lease" && row.status === "active")?.tenant?.trim() || "";
  const roleAccent = mode === "owner" ? tokens.colors.roles.owner : tokens.colors.roles.tenant;
  const roleTint = mode === "owner" ? "rgba(0, 85, 218, 0.12)" : "rgba(0, 198, 141, 0.14)";
  const latestStart = (contracts: PartyContract[]) =>
    contracts.reduce((max, row) => (row.startDate > max ? row.startDate : max), "");
  const groups = [...grouped.values()].sort(
    (a, b) =>
      Number(staying(b.contracts)) - Number(staying(a.contracts)) ||
      latestStart(b.contracts).localeCompare(latestStart(a.contracts)) ||
      a.room.property.localeCompare(b.room.property, locale),
  );
  const tenantStays = [
    ...rows.reduce((stays, row) => {
      const property = row.property?.trim() || "—";
      const tenant = row.tenant?.trim() || "—";
      const key = `${property}\u0000${row.room ?? ""}\u0000${tenant}`;
      const current = stays.get(key) ?? {
        tenant,
        room: { key, property, room: row.room, tenant } satisfies PartyContractRoom,
        contracts: [] as PartyContract[],
      };
      current.contracts.push(row);
      stays.set(key, current);
      return stays;
    }, new Map<string, { tenant: string; room: PartyContractRoom; contracts: PartyContract[] }>()).values(),
  ].sort(
    (a, b) =>
      Number(staying(b.contracts)) - Number(staying(a.contracts)) ||
      latestStart(b.contracts).localeCompare(latestStart(a.contracts)) ||
      a.tenant.localeCompare(b.tenant, locale),
  );
  const listed = mode === "owner" || history ? groups : groups.filter((item) => staying(item.contracts));
  // Tenants open their only current room. Owners always pick a room first.
  const group = selectedRoom
    ? groups.find(
        (item) =>
          item.room.property === selectedRoom.property &&
          item.room.room === selectedRoom.room,
      )
    : mode === "owner" || history
      ? undefined
      : listed.length === 1
        ? listed[0]
        : undefined;

  function roomHeader(room: PartyContractRoom, count: number, contracts: PartyContract[]) {
    const current = staying(contracts);
    return (
      <>
        <View
          style={[
            s.roomIcon,
            {
              backgroundColor: current ? roleTint : "rgba(100, 116, 139, 0.14)",
            },
          ]}
        >
          <MobileIcon
            name="home"
            size={22}
            color={current ? roleAccent : tokens.colors.textSecondary}
          />
        </View>
        <View style={s.flex}>
          <Text style={[s.roomTitle, ink]}>{room.property}</Text>
          {room.room ? (
            <Text style={[s.caption, muted]}>
              {copy.room} {room.room}
            </Text>
          ) : null}
          {mode === "owner" && (occupant(contracts) || selectedRoom?.tenant?.trim()) ? (
            <Text style={[s.caption, muted]}>
              {copy.tenant} {occupant(contracts) || selectedRoom?.tenant?.trim()}
            </Text>
          ) : null}
          {mode === "owner" && !occupant(contracts) && !selectedRoom?.tenant?.trim() ? (
            <Text style={[s.caption, muted]}>{copy.noCurrentTenant}</Text>
          ) : null}
          {history ? (
            <Text style={[s.caption, muted]}>
              {current ? copy.currentStay : copy.pastStay}
            </Text>
          ) : null}
        </View>
        {count > 0 ? (
          <Text style={[s.caption, muted]}>
            {copy.contractCount.replace("{count}", String(count))}
          </Text>
        ) : null}
      </>
    );
  }
  function badge(row: PartyContract) {
    return (
      <MobileStatusPill
        label={copy.status[row.status]}
        tone={
          row.status === "active"
            ? "green"
            : row.status.startsWith("awaiting")
              ? "yellow"
              : "slate"
        }
      />
    );
  }
  function signer(row: PartyContract, party: "tenant" | "owner") {
    const signed = party === "tenant" ? row.tenantSignedAt : row.ownerSignedAt;
    return (
      <View style={s.signer} key={party}>
        <MobileIcon
          name={signed ? "check" : "info"}
          size={14}
          color={signed ? tokens.colors.subtle.successFg : theme.textSecondary}
        />
        <Text
          style={[
            s.caption,
            {
              color: signed
                ? tokens.colors.subtle.successFg
                : theme.textSecondary,
            },
          ]}
        >
          {copy[party]} · {signed ? copy.signed : copy.unsigned}
        </Text>
      </View>
    );
  }
  if (!group && mode === "owner" && !history && !selectedRoom) {
    const chipTone = { bg: "#E8F0FE", fg: tokens.colors.roles.owner, dot: tokens.colors.roles.owner };
    const actionLabel: Record<OwnerRoomAction, string> = {
      renewal: copy.renewalAction,
      reservation: copy.reservation,
      lease: copy.lease,
      broker: copy.broker,
    };
    const statusLabel = {
      active: copy.status.active,
      awaiting_owner: copy.status.awaiting_signatures,
      awaiting_agent: copy.awaitingAgentSignature,
      idle: copy.noActiveContract,
    };
    const searched = listed
      .filter(({ room, contracts }) => ownerRoomMatches(room.property, room.room, contracts, roomQuery))
      .map(({ room, contracts }) => ({
        room,
        contracts,
        summary: ownerContractRoomCard(contracts),
      }));
    const waitingCount = searched.filter(({ summary }) => summary.needsOwner).length;
    const cards = ownerFilter === "all" ? searched : searched.filter(({ summary }) => summary.needsOwner);
    return (
      <View style={s.root}>
        <MobileListSearchRow
          value={roomQuery}
          onChangeText={setRoomQuery}
          placeholder={copy.searchRooms}
          onClear={() => setRoomQuery("")}
          clearAccessibilityLabel={copy.clearSearch}
        />
        <View style={s.filters}>
          <MobileFilterChip
            label={copy.allRooms}
            selected={ownerFilter === "all"}
            onPress={() => setOwnerFilter("all")}
            tone={chipTone}
            showDot={false}
          />
          <MobileFilterChip
            label={`${copy.waitingOnYou} · ${waitingCount}`}
            selected={ownerFilter === "action"}
            onPress={() => setOwnerFilter("action")}
            tone={chipTone}
            showDot={false}
          />
        </View>
        <View style={s.sectionRow}>
          <Text style={[s.sectionTitle, ink, s.flex]}>{copy.roomsWithContracts}</Text>
          <Text style={[s.caption, muted]}>
            {copy.roomCount.replace("{count}", String(cards.length))}
          </Text>
        </View>
        {cards.length ? (
          cards.map(({ room, contracts, summary }) => {
            const currentName = occupant(contracts);
            const actionInk = summary.action ? "#B45309" : theme.textSecondary;
            return (
              <Pressable
                key={room.key}
                accessibilityRole="button"
                accessibilityLabel={`${room.property} ${room.room ?? ""}`}
                onPress={() => onSelectRoom(room)}
                style={({ pressed }) => [s.hubCard, surface, pressed && s.pressed]}
              >
                <View style={s.hubTop}>
                  <View style={[s.hubIcon, { backgroundColor: roleTint }]}>
                    <MobileIcon name="home" size={20} color={roleAccent} />
                  </View>
                  <View style={s.flex}>
                    <Text style={[s.roomTitle, ink]} numberOfLines={1}>
                      {room.property}
                    </Text>
                  </View>
                  <MobileIcon name="chevron-right" size={18} color={tokens.colors.divider} />
                </View>
                <View style={s.hubMid}>
                  <MobileIcon name="key" size={14} color={theme.textSecondary} />
                  <Text style={[s.caption, muted, s.flex]} numberOfLines={1}>
                    {copy.unitNo} {room.room || "-"}
                  </Text>
                  <MobileStatusPill label={statusLabel[summary.status]} tone={summary.tone} />
                </View>
                <View style={[s.hubFoot, { borderTopColor: theme.border }]}>
                  <Text style={[s.body, ink, s.flex]} numberOfLines={1}>
                    {currentName || copy.noCurrentTenant}
                  </Text>
                  <Text style={[s.caption, { color: actionInk }]} numberOfLines={1}>
                    {summary.action
                      ? `${actionLabel[summary.action]} · ${copy.waitingYourSignature}`
                      : copy.pendingDocs.replace("{count}", String(summary.pendingCount))}
                  </Text>
                </View>
              </Pressable>
            );
          })
        ) : (
          <Text style={[s.body, muted]}>
            {roomQuery.trim() || ownerFilter === "action" ? copy.noMatchingRooms : copy.emptyContracts}
          </Text>
        )}
      </View>
    );
  }

  if (mode === "owner" && !history && selectedRoom && !selectedRoom.tenant?.trim() && group) {
    const people = [
      ...group.contracts.reduce((stays, row) => {
        const tenant = row.tenant?.trim() || "—";
        const current = stays.get(tenant) ?? { tenant, contracts: [] as PartyContract[] };
        current.contracts.push(row);
        stays.set(tenant, current);
        return stays;
      }, new Map<string, { tenant: string; contracts: PartyContract[] }>()).values(),
    ].sort(
      (a, b) =>
        Number(staying(b.contracts)) - Number(staying(a.contracts)) ||
        latestStart(b.contracts).localeCompare(latestStart(a.contracts)) ||
        a.tenant.localeCompare(b.tenant, locale),
    );
    return (
      <View style={s.root}>
        <View style={s.sectionRow}>
          <Text style={[s.sectionTitle, ink, s.flex]}>{copy.roomTenants}</Text>
          <Text style={[s.caption, muted]}>
            {copy.peopleCount.replace("{count}", String(people.length))}
          </Text>
        </View>
        {people.length ? (
          people.map((person) => {
            const current = staying(person.contracts);
            const dates = ownerTenantStayDates(person.contracts);
            return (
              <Pressable
                key={person.tenant}
                accessibilityRole="button"
                accessibilityLabel={person.tenant}
                onPress={() => onSelectRoom({ ...group.room, tenant: person.tenant })}
                style={({ pressed }) => [s.room, surface, pressed && s.pressed]}
              >
                <View
                  style={[
                    s.roomIcon,
                    { backgroundColor: current ? roleTint : "rgba(100, 116, 139, 0.14)" },
                  ]}
                >
                  <MobileIcon
                    name="user"
                    size={22}
                    color={current ? roleAccent : tokens.colors.textSecondary}
                  />
                </View>
                <View style={s.flex}>
                  <Text style={[s.roomTitle, ink]}>{person.tenant}</Text>
                  <Text style={[s.caption, muted]}>
                    {current ? copy.currentStay : copy.pastStay}
                  </Text>
                  <Text style={[s.caption, muted]}>
                    {copy.stayDates
                      .replace("{moveIn}", dates.moveIn ? format.date(dates.moveIn) : "—")
                      .replace("{moveOut}", dates.moveOut ? format.date(dates.moveOut) : "—")}
                  </Text>
                </View>
                <Text style={[s.caption, muted]}>
                  {copy.contractCount.replace("{count}", String(person.contracts.length))}
                </Text>
                <MobileIcon name="chevron-right" size={18} color={tokens.colors.divider} />
              </Pressable>
            );
          })
        ) : (
          <Text style={[s.body, muted]}>{copy.emptyRoomTenants}</Text>
        )}
      </View>
    );
  }

  if (!group && mode === "owner" && history && !selectedRoom) {
    const q = tenantQuery.trim().toLowerCase();
    const visibleStays = q
      ? tenantStays.filter(
          (stay) =>
            stay.tenant.toLowerCase().includes(q) ||
            ownerRoomMatches(stay.room.property, stay.room.room, stay.contracts, q),
        )
      : tenantStays;
    return (
      <View style={s.root}>
        <MobileListSearchRow
          value={tenantQuery}
          onChangeText={setTenantQuery}
          placeholder={copy.searchTenants}
          onClear={() => setTenantQuery("")}
          clearAccessibilityLabel={copy.clearSearch}
        />
        <Text style={[s.body, muted]}>{copy.tenantHistoryHint}</Text>
        {visibleStays.length ? (
          visibleStays.map((stay) => {
            const current = staying(stay.contracts);
            return (
              <Pressable
                key={`${stay.room.property}\u0000${stay.room.room ?? ""}\u0000${stay.tenant}`}
                accessibilityRole="button"
                accessibilityLabel={stay.tenant}
                onPress={() => onSelectRoom(stay.room)}
                style={({ pressed }) => [s.room, surface, pressed && s.pressed]}
              >
                <View
                  style={[
                    s.roomIcon,
                    { backgroundColor: current ? roleTint : "rgba(100, 116, 139, 0.14)" },
                  ]}
                >
                  <MobileIcon
                    name="user"
                    size={22}
                    color={current ? roleAccent : tokens.colors.textSecondary}
                  />
                </View>
                <View style={s.flex}>
                  <Text style={[s.roomTitle, ink]}>{stay.tenant}</Text>
                  <Text style={[s.caption, muted]}>
                    {[stay.room.property, stay.room.room ? `${copy.room} ${stay.room.room}` : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </Text>
                  <Text style={[s.caption, muted]}>
                    {current ? copy.currentStay : copy.pastStay}
                  </Text>
                </View>
                <Text style={[s.caption, muted]}>
                  {copy.contractCount.replace("{count}", String(stay.contracts.length))}
                </Text>
                <MobileIcon name="chevron-right" size={18} color={tokens.colors.divider} />
              </Pressable>
            );
          })
        ) : (
          <Text style={[s.body, muted]}>
            {q ? copy.noMatchingTenants : copy.emptyTenantHistory}
          </Text>
        )}
      </View>
    );
  }

  if (!group)
    return (
      <View style={s.root}>
        {history ? <Text style={[s.body, muted]}>{copy.roomHistoryHint}</Text> : null}
        {selectedRoom ? (
          <Text style={[s.body, muted]}>{copy.emptyRoom}</Text>
        ) : !listed.length ? (
          <Text style={[s.body, muted]}>
            {history ? copy.emptyHistory : copy.emptyContracts}
          </Text>
        ) : (
          listed.map(({ room, contracts }) => {
            const currentName = occupant(contracts);
            const locked = mode === "owner" && !currentName;
            const openCount = mode === "owner"
              ? contracts.filter((row) => row.tenant?.trim() === currentName).length
              : contracts.length;
            return (
            <Pressable
              key={room.key}
              accessibilityRole="button"
              accessibilityState={{ disabled: locked }}
              accessibilityLabel={`${room.property} ${room.room ?? ""}`}
              disabled={locked}
              onPress={() => {
                if (locked) return;
                onSelectRoom(room);
              }}
              style={({ pressed }) => [s.room, surface, pressed && !locked && s.pressed]}
            >
              {roomHeader(room, locked ? 0 : openCount, contracts)}
              {locked ? null : (
                <MobileIcon
                  name="chevron-right"
                  size={18}
                  color={tokens.colors.divider}
                />
              )}
            </Pressable>
            );
          })
        )}
      </View>
    );

  const focusTenant = mode === "owner"
    ? (selectedRoom?.tenant?.trim() || occupant(group.contracts))
    : "";
  const visibleContracts = mode === "owner"
    ? focusTenant
      ? group.contracts.filter((row) => row.tenant?.trim() === focusTenant)
      : group.contracts
    : group.contracts;
  const leases = visibleContracts
    .filter((row) => row.formKind === "lease")
    .sort(
      (a, b) =>
        Number(b.status === "active") - Number(a.status === "active") ||
        b.startDate.localeCompare(a.startDate),
    );
  const documents = visibleContracts.filter((row) => row.formKind !== "lease");
  return (
    <View style={s.root}>
      <View style={[s.room, surface]}>
        {roomHeader(group.room, visibleContracts.length, visibleContracts)}
      </View>
      {mode === "owner" && visibleContracts.length === 0 ? (
        <Text style={[s.body, muted]}>{copy.emptyRoom}</Text>
      ) : null}
      {leases.map((row) => {
        const canSign =
          row.myParties.includes(mode === "owner" ? "owner" : "tenant") &&
          !(mode === "owner" ? row.ownerSignedAt : row.tenantSignedAt) &&
          ["draft", "awaiting_signatures", "awaiting_agent_review"].includes(
            row.status,
          );
        return (
          <View key={row.id} style={[s.contract, surface]}>
            <View style={s.header}>
              <Text style={[s.caption, muted, s.flex]}>
                {row.status === "active" ? copy.currentContract : copy.lease}
              </Text>
              {badge(row)}
            </View>
            <Text style={[s.contractTitle, ink]}>
              {row.agreementTypeName || copy.lease}
            </Text>
            <Text style={[s.caption, muted]}>
              {copy.contractNo} {row.contractNo}
            </Text>
            <View style={[s.facts, { borderBottomColor: theme.border }]}>
              {[
                [copy.start, row.startDate ? format.date(row.startDate) : "—"],
                [copy.end, row.endDate ? format.date(row.endDate) : "—"],
                [
                  copy.rent,
                  row.monthlyRent != null
                    ? format.amount(row.monthlyRent)
                    : "—",
                ],
                [
                  copy.deposit,
                  row.deposit != null ? format.amount(row.deposit) : "—",
                ],
              ].map(([label, value]) => (
                <View key={label} style={s.fact}>
                  <Text style={[s.caption, muted]}>{label}</Text>
                  <Text style={[s.body, ink]}>{value}</Text>
                </View>
              ))}
            </View>
            {row.status !== "active" && (
              <View style={s.signers}>
                {signer(row, "tenant")}
                {signer(row, "owner")}
              </View>
            )}
            {mode === "tenant" && row.status === "active" && row.nextRentBill !== undefined && (
              <View style={s.nextBill}>
                <MobileIcon
                  name="calendar"
                  size={16}
                  color={theme.textSecondary}
                />
                <View style={[s.flex, s.nextBillCopy]}>
                  <Text style={[s.caption, muted]}>
                    {copy.nextRentBill}
                    {row.nextRentBill
                      ? ` · ${format.month(row.nextRentBill.period)}`
                      : ""}
                  </Text>
                  {row.nextRentBill ? (
                    <>
                      <Text style={[s.body, ink]}>
                        {t.tenant.bills.issueOn}{" "}
                        {format.date(row.nextRentBill.issueDate)}
                      </Text>
                      <Text style={[s.caption, muted]}>
                        {t.tenant.bills.dueDate}{" "}
                        {format.date(row.nextRentBill.dueDate)}
                      </Text>
                    </>
                  ) : (
                    <Text style={[s.caption, muted]}>
                      {copy.noMoreRentBills}
                    </Text>
                  )}
                </View>
              </View>
            )}
            <MobileButton onPress={() => onOpen(row)}>
              {canSign ? copy.viewAndSign : copy.viewContract}
            </MobileButton>
          </View>
        );
      })}
      {(documents.length > 0 || leases.length > 0) && (
        <>
          <Text style={[s.sectionTitle, ink]}>{copy.roomDocuments}</Text>
          {documents.map((row) => (
            <Pressable
              key={row.id}
              accessibilityRole="button"
              onPress={() => onOpen(row)}
              style={({ pressed }) => [
                s.document,
                surface,
                pressed && s.pressed,
              ]}
            >
              <View
                style={[s.documentIcon, { backgroundColor: theme.background }]}
              >
                <MobileIcon
                  name="file-text"
                  size={20}
                  color={theme.screenTitle}
                />
              </View>
              <View style={s.flex}>
                <Text style={[s.body, ink]}>
                  {row.formKind === "reservation"
                    ? copy.reservation
                    : copy.broker}
                </Text>
                <Text style={[s.caption, muted]}>{row.contractNo}</Text>
                {badge(row)}
              </View>
              <MobileIcon
                name="chevron-right"
                size={18}
                color={tokens.colors.divider}
              />
            </Pressable>
          ))}
          {leases.map((row) => (
            <Pressable
              key={`attachments-${row.id}`}
              accessibilityRole="button"
              onPress={() => onOpen(row)}
              style={({ pressed }) => [
                s.document,
                surface,
                pressed && s.pressed,
              ]}
            >
              <View
                style={[s.documentIcon, { backgroundColor: theme.background }]}
              >
                <MobileIcon name="files" size={20} color={theme.screenTitle} />
              </View>
              <View style={s.flex}>
                <Text style={[s.body, ink]}>{copy.attachments}</Text>
                <Text style={[s.caption, muted]}>
                  {copy.documentHint} · {row.contractNo}
                </Text>
              </View>
              <MobileIcon
                name="chevron-right"
                size={18}
                color={tokens.colors.divider}
              />
            </Pressable>
          ))}
        </>
      )}
      {mode !== "owner" || visibleContracts.length > 0 ? (
        <View style={s.note}>
          <MobileIcon name="shield" size={16} color={theme.textSecondary} />
          <Text style={[s.caption, muted, s.flex]}>{copy.contractsHint}</Text>
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  root: { gap: 16 },
  flex: { flex: 1, minWidth: 0 },
  room: {
    padding: 12,
    borderWidth: 1,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  filters: { flexDirection: "row", gap: 8 },
  sectionRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  hubCard: { padding: 14, borderWidth: 1, borderRadius: 16, gap: 12 },
  hubTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  hubIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  hubMid: { flexDirection: "row", alignItems: "center", gap: 8 },
  hubFoot: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderTopWidth: 1,
    paddingTop: 10,
  },
  roomIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  roomTitle: {
    fontFamily: tokens.typography.native.body,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "500",
  },
  caption: {
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    lineHeight: 18,
  },
  body: {
    fontFamily: tokens.typography.native.body,
    fontSize: 14,
    lineHeight: 22,
  },
  contract: { padding: 18, borderWidth: 1, borderRadius: 18, gap: 10 },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    justifyContent: "space-between",
  },
  contractTitle: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 17,
    lineHeight: 26,
  },
  facts: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingVertical: 12,
    borderBottomWidth: 1,
    rowGap: 14,
  },
  fact: { width: "50%", paddingRight: 8, gap: 4 },
  signers: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    paddingBottom: 6,
  },
  signer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexWrap: "wrap",
  },
  nextBill: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingVertical: 4,
  },
  nextBillCopy: { gap: 2 },
  sectionTitle: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 16,
    lineHeight: 24,
  },
  document: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  documentIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  note: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  pressed: { opacity: 0.85 },
});

export function TenantContractAttachments({
  attachments,
  loading,
  disabled,
  onOpen,
}: {
  attachments: AgreementAttachmentChecklist | null;
  loading: boolean;
  disabled: boolean;
  onOpen: (documentId: number) => void;
}) {
  const { theme } = useMobileTheme();
  const { locale } = useLocale();
  const copy = tenantWorkspaceCopy(locale);
  const documents = (attachments?.documents ?? []).filter(
    (doc) => doc.isCurrent && doc.documentTypeCode.startsWith("lease_annex_"),
  );
  return (
    <View
      style={[
        s.contract,
        { backgroundColor: theme.surface, borderColor: theme.border },
      ]}
    >
      <Text style={[s.sectionTitle, { color: theme.textHeading }]}>
        {copy.attachments}
      </Text>
      {loading ? <ActivityIndicator color={tokens.colors.brand[500]} /> : null}
      {!loading && attachments && !documents.length ? (
        <Text style={[s.caption, { color: theme.textSecondary }]}>
          {copy.noAttachments}
        </Text>
      ) : null}
      {documents.map((document) => (
        <MobileButton
          key={document.id}
          variant="outline"
          disabled={disabled}
          onPress={() => onOpen(document.id)}
        >
          {document.fileName}
        </MobileButton>
      ))}
    </View>
  );
}
