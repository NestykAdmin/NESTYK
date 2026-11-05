import { useEffect } from 'react';
import { Unmatched, usePathname, useRouter } from 'expo-router';
import { ownScreenPath, parseAppPath } from '../../lib/app-routes';

/**
 * Web: app paths are drawn by WebAppHost in the root layout; this route only shows "Unmatched" for unknown paths.
 * "/Login" or "/Privacy" typed with capitals misses its own route file (matched case-sensitively) and lands here:
 * it goes to the lower-case path with the same query (next=, token_hash=) instead of "Unmatched" (QA 4 Nov 2026, item 9).
 */
export default function CatchAllRoute() {
  const pathname = usePathname();
  const router = useRouter();
  const kind = parseAppPath(pathname).kind;
  const screen = ownScreenPath(pathname);
  useEffect(() => {
    if (!screen) return;
    const search = typeof window !== 'undefined' ? window.location.search : '';
    router.replace(`${screen}${search}` as never);
  }, [screen, router]);
  if (screen) return null;
  return kind === 'app' || kind === 'redirect' ? null : <Unmatched />;
}
