import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

export default createMiddleware(routing);

export const config = {
  // Guest pages only. Left alone: /api (rewritten to the backend), Next internals,
  // the room share page /s/<token>, signing links /sign/<token>, and files with an extension.
  matcher: ['/((?!api|_next|_vercel|s/|sign/|.*\\..*).*)'],
};
