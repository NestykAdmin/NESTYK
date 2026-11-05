import type { AppIconName, MobileAppTab } from "@nestyk/ui/native";

export type AgentWebDestination = Extract<
  MobileAppTab,
  | "dashboard"
  | "listingRoom"
  | "listingLead"
  | "clients"
  | "calendar"
  | "contact"
  | "services"
  | "contracts"
>;

export interface AgentWebMenuItem {
  tab: AgentWebDestination;
  icon: AppIconName;
  labelKey?: "openCalendar" | "openContacts" | "openServices" | "openContracts";
}

export const AGENT_WEB_PRIMARY: ReadonlyArray<AgentWebMenuItem> = [
  { tab: "dashboard", icon: "grid" },
  { tab: "listingRoom", icon: "buildings" },
  { tab: "listingLead", icon: "clipboard" },
  { tab: "clients", icon: "handshake" },
];
/** The same four shortcuts and order as the mobile Agent More menu. */
export const AGENT_WEB_MORE: ReadonlyArray<AgentWebMenuItem> = [
  { tab: "calendar", icon: "calendar", labelKey: "openCalendar" },
  { tab: "contact", icon: "users", labelKey: "openContacts" },
  { tab: "services", icon: "buildings", labelKey: "openServices" },
  { tab: "contracts", icon: "files", labelKey: "openContracts" },
];

/**
 * W1 (Mos 5 Nov 2026): create forms sit in a centred column on wide screens (agent-workspace.css
 * `[data-page-width="form"]`); lists and the Dashboard keep the full width. Layout only, same form and flow as the app.
 */
export type AgentWebPageWidth = "wide" | "form";

export function agentWebPageWidth(tab: MobileAppTab, creating?: "room" | "lead" | "tenant" | null): AgentWebPageWidth {
  if (creating === "tenant") return "form";
  return tab === "createListing" || tab === "createLead" ? "form" : "wide";
}

/** Keep the parent menu selected inside create/detail flows. */
export function agentWebParent(tab: MobileAppTab): AgentWebDestination | null {
  if (tab === "createListing") return "listingRoom";
  if (["createLead", "leadDetail", "leadInfo", "leadRoom"].includes(tab))
    return "listingLead";
  return [...AGENT_WEB_PRIMARY, ...AGENT_WEB_MORE].some(
    (item) => item.tab === tab,
  )
    ? (tab as AgentWebDestination)
    : null;
}
