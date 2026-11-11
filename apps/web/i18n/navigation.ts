import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

/**
 * Language-aware Link / redirect / usePathname / useRouter for the guest pages.
 * Use them from client components: server-side helpers would need next-intl's request
 * config, which this app does not set up (copy comes from @nestyk/i18n).
 */
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
