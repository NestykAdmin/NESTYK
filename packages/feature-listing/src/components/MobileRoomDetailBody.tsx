import { formatBedroomSpec } from '../bedroom-label';
import { amenityIcon, FACILITY_GROUP_ICONS } from '../facility-icons';
import {
  categoryColors,
  formatTransitPlaceName,
  nearbyCategories,
  nearbyCategory,
  nearbyCategoryIcons,
  type NearbyCategory,
} from '../nearby';
import { NearbyPlacesMap } from './NearbyPlacesMap';
import { HeroPhotoPager } from './HeroPhotoPager';
import type { AgentRoomDetail } from '../agent-room-detail';
import { roomStatusLabel } from '../room-status-label';
import type { RoomShareVisibility } from '../share-completeness';
import { DEFAULT_ROOM_SHARE_VISIBILITY } from '../share-completeness';
import { initialPhotoLoad, photoLoadReducer } from './room-photo-load';
import type { NearbyPlace } from '@nestyk/types';
import { Image } from 'expo-image';
import React, { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  Linking,
  ActivityIndicator,
  Pressable,
  FlatList,
  Platform,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ListRenderItemInfo,
} from 'react-native';
import { AMENITIES_CATALOG_GROUP_ORDER, useLocale } from '@nestyk/i18n';
import {
  MobileButton,
  MobileIcon,
  MobilePhotoViewer,
  getCardElevation,
  type AppIconName,
  type MobilePhotoViewerLabels,
  tokens,
  useMobileTheme,
} from '@nestyk/ui/native';

export type RoomDetailMode = 'shared' | 'agent' | 'preview';

export type MobileRoomDetailBodyProps = {
  room: AgentRoomDetail;
  mode?: RoomDetailMode;
  mapsApiKey?: string;
  /** Optional share-readiness banner (agent). */
  shareComplete?: { done: number; total: number } | null;
  /** Guest/preview: which blocks the customer sees. Agent ignores. */
  shareVisibility?: RoomShareVisibility;
  /** Guest/preview: contact shown on listing (defaults to primary). */
  shareContactId?: number | null;
  onShare?: () => void;
  onInquire?: () => void;
  onRequestViewing?: () => void;
  onClosePreview?: () => void;
  onOpenShareCheck?: () => void;
  /** Parent replaces modal header with preview chrome. */
  hidePreviewBanner?: boolean;
};

function interpolate(template: string, vars: Record<string, string | number>) {
  return Object.entries(vars).reduce(
    (out, [key, value]) => out.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value)),
    template,
  );
}

function layoutValue(layout: { code: string; value: string }[], code: string) {
  return layout.find((item) => item.code === code)?.value?.trim() || null;
}

