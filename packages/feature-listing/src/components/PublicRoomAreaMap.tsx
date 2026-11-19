import React from 'react';
import { useLocale } from '@nestyk/i18n';
import { APIProvider, APILoadingStatus, Circle, Map, useApiLoadingStatus } from '@vis.gl/react-google-maps';
import { MapConsentGate } from './MapConsentGate';

/** How wide the "about here" circle is. The public API already rounds a room's position to about 100 m. */
export const ROOM_AREA_RADIUS_METERS = 150;

type Props = {
  apiKey: string;
  latitude: number;
  longitude: number;
  /** Accessible name of the map region, e.g. "Map of the room's rough area". */
  label: string;
  height?: number;
};

function AreaMapCanvas({ latitude, longitude, height }: { latitude: number; longitude: number; height: number }) {
  const { t } = useLocale();
  const status = useApiLoadingStatus();
  if (status === APILoadingStatus.FAILED || status === APILoadingStatus.AUTH_FAILURE) {
    return <p role="status" className="nk-map__status">{t.agent.createRoom.mapUnavailable}</p>;
  }
  if (status !== APILoadingStatus.LOADED) return <p role="status" className="nk-map__status">{t.common.loading}</p>;
  const center = { lat: latitude, lng: longitude };
  return (
    <Map
      defaultCenter={center}
      defaultZoom={15}
      style={{ width: '100%', height }}
      disableDefaultUI
      zoomControl
      gestureHandling="cooperative"
      clickableIcons={false}
    >
      <Circle
        center={center}
        radius={ROOM_AREA_RADIUS_METERS}
        strokeColor="#F8B615"
        strokeOpacity={1}
        strokeWeight={2}
        fillColor="#F8B615"
        fillOpacity={0.22}
        clickable={false}
      />
    </Map>
  );
}

/**
 * Guest room page map (S7.3, Mos 19 Nov 2026: "แผนที่บอกบริเวณคร่าว ๆ"): a circle around the room's rounded position,
 * no pin, so it reads as an area and not an address. Google's script loads only after the maps cookie is allowed.
 * Browser only.
 */
export function PublicRoomAreaMap({ apiKey, latitude, longitude, label, height = 300 }: Props) {
  return (
    <MapConsentGate style={{ height }} testID="roomPage.mapConsent">
      <APIProvider apiKey={apiKey}>
        <div role="region" aria-label={label} style={{ height, borderRadius: 16, overflow: 'hidden' }}>
          <AreaMapCanvas latitude={latitude} longitude={longitude} height={height} />
        </div>
      </APIProvider>
    </MapConsentGate>
  );
}
