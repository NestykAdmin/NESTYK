import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { localizedError, useLocale } from "@nestyk/i18n";
import {
  MobileButton,
  MobileIcon,
  MobileInput,
  MobileStatusPill,
  tokens,
  useMobileTheme,
} from "@nestyk/ui/native";
import type {
  AgentTenant,
  TenantLeadOption,
  TenantRoomOption,
} from "@nestyk/types";
import {
  tenantLeadOptions,
  tenantRoomOptions,
} from "../lib/agent-tenants-api";
import { ReserveRoomSheet } from "./ReserveRoomSheet";

/**
 * Booking a room from the Clients menu, for the cases a lead's matched-room page cannot reach:
 * pick the lead, pick the room, then confirm in the same sheet that page uses. The tenant's
 * details are filled in from the lead there, so nothing is typed here.
 */
export function TenantForm({
  onCreated,
  onBusy,
  backRef,
}: {
  onCreated: (tenant: AgentTenant) => void;
  onBusy?: (busy: boolean) => void;
  /** Shell header / hardware back: returns true when it stepped back, false on the first step. */
  backRef?: React.MutableRefObject<(() => boolean) | null>;
}) {
  const { t, locale } = useLocale();
  const c = t.agent.tenants;
  const viewing = t.agent.leads.viewing;
  const { theme } = useMobileTheme();
  const [step, setStep] = useState(1);
  const scroll = useRef<ScrollView>(null);
  const [lead, setLead] = useState<TenantLeadOption | null>(null);
  const [room, setRoom] = useState<TenantRoomOption | null>(null);
  const [leads, setLeads] = useState<TenantLeadOption[]>([]);
  const [rooms, setRooms] = useState<TenantRoomOption[]>([]);
  const [search, setSearch] = useState("");
  const [roomSearch, setRoomSearch] = useState("");
  const [retry, setRetry] = useState(0);
  const [loading, setLoading] = useState(false);
  /** null = loaded; a message (or "" for an unknown failure) = the list could not be read. */
  const [loadError, setLoadError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const leadId = lead?.id ?? null;
  const title = { color: theme.textHeading };
  const muted = { color: theme.textSecondary };
  const panel = { backgroundColor: theme.surface, borderColor: theme.border };
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    const timer = setTimeout(async () => {
      try {
        if (step === 1) {
          const data = await tenantLeadOptions(search);
          if (!cancelled) setLeads(data);
        } else {
          const data = await tenantRoomOptions(roomSearch, {
            leadId: leadId ?? undefined,
          });
          if (!cancelled) setRooms(data);
        }
      } catch (e) {
        if (!cancelled) setLoadError(localizedError(e, "", locale));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [step, search, roomSearch, retry, leadId]);
  // A reloaded list carries the latest number and booking state of the room already picked.
  useEffect(() => {
    setRoom(
      (current) => (current && rooms.find((r) => r.id === current.id)) || current,
    );
  }, [rooms]);
  useEffect(() => {
    scroll.current?.scrollTo({ y: 0, animated: false });
  }, [step]);
  useEffect(() => {
    if (!backRef) return;
    backRef.current = () => {
      if (step <= 1) return false;
      setStep(step - 1);
      return true;
    };
    return () => {
      backRef.current = null;
    };
  }, [backRef, step]);
  function pickLead(next: TenantLeadOption) {
    if (lead?.id !== next.id) {
      setLead(next);
      setRoom(null);
      setRooms([]);
      setRoomSearch("");
    }
    setStep(2);
  }
  function pickRoom(next: TenantRoomOption) {
    if (next.bookedBy) return;
    setRoom(next);
    setConfirming(true);
  }
  const roomLabel = (r: TenantRoomOption) =>
    r.room ? viewing.roomNumber.replace("{number}", r.room) : c.roomNoNumber;
  const steps = [c.stepLead, c.stepRoom];
  const failed = loadError !== null;
  return (
    <KeyboardAvoidingView
      style={s.fill}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={s.tabsWrap}>
        <View
          style={[s.tabs, { borderColor: theme.border }]}
          accessibilityRole="tablist"
        >
          {steps.map((label, i) => {
            const n = i + 1;
            const on = step === n;
            const done = n < step;
            return (
              <Pressable
                key={label}
                accessibilityRole="tab"
                accessibilityState={{ selected: on, disabled: !done }}
                disabled={!done}
                onPress={() => setStep(n)}
                android_ripple={{ color: tokens.colors.brand[100], borderless: false }}
                style={({ pressed }) => [
                  s.tab,
                  on && s.tabOn,
                  pressed && Platform.OS === "ios" && s.tabPressed,
                ]}
              >
                <Text
                  style={[
                    s.tabText,
                    {
                      color: on
                        ? tokens.colors.primary
                        : done
                          ? theme.textHeading
                          : theme.textSecondary,
                    },
                    on && s.tabTextOn,
                  ]}
                  numberOfLines={1}
                >
                  {n}. {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      <ScrollView
        ref={scroll}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={s.form}
      >
      <Text style={[s.body, muted]}>
        {step === 2 && lead ? c.roomFor.replace("{name}", lead.name) : c.pickIntro}
      </Text>
      {failed && (
        <View style={[s.panel, panel]}>
          <Text
            accessibilityRole="alert"
            style={[s.body, { color: tokens.colors.danger }]}
          >
            {loadError || c.loadError}
          </Text>
          <MobileButton variant="outline" onPress={() => setRetry((n) => n + 1)}>
            {c.retry}
          </MobileButton>
        </View>
      )}
      {step === 1 && (
        <>
          <MobileInput
            value={search}
            onChangeText={setSearch}
            placeholder={c.leadSearch}
          />
          <Text style={[s.small, muted]}>{c.leadListHint}</Text>
          {loading ? (
            <ActivityIndicator />
          ) : (
            !failed && (
              <>
                {leads.map((l) => (
                  <Pressable
                    key={l.id}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: lead?.id === l.id }}
                    onPress={() => pickLead(l)}
                    android_ripple={{ color: tokens.colors.brand[100], borderless: false }}
                    style={({ pressed }) => [
                      s.panel,
                      s.row,
                      panel,
                      lead?.id === l.id && {
                        borderColor: "#FFBF19",
                        borderWidth: 2,
                      },
                      pressed && Platform.OS === "ios" && s.rowPressed,
                    ]}
                  >
                    <Text style={[s.subtitle, title]}>
                      {lead?.id === l.id ? "● " : "○ "}
                      {l.name}
                    </Text>
                    <Text style={[s.body, muted]}>{l.phone}</Text>
                  </Pressable>
                ))}
                {!leads.length && (
                  <Text style={[s.body, muted]}>
                    {search ? c.leadNoMatch : c.leadEmpty}
                  </Text>
                )}
              </>
            )
          )}
        </>
      )}
      {step === 2 && (
        <>
          <MobileInput
            value={roomSearch}
            onChangeText={setRoomSearch}
            placeholder={c.roomSearch}
          />
          <Text style={[s.small, muted]}>{c.roomListHint}</Text>
          {loading ? (
            <ActivityIndicator />
          ) : (
            !failed &&
            rooms.map((r) => (
              <Pressable
                key={r.id}
                accessibilityRole="radio"
                accessibilityState={{
                  checked: room?.id === r.id,
                  disabled: !!r.bookedBy,
                }}
                disabled={!!r.bookedBy}
                onPress={() => pickRoom(r)}
                android_ripple={{ color: tokens.colors.brand[100], borderless: false }}
                style={({ pressed }) => [
                  s.room,
                  s.row,
                  panel,
                  room?.id === r.id && { borderColor: "#FFBF19", borderWidth: 2 },
                  !!r.bookedBy && s.roomTaken,
                  pressed && Platform.OS === "ios" && s.rowPressed,
                ]}
              >
                <Text style={[s.body, title]}>
                  {room?.id === r.id ? "● " : "○ "}
                  {r.property}
                </Text>
                <Text style={[s.small, muted]}>{roomLabel(r)}</Text>
                {r.bookedBy ? (
                  <MobileStatusPill
                    label={c.roomBookedBy.replace("{name}", r.bookedBy)}
                    tone="red"
                    style={s.pill}
                  />
                ) : r.viewed ? (
                  <MobileStatusPill label={c.roomViewed} tone="purple" />
                ) : null}
              </Pressable>
            ))
          )}
          {!loading && !failed && !rooms.length && (
            <Text style={[s.body, muted]}>{c.roomEmpty}</Text>
          )}
        </>
      )}
      </ScrollView>
      <View
        style={[
          s.footer,
          { backgroundColor: theme.surface, borderTopColor: theme.border },
        ]}
      >
        <View style={s.footerRow}>
          {step > 1 && (
            <MobileButton
              variant="outline"
              onPress={() => setStep(step - 1)}
              style={s.backButton}
            >
              {c.back}
            </MobileButton>
          )}
          {step === 1 ? (
            <MobileButton
              onPress={() => setStep(2)}
              disabled={!lead}
              style={s.primaryButton}
            >
              <Text style={s.primaryText}>{c.next}</Text>
            </MobileButton>
          ) : (
            <MobileButton
              onPress={() => setConfirming(true)}
              disabled={!room || !!room.bookedBy}
              style={s.primaryButton}
            >
              <View style={s.primaryInner}>
                <MobileIcon name="check" size={18} color={tokens.colors.primary} />
                <Text style={s.primaryText}>{viewing.reserve}</Text>
              </View>
            </MobileButton>
          )}
        </View>
      </View>
      <ReserveRoomSheet
        visible={confirming}
        lead={lead}
        room={room}
        showBookedState={false}
        onBusy={onBusy}
        onClose={() => setConfirming(false)}
        onReserved={(tenant) => {
          setConfirming(false);
          onCreated(tenant);
        }}
      />
    </KeyboardAvoidingView>
  );
}
const s = StyleSheet.create({
  fill: { flex: 1 },
  tabsWrap: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  tabs: {
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: 12,
    padding: 4,
    gap: 4,
    backgroundColor: "#F1F5F9",
  },
  tab: {
    flex: 1,
    minHeight: 40,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
    overflow: "hidden",
  },
  tabOn: { backgroundColor: tokens.colors.brand[500] },
  tabPressed: { opacity: 0.7 },
  tabText: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 14,
    lineHeight: 21,
  },
  tabTextOn: { fontWeight: "600" },
  form: {
    width: "100%",
    maxWidth: 760,
    alignSelf: "center",
    padding: 16,
    paddingTop: 12,
    gap: 16,
    paddingBottom: 24,
  },
  subtitle: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 17,
    lineHeight: 26,
  },
  body: {
    fontFamily: tokens.typography.native.body,
    fontSize: 14,
    lineHeight: 23,
  },
  small: {
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    lineHeight: 20,
  },
  panel: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 14 },
  room: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 4 },
  roomTaken: { opacity: 0.6 },
  // Rows are pressable: clip the Android ripple to the rounded card, dim on iOS.
  row: { overflow: "hidden" },
  rowPressed: { opacity: 0.7 },
  pill: { maxWidth: 240 },
  footer: {
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
    gap: 8,
  },
  footerRow: { flexDirection: "row", gap: 10 },
  backButton: { flex: 1, minHeight: 50, borderRadius: 12 },
  primaryButton: { flex: 2, minHeight: 50, borderRadius: 12 },
  primaryInner: { flexDirection: "row", alignItems: "center", gap: 8 },
  primaryText: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 16,
    lineHeight: 24,
    color: tokens.colors.primary,
  },
});
