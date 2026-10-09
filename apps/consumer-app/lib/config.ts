import Constants from 'expo-constants';
import type { UserRole } from '@nestyk/types';

const ROLES: UserRole[] = ['guest', 'tenant', 'owner', 'agent', 'admin'];

const extra = Constants.expoConfig?.extra as
  | { apiUrl?: string; baseUrl?: string; defaultRole?: string }
  | undefined;

function resolveDefaultRole(): UserRole {
  const raw = (extra?.defaultRole || process.env.EXPO_PUBLIC_DEFAULT_ROLE || 'guest')
    .trim()
    .toLowerCase();
  return (ROLES.includes(raw as UserRole) ? raw : 'guest') as UserRole;
}

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;
const LOOPBACK_URL = /(https?:\/\/)(?:localhost|127\.0\.0\.1)(?=[:/"]|$)/g;

/** The Mac's LAN IP that Expo Go reached Metro on (e.g. `192.168.88.42`); null outside dev or on loopback/tunnel. */
function resolveDevServerHost(): string | null {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return null;
  const host = (Constants.expoConfig?.hostUri ?? '').split(':')[0];
  return IPV4.test(host) && host !== '127.0.0.1' ? host : null;
}

const DEV_SERVER_HOST = resolveDevServerHost();
const DEV_SERVER_URL = DEV_SERVER_HOST
  ? new RegExp(`(https?://)${DEV_SERVER_HOST.replace(/\./g, '\\.')}(?=[:/"]|$)`, 'g')
  : null;

/**
 * Phones and the Android emulator cannot reach the Mac's `localhost` (API, Docker Supabase storage),
 * so in dev those URLs are pointed at its LAN IP.
 */
export function toDeviceUrls(text: string): string {
  return DEV_SERVER_HOST ? text.replace(LOOPBACK_URL, (_, scheme: string) => `${scheme}${DEV_SERVER_HOST}`) : text;
}

/** Reverses `toDeviceUrls` for request bodies: the API only accepts storage URLs under its own `127.0.0.1` host. */
export function toServerUrls(text: string): string {
  return DEV_SERVER_URL ? text.replace(DEV_SERVER_URL, (_, scheme: string) => `${scheme}127.0.0.1`) : text;
}

/**
 * NESTYK Consumer App Environment & API Configuration
 */
export const APP_CONFIG = {
  baseUrl: toDeviceUrls(
    extra?.baseUrl || process.env.EXPO_PUBLIC_BASE_URL || 'http://localhost:3000',
  ),
  apiUrl: toDeviceUrls(
    extra?.apiUrl || process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000/api/v1',
  ),
  /** Cold-start shell role (`EXPO_PUBLIC_DEFAULT_ROLE`) */
  defaultRole: resolveDefaultRole(),
  portals: {
    marketplace: 'http://localhost:3000',
    owner: 'http://localhost:3000/owner',
    agent: 'http://localhost:3000/agent',
    admin: 'http://localhost:3000/admin',
  },
} as const;
