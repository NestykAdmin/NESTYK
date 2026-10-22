import React from "react";
import type { AgentWorkspaceProps } from "./AgentWorkspace.types";

/** Native platforms keep their existing navigation and page shell. */
export function AgentWorkspace({ children }: AgentWorkspaceProps) {
  return <>{children}</>;
}
