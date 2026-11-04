import { Unmatched, usePathname } from 'expo-router';
import { parseAppPath } from '../../lib/app-routes';

/** Web: app paths are drawn by WebAppHost in the root layout; this route only shows "Unmatched" for unknown paths. */
export default function CatchAllRoute() {
  const kind = parseAppPath(usePathname()).kind;
  return kind === 'app' || kind === 'redirect' ? null : <Unmatched />;
}
