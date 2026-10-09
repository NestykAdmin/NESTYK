import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView, initialWindowMetrics } from "react-native-safe-area-context";
import { MobileButton, MobileIcon, MobileSectionHeader, tokens, useMobileTheme } from "@nestyk/ui/native";
import type { AppIconName } from "@nestyk/ui/native";
import type { AgentContractStatus, PartyContract } from "@nestyk/types";
import { fillTemplate, localizedError, useLocale } from "@nestyk/i18n";
import { listMyContracts } from "../lib/party-contracts-api";
import { PartyContractDetail } from "./PartyContractDetail";

function statusColor(status: AgentContractStatus) {
  if (status === "active") return "#278268";
  if (status.startsWith("awaiting")) return "#BB7914";
  return "#788193";
}

const CONTRACT_ICON: Record<PartyContract["formKind"], AppIconName> = {
  reservation: "calendar",
  lease: "key",
  broker_appointment: "handshake",
};

const KIND_ORDER: PartyContract["formKind"][] = ["reservation", "lease", "broker_appointment"];

export type PartyContractRoom = {
  key: string;
  property: string;
  room: string | null;
};

function partyRoom(row: Pick<PartyContract, "property" | "room">, noProject: string): PartyContractRoom {
  const property = row.property?.trim() || noProject;
  return { key: `${property}\u0000${row.room ?? ""}`, property, room: row.room };
}

function roomGroups(rows: PartyContract[], noProject: string) {
  const groups = new Map<string, PartyContractRoom & { count: number; kinds: PartyContract["formKind"][] }>();
  for (const row of rows) {
    const room = partyRoom(row, noProject);
    const current = groups.get(room.key);
    if (!current) {
      groups.set(room.key, { ...room, count: 1, kinds: [row.formKind] });
      continue;
    }
    current.count += 1;
    if (!current.kinds.includes(row.formKind)) current.kinds.push(row.formKind);
  }
  return [...groups.values()]
    .map((group) => ({
      ...group,
      kinds: KIND_ORDER.filter((kind) => group.kinds.includes(kind)),
    }))
    .sort((a, b) => a.property.localeCompare(b.property, "th") || (a.room ?? "").localeCompare(b.room ?? "", "th"));
}

type SignerKey = "owner" | "tenant" | "agent";

function signerKeys(row: PartyContract): SignerKey[] {
  if (row.formKind === "lease") return ["owner", "tenant"];
  if (row.formKind === "broker_appointment") return ["owner", "agent"];
  return ["owner", "tenant", "agent"];
}

function signedAt(row: PartyContract, party: SignerKey) {
  if (party === "owner") return row.ownerSignedAt;
  if (party === "tenant") return row.tenantSignedAt;
  return row.agentSignedAt;
}

