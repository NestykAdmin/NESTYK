import type { UserRole } from '@nestyk/types';

/**
 * Mobile side of the web route helpers (route plan R1, rule 18). Behaviour stays exactly as before R1:
 * the role starts from EXPO_PUBLIC_DEFAULT_ROLE, nothing syncs with a URL, login is "/login", after login "/".
 * The web side is web-routes.web.ts.
 */
export function useInitialRouteRole(fallback: UserRole): UserRole {
  return fallback;
}

export function useRoleRouteSync(_activeRole: UserRole, _applyRole: (role: UserRole) => void): void {}

export function loginHref(_nextPath?: string | null): string {
  return '/login';
}

export function postLoginHref(_next: unknown, _roles: readonly string[] | null | undefined): string {
  return '/';
}
