'use client';

import React from 'react';
import { useLocale } from '@nestyk/i18n';
import { PublicRoomAreaMap } from '@nestyk/feature-listing/desktop';

/** Map part of "ทำเล": a circle for the rough area, after the maps cookie is allowed (plan D1). */
export function RoomLocationMap({ latitude, longitude }: { latitude: number | null; longitude: number | null }) {
  const { t } = useLocale();
  const copy = t.guest.room;
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';
  if (latitude == null || longitude == null) return <p className="nk-rp-map-empty">{copy.noLocation}</p>;
  // No Maps key on this deploy (local dev without the env): leave the map out, the station and district box stays.
  if (!apiKey) return null;
  return <PublicRoomAreaMap apiKey={apiKey} latitude={latitude} longitude={longitude} label={copy.mapLabel} height={300} />;
}
