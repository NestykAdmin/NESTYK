import React from "react";
import { MobileAgentDashboardBody } from "@nestyk/feature-listing";
import type { AgentOverviewProps } from "./AgentOverview.types";

/** Platform fallback: the desktop implementation and its CSS stay out of native bundles. */
export function AgentOverview(props: AgentOverviewProps) {
  return (
    <MobileAgentDashboardBody
      snapshot={props.snapshot}
      onNavigate={props.onNavigate}
    />
  );
}
