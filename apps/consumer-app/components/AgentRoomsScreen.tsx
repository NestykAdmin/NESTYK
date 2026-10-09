import { AgentRoomDetailModal } from './AgentRoomDetailModal';
import { RoomPriceFilter } from './RoomPriceFilter';
import { formatPriceSummary, validPriceRange } from './room-price-range';
import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Platform,
  TextInput,
} from 'react-native';
import {
  MobileAgentListingsBody,
  AgentListingCard,
  type AgentListingsViewMode,
} from '@nestyk/feature-listing';
import type { AgentListingsSort } from '../lib/agent-listings-api';
import {
  MobileButton,
  MobileBottomSheet,
  MobileBrandLoader,
  MobileIcon,
  MobileListSearchRow,
  MobileListToolbar,
  type AppIconName,
  SelectionCheck,
  SelectionChip,
  ModePageScrollContext,
  tokens,
  useMobileTheme,
} from '@nestyk/ui/native';
import { localizedError, useLocale } from '@nestyk/i18n';
import { fetchMyAgentListings } from '../lib/agent-listings-api';

type VisibilityFilter = '' | 'private' | 'published';
type StatusFilter = '' | 'available' | 'rented' | 'pending_verification' | 'needs_edit';
type SourceFilter = '' | 'owner' | 'co_agent';

type RoomFilters = {
  visibility: VisibilityFilter;
  roomStatus: StatusFilter;
  listingSource: SourceFilter;
  propertyType: string;
  roomType: string;
  bedrooms: string;
  minPrice: string;
  maxPrice: string;
};

const EMPTY_FILTERS: RoomFilters = {
  visibility: '',
  roomStatus: '',
  listingSource: '',
  propertyType: '', roomType: '', bedrooms: '', minPrice: '', maxPrice: '',
};

const PROPERTY_TYPE_ICONS: Record<string, AppIconName> = {
  condo: 'buildings',
  apartment: 'buildings',
  house: 'home',
};

/** Matches master_room_types.bedroom_count — null = flexible (duplex/penthouse). */
const ROOM_TYPE_BEDROOMS: Record<string, string | null> = {
  studio: '0',
  one_bedroom: '1',
  one_bedroom_plus: '1',
  two_bedroom: '2',
  three_bedroom: '3',
  four_bedroom: '4',
  duplex: null,
  penthouse: null,
};

const PAGE_SIZE = 20;

const SOURCE_FILTER_OPTIONS: Array<{ value: SourceFilter; icon: AppIconName }> = [
  { value: '', icon: 'globe' },
  { value: 'owner', icon: 'user' },
  { value: 'co_agent', icon: 'handshake' },
];

type FilterSectionKey = 'room' | 'price' | 'status' | 'extra';

function Chip({
  label,
  selected,
  onPress,
  columns,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** Equal-width grid columns (e.g. 3 → ~3 per row). */
  columns?: 2 | 3;
}) {
  return (
    <SelectionChip
      label={label}
      selected={selected}
      onPress={onPress}
      showCheck={false}
      style={[
        styles.filterChip,
        columns === 3 ? styles.filterChipCol3 : null,
        columns === 2 ? styles.filterChipCol2 : null,
      ]}
      labelStyle={styles.chipLabel}
    />
  );
}

function FilterOptionRow({
  title,
  options,
  value,
  onChange,
  columns,
}: {
  title?: string;
  options: Array<{ value: string; label: string }>;
  value: string;
  onChange: (value: string) => void;
  columns?: 2 | 3;
}) {
  const { theme } = useMobileTheme();
  return (
    <View style={styles.filterSection}>
      {title ? (
        <Text style={[styles.filterSectionTitle, { color: theme.textHeading }]}>{title}</Text>
      ) : null}
      <View style={styles.chipWrap}>
        {options.map((opt) => (
          <Chip
            key={opt.value || 'any'}
            label={opt.label}
            selected={value === opt.value}
            onPress={() => onChange(opt.value)}
            columns={columns}
          />
        ))}
      </View>
    </View>
  );
}

