/**
 * Footer plan (nestyk-web-footer-plan.md, Mos 4 Nov 2026): pure helpers shared by the web footers (F1 workspace,
 * F2 public, F3 auth) and the /privacy, /terms pages. No React, no platform code, no imports (tests load it bare).
 */

/** Support channels for now (F-Q4). Change here once the real ones are confirmed. */
export const SUPPORT_EMAIL = 'support@nestyk.com';
export const SUPPORT_LINE_OA = '@nestyk';

export type LegalPage = 'privacy' | 'terms';

export function legalHref(page: LegalPage): string {
  return page === 'privacy' ? '/privacy' : '/terms';
}

export function supportMailto(subject?: string): string {
  return subject ? `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}` : `mailto:${SUPPORT_EMAIL}`;
}

/** LINE "add friend" link for an official account id such as "@nestyk". */
export function lineOaUrl(id: string = SUPPORT_LINE_OA): string {
  return `https://line.me/R/ti/p/${encodeURIComponent(id.startsWith('@') ? id : `@${id}`)}`;
}

export interface BuildBadge {
  /** Short text on the badge, e.g. "staging · 0f99388". */
  label: string;
  /** What a click copies into a bug report: env, commit and page. */
  copyText: string;
}

const PRODUCTION_ENVS = new Set(['production', 'prod']);
const SHA_PATTERN = /^[0-9a-f]{7,40}$/i;

/**
 * The env + build badge (F-Q2): shown on every env except production. Reads EXPO_PUBLIC_APP_ENV and
 * EXPO_PUBLIC_BUILD_SHA (set from VERCEL_GIT_COMMIT_SHA at build). A missing env means a local build ("dev");
 * a missing or odd sha shows "local". Only public values go in, so nothing secret can leak.
 */
export function buildBadge(env: unknown, sha: unknown, page?: string): BuildBadge | null {
  const envName = typeof env === 'string' && env.trim() ? env.trim().toLowerCase().slice(0, 24) : 'dev';
  if (PRODUCTION_ENVS.has(envName)) return null;
  const commit = typeof sha === 'string' && SHA_PATTERN.test(sha.trim()) ? sha.trim().slice(0, 7).toLowerCase() : 'local';
  const label = `${envName} · ${commit}`;
  const where = typeof page === 'string' && page ? ` · ${page.slice(0, 200)}` : '';
  return { label, copyText: `NESTYK ${label}${where}` };
}

export type ConsentPart = { kind: 'text'; text: string } | { kind: 'link'; page: LegalPage; text: string };

/**
 * Splits a consent sentence such as "I accept the {terms} and the {privacy}" into text and link parts, so the
 * register checkbox can link both documents (F3) and every language keeps its own word order.
 * Unknown {tokens} stay as plain text.
 */
export function consentParts(template: string, labels: Record<LegalPage, string>): ConsentPart[] {
  const parts: ConsentPart[] = [];
  const pattern = /\{(terms|privacy)\}/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(template)) !== null) {
    if (match.index > last) parts.push({ kind: 'text', text: template.slice(last, match.index) });
    const page = match[1] as LegalPage;
    parts.push({ kind: 'link', page, text: labels[page] });
    last = match.index + match[0].length;
  }
  if (last < template.length) parts.push({ kind: 'text', text: template.slice(last) });
  return parts;
}
