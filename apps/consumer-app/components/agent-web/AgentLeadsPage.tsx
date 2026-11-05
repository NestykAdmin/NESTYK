import React from "react";
import { AgentLeadsScreen } from "../AgentLeadsScreen";
import type { AgentLeadsPageProps } from "./AgentLeadsPage.types";

/** Platform fallback: native keeps the app's lead list; the web table and its CSS stay out of native bundles. */
export function AgentLeadsPage({ workFilter, reloadToken, onReloadSettled, onOpenLead }: AgentLeadsPageProps) {
  return (
    <AgentLeadsScreen
      workFilter={workFilter}
      reloadToken={reloadToken}
      onReloadSettled={onReloadSettled}
      onOpenLead={onOpenLead}
    />
  );
}
