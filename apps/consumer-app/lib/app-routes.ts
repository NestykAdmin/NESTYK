import type { UserRole } from '@nestyk/types';

/**
 * Route plan R1 (Mos 3 Nov 2026, docs: nestyk-route-plan.md / nestyk-route-rules.md).
 * Pure path <-> role helpers shared by web and (later, R5) mobile deep links. No React, no platform code.
 * Build every in-app link with these helpers; never concatenate "/agent/..." by hand (rule 2).
 */

/** Roles that own a top-level path. Guest lives at "/". */
export const ROLE_PATH: Record<Exclude<UserRole, 'guest'>, string> = {
  agent: '/agent',
  tenant: '/tenant',
  landlord: '/landlord',
  admin: '/admin',
};

/** Screens that are their own route files (expo-router renders them, the app shell stays out). */
export const AUTH_PATHS = ['/login', '/register', '/reset-password'] as const;

/** Public document pages (footer plan F-Q1, Mos 4 Nov 2026): own route files, open without login, never a `next`. */
export const LEGAL_PATHS = ['/privacy', '/terms'] as const;
export type LegalPath = (typeof LEGAL_PATHS)[number];

/** Guest paths below "/" that belong to the guest shell. */
const GUEST_SEGMENTS = new Set(['search', 'services']);

/** Order used when a signed-in user lands without a remembered role (Q5). Admin is never picked automatically. */
const LANDING_ORDER: UserRole[] = ['agent', 'landlord', 'tenant'];

export type ParsedAppPath =
  | { kind: 'app'; role: UserRole; rest: string[] }
  | { kind: 'redirect'; to: string }
  | { kind: 'auth' }
  | { kind: 'legal'; page: 'privacy' | 'terms' }
  | { kind: 'notFound' };

function segmentsOf(pathname: string): string[] {
  return pathname.split('/').filter(Boolean).map((s) => s.toLowerCase());
}

/** Reads a pathname (no query) into the role that owns it. */
export function parseAppPath(pathname: string): ParsedAppPath {
  const raw = typeof pathname === 'string' && pathname.startsWith('/') ? pathname : '/';
  const clean = raw.length > 1 ? raw.replace(/\/+$/, '') : raw;
  const lower = clean.toLowerCase();
  if ((AUTH_PATHS as readonly string[]).includes(lower)) return { kind: 'auth' };
  if ((LEGAL_PATHS as readonly string[]).includes(lower)) return { kind: 'legal', page: lower.slice(1) as 'privacy' | 'terms' };
  const segments = segmentsOf(clean);
  if (segments.length === 0) return { kind: 'app', role: 'guest', rest: [] };
  const [head, ...rest] = segments;
  // Old links: the role "owner" is now "landlord" (docs/ROLE-CHANGE-PLAN.md).
  if (head === 'owner') return { kind: 'redirect', to: ['/landlord', ...rest].join('/') };
  for (const [role, path] of Object.entries(ROLE_PATH) as [Exclude<UserRole, 'guest'>, string][]) {
    if (head === path.slice(1)) return { kind: 'app', role, rest };
  }
  if (GUEST_SEGMENTS.has(head)) return { kind: 'app', role: 'guest', rest: segments };
  return { kind: 'notFound' };
}

/** The path a role starts at. */
export function roleHomePath(role: UserRole): string {
  return role === 'guest' ? '/' : ROLE_PATH[role];
}

/**
 * A `next` value is used only when it is a path inside this app: one leading "/", no "//", no backslash,
 * no scheme, and not an auth screen (so login never sends you back to login). Anything else is dropped (open redirect).
 */
