import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Pressable,
  Platform,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useLocale } from '@nestyk/i18n';
import { MobileBrandLoader, MobileButton, MobileIcon, tokens, useMobileTheme } from '@nestyk/ui/native';
import { listingSourceStyle } from '../listing-source';
import { formatBedroomDisplay } from '../bedroom-label';
import type { AppIconName } from '@nestyk/ui/native';

export type AgentListingsViewMode = 'grid' | 'row';

export type AgentListingCard = {
  id: number;
  listingTitle: string | null;
  visibility: 'private' | 'published' | null;
  listingSourceCode?: 'co_agent' | 'owner' | null;
  roomStatusCode: string | null;
  property: {
    id: number;
    name: string;
    district: string;
    province: string;
  } | null;
  propertyOwner: {
    id: number;
    name: string;
    phone: string;
  } | null;
  contact?: {
    id: number;
    name: string;
    phone: string;
  } | null;
  prices: Array<{ contractTypeId?: number; contractTypeCode: string; price: number }>;
  coverMediaUrl: string | null;
  bedroomCount?: string | null;
  roomSizeSqm?: string | null;
  floor?: string | null;
  updatedAt?: string | null;
};

export interface MobileAgentListingsBodyProps {
  items: AgentListingCard[];
  viewMode?: AgentListingsViewMode;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onRoomPress?: (id: number) => void;
  filtered?: boolean;
  onCreatePress?: () => void;
}

function interpolate(template: string, vars: Record<string, string | number>) {
  return Object.entries(vars).reduce(
    (acc, [key, value]) => acc.replace(`{${key}}`, String(value)),
    template,
  );
}

function minPrice(items: AgentListingCard['prices']): number | null {
  if (!items.length) return null;
  return Math.min(...items.map((item) => item.price));
}

function Cover({ uri, fallback, style }: { uri: string | null; fallback: string; style?: object }) {
  const [failed, setFailed] = React.useState(false);
  const source = React.useMemo(() => (uri ? { uri } : undefined), [uri]);
  React.useEffect(() => setFailed(false), [uri]);
  if (!uri || failed) {
    return (
      <View style={[styles.cover, styles.coverFallback, style]}>
        <Text style={styles.coverFallbackText}>{fallback}</Text>
      </View>
    );
  }
  return (
    <Image
      source={source}
      resizeMode="cover"
      style={[styles.cover, style]}
      onError={() => setFailed(true)}
    />
  );
}

/** Soft fill on photo (row overlay) vs white outline on grid. */
function statusTone(
  code: string | null,
  variant: 'outline' | 'soft' = 'outline',
): {
  dot: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
} {
  if (code === 'available') {
    if (variant === 'soft') {
      return {
        dot: tokens.colors.success,
        badgeBg: tokens.colors.subtle.successBg,
        badgeBorder: tokens.colors.subtle.successBg,
        badgeText: tokens.colors.subtle.successFg,
      };
    }
    return {
      dot: tokens.colors.success,
      badgeBg: tokens.colors.white,
      badgeBorder: tokens.colors.subtle.successFg,
      badgeText: tokens.colors.subtle.successFg,
    };
  }
  if (code === 'rented') {
    if (variant === 'soft') {
      return {
        dot: tokens.colors.icon.secondary,
        badgeBg: tokens.colors.subtle.neutralBg,
        badgeBorder: tokens.colors.subtle.neutralBg,
        badgeText: tokens.colors.icon.secondary,
      };
    }
    return {
      dot: tokens.colors.icon.secondary,
      badgeBg: tokens.colors.white,
      badgeBorder: tokens.colors.icon.secondary,
      badgeText: tokens.colors.icon.secondary,
    };
  }
  if (code === 'needs_edit') {
    if (variant === 'soft') {
      return {
        dot: tokens.colors.danger,
        badgeBg: tokens.colors.subtle.dangerBg,
        badgeBorder: tokens.colors.subtle.dangerBg,
        badgeText: tokens.colors.subtle.dangerFg,
      };
    }
    return {
      dot: tokens.colors.danger,
      badgeBg: tokens.colors.white,
      badgeBorder: tokens.colors.subtle.dangerFg,
      badgeText: tokens.colors.subtle.dangerFg,
    };
  }
  if (variant === 'soft') {
    return {
      dot: tokens.colors.warning,
      badgeBg: tokens.colors.subtle.warningBg,
      badgeBorder: tokens.colors.subtle.warningBg,
      badgeText: tokens.colors.subtle.warningFg,
    };
  }
  return {
    dot: tokens.colors.warning,
    badgeBg: tokens.colors.white,
    badgeBorder: tokens.colors.subtle.warningFg,
    badgeText: tokens.colors.subtle.warningFg,
  };
}

