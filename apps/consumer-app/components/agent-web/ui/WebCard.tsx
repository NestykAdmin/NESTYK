import React from "react";
import "./agent-web-ui.css";

export interface WebCardProps {
  title?: string;
  /** Buttons or links at the right of the title. */
  actions?: React.ReactNode;
  /** `none` for tables and lists that run edge to edge. */
  padding?: "md" | "none";
  testID?: string;
  children?: React.ReactNode;
}

/** White borderless card with a soft shadow on the grey page background. */
export function WebCard(props: WebCardProps) {
  const headingId = props.title && props.testID ? `awu-card-${props.testID}` : undefined;
  return (
    <section
      className={`awu-card${props.padding === "none" ? " awu-card-flush" : ""}`}
      aria-labelledby={headingId}
      data-testid={props.testID}
    >
      {props.title || props.actions ? (
        <div className="awu-card-head">
          {props.title ? <h2 id={headingId}>{props.title}</h2> : <span />}
          {props.actions ? <div className="awu-card-actions">{props.actions}</div> : null}
        </div>
      ) : null}
      {props.children}
    </section>
  );
}
