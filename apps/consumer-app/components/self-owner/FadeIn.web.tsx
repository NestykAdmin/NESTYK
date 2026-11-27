import React, { useState } from "react";

/**
 * New content fading in where the frame stays still (Jom 25 Nov 2026: inside the contracts dialog and between the sign
 * page's steps a slide looked odd, so these fade). Keyed by the caller so it plays once per change; `active` false (the
 * first show) renders the content with no wrapper.
 */
export function FadeIn({ active, fill = false, children }: { active: boolean; /** Pass a filling page's height through (the phone screens on the web). */ fill?: boolean; children?: React.ReactNode }) {
  const [on] = useState(active);
  if (!on) return <>{children}</>;
  return <div className={`so-fade${fill ? " so-fade-fill" : ""}`}>{children}</div>;
}