function useListingLabels(item: AgentListingCard) {
  const { t } = useLocale();
  const copy = t.agent.listings;
  const cr = t.agent.createRoom;

  const title = item.listingTitle || item.property?.name || `#${item.id}`;
  const location = item.property?.district || item.property?.province || '';
  const price = minPrice(item.prices);
  const priceAmount =
    price != null ? interpolate(copy.rentAmount, { price: price.toLocaleString() }) : null;
  const pricePeriod = price != null ? copy.rentPeriod : null;
  const priceLabel =
    price != null ? interpolate(copy.rentPerMonthShort, { price: price.toLocaleString() }) : null;
  const statusLabel =
    copy[item.roomStatusCode as keyof typeof copy] || item.roomStatusCode || copy.notSpecified;
  const sourceStyle = listingSourceStyle(item.listingSourceCode);
  const sourceLabel =
    item.listingSourceCode === 'owner'
      ? cr.sourceOwner
      : item.listingSourceCode === 'co_agent'
        ? cr.sourceCoAgent
        : copy.notSpecified;
  const sourceLabelShort =
    item.listingSourceCode === 'owner'
      ? cr.sourceOwnerShort
      : item.listingSourceCode === 'co_agent'
        ? cr.sourceCoAgentShort
        : null;
  const sourceIcon: AppIconName | null = sourceStyle?.icon ?? null;
  const sourceIconColor = sourceStyle?.iconColor ?? null;
  const sourceIconBg = sourceStyle?.iconBg ?? null;

  const bedsLabel = formatBedroomDisplay(
    item.bedroomCount,
    t.masters.roomTypes.studio,
  );
  const sqmRaw = item.roomSizeSqm?.trim() || null;
  const floorRaw = item.floor?.trim() || null;
  const sqmLabel = sqmRaw ? interpolate(copy.specSqm, { size: sqmRaw }) : null;
  const floorLabel = floorRaw ? interpolate(copy.specFloor, { floor: floorRaw }) : null;

  return {
    title,
    location,
    priceLabel,
    priceAmount,
    pricePeriod,
    statusLabel,
    sourceLabel,
    sourceLabelShort,
    sourceIcon,
    sourceIconColor,
    sourceIconBg,
    bedsLabel,
    sqmLabel,
    floorLabel,
  };
}

