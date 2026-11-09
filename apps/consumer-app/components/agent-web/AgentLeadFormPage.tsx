import React from "react";
import type { AgentLeadFormPageProps } from "./AgentLeadFormPage.types";

/** Platform fallback: native (and phone-width web, which index.tsx never wraps) keep the app's form as it is. */
export function AgentLeadFormPage({ children }: AgentLeadFormPageProps) {
  return <>{children({})}</>;
}
