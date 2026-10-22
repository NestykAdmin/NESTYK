import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { NearbyPlacesMap, type PlaceDetails, type PlaceSuggestion } from '@nestyk/feature-listing';
import { useLocale } from '@nestyk/i18n';
import { LEAD_MAX_PINS, type LeadPinInput } from '@nestyk/types';
import {
  MobileBottomSheet,
  WebFormSheet,
  MobileButton,
  MobileIcon,
  MobileInput,
  tokens,
  useMobileTheme,
} from '@nestyk/ui/native';
import { getPlaceDetails, reverseMapLocation, searchPlaces } from '../lib/places-api';

export const LEAD_RADIUS_OPTIONS = [1, 3, 5] as const;

const coordKey = (pin: Pick<LeadPinInput, 'latitude' | 'longitude'>) =>
  `${pin.latitude.toFixed(6)},${pin.longitude.toFixed(6)}`;

function toPin(place: PlaceDetails): LeadPinInput {
  return {
    placeId: place.placeId || null,
    name: place.name || place.address,
    latitude: place.latitude,
    longitude: place.longitude,
    province: place.province,
    district: place.district.replace(/^(เขต|อำเภอ)\s*/, '').trim() || null,
  };
}

/** Up to 3 ranked search pins (rank = list order) sharing one radius. */
export function LeadLocationsField({
  pins,
  radiusKm,
  legacyLabel,
  disabled,
  onChange,
  onRadiusChange,
}: {
  pins: LeadPinInput[];
  radiusKm: number;
  /** Pre-pin province/areas text, shown only while the lead has no pins. */
  legacyLabel?: string | null;
  disabled: boolean;
  onChange: (pins: LeadPinInput[]) => void;
  onRadiusChange: (km: number) => void;
}) {
  const { t } = useLocale();
  const c = t.agent.leads;
  const { theme } = useMobileTheme();
  /** Index being edited; `pins.length` means a new pin. */
  const [editing, setEditing] = useState<number | null>(null);
  const full = pins.length >= LEAD_MAX_PINS;

  const move = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= pins.length) return;
    const next = [...pins];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  const apply = (pin: LeadPinInput) => {
    if (editing == null) return;
    const next = [...pins];
    next[editing] = pin;
    onChange(next);
    setEditing(null);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.labelRow}>
        <MobileIcon name="map-pin" size={15} color={theme.textHeading} />
        <Text style={[styles.label, { color: theme.textHeading }]}>{c.pinsTitle}</Text>
        <Text style={[styles.count, { color: theme.textSecondary }]}>
          {pins.length}/{LEAD_MAX_PINS}
        </Text>
      </View>
      <Text style={[styles.hint, { color: theme.textSecondary }]}>{c.pinsHint}</Text>

      {!pins.length && legacyLabel ? (
        <View style={[styles.legacy, { borderColor: tokens.colors.brand[100] }]}>
          <MobileIcon name="warning" size={16} color={tokens.colors.brand[700]} />
          <Text style={[styles.hint, styles.flex, { color: theme.textHeading }]}>
            {c.legacyLocation.replace('{value}', legacyLabel)}
          </Text>
        </View>
      ) : null}

      {pins.map((pin, index) => (
        <View key={`${pin.placeId ?? coordKey(pin)}`} style={[styles.pinRow, { borderColor: theme.border }]}>
          <View style={[styles.rank, index === 0 ? styles.rankTop : { backgroundColor: tokens.colors.brand[50] }]}>
            <Text style={styles.rankText}>{index + 1}</Text>
          </View>
          <Pressable
            style={styles.flex}
            disabled={disabled}
            onPress={() => setEditing(index)}
            accessibilityRole="button"
            accessibilityLabel={`${c.pinRank.replace('{rank}', String(index + 1))}: ${pin.name}`}
          >
            <Text numberOfLines={1} style={[styles.pinName, { color: theme.textHeading }]}>
              {pin.name}
            </Text>
            <Text numberOfLines={1} style={[styles.hint, { color: theme.textSecondary }]}>
              {[pin.province, pin.district].filter(Boolean).join(' · ')}
            </Text>
          </Pressable>
          <View style={styles.actions}>
            <Pressable
              disabled={disabled || index === 0}
              onPress={() => move(index, -1)}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={c.pinMoveUp}
              style={[styles.iconBtn, (disabled || index === 0) && styles.dim]}
            >
              <View style={styles.flipped}>
                <MobileIcon name="chevron-down" size={16} color={theme.textHeading} />
              </View>
            </Pressable>
            <Pressable
              disabled={disabled || index === pins.length - 1}
              onPress={() => move(index, 1)}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={c.pinMoveDown}
              style={[styles.iconBtn, (disabled || index === pins.length - 1) && styles.dim]}
            >
              <MobileIcon name="chevron-down" size={16} color={theme.textHeading} />
            </Pressable>
            <Pressable
              disabled={disabled}
              onPress={() => onChange(pins.filter((_, i) => i !== index))}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={c.removePin}
              style={styles.iconBtn}
            >
              <MobileIcon name="trash" size={16} color={tokens.colors.danger} />
            </Pressable>
          </View>
        </View>
      ))}

      <MobileButton variant="outline" disabled={disabled || full} onPress={() => setEditing(pins.length)}>
        {c.addPin.replace('{count}', String(pins.length)).replace('{max}', String(LEAD_MAX_PINS))}
      </MobileButton>

      {pins.length ? (
        <View style={styles.radius}>
          <Text style={[styles.label, { color: theme.textHeading }]}>{c.sharedRadius}</Text>
          <View style={styles.chips}>
            {LEAD_RADIUS_OPTIONS.map((km) => {
              const on = radiusKm === km;
              return (
                <Pressable
                  key={km}
                  disabled={disabled}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on, disabled }}
                  onPress={() => onRadiusChange(km)}
                  style={[styles.chip, { borderColor: on ? tokens.colors.brand[500] : theme.border }, on && styles.chipOn]}
                >
                  <Text style={[styles.chipText, { color: theme.textHeading }]}>
                    {c.mapWithin.replace('{km}', String(km))}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      <LeadPinSheet
        visible={editing != null}
        rank={(editing ?? 0) + 1}
        initial={editing != null ? pins[editing] ?? null : null}
        others={pins.filter((_, i) => i !== editing)}
        radiusKm={radiusKm}
        onClose={() => setEditing(null)}
        onApply={apply}
      />
    </View>
  );
}

function LeadPinSheet({
  visible,
  rank,
  initial,
  others,
  radiusKm,
  onClose,
  onApply,
}: {
  visible: boolean;
  rank: number;
  initial: LeadPinInput | null;
  others: LeadPinInput[];
  radiusKm: number;
  onClose: () => void;
  onApply: (pin: LeadPinInput) => void;
}) {
  const { t, locale } = useLocale();
  const c = t.agent.leads;
  const { theme } = useMobileTheme();
  const [draft, setDraft] = useState<LeadPinInput | null>(null);
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<PlaceSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const request = useRef(0);

  useEffect(() => {
    if (!visible) return;
    request.current += 1;
    setDraft(initial);
    setQuery('');
    setItems([]);
    setError('');
    setResolving(false);
    // Reset only when the sheet opens; `initial` identity changes on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => {
    let active = true;
    setItems([]);
    if (query.trim().length < 2) {
      setSearching(false);
      return;
    }
    setSearching(true);
    setError('');
    const timer = setTimeout(() => {
      searchPlaces(query.trim(), locale)
        .then((rows) => { if (active) setItems(rows); })
        .catch(() => { if (active) setError(c.mapSearchFailed); })
        .finally(() => { if (active) setSearching(false); });
    }, 350);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, locale, attempt, c.mapSearchFailed]);

  const resolve = async (load: () => Promise<PlaceDetails>) => {
    const seq = ++request.current;
    setResolving(true);
    setError('');
    try {
      const place = await load();
      if (seq !== request.current) return;
      if (!place.province) {
        setError(c.mapThailand);
        return;
      }
      setDraft(toPin(place));
      setQuery('');
      setItems([]);
    } catch {
      if (seq === request.current) setError(c.mapSearchFailed);
    } finally {
      if (seq === request.current) setResolving(false);
    }
  };

  const confirm = () => {
    if (!draft) return;
    const duplicate = others.some(
      (pin) => (draft.placeId && pin.placeId === draft.placeId) || coordKey(pin) === coordKey(draft),
    );
    if (duplicate) {
      setError(c.pinDuplicate);
      return;
    }
    onApply(draft);
  };

  const showResults = searching || query.trim().length >= 2;

  return (
    <WebFormSheet label={c.pinSheetTitle.replace('{rank}', String(rank))}>
    <MobileBottomSheet visible={visible} onClose={onClose} maxHeight="92%" avoidKeyboard>
      <View style={styles.sheet}>
        <View style={styles.sheetHead}>
          <Text style={[styles.sheetTitle, { color: theme.textHeading }]}>
            {c.pinSheetTitle.replace('{rank}', String(rank))}
          </Text>
          <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel={t.common.cancel}>
            <MobileIcon name="close" size={18} color={theme.textSecondary} />
          </Pressable>
        </View>
        <MobileInput
          placeholder={c.mapSearchHint}
          value={query}
          leadingIcon="search"
          editable={!resolving}
          onChangeText={setQuery}
        />
        {showResults ? (
          <View style={[styles.results, { borderColor: theme.border }]}>
            {searching ? <ActivityIndicator color={tokens.colors.brand[500]} /> : null}
            {!searching && !error && !items.length ? (
              <Text style={[styles.hint, { color: theme.textSecondary }]}>{t.agent.createRoom.placesEmpty}</Text>
            ) : null}
            <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled style={styles.resultsScroll}>
              {items.map((item) => (
                <Pressable
                  key={item.placeId}
                  accessibilityRole="button"
                  disabled={resolving}
                  onPress={() => void resolve(() => getPlaceDetails(item.placeId, 'th'))}
                  style={[styles.resultRow, { borderColor: theme.border }]}
                >
                  <Text style={[styles.pinName, { color: theme.textHeading }]}>{item.name}</Text>
                  <Text style={[styles.hint, { color: theme.textSecondary }]}>{item.address}</Text>
                </Pressable>
              ))}
            </ScrollView>
            {items.length ? <Text style={[styles.hint, { color: theme.textSecondary }]}>Google Maps</Text> : null}
          </View>
        ) : (
          <>
            <View style={[styles.map, { backgroundColor: theme.background }]}>
              {draft ? (
                <NearbyPlacesMap
                  showRecenter={false}
                  latitude={draft.latitude}
                  longitude={draft.longitude}
                  markerTitle={draft.name}
                  radiusKm={radiusKm}
                  places={[]}
                  selectedIds={[]}
                  customMode
                  readOnly={resolving}
                  apiKey={process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY}
                  onMapPress={(lat, lng) => void resolve(() => reverseMapLocation(lat, lng))}
                />
              ) : (
                <View style={[styles.mapEmpty, { borderColor: theme.border }]}>
                  <MobileIcon name="map-pin" size={32} color={theme.textSecondary} />
                  <Text style={[styles.hint, styles.center, { color: theme.textSecondary }]}>{c.mapSearchHint}</Text>
                </View>
              )}
              {resolving ? (
                <View style={styles.mapBusy}>
                  <ActivityIndicator color={tokens.colors.brand[500]} />
                </View>
              ) : null}
            </View>
            {draft ? (
              <View style={styles.draft}>
                <Text numberOfLines={2} style={[styles.pinName, { color: theme.textHeading }]}>{draft.name}</Text>
                <Text numberOfLines={1} style={[styles.hint, { color: theme.textSecondary }]}>
                  {[draft.province, draft.district].filter(Boolean).join(' · ')}
                </Text>
                <Text style={[styles.hint, { color: theme.textSecondary }]}>{c.mapPinHint}</Text>
              </View>
            ) : null}
          </>
        )}
        {error ? (
          <View style={styles.errorRow}>
            <Text accessibilityRole="alert" style={[styles.hint, styles.flex, { color: tokens.colors.danger }]}>
              {error}
            </Text>
            {error === c.mapSearchFailed && query ? (
              <Pressable onPress={() => setAttempt((n) => n + 1)} hitSlop={8} accessibilityRole="button">
                <Text style={[styles.retry, { color: theme.textHeading }]}>{c.retry}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
        <MobileButton disabled={!draft || resolving} onPress={confirm}>
          {c.applyPin}
        </MobileButton>
      </View>
    </MobileBottomSheet>
    </WebFormSheet>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  flex: { flex: 1, minWidth: 0 },
  center: { textAlign: 'center' },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: {
    flex: 1,
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
  count: { fontFamily: tokens.typography.native.body, fontSize: 12, lineHeight: 18 },
  hint: { fontFamily: tokens.typography.native.body, fontSize: 12, lineHeight: 18 },
  legacy: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    backgroundColor: tokens.colors.brand[50],
  },
  pinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingLeft: 10,
    paddingRight: 6,
    backgroundColor: '#FFFFFF',
  },
  rank: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankTop: { backgroundColor: tokens.colors.brand[500] },
  rankText: {
    fontFamily: tokens.typography.native.bodyBold,
    fontSize: 13,
    lineHeight: 19,
    color: tokens.colors.primary,
  },
  pinName: {
    fontFamily: tokens.typography.native.body,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '600',
  },
  actions: { flexDirection: 'row', alignItems: 'center' },
  iconBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  flipped: { transform: [{ rotate: '180deg' }] },
  dim: { opacity: 0.3 },
  radius: { gap: 8 },
  chips: { flexDirection: 'row', gap: 8 },
  chip: {
    flex: 1,
    minHeight: 40,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  chipOn: { backgroundColor: tokens.colors.brand[50] },
  chipText: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
  sheet: { paddingHorizontal: 16, paddingTop: 4, gap: 12 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sheetTitle: {
    flex: 1,
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 18,
    lineHeight: 27,
  },
  results: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 8, minHeight: 120 },
  resultsScroll: { maxHeight: 300 },
  resultRow: { paddingVertical: 10, gap: 2, borderBottomWidth: StyleSheet.hairlineWidth },
  map: { height: 280, borderRadius: 14, overflow: 'hidden' },
  mapEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
  },
  mapBusy: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  draft: { gap: 2 },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  retry: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
