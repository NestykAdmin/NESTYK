import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'expo-router';
import type { UserRole } from '@nestyk/types';
import { loginPathFor, parseAppPath, postLoginPath, roleHomePath } from './app-routes';

/**
 * Web side of the route helpers (route plan R1, rules 1, 7, 17–21). The path owns the role:
 * "/" is guest, "/agent" agent, "/tenant" tenant, "/landlord" landlord. The app shell stays mounted in the root
 * layout, so role changes go through router.push and the browser back button returns without a reload.
 */
const LAST_ROLE_KEY = 'nestyk.web.lastRole';

function currentLocation(): { pathname: string; full: string } {
  try {
    const { pathname, search } = window.location;
    return { pathname, full: `${pathname}${search}` };
  } catch {
    return { pathname: '/', full: '/' };
  }
}

function readLastRole(): string | null {
  try {
    return window.localStorage.getItem(LAST_ROLE_KEY);
  } catch {
    return null;
  }
}

function rememberRole(role: UserRole): void {
  if (role === 'guest') return;
  try {
    window.localStorage.setItem(LAST_ROLE_KEY, role);
  } catch {
    // Private mode or blocked storage: Q5 falls back to the role order.
  }
}

/** The role of a path, following an old-link redirect; anything else is guest. */
function roleOfPath(pathname: string): UserRole {
  let parsed = parseAppPath(pathname);
  if (parsed.kind === 'redirect') parsed = parseAppPath(parsed.to);
  return parsed.kind === 'app' ? parsed.role : 'guest';
}

/**
 * The role of the path the shell opens on, read from the router (not window.location, which can lag one step behind
 * a redirect). EXPO_PUBLIC_DEFAULT_ROLE is not used on web (rule 13).
 */
export function useInitialRouteRole(_fallback: UserRole): UserRole {
  const pathname = usePathname();
  const [role] = useState<UserRole>(() => roleOfPath(pathname));
  return role;
}

/**
 * Keeps the role and the path together: a new path (link, back/forward) sets the role, a role picked in the app
 * moves to that role's path. Paths that are not app paths (login, register) are left alone.
 */
export function useRoleRouteSync(activeRole: UserRole, applyRole: (role: UserRole) => void): void {
  const pathname = usePathname();
  const router = useRouter();
  const parsed = parseAppPath(pathname);
  const pathRole = parsed.kind === 'app' ? parsed.role : null;

  useEffect(() => {
    if (pathRole && pathRole !== activeRole) applyRole(pathRole);
    // Only a new path should move the role here; the next effect handles role changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathRole]);

  const firstRun = useRef(true);
  useEffect(() => {
    rememberRole(activeRole);
    // On the first render the role already comes from the path; only a later role change moves the path.
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    if (pathRole && pathRole !== activeRole) router.push(roleHomePath(activeRole) as never);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRole]);
}

/** "/login?next=<where the user was>" (or the given in-app path). */
export function loginHref(nextPath?: string | null): string {
  return loginPathFor(nextPath ?? currentLocation().full);
}

/** After sign-in: a safe `next` the account may open, else the remembered role, else agent → landlord → tenant (Q5). */
export function postLoginHref(next: unknown, roles: readonly string[] | null | undefined): string {
  return postLoginPath(next, roles, readLastRole());
}