function formatDisplayDate(iso: string | null | undefined, locale: string) {
  if (!iso) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return iso;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (Number.isNaN(date.getTime())) return iso;
  try {
    return date.toLocaleDateString(locale === 'th' ? 'th-TH' : `${locale}-u-ca-gregory`, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function statusTone(code: string | null) {
  if (code === 'available') {
    return {
      bg: tokens.colors.subtle.successBg,
      fg: tokens.colors.subtle.successFg,
      dot: tokens.colors.success,
    };
  }
  if (code === 'booked') {
    return { bg: tokens.colors.brand[50], fg: tokens.colors.brand[500], dot: tokens.colors.brand[500] };
  }
  if (code === 'rented') {
    return {
      bg: '#F1F5F9',
      fg: tokens.colors.icon.secondary,
      dot: tokens.colors.icon.secondary,
    };
  }
  return {
    bg: tokens.colors.subtle.warningBg,
    fg: tokens.colors.subtle.warningFg,
    dot: tokens.colors.warning,
  };
}

function HeroPhoto({
  uri,
  width,
  height,
  fallback,
  retryLabel,
}: {
  uri: string;
  width: number;
  height: number;
  fallback: string;
  retryLabel: string;
}) {
  const [state, dispatch] = useReducer(photoLoadReducer, initialPhotoLoad);
  useEffect(() => {
    if (state.status !== 'loading') return;
    const timeout = setTimeout(() => dispatch({ type: 'timeout', attempt: state.attempt }), 8000);
    return () => clearTimeout(timeout);
  }, [state.attempt, state.status]);

  return (
    <View style={[styles.heroSlide, { width, height }]}>
      {state.status !== 'failed' ? (
        <Image
          key={`${uri}:${state.attempt}`}
          source={{ uri }}
          contentFit="cover"
          cachePolicy="memory-disk"
          style={StyleSheet.absoluteFillObject}
          onLoad={() => dispatch({ type: 'loaded', attempt: state.attempt })}
          onError={() => dispatch({ type: 'failed', attempt: state.attempt })}
        />
      ) : null}
      {state.status === 'loading' ? (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.photoOverlay]}>
          <ActivityIndicator color={tokens.colors.brand[500]} />
        </View>
      ) : null}
      {state.status === 'failed' ? (
        <View style={[StyleSheet.absoluteFill, styles.photoOverlay]}>
          <Text style={styles.photoFallbackText}>{fallback}</Text>
          <MobileButton variant="outline" onPress={() => dispatch({ type: 'retry' })}>
            {retryLabel}
          </MobileButton>
        </View>
      ) : null}
    </View>
  );
}

const NEARBY_FILTER_ALL = 'all' as const;
type NearbyFilter = typeof NEARBY_FILTER_ALL | NearbyCategory;

/**
 * Shared room detail body — same layout for guest share, agent, and preview.
 * Agent/preview only add chrome; shared content stays aligned.
 */
export function MobileRoomDetailBody({
  room,
  mode = 'shared',
  mapsApiKey: _mapsApiKey,
  shareComplete,
  shareVisibility = DEFAULT_ROOM_SHARE_VISIBILITY,
  shareContactId = null,
  onShare,
  onInquire: _onInquire,
  onRequestViewing: _onRequestViewing,
  onClosePreview,
  onOpenShareCheck,
  hidePreviewBanner = false,
}: MobileRoomDetailBodyProps) {
  void _mapsApiKey;
  void _onInquire;
  void _onRequestViewing;
  const { t, locale } = useLocale();
  const { theme } = useMobileTheme();
  const { width } = useWindowDimensions();
  const copy = t.agent.listings;
  const cr = t.agent.createRoom;
  const rd = t.agent.roomDetail;
  const isAgent = mode === 'agent';
  const isPreview = mode === 'preview';
  const showPhotos = isAgent || shareVisibility.photos;
  const showPrice = isAgent || shareVisibility.price;
  const showFacilities = isAgent || shareVisibility.facilities;
  const showLocation = isAgent || shareVisibility.location;
  const showContact = isAgent || shareVisibility.contact;

  const [photoIndex, setPhotoIndex] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [aboutExpanded, setAboutExpanded] = useState(false);
  const sortedPrices = useMemo(
    () =>
      [...room.prices].sort(
        (a, b) => a.price - b.price || (b.termMonths ?? 0) - (a.termMonths ?? 0),
      ),
    [room.prices],
  );
  const [selectedPriceKey, setSelectedPriceKey] = useState(() => {
    const first = sortedPrices[0];
    return first ? String(first.contractTypeId ?? `${first.contractTypeCode}-0`) : '';
  });

  const photos = useMemo(
    () => room.medias.filter((m) => m.mediaType === 'image'),
    [room.medias],
  );
  const heroHeight = Math.round(Math.min(width * 0.72, 320));

  const bedroom = layoutValue(room.layout, 'bedroom');
  const bathroom = layoutValue(room.layout, 'bathroom');
  const sizeSqm = layoutValue(room.layout, 'room_size');
  const floor = layoutValue(room.layout, 'floor');
  const building = layoutValue(room.layout, 'building');

  const selectedPrice = useMemo(() => {
    return (
      sortedPrices.find(
        (p, i) => String(p.contractTypeId ?? `${p.contractTypeCode}-${i}`) === selectedPriceKey,
      ) ?? sortedPrices[0] ?? null
    );
  }, [selectedPriceKey, sortedPrices]);

  const money = (amount: number) =>
    new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'THB',
      maximumFractionDigits: 0,
    }).format(amount);

  const locationLine = useMemo(() => {
    if (!room.property) return null;
    return [room.property.district, room.property.province].filter((v) => v && v !== '-').join(', ');
  }, [room.property]);

  // D8: the status from the deals, with the day a soon-vacant room is free.
  const statusLabel = roomStatusLabel(copy, room.roomStatusCode, room.vacantFrom, locale);
  const statusColors = statusTone(room.roomStatusCode);
  const availableLabel = formatDisplayDate(room.availableFromDate, locale) || copy.notSpecified;
  const displayTitle =
    room.promoTitle?.trim() || room.property?.name || room.listingTitle || `#${room.id}`;

  const bedSpec = formatBedroomSpec(
    bedroom,
    {
      studio: t.masters.roomTypes.studio,
      one: copy.specBed,
      many: copy.specBeds,
    },
    room.roomTypeCode,
  );
  const bathSpec = bathroom
    ? interpolate(Number(bathroom) === 1 ? copy.specBath : copy.specBaths, { count: bathroom })
    : null;
  const sizeSpec = sizeSqm ? interpolate(copy.specSqm, { size: sizeSqm }) : null;
  const floorSpec = floor
    ? building
      ? interpolate(rd.floorBuilding, { floor, building })
      : interpolate(copy.specFloor, { floor })
    : null;

  const specs = [
    bedSpec ? { key: 'bed', icon: 'bed' as const, label: bedSpec } : null,
    bathSpec ? { key: 'bath', icon: 'bath' as const, label: bathSpec } : null,
    sizeSpec ? { key: 'sqm', icon: 'room-size' as const, label: sizeSpec } : null,
    floorSpec ? { key: 'floor', icon: 'stairs' as const, label: floorSpec } : null,
  ].filter(Boolean) as Array<{ key: string; icon: AppIconName; label: string }>;

  const advanceMonths = selectedPrice
    ? selectedPrice.advanceRentMonths ?? room.advanceRentMonths
    : 0;
  const depositMonths = selectedPrice
    ? selectedPrice.depositMonths ?? room.depositMonths
    : 0;
  const monthly = selectedPrice?.price ?? 0;
  const advanceTotal = monthly * advanceMonths;
  const depositTotal = monthly * depositMonths;
  const moveInTotal = advanceTotal + depositTotal;

  const aboutText = (room.description || '').trim();
  const aboutPreviewLimit = 220;
  const aboutNeedsMore = aboutText.length > aboutPreviewLimit;
  const aboutShown =
    aboutExpanded || !aboutNeedsMore
      ? aboutText
      : `${aboutText.slice(0, aboutPreviewLimit).trimEnd()}…`;

  const facilityItems = useMemo(() => {
    const items: { code: string; groupCode?: string | null }[] = room.facilityItems?.length
      ? room.facilityItems
      : (room.facilities || []).map((code) => ({ code }));
    return items;
  }, [room.facilities, room.facilityItems]);

  const facilityGroups = useMemo(() => {
    const byGroup = new Map<string, string[]>();
    for (const item of facilityItems) {
      const group = item.groupCode || 'other';
      const list = byGroup.get(group) ?? [];
      list.push(item.code);
      byGroup.set(group, list);
    }
    const custom = (room.customFacilities ?? []).map((v) => v.trim()).filter(Boolean);
    if (custom.length) {
      const list = byGroup.get('other') ?? [];
      for (const name of custom) list.push(`custom:${name}`);
      byGroup.set('other', list);
    }
    const ordered = AMENITIES_CATALOG_GROUP_ORDER.filter((g) => byGroup.has(g));
    const rest = [...byGroup.keys()].filter((g) => !ordered.includes(g as never));
    return [...ordered, ...rest].map((group) => ({
      group,
      codes: byGroup.get(group) ?? [],
    }));
  }, [facilityItems, room.customFacilities]);

  const facilityTotalCount = facilityGroups.reduce((sum, g) => sum + g.codes.length, 0);
  const facilityDefaultOpen = useMemo(() => {
    if (!facilityGroups.length) return null;
    // Short list: open first group. Long list: start collapsed for scan.
    return facilityTotalCount <= 8 ? facilityGroups[0]!.group : null;
  }, [facilityGroups, facilityTotalCount]);

  const [expandedFacilityGroup, setExpandedFacilityGroup] = useState<string | null>(null);
  const [nearbyFilter, setNearbyFilter] = useState<NearbyFilter>(NEARBY_FILTER_ALL);
  const [internalExpanded, setInternalExpanded] = useState(false);
  useEffect(() => {
    setExpandedFacilityGroup(facilityDefaultOpen);
  }, [room.id, facilityDefaultOpen]);
  useEffect(() => {
    setNearbyFilter(NEARBY_FILTER_ALL);
    setInternalExpanded(false);
  }, [room.id]);

  const toggleFacilityGroup = useCallback((groupCode: string) => {
    setExpandedFacilityGroup((prev) => (prev === groupCode ? null : groupCode));
  }, []);

  const nearby = room.nearbyPlaces ?? [];
  const nearbyByCategory = useMemo(() => {
    const counts = new Map<NearbyCategory, number>();
    for (const place of nearby) {
      const cat = nearbyCategory(place.type || '');
      counts.set(cat, (counts.get(cat) ?? 0) + 1);
    }
    return nearbyCategories.filter((c) => (counts.get(c) ?? 0) > 0).map((c) => ({
      code: c,
      count: counts.get(c) ?? 0,
    }));
  }, [nearby]);
  const filteredNearby = useMemo(() => {
    if (nearbyFilter === NEARBY_FILTER_ALL) return nearby;
    return nearby.filter((p) => nearbyCategory(p.type || '') === nearbyFilter);
  }, [nearby, nearbyFilter]);
  const lat = room.latitude ?? room.property?.latitude;
  const lng = room.longitude ?? room.property?.longitude;
  const mapLat = lat != null ? Number(lat) : null;
  const mapLng = lng != null ? Number(lng) : null;

  const primaryContact =
    (shareContactId != null
      ? room.contacts.find((c) => c.id === shareContactId)
      : null) ??
    room.contacts.find((c) => c.isPrimary) ??
    room.contacts[0] ??
    null;

  const viewerLabels: MobilePhotoViewerLabels = {
    titlePreview: cr.photoViewerTitle,
    titleCompare: cr.photoViewerCompareTitle,
    before: cr.photoBefore,
    after: cr.photoAfter,
    enhancedBadge: cr.photoViewerEnhancedBadge,
    enhancedCaption: cr.photoViewerEnhancedCaption,
    hintZoom: cr.photoViewerHintZoom,
    hintCompareSwitch: cr.photoViewerHintCompareSwitch,
    hintCompareClose: cr.photoViewerHintCompareClose,
    closeA11y: cr.closePhotoPreview,
  };

  const onHeroScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const next = Math.round(event.nativeEvent.contentOffset.x / Math.max(width, 1));
      if (next !== photoIndex && next >= 0 && next < photos.length) setPhotoIndex(next);
    },
    [photoIndex, photos.length, width],
  );

  const renderHeroItem = useCallback(
    ({ item }: ListRenderItemInfo<(typeof photos)[number]>) => (
      <Pressable
        onPress={() => setViewerOpen(true)}
        accessibilityRole="imagebutton"
        accessibilityLabel={cr.photoViewerTitle}
      >
        <HeroPhoto
          uri={item.mediaUrl}
          width={width}
          height={heroHeight}
          fallback={copy.photoLoadError}
          retryLabel={copy.retry}
        />
      </Pressable>
    ),
    [copy.photoLoadError, copy.retry, cr.photoViewerTitle, heroHeight, width],
  );

  const elevation = getCardElevation(1);
  const { boxShadow: _webOnly, ...cardElevation } = elevation;
  const stickyTerm =
    selectedPrice?.termMonths != null
      ? interpolate(rd.contractMonths, { months: selectedPrice.termMonths })
      : null;

  const openMaps = () => {
    if (mapLat == null || mapLng == null || Number.isNaN(mapLat) || Number.isNaN(mapLng)) return;
    const url = Platform.select({
      ios: `http://maps.apple.com/?ll=${mapLat},${mapLng}&q=${encodeURIComponent(displayTitle)}`,
      default: `https://www.google.com/maps/search/?api=1&query=${mapLat},${mapLng}`,
    });
    if (url) void Linking.openURL(url);
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.background || tokens.colors.background }]}>
      {isPreview && !hidePreviewBanner ? (
        <View style={styles.previewBanner}>
          <MobileIcon name="globe" size={16} color="#FFFFFF" />
          <Text style={styles.previewBannerText}>{rd.previewBanner}</Text>
          {onClosePreview ? (
            <Pressable onPress={onClosePreview} hitSlop={8}>
              <Text style={styles.previewClose}>{rd.closePreview}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.hero, { height: heroHeight }]}>
          {showPhotos && photos.length ? (
            <>
              <FlatList
                data={photos}
                keyExtractor={(item) => String(item.id)}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={onHeroScroll}
                renderItem={renderHeroItem}
                getItemLayout={(_, index) => ({
                  length: width,
                  offset: width * index,
                  index,
                })}
              />
              {photos.length > 1 ? (
                <HeroPhotoPager index={photoIndex} total={photos.length} />
              ) : null}
            </>
          ) : (
            <View style={[styles.heroEmpty, { width, height: heroHeight }]}>
              <MobileIcon name="camera" size={28} color={tokens.colors.icon.secondary} />
              <Text style={styles.heroEmptyText}>
                {showPhotos ? copy.noPhotos : rd.shareHiddenPhotos}
              </Text>
            </View>
          )}
        </View>

        <View style={[styles.summaryCard, cardElevation, { backgroundColor: theme.surface }]}>
          <View style={styles.titleRow}>
            <Text style={styles.propertyTitle} numberOfLines={2}>
              {displayTitle}
            </Text>
            <View style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}>
              <View style={[styles.statusDot, { backgroundColor: statusColors.dot }]} />
              <Text style={[styles.statusBadgeText, { color: statusColors.fg }]} numberOfLines={1}>
                {statusLabel}
              </Text>
            </View>
          </View>

          {locationLine ? (
            <View style={styles.locationRow}>
              <MobileIcon name="map-pin" size={14} color={tokens.colors.icon.secondary} />
              <Text style={styles.locationText} numberOfLines={1}>
                {locationLine}
              </Text>
            </View>
          ) : null}

          {isAgent && shareComplete ? (
            <Pressable
              style={styles.shareReadyBanner}
              onPress={onOpenShareCheck}
              disabled={!onOpenShareCheck}
            >
              <Text style={styles.shareReadyText}>
                {interpolate(rd.shareCompleteBanner, {
                  done: shareComplete.done,
                  total: shareComplete.total,
                  percent: Math.round((shareComplete.done / Math.max(shareComplete.total, 1)) * 100),
                })}
              </Text>
              <Text style={styles.shareReadyLink}>{rd.checkShare}</Text>
            </Pressable>
          ) : null}

          {showPrice ? (
            <View style={styles.priceBox}>
              <Text style={styles.priceText}>
                {selectedPrice
                  ? interpolate(copy.rentPerMonth, {
                      price: selectedPrice.price.toLocaleString(),
                    })
                  : copy.notSpecified}
              </Text>
              {stickyTerm ? <Text style={styles.priceHint}>{stickyTerm}</Text> : null}
            </View>
          ) : null}

          {specs.length ? (
            <View style={styles.specsRow}>
              {specs.map((spec) => (
                <View key={spec.key} style={styles.specItem}>
                  <View style={styles.specIcon}>
                    <MobileIcon name={spec.icon} size={18} color={tokens.colors.primary} />
                  </View>
                  <Text style={styles.specLabel}>{spec.label}</Text>
                </View>
              ))}
            </View>
          ) : null}

          <View style={styles.availabilityRow}>
            <MobileIcon name="calendar" size={18} color={tokens.colors.primary} />
            <Text style={styles.availabilityValue}>
              {interpolate(rd.readyMoveIn, { date: availableLabel })}
            </Text>
          </View>
        </View>

        {aboutText ? (
          <View style={[styles.sectionCard, cardElevation, { backgroundColor: theme.surface }]}>
            <Text style={styles.sectionHeading}>{rd.aboutThisRoom}</Text>
            <Text style={styles.aboutBody} selectable>
              {aboutShown}
            </Text>
            {aboutNeedsMore ? (
              <Pressable onPress={() => setAboutExpanded((v) => !v)} hitSlop={8}>
                <Text style={styles.readMore}>
                  {aboutExpanded ? rd.readLess : rd.readMore}
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {showPrice ? (
        <View style={[styles.sectionCard, cardElevation, { backgroundColor: theme.surface }]}>
          <Text style={styles.sectionHeading}>{copy.rentAndTerms}</Text>
          <View style={styles.contractList}>
            {sortedPrices.map((price, index) => {
              const key = String(price.contractTypeId ?? `${price.contractTypeCode}-${index}`);
              const selected = key === selectedPriceKey || (!selectedPriceKey && index === 0);
              const title =
                price.termMonths != null
                  ? interpolate(rd.contractMonths, { months: price.termMonths })
                  : price.contractTypeCode;
              return (
                <Pressable
                  key={key}
                  onPress={() => setSelectedPriceKey(key)}
                  style={[styles.contractRow, selected ? styles.contractRowOn : null]}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                >
                  <View style={styles.contractCopy}>
                    <Text style={styles.contractTitle}>{title}</Text>
                    <Text style={styles.contractPrice}>
                      {interpolate(copy.rentPerMonth, {
                        price: price.price.toLocaleString(),
                      })}
                    </Text>
                  </View>
                  <View style={[styles.check, selected ? styles.checkOn : null]}>
                    {selected ? (
                      <MobileIcon name="check" size={14} color="#FFFFFF" weight="bold" />
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
            {!sortedPrices.length ? (
              <Text style={styles.muted}>{copy.notSpecified}</Text>
            ) : null}
          </View>

          {selectedPrice ? (
            <View style={styles.costBlock}>
              <Text style={styles.costHeading}>{rd.initialCosts}</Text>
              <View style={styles.costRow}>
                <Text style={styles.costLabel}>
                  {interpolate(rd.advanceLabel, { months: advanceMonths })}
                </Text>
                <Text style={styles.costValue}>{money(advanceTotal)}</Text>
              </View>
              <View style={styles.costRow}>
                <Text style={styles.costLabel}>
                  {interpolate(rd.depositLabel, { months: depositMonths })}
                </Text>
                <Text style={styles.costValue}>{money(depositTotal)}</Text>
              </View>
              <View style={[styles.costRow, styles.costTotalRow]}>
                <Text style={styles.costTotalLabel}>{rd.totalDue}</Text>
                <Text style={styles.costTotalValue}>{money(moveInTotal)}</Text>
              </View>
              <Text style={styles.costNote}>{rd.otherFeesNote}</Text>
            </View>
          ) : null}
        </View>
        ) : null}

        {showFacilities ? (
        <View style={[styles.sectionCard, cardElevation, { backgroundColor: theme.surface }]}>
          <View style={styles.facilitySectionHead}>
            <Text style={styles.sectionHeading}>{rd.facilities}</Text>
            {facilityTotalCount > 0 ? (
              <Text style={styles.facilitySummary}>
                {interpolate(rd.facilitiesSummary, {
                  count: facilityTotalCount,
                  groups: facilityGroups.length,
                })}
              </Text>
            ) : null}
          </View>

          {facilityGroups.length ? (
            <View style={styles.facilityGroups}>
              {facilityGroups.map((group) => {
                const open = expandedFacilityGroup === group.group;
                const groupLabel =
                  t.masters.facilityGroups[
                    group.group as keyof typeof t.masters.facilityGroups
                  ] ?? group.group;
                return (
                  <View key={group.group} style={styles.facilityGroup}>
                    <Pressable
                      style={[
                        styles.facilityGroupHeader,
                        open ? styles.facilityGroupHeaderOpen : null,
                      ]}
                      onPress={() => toggleFacilityGroup(group.group)}
                      accessibilityRole="button"
                      accessibilityState={{ expanded: open }}
                    >
                      <MobileIcon
                        name={FACILITY_GROUP_ICONS[group.group] ?? 'grid'}
                        size={18}
                        color={tokens.colors.primary}
                      />
                      <Text style={styles.facilityGroupTitle} numberOfLines={1}>
                        {groupLabel}
                      </Text>
                      <Text style={styles.facilityGroupCount}>{group.codes.length}</Text>
                      <MobileIcon
                        name={open ? 'chevron-down' : 'chevron-right'}
                        size={18}
                        color={tokens.colors.textSecondary}
                      />
                    </Pressable>
                    {open
                      ? group.codes.map((code, index) => {
                          const isCustom = code.startsWith('custom:');
                          const label = isCustom
                            ? code.slice('custom:'.length)
                            : t.masters.facilities[
                                code as keyof typeof t.masters.facilities
                              ] || code;
                          return (
                            <View
                              key={`${group.group}-${code}-${index}`}
                              style={[
                                styles.facilityRow,
                                index < group.codes.length - 1
                                  ? styles.facilityRowDivider
                                  : null,
                              ]}
                            >
                              <MobileIcon
                                name={isCustom ? 'note' : amenityIcon(code, group.group)}
                                size={20}
                                color={tokens.colors.textSecondary}
                              />
                              <Text style={styles.facilityRowLabel}>{label}</Text>
                            </View>
                          );
                        })
                      : null}
                  </View>
                );
              })}
            </View>
          ) : (
            <Text style={styles.muted}>{copy.notSpecified}</Text>
          )}

          <Text style={[styles.sectionHeading, { marginTop: 16 }]}>{rd.houseRules}</Text>
          <View style={styles.rulesRow}>
            <View style={styles.ruleCard}>
              <MobileIcon name="paw" size={18} color={tokens.colors.primary} />
              <Text style={styles.ruleText}>{rd.petsInquire}</Text>
            </View>
            <View style={styles.ruleCard}>
              <MobileIcon name="warning" size={18} color={tokens.colors.primary} />
              <Text style={styles.ruleText}>{rd.smokingUnspecified}</Text>
            </View>
          </View>
        </View>
        ) : null}

        {showLocation ? (
        <View style={[styles.sectionCard, cardElevation, { backgroundColor: theme.surface }]}>
          <View style={styles.facilitySectionHead}>
            <Text style={styles.sectionHeading}>{rd.location}</Text>
            {nearby.length ? (
              <Text style={styles.facilitySummary}>
                {interpolate(rd.nearbySummary, {
                  count: nearby.length,
                  groups: nearbyByCategory.length,
                })}
              </Text>
            ) : null}
          </View>

          {nearbyByCategory.length > 1 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.nearbyChips}
            >
              <Pressable
                onPress={() => setNearbyFilter(NEARBY_FILTER_ALL)}
                style={[
                  styles.nearbyChip,
                  nearbyFilter === NEARBY_FILTER_ALL ? styles.nearbyChipOn : null,
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: nearbyFilter === NEARBY_FILTER_ALL }}
              >
                <Text
                  style={[
                    styles.nearbyChipText,
                    nearbyFilter === NEARBY_FILTER_ALL ? styles.nearbyChipTextOn : null,
                  ]}
                >
                  {interpolate(rd.nearbyFilterAll, { count: nearby.length })}
                </Text>
              </Pressable>
              {nearbyByCategory.map(({ code, count }) => {
                const color = categoryColors[code];
                const selected = nearbyFilter === code;
                return (
                  <Pressable
                    key={code}
                    onPress={() => setNearbyFilter(code)}
                    style={[
                      styles.nearbyChip,
                      selected
                        ? { backgroundColor: `${color}18`, borderColor: color }
                        : null,
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                  >
                    <MobileIcon
                      name={nearbyCategoryIcons[code]}
                      size={14}
                      color={selected ? color : tokens.colors.textSecondary}
                    />
                    <Text
                      style={[
                        styles.nearbyChipText,
                        selected ? { color, fontWeight: '700' } : null,
                      ]}
                    >
                      {cr.nearbyCategories[code]} {count}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}

          {mapLat != null && mapLng != null && !Number.isNaN(mapLat) && !Number.isNaN(mapLng) ? (
            <View style={styles.mapWrap}>
              <NearbyPlacesMap
                latitude={mapLat}
                longitude={mapLng}
                places={(filteredNearby as NearbyPlace[]).slice(0, 24)}
                selectedIds={filteredNearby
                  .slice(0, 24)
                  .map((p) => p.placeId || p.name)}
                readOnly
                compact
                mapHeight={180}
              />
              <MobileButton variant="outline" onPress={openMaps} style={styles.mapBtn}>
                {rd.openInMaps}
              </MobileButton>
            </View>
          ) : (
            <Text style={styles.muted}>{copy.notSpecified}</Text>
          )}
          {filteredNearby.length ? (
            <View style={styles.nearbyList}>
              {filteredNearby.slice(0, 16).map((place, index) => {
                const cat = nearbyCategory(place.type || '');
                const tone = categoryColors[cat];
                const dist =
                  place.distanceMeters != null
                    ? place.distanceMeters >= 1000
                      ? `${(place.distanceMeters / 1000).toFixed(1)} km`
                      : `${place.distanceMeters} m`
                    : null;
                const label = formatTransitPlaceName(
                  place.name,
                  place.type,
                  place.vicinity,
                );
                return (
                  <View key={`${place.placeId || place.name}-${index}`} style={styles.nearbyRow}>
                    <View style={[styles.nearbyIconWrap, { backgroundColor: `${tone}14` }]}>
                      <MobileIcon name={nearbyCategoryIcons[cat]} size={16} color={tone} />
                    </View>
                    <Text style={styles.nearbyName} numberOfLines={1}>
                      {label}
                    </Text>
                    {dist ? <Text style={styles.nearbyDist}>{dist}</Text> : null}
                  </View>
                );
              })}
            </View>
          ) : nearby.length ? (
            <Text style={styles.muted}>{rd.nearbyFilterEmpty}</Text>
          ) : null}
        </View>
        ) : null}

        {showContact ? (
        <View style={[styles.sectionCard, cardElevation, { backgroundColor: theme.surface }]}>
          <Text style={styles.sectionHeading}>{rd.listingProvider}</Text>
          {primaryContact ? (
            <View style={styles.contactRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {primaryContact.name.slice(0, 1).toUpperCase()}
                </Text>
              </View>
              <View style={styles.contactCopy}>
                <Text style={styles.contactName}>{primaryContact.name}</Text>
                <Text style={styles.contactMeta}>{rd.providerAgent}</Text>
              </View>
            </View>
          ) : (
            <Text style={styles.muted}>{copy.notSpecified}</Text>
          )}

          {isAgent ? (
            <View style={styles.metaBox}>
              <Text style={styles.metaLine}>
                {interpolate(rd.listingId, { id: `NK-${room.id}` })}
              </Text>
            </View>
          ) : null}
        </View>
        ) : null}

        {isAgent ? (
          <View style={[styles.internalCard, cardElevation]}>
            <Pressable
              style={styles.internalHeader}
              onPress={() => setInternalExpanded((v) => !v)}
              accessibilityRole="button"
              accessibilityState={{ expanded: internalExpanded }}
            >
              <View style={styles.internalLockBadge}>
                <MobileIcon name="lock" size={14} color="#FFFFFF" />
              </View>
              <View style={styles.internalHeaderCopy}>
                <Text style={styles.internalTitle}>{rd.internalInfo}</Text>
                <Text style={styles.internalHint} numberOfLines={2}>
                  {rd.internalOnlyHint}
                </Text>
              </View>
              <MobileIcon
                name={internalExpanded ? 'chevron-down' : 'chevron-right'}
                size={18}
                color={tokens.colors.textSecondary}
              />
            </Pressable>

            {internalExpanded ? (
              <View style={styles.internalBody}>
                {(
                  [
                    {
                      label: cr.listingTitle,
                      value: room.listingTitle?.trim() || copy.notSpecified,
                    },
                    room.roomId?.trim()
                      ? { label: cr.roomId, value: room.roomId.trim() }
                      : null,
                    {
                      label: cr.sourceSection,
                      value:
                        room.listingSourceCode === 'owner'
                          ? cr.sourceOwner
                          : room.listingSourceCode === 'co_agent'
                            ? cr.sourceCoAgent
                            : copy.notSpecified,
                    },
                    {
                      label: rd.internalProvider,
                      value:
                        room.contacts.find((c) => c.isPrimary)?.name ||
                        room.contacts[0]?.name ||
                        copy.notSpecified,
                    },
                    {
                      label: rd.internalNotes,
                      value: room.contacts.some((c) => c.note?.trim())
                        ? room.contacts
                            .filter((c) => c.note?.trim())
                            .map((c) => c.note!.trim())
                            .join(' · ')
                        : copy.notSpecified,
                    },
                    {
                      label: rd.internalVisibility,
                      value:
                        room.visibility === 'published'
                          ? cr.visibilityPublished
                          : room.visibility === 'private'
                            ? cr.visibilityPrivate
                            : copy.notSpecified,
                    },
                  ] as Array<{ label: string; value: string } | null>
                )
                  .filter(Boolean)
                  .map((row, index, list) => (
                    <View
                      key={row!.label}
                      style={[
                        styles.internalField,
                        index < list.length - 1 ? styles.internalFieldDivider : null,
                      ]}
                    >
                      <Text style={styles.internalLabel}>{row!.label}</Text>
                      <Text
                        style={[
                          styles.internalValue,
                          row!.value === copy.notSpecified
                            ? styles.internalValueMuted
                            : null,
                        ]}
                        selectable
                      >
                        {row!.value}
                      </Text>
                    </View>
                  ))}
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={{ height: isAgent ? 100 : 24 }} />
      </ScrollView>

      {isAgent ? (
        <View style={[styles.sticky, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
          <View style={styles.agentStickyRow}>
            <MobileButton onPress={onShare} style={styles.agentStickyBtn}>
              {rd.shareRoom}
            </MobileButton>
          </View>
        </View>
      ) : null}

      <MobilePhotoViewer
        visible={viewerOpen && showPhotos}
        mode="gallery"
        items={photos.map((p) => ({ uri: p.mediaUrl }))}
        index={photoIndex}
        onIndexChange={setPhotoIndex}
        labels={viewerLabels}
        onClose={() => setViewerOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 16, gap: 12 },
  previewBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 0,
    backgroundColor: '#0F172A',
  },
  previewBannerText: {
    flex: 1,
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 20,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  previewClose: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 20,
    color: tokens.colors.brand[500],
    fontWeight: '700',
  },
  hero: { width: '100%', backgroundColor: '#E2E8F0', overflow: 'hidden' },
  heroSlide: { backgroundColor: '#E2E8F0' },
  heroEmpty: { alignItems: 'center', justifyContent: 'center', gap: 8 },
  heroEmptyText: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 20,
    color: tokens.colors.textSecondary,
  },
  photoOverlay: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: 'rgba(15,23,42,0.35)',
    padding: 16,
  },
  photoFallbackText: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 20,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  summaryCard: {
    marginHorizontal: 16,
    marginTop: -28,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    padding: 16,
    gap: 12,
  },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  propertyTitle: {
    flex: 1,
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 22,
    lineHeight: 32,
    fontWeight: '500',
    color: tokens.colors.textHeading,
  },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  locationText: {
    flex: 1,
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 20,
    color: tokens.colors.textSecondary,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusBadgeText: {
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
  shareReadyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  shareReadyText: {
    flex: 1,
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    lineHeight: 18,
    color: '#211E1E',
    fontWeight: '600',
  },
  shareReadyLink: {
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    lineHeight: 18,
    color: tokens.colors.accent,
    fontWeight: '700',
  },
  priceBox: {
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    padding: 12,
    gap: 2,
  },
  priceText: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 22,
    lineHeight: 32,
    fontWeight: '500',
    color: tokens.colors.textHeading,
  },
  priceHint: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 20,
    color: tokens.colors.textSecondary,
  },
  specsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  specItem: { width: '46%', flexDirection: 'row', alignItems: 'center', gap: 8 },
  specIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  specLabel: {
    flex: 1,
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 20,
    color: tokens.colors.textHeading,
    fontWeight: '600',
  },
  availabilityRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  availabilityValue: {
    flex: 1,
    fontFamily: tokens.typography.native.body,
    fontSize: 14,
    lineHeight: 21,
    color: tokens.colors.textHeading,
  },
  sectionCard: {
    marginHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    padding: 16,
    gap: 12,
  },
  sectionHeading: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 17,
    lineHeight: 26,
    fontWeight: '500',
    color: tokens.colors.textHeading,
  },
  aboutBody: {
    fontFamily: tokens.typography.native.body,
    fontSize: 14,
    lineHeight: 22,
    color: tokens.colors.textHeading,
  },
  readMore: {
    fontFamily: tokens.typography.native.body,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '700',
    color: tokens.colors.accent,
  },
  contractList: { gap: 8 },
  contractRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  contractRowOn: {
    borderColor: tokens.colors.brand[500],
    backgroundColor: '#FFFBEB',
  },
  contractCopy: { flex: 1, gap: 2 },
  contractTitle: {
    fontFamily: tokens.typography.native.body,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '700',
    color: tokens.colors.textHeading,
  },
  contractPrice: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 20,
    color: tokens.colors.textSecondary,
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: tokens.colors.divider,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: {
    borderColor: tokens.colors.success,
    backgroundColor: tokens.colors.success,
  },
  costBlock: { gap: 8, paddingTop: 4 },
  costHeading: {
    fontFamily: tokens.typography.native.body,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '700',
    color: tokens.colors.textHeading,
  },
  costRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  costLabel: {
    flex: 1,
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 20,
    color: tokens.colors.textSecondary,
  },
  costValue: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '600',
    color: tokens.colors.textHeading,
  },
  costTotalRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: tokens.colors.border,
    paddingTop: 8,
    marginTop: 4,
  },
  costTotalLabel: {
    fontFamily: tokens.typography.native.body,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '700',
    color: tokens.colors.textHeading,
  },
  costTotalValue: {
    fontFamily: tokens.typography.native.body,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '700',
    color: tokens.colors.textHeading,
  },
  costNote: {
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    lineHeight: 18,
    color: tokens.colors.textSecondary,
  },
  facilitySectionHead: { gap: 4, marginBottom: 4 },
  facilitySummary: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 20,
    color: tokens.colors.textSecondary,
  },
  facilityGroups: { gap: 10 },
  facilityGroup: {
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: tokens.colors.white,
  },
  facilityGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#F8FAFC',
  },
  facilityGroupHeaderOpen: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tokens.colors.border,
  },
  facilityGroupTitle: {
    flex: 1,
    fontFamily: tokens.typography.native.body,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '700',
    color: tokens.colors.textHeading,
  },
  facilityGroupCount: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '600',
    color: tokens.colors.textSecondary,
    minWidth: 20,
    textAlign: 'right',
  },
  facilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  facilityRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tokens.colors.border,
  },
  facilityRowLabel: {
    flex: 1,
    fontFamily: tokens.typography.native.body,
    fontSize: 14,
    lineHeight: 21,
    color: tokens.colors.textHeading,
  },
  rulesRow: { flexDirection: 'row', gap: 10 },
  ruleCard: {
    flex: 1,
    gap: 8,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: 12,
    padding: 12,
  },
  ruleText: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 20,
    color: tokens.colors.textHeading,
  },
  mapWrap: { gap: 10, borderRadius: 12, overflow: 'hidden' },
  mapBtn: { alignSelf: 'stretch' },
  nearbyChips: { gap: 8, paddingVertical: 4 },
  nearbyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.white,
  },
  nearbyChipOn: {
    backgroundColor: '#FFFBEB',
    borderColor: tokens.colors.brand[500],
  },
  nearbyChipText: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 20,
    color: tokens.colors.textSecondary,
  },
  nearbyChipTextOn: {
    color: tokens.colors.primary,
    fontWeight: '700',
  },
  nearbyList: { gap: 8 },
  nearbyRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  nearbyIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nearbyName: {
    flex: 1,
    fontFamily: tokens.typography.native.body,
    fontSize: 14,
    lineHeight: 21,
    color: tokens.colors.textHeading,
  },
  nearbyDist: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 20,
    color: tokens.colors.textSecondary,
  },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: tokens.typography.native.body,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700',
    color: '#211E1E',
  },
  contactCopy: { flex: 1, gap: 2 },
  contactName: {
    fontFamily: tokens.typography.native.body,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '700',
    color: tokens.colors.textHeading,
  },
  contactMeta: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 20,
    color: tokens.colors.textSecondary,
  },
  metaBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  metaLine: {
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    lineHeight: 18,
    color: tokens.colors.textSecondary,
  },
  internalCard: {
    marginHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: '#F8FAFC',
    overflow: 'hidden',
  },
  internalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  internalLockBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: tokens.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  internalHeaderCopy: { flex: 1, gap: 2 },
  internalTitle: {
    fontFamily: tokens.typography.native.body,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '700',
    color: tokens.colors.textHeading,
  },
  internalHint: {
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    lineHeight: 18,
    color: tokens.colors.textSecondary,
  },
  internalBody: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: tokens.colors.border,
    backgroundColor: tokens.colors.white,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  internalField: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 12,
  },
  internalFieldDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tokens.colors.border,
  },
  internalLabel: {
    width: 112,
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 20,
    color: tokens.colors.textSecondary,
  },
  internalValue: {
    flex: 1,
    fontFamily: tokens.typography.native.body,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '600',
    color: tokens.colors.textHeading,
    textAlign: 'right',
  },
  internalValueMuted: {
    fontWeight: '400',
    color: tokens.colors.textSecondary,
  },
  muted: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 20,
    color: tokens.colors.textSecondary,
  },
  sticky: {
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 20 : 12,
  },
  agentStickyRow: { flexDirection: 'row', gap: 10 },
  agentStickyBtn: { flex: 1 },
});