function FilterSubHeader({
  title,
  clearLabel,
  showClear,
  onClear,
}: {
  title: string;
  clearLabel: string;
  showClear: boolean;
  onClear: () => void;
}) {
  const { theme } = useMobileTheme();
  return (
    <View style={styles.subHeader}>
      <Text style={[styles.filterSectionTitle, { color: theme.textHeading, flex: 1 }]}>{title}</Text>
      {showClear ? (
        <Pressable onPress={onClear} hitSlop={8} accessibilityRole="button">
          <Text style={styles.clearInline}>{clearLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function FilterIconCard({
  icon,
  label,
  selected,
  onPress,
}: {
  icon: AppIconName;
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      android_ripple={{ color: '#00000014' }}
      style={({ pressed }) => [
        styles.iconCard,
        selected ? styles.iconCardSelected : null,
        pressed ? { opacity: 0.92 } : null,
      ]}
    >
      <MobileIcon name={icon} size={22} color={tokens.colors.primary} />
      <Text style={[styles.iconCardLabel, selected && styles.iconCardLabelSelected]} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

function FilterAccordion({
  icon,
  title,
  summary,
  expanded,
  onToggle,
  children,
  isLast = false,
}: {
  icon: AppIconName;
  title: string;
  summary: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  isLast?: boolean;
}) {
  const { theme } = useMobileTheme();
  return (
    <View style={[styles.accordionBlock, !isLast && styles.accordionDivider]}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        style={({ pressed }) => [styles.accordionHeader, pressed ? { opacity: 0.88 } : null]}
      >
        <View style={styles.accordionIconWell}>
          <MobileIcon name={icon} size={18} color={tokens.colors.textSecondary} />
        </View>
        <View style={styles.accordionCopy}>
          <Text style={[styles.accordionTitle, { color: theme.textHeading }]}>{title}</Text>
          <Text style={styles.accordionSummary} numberOfLines={1}>
            {summary}
          </Text>
        </View>
        <View style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }}>
          <MobileIcon name="chevron-down" size={18} color={theme.textSecondary} />
        </View>
      </Pressable>
      {expanded ? <View style={styles.accordionBody}>{children}</View> : null}
    </View>
  );
}

export function AgentRoomsScreen({
  reloadToken,
  onReloadSettled,
  searchOpen = false,
  onSearchOpenChange,
}: {
  reloadToken?: number;
  onReloadSettled?: (token: number) => void;
  searchOpen?: boolean;
  onSearchOpenChange?: (open: boolean) => void;
}) {
  const { t, locale } = useLocale();
  const { theme } = useMobileTheme();
  const copy = t.agent.listings;
  const cr = t.agent.createRoom;

  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<RoomFilters>(EMPTY_FILTERS);
  const [draft, setDraft] = useState<RoomFilters>(EMPTY_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);
  const [expandedFilter, setExpandedFilter] = useState<FilterSectionKey | null>(null);
  const [roomTypePickerOpen, setRoomTypePickerOpen] = useState(false);
  const [draggingPrice, setDraggingPrice] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [sort, setSort] = useState<AgentListingsSort>('updated_desc');
  const [viewMode, setViewMode] = useState<AgentListingsViewMode>('row');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<AgentListingCard[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState<string | null>(null);
  const [moreAttempt, setMoreAttempt] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [gateOpen, setGateOpen] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const searchRef = React.useRef<TextInput>(null);
  const gateOpenRef = React.useRef(gateOpen);
  gateOpenRef.current = gateOpen;

  useEffect(() => {
    if (searchOpen) {
      const tmr = setTimeout(() => searchRef.current?.focus(), 80);
      return () => clearTimeout(tmr);
    }
  }, [searchOpen]);

  const lastReloadRef = useRef({ reloadToken, refresh });
  useEffect(() => {
    const reloaded =
      lastReloadRef.current.reloadToken !== reloadToken || lastReloadRef.current.refresh !== refresh;
    lastReloadRef.current = { reloadToken, refresh };
    if (reloaded && page !== 1) {
      setLoadingMore(false);
      setPage(1);
      return;
    }
    let cancelled = false;
    const append = page > 1;
    // Full-screen loader only on first open — search/filter keeps the list visible.
    if (!gateOpenRef.current) setLoading(true);
    if (append) {
      setLoadingMore(true);
      setMoreError(null);
    } else {
      setError(null);
      setLoadingMore(false);
      setMoreError(null);
    }
    const timer = setTimeout(() => {
      fetchMyAgentListings({
        page,
        limit: PAGE_SIZE,
        q: query.trim(),
        visibility: filters.visibility || undefined,
        roomStatus: filters.roomStatus || undefined,
        listingSource: filters.listingSource || undefined,
        propertyType: filters.propertyType || undefined,
        roomType: filters.roomType || undefined,
        bedrooms: filters.bedrooms || undefined,
        minPrice: filters.minPrice || undefined,
        maxPrice: filters.maxPrice || undefined,
        sort,
      })
        .then((result) => {
          if (cancelled) return;
          setItems((prev) => {
            if (!append) return result.items;
            const seen = new Set(prev.map((item) => item.id));
            return [...prev, ...result.items.filter((item) => !seen.has(item.id))];
          });
          // An empty later page means rows were removed meanwhile — stop paging.
          setTotal(append && !result.items.length ? (page - 1) * PAGE_SIZE : result.total);
        })
        .catch((err) => {
          if (cancelled) return;
          const message = localizedError(err, copy.loadError, locale);
          if (append) setMoreError(message);
          else setError(message);
        })
        .finally(() => {
          if (cancelled) return;
          setLoading(false);
          setLoadingMore(false);
          if (reloadToken && !append) onReloadSettled?.(reloadToken);
        });
    }, append ? 0 : 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, filters, page, sort, refresh, reloadToken, onReloadSettled, moreAttempt]);

  const hasMore = items.length < total;
  const loadMoreRef = useRef(() => {});
  loadMoreRef.current = () => {
    if (loading || loadingMore || moreError || error || !hasMore) return;
    if (items.length < page * PAGE_SIZE) return;
    setLoadingMore(true);
    setPage((n) => n + 1);
  };
  const pageScroll = useContext(ModePageScrollContext);
  useEffect(() => pageScroll?.onEndReached(() => loadMoreRef.current()), [pageScroll]);

  const filterBadge = useMemo(() => {
    let n = 0;
    if (filters.visibility) n += 1;
    if (filters.roomStatus) n += 1;
    if (filters.listingSource) n += 1;
    if (filters.propertyType) n += 1;
    if (filters.roomType) n += 1;
    if (filters.bedrooms) n += 1;
    if (filters.minPrice || filters.maxPrice) n += 1;
    return n;
  }, [filters]);

  const activeChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; clear: () => void }> = [];
    for (const key of ['propertyType', 'roomType', 'bedrooms'] as const) {
      if (!filters[key]) continue;
      const label =
        key === 'propertyType'
          ? t.masters.propertyTypes[filters[key] as keyof typeof t.masters.propertyTypes]
          : key === 'roomType'
            ? t.masters.roomTypes[filters[key] as keyof typeof t.masters.roomTypes]
            : filters[key] === '0'
              ? t.masters.roomTypes.studio
              : filters[key] === '4'
                ? copy.specBeds.replace('{count}', '4+')
                : filters[key] === '1'
                  ? copy.specBed.replace('{count}', '1')
                  : copy.specBeds.replace('{count}', filters[key]);
      chips.push({
        key,
        label: label || filters[key],
        clear: () => {
          setFilters((f) => ({ ...f, [key]: '' }));
          setPage(1);
        },
      });
    }
    if (filters.minPrice || filters.maxPrice) {
      chips.push({
        key: 'price',
        label: formatPriceSummary(filters, locale, {
          unlimited: copy.filterUnlimited,
          perMonth: copy.filterPricePerMonth,
        }),
        clear: () => {
          setFilters((f) => ({ ...f, minPrice: '', maxPrice: '' }));
          setPage(1);
        },
      });
    }
    if (filters.roomStatus) {
      chips.push({
        key: 'status',
        label: String(copy[filters.roomStatus as keyof typeof copy] || filters.roomStatus),
        clear: () => setFilters((f) => ({ ...f, roomStatus: '' })),
      });
    }
    if (filters.listingSource) {
      chips.push({
        key: 'source',
        label:
          filters.listingSource === 'owner' ? cr.sourceOwner : cr.sourceCoAgent,
        clear: () => setFilters((f) => ({ ...f, listingSource: '' })),
      });
    }
    if (filters.visibility) {
      chips.push({
        key: 'visibility',
        label:
          filters.visibility === 'published' ? cr.visibilityPublished : cr.visibilityPrivate,
        clear: () => setFilters((f) => ({ ...f, visibility: '' })),
      });
    }
    return chips;
  }, [filters, copy, cr, t, locale]);

  const invalidPrice = !validPriceRange(draft);

  const openFilter = () => {
    setDraft(filters);
    setExpandedFilter(null);
    setRoomTypePickerOpen(false);
    setDraggingPrice(false);
    setFilterOpen(true);
  };

  const toggleFilterSection = (key: FilterSectionKey) => {
    setExpandedFilter((current) => {
      const next = current === key ? null : key;
      if (next !== 'room') setRoomTypePickerOpen(false);
      return next;
    });
  };

  const bedroomFilterLabel = (value: string) => {
    if (value === '0') return t.masters.roomTypes.studio;
    if (value === '4') return copy.specBeds.replace('{count}', '4+');
    if (value === '1') return copy.specBed.replace('{count}', '1');
    return copy.specBeds.replace('{count}', value);
  };

  const bedroomSegmentLabel = (value: string) => {
    if (value === '0') return t.masters.roomTypes.studio;
    if (value === '4') return '4+';
    return value;
  };

  const applyRoomType = (roomType: string) => {
    const syncedBeds = roomType ? ROOM_TYPE_BEDROOMS[roomType] : undefined;
    setDraft((d) => ({
      ...d,
      roomType,
      bedrooms: typeof syncedBeds === 'string' ? syncedBeds : d.bedrooms,
    }));
    setRoomTypePickerOpen(false);
  };

  const applyBedrooms = (bedrooms: string) => {
    setRoomTypePickerOpen(false);
    setDraft((d) => {
      const locked = d.roomType ? ROOM_TYPE_BEDROOMS[d.roomType] : undefined;
      const conflicts =
        !!d.roomType &&
        locked != null &&
        bedrooms !== '' &&
        bedrooms !== locked;
      return {
        ...d,
        bedrooms,
        roomType: conflicts ? '' : d.roomType,
      };
    });
  };

  const roomFilterSummary = [
    draft.propertyType
      ? t.masters.propertyTypes[draft.propertyType as keyof typeof t.masters.propertyTypes]
      : null,
    draft.roomType
      ? t.masters.roomTypes[draft.roomType as keyof typeof t.masters.roomTypes]
      : null,
    draft.bedrooms ? bedroomFilterLabel(draft.bedrooms) : null,
  ]
    .filter(Boolean)
    .join(' · ') || copy.filterAny;

  const priceFilterSummary =
    draft.minPrice || draft.maxPrice
      ? formatPriceSummary(draft, locale, {
          unlimited: copy.filterUnlimited,
          perMonth: copy.filterPricePerMonth,
        })
      : copy.filterAny;

  const statusFilterSummary = [
    draft.roomStatus
      ? String(copy[draft.roomStatus as keyof typeof copy] || draft.roomStatus)
      : null,
    draft.listingSource
      ? draft.listingSource === 'owner'
        ? cr.sourceOwner
        : cr.sourceCoAgent
      : null,
  ]
    .filter(Boolean)
    .join(' · ') || copy.filterAny;

  const extraFilterSummary = draft.visibility
    ? draft.visibility === 'private'
      ? cr.visibilityPrivate
      : cr.visibilityPublished
    : copy.filterVisibility;

  const applyFilter = () => {
    if (invalidPrice) return;
    setFilters(draft);
    setPage(1);
    setFilterOpen(false);
  };

  const resetDraft = () => setDraft(EMPTY_FILTERS);

  const clearAllFilters = () => {
    setFilters(EMPTY_FILTERS);
    setPage(1);
  };

  const sortOptions: Array<{ value: AgentListingsSort; label: string }> = [
    { value: 'updated_desc', label: copy.sortUpdatedDesc },
    { value: 'updated_asc', label: copy.sortUpdatedAsc },
    { value: 'price_asc', label: copy.sortPriceAsc },
    { value: 'price_desc', label: copy.sortPriceDesc },
  ];

  const sortLabel = sortOptions.find((opt) => opt.value === sort)?.label ?? copy.sortUpdatedDesc;

  const statusOptions = [
    { value: '', label: copy.filterAny },
    { value: 'available', label: copy.available },
    { value: 'rented', label: copy.rented },
    { value: 'pending_verification', label: copy.pending_verification },
    { value: 'needs_edit', label: copy.needs_edit },
  ];

  const visibilityOptions = [
    { value: '', label: copy.filterAny },
    { value: 'published', label: cr.visibilityPublished },
    { value: 'private', label: cr.visibilityPrivate },
  ];

  const bedroomOptions = ['', '0', '1', '2', '3', '4'];

  const propertyTypeEntries = Object.entries(t.masters.propertyTypes);

  const hasActiveQuery =
    !!query.trim() || filterBadge > 0;

  if (!gateOpen) {
    return (
      <MobileBrandLoader
        fill
        size="md"
        done={!loading}
        onComplete={() => setGateOpen(true)}
      />
    );
  }

  return (
    <View style={styles.root}>
      <MobileListSearchRow
        value={query}
        onChangeText={(value) => {
          setQuery(value);
          setPage(1);
        }}
        placeholder={copy.searchRooms}
        onClear={() => {
          setQuery('');
          setPage(1);
        }}
        onFilterPress={openFilter}
        filterBadgeCount={filterBadge}
        filterAccessibilityLabel={copy.filterRooms}
        clearAccessibilityLabel={copy.filterClear}
        inputRef={searchRef}
        onBlur={() => {
          if (!query.trim()) onSearchOpenChange?.(false);
        }}
      />

      {activeChips.length > 0 ? (
        <View style={styles.activeChipsRow}>
          {activeChips.map((chip) => (
            <Pressable
              key={chip.key}
              onPress={() => { chip.clear(); setPage(1); }}
              style={styles.activeChip}
              accessibilityRole="button"
              accessibilityLabel={`${copy.filterClear} ${chip.label}`}
            >
              <Text style={styles.activeChipLabel}>{chip.label}</Text>
              <MobileIcon name="close" size={12} color={tokens.colors.primary} />
            </Pressable>
          ))}
          <Pressable onPress={clearAllFilters} hitSlop={8}>
            <Text style={[styles.clearLink, { color: theme.textSecondary }]}>{copy.filterClear}</Text>
          </Pressable>
        </View>
      ) : null}

      <MobileListToolbar countLabel={copy.results.replace('{count}', String(total))}>
          <Pressable
            onPress={() => setSortOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={copy.sortTitle}
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
          <View style={[styles.viewToggle, { borderColor: theme.border, backgroundColor: theme.surface }]}>
            {(['grid', 'row'] as const).map((mode) => {
              const selected = viewMode === mode;
              return (
                <Pressable
                  key={mode}
                  onPress={() => setViewMode(mode)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={mode === 'grid' ? copy.viewGrid : copy.viewRow}
                  style={[
                    styles.viewToggleBtn,
                    selected && styles.viewToggleBtnSelected,
                  ]}
                  {...(Platform.OS === 'android'
                    ? { android_ripple: { color: 'rgba(0,0,0,0.08)' } }
                    : {})}
                >
                  <MobileIcon
                    name={mode === 'grid' ? 'grid' : 'list-rows'}
                    size={18}
                    color={selected ? tokens.colors.primary : theme.textSecondary}
                  />
                </Pressable>
              );
            })}
          </View>
      </MobileListToolbar>

      {error && items.length > 0 ? (
        <View style={{ gap: 8 }} accessibilityLiveRegion="polite">
          <Text style={{ color: theme.textSecondary }}>{error}</Text>
          <MobileButton variant="outline" onPress={() => setRefresh((n) => n + 1)}>
            {copy.retry}
          </MobileButton>
        </View>
      ) : null}

      <MobileAgentListingsBody
        items={items}
        viewMode={viewMode}
        loading={false}
        error={items.length ? null : error}
        filtered={hasActiveQuery}
        onRetry={() => setRefresh((n) => n + 1)}
        onRoomPress={setSelected}
      />

      {!error && items.length > 0 ? (
        <View style={styles.listFooter} accessibilityLiveRegion="polite">
          {moreError ? (
            <>
              <Text style={[styles.listFooterText, { color: theme.textSecondary }]}>{moreError}</Text>
              <MobileButton variant="outline" onPress={() => setMoreAttempt((n) => n + 1)}>
                {copy.retry}
              </MobileButton>
            </>
          ) : loadingMore || hasMore ? (
            <ActivityIndicator color={tokens.colors.primary} />
          ) : total > PAGE_SIZE ? (
            <Text style={[styles.listFooterText, { color: theme.textSecondary }]}>
              {copy.allLoaded.replace('{count}', String(total))}
            </Text>
          ) : null}
        </View>
      ) : null}

      <MobileBottomSheet visible={sortOpen} onClose={() => setSortOpen(false)}>
        <View style={styles.sheetHeader}>
          <Text style={[styles.sheetTitle, { color: theme.textHeading }]}>{copy.sortTitle}</Text>
          <Pressable
            onPress={() => setSortOpen(false)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={t.agent.createRoom.closePhotoPreview}
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
        onClose={() => {
          setFilterOpen(false);
          setExpandedFilter(null);
          setRoomTypePickerOpen(false);
          setDraggingPrice(false);
        }}
        avoidKeyboard
        maxHeight="92%"
      >
        <View style={styles.sheetHeader}>
          <Text style={[styles.sheetTitle, { color: theme.textHeading }]}>{copy.filterRooms}</Text>
          <Pressable
            onPress={() => {
              setFilterOpen(false);
              setExpandedFilter(null);
              setRoomTypePickerOpen(false);
            }}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={cr.closePhotoPreview}
          >
            <MobileIcon name="close" size={22} color={theme.textHeading} />
          </Pressable>
        </View>
        <ScrollView
          style={[styles.sheetBody, { maxHeight: undefined }]}
          scrollEnabled={!draggingPrice && !roomTypePickerOpen}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <FilterAccordion
            icon="buildings"
            title={copy.roomInformation}
            summary={roomFilterSummary}
            expanded={expandedFilter === 'room'}
            onToggle={() => toggleFilterSection('room')}
          >
            <View style={styles.filterSection}>
              <FilterSubHeader
                title={cr.propertyType}
                clearLabel={copy.filterAny}
                showClear={!!draft.propertyType}
                onClear={() => setDraft((d) => ({ ...d, propertyType: '' }))}
              />
              <View style={styles.iconCardRow}>
                {propertyTypeEntries.map(([value, label]) => (
                  <FilterIconCard
                    key={value}
                    icon={PROPERTY_TYPE_ICONS[value] ?? 'buildings'}
                    label={label}
                    selected={draft.propertyType === value}
                    onPress={() =>
                      setDraft((d) => ({
                        ...d,
                        propertyType: d.propertyType === value ? '' : value,
                      }))
                    }
                  />
                ))}
              </View>
            </View>

            <View style={styles.filterSection}>
              <Text style={[styles.filterSectionTitle, { color: theme.textHeading }]}>
                {cr.roomType}
              </Text>
              <Pressable
                onPress={() => setRoomTypePickerOpen((v) => !v)}
                accessibilityRole="button"
                accessibilityState={{ expanded: roomTypePickerOpen }}
                style={({ pressed }) => [
                  styles.dropdownRow,
                  roomTypePickerOpen ? styles.dropdownRowOpen : null,
                  { borderColor: theme.border, backgroundColor: theme.surface },
                  pressed ? { opacity: 0.9 } : null,
                ]}
              >
                <Text style={[styles.dropdownValue, { color: theme.textHeading }]}>
                  {draft.roomType
                    ? t.masters.roomTypes[draft.roomType as keyof typeof t.masters.roomTypes]
                    : copy.filterAny}
                </Text>
                <View
                  style={{
                    transform: [{ rotate: roomTypePickerOpen ? '180deg' : '0deg' }],
                  }}
                >
                  <MobileIcon name="chevron-down" size={16} color={theme.textSecondary} />
                </View>
              </Pressable>
              {roomTypePickerOpen ? (
                <ScrollView
                  style={[
                    styles.dropdownMenu,
                    { borderColor: theme.border, backgroundColor: theme.surface },
                  ]}
                  nestedScrollEnabled
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator
                >
                  {(
                    [
                      { value: '', label: copy.filterAny },
                      ...Object.entries(t.masters.roomTypes).map(([value, label]) => ({
                        value,
                        label,
                      })),
                    ] as Array<{ value: string; label: string }>
                  ).map((opt, index) => {
                    const selected = draft.roomType === opt.value;
                    return (
                      <Pressable
                        key={opt.value || 'any'}
                        onPress={() => applyRoomType(opt.value)}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        style={({ pressed }) => [
                          styles.dropdownOption,
                          index === 0 ? styles.dropdownOptionFirst : null,
                          selected ? styles.dropdownOptionSelected : null,
                          pressed ? { opacity: 0.88 } : null,
                        ]}
                      >
                        <Text
                          style={[
                            styles.dropdownOptionLabel,
                            {
                              color: selected
                                ? tokens.colors.primary
                                : theme.textHeading,
                            },
                          ]}
                        >
                          {opt.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              ) : null}
            </View>

            <View style={styles.filterSection}>
              <Text style={[styles.filterSectionTitle, { color: theme.textHeading }]}>
                {cr.bedroom}
              </Text>
              <View style={styles.segmentRow}>
                {bedroomOptions.map((value) => {
                  const selected = draft.bedrooms === value;
                  const label =
                    value === '' ? copy.filterAny : bedroomSegmentLabel(value);
                  return (
                    <Pressable
                      key={value || 'any'}
                      onPress={() => applyBedrooms(value)}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      style={({ pressed }) => [
                        styles.segmentItem,
                        selected ? styles.segmentItemSelected : null,
                        pressed ? { opacity: 0.9 } : null,
                      ]}
                    >
                      <Text
                        style={[
                          styles.segmentLabel,
                          selected ? styles.segmentLabelSelected : null,
                        ]}
                        numberOfLines={1}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </FilterAccordion>

          <FilterAccordion
            icon="coins"
            title={copy.filterPriceRange}
            summary={priceFilterSummary}
            expanded={expandedFilter === 'price'}
            onToggle={() => toggleFilterSection('price')}
          >
            <RoomPriceFilter
              value={draft}
              onChange={(range) => setDraft((d) => ({ ...d, ...range }))}
              onDragging={setDraggingPrice}
            />
          </FilterAccordion>

          <FilterAccordion
            icon="calendar"
            title={copy.filterManagement}
            summary={statusFilterSummary}
            expanded={expandedFilter === 'status'}
            onToggle={() => toggleFilterSection('status')}
          >
            <FilterOptionRow
              title={copy.filterAvailability}
              options={statusOptions}
              value={draft.roomStatus}
              onChange={(v) => setDraft((d) => ({ ...d, roomStatus: v as StatusFilter }))}
              columns={3}
            />
            <View style={styles.filterSection}>
              <Text style={[styles.filterSectionTitle, { color: theme.textHeading }]}>
                {copy.filterSource}
              </Text>
              <View style={styles.iconCardRow}>
                {SOURCE_FILTER_OPTIONS.map((opt) => {
                  const label =
                    opt.value === ''
                      ? copy.filterAny
                      : opt.value === 'owner'
                        ? cr.sourceOwner
                        : cr.sourceCoAgent;
                  return (
                    <FilterIconCard
                      key={opt.value || 'any'}
                      icon={opt.icon}
                      label={label}
                      selected={draft.listingSource === opt.value}
                      onPress={() => setDraft((d) => ({ ...d, listingSource: opt.value }))}
                    />
                  );
                })}
              </View>
            </View>
          </FilterAccordion>

          <FilterAccordion
            icon="gear"
            title={copy.filterMore}
            summary={extraFilterSummary}
            expanded={expandedFilter === 'extra'}
            onToggle={() => toggleFilterSection('extra')}
            isLast
          >
            <FilterOptionRow
              title={copy.filterVisibility}
              options={visibilityOptions}
              value={draft.visibility}
              onChange={(v) => setDraft((d) => ({ ...d, visibility: v as VisibilityFilter }))}
              columns={3}
            />
          </FilterAccordion>
        </ScrollView>
        <View style={styles.sheetFooter}>
          <Pressable onPress={resetDraft} hitSlop={8}>
            <Text style={[styles.resetLink, { color: theme.textHeading }]}>{copy.filterReset}</Text>
          </Pressable>
          <Pressable
            onPress={applyFilter}
            disabled={invalidPrice}
            accessibilityState={{ disabled: invalidPrice }}
            style={[styles.showResultsBtn, invalidPrice && { opacity: 0.45 }]}
            accessibilityRole="button"
            {...(Platform.OS === 'android'
              ? { android_ripple: { color: 'rgba(33,30,30,0.12)' } }
              : {})}
          >
            <Text style={styles.showResultsLabel}>{copy.filterShowResults}</Text>
          </Pressable>
        </View>
      </MobileBottomSheet>

      <AgentRoomDetailModal
        roomId={selected}
        onClose={() => setSelected(null)}
        onSaved={() => setRefresh((n) => n + 1)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 12 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  searchField: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: tokens.typography.native.body,
    fontSize: 14,
    lineHeight: 21,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
  },
  filterBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: tokens.colors.brand[500],
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontFamily: tokens.typography.native.body,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '700',
    color: tokens.colors.primary,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  toolbarCount: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 19,
    flexShrink: 0,
  },
  toolbarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
    minWidth: 0,
  },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 36,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    maxWidth: 140,
  },
  sortLabel: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
    flexShrink: 1,
  },
  viewToggle: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
  viewToggleBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewToggleBtnSelected: {
    backgroundColor: tokens.colors.brand[100],
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
  listFooter: {
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  listFooterText: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
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
    fontWeight: '500',
  },
  sheetBody: {
    paddingHorizontal: 20,
    maxHeight: 420,
  },
  filterSection: { gap: 10, marginBottom: 16 },
  accordionBlock: {
    paddingVertical: 4,
  },
  accordionDivider: {
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.divider,
    marginBottom: 4,
    paddingBottom: 8,
  },
  accordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    paddingVertical: 8,
  },
  accordionIconWell: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.slate[50],
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  accordionCopy: {
    flex: 1,
    gap: 2,
  },
  accordionTitle: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
  },
  accordionSummary: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 19,
    color: tokens.colors.textSecondary,
  },
  accordionBody: {
    paddingTop: 4,
    paddingBottom: 12,
  },
  filterSectionTitle: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '500',
  },
  subHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  clearInline: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
    color: tokens.colors.accent,
  },
  iconCardRow: {
    flexDirection: 'row',
    gap: 8,
  },
  iconCard: {
    flex: 1,
    minHeight: 88,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 12,
    position: 'relative',
  },
  iconCardSelected: {
    borderColor: tokens.colors.brand[500],
    backgroundColor: tokens.colors.brand[50],
  },
  iconCardLabel: {
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    color: tokens.colors.textHeading,
    fontWeight: '600',
  },
  iconCardLabelSelected: {
    color: tokens.colors.primary,
  },
  dropdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  dropdownRowOpen: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderBottomWidth: 0,
  },
  dropdownValue: {
    fontFamily: tokens.typography.native.body,
    fontSize: 15,
    lineHeight: 22,
    flex: 1,
  },
  dropdownMenu: {
    maxHeight: 260,
    borderWidth: 1,
    borderTopWidth: 0,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    marginBottom: 4,
  },
  dropdownOption: {
    minHeight: 52,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: tokens.colors.border,
  },
  dropdownOptionFirst: {
    borderTopWidth: 0,
  },
  dropdownOptionSelected: {
    backgroundColor: tokens.colors.brand[50],
  },
  dropdownOptionLabel: {
    fontFamily: tokens.typography.native.body,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
  },
  segmentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  segmentItem: {
    minWidth: 48,
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentItemSelected: {
    borderColor: tokens.colors.brand[500],
    backgroundColor: tokens.colors.brand[50],
  },
  segmentLabel: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 19,
    color: tokens.colors.textHeading,
    fontWeight: '600',
  },
  segmentLabelSelected: {
    color: tokens.colors.primary,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    flexGrow: 0,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 12,
    minHeight: 44,
  },
  filterChipCol3: {
    width: '31.5%',
    maxWidth: '31.5%',
  },
  filterChipCol2: {
    width: '48%',
    maxWidth: '48%',
  },
  chipLabel: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
    textAlign: 'center',
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
