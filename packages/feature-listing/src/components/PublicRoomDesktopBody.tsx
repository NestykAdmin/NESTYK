'use client';

import React, { useMemo } from 'react';
import { useLocale } from '@nestyk/i18n';
import { APIProvider, Map, AdvancedMarker, Pin, useApiLoadingStatus, APILoadingStatus } from '@vis.gl/react-google-maps';
import { RoomDesktopBody } from './RoomDesktopBody';
import { toPublicRoomDetail, type PublicRoomShare } from '../public-room-share';
import type { NearbyMapProps } from '../nearby';
import { MapConsentGate } from './MapConsentGate';

/** Browser map without importing the Expo / React Native map adapter. */
function PublicMapCanvas({ latitude, longitude, markerTitle, places }: NearbyMapProps) {
  const { t } = useLocale();
  const status = useApiLoadingStatus();
  if (status === APILoadingStatus.FAILED || status === APILoadingStatus.AUTH_FAILURE) {
    return <p role="status" className="ard-muted">{t.agent.createRoom.mapUnavailable}</p>;
  }
  if (status !== APILoadingStatus.LOADED) {
    return <p role="status" className="ard-muted">{t.common.loading}</p>;
  }
  return (
    <Map
      mapId="DEMO_MAP_ID"
      defaultCenter={{ lat: latitude, lng: longitude }}
      defaultZoom={14}
      style={{ width: '100%', height: 280 }}
      disableDefaultUI
      gestureHandling="none"
      clickableIcons={false}
    >
      <AdvancedMarker position={{ lat: latitude, lng: longitude }} title={markerTitle} zIndex={100}>
        <Pin background="#f8b615" borderColor="#fff" glyphColor="#211e1e" />
      </AdvancedMarker>
      {places.map((place, index) => (
        <AdvancedMarker key={`${place.placeId}-${index}`} position={{ lat: place.latitude, lng: place.longitude }} title={place.name}>
          <Pin background="#fff" borderColor="#64748b" glyphColor="#211e1e" scale={0.8} />
        </AdvancedMarker>
      ))}
    </Map>
  );
}

function PublicRoomMap(props: NearbyMapProps) {
  const { t } = useLocale();
  if (!props.apiKey) return <p className="ard-muted">{t.agent.createRoom.mapUnavailable}</p>;
  return (
    <MapConsentGate style={{ height: 280 }}>
      <APIProvider apiKey={props.apiKey}><PublicMapCanvas {...props} /></APIProvider>
    </MapConsentGate>
  );
}

export function PublicRoomDesktopBody({ room, mapsApiKey }: { room: PublicRoomShare; mapsApiKey?: string }) {
  const detail = useMemo(() => toPublicRoomDetail(room), [room]);
  return (
    <RoomDesktopBody
      room={detail}
      mode="shared"
      mapsApiKey={mapsApiKey}
      shareVisibility={room.shareSections}
      renderNearbyMap={props => <PublicRoomMap {...props} />}
    />
  );
}
