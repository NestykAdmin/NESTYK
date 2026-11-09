import { useEffect, useRef, useState } from 'react';
import { useGlobalSearchParams, usePathname, useRouter } from 'expo-router';
import type { UserRole } from '@nestyk/types';
import {
  type AppRouteState,
  isParentRoute,
  loginPathFor,
  normalizeHref,
  pickLandingRole,
  postLoginPath,
  routeEntryKey,
  routeToState,
  NO_ACCESS_PATH,
  roleHomePath,
} from './app-routes';
import {
  afterSignOutPath,
  decideAccess,
  decideRoleAccess,
  elsewhereRoles,
  landingFor,
  portalFrom,
  portalUrlsFrom,
  roleElsewhere,
  signOutLandingFrom,
  switcherRoles,
  type Portal,
} from './route-access';

/**
 * Web side of the route helpers (route plan R1–R2, rules 1, 7, 17–21). The URL owns the page: "/" is guest,
 * "/agent/rooms" the agent's rooms, and so on. The app shell stays mounted in the root layout, so moving between
 * pages is router.push / router.replace and the browser back button returns without a reload.
 */
const LAST_ROLE_KEY = 'nestyk.web.lastRole';

/** Which roles this deploy shows (route-access.ts). agent.nestyk.com sets EXPO_PUBLIC_WEB_PORTAL=agent; default all. */
export const WEB_PORTAL: Portal = portalFrom(process.env.EXPO_PUBLIC_WEB_PORTAL);
/** The other portals' sites, e.g. "all=https://app.nestyk.com". Unset = roles of other portals are not offered. */
const PORTAL_URLS = portalUrlsFrom(process.env.EXPO_PUBLIC_WEB_PORTAL_URLS);
/** Where "Sign out" lands: EXPO_PUBLIC_WEB_SIGN_OUT_TO = guest | login, unset = by portal (route-access.ts). */
const AFTER_SIGN_OUT = afterSignOutPath(WEB_PORTAL, signOutLandingFrom(process.env.EXPO_PUBLIC_WEB_SIGN_OUT_TO));

export function afterSignOutHref(): string {
  return AFTER_SIGN_OUT;
}

