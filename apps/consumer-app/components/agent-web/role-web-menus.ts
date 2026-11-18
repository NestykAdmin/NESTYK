import type { AppIconName } from "@nestyk/ui/native";
import type { WorkspaceNavItem, WorkspaceNavSection } from "./AgentWorkspace.types";

/**
 * Web sidebars of the admin and the self owner (Mos 18 Nov 2026, canvas page "setting" A1 and O1).
 * Only the overview works yet; every other item shows "coming soon" (admin pages are samples, plan 3.5;
 * self_owner is round 2 of docs/ROLE-CHANGE-PLAN.md with sample menus only). Pure: no React.
 */
export interface RoleWebMenuCopy {
  comingSoon: string;
  dashboard: string;
  services: string;
  drawer: { users: string; tickets: string; system: string; audit: string; opsSettings: string };
  admin: { main: string };
  selfOwner: {
    main: string;
    money: string;
    listings: string;
    interested: string;
    viewings: string;
    tenants: string;
    contracts: string;
    billsIncome: string;
    repairs: string;
  };
}

function soon(id: string, icon: AppIconName, label: string, comingSoon: string): WorkspaceNavItem {
  return { id, icon, label, disabled: true, badge: comingSoon, title: `${label} · ${comingSoon}`, onPress: () => {} };
}

function overview(copy: RoleWebMenuCopy, active: boolean, onOverview: () => void): WorkspaceNavItem {
  return { id: "dashboard", icon: "grid", label: copy.dashboard, active, onPress: onOverview };
}

export function adminWebNavSections(copy: RoleWebMenuCopy, overviewActive: boolean, onOverview: () => void): WorkspaceNavSection[] {
  const s = copy.comingSoon;
  return [
    {
      id: "main",
      caption: copy.admin.main,
      items: [
        overview(copy, overviewActive, onOverview),
        soon("users", "user", copy.drawer.users, s),
        soon("tickets", "ticket", copy.drawer.tickets, s),
        soon("services", "wrench", copy.services, s),
      ],
    },
    {
      id: "system",
      caption: copy.drawer.system,
      items: [soon("audit", "clipboard", copy.drawer.audit, s), soon("opsSettings", "gear", copy.drawer.opsSettings, s)],
    },
  ];
}

export function selfOwnerWebNavSections(copy: RoleWebMenuCopy, overviewActive: boolean, onOverview: () => void): WorkspaceNavSection[] {
  const s = copy.comingSoon;
  const o = copy.selfOwner;
  return [
    {
      id: "main",
      caption: o.main,
      items: [
        overview(copy, overviewActive, onOverview),
        soon("listings", "buildings", o.listings, s),
        soon("interested", "clipboard", o.interested, s),
        soon("viewings", "calendar", o.viewings, s),
      ],
    },
    {
      id: "money",
      caption: o.money,
      items: [
        soon("tenants", "user", o.tenants, s),
        soon("contracts", "file-text", o.contracts, s),
        soon("billsIncome", "credit-card", o.billsIncome, s),
        soon("repairs", "wrench", o.repairs, s),
      ],
    },
  ];
}
