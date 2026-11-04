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
} from './app-routes';

/**
 * Web side of the route helpers (route plan R1–R2, rules 1, 7, 17–21). The URL owns the page: "/" is guest,
 * "/agent/rooms" the agent's rooms, and so on. The app shell stays mounted in the root layout, so moving between
 * pages is router.push / router.replace and the browser back button returns without a reload.
 */
const LAST_ROLE_KEY = 'nestyk.web.lastRole';

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

/** After sign-in: a safe `next` the account may open, else the remembered role, else agent → landlord → tenant (Q5). */
export function postLoginHref(next: unknown, roles: readonly string[] | null | undefined): string {
  return postLoginPath(next, roles, readLastRole());
}

/** The role a signed-in account goes to when the page it asked for belongs to a role it does not have (Q5 order). */
export function landingRoleFor(roles: readonly string[] | null | undefined): UserRole {
  return pickLandingRole(roles, readLastRole());
}
