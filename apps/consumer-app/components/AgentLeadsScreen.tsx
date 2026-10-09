import { LeadLocationPicker } from './LeadLocationPicker';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Platform, ScrollView } from 'react-native';
import type { AgentLead, AgentLeadsPage, AgentLeadsSort, LeadDisplayStatus } from '@nestyk/types';
import { localizedError, useLocale } from '@nestyk/i18n';
import {
  MobileBottomSheet,
  MobileBrandLoader,
  MobileButton,
  MobileCompactListRow,
  MobileFilterChip,
  MobileIcon,
  MobileListSearchRow,
  MobileListToolbar,
  MobileScoreRing,
  SelectionCheck,
  STATUS_PILL_TONES,
  tokens,
  useMobileTheme,
} from '@nestyk/ui/native';
import { listAgentLeads } from '../lib/agent-leads-api';
import { leadMatchReady } from '../lib/lead-match-preview';
import { LeadStatusBadge, leadAvatarInitials, leadDisplayStatus, leadStatusTone } from './AgentLeadDetailBody';
import { ViewingDateTile } from './ViewingDateTile';

type LocationDraft = {
  province: string;
  locations: string[];
  includeUnspecified: boolean;
};

const EMPTY_DRAFT: LocationDraft = {
  province: '',
  locations: [],
  includeUnspecified: false,
};

type ListMemory = LocationDraft & {
  query: string;
  sort: AgentLeadsSort;
  statusFilter: LeadDisplayStatus | null;
  page: number;
  items: AgentLead[];
  total: number;
  statusCounts: AgentLeadsPage['statusCounts'] | null;
};

const STATUS_CHIPS: Array<LeadDisplayStatus | null> = [null, 'new', 'inprogress', 'viewing', 'booked', 'lost'];

/** The shell remounts tab bodies, so list state survives opening a lead and coming back. */
let listMemory: ListMemory | null = null;

