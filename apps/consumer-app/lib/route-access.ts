import type { UserRole } from '@nestyk/types';
import { canOpenRole, loginPathFor, parseAppPath, roleHomePath } from './app-routes';

/**
 * Who may open which pages (design: project-docs/nestyk-route-access-design.md, Mos 5 Nov 2026).
 * One table for every place that needs it: opening a URL, the page after sign-in, the role switcher.
 * The API (RolesGuard + @Roles) is the real gate; this decides what the app shows so nobody lands on a page they
 * cannot use. Guest pages are public for everyone on every domain. Pure: no React, no platform code.
 */

type AccountRole = Exclude<UserRole, 'guest'>;

export type AccessRule =
  | { kind: 'public' }
  | { kind: 'signedIn' }
  | { kind: 'role'; role: AccountRole };
// Later: | { kind: 'permission'; key: string } once the API sends permissions (team, admin rights).

/** What each role's pages need. Add a row for a new role (e.g. self_owner) when its pages exist. */
export const ROLE_ACCESS: Record<UserRole, AccessRule> = {
  guest: { kind: 'public' },
  agent: { kind: 'role', role: 'agent' },
  tenant: { kind: 'role', role: 'tenant' },
  landlord: { kind: 'role', role: 'landlord' },
  admin: { kind: 'role', role: 'admin' },
};

/** A deploy shows the guest pages plus the roles of its portal. `all` = dev, QA, localhost, app.<domain>. */
export type Portal = 'all' | AccountRole;
export const PORTAL_ROLES: Record<Portal, readonly AccountRole[]> = {
  all: ['agent', 'landlord', 'tenant', 'admin'],
  agent: ['agent'],
  tenant: ['tenant'],
  landlord: ['landlord'],
  admin: ['admin'],
};

/** EXPO_PUBLIC_WEB_PORTAL ("agent" on agent.nestyk.com). Missing or unknown = all, so nothing changes by default. */
export function portalFrom(raw: unknown): Portal {
  const value = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  return value in PORTAL_ROLES ? (value as Portal) : 'all';
}

/** Where the portal starts: "/" for all, else its role's home ("/agent"). */
export function portalHome(portal: Portal): string {
  return portal === 'all' ? '/' : roleHomePath(portal);
}

/** Order used when a signed-in account lands without a remembered role (Q5). Admin only on the admin portal. */
const LANDING_ORDER: readonly AccountRole[] = ['agent', 'landlord', 'tenant'];

/**
 * The role a signed-in account lands on in this portal: the remembered role if allowed, else the Q5 order.
 * On `all` an account with no role lands on guest ("/"). On a role portal it is null: the account has nothing here.
 */
export function landingFor(
  portal: Portal,
  accountRoles: readonly string[] | null | undefined,
  lastRole?: string | null,
): UserRole | null {
  const have = new Set(accountRoles ?? []);
  const allowed = PORTAL_ROLES[portal].filter((role) => have.has(role));
  const order = portal === 'admin' ? (['admin'] as const) : LANDING_ORDER;
  if (lastRole && lastRole !== 'admin' && allowed.includes(lastRole as AccountRole)) return lastRole as AccountRole;
  const pick = order.find((role) => allowed.includes(role));
  if (pick) return pick;
  return portal === 'all' ? 'guest' : null;
}

/** Roles the role switcher lists: in this portal and on the account (guest only on `all`). */
export function switcherRoles(portal: Portal, accountRoles: readonly string[] | null | undefined): UserRole[] {
  const have = new Set(accountRoles ?? []);
  const roles: UserRole[] = PORTAL_ROLES[portal].filter((role) => have.has(role));
  return portal === 'all' ? ['guest', ...roles] : roles;
}

/**
 * Sites of the other portals (EXPO_PUBLIC_WEB_PORTAL_URLS), so the role switcher can open a role this portal does
 * not show on its own site (Mos 5 Nov 2026, option ข). Origins only, e.g. { all: 'https://app.nestyk.com' }.
 */
