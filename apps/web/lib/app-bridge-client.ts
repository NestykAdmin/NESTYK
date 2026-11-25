import type { GuestProfile } from './guest-session';
import {
  APP_FLAG,
  APP_RECEIVE,
  APP_REPLY_TIMEOUT_MS,
  isInApp,
  parseAppMessage,
  webMessage,
  type AppPage,
  type AppToWeb,
  type WebToApp,
} from './app-bridge';

/**
 * Talking to the NESTYK app from the guest web shown inside it (W1). Browser only. Rules: lib/app-bridge.ts.
 * Requests carry an id; the app answers through window.__nestykAppReceive. No answer in time = not signed in.
 */
type Bridge = { postMessage: (message: string) => void };
type AppWindow = Window & { ReactNativeWebView?: Bridge; [APP_FLAG]?: unknown; [APP_RECEIVE]?: (raw: unknown) => void };

const waiting = new Map<string, (reply: AppToWeb | null) => void>();
const changeListeners = new Set<() => void>();
const navigateListeners = new Set<(path: string) => void>();
let counter = 0;

function appWindow(): AppWindow | null {
  return typeof window === 'undefined' ? null : (window as AppWindow);
}

/** True when this page is open inside the NESTYK app. */
export function inApp(): boolean {
  const win = appWindow();
  if (!win) return false;
  return isInApp({ hasBridge: typeof win.ReactNativeWebView?.postMessage === 'function', flag: win[APP_FLAG], userAgent: win.navigator?.userAgent ?? '' });
}

function listen(win: AppWindow): void {
  if (win[APP_RECEIVE]) return;
  win[APP_RECEIVE] = (raw: unknown) => {
    const reply = parseAppMessage(raw);
    if (!reply) return;
    if (reply.type === 'session.changed') {
      for (const listener of changeListeners) listener();
      return;
    }
    if (reply.type === 'navigate') {
      for (const listener of navigateListeners) listener(reply.path);
      return;
    }
    if (reply.id == null) return;
    const done = waiting.get(reply.id);
    if (!done) return;
    waiting.delete(reply.id);
    done(reply);
  };
}

function send(message: WebToApp): boolean {
  const win = appWindow();
  if (!win || !inApp()) return false;
  listen(win);
  try {
    win.ReactNativeWebView?.postMessage(webMessage(message));
    return true;
  } catch {
    return false;
  }
}

function ask(type: 'session.get' | 'token.get'): Promise<AppToWeb | null> {
  counter += 1;
  const id = `r${counter}-${Math.random().toString(36).slice(2, 10)}`;
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      waiting.delete(id);
      resolve(null);
    }, APP_REPLY_TIMEOUT_MS);
    waiting.set(id, (reply) => {
      clearTimeout(timer);
      resolve(reply);
    });
    if (!send({ type, id })) {
      clearTimeout(timer);
      waiting.delete(id);
      resolve(null);
    }
  });
}

/** Who is signed in to the app (null: signed out, or the app did not answer). */
export async function appSessionProfile(): Promise<GuestProfile | null> {
  const reply = await ask('session.get');
  return reply?.type === 'session' ? reply.profile : null;
}

/** The app's current access token and its user, for one API call. Never stored by this page. */
export async function appSessionToken(): Promise<{ token: string; userId: string } | null> {
  const reply = await ask('token.get');
  return reply?.type === 'token' && reply.token && reply.userId ? { token: reply.token, userId: reply.userId } : null;
}

/** Called when the app signs in, out or switches account. Returns the way to stop listening. */
export function onAppSessionChanged(listener: () => void): () => void {
  const win = appWindow();
  if (win) listen(win);
  changeListeners.add(listener);
  return () => changeListeners.delete(listener);
}

/** Signing out here signs the app out (the app owns the sign-in). */
export function signOutOfApp(): void {
  send({ type: 'auth.signOut' });
}

/** Opens the app's side menu ("my menu": account, roles, settings), as the avatar does for every other role. */
export function openAppMenu(): boolean {
  return send({ type: 'app.menu' });
}

/** Opens the app's notifications panel. */
export function openAppNotifications(): boolean {
  return send({ type: 'app.notifications' });
}

/** Opens the app's own sign-in, sign-up or legal screen. False when not in the app (follow the link instead). */
export function openAppPage(page: AppPage): boolean {
  return send({ type: 'app.open', page });
}

/** Called when the app's side menu asks this page to go to one of its paths. Returns the way to stop listening. */
export function onAppNavigate(listener: (path: string) => void): () => void {
  const win = appWindow();
  if (win) listen(win);
  navigateListeners.add(listener);
  return () => navigateListeners.delete(listener);
}