export function PartyContractsScreen({
  reloadToken = 0,
  onReloadSettled,
  onRefresh,
  opened,
  onOpenedChange,
  selectedRoom,
  onSelectedRoomChange,
  accentColor = tokens.colors.roles.owner,
}: {
  reloadToken?: number;
  onReloadSettled?: (token: number) => void;
  onRefresh?: () => void;
  opened: PartyContract | null;
  onOpenedChange: (contract: PartyContract | null) => void;
  selectedRoom: PartyContractRoom | null;
  onSelectedRoomChange: (room: PartyContractRoom | null) => void;
  accentColor?: string;
}) {
  const { theme } = useMobileTheme();
  const { t, locale } = useLocale();
  const tc = t.contracts;
  const pc = tc.party;
  const [rows, setRows] = useState<PartyContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const openedRef = useRef(opened);
  const onOpenedChangeRef = useRef(onOpenedChange);
  openedRef.current = opened;
  onOpenedChangeRef.current = onOpenedChange;

  const [listSettled, setListSettled] = useState(-1);
  const [detailSettled, setDetailSettled] = useState(-1);

  useEffect(() => {
    if (listSettled === reloadToken && (!opened || detailSettled === reloadToken)) {
      onReloadSettled?.(reloadToken);
    }
  }, [listSettled, detailSettled, reloadToken, opened, onReloadSettled]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    listMyContracts()
      .then((next) => {
        if (!cancelled) {
          setRows(next);
          const current = openedRef.current;
          if (current) {
            onOpenedChangeRef.current(next.find((row) => row.id === current.id) ?? current);
          }
        }
      })
      .catch((e) => {
        if (!cancelled)
          setError(localizedError(e, t.mobile.partyContracts.loadFailed, locale));
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
          setListSettled(reloadToken);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const title = { color: theme.textHeading, fontFamily: tokens.typography.native.headingTh };
  const body = { color: theme.textSecondary, fontFamily: tokens.typography.native.body };

  return (
    <View style={styles.root}>
      {!!error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
      {loading ? <ActivityIndicator color={tokens.colors.brand[500]} /> : null}
      {!loading && !rows.length && !error ? (
        <Text style={[styles.copy, body]}>{pc.empty}</Text>
      ) : null}
      {!selectedRoom
        ? roomGroups(rows, pc.noProject).map((room) => (
            <Pressable
              key={room.key}
              accessibilityRole="button"
              accessibilityLabel={`${room.property}${room.room ? ` ${fillTemplate(tc.common.room, { room: room.room })}` : ""} ${fillTemplate(pc.documentCount, { count: room.count })}`}
              android_ripple={{ color: `${accentColor}22` }}
              onPress={() => onSelectedRoomChange({ key: room.key, property: room.property, room: room.room })}
              style={({ pressed }) => [
                styles.card,
                { backgroundColor: theme.card, borderColor: theme.border },
                pressed ? styles.pressed : null,
              ]}
            >
              <View style={styles.cardHeader}>
                <View style={styles.cardTitle}>
                  <View style={[styles.kindIcon, { backgroundColor: `${accentColor}18` }]}>
                    <MobileIcon name="home" size={18} color={accentColor} />
                  </View>
                  <View style={styles.contractNoText}>
                    <Text style={[styles.contractNo, title]} numberOfLines={2}>
                      {room.property}
                    </Text>
                    {room.room ? (
                      <Text style={[styles.copy, body]}>{fillTemplate(tc.common.room, { room: room.room })}</Text>
                    ) : null}
                  </View>
                </View>
                <Text style={[styles.count, { color: accentColor }]}>{fillTemplate(pc.documentCount, { count: room.count })}</Text>
              </View>
              <View style={styles.kindRow}>
                {room.kinds.map((kind) => (
                  <View key={kind} style={[styles.kindChip, { borderColor: theme.border }]}>
                    <MobileIcon name={CONTRACT_ICON[kind]} size={14} color={accentColor} />
                    <Text style={[styles.kindLabel, body]}>{tc.common.kinds[kind]}</Text>
                  </View>
                ))}
              </View>
            </Pressable>
          ))
        : null}
      {!loading && selectedRoom && !rows.some((row) => partyRoom(row, pc.noProject).key === selectedRoom.key) && !error ? (
        <Text style={[styles.copy, body]}>{pc.emptyRoom}</Text>
      ) : null}
      {(selectedRoom ? rows.filter((row) => partyRoom(row, pc.noProject).key === selectedRoom.key) : []).map((row) => (
        <View
          key={row.id}
          style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}
        >
          <View style={styles.cardHeader}>
            <View style={styles.cardTitle}>
              <View style={[styles.kindIcon, { backgroundColor: `${accentColor}18` }]}>
                <MobileIcon name={CONTRACT_ICON[row.formKind]} size={18} color={accentColor} />
              </View>
              <Text style={[styles.contractNo, title, styles.contractNoText]} numberOfLines={1}>
                {row.contractNo}
              </Text>
            </View>
            <StatusBadge status={row.status} />
          </View>
          <Text style={[styles.copy, body]}>{locale === "th" ? row.agreementTypeName : tc.common.kinds[row.formKind]}</Text>
          <Text style={[styles.copy, body]}>{fillTemplate(pc.tenantName, { name: row.tenant })}</Text>
          {signerKeys(row).map((party) => {
            const signed = signedAt(row, party);
            return (
              <Text
                key={party}
                style={[styles.copy, body, signed ? styles.signed : null]}
              >
                {tc.common.parties[party]}
                {signed ? tc.common.signedSuffix : tc.common.unsignedSuffix}
              </Text>
            );
          })}
          <MobileButton variant="outline" onPress={() => onOpenedChange(row)}>
            {pc.viewContract}
          </MobileButton>
        </View>
      ))}
      <Modal
        visible={opened != null}
        presentationStyle="fullScreen"
        animationType="slide"
        onRequestClose={() => onOpenedChange(null)}
      >
        {opened ? (
          <SafeAreaProvider initialMetrics={initialWindowMetrics}>
            <SafeAreaView style={[styles.detailRoot, { backgroundColor: theme.background }]}>
              <View style={[styles.detailHeader, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
                <MobileSectionHeader
                  title={pc.detailTitle}
                  accentColor={accentColor}
                  leading="back"
                  onBackPress={() => onOpenedChange(null)}
                />
              </View>
              <ScrollView
                contentContainerStyle={styles.detailScroll}
                alwaysBounceVertical={Boolean(onRefresh)}
                refreshControl={onRefresh ? (
                  <RefreshControl
                    refreshing={listSettled !== reloadToken || detailSettled !== reloadToken}
                    onRefresh={onRefresh}
                    tintColor={accentColor}
                    colors={[accentColor]}
                    progressBackgroundColor={theme.surface}
                  />
                ) : undefined}
              >
                <PartyContractDetail
                  key={opened.id}
                  contract={opened}
                  accentColor={accentColor}
                  reloadToken={reloadToken}
                  onReloadSettled={setDetailSettled}
                  refreshError={error}
                  refreshing={listSettled !== reloadToken || detailSettled !== reloadToken}
                  onUpdated={(next) => {
                    onOpenedChange(next);
                    setRows((current) => current.map((row) => (row.id === next.id ? next : row)));
                  }}
                />
              </ScrollView>
            </SafeAreaView>
          </SafeAreaProvider>
        ) : null}
      </Modal>
    </View>
  );
}

function StatusBadge({ status }: { status: AgentContractStatus }) {
  const { t } = useLocale();
  const color = statusColor(status);
  return (
    <View style={[styles.badge, { backgroundColor: `${color}15` }]}>
      <Text style={[styles.badgeLabel, { color }]}>{t.contracts.common.status[status]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 14, paddingBottom: 24 },
  detailRoot: { flex: 1 },
  detailHeader: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
    borderBottomWidth: 1,
  },
  detailScroll: { flexGrow: 1, padding: 16, paddingBottom: 32 },
  heading: { fontSize: 20, lineHeight: 30 },
  contractNo: { fontSize: 16, lineHeight: 24 },
  copy: { fontSize: 14, lineHeight: 22 },
  signed: { color: "#166534" },
  error: {
    fontFamily: tokens.typography.native.body,
    fontSize: 14,
    lineHeight: 22,
    color: "#C74747",
  },
  card: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 8 },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  cardTitle: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  kindIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  contractNoText: { flex: 1 },
  pressed: { opacity: 0.85 },
  count: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 14,
    lineHeight: 22,
  },
  kindRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  kindChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  kindLabel: { fontSize: 12, lineHeight: 18 },
  badge: { borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4 },
  badgeLabel: {
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    lineHeight: 18,
  },
});
