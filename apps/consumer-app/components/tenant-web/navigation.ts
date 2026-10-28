import type { AppIconName, MobileAppTab } from "@nestyk/ui/native";

/** Destinations the tenant can already open from the mobile tabs and drawer. */
export type TenantWebItemId =
  | "dashboard"
  | "living"
  | "contracts"
  | "bills"
  | "services"
  | "leaseDoc"
  | "receipts";

export interface TenantWebItem {
  id: TenantWebItemId;
  icon: AppIconName;
  section: "main" | "more";
  target:
    | { type: "tab"; tab: "dashboard" | "living" | "bills" | "services" }
    | { type: "contracts" }
    | { type: "soon" };
}

export const TENANT_WEB_MENU: ReadonlyArray<TenantWebItem> = [
  { id: "dashboard", icon: "grid", section: "main", target: { type: "tab", tab: "dashboard" } },
  { id: "living", icon: "home", section: "main", target: { type: "tab", tab: "living" } },
  { id: "contracts", icon: "clipboard", section: "main", target: { type: "contracts" } },
  { id: "bills", icon: "credit-card", section: "main", target: { type: "tab", tab: "bills" } },
  { id: "services", icon: "buildings", section: "more", target: { type: "tab", tab: "services" } },
  { id: "leaseDoc", icon: "package", section: "more", target: { type: "soon" } },
  { id: "receipts", icon: "credit-card", section: "more", target: { type: "soon" } },
];

export function tenantWebLabel(
  id: TenantWebItemId,
  copy: {
    tabs: { dashboard: string; living: string; bills: string; services: string };
    drawerMenu: { contract: string; leaseDoc: string; receipts: string };
  },
): string {
  switch (id) {
    case "dashboard":
      return copy.tabs.dashboard;
    case "living":
      return copy.tabs.living;
    case "contracts":
      return copy.drawerMenu.contract;
    case "bills":
      return copy.tabs.bills;
    case "services":
      return copy.tabs.services;
    case "leaseDoc":
      return copy.drawerMenu.leaseDoc;
    case "receipts":
      return copy.drawerMenu.receipts;
  }
}

/** Sidebar highlight. The contract inbox, including room history, stays on Contracts. */
export function tenantWebActiveId(input: {
  partyInbox: boolean;
  activeTab: MobileAppTab;
}): TenantWebItemId | null {
  if (input.partyInbox) return "contracts";
  if (
    input.activeTab === "dashboard" ||
    input.activeTab === "living" ||
    input.activeTab === "bills" ||
    input.activeTab === "services"
  ) {
    return input.activeTab;
  }
  return null;
}
