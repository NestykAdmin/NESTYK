import type { AppIconName, MobileAppTab } from "@nestyk/ui/native";

/** Destinations the landlord can already open from the mobile tabs and drawer. */
export type LandlordWebItemId =
  | "dashboard"
  | "contracts"
  | "tenants"
  | "income"
  | "services"
  | "occupancy";

export interface LandlordWebItem {
  id: LandlordWebItemId;
  icon: AppIconName;
  section: "main" | "more";
  target:
    | { type: "tab"; tab: "dashboard" | "income" | "services" }
    | { type: "contracts" }
    | { type: "tenants" }
    | { type: "soon" };
}

export const LANDLORD_WEB_MENU: ReadonlyArray<LandlordWebItem> = [
  { id: "dashboard", icon: "grid", section: "main", target: { type: "tab", tab: "dashboard" } },
  { id: "contracts", icon: "clipboard", section: "main", target: { type: "contracts" } },
  { id: "tenants", icon: "user", section: "main", target: { type: "tenants" } },
  { id: "income", icon: "credit-card", section: "main", target: { type: "tab", tab: "income" } },
  { id: "services", icon: "buildings", section: "more", target: { type: "tab", tab: "services" } },
  { id: "occupancy", icon: "home", section: "more", target: { type: "soon" } },
];

export function landlordWebLabel(
  id: LandlordWebItemId,
  copy: {
    tabs: { dashboard: string; income: string; services: string };
    drawerMenu: { ownerContracts: string; tenants: string; occupancy: string };
  },
): string {
  switch (id) {
    case "dashboard":
      return copy.tabs.dashboard;
    case "contracts":
      return copy.drawerMenu.ownerContracts;
    case "tenants":
      return copy.drawerMenu.tenants;
    case "income":
      return copy.tabs.income;
    case "services":
      return copy.tabs.services;
    case "occupancy":
      return copy.drawerMenu.occupancy;
  }
}

/** Sidebar highlight. An open contract inbox wins over the tab left behind underneath it. */
export function landlordWebActiveId(input: {
  partyInbox: boolean;
  contractHistory: boolean;
  activeTab: MobileAppTab;
}): LandlordWebItemId | null {
  if (input.partyInbox) return input.contractHistory ? "tenants" : "contracts";
  if (
    input.activeTab === "dashboard" ||
    input.activeTab === "income" ||
    input.activeTab === "services"
  ) {
    return input.activeTab;
  }
  return null;
}
