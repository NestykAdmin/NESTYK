import React from "react";
import { MobileIcon } from "@nestyk/ui/native";

/** Shared by web entry points only; keep native selectors on their existing implementation. */
export function AgentSelect(props: React.ComponentPropsWithoutRef<"select">) {
  return (
    <span
      className="aw-select-control"
      data-disabled={props.disabled || undefined}
    >
      <select {...props} />
      <span className="aw-select-chevron" aria-hidden="true">
        <MobileIcon name="chevron-down" size={16} color="currentColor" />
      </span>
    </span>
  );
}