function MetaRow({
  icon,
  label,
  color,
  style,
}: {
  icon: 'map-pin' | 'bed' | 'room-size' | 'stairs';
  label: string;
  color: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.metaRow, style]}>
      <MobileIcon name={icon} size={13} color={color} />
      <Text style={[styles.metaText, { color }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/** Specs: beds · size · floor with vertical rules and unit labels. */
function SpecsMetaRow({
  bedsLabel,
  sqmLabel,
  floorLabel,
  color,
  hideFloor = false,
}: {
  bedsLabel: string | null;
  sqmLabel: string | null;
  floorLabel: string | null;
  color: string;
  hideFloor?: boolean;
}) {
  const parts: Array<{ key: string; icon: 'bed' | 'room-size' | 'stairs'; label: string }> = [];
  if (bedsLabel) parts.push({ key: 'bed', icon: 'bed', label: bedsLabel });
  if (sqmLabel) parts.push({ key: 'sqm', icon: 'room-size', label: sqmLabel });
  if (floorLabel && !hideFloor) parts.push({ key: 'floor', icon: 'stairs', label: floorLabel });
  return (
    <View style={styles.specsRow}>
      {parts.length ? (
        parts.map((part, index) => (
          <React.Fragment key={part.key}>
            {index > 0 ? <View style={styles.specDivider} /> : null}
            <View style={styles.specPart}>
              <MobileIcon name={part.icon} size={13} color={color} />
              <Text style={[styles.specText, { color }]} numberOfLines={1}>
                {part.label}
              </Text>
            </View>
          </React.Fragment>
        ))
      ) : (
        <Text style={[styles.specText, { color }]}>{' '}</Text>
      )}
    </View>
  );
}

function StatusBadge({
  label,
  code,
  compact = false,
  variant = 'outline',
}: {
  label: string;
  code: string | null;
  compact?: boolean;
  variant?: 'outline' | 'soft';
}) {
  const tone = statusTone(code, variant);
  return (
    <View
      style={[
        styles.statusBadge,
        compact && styles.statusBadgeCompact,
        {
          backgroundColor: tone.badgeBg,
          borderColor: tone.badgeBorder,
        },
      ]}
    >
      <View style={[styles.statusDot, compact && styles.statusDotCompact, { backgroundColor: tone.dot }]} />
      <Text
        style={[styles.statusBadgeText, compact && styles.statusBadgeTextCompact, { color: tone.badgeText }]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

function GridCard({
  item,
  cardWidth,
  onPress,
}: {
  item: AgentListingCard;
  cardWidth: number;
  onPress: () => void;
}) {
  const { theme } = useMobileTheme();
  const { t } = useLocale();
  const copy = t.agent.listings;
  const labels = useListingLabels(item);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${copy.viewRoom}: ${labels.title}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.gridCard,
        { width: cardWidth, backgroundColor: theme.surface, borderColor: theme.border, opacity: pressed ? 0.92 : 1 },
      ]}
      {...(Platform.OS === 'android' ? { android_ripple: { color: 'rgba(0,0,0,0.06)' } } : {})}
    >
      <View style={styles.gridImageWrap}>
        <Cover
          uri={item.coverMediaUrl}
          fallback={item.property?.name?.slice(0, 1) ?? 'R'}
          style={styles.gridCover}
        />
        <View style={styles.gridStatusSlot}>
          <StatusBadge
            label={String(labels.statusLabel)}
            code={item.roomStatusCode}
            compact
            variant="soft"
          />
        </View>
      </View>
      <View style={styles.gridBody}>
        <Text style={[styles.gridTitle, { color: theme.textHeading }]} numberOfLines={1}>
          {labels.title}
        </Text>
        <View style={styles.gridLocationSlot}>
          {labels.location ? (
            <MetaRow icon="map-pin" label={labels.location} color={theme.textSecondary} />
          ) : null}
        </View>
        <SpecsMetaRow
          bedsLabel={labels.bedsLabel}
          sqmLabel={labels.sqmLabel}
          floorLabel={labels.floorLabel}
          color={theme.textSecondary}
          hideFloor
        />
        <View style={styles.gridFooter}>
          {labels.sourceIcon ? (
            <View
              style={[
                styles.rowSourceIcon,
                labels.sourceIconBg ? { backgroundColor: labels.sourceIconBg } : null,
              ]}
              accessibilityLabel={labels.sourceLabelShort ?? labels.sourceLabel}
            >
              <MobileIcon
                name={labels.sourceIcon}
                size={12}
                color={labels.sourceIconColor ?? theme.textSecondary}
              />
            </View>
          ) : (
            <View style={styles.rowSourceIcon} />
          )}
          {labels.priceAmount ? (
            <View style={styles.rowPriceRow}>
              <Text style={[styles.gridPriceAmount, { color: theme.textHeading }]} numberOfLines={1}>
                {labels.priceAmount}
              </Text>
              {labels.pricePeriod ? (
                <Text style={[styles.rowPricePeriod, { color: theme.textSecondary }]} numberOfLines={1}>
                  {` ${labels.pricePeriod}`}
                </Text>
              ) : null}
            </View>
          ) : (
            <View style={styles.rowPriceRow} />
          )}
        </View>
      </View>
    </Pressable>
  );
}

function RowItem({
  item,
  onPress,
}: {
  item: AgentListingCard;
  onPress: () => void;
}) {
  const { theme } = useMobileTheme();
  const { t } = useLocale();
  const copy = t.agent.listings;
  const labels = useListingLabels(item);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${copy.viewRoom}: ${labels.title}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.rowCard,
        {
          backgroundColor: theme.surface,
          borderColor: theme.border,
          opacity: pressed ? 0.92 : 1,
        },
      ]}
      {...(Platform.OS === 'android' ? { android_ripple: { color: 'rgba(0,0,0,0.06)' } } : {})}
    >
      <View style={styles.rowThumbWrap}>
        <Cover
          uri={item.coverMediaUrl}
          fallback={item.property?.name?.slice(0, 1) ?? 'R'}
          style={styles.rowThumb}
        />
        <View style={styles.rowStatusSlot}>
          <StatusBadge
            label={String(labels.statusLabel)}
            code={item.roomStatusCode}
            compact
            variant="soft"
          />
        </View>
      </View>
      <View style={styles.rowBody}>
        <Text style={[styles.rowTitle, { color: theme.textHeading }]} numberOfLines={1}>
          {labels.title}
        </Text>
        {labels.location ? (
          <MetaRow icon="map-pin" label={labels.location} color={theme.textSecondary} />
        ) : null}
        <SpecsMetaRow
          bedsLabel={labels.bedsLabel}
          sqmLabel={labels.sqmLabel}
          floorLabel={labels.floorLabel}
          color={theme.textSecondary}
        />
        <View style={styles.rowFooter}>
          {labels.sourceLabelShort && labels.sourceIcon ? (
            <View style={styles.rowSource}>
              <View
                style={[
                  styles.rowSourceIcon,
                  labels.sourceIconBg ? { backgroundColor: labels.sourceIconBg } : null,
                ]}
              >
                <MobileIcon
                  name={labels.sourceIcon}
                  size={12}
                  color={labels.sourceIconColor ?? theme.textSecondary}
                />
              </View>
              <Text
                style={[
                  styles.rowSourceText,
                  { color: labels.sourceIconColor ?? theme.textSecondary },
                ]}
                numberOfLines={1}
              >
                {labels.sourceLabelShort}
              </Text>
            </View>
          ) : (
            <View style={styles.rowSource} />
          )}
          {labels.priceAmount ? (
            <View style={styles.rowPriceRow}>
              <Text style={[styles.rowPriceAmount, { color: theme.textHeading }]}>
                {labels.priceAmount}
              </Text>
              {labels.pricePeriod ? (
                <Text style={[styles.rowPricePeriod, { color: theme.textSecondary }]}>
                  {` ${labels.pricePeriod}`}
                </Text>
              ) : null}
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

export const MobileAgentListingsBody: React.FC<MobileAgentListingsBodyProps> = ({
  items,
  viewMode = 'row',
  loading = false,
  error = null,
  onRetry,
  onRoomPress,
  filtered,
  onCreatePress,
}) => {
  const { t } = useLocale();
  const { theme } = useMobileTheme();
  const copy = t.agent.listings;
  const muted = theme.textSecondary;
  const { width } = useWindowDimensions();
  const gridGap = 12;
  const gridCardWidth = Math.floor((width - 32 - gridGap) / 2);

  if (loading) {
    return (
      <MobileBrandLoader size="md" fill done={false} />
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={[styles.emptyTitle, { color: theme.textHeading }]}>{copy.loadError}</Text>
        <Text style={[styles.emptyBody, { color: muted }]}>{error}</Text>
        {onRetry ? (
          <View style={styles.ctaWrap}>
            <MobileButton onPress={onRetry}>{copy.retry}</MobileButton>
          </View>
        ) : null}
      </View>
    );
  }

  if (!items.length) {
    return (
      <View style={styles.centered}>
        <Text style={[styles.emptyBody, { color: muted }]}>{t.common.noData}</Text>
        {onCreatePress && !filtered ? (
          <View style={styles.ctaWrap}>
            <MobileButton onPress={onCreatePress}>{copy.emptyCta}</MobileButton>
          </View>
        ) : null}
      </View>
    );
  }

  if (viewMode === 'grid') {
    return (
      <View style={[styles.gridList, { gap: gridGap }]}>
        {items.map((item) => (
          <GridCard
            key={item.id}
            item={item}
            cardWidth={gridCardWidth}
            onPress={() => onRoomPress?.(item.id)}
          />
        ))}
      </View>
    );
  }

  return (
    <View style={styles.rowList}>
      {items.map((item) => (
        <RowItem
          key={item.id}
          item={item}
          onPress={() => onRoomPress?.(item.id)}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  centered: {
    paddingVertical: 48,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
    textAlign: 'center',
  },
  emptyBody: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    maxWidth: 280,
  },
  ctaWrap: {
    alignSelf: 'stretch',
    marginTop: 8,
  },
  cover: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F1F5F9',
  },
  coverFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverFallbackText: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 28,
    lineHeight: 40,
    color: tokens.colors.roles.agent,
  },
  gridList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingBottom: 24,
  },
  gridCard: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  gridImageWrap: {
    aspectRatio: 4 / 3,
    width: '100%',
  },
  gridCover: {
    borderTopLeftRadius: 13,
    borderTopRightRadius: 13,
  },
  gridStatusSlot: {
    position: 'absolute',
    left: 6,
    bottom: 6,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusBadgeCompact: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    gap: 4,
    alignSelf: 'flex-start',
  },
  statusBadgeText: {
    fontFamily: tokens.typography.native.body,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '700',
  },
  statusBadgeTextCompact: {
    fontSize: 10,
    lineHeight: 15,
  },
  gridBody: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 4,
  },
  gridTitle: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '700',
  },
  gridLocationSlot: {
    minHeight: 18,
    justifyContent: 'center',
  },
  gridFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 2,
    minHeight: 22,
    minWidth: 0,
  },
  gridPriceAmount: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minWidth: 0,
    flexWrap: 'nowrap',
  },
  metaText: {
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    lineHeight: 18,
    flexShrink: 1,
  },
  specsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'nowrap',
    gap: 0,
    minWidth: 0,
    minHeight: 18,
  },
  specPart: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 1,
    minWidth: 0,
  },
  specDivider: {
    width: StyleSheet.hairlineWidth,
    height: 12,
    backgroundColor: tokens.colors.divider,
    marginHorizontal: 8,
    flexShrink: 0,
  },
  specText: {
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    lineHeight: 18,
    flexShrink: 1,
  },
  metaDot: {
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    lineHeight: 18,
    marginHorizontal: 1,
    flexShrink: 0,
  },
  rowList: {
    gap: 12,
    paddingBottom: 24,
  },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  rowThumbWrap: {
    width: 96,
    height: 96,
    borderRadius: 12,
    overflow: 'hidden',
    flexShrink: 0,
    alignSelf: 'center',
  },
  rowThumb: {
    borderRadius: 12,
  },
  rowStatusSlot: {
    position: 'absolute',
    left: 6,
    bottom: 6,
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
    gap: 4,
    justifyContent: 'center',
  },
  rowTitle: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '700',
  },
  rowFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 2,
    minWidth: 0,
  },
  rowSource: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
    minWidth: 0,
  },
  rowSourceIcon: {
    width: 20,
    height: 20,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  rowSourceText: {
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
    flexShrink: 1,
  },
  rowPriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexShrink: 0,
  },
  rowPriceAmount: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '700',
  },
  rowPricePeriod: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '400',
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusDotCompact: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
