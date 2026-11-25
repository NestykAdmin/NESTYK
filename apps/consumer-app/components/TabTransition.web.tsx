import React, { useState } from "react";
import type { TabSlideDirection } from "../lib/tab-transition";
import "./tab-transition.css";

/**
 * Wraps one menu's page (keyed per menu by the shell, so it mounts on each change) and slides it in once from
 * `direction`. With no direction the page renders as before, with no wrapper (Jom 25 Nov 2026).
 */
export function TabTransition({ direction, children }: { direction: TabSlideDirection | null; children?: React.ReactNode }) {
  // The side is fixed at mount: later renders of the same page never slide again.
  const [side] = useState(direction);
  if (!side) return <>{children}</>;
  return <div className={`tab-slide tab-slide-${side}`}>{children}</div>;
}
