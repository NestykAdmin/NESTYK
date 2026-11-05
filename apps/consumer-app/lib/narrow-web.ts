import { parseAppPath } from './app-routes';

/**
 * Launch plan (13 Nov 2026), "done" item 2: the web is built for 768 px and wider. Below that, a role's pages show the
 * phone screens and a banner suggests the NESTYK app. Guest pages (public site), sign-in and legal pages show no banner.
 * Same width as WEB_SHELL_MIN_WIDTH in app/index.tsx (where the desktop shell starts).
 */
export const NARROW_WEB_MAX_WIDTH = 768;
export const NARROW_BANNER_DISMISSED_KEY = 'nestyk.web.narrowBannerDismissed';

export function showNarrowWebBanner(pathname: string, width: number, dismissed: boolean): boolean {
  if (dismissed || !(width > 0) || width >= NARROW_WEB_MAX_WIDTH) return false;
  const route = parseAppPath(pathname);
  return route.kind === 'app' && route.role !== 'guest';
}
