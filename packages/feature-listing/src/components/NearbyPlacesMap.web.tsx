/// <reference types="google.maps" />
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  APIProvider,
  Map,
  AdvancedMarker,
  Pin,
  InfoWindow,
  useMap,
  useApiLoadingStatus,
  APILoadingStatus,
} from '@vis.gl/react-google-maps';
import { useLocale } from '@nestyk/i18n';
import { MapConsentGate } from './MapConsentGate';
import { MobileIcon, getCardElevation, tokens } from '@nestyk/ui/native';
import { categoryColors, nearbyCategory, type NearbyMapProps } from '../nearby';

const BRAND = tokens.colors.brand[500];
const BRAND_INK = tokens.colors.primary;
const MIN_ZOOM = 11;
const MAX_ZOOM = 18;

function MapBody({
  latitude,
  longitude,
  markerTitle,
  places,
  selectedIds,
  customMode,
  activeId,
  onMapPress,
  onPlacePress,
  readOnly,
  compact = false,
  mapHeight,
  square = false,
  fillContainer = false,
  showFullscreenControl = true,
  onFullscreenPress,
  locked = true,
  onLockedChange,
  unlockLabel,
  lockLabel,
}: NearbyMapProps) {
  const { t } = useLocale();
  const cr = t.agent.createRoom;
  const status = useApiLoadingStatus();
  const [center, setCenter] = useState({ lat: latitude, lng: longitude });
  const [zoom, setZoom] = useState(compact ? 14 : 13);
  const map = useMap();
  const [focused, setFocused] = useState<string | null>(null);
  const focusedPlace = places.find(p => p.placeId === focused);
  const boundsKey = JSON.stringify([latitude, longitude, ...places.map(p => [p.placeId, p.latitude, p.longitude])]);
  const fitAll = () => {
    if (!map) return;
    const bounds = new google.maps.LatLngBounds({ lat: latitude, lng: longitude });
    places.forEach(p => bounds.extend({ lat: p.latitude, lng: p.longitude }));
    map.fitBounds(bounds, 60);
  };
  useEffect(() => { if (map && !customMode) fitAll(); }, [map, boundsKey, customMode]);
  const interactive = !locked && !readOnly;
  const elevation = getCardElevation(1);

  useEffect(() => {
    setCenter({ lat: latitude, lng: longitude });
    setZoom(compact ? 14 : 13);
  }, [latitude, longitude, compact]);

  if (
    status === APILoadingStatus.FAILED ||
    status === APILoadingStatus.AUTH_FAILURE
  ) {
    return (
      <Text accessibilityRole="alert">{cr.mapUnavailable}</Text>
    );
  }
  if (status !== APILoadingStatus.LOADED) return <ActivityIndicator />;

  const height = fillContainer
    ? undefined
    : mapHeight ?? (compact ? 180 : 320);

  return (
    <View
      style={[
        styles.wrap,
        fillContainer ? styles.wrapFill : square ? { width: '100%', aspectRatio: 1 } : { height },
      ]}
    >
      <Map
        mapId="DEMO_MAP_ID"
        center={center}
        zoom={zoom}
        onCameraChanged={(event) => {
          setCenter(event.detail.center);
          setZoom(event.detail.zoom);
        }}
        gestureHandling={interactive ? 'greedy' : 'none'}
        disableDefaultUI
        streetViewControl={false}
        mapTypeControl={false}
        clickableIcons={false}
        onClick={(event) => {
          if (!interactive || !customMode || !event.detail.latLng) return;
          onMapPress?.(event.detail.latLng.lat, event.detail.latLng.lng);
        }}
      >
        <AdvancedMarker
          position={{ lat: latitude, lng: longitude }}
          title={markerTitle ?? cr.propertyName}
          zIndex={100}
        >
          <Pin background={BRAND} borderColor="#ffffff" glyphColor={BRAND_INK}><MobileIcon name="buildings" size={18} color={BRAND_INK} /></Pin>
        </AdvancedMarker>
        {places.map((place, index) => {
          const checked = selectedIds.includes(place.placeId);
          const catColor = categoryColors[nearbyCategory(place.type)];
          return (
            <AdvancedMarker
              key={place.placeId}
              position={{ lat: place.latitude, lng: place.longitude }}
              title={place.name || `${index + 1}`}
              zIndex={activeId === place.placeId ? 50 : checked ? 20 : 10}
              onClick={() => setFocused(place.placeId)}
            >
              <Pin
                background={checked ? catColor : '#94A3B8'}
                borderColor={focused === place.placeId ? BRAND_INK : '#ffffff'}
                glyphColor="#ffffff"
                scale={focused === place.placeId ? 1.2 : 1}
                glyph={checked ? '✓' : ''}
              />
            </AdvancedMarker>
          );
        })}
        {focusedPlace && <InfoWindow position={{ lat: focusedPlace.latitude, lng: focusedPlace.longitude }} onCloseClick={() => setFocused(null)}>
          <View style={{ gap: 8, maxWidth: 240 }}>
            <Text style={{ fontWeight: '600' }}>{focusedPlace.name}</Text>
            <Text>{cr.nearbyDistanceMeters.replace('{meters}', String(focusedPlace.distanceMeters))} · {cr.nearbyStraightLine}</Text>
            {!readOnly && <Pressable accessibilityRole="button" onPress={() => onPlacePress?.(focusedPlace)} style={{ padding: 10 }}><Text>{selectedIds.includes(focusedPlace.placeId) ? cr.nearbyPinRemove : cr.nearbyPinSelect}</Text></Pressable>}
          </View>
        </InfoWindow>}
      </Map>

      <Pressable accessibilityRole="button" accessibilityLabel={cr.nearbyFitAll} onPress={fitAll} style={[styles.fab, { left: 10, top: 10, width: 44, height: 44 }]}>
        <MobileIcon name="room-size" size={18} color={BRAND_INK} />
      </Pressable>

      <View style={[styles.zoomStack, elevation]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={cr.nearbyZoomIn}
          onPress={() => setZoom((z) => Math.min(MAX_ZOOM, z + 1))}
          style={styles.zoomBtn}
        >
          <MobileIcon name="plus" size={16} color={tokens.colors.textHeading} />
        </Pressable>
        <View style={styles.zoomDivider} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={cr.nearbyZoomOut}
          onPress={() => setZoom((z) => Math.max(MIN_ZOOM, z - 1))}
          style={styles.zoomBtn}
        >
          <Text style={styles.zoomMinus}>−</Text>
        </Pressable>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={cr.recenterMap}
        onPress={() => {
          setCenter({ lat: latitude, lng: longitude });
          setZoom(compact ? 14 : 13);
        }}
        style={[styles.fab, styles.fabRecenter]}
      >
        <MobileIcon name="map-pin" size={16} color={tokens.colors.textHeading} />
      </Pressable>

      {showFullscreenControl && onFullscreenPress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            fillContainer ? cr.nearbyExitFullscreen : cr.nearbyFullscreen
          }
          onPress={onFullscreenPress}
          style={[styles.fab, styles.fabFullscreen]}
        >
          <MobileIcon
            name={fillContainer ? 'close' : 'room-size'}
            size={16}
            color={tokens.colors.textHeading}
          />
        </Pressable>
      ) : null}

      {onLockedChange ? (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: !locked }}
          onPress={() => onLockedChange(!locked)}
          style={[styles.lockBtn, !locked && styles.lockBtnOn]}
        >
          <MobileIcon
            name={locked ? 'lock' : 'globe'}
            size={14}
            color={locked ? tokens.colors.textHeading : BRAND_INK}
          />
          <Text style={[styles.lockBtnText, !locked && styles.lockBtnTextOn]}>
            {locked
              ? unlockLabel ?? cr.nearbyUnlockMap
              : lockLabel ?? cr.nearbyLockMap}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function NearbyPlacesMap(props: NearbyMapProps) {
  const { t, locale } = useLocale();
  if (!props.apiKey) {
    return (
      <Text accessibilityRole="alert">{t.agent.createRoom.mapUnavailable}</Text>
    );
  }
  // Same size as the map, so the page does not jump when it loads.
  const gateStyle = props.fillContainer
    ? { height: '100%' }
    : props.square
      ? { aspectRatio: '1' }
      : { height: props.mapHeight ?? (props.compact ? 180 : 320) };
  return (
    <MapConsentGate style={gateStyle}>
      <APIProvider apiKey={props.apiKey} language={locale}>
        <MapBody {...props} />
      </APIProvider>
    </MapConsentGate>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: tokens.colors.border,
    position: 'relative',
  },
  wrapFill: {
    flex: 1,
    borderRadius: 0,
  },
  zoomStack: {
    position: 'absolute',
    right: 10,
    top: 10,
    borderRadius: 10,
    backgroundColor: tokens.colors.white,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    overflow: 'hidden',
  },
  zoomBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: tokens.colors.border,
  },
  zoomMinus: {
    fontSize: 22,
    lineHeight: 24,
    fontWeight: '600',
    color: tokens.colors.textHeading,
    marginTop: -2,
  },
  fab: {
    position: 'absolute',
    right: 10,
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: tokens.colors.white,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabRecenter: { bottom: 10 },
  fabFullscreen: { bottom: 54 },
  lockBtn: {
    position: 'absolute',
    left: 10,
    bottom: 10,
    minHeight: 36,
    borderRadius: 10,
    paddingHorizontal: 10,
    backgroundColor: tokens.colors.white,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  lockBtnOn: {
    backgroundColor: tokens.colors.subtle.brandBg,
    borderColor: BRAND,
  },
  lockBtnText: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
    color: tokens.colors.textHeading,
  },
  lockBtnTextOn: { color: BRAND_INK },
});
