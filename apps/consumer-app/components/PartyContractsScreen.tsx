import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Modal, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView, initialWindowMetrics } from "react-native-safe-area-context";
import { MobileSectionHeader, tokens, useMobileTheme } from "@nestyk/ui/native";
import type { PartyContract } from "@nestyk/types";
import { localizedError, useLocale } from "@nestyk/i18n";
import { listMyContracts, listMyOwnedRooms, type OwnedRoom } from "../lib/party-contracts-api";
import { PartyContractDetail } from "./PartyContractDetail";
import { TenantContractList } from "./TenantContractList";

export type PartyContractRoom = {
  key: string;
  property: string;
  room: string | null;
  tenant?: string | null;
};

export function PartyContractsScreen({
  reloadToken = 0,
  onReloadSettled,
  onRefresh,
  opened,
  onOpenedChange,
  selectedRoom,
  onSelectedRoomChange,
  history = false,
  accentColor = tokens.colors.roles.owner,
  mode = "owner",
}: {
  reloadToken?: number;
  onReloadSettled?: (token: number) => void;
  onRefresh?: () => void;
  opened: PartyContract | null;
  onOpenedChange: (contract: PartyContract | null) => void;
  selectedRoom: PartyContractRoom | null;
  onSelectedRoomChange: (room: PartyContractRoom | null) => void;
  history?: boolean;
  accentColor?: string;
  mode?: "owner" | "tenant";
}) {
  const { theme } = useMobileTheme();
  const { t, locale } = useLocale();
  const pc = t.contracts.party;
  const [rows, setRows] = useState<PartyContract[]>([]);
  const [ownedRooms, setOwnedRooms] = useState<OwnedRoom[]>([]);
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
    Promise.all([
      listMyContracts(),
      mode === "owner" ? listMyOwnedRooms().catch(() => [] as OwnedRoom[]) : Promise.resolve([] as OwnedRoom[]),
    ])
      .then(([next, rooms]) => {
        if (!cancelled) {
          setRows(next);
          setOwnedRooms(rooms);
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
  }, [reloadToken, mode]);

  return (
    <View style={styles.root}>
      {!!error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
      {loading ? <ActivityIndicator color={tokens.colors.brand[500]} /> : null}
      {(rows.length || (!loading && !error)) ? (
        <TenantContractList
          mode={mode}
          rows={rows}
          ownedRooms={ownedRooms}
          selectedRoom={selectedRoom}
          history={history}
          onSelectRoom={onSelectedRoomChange}
          onOpen={onOpenedChange}
        />
      ) : null}
      <Modal
        visible={opened != null}
        presentationStyle="fullScreen"
        animationType="slide"
        onRequestClose={() => onOpenedChange(null)}
      >
        {opened ? (
          <SafeAreaProvider initialMetrics={initialWindowMetrics}>
            <SafeAreaView style={[styles.detailRoot, { backgroundColor: mode === "tenant" ? theme.surface : theme.background }]}>
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
                  mode={mode}
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
  error: {
    fontFamily: tokens.typography.native.body,
    fontSize: 14,
    lineHeight: 22,
    color: "#C74747",
  },
});
