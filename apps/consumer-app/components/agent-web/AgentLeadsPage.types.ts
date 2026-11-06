import type { AgentLead } from "@nestyk/types";

export interface AgentLeadsPageProps {
  /** Soft chip from the Dashboard's "follow up leads" (same as the app screen). */
  workFilter?: "lead_follow_up" | null;
  /** Bumped by the shell after a lead is created or changed elsewhere: the page loads again. */
  reloadToken?: number;
  onReloadSettled?: (token: number) => void;
  onOpenLead: (lead: AgentLead) => void;
  /** The empty state's "Add lead" button. */
  onAddLead?: () => void;
}