export function safeNextPath(next: unknown): string | null {
  const value = Array.isArray(next) ? next[0] : next;
  if (typeof value !== 'string' || value.length === 0 || value.length > 512) return null;
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return null;
  if (/^\/[^?#]*:/.test(value) || /[\u0000-\u001f]/.test(value)) return null;
  const pathOnly = value.split(/[?#]/)[0];
  const parsed = parseAppPath(pathOnly);
  if (parsed.kind === 'auth' || parsed.kind === 'legal' || parsed.kind === 'notFound') return null;
  return value;
}

/** "/login", or "/login?next=<path>" when the path is a safe in-app destination. */
export function loginPathFor(nextPath?: string | null): string {
  const next = safeNextPath(nextPath);
  return next && next !== '/' ? `/login?next=${encodeURIComponent(next)}` : '/login';
}

/** Q5: the remembered role if the account still has it, else agent → landlord → tenant → guest. */
export function pickLandingRole(roles: readonly string[] | null | undefined, lastRole?: string | null): UserRole {
  const have = new Set(roles ?? []);
  if (lastRole && lastRole !== 'guest' && lastRole !== 'admin' && have.has(lastRole)) return lastRole as UserRole;
  return LANDING_ORDER.find((role) => have.has(role)) ?? 'guest';
}

/** Where to go right after signing in: a safe `next` the account may open, else the landing role's home. */
export function postLoginPath(next: unknown, roles: readonly string[] | null | undefined, lastRole?: string | null): string {
  const target = safeNextPath(next);
  if (target) {
    const parsed = parseAppPath(target.split(/[?#]/)[0]);
    if (parsed.kind === 'redirect') return parsed.to;
    if (parsed.kind === 'app' && (parsed.role === 'guest' || (roles ?? []).includes(parsed.role))) return target;
  }
  return roleHomePath(pickLandingRole(roles, lastRole));
}

/* ------------------------------------------------------------------------------------------------------------------
 * Route plan R2 (web tab paths). One table maps every page that has a path to the shell state behind it, so
 * routeToState and stateToRoute always agree (rule 15: going there and back gives the same value).
 * Detail pages (a lead, a tenant, a contract, a bill room) are R3: stateToRoute returns null for them and the
 * URL stays on the list they were opened from.
 * ---------------------------------------------------------------------------------------------------------------- */

/** Shell tabs that own a path. Same names as MobileAppTab in @nestyk/ui (kept here so this file has no imports). */
export type AppRouteTab =
  | 'home'
  | 'search'
  | 'services'
  | 'dashboard'
  | 'listingRoom'
  | 'createListing'
  | 'listingLead'
  | 'createLead'
  | 'clients'
  | 'contracts'
  | 'calendar'
  | 'contact'
  | 'living'
  | 'bills'
  | 'income';

export interface AppRouteState {
  role: UserRole;
  tab: AppRouteTab;
  /** Agent Clients: the new-tenant form. */
  creatingTenant?: boolean;
  /** Tenant / landlord contract inbox drawn over `tab`; landlord "tenants" is the inbox in history mode. */
  partyInbox?: 'contracts' | 'tenants';
  /** Agent calendar: selected day, YYYY-MM-DD. */
  calendarDate?: string;
  /** Tenant bills: payment history. */
  billHistory?: boolean;
}

/** What the shell passes in to get its URL. `detailOpen` = an R3 page is showing (no path yet). */
export interface AppRouteSnapshot {
  role: UserRole;
  tab: string;
  creatingTenant?: boolean;
  partyInbox?: 'contracts' | 'tenants' | null;
  calendarDate?: string | null;
  billHistory?: boolean;
  detailOpen?: boolean;
}

type PageState = Omit<AppRouteState, 'role' | 'calendarDate' | 'billHistory'>;
interface RoutePage {
  path: string[];
  state: PageState;
}

const ROUTE_PAGES: Record<UserRole, RoutePage[]> = {
  guest: [
    { path: [], state: { tab: 'home' } },
    { path: ['search'], state: { tab: 'search' } },
    { path: ['services'], state: { tab: 'services' } },
  ],
  agent: [
    { path: [], state: { tab: 'dashboard' } },
    { path: ['rooms'], state: { tab: 'listingRoom' } },
    { path: ['rooms', 'new'], state: { tab: 'createListing' } },
    { path: ['leads'], state: { tab: 'listingLead' } },
    { path: ['leads', 'new'], state: { tab: 'createLead' } },
    { path: ['clients'], state: { tab: 'clients' } },
    { path: ['clients', 'new'], state: { tab: 'clients', creatingTenant: true } },
    { path: ['contracts'], state: { tab: 'contracts' } },
    { path: ['calendar'], state: { tab: 'calendar' } },
    { path: ['contacts'], state: { tab: 'contact' } },
    { path: ['services'], state: { tab: 'services' } },
  ],
  tenant: [
    { path: [], state: { tab: 'dashboard' } },
    { path: ['home'], state: { tab: 'living' } },
    { path: ['contracts'], state: { tab: 'dashboard', partyInbox: 'contracts' } },
    { path: ['bills'], state: { tab: 'bills' } },
    { path: ['services'], state: { tab: 'services' } },
  ],
  landlord: [
    { path: [], state: { tab: 'dashboard' } },
    { path: ['contracts'], state: { tab: 'dashboard', partyInbox: 'contracts' } },
    { path: ['tenants'], state: { tab: 'dashboard', partyInbox: 'tenants' } },
    { path: ['income'], state: { tab: 'income' } },
    { path: ['services'], state: { tab: 'services' } },
  ],
  // Admin pages are samples for now (plan 3.5): only its home has a path.
  admin: [{ path: [], state: { tab: 'dashboard' } }],
};

/** Old or mobile-only paths that open another page. "/agent/more" is the mobile More tab; the web sidebar has it all. */
const ROUTE_ALIASES: Partial<Record<UserRole, Record<string, string[]>>> = {
  agent: { more: [] },
};

/** Query keys that only filter the page (router.replace); any other change is a new history entry (router.push). */
const REPLACE_ONLY_KEYS = new Set(['date', 'view', 'filter', 'q']);

function isValidDateKey(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

function firstValue(value: unknown): string | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  return typeof v === 'string' ? v : undefined;
}

/** "a=1&b=2" (keys sorted, values encoded); empty string when nothing is set. */
function queryString(query: Record<string, string | undefined>): string {
  return Object.keys(query)
    .filter((key) => query[key] !== undefined && query[key] !== '')
    .sort()
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(query[key] as string)}`)
    .join('&');
}

function withQuery(path: string, query: Record<string, string | undefined>): string {
  const qs = queryString(query);
  return qs ? `${path}?${qs}` : path;
}

/** Reads "?a=1&b=2" (or "a=1&b=2") without URLSearchParams (React Native's copy is incomplete). */
export function parseQuery(search: string): Record<string, string> {
  const out: Record<string, string> = {};
  const raw = search.startsWith('?') ? search.slice(1) : search;
  for (const part of raw.split('&')) {
    if (!part) continue;
    const [k, ...rest] = part.split('=');
    try {
      const key = decodeURIComponent(k.replace(/\+/g, ' '));
      if (!(key in out)) out[key] = decodeURIComponent(rest.join('=').replace(/\+/g, ' '));
    } catch {
      // Broken escape: skip that pair.
    }
  }
  return out;
}

/** The same URL written one way: path from the router plus its query with keys sorted. */
export function normalizeHref(pathname: string, query: Record<string, unknown>): string {
  const clean: Record<string, string | undefined> = {};
  for (const key of Object.keys(query)) clean[key] = firstValue(query[key]);
  return withQuery(pathname || '/', clean);
}

function samePath(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((s, i) => s === b[i]);
}

/** The page of a shell state, or null when that state has no path (R3 detail pages, sample tabs). */
export function stateToRoute(snapshot: AppRouteSnapshot): string | null {
  if (snapshot.detailOpen) return null;
  const pages = ROUTE_PAGES[snapshot.role] ?? [];
  const inbox = snapshot.partyInbox ?? undefined;
  const page = pages.find((p) =>
    inbox
      ? p.state.partyInbox === inbox
      : !p.state.partyInbox &&
        p.state.tab === snapshot.tab &&
        (snapshot.tab !== 'clients' || !!p.state.creatingTenant === !!snapshot.creatingTenant),
  );
  if (!page) return null;
  const base = snapshot.role === 'guest' ? '' : roleHomePath(snapshot.role);
  const path = [base, ...page.path].join('/') || '/';
  const query: Record<string, string | undefined> = {};
  if (page.state.tab === 'calendar' && !inbox && isValidDateKey(snapshot.calendarDate)) query.date = snapshot.calendarDate;
  if (page.state.tab === 'bills' && !inbox && snapshot.billHistory) query.history = '1';
  return withQuery(path === '' ? '/' : path, query);
}

/**
 * The shell state of a URL and its canonical href (the one stateToRoute gives back). Unknown pages under a role
 * open that role's home (a not-found page is R3). Not an app path → null.
 */
export function routeToState(
  pathname: string,
  query: Record<string, unknown> = {},
): { state: AppRouteState; href: string } | null {
  let parsed = parseAppPath(pathname);
  if (parsed.kind === 'redirect') parsed = parseAppPath(parsed.to);
  if (parsed.kind !== 'app') return null;
  const { role } = parsed;
  const alias = ROUTE_ALIASES[role]?.[parsed.rest.join('/')];
  const rest = alias ?? parsed.rest;
  const pages = ROUTE_PAGES[role] ?? ROUTE_PAGES.guest;
  const page = pages.find((p) => samePath(p.path, rest)) ?? pages[0];
  const state: AppRouteState = { role, ...page.state };
  const date = firstValue(query.date);
  if (state.tab === 'calendar' && !state.partyInbox && isValidDateKey(date)) state.calendarDate = date;
  if (state.tab === 'bills' && !state.partyInbox && firstValue(query.history) === '1') state.billHistory = true;
  const href = stateToRoute({ ...state, partyInbox: state.partyInbox ?? null }) ?? roleHomePath(role);
  return { state, href };
}

/** The history entry a URL stands for: its path plus the query keys that are not just filters. */
export function routeEntryKey(href: string): string {
  const [path, search = ''] = href.split('?');
  const query = parseQuery(search);
  for (const key of Object.keys(query)) if (REPLACE_ONLY_KEYS.has(key)) delete query[key];
  return withQuery(path, query);
}

/** True when `target` is the same page or a page above `from` ("/agent/rooms" is above "/agent/rooms/new"). */
export function isParentRoute(target: string, from: string): boolean {
  const t = segmentsOf(target.split('?')[0]);
  const f = segmentsOf(from.split('?')[0]);
  return t.length <= f.length && t.every((s, i) => s === f[i]);
}
