import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { MobileIcon, getCardElevation, tokens } from '@nestyk/ui/native';

export type PropertyPlaceMapProps = {
  latitude: number;
  longitude: number;
  /** When false, map shows preview only — no confirmed pin marker. */
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

export const PropertyPlaceMap: React.FC<PropertyPlaceMapProps> = ({
  latitude,
  longitude,
  hasPin = true,
  onCoordinateChange,
  adjustPinLabel,
  adjustPinActiveLabel,
  placePinHint,
  resolving = false,
}) => {
  const [adjustMode, setAdjustMode] = useState(false);
  const [tracksViewChanges, setTracksViewChanges] = useState(true);
  const interactive = adjustMode && !!onCoordinateChange && !resolving;
  const elevation = getCardElevation(1);
  const btnLabel =
    adjustMode && adjustPinActiveLabel ? adjustPinActiveLabel : adjustPinLabel;
  const btnIconColor = adjustMode ? BRAND_INK : tokens.colors.textHeading;

  useEffect(() => {
    if (!hasPin) return;
    setTracksViewChanges(true);
    const timer = setTimeout(() => setTracksViewChanges(false), 500);
    return () => clearTimeout(timer);
  }, [hasPin, latitude, longitude]);

  const placePin = (lat: number, lng: number) => {
    onCoordinateChange?.(lat, lng);
    setAdjustMode(false);
  };

  return (
    <View style={styles.wrap}>
      <MapView
        style={styles.map}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        region={{
          latitude,
          longitude,
          latitudeDelta: 0.008,
          longitudeDelta: 0.008,
        }}
        scrollEnabled={interactive}
        pitchEnabled={false}
        rotateEnabled={false}
        zoomEnabled={interactive}
        onPress={(event) => {
          if (!interactive) return;
          placePin(
            event.nativeEvent.coordinate.latitude,
            event.nativeEvent.coordinate.longitude,
          );
        }}
      >
        {hasPin ? (
          <Marker
            coordinate={{ latitude, longitude }}
            anchor={{ x: 0.5, y: 1 }}
            tracksViewChanges={tracksViewChanges}
            draggable={interactive}
            onDragEnd={(event) => {
              placePin(
                event.nativeEvent.coordinate.latitude,
                event.nativeEvent.coordinate.longitude,
              );
            }}
          >
            <PropertyMarkerGlyph />
          </Marker>
        ) : null}
      </MapView>
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
            {
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: Platform.OS === 'ios' ? 0.12 : 0,
              shadowRadius: 4,
              elevation: Platform.OS === 'android' ? elevation.elevation : 0,
            },
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
};

const styles = StyleSheet.create({
  wrap: {
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#E5E7EB',
  },
  map: {
    width: '100%',
    height: '100%',
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
    ...StyleSheet.absoluteFillObject,
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
    ...StyleSheet.absoluteFillObject,
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
