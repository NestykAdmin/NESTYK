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

/** Guest paths below "/" that belong to the guest shell (R2 adds their tabs). */
const GUEST_SEGMENTS = new Set(['search', 'services']);

/** Order used when a signed-in user lands without a remembered role (Q5). Admin is never picked automatically. */
const LANDING_ORDER: UserRole[] = ['agent', 'landlord', 'tenant'];

export type ParsedAppPath =
  | { kind: 'app'; role: UserRole; rest: string[] }
  | { kind: 'redirect'; to: string }
  | { kind: 'auth' }
  | { kind: 'notFound' };

function segmentsOf(pathname: string): string[] {
  return pathname.split('/').filter(Boolean).map((s) => s.toLowerCase());
}

/** Reads a pathname (no query) into the role that owns it. */
export function parseAppPath(pathname: string): ParsedAppPath {
  const raw = typeof pathname === 'string' && pathname.startsWith('/') ? pathname : '/';
  const clean = raw.length > 1 ? raw.replace(/\/+$/, '') : raw;
  if ((AUTH_PATHS as readonly string[]).includes(clean.toLowerCase())) return { kind: 'auth' };
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
  if (parsed.kind === 'auth' || parsed.kind === 'notFound') return null;
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