export function AgentLeadsScreen({
  workFilter = null,
  reloadToken,
  onReloadSettled,
  onOpenLead,
}: {
  /** Soft filter chip from dashboard action required. */
  workFilter?: 'lead_follow_up' | null;
  /** Shell pull-to-refresh (MobileModePage). Bump to reload list screens. */
  reloadToken?: number;
  onReloadSettled?: (token: number) => void;
  onOpenLead: (lead: AgentLead) => void;
}) {
  const { t, locale } = useLocale();
  const c = t.agent.leads;
  const dash = t.agent.dashboard;
  const { theme } = useMobileTheme();
  const agentColor = tokens.colors.roles.agent;
  const memory = listMemory;
  const [activeWorkFilter, setActiveWorkFilter] = useState(workFilter);
  const [items, setItems] = useState<AgentLead[]>(memory?.items ?? []);
  const [total, setTotal] = useState(memory?.total ?? 0);
  const [province, setProvince] = useState(memory?.province ?? '');
  const [locations, setLocations] = useState<string[]>(memory?.locations ?? []);
  const [includeUnspecified, setIncludeUnspecified] = useState(memory?.includeUnspecified ?? false);
  const [query, setQuery] = useState(memory?.query ?? '');
  const [filterOpen, setFilterOpen] = useState(false);
  const [draft, setDraft] = useState<LocationDraft>(EMPTY_DRAFT);
  const [sortOpen, setSortOpen] = useState(false);
  const [sort, setSort] = useState<AgentLeadsSort>(memory?.sort ?? 'updated_desc');
  const [statusFilter, setStatusFilter] = useState<LeadDisplayStatus | null>(memory?.statusFilter ?? null);
  const [statusCounts, setStatusCounts] = useState<AgentLeadsPage['statusCounts'] | null>(memory?.statusCounts ?? null);
  const [page, setPage] = useState(memory?.page ?? 1);
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(!memory);
  const [error, setError] = useState<string | null>(null);
  const [gateOpen, setGateOpen] = useState(!!memory);
  const gateOpenRef = useRef(gateOpen);
  gateOpenRef.current = gateOpen;

  useEffect(() => {
    listMemory = { query, sort, statusFilter, page, province, locations, includeUnspecified, items, total, statusCounts };
  }, [query, sort, statusFilter, page, province, locations, includeUnspecified, items, total, statusCounts]);

  const filterBadge = useMemo(() => {
    let n = 0;
    if (province) n += 1;
    if (locations.length) n += 1;
    if (includeUnspecified) n += 1;
    return n;
  }, [province, locations, includeUnspecified]);

  const activeChips = useMemo(() => {
    const chips: { key: string; label: string; clear: () => void }[] = [];
    if (province) {
      chips.push({
        key: 'province',
        label: province,
        clear: () => {
          setProvince('');
          setLocations([]);
          setIncludeUnspecified(false);
        },
      });
    }
    for (const area of locations) {
      chips.push({
        key: `area:${area}`,
        label: area,
        clear: () => {
          setLocations((current) => {
            const next = current.filter((item) => item !== area);
            if (!next.length) setIncludeUnspecified(false);
            return next;
          });
        },
      });
    }
    if (includeUnspecified) {
      chips.push({
        key: 'unspecified',
        label: c.includeUnspecified,
        clear: () => setIncludeUnspecified(false),
      });
    }
    return chips;
  }, [province, locations, includeUnspecified, c.includeUnspecified]);

  const openFilter = () => {
    setDraft({ province, locations, includeUnspecified });
    setFilterOpen(true);
  };

  const applyFilter = () => {
    setProvince(draft.province);
    setLocations(draft.locations);
    setIncludeUnspecified(draft.locations.length > 0 && draft.includeUnspecified);
    setPage(1);
    setFilterOpen(false);
  };

  const resetDraft = () => {
    setDraft(EMPTY_DRAFT);
  };

  const clearAllFilters = () => {
    setProvince('');
    setLocations([]);
    setIncludeUnspecified(false);
    setPage(1);
  };

  useEffect(() => {
    setActiveWorkFilter(workFilter);
  }, [workFilter]);

  useEffect(() => {
    let cancelled = false;
    // Full-screen loader only on first open — search/filter keeps the list visible.
    if (!gateOpenRef.current) setLoading(true);
    setError(null);
    const timer = setTimeout(() => {
      listAgentLeads(query.trim(), page, { province, locations, includeUnspecified, sort, status: statusFilter ?? undefined })
        .then((result) => {
          if (cancelled) return;
          setItems(result.items);
          setTotal(result.total);
          setStatusCounts(result.statusCounts ?? null);
          if (page > 1 && !result.items.length) setPage(Math.max(1, Math.ceil(result.total / 20)));
        })
        .catch((err) => {
          if (!cancelled) setError(localizedError(err, c.loadError, locale));
        })
        .finally(() => {
          if (cancelled) return;
          setLoading(false);
          if (reloadToken) onReloadSettled?.(reloadToken);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, page, refresh, province, locations, includeUnspecified, sort, statusFilter, reloadToken, onReloadSettled]);

  const sortOptions: Array<{ value: AgentLeadsSort; label: string }> = [
    { value: 'updated_desc', label: c.sortUpdatedDesc },
    { value: 'created_desc', label: c.sortCreatedDesc },
    { value: 'created_asc', label: c.sortCreatedAsc },
    { value: 'name_asc', label: c.sortNameAsc },
    { value: 'budget_asc', label: c.sortBudgetAsc },
    { value: 'budget_desc', label: c.sortBudgetDesc },
    { value: 'status_asc', label: c.sortStatusAsc },
    { value: 'status_desc', label: c.sortStatusDesc },
  ];
  const sortLabel = sortOptions.find((opt) => opt.value === sort)?.label ?? c.sortUpdatedDesc;

  const budget = (lead: AgentLead) => {
    if (lead.budgetMin == null && lead.budgetMax == null) return null;
    const range = [lead.budgetMin?.toLocaleString(), lead.budgetMax?.toLocaleString()]
      .filter(Boolean)
      .join(' – ');
    return `${range} ${t.agent.listings.rentPerMonth.replace('{price}', '').trim()}`.trim();
  };

  const roomType = (lead: AgentLead) =>
    lead.desiredRoomTypeCode
      ? t.masters.roomTypes[lead.desiredRoomTypeCode as keyof typeof t.masters.roomTypes] || lead.desiredRoomTypeCode
      : null;

  const locationLine = (lead: AgentLead) => {
    const place =
      lead.pins[0]?.name ||
      lead.province ||
      (lead.locations?.length ? lead.locations[0] : null) ||
      lead.preferredLocation;
    const type = roomType(lead);
    return [place, type].filter(Boolean).join(' · ') || null;
  };

  return (
    <View style={{ gap: 14 }}>
      {!gateOpen ? (
        <MobileBrandLoader
          fill
          size="md"
          done={!loading}
          onComplete={() => setGateOpen(true)}
        />
      ) : (
        <>
          {activeWorkFilter === 'lead_follow_up' ? (
            <View style={[styles.filterChip, { backgroundColor: theme.surface, borderColor: agentColor }]}>
              <Text style={{ flex: 1, color: theme.textHeading, fontSize: 13, lineHeight: 19 }}>
                {dash.filterActive.replace('{label}', dash.leadsFollowUp)}
              </Text>
              <MobileButton variant="outline" onPress={() => setActiveWorkFilter(null)}>
                {dash.clearFilter}
              </MobileButton>
            </View>
          ) : null}

          <MobileListSearchRow
            value={query}
            onChangeText={(value) => {
              setQuery(value);
              setPage(1);
            }}
            placeholder={c.search}
            onClear={() => {
              setQuery('');
              setPage(1);
            }}
            onFilterPress={openFilter}
            filterBadgeCount={filterBadge}
            filterAccessibilityLabel={c.searchFilters}
            clearAccessibilityLabel={c.clearFilters}
          />

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.statusRow}
            accessibilityLabel={c.statusFilter}
          >
            {STATUS_CHIPS.map((value) => {
              const selected = statusFilter === value;
              const label = value ? c.statuses[value] : c.statusAll;
              const count = statusCounts
                ? value
                  ? statusCounts[value]
                  : Object.values(statusCounts).reduce((sum, n) => sum + n, 0)
                : null;
              return (
                <MobileFilterChip
                  key={value ?? 'all'}
                  label={label}
                  count={count}
                  selected={selected}
                  tone={value ? leadStatusTone(value) : 'slate'}
                  showDot={!!value}
                  onPress={() => {
                    setStatusFilter(selected ? null : value);
                    setPage(1);
                  }}
                />
              );
            })}
          </ScrollView>

          {activeChips.length > 0 ? (
            <View style={styles.activeChipsRow}>
              {activeChips.map((chip) => (
                <Pressable
                  key={chip.key}
                  onPress={() => {
                    chip.clear();
                    setPage(1);
                  }}
                  style={styles.activeChip}
                  accessibilityRole="button"
                  accessibilityLabel={`${c.clearFilters} ${chip.label}`}
                >
                  <Text style={styles.activeChipLabel}>{chip.label}</Text>
                  <MobileIcon name="close" size={12} color={tokens.colors.primary} />
                </Pressable>
              ))}
              <Pressable onPress={clearAllFilters} hitSlop={8}>
                <Text style={[styles.clearLink, { color: theme.textSecondary }]}>{c.clearFilters}</Text>
              </Pressable>
            </View>
          ) : null}

          <MobileListToolbar countLabel={c.count.replace('{count}', String(total))}>
            <Pressable
              onPress={() => setSortOpen(true)}
              accessibilityRole="button"
              accessibilityLabel={c.sortTitle}
              style={({ pressed }) => [
                styles.sortBtn,
                { borderColor: theme.border, backgroundColor: theme.surface, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Text style={[styles.sortLabel, { color: theme.textHeading }]} numberOfLines={1}>
                {sortLabel}
              </Text>
              <MobileIcon name="chevron-down" size={14} color={theme.textSecondary} />
            </Pressable>
          </MobileListToolbar>

          {error && items.length > 0 && (
            <View
              style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
              accessibilityLiveRegion="polite"
            >
              <Text style={{ color: theme.textHeading }}>{c.loadError}</Text>
              <Text style={{ color: theme.textSecondary }}>{error}</Text>
              <MobileButton variant="outline" onPress={() => setRefresh((n) => n + 1)}>
                {c.retry}
              </MobileButton>
            </View>
          )}
          {error && !items.length ? (
            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={{ color: theme.textHeading }}>{c.loadError}</Text>
              <Text style={{ color: theme.textSecondary }}>{error}</Text>
              <MobileButton onPress={() => setRefresh((n) => n + 1)}>{c.retry}</MobileButton>
            </View>
          ) : !items.length ? (
            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={{ color: theme.textSecondary }}>{t.common.noData}</Text>
            </View>
          ) : (
            <View style={styles.list}>
              {items.map((lead) => {
                const status = leadDisplayStatus(lead);
                const tone = STATUS_PILL_TONES[leadStatusTone(status)];
                const match = lead.lastMatch ?? null;
                const needsInfo = !leadMatchReady(lead);
                const noRooms = match?.resultCount === 0;
                const ringLabel = match
                  ? noRooms
                    ? c.matchNone
                    : c.matchLabel
                  : needsInfo
                    ? c.matchNeedsInfo
                    : c.matchNotRun;
                const emptyRing = match
                  ? noRooms
                    ? { icon: 'close' as const, iconColor: tokens.colors.danger, trackColor: STATUS_PILL_TONES.red.bg }
                    : {}
                  : { icon: 'sparkle' as const, iconColor: theme.textSecondary, dashed: true };
                const viewingAt = status === 'viewing' ? lead.nextViewingAt : null;
                return (
                  <MobileCompactListRow
                    key={lead.id}
                    avatarLabel={leadAvatarInitials(lead.name)}
                    avatarTone={tone}
                    title={lead.name}
                    subtitle={locationLine(lead)}
                    meta={budget(lead)}
                    footer={
                      <>
                        <LeadStatusBadge status={status} />
                        {viewingAt && lead.nextViewingRoom ? (
                          <Text style={[styles.matchRooms, { color: theme.textHeading }]} numberOfLines={1}>
                            {lead.nextViewingRoom}
                          </Text>
                        ) : match && !noRooms ? (
                          <Text style={[styles.matchRooms, { color: theme.textSecondary }]} numberOfLines={1}>
                            {c.matchRooms.replace('{count}', String(match.resultCount))}
                          </Text>
                        ) : null}
                      </>
                    }
                    aside={
                      viewingAt ? (
                        <ViewingDateTile at={viewingAt} />
                      ) : !match && needsInfo ? (
                        <View accessible accessibilityLabel={ringLabel} style={styles.matchState}>
                          <View style={[styles.matchStateIcon, { backgroundColor: STATUS_PILL_TONES.yellow.bg }]}>
                            <MobileIcon name="warning" size={20} color={tokens.colors.warning} />
                          </View>
                          <Text style={[styles.matchStateLabel, { color: theme.textSecondary }]} numberOfLines={1}>
                            {ringLabel}
                          </Text>
                        </View>
                      ) : (
                        <MobileScoreRing
                          value={match?.topScore ?? null}
                          label={ringLabel}
                          {...emptyRing}
                          accessibilityLabel={
                            match && !noRooms
                              ? c.matchScoreA11y.replace('{score}', String(match.topScore ?? 0))
                              : ringLabel
                          }
                        />
                      )
                    }
                    accessibilityLabel={`${c.details}: ${lead.name}`}
                    onPress={() => onOpenLead(lead)}
                  />
                );
              })}
            </View>
          )}

          {!loading && !error && total > 20 && (
            <View style={styles.menu}>
              <MobileButton variant="outline" disabled={page === 1} onPress={() => setPage((n) => n - 1)}>
                {c.previous}
              </MobileButton>
              <Text style={{ color: theme.textHeading }}>
                {page} / {Math.ceil(total / 20)}
              </Text>
              <MobileButton
                variant="outline"
                disabled={page * 20 >= total}
                onPress={() => setPage((n) => n + 1)}
              >
                {c.next}
              </MobileButton>
            </View>
          )}
        </>
      )}

      <MobileBottomSheet visible={sortOpen} onClose={() => setSortOpen(false)}>
        <View style={styles.sheetHeader}>
          <Text style={[styles.sheetTitle, { color: theme.textHeading }]}>{c.sortTitle}</Text>
          <Pressable
            onPress={() => setSortOpen(false)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={t.common.cancel}
          >
            <MobileIcon name="close" size={22} color={theme.textHeading} />
          </Pressable>
        </View>
        <View style={styles.sortList}>
          {sortOptions.map((opt) => {
            const selected = sort === opt.value;
            return (
              <Pressable
                key={opt.value}
                onPress={() => {
                  setSort(opt.value);
                  setPage(1);
                  setSortOpen(false);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={({ pressed }) => [
                  styles.sortRow,
                  { borderColor: theme.border, opacity: pressed ? 0.85 : 1 },
                  selected && styles.sortRowSelected,
                ]}
              >
                <Text
                  style={[
                    styles.sortRowLabel,
                    { color: selected ? tokens.colors.primary : theme.textHeading },
                  ]}
                >
                  {opt.label}
                </Text>
                {selected ? <SelectionCheck selected variant="chip" size="md" /> : null}
              </Pressable>
            );
          })}
        </View>
      </MobileBottomSheet>

      <MobileBottomSheet
        visible={filterOpen}
        onClose={() => setFilterOpen(false)}
        avoidKeyboard
        maxHeight="92%"
      >
        <View style={styles.sheetHeader}>
          <Text style={[styles.sheetTitle, { color: theme.textHeading }]}>{c.searchFilters}</Text>
          <Pressable
            onPress={() => setFilterOpen(false)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={t.common.cancel}
          >
            <MobileIcon name="close" size={22} color={theme.textHeading} />
          </Pressable>
        </View>
        <ScrollView
          style={styles.sheetBody}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <LeadLocationPicker
            filter
            province={draft.province}
            locations={draft.locations}
            onChange={(p, areas) =>
              setDraft((current) => ({
                ...current,
                province: p,
                locations: areas,
                includeUnspecified: areas.length > 0 && current.includeUnspecified,
              }))
            }
          />
          {draft.locations.length > 0 ? (
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: draft.includeUnspecified }}
              onPress={() =>
                setDraft((current) => ({
                  ...current,
                  includeUnspecified: !current.includeUnspecified,
                }))
              }
              style={styles.checkboxRow}
            >
              <View
                style={[
                  styles.checkbox,
                  {
                    borderColor: draft.includeUnspecified ? tokens.colors.brand[500] : theme.border,
                    backgroundColor: draft.includeUnspecified
                      ? tokens.colors.brand[500]
                      : theme.surface,
                  },
                ]}
              >
                {draft.includeUnspecified ? (
                  <MobileIcon name="check" size={14} color={tokens.colors.primary} />
                ) : null}
              </View>
              <Text style={[styles.bodyText, { color: theme.textHeading, flex: 1 }]}>
                {c.includeUnspecified}
              </Text>
            </Pressable>
          ) : null}
        </ScrollView>
        <View style={styles.sheetFooter}>
          <Pressable onPress={resetDraft} hitSlop={8}>
            <Text style={[styles.resetLink, { color: theme.textHeading }]}>{c.clearFilters}</Text>
          </Pressable>
          <Pressable
            onPress={applyFilter}
            style={styles.showResultsBtn}
            accessibilityRole="button"
            {...(Platform.OS === 'android'
              ? { android_ripple: { color: 'rgba(33,30,30,0.12)' } }
              : {})}
          >
            <Text style={styles.showResultsLabel}>{c.applyFilters}</Text>
          </Pressable>
        </View>
      </MobileBottomSheet>

    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 10 },
  statusRow: { gap: 8, paddingRight: 4 },
  matchState: { alignItems: 'center', gap: 2 },
  matchStateIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  matchStateLabel: { fontFamily: tokens.typography.native.body, fontSize: 10, lineHeight: 15, maxWidth: 64 },
  matchRooms: {
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
    flexShrink: 1,
  },
  menu: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  card: { borderWidth: 1, borderRadius: 16, padding: 18, gap: 8 },
  bodyText: { fontFamily: tokens.typography.native.body, fontSize: 14, lineHeight: 22 },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 44,
  },
  activeChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  activeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: tokens.colors.brand[100],
  },
  activeChipLabel: {
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    lineHeight: 18,
    color: tokens.colors.primary,
    fontWeight: '600',
  },
  clearLink: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
    marginLeft: 4,
  },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 36,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    maxWidth: 160,
  },
  sortLabel: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
    flexShrink: 1,
  },
  sortList: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 8,
  },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  sortRowSelected: {
    borderColor: tokens.colors.brand[500],
    backgroundColor: tokens.colors.brand[50],
  },
  sortRowLabel: {
    fontFamily: tokens.typography.native.body,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
    flex: 1,
    paddingRight: 8,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  sheetTitle: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 18,
    lineHeight: 26,
  },
  sheetBody: {
    paddingHorizontal: 20,
    paddingTop: 4,
  },
  checkboxRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
    marginBottom: 8,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
  },
  resetLink: {
    fontFamily: tokens.typography.native.body,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  showResultsBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: tokens.colors.brand[500],
    alignItems: 'center',
    justifyContent: 'center',
  },
  showResultsLabel: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '700',
    color: tokens.colors.primary,
  },
});
