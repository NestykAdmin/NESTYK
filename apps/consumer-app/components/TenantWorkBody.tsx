import React from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useLocale } from "@nestyk/i18n";
import {
  MobileButton,
  MobileIcon,
  MobileListSearchRow,
  MobileStatusPill,
  STATUS_PILL_TONES,
  tokens,
  useMobileTheme,
  type AppIconName,
  type MobileStatusPillTone,
} from "@nestyk/ui/native";
import { billFormatters } from "../lib/bill-format";
import { tenantLease } from "../lib/tenant-detail";
import { TENANT_WORK_KINDS, workCounts, type TenantWorkItem, type TenantWorkKind } from "../lib/tenant-work";
import { DetailCard, RIPPLE, ps } from "./TenantDetailParts";

const SLIP_TONE: MobileStatusPillTone = { bg: "#FFEDD5", fg: "#C2410C", dot: "#F97316" };
export const WORK_TONE: Record<TenantWorkKind, MobileStatusPillTone> = {
  slip: SLIP_TONE,
  overdue: STATUS_PILL_TONES.red,
  signing: STATUS_PILL_TONES.blue,
  renewal: STATUS_PILL_TONES.yellow,
};
const WORK_ICON: Record<TenantWorkKind, AppIconName> = {
  slip: "file-text",
  overdue: "warning",
  signing: "pencil",
  renewal: "calendar",
};