function currentLocation(): string {
  try {
    const { pathname, search } = window.location;
    return `${pathname}${search}`;
  } catch {
    return '/';
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

/** The URL from the router (not window.location, which can lag one step behind a redirect). */
function useRouterUrl(): { pathname: string; query: Record<string, unknown> } {
  const pathname = usePathname();
  // Global params also carry the catch-all segments of app/[...path].tsx as "path"; that is not a query key.
  const { path: _segments, ...query } = useGlobalSearchParams() as Record<string, unknown>;
  return { pathname, query };
}

/** The page the shell opens on. EXPO_PUBLIC_DEFAULT_ROLE is not used on web (rule 13). */
export function useInitialRouteState(): AppRouteState | null {
  const { pathname, query } = useRouterUrl();
  const [route] = useState<AppRouteState | null>(() => routeToState(pathname, query)?.state ?? null);
  return route;
}

/** The pages this tab has seen (entry keys) and where it is now, to tell back/forward from a new page. */
interface SeenStack {
  list: string[];
  index: number;
}

function trackUrl(stack: SeenStack, key: string): void {
  if (stack.list[stack.index] === key) return;
  if (stack.index > 0 && stack.list[stack.index - 1] === key) {
    stack.index -= 1;
    return;
  }
  if (stack.list[stack.index + 1] === key) {
    stack.index += 1;
    return;
  }
  stack.list = [...stack.list.slice(0, stack.index + 1), key];
  stack.index = stack.list.length - 1;
}

/**
 * Keeps the shell and the URL together.
 * - URL changed from outside (link, typed address, back/forward): the shell opens that page (`applyRoute`).
 *   A URL written another way (old link, "/agent/more", unknown page, bad date) is replaced by its canonical one.
 * - The shell moved (menu, button, in-app back): a new page is router.push; a filter (date) is router.replace;
 *   going back up to the page we just came from is a browser back, so history does not fill with loops.
 * `routeHref` null = the shell shows a page without a path yet (R3 detail): the URL is left as it is.
 */
export function useAppRouteSync(
  routeHref: string | null,
  activeRole: UserRole,
  applyRoute: (route: AppRouteState) => void,
): void {
  const router = useRouter();
  const { pathname, query } = useRouterUrl();
  const urlHref = normalizeHref(pathname, query);
  const target = routeToState(pathname, query);
  const synced = useRef<string | null>(target?.href ?? null);
  const stack = useRef<SeenStack>({ list: target ? [routeEntryKey(target.href)] : [], index: 0 });

  useEffect(() => {
    if (!target) return;
    if (target.href !== synced.current) {
      trackUrl(stack.current, routeEntryKey(target.href));
      synced.current = target.href;
      applyRoute(target.state);
    }
    if (target.href !== urlHref) router.replace(target.href as never);
    // Only a new URL should move the shell here; the next effect handles shell moves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlHref]);

  useEffect(() => {
    if (!routeHref || routeHref === synced.current) return;
    const from = synced.current;
    const key = routeEntryKey(routeHref);
    const seen = stack.current;
    synced.current = routeHref;
    if (from && routeEntryKey(from) === key) {
      seen.list[seen.index] = key;
      router.replace(routeHref as never);
      return;
    }
    if (from && seen.index > 0 && seen.list[seen.index - 1] === key && isParentRoute(routeHref, from)) {
      seen.index -= 1;
      window.history.back();
      return;
    }
    seen.list = [...seen.list.slice(0, seen.index + 1), key];
    seen.index = seen.list.length - 1;
    router.push(routeHref as never);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeHref]);

  useEffect(() => {
    rememberRole(activeRole);
  }, [activeRole]);
}

/** "/login?next=<where the user was>" (or the given in-app path). */
export function loginHref(nextPath?: string | null): string {
  return loginPathFor(nextPath ?? currentLocation());
}

/**
 * After sign-in: a safe `next` the account may open, else the remembered role, else agent → landlord → tenant (Q5),
 * all limited to this portal. An account with none of the portal's roles goes to the "no access" page.
 */
export function postLoginHref(next: unknown, roles: readonly string[] | null | undefined): string {
  const lastRole = readLastRole();
  if (WEB_PORTAL !== 'all' && !landingFor(WEB_PORTAL, roles, lastRole)) return NO_ACCESS_PATH;
  const target = postLoginPath(next, roles, lastRole);
  const [pathname, ...rest] = target.split('?');
  const decision = decideAccess(pathname, rest.length ? `?${rest.join('?')}` : '', {
    portal: WEB_PORTAL, signedIn: true, accountRoles: roles, lastRole,
  });
  if (decision.kind === 'redirect') return decision.to;
  if (decision.kind === 'noRole') return NO_ACCESS_PATH;
  return target;
}

/** The role a signed-in account goes to when the page it asked for belongs to a role it does not have (Q5 order). */
export function landingRoleFor(roles: readonly string[] | null | undefined): UserRole {
  return landingFor(WEB_PORTAL, roles, readLastRole()) ?? pickLandingRole(roles, readLastRole());
}

/**
 * Where to send someone who opens `role`'s pages, or null when they may stay (route-access.ts). `roles` null = signed
 * out or not loaded yet: only a role outside this portal moves (signing in is the login flow's job).
 */
export function roleRedirect(role: UserRole, roles: readonly string[] | null | undefined): string | null {
  const decision = decideRoleAccess(role, roleHomePath(role), {
    portal: WEB_PORTAL, signedIn: !!roles, accountRoles: roles, lastRole: readLastRole(),
  });
  if (decision.kind === 'redirect') return decision.to;
  if (decision.kind === 'noRole') return NO_ACCESS_PATH;
  return null;
}

/** Roles the role switcher lists: this portal's, then the account's roles that open on another site. */
export function portalSwitcherRoles(roles: readonly string[] | null | undefined): UserRole[] | undefined {
  return roles ? [...switcherRoles(WEB_PORTAL, roles), ...elsewhereRoles(WEB_PORTAL, roles, PORTAL_URLS)] : undefined;
}

/** The account's roles that open on another site (the switcher marks them, the no-access page links them). */
export function otherSiteRoles(roles: readonly string[] | null | undefined): UserRole[] {
  return elsewhereRoles(WEB_PORTAL, roles, PORTAL_URLS);
}

/** The other site's page for `role`, or null when this portal shows it. */
export function roleSiteHref(role: UserRole): string | null {
  return roleElsewhere(WEB_PORTAL, role, PORTAL_URLS);
}

/** Switching to a role of another portal: open that site in this tab. True when it did. */
export function openRoleElsewhere(role: UserRole): boolean {
  const href = roleSiteHref(role);
  if (!href || typeof window === 'undefined') return false;
  window.location.assign(href);
  return true;
}
