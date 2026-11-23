import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Google Maps key for the self owner screens, read the same way as the agent web room detail
 * (AgentRoomDetailModal.web.tsx, Jom 23 Nov 2026): on web the app config's webGoogleMapsApiKey
 * (app.config.js: NEXT_PUBLIC_GOOGLE_MAPS_API_KEY, else EXPO_PUBLIC_GOOGLE_MAPS_API_KEY) first, then
 * EXPO_PUBLIC_GOOGLE_MAPS_API_KEY. The phone uses EXPO_PUBLIC_GOOGLE_MAPS_API_KEY.
 * No key → undefined, so each map shows its own fallback.
 */
export function selfOwnerMapsApiKey(
  os: string = Platform.OS,
  extra: { webGoogleMapsApiKey?: string } | undefined = Constants.expoConfig?.extra,
  expoKey: string | undefined = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
): string | undefined {
  const webKey = os === 'web' ? extra?.webGoogleMapsApiKey : undefined;
  return webKey || expoKey || undefined;
}