/** "To do" tab: four tiles that filter the list, then every open item most urgent first. */
export function TenantWorkBody({
  items,
  kind,
  onKindChange,
  query,
  onQueryChange,
  onOpenTenant,
  onAction,
  busy,
}: {
  items: TenantWorkItem[];
  kind: TenantWorkKind | null;
  onKindChange: (kind: TenantWorkKind | null) => void;
  query: string;
  onQueryChange: (query: string) => void;
  onOpenTenant: (item: TenantWorkItem) => void;
  onAction: (item: TenantWorkItem) => void;
  busy: boolean;
}) {
  const { t, locale } = useLocale();
  const l = t.agent.tenants.list;
  const { theme, isDark } = useMobileTheme();
  const fmt = billFormatters(locale);
  const counts = workCounts(items);

  const label: Record<TenantWorkKind, string> = {
    slip: l.tileSlip,
    overdue: l.tileOverdue,
    signing: l.tileSigning,
    renewal: l.tileRenewal,
  };
  const hint = (k: TenantWorkKind) => {
    if (k === "overdue") return l.tileOverdueHint;
    const first = items.find((item) => item.kind === k);
    if (!first) return l.tileNone;
    if (first.kind === "signing")
      return l.tileSigningHint.replace("{signed}", String(first.signed)).replace("{required}", String(first.required));
    if (first.kind === "renewal") return l.tileRenewalHint.replace("{days}", String(first.daysLeft));
    return l.tileSlipHint;
  };

  const needle = query.trim().toLowerCase();
  const visible = items.filter(
    (item) =>
      (!kind || item.kind === kind) &&
      `${item.tenant.name} ${item.tenant.property} ${item.tenant.room ?? ""}`.toLowerCase().includes(needle),
  );

  const pill = (item: TenantWorkItem) =>
    item.kind === "slip"
      ? l.pillSlip
      : item.kind === "signing"
        ? l.pillSigning.replace("{signed}", String(item.signed)).replace("{required}", String(item.required))
        : item.kind === "renewal"
          ? item.daysLeft === 0
            ? l.pillRenewalToday
            : l.pillRenewal.replace("{days}", String(item.daysLeft))
          : l.tileOverdue;

  const meta = (item: TenantWorkItem) => {
    const lease = tenantLease(item.tenant);
    return [
      item.tenant.property,
      item.tenant.room ? l.metaRoom.replace("{room}", item.tenant.room) : null,
      item.kind === "slip"
        ? l.metaRent.replace("{amount}", fmt.amount(item.bill.amount))
        : item.kind === "signing"
          ? item.contract.agreementTypeName
          : item.kind === "renewal" && item.contract.endDate
            ? l.metaUntil.replace("{date}", fmt.date(item.contract.endDate))
            : lease?.monthlyRent
              ? l.metaRent.replace("{amount}", fmt.amount(lease.monthlyRent))
              : null,
    ]
      .filter(Boolean)
      .join(" · ");
  };

  const cta: Record<TenantWorkKind, string> = {
    slip: l.ctaSlip,
    overdue: l.ctaSlip,
    signing: l.ctaSigning,
    renewal: l.ctaRenewal,
  };

  return (
    <View style={s.root}>
      <View style={s.tiles}>
        {[TENANT_WORK_KINDS.slice(0, 2), TENANT_WORK_KINDS.slice(2, 4)].map((row, index) => (
          <View key={index} style={s.tileRow}>
            {row.map((k) => {
              const tone = WORK_TONE[k];
              const selected = kind === k;
              const disabled = k === "overdue";
              return (
                <Pressable
                  key={k}
                  disabled={disabled}
                  onPress={() => onKindChange(selected ? null : k)}
                  accessibilityRole="button"
                  accessibilityState={{ selected, disabled }}
                  accessibilityLabel={`${label[k]} ${counts[k]}, ${hint(k)}`}
                  android_ripple={RIPPLE}
                  style={({ pressed }) => [
                    s.tile,
                    {
                      backgroundColor: selected
                        ? isDark
                          ? "rgba(248,182,21,0.12)"
                          : tokens.colors.brand[50]
                        : theme.surface,
                      borderColor: selected ? tokens.colors.brand[500] : theme.border,
                    },
                    pressed && Platform.OS === "ios" ? ps.pressed : null,
                  ]}
                >
                  <View style={ps.row}>
                    <View style={[s.tileIcon, { backgroundColor: tone.bg }]}>
                      <MobileIcon name={WORK_ICON[k]} size={18} color={tone.fg} />
                    </View>
                    <Text style={[s.tileCount, { color: disabled ? theme.textSecondary : tone.fg }]}>{counts[k]}</Text>
                  </View>
                  <Text style={[ps.rowTitle, { color: theme.textHeading }]} numberOfLines={1}>
                    {label[k]}
                  </Text>
                  <View style={s.tileHint}>
                    <Text style={[ps.small, ps.grow, { color: theme.textSecondary }]} numberOfLines={1}>
                      {hint(k)}
                    </Text>
                    {!disabled ? <MobileIcon name="chevron-right" size={14} color={theme.textSecondary} /> : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>

      <View style={s.listHead}>
        <Text style={[s.listTitle, { color: theme.textHeading }]} accessibilityRole="header">
          {l.workTitle}
        </Text>
        <Text style={[ps.small, { color: theme.textSecondary }]}>{l.workSort}</Text>
      </View>
      {kind ? (
        <View style={[s.filtered, { borderColor: tokens.colors.brand[500] }]}>
          <Text style={[ps.body, ps.grow, { color: theme.textHeading }]}>
            {l.workFiltered.replace("{label}", label[kind])}
          </Text>
          <Pressable onPress={() => onKindChange(null)} accessibilityRole="button" hitSlop={8}>
            <Text style={[ps.value, { color: tokens.colors.brand[700] }]}>{l.showAllWork}</Text>
          </Pressable>
        </View>
      ) : null}
      <MobileListSearchRow
        value={query}
        onChangeText={onQueryChange}
        placeholder={l.searchWork}
        onClear={() => onQueryChange("")}
        clearAccessibilityLabel={t.agent.tenants.clearSearch}
      />

      {visible.length ? (
        <DetailCard style={s.list}>
          {visible.map((item, index) => {
            const tone = WORK_TONE[item.kind];
            const key =
              item.kind === "slip"
                ? `slip-${item.bill.id}`
                : item.kind === "signing"
                  ? `sign-${item.contract.id}`
                  : `${item.kind}-${item.tenant.id}`;
            return (
              <Pressable
                key={key}
                disabled={busy}
                onPress={() => onOpenTenant(item)}
                accessibilityRole="button"
                accessibilityLabel={l.viewTenant.replace("{name}", item.tenant.name)}
                android_ripple={RIPPLE}
                style={({ pressed }) => [
                  s.row,
                  index < visible.length - 1 && {
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: theme.border,
                  },
                  pressed && Platform.OS === "ios" ? ps.pressed : null,
                ]}
              >
                <View style={[s.rowIcon, { backgroundColor: tone.bg }]}>
                  <MobileIcon name={WORK_ICON[item.kind]} size={20} color={tone.fg} />
                </View>
                <View style={[ps.grow, s.rowCopy]}>
                  <Text style={[ps.rowTitle, { color: theme.textHeading }]} numberOfLines={1}>
                    {item.tenant.name}
                  </Text>
                  <MobileStatusPill label={pill(item)} tone={tone} style={s.pill} />
                  <Text style={[ps.small, { color: theme.textSecondary }]} numberOfLines={2}>
                    {meta(item)}
                  </Text>
                </View>
                <MobileButton
                  variant={item.kind === "slip" ? "primary" : "outline"}
                  onPress={() => onAction(item)}
                  disabled={busy}
                  style={s.cta}
                >
                  {cta[item.kind]}
                </MobileButton>
              </Pressable>
            );
          })}
        </DetailCard>
      ) : (
        <DetailCard>
          <Text style={[ps.body, { color: theme.textSecondary, textAlign: "center" }]}>
            {kind || needle ? l.workEmptyFilter : l.workEmpty}
          </Text>
        </DetailCard>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { gap: 14 },
  tiles: { gap: 12 },
  tileRow: { flexDirection: "row", gap: 12 },
  tile: { flex: 1, borderWidth: 1, borderRadius: 16, padding: 14, gap: 6, overflow: "hidden" },
  tileIcon: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  tileCount: { fontFamily: tokens.typography.native.headingTh, fontSize: 26, lineHeight: 38 },
  tileHint: { flexDirection: "row", alignItems: "center", gap: 4 },
  listHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 6 },
  listTitle: { fontFamily: tokens.typography.native.headingTh, fontSize: 17, lineHeight: 26 },
  filtered: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 12, padding: 12 },
  list: { padding: 0, gap: 0 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 14 },
  rowIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  rowCopy: { gap: 4 },
  pill: { alignSelf: "flex-start" },
  cta: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
});
