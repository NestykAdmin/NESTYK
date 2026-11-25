/**
 * Slide between menus (Jom 25 Nov 2026): when the menu changes, the new page slides in from the side its menu item is
 * on — later in the menu from the right, earlier from the left. Self owner only for now; other roles keep no slide.
 * Order: the web sidebar (Dashboard, my rooms, add room, documents, income), then the phone tab bar's services and menu.
 */
const SELF_OWNER_ORDER = ['dashboard', 'listingRoom', 'createListing', 'contracts', 'income', 'services', 'menu'];

export type TabSlideDirection = 'left' | 'right';

export function tabSlideDirection(role: string, from: string | null | undefined, to: string): TabSlideDirection | null {
  if (role !== 'self_owner' || !from || from === to) return null;
  const a = SELF_OWNER_ORDER.indexOf(from);
  const b = SELF_OWNER_ORDER.indexOf(to);
  if (a < 0 || b < 0) return 'right';
  return b > a ? 'right' : 'left';
}
