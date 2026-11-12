import type { NearbyPlace } from "@nestyk/types";
import type { AppIconName } from "@nestyk/ui/native";
export type { NearbyPlace } from "@nestyk/types";
export const nearbyCategories = [
  "transit",
  "education",
  "health",
  "shopping",
  "recreation",
  "other",
] as const;
export type NearbyCategory = (typeof nearbyCategories)[number];
export const categoryColors: Record<NearbyCategory, string> = {
  transit: '#1D4ED8',
  education: '#211E1E',
  health: '#B91C1C',
  shopping: '#B45309',
  recreation: '#15803D',
  other: '#64748B',
};
export const nearbyCategoryIcons: Record<NearbyCategory, AppIconName> = {
  transit: 'train',
  education: 'graduation-cap',
  health: 'hospital',
  shopping: 'package',
  recreation: 'tree',
  other: 'map-pin',
};
export function nearbyCategory(type: string): NearbyCategory {
  if (
    [
      "subway_station",
      "train_station",
      "transit_station",
      "bus_station",
    ].includes(type)
  )
    return "transit";
  if (["university", "school"].includes(type)) return "education";
  if (type === "hospital") return "health";
  if (["shopping_mall", "supermarket", "convenience_store"].includes(type))
    return "shopping";
  if (type === "park") return "recreation";
  return "other";
}

function detectRailSystem(...texts: Array<string | undefined>): "BTS" | "MRT" | "ARL" | "SRT" | null {
  const blob = texts.filter(Boolean).join(" ");
  if (!blob) return null;
  if (/\bBTS\b|bangkok mass transit|skytrain|รถไฟฟ้าบีทีเอส|บีทีเอส/i.test(blob)) {
    return "BTS";
  }
  if (/\bMRT\b|metropolitan rapid transit|รถไฟฟ้ามหานคร|เอ็มอาร์ที/i.test(blob)) {
    return "MRT";
  }
  if (/\bARL\b|airport.?rail|แอร์พอร์ต\s*เรล|แอร์พอร์ตลิงก์/i.test(blob)) {
    return "ARL";
  }
  if (/\bSRT\b|state railway|การรถไฟแห่งประเทศไทย|รถไฟไทย/i.test(blob)) {
    return "SRT";
  }
  return null;
}

function stripStationNoise(name: string): string {
  return name
    .replace(/^(BTS|MRT|ARL|SRT)\s+/i, "")
    .replace(/^(สถานี(รถไฟฟ้า)?|Station)\s+/i, "")
    .replace(/\s*(BTS|MRT|ARL|SRT)?\s*(Station|สถานี)?$/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Normalize transit labels when rail brand is already in Google name/vicinity. */
export function formatTransitPlaceName(
  name: string,
  type: string,
  vicinity?: string,
): string {
  const raw = name.trim();
  if (
    !raw ||
    !["subway_station", "train_station", "transit_station"].includes(type)
  ) {
    return raw;
  }
  const existing = raw.match(/^(BTS|MRT|ARL|SRT)\b/i);
  if (existing) {
    return `${existing[1]!.toUpperCase()} ${stripStationNoise(raw) || raw}`.trim();
  }
  const system = detectRailSystem(raw, vicinity);
  if (!system) return raw;
  const core = stripStationNoise(raw) || raw;
  if (new RegExp(`^${system}\\b`, "i").test(core)) {
    return `${system} ${stripStationNoise(core) || core}`.trim();
  }
  return `${system} ${core}`;
}

export const isCustomPlace = (place: NearbyPlace) =>
  place.type === "custom_nearby" || place.placeId.startsWith("custom-");
export function distanceMeters(
  a: number,
  b: number,
  c: number,
  d: number,
): number {
  const rad = Math.PI / 180;
  const h =
    Math.sin(((c - a) * rad) / 2) ** 2 +
    Math.cos(a * rad) * Math.cos(c * rad) * Math.sin(((d - b) * rad) / 2) ** 2;
  return Math.round(6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, h))));
}
export function relocateNearby(
  places: NearbyPlace[],
  latitude: number,
  longitude: number,
): NearbyPlace[] {
  return places
    .map((p) => ({
      ...p,
      distanceMeters: distanceMeters(
        latitude,
        longitude,
        p.latitude,
        p.longitude,
      ),
    }))
    .sort((a, b) => a.distanceMeters - b.distanceMeters);
}
export function createCustomPlace(
  latitude: number,
  longitude: number,
  originLat: number,
  originLng: number,
): NearbyPlace {
  return {
    placeId: `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`,
    name: "",
    type: "custom_nearby",
    latitude,
    longitude,
    distanceMeters: distanceMeters(originLat, originLng, latitude, longitude),
  };
}
export type NearbyMapProps = {
  markerTitle?: string;
  radiusKm?: number;
  latitude: number;
  longitude: number;
  places: NearbyPlace[];
  selectedIds: string[];
  activeId?: string | null;
  customMode?: boolean;
  apiKey?: string;
  readOnly?: boolean;
  showRecenter?: boolean;
  /** Shorter map preview for create/edit sheet (mock). */
  compact?: boolean;
  /** Override map container height (px). */
  mapHeight?: number;
  /** Square inline map; fullscreen still fills the available space. */
  square?: boolean;
  /** When true, map fills parent (e.g. fullscreen modal). */
  fillContainer?: boolean;
  /** Show expand control; omit in already-fullscreen map. */
  showFullscreenControl?: boolean;
  onFullscreenPress?: () => void;
  /** When true, pan/zoom gestures disabled (same idea as PropertyPlaceMap). */
  locked?: boolean;
  onLockedChange?: (locked: boolean) => void;
  unlockLabel?: string;
  lockLabel?: string;
  onPlacePress?: (place: NearbyPlace) => void;
  onMapPress?: (latitude: number, longitude: number) => void;
};
