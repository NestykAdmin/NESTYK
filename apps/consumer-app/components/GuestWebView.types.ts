import type { AppPage } from '../lib/guest-web-bridge';

/**
 * The guest's whole screen in the app (step 2, design W, Mos 24 Nov 2026): the guest web from its home, in the app's
 * language. Its app bar and links call back into the app for the side menu, notifications and the app's own
 * sign-in / legal screens.
 */
export type GuestWebViewProps = {
  onOpenMenu: () => void;
  onOpenNotifications: () => void;
  onOpenPage: (page: AppPage) => void;
  /** Android Back may walk back through the web's pages (false while the side menu or notifications are open). */
  backEnabled: boolean;
};

/** The app's side menu moves the page (Favourites → /saved, My viewing requests → /viewing-requests). */
export type GuestWebViewHandle = {
  navigate: (path: string) => void;
};
