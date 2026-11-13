import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

export default createMiddleware(routing);

export const config = {
  // Guest pages only. Left alone: /api (rewritten to the backend), Next internals,
  // the room share page /s/<token>, signing links /sign/<token>, files with an extension, and the
  // account web paths handed to the consumer-app (lib/account-routes.js ACCOUNT_PATHS, kept in step by its test).
  matcher: [
    '/((?!api|_next|_vercel|s/|sign/|(?:login|register|reset-password|no-access|privacy|terms|agent|tenant|landlord|admin|owner|_expo|assets)(?:/|$)|.*\\..*).*)',
  ],
};
