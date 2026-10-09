import React, { useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useLocale } from "@nestyk/i18n";
import {
  MobileFilterChip,
  MobileIcon,
  MobileListSearchRow,
  MobileStatusPill,
  STATUS_PILL_TONES,
  tokens,
  useMobileTheme,
  type MobileStatusPillTone,
} from "@nestyk/ui/native";
import type { AgentTenant } from "@nestyk/types";
import { billFormatters } from "../lib/bill-format";
import { tenantLease } from "../lib/tenant-detail";
import { groupByProperty, tenantListStatus, type TenantWorkItem } from "../lib/tenant-work";
import { initials } from "./TenantDetailHub";
import { DetailCard, RIPPLE, ps } from "./TenantDetailParts";
import { WORK_TONE } from "./TenantWorkBody";

export type TenantDirectoryFilter = "all" | "signing" | "active";

const isActive = (tenant: AgentTenant) => tenantLease(tenant)?.status === "active";

/** "All customers" tab: search, status chips, then tenants grouped by project. */
export function TenantDirectoryBody({
  tenants,
  items,
  loading,
  query,
  onQueryChange,
  filter,
  onFilterChange,
  onOpen,
  busy,
}: {
  tenants: AgentTenant[];
  items: TenantWorkItem[];
  loading: boolean;
  query: string;
  onQueryChange: (query: string) => void;
  filter: TenantDirectoryFilter;
  onFilterChange: (filter: TenantDirectoryFilter) => void;
  onOpen: (tenant: AgentTenant) => void;
  busy: boolean;
}) {
  const { t, locale } = useLocale();
  const c = t.agent.tenants;
  const l = c.list;
  const { theme } = useMobileTheme();
  const fmt = billFormatters(locale);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());

  const matchesFilter = (tenant: AgentTenant, key: TenantDirectoryFilter) =>
    key === "all" || (key === "active") === isActive(tenant);
  const needle = query.trim().toLowerCase();
  const visible = tenants.filter(
    (tenant) =>
      matchesFilter(tenant, filter) &&
      `${tenant.name} ${tenant.phone} ${tenant.property} ${tenant.room ?? ""} ${tenant.contracts.map((x) => `${x.property} ${x.room ?? ""} ${x.contractNo}`).join(" ")}`
        .toLowerCase()
        .includes(needle),
  );
  const groups = groupByProperty(visible, locale);
  const filters: Array<{ key: TenantDirectoryFilter; label: string }> = [
    { key: "all", label: l.filterAll },
    { key: "signing", label: l.filterSigning },
    { key: "active", label: l.filterActive },
  ];

  const status = (tenant: AgentTenant): { label: string; tone: MobileStatusPillTone } => {
    const kind = tenantListStatus(tenant, items);
    if (kind === "slip") return { label: l.pillSlip, tone: WORK_TONE.slip };
    if (kind === "signing") return { label: l.tileSigning, tone: WORK_TONE.signing };
    if (kind === "renewal") {
      const renewal = items.find((item) => item.kind === "renewal" && item.tenant.id === tenant.id);
      const days = renewal?.kind === "renewal" ? renewal.daysLeft : 0;
      return {
        label: days === 0 ? l.pillRenewalToday : l.pillRenewal.replace("{days}", String(days)),
        tone: WORK_TONE.renewal,
      };
    }
    return kind === "active"
      ? { label: l.pillActive, tone: STATUS_PILL_TONES.green }
      : { label: l.pillSigningContract, tone: STATUS_PILL_TONES.slate };
  };

  function toggle(property: string) {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(property)) next.delete(property);
      else next.add(property);
      return next;
    });
  }

  return (
    <View style={s.root}>
      <MobileListSearchRow
        value={query}
        onChangeText={onQueryChange}
        placeholder={l.searchAll}
        onClear={() => onQueryChange("")}
        clearAccessibilityLabel={c.clearSearch}
      />
      <View style={s.filters}>
        {filters.map((item) => (
          <MobileFilterChip
            key={item.key}
            label={item.label}
            count={loading ? "–" : tenants.filter((tenant) => matchesFilter(tenant, item.key)).length}
            selected={filter === item.key}
            onPress={() => onFilterChange(item.key)}
          />
        ))}
      </View>

      {groups.map((group) => {
        const open = !collapsed.has(group.property);
        const name = group.property || l.noProject;
        return (
          <View key={group.property} style={s.group}>
            <Pressable
              onPress={() => toggle(group.property)}
              accessibilityRole="button"
              accessibilityState={{ expanded: open }}
              accessibilityLabel={l.groupToggle
                .replace("{property}", name)
                .replace("{count}", String(group.tenants.length))}
              hitSlop={4}
              style={({ pressed }) => [s.groupHead, pressed && Platform.OS === "ios" ? ps.pressed : null]}
            >
              <Text style={[s.groupTitle, { color: theme.textHeading }]} numberOfLines={1}>
                {name}
              </Text>
              <Text style={[ps.small, { color: theme.textSecondary }]}>
                {l.groupCount.replace("{count}", String(group.tenants.length))}
              </Text>
              <MobileIcon name={open ? "chevron-down" : "chevron-right"} size={16} color={theme.textSecondary} />
            </Pressable>
            {open ? (
              <DetailCard style={s.list}>
                {group.tenants.map((tenant, index) => {
                  const pill = status(tenant);
                  const rent = tenantLease(tenant)?.monthlyRent;
                  return (
                    <Pressable
                      key={tenant.id}
                      disabled={busy}
                      onPress={() => onOpen(tenant)}
                      accessibilityRole="button"
                      accessibilityLabel={`${l.viewTenant.replace("{name}", tenant.name)}, ${pill.label}`}
                      android_ripple={RIPPLE}
                      style={({ pressed }) => [
                        s.row,
                        index < group.tenants.length - 1 && {
                          borderBottomWidth: StyleSheet.hairlineWidth,
                          borderBottomColor: theme.border,
                        },
                        pressed && Platform.OS === "ios" ? ps.pressed : null,
                      ]}
                    >
                      <View style={s.avatar}>
                        <Text style={s.avatarText}>{initials(tenant.name)}</Text>
                      </View>
                      <View style={ps.grow}>
                        <Text style={[ps.rowTitle, { color: theme.textHeading }]} numberOfLines={1}>
                          {tenant.name}
                        </Text>
                        <Text style={[ps.small, { color: theme.textSecondary }]} numberOfLines={1}>
                          {[
                            tenant.room ? l.metaRoom.replace("{room}", tenant.room) : null,
                            rent ? l.metaRent.replace("{amount}", fmt.amount(rent)) : null,
                          ]
                            .filter(Boolean)
                            .join(" · ") || tenant.phone}
                        </Text>
                      </View>
                      <MobileStatusPill label={pill.label} tone={pill.tone} />
                      <MobileIcon name="chevron-right" size={18} color={theme.textSecondary} />
                    </Pressable>
                  );
                })}
              </DetailCard>
            ) : null}
          </View>
        );
      })}

      {!loading && !visible.length ? (
        <DetailCard>
          <Text style={[ps.body, { color: theme.textSecondary, textAlign: "center" }]}>{t.common.noData}</Text>
        </DetailCard>
      ) : null}
      {!loading ? (
        <Text style={[ps.small, { color: theme.textSecondary, textAlign: "center" }]}>
          {l.showing.replace("{shown}", String(visible.length)).replace("{total}", String(tenants.length))}
        </Text>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  root: { gap: 14 },
  filters: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  group: { gap: 8 },
  groupHead: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 32 },
  groupTitle: { flex: 1, fontFamily: tokens.typography.native.bodyBold, fontSize: 15, lineHeight: 23 },
  list: { padding: 0, gap: 0 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 12, minHeight: 64 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: tokens.colors.brand[100],
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 16,
    lineHeight: 24,
    color: tokens.colors.onBrand,
  },
});
