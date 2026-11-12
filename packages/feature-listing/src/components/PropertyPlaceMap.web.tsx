/// <reference types="google.maps" />
import React, { createElement, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  APIProvider,
  Map,
  AdvancedMarker,
  useApiLoadingStatus,
  APILoadingStatus,
} from '@vis.gl/react-google-maps';
import { useLocale } from '@nestyk/i18n';
import { MapConsentGate } from './MapConsentGate';
import { MobileIcon, tokens } from '@nestyk/ui/native';

export type PropertyPlaceMapProps = {
  latitude: number;
  longitude: number;
  hasPin?: boolean;
  onCoordinateChange?: (latitude: number, longitude: number) => void;
  adjustPinLabel?: string;
  adjustPinActiveLabel?: string;
  placePinHint?: string;
  resolving?: boolean;
  mapsApiKey?: string;
};

const BRAND_PIN = tokens.colors.brand[500];
const BRAND_INK = tokens.colors.primary;

function PropertyMarkerGlyph() {
  return (
    <View style={styles.markerWrap}>
      <View style={styles.markerBubble}>
        <MobileIcon name="buildings" size={18} color={BRAND_INK} />
      </View>
      <View style={styles.markerTip} />
    </View>
  );
}

function MapBody({
  latitude,
  longitude,
  hasPin = true,
  onCoordinateChange,
  adjustPinLabel,
  adjustPinActiveLabel,
  placePinHint,
  resolving = false,
}: PropertyPlaceMapProps) {
  const { t } = useLocale();
  const status = useApiLoadingStatus();
  const [adjustMode, setAdjustMode] = useState(false);
  const [center, setCenter] = useState({ lat: latitude, lng: longitude });

  useEffect(() => {
    setCenter({ lat: latitude, lng: longitude });
  }, [latitude, longitude]);

  const interactive = adjustMode && !!onCoordinateChange && !resolving;
  const btnLabel =
    adjustMode && adjustPinActiveLabel ? adjustPinActiveLabel : adjustPinLabel;
  const btnIconColor = adjustMode ? BRAND_INK : tokens.colors.textHeading;

  const placePin = (lat: number, lng: number) => {
    onCoordinateChange?.(lat, lng);
    setAdjustMode(false);
  };

  if (
    status === APILoadingStatus.FAILED ||
    status === APILoadingStatus.AUTH_FAILURE
  ) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.unavailable}>{t.agent.createRoom.mapUnavailable}</Text>
      </View>
    );
  }

  if (status !== APILoadingStatus.LOADED) {
    return (
      <View style={[styles.wrap, styles.loading]}>
        <ActivityIndicator color={BRAND_PIN} />
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Map
        mapId="DEMO_MAP_ID"
        center={center}
        zoom={15}
        gestureHandling={interactive ? 'greedy' : 'none'}
        disableDefaultUI
        streetViewControl={false}
        mapTypeControl={false}
        clickableIcons={false}
        onClick={(event) => {
          if (!interactive || !event.detail.latLng || !onCoordinateChange) return;
          placePin(event.detail.latLng.lat, event.detail.latLng.lng);
        }}
      >
        {hasPin ? (
          <AdvancedMarker position={{ lat: latitude, lng: longitude }}>
            <PropertyMarkerGlyph />
          </AdvancedMarker>
        ) : null}
      </Map>
      {!hasPin && !adjustMode && placePinHint ? (
        <View style={styles.hintOverlay} pointerEvents="none">
          <Text style={styles.hintText}>{placePinHint}</Text>
        </View>
      ) : null}
      {resolving ? (
        <View style={styles.resolvingOverlay} pointerEvents="none">
          <ActivityIndicator color={BRAND_PIN} />
        </View>
      ) : null}
      {onCoordinateChange && adjustPinLabel ? (
        <Pressable
          onPress={() => setAdjustMode((current) => !current)}
          disabled={resolving}
          accessibilityRole="button"
          accessibilityState={{ selected: adjustMode, disabled: resolving }}
          style={({ pressed }) => [
            styles.adjustBtn,
            adjustMode ? styles.adjustBtnActive : null,
            pressed || resolving ? { opacity: 0.9 } : null,
          ]}
        >
          <MobileIcon name="buildings" size={16} color={btnIconColor} />
          <Text
            style={[styles.adjustBtnText, adjustMode ? styles.adjustBtnTextActive : null]}
          >
            {btnLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export const PropertyPlaceMap: React.FC<PropertyPlaceMapProps> = (props) => {
  const { locale } = useLocale();

  if (!props.mapsApiKey) {
    const src = `https://www.google.com/maps?q=${props.latitude},${props.longitude}&z=16&output=embed`;
    return (
      <MapConsentGate style={{ height: 200 }}>
      <View style={styles.wrap}>
        {createElement('iframe', {
          src,
          style: { width: '100%', height: '100%', border: 0 },
          loading: 'lazy',
          referrerPolicy: 'no-referrer-when-downgrade',
          title: 'Google Map',
        })}
      </View>
      </MapConsentGate>
    );
  }

  return (
    <MapConsentGate style={{ height: 200 }}>
      <APIProvider apiKey={props.mapsApiKey} language={locale}>
        <MapBody {...props} />
      </APIProvider>
    </MapConsentGate>
  );
};

const styles = StyleSheet.create({
  wrap: {
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#E5E7EB',
    position: 'relative',
  },
  loading: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  unavailable: {
    padding: 16,
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 20,
    color: tokens.colors.textSecondary,
  },
  markerWrap: {
    alignItems: 'center',
  },
  markerBubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: BRAND_PIN,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerTip: {
    width: 0,
    height: 0,
    marginTop: -2,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: BRAND_PIN,
  },
  hintOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(248, 250, 252, 0.55)',
    paddingHorizontal: 24,
  },
  hintText: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '600',
    color: tokens.colors.textHeading,
    textAlign: 'center',
  },
  resolvingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
  },
  adjustBtn: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    paddingHorizontal: 10,
    paddingVertical: 8,
    boxShadow: '0 1px 4px rgba(33, 30, 30, 0.12)',
  },
  adjustBtnActive: {
    backgroundColor: BRAND_PIN,
    borderColor: '#F8B615',
  },
  adjustBtnText: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '600',
    color: tokens.colors.textHeading,
  },
  adjustBtnTextActive: {
    color: BRAND_INK,
  },
});
