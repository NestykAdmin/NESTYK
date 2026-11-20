import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocale } from '@nestyk/i18n';
import { MobileButton, MobileIcon, MobileInput, tokens, useMobileTheme } from '@nestyk/ui/native';
import { interpolate } from '@nestyk/feature-listing';
import {
  SELF_OWNER_ROOMS_PAGE_SIZE,
  clampPage,
  countSelfOwnerRooms,
  filterSelfOwnerRooms,
  type SelfOwnerRoomFilter,
} from '../../lib/self-owner-rooms';
import { MobileSelfOwnerRoomCard } from './MobileSelfOwnerRoomCard';
import { SelfOwnerRoomDetailModal } from './SelfOwnerRoomDetailModal';
import type { SelfOwnerRoomsPageProps } from './SelfOwnerRoomsPage.types';

const FILTERS: SelfOwnerRoomFilter[] = ['all', 'occupied', 'listed', 'unlisted'];
const { subtle } = tokens.colors;

/**
 * Self owner rooms list on the phone (UI round, 19 Nov 2026, ClickUp z8rcteng6c): search, status chips with counts,
 * room cards ten per page. Newest first, like the agent's phone list; a card opens the room detail (edit, publish).
 */
export function MobileSelfOwnerRoomsScreen({
  rooms,
  status,
  isDemoPreview,
  initialQuery = '',
  initialFilter = 'all',
  onAddListing,
  ownerContact,
}: SelfOwnerRoomsPageProps) {
  const { t } = useLocale();
  const { theme } = useMobileTheme();
  const copy = t.selfOwnerRooms;
  const shared = t.selfOwnerDashboard;
  const ink = theme.screenTitle;
  const muted = theme.textSecondary;

  const [query, setQuery] = useState(initialQuery);
  const [filter, setFilter] = useState<SelfOwnerRoomFilter>(initialFilter);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);

  const counts = useMemo(() => countSelfOwnerRooms(rooms), [rooms]);
  const results = useMemo(() => filterSelfOwnerRooms(rooms, query, filter, 'updated_desc'), [rooms, query, filter]);
  const pages = Math.max(1, Math.ceil(results.length / SELF_OWNER_ROOMS_PAGE_SIZE));
  const current = clampPage(page, results.length);
  const shown = results.slice((current - 1) * SELF_OWNER_ROOMS_PAGE_SIZE, current * SELF_OWNER_ROOMS_PAGE_SIZE);
  const small = [styles.small, { color: muted }];
  // Counts only once the rooms are in: no "0" while loading or after an error.
  const ready = status === 'available' || status === 'demo';

  const list = () => {
    if (status === 'error') return <Text style={[styles.small, { color: subtle.dangerFg }]}>{shared.sectionError}</Text>;
    if (status === 'loading') return <ActivityIndicator color={theme.spinner} accessibilityLabel={t.common.loading} />;
    if (rooms.length === 0) return <Text style={small}>{shared.noRooms}</Text>;
    if (results.length === 0) {
      return (
        <View style={styles.empty}>
          <Text style={small}>{copy.noMatch}</Text>
          <Pressable
            testID="so-clear"
            accessibilityRole="button"
            onPress={() => {
              setQuery('');
              setFilter('all');
              setPage(1);
            }}
            style={[styles.outline, { borderColor: theme.border }]}
          >
            <Text style={[styles.small, { color: ink }]}>{copy.clearFilters}</Text>
          </Pressable>
        </View>
      );
    }
    return shown.map((room) => (
      <MobileSelfOwnerRoomCard
        key={room.id}
        room={room}
        testID={`so-room-${room.id}`}
        onPress={() => setSelected(room.id)}
      />
    ));
  };

  return (
    <View style={styles.root}>
      {isDemoPreview ? (
        <View style={[styles.demo, { backgroundColor: subtle.brandBg, borderColor: tokens.colors.icon.brand }]}>
          <MobileIcon name="info" size={14} color={subtle.warningFg} />
          <Text style={[styles.small, styles.flex, { color: subtle.warningFg }]}>{shared.demoNote}</Text>
        </View>
      ) : null}

      {onAddListing ? (
        <MobileButton onPress={onAddListing}>{`+ ${shared.addListing}`}</MobileButton>
      ) : (
        <MobileButton disabled onPress={() => {}}>
          {`+ ${shared.addListing} · ${shared.comingSoon}`}
        </MobileButton>
      )}

      <MobileInput
        value={query}
        placeholder={copy.searchPlaceholder}
        accessibilityLabel={copy.searchPlaceholder}
        onChangeText={(text) => {
          setQuery(text);
          setPage(1);
        }}
        returnKeyType="search"
      />

      <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel={copy.filterLabel}>
        {FILTERS.map((key) => {
          const selected = filter === key;
          return (
            <Pressable
              key={key}
              testID={`so-filter-${key}`}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => {
                setFilter(key);
                setPage(1);
              }}
              style={[styles.chip, { borderColor: selected ? ink : theme.border, backgroundColor: selected ? ink : theme.surface }]}
            >
              <Text style={[styles.small, { color: selected ? theme.surface : ink }]}>{key === 'all' ? copy.filterAll : shared.roomState[key]}</Text>
              {ready ? <Text style={[styles.small, { color: selected ? theme.surface : muted }]}>{String(counts[key])}</Text> : null}
            </Pressable>
          );
        })}
      </View>

      {ready ? <Text style={small}>{interpolate(copy.resultCount, { n: results.length })}</Text> : null}

      <View style={styles.list}>{list()}</View>

      {status !== 'error' && results.length > SELF_OWNER_ROOMS_PAGE_SIZE ? (
        <View style={styles.pager}>
          <Pressable
            testID="so-page-prev"
            accessibilityRole="button"
            disabled={current === 1}
            onPress={() => setPage(current - 1)}
            style={[styles.outline, { borderColor: theme.border, opacity: current === 1 ? 0.5 : 1 }]}
          >
            <Text style={[styles.small, { color: ink }]}>{copy.prev}</Text>
          </Pressable>
          <Text style={small}>{interpolate(copy.pageOf, { page: current, pages })}</Text>
          <Pressable
            testID="so-page-next"
            accessibilityRole="button"
            disabled={current === pages}
            onPress={() => setPage(current + 1)}
            style={[styles.outline, { borderColor: theme.border, opacity: current === pages ? 0.5 : 1 }]}
          >
            <Text style={[styles.small, { color: ink }]}>{copy.next}</Text>
          </Pressable>
        </View>
      ) : null}
      <SelfOwnerRoomDetailModal roomId={selected} onClose={() => setSelected(null)} ownerContact={ownerContact} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 12, paddingBottom: 24 },
  flex: { flex: 1, minWidth: 0 },
  demo: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1 },
  list: { gap: 10 },
  empty: { alignItems: 'flex-start', gap: 10 },
  outline: { minHeight: 40, paddingHorizontal: 14, justifyContent: 'center', borderRadius: 10, borderWidth: 1 },
  pager: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  small: { fontFamily: tokens.typography.native.body, fontSize: 13, lineHeight: 19 },
});
