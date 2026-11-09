import type { UserRole } from '@nestyk/types';
import { type AppRouteState, canOpenRole, pickLandingRole, roleHomePath } from './app-routes';

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

/** Mobile (frozen): "Sign out" opens the sign-in screen, as before. The web reads EXPO_PUBLIC_WEB_SIGN_OUT_TO. */
export function afterSignOutHref(): string {
  return '/login';
}

export function postLoginHref(_next: unknown, _roles: readonly string[] | null | undefined): string {
  return '/';
}

/** The role a signed-in account goes to when its role is one it does not have (no remembered role on mobile). */
export function landingRoleFor(roles: readonly string[] | null | undefined): UserRole {
  return pickLandingRole(roles);
}

/** Mobile (portal "all", frozen app): only a role the account does not have moves, to its own role's home. */
export function roleRedirect(role: UserRole, roles: readonly string[] | null | undefined): string | null {
  if (!roles || canOpenRole(role, roles)) return null;
  return roleHomePath(pickLandingRole(roles));
}

/** Mobile: the role switcher lists the account's roles as before. */
export function portalSwitcherRoles(roles: readonly string[] | null | undefined): UserRole[] | undefined {
  return roles ? ([...roles] as UserRole[]) : undefined;
}

/** Mobile: one app with every role, nothing opens on another site. */
export function otherSiteRoles(_roles: readonly string[] | null | undefined): UserRole[] {
  return [];
}

export function roleSiteHref(_role: UserRole): string | null {
  return null;
}

export function openRoleElsewhere(_role: UserRole): boolean {
  return false;
}
