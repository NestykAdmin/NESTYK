import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { useLocale } from "@nestyk/i18n";
import {
  MobileButton,
  MobileIcon,
  MobileStatusPill,
  tokens,
  useMobileTheme,
  type AppIconName,
} from "@nestyk/ui/native";
import { formatBedroomSpec, type AgentRoomDetail } from "@nestyk/feature-listing";
import type { AgentTenant } from "@nestyk/types";
import { getAgentLead } from "../lib/agent-leads-api";
import { fetchAgentRoom } from "../lib/agent-listings-api";
import { billFormatters } from "../lib/bill-format";
import { roomLayoutValue } from "../lib/lead-room-compare";
import { formatPhoneDisplay } from "../lib/phone";
import { leaseProgress, rentDueDay, tenantLease } from "../lib/tenant-detail";
import { AgentRoomDetailModal } from "./AgentRoomDetailModal";
import { CallButton, DetailCard, DetailField, SectionLabel, ps } from "./TenantDetailParts";

type RoomLoad = { status: "loading" } | { status: "ready"; room: AgentRoomDetail } | { status: "missing" | "error" };

/** The room the tenant rents: listing photo and specs, the lease money terms, and the owner to call. */
export function TenantRoomBody({ tenant }: { tenant: AgentTenant }) {
  const { t, locale } = useLocale();
  const d = t.agent.tenants.detail;
  const spec = t.agent.listings;
  const { theme, isDark } = useMobileTheme();
  const fmt = billFormatters(locale);
  const [load, setLoad] = useState<RoomLoad>({ status: "loading" });
  const [listingOpen, setListingOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoad({ status: "loading" });
    (async () => {
      const lead = await getAgentLead(tenant.leadId);
      if (!lead.rentRoomId) return { status: "missing" } as const;
      return { status: "ready", room: await fetchAgentRoom(lead.rentRoomId) } as const;
    })()
      .then((next) => {
        if (!cancelled) setLoad(next);
      })
      .catch(() => {
        if (!cancelled) setLoad({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [tenant.leadId]);

  const lease = tenantLease(tenant);
  const active = lease?.status === "active";
  const dueDay = lease ? rentDueDay(lease) : null;
  const progress = lease && active ? leaseProgress(lease) : null;
  const room = load.status === "ready" ? load.room : null;
  const cover = room?.medias.find((m) => m.isCover && m.mediaType === "image") ?? room?.medias.find((m) => m.mediaType === "image");
  const owner = room?.contacts.find((x) => x.isPrimary) ?? room?.contacts[0] ?? null;

  const facts: Array<{ key: string; icon: AppIconName; label: string }> = [];
  if (room) {
    const bed = formatBedroomSpec(
      roomLayoutValue(room, "bedroom"),
      { studio: t.masters.roomTypes.studio, one: spec.specBed, many: spec.specBeds },
      room.roomTypeCode,
    );
    const size = roomLayoutValue(room, "room_size");
    const floor = roomLayoutValue(room, "floor");
    if (bed) facts.push({ key: "bed", icon: "bed", label: bed });
    if (size) facts.push({ key: "size", icon: "room-size", label: spec.specSqm.replace("{size}", size) });
    if (floor) facts.push({ key: "floor", icon: "stairs", label: spec.specFloor.replace("{floor}", floor) });
  }

  const roomName = tenant.room || room?.roomId || null;
  const leaseFields = lease
    ? [
        { key: "rent", label: d.rent, value: lease.monthlyRent ? `${fmt.amount(lease.monthlyRent)}${d.perMonth}` : d.notSet },
        { key: "due", label: d.dueDay, value: dueDay ? d.dueDayValue.replace("{day}", String(dueDay)) : d.notSet },
        { key: "deposit", label: d.deposit, value: lease.deposit ? fmt.amount(lease.deposit) : d.notSet },
        {
          key: "moveIn",
          label: d.moveIn,
          value: lease.moveInDate || lease.startDate ? fmt.date(lease.moveInDate ?? lease.startDate) : d.notSet,
        },
      ]
    : [];

  return (
    <View style={s.root}>
      <DetailCard style={s.roomCard}>
        <View style={[s.cover, { backgroundColor: isDark ? "rgba(148,163,184,0.12)" : "#F1F5F9" }]}>
          {cover ? (
            <Image source={{ uri: cover.mediaUrl }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
          ) : load.status === "loading" ? (
            <ActivityIndicator color={tokens.colors.roles.agent} />
          ) : (
            <MobileIcon name="home" size={32} color={theme.textSecondary} />
          )}
          {active ? <MobileStatusPill label={d.occupied} tone="green" style={s.coverPill} /> : null}
        </View>
        <View style={s.roomCopy}>
          <Text style={[s.roomTitle, { color: theme.textHeading }]}>
            {roomName ? d.roomTitle.replace("{room}", roomName) : tenant.property}
          </Text>
          {roomName ? (
            <Text style={[ps.body, { color: theme.textSecondary }]}>{room?.property?.name || tenant.property}</Text>
          ) : null}
          {tenant.fullAddress ? (
            <View style={[ps.row, s.address]}>
              <MobileIcon name="map-pin" size={14} color={theme.textSecondary} />
              <Text style={[ps.small, ps.grow, { color: theme.textSecondary }]}>{tenant.fullAddress}</Text>
            </View>
          ) : null}
          {facts.length ? (
            <View style={s.facts}>
              {facts.map((fact) => (
                <View key={fact.key} style={[s.fact, { borderColor: theme.border }]}>
                  <MobileIcon name={fact.icon} size={15} color={theme.textSecondary} />
                  <Text style={[ps.small, { color: theme.textHeading }]}>{fact.label}</Text>
                </View>
              ))}
            </View>
          ) : null}
          {load.status === "missing" || load.status === "error" ? (
            <Text style={[ps.small, { color: theme.textSecondary }]}>
              {load.status === "missing" ? d.roomNotLinked : d.roomLoadError}
            </Text>
          ) : null}
        </View>
      </DetailCard>

      {lease ? (
        <DetailCard>
          <View style={s.grid}>
            {[leaseFields.slice(0, 2), leaseFields.slice(2, 4)].map((row, index) => (
              <View key={index} style={s.gridRow}>
                {row.map((field) => (
                  <DetailField key={field.key} label={field.label} value={field.value} style={s.gridCell} />
                ))}
              </View>
            ))}
          </View>
          {progress ? (
            <View style={[s.progressBlock, { borderTopColor: theme.border }]}>
              <View style={ps.row}>
                <Text style={[ps.small, ps.grow, { color: theme.textSecondary }]}>{d.leaseTerm}</Text>
                <Text style={[ps.value, { color: progress.daysLeft <= 30 ? tokens.colors.warning : theme.textHeading }]}>
                  {progress.daysLeft > 0 ? d.daysLeft.replace("{days}", String(progress.daysLeft)) : d.leaseEnded}
                </Text>
              </View>
              <View
                style={[s.track, { backgroundColor: isDark ? "rgba(148,163,184,0.2)" : "#E2E8F0" }]}
                accessibilityRole="progressbar"
                accessibilityValue={{ min: 0, max: 100, now: Math.round(progress.ratio * 100) }}
              >
                <View style={[s.fill, { flex: progress.ratio }]} />
                <View style={{ flex: 1 - progress.ratio }} />
              </View>
              <View style={ps.row}>
                <Text style={[ps.small, ps.grow, { color: theme.textSecondary }]}>{fmt.date(progress.start)}</Text>
                <Text style={[ps.small, { color: theme.textSecondary }]}>{fmt.date(progress.end)}</Text>
              </View>
            </View>
          ) : null}
        </DetailCard>
      ) : (
        <DetailCard>
          <Text style={[ps.body, { color: theme.textSecondary }]}>{d.roomNoLeaseBody}</Text>
        </DetailCard>
      )}

      {owner ? (
        <>
          <SectionLabel>{d.owner}</SectionLabel>
          <DetailCard>
            <View style={ps.row}>
              <View style={ps.grow}>
                <Text style={[ps.value, { color: theme.textHeading }]}>{owner.name}</Text>
                <Text selectable style={[ps.small, { color: theme.textSecondary }]}>
                  {formatPhoneDisplay(owner.phone)}
                </Text>
              </View>
              <CallButton phone={owner.phone} label={d.callA11y.replace("{name}", owner.name)} />
            </View>
          </DetailCard>
        </>
      ) : null}

      {room ? (
        <MobileButton variant="outline" onPress={() => setListingOpen(true)}>
          {d.viewListing}
        </MobileButton>
      ) : null}

      <AgentRoomDetailModal roomId={listingOpen && room ? room.id : null} onClose={() => setListingOpen(false)} />
    </View>
  );
}

const s = StyleSheet.create({
  root: { gap: 14 },
  roomCard: { padding: 0, gap: 0 },
  cover: { height: 180, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  coverPill: { position: "absolute", top: 12, left: 12 },
  roomCopy: { padding: 16, gap: 4 },
  roomTitle: { fontFamily: tokens.typography.native.headingTh, fontSize: 20, lineHeight: 30 },
  address: { alignItems: "flex-start", marginTop: 2 },
  facts: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  fact: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  grid: { gap: 14 },
  gridRow: { flexDirection: "row", gap: 12 },
  gridCell: { flex: 1 },
  progressBlock: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12, gap: 8 },
  track: { height: 8, borderRadius: 4, overflow: "hidden", flexDirection: "row" },
  fill: { backgroundColor: tokens.colors.brand[500], borderRadius: 4 },
});
