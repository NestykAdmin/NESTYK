import type { UserRole } from '@nestyk/types';
import type { AppRouteState } from './app-routes';

/**
 * Mobile side of the web route helpers (route plan R1–R2, rule 18). Behaviour stays exactly as before:
 * the role starts from EXPO_PUBLIC_DEFAULT_ROLE, nothing syncs with a URL, login is "/login", after login "/".
 * The web side is web-routes.web.ts.
 */
export function useInitialRouteState(): AppRouteState | null {
  return null;
}

export function useAppRouteSync(
  _routeHref: string | null,
  _activeRole: UserRole,
  _applyRoute: (route: AppRouteState) => void,
): void {}

export function loginHref(_nextPath?: string | null): string {
  return '/login';
}

export function postLoginHref(_next: unknown, _roles: readonly string[] | null | undefined): string {
  return '/';
}