export type PortalUrls = Partial<Record<Portal, string>>;

const ORIGIN = /^https?:\/\/[a-z0-9.-]+(:\d+)?$/i;

/** "all=https://app.nestyk.com, tenant=https://tenant.nestyk.com". Unknown names and bad URLs are skipped. */
export function portalUrlsFrom(raw: unknown): PortalUrls {
  const urls: PortalUrls = {};
  if (typeof raw !== 'string') return urls;
  for (const entry of raw.split(',')) {
    const at = entry.indexOf('=');
    if (at < 0) continue;
    const name = entry.slice(0, at).trim().toLowerCase();
    const origin = entry.slice(at + 1).trim().replace(/\/+$/, '');
    if (name in PORTAL_ROLES && ORIGIN.test(origin)) urls[name as Portal] = origin;
  }
  return urls;
}

/**
 * Where to open `role` when this portal does not show it: the role's own portal site, else the full site (`all`).
 * Null when this portal shows it, for guest (on every portal), or when no site is set (the switcher hides it).
 * Each site keeps its own sign-in, so the other site may ask to sign in once (it then opens the role's page).
 */
export function roleElsewhere(portal: Portal, role: UserRole, urls: PortalUrls): string | null {
  if (role === 'guest' || PORTAL_ROLES[portal].includes(role)) return null;
  const origin = urls[role] ?? urls.all;
  return origin ? `${origin}${roleHomePath(role)}` : null;
}

/** The account's roles that live on another site (after this portal's own roles in the switcher). */
export function elsewhereRoles(
  portal: Portal,
  accountRoles: readonly string[] | null | undefined,
  urls: PortalUrls,
): UserRole[] {
  const have = new Set(accountRoles ?? []);
  return ([...LANDING_ORDER, 'admin'] as const).filter((role) => have.has(role) && roleElsewhere(portal, role, urls) !== null);
}

export type AccessDecision =
  | { kind: 'allow' }
  /** Signed out and the page needs an account. */
  | { kind: 'login'; to: string }
  /** Not this portal's role, or the account lacks it but has another role here. */
  | { kind: 'redirect'; to: string }
  /** Signed in, but the account has none of this portal's roles: show the "no access" page. */
  | { kind: 'noRole'; portal: Portal };

export interface AccessContext {
  portal: Portal;
  signedIn: boolean;
  accountRoles: readonly string[] | null | undefined;
  lastRole?: string | null;
}

/** May this context open `role`'s pages? `here` is the page asked for (path + query), kept as `next` for sign-in. */
export function decideRoleAccess(role: UserRole, here: string, ctx: AccessContext): AccessDecision {
  const rule = ROLE_ACCESS[role];
  if (rule.kind === 'public') return { kind: 'allow' };
  if (rule.kind === 'signedIn') return ctx.signedIn ? { kind: 'allow' } : { kind: 'login', to: loginPathFor(here) };
  if (!PORTAL_ROLES[ctx.portal].includes(rule.role)) return { kind: 'redirect', to: portalHome(ctx.portal) };
  if (!ctx.signedIn) return { kind: 'login', to: loginPathFor(here) };
  if (canOpenRole(rule.role, ctx.accountRoles)) return { kind: 'allow' };
  const landing = landingFor(ctx.portal, ctx.accountRoles, ctx.lastRole);
  return landing ? { kind: 'redirect', to: roleHomePath(landing) } : { kind: 'noRole', portal: ctx.portal };
}

/** The same decision for a URL. Auth, legal and unknown paths are not this table's business (allow). */
export function decideAccess(pathname: string, search: string, ctx: AccessContext): AccessDecision {
  let parsed = parseAppPath(pathname);
  if (parsed.kind === 'redirect') parsed = parseAppPath(parsed.to);
  if (parsed.kind !== 'app') return { kind: 'allow' };
  return decideRoleAccess(parsed.role, `${pathname}${search}`, ctx);
}
