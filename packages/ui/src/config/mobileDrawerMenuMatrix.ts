import { UserRole } from '@nestyk/types';
import { AppIconName } from '../icons/types';
import { MobileAppTab } from '../components/MobileBottomTabBar';

export type DrawerMenuLabelKey =
  | 'sectionTitle'
  | 'favorites'
  | 'viewings'
  | 'help'
  | 'faq'
  | 'contactSupport'
  | 'contract'
  | 'reportIssue'
  | 'documents'
  | 'leaseDoc'
  | 'receipts'
  | 'tenants'
  | 'ownerContracts'
  | 'reports'
  | 'incomeReport'
  | 'occupancy'
  | 'listing'
  | 'listingRoom'
  | 'createListing'
  | 'listingLead'
  | 'crm'
  | 'contact'
  | 'calendar'
  | 'commission'
  | 'agentContracts'
  | 'clients'
  | 'moreTools'
  | 'users'
  | 'tickets'
  | 'system'
  | 'audit'
  | 'opsSettings';

export type DrawerMenuAction =
  | { type: 'tab'; tab: MobileAppTab }
  | { type: 'route'; path: string }
  | { type: 'action'; id: string };

export type DrawerSubmenuPresentation = 'slide' | 'expand';

export interface DrawerMenuItem {
  id: string;
  labelKey: DrawerMenuLabelKey;
  icon: AppIconName;
  /** Leaf action — ignored when children exist */
  action?: DrawerMenuAction;
  children?: DrawerMenuItem[];
  /** Default: slide when children exist */
  presentation?: DrawerSubmenuPresentation;
}

export interface DrawerMenuSection {
  titleKey?: DrawerMenuLabelKey;
  items: DrawerMenuItem[];
}

const HELP_CHILDREN: DrawerMenuItem[] = [
  { id: 'faq', labelKey: 'faq', icon: 'chat', action: { type: 'action', id: 'faq' } },
  {
    id: 'contactSupport',
    labelKey: 'contactSupport',
    icon: 'siren',
    action: { type: 'action', id: 'contactSupport' },
  },
];

const DRAWER_MENU_MATRIX: Record<UserRole, DrawerMenuSection[]> = {
  guest: [
    {
      titleKey: 'sectionTitle',
      items: [
        { id: 'favorites', labelKey: 'favorites', icon: 'heart', action: { type: 'route', path: '/favorites' } },
        { id: 'viewings', labelKey: 'viewings', icon: 'calendar', action: { type: 'route', path: '/viewings' } },
        {
          id: 'help',
          labelKey: 'help',
          icon: 'chat',
          presentation: 'expand',
          children: HELP_CHILDREN,
        },
      ],
    },
  ],
  tenant: [
    {
      titleKey: 'sectionTitle',
      items: [
        { id: 'contract', labelKey: 'contract', icon: 'clipboard', action: { type: 'route', path: '/tenant/contract' } },
        {
          id: 'reportIssue',
          labelKey: 'reportIssue',
          icon: 'wrench',
          action: { type: 'tab', tab: 'services' },
        },
        {
          id: 'documents',
          labelKey: 'documents',
          icon: 'package',
          presentation: 'expand',
          children: [
            { id: 'leaseDoc', labelKey: 'leaseDoc', icon: 'clipboard', action: { type: 'route', path: '/tenant/lease' } },
            { id: 'receipts', labelKey: 'receipts', icon: 'credit-card', action: { type: 'route', path: '/tenant/receipts' } },
          ],
        },
      ],
    },
  ],
  landlord: [
    {
      titleKey: 'sectionTitle',
      items: [
        { id: 'tenants', labelKey: 'tenants', icon: 'user', action: { type: 'route', path: '/landlord/tenants' } },
        {
          id: 'ownerContracts',
          labelKey: 'ownerContracts',
          icon: 'clipboard',
          action: { type: 'route', path: '/landlord/contracts' },
        },
        {
          id: 'reports',
          labelKey: 'reports',
          icon: 'grid',
          presentation: 'expand',
          children: [
            {
              id: 'incomeReport',
              labelKey: 'incomeReport',
              icon: 'credit-card',
              action: { type: 'tab', tab: 'income' },
            },
            {
              id: 'occupancy',
              labelKey: 'occupancy',
              icon: 'home',
              action: { type: 'route', path: '/landlord/occupancy' },
            },
          ],
        },
      ],
    },
  ],
  agent: [
    {
      titleKey: 'sectionTitle',
      items: [
        {
          id: 'listing',
          labelKey: 'listing',
          icon: 'key',
          presentation: 'expand',
          children: [
            {
              id: 'createListing',
              labelKey: 'createListing',
              icon: 'sparkle',
              action: { type: 'tab', tab: 'createListing' },
            },
            {
              id: 'listingRoom',
              labelKey: 'listingRoom',
              icon: 'buildings',
              action: { type: 'tab', tab: 'listingRoom' },
            },
            {
              id: 'listingLead',
              labelKey: 'listingLead',
              icon: 'clipboard',
              action: { type: 'tab', tab: 'listingLead' },
            },
          ],
        },
        {
          id: 'clients',
          labelKey: 'clients',
          icon: 'handshake',
          action: { type: 'tab', tab: 'clients' },
        },
        {
          id: 'crm',
          labelKey: 'crm',
          icon: 'handshake',
          presentation: 'expand',
          children: [
            { id: 'contact', labelKey: 'contact', icon: 'chat', action: { type: 'tab', tab: 'contact' } },
            { id: 'calendar', labelKey: 'calendar', icon: 'calendar', action: { type: 'tab', tab: 'calendar' } },
          ],
        },
        {
          id: 'agentContracts',
          labelKey: 'agentContracts',
          icon: 'clipboard',
          action: { type: 'tab', tab: 'contracts' },
        },
        {
          id: 'commission',
          labelKey: 'commission',
          icon: 'credit-card',
          action: { type: 'route', path: '/agent/commission' },
        },
        {
          id: 'moreTools',
          labelKey: 'moreTools',
          icon: 'wrench',
          action: { type: 'tab', tab: 'more' },
        },
      ],
    },
  ],
  admin: [
    {
      titleKey: 'sectionTitle',
      items: [
        { id: 'users', labelKey: 'users', icon: 'user', action: { type: 'route', path: '/admin/users' } },
        { id: 'tickets', labelKey: 'tickets', icon: 'ticket', action: { type: 'tab', tab: 'tickets' } },
        {
          id: 'system',
          labelKey: 'system',
          icon: 'gear',
          presentation: 'expand',
          children: [
            { id: 'audit', labelKey: 'audit', icon: 'clipboard', action: { type: 'route', path: '/admin/audit' } },
            {
              id: 'opsSettings',
              labelKey: 'opsSettings',
              icon: 'gear',
              action: { type: 'route', path: '/admin/ops-settings' },
            },
          ],
        },
      ],
    },
  ],
};

export function getDrawerMenuForRole(role: UserRole): DrawerMenuSection[] {
  return DRAWER_MENU_MATRIX[role] ?? DRAWER_MENU_MATRIX.guest;
}

export function findDrawerMenuItem(
  role: UserRole,
  itemId: string,
): DrawerMenuItem | undefined {
  for (const section of getDrawerMenuForRole(role)) {
    for (const item of section.items) {
      if (item.id === itemId) return item;
      const child = item.children?.find((c) => c.id === itemId);
      if (child) return child;
    }
  }
  return undefined;
}
