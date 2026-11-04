import type { MobileAppTab } from '../components/MobileBottomTabBar';

/**
 * Agent tabs that are not finished yet: shown as "coming soon" and cannot be opened
 * (team decision 2 Nov 2026, docs: nestyk-meeting-20261102-menu-roles-analysis.md, section 8.2).
 * The mobile More tab, the mobile drawer and the agent web sidebar all read this list.
 * Remove a tab from here when its page is ready.
 */
export const AGENT_COMING_SOON_TABS: readonly MobileAppTab[] = ['contact', 'contracts', 'services'];

export function isAgentComingSoonTab(tab: MobileAppTab): boolean {
  return AGENT_COMING_SOON_TABS.includes(tab);
}
