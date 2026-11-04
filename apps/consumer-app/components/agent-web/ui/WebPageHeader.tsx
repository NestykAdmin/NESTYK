import React from "react";
import { MobileIcon, useMobileTheme } from "@nestyk/ui/native";
import { useLocale } from "@nestyk/i18n";
import "./agent-web-ui.css";

export interface WebCrumb {
  label: string;
  /** Omit on the current page (last crumb). */
  onPress?: () => void;
}

export interface WebPageHeaderProps {
  /** Shown only on pages two or more levels deep (2+ crumbs). The page title itself lives in the top bar. */
  breadcrumb?: WebCrumb[];
  description?: string;
  /** Page buttons, primary last. */
  actions?: React.ReactNode;
  testID?: string;
}

/** Row under the top bar: breadcrumb (deep pages only) · description · page actions. */
export function WebPageHeader(props: WebPageHeaderProps) {
  const { t } = useLocale();
  const { theme } = useMobileTheme();
  const crumbs = props.breadcrumb && props.breadcrumb.length >= 2 ? props.breadcrumb : null;
  return (
    <div className="awu-page-header" data-testid={props.testID}>
      {crumbs ? (
        <nav aria-label={t.agent.dashboard.webWorkspace.breadcrumb} className="awu-crumbs">
          <ol>
            {crumbs.map((crumb, index) => {
              const last = index === crumbs.length - 1;
              return (
                <li key={`${index}-${crumb.label}`}>
                  {last || !crumb.onPress ? (
                    <span aria-current={last ? "page" : undefined}>{crumb.label}</span>
                  ) : (
                    <button type="button" onClick={crumb.onPress}>
                      {crumb.label}
                    </button>
                  )}
                  {last ? null : (
                    <MobileIcon name="chevron-right" size={14} color={theme.textSecondary} />
                  )}
                </li>
              );
            })}
          </ol>
        </nav>
      ) : null}
      {props.description || props.actions ? (
        <div className="awu-page-row">
          {props.description ? <p className="awu-page-desc">{props.description}</p> : <span />}
          {props.actions ? <div className="awu-page-actions">{props.actions}</div> : null}
        </div>
      ) : null}
    </div>
  );
}
