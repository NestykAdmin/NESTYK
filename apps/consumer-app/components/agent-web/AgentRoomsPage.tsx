import React from "react";
import { AgentRoomsScreen } from "../AgentRoomsScreen";
import type { AgentRoomsPageProps } from "./AgentRoomsPage.types";

/** Platform fallback: native keeps the app's room list; the web table and its CSS stay out of native bundles. */
export function AgentRoomsPage({ reloadToken, onReloadSettled }: AgentRoomsPageProps) {
  return <AgentRoomsScreen reloadToken={reloadToken} onReloadSettled={onReloadSettled} />;
}
