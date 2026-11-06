import React, { useEffect, useState } from "react";
import { MobileIcon, useMobileTheme, type AppIconName } from "@nestyk/ui/native";
import { useLocale } from "@nestyk/i18n";
import "./agent-web-ui.css";

/**
 * A7 shared states (plan step 3, 4 Nov 2026). One look for every web page and table:
 * empty · no match for the filters · load error + retry · not found · no permission · offline.
 * Loading is `WebSkeleton` (grey bars in the shape of the content), not a spinner.
 */
export type WebStateKind = "empty" | "filtered" | "error" | "notFound" | "forbidden" | "offline";

export interface WebStateProps {
  kind: WebStateKind;
  /** Override the default title / text of the kind (e.g. "No leads yet"). */
  title?: string;
  description?: string;
  /** error / offline: shows "Try again". */
  onRetry?: () => void;
  /** filtered: shows "Clear filters". */
  onClearFilters?: () => void;
  /** notFound / forbidden: shows "Back to the list". */
  onBack?: () => void;
  /** Extra page button (e.g. "+ Add room" on an empty list). */
  action?: React.ReactNode;
  /** Smaller padding, for cards and table bodies. */
  compact?: boolean;
  testID?: string;
}

const ICON: Record<WebStateKind, AppIconName> = {
  empty: "clipboard",
  filtered: "funnel",
  error: "warning",
  notFound: "search",
  forbidden: "lock",
  offline: "wifi",
};

/** Problems the user should notice now are announced; quiet states are not. */
const URGENT: ReadonlySet<WebStateKind> = new Set(["error", "offline", "forbidden"]);

export function WebState(props: WebStateProps) {
  const { t } = useLocale();
  const { theme } = useMobileTheme();
  const copy = t.agent.dashboard.webStates;
  const defaults: Record<WebStateKind, [string, string]> = {
    empty: [copy.emptyTitle, copy.emptyBody],
    filtered: [copy.filteredTitle, copy.filteredBody],
    error: [copy.errorTitle, copy.errorBody],
    notFound: [copy.notFoundTitle, copy.notFoundBody],
    forbidden: [copy.forbiddenTitle, copy.forbiddenBody],
    offline: [copy.offlineTitle, copy.offlineBody],
  };
  const [title, description] = defaults[props.kind];
  const retry = (props.kind === "error" || props.kind === "offline") && props.onRetry;
  const clear = props.kind === "filtered" && props.onClearFilters;
  const back = (props.kind === "notFound" || props.kind === "forbidden") && props.onBack;
  return (
    <div
      className={`awu-state awu-state-${props.kind}${props.compact ? " awu-state-compact" : ""}`}
      role={URGENT.has(props.kind) ? "alert" : "status"}
      data-testid={props.testID ?? `state.${props.kind}`}
    >
      <span className="awu-state-icon" aria-hidden="true">
        <MobileIcon name={ICON[props.kind]} size={22} color={props.kind === "error" ? "#B42318" : theme.textSecondary} />
      </span>
      <p className="awu-state-title">{props.title ?? title}</p>
      <p className="awu-state-desc">{props.description ?? description}</p>
      {retry || clear || back || props.action ? (
        <div className="awu-state-actions">
          {retry ? (
            <button type="button" className="awu-btn awu-btn-primary" onClick={props.onRetry}>
              {copy.retry}
            </button>
          ) : null}
          {clear ? (
            <button type="button" className="awu-btn" onClick={props.onClearFilters}>
              {copy.clearFilters}
            </button>
          ) : null}
          {back ? (
            <button type="button" className="awu-btn" onClick={props.onBack}>
              {copy.backToList}
            </button>
          ) : null}
          {props.action}
        </div>
      ) : null}
    </div>
  );
}

/** Loading: grey bars in the shape of the content (rows × columns). Announced once as "Loading…". */
export function WebSkeleton({ rows = 5, columns = 4, testID }: { rows?: number; columns?: number; testID?: string }) {
  const { t } = useLocale();
  return (
    <div className="awu-skeleton" role="status" aria-busy="true" data-testid={testID ?? "state.loading"}>
      <span className="awu-sr">{t.common.loading}</span>
      {Array.from({ length: rows }, (_, row) => (
        <div className="awu-skeleton-row" key={row} aria-hidden="true">
          {Array.from({ length: columns }, (_, column) => (
            <span className="awu-skeleton-bar" key={column} style={{ width: `${column === 0 ? 70 : 45 + ((row + column) % 3) * 15}%` }} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Browser online / offline (web only). `true` when the browser cannot tell. */
export function useOnline(): boolean {
  const read = () => (typeof navigator === "undefined" || typeof navigator.onLine !== "boolean" ? true : navigator.onLine);
  const [online, setOnline] = useState(read);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const update = () => setOnline(read());
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online;
}
